/**
 * CQM2 Entity Relational Programming (`ERP`) Engine & Reversible SoA Ring-Buffer Store.
 * Replaces CQM1's heap-allocated object soup with 10 normalized, 3NF-aligned Structure-of-Arrays
 * (`SoA`) tables backed by `SharedArrayBuffer` (with transparent `ArrayBuffer` fallback).
 *
 * Normalized Entity Model (10 Core Entities):
 *   1. `WorldEpoch`              (PK: epochId)
 *   2. `BiomeZone`               (PK: biomeId, FK: epochId -> WorldEpoch)
 *   3. `SpeciesLineage`          (PK: speciesId, Self-FK: parentSpeciesId -> SpeciesLineage)
 *   4. `Organism`                (PK: entityId, FK: speciesId -> SpeciesLineage, FK: biomeId -> BiomeZone)
 *   5. `MetabolicLedger`         (PK/FK 1:1: entityId -> Organism; 15 conserved kJ pools)
 *   6. `NeuralCortexState`       (PK/FK 1:1: entityId -> Organism; 126 SIMD weights + modulators + PCI)
 *   7. `QuantumSubstrate`        (PK: substrateId, Nullable FK: entityId -> Organism)
 *   8. `SocialBond`              (PK: bondId, FK: sourceEntityId, targetEntityId -> Organism)
 *   9. `CausalExperiment`        (PK: experimentId, FK: epochId -> WorldEpoch)
 *  10. `HardwareDispatchReceipt` (PK: receiptId, FK: epochId -> WorldEpoch)
 */

export type CasteRole = 'EXPLORER' | 'HARVESTER' | 'GUARDIAN' | 'ARCHITECT' | 'ORACLE';
export type BiomeKind = 'HYDROTHERMAL_ABYSS' | 'PELAGIC_PHOTON_SHELF' | 'CRYSTAL_REEF' | 'SINGULARITY_RIM';

export const METABOLIC_POOL_NAMES = [
  'gutGlucoseKj',
  'gutAminoKj',
  'gutLipidKj',
  'bloodGlucoseKj',
  'bloodAminoKj',
  'bloodFreeFattyKj',
  'bloodKetoneKj',
  'lactateKj',
  'liverGlycogenKj',
  'muscleGlycogenKj',
  'adiposeTriglycerideKj',
  'structuralBiomassKj',
  'cellularAtpBufferKj',
  'dissipatedHeatWorkKj',
  'excretedDetritusKj',
] as const;

export const METABOLIC_POOL_COUNT = 15;
export const ORGANISM_WEIGHT_STRIDE = 126; // (8*8 + 8) + (6*8 + 6)
export const ORGANISM_SENSE_STRIDE = 8;
export const ORGANISM_MOTOR_STRIDE = 6;

export interface WorldEpochRecord {
  epochId: number;
  seedHex: string;
  simTick: number;
  simTimeSec: number;
  merkleRootHex: string;
  freeEnergyReserveKj: number;
}

export interface BiomeZoneRecord {
  biomeId: number;
  epochId: number;
  name: string;
  kind: BiomeKind;
  centerX: number;
  centerZ: number;
  radius: number;
  nutrientPoolKj: number;
  detritusPoolKj: number;
  o2Saturation: number;
  osmolarityMOsM: number;
  temperatureK: number;
}

export interface SpeciesLineageRecord {
  speciesId: number;
  parentSpeciesId: number | null;
  originTick: number;
  casteRole: CasteRole;
  latinBinomial: string;
  commonGlyph: string;
  genomeHashHex: string;
  baseHueDeg: number;
  extantCount: number;
  meanFitness: number;
}

export interface SocialBondRecord {
  bondId: number;
  sourceEntityId: number;
  targetEntityId: number;
  trustWeight: number;
  kinshipCoeff: number;
  lastSignalTick: number;
  glossodromCodewordHex: string;
  syndromeClean: boolean;
}

export interface CausalExperimentRecord {
  experimentId: number;
  epochId: number;
  benchmarkName: string;
  intactMean: number;
  lesionMean: number;
  cohensD: number;
  welchsT: number;
  passedGradeA: boolean;
  recordedAtTick: number;
}

export interface HardwareDispatchReceiptRecord {
  receiptId: number;
  epochId: number;
  simTick: number;
  deviceKind: 'GPU_CUDA' | 'GPU_WEBGPU' | 'NPU_OPENVINO' | 'IGPU_DML' | 'CPU_ZIG_SIMD' | 'CPU_ASM_AVX2' | 'RUST_LEDGER';
  kernelName: string;
  batchSize: number;
  elapsedMs: number;
  gflops: number;
  conservationValid: boolean;
}

export interface JoinedOrganismView {
  entityId: number;
  speciesId: number;
  latinBinomial: string;
  casteRole: CasteRole;
  biomeId: number;
  biomeName: string;
  ageSec: number;
  generation: number;
  pos: [number, number, number];
  vel: [number, number, number];
  massKg: number;
  telomereIntegrity: number;
  flawMask: number;
  totalMetabolicKj: number;
  atpBufferKj: number;
  hydration: number;
  dopamineRpe: number;
  pciProxy: number;
  thoughtCurvatureKappa: number;
}

export interface ReversibleWorldSnapshot {
  tick: number;
  simTimeSec: number;
  freeEnergyReserveKj: number;
  activeCount: number;
  alive: Uint8Array;
  speciesId: Uint16Array;
  biomeId: Uint8Array;
  ageSec: Float32Array;
  posX: Float32Array;
  posY: Float32Array;
  posZ: Float32Array;
  velX: Float32Array;
  velY: Float32Array;
  velZ: Float32Array;
  pools15: Float64Array;
  totalIntakeKj: Float64Array;
  hydration: Float32Array;
  weights126: Float32Array;
  biomeNutrients: Float64Array;
  biomeDetritus: Float64Array;
}

function createBuffer(byteLength: number): ArrayBuffer | SharedArrayBuffer {
  const aligned = Math.max(16, (byteLength + 7) & ~7);
  if (typeof SharedArrayBuffer !== 'undefined') {
    try {
      return new SharedArrayBuffer(aligned);
    } catch {
      return new ArrayBuffer(aligned);
    }
  }
  return new ArrayBuffer(aligned);
}

/**
 * Normalized Structure-of-Arrays (`SoA`) Entity Relational Store with Foreign-Key Integrity
 * and `NOVEL-100 N01` Ring-Buffer Time-Travel Rollback.
 */
export class ErpRelationalStore {
  public readonly maxEntities: number;
  public readonly sharedMemoryActive: boolean;

  // 1. WorldEpoch
  public epoch: WorldEpochRecord;

  // 2. BiomeZone (normalized map with FK -> epochId)
  public readonly biomes = new Map<number, BiomeZoneRecord>();

  // 3. SpeciesLineage (normalized map with self-FK -> parentSpeciesId)
  public readonly species = new Map<number, SpeciesLineageRecord>();

  // 4. Organism SoA Columns (`[0 .. maxEntities - 1]`)
  public activeCount = 0;
  public readonly alive: Uint8Array;
  public readonly speciesFk: Uint16Array;
  public readonly biomeFk: Uint8Array;
  public readonly generation: Uint16Array;
  public readonly flawMask: Uint8Array; // bit0=scramble, bit1=leaky, bit2=backwards, bit3=misfire
  public readonly ageSec: Float32Array;
  public readonly posX: Float32Array;
  public readonly posY: Float32Array;
  public readonly posZ: Float32Array;
  public readonly velX: Float32Array;
  public readonly velY: Float32Array;
  public readonly velZ: Float32Array;
  public readonly headingRad: Float32Array;
  public readonly massKg: Float32Array;
  public readonly telomereIntegrity: Float32Array;

  // 5. MetabolicLedger 1:1 SoA Columns
  public readonly pools15: Float64Array; // [maxEntities * 15]
  public readonly totalIntakeKj: Float64Array; // [maxEntities]
  public readonly o2Reserve: Float32Array;
  public readonly hydration: Float32Array;
  public readonly insulin: Float32Array;
  public readonly glucagon: Float32Array;
  public readonly leptin: Float32Array;
  public readonly ghrelin: Float32Array;
  public readonly cortisol: Float32Array;
  public readonly aicZ1: Float32Array; // Briat-Gupta-Khammash Antithetic Integral Controller Z1
  public readonly aicZ2: Float32Array; // Antithetic Integral Controller Z2

  // 6. NeuralCortexState 1:1 SoA Columns
  public readonly senseIn8: Float32Array; // [maxEntities * 8]
  public readonly weights126: Float32Array; // [maxEntities * 126]
  public readonly modulators2: Float32Array; // [maxEntities * 2] = (DA_rpe, ACh_gate)
  public readonly motorOut6: Float32Array; // [maxEntities * 6]
  public readonly norepinephrine: Float32Array;
  public readonly serotonin: Float32Array;
  public readonly pciProxy: Float32Array;
  public readonly thoughtCurvatureKappa: Float32Array;
  public readonly freeWontVetoCount: Uint32Array;

  // 7-10. Relational Auxiliary Tables
  public readonly socialBonds = new Map<number, SocialBondRecord>();
  public readonly causalExperiments: CausalExperimentRecord[] = [];
  public readonly dispatchReceipts: HardwareDispatchReceiptRecord[] = [];

  private nextBondId = 1;
  private nextExperimentId = 1;
  private nextReceiptId = 1;

  // Reversible snapshot ring buffer (`N01`)
  private readonly snapshotCapacity: number;
  private readonly snapshots: ReversibleWorldSnapshot[] = [];

  public constructor(maxEntities = 2048, seedHex = '0x0000000001352af6', snapshotCapacity = 16) {
    this.maxEntities = Math.max(16, Math.min(50_000, maxEntities));
    this.snapshotCapacity = Math.max(4, snapshotCapacity);

    const aliveBuf = createBuffer(this.maxEntities);
    this.sharedMemoryActive = typeof SharedArrayBuffer !== 'undefined' && aliveBuf instanceof SharedArrayBuffer;

    this.epoch = {
      epochId: 1,
      seedHex,
      simTick: 0,
      simTimeSec: 0,
      merkleRootHex: '0x0000000000000000',
      freeEnergyReserveKj: 25_000.0,
    };

    this.alive = new Uint8Array(aliveBuf, 0, this.maxEntities);
    this.speciesFk = new Uint16Array(createBuffer(this.maxEntities * 2), 0, this.maxEntities);
    this.biomeFk = new Uint8Array(createBuffer(this.maxEntities), 0, this.maxEntities);
    this.generation = new Uint16Array(createBuffer(this.maxEntities * 2), 0, this.maxEntities);
    this.flawMask = new Uint8Array(createBuffer(this.maxEntities), 0, this.maxEntities);
    this.ageSec = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.posX = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.posY = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.posZ = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.velX = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.velY = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.velZ = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.headingRad = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.massKg = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.telomereIntegrity = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);

    this.pools15 = new Float64Array(
      createBuffer(this.maxEntities * METABOLIC_POOL_COUNT * 8),
      0,
      this.maxEntities * METABOLIC_POOL_COUNT,
    );
    this.totalIntakeKj = new Float64Array(createBuffer(this.maxEntities * 8), 0, this.maxEntities);
    this.o2Reserve = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.hydration = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.insulin = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.glucagon = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.leptin = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.ghrelin = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.cortisol = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.aicZ1 = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.aicZ2 = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);

    this.senseIn8 = new Float32Array(
      createBuffer(this.maxEntities * ORGANISM_SENSE_STRIDE * 4),
      0,
      this.maxEntities * ORGANISM_SENSE_STRIDE,
    );
    this.weights126 = new Float32Array(
      createBuffer(this.maxEntities * ORGANISM_WEIGHT_STRIDE * 4),
      0,
      this.maxEntities * ORGANISM_WEIGHT_STRIDE,
    );
    this.modulators2 = new Float32Array(createBuffer(this.maxEntities * 2 * 4), 0, this.maxEntities * 2);
    this.motorOut6 = new Float32Array(
      createBuffer(this.maxEntities * ORGANISM_MOTOR_STRIDE * 4),
      0,
      this.maxEntities * ORGANISM_MOTOR_STRIDE,
    );
    this.norepinephrine = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.serotonin = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.pciProxy = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.thoughtCurvatureKappa = new Float32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
    this.freeWontVetoCount = new Uint32Array(createBuffer(this.maxEntities * 4), 0, this.maxEntities);
  }

  public registerBiome(record: BiomeZoneRecord): void {
    if (record.epochId !== this.epoch.epochId) {
      throw new Error(`FK violation: BiomeZone.epochId=${record.epochId} != WorldEpoch.epochId=${this.epoch.epochId}`);
    }
    this.biomes.set(record.biomeId, { ...record });
  }

  public registerSpecies(record: SpeciesLineageRecord): void {
    if (record.parentSpeciesId !== null && !this.species.has(record.parentSpeciesId)) {
      throw new Error(`FK violation: SpeciesLineage.parentSpeciesId=${record.parentSpeciesId} does not exist`);
    }
    this.species.set(record.speciesId, { ...record });
  }

  /**
   * Inserts a new organism with strict relational FK checks (`speciesId`, `biomeId`) and exact 15-pool kJ sum.
   */
  public spawnOrganism(params: {
    speciesId: number;
    biomeId: number;
    generation: number;
    flawMask: number;
    pos: [number, number, number];
    headingRad: number;
    initialPools15: ArrayLike<number>;
    initialWeights126: ArrayLike<number>;
  }): number {
    if (!this.species.has(params.speciesId)) {
      throw new Error(`FK violation: Organism.speciesId=${params.speciesId} not found in SpeciesLineage`);
    }
    if (!this.biomes.has(params.biomeId)) {
      throw new Error(`FK violation: Organism.biomeId=${params.biomeId} not found in BiomeZone`);
    }

    // Reuse dead slot or grow activeCount
    let slot = -1;
    for (let i = 0; i < this.activeCount; i++) {
      if (this.alive[i] === 0) {
        slot = i;
        break;
      }
    }
    if (slot < 0) {
      if (this.activeCount >= this.maxEntities) {
        throw new Error(`ERP store capacity reached (${this.maxEntities} entities)`);
      }
      slot = this.activeCount++;
    }

    this.alive[slot] = 1;
    this.speciesFk[slot] = params.speciesId;
    this.biomeFk[slot] = params.biomeId;
    this.generation[slot] = params.generation;
    this.flawMask[slot] = params.flawMask & 0x0f;
    this.ageSec[slot] = 0;
    this.posX[slot] = params.pos[0];
    this.posY[slot] = params.pos[1];
    this.posZ[slot] = params.pos[2];
    this.velX[slot] = 0;
    this.velY[slot] = 0;
    this.velZ[slot] = 0;
    this.headingRad[slot] = params.headingRad;
    this.massKg[slot] = 1.25;
    this.telomereIntegrity[slot] = 1.0;

    // Exact Kahan sum of initial 15 pools -> totalIntakeKj
    const pBase = slot * METABOLIC_POOL_COUNT;
    let sum = 0;
    let comp = 0;
    for (let k = 0; k < METABOLIC_POOL_COUNT; k++) {
      const val = Math.max(0, Number(params.initialPools15[k] ?? 0));
      this.pools15[pBase + k] = val;
      const y = val - comp;
      const t = sum + y;
      comp = t - sum - y;
      sum = t;
    }
    this.totalIntakeKj[slot] = sum;
    this.o2Reserve[slot] = 0.95;
    this.hydration[slot] = 0.92;
    this.insulin[slot] = 0.35;
    this.glucagon[slot] = 0.25;
    this.leptin[slot] = 0.5;
    this.ghrelin[slot] = 0.3;
    this.cortisol[slot] = 0.15;
    this.aicZ1[slot] = 0.5;
    this.aicZ2[slot] = 0.5;

    const wBase = slot * ORGANISM_WEIGHT_STRIDE;
    for (let w = 0; w < ORGANISM_WEIGHT_STRIDE; w++) {
      this.weights126[wBase + w] = Number(params.initialWeights126[w] ?? 0);
    }
    this.modulators2[slot * 2] = 0.1;
    this.modulators2[slot * 2 + 1] = 0.5;
    this.norepinephrine[slot] = 0.25;
    this.serotonin[slot] = 0.6;
    this.pciProxy[slot] = 0.42;
    this.thoughtCurvatureKappa[slot] = 0.08;
    this.freeWontVetoCount[slot] = 0;

    const sp = this.species.get(params.speciesId)!;
    sp.extantCount += 1;
    return slot;
  }

  public upsertSocialBond(
    sourceEntityId: number,
    targetEntityId: number,
    trustDelta: number,
    kinshipCoeff: number,
    codewordHex: string,
    syndromeClean: boolean,
  ): SocialBondRecord {
    if (this.alive[sourceEntityId] !== 1 || this.alive[targetEntityId] !== 1) {
      throw new Error(`FK violation: SocialBond endpoints (${sourceEntityId}, ${targetEntityId}) must reference alive organisms`);
    }
    const key = sourceEntityId * 65536 + targetEntityId;
    const existing = this.socialBonds.get(key);
    if (existing) {
      existing.trustWeight = Math.max(-1, Math.min(1, existing.trustWeight + trustDelta));
      existing.lastSignalTick = this.epoch.simTick;
      existing.glossodromCodewordHex = codewordHex;
      existing.syndromeClean = syndromeClean;
      return existing;
    }
    const created: SocialBondRecord = {
      bondId: this.nextBondId++,
      sourceEntityId,
      targetEntityId,
      trustWeight: Math.max(-1, Math.min(1, trustDelta)),
      kinshipCoeff: Math.max(0, Math.min(1, kinshipCoeff)),
      lastSignalTick: this.epoch.simTick,
      glossodromCodewordHex: codewordHex,
      syndromeClean,
    };
    this.socialBonds.set(key, created);
    return created;
  }

  public recordExperiment(rec: Omit<CausalExperimentRecord, 'experimentId' | 'epochId'>): CausalExperimentRecord {
    const full: CausalExperimentRecord = {
      experimentId: this.nextExperimentId++,
      epochId: this.epoch.epochId,
      ...rec,
    };
    this.causalExperiments.push(full);
    if (this.causalExperiments.length > 128) this.causalExperiments.shift();
    return full;
  }

  public recordDispatchReceipt(rec: Omit<HardwareDispatchReceiptRecord, 'receiptId' | 'epochId'>): HardwareDispatchReceiptRecord {
    const full: HardwareDispatchReceiptRecord = {
      receiptId: this.nextReceiptId++,
      epochId: this.epoch.epochId,
      ...rec,
    };
    this.dispatchReceipts.push(full);
    if (this.dispatchReceipts.length > 256) this.dispatchReceipts.shift();
    return full;
  }

  /**
   * Relational INNER JOIN across `Organism`, `SpeciesLineage`, `BiomeZone`, `MetabolicLedger`, and `NeuralCortexState`.
   */
  public queryJoinedOrganisms(options: { limit?: number; casteRole?: CasteRole; biomeId?: number } = {}): JoinedOrganismView[] {
    const limit = Math.max(1, Math.min(500, options.limit ?? 64));
    const results: JoinedOrganismView[] = [];

    for (let i = 0; i < this.activeCount && results.length < limit; i++) {
      if (this.alive[i] !== 1) continue;
      const spId = this.speciesFk[i]!;
      const bmId = this.biomeFk[i]!;
      if (options.biomeId !== undefined && bmId !== options.biomeId) continue;
      const sp = this.species.get(spId);
      const bm = this.biomes.get(bmId);
      if (!sp || !bm) continue;
      if (options.casteRole && sp.casteRole !== options.casteRole) continue;

      const pBase = i * METABOLIC_POOL_COUNT;
      results.push({
        entityId: i,
        speciesId: spId,
        latinBinomial: sp.latinBinomial,
        casteRole: sp.casteRole,
        biomeId: bmId,
        biomeName: bm.name,
        ageSec: this.ageSec[i]!,
        generation: this.generation[i]!,
        pos: [this.posX[i]!, this.posY[i]!, this.posZ[i]!],
        vel: [this.velX[i]!, this.velY[i]!, this.velZ[i]!],
        massKg: this.massKg[i]!,
        telomereIntegrity: this.telomereIntegrity[i]!,
        flawMask: this.flawMask[i]!,
        totalMetabolicKj: this.totalIntakeKj[i]!,
        atpBufferKj: this.pools15[pBase + 12]!,
        hydration: this.hydration[i]!,
        dopamineRpe: this.modulators2[i * 2]!,
        pciProxy: this.pciProxy[i]!,
        thoughtCurvatureKappa: this.thoughtCurvatureKappa[i]!,
      });
    }
    return results;
  }

  /**
   * Captures an exact reversible state checkpoint into the ring buffer (`NOVEL-100 N01`).
   */
  public captureSnapshot(): ReversibleWorldSnapshot {
    const n = this.activeCount;
    const biomeArr = Array.from(this.biomes.values()).sort((a, b) => a.biomeId - b.biomeId);
    const snap: ReversibleWorldSnapshot = {
      tick: this.epoch.simTick,
      simTimeSec: this.epoch.simTimeSec,
      freeEnergyReserveKj: this.epoch.freeEnergyReserveKj,
      activeCount: n,
      alive: this.alive.slice(0, n),
      speciesId: this.speciesFk.slice(0, n),
      biomeId: this.biomeFk.slice(0, n),
      ageSec: this.ageSec.slice(0, n),
      posX: this.posX.slice(0, n),
      posY: this.posY.slice(0, n),
      posZ: this.posZ.slice(0, n),
      velX: this.velX.slice(0, n),
      velY: this.velY.slice(0, n),
      velZ: this.velZ.slice(0, n),
      pools15: this.pools15.slice(0, n * METABOLIC_POOL_COUNT),
      totalIntakeKj: this.totalIntakeKj.slice(0, n),
      hydration: this.hydration.slice(0, n),
      weights126: this.weights126.slice(0, n * ORGANISM_WEIGHT_STRIDE),
      biomeNutrients: Float64Array.from(biomeArr.map((b) => b.nutrientPoolKj)),
      biomeDetritus: Float64Array.from(biomeArr.map((b) => b.detritusPoolKj)),
    };
    this.snapshots.push(snap);
    if (this.snapshots.length > this.snapshotCapacity) {
      this.snapshots.shift();
    }
    return snap;
  }

  public listSnapshots(): Array<{ tick: number; simTimeSec: number; activeCount: number }> {
    return this.snapshots.map((s) => ({
      tick: s.tick,
      simTimeSec: s.simTimeSec,
      activeCount: s.activeCount,
    }));
  }

  public rollbackToSnapshot(targetTick?: number): boolean {
    if (this.snapshots.length === 0) return false;
    let chosen = this.snapshots[this.snapshots.length - 1]!;
    if (targetTick !== undefined) {
      const exact = this.snapshots.find((s) => s.tick === targetTick);
      if (!exact) return false;
      chosen = exact;
    }

    const n = chosen.activeCount;
    this.epoch.simTick = chosen.tick;
    this.epoch.simTimeSec = chosen.simTimeSec;
    this.epoch.freeEnergyReserveKj = chosen.freeEnergyReserveKj;
    this.activeCount = n;

    this.alive.fill(0);
    this.alive.set(chosen.alive, 0);
    this.speciesFk.set(chosen.speciesId, 0);
    this.biomeFk.set(chosen.biomeId, 0);
    this.ageSec.set(chosen.ageSec, 0);
    this.posX.set(chosen.posX, 0);
    this.posY.set(chosen.posY, 0);
    this.posZ.set(chosen.posZ, 0);
    this.velX.set(chosen.velX, 0);
    this.velY.set(chosen.velY, 0);
    this.velZ.set(chosen.velZ, 0);
    this.pools15.set(chosen.pools15, 0);
    this.totalIntakeKj.set(chosen.totalIntakeKj, 0);
    this.hydration.set(chosen.hydration, 0);
    this.weights126.set(chosen.weights126, 0);

    const biomeArr = Array.from(this.biomes.values()).sort((a, b) => a.biomeId - b.biomeId);
    for (let idx = 0; idx < biomeArr.length && idx < chosen.biomeNutrients.length; idx++) {
      biomeArr[idx]!.nutrientPoolKj = chosen.biomeNutrients[idx]!;
      biomeArr[idx]!.detritusPoolKj = chosen.biomeDetritus[idx]!;
    }
    this.recomputeSpeciesExtantCounts();
    return true;
  }

  public recomputeSpeciesExtantCounts(): void {
    for (const sp of this.species.values()) {
      sp.extantCount = 0;
    }
    for (let i = 0; i < this.activeCount; i++) {
      if (this.alive[i] === 1) {
        const sp = this.species.get(this.speciesFk[i]!);
        if (sp) sp.extantCount += 1;
      }
    }
  }
}
