/**
 * CQM2 v2.1.0 Normalized 3NF SQLite WAL Persistence & Migration Engine (`bun:sqlite`).
 * Persists all 10 Entity Relational Model (`ERM`) tables + `schema_migrations` + immutable `audit_events`
 * with strict `PRAGMA foreign_keys = ON`, `CHECK` constraints, non-sequential `public_uid` keys,
 * optimistic `version_rev` concurrency control, `VACUUM INTO` verified backups, and cursor pagination.
 */
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  type BiomeKind,
  type CasteRole,
  ErpRelationalStore,
  METABOLIC_POOL_COUNT,
  ORGANISM_WEIGHT_STRIDE,
  type SleepStageCode,
} from '../erp/relational-store';

const MIGRATIONS_DIR = resolve(import.meta.dir, '..', '..', 'migrations');
export const MAX_DB_PAGE_SIZE = 128;

export interface AppliedMigrationRecord {
  version: string;
  checksumHex: string;
  appliedAtIso: string;
}

export interface PaginatedOrganismRow {
  publicUid: string;
  speciesPublicUid: string;
  biomePublicUid: string;
  latinBinomial: string;
  casteRole: CasteRole;
  biomeName: string;
  alive: boolean;
  generation: number;
  flawMask: number;
  morphotypeId: number;
  sleepStage: SleepStageCode;
  aurumWealth: number;
  umbraWealth: number;
  ageSec: number;
  pos: [number, number, number];
  massKg: number;
  telomereIntegrity: number;
  atpBufferKj: number;
  bloodGlucoseKj: number;
  bloodPh: number;
  rosDamage: number;
  pciProxy: number;
  thoughtCurvatureKappa: number;
  versionRev: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface BackupVerificationReport {
  valid: boolean;
  integrityCheck: string;
  foreignKeyViolations: number;
  tableRowCounts: Record<string, number>;
  elapsedMs: number;
}

function escapeSqlLikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function clampFinite(val: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.max(lo, Math.min(hi, val));
}

export function assertNonProductionDatabaseTarget(dbPath: string, operationName = 'test/reset'): void {
  const normalized = dbPath.replace(/\\/g, '/').toLowerCase();
  const prodMarker = (process.env.CQM2_PROD_DB_PATH ?? 'cqm2_production.sqlite').replace(/\\/g, '/').toLowerCase();
  if (
    (prodMarker.length > 0 && normalized.endsWith(prodMarker)) ||
    normalized.includes('/production/') ||
    process.env.CQM2_TARGET_ENV === 'production'
  ) {
    throw new Error(
      `[DB_PRODUCTION_GUARD] Refusing destructive or test ${operationName} against production target '${dbPath}'`,
    );
  }
}

export class Cqm2SqliteDatabase {
  public readonly db: Database;
  public readonly dbPath: string;
  private closed = false;

  public constructor(dbPath = ':memory:', options: { autoMigrate?: boolean; upToMigration?: string } = {}) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath, { create: true });
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    if (options.autoMigrate !== false) {
      this.applyMigrations(options.upToMigration);
    }
  }

  public ping(): boolean {
    if (this.closed) return false;
    try {
      const row = this.db.query('SELECT 1 AS ok').get() as { ok: number } | null;
      return row?.ok === 1;
    } catch {
      return false;
    }
  }

  /**
   * Applies forward `.up.sql` migrations from `migrations/` in deterministic lexical order (`I-112`, `T-086`, `T-087`).
   */
  public applyMigrations(upToVersion?: string): AppliedMigrationRecord[] {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum_hex TEXT NOT NULL,
        applied_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);

    const appliedRows = this.db
      .query('SELECT version, checksum_hex AS checksumHex, applied_at_iso AS appliedAtIso FROM schema_migrations ORDER BY version ASC')
      .all() as AppliedMigrationRecord[];
    const appliedMap = new Map<string, AppliedMigrationRecord>(appliedRows.map((r) => [r.version, r]));

    if (!existsSync(MIGRATIONS_DIR)) {
      return appliedRows;
    }

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.up.sql'))
      .sort();

    for (const file of files) {
      const version = file.slice(0, -'.up.sql'.length);
      if (upToVersion && version > upToVersion) break;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const checksumHex = createHash('sha256').update(sql).digest('hex');

      const existing = appliedMap.get(version);
      if (existing) {
        continue;
      }

      const tx = this.db.transaction(() => {
        this.db.exec(sql);
        this.db
          .prepare('INSERT OR REPLACE INTO schema_migrations (version, checksum_hex) VALUES (?, ?)')
          .run(version, checksumHex);
      });
      tx();
    }

    return this.listAppliedMigrations();
  }

  public listAppliedMigrations(): AppliedMigrationRecord[] {
    const hasTable = this.db
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    if (!hasTable) return [];
    return this.db
      .query('SELECT version, checksum_hex AS checksumHex, applied_at_iso AS appliedAtIso FROM schema_migrations ORDER BY version ASC')
      .all() as AppliedMigrationRecord[];
  }

  /**
   * Executes a `.down.sql` rollback script. Refuses destructive table-drop migrations unless a verified
   * SQLite backup file is supplied and passes integrity checks (`I-115`, `T-088`, `T-119`).
   */
  public rollbackMigration(version: string, verifiedBackupPath?: string): void {
    const downPath = join(MIGRATIONS_DIR, `${version}.down.sql`);
    if (!existsSync(downPath)) {
      throw new Error(`Missing rollback script for migration '${version}'`);
    }
    const downSql = readFileSync(downPath, 'utf8');
    const dropsCoreData = /\bDROP\s+TABLE\b[\s\S]*\b(organisms|world_epochs|metabolic_ledgers)\b/i.test(downSql);
    if (dropsCoreData) {
      if (!verifiedBackupPath || !existsSync(verifiedBackupPath)) {
        throw new Error(
          `[MIGRATION_BACKUP_REQUIRED] Destructive rollback '${version}' requires a pre-verified backup file`,
        );
      }
      const check = Cqm2SqliteDatabase.verifyBackupIntegrity(verifiedBackupPath);
      if (!check.valid) {
        throw new Error(`[MIGRATION_BACKUP_INVALID] Backup '${verifiedBackupPath}' failed integrity verification`);
      }
    }

    const tx = this.db.transaction(() => {
      this.db.exec(downSql);
    });
    tx();
  }

  /**
   * Creates an online atomic snapshot of the live WAL database via `VACUUM INTO` (`I-123`, `T-113`).
   */
  public backupTo(destPath: string): BackupVerificationReport {
    mkdirSync(dirname(destPath), { recursive: true });
    if (existsSync(destPath)) {
      rmSync(destPath, { force: true });
    }
    const escaped = destPath.replace(/'/g, "''");
    if (this.dbPath !== ':memory:') {
      try {
        this.db.exec('PRAGMA wal_checkpoint(PASSIVE);');
      } catch {
        // Ignore if WAL checkpoint is skipped
      }
      const bkpConn = new Database(this.dbPath, { readonly: true });
      try {
        bkpConn.exec('PRAGMA busy_timeout = 5000;');
        bkpConn.exec(`VACUUM INTO '${escaped}';`);
      } finally {
        bkpConn.close();
      }
    } else {
      this.db.exec(`VACUUM INTO '${escaped}';`);
    }
    return Cqm2SqliteDatabase.verifyBackupIntegrity(destPath);
  }

  /**
   * Opens a backup into an isolated read-only handle (never overwriting live DB) and verifies
   * `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, and table row counts (`I-124`, `T-113`).
   */
  public static verifyBackupIntegrity(backupPath: string): BackupVerificationReport {
    const t0 = performance.now();
    if (!existsSync(backupPath)) {
      return {
        valid: false,
        integrityCheck: 'missing_file',
        foreignKeyViolations: -1,
        tableRowCounts: {},
        elapsedMs: performance.now() - t0,
      };
    }
    const scratch = new Database(backupPath, { readonly: true });
    try {
      const integ = scratch.query('PRAGMA integrity_check;').get() as { integrity_check?: string } | null;
      const integrityStr = integ?.integrity_check ?? 'failed';
      const fkRows = scratch.query('PRAGMA foreign_key_check;').all();
      const tables = [
        'world_epochs',
        'biome_zones',
        'species_lineages',
        'organisms',
        'metabolic_ledgers',
        'neural_cortex_states',
        'quantum_substrates',
        'social_bonds',
        'causal_experiments',
        'hardware_dispatch_receipts',
      ];
      const counts: Record<string, number> = {};
      for (const tbl of tables) {
        const exists = scratch.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tbl);
        if (exists) {
          const r = scratch.query(`SELECT COUNT(*) AS c FROM ${tbl}`).get() as { c: number };
          counts[tbl] = r.c;
        }
      }
      const elapsedMs = performance.now() - t0;
      return {
        valid: integrityStr === 'ok' && fkRows.length === 0,
        integrityCheck: integrityStr,
        foreignKeyViolations: fkRows.length,
        tableRowCounts: counts,
        elapsedMs,
      };
    } finally {
      scratch.close();
    }
  }

  /**
   * Atomically persists the entire 10-entity ERP world state in a single ACID transaction (`I-119`, `T-097`).
   */
  public persistCheckpoint(
    store: ErpRelationalStore,
    quantumMeta: { violatedHexagonLines: number; fubiniStudyTrace: number; berryCurvatureXY: number; qrngEntropyBits: number } = {
      violatedHexagonLines: 63,
      fubiniStudyTrace: 14.0,
      berryCurvatureXY: 0.0,
      qrngEntropyBits: 5.8,
    },
  ): { savedOrganisms: number; savedBonds: number; epochTick: number; epochPublicUid: string } {
    const upsertEpoch = this.db.prepare(`
      INSERT INTO world_epochs (epoch_id, seed_hex, sim_tick, sim_time_sec, merkle_root_hex, free_energy_reserve_kj)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(epoch_id) DO UPDATE SET
        seed_hex = excluded.seed_hex,
        sim_tick = excluded.sim_tick,
        sim_time_sec = excluded.sim_time_sec,
        merkle_root_hex = excluded.merkle_root_hex,
        free_energy_reserve_kj = excluded.free_energy_reserve_kj,
        version_rev = world_epochs.version_rev + 1
    `);

    const upsertBiome = this.db.prepare(`
      INSERT INTO biome_zones (biome_id, epoch_id, name, kind, center_x, center_z, radius, nutrient_pool_kj, detritus_pool_kj, o2_saturation, osmolarity_mosm, temperature_k)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(biome_id) DO UPDATE SET
        name = excluded.name,
        kind = excluded.kind,
        center_x = excluded.center_x,
        center_z = excluded.center_z,
        radius = excluded.radius,
        nutrient_pool_kj = excluded.nutrient_pool_kj,
        detritus_pool_kj = excluded.detritus_pool_kj,
        o2_saturation = excluded.o2_saturation,
        osmolarity_mosm = excluded.osmolarity_mosm,
        temperature_k = excluded.temperature_k,
        version_rev = biome_zones.version_rev + 1
    `);

    const upsertSpecies = this.db.prepare(`
      INSERT INTO species_lineages (species_id, parent_species_id, origin_tick, caste_role, latin_binomial, common_glyph, genome_hash_hex, base_hue_deg, extant_count, mean_fitness)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(species_id) DO UPDATE SET
        parent_species_id = excluded.parent_species_id,
        extant_count = excluded.extant_count,
        mean_fitness = excluded.mean_fitness,
        version_rev = species_lineages.version_rev + 1
    `);

    const upsertOrg = this.db.prepare(`
      INSERT INTO organisms (
        entity_id, species_id, biome_id, alive, soft_deleted, generation, flaw_mask, morphotype_id,
        entangled_partner_id, sleep_stage, aurum_wealth, umbra_wealth,
        age_sec, pos_x, pos_y, pos_z, vel_x, vel_y, vel_z, mass_kg, telomere_integrity
      )
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        species_id = excluded.species_id,
        biome_id = excluded.biome_id,
        alive = excluded.alive,
        generation = excluded.generation,
        flaw_mask = excluded.flaw_mask,
        morphotype_id = excluded.morphotype_id,
        entangled_partner_id = excluded.entangled_partner_id,
        sleep_stage = excluded.sleep_stage,
        aurum_wealth = excluded.aurum_wealth,
        umbra_wealth = excluded.umbra_wealth,
        age_sec = excluded.age_sec,
        pos_x = excluded.pos_x,
        pos_y = excluded.pos_y,
        pos_z = excluded.pos_z,
        vel_x = excluded.vel_x,
        vel_y = excluded.vel_y,
        vel_z = excluded.vel_z,
        mass_kg = excluded.mass_kg,
        telomere_integrity = excluded.telomere_integrity,
        version_rev = organisms.version_rev + 1
    `);

    const upsertMetab = this.db.prepare(`
      INSERT INTO metabolic_ledgers (
        entity_id, total_intake_kj, gut_total_kj, blood_glucose_kj, glycogen_total_kj,
        adipose_kj, atp_buffer_kj, dissipated_heat_kj, o2_reserve, co2_level, blood_ph, ros_damage,
        hydration, insulin, glucagon
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        total_intake_kj = excluded.total_intake_kj,
        gut_total_kj = excluded.gut_total_kj,
        blood_glucose_kj = excluded.blood_glucose_kj,
        glycogen_total_kj = excluded.glycogen_total_kj,
        adipose_kj = excluded.adipose_kj,
        atp_buffer_kj = excluded.atp_buffer_kj,
        dissipated_heat_kj = excluded.dissipated_heat_kj,
        o2_reserve = excluded.o2_reserve,
        co2_level = excluded.co2_level,
        blood_ph = excluded.blood_ph,
        ros_damage = excluded.ros_damage,
        hydration = excluded.hydration,
        insulin = excluded.insulin,
        glucagon = excluded.glucagon
    `);

    const upsertNeural = this.db.prepare(`
      INSERT INTO neural_cortex_states (
        entity_id, dopamine_rpe, acetylcholine_gate, norepinephrine, serotonin,
        pci_proxy, thought_curvature_kappa, free_wont_veto_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        dopamine_rpe = excluded.dopamine_rpe,
        acetylcholine_gate = excluded.acetylcholine_gate,
        norepinephrine = excluded.norepinephrine,
        serotonin = excluded.serotonin,
        pci_proxy = excluded.pci_proxy,
        thought_curvature_kappa = excluded.thought_curvature_kappa,
        free_wont_veto_count = excluded.free_wont_veto_count
    `);

    const upsertQuantum = this.db.prepare(`
      INSERT INTO quantum_substrates (substrate_id, epoch_id, entity_id, n_qubits, violated_hexagon_lines, fubini_study_trace, berry_curvature_xy, qrng_entropy_bits)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(substrate_id) DO UPDATE SET
        entity_id = excluded.entity_id,
        n_qubits = excluded.n_qubits,
        violated_hexagon_lines = excluded.violated_hexagon_lines,
        fubini_study_trace = excluded.fubini_study_trace,
        berry_curvature_xy = excluded.berry_curvature_xy,
        qrng_entropy_bits = excluded.qrng_entropy_bits
    `);

    const upsertBond = this.db.prepare(`
      INSERT INTO social_bonds (bond_id, source_entity_id, target_entity_id, trust_weight, kinship_coeff, last_signal_tick, glossodrom_codeword_hex, syndrome_clean)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(bond_id) DO UPDATE SET
        trust_weight = excluded.trust_weight,
        kinship_coeff = excluded.kinship_coeff,
        last_signal_tick = excluded.last_signal_tick,
        glossodrom_codeword_hex = excluded.glossodrom_codeword_hex,
        syndrome_clean = excluded.syndrome_clean
    `);

    const tx = this.db.transaction(() => {
      upsertEpoch.run(
        store.epoch.epochId,
        store.epoch.seedHex,
        Math.max(0, Math.trunc(store.epoch.simTick)),
        Math.max(0, store.epoch.simTimeSec),
        store.epoch.merkleRootHex,
        Math.max(0, store.epoch.freeEnergyReserveKj),
      );

      for (const bm of store.biomes.values()) {
        upsertBiome.run(
          bm.biomeId,
          bm.epochId,
          bm.name,
          bm.kind,
          bm.centerX,
          bm.centerZ,
          Math.max(0.1, bm.radius),
          Math.max(0, bm.nutrientPoolKj),
          Math.max(0, bm.detritusPoolKj),
          clampFinite(bm.o2Saturation, 0, 2.5, 1.0),
          Math.max(1, bm.osmolarityMOsM),
          Math.max(1, bm.temperatureK),
        );
      }

      const sortedSpecies = Array.from(store.species.values()).sort((a, b) => a.speciesId - b.speciesId);
      for (const sp of sortedSpecies) {
        upsertSpecies.run(
          sp.speciesId,
          sp.parentSpeciesId,
          Math.max(0, Math.trunc(sp.originTick)),
          sp.casteRole,
          sp.latinBinomial,
          sp.commonGlyph,
          sp.genomeHashHex,
          clampFinite(sp.baseHueDeg, 0, 360, 180),
          Math.max(0, Math.trunc(sp.extantCount)),
          Math.max(0, sp.meanFitness),
        );
      }

      for (let e = 0; e < store.activeCount; e++) {
        upsertOrg.run(
          e,
          store.speciesFk[e]!,
          store.biomeFk[e]!,
          store.alive[e]! ? 1 : 0,
          Math.max(1, store.generation[e]!),
          store.flawMask[e]! & 0x0f,
          store.morphotypeId[e]! & 0x0f,
          Math.max(-1, store.entangledPartnerId[e]!),
          Math.min(2, store.sleepStage[e]!),
          Math.max(0, store.aurumWealth[e]!),
          Math.max(0, store.umbraWealth[e]!),
          Math.max(0, store.ageSec[e]!),
          store.posX[e]!,
          store.posY[e]!,
          store.posZ[e]!,
          store.velX[e]!,
          store.velY[e]!,
          store.velZ[e]!,
          Math.max(0.05, store.massKg[e]!),
          clampFinite(store.telomereIntegrity[e]!, 0, 1, 1),
        );

        const pBase = e * METABOLIC_POOL_COUNT;
        const gutTotal = Math.max(0, store.pools15[pBase]! + store.pools15[pBase + 1]! + store.pools15[pBase + 2]!);
        const glycTotal = Math.max(0, store.pools15[pBase + 8]! + store.pools15[pBase + 9]!);
        upsertMetab.run(
          e,
          Math.max(0, store.totalIntakeKj[e]!),
          gutTotal,
          Math.max(0, store.pools15[pBase + 3]!),
          glycTotal,
          Math.max(0, store.pools15[pBase + 10]!),
          Math.max(0, store.pools15[pBase + 12]!),
          Math.max(0, store.pools15[pBase + 13]!),
          clampFinite(store.o2Reserve[e]!, 0, 1, 0.95),
          clampFinite(store.co2Level[e]!, 0, 2, 0.12),
          clampFinite(store.bloodPh[e]!, 6.5, 8.2, 7.4),
          clampFinite(store.rosDamage[e]!, 0, 1, 0.02),
          clampFinite(store.hydration[e]!, 0, 1, 0.92),
          store.insulin[e]!,
          store.glucagon[e]!,
        );

        upsertNeural.run(
          e,
          store.modulators2[e * 2]!,
          store.modulators2[e * 2 + 1]!,
          store.norepinephrine[e]!,
          store.serotonin[e]!,
          clampFinite(store.pciProxy[e]!, 0, 1, 0.42),
          Math.max(0, store.thoughtCurvatureKappa[e]!),
          store.freeWontVetoCount[e]!,
        );
      }

      if (store.quantumSubstrates.size > 0) {
        for (const qs of store.quantumSubstrates.values()) {
          upsertQuantum.run(
            qs.substrateId,
            qs.epochId,
            qs.entityId,
            clampFinite(qs.qubitCount, 2, 64, 8),
            Math.max(0, Math.round(qs.contextualityWitness)),
            Math.max(0, qs.fubiniStudyTraceG),
            qs.berryCurvatureOmega,
            clampFinite(quantumMeta.qrngEntropyBits, 0, 8, 5.8),
          );
        }
      } else {
        upsertQuantum.run(
          1,
          store.epoch.epochId,
          store.activeCount > 0 ? 0 : null,
          8,
          Math.max(0, Math.round(quantumMeta.violatedHexagonLines)),
          Math.max(0, quantumMeta.fubiniStudyTrace),
          quantumMeta.berryCurvatureXY,
          clampFinite(quantumMeta.qrngEntropyBits, 0, 8, 5.8),
        );
      }

      for (const bond of store.socialBonds.values()) {
        upsertBond.run(
          bond.bondId,
          bond.sourceEntityId,
          bond.targetEntityId,
          clampFinite(bond.trustWeight, -1, 1, 0),
          clampFinite(bond.kinshipCoeff, 0, 1, 0),
          Math.max(0, bond.lastSignalTick),
          bond.glossodromCodewordHex,
          bond.syndromeClean ? 1 : 0,
        );
      }
    });

    tx();

    const epRow = this.db
      .query('SELECT public_uid AS publicUid FROM world_epochs WHERE epoch_id = ?')
      .get(store.epoch.epochId) as { publicUid: string } | null;

    return {
      savedOrganisms: store.activeCount,
      savedBonds: store.socialBonds.size,
      epochTick: store.epoch.simTick,
      epochPublicUid: epRow?.publicUid ?? 'epc_local',
    };
  }

  /**
   * Hydrates an `ErpRelationalStore` from persisted SQLite tables on boot if a saved epoch exists (`I-328`).
   */
  public loadLatestCheckpoint(store: ErpRelationalStore): boolean {
    const ep = this.db
      .query(
        'SELECT epoch_id AS epochId, seed_hex AS seedHex, sim_tick AS simTick, sim_time_sec AS simTimeSec, merkle_root_hex AS merkleRootHex, free_energy_reserve_kj AS freeEnergyReserveKj FROM world_epochs ORDER BY epoch_id DESC LIMIT 1',
      )
      .get() as {
      epochId: number;
      seedHex: string;
      simTick: number;
      simTimeSec: number;
      merkleRootHex: string;
      freeEnergyReserveKj: number;
    } | null;

    if (!ep) return false;

    store.epoch = { ...ep };
    store.biomes.clear();
    const biomes = this.db
      .query(
        'SELECT biome_id AS biomeId, epoch_id AS epochId, name, kind, center_x AS centerX, center_z AS centerZ, radius, nutrient_pool_kj AS nutrientPoolKj, detritus_pool_kj AS detritusPoolKj, o2_saturation AS o2Saturation, osmolarity_mosm AS osmolarityMOsM, temperature_k AS temperatureK FROM biome_zones WHERE epoch_id = ? ORDER BY biome_id ASC',
      )
      .all(ep.epochId) as Array<{
      biomeId: number;
      epochId: number;
      name: string;
      kind: BiomeKind;
      centerX: number;
      centerZ: number;
      radius: number;
      nutrientPoolKj: number;
      detritusPoolKj: number;
      o2Saturation: number;
      osmolarityMOsM: number;
      temperatureK: number;
    }>;
    for (const bm of biomes) store.biomes.set(bm.biomeId, bm);

    store.species.clear();
    const species = this.db
      .query(
        'SELECT species_id AS speciesId, parent_species_id AS parentSpeciesId, origin_tick AS originTick, caste_role AS casteRole, latin_binomial AS latinBinomial, common_glyph AS commonGlyph, genome_hash_hex AS genomeHashHex, base_hue_deg AS baseHueDeg, extant_count AS extantCount, mean_fitness AS meanFitness FROM species_lineages ORDER BY species_id ASC',
      )
      .all() as Array<{
      speciesId: number;
      parentSpeciesId: number | null;
      originTick: number;
      casteRole: CasteRole;
      latinBinomial: string;
      commonGlyph: string;
      genomeHashHex: string;
      baseHueDeg: number;
      extantCount: number;
      meanFitness: number;
    }>;
    for (const sp of species) store.species.set(sp.speciesId, sp);

    const orgs = this.db
      .query(
        `SELECT o.entity_id AS entityId, o.species_id AS speciesId, o.biome_id AS biomeId, o.alive,
                o.generation, o.flaw_mask AS flawMask, o.morphotype_id AS morphotypeId,
                o.entangled_partner_id AS entangledPartnerId, o.sleep_stage AS sleepStage,
                o.aurum_wealth AS aurumWealth, o.umbra_wealth AS umbraWealth,
                o.age_sec AS ageSec, o.pos_x AS posX, o.pos_y AS posY, o.pos_z AS posZ,
                o.vel_x AS velX, o.vel_y AS velY, o.vel_z AS velZ, o.mass_kg AS massKg, o.telomere_integrity AS telomereIntegrity,
                m.total_intake_kj AS totalIntakeKj, m.gut_total_kj AS gutTotalKj, m.blood_glucose_kj AS bloodGlucoseKj,
                m.glycogen_total_kj AS glycogenTotalKj, m.adipose_kj AS adiposeKj, m.atp_buffer_kj AS atpBufferKj,
                m.dissipated_heat_kj AS dissipatedHeatKj, m.o2_reserve AS o2Reserve, m.co2_level AS co2Level,
                m.blood_ph AS bloodPh, m.ros_damage AS rosDamage, m.hydration, m.insulin, m.glucagon,
                n.dopamine_rpe AS dopamineRpe, n.acetylcholine_gate AS achGate, n.norepinephrine, n.serotonin,
                n.pci_proxy AS pciProxy, n.thought_curvature_kappa AS kappa, n.free_wont_veto_count AS vetoCount
         FROM organisms o
         JOIN metabolic_ledgers m ON m.entity_id = o.entity_id
         JOIN neural_cortex_states n ON n.entity_id = o.entity_id
         WHERE o.entity_id < ?
         ORDER BY o.entity_id ASC`,
      )
      .all(store.maxEntities) as Array<Record<string, number>>;

    let maxEntity = -1;
    for (const row of orgs) {
      const e = row.entityId!;
      if (e > maxEntity) maxEntity = e;
      store.speciesFk[e] = row.speciesId!;
      store.biomeFk[e] = row.biomeId!;
      store.alive[e] = row.alive!;
      store.generation[e] = row.generation!;
      store.flawMask[e] = row.flawMask!;
      store.morphotypeId[e] = row.morphotypeId!;
      store.entangledPartnerId[e] = row.entangledPartnerId!;
      store.sleepStage[e] = row.sleepStage!;
      store.aurumWealth[e] = row.aurumWealth!;
      store.umbraWealth[e] = row.umbraWealth!;
      store.ageSec[e] = row.ageSec!;
      store.posX[e] = row.posX!;
      store.posY[e] = row.posY!;
      store.posZ[e] = row.posZ!;
      store.velX[e] = row.velX!;
      store.velY[e] = row.velY!;
      store.velZ[e] = row.velZ!;
      store.massKg[e] = row.massKg!;
      store.telomereIntegrity[e] = row.telomereIntegrity!;

      const pBase = e * METABOLIC_POOL_COUNT;
      store.pools15.fill(0, pBase, pBase + METABOLIC_POOL_COUNT);
      store.pools15[pBase] = row.gutTotalKj!;
      store.pools15[pBase + 3] = row.bloodGlucoseKj!;
      store.pools15[pBase + 8] = row.glycogenTotalKj!;
      store.pools15[pBase + 10] = row.adiposeKj!;
      store.pools15[pBase + 12] = row.atpBufferKj!;
      store.pools15[pBase + 13] = row.dissipatedHeatKj!;
      const accounted =
        row.gutTotalKj! +
        row.bloodGlucoseKj! +
        row.glycogenTotalKj! +
        row.adiposeKj! +
        row.atpBufferKj! +
        row.dissipatedHeatKj!;
      const remainder = Math.max(0, row.totalIntakeKj! - accounted);
      store.pools15[pBase + 11] = remainder; // structuralBiomassKj
      store.totalIntakeKj[e] = accounted + remainder;

      store.o2Reserve[e] = row.o2Reserve!;
      store.co2Level[e] = row.co2Level!;
      store.bloodPh[e] = row.bloodPh!;
      store.rosDamage[e] = row.rosDamage!;
      store.hydration[e] = row.hydration!;
      store.insulin[e] = row.insulin!;
      store.glucagon[e] = row.glucagon!;

      store.modulators2[e * 2] = row.dopamineRpe!;
      store.modulators2[e * 2 + 1] = row.achGate!;
      store.norepinephrine[e] = row.norepinephrine!;
      store.serotonin[e] = row.serotonin!;
      store.pciProxy[e] = row.pciProxy!;
      store.thoughtCurvatureKappa[e] = row.kappa!;
      store.freeWontVetoCount[e] = row.vetoCount!;

      const wBase = e * ORGANISM_WEIGHT_STRIDE;
      if (store.weights126[wBase] === 0 && store.weights126[wBase + 1] === 0) {
        for (let w = 0; w < ORGANISM_WEIGHT_STRIDE; w++) {
          store.weights126[wBase + w] = Math.sin((e + 1) * (w + 1) * 0.37) * 0.22;
        }
      }
    }
    store.activeCount = maxEntity + 1;
    return store.activeCount > 0;
  }

  /**
   * Cursor-paginated, ESCAPE-safe, single-query organism explorer returning stable `public_uid` keys
   * without leaking sequential integer row IDs (`I-116..I-122`, `T-049`, `T-102..T-109`, `T-187`, `T-188`).
   */
  public queryPaginatedOrganisms(options: {
    cursorPublicUid?: string;
    limit?: number;
    casteRole?: CasteRole;
    biomePublicUid?: string;
    aliveOnly?: boolean;
    search?: string;
    sortBy?: 'publicUid' | 'ageSec' | 'atpBufferKj' | 'pciProxy' | 'latinBinomial';
    sortDir?: 'ASC' | 'DESC';
  } = {}): {
    items: PaginatedOrganismRow[];
    nextCursor: string | null;
    pageSize: number;
  } {
    const limit = Math.max(1, Math.min(MAX_DB_PAGE_SIZE, Math.trunc(options.limit ?? 32)));
    const where: string[] = ['o.soft_deleted = 0'];
    const params: Array<string | number> = [];

    if (options.aliveOnly !== false) {
      where.push('o.alive = 1');
    }
    if (options.casteRole) {
      where.push('s.caste_role = ?');
      params.push(options.casteRole);
    }
    if (options.biomePublicUid) {
      where.push('b.public_uid = ?');
      params.push(options.biomePublicUid);
    }
    if (options.search && options.search.trim().length > 0) {
      const pat = `%${escapeSqlLikePattern(options.search.trim())}%`;
      where.push("(s.latin_binomial LIKE ? ESCAPE '\\' OR b.name LIKE ? ESCAPE '\\')");
      params.push(pat, pat);
    }

    // Snapshot-stable cursor paging by internal monotonic creation anchor resolved via `public_uid`
    if (options.cursorPublicUid) {
      where.push('o.entity_id > COALESCE((SELECT entity_id FROM organisms WHERE public_uid = ?), 999999999)');
      params.push(options.cursorPublicUid);
    }

    const dir = options.sortDir === 'DESC' ? 'DESC' : 'ASC';
    let orderClause = 'o.entity_id ASC';
    if (!options.cursorPublicUid && options.sortBy) {
      const colMap: Record<NonNullable<typeof options.sortBy>, string> = {
        publicUid: 'o.public_uid',
        ageSec: 'o.age_sec',
        atpBufferKj: 'm.atp_buffer_kj',
        pciProxy: 'n.pci_proxy',
        latinBinomial: 's.latin_binomial COLLATE NOCASE',
      };
      orderClause = `${colMap[options.sortBy]} ${dir}, o.entity_id ASC`;
    }

    const sql = `
      SELECT
        o.public_uid AS publicUid,
        s.public_uid AS speciesPublicUid,
        b.public_uid AS biomePublicUid,
        s.latin_binomial AS latinBinomial,
        s.caste_role AS casteRole,
        b.name AS biomeName,
        o.alive AS alive,
        o.generation AS generation,
        o.flaw_mask AS flawMask,
        o.morphotype_id AS morphotypeId,
        o.sleep_stage AS sleepStage,
        o.aurum_wealth AS aurumWealth,
        o.umbra_wealth AS umbraWealth,
        o.age_sec AS ageSec,
        o.pos_x AS posX,
        o.pos_y AS posY,
        o.pos_z AS posZ,
        o.mass_kg AS massKg,
        o.telomere_integrity AS telomereIntegrity,
        m.atp_buffer_kj AS atpBufferKj,
        m.blood_glucose_kj AS bloodGlucoseKj,
        m.blood_ph AS bloodPh,
        m.ros_damage AS rosDamage,
        n.pci_proxy AS pciProxy,
        n.thought_curvature_kappa AS thoughtCurvatureKappa,
        o.version_rev AS versionRev,
        o.created_at_iso AS createdAtIso,
        o.updated_at_iso AS updatedAtIso
      FROM organisms o
      JOIN species_lineages s ON s.species_id = o.species_id
      JOIN biome_zones b ON b.biome_id = o.biome_id
      JOIN metabolic_ledgers m ON m.entity_id = o.entity_id
      JOIN neural_cortex_states n ON n.entity_id = o.entity_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderClause}
      LIMIT ?
    `;

    const rawRows = this.db.query(sql).all(...params, limit + 1) as Array<Record<string, unknown>>;
    const hasMore = rawRows.length > limit;
    const slice = hasMore ? rawRows.slice(0, limit) : rawRows;

    const items: PaginatedOrganismRow[] = slice.map((r) => ({
      publicUid: String(r.publicUid),
      speciesPublicUid: String(r.speciesPublicUid),
      biomePublicUid: String(r.biomePublicUid),
      latinBinomial: String(r.latinBinomial),
      casteRole: r.casteRole as CasteRole,
      biomeName: String(r.biomeName),
      alive: Number(r.alive) === 1,
      generation: Number(r.generation),
      flawMask: Number(r.flawMask),
      morphotypeId: Number(r.morphotypeId),
      sleepStage: (Number(r.sleepStage) as SleepStageCode) ?? 0,
      aurumWealth: Number(r.aurumWealth),
      umbraWealth: Number(r.umbraWealth),
      ageSec: Number(r.ageSec),
      pos: [Number(r.posX), Number(r.posY), Number(r.posZ)],
      massKg: Number(r.massKg),
      telomereIntegrity: Number(r.telomereIntegrity),
      atpBufferKj: Number(r.atpBufferKj),
      bloodGlucoseKj: Number(r.bloodGlucoseKj),
      bloodPh: Number(r.bloodPh),
      rosDamage: Number(r.rosDamage),
      pciProxy: Number(r.pciProxy),
      thoughtCurvatureKappa: Number(r.thoughtCurvatureKappa),
      versionRev: Number(r.versionRev),
      createdAtIso: String(r.createdAtIso),
      updatedAtIso: String(r.updatedAtIso),
    }));

    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.publicUid : null,
      pageSize: limit,
    };
  }

  /**
   * Optimistic-concurrency Biome resource CRUD (`I-120`, `T-098`, `T-189..T-192`).
   */
  public createBiomeZone(input: {
    epochId: number;
    name: string;
    kind: BiomeKind;
    centerX: number;
    centerZ: number;
    radius: number;
    nutrientPoolKj?: number;
    o2Saturation?: number;
    temperatureK?: number;
  }): {
    publicUid: string;
    name: string;
    kind: BiomeKind;
    centerX: number;
    centerZ: number;
    radius: number;
    nutrientPoolKj: number;
    o2Saturation: number;
    temperatureK: number;
    versionRev: number;
    createdAtIso: string;
    updatedAtIso: string;
  } {
    const nextIdRow = this.db.query('SELECT COALESCE(MAX(biome_id), 0) + 1 AS nextId FROM biome_zones').get() as {
      nextId: number;
    };
    this.db
      .prepare(
        `INSERT INTO biome_zones (biome_id, epoch_id, name, kind, center_x, center_z, radius, nutrient_pool_kj, detritus_pool_kj, o2_saturation, osmolarity_mosm, temperature_k)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 300.0, ?)`,
      )
      .run(
        nextIdRow.nextId,
        input.epochId,
        input.name.trim(),
        input.kind,
        input.centerX,
        input.centerZ,
        input.radius,
        input.nutrientPoolKj ?? 5000.0,
        input.o2Saturation ?? 1.0,
        input.temperatureK ?? 295.0,
      );
    const created = this.getBiomeByPublicUidByInternalId(nextIdRow.nextId);
    if (!created) throw new Error('Failed to retrieve newly created BiomeZone');
    return created;
  }

  private getBiomeByPublicUidByInternalId(biomeId: number) {
    return this.db
      .query(
        `SELECT public_uid AS publicUid, name, kind, center_x AS centerX, center_z AS centerZ,
                radius, nutrient_pool_kj AS nutrientPoolKj, o2_saturation AS o2Saturation,
                temperature_k AS temperatureK, version_rev AS versionRev,
                created_at_iso AS createdAtIso, updated_at_iso AS updatedAtIso
         FROM biome_zones WHERE biome_id = ?`,
      )
      .get(biomeId) as {
      publicUid: string;
      name: string;
      kind: BiomeKind;
      centerX: number;
      centerZ: number;
      radius: number;
      nutrientPoolKj: number;
      o2Saturation: number;
      temperatureK: number;
      versionRev: number;
      createdAtIso: string;
      updatedAtIso: string;
    } | null;
  }

  public getBiomeByPublicUid(publicUid: string) {
    return this.db
      .query(
        `SELECT public_uid AS publicUid, name, kind, center_x AS centerX, center_z AS centerZ,
                radius, nutrient_pool_kj AS nutrientPoolKj, o2_saturation AS o2Saturation,
                temperature_k AS temperatureK, version_rev AS versionRev,
                created_at_iso AS createdAtIso, updated_at_iso AS updatedAtIso
         FROM biome_zones WHERE public_uid = ?`,
      )
      .get(publicUid) as {
      publicUid: string;
      name: string;
      kind: BiomeKind;
      centerX: number;
      centerZ: number;
      radius: number;
      nutrientPoolKj: number;
      o2Saturation: number;
      temperatureK: number;
      versionRev: number;
      createdAtIso: string;
      updatedAtIso: string;
    } | null;
  }

  public updateBiomeOptimistic(
    publicUid: string,
    expectedVersionRev: number,
    patch: {
      name?: string;
      nutrientPoolKj?: number;
      o2Saturation?: number;
      temperatureK?: number;
    },
  ): { status: 'NOT_FOUND' | 'CONFLICT' | 'UPDATED'; record: ReturnType<Cqm2SqliteDatabase['getBiomeByPublicUid']> } {
    const existing = this.getBiomeByPublicUid(publicUid);
    if (!existing) return { status: 'NOT_FOUND', record: null };

    const res = this.db
      .prepare(
        `UPDATE biome_zones
         SET name = ?,
             nutrient_pool_kj = ?,
             o2_saturation = ?,
             temperature_k = ?,
             version_rev = version_rev + 1
         WHERE public_uid = ? AND version_rev = ?`,
      )
      .run(
        patch.name !== undefined ? patch.name.trim() : existing.name,
        patch.nutrientPoolKj !== undefined ? patch.nutrientPoolKj : existing.nutrientPoolKj,
        patch.o2Saturation !== undefined ? patch.o2Saturation : existing.o2Saturation,
        patch.temperatureK !== undefined ? patch.temperatureK : existing.temperatureK,
        publicUid,
        expectedVersionRev,
      );

    if (res.changes === 0) {
      return { status: 'CONFLICT', record: this.getBiomeByPublicUid(publicUid) };
    }
    return { status: 'UPDATED', record: this.getBiomeByPublicUid(publicUid) };
  }

  public deleteBiomeByPublicUid(publicUid: string): 'NOT_FOUND' | 'REFERENCED_CONFLICT' | 'DELETED' {
    const existing = this.getBiomeByPublicUid(publicUid);
    if (!existing) return 'NOT_FOUND';
    try {
      const res = this.db.prepare('DELETE FROM biome_zones WHERE public_uid = ?').run(publicUid);
      return res.changes > 0 ? 'DELETED' : 'NOT_FOUND';
    } catch {
      return 'REFERENCED_CONFLICT';
    }
  }

  public softDeleteOrganismByPublicUid(publicUid: string): boolean {
    const res = this.db
      .prepare('UPDATE organisms SET soft_deleted = 1, alive = 0, version_rev = version_rev + 1 WHERE public_uid = ? AND soft_deleted = 0')
      .run(publicUid);
    return res.changes > 0;
  }

  public appendAuditEvent(event: {
    actorId: string;
    actionName: string;
    targetResource: string;
    beforeJson?: Record<string, unknown>;
    afterJson?: Record<string, unknown>;
    requestId?: string;
  }): string {
    const row = this.db
      .query(
        `INSERT INTO audit_events (actor_id, action_name, target_resource, before_json, after_json, request_id)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING public_uid AS publicUid`,
      )
      .get(
        event.actorId,
        event.actionName,
        event.targetResource,
        JSON.stringify(event.beforeJson ?? {}),
        JSON.stringify(event.afterJson ?? {}),
        event.requestId ?? 'local',
      ) as { publicUid: string };
    return row.publicUid;
  }

  /**
   * Retention job (`I-129`, `T-112`): purges expired soft-deleted organisms and caps historical telemetry tables.
   */
  public purgeExpiredTelemetry(options: { maxReceipts?: number; maxExperiments?: number; purgeSoftDeletedOrganisms?: boolean } = {}): {
    deletedReceipts: number;
    deletedExperiments: number;
    deletedOrganisms: number;
  } {
    const maxReceipts = Math.max(16, options.maxReceipts ?? 2000);
    const maxExperiments = Math.max(8, options.maxExperiments ?? 500);

    let deletedReceipts = 0;
    let deletedExperiments = 0;
    let deletedOrganisms = 0;

    const tx = this.db.transaction(() => {
      const r1 = this.db
        .prepare(
          `DELETE FROM hardware_dispatch_receipts
           WHERE receipt_id NOT IN (
             SELECT receipt_id FROM hardware_dispatch_receipts ORDER BY receipt_id DESC LIMIT ?
           )`,
        )
        .run(maxReceipts);
      deletedReceipts = r1.changes;

      const r2 = this.db
        .prepare(
          `DELETE FROM causal_experiments
           WHERE experiment_id NOT IN (
             SELECT experiment_id FROM causal_experiments ORDER BY experiment_id DESC LIMIT ?
           )`,
        )
        .run(maxExperiments);
      deletedExperiments = r2.changes;

      if (options.purgeSoftDeletedOrganisms) {
        const r3 = this.db.prepare('DELETE FROM organisms WHERE soft_deleted = 1').run();
        deletedOrganisms = r3.changes;
      }
    });
    tx();
    return { deletedReceipts, deletedExperiments, deletedOrganisms };
  }

  public insertExperiment(
    epochId: number,
    rec: {
      benchmarkName: string;
      intactMean: number;
      lesionMean: number;
      cohensD: number;
      welchsT: number;
      passedGradeA: boolean;
      recordedAtTick: number;
    },
  ): string {
    const row = this.db
      .query(
        `INSERT INTO causal_experiments (epoch_id, benchmark_name, intact_mean, lesion_mean, cohens_d, welchs_t, passed_grade_a, recorded_at_tick)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING public_uid AS publicUid`,
      )
      .get(
        epochId,
        rec.benchmarkName,
        rec.intactMean,
        rec.lesionMean,
        rec.cohensD,
        rec.welchsT,
        rec.passedGradeA ? 1 : 0,
        Math.max(0, rec.recordedAtTick),
      ) as { publicUid: string };
    return row.publicUid;
  }

  public insertHardwareReceipt(
    epochId: number,
    rec: {
      simTick: number;
      deviceKind: string;
      kernelName: string;
      batchSize: number;
      elapsedMs: number;
      gflops: number;
      conservationValid: boolean;
    },
  ): string {
    const row = this.db
      .query(
        `INSERT INTO hardware_dispatch_receipts (epoch_id, sim_tick, device_kind, kernel_name, batch_size, elapsed_ms, gflops, conservation_valid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING public_uid AS publicUid`,
      )
      .get(
        epochId,
        Math.max(0, rec.simTick),
        rec.deviceKind,
        rec.kernelName,
        Math.max(0, rec.batchSize),
        Math.max(0, rec.elapsedMs),
        Math.max(0, rec.gflops),
        rec.conservationValid ? 1 : 0,
      ) as { publicUid: string };
    return row.publicUid;
  }

  public querySpeciesTrophicAnalytics(): Array<{
    speciesPublicUid: string;
    latinBinomial: string;
    casteRole: string;
    aliveOrganisms: number;
    avgAtpKj: number;
    avgBloodGlucoseKj: number;
    avgCurvatureKappa: number;
  }> {
    return this.db
      .query(
        `SELECT
           s.public_uid AS speciesPublicUid,
           s.latin_binomial AS latinBinomial,
           s.caste_role AS casteRole,
           COUNT(o.entity_id) AS aliveOrganisms,
           COALESCE(AVG(m.atp_buffer_kj), 0.0) AS avgAtpKj,
           COALESCE(AVG(m.blood_glucose_kj), 0.0) AS avgBloodGlucoseKj,
           COALESCE(AVG(n.thought_curvature_kappa), 0.0) AS avgCurvatureKappa
         FROM species_lineages s
         LEFT JOIN organisms o ON o.species_id = s.species_id AND o.alive = 1 AND o.soft_deleted = 0
         LEFT JOIN metabolic_ledgers m ON m.entity_id = o.entity_id
         LEFT JOIN neural_cortex_states n ON n.entity_id = o.entity_id
         GROUP BY s.species_id
         ORDER BY s.species_id ASC`,
      )
      .all() as Array<{
      speciesPublicUid: string;
      latinBinomial: string;
      casteRole: string;
      aliveOrganisms: number;
      avgAtpKj: number;
      avgBloodGlucoseKj: number;
      avgCurvatureKappa: number;
    }>;
  }

  public explainQueryPlan(sql: string, params: Array<string | number> = []): string[] {
    this.db.exec('ANALYZE;');
    const rows = this.db.query(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as Array<{ detail: string }>;
    return rows.map((r) => r.detail);
  }

  public close(): void {
    if (!this.closed) {
      this.closed = true;
      try {
        this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        // Ignore if WAL mode is inactive or read-only
      }
      this.db.close();
    }
  }
}
