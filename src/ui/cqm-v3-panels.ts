/**
 * CQM2 v3.0.0 — Original-CQM Complete Inspector Data, Ciphers, Poincaré Disk & 4D Tesseract Renderers
 * (`src/ui/cqm-v3-panels.ts`).
 *
 * Strictly adheres to CSP `style-src 'self'` (zero inline styles) and epistemic honesty (`NOT_SENTIENT`).
 */
import type { CqmWorldSystemId } from '../render/scene-4k';

export const ROMAN_TALLY_CIPHER_KEY = 'IIIIVVVIVVVIVIIVIV';
export const STAGE_II_TEMPLE_CIPHER_KEY = 'uwu';

export const SIM_8_SPEEDS: readonly number[] = [0.25, 0.5, 1, 2, 4, 8, 12, 16];

export const ARCHON_5_SOVEREIGNS: ReadonlyArray<{
  id: string;
  name: string;
  domain: string;
  dialPreset: Record<string, number>;
}> = [
  {
    id: 'archon-kerr',
    name: 'I · KERR-DEMIURGE',
    domain: 'Relativistic Frame-Dragging & Photon-Ring Beaming (a/M = 0.96)',
    dialPreset: { kerrSpinA: 0.96, manifoldWarpGain: 0.34, freeEnergyInfluxKjPerSec: 180 },
  },
  {
    id: 'archon-sophia',
    name: 'II · SOPHIA-PLEROMA',
    domain: 'Bioluminescent Sanctuaryogenesis & Homeostatic O2 Abundance',
    dialPreset: { kerrSpinA: 0.52, oxygenSaturation: 1.35, freeEnergyInfluxKjPerSec: 320, metabolicRateScale: 0.95 },
  },
  {
    id: 'archon-abraxas',
    name: 'III · ABRAXAS-HOGGAR',
    domain: 'Maximal H(2)=63 Pauli Contextuality & Stabilizer Magic M_2',
    dialPreset: { quantumContextualityCoupling: 0.98, plasticityScale: 1.85, manifoldWarpGain: 0.28 },
  },
  {
    id: 'archon-noema',
    name: 'IV · NOEMA-LARKUM',
    domain: 'Apical-Basal Dendritic Coincidence & STC Synaptic Consolidation',
    dialPreset: { plasticityScale: 2.25, metabolicRateScale: 1.25, oxygenSaturation: 1.15 },
  },
  {
    id: 'archon-chronos',
    name: 'V · CHRONOS-ENTROPY',
    domain: 'High-Shear Pelagic Turbulence & Thermophilic Selection',
    dialPreset: { kerrSpinA: 0.89, manifoldWarpGain: 0.42, metabolicRateScale: 1.9, freeEnergyInfluxKjPerSec: 140 },
  },
];

export const PRIME_NEURAL_4_TABS: ReadonlyArray<{
  id: string;
  label: string;
  prefix: string;
  items27: readonly string[];
}> = [
  {
    id: 'cortex',
    label: 'I · CORTICAL LAMINAE (27)',
    prefix: 'CTX',
    items27: [
      'L1 Apical Tuft Ca2+ Plateau',
      'L2/3 Sparse Associative Hex',
      'L4 Thalamic Core Gate',
      'L5a Intratelencephalic Loop',
      'L5b Pyramidal Tract Burst',
      'L6 Corticothalamic Gain',
      'PV+ Fast-Spiking Gamma Basket',
      'SST+ Martinotti Apical Veto',
      'VIP+ Disinhibitory Salience',
      'LAMP5+ Neurogliaform Slow GABA',
      'Claustrum Global Ignition Hub',
      'Entorhinal Hexagonal Grid Module',
      'CA3 Autoassociative Pattern Comp',
      'CA1 Place-Time Theta Precession',
      'Dentate Gyrus Orthogonalizer',
      'Subiculum Boundary Vector Readout',
      'Prefrontal Working-Memory Attractor',
      'Anterior Cingulate Conflict Monitor',
      'Insular Interoceptive Visceral Map',
      'Parietal Allocentric-Egocentric Bridge',
      'Pulvinar Precision Alpha Gate',
      'Thalamic Reticular Spotlight',
      'Superior Colliculus Saccade Map',
      'Periaqueductal Defensive Switch',
      'Cerebellar Granule 16->256 Expander',
      'Purkinje Climbing-Fiber LTD',
      'Deep Cerebellar Nuclei Vor-Phase',
    ],
  },
  {
    id: 'modulators',
    label: 'II · NEUROMODULATORS (27)',
    prefix: 'MOD',
    items27: [
      'DA-VTA Reward Prediction Error',
      'DA-SNc Vigour & Action Threshold',
      'NE-LC Unexpected Uncertainty Reset',
      'ACh-NBM Sensory Expected Precision',
      '5-HT-DRN Patience & Horizon Discount',
      'Orexin-LH Wake Arousal Stabilizer',
      'Histamine-TMN Vigilance Gain',
      'Oxytocin-PVN Kin Sanctuary Trust',
      'Cortisol-HPA Allostatic Load Brake',
      'Leptin-ARC Adipose Satiety Signal',
      'Ghrelin-OxynticForaging Drive',
      'Adenosine-A1 Synaptic Sleep Pressure',
      'BDNF-TrkB Late-LTP Structural Tag',
      'PKMzeta Plasticity Maintenance',
      'Retrograde Endocannabinoid DSI',
      'Nitric Oxide Volume Diffusor',
      'Astrocytic Gliotransmitter D-Serine',
      'NMDA Mg2+ Voltage Unblock Gate',
      'AMPA GluA1 Phospho-Trafficking',
      'GABA-A Shunting Conductance',
      'GABA-B Slow K+ Hyperpolarizer',
      'mGluR5 IP3 Intracellular Wave',
      'L-Type CaV1.2 Transcriptional Switch',
      'HCN1 Ih Dendritic Resonance',
      'KCNQ M-Current Spike Adaptation',
      'SK Ca2+-Activated Afterhyperpol',
      'Nav1.6 Axon Initial Segment Threshold',
    ],
  },
  {
    id: 'motifs',
    label: 'III · CONNECTOME MOTIFS (27)',
    prefix: 'CSR',
    items27: [
      'Dale 80/20 Excitatory-Inhibitory Law',
      'Small-World Watts-Strogatz Shortcut',
      'Rich-Club Hub Core Assortativity',
      'Louvain Modularity Q Partition',
      'PageRank Centrality Eigenmode',
      'Feedforward Inhibition Microcircuit',
      'Feedback Lateral Winner-Take-All',
      'Counterstream Bottom-Up/Top-Down',
      'Canonical Predictive-Coding Column',
      'DeltaNet Fast-Weight Associative Matrix',
      'Liquid Time-Constant sLTC ODE',
      'Oja Normalized Principal Subspace',
      'BCM Sliding Modification Threshold',
      'Triplet STDP Causal Window',
      'Frey-Morris Synaptic Tag & Capture',
      'Sutton-Precup Temporal Option Latch',
      'Frazier Epistemic Value-of-Info Stop',
      'Libet-Filevich Free-Won’t Veto Gate',
      'Lau-Gershman Reality Monitor Ring',
      'Graziano Attention Schema Predictor',
      'Baars Global Workspace Bottleneck',
      'Poincaré {7,3} Quality-Space k-WTA',
      'Jacobi LMS Reafference Canceller',
      'Levenberg-Marquardt Generative Settler',
      'Thaler Noisy-Generator Critic Loop',
      'Kuramoto Phase-Locked Chimera Sync',
      'Enteric Visceral Slow-Wave Pacemaker',
    ],
  },
  {
    id: 'quantum',
    label: 'IV · QUANTUM-SYNAPTIC (27)',
    prefix: 'QGT',
    items27: [
      'Hoggar 3-Qubit H(2)=63 Contextuality',
      'Fubini-Study Quantum Metric g_uv',
      'Berry Curvature Adiabatic Holonomy',
      'QWZ Topological Chern Number C',
      'Stabilizer Rényi Magic M_2 FWHT',
      'Pironio-Toeplitz CHSH Bell QRNG',
      'NIST SP 800-90B RCT+APT Health Gate',
      'Simulated Quantum Transverse Ising',
      'SU(2) Clebsch-Gordan Angular Coupling',
      'Wigner 3j Selection-Rule Tensor',
      'Glossodrom RS[15,11] GF(16) Zooid',
      'Cormidium-16 Extended Parity Check',
      'Hopf Fibration S^3 -> S^2 Fiber',
      '6D -> 3D Icosahedral Quasicrystal',
      'Kerr Mino-Time Carter Constant Q',
      'Relativistic g^4 Photon Ring Beaming',
      'Schwarzschild Strong-Field Deflection',
      'Landau-Lifshitz-Gilbert Spin Precess',
      'Real l<=2 Spherical Harmonics SH9',
      'Eshkol Forward-Mode HyperDual d2f',
      'Vandermonde 5-Point Exact Jet-4',
      'Frenet-Serret 3D Spine Curvature',
      'Gray-Scott Reaction-Diffusion Skin',
      'FitzHugh-Nagumo Excitable Wavefront',
      'RosettaWire RSC1 SHA-256 Frame CID',
      'RosettaWire RSW1 Fail-Closed Latch',
      'First-Law Kahan Metabolic Invariant',
    ],
  },
];

export interface PantheonGlyphDescriptor {
  index: number;
  symbol: string;
  name: string;
  script: string;
  isApex: boolean;
}

export const PANTHEON_101_GLYPHS: readonly PantheonGlyphDescriptor[] = (() => {
  const symbols = [
    // 24 Greek
    'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ',
    'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω',
    // 26 Latin
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    // 22 Hebrew
    'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ',
    'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת',
    // 16 Elder Futhark Runes
    'ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ',
    // 12 Cosmogonic / Mathematical Operators (= 100)
    'ℵ', 'ℶ', 'ℷ', 'ℸ', '∂', '∇', '∮', '⊗', '⊕', '⟁', '◈', '✦',
  ];
  const list: PantheonGlyphDescriptor[] = symbols.slice(0, 100).map((sym, idx) => ({
    index: idx + 1,
    symbol: sym,
    name: `PANTHEON-${String(idx + 1).padStart(3, '0')}`,
    script:
      idx < 24
        ? 'Hellenic'
        : idx < 50
          ? 'Latin'
          : idx < 72
            ? 'Phoenician-Hebrew'
            : idx < 88
              ? 'Elder Futhark'
              : 'Transfinite Operator',
    isApex: false,
  }));
  list.push({
    index: 101,
    symbol: 'ς',
    name: 'APEX-101 · SOVEREIGN STIGMA',
    script: '101st Sovereign Monolith',
    isApex: true,
  });
  return list;
})();

export const PHYLA_10_NAMES: readonly string[] = [
  'Radiolaria-Prime',
  'Ctenophora-Lux',
  'Siphonophora-Zooid',
  'Cephalopoda-Noema',
  'Cnidaria-Xylos',
  'Pyrosoma-Choir',
  'echinoderm- Pentad',
  'Polychaeta-Vent',
  'Bryozoa-Lattice',
  'Xenomimic-Twin',
];

export const SANDBOX_WORLD_SYSTEMS: ReadonlyArray<{ id: CqmWorldSystemId; label: string }> = [
  { id: 'godColossus', label: 'GodColossus Rainbow Manifold' },
  { id: 'quasicrystal', label: '6D→3D Quasicrystal Shell (Zig)' },
  { id: 'spires', label: '16 Obsidian/Emerald Spires' },
  { id: 'brutalist', label: 'Cantilevered Brutalist Slabs' },
  { id: 'frustums', label: 'Floating Frustums & Light Shafts' },
  { id: 'voxels', label: '3D Voxel Glitch-Cluster Swarm' },
  { id: 'sanctuary', label: '24-Ring Geodesic Sanctuary Dome' },
  { id: 'bigTree', label: 'CrystalEcosystem Big Tree' },
  { id: 'flora', label: '6,272 Bioluminescent Alien Flora' },
  { id: 'pantheon101', label: '101 Pantheons + APEX ς Monolith' },
  { id: 'sortingPillars', label: '64 Live 3D Sorting Field Pillars' },
  { id: 'organisms', label: 'Multi-Morph Organism Pools' },
  { id: 'titans', label: '20 Sovereign Sky Titans' },
  { id: 'links', label: 'Connectome Inter-Entity Beams' },
  { id: 'nhiProbes', label: 'Tossed ⟁ NHI Ballistic Probes' },
  { id: 'asmodenius', label: 'Asmodenius v42 8-Somite Hero' },
  { id: 'xylos', label: 'Xylos {7,3} Medusa & Zooid Strand' },
];

export const KEYBOARD_SHORTCUT_MATRIX: ReadonlyArray<{ key: string; action: string; category: string }> = [
  { key: 'W / A / S / D', action: '6-DOF Free-Flight Planar Translation', category: 'Controls' },
  { key: 'Q / E', action: 'Descend / Ascend Vertical Elevation', category: 'Controls' },
  { key: 'Drag / Wheel', action: 'Yaw-Pitch Free-Look & Dolly Zoom', category: 'Controls' },
  { key: 'Space', action: 'Pause / Resume Simulation Epoch', category: 'Simulation' },
  { key: 'Ctrl + K', action: 'Open Universal Command Palette', category: 'Interface' },
  { key: 'Escape', action: 'Close Active Studio / Cipher Dialog', category: 'Interface' },
  { key: 'N', action: 'Toss Physical ⟁ NHI Crystalline Probes', category: 'World' },
  { key: 'X', action: 'Spawn Entangled ◈ XNO Xenomimic Pair', category: 'World' },
  { key: 'V', action: 'Cycle 12 Camera View Modes', category: 'Visual' },
  { key: 'R', action: 'Cycle 10 Organism Render Shaders', category: 'Visual' },
  { key: 'B', action: 'Cycle 6 Architectural Brutalism Modes', category: 'Visual' },
  { key: 'M', action: 'Toggle Procedural 9-Song Cosmic Synth', category: 'Audio' },
];

/**
 * Renders the live `{7,3}` Poincaré Hyperbolic Disk (`||z|| < 1`) with 16 quality-space units,
 * hyperbolic geodesic arcs, and active k-WTA perceptual centroid.
 */
export function renderPoincareDiskCanvas(
  canvas: HTMLCanvasElement | null,
  coords16x2: Float32Array,
  qualityAct16: Float32Array,
  centroid: readonly [number, number],
  bellPhaseRad: number,
): void {
  if (!canvas) return;
  const size = 280;
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cx = size * 0.5;
  const cy = size * 0.5;
  const R = size * 0.44;

  ctx.clearRect(0, 0, size, size);

  // Boundary circle ||z|| = 1 + `{7,3}` heptagonal hyperbolic arcs
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(192, 132, 252, 0.25)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 7; k++) {
    const a1 = (k / 7) * Math.PI * 2 + bellPhaseRad * 0.08;
    const a2 = (((k + 2) % 7) / 7) * Math.PI * 2 + bellPhaseRad * 0.08;
    const x1 = cx + Math.cos(a1) * R;
    const y1 = cy + Math.sin(a1) * R;
    const x2 = cx + Math.cos(a2) * R;
    const y2 = cy + Math.sin(a2) * R;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
  }

  // Draw 16 Quality-Space units on Poincaré disk
  for (let u = 0; u < 16; u++) {
    const px = cx + (coords16x2[u * 2] ?? 0) * R;
    const py = cy + (coords16x2[u * 2 + 1] ?? 0) * R;
    const act = qualityAct16[u] ?? 0;
    const active = act > 0.02;

    if (active) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + centroid[0] * R, cy + centroid[1] * R);
      ctx.lineTo(px, py);
      ctx.stroke();
    }

    ctx.fillStyle = active ? '#22d3ee' : 'rgba(148, 163, 184, 0.45)';
    ctx.beginPath();
    ctx.arc(px, py, active ? 5 + act * 10 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hyperbolic k-WTA perceptual centroid
  const gx = cx + centroid[0] * R;
  const gy = cy + centroid[1] * R;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(gx, gy, 5.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Renders a live `SO(4)` 4D Hypercube (`MEGA 4D` Clifford-torus / tesseract projection) onto a 2D canvas.
 */
export function renderMega4dTesseractCanvas(
  canvas: HTMLCanvasElement | null,
  timeSec: number,
  warpGain: number,
): void {
  if (!canvas) return;
  const w = 480;
  const h = 190;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#040610';
  ctx.fillRect(0, 0, w, h);

  const aXW = timeSec * 0.55;
  const aYZ = timeSec * 0.38 + warpGain * 2.0;
  const cos1 = Math.cos(aXW);
  const sin1 = Math.sin(aXW);
  const cos2 = Math.cos(aYZ);
  const sin2 = Math.sin(aYZ);

  const proj2d: Array<[number, number]> = [];
  for (let v = 0; v < 16; v++) {
    let x = v & 1 ? 1 : -1;
    let y = v & 2 ? 1 : -1;
    let z = v & 4 ? 1 : -1;
    let ww = v & 8 ? 1 : -1;

    const rx = x * cos1 - ww * sin1;
    const rw = x * sin1 + ww * cos1;
    const ry = y * cos2 - z * sin2;
    const rz = y * sin2 + z * cos2;
    x = rx;
    y = ry;
    z = rz;
    ww = rw;

    const persp4 = 1.0 / (2.8 - ww * 0.65);
    const persp3 = 1.0 / (3.2 - z * persp4);
    const sx = w * 0.5 + x * persp4 * persp3 * 220;
    const sy = h * 0.5 + y * persp4 * persp3 * 165;
    proj2d.push([sx, sy]);
  }

  ctx.lineWidth = 1.35;
  for (let i = 0; i < 16; i++) {
    for (let bit = 0; bit < 4; bit++) {
      const j = i ^ (1 << bit);
      if (i < j) {
        ctx.strokeStyle = bit === 3 ? 'rgba(251, 191, 36, 0.72)' : 'rgba(56, 189, 248, 0.62)';
        ctx.beginPath();
        ctx.moveTo(proj2d[i]![0], proj2d[i]![1]);
        ctx.lineTo(proj2d[j]![0], proj2d[j]![1]);
        ctx.stroke();
      }
    }
  }

  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i >= 8 ? '#c084fc' : '#22d3ee';
    ctx.beginPath();
    ctx.arc(proj2d[i]![0], proj2d[i]![1], 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
