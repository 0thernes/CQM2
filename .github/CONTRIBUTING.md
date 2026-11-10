# Contributing to CQM2

Thank you for exploring **Cosmogonic Quantum Mechalogodrom 2 (`CQM2`)**!

## Solo-Maintained Non-Commercial Research Mode

`CQM2` is authored and maintained by **0thernes LLC** (`0_0@0thernes.art`) as a coherent, deterministic research workstation under the **Cosmogonic License — Non-Commercial Research & Play** (`LICENSE`).

- **External Pull Requests**: To preserve strict intellectual property provenance, deterministic seed reproducibility, and single-maintainer architectural coherence, **unsolicited external pull requests are not merged directly**.
- **Bug Reports & Scientific Issues (Welcome!)**: Reproducible bug reports, numerical edge cases, conservation drift reports, hardware compatibility notes, and benchmark findings are warmly welcomed via [GitHub Issues](https://github.com/0thernes/CQM2/issues) using our structured templates.
- **Security Vulnerabilities**: Never file security issues publicly. Follow [.github/SECURITY.md](SECURITY.md).
- **Forks & Personal Modifications**: Under Section 1 of [LICENSE](../LICENSE), you are welcome to clone, run, study, modify, and share non-commercial forks with full attribution to `0thernes`.

## Local Development & Verification Workflow

### Prerequisites
- **Bun** `>= 1.3.0` and **Node.js** `>= 24.0.0`
- Optional local native accelerators (automatically detected by `bun run build:native`):
  - **Zig** `0.17.0` (`zig/`)
  - **LLVM Clang++** `>= 20` + Windows SDK / CUDA 12.x (`native/gpu_cuda/`)
  - **Rust** `>= 1.90` (`rust/`)
  - **Go** `>= 1.24` (`go/`)
  - **uv** + Python `>= 3.12` (`python/` for OpenVINO Intel AI Boost NPU worker)

### Commands
```bash
bun install --frozen-lockfile
bun run build:zig       # Rebuild portable Zig SIMD128 WASM + native DLL (if Zig installed)
bun run build:native    # Rebuild C++/CUDA/ASM, Rust, and Go native accelerators
bun run check           # Typecheck + lint + full test suite + bundle + static Pages build
node scripts/repo-check.mjs .
```

### Commit Convention
All commits follow **Conventional Commits** (`feat:`, `fix:`, `perf:`, `test:`, `docs:`, `chore:`) and must pass `bun run check` with zero warnings and zero broken links.
