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
  resolveDrivesViaIsingVqe,
  sampleHealthyQrngBatch,
  SCHWARZSCHILD_B_CRIT_OVER_M,
  verifyKochenSpeckerRaySet,
  ZeroGcQuantumRegister,
} from '../src/quantum/contextuality';
import {
  computeBardeenKerrShadowLocus,
  computeKerrThermodynamics,
  computeLeaverKerrQnmSpectrum,
  traceKerrMinoRay,
} from '../src/quantum/kerr-relativity';
import {
  applyProjectiveAblationDedup,
  braidFibonacciAnyonWord,
  KHORA_CODON_TABLE,
  sampleHopfFiberR3,
} from '../src/quantum/voynich-khora';
import {
  decodeGlossodromRs15_11,
  encodeCormidium16,
  encodeGlossodromRs15_11,
  healCormidium16Erasures,
  projectZooidStrandS3ToR3,
  ReversibleXglossVm,
  synthesizeTaxonomicIdentity,
} from '../src/quantum/xenolinguistics';
import { computeLorenzGini, COSMOLOGICAL_SINGULARITIES_5 } from '../src/sim/ecology';
import { Cqm2WorldScheduler } from '../src/sim/world-scheduler';

describe('Conservation Laws, 3D Kerr Geodesics, Kochen-Specker Contextuality, Anyons & Bit-Exact Replay', () => {
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

    for (let i = 0; i < 40; i++) {
      ingestConservedMealKj(store, e0, 2.5, 0.6, 0.2);
      stepPopulationMetabolism(store, 0.1, { metabolicRateScale: 1.2, oxygenSaturation: 1.0 });
    }

    store.o2Reserve[e0] = 0.1;
    transferConservedPoolKj(store.pools15, e0 * 15, P_ATP_BUF, P_HEAT_WORK, 6.5);
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

  test('T-067 / T-069: Zero-GC Quantum Register, Hoggar H(2)=63, Cabello KS-18 parity proof & 4-qubit Ising VQE', () => {
    const qreg = new ZeroGcQuantumRegister(8);
    for (let step = 0; step < 500; step++) {
      qreg.evolveUnitaryStep(0.073, 0.041 * (step % 7));
    }
    const geom = qreg.sampleQuantumGeometry();
    expect(geom.normDrift).toBeLessThan(1e-12);
    expect(geom.fubiniStudyGxx).toBeGreaterThanOrEqual(0);
    expect(geom.fubiniStudyGyy).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(geom.berryCurvatureXY)).toBe(true);

    const rep = evaluateHoggarContextuality(3);
    expect(rep.totalIsotropicLines).toBe(315);
    expect(rep.violatedHexagonH2Lines).toBe(63);
    expect(Math.abs(rep.fubiniStudyTrace - 14.0)).toBeLessThan(1e-9);
    expect(rep.contextualFraction).toBeGreaterThan(0.2);

    const big60 = computeExactHoggarBoundBigInt(60);
    expect(big60.hilbertDim).toBe(1n << 60n);
    expect(big60.isotropicLinesFormula > (1n << 100n)).toBe(true);

    // State-independent Kochen-Specker 18-vector 9-tetrad parity proof + KS-29/31/33 catalog
    const ks18 = verifyKochenSpeckerRaySet('KS-18');
    expect(ks18.dimension).toBe(4);
    expect(ks18.rayCount).toBe(18);
    expect(ks18.contextCount).toBe(9);
    expect(ks18.orthogonalContextsVerified).toBe(true);
    expect(ks18.parityContradictionProven).toBe(true);
    expect(verifyKochenSpeckerRaySet('KS-31').parityContradictionProven).toBe(true);
    expect(verifyKochenSpeckerRaySet('KS-33').parityContradictionProven).toBe(true);

    // 4-qubit frustrated Ising VQE drive resolver (`b45-metacog`)
    const vqeHighConf = resolveDrivesViaIsingVqe([0.9, 0.85, 0.8, 0.2], 0.95, 24);
    const vqeLowConf = resolveDrivesViaIsingVqe([0.9, 0.85, 0.8, 0.2], 0.1, 24);
    expect(vqeHighConf.resolvedWeights4.length).toBe(4);
    expect(vqeHighConf.groundEnergy).toBeLessThan(vqeLowConf.groundEnergy + 1e-6);
  });

  test('T-070: 3D Spinning Kerr Mino geodesic conserves Carter Q < 1e-12, Bardeen D-shadow, Leaver QNM & Penrose bound', () => {
    const zig = getZigBridge();
    expect(Math.abs(SCHWARZSCHILD_B_CRIT_OVER_M - 5.1961524227)).toBeLessThan(1e-7);

    const inside = zig.schwarzschildPhotonDeflection(5.12, 4000);
    const outside = zig.schwarzschildPhotonDeflection(6.5, 4000);
    expect(inside.captured).toBe(true);
    expect(outside.captured).toBe(false);
    expect(outside.deflectionRad).toBeGreaterThan(0.5);

    // Coupled 3D Boyer-Lindquist Mino-time Kerr geodesic (`cqm2_kerr_mino_geodesic`)
    const rayScat = traceKerrMinoRay(0.92, 1.25, -6.8, 12.0);
    expect(rayScat.captured).toBe(false);
    expect(rayScat.carterRelDrift).toBeLessThan(1e-12);
    expect(Math.abs(rayScat.phiAccum)).toBeGreaterThan(0.2);

    const rayCap = traceKerrMinoRay(0.92, 1.25, 0.5, 2.0);
    expect(rayCap.captured).toBe(true);
    expect(rayCap.carterRelDrift).toBeLessThan(1e-12);

    // Bardeen closed-form asymmetric D-shaped shadow locus
    const shadow = computeBardeenKerrShadowLocus(0.95, Math.PI / 2, 64);
    expect(shadow.length).toBeGreaterThan(20);
    const minAlpha = Math.min(...shadow.map((p) => p.alpha));
    const maxAlpha = Math.max(...shadow.map((p) => p.alpha));
    expect(Math.abs(maxAlpha) - Math.abs(minAlpha)).toBeGreaterThan(1.0); // Prograde D-flattening asymmetry!

    // Leaver QNM spectrum & Kerr Hawking-Penrose thermodynamics
    const qnms = computeLeaverKerrQnmSpectrum(0.85);
    expect(qnms.length).toBe(3);
    expect(qnms[0]!.omegaRealOverM).toBeGreaterThan(0.5);
    expect(qnms[0]!.omegaImagOverM).toBeLessThan(0);

    const thermo = computeKerrThermodynamics(0.998);
    expect(thermo.outerHorizonOverM).toBeGreaterThan(1.0);
    expect(thermo.penroseExtractableFraction).toBeLessThanOrEqual(1.0 - Math.SQRT1_2 + 1e-6);

    const kerr = computeRelativisticPhotonRingMetrics(0.92, 1.2, 0.8);
    expect(kerr.progradeIscoOverM).toBeLessThan(6.0);
    expect(kerr.beamedIntensityG4).toBeGreaterThan(1.0);
  });

  test('T-071 / T-075 / T-080: Bit-exact WorldSnapshot rollback & replay produces identical Merkle roots + ecology conservation', () => {
    const hub1 = new SubstreamPrngHub(987654321n);
    const hub2 = new SubstreamPrngHub(987654321n);
    for (let i = 0; i < 500; i++) {
      hub1.stream('flaw').nextFloat();
      hub1.stream('ui').nextGaussian();
    }
    for (let i = 0; i < 50; i++) {
      expect(hub1.stream('world').nextU64()).toBe(hub2.stream('world').nextU64());
    }

    // Full WorldScheduler determinism + bit-exact N01 captureWorldSnapshot / rollbackToSnapshot replay!
    const wA = new Cqm2WorldScheduler({ seed: 77777, initialPopulation: 48 });
    for (let t = 0; t < 6; t++) wA.stepTick(0.05);

    const snap = wA.captureWorldSnapshot();
    const tickAtSnap = snap.tick;

    let telRun1 = wA.stepTick(0.05);
    for (let t = 0; t < 12; t++) telRun1 = wA.stepTick(0.05);
    const merkleAfterRun1 = telRun1.merkleRootHex;

    // Rollback to `tickAtSnap` and step the exact same 13 ticks -> Merkle root MUST match bit-for-bit!
    expect(wA.rollbackToSnapshot(tickAtSnap)).toBe(true);
    expect(wA.store.epoch.simTick).toBe(tickAtSnap);
    let telRun2 = wA.stepTick(0.05);
    for (let t = 0; t < 12; t++) telRun2 = wA.stepTick(0.05);
    expect(telRun2.merkleRootHex).toBe(merkleAfterRun1);
    expect(telRun2.conservationValid).toBe(true);
    expect(telRun2.maxMetabolicDrift).toBeLessThan(1e-12);
    expect(telRun2.rosetteReceipt.valid).toBe(true);

    // Ecology invariants
    expect(COSMOLOGICAL_SINGULARITIES_5.length).toBe(5);
    expect(computeLorenzGini([10, 10, 10, 10])).toBeCloseTo(0, 9);
    expect(computeLorenzGini([0, 0, 0, 100])).toBeCloseTo(0.75, 6);

    const clamped = sanitizeGodDials({ maxVisualPulseHz: 99.0, manifoldWarpGain: 10.0, kerrSpinA: 5.0 });
    expect(clamped.maxVisualPulseHz).toBeLessThanOrEqual(2.2);
    expect(clamped.manifoldWarpGain).toBeLessThanOrEqual(0.45);
    expect(clamped.kerrSpinA).toBeLessThanOrEqual(0.998);
  });

  test('T-072 / T-074: QRNG, Glossodrom RS[15,11], Cormidium-16 erasure healing, Reversible Xgloss VM & Voynich-Khora Anyons', () => {
    const qrng = sampleHealthyQrngBatch(20261110n, 256);
    expect(qrng.rctHealthy).toBe(true);
    expect(qrng.aptHealthy).toBe(true);
    expect(qrng.shannonBitsPerByte).toBeGreaterThan(4.5);

    const msg = Uint8Array.from([15, 0, 14, 1, 13, 2, 12, 3, 11, 4, 10]);
    const cw = encodeGlossodromRs15_11(msg);
    const err2 = cw.slice();
    err2[0] = err2[0]! ^ 0x0e;
    err2[14] = err2[14]! ^ 0x07;
    const dec2 = decodeGlossodromRs15_11(err2);
    expect(dec2.uncorrectable).toBe(false);
    expect(dec2.correctedSymbolCount).toBe(2);
    expect(Array.from(dec2.message11)).toEqual(Array.from(msg));

    // Cormidium-16 4x4 tesseract erasure recovery
    const data9 = Uint8Array.from([3, 1, 4, 1, 5, 9, 2, 6, 5]);
    const corm = encodeCormidium16(data9);
    const damaged = corm.slice();
    damaged[0] = 0;
    damaged[5] = 0;
    damaged[10] = 0;
    const healed = healCormidium16Erasures(damaged, [0, 5, 10]);
    expect(healed.fullyRecovered).toBe(true);
    expect(Array.from(healed.data9)).toEqual(Array.from(data9));

    // Reversible Xgloss VM bit-exact stepForward <-> stepBack bijection
    const seedRegs = [0x12345678, 0x9abcdef0, 0x0f0f0f0f, 0xdeadbeef, 1, 2, 3, 4];
    const vm = new ReversibleXglossVm(seedRegs);
    vm.stepForward({ op: 'XOR_REG', dst: 0, src: 1 });
    vm.stepForward({ op: 'ADD_IMM', dst: 2, imm: 0x13579bdf });
    vm.stepForward({ op: 'ROTL', dst: 3, bits: 11 });
    vm.stepForward({ op: 'FEISTEL_VEIL', left: 0, right: 3, roundKey: 0xcafe1234 });
    expect(Array.from(vm.regs)).not.toEqual(seedRegs.map((v) => v >>> 0));
    while (vm.stepBack()) {
      // unwind entire reversible tape
    }
    expect(Array.from(vm.regs)).toEqual(seedRegs.map((v) => v >>> 0));

    // Voynich-Khora 4D language lab: projective dedup, unitary Fibonacci anyon braiding, Hopf fibers
    expect(KHORA_CODON_TABLE.length).toBe(8);
    const dedup = applyProjectiveAblationDedup([1, 1, 1, 3, 5, 5, 2]);
    expect(dedup.ablatedIndices).toEqual([1, 3, 5, 2]);
    expect(dedup.twistMultiplicities).toEqual([3, 1, 2, 1]);

    const braid = braidFibonacciAnyonWord([1, 2, -1, 2, 1, -2]);
    expect(braid.unitarityDrift).toBeLessThan(1e-13);
    expect(braid.probVacuumChannel0 + braid.probTauChannel1).toBeCloseTo(1.0, 12);

    const hopf = sampleHopfFiberR3(0.9, 1.2, 24);
    expect(hopf.length).toBe(72);
    expect(hopf.every((v) => Number.isFinite(v))).toBe(true);

    const pts3d = projectZooidStrandS3ToR3(cw, 0.5);
    expect(pts3d.length).toBe(45);
    expect(synthesizeTaxonomicIdentity(42n, 1, 'EXPLORER').latinBinomial).toBe(
      synthesizeTaxonomicIdentity(42n, 1, 'EXPLORER').latinBinomial,
    );
  });
});
