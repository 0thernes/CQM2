/**
 * CQM2 Normalized 3NF SQLite WAL Persistence Engine (`bun:sqlite`).
 * Persists all 10 Entity Relational Model (`ERM`) tables with strict `PRAGMA foreign_keys = ON`,
 * `CHECK` constraints, transactional world checkpoints, and analytical relational SQL queries.
 */
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ErpRelationalStore, METABOLIC_POOL_COUNT } from '../erp/relational-store';

export class Cqm2SqliteDatabase {
  public readonly db: Database;

  public constructor(dbPath = ':memory:') {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath, { create: true });
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.migrateSchema();
  }

  private migrateSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS world_epochs (
        epoch_id INTEGER PRIMARY KEY,
        seed_hex TEXT NOT NULL,
        sim_tick INTEGER NOT NULL CHECK (sim_tick >= 0),
        sim_time_sec REAL NOT NULL CHECK (sim_time_sec >= 0),
        merkle_root_hex TEXT NOT NULL,
        free_energy_reserve_kj REAL NOT NULL CHECK (free_energy_reserve_kj >= 0),
        updated_at_iso TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS biome_zones (
        biome_id INTEGER PRIMARY KEY,
        epoch_id INTEGER NOT NULL REFERENCES world_epochs(epoch_id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        center_x REAL NOT NULL,
        center_z REAL NOT NULL,
        radius REAL NOT NULL CHECK (radius > 0),
        nutrient_pool_kj REAL NOT NULL CHECK (nutrient_pool_kj >= 0),
        detritus_pool_kj REAL NOT NULL CHECK (detritus_pool_kj >= 0),
        o2_saturation REAL NOT NULL CHECK (o2_saturation >= 0),
        osmolarity_mosm REAL NOT NULL CHECK (osmolarity_mosm > 0),
        temperature_k REAL NOT NULL CHECK (temperature_k > 0)
      );

      CREATE TABLE IF NOT EXISTS species_lineages (
        species_id INTEGER PRIMARY KEY,
        parent_species_id INTEGER NULL REFERENCES species_lineages(species_id) ON DELETE SET NULL,
        origin_tick INTEGER NOT NULL CHECK (origin_tick >= 0),
        caste_role TEXT NOT NULL,
        latin_binomial TEXT NOT NULL,
        common_glyph TEXT NOT NULL,
        genome_hash_hex TEXT NOT NULL,
        base_hue_deg REAL NOT NULL,
        extant_count INTEGER NOT NULL CHECK (extant_count >= 0),
        mean_fitness REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organisms (
        entity_id INTEGER PRIMARY KEY,
        species_id INTEGER NOT NULL REFERENCES species_lineages(species_id) ON DELETE RESTRICT,
        biome_id INTEGER NOT NULL REFERENCES biome_zones(biome_id) ON DELETE RESTRICT,
        alive INTEGER NOT NULL CHECK (alive IN (0, 1)),
        generation INTEGER NOT NULL CHECK (generation >= 1),
        flaw_mask INTEGER NOT NULL CHECK (flaw_mask >= 0 AND flaw_mask <= 15),
        age_sec REAL NOT NULL CHECK (age_sec >= 0),
        pos_x REAL NOT NULL,
        pos_y REAL NOT NULL,
        pos_z REAL NOT NULL,
        vel_x REAL NOT NULL,
        vel_y REAL NOT NULL,
        vel_z REAL NOT NULL,
        mass_kg REAL NOT NULL CHECK (mass_kg > 0),
        telomere_integrity REAL NOT NULL CHECK (telomere_integrity >= 0 AND telomere_integrity <= 1.0001)
      );

      CREATE TABLE IF NOT EXISTS metabolic_ledgers (
        entity_id INTEGER PRIMARY KEY REFERENCES organisms(entity_id) ON DELETE CASCADE,
        total_intake_kj REAL NOT NULL CHECK (total_intake_kj >= 0),
        gut_total_kj REAL NOT NULL CHECK (gut_total_kj >= 0),
        blood_glucose_kj REAL NOT NULL CHECK (blood_glucose_kj >= 0),
        glycogen_total_kj REAL NOT NULL CHECK (glycogen_total_kj >= 0),
        adipose_kj REAL NOT NULL CHECK (adipose_kj >= 0),
        atp_buffer_kj REAL NOT NULL CHECK (atp_buffer_kj >= 0),
        dissipated_heat_kj REAL NOT NULL CHECK (dissipated_heat_kj >= 0),
        hydration REAL NOT NULL CHECK (hydration >= 0 AND hydration <= 1.0001),
        insulin REAL NOT NULL,
        glucagon REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS neural_cortex_states (
        entity_id INTEGER PRIMARY KEY REFERENCES organisms(entity_id) ON DELETE CASCADE,
        dopamine_rpe REAL NOT NULL,
        acetylcholine_gate REAL NOT NULL,
        norepinephrine REAL NOT NULL,
        serotonin REAL NOT NULL,
        pci_proxy REAL NOT NULL,
        thought_curvature_kappa REAL NOT NULL,
        free_wont_veto_count INTEGER NOT NULL CHECK (free_wont_veto_count >= 0)
      );

      CREATE TABLE IF NOT EXISTS quantum_substrates (
        substrate_id INTEGER PRIMARY KEY,
        epoch_id INTEGER NOT NULL REFERENCES world_epochs(epoch_id) ON DELETE CASCADE,
        entity_id INTEGER NULL REFERENCES organisms(entity_id) ON DELETE SET NULL,
        n_qubits INTEGER NOT NULL CHECK (n_qubits >= 2),
        violated_hexagon_lines INTEGER NOT NULL,
        fubini_study_trace REAL NOT NULL,
        berry_curvature_xy REAL NOT NULL,
        qrng_entropy_bits REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS social_bonds (
        bond_id INTEGER PRIMARY KEY,
        source_entity_id INTEGER NOT NULL REFERENCES organisms(entity_id) ON DELETE CASCADE,
        target_entity_id INTEGER NOT NULL REFERENCES organisms(entity_id) ON DELETE CASCADE,
        trust_weight REAL NOT NULL CHECK (trust_weight >= -1.0001 AND trust_weight <= 1.0001),
        kinship_coeff REAL NOT NULL CHECK (kinship_coeff >= 0 AND kinship_coeff <= 1.0001),
        last_signal_tick INTEGER NOT NULL,
        glossodrom_codeword_hex TEXT NOT NULL,
        syndrome_clean INTEGER NOT NULL CHECK (syndrome_clean IN (0, 1))
      );

      CREATE TABLE IF NOT EXISTS causal_experiments (
        experiment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        epoch_id INTEGER NOT NULL REFERENCES world_epochs(epoch_id) ON DELETE CASCADE,
        benchmark_name TEXT NOT NULL,
        intact_mean REAL NOT NULL,
        lesion_mean REAL NOT NULL,
        cohens_d REAL NOT NULL,
        welchs_t REAL NOT NULL,
        passed_grade_a INTEGER NOT NULL CHECK (passed_grade_a IN (0, 1)),
        recorded_at_tick INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hardware_dispatch_receipts (
        receipt_id INTEGER PRIMARY KEY AUTOINCREMENT,
        epoch_id INTEGER NOT NULL REFERENCES world_epochs(epoch_id) ON DELETE CASCADE,
        sim_tick INTEGER NOT NULL,
        device_kind TEXT NOT NULL,
        kernel_name TEXT NOT NULL,
        batch_size INTEGER NOT NULL,
        elapsed_ms REAL NOT NULL,
        gflops REAL NOT NULL,
        conservation_valid INTEGER NOT NULL CHECK (conservation_valid IN (0, 1))
      );

      CREATE INDEX IF NOT EXISTS idx_organisms_species ON organisms(species_id);
      CREATE INDEX IF NOT EXISTS idx_organisms_biome ON organisms(biome_id);
      CREATE INDEX IF NOT EXISTS idx_bonds_src ON social_bonds(source_entity_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_tick ON hardware_dispatch_receipts(sim_tick);
    `);
  }

  /**
   * Atomically persists the entire 10-entity ERP world state in a single ACID transaction!
   */
  public persistCheckpoint(
    store: ErpRelationalStore,
    quantumMeta: { violatedHexagonLines: number; fubiniStudyTrace: number; berryCurvatureXY: number; qrngEntropyBits: number } = {
      violatedHexagonLines: 63,
      fubiniStudyTrace: 14.0,
      berryCurvatureXY: 0.0,
      qrngEntropyBits: 5.8,
    },
  ): { savedOrganisms: number; savedBonds: number; epochTick: number } {
    const upsertEpoch = this.db.prepare(`
      INSERT INTO world_epochs (epoch_id, seed_hex, sim_tick, sim_time_sec, merkle_root_hex, free_energy_reserve_kj, updated_at_iso)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(epoch_id) DO UPDATE SET
        sim_tick = excluded.sim_tick,
        sim_time_sec = excluded.sim_time_sec,
        merkle_root_hex = excluded.merkle_root_hex,
        free_energy_reserve_kj = excluded.free_energy_reserve_kj,
        updated_at_iso = excluded.updated_at_iso
    `);

    const upsertBiome = this.db.prepare(`
      INSERT INTO biome_zones (biome_id, epoch_id, name, kind, center_x, center_z, radius, nutrient_pool_kj, detritus_pool_kj, o2_saturation, osmolarity_mosm, temperature_k)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(biome_id) DO UPDATE SET
        nutrient_pool_kj = excluded.nutrient_pool_kj,
        detritus_pool_kj = excluded.detritus_pool_kj,
        o2_saturation = excluded.o2_saturation
    `);

    const upsertSpecies = this.db.prepare(`
      INSERT INTO species_lineages (species_id, parent_species_id, origin_tick, caste_role, latin_binomial, common_glyph, genome_hash_hex, base_hue_deg, extant_count, mean_fitness)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(species_id) DO UPDATE SET
        extant_count = excluded.extant_count,
        mean_fitness = excluded.mean_fitness
    `);

    const upsertOrg = this.db.prepare(`
      INSERT INTO organisms (entity_id, species_id, biome_id, alive, generation, flaw_mask, age_sec, pos_x, pos_y, pos_z, vel_x, vel_y, vel_z, mass_kg, telomere_integrity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        alive = excluded.alive,
        age_sec = excluded.age_sec,
        pos_x = excluded.pos_x,
        pos_y = excluded.pos_y,
        pos_z = excluded.pos_z,
        vel_x = excluded.vel_x,
        vel_y = excluded.vel_y,
        vel_z = excluded.vel_z,
        telomere_integrity = excluded.telomere_integrity
    `);

    const upsertMetab = this.db.prepare(`
      INSERT INTO metabolic_ledgers (entity_id, total_intake_kj, gut_total_kj, blood_glucose_kj, glycogen_total_kj, adipose_kj, atp_buffer_kj, dissipated_heat_kj, hydration, insulin, glucagon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        total_intake_kj = excluded.total_intake_kj,
        gut_total_kj = excluded.gut_total_kj,
        blood_glucose_kj = excluded.blood_glucose_kj,
        glycogen_total_kj = excluded.glycogen_total_kj,
        adipose_kj = excluded.adipose_kj,
        atp_buffer_kj = excluded.atp_buffer_kj,
        dissipated_heat_kj = excluded.dissipated_heat_kj,
        hydration = excluded.hydration,
        insulin = excluded.insulin,
        glucagon = excluded.glucagon
    `);

    const upsertNeural = this.db.prepare(`
      INSERT INTO neural_cortex_states (entity_id, dopamine_rpe, acetylcholine_gate, norepinephrine, serotonin, pci_proxy, thought_curvature_kappa, free_wont_veto_count)
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
      VALUES (1, ?, ?, 3, ?, ?, ?, ?)
      ON CONFLICT(substrate_id) DO UPDATE SET
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
        last_signal_tick = excluded.last_signal_tick,
        glossodrom_codeword_hex = excluded.glossodrom_codeword_hex,
        syndrome_clean = excluded.syndrome_clean
    `);

    const tx = this.db.transaction(() => {
      upsertEpoch.run(
        store.epoch.epochId,
        store.epoch.seedHex,
        store.epoch.simTick,
        store.epoch.simTimeSec,
        store.epoch.merkleRootHex,
        store.epoch.freeEnergyReserveKj,
        new Date().toISOString(),
      );

      for (const bm of store.biomes.values()) {
        upsertBiome.run(
          bm.biomeId,
          bm.epochId,
          bm.name,
          bm.kind,
          bm.centerX,
          bm.centerZ,
          bm.radius,
          bm.nutrientPoolKj,
          bm.detritusPoolKj,
          bm.o2Saturation,
          bm.osmolarityMOsM,
          bm.temperatureK,
        );
      }

      const sortedSpecies = Array.from(store.species.values()).sort((a, b) => a.speciesId - b.speciesId);
      for (const sp of sortedSpecies) {
        upsertSpecies.run(
          sp.speciesId,
          sp.parentSpeciesId,
          sp.originTick,
          sp.casteRole,
          sp.latinBinomial,
          sp.commonGlyph,
          sp.genomeHashHex,
          sp.baseHueDeg,
          sp.extantCount,
          sp.meanFitness,
        );
      }

      for (let e = 0; e < store.activeCount; e++) {
        upsertOrg.run(
          e,
          store.speciesFk[e]!,
          store.biomeFk[e]!,
          store.alive[e]!,
          store.generation[e]!,
          store.flawMask[e]!,
          store.ageSec[e]!,
          store.posX[e]!,
          store.posY[e]!,
          store.posZ[e]!,
          store.velX[e]!,
          store.velY[e]!,
          store.velZ[e]!,
          store.massKg[e]!,
          store.telomereIntegrity[e]!,
        );

        const pBase = e * METABOLIC_POOL_COUNT;
        const gutTotal = store.pools15[pBase]! + store.pools15[pBase + 1]! + store.pools15[pBase + 2]!;
        const glycTotal = store.pools15[pBase + 8]! + store.pools15[pBase + 9]!;
        upsertMetab.run(
          e,
          store.totalIntakeKj[e]!,
          gutTotal,
          store.pools15[pBase + 3]!,
          glycTotal,
          store.pools15[pBase + 10]!,
          store.pools15[pBase + 12]!,
          store.pools15[pBase + 13]!,
          store.hydration[e]!,
          store.insulin[e]!,
          store.glucagon[e]!,
        );

        upsertNeural.run(
          e,
          store.modulators2[e * 2]!,
          store.modulators2[e * 2 + 1]!,
          store.norepinephrine[e]!,
          store.serotonin[e]!,
          store.pciProxy[e]!,
          store.thoughtCurvatureKappa[e]!,
          store.freeWontVetoCount[e]!,
        );
      }

      upsertQuantum.run(
        store.epoch.epochId,
        store.activeCount > 0 ? 0 : null,
        quantumMeta.violatedHexagonLines,
        quantumMeta.fubiniStudyTrace,
        quantumMeta.berryCurvatureXY,
        quantumMeta.qrngEntropyBits,
      );

      for (const bond of store.socialBonds.values()) {
        upsertBond.run(
          bond.bondId,
          bond.sourceEntityId,
          bond.targetEntityId,
          bond.trustWeight,
          bond.kinshipCoeff,
          bond.lastSignalTick,
          bond.glossodromCodewordHex,
          bond.syndromeClean ? 1 : 0,
        );
      }
    });

    tx();
    return {
      savedOrganisms: store.activeCount,
      savedBonds: store.socialBonds.size,
      epochTick: store.epoch.simTick,
    };
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
  ): void {
    this.db
      .prepare(
        `INSERT INTO causal_experiments (epoch_id, benchmark_name, intact_mean, lesion_mean, cohens_d, welchs_t, passed_grade_a, recorded_at_tick)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        epochId,
        rec.benchmarkName,
        rec.intactMean,
        rec.lesionMean,
        rec.cohensD,
        rec.welchsT,
        rec.passedGradeA ? 1 : 0,
        rec.recordedAtTick,
      );
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
  ): void {
    this.db
      .prepare(
        `INSERT INTO hardware_dispatch_receipts (epoch_id, sim_tick, device_kind, kernel_name, batch_size, elapsed_ms, gflops, conservation_valid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        epochId,
        rec.simTick,
        rec.deviceKind,
        rec.kernelName,
        rec.batchSize,
        rec.elapsedMs,
        rec.gflops,
        rec.conservationValid ? 1 : 0,
      );
  }

  public querySpeciesTrophicAnalytics(): Array<{
    speciesId: number;
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
           s.species_id AS speciesId,
           s.latin_binomial AS latinBinomial,
           s.caste_role AS casteRole,
           COUNT(o.entity_id) AS aliveOrganisms,
           COALESCE(AVG(m.atp_buffer_kj), 0.0) AS avgAtpKj,
           COALESCE(AVG(m.blood_glucose_kj), 0.0) AS avgBloodGlucoseKj,
           COALESCE(AVG(n.thought_curvature_kappa), 0.0) AS avgCurvatureKappa
         FROM species_lineages s
         LEFT JOIN organisms o ON o.species_id = s.species_id AND o.alive = 1
         LEFT JOIN metabolic_ledgers m ON m.entity_id = o.entity_id
         LEFT JOIN neural_cortex_states n ON n.entity_id = o.entity_id
         GROUP BY s.species_id
         ORDER BY s.species_id ASC`,
      )
      .all() as Array<{
      speciesId: number;
      latinBinomial: string;
      casteRole: string;
      aliveOrganisms: number;
      avgAtpKj: number;
      avgBloodGlucoseKj: number;
      avgCurvatureKappa: number;
    }>;
  }

  public close(): void {
    this.db.close();
  }
}
