# ADR 0001 — Polyglot Tri-Engine Silicon Architecture with WebAssembly SIMD128 Parity

- **Status**: Accepted (`2026-11-10`)
- **Context**: CQM v1's `hybrid-compute.ts` was a proposal-only stub (`gpuExecutedEntities: 0`, `npuExecutedEntities: 0`). On the target **MSI Vector 16 HX AI A2XW** (`RTX 5070 Ti` + `Intel AI Boost NPU` + `Intel Graphics iGPU` + `Ultra 9 275HX`), all four silicon units are physically present, yet CQM2 must also run cleanly in any mobile or 4K desktop browser and on Ubuntu CI.
- **Decision**:
  1. Implement shared inner-loop kernels once in **Zig `0.17`** (`zig/src/root.zig`), compiled simultaneously to embedded `wasm32-freestanding+simd128` (`8.8 KB`) for universal browser/CI execution and native AVX2 `cqm2_zig.dll`.
  2. Use **C++20 + x86-64 AVX2/FMA3/POPCNT ASM** (`cqm2_tri_accel.dll`) strictly for `cuBLAS` SGEMM+tanh, `DirectML` iGPU, and `Level Zero` NPU hardware binding.
  3. Use a persistent **Python OpenVINO JSON-lines daemon** (`python/npu_world_worker.py`) for `<0.65 ms` zero-cold-start `Intel(R) AI Boost` NPU latent inference, **Rust `1.94`** for memory-safe Merkle & Kahan conservation auditing, and **Go `1.26`** for concurrent UDP OSC streaming.
- **Consequences**: Genuine 4-processor hardware execution locally with zero loss of determinism or browser portability.
