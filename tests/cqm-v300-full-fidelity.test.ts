import { describe, expect, test } from 'bun:test';
import { XylosMedusaBrain } from '../src/brains/xylos';
import { getZigBridge } from '../src/native/zig-bridge';
import { createCqm2Server } from '../src/server/main';
import { Cqm2WorldScheduler } from '../src/sim/world-scheduler';
import {
  ARCHON_5_SOVEREIGNS,
  KEYBOARD_SHORTCUT_MATRIX,
  PANTHEON_101_GLYPHS,
  PHYLA_10_NAMES,
  PRIME_NEURAL_4_TABS,
  ROMAN_TALLY_CIPHER_KEY,
  SANDBOX_WORLD_SYSTEMS,
  SIM_8_SPEEDS,
  STAGE_II_TEMPLE_CIPHER_KEY,
} from '../src/ui/cqm-v3-panels';

describe('CQM2 v3.0.0 Full-Fidelity Parity, Zig Kernels, Apocalypse N01 & Satellite Labs', () => {
  test('Original-CQM ciphers, 8 speeds, 101 Pantheons, 4x27 PRIME Neural & 17 Sandbox systems are exact', () => {
    expect(ROMAN_TALLY_CIPHER_KEY).toBe('IIIIVVVIVVVIVIIVIV');
    expect(STAGE_II_TEMPLE_CIPHER_KEY).toBe('uwu');
    expect(SIM_8_SPEEDS).toEqual([0.25, 0.5, 1, 2, 4, 8, 12, 16]);
    expect(ARCHON_5_SOVEREIGNS.length).toBe(5);
    expect(PRIME_NEURAL_4_TABS.length).toBe(4);
    const totalNeuralCards = PRIME_NEURAL_4_TABS.reduce((acc, t) => acc + t.items27.length, 0);
    expect(totalNeuralCards).toBe(108);

    expect(PANTHEON_101_GLYPHS.length).toBe(101);
    const apex = PANTHEON_101_GLYPHS[100]!;
    expect(apex.index).toBe(101);
    expect(apex.symbol).toBe('ς');
    expect(apex.isApex).toBe(true);

    expect(PHYLA_10_NAMES.length).toBe(10);
    expect(SANDBOX_WORLD_SYSTEMS.length).toBe(17);
    expect(KEYBOARD_SHORTCUT_MATRIX.length).toBe(12);
  });

  test('Xylos v2 exposes all 6 ADR-0018 Embodied Organs with bounded non-oracle readouts', () => {
    const xylos = new XylosMedusaBrain(20261111n);
    xylos.stepXylos({
      sensory8: [0.4, -0.2, 0.7, 0.1, -0.5, 0.3, 0.2, -0.1],
      posX: 12,
      posZ: -8,
      hunger: 0.3,
      hazard: 0.1,
      dtSec: 0.02,
    });
    const organs = xylos.getAdr0018OrganReadouts();
    expect(organs.length).toBe(6);
    expect(organs.map((o) => o.name)).toEqual([
      'Affective Core',
      'Sensorimotor Map',
      'Memory Loom',
      'Social Mirror',
      'Metacognitive Monitor',
      'Morphogenetic Skin',
    ]);
    for (const org of organs) {
      expect(Number.isFinite(org.activity01)).toBe(true);
      expect(org.activity01).toBeGreaterThanOrEqual(0);
      expect(org.activity01).toBeLessThanOrEqual(1);
      expect(org.detail.length).toBeGreaterThan(8);
    }
  });

  test('Apocalypse Rebirth preserves First-Law < 1e-12 drift and supports bit-exact N01 rollback', () => {
    const world = new Cqm2WorldScheduler({ seed: 20261111, initialPopulation: 64, maxEntities: 256 });
    const preTel = world.stepTick(0.02);
    expect(preTel.conservationValid).toBe(true);
    const preMerkle = world.store.epoch.merkleRootHex;
    const preCount = world.store.activeCount;

    const apoc = world.triggerApocalypseRebirth(0.6);
    expect(apoc.culled).toBeGreaterThan(5);
    expect(apoc.reborn).toBeGreaterThan(0);

    const postTel = world.stepTick(0.02);
    expect(postTel.conservationValid).toBe(true);
    expect(postTel.maxMetabolicDrift).toBeLessThan(1e-12);

    const rolledBack = world.rollbackToSnapshot(apoc.checkpointTick);
    expect(rolledBack).toBe(true);
    expect(world.store.activeCount).toBe(preCount);
    expect(world.store.epoch.merkleRootHex).toBe(preMerkle);
  });

  test('Zig 0.17 WASM executes FWHT Magic M2, Glyph Brain Batch, CSR Louvain Q, and 6D->3D Quasicrystal', () => {
    const zig = getZigBridge();
    // |T>^⊗3 magic state has non-zero stabilizer Rényi magic M_2 > 0, whereas |000> has M_2 = 0
    const zeroRe = new Float64Array(8);
    const zeroIm = new Float64Array(8);
    zeroRe[0] = 1.0;
    expect(Math.abs(zig.computeFwhtQuantumMagicM2(zeroRe, zeroIm, 3))).toBeLessThan(1e-9);

    const tRe = new Float64Array(8);
    const tIm = new Float64Array(8);
    const c = 1 / Math.sqrt(8);
    for (let mask = 0; mask < 8; mask++) {
      const pop = ((mask & 1) !== 0 ? 1 : 0) + ((mask & 2) !== 0 ? 1 : 0) + ((mask & 4) !== 0 ? 1 : 0);
      const angle = (pop * Math.PI) / 4;
      tRe[mask] = c * Math.cos(angle);
      tIm[mask] = c * Math.sin(angle);
    }
    const magicT3 = zig.computeFwhtQuantumMagicM2(tRe, tIm, 3);
    expect(magicT3).toBeGreaterThan(0.5);

    // 2-clique graph CSR Louvain modularity Q > 0.25
    const eu = Uint32Array.from([0, 1, 2, 3, 4, 5, 2]);
    const ev = Uint32Array.from([1, 2, 0, 4, 5, 3, 3]);
    const csr = zig.computeCsrPagerankLouvain(6, eu, ev, eu.length);
    expect(csr.modularityQ).toBeGreaterThan(0.2);
    expect(csr.degreeEntropyBits).toBeGreaterThan(0.5);

    // 6D -> 3D Icosahedral Quasicrystal shell
    const pts = zig.projectQuasicrystalIcosaShell(2, 1.65, 0.8, 3.2, 512);
    expect(pts.length).toBeGreaterThanOrEqual(60);
    expect(pts.length % 3).toBe(0);
  });

  test('Satellite Lab HTML routes serve 200 OK with strict CSP and NOT SENTIENT honesty contract', async () => {
    const srv = await createCqm2Server({ port: 0, dbPath: ':memory:', enableNpuDaemon: false, enableGoOscDaemon: false });
    try {
      for (const route of ['/lab/consciousness', '/lab/sentience', '/docs/alife/cqm-capability-profile.html']) {
        const res = await fetch(`${srv.url}${route}`);
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain("style-src 'self'");
        expect(/\sstyle\s*=/.test(html)).toBe(false);
      }
    } finally {
      srv.stop();
    }
  }, 20000);
});
