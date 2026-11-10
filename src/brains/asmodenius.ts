/**
 * CQM2 Artificial Life Creature #1: `AsmodeniusV42Brain` (GrokBot / Asmodensius-v40 Lineage -> v42.1).
 * Implements a 14-region recurrent biophysical nervous system + Enteric Nervous System (`ENS`),
 * synthesizing every R21, `LIFE-100`, `NOVEL-100`, and `Consciousness-Researchers-Corpus` organ:
 *   1. Larkum Two-Compartment Basal x Apical NMDA Plateau + Hasani Semi-Implicit `sLTC` (`Zig` SIMD128)
 *      with **Dale's Law 80/20 `E/PV/SST/VIP` microcircuit** & **Tripartite Astrocyte `Ca²⁺` gliotransmission**.
 *   2. Surprise-gated Oja dendritic plasticity (`plasticW14x14`).
 *   3. `activeInference` (`AINF-H`): Frazier Knowledge-Gradient Value-of-Information (`VOI`).
 *   4. **Non-Oracle `CalibHead` `HOT-3`**: Endogenous Anterior Cingulate / Prefrontal confidence readout
 *      computed strictly from internal cross-channel dispersion & `E-I` workspace margin (`zero` oracle noise leak!).
 *   5. **Kalman `AST-1R` Attention Schema**, **Nonlinear `GNW` Global Ignition**, **Causal `CEMI` Ephaptic LFP Feedback**,
 *      **`AOM` Attention Depletion-Recovery**, **Striatal `D1/D2` Race + Learned `N13` Free-Won't Veto**,
 *      **4-Mode `PAG` Survival Column**, **`[NPY, CCK_GLP1, CRF, OXT]` Neuropeptides**, and **`SelfModel` (`SELF+SIM`)**.
 *   6. 6D Frenet-Serret Cognitive Trajectory Curvature $\kappa(t)$ & Torsion $\tau(t)$ + Real `motorCmd6`.
 *   7. Non-destructive Casali `PCI` TMS Poke Test (`WAKE` vs `NREM_SLOW_WAVE` vs `PROPOFOL_ANESTHESIA`).
 */
import { type ComputationalIndicatorContract, DeterministicRng, makeIndicator } from '../core/prng';
import { getZigBridge } from '../native/zig-bridge';

export const ASMODENIUS_14_REGIONS = [
  'SensoryThalamus',
  'PrimarySensoryCortex',
  'PrefrontalWorkspace',
  'AnteriorCingulateHOT',
  'HippocampusCA3',
  'BasalGangliaGoNoGo',
  'AmygdalaValence',
  'InsulaInteroception',
  'HypothalamusHomeostat',
  'CerebellumPurkinje',
  'MotorCortexM1',
  'BrainstemCPG24',
  'LocusCoeruleusNE',
  'EntericGutPlexus',
] as const;

export type AsmodeniusRegionName = (typeof ASMODENIUS_14_REGIONS)[number];
export type PagSurvivalMode = 'FORAGE' | 'FREEZE' | 'FLIGHT' | 'SOCIAL_GROOM';
export type TmsArousalMode = 'WAKE' | 'NREM_SLOW_WAVE' | 'PROPOFOL_ANESTHESIA';

export interface TmsPokeReport {
  perturbedRegion: AsmodeniusRegionName;
  arousalMode: TmsArousalMode;
  pciIndicator: ComputationalIndicatorContract<number>;
  lempelZivDictionarySize: number;
  functionalVsStructuralCorrelation: number;
  functionalFlowMatrix14x14: number[];
  structuralConnectome14x14: number[];
}

export interface AsmodeniusStepTelemetry {
  regionActivations14: number[];
  metacognitiveConfidenceHot3: ComputationalIndicatorContract<number>;
  epistemicValueOfInfo: number;
  gnwIgnited: boolean;
  attentionSchemaError: number;
  attentionResourceAom: number;
  cemiEphapticPhaseLock: number;
  pagSurvivalMode: PagSurvivalMode;
  neuropeptides4: { npy: number; cckGlp1: number; crf: number; oxt: number };
  selfAgencyScore: number;
  somaticFreeWontVetoTriggered: boolean;
  totalFreeWontVetoes: number;
  substrateAnomalyQuarantined: boolean;
  frenetCurvatureKappa: number;
  frenetTorsionTau: number;
  cpgPhaseRad: number;
  motorCmd6: [number, number, number, number, number, number];
}

export interface AsmodeniusStateSnapshot {
  vState: Float32Array;
  nmdaSlow: Float32Array;
  plasticW14x14: Float32Array;
  functionalF: Float32Array;
  astroCa14: Float32Array;
  attnSchema14: Float32Array;
  cpgPhases24: Float32Array;
  cpgMasterPhase: number;
  trajRing6D: Float64Array[];
  trajCount: number;
  freeWontVetoCount: number;
  substrateQuarantineActive: boolean;
  prevPhysicsSignature: number | null;
  attentionResourceAom: number;
  selfPredMotor: number;
  vetoWeightAv: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function sigmoid(x: number): number {
  if (x > 12) return 1;
  if (x < -12) return 0;
  return 1.0 / (1.0 + Math.exp(-x));
}

function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2.0 * Math.PI);
}

function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + 0.3275911 * z);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1.0 - poly * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * erf);
}

export function computeKnowledgeGradientVoi(
  priorMeanMargin: number,
  priorVariance: number,
  cueNoiseVariance: number,
  rewardScale = 10.0,
): number {
  if (priorVariance <= 1e-8) return 0;
  const denom = Math.sqrt(priorVariance + Math.max(1e-6, cueNoiseVariance));
  const sigmaTilde = (priorVariance / denom) * rewardScale;
  if (sigmaTilde <= 1e-8) return 0;
  const scaledMargin = Math.abs(priorMeanMargin) * rewardScale;
  const z = -scaledMargin / sigmaTilde;
  return Math.max(0, sigmaTilde * normalPdf(z) + z * sigmaTilde * normalCdf(z));
}

export function computeLempelZiv76Complexity(bits: Uint8Array): { rawCount: number; normalizedPci: number } {
  const n = bits.length;
  if (n === 0) return { rawCount: 0, normalizedPci: 0 };

  let ones = 0;
  let s = '';
  for (let i = 0; i < n; i++) {
    const b = bits[i]! ? 1 : 0;
    ones += b;
    s += b === 1 ? '1' : '0';
  }
  const p = ones / n;
  if (p <= 1e-6 || p >= 1.0 - 1e-6) {
    return { rawCount: 1, normalizedPci: 0.02 };
  }

  let c = 1;
  let l = 1;
  let i = 0;
  let k = 1;
  let kMax = 1;

  while (true) {
    if (s[i + k - 1] === s[l + k - 1]) {
      k++;
      if (l + k > n) {
        c++;
        break;
      }
    } else {
      if (k > kMax) kMax = k;
      i++;
      if (i === l) {
        c++;
        l += kMax;
        if (l + 1 > n) break;
        i = 0;
        k = 1;
        kMax = 1;
      } else {
        k = 1;
      }
    }
  }

  const hEntropy = -p * Math.log2(p) - (1.0 - p) * Math.log2(1.0 - p);
  const asympBound = n / Math.max(1.0, Math.log2(n));
  const normalized = Math.min(1.0, (c / asympBound) / Math.max(0.15, hEntropy));
  return { rawCount: c, normalizedPci: normalized };
}

export class AsmodeniusV42Brain {
  public static readonly REGION_COUNT = 14;
  public static readonly NEURONS_PER_REGION = 8; // Units 0..5 = Excitatory (E), Unit 6 = PV/SST Inhibitory, Unit 7 = VIP Disinhibitory!
  public static readonly TOTAL_NEURONS = 14 * 8;

  public readonly vState = new Float32Array(AsmodeniusV42Brain.TOTAL_NEURONS);
  public readonly nmdaSlow = new Float32Array(AsmodeniusV42Brain.TOTAL_NEURONS);
  public readonly basalDrive = new Float32Array(AsmodeniusV42Brain.TOTAL_NEURONS);
  public readonly apicalDrive = new Float32Array(AsmodeniusV42Brain.TOTAL_NEURONS);

  public readonly structuralW = new Float32Array(14 * 14);
  public readonly plasticW14x14 = new Float32Array(14 * 14);
  public readonly functionalF = new Float32Array(14 * 14);
  public readonly astroCa14 = new Float32Array(14);
  public readonly attnSchema14 = new Float32Array(14);

  public readonly cpgPhases24 = new Float32Array(24);
  public cpgMasterPhase = 0;

  private readonly trajRing6D: Float64Array[] = [
    new Float64Array(6),
    new Float64Array(6),
    new Float64Array(6),
    new Float64Array(6),
  ];
  private trajCount = 0;

  public freeWontVetoCount = 0;
  public substrateQuarantineActive = false;
  private prevPhysicsSignature: number | null = null;
  public attentionResourceAom = 0.88;
  private selfPredMotor = 0.0;
  public vetoWeightAv = 0.72;

  public constructor(seed = 20261110n) {
    const rng = new DeterministicRng(seed);
    this.initCanonicalConnectome(rng);
    for (let i = 0; i < 24; i++) {
      this.cpgPhases24[i] = (i / 24.0) * 2.0 * Math.PI;
    }
    this.astroCa14.fill(0.25);
  }

  private initCanonicalConnectome(rng: DeterministicRng): void {
    const edges: Array<[number, number, number]> = [
      [0, 1, 0.82],
      [1, 2, 0.76],
      [2, 3, 0.72],
      [3, 2, 0.48],
      [2, 4, 0.68],
      [4, 2, 0.64],
      [2, 5, 0.74],
      [6, 5, 0.58],
      [7, 3, 0.79],
      [7, 6, 0.66],
      [8, 7, 0.71],
      [13, 8, 0.83],
      [5, 10, 0.81],
      [9, 10, 0.69],
      [10, 9, 0.62],
      [10, 11, 0.85],
      [12, 2, 0.55],
      [12, 1, 0.52],
      [3, 12, 0.61],
    ];
    for (const [src, dst, weight] of edges) {
      this.structuralW[src * 14 + dst] = weight;
    }
    for (let r = 0; r < 14; r++) {
      for (let c = 0; c < 14; c++) {
        if (r !== c && this.structuralW[r * 14 + c] === 0 && rng.nextFloat() < 0.18) {
          this.structuralW[r * 14 + c] = rng.nextRange(0.04, 0.14);
        }
      }
    }
  }

  public snapshotState(): AsmodeniusStateSnapshot {
    return {
      vState: this.vState.slice(),
      nmdaSlow: this.nmdaSlow.slice(),
      plasticW14x14: this.plasticW14x14.slice(),
      functionalF: this.functionalF.slice(),
      astroCa14: this.astroCa14.slice(),
      attnSchema14: this.attnSchema14.slice(),
      cpgPhases24: this.cpgPhases24.slice(),
      cpgMasterPhase: this.cpgMasterPhase,
      trajRing6D: this.trajRing6D.map((v) => v.slice()),
      trajCount: this.trajCount,
      freeWontVetoCount: this.freeWontVetoCount,
      substrateQuarantineActive: this.substrateQuarantineActive,
      prevPhysicsSignature: this.prevPhysicsSignature,
      attentionResourceAom: this.attentionResourceAom,
      selfPredMotor: this.selfPredMotor,
      vetoWeightAv: this.vetoWeightAv,
    };
  }

  public restoreState(snap: AsmodeniusStateSnapshot): void {
    this.vState.set(snap.vState);
    this.nmdaSlow.set(snap.nmdaSlow);
    this.plasticW14x14.set(snap.plasticW14x14);
    this.functionalF.set(snap.functionalF);
    this.astroCa14.set(snap.astroCa14);
    this.attnSchema14.set(snap.attnSchema14);
    this.cpgPhases24.set(snap.cpgPhases24);
    this.cpgMasterPhase = snap.cpgMasterPhase;
    for (let i = 0; i < 4; i++) this.trajRing6D[i]!.set(snap.trajRing6D[i]!);
    this.trajCount = snap.trajCount;
    this.freeWontVetoCount = snap.freeWontVetoCount;
    this.substrateQuarantineActive = snap.substrateQuarantineActive;
    this.prevPhysicsSignature = snap.prevPhysicsSignature;
    this.attentionResourceAom = snap.attentionResourceAom;
    this.selfPredMotor = snap.selfPredMotor;
    this.vetoWeightAv = snap.vetoWeightAv;
  }

  public stepBrain(params: {
    sensory8: ArrayLike<number>;
    gutLoadKj: number;
    bloodGlucoseKj: number;
    somaticHazard: number;
    cueNoiseVariance: number;
    cueCost: number;
    physicsSignature: number;
    ach: number;
    ne: number;
    cemiCoupling?: number;
    gnwGain?: number;
    socialProximity?: number;
    dtSec: number;
  }): AsmodeniusStepTelemetry {
    const dt = clamp(params.dtSec, 1e-3, 0.25);
    const cemiGain = clamp(params.cemiCoupling ?? 0.22, 0.0, 1.0);
    const gnwGain = clamp(params.gnwGain ?? 1.0, 0.0, 2.0);
    const socialProx = clamp(params.socialProximity ?? 0.3, 0.0, 1.0);

    // 1. N52 Substrate Anomaly Detector (`P_SIM`)
    if (this.prevPhysicsSignature !== null) {
      const jump = Math.abs(params.physicsSignature - this.prevPhysicsSignature);
      this.substrateQuarantineActive = jump > 0.35;
    }
    this.prevPhysicsSignature = params.physicsSignature;

    // 2. Dale's Law 80/20 Regional Excitatory (`0..5`), PV/SST Inhibitory (`6`), VIP Disinhibitory (`7`) + CEMI LFP
    const regExcit = new Float32Array(14);
    const regPvSst = new Float32Array(14);
    const regVip = new Float32Array(14);
    let globalLfpSum = 0;

    for (let r = 0; r < 14; r++) {
      let eSum = 0;
      for (let k = 0; k < 6; k++) {
        const rate = sigmoid(this.vState[r * 8 + k]!);
        eSum += rate;
        globalLfpSum += this.vState[r * 8 + k]!;
      }
      regExcit[r] = eSum / 6.0;
      regPvSst[r] = sigmoid(this.vState[r * 8 + 6]!);
      regVip[r] = sigmoid(this.vState[r * 8 + 7]!);
      // Tripartite astrocyte Ca2+ tracks regional glutamatergic E activity
      this.astroCa14[r] = clamp(0.92 * this.astroCa14[r]! + 0.08 * regExcit[r]!, 0.05, 1.0);
    }
    const meanLfpField = globalLfpSum / (14.0 * 6.0);
    const cemiEphapticDrive = cemiGain * 0.28 * Math.tanh(meanLfpField);

    // 3. Hypothalamic / Enteric Neuropeptides (`[NPY, CCK_GLP1, CRF, OXT]`)
    const npy = clamp(sigmoid((4.0 - params.bloodGlucoseKj) * 1.6) * (1.0 - Math.tanh(params.gutLoadKj / 20.0)), 0, 1);
    const cckGlp1 = clamp(Math.tanh(params.gutLoadKj / 16.0), 0, 1);
    const crf = clamp(0.75 * params.somaticHazard + 0.25 * params.ne, 0, 1);
    const oxt = clamp(socialProx * (1.0 - 0.6 * crf), 0, 1);

    // 4. Assemble Basal & Apical Drives with Dale's Law Inhibition, Astrocyte Ca2+, GNW Ignition & CEMI Field
    this.basalDrive.fill(0);
    this.apicalDrive.fill(0);

    for (let k = 0; k < 8; k++) {
      const sVal = Number(params.sensory8[k] ?? 0);
      const inhSign = k === 6 ? 0.8 : 1.0;
      this.basalDrive[0 * 8 + k] = sVal * 1.35 * inhSign + cemiEphapticDrive;
      this.basalDrive[1 * 8 + k] = sVal * 0.95 * inhSign + cemiEphapticDrive;
      this.basalDrive[13 * 8 + k] = cckGlp1 * (k % 2 === 0 ? 1.15 : 0.75);
      this.basalDrive[8 * 8 + k] = (npy - 0.6 * cckGlp1) * 1.25;
      this.basalDrive[7 * 8 + k] = (params.somaticHazard * 1.45 - 0.35 * oxt) + cemiEphapticDrive;
    }

    // Nonlinear GNW Ignition (`PrefrontalWorkspace` r=2 <-> `PrimarySensory` r=1 / `ACC` r=3)
    const workspaceDrive = 0.5 * regExcit[2]! + 0.3 * regExcit[1]! + 0.2 * regExcit[3]!;
    const gnwIgnited = gnwGain * workspaceDrive * this.attentionResourceAom > 0.36;
    // AOM attention resource depletes slightly during sustained ignition and recovers at rest
    this.attentionResourceAom = clamp(
      this.attentionResourceAom + dt * (gnwIgnited ? -0.06 : 0.09 * (1.0 - this.attentionResourceAom)),
      0.25,
      1.0,
    );

    const surprise = clamp(Math.abs(regExcit[3]! - regExcit[2]!) + 0.3 * params.ne, 0, 1);
    for (let dst = 0; dst < 14; dst++) {
      let apSum = 0;
      for (let src = 0; src < 14; src++) {
        const baseW = this.structuralW[src * 14 + dst]!;
        if (baseW > 0) {
          const pw = this.plasticW14x14[src * 14 + dst]!;
          const rawW = clamp(baseW + pw, 0.01, 1.5);
          const effectiveW = this.substrateQuarantineActive && (src === 4 || dst === 4) ? rawW * 0.1 : rawW;
          const flow = effectiveW * regExcit[src]!;
          this.functionalF[src * 14 + dst] = 0.85 * this.functionalF[src * 14 + dst]! + 0.15 * flow;
          apSum += flow;

          // Surprise-gated Oja dendritic plasticity (frozen when N52 quarantine is active!)
          if (!this.substrateQuarantineActive && surprise > 0.08) {
            const oja = 0.015 * dt * surprise * (regExcit[src]! * regExcit[dst]! - regExcit[dst]! * regExcit[dst]! * pw);
            this.plasticW14x14[src * 14 + dst] = clamp(pw + oja, -0.35, 0.35);
          }
        } else {
          this.functionalF[src * 14 + dst] = this.functionalF[src * 14 + dst]! * 0.85;
        }
      }

      // VIP disinhibition opens apical dendrite against SST Martinotti inhibition; Astrocyte Ca2+ boosts NMDA!
      const sstGate = clamp(1.0 - 0.55 * regPvSst[dst]! + 0.45 * regVip[dst]! + 0.25 * params.ach, 0.2, 1.4);
      const astroGain = 0.85 + 0.35 * this.astroCa14[dst]!;
      const gnwBroadcast = gnwIgnited ? 0.28 * gnwGain * regExcit[2]! : 0.0;

      for (let k = 0; k < 8; k++) {
        const somaticPvInh = k < 6 ? -0.32 * regPvSst[dst]! : 0.0;
        this.basalDrive[dst * 8 + k] = this.basalDrive[dst * 8 + k]! + somaticPvInh + cemiEphapticDrive;
        const het = 0.06 * ((k - 3.5) / 3.5);
        this.apicalDrive[dst * 8 + k] = (apSum + gnwBroadcast) * sstGate * astroGain + het;
      }
    }

    // 5. Step Larkum 2-Compartment NMDA + Hasani Semi-Implicit sLTC in Zig SIMD128!
    const onsetReset = this.substrateQuarantineActive ? 0.65 : 0.04;
    const zig = getZigBridge();
    zig.stepSltcLarkum(
      this.vState,
      this.nmdaSlow,
      this.basalDrive,
      this.apicalDrive,
      dt,
      params.ach,
      params.ne,
      onsetReset,
    );

    const postReg: number[] = new Array(14);
    let lfpPhaseAlign = 0;
    for (let r = 0; r < 14; r++) {
      let s = 0;
      for (let k = 0; k < 8; k++) {
        const signDale = k === 6 ? -0.35 : 1.0;
        s += signDale * Math.tanh(this.vState[r * 8 + k]!);
      }
      postReg[r] = s / 8.0;
      if (Math.sign(postReg[r]!) === Math.sign(meanLfpField || 1)) lfpPhaseAlign += 1;
    }
    const cemiPhaseLock = lfpPhaseAlign / 14.0;

    // 6. Kalman `AST-1R` Predictive Attention Schema over all 14 regional spotlight gains
    let schemaErrSq = 0;
    for (let r = 0; r < 14; r++) {
      const actualGain = Math.abs(postReg[r]!);
      const innov = actualGain - this.attnSchema14[r]!;
      schemaErrSq += innov * innov;
      this.attnSchema14[r] = this.attnSchema14[r]! + 0.34 * innov;
    }
    const attnSchemaError = Math.sqrt(schemaErrSq / 14.0);

    // 7. NON-ORACLE `CalibHead` `HOT-3` Metacognitive Confidence!
    // Computed STRICTLY from internal sensory channel dispersion, cross-channel coherence, and PFC/ACC margin
    // (ZERO readout of external `params.cueNoiseVariance`!).
    let senseMean = 0;
    let senseAbsSum = 0;
    for (let k = 0; k < 8; k++) {
      const v = Number(params.sensory8[k] ?? 0);
      senseMean += v;
      senseAbsSum += Math.abs(v);
    }
    senseMean /= 8.0;
    let internalDispersionVar = 0;
    for (let k = 0; k < 8; k++) {
      const d = Number(params.sensory8[k] ?? 0) - senseMean;
      internalDispersionVar += d * d;
    }
    internalDispersionVar /= 8.0;

    const crossChannelCoherence = senseAbsSum > 1e-5 ? Math.abs(senseMean * 8.0) / senseAbsSum : 0.0;
    const internalPrecisionMargin =
      Math.abs(postReg[2]!) * 0.4 +
      crossChannelCoherence * Math.abs(senseMean) * 1.75 -
      0.95 * Math.sqrt(internalDispersionVar) -
      0.5 * (1.0 - crossChannelCoherence);
    const snrConfidence = sigmoid(internalPrecisionMargin * 3.5);
    const hot3Indicator = makeIndicator(
      snrConfidence,
      'HEURISTIC_INDICATOR',
      'Fleming & Lau (2014) endogenous non-oracle CalibHead second-order confidence readout; NOT phenomenal awareness.',
    );

    // 8. Frazier Knowledge-Gradient Value-of-Information (`VOI`)
    const voi = Math.max(
      0,
      computeKnowledgeGradientVoi(Math.abs(senseMean) * crossChannelCoherence * 0.45, 0.65, params.cueNoiseVariance, 8.0) -
        params.cueCost,
    );

    // 9. Striatal `D1/D2` Go/NoGo Race + Learned `N13` Somatic "Free Won't" Pre-Motor Veto + 4-Mode `PAG`
    const d1Go = postReg[5]! + 0.55 + 0.25 * npy;
    const d2NoGo = 0.25 + this.vetoWeightAv * Math.max(params.somaticHazard, postReg[7]!);
    let vetoTriggered = false;
    if (d1Go > 0.35 && d2NoGo > 0.60) {
      vetoTriggered = true;
      this.freeWontVetoCount += 1;
      // Reinforce `wAv` hyperdirect/indirect veto synapse on close-call somatic alarm
      this.vetoWeightAv = clamp(this.vetoWeightAv + 0.015 * params.somaticHazard, 0.3, 1.5);
      for (let k = 0; k < 8; k++) {
        this.vState[10 * 8 + k] = this.vState[10 * 8 + k]! * 0.15 - 0.35;
      }
      postReg[10] = postReg[10]! * 0.15 - 0.25;
    }

    let pagMode: PagSurvivalMode = 'FORAGE';
    if (crf > 0.72 && vetoTriggered) pagMode = 'FREEZE';
    else if (crf > 0.52) pagMode = 'FLIGHT';
    else if (oxt > 0.48 && npy < 0.45) pagMode = 'SOCIAL_GROOM';

    // 10. `SelfModel` (`SELF+SIM` counterfactual efference agency tracking) & 24-unit Brainstem CPG
    const m1Out = postReg[10]!;
    const selfErr = Math.abs(m1Out - this.selfPredMotor);
    const selfAgencyScore = clamp(1.0 - selfErr, 0, 1);
    this.selfPredMotor = 0.7 * this.selfPredMotor + 0.3 * m1Out;

    const cpgFreqHz = pagMode === 'FREEZE' ? 0.2 : 1.4 + 1.2 * Math.max(0, m1Out);
    this.cpgMasterPhase = (this.cpgMasterPhase + 2.0 * Math.PI * cpgFreqHz * dt) % (2.0 * Math.PI);
    for (let i = 0; i < 24; i++) {
      this.cpgPhases24[i] = (this.cpgMasterPhase + (i / 24.0) * 2.0 * Math.PI) % (2.0 * Math.PI);
    }

    // 11. 6D Frenet-Serret Cognitive Trajectory Curvature $\kappa(t)$ & Torsion $\tau(t)$
    const cur6 = Float64Array.from([postReg[1]!, postReg[2]!, postReg[3]!, postReg[4]!, postReg[7]!, postReg[10]!]);
    this.trajRing6D.shift();
    this.trajRing6D.push(cur6);
    this.trajCount = Math.min(4, this.trajCount + 1);
    const { kappa, tau } = this.computeFrenet6D();

    const flightSign = pagMode === 'FLIGHT' ? -1.0 : pagMode === 'FREEZE' ? 0.05 : 1.0;
    const motor6: [number, number, number, number, number, number] = [
      clamp(flightSign * (0.65 * Number(params.sensory8[0] ?? 0) + 0.35 * Math.sin(this.cpgMasterPhase)), -1, 1),
      clamp(0.35 * Math.cos(this.cpgMasterPhase) * (1.0 - 0.5 * cckGlp1), -1, 1),
      clamp(flightSign * (0.65 * Number(params.sensory8[1] ?? 0) + 0.35 * m1Out), -1, 1),
      clamp(snrConfidence * 2.0 - 1.0, -1, 1),
      clamp(oxt - crf, -1, 1),
      clamp(voi, -1, 1),
    ];

    return {
      regionActivations14: postReg,
      metacognitiveConfidenceHot3: hot3Indicator,
      epistemicValueOfInfo: voi,
      gnwIgnited,
      attentionSchemaError: attnSchemaError,
      attentionResourceAom: this.attentionResourceAom,
      cemiEphapticPhaseLock: cemiPhaseLock,
      pagSurvivalMode: pagMode,
      neuropeptides4: { npy, cckGlp1, crf, oxt },
      selfAgencyScore,
      somaticFreeWontVetoTriggered: vetoTriggered,
      totalFreeWontVetoes: this.freeWontVetoCount,
      substrateAnomalyQuarantined: this.substrateQuarantineActive,
      frenetCurvatureKappa: kappa,
      frenetTorsionTau: tau,
      cpgPhaseRad: this.cpgMasterPhase,
      motorCmd6: motor6,
    };
  }

  private computeFrenet6D(): { kappa: number; tau: number } {
    if (this.trajCount < 4) return { kappa: 0.05, tau: 0.01 };
    const p0 = this.trajRing6D[0]!;
    const p1 = this.trajRing6D[1]!;
    const p2 = this.trajRing6D[2]!;
    const p3 = this.trajRing6D[3]!;

    let vNormSq = 0;
    let aNormSq = 0;
    let vaDot = 0;
    let jNormSq = 0;

    for (let d = 0; d < 6; d++) {
      const v = p2[d]! - p1[d]!;
      const a = p3[d]! - 2.0 * p2[d]! + p1[d]!;
      const j = p3[d]! - 3.0 * p2[d]! + 3.0 * p1[d]! - p0[d]!;
      vNormSq += v * v;
      aNormSq += a * a;
      vaDot += v * a;
      jNormSq += j * j;
    }

    const speed = Math.sqrt(vNormSq);
    if (speed < 1e-5) return { kappa: 0.0, tau: 0.0 };

    const areaSq = Math.max(0, vNormSq * aNormSq - vaDot * vaDot);
    const kappa = Math.min(25.0, Math.sqrt(areaSq) / (vNormSq * speed + 1e-7));
    const tau = Math.min(25.0, Math.sqrt(jNormSq) / (speed + 0.05));
    return { kappa, tau };
  }

  /**
   * Executes a strictly non-destructive Casali Perturbational Complexity Index (`PCI`) TMS Poke Test.
   * Preserves `vState`, `nmdaSlow`, `basalDrive`, `apicalDrive`, and `functionalF` bit-for-bit,
   * and evaluates genuine recurrent thalamocortical perturbation cascades (zero synthetic `Math.sin` wave!)
   * across `'WAKE'`, `'NREM_SLOW_WAVE'`, or `'PROPOFOL_ANESTHESIA'`.
   */
  public runTmsPokeTest(regionIndex = 2, arousalMode: TmsArousalMode = 'WAKE'): TmsPokeReport {
    const regIdx = Math.max(0, Math.min(13, Math.trunc(regionIndex)));
    const savedBasal = this.basalDrive.slice();
    const savedF = this.functionalF.slice();

    // Casali et al. (2013) sham-subtracted twin evolution:
    // Both `Sham` (unperturbed) and `Pert` (focal TMS pulse in `regIdx`) evolve under the exact same
    // neuromodulatory / GABAergic state so global arousal hyperpolarization never masquerades as propagation!
    const vSham = this.vState.slice();
    const nmdaSham = this.nmdaSlow.slice();
    const basalSham = new Float32Array(112);
    const apicalSham = new Float32Array(112);

    const vPert = this.vState.slice();
    const nmdaPert = this.nmdaSlow.slice();
    const basalPert = new Float32Array(112);
    const apicalPert = new Float32Array(112);

    // Focal transcranial magnetic depolarization into excitatory pyramidal cells (k = 0..5) of `regIdx`
    for (let k = 0; k < 6; k++) {
      vPert[regIdx * 8 + k] = vPert[regIdx * 8 + k]! + 2.85 + 0.15 * (k - 2.5);
    }
    vPert[regIdx * 8 + 6] = vPert[regIdx * 8 + 6]! + 0.45;
    vPert[regIdx * 8 + 7] = vPert[regIdx * 8 + 7]! + 0.45;

    const steps = 24;
    const raster = new Uint8Array(14 * steps);
    const zig = getZigBridge();

    const ach = arousalMode === 'WAKE' ? 0.72 : arousalMode === 'NREM_SLOW_WAVE' ? 0.12 : 0.03;
    const ne = arousalMode === 'WAKE' ? 0.52 : arousalMode === 'NREM_SLOW_WAVE' ? 0.08 : 0.02;
    const apicalGain = arousalMode === 'WAKE' ? 2.45 : arousalMode === 'NREM_SLOW_WAVE' ? 0.55 : 0.03;
    const gabaHyperpol = arousalMode === 'PROPOFOL_ANESTHESIA' ? -1.55 : arousalMode === 'NREM_SLOW_WAVE' ? -0.60 : 0.0;
    const onsetReset = arousalMode === 'PROPOFOL_ANESTHESIA' ? 0.48 : arousalMode === 'NREM_SLOW_WAVE' ? 0.34 : 0.02;

    const evalPopulations = (v: Float32Array, excOut: Float32Array, inhOut: Float32Array): void => {
      for (let r = 0; r < 14; r++) {
        let excSum = 0;
        for (let k = 0; k < 6; k++) excSum += sigmoid(v[r * 8 + k]!);
        excOut[r] = excSum / 6.0;
        inhOut[r] = 0.5 * (sigmoid(v[r * 8 + 6]!) + sigmoid(v[r * 8 + 7]!));
      }
    };

    const stepBranch = (
      v: Float32Array,
      nmda: Float32Array,
      basal: Float32Array,
      apical: Float32Array,
      exc: Float32Array,
      inh: Float32Array,
    ): void => {
      for (let dst = 0; dst < 14; dst++) {
        let ap = 0;
        for (let src = 0; src < 14; src++) {
          if (src === dst) continue;
          const w = this.structuralW[src * 14 + dst]! + this.plasticW14x14[src * 14 + dst]!;
          if (w > 0) {
            const signEdge = (src * 5 + dst) % 4 === 0 ? -0.9 : 1.35;
            ap += w * signEdge * (exc[src]! - 0.5);
          }
        }
        for (let k = 0; k < 6; k++) {
          basal[dst * 8 + k] =
            savedBasal[dst * 8 + k]! * 0.25 +
            gabaHyperpol -
            1.85 * (inh[dst]! - 0.5) +
            0.45 * ap * apicalGain * (k % 3 === 0 ? 1.2 : 0.8);
          apical[dst * 8 + k] = apicalGain * ap * (1.0 + 0.12 * (k - 2.5));
        }
        for (let k = 6; k < 8; k++) {
          basal[dst * 8 + k] = gabaHyperpol * 0.3 + 2.6 * (exc[dst]! - 0.5);
          apical[dst * 8 + k] = 0.35 * apicalGain * ap;
        }
      }
      zig.stepSltcLarkum(v, nmda, basal, apical, 0.085, ach, ne, onsetReset);
    };

    const excSham = new Float32Array(14);
    const inhSham = new Float32Array(14);
    const excPert = new Float32Array(14);
    const inhPert = new Float32Array(14);

    for (let t = 0; t < steps; t++) {
      evalPopulations(vSham, excSham, inhSham);
      evalPopulations(vPert, excPert, inhPert);

      for (let r = 0; r < 14; r++) {
        const lfpSham = excSham[r]! - 0.35 * inhSham[r]!;
        const lfpPert = excPert[r]! - 0.35 * inhPert[r]!;
        const diff = lfpPert - lfpSham;
        const thresh = 0.022 + 0.005 * ((r * 3) % 5);
        raster[t * 14 + r] = Math.abs(diff) > thresh ? 1 : 0;
      }

      stepBranch(vSham, nmdaSham, basalSham, apicalSham, excSham, inhSham);
      stepBranch(vPert, nmdaPert, basalPert, apicalPert, excPert, inhPert);
    }

    const lz = computeLempelZiv76Complexity(raster);

    let sumW = 0;
    let sumF = 0;
    const n2 = 196;
    for (let i = 0; i < n2; i++) {
      sumW += this.structuralW[i]!;
      sumF += savedF[i]!;
    }
    const meanW = sumW / n2;
    const meanF = sumF / n2;
    let cov = 0;
    let varW = 0;
    let varF = 0;
    for (let i = 0; i < n2; i++) {
      const dw = this.structuralW[i]! - meanW;
      const df = savedF[i]! - meanF;
      cov += dw * df;
      varW += dw * dw;
      varF += df * df;
    }
    const corr = varW > 1e-9 && varF > 1e-9 ? cov / Math.sqrt(varW * varF) : 0;

    // `vSham`/`vPert` evolved in isolated twin buffers; `this.vState`, `this.nmdaSlow`, `this.basalDrive`,
    // `this.apicalDrive`, and `this.functionalF` remain 100% bit-exact untouched!
    this.functionalF.set(savedF);

    return {
      perturbedRegion: ASMODENIUS_14_REGIONS[regIdx]!,
      arousalMode,
      pciIndicator: makeIndicator(
        lz.normalizedPci,
        'HEURISTIC_INDICATOR',
        'Casali et al. (2013) Lempel-Ziv spatiotemporal perturbation complexity proxy; NOT a claim of phenomenal consciousness.',
      ),
      lempelZivDictionarySize: lz.rawCount,
      functionalVsStructuralCorrelation: corr,
      functionalFlowMatrix14x14: Array.from(this.functionalF),
      structuralConnectome14x14: Array.from(this.structuralW),
    };
  }
}

export {
  type CausalBenchmarkName,
  type R21BenchmarkResult,
  runAsmodeniusR21BenchmarkSuite,
  runComprehensive12CausalSuite,
} from './causal-benchmarks';
