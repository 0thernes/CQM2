//! CQM2 v2.1.0 Rust Entity-Relational Merkle State Verifier, First-Law Metabolic Auditor,
//! Chaos-Entropy Lemire Unbiased Lattice Sampler & GeoRefine BF16 Predictive-XOR Codec.

use std::slice;

const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x00000100000001b3;

#[inline]
pub fn fnv1a64_bytes(bytes: &[u8]) -> u64 {
    let mut h = FNV_OFFSET_BASIS;
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(FNV_PRIME);
    }
    h
}

#[inline]
pub fn mix_pair64(left: u64, right: u64) -> u64 {
    let mut buf = [0u8; 16];
    buf[0..8].copy_from_slice(&left.to_le_bytes());
    buf[8..16].copy_from_slice(&right.to_le_bytes());
    let mut z = fnv1a64_bytes(&buf).wrapping_add(0x9e3779b97f4a7c15);
    z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
    z ^ (z >> 31)
}

#[no_mangle]
pub extern "C" fn cqm2_rust_fnv1a64(ptr: *const u8, len: usize) -> u64 {
    if ptr.is_null() || len == 0 {
        return FNV_OFFSET_BASIS;
    }
    let bytes = unsafe { slice::from_raw_parts(ptr, len) };
    fnv1a64_bytes(bytes)
}

/// Computes binary Merkle root over `count` 64-bit entity/chunk state hashes.
#[no_mangle]
pub extern "C" fn cqm2_rust_merkle_root64(hashes_ptr: *const u64, count: usize) -> u64 {
    if hashes_ptr.is_null() || count == 0 {
        return 0;
    }
    let leaves = unsafe { slice::from_raw_parts(hashes_ptr, count) };
    let mut layer: Vec<u64> = leaves.to_vec();
    while layer.len() > 1 {
        let mut next = Vec::with_capacity((layer.len() + 1) / 2);
        let mut i = 0;
        while i < layer.len() {
            let l = layer[i];
            let r = if i + 1 < layer.len() { layer[i + 1] } else { l };
            next.push(mix_pair64(l, r));
            i += 2;
        }
        layer = next;
    }
    layer[0]
}

/// Audits First-Law energy conservation across `entity_count` organisms (`< 1e-12` tolerance).
#[no_mangle]
pub extern "C" fn cqm2_rust_audit_metabolic_conservation(
    pools15_ptr: *const f64,
    total_intake_ptr: *const f64,
    entity_count: usize,
    max_rel_err_out: *mut f64,
) -> u32 {
    if pools15_ptr.is_null() || total_intake_ptr.is_null() || entity_count == 0 {
        if !max_rel_err_out.is_null() {
            unsafe { *max_rel_err_out = 0.0 };
        }
        return 1;
    }
    let pools = unsafe { slice::from_raw_parts(pools15_ptr, entity_count * 15) };
    let intakes = unsafe { slice::from_raw_parts(total_intake_ptr, entity_count) };

    let mut max_rel: f64 = 0.0;
    let mut all_valid: u32 = 1;

    for e in 0..entity_count {
        let base = e * 15;
        let mut sum: f64 = 0.0;
        let mut c: f64 = 0.0;
        for k in 0..15 {
            let val = pools[base + k];
            if !val.is_finite() || val < -1e-12 {
                all_valid = 0;
            }
            let y = val - c;
            let t = sum + y;
            c = (t - sum) - y;
            sum = t;
        }
        let expected = intakes[e];
        let denom = expected.abs().max(1.0);
        let rel_err = (sum - expected).abs() / denom;
        if !rel_err.is_finite() || rel_err >= 1e-12 {
            all_valid = 0;
        }
        if rel_err > max_rel {
            max_rel = rel_err;
        }
    }

    if !max_rel_err_out.is_null() {
        unsafe { *max_rel_err_out = max_rel };
    }
    all_valid
}

/// Chaos-Entropy-Art-Engine port: Lemire unbiased fast bounded sampling over `[0, bound)`.
#[inline]
fn splitmix64_next(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9e3779b97f4a7c15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
    z ^ (z >> 31)
}

#[no_mangle]
pub extern "C" fn cqm2_rust_lemire_lattice_sample(
    seed: u64,
    bound: u32,
    out_ptr: *mut u32,
    count: usize,
) -> u64 {
    if out_ptr.is_null() || count == 0 || bound == 0 {
        return seed;
    }
    let out = unsafe { slice::from_raw_parts_mut(out_ptr, count) };
    let mut s = seed;
    let b = bound as u64;
    let threshold = (b.wrapping_neg()) % b;
    for slot in out.iter_mut() {
        loop {
            let x = splitmix64_next(&mut s) as u32 as u64;
            let m = x * b;
            let l = m as u32 as u64;
            if l >= threshold {
                *slot = (m >> 32) as u32;
                break;
            }
        }
    }
    s
}

/// GeoRefine (`Tsotchke-Corporation/GeoRefine`) reversible BF16 predictive-XOR snapshot codec.
/// Quantizes `f32` state vectors to round-to-nearest-even BF16 (`u16`) and encodes sequential XOR residuals.
#[inline]
fn f32_to_bf16_rne(v: f32) -> u16 {
    let bits = v.to_bits();
    let lsb = (bits >> 16) & 1;
    let rounding_bias = 0x7fff_u32.wrapping_add(lsb);
    (bits.wrapping_add(rounding_bias) >> 16) as u16
}

#[no_mangle]
pub extern "C" fn cqm2_rust_bf16_xor_encode(
    src_f32_ptr: *const f32,
    out_u16_ptr: *mut u16,
    count: usize,
) -> usize {
    if src_f32_ptr.is_null() || out_u16_ptr.is_null() || count == 0 {
        return 0;
    }
    let src = unsafe { slice::from_raw_parts(src_f32_ptr, count) };
    let out = unsafe { slice::from_raw_parts_mut(out_u16_ptr, count) };
    let mut prev: u16 = 0;
    let mut nonzero_residuals: usize = 0;
    for i in 0..count {
        let q = f32_to_bf16_rne(src[i]);
        let delta = q ^ prev;
        out[i] = delta;
        if delta != 0 {
            nonzero_residuals += 1;
        }
        prev = q;
    }
    nonzero_residuals
}

#[no_mangle]
pub extern "C" fn cqm2_rust_bf16_xor_decode(
    deltas_u16_ptr: *const u16,
    out_f32_ptr: *mut f32,
    count: usize,
) {
    if deltas_u16_ptr.is_null() || out_f32_ptr.is_null() || count == 0 {
        return;
    }
    let deltas = unsafe { slice::from_raw_parts(deltas_u16_ptr, count) };
    let out = unsafe { slice::from_raw_parts_mut(out_f32_ptr, count) };
    let mut prev: u16 = 0;
    for i in 0..count {
        let q = deltas[i] ^ prev;
        out[i] = f32::from_bits((q as u32) << 16);
        prev = q;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_conservation_exact_kahan() {
        let pools: [f64; 15] = [
            12.5, 8.25, 4.125, 3.8, 0.45, 0.65, 0.12, 0.08,
            65.0, 140.0, 210.0, 1.2, 4.5, 18.375, 31.0,
        ];
        let total: f64 = pools.iter().sum();
        let mut max_err: f64 = 1.0;
        let ok = cqm2_rust_audit_metabolic_conservation(
            pools.as_ptr(),
            &total as *const f64,
            1,
            &mut max_err as *mut f64,
        );
        assert_eq!(ok, 1);
        assert!(max_err < 1e-14);
    }

    #[test]
    fn test_merkle_and_lemire_and_bf16_roundtrip() {
        let leaves = [101u64, 202u64, 303u64, 404u64];
        let r1 = cqm2_rust_merkle_root64(leaves.as_ptr(), leaves.len());
        let r2 = cqm2_rust_merkle_root64(leaves.as_ptr(), leaves.len());
        assert_eq!(r1, r2);
        assert_ne!(r1, 0);

        let mut lat = [0u32; 32];
        let next_s = cqm2_rust_lemire_lattice_sample(42, 17, lat.as_mut_ptr(), lat.len());
        assert_ne!(next_s, 42);
        assert!(lat.iter().all(|&v| v < 17));

        let orig = [1.25f32, 1.25f32, -0.5f32, 3.75f32];
        let mut enc = [0u16; 4];
        let mut dec = [0.0f32; 4];
        let nz = cqm2_rust_bf16_xor_encode(orig.as_ptr(), enc.as_mut_ptr(), 4);
        assert_eq!(nz, 3); // duplicate 1.25 encodes to 0 XOR residual!
        cqm2_rust_bf16_xor_decode(enc.as_ptr(), dec.as_mut_ptr(), 4);
        for k in 0..4 {
            assert!((orig[k] - dec[k]).abs() < 1e-2);
        }
    }
}
