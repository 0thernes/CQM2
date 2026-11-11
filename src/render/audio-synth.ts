/**
 * CQM2 v2.2.0 — 9-Song Procedural CQM Ambient Synthesizer, SFX Palette & Kerr QNM Audio Engine (`src/render/audio-synth.ts`).
 *
 * Implements the exact 9 CQM songs (`VOIDCROWN` .. `DEEP MERIDIAN`) over the 10-step natural minor scale
 * (`F_NOTES = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15]` rooted at `C3 = 130.81 Hz`), beat-scheduled chord chorus,
 * melody, arpeggio, sub-bass, stereo cathedral impulse-response reverb, 8 procedural SFX voices,
 * `N(2)` dark-mode pitch/filter bend, and Leaver Kerr $l=m=2$ QNM ringdown chimes.
 */

export interface CosmicSongPreset {
  readonly id: number;
  readonly title: string;
  readonly shortName: string;
  readonly bpm: number;
  readonly rootHz: number;
  readonly ratios: readonly [number, number, number];
  readonly waveA: OscillatorType;
  readonly waveB: OscillatorType;
  readonly fBase: number;
  readonly chords: ReadonlyArray<readonly number[]>;
  readonly mel: readonly number[];
}

export const SFX_TYPES = [
  'split',
  'burst',
  'mutate',
  'ambient',
  'warp',
  'crystallize',
  'decay',
  'resonance',
] as const;

export type SfxKind = (typeof SFX_TYPES)[number];

const F_NOTES: readonly number[] = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

function noteFreq(degree: number): number {
  const safe = Math.max(0, Math.trunc(degree));
  const semi = F_NOTES[safe % 10]! + Math.floor(safe / 10) * 12;
  return 130.81 * Math.pow(2, semi / 12);
}

export const COSMIC_9_SONGS: readonly CosmicSongPreset[] = [
  {
    id: 0,
    title: 'VOIDCROWN',
    shortName: 'VOIDCROWN',
    bpm: 48,
    rootHz: 65.41,
    ratios: [1.0, 1.4983, 2.0],
    waveA: 'sawtooth',
    waveB: 'triangle',
    fBase: 520,
    chords: [[0, 4, 7, 11], [0, 3, 8, 12], [0, 5, 9, 14], [0, 2, 7, 15]],
    mel: [0, 2, 4, 7, 11, 14, 16, 14, 11, 9, 7, 4, 2, 0, 4, 7, 11, 9, 7, 2],
  },
  {
    id: 1,
    title: 'BLACK MERIDIAN',
    shortName: 'BLACK MERIDIAN',
    bpm: 156,
    rootHz: 55.0,
    ratios: [1.0, 1.5, 2.25],
    waveA: 'square',
    waveB: 'square',
    fBase: 760,
    chords: [[0, 2, 5, 7], [0, 2, 6, 9], [0, 5, 7, 11], [0, 3, 5, 8]],
    mel: [0, 5, 3, 8, 6, 9, 8, 11, 9, 6, 3, 1],
  },
  {
    id: 2,
    title: 'ELDER ENGINE',
    shortName: 'ELDER ENGINE',
    bpm: 84,
    rootHz: 49.0,
    ratios: [1.0, 1.4142, 2.0],
    waveA: 'sawtooth',
    waveB: 'sawtooth',
    fBase: 680,
    chords: [[0, 5, 8, 13], [0, 3, 7, 12], [0, 6, 10, 15], [0, 2, 9, 14]],
    mel: [0, 5, 0, 8, 5, 10, 8, 13, 10, 8, 6, 3, 6, 9, 13, 15, 13, 9, 5, 0],
  },
  {
    id: 3,
    title: 'LAST THEOREM',
    shortName: 'LAST THEOREM',
    bpm: 104,
    rootHz: 65.41,
    ratios: [1.0, 1.25, 1.5],
    waveA: 'triangle',
    waveB: 'sawtooth',
    fBase: 1040,
    chords: [[0, 4, 8, 12], [0, 5, 9, 15], [0, 3, 10, 16], [0, 7, 11, 17]],
    mel: [4, 7, 11, 14, 17, 19, 17, 14, 12, 9, 7, 4, 2, 0, 2, 7, 11, 16, 14, 9],
  },
  {
    id: 4,
    title: 'QUANTUM',
    shortName: 'QUANTUM',
    bpm: 140,
    rootHz: 58.27,
    ratios: [1.0, 1.3333, 1.7778],
    waveA: 'square',
    waveB: 'sawtooth',
    fBase: 600,
    chords: [[0, 2, 4, 8], [0, 4, 6, 10], [0, 2, 8], [0, 6, 10]],
    mel: [0, 2, 4, 6, 8, 10, 8, 6, 4, 2, 0, 10],
  },
  {
    id: 5,
    title: 'STARKILLER REQUIEM',
    shortName: 'STARKILLER REQ.',
    bpm: 64,
    rootHz: 43.65,
    ratios: [1.0, 1.5, 1.875],
    waveA: 'sawtooth',
    waveB: 'triangle',
    fBase: 620,
    chords: [[0, 3, 8, 15], [0, 6, 10, 17], [0, 5, 11, 18], [0, 2, 9, 16]],
    mel: [0, 3, 8, 12, 15, 18, 20, 18, 15, 12, 9, 6, 3, 0, 6, 10, 15, 19, 15, 8],
  },
  {
    id: 6,
    title: 'HORIZON HYMN',
    shortName: 'HORIZON HYMN',
    bpm: 52,
    rootHz: 61.74,
    ratios: [1.0, 1.2599, 1.4983],
    waveA: 'triangle',
    waveB: 'sine',
    fBase: 440,
    chords: [[0, 5, 9, 14], [0, 3, 8, 12], [0, 7, 11, 15], [0, 2, 8, 13]],
    mel: [0, 5, 9, 14, 12, 9, 5, 0, 3, 8, 12, 17, 15, 12, 8, 3, 7, 11, 15, 19, 16, 11, 7, 2],
  },
  {
    id: 7,
    title: 'CROWN OF ASH',
    shortName: 'CROWN OF ASH',
    bpm: 54,
    rootHz: 52.8,
    ratios: [1.0, 1.618, 2.618],
    waveA: 'triangle',
    waveB: 'sawtooth',
    fBase: 480,
    chords: [[0, 3, 7, 10], [0, 3, 8, 14], [0, 5, 10, 12], [0, 2, 7, 15]],
    mel: [0, 3, 7, 10, 14, 10, 7, 3, 0, 3, 8, 12, 15, 12, 8, 3, 2, 7, 11, 14, 11, 7, 2, 0],
  },
  {
    id: 8,
    title: 'DEEP MERIDIAN',
    shortName: 'DEEP MERIDIAN',
    bpm: 72,
    rootHz: 44.0,
    ratios: [1.0, 1.3348, 2.0],
    waveA: 'sawtooth',
    waveB: 'square',
    fBase: 560,
    chords: [[0, 3, 8, 12], [0, 3, 10, 15], [0, 5, 8, 14], [0, 2, 8, 13]],
    mel: [0, 5, 3, 8, 6, 10, 8, 13, 10, 6, 3, 1, 0, 3, 5, 8, 10, 13, 10, 5, 3, 0],
  },
];

export class CosmicAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private oscA: OscillatorNode | null = null;
  private oscB: OscillatorNode | null = null;
  private oscC: OscillatorNode | null = null;
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly fftBins = new Uint8Array(32);

  private active = false;
  public sfxEnabled = false;
  public masterMuted = false;
  public nightmareBend = false;
  private sfxPreviewIdx = 0;
  private songIndex = 8; // Boots on `DEEP MERIDIAN` matching CQM reference view
  private beatStep = 0;
  private userVolume = 0.12;

  public isPlaying(): boolean {
    return this.active && !this.masterMuted;
  }

  public isMusicActive(): boolean {
    return this.active;
  }

  public getCurrentSong(): CosmicSongPreset {
    return COSMIC_9_SONGS[this.songIndex] ?? COSMIC_9_SONGS[0]!;
  }

  public nextSong(): CosmicSongPreset {
    return this.setSongIndex((this.songIndex + 1) % COSMIC_9_SONGS.length);
  }

  public setSongIndex(idx: number): CosmicSongPreset {
    this.songIndex = ((Math.trunc(idx) % COSMIC_9_SONGS.length) + COSMIC_9_SONGS.length) % COSMIC_9_SONGS.length;
    const preset = this.getCurrentSong();
    if (this.ctx && this.oscA && this.oscB && this.oscC) {
      const now = this.ctx.currentTime;
      this.oscA.type = preset.waveA;
      this.oscB.type = preset.waveB;
      this.oscA.frequency.setTargetAtTime(preset.rootHz * preset.ratios[0], now, 0.15);
      this.oscB.frequency.setTargetAtTime(preset.rootHz * preset.ratios[1], now, 0.15);
      this.oscC.frequency.setTargetAtTime(preset.rootHz * preset.ratios[2], now, 0.15);
      if (this.musicFilter) {
        this.musicFilter.frequency.setTargetAtTime(preset.fBase, now, 0.2);
      }
    }
    this.restartBeatLoop();
    return preset;
  }

  public setVolume(vol01: number): void {
    this.userVolume = Math.max(0.0, Math.min(0.35, vol01 * 0.25));
    this.syncMasterGain();
  }

  public toggleMute(): boolean {
    this.masterMuted = !this.masterMuted;
    this.syncMasterGain();
    return this.masterMuted;
  }

  private syncMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = this.active && !this.masterMuted ? Math.max(0.005, this.userVolume) : 0.0001;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + 0.14);
  }

  private ensureContext(): boolean {
    if (typeof window === 'undefined') return false;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.setValueAtTime(this.getCurrentSong().fBase, this.ctx.currentTime);
      this.musicFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.78;

      this.musicFilter.connect(this.masterGain);
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

      const gA = this.ctx.createGain();
      gA.gain.setValueAtTime(0.22, this.ctx.currentTime);
      const gB = this.ctx.createGain();
      gB.gain.setValueAtTime(0.16, this.ctx.currentTime);
      const gC = this.ctx.createGain();
      gC.gain.setValueAtTime(0.12, this.ctx.currentTime);

      this.oscA.connect(gA);
      gA.connect(this.musicFilter);
      this.oscB.connect(gB);
      gB.connect(this.musicFilter);
      this.oscC.connect(gC);
      gC.connect(this.musicFilter);

      this.oscA.start();
      this.oscB.start();
      this.oscC.start();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return true;
  }

  private restartBeatLoop(): void {
    if (this.beatTimer !== null) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
    if (!this.active || !this.ctx) return;

    const song = this.getCurrentSong();
    const beatMs = Math.max(240, Math.round(60000 / song.bpm));
    this.beatTimer = setInterval(() => this.triggerBeatNote(), beatMs);
  }

  private triggerBeatNote(): void {
    if (!this.ctx || !this.musicFilter || !this.active || this.masterMuted) return;
    const song = this.getCurrentSong();
    const st = this.beatStep++;
    const now = this.ctx.currentTime;

    const chord = song.chords[Math.floor(st / 8) % song.chords.length]!;
    const intensity = 0.72 + 0.28 * Math.sin(st * 0.2);
    const bendMul = this.nightmareBend ? 0.84 : 1.0;

    // Modulate filter LFO
    const cutoff = Math.max(
      220,
      (song.fBase + (Math.sin(st * 0.3) * 220 + Math.sin(st * 0.1) * 160) * intensity) *
        (this.nightmareBend ? 0.65 : 1.0),
    );
    this.musicFilter.frequency.setTargetAtTime(cutoff, now, 0.12);

    // Even beat: melody sine/triangle bell
    if (st % 2 === 0) {
      const deg = song.mel[st % song.mel.length]!;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(noteFreq(deg) * 1.5 * bendMul, now);
      env.gain.setValueAtTime(0.08 * intensity, now);
      env.gain.exponentialRampToValueAtTime(0.0004, now + 1.4);
      osc.connect(env);
      env.connect(this.musicFilter);
      osc.start(now);
      osc.stop(now + 1.45);
    } else {
      // Odd beat: chord arpeggio pluck
      const deg = chord[st % chord.length]!;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(noteFreq(deg) * bendMul, now);
      env.gain.setValueAtTime(0.065 * intensity, now);
      env.gain.exponentialRampToValueAtTime(0.0004, now + 0.55);
      osc.connect(env);
      env.connect(this.musicFilter);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  }

  public toggle(): boolean {
    if (!this.ensureContext()) return false;
    this.active = !this.active;
    if (this.active) this.masterMuted = false;
    this.syncMasterGain();
    this.restartBeatLoop();
    return this.active;
  }

  public triggerSfx(kind?: SfxKind, forcePreview = false): SfxKind {
    const chosen = kind ?? SFX_TYPES[this.sfxPreviewIdx++ % SFX_TYPES.length]!;
    if (!this.sfxEnabled && !forcePreview) return chosen;
    if (this.masterMuted || !this.ensureContext() || !this.ctx) return chosen;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const bend = this.nightmareBend ? 0.82 : 1.0;

    switch (chosen) {
      case 'split':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320 * bend, now);
        osc.frequency.exponentialRampToValueAtTime(640 * bend, now + 0.16);
        break;
      case 'burst':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180 * bend, now);
        osc.frequency.exponentialRampToValueAtTime(880 * bend, now + 0.24);
        break;
      case 'mutate':
        osc.type = 'square';
        osc.frequency.setValueAtTime(440 * bend, now);
        osc.frequency.linearRampToValueAtTime(260 * bend, now + 0.22);
        break;
      case 'warp':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110 * bend, now);
        osc.frequency.exponentialRampToValueAtTime(520 * bend, now + 0.35);
        break;
      case 'crystallize':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(784 * bend, now);
        osc.frequency.exponentialRampToValueAtTime(1174 * bend, now + 0.3);
        break;
      case 'decay':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240 * bend, now);
        osc.frequency.exponentialRampToValueAtTime(65 * bend, now + 0.32);
        break;
      case 'resonance':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(528 * bend, now);
        break;
      default:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(196 * bend, now);
        break;
    }

    env.gain.setValueAtTime(0.08, now);
    env.gain.exponentialRampToValueAtTime(0.0005, now + 0.36);
    osc.connect(env);
    env.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
    return chosen;
  }

  public triggerKerrRingdownChime(spinA = 0.84): void {
    if (!this.ctx || !this.masterGain || !this.isPlaying()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220.0 + 68.0 * spinA, now);
    env.gain.setValueAtTime(0.12, now);
    env.gain.exponentialRampToValueAtTime(0.0005, now + 0.65);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.68);
  }

  public modulateByPantheon(orderR: number, kerrSpinA: number, glossodromSymbol = 0): void {
    if (!this.ctx || !this.oscA || !this.oscB || !this.oscC || !this.isPlaying()) return;
    const preset = this.getCurrentSong();
    const now = this.ctx.currentTime;
    const bend = this.nightmareBend ? 0.86 : 1.0;
    const arpDetune = (glossodromSymbol % 16) * 0.45;
    this.oscA.frequency.setTargetAtTime((preset.rootHz * preset.ratios[0] + 4.5 * orderR) * bend, now, 0.22);
    this.oscB.frequency.setTargetAtTime((preset.rootHz * preset.ratios[1] + 7.5 * kerrSpinA) * bend, now, 0.22);
    this.oscC.frequency.setTargetAtTime((preset.rootHz * preset.ratios[2] + arpDetune) * bend, now, 0.25);
  }

  public getFrequencySpectrum32(): Uint8Array {
    if (!this.analyser || !this.isPlaying()) {
      this.fftBins.fill(0);
      return this.fftBins;
    }
    this.analyser.getByteFrequencyData(this.fftBins);
    return this.fftBins;
  }
}
