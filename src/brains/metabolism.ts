/**
 * CQM2 Exact 15-Pool Conserved Biophysical Metabolism, Pulmonary Bohr-Shift & Autophagy Engine.
 * Implements Cahill/Owen multi-organ fuel partitioning + `LIFE-100` & `R21` upgrades:
 *   1. Exact pairwise pool flux transfers guaranteeing $\sum_{k=0}^{14} P_k(t) \equiv E_{\text{intake}}(t)$ (`< 1e-14` drift).
 *   2. Aerobic (`O2 >= 0.35`, high ATP yield) vs. Anaerobic glycolysis (`lactate` accumulation + Cori gluconeogenesis).
 *   3. `CQM10` POMC/GLP-1 gut-nutrient satiety gating (halts hyperphagic overshoot before blood glucose spikes).
 *   4. `C16R` Briat-Gupta-Khammash Antithetic Integral Controller (`z1, z2`) + cephalic insulin for zero-steady-state-error glycemic homeostasis.
 *   5. Boltzmann/Arrhenius $Q_{10}$ biome temperature scaling, Pulmonary $\mathrm{O}_2/\mathrm{CO}_2/\mathrm{pH}$ Bohr shift,
 *      and Mitochondrial `ROS` + NREM `ULK1/AMPK` Autophagy repair (`N33`).
 */
import { ErpRelationalStore, METABOLIC_POOL_COUNT } from '../erp/relational-store';

export const P_GUT_GLC = 0;
export const P_GUT_AA = 1;
export const P_GUT_LIP = 2;
export const P_BLD_GLC = 3;
export const P_BLD_AA = 4;
export const P_BLD_FFA = 5;
export const P_BLD_KET = 6;
export const P_LACTATE = 7;
export const P_LIV_GLY = 8;
export const P_MUS_GLY = 9;
export const P_ADIPOSE = 10;
export const P_BIOMASS = 11;
export const P_ATP_BUF = 12;
export const P_HEAT_WORK = 13;
export const P_EXCRETED = 14;

export const DEFAULT_INITIAL_POOLS_15: readonly number[] = Object.freeze([
  6.0, // gutGlucoseKj
  4.0, // gutAminoKj
  4.0, // gutLipidKj
  4.0, // bloodGlucoseKj (target setpoint = 4.0 kJ!)
  2.5, // bloodAminoKj
  2.0, // bloodFreeFattyKj
  0.4, // bloodKetoneKj
  0.2, // lactateKj
  45.0, // liverGlycogenKj
  70.0, // muscleGlycogenKj
  120.0, // adiposeTriglycerideKj
  35.0, // structuralBiomassKj
  8.0, // cellularAtpBufferKj
  0.0, // dissipatedHeatWorkKj
  0.0, // excretedDetritusKj
]);

/**
 * Conserved internal transfer: moves at most `requestedKj` from `srcPool` to `dstPool`
 * without creating or destroying a single attojoule of energy!
 */
export function transferConservedPoolKj(
  pools15: Float64Array,
  baseOffset: number,
  srcPool: number,
  dstPool: number,
  requestedKj: number,
): number {
  if (requestedKj <= 0 || srcPool === dstPool) return 0;
  const avail = pools15[baseOffset + srcPool]!;
  if (avail <= 0) return 0;
  const moved = Math.min(avail, requestedKj);
  pools15[baseOffset + srcPool] = avail - moved;
  pools15[baseOffset + dstPool] = pools15[baseOffset + dstPool]! + moved;
  return moved;
}

/**
 * Conserved external nutrient intake: removes energy from the biome nutrient pool
 * and adds the exact same amount to both `gut` pools and `totalIntakeKj[entityId]`.
 */
export function ingestConservedMealKj(
  store: ErpRelationalStore,
  entityId: number,
  mealRequestedKj: number,
  carbFrac = 0.55,
  proteinFrac = 0.25,
): { ingestedKj: number; cephalicInsulinBoost: number; satietySignal: number } {
  const base = entityId * METABOLIC_POOL_COUNT;
  const gutLoad =
    store.pools15[base + P_GUT_GLC]! + store.pools15[base + P_GUT_AA]! + store.pools15[base + P_GUT_LIP]!;

  const glp1Satiety = Math.min(1.0, gutLoad / 22.0);
  const gatedRequest = Math.max(0, mealRequestedKj * (1.0 - 0.92 * glp1Satiety));
  if (gatedRequest <= 1e-9) {
    return { ingestedKj: 0, cephalicInsulinBoost: 0, satietySignal: glp1Satiety };
  }

  const bm = store.biomes.get(store.biomeFk[entityId]!);
  const availableEnv = bm ? bm.nutrientPoolKj : gatedRequest;
  const actualMeal = Math.min(availableEnv, gatedRequest);
  if (actualMeal <= 0) {
    return { ingestedKj: 0, cephalicInsulinBoost: 0, satietySignal: glp1Satiety };
  }
  if (bm) {
    bm.nutrientPoolKj -= actualMeal;
  }

  const cFrac = Math.max(0, Math.min(1, carbFrac));
  const pFrac = Math.max(0, Math.min(1 - cFrac, proteinFrac));
  const dGlc = actualMeal * cFrac;
  const dAa = actualMeal * pFrac;
  const dLip = actualMeal - (dGlc + dAa);

  store.pools15[base + P_GUT_GLC] = store.pools15[base + P_GUT_GLC]! + dGlc;
  store.pools15[base + P_GUT_AA] = store.pools15[base + P_GUT_AA]! + dAa;
  store.pools15[base + P_GUT_LIP] = store.pools15[base + P_GUT_LIP]! + dLip;
  store.totalIntakeKj[entityId] = store.totalIntakeKj[entityId]! + dGlc + dAa + dLip;

  const cephalicBoost = Math.min(0.45, 0.045 * dGlc);
  store.insulin[entityId] = Math.min(1.5, store.insulin[entityId]! + cephalicBoost);

  const postGutLoad = gutLoad + actualMeal;
  const postSatiety = Math.min(1.0, postGutLoad / 22.0);
  store.ghrelin[entityId] = Math.max(0.02, 1.0 - postSatiety);

  return {
    ingestedKj: dGlc + dAa + dLip,
    cephalicInsulinBoost: cephalicBoost,
    satietySignal: postSatiety,
  };
}

export interface MetabolicStepSummary {
  aliveCount: number;
  deathsThisStep: number;
  meanAtpKj: number;
  meanBloodGlucoseKj: number;
  meanHydration: number;
  meanBloodPh: number;
  meanRosDamage: number;
  totalNeuralAtpCostKj: number;
}

/**
 * Computes physiological $Q_{10} = 2.0^{(T - 293.15)/10}$ enzyme rate multiplier with high-temperature denaturation guard.
 */
export function computeBoltzmannQ10Factor(temperatureK: number): number {
  const t = Number.isFinite(temperatureK) ? temperatureK : 293.15;
  const rawQ10 = Math.pow(2.0, (t - 293.15) / 10.0);
  const denaturation = t > 315.0 ? Math.exp(-(t - 315.0) * 0.12) : 1.0;
  return Math.max(0.35, Math.min(2.4, rawQ10 * denaturation));
}

export function stepPopulationMetabolism(
  store: ErpRelationalStore,
  dtSec: number,
  options: {
    metabolicRateScale: number;
    oxygenSaturation: number;
    useAntitheticController?: boolean;
    enableTemperatureQ10?: boolean;
  },
): MetabolicStepSummary {
  const dt = Math.max(1e-4, Math.min(0.5, dtSec));
  const baseRateScale = Math.max(0.1, options.metabolicRateScale);
  const envO2 = Math.max(0.05, options.oxygenSaturation);
  const useAic = options.useAntitheticController ?? true;
  const useQ10 = options.enableTemperatureQ10 ?? true;

  let aliveCount = 0;
  let deaths = 0;
  let sumAtp = 0;
  let sumGlc = 0;
  let sumHyd = 0;
  let sumPh = 0;
  let sumRos = 0;
  let totalNeuralCost = 0;

  const GLYCEMIC_SETPOINT_KJ = 4.0;
  const aicMu = 2.0;
  const aicTheta = 0.5;
  const aicEta = 3.2;

  for (let e = 0; e < store.activeCount; e++) {
    if (store.alive[e] !== 1) continue;
    const base = e * METABOLIC_POOL_COUNT;
    const pools = store.pools15;
    const bm = store.biomes.get(store.biomeFk[e]!);
    const q10 = useQ10 && bm ? computeBoltzmannQ10Factor(bm.temperatureK) : 1.0;
    const sleepCode = store.sleepStage[e]!; // 0=WAKE, 1=NREM, 2=REM
    const sleepMetabolicFactor = sleepCode === 1 ? 0.72 : sleepCode === 2 ? 0.88 : 1.0;
    const rateScale = baseRateScale * q10 * sleepMetabolicFactor;

    store.ageSec[e] = store.ageSec[e]! + dt;

    // 1. Intestinal absorption: Gut -> Blood
    transferConservedPoolKj(pools, base, P_GUT_GLC, P_BLD_GLC, 1.35 * dt * rateScale);
    transferConservedPoolKj(pools, base, P_GUT_AA, P_BLD_AA, 0.65 * dt * rateScale);
    transferConservedPoolKj(pools, base, P_GUT_LIP, P_BLD_FFA, 0.55 * dt * rateScale);

    // 2. Endocrine & Antithetic Integral Glycemic Regulation (`C16R`)
    const bldGlc = pools[base + P_BLD_GLC]!;
    if (useAic) {
      let z1 = store.aicZ1[e]!;
      let z2 = store.aicZ2[e]!;
      const annihilation = aicEta * z1 * z2;
      z1 = Math.max(0.0, Math.min(5.0, z1 + dt * (aicMu - annihilation)));
      z2 = Math.max(0.0, Math.min(5.0, z2 + dt * (aicTheta * bldGlc - annihilation)));
      store.aicZ1[e] = z1;
      store.aicZ2[e] = z2;

      const insTarget = Math.max(0.05, Math.min(1.5, 0.35 + 0.85 * (z2 - z1) + 0.18 * (bldGlc - GLYCEMIC_SETPOINT_KJ)));
      const glcTarget = Math.max(0.05, Math.min(1.5, 0.25 + 0.95 * (z1 - z2) + 0.22 * (GLYCEMIC_SETPOINT_KJ - bldGlc)));
      store.insulin[e] = 0.75 * store.insulin[e]! + 0.25 * insTarget;
      store.glucagon[e] = 0.75 * store.glucagon[e]! + 0.25 * glcTarget;
    } else {
      store.insulin[e] = 0.35;
      store.glucagon[e] = 0.25;
    }

    const ins = store.insulin[e]!;
    const glg = store.glucagon[e]!;

    if (bldGlc > GLYCEMIC_SETPOINT_KJ && ins > 0.4) {
      const surplus = (bldGlc - GLYCEMIC_SETPOINT_KJ) * ins * 1.4 * dt;
      transferConservedPoolKj(pools, base, P_BLD_GLC, P_LIV_GLY, surplus * 0.55);
      transferConservedPoolKj(pools, base, P_BLD_GLC, P_MUS_GLY, surplus * 0.35);
      if (pools[base + P_LIV_GLY]! > 85.0) {
        transferConservedPoolKj(pools, base, P_LIV_GLY, P_ADIPOSE, 0.4 * dt);
      }
    } else if (bldGlc < GLYCEMIC_SETPOINT_KJ) {
      const deficit = (GLYCEMIC_SETPOINT_KJ - bldGlc) * (0.5 + glg * 1.6) * dt;
      const fromLiver = transferConservedPoolKj(pools, base, P_LIV_GLY, P_BLD_GLC, deficit);
      if (fromLiver < deficit * 0.5) {
        transferConservedPoolKj(pools, base, P_BLD_AA, P_BLD_GLC, (deficit - fromLiver) * 0.5);
        transferConservedPoolKj(pools, base, P_ADIPOSE, P_BLD_FFA, 0.8 * glg * dt);
        transferConservedPoolKj(pools, base, P_BLD_FFA, P_BLD_KET, 0.45 * glg * dt);
      }
    }

    const adipose = pools[base + P_ADIPOSE]!;
    store.leptin[e] = Math.max(0.0, Math.min(1.0, adipose / 200.0));
    const gutTotal = pools[base + P_GUT_GLC]! + pools[base + P_GUT_AA]! + pools[base + P_GUT_LIP]!;
    store.ghrelin[e] = Math.max(0.02, Math.min(1.0, 1.0 - gutTotal / 22.0));

    // 3. Pulmonary O2/CO2 Gas Exchange, Henderson-Hasselbalch Arterial pH & Bohr Shift
    const speedSq =
      store.velX[e]! * store.velX[e]! + store.velY[e]! * store.velY[e]! + store.velZ[e]! * store.velZ[e]!;
    const motorEffort = Math.min(2.5, Math.sqrt(speedSq));
    const prevPh = store.bloodPh[e]!;
    // Bohr shift: mild acidemia (pH ~ 7.25) facilitates tissue O2 unloading; gill O2 uptake scales with envO2
    const bohrUnloadingGain = Math.max(0.75, Math.min(1.25, 1.0 + 0.35 * (7.4 - prevPh)));
    const o2Demand = (0.08 + 0.14 * motorEffort) * dt * rateScale;
    const o2Uptake = 0.25 * envO2 * dt;
    const nextO2 = Math.max(0.0, Math.min(1.0, store.o2Reserve[e]! + o2Uptake - o2Demand));
    store.o2Reserve[e] = nextO2;

    const co2Prod = 0.82 * o2Demand; // Respiratory Quotient RQ ~ 0.82
    const gillVentilation = (0.22 + 0.12 * envO2) * dt;
    const nextCo2 = Math.max(0.04, Math.min(1.0, store.co2Level[e]! + co2Prod - gillVentilation * store.co2Level[e]! * 2.5));
    store.co2Level[e] = nextCo2;

    const lactateNow = pools[base + P_LACTATE]!;
    const arterialPh = Math.max(6.85, Math.min(7.65, 7.45 - 0.38 * nextCo2 - 0.035 * lactateNow));
    store.bloodPh[e] = arterialPh;

    // 4. Aerobic vs. Anaerobic Oxidative Phosphorylation
    const atpTargetBuffer = 8.5;
    const atpDeficit = Math.max(0, atpTargetBuffer - pools[base + P_ATP_BUF]!);
    const effectiveTissueO2 = nextO2 * bohrUnloadingGain;
    const oxphosEfficiency = arterialPh < 7.05 ? 0.50 : 0.62;

    if (atpDeficit > 0) {
      if (effectiveTissueO2 >= 0.35) {
        const fuelBurn = atpDeficit * 1.15;
        let captured = 0;
        const glcUsed = transferConservedPoolKj(pools, base, P_BLD_GLC, P_ATP_BUF, fuelBurn * 0.55 * oxphosEfficiency);
        transferConservedPoolKj(pools, base, P_BLD_GLC, P_HEAT_WORK, (glcUsed / oxphosEfficiency) * (1.0 - oxphosEfficiency));
        captured += glcUsed;

        if (captured < atpDeficit * 0.7) {
          const ffaUsed = transferConservedPoolKj(pools, base, P_BLD_FFA, P_ATP_BUF, (atpDeficit - captured) * 0.60);
          transferConservedPoolKj(pools, base, P_BLD_FFA, P_HEAT_WORK, (ffaUsed / 0.60) * 0.40);
          captured += ffaUsed;
        }
        if (captured < atpDeficit * 0.85) {
          transferConservedPoolKj(pools, base, P_BLD_KET, P_ATP_BUF, (atpDeficit - captured) * 0.60);
        }
        if (lactateNow > 0.1) {
          transferConservedPoolKj(pools, base, P_LACTATE, P_LIV_GLY, 0.35 * dt);
        }
      } else {
        const glcAvailAboveFloor = Math.max(0.0, pools[base + P_BLD_GLC]! - 0.45);
        const glcAnaerobic = Math.min(glcAvailAboveFloor, atpDeficit * 3.2 * dt * rateScale);
        transferConservedPoolKj(pools, base, P_BLD_GLC, P_ATP_BUF, glcAnaerobic * 0.15);
        transferConservedPoolKj(pools, base, P_BLD_GLC, P_LACTATE, glcAnaerobic * 0.85);
      }
    }

    // 5. Basal + Locomotor + `N33` Synaptic/Neural ATP Expenditure
    const mBase = e * 6;
    let neuralActivity = 0;
    for (let m = 0; m < 6; m++) {
      neuralActivity += Math.abs(store.motorOut6[mBase + m]!);
    }
    const plasticityGate = Math.abs(store.modulators2[e * 2]! * store.modulators2[e * 2 + 1]!);
    const neuralAtpCost = (0.025 + 0.018 * neuralActivity + 0.035 * plasticityGate) * dt * rateScale;
    const locomotorAtpCost = (0.055 + 0.095 * motorEffort) * dt * rateScale;
    totalNeuralCost += neuralAtpCost;

    transferConservedPoolKj(pools, base, P_ATP_BUF, P_HEAT_WORK, neuralAtpCost + locomotorAtpCost);
    transferConservedPoolKj(pools, base, P_BLD_AA, P_EXCRETED, 0.008 * dt * rateScale);

    // 6. Mitochondrial ROS Accumulation & NREM `ULK1/AMPK` Autophagy Clearance
    const rosGen = (0.0025 * rateScale + 0.003 * Math.max(0, envO2 - 1.0)) * dt;
    const autophagyClearance = sleepCode === 1 ? 0.045 * dt : 0.003 * dt;
    const nextRos = Math.max(0.0, Math.min(1.0, store.rosDamage[e]! + rosGen - autophagyClearance));
    store.rosDamage[e] = nextRos;
    if (sleepCode === 1 && nextRos > 0.05) {
      // Conserved NREM mitophagy/proteostasis recycling damaged structural protein back into blood amino acids
      transferConservedPoolKj(pools, base, P_BIOMASS, P_BLD_AA, 0.012 * dt);
      transferConservedPoolKj(pools, base, P_BLD_AA, P_BIOMASS, 0.011 * dt);
    }

    // 7. Hydration / Osmolarity Thirst & Telomere Senescence
    const evapLoss = (0.006 + 0.004 * motorEffort) * dt * rateScale;
    store.hydration[e] = Math.max(0.0, Math.min(1.0, store.hydration[e]! - evapLoss));
    const acidosisStress = Math.min(1.0, Math.max(0, 7.36 - arterialPh) * 2.5);
    store.cortisol[e] = Math.max(
      0.05,
      Math.min(
        1.0,
        0.3 * (1.0 - store.hydration[e]!) +
          0.35 * acidosisStress +
          0.2 * nextRos +
          0.2 * Math.max(0, 1.0 - pools[base + P_ATP_BUF]! / 3.0),
      ),
    );

    const telomereWear = (0.00014 + 0.00028 * store.cortisol[e]! + 0.00022 * nextRos) * dt * (sleepCode === 1 ? 0.45 : 1.0);
    store.telomereIntegrity[e] = Math.max(0.0, store.telomereIntegrity[e]! - telomereWear);

    // 8. Mortality check
    const atpNow = pools[base + P_ATP_BUF]!;
    if (atpNow <= 0.02 || store.hydration[e]! <= 0.03 || store.telomereIntegrity[e]! <= 0.01) {
      store.alive[e] = 0;
      deaths++;
      const sp = store.species.get(store.speciesFk[e]!);
      if (sp && sp.extantCount > 0) sp.extantCount -= 1;

      if (bm) {
        let corpseMassEnergy = 0;
        for (let k = 0; k <= P_ATP_BUF; k++) {
          corpseMassEnergy += pools[base + k]!;
        }
        bm.detritusPoolKj += corpseMassEnergy;
      }
      continue;
    }

    aliveCount++;
    sumAtp += atpNow;
    sumGlc += pools[base + P_BLD_GLC]!;
    sumHyd += store.hydration[e]!;
    sumPh += arterialPh;
    sumRos += nextRos;
  }

  // Ecological detritus mineralization (`detritusPoolKj -> nutrientPoolKj`)
  for (const bm of store.biomes.values()) {
    if (bm.detritusPoolKj > 0) {
      const remineralized = Math.min(bm.detritusPoolKj, bm.detritusPoolKj * 0.08 * dt);
      bm.detritusPoolKj -= remineralized;
      bm.nutrientPoolKj += remineralized;
    }
  }

  return {
    aliveCount,
    deathsThisStep: deaths,
    meanAtpKj: aliveCount > 0 ? sumAtp / aliveCount : 0,
    meanBloodGlucoseKj: aliveCount > 0 ? sumGlc / aliveCount : 0,
    meanHydration: aliveCount > 0 ? sumHyd / aliveCount : 0,
    meanBloodPh: aliveCount > 0 ? sumPh / aliveCount : 7.4,
    meanRosDamage: aliveCount > 0 ? sumRos / aliveCount : 0,
    totalNeuralAtpCostKj: totalNeuralCost,
  };
}
