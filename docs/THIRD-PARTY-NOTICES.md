# Third-Party Open-Source Notices

CQM2 keeps its runtime dependency tree deliberately minimal (`1` production npm package: `three`).

## 1. Bundled Runtime Dependency

- **`three` (`v0.185.1`)**
  - Copyright (c) 2010–2026 Three.js authors (`https://threejs.org/`)
  - License: **MIT License**

## 2. Build, Development & Optional Local Hardware Toolchains

- **Bun (`v1.3.14`)** — MIT License (JavaScriptCore / Zig runtime, bundler, `bun:sqlite`, `bun:ffi`, test runner).
- **TypeScript (`v5.9.3`)** — Apache License 2.0 (compile-time strict typechecking only).
- **Zig Standard Library (`v0.17.0`)** — MIT License (`wasm32-freestanding` SIMD128 & native DLL compilation).
- **Rust Standard Library (`v1.94.1`)** — MIT OR Apache-2.0 (`cqm2_rust_ledger` conservation & Merkle verifier).
- **Go Standard Library (`v1.26.2`)** — BSD-3-Clause (`cqm2-telemetry-bridge` HTTP + UDP OSC 1.0 hub).
- **OpenVINO & NumPy** (invoked optionally on local NPU workstations via `uv`) — Apache-2.0 & BSD-3-Clause.
