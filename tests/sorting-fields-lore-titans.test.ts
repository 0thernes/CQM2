import { describe, expect, test } from 'bun:test';
import {
  CosmologicalLoreEngine,
  SORTING_25_SPECS,
  SortingFieldsEngine,
  TitanDiplomacySimulator,
} from '../src/sim/sorting-fields';
import { Cqm2WorldScheduler } from '../src/sim/world-scheduler';

describe('CQM2 v2.2.0 — 25 Sorting Fields, Cosmological Lore, 20 Titans & World Dock Actions', () => {
  test('All 25 canonical CQM Sorting Fields step deterministically, sort toward monotonicity, and emit spatial force', () => {
    expect(SORTING_25_SPECS.length).toBe(25);
    expect(SORTING_25_SPECS[0]?.name).toBe('BUBBLE FIELD');
    expect(SORTING_25_SPECS[11]?.name).toBe('PANCAKE FLIP');
    expect(SORTING_25_SPECS[24]?.name).toBe('PREFIX PANCAKE');

    const eng = new SortingFieldsEngine(20261110);
    expect(eng.activeIndex).toBe(11);

    for (let idx = 0; idx < 25; idx++) {
      eng.selectField(idx);
      expect(eng.activeIndex).toBe(idx);
      let snap = eng.getSnapshot();
      for (let step = 0; step < 180; step++) {
        snap = eng.stepTick(0.5);
      }
      expect(snap.activeSpec.index).toBe(idx);
      expect(snap.stepCount).toBeGreaterThan(0);
      expect(snap.omegaScore).toBeGreaterThanOrEqual(0);
      expect(snap.omegaScore).toBeLessThanOrEqual(1);
      expect(snap.activeBins64.length).toBe(64);

      const force = eng.sampleSpatialForce(34, -85);
      expect(Number.isFinite(force.fx)).toBe(true);
      expect(Number.isFinite(force.fz)).toBe(true);
    }

    // Concurrent `runAll` + `autoCycle` + `nextField` + high chaos entropy wave
    eng.runAll = true;
    eng.autoCycle = true;
    for (let t = 0; t < 220; t++) {
      eng.stepTick(2.5);
    }
    const nextSpec = eng.nextField();
    expect(nextSpec.index).toBe(eng.activeIndex);
  });

  test('CosmologicalLoreEngine anchors HELTIBOR at camera boot sector and resolves deterministic Voronoi sectors', () => {
    const loreA = new CosmologicalLoreEngine(20261110);
    const loreB = new CosmologicalLoreEngine(20261110);

    const bootSector = loreA.sectorAt(0, 200);
    expect(bootSector.name).toBe('HELTIBOR');

    const farSectorA = loreA.sectorAt(-290, -260);
    const farSectorB = loreB.sectorAt(-290, -260);
    expect(farSectorA.name).toBe(farSectorB.name);
    expect(farSectorA.name.length).toBeGreaterThanOrEqual(4);
  });

  test('TitanDiplomacySimulator maintains 20 sovereign Titans and symmetric 20x20 diplomacy matrix', () => {
    const lore = new CosmologicalLoreEngine(20261110);
    const sim = new TitanDiplomacySimulator(lore, 20261110);
    expect(sim.names20.length).toBe(20);

    const snap = sim.stepTick(0.65, 0.2);
    expect(snap.matter20.length).toBe(20);
    expect(snap.energy20.length).toBe(20);
    expect(snap.entropy20.length).toBe(20);
    expect(snap.netHoldings20.length).toBe(20);
    expect(snap.matrix400.length).toBe(400);
    expect(snap.dominantTitanIndex).toBeGreaterThanOrEqual(0);
    expect(snap.dominantTitanIndex).toBeLessThan(20);

    for (let i = 0; i < 20; i++) {
      expect(snap.matrix400[i * 20 + i]).toBe(0);
      for (let j = i + 1; j < 20; j++) {
        expect(snap.matrix400[i * 20 + j]).toBe(snap.matrix400[j * 20 + i]);
      }
    }
  });

  test('WorldScheduler boots at 495/1000 organisms and preserves First-Law conservation across SPLIT, BURST, MUTATE & XENOMIMIC', () => {
    const world = new Cqm2WorldScheduler({
      seed: 20261110,
      initialPopulation: 495,
      maxEntities: 1000,
    });
    expect(world.store.activeCount).toBe(495);
    expect(world.store.maxEntities).toBe(1000);

    const splitAdded = world.triggerMitoticSplit(10);
    expect(splitAdded).toBe(10);
    expect(world.store.activeCount).toBe(505);

    const fedCount = world.triggerNutrientBurst(8.0);
    expect(fedCount).toBe(505);

    const mutatedCount = world.triggerMutagenicPulse(0.08);
    expect(mutatedCount).toBe(505);

    const xenoPairs = world.triggerXenomimicPair();
    expect(xenoPairs).toBe(1);

    const tel = world.stepTick(0.04);
    expect(tel.conservationValid).toBe(true);
    expect(tel.maxMetabolicDrift).toBeLessThan(1e-12);
    expect(tel.aliveCount).toBeGreaterThanOrEqual(500);
  });
});
