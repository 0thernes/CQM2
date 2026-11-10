/**
 * CQM2 v2.1.0 9-Song Procedural Dark-Endgame Web Audio & Kerr QNM Synthesizer (`src/render/audio-synth.ts`).
 * - Initializes `AudioContext` strictly upon explicit user interaction (`toggle()`).
 * - Features 9 procedural harmonic modes + Glossodrom chord arpeggiation + live `AnalyserNode` 32-bin FFT spectrum!
 * - Stays muted by default with smooth click-free gain ramps.
 */

export interface CosmicSongPreset {
  readonly id: number;
  readonly title: string;
  readonly rootHz: number;
  readonly ratios: readonly [number, number, number];
  readonly waveA: OscillatorType;
  readonly waveB: OscillatorType;
}

export const COSMIC_9_SONGS: readonly CosmicSongPreset[] = [
  { id: 0, title: '1. Kerr Horizon Drone (A1)', rootHz: 55.0, ratios: [1.0, 1.4983, 2.0], waveA: 'sine', waveB: 'triangle' },
  { id: 1, title: '2. Abyssal Hydrothermal Choir (D1)', rootHz: 36.71, ratios: [1.0, 1.5, 2.25], waveA: 'sine', waveB: 'sine' },
  { id: 2, title: '3. Hoggar 63-Hexagon Fugue (F#1)', rootHz: 46.25, ratios: [1.0, 1.4142, 2.0], waveA: 'triangle', waveB: 'sine' },
  { id: 3, title: '4. Asmodenius Cortical Theta (C2)', rootHz: 65.41, ratios: [1.0, 1.25, 1.5], waveA: 'sine', waveB: 'triangle' },
  { id: 4, title: '5. Xylos Hyperbolic Medusa (G1)', rootHz: 49.0, ratios: [1.0, 1.3333, 1.7778], waveA: 'sine', waveB: 'sine' },
  { id: 5, title: '6. Glitchling Cerebellar Pulse (E1)', rootHz: 41.2, ratios: [1.0, 1.5, 1.875], waveA: 'triangle', waveB: 'triangle' },
  { id: 6, title: '7. Big Tree Sanctuary Chimes (B1)', rootHz: 61.74, ratios: [1.0, 1.2599, 1.4983], waveA: 'sine', waveB: 'sine' },
  { id: 7, title: '8. Voynich Anyon Golden Braid (Phi)', rootHz: 52.8, ratios: [1.0, 1.618, 2.618], waveA: 'sine', waveB: 'triangle' },
  { id: 8, title: '9. Penrose Ergosphere Superradiance', rootHz: 44.0, ratios: [1.0, 1.3348, 2.0], waveA: 'triangle', waveB: 'sine' },
];

export class CosmicAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private oscA: OscillatorNode | null = null;
  private oscB: OscillatorNode | null = null;
  private oscC: OscillatorNode | null = null;
  private readonly fftBins = new Uint8Array(32);

  private active = false;
  private songIndex = 0;
  private userVolume = 0.09;

  public isPlaying(): boolean {
    return this.active;
  }

  public getCurrentSong(): CosmicSongPreset {
    return COSMIC_9_SONGS[this.songIndex] ?? COSMIC_9_SONGS[0]!;
  }

  public setSongIndex(idx: number): CosmicSongPreset {
    this.songIndex = Math.max(0, Math.min(COSMIC_9_SONGS.length - 1, Math.trunc(idx)));
    const preset = this.getCurrentSong();
    if (this.ctx && this.oscA && this.oscB && this.oscC) {
      const now = this.ctx.currentTime;
      this.oscA.type = preset.waveA;
      this.oscB.type = preset.waveB;
      this.oscA.frequency.setTargetAtTime(preset.rootHz * preset.ratios[0], now, 0.15);
      this.oscB.frequency.setTargetAtTime(preset.rootHz * preset.ratios[1], now, 0.15);
      this.oscC.frequency.setTargetAtTime(preset.rootHz * preset.ratios[2], now, 0.15);
    }
    return preset;
  }

  public setVolume(vol01: number): void {
    this.userVolume = Math.max(0.0, Math.min(0.35, vol01 * 0.25));
    if (this.ctx && this.masterGain && this.active) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(Math.max(0.0001, this.userVolume), now, 0.08);
    }
  }

  public toggle(): boolean {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.78;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      const preset = this.getCurrentSong();
      this.oscA = this.ctx.createOscillator();
      this.oscA.type = preset.waveA;
      this.oscA.frequency.setValueAtTime(preset.rootHz * preset.ratios[0], this.ctx.currentTime);

      this.oscB = this.ctx.createOscillator();
      this.oscB.type = preset.waveB;
      this.oscB.frequency.setValueAtTime(preset.rootHz * preset.ratios[1], this.ctx.currentTime);

      this.oscC = this.ctx.createOscillator();
      this.oscC.type = 'sine';
      this.oscC.frequency.setValueAtTime(preset.rootHz * preset.ratios[2], this.ctx.currentTime);

      const gB = this.ctx.createGain();
      gB.gain.setValueAtTime(0.28, this.ctx.currentTime);
      const gC = this.ctx.createGain();
      gC.gain.setValueAtTime(0.16, this.ctx.currentTime);

      this.oscA.connect(this.masterGain);
      this.oscB.connect(gB);
      gB.connect(this.masterGain);
      this.oscC.connect(gC);
      gC.connect(this.masterGain);

      this.oscA.start();
      this.oscB.start();
      this.oscC.start();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.active = !this.active;
    const now = this.ctx.currentTime;
    this.masterGain!.gain.cancelScheduledValues(now);
    this.masterGain!.gain.linearRampToValueAtTime(this.active ? Math.max(0.005, this.userVolume) : 0.0001, now + 0.18);
    return this.active;
  }

  /**
   * Triggers a Leaver Kerr $l=m=2$ QNM ringdown chime (`M*omega = 0.373672 - 0.088962i`) e.g. on TMS Poke!
   */
  public triggerKerrRingdownChime(spinA = 0.84): void {
    if (!this.ctx || !this.masterGain || !this.active) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220.0 + 68.0 * spinA, now);
    env.gain.setValueAtTime(0.14, now);
    env.gain.exponentialRampToValueAtTime(0.0005, now + 0.65);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.68);
  }

  public modulateByPantheon(orderR: number, kerrSpinA: number, glossodromSymbol = 0): void {
    if (!this.ctx || !this.oscA || !this.oscB || !this.oscC || !this.active) return;
    const preset = this.getCurrentSong();
    const now = this.ctx.currentTime;
    const arpDetune = (glossodromSymbol % 16) * 0.45;
    this.oscA.frequency.setTargetAtTime(preset.rootHz * preset.ratios[0] + 4.5 * orderR, now, 0.22);
    this.oscB.frequency.setTargetAtTime(preset.rootHz * preset.ratios[1] + 7.5 * kerrSpinA, now, 0.22);
    this.oscC.frequency.setTargetAtTime(preset.rootHz * preset.ratios[2] + arpDetune, now, 0.25);
  }

  public getFrequencySpectrum32(): Uint8Array {
    if (!this.analyser || !this.active) {
      this.fftBins.fill(0);
      return this.fftBins;
    }
    this.analyser.getByteFrequencyData(this.fftBins);
    return this.fftBins;
  }
}
