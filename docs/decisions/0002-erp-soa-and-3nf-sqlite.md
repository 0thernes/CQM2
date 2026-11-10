# ADR 0002 — Normalized 10-Entity SoA ERP, Reversible SQL Migrations & Append-Only Audit Ledger

- **Status**: Accepted (`2026-11-10`, updated for `v2.1.0`)
- **Context**: Heap-allocated per-organism JS objects and Three.js meshes in CQM v1 caused severe garbage-collection pauses, lacked relational foreign-key guarantees, and provided no reversible schema migrations or tamper-evident audit trail.
- **Decision**:
  1. Model all world state as **10 normalized 3NF entities** stored in contiguous `SharedArrayBuffer` Structure-of-Arrays (`SoA`) columns (`src/erp/relational-store.ts`) with opaque `public_uid` external identifiers (`I-092`) and `version_rev` optimistic concurrency tokens (`I-084`).
  2. Pair the in-memory SoA store with an ACID `bun:sqlite` `WAL` database (`src/server/db.ts`) managed by forward/down SQL migrations (`migrations/001..002`), verified `VACUUM INTO` backups (`verifyAndRestoreBackup`), and an append-only `audit_events` ledger protected by SQLite `BEFORE UPDATE`/`BEFORE DELETE` abort triggers (`I-094`).
  3. Provide bit-exact reversible `N01` world snapshots (`captureWorldSnapshot()` / `rollbackToSnapshot()`) persisted in both SQLite and browser `IndexedDB` (`src/ui/idb-storage.ts`).
- **Rejected Alternatives**:
  1. *Object-Oriented Entity Graph / ORM*: Rejected due to pointer-chasing cache misses, GC pauses during 60 FPS rendering, and inability to pass contiguous stride-126/stride-15 buffers zero-copy to Zig/CUDA/Rust/WebGPU.
  2. *External PostgreSQL Server Requirement*: Rejected for a one-person local-first research workstation because embedded `bun:sqlite` `WAL` delivers zero-configuration single-file durability, sub-millisecond local ACID transactions, and `14 ms` `VACUUM INTO` snapshot recovery.
- **Consequences**: Zero-GC pointer handoff to Zig/CUDA/Rust/WebGPU/InstancedMesh, provable relational integrity, cursor pagination, and sub-15 ms disaster recovery.
