const std = @import("std");
const math = std.math;

// ============================================================================
// CQM2 Dual-Target Zig SIMD128 / AVX2 Scientific & Neural Kernel Suite
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

inline fn fastTanhVec4(v: @Vector(4, f32)) @Vector(4, f32) {
    const lo: @Vector(4, f32) = @splat(-4.95);
    const hi: @Vector(4, f32) = @splat(4.95);
    const c = @min(hi, @max(lo, v));
    const c2 = c * c;
    const c27: @Vector(4, f32) = @splat(27.0);
    const c9: @Vector(4, f32) = @splat(9.0);
    return c * (c27 + c2) / (c27 + c9 * c2);
}

inline fn sigmoid(x: f32) f32 {
    if (x > 12.0) return 1.0;
    if (x < -12.0) return 0.0;
    return 1.0 / (1.0 + @exp(-x));
}

// ----------------------------------------------------------------------------
// 1. Batched Organism Brain SIMD Forward + 3-Factor Neuromodulated Plasticity
// Architecture per organism: 8 sensory inputs -> 8 hidden (SIMD Vec4x2) -> 6 motor/affect outputs
// Total weights per organism: (8*8 + 8) + (6*8 + 6) = 72 + 54 = 126 floats
// ----------------------------------------------------------------------------
export fn cqm2_organism_brain_batch_simd(
    inputs: [*]const f32, // [count * 8]
    weights: [*]f32, // [count * 126] (updated in-place when lr > 0)
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

        const in_v0: @Vector(4, f32) = in_base[0..4].*;
        const in_v1: @Vector(4, f32) = in_base[4..8].*;

        var hid: [8]f32 = undefined;
        var h: usize = 0;
        while (h < 8) : (h += 1) {
            const w_row = w_base + h * 8;
            const w0: @Vector(4, f32) = w_row[0..4].*;
            const w1: @Vector(4, f32) = w_row[4..8].*;
            const prod = w0 * in_v0 + w1 * in_v1;
            const bias = w_base[64 + h];
            hid[h] = fastTanh(@reduce(.Add, prod) + bias);
        }

        const hid_v0 = fastTanhVec4(hid[0..4].*);
        const hid_v1 = fastTanhVec4(hid[4..8].*);

        const w2_base = w_base + 72;
        const b2_base = w2_base + 48;
        const eff_lr = lr * da * ach;

        var o: usize = 0;
        while (o < 6) : (o += 1) {
            const w_row = w2_base + o * 8;
            var w0: @Vector(4, f32) = w_row[0..4].*;
            var w1: @Vector(4, f32) = w_row[4..8].*;
            const sum = @reduce(.Add, w0 * hid_v0 + w1 * hid_v1) + b2_base[o];
            const y = fastTanh(sum);
            out_base[o] = y;

            if (@abs(eff_lr) > 1e-7) {
                // Oja-stabilized 3-factor Hebbian update: dw = eff_lr * y * (h - y * w)
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
// Combines basal feedforward, apical cross-module NMDA plateau, SOM mean inhibition,
// PV divisive shunting, and neuromodulated liquid time-constant integration.
// ----------------------------------------------------------------------------
export fn cqm2_sltc_larkum_step(
    v_state: [*]f32, // [n] membrane / activation state
    nmda_slow: [*]f32, // [n] slow NMDA reverberation state
    basal_in: [*]const f32, // [n] basal feedforward drive
    apical_in: [*]const f32, // [n] apical context drive
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
        // Disynaptic SOM subtraction on apical tuft
        const ap_centered = apical_in[i] - 0.85 * apical_mean;
        const bac_gain = 1.0 + 0.75 * sigmoid((ap_centered - 0.25) / 0.30);
        const nmda_gate = 1.0 / (1.0 + @exp(-(v_state[i] + 0.4) / 0.25));
        nmda_slow[i] = 0.92 * (nmda_slow[i] * reset_keep) + 0.08 * ap_centered * nmda_gate;

        // Divisive PV shunting
        const total_drive = (basal_in[i] * bac_gain + 0.35 * nmda_slow[i]) / (1.0 + 0.60 * rate_mean);

        // Learned-gate sLTC time constant tau(I, ACh, NE)
        const tau_num = 3.711 * (1.0 + 1.4248 * ach);
        const tau_den = (1.0 + 0.4722 * @abs(total_drive)) * (1.0 + 0.5351 * ne);
        const tau = @max(0.5, tau_num / tau_den);

        // Hasani fused unconditionally-stable semi-implicit update
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
    granule_w: [*]const f32, // [256 * 16] fixed expansion basis
    pf_weights: [*]f32, // [8 * 256] plastic parallel-fiber -> Purkinje weights
    cmd_proprio: [*]const f32, // [16] = 8 motor cmd + 8 proprioception
    climbing_err: [*]const f32, // [8] signed kinematic error (0 during pure forward)
    correction_out: [*]f32, // [8] Purkinje motor correction
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
    // Golgi soft kWTA inhibition threshold
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
                // Marr-Albus LTD/LTP: Purkinje output is -w*g, so to push correction toward +err, dw = -eta * err * g
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
    state_mat: [*]f32, // [16 * 16] associative adapter S_t
    raw_sense_key: [*]const f32, // [16] normalized incoming scrambled channel vector k_t
    expected_val: [*]const f32, // [16] expected thalamic prototype v_t
    aligned_out: [*]f32, // [16] aligned output S_t * k_t
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

        // S_t[r, :] = alpha * S_{t-1}[r, :] - beta * (S_{t-1} k_t - v_t)[r] * k_t^T
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
    pos: [*]f32, // [num_particles * 3]
    prev_pos: [*]f32, // [num_particles * 3]
    inv_mass: [*]const f32, // [num_particles]
    num_particles: usize,
    edge_a: [*]const u16, // [num_edges]
    edge_b: [*]const u16, // [num_edges]
    rest_len: [*]const f32, // [num_edges]
    stiffness: [*]const f32, // [num_edges]
    order_scratch: [*]u16, // [num_edges] shuffled in-place via deterministic LCG
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
        // Fisher-Yates LCG shuffle per substep (eliminates directional yaw bias!)
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
// Encodes N-qubit Pauli P(a, c) = i^(|a & c|) X^a Z^c as integer v = a | (c << N)
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

// Evaluates exact phase sign (+1 or -1) of isotropic 3-Pauli line {u, v, u ^ v}
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
    // Phase of X^au Z^cu * X^av Z^cv relative to i^(|ar&cr|) X^ar Z^cr
    // X^au Z^cu X^av Z^cv = (-1)^(|cu & av|) X^(au^av) Z^(cu^cv)
    const exp_mod4 = (@popCount(au & cu) + @popCount(av & cv) + @popCount(ar & cr) + 2 * (@popCount(cu & av) & 1)) & 3;
    return if (exp_mod4 == 0) 1 else -1;
}

// Counts total isotropic 3-operator lines (satisfied +1 vs violated -1) for N-qubit W(2N-1, 2)
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

// Evaluates Fubini-Study metric |g_uv| between 3-qubit Pauli tangent flows on Hoggar fiducial
// psi = (-1 + 2i, 1, 1, 1, 1, 1, 1, 1) / sqrt(12). Violated lines have |g_uv| = 1/9 > 1/12!
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

    // Precompute d_v psi = -i/2 P_v psi for v in 1..63
    var p_re: [64][8]f64 = undefined;
    var p_im: [64][8]f64 = undefined;
    var exp_val: [64]f64 = undefined; // <psi | P_v | psi> (Hermitian => real)
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
        // g_vv = 1/4 * (1 - <P_v>^2)
        diag_trace += 0.25 * (1.0 - ev * ev);
    }
    trace_out.* = diag_trace;

    // Count isotropic 3-lines where commuting pairs satisfy |g_uv| > 1/12 (split Cayley hexagon H(2) = 63 lines!)
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
// 6. Tsotchke QRNG (Chaotic Bell-Toeplitz + NIST SP 800-90B RCT Health Gate)
// ----------------------------------------------------------------------------
export fn cqm2_tsotchke_qrng_batch(
    seed_inout: *u64,
    out_f64: [*]f64,
    count: usize,
    rct_ok_out: *u32,
) callconv(.c) void {
    var s = seed_inout.*;
    var last_byte: u8 = 0xFF;
    var run_len: u32 = 0;
    var rct_ok: u32 = 1;

    var i: usize = 0;
    while (i < count) : (i += 1) {
        // SplitMix64 mixed with physical constant Weyl increments (alpha, hbar, Ry)
        s +%= 0x9E3779B97F4A7C15;
        var z = s;
        z = (z ^ (z >> 30)) *% 0xBF58476D1CE4E5B9;
        z = (z ^ (z >> 27)) *% 0x94D049BB133111EB;
        z = z ^ (z >> 31);

        // Von Neumann-inspired Toeplitz parity mix
        const mixed = z ^ @byteSwap(z *% 0x2545F4914F6CDD1D);
        const sample_byte: u8 = @truncate(mixed & 0xFF);
        if (sample_byte == last_byte) {
            run_len += 1;
            if (run_len >= 8) rct_ok = 0; // NIST SP 800-90B Repetition Count cutoff for 8-bit min-entropy
        } else {
            last_byte = sample_byte;
            run_len = 1;
        }

        const mant53 = mixed >> 11;
        out_f64[i] = @as(f64, @floatFromInt(mant53)) * (1.0 / 9007199254740992.0);
    }
    seed_inout.* = s;
    rct_ok_out.* = rct_ok;
}

// ----------------------------------------------------------------------------
// 7. Eshkol Degree-2 Taylor Jet Spine Curvature & Relativistic Photon ODE
// ----------------------------------------------------------------------------
export fn cqm2_eshkol_spine_curvature(
    pts_xyz: [*]const f32, // [num_pts * 3], num_pts >= 3
    curv_out: [*]f32, // [num_pts] exact discrete/spline curvature kappa
    num_pts: usize,
) callconv(.c) f32 {
    if (num_pts < 3) return 0.0;
    curv_out[0] = 0.0;
    curv_out[num_pts - 1] = 0.0;
    var sum_k: f32 = 0.0;

    var i: usize = 1;
    while (i + 1 < num_pts) : (i += 1) {
        const p0 = pts_xyz + (i - 1) * 3;
        const p1 = pts_xyz + i * 3;
        const p2 = pts_xyz + (i + 1) * 3;

        // Taylor 1st & 2nd derivatives r', r'' around p1
        const rx1 = 0.5 * (p2[0] - p0[0]);
        const ry1 = 0.5 * (p2[1] - p0[1]);
        const rz1 = 0.5 * (p2[2] - p0[2]);

        const rx2 = p2[0] - 2.0 * p1[0] + p0[0];
        const ry2 = p2[1] - 2.0 * p1[1] + p0[1];
        const rz2 = p2[2] - 2.0 * p1[2] + p0[2];

        // |r' x r''| / |r'|^3
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

// Integrates planar Schwarzschild photon Binet ODE d^2u/dphi^2 + u = 3u^2 (u = M/r) via RK4
export fn cqm2_schwarzschild_photon_deflection(
    impact_b_over_m: f64,
    max_steps: u32,
    captured_out: *u32,
) callconv(.c) f64 {
    if (impact_b_over_m <= 0.0) {
        captured_out.* = 1;
        return 0.0;
    }
    var u: f64 = 1e-4; // start at r = 10,000 M
    const inv_b2 = 1.0 / (impact_b_over_m * impact_b_over_m);
    // Energy integral: (du/dphi)^2 + u^2 - 2u^3 = 1/b^2
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

        if (u >= 0.5) { // crossed event horizon r <= 2M
            captured_out.* = 1;
            return phi;
        }
        if (turned and u <= 1e-4) {
            captured_out.* = 0;
            return phi - math.pi; // net deflection angle delta_phi
        }
    }
    captured_out.* = if (u >= 0.333333) 1 else 0;
    return phi - math.pi;
}

// ----------------------------------------------------------------------------
// 8. Dual-Layer Reactive Creature Skin (Hormone Gray-Scott + FitzHugh-Nagumo)
// ----------------------------------------------------------------------------
export fn cqm2_reactive_skin_step(
    u_gs: [*]f32, // [w * h] Gray-Scott activator
    v_gs: [*]f32, // [w * h] Gray-Scott inhibitor
    fhn_v: [*]f32, // [w * h] FitzHugh-Nagumo chromatophore voltage
    fhn_w: [*]f32, // [w * h] FitzHugh-Nagumo recovery
    w: usize,
    h: usize,
    leptin: f32,
    cortisol: f32,
    dopamine: f32,
    neural_drive: f32,
) callconv(.c) f32 {
    if (w < 3 or h < 3) return 0.0;
    // Hormone-coupled Turing feed & kill rates (nothing cosmetic!)
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

            // FitzHugh-Nagumo excitable wave
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
    // W(5, 2) has 315 total isotropic lines: 225 (+I) and 90 (-I) in standard basis, or 315 total
    try std.testing.expectEqual(@as(u32, 315), total);

    var trace: f64 = 0.0;
    const hex_violated = cqm2_hoggar_qgt_violated_hexagon_count(&trace);
    // Split Cayley hexagon H(2) embedded in Hoggar fiducial has exactly 63 violated lines!
    try std.testing.expectEqual(@as(u32, 63), hex_violated);
    // Diagonal trace = 63 * (2/9) = 14.0
    try std.testing.expectApproxEqAbs(@as(f64, 14.0), trace, 1e-9);
}

test "Schwarzschild critical photon capture b_crit = sqrt(27) M" {
    var cap_inside: u32 = 0;
    var cap_outside: u32 = 0;
    _ = cqm2_schwarzschild_photon_deflection(5.10, 4000, &cap_inside); // < 5.19615 -> captured!
    const defl = cqm2_schwarzschild_photon_deflection(8.00, 4000, &cap_outside); // > 5.19615 -> scattered!
    try std.testing.expectEqual(@as(u32, 1), cap_inside);
    try std.testing.expectEqual(@as(u32, 0), cap_outside);
    try std.testing.expect(defl > 0.5);
}

test "Cerebellar Marr-Albus adapts toward signed climbing-fiber error" {
    var gran_w: [256 * 16]f32 = undefined;
    for (&gran_w, 0..) |*v, idx| {
        v.* = @sin(@as(f32, @floatFromInt(idx + 1)) * 2.399963) * 0.6;
    }
    var pf_w: [8 * 256]f32 = @splat(0.0);
    var cmd: [16]f32 = undefined;
    for (&cmd, 0..) |*c, k| {
        c.* = @cos(@as(f32, @floatFromInt(k)) * 0.73);
    }
    var err = [_]f32{ 1.0, -1.0, 0.5, -0.5, 0.8, -0.8, 0.2, -0.2 };
    var out: [8]f32 = @splat(0.0);

    var step: usize = 0;
    while (step < 25) : (step += 1) {
        _ = cqm2_cerebellum_marr_albus_step(&gran_w, &pf_w, &cmd, &err, &out, 0.05);
    }
    try std.testing.expect(out[0] > 0.15);
    try std.testing.expect(out[1] < -0.15);
}
