# Heterogeneous Quad-Silicon Architecture (`dGPU + NPU + iGPU + CPU`)

## 1. Target Workstation Reference: MSI Vector 16 HX AI A2XW

CQM2 (`v2.1.0`) is calibrated and verified on the **MSI Vector 16 HX AI A2XW** running real simulation physics across all four physical silicon units simultaneously (zero synthetic `.fill()` dummy buffers), while remaining 100% portable to Linux, macOS, and any mobile/desktop browser:

| Unit | Physical Device | Native Driver / API | Real Simulation Workload & Measured Latency |
|---|---|---|---|
| **dGPU** | `NVIDIA GeForce RTX 5070 Ti Laptop GPU` (11.91 GB VRAM) | CUDA 12.9 `cublasSgemmStridedBatched_v2` (`cqm2_tri_accel.dll`) + Browser `WebGPU` | Evaluates every living organism's unique 126-float cortex (`16->6->8` Padé $\tanh$) on persistent VRAM (`< 0.14 ms / batch`; **5,687 GFLOPS** peak) |
| **NPU** | `Intel(R) AI Boost` (2 Slices, Arrow Lake-HX) | Level Zero (`ze_loader.dll`, `type=5`) + persistent OpenVINO `NPU` | Action-conditioned `[32, 64]` `[latent48 \| action16]` RSSM horizon rollouts + `[32, 16]` Glitchling sensory unscrambler (`~0.59 ms / batch`) |
| **iGPU** | `Intel(R) Graphics` | Persistent `DirectML` `IDMLDevice` + OpenVINO `GPU.0` | `[1, 2, 32, 32]` 2D Gray-Scott & pheromone habitat reaction-diffusion Laplacian (`~0.52 ms / batch`) |
| **CPU** | `Intel(R) Core(TM) Ultra 9 275HX` (24 Cores, 48 GB RAM) | Zig `0.17` AVX2 `bun:ffi` DLL + WASM SIMD128, x86-64 `AVX2+FMA3+POPCNT` ASM, Rust `1.94`, Go `1.26` | `< 0.15 ms` 5-phase tick, Kerr Mino geodesics, Rust Kahan/Lemire/BF16-XOR ledger, Go 20 Hz UDP OSC emitter |

## 2. Deterministic Fallback Hierarchy

Every native accelerator in `src/native/tri-engine.ts` has a mathematically equivalent counterpart in embedded WebAssembly (`src/native/zig-bridge.ts`) and TypeScript:
- If `cqm2_tri_accel.dll` or an NVIDIA GPU is absent → `dispatchOrganismCortexBatch` executes the identical `16->6->8` Padé rational $\tanh$ kernel via `cqm2_zig.dll` / embedded SIMD128 WASM.
- If `Intel(R) AI Boost` NPU / `Intel(R) Graphics` iGPU or `uv` is absent (or `CQM2_DISABLE_NPU=1`) → `NpuWorldClient` executes deterministic action-conditioned residual rollouts and 5-point stencil diffusion in TypeScript.
- If `cqm2_rust_ledger.dll` is absent → `auditMetabolicConservation`, `lemireLatticeSample`, and `bf16XorEncode`/`Decode` run identical Kahan/Lemire/BF16 algorithms in TypeScript.
