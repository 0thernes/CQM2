# Third-Party Open-Source Notices (`v2.1.0`)

CQM2 keeps its runtime dependency tree minimal (`1` npm production dependency: `three`) plus self-hosted SIL Open Font License 1.1 `.woff2` fonts.

## 1. Bundled Runtime Library & Self-Hosted Typography

- **`three` (`v0.185.1`)** — Copyright (c) 2010–2026 Three.js authors (`https://threejs.org/`), **MIT License**.
- **`Inter Variable` (`inter-latin-wght-normal.woff2`)** — Copyright (c) The Inter Project Authors (`https://rsms.me/inter/`), **SIL Open Font License 1.1**.
- **`JetBrains Mono` (`jetbrains-mono-latin-400-normal.woff2`, `700`)** — Copyright (c) JetBrains s.r.o. (`https://www.jetbrains.com/lp/mono/`), **SIL Open Font License 1.1**.

## 2. Permissive Mathematical Algorithms Adapted from `(Tsotchke)`

Clean-room Zig/Rust/TypeScript mathematical kernels in CQM2 adapt published formulas from permissive **MIT** / **Apache-2.0** repositories in the Tsotchke ecosystem (`eshkol`, `rosette-wire`, `moonlab`, `tensorcore`, `quantum_geometric_tensor`, `quantum_rng`, `libirrep`, `spin_based_neural_network`, `bonsai-fidelity-study`, `pq-consensus-bandwidth`, `PINN`, `Hyperbolic-Embedding`, `Hopfield-Network`). All copyleft (`OBLITERATUS` AGPL-3.0, `quantum-quake` GPL-2.0), proprietary (`SolanaQuantumFlux`), PolyForm (`GRIMOIRE`), and unlicensed (`ulg`, `logo-lab`) repositories are strictly quarantined (`fencedQuarantine: true`) with zero code copied or linked.

## 3. Build & Optional Local Hardware Toolchains

- **Bun (`v1.3.14`)** — MIT License
- **TypeScript (`v5.9.3`)** — Apache-2.0 License
- **Zig Standard Library (`v0.17.0`)** — MIT License
- **Rust Standard Library (`v1.94.1`)** — MIT OR Apache-2.0
- **Go Standard Library (`v1.26.2`)** — BSD-3-Clause
- **OpenVINO & NumPy** (optional local NPU/iGPU worker) — Apache-2.0 & BSD-3-Clause
