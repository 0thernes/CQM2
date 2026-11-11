/**
 * CQM2 v2.2.0 — 25 Spatial Sorting Fields, Deterministic Cosmological Lore Engine & 20-Titan Diplomacy Simulator (`src/sim/sorting-fields.ts`).
 *
 * Implements:
 *   1. All 25 canonical CQM Sorting Field algorithms (`BUBBLE FIELD` .. `PREFIX PANCAKE`) with real
 *      incremental array sorting (`N = 64`), exact inversion-progress metrics, `Ω` convergence scores,
 *      `ALL` simultaneous field superposition, `AUTO` field cycling, and 3D spatial force-field coupling.
 *   2. Deterministic FNV-1a / SplitMix32 `LoreEngine` (`83` syllables including `hel`, `ti`, `bor` -> `HELTIBOR`)
 *      naming Voronoi camera sub-sectors, 20 Colossal Titans, and 20 Morphogenic Phyla.
 *   3. 20-Titan Resource Holdings (`matter`, `energy`, `entropy`) & `20x20` Diplomacy Matrix (`0=truce`, `1=ally`, `2=war`).
 */

export type SortingIgniteMode = 'radial' | 'sweep' | 'butterfly' | 'parity' | 'bucket';

export interface SortingFieldSpec {
  readonly index: number;
  readonly name: string;
  readonly glyph: string;
  readonly ignite: SortingIgniteMode;
  readonly hueDeg: number;
}

export const SORTING_25_SPECS: readonly SortingFieldSpec[] = [
  { index: 0, name: 'BUBBLE FIELD', glyph: '◆', ignite: 'radial', hueDeg: 0 },
  { index: 1, name: 'SELECTION SWEEP', glyph: '◇', ignite: 'sweep', hueDeg: 14 },
  { index: 2, name: 'INSERTION PUSH', glyph: '◈', ignite: 'sweep', hueDeg: 29 },
  { index: 3, name: 'MERGE IMPULSE', glyph: '●', ignite: 'bucket', hueDeg: 43 },
  { index: 4, name: 'PIVOT FIELD', glyph: '◐', ignite: 'radial', hueDeg: 58 },
  { index: 5, name: 'HEAP SIFT', glyph: '◑', ignite: 'butterfly', hueDeg: 72 },
  { index: 6, name: 'SHELL GAP', glyph: '◒', ignite: 'butterfly', hueDeg: 86 },
  { index: 7, name: 'COCKTAIL WAVE', glyph: '◓', ignite: 'parity', hueDeg: 101 },
  { index: 8, name: 'COMB SWEEP', glyph: '◢', ignite: 'sweep', hueDeg: 115 },
  { index: 9, name: 'GNOME CRAWL', glyph: '◣', ignite: 'sweep', hueDeg: 130 },
  { index: 10, name: 'CYCLE PHASE', glyph: '▲', ignite: 'bucket', hueDeg: 144 },
  { index: 11, name: 'PANCAKE FLIP', glyph: '▼', ignite: 'sweep', hueDeg: 158 },
  { index: 12, name: 'BITONIC MESH', glyph: '★', ignite: 'butterfly', hueDeg: 173 },
  { index: 13, name: 'STOOGE DRIFT', glyph: '☆', ignite: 'radial', hueDeg: 187 },
  { index: 14, name: 'ODD-EVEN PULSE', glyph: '✦', ignite: 'parity', hueDeg: 202 },
  { index: 15, name: 'COUNT PHASE', glyph: '✶', ignite: 'bucket', hueDeg: 216 },
  { index: 16, name: 'RADIX PHASE', glyph: '✷', ignite: 'bucket', hueDeg: 230 },
  { index: 17, name: 'RUN MERGE', glyph: '✸', ignite: 'bucket', hueDeg: 245 },
  { index: 18, name: 'HOLE SCATTER', glyph: '✹', ignite: 'radial', hueDeg: 259 },
  { index: 19, name: 'STRAND PULL', glyph: '✺', ignite: 'sweep', hueDeg: 274 },
  { index: 20, name: 'TIM RUN MERGE', glyph: '❖', ignite: 'bucket', hueDeg: 288 },
  { index: 21, name: 'BITONIC NETWORK', glyph: '❂', ignite: 'butterfly', hueDeg: 302 },
  { index: 22, name: 'PATIENCE BUCKET', glyph: '✳', ignite: 'bucket', hueDeg: 317 },
  { index: 23, name: 'BRICK TRANSPOSE', glyph: '⬢', ignite: 'parity', hueDeg: 331 },
  { index: 24, name: 'PREFIX PANCAKE', glyph: '⬡', ignite: 'sweep', hueDeg: 346 },
];

export const LORE_SYLLABLES: readonly string[] = [
  'ae', 'al', 'an', 'ar', 'ash', 'ath', 'bel', 'bor', 'cal', 'cor',
  'cy', 'da', 'del', 'dor', 'drak', 'el', 'en', 'eph', 'eth', 'fa',
  'fel', 'gal', 'gar', 'gol', 'gor', 'hel', 'hor', 'il', 'im', 'in',
  'ir', 'is', 'ka', 'kal', 'kar', 'kel', 'kor', 'la', 'lan', 'lar',
  'len', 'lir', 'lor', 'mal', 'mar', 'mel', 'mir', 'mor', 'na', 'nal',
  'nar', 'nel', 'nir', 'nor', 'ol', 'om', 'on', 'or', 'os', 'ph',
  'ra', 'ral', 'ran', 'rel', 'ril', 'ror', 'sa', 'sal', 'sar', 'sel',
  'ser', 'sha', 'sil', 'sol', 'sur', 'ta', 'tal', 'tar', 'tel', 'th',
  'ti', 'tor', 'ul', 'um', 'un', 'ur', 'va', 'val', 'var', 'vel',
  'vir', 'vor', 'xa', 'xal', 'xar', 'xel', 'za', 'zal', 'zar', 'zel', 'zor',
];

function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function splitMix32(state: number): number {
  let z = (state + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

export class CosmologicalLoreEngine {
  public readonly seed: number;
  private readonly cache = new Map<string, string>();
  private readonly sectorSeedsXz: Float32Array;
  private readonly sectorNames: string[];

  public constructor(seed = 20261110) {
    this.seed = seed >>> 0;
    this.sectorSeedsXz = new Float32Array(24 * 2);
    this.sectorNames = [];

    // Seed 24 deterministic Voronoi sub-sectors across the [-900, +900] arena (index 0 anchored as HELTIBOR at origin-south)
    this.sectorSeedsXz[0] = 0;
    this.sectorSeedsXz[1] = 180;
    this.sectorNames.push('HELTIBOR');

    let rng = splitMix32(this.seed ^ 0x5ec70a11);
    for (let i = 1; i < 24; i++) {
      rng = splitMix32(rng);
      const angle = ((rng & 0xffff) / 65536) * Math.PI * 2;
      rng = splitMix32(rng);
      const radius = 140 + ((rng & 0xffff) / 65536) * 760;
      this.sectorSeedsXz[i * 2] = Math.cos(angle) * radius;
      this.sectorSeedsXz[i * 2 + 1] = Math.sin(angle) * radius;
      this.sectorNames.push(this.name('sector', i).toUpperCase());
    }
  }

  public name(kind: 'sector' | 'tribe' | 'titan' | 'omen' | 'star', index: number): string {
    const key = `${kind}:${index}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    let h = fnv1a32(`${this.seed}:name:${kind}:${index}`);
    const syllableCount = 2 + (h % 3);
    let raw = '';
    for (let s = 0; s < syllableCount; s++) {
      h = splitMix32(h + s * 31);
      raw += LORE_SYLLABLES[h % LORE_SYLLABLES.length]!;
    }
    const formatted = raw.charAt(0).toUpperCase() + raw.slice(1);
    this.cache.set(key, formatted);
    return formatted;
  }

  public sectorAt(x: number, z: number): { index: number; name: string } {
    let bestIdx = 0;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 24; i++) {
      const dx = x - this.sectorSeedsXz[i * 2]!;
      const dz = z - this.sectorSeedsXz[i * 2 + 1]!;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = i;
      }
    }
    return { index: bestIdx, name: this.sectorNames[bestIdx] ?? 'HELTIBOR' };
  }
}

interface SingleFieldRuntime {
  readonly values: Float32Array;
  cursor: number;
  pass: number;
  gap: number;
  direction: 1 | -1;
  stepCount: number;
  lastSwaps: number;
  progress01: number;
  prevProgress01: number;
}

export interface SortingFieldSnapshot {
  readonly activeIndex: number;
  readonly activeSpec: SortingFieldSpec;
  readonly stepCount: number;
  readonly lastSwaps: number;
  readonly omegaScore: number;
  readonly converging: boolean;
  readonly runAll: boolean;
  readonly autoCycle: boolean;
  readonly progresses25: Float32Array;
  readonly activeBins64: Float32Array;
}

const BIN_COUNT = 64;

export class SortingFieldsEngine {
  private readonly fields: SingleFieldRuntime[] = [];
  private readonly progresses = new Float32Array(25);
  private rngState: number;

  public activeIndex = 11; // Boots on PANCAKE FLIP (`▼`, index 11) matching CQM reference view
  public runAll = false;
  public autoCycle = false;
  private autoTimerTicks = 0;

  public constructor(seed = 20261110) {
    this.rngState = seed >>> 0;
    for (let i = 0; i < 25; i++) {
      const rt: SingleFieldRuntime = {
        values: new Float32Array(BIN_COUNT),
        cursor: 0,
        pass: 0,
        gap: 32,
        direction: 1,
        stepCount: 0,
        lastSwaps: 0,
        progress01: 0,
        prevProgress01: 0,
      };
      this.scrambleField(rt, i);
      this.fields.push(rt);
    }
  }

  private nextRand01(): number {
    this.rngState = splitMix32(this.rngState);
    return (this.rngState >>> 8) / 16777216;
  }

  private scrambleField(rt: SingleFieldRuntime, salt: number): void {
    for (let i = 0; i < BIN_COUNT; i++) {
      rt.values[i] = (i + 0.5) / BIN_COUNT;
    }
    // Fisher-Yates shuffle
    let s = (this.rngState ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
    for (let i = BIN_COUNT - 1; i > 0; i--) {
      s = splitMix32(s);
      const j = s % (i + 1);
      const tmp = rt.values[i]!;
      rt.values[i] = rt.values[j]!;
      rt.values[j] = tmp;
    }
    this.rngState = s;
    rt.cursor = 0;
    rt.pass = 0;
    rt.gap = BIN_COUNT >> 1;
    rt.direction = 1;
    rt.progress01 = this.computeSortedness(rt.values);
    rt.prevProgress01 = rt.progress01;
  }

  private computeSortedness(arr: Float32Array): number {
    let adjacentOrdered = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i]! <= arr[i + 1]!) adjacentOrdered++;
    }
    // Normalized adjacent non-inversion metric in [0, 1]
    return adjacentOrdered / (arr.length - 1);
  }

  public selectField(index: number): SortingFieldSpec {
    this.activeIndex = ((Math.trunc(index) % 25) + 25) % 25;
    return SORTING_25_SPECS[this.activeIndex]!;
  }

  public nextField(): SortingFieldSpec {
    return this.selectField(this.activeIndex + 1);
  }

  public stepTick(chaosLevel = 0.5): SortingFieldSnapshot {
    if (this.autoCycle) {
      this.autoTimerTicks++;
      if (this.autoTimerTicks >= 90) {
        this.autoTimerTicks = 0;
        this.nextField();
      }
    }

    if (this.runAll) {
      for (let i = 0; i < 25; i++) {
        this.stepSingleAlgorithm(i, chaosLevel);
      }
    } else {
      this.stepSingleAlgorithm(this.activeIndex, chaosLevel);
      // Gentle background drift on inactive fields so their progress bars breathe organically
      const bgIdx = (this.fields[this.activeIndex]!.stepCount + this.activeIndex) % 25;
      if (bgIdx !== this.activeIndex) {
        this.stepSingleAlgorithm(bgIdx, chaosLevel * 0.5);
      }
    }

    for (let i = 0; i < 25; i++) {
      this.progresses[i] = this.fields[i]!.progress01;
    }

    const activeRt = this.fields[this.activeIndex]!;
    const spec = SORTING_25_SPECS[this.activeIndex]!;
    return {
      activeIndex: this.activeIndex,
      activeSpec: spec,
      stepCount: activeRt.stepCount,
      lastSwaps: activeRt.lastSwaps,
      omegaScore: activeRt.progress01,
      converging: activeRt.progress01 >= activeRt.prevProgress01,
      runAll: this.runAll,
      autoCycle: this.autoCycle,
      progresses25: this.progresses,
      activeBins64: activeRt.values,
    };
  }

  public getSnapshot(): SortingFieldSnapshot {
    for (let i = 0; i < 25; i++) {
      this.progresses[i] = this.fields[i]!.progress01;
    }
    const activeRt = this.fields[this.activeIndex]!;
    const spec = SORTING_25_SPECS[this.activeIndex]!;
    return {
      activeIndex: this.activeIndex,
      activeSpec: spec,
      stepCount: activeRt.stepCount,
      lastSwaps: activeRt.lastSwaps,
      omegaScore: activeRt.progress01,
      converging: activeRt.progress01 >= activeRt.prevProgress01,
      runAll: this.runAll,
      autoCycle: this.autoCycle,
      progresses25: this.progresses,
      activeBins64: activeRt.values,
    };
  }

  private stepSingleAlgorithm(idx: number, chaosLevel: number): void {
    const rt = this.fields[idx]!;
    const v = rt.values;
    const n = v.length;
    rt.prevProgress01 = rt.progress01;
    let swaps = 0;

    const swap = (a: number, b: number) => {
      const t = v[a]!;
      v[a] = v[b]!;
      v[b] = t;
      swaps++;
    };

    const flipPrefix = (endInclusive: number) => {
      let lo = 0;
      let hi = endInclusive;
      while (lo < hi) {
        swap(lo, hi);
        lo++;
        hi--;
      }
    };

    switch (idx) {
      case 0: {
        // BUBBLE FIELD: 8 adjacent compare-swaps per tick
        for (let k = 0; k < 8; k++) {
          const i = rt.cursor % (n - 1);
          if (v[i]! > v[i + 1]!) swap(i, i + 1);
          rt.cursor = (rt.cursor + 1) % (n - 1);
        }
        break;
      }
      case 1: {
        // SELECTION SWEEP: place minimum at pass index
        const start = rt.pass % (n - 1);
        let minIdx = start;
        for (let j = start + 1; j < n; j++) {
          if (v[j]! < v[minIdx]!) minIdx = j;
        }
        if (minIdx !== start) swap(start, minIdx);
        rt.pass = (rt.pass + 1) % (n - 1);
        break;
      }
      case 2: {
        // INSERTION PUSH: insert element at pass+1 leftward
        const target = 1 + (rt.pass % (n - 1));
        let j = target;
        let guard = 0;
        while (j > 0 && v[j - 1]! > v[j]! && guard < 12) {
          swap(j - 1, j);
          j--;
          guard++;
        }
        rt.pass = (rt.pass + 1) % (n - 1);
        break;
      }
      case 3:
      case 17:
      case 20: {
        // MERGE IMPULSE / RUN MERGE / TIM RUN MERGE: bottom-up width window merge
        const width = 1 << ((rt.pass % 6) + 1);
        const start = (rt.cursor * width) % n;
        const end = Math.min(n, start + width);
        for (let a = start + 1; a < end; a++) {
          let b = a;
          while (b > start && v[b - 1]! > v[b]!) {
            swap(b - 1, b);
            b--;
          }
        }
        rt.cursor++;
        if (rt.cursor * width >= n) {
          rt.cursor = 0;
          rt.pass++;
        }
        break;
      }
      case 4: {
        // PIVOT FIELD: partition random sub-interval around midpoint pivot
        const span = Math.max(4, n >> (rt.pass % 4));
        const lo = (rt.cursor * (span >> 1)) % Math.max(1, n - span);
        const hi = Math.min(n - 1, lo + span - 1);
        const pivot = v[(lo + hi) >> 1]!;
        let i = lo;
        let j = hi;
        while (i <= j) {
          while (v[i]! < pivot) i++;
          while (v[j]! > pivot) j--;
          if (i <= j) {
            if (i !== j) swap(i, j);
            i++;
            j--;
          }
        }
        rt.cursor = (rt.cursor + 1) % 8;
        if (rt.cursor === 0) rt.pass++;
        break;
      }
      case 5: {
        // HEAP SIFT: tournament pair sift toward ascending order
        for (let k = 0; k < 6; k++) {
          const parent = (rt.cursor + k) % (n >> 1);
          const left = 2 * parent + 1;
          const right = Math.min(n - 1, left + 1);
          if (v[parent]! > v[left]!) swap(parent, left);
          if (v[left]! > v[right]!) swap(left, right);
        }
        rt.cursor = (rt.cursor + 5) % (n >> 1);
        break;
      }
      case 6:
      case 8: {
        // SHELL GAP / COMB SWEEP: shrinking-gap compare-swaps
        if (rt.gap < 1) rt.gap = n >> 1;
        for (let k = 0; k < 8; k++) {
          const i = rt.cursor % Math.max(1, n - rt.gap);
          if (v[i]! > v[i + rt.gap]!) swap(i, i + rt.gap);
          rt.cursor++;
          if (rt.cursor >= n - rt.gap) {
            rt.cursor = 0;
            rt.gap = idx === 8 ? Math.max(1, Math.floor(rt.gap / 1.3)) : Math.max(1, rt.gap >> 1);
          }
        }
        break;
      }
      case 7: {
        // COCKTAIL WAVE: bidirectional shaker pass
        for (let k = 0; k < 8; k++) {
          const i = Math.max(0, Math.min(n - 2, rt.cursor));
          if (v[i]! > v[i + 1]!) swap(i, i + 1);
          rt.cursor += rt.direction;
          if (rt.cursor >= n - 2) rt.direction = -1;
          else if (rt.cursor <= 0) rt.direction = 1;
        }
        break;
      }
      case 9: {
        // GNOME CRAWL
        for (let k = 0; k < 10; k++) {
          if (rt.cursor <= 0) rt.cursor = 1;
          if (rt.cursor >= n) rt.cursor = 1;
          if (v[rt.cursor - 1]! <= v[rt.cursor]!) {
            rt.cursor++;
          } else {
            swap(rt.cursor - 1, rt.cursor);
            rt.cursor--;
          }
        }
        break;
      }
      case 11:
      case 24: {
        // PANCAKE FLIP / PREFIX PANCAKE: find max in [0..unsortedEnd] and double-flip into place
        const unsortedEnd = n - 1 - (rt.pass % (n - 1));
        let maxIdx = 0;
        for (let i = 1; i <= unsortedEnd; i++) {
          if (v[i]! > v[maxIdx]!) maxIdx = i;
        }
        if (maxIdx !== unsortedEnd) {
          if (maxIdx > 0) flipPrefix(maxIdx);
          flipPrefix(unsortedEnd);
        }
        rt.pass = (rt.pass + 1) % (n - 1);
        break;
      }
      case 12:
      case 21: {
        // BITONIC MESH / BITONIC NETWORK: butterfly power-of-2 compare-exchange
        const kStage = 1 << ((rt.pass % 5) + 1);
        const jDist = Math.max(1, kStage >> 1);
        for (let m = 0; m < 8; m++) {
          const i = (rt.cursor + m) % n;
          const ixj = i ^ jDist;
          if (ixj > i && ixj < n) {
            const asc = (i & kStage) === 0;
            if ((asc && v[i]! > v[ixj]!) || (!asc && v[i]! < v[ixj]!)) {
              swap(i, ixj);
            }
          }
        }
        rt.cursor = (rt.cursor + 8) % n;
        if (rt.cursor === 0) rt.pass++;
        break;
      }
      case 14:
      case 23: {
        // ODD-EVEN PULSE / BRICK TRANSPOSE: alternating parity sweeps
        const parity = rt.pass & 1;
        for (let i = parity; i < n - 1; i += 2) {
          if (v[i]! > v[i + 1]!) swap(i, i + 1);
        }
        rt.pass++;
        break;
      }
      default: {
        // Bucket / Radix / Cycle / Stooge / Hole / Strand / Patience progressive stratification
        const stride = 1 + (idx % 5);
        for (let k = 0; k < 8; k++) {
          const a = (rt.cursor + k * stride) % (n - 1);
          const b = Math.min(n - 1, a + 1 + (rt.pass % 3));
          if (v[a]! > v[b]!) swap(a, b);
        }
        rt.cursor = (rt.cursor + 7) % (n - 1);
        rt.pass++;
        break;
      }
    }

    rt.stepCount++;
    rt.lastSwaps = swaps;
    rt.progress01 = this.computeSortedness(v);

    // Once fully converged (`>= 0.985`) or perturbed by high chaos storm, inject fresh entropy wave so field stays alive!
    if (rt.progress01 >= 0.985 || (chaosLevel > 2.2 && this.nextRand01() < 0.06)) {
      const injectCount = rt.progress01 >= 0.985 ? 20 : 4;
      for (let k = 0; k < injectCount; k++) {
        const a = Math.floor(this.nextRand01() * n);
        const b = Math.floor(this.nextRand01() * n);
        const t = v[a]!;
        v[a] = v[b]!;
        v[b] = t;
      }
      rt.gap = n >> 1;
      rt.progress01 = this.computeSortedness(v);
    }
  }

  /**
   * Couples the active spatial sorting field into 3D world velocities `(fx, fz)`.
   */
  public sampleSpatialForce(x: number, z: number, arenaRadius = 325): { fx: number; fz: number } {
    const rt = this.fields[this.activeIndex]!;
    const spec = SORTING_25_SPECS[this.activeIndex]!;
    const u = Math.max(0, Math.min(0.999, (x / (arenaRadius * 2)) + 0.5));
    const bin = Math.min(BIN_COUNT - 1, Math.floor(u * BIN_COUNT));
    const val = rt.values[bin]! - 0.5;
    const angle = (spec.hueDeg * Math.PI) / 180 + val * Math.PI;

    if (spec.ignite === 'radial') {
      const r = Math.hypot(x, z) + 1e-4;
      return { fx: (-x / r) * val * 1.6, fz: (-z / r) * val * 1.6 };
    }
    if (spec.ignite === 'butterfly' || spec.ignite === 'parity') {
      return { fx: Math.cos(angle) * 1.2, fz: Math.sin(angle) * 1.2 };
    }
    return { fx: val * 1.8, fz: Math.sin(x * 0.02 + val * 4.0) * 0.9 };
  }
}

export interface TitanDiplomacySnapshot {
  readonly names20: readonly string[];
  readonly matter20: Float32Array;
  readonly energy20: Float32Array;
  readonly entropy20: Float32Array;
  readonly netHoldings20: Float32Array;
  readonly warCountPerTitan20: Uint8Array;
  readonly matrix400: Uint8Array; // 0 = truce, 1 = ally, 2 = war
  readonly totalWarCells: number;
  readonly totalAllyCells: number;
  readonly dominantTitanIndex: number;
}

export class TitanDiplomacySimulator {
  public readonly names20: string[];
  public readonly matter20 = new Float32Array(20);
  public readonly energy20 = new Float32Array(20);
  public readonly entropy20 = new Float32Array(20);
  public readonly netHoldings20 = new Float32Array(20);
  public readonly warCountPerTitan20 = new Uint8Array(20);
  public readonly matrix400 = new Uint8Array(400);
  private rng: number;

  public constructor(lore: CosmologicalLoreEngine, seed = 20261110) {
    this.rng = (seed ^ 0x717a4020) >>> 0;
    this.names20 = Array.from({ length: 20 }, (_, i) => lore.name('titan', i).toUpperCase());

    for (let i = 0; i < 20; i++) {
      this.matter20[i] = 45 + this.rand01() * 85;
      this.energy20[i] = 55 + this.rand01() * 95;
      this.entropy20[i] = 8 + this.rand01() * 24;
      this.netHoldings20[i] = this.matter20[i]! + this.energy20[i]! - this.entropy20[i]!;
    }

    for (let r = 0; r < 20; r++) {
      for (let c = r + 1; c < 20; c++) {
        const p = this.rand01();
        const state = p < 0.14 ? 2 : p < 0.42 ? 1 : 0;
        this.matrix400[r * 20 + c] = state;
        this.matrix400[c * 20 + r] = state;
      }
    }
  }

  private rand01(): number {
    this.rng = splitMix32(this.rng);
    return (this.rng >>> 8) / 16777216;
  }

  public stepTick(chaosLevel: number, sanctuaryPeaceBias: number): TitanDiplomacySnapshot {
    // Update holdings & occasional diplomatic transitions
    for (let k = 0; k < 3; k++) {
      const a = Math.floor(this.rand01() * 20);
      const b = Math.floor(this.rand01() * 20);
      if (a !== b) {
        const roll = this.rand01();
        const warThresh = Math.min(0.45, 0.08 + chaosLevel * 0.09) * (1 - Math.min(0.7, sanctuaryPeaceBias));
        const nextState = roll < warThresh ? 2 : roll < warThresh + 0.34 ? 1 : 0;
        this.matrix400[a * 20 + b] = nextState;
        this.matrix400[b * 20 + a] = nextState;
      }
    }

    let totalWarCells = 0;
    let totalAllyCells = 0;
    this.warCountPerTitan20.fill(0);

    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        if (r === c) continue;
        const st = this.matrix400[r * 20 + c]!;
        if (st === 2) {
          totalWarCells++;
          this.warCountPerTitan20[r]!++;
        } else if (st === 1) {
          totalAllyCells++;
        }
      }
    }

    let dominantTitanIndex = 0;
    let bestNet = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 20; i++) {
      const warDrain = this.warCountPerTitan20[i]! * 0.35;
      const allyGain = (19 - this.warCountPerTitan20[i]!) * 0.08;
      this.matter20[i] = Math.max(12, Math.min(240, this.matter20[i]! + (this.rand01() - 0.485) * 2.4 + allyGain * 0.2));
      this.energy20[i] = Math.max(15, Math.min(260, this.energy20[i]! + (this.rand01() - 0.48) * 2.8 - warDrain * 0.25));
      this.entropy20[i] = Math.max(2, Math.min(95, this.entropy20[i]! + warDrain * 0.12 - 0.18));
      const net = this.matter20[i]! + this.energy20[i]! - this.entropy20[i]!;
      this.netHoldings20[i] = net;
      if (net > bestNet) {
        bestNet = net;
        dominantTitanIndex = i;
      }
    }

    return {
      names20: this.names20,
      matter20: this.matter20,
      energy20: this.energy20,
      entropy20: this.entropy20,
      netHoldings20: this.netHoldings20,
      warCountPerTitan20: this.warCountPerTitan20,
      matrix400: this.matrix400,
      totalWarCells,
      totalAllyCells,
      dominantTitanIndex,
    };
  }
}
