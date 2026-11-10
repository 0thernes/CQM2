/**
 * CQM2 Glitchling Congenital Fault, Non-Oracle Compensatory Neuroplasticity & Sleep-Replay Engine.
 * Synthesizes `glitchling-jam` (`Passes 1–13`) on an isolated `'flaw'` PRNG substream:
 *   1. **4 Congenital Flaws**: `FLAW_SCRAMBLE` (`bit 0`), `FLAW_LEAKY` (`bit 1`),
 *      `FLAW_BACKWARDS` (`bit 2`), and `FLAW_MISFIRE` (`bit 3`).
 *   2. **Non-Oracle Marr-Albus Cerebellar Organ**: Learns forward consequence Jacobian `estJacobian8`
 *      strictly by correlating motor babbling commands with observed kinematic outcomes (`zero` access to `flawMask`!),
 *      inverting `FLAW_BACKWARDS` motor polarity online.
 *   3. **Gated-DeltaNet Fast-Weight Unscrambler** ($16 \times 16$ $S_t$ associative delta rule).
 *   4. **Frey-Morris Synaptic Tagging & Capture (`STC`)** rescuing memories from `FLAW_LEAKY`.
 *   5. **36-Neuron Head-Direction (`HD`) Ring Attractor**, **64D `FHRR` Spatial Map**, **16-Slot Modern Hopfield**,
 *      and **Borbély Two-Process `WAKE / NREM / REM` Sleep-Dream Replay**.
 */
import { DeterministicRng } from '../core/prng';
import type { SleepStageCode } from '../erp/relational-store';
import { getZigBridge } from '../native/zig-bridge';

export const FLAW_NONE = 0;
export const FLAW_SCRAMBLE = 1 << 0;
export const FLAW_LEAKY = 1 << 1;
export const FLAW_BACKWARDS = 1 << 2;
export const FLAW_MISFIRE = 1 << 3;

export interface GlitchlingTelemetry {
  flawMask: number;
  activeFlawNames: string[];
  cerebellarAdaptationNorm: number;
  learnedForwardJacobianMean: number;
  deltaNetAlignmentRmse: number;
  stcConsolidatedFraction: number;
  intendedMotorVec: [number, number, number];
  executedMotorVec: [number, number, number];
  kinematicAlignmentCosine: number;
  hdRingPeakAngleRad: number;
  sleepStage: SleepStageCode;
  sleepPressureS: number;
  dreamReplayEvents: number;
}

export interface GlitchlingStateSnapshot {
  flawMask: number;
  compensationEnabled: boolean;
  purkinjePfWeights: Float32Array;
  estJacobian8: Float32Array;
  deltaNetState256: Float32Array;
  earlyWeights: Float32Array;
  synapticTags: Float32Array;
  lateConsolidatedWeights: Float32Array;
  proteinPrpLevel: number;
  hdRing36: Float32Array;
  fhrrPlace64: Float32Array;
  hopfieldEpisodes16x16: Float32Array;
  hopfieldPtr: number;
  sleepPressureS: number;
  circadianPhaseRad: number;
  sleepStage: SleepStageCode;
  dreamReplayEvents: number;
  babbleStepCount: number;
}

export function decodeFlawNames(mask: number): string[] {
  const names: string[] = [];
  if (mask & FLAW_SCRAMBLE) names.push('scramble');
  if (mask & FLAW_LEAKY) names.push('leaky');
  if (mask & FLAW_BACKWARDS) names.push('backwards');
  if (mask & FLAW_MISFIRE) names.push('misfire');
  return names;
}

export class GlitchlingNeuroplasticityOrgan {
  public flawMask: number;
  public compensationEnabled = true;

  public readonly scramblePerm16 = new Uint8Array(16);

  // Organ 1: Non-Oracle Marr-Albus Cerebellum + Forward Consequence Jacobian Estimator
  public readonly granuleBasis = new Float32Array(256 * 16);
  public readonly purkinjePfWeights = new Float32Array(8 * 256);
  public readonly estJacobian8 = new Float32Array(8);
  private readonly cmdProprio16 = new Float32Array(16);
  private readonly climbingErr8 = new Float32Array(8);
  private readonly cerebellarCorr8 = new Float32Array(8);
  private babbleStepCount = 0;

  // Organ 2: Gated-DeltaNet 16x16 Fast-Weight Matrix S_t
  public readonly deltaNetState256 = new Float32Array(16 * 16);
  private readonly scrambledKey16 = new Float32Array(16);
  private readonly alignedSense16 = new Float32Array(16);

  // Organ 3: Frey-Morris Synaptic Tagging & Capture (`STC`)
  public readonly synapticCount: number;
  public readonly earlyWeights: Float32Array;
  public readonly synapticTags: Float32Array;
  public readonly lateConsolidatedWeights: Float32Array;
  public proteinPrpLevel = 0.0;

  // Organ 4: 36-Neuron HD Ring Attractor + 64D FHRR Place Code + 16-Slot Hopfield + Borbély Sleep/Dream
  public readonly hdRing36 = new Float32Array(36);
  public readonly fhrrPlace64 = new Float32Array(64);
  public readonly hopfieldEpisodes16x16 = new Float32Array(16 * 16);
  private hopfieldPtr = 0;
  public sleepPressureS = 0.22;
  public circadianPhaseRad = 0.0;
  public sleepStage: SleepStageCode = 0;
  public dreamReplayEvents = 0;

  private lastCerebellarNorm = 0;
  private lastDeltaRmse = 0;
  private lastIntended: [number, number, number] = [0, 0, 0];
  private lastExecuted: [number, number, number] = [0, 0, 0];

  public constructor(flawRng: DeterministicRng, flawMask = FLAW_NONE, synapticCount = 64) {
    this.flawMask = flawMask & 0x0f;
    this.synapticCount = Math.max(8, synapticCount);
    this.earlyWeights = new Float32Array(this.synapticCount);
    this.synapticTags = new Float32Array(this.synapticCount);
    this.lateConsolidatedWeights = new Float32Array(this.synapticCount);

    for (let i = 0; i < 16; i++) this.scramblePerm16[i] = i;
    for (let i = 15; i > 0; i--) {
      const j = flawRng.nextInt(0, i);
      const tmp = this.scramblePerm16[i]!;
      this.scramblePerm16[i] = this.scramblePerm16[j]!;
      this.scramblePerm16[j] = tmp;
    }

    for (let i = 0; i < this.granuleBasis.length; i++) {
      this.granuleBasis[i] = Math.sin((i + 1) * 2.3999632297) * 0.55;
    }
    // Naive un-oracled forward Jacobian prior (+0.15 assumes normal positive actuator polarity)
    this.estJacobian8.fill(0.15);

    for (let i = 0; i < 16; i++) {
      this.deltaNetState256[i * 16 + i] = 1.0;
    }
    for (let n = 0; n < 36; n++) {
      const ang = (n / 36.0) * 2.0 * Math.PI;
      this.hdRing36[n] = Math.exp(-2.5 * (1.0 - Math.cos(ang)));
    }
  }

  public snapshotState(): GlitchlingStateSnapshot {
    return {
      flawMask: this.flawMask,
      compensationEnabled: this.compensationEnabled,
      purkinjePfWeights: this.purkinjePfWeights.slice(),
      estJacobian8: this.estJacobian8.slice(),
      deltaNetState256: this.deltaNetState256.slice(),
      earlyWeights: this.earlyWeights.slice(),
      synapticTags: this.synapticTags.slice(),
      lateConsolidatedWeights: this.lateConsolidatedWeights.slice(),
      proteinPrpLevel: this.proteinPrpLevel,
      hdRing36: this.hdRing36.slice(),
      fhrrPlace64: this.fhrrPlace64.slice(),
      hopfieldEpisodes16x16: this.hopfieldEpisodes16x16.slice(),
      hopfieldPtr: this.hopfieldPtr,
      sleepPressureS: this.sleepPressureS,
      circadianPhaseRad: this.circadianPhaseRad,
      sleepStage: this.sleepStage,
      dreamReplayEvents: this.dreamReplayEvents,
      babbleStepCount: this.babbleStepCount,
    };
  }

  public restoreState(snap: GlitchlingStateSnapshot): void {
    this.flawMask = snap.flawMask;
    this.compensationEnabled = snap.compensationEnabled;
    this.purkinjePfWeights.set(snap.purkinjePfWeights);
    this.estJacobian8.set(snap.estJacobian8);
    this.deltaNetState256.set(snap.deltaNetState256);
    this.earlyWeights.set(snap.earlyWeights);
    this.synapticTags.set(snap.synapticTags);
    this.lateConsolidatedWeights.set(snap.lateConsolidatedWeights);
    this.proteinPrpLevel = snap.proteinPrpLevel;
    this.hdRing36.set(snap.hdRing36);
    this.fhrrPlace64.set(snap.fhrrPlace64);
    this.hopfieldEpisodes16x16.set(snap.hopfieldEpisodes16x16);
    this.hopfieldPtr = snap.hopfieldPtr;
    this.sleepPressureS = snap.sleepPressureS;
    this.circadianPhaseRad = snap.circadianPhaseRad;
    this.sleepStage = snap.sleepStage;
    this.dreamReplayEvents = snap.dreamReplayEvents;
    this.babbleStepCount = snap.babbleStepCount;
  }

  public processSensory16(
    trueWorldSense16: Float32Array,
    expectedThalamicPrototype16: Float32Array,
    flawRng: DeterministicRng,
    betaLearn = 0.35,
  ): Float32Array {
    for (let i = 0; i < 16; i++) {
      const srcIdx = (this.flawMask & FLAW_SCRAMBLE) !== 0 ? this.scramblePerm16[i]! : i;
      let val = trueWorldSense16[srcIdx] ?? 0;
      if ((this.flawMask & FLAW_MISFIRE) !== 0 && flawRng.nextFloat() < 0.12) {
        val = flawRng.nextGaussian(0, 0.55);
      }
      this.scrambledKey16[i] = val;
    }

    if (!this.compensationEnabled || (this.flawMask & FLAW_SCRAMBLE) === 0) {
      this.alignedSense16.set(this.scrambledKey16);
      let errSq = 0;
      for (let i = 0; i < 16; i++) {
        const d = this.alignedSense16[i]! - (expectedThalamicPrototype16[i] ?? 0);
        errSq += d * d;
      }
      this.lastDeltaRmse = Math.sqrt(errSq / 16.0);
      return this.alignedSense16;
    }

    let normSq = 0;
    for (let i = 0; i < 16; i++) normSq += this.scrambledKey16[i]! * this.scrambledKey16[i]!;
    const scale = normSq > 1e-6 ? 1.0 / Math.sqrt(normSq) : 1.0;
    const normKey = new Float32Array(16);
    for (let i = 0; i < 16; i++) normKey[i] = this.scrambledKey16[i]! * scale;

    const zig = getZigBridge();
    this.lastDeltaRmse = zig.stepDeltaNetFastWeights(
      this.deltaNetState256,
      normKey,
      expectedThalamicPrototype16,
      this.alignedSense16,
      0.998,
      betaLearn,
    );
    return this.alignedSense16;
  }

  /**
   * Opaque physical spinal/muscular plant (`FLAW_BACKWARDS` + `FLAW_MISFIRE` live ONLY here in the body!).
   */
  private runOpaquePhysicalBodyPlant(preCompensated8: Float32Array, flawRng: DeterministicRng): Float32Array {
    const executed = new Float32Array(8);
    const bodyPolarity = (this.flawMask & FLAW_BACKWARDS) !== 0 ? -1.0 : 1.0;
    for (let i = 0; i < 8; i++) {
      let rawPlant = bodyPolarity * preCompensated8[i]!;
      if ((this.flawMask & FLAW_MISFIRE) !== 0 && flawRng.nextFloat() < 0.08) {
        rawPlant *= -0.35;
      }
      executed[i] = Math.max(-2.0, Math.min(2.0, rawPlant));
    }
    return executed;
  }

  /**
   * Non-Oracle Motor Execution & Cerebellar Consequence Adaptation:
   * Infers actuator Jacobian `estJacobian8` strictly from `(preCompensated, observedWorldDisplacement)`
   * + decaying motor babbling `m_babb`, with ZERO access to `this.flawMask`!
   */
  public executeMotor8(
    intendedCmd8: Float32Array,
    proprioception8: Float32Array,
    flawRng: DeterministicRng,
    etaClimbingFiber = 0.08,
  ): Float32Array {
    this.babbleStepCount += 1;
    for (let i = 0; i < 8; i++) {
      this.cmdProprio16[i] = intendedCmd8[i] ?? 0;
      this.cmdProprio16[8 + i] = proprioception8[i] ?? 0;
    }

    const zig = getZigBridge();
    if (this.compensationEnabled) {
      zig.stepCerebellumMarrAlbus(
        this.granuleBasis,
        this.purkinjePfWeights,
        this.cmdProprio16,
        this.climbingErr8,
        this.cerebellarCorr8,
        0.0,
      );
    } else {
      this.cerebellarCorr8.fill(0);
    }

    const preComp8 = new Float32Array(8);
    const babbleAmp = this.compensationEnabled ? 0.08 / Math.sqrt(1.0 + 0.15 * this.babbleStepCount) : 0.0;
    for (let i = 0; i < 8; i++) {
      const babb = babbleAmp * Math.sin(this.babbleStepCount * 1.9 + i * 1.1);
      preComp8[i] = (intendedCmd8[i] ?? 0) + this.cerebellarCorr8[i]! + babb;
    }

    // Physical plant produces observable kinematic velocity/displacement `executed`
    const executed = this.runOpaquePhysicalBodyPlant(preComp8, flawRng);

    // NON-ORACLE Forward Model LMS Update: learn d(executed)/d(preComp) strictly from sensorimotor observation!
    for (let i = 0; i < 8; i++) {
      const u = preComp8[i]!;
      const obsY = executed[i]!;
      if (this.compensationEnabled && Math.abs(u) > 1e-3) {
        const predY = this.estJacobian8[i]! * u;
        const fwdErr = obsY - predY;
        const nlmsGain = (0.42 * u) / (u * u + 0.04);
        this.estJacobian8[i] = Math.max(-1.5, Math.min(1.5, this.estJacobian8[i]! + nlmsGain * fwdErr));
      }
      const inferredSign = this.estJacobian8[i]! >= 0 ? 1.0 : -1.0;
      this.climbingErr8[i] = inferredSign * ((intendedCmd8[i] ?? 0) - obsY);
    }

    if (this.compensationEnabled && etaClimbingFiber > 0) {
      this.lastCerebellarNorm = zig.stepCerebellumMarrAlbus(
        this.granuleBasis,
        this.purkinjePfWeights,
        this.cmdProprio16,
        this.climbingErr8,
        this.cerebellarCorr8,
        etaClimbingFiber,
      );
    }

    this.lastIntended = [intendedCmd8[0] ?? 0, intendedCmd8[1] ?? 0, intendedCmd8[2] ?? 0];
    this.lastExecuted = [executed[0]!, executed[1]!, executed[2]!];
    return executed;
  }

  public stepSynapticTaggingAndCapture(
    hebbianDelta: Float32Array,
    dopamineBurst: number,
    norepinephrineAlert: number,
    dtSec: number,
  ): Float32Array {
    const dt = Math.max(1e-3, dtSec);
    const earlyDecayRate = (this.flawMask & FLAW_LEAKY) !== 0 ? 1.85 : 0.08;
    const earlyKeep = Math.exp(-earlyDecayRate * dt);
    const tagKeep = Math.exp(-0.22 * dt);

    const nremBoost = this.sleepStage === 1 ? 0.45 : 0.0;
    const neuromodDrive = Math.max(0, dopamineBurst) + 0.65 * Math.max(0, norepinephrineAlert) + nremBoost;
    if (this.compensationEnabled && neuromodDrive > 0.45) {
      this.proteinPrpLevel = Math.min(1.0, this.proteinPrpLevel + 0.85 * neuromodDrive * dt);
    } else {
      this.proteinPrpLevel = Math.max(0.0, this.proteinPrpLevel - 0.15 * dt);
    }

    const totalEffective = new Float32Array(this.synapticCount);
    const n = Math.min(this.synapticCount, hebbianDelta.length);

    for (let i = 0; i < this.synapticCount; i++) {
      const dw = i < n ? hebbianDelta[i]! : 0;
      let ew = this.earlyWeights[i]! * earlyKeep + dw;
      ew = Math.max(-2.5, Math.min(2.5, ew));
      this.earlyWeights[i] = ew;

      let tag = this.synapticTags[i]! * tagKeep;
      if (Math.abs(ew) > 0.18 || Math.abs(dw) > 0.08) {
        tag = Math.min(1.0, Math.max(tag, Math.min(1.0, Math.abs(ew) * 1.6)));
      }
      this.synapticTags[i] = tag;

      let lw = this.lateConsolidatedWeights[i]!;
      if (this.compensationEnabled && tag > 0.15 && this.proteinPrpLevel > 0.2) {
        const captureRate = 1.45 * tag * this.proteinPrpLevel * dt;
        lw = Math.max(-3.0, Math.min(3.0, lw + captureRate * (ew - 0.1 * lw)));
      } else {
        lw *= Math.exp(-0.0015 * dt);
      }
      this.lateConsolidatedWeights[i] = lw;
      totalEffective[i] = ew + lw;
    }

    return totalEffective;
  }

  /**
   * Advances the 36-neuron Head-Direction (`HD`) ring attractor, 64D FHRR spatial place code,
   * 16-slot Hopfield episodic buffer, and Borbély Two-Process (`WAKE / NREM / REM`) sleep-dream cycle!
   */
  public stepSpatialAndSleep(params: {
    angularVelRadPerSec: number;
    posX: number;
    posZ: number;
    episode16: Float32Array;
    salience: number;
    dtSec: number;
    flawRng: DeterministicRng;
  }): SleepStageCode {
    const dt = Math.max(1e-3, Math.min(0.25, params.dtSec));

    // 1. 36-Neuron Head-Direction Ring Attractor velocity integration
    const shiftBins = (params.angularVelRadPerSec * dt * 36.0) / (2.0 * Math.PI);
    const nextRing = new Float32Array(36);
    let maxVal = 1e-6;
    for (let i = 0; i < 36; i++) {
      const srcPos = (((i - shiftBins) % 36) + 36) % 36;
      const i0 = Math.floor(srcPos);
      const frac = srcPos - i0;
      const i1 = (i0 + 1) % 36;
      const interp = (1.0 - frac) * this.hdRing36[i0]! + frac * this.hdRing36[i1]!;
      // Mexican-hat local excitation / global inhibition
      const left = this.hdRing36[(i + 35) % 36]!;
      const right = this.hdRing36[(i + 1) % 36]!;
      const v = Math.max(0, 0.78 * interp + 0.15 * (left + right) - 0.04);
      nextRing[i] = v;
      if (v > maxVal) maxVal = v;
    }
    for (let i = 0; i < 36; i++) this.hdRing36[i] = nextRing[i]! / maxVal;

    // 2. 64D FHRR Spatial Grid/Place Phasor Binding
    for (let d = 0; d < 64; d++) {
      const kx = Math.cos(d * 0.6180339887) * 0.12;
      const kz = Math.sin(d * 0.6180339887) * 0.12;
      this.fhrrPlace64[d] = (((params.posX * kx + params.posZ * kz + Math.PI) % (2.0 * Math.PI)) + 2.0 * Math.PI) % (2.0 * Math.PI) - Math.PI;
    }

    // 3. Store salient awake experiences into 16-slot Hopfield episodic memory
    if (this.sleepStage === 0 && params.salience > 0.35) {
      this.hopfieldEpisodes16x16.set(params.episode16.subarray(0, 16), this.hopfieldPtr * 16);
      this.hopfieldPtr = (this.hopfieldPtr + 1) % 16;
    }

    // 4. Borbély Two-Process Sleep Architecture (`Process S` homeostat + `Process C` circadian clock)
    this.circadianPhaseRad = (this.circadianPhaseRad + dt * 0.18) % (2.0 * Math.PI);
    const circadianWakeDrive = Math.sin(this.circadianPhaseRad);

    if (this.sleepStage === 0) {
      this.sleepPressureS = Math.min(1.0, this.sleepPressureS + 0.045 * dt);
      if (this.sleepPressureS - 0.18 * circadianWakeDrive > 0.82) {
        this.sleepStage = 1; // Enter NREM Slow-Wave Sleep
      }
    } else if (this.sleepStage === 1) {
      this.sleepPressureS = Math.max(0.0, this.sleepPressureS - 0.11 * dt);
      if (this.sleepPressureS < 0.42) {
        this.sleepStage = 2; // Transition NREM -> REM Dream Replay!
      }
    } else {
      this.sleepPressureS = Math.max(0.0, this.sleepPressureS - 0.08 * dt);
      // REM Dream Replay: reactivate stored Hopfield episode through DeltaNet offline!
      const slot = Math.max(0, (this.hopfieldPtr + 15) % 16);
      const dreamEp = this.hopfieldEpisodes16x16.subarray(slot * 16, slot * 16 + 16);
      this.processSensory16(dreamEp, dreamEp, params.flawRng, 0.18);
      this.dreamReplayEvents += 1;
      if (this.sleepPressureS < 0.18) {
        this.sleepStage = 0; // Awaken refreshed!
      }
    }
    return this.sleepStage;
  }

  public getTelemetry(): GlitchlingTelemetry {
    let consolidatedCount = 0;
    for (let i = 0; i < this.synapticCount; i++) {
      if (Math.abs(this.lateConsolidatedWeights[i]!) > 0.15) consolidatedCount++;
    }
    let jacMean = 0;
    for (let i = 0; i < 8; i++) jacMean += this.estJacobian8[i]!;
    jacMean /= 8.0;

    let peakIdx = 0;
    let peakVal = -1;
    for (let i = 0; i < 36; i++) {
      if (this.hdRing36[i]! > peakVal) {
        peakVal = this.hdRing36[i]!;
        peakIdx = i;
      }
    }

    const [ix, iy, iz] = this.lastIntended;
    const [ex, ey, ez] = this.lastExecuted;
    const inNorm = Math.hypot(ix, iy, iz);
    const exNorm = Math.hypot(ex, ey, ez);
    const cosine = inNorm > 1e-6 && exNorm > 1e-6 ? (ix * ex + iy * ey + iz * ez) / (inNorm * exNorm) : 1.0;

    return {
      flawMask: this.flawMask,
      activeFlawNames: decodeFlawNames(this.flawMask),
      cerebellarAdaptationNorm: this.lastCerebellarNorm,
      learnedForwardJacobianMean: jacMean,
      deltaNetAlignmentRmse: this.lastDeltaRmse,
      stcConsolidatedFraction: consolidatedCount / this.synapticCount,
      intendedMotorVec: this.lastIntended,
      executedMotorVec: this.lastExecuted,
      kinematicAlignmentCosine: cosine,
      hdRingPeakAngleRad: (peakIdx / 36.0) * 2.0 * Math.PI,
      sleepStage: this.sleepStage,
      sleepPressureS: this.sleepPressureS,
      dreamReplayEvents: this.dreamReplayEvents,
    };
  }
}
