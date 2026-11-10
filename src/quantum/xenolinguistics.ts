/**
 * CQM2 Xenolinguistics & Phonotactic Taxonomy Engine (`Glossodrom` + `Thingmaker`).
 *   1. `Glossodrom` Systematic Reed-Solomon `RS[15, 11]` over `GF(2^4)` (`d_min = 5`):
 *      Encodes 11 4-bit biological/affective nibbles into a 15-symbol 4D $S^3$ Zooid bioluminescent
 *      codeword and algebraically heals up to `t = 2` arbitrary symbol corruptions via Peterson + Forney!
 *   2. `Thingmaker` 4-Stream Deterministic Phonotactic Taxonomy:
 *      Generates decoupled (`attrs`, `name`, `lore`, `art`) scientific binomials and caste glyphs.
 */
import { DeterministicRng, hashString64 } from '../core/prng';
import type { CasteRole } from '../erp/relational-store';

// ============================================================================
// 1. GF(16) Arithmetic (Primitive Polynomial p(x) = x^4 + x + 1 => 0b10011 = 19)
// ============================================================================
const GF16_EXP = new Uint8Array(32);
const GF16_LOG = new Uint8Array(16);

(function initGf16Tables(): void {
  let x = 1;
  for (let i = 0; i < 15; i++) {
    GF16_EXP[i] = x;
    GF16_EXP[i + 15] = x;
    GF16_LOG[x] = i;
    x <<= 1;
    if ((x & 0x10) !== 0) {
      x ^= 0x13; // x^4 + x + 1
    }
  }
  GF16_EXP[30] = GF16_EXP[0]!;
  GF16_LOG[0] = 255;
})();

export function gf16Add(a: number, b: number): number {
  return (a ^ b) & 0x0f;
}

export function gf16Mul(a: number, b: number): number {
  const ma = a & 0x0f;
  const mb = b & 0x0f;
  if (ma === 0 || mb === 0) return 0;
  return GF16_EXP[GF16_LOG[ma]! + GF16_LOG[mb]!]!;
}

export function gf16Div(a: number, b: number): number {
  const ma = a & 0x0f;
  const mb = b & 0x0f;
  if (mb === 0) throw new Error('GF(16) division by zero');
  if (ma === 0) return 0;
  return GF16_EXP[GF16_LOG[ma]! + 15 - GF16_LOG[mb]!]!;
}

export function gf16PowAlpha(power: number): number {
  const p = ((power % 15) + 15) % 15;
  return GF16_EXP[p]!;
}

// Generator polynomial g(x) = (x - a^1)(x - a^2)(x - a^3)(x - a^4) = x^4 + g3 x^3 + g2 x^2 + g1 x + g0
const RS_GEN = (function computeGenerator(): Uint8Array {
  let poly = [1]; // highest degree first
  for (let r = 1; r <= 4; r++) {
    const root = gf16PowAlpha(r);
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let i = 0; i < poly.length; i++) {
      next[i] = gf16Add(next[i]!, poly[i]!);
      next[i + 1] = gf16Add(next[i + 1]!, gf16Mul(poly[i]!, root));
    }
    poly = next;
  }
  return Uint8Array.from(poly); // length 5: [1, g3, g2, g1, g0]
})();

function polyEvalHighestFirst(codeword15: ArrayLike<number>, x: number): number {
  let acc = 0;
  for (let i = 0; i < codeword15.length; i++) {
    acc = gf16Add(gf16Mul(acc, x), codeword15[i]! & 0x0f);
  }
  return acc;
}

/**
 * Systematic `RS[15, 11]` encoder over `GF(16)`:
 * Returns 15 nibbles `[m_0 .. m_10, p_0, p_1, p_2, p_3]` such that $c(\alpha^r) = 0$ for $r \in \{1, 2, 3, 4\}$.
 */
export function encodeGlossodromRs15_11(message11: ArrayLike<number>): Uint8Array {
  const cw = new Uint8Array(15);
  for (let i = 0; i < 11; i++) {
    cw[i] = (message11[i] ?? 0) & 0x0f;
  }
  // Polynomial long division of m(x) * x^4 by g(x)
  const rem = new Uint8Array(4);
  for (let i = 0; i < 11; i++) {
    const feedback = gf16Add(cw[i]!, rem[0]!);
    rem[0] = gf16Add(rem[1]!, gf16Mul(feedback, RS_GEN[1]!));
    rem[1] = gf16Add(rem[2]!, gf16Mul(feedback, RS_GEN[2]!));
    rem[2] = gf16Add(rem[3]!, gf16Mul(feedback, RS_GEN[3]!));
    rem[3] = gf16Mul(feedback, RS_GEN[4]!);
  }
  cw[11] = rem[0]!;
  cw[12] = rem[1]!;
  cw[13] = rem[2]!;
  cw[14] = rem[3]!;
  return cw;
}

export interface GlossodromDecodeResult {
  correctedCodeword: Uint8Array;
  message11: Uint8Array;
  syndromes: [number, number, number, number];
  correctedSymbolCount: number;
  uncorrectable: boolean;
}

/**
 * Algebraic Peterson + Chien + Forney decoder for `RS[15, 11]` over `GF(16)`.
 * Exact correction for 0, 1, or 2 symbol errors anywhere in the 15-nibble Zooid strand!
 */
export function decodeGlossodromRs15_11(received15: ArrayLike<number>): GlossodromDecodeResult {
  const cw = new Uint8Array(15);
  for (let i = 0; i < 15; i++) cw[i] = (received15[i] ?? 0) & 0x0f;

  const s1 = polyEvalHighestFirst(cw, gf16PowAlpha(1));
  const s2 = polyEvalHighestFirst(cw, gf16PowAlpha(2));
  const s3 = polyEvalHighestFirst(cw, gf16PowAlpha(3));
  const s4 = polyEvalHighestFirst(cw, gf16PowAlpha(4));

  if ((s1 | s2 | s3 | s4) === 0) {
    return {
      correctedCodeword: cw,
      message11: cw.slice(0, 11),
      syndromes: [0, 0, 0, 0],
      correctedSymbolCount: 0,
      uncorrectable: false,
    };
  }

  // Peterson's direct error-locator polynomial Lambda(z) = 1 + L1*z + L2*z^2
  // Determinant for 2-error case: det = S1*S3 + S2^2
  const det2 = gf16Add(gf16Mul(s1, s3), gf16Mul(s2, s2));
  let l1 = 0;
  let l2 = 0;
  let expectedErrors = 0;

  if (det2 !== 0) {
    // 2 errors:
    // S3 + S2*L1 + S1*L2 = 0
    // S4 + S3*L1 + S2*L2 = 0
    // => L1 = (S2*S3 + S1*S4) / det2,  L2 = (S2*S4 + S3^2) / det2
    expectedErrors = 2;
    l1 = gf16Div(gf16Add(gf16Mul(s2, s3), gf16Mul(s1, s4)), det2);
    l2 = gf16Div(gf16Add(gf16Mul(s2, s4), gf16Mul(s3, s3)), det2);
  } else if (s1 !== 0) {
    // 1 error: X_1 = S2 / S1 => L1 = X_1
    expectedErrors = 1;
    l1 = gf16Div(s2, s1);
    l2 = 0;
  } else {
    return {
      correctedCodeword: cw,
      message11: cw.slice(0, 11),
      syndromes: [s1, s2, s3, s4],
      correctedSymbolCount: 0,
      uncorrectable: true,
    };
  }

  // Chien search over codeword positions idx = 0..14 (corresponding to power j = 14 - idx, X = alpha^j, X^{-1} = alpha^{-j})
  const errIndices: number[] = [];
  const errLocatorsX: number[] = [];
  for (let idx = 0; idx < 15; idx++) {
    const powerJ = 14 - idx;
    const xInv = gf16PowAlpha(-powerJ);
    const xInv2 = gf16Mul(xInv, xInv);
    const val = gf16Add(1, gf16Add(gf16Mul(l1, xInv), gf16Mul(l2, xInv2)));
    if (val === 0) {
      errIndices.push(idx);
      errLocatorsX.push(gf16PowAlpha(powerJ));
    }
  }

  if (errIndices.length !== expectedErrors) {
    return {
      correctedCodeword: cw,
      message11: cw.slice(0, 11),
      syndromes: [s1, s2, s3, s4],
      correctedSymbolCount: 0,
      uncorrectable: true,
    };
  }

  // Error evaluator Omega(z) = S(z)*Lambda(z) mod z^4, where S(z) = S1 + S2 z + S3 z^2 + S4 z^3
  // For t <= 2, deg(Omega) < 2 => Omega(z) = w0 + w1*z
  const w0 = s1;
  const w1 = gf16Add(s2, gf16Mul(s1, l1));
  // Formal derivative over GF(2^m): Lambda'(z) = L1 (since 2*L2*z = 0 in char 2!)
  if (l1 === 0) {
    return {
      correctedCodeword: cw,
      message11: cw.slice(0, 11),
      syndromes: [s1, s2, s3, s4],
      correctedSymbolCount: 0,
      uncorrectable: true,
    };
  }

  for (let k = 0; k < errIndices.length; k++) {
    const pos = errIndices[k]!;
    const X = errLocatorsX[k]!;
    const xInv = gf16Div(1, X);
    // Forney formula for narrow-sense b=1 RS code: e_k = X_k^{1 - b} * Omega(X_k^{-1}) / Lambda'(X_k^{-1}) = Omega(X_k^{-1}) / L1
    const omegaVal = gf16Add(w0, gf16Mul(w1, xInv));
    const mag = gf16Div(omegaVal, l1);
    cw[pos] = gf16Add(cw[pos]!, mag);
  }

  // Re-verify syndromes after correction
  const checkS1 = polyEvalHighestFirst(cw, gf16PowAlpha(1));
  const checkS2 = polyEvalHighestFirst(cw, gf16PowAlpha(2));
  const checkS3 = polyEvalHighestFirst(cw, gf16PowAlpha(3));
  const checkS4 = polyEvalHighestFirst(cw, gf16PowAlpha(4));
  const clean = (checkS1 | checkS2 | checkS3 | checkS4) === 0;

  return {
    correctedCodeword: cw,
    message11: cw.slice(0, 11),
    syndromes: [s1, s2, s3, s4],
    correctedSymbolCount: clean ? errIndices.length : 0,
    uncorrectable: !clean,
  };
}

/**
 * Projects a 15-nibble Glossodrom codeword onto a 15-node 4D Clifford torus on $S^3$
 * stereographically mapped into $\mathbb{R}^3$ for rendering Zooid bioluminescent strands!
 */
export function projectZooidStrandS3ToR3(codeword15: ArrayLike<number>, phaseRad = 0): Float32Array {
  const pts = new Float32Array(15 * 3);
  for (let i = 0; i < 15; i++) {
    const sym = (codeword15[i] ?? 0) & 0x0f;
    const u = (i / 15.0) * 2.0 * Math.PI + phaseRad;
    const v = (sym / 16.0) * 2.0 * Math.PI + 0.5 * phaseRad;
    const r4 = Math.SQRT1_2;
    const x1 = r4 * Math.cos(u);
    const x2 = r4 * Math.sin(u);
    const x3 = r4 * Math.cos(v);
    const x4 = r4 * Math.sin(v);
    const denom = Math.max(0.28, 1.25 - x4);
    pts[i * 3] = x1 / denom;
    pts[i * 3 + 1] = x2 / denom;
    pts[i * 3 + 2] = x3 / denom;
  }
  return pts;
}

// ============================================================================
// 2. Thingmaker 4-Stream Deterministic Phonotactic Species Taxonomy
// ============================================================================
const GENUS_ONSETS = ['Asmo', 'Velo', 'Batho', 'Chroma', 'Noet', 'Kera', 'Thala', 'Zygo', 'Pela', 'Xeno', 'Larku', 'Meca'];
const GENUS_CODAS = ['denius', 'morpha', 'nectes', 'zoon', 'caris', 'branchia', 'teuthis', 'spira', 'soma', 'draco'];
const EPITHET_STEMS = ['lucens', 'abyssi', 'quantalis', 'plasticus', 'iridescens', 'vorticalis', 'homeostatis', 'harmonicus', 'tenebris', 'velox'];
const GLYPHS = ['◈', '❖', '✦', '❂', '⌬', '⟐', '⧠', '✺'];

export interface TaxonomicIdentity {
  latinBinomial: string;
  commonGlyph: string;
  ethologyNote: string;
  baseHueDeg: number;
  somiteCount: number;
}

export function synthesizeTaxonomicIdentity(seed: bigint, lineageIndex: number, caste: CasteRole): TaxonomicIdentity {
  const base = seed ^ hashString64(`thingmaker::lineage::${lineageIndex}::${caste}`);
  // 4 strictly isolated streams (`attrs`, `name`, `lore`, `art`)
  const attrsRng = new DeterministicRng(base ^ hashString64('attrs'));
  const nameRng = new DeterministicRng(base ^ hashString64('name'));
  const loreRng = new DeterministicRng(base ^ hashString64('lore'));
  const artRng = new DeterministicRng(base ^ hashString64('art'));

  const somiteCount = attrsRng.nextInt(5, 11);
  const genus = GENUS_ONSETS[nameRng.nextInt(0, GENUS_ONSETS.length)]! + GENUS_CODAS[nameRng.nextInt(0, GENUS_CODAS.length)]!;
  const epithet = EPITHET_STEMS[nameRng.nextInt(0, EPITHET_STEMS.length)]!;

  const habitats = ['hydrothermal vent plumes', 'Kerr photon-shelf currents', 'crystalline guanine reefs', 'mesopelagic chemoclines'];
  const ethologyNote = `${caste} lineage adapted to ${habitats[loreRng.nextInt(0, habitats.length)]} (${somiteCount} articulated somites).`;

  const baseHueDeg = Math.round(artRng.nextRange(155, 325));
  const commonGlyph = GLYPHS[artRng.nextInt(0, GLYPHS.length)]!;

  return {
    latinBinomial: `${genus} ${epithet}`,
    commonGlyph,
    ethologyNote,
    baseHueDeg,
    somiteCount,
  };
}
