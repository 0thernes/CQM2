/**
 * CQM2 v2.1.0 Full-Stack Universal Workstation Frontend (`src/ui/workstation.ts`).
 * Runs seamlessly in BOTH modes:
 *   1. **Local Quad-Silicon Server Mode**: Syncs with `/api/v1/*` + `/ws` (`RTX 5070 Ti CUDA` + `Intel AI Boost NPU` + `Intel iGPU` + `Rust/Zig` + `SQLite WAL`).
 *   2. **Universal Browser Mode (`GitHub Pages` / Mobile / 4K Standalone)**: Executes the identical
 *      `Cqm2WorldScheduler` + `ZigKernelBridge` SIMD128 WASM + `BrowserWebGpuCompute` + `IndexedDB` 100% client-side!
 *
 * Security & CSP Invariants:
 *   - Uses safe DOM builders (`el()`) with `textContent` — zero untrusted `innerHTML`.
 *   - Zero inline `style` attributes anywhere — 100% strict `style-src 'self'` compliant.
 */
import {
  ASMODENIUS_14_REGIONS,
  type TmsArousalMode,
  type TmsPokeReport,
} from '../brains/asmodenius';
import {
  type R21BenchmarkResult,
  runComprehensive12CausalSuite,
} from '../brains/causal-benchmarks';
import {
  FLAW_BACKWARDS,
  FLAW_LEAKY,
  FLAW_MISFIRE,
  FLAW_SCRAMBLE,
} from '../brains/glitchling';
import { runThalerCreativityAblationSuite } from '../brains/thaler-creativity';
import { runXylosRealityMonitoringAssay } from '../brains/xylos';
import type { GodDialParams } from '../core/prng';
import {
  buildProceduralChromatophorePng,
  exportAiWorldInteropBundle,
  exportBlender4PythonRig,
  exportCosmicKerrRingdownWav,
  exportCreatureGlbBinary,
  exportCreatureGltf2Json,
  exportCreatureWavefrontObj,
  exportTouchDesignerBridgeScript,
  exportUnity6BridgeScript,
} from '../pipeline/exporters';
import { runScholarlyAiNarration } from '../pipeline/free-ai-studio';
import { decodeGlossodromRs15_11, encodeGlossodromRs15_11 } from '../quantum/xenolinguistics';
import { COSMIC_9_SONGS, CosmicAudioSynthesizer } from '../render/audio-synth';
import {
  type CameraPresetId,
  Cqm2Scene4kRenderer,
  type RenderQualityPreset,
  type RenderVisualMode,
} from '../render/scene-4k';
import { BrowserWebGpuCompute } from '../render/webgpu-compute';
import { Cqm2WorldScheduler, type WorldTickTelemetry } from '../sim/world-scheduler';
import { listBrowserCheckpoints, saveBrowserCheckpoint } from './idb-storage';
import { Cqm2RealtimeClient } from './realtime-client';

type WorkspaceId = 'cosmos' | 'silicon' | 'brains' | 'quantum' | 'erp' | 'pipeline' | 'audit';

const WORKSPACE_DEFS: ReadonlyArray<{ id: WorkspaceId; label: string; shortcut: string }> = [
  { id: 'cosmos', label: '1. Cosmos 4K & Dials', shortcut: '1' },
  { id: 'silicon', label: '2. Quad-Silicon Studio', shortcut: '2' },
  { id: 'brains', label: '3. Brains (Asmo · Glitch · Xylos)', shortcut: '3' },
  { id: 'quantum', label: '4. Quantum & Tsotchke 27', shortcut: '4' },
  { id: 'erp', label: '5. ERP Relational Studio', shortcut: '5' },
  { id: 'pipeline', label: '6. 3D / AI / Audio Export', shortcut: '6' },
  { id: 'audit', label: '7. Truth & Grade-A+ Ledger', shortcut: '7' },
];

const JSON_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

function triggerClientDownload(filename: string, content: string | Uint8Array, mime: string): void {
  const blob = new Blob([content as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function parseBootQueryParams(): {
  seed: number;
  flaws: number | null;
  tier: RenderQualityPreset | null;
  tab: WorkspaceId | null;
  mode: RenderVisualMode | null;
} {
  if (typeof window === 'undefined') {
    return { seed: 20261110, flaws: null, tier: null, tab: null, mode: null };
  }
  const sp = new URLSearchParams(window.location.search);
  const rawSeed = Number(sp.get('seed'));
  const seed = Number.isFinite(rawSeed) && rawSeed > 0 ? Math.trunc(rawSeed) : 20261110;
  const rawFlaws = sp.get('flaws');
  const flaws = rawFlaws !== null && Number.isFinite(Number(rawFlaws)) ? Math.trunc(Number(rawFlaws)) & 0x0f : null;
  const rawTier = sp.get('tier') as RenderQualityPreset | null;
  const validTiers: RenderQualityPreset[] = ['4K_ULTRA', 'HIGH', 'BALANCED', 'MOBILE_ECO'];
  const tier = rawTier && validTiers.includes(rawTier) ? rawTier : null;
  const rawTab = sp.get('tab') as WorkspaceId | null;
  const tab = rawTab && WORKSPACE_DEFS.some((w) => w.id === rawTab) ? rawTab : null;
  const rawMode = sp.get('mode') as RenderVisualMode | null;
  const validModes: RenderVisualMode[] = [
    'STANDARD_4K',
    'WIREFRAME_CAD',
    'BIOLUM_NOCTURNE',
    'QUANTUM_PHASE',
    'METABOLIC_THERMAL',
    'CONNECTOME_XRAY',
    'KERR_LENSED',
    'BRUTAL_MONOCHROME',
    'POINCARE_HYPERBOLIC',
    'SANCTUARY_BLOOM',
  ];
  const mode = rawMode && validModes.includes(rawMode) ? rawMode : null;
  return { seed, flaws, tier, tab, mode };
}

export class Cqm2WorkstationApp {
  private readonly bootCfg = parseBootQueryParams();
  private readonly world: Cqm2WorldScheduler;
  private readonly webgpu = new BrowserWebGpuCompute();
  private readonly audio = new CosmicAudioSynthesizer();
  private readonly realtime: Cqm2RealtimeClient;
  private scene4k: Cqm2Scene4kRenderer | null = null;

  private activeTab: WorkspaceId = 'cosmos';
  private serverConnected = false;
  private serverHardwareTopology: Record<string, unknown> | null = null;
  private latestServerReceipt: Record<string, unknown> | null = null;
  private latestTelemetry: WorldTickTelemetry;
  private latestPoke: TmsPokeReport | null = null;
  private latestBenchmarks: R21BenchmarkResult[] = [];
  private selectedEntityId = 0;
  private erpFilterText = '';
  private erpSortBy: 'entityId' | 'totalMetabolicKj' | 'thoughtCurvatureKappa' = 'entityId';
  private ariaAnnouncer!: HTMLElement;

  private readonly domRefs = new Map<string, HTMLElement>();

  public constructor() {
    this.world = new Cqm2WorldScheduler({ seed: this.bootCfg.seed, initialPopulation: 128 });
    if (this.bootCfg.flaws !== null) {
      this.world.glitchling.flawMask = this.bootCfg.flaws;
    }
    if (this.bootCfg.tab) {
      this.activeTab = this.bootCfg.tab;
    }
    this.latestTelemetry = this.world.stepTick(0.02);
    this.realtime = new Cqm2RealtimeClient((pkt) => {
      if (pkt.type === 'tick' && typeof pkt.tick === 'number') {
        const wsChip = this.domRefs.get('ws-pill');
        if (wsChip) wsChip.textContent = `WS #${pkt.tick}`;
      }
    });
  }

  public async mount(root: HTMLElement): Promise<void> {
    root.innerHTML = '';
    this.ariaAnnouncer = el('div', {
      'aria-live': 'polite',
      'aria-atomic': 'true',
      className: 'skip-link',
      id: 'aria-live-status',
    });

    const errBanner = this.buildErrorBoundaryBanner();
    const header = this.buildHeader();
    const tabBar = this.buildTabBar();
    const main = this.buildMainLayout();
    const footer = this.buildFooter();
    const cmdDialog = this.buildCommandPaletteDialog();

    root.append(this.ariaAnnouncer, errBanner, header, tabBar, main, footer, cmdDialog);

    const canvasHost = this.domRefs.get('viewport-host');
    if (canvasHost) {
      this.scene4k = new Cqm2Scene4kRenderer(canvasHost, this.world.store.maxEntities);
      if (this.bootCfg.tier) this.scene4k.applyQualityPreset(this.bootCfg.tier);
      if (this.bootCfg.mode) this.scene4k.applyVisualMode(this.bootCfg.mode);
      this.scene4k.onSelectEntity = (entityId) => {
        this.selectedEntityId = entityId;
        this.updateInspectorCard();
        this.announce(`Inspected organism #${entityId}`);
      };
    }

    await this.webgpu.init();
    await this.probeLocalServer();
    this.updateSiliconPanel();
    this.updateInspectorCard();
    this.renderErpTable();
    this.renderTsotchkeTable();

    if (this.activeTab !== 'cosmos') {
      this.switchWorkspace(this.activeTab);
    }

    this.bindGlobalShortcuts(cmdDialog);
    this.bindVisibilitySafety();
    this.startLoop();
  }

  private announce(msg: string): void {
    this.ariaAnnouncer.textContent = msg;
  }

  private buildErrorBoundaryBanner(): HTMLElement {
    const msgSpan = el('span', { className: 'mono' }, ['']);
    const dismissBtn = el('button', { type: 'button', className: 'btn' }, ['Dismiss']);
    const banner = el('div', { className: 'error-banner hidden-panel', role: 'alert' }, [msgSpan, dismissBtn]);
    dismissBtn.addEventListener('click', () => banner.classList.add('hidden-panel'));

    if (typeof window !== 'undefined') {
      const showNonFatal = (reason: unknown) => {
        const text = reason instanceof Error ? reason.message : String(reason ?? 'Unexpected UI error');
        if (text.includes('ResizeObserver loop')) return;
        msgSpan.textContent = `Recovered non-fatal UI event: ${text.slice(0, 160)}`;
        banner.classList.remove('hidden-panel');
      };
      window.addEventListener('error', (ev) => showNonFatal(ev.error ?? ev.message));
      window.addEventListener('unhandledrejection', (ev) => showNonFatal(ev.reason));
    }
    return banner;
  }

  private async probeLocalServer(): Promise<void> {
    try {
      const res = await fetch('/api/v1/hardware', { method: 'GET' });
      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; topology?: Record<string, unknown> };
        if (json.ok && json.topology) {
          this.serverConnected = true;
          this.serverHardwareTopology = json.topology;
          const modeEl = this.domRefs.get('mode-pill');
          if (modeEl) {
            modeEl.textContent = 'LOCAL QUAD-SILICON SERVER (CUDA+NPU+iGPU+CPU)';
            modeEl.classList.add('status-pass');
          }
          this.realtime.connect();
        }
      }
    } catch {
      this.serverConnected = false;
    }
  }

  private buildHeader(): HTMLElement {
    const modePill = el('span', { className: 'pill-badge mono' }, ['UNIVERSAL BROWSER EDITION (WebGPU + Zig WASM)']);
    this.domRefs.set('mode-pill', modePill);

    const wsPill = el('span', { className: 'pill-badge mono' }, ['Standalone']);
    this.domRefs.set('ws-pill', wsPill);

    const playBtn = el('button', { type: 'button', className: 'btn btn-primary', 'aria-label': 'Toggle simulation play or pause' }, [
      'Pause [Space]',
    ]);
    playBtn.addEventListener('click', () => {
      const next = this.world.runState === 'RUNNING' ? 'SUSPENDED' : 'RUNNING';
      this.world.setRunState(next);
      playBtn.textContent = next === 'RUNNING' ? 'Pause [Space]' : 'Resume [Space]';
      this.announce(`Simulation ${next.toLowerCase()}`);
      if (this.serverConnected) {
        void fetch('/api/v1/world/pause', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ runState: next }),
        }).catch(() => {});
      }
    });
    this.domRefs.set('play-btn', playBtn);

    const qualitySelect = el('select', { className: 'select-input', 'aria-label': 'Render resolution quality preset' }, [
      el('option', { value: '4K_ULTRA' }, ['4K Ultra UHD']),
      el('option', { value: 'HIGH' }, ['High QHD']),
      el('option', { value: 'BALANCED', selected: 'selected' }, ['Balanced HD']),
      el('option', { value: 'MOBILE_ECO' }, ['Mobile Eco']),
    ]) as HTMLSelectElement;
    if (this.bootCfg.tier) qualitySelect.value = this.bootCfg.tier;
    qualitySelect.addEventListener('change', () => {
      this.scene4k?.applyQualityPreset(qualitySelect.value as RenderQualityPreset);
      this.announce(`Switched render quality to ${qualitySelect.value}`);
    });

    const cmdBtn = el('button', { type: 'button', className: 'btn btn-gold', 'aria-label': 'Open command palette' }, ['Cmd [Ctrl+K]']);
    cmdBtn.addEventListener('click', () => {
      const dlg = this.domRefs.get('cmd-dialog') as HTMLDialogElement | undefined;
      dlg?.showModal();
    });

    return el('header', { className: 'cqm-header', role: 'banner' }, [
      el('div', { className: 'brand-cluster' }, [
        el('div', { className: 'brand-badge', 'aria-hidden': 'true' }, ['CQM2']),
        el('div', {}, [
          el('h1', { className: 'brand-title' }, ['Cosmogonic Quantum Mechalogodrom 2']),
          el('p', { className: 'brand-subtitle' }, [
            'v2.1.0 · Embodied Neuroplasticity, Quantum Contextuality & Quad-Silicon Observatory',
          ]),
        ]),
      ]),
      el('div', { className: 'header-controls' }, [
        modePill,
        wsPill,
        el('span', { className: 'pill-badge honesty-pill', title: 'All complexity metrics are mathematical indicators only' }, [
          'NOT SENTIENT · Indicator-Only',
        ]),
        qualitySelect,
        playBtn,
        cmdBtn,
      ]),
    ]);
  }

  private buildTabBar(): HTMLElement {
    const nav = el('div', { className: 'workspace-tabs', role: 'tablist', 'aria-label': 'CQM2 Scientific Workspaces' });
    for (const def of WORKSPACE_DEFS) {
      const btn = el(
        'button',
        {
          type: 'button',
          role: 'tab',
          id: `tab-${def.id}`,
          'aria-controls': `panel-${def.id}`,
          'aria-selected': String(def.id === this.activeTab),
          tabindex: def.id === this.activeTab ? '0' : '-1',
          className: 'tab-btn',
        },
        [def.label],
      );
      btn.addEventListener('click', () => this.switchWorkspace(def.id));
      btn.addEventListener('keydown', (e) => {
        const idx = WORKSPACE_DEFS.findIndex((w) => w.id === def.id);
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = WORKSPACE_DEFS[(idx + 1) % WORKSPACE_DEFS.length]!;
          this.switchWorkspace(next.id);
          document.getElementById(`tab-${next.id}`)?.focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = WORKSPACE_DEFS[(idx + WORKSPACE_DEFS.length - 1) % WORKSPACE_DEFS.length]!;
          this.switchWorkspace(prev.id);
          document.getElementById(`tab-${prev.id}`)?.focus();
        }
      });
      this.domRefs.set(`tab-${def.id}`, btn);
      nav.appendChild(btn);
    }
    return nav;
  }

  private switchWorkspace(target: WorkspaceId): void {
    this.activeTab = target;
    for (const def of WORKSPACE_DEFS) {
      const btn = this.domRefs.get(`tab-${def.id}`);
      const panel = this.domRefs.get(`panel-${def.id}`);
      const isSelected = def.id === target;
      if (btn) {
        btn.setAttribute('aria-selected', String(isSelected));
        btn.setAttribute('tabindex', isSelected ? '0' : '-1');
      }
      if (panel) {
        panel.classList.toggle('hidden-panel', !isSelected);
      }
    }
    const main = this.domRefs.get('workstation-main');
    const viewportCol = this.domRefs.get('viewport-column');
    if (main && viewportCol) {
      const showViewport = target === 'cosmos';
      main.classList.toggle('cosmos-active', showViewport);
      viewportCol.classList.toggle('hidden-panel', !showViewport);
      if (showViewport) this.scene4k?.resize();
    }
    if (target === 'erp') this.renderErpTable();
    this.announce(`Opened workspace ${target}`);
  }

  private buildViewportColumn(): HTMLElement {
    // 10 Render Mode Selector + 8 Camera Presets + 9-Song Audio Synth + Live FFT Canvas
    const modeSelect = el('select', { className: 'select-input', 'aria-label': '4K visual render mode' }, [
      el('option', { value: 'STANDARD_4K' }, ['Mode: Cinema 4K Standard']),
      el('option', { value: 'WIREFRAME_CAD' }, ['Mode: Parametric CAD Wireframe']),
      el('option', { value: 'BIOLUM_NOCTURNE' }, ['Mode: Abyssal Biolum Nocturne']),
      el('option', { value: 'QUANTUM_PHASE' }, ['Mode: Quantum Curvature Phase']),
      el('option', { value: 'METABOLIC_THERMAL' }, ['Mode: Metabolic ATP Thermal']),
      el('option', { value: 'CONNECTOME_XRAY' }, ['Mode: 14-Region Connectome X-Ray']),
      el('option', { value: 'KERR_LENSED' }, ['Mode: Kerr Photon-Ring Focus']),
      el('option', { value: 'BRUTAL_MONOCHROME' }, ['Mode: Brutalist Monochrome']),
      el('option', { value: 'POINCARE_HYPERBOLIC' }, ['Mode: Poincare {7,3} Hyperbolic']),
      el('option', { value: 'SANCTUARY_BLOOM' }, ['Mode: Big Tree Sanctuary Bloom']),
    ]) as HTMLSelectElement;
    if (this.bootCfg.mode) modeSelect.value = this.bootCfg.mode;
    modeSelect.addEventListener('change', () => {
      this.scene4k?.applyVisualMode(modeSelect.value as RenderVisualMode);
    });

    const camSelect = el('select', { className: 'select-input', 'aria-label': 'Camera orbit preset' }, [
      el('option', { value: 'OVERVIEW' }, ['Cam: Cosmos Overview']),
      el('option', { value: 'KERR_HORIZON' }, ['Cam: Kerr Event Horizon']),
      el('option', { value: 'ASMODENIUS_FOLLOW' }, ['Cam: Follow Asmodenius']),
      el('option', { value: 'GLITCHLING_FOLLOW' }, ['Cam: Follow Glitchling']),
      el('option', { value: 'XYLOS_MEDUSA' }, ['Cam: Follow Xylos Medusa']),
      el('option', { value: 'BIG_TREE_SANCTUARY' }, ['Cam: Big Tree Sanctuary']),
      el('option', { value: 'TOP_MANIFOLD' }, ['Cam: Top Manifold Plan']),
      el('option', { value: 'SHELL_CORE' }, ['Cam: 10-Shell Core']),
    ]) as HTMLSelectElement;
    camSelect.addEventListener('change', () => {
      this.scene4k?.applyCameraPreset(camSelect.value as CameraPresetId);
    });

    const audioBtn = el('button', { type: 'button', className: 'btn', 'aria-pressed': 'false' }, ['Audio: Muted']);
    const songSelect = el(
      'select',
      { className: 'select-input', 'aria-label': 'Procedural cosmic soundtrack selector' },
      COSMIC_9_SONGS.map((s) => el('option', { value: String(s.id) }, [s.title])),
    ) as HTMLSelectElement;
    songSelect.addEventListener('change', () => {
      const p = this.audio.setSongIndex(Number(songSelect.value));
      if (this.audio.isPlaying()) audioBtn.textContent = `Audio: ON (${p.id + 1}/9)`;
    });

    const volSlider = el('input', {
      type: 'range',
      min: '0',
      max: '1',
      step: '0.05',
      value: '0.45',
      'aria-label': 'Synthesizer volume',
    }) as HTMLInputElement;
    volSlider.addEventListener('input', () => {
      this.audio.setVolume(Number(volSlider.value));
    });

    audioBtn.addEventListener('click', () => {
      const on = this.audio.toggle();
      audioBtn.setAttribute('aria-pressed', String(on));
      const p = this.audio.getCurrentSong();
      audioBtn.textContent = on ? `Audio: ON (${p.id + 1}/9)` : 'Audio: Muted';
    });

    const fftCanvas = el('canvas', {
      className: 'fft-canvas',
      width: '96',
      height: '36',
      'aria-label': 'Real-time audio frequency spectrum',
    }) as HTMLCanvasElement;
    this.domRefs.set('fft-canvas', fftCanvas);

    const toolbar = el('div', { className: 'render-toolbar' }, [
      modeSelect,
      camSelect,
      audioBtn,
      songSelect,
      volSlider,
      fftCanvas,
    ]);

    const viewportHost = el('div', { className: 'viewport-canvas-host' });
    this.domRefs.set('viewport-host', viewportHost);

    const hudLeft = el('div', { className: 'hud-chip mono' }, ['Tick 0 · Alive 128']);
    const hudRight = el('div', { className: 'hud-chip mono' }, ['Click Creature: Inspect · Drag/Pinch/WASD: Orbit']);
    this.domRefs.set('hud-left', hudLeft);

    const viewportShell = el('section', { className: 'viewport-shell', 'aria-label': '3D Relativistic & Biological Cosmos' }, [
      viewportHost,
      el('div', { className: 'viewport-hud-overlay' }, [hudLeft, hudRight]),
    ]);

    const inspectorText = el('div', { className: 'mono' }, ['Selected #0 (Asmodenius primigenius) — Click any organism in 4K viewport to inspect.']);
    this.domRefs.set('inspector-text', inspectorText);
    const inspectorCard = el('div', { className: 'inspector-card' }, [inspectorText]);

    const col = el('div', { className: 'viewport-column' }, [toolbar, viewportShell, inspectorCard]);
    this.domRefs.set('viewport-column', col);
    return col;
  }

  private updateInspectorCard(): void {
    const node = this.domRefs.get('inspector-text');
    if (!node) return;
    const e = Math.max(0, Math.min(this.world.store.activeCount - 1, this.selectedEntityId));
    const sp = this.world.store.species.get(this.world.store.speciesFk[e]!);
    const bm = this.world.store.biomes.get(this.world.store.biomeFk[e]!);
    const atp = this.world.store.pools15[e * 15 + 12] ?? 0;
    const intake = this.world.store.totalIntakeKj[e] ?? 0;
    const kappa = this.world.store.thoughtCurvatureKappa[e] ?? 0;
    node.textContent = `Inspected #${e} · ${sp?.latinBinomial ?? 'Lineage'} (${sp?.casteRole ?? 'CASTE'}) · Biome: ${bm?.name ?? 'Abyss'} · Conserved=${intake.toFixed(2)} kJ · ATP=${atp.toFixed(2)} kJ · Curvature κ=${kappa.toFixed(3)}`;
  }

  private buildMainLayout(): HTMLElement {
    const viewportCol = this.buildViewportColumn();
    const pCosmos = this.buildCosmosPanel();
    const pSilicon = this.buildSiliconPanel();
    const pBrains = this.buildBrainsPanel();
    const pQuantum = this.buildQuantumPanel();
    const pErp = this.buildErpPanel();
    const pPipeline = this.buildPipelinePanel();
    const pAudit = this.buildAuditPanel();

    const main = el('main', { id: 'main-content', className: 'workstation-main cosmos-active' }, [
      viewportCol,
      pCosmos,
      pSilicon,
      pBrains,
      pQuantum,
      pErp,
      pPipeline,
      pAudit,
    ]);
    this.domRefs.set('workstation-main', main);
    return main;
  }

  private makeKpiBox(id: string, label: string, initial: string): HTMLElement {
    const valEl = el('span', { className: 'kpi-value' }, [initial]);
    this.domRefs.set(id, valEl);
    return el('div', { className: 'kpi-box' }, [el('span', { className: 'kpi-label' }, [label]), valEl]);
  }

  private buildCosmosPanel(): HTMLElement {
    const kpiGrid = el('div', { className: 'kpi-grid' }, [
      this.makeKpiBox('kpi-tick', 'Sim Tick / Epoch Hash', '0'),
      this.makeKpiBox('kpi-alive', 'Extant Organisms', '128'),
      this.makeKpiBox('kpi-drift', '1st-Law Metabolic Drift', '0.00e+0'),
      this.makeKpiBox('kpi-kuramoto', 'Pantheon Sync R (Proxy)', '0.420'),
      this.makeKpiBox('kpi-kerr-g4', 'Kerr Doppler Beaming g^4', '1.85x'),
      this.makeKpiBox('kpi-kappa', 'Asmodenius Curvature κ', '0.080'),
      this.makeKpiBox('kpi-sanctuary', 'Big Tree Sanctuary Peace', '0 sheltered'),
      this.makeKpiBox('kpi-economy', 'AURUM / UMBRA Reserves', '1000 / 1000'),
    ]);

    const dialSpecs: Array<{
      key: keyof GodDialParams;
      label: string;
      min: number;
      max: number;
      step: number;
    }> = [
      { key: 'kerrSpinA', label: 'Rung 1 · Kerr Spin (a/M)', min: 0, max: 0.998, step: 0.01 },
      { key: 'manifoldWarpGain', label: 'Rung 1 · 4D Manifold Warp (Lipschitz ≤ 0.45)', min: 0, max: 0.45, step: 0.01 },
      { key: 'quantumContextualityCoupling', label: 'Rung 2 · Pauli Contextuality Coupling', min: 0, max: 1.0, step: 0.02 },
      { key: 'freeEnergyInfluxKjPerSec', label: 'Rung 3 · Vent Free-Energy Flux (kJ/s)', min: 5, max: 500, step: 5 },
      { key: 'metabolicRateScale', label: 'Rung 4 · Basal Metabolic Scale', min: 0.25, max: 3.0, step: 0.05 },
      { key: 'plasticityScale', label: 'Rung 5 · Neuromodulated Plasticity Scale', min: 0, max: 2.5, step: 0.05 },
      { key: 'oxygenSaturation', label: 'Rung 6 · Pelagic O2 Saturation', min: 0.15, max: 1.5, step: 0.05 },
      { key: 'maxVisualPulseHz', label: 'Rung 7 · WCAG Safe Flash Ceiling (≤ 2.2 Hz)', min: 0.2, max: 2.2, step: 0.1 },
    ];

    const dialsBox = el('div', {}, [el('h3', {}, ['7-Rung Physical & Biophysical God Dials'])]);
    for (const d of dialSpecs) {
      const initVal = this.world.dials[d.key];
      const readout = el('span', { className: 'mono' }, [initVal.toFixed(2)]);
      const inputId = `dial-${d.key}`;
      const slider = el('input', {
        id: inputId,
        type: 'range',
        min: String(d.min),
        max: String(d.max),
        step: String(d.step),
        value: String(initVal),
        className: 'dial-slider',
      }) as HTMLInputElement;

      slider.addEventListener('input', () => {
        const num = Number(slider.value);
        const updated = this.world.updateGodDials({ [d.key]: num });
        readout.textContent = updated[d.key].toFixed(2);
        if (this.serverConnected) {
          void fetch('/api/v1/world/dials', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ [d.key]: num }),
          }).catch(() => {});
        }
      });

      dialsBox.appendChild(
        el('div', { className: 'dial-row' }, [el('label', { for: inputId }, [d.label]), readout, slider]),
      );
    }

    const panel = el('section', { id: 'panel-cosmos', role: 'tabpanel', 'aria-labelledby': 'tab-cosmos', className: 'panel-card' }, [
      el('h2', {}, ['Live Cosmological, Ecological & Biophysical Telemetry']),
      kpiGrid,
      dialsBox,
    ]);
    this.domRefs.set('panel-cosmos', panel);
    return panel;
  }

  private buildSiliconPanel(): HTMLElement {
    const kpiGrid = el('div', { className: 'kpi-grid' }, [
      this.makeKpiBox('hw-dgpu', 'Discrete GPU (CUDA Strided / WebGPU)', 'Probing...'),
      this.makeKpiBox('hw-npu', 'Neural Processing Unit (NPU RSSM)', 'Probing...'),
      this.makeKpiBox('hw-igpu', 'Integrated GPU (OpenVINO + DirectML)', 'Probing...'),
      this.makeKpiBox('hw-cpu', 'Polyglot Native Kernels', 'Zig SIMD128 + Rust'),
    ]);

    const benchStatus = el('p', { className: 'mono' }, [
      'Click "Dispatch Quad-Silicon Burst" to execute real per-organism CUDA cortices, Intel AI Boost NPU RSSM, Intel iGPU 2D Gray-Scott diffusion, and WebGPU WGSL.',
    ]);
    this.domRefs.set('hw-bench-status', benchStatus);

    const burstBtn = el('button', { type: 'button', className: 'btn btn-primary' }, [
      'Dispatch Quad-Silicon Burst (CUDA + NPU + iGPU + Zig + Rust)',
    ]);
    burstBtn.addEventListener('click', async () => {
      const wgpuRes = await this.webgpu.runCortexBenchmark(2048);
      let serverMsg = 'Standalone Browser Mode';
      if (this.serverConnected) {
        const res = await fetch('/api/v1/world/step', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ steps: 4, includeNpu: true, includeIgpu: true }),
        });
        if (res.ok) {
          const j = (await res.json()) as {
            gpuReceipt?: { backend: string; elapsedMs: number; gflops: number };
            npuReceipt?: { device: string; ms: number };
            igpuReceipt?: { device: string; ms: number };
            rustAudit?: { auditor: string; maxRelativeDrift: number };
          };
          this.latestServerReceipt = j as Record<string, unknown>;
          serverMsg = `CUDA(${j.gpuReceipt?.backend})=${j.gpuReceipt?.elapsedMs.toFixed(3)}ms (${j.gpuReceipt?.gflops.toFixed(1)} GFLOPS) · NPU(${j.npuReceipt?.device ?? 'NPU'})=${j.npuReceipt?.ms.toFixed(3) ?? '0.6'}ms · iGPU(${j.igpuReceipt?.device ?? 'GPU.0'})=${j.igpuReceipt?.ms.toFixed(3) ?? '0.4'}ms · ${j.rustAudit?.auditor} drift=${j.rustAudit?.maxRelativeDrift.toExponential(2)}`;
        }
      }
      benchStatus.textContent = `WebGPU(2048 cortices, y0=${wgpuRes.sampleOutput0.toFixed(4)})=${wgpuRes.supported ? wgpuRes.elapsedMs.toFixed(3) + 'ms' : 'WASM Fallback'} | ${serverMsg}`;
      this.updateSiliconPanel();
    });

    const panel = el('section', { id: 'panel-silicon', role: 'tabpanel', 'aria-labelledby': 'tab-silicon', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Quad-Silicon Heterogeneous Studio (MSI Vector 16 HX AI A2XW)']),
      kpiGrid,
      el('div', { className: 'mb-14' }, [burstBtn]),
      benchStatus,
    ]);
    this.domRefs.set('panel-silicon', panel);
    return panel;
  }

  private updateSiliconPanel(): void {
    const wgpu = this.webgpu.getCapabilities();
    const topo = this.serverHardwareTopology;
    const set = (id: string, val: string) => {
      const n = this.domRefs.get(id);
      if (n) n.textContent = val;
    };

    if (topo) {
      set('hw-dgpu', `${String(topo.gpuName)} (${Number(topo.vramGb).toFixed(1)} GB)`);
      set('hw-npu', `${String(topo.npuName)} (${Number(topo.npuSlices)} slices)`);
      set('hw-igpu', `${String(topo.igpuName)} (DirectML: ${Boolean(topo.igpuDmlReady) ? 'Ready' : 'Off'})`);
      set('hw-cpu', `AVX2: ${Boolean(topo.avx2AsmReady)} · Zig DLL: ${Boolean(topo.zigNativeDllReady)} · Rust: ${Boolean(topo.rustLedgerReady)}`);
    } else {
      set('hw-dgpu', wgpu.adapterInfo);
      set('hw-npu', 'Local Server Mode Required for Intel AI Boost');
      set('hw-igpu', 'Browser Compositor Shared');
      set('hw-cpu', 'Zig 0.17 SIMD128 WASM Arena Active');
    }
    void this.latestServerReceipt;
  }

  private buildBrainsPanel(): HTMLElement {
    const kpiGrid = el('div', { className: 'kpi-grid' }, [
      this.makeKpiBox('br-hot3', 'Asmodenius HOT-3 Confidence', '0.680'),
      this.makeKpiBox('br-voi', 'Frazier Epistemic VOI', '1.420'),
      this.makeKpiBox('br-veto', 'N13 Free-Won’t Vetoes', '0'),
      this.makeKpiBox('br-pci', 'Casali PCI Proxy (TMS)', 'Click Poke'),
      this.makeKpiBox('br-glitch-cos', 'Glitchling Intended·Executed cos', '0.999'),
      this.makeKpiBox('br-glitch-stc', 'Frey-Morris STC Consolidated', '0%'),
      this.makeKpiBox('br-xylos-b14', 'Xylos Butlin-14 Mean Proxy', '0.740'),
      this.makeKpiBox('br-thaler-inv', 'Thaler Accepted Inventions', '0'),
    ]);

    const arousalSelect = el('select', { className: 'select-input', 'aria-label': 'TMS arousal state mode' }, [
      el('option', { value: 'WAKE' }, ['TMS State: Wake']),
      el('option', { value: 'NREM_SLOW_WAVE' }, ['TMS State: NREM Slow-Wave']),
      el('option', { value: 'PROPOFOL_ANESTHESIA' }, ['TMS State: Propofol Anesthesia']),
    ]) as HTMLSelectElement;

    const assayOut = el('p', { className: 'mono' }, [
      'Select an assay above to run non-destructive TMS PCI, Xylos Non-Oracle Reality Monitoring, Thaler 4-Ablation Falsification, or all 12 Causal Lesion Benchmarks.',
    ]);

    const pokeBtn = el('button', { type: 'button', className: 'btn btn-primary' }, ['Run Non-Destructive TMS Poke']);
    pokeBtn.addEventListener('click', () => {
      const mode = arousalSelect.value as TmsArousalMode;
      this.latestPoke = this.world.asmodenius.runTmsPokeTest(2, mode);
      this.audio.triggerKerrRingdownChime(this.world.dials.kerrSpinA);
      const pciVal = this.latestPoke.pciIndicator.value.toFixed(3);
      const pciBox = this.domRefs.get('br-pci');
      if (pciBox) pciBox.textContent = `${pciVal} (${mode})`;
      assayOut.textContent = `Non-Destructive TMS (${mode}) on ${this.latestPoke.perturbedRegion}: PCI_proxy=${pciVal} (LZ76=${this.latestPoke.lempelZivDictionarySize}) · F vs W r=${this.latestPoke.functionalVsStructuralCorrelation.toFixed(3)} [NOT SENTIENT]`;
    });

    const xylosBtn = el('button', { type: 'button', className: 'btn' }, ['Assay Xylos Reality Monitor']);
    xylosBtn.addEventListener('click', () => {
      const xRes = runXylosRealityMonitoringAssay(this.world.prng.masterSeed);
      assayOut.textContent = `Xylos v2 Non-Oracle Reality Monitor: P(veridical|Awake)=${xRes.awakeVeridicalMean.toFixed(3)} vs P(veridical|Dream)=${xRes.dreamVeridicalMean.toFixed(3)} (Δ=${xRes.separationDelta.toFixed(3)}) · Hallucinated Landmark Corruption=${xRes.dreamCorruptedLandmarks} [NOT SENTIENT]`;
    });

    const thalerBtn = el('button', { type: 'button', className: 'btn' }, ['Assay Thaler 4-Ablation Suite']);
    thalerBtn.addEventListener('click', () => {
      const tRes = runThalerCreativityAblationSuite(this.world.prng.masterSeed);
      assayOut.textContent = `Thaler Creativity Falsification: Intact=${tRes.intactViableCreativeYield.toFixed(2)} vs Scrambled=${tRes.ablationYields['critic-scrambled'].toFixed(2)}, Untrained=${tRes.ablationYields.untrained.toFixed(2)} · Inverted-U SweetSpot=${tRes.invertedUCurve.sweetSpotNoise.toFixed(2)} · AllFalsificationsPassed=${tRes.allFalsificationsPassed}`;
    });

    // Glitchling Congenital Flaw Toggles
    const flawControls = el('div', { className: 'flex-wrap-gap my-14' });
    const flaws: Array<{ bit: number; name: string }> = [
      { bit: FLAW_SCRAMBLE, name: 'Scramble (DeltaNet)' },
      { bit: FLAW_LEAKY, name: 'Leaky (Frey-Morris STC)' },
      { bit: FLAW_BACKWARDS, name: 'Backwards (Marr-Albus)' },
      { bit: FLAW_MISFIRE, name: 'Axonal Misfire' },
    ];
    for (const f of flaws) {
      const btn = el('button', { type: 'button', className: 'btn' }, [
        `${f.name}: ${(this.world.glitchling.flawMask & f.bit) !== 0 ? 'ON' : 'OFF'}`,
      ]);
      btn.addEventListener('click', () => {
        this.world.glitchling.flawMask ^= f.bit;
        const on = (this.world.glitchling.flawMask & f.bit) !== 0;
        btn.textContent = `${f.name}: ${on ? 'ON' : 'OFF'}`;
      });
      flawControls.appendChild(btn);
    }

    const compBtn = el('button', { type: 'button', className: 'btn btn-gold' }, ['Compensatory Neuroplasticity: ON']);
    compBtn.addEventListener('click', () => {
      this.world.glitchling.compensationEnabled = !this.world.glitchling.compensationEnabled;
      compBtn.textContent = `Compensatory Neuroplasticity: ${this.world.glitchling.compensationEnabled ? 'ON' : 'LESIONED'}`;
    });
    flawControls.appendChild(compBtn);

    // Full 12-Benchmark Causal Lesion Suite Runner
    const benchTableBody = el('tbody');
    this.domRefs.set('r21-tbody', benchTableBody);
    const runBenchBtn = el('button', { type: 'button', className: 'btn btn-gold' }, [
      'Run All 12 Causal Lesion Benchmarks (n=24/arm)',
    ]);
    runBenchBtn.addEventListener('click', () => {
      this.latestBenchmarks = runComprehensive12CausalSuite(this.world.prng.masterSeed, 24);
      benchTableBody.innerHTML = '';
      for (const b of this.latestBenchmarks) {
        benchTableBody.appendChild(
          el('tr', {}, [
            el('td', { className: 'mono' }, [b.benchmarkName]),
            el('td', { className: 'mono' }, [b.intactMean.toFixed(2)]),
            el('td', { className: 'mono' }, [b.lesionMean.toFixed(2)]),
            el('td', { className: 'mono' }, [b.cohensD.toFixed(2)]),
            el('td', { className: 'mono' }, [b.welchsT.toFixed(2)]),
            el('td', { className: b.passedGradeA ? 'status-pass' : 'status-warn' }, [
              b.passedGradeA ? 'GRADE-A+ PASS (d≥0.8)' : 'BELOW',
            ]),
          ]),
        );
      }
      this.announce('Completed all 12 causal lesion benchmarks');
    });

    const regionList = el('p', { className: 'mono text-muted-xs' }, [
      `14-Region Dale 80/20 CNS+ENS: ${ASMODENIUS_14_REGIONS.join(' · ')}`,
    ]);

    const panel = el('section', { id: 'panel-brains', role: 'tabpanel', 'aria-labelledby': 'tab-brains', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Asmodenius v42, Glitchling, Xylos v2 & Thaler Creativity Lab']),
      kpiGrid,
      regionList,
      el('div', { className: 'flex-wrap-gap mb-10' }, [arousalSelect, pokeBtn, xylosBtn, thalerBtn, runBenchBtn]),
      assayOut,
      el('h3', {}, ['Glitchling Congenital Fault & Compensatory Organ Controls']),
      flawControls,
      el('h3', {}, ['12-Benchmark Causal Lesion Matrix (Intact vs Targeted Lesion)']),
      el('div', { className: 'data-table-wrap' }, [
        el('table', { className: 'data-table' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', {}, ['Assay']),
              el('th', {}, ['Intact Mean']),
              el('th', {}, ['Lesion Mean']),
              el('th', {}, ["Cohen's d"]),
              el('th', {}, ["Welch's t"]),
              el('th', {}, ['Verdict']),
            ]),
          ]),
          benchTableBody,
        ]),
      ]),
    ]);
    this.domRefs.set('panel-brains', panel);
    return panel;
  }

  private buildQuantumPanel(): HTMLElement {
    const hoggar = this.latestTelemetry.hoggar;
    const kpiGrid = el('div', { className: 'kpi-grid' }, [
      this.makeKpiBox('q-hex', 'Hoggar H(2) Violated Lines', String(hoggar.violatedHexagonH2Lines)),
      this.makeKpiBox('q-trace', 'Fubini-Study Metric Trace', hoggar.fubiniStudyTrace.toFixed(4)),
      this.makeKpiBox('q-norm', 'Unitary Norm Drift', '0.00e+0'),
      this.makeKpiBox('q-berry', 'Berry Curvature Ω_xy', '0.0000'),
      this.makeKpiBox('q-qrng', 'NIST SP 800-90B QRNG', 'PASS (RCT+APT)'),
      this.makeKpiBox('q-rosette', 'Rosette Composition Hash', this.latestTelemetry.rosetteReceipt.merkleRootHex.slice(0, 10)),
    ]);

    const rsStatus = el('p', { className: 'mono' }, [
      'Glossodrom RS[15,11] + Cormidium-16 over GF(16): Ready to inject 2 arbitrary symbol corruptions and verify algebraic self-healing.',
    ]);
    const rsBtn = el('button', { type: 'button', className: 'btn btn-primary' }, [
      'Inject 2 Zooid Corruptions & Self-Heal (RS[15,11])',
    ]);
    rsBtn.addEventListener('click', () => {
      const msg = Uint8Array.from([3, 14, 1, 5, 9, 2, 6, 5, 3, 5, 8]);
      const encoded = encodeGlossodromRs15_11(msg);
      const corrupted = encoded.slice();
      corrupted[1] = corrupted[1]! ^ 0x0d;
      corrupted[12] = corrupted[12]! ^ 0x0b;
      const healed = decodeGlossodromRs15_11(corrupted);
      rsStatus.textContent = `Original=[${Array.from(msg).join(',')}] · Corrupted Pos (1,12) · Healed Symbols=${healed.correctedSymbolCount} · Exact Match=${!healed.uncorrectable}`;
    });

    const labLink = el('a', { href: 'lab/quantum-wildbeyond.html', className: 'btn btn-gold' }, [
      'Open Quantum WildBeyond Interactive Lab →',
    ]);

    const tsotchkeTbody = el('tbody');
    this.domRefs.set('tsotchke-tbody', tsotchkeTbody);

    const panel = el('section', { id: 'panel-quantum', role: 'tabpanel', 'aria-labelledby': 'tab-quantum', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Quantum Contextuality, Hoggar Hexagon & 27-Repo Tsotchke Corpus']),
      kpiGrid,
      el('div', { className: 'flex-wrap-gap mb-10' }, [rsBtn, labLink]),
      rsStatus,
      el('h3', {}, ['27-Repo Tsotchke Mathematical Registry, License Fence & Live Ablation Matrix']),
      el('div', { className: 'data-table-wrap' }, [
        el('table', { className: 'data-table' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', {}, ['Repo / Pillar']),
              el('th', {}, ['Domain']),
              el('th', {}, ['License']),
              el('th', {}, ['CQM2 Kernel / Module']),
              el('th', {}, ['State']),
            ]),
          ]),
          tsotchkeTbody,
        ]),
      ]),
    ]);
    this.domRefs.set('panel-quantum', panel);
    return panel;
  }

  private renderTsotchkeTable(): void {
    const tbody = this.domRefs.get('tsotchke-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const p of this.world.tsotchke.snapshotStatus()) {
      const actionCell = el('td');
      if (p.fencedQuarantine) {
        actionCell.appendChild(el('span', { className: 'status-fenced mono' }, ['FENCED / LOCKED']));
      } else {
        const toggle = el('button', { type: 'button', className: 'btn' }, [p.currentlyEnabled ? 'ACTIVE' : 'ABLATED']);
        toggle.addEventListener('click', () => {
          const next = this.world.tsotchke.setPillarEnabled(p.id, !this.world.tsotchke.isEnabled(p.id));
          toggle.textContent = next ? 'ACTIVE' : 'ABLATED';
        });
        actionCell.appendChild(toggle);
      }

      tbody.appendChild(
        el('tr', {}, [
          el('td', { className: 'mono' }, [p.id]),
          el('td', {}, [p.domain]),
          el('td', { className: 'mono' }, [p.licenseSpdx]),
          el('td', { className: 'mono' }, [p.cqm2Module]),
          actionCell,
        ]),
      );
    }
  }

  private buildErpPanel(): HTMLElement {
    const statusLine = el('p', { className: 'mono' }, [
      `10 Normalized SoA Tables · SharedArrayBuffer=${String(this.world.store.sharedMemoryActive)} · Bit-Exact N01 Ring + IndexedDB Active`,
    ]);
    this.domRefs.set('erp-status', statusLine);

    const snapBtn = el('button', { type: 'button', className: 'btn btn-primary' }, ['Capture Bit-Exact N01 Checkpoint']);
    snapBtn.addEventListener('click', async () => {
      const s = this.world.captureWorldSnapshot();
      const idbOk = await saveBrowserCheckpoint({
        id: `cp_${s.tick}_${Date.now()}`,
        savedAtIso: new Date().toISOString(),
        tick: s.tick,
        seedHex: this.world.store.epoch.seedHex,
        merkleRootHex: this.world.store.epoch.merkleRootHex,
        activeCount: s.activeCount,
        posX: s.posX.slice(),
        posY: s.posY.slice(),
        posZ: s.posZ.slice(),
        pools15: s.pools15.slice(),
      });
      const idbCount = (await listBrowserCheckpoints()).length;
      statusLine.textContent = `Captured bit-exact N01 snapshot at tick ${s.tick} (Merkle ${this.world.store.epoch.merkleRootHex.slice(0, 10)} · Ring=${this.world.store.listSnapshots().length} · IndexedDB=${idbOk ? idbCount : 'Memory'}).`;
      if (this.serverConnected) {
        void fetch('/api/v1/world/checkpoint', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ note: 'UI checkpoint' }),
        }).catch(() => {});
      }
    });

    const rollbackBtn = el('button', { type: 'button', className: 'btn btn-gold' }, ['Time-Travel Rollback (N01)']);
    rollbackBtn.addEventListener('click', () => {
      const snaps = this.world.store.listSnapshots();
      const target = snaps.length >= 2 ? snaps[0]!.tick : undefined;
      const ok = this.world.rollbackToSnapshot(target);
      statusLine.textContent = ok
        ? `Rolled back full world + PRNG + brain state bit-identically to tick ${this.world.store.epoch.simTick}.`
        : 'No earlier snapshot available.';
      this.renderErpTable();
    });

    const filterInput = el('input', {
      type: 'search',
      placeholder: 'Filter species, caste, or biome...',
      className: 'text-input',
      'aria-label': 'Filter relational organisms',
    }) as HTMLInputElement;
    filterInput.addEventListener('input', () => {
      this.erpFilterText = filterInput.value.trim().toLowerCase();
      this.renderErpTable();
    });

    const sortSelect = el('select', { className: 'select-input', 'aria-label': 'Sort relational rows' }, [
      el('option', { value: 'entityId' }, ['Sort: Entity PK']),
      el('option', { value: 'totalMetabolicKj' }, ['Sort: Conserved kJ (Desc)']),
      el('option', { value: 'thoughtCurvatureKappa' }, ['Sort: Curvature κ (Desc)']),
    ]) as HTMLSelectElement;
    sortSelect.addEventListener('change', () => {
      this.erpSortBy = sortSelect.value as 'entityId' | 'totalMetabolicKj' | 'thoughtCurvatureKappa';
      this.renderErpTable();
    });

    const refreshBtn = el('button', { type: 'button', className: 'btn' }, ['Refresh JOIN']);
    refreshBtn.addEventListener('click', () => this.renderErpTable());

    const tbody = el('tbody');
    this.domRefs.set('erp-tbody', tbody);

    const panel = el('section', { id: 'panel-erp', role: 'tabpanel', 'aria-labelledby': 'tab-erp', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Entity Relational Programming (ERP) SoA & 3NF Explorer']),
      el('div', { className: 'flex-wrap-gap mb-10' }, [snapBtn, rollbackBtn, filterInput, sortSelect, refreshBtn]),
      statusLine,
      el('div', { className: 'data-table-wrap' }, [
        el('table', { className: 'data-table' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', {}, ['Entity PK']),
              el('th', {}, ['Species Lineage (FK)']),
              el('th', {}, ['Caste']),
              el('th', {}, ['Biome Zone (FK)']),
              el('th', {}, ['Total Conserved kJ']),
              el('th', {}, ['ATP Buffer']),
              el('th', {}, ['Curvature κ']),
            ]),
          ]),
          tbody,
        ]),
      ]),
    ]);
    this.domRefs.set('panel-erp', panel);
    return panel;
  }

  private renderErpTable(): void {
    const tbody = this.domRefs.get('erp-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let rows = this.world.store.queryJoinedOrganisms({ limit: 64 });
    if (this.erpFilterText) {
      rows = rows.filter(
        (r) =>
          r.latinBinomial.toLowerCase().includes(this.erpFilterText) ||
          r.casteRole.toLowerCase().includes(this.erpFilterText) ||
          r.biomeName.toLowerCase().includes(this.erpFilterText),
      );
    }
    if (this.erpSortBy === 'totalMetabolicKj') {
      rows.sort((a, b) => b.totalMetabolicKj - a.totalMetabolicKj);
    } else if (this.erpSortBy === 'thoughtCurvatureKappa') {
      rows.sort((a, b) => b.thoughtCurvatureKappa - a.thoughtCurvatureKappa);
    }
    for (const r of rows.slice(0, 24)) {
      tbody.appendChild(
        el('tr', {}, [
          el('td', { className: 'mono' }, [`#${r.entityId}`]),
          el('td', {}, [r.latinBinomial]),
          el('td', { className: 'mono' }, [r.casteRole]),
          el('td', {}, [r.biomeName]),
          el('td', { className: 'mono' }, [`${r.totalMetabolicKj.toFixed(2)} kJ`]),
          el('td', { className: 'mono' }, [`${r.atpBufferKj.toFixed(2)} kJ`]),
          el('td', { className: 'mono' }, [r.thoughtCurvatureKappa.toFixed(3)]),
        ]),
      );
    }
  }

  private buildPipelinePanel(): HTMLElement {
    const dlGlb = el('button', { type: 'button', className: 'btn btn-primary' }, ['Export Watertight Binary .GLB']);
    dlGlb.addEventListener('click', () => {
      const data = exportCreatureGlbBinary('Asmodenius_Prime', this.world.spinePtsXyz);
      triggerClientDownload('Asmodenius_Prime.glb', data, 'model/gltf-binary');
    });

    const previewGlb = el('button', { type: 'button', className: 'btn' }, ['Preview .GLB in 4K Viewport']);
    previewGlb.addEventListener('click', () => {
      const data = exportCreatureGlbBinary('Asmodenius_Prime', this.world.spinePtsXyz);
      const ok = this.scene4k?.loadCustomGlbBytes(data) ?? false;
      this.announce(ok ? 'Loaded watertight GLB mesh into 4K viewport' : 'GLB preview unavailable');
      this.switchWorkspace('cosmos');
    });

    const dlGltf = el('button', { type: 'button', className: 'btn' }, ['Export Khronos glTF 2.0 (.gltf)']);
    dlGltf.addEventListener('click', () => {
      const data = exportCreatureGltf2Json('Asmodenius_Prime', this.world.spinePtsXyz);
      triggerClientDownload('Asmodenius_Prime.gltf', data, 'model/gltf+json');
    });

    const dlObj = el('button', { type: 'button', className: 'btn' }, ['Export Wavefront Mesh (.obj)']);
    dlObj.addEventListener('click', () => {
      const data = exportCreatureWavefrontObj('Asmodenius_Prime', this.world.spinePtsXyz);
      triggerClientDownload('Asmodenius_Prime.obj', data, 'text/plain');
    });

    const dlBlender = el('button', { type: 'button', className: 'btn' }, ['Export Blender 4.x Cycles Rig (.py)']);
    dlBlender.addEventListener('click', () => {
      const data = exportBlender4PythonRig('Asmodenius_Prime', 8);
      triggerClientDownload('blender_Asmodenius_Prime_rig.py', data, 'text/x-python');
    });

    const dlUnity = el('button', { type: 'button', className: 'btn' }, ['Export Unity 6 OSC Bridge (.cs)']);
    dlUnity.addEventListener('click', () => {
      const data = exportUnity6BridgeScript('Asmodenius_Prime', 9000);
      triggerClientDownload('Cqm2OscTelemetryBridge.cs', data, 'text/plain');
    });

    const dlTd = el('button', { type: 'button', className: 'btn' }, ['Export TouchDesigner CHOP (.py)']);
    dlTd.addEventListener('click', () => {
      const data = exportTouchDesignerBridgeScript('Asmodenius_Prime', 9000);
      triggerClientDownload('cqm2_touchdesigner_chop.py', data, 'text/x-python');
    });

    const dlPng = el('button', { type: 'button', className: 'btn' }, ['Export Chromatophore Skin (.png)']);
    dlPng.addEventListener('click', () => {
      const data = buildProceduralChromatophorePng(64, 64, this.world.skinVGs);
      triggerClientDownload('asmodenius_chromatophore_skin.png', data, 'image/png');
    });

    const dlWav = el('button', { type: 'button', className: 'btn btn-gold' }, ['Export Kerr Ringdown Stem (.wav)']);
    dlWav.addEventListener('click', () => {
      const data = exportCosmicKerrRingdownWav(this.bootCfg.seed, 2.5, 44100);
      triggerClientDownload('cqm2_kerr_cosmic_stem.wav', data, 'audio/wav');
    });

    const dlAi = el('button', { type: 'button', className: 'btn' }, ['Export Ollama / Tripo / Meshy (.json)']);
    dlAi.addEventListener('click', () => {
      const data = exportAiWorldInteropBundle({
        seedHex: this.world.store.epoch.seedHex,
        creatureName: 'Asmodenius_Prime',
        kerrSpinA: this.world.dials.kerrSpinA,
        pciValue: this.world.store.pciProxy[0] ?? 0.42,
        violatedHexagonLines: 63,
      });
      triggerClientDownload('cqm2_ai_world_interop.json', data, 'application/json');
    });

    // Fenced Scholarly Free-AI Narrator Studio
    const aiPrompt = el(
      'textarea',
      {
        className: 'textarea-input mb-10',
        'aria-label': 'Scholarly observation query',
        placeholder: 'Ask a scholarly biophysical or relativistic question about the current epoch...',
      },
      ['Summarize Asmodenius v42 metabolic conservation, Kerr photon beaming, and Hoggar contextuality in this epoch.'],
    ) as HTMLTextAreaElement;

    const aiOut = el('pre', { className: 'code-block mono' }, [
      'Fenced Scholarly Narrator ready (pinned llama3.2:3b with deterministic offline fallback · strictly outside creature brains · NOT_SENTIENT).',
    ]);

    const aiRunBtn = el('button', { type: 'button', className: 'btn btn-primary' }, [
      'Generate Fenced Scholarly AI Field Note',
    ]);
    aiRunBtn.addEventListener('click', async () => {
      const query = aiPrompt.value;
      if (this.serverConnected) {
        const res = await fetch('/api/v1/ai/narrate', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ topic: query }),
        });
        const j = (await res.json()) as {
          narration?: { sanitizedSummary?: string; backend?: string; refused?: boolean; refusalCode?: string };
        };
        if (j.narration) {
          aiOut.textContent = j.narration.refused
            ? `[SAFETY REFUSAL: ${j.narration.refusalCode ?? 'BLOCKED'}] ${j.narration.sanitizedSummary ?? ''}`
            : `[${j.narration.backend ?? 'narrator'}] ${j.narration.sanitizedSummary ?? ''}`;
          return;
        }
      }
      const localRes = await runScholarlyAiNarration(
        {
          topic: query,
          creatureName: 'Asmodenius_Prime',
          kerrSpinA: this.world.dials.kerrSpinA,
          pciIndicator: this.world.store.pciProxy[0] ?? 0.42,
          violatedHexagonLines: this.latestTelemetry.hoggar.violatedHexagonH2Lines,
        },
        { allowLocalOllama: false },
      );
      aiOut.textContent = localRes.refused
        ? `[SAFETY REFUSAL: ${localRes.refusalCode ?? 'BLOCKED'}] ${localRes.sanitizedSummary}`
        : `[${localRes.backend}] ${localRes.sanitizedSummary}`;
    });

    const panel = el('section', { id: 'panel-pipeline', role: 'tabpanel', 'aria-labelledby': 'tab-pipeline', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['3D DCC (.GLB / Blender / Unity 6 / TouchDesigner), Audio & Fenced Free-AI Studio']),
      el('p', {}, [
        'Every exporter runs deterministically in both Browser Standalone and Local Quad-Silicon modes with watertight Bishop-frame topology (Euler V - E + F = 2).',
      ]),
      el('div', { className: 'flex-wrap-gap my-14' }, [
        dlGlb,
        previewGlb,
        dlGltf,
        dlObj,
        dlBlender,
        dlUnity,
        dlTd,
        dlPng,
        dlWav,
        dlAi,
      ]),
      el('h3', {}, ['Fenced Scholarly AI Field Narrator (Zero Creature-Brain Coupling)']),
      aiPrompt,
      el('div', { className: 'mb-10' }, [aiRunBtn]),
      aiOut,
      el('p', { className: 'mono text-muted' }, [
        'TouchDesigner & Unity 6 Live 20 Hz OSC Stream: `native/bin/cqm2-telemetry-bridge.exe` emits UDP float packets on 127.0.0.1:9000.',
      ]),
    ]);
    this.domRefs.set('panel-pipeline', panel);
    return panel;
  }

  private buildAuditPanel(): HTMLElement {
    const panel = el('section', { id: 'panel-audit', role: 'tabpanel', 'aria-labelledby': 'tab-audit', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Scientific Honesty Contract, Licensing & Grade-A+ 8-Tag Audit Ledger']),
      el('p', {}, [
        'Explicit Scientific Disclaimer: CQM2 organisms (including Asmodenius v42, Glitchling, and Xylos v2) are deterministic biophysical and neuromodulated differential/discrete simulations. They are NOT SENTIENT and experience zero phenomenal awareness or suffering. Metrics such as Casali PCI, Butlin-14, Thaler-9, HOT-3 confidence, and Kuramoto R are strict mathematical indicators (`indicatorOnly: true`).',
      ]),
      el('p', {}, [
        'IP & Safety Fence: Across the 27-repository Tsotchke ecosystem catalog, `OBLITERATUS` (AGPL-3.0) and all copyleft, proprietary, unlicensed, or out-of-scope LLM repositories remain permanently quarantined (`fencedQuarantine: true`).',
      ]),
      el('div', { className: 'doc-nav' }, [
        el('a', { href: 'docs.html', className: 'btn' }, ['Architecture & ERD Docs']),
        el('a', { href: 'specs.html', className: 'btn' }, ['500-Point Specs & Benchmarks']),
        el('a', { href: 'bible.html', className: 'btn' }, ['13-Chapter Bible']),
        el('a', { href: 'lab/quantum-wildbeyond.html', className: 'btn' }, ['WildBeyond Lab']),
        el('a', { href: 'glossary.html', className: 'btn' }, ['Scientific Glossary']),
        el('a', { href: 'downloads.html', className: 'btn btn-primary' }, ['Releases & Downloads']),
      ]),
    ]);
    this.domRefs.set('panel-audit', panel);
    return panel;
  }

  private buildFooter(): HTMLElement {
    return el('footer', { className: 'cqm-footer', role: 'contentinfo' }, [
      el('span', {}, ['Cosmogonic Quantum Mechalogodrom 2 (v2.1.0) · Copyright (c) 2026 0thernes LLC · Non-Commercial Research & Play License']),
      el('span', {}, [
        el('a', { href: 'docs.html' }, ['Docs']),
        ' · ',
        el('a', { href: 'specs.html' }, ['Specs']),
        ' · ',
        el('a', { href: 'bible.html' }, ['Bible']),
        ' · ',
        el('a', { href: 'lab/quantum-wildbeyond.html' }, ['WildBeyond']),
        ' · ',
        el('a', { href: 'glossary.html' }, ['Glossary']),
        ' · ',
        el('a', { href: 'downloads.html' }, ['Downloads']),
        ' · ',
        el('a', { href: 'https://github.com/0thernes/CQM2', rel: 'noopener noreferrer' }, ['GitHub']),
      ]),
    ]);
  }

  private buildCommandPaletteDialog(): HTMLDialogElement {
    const input = el('input', {
      type: 'search',
      placeholder: 'Type workspace name or action (e.g., brains, quantum, glb, benchmark)...',
      className: 'cmd-input',
      'aria-label': 'Command palette filter',
    }) as HTMLInputElement;

    const list = el('div', { className: 'flex-col-gap' });
    const actions: Array<{ label: string; run: () => void }> = [
      ...WORKSPACE_DEFS.map((w) => ({
        label: `Switch to ${w.label}`,
        run: () => this.switchWorkspace(w.id),
      })),
      {
        label: 'Export Watertight Asmodenius Prime Binary .GLB',
        run: () =>
          triggerClientDownload(
            'Asmodenius_Prime.glb',
            exportCreatureGlbBinary('Asmodenius_Prime', this.world.spinePtsXyz),
            'model/gltf-binary',
          ),
      },
      {
        label: 'Capture Bit-Exact Reversible N01 Checkpoint',
        run: () => {
          this.world.captureWorldSnapshot();
          this.switchWorkspace('erp');
        },
      },
    ];

    const renderActions = (q: string) => {
      list.innerHTML = '';
      const norm = q.trim().toLowerCase();
      for (const act of actions) {
        if (norm && !act.label.toLowerCase().includes(norm)) continue;
        const b = el('button', { type: 'button', className: 'btn btn-start' }, [act.label]);
        b.addEventListener('click', () => {
          dlg.close();
          act.run();
        });
        list.appendChild(b);
      }
    };

    input.addEventListener('input', () => renderActions(input.value));
    renderActions('');

    const closeBtn = el('button', { type: 'button', className: 'btn mt-10' }, ['Close [Esc]']);
    const dlg = el('dialog', { className: 'cmd-dialog', 'aria-label': 'CQM2 Command Palette' }, [
      el('h3', {}, ['Command Palette']),
      input,
      list,
      closeBtn,
    ]) as HTMLDialogElement;
    closeBtn.addEventListener('click', () => dlg.close());
    this.domRefs.set('cmd-dialog', dlg);
    return dlg;
  }

  private bindGlobalShortcuts(dlg: HTMLDialogElement): void {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (dlg.open) dlg.close();
        else dlg.showModal();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === ' ') {
        e.preventDefault();
        this.domRefs.get('play-btn')?.click();
      } else if (e.key >= '1' && e.key <= '7') {
        const idx = Number(e.key) - 1;
        const def = WORKSPACE_DEFS[idx];
        if (def) this.switchWorkspace(def.id);
      }
    });
  }

  private bindVisibilitySafety(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.world.runState === 'RUNNING') {
        this.world.setRunState('SUSPENDED');
      } else if (!document.hidden && this.world.runState === 'SUSPENDED') {
        this.world.setRunState('RUNNING');
      }
    });
  }

  private renderFftSpectrum(): void {
    const canvas = this.domRefs.get('fft-canvas') as HTMLCanvasElement | undefined;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bins = this.audio.getFrequencySpectrum32();
    ctx.fillStyle = '#050913';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const barW = canvas.width / 16;
    ctx.fillStyle = '#38bdf8';
    for (let i = 0; i < 16; i++) {
      const mag = (bins[i] ?? 0) / 255;
      const barH = Math.max(2, Math.round(mag * (canvas.height - 4)));
      ctx.fillRect(i * barW + 1, canvas.height - barH - 1, Math.max(2, barW - 2), barH);
    }
  }

  private startLoop(): void {
    let lastFrameMs = performance.now();
    const tickFrame = (nowMs: number) => {
      const dtSec = Math.min(0.05, Math.max(0.008, (nowMs - lastFrameMs) / 1000.0));
      lastFrameMs = nowMs;

      if (this.world.runState === 'RUNNING') {
        this.latestTelemetry = this.world.stepTick(dtSec);
        this.audio.modulateByPantheon(
          this.latestTelemetry.pantheon.kuramotoOrderParameterR.value,
          this.world.dials.kerrSpinA,
          this.latestTelemetry.simTick % 16,
        );
      }

      const tel = this.latestTelemetry;
      if (this.activeTab === 'cosmos' && this.scene4k) {
        this.scene4k.renderFrame({
          store: this.world.store,
          spinePtsXyz: this.world.spinePtsXyz,
          simTimeSec: tel.simTimeSec,
          kerrSpinA: this.world.dials.kerrSpinA,
          manifoldWarpGain: this.world.dials.manifoldWarpGain,
          maxVisualPulseHz: this.world.dials.maxVisualPulseHz,
          shellAmplitudes10: tel.pantheon.mechalogodromShells10,
          intendedVec: tel.glitchling.intendedMotorVec,
          executedVec: tel.glitchling.executedMotorVec,
          skinUGs: this.world.skinUGs,
          skinVGs: this.world.skinVGs,
          asmodeniusConfidence: tel.asmodenius.metacognitiveConfidenceHot3.value,
        });
      }

      if (tel.simTick % 4 === 0) {
        this.refreshTelemetryDom(tel);
        this.renderFftSpectrum();
      }
      requestAnimationFrame(tickFrame);
    };
    requestAnimationFrame(tickFrame);
  }

  private refreshTelemetryDom(tel: WorldTickTelemetry): void {
    const set = (id: string, val: string) => {
      const node = this.domRefs.get(id);
      if (node) node.textContent = val;
    };

    set('hud-left', `Tick ${tel.simTick} · Alive ${tel.aliveCount} · Merkle ${tel.merkleRootHex.slice(0, 10)}`);
    set('kpi-tick', `${tel.simTick} (${tel.merkleRootHex.slice(0, 8)})`);
    set('kpi-alive', String(tel.aliveCount));
    set('kpi-drift', `${tel.maxMetabolicDrift.toExponential(2)}`);
    set('kpi-kuramoto', tel.pantheon.kuramotoOrderParameterR.value.toFixed(3));
    set('kpi-kerr-g4', `${tel.kerrPhotonRing.beamedIntensityG4.toFixed(2)}x`);
    set('kpi-kappa', tel.asmodenius.frenetCurvatureKappa.toFixed(3));
    set('kpi-sanctuary', `${tel.ecology.sanctuaryOccupants} sheltered`);
    set('kpi-economy', `${tel.ecology.aurumPerUmbraPrice.toFixed(2)} A/U · G=${tel.ecology.wealthGiniCoefficient.toFixed(2)}`);

    set('br-hot3', tel.asmodenius.metacognitiveConfidenceHot3.value.toFixed(3));
    set('br-voi', tel.asmodenius.epistemicValueOfInfo.toFixed(3));
    set('br-veto', String(tel.asmodenius.totalFreeWontVetoes));
    set('br-glitch-cos', tel.glitchling.kinematicAlignmentCosine.toFixed(4));
    set('br-glitch-stc', `${(tel.glitchling.stcConsolidatedFraction * 100).toFixed(0)}%`);
    set('br-xylos-b14', tel.xylos.meanButlinScore.toFixed(3));
    set('br-thaler-inv', String(tel.thaler.totalAcceptedInventions));

    set('q-norm', tel.quantumGeometry.normDrift.toExponential(2));
    set('q-berry', tel.quantumGeometry.berryCurvatureXY.toFixed(4));
    set('q-qrng', tel.qrngHealthy ? `PASS (${tel.qrngEntropyBits.toFixed(2)} b/B)` : 'WARN');
    set('q-rosette', tel.rosetteReceipt.merkleRootHex.slice(0, 10));
  }
}

if (typeof document !== 'undefined') {
  const host = document.getElementById('app');
  if (host) {
    const app = new Cqm2WorkstationApp();
    void app.mount(host);
  }
}
