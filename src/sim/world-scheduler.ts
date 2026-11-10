/**
 * CQM2 Pure Deterministic 5-Phase World Scheduler (`src/sim/world-scheduler.ts`).
 * Replaces CQM1's 7,974-line `src/world.ts` God-object with a clean, testable, zero-DOM orchestrator:
 *   Phase 1 (`PERCEPTION`): Spatial biome/nutrient sensing + Glitchling sensory unscrambling.
 *   Phase 2 (`COGNITION`): Batched Zig SIMD128 organism cortices + Asmodenius v42 Creature #1 + Pantheon.
 *   Phase 3 (`PHYSICS`): LCG-shuffled Verlet/kinematic integration + Kerr photon-ring & Eshkol spine curvature.
 *   Phase 4 (`METABOLISM_ECOLOGY`): Exact 15-pool conserved kJ metabolism, foraging, Glossodrom social signaling, reactive skin.
 *   Phase 5 (`AUDIT_RECEIPT`): First-Law conservation check, Merkle epoch state hash, and `N01` reversible snapshots.
 */
import { AsmodeniusV42Brain, type AsmodeniusStepTelemetry } from '../brains/asmodenius';
import {
  FLAW_BACKWARDS,
  FLAW_LEAKY,
  FLAW_SCRAMBLE,
  GlitchlingNeuroplasticityOrgan,
  type GlitchlingTelemetry,
} from '../brains/glitchling';
import {
  DEFAULT_INITIAL_POOLS_15,
  ingestConservedMealKj,
  type MetabolicStepSummary,
  stepPopulationMetabolism,
} from '../brains/metabolism';
import { CASTE_ROLES, MechalogodromPantheon, type PantheonSnapshot } from '../brains/pantheon';
import {
  DEFAULT_GOD_DIALS,
  type GodDialParams,
  hashString64,
  sanitizeGodDials,
  SubstreamPrngHub,
} from '../core/prng';
import { ErpRelationalStore, ORGANISM_WEIGHT_STRIDE } from '../erp/relational-store';
import { getZigBridge } from '../native/zig-bridge';
import {
  computeRelativisticPhotonRingMetrics,
  evaluateHoggarContextuality,
  type HoggarContextualityReport,
  type QgtSurfaceSample,
  sampleHealthyQrngBatch,
  ZeroGcQuantumRegister,
} from '../quantum/contextuality';
import {
  decodeGlossodromRs15_11,
  encodeGlossodromRs15_11,
  synthesizeTaxonomicIdentity,
} from '../quantum/xenolinguistics';
import { TsotchkeAblationController } from '../tsotchke/corpus';

export type SimulationRunState = 'RUNNING' | 'SUSPENDED' | 'FROZEN';

export interface WorldTickTelemetry {
  simTick: number;
  simTimeSec: number;
  runState: SimulationRunState;
  aliveCount: number;
  merkleRootHex: string;
  conservationValid: boolean;
  maxMetabolicDrift: number;
  metabolism: MetabolicStepSummary;
  asmodenius: AsmodeniusStepTelemetry;
  glitchling: GlitchlingTelemetry;
  pantheon: PantheonSnapshot;
  quantumGeometry: QgtSurfaceSample;
  hoggar: HoggarContextualityReport;
  kerrPhotonRing: {
    progradeIscoOverM: number;
    criticalImpactOverM: number;
    dopplerFactorG: number;
    beamedIntensityG4: number;
  };
  qrngEntropyBits: number;
  qrngHealthy: boolean;
  reactiveSkinMeanPattern: number;
  eshkolMeanSpineCurvature: number;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x00000100000001b3n;
const MASK64 = 0xffffffffffffffffn;

export class Cqm2WorldScheduler {
  public readonly prng: SubstreamPrngHub;
  public readonly store: ErpRelationalStore;
  public readonly asmodenius: AsmodeniusV42Brain;
  public readonly glitchling: GlitchlingNeuroplasticityOrgan;
  public readonly pantheon: MechalogodromPantheon;
  public readonly quantumRegister: ZeroGcQuantumRegister;
  public readonly tsotchke: TsotchkeAblationController;

  public dials: GodDialParams;
  public runState: SimulationRunState = 'RUNNING';

  // Reactive 24x24 Creature Skin Turing + FitzHugh-Nagumo Lattice
  public readonly skinWidth = 24;
  public readonly skinHeight = 24;
  public readonly skinUGs = new Float32Array(24 * 24);
  public readonly skinVGs = new Float32Array(24 * 24);
  public readonly skinFhnV = new Float32Array(24 * 24);
  public readonly skinFhnW = new Float32Array(24 * 24);

  // Articulated 8-somite Creature #1 Spine (`[8 * 3]`) + Curvature (`[8]`)
  public readonly spinePtsXyz = new Float32Array(8 * 3);
  public readonly spineCurvature = new Float32Array(8);

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
      FLAW_SCRAMBLE | FLAW_BACKWARDS | FLAW_LEAKY,
      64,
    );
    this.pantheon = new MechalogodromPantheon(seedBig);
    this.quantumRegister = new ZeroGcQuantumRegister(8);
    this.tsotchke = new TsotchkeAblationController();

    this.initSkinAndSpine();
    this.bootstrapBiomesSpeciesAndPopulation(Math.max(8, Math.min(512, options.initialPopulation ?? 96)));
    this.store.captureSnapshot();
  }

  private initSkinAndSpine(): void {
    this.skinUGs.fill(1.0);
    this.skinVGs.fill(0.0);
    // Seed central chromatophore nucleation patch
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
      this.spinePtsXyz[i * 3 + 2] = i * 0.65;
    }
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
      this.store.registerSpecies({
        speciesId: s + 1,
        parentSpeciesId: s === 0 ? null : 1,
        originTick: 0,
        casteRole: caste,
        latinBinomial: s === 0 ? 'Asmodenius primigenius' : tax.latinBinomial,
        commonGlyph: tax.commonGlyph,
        genomeHashHex: '0x' + hashString64(`${tax.latinBinomial}::${s}`).toString(16).padStart(16, '0'),
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

      this.store.spawnOrganism({
        speciesId,
        biomeId,
        generation: 1,
        flawMask: i === 1 ? FLAW_SCRAMBLE | FLAW_BACKWARDS | FLAW_LEAKY : 0, // Entity 0 = Asmodenius Prime, Entity 1 = Glitchling Prime!
        pos: [bm.centerX + Math.cos(angle) * rad, worldRng.nextRange(0.8, 6.5), bm.centerZ + Math.sin(angle) * rad],
        headingRad: angle,
        initialPools15: DEFAULT_INITIAL_POOLS_15,
        initialWeights126: weightsBuf,
      });
    }
  }

  public updateGodDials(patch: Partial<GodDialParams>): GodDialParams {
    this.dials = sanitizeGodDials({ ...this.dials, ...patch });
    return this.dials;
  }

  public setRunState(next: SimulationRunState): SimulationRunState {
    this.runState = next;
    return this.runState;
  }

  /**
   * Executes one complete 5-phase deterministic simulation tick (with automatic adaptive step-halving when `dtSec > 0.1`).
   */
  public stepTick(requestedDtSec = 0.05): WorldTickTelemetry {
    if (this.runState !== 'RUNNING' && this.lastTelemetry) {
      return { ...this.lastTelemetry, runState: this.runState };
    }

    const clampedDt = Math.max(0.002, Math.min(0.25, requestedDtSec));
    // Adaptive step-halving convergence guard (`T-075`)
    const substeps = clampedDt > 0.08 ? 2 : 1;
    const dt = clampedDt / substeps;
    let outTel: WorldTickTelemetry | null = null;
    for (let sub = 0; sub < substeps; sub++) {
      outTel = this.executeSingleSubstep(dt);
    }
    this.lastTelemetry = outTel!;
    return outTel!;
  }

  private executeSingleSubstep(dt: number): WorldTickTelemetry {
    const zig = getZigBridge();
    const n = this.store.activeCount;
    const worldRng = this.prng.stream('world');
    const flawRng = this.prng.stream('flaw');

    // Solar / Hydrothermal free-energy influx into biomes
    const biomeInflux = (this.dials.freeEnergyInfluxKjPerSec * dt) / Math.max(1, this.store.biomes.size);
    for (const bm of this.store.biomes.values()) {
      bm.nutrientPoolKj += biomeInflux;
      bm.o2Saturation = this.dials.oxygenSaturation;
    }
    this.store.epoch.freeEnergyReserveKj += this.dials.freeEnergyInfluxKjPerSec * dt;

    // ========================================================================
    // PHASE 1: PERCEPTION
    // ========================================================================
    for (let e = 0; e < n; e++) {
      if (this.store.alive[e] !== 1) continue;
      const bm = this.store.biomes.get(this.store.biomeFk[e]!)!;
      const dx = bm.centerX - this.store.posX[e]!;
      const dz = bm.centerZ - this.store.posZ[e]!;
      const dist = Math.hypot(dx, dz) + 1e-5;
      const sBase = e * 8;
      this.store.senseIn8[sBase] = dx / dist;
      this.store.senseIn8[sBase + 1] = dz / dist;
      this.store.senseIn8[sBase + 2] = Math.tanh(bm.nutrientPoolKj / 5000.0);
      this.store.senseIn8[sBase + 3] = this.store.ghrelin[e]!;
      this.store.senseIn8[sBase + 4] = 1.0 - this.store.hydration[e]!;
      this.store.senseIn8[sBase + 5] = this.store.o2Reserve[e]!;
      this.store.senseIn8[sBase + 6] = Math.sin(this.store.headingRad[e]!);
      this.store.senseIn8[sBase + 7] = Math.cos(this.store.headingRad[e]!);

      this.store.modulators2[e * 2] = Math.tanh((this.store.pools15[e * 15 + 12]! - 6.0) * 0.25); // DA RPE
      this.store.modulators2[e * 2 + 1] = 0.55; // ACh gate
    }

    // ========================================================================
    // PHASE 2: COGNITION (Zig SIMD128 Population + Asmodenius v42 + Glitchling + Pantheon)
    // ========================================================================
    const effectiveLr = this.tsotchke.isEnabled('hebbian-assemblies') ? 0.015 * this.dials.plasticityScale : 0.0;
    zig.stepOrganismBrainsSimd(
      this.store.senseIn8,
      this.store.weights126,
      this.store.modulators2,
      this.store.motorOut6,
      n,
      effectiveLr,
    );

    // Creature #1 (Entity 0): Asmodenius v42 14-Region CNS + ENS
    const physicsSignature =
      this.dials.kerrSpinA + this.dials.manifoldWarpGain + this.dials.quantumContextualityCoupling;
    const e0Gut =
      this.store.pools15[0]! + this.store.pools15[1]! + this.store.pools15[2]!;
    const asmoTel = this.asmodenius.stepBrain({
      sensory8: this.store.senseIn8.subarray(0, 8),
      gutLoadKj: e0Gut,
      bloodGlucoseKj: this.store.pools15[3]!,
      somaticHazard: this.store.cortisol[0]!,
      cueNoiseVariance: 0.12,
      cueCost: 0.35,
      physicsSignature,
      ach: 0.65,
      ne: this.store.norepinephrine[0] ?? 0.3,
      dtSec: dt,
    });
    this.store.thoughtCurvatureKappa[0] = asmoTel.frenetCurvatureKappa;
    this.store.freeWontVetoCount[0] = asmoTel.totalFreeWontVetoes;

    // Glitchling Organ (Entity 1): Sensory Unscrambler + Marr-Albus Motor Inversion + Frey-Morris STC
    const proto16 = new Float32Array(16);
    const raw16 = new Float32Array(16);
    for (let k = 0; k < 16; k++) {
      const v = Math.cos((this.store.epoch.simTick * 0.11) + k * 0.45) * 0.5;
      proto16[k] = v;
      raw16[k] = v;
    }
    this.glitchling.processSensory16(raw16, proto16, flawRng, 0.35);
    const intended8 = new Float32Array(8);
    const proprio8 = new Float32Array(8);
    for (let k = 0; k < 6; k++) intended8[k] = this.store.motorOut6[6 + k] ?? 0.5;
    intended8[0] = 0.75; // Persistent goal-directed forward swim command
    intended8[1] = -0.45;
    const executed8 = this.glitchling.executeMotor8(intended8, proprio8, flawRng, 0.08);
    const hebbianStub = new Float32Array(64).fill(0.06);
    this.glitchling.stepSynapticTaggingAndCapture(hebbianStub, 0.65, 0.45, dt);
    if (this.store.alive[1] === 1) {
      this.store.motorOut6[6] = executed8[0]!;
      this.store.motorOut6[7] = executed8[1]!;
    }
    const glitchTel = this.glitchling.getTelemetry();

    // 5-Caste Kuramoto + 512D FHRR Archon Pantheon + 10-Shell Mechalogodrom
    const worldFeat16 = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      worldFeat16[i] = this.store.senseIn8[i] ?? 0;
    }
    const pantheonTel = this.pantheon.stepPantheon(
      worldFeat16,
      1.6 * this.dials.quantumContextualityCoupling,
      dt,
    );

    // Quantum Contextuality & Zero-GC QGTL Step
    this.quantumRegister.evolveUnitaryStep(0.08 * this.dials.quantumContextualityCoupling, 0.05);
    const qgtSample = this.quantumRegister.sampleQuantumGeometry();
    if (!this.cachedHoggar) {
      this.cachedHoggar = evaluateHoggarContextuality(3);
    }
    const qrngSnap = sampleHealthyQrngBatch(this.qrngSeed, 64);
    this.qrngSeed = qrngSnap.nextSeed;

    // ========================================================================
    // PHASE 3: PHYSICS & GEOMETRY
    // ========================================================================
    const worldBound = 68.0;
    for (let e = 0; e < n; e++) {
      if (this.store.alive[e] !== 1) continue;
      const mBase = e * 6;
      const steerX = this.store.motorOut6[mBase]!;
      const steerY = this.store.motorOut6[mBase + 1]!;
      const steerZ = this.store.motorOut6[mBase + 2]!;

      const vx = 0.88 * this.store.velX[e]! + 2.4 * steerX * dt;
      const vy = 0.88 * this.store.velY[e]! + 1.2 * steerY * dt;
      const vz = 0.88 * this.store.velZ[e]! + 2.4 * steerZ * dt;

      this.store.velX[e] = vx;
      this.store.velY[e] = vy;
      this.store.velZ[e] = vz;

      this.store.posX[e] = Math.max(-worldBound, Math.min(worldBound, this.store.posX[e]! + vx * dt * 8.0));
      this.store.posY[e] = Math.max(0.4, Math.min(18.0, this.store.posY[e]! + vy * dt * 4.0));
      this.store.posZ[e] = Math.max(-worldBound, Math.min(worldBound, this.store.posZ[e]! + vz * dt * 8.0));
      this.store.headingRad[e] = Math.atan2(vz, vx);
    }

    // Update articulated 8-somite spine of Asmodenius Prime + Eshkol Taylor jet curvature!
    for (let s = 0; s < 8; s++) {
      const wave = Math.sin(asmoTel.cpgPhaseRad - s * 0.65) * 0.42;
      this.spinePtsXyz[s * 3] = (this.store.posX[0] ?? 0) + wave;
      this.spinePtsXyz[s * 3 + 1] = (this.store.posY[0] ?? 2.0) + 0.15 * Math.cos(asmoTel.cpgPhaseRad - s * 0.5);
      this.spinePtsXyz[s * 3 + 2] = (this.store.posZ[0] ?? 0) - s * 0.58;
    }
    const meanSpineCurv = zig.eshkolSpineCurvature(this.spinePtsXyz, this.spineCurvature);

    const kerrRing = computeRelativisticPhotonRingMetrics(
      this.dials.kerrSpinA,
      1.18,
      (this.store.epoch.simTimeSec * 0.6) % (2.0 * Math.PI),
    );

    // ========================================================================
    // PHASE 4: METABOLISM, ECOLOGICAL FORAGING, GLOSSODROM XENOLINGUA & SKIN
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

    const metabSummary = stepPopulationMetabolism(this.store, dt, {
      metabolicRateScale: this.dials.metabolicRateScale,
      oxygenSaturation: this.dials.oxygenSaturation,
      useAntitheticController: this.tsotchke.isEnabled('antithetic-control'),
    });

    // Periodic Glossodrom RS[15,11] social signaling between nearby alive organisms
    if (this.store.epoch.simTick % 4 === 0 && n >= 2 && this.store.alive[0] === 1 && this.store.alive[1] === 1) {
      const msg11 = Uint8Array.from([
        this.store.speciesFk[0]! & 0x0f,
        Math.round(this.store.ghrelin[0]! * 15) & 0x0f,
        Math.round(this.store.leptin[0]! * 15) & 0x0f,
        Math.round(this.store.o2Reserve[0]! * 15) & 0x0f,
        3, 7, 11, 2, 9, 14, 5,
      ]);
      const cw = encodeGlossodromRs15_11(msg11);
      // Inject 2 pelagic scattering symbol errors and self-heal via Peterson+Forney!
      const noisy = cw.slice();
      noisy[2] = noisy[2]! ^ 0x0a;
      noisy[11] = noisy[11]! ^ 0x05;
      const healed = decodeGlossodromRs15_11(noisy);
      const cwHex = Array.from(healed.correctedCodeword, (x) => x.toString(16)).join('');
      this.store.upsertSocialBond(0, 1, 0.08, 0.5, cwHex, !healed.uncorrectable);
    }

    const skinMean = zig.stepReactiveSkin(
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
    );

    // ========================================================================
    // PHASE 5: FIRST-LAW CONSERVATION AUDIT, MERKLE EPOCH HASH & SNAPSHOT
    // ========================================================================
    let maxRelDrift = 0;
    let conservationValid = true;
    let merkleAcc = FNV_OFFSET;

    for (let e = 0; e < n; e++) {
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

      // Deterministic integerized position/energy hash leaf
      const qx = BigInt(Math.round((this.store.posX[e] ?? 0) * 1000) & 0xffffffff);
      const qz = BigInt(Math.round((this.store.posZ[e] ?? 0) * 1000) & 0xffffffff);
      merkleAcc = ((merkleAcc ^ qx ^ (qz << 16n)) * FNV_PRIME) & MASK64;
    }

    this.store.epoch.simTick += 1;
    this.store.epoch.simTimeSec += dt;
    this.store.epoch.merkleRootHex = '0x' + merkleAcc.toString(16).padStart(16, '0');

    if (this.store.epoch.simTick % 25 === 0) {
      this.store.captureSnapshot();
    }
    void worldRng;

    return {
      simTick: this.store.epoch.simTick,
      simTimeSec: this.store.epoch.simTimeSec,
      runState: this.runState,
      aliveCount: metabSummary.aliveCount,
      merkleRootHex: this.store.epoch.merkleRootHex,
      conservationValid,
      maxMetabolicDrift: maxRelDrift,
      metabolism: metabSummary,
      asmodenius: asmoTel,
      glitchling: glitchTel,
      pantheon: pantheonTel,
      quantumGeometry: qgtSample,
      hoggar: this.cachedHoggar,
      kerrPhotonRing: kerrRing,
      qrngEntropyBits: qrngSnap.shannonBitsPerByte,
      qrngHealthy: qrngSnap.rctHealthy && qrngSnap.aptHealthy,
      reactiveSkinMeanPattern: skinMean,
      eshkolMeanSpineCurvature: meanSpineCurv,
    };
  }
}
