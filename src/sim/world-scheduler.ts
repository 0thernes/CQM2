/**
 * CQM2 Pure Deterministic 5-Phase World Scheduler (`src/sim/world-scheduler.ts`).
 * Replaces CQM1's 7,974-line `src/world.ts` God-object with a clean, testable, zero-DOM orchestrator:
 *   Phase 1 (`PERCEPTION`): Spatial biome/nutrient sensing, spherical harmonics, & Glitchling unscrambling.
 *   Phase 2 (`COGNITION`): Batched SIMD/CUDA organism cortices + Asmodenius v42 + Glitchling + Xylos v2 + Thaler + Pantheon.
 *   Phase 3 (`PHYSICS`): Shuffled Verlet soft-body spine + Kerr relativistic geodesics/QNM + Eshkol Taylor jet4.
 *   Phase 4 (`METABOLISM_ECOLOGY`): 15-pool conserved kJ metabolism, Big Tree Sanctuary, diploid speciation, Xenomimics, AURUM/UMBRA.
 *   Phase 5 (`AUDIT_RECEIPT`): First-Law conservation check, Rosette wire receipt, Merkle epoch hash, & bit-exact `N01` snapshots.
 */
import { AsmodeniusV42Brain, type AsmodeniusStateSnapshot, type AsmodeniusStepTelemetry } from '../brains/asmodenius';
import {
  FLAW_BACKWARDS,
  FLAW_LEAKY,
  FLAW_MISFIRE,
  FLAW_SCRAMBLE,
  GlitchlingNeuroplasticityOrgan,
  type GlitchlingStateSnapshot,
  type GlitchlingTelemetry,
} from '../brains/glitchling';
import {
  DEFAULT_INITIAL_POOLS_15,
  ingestConservedMealKj,
  type MetabolicStepSummary,
  stepPopulationMetabolism,
} from '../brains/metabolism';
import { CASTE_ROLES, MechalogodromPantheon, type PantheonSnapshot, type PantheonStateSnapshot } from '../brains/pantheon';
import { ThalerCreativityMachine, type ThalerStateSnapshot, type ThalerStepTelemetry } from '../brains/thaler-creativity';
import { XylosMedusaBrain, type XylosBrainStateSnapshot, type XylosStepTelemetry } from '../brains/xylos';
import {
  DEFAULT_GOD_DIALS,
  type GodDialParams,
  hashString64,
  sanitizeGodDials,
  type SubstreamName,
  SubstreamPrngHub,
} from '../core/prng';
import { ErpRelationalStore, ORGANISM_WEIGHT_STRIDE, type ReversibleWorldSnapshot } from '../erp/relational-store';
import { getZigBridge } from '../native/zig-bridge';
import {
  computeRelativisticPhotonRingMetrics,
  evaluateHoggarContextuality,
  type HoggarContextualityReport,
  type QgtSurfaceSample,
  resolveDrivesViaIsingVqe,
  sampleHealthyQrngBatch,
  ZeroGcQuantumRegister,
} from '../quantum/contextuality';
import { computeLeaverKerrQnmSpectrum, type KerrQnmMode } from '../quantum/kerr-relativity';
import { applyProjectiveAblationDedup, braidFibonacciAnyonWord } from '../quantum/voynich-khora';
import {
  decodeGlossodromRs15_11,
  encodeCormidium16,
  encodeGlossodromRs15_11,
  healCormidium16Erasures,
  ReversibleXglossVm,
  synthesizeTaxonomicIdentity,
} from '../quantum/xenolinguistics';
import {
  type BonsaiSaeProbeResult,
  computePqConsensusQuorum,
  evaluateBonsaiSaeSurvivalProbe,
  type RosetteWireReceipt,
  TsotchkeAblationController,
} from '../tsotchke/corpus';
import { BiosphereEcologyEngine, type EcologyStateSnapshot, type EcologyStepReport } from './ecology';

export type SimulationRunState = 'RUNNING' | 'SUSPENDED' | 'FROZEN';

export interface WorldAuxiliarySnapshot {
  prngStates: Record<SubstreamName, { stateHex: string; spare: number | null }>;
  qrngSeedHex: string;
  verletRngState: number;
  asmodenius: AsmodeniusStateSnapshot;
  glitchling: GlitchlingStateSnapshot;
  xylos: XylosBrainStateSnapshot;
  thaler: ThalerStateSnapshot;
  pantheon: PantheonStateSnapshot;
  ecology: EcologyStateSnapshot;
  quantumRe: Float64Array;
  quantumIm: Float64Array;
  skinUGs: Float32Array;
  skinVGs: Float32Array;
  skinFhnV: Float32Array;
  skinFhnW: Float32Array;
  spinePtsXyz: Float32Array;
  spinePrevPtsXyz: Float32Array;
  jetHistory5: Float32Array;
}

export interface WorldTickTelemetry {
  simTick: number;
  simTimeSec: number;
  runState: SimulationRunState;
  aliveCount: number;
  merkleRootHex: string;
  conservationValid: boolean;
  maxMetabolicDrift: number;
  metabolism: MetabolicStepSummary;
  ecology: EcologyStepReport;
  asmodenius: AsmodeniusStepTelemetry;
  glitchling: GlitchlingTelemetry;
  xylos: XylosStepTelemetry;
  thaler: ThalerStepTelemetry;
  pantheon: PantheonSnapshot;
  quantumGeometry: QgtSurfaceSample;
  hoggar: HoggarContextualityReport;
  kerrPhotonRing: {
    progradeIscoOverM: number;
    criticalImpactOverM: number;
    dopplerFactorG: number;
    beamedIntensityG4: number;
  };
  kerrDominantQnm: KerrQnmMode;
  isingVqeDrives4: [number, number, number, number];
  vandermondeJetConfidence: number;
  rosetteReceipt: RosetteWireReceipt;
  bonsaiSaeProbe: BonsaiSaeProbeResult;
  pqQuorumKbps: number;
  voynichAnyonTauProb: number;
  cormidium16Healed: boolean;
  qrngEntropyBits: number;
  qrngHealthy: boolean;
  reactiveSkinMeanPattern: number;
  eshkolMeanSpineCurvature: number;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x00000100000001b3n;
const MASK64 = 0xffffffffffffffffn;

export type ExternalCortexBatchFn = (
  inputs: Float32Array,
  weights: Float32Array,
  modulators: Float32Array,
  outputs: Float32Array,
  count: number,
  learningRate: number,
) => void;

export class Cqm2WorldScheduler {
  public readonly prng: SubstreamPrngHub;
  public readonly store: ErpRelationalStore;
  public readonly asmodenius: AsmodeniusV42Brain;
  public readonly glitchling: GlitchlingNeuroplasticityOrgan;
  public readonly xylos: XylosMedusaBrain;
  public readonly thaler: ThalerCreativityMachine;
  public readonly pantheon: MechalogodromPantheon;
  public readonly ecology: BiosphereEcologyEngine;
  public readonly quantumRegister: ZeroGcQuantumRegister;
  public readonly tsotchke: TsotchkeAblationController;
  public readonly xglossVm: ReversibleXglossVm;

  public dials: GodDialParams;
  public runState: SimulationRunState = 'RUNNING';

  public readonly skinWidth = 24;
  public readonly skinHeight = 24;
  public readonly skinUGs = new Float32Array(24 * 24);
  public readonly skinVGs = new Float32Array(24 * 24);
  public readonly skinFhnV = new Float32Array(24 * 24);
  public readonly skinFhnW = new Float32Array(24 * 24);

  // Articulated 8-somite Verlet Soft-Body Spine (`[8 * 3]`) + Curvature (`[8]`)
  public readonly spinePtsXyz = new Float32Array(8 * 3);
  public readonly spinePrevPtsXyz = new Float32Array(8 * 3);
  public readonly spineCurvature = new Float32Array(8);
  private readonly spineInvMass = Float32Array.from([0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.8]);
  private readonly spineEdgeA = Uint16Array.from([0, 1, 2, 3, 4, 5, 6]);
  private readonly spineEdgeB = Uint16Array.from([1, 2, 3, 4, 5, 6, 7]);
  private readonly spineRestLen = Float32Array.from([0.58, 0.58, 0.58, 0.58, 0.58, 0.58, 0.58]);
  private readonly spineStiff = Float32Array.from([0.85, 0.85, 0.82, 0.82, 0.78, 0.75, 0.72]);
  private verletRngState = 0x13579bdf;

  private readonly jetHistory5 = new Float32Array(5);
  private readonly jetOut5 = new Float32Array(5);
  private readonly swigluWeights8 = Float32Array.from([1.0, 0.95, 1.05, 0.9, 1.0, 0.95, 1.0, 1.0]);

  private qrngSeed: bigint;
  private cachedHoggar: HoggarContextualityReport | null = null;
  private lastTelemetry: WorldTickTelemetry | null = null;

  public constructor(options: {
    seed?: bigint | number;
    initialPopulation?: number;
    maxEntities?: number;
    dials?: Partial<GodDialParams>;
  } = {}) {
    const seedBig = typeof options.seed === 'bigint' ? options.seed : BigInt(options.seed ?? 20261110);
    this.prng = new SubstreamPrngHub(seedBig);
    this.qrngSeed = seedBig ^ 0x99aa55cc11223344n;
    this.dials = sanitizeGodDials(options.dials ?? DEFAULT_GOD_DIALS);

    const seedHex = '0x' + (seedBig & MASK64).toString(16).padStart(16, '0');
    this.store = new ErpRelationalStore(options.maxEntities ?? 2048, seedHex, 16);
    this.asmodenius = new AsmodeniusV42Brain(seedBig);
    this.glitchling = new GlitchlingNeuroplasticityOrgan(
      this.prng.stream('flaw'),
      FLAW_SCRAMBLE | FLAW_BACKWARDS | FLAW_LEAKY | FLAW_MISFIRE,
      64,
    );
    this.xylos = new XylosMedusaBrain(seedBig);
    this.thaler = new ThalerCreativityMachine(seedBig, 'intact');
    this.pantheon = new MechalogodromPantheon(seedBig);
    this.ecology = new BiosphereEcologyEngine(128, this.prng.stream('ecology'));
    this.quantumRegister = new ZeroGcQuantumRegister(8);
    this.tsotchke = new TsotchkeAblationController();
    this.xglossVm = new ReversibleXglossVm([0x63716d32, 0x20261110, 0x0badc0de, 0x31415926]);

    this.initSkinAndSpine();
    this.bootstrapBiomesSpeciesAndPopulation(Math.max(8, Math.min(512, options.initialPopulation ?? 96)));
    this.ecology.seedXenomimicEntangledPairs(this.store, 6);
    this.captureWorldSnapshot();
  }

  private initSkinAndSpine(): void {
    this.skinUGs.fill(1.0);
    this.skinVGs.fill(0.0);
    for (let y = 9; y < 15; y++) {
      for (let x = 9; x < 15; x++) {
        const idx = y * this.skinWidth + x;
        this.skinUGs[idx] = 0.5;
        this.skinVGs[idx] = 0.25;
        this.skinFhnV[idx] = 0.6;
      }
    }
    for (let i = 0; i < 8; i++) {
      this.spinePtsXyz[i * 3] = 0;
      this.spinePtsXyz[i * 3 + 1] = 1.5;
      this.spinePtsXyz[i * 3 + 2] = -i * 0.58;
    }
    this.spinePrevPtsXyz.set(this.spinePtsXyz);
  }

  private bootstrapBiomesSpeciesAndPopulation(initialPopulation: number): void {
    const biomeSpecs = [
      { id: 1, name: 'Abyssal Hydrothermal Plume', kind: 'HYDROTHERMAL_ABYSS' as const, x: -24, z: -18, r: 32, temp: 308 },
      { id: 2, name: 'Pelagic Photon Shelf', kind: 'PELAGIC_PHOTON_SHELF' as const, x: 22, z: -16, r: 36, temp: 294 },
      { id: 3, name: 'Guanine Crystal Reef', kind: 'CRYSTAL_REEF' as const, x: -18, z: 24, r: 30, temp: 289 },
      { id: 4, name: 'Kerr Singularity Rim', kind: 'SINGULARITY_RIM' as const, x: 20, z: 22, r: 28, temp: 301 },
    ];
    for (const b of biomeSpecs) {
      this.store.registerBiome({
        biomeId: b.id,
        epochId: this.store.epoch.epochId,
        name: b.name,
        kind: b.kind,
        centerX: b.x,
        centerZ: b.z,
        radius: b.r,
        nutrientPoolKj: 8500.0,
        detritusPoolKj: 250.0,
        o2Saturation: this.dials.oxygenSaturation,
        osmolarityMOsM: 300.0,
        temperatureK: b.temp,
      });
    }

    const genRng = this.prng.stream('genome');
    for (let s = 0; s < 5; s++) {
      const caste = CASTE_ROLES[s]!;
      const tax = synthesizeTaxonomicIdentity(this.prng.masterSeed, s + 1, caste);
      const binomial =
        s === 0 ? 'Asmodenius primigenius' : s === 1 ? 'Glitchlingia mirabilis' : s === 2 ? 'Xylos hyperbolicusa' : tax.latinBinomial;
      this.store.registerSpecies({
        speciesId: s + 1,
        parentSpeciesId: s === 0 ? null : 1,
        originTick: 0,
        casteRole: caste,
        latinBinomial: binomial,
        commonGlyph: tax.commonGlyph,
        genomeHashHex: '0x' + hashString64(`${binomial}::${s}`).toString(16).padStart(16, '0'),
        baseHueDeg: tax.baseHueDeg,
        extantCount: 0,
        meanFitness: 1.0,
      });
    }

    const worldRng = this.prng.stream('world');
    const weightsBuf = new Float32Array(ORGANISM_WEIGHT_STRIDE);

    for (let i = 0; i < initialPopulation; i++) {
      const speciesId = (i % 5) + 1;
      const biomeId = (i % 4) + 1;
      const bm = this.store.biomes.get(biomeId)!;
      const angle = worldRng.nextRange(0, 2.0 * Math.PI);
      const rad = worldRng.nextRange(2.0, bm.radius * 0.65);

      for (let w = 0; w < ORGANISM_WEIGHT_STRIDE; w++) {
        weightsBuf[w] = genRng.nextGaussian(0, 0.28);
      }

      const morphotype = i === 0 ? 0 : i === 1 ? 1 : i === 2 ? 2 : 3 + (i % 4);
      const flaws = i === 1 ? FLAW_SCRAMBLE | FLAW_BACKWARDS | FLAW_LEAKY | FLAW_MISFIRE : 0;

      this.store.spawnOrganism({
        speciesId,
        biomeId,
        generation: 1,
        flawMask: flaws,
        morphotypeId: morphotype,
        pos: [bm.centerX + Math.cos(angle) * rad, worldRng.nextRange(0.8, 6.5), bm.centerZ + Math.sin(angle) * rad],
        headingRad: angle,
        initialPools15: DEFAULT_INITIAL_POOLS_15,
        initialWeights126: weightsBuf,
      });
    }

    // Initialize spine at Entity 0's spawn coordinates
    for (let s = 0; s < 8; s++) {
      this.spinePtsXyz[s * 3] = this.store.posX[0] ?? 0;
      this.spinePtsXyz[s * 3 + 1] = this.store.posY[0] ?? 2.0;
      this.spinePtsXyz[s * 3 + 2] = (this.store.posZ[0] ?? 0) - s * 0.58;
    }
    this.spinePrevPtsXyz.set(this.spinePtsXyz);
  }

  public captureWorldSnapshot(): ReversibleWorldSnapshot {
    const aux: WorldAuxiliarySnapshot = {
      prngStates: this.prng.snapshotFullStates(),
      qrngSeedHex: '0x' + (this.qrngSeed & MASK64).toString(16).padStart(16, '0'),
      verletRngState: this.verletRngState,
      asmodenius: this.asmodenius.snapshotState(),
      glitchling: this.glitchling.snapshotState(),
      xylos: this.xylos.snapshotState(),
      thaler: this.thaler.snapshotState(),
      pantheon: this.pantheon.snapshotState(),
      ecology: this.ecology.snapshotState(),
      quantumRe: this.quantumRegister.re.slice(),
      quantumIm: this.quantumRegister.im.slice(),
      skinUGs: this.skinUGs.slice(),
      skinVGs: this.skinVGs.slice(),
      skinFhnV: this.skinFhnV.slice(),
      skinFhnW: this.skinFhnW.slice(),
      spinePtsXyz: this.spinePtsXyz.slice(),
      spinePrevPtsXyz: this.spinePrevPtsXyz.slice(),
      jetHistory5: this.jetHistory5.slice(),
    };
    return this.store.captureSnapshot(aux);
  }

  public rollbackToSnapshot(targetTick?: number): boolean {
    const snap = this.store.getSnapshot(targetTick);
    if (!snap || !this.store.rollbackToSnapshot(targetTick)) return false;
    const aux = snap.auxiliaryPayload as WorldAuxiliarySnapshot | undefined;
    if (aux) {
      this.prng.restoreFullStates(aux.prngStates);
      this.qrngSeed = BigInt(aux.qrngSeedHex);
      this.verletRngState = aux.verletRngState;
      this.asmodenius.restoreState(aux.asmodenius);
      this.glitchling.restoreState(aux.glitchling);
      this.xylos.restoreState(aux.xylos);
      this.thaler.restoreState(aux.thaler);
      this.pantheon.restoreState(aux.pantheon);
      this.ecology.restoreState(aux.ecology);
      this.quantumRegister.re.set(aux.quantumRe);
      this.quantumRegister.im.set(aux.quantumIm);
      this.skinUGs.set(aux.skinUGs);
      this.skinVGs.set(aux.skinVGs);
      this.skinFhnV.set(aux.skinFhnV);
      this.skinFhnW.set(aux.skinFhnW);
      this.spinePtsXyz.set(aux.spinePtsXyz);
      this.spinePrevPtsXyz.set(aux.spinePrevPtsXyz);
      this.jetHistory5.set(aux.jetHistory5);
    }
    return true;
  }

  public updateGodDials(patch: Partial<GodDialParams>): GodDialParams {
    this.dials = sanitizeGodDials({ ...this.dials, ...patch });
    return this.dials;
  }

  public setRunState(next: SimulationRunState): SimulationRunState {
    this.runState = next;
    return this.runState;
  }

  public stepTick(requestedDtSec = 0.05, externalCortexFn?: ExternalCortexBatchFn): WorldTickTelemetry {
    if (this.runState !== 'RUNNING' && this.lastTelemetry) {
      return { ...this.lastTelemetry, runState: this.runState };
    }

    const clampedDt = Math.max(0.002, Math.min(0.25, requestedDtSec));
    const substeps = clampedDt > 0.08 ? 2 : 1;
    const dt = clampedDt / substeps;
    let outTel: WorldTickTelemetry | null = null;
    for (let sub = 0; sub < substeps; sub++) {
      outTel = this.executeSingleSubstep(dt, externalCortexFn);
    }
    this.lastTelemetry = outTel!;
    return outTel!;
  }

  private executeSingleSubstep(dt: number, externalCortexFn?: ExternalCortexBatchFn): WorldTickTelemetry {
    const zig = getZigBridge();
    const n = this.store.activeCount;
    const flawRng = this.prng.stream('flaw');
    const ecoRng = this.prng.stream('ecology');
    const genRng = this.prng.stream('genome');
    const qRng = this.prng.stream('quantum');

    const biomeInflux = (this.dials.freeEnergyInfluxKjPerSec * dt) / Math.max(1, this.store.biomes.size);
    for (const bm of this.store.biomes.values()) {
      bm.nutrientPoolKj += biomeInflux;
      bm.o2Saturation = this.dials.oxygenSaturation;
    }
    this.store.epoch.freeEnergyReserveKj += this.dials.freeEnergyInfluxKjPerSec * dt;

    // ========================================================================
    // PHASE 1: PERCEPTION + `libirrep` SPHERICAL HARMONICS + `tensorcore` SWIGLU
    // ========================================================================
    const useHarmonics = this.tsotchke.isEnabled('libirrep');
    for (let e = 0; e < n; e++) {
      if (this.store.alive[e] !== 1) continue;
      const bm = this.store.biomes.get(this.store.biomeFk[e]!)!;
      const dx = bm.centerX - this.store.posX[e]!;
      const dy = 2.5 - this.store.posY[e]!;
      const dz = bm.centerZ - this.store.posZ[e]!;
      const dist = Math.hypot(dx, dz) + 1e-5;
      const sBase = e * 8;

      let harmBoost = 0;
      if (useHarmonics && e < 4) {
        const ylm = zig.sphericalHarmonicsL2(dx, dy, dz);
        harmBoost = 0.08 * (ylm[6] ?? 0); // l=2, m=0 axial harmonic
      }

      this.store.senseIn8[sBase] = dx / dist + harmBoost;
      this.store.senseIn8[sBase + 1] = dz / dist;
      this.store.senseIn8[sBase + 2] = Math.tanh(bm.nutrientPoolKj / 5000.0);
      this.store.senseIn8[sBase + 3] = this.store.ghrelin[e]!;
      this.store.senseIn8[sBase + 4] = 1.0 - this.store.hydration[e]!;
      this.store.senseIn8[sBase + 5] = this.store.o2Reserve[e]!;
      this.store.senseIn8[sBase + 6] = Math.sin(this.store.headingRad[e]!);
      this.store.senseIn8[sBase + 7] = Math.cos(this.store.headingRad[e]!);

      this.store.modulators2[e * 2] = Math.tanh((this.store.pools15[e * 15 + 12]! - 6.0) * 0.25);
      this.store.modulators2[e * 2 + 1] = 0.55;
    }

    // Optional `tensorcore` RMSNorm+SwiGLU preconditioning on Entity 0 sensory channels
    const e0Sense = new Float32Array(8);
    e0Sense.set(this.store.senseIn8.subarray(0, 8));
    if (this.tsotchke.isEnabled('tensorcore')) {
      const gate8 = Float32Array.from([1.2, 1.2, 1.0, 1.1, 1.0, 1.0, 0.9, 0.9]);
      zig.rmsNormSwiglu(e0Sense, gate8, this.swigluWeights8, e0Sense);
    }

    // ========================================================================
    // PHASE 2: COGNITION (CUDA/SIMD Batch + Asmodenius + Glitchling + Xylos + Thaler + Pantheon)
    // ========================================================================
    const effectiveLr = this.tsotchke.isEnabled('tensorcore') ? 0.015 * this.dials.plasticityScale : 0.0;
    if (externalCortexFn) {
      externalCortexFn(
        this.store.senseIn8,
        this.store.weights126,
        this.store.modulators2,
        this.store.motorOut6,
        n,
        effectiveLr,
      );
    } else {
      zig.stepOrganismBrainsSimd(
        this.store.senseIn8,
        this.store.weights126,
        this.store.modulators2,
        this.store.motorOut6,
        n,
        effectiveLr,
      );
    }

    // Creature #1 (Entity 0): Asmodenius v42.1 14-Region CNS + ENS
    const physicsSignature =
      this.dials.kerrSpinA + this.dials.manifoldWarpGain + this.dials.quantumContextualityCoupling;
    const e0Gut = this.store.pools15[0]! + this.store.pools15[1]! + this.store.pools15[2]!;
    const asmoTel = this.asmodenius.stepBrain({
      sensory8: e0Sense,
      gutLoadKj: e0Gut,
      bloodGlucoseKj: this.store.pools15[3]!,
      somaticHazard: this.store.cortisol[0]!,
      cueNoiseVariance: 0.12,
      cueCost: 0.35,
      physicsSignature,
      ach: 0.65,
      ne: this.store.norepinephrine[0] ?? 0.3,
      cemiCoupling: 0.25 * this.dials.quantumContextualityCoupling,
      dtSec: dt,
    });
    this.store.thoughtCurvatureKappa[0] = asmoTel.frenetCurvatureKappa;
    this.store.freeWontVetoCount[0] = asmoTel.totalFreeWontVetoes;
    if (this.store.alive[0] === 1) {
      for (let m = 0; m < 6; m++) this.store.motorOut6[m] = asmoTel.motorCmd6[m]!;
    }

    // Creature #2 (Entity 1): Glitchling Non-Oracle Unscrambler + Motor Inversion + STC + Sleep/Dream
    const proto16 = new Float32Array(16);
    const raw16 = new Float32Array(16);
    for (let k = 0; k < 16; k++) {
      const worldCh = this.store.senseIn8[8 + (k & 7)] ?? 0.4;
      proto16[k] = worldCh;
      raw16[k] = worldCh;
    }
    this.glitchling.processSensory16(raw16, proto16, flawRng, 0.35);
    const intended8 = new Float32Array(8);
    const proprio8 = new Float32Array(8);
    intended8[0] = this.store.senseIn8[8] ?? 0.7; // Real world biome vector X!
    intended8[1] = 0.15;
    intended8[2] = this.store.senseIn8[9] ?? -0.5; // Real world biome vector Z!
    for (let k = 3; k < 6; k++) intended8[k] = this.store.motorOut6[6 + k] ?? 0.3;
    proprio8[0] = this.store.velX[1] ?? 0;
    proprio8[2] = this.store.velZ[1] ?? 0;

    const executed8 = this.glitchling.executeMotor8(intended8, proprio8, flawRng, 0.1);
    const hebbianVec = new Float32Array(64);
    for (let k = 0; k < 64; k++) hebbianVec[k] = 0.05 * (raw16[k & 15] ?? 0.4);
    this.glitchling.stepSynapticTaggingAndCapture(hebbianVec, Math.max(0.2, this.store.modulators2[2] ?? 0.5), 0.45, dt);
    const gSleep = this.glitchling.stepSpatialAndSleep({
      angularVelRadPerSec: executed8[2]! * 0.8,
      posX: this.store.posX[1] ?? 0,
      posZ: this.store.posZ[1] ?? 0,
      episode16: raw16,
      salience: Math.abs(this.store.modulators2[2] ?? 0.5) + 0.3,
      dtSec: dt,
      flawRng,
    });
    if (this.store.alive[1] === 1) {
      this.store.sleepStage[1] = gSleep;
      this.store.motorOut6[6] = executed8[0]!;
      this.store.motorOut6[7] = executed8[1]!;
      this.store.motorOut6[8] = executed8[2]!;
    }
    const glitchTel = this.glitchling.getTelemetry();

    // Creature #3 (Entity 2): Xylos v2 Hyperbolic Medusa (`14` Butlin Non-Oracle Indicators)
    const xylosTel = this.xylos.stepXylos({
      sensory8: this.store.senseIn8.subarray(16, 24),
      posX: this.store.posX[2] ?? 0,
      posZ: this.store.posZ[2] ?? 0,
      hunger: this.store.ghrelin[2] ?? 0.4,
      hazard: this.store.cortisol[2] ?? 0.15,
      dreamGate: (this.store.sleepStage[2] ?? 0) === 2 ? 1.0 : 0.0,
      dtSec: dt,
    });
    if (this.store.alive[2] === 1) {
      for (let m = 0; m < 6; m++) this.store.motorOut6[12 + m] = xylosTel.motorCmd6[m]!;
      this.store.pciProxy[2] = xylosTel.meanButlinScore;
    }

    // Stephen Thaler Creativity Machine + `DABUS` + `Gedanken-Death`
    const thalerTel = this.thaler.stepCreativity({
      sensory8: e0Sense,
      metabolicStress: this.store.cortisol[0] ?? 0.2,
      rng: qRng,
    });

    // 5-Caste Kuramoto + 512D FHRR Archon Pantheon + LLG Spins + Poincaré Phylogeny
    const worldFeat16 = new Float32Array(16);
    for (let i = 0; i < 16; i++) worldFeat16[i] = this.store.senseIn8[i] ?? 0;
    const pantheonTel = this.pantheon.stepPantheon(worldFeat16, 1.6 * this.dials.quantumContextualityCoupling, dt, {
      enableLlgSpins: this.tsotchke.isEnabled('spin_based_neural_network'),
      enableHopfield: this.tsotchke.isEnabled('bonsai-fidelity-study'),
      enableDpp: this.tsotchke.isEnabled('libirrep'),
      species: this.store.species.values(),
    });

    // Apply Archon Caste Directives + Thaler ORACLE Exploration Bias across population (`e >= 3`)
    for (let e = 3; e < n; e++) {
      if (this.store.alive[e] !== 1) continue;
      const sp = this.store.species.get(this.store.speciesFk[e]!);
      if (!sp) continue;
      const dir = pantheonTel.casteDirectives[sp.casteRole];
      const mBase = e * 6;
      this.store.motorOut6[mBase] = 0.78 * this.store.motorOut6[mBase]! + 0.22 * dir[0]!;
      this.store.motorOut6[mBase + 2] = 0.78 * this.store.motorOut6[mBase + 2]! + 0.22 * dir[2]!;
      if (sp.casteRole === 'ORACLE') {
        this.store.motorOut6[mBase] = this.store.motorOut6[mBase]! + 0.15 * thalerTel.creativeMotorBias6[0]!;
      }
    }

    // Quantum Contextuality, Ising VQE Drive Resolver & Zero-GC QGTL Step
    if (this.tsotchke.isEnabled('quantum_geometric_tensor')) {
      this.quantumRegister.evolveUnitaryStep(0.08 * this.dials.quantumContextualityCoupling, 0.05);
    }
    const qgtSample = this.quantumRegister.sampleQuantumGeometry();
    if (!this.cachedHoggar) {
      this.cachedHoggar = evaluateHoggarContextuality(3);
    }
    this.store.upsertQuantumSubstrate({
      substrateId: 1,
      epochId: this.store.epoch.epochId,
      entityId: 0,
      qubitCount: 3,
      purityTrRho2: 1.0 - qgtSample.normDrift,
      fubiniStudyTraceG: qgtSample.fubiniStudyGxx + qgtSample.fubiniStudyGyy,
      berryCurvatureOmega: qgtSample.berryCurvatureXY,
      contextualityWitness: this.cachedHoggar.violatedHexagonH2Lines,
      updatedAtTick: this.store.epoch.simTick,
    });

    // Eshkol Backward Vandermonde Taylor-Jet4 Confidence + 4-Qubit Ising VQE Drive Resolver
    for (let i = 0; i < 4; i++) this.jetHistory5[i] = this.jetHistory5[i + 1]!;
    this.jetHistory5[4] = asmoTel.metacognitiveConfidenceHot3.value;
    const jetConf = this.tsotchke.isEnabled('eshkol')
      ? zig.eshkolVandermondeJet4(this.jetHistory5, this.jetOut5)
      : asmoTel.metacognitiveConfidenceHot3.value;

    const vqeRes = this.tsotchke.isEnabled('moonlab')
      ? resolveDrivesViaIsingVqe(
          [this.store.ghrelin[0] ?? 0.4, this.store.cortisol[0] ?? 0.2, asmoTel.epistemicValueOfInfo, 0.45],
          jetConf,
          12,
        )
      : { resolvedWeights4: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number], groundEnergy: 0, dampedConfidence: jetConf };

    const qrngSnap = this.tsotchke.isEnabled('quantum_rng')
      ? sampleHealthyQrngBatch(this.qrngSeed, 64)
      : { values: new Float64Array(16), rctHealthy: true, aptHealthy: true, shannonBitsPerByte: 7.5, nextSeed: this.qrngSeed };
    this.qrngSeed = qrngSnap.nextSeed;

    // ========================================================================
    // PHASE 3: PHYSICS, SHUFFLED VERLET SOFT-BODY SPINE & KERR RELATIVITY
    // ========================================================================
    const worldBound = 68.0;
    for (let e = 0; e < n; e++) {
      if (this.store.alive[e] !== 1) continue;
      const mBase = e * 6;
      const steerX = this.store.motorOut6[mBase]!;
      const steerY = this.store.motorOut6[mBase + 1]!;
      const steerZ = this.store.motorOut6[mBase + 2]!;

      const vx = Math.pow(0.22, dt) * this.store.velX[e]! + 4.8 * steerX * dt;
      const vy = Math.pow(0.22, dt) * this.store.velY[e]! + 2.4 * steerY * dt;
      const vz = Math.pow(0.22, dt) * this.store.velZ[e]! + 4.8 * steerZ * dt;

      this.store.velX[e] = vx;
      this.store.velY[e] = vy;
      this.store.velZ[e] = vz;

      this.store.posX[e] = Math.max(-worldBound, Math.min(worldBound, this.store.posX[e]! + vx * dt * 4.0));
      this.store.posY[e] = Math.max(0.4, Math.min(18.0, this.store.posY[e]! + vy * dt * 2.5));
      this.store.posZ[e] = Math.max(-worldBound, Math.min(worldBound, this.store.posZ[e]! + vz * dt * 4.0));
      this.store.headingRad[e] = Math.atan2(vz, vx);
    }

    // Anchor somite 0 to Entity 0 head + CPG lateral swim wave, then step LCG-shuffled Verlet constraints!
    this.spinePtsXyz[0] = this.store.posX[0] ?? 0;
    this.spinePtsXyz[1] = this.store.posY[0] ?? 2.0;
    this.spinePtsXyz[2] = this.store.posZ[0] ?? 0;
    for (let s = 1; s < 8; s++) {
      this.spinePtsXyz[s * 3] = this.spinePtsXyz[s * 3]! + Math.sin(asmoTel.cpgPhaseRad - s * 0.65) * 0.32 * dt;
    }
    this.verletRngState = zig.stepVerletShuffled(
      this.spinePtsXyz,
      this.spinePrevPtsXyz,
      this.spineInvMass,
      this.spineEdgeA,
      this.spineEdgeB,
      this.spineRestLen,
      this.spineStiff,
      dt,
      0.0,
      this.verletRngState,
    );
    const meanSpineCurv = zig.eshkolSpineCurvature(this.spinePtsXyz, this.spineCurvature);

    const kerrRing = computeRelativisticPhotonRingMetrics(
      this.dials.kerrSpinA,
      1.18,
      (this.store.epoch.simTimeSec * 0.6) % (2.0 * Math.PI),
    );
    const qnmModes = computeLeaverKerrQnmSpectrum(this.dials.kerrSpinA);

    // ========================================================================
    // PHASE 4: METABOLISM, BIOSPHERE ECOLOGY, XENOLINGUA & REACTIVE SKIN
    // ========================================================================
    for (let e = 0; e < n; e++) {
      if (this.store.alive[e] !== 1) continue;
      const bm = this.store.biomes.get(this.store.biomeFk[e]!)!;
      const distToVent = Math.hypot(this.store.posX[e]! - bm.centerX, this.store.posZ[e]! - bm.centerZ);
      if (distToVent < bm.radius * 0.85 && this.store.ghrelin[e]! > 0.25) {
        ingestConservedMealKj(this.store, e, 1.8 * dt * (1.0 + this.store.ghrelin[e]!));
      }
      if (this.store.hydration[e]! < 0.78) {
        this.store.hydration[e] = Math.min(1.0, this.store.hydration[e]! + 0.25 * dt);
      }
    }

    const ecoReport = this.ecology.stepBiosphere({
      store: this.store,
      ecoRng,
      genRng,
      kerrSpinA: this.dials.kerrSpinA,
      quantumCoupling: this.dials.quantumContextualityCoupling,
      plasticityScale: this.dials.plasticityScale,
      dtSec: dt,
    });

    const metabSummary = stepPopulationMetabolism(this.store, dt, {
      metabolicRateScale: this.dials.metabolicRateScale,
      oxygenSaturation: this.dials.oxygenSaturation,
      useAntitheticController: this.tsotchke.isEnabled('PINN'),
      enableTemperatureQ10: this.tsotchke.isEnabled('PIMC'),
    });

    // Glossodrom RS[15,11] + Cormidium-16 Tesseract + Reversible Xgloss VM + Voynich 𐍈-KHORA Braiding
    let cormidiumOk = true;
    if (this.store.epoch.simTick % 4 === 0 && this.store.activeCount >= 2 && this.store.alive[0] === 1 && this.store.alive[1] === 1) {
      const msg11 = Uint8Array.from([
        this.store.speciesFk[0]! & 0x0f,
        Math.round(this.store.ghrelin[0]! * 15) & 0x0f,
        Math.round(this.store.leptin[0]! * 15) & 0x0f,
        Math.round(this.store.o2Reserve[0]! * 15) & 0x0f,
        3, 7, 11, 2, 9, 14, 5,
      ]);
      const cw = encodeGlossodromRs15_11(msg11);
      const noisy = cw.slice();
      noisy[2] = noisy[2]! ^ 0x0a;
      noisy[11] = noisy[11]! ^ 0x05;
      const healed = decodeGlossodromRs15_11(noisy);
      const cwHex = Array.from(healed.correctedCodeword, (x) => x.toString(16)).join('');
      this.store.upsertSocialBond(0, 1, 0.08, 0.5, cwHex, !healed.uncorrectable);

      const corm = encodeCormidium16(msg11.subarray(0, 9));
      cormidiumOk = healCormidium16Erasures(corm, [0, 5, 10, 15]).fullyRecovered;
      this.xglossVm.stepForward({ op: 'FEISTEL_VEIL', left: 0, right: 1, roundKey: this.store.epoch.simTick });
      this.xglossVm.stepBack(); // Bijective round-trip verification!
    }

    const dedup = applyProjectiveAblationDedup([0, 0, 3, 5, 5, 7, 2, 1]);
    const anyonBraid = braidFibonacciAnyonWord(dedup.ablatedIndices.map((idx) => (idx % 2 === 0 ? 1 : 2)));

    const skinMean = this.tsotchke.isEnabled('PINN')
      ? zig.stepReactiveSkin(
          this.skinUGs,
          this.skinVGs,
          this.skinFhnV,
          this.skinFhnW,
          this.skinWidth,
          this.skinHeight,
          this.store.leptin[0] ?? 0.5,
          this.store.cortisol[0] ?? 0.15,
          Math.max(0, this.store.modulators2[0] ?? 0.2),
          Math.abs(asmoTel.regionActivations14[10] ?? 0.3),
        )
      : 0.25;

    // ========================================================================
    // PHASE 5: FIRST-LAW CONSERVATION AUDIT, ROSETTE RECEIPT, MERKLE & SNAPSHOT
    // ========================================================================
    const postCount = this.store.activeCount;
    let maxRelDrift = 0;
    let conservationValid = true;
    let merkleAcc = FNV_OFFSET;

    for (let e = 0; e < postCount; e++) {
      const base = e * 15;
      let sum = 0;
      let c = 0;
      for (let k = 0; k < 15; k++) {
        const val = this.store.pools15[base + k]!;
        if (!Number.isFinite(val) || val < -1e-12) conservationValid = false;
        const y = val - c;
        const t = sum + y;
        c = t - sum - y;
        sum = t;
      }
      const expected = this.store.totalIntakeKj[e]!;
      const rel = Math.abs(sum - expected) / Math.max(1.0, Math.abs(expected));
      if (!Number.isFinite(rel) || rel >= 1e-12) conservationValid = false;
      if (rel > maxRelDrift) maxRelDrift = rel;

      const qx = BigInt(Math.round((this.store.posX[e] ?? 0) * 1000) & 0xffffffff);
      const qz = BigInt(Math.round((this.store.posZ[e] ?? 0) * 1000) & 0xffffffff);
      merkleAcc = ((merkleAcc ^ qx ^ (qz << 16n)) * FNV_PRIME) & MASK64;
    }

    this.store.epoch.simTick += 1;
    this.store.epoch.simTimeSec += dt;
    this.store.epoch.merkleRootHex = '0x' + merkleAcc.toString(16).padStart(16, '0');

    const rosetteReceipt = this.tsotchke.rosette.verifyTickComposition({
      tick: this.store.epoch.simTick,
      activePillars: this.tsotchke.countActivePillars(),
      maxMetabolicDrift: maxRelDrift,
      quantumNormDrift: qgtSample.normDrift,
      qrngHealthy: qrngSnap.rctHealthy && qrngSnap.aptHealthy,
      merkleRoot64: merkleAcc,
    });
    const saeProbe = evaluateBonsaiSaeSurvivalProbe(asmoTel.regionActivations14, 5);
    const pqQuorum = computePqConsensusQuorum(5, 20);

    if (this.store.epoch.simTick % 25 === 0) {
      this.captureWorldSnapshot();
    }

    return {
      simTick: this.store.epoch.simTick,
      simTimeSec: this.store.epoch.simTimeSec,
      runState: this.runState,
      aliveCount: metabSummary.aliveCount,
      merkleRootHex: this.store.epoch.merkleRootHex,
      conservationValid,
      maxMetabolicDrift: maxRelDrift,
      metabolism: metabSummary,
      ecology: ecoReport,
      asmodenius: asmoTel,
      glitchling: glitchTel,
      xylos: xylosTel,
      thaler: thalerTel,
      pantheon: pantheonTel,
      quantumGeometry: qgtSample,
      hoggar: this.cachedHoggar,
      kerrPhotonRing: kerrRing,
      kerrDominantQnm: qnmModes[0]!,
      isingVqeDrives4: vqeRes.resolvedWeights4,
      vandermondeJetConfidence: jetConf,
      rosetteReceipt,
      bonsaiSaeProbe: saeProbe,
      pqQuorumKbps: pqQuorum.kbpsBudget,
      voynichAnyonTauProb: anyonBraid.probTauChannel1,
      cormidium16Healed: cormidiumOk,
      qrngEntropyBits: qrngSnap.shannonBitsPerByte,
      qrngHealthy: qrngSnap.rctHealthy && qrngSnap.aptHealthy,
      reactiveSkinMeanPattern: skinMean,
      eshkolMeanSpineCurvature: meanSpineCurv,
    };
  }
}
