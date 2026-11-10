# ADR 0001 — Polyglot Quad-Silicon Architecture with WebAssembly SIMD128 Parity

- **Status**: Accepted (`2026-11-10`, updated for `v2.1.0`)
- **Context**: CQM v1's `hybrid-compute.ts` was a proposal-only stub (`gpuExecutedEntities: 0`, `npuExecutedEntities: 0`). On the target **MSI Vector 16 HX AI A2XW** (`RTX 5070 Ti` + `Intel AI Boost NPU` + `Intel Graphics iGPU` + `Ultra 9 275HX`), all four silicon units are physically present, yet CQM2 must also run cleanly in any mobile or 4K desktop browser and on Ubuntu CI.
- **Decision**:
  1. Implement shared inner-loop kernels once in **Zig `0.17`** (`zig/src/root.zig`), compiled simultaneously to embedded `wasm32-freestanding+simd128` (`20.0 KB`) for universal browser/CI execution and native AVX2 `cqm2_zig.dll` (`zero-copy` `bun:ffi` pointer dispatch).
  2. Use **C++20 + x86-64 AVX2/FMA3/POPCNT ASM** (`cqm2_tri_accel.dll`) strictly for persistent-VRAM `cuBLAS` `cublasSgemmStridedBatched_v2` organism cortex evaluation, `DirectML` persistent `IDMLDevice` iGPU binding, and `Level Zero` (`ze_loader.dll`) NPU hardware binding.
  3. Use a persistent **Python OpenVINO JSON-lines daemon** (`python/npu_world_worker.py`) hosting 3 genuine IR graphs across `NPU` (`[32, 64]` action-conditioned RSSM + `[32, 16]` unscrambler) and `GPU.0` (`[1, 2, 32, 32]` 2D Gray-Scott/pheromone habitat diffusion), **Rust `1.94`** (`cqm2_rust_ledger.dll`) for Merkle/Kahan/Lemire/BF16-XOR conservation auditing, and **Go `1.26`** (`cqm2-telemetry-bridge.exe`) for continuous 20 Hz UDP OSC streaming and cached GPU telemetry.
- **Rejected Alternatives**:
  1. *Pure TypeScript / Node.js Worker Threads*: Rejected because CPU-only execution leaves the discrete `RTX 5070 Ti` GPU, `Intel AI Boost` NPU, and `Intel Graphics` iGPU completely idle and incurs GC jitter on large typed arrays.
  2. *CUDA-Only Monolith without WebAssembly Fallback*: Rejected because CQM2 must also ship a standalone Universal Web Edition (`site/`) running on mobile phones, tablets, macOS, and Linux CI runners without NVIDIA drivers.
  3. *Per-Tick Subprocess Spawning (`nvidia-smi` / one-shot Python)*: Rejected because Windows process creation (`~180 ms`) violates the `< 16.6 ms` 60 Hz frame budget; persistent FFI DLLs, persistent OpenVINO JSON-lines pipes, and Go background caching keep steady-state overhead `< 1.2 ms`.
- **Consequences**: Genuine 4-processor hardware execution locally with zero synthetic `.fill()` buffers and zero loss of determinism or browser portability.
