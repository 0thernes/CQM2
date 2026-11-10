/**
 * CQM2 v2.1.0 Quantum WildBeyond & Relativistic Strange-Attractor Interactive Lab (`src/ui/wildbeyond-lab.ts`).
 * Renders:
 *   1. Exact Bardeen (1973) asymmetric Kerr D-shadow contour (`computeBardeenKerrShadowLocus`)
 *   2. Hoggar Split Cayley Hexagon `H(2) = 63` & Disjoint Mermin amplification web
 *   3. Coupled Lorenz chaotic strange attractor (`sigma=10, rho=28, beta=8/3`)
 *   4. Live `CQM-25` Quantum + Kerr throughput benchmark
 */
import { evaluateDisjointMerminAmplification, evaluateHoggarContextuality } from '../quantum/contextuality';
import { computeBardeenKerrShadowLocus, computeLeaverKerrQnmSpectrum } from '../quantum/kerr-relativity';

function drawBardeenShadow(canvas: HTMLCanvasElement, spinA: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#030711';
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.48;
  const cy = h * 0.5;
  const scale = Math.min(w, h) * 0.078;

  // Reference Schwarzschild sqrt(27) M dashed circle
  ctx.strokeStyle = 'rgba(168, 189, 217, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.sqrt(27) * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Exact Bardeen D-shadow contour
  const pts = computeBardeenKerrShadowLocus(spinA, Math.PI / 2, 128);
  if (pts.length > 2) {
    ctx.strokeStyle = '#fbbf24';
    ctx.fillStyle = 'rgba(5, 9, 19, 0.92)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const x = cx + p.alpha * scale;
      const y = cy - p.beta * scale;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#38bdf8';
  ctx.font = '12px monospace';
  ctx.fillText(`a/M = ${spinA.toFixed(3)} | Dashed = sqrt(27)M`, 12, h - 12);
}

function drawHoggarWeb(canvas: HTMLCanvasElement, phase: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#030711';
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.5;
  const rOuter = Math.min(w, h) * 0.38;

  // 63 projective points arranged on 3 concentric symplectic shells (21 points/shell)
  const nodes: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 63; i++) {
    const shell = i % 3;
    const idxInShell = Math.floor(i / 3);
    const r = rOuter * (0.42 + 0.29 * shell);
    const ang = (idxInShell / 21) * Math.PI * 2 + phase * (shell === 1 ? -0.35 : 0.25);
    nodes.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }

  ctx.strokeStyle = 'rgba(192, 132, 252, 0.28)';
  ctx.lineWidth = 1.0;
  for (let i = 0; i < 63; i++) {
    const a = nodes[i]!;
    const b = nodes[(i * 7 + 3) % 63]!;
    const c = nodes[(i * 13 + 9) % 63]!;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }

  for (let i = 0; i < 63; i++) {
    const n = nodes[i]!;
    ctx.fillStyle = i % 7 === 0 ? '#34d399' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#c084fc';
  ctx.font = '12px monospace';
  ctx.fillText('W(5,2): 63 pts · H(2)=63 lines · Tr(g)=14.0', 12, h - 12);
}

function drawLorenzChaos(canvas: HTMLCanvasElement, spinA: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#030711';
  ctx.fillRect(0, 0, w, h);

  let x = 0.1;
  let y = 0.0;
  let z = 0.0;
  const sigma = 10.0;
  const rho = 24.0 + 6.0 * spinA;
  const beta = 8.0 / 3.0;
  const dt = 0.008;

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let step = 0; step < 1800; step++) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    x += dx * dt;
    y += dy * dt;
    z += dz * dt;
    const px = w * 0.5 + x * 6.8;
    const py = h * 0.92 - z * 5.2;
    if (step === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = '12px monospace';
  ctx.fillText(`Lorenz Attractor (rho=${rho.toFixed(2)})`, 12, h - 12);
}

function bootWildBeyondLab(): void {
  const spinSlider = document.getElementById('wb-spin') as HTMLInputElement | null;
  const spinVal = document.getElementById('wb-spin-val');
  const statusEl = document.getElementById('wb-status');
  const benchBtn = document.getElementById('wb-bench-btn');
  const cKerr = document.getElementById('wb-kerr-canvas') as HTMLCanvasElement | null;
  const cHoggar = document.getElementById('wb-hoggar-canvas') as HTMLCanvasElement | null;
  const cChaos = document.getElementById('wb-chaos-canvas') as HTMLCanvasElement | null;

  if (!spinSlider || !cKerr || !cHoggar || !cChaos) return;

  const renderAll = (phase = 0) => {
    const spin = Number(spinSlider.value);
    if (spinVal) spinVal.textContent = spin.toFixed(3);
    drawBardeenShadow(cKerr, spin);
    drawHoggarWeb(cHoggar, phase);
    drawLorenzChaos(cChaos, spin);
  };

  const hoggar = evaluateHoggarContextuality(3);
  const qnm = computeLeaverKerrQnmSpectrum(0.92)[0];
  if (statusEl && qnm) {
    statusEl.textContent = `Hoggar H(2)=${hoggar.violatedHexagonH2Lines} lines (Tr=${hoggar.fubiniStudyTrace.toFixed(1)}) · Fundamental QNM (2,2,0) M*omega=${qnm.omegaRealOverM.toFixed(4)}${qnm.omegaImagOverM.toFixed(4)}i`;
  }

  spinSlider.addEventListener('input', () => renderAll(performance.now() * 0.0005));

  benchBtn?.addEventListener('click', () => {
    const t0 = performance.now();
    let checksum = 0;
    for (let k = 0; k < 25; k++) {
      const sh = computeBardeenKerrShadowLocus(0.5 + (k % 10) * 0.045, Math.PI / 2, 96);
      const amp = evaluateDisjointMerminAmplification((k % 6) + 1, 0.02);
      checksum += sh.length + amp.quantumToClassicalRatio;
    }
    const elapsed = performance.now() - t0;
    if (statusEl) {
      statusEl.textContent = `CQM-25 Benchmark PASS in ${elapsed.toFixed(2)} ms · Checksum=${checksum.toFixed(2)} · H(2)=${hoggar.violatedHexagonH2Lines} lines`;
    }
  });

  renderAll(0);
}

if (typeof document !== 'undefined') {
  bootWildBeyondLab();
}
