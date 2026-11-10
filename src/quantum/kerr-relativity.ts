/**
 * CQM2 v2.1.0 Spinning Kerr Relativity, Exact Bardeen D-Shadow, Leaver QNM Spectroscopy,
 * Hawking-Penrose Thermodynamics & 3D Mino-Time Null Geodesics (`Black Hole Simulation Lab` port).
 *
 * Strictly separates Lorentzian Boyer-Lindquist spacetime (-,+,+,+) from Euclidean Fubini-Study QGT!
 */
import { getZigBridge } from '../native/zig-bridge';

export const SCHWARZSCHILD_B_CRIT_OVER_M = Math.sqrt(27.0); // 5.196152422706632

export interface KerrShadowPoint {
  readonly alpha: number;
  readonly beta: number;
  readonly rSphericalPhoton: number;
}

export interface KerrQnmMode {
  readonly l: number;
  readonly m: number;
  readonly nOvertone: number;
  readonly omegaRealOverM: number;
  readonly omegaImagOverM: number;
  readonly qualityFactorQ: number;
}

export interface KerrThermodynamics {
  readonly spinA: number;
  readonly outerHorizonOverM: number;
  readonly innerHorizonOverM: number;
  readonly horizonAngularVelM: number;
  readonly surfaceGravityKappaM: number;
  readonly hawkingTempDimensionless: number;
  readonly irreducibleMassOverM: number;
  readonly penroseExtractableFraction: number; // <= 1 - 1/sqrt(2) = 0.2928932...
}

/**
 * Computes exact Bardeen (1973) closed-form asymmetric D-shaped Kerr black-hole shadow boundary
 * $(\alpha(r_0), \beta(r_0))$ parameterized by unstable spherical photon orbit radius $r_0 \in [r_{\text{ph}}^+, r_{\text{ph}}^-]$.
 */
export function computeBardeenKerrShadowLocus(spinA: number, inclinationRad: number, sampleCount = 64): KerrShadowPoint[] {
  const a = Math.max(0.001, Math.min(0.998, Math.abs(spinA)));
  const a2 = a * a;
  const sinInc = Math.max(0.05, Math.sin(inclinationRad));
  const cosInc = Math.cos(inclinationRad);

  // Equatorial prograde and retrograde photon-orbit bounds (Bardeen-Press-Teukolsky 1972)
  const rPro = 2.0 * (1.0 + Math.cos((2.0 / 3.0) * Math.acos(-a)));
  const rRet = 2.0 * (1.0 + Math.cos((2.0 / 3.0) * Math.acos(a)));

  const pts: KerrShadowPoint[] = [];
  const half = Math.max(8, Math.floor(sampleCount / 2));

  // Sweep r0 between rPro and rRet, retaining physical points with beta^2 >= 0
  for (let i = 0; i <= half; i++) {
    const frac = i / half;
    const r0 = rPro + (rRet - rPro) * frac;
    const delta = r0 * r0 - 2.0 * r0 + a2;
    const dDelta = 2.0 * (r0 - 1.0);
    if (Math.abs(a * dDelta) < 1e-9) continue;

    // Conserved Teo (2003) spherical null-orbit invariants:
    // xi(r0) = (r0^2 (r0 - 3) + a^2 (r0 + 1)) / (a (1 - r0))
    const xi = (r0 * r0 * (r0 - 3.0) + a2 * (r0 + 1.0)) / (a * (1.0 - r0));
    // eta(r0) = -r0^3 (r0^3 - 6 r0^2 + 9 r0 - 4 a^2) / (a^2 (r0 - 1)^2)
    const eta = -(r0 * r0 * r0 * (r0 * r0 * r0 - 6.0 * r0 * r0 + 9.0 * r0 - 4.0 * a2)) / (a2 * (r0 - 1.0) * (r0 - 1.0));
    void delta;

    const betaSq = eta + a2 * cosInc * cosInc - (xi * xi * cosInc * cosInc) / (sinInc * sinInc);
    if (betaSq >= 0) {
      const alpha = -xi / sinInc;
      const beta = Math.sqrt(betaSq);
      pts.push({ alpha: spinA >= 0 ? alpha : -alpha, beta, rSphericalPhoton: r0 });
    }
  }

  // Mirror lower half-plane (-beta) in reverse order to close the D-shaped contour smoothly
  const upperLen = pts.length;
  for (let i = upperLen - 1; i >= 0; i--) {
    const p = pts[i]!;
    if (p.beta > 1e-6) {
      pts.push({ alpha: p.alpha, beta: -p.beta, rSphericalPhoton: p.rSphericalPhoton });
    }
  }
  return pts;
}

/**
 * Evaluates Kerr Quasinormal Mode (`QNM`) ringdown spectroscopy (`(2,2,0)`, `(3,3,0)`, `(2,1,0)`)
 * calibrated to Leaver (1985) / Berti-Cardoso-Starinets (2009) continued-fraction eigenvalues!
 */
export function computeLeaverKerrQnmSpectrum(spinA: number): KerrQnmMode[] {
  const a = Math.max(0.0, Math.min(0.998, Math.abs(spinA)));
  const oneMinusA = Math.max(0.002, 1.0 - a);

  // Berti-Cardoso-Starinets high-accuracy rational/power-law Leaver fits: M * omega_{lmn} = f_1 + f_2 (1 - a)^{f_3}
  const specs: Array<{ l: number; m: number; n: number; f1: number; f2: number; f3: number; q1: number; q2: number; q3: number }> = [
    { l: 2, m: 2, n: 0, f1: 1.5251, f2: -1.1568, f3: 0.1292, q1: 0.7000, q2: 1.4187, q3: -0.4990 },
    { l: 3, m: 3, n: 0, f1: 1.8956, f2: -1.3043, f3: 0.1818, q1: 0.9000, q2: 2.3430, q3: -0.4810 },
    { l: 2, m: 1, n: 0, f1: 0.6000, f2: -0.2339, f3: 0.4175, q1: -0.3000, q2: 2.3561, q3: -0.2277 },
  ];

  return specs.map((s) => {
    const omegaRe = s.f1 + s.f2 * Math.pow(oneMinusA, s.f3);
    const qualityQ = Math.max(1.5, s.q1 + s.q2 * Math.pow(oneMinusA, s.q3));
    const omegaIm = -omegaRe / (2.0 * qualityQ);
    return {
      l: s.l,
      m: s.m,
      nOvertone: s.n,
      omegaRealOverM: omegaRe,
      omegaImagOverM: omegaIm,
      qualityFactorQ: qualityQ,
    };
  });
}

/**
 * Exact Kerr horizon thermodynamics: Hawking temperature $T_H = \kappa / 2\pi$, irreducible mass $M_{\text{irr}}$,
 * and Penrose rotational energy extraction limit ($\le 29.29\%$).
 */
export function computeKerrThermodynamics(spinA: number): KerrThermodynamics {
  const a = Math.max(0.0, Math.min(0.9999, Math.abs(spinA)));
  const root = Math.sqrt(Math.max(0.0, 1.0 - a * a));
  const rPlus = 1.0 + root;
  const rMinus = 1.0 - root;
  const omegaH = a / (2.0 * rPlus);
  const kappa = (rPlus - rMinus) / (4.0 * rPlus); // since r_+^2 + a^2 = 2 r_+
  const hawkingT = kappa / (2.0 * Math.PI);
  const mIrr = Math.sqrt(0.5 * rPlus); // M_irr / M = sqrt((1 + sqrt(1 - a^2)) / 2)
  const penroseFrac = 1.0 - mIrr;
  return {
    spinA: a,
    outerHorizonOverM: rPlus,
    innerHorizonOverM: rMinus,
    horizonAngularVelM: omegaH,
    surfaceGravityKappaM: kappa,
    hawkingTempDimensionless: hawkingT,
    irreducibleMassOverM: mIrr,
    penroseExtractableFraction: penroseFrac,
  };
}

export function traceKerrMinoRay(spinA: number, inclinationRad: number, xi: number, eta: number) {
  return getZigBridge().kerrMinoGeodesic(spinA, inclinationRad, xi, eta, 4000);
}
