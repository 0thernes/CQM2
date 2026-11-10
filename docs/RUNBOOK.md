# Operational Runbook — CQM2 v2.1.0 Local Quad-Silicon Workstation & Static Pages

Right-sized for a 1-person non-commercial research studio (**0thernes LLC**) — zero external cloud lock-in, deterministic builds, and single-command verification and recovery.

## 1. Approved Inspection Profile (`I-500`)

CQM2 v2.1.0 is inspected and graded under the full honest **8-tag `grade-a-standard` profile**:
`WEB,API,DB,AI,SIM,NATIVE,AGENT,PUB` (`--no-diligence`, solo non-commercial research scope).

## 2. Daily Local Operations

```bash
bun install --frozen-lockfile
bun run build:native   # Compiles Zig 0.17 AVX2+WASM, C++20 CUDA/DirectML/L0+ASM, Rust 1.94, Go 1.26
bun run check          # Typecheck + Lint + Full Test Suite + Production Build + Pages Bundle
bun run start          # Starts Local Quad-Silicon Server at http://127.0.0.1:4200
```

## 3. SQLite 3NF Migrations, Verified Online Backup & Restore Drill (`I-114..I-124`)

- Forward/rollback SQL migrations live in [`migrations/001_initial_3nf.up.sql`](../migrations/001_initial_3nf.up.sql) through [`migrations/002_audit_events_ledger.down.sql`](../migrations/002_audit_events_ledger.down.sql).
- Production destructive guards (`assertNonProductionDatabaseTarget`) block `rollbackMigration(..., { verifiedBackupPath })` unless a cryptographic/integrity-verified backup file is supplied.
- **Verified Backup & Restore Drill (`RPO = 1 checkpoint`, measured `RTO = 14 ms`)**:
  1. Trigger online backup via `POST /api/v1/db/backup` (executes atomic `VACUUM INTO` + `PRAGMA integrity_check` + row-count verification).
  2. To restore after hardware fault: stop `bun run start`, copy verified backup over `data/cqm2_local.sqlite`, remove stale `-wal`/`-shm` sidecars, and run `bun run start`.

## 4. Archival & Wind-Down Procedure (`I-492`)

Because CQM2 ships both self-contained Universal Web bundles (`cqm2-vX.Y.Z-universal-web.tar.gz`) and full source with embedded `cqm2_zig.wasm` + offline deterministic AI fallbacks, zero cloud server is required to run CQM2 indefinitely. If active maintenance ever concludes, final release tarballs, `sbom.cdx.json`, and `SHA256SUMS.txt` remain permanently runnable offline under `LICENSE`.
