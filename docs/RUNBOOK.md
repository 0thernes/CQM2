# Operational Runbook — CQM2 Local Workstation & Static Pages

Right-sized for a 1-person research studio (**0thernes LLC**) — zero Kubernetes, zero external cloud database dependencies, single-command verification and recovery.

## 1. Daily Local Operations

```bash
# Install exact locked dependencies
bun install --frozen-lockfile

# Run full verification gate (Typecheck + Lint + Tests + Build + Pages)
bun run check

# Launch Local Tri-Engine Workstation Server on http://127.0.0.1:4200
bun run start
```

## 2. Rebuilding Polyglot Native Accelerators (Optional)

Pre-embedded `cqm2_zig.wasm` ships inside `src/native/zig-wasm-embedded.ts` so `bun run start` works immediately on any OS. To recompile all native DLLs/binaries on a Windows CUDA/Zig/Rust/Go workstation:

```bash
bun run build:native
```

## 3. Environment Configuration Knobs

| Variable | Default | Purpose |
|---|---|---|
| `CQM2_HOST` | `127.0.0.1` | Bind address for `Bun.serve` (loopback-only by default for local safety) |
| `CQM2_PORT` | `4200` | HTTP + WebSocket port |
| `CQM2_DISABLE_NPU` | `0` | Set to `1` to skip spawning the OpenVINO `Intel(R) AI Boost` Python worker |
| `CQM2_CUDA_BIN` | `Z:\Tools\cuda-12.9-redist\bin` | Directory searched for `cublas64_12.dll` / `cudart64_12.dll` on Windows |

## 4. SQLite WAL Checkpoint Backup & Recovery

- Database location: `data/cqm2_local.sqlite` (`WAL` mode).
- Safe online backup: Trigger `POST /api/world/checkpoint` (or click **Capture Reversible Checkpoint** in Workspace 5), then copy `data/cqm2_local.sqlite`.
- Corrupted local DB recovery: Stop `bun run start`, remove `data/cqm2_local.sqlite*`, and restart; `Cqm2SqliteDatabase` cleanly recreates the 3NF schema from seed.
