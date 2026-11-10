# Heterogeneous Tri-Engine Silicon Architecture (`GPU + NPU + iGPU + CPU`)

## 1. Target Workstation Reference: MSI Vector 16 HX AI A2XW

CQM2 is calibrated and verified on the **MSI Vector 16 HX AI A2XW** while remaining 100% portable to Linux, macOS, and any mobile/desktop browser:

| Unit | Physical Device | Native Driver / API | Measured CQM2 Throughput / Latency |
|---|---|---|---|
| **dGPU** | `NVIDIA GeForce RTX 5070 Ti Laptop GPU` (11.91 GB VRAM) | CUDA 12.9 `cuBLAS` (`cqm2_tri_accel.dll`) + Browser `WebGPU` | **5,687.1 GFLOPS** (`0.047 ms` on `512×512` SGEMM+tanh) |
| **NPU** | `Intel(R) AI Boost` (2 Slices, Arrow Lake-HX) | Level Zero (`ze_loader.dll`, `type=5`) + OpenVINO `NPU` | **0.559–0.646 ms / batch** (`32×64` RSSM World Model) |
| **iGPU** | `Intel(R) Graphics` | Windows `DXCore + DirectML` + OpenVINO `GPU.0` | **0.512 ms / batch** (`32×16` Sensory Unscrambler) |
| **CPU** | `Intel(R) Core(TM) Ultra 9 275HX` (24 Cores, 48 GB RAM) | Zig `0.17` SIMD128, x86-64 `AVX2+FMA3+POPCNT` ASM, Rust `1.94`, Go `1.26` | `< 0.15 ms` per 128-entity 5-phase tick + Kahan audit |

## 2. Deterministic Fallback Hierarchy

Every native accelerator in `src/native/tri-engine.ts` has an exact mathematical counterpart in embedded WebAssembly (`src/native/zig-bridge.ts`) and TypeScript:
- If `cqm2_tri_accel.dll` or an NVIDIA GPU is absent → `dispatchGpuCortexGemm` executes the identical Padé rational $\tanh$ matrix kernel in deterministic floating-point.
- If `Intel(R) AI Boost` NPU or `uv` is absent (or `CQM2_DISABLE_NPU=1`) → `NpuWorldClient` executes the deterministic residual latent rollout.
- If `cqm2_rust_ledger.dll` is absent → `auditMetabolicConservation` runs the identical Kahan compensated summation in TypeScript.
