import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_INITIAL_POOLS_15,
  ingestConservedMealKj,
  P_ATP_BUF,
  P_BLD_GLC,
  P_HEAT_WORK,
  P_LACTATE,
  stepPopulationMetabolism,
  transferConservedPoolKj,
} from '../src/brains/metabolism';
import { sanitizeGodDials, SubstreamPrngHub } from '../src/core/prng';
import { ErpRelationalStore } from '../src/erp/relational-store';
import { getZigBridge } from '../src/native/zig-bridge';
import {
  computeExactHoggarBoundBigInt,
  computeRelativisticPhotonRingMetrics,
  evaluateHoggarContextuality,
  sampleHealthyQrngBatch,
  SCHWARZSCHILD_B_CRIT_OVER_M,
  ZeroGcQuantumRegister,
} from '../src/quantum/contextuality';
import {
  decodeGlossodromRs15_11,
  encodeGlossodromRs15_11,
  projectZooidStrandS3ToR3,
  synthesizeTaxonomicIdentity,
} from '../src/quantum/xenolinguistics';
import { Cqm2WorldScheduler } from '../src/sim/world-scheduler';

describe('Conservation Laws, Relativistic Geodesics, Quantum Contextuality & Determinism', () => {
  test('T-066 / T-068: First-Law 15-pool metabolic energy conservation holds < 1e-12 under normoxia and hypoxia', () => {
    const store = new ErpRelationalStore(16);
    store.registerBiome({
      biomeId: 1,
      epochId: 1,
      name: 'Vent',
      kind: 'HYDROTHERMAL_ABYSS',
      centerX: 0,
      centerZ: 0,
      radius: 40,
      nutrientPoolKj: 2000,
      detritusPoolKj: 10,
      o2Saturation: 1.0,
      osmolarityMOsM: 300,
      temperatureK: 305,
    });
    store.registerSpecies({
      speciesId: 1,
      parentSpeciesId: null,
      originTick: 0,
      casteRole: 'EXPLORER',
      latinBinomial: 'Asmodenius primigenius',
      commonGlyph: '◈',
      genomeHashHex: '0x01',
      baseHueDeg: 195,
      extantCount: 0,
      meanFitness: 1,
    });

    const e0 = store.spawnOrganism({
      speciesId: 1,
      biomeId: 1,
      generation: 1,
      flawMask: 0,
      pos: [0, 1, 0],
      headingRad: 0,
      initialPools15: DEFAULT_INITIAL_POOLS_15,
      initialWeights126: new Float32Array(126),
    });

    // Normoxic foraging + metabolism
    for (let i = 0; i < 40; i++) {
      ingestConservedMealKj(store, e0, 2.5, 0.6, 0.2);
      stepPopulationMetabolism(store, 0.1, { metabolicRateScale: 1.2, oxygenSaturation: 1.0 });
    }

    // Severe hypoxia (`oxygenSaturation = 0.05`) -> triggers anaerobic glycolysis + lactate accumulation!
    store.o2Reserve[e0] = 0.1;
    transferConservedPoolKj(store.pools15, e0 * 15, P_ATP_BUF, P_HEAT_WORK, 6.5); // induce conserved ATP work demand
    for (let i = 0; i < 15; i++) {
      stepPopulationMetabolism(store, 0.1, { metabolicRateScale: 1.5, oxygenSaturation: 0.05 });
    }
    expect(store.pools15[e0 * 15 + P_LACTATE]!).toBeGreaterThan(0.25);

    let sumPools = 0;
    for (let k = 0; k < 15; k++) sumPools += store.pools15[e0 * 15 + k]!;
    const relDrift = Math.abs(sumPools - store.totalIntakeKj[e0]!) / store.totalIntakeKj[e0]!;
    expect(relDrift).toBeLessThan(1e-12);
    expect(store.pools15[e0 * 15 + P_BLD_GLC]!).toBeGreaterThan(0);
  });

  test('T-067: Zero-GC Quantum Register preserves unitary norm < 1e-12 over 500 steps with PSD Fubini-Study metric', () => {
    const qreg = new ZeroGcQuantumRegister(8);
    for (let step = 0; step < 500; step++) {
      qreg.evolveUnitaryStep(0.073, 0.041 * (step % 7));
    }
    const geom = qreg.sampleQuantumGeometry();
    expect(geom.normDrift).toBeLessThan(1e-12);
    expect(geom.fubiniStudyGxx).toBeGreaterThanOrEqual(0);
    expect(geom.fubiniStudyGyy).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(geom.berryCurvatureXY)).toBe(true);
  });

  test('T-069: Hoggar 3-qubit symplectic W(5,2) census = 315 lines, H(2) = 63 violated lines, trace = 14.0 & 60-qubit BigInt safety', () => {
    const rep = evaluateHoggarContextuality(3);
    expect(rep.totalIsotropicLines).toBe(315);
    expect(rep.violatedHexagonH2Lines).toBe(63);
    expect(Math.abs(rep.fubiniStudyTrace - 14.0)).toBeLessThan(1e-9);
    expect(rep.contextualFraction).toBeGreaterThan(0.2);

    const big60 = computeExactHoggarBoundBigInt(60);
    expect(big60.hilbertDim).toBe(1n << 60n);
    expect(big60.isotropicLinesFormula > (1n << 100n)).toBe(true);
  });

  test('T-070: Schwarzschild photon geodesic captures inside sqrt(27)*M and scatters outside + Kerr g^4 beaming', () => {
    const zig = getZigBridge();
    expect(Math.abs(SCHWARZSCHILD_B_CRIT_OVER_M - 5.1961524227)).toBeLessThan(1e-7);

    const inside = zig.schwarzschildPhotonDeflection(5.12, 4000);
    const outside = zig.schwarzschildPhotonDeflection(6.50, 4000);
    expect(inside.captured).toBe(true);
    expect(outside.captured).toBe(false);
    expect(outside.deflectionRad).toBeGreaterThan(0.5);

    const kerr = computeRelativisticPhotonRingMetrics(0.92, 1.2, 0.8);
    expect(kerr.progradeIscoOverM).toBeLessThan(6.0);
    expect(kerr.progradeIscoOverM).toBeGreaterThan(1.5);
    expect(kerr.beamedIntensityG4).toBeGreaterThan(1.0);
  });

  test('T-071 / T-075 / T-080: Bitwise seeded substream determinism, adaptive step-halving, and zero NaN/Infinity', () => {
    const hub1 = new SubstreamPrngHub(987654321n);
    const hub2 = new SubstreamPrngHub(987654321n);

    // Advance `flaw` and `ui` 500 times on hub1 ONLY -> `world` stream must remain 100% identical!
    for (let i = 0; i < 500; i++) {
      hub1.stream('flaw').nextFloat();
      hub1.stream('ui').nextGaussian();
    }
    for (let i = 0; i < 50; i++) {
      expect(hub1.stream('world').nextU64()).toBe(hub2.stream('world').nextU64());
    }

    const snap = hub1.snapshotStates();
    const expectedNext = hub1.stream('genome').nextU64();
    hub1.restoreStates(snap);
    expect(hub1.stream('genome').nextU64()).toBe(expectedNext);

    // Full WorldScheduler determinism + large dt step-halving stability
    const wA = new Cqm2WorldScheduler({ seed: 77777, initialPopulation: 48 });
    const wB = new Cqm2WorldScheduler({ seed: 77777, initialPopulation: 48 });
    let telA = wA.stepTick(0.16); // triggers substeps = 2!
    let telB = wB.stepTick(0.16);
    for (let t = 0; t < 30; t++) {
      telA = wA.stepTick(0.05);
      telB = wB.stepTick(0.05);
    }
    expect(telA.merkleRootHex).toBe(telB.merkleRootHex);
    expect(telA.conservationValid).toBe(true);
    expect(telA.maxMetabolicDrift).toBeLessThan(1e-12);
    expect(Number.isFinite(telA.eshkolMeanSpineCurvature)).toBe(true);
    expect(Number.isFinite(telA.reactiveSkinMeanPattern)).toBe(true);

    // God-Dial safety clamps (WCAG <= 2.2 Hz & Lipschitz <= 0.45)
    const clamped = sanitizeGodDials({ maxVisualPulseHz: 99.0, manifoldWarpGain: 10.0, kerrSpinA: 5.0 });
    expect(clamped.maxVisualPulseHz).toBeLessThanOrEqual(2.2);
    expect(clamped.manifoldWarpGain).toBeLessThanOrEqual(0.45);
    expect(clamped.kerrSpinA).toBeLessThanOrEqual(0.998);
  });

  test('T-072 / T-074: NIST SP 800-90B QRNG health & Glossodrom RS[15,11] 2-symbol self-healing + Thingmaker isolation', () => {
    const qrng = sampleHealthyQrngBatch(20261110n, 256);
    expect(qrng.rctHealthy).toBe(true);
    expect(qrng.aptHealthy).toBe(true);
    expect(qrng.shannonBitsPerByte).toBeGreaterThan(4.5);

    const msg = Uint8Array.from([15, 0, 14, 1, 13, 2, 12, 3, 11, 4, 10]);
    const cw = encodeGlossodromRs15_11(msg);
    expect(decodeGlossodromRs15_11(cw).correctedSymbolCount).toBe(0);

    // 1-symbol error
    const err1 = cw.slice();
    err1[6] = err1[6]! ^ 0x09;
    const dec1 = decodeGlossodromRs15_11(err1);
    expect(dec1.uncorrectable).toBe(false);
    expect(dec1.correctedSymbolCount).toBe(1);
    expect(Array.from(dec1.message11)).toEqual(Array.from(msg));

    // 2-symbol errors at arbitrary positions (data + parity)
    const err2 = cw.slice();
    err2[0] = err2[0]! ^ 0x0e;
    err2[14] = err2[14]! ^ 0x07;
    const dec2 = decodeGlossodromRs15_11(err2);
    expect(dec2.uncorrectable).toBe(false);
    expect(dec2.correctedSymbolCount).toBe(2);
    expect(Array.from(dec2.message11)).toEqual(Array.from(msg));

    const pts3d = projectZooidStrandS3ToR3(cw, 0.5);
    expect(pts3d.length).toBe(45);
    expect(pts3d.every((v) => Number.isFinite(v))).toBe(true);

    const tax1 = synthesizeTaxonomicIdentity(42n, 1, 'EXPLORER');
    const tax2 = synthesizeTaxonomicIdentity(42n, 1, 'EXPLORER');
    expect(tax1.latinBinomial).toBe(tax2.latinBinomial);
  });
});
