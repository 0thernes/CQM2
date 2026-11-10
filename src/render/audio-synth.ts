/**
 * CQM2 Procedural Web Audio Cosmic & Kerr Quasi-Normal Mode (`M*omega = 0.373672 - 0.088962i`) Synthesizer.
 * Initializes `AudioContext` strictly upon explicit user interaction (`toggleAudio()`), uses click-free
 * exponential/linear gain ramps, and stays muted by default for ergonomic workstation etiquette.
 */

export class CosmicAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private active = false;

  public isPlaying(): boolean {
    return this.active;
  }

  public toggle(): boolean {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.droneOscA = this.ctx.createOscillator();
      this.droneOscA.type = 'sine';
      this.droneOscA.frequency.setValueAtTime(55.0, this.ctx.currentTime); // A1 fundamental

      this.droneOscB = this.ctx.createOscillator();
      this.droneOscB.type = 'triangle';
      this.droneOscB.frequency.setValueAtTime(82.41, this.ctx.currentTime); // E2 fifth

      const subGainB = this.ctx.createGain();
      subGainB.gain.setValueAtTime(0.22, this.ctx.currentTime);

      this.droneOscA.connect(this.masterGain);
      this.droneOscB.connect(subGainB);
      subGainB.connect(this.masterGain);

      this.droneOscA.start();
      this.droneOscB.start();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.active = !this.active;
    const now = this.ctx.currentTime;
    this.masterGain!.gain.cancelScheduledValues(now);
    this.masterGain!.gain.linearRampToValueAtTime(this.active ? 0.08 : 0.0001, now + 0.18);
    return this.active;
  }

  /**
   * Triggers a gentle Leaver Kerr $l=m=2$ QNM ringdown chime (`248 Hz`, $\tau = 0.35\,\text{s}$) e.g. on TMS Poke!
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

  public modulateByPantheon(orderR: number, kerrSpinA: number): void {
    if (!this.ctx || !this.droneOscA || !this.droneOscB || !this.active) return;
    const now = this.ctx.currentTime;
    this.droneOscA.frequency.setTargetAtTime(55.0 + 6.0 * orderR, now, 0.2);
    this.droneOscB.frequency.setTargetAtTime(82.41 + 9.0 * kerrSpinA, now, 0.2);
  }
}
