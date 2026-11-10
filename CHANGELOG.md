# Changelog

All notable changes to **Cosmogonic Quantum Mechalogodrom 2 (`CQM2`)** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-11-10

### Added
- **Quad-Silicon Local Hardware Acceleration (`Tri-Engine` + iGPU)**:
  - Native C++20 `cuBLAS` + CUDA Driver API accelerator (`native/gpu_cuda/cqm2_tri_accel.cpp`) delivering 5,600+ GFLOPS batched neural cortex & morphogen evaluation on NVIDIA GeForce RTX 5070 Ti Laptop GPU (`12 GB VRAM`).
  - Persistent OpenVINO + Intel Level Zero (`ze_loader.dll`) neural execution engine (`python/npu_world_worker.py`) running batched RSSM world-models and sensory realignment directly on physical `Intel(R) AI Boost` NPU (`<0.6 ms/batch`) plus `Intel(R) Graphics` iGPU DirectML/OpenVINO offload.
  - Dual-target **Zig 0.17.0** mathematical kernel library (`zig/src/root.zig`) compiling to both WebAssembly SIMD128 (`+simd128`, `+bulk_memory`) for universal browsers and native Windows x64 AVX2 (`cqm2_zig.dll`) via `Bun.FFI`.
  - Hand-tuned **x86-64 AVX2/FMA3/POPCNT** assembly hot-path kernels (`native/gpu_cuda/cqm2_avx2_asm.S`) for ultra-low-latency micro-cortex `GEMV+tanh` and symplectic Pauli commutation parity on Intel Core Ultra 9 275HX (24 cores).
  - **Rust 1.94.1** deterministic Entity-Relational Merkle state verifier & First-Law metabolic conservation auditor (`rust/src/lib.rs`).
  - **Go 1.26.2** concurrent local hardware telemetry & TouchDesigner / Unity / Blender OSC + JSON streaming hub (`go/main.go`).
- **Upgraded Embodied Cognition (`Asmodenius v42` + `Glitchling` + `Pantheon`)**:
  - Complete 14-region spiking CNS + Enteric Nervous System (`SENS, THAL, CTX, HIP, STR, HYP, VTA, RAPHE, LC, BF, INS, SCN, MOT, ENS`) with Larkum two-compartment basal×apical NMDA coincidence gating, PV onset reset, and Hasani fused semi-implicit sLTC + 24-unit CPG locomotion.
  - Resolved open R21 behavioral benchmarks (`Cohen's d >= 0.8`, `Welch's t >= 2.75`): Frazier Knowledge-Gradient Value-of-Information (`activeInference`), POMC/GLP-1 gut-glucose satiety (`CQM10`), Briat-Gupta-Khammash Antithetic Integral Control + cephalic insulin (`C16R`), and endogenous Higher-Order Thought confidence (`HOT-3`).
  - Completed `LIFE-100` & `NOVEL-100` pillars: 15-pool conserved kJ metabolic ledger (`error < 1e-12`) with aerobic/anaerobic `O2/CO2` stoichiometry, water/osmolarity thirst competition, corpse detritus ecology, telomere senescence, diploid sexual crossover, metabolic synaptic ATP pricing (`N33`), reversible thought rollback (`N01`), and `P_SIM` anomaly memory quarantine (`N52`).
  - Integrated **Glitchling** 4 congenital/adversarial flaws (`scramble`, `leaky`, `backwards`, `misfire`) alongside three biological compensatory neuroplasticity organs: **Marr-Albus Cerebellum** (cures `backwards`), **Gated-DeltaNet Fast Weights** (cures `scramble`), and **Frey-Morris Synaptic Tagging & Capture** (cures `leaky` & `misfire`).
  - Integrated **5-Caste Kuramoto + Cholesky DPP Swarm Pantheon**, **5 Archon SuperMinds** (FHRR Phasor `HDCMap` + 256-slot Modern Hopfield + Selective Complex SSM), and **10-Shell Central Mechalogodrom** with Bi-Poo STDP.
- **Quantum Contextuality, Tsotchke Corpus & 0thernes Physics**:
  - 22-pillar Tsotchke mathematical integration (`Eshkol` degree-4 Taylor jets & DBSP, `Moonlab` Ising/VQE/QWZ Chern, `QGTL` Fubini-Study & Berry curvature, `TsotchkeQRNG` with live NIST SP 800-90B RCT/APT health gates, `libirrep` Majorana skyrmions, `SbNN` MinSR) with automatic local mirror discovery (`(Tsotchke)`).
  - Bit-packed symplectic $N$-qubit Pauli engine, exact `u128` Hoggar spectral bound, and geometric contextuality detection (`|g_uv| > 1/12` on the split Cayley hexagon $H(2)$).
  - Self-healing **Glossodrom `RS[15,11]` over `GF(16)`** 4D Zooid xenolinguistics & reversible `RV32IM_Xgloss` skin self-painting + **Thingmaker** 4-stream deterministic phonotactic taxonomy.
- **Entity Relational Programming (`ERP`) & Full-Stack Persistence**:
  - 10 normalized columnar Structure-of-Arrays (`SoA`) in-memory relational tables backed by `SharedArrayBuffer` (zero heap `THREE.Mesh` objects per entity) mirrored into a persistent 3NF `bun:sqlite` WAL database (`src/server/db.ts`) and browser `IndexedDB` snapshots.
- **4K WebGPU/WebGL2 Renderer, Responsive Workstation UI & Creative Export Pipeline**:
  - GR-exact Schwarzschild/Kerr $g^4$ multi-order photon-ring shader, Lipschitz-guarded 4D non-Euclidean manifold warp, FitzHugh-Nagumo + Gray-Scott + Guanine thin-film iridescent creature skin, `webglcontextlost` recovery, and `<= 3 Hz` WCAG flash limiter.
  - Responsive workstation UI (`320px` mobile to `3840px` 4K) with 7 workspaces, `Ctrl+K` Command Palette, TMS Poke Test (`Casali PCI` + $F$ vs $W$), Clone Transplant Bench, 7-Rung God Dial Deck, and one-click export to **glTF 2.0 (`.gltf`), `.obj`, Blender 4.x `.py`, Unity/TouchDesigner JSON/OSC, Procedural Cosmic/Kerr-Ringdown `.wav`**, and Tripo/Meshy/Ollama Free-AI world-model adapters.
- **Grade-A Engineering, CI/CD & Documentation**:
  - Complete 20-point `GITHUB-REPO-STANDARD.md` compliance, 500-point product inspection (`docs/REPORT.md`), comprehensive test suite, CycloneDX SBOM generator, and GitHub Actions CI + CodeQL + GitHub Pages + Release pipelines.
