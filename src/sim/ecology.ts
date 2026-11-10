/**
 * CQM2 Biosphere Ecology, Big Tree Crystal Sanctuary, Diploid Speciation,
 * Entangled `Xenomimics`, `AURUM/UMBRA` Tâtonnement Economy & 5 Cosmological Singularities.
 * Synthesizes `cqm-dome-fable`, `cqm-b44b`, and `Black Hole Simulation Lab` into pure SoA mechanics.
 */
import { DeterministicRng, hashString64 } from '../core/prng';
import {
  ErpRelationalStore,
  METABOLIC_POOL_COUNT,
  ORGANISM_WEIGHT_STRIDE,
} from '../erp/relational-store';
import { ingestConservedMealKj, P_ADIPOSE, P_LIV_GLY } from '../brains/metabolism';
import { CASTE_ROLES } from '../brains/pantheon';
import { synthesizeTaxonomicIdentity } from '../quantum/xenolinguistics';

export type SingularityKind = 'blackhole' | 'whitehole' | 'greyhole' | 'strangestar' | 'entropy';

export interface CosmologicalSingularity {
  id: number;
  kind: SingularityKind;
  pos: [number, number, number];
  massSolarProxy: number;
  spinA: number;
  influenceRadius: number;
}

export interface EdiblePodNode {
  podId: number;
  x: number;
  y: number;
  z: number;
  energyKj: number;
  available: boolean;
  respawnAtTimeSec: number;
}

export interface EcologyStepReport {
  sanctuaryOccupants: number;
  podsHarvestedThisTick: number;
  availablePodsCount: number;
  diploidBirthsThisTick: number;
  totalSpeciationEvents: number;
  bdmIncompatibilities: number;
  xenomimicActivePairs: number;
  xenomimicBellCorrelationS: number;
  aurumPerUmbraPrice: number;
  wealthGiniCoefficient: number;
}

export interface EcologyStateSnapshot {
  pods: EdiblePodNode[];
  heapPodIds: number[];
  aurumPerUmbraPrice: number;
  totalSpeciationEvents: number;
  bdmIncompatibilities: number;
  nextSpeciesId: number;
  reproductionCooldownTick: number;
}

export const BIG_TREE_SANCTUARY = Object.freeze({
  centerX: 0.0,
  centerY: 0.0,
  centerZ: 0.0,
  peaceRadius: 14.0,
  canopyHeight: 22.0,
});

export const COSMOLOGICAL_SINGULARITIES_5: readonly CosmologicalSingularity[] = Object.freeze([
  { id: 1, kind: 'blackhole', pos: [28, 3.5, 28], massSolarProxy: 12.0, spinA: 0.88, influenceRadius: 18.0 },
  { id: 2, kind: 'whitehole', pos: [-28, 5.0, -28], massSolarProxy: 9.5, spinA: 0.62, influenceRadius: 16.0 },
  { id: 3, kind: 'greyhole', pos: [28, 4.0, -26], massSolarProxy: 8.0, spinA: 0.74, influenceRadius: 15.0 },
  { id: 4, kind: 'strangestar', pos: [-26, 4.2, 28], massSolarProxy: 6.5, spinA: 0.45, influenceRadius: 14.0 },
  { id: 5, kind: 'entropy', pos: [0, 11.0, -38], massSolarProxy: 7.0, spinA: 0.31, influenceRadius: 15.0 },
]);

/**
 * Exact Lorenz-curve Gini inequality index $G \in [0, 1]$ over non-negative wealth values.
 */
export function computeLorenzGini(wealthValues: ArrayLike<number>): number {
  const n = wealthValues.length;
  if (n <= 1) return 0.0;
  const sorted = new Float64Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Number(wealthValues[i] ?? 0));
    sorted[i] = v;
    total += v;
  }
  if (total <= 1e-9) return 0.0;
  sorted.sort();

  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (2 * (i + 1) - n - 1) * sorted[i]!;
  }
  return Math.max(0.0, Math.min(1.0, weightedSum / (n * total)));
}

function recomputeExactIntakeFromPools(store: ErpRelationalStore, entityId: number): void {
  const base = entityId * METABOLIC_POOL_COUNT;
  let sum = 0;
  let c = 0;
  for (let k = 0; k < METABOLIC_POOL_COUNT; k++) {
    const y = store.pools15[base + k]! - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  store.totalIntakeKj[entityId] = sum;
}

export class BiosphereEcologyEngine {
  public readonly pods: EdiblePodNode[] = [];
  private readonly heapPodIds: number[] = []; // Binary min-heap ordered by `pods[id].respawnAtTimeSec`

  public aurumPerUmbraPrice = 1.45;
  public totalSpeciationEvents = 0;
  public bdmIncompatibilities = 0;
  private nextSpeciesId = 6;
  private reproductionCooldownTick = 0;

  public constructor(podCount = 128, rng: DeterministicRng) {
    const count = Math.max(16, Math.min(2048, podCount));
    for (let i = 0; i < count; i++) {
      // Golden-angle phyllotaxis around the Big Tree Sanctuary + outer biomes
      const r = i < count * 0.35 ? rng.nextRange(3.0, 13.5) : rng.nextRange(14.5, 56.0);
      const theta = i * 2.399963229728653 + rng.nextRange(-0.15, 0.15);
      this.pods.push({
        podId: i,
        x: Math.cos(theta) * r,
        y: i < count * 0.35 ? rng.nextRange(1.0, 7.5) : rng.nextRange(0.8, 4.8),
        z: Math.sin(theta) * r,
        energyKj: rng.nextRange(2.4, 5.2),
        available: true,
        respawnAtTimeSec: 0,
      });
    }
  }

  public snapshotState(): EcologyStateSnapshot {
    return {
      pods: this.pods.map((p) => ({ ...p })),
      heapPodIds: this.heapPodIds.slice(),
      aurumPerUmbraPrice: this.aurumPerUmbraPrice,
      totalSpeciationEvents: this.totalSpeciationEvents,
      bdmIncompatibilities: this.bdmIncompatibilities,
      nextSpeciesId: this.nextSpeciesId,
      reproductionCooldownTick: this.reproductionCooldownTick,
    };
  }

  public restoreState(snap: EcologyStateSnapshot): void {
    this.pods.length = 0;
    for (const p of snap.pods) this.pods.push({ ...p });
    this.heapPodIds.length = 0;
    for (const id of snap.heapPodIds) this.heapPodIds.push(id);
    this.aurumPerUmbraPrice = snap.aurumPerUmbraPrice;
    this.totalSpeciationEvents = snap.totalSpeciationEvents;
    this.bdmIncompatibilities = snap.bdmIncompatibilities;
    this.nextSpeciesId = snap.nextSpeciesId;
    this.reproductionCooldownTick = snap.reproductionCooldownTick;
  }

  private pushRespawnHeap(podId: number): void {
    this.heapPodIds.push(podId);
    let idx = this.heapPodIds.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.pods[this.heapPodIds[parent]!]!.respawnAtTimeSec <= this.pods[this.heapPodIds[idx]!]!.respawnAtTimeSec) {
        break;
      }
      const tmp = this.heapPodIds[parent]!;
      this.heapPodIds[parent] = this.heapPodIds[idx]!;
      this.heapPodIds[idx] = tmp;
      idx = parent;
    }
  }

  private popExpiredRespawns(simTimeSec: number): void {
    while (this.heapPodIds.length > 0) {
      const topId = this.heapPodIds[0]!;
      if (this.pods[topId]!.respawnAtTimeSec > simTimeSec) break;

      const last = this.heapPodIds.pop()!;
      if (this.heapPodIds.length > 0) {
        this.heapPodIds[0] = last;
        let idx = 0;
        const len = this.heapPodIds.length;
        while (true) {
          const left = idx * 2 + 1;
          const right = left + 1;
          let smallest = idx;
          if (left < len && this.pods[this.heapPodIds[left]!]!.respawnAtTimeSec < this.pods[this.heapPodIds[smallest]!]!.respawnAtTimeSec) {
            smallest = left;
          }
          if (right < len && this.pods[this.heapPodIds[right]!]!.respawnAtTimeSec < this.pods[this.heapPodIds[smallest]!]!.respawnAtTimeSec) {
            smallest = right;
          }
          if (smallest === idx) break;
          const tmp = this.heapPodIds[idx]!;
          this.heapPodIds[idx] = this.heapPodIds[smallest]!;
          this.heapPodIds[smallest] = tmp;
          idx = smallest;
        }
      }
      this.pods[topId]!.available = true;
    }
  }

  /**
   * Pairs initial entangled `Xenomimics` (`morphotypeId = 7`) across distinct biomes.
   */
  public seedXenomimicEntangledPairs(store: ErpRelationalStore, maxPairs = 6): number {
    let pairs = 0;
    const candidates: number[] = [];
    for (let e = 4; e < store.activeCount; e++) {
      if (store.alive[e] === 1 && store.entangledPartnerId[e] === -1) {
        candidates.push(e);
      }
    }
    for (let i = 0; i + 1 < candidates.length && pairs < maxPairs; i += 2) {
      const a = candidates[i]!;
      const b = candidates[i + 1]!;
      store.entangledPartnerId[a] = b;
      store.entangledPartnerId[b] = a;
      store.morphotypeId[a] = 7;
      store.morphotypeId[b] = 7;
      pairs++;
    }
    return pairs;
  }

  public stepBiosphere(params: {
    store: ErpRelationalStore;
    ecoRng: DeterministicRng;
    genRng: DeterministicRng;
    kerrSpinA: number;
    quantumCoupling: number;
    plasticityScale: number;
    dtSec: number;
  }): EcologyStepReport {
    const { store, ecoRng, genRng, dtSec } = params;
    const simTime = store.epoch.simTimeSec;

    // 1. Respawn matured Big Tree / Biome crystal pods from binary min-heap (`5.0s` lease)
    this.popExpiredRespawns(simTime);

    let sanctuaryOccupants = 0;
    let podsHarvested = 0;
    let excessAurumDemand = 0;
    let excessUmbraDemand = 0;
    const aliveList: number[] = [];

    // 2. Sanctuary Peace Law, 5 Cosmological Singularities, Pod Harvesting & AURUM/UMBRA Minting
    for (let e = 0; e < store.activeCount; e++) {
      if (store.alive[e] !== 1) continue;
      aliveList.push(e);
      const px = store.posX[e]!;
      const py = store.posY[e]!;
      const pz = store.posZ[e]!;

      // Big Tree Crystal Sanctuary (`r <= 14.0`): Peace Law calms cortisol & replenishes crystal dew hydration
      const rTree = Math.hypot(px - BIG_TREE_SANCTUARY.centerX, pz - BIG_TREE_SANCTUARY.centerZ);
      if (rTree <= BIG_TREE_SANCTUARY.peaceRadius) {
        sanctuaryOccupants++;
        store.cortisol[e] = Math.max(0.04, store.cortisol[e]! - 0.14 * dtSec);
        store.hydration[e] = Math.min(1.0, store.hydration[e]! + 0.18 * dtSec);
        store.serotonin[e] = Math.min(1.0, store.serotonin[e]! + 0.08 * dtSec);
      }

      // 5 Cosmological Singularities (`blackhole`, `whitehole`, `greyhole`, `strangestar`, `entropy`)
      for (const sing of COSMOLOGICAL_SINGULARITIES_5) {
        const dx = sing.pos[0] - px;
        const dy = sing.pos[1] - py;
        const dz = sing.pos[2] - pz;
        const d = Math.hypot(dx, dy, dz) + 1.5;
        if (d < sing.influenceRadius) {
          const invR2 = sing.massSolarProxy / (d * d + 4.0);
          if (sing.kind === 'blackhole') {
            // Attractive gravity + Kerr Lense-Thirring azimuthal frame-dragging (-dz, +dx)!
            const frameDrag = 0.85 * params.kerrSpinA * invR2;
            store.velX[e] = store.velX[e]! + (0.45 * invR2 * (dx / d) - frameDrag * (dz / d)) * dtSec;
            store.velZ[e] = store.velZ[e]! + (0.45 * invR2 * (dz / d) + frameDrag * (dx / d)) * dtSec;
            store.umbraWealth[e] = store.umbraWealth[e]! + 0.12 * dtSec;
          } else if (sing.kind === 'whitehole') {
            store.velX[e] = store.velX[e]! - 0.55 * invR2 * (dx / d) * dtSec;
            store.velZ[e] = store.velZ[e]! - 0.55 * invR2 * (dz / d) * dtSec;
            store.aurumWealth[e] = store.aurumWealth[e]! + 0.14 * dtSec;
          } else if (sing.kind === 'greyhole') {
            const gate = Math.sin(simTime * 1.4);
            store.velX[e] = store.velX[e]! + 0.35 * gate * invR2 * (dx / d) * dtSec;
            store.velZ[e] = store.velZ[e]! + 0.35 * gate * invR2 * (dz / d) * dtSec;
          } else if (sing.kind === 'strangestar') {
            // Magnetic Larmor cross-product deflection v x B_z
            const vx = store.velX[e]!;
            const vz = store.velZ[e]!;
            store.velX[e] = vx + 0.4 * invR2 * vz * dtSec;
            store.velZ[e] = vz - 0.4 * invR2 * vx * dtSec;
          } else {
            // Entropy sink elevates existential stress -> triggers Thaler Gedanken-Death creativity!
            store.cortisol[e] = Math.min(1.0, store.cortisol[e]! + 0.16 * dtSec);
            store.umbraWealth[e] = store.umbraWealth[e]! + 0.18 * dtSec;
          }
        }
      }

      // Edible Pod Harvesting (checks 4 stride-hashed pods per tick -> O(1) per organism!)
      if (store.ghrelin[e]! > 0.22) {
        const startPod = (e * 7 + store.epoch.simTick) % this.pods.length;
        for (let k = 0; k < 4; k++) {
          const pod = this.pods[(startPod + k * 13) % this.pods.length]!;
          if (!pod.available) continue;
          const distSq = (pod.x - px) * (pod.x - px) + (pod.z - pz) * (pod.z - pz);
          if (distSq <= 28.0) {
            const res = ingestConservedMealKj(store, e, pod.energyKj);
            if (res.ingestedKj > 0.05) {
              pod.available = false;
              pod.respawnAtTimeSec = simTime + 5.0; // Exact 5.0s dome-fable respawn lease!
              this.pushRespawnHeap(pod.podId);
              podsHarvested++;
              store.aurumWealth[e] = store.aurumWealth[e]! + 0.35 * res.ingestedKj;
              break;
            }
          }
        }
      }

      // AURUM / UMBRA Walrasian portfolio rebalancing
      const atp = store.pools15[e * METABOLIC_POOL_COUNT + 12]!;
      const riskAversion = store.cortisol[e]!;
      if (riskAversion > 0.45 && store.aurumWealth[e]! > 1.0) {
        const tradeAurum = 0.15 * store.aurumWealth[e]! * dtSec;
        store.aurumWealth[e] = store.aurumWealth[e]! - tradeAurum;
        store.umbraWealth[e] = store.umbraWealth[e]! + tradeAurum / Math.max(0.2, this.aurumPerUmbraPrice);
        excessUmbraDemand += tradeAurum;
      } else if (atp > 6.5 && store.umbraWealth[e]! > 0.5) {
        const tradeUmbra = 0.12 * store.umbraWealth[e]! * dtSec;
        store.umbraWealth[e] = store.umbraWealth[e]! - tradeUmbra;
        store.aurumWealth[e] = store.aurumWealth[e]! + tradeUmbra * this.aurumPerUmbraPrice;
        excessAurumDemand += tradeUmbra;
      }
    }

    // Walrasian Tâtonnement price adjustment
    const netExcess = (excessAurumDemand - excessUmbraDemand) / Math.max(1, aliveList.length);
    this.aurumPerUmbraPrice = Math.max(0.25, Math.min(8.0, this.aurumPerUmbraPrice * Math.exp(0.18 * netExcess)));

    // 3. Entangled `Xenomimics` Non-Local EPR Synchronization (`Bell-CHSH` S witness)
    let xenoPairs = 0;
    let bellCosSum = 0;
    for (const a of aliveList) {
      const b = store.entangledPartnerId[a]!;
      if (b > a && b < store.activeCount && store.alive[b] === 1) {
        xenoPairs++;
        const coup = 0.25 * params.quantumCoupling;
        const meanDa = 0.5 * (store.modulators2[a * 2]! + store.modulators2[b * 2]!);
        store.modulators2[a * 2] = (1.0 - coup) * store.modulators2[a * 2]! + coup * meanDa;
        store.modulators2[b * 2] = (1.0 - coup) * store.modulators2[b * 2]! + coup * meanDa;
        const dTheta = store.headingRad[a]! - store.headingRad[b]!;
        bellCosSum += Math.abs(Math.cos(dTheta));
        // Phase-conjugate steering synchronization
        store.headingRad[b] = store.headingRad[b]! + 0.08 * coup * Math.sin(dTheta);
      }
    }
    const bellS = xenoPairs > 0 ? 2.0 + 0.8284 * params.quantumCoupling * (bellCosSum / xenoPairs) : 2.0;

    // 4. Diploid Sexual Crossover, Mutation & Bateson-Dobzhansky-Muller (`BDM`) Speciation
    //    Maintains 100% First-Law thermodynamic conservation across parents & child!
    let births = 0;
    if (
      store.epoch.simTick >= this.reproductionCooldownTick &&
      aliveList.length >= 2 &&
      aliveList.length < Math.min(store.maxEntities - 4, 220)
    ) {
      // Find two mature, energy-replete parents in nearby proximity
      for (let idx = 0; idx + 1 < aliveList.length; idx++) {
        const pA = aliveList[idx]!;
        const pB = aliveList[idx + 1]!;
        if (store.ageSec[pA]! < 1.5 || store.ageSec[pB]! < 1.5) continue;
        const baseA = pA * METABOLIC_POOL_COUNT;
        const baseB = pB * METABOLIC_POOL_COUNT;
        if (store.pools15[baseA + P_ADIPOSE]! < 65.0 || store.pools15[baseB + P_ADIPOSE]! < 65.0) continue;
        if (store.pools15[baseA + P_LIV_GLY]! < 20.0 || store.pools15[baseB + P_LIV_GLY]! < 20.0) continue;

        const distParents = Math.hypot(store.posX[pA]! - store.posX[pB]!, store.posZ[pA]! - store.posZ[pB]!);
        if (distParents > 36.0) continue;

        // Compute genetic divergence d_G across 126 cortical weights
        let diffSq = 0;
        const wOffA = pA * ORGANISM_WEIGHT_STRIDE;
        const wOffB = pB * ORGANISM_WEIGHT_STRIDE;
        for (let w = 0; w < ORGANISM_WEIGHT_STRIDE; w++) {
          const d = store.weights126[wOffA + w]! - store.weights126[wOffB + w]!;
          diffSq += d * d;
        }
        const geneticDist = Math.sqrt(diffSq / ORGANISM_WEIGHT_STRIDE);

        // Bateson-Dobzhansky-Muller post-zygotic incompatibility barrier at extreme divergence
        if (geneticDist > 1.15) {
          this.bdmIncompatibilities += 1;
          this.reproductionCooldownTick = store.epoch.simTick + 12;
          break;
        }

        // Diploid 2-point crossover + Gaussian mutation
        const childWeights = new Float32Array(ORGANISM_WEIGHT_STRIDE);
        const cut1 = genRng.nextInt(12, 56);
        const cut2 = genRng.nextInt(64, 114);
        const mutStd = 0.045 * Math.max(0.2, params.plasticityScale);
        for (let w = 0; w < ORGANISM_WEIGHT_STRIDE; w++) {
          const inherited = w >= cut1 && w < cut2 ? store.weights126[wOffB + w]! : store.weights126[wOffA + w]!;
          childWeights[w] = Math.max(-2.5, Math.min(2.5, inherited + genRng.nextGaussian(0, mutStd)));
        }

        // Cladogenesis / Speciation when cross-lineage or accumulated divergence crosses speciation threshold!
        let childSpeciesId = store.speciesFk[pA]!;
        if ((geneticDist > 0.42 || store.speciesFk[pA] !== store.speciesFk[pB]) && store.species.size < 32) {
          const newSpId = this.nextSpeciesId++;
          const caste = CASTE_ROLES[newSpId % CASTE_ROLES.length]!;
          const tax = synthesizeTaxonomicIdentity(BigInt(store.epoch.simTick + newSpId * 97), newSpId, caste);
          store.registerSpecies({
            speciesId: newSpId,
            parentSpeciesId: store.speciesFk[pA]!,
            originTick: store.epoch.simTick,
            casteRole: caste,
            latinBinomial: tax.latinBinomial,
            commonGlyph: tax.commonGlyph,
            genomeHashHex: '0x' + hashString64(`${tax.latinBinomial}::${newSpId}`).toString(16).padStart(16, '0'),
            baseHueDeg: tax.baseHueDeg,
            extantCount: 0,
            meanFitness: 1.0,
          });
          childSpeciesId = newSpId;
          this.totalSpeciationEvents += 1;
        }

        // Conserved Maternal/Paternal Energy Endowment (`32 kJ` from Parent A + `32 kJ` from Parent B = `64 kJ` newborn!)
        store.pools15[baseA + P_ADIPOSE] = store.pools15[baseA + P_ADIPOSE]! - 24.0;
        store.pools15[baseA + P_LIV_GLY] = store.pools15[baseA + P_LIV_GLY]! - 8.0;
        recomputeExactIntakeFromPools(store, pA);

        store.pools15[baseB + P_ADIPOSE] = store.pools15[baseB + P_ADIPOSE]! - 24.0;
        store.pools15[baseB + P_LIV_GLY] = store.pools15[baseB + P_LIV_GLY]! - 8.0;
        recomputeExactIntakeFromPools(store, pB);

        const childPools15 = [
          2.0, 1.5, 1.5, // gut (5 kJ)
          4.0, 1.5, 1.0, 0.2, 0.1, // blood (6.8 kJ)
          12.0, 14.0, 16.0, 5.2, // glycogen + adipose + biomass (47.2 kJ)
          5.0, 0.0, 0.0, // ATP (5 kJ) => exact total = 64.0 kJ!
        ];

        const childGen = Math.max(store.generation[pA]!, store.generation[pB]!) + 1;
        const childFlaw = ecoRng.nextFloat() < 0.06 ? (1 << ecoRng.nextInt(0, 4)) : 0;
        store.spawnOrganism({
          speciesId: childSpeciesId,
          biomeId: store.biomeFk[pA]!,
          generation: childGen,
          flawMask: childFlaw,
          pos: [
            0.5 * (store.posX[pA]! + store.posX[pB]!),
            Math.max(1.0, 0.5 * (store.posY[pA]! + store.posY[pB]!)),
            0.5 * (store.posZ[pA]! + store.posZ[pB]!),
          ],
          headingRad: ecoRng.nextRange(0, 2.0 * Math.PI),
          initialPools15: childPools15,
          initialWeights126: childWeights,
        });
        births += 1;
        this.reproductionCooldownTick = store.epoch.simTick + 18;
        break;
      }
    }

    let availPods = 0;
    for (const p of this.pods) if (p.available) availPods++;

    const wealthSlice = new Float64Array(aliveList.length);
    for (let i = 0; i < aliveList.length; i++) {
      const id = aliveList[i]!;
      wealthSlice[i] = store.aurumWealth[id]! + this.aurumPerUmbraPrice * store.umbraWealth[id]!;
    }
    const gini = computeLorenzGini(wealthSlice);

    return {
      sanctuaryOccupants,
      podsHarvestedThisTick: podsHarvested,
      availablePodsCount: availPods,
      diploidBirthsThisTick: births,
      totalSpeciationEvents: this.totalSpeciationEvents,
      bdmIncompatibilities: this.bdmIncompatibilities,
      xenomimicActivePairs: xenoPairs,
      xenomimicBellCorrelationS: bellS,
      aurumPerUmbraPrice: this.aurumPerUmbraPrice,
      wealthGiniCoefficient: gini,
    };
  }
}
