import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { getTsotchkeNativeBridge } from '../src/native/tsotchke-bridge';
import { getZigBridge } from '../src/native/zig-bridge';
import { createCqm2Server } from '../src/server/main';

describe('Tsotchke Native C17/C++20 Bridge (Moonlab + libirrep + Eshkol + RosettaWire + Zig Parity)', () => {
  test('loads cqm2_tsotchke_native.dll and binds Moonlab v0.8.0 + libirrep v1.3.0 on Windows x64', async () => {
    const ts = getTsotchkeNativeBridge();
    const status = await ts.init();
    expect(status.rosetteWireProtocol).toBe('ROSETTE-MOONLAB/1');
    expect(status.rsc1Ready).toBe(true);
    expect(status.rsw1FailClosed).toBe(true);
    expect(status.eshkolNativeAdReady).toBe(true);

    const hasLocalNativeDll =
      process.platform === 'win32' &&
      existsSync(join(import.meta.dir, '..', 'native', 'bin', 'cqm2_tsotchke_native.dll'));
    if (hasLocalNativeDll) {
      expect(status.dllLoaded).toBe(true);
      expect(status.csrGraphNative).toBe(true);
      expect(status.fwhtMagicNative).toBe(true);
      expect(status.apexOracleNative).toBe(true);
      if (existsSync('z:/[Vibe Coded (AI)]/CLAUDECODE/moonlab (Tsotchke)/build/libquantumsim.dll')) {
        expect(status.moonlabLoaded).toBe(true);
      }
      if (existsSync('z:/[Vibe Coded (AI)]/CLAUDECODE/libirrep (Tsotchke)/build/liblibirrep.dll')) {
        expect(status.libirrepLoaded).toBe(true);
      }
    }
  });

  test('verifies RosettaWire RSC1 SHA-256 CID, RSW1 fail-closed fault latching, $float JSON, and linear port ownership', async () => {
    const ts = getTsotchkeNativeBridge();
    await ts.init();

    const payload = new Uint8Array([0x43, 0x51, 0x4d, 0x32, 0xde, 0xad, 0xbe, 0xef]);
    const rsc1 = ts.encodeAndVerifyRsc1('cqm2/rosette/test', 'application/octet-stream', payload);
    expect(rsc1.verified).toBe(true);
    expect(rsc1.cid.startsWith('sha256:')).toBe(true);
    expect(rsc1.payloadLen).toBe(payload.length);
    // Big-endian magic 'RSC1'
    expect(Array.from(rsc1.encodedBytes.subarray(0, 4))).toEqual([0x52, 0x53, 0x43, 0x31]);

    const rsw1 = ts.testRsw1FailClosedStream(17);
    expect(rsw1.openAccepted).toBe(true);
    expect(rsw1.dataAccepted).toBe(true);
    expect(rsw1.tamperRejected).toBe(true);
    expect(rsw1.postFaultLatched).toBe(true);

    const floatJson = ts.canonicalRosetteFloatJson(-0.0);
    expect(floatJson).not.toBeNull();
    expect(floatJson!.includes('"$float"')).toBe(true);
    expect(ts.canonicalRosetteFloatJson(Number.NaN)).toBeNull();
    expect(ts.canonicalRosetteFloatJson(Number.POSITIVE_INFINITY)).toBeNull();

    // Linear port ownership: mode 0=:owned, 1=:borrowed, 2=:shared
    const validPorts = ts.verifyLinearPortOwnership(4, new Uint32Array([0, 1, 1, 2]), new Uint8Array([0, 2, 2, 1]));
    expect(validPorts.valid).toBe(true);
    expect(validPorts.offendingPort).toBeNull();

    // Double :owned consumer on port 0 MUST fail!
    const doubleOwned = ts.verifyLinearPortOwnership(4, new Uint32Array([0, 0]), new Uint8Array([0, 0]));
    if (ts.getStatus().dllLoaded) {
      expect(doubleOwned.valid).toBe(false);
      expect(doubleOwned.offendingPort).toBe(0);
    }
  });

  test('executes real Moonlab QRNG, QGTL QWZ Chern topology, Ising annealer, and libirrep SU(2) Clebsch-Gordan', async () => {
    const ts = getTsotchkeNativeBridge();
    await ts.init();

    const qrng = ts.drawMoonlabQrng(32);
    expect(qrng.bytes.byteLength).toBe(32);
    expect(qrng.averageChsh).toBeGreaterThan(2.0);
    let nonZero = 0;
    for (const b of qrng.bytes) if (b !== 0) nonZero++;
    expect(nonZero).toBeGreaterThan(8);

    // QWZ topological insulator: |M| < 2 has Chern C = +-1, |M| > 2 is trivial C = 0
    const topo = ts.sampleQgtlQwzGeometry(1.0, 0.3, -0.4, 24);
    expect(Math.abs(topo.chernNumber)).toBe(1);
    expect(topo.metricTrace).toBeGreaterThanOrEqual(0);

    const trivial = ts.sampleQgtlQwzGeometry(3.2, 0.3, -0.4, 24);
    expect(trivial.chernNumber).toBe(0);

    // Ferromagnetic 3-spin Ising chain J_01 = J_12 = -1 -> ground energy <= -2
    const hVec = new Float64Array([0, 0, 0]);
    const jMat = new Float64Array([0, -1, 0, -1, 0, -1, 0, -1, 0]);
    const ising = ts.annealMoonlabIsing(3, hVec, jMat, 1337n);
    expect(ising.groundEnergy).toBeLessThanOrEqual(-1.99);
    expect(ising.bestEnergy).toBeLessThanOrEqual(0);

    // Orbital angular momentum Clebsch-Gordan <1, +1; 1, -1 | 2, 0> = 1/sqrt(6) and <1, +1; 1, +1 | 2, +2> = 1.0
    const cg20 = ts.clebschGordan(1, 1, 1, -1, 2, 0);
    expect(Math.abs(cg20 - 1 / Math.sqrt(6))).toBeLessThan(1e-9);
    const cg22 = ts.clebschGordan(1, 1, 1, 1, 2, 2);
    expect(Math.abs(cg22 - 1.0)).toBeLessThan(1e-9);
  }, 45000);

  test('verifies Eshkol HyperDual exact 2nd-order mixed derivative, FWHT Magic M_2(|T>), CSR Louvain Q, and Zig WASM parity', async () => {
    const ts = getTsotchkeNativeBridge();
    const zig = getZigBridge();
    await ts.init();

    // V(x,y) = sin(x)cos(y) + c*exp(-x*y)
    const x = 0.65;
    const y = 0.42;
    const c = 0.5;
    const hd = ts.eshkolHyperDualPotential(x, y, c);
    const exactDxy = -Math.cos(x) * Math.sin(y) + c * Math.exp(-x * y) * (x * y - 1);
    expect(Math.abs(hd.dxy - exactDxy)).toBeLessThan(1e-12);

    // Stabilizer state |+> = (|0>+|1>)/sqrt(2) -> M_2 = 0; Magic |T> -> M_2 = log2(4/3)
    const s2 = Math.SQRT1_2;
    const mPlus = ts.computeFwhtQuantumMagicM2(new Float64Array([s2, s2]), new Float64Array([0, 0]), 1);
    expect(Math.abs(mPlus)).toBeLessThan(1e-9);

    const tRe = new Float64Array([s2, s2 * s2]);
    const tIm = new Float64Array([0, s2 * s2]);
    const mTNative = ts.computeFwhtQuantumMagicM2(tRe, tIm, 1);
    const mTZig = zig.computeFwhtQuantumMagicM2(tRe, tIm, 1);
    const expectedM2 = Math.log2(4 / 3);
    expect(Math.abs(mTNative - expectedM2)).toBeLessThan(1e-9);
    expect(Math.abs(mTZig - expectedM2)).toBeLessThan(1e-9);

    // Two cliques of 4 nodes connected by 1 bridge -> Louvain Q > 0.30 on BOTH C++20 CSR and Zig WASM CSR!
    const uEdges: number[] = [];
    const vEdges: number[] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        uEdges.push(i, i + 4);
        vEdges.push(j, j + 4);
      }
    }
    uEdges.push(3);
    vEdges.push(4);
    const u32 = Uint32Array.from(uEdges);
    const v32 = Uint32Array.from(vEdges);

    const csrNative = ts.computeCsrPagerankLouvain(8, u32, v32, u32.length);
    const csrZig = zig.computeCsrPagerankLouvain(8, u32, v32, u32.length);
    expect(csrNative.modularityQ).toBeGreaterThan(0.3);
    expect(csrZig.modularityQ).toBeGreaterThan(0.3);
    expect(Math.abs(csrNative.degreeEntropyBits - csrZig.degreeEntropyBits)).toBeLessThan(1e-4);

    // 6D -> 3D Icosahedral Quasicrystal Shell parity
    const qcNative = ts.projectQuasicrystalIcosaShell(2, 1.65, 0.5, 3.5, 512);
    const qcZig = zig.projectQuasicrystalIcosaShell(2, 1.65, 0.5, 3.5, 512);
    expect(qcNative.length).toBeGreaterThan(30);
    expect(qcNative.length).toBe(qcZig.length);
  });

  test('serves /api/v1/tsotchke/native, /api/v1/connectome/csr, and /api/v1/eshkol/eval cleanly', async () => {
    const srv = await createCqm2Server({ port: 0, dbPath: ':memory:', enableNpuDaemon: false, enableGoOscDaemon: false });
    try {
      const r1 = await fetch(`${srv.url}/api/v1/tsotchke/native`);
      expect(r1.status).toBe(200);
      const j1 = (await r1.json()) as { ok: boolean; rosetteWire: { rsc1Verified: boolean }; fwhtStabilizerMagicM2: number };
      expect(j1.ok).toBe(true);
      expect(j1.rosetteWire.rsc1Verified).toBe(true);
      expect(Math.abs(j1.fwhtStabilizerMagicM2 - Math.log2(4 / 3))).toBeLessThan(1e-6);

      const r2 = await fetch(`${srv.url}/api/v1/connectome/csr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numNodes: 6, edgeU: [0, 1, 2, 3, 4], edgeV: [1, 2, 0, 4, 5] }),
      });
      expect(r2.status).toBe(200);
      const j2 = (await r2.json()) as { ok: boolean; modularityQ: number };
      expect(j2.ok).toBe(true);
      expect(j2.modularityQ).toBeGreaterThan(0.1);

      const r3 = await fetch(`${srv.url}/api/v1/eshkol/eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: 0.5, y: 0.25, coupling: 0.5, schemeExpr: '(display (+ (* 6 7) 0))' }),
      });
      expect(r3.status).toBe(200);
      const j3 = (await r3.json()) as { ok: boolean; hyperDual: { dxy: number }; cliResult?: { ok: boolean; output: string } };
      expect(j3.ok).toBe(true);
      expect(Number.isFinite(j3.hyperDual.dxy)).toBe(true);
    } finally {
      srv.stop();
    }
  }, 20000);
});
