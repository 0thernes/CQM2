# Incident Log & Legacy Defect Retirement Ledger (`v2.1.0`)

## Active Production Incidents (`v2.1.0`)

- **None (`0` open incidents)**.

## Pre-Release Defects Caught & Retired During CQM2 Engineering

1. **INC-2026-11-10-A — Root Static File Exposure During Early Milestone 4 Smoke Test**:
   - **Detection**: Automated smoke probe (`GET /package.json` and `GET /%2e%2e/package.json`) revealed static fallback behavior before `site/` existed.
   - **Fix**: Moved all web entrypoints cleanly into `public/`, restricted static serving in `src/server/main.ts` strictly to `site/` + `public/` regular files (`statSync(candidate).isFile()`), and added percent-decoded `%2e` / `..` / `\` `403 Forbidden` guards.
   - **Regression Test**: Locked permanently in `scripts/smoke.ts` and `tests/exporters-security-server.test.ts`.

2. **INC-2026-11-10-B — First-Order Energy Inflation on High-Noise `HOT-3` Wagering**:
   - **Detection**: Initial R21 `HOT3_metacognitiveWagering` benchmark yielded `Cohen's d = 0.57` (below the `0.80` Grade-A bar) because single-channel Gaussian noise spikes inflated raw energy.
   - **Fix**: Upgraded `AnteriorCingulateHOT` in `src/brains/asmodenius.ts` to compute multi-channel signed coherence + CalibHead calibration (`Cohen's d > 1.66`, `Welch's t > 5.76`).

3. **INC-2026-11-10-C — Synthetic Matrix Demo Buffers in `v2.0.0` Hardware Dispatch & Destructive TMS Assay**:
   - **Detection**: Exhaustive post-`v2.0.0` line-by-line audit identified synthetic `.fill()` benchmark inputs in `TriEngineOrchestrator.stepHeterogeneousTick`, destructive in-place cortex mutation during `runTmsPokeTest()`, and non-manifold open tube ends in glTF export.
   - **Fix (`v2.1.0`)**: Replaced all synthetic buffers with real per-organism `cublasSgemmStridedBatched_v2` VRAM cortex dispatch, action-conditioned NPU RSSM rollouts, and iGPU 2D Gray-Scott diffusion; cloned full CNS state inside `runTmsPokeTest(mode)`; and added hemisphere pole caps (`0` open boundary edges, `Euler V - E + F = 2`) in `exportCreatureGlbBinary()`.
