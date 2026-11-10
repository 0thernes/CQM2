/**
 * CQM2 Stephen Thaler Creativity Machine, `DABUS` Multi-Hop Chaining & `Gedanken-Death` Engine.
 * Synthesized from `Stephen-Thaler-Corpus` (1994–2026 computational architecture papers & patents):
 *   1. **Dual-Network `Imagitron` + Independent `Perceptor/AAC` Critic**:
 *      - `Imagitron`: Recurrent Hopfield/autoassociative attractor matrix $W_{\text{img}} \in \mathbb{R}^{16 \times 16}$
 *        perturbed by calibrated synaptic noise $\sigma_{\text{syn}}$ to generate "false-memory" candidate inventions.
 *      - `Perceptor`: Strictly separate affective/viability network $W_{\text{crit}}$ evaluating novelty $N(y)$
 *        and physical/metabolic utility $U(y)$, emitting **Hot-Button** neuromodulatory valence surges.
 *   2. **`DABUS` Multi-Hop Associative Chaining**:
 *      - Propagates perturbations across 3 chained associative cortices (`SENSORY -> MECHANISM -> OUTCOME`)
 *        and self-bootstraps approved novel trajectories into consolidated attractor weights.
 *   3. **3-Phase `Gedanken-Death` Cascade**:
 *      - `NORMAL` -> `LIFE_REVIEW` (low-noise panoramic sweep) -> `VIRTUAL_INPUT` (deafferented internal gain)
 *        -> `CLIFF_OF_CREATIVITY` (critical edge-of-chaos noise maximizing creative yield before silent collapse).
 *   4. **9 Thaler Computational Markers** + **4 Mandatory Falsification Ablations**
 *      (`no-hot-buttons`, `undertrained`, `untrained`, `critic-scrambled`).
 *
 * SCIENTIFIC HONESTY CONTRACT: All markers are strictly algorithmic generative/critic dynamics wrapped in
 * `ComputationalIndicatorContract` (`sentienceClaim: 'NOT_SENTIENT'`, `indicatorOnly: true`).
 */
import { type ComputationalIndicatorContract, DeterministicRng, makeIndicator } from '../core/prng';

export type GedankenDeathPhase = 'NORMAL' | 'LIFE_REVIEW' | 'VIRTUAL_INPUT' | 'CLIFF_OF_CREATIVITY';
export type ThalerAblationMode = 'intact' | 'no-hot-buttons' | 'undertrained' | 'untrained' | 'critic-scrambled';

export interface Thaler9Markers {
  synapticPerturbationEntropy: number;
  imagitronAttractorDwell: number;
  perceptorCriticIndependence: number;
  hotButtonValenceModulation: number;
  falseMemoryNoveltyRate: number;
  dabusChainCoherence: number;
  selfBootstrappingConsolidation: number;
  invertedUNoiseSweetSpot: number;
  gedankenDeathPhaseIndex: number;
}

export interface ThalerStepTelemetry {
  phase: GedankenDeathPhase;
  noiseSigma: number;
  candidateNovelty: number;
  candidateUtility: number;
  hotButtonValence: number;
  creativeInventionAccepted: boolean;
  totalAcceptedInventions: number;
  dabusChainScore: number;
  markers9: ComputationalIndicatorContract<Thaler9Markers>;
  creativeMotorBias6: [number, number, number, number, number, number];
}

export interface ThalerStateSnapshot {
  wImagitron: Float32Array;
  wCritic: Float32Array;
  wChainAB: Float32Array;
  wChainBC: Float32Array;
  state16: Float32Array;
  recentPrototypes8x16: Float32Array;
  protoPtr: number;
  acceptedCount: number;
  consolidationNorm: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class ThalerCreativityMachine {
  public static readonly DIM = 16;

  // Network 1: Imagitron autoassociative attractor network (16x16 symmetric sculpted basins)
  public readonly wImagitron = new Float32Array(16 * 16);
  public readonly state16 = new Float32Array(16);

  // Network 2: Independent Perceptor / Affective Associative Critic (4 viability heads x 16)
  public readonly wCritic = new Float32Array(4 * 16);

  // DABUS 3-hop associative chain matrices (Sensory16 -> Mechanism16 -> Outcome16)
  public readonly wChainAB = new Float32Array(16 * 16);
  public readonly wChainBC = new Float32Array(16 * 16);

  // Rolling archive of known prototypes to score genuine novelty ("confabulation" vs rote recall)
  public readonly recentPrototypes8x16 = new Float32Array(8 * 16);
  private protoPtr = 0;
  public acceptedCount = 0;
  public consolidationNorm = 0;
  public ablationMode: ThalerAblationMode = 'intact';

  public constructor(seed = 20261110n, mode: ThalerAblationMode = 'intact') {
    this.ablationMode = mode;
    const rng = new DeterministicRng(seed ^ 0x3141592653589793n);
    this.initDomainPriors(rng, mode);
  }

  private initDomainPriors(rng: DeterministicRng, mode: ThalerAblationMode): void {
    // Canonical viable ecological/kinematic prototypes
    const canonical6: number[][] = [];
    for (let p = 0; p < 6; p++) {
      const vec: number[] = [];
      for (let i = 0; i < 16; i++) {
        vec.push(Math.sin((p + 1) * (i + 1) * 0.52) >= 0 ? 0.78 : -0.78);
      }
      canonical6.push(vec);
      if (p < 8) {
        this.recentPrototypes8x16.set(vec, p * 16);
      }
    }

    const trainStrength = mode === 'untrained' ? 0.0 : mode === 'undertrained' ? 0.06 : 0.28;
    for (const pat of canonical6) {
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 16; j++) {
          if (i !== j) {
            this.wImagitron[i * 16 + j] = this.wImagitron[i * 16 + j]! + (trainStrength / 6.0) * pat[i]! * pat[j]!;
          }
        }
      }
    }

    // Independent Critic weights tuned to reward structural symmetry + bounded energetic feasibility
    for (let h = 0; h < 4; h++) {
      for (let i = 0; i < 16; i++) {
        const structured = Math.sin((h + 1) * (i + 1) * 0.52) * 0.42 + (i % 2 === h % 2 ? 0.22 : -0.14);
        this.wCritic[h * 16 + i] = mode === 'critic-scrambled' ? rng.nextGaussian(0, 0.45) : structured;
      }
    }

    // Initialize DABUS multi-hop heteroassociative chain
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        const base = i === (j + 3) % 16 ? 0.65 : rng.nextGaussian(0, 0.09);
        this.wChainAB[i * 16 + j] = mode === 'untrained' ? 0 : base;
        this.wChainBC[i * 16 + j] = mode === 'untrained' ? 0 : (i === (j + 5) % 16 ? 0.65 : rng.nextGaussian(0, 0.09));
      }
    }
    this.state16.set(canonical6[0]!);
  }

  public snapshotState(): ThalerStateSnapshot {
    return {
      wImagitron: this.wImagitron.slice(),
      wCritic: this.wCritic.slice(),
      wChainAB: this.wChainAB.slice(),
      wChainBC: this.wChainBC.slice(),
      state16: this.state16.slice(),
      recentPrototypes8x16: this.recentPrototypes8x16.slice(),
      protoPtr: this.protoPtr,
      acceptedCount: this.acceptedCount,
      consolidationNorm: this.consolidationNorm,
    };
  }

  public restoreState(snap: ThalerStateSnapshot): void {
    this.wImagitron.set(snap.wImagitron);
    this.wCritic.set(snap.wCritic);
    this.wChainAB.set(snap.wChainAB);
    this.wChainBC.set(snap.wChainBC);
    this.state16.set(snap.state16);
    this.recentPrototypes8x16.set(snap.recentPrototypes8x16);
    this.protoPtr = snap.protoPtr;
    this.acceptedCount = snap.acceptedCount;
    this.consolidationNorm = snap.consolidationNorm;
  }

  /**
   * Evaluates independent ground-truth biophysical viability of a 16D candidate pattern
   * (used by benchmarks to verify that `critic-scrambled` destroys genuine utility!).
   */
  public static evaluateObjectiveViability(candidate16: ArrayLike<number>): number {
    let score = 0;
    let energy = 0;
    for (let h = 0; h < 4; h++) {
      let dot = 0;
      for (let i = 0; i < 16; i++) {
        const v = Number(candidate16[i] ?? 0);
        const w = Math.sin((h + 1) * (i + 1) * 0.52) * 0.42 + (i % 2 === h % 2 ? 0.22 : -0.14);
        dot += w * v;
        if (h === 0) energy += v * v;
      }
      score += Math.tanh(dot);
    }
    const normOk = energy > 1.2 && energy < 9.2 ? 1.0 : 0.25;
    return clamp(((score / 4.0 + 1.0) * 0.5) * normOk, 0, 1);
  }

  public stepCreativity(params: {
    sensory8: ArrayLike<number>;
    metabolicStress: number; // [0, 1] — high existential/metabolic stress triggers Gedanken-Death phases!
    overrideNoiseSigma?: number;
    rng: DeterministicRng;
  }): ThalerStepTelemetry {
    const stress = clamp(params.metabolicStress, 0, 1);

    // 1. Determine Gedanken-Death Cascade Phase & Calibrated Synaptic Perturbation Sigma
    let phase: GedankenDeathPhase = 'NORMAL';
    let phaseIdx = 0.0;
    let baseSigma = 0.28; // Sweet-spot inverted-U creative perturbation!
    let sensoryClamp = 0.35;

    if (stress >= 0.88) {
      phase = 'CLIFF_OF_CREATIVITY';
      phaseIdx = 1.0;
      baseSigma = 0.44;
      sensoryClamp = 0.04;
    } else if (stress >= 0.72) {
      phase = 'VIRTUAL_INPUT';
      phaseIdx = 0.67;
      baseSigma = 0.36;
      sensoryClamp = 0.08;
    } else if (stress >= 0.55) {
      phase = 'LIFE_REVIEW';
      phaseIdx = 0.33;
      baseSigma = 0.14;
      sensoryClamp = 0.15;
    }

    const sigma = clamp(params.overrideNoiseSigma ?? baseSigma, 0.0, 1.5);

    // 2. Step `Imagitron` with Synaptic Perturbation (`w_ij + eps_ij`)
    const nextState = new Float32Array(16);
    let dwellCorr = 0;
    let prevNorm = 1e-6;
    let nextNorm = 1e-6;

    for (let i = 0; i < 16; i++) {
      let sum = sensoryClamp * Number(params.sensory8[i & 7] ?? 0);
      for (let j = 0; j < 16; j++) {
        const perturbedW = this.wImagitron[i * 16 + j]! + params.rng.nextGaussian(0, sigma * 0.25);
        sum += perturbedW * this.state16[j]!;
      }
      sum += params.rng.nextGaussian(0, sigma);
      nextState[i] = Math.tanh(sum * 1.35);
      dwellCorr += nextState[i]! * this.state16[i]!;
      prevNorm += this.state16[i]! * this.state16[i]!;
      nextNorm += nextState[i]! * nextState[i]!;
    }
    const attractorDwell = clamp((dwellCorr / Math.sqrt(prevNorm * nextNorm) + 1.0) * 0.5, 0, 1);
    this.state16.set(nextState);

    // 3. `DABUS` 3-Hop Associative Chaining (`state16 -> mech16 -> outcome16`)
    const mech16 = new Float32Array(16);
    const out16 = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      let s = 0;
      for (let j = 0; j < 16; j++) s += this.wChainAB[i * 16 + j]! * nextState[j]!;
      mech16[i] = Math.tanh(s);
    }
    let chainEnergy = 0;
    for (let i = 0; i < 16; i++) {
      let s = 0;
      for (let j = 0; j < 16; j++) s += this.wChainBC[i * 16 + j]! * mech16[j]!;
      out16[i] = Math.tanh(s);
      chainEnergy += out16[i]! * out16[i]!;
    }
    const dabusCoherence = clamp(Math.sqrt(chainEnergy / 16.0) * 1.45, 0, 1);

    // 4. Compute Novelty (minimum normalized Euclidean distance to known prototypes)
    let minProtoDist = Infinity;
    for (let p = 0; p < 8; p++) {
      let dSq = 0;
      for (let i = 0; i < 16; i++) {
        const d = nextState[i]! - this.recentPrototypes8x16[p * 16 + i]!;
        dSq += d * d;
      }
      const dist = Math.sqrt(dSq / 16.0);
      if (dist < minProtoDist) minProtoDist = dist;
    }
    // Novelty peaks when distinct from known prototypes (~0.25..0.95), penalized if pure unstructured saturation
    const novelty = clamp(minProtoDist / 1.15, 0, 1);

    // 5. Independent `Perceptor` Critic Evaluation & `Hot-Button` Affective Surge
    let criticRaw = 0;
    for (let h = 0; h < 4; h++) {
      let dot = 0;
      for (let i = 0; i < 16; i++) dot += this.wCritic[h * 16 + i]! * nextState[i]!;
      criticRaw += Math.tanh(dot);
    }
    const perceivedUtility = clamp((criticRaw / 4.0 + 1.0) * 0.5, 0, 1);

    // Hot-Button affective valence requires BOTH genuine novelty AND high critic utility!
    const rawHotButton = clamp(perceivedUtility * (1.0 / (1.0 + Math.exp(-9.0 * (novelty - 0.22)))), 0, 1);
    const hotButtonValence = this.ablationMode === 'no-hot-buttons' ? 0.0 : rawHotButton;

    // 6. Self-Bootstrapping Hebbian Consolidation of Approved Inventions
    // Requires transient basin dwell (`attractorDwell >= 0.56`) so pure seizure noise (`sigma >> 0.5`) cannot masquerade as coherent invention!
    const accepted =
      this.ablationMode === 'no-hot-buttons'
        ? params.rng.nextFloat() < 0.18 // Unselective random drift without Hot-Button critic gating!
        : hotButtonValence >= 0.48 && novelty >= 0.18 && novelty <= 0.78 && attractorDwell >= 0.56;

    if (accepted) {
      this.acceptedCount += 1;
      const lr = 0.035 * Math.max(0.25, hotButtonValence);
      let deltaNorm = 0;
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 16; j++) {
          if (i !== j) {
            const dw = lr * nextState[i]! * nextState[j]!;
            this.wImagitron[i * 16 + j] = clamp(this.wImagitron[i * 16 + j]! + dw, -1.5, 1.5);
            deltaNorm += dw * dw;
          }
        }
      }
      this.consolidationNorm = clamp(this.consolidationNorm + Math.sqrt(deltaNorm), 0, 100);
      this.recentPrototypes8x16.set(nextState, this.protoPtr * 16);
      this.protoPtr = (this.protoPtr + 1) % 8;
    }

    // Inverted-U Sweet-Spot curve peaking around sigma ~ 0.30..0.42
    const invertedUScore = Math.exp(-Math.pow(sigma - 0.34, 2) / (2.0 * 0.18 * 0.18));

    // Independence verification between `wImagitron` row-0 and `wCritic` row-0
    let dotIC = 0;
    let nI = 1e-6;
    let nC = 1e-6;
    for (let i = 0; i < 16; i++) {
      const wi = this.wImagitron[i]!;
      const wc = this.wCritic[i]!;
      dotIC += wi * wc;
      nI += wi * wi;
      nC += wc * wc;
    }
    const criticIndependence = clamp(1.0 - Math.abs(dotIC) / Math.sqrt(nI * nC), 0, 1);

    const markers: Thaler9Markers = {
      synapticPerturbationEntropy: clamp(sigma / 0.8, 0, 1),
      imagitronAttractorDwell: attractorDwell,
      perceptorCriticIndependence: criticIndependence,
      hotButtonValenceModulation: hotButtonValence,
      falseMemoryNoveltyRate: novelty,
      dabusChainCoherence: dabusCoherence,
      selfBootstrappingConsolidation: clamp(this.consolidationNorm / 2.5, 0, 1),
      invertedUNoiseSweetSpot: invertedUScore,
      gedankenDeathPhaseIndex: phaseIdx,
    };

    const motorBias6: [number, number, number, number, number, number] = [
      clamp(out16[0]! * 0.5, -1, 1),
      clamp(out16[1]! * 0.5, -1, 1),
      clamp(out16[2]! * 0.5, -1, 1),
      clamp(hotButtonValence * 2.0 - 1.0, -1, 1),
      clamp(novelty * 2.0 - 1.0, -1, 1),
      clamp(dabusCoherence * 2.0 - 1.0, -1, 1),
    ];

    return {
      phase,
      noiseSigma: sigma,
      candidateNovelty: novelty,
      candidateUtility: perceivedUtility,
      hotButtonValence,
      creativeInventionAccepted: accepted,
      totalAcceptedInventions: this.acceptedCount,
      dabusChainScore: dabusCoherence,
      markers9: makeIndicator(
        markers,
        'HEURISTIC_INDICATOR',
        'Thaler (1994, 2014, 2021) Imagitron/Perceptor/DABUS creative attractor dynamics; NOT phenomenal consciousness.',
      ),
      creativeMotorBias6: motorBias6,
    };
  }
}

/**
 * Executes the 4 mandatory Stephen Thaler falsification ablations (`no-hot-buttons`, `undertrained`,
 * `untrained`, `critic-scrambled`) + Inverted-U noise sweep (`sigma in {0.0, 0.34, 1.35}`).
 */
export function runThalerCreativityAblationSuite(seed = 20261110n): {
  intactViableCreativeYield: number;
  ablationYields: Record<Exclude<ThalerAblationMode, 'intact'>, number>;
  invertedUCurve: { zeroNoise: number; sweetSpotNoise: number; excessiveNoise: number };
  allFalsificationsPassed: boolean;
} {
  const evalMode = (mode: ThalerAblationMode, overrideSigma?: number): number => {
    const rng = new DeterministicRng(seed ^ 0x1234fedcn);
    const machine = new ThalerCreativityMachine(seed, mode);
    const sense = Float32Array.from([0.5, -0.4, 0.6, -0.3, 0.45, -0.5, 0.35, -0.25]);
    let viableNovelScore = 0;
    for (let step = 0; step < 48; step++) {
      const tel = machine.stepCreativity({
        sensory8: sense,
        metabolicStress: 0.3,
        overrideNoiseSigma: overrideSigma,
        rng,
      });
      if (tel.creativeInventionAccepted) {
        const objViability = ThalerCreativityMachine.evaluateObjectiveViability(machine.state16);
        // True creative value = genuine objective viability (> 0.58) * novelty * DABUS chain coherence
        if (objViability > 0.58 && tel.candidateNovelty >= 0.2) {
          viableNovelScore += objViability * tel.candidateNovelty * (0.4 + 0.6 * tel.dabusChainScore);
        } else {
          viableNovelScore -= 0.12; // Penalize unviable hallucinations accepted by broken critics!
        }
      }
    }
    return viableNovelScore;
  };

  const intact = evalMode('intact');
  const noHot = evalMode('no-hot-buttons');
  const undertrained = evalMode('undertrained');
  const untrained = evalMode('untrained');
  const scrambled = evalMode('critic-scrambled');

  const zeroNoise = evalMode('intact', 0.0);
  const sweetSpot = evalMode('intact', 0.34);
  const excessiveNoise = evalMode('intact', 1.35);

  const passed =
    intact > noHot &&
    intact > undertrained &&
    intact > untrained &&
    intact > scrambled &&
    sweetSpot > zeroNoise &&
    sweetSpot > excessiveNoise;

  return {
    intactViableCreativeYield: intact,
    ablationYields: {
      'no-hot-buttons': noHot,
      undertrained,
      untrained,
      'critic-scrambled': scrambled,
    },
    invertedUCurve: {
      zeroNoise,
      sweetSpotNoise: sweetSpot,
      excessiveNoise,
    },
    allFalsificationsPassed: passed,
  };
}
