# Changelog

All notable changes to **Cosmogonic Quantum Mechalogodrom 2 (`CQM2`)** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
