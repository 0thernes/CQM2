import { describe, expect, test } from 'bun:test';
import { DEFAULT_INITIAL_POOLS_15 } from '../src/brains/metabolism';
import { ErpRelationalStore } from '../src/erp/relational-store';
import { Cqm2SqliteDatabase } from '../src/server/db';
import { Cqm2WorldScheduler } from '../src/sim/world-scheduler';

describe('Entity Relational Programming (ERP SoA) & 3NF SQLite WAL Persistence', () => {
  test('ERP enforces relational foreign keys and supports exact NOVEL-100 N01 time-travel rollback', () => {
    const store = new ErpRelationalStore(32);

    // Reject invalid BiomeZone epoch FK
    expect(() =>
      store.registerBiome({
        biomeId: 1,
        epochId: 999,
        name: 'Bad',
        kind: 'CRYSTAL_REEF',
        centerX: 0,
        centerZ: 0,
        radius: 10,
        nutrientPoolKj: 100,
        detritusPoolKj: 0,
        o2Saturation: 1,
        osmolarityMOsM: 300,
        temperatureK: 290,
      }),
    ).toThrow();

    store.registerBiome({
      biomeId: 1,
      epochId: 1,
      name: 'Valid Reef',
      kind: 'CRYSTAL_REEF',
      centerX: 0,
      centerZ: 0,
      radius: 25,
      nutrientPoolKj: 1000,
      detritusPoolKj: 0,
      o2Saturation: 1,
      osmolarityMOsM: 300,
      temperatureK: 290,
    });

    // Reject orphan parentSpeciesId FK
    expect(() =>
      store.registerSpecies({
        speciesId: 2,
        parentSpeciesId: 99,
        originTick: 0,
        casteRole: 'ORACLE',
        latinBinomial: 'Orphan sp',
        commonGlyph: '✦',
        genomeHashHex: '0x00',
        baseHueDeg: 200,
        extantCount: 0,
        meanFitness: 1,
      }),
    ).toThrow();

    store.registerSpecies({
      speciesId: 1,
      parentSpeciesId: null,
      originTick: 0,
      casteRole: 'ORACLE',
      latinBinomial: 'Asmodenius validus',
      commonGlyph: '✦',
      genomeHashHex: '0x11',
      baseHueDeg: 200,
      extantCount: 0,
      meanFitness: 1,
    });

    // Reject Organism with missing speciesId
    expect(() =>
      store.spawnOrganism({
        speciesId: 77,
        biomeId: 1,
        generation: 1,
        flawMask: 0,
        pos: [0, 1, 0],
        headingRad: 0,
        initialPools15: DEFAULT_INITIAL_POOLS_15,
        initialWeights126: new Float32Array(126),
      }),
    ).toThrow();

    // Verify N01 Reversible Snapshot Rollback on live scheduler
    const world = new Cqm2WorldScheduler({ seed: 10101, initialPopulation: 24 });
    world.stepTick(0.05);
    const snap = world.store.captureSnapshot();
    const savedPosX0 = world.store.posX[0]!;
    const savedAtp0 = world.store.pools15[12]!;

    for (let i = 0; i < 20; i++) world.stepTick(0.05);
    expect(world.store.epoch.simTick).toBeGreaterThan(snap.tick);

    const ok = world.store.rollbackToSnapshot(snap.tick);
    expect(ok).toBe(true);
    expect(world.store.epoch.simTick).toBe(snap.tick);
    expect(world.store.posX[0]!).toBe(savedPosX0);
    expect(world.store.pools15[12]!).toBe(savedAtp0);
  });

  test('3NF SQLite WAL persists all 10 tables atomically and enforces PRAGMA foreign_keys = ON', () => {
    const world = new Cqm2WorldScheduler({ seed: 2026, initialPopulation: 32 });
    for (let i = 0; i < 8; i++) world.stepTick(0.05);

    const sqlDb = new Cqm2SqliteDatabase(':memory:');
    const receipt = sqlDb.persistCheckpoint(world.store);
    expect(receipt.savedOrganisms).toBe(32);
    expect(receipt.savedBonds).toBeGreaterThanOrEqual(1);

    sqlDb.insertExperiment(1, {
      benchmarkName: 'activeInference_VOI',
      intactMean: 110.2,
      lesionMean: -9.0,
      cohensD: 6.27,
      welchsT: 21.72,
      passedGradeA: true,
      recordedAtTick: world.store.epoch.simTick,
    });
    sqlDb.insertHardwareReceipt(1, {
      simTick: world.store.epoch.simTick,
      deviceKind: 'GPU_CUDA',
      kernelName: 'sgemm',
      batchSize: 128,
      elapsedMs: 0.05,
      gflops: 5200,
      conservationValid: true,
    });

    const analytics = sqlDb.querySpeciesTrophicAnalytics();
    expect(analytics.length).toBe(5);
    expect(analytics.reduce((acc, r) => acc + r.aliveOrganisms, 0)).toBe(32);

    // Attempt direct SQLite FK violation -> must throw!
    expect(() =>
      sqlDb.db
        .prepare(
          `INSERT INTO organisms (entity_id, species_id, biome_id, alive, generation, flaw_mask, age_sec, pos_x, pos_y, pos_z, vel_x, vel_y, vel_z, mass_kg, telomere_integrity)
           VALUES (999, 9999, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1.0, 1.0)`,
        )
        .run(),
    ).toThrow();

    sqlDb.close();
  });
});
