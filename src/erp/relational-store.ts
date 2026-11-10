/**
 * CQM2 Entity Relational Programming (`ERP`) Engine & Reversible SoA Ring-Buffer Store.
 * Replaces CQM1's heap-allocated object soup with 10 normalized, 3NF-aligned Structure-of-Arrays
 * (`SoA`) tables backed by `SharedArrayBuffer` (with transparent `ArrayBuffer` fallback).
 *
 * Normalized Entity Model (10 Core Entities — 1:1 parity with SQLite `migrations/001_initial_3nf.up.sql`):
 *   1. `WorldEpoch`              (PK: epochId)
 *   2. `BiomeZone`               (PK: biomeId, FK: epochId -> WorldEpoch)
 *   3. `SpeciesLineage`          (PK: speciesId, Self-FK: parentSpeciesId -> SpeciesLineage)
 *   4. `Organism`                (PK: entityId, FK: speciesId -> SpeciesLineage, FK: biomeId -> BiomeZone)
 *   5. `MetabolicLedger`         (PK/FK 1:1: entityId -> Organism; 15 conserved kJ pools + O2/CO2/pH/ROS)
 *   6. `NeuralCortexState`       (PK/FK 1:1: entityId -> Organism; 126 SIMD weights + modulators + PCI)
 *   7. `QuantumSubstrate`        (PK: substrateId, Nullable FK: entityId -> Organism)
 *   8. `SocialBond`              (PK: bondId, FK: sourceEntityId, targetEntityId -> Organism)
 *   9. `CausalExperiment`        (PK: experimentId, FK: epochId -> WorldEpoch)
 *  10. `HardwareDispatchReceipt` (PK: receiptId, FK: epochId -> WorldEpoch)
 */

export type CasteRole = 'EXPLORER' | 'HARVESTER' | 'GUARDIAN' | 'ARCHITECT' | 'ORACLE';
export type BiomeKind = 'HYDROTHERMAL_ABYSS' | 'PELAGIC_PHOTON_SHELF' | 'CRYSTAL_REEF' | 'SINGULARITY_RIM';
export type SleepStageCode = 0 | 1 | 2; // 0=WAKE, 1=NREM, 2=REM

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

export interface QuantumSubstrateRecord {
  substrateId: number;
  epochId: number;
  entityId: number | null;
  qubitCount: number;
  purityTrRho2: number;
  fubiniStudyTraceG: number;
  berryCurvatureOmega: number;
  contextualityWitness: number;
  updatedAtTick: number;
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
  morphotypeId: number;
  entangledPartnerId: number;
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
  o2Reserve: number;
  bloodPh: number;
  rosDamage: number;
  sleepStage: SleepStageCode;
  aurumWealth: number;
  umbraWealth: number;
  dopamineRpe: number;
  pciProxy: number;
  thoughtCurvatureKappa: number;
}

export interface ReversibleWorldSnapshot {
  tick: number;
  simTimeSec: number;
  merkleRootHex: string;
  freeEnergyReserveKj: number;
  activeCount: number;
  alive: Uint8Array;
  speciesId: Uint16Array;
  biomeId: Uint8Array;
  generation: Uint16Array;
  flawMask: Uint8Array;
  morphotypeId: Uint8Array;
  entangledPartnerId: Int32Array;
  ageSec: Float32Array;
  posX: Float32Array;
  posY: Float32Array;
  posZ: Float32Array;
  velX: Float32Array;
  velY: Float32Array;
  velZ: Float32Array;
  headingRad: Float32Array;
  massKg: Float32Array;
  telomereIntegrity: Float32Array;
  pools15: Float64Array;
  totalIntakeKj: Float64Array;
  o2Reserve: Float32Array;
  co2Level: Float32Array;
  bloodPh: Float32Array;
  rosDamage: Float32Array;
  sleepStage: Uint8Array;
  aurumWealth: Float32Array;
  umbraWealth: Float32Array;
  hydration: Float32Array;
  insulin: Float32Array;
  glucagon: Float32Array;
  leptin: Float32Array;
  ghrelin: Float32Array;
  cortisol: Float32Array;
  aicZ1: Float32Array;
  aicZ2: Float32Array;
  senseIn8: Float32Array;
  weights126: Float32Array;
  modulators2: Float32Array;
  motorOut6: Float32Array;
  norepinephrine: Float32Array;
  serotonin: Float32Array;
  pciProxy: Float32Array;
  thoughtCurvatureKappa: Float32Array;
  freeWontVetoCount: Uint32Array;
  biomes: BiomeZoneRecord[];
  species: SpeciesLineageRecord[];
  quantumSubstrates: QuantumSubstrateRecord[];
  socialBonds: Array<[number, SocialBondRecord]>;
  nextBondId: number;
  auxiliaryPayload?: unknown;
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

const allocU8 = (n: number): Uint8Array => new Uint8Array(createBuffer(n), 0, n);
const allocU16 = (n: number): Uint16Array => new Uint16Array(createBuffer(n * 2), 0, n);
const allocU32 = (n: number): Uint32Array => new Uint32Array(createBuffer(n * 4), 0, n);
const allocI32 = (n: number): Int32Array => new Int32Array(createBuffer(n * 4), 0, n);
const allocF32 = (n: number): Float32Array => new Float32Array(createBuffer(n * 4), 0, n);
const allocF64 = (n: number): Float64Array => new Float64Array(createBuffer(n * 8), 0, n);

export class ErpRelationalStore {
  public readonly maxEntities: number;
  public readonly sharedMemoryActive: boolean;

  public epoch: WorldEpochRecord;
  public readonly biomes = new Map<number, BiomeZoneRecord>();
  public readonly species = new Map<number, SpeciesLineageRecord>();

  // 4. Organism SoA Columns
  public activeCount = 0;
  public readonly alive: Uint8Array;
  public readonly speciesFk: Uint16Array;
  public readonly biomeFk: Uint8Array;
  public readonly generation: Uint16Array;
  public readonly flawMask: Uint8Array;
  public readonly morphotypeId: Uint8Array;
  public readonly entangledPartnerId: Int32Array;
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
  public readonly pools15: Float64Array;
  public readonly totalIntakeKj: Float64Array;
  public readonly o2Reserve: Float32Array;
  public readonly co2Level: Float32Array;
  public readonly bloodPh: Float32Array;
  public readonly rosDamage: Float32Array;
  public readonly sleepStage: Uint8Array;
  public readonly aurumWealth: Float32Array;
  public readonly umbraWealth: Float32Array;
  public readonly hydration: Float32Array;
  public readonly insulin: Float32Array;
  public readonly glucagon: Float32Array;
  public readonly leptin: Float32Array;
  public readonly ghrelin: Float32Array;
  public readonly cortisol: Float32Array;
  public readonly aicZ1: Float32Array;
  public readonly aicZ2: Float32Array;

  // 6. NeuralCortexState 1:1 SoA Columns
  public readonly senseIn8: Float32Array;
  public readonly weights126: Float32Array;
  public readonly modulators2: Float32Array;
  public readonly motorOut6: Float32Array;
  public readonly norepinephrine: Float32Array;
  public readonly serotonin: Float32Array;
  public readonly pciProxy: Float32Array;
  public readonly thoughtCurvatureKappa: Float32Array;
  public readonly freeWontVetoCount: Uint32Array;

  // 7-10. Relational Auxiliary Tables
  public readonly quantumSubstrates = new Map<number, QuantumSubstrateRecord>();
  public readonly socialBonds = new Map<number, SocialBondRecord>();
  public readonly causalExperiments: CausalExperimentRecord[] = [];
  public readonly dispatchReceipts: HardwareDispatchReceiptRecord[] = [];

  private nextBondId = 1;
  private nextExperimentId = 1;
  private nextReceiptId = 1;
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

    const m = this.maxEntities;
    this.alive = new Uint8Array(aliveBuf, 0, m);
    this.speciesFk = allocU16(m);
    this.biomeFk = allocU8(m);
    this.generation = allocU16(m);
    this.flawMask = allocU8(m);
    this.morphotypeId = allocU8(m);
    this.entangledPartnerId = allocI32(m);
    this.entangledPartnerId.fill(-1);
    this.ageSec = allocF32(m);
    this.posX = allocF32(m);
    this.posY = allocF32(m);
    this.posZ = allocF32(m);
    this.velX = allocF32(m);
    this.velY = allocF32(m);
    this.velZ = allocF32(m);
    this.headingRad = allocF32(m);
    this.massKg = allocF32(m);
    this.telomereIntegrity = allocF32(m);

    this.pools15 = allocF64(m * METABOLIC_POOL_COUNT);
    this.totalIntakeKj = allocF64(m);
    this.o2Reserve = allocF32(m);
    this.co2Level = allocF32(m);
    this.bloodPh = allocF32(m);
    this.bloodPh.fill(7.4);
    this.rosDamage = allocF32(m);
    this.sleepStage = allocU8(m);
    this.aurumWealth = allocF32(m);
    this.umbraWealth = allocF32(m);
    this.hydration = allocF32(m);
    this.insulin = allocF32(m);
    this.glucagon = allocF32(m);
    this.leptin = allocF32(m);
    this.ghrelin = allocF32(m);
    this.cortisol = allocF32(m);
    this.aicZ1 = allocF32(m);
    this.aicZ2 = allocF32(m);

    this.senseIn8 = allocF32(m * ORGANISM_SENSE_STRIDE);
    this.weights126 = allocF32(m * ORGANISM_WEIGHT_STRIDE);
    this.modulators2 = allocF32(m * 2);
    this.motorOut6 = allocF32(m * ORGANISM_MOTOR_STRIDE);
    this.norepinephrine = allocF32(m);
    this.serotonin = allocF32(m);
    this.pciProxy = allocF32(m);
    this.thoughtCurvatureKappa = allocF32(m);
    this.freeWontVetoCount = allocU32(m);
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

  public upsertQuantumSubstrate(record: QuantumSubstrateRecord): QuantumSubstrateRecord {
    if (record.epochId !== this.epoch.epochId) {
      throw new Error(`FK violation: QuantumSubstrate.epochId=${record.epochId} != WorldEpoch.epochId=${this.epoch.epochId}`);
    }
    if (record.entityId !== null && (record.entityId < 0 || record.entityId >= this.activeCount)) {
      throw new Error(`FK violation: QuantumSubstrate.entityId=${record.entityId} out of Organism range`);
    }
    const copy = { ...record };
    this.quantumSubstrates.set(copy.substrateId, copy);
    return copy;
  }

  public spawnOrganism(params: {
    speciesId: number;
    biomeId: number;
    generation: number;
    flawMask: number;
    morphotypeId?: number;
    entangledPartnerId?: number;
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
    this.morphotypeId[slot] = params.morphotypeId ?? ((params.speciesId + 2) & 0x07);
    this.entangledPartnerId[slot] = params.entangledPartnerId ?? -1;
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
    this.co2Level[slot] = 0.12;
    this.bloodPh[slot] = 7.4;
    this.rosDamage[slot] = 0.02;
    this.sleepStage[slot] = 0;
    this.aurumWealth[slot] = 10.0;
    this.umbraWealth[slot] = 2.0;
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
      const stageRaw = this.sleepStage[i]! as SleepStageCode;
      results.push({
        entityId: i,
        speciesId: spId,
        latinBinomial: sp.latinBinomial,
        casteRole: sp.casteRole,
        morphotypeId: this.morphotypeId[i]!,
        entangledPartnerId: this.entangledPartnerId[i]!,
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
        o2Reserve: this.o2Reserve[i]!,
        bloodPh: this.bloodPh[i]!,
        rosDamage: this.rosDamage[i]!,
        sleepStage: stageRaw <= 2 ? stageRaw : 0,
        aurumWealth: this.aurumWealth[i]!,
        umbraWealth: this.umbraWealth[i]!,
        dopamineRpe: this.modulators2[i * 2]!,
        pciProxy: this.pciProxy[i]!,
        thoughtCurvatureKappa: this.thoughtCurvatureKappa[i]!,
      });
    }
    return results;
  }

  public captureSnapshot(auxiliaryPayload?: unknown): ReversibleWorldSnapshot {
    const n = this.activeCount;
    const snap: ReversibleWorldSnapshot = {
      tick: this.epoch.simTick,
      simTimeSec: this.epoch.simTimeSec,
      merkleRootHex: this.epoch.merkleRootHex,
      freeEnergyReserveKj: this.epoch.freeEnergyReserveKj,
      activeCount: n,
      alive: this.alive.slice(0, n),
      speciesId: this.speciesFk.slice(0, n),
      biomeId: this.biomeFk.slice(0, n),
      generation: this.generation.slice(0, n),
      flawMask: this.flawMask.slice(0, n),
      morphotypeId: this.morphotypeId.slice(0, n),
      entangledPartnerId: this.entangledPartnerId.slice(0, n),
      ageSec: this.ageSec.slice(0, n),
      posX: this.posX.slice(0, n),
      posY: this.posY.slice(0, n),
      posZ: this.posZ.slice(0, n),
      velX: this.velX.slice(0, n),
      velY: this.velY.slice(0, n),
      velZ: this.velZ.slice(0, n),
      headingRad: this.headingRad.slice(0, n),
      massKg: this.massKg.slice(0, n),
      telomereIntegrity: this.telomereIntegrity.slice(0, n),
      pools15: this.pools15.slice(0, n * METABOLIC_POOL_COUNT),
      totalIntakeKj: this.totalIntakeKj.slice(0, n),
      o2Reserve: this.o2Reserve.slice(0, n),
      co2Level: this.co2Level.slice(0, n),
      bloodPh: this.bloodPh.slice(0, n),
      rosDamage: this.rosDamage.slice(0, n),
      sleepStage: this.sleepStage.slice(0, n),
      aurumWealth: this.aurumWealth.slice(0, n),
      umbraWealth: this.umbraWealth.slice(0, n),
      hydration: this.hydration.slice(0, n),
      insulin: this.insulin.slice(0, n),
      glucagon: this.glucagon.slice(0, n),
      leptin: this.leptin.slice(0, n),
      ghrelin: this.ghrelin.slice(0, n),
      cortisol: this.cortisol.slice(0, n),
      aicZ1: this.aicZ1.slice(0, n),
      aicZ2: this.aicZ2.slice(0, n),
      senseIn8: this.senseIn8.slice(0, n * ORGANISM_SENSE_STRIDE),
      weights126: this.weights126.slice(0, n * ORGANISM_WEIGHT_STRIDE),
      modulators2: this.modulators2.slice(0, n * 2),
      motorOut6: this.motorOut6.slice(0, n * ORGANISM_MOTOR_STRIDE),
      norepinephrine: this.norepinephrine.slice(0, n),
      serotonin: this.serotonin.slice(0, n),
      pciProxy: this.pciProxy.slice(0, n),
      thoughtCurvatureKappa: this.thoughtCurvatureKappa.slice(0, n),
      freeWontVetoCount: this.freeWontVetoCount.slice(0, n),
      biomes: Array.from(this.biomes.values(), (b) => ({ ...b })),
      species: Array.from(this.species.values(), (s) => ({ ...s })),
      quantumSubstrates: Array.from(this.quantumSubstrates.values(), (q) => ({ ...q })),
      socialBonds: Array.from(this.socialBonds.entries(), ([k, v]) => [k, { ...v }]),
      nextBondId: this.nextBondId,
      auxiliaryPayload,
    };
    this.snapshots.push(snap);
    if (this.snapshots.length > this.snapshotCapacity) {
      this.snapshots.shift();
    }
    return snap;
  }

  public listSnapshots(): Array<{ tick: number; simTimeSec: number; activeCount: number; merkleRootHex: string }> {
    return this.snapshots.map((s) => ({
      tick: s.tick,
      simTimeSec: s.simTimeSec,
      activeCount: s.activeCount,
      merkleRootHex: s.merkleRootHex,
    }));
  }

  public getSnapshot(targetTick?: number): ReversibleWorldSnapshot | null {
    if (this.snapshots.length === 0) return null;
    if (targetTick === undefined) return this.snapshots[this.snapshots.length - 1]!;
    return this.snapshots.find((s) => s.tick === targetTick) ?? null;
  }

  public rollbackToSnapshot(targetTick?: number): boolean {
    const chosen = this.getSnapshot(targetTick);
    if (!chosen) return false;

    const n = chosen.activeCount;
    this.epoch.simTick = chosen.tick;
    this.epoch.simTimeSec = chosen.simTimeSec;
    this.epoch.merkleRootHex = chosen.merkleRootHex;
    this.epoch.freeEnergyReserveKj = chosen.freeEnergyReserveKj;
    this.activeCount = n;

    this.alive.fill(0);
    this.alive.set(chosen.alive, 0);
    this.speciesFk.set(chosen.speciesId, 0);
    this.biomeFk.set(chosen.biomeId, 0);
    this.generation.set(chosen.generation, 0);
    this.flawMask.set(chosen.flawMask, 0);
    this.morphotypeId.set(chosen.morphotypeId, 0);
    this.entangledPartnerId.fill(-1);
    this.entangledPartnerId.set(chosen.entangledPartnerId, 0);
    this.ageSec.set(chosen.ageSec, 0);
    this.posX.set(chosen.posX, 0);
    this.posY.set(chosen.posY, 0);
    this.posZ.set(chosen.posZ, 0);
    this.velX.set(chosen.velX, 0);
    this.velY.set(chosen.velY, 0);
    this.velZ.set(chosen.velZ, 0);
    this.headingRad.set(chosen.headingRad, 0);
    this.massKg.set(chosen.massKg, 0);
    this.telomereIntegrity.set(chosen.telomereIntegrity, 0);
    this.pools15.set(chosen.pools15, 0);
    this.totalIntakeKj.set(chosen.totalIntakeKj, 0);
    this.o2Reserve.set(chosen.o2Reserve, 0);
    this.co2Level.set(chosen.co2Level, 0);
    this.bloodPh.set(chosen.bloodPh, 0);
    this.rosDamage.set(chosen.rosDamage, 0);
    this.sleepStage.set(chosen.sleepStage, 0);
    this.aurumWealth.set(chosen.aurumWealth, 0);
    this.umbraWealth.set(chosen.umbraWealth, 0);
    this.hydration.set(chosen.hydration, 0);
    this.insulin.set(chosen.insulin, 0);
    this.glucagon.set(chosen.glucagon, 0);
    this.leptin.set(chosen.leptin, 0);
    this.ghrelin.set(chosen.ghrelin, 0);
    this.cortisol.set(chosen.cortisol, 0);
    this.aicZ1.set(chosen.aicZ1, 0);
    this.aicZ2.set(chosen.aicZ2, 0);
    this.senseIn8.set(chosen.senseIn8, 0);
    this.weights126.set(chosen.weights126, 0);
    this.modulators2.set(chosen.modulators2, 0);
    this.motorOut6.set(chosen.motorOut6, 0);
    this.norepinephrine.set(chosen.norepinephrine, 0);
    this.serotonin.set(chosen.serotonin, 0);
    this.pciProxy.set(chosen.pciProxy, 0);
    this.thoughtCurvatureKappa.set(chosen.thoughtCurvatureKappa, 0);
    this.freeWontVetoCount.set(chosen.freeWontVetoCount, 0);

    this.biomes.clear();
    for (const b of chosen.biomes) this.biomes.set(b.biomeId, { ...b });
    this.species.clear();
    for (const s of chosen.species) this.species.set(s.speciesId, { ...s });
    this.quantumSubstrates.clear();
    for (const q of chosen.quantumSubstrates) this.quantumSubstrates.set(q.substrateId, { ...q });
    this.socialBonds.clear();
    for (const [k, v] of chosen.socialBonds) this.socialBonds.set(k, { ...v });
    this.nextBondId = chosen.nextBondId;

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
