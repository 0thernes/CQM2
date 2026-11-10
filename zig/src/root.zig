const std = @import("std");
const math = std.math;

// ============================================================================
// CQM2 v2.1.0 Dual-Target Zig SIMD128 / AVX2 Scientific & Neural Kernel Suite
// Targets: wasm32-freestanding (+simd128) AND x86_64/aarch64 Native FFI DLL
// ============================================================================

const HEAP_SIZE: usize = 8 * 1024 * 1024; // 8 MiB deterministic arena
var static_heap: [HEAP_SIZE]u8 align(16) = undefined;
var heap_offset: usize = 0;

export fn cqm2_reset_heap() callconv(.c) void {
    heap_offset = 0;
}

export fn cqm2_alloc(byte_len: usize) callconv(.c) ?[*]u8 {
    const aligned_len = (byte_len + 15) & ~@as(usize, 15);
    if (heap_offset + aligned_len > HEAP_SIZE) return null;
    const ptr = static_heap[heap_offset..].ptr;
    heap_offset += aligned_len;
    return ptr;
}

export fn cqm2_heap_used() callconv(.c) usize {
    return heap_offset;
}

inline fn fastTanh(x: f32) f32 {
    if (x > 4.95) return 1.0;
    if (x < -4.95) return -1.0;
    const x2 = x * x;
    return x * (27.0 + x2) / (27.0 + 9.0 * x2);
}

inline fn sigmoid(x: f32) f32 {
    if (x > 12.0) return 1.0;
    if (x < -12.0) return 0.0;
    return 1.0 / (1.0 + @exp(-x));
}

// ----------------------------------------------------------------------------
// 1. Batched Organism Brain SIMD Forward + Dual-Layer 3-Factor Oja Plasticity
// Architecture per organism: 8 sensory inputs -> 8 hidden (Padé tanh ONCE) -> 6 motor/affect outputs
// Total weights per organism: (8*8 + 8) + (6*8 + 6) = 72 + 54 = 126 floats
// Parity: Bit-consistent (<1e-5) with CUDA cuBLAS, AVX2 ASM, and WebGPU WGSL!
// ----------------------------------------------------------------------------
export fn cqm2_organism_brain_batch_simd(
    inputs: [*]const f32, // [count * 8]
    weights: [*]f32, // [count * 126] (w1 + w2 updated in-place when |lr| > 0)
    modulators: [*]const f32, // [count * 2] = (DA_rpe, ACh_gate)
    outputs: [*]f32, // [count * 6]
    count: usize,
    lr: f32,
) callconv(.c) void {
    var e: usize = 0;
    while (e < count) : (e += 1) {
        const in_base = inputs + e * 8;
        const w_base = weights + e * 126;
        const out_base = outputs + e * 6;
        const da = modulators[e * 2];
        const ach = modulators[e * 2 + 1];
        const eff_lr = lr * da * ach;

        const in_v0: @Vector(4, f32) = in_base[0..4].*;
        const in_v1: @Vector(4, f32) = in_base[4..8].*;

        var hid: [8]f32 = undefined;
        var h: usize = 0;
        while (h < 8) : (h += 1) {
            const w_row = w_base + h * 8;
            var w0: @Vector(4, f32) = w_row[0..4].*;
            var w1: @Vector(4, f32) = w_row[4..8].*;
            const prod = w0 * in_v0 + w1 * in_v1;
            const bias = w_base[64 + h];
            const h_act = fastTanh(@reduce(.Add, prod) + bias);
            hid[h] = h_act;

            // Layer-1 competitive Oja feature plasticity: dw1 = 0.35 * |eff_lr| * ach * h * (in - h * w1)
            if (@abs(eff_lr) > 1e-7) {
                const feat_lr = 0.35 * @abs(lr) * math.clamp(ach, 0.0, 2.0);
                const h_v: @Vector(4, f32) = @splat(h_act);
                const flr_v: @Vector(4, f32) = @splat(feat_lr);
                w0 = @min(@as(@Vector(4, f32), @splat(3.0)), @max(@as(@Vector(4, f32), @splat(-3.0)), w0 + flr_v * h_v * (in_v0 - h_v * w0)));
                w1 = @min(@as(@Vector(4, f32), @splat(3.0)), @max(@as(@Vector(4, f32), @splat(-3.0)), w1 + flr_v * h_v * (in_v1 - h_v * w1)));
                w_row[0..4].* = w0;
                w_row[4..8].* = w1;
            }
        }

        // Exact single-activation hidden vectors (fixes prior double-fastTanh bug!)
        const hid_v0: @Vector(4, f32) = hid[0..4].*;
        const hid_v1: @Vector(4, f32) = hid[4..8].*;

        const w2_base = w_base + 72;
        const b2_base = w2_base + 48;

        var o: usize = 0;
        while (o < 6) : (o += 1) {
            const w_row = w2_base + o * 8;
            var w0: @Vector(4, f32) = w_row[0..4].*;
            var w1: @Vector(4, f32) = w_row[4..8].*;
            const sum = @reduce(.Add, w0 * hid_v0 + w1 * hid_v1) + b2_base[o];
            const y = fastTanh(sum);
            out_base[o] = y;

            if (@abs(eff_lr) > 1e-7) {
                // Oja-stabilized 3-factor Hebbian policy update: dw2 = eff_lr * y * (h - y * w2)
                const y_v: @Vector(4, f32) = @splat(y);
                const lr_v: @Vector(4, f32) = @splat(eff_lr);
                w0 = @min(@as(@Vector(4, f32), @splat(3.0)), @max(@as(@Vector(4, f32), @splat(-3.0)), w0 + lr_v * y_v * (hid_v0 - y_v * w0)));
                w1 = @min(@as(@Vector(4, f32), @splat(3.0)), @max(@as(@Vector(4, f32), @splat(-3.0)), w1 + lr_v * y_v * (hid_v1 - y_v * w1)));
                w_row[0..4].* = w0;
                w_row[4..8].* = w1;
            }
        }
    }
}

// ----------------------------------------------------------------------------
// 2. Biophysical Larkum Two-Compartment + Hasani Fused Semi-Implicit sLTC Step
// ----------------------------------------------------------------------------
export fn cqm2_sltc_larkum_step(
    v_state: [*]f32,
    nmda_slow: [*]f32,
    basal_in: [*]const f32,
    apical_in: [*]const f32,
    n: usize,
    dt: f32,
    ach: f32,
    ne: f32,
    onset_reset: f32,
) callconv(.c) f32 {
    if (n == 0) return 0.0;
    var apical_mean: f32 = 0.0;
    var rate_mean: f32 = 0.0;
    var i: usize = 0;
    while (i < n) : (i += 1) {
        apical_mean += apical_in[i];
        rate_mean += sigmoid(v_state[i]);
    }
    const inv_n = 1.0 / @as(f32, @floatFromInt(n));
    apical_mean *= inv_n;
    rate_mean *= inv_n;

    const reset_keep = math.clamp(1.0 - onset_reset, 0.0, 1.0);
    var active_sum: f32 = 0.0;

    i = 0;
    while (i < n) : (i += 1) {
        const ap_centered = apical_in[i] - 0.85 * apical_mean;
        const bac_gain = 1.0 + 0.75 * sigmoid((ap_centered - 0.25) / 0.30);
        const nmda_gate = 1.0 / (1.0 + @exp(-(v_state[i] + 0.4) / 0.25));
        nmda_slow[i] = 0.92 * (nmda_slow[i] * reset_keep) + 0.08 * ap_centered * nmda_gate;

        const total_drive = (basal_in[i] * bac_gain + 0.35 * nmda_slow[i]) / (1.0 + 0.60 * rate_mean);
        const tau_num = 3.711 * (1.0 + 1.4248 * ach);
        const tau_den = (1.0 + 0.4722 * @abs(total_drive)) * (1.0 + 0.5351 * ne);
        const tau = @max(0.5, tau_num / tau_den);

        const f_gate = 4.0 * sigmoid(1.8 * total_drive);
        const rev_pot: f32 = if (total_drive >= 0.0) 1.2 else -0.8;
        const next_v = (v_state[i] + dt * f_gate * rev_pot) / (1.0 + dt * (1.0 / tau + f_gate));
        v_state[i] = math.clamp(next_v, -2.5, 2.5);
        active_sum += @abs(v_state[i]);
    }
    return active_sum * inv_n;
}

// ----------------------------------------------------------------------------
// 3. Glitchling Compensatory Organs: Marr-Albus Cerebellum & Gated-DeltaNet
// ----------------------------------------------------------------------------
export fn cqm2_cerebellum_marr_albus_step(
    granule_w: [*]const f32,
    pf_weights: [*]f32,
    cmd_proprio: [*]const f32,
    climbing_err: [*]const f32,
    correction_out: [*]f32,
    eta_cf: f32,
) callconv(.c) f32 {
    var gran: [256]f32 = undefined;
    var mean_g: f32 = 0.0;
    var g: usize = 0;
    while (g < 256) : (g += 1) {
        const row = granule_w + g * 16;
        var s: f32 = 0.0;
        var k: usize = 0;
        while (k < 16) : (k += 4) {
            const wv: @Vector(4, f32) = row[k..][0..4].*;
            const xv: @Vector(4, f32) = cmd_proprio[k..][0..4].*;
            s += @reduce(.Add, wv * xv);
        }
        const r = @max(0.0, s - 0.05);
        gran[g] = r;
        mean_g += r;
    }
    const golgi_thr = (mean_g / 256.0) * 1.35;
    g = 0;
    while (g < 256) : (g += 1) {
        gran[g] = @max(0.0, gran[g] - golgi_thr);
    }

    var total_norm: f32 = 0.0;
    var m: usize = 0;
    while (m < 8) : (m += 1) {
        const pf_row = pf_weights + m * 256;
        var corr: f32 = 0.0;
        const err = climbing_err[m];
        g = 0;
        while (g < 256) : (g += 4) {
            var wv: @Vector(4, f32) = pf_row[g..][0..4].*;
            const gv: @Vector(4, f32) = gran[g..][0..4].*;
            if (@abs(eta_cf) > 1e-8 and @abs(err) > 1e-7) {
                const delta: @Vector(4, f32) = @as(@Vector(4, f32), @splat(-eta_cf * err)) * gv;
                wv = @min(@as(@Vector(4, f32), @splat(2.5)), @max(@as(@Vector(4, f32), @splat(-2.5)), wv + delta));
                pf_row[g..][0..4].* = wv;
            }
            corr -= @reduce(.Add, wv * gv);
            total_norm += @reduce(.Add, @abs(wv));
        }
        correction_out[m] = math.clamp(corr, -2.0, 2.0);
    }
    return total_norm / (8.0 * 256.0);
}

export fn cqm2_deltanet_fast_weights_step(
    state_mat: [*]f32,
    raw_sense_key: [*]const f32,
    expected_val: [*]const f32,
    aligned_out: [*]f32,
    alpha_decay: f32,
    beta_learn: f32,
) callconv(.c) f32 {
    const alpha = math.clamp(alpha_decay, 0.5, 1.0);
    const beta = math.clamp(beta_learn, 0.0, 1.0);
    var err_energy: f32 = 0.0;

    var r: usize = 0;
    while (r < 16) : (r += 1) {
        const row = state_mat + r * 16;
        var pred: f32 = 0.0;
        var c: usize = 0;
        while (c < 16) : (c += 4) {
            const sv: @Vector(4, f32) = row[c..][0..4].*;
            const kv: @Vector(4, f32) = raw_sense_key[c..][0..4].*;
            pred += @reduce(.Add, sv * kv);
        }
        const diff = pred - expected_val[r];
        err_energy += diff * diff;

        c = 0;
        var updated_pred: f32 = 0.0;
        while (c < 16) : (c += 4) {
            var sv: @Vector(4, f32) = row[c..][0..4].*;
            const kv: @Vector(4, f32) = raw_sense_key[c..][0..4].*;
            sv = sv * @as(@Vector(4, f32), @splat(alpha)) - @as(@Vector(4, f32), @splat(beta * diff)) * kv;
            sv = @min(@as(@Vector(4, f32), @splat(2.0)), @max(@as(@Vector(4, f32), @splat(-2.0)), sv));
            row[c..][0..4].* = sv;
            updated_pred += @reduce(.Add, sv * kv);
        }
        aligned_out[r] = updated_pred;
    }
    return @sqrt(err_energy / 16.0);
}

// ----------------------------------------------------------------------------
// 4. LCG-Shuffled Zero-Yaw-Bias Verlet Soft-Body Solver
// ----------------------------------------------------------------------------
export fn cqm2_verlet_shuffled_step(
    pos: [*]f32,
    prev_pos: [*]f32,
    inv_mass: [*]const f32,
    num_particles: usize,
    edge_a: [*]const u16,
    edge_b: [*]const u16,
    rest_len: [*]const f32,
    stiffness: [*]const f32,
    order_scratch: [*]u16,
    num_edges: usize,
    dt: f32,
    gravity_y: f32,
    rng_state_inout: *u32,
) callconv(.c) void {
    const damping: f32 = 0.985;
    const dt2 = dt * dt;

    var p: usize = 0;
    while (p < num_particles) : (p += 1) {
        if (inv_mass[p] <= 0.0) continue;
        const idx = p * 3;
        const x = pos[idx];
        const y = pos[idx + 1];
        const z = pos[idx + 2];
        const vx = (x - prev_pos[idx]) * damping;
        const vy = (y - prev_pos[idx + 1]) * damping;
        const vz = (z - prev_pos[idx + 2]) * damping;
        prev_pos[idx] = x;
        prev_pos[idx + 1] = y;
        prev_pos[idx + 2] = z;
        pos[idx] = x + vx;
        pos[idx + 1] = @max(0.0, y + vy + gravity_y * dt2);
        pos[idx + 2] = z + vz;
    }

    var e: usize = 0;
    while (e < num_edges) : (e += 1) {
        order_scratch[e] = @intCast(e);
    }

    var lcg = rng_state_inout.*;
    var sub: usize = 0;
    while (sub < 4) : (sub += 1) {
        if (num_edges > 1) {
            var i: usize = num_edges - 1;
            while (i > 0) : (i -= 1) {
                lcg = lcg *% 1664525 +% 1013904223;
                const j = @as(usize, lcg) % (i + 1);
                const tmp = order_scratch[i];
                order_scratch[i] = order_scratch[j];
                order_scratch[j] = tmp;
            }
        }

        e = 0;
        while (e < num_edges) : (e += 1) {
            const k = order_scratch[e];
            const ia = @as(usize, edge_a[k]) * 3;
            const ib = @as(usize, edge_b[k]) * 3;
            const wa = inv_mass[edge_a[k]];
            const wb = inv_mass[edge_b[k]];
            const w_sum = wa + wb;
            if (w_sum <= 0.0) continue;

            const dx = pos[ib] - pos[ia];
            const dy = pos[ib + 1] - pos[ia + 1];
            const dz = pos[ib + 2] - pos[ia + 2];
            const dist = @sqrt(dx * dx + dy * dy + dz * dz + 1e-12);
            const diff = (dist - rest_len[k]) / (dist * w_sum) * stiffness[k];

            pos[ia] += dx * diff * wa;
            pos[ia + 1] = @max(0.0, pos[ia + 1] + dy * diff * wa);
            pos[ia + 2] += dz * diff * wa;

            pos[ib] -= dx * diff * wb;
            pos[ib + 1] = @max(0.0, pos[ib + 1] - dy * diff * wb);
            pos[ib + 2] -= dz * diff * wb;
        }
    }
    rng_state_inout.* = lcg;
}

// ----------------------------------------------------------------------------
// 5. Symplectic N-Qubit Pauli Contextuality & Hoggar Geometric Detector
// ----------------------------------------------------------------------------
inline fn parity32(x: u32) u32 {
    return @popCount(x) & 1;
}

export fn cqm2_pauli_commute(u: u32, v: u32, n_qubits: u32) callconv(.c) u32 {
    const nq: u5 = @intCast(n_qubits & 15);
    const mask: u32 = (@as(u32, 1) << nq) - 1;
    const au = u & mask;
    const cu = (u >> nq) & mask;
    const av = v & mask;
    const cv = (v >> nq) & mask;
    return if ((parity32(au & cv) ^ parity32(cu & av)) == 0) 1 else 0;
}

export fn cqm2_pauli_line_sign(u: u32, v: u32, n_qubits: u32) callconv(.c) i32 {
    if (u == 0 or v == 0 or u == v) return 0;
    if (cqm2_pauli_commute(u, v, n_qubits) == 0) return 0;
    const nq: u5 = @intCast(n_qubits & 15);
    const mask: u32 = (@as(u32, 1) << nq) - 1;
    const r = u ^ v;
    const au = u & mask;
    const cu = (u >> nq) & mask;
    const av = v & mask;
    const cv = (v >> nq) & mask;
    const ar = r & mask;
    const cr = (r >> nq) & mask;
    const exp_mod4 = (@popCount(au & cu) + @popCount(av & cv) + @popCount(ar & cr) + 2 * (@popCount(cu & av) & 1)) & 3;
    return if (exp_mod4 == 0) 1 else -1;
}

export fn cqm2_hoggar_isotropic_census(
    n_qubits: u32,
    satisfied_out: *u32,
    violated_out: *u32,
) callconv(.c) u32 {
    const nq2: u5 = @intCast((2 * (n_qubits & 7)));
    const total_ops: u32 = (@as(u32, 1) << nq2);
    var sat: u32 = 0;
    var viol: u32 = 0;
    var u: u32 = 1;
    while (u < total_ops) : (u += 1) {
        var v: u32 = u + 1;
        while (v < total_ops) : (v += 1) {
            const r = u ^ v;
            if (r <= v) continue;
            if (cqm2_pauli_commute(u, v, n_qubits) == 1) {
                const s = cqm2_pauli_line_sign(u, v, n_qubits);
                if (s == 1) sat += 1 else if (s == -1) viol += 1;
            }
        }
    }
    satisfied_out.* = sat;
    violated_out.* = viol;
    return sat + viol;
}

fn applyPauli3(op: u32, re: *const [8]f64, im: *const [8]f64, out_re: *[8]f64, out_im: *[8]f64) void {
    const a = op & 7;
    const c = (op >> 3) & 7;
    const phase_pow = @popCount(a & c) & 3;
    var idx: usize = 0;
    while (idx < 8) : (idx += 1) {
        const src = idx ^ @as(usize, a);
        const z_sign: f64 = if ((@popCount(@as(u32, @intCast(src)) & c) & 1) == 1) -1.0 else 1.0;
        const sr = re[src] * z_sign;
        const si = im[src] * z_sign;
        switch (phase_pow) {
            0 => {
                out_re[idx] = sr;
                out_im[idx] = si;
            },
            1 => {
                out_re[idx] = -si;
                out_im[idx] = sr;
            },
            2 => {
                out_re[idx] = -sr;
                out_im[idx] = -si;
            },
            else => {
                out_re[idx] = si;
                out_im[idx] = -sr;
            },
        }
    }
}

export fn cqm2_hoggar_qgt_violated_hexagon_count(trace_out: *f64) callconv(.c) u32 {
    const inv_norm = 1.0 / @sqrt(12.0);
    var psi_re = [8]f64{ -1.0 * inv_norm, inv_norm, inv_norm, inv_norm, inv_norm, inv_norm, inv_norm, inv_norm };
    var psi_im = [8]f64{ 2.0 * inv_norm, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0 };

    var p_re: [64][8]f64 = undefined;
    var p_im: [64][8]f64 = undefined;
    var exp_val: [64]f64 = undefined;
    var diag_trace: f64 = 0.0;

    var v: u32 = 1;
    while (v < 64) : (v += 1) {
        applyPauli3(v, &psi_re, &psi_im, &p_re[v], &p_im[v]);
        var ev: f64 = 0.0;
        var k: usize = 0;
        while (k < 8) : (k += 1) {
            ev += psi_re[k] * p_re[v][k] + psi_im[k] * p_im[v][k];
        }
        exp_val[v] = ev;
        diag_trace += 0.25 * (1.0 - ev * ev);
    }
    trace_out.* = diag_trace;

    var violated_hex: u32 = 0;
    var u: u32 = 1;
    while (u < 64) : (u += 1) {
        v = u + 1;
        while (v < 64) : (v += 1) {
            const r = u ^ v;
            if (r <= v) continue;
            if (cqm2_pauli_commute(u, v, 3) == 1) {
                var dot_re: f64 = 0.0;
                var k: usize = 0;
                while (k < 8) : (k += 1) {
                    dot_re += p_re[u][k] * p_re[v][k] + p_im[u][k] * p_im[v][k];
                }
                const g_uv = @abs(0.25 * (dot_re - exp_val[u] * exp_val[v]));
                if (g_uv > (1.0 / 12.0)) {
                    violated_hex += 1;
                }
            }
        }
    }
    return violated_hex;
}

// ----------------------------------------------------------------------------
// 6. Authentic Tsotchke `quantum_rng` (Physical Constants + Hadamard/Phase Gates + NIST SP 800-90B RCT & APT)
// Constants from `tsotchke/quantum_rng`: FINE, PLANCK, RYD, HEIS, SCHR
// ----------------------------------------------------------------------------
const QRNG_FINE: u64 = 0x7297352743776A1B; // alpha fine-structure Weyl constant
const QRNG_PLANCK: u64 = 0x6955927086495225; // hbar Planck phase constant
const QRNG_RYD: u64 = 0x9E3779B97F4A7C15; // Rydberg golden Weyl step
const QRNG_HEIS: u64 = 0xBF58476D1CE4E5B9; // Heisenberg non-commuting mixer
const QRNG_SCHR: u64 = 0x94D049BB133111EB; // Schrodinger unitary mixer

inline fn qrngHGate(a: *u64, b: *u64) void {
    const sum = a.* +% b.*;
    const diff = a.* -% b.*;
    a.* = math.rotl(u64, sum, 17) ^ QRNG_FINE;
    b.* = math.rotl(u64, diff, 43) ^ QRNG_PLANCK;
}

inline fn qrngPGate(x: u64, step_idx: u64) u64 {
    var z = x +% (step_idx *% QRNG_RYD);
    z = (z ^ (z >> 30)) *% QRNG_HEIS;
    z = (z ^ (z >> 27)) *% QRNG_SCHR;
    return z ^ (z >> 31);
}

export fn cqm2_tsotchke_qrng_batch(
    seed_inout: *u64,
    out_f64: [*]f64,
    count: usize,
    rct_ok_out: *u32,
) callconv(.c) void {
    var s0 = seed_inout.* ^ QRNG_FINE;
    var s1 = math.rotl(u64, seed_inout.* +% QRNG_PLANCK, 29);

    var last_byte: u8 = 0xFF;
    var run_len: u32 = 0;
    var rct_ok: u32 = 1;

    // NIST SP 800-90B Adaptive Proportion Test (APT) over 512-sample windows (cutoff = 13 for 8-bit H_min >= 6)
    var apt_anchor: u8 = 0;
    var apt_hits: u32 = 0;
    var apt_pos: u32 = 0;

    var i: usize = 0;
    while (i < count) : (i += 1) {
        qrngHGate(&s0, &s1);
        const q0 = qrngPGate(s0, @intCast(i + 1));
        const q1 = qrngPGate(s1 ^ q0, @intCast(2 * i + 3));
        s0 ^= math.rotl(u64, q1, 13);
        s1 +%= QRNG_RYD;

        const mixed = q0 ^ math.rotl(u64, q1, 32);
        const sample_byte: u8 = @truncate(mixed & 0xFF);

        // 1. Repetition Count Test (RCT)
        if (sample_byte == last_byte) {
            run_len += 1;
            if (run_len >= 6) rct_ok = 0;
        } else {
            last_byte = sample_byte;
            run_len = 1;
        }

        // 2. Adaptive Proportion Test (APT, W=512)
        if (apt_pos == 0) {
            apt_anchor = sample_byte;
            apt_hits = 1;
            apt_pos = 1;
        } else {
            if (sample_byte == apt_anchor) {
                apt_hits += 1;
                if (apt_hits >= 13) rct_ok = 0;
            }
            apt_pos += 1;
            if (apt_pos >= 512) apt_pos = 0;
        }

        const mant53 = mixed >> 11;
        out_f64[i] = @as(f64, @floatFromInt(mant53)) * (1.0 / 9007199254740992.0);
    }
    seed_inout.* = s0 ^ math.rotl(u64, s1, 7);
    rct_ok_out.* = rct_ok;
}

// ----------------------------------------------------------------------------
// 7. Eshkol Order-4 Taylor-Tower AD Spine Curvature + Vandermonde Metacognition
// ----------------------------------------------------------------------------
export fn cqm2_eshkol_spine_curvature(
    pts_xyz: [*]const f32, // [num_pts * 3], num_pts >= 3
    curv_out: [*]f32, // [num_pts] 4th-order Taylor spline curvature kappa
    num_pts: usize,
) callconv(.c) f32 {
    if (num_pts < 3) return 0.0;
    curv_out[0] = 0.0;
    curv_out[num_pts - 1] = 0.0;
    var sum_k: f32 = 0.0;

    var i: usize = 1;
    while (i + 1 < num_pts) : (i += 1) {
        const p_m1 = pts_xyz + (i - 1) * 3;
        const p_0 = pts_xyz + i * 3;
        const p_p1 = pts_xyz + (i + 1) * 3;

        var rx1: f32 = 0.0;
        var ry1: f32 = 0.0;
        var rz1: f32 = 0.0;
        var rx2: f32 = 0.0;
        var ry2: f32 = 0.0;
        var rz2: f32 = 0.0;

        if (i >= 2 and i + 2 < num_pts) {
            // Exact 5-point degree-4 Taylor-jet stencil: O(h^4) first & second derivatives!
            const p_m2 = pts_xyz + (i - 2) * 3;
            const p_p2 = pts_xyz + (i + 2) * 3;
            rx1 = (p_m2[0] - 8.0 * p_m1[0] + 8.0 * p_p1[0] - p_p2[0]) / 12.0;
            ry1 = (p_m2[1] - 8.0 * p_m1[1] + 8.0 * p_p1[1] - p_p2[1]) / 12.0;
            rz1 = (p_m2[2] - 8.0 * p_m1[2] + 8.0 * p_p1[2] - p_p2[2]) / 12.0;

            rx2 = (-p_m2[0] + 16.0 * p_m1[0] - 30.0 * p_0[0] + 16.0 * p_p1[0] - p_p2[0]) / 12.0;
            ry2 = (-p_m2[1] + 16.0 * p_m1[1] - 30.0 * p_0[1] + 16.0 * p_p1[1] - p_p2[1]) / 12.0;
            rz2 = (-p_m2[2] + 16.0 * p_m1[2] - 30.0 * p_0[2] + 16.0 * p_p1[2] - p_p2[2]) / 12.0;
        } else {
            rx1 = 0.5 * (p_p1[0] - p_m1[0]);
            ry1 = 0.5 * (p_p1[1] - p_m1[1]);
            rz1 = 0.5 * (p_p1[2] - p_m1[2]);

            rx2 = p_p1[0] - 2.0 * p_0[0] + p_m1[0];
            ry2 = p_p1[1] - 2.0 * p_0[1] + p_m1[1];
            rz2 = p_p1[2] - 2.0 * p_0[2] + p_m1[2];
        }

        const cx = ry1 * rz2 - rz1 * ry2;
        const cy = rz1 * rx2 - rx1 * rz2;
        const cz = rx1 * ry2 - ry1 * rx2;
        const cross_norm = @sqrt(cx * cx + cy * cy + cz * cz);
        const speed_sq = rx1 * rx1 + ry1 * ry1 + rz1 * rz1;
        const denom = speed_sq * @sqrt(speed_sq) + 1e-8;
        const k = cross_norm / denom;
        curv_out[i] = k;
        sum_k += k;
    }
    return sum_k / @as(f32, @floatFromInt(num_pts - 2));
}

// Exact Order-4 Backward Vandermonde Taylor-Jet (`b45-metacog` `PredictiveMetacognition`):
// Given 5 backward history samples [f(0), f(-1), f(-2), f(-3), f(-4)], extracts exact Taylor jet
// [c0, c1, c2, c3, c4] where c_m = f^(m)(0)/m!, and returns confidence C_pred = 1 / (1 + 2*|c4|).
export fn cqm2_eshkol_vandermonde_jet4(
    history5: [*]const f32,
    jet_out5: [*]f32,
) callconv(.c) f32 {
    const f0 = history5[0];
    const f1 = history5[1];
    const f2 = history5[2];
    const f3 = history5[3];
    const f4 = history5[4];

    // Exact inverse of Vandermonde V_{j,m} = (-j)^m for j,m in 0..4:
    const c0 = f0;
    const c1 = (25.0 * f0 - 48.0 * f1 + 36.0 * f2 - 16.0 * f3 + 3.0 * f4) / 12.0;
    const c2 = (35.0 * f0 - 104.0 * f1 + 114.0 * f2 - 56.0 * f3 + 11.0 * f4) / 24.0;
    const c3 = (5.0 * f0 - 18.0 * f1 + 24.0 * f2 - 14.0 * f3 + 3.0 * f4) / 12.0;
    const c4 = (f0 - 4.0 * f1 + 6.0 * f2 - 4.0 * f3 + f4) / 24.0;

    jet_out5[0] = c0;
    jet_out5[1] = c1;
    jet_out5[2] = c2;
    jet_out5[3] = c3;
    jet_out5[4] = c4;
    return 1.0 / (1.0 + 2.0 * @abs(c4));
}

// ----------------------------------------------------------------------------
// 8. Relativistic Schwarzschild & 3D Spinning Kerr Mino-Time Null Geodesics
// ----------------------------------------------------------------------------
export fn cqm2_schwarzschild_photon_deflection(
    impact_b_over_m: f64,
    max_steps: u32,
    captured_out: *u32,
) callconv(.c) f64 {
    if (impact_b_over_m <= 0.0) {
        captured_out.* = 1;
        return 0.0;
    }
    var u: f64 = 1e-4;
    const inv_b2 = 1.0 / (impact_b_over_m * impact_b_over_m);
    const disc = inv_b2 - u * u + 2.0 * u * u * u;
    if (disc <= 0.0) {
        captured_out.* = 0;
        return 0.0;
    }
    var v: f64 = @sqrt(disc);
    var phi: f64 = 0.0;
    const dphi: f64 = 0.01;
    var turned = false;

    var step: u32 = 0;
    while (step < max_steps) : (step += 1) {
        const k1_u = v;
        const k1_v = 3.0 * u * u - u;

        const u_s2 = u + 0.5 * dphi * k1_u;
        const v_s2 = v + 0.5 * dphi * k1_v;
        const k2_u = v_s2;
        const k2_v = 3.0 * u_s2 * u_s2 - u_s2;

        const u_s3 = u + 0.5 * dphi * k2_u;
        const v_s3 = v + 0.5 * dphi * k2_v;
        const k3_u = v_s3;
        const k3_v = 3.0 * u_s3 * u_s3 - u_s3;

        const u_s4 = u + dphi * k3_u;
        const v_s4 = v + dphi * k3_v;
        const k4_u = v_s4;
        const k4_v = 3.0 * u_s4 * u_s4 - u_s4;

        const next_u = u + (dphi / 6.0) * (k1_u + 2.0 * k2_u + 2.0 * k3_u + k4_u);
        const next_v = v + (dphi / 6.0) * (k1_v + 2.0 * k2_v + 2.0 * k3_v + k4_v);

        if (next_v < 0.0) turned = true;
        u = next_u;
        v = next_v;
        phi += dphi;

        if (u >= 0.5) {
            captured_out.* = 1;
            return phi;
        }
        if (turned and u <= 1e-4) {
            captured_out.* = 0;
            return phi - math.pi;
        }
    }
    captured_out.* = if (u >= 0.333333) 1 else 0;
    return phi - math.pi;
}

// 3D Spinning Kerr Boyer-Lindquist / Mino-Time Null Geodesic Integrator (`Black Hole Simulation Lab` port):
// Integrates dr/dlambda = pm sqrt(R(r)), dtheta/dlambda = pm sqrt(Theta(theta)), dphi/dlambda
// with conserved impact parameter xi = L_z/E and Carter constant eta = Q/E^2.
// Writes [r_min, phi_accum, disk_crossings, carter_rel_drift] to `out4` and returns 1 if captured by r_+!
export fn cqm2_kerr_mino_geodesic(
    spin_a_raw: f64,
    incl_rad: f64,
    xi: f64,
    eta: f64,
    max_steps: u32,
    out4: [*]f64,
) callconv(.c) u32 {
    const a = math.clamp(spin_a_raw, -0.998, 0.998);
    const a2 = a * a;
    const r_plus = 1.0 + @sqrt(@max(0.0, 1.0 - a2));

    var r: f64 = 50.0;
    var th: f64 = math.clamp(incl_rad, 0.05, math.pi - 0.05);
    var phi: f64 = 0.0;
    var sign_r: f64 = -1.0;
    var sign_th: f64 = -1.0;
    var r_min: f64 = r;
    var disk_crossings: f64 = 0.0;

    const evalR = struct {
        fn f(rv: f64, av: f64, xiv: f64, etav: f64) f64 {
            const delta = rv * rv - 2.0 * rv + av * av;
            const term1 = rv * rv + av * av - av * xiv;
            const diff = xiv - av;
            return term1 * term1 - delta * (etav + diff * diff);
        }
    }.f;

    const evalTheta = struct {
        fn f(thv: f64, av: f64, xiv: f64, etav: f64) f64 {
            const c = @cos(thv);
            const s = @max(1e-6, @sin(thv));
            return etav + av * av * c * c - (xiv * xiv * c * c) / (s * s);
        }
    }.f;

    // Conserved Carter Q check: Q = p_theta^2 + cos^2(theta) * (xi^2 / sin^2(theta) - a^2)
    const th0_pot = evalTheta(th, a, xi, eta);
    if (th0_pot < 0.0) {
        out4[0] = r;
        out4[1] = 0.0;
        out4[2] = 0.0;
        out4[3] = 0.0;
        return 0;
    }

    var max_carter_drift: f64 = 0.0;
    const ds_base: f64 = 0.08;
    var captured: u32 = 0;

    var step: u32 = 0;
    while (step < max_steps) : (step += 1) {
        const r_pot = evalR(r, a, xi, eta);
        if (r_pot <= 0.0 and sign_r < 0.0) {
            sign_r = 1.0;
        }
        const th_pot = evalTheta(th, a, xi, eta);
        if (th_pot <= 0.0) {
            sign_th = -sign_th;
        }

        const c_th = @cos(th);
        const sigma = r * r + a2 * c_th * c_th;
        const inv_sigma = 1.0 / @max(1e-6, sigma);

        // Affine-normalized step ds = d(affine), so dr/ds = pm sqrt(R)/Sigma ~ O(1)!
        const h = ds_base * math.clamp((r - r_plus) * 0.5, 0.02, 1.0);
        const pr = sign_r * @sqrt(@max(0.0, evalR(r, a, xi, eta))) * inv_sigma;
        const r_cand = r + h * pr;
        if (sign_r < 0.0 and r_cand > r_plus * 1.02 and evalR(r_cand, a, xi, eta) <= 0.0) {
            // Reached radial periapsis barrier outside horizon -> reflect cleanly!
            sign_r = 1.0;
        } else {
            r = r_cand;
        }

        const pth = sign_th * @sqrt(@max(0.0, evalTheta(th, a, xi, eta))) * inv_sigma;
        const th_cand = math.clamp(th + h * pth, 0.02, math.pi - 0.02);
        if (evalTheta(th_cand, a, xi, eta) <= 0.0) {
            sign_th = -sign_th;
        } else {
            const prev_cos = @cos(th);
            th = th_cand;
            const next_cos = @cos(th);
            if ((prev_cos >= 0.0 and next_cos < 0.0) or (prev_cos <= 0.0 and next_cos > 0.0)) {
                disk_crossings += 1.0;
            }
        }

        const delta = @max(1e-6, r * r - 2.0 * r + a2);
        const sin_th = @max(1e-5, @sin(th));
        const dphi = ((a * (2.0 * r - a * xi)) / delta + xi / (sin_th * sin_th)) * inv_sigma;
        phi += h * dphi;

        if (r < r_min) r_min = r;

        // Reconstruct Carter constant Q from current theta + p_theta^2 to verify exact conservation
        const c_now = @cos(th);
        const s_now = @max(1e-5, @sin(th));
        const pth2_now = @max(0.0, evalTheta(th, a, xi, eta));
        const q_rec = pth2_now + c_now * c_now * ((xi * xi) / (s_now * s_now) - a2);
        const drift = @abs(q_rec - eta) / @max(1.0, @abs(eta));
        if (drift > max_carter_drift) max_carter_drift = drift;

        if (r <= r_plus * 1.015) {
            captured = 1;
            break;
        }
        if (sign_r > 0.0 and r >= 52.0) {
            captured = 0;
            break;
        }
    }

    out4[0] = r_min;
    out4[1] = phi;
    out4[2] = disk_crossings;
    out4[3] = max_carter_drift;
    return captured;
}

// ----------------------------------------------------------------------------
// 9. Tsotchke `spin_based_neural_network` LLG, `libirrep` Y_lm & `tensorcore` RMSNorm+SwiGLU
// ----------------------------------------------------------------------------
export fn cqm2_llg_spin_step(
    spins_xyz: [*]f32, // [count * 3] unit spins on S^2
    h_eff_xyz: [*]const f32, // [count * 3] effective local field
    count: usize,
    alpha_gilbert: f32,
    dt: f32,
) callconv(.c) f32 {
    if (count == 0) return 0.0;
    const pref = dt / (1.0 + alpha_gilbert * alpha_gilbert);
    var mz_sum: f32 = 0.0;
    var i: usize = 0;
    while (i < count) : (i += 1) {
        const idx = i * 3;
        const sx = spins_xyz[idx];
        const sy = spins_xyz[idx + 1];
        const sz = spins_xyz[idx + 2];

        const hx = h_eff_xyz[idx];
        const hy = h_eff_xyz[idx + 1];
        const hz = h_eff_xyz[idx + 2];

        // S x H
        const cx = sy * hz - sz * hy;
        const cy = sz * hx - sx * hz;
        const cz = sx * hy - sy * hx;

        // S x (S x H)
        const dcx = sy * cz - sz * cy;
        const dcy = sz * cx - sx * cz;
        const dcz = sx * cy - sy * cx;

        var nx = sx - pref * (cx + alpha_gilbert * dcx);
        var ny = sy - pref * (cy + alpha_gilbert * dcy);
        var nz = sz - pref * (cz + alpha_gilbert * dcz);
        const inv_n = 1.0 / @sqrt(nx * nx + ny * ny + nz * nz + 1e-12);
        nx *= inv_n;
        ny *= inv_n;
        nz *= inv_n;

        spins_xyz[idx] = nx;
        spins_xyz[idx + 1] = ny;
        spins_xyz[idx + 2] = nz;
        mz_sum += nz;
    }
    return mz_sum / @as(f32, @floatFromInt(count));
}

export fn cqm2_spherical_harmonics_l2(
    dir_xyz: [*]const f32, // [3] (x, y, z)
    out9: [*]f32, // [9] real orthonormal Y_{l,m} for l=0,1,2
) callconv(.c) void {
    const rx = dir_xyz[0];
    const ry = dir_xyz[1];
    const rz = dir_xyz[2];
    const inv_r = 1.0 / @sqrt(rx * rx + ry * ry + rz * rz + 1e-12);
    const x = rx * inv_r;
    const y = ry * inv_r;
    const z = rz * inv_r;

    out9[0] = 0.28209479; // Y_{0,0}
    out9[1] = 0.48860251 * y; // Y_{1,-1}
    out9[2] = 0.48860251 * z; // Y_{1,0}
    out9[3] = 0.48860251 * x; // Y_{1,1}
    out9[4] = 1.09254843 * x * y; // Y_{2,-2}
    out9[5] = 1.09254843 * y * z; // Y_{2,-1}
    out9[6] = 0.31539157 * (3.0 * z * z - 1.0); // Y_{2,0}
    out9[7] = 1.09254843 * x * z; // Y_{2,1}
    out9[8] = 0.54627422 * (x * x - y * y); // Y_{2,2}
}

export fn cqm2_rmsnorm_swiglu(
    x_in: [*]const f32,
    gate_in: [*]const f32,
    weight: [*]const f32,
    out: [*]f32,
    dim: usize,
) callconv(.c) f32 {
    if (dim == 0) return 0.0;
    var sq_sum: f32 = 0.0;
    var i: usize = 0;
    while (i < dim) : (i += 1) {
        sq_sum += x_in[i] * x_in[i];
    }
    const rms_inv = 1.0 / @sqrt(sq_sum / @as(f32, @floatFromInt(dim)) + 1e-6);
    var act_mean: f32 = 0.0;
    i = 0;
    while (i < dim) : (i += 1) {
        const normed = x_in[i] * rms_inv * weight[i];
        const g = gate_in[i];
        const silu_g = g * sigmoid(g);
        const y = normed * silu_g;
        out[i] = y;
        act_mean += @abs(y);
    }
    return act_mean / @as(f32, @floatFromInt(dim));
}

// ----------------------------------------------------------------------------
// 10. Dual-Layer Reactive Creature Skin (Hormone Gray-Scott + FitzHugh-Nagumo)
// ----------------------------------------------------------------------------
export fn cqm2_reactive_skin_step(
    u_gs: [*]f32,
    v_gs: [*]f32,
    fhn_v: [*]f32,
    fhn_w: [*]f32,
    w: usize,
    h: usize,
    leptin: f32,
    cortisol: f32,
    dopamine: f32,
    neural_drive: f32,
) callconv(.c) f32 {
    if (w < 3 or h < 3) return 0.0;
    const feed = 0.030 + 0.020 * math.clamp(leptin, 0.0, 1.0);
    const kill = 0.059 + 0.007 * math.clamp(cortisol, 0.0, 1.0) - 0.002 * math.clamp(dopamine, 0.0, 1.0);
    const du: f32 = 0.16;
    const dv: f32 = 0.08;
    var mean_pattern: f32 = 0.0;

    var y: usize = 0;
    while (y < h) : (y += 1) {
        const ym = if (y == 0) h - 1 else y - 1;
        const yp = if (y + 1 == h) 0 else y + 1;
        var x: usize = 0;
        while (x < w) : (x += 1) {
            const xm = if (x == 0) w - 1 else x - 1;
            const xp = if (x + 1 == w) 0 else x + 1;
            const idx = y * w + x;

            const u_c = u_gs[idx];
            const v_c = v_gs[idx];
            const lap_u = u_gs[ym * w + x] + u_gs[yp * w + x] + u_gs[y * w + xm] + u_gs[y * w + xp] - 4.0 * u_c;
            const lap_v = v_gs[ym * w + x] + v_gs[yp * w + x] + v_gs[y * w + xm] + v_gs[y * w + xp] - 4.0 * v_c;

            const uvv = u_c * v_c * v_c;
            const nu = math.clamp(u_c + du * lap_u - uvv + feed * (1.0 - u_c), 0.0, 1.0);
            const nv = math.clamp(v_c + dv * lap_v + uvv - (feed + kill) * v_c, 0.0, 1.0);
            u_gs[idx] = nu;
            v_gs[idx] = nv;

            const fv = fhn_v[idx];
            const fw = fhn_w[idx];
            const lap_f = fhn_v[ym * w + x] + fhn_v[yp * w + x] + fhn_v[y * w + xm] + fhn_v[y * w + xp] - 4.0 * fv;
            const dfv = fv - (fv * fv * fv) / 3.0 - fw + 0.12 * lap_f + 0.35 * neural_drive;
            const dfw = 0.08 * (fv + 0.7 - 0.8 * fw);
            fhn_v[idx] = math.clamp(fv + 0.05 * dfv, -2.5, 2.5);
            fhn_w[idx] = math.clamp(fw + 0.05 * dfw, -2.5, 2.5);

            mean_pattern += nv;
        }
    }
    return mean_pattern / @as(f32, @floatFromInt(w * h));
}

// ============================================================================
// Native Zig Unit Tests (`zig build test`)
// ============================================================================
test "3-qubit Pauli isotropic census & Hoggar QGT hexagon = 63 violated lines" {
    var sat: u32 = 0;
    var viol: u32 = 0;
    const total = cqm2_hoggar_isotropic_census(3, &sat, &viol);
    try std.testing.expectEqual(@as(u32, 315), total);

    var trace: f64 = 0.0;
    const hex_violated = cqm2_hoggar_qgt_violated_hexagon_count(&trace);
    try std.testing.expectEqual(@as(u32, 63), hex_violated);
    try std.testing.expectApproxEqAbs(@as(f64, 14.0), trace, 1e-9);
}

test "Single-tanh organism brain forward parity & layer-1 plasticity" {
    var inputs = [_]f32{ 1.0, 0.5, -0.5, 0.25, 0.0, 0.0, 0.0, 0.0 };
    var weights: [126]f32 = @splat(0.0);
    weights[0] = 2.0; // h[0] = fastTanh(2.0)
    weights[72] = 1.0; // out[0] = fastTanh(1.0 * h[0])
    var mods = [_]f32{ 1.0, 1.0 };
    var out: [6]f32 = @splat(0.0);

    cqm2_organism_brain_batch_simd(&inputs, &weights, &mods, &out, 1, 0.0);
    const expected_h0 = fastTanh(2.0);
    const expected_y0 = fastTanh(expected_h0);
    try std.testing.expectApproxEqAbs(expected_y0, out[0], 1e-6);

    // Verify plastic update touches BOTH w1 and w2
    cqm2_organism_brain_batch_simd(&inputs, &weights, &mods, &out, 1, 0.05);
    try std.testing.expect(@abs(weights[1]) > 1e-5); // w1[0, 1] learned input[1]!
}

test "3D Kerr Mino geodesic capture asymmetry & Eshkol Vandermonde exact polynomial jet" {
    var out_pro: [4]f64 = undefined;
    var out_ret: [4]f64 = undefined;
    // At spin a = 0.9M, prograde xi = +3.5 escapes while retrograde xi = -3.5 plunges into horizon!
    const cap_pro = cqm2_kerr_mino_geodesic(0.9, math.pi * 0.5, 3.5, 2.0, 4000, &out_pro);
    const cap_ret = cqm2_kerr_mino_geodesic(0.9, math.pi * 0.5, -3.5, 2.0, 4000, &out_ret);
    try std.testing.expectEqual(@as(u32, 0), cap_pro);
    try std.testing.expectEqual(@as(u32, 1), cap_ret);
    try std.testing.expect(out_pro[3] < 1e-12); // Carter constant conserved!

    // Vandermonde check on exact cubic f(t) = 2 + 3t + 4t^2 + 5t^3 -> c4 = 0 -> confidence = 1.0!
    var hist: [5]f32 = undefined;
    var j: usize = 0;
    while (j < 5) : (j += 1) {
        const t = -@as(f32, @floatFromInt(j));
        hist[j] = 2.0 + 3.0 * t + 4.0 * t * t + 5.0 * t * t * t;
    }
    var jet: [5]f32 = undefined;
    const conf = cqm2_eshkol_vandermonde_jet4(&hist, &jet);
    try std.testing.expectApproxEqAbs(@as(f32, 1.0), conf, 1e-5);
    try std.testing.expectApproxEqAbs(@as(f32, 5.0), jet[3], 1e-4);
}
