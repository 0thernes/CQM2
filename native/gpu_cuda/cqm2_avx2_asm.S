    .text
    .intel_syntax noprefix

    # =========================================================================
    # CQM2 Surgical x86-64 AVX2 + FMA3 + POPCNT Assembly Hot Kernels
    # Windows x64 ABI: rcx = arg0, rdx = arg1, r8 = arg2, r9 = arg3
    # =========================================================================

    .globl cqm2_asm_dot8_fma_avx2
    .def cqm2_asm_dot8_fma_avx2; .scl 2; .type 32; .endef
cqm2_asm_dot8_fma_avx2:
    # float cqm2_asm_dot8_fma_avx2(const float* a [rcx], const float* b [rdx], uint64_t n [r8])
    vxorps ymm0, ymm0, ymm0
    xor rax, rax
    mov r9, r8
    and r9, -8
    jz .Ldot_tail

.Ldot_loop8:
    vmovups ymm1, ymmword ptr [rcx + rax*4]
    vmovups ymm2, ymmword ptr [rdx + rax*4]
    vfmadd231ps ymm0, ymm1, ymm2
    add rax, 8
    cmp rax, r9
    jb .Ldot_loop8

    # Horizontal sum of ymm0 -> xmm0
    vextractf128 xmm1, ymm0, 1
    vaddps xmm0, xmm0, xmm1
    vhaddps xmm0, xmm0, xmm0
    vhaddps xmm0, xmm0, xmm0

.Ldot_tail:
    cmp rax, r8
    jae .Ldot_done
.Ldot_scalar:
    vmovss xmm1, dword ptr [rcx + rax*4]
    vfmadd231ss xmm0, xmm1, dword ptr [rdx + rax*4]
    inc rax
    cmp rax, r8
    jb .Ldot_scalar

.Ldot_done:
    vzeroupper
    ret

    .globl cqm2_asm_pauli_popcnt64
    .def cqm2_asm_pauli_popcnt64; .scl 2; .type 32; .endef
cqm2_asm_pauli_popcnt64:
    # uint32_t cqm2_asm_pauli_popcnt64(uint64_t ux [rcx], uint64_t uz [rdx], uint64_t vx [r8], uint64_t vz [r9])
    # Returns 1 if Pauli(ux,uz) and Pauli(vx,vz) commute: (popcnt(ux & vz) ^ popcnt(uz & vx)) & 1 == 0
    and rcx, r9
    and rdx, r8
    popcnt rax, rcx
    popcnt r10, rdx
    xor rax, r10
    and eax, 1
    xor eax, 1
    ret
