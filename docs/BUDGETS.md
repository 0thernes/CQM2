# Performance, Memory, Load, Bundle & Numerical Accuracy Budgets (`v2.1.0`)

## 1. Static Bundle, Latency & Numerical Accuracy Gates

| Budget Category | Metric | Hard Gate / Budget | Measured CQM2 v2.1.0 |
|---|---|---|---|
| **Frontend Bundle** | Content-hashed JS (`workstation.<hash>.js` incl. Three.js + Zig WASM) | `<= 1,500 KB` uncompressed | **`783.8 KB`** (`~205 KB` gzip) |
| **WildBeyond Lab Bundle** | Content-hashed `wildbeyond-lab.<hash>.js` | `<= 128 KB` uncompressed | **`41.0 KB`** |
| **Stylesheet & Fonts** | `tokens.<hash>.css` (`0` `!important`) + 3 self-hosted `.woff2` fonts | `<= 32 KB` CSS / `<= 150 KB` fonts | **`12.9 KB` CSS + `91.3 KB` WOFF2** |
| **Source Maps** | Production `.map` files in `site/` | `0` files | **`0` files** |
| **dGPU Strided Cortex** | Per-organism `8->8->6` batched SGEMM+tanh (`RTX 5070 Ti` cuBLAS) | `<= 1.5 ms` | **`0.08–0.24 ms`** |
| **NPU World Model** | Action-conditioned `[32, 64]` RSSM rollout (`Intel AI Boost`) | `<= 5.0 ms` | **`0.56–0.72 ms`** |
| **iGPU Field Diffusion** | `[1, 2, 32, 32]` 2D Gray-Scott step (`Intel Graphics` OpenVINO) | `<= 3.0 ms` | **`0.38–0.65 ms`** |
| **Metabolic Conservation** | Max relative 15-pool First-Law drift | `< 1.0 × 10⁻¹²` | **`< 1.0 × 10⁻¹⁴`** |
| **Kerr Mino Geodesic** | Carter fourth invariant $|Q(\lambda) - Q(0)|$ | `< 1.0 × 10⁻¹²` | **`< 1.0 × 10⁻¹³`** |
| **Quantum Norm Drift** | $\|\psi(t)\| - 1$ over 500 unitary steps | `< 1.0 × 10⁻¹²` | **`5.11 × 10⁻¹⁵`** |
| **WCAG Flash Safety** | Maximum visual/shader temporal pulse rate | `<= 2.2 Hz` | Hard-clamped at **`2.2 Hz`** |

## 2. 2× Peak Concurrent HTTP API Burst Load Budget (`I-164`, `T-375`)

Target nominal workstation rate is `30 req/s`; verified at **2× peak concurrent burst (`64` parallel requests across `/api/v1/health`, `/api/v1/world/telemetry`, `/api/v1/erp/organisms`, and `/api/v1/world/step`)**:

| Load Profile | Concurrent Requests | Error Rate (`5xx`) | `p50` Latency | `p95` Latency | `p99` Latency | Gate Verdict |
|---|---|---|---|---|---|---|
| **2× Peak Burst (`v2.1.0`)** | `64` parallel HTTP v1 calls | **`0.00%`** (`< 1%` gate) | `1.8 ms` | `9.4 ms` | `18.2 ms` | **PASS** |
