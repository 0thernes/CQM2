/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#define _CRT_SECURE_NO_WARNINGS
#include "cqm2_rosette_wire.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static uint32_t rotr32(uint32_t x, uint32_t n) {
    return (x >> n) | (x << (32u - n));
}

static const uint32_t K256[64] = {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u,
    0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
    0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
    0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
    0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
    0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u,
    0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
    0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
    0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
    0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u,
    0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u,
    0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
    0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
    0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
};

static void sha256_transform(uint32_t state[8], const uint8_t block[64]) {
    uint32_t w[64];
    for (int i = 0; i < 16; ++i) {
        w[i] = ((uint32_t)block[i * 4] << 24) |
               ((uint32_t)block[i * 4 + 1] << 16) |
               ((uint32_t)block[i * 4 + 2] << 8) |
               ((uint32_t)block[i * 4 + 3]);
    }
    for (int i = 16; i < 64; ++i) {
        uint32_t s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >> 3);
        uint32_t s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }

    uint32_t a = state[0], b = state[1], c = state[2], d = state[3];
    uint32_t e = state[4], f = state[5], g = state[6], h = state[7];

    for (int i = 0; i < 64; ++i) {
        uint32_t S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        uint32_t ch = (e & f) ^ ((~e) & g);
        uint32_t temp1 = h + S1 + ch + K256[i] + w[i];
        uint32_t S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
        uint32_t temp2 = S0 + maj;

        h = g;
        g = f;
        f = e;
        e = d + temp1;
        d = c;
        c = b;
        b = a;
        a = temp1 + temp2;
    }

    state[0] += a; state[1] += b; state[2] += c; state[3] += d;
    state[4] += e; state[5] += f; state[6] += g; state[7] += h;
}

CQM2_RW_API void cqm2_sha256_bytes(const uint8_t* data, size_t len, uint8_t out32[32]) {
    uint32_t state[8] = {
        0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
        0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u
    };
    uint8_t buf[64];
    size_t offset = 0;
    while (len - offset >= 64) {
        sha256_transform(state, data + offset);
        offset += 64;
    }
    size_t rem = len - offset;
    memset(buf, 0, sizeof(buf));
    if (rem > 0 && data) {
        memcpy(buf, data + offset, rem);
    }
    buf[rem] = 0x80u;
    if (rem >= 56) {
        sha256_transform(state, buf);
        memset(buf, 0, sizeof(buf));
    }
    uint64_t bit_len = (uint64_t)len * 8ULL;
    for (int i = 0; i < 8; ++i) {
        buf[63 - i] = (uint8_t)((bit_len >> (i * 8)) & 0xffu);
    }
    sha256_transform(state, buf);
    for (int i = 0; i < 8; ++i) {
        out32[i * 4]     = (uint8_t)((state[i] >> 24) & 0xffu);
        out32[i * 4 + 1] = (uint8_t)((state[i] >> 16) & 0xffu);
        out32[i * 4 + 2] = (uint8_t)((state[i] >> 8) & 0xffu);
        out32[i * 4 + 3] = (uint8_t)(state[i] & 0xffu);
    }
}

static void write_u16be(uint8_t* dst, uint16_t v) {
    dst[0] = (uint8_t)((v >> 8) & 0xffu);
    dst[1] = (uint8_t)(v & 0xffu);
}

static void write_u32be(uint8_t* dst, uint32_t v) {
    dst[0] = (uint8_t)((v >> 24) & 0xffu);
    dst[1] = (uint8_t)((v >> 16) & 0xffu);
    dst[2] = (uint8_t)((v >> 8) & 0xffu);
    dst[3] = (uint8_t)(v & 0xffu);
}

static void write_u64be(uint8_t* dst, uint64_t v) {
    for (int i = 0; i < 8; ++i) {
        dst[7 - i] = (uint8_t)((v >> (i * 8)) & 0xffu);
    }
}

static uint16_t read_u16be(const uint8_t* src) {
    return (uint16_t)(((uint16_t)src[0] << 8) | (uint16_t)src[1]);
}

static uint32_t read_u32be(const uint8_t* src) {
    return ((uint32_t)src[0] << 24) |
           ((uint32_t)src[1] << 16) |
           ((uint32_t)src[2] << 8)  |
           ((uint32_t)src[3]);
}

static uint64_t read_u64be(const uint8_t* src) {
    uint64_t v = 0;
    for (int i = 0; i < 8; ++i) {
        v = (v << 8) | (uint64_t)src[i];
    }
    return v;
}

static void format_cid(const uint8_t hash32[32], char cid_out72[72]) {
    static const char HEX[16] = {
        '0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'
    };
    if (!cid_out72) return;
    memcpy(cid_out72, "sha256:", 7);
    for (int i = 0; i < 32; ++i) {
        cid_out72[7 + i * 2]     = HEX[(hash32[i] >> 4) & 0x0fu];
        cid_out72[7 + i * 2 + 1] = HEX[hash32[i] & 0x0fu];
    }
    cid_out72[71] = '\0';
}

CQM2_RW_API int64_t cqm2_rsc1_encode(
    const char* tag,
    const char* media_type,
    const uint8_t* payload,
    size_t payload_len,
    uint8_t* out_buf,
    size_t out_cap,
    char cid_out72[72]
) {
    if (!tag || !media_type || !out_buf) return -1;
    if (payload_len > 0 && !payload) return -2;

    size_t tag_len = strlen(tag);
    size_t media_len = strlen(media_type);
    if (tag_len == 0 || tag_len > 65535u || media_len == 0 || media_len > 65535u) return -3;

    size_t total = CQM2_RSC1_HEADER_BYTES + tag_len + media_len + payload_len;
    if (out_cap < total) return -4;

    memcpy(out_buf, "RSC1", 4);
    write_u16be(out_buf + 4, (uint16_t)tag_len);
    write_u16be(out_buf + 6, (uint16_t)media_len);
    write_u64be(out_buf + 8, (uint64_t)payload_len);
    memcpy(out_buf + 16, tag, tag_len);
    memcpy(out_buf + 16 + tag_len, media_type, media_len);
    if (payload_len > 0) {
        memcpy(out_buf + 16 + tag_len + media_len, payload, payload_len);
    }

    uint8_t digest[32];
    cqm2_sha256_bytes(out_buf, total, digest);
    format_cid(digest, cid_out72);
    return (int64_t)total;
}

CQM2_RW_API int64_t cqm2_rsc1_verify(
    const uint8_t* cell_buf,
    size_t cell_len,
    uint16_t* tag_len_out,
    uint16_t* media_len_out,
    char cid_out72[72]
) {
    if (!cell_buf || cell_len < CQM2_RSC1_HEADER_BYTES) return -1;
    if (memcmp(cell_buf, "RSC1", 4) != 0) return -2;

    uint16_t tag_len = read_u16be(cell_buf + 4);
    uint16_t media_len = read_u16be(cell_buf + 6);
    uint64_t payload_len = read_u64be(cell_buf + 8);
    if (tag_len == 0 || media_len == 0) return -3;

    uint64_t expected_total = (uint64_t)CQM2_RSC1_HEADER_BYTES + (uint64_t)tag_len + (uint64_t)media_len + payload_len;
    if (expected_total != (uint64_t)cell_len) return -4;

    if (tag_len_out) *tag_len_out = tag_len;
    if (media_len_out) *media_len_out = media_len;
    if (cid_out72) {
        uint8_t digest[32];
        cqm2_sha256_bytes(cell_buf, cell_len, digest);
        format_cid(digest, cid_out72);
    }
    return (int64_t)payload_len;
}

CQM2_RW_API int64_t cqm2_rsw1_encode_frame(
    uint8_t kind,
    uint32_t stream_id,
    uint64_t seq,
    const uint8_t* payload,
    size_t payload_len,
    uint8_t* out_buf,
    size_t out_cap
) {
    if (!out_buf) return -1;
    if (kind < CQM2_RSW1_KIND_OPEN || kind > CQM2_RSW1_KIND_ERROR) return -2;
    if (stream_id == 0) return -3;
    if (payload_len > 0 && !payload) return -4;

    size_t total = CQM2_RSW1_HEADER_BYTES + payload_len;
    if (out_cap < total) return -5;

    memcpy(out_buf, "RSW1", 4);
    out_buf[4] = 1u;
    out_buf[5] = kind;
    write_u16be(out_buf + 6, 0u);
    write_u32be(out_buf + 8, stream_id);
    write_u64be(out_buf + 12, seq);
    write_u64be(out_buf + 20, (uint64_t)payload_len);

    uint8_t digest[32];
    cqm2_sha256_bytes(payload, payload_len, digest);
    memcpy(out_buf + 28, digest, 32);

    if (payload_len > 0) {
        memcpy(out_buf + 60, payload, payload_len);
    }
    return (int64_t)total;
}

CQM2_RW_API void cqm2_rsw1_stream_init(cqm2_rsw1_stream_state_t* st, uint32_t stream_id) {
    if (!st) return;
    memset(st, 0, sizeof(*st));
    st->stream_id = stream_id;
}

static int32_t latch_fault(cqm2_rsw1_stream_state_t* st, int32_t code) {
    st->fault_latched = 1u;
    st->last_error_code = code;
    return code;
}

CQM2_RW_API int32_t cqm2_rsw1_stream_accept(
    cqm2_rsw1_stream_state_t* st,
    const uint8_t* frame_buf,
    size_t frame_len
) {
    if (!st) return -100;
    if (st->fault_latched) return st->last_error_code ? st->last_error_code : -99;
    if (!frame_buf || frame_len < CQM2_RSW1_HEADER_BYTES) return latch_fault(st, -1);
    if (memcmp(frame_buf, "RSW1", 4) != 0) return latch_fault(st, -2);
    if (frame_buf[4] != 1u) return latch_fault(st, -3);

    uint8_t kind = frame_buf[5];
    uint16_t flags = read_u16be(frame_buf + 6);
    uint32_t stream_id = read_u32be(frame_buf + 8);
    uint64_t seq = read_u64be(frame_buf + 12);
    uint64_t payload_len = read_u64be(frame_buf + 20);

    if (flags != 0u) return latch_fault(st, -4);
    if (stream_id == 0u || (st->stream_id != 0u && stream_id != st->stream_id)) return latch_fault(st, -5);
    if (st->closed) return latch_fault(st, -6);
    if ((uint64_t)CQM2_RSW1_HEADER_BYTES + payload_len != (uint64_t)frame_len) return latch_fault(st, -7);

    uint8_t actual_sha[32];
    cqm2_sha256_bytes(frame_buf + 60, (size_t)payload_len, actual_sha);
    if (memcmp(actual_sha, frame_buf + 28, 32) != 0) return latch_fault(st, -8);

    if (seq != st->expected_seq) return latch_fault(st, -9);

    if (kind == CQM2_RSW1_KIND_OPEN) {
        if (st->opened || seq != 0ULL) return latch_fault(st, -10);
        st->stream_id = stream_id;
        st->opened = 1u;
        st->expected_seq = 1ULL;
        return 0;
    }
    if (!st->opened) return latch_fault(st, -11);

    if (kind == CQM2_RSW1_KIND_DATA) {
        st->expected_seq += 1ULL;
        return 0;
    }
    if (kind == CQM2_RSW1_KIND_CLOSE) {
        st->closed = 1u;
        st->expected_seq += 1ULL;
        return 0;
    }
    if (kind == CQM2_RSW1_KIND_ERROR) {
        st->closed = 1u;
        return latch_fault(st, -12);
    }
    return latch_fault(st, -13);
}

CQM2_RW_API int32_t cqm2_rosette_canonical_float_json(
    double value,
    char* json_out,
    size_t max_len
) {
    if (!json_out || max_len < 96 || !isfinite(value)) return -1;

    uint64_t bits = 0;
    memcpy(&bits, &value, sizeof(bits));
    int sign = ((bits >> 63) & 1ULL) ? -1 : 1;
    uint64_t raw_exp = (bits >> 52) & 0x7ffULL;
    uint64_t frac = bits & 0x000fffffffffffffULL;

    int exponent = 0;
    uint64_t significand = 0;
    if (raw_exp == 0ULL && frac == 0ULL) {
        sign = (bits >> 63) ? -1 : 1;
        exponent = 0;
        significand = 0ULL;
    } else if (raw_exp == 0ULL) {
        /* Subnormal IEEE-754 binary64 */
        exponent = -1074;
        significand = frac;
    } else {
        /* Normal IEEE-754 binary64: (-1)^s * (2^52 + frac) * 2^(raw_exp - 1023 - 52) */
        exponent = (int)raw_exp - 1075;
        significand = (1ULL << 52) | frac;
    }

    int written = snprintf(
        json_out,
        max_len,
        "{\"$float\":{\"exponent\":%d,\"format\":\"double-float\",\"sign\":%d,\"significand\":\"%llu\"}}",
        exponent,
        sign,
        (unsigned long long)significand
    );
    return (written > 0 && (size_t)written < max_len) ? written : -2;
}

CQM2_RW_API int32_t cqm2_rosette_verify_port_ownership(
    uint32_t num_ports,
    const uint32_t* edge_ports,
    const uint8_t* edge_modes,
    uint32_t num_edges,
    uint32_t* bad_port_out
) {
    if (bad_port_out) *bad_port_out = 0xFFFFFFFFu;
    if (num_edges == 0) return 1;
    if (!edge_ports || !edge_modes || num_ports == 0 || num_ports > (1u << 20)) return 0;

    uint32_t* owned_cnt = (uint32_t*)calloc(num_ports, sizeof(uint32_t));
    uint32_t* borrow_cnt = (uint32_t*)calloc(num_ports, sizeof(uint32_t));
    uint32_t* shared_cnt = (uint32_t*)calloc(num_ports, sizeof(uint32_t));
    if (!owned_cnt || !borrow_cnt || !shared_cnt) {
        free(owned_cnt);
        free(borrow_cnt);
        free(shared_cnt);
        return 0;
    }

    int32_t ok = 1;
    for (uint32_t e = 0; e < num_edges; ++e) {
        uint32_t p = edge_ports[e];
        uint8_t m = edge_modes[e];
        if (p >= num_ports || m > 2u) {
            if (bad_port_out) *bad_port_out = p;
            ok = 0;
            break;
        }
        if (m == 0u) owned_cnt[p] += 1u;
        else if (m == 1u) borrow_cnt[p] += 1u;
        else shared_cnt[p] += 1u;

        /* Linear law: owned port is strictly linear (max 1 use, zero borrows/shares) */
        if (owned_cnt[p] > 1u || (owned_cnt[p] == 1u && (borrow_cnt[p] > 0u || shared_cnt[p] > 0u))) {
            if (bad_port_out) *bad_port_out = p;
            ok = 0;
            break;
        }
    }

    free(owned_cnt);
    free(borrow_cnt);
    free(shared_cnt);
    return ok;
}
