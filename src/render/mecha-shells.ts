/**
 * CQM2 v2.1.0 10 Parametric Real-Math Mechalogodrom Shells, Xylos `{7,3}` Hyperbolic Medusa,
 * and Big Tree Crystal Sanctuary (`r = 14`) Geometry Builders (`src/render/mecha-shells.ts`).
 */
import * as THREE from 'three';

export const MECHA_SHELL_NAMES: readonly string[] = [
  '0. Hopf Fibration S3->S2',
  '1. Calabi-Yau Quintic Slice',
  '2. Clifford 4D Flat Torus',
  '3. Boys Roman Immersion',
  '4. Mobius-Klein Non-Orientable Strip',
  '5. Schlafli {7,3} Hyperbolic Disk',
  '6. Hoggar H(2)=63 Symplectic Cage',
  '7. Penrose Ergosphere Surface',
  '8. Fibonacci Phyllotaxis Dome',
  '9. Eshkol-Wachman Frenet Ribbon',
];

function buildParametricSurface(
  uSegs: number,
  vSegs: number,
  evalPoint: (u: number, v: number, target: THREE.Vector3) => void,
): THREE.BufferGeometry {
  const cols = uSegs + 1;
  const rows = vSegs + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const indices: number[] = [];
  const tmp = new THREE.Vector3();

  let pOff = 0;
  let uvOff = 0;
  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs;
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      evalPoint(u, v, tmp);
      positions[pOff++] = Number.isFinite(tmp.x) ? tmp.x : 0;
      positions[pOff++] = Number.isFinite(tmp.y) ? tmp.y : 0;
      positions[pOff++] = Number.isFinite(tmp.z) ? tmp.z : 0;
      uvs[uvOff++] = u;
      uvs[uvOff++] = v;
    }
  }

  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = (iv + 1) * cols + iu;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Constructs all 10 distinct analytical differential-geometric Mechalogodrom shells!
 */
export function buildAll10MechalogodromShells(): THREE.Mesh[] {
  const palette = [
    0x38bdf8, 0xc084fc, 0x34d399, 0xfbbf24, 0x60a5fa,
    0xa78bfa, 0x2dd4bf, 0xf472b6, 0x818cf8, 0x22d3ee,
  ];

  const geos: THREE.BufferGeometry[] = [
    // 0: Hopf Fibration Villarceau linked torus sheet
    buildParametricSurface(48, 16, (u, v, out) => {
      const phi = u * Math.PI * 2;
      const psi = v * Math.PI * 2;
      const eta = 0.62;
      const x4 = Math.cos(eta) * Math.cos(phi);
      const y4 = Math.cos(eta) * Math.sin(phi);
      const z4 = Math.sin(eta) * Math.cos(psi);
      const w4 = Math.sin(eta) * Math.sin(psi);
      const denom = Math.max(0.35, 1.0 - w4 * 0.65);
      out.set((x4 / denom) * 3.2, (y4 / denom) * 3.2, (z4 / denom) * 3.2);
    }),

    // 1: Calabi-Yau quintic 3D cross-section
    buildParametricSurface(44, 18, (u, v, out) => {
      const a = (u - 0.5) * 2.2;
      const b = v * Math.PI * 2;
      const r = 4.6 + 0.85 * Math.cos(5 * b) * Math.exp(-a * a * 0.5);
      out.set(r * Math.cos(b), a * 2.2 + 0.45 * Math.sin(5 * b), r * Math.sin(b));
    }),

    // 2: Stereographic Clifford 4D Flat Torus
    buildParametricSurface(48, 18, (u, v, out) => {
      const th = u * Math.PI * 2;
      const ph = v * Math.PI * 2;
      const s2 = Math.SQRT1_2;
      const denom = Math.max(0.45, 1.35 - s2 * Math.sin(ph));
      out.set(
        (s2 * Math.cos(th) / denom) * 4.8,
        (s2 * Math.cos(ph) / denom) * 4.8,
        (s2 * Math.sin(th) / denom) * 4.8,
      );
    }),

    // 3: Boys / Roman Projective Immersion
    buildParametricSurface(48, 20, (u, v, out) => {
      const th = u * Math.PI;
      const ph = v * Math.PI;
      const s = 6.2;
      out.set(
        s * 0.5 * Math.sin(2 * th) * Math.sin(ph) * Math.sin(ph),
        s * 0.5 * Math.sin(th) * Math.cos(th) * Math.cos(2 * ph),
        s * 0.5 * Math.cos(th) * Math.sin(2 * ph),
      );
    }),

    // 4: Möbius-Klein Half-Twist Non-Orientable Strip
    buildParametricSurface(56, 10, (u, v, out) => {
      const t = u * Math.PI * 2;
      const s = (v - 0.5) * 1.5;
      const R = 7.4;
      const half = t * 0.5;
      out.set(
        (R + s * Math.cos(half)) * Math.cos(t),
        s * Math.sin(half) * 1.4,
        (R + s * Math.cos(half)) * Math.sin(t),
      );
    }),

    // 5: Schläfli {7,3} Hyperbolic Saddle Disk
    buildParametricSurface(56, 14, (u, v, out) => {
      const th = u * Math.PI * 2;
      const r = 5.8 + v * 2.8;
      // Order-7 hyperbolic monkey-saddle undulation
      const z = 0.72 * Math.pow(v, 1.6) * Math.cos(7 * th);
      out.set(r * Math.cos(th), z * 2.0, r * Math.sin(th));
    }),

    // 6: Hoggar H(2)=63 Symplectic Icosahedral-Dodecahedral Cage
    new THREE.IcosahedronGeometry(9.4, 1),

    // 7: Boyer-Lindquist Penrose Ergosphere r_E(theta) = M + sqrt(M^2 - a^2 cos^2 theta)
    buildParametricSurface(48, 20, (u, v, out) => {
      const ph = u * Math.PI * 2;
      const th = v * Math.PI;
      const a = 0.92;
      const rErg = (1.0 + Math.sqrt(Math.max(0.04, 1.0 - a * a * Math.cos(th) * Math.cos(th)))) * 5.3;
      out.set(rErg * Math.sin(th) * Math.cos(ph), rErg * Math.cos(th) * 0.78, rErg * Math.sin(th) * Math.sin(ph));
    }),

    // 8: Golden Fibonacci Phyllotaxis Geodesic Dome
    buildParametricSurface(52, 14, (u, v, out) => {
      const golden = Math.PI * (3.0 - Math.sqrt(5.0));
      const idx = u * 89.0;
      const ang = idx * golden + v * Math.PI * 2;
      const R = 11.4;
      const lat = (v - 0.5) * Math.PI * 0.75;
      const ripple = 1.0 + 0.045 * Math.cos(13 * ang);
      out.set(R * ripple * Math.cos(lat) * Math.cos(ang), R * Math.sin(lat), R * ripple * Math.cos(lat) * Math.sin(ang));
    }),

    // 9: Eshkol-Wachman Frenet Torsion Ribbon
    buildParametricSurface(64, 8, (u, v, out) => {
      const t = u * Math.PI * 2;
      const w = (v - 0.5) * 1.1;
      const R = 12.6;
      const cx = R * Math.cos(t) + 1.2 * Math.cos(3 * t);
      const cy = 1.8 * Math.sin(3 * t);
      const cz = R * Math.sin(t) - 1.2 * Math.sin(3 * t);
      out.set(cx + w * Math.cos(2 * t), cy + w * 0.8, cz + w * Math.sin(2 * t));
    }),
  ];

  return geos.map((geo, idx) => {
    const col = palette[idx % palette.length]!;
    const mat = new THREE.MeshPhysicalMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.22,
      metalness: 0.55,
      roughness: 0.25,
      iridescence: 0.85,
      iridescenceIOR: 1.83,
      wireframe: idx % 2 === 1 || idx === 6,
      transparent: true,
      opacity: idx % 2 === 1 ? 0.42 : 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = MECHA_SHELL_NAMES[idx] ?? `Shell_${idx}`;
    mesh.position.set(0, 7.5, 0);
    return mesh;
  });
}

/**
 * Builds the `Xylos v2` Hyperbolic `{7,3}` Ruffled Medusa Bell + 7 Oral Bioluminescent Tentacles!
 */
export function buildXylosMedusaGroup(): {
  group: THREE.Group;
  tentacles: THREE.Line[];
  tentacleBuffers: Float32Array[];
} {
  const group = new THREE.Group();
  group.name = 'Xylos_v2_Hyperbolic_Medusa';

  const bellGeo = buildParametricSurface(42, 14, (u, v, out) => {
    const th = u * Math.PI * 2;
    const r = Math.sin(v * Math.PI * 0.62) * 1.35 * (1.0 + 0.22 * Math.pow(v, 1.8) * Math.cos(7 * th));
    const y = Math.cos(v * Math.PI * 0.62) * 0.95;
    out.set(r * Math.cos(th), y, r * Math.sin(th));
  });

  const bellMat = new THREE.MeshPhysicalMaterial({
    color: 0xc084fc,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.55,
    roughness: 0.15,
    metalness: 0.15,
    iridescence: 1.0,
    iridescenceIOR: 1.83,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(bellGeo, bellMat));

  const tentacles: THREE.Line[] = [];
  const tentacleBuffers: Float32Array[] = [];
  const tentMat = new THREE.LineBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.85 });

  for (let t = 0; t < 7; t++) {
    const buf = new Float32Array(8 * 3);
    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
    const line = new THREE.Line(tGeo, tentMat);
    group.add(line);
    tentacles.push(line);
    tentacleBuffers.push(buf);
  }

  return { group, tentacles, tentacleBuffers };
}

/**
 * Builds the `Big Tree Crystal Sanctuary` (`r = 14` peace aura ring, helical trunk, crystal canopy, and 6 fruiting pods)!
 */
export function buildBigTreeSanctuaryGroup(): {
  group: THREE.Group;
  pods: THREE.Mesh[];
} {
  const group = new THREE.Group();
  group.name = 'Big_Tree_Crystal_Sanctuary';
  // Positioned at (-18, 0, -18) matching `BIG_TREE_POS` in ecology
  group.position.set(-18, 0, -18);

  const trunkGeo = new THREE.CylinderGeometry(0.65, 1.35, 9.5, 12);
  const trunkMat = new THREE.MeshPhysicalMaterial({
    color: 0x10b981,
    emissive: 0x065f46,
    emissiveIntensity: 0.4,
    roughness: 0.22,
    metalness: 0.35,
    iridescence: 0.9,
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 4.75;
  group.add(trunk);

  const canopyGeo = new THREE.IcosahedronGeometry(4.8, 1);
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x34d399,
    emissive: 0x059669,
    emissiveIntensity: 0.45,
    wireframe: true,
    transparent: true,
    opacity: 0.62,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 10.2;
  group.add(canopy);

  // Peace Sanctuary Ring (r = 14.0)
  const auraGeo = new THREE.RingGeometry(13.6, 14.0, 64);
  auraGeo.rotateX(-Math.PI / 2);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
  });
  const aura = new THREE.Mesh(auraGeo, auraMat);
  aura.position.y = 0.08;
  group.add(aura);

  // 6 Bioluminescent Fruiting Pods
  const pods: THREE.Mesh[] = [];
  const podGeo = new THREE.OctahedronGeometry(0.45, 1);
  const podMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.85,
    roughness: 0.15,
  });
  for (let p = 0; p < 6; p++) {
    const ang = (p / 6) * Math.PI * 2;
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.set(Math.cos(ang) * 3.8, 7.6 + (p % 2) * 0.9, Math.sin(ang) * 3.8);
    group.add(pod);
    pods.push(pod);
  }

  return { group, pods };
}
