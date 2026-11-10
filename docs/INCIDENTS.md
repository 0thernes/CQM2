# Incident Log & Legacy Defect Retirement Ledger

## Active Production Incidents (`v2.0.0`)

- **None (`0` open incidents)**.

## Pre-Release Defects Caught & Resolved During CQM2 Engineering

1. **INC-2026-11-10-A — Root Static File Exposure During Early Milestone 4 Smoke Test**:
   - **Detection**: Automated smoke probe (`GET /package.json` and `GET /%2e%2e/package.json`) revealed `src/server/main.ts` fell back to `ROOT_DIR` before `site/` existed.
   - **Fix**: Restricted static serving in `src/server/main.ts` strictly to `site/` plus an explicit 6-file public HTML/icon allowlist (`index.html`, `docs.html`, `specs.html`, `glossary.html`, `downloads.html`, `favicon.svg`) and added percent-decoded `%2e` / `..` / `\` `403 Forbidden` guards.
   - **Regression Test**: Locked permanently in `scripts/smoke.ts` and `tests/security-server.test.ts`.

2. **INC-2026-11-10-B — First-Order Energy Inflation on High-Noise `HOT-3` Wagering**:
   - **Detection**: Initial R21 `HOT3_metacognitiveWagering` benchmark yielded `Cohen's d = 0.57` (below the `0.80` Grade-A bar) because single-channel Gaussian noise spikes inflated raw energy.
   - **Fix**: Upgraded `AnteriorCingulateHOT` in `src/brains/asmodenius.ts` to compute multi-channel signed coherence $|\sum_k s_k| / \sum_k |s_k|$ vs. thalamic dispersion (`Cohen's d = 1.66`, `Welch's t = 5.76`).
