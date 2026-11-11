#!/usr/bin/env bun
/**
 * Deterministically synthesizes `native/launcher/cqm2.ico` (multi-size 64x64, 48x48, 32x32, 16x16
 * uncompressed 32-bit BGRA DIB icons) depicting the Cosmogonic Quantum Mechalogodrom prismatic
 * dome ring + Hoggar QGT triangle + gold Kerr singularity core.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const OUT_DIR = join(ROOT, 'native', 'launcher');
mkdirSync(OUT_DIR, { recursive: true });

function renderIconBmpDib(size: number): Buffer {
  const xorBytes = size * size * 4;
  const andRowBytes = Math.ceil(size / 32) * 4;
  const andBytes = andRowBytes * size;
  const headerBytes = 40;
  const buf = Buffer.alloc(headerBytes + xorBytes + andBytes, 0);

  // BITMAPINFOHEADER (height is 2*size for XOR + AND masks in ICO format)
  buf.writeUInt32LE(40, 0);
  buf.writeInt32LE(size, 4);
  buf.writeInt32LE(size * 2, 8);
  buf.writeUInt16LE(1, 12);
  buf.writeUInt16LE(32, 14);
  buf.writeUInt32LE(0, 16);
  buf.writeUInt32LE(xorBytes + andBytes, 20);

  const cx = (size - 1) * 0.5;
  const cy = (size - 1) * 0.5;
  const rMax = size * 0.47;

  // Triangle vertices (equilateral pointing up)
  const triR = size * 0.27;
  const v0 = { x: cx, y: cy - triR };
  const v1 = { x: cx - triR * 0.8660254, y: cy + triR * 0.5 };
  const v2 = { x: cx + triR * 0.8660254, y: cy + triR * 0.5 };

  const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy + 1e-9)));
    const dx = px - (ax + t * vx);
    const dy = py - (ay + t * vy);
    return Math.hypot(dx, dy);
  };

  for (let y = 0; y < size; y++) {
    // DIB rows are bottom-up!
    const dibRow = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const off = headerBytes + (dibRow * size + x) * 4;

      if (r > rMax + 1.0) {
        // Transparent outside circular badge
        buf[off] = 0;
        buf[off + 1] = 0;
        buf[off + 2] = 0;
        buf[off + 3] = 0;
        continue;
      }

      const edgeAlpha = Math.max(0, Math.min(1, rMax + 0.8 - r));
      // Deep cosmic violet background (#0d061c -> #1e0b36)
      let rr = 16 + 22 * (1 - r / rMax);
      let gg = 7 + 10 * (1 - r / rMax);
      let bb = 32 + 44 * (1 - r / rMax);

      // Outer prismatic ring
      const ringDist = Math.abs(r - size * 0.40);
      const ringWidth = Math.max(1.1, size * 0.055);
      if (ringDist < ringWidth * 1.6) {
        const w = Math.max(0, 1 - ringDist / (ringWidth * 1.6));
        const ang = Math.atan2(dy, dx);
        const pR = 128 + 127 * Math.cos(ang);
        const pG = 128 + 127 * Math.cos(ang - 2.094);
        const pB = 128 + 127 * Math.cos(ang + 2.094);
        rr = rr * (1 - w) + pR * w;
        gg = gg * (1 - w) + pG * w;
        bb = bb * (1 - w) + pB * w;
      }

      // Hoggar 3-qubit triangle lines (cyan-emerald #36f9c8)
      const dTri = Math.min(
        segDist(x, y, v0.x, v0.y, v1.x, v1.y),
        segDist(x, y, v1.x, v1.y, v2.x, v2.y),
        segDist(x, y, v2.x, v2.y, v0.x, v0.y),
      );
      const triThick = Math.max(0.95, size * 0.042);
      if (dTri < triThick * 1.5) {
        const w = Math.max(0, 1 - dTri / (triThick * 1.5));
        rr = rr * (1 - w) + 64 * w;
        gg = gg * (1 - w) + 250 * w;
        bb = bb * (1 - w) + 215 * w;
      }

      // Gold singularity core
      const coreR = Math.max(1.3, size * 0.085);
      if (r < coreR * 1.8) {
        const w = Math.max(0, 1 - r / (coreR * 1.8));
        rr = rr * (1 - w) + 255 * w;
        gg = gg * (1 - w) + 206 * w;
        bb = bb * (1 - w) + 78 * w;
      }

      buf[off] = Math.max(0, Math.min(255, Math.round(bb)));
      buf[off + 1] = Math.max(0, Math.min(255, Math.round(gg)));
      buf[off + 2] = Math.max(0, Math.min(255, Math.round(rr)));
      buf[off + 3] = Math.max(0, Math.min(255, Math.round(edgeAlpha * 255)));
    }
  }
  return buf;
}

const sizes = [64, 48, 32, 16];
const images = sizes.map((s) => ({ size: s, data: renderIconBmpDib(s) }));

const dirHeaderSize = 6 + images.length * 16;
const totalSize = dirHeaderSize + images.reduce((acc, im) => acc + im.data.length, 0);
const ico = Buffer.alloc(totalSize, 0);

// ICONDIR
ico.writeUInt16LE(0, 0);
ico.writeUInt16LE(1, 2); // 1 = ICO
ico.writeUInt16LE(images.length, 4);

let offset = dirHeaderSize;
images.forEach((im, idx) => {
  const entryOff = 6 + idx * 16;
  ico[entryOff] = im.size === 256 ? 0 : im.size;
  ico[entryOff + 1] = im.size === 256 ? 0 : im.size;
  ico[entryOff + 2] = 0;
  ico[entryOff + 3] = 0;
  ico.writeUInt16LE(1, entryOff + 4); // planes
  ico.writeUInt16LE(32, entryOff + 6); // bpp
  ico.writeUInt32LE(im.data.length, entryOff + 8);
  ico.writeUInt32LE(offset, entryOff + 12);
  im.data.copy(ico, offset);
  offset += im.data.length;
});

const outPath = join(OUT_DIR, 'cqm2.ico');
writeFileSync(outPath, ico);
console.log(`[gen-ico] Wrote ${outPath} (${ico.length} bytes, sizes=${sizes.join(',')})`);
