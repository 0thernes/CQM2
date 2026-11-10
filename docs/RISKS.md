# Technical, Numerical, Database, Security & AI Risk Register (`v2.1.0`)

| Risk ID | Area | Failure Mode | Mitigation & Automated Verification |
|---|---|---|---|
| **R-01** | Numerical Stability | Explicit Euler stiff membrane explosion at large `dt` | Hasani semi-implicit `sLTC` (`cqm2_sltc_larkum_step`) + adaptive step-halving when `dt > 0.08 s`. |
| **R-02** | First-Law Drift | Floating-point creation/destruction of metabolic or ecological energy | All internal fluxes route exclusively through `transferConservedPoolKj()`; verified every tick by Rust/TS Kahan summation (`< 1e-12`). |
| **R-03** | Stochastic Coupling | Inspecting UI, running TMS assays, or toggling Glitchling flaws alters world evolution | Cryptographically separated `SubstreamPrngHub` (`world`, `genome`, `flaw`, `quantum`, `ecology`, `xenolingua`, `ui`) + state-cloned `runTmsPokeTest`. |
| **R-04** | Hardware Availability | Missing CUDA DLLs, OpenVINO NPU/iGPU drivers, or WebGPU in browser | `TriEngineOrchestrator` and `BrowserWebGpuCompute` probe gracefully and fall back to embedded Zig SIMD128 WASM. |
| **R-05** | Anthropomorphic Misread | Users mistaking PCI / HOT-3 / Xylos-14 / Thaler-9 readouts for real sentience | Persistent UI `NOT SENTIENT` badge + type-enforced `ComputationalIndicatorContract` (`sentienceClaim: 'NOT_SENTIENT'`). |
| **R-06** | IP & Safety Leak | Execution of `OBLITERATUS` (`AGPL-3.0`) or copyleft/proprietary/unlicensed Tsotchke repos | Non-bypassable `fencedQuarantine: true` (`enabled: false`) across all 9 restricted repos in `src/tsotchke/corpus.ts`, enforced by `scripts/lint.ts` and unit tests. |
| **R-07** | Photosensitive Hazard | High-frequency shader strobing when God Dials are pushed | `sanitizeGodDials()` and GLSL shaders clamp temporal pulse frequency to `<= 2.2 Hz` (`WCAG 2.3.1`) and honor `prefers-reduced-motion`. |
| **R-08** | DB Schema Rollback Data Loss | Unverified down-migration corrupting or dropping persisted simulation epochs | `rollbackMigration()` in `src/server/db.ts` refuses execution without a verified `VACUUM INTO` backup; `audit_events` blocks `UPDATE`/`DELETE` via SQLite triggers. |
| **R-09** | AI Prompt Injection / SSRF | Adversarial telemetry strings hijacking narrator output or probing internal/cloud hosts | `src/pipeline/free-ai-studio.ts` enforces strict loopback `127.0.0.1:11434` URL validation, PII redaction, control-directive stripping, HTML escaping, `<2,048` token cap, and passes `24/24` adversarial eval vectors. |
