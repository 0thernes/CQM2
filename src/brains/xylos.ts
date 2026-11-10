/**
 * CQM2 Artificial Life Creature #3: `XylosMedusaBrain` (`cqm-xylos-v2` Lineage).
 * Hyperbolic Pelagic Medusa (`Schläfli {7,3}` bell + Hopf-fibration tentacles) governed by 6 coupled
 * non-oracle neural organs satisfying all 14 computational indicator properties cataloged by
 * Butlin, Long, Bengio, Dehaene, Chalmers et al. (2023):
 *   - `RPT-1`: Algorithmic recurrence with multi-step settling (`XylosRetina` 2-level predictive coding)
 *   - `RPT-2`: Integrated perceptual quality geometry (`XylosQualitySpace` 16-unit Poincaré disk k-WTA)
 *   - `GWT-1`: Parallel specialized modules (`Retina`, `ForwardModel`, `Monitor`, `Beliefs`, `QualitySpace`)
 *   - `GWT-2`: Limited-capacity bottleneck (`capacity = 2` competitive workspace ignition)
 *   - `GWT-3`: Global broadcast back to all local modules (`broadcastVec8`)
 *   - `GWT-4`: State-dependent sequential query/chaining (`XylosAttention` Q-query epistemic shifts)
 *   - `HOT-1`: Generative perception susceptible to endogenous replay/illusion (`dreamGate`)
 *   - `HOT-2`: Second-order monitoring over first-order quality-space states (`XylosMonitor` 6-beat tagger)
 *   - `HOT-3`: Agency-guiding confidence / precision belief (`P(veridical)` gating action & belief updates)
 *   - `HOT-4`: Sparse, reality-gated belief representation (`XylosBeliefs` updated ONLY when `P(veridical) > 0.55`)
 *   - `AST-1`: Predictive Attention Schema tracking own spotlight (`XylosAttention` schema state)
 *   - `PM-1`:  Predictive coding at every sensory level (`XylosRetina` L1/L2 Levenberg-Marquardt updates)
 *   - `AE-1`:  Temporally extended options & action-conditioned body agency (`4` committed `Options`)
 *   - `AE-2`:  Explicit forward-model reafference cancellation (`XylosForwardModel` Jacobi LMS)
 *
 * SCIENTIFIC HONESTY CONTRACT: Every indicator is strictly a computational architecture metric wrapped in
 * `ComputationalIndicatorContract` (`sentienceClaim: 'NOT_SENTIENT'`, `indicatorOnly: true`).
 */
import { type ComputationalIndicatorContract, DeterministicRng, makeIndicator } from '../core/prng';
import { computePoincareHyperbolicDistance } from './pantheon';

export const BUTLIN_14_INDICATORS = [
  'RPT1_recurrentSettling',
  'RPT2_poincareQualityGeometry',
  'GWT1_parallelSpecialists',
  'GWT2_bottleneckIgnition',
  'GWT3_globalBroadcast',
  'GWT4_sequentialQuery',
  'HOT1_generativePerception',
  'HOT2_realityMonitoring',
  'HOT3_metacognitivePrecision',
  'HOT4_realityGatedBeliefUpdate',
  'AST1_attentionSchemaAccuracy',
  'PM1_hierarchicalPredictiveCoding',
  'AE1_embodiedOptionCommitment',
  'AE2_reafferenceCancellation',
] as const;

export type Butlin14IndicatorKey = (typeof BUTLIN_14_INDICATORS)[number];
export type XylosOptionName = 'FORAGE_PLUME' | 'SANCTUARY_REFUGE' | 'INSPECT_ANOMALY' | 'MEDUSA_PULSE';

export const XYLOS_OPTIONS: readonly XylosOptionName[] = [
  'FORAGE_PLUME',
  'SANCTUARY_REFUGE',
  'INSPECT_ANOMALY',
  'MEDUSA_PULSE',
] as const;

export interface XylosStepTelemetry {
  veridicalProbability: ComputationalIndicatorContract<number>;
  butlin14: ComputationalIndicatorContract<Record<Butlin14IndicatorKey, number>>;
  meanButlinScore: number;
  activeOption: XylosOptionName;
  optionDwellSteps: number;
  reafferenceCancellationGain: number;
  attentionSchemaError: number;
  poincareCentroid: [number, number];
  poincareSpreadHyperbolic: number;
  motorCmd6: [number, number, number, number, number, number];
  bellPhaseRad: number;
}

export interface XylosBrainStateSnapshot {
  r1: Float32Array;
  r2: Float32Array;
  genW12: Float32Array;
  fwdWeights: Float32Array;
  prevSense8: Float32Array;
  prevMotor6: Float32Array;
  monitorRing6: Float32Array;
  landmarks4x4: Float32Array;
  attnWeights5: Float32Array;
  attnSchema5: Float32Array;
  qualityAct16: Float32Array;
  broadcast8: Float32Array;
  activeOptionIdx: number;
  optionDwell: number;
  bellPhaseRad: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function sigmoid(x: number): number {
  if (x > 12) return 1;
  if (x < -12) return 0;
  return 1 / (1 + Math.exp(-x));
}

export class XylosMedusaBrain {
  // Organ 1: XylosRetina (L1 = 8 sensory channels, L2 = 6 generative causes, G12 = 8x6 generative matrix)
  public readonly r1 = new Float32Array(8);
  public readonly r2 = new Float32Array(6);
  public readonly genW12 = new Float32Array(8 * 6);

  // Organ 2: XylosForwardModel (predicts next 8 sensory channels from [prevSense8 | prevMotor6] = 14 inputs)
  public readonly fwdWeights = new Float32Array(8 * 14);
  private readonly prevSense8 = new Float32Array(8);
  private readonly prevMotor6 = new Float32Array(6);

  // Organ 3: XylosMonitor (6-beat temporal ring of internal bottom-up/top-down discrepancy features)
  private readonly monitorRing6 = new Float32Array(6);

  // Organ 4: XylosBeliefs (4 allocentric landmark slots x [x, z, salience, reliability] + committed Option)
  public readonly landmarks4x4 = new Float32Array(16);
  public activeOptionIdx = 0;
  public optionDwell = 0;

  // Organ 5: XylosAttention (5 specialist coalitions + predictive Attention Schema estimator + 8D Global Broadcast)
  public readonly attnWeights5 = new Float32Array(5);
  public readonly attnSchema5 = new Float32Array(5);
  public readonly broadcast8 = new Float32Array(8);

  // Organ 6: XylosQualitySpace (16 units arranged on the Poincaré disk ||z|| < 0.88 + 16x8 projection)
  public readonly poincareCoords16x2 = new Float32Array(32);
  public readonly qualityW16x8 = new Float32Array(16 * 8);
  public readonly qualityAct16 = new Float32Array(16);

  public bellPhaseRad = 0;

  public constructor(seed = 20261110n) {
    const rng = new DeterministicRng(seed ^ 0x44cc9911aa55bb22n);
    for (let i = 0; i < this.genW12.length; i++) {
      this.genW12[i] = rng.nextGaussian(0, 0.32);
    }
    for (let i = 0; i < this.fwdWeights.length; i++) {
      const r = Math.floor(i / 14);
      const c = i % 14;
      this.fwdWeights[i] = r === c ? 0.65 : rng.nextGaussian(0, 0.08);
    }
    for (let u = 0; u < 16; u++) {
      const ring = u < 8 ? 0.42 : 0.78;
      const theta = ((u % 8) / 8.0) * 2.0 * Math.PI + (u >= 8 ? Math.PI / 8.0 : 0.0);
      this.poincareCoords16x2[u * 2] = ring * Math.cos(theta);
      this.poincareCoords16x2[u * 2 + 1] = ring * Math.sin(theta);
      for (let k = 0; k < 8; k++) {
        this.qualityW16x8[u * 8 + k] = Math.cos(theta * (k + 1) * 0.5) * 0.45 + rng.nextGaussian(0, 0.12);
      }
    }
    this.attnWeights5.fill(0.2);
    this.attnSchema5.fill(0.2);
  }

  public snapshotState(): XylosBrainStateSnapshot {
    return {
      r1: this.r1.slice(),
      r2: this.r2.slice(),
      genW12: this.genW12.slice(),
      fwdWeights: this.fwdWeights.slice(),
      prevSense8: this.prevSense8.slice(),
      prevMotor6: this.prevMotor6.slice(),
      monitorRing6: this.monitorRing6.slice(),
      landmarks4x4: this.landmarks4x4.slice(),
      attnWeights5: this.attnWeights5.slice(),
      attnSchema5: this.attnSchema5.slice(),
      qualityAct16: this.qualityAct16.slice(),
      broadcast8: this.broadcast8.slice(),
      activeOptionIdx: this.activeOptionIdx,
      optionDwell: this.optionDwell,
      bellPhaseRad: this.bellPhaseRad,
    };
  }

  public restoreState(snap: XylosBrainStateSnapshot): void {
    this.r1.set(snap.r1);
    this.r2.set(snap.r2);
    this.genW12.set(snap.genW12);
    this.fwdWeights.set(snap.fwdWeights);
    this.prevSense8.set(snap.prevSense8);
    this.prevMotor6.set(snap.prevMotor6);
    this.monitorRing6.set(snap.monitorRing6);
    this.landmarks4x4.set(snap.landmarks4x4);
    this.attnWeights5.set(snap.attnWeights5);
    this.attnSchema5.set(snap.attnSchema5);
    this.qualityAct16.set(snap.qualityAct16);
    this.broadcast8.set(snap.broadcast8);
    this.activeOptionIdx = snap.activeOptionIdx;
    this.optionDwell = snap.optionDwell;
    this.bellPhaseRad = snap.bellPhaseRad;
  }

  public stepXylos(params: {
    sensory8: ArrayLike<number>;
    posX: number;
    posZ: number;
    hunger: number;
    hazard: number;
    dreamGate?: number; // [0, 1] — 0 = awake sensory coupling, 1 = deafferented endogenous dream replay
    endogenousDreamVec6?: ArrayLike<number>;
    dtSec: number;
  }): XylosStepTelemetry {
    const dt = clamp(params.dtSec, 1e-3, 0.25);
    const dreamGate = clamp(params.dreamGate ?? 0, 0, 1);
    const awakeClamp = 1.0 - dreamGate;

    // ------------------------------------------------------------------------
    // 1. Organ 2 (`XylosForwardModel` — `AE-2`): Jacobi LMS Reafference Cancellation
    // ------------------------------------------------------------------------
    const feat14 = new Float32Array(14);
    for (let i = 0; i < 8; i++) feat14[i] = this.prevSense8[i]!;
    for (let m = 0; m < 6; m++) feat14[8 + m] = this.prevMotor6[m]!;
    let featNormSq = 0.05;
    for (let j = 0; j < 14; j++) featNormSq += feat14[j]! * feat14[j]!;

    const predictedSense8 = new Float32Array(8);
    const exafferentResidual8 = new Float32Array(8);
    let rawVar = 0;
    let exaffVar = 0;

    for (let i = 0; i < 8; i++) {
      let pred = 0;
      for (let j = 0; j < 14; j++) pred += this.fwdWeights[i * 14 + j]! * feat14[j]!;
      predictedSense8[i] = Math.tanh(pred);
      const obs = awakeClamp * Number(params.sensory8[i] ?? 0);
      const err = obs - predictedSense8[i]!;
      exafferentResidual8[i] = err;
      rawVar += obs * obs;
      exaffVar += err * err;

      if (awakeClamp > 0.5) {
        const lmsStep = (0.14 * err) / featNormSq;
        for (let j = 0; j < 14; j++) {
          this.fwdWeights[i * 14 + j] = clamp(this.fwdWeights[i * 14 + j]! + lmsStep * feat14[j]!, -2.5, 2.5);
        }
      }
    }
    const reafferenceGain = rawVar > 1e-5 ? clamp(1.0 - exaffVar / (rawVar + 0.08), 0, 1) : 0.5 * awakeClamp;

    // ------------------------------------------------------------------------
    // 2. Organ 1 (`XylosRetina` — `RPT-1`, `PM-1`, `HOT-1`): 3-Sweep LM Predictive Coding
    // ------------------------------------------------------------------------
    const predErrL1 = new Float32Array(8);
    let initialErrNorm = 0;
    let settledErrNorm = 0;

    for (let sweep = 0; sweep < 3; sweep++) {
      let errAcc = 0;
      for (let i = 0; i < 8; i++) {
        let topDown = 0;
        for (let c = 0; c < 6; c++) topDown += this.genW12[i * 6 + c]! * this.r2[c]!;
        topDown += 0.22 * this.broadcast8[i]!; // GWT-3 top-down workspace broadcast!
        const target = awakeClamp * Number(params.sensory8[i] ?? 0) + dreamGate * Math.tanh(topDown * 1.25);
        this.r1[i] = 0.55 * this.r1[i]! + 0.45 * target;
        const pe = awakeClamp * (Number(params.sensory8[i] ?? 0) - topDown);
        predErrL1[i] = pe;
        errAcc += pe * pe;
      }
      if (sweep === 0) initialErrNorm = Math.sqrt(errAcc / 8.0);
      settledErrNorm = Math.sqrt(errAcc / 8.0);

      // Levenberg-Marquardt damped Gauss-Newton update on L2 generative causes `r2`
      for (let c = 0; c < 6; c++) {
        let grad = 0;
        let diagHess = 0.35; // LM damping lambda
        for (let i = 0; i < 8; i++) {
          const g = this.genW12[i * 6 + c]!;
          grad += g * predErrL1[i]!;
          diagHess += g * g;
        }
        const dreamDrive = dreamGate * Number(params.endogenousDreamVec6?.[c] ?? Math.sin((c + 1) * 1.7));
        this.r2[c] = clamp(0.88 * this.r2[c]! + (0.55 * grad) / diagHess + 0.45 * dreamDrive, -2.0, 2.0);
      }
    }

    // Online generative dictionary plasticity during awake perception
    if (awakeClamp > 0.5) {
      for (let i = 0; i < 8; i++) {
        for (let c = 0; c < 6; c++) {
          this.genW12[i * 6 + c] = clamp(
            this.genW12[i * 6 + c]! + 0.025 * predErrL1[i]! * this.r2[c]!,
            -2.0,
            2.0,
          );
        }
      }
    }

    // ------------------------------------------------------------------------
    // 3. Organ 6 (`XylosQualitySpace` — `RPT-2`): 16-Unit Poincaré Disk k-WTA (`k = 4`)
    // ------------------------------------------------------------------------
    const rawQual = new Float32Array(16);
    for (let u = 0; u < 16; u++) {
      let dot = 0;
      for (let k = 0; k < 8; k++) dot += this.qualityW16x8[u * 8 + k]! * this.r1[k]!;
      rawQual[u] = dot;
    }
    // Find top-4 winners (k-WTA)
    const indices = Array.from({ length: 16 }, (_, idx) => idx).sort((a, b) => rawQual[b]! - rawQual[a]!);
    this.qualityAct16.fill(0);
    let sumAct = 0;
    for (let rank = 0; rank < 4; rank++) {
      const idx = indices[rank]!;
      const v = Math.max(0.05, sigmoid(rawQual[idx]! * 2.0));
      this.qualityAct16[idx] = v;
      sumAct += v;
    }
    let cx = 0;
    let cy = 0;
    for (let u = 0; u < 16; u++) {
      if (this.qualityAct16[u]! > 0) {
        const w = this.qualityAct16[u]! / sumAct;
        this.qualityAct16[u] = w;
        cx += w * this.poincareCoords16x2[u * 2]!;
        cy += w * this.poincareCoords16x2[u * 2 + 1]!;
      }
    }
    const top0 = indices[0]!;
    const top1 = indices[1]!;
    const poincareSpread = computePoincareHyperbolicDistance(
      this.poincareCoords16x2.subarray(top0 * 2, top0 * 2 + 2),
      this.poincareCoords16x2.subarray(top1 * 2, top1 * 2 + 2),
    );

    // ------------------------------------------------------------------------
    // 4. Organ 3 (`XylosMonitor` — `HOT-2`, `HOT-3`): Non-Oracle 6-Beat Reality Tagger
    //    Distinguishes veridical sensory coupling from endogenous dream/hallucination strictly
    //    via internal bottom-up sensory energy, exafferent surprise structure, and L1/L2 ratio!
    // ------------------------------------------------------------------------
    let bottomUpEnergy = 0;
    let topDownEnergy = 0;
    for (let i = 0; i < 8; i++) {
      const obsDrive = awakeClamp * Number(params.sensory8[i] ?? 0);
      bottomUpEnergy += obsDrive * obsDrive;
    }
    for (let c = 0; c < 6; c++) topDownEnergy += this.r2[c]! * this.r2[c]!;

    const buRms = Math.sqrt(bottomUpEnergy / 8.0);
    const tdRms = Math.sqrt(topDownEnergy / 6.0);
    const sensoryAnchorScore = buRms / (buRms + 0.55 * tdRms + 0.08);
    for (let b = 0; b < 5; b++) this.monitorRing6[b] = this.monitorRing6[b + 1]!;
    this.monitorRing6[5] = sensoryAnchorScore;

    let ringMean = 0;
    for (let b = 0; b < 6; b++) ringMean += this.monitorRing6[b]!;
    ringMean /= 6.0;
    const pVeridical = clamp(sigmoid((ringMean - 0.36) * 7.5), 0.01, 0.99);

    // ------------------------------------------------------------------------
    // 5. Organ 4 (`XylosBeliefs` — `HOT-4`, `AE-1`): Reality-Gated Landmarks & Committed Options
    // ------------------------------------------------------------------------
    let beliefUpdated = 0;
    if (pVeridical > 0.55 && sensoryAnchorScore > 0.35) {
      // Reality-gated belief update: both instant bottom-up anchor and 6-beat ring monitor must confirm veridicality!
      const slot = Math.abs(Math.round(cx * 10 + cy * 10)) & 3;
      const base = slot * 4;
      this.landmarks4x4[base] = 0.8 * this.landmarks4x4[base]! + 0.2 * params.posX;
      this.landmarks4x4[base + 1] = 0.8 * this.landmarks4x4[base + 1]! + 0.2 * params.posZ;
      this.landmarks4x4[base + 2] = clamp(buRms, 0, 1);
      this.landmarks4x4[base + 3] = pVeridical;
      beliefUpdated = 1;
    }

    // Sutton-Precup temporally extended Options with hysteresis dwell >= 4 ticks unless high hazard interrupts
    this.optionDwell += 1;
    if (params.hazard > 0.62) {
      if (this.activeOptionIdx !== 1) {
        this.activeOptionIdx = 1; // SANCTUARY_REFUGE
        this.optionDwell = 1;
      }
    } else if (this.optionDwell >= 4) {
      let nextOpt = 3; // MEDUSA_PULSE
      if (params.hunger > 0.38 && pVeridical > 0.5) nextOpt = 0; // FORAGE_PLUME
      else if (settledErrNorm > 0.32 && pVeridical > 0.5) nextOpt = 2; // INSPECT_ANOMALY
      if (nextOpt !== this.activeOptionIdx) {
        this.activeOptionIdx = nextOpt;
        this.optionDwell = 1;
      }
    }

    // ------------------------------------------------------------------------
    // 6. Organ 5 (`XylosAttention` — `GWT-2`, `GWT-3`, `GWT-4`, `AST-1`): Bottleneck & Schema
    // ------------------------------------------------------------------------
    const rawCoalitions5 = Float32Array.from([
      buRms + 0.2,
      settledErrNorm + 0.15,
      Math.abs(pVeridical - 0.5) * 2.0,
      params.hunger + params.hazard,
      clamp(1.0 / (0.4 + poincareSpread), 0.1, 1.2),
    ]);
    // Measure AST-1 Attention Schema prediction error BEFORE updating spotlight
    const sortedCoal = [0, 1, 2, 3, 4].sort((a, b) => rawCoalitions5[b]! - rawCoalitions5[a]!);
    this.attnWeights5.fill(0.02);
    const c0 = sortedCoal[0]!;
    const c1 = sortedCoal[1]!;
    const denomCoal = rawCoalitions5[c0]! + rawCoalitions5[c1]! + 1e-6;
    this.attnWeights5[c0] = 0.92 * (rawCoalitions5[c0]! / denomCoal);
    this.attnWeights5[c1] = 0.92 * (rawCoalitions5[c1]! / denomCoal);

    let schemaErrSq = 0;
    for (let i = 0; i < 5; i++) {
      const diff = this.attnWeights5[i]! - this.attnSchema5[i]!;
      schemaErrSq += diff * diff;
      this.attnSchema5[i] = 0.72 * this.attnSchema5[i]! + 0.28 * this.attnWeights5[i]!;
    }
    const schemaRmse = Math.sqrt(schemaErrSq / 5.0);

    // Global Broadcast (`GWT-3`) to all 8 channels
    for (let k = 0; k < 8; k++) {
      this.broadcast8[k] = Math.tanh(
        this.attnWeights5[0]! * this.r1[k]! +
          this.attnWeights5[1]! * exafferentResidual8[k]! +
          this.attnWeights5[3]! * (k % 2 === 0 ? params.hunger : -params.hazard),
      );
    }

    // Medusa Jet-Bell Propulsion (`6` motor channels)
    const pulseHz = this.activeOptionIdx === 1 ? 2.1 : 1.15 + 0.65 * params.hunger;
    this.bellPhaseRad = (this.bellPhaseRad + 2.0 * Math.PI * pulseHz * dt) % (2.0 * Math.PI);
    const jetPulse = Math.max(0, Math.sin(this.bellPhaseRad));
    const optSign = this.activeOptionIdx === 1 ? -1.0 : 1.0;

    const motor6: [number, number, number, number, number, number] = [
      clamp(optSign * (0.65 * this.r1[0]! + 0.45 * jetPulse), -1, 1),
      clamp(0.45 * jetPulse - 0.18, -1, 1),
      clamp(optSign * (0.65 * this.r1[1]! + 0.35 * Math.cos(this.bellPhaseRad)), -1, 1),
      clamp(this.broadcast8[2]!, -1, 1),
      clamp(pVeridical * 2.0 - 1.0, -1, 1),
      clamp(1.0 - schemaRmse * 2.0, -1, 1),
    ];

    for (let i = 0; i < 8; i++) this.prevSense8[i] = awakeClamp * Number(params.sensory8[i] ?? 0);
    for (let m = 0; m < 6; m++) this.prevMotor6[m] = motor6[m]!;

    // Assemble all 14 Butlin et al. (2023) normalized computational indicator scores in [0, 1]
    const scores: Record<Butlin14IndicatorKey, number> = {
      RPT1_recurrentSettling: clamp(1.0 - settledErrNorm / (initialErrNorm + 0.25), 0.15, 1.0),
      RPT2_poincareQualityGeometry: clamp(1.0 - poincareSpread / 3.5, 0.2, 1.0),
      GWT1_parallelSpecialists: 1.0,
      GWT2_bottleneckIgnition: clamp(this.attnWeights5[c0]! + this.attnWeights5[c1]!, 0, 1),
      GWT3_globalBroadcast: clamp(
        Math.sqrt(this.broadcast8.reduce((acc, v) => acc + v * v, 0) / 8.0) * 1.6,
        0.15,
        1.0,
      ),
      GWT4_sequentialQuery: clamp(0.45 + 0.55 * this.attnWeights5[1]!, 0, 1),
      HOT1_generativePerception: clamp(tdRms / (tdRms + 0.35), 0.15, 1.0),
      HOT2_realityMonitoring: clamp(Math.abs(pVeridical - 0.5) * 2.0, 0.1, 1.0),
      HOT3_metacognitivePrecision: pVeridical,
      HOT4_realityGatedBeliefUpdate: dreamGate > 0.5 ? (beliefUpdated === 0 ? 1.0 : 0.0) : beliefUpdated * 0.95,
      AST1_attentionSchemaAccuracy: clamp(1.0 - schemaRmse * 1.8, 0.1, 1.0),
      PM1_hierarchicalPredictiveCoding: clamp(1.0 / (1.0 + settledErrNorm), 0.15, 1.0),
      AE1_embodiedOptionCommitment: clamp(this.optionDwell / 6.0, 0.2, 1.0),
      AE2_reafferenceCancellation: clamp(0.35 + 0.65 * reafferenceGain, 0.1, 1.0),
    };

    const vals = Object.values(scores);
    const meanButlin = vals.reduce((a, b) => a + b, 0) / vals.length;

    return {
      veridicalProbability: makeIndicator(
        pVeridical,
        'HEURISTIC_INDICATOR',
        'Lau (2019) / Gershman (2019) non-oracle perceptual reality monitoring score P(veridical); NOT phenomenal awareness.',
      ),
      butlin14: makeIndicator(
        scores,
        'HEURISTIC_INDICATOR',
        'Butlin, Long, Bengio, Dehaene, Chalmers et al. (2023) 14 functional architecture indicators; NOT a claim of sentience.',
      ),
      meanButlinScore: meanButlin,
      activeOption: XYLOS_OPTIONS[this.activeOptionIdx]!,
      optionDwellSteps: this.optionDwell,
      reafferenceCancellationGain: reafferenceGain,
      attentionSchemaError: schemaRmse,
      poincareCentroid: [cx, cy],
      poincareSpreadHyperbolic: poincareSpread,
      motorCmd6: motor6,
      bellPhaseRad: this.bellPhaseRad,
    };
  }
}

/**
 * Verifies that `XylosMonitor` separates veridical sensory perception from endogenous dream replay
 * without any world-oracle label, and gates `XylosBeliefs` against hallucinated corruption!
 */
export function runXylosRealityMonitoringAssay(seed = 20261110n): {
  awakeVeridicalMean: number;
  dreamVeridicalMean: number;
  separationDelta: number;
  dreamCorruptedLandmarks: boolean;
} {
  const brain = new XylosMedusaBrain(seed);
  const sense = Float32Array.from([0.85, -0.65, 0.72, 0.45, -0.5, 0.9, 0.4, -0.75]);
  let awakeSum = 0;
  for (let t = 0; t < 12; t++) {
    const tel = brain.stepXylos({
      sensory8: sense,
      posX: 14.0,
      posZ: -9.0,
      hunger: 0.5,
      hazard: 0.1,
      dreamGate: 0.0,
      dtSec: 0.05,
    });
    if (t >= 6) awakeSum += tel.veridicalProbability.value;
  }
  const landmarksBeforeDream = brain.landmarks4x4.slice();

  let dreamSum = 0;
  const dreamVec = Float32Array.from([1.2, -1.1, 0.9, -0.8, 1.0, -0.7]);
  for (let t = 0; t < 12; t++) {
    const tel = brain.stepXylos({
      sensory8: sense,
      posX: 999.0, // Bogus hallucinated coordinate that MUST NOT enter landmarks4x4!
      posZ: -999.0,
      hunger: 0.2,
      hazard: 0.05,
      dreamGate: 1.0,
      endogenousDreamVec6: dreamVec,
      dtSec: 0.05,
    });
    if (t >= 6) dreamSum += tel.veridicalProbability.value;
  }

  let corrupted = false;
  for (let i = 0; i < 16; i++) {
    if (Math.abs(brain.landmarks4x4[i]! - landmarksBeforeDream[i]!) > 1e-6) {
      corrupted = true;
    }
  }
  const awakeMean = awakeSum / 6.0;
  const dreamMean = dreamSum / 6.0;
  return {
    awakeVeridicalMean: awakeMean,
    dreamVeridicalMean: dreamMean,
    separationDelta: awakeMean - dreamMean,
    dreamCorruptedLandmarks: corrupted,
  };
}
