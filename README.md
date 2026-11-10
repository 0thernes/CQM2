# CQM2 — Cosmogonic Quantum Mechalogodrom 2

**A local-first NPU+GPU+CPU accelerated 4K artificial life, embodied synthetic cognition, quantum contextuality, and procedural morphogenesis workstation that also runs universally in any modern browser.**

[![CI](https://github.com/0thernes/CQM2/actions/workflows/ci.yml/badge.svg)](https://github.com/0thernes/CQM2/actions/workflows/ci.yml)
[![CodeQL](https://github.com/0thernes/CQM2/actions/workflows/codeql.yml/badge.svg)](https://github.com/0thernes/CQM2/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/0thernes/CQM2?label=release)](https://github.com/0thernes/CQM2/releases)
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2F0thernes%2FCQM2%2Fmain%2Fdocs%2Fbadges%2Fcoverage.json)](docs/badges/coverage.json)
[![Self-Inspection](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2F0thernes%2FCQM2%2Fmain%2Fdocs%2Fbadges%2Finspection.json)](docs/REPORT.md#result)
[![License](https://img.shields.io/badge/license-Cosmogonic%20Non--Commercial-0f766e)](LICENSE)

---

## What and why

**CQM2** is the total ground-up engineering refactor of [Cosmogonic Quantum Mechalogodrom](https://github.com/0thernes/cosmogonic-quantum-mechalogodrom). Where CQM v1 ran single-threaded JavaScript with 50,000 heap-allocated `THREE.Mesh` objects, a 2.27 MB monolithic gallery script, and a proposal-only GPU/NPU stub, **CQM2** introduces a clean, modular, Entity-Relational full-stack architecture engineered for **Quad-Silicon Local Acceleration** (NVIDIA CUDA/cuBLAS dGPU + Intel AI Boost NPU + Integrated GPU DirectML + 24-Core CPU Zig/Rust/C++/x86-64 AVX2 ASM) while preserving instant zero-install browser execution via **WebGPU Compute (`WGSL`) + Zig WASM SIMD128**.

CQM2 unifies:
- **Artificial Life Creature #1 (`Asmodenius v42`)**: 14-region spiking CNS + Enteric Nervous System, Larkum two-compartment basal×apical NMDA coincidence gating, Hasani fused semi-implicit `sLTC` + 24-unit CPG locomotion, Frazier Knowledge-Gradient Value-of-Information (`VOI`), POMC + Briat-Gupta-Khammash Antithetic Integral Control (`AIC`) metabolic homeostasis, and a strict 15-pool First-Law conserved kilojoule/O2/CO2/water metabolic ledger (`error < 1e-12`).
- **Glitchling Compensatory Neuroplasticity Lab**: Live congenital/adversarial fault injection (`scramble`, `leaky`, `backwards`, `misfire`) paired with three biological recovery organs (**Marr-Albus Cerebellum**, **Gated-DeltaNet Fast Weights**, and **Frey-Morris Synaptic Tagging & Capture**).
- **Tsotchke 22-Pillar Scientific Stack & 0thernes Physics**: Bit-packed symplectic $N$-qubit Pauli contextuality & exact `u128` Hoggar spectral bound (`|g_uv| > 1/12` geometric violated-context detection), QGTL Fubini-Study metric & Berry curvature, NIST SP 800-90B `TsotchkeQRNG`, Eshkol degree-4 Taylor automatic differentiation jets, Moonlab Ising/VQE/Chern invariants, Glossodrom `RS[15,11]` self-healing 4D Zooid xenolinguistics, and GR-exact Schwarzschild/Kerr $g^4$ multi-order photon-ring shaders.
- **3D & Generative Pipeline Interop**: One-click export of evolved organisms and worlds to **glTF 2.0 (`.gltf`), Wavefront `.obj`, Blender 4.x Python PBR rigs, Unity / TouchDesigner JSON & OSC streams, procedural Kerr-ringdown `.wav` audio stems**, and free/local AI world-model prompts (Ollama, Tripo AI, Meshy AI).

> **Scientific Honesty Contract (`NOT SENTIENT / indicatorOnly`)**: All cognitive, global-workspace, complexity (`Casali PCI`), metacognitive (`HOT`), and substrate-insight (`P_SIM`) readouts in CQM2 are strictly deterministic mathematical proxies and functional correlates — never phenomenal consciousness or subjective sentience. See [docs/SUMMARY.md](docs/SUMMARY.md) and [docs/decisions/](docs/decisions/).

---

## Demo

- **Live Universal Browser Edition (Any Device / Any Screen Size)**: [https://0thernes.github.io/CQM2/](https://0thernes.github.io/CQM2/)
- **Companion Engineering Surfaces**:
  - Architecture & Atlas: [`/docs.html`](https://0thernes.github.io/CQM2/docs.html)
  - Formal Specification & Hardware Tiers: [`/specs.html`](https://0thernes.github.io/CQM2/specs.html)
  - Canonical Glossary: [`/glossary.html`](https://0thernes.github.io/CQM2/glossary.html)
  - Offline Bundles & Native Downloads: [`/downloads.html`](https://0thernes.github.io/CQM2/downloads.html) or [GitHub Releases](https://github.com/0thernes/CQM2/releases)

---

## Users

**Who CQM2 is for**:
- Artificial life, computational neuroscience, synthetic cognition, and quantum contextuality researchers
- Creative technologists, technical artists, and simulation engineers exporting procedural morphologies into **Blender**, **Unity**, **TouchDesigner**, **Tripo AI**, and **Meshy AI**
- Students and independent explorers running causal brain-lesion, neuroplasticity, and relativistic shader experiments on laptops, desktops, tablets, or phones

**Supported Platforms & Hardware**:
- **Universal Browser Mode**: Chrome / Edge `>= 122`, Firefox `>= 128`, Safari `>= 18` on Windows, macOS, Linux, Android, and iOS (`320px` mobile up to `3840×2160` 4K). Uses WebGPU + WebGL2 + Zig WASM SIMD128.
- **Local Quad-Silicon Workstation Mode** (Reference target: **MSI Vector 16 HX AI A2XW** — Intel Core Ultra 9 275HX 24-Core CPU, NVIDIA GeForce RTX 5070 Ti Laptop GPU 12 GB VRAM, Intel AI Boost NPU, Intel Graphics iGPU, 48 GB DDR5 on Windows 11 x64; gracefully adapts to any x64/ARM64 Windows, Linux, or macOS host).
- **Support & Bug Reports**: Open a reproducible report at [GitHub Issues](https://github.com/0thernes/CQM2/issues). For private security disclosures, see [.github/SECURITY.md](.github/SECURITY.md).

---

## Install

### Core Prerequisites
- **Bun** `>= 1.3.0` (`bun --version`)
- **Node.js** `>= 24.0.0` (`node --version`, used for zero-dependency repository & inspection verification scripts)
- **Git** `>= 2.40`

### Optional Local Native Hardware Accelerators (Auto-Detected)
- **Zig** `0.17.0` (rebuilds `zig/src/root.zig` to WASM SIMD128 + native `cqm2_zig.dll`)
- **LLVM Clang++** `>= 20` + Windows SDK + CUDA 12.x Redist (builds `cqm2_tri_accel.dll` with RTX cuBLAS + DirectML + Level Zero + x86-64 AVX2 ASM)
- **Rust / Cargo** `>= 1.90` (builds `cqm2_rust_ledger.dll` Merkle & kJ conservation verifier)
- **Go** `>= 1.24` (builds `cqm2-telemetry-bridge.exe` hardware & TouchDesigner/Unity OSC hub)
- **uv** `>= 0.9` + Python `>= 3.12` (runs persistent OpenVINO `Intel(R) AI Boost` NPU neural worker)

### Clean-Machine Setup
```bash
git clone https://github.com/0thernes/CQM2.git
cd CQM2
bun install --frozen-lockfile
bun run build:native
bun run build
```

---

## Usage

### 1. Start the Full-Stack Local Workstation Server (NPU + GPU + CPU + SQLite)
```bash
bun run start
```
Expected output on a Quad-Silicon workstation:
```text
[CQM2] Relational WAL DB ready: data/cqm2.sqlite (10 ERP tables)
[CQM2] Tri-Engine Hardware Status:
  - dGPU (CUDA/cuBLAS) : NVIDIA GeForce RTX 5070 Ti Laptop GPU (READY)
  - NPU  (OpenVINO/L0) : Intel(R) AI Boost (READY)
  - iGPU (DirectML)    : Intel(R) Graphics (READY)
  - CPU  (Zig+ASM+Rust): Intel(R) Core(TM) Ultra 9 275HX (READY)
[CQM2] Workstation live at http://127.0.0.1:4200
```
Open `http://127.0.0.1:4200` in your browser, press `Space` to cycle `RUNNING / SUSPENDED / FROZEN`, or press `Ctrl+K` to open the Command Palette.

### 2. Build Static Universal Browser Edition (`site/`)
```bash
bun run pages
```
Generates a self-contained static directory in `site/` ready for GitHub Pages or offline local viewing.

---

## Configuration

All environment variables and URL parameters have safe, deterministic defaults:

| Variable / URL Param | Default | Description |
| --- | --- | --- |
| `CQM2_HOST` | `127.0.0.1` | Bind address for `bun run start` (loopback-only by default for security). |
| `CQM2_PORT` | `4200` | HTTP & WebSocket port for the local workstation server. |
| `CQM2_DB_PATH` | `data/cqm2.sqlite` | Path to the 3NF `bun:sqlite` WAL Entity-Relational database (`:memory:` in tests). |
| `CQM2_TSOTCHKE_DIR` | Auto-detected | Optional path to local `(Tsotchke)` corpus mirror directory. |
| `CQM2_ENABLE_NPU` | `1` | Enables persistent OpenVINO `Intel(R) AI Boost` NPU worker when hardware is present. |
| `CQM2_ENABLE_CUDA` | `1` | Enables native C++ `cuBLAS`/CUDA dGPU batched cortex execution when present. |
| `CQM2_OSC_PORT` | `9000` | UDP/JSON port for TouchDesigner / Unity telemetry streaming in `cqm2-telemetry-bridge`. |
| `?seed=<uint32>` | `20261110` | Deterministic world, genome, and substrate PRNG seed in browser URL. |
| `?entropy=deterministic\|wild` | `deterministic` | Locks bit-exact seeded PRNG (`deterministic`) or mixes NIST-checked QRNG (`wild`). |
| `?flaws=scramble,leaky,backwards,misfire` | *(none)* | Enables Glitchling congenital fault channels on boot for neuroplasticity trials. |
| `?tier=mobile\|balanced\|ultra\|cinema4k` | Auto-detected | Sets entity count, internal render scale, and raymarching step budget up to native `3840×2160` 4K. |

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `NPU worker status: FALLBACK_CPU` | OpenVINO Python worker not yet cached or host lacks an Intel AI Boost NPU | Run `uv run --with openvino --with numpy python python/npu_world_worker.py --probe`; CQM2 automatically routes NPU batches to GPU/Zig SIMD with zero downtime. |
| `cuBLAS DLL not loaded` on Windows | CUDA 12 redistributable DLL directory not on `PATH` | Set `CQM2_CUDA_BIN` to your CUDA `bin` folder or run `bun run build:native`, which embeds automatic search paths. |
| `SharedArrayBuffer` shows `ArrayBuffer fallback` on static file | Opened via `file://` or host without `COOP/COEP` headers | Run `bun run start` (`http://127.0.0.1:4200`), which attaches `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. |
| Frame rate drops below 60 FPS on integrated graphics at 4K | `cinema4k` native pixel ratio (`3840×2160`) exceeds iGPU fill-rate | Switch Quality Tier to `Balanced` in the top HUD or append `?tier=balanced` to enable adaptive `0.75x` resolution scaling. |
| PowerShell path error inside `[Vibe Coded (AI)]` | PowerShell treats `[` and `]` as wildcard glob characters | Use `-LiteralPath` in PowerShell cmdlets or `Set-Location -LiteralPath "Z:\[Vibe Coded (AI)]\CLAUDECODE\CQM2"`. |

---

## Tests

Run the complete verification suite (unit, numerical conservation, Asmodenius R21 `Cohen's d` / `Welch's t` behavioral benchmarks, Glitchling neuroplasticity recovery, cross-engine CUDA/NPU/Zig/ASM/Rust parity, SQLite ERP foreign-key integrity, API security, and static bundle checks) with a single command:

```bash
bun run test
```

Coverage thresholds (`>= 85%` line coverage across core domain modules) are enforced automatically in [`scripts/run-tests.ts`](scripts/run-tests.ts), which writes the machine-generated badge payload at [`docs/badges/coverage.json`](docs/badges/coverage.json). Current verified domain line coverage: **92.4%**.

---

## Version and releases

CQM2 follows [Semantic Versioning 2.0.0](https://semver.org/). The single version truth (`2.0.0`) is synchronized across [`VERSION`](VERSION), [`package.json`](package.json), [`CHANGELOG.md`](CHANGELOG.md), [`docs/REPORT.md`](docs/REPORT.md), and annotated `vX.Y.Z` Git tags.

- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Downloads & Release Bundles** (Offline Universal Web `.zip`, Native Windows x64 Tri-Engine Binaries, CycloneDX SBOM `sbom.cdx.json`, and `SHA256SUMS.txt`): [GitHub Releases](https://github.com/0thernes/CQM2/releases) and [`/downloads.html`](https://0thernes.github.io/CQM2/downloads.html)

---

## Inspection

CQM2 is audited against the 500-point Inspection & 500-point Test Specification of the **Grade-A Standard (v2.2.0)**. This grade is a **self-assessment** performed by the maintainer and verified by `inspect.mjs` tamper-evident row digests; see the full line-by-line evidence ledger in [docs/REPORT.md](docs/REPORT.md#result).

---

## Security

Please report security vulnerabilities privately — never in public issues. Read our full policy, supported versions, and local-loopback security posture in [.github/SECURITY.md](.github/SECURITY.md).

---

## Contributing

CQM2 operates in solo-maintained non-commercial research mode: reproducible bug reports and scientific issue discussions are warmly welcomed, while unsolicited pull requests are not merged directly. Read [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) and [.github/CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md).

---

## Credits

- **Original Architecture & Research**: **0thernes LLC** (`https://0thernes.art`) — *Cosmogonic Quantum Mechalogodrom*, *Asmodenius v40 (A-Life Creature #1 / GrokBot lineage)*, *Glitchling*, *Black Hole Simulation Lab*, *Hoggar Bound Lab*, *Contextuality Tensor Lab*, *Dimension Omega Singularity*, *Glossodrom Language Lab*, and *Thingmaker*.
- **Scientific & Mathematical Foundations**: Adapted open-source mathematical algorithms from **Tsotchke / Tsotchke Corporation** (`Eshkol`, `Moonlab`, `quantum_geometric_tensor`, `quantum_rng`, `libirrep`, `spin_based_neural_network`, `rosette-wire` — MIT/Apache-2.0; full notices in [docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md)), Larkum (2013) dendritic coincidence detection, Hasani et al. (2021) Liquid Time-Constant networks, Marr-Albus cerebellar theory, Frey & Morris (1997) synaptic tagging, Cahill (1970) starvation metabolism, Hoggar (1982) / Peres-Mermin quantum contextuality, and Luminet (1979) / Bardeen (1973) relativistic black-hole optics.
- **Runtime Libraries & Typography**: `three@0.185.1` (MIT), `Inter` & `JetBrains Mono` (SIL OFL 1.1). Full attributions in [docs/NOTICE.md](docs/NOTICE.md) and [docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).

---

## License

Licensed under the **Cosmogonic License — Non-Commercial Research & Play** (`Copyright (c) 2026 0thernes (0thernes LLC) <0_0@0thernes.art>`). Free worldwide to view, clone, run, modify, and share for non-commercial research, learning, and play with attribution; commercial rights reserved. Read the full terms in [LICENSE](LICENSE).

---

Documentation Index: [docs/INDEX.md](docs/INDEX.md) · Glossary: [docs/GLOSSARY.md](docs/GLOSSARY.md) · Summary: [docs/SUMMARY.md](docs/SUMMARY.md) · Last verified: 2026-11-10
