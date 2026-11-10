/**
 * CQM2 4K Zero-GC Instanced Three.js Scene & Relativistic Observatory Renderer.
 * Architectural Advances over CQM1:
 *   - Uses a single `THREE.InstancedMesh` fed directly from ERP SoA TypedArrays (zero per-entity `THREE.Mesh` heap objects!).
 *   - Supports true `3840x2160` 4K UHD pixel-ratio scaling with adaptive quality presets (`4K_ULTRA`, `BALANCED`, `MOBILE_ECO`).
 *   - Renders Kerr $g^4$ Photon-Ring Singularity, 10-Shell Central Mechalogodrom, Lipschitz 4D $\kappa$ Manifold Grid,
 *     Asmodenius Prime 8-somite articulated spine, Glossodrom $S^3$ Zooid strand, and Glitchling Intended vs Executed vectors!
 *   - Handles `webglcontextlost` / `webglcontextrestored` gracefully without crashing!
 */
import * as THREE from 'three';
import type { ErpRelationalStore } from '../erp/relational-store';
import { projectZooidStrandS3ToR3 } from '../quantum/xenolinguistics';
import {
  KERR_SINGULARITY_FRAGMENT_SHADER,
  KERR_SINGULARITY_VERTEX_SHADER,
  MANIFOLD_GRID_FRAGMENT_SHADER,
  MANIFOLD_GRID_VERTEX_SHADER,
} from './shaders';

export type RenderQualityPreset = '4K_ULTRA' | 'BALANCED' | 'MOBILE_ECO';

export class Cqm2Scene4kRenderer {
  private readonly container: HTMLElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  // Instanced organism swarm (1 draw call for up to 50,000 creatures!)
  private readonly organismMesh: THREE.InstancedMesh;
  private readonly dummyMatrix = new THREE.Matrix4();
  private readonly dummyPos = new THREE.Vector3();
  private readonly dummyQuat = new THREE.Quaternion();
  private readonly dummyEuler = new THREE.Euler();
  private readonly dummyScale = new THREE.Vector3();
  private readonly dummyColor = new THREE.Color();

  // Central Kerr Singularity + 10-Shell Mechalogodrom
  private readonly kerrUniforms: {
    uTime: { value: number };
    uSpinA: { value: number };
    uPulseHz: { value: number };
  };
  private readonly manifoldUniforms: {
    uWarpGain: { value: number };
    uTime: { value: number };
  };
  private readonly kerrBillboard: THREE.Mesh;
  private readonly mechShells: THREE.Mesh[] = [];

  // Asmodenius 8-somite articulated spine + Glossodrom S3 Zooid strand + Glitchling Intended/Executed arrows
  private readonly asmoSomites: THREE.Mesh[] = [];
  private readonly zooidLine: THREE.Line;
  private readonly zooidPositions = new Float32Array(15 * 3);
  private readonly intendedArrow: THREE.ArrowHelper;
  private readonly executedArrow: THREE.ArrowHelper;

  // Interactive spherical camera orbit state (zero external OrbitControls bloat needed)
  private camRadius = 56.0;
  private camTheta = 0.68;
  private camPhi = 1.05;
  private camTarget = new THREE.Vector3(0, 2.5, 0);
  private isPointerDragging = false;
  private prevPointerX = 0;
  private prevPointerY = 0;

  public contextLost = false;
  public qualityPreset: RenderQualityPreset = 'BALANCED';
  private resizeObserver: ResizeObserver | null = null;

  public constructor(container: HTMLElement, maxInstances = 2048) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050913);
    this.scene.fog = new THREE.FogExp2(0x050913, 0.0068);

    const w = Math.max(320, container.clientWidth || 1280);
    const h = Math.max(240, container.clientHeight || 720);
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.2, 420);
    this.updateCameraTransform();

    // Studio & Bioluminescent Abyssal Lighting
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x091326, 1.15);
    this.scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 1.65);
    keyLight.position.set(28, 45, 24);
    this.scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xfbbf24, 2.4, 85, 1.4);
    rimLight.position.set(0, 8, 0);
    this.scene.add(rimLight);

    // 1. Lipschitz-Guarded 4D Non-Euclidean Manifold Floor Grid
    this.manifoldUniforms = {
      uWarpGain: { value: 0.22 },
      uTime: { value: 0.0 },
    };
    const gridGeo = new THREE.PlaneGeometry(160, 160, 96, 96);
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

    // 2. Central Kerr Photon-Ring Singularity Billboard
    this.kerrUniforms = {
      uTime: { value: 0.0 },
      uSpinA: { value: 0.84 },
      uPulseHz: { value: 1.8 },
    };
    const kerrGeo = new THREE.PlaneGeometry(15, 15);
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

    // 3. 10-Shell Central Mechalogodrom Gyroscopic Rings
    const shellMatBase = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x075985,
      emissiveIntensity: 0.45,
      metalness: 0.65,
      roughness: 0.22,
      iridescence: 0.9,
      iridescenceIOR: 1.83,
      transparent: true,
      opacity: 0.48,
    });
    for (let s = 0; s < 10; s++) {
      const ringRadius = 4.2 + s * 0.95;
      const torusGeo = new THREE.TorusGeometry(ringRadius, 0.045, 10, 64);
      const mesh = new THREE.Mesh(torusGeo, shellMatBase);
      mesh.position.set(0, 7.5, 0);
      mesh.rotation.set(s * 0.31, s * 0.47, 0);
      this.scene.add(mesh);
      this.mechShells.push(mesh);
    }

    // 4. Instanced Organism Population (`THREE.InstancedMesh` with Guanine Thin-Film Iridescence!)
    const orgGeo = new THREE.ConeGeometry(0.36, 1.35, 10);
    orgGeo.rotateX(Math.PI / 2);
    const orgMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.25,
      roughness: 0.24,
      iridescence: 1.0,
      iridescenceIOR: 1.83, // Crystalline guanine platelets
      clearcoat: 0.8,
    });
    this.organismMesh = new THREE.InstancedMesh(orgGeo, orgMat, maxInstances);
    this.organismMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.organismMesh.count = 0;
    this.scene.add(this.organismMesh);

    // 5. Asmodenius Prime Articulated 8-Somite Hero Body
    const asmoMat = new THREE.MeshPhysicalMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.55,
      metalness: 0.3,
      roughness: 0.18,
      iridescence: 1.0,
      iridescenceIOR: 1.83,
    });
    for (let i = 0; i < 8; i++) {
      const r = 0.46 * Math.sin(Math.max(0.15, (i + 0.6) / 8.2) * Math.PI) + 0.1;
      const somiteGeo = new THREE.SphereGeometry(r, 18, 14);
      const somite = new THREE.Mesh(somiteGeo, asmoMat);
      this.scene.add(somite);
      this.asmoSomites.push(somite);
    }

    // 6. Glossodrom 4D S^3 -> R^3 Bioluminescent Zooid Strand
    const zooidGeo = new THREE.BufferGeometry();
    zooidGeo.setAttribute('position', new THREE.BufferAttribute(this.zooidPositions, 3));
    const zooidMat = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.85 });
    this.zooidLine = new THREE.Line(zooidGeo, zooidMat);
    this.zooidLine.position.set(0, 7.5, 0);
    this.zooidLine.scale.setScalar(2.6);
    this.scene.add(this.zooidLine);

    // 7. Glitchling Intended (Cyan) vs. Executed (Gold) Trajectory Vectors
    this.intendedArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), 3.2, 0x38bdf8, 0.7, 0.4);
    this.executedArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 2, 0), 3.2, 0xfbbf24, 0.7, 0.4);
    this.scene.add(this.intendedArrow);
    this.scene.add(this.executedArrow);

    this.initWebGlRenderer();
    this.bindCameraInput();
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
      this.applyQualityPreset(window.innerWidth >= 2560 ? '4K_ULTRA' : window.innerWidth < 768 ? 'MOBILE_ECO' : 'BALANCED');
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
        this.resizeObserver = new ResizeObserver(() => this.resize());
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
      preset === '4K_ULTRA' ? Math.min(dpr, 2.5) : preset === 'MOBILE_ECO' ? Math.min(dpr, 1.25) : Math.min(dpr, 1.75);
    this.renderer.setPixelRatio(targetDpr);
    this.resize();
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

  private bindCameraInput(): void {
    const el = this.renderer?.domElement;
    if (!el) return;

    el.addEventListener('pointerdown', (e) => {
      this.isPointerDragging = true;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.isPointerDragging) return;
      const dx = e.clientX - this.prevPointerX;
      const dy = e.clientY - this.prevPointerY;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;
      this.camTheta -= dx * 0.0065;
      this.camPhi = Math.max(0.18, Math.min(1.48, this.camPhi - dy * 0.0065));
      this.updateCameraTransform();
    });
    const endDrag = () => {
      this.isPointerDragging = false;
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.camRadius = Math.max(12.0, Math.min(145.0, this.camRadius + e.deltaY * 0.04));
        this.updateCameraTransform();
      },
      { passive: false },
    );

    // Full keyboard accessibility on canvas (`Arrow` orbit, `+/-` zoom, `0` reset)!
    el.addEventListener('keydown', (e) => {
      let handled = true;
      if (e.key === 'ArrowLeft' || e.key === 'a') this.camTheta += 0.08;
      else if (e.key === 'ArrowRight' || e.key === 'd') this.camTheta -= 0.08;
      else if (e.key === 'ArrowUp' || e.key === 'w') this.camPhi = Math.max(0.18, this.camPhi - 0.06);
      else if (e.key === 'ArrowDown' || e.key === 's') this.camPhi = Math.min(1.48, this.camPhi + 0.06);
      else if (e.key === '+' || e.key === '=') this.camRadius = Math.max(12.0, this.camRadius - 3.5);
      else if (e.key === '-' || e.key === '_') this.camRadius = Math.min(145.0, this.camRadius + 3.5);
      else if (e.key === '0') {
        this.camRadius = 56.0;
        this.camTheta = 0.68;
        this.camPhi = 1.05;
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        this.updateCameraTransform();
      }
    });
  }

  /**
   * Zero-GC frame update reading directly from ERP SoA typed arrays and rendering in a single instanced pass.
   */
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
  }): void {
    if (!this.renderer || this.contextLost) return;

    this.kerrUniforms.uTime.value = params.simTimeSec;
    this.kerrUniforms.uSpinA.value = params.kerrSpinA;
    this.kerrUniforms.uPulseHz.value = Math.min(2.2, params.maxVisualPulseHz);
    this.manifoldUniforms.uTime.value = params.simTimeSec;
    this.manifoldUniforms.uWarpGain.value = Math.min(0.45, params.manifoldWarpGain);

    this.kerrBillboard.quaternion.copy(this.camera.quaternion);

    // Animate 10-Shell Central Mechalogodrom
    for (let s = 0; s < this.mechShells.length; s++) {
      const shell = this.mechShells[s]!;
      const amp = params.shellAmplitudes10[s] ?? 0.5;
      shell.rotation.x += 0.004 * (s % 2 === 0 ? 1 : -1) * (1.0 + Math.abs(amp));
      shell.rotation.y += 0.006 * (1.0 + 0.5 * s * 0.1);
    }

    // Update Instanced Organism Population directly from SoA buffers
    const { store } = params;
    let visibleIdx = 0;
    for (let e = 0; e < store.activeCount; e++) {
      if (store.alive[e] !== 1) continue;
      this.dummyPos.set(store.posX[e]!, store.posY[e]!, store.posZ[e]!);
      this.dummyEuler.set(0, -store.headingRad[e]! + Math.PI / 2, 0);
      this.dummyQuat.setFromEuler(this.dummyEuler);
      const atpScale = 0.85 + 0.35 * Math.min(1.5, store.pools15[e * 15 + 12]! / 8.0);
      this.dummyScale.setScalar(e <= 1 ? atpScale * 1.45 : atpScale);
      this.dummyMatrix.compose(this.dummyPos, this.dummyQuat, this.dummyScale);
      this.organismMesh.setMatrixAt(visibleIdx, this.dummyMatrix);

      const sp = store.species.get(store.speciesFk[e]!);
      const hue = ((sp?.baseHueDeg ?? 195) % 360) / 360;
      const sat = e === 1 ? 0.95 : 0.78;
      const light = e === 0 ? 0.68 : 0.54;
      this.dummyColor.setHSL(hue, sat, light);
      this.organismMesh.setColorAt(visibleIdx, this.dummyColor);
      visibleIdx++;
    }
    this.organismMesh.count = visibleIdx;
    this.organismMesh.instanceMatrix.needsUpdate = true;
    if (this.organismMesh.instanceColor) this.organismMesh.instanceColor.needsUpdate = true;

    // Update Asmodenius Prime 8-Somite Spine
    for (let i = 0; i < 8; i++) {
      this.asmoSomites[i]!.position.set(
        params.spinePtsXyz[i * 3]!,
        params.spinePtsXyz[i * 3 + 1]!,
        params.spinePtsXyz[i * 3 + 2]!,
      );
    }

    // Update Glossodrom S^3 -> R^3 Zooid Strand
    const sampleCw = Uint8Array.from([1, 4, 9, 13, 2, 7, 11, 15, 3, 8, 12, 5, 10, 6, 14]);
    const pts = projectZooidStrandS3ToR3(sampleCw, params.simTimeSec * 0.45);
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
    this.renderer?.dispose();
  }
}
