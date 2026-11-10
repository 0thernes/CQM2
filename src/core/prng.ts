/**
 * CQM2 Deterministic Seeded Substream PRNG, Physical Constants & Truth-Tier Contracts.
 * Every stochastic draw in CQM2 flows through named isolated substreams (`world`, `genome`, `flaw`,
 * `quantum`, `ecology`, `xenolingua`, `ui`) so toggling UI inspection or congenital Glitchling flaws
 * never perturbs world or evolutionary trajectories (`T-071` bitwise reproducibility).
 */

export type SubstreamName =
  | 'world'
  | 'genome'
  | 'flaw'
  | 'quantum'
  | 'ecology'
  | 'xenolingua'
  | 'benchmark'
  | 'ui';

export type TruthTier =
  | 'EXACT_CONSERVED'
  | 'CALIBRATED_BIOPHYSICAL'
  | 'HEURISTIC_INDICATOR'
  | 'METAPHORICAL_AESTHETIC';

export interface ComputationalIndicatorContract<TValue = number> {
  readonly value: TValue;
  readonly truthTier: TruthTier;
  readonly indicatorOnly: true;
  readonly sentienceClaim: 'NOT_SENTIENT';
  readonly citation: string;
}

export function makeIndicator<TValue>(
  value: TValue,
  truthTier: TruthTier,
  citation: string,
): ComputationalIndicatorContract<TValue> {
  return {
    value,
    truthTier,
    indicatorOnly: true,
    sentienceClaim: 'NOT_SENTIENT',
    citation,
  };
}

export interface GodDialParams {
  /** Rung 1 (Cosmology): Kerr black-hole dimensionless spin a/M in [0, 0.998] */
  kerrSpinA: number;
  /** Rung 1 (Cosmology): 4D manifold warp gain (Lipschitz-clamped <= 0.45 to prevent foldover) */
  manifoldWarpGain: number;
  /** Rung 2 (Quantum): Contextual Pauli coupling strength in [0, 1] */
  quantumContextualityCoupling: number;
  /** Rung 3 (Chemistry): Hydrothermal / solar free-energy influx in kJ/s in [5, 500] */
  freeEnergyInfluxKjPerSec: number;
  /** Rung 4 (Biology): Metabolic basal rate multiplier in [0.25, 3.0] */
  metabolicRateScale: number;
  /** Rung 5 (Cognition): Neuromodulatory plasticity learning-rate scale in [0, 2.5] */
  plasticityScale: number;
  /** Rung 6 (Ecology): Dissolved O2 atmospheric/pelagic saturation in [0.15, 1.5] */
  oxygenSaturation: number;
  /** Rung 7 (Telemetry/Safety): WCAG photosensitive flash ceiling in Hz (hard-clamped <= 2.2 Hz) */
  maxVisualPulseHz: number;
}

export const DEFAULT_GOD_DIALS: Readonly<GodDialParams> = Object.freeze({
  kerrSpinA: 0.84,
  manifoldWarpGain: 0.22,
  quantumContextualityCoupling: 0.65,
  freeEnergyInfluxKjPerSec: 85.0,
  metabolicRateScale: 1.0,
  plasticityScale: 1.0,
  oxygenSaturation: 1.0,
  maxVisualPulseHz: 1.8,
});

export function sanitizeGodDials(raw: Partial<GodDialParams>): GodDialParams {
  const clamp = (v: number | undefined, fb: number, lo: number, hi: number): number => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : fb;
    return Math.min(hi, Math.max(lo, n));
  };
  return {
    kerrSpinA: clamp(raw.kerrSpinA, DEFAULT_GOD_DIALS.kerrSpinA, 0.0, 0.998),
    manifoldWarpGain: clamp(raw.manifoldWarpGain, DEFAULT_GOD_DIALS.manifoldWarpGain, 0.0, 0.45),
    quantumContextualityCoupling: clamp(
      raw.quantumContextualityCoupling,
      DEFAULT_GOD_DIALS.quantumContextualityCoupling,
      0.0,
      1.0,
    ),
    freeEnergyInfluxKjPerSec: clamp(
      raw.freeEnergyInfluxKjPerSec,
      DEFAULT_GOD_DIALS.freeEnergyInfluxKjPerSec,
      5.0,
      500.0,
    ),
    metabolicRateScale: clamp(raw.metabolicRateScale, DEFAULT_GOD_DIALS.metabolicRateScale, 0.25, 3.0),
    plasticityScale: clamp(raw.plasticityScale, DEFAULT_GOD_DIALS.plasticityScale, 0.0, 2.5),
    oxygenSaturation: clamp(raw.oxygenSaturation, DEFAULT_GOD_DIALS.oxygenSaturation, 0.15, 1.5),
    maxVisualPulseHz: clamp(raw.maxVisualPulseHz, DEFAULT_GOD_DIALS.maxVisualPulseHz, 0.1, 2.2),
  };
}

const MASK64 = 0xffffffffffffffffn;

export function hashString64(text: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i) & 0xff);
    h = (h * 0x00000100000001b3n) & MASK64;
  }
  return h;
}

/**
 * Exact 64-bit SplitMix64 deterministic generator with Box-Muller cached normal variate.
 */
export class DeterministicRng {
  private state: bigint;
  private spareGaussian: number | null = null;

  public constructor(seed: bigint | number) {
    const raw = typeof seed === 'bigint' ? seed : BigInt(Math.trunc(seed));
    this.state = (raw & MASK64) === 0n ? 0x9e3779b97f4a7c15n : raw & MASK64;
  }

  public getState(): bigint {
    return this.state;
  }

  public getSpareGaussian(): number | null {
    return this.spareGaussian;
  }

  public setState(newState: bigint, spareGaussian: number | null = null): void {
    this.state = newState & MASK64;
    this.spareGaussian = spareGaussian;
  }

  public nextU64(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    return (z ^ (z >> 31n)) & MASK64;
  }

  public nextU32(): number {
    return Number(this.nextU64() & 0xffffffffn) >>> 0;
  }

  /** Uniform float in `[0, 1)` with full 53-bit IEEE-754 mantissa resolution. */
  public nextFloat(): number {
    const mant53 = Number(this.nextU64() >> 11n);
    return mant53 * (1.0 / 9007199254740992.0);
  }

  public nextRange(min: number, max: number): number {
    return min + (max - min) * this.nextFloat();
  }

  public nextInt(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) return minInclusive;
    const span = maxExclusive - minInclusive;
    return minInclusive + Math.floor(this.nextFloat() * span);
  }

  public nextGaussian(mean = 0.0, stdDev = 1.0): number {
    if (this.spareGaussian !== null) {
      const g = this.spareGaussian;
      this.spareGaussian = null;
      return mean + stdDev * g;
    }
    let u = 0;
    let v = 0;
    while (u <= 1e-12) u = this.nextFloat();
    v = this.nextFloat();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    const z0 = mag * Math.cos(2.0 * Math.PI * v);
    this.spareGaussian = mag * Math.sin(2.0 * Math.PI * v);
    return mean + stdDev * z0;
  }

  public shuffleInPlace<T>(arr: T[] | Uint16Array | Uint32Array): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j] as never;
      arr[j] = tmp as never;
    }
  }
}

/**
 * Manages cryptographically separated SplitMix64 substreams derived from a single master seed.
 */
export class SubstreamPrngHub {
  public readonly masterSeed: bigint;
  private readonly streams = new Map<SubstreamName, DeterministicRng>();

  public constructor(masterSeed: bigint | number = 20261110n) {
    this.masterSeed = (typeof masterSeed === 'bigint' ? masterSeed : BigInt(Math.trunc(masterSeed))) & MASK64;
  }

  public stream(name: SubstreamName): DeterministicRng {
    let rng = this.streams.get(name);
    if (!rng) {
      const mixedSeed = (this.masterSeed ^ hashString64(`cqm2::substream::${name}`)) & MASK64;
      rng = new DeterministicRng(mixedSeed);
      this.streams.set(name, rng);
    }
    return rng;
  }

  public snapshotStates(): Record<SubstreamName, string> {
    const names: SubstreamName[] = ['world', 'genome', 'flaw', 'quantum', 'ecology', 'xenolingua', 'benchmark', 'ui'];
    const out = {} as Record<SubstreamName, string>;
    for (const n of names) {
      out[n] = '0x' + this.stream(n).getState().toString(16).padStart(16, '0');
    }
    return out;
  }

  public snapshotFullStates(): Record<SubstreamName, { stateHex: string; spare: number | null }> {
    const names: SubstreamName[] = ['world', 'genome', 'flaw', 'quantum', 'ecology', 'xenolingua', 'benchmark', 'ui'];
    const out = {} as Record<SubstreamName, { stateHex: string; spare: number | null }>;
    for (const n of names) {
      const st = this.stream(n);
      out[n] = {
        stateHex: '0x' + st.getState().toString(16).padStart(16, '0'),
        spare: st.getSpareGaussian(),
      };
    }
    return out;
  }

  public restoreStates(snapshot: Partial<Record<SubstreamName, string>>): void {
    for (const [k, hex] of Object.entries(snapshot)) {
      if (typeof hex === 'string') {
        this.stream(k as SubstreamName).setState(BigInt(hex));
      }
    }
  }

  public restoreFullStates(snapshot: Partial<Record<SubstreamName, { stateHex: string; spare: number | null }>>): void {
    for (const [k, entry] of Object.entries(snapshot)) {
      if (entry && typeof entry.stateHex === 'string') {
        this.stream(k as SubstreamName).setState(BigInt(entry.stateHex), entry.spare ?? null);
      }
    }
  }
}
