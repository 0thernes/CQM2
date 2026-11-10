# 3D DCC, Procedural Audio, OSC & Free/Local AI World-Model Pipeline

CQM2 provides deterministic, zero-cloud-lock-in exporters in `src/pipeline/exporters.ts` and `python/asset_pipeline.py`:

## 1. 3D Geometry & Material Exporters

- **Khronos glTF 2.0 (`.gltf`)**: `exportCreatureGltf2Json()` emits a spec-valid glTF 2.0 asset with embedded base64 `POSITION`, `NORMAL`, `TEXCOORD_0`, and `SCALAR` index buffers plus PBR Metallic-Roughness + emissive guanine sheen (`IOR = 1.83`). Imports directly into Blender 4.x, Unity, Unreal Engine 5, Godot, and Three.js.
- **Wavefront OBJ (`.obj`)**: `exportCreatureWavefrontObj()` emits clean manifold `v / vt / vn / f` ASCII topology.
- **Blender 4.x Python PBR Rig (`.py`)**: `exportBlender4PythonRig()` generates a standalone `bpy` script creating an articulated `Armature` (`SomiteBone_00..07`), parented somite meshes, and a Principled BSDF Coat (`IOR = 1.83`) material.

## 2. Procedural Relativistic & Cosmic Audio (`.wav` + Web Audio)

- `exportCosmicKerrRingdownWav()` synthesizes stereo 16-bit 44.1 kHz RIFF WAVE stems combining an A1/E2 cosmic drone with Leaver's fundamental Schwarzschild/Kerr $l=m=2$ quasi-normal mode (`M*omega = 0.373672 - 0.088962i`) damped ringdown envelope.
- `src/render/audio-synth.ts` synthesizes live interactive Web Audio modulated by the 5-Caste Kuramoto order parameter $R$ and Kerr spin $a/M$.

## 3. Real-Time TouchDesigner & Unity OSC Stream + Free/Local AI Interop

- **Go 1.26 Telemetry & OSC Bridge (`native/bin/cqm2-telemetry-bridge.exe`)**: Polls GPU telemetry and broadcasts binary **OSC 1.0** big-endian float UDP packets (`/cqm2/gpu_util`, `/cqm2/vram_used_mb`) to `127.0.0.1:9000` for TouchDesigner `OSC In CHOP` and Unity `OscJack`.
- **Free/Local AI Interop (`cqm2_ai_world_interop.json`)**: Structured descriptors for **Local Ollama (`http://127.0.0.1:11434`, `llama3.2:3b`)**, **Tripo AI**, and **Meshy AI** with zero embedded API keys.
