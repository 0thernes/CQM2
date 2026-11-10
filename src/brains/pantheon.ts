/**
 * CQM2 Swarm Pantheon, 5 Archon SuperMinds (512D FHRR Phasor HDC + Modern Hopfield),
 * Micromagnetic LLG Spin Reservoir & 10-Shell Mechalogodrom.
 * Unifies:
 *   1. **5-Caste Kuramoto Oscillator Network** (`EXPLORER`, `HARVESTER`, `GUARDIAN`, `ARCHITECT`, `ORACLE`)
 *      with exact **Cholesky $5 \times 5$ Determinantal Point Process (`DPP`)** log-det repulsive behavioral diversity!
 *   2. **5 Archon SuperMinds**: 512-dimensional Fourier Holographic Reduced Representation (`FHRR`) Phasor
 *      Hyperdimensional Computing (`HDC`) + Modern Continuous Hopfield associative memory, emitting live
 *      6-channel caste behavioral directives (`casteDirectives`).
 *   3. **Landau-Lifshitz-Gilbert (`LLG`) 16-Spin Micromagnetic Reservoir** (`spin_based_neural_network`).
 *   4. **10-Shell Central Mechalogodrom** with Bi-Poo STDP phase coupling + Poincaré Hyperbolic Phylogeny.
 */
import { type ComputationalIndicatorContract, DeterministicRng, makeIndicator } from '../core/prng';
import type { CasteRole, SpeciesLineageRecord } from '../erp/relational-store';
import { getZigBridge } from '../native/zig-bridge';

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
  casteDirectives: Record<CasteRole, [number, number, number, number, number, number]>;
  dppDiversityDet: number;
  archonHopfieldEnergies: number[];
  mechalogodromShells10: number[];
  llgMeanMagnetizationZ: number;
  phylogenyMeanHyperbolicDist: number;
}

export interface PantheonStateSnapshot {
  castePhases: Float64Array;
  shellAmplitudes10: Float64Array;
  shellWeights10: Float64Array;
  spinsXyz48: Float32Array;
  archonAngles: Float32Array[];
  archonBanks: Float32Array[];
  archonWritePtrs: number[];
}

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
 * Embeds extant `SpeciesLineage` records onto the 2D Poincaré disk ($\|z\| < 0.92$) by coalescent depth & hue
 * and computes mean pairwise hyperbolic divergence.
 */
export function computeSpeciesPhylogenyHyperbolicTree(species: Iterable<SpeciesLineageRecord>): {
  meanHyperbolicDist: number;
  embeddings: Array<{ speciesId: number; uv: [number, number] }>;
} {
  const extant = Array.from(species).filter((s) => s.extantCount > 0);
  if (extant.length <= 1) {
    return {
      meanHyperbolicDist: 0,
      embeddings: extant.map((s) => ({ speciesId: s.speciesId, uv: [0, 0] })),
    };
  }
  const embeddings = extant.map((s) => {
    const rad = Math.min(0.9, 0.22 + 0.14 * Math.log1p(s.speciesId - 1 + s.originTick * 0.01));
    const ang = (s.baseHueDeg * Math.PI) / 180.0;
    return {
      speciesId: s.speciesId,
      uv: [rad * Math.cos(ang), rad * Math.sin(ang)] as [number, number],
    };
  });

  let sumDist = 0;
  let pairs = 0;
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      sumDist += computePoincareHyperbolicDistance(embeddings[i]!.uv, embeddings[j]!.uv);
      pairs++;
    }
  }
  return {
    meanHyperbolicDist: pairs > 0 ? sumDist / pairs : 0,
    embeddings,
  };
}

export class ArchonSuperMind {
  public static readonly HDC_DIM = 512;
  public static readonly HOPFIELD_SLOTS = 32;

  public readonly role: CasteRole;
  public readonly stateAngles = new Float32Array(ArchonSuperMind.HDC_DIM);
  public readonly memoryBank = new Float32Array(ArchonSuperMind.HOPFIELD_SLOTS * 16);
  public writePtr = 0;

  public constructor(role: CasteRole, rng: DeterministicRng) {
    this.role = role;
    for (let i = 0; i < ArchonSuperMind.HDC_DIM; i++) {
      this.stateAngles[i] = rng.nextRange(-Math.PI, Math.PI);
    }
    for (let i = 0; i < this.memoryBank.length; i++) {
      this.memoryBank[i] = rng.nextGaussian(0, 0.35);
    }
  }

  public stepArchon(
    worldFeature16: Float32Array,
    dtSec: number,
    enableHopfield = true,
  ): { hopfieldEnergy: number; directiveVector8: Float32Array } {
    for (let d = 0; d < ArchonSuperMind.HDC_DIM; d++) {
      const f = worldFeature16[d & 15]!;
      const nextAngle = this.stateAngles[d]! + dtSec * 1.25 * f * Math.cos(d * 0.137);
      this.stateAngles[d] = ((nextAngle + Math.PI) % (2.0 * Math.PI)) - Math.PI;
    }

    const retrieved16 = new Float32Array(16);
    let hopfieldEnergy = 0;

    if (enableHopfield) {
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

      for (let s = 0; s < ArchonSuperMind.HOPFIELD_SLOTS; s++) {
        const p = attn[s]! / Math.max(1e-12, sumExp);
        const base = s * 16;
        for (let k = 0; k < 16; k++) {
          retrieved16[k] = retrieved16[k]! + p * this.memoryBank[base + k]!;
        }
      }

      let featNorm = 0;
      for (let k = 0; k < 16; k++) featNorm += worldFeature16[k]! * worldFeature16[k]!;
      if (featNorm > 0.25) {
        const dst = this.writePtr * 16;
        for (let k = 0; k < 16; k++) {
          this.memoryBank[dst + k] = 0.85 * this.memoryBank[dst + k]! + 0.15 * worldFeature16[k]!;
        }
        this.writePtr = (this.writePtr + 1) % ArchonSuperMind.HOPFIELD_SLOTS;
      }
      const lse = (maxLogit + Math.log(Math.max(1e-12, sumExp))) / beta;
      hopfieldEnergy = -lse + 0.5 * featNorm;
    }

    const directive8 = new Float32Array(8);
    for (let k = 0; k < 8; k++) {
      directive8[k] = Math.tanh(retrieved16[k]! + 0.35 * Math.cos(this.stateAngles[k * 32]!));
    }
    return { hopfieldEnergy, directiveVector8: directive8 };
  }
}

export class MechalogodromPantheon {
  public static readonly LLG_SPINS = 16;
  public readonly archons: ArchonSuperMind[];
  public readonly castePhases = new Float64Array(5);
  public readonly casteNaturalFreqs = Float64Array.from([1.15, 0.92, 0.78, 1.04, 1.31]);
  public readonly shellAmplitudes10 = new Float64Array(10);
  public readonly shellWeights10 = new Float64Array(10);
  public readonly spinsXyz48 = new Float32Array(16 * 3);
  private readonly hEffXyz48 = new Float32Array(16 * 3);

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
    for (let i = 0; i < 16; i++) {
      const th = (i / 16.0) * Math.PI;
      this.spinsXyz48[i * 3] = Math.sin(th);
      this.spinsXyz48[i * 3 + 1] = 0;
      this.spinsXyz48[i * 3 + 2] = Math.cos(th);
    }
  }

  public snapshotState(): PantheonStateSnapshot {
    return {
      castePhases: this.castePhases.slice(),
      shellAmplitudes10: this.shellAmplitudes10.slice(),
      shellWeights10: this.shellWeights10.slice(),
      spinsXyz48: this.spinsXyz48.slice(),
      archonAngles: this.archons.map((a) => a.stateAngles.slice()),
      archonBanks: this.archons.map((a) => a.memoryBank.slice()),
      archonWritePtrs: this.archons.map((a) => a.writePtr),
    };
  }

  public restoreState(snap: PantheonStateSnapshot): void {
    this.castePhases.set(snap.castePhases);
    this.shellAmplitudes10.set(snap.shellAmplitudes10);
    this.shellWeights10.set(snap.shellWeights10);
    this.spinsXyz48.set(snap.spinsXyz48);
    for (let i = 0; i < this.archons.length; i++) {
      this.archons[i]!.stateAngles.set(snap.archonAngles[i]!);
      this.archons[i]!.memoryBank.set(snap.archonBanks[i]!);
      this.archons[i]!.writePtr = snap.archonWritePtrs[i]!;
    }
  }

  public stepPantheon(
    worldFeature16: Float32Array,
    couplingK: number,
    dtSec: number,
    options: {
      enableLlgSpins?: boolean;
      enableHopfield?: boolean;
      enableDpp?: boolean;
      species?: Iterable<SpeciesLineageRecord>;
    } = {},
  ): PantheonSnapshot {
    const dt = Math.max(1e-3, Math.min(0.25, dtSec));
    const K = Math.max(0.0, Math.min(4.0, couplingK));

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

    // Step 16-spin Landau-Lifshitz-Gilbert (`LLG`) micromagnetic reservoir (`spin_based_neural_network`)
    let llgMz = 0;
    if (options.enableLlgSpins ?? true) {
      for (let s = 0; s < 16; s++) {
        const phase = this.castePhases[s % 5]!;
        this.hEffXyz48[s * 3] = Math.cos(phase) * 0.85;
        this.hEffXyz48[s * 3 + 1] = Math.sin(phase) * 0.85;
        this.hEffXyz48[s * 3 + 2] = 0.45 * orderR + 0.25 * (worldFeature16[s] ?? 0);
      }
      llgMz = getZigBridge().stepLlgSpins(this.spinsXyz48, this.hEffXyz48, 0.12, dt);
    }

    const vectors5x8 = new Float64Array(5 * 8);
    const energies: number[] = [];
    const casteDirectives = {} as Record<CasteRole, [number, number, number, number, number, number]>;

    for (let i = 0; i < 5; i++) {
      const role = CASTE_ROLES[i]!;
      const res = this.archons[i]!.stepArchon(worldFeature16, dt, options.enableHopfield ?? true);
      energies.push(res.hopfieldEnergy);
      for (let d = 0; d < 8; d++) {
        vectors5x8[i * 8 + d] = res.directiveVector8[d]! + 0.15 * Math.cos(this.castePhases[i]! + d);
      }
      const spinMod = this.spinsXyz48[(i * 3) * 3 + 2] ?? llgMz;
      casteDirectives[role] = [
        res.directiveVector8[0]! * 0.8 + 0.2 * spinMod,
        res.directiveVector8[1]!,
        res.directiveVector8[2]!,
        res.directiveVector8[3]!,
        res.directiveVector8[4]!,
        res.directiveVector8[5]!,
      ];
    }
    const dppDet = (options.enableDpp ?? true) ? computeCholesky5x5Determinant(vectors5x8, 8) : 0.0;

    for (let s = 0; s < 10; s++) {
      const prevShell = this.shellAmplitudes10[(s + 9) % 10]!;
      const curShell = this.shellAmplitudes10[s]!;
      const deltaTiming = prevShell - curShell;
      const stdpDelta =
        deltaTiming >= 0 ? 0.015 * Math.exp(-deltaTiming / 0.4) : -0.018 * Math.exp(deltaTiming / 0.4);
      this.shellWeights10[s] = Math.max(0.05, Math.min(1.5, this.shellWeights10[s]! + dt * stdpDelta));
      this.shellAmplitudes10[s] = Math.tanh(
        0.76 * curShell +
          0.26 * this.shellWeights10[s]! * prevShell +
          0.16 * orderR * Math.sin(s * 0.6 + this.castePhases[s % 5]!) +
          0.08 * llgMz,
      );
    }

    const phaseMap = {} as Record<CasteRole, number>;
    for (let i = 0; i < 5; i++) {
      phaseMap[CASTE_ROLES[i]!] = this.castePhases[i]!;
    }

    const phylo = options.species
      ? computeSpeciesPhylogenyHyperbolicTree(options.species).meanHyperbolicDist
      : 0.0;

    return {
      kuramotoOrderParameterR: makeIndicator(
        orderR,
        'CALIBRATED_BIOPHYSICAL',
        'Kuramoto (1975) macroscopic phase-coherence order parameter R in [0, 1]; NOT collective sentience.',
      ),
      castePhasesRad: phaseMap,
      casteDirectives,
      dppDiversityDet: dppDet,
      archonHopfieldEnergies: energies,
      mechalogodromShells10: Array.from(this.shellAmplitudes10),
      llgMeanMagnetizationZ: llgMz,
      phylogenyMeanHyperbolicDist: phylo,
    };
  }
}
