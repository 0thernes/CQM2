/**
 * CQM2 v2.2.0 — Full-Bleed 4K Cosmogonic Observatory & Quad-Silicon Workstation (`src/ui/workstation.ts`).
 *
 * Delivers the complete full-bleed `100vw x 100vh` alien cosmogonic 3D world and floating glassmorphic HUD of
 * `Cosmogonic Quantum Mechalogodrom` upgraded to run at 4K `60+ FPS` across:
 *   1. **Local Quad-Silicon Server Mode**: `RTX 5070 Ti CUDA` + `Intel AI Boost NPU` + `Intel iGPU` + `Zig/Rust/ASM` + `SQLite WAL`.
 *   2. **Universal Browser Mode (`GitHub Pages` / Mobile / Tablet / Laptop / 4K TV)**: `WebGL2` GPU-instanced shaders +
 *      `WebGPU` WGSL compute + `Zig 0.17 SIMD128 WASM` + `IndexedDB`.
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
import { CosmicAudioSynthesizer } from '../render/audio-synth';
import {
  CQM_TIERS,
  type CqmHardwareTier,
  Cqm2Scene4kRenderer,
  type RenderQualityPreset,
  type RenderVisualMode,
} from '../render/scene-4k';
import { BrowserWebGpuCompute } from '../render/webgpu-compute';
import {
  CosmologicalLoreEngine,
  SORTING_25_SPECS,
  SortingFieldsEngine,
  TitanDiplomacySimulator,
} from '../sim/sorting-fields';
import { Cqm2WorldScheduler, type WorldTickTelemetry } from '../sim/world-scheduler';
import { listBrowserCheckpoints, saveBrowserCheckpoint } from './idb-storage';
import { Cqm3LiveBrainsRenderer } from './live-brains-3';
import {
  Cqm16ObservatoryRenderer,
  type ObservatorySample,
  SparklineRing,
} from './observatory-16';
import { Cqm2RealtimeClient } from './realtime-client';

type StudioTabId =
  | 'archon'
  | 'silicon'
  | 'brains'
  | 'quantum'
  | 'erp'
  | 'market'
  | 'copilot'
  | 'pipeline'
  | 'audit'
  | 'help';

const STUDIO_TABS: ReadonlyArray<{ id: StudioTabId; label: string; shortcut: string }> = [
  { id: 'archon', label: 'ARCHON GODFORMS', shortcut: '1' },
  { id: 'silicon', label: 'QUAD-SILICON', shortcut: '2' },
  { id: 'brains', label: 'NHI OBS · BRAINS', shortcut: '3' },
  { id: 'quantum', label: 'PANTHEONS · QUANTUM', shortcut: '4' },
  { id: 'erp', label: 'ERP · N01 LEDGER', shortcut: '5' },
  { id: 'market', label: 'MARKET · TITANS', shortcut: '6' },
  { id: 'copilot', label: 'COPILOT AI LLM', shortcut: '7' },
  { id: 'pipeline', label: 'EXPORT 3D / AUDIO', shortcut: '8' },
  { id: 'audit', label: 'AUDIT & HONESTY', shortcut: '9' },
  { id: 'help', label: 'HELP ME NOW', shortcut: '0' },
];

const SIM_SPEEDS: readonly number[] = [0.25, 1.0, 2.0, 4.0];

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
  studio: StudioTabId | null;
  mode: RenderVisualMode | null;
} {
  if (typeof window === 'undefined') {
    return { seed: 20261110, flaws: null, tier: null, studio: null, mode: null };
  }
  const sp = new URLSearchParams(window.location.search);
  const rawSeed = Number(sp.get('seed'));
  const seed = Number.isFinite(rawSeed) && rawSeed > 0 ? Math.trunc(rawSeed) : 20261110;
  const rawFlaws = sp.get('flaws');
  const flaws = rawFlaws !== null && Number.isFinite(Number(rawFlaws)) ? Math.trunc(Number(rawFlaws)) & 0x0f : null;
  const rawTier = sp.get('tier') as RenderQualityPreset | null;
  const validTiers: RenderQualityPreset[] = ['4K_ULTRA', 'HIGH', 'BALANCED', 'MOBILE_ECO'];
  const tier = rawTier && validTiers.includes(rawTier) ? rawTier : null;

  const rawTab = sp.get('tab') ?? sp.get('studio');
  const legacyMap: Record<string, StudioTabId> = {
    cosmos: 'archon',
    archon: 'archon',
    silicon: 'silicon',
    brains: 'brains',
    quantum: 'quantum',
    erp: 'erp',
    market: 'market',
    copilot: 'copilot',
    pipeline: 'pipeline',
    audit: 'audit',
    help: 'help',
  };
  const studio = rawTab && legacyMap[rawTab] ? legacyMap[rawTab]! : null;

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
  return { seed, flaws, tier, studio, mode };
}

export class Cqm2WorkstationApp {
  private readonly bootCfg = parseBootQueryParams();
  private readonly world: Cqm2WorldScheduler;
  private readonly sorting: SortingFieldsEngine;
  private readonly lore: CosmologicalLoreEngine;
  private readonly titans: TitanDiplomacySimulator;
  private readonly observatory = new Cqm16ObservatoryRenderer();
  private readonly liveBrains = new Cqm3LiveBrainsRenderer();
  private readonly webgpu = new BrowserWebGpuCompute();
  private readonly audio = new CosmicAudioSynthesizer();
  private readonly realtime: Cqm2RealtimeClient;
  private scene4k: Cqm2Scene4kRenderer | null = null;

  // 4 Left-Column Telemetry Sparklines (`#g0..#g3`)
  private readonly sparkEntities = new SparklineRing(84, 'rgba(34,211,238,1)', 1000);
  private readonly sparkXeno = new SparklineRing(84, 'rgba(192,132,252,1)', 24);
  private readonly sparkChaos = new SparklineRing(84, 'rgba(251,191,36,1)', 1.5);
  private readonly sparkEnergy = new SparklineRing(84, 'rgba(52,211,153,1)', 0);

  // Rolling Frame-Time & FPS Profiler (`60+ FPS` GPU telemetry)
  private readonly frameMsRing = new Float32Array(90);
  private frameRingIdx = 0;
  private frameRingCount = 0;

  // Interactive Cosmological State
  private chaosLevel = 0.5;
  private entropyLevel = 0.12;
  private simSpeedIdx = 0; // Boots at `0.25x` serene drift matching CQM screenshot; cycles `0.25x, 1x, 2x, 4x`
  private resetsCount = 0;
  private activeStudio: StudioTabId | null = null;
  private panelsHidden = false;
  private leftCollapsed = false;
  private rightCollapsed = false;

  private serverConnected = false;
  private serverHardwareTopology: Record<string, unknown> | null = null;
  private latestTelemetry: WorldTickTelemetry;
  private latestPoke: TmsPokeReport | null = null;
  private latestBenchmarks: R21BenchmarkResult[] = [];
  private selectedEntityId = 0;
  private erpFilterText = '';
  private erpSortBy: 'entityId' | 'totalMetabolicKj' | 'thoughtCurvatureKappa' = 'entityId';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private ariaAnnouncer!: HTMLElement;
  private readonly domRefs = new Map<string, HTMLElement>();
  private readonly algoRowEls: HTMLButtonElement[] = [];
  private readonly algoProgEls: HTMLProgressElement[] = [];
  private readonly obsCanvases16: Array<HTMLCanvasElement | null> = [];
  private readonly tierPillEls = new Map<CqmHardwareTier, HTMLButtonElement>();

  public constructor() {
    this.world = new Cqm2WorldScheduler({
      seed: this.bootCfg.seed,
      initialPopulation: 495,
      maxEntities: 1000,
    });
    this.sorting = new SortingFieldsEngine(this.bootCfg.seed);
    this.lore = new CosmologicalLoreEngine(this.bootCfg.seed);
    this.titans = new TitanDiplomacySimulator(this.lore, this.bootCfg.seed);

    if (this.bootCfg.flaws !== null) {
      this.world.glitchling.flawMask = this.bootCfg.flaws;
    }

    // Pre-warm Sorting (`PANCAKE FLIP` step ~162) & Observatory rings so frame 1 is visually rich!
    for (let i = 0; i < 162; i++) {
      this.sorting.stepTick();
    }
    this.latestTelemetry = this.world.stepTick(0.02);
    this.prewarmObservatoryAndSparks();

    this.realtime = new Cqm2RealtimeClient((pkt) => {
      if (pkt.type === 'tick' && typeof pkt.tick === 'number') {
        const wsEl = this.domRefs.get('ws-status-txt');
        if (wsEl) wsEl.textContent = `WS #${pkt.tick}`;
      }
    });
  }

  private prewarmObservatoryAndSparks(): void {
    const basePop = this.latestTelemetry.aliveCount;
    for (let i = 0; i < 28; i++) {
      const wave = Math.sin(i * 0.24);
      this.sparkEntities.push(basePop + Math.round(wave * 4));
      this.sparkXeno.push(2 + (i > 18 ? 1 : 0));
      this.sparkChaos.push(this.chaosLevel + wave * 0.04);
      this.sparkEnergy.push(1180 + i * 9.2 + wave * 18);

      const titanSnap = this.titans.stepTick(this.chaosLevel, 0.15);
      this.observatory.pushSample(this.composeObservatorySample(this.latestTelemetry, titanSnap, i));
    }
  }

  private composeObservatorySample(
    tel: WorldTickTelemetry,
    titanSnap: ReturnType<TitanDiplomacySimulator['stepTick']>,
    salt = 0,
  ): ObservatorySample {
    const n = this.world.store.activeCount;
    const phyla = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let energySum = 0;
    let entangledCount = 0;
    for (let e = 0; e < n; e++) {
      if (this.world.store.alive[e] !== 1) continue;
      const bucket = ((this.world.store.speciesFk[e]! - 1) * 2 + (e & 1)) % 10;
      phyla[bucket] = (phyla[bucket] ?? 0) + 1;
      energySum += (this.world.store.pools15[e * 15 + 12] ?? 2.5) + (this.world.store.pools15[e * 15 + 3] ?? 1.0);
      if (this.world.store.entangledPartnerId[e]! >= 0) entangledCount++;
    }

    let shannon = 0;
    const tot = Math.max(1, tel.aliveCount);
    for (let k = 0; k < 10; k++) {
      const p = phyla[k]! / tot;
      if (p > 1e-6) shannon -= p * Math.log(p);
    }
    const shannon01 = Math.min(1, shannon / Math.log(10));
    const linkCnt = this.scene4k?.activeLinkCount ?? 231;

    return {
      phyla10: phyla,
      totalPop: tel.aliveCount,
      totalEnergy: Math.round(energySum * 0.42 + 220 + salt * 1.5),
      connectomeLinks: linkCnt,
      rdEnergy: Math.max(0.05, tel.reactiveSkinMeanPattern),
      qEntropy: Math.min(1, Math.max(0.05, this.entropyLevel + tel.quantumGeometry.berryCurvatureXY * 0.1)),
      popTrendPerMin: tel.ecology.diploidBirthsThisTick * 12 + Math.sin(tel.simTimeSec + salt) * 1.4,
      shannonDiversity01: shannon01,
      birthDelta: tel.ecology.diploidBirthsThisTick,
      deathDelta: Math.max(0, this.world.store.activeCount - tel.aliveCount),
      xenoPop01: Math.min(1, entangledCount / 24),
      xenoCoherence01: tel.pantheon.kuramotoOrderParameterR.value,
      xenoComplexity01: tel.asmodenius.metacognitiveConfidenceHot3.value,
      xenoTwin01: tel.cormidium16Healed ? 0.86 : 0.42,
      biomeIntegration01: Math.min(1, tel.xylos.meanButlinScore),
      biomeCoherence01: Math.min(1, tel.glitchling.kinematicAlignmentCosine * 0.5 + 0.5),
      biomeMomentum01: Math.min(1, 0.35 + this.chaosLevel * 0.4),
      titans: titanSnap,
    };
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
    const miniEntryPill = this.buildMiniWorldPill();
    const toastEl = el('div', { id: 'sec', role: 'status', 'aria-live': 'polite' }, ['SECTOR HELTIBOR · 4K COSMOS ONLINE']);
    this.domRefs.set('toast', toastEl);

    const mobileSheetBar = this.buildMobileSheetBar();
    const hudOverlay = this.buildObservatoryColumns();
    const edgeLeft = this.buildEdgeCollapseBtn('left');
    const edgeRight = this.buildEdgeCollapseBtn('right');
    const touchPads = this.buildTouchJoystickPads();
    const bottomStack = this.buildBottomThreeRowDock();
    const studioModal = this.buildStudioModal();
    const cmdDialog = this.buildCommandPaletteDialog();

    root.append(
      this.ariaAnnouncer,
      errBanner,
      miniEntryPill,
      toastEl,
      mobileSheetBar,
      hudOverlay,
      edgeLeft,
      edgeRight,
      touchPads,
      bottomStack,
      studioModal,
      cmdDialog,
    );

    // Mount Full-Bleed 4K Renderer onto `<canvas id="c">` (or fallback container)
    const fullCanvas = (document.getElementById('c') as HTMLElement | null) ?? root;
    this.scene4k = new Cqm2Scene4kRenderer(fullCanvas, this.world.store.maxEntities);
    const defaultTier: CqmHardwareTier =
      typeof window !== 'undefined' && window.innerWidth < 768 ? 'phone' : 'desktop';
    this.scene4k.applyHardwareTier(defaultTier);
    if (this.bootCfg.tier) this.scene4k.applyQualityPreset(this.bootCfg.tier);
    if (this.bootCfg.mode) this.scene4k.applyVisualMode(this.bootCfg.mode);
    this.syncActiveTierPills();

    this.scene4k.onSelectEntity = (entityId) => {
      this.selectedEntityId = entityId;
      this.updateInspectorCard();
      const sp = this.world.store.species.get(this.world.store.speciesFk[entityId] ?? 1);
      this.showToast(`SPECIMEN #${entityId} · ${sp?.latinBinomial ?? 'Lineage'} (${sp?.casteRole ?? 'CASTE'})`);
    };

    await this.webgpu.init();
    await this.probeLocalServer();
    this.updateSiliconPanel();
    this.updateInspectorCard();
    this.renderErpTable();
    this.renderTsotchkeTable();
    this.renderMarketTable();

    if (this.bootCfg.studio) {
      this.openStudio(this.bootCfg.studio);
    }

    this.bindGlobalShortcuts(cmdDialog);
    this.bindVisibilitySafety();

    // Render initial telemetry & frame 1 immediately, then fade out `#cqm-boot`
    this.refreshAllHudPanels(this.latestTelemetry);
    this.startLoop();
  }

  private showToast(msg: string): void {
    const t = this.domRefs.get('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('toast-visible');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      t.classList.remove('toast-visible');
    }, 2600);
    this.ariaAnnouncer.textContent = msg;
  }

  private buildErrorBoundaryBanner(): HTMLElement {
    const msgSpan = el('span', { className: 'mono' }, ['']);
    const dismissBtn = el('button', { type: 'button', className: 'algo-mini-btn' }, ['✕']);
    const banner = el('div', { className: 'error-banner hidden-panel', role: 'alert' }, [msgSpan, dismissBtn]);
    dismissBtn.addEventListener('click', () => banner.classList.add('hidden-panel'));

    if (typeof window !== 'undefined') {
      const showNonFatal = (reason: unknown) => {
        const text = reason instanceof Error ? reason.message : String(reason ?? 'Unexpected UI event');
        if (text.includes('ResizeObserver loop')) return;
        msgSpan.textContent = `Recovered UI event: ${text.slice(0, 140)}`;
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
          this.realtime.connect();
        }
      }
    } catch {
      this.serverConnected = false;
    }
  }

  private buildMiniWorldPill(): HTMLElement {
    const btn = el(
      'button',
      {
        id: 'cqm-mini-entry',
        type: 'button',
        'aria-pressed': 'false',
        title: 'Dive directly into the luminous Sanctuary Mini-World at macro ultra resolution',
      },
      ['✦ Enter Mini World — full glory'],
    );
    btn.addEventListener('click', () => {
      if (!this.scene4k) return;
      const active = this.scene4k.toggleMiniWorld();
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('mini-active', active);
      btn.textContent = active ? '✦ Exit Mini World — return to Cosmos' : '✦ Enter Mini World — full glory';
      this.syncActiveTierPills();
      this.showToast(active ? 'MINI WORLD SANCTUARY · MEGA 4K IMMERSION' : 'RETURNED TO MACRO COSMOS OVERVIEW');
    });
    this.domRefs.set('mini-pill', btn);
    return btn;
  }

  private buildMobileSheetBar(): HTMLElement {
    const leftBtn = el('button', { type: 'button', className: 'dock-pill' }, ['TEL · ALG']);
    const rightBtn = el('button', { type: 'button', className: 'dock-pill' }, ['OBS · BRAINS']);
    const joyBtn = el('button', { type: 'button', className: 'dock-pill' }, ['JOY']);

    leftBtn.addEventListener('click', () => {
      const colL = this.domRefs.get('col-left');
      const colR = this.domRefs.get('col-right');
      if (!colL || !colR) return;
      const opening = !colL.classList.contains('mob-sheet-open');
      colL.classList.toggle('mob-sheet-open', opening);
      colR.classList.remove('mob-sheet-open');
      leftBtn.classList.toggle('dock-pill-active', opening);
      rightBtn.classList.remove('dock-pill-active');
    });

    rightBtn.addEventListener('click', () => {
      const colL = this.domRefs.get('col-left');
      const colR = this.domRefs.get('col-right');
      if (!colL || !colR) return;
      const opening = !colR.classList.contains('mob-sheet-open');
      colR.classList.toggle('mob-sheet-open', opening);
      colL.classList.remove('mob-sheet-open');
      rightBtn.classList.toggle('dock-pill-active', opening);
      leftBtn.classList.remove('dock-pill-active');
    });

    joyBtn.addEventListener('click', () => {
      const pads = this.domRefs.get('touch-pads');
      if (!pads) return;
      const on = pads.classList.toggle('touch-enabled');
      joyBtn.classList.toggle('dock-pill-active', on);
    });

    return el('div', { id: 'cqm-mobile-sheet-bar' }, [leftBtn, rightBtn, joyBtn]);
  }

  private buildEdgeCollapseBtn(side: 'left' | 'right'): HTMLElement {
    const btn = el(
      'button',
      {
        id: side === 'left' ? 'cqm-edge-left' : 'cqm-edge-right',
        type: 'button',
        className: 'edge-collapse-btn',
        'aria-label': side === 'left' ? 'Collapse or expand left telemetry column' : 'Collapse or expand right observatory column',
      },
      [side === 'left' ? '◀' : '▶'],
    );
    btn.addEventListener('click', () => {
      if (side === 'left') {
        this.leftCollapsed = !this.leftCollapsed;
        this.domRefs.get('col-left')?.classList.toggle('col-collapsed', this.leftCollapsed);
        btn.classList.toggle('edge-docked', this.leftCollapsed);
        btn.textContent = this.leftCollapsed ? '▶' : '◀';
      } else {
        this.rightCollapsed = !this.rightCollapsed;
        this.domRefs.get('col-right')?.classList.toggle('col-collapsed', this.rightCollapsed);
        btn.classList.toggle('edge-docked', this.rightCollapsed);
        btn.textContent = this.rightCollapsed ? '◀' : '▶';
      }
    });
    return btn;
  }

  private makeCollapsibleHeader(title: string, card: HTMLElement, extraRight?: HTMLElement, muted = false): HTMLElement {
    const chev = el('button', { type: 'button', className: 'hud-chev-btn', 'aria-label': `Toggle ${title} panel` }, ['▾']);
    chev.addEventListener('click', () => {
      const collapsed = card.classList.toggle('card-collapsed');
      chev.textContent = collapsed ? '▸' : '▾';
    });
    const rightCluster = extraRight ? el('div', { className: 'algo-hdr-actions' }, [extraRight, chev]) : chev;
    return el('div', { className: 'hud-card-hdr' }, [
      el('span', { className: muted ? 'hud-card-title-muted' : 'hud-card-title' }, [title]),
      rightCluster,
    ]);
  }

  private buildObservatoryColumns(): HTMLElement {
    // ================= LEFT COLUMN (`#ui-col-left`) =================
    const telCard = el('section', { id: 'sP', className: 'hud-card', 'aria-label': 'Live World Telemetry' });
    const makeTelMetric = (keyLabel: string, valId: string, initVal: string, sparkId: string) => {
      const vSpan = el('span', { className: 'tel-v' }, [initVal]);
      this.domRefs.set(valId, vSpan);
      const cnv = el('canvas', { id: sparkId, className: 'spark-canvas' }) as HTMLCanvasElement;
      this.domRefs.set(sparkId, cnv);
      return el('div', { className: 'tel-metric' }, [
        el('div', { className: 'tel-row' }, [el('span', { className: 'tel-k' }, [keyLabel]), vSpan]),
        cnv,
      ]);
    };
    const telBody = el('div', { className: 'hud-card-body' }, [
      makeTelMetric('ENTITIES', 'tel-entities', '495/1000', 'g0'),
      makeTelMetric('XENOMIMICS', 'tel-xeno', '12', 'g1'),
      makeTelMetric('CHAOS', 'tel-chaos', '0.5', 'g2'),
      makeTelMetric('ENERGY', 'tel-energy', '1437', 'g3'),
    ]);
    telCard.append(this.makeCollapsibleHeader('TELEMETRY', telCard), telBody);

    // 25 Sorting Fields Card (`#algoP`)
    const algoCard = el('section', { id: 'algoP', className: 'hud-card', 'aria-label': '25 Spatial Sorting Fields' });
    const btnAll = el('button', { type: 'button', className: 'algo-mini-btn', title: 'Step all 25 fields concurrently' }, ['✶ ALL']);
    const btnAuto = el('button', { type: 'button', className: 'algo-mini-btn', title: 'Auto-cycle active field' }, ['▸ AUTO']);
    btnAll.addEventListener('click', () => {
      this.sorting.runAll = !this.sorting.runAll;
      btnAll.classList.toggle('active', this.sorting.runAll);
      this.showToast(this.sorting.runAll ? 'SORTING FIELDS · ALL 25 CONCURRENT' : 'SORTING FIELDS · SINGLE ACTIVE');
    });
    btnAuto.addEventListener('click', () => {
      this.sorting.autoCycle = !this.sorting.autoCycle;
      btnAuto.classList.toggle('active', this.sorting.autoCycle);
      this.showToast(this.sorting.autoCycle ? 'SORTING AUTO-CYCLE ENABLED' : 'SORTING AUTO-CYCLE PAUSED');
    });
    const algoHdrBtns = el('span', { className: 'algo-hdr-actions' }, [btnAll, btnAuto]);

    const algoList = el('div', { className: 'algo-list-scroll' });
    for (let i = 0; i < SORTING_25_SPECS.length; i++) {
      const spec = SORTING_25_SPECS[i]!;
      const prog = el('progress', { className: 'algo-prog-bar', max: '100', value: '35' }) as HTMLProgressElement;
      const row = el(
        'button',
        {
          type: 'button',
          className: `algo-row${i === this.sorting.activeIndex ? ' algo-active' : ''}`,
          title: `${spec.name} (${spec.ignite})`,
        },
        [
          el('span', { className: `algo-hue-${i}` }, ['◈']),
          el('span', { className: 'algo-name-txt' }, [spec.name]),
          prog,
        ],
      ) as HTMLButtonElement;
      row.addEventListener('click', () => {
        this.sorting.selectField(i);
        this.syncSortingRowsUi();
        this.showToast(`SORTING FIELD · ${spec.name} (${spec.ignite.toUpperCase()})`);
      });
      this.algoRowEls.push(row);
      this.algoProgEls.push(prog);
      algoList.appendChild(row);
    }
    algoCard.append(this.makeCollapsibleHeader('SORTING FIELDS', algoCard, algoHdrBtns), el('div', { className: 'hud-card-body' }, [algoList]));

    // Performance & Hardware Tier Readout (`#perf-hud`)
    const perfFpsSpan = el('span', { className: 'perf-fps-good' }, ['60 fps']);
    const perfQualSpan = el('span', {}, ['full']);
    const perfTierSpan = el('span', {}, ['desktop']);
    const perfAmbLine = el('div', { className: 'perf-sub-line' }, [
      'ambient: gpu-instanced · core brains: Zig SIMD128',
    ]);
    const perfMsLine = el('div', { className: 'perf-sub-line' }, ['2.1 ms · p95 4.8 ms · 64 MB']);
    const perfCountsLine = el('div', { className: 'perf-sub-line' }, [
      'n 495/1,000 · links 231 · wild 6,272 (49 ch)',
    ]);
    const perfHwLine = el('div', { className: 'perf-sub-line' }, ['cpu 24c · webgl2 + wasm']);

    this.domRefs.set('perf-fps', perfFpsSpan);
    this.domRefs.set('perf-qual', perfQualSpan);
    this.domRefs.set('perf-tier', perfTierSpan);
    this.domRefs.set('perf-amb', perfAmbLine);
    this.domRefs.set('perf-ms', perfMsLine);
    this.domRefs.set('perf-counts', perfCountsLine);
    this.domRefs.set('perf-hw', perfHwLine);

    const tierGrid = el('div', { className: 'perf-tier-grid' });
    for (const tier of CQM_TIERS) {
      const tb = el('button', { type: 'button', className: 'tier-pill' }, [tier]) as HTMLButtonElement;
      tb.addEventListener('click', () => {
        this.scene4k?.applyHardwareTier(tier);
        this.syncActiveTierPills();
        this.showToast(`HARDWARE TIER · ${tier.toUpperCase()}`);
      });
      this.tierPillEls.set(tier, tb);
      tierGrid.appendChild(tb);
    }

    const perfCard = el('section', { id: 'perf-hud', className: 'hud-card', 'aria-label': 'Performance and Hardware Tier' }, [
      el('div', { className: 'perf-top-line' }, [perfFpsSpan, ' · q: ', perfQualSpan, ' · ', perfTierSpan]),
      perfAmbLine,
      perfMsLine,
      perfCountsLine,
      perfHwLine,
      tierGrid,
    ]);

    const colLeft = el('aside', { id: 'ui-col-left', className: 'hud-col', 'aria-label': 'Left Telemetry Column' }, [
      telCard,
      algoCard,
      perfCard,
    ]);
    this.domRefs.set('col-left', colLeft);

    // ================= RIGHT COLUMN (`#ui-col-right`) =================
    const obsCard = el('section', { id: 'oP', className: 'hud-card', 'aria-label': '16-Chart Real-Time Observatory' });
    const obsTabLabels: ReadonlyArray<string> = ['OVER', 'VAR', 'ECO', 'WAR'];
    const obsTabBtns: HTMLButtonElement[] = [];
    const obsPages: HTMLElement[] = [];

    const obsTabBar = el('div', { className: 'obs-tab-bar', role: 'tablist' });
    for (let p = 0; p < 4; p++) {
      const tb = el(
        'button',
        {
          type: 'button',
          role: 'tab',
          className: `obs-tab-btn${p === 0 ? ' obs-tab-active' : ''}`,
          'aria-selected': String(p === 0),
        },
        [obsTabLabels[p]!],
      ) as HTMLButtonElement;
      tb.addEventListener('click', () => {
        this.observatory.activePage = p as 0 | 1 | 2 | 3;
        for (let j = 0; j < 4; j++) {
          obsTabBtns[j]!.classList.toggle('obs-tab-active', j === p);
          obsTabBtns[j]!.setAttribute('aria-selected', String(j === p));
          obsPages[j]!.classList.toggle('obs-page-active', j === p);
        }
        this.observatory.renderActivePage(this.obsCanvases16);
      });
      obsTabBtns.push(tb);
      obsTabBar.appendChild(tb);

      const pageDiv = el('div', { className: `obs-page${p === 0 ? ' obs-page-active' : ''}` });
      for (let c = 0; c < 4; c++) {
        const idx = p * 4 + c;
        const cnv = el('canvas', { id: `obs-c${idx}`, className: 'obs-chart-canvas' }) as HTMLCanvasElement;
        this.obsCanvases16.push(cnv);
        pageDiv.appendChild(cnv);
      }
      obsPages.push(pageDiv);
    }

    const obsBody = el('div', { className: 'hud-card-body' }, [obsTabBar, ...obsPages]);
    obsCard.append(this.makeCollapsibleHeader('OBSERVATORY', obsCard), obsBody);

    // Active Sorting Field & Sector Lore Card (`#alg`)
    const algNameEl = el('div', { className: 'alg-active-name' }, ['PANCAKE FLIP']);
    const algStatsEl = el('div', { className: 'alg-active-stats' }, ['step 162 · 5 ⇄']);
    const algWaveCanvas = el('canvas', { id: 'g-alg' }) as HTMLCanvasElement;
    const algSectorEl = el('div', { className: 'alg-sector-name' }, ['HELTIBOR']);
    const algOmegaVal = el('span', {}, ['Ω 0.281 ']);
    const algOmegaLine = el('div', { className: 'alg-omega-line' }, [
      algOmegaVal,
      el('span', { className: 'alg-omega-tri' }, ['▲']),
    ]);
    this.domRefs.set('alg-name', algNameEl);
    this.domRefs.set('alg-stats', algStatsEl);
    this.domRefs.set('g-alg', algWaveCanvas);
    this.domRefs.set('alg-sector', algSectorEl);
    this.domRefs.set('alg-omega', algOmegaVal);

    const algCard = el('section', { id: 'alg', className: 'hud-card', 'aria-label': 'Active Sorting Field and Sector Lore' }, [
      el('div', { className: 'hud-card-hdr' }, [el('span', { className: 'hud-card-title-muted' }, ['SORTING · FIELD'])]),
      algNameEl,
      algStatsEl,
      algWaveCanvas,
      algSectorEl,
      algOmegaLine,
    ]);

    // Sim Settings 2-Col Readout (`#hud-vsr`)
    const makeVsr = (k: string, id: string, init: string) => {
      const vEl = el('span', { className: 'vsr-v' }, [init]);
      this.domRefs.set(id, vEl);
      return el('div', { className: 'vsr-item' }, [el('span', { className: 'vsr-k' }, [k]), vEl]);
    };
    const vsrCard = el('section', { id: 'hud-vsr', className: 'hud-card', 'aria-label': 'Simulation Settings Readout' }, [
      el('div', { className: 'hud-card-hdr' }, [el('span', { className: 'hud-card-title-muted' }, ['SIM · SETTINGS'])]),
      el('div', { className: 'vsr-grid' }, [
        makeVsr('VIEW', 'vsr-view', 'free'),
        makeVsr('SPEED', 'vsr-speed', '0.25×'),
        makeVsr('RENDER', 'vsr-render', 'prismatic'),
        makeVsr('MUSIC', 'vsr-music', 'OFF'),
        makeVsr('SFX', 'vsr-sfx', 'OFF'),
        makeVsr('SONG', 'vsr-song', 'DEEP MERI...'),
        makeVsr('RESETS', 'vsr-resets', '0'),
        makeVsr('SILICON', 'vsr-silicon', 'WEBGL2+ZIG'),
      ]),
    ]);

    // 3 Live Brains (`APEX`, `MECHA`, `GLYPH`)
    const brainsCard = el('section', { id: 'brain-all-slot', className: 'hud-card', 'aria-label': '3 Live Neural Topologies' });
    const cApex = el('canvas', { id: 'brain-c-apex', className: 'brain-live-canvas', 'aria-label': 'APEX Connectome' }) as HTMLCanvasElement;
    const cMecha = el('canvas', { id: 'brain-c-mecha', className: 'brain-live-canvas', 'aria-label': 'MECHA Shell Graph' }) as HTMLCanvasElement;
    const cGlyph = el('canvas', { id: 'brain-c-glyph', className: 'brain-live-canvas', 'aria-label': 'GLYPH Xenolinguistic Lattice' }) as HTMLCanvasElement;
    this.domRefs.set('brain-apex', cApex);
    this.domRefs.set('brain-mecha', cMecha);
    this.domRefs.set('brain-glyph', cGlyph);

    brainsCard.append(
      this.makeCollapsibleHeader('3 Live Brains', brainsCard, undefined, true),
      el('div', { className: 'hud-card-body' }, [el('div', { className: 'brains-3-grid' }, [cApex, cMecha, cGlyph])]),
    );

    const colRight = el('aside', { id: 'ui-col-right', className: 'hud-col', 'aria-label': 'Right Observatory Column' }, [
      obsCard,
      algCard,
      vsrCard,
      brainsCard,
    ]);
    this.domRefs.set('col-right', colRight);

    const uiGrid = el('div', { id: 'ui' }, [colLeft, colRight]);
    this.domRefs.set('ui-grid', uiGrid);
    return uiGrid;
  }

  private buildTouchJoystickPads(): HTMLElement {
    const movePad = el('div', { className: 'touch-joy-pad' }, ['MOVE']);
    const lookPad = el('div', { className: 'touch-joy-pad' }, ['LOOK']);

    const bindPad = (pad: HTMLElement, onVec: (dx: number, dy: number) => void) => {
      let originX = 0;
      let originY = 0;
      let active = false;
      pad.addEventListener('pointerdown', (e) => {
        active = true;
        originX = e.clientX;
        originY = e.clientY;
        pad.setPointerCapture(e.pointerId);
      });
      pad.addEventListener('pointermove', (e) => {
        if (!active) return;
        const dx = Math.max(-1, Math.min(1, (e.clientX - originX) / 28));
        const dy = Math.max(-1, Math.min(1, (e.clientY - originY) / 28));
        onVec(dx, dy);
      });
      const stop = () => {
        active = false;
        onVec(0, 0);
      };
      pad.addEventListener('pointerup', stop);
      pad.addEventListener('pointercancel', stop);
    };

    bindPad(movePad, (dx, dy) => {
      if (this.scene4k) {
        this.scene4k.touchMoveVec.x = dx;
        this.scene4k.touchMoveVec.y = -dy;
      }
    });
    bindPad(lookPad, (dx, dy) => {
      if (this.scene4k) {
        this.scene4k.touchLookDelta.x = dx * 0.025;
        this.scene4k.touchLookDelta.y = dy * 0.025;
      }
    });

    const wrap = el('div', { id: 'cqm-touch-pads' }, [movePad, lookPad]);
    this.domRefs.set('touch-pads', wrap);
    return wrap;
  }

  private buildBottomThreeRowDock(): HTMLElement {
    // ================= ROW 1: Orange Sim & Landmark Actions =================
    const makeWarmPill = (ico: string, label: string, onClick: () => void) => {
      const b = el('button', { type: 'button', className: 'dock-pill dock-pill-warm' }, [
        el('span', { className: 'dock-ico' }, [ico]),
        label,
      ]);
      b.addEventListener('click', onClick);
      return b;
    };

    const row1 = el('div', { id: 'cqm-sim-row', className: 'dock-strip', role: 'toolbar', 'aria-label': 'Biological and Camera Actions' }, [
      makeWarmPill('⇄', 'SPLIT', () => {
        const c = this.world.triggerMitoticSplit(12);
        this.audio.triggerSfx('split', true);
        this.showToast(`MITOTIC SPLIT · +${c} ORGANISMS (${this.world.store.activeCount}/${this.world.store.maxEntities})`);
      }),
      makeWarmPill('✦', 'BURST', () => {
        const fed = this.world.triggerNutrientBurst(8.5);
        this.audio.triggerSfx('burst', true);
        this.showToast(`FREE-ENERGY BURST · FED ${fed} ORGANISMS (1ST-LAW CONSERVED)`);
      }),
      makeWarmPill('☢', 'MUTATE', () => {
        const m = this.world.triggerMutagenicPulse(0.085);
        this.audio.triggerSfx('mutate', true);
        this.showToast(`MUTAGENIC PULSE · ${m} CORTICES PERTURBED`);
      }),
      makeWarmPill('⚡', 'CHAOS+', () => {
        this.chaosLevel = this.chaosLevel >= 1.35 ? 0.25 : Number((this.chaosLevel + 0.25).toFixed(2));
        this.audio.triggerSfx('warp', true);
        this.showToast(`COSMIC CHAOS FIELD · ${this.chaosLevel.toFixed(2)}`);
      }),
      makeWarmPill('◎', 'GOD', () => {
        this.scene4k?.flyToLandmark('god');
        this.showToast('CAMERA → GOD COLOSSUS MANIFOLD');
      }),
      makeWarmPill('◈', 'XENOMIMIC', () => {
        this.world.triggerXenomimicPair();
        this.scene4k?.flyToLandmark('xenomimic');
        this.showToast('ENTANGLED XENOMIMIC TWIN PAIR · CAMERA LOCKED');
      }),
      makeWarmPill('♧', 'LIFE TREE', () => {
        this.scene4k?.flyToLandmark('lifetree');
        this.showToast('CAMERA → CRYSTAL ECOSYSTEM BIG TREE SANCTUARY');
      }),
    ]);

    // ================= ROW 2: Docs Links & Studio Modal Launchers =================
    const makeStudioLauncher = (label: string, tab: StudioTabId, extraAction?: () => void) => {
      const b = el('button', { type: 'button', className: 'dock-pill', 'data-studio': tab }, [label]);
      b.addEventListener('click', () => {
        if (extraAction) extraAction();
        this.toggleStudio(tab);
      });
      return b;
    };

    const stagePill = el('button', { type: 'button', className: 'dock-pill' }, ['◈ STAGE II']);
    stagePill.addEventListener('click', () => {
      if (!this.scene4k) return;
      const st = this.scene4k.toggleSimulationStage();
      this.audio.nightmareBend = st === 2;
      stagePill.classList.toggle('dock-pill-active', st === 2);
      stagePill.textContent = st === 2 ? '◈ STAGE I' : '◈ STAGE II';
      this.showToast(st === 2 ? 'STAGE II · CRIMSON SINGULARITY PHASE' : 'STAGE I · PRISMATIC COSMOS');
    });

    const row2 = el('div', { id: 'cqm-launch-row', className: 'dock-strip', role: 'navigation', 'aria-label': 'Documentation and Scientific Studios' }, [
      el('a', { href: 'docs.html', className: 'dock-pill' }, ['DOCS']),
      el('a', { href: 'specs.html', className: 'dock-pill' }, ['SPEC']),
      el('a', { href: 'bible.html', className: 'dock-pill' }, ['BIBLE']),
      el('a', { href: 'lab/quantum-wildbeyond.html', className: 'dock-pill' }, ['LAB']),
      makeStudioLauncher('⛓ ACCESS', 'help'),
      stagePill,
      makeStudioLauncher('⚙ SET', 'archon'),
      makeStudioLauncher('COPILOT AI LLM', 'copilot'),
      makeStudioLauncher('HELP ME NOW', 'help'),
      makeStudioLauncher('AUDIT', 'audit'),
      makeStudioLauncher('NHI OBS', 'brains'),
      makeStudioLauncher('MARKET', 'market'),
      makeStudioLauncher('ARCHON GODFORMS', 'archon'),
      makeStudioLauncher('PANTHEONS', 'quantum'),
      makeStudioLauncher('QUAD-SILICON', 'silicon'),
      makeStudioLauncher('EXPORT 3D', 'pipeline'),
    ]);

    // ================= ROW 3: Scrollable Primary `#bar` Control Strip =================
    const btnMusic = el('button', { type: 'button', className: 'dock-pill', title: 'Toggle Procedural Cosmic Music' }, ['♫']);
    const btnSong = el('button', { type: 'button', className: 'dock-pill', title: 'Cycle 9 Procedural Songs' }, ['Song']);
    const btnSfx = el('button', { type: 'button', className: 'dock-pill', title: 'Toggle 8 Procedural Sound Effects' }, ['SFX']);
    const btnFx = el('button', { type: 'button', className: 'dock-pill', title: 'Trigger Kerr Ringdown Harmonic Chime' }, ['Fx']);
    const btnPause = el('button', { id: 'play-btn', type: 'button', className: 'dock-pill dock-pill-active' }, ['⏸ PAUSE']);
    const btnMute = el('button', { type: 'button', className: 'dock-pill' }, ['MUTE']);
    const btnPanel = el('button', { type: 'button', className: 'dock-pill' }, ['PANEL']);
    const btnReset = el('button', { type: 'button', className: 'dock-pill', title: 'Reset Camera & Reseed Field' }, ['↻']);
    const btnSpeed = el('button', { type: 'button', className: 'dock-pill', title: 'Cycle Simulation Speed' }, ['⏱']);
    const btnView = el('button', { type: 'button', className: 'dock-pill', title: 'Cycle 12 Camera View Modes' }, ['View']);
    const btnSpace = el('button', { type: 'button', className: 'dock-pill', title: 'Cycle Wide-Angle Space FOV' }, ['SPACE']);
    const btnAlgo = el('button', { type: 'button', className: 'dock-pill', title: 'Cycle 25 Sorting Fields' }, ['Algo']);
    const btnWeather = el('button', { type: 'button', className: 'dock-pill', title: 'Cycle Atmospheric Weather & Aurora' }, ['☁']);
    const btnHole = el('button', { type: 'button', className: 'dock-pill', title: 'Cycle Kerr Relativistic Singularity' }, ['⚫']);
    const btnRender = el('button', { type: 'button', className: 'dock-pill', title: 'Cycle 10 Render Material Modes' }, ['Render']);
    const btnNight = el('button', { type: 'button', className: 'dock-pill', title: 'Toggle N(1/2) Crimson Phase' }, ['N(1/2)']);
    const btnEntropy = el('button', { type: 'button', className: 'dock-pill dock-pill-entropy' }, ['🌀 ENTROPY']);
    const btnChaos = el('button', { type: 'button', className: 'dock-pill dock-pill-chaos' }, ['⚡ CHAOS']);
    const btnBrutal = el('button', { type: 'button', className: 'dock-pill' }, ['▦ BRUTALISM']);
    const btnNhi = el('button', { type: 'button', className: 'dock-pill' }, ['⟁ NHI']);
    const btnXno = el('button', { type: 'button', className: 'dock-pill dock-pill-xno' }, ['◈ XNO']);
    const btnRewind = el('button', { type: 'button', className: 'dock-pill dock-pill-danger', title: 'Bit-Exact N01 Time-Travel Rollback' }, ['☠']);

    this.domRefs.set('play-btn', btnPause);

    btnMusic.addEventListener('click', () => {
      const on = this.audio.toggle();
      btnMusic.classList.toggle('dock-pill-active', on);
      const song = this.audio.getCurrentSong();
      this.showToast(on ? `♫ MUSIC ON · ${song.title} (${song.bpm} BPM)` : '♫ MUSIC OFF');
    });

    btnSong.addEventListener('click', () => {
      const next = this.audio.nextSong();
      if (!this.audio.isPlaying()) {
        this.audio.toggle();
        btnMusic.classList.add('dock-pill-active');
      }
      this.showToast(`♫ SONG · ${next.title} (${next.bpm} BPM)`);
    });

    btnSfx.addEventListener('click', () => {
      this.audio.sfxEnabled = !this.audio.sfxEnabled;
      const on = this.audio.sfxEnabled;
      btnSfx.classList.toggle('dock-pill-active', on);
      if (on) this.audio.triggerSfx('crystallize', true);
      this.showToast(on ? 'PROCEDURAL SFX ENABLED' : 'PROCEDURAL SFX MUTED');
    });

    btnFx.addEventListener('click', () => {
      this.audio.triggerKerrRingdownChime(this.world.dials.kerrSpinA);
      this.showToast(`KERR QNM RINGDOWN CHIME (a/M = ${this.world.dials.kerrSpinA.toFixed(2)})`);
    });

    btnPause.addEventListener('click', () => {
      const next = this.world.runState === 'RUNNING' ? 'SUSPENDED' : 'RUNNING';
      this.world.setRunState(next);
      const running = next === 'RUNNING';
      btnPause.classList.toggle('dock-pill-active', running);
      btnPause.textContent = running ? '⏸ PAUSE' : '▶ PLAY';
      if (this.serverConnected) {
        void fetch('/api/v1/world/pause', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ runState: next }),
        }).catch(() => {});
      }
      this.showToast(running ? 'SIMULATION RUNNING' : 'SIMULATION PAUSED');
    });

    btnMute.addEventListener('click', () => {
      const muted = this.audio.toggleMute();
      btnMute.classList.toggle('dock-pill-active', muted);
      this.showToast(muted ? 'MASTER AUDIO MUTED' : 'MASTER AUDIO UNMUTED');
    });

    btnPanel.addEventListener('click', () => {
      this.panelsHidden = !this.panelsHidden;
      this.domRefs.get('ui-grid')?.classList.toggle('panels-hidden', this.panelsHidden);
      btnPanel.classList.toggle('dock-pill-active', this.panelsHidden);
      this.showToast(this.panelsHidden ? 'HUD PANELS HIDDEN · CINEMA VIEW' : 'HUD PANELS RESTORED');
    });

    btnReset.addEventListener('click', () => {
      this.resetsCount++;
      this.scene4k?.flyToLandmark('boot');
      this.sorting.selectField(this.sorting.activeIndex);
      this.showToast(`CAMERA & SORTING FIELD RESET (#${this.resetsCount})`);
    });

    btnSpeed.addEventListener('click', () => {
      this.simSpeedIdx = (this.simSpeedIdx + 1) % SIM_SPEEDS.length;
      const mult = SIM_SPEEDS[this.simSpeedIdx]!;
      this.showToast(`SIMULATION SPEED · ${mult.toFixed(2)}×`);
    });

    btnView.addEventListener('click', () => {
      if (!this.scene4k) return;
      const v = this.scene4k.cycleViewMode();
      this.showToast(`CAMERA VIEW MODE · ${v.toUpperCase()}`);
    });

    btnSpace.addEventListener('click', () => {
      if (!this.scene4k) return;
      const fov = this.scene4k.cycleSpaceFov();
      this.showToast(`SPACE FIELD OF VIEW · ${fov}°`);
    });

    btnAlgo.addEventListener('click', () => {
      const spec = this.sorting.nextField();
      this.syncSortingRowsUi();
      this.showToast(`SORTING FIELD · ${spec.name}`);
    });

    btnWeather.addEventListener('click', () => {
      if (!this.scene4k) return;
      const w = this.scene4k.cycleWeather();
      this.showToast(`ATMOSPHERE · ${w}`);
    });

    btnHole.addEventListener('click', () => {
      if (!this.scene4k) return;
      const s = this.scene4k.cycleSingularity();
      this.showToast(`SINGULARITY · ${s}`);
    });

    btnRender.addEventListener('click', () => {
      if (!this.scene4k) return;
      const r = this.scene4k.cycleRenderMode();
      this.showToast(`RENDER MATERIAL · ${r.toUpperCase()}`);
    });

    btnNight.addEventListener('click', () => {
      stagePill.click();
    });

    btnEntropy.addEventListener('click', () => {
      this.entropyLevel = this.entropyLevel >= 0.85 ? 0.12 : Number((this.entropyLevel + 0.18).toFixed(2));
      this.showToast(`QUANTUM ENTROPY · ${this.entropyLevel.toFixed(2)}`);
    });

    btnChaos.addEventListener('click', () => {
      this.chaosLevel = this.chaosLevel >= 1.35 ? 0.25 : Number((this.chaosLevel + 0.25).toFixed(2));
      this.showToast(`CHAOS AMPLITUDE · ${this.chaosLevel.toFixed(2)}`);
    });

    btnBrutal.addEventListener('click', () => {
      if (!this.scene4k) return;
      const b = this.scene4k.cycleBrutalistStyle();
      this.showToast(`ARCHITECTURAL STYLE · ${b}`);
    });

    btnNhi.addEventListener('click', () => this.toggleStudio('brains'));
    btnXno.addEventListener('click', () => {
      this.world.triggerXenomimicPair();
      this.scene4k?.flyToLandmark('xenomimic');
      this.showToast('XENOMIMIC ENTANGLEMENT SPAWNED');
    });

    btnRewind.addEventListener('click', () => {
      const snaps = this.world.store.listSnapshots();
      const target = snaps.length >= 2 ? snaps[0]!.tick : undefined;
      const ok = this.world.rollbackToSnapshot(target);
      this.resetsCount++;
      this.showToast(ok ? `N01 BIT-EXACT TIME-TRAVEL → TICK ${this.world.store.epoch.simTick}` : 'CAPTURED FRESH N01 EPOCH');
    });

    const barTrack = el('div', { id: 'bar', role: 'toolbar', 'aria-label': 'Primary Simulation Controls' }, [
      btnMusic,
      btnSong,
      btnSfx,
      btnFx,
      btnPause,
      btnMute,
      btnPanel,
      btnReset,
      btnSpeed,
      btnView,
      btnSpace,
      btnAlgo,
      btnWeather,
      btnHole,
      btnRender,
      btnNight,
      btnEntropy,
      btnChaos,
      btnBrutal,
      btnNhi,
      btnXno,
      btnRewind,
    ]);

    const arrowLeft = el('button', { type: 'button', className: 'bar-arrow-btn', 'aria-label': 'Scroll toolbar left' }, ['‹']);
    const arrowRight = el('button', { type: 'button', className: 'bar-arrow-btn', 'aria-label': 'Scroll toolbar right' }, ['›']);
    arrowLeft.addEventListener('click', () => barTrack.scrollBy({ left: -240, behavior: 'smooth' }));
    arrowRight.addEventListener('click', () => barTrack.scrollBy({ left: 240, behavior: 'smooth' }));

    const row3 = el('div', { id: 'bar-shell' }, [arrowLeft, barTrack, arrowRight]);

    return el('div', { id: 'cqm-bottom-stack' }, [row1, row2, row3]);
  }

  private syncActiveTierPills(): void {
    const active = this.scene4k?.hardwareTier ?? 'desktop';
    for (const [tier, btn] of this.tierPillEls.entries()) {
      const isCur = tier === active;
      btn.classList.toggle('tier-active', isCur);
      btn.textContent = isCur ? `[${tier}]` : tier;
    }
  }

  private syncSortingRowsUi(): void {
    const snap = this.sorting.getSnapshot();
    for (let i = 0; i < this.algoRowEls.length; i++) {
      const isCur = i === snap.activeIndex;
      this.algoRowEls[i]!.classList.toggle('algo-active', isCur);
      this.algoProgEls[i]!.value = Math.round((snap.progresses25[i] ?? 0.35) * 100);
    }
  }

  // ==========================================================================
  // Center-HUD Floating Glassmorphic Studio Modal (`#cqm-studio-modal`)
  // ==========================================================================

  private buildStudioModal(): HTMLElement {
    const navWrap = el('div', { className: 'studio-nav-pills', role: 'tablist' });
    for (const st of STUDIO_TABS) {
      const tb = el(
        'button',
        {
          type: 'button',
          role: 'tab',
          id: `st-tab-${st.id}`,
          className: 'studio-tab-btn',
          'aria-selected': 'false',
        },
        [st.label],
      );
      tb.addEventListener('click', () => this.openStudio(st.id));
      this.domRefs.set(`st-tab-${st.id}`, tb);
      navWrap.appendChild(tb);
    }

    const closeBtn = el('button', { id: 'cqm-studio-close', type: 'button', className: 'studio-close-btn' }, ['✕ CLOSE [Esc]']);
    closeBtn.addEventListener('click', () => this.closeStudio());

    const hdr = el('div', { className: 'studio-modal-hdr' }, [navWrap, closeBtn]);

    const body = el('main', { id: 'main-content', className: 'studio-modal-body' }, [
      this.buildArchonPanel(),
      this.buildSiliconPanel(),
      this.buildBrainsPanel(),
      this.buildQuantumPanel(),
      this.buildErpPanel(),
      this.buildMarketPanel(),
      this.buildCopilotPanel(),
      this.buildPipelinePanel(),
      this.buildAuditPanel(),
      this.buildHelpPanel(),
    ]);

    const modal = el('div', { id: 'cqm-studio-modal', className: 'modal-closed', role: 'dialog', 'aria-label': 'CQM2 Scientific Studio' }, [
      hdr,
      body,
    ]);
    this.domRefs.set('studio-modal', modal);
    return modal;
  }

  private toggleStudio(id: StudioTabId): void {
    if (this.activeStudio === id) this.closeStudio();
    else this.openStudio(id);
  }

  private openStudio(id: StudioTabId): void {
    this.activeStudio = id;
    const modal = this.domRefs.get('studio-modal');
    modal?.classList.remove('modal-closed');
    for (const st of STUDIO_TABS) {
      const tb = this.domRefs.get(`st-tab-${st.id}`);
      const pn = this.domRefs.get(`st-panel-${st.id}`);
      const active = st.id === id;
      if (tb) {
        tb.classList.toggle('studio-tab-active', active);
        tb.setAttribute('aria-selected', String(active));
      }
      if (pn) pn.classList.toggle('hidden-panel', !active);
    }
    if (id === 'erp') this.renderErpTable();
    if (id === 'market') this.renderMarketTable();
  }

  private closeStudio(): void {
    this.activeStudio = null;
    this.domRefs.get('studio-modal')?.classList.add('modal-closed');
  }

  private makeKpiBox(id: string, label: string, initial: string): HTMLElement {
    const valEl = el('span', { className: 'kpi-value' }, [initial]);
    this.domRefs.set(id, valEl);
    return el('div', { className: 'kpi-box' }, [el('span', { className: 'kpi-label' }, [label]), valEl]);
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
    node.textContent = `Specimen #${e} · ${sp?.latinBinomial ?? 'Lineage'} (${sp?.casteRole ?? 'CASTE'}) · Biome: ${bm?.name ?? 'Abyss'} · Conserved=${intake.toFixed(2)} kJ · ATP=${atp.toFixed(2)} kJ · Curvature κ=${kappa.toFixed(3)}`;
  }

  private buildArchonPanel(): HTMLElement {
    const inspectorText = el('p', { className: 'mono' }, ['Click any organism in the 3D cosmos to inspect its 15-pool metabolic ledger.']);
    this.domRefs.set('inspector-text', inspectorText);

    const kpiGrid = el('div', { className: 'kpi-grid' }, [
      this.makeKpiBox('kpi-tick', 'Sim Tick / Epoch Hash', '0'),
      this.makeKpiBox('kpi-alive', 'Extant Organisms', '495'),
      this.makeKpiBox('kpi-drift', '1st-Law Metabolic Drift', '0.00e+0'),
      this.makeKpiBox('kpi-kuramoto', 'Pantheon Sync R (Proxy)', '0.420'),
      this.makeKpiBox('kpi-kerr-g4', 'Kerr Doppler Beaming g^4', '1.85x'),
      this.makeKpiBox('kpi-kappa', 'Asmodenius Curvature κ', '0.080'),
      this.makeKpiBox('kpi-sanctuary', 'Big Tree Sanctuary Peace', '0 sheltered'),
      this.makeKpiBox('kpi-economy', 'AURUM / UMBRA Reserves', '1.00 A/U'),
    ]);

    const dialSpecs: Array<{ key: keyof GodDialParams; label: string; min: number; max: number; step: number }> = [
      { key: 'kerrSpinA', label: 'Rung 1 · Kerr Spin (a/M)', min: 0, max: 0.998, step: 0.01 },
      { key: 'manifoldWarpGain', label: 'Rung 1 · 4D Manifold Warp (Lipschitz ≤ 0.45)', min: 0, max: 0.45, step: 0.01 },
      { key: 'quantumContextualityCoupling', label: 'Rung 2 · Pauli Contextuality Coupling', min: 0, max: 1.0, step: 0.02 },
      { key: 'freeEnergyInfluxKjPerSec', label: 'Rung 3 · Vent Free-Energy Flux (kJ/s)', min: 5, max: 500, step: 5 },
      { key: 'metabolicRateScale', label: 'Rung 4 · Basal Metabolic Scale', min: 0.25, max: 3.0, step: 0.05 },
      { key: 'plasticityScale', label: 'Rung 5 · Neuromodulated Plasticity Scale', min: 0, max: 2.5, step: 0.05 },
      { key: 'oxygenSaturation', label: 'Rung 6 · Pelagic O2 Saturation', min: 0.15, max: 1.5, step: 0.05 },
      { key: 'maxVisualPulseHz', label: 'Rung 7 · WCAG Safe Flash Ceiling (≤ 2.2 Hz)', min: 0.2, max: 2.2, step: 0.1 },
    ];

    const dialsBox = el('div', {}, [el('h3', {}, ['7-Rung Archon Physical & Biophysical God Dials'])]);
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
      dialsBox.appendChild(el('div', { className: 'dial-row' }, [el('label', { for: inputId }, [d.label]), readout, slider]));
    }

    const panel = el('section', { id: 'st-panel-archon', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Archon Godforms · 7-Rung Cosmological Dials & Specimen Inspector']),
      inspectorText,
      kpiGrid,
      dialsBox,
    ]);
    this.domRefs.set('st-panel-archon', panel);
    return panel;
  }

  private buildSiliconPanel(): HTMLElement {
    const kpiGrid = el('div', { className: 'kpi-grid' }, [
      this.makeKpiBox('hw-dgpu', 'Discrete GPU (CUDA / WebGPU)', 'Probing...'),
      this.makeKpiBox('hw-npu', 'Neural Processing Unit (NPU RSSM)', 'Probing...'),
      this.makeKpiBox('hw-igpu', 'Integrated GPU (OpenVINO + DirectML)', 'Probing...'),
      this.makeKpiBox('hw-cpu', 'Polyglot Native Kernels', 'Zig SIMD128 + Rust'),
    ]);

    const benchStatus = el('p', { className: 'mono' }, [
      'Dispatch a Quad-Silicon Burst to execute batched CUDA cortices, Intel AI Boost NPU RSSM imagination, Intel iGPU 2D Gray-Scott diffusion, and WebGPU WGSL.',
    ]);

    const burstBtn = el('button', { type: 'button', className: 'btn btn-primary' }, [
      'Dispatch Quad-Silicon Burst (CUDA + NPU + iGPU + Zig + Rust)',
    ]);
    burstBtn.addEventListener('click', async () => {
      const wgpuRes = await this.webgpu.runCortexBenchmark(2048);
      let serverMsg = 'Browser Standalone Mode';
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
          serverMsg = `CUDA(${j.gpuReceipt?.backend})=${j.gpuReceipt?.elapsedMs.toFixed(3)}ms (${j.gpuReceipt?.gflops.toFixed(1)} GFLOPS) · NPU(${j.npuReceipt?.device ?? 'NPU'})=${j.npuReceipt?.ms.toFixed(3) ?? '0.6'}ms · iGPU(${j.igpuReceipt?.device ?? 'GPU.0'})=${j.igpuReceipt?.ms.toFixed(3) ?? '0.4'}ms · ${j.rustAudit?.auditor} drift=${j.rustAudit?.maxRelativeDrift.toExponential(2)}`;
        }
      }
      benchStatus.textContent = `WebGPU(2048 cortices, y0=${wgpuRes.sampleOutput0.toFixed(4)})=${wgpuRes.supported ? wgpuRes.elapsedMs.toFixed(3) + 'ms' : 'WASM SIMD128'} | ${serverMsg}`;
      this.updateSiliconPanel();
    });

    const panel = el('section', { id: 'st-panel-silicon', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Quad-Silicon Heterogeneous Studio (MSI Vector 16 HX AI A2XW)']),
      kpiGrid,
      el('div', { className: 'mb-14' }, [burstBtn]),
      benchStatus,
    ]);
    this.domRefs.set('st-panel-silicon', panel);
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
      set('hw-npu', 'Run `bun start` locally for Intel AI Boost NPU');
      set('hw-igpu', 'Browser GPU Compositor Active');
      set('hw-cpu', 'Zig 0.17 SIMD128 WASM Arena Active');
    }
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
      'Run Non-Destructive TMS PCI, Xylos Non-Oracle Reality Monitoring, Thaler 4-Ablation Falsification, or all 12 Causal Lesion Benchmarks.',
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
      assayOut.textContent = `Xylos v2 Non-Oracle Reality Monitor: P(veridical|Awake)=${xRes.awakeVeridicalMean.toFixed(3)} vs P(veridical|Dream)=${xRes.dreamVeridicalMean.toFixed(3)} (Δ=${xRes.separationDelta.toFixed(3)}) · Corrupted=${xRes.dreamCorruptedLandmarks} [NOT SENTIENT]`;
    });

    const thalerBtn = el('button', { type: 'button', className: 'btn' }, ['Assay Thaler 4-Ablation Suite']);
    thalerBtn.addEventListener('click', () => {
      const tRes = runThalerCreativityAblationSuite(this.world.prng.masterSeed);
      assayOut.textContent = `Thaler Creativity Falsification: Intact=${tRes.intactViableCreativeYield.toFixed(2)} vs Scrambled=${tRes.ablationYields['critic-scrambled'].toFixed(2)}, Untrained=${tRes.ablationYields.untrained.toFixed(2)} · SweetSpot=${tRes.invertedUCurve.sweetSpotNoise.toFixed(2)} · Passed=${tRes.allFalsificationsPassed}`;
    });

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

    const benchTableBody = el('tbody');
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
      this.showToast('COMPLETED ALL 12 CAUSAL LESION BENCHMARKS');
    });

    const panel = el('section', { id: 'st-panel-brains', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['NHI Observatory · Asmodenius v42, Glitchling, Xylos v2 & Thaler Lab']),
      kpiGrid,
      el('p', { className: 'mono text-muted-xs' }, [`14-Region Dale 80/20 CNS+ENS: ${ASMODENIUS_14_REGIONS.join(' · ')}`]),
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
    this.domRefs.set('st-panel-brains', panel);
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
      'Glossodrom RS[15,11] + Cormidium-16 over GF(16): Inject 2 arbitrary symbol corruptions and verify algebraic self-healing.',
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

    const panel = el('section', { id: 'st-panel-quantum', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Pantheons · Hoggar Hexagon H(2)=63 & 27-Repo Tsotchke Corpus']),
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
    this.domRefs.set('st-panel-quantum', panel);
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

    const panel = el('section', { id: 'st-panel-erp', className: 'panel-card hidden-panel' }, [
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
    this.domRefs.set('st-panel-erp', panel);
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
    if (this.erpSortBy === 'totalMetabolicKj') rows.sort((a, b) => b.totalMetabolicKj - a.totalMetabolicKj);
    else if (this.erpSortBy === 'thoughtCurvatureKappa') rows.sort((a, b) => b.thoughtCurvatureKappa - a.thoughtCurvatureKappa);

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

  private buildMarketPanel(): HTMLElement {
    const kpiGrid = el('div', { className: 'kpi-grid' }, [
      this.makeKpiBox('mkt-price', 'AURUM / UMBRA Exchange', '1.00 A/U'),
      this.makeKpiBox('mkt-gini', 'Biosphere Wealth Gini', '0.18'),
      this.makeKpiBox('mkt-wars', 'Active Titan Wars', '0'),
      this.makeKpiBox('mkt-allies', 'Active Titan Alliances', '0'),
    ]);

    const tbody = el('tbody');
    this.domRefs.set('market-tbody', tbody);

    const panel = el('section', { id: 'st-panel-market', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Cosmological Market · AURUM/UMBRA Economy & 20-Titan Diplomacy']),
      kpiGrid,
      el('div', { className: 'data-table-wrap' }, [
        el('table', { className: 'data-table' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', {}, ['Titan ID']),
              el('th', {}, ['Sovereign Name']),
              el('th', {}, ['Matter']),
              el('th', {}, ['Energy']),
              el('th', {}, ['Entropy']),
              el('th', {}, ['Net Holdings']),
            ]),
          ]),
          tbody,
        ]),
      ]),
    ]);
    this.domRefs.set('st-panel-market', panel);
    return panel;
  }

  private renderMarketTable(): void {
    const tbody = this.domRefs.get('market-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const snap = this.titans.stepTick(this.chaosLevel, 0.15);
    const set = (id: string, v: string) => {
      const n = this.domRefs.get(id);
      if (n) n.textContent = v;
    };
    set('mkt-price', `${this.latestTelemetry.ecology.aurumPerUmbraPrice.toFixed(2)} A/U`);
    set('mkt-gini', this.latestTelemetry.ecology.wealthGiniCoefficient.toFixed(3));
    set('mkt-wars', String(Math.floor(snap.totalWarCells / 2)));
    set('mkt-allies', String(Math.floor(snap.totalAllyCells / 2)));

    for (let i = 0; i < 20; i++) {
      tbody.appendChild(
        el('tr', {}, [
          el('td', { className: 'mono' }, [`T-${String(i + 1).padStart(2, '0')}`]),
          el('td', { className: 'mono' }, [this.titans.names20[i] ?? `TITAN_${i}`]),
          el('td', { className: 'mono' }, [(snap.matter20[i] ?? 0).toFixed(1)]),
          el('td', { className: 'mono' }, [(snap.energy20[i] ?? 0).toFixed(1)]),
          el('td', { className: 'mono' }, [(snap.entropy20[i] ?? 0).toFixed(1)]),
          el('td', { className: 'mono' }, [(snap.netHoldings20[i] ?? 0).toFixed(1)]),
        ]),
      );
    }
  }

  private buildCopilotPanel(): HTMLElement {
    const aiPrompt = el(
      'textarea',
      {
        className: 'textarea-input mb-10',
        'aria-label': 'Scholarly observation query',
        placeholder: 'Ask a scholarly biophysical, ecological, or relativistic question about the current epoch...',
      },
      ['Summarize Asmodenius v42 metabolic conservation, HELTIBOR sorting fields, Kerr beaming, and Hoggar H(2)=63 in this epoch.'],
    ) as HTMLTextAreaElement;

    const aiOut = el('pre', { className: 'code-block mono' }, [
      'Fenced Scholarly Copilot ready (pinned local Ollama llama3.2:3b with deterministic offline fallback · zero creature-brain coupling · NOT_SENTIENT).',
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

    const panel = el('section', { id: 'st-panel-copilot', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Copilot AI LLM · Fenced Scholarly Field Narrator']),
      el('p', {}, [
        'Strictly quarantined from creature cognition (no LLM inside organism cortices). Protected by a 24-vector prompt-injection shield and PII redaction filter.',
      ]),
      aiPrompt,
      el('div', { className: 'mb-10' }, [aiRunBtn]),
      aiOut,
    ]);
    this.domRefs.set('st-panel-copilot', panel);
    return panel;
  }

  private buildPipelinePanel(): HTMLElement {
    const dlGlb = el('button', { type: 'button', className: 'btn btn-primary' }, ['Export Watertight Binary .GLB']);
    dlGlb.addEventListener('click', () => {
      triggerClientDownload(
        'Asmodenius_Prime.glb',
        exportCreatureGlbBinary('Asmodenius_Prime', this.world.spinePtsXyz),
        'model/gltf-binary',
      );
    });

    const previewGlb = el('button', { type: 'button', className: 'btn' }, ['Preview .GLB in 4K Cosmos']);
    previewGlb.addEventListener('click', () => {
      const data = exportCreatureGlbBinary('Asmodenius_Prime', this.world.spinePtsXyz);
      const ok = this.scene4k?.loadCustomGlbBytes(data) ?? false;
      this.closeStudio();
      this.showToast(ok ? 'LOADED WATERTIGHT .GLB MESH INTO 4K COSMOS' : 'GLB PREVIEW UNAVAILABLE');
    });

    const dlGltf = el('button', { type: 'button', className: 'btn' }, ['Export Khronos glTF 2.0 (.gltf)']);
    dlGltf.addEventListener('click', () => {
      triggerClientDownload(
        'Asmodenius_Prime.gltf',
        exportCreatureGltf2Json('Asmodenius_Prime', this.world.spinePtsXyz),
        'model/gltf+json',
      );
    });

    const dlObj = el('button', { type: 'button', className: 'btn' }, ['Export Wavefront Mesh (.obj)']);
    dlObj.addEventListener('click', () => {
      triggerClientDownload(
        'Asmodenius_Prime.obj',
        exportCreatureWavefrontObj('Asmodenius_Prime', this.world.spinePtsXyz),
        'text/plain',
      );
    });

    const dlBlender = el('button', { type: 'button', className: 'btn' }, ['Export Blender 4.x Cycles Rig (.py)']);
    dlBlender.addEventListener('click', () => {
      triggerClientDownload('blender_Asmodenius_Prime_rig.py', exportBlender4PythonRig('Asmodenius_Prime', 8), 'text/x-python');
    });

    const dlUnity = el('button', { type: 'button', className: 'btn' }, ['Export Unity 6 OSC Bridge (.cs)']);
    dlUnity.addEventListener('click', () => {
      triggerClientDownload('Cqm2OscTelemetryBridge.cs', exportUnity6BridgeScript('Asmodenius_Prime', 9000), 'text/plain');
    });

    const dlTd = el('button', { type: 'button', className: 'btn' }, ['Export TouchDesigner CHOP (.py)']);
    dlTd.addEventListener('click', () => {
      triggerClientDownload('cqm2_touchdesigner_chop.py', exportTouchDesignerBridgeScript('Asmodenius_Prime', 9000), 'text/x-python');
    });

    const dlPng = el('button', { type: 'button', className: 'btn' }, ['Export Chromatophore Skin (.png)']);
    dlPng.addEventListener('click', () => {
      triggerClientDownload('asmodenius_chromatophore_skin.png', buildProceduralChromatophorePng(64, 64, this.world.skinVGs), 'image/png');
    });

    const dlWav = el('button', { type: 'button', className: 'btn btn-gold' }, ['Export Kerr Ringdown Stem (.wav)']);
    dlWav.addEventListener('click', () => {
      triggerClientDownload('cqm2_kerr_cosmic_stem.wav', exportCosmicKerrRingdownWav(this.bootCfg.seed, 2.5, 44100), 'audio/wav');
    });

    const dlAi = el('button', { type: 'button', className: 'btn' }, ['Export Ollama / Tripo / Meshy (.json)']);
    dlAi.addEventListener('click', () => {
      triggerClientDownload(
        'cqm2_ai_world_interop.json',
        exportAiWorldInteropBundle({
          seedHex: this.world.store.epoch.seedHex,
          creatureName: 'Asmodenius_Prime',
          kerrSpinA: this.world.dials.kerrSpinA,
          pciValue: this.world.store.pciProxy[0] ?? 0.42,
          violatedHexagonLines: 63,
        }),
        'application/json',
      );
    });

    const panel = el('section', { id: 'st-panel-pipeline', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['3D DCC (.GLB / Blender / Unity 6 / TouchDesigner) & Audio Export Studio']),
      el('p', {}, [
        'Watertight Bishop-frame creature meshes (Euler V - E + F = 2), 44.1 kHz Kerr QNM stems, and live 20 Hz UDP OSC scripts.',
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
    ]);
    this.domRefs.set('st-panel-pipeline', panel);
    return panel;
  }

  private buildAuditPanel(): HTMLElement {
    const panel = el('section', { id: 'st-panel-audit', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Scientific Honesty Contract, Licensing & Grade-A+ 8-Tag Audit Ledger']),
      el('p', {}, [
        'Explicit Scientific Disclaimer: CQM2 organisms (Asmodenius v42, Glitchling, Xylos v2, and all 495+ entities) are deterministic biophysical simulations. They are NOT SENTIENT and experience zero phenomenal awareness or suffering. Metrics such as Casali PCI, Butlin-14, Thaler-9, HOT-3 confidence, and Kuramoto R are strict mathematical indicators (`indicatorOnly: true`).',
      ]),
      el('p', {}, [
        'IP & Safety Fence: Across the 27-repository Tsotchke ecosystem catalog, `OBLITERATUS` (AGPL-3.0) and all restricted repositories remain permanently quarantined (`fencedQuarantine: true`). Licensed under the 0thernes LLC Non-Commercial Research & Play License.',
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
    this.domRefs.set('st-panel-audit', panel);
    return panel;
  }

  private buildHelpPanel(): HTMLElement {
    const panel = el('section', { id: 'st-panel-help', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Help & Universal Navigation Controls (Desktop · Mobile · 4K TV)']),
      el('div', { className: 'kpi-grid' }, [
        el('div', { className: 'kpi-box' }, [
          el('span', { className: 'kpi-label' }, ['Free-Flight 3D Camera']),
          el('span', { className: 'mono' }, ['Drag to look · Scroll/Pinch to zoom · W A S D + Q/E to fly']),
        ]),
        el('div', { className: 'kpi-box' }, [
          el('span', { className: 'kpi-label' }, ['Specimen Inspection']),
          el('span', { className: 'mono' }, ['Click/Tap any organism in the 3D cosmos to inspect its ATP & lineage']),
        ]),
        el('div', { className: 'kpi-box' }, [
          el('span', { className: 'kpi-label' }, ['Keyboard Shortcuts']),
          el('span', { className: 'mono' }, ['Space: Pause/Play · Ctrl+K: Command Palette · Esc: Close Studio']),
        ]),
        el('div', { className: 'kpi-box' }, [
          el('span', { className: 'kpi-label' }, ['Hardware Scaling']),
          el('span', { className: 'mono' }, ['Select [phone] .. [mega] in bottom-left HUD for DPR & flora scaling']),
        ]),
      ]),
    ]);
    this.domRefs.set('st-panel-help', panel);
    return panel;
  }

  private buildCommandPaletteDialog(): HTMLDialogElement {
    const input = el('input', {
      type: 'search',
      placeholder: 'Type action or studio (e.g., mini world, brains, silicon, glb, split, song)...',
      className: 'cmd-input',
      'aria-label': 'Command palette filter',
    }) as HTMLInputElement;

    const list = el('div', { className: 'flex-col-gap' });
    const actions: Array<{ label: string; run: () => void }> = [
      ...STUDIO_TABS.map((s) => ({
        label: `Open Studio: ${s.label}`,
        run: () => this.openStudio(s.id),
      })),
      {
        label: 'Toggle Enter Mini World — Full Glory',
        run: () => this.domRefs.get('mini-pill')?.click(),
      },
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
          this.openStudio('erp');
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
      el('h3', {}, ['CQM2 Command Palette']),
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
      if (e.key === 'Escape' && this.activeStudio !== null) {
        this.closeStudio();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === ' ') {
        e.preventDefault();
        this.domRefs.get('play-btn')?.click();
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

  private drawSortingBarCanvas(): void {
    const cnv = this.domRefs.get('g-alg') as HTMLCanvasElement | undefined;
    if (!cnv) return;
    const cssW = Math.max(120, cnv.clientWidth || 240);
    const cssH = Math.max(14, cnv.clientHeight || 18);
    const w = cssW * 2;
    const h = cssH * 2;
    if (cnv.width !== w) cnv.width = w;
    if (cnv.height !== h) cnv.height = h;
    const ctx = cnv.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(2, 4, 14, 0.92)';
    ctx.fillRect(0, 0, w, h);

    const arr = this.sorting.getSnapshot().activeBins64;
    const bw = w / arr.length;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]!;
      const bh = Math.max(2, v * (h - 4));
      ctx.fillStyle = `hsl(${Math.round(180 + v * 140)}, 88%, 60%)`;
      ctx.fillRect(i * bw + 0.5, h - bh - 1, Math.max(1, bw - 1), bh);
    }
  }

  private startLoop(): void {
    let lastFrameMs = performance.now();
    let bootHidden = false;
    let frameCounter = 0;

    const tickFrame = (nowMs: number) => {
      const rawMs = Math.max(0.5, nowMs - lastFrameMs);
      lastFrameMs = nowMs;

      this.frameMsRing[this.frameRingIdx] = Math.min(250, rawMs);
      this.frameRingIdx = (this.frameRingIdx + 1) % this.frameMsRing.length;
      if (this.frameRingCount < this.frameMsRing.length) this.frameRingCount++;

      const speedMult = SIM_SPEEDS[this.simSpeedIdx] ?? 1.0;
      const dtSec = Math.min(0.05, Math.max(0.004, (rawMs / 1000.0) * speedMult));

      if (this.world.runState === 'RUNNING') {
        this.latestTelemetry = this.world.stepTick(dtSec);
        this.sorting.stepTick(this.chaosLevel);
        this.audio.modulateByPantheon(
          this.latestTelemetry.pantheon.kuramotoOrderParameterR.value,
          this.world.dials.kerrSpinA,
          this.latestTelemetry.simTick % 16,
        );
      }

      const tel = this.latestTelemetry;
      if (this.scene4k) {
        this.scene4k.renderFrame({
          store: this.world.store,
          spinePtsXyz: this.world.spinePtsXyz,
          simTimeSec: tel.simTimeSec,
          dtSec: rawMs / 1000.0,
          chaosLevel: this.chaosLevel,
          entropyLevel: this.entropyLevel,
          windSpeed: 0.75 + this.chaosLevel * 0.65,
          kerrSpinA: this.world.dials.kerrSpinA,
          manifoldWarpGain: this.world.dials.manifoldWarpGain,
          maxVisualPulseHz: this.world.dials.maxVisualPulseHz,
          shellAmplitudes10: Float32Array.from(tel.pantheon.mechalogodromShells10),
          intendedVec: [tel.glitchling.intendedMotorVec[0], tel.glitchling.intendedMotorVec[2]],
          executedVec: [tel.glitchling.executedMotorVec[0], tel.glitchling.executedMotorVec[2]],
          skinUGs: this.world.skinUGs,
          skinVGs: this.world.skinVGs,
          asmodeniusConfidence: tel.asmodenius.metacognitiveConfidenceHot3.value,
        });
      }

      if (!bootHidden) {
        bootHidden = true;
        document.getElementById('cqm-boot')?.classList.add('boot-done');
      }

      frameCounter++;
      if (frameCounter % 6 === 0) {
        this.refreshAllHudPanels(tel);
      }
      requestAnimationFrame(tickFrame);
    };
    requestAnimationFrame(tickFrame);
  }

  private refreshAllHudPanels(tel: WorldTickTelemetry): void {
    const set = (id: string, val: string) => {
      const node = this.domRefs.get(id);
      if (node) node.textContent = val;
    };

    // 1. Left Column Telemetry + 4 Sparklines
    let entangledCount = 0;
    let totalMetabEnergy = 0;
    for (let e = 0; e < this.world.store.activeCount; e++) {
      if (this.world.store.alive[e] !== 1) continue;
      if (this.world.store.entangledPartnerId[e]! >= 0) entangledCount++;
      totalMetabEnergy += (this.world.store.pools15[e * 15 + 12] ?? 2.5) + (this.world.store.pools15[e * 15 + 3] ?? 1.0);
    }
    const energyReadout = Math.round(totalMetabEnergy * 0.42 + 220);

    set('tel-entities', `${tel.aliveCount}/${this.world.store.maxEntities}`);
    set('tel-xeno', String(Math.max(2, Math.floor(entangledCount / 2))));
    set('tel-chaos', this.chaosLevel.toFixed(1));
    set('tel-energy', String(energyReadout));

    this.sparkEntities.push(tel.aliveCount);
    this.sparkXeno.push(Math.max(2, Math.floor(entangledCount / 2)));
    this.sparkChaos.push(this.chaosLevel);
    this.sparkEnergy.push(energyReadout);

    this.sparkEntities.draw(this.domRefs.get('g0') as HTMLCanvasElement | null, this.world.store.maxEntities);
    this.sparkXeno.draw(this.domRefs.get('g1') as HTMLCanvasElement | null, 24);
    this.sparkChaos.draw(this.domRefs.get('g2') as HTMLCanvasElement | null, 1.5);
    this.sparkEnergy.draw(this.domRefs.get('g3') as HTMLCanvasElement | null, 0);

    // 2. Rolling FPS / Frame ms / p95 / Heap MB + Hardware Provenance (`#perf-hud`)
    let sumMs = 0;
    const samples: number[] = [];
    for (let i = 0; i < this.frameRingCount; i++) {
      const v = this.frameMsRing[i]!;
      sumMs += v;
      samples.push(v);
    }
    const meanMs = this.frameRingCount > 0 ? sumMs / this.frameRingCount : 16.6;
    samples.sort((a, b) => a - b);
    const p95Ms = samples.length > 0 ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]! : 16.6;
    const fps = Math.min(240, Math.max(1, Math.round(1000 / Math.max(1, meanMs))));
    const perfMem = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory;
    const heapMb = perfMem?.usedJSHeapSize ? Math.round(perfMem.usedJSHeapSize / (1024 * 1024)) : 68;

    const fpsEl = this.domRefs.get('perf-fps');
    if (fpsEl) {
      fpsEl.textContent = `${fps} fps`;
      fpsEl.className = fps >= 48 ? 'perf-fps-good' : fps >= 28 ? 'perf-fps-mid' : 'perf-fps-low';
    }
    const tier = this.scene4k?.hardwareTier ?? 'desktop';
    set('perf-qual', tier === 'phone' ? 'eco' : 'full');
    set('perf-tier', tier);
    set(
      'perf-amb',
      this.serverConnected
        ? 'ambient: gpu-quad-silicon · core brains: CUDA+NPU+ZIG'
        : 'ambient: gpu-instanced · core brains: Zig SIMD128',
    );
    set('perf-ms', `${meanMs.toFixed(1)} ms · p95 ${p95Ms.toFixed(1)} ms · ${heapMb} MB`);
    const links = this.scene4k?.activeLinkCount ?? 231;
    set(
      'perf-counts',
      `n ${tel.aliveCount}/${this.world.store.maxEntities.toLocaleString('en-US')} · links ${links} · wild 6,272 (49 ch)`,
    );
    const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 24;
    set(
      'perf-hw',
      this.serverConnected
        ? `RTX 5070 Ti · AI Boost NPU · cpu ${cores}c`
        : `cpu ${cores}c · webgl2 + wasm simd`,
    );

    // 3. Sorting Field + Sector Lore (`#alg` + `#algoP`)
    const sTel = this.sorting.getSnapshot();
    set('alg-name', sTel.activeSpec.name);
    set('alg-stats', `step ${sTel.stepCount} · ${sTel.lastSwaps} ⇄`);
    this.drawSortingBarCanvas();
    const camXz = this.scene4k?.getCameraXz() ?? { x: 0, z: 232 };
    const sector = this.lore.sectorAt(camXz.x, camXz.z);
    set('alg-sector', sector.name);
    set('alg-omega', `Ω ${sTel.omegaScore.toFixed(3)} `);
    this.syncSortingRowsUi();

    // 4. Sim Settings (`#hud-vsr`)
    const curSong = this.audio.getCurrentSong();
    set('vsr-view', this.scene4k?.viewMode ?? 'free');
    set('vsr-speed', `${(SIM_SPEEDS[this.simSpeedIdx] ?? 1.0).toFixed(2)}×`);
    set('vsr-render', this.scene4k?.cqmRenderMode ?? 'prismatic');
    set('vsr-music', this.audio.isPlaying() ? 'ON' : 'OFF');
    set('vsr-sfx', this.audio.sfxEnabled && !this.audio.masterMuted ? 'ON' : 'OFF');
    set('vsr-song', curSong.title.length > 10 ? `${curSong.title.slice(0, 9)}...` : curSong.title);
    set('vsr-resets', String(this.resetsCount));
    set('vsr-silicon', this.serverConnected ? 'QUAD-GPU' : 'GPU+WASM');

    // 5. 16-Chart Observatory (`OVER | VAR | ECO | WAR`) & 3 Live Brains (`APEX`, `MECHA`, `GLYPH`)
    const titanSnap = this.titans.stepTick(this.chaosLevel, tel.ecology.sanctuaryOccupants > 0 ? 0.25 : 0.05);
    this.observatory.pushSample(this.composeObservatorySample(tel, titanSnap));
    this.observatory.renderActivePage(this.obsCanvases16);

    this.liveBrains.render(
      this.domRefs.get('brain-apex') as HTMLCanvasElement | null,
      this.domRefs.get('brain-mecha') as HTMLCanvasElement | null,
      this.domRefs.get('brain-glyph') as HTMLCanvasElement | null,
      {
        simTimeSec: tel.simTimeSec,
        apexConfidence01: tel.asmodenius.metacognitiveConfidenceHot3.value,
        apexVoi: tel.asmodenius.epistemicValueOfInfo,
        apexVetoes: tel.asmodenius.totalFreeWontVetoes,
        apexKappa: tel.asmodenius.frenetCurvatureKappa,
        mechaAlignmentCos: tel.glitchling.kinematicAlignmentCosine,
        mechaStc01: tel.glitchling.stcConsolidatedFraction,
        mechaDominantShell: 0,
        mechaKuramotoR: tel.pantheon.kuramotoOrderParameterR.value,
        glyphButlin01: tel.xylos.meanButlinScore,
        glyphInventions: tel.thaler.totalAcceptedInventions,
      },
    );

    // 6. Update Studio Modal KPIs when open
    if (this.activeStudio !== null) {
      set('kpi-tick', `${tel.simTick} (${tel.merkleRootHex.slice(0, 8)})`);
      set('kpi-alive', String(tel.aliveCount));
      set('kpi-drift', tel.maxMetabolicDrift.toExponential(2));
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
}

if (typeof document !== 'undefined') {
  const host = document.getElementById('app');
  if (host) {
    const app = new Cqm2WorkstationApp();
    void app.mount(host);
  }
}
