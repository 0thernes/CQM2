# Technical, Numerical & Scientific Risk Register

| Risk ID | Area | Failure Mode | Mitigation & Verification |
|---|---|---|---|
| **R-01** | Numerical Stability | Explicit Euler stiff membrane explosion at large `dt` | Replaced with Hasani semi-implicit `sLTC` (`cqm2_sltc_larkum_step`) + adaptive step-halving when `dt > 0.08 s`. |
| **R-02** | First-Law Drift | Floating-point creation/destruction of metabolic energy | All internal fluxes route exclusively through `transferConservedPoolKj()`; verified every tick by Rust/TS Kahan summation (`< 1e-12`). |
| **R-03** | Stochastic Coupling | Inspecting UI or toggling Glitchling flaws alters world evolution | Cryptographically separated `SubstreamPrngHub` (`world`, `genome`, `flaw`, `quantum`, `ecology`, `xenolingua`, `ui`). |
| **R-04** | Hardware Availability | Missing CUDA DLLs, OpenVINO NPU driver, or WebGPU in browser | `TriEngineOrchestrator` and `BrowserWebGpuCompute` probe gracefully and fall back to embedded Zig SIMD128 WASM. |
| **R-05** | Anthropomorphic Misread | Users mistaking PCI / HOT-3 / Kuramoto readouts for real sentience | Persistent UI `NOT SENTIENT` badge + type-enforced `ComputationalIndicatorContract` (`sentienceClaim: 'NOT_SENTIENT'`). |
| **R-06** | Uncensored Corpus Leak | Execution of `OBLITERATUS` weights/tools from Tsotchke mirror | Hard-coded `if (pillarId === 'OBLITERATUS') return false;` fence enforced by `scripts/lint.ts` and unit tests. |
| **R-07** | Photosensitive Hazard | High-frequency shader strobing when God Dials are pushed | `sanitizeGodDials()` and GLSL `KERR_SINGULARITY_FRAGMENT_SHADER` clamp pulse rate to `<= 2.2 Hz` (`WCAG 2.3.1`). |
