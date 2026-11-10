import { describe, expect, test } from 'bun:test';
import { getTriEngine } from '../src/native/tri-engine';
import { getZigBridge } from '../src/native/zig-bridge';

describe('Polyglot Tri-Engine (CUDA / NPU / Rust / Zig SIMD128 / AVX2 ASM) Parity & Invariants', () => {
  test('Zig SIMD128 Verlet soft-body solver, Eshkol spine curvature, and hormone reactive skin execute cleanly', () => {
    const zig = getZigBridge();

    // 1. Eshkol Taylor jet curvature on circular arc of radius R = 4.0 -> kappa ~= 0.25!
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

    // 2. LCG-shuffled Verlet soft-body step
    const pos = Float32Array.from([0, 2, 0, 1.5, 2, 0, 3.0, 2, 0]);
    const prev = pos.slice();
    const invMass = Float32Array.from([1, 1, 1]);
    const edgeA = Uint16Array.from([0, 1]);
    const edgeB = Uint16Array.from([1, 2]);
    const rest = Float32Array.from([1.0, 1.0]);
    const stiff = Float32Array.from([0.8, 0.8]);
    const nextRng = zig.stepVerletShuffled(pos, prev, invMass, edgeA, edgeB, rest, stiff, 0.016, -9.81, 12345);
    expect(nextRng).not.toBe(12345);
    expect(pos.every((v) => Number.isFinite(v))).toBe(true);

    // 3. Pauli commutativity & line sign
    // 1-qubit X (u=1) and Z (v=2) anticommute!
    expect(zig.pauliCommute(1, 2, 1)).toBe(false);
    // 2-qubit XX (a=3,c=0 => 3) and ZZ (a=0,c=3 => 12) commute!
    expect(zig.pauliCommute(3, 12, 2)).toBe(true);
    // XX * ZZ = -YY => violated line sign = -1!
    expect(zig.pauliLineSign(3, 12, 2)).toBe(-1);
  });

  test('TriEngineOrchestrator GPU/CPU GEMM, ASM micro-cortex, Rust conservation & NPU latent fallback', async () => {
    const eng = getTriEngine();
    const topo = await eng.init({ enableNpuDaemon: false });
    expect(topo.zigSimdReady).toBe(true);

    const M = 16;
    const N = 16;
    const K = 16;
    const A = new Float32Array(M * K).fill(0.1);
    const B = new Float32Array(K * N).fill(0.2);
    const C = new Float32Array(M * N);
    const gemm = eng.dispatchGpuCortexGemm(A, B, C, M, N, K);
    expect(gemm.elapsedMs).toBeGreaterThan(0);
    // Each dot product = 16 * 0.1 * 0.2 = 0.32; tanh(0.32) ~= 0.3095
    expect(Math.abs(C[0]! - Math.tanh(0.32))).toBeLessThan(0.005);

    const inVec = new Float32Array(8).fill(0.5);
    const wMat = new Float32Array(4 * 8).fill(0.25);
    const bias = new Float32Array(4).fill(0.1);
    const outVec = new Float32Array(4);
    eng.dispatchAsmMicroCortex(inVec, wMat, bias, outVec);
    // dot = 8 * 0.5 * 0.25 + 0.1 = 1.1; Pade_[3/2](x) = x*(27 + x^2) / (27 + 9*x^2) = 0.818976
    const expectedPade = (1.1 * (27 + 1.1 * 1.1)) / (27 + 9 * 1.1 * 1.1);
    expect(Math.abs(outVec[0]! - expectedPade)).toBeLessThan(1e-5);
    expect(Math.abs(outVec[0]! - Math.tanh(1.1))).toBeLessThan(0.02);

    expect(eng.pauliCommute64(1n, 0n, 0n, 1n)).toBe(false);
    expect(eng.pauliCommute64(3n, 0n, 0n, 3n)).toBe(true);

    const h1 = eng.hashBytes64(new Uint8Array([1, 2, 3, 4]));
    const h2 = eng.hashBytes64(new Uint8Array([1, 2, 3, 4]));
    expect(h1).toBe(h2);

    const root1 = eng.merkleRoot64(BigUint64Array.from([11n, 22n, 33n, 44n]));
    const root2 = eng.merkleRoot64(BigUint64Array.from([11n, 22n, 33n, 44n]));
    expect(root1).toBe(root2);

    // Valid conservation vs intentional 1e-4 violation detection!
    const validPools = new Float64Array(15).fill(10.0);
    const validIntake = new Float64Array([150.0]);
    expect(eng.auditMetabolicConservation(validPools, validIntake, 1).valid).toBe(true);

    const brokenIntake = new Float64Array([150.05]);
    expect(eng.auditMetabolicConservation(validPools, brokenIntake, 1).valid).toBe(false);

    const npuOut = await eng.dispatchNpuWorldModel(new Float32Array(2048).fill(0.15));
    expect(npuOut.head.length).toBe(8);
    expect(Number.isFinite(npuOut.meanAbs)).toBe(true);
  }, 25_000);
});
