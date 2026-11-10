# Security Policy

## Supported Versions

Only the latest major/minor release line of **CQM2** on `main` receives security updates:

| Version | Supported |
| --- | --- |
| `2.0.x` | Supported |
| `< 2.0.0` (legacy CQM v0.x) | Maintained separately in `0thernes/cosmogonic-quantum-mechalogodrom` |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, report privately via one of two channels:
1. **GitHub Private Vulnerability Reporting** (preferred): Open the **Security** tab on `https://github.com/0thernes/CQM2/security/advisories/new` and submit a private advisory.
2. **Direct Email**: Send details to `0_0@0thernes.art` with subject `[SECURITY] CQM2: <concise summary>`. Include reproduction steps, affected component (`src/server/`, `src/ui/`, `native/`, `zig/`, etc.), and potential impact.

### Response Targets
Because `0thernes LLC` operates as a lean independent research studio, the timelines below are **good-faith operational targets** (not legally binding SLAs):
- **Initial acknowledgment**: Target within **72 hours**
- **Triage & severity assessment**: Target within **7 days**
- **Remediation & coordinated disclosure**: Target within **14 days** for critical/high issues, **30 days** for medium/low issues

## Safe Harbor

Good-faith security research conducted locally against your own checkout or static bundle — without accessing other users' data, degrading GitHub infrastructure, or violating laws — is authorized and appreciated.

## Security Architecture Highlights

- **Local-Loopback Binding by Default**: `bun run start` binds strictly to `127.0.0.1` (`CQM2_HOST=127.0.0.1`) so local native FFI/GPU/NPU endpoints are never exposed to LAN/WAN unless explicitly overridden.
- **Hardened HTTP Headers**: Serves strict `Content-Security-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Permissions-Policy`.
- **Zero Untrusted `eval` / SQL Injection**: All `bun:sqlite` queries use parameterized prepared statements; all boundary JSON payloads undergo strict schema/bounds validation; path traversal on static/export routes is canonicalized and blocked.
- **Supply-Chain Pinning**: Minimal runtime dependency surface (`three@0.185.1`), frozen `bun.lock`, 40-char commit-SHA-pinned GitHub Actions with `permissions: contents: read`, and automated CodeQL static analysis.
