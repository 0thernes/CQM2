import { describe, expect, test } from 'bun:test';
import {
  AsmodeniusV42Brain,
  computeLempelZiv76Complexity,
  runAsmodeniusR21BenchmarkSuite,
} from '../src/brains/asmodenius';
import {
  FLAW_BACKWARDS,
  FLAW_LEAKY,
  FLAW_MISFIRE,
  FLAW_SCRAMBLE,
  GlitchlingNeuroplasticityOrgan,
} from '../src/brains/glitchling';
import {
  computeCholesky5x5Determinant,
  computePoincareHyperbolicDistance,
  MechalogodromPantheon,
} from '../src/brains/pantheon';
import { DeterministicRng } from '../src/core/prng';
import { TsotchkeAblationController } from '../src/tsotchke/corpus';

describe('Asmodenius v42, Glitchling Neuroplasticity, Swarm Pantheon & OBLITERATUS Safety Fence', () => {
  test('All 4 R21 flagship causal lesion benchmarks pass Grade-A (Cohen d >= 0.8, Welch t >= 2.75)', () => {
    const results = runAsmodeniusR21BenchmarkSuite(20261110n, 24);
    expect(results.length).toBe(4);
    for (const r of results) {
      expect(r.passedGradeA).toBe(true);
      expect(r.cohensD).toBeGreaterThanOrEqual(0.8);
      expect(r.welchsT).toBeGreaterThanOrEqual(2.75);
    }
  });

  test('Asmodenius N13 Somatic Free-Wont veto, N52 P_SIM substrate quarantine, Frenet curvature & Casali PCI TMS Poke', () => {
    const brain = new AsmodeniusV42Brain(12345n);
    const sense = new Float32Array([0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]);

    // Step 1..4 normal physics signature (`1.0`), high somatic hazard (`0.95`) to trigger N13 veto
    let lastTel = brain.stepBrain({
      sensory8: sense,
      gutLoadKj: 8.0,
      bloodGlucoseKj: 4.0,
      somaticHazard: 0.95,
      cueNoiseVariance: 0.05,
      cueCost: 0.2,
      physicsSignature: 1.0,
      ach: 0.7,
      ne: 0.4,
      dtSec: 0.05,
    });
    for (let i = 0; i < 4; i++) {
      lastTel = brain.stepBrain({
        sensory8: sense,
        gutLoadKj: 8.0,
        bloodGlucoseKj: 4.0,
        somaticHazard: 0.95,
        cueNoiseVariance: 0.05,
        cueCost: 0.2,
        physicsSignature: 1.0,
        ach: 0.7,
        ne: 0.4,
        dtSec: 0.05,
      });
    }
    expect(lastTel.somaticFreeWontVetoTriggered).toBe(true);
    expect(lastTel.totalFreeWontVetoes).toBeGreaterThanOrEqual(1);
    expect(lastTel.metacognitiveConfidenceHot3.sentienceClaim).toBe('NOT_SENTIENT');
    expect(lastTel.metacognitiveConfidenceHot3.indicatorOnly).toBe(true);
    expect(Number.isFinite(lastTel.frenetCurvatureKappa)).toBe(true);

    // Abrupt exogenous God-Dial jump (`1.0 -> 2.5`) triggers N52 substrate anomaly quarantine!
    const jumpTel = brain.stepBrain({
      sensory8: sense,
      gutLoadKj: 8.0,
      bloodGlucoseKj: 4.0,
      somaticHazard: 0.1,
      cueNoiseVariance: 0.05,
      cueCost: 0.2,
      physicsSignature: 2.5,
      ach: 0.7,
      ne: 0.4,
      dtSec: 0.05,
    });
    expect(jumpTel.substrateAnomalyQuarantined).toBe(true);

    // Non-destructive Casali PCI TMS Poke Test preserves exact pre-poke vState
    const beforeV0 = brain.vState[0]!;
    const poke = brain.runTmsPokeTest(2);
    expect(brain.vState[0]!).toBe(beforeV0);
    expect(poke.pciIndicator.sentienceClaim).toBe('NOT_SENTIENT');
    expect(poke.pciIndicator.value).toBeGreaterThan(0);
    expect(poke.lempelZivDictionarySize).toBeGreaterThanOrEqual(1);

    const lzConst = computeLempelZiv76Complexity(new Uint8Array(64).fill(0));
    expect(lzConst.rawCount).toBe(1);
  });

  test('Glitchling compensatory organs overcome backwards, scramble, and leaky congenital deficits', () => {
    const rng = new DeterministicRng(2026n);
    const organ = new GlitchlingNeuroplasticityOrgan(
      rng,
      FLAW_BACKWARDS | FLAW_SCRAMBLE | FLAW_LEAKY | FLAW_MISFIRE,
      32,
    );
    expect(organ.getTelemetry().activeFlawNames).toEqual(['scramble', 'leaky', 'backwards', 'misfire']);

    // 1. Marr-Albus Cerebellum inverts FLAW_BACKWARDS motor polarity
    organ.flawMask = FLAW_BACKWARDS;
    const cmd = new Float32Array([0.8, -0.6, 0.5, 0.2, -0.3, 0.4, 0.1, -0.2]);
    const proprio = new Float32Array(8);
    const firstExec = organ.executeMotor8(cmd, proprio, rng, 0.09);
    expect(firstExec[0]!).toBeLessThan(0); // initially inverted!

    for (let s = 0; s < 55; s++) {
      organ.executeMotor8(cmd, proprio, rng, 0.09);
    }
    expect(organ.getTelemetry().kinematicAlignmentCosine).toBeGreaterThan(0.95);

    // 2. Gated-DeltaNet reduces FLAW_SCRAMBLE sensory alignment RMSE over repeated presentations
    organ.flawMask = FLAW_SCRAMBLE;
    const rawSense = new Float32Array(16);
    const proto = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      rawSense[i] = Math.sin((i + 1) * 0.6);
      proto[i] = Math.cos((i + 1) * 0.4) * 0.5;
    }
    organ.processSensory16(rawSense, proto, rng, 0.45);
    const initialRmse = organ.getTelemetry().deltaNetAlignmentRmse;
    for (let s = 0; s < 35; s++) {
      organ.processSensory16(rawSense, proto, rng, 0.45);
    }
    expect(organ.getTelemetry().deltaNetAlignmentRmse).toBeLessThan(initialRmse);

    // 3. Frey-Morris STC retains consolidated weights under FLAW_LEAKY vs lesioned washout
    organ.flawMask = FLAW_LEAKY;
    const hebb = new Float32Array(32).fill(0.35);
    for (let s = 0; s < 15; s++) {
      organ.stepSynapticTaggingAndCapture(hebb, 0.9, 0.8, 0.1);
    }
    const zeroHebb = new Float32Array(32);
    let retainedIntact: Float32Array<ArrayBufferLike> = new Float32Array(32);
    for (let s = 0; s < 30; s++) {
      retainedIntact = organ.stepSynapticTaggingAndCapture(zeroHebb, 0.0, 0.0, 0.2);
    }
    expect(Math.abs(retainedIntact[0]!)).toBeGreaterThan(0.2);
  });

  test('Pantheon Kuramoto sync, Cholesky 5x5 DPP diversity, Poincaré distance & OBLITERATUS fence', () => {
    const pantheon = new MechalogodromPantheon(42n);
    const feat = new Float32Array(16).fill(0.3);
    const snap = pantheon.stepPantheon(feat, 1.8, 0.05);
    expect(snap.kuramotoOrderParameterR.value).toBeGreaterThanOrEqual(0);
    expect(snap.kuramotoOrderParameterR.value).toBeLessThanOrEqual(1.0001);
    expect(snap.dppDiversityDet).toBeGreaterThan(0);
    expect(snap.mechalogodromShells10.length).toBe(10);

    const ortho5x5 = new Float64Array(25);
    for (let i = 0; i < 5; i++) ortho5x5[i * 5 + i] = 1.0;
    expect(computeCholesky5x5Determinant(ortho5x5, 5)).toBeGreaterThan(1.0);

    expect(computePoincareHyperbolicDistance([0.1, 0.2], [0.1, 0.2])).toBeCloseTo(0, 9);
    const dAB = computePoincareHyperbolicDistance([0.0, 0.0], [0.5, 0.0]);
    const dBA = computePoincareHyperbolicDistance([0.5, 0.0], [0.0, 0.0]);
    expect(dAB).toBeCloseTo(dBA, 9);
    expect(dAB).toBeGreaterThan(0.8);

    const corpus = new TsotchkeAblationController();
    expect(corpus.isEnabled('OBLITERATUS')).toBe(false);
    expect(corpus.setPillarEnabled('OBLITERATUS', true)).toBe(false);
    expect(corpus.isEnabled('OBLITERATUS')).toBe(false);
  });
});
