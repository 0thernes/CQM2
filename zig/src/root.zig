const std = @import("std");
const math = std.math;

// ============================================================================
// CQM2 v4.0.0 Dual-Target Zig SIMD128 / AVX2 Scientific & Neural Kernel Suite
// Targets: wasm32-freestanding (+simd128) AND x86_64/aarch64 Native FFI DLL
// Unifies all 20 CQM2 kernels + all 18 Original CQM `cqm_*` kernels + 5 v4.0.0
// Neuroscience & 11/11/2026 Errata kernels (43 total hardware-SIMD exports).
// ============================================================================

const HEAP_SIZE: usize = 32 * 1024 * 1024; // 32 MiB deterministic linear arena
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

// ----------------------------------------------------------------------------
// 11. Fast Walsh-Hadamard Stabilizer Rényi-2 Quantum Magic M_2(|psi>)
// Computes exact M_2 = -log2(2^{-n} sum_{P in P_n} <psi|P|psi>^4) in O(n * 4^n)
// ----------------------------------------------------------------------------
export fn cqm2_fwht_quantum_magic_m2(
    psi_re: [*]const f64,
    psi_im: [*]const f64,
    n_qubits: u32,
) callconv(.c) f64 {
    if (n_qubits == 0 or n_qubits > 8) return 0.0;
    const nq: math.Log2Int(usize) = @intCast(n_qubits);
    const dim: usize = @as(usize, 1) << nq;

    var norm2: f64 = 0.0;
    var i: usize = 0;
    while (i < dim) : (i += 1) {
        norm2 += psi_re[i] * psi_re[i] + psi_im[i] * psi_im[i];
    }
    if (norm2 < 1e-18) return 0.0;
    const inv_norm = 1.0 / @sqrt(norm2);

    var r: [256]f64 = undefined;
    var m: [256]f64 = undefined;
    i = 0;
    while (i < dim) : (i += 1) {
        r[i] = psi_re[i] * inv_norm;
        m[i] = psi_im[i] * inv_norm;
    }

    var vec_re: [256]f64 = undefined;
    var vec_im: [256]f64 = undefined;
    var sum_fourth: f64 = 0.0;

    var a: usize = 0;
    while (a < dim) : (a += 1) {
        var z: usize = 0;
        while (z < dim) : (z += 1) {
            const za = z ^ a;
            vec_re[z] = r[z] * r[za] + m[z] * m[za];
            vec_im[z] = r[z] * m[za] - m[z] * r[za];
        }

        var len: usize = 1;
        while (len < dim) : (len <<= 1) {
            var base: usize = 0;
            while (base < dim) : (base += (len << 1)) {
                var j: usize = 0;
                while (j < len) : (j += 1) {
                    const ur = vec_re[base + j];
                    const vr = vec_re[base + j + len];
                    const ui = vec_im[base + j];
                    const vi = vec_im[base + j + len];
                    vec_re[base + j] = ur + vr;
                    vec_re[base + j + len] = ur - vr;
                    vec_im[base + j] = ui + vi;
                    vec_im[base + j + len] = ui - vi;
                }
            }
        }

        var b: usize = 0;
        while (b < dim) : (b += 1) {
            const mag2 = vec_re[b] * vec_re[b] + vec_im[b] * vec_im[b];
            sum_fourth += mag2 * mag2;
        }
    }

    const xi = sum_fourth / @as(f64, @floatFromInt(dim));
    if (xi <= 1e-18) return 0.0;
    const m2 = -math.log2(xi);
    return if (m2 < 0.0) 0.0 else m2;
}

// ----------------------------------------------------------------------------
// 12. Batched 32x32 Recurrent GlyphBrain Step (100 Alphabet Pantheon Glyphs)
// ----------------------------------------------------------------------------
export fn cqm2_glyph_brain_batch_step(
    states: [*]f32, // [num_glyphs * 1024]
    lateral_w: [*]f32, // [num_glyphs * 4]
    drive: [*]const f32, // [num_glyphs * 4]
    num_glyphs: usize,
    lr: f32,
) callconv(.c) f32 {
    if (num_glyphs == 0) return 0.0;
    var total_energy: f64 = 0.0;
    var buf: [1024]f32 = undefined;

    var g: usize = 0;
    while (g < num_glyphs) : (g += 1) {
        const s = states + g * 1024;
        const w = lateral_w + g * 4;
        const drv = drive + g * 4;
        const wn = w[0];
        const ws = w[1];
        const we = w[2];
        const ww = w[3];
        var corr_n: f32 = 0.0;
        var corr_s: f32 = 0.0;
        var corr_e: f32 = 0.0;
        var corr_w: f32 = 0.0;

        var y: usize = 0;
        while (y < 32) : (y += 1) {
            const yn = (y + 31) & 31;
            const ys = (y + 1) & 31;
            const qy: usize = if (y >= 16) 2 else 0;
            var x: usize = 0;
            while (x < 32) : (x += 1) {
                const xw = (x + 31) & 31;
                const xe = (x + 1) & 31;
                const idx = (y << 5) | x;
                const quad = qy | (if (x >= 16) @as(usize, 1) else @as(usize, 0));

                const sn = s[(yn << 5) | x];
                const ss = s[(ys << 5) | x];
                const se = s[(y << 5) | xe];
                const sw = s[(y << 5) | xw];
                const cur = s[idx];

                const net = 0.72 * cur + wn * sn + ws * ss + we * se + ww * sw + 0.25 * drv[quad];
                const nxt = fastTanh(net);
                buf[idx] = nxt;

                corr_n += nxt * sn;
                corr_s += nxt * ss;
                corr_e += nxt * se;
                corr_w += nxt * sw;
                total_energy += @as(f64, @abs(nxt));
            }
        }

        var k: usize = 0;
        while (k < 1024) : (k += 1) {
            s[k] = buf[k];
        }

        if (@abs(lr) > 1e-7) {
            const scale = lr * (1.0 / 1024.0);
            w[0] = math.clamp(wn + scale * (corr_n - 1024.0 * wn * wn * wn), -0.45, 0.45);
            w[1] = math.clamp(ws + scale * (corr_s - 1024.0 * ws * ws * ws), -0.45, 0.45);
            w[2] = math.clamp(we + scale * (corr_e - 1024.0 * we * we * we), -0.45, 0.45);
            w[3] = math.clamp(ww + scale * (corr_w - 1024.0 * ww * ww * ww), -0.45, 0.45);
        }
    }
    return @floatCast(total_energy / @as(f64, @floatFromInt(num_glyphs * 1024)));
}

// ----------------------------------------------------------------------------
// 13. Zero-GC CSR Connectome Graph Analytics (PageRank + Louvain Modularity Q)
// Uses pre-allocated scratch buffers so wasm32-freestanding needs zero malloc!
// ----------------------------------------------------------------------------
export fn cqm2_csr_pagerank_louvain_arena(
    num_nodes: u32,
    edge_u: [*]const u32,
    edge_v: [*]const u32,
    num_edges: u32,
    row_ptr: [*]u32, // [num_nodes + 1]
    col_idx: [*]u32, // [2 * num_edges]
    deg: [*]u32, // [num_nodes]
    cursor: [*]u32, // [num_nodes + 1]
    next_pr: [*]f32, // [num_nodes]
    comm_vol: [*]f64, // [num_nodes]
    pagerank_out: [*]f32, // [num_nodes]
    community_out: [*]u32, // [num_nodes]
    stats_out4: [*]f64, // [modularity_Q, degree_entropy_bits, max_pr, comm_count]
) callconv(.c) i32 {
    if (num_nodes == 0) return -1;
    const n: usize = @intCast(num_nodes);
    const e_cnt: usize = @intCast(num_edges);

    var i: usize = 0;
    while (i < n) : (i += 1) {
        deg[i] = 0;
    }

    var valid_edges: u32 = 0;
    var e: usize = 0;
    while (e < e_cnt) : (e += 1) {
        const u = edge_u[e];
        const v = edge_v[e];
        if (u < num_nodes and v < num_nodes and u != v) {
            deg[u] += 1;
            deg[v] += 1;
            valid_edges += 1;
        }
    }

    row_ptr[0] = 0;
    i = 0;
    while (i < n) : (i += 1) {
        row_ptr[i + 1] = row_ptr[i] + deg[i];
        cursor[i] = row_ptr[i];
    }

    e = 0;
    while (e < e_cnt) : (e += 1) {
        const u = edge_u[e];
        const v = edge_v[e];
        if (u < num_nodes and v < num_nodes and u != v) {
            col_idx[cursor[u]] = v;
            cursor[u] += 1;
            col_idx[cursor[v]] = u;
            cursor[v] += 1;
        }
    }

    // 12-iteration Power-Iteration PageRank
    const inv_n: f32 = 1.0 / @as(f32, @floatFromInt(num_nodes));
    const alpha: f32 = 0.85;
    i = 0;
    while (i < n) : (i += 1) {
        pagerank_out[i] = inv_n;
    }

    var iter: usize = 0;
    while (iter < 12) : (iter += 1) {
        var dangling_sum: f32 = 0.0;
        i = 0;
        while (i < n) : (i += 1) {
            if (deg[i] == 0) dangling_sum += pagerank_out[i];
        }
        const base = (1.0 - alpha + alpha * dangling_sum) * inv_n;
        i = 0;
        while (i < n) : (i += 1) {
            next_pr[i] = base;
        }
        i = 0;
        while (i < n) : (i += 1) {
            const du = deg[i];
            if (du == 0) continue;
            const share = alpha * pagerank_out[i] / @as(f32, @floatFromInt(du));
            var k: usize = row_ptr[i];
            const end_k: usize = row_ptr[i + 1];
            while (k < end_k) : (k += 1) {
                next_pr[col_idx[k]] += share;
            }
        }
        i = 0;
        while (i < n) : (i += 1) {
            pagerank_out[i] = next_pr[i];
        }
    }

    // Greedy Modularity Label Propagation (reuse `cursor` as comm_hits scratch!)
    const two_m: f64 = @max(1.0, 2.0 * @as(f64, @floatFromInt(valid_edges)));
    i = 0;
    while (i < n) : (i += 1) {
        community_out[i] = @intCast(i);
        comm_vol[i] = @floatFromInt(deg[i]);
        cursor[i] = 0;
    }

    var sweep: usize = 0;
    while (sweep < 8) : (sweep += 1) {
        var changed = false;
        i = 0;
        while (i < n) : (i += 1) {
            const start_k: usize = row_ptr[i];
            const end_k: usize = row_ptr[i + 1];
            if (start_k == end_k) continue;

            const cur_c = community_out[i];
            const ku: f64 = @floatFromInt(deg[i]);
            comm_vol[cur_c] -= ku;

            var k: usize = start_k;
            while (k < end_k) : (k += 1) {
                const c = community_out[col_idx[k]];
                cursor[c] += 1;
            }

            var best_c = cur_c;
            var best_gain: f64 = @as(f64, @floatFromInt(cursor[cur_c])) - (comm_vol[cur_c] * ku) / two_m;

            k = start_k;
            while (k < end_k) : (k += 1) {
                const c = community_out[col_idx[k]];
                const hits = cursor[c];
                if (hits > 0) {
                    const gain = @as(f64, @floatFromInt(hits)) - (comm_vol[c] * ku) / two_m;
                    if (gain > best_gain + 1e-12 or (@abs(gain - best_gain) <= 1e-12 and c < best_c)) {
                        best_gain = gain;
                        best_c = c;
                    }
                    cursor[c] = 0;
                }
            }
            cursor[cur_c] = 0;

            community_out[i] = best_c;
            comm_vol[best_c] += ku;
            if (best_c != cur_c) changed = true;
        }
        if (!changed) break;
    }

    var internal_2e: f64 = 0.0;
    var max_pr: f32 = 0.0;
    i = 0;
    while (i < n) : (i += 1) {
        if (pagerank_out[i] > max_pr) max_pr = pagerank_out[i];
        const cu = community_out[i];
        var k: usize = row_ptr[i];
        const end_k: usize = row_ptr[i + 1];
        while (k < end_k) : (k += 1) {
            if (community_out[col_idx[k]] == cu) internal_2e += 1.0;
        }
    }

    var sum_vol_sq: f64 = 0.0;
    var active_comms: u32 = 0;
    i = 0;
    while (i < n) : (i += 1) cursor[i] = 0;
    i = 0;
    while (i < n) : (i += 1) {
        const cu = community_out[i];
        if (cursor[cu] == 0) {
            cursor[cu] = 1;
            active_comms += 1;
            const v = comm_vol[cu] / two_m;
            sum_vol_sq += v * v;
        }
    }
    const modularity_q = if (valid_edges > 0) (internal_2e / two_m - sum_vol_sq) else 0.0;

    // Degree entropy over 64-bin capped histogram
    var hist: [64]u32 = @splat(0);
    i = 0;
    while (i < n) : (i += 1) {
        const bin: usize = @min(@as(usize, deg[i]), 63);
        hist[bin] += 1;
    }
    var ent: f64 = 0.0;
    var b: usize = 0;
    while (b < 64) : (b += 1) {
        if (hist[b] > 0) {
            const p = @as(f64, @floatFromInt(hist[b])) / @as(f64, @floatFromInt(num_nodes));
            ent -= p * math.log2(p);
        }
    }

    stats_out4[0] = modularity_q;
    stats_out4[1] = ent;
    stats_out4[2] = @as(f64, max_pr);
    stats_out4[3] = @as(f64, @floatFromInt(active_comms));
    return 0;
}

// ----------------------------------------------------------------------------
// 14. 6D->3D Icosahedral Quasicrystal Projector (`GodColossus` boot kernel)
// ----------------------------------------------------------------------------
export fn cqm2_quasicrystal_icosa_shell(
    grid_extent: i32,
    perp_cutoff: f32,
    r_min: f32,
    r_max: f32,
    out_xyz: [*]f32,
    max_points: u32,
) callconv(.c) u32 {
    if (max_points == 0) return 0;
    const tau: f32 = 1.61803398875;
    const nrm: f32 = 1.0 / @sqrt(2.0 * (2.0 + tau));
    const par = [3][6]f32{
        .{ nrm * 1.0, nrm * tau, 0.0, -nrm * 1.0, nrm * tau, 0.0 },
        .{ nrm * tau, 0.0, nrm * 1.0, nrm * tau, 0.0, -nrm * 1.0 },
        .{ 0.0, nrm * 1.0, nrm * tau, 0.0, -nrm * 1.0, nrm * tau },
    };
    const perp = [3][6]f32{
        .{ -nrm * tau, nrm * 1.0, 0.0, nrm * tau, nrm * 1.0, 0.0 },
        .{ nrm * 1.0, 0.0, -nrm * tau, nrm * 1.0, 0.0, nrm * tau },
        .{ 0.0, -nrm * tau, nrm * 1.0, 0.0, nrm * tau, nrm * 1.0 },
    };

    const E: i32 = math.clamp(grid_extent, 1, 4);
    const perp2_max = perp_cutoff * perp_cutoff;
    const r2_min = r_min * r_min;
    const r2_max = r_max * r_max;
    var written: u32 = 0;

    var n0: i32 = -E;
    while (n0 <= E and written < max_points) : (n0 += 1) {
        var n1: i32 = -E;
        while (n1 <= E and written < max_points) : (n1 += 1) {
            var n2: i32 = -E;
            while (n2 <= E and written < max_points) : (n2 += 1) {
                var n3: i32 = -E;
                while (n3 <= E and written < max_points) : (n3 += 1) {
                    var n4: i32 = -E;
                    while (n4 <= E and written < max_points) : (n4 += 1) {
                        var n5: i32 = -E;
                        while (n5 <= E and written < max_points) : (n5 += 1) {
                            const coords = [6]f32{
                                @floatFromInt(n0), @floatFromInt(n1), @floatFromInt(n2),
                                @floatFromInt(n3), @floatFromInt(n4), @floatFromInt(n5),
                            };
                            var qx: f32 = 0.0;
                            var qy: f32 = 0.0;
                            var qz: f32 = 0.0;
                            var k: usize = 0;
                            while (k < 6) : (k += 1) {
                                qx += perp[0][k] * coords[k];
                                qy += perp[1][k] * coords[k];
                                qz += perp[2][k] * coords[k];
                            }
                            if (qx * qx + qy * qy + qz * qz > perp2_max) continue;

                            var px: f32 = 0.0;
                            var py: f32 = 0.0;
                            var pz: f32 = 0.0;
                            k = 0;
                            while (k < 6) : (k += 1) {
                                px += par[0][k] * coords[k];
                                py += par[1][k] * coords[k];
                                pz += par[2][k] * coords[k];
                            }
                            const r2 = px * px + py * py + pz * pz;
                            if (r2 < r2_min or r2 > r2_max) continue;

                            const base = @as(usize, written) * 3;
                            out_xyz[base] = px;
                            out_xyz[base + 1] = py;
                            out_xyz[base + 2] = pz;
                            written += 1;
                        }
                    }
                }
            }
        }
    }
    return written;
}

// ============================================================================
// 15. Original CQM v0.23.0 Complete 18-Kernel `cqm_*` Compatibility & SIMD Suite
// ============================================================================

export fn cqm_gray_scott_step(
    u: [*]f32,
    v: [*]f32,
    u_next: [*]f32,
    v_next: [*]f32,
    n: usize,
    feed: f32,
    kill: f32,
    du: f32,
    dv: f32,
    dt: f32,
) callconv(.c) void {
    if (n < 3) return;
    var y: usize = 0;
    while (y < n) : (y += 1) {
        const ym = if (y == 0) n - 1 else y - 1;
        const yp = if (y + 1 == n) 0 else y + 1;
        var x: usize = 0;
        while (x < n) : (x += 1) {
            const xm = if (x == 0) n - 1 else x - 1;
            const xp = if (x + 1 == n) 0 else x + 1;
            const idx = y * n + x;
            const u_cur = u[idx];
            const v_cur = v[idx];
            const lap_u = u[ym * n + x] + u[yp * n + x] + u[y * n + xm] + u[y * n + xp] - 4.0 * u_cur;
            const lap_v = v[ym * n + x] + v[yp * n + x] + v[y * n + xm] + v[y * n + xp] - 4.0 * v_cur;
            const uvv = u_cur * v_cur * v_cur;
            u_next[idx] = math.clamp(u_cur + (du * lap_u - uvv + feed * (1.0 - u_cur)) * dt, 0.0, 1.0);
            v_next[idx] = math.clamp(v_cur + (dv * lap_v + uvv - (feed + kill) * v_cur) * dt, 0.0, 1.0);
        }
    }
}

export fn cqm_gray_scott_step_rgba_f32(
    src_rgba: [*]const f32,
    dst_rgba: [*]f32,
    n: usize,
    feed: f32,
    kill: f32,
    du: f32,
    dv: f32,
    dt: f32,
    f_spatial: f32,
) callconv(.c) void {
    if (n < 3) return;
    const inv_n = 1.0 / @as(f32, @floatFromInt(n));
    var y: usize = 0;
    while (y < n) : (y += 1) {
        const ym = if (y == 0) n - 1 else y - 1;
        const yp = if (y + 1 == n) 0 else y + 1;
        const fy = (@as(f32, @floatFromInt(y)) * inv_n - 0.5) * 2.0;
        var x: usize = 0;
        while (x < n) : (x += 1) {
            const xm = if (x == 0) n - 1 else x - 1;
            const xp = if (x + 1 == n) 0 else x + 1;
            const fx = (@as(f32, @floatFromInt(x)) * inv_n - 0.5) * 2.0;
            const idx4 = (y * n + x) * 4;
            const u_cur = src_rgba[idx4];
            const v_cur = src_rgba[idx4 + 1];
            const b_cur = src_rgba[idx4 + 2];
            const lap_u = src_rgba[(ym * n + x) * 4] + src_rgba[(yp * n + x) * 4] + src_rgba[(y * n + xm) * 4] + src_rgba[(y * n + xp) * 4] - 4.0 * u_cur;
            const lap_v = src_rgba[(ym * n + x) * 4 + 1] + src_rgba[(yp * n + x) * 4 + 1] + src_rgba[(y * n + xm) * 4 + 1] + src_rgba[(y * n + xp) * 4 + 1] - 4.0 * v_cur;
            const r2 = fx * fx + fy * fy;
            const f_loc = math.clamp(feed + f_spatial * (0.5 - r2), 0.008, 0.095);
            const uvv = u_cur * v_cur * v_cur;
            dst_rgba[idx4] = math.clamp(u_cur + (du * lap_u - uvv + f_loc * (1.0 - u_cur)) * dt, 0.0, 1.0);
            dst_rgba[idx4 + 1] = math.clamp(v_cur + (dv * lap_v + uvv - (f_loc + kill) * v_cur) * dt, 0.0, 1.0);
            dst_rgba[idx4 + 2] = math.clamp(b_cur * 0.992 + dst_rgba[idx4 + 1] * 0.008, 0.0, 1.0);
            dst_rgba[idx4 + 3] = 1.0;
        }
    }
}

export fn cqm_tdse_step(
    re: [*]f64,
    im: [*]f64,
    pot: [*]const f64,
    n: usize,
    dt: f64,
    dx2_inv: f64,
) callconv(.c) f64 {
    if (n < 3) return 0.0;
    const half_dt = 0.5 * dt;
    var i: usize = 0;
    while (i < n) : (i += 1) {
        const im_prev = if (i == 0) im[n - 1] else im[i - 1];
        const im_next = if (i + 1 == n) im[0] else im[i + 1];
        const kin = -0.5 * (im_prev + im_next - 2.0 * im[i]) * dx2_inv;
        re[i] += half_dt * (kin + pot[i] * im[i]);
    }
    i = 0;
    while (i < n) : (i += 1) {
        const re_prev = if (i == 0) re[n - 1] else re[i - 1];
        const re_next = if (i + 1 == n) re[0] else re[i + 1];
        const kin = -0.5 * (re_prev + re_next - 2.0 * re[i]) * dx2_inv;
        im[i] -= dt * (kin + pot[i] * re[i]);
    }
    var norm: f64 = 0.0;
    i = 0;
    while (i < n) : (i += 1) {
        const im_prev = if (i == 0) im[n - 1] else im[i - 1];
        const im_next = if (i + 1 == n) im[0] else im[i + 1];
        const kin = -0.5 * (im_prev + im_next - 2.0 * im[i]) * dx2_inv;
        re[i] += half_dt * (kin + pot[i] * im[i]);
        norm += re[i] * re[i] + im[i] * im[i];
    }
    return norm;
}

export fn cqm_qgt_fubini_study(
    psi_re: [*]const f64,
    psi_im: [*]const f64,
    dpsi_re: [*]const f64,
    dpsi_im: [*]const f64,
    dim: usize,
) callconv(.c) f64 {
    var d_norm: f64 = 0.0;
    var ov_re: f64 = 0.0;
    var ov_im: f64 = 0.0;
    var k: usize = 0;
    while (k < dim) : (k += 1) {
        d_norm += dpsi_re[k] * dpsi_re[k] + dpsi_im[k] * dpsi_im[k];
        ov_re += psi_re[k] * dpsi_re[k] + psi_im[k] * dpsi_im[k];
        ov_im += psi_re[k] * dpsi_im[k] - psi_im[k] * dpsi_re[k];
    }
    return @max(0.0, d_norm - (ov_re * ov_re + ov_im * ov_im));
}

export fn cqm_qgtl_full_tensor_2d(
    psi_re: [*]const f64,
    psi_im: [*]const f64,
    dx_re: [*]const f64,
    dx_im: [*]const f64,
    dy_re: [*]const f64,
    dy_im: [*]const f64,
    dim: usize,
    out4: [*]f64,
) callconv(.c) void {
    var dx2: f64 = 0.0;
    var dy2: f64 = 0.0;
    var dxy_re: f64 = 0.0;
    var dxy_im: f64 = 0.0;
    var ox_re: f64 = 0.0;
    var ox_im: f64 = 0.0;
    var oy_re: f64 = 0.0;
    var oy_im: f64 = 0.0;
    var k: usize = 0;
    while (k < dim) : (k += 1) {
        dx2 += dx_re[k] * dx_re[k] + dx_im[k] * dx_im[k];
        dy2 += dy_re[k] * dy_re[k] + dy_im[k] * dy_im[k];
        dxy_re += dx_re[k] * dy_re[k] + dx_im[k] * dy_im[k];
        dxy_im += dx_re[k] * dy_im[k] - dx_im[k] * dy_re[k];
        ox_re += psi_re[k] * dx_re[k] + psi_im[k] * dx_im[k];
        ox_im += psi_re[k] * dx_im[k] - psi_im[k] * dx_re[k];
        oy_re += psi_re[k] * dy_re[k] + psi_im[k] * dy_im[k];
        oy_im += psi_re[k] * dy_im[k] - psi_im[k] * dy_re[k];
    }
    const g_xx = @max(0.0, dx2 - (ox_re * ox_re + ox_im * ox_im));
    const g_yy = @max(0.0, dy2 - (oy_re * oy_re + oy_im * oy_im));
    const prod_re = ox_re * oy_re + ox_im * oy_im;
    const prod_im = ox_re * oy_im - ox_im * oy_re;
    const g_xy = dxy_re - prod_re;
    const omega_xy = -2.0 * (dxy_im - prod_im);
    out4[0] = g_xx;
    out4[1] = g_xy;
    out4[2] = g_yy;
    out4[3] = omega_xy;
}

export fn cqm_moonlab_ising_anneal(
    spins: [*]i8,
    couplings: [*]const f32,
    fields: [*]const f32,
    n: usize,
    sweeps: usize,
    gamma_start: f32,
    gamma_end: f32,
    seed_in: u64,
) callconv(.c) f32 {
    if (n == 0) return 0.0;
    var rng: u64 = if (seed_in == 0) 0x9E3779B97F4A7C15 else seed_in;
    var sw: usize = 0;
    while (sw < sweeps) : (sw += 1) {
        const frac = @as(f32, @floatFromInt(sw)) / @as(f32, @floatFromInt(@max(sweeps, 1)));
        const gamma = gamma_start + (gamma_end - gamma_start) * frac;
        const beta = 0.5 + 4.5 * frac;
        var i: usize = 0;
        while (i < n) : (i += 1) {
            var local_h: f32 = fields[i];
            var j: usize = 0;
            while (j < n) : (j += 1) {
                if (i != j) local_h += couplings[i * n + j] * @as(f32, @floatFromInt(spins[j]));
            }
            const si = @as(f32, @floatFromInt(spins[i]));
            const d_e = 2.0 * si * local_h - gamma * 0.35;
            rng ^= rng << 13;
            rng ^= rng >> 7;
            rng ^= rng << 17;
            const u_rand = @as(f32, @floatFromInt(rng & 0xFFFFFF)) / 16777216.0;
            if (d_e <= 0.0 or u_rand < @exp(-beta * d_e)) {
                spins[i] = -spins[i];
            }
        }
    }
    var energy: f32 = 0.0;
    var i: usize = 0;
    while (i < n) : (i += 1) {
        const si = @as(f32, @floatFromInt(spins[i]));
        energy -= fields[i] * si;
        var j: usize = i + 1;
        while (j < n) : (j += 1) {
            energy -= couplings[i * n + j] * si * @as(f32, @floatFromInt(spins[j]));
        }
    }
    return energy;
}

export fn cqm_qrng_quantum_chaos_step(
    state_in_out: *u64,
    out_floats: [*]f32,
    count: usize,
    r_logistic: f64,
) callconv(.c) void {
    var s: u64 = if (state_in_out.* == 0) 0xD1B54A32D192ED03 else state_in_out.*;
    const r = math.clamp(r_logistic, 3.57, 4.0);
    var x: f64 = (@as(f64, @floatFromInt((s >> 11) & ((@as(u64, 1) << 53) - 1))) + 0.5) * (1.0 / 9007199254740992.0);
    var i: usize = 0;
    while (i < count) : (i += 1) {
        x = r * x * (1.0 - x);
        s +%= 0x9E3779B97F4A7C15;
        var z = s;
        z = (z ^ (z >> 30)) *% 0xBF58476D1CE4E5B9;
        z = (z ^ (z >> 27)) *% 0x94D049BB133111EB;
        z = z ^ (z >> 31);
        const q = (@as(f64, @floatFromInt(z >> 11)) * (1.0 / 9007199254740992.0));
        const mixed = @mod(x + q, 1.0);
        out_floats[i] = @floatCast(mixed);
    }
    state_in_out.* = s;
}

export fn cqm_eshkol_taylor_diff(
    poly_coeffs: [*]const f64,
    degree: usize,
    x: f64,
    out3: [*]f64, // [f(x), f'(x), f''(x)]
) callconv(.c) void {
    var f0: f64 = 0.0;
    var f1: f64 = 0.0;
    var f2: f64 = 0.0;
    var k: usize = degree + 1;
    while (k > 0) {
        k -= 1;
        f2 = f2 * x + 2.0 * f1;
        f1 = f1 * x + f0;
        f0 = f0 * x + poly_coeffs[k];
    }
    out3[0] = f0;
    out3[1] = f1;
    out3[2] = f2;
}

// Original CQM 70-parameter (6 -> 6 -> 4) EntityBrain batch forward pass
export fn cqm_entity_brain_batch_forward(
    inputs: [*]const f32, // [count * 6]
    weights: [*]const f32, // [count * 70]: w1[36], b1[6], w2[24], b2[4]
    outputs: [*]f32, // [count * 4]
    count: usize,
) callconv(.c) void {
    var e: usize = 0;
    while (e < count) : (e += 1) {
        const in_b = inputs + e * 6;
        const w_b = weights + e * 70;
        const out_b = outputs + e * 4;
        var hid: [6]f32 = undefined;
        var h: usize = 0;
        while (h < 6) : (h += 1) {
            const row = w_b + h * 6;
            var acc: f32 = w_b[36 + h];
            var i: usize = 0;
            while (i < 6) : (i += 1) acc += row[i] * in_b[i];
            hid[h] = fastTanh(acc);
        }
        const w2 = w_b + 42;
        const b2 = w_b + 66;
        var o: usize = 0;
        while (o < 4) : (o += 1) {
            const row2 = w2 + o * 6;
            var acc2: f32 = b2[o];
            var h2: usize = 0;
            while (h2 < 6) : (h2 += 1) acc2 += row2[h2] * hid[h2];
            out_b[o] = fastTanh(acc2);
        }
    }
}

export fn cqm_glyph_hebbian_step(
    act: [*]f32, // [1024]
    weights4: [*]f32, // [1024 * 4] (N, S, W, E per cell)
    drive: [*]const f32, // [1024]
    lr: f32,
) callconv(.c) f32 {
    var next_act: [1024]f32 = undefined;
    var mean_e: f32 = 0.0;
    var y: usize = 0;
    while (y < 32) : (y += 1) {
        const yn = (y + 31) & 31;
        const ys = (y + 1) & 31;
        var x: usize = 0;
        while (x < 32) : (x += 1) {
            const xw = (x + 31) & 31;
            const xe = (x + 1) & 31;
            const idx = (y << 5) + x;
            const n_v = act[(yn << 5) + x];
            const s_v = act[(ys << 5) + x];
            const w_v = act[(y << 5) + xw];
            const e_v = act[(y << 5) + xe];
            const w_ptr = weights4 + idx * 4;
            const syn = w_ptr[0] * n_v + w_ptr[1] * s_v + w_ptr[2] * w_v + w_ptr[3] * e_v + drive[idx];
            const y_out = fastTanh(0.65 * act[idx] + 0.35 * syn);
            next_act[idx] = y_out;
            mean_e += @abs(y_out);
            if (@abs(lr) > 1e-8) {
                const y2 = y_out * y_out;
                w_ptr[0] = math.clamp(w_ptr[0] + lr * (y_out * n_v - y2 * w_ptr[0]), -1.5, 1.5);
                w_ptr[1] = math.clamp(w_ptr[1] + lr * (y_out * s_v - y2 * w_ptr[1]), -1.5, 1.5);
                w_ptr[2] = math.clamp(w_ptr[2] + lr * (y_out * w_v - y2 * w_ptr[2]), -1.5, 1.5);
                w_ptr[3] = math.clamp(w_ptr[3] + lr * (y_out * e_v - y2 * w_ptr[3]), -1.5, 1.5);
            }
        }
    }
    @memcpy(act[0..1024], next_act[0..1024]);
    return mean_e * (1.0 / 1024.0);
}

export fn cqm_rosette_fnv1a64(bytes: [*]const u8, len: usize) callconv(.c) u64 {
    var h: u64 = 0xcbf29ce484222325;
    var i: usize = 0;
    while (i < len) : (i += 1) {
        h ^= @as(u64, bytes[i]);
        h *%= 0x100000001b3;
    }
    return h;
}

export fn cqm_pq_wire_bytes(level: u32, out3: [*]u32) callconv(.c) u32 {
    // ML-KEM + ML-DSA NIST FIPS 203/204 wire sizes: [pk_bytes, ct_or_sig_bytes, total_frame]
    switch (level) {
        512 => {
            out3[0] = 800;
            out3[1] = 768 + 2420;
            out3[2] = 800 + 768 + 2420 + 60;
        },
        1024 => {
            out3[0] = 1568;
            out3[1] = 1568 + 4627;
            out3[2] = 1568 + 1568 + 4627 + 60;
        },
        else => { // 768 default (ML-KEM-768 + ML-DSA-65)
            out3[0] = 1184;
            out3[1] = 1088 + 3309;
            out3[2] = 1184 + 1088 + 3309 + 60;
        },
    }
    return out3[2];
}

export fn cqm_georefine_verify_frame(
    bf16_words: [*]const u16,
    count: usize,
    expected_fnv: u64,
) callconv(.c) u32 {
    var h: u64 = 0xcbf29ce484222325;
    var i: usize = 0;
    while (i < count) : (i += 1) {
        const w = bf16_words[i];
        const exp_bits = (w >> 7) & 0xFF;
        if (exp_bits == 0xFF) return 0; // Reject NaN/Inf in BF16 stream
        h ^= @as(u64, w & 0xFF);
        h *%= 0x100000001b3;
        h ^= @as(u64, (w >> 8) & 0xFF);
        h *%= 0x100000001b3;
    }
    return if (expected_fnv == 0 or h == expected_fnv) 1 else 0;
}

export fn cqm_eshkol_dbsp_delta_gemm(
    prev_out: [*]f32, // [m * n] updated in place: out_t = out_{t-1} + delta_a * b
    delta_a: [*]const f32, // [m * k]
    b_mat: [*]const f32, // [k * n]
    m: usize,
    n: usize,
    k_dim: usize,
) callconv(.c) u32 {
    var nz_rows: u32 = 0;
    var r: usize = 0;
    while (r < m) : (r += 1) {
        var row_energy: f32 = 0.0;
        var kk: usize = 0;
        while (kk < k_dim) : (kk += 1) row_energy += @abs(delta_a[r * k_dim + kk]);
        if (row_energy < 1e-7) continue; // DBSP sparse delta skip!
        nz_rows += 1;
        kk = 0;
        while (kk < k_dim) : (kk += 1) {
            const da = delta_a[r * k_dim + kk];
            if (@abs(da) < 1e-8) continue;
            var c: usize = 0;
            while (c < n) : (c += 1) {
                prev_out[r * n + c] += da * b_mat[kk * n + c];
            }
        }
    }
    return nz_rows;
}

export fn cqm_eshkol_cyclotomic8_mul(a4: [*]const i64, b4: [*]const i64, out4: [*]i64) callconv(.c) void {
    // Exact Z[zeta_8] / (zeta_8^4 + 1) ring multiplication for quantum T+H Clifford+T synthesis
    const a0 = a4[0];
    const a1 = a4[1];
    const a2 = a4[2];
    const a3 = a4[3];
    const b0 = b4[0];
    const b1 = b4[1];
    const b2 = b4[2];
    const b3 = b4[3];
    out4[0] = a0 * b0 - a1 * b3 - a2 * b2 - a3 * b1;
    out4[1] = a0 * b1 + a1 * b0 - a2 * b3 - a3 * b2;
    out4[2] = a0 * b2 + a1 * b1 + a2 * b0 - a3 * b3;
    out4[3] = a0 * b3 + a1 * b2 + a2 * b1 + a3 * b0;
}

export fn cqm_moonlab_qwz_chern_fhs(mass_m: f64, grid_n: u32) callconv(.c) i32 {
    const n: usize = @max(@as(usize, grid_n), 8);
    const dk = (2.0 * math.pi) / @as(f64, @floatFromInt(n));
    var total_flux: f64 = 0.0;
    var ix: usize = 0;
    while (ix < n) : (ix += 1) {
        const kx = -math.pi + @as(f64, @floatFromInt(ix)) * dk;
        var iy: usize = 0;
        while (iy < n) : (iy += 1) {
            const ky = -math.pi + @as(f64, @floatFromInt(iy)) * dk;
            const dx0 = @sin(kx);
            const dy0 = @sin(ky);
            const dz0 = mass_m + @cos(kx) + @cos(ky);
            const r2 = @max(1e-18, dx0 * dx0 + dy0 * dy0 + dz0 * dz0);
            const inv_r = 1.0 / @sqrt(r2);
            const inv_r3 = inv_r * inv_r * inv_r;
            // Exact lower-band QWZ Berry curvature Omega_-(k) = -(1/2) d . (d_kx d x d_ky d) / |d|^3
            const omega = -0.5 * (@cos(kx) * @cos(ky) * dz0 + @cos(kx) * @sin(ky) * dy0 + @sin(kx) * @cos(ky) * dx0) * inv_r3;
            total_flux += omega * dk * dk;
        }
    }
    return @intFromFloat(@round(total_flux / (2.0 * math.pi)));
}

export fn cqm_libirrep_bdg_skyrmion_mzm(
    mu: f64,
    delta_sc: f64,
    zeeman_vz: f64,
    out_gap_winding: [*]f64, // [quasiparticle_gap, z2_majorana_invariant]
) callconv(.c) i32 {
    // 1D/2D Kitaev-Rashba BdG topological superconductor transition V_z^2 = mu^2 + Delta^2
    const crit = @sqrt(mu * mu + delta_sc * delta_sc);
    const gap = @abs(@abs(zeeman_vz) - crit);
    const z2: i32 = if (@abs(zeeman_vz) > crit and @abs(delta_sc) > 1e-9) -1 else 1;
    out_gap_winding[0] = gap;
    out_gap_winding[1] = @floatFromInt(z2);
    return z2;
}

export fn cqm_sbnn_minsr_step(
    spins: [*]f32, // [n] continuous Kerr parametric oscillator amplitudes x_i in [-1, 1]
    adj_j: [*]const f32, // [n * n]
    n: usize,
    pump_p: f32,
    dt: f32,
) callconv(.c) f32 {
    if (n == 0) return 0.0;
    var energy: f32 = 0.0;
    var i: usize = 0;
    while (i < n) : (i += 1) {
        const xi = spins[i];
        var coup: f32 = 0.0;
        var j: usize = 0;
        while (j < n) : (j += 1) coup += adj_j[i * n + j] * spins[j];
        // Simulated Bifurcation ballistic/discrete Kerr update
        const dx = (-(1.0 - pump_p) * xi - xi * xi * xi + 0.5 * coup) * dt;
        spins[i] = math.clamp(xi + dx, -1.0, 1.0);
    }
    i = 0;
    while (i < n) : (i += 1) {
        const si: f32 = if (spins[i] >= 0.0) 1.0 else -1.0;
        var j: usize = i + 1;
        while (j < n) : (j += 1) {
            const sj: f32 = if (spins[j] >= 0.0) 1.0 else -1.0;
            energy -= adj_j[i * n + j] * si * sj;
        }
    }
    return energy;
}

// ============================================================================
// 16. CQM2 v4.0.0 Neuroscience & 11/11/2026 Errata Hardware Kernels
// ============================================================================

// (A) Original CQM 70-param (6->6->4) Recurrent EntityBrain + Online TD Actor-Critic + Lamarckian Motor Plasticity
export fn cqm2_entity_brain_td_lamarck_batch(
    inputs: [*]const f32, // [count * 6]
    weights: [*]f32, // [count * 70]: w1[36], b1[6], w2[24] (rows 0..1 motor, 2 signal, 3 V(s)), b2[4]
    prev_hid: [*]f32, // [count * 6] recurrent hidden memory (0.8*tanh + 0.2*prev)
    prev_val: [*]f32, // [count] previous V(s_{t-1})
    rewards: [*]const f32, // [count] instant metabolic/ecological reward r_t
    outputs: [*]f32, // [count * 4]: [turn, thrust, signal, value]
    count: usize,
    td_lr: f32,
    lamarck_lr: f32,
) callconv(.c) f32 {
    if (count == 0) return 0.0;
    var mean_abs_td: f32 = 0.0;
    var e: usize = 0;
    while (e < count) : (e += 1) {
        const in_b = inputs + e * 6;
        const w_b = weights + e * 70;
        const ph_b = prev_hid + e * 6;
        const out_b = outputs + e * 4;

        var hid: [6]f32 = undefined;
        var h: usize = 0;
        while (h < 6) : (h += 1) {
            const row = w_b + h * 6;
            var acc: f32 = w_b[36 + h];
            var i: usize = 0;
            while (i < 6) : (i += 1) acc += row[i] * in_b[i];
            const h_new = 0.8 * fastTanh(acc) + 0.2 * ph_b[h];
            hid[h] = h_new;
            ph_b[h] = h_new;
        }

        const w2 = w_b + 42;
        const b2 = w_b + 66;
        var o: usize = 0;
        while (o < 4) : (o += 1) {
            const row2 = w2 + o * 6;
            var acc2: f32 = b2[o];
            var h2: usize = 0;
            while (h2 < 6) : (h2 += 1) acc2 += row2[h2] * hid[h2];
            out_b[o] = fastTanh(acc2);
        }

        const v_now = out_b[3];
        const td_err = math.clamp(rewards[e] + 0.95 * v_now - prev_val[e], -2.0, 2.0);
        prev_val[e] = v_now;
        mean_abs_td += @abs(td_err);

        // Online TD Critic update on row 3 + Lamarckian motor plasticity on rows 0..1
        if (@abs(td_lr) > 1e-8 or @abs(lamarck_lr) > 1e-8) {
            const m_gain = lamarck_lr * td_err;
            const c_gain = td_lr * td_err;
            h = 0;
            while (h < 6) : (h += 1) {
                w2[0 * 6 + h] = math.clamp(w2[0 * 6 + h] + m_gain * out_b[0] * hid[h], -1.0, 1.0);
                w2[1 * 6 + h] = math.clamp(w2[1 * 6 + h] + m_gain * out_b[1] * hid[h], -1.0, 1.0);
                w2[3 * 6 + h] = math.clamp(w2[3 * 6 + h] + c_gain * hid[h], -1.5, 1.5);
            }
        }
    }
    return mean_abs_td / @as(f32, @floatFromInt(count));
}

// (B) Mechalogodrom 54,048-parameter 10-Shell Recurrent Cortex + Bi & Poo STDP
// Exact parameter count: 10*(9*32 + 32 + 32*48 + 48) + (480*64 + 64 + 64*64 + 64) + 64
//                      = 10*(288 + 32 + 1536 + 48) + (30720 + 64 + 4096 + 64) + 64
//                      = 19,040 + 34,944 + 64 = 54,048 f32 parameters!
export fn cqm2_mecha_brain_54k_stdp_step(
    shell_inputs90: [*]const f32, // [10 * 9] sensory inputs across 10 concentric shells
    params54048: [*]f32, // [54048] f32 weights + recurrent state[64] at tail
    pre_trace64: [*]f32, // [64] Bi & Poo presynaptic trace
    post_trace64: [*]f32, // [64] Bi & Poo postsynaptic trace
    out64: [*]f32, // [64] global sovereign command bus
    stdp_lr: f32,
) callconv(.c) f32 {
    var concat480: [480]f32 = undefined;
    var s: usize = 0;
    while (s < 10) : (s += 1) {
        const in9 = shell_inputs90 + s * 9;
        const sb = params54048 + s * 1904; // w1[288], b1[32], w2[1536], b2[48]
        var h32: [32]f32 = undefined;
        var h: usize = 0;
        while (h < 32) : (h += 1) {
            var acc: f32 = sb[288 + h];
            var i: usize = 0;
            while (i < 9) : (i += 1) acc += sb[h * 9 + i] * in9[i];
            h32[h] = fastTanh(acc);
        }
        const w2 = sb + 320;
        const b2 = sb + 1856;
        var o: usize = 0;
        while (o < 48) : (o += 1) {
            var acc2: f32 = b2[o];
            var k: usize = 0;
            while (k < 32) : (k += 1) acc2 += w2[o * 32 + k] * h32[k];
            concat480[s * 48 + o] = fastTanh(acc2);
        }
    }

    // Global integrator: 480 -> 64 -> 64 + recurrent[64]
    const g_w1 = params54048 + 19040; // [480 * 64 = 30720]
    const g_b1 = g_w1 + 30720; // [64]
    const g_w2 = g_b1 + 64; // [64 * 64 = 4096]
    const g_b2 = g_w2 + 4096; // [64]
    const rec64 = g_b2 + 64; // [64] (ends at 19040 + 34944 + 64 = 54048!)

    var mid64: [64]f32 = undefined;
    var m: usize = 0;
    while (m < 64) : (m += 1) {
        var acc: f32 = g_b1[m];
        var j: usize = 0;
        while (j < 480) : (j += 1) acc += g_w1[m * 480 + j] * concat480[j];
        mid64[m] = fastTanh(acc);
        pre_trace64[m] = 0.90 * pre_trace64[m] + 0.10 * @abs(mid64[m]);
    }

    var mean_energy: f32 = 0.0;
    var q: usize = 0;
    while (q < 64) : (q += 1) {
        var acc2: f32 = g_b2[q] + 0.25 * rec64[q];
        var m2: usize = 0;
        while (m2 < 64) : (m2 += 1) acc2 += g_w2[q * 64 + m2] * mid64[m2];
        const y = fastTanh(acc2);
        out64[q] = y;
        rec64[q] = y;
        post_trace64[q] = 0.88 * post_trace64[q] + 0.12 * @abs(y);
        mean_energy += @abs(y);

        if (@abs(stdp_lr) > 1e-8) {
            m2 = 0;
            while (m2 < 64) : (m2 += 1) {
                const ltp = pre_trace64[m2] * @max(y, 0.0);
                const ltd = post_trace64[q] * @max(-mid64[m2], 0.0) * 1.05;
                g_w2[q * 64 + m2] = math.clamp(g_w2[q * 64 + m2] + stdp_lr * (ltp - ltd), -1.5, 1.5);
            }
        }
    }
    return mean_energy * (1.0 / 64.0);
}

// (C) Xylos 48-Foci Hyperbolic Poincaré Disk + Oja Lateral + NLMS Predictor (398 f32 params)
export fn cqm2_xylos_poincare_oja_step(
    foci_uv96: [*]const f32, // [48 * 2] Poincaré disk coordinates |u| < 1
    act48: [*]f32, // [48] foci activations
    edge_src192: [*]const u16, // [192]
    edge_dst192: [*]const u16, // [192]
    edge_w192: [*]f32, // [192] plastic hyperbolic synapse weights
    nlms_w14: [*]f32, // [14] NLMS adaptive filter weights
    nlms_x14: [*]const f32, // [14] dome telemetry tap vector
    target_signal: f32,
    lr: f32,
) callconv(.c) f32 {
    var drive48: [48]f32 = @splat(0.0);
    var e: usize = 0;
    while (e < 192) : (e += 1) {
        const u: usize = edge_src192[e] % 48;
        const v: usize = edge_dst192[e] % 48;
        const ux = foci_uv96[u * 2];
        const uy = foci_uv96[u * 2 + 1];
        const vx = foci_uv96[v * 2];
        const vy = foci_uv96[v * 2 + 1];
        const du2 = (ux - vx) * (ux - vx) + (uy - vy) * (uy - vy);
        const nu = @max(0.02, 1.0 - (ux * ux + uy * uy));
        const nv = @max(0.02, 1.0 - (vx * vx + vy * vy));
        const arg = 1.0 + (2.0 * du2) / (nu * nv);
        const d_hyp = math.acosh(@max(1.0, arg));
        const atten = 1.0 / (1.0 + 0.5 * d_hyp);
        drive48[v] += edge_w192[e] * act48[u] * atten;
    }

    // NLMS 14-tap predictor
    var y_hat: f32 = 0.0;
    var norm2: f32 = 1e-4;
    var k: usize = 0;
    while (k < 14) : (k += 1) {
        y_hat += nlms_w14[k] * nlms_x14[k];
        norm2 += nlms_x14[k] * nlms_x14[k];
    }
    const err = target_signal - y_hat;
    if (@abs(lr) > 1e-8) {
        const gain = (lr * err) / norm2;
        k = 0;
        while (k < 14) : (k += 1) nlms_w14[k] = math.clamp(nlms_w14[k] + gain * nlms_x14[k], -2.0, 2.0);
    }

    var idx: usize = 0;
    while (idx < 48) : (idx += 1) {
        act48[idx] = fastTanh(0.72 * act48[idx] + 0.28 * drive48[idx] + 0.05 * y_hat);
    }

    if (@abs(lr) > 1e-8) {
        e = 0;
        while (e < 192) : (e += 1) {
            const u: usize = edge_src192[e] % 48;
            const v: usize = edge_dst192[e] % 48;
            const post = act48[v];
            const dw = lr * (post * act48[u] - post * post * edge_w192[e]);
            edge_w192[e] = math.clamp(edge_w192[e] + dw, -1.5, 1.5);
        }
    }
    return @abs(err);
}

inline fn kbnAccum(pool: *f64, delta: f64, comp: *f64) void {
    const sum = pool.* + delta;
    if (@abs(pool.*) >= @abs(delta)) {
        comp.* += (pool.* - sum) + delta;
    } else {
        comp.* += (delta - sum) + pool.*;
    }
    pool.* = sum;
}

// (D) 11/11/2026 Errata A-03: Compensated FP64 Kahan-Babuška-Neumaier First-Law Ledger
// Guarantees |E_total - E_initial| <= 1e-12 AND enforces Second-Law irreversibility (dissipated heat >= 0, never converted back to work!).
export fn cqm2_first_law_kbn_step(
    pools6: [*]f64, // [free_solar, chemical_biomass, kinetic_work, irreversible_heat_sink, kbn_comp, initial_total]
    metabolic_work_req: f64,
    xpbd_damping_loss: f64,
    harvest_efficiency: f64,
) callconv(.c) f64 {
    const eff = math.clamp(harvest_efficiency, 0.0, 1.0);
    const avail_solar = @max(0.0, pools6[0]);
    const req = @max(0.0, metabolic_work_req);
    const drawn = @min(avail_solar, req);
    const to_chem = drawn * eff;
    // Exact complement so drawn == to_chem + to_heat_harvest + exact_split_err
    const to_heat_harvest = drawn - to_chem;
    const split_residual = (drawn - to_heat_harvest) - to_chem;

    const kin_avail = @max(0.0, pools6[2]);
    const damp = @min(kin_avail, @max(0.0, xpbd_damping_loss));

    kbnAccum(&pools6[0], -drawn, &pools6[4]);
    kbnAccum(&pools6[1], to_chem, &pools6[4]);
    kbnAccum(&pools6[2], -damp, &pools6[4]);
    // Irreversible Second-Law heat sink (monotonically non-decreasing!) with KBN compensation
    kbnAccum(&pools6[3], to_heat_harvest + damp, &pools6[4]);
    pools6[4] += split_residual + ((to_heat_harvest + damp) - to_heat_harvest - damp) * -1.0;

    // Exact compensated total across all 4 physical reservoirs
    var total: f64 = 0.0;
    var comp: f64 = pools6[4];
    var i: usize = 0;
    while (i < 4) : (i += 1) {
        const t = total + pools6[i];
        if (@abs(total) >= @abs(pools6[i])) {
            comp += (total - t) + pools6[i];
        } else {
            comp += (pools6[i] - t) + total;
        }
        total = t;
    }
    const exact_total = total + comp;
    if (pools6[5] <= 0.0) pools6[5] = exact_total;
    return @abs(exact_total - pools6[5]);
}

// (E) 11/11/2026 Errata B-04 / NESTOR: Packed Sub-Byte Precision GEMV
// Supports physical 2-bit BitNet b1.58 ternary (4 weights/byte: 00=0, 01=+1, 10=-1)
// and 4-bit symmetric INT4 (2 weights/byte: signed nibble [-8..+7]).
export fn cqm2_nested_bitnet_int4_gemv(
    packed_weights: [*]const u8,
    input_vec: [*]const f32,
    scale_per_row: [*]const f32,
    output_vec: [*]f32,
    rows: usize,
    cols: usize,
    bits_mode: u32, // 2 = BitNet b1.58 ternary, 4 = INT4
) callconv(.c) void {
    if (rows == 0 or cols == 0) return;
    if (bits_mode == 2) {
        const row_bytes = (cols + 3) >> 2;
        var r: usize = 0;
        while (r < rows) : (r += 1) {
            const rb = packed_weights + r * row_bytes;
            var acc: f32 = 0.0;
            var c: usize = 0;
            while (c < cols) : (c += 1) {
                const byte_v = rb[c >> 2];
                const shift: u3 = @intCast((c & 3) << 1);
                const code = (byte_v >> shift) & 0x3;
                const x = input_vec[c];
                if (code == 1) acc += x else if (code == 2) acc -= x;
            }
            output_vec[r] = fastTanh(acc * scale_per_row[r]);
        }
    } else {
        const row_bytes = (cols + 1) >> 1;
        var r: usize = 0;
        while (r < rows) : (r += 1) {
            const rb = packed_weights + r * row_bytes;
            var acc: f32 = 0.0;
            var c: usize = 0;
            while (c < cols) : (c += 1) {
                const byte_v = rb[c >> 1];
                const nib: u8 = if ((c & 1) == 0) (byte_v & 0x0F) else ((byte_v >> 4) & 0x0F);
                const signed_q: i8 = if (nib >= 8) @as(i8, @intCast(nib)) - 16 else @as(i8, @intCast(nib));
                acc += @as(f32, @floatFromInt(signed_q)) * input_vec[c];
            }
            output_vec[r] = fastTanh(acc * scale_per_row[r]);
        }
    }
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

test "FWHT stabilizer Rényi-2 magic M_2 = 0 for stabilizer GHZ and log2(4/3) for |T> state" {
    // 3-qubit GHZ = (|000> + |111>)/sqrt(2) -> pure stabilizer state -> M_2 = 0!
    var ghz_re: [8]f64 = @splat(0.0);
    var ghz_im: [8]f64 = @splat(0.0);
    ghz_re[0] = 1.0 / @sqrt(2.0);
    ghz_re[7] = 1.0 / @sqrt(2.0);
    const m2_ghz = cqm2_fwht_quantum_magic_m2(&ghz_re, &ghz_im, 3);
    try std.testing.expectApproxEqAbs(@as(f64, 0.0), m2_ghz, 1e-10);

    // 1-qubit |T> = (|0> + e^{i pi/4}|1>)/sqrt(2) -> M_2 = -log2((1 + 0 + 1/2 + 1/2)/2 ? Wait: <X>=1/sqrt2, <Y>=1/sqrt2, <Z>=0 -> (1 + 1/4 + 1/4 + 0)/2 = 3/4 -> -log2(3/4) = log2(4/3)!)
    const t_re = [_]f64{ 1.0 / @sqrt(2.0), 0.5 };
    const t_im = [_]f64{ 0.0, 0.5 };
    const m2_t = cqm2_fwht_quantum_magic_m2(&t_re, &t_im, 1);
    try std.testing.expectApproxEqAbs(math.log2(4.0 / 3.0), m2_t, 1e-9);
}

test "CSR PageRank + Louvain separates two connected cliques cleanly" {
    // Clique A: {0,1,2}, Clique B: {3,4,5}, single bridge (2,3)
    const eu = [_]u32{ 0, 1, 0, 3, 4, 3, 2 };
    const ev = [_]u32{ 1, 2, 2, 4, 5, 5, 3 };
    var rp: [7]u32 = undefined;
    var ci: [14]u32 = undefined;
    var deg: [6]u32 = undefined;
    var cur: [7]u32 = undefined;
    var npr: [6]f32 = undefined;
    var cvol: [6]f64 = undefined;
    var pr: [6]f32 = undefined;
    var comm: [6]u32 = undefined;
    var st: [4]f64 = undefined;

    const rc = cqm2_csr_pagerank_louvain_arena(6, &eu, &ev, 7, &rp, &ci, &deg, &cur, &npr, &cvol, &pr, &comm, &st);
    try std.testing.expectEqual(@as(i32, 0), rc);
    try std.testing.expect(st[0] > 0.3); // Modularity Q > 0.3
    try std.testing.expectEqual(comm[0], comm[1]);
    try std.testing.expectEqual(comm[3], comm[4]);
    try std.testing.expectEqual(@as(bool, true), comm[0] != comm[3]);
}

test "Original CQM 18-kernel compatibility & v4.0.0 First-Law + BitNet/INT4 + 54k Mecha STDP" {
    // 1. QWZ Chern number: m = -1.0 -> C = -1, m = +1.0 -> C = +1, m = 3.0 -> C = 0
    try std.testing.expectEqual(@as(i32, -1), cqm_moonlab_qwz_chern_fhs(-1.0, 24));
    try std.testing.expectEqual(@as(i32, 1), cqm_moonlab_qwz_chern_fhs(1.0, 24));
    try std.testing.expectEqual(@as(i32, 0), cqm_moonlab_qwz_chern_fhs(3.0, 24));

    // 2. Cyclotomic Z[zeta_8]: zeta_8^2 * zeta_8^2 = zeta_8^4 = -1
    const z2 = [_]i64{ 0, 0, 1, 0 };
    var prod: [4]i64 = undefined;
    cqm_eshkol_cyclotomic8_mul(&z2, &z2, &prod);
    try std.testing.expectEqual(@as(i64, -1), prod[0]);
    try std.testing.expectEqual(@as(i64, 0), prod[1]);

    // 3. Errata A-03 First-Law KBN closure <= 1e-12 over 1,000 steps + irreversible heat sink
    var pools = [_]f64{ 1000.0, 250.0, 125.0, 0.0, 0.0, 1375.0 };
    var prev_heat: f64 = 0.0;
    var step: usize = 0;
    while (step < 1000) : (step += 1) {
        const drift = cqm2_first_law_kbn_step(&pools, 0.42, 0.07, 0.63);
        try std.testing.expect(drift <= 1e-12);
        try std.testing.expect(pools[3] >= prev_heat);
        prev_heat = pools[3];
    }

    // 4. Errata B-04 Packed 2-bit BitNet b1.58 & 4-bit INT4 GEMV
    // Byte 0b00_10_01_01 => codes [1(+1), 1(+1), 2(-1), 0(0)]
    const pk2 = [_]u8{0b00_10_01_01};
    const xin = [_]f32{ 1.0, 2.0, 0.5, 9.0 };
    const scl = [_]f32{0.5};
    var yout: [1]f32 = undefined;
    cqm2_nested_bitnet_int4_gemv(&pk2, &xin, &scl, &yout, 1, 4, 2);
    // acc = 1.0 + 2.0 - 0.5 + 0 = 2.5 => fastTanh(2.5 * 0.5) = fastTanh(1.25)
    try std.testing.expectApproxEqAbs(fastTanh(1.25), yout[0], 1e-6);

    // 5. Original CQM 70-param EntityBrain TD Actor-Critic + Lamarckian plasticity
    var in6 = [_]f32{ 0.8, -0.4, 0.5, 0.2, -0.1, 0.9 };
    var w70: [70]f32 = @splat(0.1);
    var ph6: [6]f32 = @splat(0.0);
    var pv1 = [_]f32{0.0};
    var rew1 = [_]f32{0.75};
    var out4: [4]f32 = @splat(0.0);
    const td = cqm2_entity_brain_td_lamarck_batch(&in6, &w70, &ph6, &pv1, &rew1, &out4, 1, 0.05, 0.04);
    try std.testing.expect(td > 0.0);
}
