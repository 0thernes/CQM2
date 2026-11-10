import { describe, expect, test } from 'bun:test';
import { AsmodeniusV42Brain, computeLempelZiv76Complexity } from '../src/brains/asmodenius';
import { runAsmodeniusR21BenchmarkSuite, runComprehensive12CausalSuite } from '../src/brains/causal-benchmarks';
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
import { runThalerCreativityAblationSuite, ThalerCreativityMachine } from '../src/brains/thaler-creativity';
import { BUTLIN_14_INDICATORS, runXylosRealityMonitoringAssay, XylosMedusaBrain } from '../src/brains/xylos';
import { DeterministicRng } from '../src/core/prng';
import {
  computePqConsensusQuorum,
  evaluateBonsaiSaeSurvivalProbe,
  TSOTCHKE_27_REPOS,
  TsotchkeAblationController,
} from '../src/tsotchke/corpus';

describe('Asmodenius v42, Xylos v2, Thaler-9, Glitchling, 12-Benchmark Causal Suite & 27-Repo Tsotchke Fence', () => {
  test('All 12 causal lesion & falsification benchmarks pass Grade-A (Cohen d >= 0.8, Welch t >= 2.75)', () => {
    const r21 = runAsmodeniusR21BenchmarkSuite(20261110n, 24);
    expect(r21.length).toBe(4);
    for (const r of r21) {
      expect(r.passedGradeA).toBe(true);
      expect(r.cohensD).toBeGreaterThanOrEqual(0.8);
    }

    const full12 = runComprehensive12CausalSuite(20261110n, 16);
    expect(full12.length).toBe(12);
    for (const b of full12) {
      expect(b.passedGradeA).toBe(true);
      expect(b.cohensD).toBeGreaterThanOrEqual(0.8);
      expect(b.welchsT).toBeGreaterThanOrEqual(2.75);
    }
  });

  test('Asmodenius N13 veto, N52 quarantine & non-destructive TMS arousal separation (WAKE > NREM / PROPOFOL)', () => {
    const brain = new AsmodeniusV42Brain(12345n);
    const sense = new Float32Array([0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]);

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

    // State-cloned TMS Poke Assay across WAKE, NREM_SLOW_WAVE, and PROPOFOL_ANESTHESIA leaves live CNS untouched!
    const snapBefore = brain.snapshotState();
    const pokeWake = brain.runTmsPokeTest(2, 'WAKE');
    const pokeNrem = brain.runTmsPokeTest(2, 'NREM_SLOW_WAVE');
    const pokePropofol = brain.runTmsPokeTest(2, 'PROPOFOL_ANESTHESIA');
    expect(Array.from(brain.vState)).toEqual(Array.from(snapBefore.vState));
    expect(Array.from(brain.nmdaSlow)).toEqual(Array.from(snapBefore.nmdaSlow));
    expect(pokeWake.pciIndicator.sentienceClaim).toBe('NOT_SENTIENT');
    expect(pokeWake.pciIndicator.value).toBeGreaterThan(pokeNrem.pciIndicator.value);
    expect(pokeWake.pciIndicator.value).toBeGreaterThan(pokePropofol.pciIndicator.value);

    expect(computeLempelZiv76Complexity(new Uint8Array(64).fill(0)).rawCount).toBe(1);
  });

  test('Xylos v2 (14 Butlin indicators + non-oracle reality monitor) & Thaler-9 (4 falsification ablations)', () => {
    const xylos = new XylosMedusaBrain(20261110n);
    const xTel = xylos.stepXylos({
      sensory8: Float32Array.from([0.8, -0.5, 0.7, 0.3, -0.4, 0.9, 0.2, -0.6]),
      posX: 8,
      posZ: -6,
      hunger: 0.45,
      hazard: 0.12,
      dreamGate: 0.0,
      dtSec: 0.05,
    });
    expect(xTel.butlin14.sentienceClaim).toBe('NOT_SENTIENT');
    expect(Object.keys(xTel.butlin14.value).length).toBe(BUTLIN_14_INDICATORS.length);

    const rmAssay = runXylosRealityMonitoringAssay(20261110n);
    expect(rmAssay.separationDelta).toBeGreaterThan(0.2);
    expect(rmAssay.dreamCorruptedLandmarks).toBe(false);

    const thaler = new ThalerCreativityMachine(20261110n, 'intact');
    const thRng = new DeterministicRng(99n);
    const thTel = thaler.stepCreativity({
      sensory8: Float32Array.from([0.5, -0.4, 0.6, -0.3, 0.45, -0.5, 0.35, -0.25]),
      metabolicStress: 0.85, // enters CLIFF_OF_CREATIVITY / high-stress Gedanken-Death phase
      rng: thRng,
    });
    expect(thTel.markers9.sentienceClaim).toBe('NOT_SENTIENT');

    const ablations = runThalerCreativityAblationSuite(20261110n);
    expect(ablations.allFalsificationsPassed).toBe(true);
    expect(ablations.intactViableCreativeYield).toBeGreaterThan(ablations.ablationYields['critic-scrambled']);
  });

  test('Glitchling non-oracle compensatory neuroplasticity overcomes backwards, scramble, and leaky faults', () => {
    const rng = new DeterministicRng(2026n);
    const organ = new GlitchlingNeuroplasticityOrgan(
      rng,
      FLAW_BACKWARDS | FLAW_SCRAMBLE | FLAW_LEAKY | FLAW_MISFIRE,
      32,
    );
    expect(organ.getTelemetry().activeFlawNames).toEqual(['scramble', 'leaky', 'backwards', 'misfire']);

    organ.flawMask = FLAW_BACKWARDS;
    const cmd = new Float32Array([0.8, -0.6, 0.5, 0.2, -0.3, 0.4, 0.1, -0.2]);
    const proprio = new Float32Array(8);
    const firstExec = organ.executeMotor8(cmd, proprio, rng, 0.09);
    expect(firstExec[0]!).toBeLessThan(0);

    for (let s = 0; s < 55; s++) {
      organ.executeMotor8(cmd, proprio, rng, 0.09);
    }
    expect(organ.getTelemetry().kinematicAlignmentCosine).toBeGreaterThan(0.95);

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
  });

  test('Pantheon Kuramoto/DPP & 27-Repo Tsotchke registry enforces OBLITERATUS + copyleft/proprietary/LLM fences', () => {
    const pantheon = new MechalogodromPantheon(42n);
    const snap = pantheon.stepPantheon(new Float32Array(16).fill(0.3), 1.8, 0.05);
    expect(snap.kuramotoOrderParameterR.value).toBeGreaterThanOrEqual(0);
    expect(snap.dppDiversityDet).toBeGreaterThan(0);
    expect(snap.mechalogodromShells10.length).toBe(10);

    const ortho5x5 = new Float64Array(25);
    for (let i = 0; i < 5; i++) ortho5x5[i * 5 + i] = 1.0;
    expect(computeCholesky5x5Determinant(ortho5x5, 5)).toBeGreaterThan(1.0);
    expect(computePoincareHyperbolicDistance([0.0, 0.0], [0.5, 0.0])).toBeGreaterThan(0.8);

    // Verify all 27 Tsotchke repositories are cataloged and all fenced repos refuse activation!
    expect(TSOTCHKE_27_REPOS.length).toBe(27);
    const corpus = new TsotchkeAblationController();
    const fencedIds = [
      'OBLITERATUS',
      'quantum-quake',
      'SolanaQuantumFlux',
      'ulg',
      'logo-lab',
      'GRIMOIRE',
      'gpt2-basic',
      'llm-arbitrator',
    ];
    for (const fid of fencedIds) {
      expect(corpus.isEnabled(fid)).toBe(false);
      expect(corpus.setPillarEnabled(fid, true)).toBe(false);
      expect(corpus.isEnabled(fid)).toBe(false);
    }

    const sae = evaluateBonsaiSaeSurvivalProbe([0.8, -0.3, 0.5, 0.9, -0.2, 0.4, 0.7, -0.1], 5);
    expect(sae.sparsityRatio).toBeGreaterThan(0.5);
    expect(sae.survivalScore).toBeGreaterThan(0.2);

    const bft = computePqConsensusQuorum(7, 10);
    expect(bft.maxByzantineFaults).toBe(2);
    expect(bft.quorumSize).toBe(5);
    expect(bft.mlDsa65BytesPerRound).toBeGreaterThan(15000);
  });
});
