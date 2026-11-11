# Changelog

All notable changes to **Cosmogonic Quantum Mechalogodrom 2 (`CQM2`)** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-11-11

### Added
- **Native Polyglot Tsotchke Engine (`native/tsotchke/cqm2_tsotchke_native.c`, `native/tsotchke/cqm2_moonlab_eshkol.cpp`, `src/native/tsotchke-bridge.ts`)**:
  - Real C17 RosettaWire `RSC1` SHA-256 content-addressed binary envelopes + `RSW1` fail-closed watchdogs.
  - Live runtime bindings to local `Moonlab v0.1.1` (`libquantumsim.dll`: Pironio-Toeplitz CHSH Bell QRNG `S ≈ 2.828`, QWZ 2D topological Chern number, and transverse-field Quantum Ising annealer), `libirrep` (`liblibirrep.dll`: SU(2) Clebsch-Gordan & Wigner 3j tensors), and `Eshkol v1.1-accelerate` (`eshkol-run.exe` LLVM CLI + native C++20 2nd-order Forward-Mode `HyperDual` automatic differentiation).
- **Expanded Zig 0.17 SIMD128 Native & WASM Kernels (`zig/src/root.zig`, `src/native/zig-bridge.ts`)**:
  - `cqm2_fwht_quantum_magic_m2` (Fast Walsh-Hadamard Transform Stabilizer Rényi Magic $M_2$), `cqm2_glyph_brain_batch_step` (`@Vector(4, f32)` SIMD128 3-layer MLP + Oja plasticity for 100 Pantheon Glyphs), `cqm2_csr_pagerank_louvain_arena` (zero-GC CSR PageRank + Louvain modularity $Q$ + Shannon degree entropy), and `cqm2_quasicrystal_icosa_shell` (6D → 3D icosahedral cut-and-project quasicrystal lattice).
- **Native Win32 Desktop / Start Menu / Taskbar Launcher (`native/launcher/cqm2_launcher.cpp`, `native/launcher/cqm2.ico`, `scripts/install-windows-launcher.ps1`)**:
  - Zero-console Win32 GUI executable (`CQM2.exe`) with embedded multi-resolution cosmic icon (`16/32/48/256 px`), single-instance mutex, health-checked background Quad-Silicon server startup (`127.0.0.1:4320`), automatic Edge/Chrome `--app=` window launch, and `--smoke` CI verification mode.
- **Complete Original-CQM World, Ciphers, Telemetry & Inspector Parity (`src/render/cqm-world-builders.ts`, `src/render/scene-4k.ts`, `src/ui/workstation.ts`, `src/ui/cqm-v3-panels.ts`)**:
  - 3D `6D→3D` Quasicrystal Shell around `GodColossus`, `100 Alphabet Pantheon Glyphs` + `101st APEX ς` Sovereign Monolith, 64 GPU-instanced 3D Sorting Field Pillars, physical ballistic `⟁ NHI` tossed probes, `◈ STAGE II` (`UwU`) rising 12-Pillar Obsidian `Monolith Temple`, and `⛓ ACCESS` (`IIIIVVVIVVVIVIIVIV` Roman Tally) `SUPERHERO` HUD + 2nd Super Creature (`Seraph-Prime`).
  - Scrollable 16-metric + 4-item `ECONOMY` `#sP` Telemetry panel; dedicated `XYLOS {7,3}` Poincaré Hyperbolic Disk + 6 ADR-0018 Organs studio; `ARCHON GODFORMS` (`5 Sovereign Archons` + `PRIME Super Neural` `4×27 = 108` cards + `MEGA 4D` `SO(4)` tesseract); `101 PANTHEONS` glyph matrix; `NHI OBS` 9-panel Mind Readout; `🧪 SANDBOX` (`10-Phyla %` + `17` live 3D world toggles); `⚙ SET` shortcut matrix; 8-speed `[0.25..16]×` stepper; `N(1/2)` `GENESIS` ↔ `BREAK_FREE`; and First-Law-conserving `☠` Apocalypse Rebirth (with `Shift+Click` N01 rollback).
- **Three Scholarly Satellite Laboratories (`public/lab/consciousness.html`, `public/lab/sentience.html`, `public/alife/cqm-capability-profile.html`)**:
  - Complete Butlin-14 Metric Braid, Ablation Waterfall, Casali PCI arousal falsification, and `CQM-25` capability radar under strict `style-src 'self'` CSP and explicit `[NOT SENTIENT]` scientific honesty callouts.

## [2.2.0] - 2026-11-11

### Added
- **Full-Bleed `100vw × 100vh` 4K Cosmogonic World & Shader Synthesis (`src/render/cqm-world-builders.ts`, `src/render/shaders.ts`, `src/render/scene-4k.ts`)**:
  - Restored and upgraded every iconic landmark of `Cosmogonic Quantum Mechalogodrom` at 4K `60+ FPS` via batched GPU `THREE.InstancedMesh` pools and GLSL fragment/vertex shaders (replacing CQM v1's `9 fps` CPU loops):
    - **`GodColossus` Center-Sky Manifold**: 81,920-triangle multi-lobed folded quasicrystal-gyroid manifold at `(0, 178, -210)` with iterative 4D orbit-trap + Inigo Quilez rainbow cosine oil-slick contour interference bands.
    - **Cosmic Coordinate-Grid Sky Dome & Bioluminescent Terrain**: Deep plum-magenta sky dome with perspective grid lines, aurora/brutalist/Stage-II crimson crossfades, and undulating bioluminescent terrain coupled to live Gray-Scott `DataTexture`.
    - **`6,272` GPU-Instanced Wild Alien Flora** across 4 compound pools (`0` per-frame CPU loop cost), **16 Obsidian/Emerald Obelisk Spires** + glowing frustum toppers + data catenaries, **148 Cantilevered Brutalist Megastructure Slabs**, **26 Floating Emerald Frustums**, **6 Cyan Light-Ribbon Shafts**, **32 Quantized 3D Voxel Glitch-Cubes**, **22-Ring Woven Holographic Sanctuary Dome**, and **`CrystalEcosystem` Big Tree Sanctuary**.
- **Complete Floating Glassmorphic Observatory HUD & 3-Row Dock (`src/ui/workstation.ts`, `src/ui/observatory-16.ts`, `src/ui/live-brains-3.ts`, `src/styles/tokens.css`, `public/index.html`)**:
  - Top-center `✦ Enter Mini World — full glory` macro sanctuary dive pill + 8-stage `#cqm-boot` cosmic loader.
  - Left column: `TELEMETRY` (`495/1000` live SoA entities + 4 sparklines), `SORTING FIELDS` (all 25 algorithms with `✶ ALL` & `▸ AUTO`), and `#perf-hud` live FPS / `ms` / `p95` / `MB` / Quad-Silicon provenance + 6 hardware tier selectors (`[phone]` .. `[mega]`).
  - Right column: `OBSERVATORY` (`OVER | VAR | ECO | WAR` 16 real-time HiDPI canvases), `SORTING · FIELD` (`PANCAKE FLIP`, `#g-alg`, Voronoi sector `HELTIBOR`, `Ω`), `SIM · SETTINGS`, and `3 Live Brains` (`APEX`, `MECHA`, `GLYPH`).
  - Bottom 3-row floating dock (`⇄ SPLIT`, `✦ BURST`, `☢ MUTATE`, `⚡ CHAOS+`, `◎ GOD`, `◈ XENOMIMIC`, `♧ LIFE TREE`, docs/studio launchers, and scrollable 22-button `#bar`) + Center-HUD translucent modal hosting all Quad-Silicon, Asmodenius/Glitchling/Xylos/Thaler/Causal-12, Hoggar/Tsotchke-27, ERP/N01, Market/Titans, Fenced AI Copilot, and 3D `.GLB` export studios.
- **25 Spatial Sorting Fields, `HELTIBOR` Voronoi Lore & 20-Titan Diplomacy (`src/sim/sorting-fields.ts`, `tests/sorting-fields-lore-titans.test.ts`)**:
  - Full step-by-step implementations of all 25 CQM sorting fields (`BUBBLE FIELD` .. `PREFIX PANCAKE`), deterministic 83-syllable `CosmologicalLoreEngine`, `TitanDiplomacySimulator`, and First-Law-conserving `SPLIT`/`BURST`/`MUTATE`/`XENOMIMIC` actions on `Cqm2WorldScheduler`.
- **9 Canonical Procedural Cosmic Songs & 8 SFX (`src/render/audio-synth.ts`)**:
  - `VOIDCROWN`, `BLACK MERIDIAN`, `ELDER ENGINE`, `LAST THEOREM`, `QUANTUM`, `STARKILLER REQUIEM`, `HORIZON HYMN`, `CROWN OF ASH`, and `DEEP MERIDIAN` on the `C3 = 130.81 Hz` natural minor scale.

## [2.1.0] - 2026-11-10

### Added
- **True Simultaneous Quad-Silicon Workloads (Zero Synthetic Buffers)**:
  - `cqm2_cuda_organism_brains_strided` (`cublasSgemmStridedBatched_v2`) in `native/gpu_cuda/cqm2_tri_accel.cpp` evaluating every living organism's unique 126-float neural cortex on persistent RTX 5070 Ti VRAM, plus persistent `ID3D12Device` + `IDMLDevice` initialization.
  - Three compiled OpenVINO models in `python/npu_world_worker.py`: action-conditioned RSSM (`[32, 64]` `[latent48 | action16]`) on physical `Intel(R) AI Boost` NPU, sensory unscrambler (`GPU.0`), and `[1, 2, 32, 32]` 2D Gray-Scott reaction-diffusion on `Intel(R) Graphics` iGPU.
  - Zero-copy `bun:ffi` binding to native `cqm2_zig.dll` AVX2 kernels in `src/native/zig-bridge.ts`, `cqm2_rust_lemire_lattice_sample` & `cqm2_rust_bf16_xor_encode`/`decode` in `rust/src/lib.rs`, and 1 Hz cached `nvidia-smi` + continuous 20 Hz UDP OSC emitter in `go/main.go`.
  - Expanded Zig 0.17 kernels (`zig/src/root.zig`): Layer-1 Oja plasticity, NIST SP 800-90B `RCT`/`APT` QRNG, 5-point degree-4 `cqm2_eshkol_spine_curvature`, `cqm2_eshkol_vandermonde_jet4`, 3D spinning `cqm2_kerr_mino_geodesic` (Carter `Q` drift `< 1e-12`), `cqm2_llg_spin_step`, `cqm2_spherical_harmonics_l2`, and `cqm2_rmsnorm_swiglu`.
- **Expanded Embodied Intelligence, Ecology & Quantum Synthesis**:
  - **Xylos v2 (`src/brains/xylos.ts`)**: Hyperbolic `{7,3}` medusa evaluating all 14 Butlin computational indicators + non-oracle corollary-discharge vs dream reality monitoring (`runXylosRealityMonitoringAssay`).
  - **Stephen Thaler Creativity Machine (`src/brains/thaler-creativity.ts`)**: Dual `Imagitron` + `Perceptor` critic, `DABUS` multi-hop chaining, `Gedanken-Death` cascade, 9 quantitative creativity markers, and 4 mandatory falsification ablations.
  - **Asmodenius v42 & Glitchling Upgrades**: Non-destructive state-cloned `runTmsPokeTest` (`WAKE`, `NREM_SLOW_WAVE`, `PROPOFOL_ANESTHESIA`), Dale 80/20 E/I law, astrocyte `Ca2+`, non-oracle `CalibHead` `HOT-3`, `GNW` ignition, `CEMI` phase-lock, `AST-1R`, `PAG`, 4 neuropeptides, non-oracle perturbation-estimated Marr-Albus Jacobian, `HD` ring attractor, `FHRR` holographic memory, and full **12-Benchmark Causal Lesion Suite** (`src/brains/causal-benchmarks.ts`).
  - **Diploid Ecology (`src/sim/ecology.ts`)**: 8-locus diploid genetics, Bateson-Dobzhansky-Muller speciation, `r=14` Big Tree Crystal Sanctuary + 6 fruiting pods, 5 Cosmological Singularities, Xenomimics entanglement, and AURUM/UMBRA economy.
  - **27-Repo Tsotchke Catalog (`src/tsotchke/corpus.ts`)**, **3D Kerr Relativity (`src/quantum/kerr-relativity.ts`)**, **Cabello KS-18 & 4Q Ising VQE (`src/quantum/contextuality.ts`)**, **Cormidium-16 (`src/quantum/xenolinguistics.ts`)**, and **Voynich-Khôra Fibonacci Anyon Braids (`src/quantum/voynich-khora.ts`)**.
- **Versioned OpenAPI v1 Backend, 3NF SQLite Migrations & Fenced Free-AI Studio**:
  - Forward/rollback SQL migrations (`migrations/001..002`), immutable `audit_events` trigger ledger, `VACUUM INTO` verified backups, cursor pagination, optimistic concurrency (`version_rev` `409`), and retention purge in `src/server/db.ts`.
  - Versioned `/api/v1/*` HTTP API + OpenAPI 3.1.0 (`/api/v1/openapi.json`), `Idempotency-Key`, duplicate-JSON-key & prototype-pollution shields, and fenced `src/pipeline/free-ai-studio.ts` (`llama3.2:3b` + 24-vector prompt-injection & PII redaction suite).
- **Cinema-4K 10-Shell Renderer, Clean `public/` Site, `.woff2` Fonts & Watertight `.GLB`**:
  - Watertight 2-manifold Bishop-frame binary `.glb` (`0x46546C67`, `Euler V - E + F = 2`), procedural PNG encoder, Unity 6 C#, and TouchDesigner Python exporters (`src/pipeline/exporters.ts`).
  - All 10 analytical parametric Mechalogodrom shells, live `24x24` Gray-Scott `THREE.DataTexture` chromatophore shader, 10 render modes, 8 camera presets, Raycaster click-to-inspect, 2-pointer pinch-zoom, 9-song Web Audio synthesizer + live FFT bar, `public/bible.html`, `public/lab/quantum-wildbeyond.html`, and self-hosted SIL OFL `Inter` + `JetBrains Mono` `.woff2` fonts.

### Changed
- Moved static web assets into `public/` for clean repository root hygiene (`I-065`) and added SHA-256 content-hashed asset bundles (`I-340`).
- Upgraded `docs/REPORT.md` to the full honest 8-tag profile (`WEB,API,DB,AI,SIM,NATIVE,AGENT,PUB`).

### Fixed
- Eliminated double `fastTanh` application in `zig/src/root.zig` Layer-1 organism cortex evaluation.
- Made `AsmodeniusV42Brain.runTmsPokeTest` non-destructive via full state cloning and `Cqm2WorldScheduler.rollbackToSnapshot` bit-exact across PRNG substreams and all neural/ecological state.
- Removed WebGPU `powerPreference` adapter warning on Windows Dawn and enabled persistent `GPUBuffer` reuse with numerical `Float32Array` readback.

### Security
- Fenced all 8 copyleft (`OBLITERATUS` AGPL-3.0, `quantum-quake` GPL-2.0), proprietary (`SolanaQuantumFlux`), unlicensed (`ulg`, `logo-lab`), PolyForm (`GRIMOIRE`), and LLM (`gpt2-basic`, `llm-arbitrator`) repositories behind `fencedQuarantine: true`.
- Enforced strict `style-src 'self'` CSP with zero inline styles, SSRF private-IP/scheme blocking, constant-time token verification, and socket-IP-only LRU rate limiting.

## [2.0.0] - 2026-11-10

### Added
- Initial CQM2 full-stack polyglot release (`CUDA cuBLAS` + `OpenVINO NPU` + `Zig 0.17 WASM/AVX2` + `Rust 1.94` + `Go 1.26` + `Three.js` 4K InstancedMesh + 10-table SoA/SQLite ERP).
