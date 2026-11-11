/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
/**
 * @file cqm2_rosette_wire.h
 * @brief Native ISO C17 implementation of Tsotchke RosettaWire (`RSC1` cells,
 *        `RSW1` multiplexed SHA-256 stream frames with fail-closed fault latching,
 *        IEEE-754 `$float` canonical JSON envelopes, CSR linear port-ownership
 *        verifier, and `ROSETTE-MOONLAB/1` ABI attestation).
 */
#ifndef CQM2_ROSETTE_WIRE_H
#define CQM2_ROSETTE_WIRE_H

#include <stddef.h>
#include <stdint.h>

#ifdef _WIN32
#define CQM2_RW_API __declspec(dllexport)
#else
#define CQM2_RW_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define CQM2_RSC1_HEADER_BYTES 16u
#define CQM2_RSW1_HEADER_BYTES 60u

#define CQM2_RSW1_KIND_OPEN  1u
#define CQM2_RSW1_KIND_DATA  2u
#define CQM2_RSW1_KIND_CLOSE 3u
#define CQM2_RSW1_KIND_ERROR 4u

typedef struct {
    uint32_t stream_id;
    uint32_t opened;
    uint32_t closed;
    uint32_t fault_latched;
    uint64_t expected_seq;
    int32_t  last_error_code;
} cqm2_rsw1_stream_state_t;

/** FIPS 180-4 SHA-256 over arbitrary bytes -> 32-byte digest. */
CQM2_RW_API void cqm2_sha256_bytes(const uint8_t* data, size_t len, uint8_t out32[32]);

/**
 * Encode an `RSC1` 16-byte big-endian header cell:
 *   [0..4]  "RSC1"
 *   [4..6]  u16be tag_len
 *   [6..8]  u16be media_len
 *   [8..16] u64be payload_len
 *   followed by tag || media || payload.
 * Also writes the Content ID `"sha256:" + 64 lowercase hex chars + NUL` (72 bytes) into `cid_out72`.
 * Returns total encoded byte length, or negative error code if `out_cap` is insufficient.
 */
CQM2_RW_API int64_t cqm2_rsc1_encode(
    const char* tag,
    const char* media_type,
    const uint8_t* payload,
    size_t payload_len,
    uint8_t* out_buf,
    size_t out_cap,
    char cid_out72[72]
);

/**
 * Verify and decode an `RSC1` cell. Returns payload length (>= 0) on valid cell,
 * or negative error code on malformed magic, truncated lengths, or invalid UTF-8 bounds.
 */
CQM2_RW_API int64_t cqm2_rsc1_verify(
    const uint8_t* cell_buf,
    size_t cell_len,
    uint16_t* tag_len_out,
    uint16_t* media_len_out,
    char cid_out72[72]
);

/**
 * Encode an `RSW1` 60-byte big-endian multiplexed stream frame:
 *   [0..4]   "RSW1"
 *   [4]      version = 1
 *   [5]      kind (1=OPEN, 2=DATA, 3=CLOSE, 4=ERROR)
 *   [6..8]   u16be flags = 0
 *   [8..12]  u32be stream_id
 *   [12..20] u64be seq
 *   [20..28] u64be payload_len
 *   [28..60] sha256(payload) [32 bytes]
 *   [60..]   payload
 */
CQM2_RW_API int64_t cqm2_rsw1_encode_frame(
    uint8_t kind,
    uint32_t stream_id,
    uint64_t seq,
    const uint8_t* payload,
    size_t payload_len,
    uint8_t* out_buf,
    size_t out_cap
);

/** Initialize an `RSW1` fail-closed stream state machine. */
CQM2_RW_API void cqm2_rsw1_stream_init(cqm2_rsw1_stream_state_t* st, uint32_t stream_id);

/**
 * Ingest and verify an `RSW1` frame against fail-closed state machine `st`.
 * Any bad magic, non-zero flags, SHA-256 mismatch, sequence skip, or post-CLOSE frame
 * latches `st->fault_latched = 1` permanently so all subsequent frames fail closed!
 * Returns 0 on accept, negative error code on reject.
 */
CQM2_RW_API int32_t cqm2_rsw1_stream_accept(
    cqm2_rsw1_stream_state_t* st,
    const uint8_t* frame_buf,
    size_t frame_len
);

/**
 * Format an IEEE-754 binary64 value into RosettaWire Canonical JSON `$float` object:
 * `{"$float":{"exponent":E,"format":"double-float","sign":S,"significand":"M"}}`
 * Rejects NaN and +/-Infinity with -1 (fail-closed finite-float law).
 */
CQM2_RW_API int32_t cqm2_rosette_canonical_float_json(
    double value,
    char* json_out,
    size_t max_len
);

/**
 * Verify linear port ownership (`0=owned`, `1=borrowed`, `2=shared`) across `num_edges`
 * port bindings `(src_port[e], src_mode[e])`.
 * Enforces RosettaWire linear port law:
 *   - An `:owned` (0) port may be consumed AT MOST ONCE and never mixed with `:borrowed`/`:shared`.
 *   - A `:borrowed` (1) port may not be consumed as `:owned`.
 * Returns 1 if valid, 0 if linear ownership is violated (writes offending port to `*bad_port_out`).
 */
CQM2_RW_API int32_t cqm2_rosette_verify_port_ownership(
    uint32_t num_ports,
    const uint32_t* edge_ports,
    const uint8_t* edge_modes,
    uint32_t num_edges,
    uint32_t* bad_port_out
);

#ifdef __cplusplus
}
#endif

#endif /* CQM2_ROSETTE_WIRE_H */
