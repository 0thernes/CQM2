# AGENTS.md — CQM2 Engineering, Determinism & Scientific Honesty Contract

This document defines the mandatory architectural, numerical, security, and governance laws for any AI coding agent or human operator working on **Cosmogonic Quantum Mechalogodrom 2 (`CQM2`)**.

## 1. Scientific Honesty & Anti-Hype Law (`NOT SENTIENT / indicatorOnly`)
- **Zero Phenomenal Sentience Claims**: Every cognitive indicator in CQM2 (Global Workspace ignition, Casali Perturbational Complexity Index `PCI`, Higher-Order Thought `HOT` confidence, Mehra Attention Schema `AST`, Integrated Information surrogate $\Phi$, Thought Curvature $\kappa$, Simulation Insight `P_SIM`, and Asmodenius/Glitchling neuroplasticity) is strictly a **deterministic computational proxy (`indicatorOnly: true`)** and never evidence of phenomenal consciousness or subjective feeling.
- **Nothing Cosmetic**: Every rendered visual surface (FitzHugh-Nagumo chromatophores, Gray-Scott Turing skin, Guanine thin-film interference, Schwarzschild/Kerr photon rings, Glossodrom 4D Zooids, Intended vs. Executed trajectory splits) must read directly from upstream mathematical, physiological, or neural state.
- **Fenced Repositories**: Never import or adapt LLM weight-abliteration code (e.g., `OBLITERATUS` remains strictly fenced per CQM governance law).

## 2. Numerical Determinism & First-Law Conservation
- **Seeded PRNG Isolation**: Never call `Math.random()` or `Date.now()` inside deterministic simulation ticks. Use isolated `SplitMix64` / `Mulberry32` substreams (`world`, `genome`, `flaw`, `quantum`, `ecology`, `ui`) so UI inspection or adversarial Glitchling flaw toggles never perturb unrelated substreams.
- **First-Law Metabolic Ledger**: `MetabolicLedger` must conserve energy in kilojoules (`sum(15 pools) + heat_dissipated + excreted == total_intake_kj`) to `< 1e-12` relative error at every tick.
- **Quantum Statevector & Hoggar Invariants**: All unitary evolutions and QGTL Fubini-Study / Berry curvature evaluations must preserve state norm `|⟨ψ|ψ⟩ - 1| < 1e-12` and satisfy the exact Hoggar spectral floor.

## 3. Clean Polyglot Architecture & Root Hygiene
- **Zero Monoliths**: Keep domain logic (`src/erp/`, `src/brains/`, `src/quantum/`, `src/tsotchke/`) 100% pure and testable without DOM or WebGL globals. Keep functions focused and modular.
- **Root Cleanliness (`GITHUB-REPO-STANDARD.md`)**: Do not drop scratch scripts, `.log` files, build binaries, or loose Markdown notes in the repository root. Community health files live in `.github/`, documentation lives in `docs/` (and every file in `docs/` must be listed in `docs/INDEX.md`).
- **Secrets & Safety**: Never commit `.env` files, API keys, tokens, or personal data. Never bypass pre-push or CI verification gates.

## 4. Verification Gate Before Commit & Push
Always commit locally and push to `origin/main` only after verifying:
```bash
bun run check
node scripts/repo-check.mjs .
```
