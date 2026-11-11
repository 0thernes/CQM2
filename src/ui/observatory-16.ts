/**
 * CQM2 v2.2.0 — 16-Chart Real-Time Observatory & Telemetry Sparkline Engine (`src/ui/observatory-16.ts`).
 *
 * Renders:
 *   - 4 Telemetry Sparklines (`#g0..#g3`: Entities, Chaos, Energy, Connectome) + Sorting Field Waveform (`#g-alg`).
 *   - All 16 HiDPI 2D Observatory Canvases (`#obs-c0..#obs-c15`) across the 4 canonical CQM tabs (`OVER | VAR | ECO | WAR`),
 *     updating only the visible 4-chart page per cycle for zero wasted layout/paint overhead at 4K 60+ FPS.
 */
import type { TitanDiplomacySnapshot } from '../sim/sorting-fields';

const SERIES_COLORS: readonly string[] = [
  'hsl(0, 85%, 60%)',
  'hsl(45, 85%, 60%)',
  'hsl(90, 85%, 60%)',
  'hsl(135, 85%, 60%)',
  'hsl(180, 85%, 60%)',
  'hsl(225, 85%, 60%)',
  'hsl(270, 85%, 60%)',
  'hsl(315, 85%, 60%)',
  '#00eeff',
  '#ffaa00',
  '#4df2ff',
  '#ff6bd6',
  '#a8ff60',
  '#ffb347',
  '#b18cff',
  '#58ffd0',
  '#ff667c',
  '#ffe169',
  '#7aa2ff',
  '#ff8f52',
];

export class SparklineRing {
  private readonly buf: Float32Array;
  private head = 0;
  private count = 0;
  private readonly stroke: string;
  private readonly fill: string;
  private readonly fixedMax: number;

  public constructor(capacity = 100, strokeRgba = 'rgba(0,200,255,1)', fixedMax = 0) {
    this.buf = new Float32Array(capacity);
    this.stroke = strokeRgba;
    this.fill = strokeRgba.replace(/1\)$/, '0.12)');
    this.fixedMax = fixedMax;
  }

  public push(v: number): void {
    this.buf[this.head] = Number.isFinite(v) ? v : 0;
    this.head = (this.head + 1) % this.buf.length;
    if (this.count < this.buf.length) this.count++;
  }

  public draw(canvas: HTMLCanvasElement | null, dynamicMax = 0): void {
    if (!canvas) return;
    const cssW = Math.max(60, canvas.clientWidth || 180);
    const cssH = Math.max(14, canvas.clientHeight || 22);
    const w = cssW * 2;
    const h = cssH * 2;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'rgba(2, 4, 14, 0.88)';
    ctx.fillRect(0, 0, w, h);

    if (this.count < 2) return;
    let maxVal = this.fixedMax > 0 ? this.fixedMax : dynamicMax;
    if (maxVal <= 0) {
      for (let i = 0; i < this.count; i++) {
        const val = this.at(i);
        if (val > maxVal) maxVal = val;
      }
    }
    if (maxVal <= 1e-6) maxVal = 1;

    ctx.beginPath();
    for (let i = 0; i < this.count; i++) {
      const px = (i / (this.count - 1)) * w;
      const py = h - Math.min(1, Math.max(0, this.at(i) / maxVal)) * h * 0.86 - 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = this.fill;
    ctx.fill();
  }

  private at(i: number): number {
    const start = this.count < this.buf.length ? 0 : this.head;
    return this.buf[(start + i) % this.buf.length]!;
  }
}

export interface ObservatorySample {
  readonly phyla10: readonly number[];
  readonly totalPop: number;
  readonly totalEnergy: number;
  readonly connectomeLinks: number;
  readonly rdEnergy: number;
  readonly qEntropy: number;
  readonly popTrendPerMin: number;
  readonly shannonDiversity01: number;
  readonly birthDelta: number;
  readonly deathDelta: number;
  readonly xenoPop01: number;
  readonly xenoCoherence01: number;
  readonly xenoComplexity01: number;
  readonly xenoTwin01: number;
  readonly biomeIntegration01: number;
  readonly biomeCoherence01: number;
  readonly biomeMomentum01: number;
  readonly titans: TitanDiplomacySnapshot;
}

const CAP = 120;

export class Cqm16ObservatoryRenderer {
  public activePage: 0 | 1 | 2 | 3 = 0;
  private readonly samples: ObservatorySample[] = [];
  private primed = false;

  public pushSample(sample: ObservatorySample): void {
    this.samples.push(sample);
    if (!this.primed) {
      this.primed = true;
      this.samples.push(sample);
    }
    if (this.samples.length > CAP) {
      this.samples.shift();
    }
  }

  public renderActivePage(canvases16: ReadonlyArray<HTMLCanvasElement | null>): void {
    if (this.samples.length < 2) return;
    const latest = this.samples[this.samples.length - 1]!;

    if (this.activePage === 0) {
      this.drawPhylumStacked(canvases16[0] ?? null, latest);
      this.drawTitanLedger(canvases16[1] ?? null, latest);
      this.drawWarMatrix(canvases16[2] ?? null, latest);
      this.drawEnvironment(canvases16[3] ?? null, latest);
    } else if (this.activePage === 1) {
      this.drawVarianceBands(canvases16[4] ?? null, latest);
      this.drawPopHistogram(canvases16[5] ?? null);
      this.drawDiversity(canvases16[6] ?? null, latest);
      this.drawPhaseScatter(canvases16[7] ?? null, latest);
    } else if (this.activePage === 2) {
      this.drawPhylaSmallMultiples(canvases16[8] ?? null);
      this.drawBirthDeathFlux(canvases16[9] ?? null, latest);
      this.drawTitanPhase(canvases16[10] ?? null, latest);
      this.drawXenomimicIndicators(canvases16[11] ?? null, latest);
    } else {
      this.drawWarIntensity(canvases16[12] ?? null, latest);
      this.drawTruceWarAllyStacked(canvases16[13] ?? null, latest);
      this.drawTitanResourceBars(canvases16[14] ?? null, latest);
      this.drawBiomeComplexityGauge(canvases16[15] ?? null, latest);
    }
  }

  private prep(
    c: HTMLCanvasElement | null,
    title: string,
    rightReadout: string,
    rightColor = 'rgba(226,232,240,0.94)',
  ): { ctx: CanvasRenderingContext2D; w: number; h: number; topY: number; plotH: number } | null {
    if (!c) return null;
    const cssW = Math.max(200, c.clientWidth || 280);
    const cssH = Math.max(76, c.clientHeight || 96);
    const w = cssW * 2;
    const h = cssH * 2;
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = 'rgba(2, 4, 14, 0.88)';
    ctx.fillRect(0, 0, w, h);

    const titleBand = 32;
    ctx.font = '700 17px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#00eeff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(title, 10, 16);

    if (rightReadout) {
      ctx.font = '600 15px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = rightColor;
      ctx.textAlign = 'right';
      ctx.fillText(rightReadout, w - 10, 16);
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, titleBand);
    ctx.lineTo(w - 8, titleBand);
    ctx.stroke();

    return { ctx, w, h, topY: titleBand + 6, plotH: Math.max(24, h - titleBand - 14) };
  }

  private drawPhylumStacked(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const p = this.prep(c, 'PHYLUM POPULATION', `Σ ${latest.totalPop} ent`);
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const n = this.samples.length;
    const maxTot = Math.max(1, ...this.samples.map((s) => s.totalPop));
    const padX = 10;
    const pw = w - padX * 2;

    const prevCum = new Float32Array(n);
    const nextCum = new Float32Array(n);

    for (let k = 0; k < 10; k++) {
      for (let i = 0; i < n; i++) {
        nextCum[i] = prevCum[i]! + (this.samples[i]!.phyla10[k] ?? 0);
      }
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = padX + (i / (n - 1)) * pw;
        const y = topY + plotH - (nextCum[i]! / maxTot) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = n - 1; i >= 0; i--) {
        const x = padX + (i / (n - 1)) * pw;
        const y = topY + plotH - (prevCum[i]! / maxTot) * plotH;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = SERIES_COLORS[k]!;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      prevCum.set(nextCum);
    }
  }

  private drawTitanLedger(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const domIdx = latest.titans.dominantTitanIndex;
    const domName = latest.titans.names20[domIdx] ?? 'TITAN';
    const domVal = Math.round(latest.titans.netHoldings20[domIdx] ?? 0);
    const p = this.prep(c, 'TITAN LEDGER', `${domName} ${domVal}`, SERIES_COLORS[domIdx]!);
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const n = this.samples.length;
    let hi = 10;
    let lo = 0;
    for (const s of this.samples) {
      for (let t = 0; t < 20; t++) {
        const v = s.titans.netHoldings20[t]!;
        if (v > hi) hi = v;
        if (v < lo) lo = v;
      }
    }
    const span = Math.max(1, hi - lo);
    const padX = 10;
    const pw = w - padX * 2 - 12;

    for (let t = 0; t < 20; t++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = padX + (i / (n - 1)) * pw;
        const y = topY + plotH - ((this.samples[i]!.titans.netHoldings20[t]! - lo) / span) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = SERIES_COLORS[t]!;
      ctx.lineWidth = t === domIdx ? 2.6 : 1.3;
      ctx.stroke();

      if ((latest.titans.warCountPerTitan20[t] ?? 0) > 0) {
        const yEnd = topY + plotH - ((latest.titans.netHoldings20[t]! - lo) / span) * plotH;
        ctx.fillStyle = '#ff3232';
        ctx.fillRect(w - 16, yEnd - 4, 8, 8);
      }
    }
  }

  private drawWarMatrix(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const p = this.prep(
      c,
      'WAR MATRIX 20×20',
      `${latest.titans.totalWarCells}⚔ ${latest.titans.totalAllyCells}∞`,
    );
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const gridH = plotH - 12;
    const cellW = (w - 24) / 20;
    const cellH = gridH / 20;

    for (let r = 0; r < 20; r++) {
      for (let col = 0; col < 20; col++) {
        const st = latest.titans.matrix400[r * 20 + col]!;
        ctx.fillStyle =
          st === 2
            ? 'rgba(255, 50, 50, 0.92)'
            : st === 1
              ? 'rgba(0, 238, 255, 0.78)'
              : 'rgba(148, 163, 184, 0.16)';
        ctx.fillRect(12 + col * cellW, topY + r * cellH, Math.max(1, cellW - 1.2), Math.max(1, cellH - 1.2));
      }
    }
  }

  private drawEnvironment(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const p = this.prep(
      c,
      'ENVIRONMENT',
      `rd ${latest.rdEnergy.toFixed(1)} · qH ${latest.qEntropy.toFixed(2)}`,
    );
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const n = this.samples.length;
    const padX = 10;
    const pw = w - padX * 2;
    const maxRd = Math.max(1, ...this.samples.map((s) => s.rdEnergy));
    const maxTr = Math.max(1, ...this.samples.map((s) => Math.abs(s.popTrendPerMin)));

    const drawSeries = (color: string, fn: (s: ObservatorySample) => number) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = padX + (i / (n - 1)) * pw;
        const y = topY + plotH - Math.max(0, Math.min(1, fn(this.samples[i]!))) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    };

    drawSeries('#00eeff', (s) => s.rdEnergy / maxRd);
    drawSeries('#ffaa00', (s) => s.qEntropy);
    drawSeries('#ff3232', (s) => 0.5 + (s.popTrendPerMin / maxTr) * 0.45);
  }

  private drawVarianceBands(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const p = this.prep(c, 'VARIANCE MEAN±σ', `pop ${latest.totalPop} · L ${latest.connectomeLinks}`);
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const n = this.samples.length;
    const padX = 10;
    const pw = w - padX * 2;

    const specs: Array<{ col: string; fill: string; sel: (s: ObservatorySample) => number }> = [
      { col: '#00eeff', fill: 'rgba(0,238,255,0.20)', sel: (s) => s.totalPop },
      { col: '#ffaa00', fill: 'rgba(255,170,0,0.20)', sel: (s) => s.totalEnergy },
      { col: '#ff3232', fill: 'rgba(255,50,50,0.20)', sel: (s) => s.connectomeLinks },
    ];

    for (const sp of specs) {
      const vals = this.samples.map(sp.sel);
      const hi = Math.max(1, ...vals);
      const lo = Math.min(...vals);
      const span = Math.max(1, hi - lo);

      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const win = vals.slice(Math.max(0, i - 12), i + 1);
        const mean = win.reduce((a, b) => a + b, 0) / win.length;
        const std = Math.sqrt(win.reduce((a, b) => a + (b - mean) * (b - mean), 0) / win.length);
        const x = padX + (i / (n - 1)) * pw;
        const y = topY + plotH - Math.min(1, Math.max(0, (mean + std - lo) / span)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = n - 1; i >= 0; i--) {
        const win = vals.slice(Math.max(0, i - 12), i + 1);
        const mean = win.reduce((a, b) => a + b, 0) / win.length;
        const std = Math.sqrt(win.reduce((a, b) => a + (b - mean) * (b - mean), 0) / win.length);
        const x = padX + (i / (n - 1)) * pw;
        const y = topY + plotH - Math.min(1, Math.max(0, (mean - std - lo) / span)) * plotH;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = sp.fill;
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = padX + (i / (n - 1)) * pw;
        const y = topY + plotH - ((vals[i]! - lo) / span) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = sp.col;
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }
  }

  private drawPopHistogram(c: HTMLCanvasElement | null): void {
    const pops = this.samples.map((s) => s.totalPop);
    const lo = Math.min(...pops);
    const hi = Math.max(lo + 1, ...pops);
    const bins = new Uint16Array(16);
    for (const v of pops) {
      const b = Math.min(15, Math.floor(((v - lo) / (hi - lo)) * 16));
      bins[b]!++;
    }
    const peak = Math.max(1, ...Array.from(bins));
    const p = this.prep(c, 'POP HISTOGRAM', `peak ${peak}`);
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const bw = (w - 24) / 16;
    ctx.fillStyle = 'rgba(0, 238, 255, 0.86)';
    for (let i = 0; i < 16; i++) {
      const bh = (bins[i]! / peak) * plotH;
      ctx.fillRect(12 + i * bw, topY + plotH - bh, Math.max(2, bw - 3), bh);
    }
  }

  private drawDiversity(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const p = this.prep(c, 'PHYLUM DIVERSITY H', `H ${latest.shannonDiversity01.toFixed(3)}`);
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const n = this.samples.length;
    const padX = 10;
    const pw = w - padX * 2;

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = padX + (i / (n - 1)) * pw;
      const y = topY + plotH - Math.max(0, Math.min(1, this.samples[i]!.shannonDiversity01)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.lineTo(padX + pw, topY + plotH);
    ctx.lineTo(padX, topY + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 170, 0, 0.22)';
    ctx.fill();
  }

  private drawPhaseScatter(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const maxTr = Math.max(1, ...this.samples.map((s) => Math.abs(s.popTrendPerMin)));
    const p = this.prep(c, 'QH × TREND PHASE', `±${maxTr.toFixed(1)}/m`);
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const padX = 14;
    const pw = w - padX * 2;

    ctx.strokeStyle = 'rgba(148,163,184,0.2)';
    ctx.beginPath();
    ctx.moveTo(padX, topY + plotH * 0.5);
    ctx.lineTo(padX + pw, topY + plotH * 0.5);
    ctx.stroke();

    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i]!;
      const x = padX + Math.max(0, Math.min(1, s.qEntropy)) * pw;
      const y = topY + plotH * (0.5 - (s.popTrendPerMin / maxTr) * 0.44);
      ctx.fillStyle = i === this.samples.length - 1 ? '#00eeff' : 'rgba(255, 170, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y, i === this.samples.length - 1 ? 6 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    void latest;
  }

  private drawPhylaSmallMultiples(c: HTMLCanvasElement | null): void {
    const p = this.prep(c, 'PHYLA SMALL-MULTIPLES', '10 lineages');
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const cols = 5;
    const rows = 2;
    const cw = (w - 20) / cols;
    const ch = plotH / rows;
    const n = this.samples.length;

    for (let k = 0; k < 10; k++) {
      const gx = 10 + (k % cols) * cw;
      const gy = topY + Math.floor(k / cols) * ch;
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.strokeRect(gx + 2, gy + 2, cw - 4, ch - 4);

      const maxV = Math.max(1, ...this.samples.map((s) => s.phyla10[k] ?? 0));
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = gx + 4 + (i / (n - 1)) * (cw - 8);
        const y = gy + ch - 4 - ((this.samples[i]!.phyla10[k] ?? 0) / maxV) * (ch - 14);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = SERIES_COLORS[k]!;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }

  private drawBirthDeathFlux(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const p = this.prep(c, 'BIRTH / DEATH FLUX', `+${latest.birthDelta} / -${latest.deathDelta}`);
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const midY = topY + plotH * 0.5;
    const n = this.samples.length;
    const mag = Math.max(1, ...this.samples.map((s) => Math.max(s.birthDelta, s.deathDelta)));
    const padX = 10;
    const pw = w - padX * 2;

    // Births upward (#00eeff)
    ctx.beginPath();
    ctx.moveTo(padX, midY);
    for (let i = 0; i < n; i++) {
      const x = padX + (i / (n - 1)) * pw;
      const y = midY - (this.samples[i]!.birthDelta / mag) * (plotH * 0.45);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padX + pw, midY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 238, 255, 0.52)';
    ctx.fill();

    // Deaths downward (#ff3232)
    ctx.beginPath();
    ctx.moveTo(padX, midY);
    for (let i = 0; i < n; i++) {
      const x = padX + (i / (n - 1)) * pw;
      const y = midY + (this.samples[i]!.deathDelta / mag) * (plotH * 0.45);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padX + pw, midY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 50, 50, 0.52)';
    ctx.fill();
  }

  private drawTitanPhase(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const p = this.prep(c, 'TITAN MATTER × ENERGY', '20 titans');
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const maxM = Math.max(1, ...Array.from(latest.titans.matter20));
    const maxE = Math.max(1, ...Array.from(latest.titans.energy20));

    for (let t = 0; t < 20; t++) {
      const x = 16 + (latest.titans.matter20[t]! / maxM) * (w - 32);
      const y = topY + plotH - (latest.titans.energy20[t]! / maxE) * plotH;
      const atWar = (latest.titans.warCountPerTitan20[t] ?? 0) > 0;
      ctx.fillStyle = atWar ? '#ff3232' : SERIES_COLORS[t]!;
      ctx.beginPath();
      ctx.arc(x, y, atWar ? 6.5 : 5.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawXenomimicIndicators(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const p = this.prep(
      c,
      'XENOMIMIC · INDICATORS ONLY',
      `coh ${(latest.xenoCoherence01 * 100).toFixed(0)}%`,
    );
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const n = this.samples.length;
    const padX = 10;
    const pw = w - padX * 2;

    const lanes: Array<{ col: string; fn: (s: ObservatorySample) => number }> = [
      { col: '#ffaa00', fn: (s) => s.xenoPop01 },
      { col: '#00eeff', fn: (s) => s.xenoCoherence01 },
      { col: '#a8ff60', fn: (s) => s.xenoComplexity01 },
      { col: '#ff3232', fn: (s) => s.xenoTwin01 },
    ];
    for (const ln of lanes) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = padX + (i / (n - 1)) * pw;
        const y = topY + plotH - Math.max(0, Math.min(1, ln.fn(this.samples[i]!))) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = ln.col;
      ctx.lineWidth = 2.1;
      ctx.stroke();
    }
  }

  private drawWarIntensity(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const pct = ((latest.titans.totalWarCells / 400) * 100).toFixed(1);
    const p = this.prep(c, 'WAR INTENSITY', `${pct}% cells`, '#ff667c');
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const n = this.samples.length;
    const padX = 10;
    const pw = w - padX * 2;
    const maxPct = Math.max(0.05, ...this.samples.map((s) => s.titans.totalWarCells / 400));

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = padX + (i / (n - 1)) * pw;
      const y = topY + plotH - (this.samples[i]!.titans.totalWarCells / 400 / maxPct) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ff3232';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.lineTo(padX + pw, topY + plotH);
    ctx.lineTo(padX, topY + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 50, 50, 0.28)';
    ctx.fill();
  }

  private drawTruceWarAllyStacked(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const truce = Math.max(0, 400 - latest.titans.totalWarCells - latest.titans.totalAllyCells);
    const p = this.prep(c, 'TRUCE / WAR / ALLY', `T:${truce} W:${latest.titans.totalWarCells}`);
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const n = this.samples.length;
    const padX = 10;
    const pw = w - padX * 2;

    for (let i = 0; i < n; i++) {
      const s = this.samples[i]!.titans;
      const x = padX + (i / Math.max(1, n - 1)) * pw;
      const colW = Math.max(2, pw / n + 1);
      const wFrac = s.totalWarCells / 400;
      const aFrac = s.totalAllyCells / 400;
      const tFrac = Math.max(0, 1 - wFrac - aFrac);

      const hT = tFrac * plotH;
      const hW = wFrac * plotH;
      const hA = aFrac * plotH;

      ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.fillRect(x, topY + plotH - hT, colW, hT);
      ctx.fillStyle = 'rgba(255, 50, 50, 0.78)';
      ctx.fillRect(x, topY + plotH - hT - hW, colW, hW);
      ctx.fillStyle = 'rgba(0, 238, 255, 0.78)';
      ctx.fillRect(x, topY + plotH - hT - hW - hA, colW, hA);
    }
  }

  private drawTitanResourceBars(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const p = this.prep(c, 'TITAN RESOURCES', 'net holdings');
    if (!p) return;
    const { ctx, w, topY, plotH } = p;
    const maxNet = Math.max(1, ...Array.from(latest.titans.netHoldings20));
    const colW = (w - 24) / 2;
    const rowH = plotH / 10;

    for (let t = 0; t < 20; t++) {
      const col = Math.floor(t / 10);
      const row = t % 10;
      const bx = 12 + col * colW;
      const by = topY + row * rowH;
      const frac = Math.max(0.04, latest.titans.netHoldings20[t]! / maxNet);
      ctx.fillStyle = SERIES_COLORS[t]!;
      ctx.fillRect(bx + 2, by + 2, (colW - 10) * frac, Math.max(3, rowH - 5));
    }
  }

  private drawBiomeComplexityGauge(c: HTMLCanvasElement | null, latest: ObservatorySample): void {
    const comp =
      (latest.biomeIntegration01 + latest.biomeCoherence01 + latest.biomeMomentum01) / 3;
    const p = this.prep(
      c,
      'BIOME SENTIENCE (PROXY)',
      `${Math.round(comp * 100)}% [NOT SENTIENT]`,
      comp >= 0.5 ? '#00eeff' : '#ffaa00',
    );
    if (!p) return;
    const { ctx, w, topY, plotH } = p;

    const bars: Array<{ label: string; val: number }> = [
      { label: 'INTEGRATION', val: latest.biomeIntegration01 },
      { label: 'COHERENCE', val: latest.biomeCoherence01 },
      { label: 'MOMENTUM', val: latest.biomeMomentum01 },
    ];
    const rowH = plotH / 3;
    ctx.font = '600 13px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i]!;
      const y = topY + i * rowH;
      ctx.fillStyle = 'rgba(200, 220, 255, 0.85)';
      ctx.textAlign = 'left';
      ctx.fillText(b.label, 12, y + rowH * 0.35);
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(b.val * 100)}%`, w - 12, y + rowH * 0.35);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.fillRect(12, y + rowH * 0.65, w - 24, 6);
      ctx.fillStyle = b.val >= 0.5 ? '#00eeff' : '#ffaa00';
      ctx.fillRect(12, y + rowH * 0.65, (w - 24) * Math.max(0, Math.min(1, b.val)), 6);
    }
  }
}
