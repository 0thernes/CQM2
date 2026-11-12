import { describe, expect, test } from 'bun:test';
import { getZigBridge } from '../src/native/zig-bridge';

describe('CQM2 v5.0.0 Zig 49-Kernel Suite (ALife v3.0, Philox4x32-10, Forked PCI*, CSR Guard, SuperMind REA & ResourceHead)', () => {
  const bridge = getZigBridge();

  test('Philox4x32-10 counter PRNG enforces deterministic domain isolation in [0, 1)', () => {
    const streamA1 = bridge.philox4x32Batch(0x12345678, 0x9abcdef0, 42, 1, 0, 16);
    const streamA2 = bridge.philox4x32Batch(0x12345678, 0x9abcdef0, 42, 1, 0, 16);
    const streamB = bridge.philox4x32Batch(0x12345678, 0x9abcdef0, 42, 2, 0, 16);

    expect(streamA1.length).toBe(16);
    for (let i = 0; i < 16; i++) {
      expect(streamA1[i]).toBeGreaterThanOrEqual(0);
      expect(streamA1[i]).toBeLessThan(1);
      expect(streamA1[i]).toBe(streamA2[i]);
    }
    expect(streamA1[0]).not.toBe(streamB[0]);
  });

  test('ALife v3.0 11-pool closed FP64 Kahan-Babuška-Neumaier ledger holds drift <= 1e-12 over 1,000 steps', () => {
    const pools13 = new Float64Array([620, 410, 185, 92, 64, 38, 28, 0, 0, 0, 0, 0, 1437]);
    for (let step = 0; step < 1000; step++) {
      const drift = bridge.stepAlifeV3Ledger11(pools13, 0.35, 0.22, 0.05, 0.03, 0.02, 0.04, 0.01, 0.005);
      expect(drift).toBeLessThanOrEqual(1e-12);
    }
    expect(pools13[9]).toBeGreaterThan(0); // Physical Landauer/metabolic heat sink accumulated monotonically
  });

  test('Non-destructive forked-snapshot PCI* (LZ76) leaves live neural state completely unmutated', () => {
    const liveState = new Float32Array([0.2, -0.3, 0.5, -0.1, 0.4, -0.2, 0.1, 0.3]);
    const beforeCopy = new Float32Array(liveState);
    const couplings = new Float32Array(64);
    for (let k = 0; k < 8; k++) {
      couplings[k * 8 + ((k + 1) % 8)] = 0.85;
    }

    const pci = bridge.pciLzForkedSnapshot(liveState, couplings, 8, 0, 1.2, 16);
    expect(pci).toBeGreaterThanOrEqual(0);
    expect(pci).toBeLessThanOrEqual(1);
    expect(Array.from(liveState)).toEqual(Array.from(beforeCopy));
  });

  test('Incremental CSR spectral guard clamps supercritical synaptic weights down to maxRho <= 0.99', () => {
    const rowPtr = new Uint32Array([0, 1, 2]);
    const colIdx = new Uint32Array([0, 1]);
    const vals = new Float32Array([2.5, 2.5]);
    const uVec = new Float32Array([Math.SQRT1_2, Math.SQRT1_2]);

    const sigma = bridge.stepSpectralGuardCsr(2, rowPtr, colIdx, vals, uVec, 0.99);
    expect(Math.abs(sigma - 0.99)).toBeLessThan(1e-3);
    expect(vals[0]!).toBeLessThanOrEqual(1.0);
  });

  test('10,081-parameter Archon SuperMind computes 16 cognitive telemetry stats including REA (#10)', () => {
    const in16 = new Float32Array(16).fill(0.25);
    const params10081 = new Float32Array(10081).fill(0.02);
    const out24 = new Float32Array(24);
    const stats16 = new Float32Array(16);

    const { rea, nextMemSlot } = bridge.stepSuperMind10k(in16, params10081, 0, 0.18, 0.88, out24, stats16);
    expect(rea).toBeGreaterThanOrEqual(0.05);
    expect(rea).toBeLessThanOrEqual(0.99);
    expect(Math.abs(rea - stats16[9]!)).toBeLessThan(1e-6);
    expect(nextMemSlot).toBe(1);
  });

  test('51-parameter EntityResourceHead outputs bounded [0, 1] economic bids for Matter & Energy', () => {
    const inputs8 = new Float32Array([0.5, -0.2, 0.8, 0.1, -0.4, 0.3, 0.6, -0.1]);
    const weights51 = new Float32Array(51).fill(0.15);
    const outputs3 = new Float32Array(3);

    bridge.stepEntityResourceHead51Batch(inputs8, weights51, outputs3, 1);
    for (let k = 0; k < 3; k++) {
      expect(outputs3[k]!).toBeGreaterThan(0);
      expect(outputs3[k]!).toBeLessThan(1);
    }
  });
});
