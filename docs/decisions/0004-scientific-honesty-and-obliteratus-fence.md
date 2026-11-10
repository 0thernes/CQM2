# ADR 0004 — Scientific Honesty Contract (`NOT_SENTIENT`), 27-Repo IP Fence & Fenced Local AI

- **Status**: Accepted (`2026-11-10`, updated for `v2.1.0`)
- **Context**: Complex neurocomputational indicators (`Casali PCI`, `HOT-3`, `Xylos-14`, `Thaler-9`, `Kuramoto R`) risk anthropomorphic misinterpretation, local generative AI narrators face prompt-injection/hallucination hazards, and the 27-repo Tsotchke mirror includes uncensored (`OBLITERATUS`, `AGPL-3.0`), copyleft (`quantum-quake`, `GPL-3.0`), proprietary (`SolanaQuantumFlux`), unlicensed, and out-of-scope LLM repositories.
- **Decision**:
  1. Wrap all consciousness, metacognition, reality-monitoring, creativity, and synchronization proxies in `ComputationalIndicatorContract<T>` carrying literal `sentienceClaim: 'NOT_SENTIENT'` and `indicatorOnly: true`, surfaced prominently in the UI masthead.
  2. Enforce a non-bypassable runtime and lint-enforced IP/safety quarantine (`fencedQuarantine: true`, `enabled: false`) in `src/tsotchke/corpus.ts` across `OBLITERATUS` and all 8 copyleft/proprietary/unlicensed/LLM repositories (`18` permissive math/geometry/code pillars active, `9` permanently fenced).
  3. Isolate optional scholarly narration in `src/pipeline/free-ai-studio.ts` behind strict loopback-only (`127.0.0.1:11434`) SSRF validation, PII redaction, prompt-injection neutralization, `<2,048` token budgeting, HTML sanitization, and deterministic extractive fallback.
- **Rejected Alternatives**:
  1. *Importing Code or Weights from `OBLITERATUS` or Copyleft/Unlicensed Repos*: Rejected unconditionally due to AGPL/GPL license incompatibility with the Cosmogonic Non-Commercial License and safety policy against uncensored weight abliteration.
  2. *Allowing Arbitrary User Endpoint URLs in AI Narrator*: Rejected to eliminate Server-Side Request Forgery (`SSRF`) and accidental telemetry leakage to third-party cloud endpoints.
- **Consequences**: Full scientific transparency, clean intellectual-property provenance across all 27 Tsotchke repositories, and `24/24` pass rate on the AI prompt-injection/safety evaluation suite.
