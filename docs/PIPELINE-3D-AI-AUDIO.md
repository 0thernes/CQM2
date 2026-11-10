# 3D DCC, Watertight `.glb`, Audio, OSC & Fenced Local AI Studio Pipeline

CQM2 (`v2.1.0`) provides deterministic, zero-cloud-lock-in exporters in `src/pipeline/exporters.ts`, `src/pipeline/free-ai-studio.ts`, and `python/asset_pipeline.py`:

## 1. Watertight 3D Geometry, Image & DCC Engine Exporters

- **Binary Khronos glTF 2.0 (`.glb`) & JSON (`.gltf`)**: `exportCreatureGlbBinary()` and `exportCreatureGltf2Json()` generate a **100% closed watertight 2-manifold Bishop-frame mesh** (`0` open boundary edges, hemisphere end-caps, verified `Euler V - E + F = 2`, magic `0x46546C67`) with PBR Metallic-Roughness + guanine thin-film sheen (`IOR = 1.83`). Users can also load custom `.glb` assets back into the live 4K viewport.
- **Standalone 4K/HD Chromatic Snapshot (`.png`)**: `exportChromatophoreSnapshotPng()` writes a spec-valid RFC 2083 RGBA PNG (`IHDR` + zlib `IDAT` + CRC32 `IEND`) directly from the live Gray-Scott chromatophore Turing skin lattice.
- **Wavefront OBJ (`.obj`), Blender 4.x (`.py`), Unity 6 (`C#`), & TouchDesigner (`Script SOP`)**: One-click generation of articulated `SomiteBone_00..07` Blender rigs, Unity 6 `MonoBehaviour` UDP OSC receivers, and TouchDesigner `onCook(scriptOp)` Python scripts.

## 2. 9-Song Procedural Audio Engine (`.wav` + Live Web Audio FFT)

- `exportCosmicKerrRingdownWav()` synthesizes stereo 16-bit 44.1 kHz RIFF WAVE stems combining cosmic drones with Leaver's Kerr $l=m=2$ quasi-normal mode (`M*omega = 0.373672 - 0.088962i`) ringdown.
- `src/render/audio-synth.ts` features **9 dark-endgame procedural compositions**, Glossodrom `GF(16)` arpeggiation, Kerr QNM chime triggers, volume controls, and a real-time 32-bin `AnalyserNode` FFT visualizer.

## 3. Continuous 20 Hz Go OSC Stream & Fenced Local AI Narrator

- **Go 1.26 Telemetry & OSC Bridge (`native/bin/cqm2-telemetry-bridge.exe`)**: Continuously broadcasts 20 Hz binary **OSC 1.0** UDP packets (`/cqm2/heartbeat`, `/cqm2/gpu_util`, `/cqm2/vram_used_mb`) to `127.0.0.1:9000` while maintaining a background GPU cache file (`--serve-osc`).
- **Fenced Local AI Narrator (`src/pipeline/free-ai-studio.ts`)**: Optional loopback-only (`http://127.0.0.1:11434`, `llama3.2:3b`) scholarly telemetry narrator guarded by SSRF loopback enforcement, PII redaction, prompt-injection stripping, `<2,048` token budgeting, HTML output sanitization, deterministic extractive fallback, and a 24-case adversarial evaluation suite (`runAiSafetyAndQualityEvalSuite`).
