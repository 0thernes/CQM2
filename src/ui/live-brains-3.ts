/**
 * CQM2 v2.2.0 — `3 Live Brains` Real-Time Neural, Cerebellar & Hyperbolic Glyph Visualizer (`src/ui/live-brains-3.ts`).
 *
 * Drives the 3 square HiDPI mini-canvases inside `#brain-all-slot`:
 *   1. `APEX` (`Asmodenius v42`): 14-region Dale connectome ring + pulsing violet-white core + synaptic spike arcs.
 *   2. `MECHA` (`Glitchling + Quad-Silicon`): 9-node cerebellar/DeltaNet web + 48-sample plasticity sparkline.
 *   3. `GLYPH` (`Xylos v2 + 100 Pantheon Minds`): `10x10` magenta-gold hyperbolic mind matrix + electrode flashes.
 */

export interface LiveBrainsSnapshot {
  readonly simTimeSec: number;
  readonly apexConfidence01: number;
  readonly apexVoi: number;
  readonly apexVetoes: number;
  readonly apexKappa: number;
  readonly mechaAlignmentCos: number;
  readonly mechaStc01: number;
  readonly mechaDominantShell: number;
  readonly mechaKuramotoR: number;
  readonly glyphButlin01: number;
  readonly glyphInventions: number;
}

export class Cqm3LiveBrainsRenderer {
  private readonly mechaHistory = new Float32Array(48);
  private mechaHead = 0;

  public render(
    apexCanvas: HTMLCanvasElement | null,
    mechaCanvas: HTMLCanvasElement | null,
    glyphCanvas: HTMLCanvasElement | null,
    snap: LiveBrainsSnapshot,
  ): void {
    this.mechaHistory[this.mechaHead] = Math.max(0, Math.min(1, (snap.mechaAlignmentCos + 1) * 0.5));
    this.mechaHead = (this.mechaHead + 1) % this.mechaHistory.length;

    if (apexCanvas) this.drawApexBrain(apexCanvas, snap);
    if (mechaCanvas) this.drawMechaBrain(mechaCanvas, snap);
    if (glyphCanvas) this.drawGlyphBrain(glyphCanvas, snap);
  }

  private setupSquare(c: HTMLCanvasElement, glowRgba: string): { ctx: CanvasRenderingContext2D; size: number } | null {
    const css = Math.max(72, c.clientWidth || 96);
    const size = css * 2;
    if (c.width !== size) c.width = size;
    if (c.height !== size) c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    const grad = ctx.createRadialGradient(size * 0.5, size * 0.45, 4, size * 0.5, size * 0.5, size * 0.65);
    grad.addColorStop(0, glowRgba);
    grad.addColorStop(1, '#02030c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Subtle 32px coordinate grid
    ctx.strokeStyle = 'rgba(100, 160, 255, 0.07)';
    ctx.lineWidth = 1;
    const step = size / 6;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
    return { ctx, size };
  }

  private drawApexBrain(c: HTMLCanvasElement, snap: LiveBrainsSnapshot): void {
    const s = this.setupSquare(c, 'rgba(145, 85, 255, 0.42)');
    if (!s) return;
    const { ctx, size } = s;
    const cx = size * 0.5;
    const cy = size * 0.52;
    const rad = size * 0.34;
    const t = snap.simTimeSec;

    // 14-Region Dale 80/20 Peripheral Nodes + Wavy Synaptic Arcs
    const nodes: Array<{ x: number; y: number; act: number }> = [];
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + t * 0.25;
      const act = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.4 + i * 0.9 + snap.apexKappa * 4));
      const r = rad * (0.85 + 0.2 * act);
      nodes.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, act });
    }

    for (let i = 0; i < 14; i++) {
      const a = nodes[i]!;
      const b = nodes[(i + 5) % 14]!;
      ctx.strokeStyle = `rgba(196, 148, 255, ${(0.18 + 0.35 * a.act).toFixed(2)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, a.x, a.y);
      ctx.stroke();

      ctx.fillStyle = a.act > 0.78 ? '#ffffff' : '#d8b4fe';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 2.5 + a.act * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pulsing Central Thalamic Core
    const coreR = 7 + snap.apexConfidence01 * 7 + Math.sin(t * 2.2) * 2;
    ctx.fillStyle = '#f5d0fe';
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '700 16px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#f3e9ff';
    ctx.textAlign = 'left';
    ctx.fillText(`APEX · ${(snap.apexConfidence01 * 100).toFixed(0)}%`, 10, 22);
  }

  private drawMechaBrain(c: HTMLCanvasElement, snap: LiveBrainsSnapshot): void {
    const s = this.setupSquare(c, 'rgba(35, 175, 245, 0.38)');
    if (!s) return;
    const { ctx, size } = s;
    const cx = size * 0.5;
    const cy = size * 0.48;
    const t = snap.simTimeSec;

    // 9-Node Cerebellar / Mechalogodrom Starburst
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2 - t * 0.32;
      const r = size * (0.22 + 0.14 * Math.sin(t * 1.8 + i));
      const nx = cx + Math.cos(ang) * r;
      const ny = cy + Math.sin(ang) * r;

      ctx.strokeStyle = 'rgba(92, 240, 255, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(nx, ny, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 48-sample kinematic/plasticity sparkline across bottom band
    ctx.beginPath();
    const len = this.mechaHistory.length;
    for (let i = 0; i < len; i++) {
      const val = this.mechaHistory[(this.mechaHead + i) % len]!;
      const px = 8 + (i / (len - 1)) * (size - 16);
      const py = size - 24 - val * 30;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#5cf0ff';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.font = '700 16px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#e0fbff';
    ctx.textAlign = 'left';
    ctx.fillText(`MECHA · S${snap.mechaDominantShell}`, 10, 22);

    ctx.font = '600 13px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(
      `R${Math.round(snap.mechaKuramotoR * 100)} STC${Math.round(snap.mechaStc01 * 100)}`,
      10,
      size - 8,
    );
  }

  private drawGlyphBrain(c: HTMLCanvasElement, snap: LiveBrainsSnapshot): void {
    const s = this.setupSquare(c, 'rgba(235, 65, 175, 0.38)');
    if (!s) return;
    const { ctx, size } = s;
    const t = snap.simTimeSec;

    // 10x10 Pantheon & Xylos Hyperbolic Glyph Mind Electrode Array (`100` minds!)
    const padTop = 30;
    const padSide = 14;
    const gridW = size - padSide * 2;
    const gridH = size - padTop - 22;
    const stepX = gridW / 9;
    const stepY = gridH / 9;

    for (let r = 0; r < 10; r++) {
      for (let col = 0; col < 10; col++) {
        const idx = r * 10 + col;
        const v = 0.5 + 0.5 * Math.sin(t * 1.7 + idx * 0.63 + snap.glyphButlin01 * 5.0);
        const x = padSide + col * stepX;
        const y = padTop + r * stepY;
        const hue = Math.round(275 + v * 75);
        ctx.fillStyle = `hsl(${hue}, 90%, ${Math.round(45 + v * 35)}%)`;
        ctx.beginPath();
        ctx.arc(x, y, 2.2 + v * 3.4, 0, Math.PI * 2);
        ctx.fill();

        if (v > 0.82) {
          ctx.fillStyle = '#fff59d';
          ctx.beginPath();
          ctx.arc(x, y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.font = '700 16px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#ffe8fb';
    ctx.textAlign = 'left';
    ctx.fillText('GLYPH · 100', 10, 22);
  }
}
