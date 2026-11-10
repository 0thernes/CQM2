# ADR 0002 — Normalized 10-Entity SoA ERP & 3NF SQLite WAL Persistence

- **Status**: Accepted (`2026-11-10`)
- **Context**: Heap-allocated per-organism JS objects and Three.js meshes in CQM v1 caused severe garbage-collection pauses and lacked relational foreign-key guarantees.
- **Decision**: Model all world state as **10 normalized 3NF entities** stored in contiguous `SharedArrayBuffer` Structure-of-Arrays (`SoA`) columns (`src/erp/relational-store.ts`) paired with an ACID `bun:sqlite` `WAL` database (`src/server/db.ts`) enforcing `PRAGMA foreign_keys = ON` and reversible `N01` snapshot ring buffers.
- **Consequences**: Zero-GC pointer handoff to Zig/CUDA/Rust/WebGPU/InstancedMesh and provable relational integrity.
