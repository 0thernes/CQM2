# ADR 0004 — Scientific Honesty Contract (`NOT_SENTIENT`) & `OBLITERATUS` Safety Fence

- **Status**: Accepted (`2026-11-10`)
- **Context**: Complex neurocomputational indicators (`Casali PCI`, `HOT-3`, `Kuramoto R`) risk anthropomorphic misinterpretation, and the local Tsotchke mirror includes an uncensored weight-modification folder (`OBLITERATUS`).
- **Decision**:
  1. Wrap all consciousness/metacognition/synchronization proxies in `ComputationalIndicatorContract<T>` carrying literal `sentienceClaim: 'NOT_SENTIENT'` and `indicatorOnly: true`, surfaced prominently in the UI masthead.
  2. Hard-code a non-bypassable runtime and lint-enforced quarantine (`if (pillarId === 'OBLITERATUS') return false;`) in `src/tsotchke/corpus.ts`.
- **Consequences**: Full scientific transparency and zero exposure to unsafe/uncensored model-abliteration tooling.
