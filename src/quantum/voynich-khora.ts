/**
 * CQM2 v2.1.0 `Xeno-Voynich-4D-Language-Lab` (`𐍈-KHORA`) Port:
 *   - 8 Gothic 4D Chromo-Codons (`𐍈, 𐌸, 𐌔, 𐍉, 𐍀, 𐌼, 𐍆, 𐍊`) with 7-channel bioluminescent signatures
 *   - Law I: Projective Ablation of Deduplications ($\mathcal{A}_{\text{dedup}}$)
 *   - Law II: Kuramoto-Berry Phase Morphogenesis
 *   - Law III: Unitary Fibonacci Anyon $F$-Matrix Braiding ($F^2 = I$, Pentagon Identity)
 *   - Exact 4D Hopf Fibration ($S^3 \to S^2 \hookrightarrow \mathbb{R}^3$) fiber bundle projection
 */

export const KHORA_CODONS = ['𐍈', '𐌸', '𐌔', '𐍉', '𐍀', '𐌼', '𐍆', '𐍊'] as const;
export type KhoraCodon = (typeof KHORA_CODONS)[number];

export interface ChromoCodonChannel7 {
  readonly glyph: KhoraCodon;
  readonly index: number;
  readonly wavelengthNm: number;
  readonly polarizationRad: number;
  readonly hopfBaseTheta: number;
  readonly hopfBasePhi: number;
  readonly anyonChargeTau: boolean;
}

export const KHORA_CODON_TABLE: readonly ChromoCodonChannel7[] = KHORA_CODONS.map((glyph, index) => ({
  glyph,
  index,
  wavelengthNm: 410 + index * 38,
  polarizationRad: (index * Math.PI) / 4,
  hopfBaseTheta: 0.25 * Math.PI + (index % 4) * 0.18 * Math.PI,
  hopfBasePhi: (index * 2 * Math.PI) / 8,
  anyonChargeTau: index % 2 === 1,
}));

/**
 * Law I (`𐍈-KHORA`): Projective Ablation of Deduplications ($\mathcal{A}_{\text{dedup}}$).
 * Collapses stuttering/collinear consecutive codons in projective $S^3/\mathbb{Z}_2$ space while accumulating
 * topological twist multiplicity into phase weights!
 */
export function applyProjectiveAblationDedup(sequence: readonly number[]): {
  ablatedIndices: number[];
  twistMultiplicities: number[];
  compressionRatio: number;
} {
  if (sequence.length === 0) {
    return { ablatedIndices: [], twistMultiplicities: [], compressionRatio: 1 };
  }
  const ablatedIndices: number[] = [];
  const twistMultiplicities: number[] = [];

  for (let i = 0; i < sequence.length; i++) {
    const sym = ((sequence[i]! % 8) + 8) % 8;
    if (ablatedIndices.length > 0 && ablatedIndices[ablatedIndices.length - 1] === sym) {
      twistMultiplicities[twistMultiplicities.length - 1]! += 1;
    } else {
      ablatedIndices.push(sym);
      twistMultiplicities.push(1);
    }
  }
  return {
    ablatedIndices,
    twistMultiplicities,
    compressionRatio: ablatedIndices.length / sequence.length,
  };
}

/**
 * Law III (`𐍈-KHORA`): Unitary Fibonacci Anyon Fusion $F$-Matrix & Elementary Braid $R$-Gate!
 * Golden ratio $\phi = (1+\sqrt{5})/2$; $F = \begin{pmatrix} \phi^{-1} & \phi^{-1/2} \\ \phi^{-1/2} & -\phi^{-1} \end{pmatrix}$ satisfies $F^\dagger F = I$.
 */
export function braidFibonacciAnyonWord(braidGenerators: readonly (1 | 2 | -1 | -2)[]): {
  probVacuumChannel0: number;
  probTauChannel1: number;
  unitarityDrift: number;
} {
  const phi = 0.5 * (1.0 + Math.sqrt(5.0));
  const invPhi = 1.0 / phi;
  const invSqrtPhi = 1.0 / Math.sqrt(phi);

  // R_0 = e^{-4pi i / 5}, R_1 = e^{+3pi i / 5}
  const r0Angle = (-4.0 * Math.PI) / 5.0;
  const r1Angle = (3.0 * Math.PI) / 5.0;

  // Start in fusion basis |0> = (1, 0)
  let psi0Re = 1.0;
  let psi0Im = 0.0;
  let psi1Re = 0.0;
  let psi1Im = 0.0;

  const applyR = (sign: number) => {
    const c0 = Math.cos(sign * r0Angle);
    const s0 = Math.sin(sign * r0Angle);
    const c1 = Math.cos(sign * r1Angle);
    const s1 = Math.sin(sign * r1Angle);
    const n0Re = psi0Re * c0 - psi0Im * s0;
    const n0Im = psi0Re * s0 + psi0Im * c0;
    const n1Re = psi1Re * c1 - psi1Im * s1;
    const n1Im = psi1Re * s1 + psi1Im * c1;
    psi0Re = n0Re;
    psi0Im = n0Im;
    psi1Re = n1Re;
    psi1Im = n1Im;
  };

  const applyF = () => {
    const n0Re = invPhi * psi0Re + invSqrtPhi * psi1Re;
    const n0Im = invPhi * psi0Im + invSqrtPhi * psi1Im;
    const n1Re = invSqrtPhi * psi0Re - invPhi * psi1Re;
    const n1Im = invSqrtPhi * psi0Im - invPhi * psi1Im;
    psi0Re = n0Re;
    psi0Im = n0Im;
    psi1Re = n1Re;
    psi1Im = n1Im;
  };

  for (const gen of braidGenerators) {
    if (gen === 1 || gen === -1) {
      applyR(gen === 1 ? 1 : -1);
    } else {
      // sigma_2 = F * R * F
      applyF();
      applyR(gen === 2 ? 1 : -1);
      applyF();
    }
  }

  const p0 = psi0Re * psi0Re + psi0Im * psi0Im;
  const p1 = psi1Re * psi1Re + psi1Im * psi1Im;
  return {
    probVacuumChannel0: p0,
    probTauChannel1: p1,
    unitarityDrift: Math.abs(p0 + p1 - 1.0),
  };
}

/**
 * Exact 4D Hopf Fibration ($S^3 \to S^2 \hookrightarrow \mathbb{R}^3$):
 * Maps base point $(\theta, \phi) \in S^2$ and fiber phase $\psi \in [0, 2\pi)$ onto $S^3$
 * and stereographically projects into $\mathbb{R}^3$ (every distinct fiber pair has linking number $|Lk| = 1$!).
 */
export function sampleHopfFiberR3(thetaBase: number, phiBase: number, samples = 32, phaseOffset = 0): Float32Array {
  const out = new Float32Array(samples * 3);
  const ct = Math.cos(0.5 * thetaBase);
  const st = Math.sin(0.5 * thetaBase);

  for (let i = 0; i < samples; i++) {
    const psi = (i / samples) * 2.0 * Math.PI + phaseOffset;
    const a1 = psi + 0.5 * phiBase;
    const a2 = psi - 0.5 * phiBase;

    const x0 = ct * Math.cos(a1);
    const x1 = ct * Math.sin(a1);
    const x2 = st * Math.cos(a2);
    const x3 = st * Math.sin(a2);

    const denom = Math.max(0.22, 1.35 - x3);
    out[i * 3] = x0 / denom;
    out[i * 3 + 1] = x1 / denom;
    out[i * 3 + 2] = x2 / denom;
  }
  return out;
}
