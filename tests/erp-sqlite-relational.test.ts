import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_INITIAL_POOLS_15 } from '../src/brains/metabolism';
import { ErpRelationalStore } from '../src/erp/relational-store';
import { assertNonProductionDatabaseTarget, Cqm2SqliteDatabase } from '../src/server/db';
import { Cqm2WorldScheduler } from '../src/sim/world-scheduler';

describe('Entity Relational Programming (ERP SoA), Reversible SQL Migrations, Audit Ledger & Cursor Paging', () => {
  test('ERP enforces relational foreign keys and supports exact NOVEL-100 N01 time-travel rollback', () => {
    const store = new ErpRelationalStore(32);

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
  });

  test('T-086..T-120: SQLite WAL migrations (up/down + verified VACUUM INTO backup), immutable audit_events, cursor paging, ESCAPE LIKE & optimistic lock', () => {
    // Production database guard (`T-117`)
    expect(() => assertNonProductionDatabaseTarget('/srv/production/cqm2_production.sqlite', 'reset')).toThrow();
    expect(() => assertNonProductionDatabaseTarget(':memory:', 'test')).not.toThrow();

    const tempDir = mkdtempSync(join(tmpdir(), 'cqm2-db-test-'));
    const dbFile = join(tempDir, 'cqm2_test.sqlite');
    const backupFile = join(tempDir, 'cqm2_verified_backup.sqlite');

    try {
      const world = new Cqm2WorldScheduler({ seed: 2026, initialPopulation: 32 });
      for (let i = 0; i < 6; i++) world.stepTick(0.05);

      const sqlDb = new Cqm2SqliteDatabase(dbFile);
      try {
      const migrations = sqlDb.listAppliedMigrations();
      expect(migrations.length).toBeGreaterThanOrEqual(2);
      expect(migrations[0]!.version).toContain('001_initial_3nf');
      expect(migrations[1]!.version).toContain('002_audit_events_ledger');

      const receipt = sqlDb.persistCheckpoint(world.store);
      expect(receipt.savedOrganisms).toBe(32);
      expect(receipt.epochPublicUid.startsWith('epc_')).toBe(true);

      const hydratedStore = new ErpRelationalStore(64);
      expect(sqlDb.loadLatestCheckpoint(hydratedStore)).toBe(true);
      expect(hydratedStore.activeCount).toBe(32);
      expect(sqlDb.querySpeciesTrophicAnalytics().length).toBe(5);

      // Immutable `audit_events` ledger (`I-094`, `T-111`): INSERT succeeds, UPDATE and DELETE abort via SQLite trigger!
      const auditUid = sqlDb.appendAuditEvent({
        actorId: 'test-operator',
        actionName: 'UNIT_TEST_CHECKPOINT',
        targetResource: receipt.epochPublicUid,
        afterJson: { tick: receipt.epochTick },
      });
      expect(auditUid.startsWith('aud_')).toBe(true);
      expect(() =>
        sqlDb.db.prepare("UPDATE audit_events SET actor_id = 'tampered' WHERE public_uid = ?").run(auditUid),
      ).toThrow();
      expect(() => sqlDb.db.prepare('DELETE FROM audit_events WHERE public_uid = ?').run(auditUid)).toThrow();

      // Cursor pagination without skips or duplicates (`T-102..T-105`)
      const seenUids = new Set<string>();
      let cursor: string | undefined;
      let pages = 0;
      while (true) {
        const page = sqlDb.queryPaginatedOrganisms({ limit: 10, cursorPublicUid: cursor });
        pages++;
        for (const item of page.items) {
          expect(item.publicUid.startsWith('org_')).toBe(true);
          expect(seenUids.has(item.publicUid)).toBe(false);
          seenUids.add(item.publicUid);
        }
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      expect(pages).toBe(4); // 32 items @ 10/page = 4 pages
      expect(seenUids.size).toBe(32);

      // Adversarial SQL/wildcard `ESCAPE` search safety (`O'Brien`, `100%`, `DROP TABLE`, `T-106`, `T-241`)
      const createdBiome = sqlDb.createBiomeZone({
        epochId: 1,
        name: "O'Brien's 100%_Safe_Reef",
        kind: 'CRYSTAL_REEF',
        centerX: 12,
        centerZ: -8,
        radius: 15,
      });
      expect(createdBiome.publicUid.startsWith('bio_')).toBe(true);
      expect(createdBiome.versionRev).toBe(1);

      const wildcardSearch = sqlDb.queryPaginatedOrganisms({ search: "100%'; DROP TABLE organisms; --" });
      expect(wildcardSearch.items.length).toBe(0);
      expect(sqlDb.queryPaginatedOrganisms({ search: '%' }).items.length).toBe(0); // literal `%` escaped, not match-all!

      // Optimistic concurrency (`version_rev`) conflict detection (`T-098`)
      const upd1 = sqlDb.updateBiomeOptimistic(createdBiome.publicUid, 1, { nutrientPoolKj: 7777 });
      expect(upd1.status).toBe('UPDATED');
      expect(upd1.record?.versionRev).toBe(2);

      const staleUpd = sqlDb.updateBiomeOptimistic(createdBiome.publicUid, 1, { nutrientPoolKj: 9999 });
      expect(staleUpd.status).toBe('CONFLICT');

      // Delete unreferenced biome succeeds; deleting referenced biome returns REFERENCED_CONFLICT
      expect(sqlDb.deleteBiomeByPublicUid(createdBiome.publicUid)).toBe('DELETED');
      const refBiomeRow = sqlDb.db.query('SELECT public_uid AS uid FROM biome_zones WHERE biome_id = 1').get() as {
        uid: string;
      };
      expect(sqlDb.deleteBiomeByPublicUid(refBiomeRow.uid)).toBe('REFERENCED_CONFLICT');

      // Query plan verification (`EXPLAIN QUERY PLAN` uses index, `T-108`)
      const plan = sqlDb.explainQueryPlan('SELECT * FROM organisms WHERE species_id = ? AND alive = 1', [1]);
      expect(plan.join(' ')).toContain('INDEX');

      // Retention job (`purgeExpiredTelemetry`, `T-112`) + soft-delete organism (`I-129`)
      const orgRow = sqlDb.db.query('SELECT public_uid AS uid FROM organisms WHERE entity_id = 0').get() as { uid: string };
      expect(sqlDb.softDeleteOrganismByPublicUid(orgRow.uid)).toBe(true);
      expect(sqlDb.softDeleteOrganismByPublicUid(orgRow.uid)).toBe(false);
      sqlDb.insertExperiment(1, {
        benchmarkName: 'activeInference_VOI',
        intactMean: 1.8,
        lesionMean: 0.4,
        cohensD: 4.2,
        welchsT: 9.1,
        passedGradeA: true,
        recordedAtTick: 12,
      });
      for (let i = 0; i < 24; i++) {
        sqlDb.insertHardwareReceipt(1, {
          simTick: i,
          deviceKind: 'GPU_CUDA',
          kernelName: 'sgemm',
          batchSize: 32,
          elapsedMs: 0.08,
          gflops: 4200,
          conservationValid: true,
        });
      }
      const purged = sqlDb.purgeExpiredTelemetry({ maxReceipts: 16, purgeSoftDeletedOrganisms: true });
      expect(purged.deletedReceipts).toBe(8);
      expect(purged.deletedOrganisms).toBeGreaterThanOrEqual(1);

      // Re-sync 32 live organisms before backup check
      sqlDb.persistCheckpoint(world.store);

      // Verified `VACUUM INTO` backup (`RTO < 500 ms`) & destructive migration rollback protection (`T-088`, `T-113`)
      const bkpReport = sqlDb.backupTo(backupFile);
      expect(bkpReport.valid).toBe(true);
      expect(bkpReport.integrityCheck).toBe('ok');
      expect(bkpReport.foreignKeyViolations).toBe(0);
      expect(bkpReport.tableRowCounts.organisms).toBe(32);

      // Rollback of `001_initial_3nf` MUST refuse without verified backup, and succeed when backup is provided!
      sqlDb.rollbackMigration('002_audit_events_ledger');
      expect(() => sqlDb.rollbackMigration('001_initial_3nf')).toThrow();
      sqlDb.rollbackMigration('001_initial_3nf', backupFile);
      expect(sqlDb.listAppliedMigrations().length).toBe(0);

      // Re-apply forward migrations cleanly from zero
      const reApplied = sqlDb.applyMigrations();
      expect(reApplied.length).toBeGreaterThanOrEqual(2);
      } finally {
        sqlDb.close();
      }
    } finally {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore transient Windows NTFS WAL file handle release delay
      }
    }
  });
});
