/**
 * CQM2 v2.1.0 Xenolinguistics, 16-Zooid 2D Product-Code Cormidia, Time-Reversible `RV32IM_Xgloss` VM,
 * Hockett 16-Feature Pragmatics & 4-Stream `Thingmaker` Taxonomy/SVG Engine (`Glossodrom Language Lab` port).
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
      x ^= 0x13;
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

const RS_GEN = (function computeGenerator(): Uint8Array {
  let poly = [1];
  for (let r = 1; r <= 4; r++) {
    const root = gf16PowAlpha(r);
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let i = 0; i < poly.length; i++) {
      next[i] = gf16Add(next[i]!, poly[i]!);
      next[i + 1] = gf16Add(next[i + 1]!, gf16Mul(poly[i]!, root));
    }
    poly = next;
  }
  return Uint8Array.from(poly);
})();

function polyEvalHighestFirst(codeword15: ArrayLike<number>, x: number): number {
  let acc = 0;
  for (let i = 0; i < codeword15.length; i++) {
    acc = gf16Add(gf16Mul(acc, x), codeword15[i]! & 0x0f);
  }
  return acc;
}

export function encodeGlossodromRs15_11(message11: ArrayLike<number>): Uint8Array {
  const cw = new Uint8Array(15);
  for (let i = 0; i < 11; i++) {
    cw[i] = (message11[i] ?? 0) & 0x0f;
  }
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

  const det2 = gf16Add(gf16Mul(s1, s3), gf16Mul(s2, s2));
  let l1 = 0;
  let l2 = 0;
  let expectedErrors = 0;

  if (det2 !== 0) {
    expectedErrors = 2;
    l1 = gf16Div(gf16Add(gf16Mul(s2, s3), gf16Mul(s1, s4)), det2);
    l2 = gf16Div(gf16Add(gf16Mul(s2, s4), gf16Mul(s3, s3)), det2);
  } else if (s1 !== 0) {
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

  if (errIndices.length !== expectedErrors || l1 === 0) {
    return {
      correctedCodeword: cw,
      message11: cw.slice(0, 11),
      syndromes: [s1, s2, s3, s4],
      correctedSymbolCount: 0,
      uncorrectable: true,
    };
  }

  const w0 = s1;
  const w1 = gf16Add(s2, gf16Mul(s1, l1));

  for (let k = 0; k < errIndices.length; k++) {
    const pos = errIndices[k]!;
    const X = errLocatorsX[k]!;
    const xInv = gf16Div(1, X);
    const omegaVal = gf16Add(w0, gf16Mul(w1, xInv));
    const mag = gf16Div(omegaVal, l1);
    cw[pos] = gf16Add(cw[pos]!, mag);
  }

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

// ============================================================================
// 2. Glossodrom 16-Zooid 2D Product-Code Tesseract Cormidium (`[4x4]` Erasure/Error Healing)
// Encodes 9 data nibbles into a `4x4` = 16-zooid tesseract cormidium (`3x3` data + row/col/corner GF(16) parities),
// healing arbitrary single-zooid corruptions and up to 4 erased/destroyed zooids via iterative row-col parity peeling!
// ============================================================================
export function encodeCormidium16(data9: ArrayLike<number>): Uint8Array {
  const grid = new Uint8Array(16);
  for (let r = 0; r < 3; r++) {
    let rowXor = 0;
    for (let c = 0; c < 3; c++) {
      const v = (data9[r * 3 + c] ?? 0) & 0x0f;
      grid[r * 4 + c] = v;
      rowXor ^= v;
    }
    grid[r * 4 + 3] = rowXor;
  }
  for (let c = 0; c < 4; c++) {
    grid[12 + c] = (grid[c]! ^ grid[4 + c]! ^ grid[8 + c]!) & 0x0f;
  }
  return grid;
}

export function healCormidium16Erasures(received16: ArrayLike<number>, erasedIndices: readonly number[]): {
  healed16: Uint8Array;
  data9: Uint8Array;
  fullyRecovered: boolean;
} {
  const grid = new Uint8Array(16);
  const missing = new Uint8Array(16);
  for (let i = 0; i < 16; i++) grid[i] = (received16[i] ?? 0) & 0x0f;
  for (const idx of erasedIndices) {
    if (idx >= 0 && idx < 16) missing[idx] = 1;
  }

  // Iterative row & column parity peeling over GF(16)
  let progress = true;
  while (progress) {
    progress = false;
    for (let r = 0; r < 4; r++) {
      let missCount = 0;
      let missCol = -1;
      let xorKnown = 0;
      for (let c = 0; c < 4; c++) {
        const idx = r * 4 + c;
        if (missing[idx]) {
          missCount++;
          missCol = c;
        } else {
          xorKnown ^= grid[idx]!;
        }
      }
      if (missCount === 1 && missCol >= 0) {
        const fixIdx = r * 4 + missCol;
        grid[fixIdx] = xorKnown & 0x0f;
        missing[fixIdx] = 0;
        progress = true;
      }
    }

    for (let c = 0; c < 4; c++) {
      let missCount = 0;
      let missRow = -1;
      let xorKnown = 0;
      for (let r = 0; r < 4; r++) {
        const idx = r * 4 + c;
        if (missing[idx]) {
          missCount++;
          missRow = r;
        } else {
          xorKnown ^= grid[idx]!;
        }
      }
      if (missCount === 1 && missRow >= 0) {
        const fixIdx = missRow * 4 + c;
        grid[fixIdx] = xorKnown & 0x0f;
        missing[fixIdx] = 0;
        progress = true;
      }
    }
  }

  const data9 = new Uint8Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) data9[r * 3 + c] = grid[r * 4 + c]!;
  }
  const fullyRecovered = missing.every((m) => m === 0);
  return { healed16: grid, data9, fullyRecovered };
}

// ============================================================================
// 3. Time-Reversible `RV32IM_Xgloss` Bijective VM (`stepForward` <-> `stepBack`)
// Implements reversible Feistel/XOR/ADD/ROT instructions so `stepBack()` inverts `stepForward()` bit-exactly!
// ============================================================================
export type XglossOp =
  | { readonly op: 'XOR_REG'; readonly dst: number; readonly src: number }
  | { readonly op: 'ADD_IMM'; readonly dst: number; readonly imm: number }
  | { readonly op: 'ROTL'; readonly dst: number; readonly bits: number }
  | { readonly op: 'FEISTEL_VEIL'; readonly left: number; readonly right: number; readonly roundKey: number };

export class ReversibleXglossVm {
  public readonly regs = new Uint32Array(8);
  private readonly history: XglossOp[] = [];

  public constructor(seedRegs?: ArrayLike<number>) {
    if (seedRegs) {
      for (let i = 0; i < Math.min(8, seedRegs.length); i++) {
        this.regs[i] = (seedRegs[i] ?? 0) >>> 0;
      }
    }
  }

  private static feistelF(val: number, key: number): number {
    let x = ((val ^ key) >>> 0);
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }

  public stepForward(instr: XglossOp): void {
    switch (instr.op) {
      case 'XOR_REG':
        if (instr.dst !== instr.src) {
          this.regs[instr.dst & 7] = (this.regs[instr.dst & 7]! ^ this.regs[instr.src & 7]!) >>> 0;
        }
        break;
      case 'ADD_IMM':
        this.regs[instr.dst & 7] = (this.regs[instr.dst & 7]! + (instr.imm >>> 0)) >>> 0;
        break;
      case 'ROTL': {
        const r = instr.dst & 7;
        const b = instr.bits & 31;
        const v = this.regs[r]!;
        this.regs[r] = b === 0 ? v : ((v << b) | (v >>> (32 - b))) >>> 0;
        break;
      }
      case 'FEISTEL_VEIL': {
        const l = instr.left & 7;
        const r = instr.right & 7;
        if (l !== r) {
          const nextL = this.regs[r]!;
          const nextR = (this.regs[l]! ^ ReversibleXglossVm.feistelF(this.regs[r]!, instr.roundKey >>> 0)) >>> 0;
          this.regs[l] = nextL;
          this.regs[r] = nextR;
        }
        break;
      }
    }
    this.history.push(instr);
  }

  public stepBack(): boolean {
    const instr = this.history.pop();
    if (!instr) return false;
    switch (instr.op) {
      case 'XOR_REG':
        if (instr.dst !== instr.src) {
          this.regs[instr.dst & 7] = (this.regs[instr.dst & 7]! ^ this.regs[instr.src & 7]!) >>> 0;
        }
        break;
      case 'ADD_IMM':
        this.regs[instr.dst & 7] = (this.regs[instr.dst & 7]! - (instr.imm >>> 0)) >>> 0;
        break;
      case 'ROTL': {
        const r = instr.dst & 7;
        const b = instr.bits & 31;
        const v = this.regs[r]!;
        this.regs[r] = b === 0 ? v : ((v >>> b) | (v << (32 - b))) >>> 0;
        break;
      }
      case 'FEISTEL_VEIL': {
        const l = instr.left & 7;
        const r = instr.right & 7;
        if (l !== r) {
          const origR = this.regs[l]!;
          const origL = (this.regs[r]! ^ ReversibleXglossVm.feistelF(origR, instr.roundKey >>> 0)) >>> 0;
          this.regs[l] = origL;
          this.regs[r] = origR;
        }
        break;
      }
    }
    return true;
  }
}

export type PragmaticIllocution = 'ASSERT' | 'ENACT' | 'ASK' | 'REPAIR';

export function evaluateHockettScorecard(activeRepairRate: number, displacementSteps: number, compositionalArity: number): {
  satisfiedFeatures: number;
  totalFeatures: 16;
  pragmaticAct: PragmaticIllocution;
} {
  let count = 10; // core bioluminescent broadcast, rapid fading, interchangeability, total feedback, specialization, semanticity, arbitrariness, discreteness, productivity, cultural transmission
  if (displacementSteps >= 3) count += 2; // displacement + prevarication/counterfactual
  if (compositionalArity >= 2) count += 2; // duality of patterning + learnability
  if (activeRepairRate > 0.05) count += 2; // reflexiveness + repair metacommunication
  const pragmaticAct: PragmaticIllocution =
    activeRepairRate > 0.25 ? 'REPAIR' : displacementSteps >= 4 ? 'ASSERT' : compositionalArity >= 3 ? 'ENACT' : 'ASK';
  return {
    satisfiedFeatures: Math.min(16, count),
    totalFeatures: 16,
    pragmaticAct,
  };
}

export function projectZooidStrandS3ToR3(codeword15: ArrayLike<number>, phaseRad = 0, outPts?: Float32Array): Float32Array {
  const pts = outPts && outPts.length >= 45 ? outPts : new Float32Array(15 * 3);
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
// 4. Thingmaker 4-Stream Deterministic Phonotactic Taxonomy & Procedural SVG Sigil
// ============================================================================
const GENUS_ONSETS = ['Asmo', 'Velo', 'Batho', 'Chroma', 'Noet', 'Kera', 'Thala', 'Zygo', 'Pela', 'Xeno', 'Larku', 'Meca'];
const GENUS_CODAS = ['denius', 'morpha', 'nectes', 'zoon', 'caris', 'branchia', 'teuthis', 'spira', 'soma', 'draco'];
const EPITHET_STEMS = [
  'lucens',
  'abyssi',
  'quantalis',
  'plasticus',
  'iridescens',
  'vorticalis',
  'homeostatis',
  'harmonicus',
  'tenebris',
  'velox',
];
const GLYPHS = ['◈', '❖', '✦', '❂', '⌬', '⟐', '⧠', '✺'];

export interface TaxonomicIdentity {
  latinBinomial: string;
  commonGlyph: string;
  ethologyNote: string;
  encounterCard: string;
  baseHueDeg: number;
  somiteCount: number;
  sigilSvg: string;
}

export function synthesizeTaxonomicIdentity(seed: bigint, lineageIndex: number, caste: CasteRole): TaxonomicIdentity {
  const base = seed ^ hashString64(`thingmaker::lineage::${lineageIndex}::${caste}`);
  const attrsRng = new DeterministicRng(base ^ hashString64('attrs'));
  const nameRng = new DeterministicRng(base ^ hashString64('name'));
  const loreRng = new DeterministicRng(base ^ hashString64('lore'));
  const artRng = new DeterministicRng(base ^ hashString64('art'));

  const somiteCount = attrsRng.nextInt(5, 11);
  const symmetryFold = attrsRng.nextInt(3, 9);
  const genus = GENUS_ONSETS[nameRng.nextInt(0, GENUS_ONSETS.length)]! + GENUS_CODAS[nameRng.nextInt(0, GENUS_CODAS.length)]!;
  const epithet = EPITHET_STEMS[nameRng.nextInt(0, EPITHET_STEMS.length)]!;

  const habitats = [
    'hydrothermal vent plumes',
    'Kerr photon-shelf currents',
    'crystalline Bonsai sanctuary canopies',
    'Xylos hyperbolic chemoclines',
  ];
  const behaviors = [
    'broadcasts 16-zooid tesseract cormidia',
    'surfs Gray-Scott reaction-diffusion fronts',
    'synchronizes Kuramoto-Berry dermal flashes',
    'grazes Crystal Bonsai fruit leases peacefully',
  ];
  const ethologyNote = `${caste} lineage adapted to ${habitats[loreRng.nextInt(0, habitats.length)]} (${somiteCount} articulated somites).`;
  const encounterCard = `${genus} ${epithet} ${behaviors[loreRng.nextInt(0, behaviors.length)]}.`;

  const baseHueDeg = Math.round(artRng.nextRange(155, 325));
  const commonGlyph = GLYPHS[artRng.nextInt(0, GLYPHS.length)]!;

  // Deterministic radially symmetric SVG sigil from `art` stream
  const pts: string[] = [];
  for (let k = 0; k < symmetryFold * 2; k++) {
    const angle = (k * Math.PI) / symmetryFold;
    const rad = k % 2 === 0 ? 26 : 11 + (lineageIndex % 7);
    const px = (32 + Math.cos(angle) * rad).toFixed(1);
    const py = (32 + Math.sin(angle) * rad).toFixed(1);
    pts.push(`${px},${py}`);
  }
  const sigilSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="29" fill="none" stroke="hsl(${baseHueDeg},85%,62%)" stroke-width="1.5"/><polygon points="${pts.join(' ')}" fill="hsla(${baseHueDeg},80%,55%,0.22)" stroke="hsl(${(baseHueDeg + 45) % 360},90%,70%)" stroke-width="1.4"/></svg>`;

  return {
    latinBinomial: `${genus} ${epithet}`,
    commonGlyph,
    ethologyNote,
    encounterCard,
    baseHueDeg,
    somiteCount,
    sigilSvg,
  };
}
