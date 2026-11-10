# Performance, Memory, Bundle & Numerical Accuracy Budgets

| Budget Category | Metric | Hard Gate / Budget | Measured CQM2 v2.0.0 |
|---|---|---|---|
| **Frontend Bundle** | Total production JS (`Three.js` + `Zig WASM` + UI) | `<= 1,500 KB` uncompressed | **`653.7 KB`** (`~175 KB` gzip) |
| **Stylesheet** | Design-token CSS (`tokens.css`) | `<= 32 KB`, `0` `!important` | **`9.5 KB`**, `0` `!important` |
| **Source Maps** | Production `.map` files in `site/` | `0` files | **`0` files** |
| **5-Phase Sim Tick** | 128 organisms + Asmodenius + Glitchling + Pantheon + QGTL | `<= 4.0 ms / tick` (250 Hz headroom) | **`~0.42 ms / tick`** |
| **dGPU SGEMM+tanh** | `512×512` batched cortex (`RTX 5070 Ti` cuBLAS) | `<= 1.0 ms` | **`0.0472 ms`** (`5,687 GFLOPS`) |
| **NPU World Model** | `32×64` RSSM latent rollout (`Intel AI Boost`) | `<= 5.0 ms` | **`0.559–0.646 ms`** |
| **Metabolic Conservation** | Max relative 15-pool First-Law drift | `< 1.0 × 10⁻¹²` | **`5.59 × 10⁻¹⁶`** |
| **Quantum Norm Drift** | $\|\psi(t)\| - 1$ over 500 unitary steps | `< 1.0 × 10⁻¹²` | **`5.11 × 10⁻¹⁵`** |
| **Test Coverage** | Automated line coverage across `src/` core | `>= 85.0%` | Verified via `bun run test` |
| **WCAG Flash Safety** | Maximum visual/shader temporal pulse rate | `<= 2.2 Hz` | Clamped at `2.2 Hz` |
