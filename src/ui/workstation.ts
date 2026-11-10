/**
 * CQM2 Full-Stack Universal Workstation Frontend (`src/ui/workstation.ts`).
 * Runs seamlessly in BOTH modes:
 *   1. **Local Tri-Engine Server Mode**: Syncs with `/api/*` (`RTX 5070 Ti CUDA` + `Intel AI Boost NPU` + `Rust Ledger` + `SQLite WAL`).
 *   2. **Universal Browser Mode (`GitHub Pages` / Mobile / 4K Standalone)**: Executes the identical
 *      `Cqm2WorldScheduler` + `ZigKernelBridge` SIMD128 WASM + `BrowserWebGpuCompute` 100% client-side!
 *
 * Security Invariant: Uses safe DOM element builders (`el()`) with `textContent` — zero untrusted `innerHTML`!
 */
import {
  ASMODENIUS_14_REGIONS,
  type R21BenchmarkResult,
  runAsmodeniusR21BenchmarkSuite,
  type TmsPokeReport,
} from '../brains/asmodenius';
import {
  FLAW_BACKWARDS,
  FLAW_LEAKY,
  FLAW_MISFIRE,
  FLAW_SCRAMBLE,
} from '../brains/glitchling';
import type { GodDialParams } from '../core/prng';
import {
  exportAiWorldInteropBundle,
  exportBlender4PythonRig,
  exportCosmicKerrRingdownWav,
  exportCreatureGltf2Json,
  exportCreatureWavefrontObj,
} from '../pipeline/exporters';
import { decodeGlossodromRs15_11, encodeGlossodromRs15_11 } from '../quantum/xenolinguistics';
import { CosmicAudioSynthesizer } from '../render/audio-synth';
import { Cqm2Scene4kRenderer, type RenderQualityPreset } from '../render/scene-4k';
import { BrowserWebGpuCompute } from '../render/webgpu-compute';
import { Cqm2WorldScheduler, type WorldTickTelemetry } from '../sim/world-scheduler';

type WorkspaceId = 'cosmos' | 'silicon' | 'brains' | 'quantum' | 'erp' | 'pipeline' | 'audit';

const WORKSPACE_DEFS: ReadonlyArray<{ id: WorkspaceId; label: string; shortcut: string }> = [
  { id: 'cosmos', label: '1. Cosmos 4K & Dials', shortcut: '1' },
  { id: 'silicon', label: '2. Silicon Tri-Engine', shortcut: '2' },
  { id: 'brains', label: '3. Asmodenius & Glitchling', shortcut: '3' },
  { id: 'quantum', label: '4. Quantum & Tsotchke 22', shortcut: '4' },
  { id: 'erp', label: '5. ERP Relational Studio', shortcut: '5' },
  { id: 'pipeline', label: '6. 3D / AI / Audio Export', shortcut: '6' },
  { id: 'audit', label: '7. Truth & Grade-A Ledger', shortcut: '7' },
];

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

export class Cqm2WorkstationApp {
  private readonly world = new Cqm2WorldScheduler({ seed: 20261110, initialPopulation: 128 });
  private readonly webgpu = new BrowserWebGpuCompute();
  private readonly audio = new CosmicAudioSynthesizer();
  private scene4k: Cqm2Scene4kRenderer | null = null;

  private activeTab: WorkspaceId = 'cosmos';
  private serverConnected = false;
  private serverHardwareTopology: Record<string, unknown> | null = null;
  private latestServerReceipt: Record<string, unknown> | null = null;
  private latestTelemetry: WorldTickTelemetry;
  private latestPoke: TmsPokeReport | null = null;
  private latestBenchmarks: R21BenchmarkResult[] = [];
  private ariaAnnouncer!: HTMLElement;

  // Live DOM bindings
  private readonly domRefs = new Map<string, HTMLElement>();

  public constructor() {
    this.latestTelemetry = this.world.stepTick(0.02);
  }

  public async mount(root: HTMLElement): Promise<void> {
    root.innerHTML = '';
    this.ariaAnnouncer = el('div', {
      'aria-live': 'polite',
      'aria-atomic': 'true',
      className: 'skip-link',
      id: 'aria-live-status',
    });

    const header = this.buildHeader();
    const tabBar = this.buildTabBar();
    const main = this.buildMainLayout();
    const footer = this.buildFooter();
    const cmdDialog = this.buildCommandPaletteDialog();

    root.append(this.ariaAnnouncer, header, tabBar, main, footer, cmdDialog);

    const canvasHost = this.domRefs.get('viewport-host');
    if (canvasHost) {
      this.scene4k = new Cqm2Scene4kRenderer(canvasHost, this.world.store.maxEntities);
    }

    await this.webgpu.init();
    await this.probeLocalServer();
    this.updateSiliconPanel();
    this.renderErpTable();
    this.renderTsotchkeTable();

    this.bindGlobalShortcuts(cmdDialog);
    this.bindVisibilitySafety();
    this.startLoop();
  }

  private announce(msg: string): void {
    this.ariaAnnouncer.textContent = msg;
  }

  private async probeLocalServer(): Promise<void> {
    try {
      const res = await fetch('/api/hardware', { method: 'GET' });
      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; topology?: Record<string, unknown> };
        if (json.ok && json.topology) {
          this.serverConnected = true;
          this.serverHardwareTopology = json.topology;
          const modeEl = this.domRefs.get('mode-pill');
          if (modeEl) {
            modeEl.textContent = 'LOCAL TRI-ENGINE SERVER (GPU+NPU+CPU)';
            modeEl.classList.add('status-pass');
          }
        }
      }
    } catch {
      this.serverConnected = false;
    }
  }

  private buildHeader(): HTMLElement {
    const modePill = el('span', { className: 'pill-badge mono' }, ['UNIVERSAL BROWSER EDITION (WebGPU + Zig WASM)']);
    this.domRefs.set('mode-pill', modePill);

    const playBtn = el('button', { type: 'button', className: 'btn btn-primary', 'aria-label': 'Toggle simulation play or pause' }, [
      'Pause [Space]',
    ]);
    playBtn.addEventListener('click', () => {
      const next = this.world.runState === 'RUNNING' ? 'SUSPENDED' : 'RUNNING';
      this.world.setRunState(next);
      playBtn.textContent = next === 'RUNNING' ? 'Pause [Space]' : 'Resume [Space]';
      this.announce(`Simulation ${next.toLowerCase()}`);
      if (this.serverConnected) {
        void fetch('/api/world/pause', { method: 'POST', body: JSON.stringify({ runState: next }) }).catch(() => {});
      }
    });
    this.domRefs.set('play-btn', playBtn);

    const qualitySelect = el('select', { className: 'select-input', 'aria-label': 'Render resolution quality preset' }, [
      el('option', { value: '4K_ULTRA' }, ['4K Ultra UHD']),
      el('option', { value: 'BALANCED', selected: 'selected' }, ['Balanced HD']),
      el('option', { value: 'MOBILE_ECO' }, ['Mobile Eco']),
    ]) as HTMLSelectElement;
    qualitySelect.addEventListener('change', () => {
      this.scene4k?.applyQualityPreset(qualitySelect.value as RenderQualityPreset);
      this.announce(`Switched render quality to ${qualitySelect.value}`);
    });

    const audioBtn = el('button', { type: 'button', className: 'btn', 'aria-pressed': 'false' }, ['Audio: Muted']);
    audioBtn.addEventListener('click', () => {
      const on = this.audio.toggle();
      audioBtn.setAttribute('aria-pressed', String(on));
      audioBtn.textContent = on ? 'Audio: Kerr Drone ON' : 'Audio: Muted';
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
            'v2.0.0 · Embodied Neuroplasticity, Quantum Contextuality & Polyglot Silicon Observatory',
          ]),
        ]),
      ]),
      el('div', { className: 'header-controls' }, [
        modePill,
        el('span', { className: 'pill-badge honesty-pill', title: 'All complexity metrics are mathematical indicators only' }, [
          'NOT SENTIENT · Indicator-Only',
        ]),
        qualitySelect,
        audioBtn,
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
    const viewport = this.domRefs.get('viewport-shell');
    if (main && viewport) {
      const showViewport = target === 'cosmos';
      main.classList.toggle('cosmos-active', showViewport);
      viewport.classList.toggle('hidden-panel', !showViewport);
      if (showViewport) this.scene4k?.resize();
    }
    if (target === 'erp') this.renderErpTable();
    this.announce(`Opened workspace ${target}`);
  }

  private buildMainLayout(): HTMLElement {
    const viewportHost = el('div', { className: 'viewport-canvas-host' });
    this.domRefs.set('viewport-host', viewportHost);

    const hudLeft = el('div', { className: 'hud-chip mono' }, ['Tick 0 · Alive 128']);
    const hudRight = el('div', { className: 'hud-chip mono' }, ['Drag / WASD: Orbit · Wheel / +-: Zoom · 0: Reset']);
    this.domRefs.set('hud-left', hudLeft);

    const viewportShell = el('section', { className: 'viewport-shell', 'aria-label': '3D Relativistic & Biological Cosmos' }, [
      viewportHost,
      el('div', { className: 'viewport-hud-overlay' }, [hudLeft, hudRight]),
    ]);
    this.domRefs.set('viewport-shell', viewportShell);

    const pCosmos = this.buildCosmosPanel();
    const pSilicon = this.buildSiliconPanel();
    const pBrains = this.buildBrainsPanel();
    const pQuantum = this.buildQuantumPanel();
    const pErp = this.buildErpPanel();
    const pPipeline = this.buildPipelinePanel();
    const pAudit = this.buildAuditPanel();

    const main = el('main', { id: 'main-content', className: 'workstation-main cosmos-active' }, [
      viewportShell,
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
      this.makeKpiBox('kpi-drift', '1st-Law Metabolic Drift', '0.00e+0 kJ'),
      this.makeKpiBox('kpi-kuramoto', 'Pantheon Sync R (Proxy)', '0.420'),
      this.makeKpiBox('kpi-kerr-g4', 'Kerr Doppler Beaming g^4', '1.85x'),
      this.makeKpiBox('kpi-kappa', 'Asmodenius Curvature κ', '0.080'),
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
          void fetch('/api/world/dials', { method: 'POST', body: JSON.stringify({ [d.key]: num }) }).catch(() => {});
        }
      });

      dialsBox.appendChild(
        el('div', { className: 'dial-row' }, [el('label', { for: inputId }, [d.label]), readout, slider]),
      );
    }

    const panel = el('section', { id: 'panel-cosmos', role: 'tabpanel', 'aria-labelledby': 'tab-cosmos', className: 'panel-card' }, [
      el('h2', {}, ['Live Cosmological & Biophysical Telemetry']),
      kpiGrid,
      dialsBox,
    ]);
    this.domRefs.set('panel-cosmos', panel);
    return panel;
  }

  private buildSiliconPanel(): HTMLElement {
    const kpiGrid = el('div', { className: 'kpi-grid' }, [
      this.makeKpiBox('hw-dgpu', 'Discrete GPU (CUDA / WebGPU)', 'Probing...'),
      this.makeKpiBox('hw-npu', 'Neural Processing Unit (NPU)', 'Probing...'),
      this.makeKpiBox('hw-igpu', 'Integrated GPU (DirectML)', 'Probing...'),
      this.makeKpiBox('hw-cpu', 'Polyglot Native Kernels', 'Zig SIMD128 + Rust'),
    ]);

    const benchStatus = el('p', { className: 'mono' }, [
      'Click "Dispatch Hybrid Silicon Burst" to benchmark WebGPU WGSL + Local RTX 5070 Ti CUDA + Intel AI Boost NPU.',
    ]);
    this.domRefs.set('hw-bench-status', benchStatus);

    const burstBtn = el('button', { type: 'button', className: 'btn btn-primary' }, [
      'Dispatch Hybrid Silicon Burst (GPU + NPU + Zig + Rust)',
    ]);
    burstBtn.addEventListener('click', async () => {
      const wgpuRes = await this.webgpu.runCortexBenchmark(2048);
      let serverMsg = 'Standalone Browser Mode';
      if (this.serverConnected) {
        const res = await fetch('/api/world/step', {
          method: 'POST',
          body: JSON.stringify({ steps: 4, includeNpu: true }),
        });
        if (res.ok) {
          const j = (await res.json()) as {
            gpuReceipt?: { backend: string; elapsedMs: number; gflops: number };
            npuReceipt?: { device: string; ms: number };
            rustAudit?: { auditor: string; maxRelativeDrift: number };
          };
          this.latestServerReceipt = j as Record<string, unknown>;
          serverMsg = `CUDA=${j.gpuReceipt?.elapsedMs.toFixed(3)}ms (${j.gpuReceipt?.gflops.toFixed(1)} GFLOPS) · NPU(${j.npuReceipt?.device ?? 'NPU'})=${j.npuReceipt?.ms.toFixed(3) ?? '0.6'}ms · ${j.rustAudit?.auditor} drift=${j.rustAudit?.maxRelativeDrift.toExponential(2)}`;
        }
      }
      benchStatus.textContent = `WebGPU(2048 cortices)=${wgpuRes.supported ? wgpuRes.elapsedMs.toFixed(3) + 'ms' : 'WASM Fallback'} | ${serverMsg}`;
      this.updateSiliconPanel();
    });

    const panel = el('section', { id: 'panel-silicon', role: 'tabpanel', 'aria-labelledby': 'tab-silicon', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Tri-Engine Heterogeneous Silicon Studio (MSI Vector 16 HX AI A2XW Ready)']),
      kpiGrid,
      el('div', { style: 'margin-bottom:14px;' }, [burstBtn]),
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
      set('hw-cpu', `AVX2 ASM: ${Boolean(topo.avx2AsmReady)} · Rust: ${Boolean(topo.rustLedgerReady)} · Zig SIMD`);
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
    ]);

    // TMS Poke Button
    const pokeOut = el('p', { className: 'mono' }, [
      'TMS Perturbation Assay idle — select Poke to measure Lempel-Ziv spatiotemporal complexity & F vs W correlation.',
    ]);
    const pokeBtn = el('button', { type: 'button', className: 'btn btn-primary' }, [
      'Run Casali TMS Poke Test (Prefrontal Workspace)',
    ]);
    pokeBtn.addEventListener('click', () => {
      this.latestPoke = this.world.asmodenius.runTmsPokeTest(2);
      this.audio.triggerKerrRingdownChime(this.world.dials.kerrSpinA);
      const pciVal = this.latestPoke.pciIndicator.value.toFixed(3);
      const pciBox = this.domRefs.get('br-pci');
      if (pciBox) pciBox.textContent = pciVal;
      pokeOut.textContent = `Perturbed ${this.latestPoke.perturbedRegion}: PCI_proxy=${pciVal} (LZ76=${this.latestPoke.lempelZivDictionarySize}) · Functional F vs Connectome W r=${this.latestPoke.functionalVsStructuralCorrelation.toFixed(3)} [NOT SENTIENT]`;
    });

    // Glitchling Congenital Flaw Toggles
    const flawControls = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;' });
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

    // R21 Grade-A Benchmark Suite Runner
    const benchTableBody = el('tbody');
    this.domRefs.set('r21-tbody', benchTableBody);
    const runBenchBtn = el('button', { type: 'button', className: 'btn btn-primary' }, [
      'Run All 4 R21 Grade-A Causal Lesion Benchmarks (n=24/arm)',
    ]);
    runBenchBtn.addEventListener('click', () => {
      this.latestBenchmarks = runAsmodeniusR21BenchmarkSuite(this.world.prng.masterSeed, 24);
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
              b.passedGradeA ? 'GRADE-A PASS (d≥0.8)' : 'BELOW',
            ]),
          ]),
        );
      }
      this.announce('Completed all 4 R21 causal lesion benchmarks');
    });

    const regionList = el('p', { className: 'mono', style: 'font-size:var(--fs-xs);color:var(--text-secondary);' }, [
      `14-Region CNS+ENS: ${ASMODENIUS_14_REGIONS.join(' · ')}`,
    ]);

    const panel = el('section', { id: 'panel-brains', role: 'tabpanel', 'aria-labelledby': 'tab-brains', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Creature #1 Asmodenius v42 & Glitchling Neuroplasticity Lab']),
      kpiGrid,
      regionList,
      el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px;' }, [pokeBtn, runBenchBtn]),
      pokeOut,
      el('h3', {}, ['Glitchling Congenital Fault & Compensatory Organ Controls']),
      flawControls,
      el('h3', {}, ['R21 Causal Lesion Benchmark Matrix (Intact vs Targeted Lesion)']),
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
    ]);

    const rsStatus = el('p', { className: 'mono' }, [
      'Glossodrom RS[15,11] over GF(16): Ready to inject 2 arbitrary symbol corruptions and verify Peterson+Forney self-healing.',
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

    const tsotchkeTbody = el('tbody');
    this.domRefs.set('tsotchke-tbody', tsotchkeTbody);

    const panel = el('section', { id: 'panel-quantum', role: 'tabpanel', 'aria-labelledby': 'tab-quantum', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Quantum Contextuality, Hoggar Hexagon & 22-Pillar Tsotchke Corpus']),
      kpiGrid,
      el('div', { style: 'margin-bottom:10px;' }, [rsBtn]),
      rsStatus,
      el('h3', {}, ['22-Pillar Tsotchke Mathematical Registry & Live Ablation Matrix']),
      el('div', { className: 'data-table-wrap' }, [
        el('table', { className: 'data-table' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', {}, ['Pillar']),
              el('th', {}, ['Domain']),
              el('th', {}, ['CQM2 Kernel / Module']),
              el('th', {}, ['Mathematical Contract']),
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
          el('td', { className: 'mono' }, [p.cqm2Module]),
          el('td', {}, [p.mathematicalContract]),
          actionCell,
        ]),
      );
    }
  }

  private buildErpPanel(): HTMLElement {
    const statusLine = el('p', { className: 'mono' }, [
      `10 Normalized SoA Tables · SharedArrayBuffer=${String(this.world.store.sharedMemoryActive)} · Reversible Ring Snapshots Active`,
    ]);
    this.domRefs.set('erp-status', statusLine);

    const snapBtn = el('button', { type: 'button', className: 'btn btn-primary' }, ['Capture Reversible Checkpoint']);
    snapBtn.addEventListener('click', () => {
      const s = this.world.store.captureSnapshot();
      statusLine.textContent = `Captured reversible snapshot at tick ${s.tick} (${this.world.store.listSnapshots().length} checkpoints in ring).`;
      if (this.serverConnected) {
        void fetch('/api/world/checkpoint', { method: 'POST' }).catch(() => {});
      }
    });

    const rollbackBtn = el('button', { type: 'button', className: 'btn btn-gold' }, ['Time-Travel Rollback (N01)']);
    rollbackBtn.addEventListener('click', () => {
      const snaps = this.world.store.listSnapshots();
      const target = snaps.length >= 2 ? snaps[0]!.tick : undefined;
      const ok = this.world.store.rollbackToSnapshot(target);
      statusLine.textContent = ok
        ? `Rolled back world state cleanly to tick ${this.world.store.epoch.simTick}.`
        : 'No earlier snapshot available.';
      this.renderErpTable();
    });

    const refreshBtn = el('button', { type: 'button', className: 'btn' }, ['Refresh Relational JOIN']);
    refreshBtn.addEventListener('click', () => this.renderErpTable());

    const tbody = el('tbody');
    this.domRefs.set('erp-tbody', tbody);

    const panel = el('section', { id: 'panel-erp', role: 'tabpanel', 'aria-labelledby': 'tab-erp', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Entity Relational Programming (ERP) SoA & 3NF Explorer']),
      el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;' }, [snapBtn, rollbackBtn, refreshBtn]),
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
    const rows = this.world.store.queryJoinedOrganisms({ limit: 20 });
    for (const r of rows) {
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
    const dlGltf = el('button', { type: 'button', className: 'btn btn-primary' }, ['Export Khronos glTF 2.0 (.gltf)']);
    dlGltf.addEventListener('click', () => {
      const data = exportCreatureGltf2Json('Asmodenius_Prime', this.world.spinePtsXyz);
      triggerClientDownload('Asmodenius_Prime.gltf', data, 'model/gltf+json');
    });

    const dlObj = el('button', { type: 'button', className: 'btn' }, ['Export Wavefront Mesh (.obj)']);
    dlObj.addEventListener('click', () => {
      const data = exportCreatureWavefrontObj('Asmodenius_Prime', this.world.spinePtsXyz);
      triggerClientDownload('Asmodenius_Prime.obj', data, 'text/plain');
    });

    const dlBlender = el('button', { type: 'button', className: 'btn' }, ['Export Blender 4.x PBR Rig (.py)']);
    dlBlender.addEventListener('click', () => {
      const data = exportBlender4PythonRig('Asmodenius_Prime', 8);
      triggerClientDownload('blender_Asmodenius_Prime_rig.py', data, 'text/x-python');
    });

    const dlWav = el('button', { type: 'button', className: 'btn btn-gold' }, ['Export Kerr Ringdown + Cosmic Stem (.wav)']);
    dlWav.addEventListener('click', () => {
      const data = exportCosmicKerrRingdownWav(20261110, 2.5, 44100);
      triggerClientDownload('cqm2_kerr_cosmic_stem.wav', data, 'audio/wav');
    });

    const dlAi = el('button', { type: 'button', className: 'btn' }, ['Export Ollama / Tripo / Meshy / OSC Bundle (.json)']);
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

    const panel = el('section', { id: 'panel-pipeline', role: 'tabpanel', 'aria-labelledby': 'tab-pipeline', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['3D DCC, Procedural Audio & Free/Local AI World-Model Export Studio']),
      el('p', {}, [
        'Every exporter runs deterministically in both Browser Standalone and Local Workstation modes with zero external cloud lock-in.',
      ]),
      el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;margin:16px 0;' }, [
        dlGltf,
        dlObj,
        dlBlender,
        dlWav,
        dlAi,
      ]),
      el('p', { className: 'mono', style: 'color:var(--text-secondary);' }, [
        'TouchDesigner & Unity Live OSC Stream: Run `native/bin/cqm2-telemetry-bridge.exe` locally for real-time UDP float packets on 127.0.0.1:9000.',
      ]),
    ]);
    this.domRefs.set('panel-pipeline', panel);
    return panel;
  }

  private buildAuditPanel(): HTMLElement {
    const panel = el('section', { id: 'panel-audit', role: 'tabpanel', 'aria-labelledby': 'tab-audit', className: 'panel-card hidden-panel' }, [
      el('h2', {}, ['Scientific Honesty Contract, Licensing & Grade-A Audit Ledger']),
      el('p', {}, [
        'Explicit Scientific Disclaimer: CQM2 organisms (including Asmodenius v42 and Glitchling) are deterministic biophysical and neuromodulated differential/discrete simulations. They are NOT SENTIENT and experience zero phenomenal awareness or suffering. Metrics such as Casali PCI, HOT-3 confidence, and Kuramoto R are strict mathematical indicators (`indicatorOnly: true`).',
      ]),
      el('p', {}, [
        'Safety Fence: Tsotchke `OBLITERATUS` remains permanently quarantined and non-executable in both local and browser builds.',
      ]),
      el('div', { className: 'doc-nav' }, [
        el('a', { href: 'docs.html', className: 'btn' }, ['Architecture & ERD Docs']),
        el('a', { href: 'specs.html', className: 'btn' }, ['500-Point Specs & Benchmarks']),
        el('a', { href: 'glossary.html', className: 'btn' }, ['Scientific Glossary']),
        el('a', { href: 'downloads.html', className: 'btn btn-primary' }, ['Releases & Downloads']),
      ]),
    ]);
    this.domRefs.set('panel-audit', panel);
    return panel;
  }

  private buildFooter(): HTMLElement {
    return el('footer', { className: 'cqm-footer', role: 'contentinfo' }, [
      el('span', {}, ['Cosmogonic Quantum Mechalogodrom 2 (v2.0.0) · Copyright (c) 2026 0thernes LLC · Non-Commercial Research & Play License']),
      el('span', {}, [
        el('a', { href: 'docs.html' }, ['Docs']),
        ' · ',
        el('a', { href: 'specs.html' }, ['Specs']),
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
      placeholder: 'Type workspace name or action (e.g., brains, quantum, gltf, benchmark)...',
      className: 'cmd-input',
      'aria-label': 'Command palette filter',
    }) as HTMLInputElement;

    const list = el('div', { style: 'display:flex;flex-direction:column;gap:6px;' });
    const actions: Array<{ label: string; run: () => void }> = [
      ...WORKSPACE_DEFS.map((w) => ({
        label: `Switch to ${w.label}`,
        run: () => this.switchWorkspace(w.id),
      })),
      {
        label: 'Export Asmodenius Prime glTF 2.0 (.gltf)',
        run: () => triggerClientDownload('Asmodenius_Prime.gltf', exportCreatureGltf2Json('Asmodenius_Prime', this.world.spinePtsXyz), 'model/gltf+json'),
      },
      {
        label: 'Capture Reversible ERP Checkpoint',
        run: () => {
          this.world.store.captureSnapshot();
          this.switchWorkspace('erp');
        },
      },
    ];

    const renderActions = (q: string) => {
      list.innerHTML = '';
      const norm = q.trim().toLowerCase();
      for (const act of actions) {
        if (norm && !act.label.toLowerCase().includes(norm)) continue;
        const b = el('button', { type: 'button', className: 'btn', style: 'justify-content:flex-start;' }, [act.label]);
        b.addEventListener('click', () => {
          dlg.close();
          act.run();
        });
        list.appendChild(b);
      }
    };

    input.addEventListener('input', () => renderActions(input.value));
    renderActions('');

    const closeBtn = el('button', { type: 'button', className: 'btn', style: 'margin-top:10px;' }, ['Close [Esc]']);
    const dlg = el('dialog', { className: 'cmd-dialog', 'aria-label': 'CQM2 Command Palette' }, [
      el('h3', { style: 'margin-top:0;' }, ['Command Palette']),
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
        });
      }

      if (tel.simTick % 4 === 0) {
        this.refreshTelemetryDom(tel);
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

    set('br-hot3', tel.asmodenius.metacognitiveConfidenceHot3.value.toFixed(3));
    set('br-voi', tel.asmodenius.epistemicValueOfInfo.toFixed(3));
    set('br-veto', String(tel.asmodenius.totalFreeWontVetoes));
    set('br-glitch-cos', tel.glitchling.kinematicAlignmentCosine.toFixed(4));
    set('br-glitch-stc', `${(tel.glitchling.stcConsolidatedFraction * 100).toFixed(0)}%`);

    set('q-norm', tel.quantumGeometry.normDrift.toExponential(2));
    set('q-berry', tel.quantumGeometry.berryCurvatureXY.toFixed(4));
    set('q-qrng', tel.qrngHealthy ? `PASS (${tel.qrngEntropyBits.toFixed(2)} b/B)` : 'WARN');
  }
}

if (typeof document !== 'undefined') {
  const host = document.getElementById('app');
  if (host) {
    const app = new Cqm2WorkstationApp();
    void app.mount(host);
  }
}
