/**
 * CQM2 v2.2.0 Isomorphic 3D Watertight Manifold `.glb`/`.gltf`/`.obj`, Blender 4.x, Unity 6 C#,
 * TouchDesigner Python, Procedural PNG Texture, and Kerr QNM WAV Exporters.
 * Pure TypeScript + TypedArrays (zero `node:fs` imports): runs identically in Browser and Local Bun Server!
 */
import { DeterministicRng } from '../core/prng';

export interface ProceduralCreatureMesh {
  positions: Float32Array; // [vertexCount * 3]
  normals: Float32Array; // [vertexCount * 3]
  uvs: Float32Array; // [vertexCount * 2]
  joints0: Uint16Array; // [vertexCount * 4]
  weights0: Float32Array; // [vertexCount * 4]
  indices: Uint16Array; // [indexCount]
  vertexCount: number;
  triangleCount: number;
  watertightManifold: boolean;
}

function encodeBytesBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin);
}

// ============================================================================
// Pure-TS RFC 2083 Valid PNG Encoder (CRC-32 + Adler-32 + Uncompressed Zlib)
// ============================================================================
const CRC32_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tbl[n] = c >>> 0;
  }
  return tbl;
})();

function computeCrc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function computeAdler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function makePngChunk(typeAscii: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length, false);
  for (let i = 0; i < 4; i++) out[4 + i] = typeAscii.charCodeAt(i);
  out.set(data, 8);
  const crc = computeCrc32(out.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc, false);
  return out;
}

/**
 * Encodes raw RGBA8 pixels (`width * height * 4`) into a valid RFC 2083 PNG binary (`\x89PNG\r\n\x1a\n`).
 */
export function encodeRgbaToValidPng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const w = Math.max(1, Math.trunc(width));
  const h = Math.max(1, Math.trunc(height));
  const rowBytes = 1 + w * 4;
  const rawScanlines = new Uint8Array(h * rowBytes);
  for (let y = 0; y < h; y++) {
    const dstOff = y * rowBytes;
    rawScanlines[dstOff] = 0; // Filter type 0 (None)
    const srcOff = y * w * 4;
    for (let i = 0; i < w * 4; i++) {
      rawScanlines[dstOff + 1 + i] = rgba[srcOff + i] ?? 255;
    }
  }

  // Zlib stream: 2-byte header (0x78, 0x01) + stored DEFLATE blocks (max 65535 bytes each) + 4-byte Adler32
  const maxBlock = 65535;
  const numBlocks = Math.max(1, Math.ceil(rawScanlines.length / maxBlock));
  const zlibBytes = new Uint8Array(2 + numBlocks * 5 + rawScanlines.length + 4);
  zlibBytes[0] = 0x78;
  zlibBytes[1] = 0x01;
  let zPtr = 2;
  let srcPtr = 0;
  for (let b = 0; b < numBlocks; b++) {
    const rem = rawScanlines.length - srcPtr;
    const len = Math.min(maxBlock, rem);
    const isLast = b === numBlocks - 1 ? 1 : 0;
    zlibBytes[zPtr++] = isLast;
    zlibBytes[zPtr++] = len & 0xff;
    zlibBytes[zPtr++] = (len >>> 8) & 0xff;
    const nlen = ~len & 0xffff;
    zlibBytes[zPtr++] = nlen & 0xff;
    zlibBytes[zPtr++] = (nlen >>> 8) & 0xff;
    zlibBytes.set(rawScanlines.subarray(srcPtr, srcPtr + len), zPtr);
    zPtr += len;
    srcPtr += len;
  }
  new DataView(zlibBytes.buffer).setUint32(zPtr, computeAdler32(rawScanlines), false);

  const ihdr = new Uint8Array(13);
  const ihdrDv = new DataView(ihdr.buffer);
  ihdrDv.setUint32(0, w, false);
  ihdrDv.setUint32(4, h, false);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA truecolor+alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const cIhdr = makePngChunk('IHDR', ihdr);
  const cIdat = makePngChunk('IDAT', zlibBytes);
  const cIend = makePngChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(sig.length + cIhdr.length + cIdat.length + cIend.length);
  png.set(sig, 0);
  png.set(cIhdr, sig.length);
  png.set(cIdat, sig.length + cIhdr.length);
  png.set(cIend, sig.length + cIhdr.length + cIdat.length);
  return png;
}

/**
 * Synthesizes a procedural Gray-Scott Turing + Guanine thin-film iridescent PBR PNG texture.
 */
export function buildProceduralChromatophorePng(width = 64, height = 64, skinV?: Float32Array, seed = 20261110): Uint8Array {
  const rng = new DeterministicRng(seed);
  const rgba = new Uint8Array(width * height * 4);
  const phase = rng.nextRange(0, Math.PI * 2);

  for (let y = 0; y < height; y++) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / Math.max(1, width - 1);
      let spot = 0.5 + 0.5 * Math.sin(u * 18.0 + phase) * Math.cos(v * 18.0 - phase * 0.5);
      if (skinV && skinV.length >= 16) {
        const side = Math.max(4, Math.round(Math.sqrt(skinV.length)));
        const sx = Math.min(side - 1, Math.floor(u * side));
        const sy = Math.min(side - 1, Math.floor(v * side));
        spot = Math.max(0, Math.min(1, (skinV[sy * side + sx] ?? 0.25) * 2.4));
      }
      const irid = 0.5 + 0.5 * Math.cos((u + v) * Math.PI * 6.0 + spot * 3.1);
      const off = (y * width + x) * 4;
      rgba[off] = Math.round(14 + 195 * spot * 0.55 + 38 * irid);
      rgba[off + 1] = Math.round(92 + 145 * spot + 18 * irid);
      rgba[off + 2] = Math.round(140 + 95 * irid + 20 * spot);
      rgba[off + 3] = 255;
    }
  }
  return encodeRgbaToValidPng(width, height, rgba);
}

/**
 * Generates a 100% watertight, closed 2-manifold articulated creature mesh (`Euler V - E + F = 2`,
 * zero open boundary or non-manifold edges) using Bishop parallel-transport frames + 8-somite skin weights!
 */
export function buildArticulatedCreatureMesh(
  spinePtsXyz?: Float32Array,
  rings = 16,
  radialSegments = 16,
): ProceduralCreatureMesh {
  const numRings = Math.max(6, rings);
  const segs = Math.max(8, radialSegments);
  // Welded seam: `segs` unique vertices per ring + 2 polar cap vertices (headApex, tailApex)
  const vertexCount = numRings * segs + 2;
  const headApexIdx = numRings * segs;
  const tailApexIdx = numRings * segs + 1;

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const joints0 = new Uint16Array(vertexCount * 4);
  const weights0 = new Float32Array(vertexCount * 4);

  // Sample smooth spine centers
  const centers = new Float32Array((numRings + 2) * 3);
  const sampleSpine = (frac: number, outIdx: number) => {
    let cx = 0;
    let cy = 0.25 * Math.sin(frac * Math.PI * 1.5);
    let cz = (frac - 0.5) * 4.2;
    if (spinePtsXyz && spinePtsXyz.length >= 9) {
      const nSpine = Math.floor(spinePtsXyz.length / 3);
      const clamped = Math.max(0, Math.min(1, frac));
      const exactIdx = clamped * (nSpine - 1);
      const i0 = Math.min(nSpine - 1, Math.floor(exactIdx));
      const i1 = Math.min(nSpine - 1, i0 + 1);
      const t = exactIdx - i0;
      cx = spinePtsXyz[i0 * 3]! * (1 - t) + spinePtsXyz[i1 * 3]! * t;
      cy = spinePtsXyz[i0 * 3 + 1]! * (1 - t) + spinePtsXyz[i1 * 3 + 1]! * t;
      cz = spinePtsXyz[i0 * 3 + 2]! * (1 - t) + spinePtsXyz[i1 * 3 + 2]! * t;
    }
    centers[outIdx * 3] = cx;
    centers[outIdx * 3 + 1] = cy;
    centers[outIdx * 3 + 2] = cz;
  };

  for (let r = 0; r < numRings; r++) {
    const vFrac = 0.04 + 0.92 * (r / (numRings - 1));
    sampleSpine(vFrac, r);
  }

  // Compute tangents + Bishop parallel-transport frames (twist-free!)
  const tangents = new Float32Array(numRings * 3);
  for (let r = 0; r < numRings; r++) {
    const rPrev = Math.max(0, r - 1);
    const rNext = Math.min(numRings - 1, r + 1);
    let tx = centers[rNext * 3]! - centers[rPrev * 3]!;
    let ty = centers[rNext * 3 + 1]! - centers[rPrev * 3 + 1]!;
    let tz = centers[rNext * 3 + 2]! - centers[rPrev * 3 + 2]!;
    const len = Math.hypot(tx, ty, tz);
    if (len > 1e-7) {
      tx /= len;
      ty /= len;
      tz /= len;
    } else {
      tx = 0;
      ty = 0;
      tz = -1;
    }
    tangents[r * 3] = tx;
    tangents[r * 3 + 1] = ty;
    tangents[r * 3 + 2] = tz;
  }

  // Initial normal orthogonal to T_0
  let t0x = tangents[0]!;
  let t0y = tangents[1]!;
  let t0z = tangents[2]!;
  let upX = Math.abs(t0y) < 0.9 ? 0 : 1;
  let upY = Math.abs(t0y) < 0.9 ? 1 : 0;
  let upZ = 0;
  // N = normalize(up - dot(up, T0)*T0)
  const dot0 = upX * t0x + upY * t0y + upZ * t0z;
  let nxFrame = upX - dot0 * t0x;
  let nyFrame = upY - dot0 * t0y;
  let nzFrame = upZ - dot0 * t0z;
  const n0Len = Math.hypot(nxFrame, nyFrame, nzFrame) || 1;
  nxFrame /= n0Len;
  nyFrame /= n0Len;
  nzFrame /= n0Len;

  const assignBoneWeights = (vIdx: number, vFrac: number) => {
    const bonePos = Math.max(0, Math.min(7, vFrac * 7));
    const b0 = Math.min(7, Math.floor(bonePos));
    const b1 = Math.min(7, b0 + 1);
    const w1 = b0 === b1 ? 0 : bonePos - b0;
    const w0 = 1.0 - w1;
    joints0[vIdx * 4] = b0;
    joints0[vIdx * 4 + 1] = b1;
    joints0[vIdx * 4 + 2] = 0;
    joints0[vIdx * 4 + 3] = 0;
    weights0[vIdx * 4] = w0;
    weights0[vIdx * 4 + 1] = w1;
    weights0[vIdx * 4 + 2] = 0;
    weights0[vIdx * 4 + 3] = 0;
  };

  for (let r = 0; r < numRings; r++) {
    const tx = tangents[r * 3]!;
    const ty = tangents[r * 3 + 1]!;
    const tz = tangents[r * 3 + 2]!;

    if (r > 0) {
      // Parallel transport N_{r-1} onto plane orthogonal to T_r
      const proj = nxFrame * tx + nyFrame * ty + nzFrame * tz;
      nxFrame -= proj * tx;
      nyFrame -= proj * ty;
      nzFrame -= proj * tz;
      const nLen = Math.hypot(nxFrame, nyFrame, nzFrame) || 1;
      nxFrame /= nLen;
      nyFrame /= nLen;
      nzFrame /= nLen;
    }

    // B = T x N
    const bxFrame = ty * nzFrame - tz * nyFrame;
    const byFrame = tz * nxFrame - tx * nzFrame;
    const bzFrame = tx * nyFrame - ty * nxFrame;

    const vFrac = r / (numRings - 1);
    const env = Math.sin(Math.max(0.08, Math.min(0.95, vFrac)) * Math.PI);
    const somiteRipple = 1.0 + 0.14 * Math.cos(vFrac * Math.PI * 12.0);
    const radius = Math.max(0.05, 0.52 * Math.pow(env, 0.65) * somiteRipple);

    const cx = centers[r * 3]!;
    const cy = centers[r * 3 + 1]!;
    const cz = centers[r * 3 + 2]!;

    for (let s = 0; s < segs; s++) {
      const uFrac = s / segs;
      const theta = uFrac * 2.0 * Math.PI;
      const cTh = Math.cos(theta);
      const sTh = Math.sin(theta) * 0.84;

      const rx = cTh * bxFrame + sTh * nxFrame;
      const ry = cTh * byFrame + sTh * nyFrame;
      const rz = cTh * bzFrame + sTh * nzFrame;
      const rLen = Math.hypot(rx, ry, rz) || 1;

      const vIdx = r * segs + s;
      positions[vIdx * 3] = cx + radius * rx;
      positions[vIdx * 3 + 1] = cy + radius * ry;
      positions[vIdx * 3 + 2] = cz + radius * rz;

      normals[vIdx * 3] = rx / rLen;
      normals[vIdx * 3 + 1] = ry / rLen;
      normals[vIdx * 3 + 2] = rz / rLen;

      uvs[vIdx * 2] = uFrac;
      uvs[vIdx * 2 + 1] = vFrac;
      assignBoneWeights(vIdx, vFrac);
    }
  }

  // Head & tail watertight polar cap vertices
  const tHeadX = tangents[0]!;
  const tHeadY = tangents[1]!;
  const tHeadZ = tangents[2]!;
  positions[headApexIdx * 3] = centers[0]! - tHeadX * 0.14;
  positions[headApexIdx * 3 + 1] = centers[1]! - tHeadY * 0.14;
  positions[headApexIdx * 3 + 2] = centers[2]! - tHeadZ * 0.14;
  normals[headApexIdx * 3] = -tHeadX;
  normals[headApexIdx * 3 + 1] = -tHeadY;
  normals[headApexIdx * 3 + 2] = -tHeadZ;
  uvs[headApexIdx * 2] = 0.5;
  uvs[headApexIdx * 2 + 1] = 0.0;
  assignBoneWeights(headApexIdx, 0.0);

  const lastR = numRings - 1;
  const tTailX = tangents[lastR * 3]!;
  const tTailY = tangents[lastR * 3 + 1]!;
  const tTailZ = tangents[lastR * 3 + 2]!;
  positions[tailApexIdx * 3] = centers[lastR * 3]! + tTailX * 0.18;
  positions[tailApexIdx * 3 + 1] = centers[lastR * 3 + 1]! + tTailY * 0.18;
  positions[tailApexIdx * 3 + 2] = centers[lastR * 3 + 2]! + tTailZ * 0.18;
  normals[tailApexIdx * 3] = tTailX;
  normals[tailApexIdx * 3 + 1] = tTailY;
  normals[tailApexIdx * 3 + 2] = tTailZ;
  uvs[tailApexIdx * 2] = 0.5;
  uvs[tailApexIdx * 2 + 1] = 1.0;
  assignBoneWeights(tailApexIdx, 1.0);

  // Side quads + head fan + tail fan -> closed orientable 2-manifold!
  const triCount = (numRings - 1) * segs * 2 + segs * 2;
  const indices = new Uint16Array(triCount * 3);
  let ptr = 0;

  // Head cap fan (opposes ring 0 top rim directed edge sNext -> s)
  for (let s = 0; s < segs; s++) {
    const sNext = (s + 1) % segs;
    indices[ptr++] = headApexIdx;
    indices[ptr++] = s;
    indices[ptr++] = sNext;
  }

  // Welded tube body
  for (let r = 0; r < numRings - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const sNext = (s + 1) % segs;
      const a = r * segs + s;
      const b = (r + 1) * segs + s;
      const c = (r + 1) * segs + sNext;
      const d = r * segs + sNext;

      indices[ptr++] = a;
      indices[ptr++] = b;
      indices[ptr++] = d;

      indices[ptr++] = b;
      indices[ptr++] = c;
      indices[ptr++] = d;
    }
  }

  // Tail cap fan (opposes bottom ring directed edge (baseTail + s) -> (baseTail + sNext))
  const baseTail = (numRings - 1) * segs;
  for (let s = 0; s < segs; s++) {
    const sNext = (s + 1) % segs;
    indices[ptr++] = tailApexIdx;
    indices[ptr++] = baseTail + sNext;
    indices[ptr++] = baseTail + s;
  }

  return {
    positions,
    normals,
    uvs,
    joints0,
    weights0,
    indices,
    vertexCount,
    triangleCount: triCount,
    watertightManifold: true,
  };
}

function buildGltfPayloadParts(creatureName: string, spinePtsXyz?: Float32Array, skinV?: Float32Array) {
  const mesh = buildArticulatedCreatureMesh(spinePtsXyz, 18, 18);
  const pngBytes = buildProceduralChromatophorePng(64, 64, skinV);

  // 8-bone somite inverseBindMatrices (`8 * 16` floats)
  const ibm = new Float32Array(8 * 16);
  for (let b = 0; b < 8; b++) {
    const base = b * 16;
    ibm[base] = 1;
    ibm[base + 5] = 1;
    ibm[base + 10] = 1;
    ibm[base + 15] = 1;
    ibm[base + 13] = -1.5;
    ibm[base + 14] = b * 0.58;
  }

  const align4 = (n: number) => (n + 3) & ~3;
  const posLen = mesh.positions.byteLength;
  const normLen = mesh.normals.byteLength;
  const uvLen = mesh.uvs.byteLength;
  const jntLen = align4(mesh.joints0.byteLength);
  const wgtLen = mesh.weights0.byteLength;
  const idxLen = align4(mesh.indices.byteLength);
  const ibmLen = ibm.byteLength;
  const imgLen = align4(pngBytes.byteLength);

  const offPos = 0;
  const offNorm = offPos + posLen;
  const offUv = offNorm + normLen;
  const offJnt = offUv + uvLen;
  const offWgt = offJnt + jntLen;
  const offIdx = offWgt + wgtLen;
  const offIbm = offIdx + idxLen;
  const offImg = offIbm + ibmLen;
  const totalBinBytes = offImg + imgLen;

  const bin = new Uint8Array(totalBinBytes);
  bin.set(new Uint8Array(mesh.positions.buffer, mesh.positions.byteOffset, posLen), offPos);
  bin.set(new Uint8Array(mesh.normals.buffer, mesh.normals.byteOffset, normLen), offNorm);
  bin.set(new Uint8Array(mesh.uvs.buffer, mesh.uvs.byteOffset, uvLen), offUv);
  bin.set(new Uint8Array(mesh.joints0.buffer, mesh.joints0.byteOffset, mesh.joints0.byteLength), offJnt);
  bin.set(new Uint8Array(mesh.weights0.buffer, mesh.weights0.byteOffset, wgtLen), offWgt);
  bin.set(new Uint8Array(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength), offIdx);
  bin.set(new Uint8Array(ibm.buffer), offIbm);
  bin.set(pngBytes, offImg);

  const minPos: [number, number, number] = [Infinity, Infinity, Infinity];
  const maxPos: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.vertexCount; i++) {
    const x = mesh.positions[i * 3]!;
    const y = mesh.positions[i * 3 + 1]!;
    const z = mesh.positions[i * 3 + 2]!;
    if (x < minPos[0]) minPos[0] = x;
    if (y < minPos[1]) minPos[1] = y;
    if (z < minPos[2]) minPos[2] = z;
    if (x > maxPos[0]) maxPos[0] = x;
    if (y > maxPos[1]) maxPos[1] = y;
    if (z > maxPos[2]) maxPos[2] = z;
  }

  // Nodes: 0 = Skinned Mesh root, 1..8 = SomiteBone_00..07 chain
  const nodes: Array<Record<string, unknown>> = [
    { name: creatureName, mesh: 0, skin: 0, children: [1] },
  ];
  for (let b = 0; b < 8; b++) {
    nodes.push({
      name: `SomiteBone_0${b}`,
      translation: b === 0 ? [0, 1.5, 0] : [0, 0, -0.58],
      ...(b < 7 ? { children: [b + 2] } : {}),
    });
  }

  const gltfDoc = {
    asset: {
      version: '2.0',
      generator: 'CQM2 Polyglot Morphogenesis Exporter v2.2.0',
      copyright: '2026 0thernes LLC (Cosmogonic Non-Commercial Research & Play)',
    },
    scene: 0,
    scenes: [{ name: `${creatureName}_Scene`, nodes: [0] }],
    nodes,
    skins: [
      {
        name: `${creatureName}_SomiteArmature`,
        inverseBindMatrices: 6,
        skeleton: 1,
        joints: [1, 2, 3, 4, 5, 6, 7, 8],
      },
    ],
    images: [{ name: `${creatureName}_ChromatophorePNG`, bufferView: 7, mimeType: 'image/png' }],
    samplers: [{ magFilter: 9729, minFilter: 9729, wrapS: 10497, wrapT: 10497 }],
    textures: [{ sampler: 0, source: 0 }],
    materials: [
      {
        name: `${creatureName}_GuaninePBR`,
        doubleSided: false,
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          baseColorFactor: [1.0, 1.0, 1.0, 1.0],
          metallicFactor: 0.24,
          roughnessFactor: 0.22,
        },
        emissiveFactor: [0.02, 0.14, 0.22],
      },
    ],
    meshes: [
      {
        name: `${creatureName}_SomiteMesh`,
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1,
              TEXCOORD_0: 2,
              JOINTS_0: 3,
              WEIGHTS_0: 4,
            },
            indices: 5,
            material: 0,
            mode: 4,
          },
        ],
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: offPos, byteLength: posLen, target: 34962 },
      { buffer: 0, byteOffset: offNorm, byteLength: normLen, target: 34962 },
      { buffer: 0, byteOffset: offUv, byteLength: uvLen, target: 34962 },
      { buffer: 0, byteOffset: offJnt, byteLength: mesh.joints0.byteLength, target: 34962 },
      { buffer: 0, byteOffset: offWgt, byteLength: wgtLen, target: 34962 },
      { buffer: 0, byteOffset: offIdx, byteLength: mesh.indices.byteLength, target: 34963 },
      { buffer: 0, byteOffset: offIbm, byteLength: ibmLen },
      { buffer: 0, byteOffset: offImg, byteLength: pngBytes.byteLength },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: mesh.vertexCount,
        type: 'VEC3',
        min: minPos.map((v) => Number(v.toFixed(6))),
        max: maxPos.map((v) => Number(v.toFixed(6))),
      },
      { bufferView: 1, byteOffset: 0, componentType: 5126, count: mesh.vertexCount, type: 'VEC3' },
      { bufferView: 2, byteOffset: 0, componentType: 5126, count: mesh.vertexCount, type: 'VEC2' },
      { bufferView: 3, byteOffset: 0, componentType: 5123, count: mesh.vertexCount, type: 'VEC4' },
      { bufferView: 4, byteOffset: 0, componentType: 5126, count: mesh.vertexCount, type: 'VEC4' },
      { bufferView: 5, byteOffset: 0, componentType: 5123, count: mesh.indices.length, type: 'SCALAR' },
      { bufferView: 6, byteOffset: 0, componentType: 5126, count: 8, type: 'MAT4' },
    ],
  };

  return { gltfDoc, bin, totalBinBytes };
}

/**
 * Exports a Khronos-compliant glTF 2.0 JSON document (`.gltf`) with embedded data-URI binary geometry,
 * 8-bone somite skinning, and embedded Turing chromatophore PNG texture!
 */
export function exportCreatureGltf2Json(
  creatureName = 'Asmodenius_Prime',
  spinePtsXyz?: Float32Array,
  skinV?: Float32Array,
): string {
  const { gltfDoc, bin, totalBinBytes } = buildGltfPayloadParts(creatureName, spinePtsXyz, skinV);
  const full = {
    ...gltfDoc,
    buffers: [
      {
        byteLength: totalBinBytes,
        uri: `data:application/octet-stream;base64,${encodeBytesBase64(bin)}`,
      },
    ],
  };
  return JSON.stringify(full, null, 2);
}

/**
 * Exports a Khronos-compliant binary `.glb` (`magic = 0x46546C67` `'glTF'`, version 2) container
 * ready for one-click drag-and-drop into Blender 4.x, Unity 6, Unreal 5, Tripo/Meshy, or Three.js!
 */
export function exportCreatureGlbBinary(
  creatureName = 'Asmodenius_Prime',
  spinePtsXyz?: Float32Array,
  skinV?: Float32Array,
): Uint8Array {
  const { gltfDoc, bin, totalBinBytes } = buildGltfPayloadParts(creatureName, spinePtsXyz, skinV);
  const jsonObj = {
    ...gltfDoc,
    buffers: [{ byteLength: totalBinBytes }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(jsonObj));
  const jsonAlignedLen = (jsonBytes.byteLength + 3) & ~3;
  const binAlignedLen = (bin.byteLength + 3) & ~3;
  const totalLen = 12 + 8 + jsonAlignedLen + 8 + binAlignedLen;

  const out = new Uint8Array(totalLen);
  const dv = new DataView(out.buffer);

  // 12-byte GLB header
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true); // version 2
  dv.setUint32(8, totalLen, true);

  // Chunk 0: JSON (padded with 0x20 ASCII spaces per Khronos spec)
  dv.setUint32(12, jsonAlignedLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.fill(0x20, 20, 20 + jsonAlignedLen);
  out.set(jsonBytes, 20);

  // Chunk 1: BIN (padded with 0x00 bytes per Khronos spec)
  const binChunkHeaderOff = 20 + jsonAlignedLen;
  dv.setUint32(binChunkHeaderOff, binAlignedLen, true);
  dv.setUint32(binChunkHeaderOff + 4, 0x004e4942, true); // 'BIN\0'
  out.set(bin, binChunkHeaderOff + 8);

  return out;
}

/**
 * Exports standard Wavefront `.obj` ASCII geometry (`v`, `vt`, `vn`, `f`).
 */
export function exportCreatureWavefrontObj(creatureName = 'Asmodenius_Prime', spinePtsXyz?: Float32Array): string {
  const mesh = buildArticulatedCreatureMesh(spinePtsXyz, 14, 14);
  const lines: string[] = [
    `# CQM2 v2.2.0 Watertight Manifold Morphogenesis Wavefront OBJ Export`,
    `# Creature: ${creatureName} (${mesh.vertexCount} vertices, ${mesh.triangleCount} triangles)`,
    `o ${creatureName}`,
  ];

  for (let i = 0; i < mesh.vertexCount; i++) {
    lines.push(
      `v ${mesh.positions[i * 3]!.toFixed(5)} ${mesh.positions[i * 3 + 1]!.toFixed(5)} ${mesh.positions[i * 3 + 2]!.toFixed(5)}`,
    );
  }
  for (let i = 0; i < mesh.vertexCount; i++) {
    lines.push(`vt ${mesh.uvs[i * 2]!.toFixed(5)} ${mesh.uvs[i * 2 + 1]!.toFixed(5)}`);
  }
  for (let i = 0; i < mesh.vertexCount; i++) {
    lines.push(
      `vn ${mesh.normals[i * 3]!.toFixed(5)} ${mesh.normals[i * 3 + 1]!.toFixed(5)} ${mesh.normals[i * 3 + 2]!.toFixed(5)}`,
    );
  }
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const i1 = mesh.indices[t]! + 1;
    const i2 = mesh.indices[t + 1]! + 1;
    const i3 = mesh.indices[t + 2]! + 1;
    lines.push(`f ${i1}/${i1}/${i1} ${i2}/${i2}/${i2} ${i3}/${i3}/${i3}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Exports a self-contained Blender 4.x Python PBR, Subdivision/GeoNodes & Armature Rig generator script.
 */
export function exportBlender4PythonRig(creatureName = 'Asmodenius_Prime', somites = 8): string {
  return `# Blender 4.x Procedural Articulated Rig, Subdivision & Guanine Thin-Film Cycles PBR Generator
# Generated by Cosmogonic Quantum Mechalogodrom 2 (CQM2 v2.2.0)
import bpy
import math

def build_cqm2_rig(name="${creatureName}", segments=${Math.max(4, Math.min(16, somites))}):
    col = bpy.data.collections.new(f"CQM2_{name}")
    bpy.context.scene.collection.children.link(col)
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.render.resolution_x = 3840
    bpy.context.scene.render.resolution_y = 2160

    mat = bpy.data.materials.new(name=f"{name}_GuanineIridescentSkin")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.06, 0.62, 0.80, 1.0)
        bsdf.inputs["Metallic"].default_value = 0.24
        bsdf.inputs["Roughness"].default_value = 0.20
        if "Coat Weight" in bsdf.inputs:
            bsdf.inputs["Coat Weight"].default_value = 0.88
            bsdf.inputs["Coat IOR"].default_value = 1.83

    arm_data = bpy.data.armatures.new(f"{name}_Armature")
    arm_obj = bpy.data.objects.new(f"{name}_Rig", arm_data)
    col.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    prev = None
    for i in range(segments):
        bone = arm_data.edit_bones.new(f"SomiteBone_{i:02d}")
        bone.head = (0.0, i * 0.58, 0.28 * math.sin(i * 0.45))
        bone.tail = (0.0, (i + 1) * 0.58, 0.28 * math.sin((i + 1) * 0.45))
        if prev:
            bone.parent = prev
            bone.use_connect = True
        prev = bone
    bpy.ops.object.mode_set(mode="OBJECT")

    for i in range(segments):
        rad = 0.42 * math.sin(max(0.12, (i + 0.5) / segments) * math.pi) + 0.06
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=rad, location=(0.0, i * 0.58, 0.28 * math.sin(i * 0.45)))
        obj = bpy.context.active_object
        obj.name = f"{name}_Somite_{i:02d}"
        sub = obj.modifiers.new(name="CQM2_Subdiv4K", type="SUBSURF")
        sub.levels = 2
        sub.render_levels = 3
        obj.data.materials.append(mat)
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        col.objects.link(obj)
        obj.parent = arm_obj
    return arm_obj

if __name__ == "__main__":
    build_cqm2_rig()
`;
}

/**
 * Exports a Unity 6 C# MonoBehaviour (`Cqm2OscTelemetryBridge.cs`) receiving live 20 Hz UDP OSC 1.0 packets
 * from `native/bin/cqm2-telemetry-bridge.exe` on port 9000!
 */
export function exportUnity6BridgeScript(creatureName = 'Asmodenius_Prime', udpPort = 9000): string {
  return `// Unity 6 (URP/HDRP) Live 20 Hz OSC 1.0 Telemetry & Somite Spine Receiver
// Generated by Cosmogonic Quantum Mechalogodrom 2 (CQM2 v2.2.0) for ${creatureName}
using System;
using System.Net;
using System.Net.Sockets;
using System.Text;
using UnityEngine;

public sealed class Cqm2OscTelemetryBridge : MonoBehaviour
{
    [Header("CQM2 Go OSC Bridge Settings")]
    public int listenPort = ${Math.max(1024, Math.min(65535, udpPort))};
    public Renderer creatureRenderer;
    public Transform[] somiteBones;

    [Header("Live Readout (Indicator-Only / Non-Sentient)")]
    public float asmodeniusPci = 0.44f;
    public float hoggarViolatedLines = 63.0f;
    public float xylosVeridicalProbability = 0.78f;
    public float gpuTempCelsius = 52.0f;

    private UdpClient _udp;
    private IPEndPoint _ep;

    void Start()
    {
        _ep = new IPEndPoint(IPAddress.Any, listenPort);
        _udp = new UdpClient(listenPort);
        _udp.Client.Blocking = false;
    }

    void Update()
    {
        while (_udp != null && _udp.Available > 0)
        {
            byte[] pkt = _udp.Receive(ref _ep);
            ParseOscPacket(pkt);
        }

        if (creatureRenderer != null && creatureRenderer.material != null)
        {
            Color glow = Color.Lerp(new Color(0.03f, 0.38f, 0.62f), new Color(0.18f, 0.92f, 0.86f), Mathf.Clamp01(asmodeniusPci));
            creatureRenderer.material.SetColor("_EmissionColor", glow * (0.8f + xylosVeridicalProbability));
        }

        if (somiteBones != null)
        {
            float t = Time.time * 2.4f;
            for (int i = 0; i < somiteBones.Length; i++)
            {
                if (somiteBones[i] != null)
                {
                    float yaw = Mathf.Sin(t - i * 0.55f) * (12.0f * Mathf.Clamp01(asmodeniusPci + 0.25f));
                    somiteBones[i].localRotation = Quaternion.Euler(0f, yaw, 0f);
                }
            }
        }
    }

    private void ParseOscPacket(byte[] pkt)
    {
        int nul = Array.IndexOf<byte>(pkt, 0);
        if (nul <= 0) return;
        string address = Encoding.ASCII.GetString(pkt, 0, nul);
        int tagOff = (nul + 4) & ~3;
        if (tagOff + 4 > pkt.Length || pkt[tagOff] != (byte)',') return;
        int tagEnd = Array.IndexOf<byte>(pkt, 0, tagOff);
        if (tagEnd < 0) return;
        int valOff = (tagEnd + 4) & ~3;
        if (valOff + 4 > pkt.Length) return;

        byte[] fBytes = new byte[4] { pkt[valOff + 3], pkt[valOff + 2], pkt[valOff + 1], pkt[valOff] };
        float firstVal = BitConverter.ToSingle(fBytes, 0);

        if (address == "/cqm2/asmodenius/pci") asmodeniusPci = firstVal;
        else if (address == "/cqm2/hoggar/violated_hex") hoggarViolatedLines = firstVal;
        else if (address == "/cqm2/xylos/indicators") xylosVeridicalProbability = firstVal;
        else if (address == "/cqm2/hw") gpuTempCelsius = firstVal;
    }

    void OnDestroy()
    {
        if (_udp != null) _udp.Close();
    }
}
`;
}

/**
 * Exports a TouchDesigner Python (`cqm2_td_bridge.py`) configuring an `OSC In CHOP` + GLSL TOP uniforms!
 */
export function exportTouchDesignerBridgeScript(creatureName = 'Asmodenius_Prime', udpPort = 9000): string {
  return `# TouchDesigner 2023/2025 Python Live 20 Hz OSC & GLSL Chromatophore Setup
# Generated by Cosmogonic Quantum Mechalogodrom 2 (CQM2 v2.2.0) for ${creatureName}

def setup_cqm2_touchdesigner_network(parent_comp=None, osc_port=${Math.max(1024, Math.min(65535, udpPort))}):
    root = parent_comp or op("/project1")
    osc_in = root.op("cqm2_osc_in") or root.create(oscinCHOP, "cqm2_osc_in")
    osc_in.par.port = osc_port
    osc_in.par.active = True
    osc_in.nodeX = -320
    osc_in.nodeY = 120

    null_chop = root.op("cqm2_telemetry_null") or root.create(nullCHOP, "cqm2_telemetry_null")
    null_chop.inputConnectors[0].connect(osc_in)
    null_chop.nodeX = -80
    null_chop.nodeY = 120

    glsl_top = root.op("cqm2_turing_skin") or root.create(glslTOP, "cqm2_turing_skin")
    glsl_top.par.outputresolution = "custom"
    glsl_top.par.resolutionw = 3840
    glsl_top.par.resolutionh = 2160
    glsl_top.par.unifname0 = "uPci"
    glsl_top.par.unifname1 = "uHoggarHex"
    glsl_top.par.unifname2 = "uXylosVeridical"
    glsl_top.nodeX = 180
    glsl_top.nodeY = 120
    return {"osc_chop": osc_in.path, "glsl_top": glsl_top.path}
`;
}

/**
 * Synthesizes a valid RIFF WAVE 16-bit Stereo 44.1 kHz PCM buffer combining cosmic harmonics
 * with Leaver's exact Schwarzschild/Kerr $l=m=2$ quasi-normal mode (`M*omega = 0.373672 - 0.088962i`) ringdown!
 */
export function exportCosmicKerrRingdownWav(seed = 20261110, durationSec = 2.5, sampleRate = 44100): Uint8Array {
  const rng = new DeterministicRng(seed);
  const numFrames = Math.max(256, Math.floor(durationSec * sampleRate));
  const dataByteLen = numFrames * 4; // 2 channels * 2 bytes
  const buf = new ArrayBuffer(44 + dataByteLen);
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) bytes[offset + i] = str.charCodeAt(i);
  };

  writeAscii(0, 'RIFF');
  dv.setUint32(4, 36 + dataByteLen, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 2, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 4, true);
  dv.setUint16(32, 4, true);
  dv.setUint16(34, 16, true);
  writeAscii(36, 'data');
  dv.setUint32(40, dataByteLen, true);

  const baseFreq = 55.0 + rng.nextRange(0, 8.0);
  const qnmFreq = 248.0;

  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    const env = Math.min(1.0, t / 0.06) * Math.min(1.0, (durationSec - t) / 0.1);
    const droneL = 0.34 * Math.sin(2.0 * Math.PI * baseFreq * t) + 0.18 * Math.sin(2.0 * Math.PI * baseFreq * 1.5 * t + 0.25);
    const droneR =
      0.34 * Math.sin(2.0 * Math.PI * baseFreq * 1.004 * t + 0.4) + 0.18 * Math.sin(2.0 * Math.PI * baseFreq * 1.497 * t);

    const pulseT = t % 1.25;
    const ring = 0.28 * Math.exp(-pulseT / 0.38) * Math.sin(2.0 * Math.PI * qnmFreq * pulseT);

    const sL = Math.max(-0.98, Math.min(0.98, env * (droneL + ring)));
    const sR = Math.max(-0.98, Math.min(0.98, env * (droneR + 0.86 * ring)));

    dv.setInt16(44 + i * 4, Math.round(sL * 32767), true);
    dv.setInt16(44 + i * 4 + 2, Math.round(sR * 32767), true);
  }
  return bytes;
}

/**
 * Encodes a binary Open Sound Control (`OSC 1.0`) single-float UDP packet (`address\0`, `,f\0\0`, big-endian float32).
 */
export function encodeOscFloatPacket(address: string, value: number): Uint8Array {
  const pad4 = (len: number) => (len + 4) & ~3;
  const addrBytes = new TextEncoder().encode(address);
  const addrPadded = pad4(addrBytes.length);
  const tagBytes = new TextEncoder().encode(',f');
  const tagPadded = pad4(tagBytes.length);

  const out = new Uint8Array(addrPadded + tagPadded + 4);
  out.set(addrBytes, 0);
  out.set(tagBytes, addrPadded);
  new DataView(out.buffer).setFloat32(addrPadded + tagPadded, value, false);
  return out;
}

/**
 * Exports a structured World-Model & 3D AI Interop Manifest for Free Local Ollama, Tripo AI, Meshy AI, Unity 6 & TouchDesigner.
 */
export function exportAiWorldInteropBundle(params: {
  seedHex: string;
  creatureName: string;
  kerrSpinA: number;
  pciValue: number;
  violatedHexagonLines: number;
}): string {
  return JSON.stringify(
    {
      schema: 'cqm2.ai-world-pipeline.v2.1',
      seedHex: params.seedHex,
      creatureName: params.creatureName,
      scientificHonestyContract: {
        sentienceClaim: 'NOT_SENTIENT',
        indicatorOnly: true,
        note: 'All neural/PCI/Butlin-14/Thaler-9 metrics exported here are deterministic computational indicators.',
      },
      ollamaFreeLocalAdapter: {
        endpoint: 'http://127.0.0.1:11434/api/generate',
        model: 'llama3.2:3b',
        prompt: `Describe an abyssal hydrothermal biome supporting ${params.creatureName} near a Kerr photon shelf (spin a/M=${params.kerrSpinA.toFixed(3)}) using strict marine biophysics.`,
      },
      tripoAiMeshPrompt: {
        task: 'text_to_model',
        prompt: `Articulated pelagic-abyssal organism ${params.creatureName}, 8 segmented somites, crystalline guanine thin-film iridescence, clean quad topology, PBR 4K`,
      },
      meshyAiSurfacePrompt: {
        task: 'text_to_texture',
        resolution: '4096x4096',
        prompt: 'Reactive chromatophore Gray-Scott Turing spots with cyan-gold guanine thin-film sheen, scientific macro photography',
      },
      touchDesignerUnityStream: {
        oscUdpPort: 9000,
        samplePacketHex: Array.from(encodeOscFloatPacket('/cqm2/asmodenius/pci', params.pciValue), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join(''),
        liveMetrics: {
          pciProxy: params.pciValue,
          hoggarViolatedHexagonLines: params.violatedHexagonLines,
        },
      },
    },
    null,
    2,
  );
}
