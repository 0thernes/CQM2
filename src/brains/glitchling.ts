/**
 * CQM2 Glitchling Congenital Fault & Compensatory Neuroplasticity Engine.
 * Integrates all 4 congenital flaws from `glitchling-jam` (`scramble`, `leaky`, `backwards`, `misfire`)
 * on an isolated `'flaw'` PRNG substream, paired with 3 biologically grounded compensatory organs:
 *   1. **Marr-Albus Cerebellar Forward-Inverse Organ** (`16 -> 256 -> 8` Purkinje climbing-fiber LTD/LTP)
 *      -> Dynamically learns to invert `FLAW_BACKWARDS` motor polarity online!
 *   2. **Gated-DeltaNet Fast-Weight Associative Unscrambler** ($16 \times 16$ $S_t$ delta rule)
 *      -> Dynamically aligns `FLAW_SCRAMBLE` permuted sensory channels to thalamic prototypes!
 *   3. **Frey-Morris Synaptic Tagging & Capture (`STC`)**
 *      -> Consolidates tagged early-LTP synapses into decay-immune late-LTP when Dopamine/NE surges,
 *         rescuing core memories under `FLAW_LEAKY` catastrophic weight decay!
 */
import { DeterministicRng } from '../core/prng';
import { getZigBridge } from '../native/zig-bridge';

export const FLAW_NONE = 0;
export const FLAW_SCRAMBLE = 1 << 0; // Fixed congenital sensory channel permutation
export const FLAW_LEAKY = 1 << 1; // Rapid passive synaptic weight decay (tau ~ 4s without STC)
export const FLAW_BACKWARDS = 1 << 2; // Inverted motor command sign (-u)
export const FLAW_MISFIRE = 1 << 3; // Stochastic axonal conduction drop / noise burst

export interface GlitchlingTelemetry {
  flawMask: number;
  activeFlawNames: string[];
  cerebellarAdaptationNorm: number;
  deltaNetAlignmentRmse: number;
  stcConsolidatedFraction: number;
  intendedMotorVec: [number, number, number];
  executedMotorVec: [number, number, number];
  kinematicAlignmentCosine: number;
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

  // Congenital sensory permutation over 16 channels (fixed at birth from isolated flaw RNG!)
  public readonly scramblePerm16 = new Uint8Array(16);

  // Organ 1: Marr-Albus Cerebellum (256x16 fixed granule basis + 8x256 plastic Purkinje weights)
  public readonly granuleBasis = new Float32Array(256 * 16);
  public readonly purkinjePfWeights = new Float32Array(8 * 256);
  private readonly cmdProprio16 = new Float32Array(16);
  private readonly climbingErr8 = new Float32Array(8);
  private readonly cerebellarCorr8 = new Float32Array(8);

  // Organ 2: Gated-DeltaNet 16x16 Fast-Weight Matrix S_t
  public readonly deltaNetState256 = new Float32Array(16 * 16);
  private readonly scrambledKey16 = new Float32Array(16);
  private readonly alignedSense16 = new Float32Array(16);

  // Organ 3: Frey-Morris Synaptic Tagging & Capture (`STC`) over N core cortical weights
  public readonly synapticCount: number;
  public readonly earlyWeights: Float32Array;
  public readonly synapticTags: Float32Array;
  public readonly lateConsolidatedWeights: Float32Array;
  public proteinPrpLevel = 0.0;

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

    // Deterministic derangement / permutation for FLAW_SCRAMBLE
    for (let i = 0; i < 16; i++) this.scramblePerm16[i] = i;
    // Rotate/shuffle so channel i != i
    for (let i = 15; i > 0; i--) {
      const j = flawRng.nextInt(0, i); // strictly < i => guaranteed non-identity!
      const tmp = this.scramblePerm16[i]!;
      this.scramblePerm16[i] = this.scramblePerm16[j]!;
      this.scramblePerm16[j] = tmp;
    }

    // Initialize fixed pseudorandom orthogonalized granule expansion basis
    for (let i = 0; i < this.granuleBasis.length; i++) {
      this.granuleBasis[i] = Math.sin((i + 1) * 2.3999632297) * 0.55;
    }

    // Initialize DeltaNet S_0 as identity
    for (let i = 0; i < 16; i++) {
      this.deltaNetState256[i * 16 + i] = 1.0;
    }
  }

  /**
   * Applies congenital `FLAW_SCRAMBLE` + `FLAW_MISFIRE` to raw 16-channel sensory input,
   * then runs Gated-DeltaNet fast-weight alignment when compensation is enabled.
   */
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
        val = flawRng.nextGaussian(0, 0.65);
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

    // Normalize key energy so DeltaNet associative projection is contractive and rapidly converges!
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
   * Executes motor command through congenital `FLAW_BACKWARDS` + `FLAW_MISFIRE`,
   * corrected online by the Marr-Albus Cerebellar Purkinje organ!
   */
  public executeMotor8(
    intendedCmd8: Float32Array,
    proprioception8: Float32Array,
    flawRng: DeterministicRng,
    etaClimbingFiber = 0.08,
  ): Float32Array {
    for (let i = 0; i < 8; i++) {
      this.cmdProprio16[i] = intendedCmd8[i] ?? 0;
      this.cmdProprio16[8 + i] = proprioception8[i] ?? 0;
    }

    const zig = getZigBridge();
    if (this.compensationEnabled) {
      // Pure forward pass first (eta = 0) to get Purkinje feedforward motor pre-compensation
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

    const executed = new Float32Array(8);
    const polarity = (this.flawMask & FLAW_BACKWARDS) !== 0 ? -1.0 : 1.0;

    for (let i = 0; i < 8; i++) {
      const preCompensated = (intendedCmd8[i] ?? 0) + this.cerebellarCorr8[i]!;
      let rawPlant = polarity * preCompensated;
      if ((this.flawMask & FLAW_MISFIRE) !== 0 && flawRng.nextFloat() < 0.08) {
        rawPlant *= -0.4;
      }
      executed[i] = Math.max(-2.0, Math.min(2.0, rawPlant));
      // Inferior olive climbing fiber reports signed discrepancy: desired - executed, mapped through plant polarity!
      // Because plant multiplies by `polarity`, pushing `preCompensated` in direction `polarity * (intended - executed)` drives executed -> intended!
      this.climbingErr8[i] = polarity * ((intendedCmd8[i] ?? 0) - executed[i]!);
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

  /**
   * Frey-Morris Synaptic Tagging & Capture (`STC`) step:
   * Under `FLAW_LEAKY`, `earlyWeights` decay rapidly (`85%/s`), destroying un-consolidated memories.
   * Salient Hebbian events set `synapticTags[i]`, and tonic/phasic neuromodulators (`DA + NE`) synthesize
   * Plasticity-Related Proteins (`PRP`) that capture tagged traces into `lateConsolidatedWeights`!
   */
  public stepSynapticTaggingAndCapture(
    hebbianDelta: Float32Array,
    dopamineBurst: number,
    norepinephrineAlert: number,
    dtSec: number,
  ): Float32Array {
    const dt = Math.max(1e-3, dtSec);
    const earlyDecayRate = (this.flawMask & FLAW_LEAKY) !== 0 ? 1.85 : 0.08;
    const earlyKeep = Math.exp(-earlyDecayRate * dt);
    const tagKeep = Math.exp(-0.22 * dt); // Synaptic tags persist much longer (~4.5s window)

    // PRP synthesis threshold triggered by salient Dopamine + Norepinephrine surprise
    const neuromodDrive = Math.max(0, dopamineBurst) + 0.65 * Math.max(0, norepinephrineAlert);
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

      // Set synaptic tag whenever transient weight change crosses threshold
      let tag = this.synapticTags[i]! * tagKeep;
      if (Math.abs(ew) > 0.18 || Math.abs(dw) > 0.08) {
        tag = Math.min(1.0, Math.max(tag, Math.min(1.0, Math.abs(ew) * 1.6)));
      }
      this.synapticTags[i] = tag;

      // Capture into late consolidated structural spine weight when both Tag and PRP are present!
      let lw = this.lateConsolidatedWeights[i]!;
      if (this.compensationEnabled && tag > 0.15 && this.proteinPrpLevel > 0.2) {
        const captureRate = 1.45 * tag * this.proteinPrpLevel * dt;
        lw = Math.max(-3.0, Math.min(3.0, lw + captureRate * (ew - 0.1 * lw)));
      } else {
        // Late LTP structural decay is ~1000x slower than early LTP!
        lw *= Math.exp(-0.0015 * dt);
      }
      this.lateConsolidatedWeights[i] = lw;
      totalEffective[i] = ew + lw;
    }

    return totalEffective;
  }

  public getTelemetry(): GlitchlingTelemetry {
    let consolidatedCount = 0;
    for (let i = 0; i < this.synapticCount; i++) {
      if (Math.abs(this.lateConsolidatedWeights[i]!) > 0.15) consolidatedCount++;
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
      deltaNetAlignmentRmse: this.lastDeltaRmse,
      stcConsolidatedFraction: consolidatedCount / this.synapticCount,
      intendedMotorVec: this.lastIntended,
      executedMotorVec: this.lastExecuted,
      kinematicAlignmentCosine: cosine,
    };
  }
}
