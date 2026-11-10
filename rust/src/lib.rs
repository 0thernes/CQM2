//! CQM2 Rust Entity-Relational Merkle State Verifier & First-Law Metabolic Auditor
//! Memory-safe verification engine loaded via Bun.FFI on local workstations.

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
    // SplitMix64-hardened FNV-1a compression node
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

/// Audits First-Law energy conservation across `entity_count` organisms.
/// Each organism has 15 conserved pools (gut_glc..excreted) stored contiguously in `pools15_ptr`
/// (`entity_count * 15` f64s) and cumulative `total_intake_kj` (`entity_count` f64s).
/// Writes maximum relative conservation drift to `max_rel_err_out` and returns 1 if all `< 1e-12`.
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
        // Kahan compensated summation across all 15 metabolic pools
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
    fn test_merkle_deterministic() {
        let leaves = [101u64, 202u64, 303u64, 404u64];
        let r1 = cqm2_rust_merkle_root64(leaves.as_ptr(), leaves.len());
        let r2 = cqm2_rust_merkle_root64(leaves.as_ptr(), leaves.len());
        assert_eq!(r1, r2);
        assert_ne!(r1, 0);
    }
}
