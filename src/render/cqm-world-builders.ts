/**
 * CQM2 v2.2.0 — Full-Scale Cosmogonic 3D World Builders (`src/render/cqm-world-builders.ts`).
 *
 * Constructs all iconic CQM visual landmarks using batched GPU `THREE.InstancedMesh` pools and custom GLSL shaders
 * so the scene renders with full maximalist density at 4K `60+ FPS` (replacing CQM v1's 9 FPS CPU object loops):
 *   1. `GodColossus` towering rainbow oil-slick prismatic billowing brain-coral manifold (7 seamless baked lobes).
 *   2. 16 Grounded Obsidian/Emerald Monolith Spires + glowing emerald frustum toppers + data catenaries.
 *   3. Diagonal Upper-Right Cantilevered Brutalist Megastructure Overhang & Foreground Crimson/Navy Ziggurats.
 *   4. Floating Emerald Frustums (`Viz3D`), Vertical Cyan Light-Ribbon Shafts, Frosted Crystals & Wireframe Cages.
 *   5. 22 Hovering Compound 3D Voxel Glitch-Clusters (merged chunky sub-cubes with crisp per-cube vertex colors).
 *   6. Woven 22-Ring Holographic Geodesic Wire-Sphere Sanctuary Domes + `CrystalEcosystem` Big Tree Sanctuary.
 *   7. `6,272` GPU-Instanced Bioluminescent Wild Alien Flora across `49` organic groves (`4` draw calls, `0` CPU loop).
 */
import * as THREE from 'three';
import { getZigBridge } from '../native/zig-bridge';
import {
  ALIEN_FLORA_FRAGMENT_SHADER,
  ALIEN_FLORA_VERTEX_SHADER,
  GOD_COLOSSUS_FRAGMENT_SHADER,
  GOD_COLOSSUS_VERTEX_SHADER,
  VOXEL_GLITCH_FRAGMENT_SHADER,
  VOXEL_GLITCH_VERTEX_SHADER,
} from './shaders';

function splitMix32(state: number): number {
  let z = (state + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

export function sampleCqmTerrainHeight(x: number, z: number, timeSec = 0, chaos = 0.5): number {
  const baseY = -14.0;
  let h = Math.sin(x * 0.012) * Math.cos(z * 0.01) * 8.5;
  h += Math.sin(x * 0.04 - z * 0.03) * 2.8;
  h += Math.cos(x * 0.024 + z * 0.028 + timeSec * 0.08) * (1.2 + 1.8 * Math.min(1.5, Math.max(0, chaos)));
  return baseY + h;
}

/**
 * Merges an array of non-indexed or indexed BufferGeometries with optional per-piece RGB color into a single BufferGeometry.
 */
function mergeSubGeometriesWithColor(
  pieces: ReadonlyArray<{ geo: THREE.BufferGeometry; color?: THREE.Color }>,
): THREE.BufferGeometry {
  let totalVerts = 0;
  const nonIndexedPieces = pieces.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    totalVerts += g.attributes.position!.count;
    return { geo: g, color: p.color };
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);

  let offset = 0;
  for (const item of nonIndexedPieces) {
    const pos = item.geo.attributes.position!;
    const nrm = item.geo.attributes.normal!;
    const count = pos.count;
    positions.set(pos.array as Float32Array, offset * 3);
    normals.set(nrm.array as Float32Array, offset * 3);
    const r = item.color ? item.color.r : 1;
    const g = item.color ? item.color.g : 1;
    const b = item.color ? item.color.b : 1;
    for (let v = 0; v < count; v++) {
      const base = (offset + v) * 3;
      colors[base] = r;
      colors[base + 1] = g;
      colors[base + 2] = b;
    }
    offset += count;
    item.geo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

export function buildGodColossusGroup(uniforms: {
  uTime: { value: number };
  uChaos: { value: number };
  uEntropy: { value: number };
  uBrutalFade: { value: number };
}): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-8, 138, -185);

  const mat = new THREE.ShaderMaterial({
    vertexShader: GOD_COLOSSUS_VERTEX_SHADER,
    fragmentShader: GOD_COLOSSUS_FRAGMENT_SHADER,
    uniforms,
  });

  // 7 baked-radius cumulus/brain-coral lobes forming CQM's tall billowing rainbow contour column
  // (No `mesh.scale`, so world-space displacement and contour frequencies are 100% seamless across every lobe!)
  const lobes: ReadonlyArray<[number, number, number, number, number]> = [
    [0, 6, 0, 92, 5],
    [-46, 58, 18, 66, 5],
    [44, 48, 14, 62, 5],
    [-28, -58, 28, 68, 5],
    [30, -52, 22, 64, 5],
    [-6, -104, 36, 52, 4],
    [-16, 98, -10, 56, 4],
  ];

  for (const [lx, ly, lz, radius, detail] of lobes) {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(lx, ly, lz);
    group.add(mesh);
  }

  return group;
}

export function buildGroundedObeliskSpires(): THREE.Group {
  const group = new THREE.Group();

  // Positioned to match the iconic slender pitch-black obelisk needles in CQM (`left x≈-86`, `center x≈0`, `right x≈+58`, etc.)
  const spireCoords: ReadonlyArray<[number, number, number, number]> = [
    [-86, 118, 168, 0.42],
    [0, 88, 142, 0.45],
    [56, 96, 134, 0.38],
    [-148, 38, 192, 0.48],
    [108, 22, 174, 0.40],
    [-22, -72, 214, 0.52],
    [-92, -105, 186, 0.36],
    [138, 92, 152, 0.44],
    [-198, 68, 172, 0.41],
    [182, -88, 192, 0.46],
    [-58, 168, 108, 0.39],
    [78, 152, 114, 0.43],
    [-245, -138, 208, 0.50],
    [238, -152, 202, 0.47],
    [-124, 28, 136, 0.42],
    [44, -58, 158, 0.44],
  ];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x05080e,
    emissive: 0x031412,
    emissiveIntensity: 0.38,
    metalness: 0.85,
    roughness: 0.22,
  });

  const topperMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.95,
    roughness: 0.22,
    metalness: 0.2,
  });

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.44,
    side: THREE.DoubleSide,
  });

  const topperGeo = new THREE.CylinderGeometry(1.5, 3.8, 5.2, 12);
  const haloGeo = new THREE.RingGeometry(3.4, 4.1, 20);
  haloGeo.rotateX(Math.PI / 2);

  const catenaryPoints: THREE.Vector3[] = [];

  for (let i = 0; i < spireCoords.length; i++) {
    const [x, z, height, hue] = spireCoords[i]!;
    const groundY = sampleCqmTerrainHeight(x, z);
    const radiusBottom = 2.1 + (i % 3) * 0.55;
    const spireGeo = new THREE.CylinderGeometry(0.28, radiusBottom, height, 6);
    const spire = new THREE.Mesh(spireGeo, bodyMat);
    spire.position.set(x, groundY + height * 0.5 - 2, z);
    group.add(spire);

    const topY = groundY + height - 1.5;
    if (i % 2 === 0) {
      const topper = new THREE.Mesh(topperGeo, topperMat);
      topper.position.set(x, topY + 3.0, z);
      group.add(topper);
    }

    const halo = new THREE.Mesh(haloGeo, ringMat);
    halo.position.set(x, groundY + height * 0.72, z);
    group.add(halo);

    const ribColor = new THREE.Color().setHSL(hue, 0.85, 0.52);
    const ribMat = new THREE.LineBasicMaterial({ color: ribColor, transparent: true, opacity: 0.48 });
    const ribPts = [new THREE.Vector3(x, groundY, z + radiusBottom * 0.85), new THREE.Vector3(x, topY, z + 0.3)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ribPts), ribMat));

    catenaryPoints.push(new THREE.Vector3(x, groundY + height * 0.68, z));
  }

  const pipeMat = new THREE.LineBasicMaterial({
    color: 0x7c3aed,
    transparent: true,
    opacity: 0.3,
  });
  for (let i = 0; i < catenaryPoints.length - 1; i += 2) {
    const pA = catenaryPoints[i]!;
    const pB = catenaryPoints[i + 1]!;
    const mid = pA.clone().add(pB).multiplyScalar(0.5);
    mid.y -= 18;
    const curve = new THREE.QuadraticBezierCurve3(pA, mid, pB);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(16));
    group.add(new THREE.Line(geo, pipeMat));
  }

  return group;
}

export function buildBrutalistMegastructures(seed = 20261110): {
  group: THREE.Group;
  slabsMesh: THREE.InstancedMesh;
} {
  const group = new THREE.Group();
  const totalSlabs = 152;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x050b16,
    emissiveIntensity: 0.32,
    roughness: 0.46,
    metalness: 0.28,
  });

  const slabsMesh = new THREE.InstancedMesh(boxGeo, boxMat, totalSlabs);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Overhang architectural slate/navy palette + foreground ziggurat crimson/plum/jade palette
  const overhangPalette = [0x14283e, 0x1b3552, 0x0f2034, 0x11323b, 0x0a1524];
  const zigguratPalette = [0x6e1842, 0x4d1233, 0x142942, 0x1e3a58, 0x13423c, 0x881d52];

  let rng = splitMix32(seed ^ 0xb407a115);
  const rand = () => {
    rng = splitMix32(rng);
    return (rng >>> 8) / 16777216;
  };

  let idx = 0;

  // 1. Signature Diagonal Upper-Right Cantilevered Megastructure Overhang (sweeps top-center `(-24, 168, 52)` -> right `(138, 16, 114)`)
  for (let i = 0; i < 44 && idx < totalSlabs; i++) {
    const t = i / 43;
    const bx = -24 + t * 165 + (rand() - 0.5) * 24;
    const by = 166 - t * 146 + (rand() - 0.5) * 26;
    const bz = 52 + t * 66 + (rand() - 0.5) * 24;
    dummy.position.set(bx, by, bz);
    // Consistent dramatic ~38° diagonal architectural tilt matching CQM screenshot!
    dummy.rotation.set(
      0.24 + (rand() - 0.5) * 0.16,
      -0.36 + (rand() - 0.5) * 0.22,
      -0.62 + (rand() - 0.5) * 0.14,
    );
    dummy.scale.set(16 + rand() * 26, 12 + rand() * 22, 16 + rand() * 24);
    dummy.updateMatrix();
    slabsMesh.setMatrixAt(idx, dummy.matrix);
    color.setHex(overhangPalette[i % overhangPalette.length]!);
    slabsMesh.setColorAt(idx, color);
    idx++;
  }

  // 2. Grounded Stepped Crimson-Plum & Midnight-Navy Ziggurat Clusters (prominent bottom-left & bottom-right foreground!)
  const zigguratCenters: ReadonlyArray<[number, number, number]> = [
    [-78, 168, 12],
    [-124, 128, 10],
    [114, 158, 10],
    [-52, 42, 8],
    [88, -45, 8],
    [-185, -82, 8],
  ];
  for (const [cx, cz, steps] of zigguratCenters) {
    const gy = sampleCqmTerrainHeight(cx, cz);
    for (let step = 0; step < steps && idx < totalSlabs; step++) {
      dummy.position.set(
        cx + (rand() - 0.5) * 22,
        gy + 2.2 + step * 2.8,
        cz + (rand() - 0.5) * 18,
      );
      dummy.rotation.set((rand() - 0.5) * 0.1, (rand() - 0.5) * 0.45, (rand() - 0.5) * 0.12);
      dummy.scale.set(14 + rand() * 18 - step * 0.8, 3.8 + rand() * 5.2, 11 + rand() * 16 - step * 0.7);
      dummy.updateMatrix();
      slabsMesh.setMatrixAt(idx, dummy.matrix);
      color.setHex(zigguratPalette[(idx + step) % zigguratPalette.length]!);
      slabsMesh.setColorAt(idx, color);
      idx++;
    }
  }

  // 3. Distant Horizon Floating Brutalist Slabs
  while (idx < totalSlabs) {
    const ang = (idx / totalSlabs) * Math.PI * 2 + rand() * 0.3;
    const rad = 260 + rand() * 180;
    dummy.position.set(Math.cos(ang) * rad, 55 + rand() * 185, Math.sin(ang) * rad - 55);
    dummy.rotation.set((rand() - 0.5) * 0.4, ang + 0.4, (rand() - 0.5) * 0.4);
    dummy.scale.set(14 + rand() * 26, 5 + rand() * 14, 10 + rand() * 18);
    dummy.updateMatrix();
    slabsMesh.setMatrixAt(idx, dummy.matrix);
    color.setHex(overhangPalette[idx % overhangPalette.length]!);
    slabsMesh.setColorAt(idx, color);
    idx++;
  }

  slabsMesh.count = idx;
  slabsMesh.instanceMatrix.needsUpdate = true;
  if (slabsMesh.instanceColor) slabsMesh.instanceColor.needsUpdate = true;
  group.add(slabsMesh);
  return { group, slabsMesh };
}

export function buildFloatingFrustumsAndShafts(seed = 20261110): {
  group: THREE.Group;
  frustumsMesh: THREE.InstancedMesh;
  crystalsMesh: THREE.InstancedMesh;
} {
  const group = new THREE.Group();
  let rng = splitMix32(seed ^ 0xf4057099);
  const rand = () => {
    rng = splitMix32(rng);
    return (rng >>> 8) / 16777216;
  };

  // 1. 24 Floating Bright Emerald-Green & Spectral Tapered Frustums (`Viz3D` signature lampshade cones!)
  const frustumCount = 24;
  const frustumGeo = new THREE.CylinderGeometry(2.2, 4.5, 5.0, 14);
  const frustumMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x059669,
    emissiveIntensity: 0.48,
    roughness: 0.25,
    metalness: 0.15,
  });
  const frustumsMesh = new THREE.InstancedMesh(frustumGeo, frustumMat, frustumCount);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  for (let i = 0; i < frustumCount; i++) {
    const inUpperLeft = i < 12;
    const fx = inUpperLeft ? -185 + rand() * 145 : (rand() - 0.5) * 380;
    const fy = inUpperLeft ? 82 + rand() * 125 : 70 + rand() * 155;
    const fz = inUpperLeft ? -10 + rand() * 145 : -150 + rand() * 260;
    dummy.position.set(fx, fy, fz);
    dummy.rotation.set((rand() - 0.5) * 0.6, rand() * Math.PI * 2, (rand() - 0.5) * 0.6);
    const sc = 0.72 + rand() * 1.15;
    dummy.scale.set(sc, sc * (0.85 + rand() * 0.5), sc);
    dummy.updateMatrix();
    frustumsMesh.setMatrixAt(i, dummy.matrix);

    if (i < 16) {
      col.setHSL(0.39 + (rand() - 0.5) * 0.05, 0.88, 0.48);
    } else {
      col.setHSL((i / frustumCount) % 1, 0.82, 0.56);
    }
    frustumsMesh.setColorAt(i, col);
  }
  frustumsMesh.instanceMatrix.needsUpdate = true;
  if (frustumsMesh.instanceColor) frustumsMesh.instanceColor.needsUpdate = true;
  group.add(frustumsMesh);

  // 2. Translucent Vertical Cyan/Mint Light-Ribbon Pillars (paired left of GodColossus matching CQM screenshot!)
  const shaftGeo = new THREE.BoxGeometry(5.2, 86, 1.0);
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shaftCoords: ReadonlyArray<[number, number, number, number]> = [
    [-46, 134, 72, 1.12],
    [-36, 122, 84, 0.84],
    [-168, 56, 118, 0.92],
    [118, 112, -45, 0.95],
    [-112, 122, -68, 0.88],
    [48, 142, -92, 1.02],
  ];
  for (const [sx, sy, sz, sc] of shaftCoords) {
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(sx, sy, sz);
    shaft.scale.set(sc, sc, 1);
    group.add(shaft);
  }

  // 3. 18 Frosted White/Lavender Crystalline Asteroid Polyhedra Floating in Left/Upper Sky
  const crystalCount = 18;
  const crystalGeo = new THREE.IcosahedronGeometry(4.8, 1);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x64748b,
    emissiveIntensity: 0.28,
    roughness: 0.38,
    metalness: 0.2,
    flatShading: true,
  });
  const crystalsMesh = new THREE.InstancedMesh(crystalGeo, crystalMat, crystalCount);
  for (let i = 0; i < crystalCount; i++) {
    // Keep clear of camera near zone (`z <= 125`) so none look oversized
    dummy.position.set(-210 + rand() * 340, 48 + rand() * 155, -110 + rand() * 225);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(0.65 + rand() * 1.15, 0.55 + rand() * 0.9, 0.65 + rand() * 1.05);
    dummy.updateMatrix();
    crystalsMesh.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.7 + (rand() - 0.5) * 0.14, 0.24, 0.82);
    crystalsMesh.setColorAt(i, col);
  }
  crystalsMesh.instanceMatrix.needsUpdate = true;
  if (crystalsMesh.instanceColor) crystalsMesh.instanceColor.needsUpdate = true;
  group.add(crystalsMesh);

  // 4. 6 Wireframe Bounding Cubes with Bioluminescent Starburst Cores (`crystal-cage` in CQM!)
  const cageGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(16, 16, 16));
  const cageMat = new THREE.LineBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.42 });
  const coreBurstGeo = new THREE.IcosahedronGeometry(4.2, 1);
  const coreBurstMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
  const cageCoords: ReadonlyArray<[number, number, number]> = [
    [-68, 88, 78],
    [18, 124, 38],
    [-132, 112, 24],
    [94, 88, 52],
    [0, 142, -52],
    [-44, 68, 128],
  ];
  for (const [cx, cy, cz] of cageCoords) {
    const cage = new THREE.LineSegments(cageGeo, cageMat);
    cage.position.set(cx, cy, cz);
    const burst = new THREE.Mesh(coreBurstGeo, coreBurstMat);
    burst.position.set(cx, cy, cz);
    group.add(cage, burst);
  }

  return { group, frustumsMesh, crystalsMesh };
}

/**
 * Builds 22 true 3D compound Voxel Glitch-Clusters (`5×5×5` chunky sub-cubes with Tetris/Rubik stepped cutouts
 * and bold per-sub-cube vertex colors: obsidian black, neon lime, magenta, gold, violet, cyan) in 1 single draw call!
 */
export function buildVoxelGlitchSwarm(
  uniforms: { uTime: { value: number } },
  seed = 20261110,
): THREE.InstancedMesh {
  let rng = splitMix32(seed ^ 0x708e1c0b);
  const rand = () => {
    rng = splitMix32(rng);
    return (rng >>> 8) / 16777216;
  };

  const voxelPalette = [
    new THREE.Color(0x070910), // pitch obsidian (dominant CQM glitch block)
    new THREE.Color(0x090c16), // pitch obsidian 2
    new THREE.Color(0x78f527), // neon acid lime
    new THREE.Color(0xe82da2), // hot magenta
    new THREE.Color(0xf5c41b), // cyber gold
    new THREE.Color(0x7c2ae8), // deep violet
    new THREE.Color(0x22d3ee), // cyan accent
    new THREE.Color(0x6b123b), // dark crimson block
  ];

  // Assemble a compound 5x5x5 chunky voxel cluster (~78 distinct 3D sub-cubes with jagged stepped edges)
  const subPieces: Array<{ geo: THREE.BufferGeometry; color: THREE.Color }> = [];
  const step = 2.05;
  const cubeSize = 1.98;
  for (let gx = -2; gx <= 2; gx++) {
    for (let gy = -2; gy <= 2; gy++) {
      for (let gz = -2; gz <= 2; gz++) {
        const manhattan = Math.abs(gx) + Math.abs(gy) + Math.abs(gz);
        // Carve stepped 3D cavities on corners/edges so silhouette is unmistakably blocky 3D voxels!
        const keepProb = manhattan <= 2 ? 0.95 : manhattan <= 4 ? 0.68 : 0.28;
        if (rand() > keepProb) continue;
        const g = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        g.translate(gx * step, gy * step, gz * step);
        const rPick = rand();
        const cIdx =
          rPick < 0.42
            ? Math.floor(rand() * 2)
            : 2 + Math.floor(rand() * (voxelPalette.length - 2));
        subPieces.push({ geo: g, color: voxelPalette[cIdx]! });
      }
    }
  }

  const clusterGeo = mergeSubGeometriesWithColor(subPieces);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VOXEL_GLITCH_VERTEX_SHADER,
    fragmentShader: VOXEL_GLITCH_FRAGMENT_SHADER,
    uniforms,
  });

  const count = 22;
  const mesh = new THREE.InstancedMesh(clusterGeo, mat, count);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // Key foreground & midground placements matching `media_1794383147566_15e228d5.jpg`!
  const heroAnchors: ReadonlyArray<[number, number, number, number]> = [
    [-92, 18, 142, 1.32],  // Left-foreground chunky lime/black/magenta voxel cluster
    [-50, 26, 108, 1.08],  // Center-left mid-air voxel cluster
    [18, 34, 88, 1.15],    // Center-right dark/crimson/cyan voxel cluster behind spire
    [-16, 84, -48, 0.72],  // Small cluster floating in front of GodColossus
    [62, 54, 42, 0.85],    // Right-midground cluster under overhang
    [-142, 46, 64, 1.05],  // Far-left mid-sky cluster
  ];

  for (let i = 0; i < count; i++) {
    if (i < heroAnchors.length) {
      const [hx, hy, hz, hs] = heroAnchors[i]!;
      dummy.position.set(hx, hy, hz);
      dummy.scale.setScalar(hs);
    } else {
      dummy.position.set((rand() - 0.5) * 420, 22 + rand() * 105, -150 + rand() * 265);
      dummy.scale.setScalar(0.55 + rand() * 0.85);
    }
    dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    col.setHSL((i * 0.173) % 1, 0.88, 0.58);
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function buildWovenSanctuaryDomes(seed = 20261110): {
  group: THREE.Group;
  primaryDome: THREE.Group;
  bigTreeGroup: THREE.Group;
} {
  const group = new THREE.Group();

  // 1. Primary Woven 24-Ring Holographic Geodesic Wire-Sphere Sanctuary Dome (lower-center-right hero vortex!)
  const primaryDome = new THREE.Group();
  primaryDome.position.set(24, 14, 124);

  const ringColors = [0x38bdf8, 0x67e8f9, 0xfbbf24, 0xc084fc, 0xf472b6, 0x34d399];
  for (let i = 0; i < 24; i++) {
    const r = 22.5 - (i % 3) * 1.5;
    const pts: THREE.Vector3[] = [];
    const segs = 68;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: ringColors[i % ringColors.length]!,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const ringLine = new THREE.Line(lineGeo, lineMat);
    ringLine.rotation.set((i / 24) * Math.PI * 0.9, (i * 0.618) * Math.PI, (i / 12) * 0.65);
    primaryDome.add(ringLine);
  }

  const shellMesh = new THREE.Mesh(
    new THREE.SphereGeometry(22.8, 24, 18),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  primaryDome.add(shellMesh);
  group.add(primaryDome);

  // 2. Secondary Diorama Wire-Domes scattered across the valley
  const secondaryCoords: ReadonlyArray<[number, number, number, number]> = [
    [-92, 8, 86, 13],
    [118, 12, 58, 15],
    [-48, 14, -42, 17],
    [76, 10, -58, 14],
  ];
  for (const [dx, dy, dz, dr] of secondaryCoords) {
    const wGeo = new THREE.IcosahedronGeometry(dr, 2);
    const wMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wMesh = new THREE.Mesh(wGeo, wMat);
    wMesh.position.set(dx, dy, dz);
    group.add(wMesh);
  }

  // 3. Colossal `CrystalEcosystem` Big Tree Sanctuary at `(242, treeBaseY, -185)` (visited via `✦ LIFE TREE` / `View: tree`)
  const bigTreeGroup = new THREE.Group();
  const treeX = 242;
  const treeZ = -185;
  const treeBaseY = sampleCqmTerrainHeight(treeX, treeZ);
  bigTreeGroup.position.set(treeX, treeBaseY, treeZ);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3b1d6e,
    emissive: 0x6b21a8,
    emissiveIntensity: 0.38,
    metalness: 0.45,
    roughness: 0.3,
  });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 13.5, 128, 12), trunkMat);
  trunk.position.y = 62;
  bigTreeGroup.add(trunk);

  const leafCount = 900;
  const leafGeo = new THREE.OctahedronGeometry(1.9, 0);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x1e1b4b });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let rng = splitMix32(seed ^ 0xca409911);
  const rand = () => {
    rng = splitMix32(rng);
    return (rng >>> 8) / 16777216;
  };
  const canopyPalette = [0xffd700, 0x00d4ff, 0xff2d95, 0xa855f7, 0x10b981, 0xf59e0b];
  for (let i = 0; i < leafCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * rand()) * 0.62;
    const r = 18 + rand() * 52;
    dummy.position.set(
      Math.sin(phi) * Math.cos(theta) * r,
      114 + Math.cos(phi) * r * 0.65,
      Math.sin(phi) * Math.sin(theta) * r,
    );
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.setScalar(0.6 + rand() * 1.15);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    col.setHex(canopyPalette[i % canopyPalette.length]!);
    leaves.setColorAt(i, col);
  }
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  bigTreeGroup.add(leaves);

  const sigil = new THREE.Mesh(
    new THREE.RingGeometry(46, 58, 6),
    new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sigil.rotation.x = Math.PI / 2;
  sigil.position.y = 154;
  bigTreeGroup.add(sigil);

  group.add(bigTreeGroup);
  return { group, primaryDome, bigTreeGroup };
}

export function buildWildAlienFloraInstanced(
  uniforms: {
    uTime: { value: number };
    uWind: { value: number };
    uBrutalFade: { value: number };
  },
  totalCount = 6272,
  seed = 20261110,
): { group: THREE.Group; pools: THREE.InstancedMesh[]; totalInstances: number; chunkCount: number } {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: ALIEN_FLORA_VERTEX_SHADER,
    fragmentShader: ALIEN_FLORA_FRAGMENT_SHADER,
    uniforms,
  });

  // 4 slender, delicate alien botanical families so ~45% of the glowing seabed terrain breathes openly!
  // Family 0: Slender sea-whip stalk with glowing tip bulb
  const stalkStem = new THREE.CylinderGeometry(0.06, 0.22, 5.2, 5);
  stalkStem.translate(0, 2.6, 0);
  const stalkBulb = new THREE.OctahedronGeometry(0.36, 0);
  stalkBulb.translate(0, 5.3, 0);
  const fam0 = mergeSubGeometriesWithColor([{ geo: stalkStem }, { geo: stalkBulb }]);

  // Family 1: Twin-blade sea-grass reed frond
  const bladeA = new THREE.ConeGeometry(0.22, 5.8, 4);
  bladeA.translate(0, 2.9, 0);
  const bladeB = new THREE.ConeGeometry(0.16, 4.4, 4);
  bladeB.rotateZ(0.24);
  bladeB.translate(0.35, 2.1, 0);
  const fam1 = mergeSubGeometriesWithColor([{ geo: bladeA }, { geo: bladeB }]);

  // Family 2: Bioluminescent spore-cap mushroom
  const shroomStem = new THREE.CylinderGeometry(0.10, 0.18, 3.2, 5);
  shroomStem.translate(0, 1.6, 0);
  const shroomCap = new THREE.ConeGeometry(0.85, 1.05, 7);
  shroomCap.translate(0, 3.35, 0);
  const fam2 = mergeSubGeometriesWithColor([{ geo: shroomStem }, { geo: shroomCap }]);

  // Family 3: Faceted translucent crystal coral spire
  const fam3 = new THREE.CylinderGeometry(0.05, 0.34, 4.6, 5);
  fam3.translate(0, 2.3, 0);

  const familyGeos: THREE.BufferGeometry[] = [fam0, fam1, fam2, fam3];
  const perPool = Math.ceil(totalCount / familyGeos.length);
  const pools: THREE.InstancedMesh[] = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  let rng = splitMix32(seed ^ 0xf104a777);
  const rand = () => {
    rng = splitMix32(rng);
    return (rng >>> 8) / 16777216;
  };

  // Generate 49 deterministic grove centers (`7 x 7` organic biome patches matching `wild 6,272 (49 ch)`)
  const groveCenters: Array<[number, number, number]> = [];
  for (let gx = 0; gx < 7; gx++) {
    for (let gz = 0; gz < 7; gz++) {
      const cx = -280 + gx * 93 + (rand() - 0.5) * 42;
      const cz = -220 + gz * 68 + (rand() - 0.5) * 32;
      const baseHue = ((gx * 0.14 + gz * 0.09 + rand() * 0.2) % 1 + 1) % 1;
      groveCenters.push([cx, cz, baseHue]);
    }
  }

  let placed = 0;
  for (let f = 0; f < familyGeos.length; f++) {
    const count = Math.min(perPool, totalCount - placed);
    const inst = new THREE.InstancedMesh(familyGeos[f]!, mat, count);
    for (let i = 0; i < count; i++) {
      const grove = groveCenters[(i + f * 13) % groveCenters.length]!;
      const ang = rand() * Math.PI * 2;
      const rad = Math.pow(rand(), 0.65) * 44;
      const x = grove[0] + Math.cos(ang) * rad;
      const z = Math.min(198, grove[1] + Math.sin(ang) * rad);
      const y = sampleCqmTerrainHeight(x, z);

      dummy.position.set(x, y - 0.2, z);
      dummy.rotation.set((rand() - 0.5) * 0.24, rand() * Math.PI * 2, (rand() - 0.5) * 0.24);
      const sc = 0.62 + rand() * 1.45;
      dummy.scale.set(sc * 0.85, sc * (0.8 + rand() * 0.75), sc * 0.85);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      // Rich jewel-toned bioluminescence (chartreuse-gold, orchid-rose, seafoam-cyan, violet, coral)
      const hue = ((grove[2] + (rand() - 0.5) * 0.22 + f * 0.11) % 1 + 1) % 1;
      col.setHSL(hue, 0.78, 0.52);
      inst.setColorAt(i, col);
      placed++;
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    pools.push(inst);
    group.add(inst);
  }

  return { group, pools, totalInstances: placed, chunkCount: 49 };
}

/**
 * Projects a 6D -> 3D icosahedral Penrose quasicrystal shell via Zig SIMD128 WASM (`cqm2_quasicrystal_icosa_shell`)
 * and renders up to 224 golden-ratio lattice nodes orbiting `GodColossus` in 1 GPU draw call.
 */
export function buildQuasicrystalLatticeShell(): { group: THREE.Group; mesh: THREE.InstancedMesh; nodeCount: number } {
  const group = new THREE.Group();
  group.position.set(-8, 138, -185);

  const pts = getZigBridge().projectQuasicrystalIcosaShell(3, 1.58, 1.35, 3.25, 224);
  const count = Math.max(1, Math.floor(pts.length / 3));

  const geo = new THREE.OctahedronGeometry(2.35, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.72,
    metalness: 0.75,
    roughness: 0.18,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const px = (pts[i * 3] ?? 1) * 44.0;
    const py = (pts[i * 3 + 1] ?? 0) * 44.0;
    const pz = (pts[i * 3 + 2] ?? 0) * 44.0;
    dummy.position.set(px, py, pz);
    dummy.rotation.set(i * 0.37, i * 0.618, i * 0.23);
    dummy.scale.setScalar(0.85 + (i % 5) * 0.16);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    col.setHSL(((i * 0.6180339887) % 1 + 1) % 1, 0.88, 0.64);
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  return { group, mesh, nodeCount: count };
}

/**
 * Builds the 100 Alphabet Pantheon TorusKnot Glyphs (`5` shared `InstancedMesh` pools × `20` instances = 100 glyphs)
 * plus the 101st `APEX ς` Sovereign Obsidian-Gold Monolith hovering above the Sanctuary Valley.
 */
export function buildPantheon101Ring(): {
  group: THREE.Group;
  glyphPools5: THREE.InstancedMesh[];
  apexMonolith: THREE.Group;
} {
  const group = new THREE.Group();
  const knotPairs: ReadonlyArray<[number, number]> = [
    [2, 3],
    [3, 4],
    [3, 5],
    [4, 5],
    [2, 5],
  ];
  const glyphPools5: THREE.InstancedMesh[] = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  for (let p = 0; p < 5; p++) {
    const [kp, kq] = knotPairs[p]!;
    const geo = new THREE.TorusKnotGeometry(1.42, 0.36, 36, 7, kp, kq);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x3b0764,
      emissiveIntensity: 0.68,
      metalness: 0.62,
      roughness: 0.22,
    });
    const inst = new THREE.InstancedMesh(geo, mat, 20);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let j = 0; j < 20; j++) {
      const idx100 = p * 20 + j;
      const ang = (idx100 / 100) * Math.PI * 2;
      const r = 136 + (idx100 % 2) * 16;
      const y = 94 + Math.sin(ang * 3) * 14;
      dummy.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r - 34);
      dummy.rotation.set(ang, idx100 * 0.2, 0);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      inst.setMatrixAt(j, dummy.matrix);
      col.setHSL((idx100 / 100) % 1, 0.9, 0.6);
      inst.setColorAt(j, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    glyphPools5.push(inst);
    group.add(inst);
  }

  // 101st `APEX ς` Obsidian-Gold Sovereign Monolith
  const apexMonolith = new THREE.Group();
  apexMonolith.position.set(24, 56, 124);

  const obelisk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 3.6, 22, 6),
    new THREE.MeshStandardMaterial({
      color: 0x05070d,
      emissive: 0x451a03,
      emissiveIntensity: 0.55,
      metalness: 0.92,
      roughness: 0.14,
    }),
  );
  const crown = new THREE.Mesh(
    new THREE.TorusKnotGeometry(3.1, 0.62, 56, 8, 5, 7),
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.95,
      metalness: 0.88,
      roughness: 0.16,
    }),
  );
  crown.position.y = 14.5;

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(5.6, 6.8, 32),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 14.5;

  apexMonolith.add(obelisk, crown, halo);
  group.add(apexMonolith);

  return { group, glyphPools5, apexMonolith };
}

/**
 * Builds 64 GPU-Instanced 3D Sorting Field Pillars arranged in a semicircle around the Sanctuary Plaza,
 * driven live every frame by `SortingFieldsEngine.getSnapshot().activeBins64`.
 */
export function buildSortingPillars64(): { group: THREE.Group; mesh: THREE.InstancedMesh } {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1.55, 1.0, 1.55);
  geo.translate(0, 0.5, 0); // Anchor pillar base at y = 0 so scaling Y grows upward cleanly
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x0f172a,
    emissiveIntensity: 0.55,
    metalness: 0.55,
    roughness: 0.22,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, 64);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < 64; i++) {
    const frac = i / 63;
    const ang = Math.PI * 0.12 + frac * Math.PI * 0.76;
    const x = 24 + Math.cos(ang) * 44;
    const z = 124 - Math.sin(ang) * 44;
    const gy = sampleCqmTerrainHeight(x, z);
    dummy.position.set(x, gy, z);
    dummy.scale.set(1, 6 + frac * 14, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.5 + frac * 0.38, 0.88, 0.58);
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  return { group, mesh };
}

/**
 * Builds the 64-slot GPU-Instanced `⟁ NHI` Tossed Probe Pool (glowing crystalline octa-probes with equatorial rings).
 */
export function buildNhiTossedProbePool(maxProbes = 64): THREE.InstancedMesh {
  const core = new THREE.OctahedronGeometry(1.65, 1);
  const ring = new THREE.TorusGeometry(2.25, 0.18, 6, 18);
  ring.rotateX(Math.PI / 2);
  const merged = mergeSubGeometriesWithColor([
    { geo: core, color: new THREE.Color(0x67e8f9) },
    { geo: ring, color: new THREE.Color(0xf472b6) },
  ]);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.92,
    metalness: 0.45,
    roughness: 0.18,
  });
  const mesh = new THREE.InstancedMesh(merged, mat, maxProbes);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  return mesh;
}

/**
 * Builds the `◈ STAGE II` (`UwU`) strictly achromatic (`r == g == b`) Level-1 Menger Sponge `Monolith Temple`
 * + 8 sentinel obelisks per `MONOLITH-MEGALITH-ART-DIRECTION.md` (GodColossus is the sole chromatic monolith).
 */
export function buildStageIIMonolithTemple(): THREE.Group {
  const temple = new THREE.Group();
  const baseGround = sampleCqmTerrainHeight(0, 58);
  temple.position.set(0, baseGround - 95, 58);
  temple.visible = false;

  const obsidianMat = new THREE.MeshStandardMaterial({
    color: 0x101010,
    emissive: 0x050505,
    emissiveIntensity: 0.45,
    metalness: 0.90,
    roughness: 0.22,
  });
  const graphiteMat = new THREE.MeshStandardMaterial({
    color: 0x262626,
    emissive: 0x0c0c0c,
    emissiveIntensity: 0.40,
    metalness: 0.84,
    roughness: 0.26,
  });

  // 4-stepped strictly achromatic obsidian plinth (r == g == b)
  for (let s = 0; s < 4; s++) {
    const w = 44 - s * 7.5;
    const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, w), obsidianMat);
    stepMesh.position.y = s * 2.8 + 1.4;
    temple.add(stepMesh);
  }

  // 20-cube Level-1 Menger Sponge Crown (3x3x3 minus 7 center-cross voids, strictly r == g == b)
  const cell = 6.2;
  const mengerGeo = new THREE.BoxGeometry(cell * 0.96, cell * 0.96, cell * 0.96);
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      for (let iz = -1; iz <= 1; iz++) {
        const zeroAxes = (ix === 0 ? 1 : 0) + (iy === 0 ? 1 : 0) + (iz === 0 ? 1 : 0);
        if (zeroAxes >= 2) continue;
        const mCube = new THREE.Mesh(mengerGeo, (ix + iy + iz) % 2 === 0 ? obsidianMat : graphiteMat);
        mCube.position.set(ix * cell, 22.0 + iy * cell, iz * cell);
        temple.add(mCube);
      }
    }
  }

  // 8 perimeter strictly achromatic sentinel obelisks (r == g == b)
  const pillarGeo = new THREE.BoxGeometry(2.1, 24, 2.1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = Math.cos(a) * 21.0;
    const pz = Math.sin(a) * 21.0;
    const pMesh = new THREE.Mesh(pillarGeo, i % 2 === 0 ? obsidianMat : graphiteMat);
    pMesh.position.set(px, 11.2 + 12, pz);
    temple.add(pMesh);
  }

  return temple;
}

/**
 * Builds the 2nd Super Creature (`Seraph-Prime`) unlocked via the `⛓ ACCESS` Roman Tally puzzle (`SUPERHERO` mode).
 */
export function buildSecondSuperCreatureGroup(): THREE.Group {
  const group = new THREE.Group();
  group.visible = false;

  const core = new THREE.Mesh(
    new THREE.TorusKnotGeometry(2.6, 0.58, 64, 10, 3, 7),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.05,
      metalness: 0.82,
      roughness: 0.14,
    }),
  );
  group.add(core);

  const wingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
  });
  for (let w = 0; w < 6; w++) {
    const sign = w % 2 === 0 ? 1 : -1;
    const tier = Math.floor(w / 2);
    const wing = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9.5 - tier * 1.8, 5), wingMat);
    wing.position.set(sign * (4.2 + tier * 2.1), 1.2 - tier * 0.9, -0.8 * tier);
    wing.rotation.z = -sign * (0.95 + tier * 0.22);
    group.add(wing);
  }
  return group;
}
