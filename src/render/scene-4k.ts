/**
 * CQM2 v2.1.0 Cinema-4K Zero-GC Multi-Shell Relativistic & Biological Observatory Renderer (`src/render/scene-4k.ts`).
 *
 * Architectural Capabilities:
 *   - Single `THREE.InstancedMesh` fed directly from ERP SoA TypedArrays (1 draw call for up to 50,000 creatures).
 *   - All 10 analytical differential-geometric Mechalogodrom shells + polar Blandford-Znajek relativistic jets.
 *   - 5 Cosmological Singularities (Central Spinning Kerr + 4 Quadrant Horizon Beacons).
 *   - Big Tree Crystal Sanctuary (`r = 14` peace ring + 6 bioluminescent fruiting pods).
 *   - Asmodenius v42 8-somite articulated hero body textured with live `32x32` Gray-Scott `THREE.DataTexture` + 14-region connectome arcs.
 *   - Xylos v2 Hyperbolic `{7,3}` Medusa Bell + 7 oral tentacles, and Glitchling Intended vs Executed vectors.
 *   - 10 Render Modes, 4 Quality Tiers (`4K_ULTRA`, `HIGH`, `BALANCED`, `MOBILE_ECO`), 8 Camera Presets,
 *     `THREE.Raycaster` click-to-inspect organism, 2-pointer pinch-zoom, `prefers-reduced-motion`, and `.glb` mesh loader.
 */
import * as THREE from 'three';
import type { ErpRelationalStore } from '../erp/relational-store';
import { projectZooidStrandS3ToR3 } from '../quantum/xenolinguistics';
import {
  buildAll10MechalogodromShells,
  buildBigTreeSanctuaryGroup,
  buildXylosMedusaGroup,
} from './mecha-shells';
import {
  CHROMATOPHORE_SKIN_FRAGMENT_SHADER,
  CHROMATOPHORE_SKIN_VERTEX_SHADER,
  KERR_SINGULARITY_FRAGMENT_SHADER,
  KERR_SINGULARITY_VERTEX_SHADER,
  MANIFOLD_GRID_FRAGMENT_SHADER,
  MANIFOLD_GRID_VERTEX_SHADER,
} from './shaders';

export type RenderQualityPreset = '4K_ULTRA' | 'HIGH' | 'BALANCED' | 'MOBILE_ECO';

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

export class Cqm2Scene4kRenderer {
  private readonly container: HTMLElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  // Instanced organism swarm + instance->entity lookup for Raycaster click-to-inspect
  private readonly organismMesh: THREE.InstancedMesh;
  private readonly instanceToEntityId: Int32Array;
  private readonly dummyMatrix = new THREE.Matrix4();
  private readonly dummyPos = new THREE.Vector3();
  private readonly dummyQuat = new THREE.Quaternion();
  private readonly dummyEuler = new THREE.Euler();
  private readonly dummyScale = new THREE.Vector3();
  private readonly dummyColor = new THREE.Color();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();

  // Central Kerr Singularity + 4 Quadrant Singularities + Polar Jets + 10-Shell Mechalogodrom
  private readonly kerrUniforms: {
    uTime: { value: number };
    uSpinA: { value: number };
    uPulseHz: { value: number };
  };
  private readonly manifoldUniforms: {
    uWarpGain: { value: number };
    uTime: { value: number };
  };
  private readonly skinUniforms: {
    uSkinField: { value: THREE.DataTexture };
    uTime: { value: number };
    uPulseHz: { value: number };
    uConfidence: { value: number };
  };
  private readonly skinRgba = new Uint8Array(24 * 24 * 4);
  private readonly skinDataTexture: THREE.DataTexture;

  private readonly kerrBillboard: THREE.Mesh;
  private readonly quadrantBeacons: THREE.Mesh[] = [];
  private readonly polarJetNorth: THREE.Mesh;
  private readonly polarJetSouth: THREE.Mesh;
  private readonly mechShells: THREE.Mesh[];

  // Asmodenius 8-somite articulated spine + 14-region neural connectome arcs
  private readonly asmoSomites: THREE.Mesh[] = [];
  private readonly connectomeLine: THREE.Line;
  private readonly connectomePositions = new Float32Array(15 * 3);

  // Xylos v2 Hyperbolic Medusa + Big Tree Sanctuary + Glossodrom S3 Zooid strand + Glitchling vectors
  private readonly xylosGroup: THREE.Group;
  private readonly xylosTentacles: THREE.Line[];
  private readonly xylosTentacleBuffers: Float32Array[];
  private readonly sanctuaryGroup: THREE.Group;
  private readonly sanctuaryPods: THREE.Mesh[];
  private readonly zooidLine: THREE.Line;
  private readonly zooidPositions = new Float32Array(15 * 3);
  private readonly intendedArrow: THREE.ArrowHelper;
  private readonly executedArrow: THREE.ArrowHelper;
  private customLoadedMesh: THREE.Mesh | null = null;

  // Spherical camera & multi-pointer touch pinch-zoom state
  private camRadius = 56.0;
  private camTheta = 0.68;
  private camPhi = 1.05;
  private camTarget = new THREE.Vector3(0, 2.5, 0);
  private followMode: 'NONE' | 'ASMO' | 'GLITCH' | 'XYLOS' = 'NONE';
  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private prevPinchDist = 0;
  private pointerDownPos = { x: 0, y: 0 };

  public contextLost = false;
  public reducedMotion = false;
  public qualityPreset: RenderQualityPreset = 'BALANCED';
  public visualMode: RenderVisualMode = 'STANDARD_4K';
  public onSelectEntity: ((entityId: number) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  public constructor(container: HTMLElement, maxInstances = 2048) {
    this.container = container;
    this.instanceToEntityId = new Int32Array(maxInstances).fill(-1);
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050913);
    this.scene.fog = new THREE.FogExp2(0x050913, 0.0062);

    const w = Math.max(320, container.clientWidth || 1280);
    const h = Math.max(240, container.clientHeight || 720);
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.2, 460);
    this.updateCameraTransform();

    // Lighting
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x091326, 1.2);
    this.scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 1.65);
    keyLight.position.set(28, 45, 24);
    this.scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xfbbf24, 2.5, 95, 1.4);
    rimLight.position.set(0, 8, 0);
    this.scene.add(rimLight);

    // 1. Lipschitz-Guarded 4D Non-Euclidean Manifold Floor Grid
    this.manifoldUniforms = { uWarpGain: { value: 0.22 }, uTime: { value: 0.0 } };
    const gridGeo = new THREE.PlaneGeometry(168, 168, 96, 96);
    gridGeo.rotateX(-Math.PI / 2);
    const gridMat = new THREE.ShaderMaterial({
      vertexShader: MANIFOLD_GRID_VERTEX_SHADER,
      fragmentShader: MANIFOLD_GRID_FRAGMENT_SHADER,
      uniforms: this.manifoldUniforms,
      transparent: true,
      depthWrite: false,
    });
    const manifoldMesh = new THREE.Mesh(gridGeo, gridMat);
    manifoldMesh.position.y = -0.2;
    this.scene.add(manifoldMesh);

    // 2. Central Kerr Photon-Ring Singularity + Polar Relativistic Jets + 4 Quadrant Singularities
    this.kerrUniforms = { uTime: { value: 0.0 }, uSpinA: { value: 0.84 }, uPulseHz: { value: 1.8 } };
    const kerrGeo = new THREE.PlaneGeometry(15.5, 15.5);
    const kerrMat = new THREE.ShaderMaterial({
      vertexShader: KERR_SINGULARITY_VERTEX_SHADER,
      fragmentShader: KERR_SINGULARITY_FRAGMENT_SHADER,
      uniforms: this.kerrUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.kerrBillboard = new THREE.Mesh(kerrGeo, kerrMat);
    this.kerrBillboard.position.set(0, 7.5, 0);
    this.scene.add(this.kerrBillboard);

    const jetGeo = new THREE.ConeGeometry(0.95, 18.0, 16, 1, true);
    const jetMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.polarJetNorth = new THREE.Mesh(jetGeo, jetMat);
    this.polarJetNorth.position.set(0, 17.0, 0);
    this.polarJetSouth = new THREE.Mesh(jetGeo, jetMat);
    this.polarJetSouth.rotation.x = Math.PI;
    this.polarJetSouth.position.set(0, -2.0, 0);
    this.scene.add(this.polarJetNorth, this.polarJetSouth);

    const quadCoords: ReadonlyArray<[number, number, number, number]> = [
      [34, 4.5, 34, 0x38bdf8],
      [-34, 4.5, 34, 0xc084fc],
      [34, 4.5, -34, 0xfbbf24],
      [-34, 4.5, -34, 0x34d399],
    ];
    const beaconGeo = new THREE.TorusKnotGeometry(1.15, 0.22, 48, 8);
    for (const [qx, qy, qz, qCol] of quadCoords) {
      const bMat = new THREE.MeshPhysicalMaterial({
        color: qCol,
        emissive: qCol,
        emissiveIntensity: 0.55,
        roughness: 0.2,
        metalness: 0.5,
      });
      const bMesh = new THREE.Mesh(beaconGeo, bMat);
      bMesh.position.set(qx, qy, qz);
      this.scene.add(bMesh);
      this.quadrantBeacons.push(bMesh);
    }

    // 3. All 10 Real-Math Parametric Mechalogodrom Shells
    this.mechShells = buildAll10MechalogodromShells();
    for (const sh of this.mechShells) {
      this.scene.add(sh);
    }

    // 4. Big Tree Crystal Sanctuary (`r = 14`)
    const sanctuary = buildBigTreeSanctuaryGroup();
    this.sanctuaryGroup = sanctuary.group;
    this.sanctuaryPods = sanctuary.pods;
    this.scene.add(this.sanctuaryGroup);

    // 5. Instanced Organism Population (`THREE.InstancedMesh` with Guanine Iridescence)
    const orgGeo = new THREE.ConeGeometry(0.36, 1.35, 10);
    orgGeo.rotateX(Math.PI / 2);
    const orgMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.25,
      roughness: 0.24,
      iridescence: 1.0,
      iridescenceIOR: 1.83,
      clearcoat: 0.8,
    });
    this.organismMesh = new THREE.InstancedMesh(orgGeo, orgMat, maxInstances);
    this.organismMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.organismMesh.count = 0;
    this.scene.add(this.organismMesh);

    // 6. Asmodenius Prime 8-Somite Hero Body bound to Live `24x24` Gray-Scott `DataTexture`
    for (let i = 0; i < 24 * 24; i++) {
      this.skinRgba[i * 4] = 210;
      this.skinRgba[i * 4 + 1] = 65;
      this.skinRgba[i * 4 + 2] = 180;
      this.skinRgba[i * 4 + 3] = 255;
    }
    this.skinDataTexture = new THREE.DataTexture(this.skinRgba, 24, 24, THREE.RGBAFormat);
    this.skinDataTexture.wrapS = THREE.RepeatWrapping;
    this.skinDataTexture.wrapT = THREE.RepeatWrapping;
    this.skinDataTexture.magFilter = THREE.LinearFilter;
    this.skinDataTexture.minFilter = THREE.LinearFilter;
    this.skinDataTexture.needsUpdate = true;

    this.skinUniforms = {
      uSkinField: { value: this.skinDataTexture },
      uTime: { value: 0 },
      uPulseHz: { value: 1.4 },
      uConfidence: { value: 0.68 },
    };
    const asmoShaderMat = new THREE.ShaderMaterial({
      vertexShader: CHROMATOPHORE_SKIN_VERTEX_SHADER,
      fragmentShader: CHROMATOPHORE_SKIN_FRAGMENT_SHADER,
      uniforms: this.skinUniforms,
    });
    for (let i = 0; i < 8; i++) {
      const r = 0.48 * Math.sin(Math.max(0.15, (i + 0.6) / 8.2) * Math.PI) + 0.11;
      const somiteGeo = new THREE.SphereGeometry(r, 20, 16);
      const somite = new THREE.Mesh(somiteGeo, asmoShaderMat);
      this.scene.add(somite);
      this.asmoSomites.push(somite);
    }

    // 14-Region Connectome Neural Arc Web above Asmodenius
    const connGeo = new THREE.BufferGeometry();
    connGeo.setAttribute('position', new THREE.BufferAttribute(this.connectomePositions, 3));
    const connMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });
    this.connectomeLine = new THREE.Line(connGeo, connMat);
    this.scene.add(this.connectomeLine);

    // 7. Xylos v2 Hyperbolic `{7,3}` Medusa
    const xylos = buildXylosMedusaGroup();
    this.xylosGroup = xylos.group;
    this.xylosTentacles = xylos.tentacles;
    this.xylosTentacleBuffers = xylos.tentacleBuffers;
    this.xylosGroup.position.set(12, 4.2, -10);
    this.scene.add(this.xylosGroup);

    // 8. Glossodrom 4D S^3 -> R^3 Bioluminescent Zooid Strand
    const zooidGeo = new THREE.BufferGeometry();
    zooidGeo.setAttribute('position', new THREE.BufferAttribute(this.zooidPositions, 3));
    const zooidMat = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.85 });
    this.zooidLine = new THREE.Line(zooidGeo, zooidMat);
    this.zooidLine.position.set(0, 7.5, 0);
    this.zooidLine.scale.setScalar(2.6);
    this.scene.add(this.zooidLine);

    // 9. Glitchling Intended (Cyan) vs. Executed (Gold) Trajectory Vectors
    this.intendedArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), 3.2, 0x38bdf8, 0.7, 0.4);
    this.executedArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), 3.2, 0xfbbf24, 0.7, 0.4);
    this.scene.add(this.intendedArrow, this.executedArrow);

    this.initWebGlRenderer();
    this.bindCameraAndSelectionInput();
  }

  private initWebGlRenderer(): void {
    if (typeof document === 'undefined') return;
    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
      this.renderer = renderer;
      this.applyQualityPreset(
        window.innerWidth >= 2560
          ? '4K_ULTRA'
          : window.innerWidth >= 1600
            ? 'HIGH'
            : window.innerWidth < 768
              ? 'MOBILE_ECO'
              : 'BALANCED',
      );
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.domElement.setAttribute('aria-label', 'CQM2 4K Interactive Cosmos Viewport');
      renderer.domElement.tabIndex = 0;

      renderer.domElement.addEventListener('webglcontextlost', (ev) => {
        ev.preventDefault();
        this.contextLost = true;
      });
      renderer.domElement.addEventListener('webglcontextrestored', () => {
        this.contextLost = false;
      });

      this.container.innerHTML = '';
      this.container.appendChild(renderer.domElement);

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => this.resize());
          } else {
            this.resize();
          }
        });
        this.resizeObserver.observe(this.container);
      }
      this.resize();
    } catch {
      this.renderer = null;
    }
  }

  public applyQualityPreset(preset: RenderQualityPreset): void {
    this.qualityPreset = preset;
    if (!this.renderer || typeof window === 'undefined') return;
    const dpr = window.devicePixelRatio || 1;
    const targetDpr =
      preset === '4K_ULTRA'
        ? Math.min(dpr, 2.5)
        : preset === 'HIGH'
          ? Math.min(dpr, 2.0)
          : preset === 'MOBILE_ECO'
            ? Math.min(dpr, 1.15)
            : Math.min(dpr, 1.65);
    this.renderer.setPixelRatio(targetDpr);
    // Hide outer ornamental shells on MOBILE_ECO to save fill-rate on phones
    for (let i = 0; i < this.mechShells.length; i++) {
      this.mechShells[i]!.visible = preset === 'MOBILE_ECO' ? i < 4 : true;
    }
    this.resize();
  }

  public applyVisualMode(mode: RenderVisualMode): void {
    this.visualMode = mode;
    const orgMat = this.organismMesh.material as THREE.MeshPhysicalMaterial;
    orgMat.wireframe = mode === 'WIREFRAME_CAD' || mode === 'CONNECTOME_XRAY';

    const bgHex =
      mode === 'BRUTAL_MONOCHROME'
        ? 0x09090b
        : mode === 'BIOLUM_NOCTURNE'
          ? 0x02040a
          : mode === 'SANCTUARY_BLOOM'
            ? 0x041311
            : 0x050913;
    this.scene.background = new THREE.Color(bgHex);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(bgHex);
    }

    for (let i = 0; i < this.mechShells.length; i++) {
      const m = this.mechShells[i]!.material as THREE.MeshPhysicalMaterial;
      m.wireframe = mode === 'WIREFRAME_CAD' || mode === 'BRUTAL_MONOCHROME' || i % 2 === 1 || i === 6;
      m.opacity = mode === 'CONNECTOME_XRAY' ? 0.1 : i % 2 === 1 ? 0.42 : 0.24;
    }
  }

  public applyCameraPreset(preset: CameraPresetId): void {
    this.followMode = 'NONE';
    switch (preset) {
      case 'OVERVIEW':
        this.camTarget.set(0, 2.5, 0);
        this.camRadius = 56.0;
        this.camTheta = 0.68;
        this.camPhi = 1.05;
        break;
      case 'KERR_HORIZON':
        this.camTarget.set(0, 7.5, 0);
        this.camRadius = 19.5;
        this.camTheta = 0.25;
        this.camPhi = 1.38;
        break;
      case 'ASMODENIUS_FOLLOW':
        this.followMode = 'ASMO';
        this.camRadius = 15.0;
        this.camPhi = 1.12;
        break;
      case 'GLITCHLING_FOLLOW':
        this.followMode = 'GLITCH';
        this.camRadius = 15.0;
        this.camPhi = 1.12;
        break;
      case 'XYLOS_MEDUSA':
        this.followMode = 'XYLOS';
        this.camRadius = 14.0;
        this.camPhi = 1.15;
        break;
      case 'BIG_TREE_SANCTUARY':
        this.camTarget.set(-18, 4.5, -18);
        this.camRadius = 26.0;
        this.camTheta = 0.85;
        this.camPhi = 1.12;
        break;
      case 'TOP_MANIFOLD':
        this.camTarget.set(0, 0, 0);
        this.camRadius = 78.0;
        this.camTheta = 0.0;
        this.camPhi = 0.22;
        break;
      case 'SHELL_CORE':
        this.camTarget.set(0, 7.5, 0);
        this.camRadius = 28.0;
        this.camTheta = 1.15;
        this.camPhi = 0.92;
        break;
    }
    this.updateCameraTransform();
  }

  /**
   * Minimal self-contained Khronos binary `.glb` (`0x46546C67`) viewport mesh loader!
   */
  public loadCustomGlbBytes(glbBytes: Uint8Array): boolean {
    if (glbBytes.byteLength < 28) return false;
    const dv = new DataView(glbBytes.buffer, glbBytes.byteOffset, glbBytes.byteLength);
    if (dv.getUint32(0, true) !== 0x46546c67) return false;

    const jsonLen = dv.getUint32(12, true);
    const jsonType = dv.getUint32(16, true);
    if (jsonType !== 0x4e4f534a || 20 + jsonLen > glbBytes.byteLength) return false;

    const jsonStr = new TextDecoder().decode(glbBytes.subarray(20, 20 + jsonLen));
    const doc = JSON.parse(jsonStr) as {
      accessors?: Array<{ bufferView: number; count: number; componentType: number; type: string }>;
      bufferViews?: Array<{ byteOffset?: number; byteLength: number }>;
      meshes?: Array<{ primitives?: Array<{ attributes: { POSITION?: number; NORMAL?: number }; indices?: number }> }>;
    };

    const binHeaderOff = 20 + jsonLen;
    if (binHeaderOff + 8 > glbBytes.byteLength) return false;
    const binLen = dv.getUint32(binHeaderOff, true);
    const binStart = binHeaderOff + 8;
    if (binStart + binLen > glbBytes.byteLength) return false;

    const prim = doc.meshes?.[0]?.primitives?.[0];
    const posAccIdx = prim?.attributes.POSITION;
    if (posAccIdx === undefined || !doc.accessors || !doc.bufferViews) return false;

    const posAcc = doc.accessors[posAccIdx]!;
    const posBv = doc.bufferViews[posAcc.bufferView]!;
    const posByteStart = binStart + (posBv.byteOffset ?? 0);
    const posFloats = new Float32Array(
      glbBytes.slice(posByteStart, posByteStart + posAcc.count * 12).buffer,
    );

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posFloats, 3));

    if (prim?.indices !== undefined) {
      const idxAcc = doc.accessors[prim.indices]!;
      const idxBv = doc.bufferViews[idxAcc.bufferView]!;
      const idxByteStart = binStart + (idxBv.byteOffset ?? 0);
      if (idxAcc.componentType === 5123) {
        const idxArr = new Uint16Array(glbBytes.slice(idxByteStart, idxByteStart + idxAcc.count * 2).buffer);
        geo.setIndex(new THREE.BufferAttribute(idxArr, 1));
      } else if (idxAcc.componentType === 5125) {
        const idxArr = new Uint32Array(glbBytes.slice(idxByteStart, idxByteStart + idxAcc.count * 4).buffer);
        geo.setIndex(new THREE.BufferAttribute(idxArr, 1));
      }
    }
    geo.computeVertexNormals();

    if (this.customLoadedMesh) {
      this.scene.remove(this.customLoadedMesh);
      this.customLoadedMesh.geometry.dispose();
    }
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.4,
      iridescence: 1.0,
    });
    this.customLoadedMesh = new THREE.Mesh(geo, mat);
    this.customLoadedMesh.position.set(8, 3.2, 8);
    this.scene.add(this.customLoadedMesh);
    return true;
  }

  public resize(): void {
    if (!this.renderer) return;
    const w = Math.max(280, this.container.clientWidth || 960);
    const h = Math.max(220, this.container.clientHeight || 540);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private updateCameraTransform(): void {
    const sinPhi = Math.sin(this.camPhi);
    this.camera.position.set(
      this.camTarget.x + this.camRadius * sinPhi * Math.sin(this.camTheta),
      this.camTarget.y + this.camRadius * Math.cos(this.camPhi),
      this.camTarget.z + this.camRadius * sinPhi * Math.cos(this.camTheta),
    );
    this.camera.lookAt(this.camTarget);
  }

  private bindCameraAndSelectionInput(): void {
    const el = this.renderer?.domElement;
    if (!el) return;

    el.addEventListener('pointerdown', (e) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointer events may not capture
      }
      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        this.prevPinchDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      }
    });

    el.addEventListener('pointermove', (e) => {
      const prev = this.activePointers.get(e.pointerId);
      if (!prev) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 1) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        this.camTheta -= dx * 0.0065;
        this.camPhi = Math.max(0.18, Math.min(1.48, this.camPhi - dy * 0.0065));
        this.updateCameraTransform();
      } else if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        if (this.prevPinchDist > 0) {
          const delta = this.prevPinchDist - dist;
          this.camRadius = Math.max(10.0, Math.min(155.0, this.camRadius + delta * 0.12));
          this.updateCameraTransform();
        }
        this.prevPinchDist = dist;
      }
    });

    const endPointer = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size < 2) this.prevPinchDist = 0;

      // Click-to-Inspect Organism via Raycaster when pointer movement < 5 px
      const moved = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (moved < 5 && this.onSelectEntity && this.organismMesh.count > 0) {
        const rect = el.getBoundingClientRect();
        this.pointerNdc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        this.pointerNdc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
        this.raycaster.setFromCamera(this.pointerNdc, this.camera);
        const hits = this.raycaster.intersectObject(this.organismMesh, false);
        if (hits.length > 0 && hits[0]!.instanceId !== undefined) {
          const entityId = this.instanceToEntityId[hits[0]!.instanceId] ?? -1;
          if (entityId >= 0) this.onSelectEntity(entityId);
        }
      }
    };
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.camRadius = Math.max(10.0, Math.min(155.0, this.camRadius + e.deltaY * 0.04));
        this.updateCameraTransform();
      },
      { passive: false },
    );

    // Drag-and-drop `.glb` file directly onto the 4K viewport
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.name.toLowerCase().endsWith('.glb')) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        this.loadCustomGlbBytes(bytes);
      }
    });

    el.addEventListener('keydown', (e) => {
      let handled = true;
      if (e.key === 'ArrowLeft' || e.key === 'a') this.camTheta += 0.08;
      else if (e.key === 'ArrowRight' || e.key === 'd') this.camTheta -= 0.08;
      else if (e.key === 'ArrowUp' || e.key === 'w') this.camPhi = Math.max(0.18, this.camPhi - 0.06);
      else if (e.key === 'ArrowDown' || e.key === 's') this.camPhi = Math.min(1.48, this.camPhi + 0.06);
      else if (e.key === '+' || e.key === '=') this.camRadius = Math.max(10.0, this.camRadius - 3.5);
      else if (e.key === '-' || e.key === '_') this.camRadius = Math.min(155.0, this.camRadius + 3.5);
      else if (e.key === '0') this.applyCameraPreset('OVERVIEW');
      else handled = false;
      if (handled) {
        e.preventDefault();
        this.updateCameraTransform();
      }
    });
  }

  private syncSkinTextureFromWorld(skinU?: Float32Array, skinV?: Float32Array): void {
    if (!skinU || !skinV || skinU.length < 576 || skinV.length < 576) return;
    for (let i = 0; i < 576; i++) {
      this.skinRgba[i * 4] = Math.max(0, Math.min(255, Math.round(skinU[i]! * 255)));
      this.skinRgba[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(skinV[i]! * 255)));
      this.skinRgba[i * 4 + 2] = 180;
      this.skinRgba[i * 4 + 3] = 255;
    }
    this.skinDataTexture.needsUpdate = true;
  }

  public renderFrame(params: {
    store: ErpRelationalStore;
    spinePtsXyz: Float32Array;
    simTimeSec: number;
    kerrSpinA: number;
    manifoldWarpGain: number;
    maxVisualPulseHz: number;
    shellAmplitudes10: number[];
    intendedVec: [number, number, number];
    executedVec: [number, number, number];
    skinUGs?: Float32Array;
    skinVGs?: Float32Array;
    asmodeniusConfidence?: number;
  }): void {
    if (!this.renderer || this.contextLost) return;

    const animTime = this.reducedMotion ? 0.0 : params.simTimeSec;
    const safePulse = Math.min(2.2, params.maxVisualPulseHz);

    this.kerrUniforms.uTime.value = animTime;
    this.kerrUniforms.uSpinA.value = params.kerrSpinA;
    this.kerrUniforms.uPulseHz.value = safePulse;
    this.manifoldUniforms.uTime.value = animTime;
    this.manifoldUniforms.uWarpGain.value = Math.min(0.45, params.manifoldWarpGain);
    this.skinUniforms.uTime.value = animTime;
    this.skinUniforms.uPulseHz.value = safePulse;
    this.skinUniforms.uConfidence.value = params.asmodeniusConfidence ?? 0.68;

    if (Math.floor(params.simTimeSec * 30) % 4 === 0) {
      this.syncSkinTextureFromWorld(params.skinUGs, params.skinVGs);
    }

    this.kerrBillboard.quaternion.copy(this.camera.quaternion);

    // Animate 10 Parametric Mechalogodrom Shells & Quadrant Singularities
    if (!this.reducedMotion) {
      for (let s = 0; s < this.mechShells.length; s++) {
        const shell = this.mechShells[s]!;
        const amp = params.shellAmplitudes10[s] ?? 0.5;
        shell.rotation.x += 0.0028 * (s % 2 === 0 ? 1 : -1) * (1.0 + Math.abs(amp));
        shell.rotation.y += 0.0042 * (1.0 + 0.05 * s);
      }
      for (let q = 0; q < this.quadrantBeacons.length; q++) {
        this.quadrantBeacons[q]!.rotation.y += 0.012 * (q % 2 === 0 ? 1 : -1);
      }
      for (let p = 0; p < this.sanctuaryPods.length; p++) {
        this.sanctuaryPods[p]!.position.y = 7.6 + 0.25 * Math.sin(animTime * 1.6 + p);
      }
    }

    // Update Instanced Organism Population directly from SoA buffers
    const { store } = params;
    let visibleIdx = 0;
    for (let e = 0; e < store.activeCount; e++) {
      if (store.alive[e] !== 1) continue;
      this.instanceToEntityId[visibleIdx] = e;
      this.dummyPos.set(store.posX[e]!, store.posY[e]!, store.posZ[e]!);
      this.dummyEuler.set(0, -store.headingRad[e]! + Math.PI / 2, 0);
      this.dummyQuat.setFromEuler(this.dummyEuler);
      const atpVal = store.pools15[e * 15 + 12]!;
      const atpScale = 0.85 + 0.35 * Math.min(1.5, atpVal / 8.0);
      this.dummyScale.setScalar(e <= 2 ? atpScale * 1.45 : atpScale);
      this.dummyMatrix.compose(this.dummyPos, this.dummyQuat, this.dummyScale);
      this.organismMesh.setMatrixAt(visibleIdx, this.dummyMatrix);

      if (this.visualMode === 'BRUTAL_MONOCHROME') {
        this.dummyColor.setHSL(0, 0, e <= 2 ? 0.95 : 0.65);
      } else if (this.visualMode === 'METABOLIC_THERMAL') {
        const heat = Math.max(0, Math.min(1, atpVal / 12.0));
        this.dummyColor.setHSL(0.66 - 0.66 * heat, 0.95, 0.55);
      } else if (this.visualMode === 'QUANTUM_PHASE') {
        const phaseHue = (((store.thoughtCurvatureKappa[e] ?? 0) * 2.5 + e * 0.03) % 1 + 1) % 1;
        this.dummyColor.setHSL(phaseHue, 0.9, 0.6);
      } else {
        const sp = store.species.get(store.speciesFk[e]!);
        const hue = ((sp?.baseHueDeg ?? 195) % 360) / 360;
        this.dummyColor.setHSL(hue, e === 1 ? 0.95 : 0.78, e === 0 ? 0.68 : 0.54);
      }
      this.organismMesh.setColorAt(visibleIdx, this.dummyColor);
      visibleIdx++;
    }
    this.organismMesh.count = visibleIdx;
    this.organismMesh.instanceMatrix.needsUpdate = true;
    if (this.organismMesh.instanceColor) this.organismMesh.instanceColor.needsUpdate = true;

    // Update Asmodenius Prime 8-Somite Spine & 14-Region Connectome Arc
    for (let i = 0; i < 8; i++) {
      this.asmoSomites[i]!.position.set(
        params.spinePtsXyz[i * 3]!,
        params.spinePtsXyz[i * 3 + 1]!,
        params.spinePtsXyz[i * 3 + 2]!,
      );
    }
    const headX = params.spinePtsXyz[0]!;
    const headY = params.spinePtsXyz[1]! + 1.1;
    const headZ = params.spinePtsXyz[2]!;
    for (let r = 0; r < 15; r++) {
      const ang = (r / 14) * Math.PI * 2;
      this.connectomePositions[r * 3] = headX + Math.cos(ang) * 1.15;
      this.connectomePositions[r * 3 + 1] = headY + 0.25 * Math.sin(ang * 3 + animTime * 2.0);
      this.connectomePositions[r * 3 + 2] = headZ + Math.sin(ang) * 1.15;
    }
    (this.connectomeLine.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    // Update Xylos v2 Hyperbolic Medusa anchored on Entity 2 (or orbital path)
    if (store.activeCount > 2 && store.alive[2] === 1) {
      this.xylosGroup.position.set(store.posX[2]!, store.posY[2]! + 2.2, store.posZ[2]!);
    }
    for (let t = 0; t < this.xylosTentacles.length; t++) {
      const buf = this.xylosTentacleBuffers[t]!;
      const baseAng = (t / 7) * Math.PI * 2;
      for (let seg = 0; seg < 8; seg++) {
        const frac = seg / 7;
        const rad = 0.85 * (1.0 - frac * 0.35);
        const wave = this.reducedMotion ? 0 : 0.22 * frac * Math.sin(animTime * 2.4 - seg * 0.6 + t);
        buf[seg * 3] = Math.cos(baseAng) * rad + wave;
        buf[seg * 3 + 1] = -frac * 2.6;
        buf[seg * 3 + 2] = Math.sin(baseAng) * rad + wave;
      }
      (this.xylosTentacles[t]!.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    // Update Camera Follow Targets
    if (this.followMode === 'ASMO') {
      this.camTarget.set(headX, headY - 0.5, headZ);
      this.updateCameraTransform();
    } else if (this.followMode === 'GLITCH' && store.activeCount > 1 && store.alive[1] === 1) {
      this.camTarget.set(store.posX[1]!, store.posY[1]! + 1.0, store.posZ[1]!);
      this.updateCameraTransform();
    } else if (this.followMode === 'XYLOS') {
      this.camTarget.copy(this.xylosGroup.position);
      this.updateCameraTransform();
    }

    // Update Glossodrom S^3 -> R^3 Zooid Strand
    const sampleCw = Uint8Array.from([1, 4, 9, 13, 2, 7, 11, 15, 3, 8, 12, 5, 10, 6, 14]);
    const pts = projectZooidStrandS3ToR3(sampleCw, animTime * 0.45);
    this.zooidPositions.set(pts);
    (this.zooidLine.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    // Update Glitchling Intended (Cyan) vs. Executed (Gold) Vectors anchored on Entity 1
    if (store.activeCount > 1 && store.alive[1] === 1) {
      const gx = store.posX[1]!;
      const gy = store.posY[1]! + 0.8;
      const gz = store.posZ[1]!;
      this.intendedArrow.position.set(gx, gy, gz);
      this.executedArrow.position.set(gx, gy, gz);

      const inDir = new THREE.Vector3(params.intendedVec[0], params.intendedVec[1], params.intendedVec[2]);
      if (inDir.lengthSq() > 1e-5) this.intendedArrow.setDirection(inDir.normalize());

      const exDir = new THREE.Vector3(params.executedVec[0], params.executedVec[1], params.executedVec[2]);
      if (exDir.lengthSq() > 1e-5) this.executedArrow.setDirection(exDir.normalize());
    }

    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.resizeObserver?.disconnect();
    this.skinDataTexture.dispose();
    this.renderer?.dispose();
  }
}
