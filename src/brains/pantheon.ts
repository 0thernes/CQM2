/**
 * CQM2 Swarm Pantheon, 5 Archon SuperMinds (512D FHRR Phasor HDC + Modern Hopfield) & 10-Shell Mechalogodrom.
 * Unifies:
 *   1. **5-Caste Kuramoto Oscillator Network** (`EXPLORER`, `HARVESTER`, `GUARDIAN`, `ARCHITECT`, `ORACLE`)
 *      with exact **Cholesky $5 \times 5$ Determinantal Point Process (`DPP`)** log-det repulsive behavioral diversity!
 *   2. **5 Archon SuperMinds**: 512-dimensional Fourier Holographic Reduced Representation (`FHRR`) Phasor
 *      Hyperdimensional Computing (`HDC`) + 64-slot Modern Continuous Hopfield associative memory ($\beta = 8$).
 *   3. **10-Shell Central Mechalogodrom**: Concentric planetary/cosmic cognitive shells with Bi-Poo STDP phase coupling.
 *   4. **Poincaré Ball Hyperbolic Phylogeny Metric**: $d_{\mathbb{B}}(u, v) = \operatorname{arcosh}\!\left(1 + \frac{2\|u-v\|^2}{(1-\|u\|^2)(1-\|v\|^2)}\right)$.
 */
import { type ComputationalIndicatorContract, DeterministicRng, makeIndicator } from '../core/prng';
import type { CasteRole } from '../erp/relational-store';

export const CASTE_ROLES: readonly CasteRole[] = [
  'EXPLORER',
  'HARVESTER',
  'GUARDIAN',
  'ARCHITECT',
  'ORACLE',
] as const;

export interface PantheonSnapshot {
  kuramotoOrderParameterR: ComputationalIndicatorContract<number>;
  castePhasesRad: Record<CasteRole, number>;
  dppDiversityDet: number;
  archonHopfieldEnergies: number[];
  mechalogodromShells10: number[];
}

/**
 * Exact Cholesky determinant $\det(L) = \prod_i L_{ii}^2$ of a symmetric positive-definite $5 \times 5$ Gram matrix $K + \epsilon I$.
 * Measures Determinantal Point Process (`DPP`) volume spanned by the 5 caste behavioral feature vectors!
 */
export function computeCholesky5x5Determinant(vectors5xD: Float64Array, dimD: number): number {
  const K = new Float64Array(25);
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j <= i; j++) {
      let dot = 0;
      let ni = 0;
      let nj = 0;
      for (let d = 0; d < dimD; d++) {
        const vi = vectors5xD[i * dimD + d]!;
        const vj = vectors5xD[j * dimD + d]!;
        dot += vi * vj;
        ni += vi * vi;
        nj += vj * vj;
      }
      const denom = Math.sqrt(Math.max(1e-9, ni * nj));
      const val = dot / denom + (i === j ? 0.05 : 0.0);
      K[i * 5 + j] = val;
      K[j * 5 + i] = val;
    }
  }

  const L = new Float64Array(25);
  let det = 1.0;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = K[i * 5 + j]!;
      for (let k = 0; k < j; k++) {
        sum -= L[i * 5 + k]! * L[j * 5 + k]!;
      }
      if (i === j) {
        const diag = Math.sqrt(Math.max(1e-9, sum));
        L[i * 5 + i] = diag;
        det *= diag * diag;
      } else {
        L[i * 5 + j] = sum / L[j * 5 + j]!;
      }
    }
  }
  return det;
}

/**
 * Exact Poincaré ball hyperbolic distance $d_{\mathbb{B}}(u, v)$ for phylogenetic lineage trees.
 */
export function computePoincareHyperbolicDistance(u: ArrayLike<number>, v: ArrayLike<number>): number {
  const n = Math.min(u.length, v.length);
  let normUSq = 0;
  let normVSq = 0;
  let diffSq = 0;
  for (let i = 0; i < n; i++) {
    const ui = Number(u[i] ?? 0);
    const vi = Number(v[i] ?? 0);
    normUSq += ui * ui;
    normVSq += vi * vi;
    const d = ui - vi;
    diffSq += d * d;
  }
  const uClamped = Math.min(0.999, normUSq);
  const vClamped = Math.min(0.999, normVSq);
  const arg = 1.0 + (2.0 * diffSq) / ((1.0 - uClamped) * (1.0 - vClamped));
  return Math.acosh(Math.max(1.0, arg));
}

/**
 * 512-Dimensional Fourier Holographic Reduced Representation (`FHRR`) Phasor Archon + Modern Hopfield Memory.
 */
export class ArchonSuperMind {
  public static readonly HDC_DIM = 512;
  public static readonly HOPFIELD_SLOTS = 32;

  public readonly role: CasteRole;
  public readonly stateAngles = new Float32Array(ArchonSuperMind.HDC_DIM);
  public readonly memoryBank = new Float32Array(ArchonSuperMind.HOPFIELD_SLOTS * 16);
  private writePtr = 0;

  public constructor(role: CasteRole, rng: DeterministicRng) {
    this.role = role;
    for (let i = 0; i < ArchonSuperMind.HDC_DIM; i++) {
      this.stateAngles[i] = rng.nextRange(-Math.PI, Math.PI);
    }
    for (let i = 0; i < this.memoryBank.length; i++) {
      this.memoryBank[i] = rng.nextGaussian(0, 0.35);
    }
  }

  /**
   * Circular FHRR phase binding ($\theta_{\text{bound}} = (\theta_A + \theta_B) \bmod 2\pi$) + Modern Continuous Hopfield retrieval!
   */
  public stepArchon(worldFeature16: Float32Array, dtSec: number): { hopfieldEnergy: number; directiveVector8: Float32Array } {
    // 1. Bind incoming feature projection into 512D FHRR phasor angles
    for (let d = 0; d < ArchonSuperMind.HDC_DIM; d++) {
      const f = worldFeature16[d & 15]!;
      const nextAngle = this.stateAngles[d]! + dtSec * 1.25 * f * Math.cos(d * 0.137);
      this.stateAngles[d] = ((nextAngle + Math.PI) % (2.0 * Math.PI)) - Math.PI;
    }

    // 2. Modern Continuous Hopfield Network retrieval (Ramsauer et al., 2021; inverse temperature beta = 6.0)
    const beta = 6.0;
    const logits = new Float64Array(ArchonSuperMind.HOPFIELD_SLOTS);
    let maxLogit = -Infinity;
    for (let s = 0; s < ArchonSuperMind.HOPFIELD_SLOTS; s++) {
      let dot = 0;
      const base = s * 16;
      for (let k = 0; k < 16; k++) {
        dot += this.memoryBank[base + k]! * worldFeature16[k]!;
      }
      const l = beta * dot;
      logits[s] = l;
      if (l > maxLogit) maxLogit = l;
    }

    let sumExp = 0;
    const attn = new Float64Array(ArchonSuperMind.HOPFIELD_SLOTS);
    for (let s = 0; s < ArchonSuperMind.HOPFIELD_SLOTS; s++) {
      const e = Math.exp(logits[s]! - maxLogit);
      attn[s] = e;
      sumExp += e;
    }

    const retrieved16 = new Float32Array(16);
    for (let s = 0; s < ArchonSuperMind.HOPFIELD_SLOTS; s++) {
      const p = attn[s]! / Math.max(1e-12, sumExp);
      const base = s * 16;
      for (let k = 0; k < 16; k++) {
        retrieved16[k] = retrieved16[k]! + p * this.memoryBank[base + k]!;
      }
    }

    // Store salient episodes in circular Hopfield slot
    let featNorm = 0;
    for (let k = 0; k < 16; k++) featNorm += worldFeature16[k]! * worldFeature16[k]!;
    if (featNorm > 0.25) {
      const dst = this.writePtr * 16;
      for (let k = 0; k < 16; k++) {
        this.memoryBank[dst + k] = 0.85 * this.memoryBank[dst + k]! + 0.15 * worldFeature16[k]!;
      }
      this.writePtr = (this.writePtr + 1) % ArchonSuperMind.HOPFIELD_SLOTS;
    }

    // Modern Hopfield Lyapunov energy E = -lse(beta, X^T xi) + 0.5 * ||xi||^2
    const lse = (maxLogit + Math.log(Math.max(1e-12, sumExp))) / beta;
    const hopfieldEnergy = -lse + 0.5 * featNorm;

    const directive8 = new Float32Array(8);
    for (let k = 0; k < 8; k++) {
      directive8[k] = Math.tanh(retrieved16[k]! + 0.35 * Math.cos(this.stateAngles[k * 32]!));
    }
    return { hopfieldEnergy, directiveVector8: directive8 };
  }
}

export class MechalogodromPantheon {
  public readonly archons: ArchonSuperMind[];
  public readonly castePhases = new Float64Array(5);
  public readonly casteNaturalFreqs = Float64Array.from([1.15, 0.92, 0.78, 1.04, 1.31]);
  public readonly shellAmplitudes10 = new Float64Array(10);
  public readonly shellWeights10 = new Float64Array(10);

  public constructor(seed = 20261110n) {
    const rng = new DeterministicRng(seed ^ 0x7711aa99n);
    this.archons = CASTE_ROLES.map((role) => new ArchonSuperMind(role, rng));
    for (let i = 0; i < 5; i++) {
      this.castePhases[i] = (i / 5.0) * 2.0 * Math.PI;
    }
    for (let s = 0; s < 10; s++) {
      this.shellAmplitudes10[s] = 0.5 + 0.2 * Math.sin(s * 0.7);
      this.shellWeights10[s] = 0.45;
    }
  }

  public stepPantheon(worldFeature16: Float32Array, couplingK: number, dtSec: number): PantheonSnapshot {
    const dt = Math.max(1e-3, Math.min(0.25, dtSec));
    const K = Math.max(0.0, Math.min(4.0, couplingK));

    // 1. 5-Caste Kuramoto phase synchronization: dtheta_i/dt = omega_i + (K/5) * sum_j sin(theta_j - theta_i)
    const nextPhases = new Float64Array(5);
    for (let i = 0; i < 5; i++) {
      let interaction = 0;
      for (let j = 0; j < 5; j++) {
        interaction += Math.sin(this.castePhases[j]! - this.castePhases[i]!);
      }
      nextPhases[i] = (this.castePhases[i]! + dt * (this.casteNaturalFreqs[i]! + (K / 5.0) * interaction)) % (2.0 * Math.PI);
    }
    this.castePhases.set(nextPhases);

    let sumCos = 0;
    let sumSin = 0;
    for (let i = 0; i < 5; i++) {
      sumCos += Math.cos(this.castePhases[i]!);
      sumSin += Math.sin(this.castePhases[i]!);
    }
    const orderR = Math.hypot(sumCos / 5.0, sumSin / 5.0);

    // 2. Step all 5 Archon SuperMinds & evaluate Cholesky 5x5 DPP behavioral diversity
    const vectors5x8 = new Float64Array(5 * 8);
    const energies: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = this.archons[i]!.stepArchon(worldFeature16, dt);
      energies.push(res.hopfieldEnergy);
      for (let d = 0; d < 8; d++) {
        vectors5x8[i * 8 + d] = res.directiveVector8[d]! + 0.15 * Math.cos(this.castePhases[i]! + d);
      }
    }
    const dppDet = computeCholesky5x5Determinant(vectors5x8, 8);

    // 3. 10-Shell Central Mechalogodrom with Bi-Poo STDP phase-difference plasticity
    for (let s = 0; s < 10; s++) {
      const prevShell = this.shellAmplitudes10[(s + 9) % 10]!;
      const curShell = this.shellAmplitudes10[s]!;
      // Bi-Poo asymmetric temporal difference proxy
      const deltaTiming = prevShell - curShell;
      const stdpDelta =
        deltaTiming >= 0
          ? 0.015 * Math.exp(-deltaTiming / 0.4)
          : -0.018 * Math.exp(deltaTiming / 0.4);
      this.shellWeights10[s] = Math.max(0.05, Math.min(1.5, this.shellWeights10[s]! + dt * stdpDelta));
      this.shellAmplitudes10[s] = Math.tanh(
        0.78 * curShell + 0.28 * this.shellWeights10[s]! * prevShell + 0.16 * orderR * Math.sin(s * 0.6 + this.castePhases[s % 5]!),
      );
    }

    const phaseMap = {} as Record<CasteRole, number>;
    for (let i = 0; i < 5; i++) {
      phaseMap[CASTE_ROLES[i]!] = this.castePhases[i]!;
    }

    return {
      kuramotoOrderParameterR: makeIndicator(
        orderR,
        'CALIBRATED_BIOPHYSICAL',
        'Kuramoto (1975) macroscopic phase-coherence order parameter R in [0, 1]; NOT collective sentience.',
      ),
      castePhasesRad: phaseMap,
      dppDiversityDet: dppDet,
      archonHopfieldEnergies: energies,
      mechalogodromShells10: Array.from(this.shellAmplitudes10),
    };
  }
}
