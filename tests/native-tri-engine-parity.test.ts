import { describe, expect, test } from 'bun:test';
import { getTriEngine } from '../src/native/tri-engine';
import { getZigBridge } from '../src/native/zig-bridge';

describe('Polyglot Quad-Silicon (CUDA StridedBatched / NPU RSSM / iGPU 2D Diffusion / Rust / Zig AVX2+WASM) Parity', () => {
  test('Zig SIMD128 Eshkol Vandermonde jet, spherical harmonics, LLG spin, Verlet & Pauli kernels execute cleanly', () => {
    const zig = getZigBridge();

    // 1. Eshkol Taylor jet curvature on circular arc of radius R = 4.0 -> kappa ~= 0.25
    const R = 4.0;
    const pts = new Float32Array(9 * 3);
    const curv = new Float32Array(9);
    for (let i = 0; i < 9; i++) {
      const th = i * 0.12;
      pts[i * 3] = R * Math.cos(th);
      pts[i * 3 + 1] = R * Math.sin(th);
      pts[i * 3 + 2] = 0;
    }
    const meanK = zig.eshkolSpineCurvature(pts, curv);
    expect(Math.abs(meanK - 1.0 / R)).toBeLessThan(0.01);

    // 2. Eshkol order-4 Vandermonde polynomial jet confidence (`C_pred = 1 / (1 + 2|c4|)`)
    const smoothSamples = Float32Array.from([1.0, 1.1, 1.2, 1.3, 1.4]); // linear => c4 = 0 => confidence ~= 1.0
    const jetConf = zig.eshkolVandermondeJet4(smoothSamples, new Float32Array(5));
    expect(jetConf).toBeGreaterThan(0.99);

    // 3. `libirrep` orthonormal real spherical harmonics l <= 2 (`9` components)
    const ylm = zig.sphericalHarmonicsL2(0.0, 0.0, 1.0);
    expect(ylm.length).toBe(9);
    expect(ylm[0]!).toBeCloseTo(0.5 * Math.sqrt(1 / Math.PI), 4);

    // 4. `spin_based_neural_network` norm-preserving Landau-Lifshitz-Gilbert step on S^2
    const spin = Float32Array.from([1, 0, 0]);
    zig.stepLlgSpins(spin, Float32Array.from([0, 0, 1.5]), 0.15, 0.05);
    const normSpin = Math.hypot(spin[0]!, spin[1]!, spin[2]!);
    expect(normSpin).toBeCloseTo(1.0, 5);

    // 5. LCG-shuffled Verlet soft-body step & Pauli algebra
    const pos = Float32Array.from([0, 2, 0, 1.5, 2, 0, 3.0, 2, 0]);
    const prev = pos.slice();
    const nextRng = zig.stepVerletShuffled(
      pos,
      prev,
      Float32Array.from([1, 1, 1]),
      Uint16Array.from([0, 1]),
      Uint16Array.from([1, 2]),
      Float32Array.from([1.0, 1.0]),
      Float32Array.from([0.8, 0.8]),
      0.016,
      -9.81,
      12345,
    );
    expect(nextRng).not.toBe(12345);
    expect(zig.pauliCommute(1, 2, 1)).toBe(false);
    expect(zig.pauliCommute(3, 12, 2)).toBe(true);
    expect(zig.pauliLineSign(3, 12, 2)).toBe(-1);
  });

  test('TriEngineOrchestrator CUDA/Zig organism cortex parity, Rust Lemire/BF16-XOR/Kahan & NPU/iGPU fields', async () => {
    const eng = getTriEngine();
    const zig = getZigBridge();
    const topo = await eng.init({ enableNpuDaemon: false });
    expect(topo.zigSimdReady).toBe(true);

    // 1. Real per-organism `dispatchOrganismCortexBatch` (`CUDA StridedBatched` or `Zig Native FFI`) vs WASM SIMD parity (`lr = 0`)
    const count = 24;
    const inputs = new Float32Array(count * 8);
    const weightsA = new Float32Array(count * 126);
    const modulators = new Float32Array(count * 2).fill(0.2);
    for (let i = 0; i < inputs.length; i++) inputs[i] = Math.sin(i * 0.37) * 0.65;
    for (let i = 0; i < weightsA.length; i++) weightsA[i] = Math.cos(i * 0.19) * 0.22;
    const weightsB = weightsA.slice();

    const outHw = new Float32Array(count * 6);
    const outWasm = new Float32Array(count * 6);
    const cortexRec = eng.dispatchOrganismCortexBatch(inputs, weightsA, modulators, outHw, count, 0.0);
    zig.stepOrganismBrainsSimd(inputs, weightsB, modulators, outWasm, count, 0.0);
    expect(cortexRec.rows).toBe(count);
    for (let i = 0; i < outHw.length; i++) {
      expect(Math.abs(outHw[i]! - outWasm[i]!)).toBeLessThan(1e-4);
    }

    // 2. Dense SGEMM + ASM micro-cortex
    const A = new Float32Array(16 * 16).fill(0.1);
    const B = new Float32Array(16 * 16).fill(0.2);
    const C = new Float32Array(16 * 16);
    eng.dispatchGpuCortexGemm(A, B, C, 16, 16, 16);
    expect(Math.abs(C[0]! - Math.tanh(0.32))).toBeLessThan(0.005);

    const outVec = new Float32Array(4);
    eng.dispatchAsmMicroCortex(
      new Float32Array(8).fill(0.5),
      new Float32Array(32).fill(0.25),
      new Float32Array(4).fill(0.1),
      outVec,
    );
    const expectedPade = (1.1 * (27 + 1.1 * 1.1)) / (27 + 9 * 1.1 * 1.1);
    expect(Math.abs(outVec[0]! - expectedPade)).toBeLessThan(1e-5);

    // 3. Rust 1.94 Ledger: Merkle, Kahan conservation, Lemire unbiased lattice sampler & BF16-XOR lossless roundtrip
    expect(eng.merkleRoot64(BigUint64Array.from([11n, 22n, 33n, 44n]))).toBe(
      eng.merkleRoot64(BigUint64Array.from([11n, 22n, 33n, 44n])),
    );

    const lem = eng.lemireLatticeSample(20261110n, 250, 64);
    expect(lem.samples.length).toBe(64);
    expect(lem.samples.every((x) => x < 250)).toBe(true);

    const telemetrySrc = Float32Array.from([0.5, 0.5, -1.25, 3.75, 0.0, 0.125, 0.125, -0.875]);
    const enc = eng.bf16XorEncode(telemetrySrc);
    const dec = eng.bf16XorDecode(enc.deltas);
    for (let i = 0; i < telemetrySrc.length; i++) {
      expect(Math.abs(dec[i]! - telemetrySrc[i]!)).toBeLessThan(0.02);
    }

    const validPools = new Float64Array(15).fill(10.0);
    expect(eng.auditMetabolicConservation(validPools, new Float64Array([150.0]), 1).valid).toBe(true);
    expect(eng.auditMetabolicConservation(validPools, new Float64Array([150.05]), 1).valid).toBe(false);

    // 4. Action-conditioned NPU RSSM (`[32, 64]`) & iGPU 2D Gray-Scott diffusion (`[1, 2, 32, 32]`)
    const npuOut = await eng.dispatchNpuWorldModel(new Float32Array(2048).fill(0.15));
    expect(npuOut.head.length).toBe(16);
    expect(Number.isFinite(npuOut.meanAbs)).toBe(true);

    const fieldUv = new Float32Array(2048);
    fieldUv.fill(1.0, 0, 1024);
    fieldUv.fill(0.25, 1024, 2048);
    const igpuOut = await eng.dispatchIgpuFieldDiffusion(fieldUv, 0.036, 0.061);
    expect(Number.isFinite(igpuOut.ms)).toBe(true);
    expect(Number.isFinite(igpuOut.meanV)).toBe(true);
  }, 25_000);
});
