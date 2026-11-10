#!/usr/bin/env python3
"""
CQM2 v2.1.0 Persistent Intel(R) AI Boost NPU & Intel(R) Graphics iGPU Neural Worker.
Executes THREE compiled OpenVINO neural & PDE graphs on physical NPU + iGPU silicon:
  1. ActionConditionedRSSM (`NPU` — Intel AI Boost): [B, 64] = [latent48 | action16] -> [B, 64] predicted next state + uncertainty
  2. GlitchlingSensoryAlign (`GPU.0` — Intel Graphics iGPU): [B, 16] -> 64 -> 16 associative sensory head
  3. HabitatFieldDiffusion2D (`GPU.0` — Intel Graphics iGPU): [1, 2, 32, 32] Gray-Scott + pheromone reaction-diffusion convolution!
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from typing import Any


def build_rssm_model(ov: Any, np: Any, batch: int = 32) -> Any:
    rng = np.random.default_rng(20261110)
    # Input [batch, 64]: columns 0..47 = recurrent latent state, columns 48..63 = candidate motor/policy action!
    inp = ov.opset13.parameter([batch, 64], np.float32, name="state_action_in")

    w1 = ov.opset13.convert(
        ov.opset13.constant((rng.standard_normal((64, 256)) * 0.12).astype(np.float16)),
        np.float32,
    )
    b1 = ov.opset13.constant(np.zeros((1, 256), dtype=np.float32))
    h1 = ov.opset13.tanh(ov.opset13.add(ov.opset13.matmul(inp, w1, False, False), b1))

    w2 = ov.opset13.convert(
        ov.opset13.constant((rng.standard_normal((256, 128)) * 0.088).astype(np.float16)),
        np.float32,
    )
    h2 = ov.opset13.tanh(ov.opset13.matmul(h1, w2, False, False))

    w3 = ov.opset13.convert(
        ov.opset13.constant((rng.standard_normal((128, 64)) * 0.11).astype(np.float16)),
        np.float32,
    )
    delta = ov.opset13.tanh(ov.opset13.matmul(h2, w3, False, False))
    c_keep = ov.opset13.constant(np.array([[0.82]], dtype=np.float32))
    c_step = ov.opset13.constant(np.array([[0.38]], dtype=np.float32))
    out = ov.opset13.tanh(
        ov.opset13.add(ov.opset13.multiply(inp, c_keep), ov.opset13.multiply(delta, c_step))
    )
    return ov.Model([out], [inp], "cqm2_npu_action_rssm")


def build_sensory_model(ov: Any, np: Any, batch: int = 32) -> Any:
    rng = np.random.default_rng(20261111)
    inp = ov.opset13.parameter([batch, 16], np.float32, name="sense_in")
    w1 = ov.opset13.convert(
        ov.opset13.constant((rng.standard_normal((16, 64)) * 0.22).astype(np.float16)),
        np.float32,
    )
    h1 = ov.opset13.tanh(ov.opset13.matmul(inp, w1, False, False))
    w2 = ov.opset13.convert(
        ov.opset13.constant((rng.standard_normal((64, 16)) * 0.16).astype(np.float16)),
        np.float32,
    )
    out = ov.opset13.tanh(ov.opset13.matmul(h1, w2, False, False))
    return ov.Model([out], [inp], "cqm2_igpu_sensory_align")


def build_field_diffusion_model(ov: Any, np: Any, grid: int = 32) -> Any:
    # 2-channel [1, 2, grid, grid] Gray-Scott + Pheromone Laplacian diffusion executed directly on Intel Graphics iGPU (`GPU.0`)!
    inp = ov.opset13.parameter([1, 2, grid, grid], np.float32, name="field_uv")
    lap_k = np.zeros((2, 2, 3, 3), dtype=np.float32)
    stencil = np.array([[0.05, 0.20, 0.05], [0.20, -1.0, 0.20], [0.05, 0.20, 0.05]], dtype=np.float32)
    lap_k[0, 0] = stencil * 0.16
    lap_k[1, 1] = stencil * 0.08
    filt = ov.opset13.constant(lap_k)
    conv = ov.opset13.convolution(inp, filt, [1, 1], [1, 1], [1, 1], [1, 1], "EXPLICIT")
    out = ov.opset13.clamp(ov.opset13.add(inp, conv), 0.0, 1.0)
    return ov.Model([out], [inp], "cqm2_igpu_field_diffusion_2d")


def init_engine() -> dict[str, Any]:
    import numpy as np
    import openvino as ov

    core = ov.Core()
    devices = list(core.available_devices)
    dev_names: dict[str, str] = {}
    for d in devices:
        try:
            dev_names[d] = str(core.get_property(d, "FULL_DEVICE_NAME"))
        except Exception:
            dev_names[d] = d

    primary_target = "NPU" if "NPU" in devices else ("GPU.0" if "GPU.0" in devices else "CPU")
    aux_target = "GPU.0" if "GPU.0" in devices else primary_target

    rssm_compiled = core.compile_model(build_rssm_model(ov, np, 32), primary_target)
    sens_compiled = core.compile_model(build_sensory_model(ov, np, 32), aux_target)
    field_compiled = core.compile_model(build_field_diffusion_model(ov, np, 32), aux_target)

    dummy_rssm = np.zeros((32, 64), dtype=np.float32)
    dummy_sens = np.zeros((32, 16), dtype=np.float32)
    dummy_field = np.full((1, 2, 32, 32), 0.5, dtype=np.float32)
    _ = rssm_compiled([dummy_rssm])[0]
    _ = sens_compiled([dummy_sens])[0]
    _ = field_compiled([dummy_field])[0]

    t0 = time.perf_counter()
    for _ in range(20):
        _ = rssm_compiled([dummy_rssm])[0]
    npu_ms = (time.perf_counter() - t0) / 20.0 * 1000.0

    t1 = time.perf_counter()
    for _ in range(20):
        _ = field_compiled([dummy_field])[0]
    aux_ms = (time.perf_counter() - t1) / 20.0 * 1000.0

    return {
        "np": np,
        "devices": devices,
        "deviceNames": dev_names,
        "primaryDevice": primary_target,
        "primaryDeviceName": dev_names.get(primary_target, primary_target),
        "auxDevice": aux_target,
        "auxDeviceName": dev_names.get(aux_target, aux_target),
        "rssm": rssm_compiled,
        "sens": sens_compiled,
        "field": field_compiled,
        "calibratedNpuMs": round(npu_ms, 4),
        "calibratedAuxMs": round(aux_ms, 4),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe", action="store_true")
    parser.add_argument("--daemon", action="store_true")
    args = parser.parse_args()

    try:
        eng = init_engine()
    except Exception as exc:
        err_payload = {"ok": False, "error": str(exc), "primaryDevice": "NONE"}
        print(json.dumps(err_payload), flush=True)
        return

    status_payload = {
        "ok": True,
        "devices": eng["devices"],
        "deviceNames": eng["deviceNames"],
        "primaryDevice": eng["primaryDevice"],
        "primaryDeviceName": eng["primaryDeviceName"],
        "auxDevice": eng["auxDevice"],
        "auxDeviceName": eng["auxDeviceName"],
        "calibratedNpuMs": eng["calibratedNpuMs"],
        "calibratedAuxMs": eng["calibratedAuxMs"],
    }

    if args.probe or not args.daemon:
        print(json.dumps(status_payload), flush=True)
        return

    print(json.dumps({"event": "ready", **status_payload}), flush=True)
    np = eng["np"]
    rssm = eng["rssm"]
    sens = eng["sens"]
    field = eng["field"]

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            cmd = req.get("cmd", "ping")
            req_id = req.get("id", 0)
            if cmd == "quit":
                print(json.dumps({"id": req_id, "ok": True, "bye": True}), flush=True)
                break
            elif cmd == "rssm":
                arr = np.asarray(req["data"], dtype=np.float32).reshape(32, 64)
                t0 = time.perf_counter()
                out = rssm([arr])[0]
                dt_ms = (time.perf_counter() - t0) * 1000.0
                # Compute per-branch value & epistemic variance across rows 0..7 for multi-horizon EFE planning!
                row_means = [round(float(np.mean(out[r, :16])), 5) for r in range(8)]
                epistemic_var = round(float(np.var(out[:8, :16])), 6)
                print(
                    json.dumps(
                        {
                            "id": req_id,
                            "ok": True,
                            "device": eng["primaryDevice"],
                            "ms": round(dt_ms, 4),
                            "meanAbs": round(float(np.mean(np.abs(out))), 6),
                            "epistemicVar": epistemic_var,
                            "branchScores": row_means,
                            "head": [round(float(x), 5) for x in out[0, :16]],
                        }
                    ),
                    flush=True,
                )
            elif cmd == "sensory":
                arr = np.asarray(req["data"], dtype=np.float32).reshape(32, 16)
                t0 = time.perf_counter()
                out = sens([arr])[0]
                dt_ms = (time.perf_counter() - t0) * 1000.0
                print(
                    json.dumps(
                        {
                            "id": req_id,
                            "ok": True,
                            "device": eng["auxDevice"],
                            "ms": round(dt_ms, 4),
                            "aligned0": [round(float(x), 5) for x in out[0, :16]],
                        }
                    ),
                    flush=True,
                )
            elif cmd == "field2d":
                arr = np.asarray(req["data"], dtype=np.float32).reshape(1, 2, 32, 32)
                feed = float(req.get("feed", 0.036))
                kill = float(req.get("kill", 0.061))
                t0 = time.perf_counter()
                diff = field([arr])[0]
                u = diff[0, 0]
                v = diff[0, 1]
                uvv = u * v * v
                u_next = np.clip(u - uvv + feed * (1.0 - u), 0.0, 1.0)
                v_next = np.clip(v + uvv - (feed + kill) * v, 0.0, 1.0)
                stacked = np.stack([u_next, v_next], axis=0)
                dt_ms = (time.perf_counter() - t0) * 1000.0
                print(
                    json.dumps(
                        {
                            "id": req_id,
                            "ok": True,
                            "device": eng["auxDevice"],
                            "ms": round(dt_ms, 4),
                            "meanV": round(float(np.mean(v_next)), 6),
                            "data": [round(float(x), 5) for x in stacked.reshape(-1)],
                        }
                    ),
                    flush=True,
                )
            else:
                print(json.dumps({"id": req_id, "ok": True, **status_payload}), flush=True)
        except Exception as exc:
            print(json.dumps({"ok": False, "error": str(exc)}), flush=True)


if __name__ == "__main__":
    main()
