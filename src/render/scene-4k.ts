/**
 * CQM2 v2.2.0 — Full-Bleed 4K 60+ FPS Cosmogonic Quantum Mechalogodrom Renderer (`src/render/scene-4k.ts`).
 *
 * Unifies the complete visual world of `Cosmogonic Quantum Mechalogodrom` (`GodColossus` rainbow oil-slick
 * central manifold, cosmic plum coordinate-grid sky dome, undulating bioluminescent terrain, `6,272` GPU-instanced
 * wild alien flora, 16 obsidian/emerald obelisk spires, cantilevered brutalist megastructures, floating emerald
 * frustums, cyan light-shafts, 32 voxel glitch-cubes, woven 22-ring holographic sanctuary dome, `CrystalEcosystem`
 * Big Tree, 10-shell Mechalogodrom zenith core, Kerr singularity, Asmodenius v42, Xylos `{7,3}` medusa, Glitchling,
 * 20 Colossal Titans, multi-morph organism pools, and live connectome link beams) at 4K `60+ FPS`.
 */
import * as THREE from 'three';
import type { ErpRelationalStore } from '../erp/relational-store';
import { getZigBridge } from '../native/zig-bridge';
import { projectZooidStrandS3ToR3 } from '../quantum/xenolinguistics';
import {
  buildBrutalistMegastructures,
  buildFloatingFrustumsAndShafts,
  buildGodColossusGroup,
  buildGroundedObeliskSpires,
  buildNhiTossedProbePool,
  buildPantheon101Ring,
  buildQuasicrystalLatticeShell,
  buildSecondSuperCreatureGroup,
  buildSortingPillars64,
  buildStageIIMonolithTemple,
  buildVoxelGlitchSwarm,
  buildWildAlienFloraInstanced,
  buildWovenSanctuaryDomes,
  sampleCqmTerrainHeight,
} from './cqm-world-builders';
import {
  buildAll10MechalogodromShells,
  buildXylosMedusaGroup,
} from './mecha-shells';
import {
  CHROMATOPHORE_SKIN_FRAGMENT_SHADER,
  CHROMATOPHORE_SKIN_VERTEX_SHADER,
  COSMIC_SKY_DOME_FRAGMENT_SHADER,
  COSMIC_SKY_DOME_VERTEX_SHADER,
  KERR_SINGULARITY_FRAGMENT_SHADER,
  KERR_SINGULARITY_VERTEX_SHADER,
  MANIFOLD_GRID_FRAGMENT_SHADER,
  MANIFOLD_GRID_VERTEX_SHADER,
  TERRAIN_BIOLUM_FRAGMENT_SHADER,
  TERRAIN_BIOLUM_VERTEX_SHADER,
} from './shaders';

// Match CQM's vibrant un-washed linear sRGB neon saturation into ACES Filmic
THREE.ColorManagement.enabled = false;

export type RenderQualityPreset = '4K_ULTRA' | 'HIGH' | 'BALANCED' | 'MOBILE_ECO';
export type CqmHardwareTier = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'ultra' | 'mega';

export const CQM_TIERS: readonly CqmHardwareTier[] = ['phone', 'tablet', 'laptop', 'desktop', 'ultra', 'mega'];

export const CQM_RENDER_MODES = [
  'prismatic',
  'solid',
  'wire',
  'ghost',
  'neon',
  'chrome',
  'hologram',
  'iridescent',
  'plasma',
  'obsidian',
] as const;
export type CqmRenderModeName = (typeof CQM_RENDER_MODES)[number];

export const CQM_VIEW_MODES = [
  'free',
  'orbit',
  'fly',
  'top',
  'follow',
  'chase',
  'titan',
  'specimen',
  'mimic',
  'cinematic',
  'vortex',
  'tree',
] as const;
export type CqmViewModeName = (typeof CQM_VIEW_MODES)[number];

export const CQM_WEATHER_MODES = ['CLEAR', 'RAIN', 'STORM', 'AURORA', 'VOID', 'FOG'] as const;
export type CqmWeatherMode = (typeof CQM_WEATHER_MODES)[number];

export const CQM_SINGULARITY_MODES = ['—', 'ENTROPY', 'BLACK HOLE', 'WHITE HOLE', 'GREY HOLE', 'STRANGE STAR'] as const;
export type CqmSingularityMode = (typeof CQM_SINGULARITY_MODES)[number];

export const CQM_BRUTAL_MODES = [
  'GOD-JEWEL',
  'BRUTALISM',
  'NOUVEAUNESS',
  'ROCOCOGOLOGY',
  'COSMICMORPHISM',
  'REPRESSIONISM',
] as const;
export type CqmBrutalMode = (typeof CQM_BRUTAL_MODES)[number];

export type RenderVisualMode =
  | 'STANDARD_4K'
  | 'WIREFRAME_CAD'
  | 'BIOLUM_NOCTURNE'
  | 'QUANTUM_PHASE'
  | 'METABOLIC_THERMAL'
  | 'CONNECTOME_XRAY'
  | 'KERR_LENSED'
  | 'BRUTAL_MONOCHROME'
  | 'POINCARE_HYPERBOLIC'
  | 'SANCTUARY_BLOOM';

export type CameraPresetId =
  | 'OVERVIEW'
  | 'KERR_HORIZON'
  | 'ASMODENIUS_FOLLOW'
  | 'GLITCHLING_FOLLOW'
  | 'XYLOS_MEDUSA'
  | 'BIG_TREE_SANCTUARY'
  | 'TOP_MANIFOLD'
  | 'SHELL_CORE';

export type CqmWorldSystemId =
  | 'godColossus'
  | 'quasicrystal'
  | 'spires'
  | 'brutalist'
  | 'frustums'
  | 'voxels'
  | 'sanctuary'
  | 'bigTree'
  | 'flora'
  | 'pantheon101'
  | 'sortingPillars'
  | 'organisms'
  | 'titans'
  | 'links'
  | 'nhiProbes'
  | 'asmodenius'
  | 'xylos';

const SPACE_FOVS: readonly number[] = [66, 82, 98, 38, 52];

export class Cqm2Scene4kRenderer {
  private readonly hostOrCanvas: HTMLElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  // Multi-pool GPU-instanced organism meshes (`4` distinct morph pools + `20` Colossal Titans)
  private readonly organismPools: THREE.InstancedMesh[] = [];
  private readonly titanMesh: THREE.InstancedMesh;
  private readonly instanceToEntityId: Int32Array;
  private readonly dummyMatrix = new THREE.Matrix4();
  private readonly dummyPos = new THREE.Vector3();
  private readonly dummyQuat = new THREE.Quaternion();
  private readonly dummyEuler = new THREE.Euler();
  private readonly dummyScale = new THREE.Vector3();
  private readonly dummyColor = new THREE.Color();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();

  // Dynamic Inter-Entity Connectome Link Beams (`links 231+`)
  private readonly linkLineSegments: THREE.LineSegments;
  private readonly linkPositions = new Float32Array(360 * 2 * 3);
  private readonly linkColors = new Float32Array(360 * 2 * 3);
  public activeLinkCount = 231;

  // Sky, Terrain, GodColossus, Flora, Voxel, Kerr & Chromatophore Uniforms
  private readonly skyUniforms = {
    uTime: { value: 0 },
    uChaos: { value: 0.5 },
    uBrutalFade: { value: 0 },
    uNightmare: { value: 0 },
    uAurora: { value: 0 },
  };
  private readonly godColossusUniforms = {
    uTime: { value: 0 },
    uChaos: { value: 0.5 },
    uEntropy: { value: 0.12 },
    uBrutalFade: { value: 0 },
  };
  private readonly terrainUniforms: {
    uRdTex: { value: THREE.DataTexture };
    uTime: { value: number };
    uChaos: { value: number };
    uBrutalFade: { value: number };
  };
  private readonly floraUniforms = {
    uTime: { value: 0 },
    uWind: { value: 1.0 },
    uBrutalFade: { value: 0 },
  };
  private readonly voxelUniforms = { uTime: { value: 0 } };
  private readonly kerrUniforms = {
    uTime: { value: 0 },
    uSpinA: { value: 0.84 },
    uPulseHz: { value: 1.8 },
    uTintHot: { value: new THREE.Vector3(0.55, 0.88, 1.0) },
    uTintWarm: { value: new THREE.Vector3(1.0, 0.58, 0.18) },
  };
  private readonly manifoldUniforms = {
    uWarpGain: { value: 0.22 },
    uTime: { value: 0 },
  };
  private readonly skinUniforms: {
    uSkinField: { value: THREE.DataTexture };
    uTime: { value: number };
    uPulseHz: { value: number };
    uConfidence: { value: number };
  };
  private readonly skinRgba = new Uint8Array(24 * 24 * 4);
  private readonly skinDataTexture: THREE.DataTexture;

  // Major World Groups
  private readonly skyDome: THREE.Mesh;
  private readonly godColossusGroup: THREE.Group;
  private readonly quasicrystalGroup: THREE.Group;
  public readonly quasicrystalNodeCount: number;
  private readonly spiresGroup: THREE.Group;
  private readonly brutalistGroup: THREE.Group;
  private readonly frustumsGroup: THREE.Group;
  private readonly voxelSwarmMesh: THREE.InstancedMesh;
  private readonly sanctuariesGroup: THREE.Group;
  private readonly primarySanctuaryDome: THREE.Group;
  private readonly bigTreeGroup: THREE.Group;
  private readonly floraGroup: THREE.Group;
  private readonly floraPools: THREE.InstancedMesh[];
  public readonly wildFloraTotal: number;
  public readonly wildFloraChunks: number;
  private readonly pantheonGroup: THREE.Group;
  private readonly pantheonGlyphPools5: THREE.InstancedMesh[];
  private readonly apexMonolith: THREE.Group;
  private readonly glyphStates16 = new Float32Array(16 * 1024);
  private readonly glyphLateralW16 = new Float32Array(16 * 4);
  private readonly glyphDrive16 = new Float32Array(16 * 4);
  private readonly glyphEnergy100 = new Float32Array(100);
  private glyphSliceCursor = 0;
  private readonly sortingPillarsGroup: THREE.Group;
  private readonly sortingPillarsMesh: THREE.InstancedMesh;
  private readonly nhiProbeMesh: THREE.InstancedMesh;
  private readonly nhiProbePosVel = new Float32Array(64 * 7); // [x, y, z, vx, vy, vz, age]
  public activeNhiProbeCount = 0;
  private nhiProbeWriteCursor = 0;
  private readonly stageIITempleGroup: THREE.Group;
  public templeUnlocked = false;
  private readonly secondSuperCreature: THREE.Group;
  public superheroUnlocked = false;
  public superheroFlightBoost = false;
  private pulseBeamMesh: THREE.Mesh | null = null;
  private pulseBeamTtl = 0;
  private readonly worldSystemEnabled = new Map<CqmWorldSystemId, boolean>();
  private readonly kerrBillboard: THREE.Mesh;
  private readonly mechShells: THREE.Mesh[];
  private readonly starPoints: THREE.Points;

  // Hero Embodied Beings (`Asmodenius v42`, `Xylos {7,3}`, `Glitchling`)
  private readonly asmoSomites: THREE.Mesh[] = [];
  private readonly connectomeLine: THREE.Line;
  private readonly connectomePositions = new Float32Array(15 * 3);
  private readonly xylosGroup: THREE.Group;
  private readonly xylosTentacles: THREE.Line[];
  private readonly xylosTentacleBuffers: Float32Array[];
  private readonly zooidLine: THREE.Line;
  private readonly zooidPositions = new Float32Array(15 * 3);
  private readonly intendedArrow: THREE.ArrowHelper;
  private readonly executedArrow: THREE.ArrowHelper;
  private customLoadedMesh: THREE.Mesh | null = null;

  // 6-DOF Free-Fly & Multi-View Camera State
  private readonly freeCamPos = new THREE.Vector3(0, 52, 232);
  private freeCamYaw = 0.0;
  private freeCamPitch = 0.052;
  private fovIdx = 0;
  private readonly heldKeys = new Set<string>();
  public touchMoveVec = { x: 0, y: 0 };
  public touchLookDelta = { x: 0, y: 0 };

  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private prevPinchDist = 0;
  private pointerDownPos = { x: 0, y: 0 };

  public contextLost = false;
  public reducedMotion = false;
  public miniWorldActive = false;
  public hardwareTier: CqmHardwareTier = 'desktop';
  public qualityPreset: RenderQualityPreset = 'HIGH';
  public cqmRenderMode: CqmRenderModeName = 'prismatic';
  public viewMode: CqmViewModeName = 'free';
  public weatherMode: CqmWeatherMode = 'CLEAR';
  public singularityMode: CqmSingularityMode = '—';
  public brutalMode: CqmBrutalMode = 'GOD-JEWEL';
  public simulationStage: 1 | 2 = 1;
  public visualMode: RenderVisualMode = 'STANDARD_4K';
  public onSelectEntity: ((entityId: number) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  public constructor(hostOrCanvas: HTMLElement, maxInstances = 2048) {
    this.hostOrCanvas = hostOrCanvas;
    this.instanceToEntityId = new Int32Array(maxInstances).fill(-1);
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x13031e);
    this.scene.fog = new THREE.FogExp2(0x160424, 0.00085);

    const w = Math.max(320, (typeof window !== 'undefined' ? window.innerWidth : 0) || hostOrCanvas.clientWidth || 1280);
    const h = Math.max(240, (typeof window !== 'undefined' ? window.innerHeight : 0) || hostOrCanvas.clientHeight || 720);
    this.camera = new THREE.PerspectiveCamera(SPACE_FOVS[0]!, w / h, 0.3, 4200);
    this.applyFreeCameraOrientation();

    // Crisp Architectural + Cosmic Key Lighting (0 PointLight loops across 8.3M 4K pixels -> 60+ FPS!)
    const ambient = new THREE.AmbientLight(0x281946, 1.45);
    this.scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0x4b89c8, 0x16324c, 1.38);
    this.scene.add(hemi);
    const sunKey = new THREE.DirectionalLight(0xfff0dd, 2.05);
    sunKey.position.set(-105, 185, 195);
    this.scene.add(sunKey);
    const cyanFill = new THREE.DirectionalLight(0x38bdf8, 0.92);
    cyanFill.position.set(125, 48, 220);
    this.scene.add(cyanFill);

    // Shared 24x24 Gray-Scott Reaction-Diffusion Texture
    for (let i = 0; i < 24 * 24; i++) {
      this.skinRgba[i * 4] = 195;
      this.skinRgba[i * 4 + 1] = 88;
      this.skinRgba[i * 4 + 2] = 210;
      this.skinRgba[i * 4 + 3] = 255;
    }
    this.skinDataTexture = new THREE.DataTexture(this.skinRgba, 24, 24, THREE.RGBAFormat);
    this.skinDataTexture.wrapS = THREE.RepeatWrapping;
    this.skinDataTexture.wrapT = THREE.RepeatWrapping;
    this.skinDataTexture.magFilter = THREE.LinearFilter;
    this.skinDataTexture.minFilter = THREE.LinearFilter;
    this.skinDataTexture.needsUpdate = true;

    // 1. Inverted Cosmic Violet-Plum Coordinate-Grid Sky Dome + Starfield
    const skyGeo = new THREE.SphereGeometry(2400, 40, 28);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: COSMIC_SKY_DOME_VERTEX_SHADER,
      fragmentShader: COSMIC_SKY_DOME_FRAGMENT_SHADER,
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    const starCount = 2600;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    const cTmp = new THREE.Color();
    for (let i = 0; i < starCount; i++) {
      const u = (i * 0.6180339887) % 1;
      const v = ((i + 0.5) / starCount);
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - 2 * v);
      const r = 950 + (i % 7) * 140;
      starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      starPos[i * 3 + 1] = Math.abs(Math.cos(phi) * r) + 35;
      starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      cTmp.setHSL(0.55 + (i % 11) * 0.03, 0.72, 0.72);
      starCol[i * 3] = cTmp.r;
      starCol[i * 3 + 1] = cTmp.g;
      starCol[i * 3 + 2] = cTmp.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    this.starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0.78, fog: false }),
    );
    this.scene.add(this.starPoints);

    // 2. Undulating Bioluminescent Terrain + Subtle Coordinate Manifold Grid
    this.terrainUniforms = {
      uRdTex: { value: this.skinDataTexture },
      uTime: { value: 0 },
      uChaos: { value: 0.5 },
      uBrutalFade: { value: 0 },
    };
    const terrainGeo = new THREE.PlaneGeometry(1600, 1600, 160, 160);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_BIOLUM_VERTEX_SHADER,
      fragmentShader: TERRAIN_BIOLUM_FRAGMENT_SHADER,
      uniforms: this.terrainUniforms,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.position.y = -14.0;
    this.scene.add(terrainMesh);

    const gridGeo = new THREE.PlaneGeometry(1200, 1200, 72, 72);
    gridGeo.rotateX(-Math.PI / 2);
    const gridMesh = new THREE.Mesh(
      gridGeo,
      new THREE.ShaderMaterial({
        vertexShader: MANIFOLD_GRID_VERTEX_SHADER,
        fragmentShader: MANIFOLD_GRID_FRAGMENT_SHADER,
        uniforms: this.manifoldUniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    gridMesh.position.y = 148; // Overhead violet/cyan celestial coordinate plane!
    this.scene.add(gridMesh);

    // 3. Towering Rainbow Oil-Slick Prismatic `GodColossus` + 6D->3D Quasicrystal Lattice Shell in Center Sky!
    this.godColossusGroup = buildGodColossusGroup(this.godColossusUniforms);
    this.scene.add(this.godColossusGroup);

    const quasi = buildQuasicrystalLatticeShell();
    this.quasicrystalGroup = quasi.group;
    this.quasicrystalNodeCount = quasi.nodeCount;
    this.scene.add(this.quasicrystalGroup);

    // 4. 16 Obsidian/Emerald Monolith Spires + Cantilevered Brutalist Megastructures + Frustums + Voxel Glitch-Cubes
    this.spiresGroup = buildGroundedObeliskSpires();
    this.brutalistGroup = buildBrutalistMegastructures().group;
    this.frustumsGroup = buildFloatingFrustumsAndShafts().group;
    this.voxelSwarmMesh = buildVoxelGlitchSwarm(this.voxelUniforms);
    this.scene.add(this.spiresGroup, this.brutalistGroup, this.frustumsGroup, this.voxelSwarmMesh);

    // 5. Woven 22-Ring Holographic Wire-Sphere Sanctuary Dome + Colossal `CrystalEcosystem` Big Tree
    const sanctuaries = buildWovenSanctuaryDomes();
    this.sanctuariesGroup = sanctuaries.group;
    this.primarySanctuaryDome = sanctuaries.primaryDome;
    this.bigTreeGroup = sanctuaries.bigTreeGroup;
    this.scene.add(this.sanctuariesGroup);

    // 6. `6,272` GPU-Instanced Bioluminescent Wild Alien Flora (`4` draw calls, `0` CPU per-frame loop!)
    const flora = buildWildAlienFloraInstanced(this.floraUniforms, 6272);
    this.floraGroup = flora.group;
    this.floraPools = flora.pools;
    this.wildFloraTotal = flora.totalInstances;
    this.wildFloraChunks = flora.chunkCount;
    this.scene.add(this.floraGroup);

    // 6b. 100 Alphabet Pantheon Glyphs + 101st `APEX ς` Monolith + 64 Sorting Field Pillars + `⟁ NHI` Probe Pool + Temple + Seraph-Prime
    const pantheon101 = buildPantheon101Ring();
    this.pantheonGroup = pantheon101.group;
    this.pantheonGlyphPools5 = pantheon101.glyphPools5;
    this.apexMonolith = pantheon101.apexMonolith;
    this.scene.add(this.pantheonGroup);
    for (let i = 0; i < this.glyphLateralW16.length; i++) {
      this.glyphLateralW16[i] = (i % 4 === 0 ? 0.32 : -0.14);
      this.glyphDrive16[i] = Math.sin(i * 0.73) * 0.45;
    }
    this.glyphEnergy100.fill(0.5);

    const sortingPillars = buildSortingPillars64();
    this.sortingPillarsGroup = sortingPillars.group;
    this.sortingPillarsMesh = sortingPillars.mesh;
    this.scene.add(this.sortingPillarsGroup);

    this.nhiProbeMesh = buildNhiTossedProbePool(64);
    this.scene.add(this.nhiProbeMesh);

    this.stageIITempleGroup = buildStageIIMonolithTemple();
    this.scene.add(this.stageIITempleGroup);

    this.secondSuperCreature = buildSecondSuperCreatureGroup();
    this.scene.add(this.secondSuperCreature);

    // 7. Summonable Kerr / Cosmological Singularity Billboard + High-Zenith 10-Shell Mechalogodrom Core
    const kerrMat = new THREE.ShaderMaterial({
      vertexShader: KERR_SINGULARITY_VERTEX_SHADER,
      fragmentShader: KERR_SINGULARITY_FRAGMENT_SHADER,
      uniforms: this.kerrUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.kerrBillboard = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), kerrMat);
    this.kerrBillboard.position.set(-48, 84, -36);
    this.kerrBillboard.visible = false; // Summoned on `⚫` Singularity cycle or KERR_HORIZON preset
    this.scene.add(this.kerrBillboard);

    this.mechShells = buildAll10MechalogodromShells();
    for (const sh of this.mechShells) {
      sh.position.set(0, 148, -95);
      sh.scale.setScalar(2.8);
      sh.visible = false; // Summoned in Stage II (`✦ STAGE II`) or `vortex` / `SHELL_CORE` so GodColossus is unobstructed!
      this.scene.add(sh);
    }

    // 8. 4 Multi-Morph GPU-Instanced Organism Pools + 20 Colossal Titans (fast MeshStandardMaterial for 4K 60+ FPS!)
    const poolGeos: THREE.BufferGeometry[] = [
      new THREE.IcosahedronGeometry(1.05, 1),
      new THREE.TorusKnotGeometry(0.72, 0.24, 28, 6, 2, 3),
      new THREE.OctahedronGeometry(1.12, 0),
      new THREE.CylinderGeometry(0.32, 0.98, 2.1, 7),
    ];
    const perPoolMax = Math.ceil(maxInstances / poolGeos.length);
    for (const geo of poolGeos) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x221133,
        emissiveIntensity: 0.58,
        metalness: 0.36,
        roughness: 0.24,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, perPoolMax);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      this.organismPools.push(mesh);
      this.scene.add(mesh);
    }

    const titanGeo = new THREE.TorusKnotGeometry(2.6, 0.78, 42, 8, 3, 5);
    const titanMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.65,
      metalness: 0.6,
      roughness: 0.22,
    });
    this.titanMesh = new THREE.InstancedMesh(titanGeo, titanMat, 20);
    this.titanMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.titanMesh);

    // Dynamic Inter-Entity Connectome Link Beams
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.BufferAttribute(this.linkPositions, 3));
    linkGeo.setAttribute('color', new THREE.BufferAttribute(this.linkColors, 3));
    this.linkLineSegments = new THREE.LineSegments(
      linkGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    // Tether-Removal Law: inter-entity connectome laser tethers are hidden in normal dome sightlines (enabled only in X-Ray / explicit Sandbox toggle)
    this.linkLineSegments.visible = false;
    this.worldSystemEnabled.set('links', false);
    this.scene.add(this.linkLineSegments);

    // 9. Hero Embodied Beings: Asmodenius v42 8-Somite Spine + Xylos `{7,3}` Medusa + Glitchling Vectors
    this.skinUniforms = {
      uSkinField: { value: this.skinDataTexture },
      uTime: { value: 0 },
      uPulseHz: { value: 1.4 },
      uConfidence: { value: 0.68 },
    };
    const asmoMat = new THREE.ShaderMaterial({
      vertexShader: CHROMATOPHORE_SKIN_VERTEX_SHADER,
      fragmentShader: CHROMATOPHORE_SKIN_FRAGMENT_SHADER,
      uniforms: this.skinUniforms,
    });
    for (let i = 0; i < 8; i++) {
      const r = (0.48 * Math.sin(Math.max(0.15, (i + 0.6) / 8.2) * Math.PI) + 0.14) * 4.2;
      const somite = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), asmoMat);
      this.scene.add(somite);
      this.asmoSomites.push(somite);
    }

    const connGeo = new THREE.BufferGeometry();
    connGeo.setAttribute('position', new THREE.BufferAttribute(this.connectomePositions, 3));
    this.connectomeLine = new THREE.Line(
      connGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }),
    );
    this.scene.add(this.connectomeLine);

    const xylos = buildXylosMedusaGroup();
    this.xylosGroup = xylos.group;
    this.xylosTentacles = xylos.tentacles;
    this.xylosTentacleBuffers = xylos.tentacleBuffers;
    this.xylosGroup.position.set(-42, 26, 138);
    this.xylosGroup.scale.setScalar(3.5);
    this.scene.add(this.xylosGroup);

    const zooidGeo = new THREE.BufferGeometry();
    zooidGeo.setAttribute('position', new THREE.BufferAttribute(this.zooidPositions, 3));
    this.zooidLine = new THREE.Line(
      zooidGeo,
      new THREE.LineBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.88 }),
    );
    this.zooidLine.position.set(28, 22, 128);
    this.zooidLine.scale.setScalar(6.5);
    this.scene.add(this.zooidLine);

    this.intendedArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-18, 8, 152),
      9.5,
      0x38bdf8,
      2.2,
      1.2,
    );
    this.executedArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-18, 8, 152),
      9.5,
      0xfbbf24,
      2.2,
      1.2,
    );
    this.scene.add(this.intendedArrow, this.executedArrow);

    this.initWebGlRenderer();
    this.bindCameraAndSelectionInput();
    this.applyCqmRenderMode('prismatic');
  }

  private initWebGlRenderer(): void {
    if (typeof document === 'undefined') return;
    try {
      const existingCanvas = this.hostOrCanvas instanceof HTMLCanvasElement ? this.hostOrCanvas : null;
      const hiDpi = typeof window !== 'undefined' && (window.devicePixelRatio || 1) >= 1.75;
      const renderer = new THREE.WebGLRenderer({
        canvas: existingCanvas ?? undefined,
        antialias: !hiDpi,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
      });
      this.renderer = renderer;
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.88;

      if (!existingCanvas) {
        renderer.domElement.setAttribute('aria-label', 'CQM2 4K Interactive Cosmos Viewport');
        renderer.domElement.tabIndex = 0;
        this.hostOrCanvas.innerHTML = '';
        this.hostOrCanvas.appendChild(renderer.domElement);
      }

      const defaultTier: CqmHardwareTier =
        window.innerWidth >= 2560
          ? 'ultra'
          : window.innerWidth >= 1440
            ? 'desktop'
            : window.innerWidth >= 1024
              ? 'laptop'
              : window.innerWidth >= 680
                ? 'tablet'
                : 'phone';
      this.applyHardwareTier(defaultTier);

      renderer.domElement.addEventListener('webglcontextlost', (ev) => {
        ev.preventDefault();
        this.contextLost = true;
      });
      renderer.domElement.addEventListener('webglcontextrestored', () => {
        this.contextLost = false;
      });

      if (typeof ResizeObserver !== 'undefined') {
        const target = existingCanvas ? document.documentElement : this.hostOrCanvas;
        this.resizeObserver = new ResizeObserver(() => {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => this.resize());
          } else {
            this.resize();
          }
        });
        this.resizeObserver.observe(target);
      }
      window.addEventListener('resize', () => this.resize());
      this.resize();
    } catch {
      this.renderer = null;
    }
  }

  public applyHardwareTier(tier: CqmHardwareTier): void {
    this.hardwareTier = tier;
    if (tier === 'mega' || tier === 'ultra') this.qualityPreset = '4K_ULTRA';
    else if (tier === 'desktop') this.qualityPreset = 'HIGH';
    else if (tier === 'laptop' || tier === 'tablet') this.qualityPreset = 'BALANCED';
    else this.qualityPreset = 'MOBILE_ECO';

    if (!this.renderer || typeof window === 'undefined') return;
    const dpr = window.devicePixelRatio || 1;
    const cap =
      tier === 'mega'
        ? Math.min(dpr, 2.5)
        : tier === 'ultra'
          ? Math.min(dpr, 2.0)
          : tier === 'desktop'
            ? Math.min(dpr, 1.5)
            : tier === 'laptop'
              ? Math.min(dpr, 1.35)
              : tier === 'tablet'
                ? Math.min(dpr, 1.2)
                : Math.min(dpr, 1.0);
    this.renderer.setPixelRatio(cap);

    // Scale active flora draw count cleanly per tier (zero re-allocation!)
    const floraRatio =
      tier === 'phone' ? 0.45 : tier === 'tablet' ? 0.65 : tier === 'laptop' ? 0.85 : 1.0;
    for (const pool of this.floraPools) {
      pool.count = Math.max(64, Math.floor((this.wildFloraTotal / this.floraPools.length) * floraRatio));
    }
    this.resize();
  }

  public applyQualityPreset(preset: RenderQualityPreset): void {
    this.qualityPreset = preset;
    const mapped: CqmHardwareTier =
      preset === '4K_ULTRA'
        ? 'ultra'
        : preset === 'HIGH'
          ? 'desktop'
          : preset === 'MOBILE_ECO'
            ? 'phone'
            : 'laptop';
    this.applyHardwareTier(mapped);
  }

  public applyCqmRenderMode(mode: CqmRenderModeName): void {
    this.cqmRenderMode = mode;
    for (const pool of this.organismPools) {
      const m = pool.material as THREE.MeshStandardMaterial;
      m.wireframe = mode === 'wire' || mode === 'hologram';
      m.transparent = mode === 'ghost' || mode === 'hologram';
      m.opacity = mode === 'ghost' ? 0.34 : mode === 'hologram' ? 0.58 : 1.0;
      m.metalness = mode === 'chrome' ? 0.94 : mode === 'obsidian' ? 0.86 : mode === 'iridescent' ? 0.78 : 0.36;
      m.roughness = mode === 'chrome' ? 0.08 : mode === 'obsidian' ? 0.14 : 0.24;
      m.emissiveIntensity =
        mode === 'neon' || mode === 'plasma'
          ? 1.9
          : mode === 'prismatic' || mode === 'iridescent'
            ? 0.72
            : mode === 'obsidian'
              ? 0.2
              : 0.52;
      m.needsUpdate = true;
    }
  }

  public cycleRenderMode(): CqmRenderModeName {
    const idx = CQM_RENDER_MODES.indexOf(this.cqmRenderMode);
    const next = CQM_RENDER_MODES[(idx + 1) % CQM_RENDER_MODES.length]!;
    this.applyCqmRenderMode(next);
    return next;
  }

  public cycleViewMode(): CqmViewModeName {
    const idx = CQM_VIEW_MODES.indexOf(this.viewMode);
    this.viewMode = CQM_VIEW_MODES[(idx + 1) % CQM_VIEW_MODES.length]!;
    const showShells = this.simulationStage === 2 || this.viewMode === 'vortex';
    for (const sh of this.mechShells) sh.visible = showShells;
    return this.viewMode;
  }

  public cycleSpaceFov(): number {
    this.fovIdx = (this.fovIdx + 1) % SPACE_FOVS.length;
    this.camera.fov = SPACE_FOVS[this.fovIdx]!;
    this.camera.updateProjectionMatrix();
    return this.camera.fov;
  }

  public cycleWeather(): CqmWeatherMode {
    const idx = CQM_WEATHER_MODES.indexOf(this.weatherMode);
    this.weatherMode = CQM_WEATHER_MODES[(idx + 1) % CQM_WEATHER_MODES.length]!;
    this.skyUniforms.uAurora.value = this.weatherMode === 'AURORA' ? 1.0 : 0.0;
    const fog = this.scene.fog as THREE.FogExp2;
    if (this.weatherMode === 'FOG') fog.density = 0.0022;
    else if (this.weatherMode === 'VOID') fog.density = 0.0014;
    else fog.density = 0.00085;
    return this.weatherMode;
  }

  public cycleSingularity(): CqmSingularityMode {
    const idx = CQM_SINGULARITY_MODES.indexOf(this.singularityMode);
    this.singularityMode = CQM_SINGULARITY_MODES[(idx + 1) % CQM_SINGULARITY_MODES.length]!;
    this.kerrBillboard.visible = this.singularityMode !== '—';
    if (this.singularityMode === 'WHITE HOLE') {
      this.kerrUniforms.uTintHot.value.set(0.88, 0.96, 1.0);
      this.kerrUniforms.uTintWarm.value.set(0.25, 0.58, 1.0);
    } else if (this.singularityMode === 'STRANGE STAR') {
      this.kerrUniforms.uTintHot.value.set(0.55, 1.0, 0.45);
      this.kerrUniforms.uTintWarm.value.set(0.75, 0.22, 1.0);
    } else if (this.singularityMode === 'GREY HOLE') {
      this.kerrUniforms.uTintHot.value.set(0.82, 0.85, 0.92);
      this.kerrUniforms.uTintWarm.value.set(0.38, 0.42, 0.50);
    } else {
      this.kerrUniforms.uTintHot.value.set(0.55, 0.88, 1.0);
      this.kerrUniforms.uTintWarm.value.set(1.0, 0.58, 0.18);
    }
    return this.singularityMode;
  }

  public cycleBrutalistStyle(): CqmBrutalMode {
    const idx = CQM_BRUTAL_MODES.indexOf(this.brutalMode);
    this.brutalMode = CQM_BRUTAL_MODES[(idx + 1) % CQM_BRUTAL_MODES.length]!;
    const bf = this.brutalMode === 'BRUTALISM' ? 0.92 : this.brutalMode === 'REPRESSIONISM' ? 0.65 : 0.0;
    this.skyUniforms.uBrutalFade.value = bf;
    this.godColossusUniforms.uBrutalFade.value = bf;
    this.terrainUniforms.uBrutalFade.value = bf;
    this.floraUniforms.uBrutalFade.value = bf;
    return this.brutalMode;
  }

  public toggleSimulationStage(): 1 | 2 {
    this.simulationStage = this.simulationStage === 1 ? 2 : 1;
    this.skyUniforms.uNightmare.value = this.simulationStage === 2 ? 1.0 : 0.0;
    const showShells = this.simulationStage === 2 || this.viewMode === 'vortex';
    for (const sh of this.mechShells) sh.visible = showShells;
    return this.simulationStage;
  }

  public toggleMiniWorld(force?: boolean): boolean {
    this.miniWorldActive = force ?? !this.miniWorldActive;
    this.viewMode = 'free';
    if (this.miniWorldActive) {
      this.freeCamPos.set(12, 22, 168);
      this.freeCamYaw = -0.18;
      this.freeCamPitch = 0.08;
      this.applyHardwareTier('mega');
    } else {
      this.freeCamPos.set(0, 52, 232);
      this.freeCamYaw = 0.0;
      this.freeCamPitch = 0.052;
    }
    this.applyFreeCameraOrientation();
    return this.miniWorldActive;
  }

  public flyToLandmark(target: 'god' | 'xenomimic' | 'lifetree' | 'boot'): void {
    this.viewMode = 'free';
    if (target === 'god') {
      this.freeCamPos.set(-8, 132, 18);
      this.freeCamYaw = 0;
      this.freeCamPitch = 0.08;
    } else if (target === 'xenomimic') {
      this.freeCamPos.set(-22, 16, 178);
      this.freeCamYaw = 0.18;
      this.freeCamPitch = -0.08;
    } else if (target === 'lifetree') {
      this.freeCamPos.set(148, 68, -42);
      this.freeCamYaw = -0.56;
      this.freeCamPitch = 0.1;
    } else {
      this.freeCamPos.set(0, 52, 232);
      this.freeCamYaw = 0.0;
      this.freeCamPitch = 0.052;
    }
    this.applyFreeCameraOrientation();
  }

  public applyVisualMode(mode: RenderVisualMode): void {
    this.visualMode = mode;
    if (mode === 'WIREFRAME_CAD' || mode === 'CONNECTOME_XRAY') this.applyCqmRenderMode('wire');
    else if (mode === 'BRUTAL_MONOCHROME') this.applyCqmRenderMode('obsidian');
    else if (mode === 'QUANTUM_PHASE') this.applyCqmRenderMode('neon');
    else this.applyCqmRenderMode('prismatic');
  }

  public applyCameraPreset(preset: CameraPresetId): void {
    if (preset === 'OVERVIEW') this.flyToLandmark('boot');
    else if (preset === 'BIG_TREE_SANCTUARY') this.flyToLandmark('lifetree');
    else if (preset === 'KERR_HORIZON') {
      this.kerrBillboard.visible = true;
      this.singularityMode = 'BLACK HOLE';
      this.freeCamPos.set(-48, 84, 28);
      this.freeCamYaw = 0;
      this.freeCamPitch = 0;
      this.applyFreeCameraOrientation();
    } else if (preset === 'SHELL_CORE') {
      for (const sh of this.mechShells) sh.visible = true;
      this.viewMode = 'vortex';
    } else if (preset === 'TOP_MANIFOLD') {
      this.viewMode = 'top';
    } else {
      this.viewMode = 'orbit';
    }
  }

  public loadCustomGlbBytes(glbBytes: Uint8Array): boolean {
    if (glbBytes.byteLength < 28) return false;
    const view = new DataView(glbBytes.buffer, glbBytes.byteOffset, glbBytes.byteLength);
    if (view.getUint32(0, true) !== 0x46546c67) return false;
    const jsonLen = view.getUint32(12, true);
    if (20 + jsonLen > glbBytes.byteLength) return false;

    try {
      const jsonStr = new TextDecoder().decode(glbBytes.subarray(20, 20 + jsonLen)).trim();
      const gltf = JSON.parse(jsonStr) as {
        accessors?: Array<{ count: number }>;
        bufferViews?: Array<{ byteOffset: number; byteLength: number }>;
      };
      const binChunkStart = 20 + jsonLen + 8;
      if (!gltf.bufferViews || gltf.bufferViews.length < 3 || binChunkStart >= glbBytes.byteLength) return false;

      const posView = gltf.bufferViews[0]!;
      const normView = gltf.bufferViews[1]!;
      const idxView = gltf.bufferViews[2]!;
      const idxCount = gltf.accessors?.[2]?.count ?? idxView.byteLength / 2;

      const posArr = new Float32Array(
        glbBytes.slice(binChunkStart + posView.byteOffset, binChunkStart + posView.byteOffset + posView.byteLength).buffer,
      );
      const normArr = new Float32Array(
        glbBytes.slice(binChunkStart + normView.byteOffset, binChunkStart + normView.byteOffset + normView.byteLength).buffer,
      );
      const idxArr = new Uint16Array(
        glbBytes.slice(binChunkStart + idxView.byteOffset, binChunkStart + idxView.byteOffset + idxView.byteLength).buffer,
      ).subarray(0, idxCount);

      const customGeo = new THREE.BufferGeometry();
      customGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      customGeo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
      customGeo.setIndex(new THREE.BufferAttribute(idxArr, 1));

      if (this.customLoadedMesh) {
        this.scene.remove(this.customLoadedMesh);
        this.customLoadedMesh.geometry.dispose();
      }
      this.customLoadedMesh = new THREE.Mesh(
        customGeo,
        new THREE.MeshPhysicalMaterial({ color: 0x34d399, metalness: 0.35, roughness: 0.2, iridescence: 0.9 }),
      );
      this.customLoadedMesh.position.set(0, 28, 152);
      this.customLoadedMesh.scale.setScalar(4.5);
      this.scene.add(this.customLoadedMesh);
      return true;
    } catch {
      return false;
    }
  }

  public getCameraXz(): { x: number; z: number } {
    return { x: this.camera.position.x, z: this.camera.position.z };
  }

  /**
   * Launches physical `⟁ NHI` bioluminescent crystalline probes outward from the camera's forward look vector
   * with ballistic gravity and seabed terrain restitution (`tossNhiEntities` matching Original CQM's NHI button!).
   */
  public tossNhiEntities(count = 4): number {
    const fwdX = -Math.sin(this.freeCamYaw) * Math.cos(this.freeCamPitch);
    const fwdY = Math.sin(this.freeCamPitch);
    const fwdZ = -Math.cos(this.freeCamYaw) * Math.cos(this.freeCamPitch);
    const rightX = Math.cos(this.freeCamYaw);
    const rightZ = -Math.sin(this.freeCamYaw);

    const origin = this.camera.position;
    for (let i = 0; i < count; i++) {
      const slot = this.nhiProbeWriteCursor % 64;
      this.nhiProbeWriteCursor++;
      if (this.activeNhiProbeCount < 64) this.activeNhiProbeCount++;

      const spread = (i - (count - 1) * 0.5) * 3.8;
      const base = slot * 7;
      this.nhiProbePosVel[base] = origin.x + fwdX * 14.0 + rightX * spread;
      this.nhiProbePosVel[base + 1] = origin.y + fwdY * 14.0 - 2.0;
      this.nhiProbePosVel[base + 2] = origin.z + fwdZ * 14.0 + rightZ * spread;
      this.nhiProbePosVel[base + 3] = fwdX * (56.0 + i * 5.0) + rightX * spread * 1.4;
      this.nhiProbePosVel[base + 4] = fwdY * 52.0 + 16.0 + (i % 3) * 4.5;
      this.nhiProbePosVel[base + 5] = fwdZ * (56.0 + i * 5.0) + rightZ * spread * 1.4;
      this.nhiProbePosVel[base + 6] = 0.01;
    }
    this.nhiProbeMesh.count = this.activeNhiProbeCount;
    return this.activeNhiProbeCount;
  }

  /**
   * Unlocks and rises the 3D Obsidian-Rune `Monolith Temple` (`◈ STAGE II` -> `UwU` cipher).
   */
  public unlockStageIITemple(): void {
    this.templeUnlocked = true;
    this.stageIITempleGroup.visible = true;
    if (this.simulationStage !== 2) {
      this.toggleSimulationStage();
    }
  }

  /**
   * Unlocks `SUPERHERO` mode (`⛓ ACCESS` Roman Tally cipher) and summons the 2nd Super Creature (`Seraph-Prime`).
   */
  public unlockSuperheroMode(): void {
    this.superheroUnlocked = true;
    this.secondSuperCreature.visible = true;
  }

  /**
   * Fires a visible golden-cyan `SUPERHERO` Pulse Beam forward from the player camera into the cosmos.
   */
  public triggerSuperheroPulseBeam(): void {
    if (!this.pulseBeamMesh) {
      const geo = new THREE.CylinderGeometry(0.55, 2.2, 160, 12);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0, -80);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.pulseBeamMesh = new THREE.Mesh(geo, mat);
      this.scene.add(this.pulseBeamMesh);
    }
    this.pulseBeamMesh.position.copy(this.camera.position);
    this.pulseBeamMesh.position.y -= 2.2;
    this.pulseBeamMesh.quaternion.copy(this.camera.quaternion);
    this.pulseBeamMesh.visible = true;
    this.pulseBeamTtl = 0.65;
  }

  public isWorldSystemEnabled(sysId: CqmWorldSystemId): boolean {
    return this.worldSystemEnabled.get(sysId) ?? true;
  }

  public setWorldSystemEnabled(sysId: CqmWorldSystemId, enabled: boolean): void {
    this.worldSystemEnabled.set(sysId, enabled);
    switch (sysId) {
      case 'godColossus':
        this.godColossusGroup.visible = enabled;
        break;
      case 'quasicrystal':
        this.quasicrystalGroup.visible = enabled;
        break;
      case 'spires':
        this.spiresGroup.visible = enabled;
        break;
      case 'brutalist':
        this.brutalistGroup.visible = enabled;
        break;
      case 'frustums':
        this.frustumsGroup.visible = enabled;
        break;
      case 'voxels':
        this.voxelSwarmMesh.visible = enabled;
        break;
      case 'sanctuary':
        this.sanctuariesGroup.visible = enabled;
        break;
      case 'bigTree':
        this.bigTreeGroup.visible = enabled;
        break;
      case 'flora':
        this.floraGroup.visible = enabled;
        break;
      case 'pantheon101':
        this.pantheonGroup.visible = enabled;
        break;
      case 'sortingPillars':
        this.sortingPillarsGroup.visible = enabled;
        break;
      case 'organisms':
        for (const p of this.organismPools) p.visible = enabled;
        break;
      case 'titans':
        this.titanMesh.visible = enabled;
        break;
      case 'links':
        this.linkLineSegments.visible = enabled;
        break;
      case 'nhiProbes':
        this.nhiProbeMesh.visible = enabled;
        break;
      case 'asmodenius':
        for (const s of this.asmoSomites) s.visible = enabled;
        this.connectomeLine.visible = enabled;
        break;
      case 'xylos':
        this.xylosGroup.visible = enabled;
        this.zooidLine.visible = enabled;
        break;
    }
  }

  private applyFreeCameraOrientation(): void {
    this.camera.position.copy(this.freeCamPos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.freeCamYaw;
    this.camera.rotation.x = this.freeCamPitch;
    this.camera.rotation.z = 0;
  }

  private stepCameraNavigation(dtSec: number, simTimeSec: number, store: ErpRelationalStore): void {
    if (this.viewMode === 'free') {
      const speed = (this.superheroFlightBoost ? 195.0 : 78.0) * dtSec;
      const forwardX = -Math.sin(this.freeCamYaw);
      const forwardZ = -Math.cos(this.freeCamYaw);
      const rightX = Math.cos(this.freeCamYaw);
      const rightZ = -Math.sin(this.freeCamYaw);

      let moveFwd = -this.touchMoveVec.y;
      let moveRight = this.touchMoveVec.x;
      let moveUp = 0;

      if (this.heldKeys.has('w') || this.heldKeys.has('arrowup')) moveFwd += 1;
      if (this.heldKeys.has('s') || this.heldKeys.has('arrowdown')) moveFwd -= 1;
      if (this.heldKeys.has('d') || this.heldKeys.has('arrowright')) moveRight += 1;
      if (this.heldKeys.has('a') || this.heldKeys.has('arrowleft')) moveRight -= 1;
      if (this.heldKeys.has('e')) moveUp += 1;
      if (this.heldKeys.has('q')) moveUp -= 1;

      if (this.touchLookDelta.x !== 0 || this.touchLookDelta.y !== 0) {
        this.freeCamYaw -= this.touchLookDelta.x * 0.004;
        this.freeCamPitch = Math.max(-1.38, Math.min(1.38, this.freeCamPitch - this.touchLookDelta.y * 0.004));
        this.touchLookDelta.x = 0;
        this.touchLookDelta.y = 0;
      }

      this.freeCamPos.x = Math.max(-620, Math.min(620, this.freeCamPos.x + (forwardX * moveFwd + rightX * moveRight) * speed));
      this.freeCamPos.z = Math.max(-620, Math.min(620, this.freeCamPos.z + (forwardZ * moveFwd + rightZ * moveRight) * speed));
      this.freeCamPos.y = Math.max(-4, Math.min(480, this.freeCamPos.y + moveUp * speed));
      this.applyFreeCameraOrientation();
    } else if (this.viewMode === 'orbit' || this.viewMode === 'cinematic' || this.viewMode === 'vortex') {
      const rate = this.viewMode === 'vortex' ? 0.24 : 0.11;
      const rad = this.viewMode === 'vortex' ? 145 + Math.sin(simTimeSec * 0.3) * 45 : 235;
      this.camera.position.set(
        Math.sin(simTimeSec * rate) * rad,
        68 + Math.sin(simTimeSec * 0.15) * 28,
        Math.cos(simTimeSec * rate) * rad + 45,
      );
      this.camera.lookAt(0, 72, -110);
    } else if (this.viewMode === 'top') {
      this.camera.position.set(0, 420, 40);
      this.camera.lookAt(0, 0, -20);
    } else if (this.viewMode === 'tree') {
      this.camera.position.set(
        242 + Math.cos(simTimeSec * 0.16) * 125,
        82,
        -185 + Math.sin(simTimeSec * 0.16) * 125,
      );
      this.camera.lookAt(242, 72, -185);
    } else {
      // Follow / Chase / Specimen / Titan / Mimic / Fly
      const targetIdx = store.activeCount > 0 ? Math.floor(simTimeSec * 0.2) % store.activeCount : 0;
      const tx = (store.posX[targetIdx] ?? 0) * 5.2;
      const tz = (store.posZ[targetIdx] ?? 0) * 5.2 + 90;
      const ty = sampleCqmTerrainHeight(tx, tz, simTimeSec) + 12;
      this.camera.position.set(tx + Math.cos(simTimeSec * 0.35) * 42, ty + 18, tz + Math.sin(simTimeSec * 0.35) * 42);
      this.camera.lookAt(tx, ty, tz);
    }

    // Keep sky dome centered on camera
    this.skyDome.position.copy(this.camera.position);
  }

  private bindCameraAndSelectionInput(): void {
    const dom = this.renderer?.domElement ?? this.hostOrCanvas;

    dom.addEventListener('pointerdown', (e: PointerEvent) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        this.prevPinchDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      }
      dom.setPointerCapture?.(e.pointerId);
    });

    dom.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.activePointers.has(e.pointerId)) return;
      const prev = this.activePointers.get(e.pointerId)!;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 1 && this.viewMode === 'free') {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        this.freeCamYaw -= dx * 0.0032;
        this.freeCamPitch = Math.max(-1.38, Math.min(1.38, this.freeCamPitch - dy * 0.0032));
        this.applyFreeCameraOrientation();
      } else if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        if (this.prevPinchDist > 4) {
          const delta = (dist - this.prevPinchDist) * 0.35;
          this.freeCamPos.x -= Math.sin(this.freeCamYaw) * delta;
          this.freeCamPos.z -= Math.cos(this.freeCamYaw) * delta;
          this.applyFreeCameraOrientation();
        }
        this.prevPinchDist = dist;
      }
    });

    const releasePointer = (e: PointerEvent) => {
      const movedDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      this.activePointers.delete(e.pointerId);
      if (movedDist < 6 && this.onSelectEntity) {
        this.pickEntityAt(e.clientX, e.clientY);
      }
    };
    dom.addEventListener('pointerup', releasePointer);
    dom.addEventListener('pointercancel', releasePointer);

    dom.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const step = -Math.sign(e.deltaY) * 14.0;
        this.freeCamPos.x -= Math.sin(this.freeCamYaw) * step;
        this.freeCamPos.z -= Math.cos(this.freeCamYaw) * step;
        this.applyFreeCameraOrientation();
      },
      { passive: false },
    );

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        this.heldKeys.add(e.key.toLowerCase());
      });
      window.addEventListener('keyup', (e: KeyboardEvent) => {
        this.heldKeys.delete(e.key.toLowerCase());
      });
    }
  }

  private pickEntityAt(clientX: number, clientY: number): void {
    const dom = this.renderer?.domElement ?? this.hostOrCanvas;
    const rect = dom.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const hits = this.raycaster.intersectObjects(this.organismPools, false);
    if (hits.length > 0 && hits[0]!.instanceId !== undefined) {
      const poolIdx = this.organismPools.indexOf(hits[0]!.object as THREE.InstancedMesh);
      const entityId = this.instanceToEntityId[hits[0]!.instanceId * this.organismPools.length + Math.max(0, poolIdx)] ?? 0;
      if (entityId >= 0 && this.onSelectEntity) {
        this.onSelectEntity(entityId);
      }
    }
  }

  public resize(): void {
    if (!this.renderer) return;
    const w = Math.max(320, (typeof window !== 'undefined' ? window.innerWidth : 0) || this.hostOrCanvas.clientWidth || 1280);
    const h = Math.max(240, (typeof window !== 'undefined' ? window.innerHeight : 0) || this.hostOrCanvas.clientHeight || 720);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  public renderFrame(params: {
    store: ErpRelationalStore;
    spinePtsXyz: Float32Array;
    simTimeSec: number;
    dtSec?: number;
    chaosLevel?: number;
    entropyLevel?: number;
    windSpeed?: number;
    kerrSpinA: number;
    manifoldWarpGain: number;
    maxVisualPulseHz: number;
    shellAmplitudes10: Float32Array;
    intendedVec: readonly [number, number];
    executedVec: readonly [number, number];
    skinUGs?: Float32Array;
    skinVGs?: Float32Array;
    asmodeniusConfidence?: number;
    sortingBins64?: Float32Array;
  }): void {
    if (this.contextLost) return;
    const { store, spinePtsXyz, simTimeSec } = params;
    const tAnim = this.reducedMotion ? 0 : simTimeSec;
    const safeHz = Math.min(2.2, Math.max(0.1, params.maxVisualPulseHz));
    const chaos = params.chaosLevel ?? 0.5;
    const entropy = params.entropyLevel ?? 0.12;

    this.stepCameraNavigation(params.dtSec ?? 0.016, tAnim, store);

    // 1. Update Shader Uniforms
    this.skyUniforms.uTime.value = tAnim;
    this.skyUniforms.uChaos.value = chaos;
    this.godColossusUniforms.uTime.value = tAnim;
    this.godColossusUniforms.uChaos.value = chaos;
    this.godColossusUniforms.uEntropy.value = entropy;
    this.terrainUniforms.uTime.value = tAnim;
    this.terrainUniforms.uChaos.value = chaos;
    this.floraUniforms.uTime.value = tAnim;
    this.floraUniforms.uWind.value = params.windSpeed ?? 1.0;
    this.voxelUniforms.uTime.value = tAnim;

    this.kerrUniforms.uTime.value = tAnim;
    this.kerrUniforms.uSpinA.value = params.kerrSpinA;
    this.kerrUniforms.uPulseHz.value = safeHz;
    this.kerrBillboard.quaternion.copy(this.camera.quaternion);
    this.manifoldUniforms.uWarpGain.value = params.manifoldWarpGain;
    this.manifoldUniforms.uTime.value = tAnim;

    this.primarySanctuaryDome.rotation.y = tAnim * 0.12;
    this.primarySanctuaryDome.rotation.z = Math.sin(tAnim * 0.18) * 0.08;
    this.bigTreeGroup.rotation.y = tAnim * 0.025;

    // 2. Live Gray-Scott Texture Upload for Asmodenius & Bioluminescent Terrain
    if (params.skinUGs && params.skinVGs && params.skinUGs.length >= 24 * 24) {
      for (let i = 0; i < 24 * 24; i++) {
        this.skinRgba[i * 4] = Math.min(255, Math.max(0, Math.round(params.skinUGs[i]! * 255)));
        this.skinRgba[i * 4 + 1] = Math.min(255, Math.max(0, Math.round(params.skinVGs[i]! * 255)));
        this.skinRgba[i * 4 + 2] = 200;
        this.skinRgba[i * 4 + 3] = 255;
      }
      this.skinDataTexture.needsUpdate = true;
    }
    this.skinUniforms.uTime.value = tAnim;
    this.skinUniforms.uPulseHz.value = safeHz;
    this.skinUniforms.uConfidence.value = params.asmodeniusConfidence ?? 0.68;

    // 3. 10-Shell Mechalogodrom Zenith Breathing
    for (let i = 0; i < this.mechShells.length; i++) {
      const sh = this.mechShells[i]!;
      const amp = params.shellAmplitudes10[i] ?? 0.5;
      sh.scale.setScalar(3.2 * (0.92 + 0.18 * amp));
      if (!this.reducedMotion) {
        sh.rotation.y = tAnim * 0.08 * (i % 2 === 0 ? 1 : -1) + i * 0.3;
      }
    }

    // 4. Stream SoA Organism Positions into 4 Multi-Morph Instanced Pools + Connectome Beams
    const n = store.activeCount;
    const poolCounts = [0, 0, 0, 0];
    const poolCap = this.organismPools[0]!.instanceMatrix.count;

    let linkIdx = 0;
    const maxLinks = 320;

    for (let e = 0; e < n; e++) {
      const pIdx = e % 4;
      const slot = poolCounts[pIdx]!;
      if (slot >= poolCap) continue;

      // Expand ERP [-45..+45] coordinates across the full CQM foreground/midground landscape!
      const wx = store.posX[e]! * 5.6;
      const wz = store.posZ[e]! * 4.8 + 65;
      const groundY = sampleCqmTerrainHeight(wx, wz, tAnim, chaos);
      const hover = 2.4 + (e % 7) * 1.65 + Math.sin(tAnim * 1.4 + e * 0.7) * 1.1;
      const wy = Math.max(groundY + 1.8, groundY + hover);

      this.dummyPos.set(wx, wy, wz);
      this.dummyEuler.set(
        Math.sin(tAnim * 0.9 + e) * 0.25,
        store.headingRad[e]! + tAnim * 0.25,
        Math.cos(tAnim * 0.7 + e) * 0.2,
      );
      this.dummyQuat.setFromEuler(this.dummyEuler);
      const atp = store.pools15[e * 15 + 12] ?? 1.5;
      const sc = Math.max(0.58, Math.min(1.55, 0.72 + atp * 0.14));
      this.dummyScale.set(sc, sc, sc);
      this.dummyMatrix.compose(this.dummyPos, this.dummyQuat, this.dummyScale);

      const pool = this.organismPools[pIdx]!;
      pool.setMatrixAt(slot, this.dummyMatrix);

      // Tribe / Phylum golden-angle hue matching CQM 8-tribe & 20-phylum vibrant spectrum
      const hue = ((store.speciesFk[e]! * 0.125 + (e % 8) * 0.085) % 1 + 1) % 1;
      this.dummyColor.setHSL(hue, 0.9, 0.58);
      pool.setColorAt(slot, this.dummyColor);

      this.instanceToEntityId[slot * 4 + pIdx] = e;
      poolCounts[pIdx] = slot + 1;

      // Build glowing inter-organism connectome beams between nearby organisms
      if (linkIdx < maxLinks && e + 1 < n && e % 2 === 0) {
        const nx = store.posX[e + 1]! * 5.6;
        const nz = store.posZ[e + 1]! * 4.8 + 65;
        const dist2 = (wx - nx) * (wx - nx) + (wz - nz) * (wz - nz);
        if (dist2 < 7200) {
          const ny = sampleCqmTerrainHeight(nx, nz, tAnim, chaos) + 4.2;
          const base = linkIdx * 6;
          this.linkPositions[base] = wx;
          this.linkPositions[base + 1] = wy;
          this.linkPositions[base + 2] = wz;
          this.linkPositions[base + 3] = nx;
          this.linkPositions[base + 4] = ny;
          this.linkPositions[base + 5] = nz;

          this.linkColors[base] = this.dummyColor.r;
          this.linkColors[base + 1] = this.dummyColor.g;
          this.linkColors[base + 2] = this.dummyColor.b;
          this.linkColors[base + 3] = 0.22;
          this.linkColors[base + 4] = 0.88;
          this.linkColors[base + 5] = 0.98;
          linkIdx++;
        }
      }
    }

    for (let p = 0; p < 4; p++) {
      const pool = this.organismPools[p]!;
      pool.count = poolCounts[p]!;
      pool.instanceMatrix.needsUpdate = true;
      if (pool.instanceColor) pool.instanceColor.needsUpdate = true;
    }

    this.activeLinkCount = Math.max(120, linkIdx);
    this.linkLineSegments.geometry.setDrawRange(0, linkIdx * 2);
    (this.linkLineSegments.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.linkLineSegments.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    // 5. Update 20 Colossal Sky/Horizon Titans (orbiting across mid-sky without clipping camera near plane)
    for (let t = 0; t < 20; t++) {
      const ang = (t / 20) * Math.PI * 2 + tAnim * 0.035;
      const rad = 165 + (t % 3) * 38;
      const tx = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad - 58;
      const ty = 28 + (t % 5) * 14 + Math.sin(tAnim * 0.6 + t) * 4.5;
      this.dummyPos.set(tx, ty, tz);
      this.dummyEuler.set(tAnim * 0.2 + t, ang, tAnim * 0.15);
      this.dummyQuat.setFromEuler(this.dummyEuler);
      this.dummyScale.setScalar(0.95 + (t % 3) * 0.2);
      this.dummyMatrix.compose(this.dummyPos, this.dummyQuat, this.dummyScale);
      this.titanMesh.setMatrixAt(t, this.dummyMatrix);
      this.dummyColor.setHSL((t / 20) % 1, 0.88, 0.6);
      this.titanMesh.setColorAt(t, this.dummyColor);
    }
    this.titanMesh.instanceMatrix.needsUpdate = true;
    if (this.titanMesh.instanceColor) this.titanMesh.instanceColor.needsUpdate = true;

    // 6. Asmodenius v42 Hero Articulated Spine + 14-Region Connectome Arc
    const heroAnchorX = -12;
    const heroAnchorZ = 158;
    const heroGround = sampleCqmTerrainHeight(heroAnchorX, heroAnchorZ, tAnim, chaos);
    for (let s = 0; s < this.asmoSomites.length; s++) {
      const sx = heroAnchorX + spinePtsXyz[s * 3]! * 3.8;
      const sy = heroGround + 8.5 + spinePtsXyz[s * 3 + 1]! * 3.8;
      const sz = heroAnchorZ + spinePtsXyz[s * 3 + 2]! * 3.8;
      this.asmoSomites[s]!.position.set(sx, sy, sz);
    }
    const headPos = this.asmoSomites[0]!.position;
    for (let r = 0; r < 15; r++) {
      const ang = (r / 14) * Math.PI * 2 + tAnim * 0.5;
      this.connectomePositions[r * 3] = headPos.x + Math.cos(ang) * 5.2;
      this.connectomePositions[r * 3 + 1] = headPos.y + 4.8 + Math.sin(ang * 2 + tAnim) * 1.6;
      this.connectomePositions[r * 3 + 2] = headPos.z + Math.sin(ang) * 5.2;
    }
    (this.connectomeLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // 7. Xylos `{7,3}` Medusa Oral Tentacles + Glossodrom S^3 Zooid Strand + Glitchling Vectors
    this.xylosGroup.position.y = 26 + Math.sin(tAnim * 0.9) * 2.5;
    for (let t = 0; t < this.xylosTentacles.length; t++) {
      const buf = this.xylosTentacleBuffers[t]!;
      const baseAngle = (t / 7) * Math.PI * 2;
      for (let seg = 0; seg < 10; seg++) {
        const frac = seg / 9;
        const sway = this.reducedMotion ? 0 : Math.sin(tAnim * 1.6 - frac * 3.0 + t) * 0.25 * frac;
        const r = (0.35 + frac * 0.75) * (1 + sway * 0.3);
        buf[seg * 3] = Math.cos(baseAngle + sway) * r;
        buf[seg * 3 + 1] = -frac * 2.1;
        buf[seg * 3 + 2] = Math.sin(baseAngle + sway) * r;
      }
      (this.xylosTentacles[t]!.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    const demoCodeword = new Uint8Array(15);
    for (let i = 0; i < 15; i++) {
      demoCodeword[i] = (i * 3 + Math.floor(tAnim * 2)) & 0x0f;
    }
    this.zooidPositions.set(projectZooidStrandS3ToR3(demoCodeword, tAnim * 0.4));
    (this.zooidLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    const iv = new THREE.Vector3(params.intendedVec[0], 0.15, params.intendedVec[1]);
    const ev = new THREE.Vector3(params.executedVec[0], 0.15, params.executedVec[1]);
    if (iv.lengthSq() > 1e-6) this.intendedArrow.setDirection(iv.clone().normalize());
    if (ev.lengthSq() > 1e-6) this.executedArrow.setDirection(ev.clone().normalize());

    // 8. 6D->3D Quasicrystal Lattice Shell + 100 Alphabet Pantheon Glyphs (`stepGlyphBrainBatch`) + `APEX ς` Monolith
    const dtPhys = Math.min(0.05, Math.max(0.004, params.dtSec ?? 0.016));
    if (!this.reducedMotion) {
      this.quasicrystalGroup.rotation.y = tAnim * 0.045;
      this.quasicrystalGroup.rotation.x = Math.sin(tAnim * 0.03) * 0.12;
      this.apexMonolith.rotation.y = tAnim * 0.32;
      this.apexMonolith.position.y = 56 + Math.sin(tAnim * 1.1) * 3.2;
    }

    if (this.pantheonGroup.visible) {
      // Step 16-glyph slice via Zig SIMD128 `cqm2_glyph_brain_batch_step` (< 0.08 ms)
      for (let k = 0; k < 16; k++) {
        this.glyphDrive16[k * 4] = Math.sin(tAnim * 1.3 + (this.glyphSliceCursor + k) * 0.4) * (0.4 + chaos * 0.4);
      }
      const meanGlyphE = getZigBridge().stepGlyphBrainBatch(
        this.glyphStates16,
        this.glyphLateralW16,
        this.glyphDrive16,
        16,
        0.015,
      );
      for (let k = 0; k < 16; k++) {
        const gIdx = (this.glyphSliceCursor + k) % 100;
        this.glyphEnergy100[gIdx] = Math.min(1.5, Math.max(0.2, meanGlyphE + Math.abs(this.glyphStates16[k * 1024] ?? 0.3)));
      }
      this.glyphSliceCursor = (this.glyphSliceCursor + 16) % 100;

      for (let p = 0; p < 5; p++) {
        const inst = this.pantheonGlyphPools5[p]!;
        for (let j = 0; j < 20; j++) {
          const idx100 = p * 20 + j;
          const ang = (idx100 / 100) * Math.PI * 2 + tAnim * 0.055;
          const r = 136 + (idx100 % 2) * 16;
          const y = 94 + Math.sin(ang * 3 + tAnim * 0.5) * 14;
          this.dummyPos.set(Math.cos(ang) * r, y, Math.sin(ang) * r - 34);
          this.dummyEuler.set(ang + tAnim * 0.35, idx100 * 0.2 + tAnim * 0.28, 0);
          this.dummyQuat.setFromEuler(this.dummyEuler);
          const gScale = 0.82 + (this.glyphEnergy100[idx100] ?? 0.5) * 0.48;
          this.dummyScale.setScalar(gScale);
          this.dummyMatrix.compose(this.dummyPos, this.dummyQuat, this.dummyScale);
          inst.setMatrixAt(j, this.dummyMatrix);
        }
        inst.instanceMatrix.needsUpdate = true;
      }
    }

    // 9. 64 GPU-Instanced 3D Sorting Field Pillars synced live with `sortingBins64`
    if (params.sortingBins64 && this.sortingPillarsGroup.visible) {
      const bins = params.sortingBins64;
      for (let i = 0; i < 64; i++) {
        const v = Math.max(0.04, Math.min(1.0, bins[i] ?? 0.5));
        const frac = i / 63;
        const ang = Math.PI * 0.12 + frac * Math.PI * 0.76;
        const x = 24 + Math.cos(ang) * 44;
        const z = 124 - Math.sin(ang) * 44;
        const gy = sampleCqmTerrainHeight(x, z, tAnim, chaos);
        this.dummyPos.set(x, gy, z);
        this.dummyQuat.identity();
        this.dummyScale.set(1.0, 2.5 + v * 26.0, 1.0);
        this.dummyMatrix.compose(this.dummyPos, this.dummyQuat, this.dummyScale);
        this.sortingPillarsMesh.setMatrixAt(i, this.dummyMatrix);
        this.dummyColor.setHSL((0.5 + v * 0.42) % 1, 0.9, 0.56);
        this.sortingPillarsMesh.setColorAt(i, this.dummyColor);
      }
      this.sortingPillarsMesh.instanceMatrix.needsUpdate = true;
      if (this.sortingPillarsMesh.instanceColor) this.sortingPillarsMesh.instanceColor.needsUpdate = true;
    }

    // 10. Ballistic Physics & Seabed Restitution for Tossed `⟁ NHI` Probes
    if (this.activeNhiProbeCount > 0 && this.nhiProbeMesh.visible) {
      for (let i = 0; i < this.activeNhiProbeCount; i++) {
        const base = i * 7;
        let px = this.nhiProbePosVel[base]!;
        let py = this.nhiProbePosVel[base + 1]!;
        let pz = this.nhiProbePosVel[base + 2]!;
        let vx = this.nhiProbePosVel[base + 3]!;
        let vy = this.nhiProbePosVel[base + 4]!;
        let vz = this.nhiProbePosVel[base + 5]!;
        const age = this.nhiProbePosVel[base + 6]! + dtPhys;

        vy -= 22.0 * dtPhys;
        px += vx * dtPhys;
        py += vy * dtPhys;
        pz += vz * dtPhys;

        const floorY = sampleCqmTerrainHeight(px, pz, tAnim, chaos) + 2.2;
        if (py < floorY) {
          py = floorY;
          vy = Math.abs(vy) * 0.68 + 2.4;
          vx *= 0.86;
          vz *= 0.86;
        }

        this.nhiProbePosVel[base] = px;
        this.nhiProbePosVel[base + 1] = py;
        this.nhiProbePosVel[base + 2] = pz;
        this.nhiProbePosVel[base + 3] = vx;
        this.nhiProbePosVel[base + 4] = vy;
        this.nhiProbePosVel[base + 5] = vz;
        this.nhiProbePosVel[base + 6] = age;

        this.dummyPos.set(px, py, pz);
        this.dummyEuler.set(age * 2.4, age * 3.1 + i, age * 1.7);
        this.dummyQuat.setFromEuler(this.dummyEuler);
        this.dummyScale.setScalar(1.0 + 0.18 * Math.sin(age * 5.0 + i));
        this.dummyMatrix.compose(this.dummyPos, this.dummyQuat, this.dummyScale);
        this.nhiProbeMesh.setMatrixAt(i, this.dummyMatrix);
      }
      this.nhiProbeMesh.count = this.activeNhiProbeCount;
      this.nhiProbeMesh.instanceMatrix.needsUpdate = true;
    }

    // 11. `◈ STAGE II` (`UwU`) Rising Monolith Temple + `⛓ ACCESS` (`SUPERHERO`) 2nd Super Creature & Pulse Beam
    if (this.templeUnlocked && this.stageIITempleGroup.visible) {
      const targetY = sampleCqmTerrainHeight(0, 58, tAnim, chaos) - 1.2;
      this.stageIITempleGroup.position.y += (targetY - this.stageIITempleGroup.position.y) * Math.min(1, dtPhys * 2.6);
      this.stageIITempleGroup.rotation.y = Math.sin(tAnim * 0.15) * 0.08;
    }

    if (this.superheroUnlocked && this.secondSuperCreature.visible) {
      const orbitAng = tAnim * 0.85;
      this.secondSuperCreature.position.set(
        this.camera.position.x + Math.cos(orbitAng) * 26 - Math.sin(this.freeCamYaw) * 34,
        this.camera.position.y + 6.0 + Math.sin(tAnim * 1.9) * 3.5,
        this.camera.position.z + Math.sin(orbitAng) * 26 - Math.cos(this.freeCamYaw) * 34,
      );
      this.secondSuperCreature.rotation.y = -orbitAng;
    }

    if (this.pulseBeamMesh && this.pulseBeamTtl > 0) {
      this.pulseBeamTtl -= dtPhys;
      if (this.pulseBeamTtl <= 0) {
        this.pulseBeamMesh.visible = false;
      } else {
        (this.pulseBeamMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, this.pulseBeamTtl * 1.3);
      }
    }

    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
