/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
/*
 * CQM2 v5.0.0 — Native NVIDIA Blackwell `sm_120` (PTX 8.7) GPU Compute Kernels
 * Compiled via LLVM 21 NVPTX64 Backend (`--target=nvptx64-nvidia-cuda -march=sm_120 -O3`)
 * and JIT-assembled to Blackwell SASS at load time via `cuModuleLoadData` (`nvcuda.dll`).
 */

__attribute__((nvptx_kernel)) void k_gray_scott_rgba(
    const float* __restrict src,
    float* __restrict dst,
    int n,
    float feed,
    float kill,
    float du,
    float dv,
    float dt,
    float f_spatial
) {
    int x = __nvvm_read_ptx_sreg_ctaid_x() * __nvvm_read_ptx_sreg_ntid_x() + __nvvm_read_ptx_sreg_tid_x();
    int y = __nvvm_read_ptx_sreg_ctaid_y() * __nvvm_read_ptx_sreg_ntid_y() + __nvvm_read_ptx_sreg_tid_y();
    if (x >= n || y >= n) return;

    int xm = (x == 0) ? (n - 1) : (x - 1);
    int xp = (x + 1 == n) ? 0 : (x + 1);
    int ym = (y == 0) ? (n - 1) : (y - 1);
    int yp = (y + 1 == n) ? 0 : (y + 1);
    int idx4 = (y * n + x) * 4;

    float u = src[idx4];
    float v = src[idx4 + 1];
    float b = src[idx4 + 2];
    float lap_u = src[(ym * n + x) * 4] + src[(yp * n + x) * 4]
                + src[(y * n + xm) * 4] + src[(y * n + xp) * 4] - 4.0f * u;
    float lap_v = src[(ym * n + x) * 4 + 1] + src[(yp * n + x) * 4 + 1]
                + src[(y * n + xm) * 4 + 1] + src[(y * n + xp) * 4 + 1] - 4.0f * v;

    float inv_n = 1.0f / (float)n;
    float fx = ((float)x * inv_n - 0.5f) * 2.0f;
    float fy = ((float)y * inv_n - 0.5f) * 2.0f;
    float f_loc = feed + f_spatial * (0.5f - (fx * fx + fy * fy));
    if (f_loc < 0.008f) f_loc = 0.008f;
    if (f_loc > 0.095f) f_loc = 0.095f;

    float uvv = u * v * v;
    float nu = u + (du * lap_u - uvv + f_loc * (1.0f - u)) * dt;
    float nv = v + (dv * lap_v + uvv - (f_loc + kill) * v) * dt;
    if (nu < 0.0f) nu = 0.0f; else if (nu > 1.0f) nu = 1.0f;
    if (nv < 0.0f) nv = 0.0f; else if (nv > 1.0f) nv = 1.0f;
    float nb = b * 0.992f + nv * 0.008f;
    if (nb < 0.0f) nb = 0.0f; else if (nb > 1.0f) nb = 1.0f;

    dst[idx4]     = nu;
    dst[idx4 + 1] = nv;
    dst[idx4 + 2] = nb;
    dst[idx4 + 3] = 1.0f;
}

__attribute__((nvptx_kernel)) void k_asmodenius_100m_lora(
    const float* __restrict x_in,
    const float* __restrict lora_a,
    const float* __restrict lora_b,
    float* __restrict y_out,
    int out_dim,
    int in_dim,
    unsigned int seed
) {
    int row = __nvvm_read_ptx_sreg_ctaid_x() * __nvvm_read_ptx_sreg_ntid_x() + __nvvm_read_ptx_sreg_tid_x();
    if (row >= out_dim) return;

    float acc = 0.0f;
    unsigned int row_hash = seed ^ ((unsigned int)row * 0x9E3779B9u);
    for (int col = 0; col < in_dim; ++col) {
        unsigned int h = row_hash ^ ((unsigned int)col * 0x85EBCA6Bu);
        h ^= h >> 16;
        h *= 0x85EBCA6Bu;
        h ^= h >> 13;
        h *= 0xC2B2AE35u;
        h ^= h >> 16;
        float w_proc = ((float)(h & 0xFFFFu) * (1.0f / 32768.0f) - 1.0f) * 0.08f;
        acc += w_proc * x_in[col];
    }

    float lora_sum = 0.0f;
    for (int r = 0; r < 16; ++r) {
        float proj = 0.0f;
        const float* b_row = lora_b + r * in_dim;
        for (int col = 0; col < in_dim; ++col) {
            proj += b_row[col] * x_in[col];
        }
        lora_sum += lora_a[row * 16 + r] * proj;
    }

    float z = acc + 0.25f * lora_sum;
    float z2 = z * z;
    y_out[row] = (z > 4.95f) ? 1.0f : ((z < -4.95f) ? -1.0f : (z * (27.0f + z2) / (27.0f + 9.0f * z2)));
}
