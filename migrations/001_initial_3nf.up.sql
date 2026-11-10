-- CQM2 v2.1.0 Forward Migration 001: Normalized 3NF 10-Entity Schema + Migration Ledger
-- Enforces PRAGMA foreign_keys = ON, explicit ON DELETE actions, CHECK constraints,
-- non-sequential public_uid identifiers, optimistic version_rev counters, UTC ISO-8601
-- database-managed timestamps, and covering indexes on every foreign key and filter column.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  checksum_hex TEXT NOT NULL,
  applied_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 1. WorldEpoch
CREATE TABLE IF NOT EXISTS world_epochs (
  epoch_id INTEGER PRIMARY KEY,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('epc_' || lower(hex(randomblob(12)))),
  seed_hex TEXT NOT NULL CHECK (length(seed_hex) >= 4),
  sim_tick INTEGER NOT NULL CHECK (sim_tick >= 0),
  sim_time_sec REAL NOT NULL CHECK (sim_time_sec >= 0),
  merkle_root_hex TEXT NOT NULL CHECK (length(merkle_root_hex) >= 4),
  free_energy_reserve_kj REAL NOT NULL CHECK (free_energy_reserve_kj >= 0),
  version_rev INTEGER NOT NULL DEFAULT 1 CHECK (version_rev >= 1),
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 2. BiomeZone
CREATE TABLE IF NOT EXISTS biome_zones (
  biome_id INTEGER PRIMARY KEY,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('bio_' || lower(hex(randomblob(12)))),
  epoch_id INTEGER NOT NULL REFERENCES world_epochs(epoch_id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0 AND length(name) <= 120),
  kind TEXT NOT NULL CHECK (kind IN ('HYDROTHERMAL_ABYSS', 'PELAGIC_PHOTON_SHELF', 'CRYSTAL_REEF', 'SINGULARITY_RIM')),
  center_x REAL NOT NULL,
  center_z REAL NOT NULL,
  radius REAL NOT NULL CHECK (radius > 0),
  nutrient_pool_kj REAL NOT NULL CHECK (nutrient_pool_kj >= 0),
  detritus_pool_kj REAL NOT NULL CHECK (detritus_pool_kj >= 0),
  o2_saturation REAL NOT NULL CHECK (o2_saturation >= 0 AND o2_saturation <= 2.5),
  osmolarity_mosm REAL NOT NULL CHECK (osmolarity_mosm > 0),
  temperature_k REAL NOT NULL CHECK (temperature_k > 0),
  version_rev INTEGER NOT NULL DEFAULT 1 CHECK (version_rev >= 1),
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. SpeciesLineage
CREATE TABLE IF NOT EXISTS species_lineages (
  species_id INTEGER PRIMARY KEY,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('spc_' || lower(hex(randomblob(12)))),
  parent_species_id INTEGER NULL REFERENCES species_lineages(species_id) ON DELETE SET NULL,
  origin_tick INTEGER NOT NULL CHECK (origin_tick >= 0),
  caste_role TEXT NOT NULL CHECK (caste_role IN ('EXPLORER', 'HARVESTER', 'GUARDIAN', 'ARCHITECT', 'ORACLE')),
  latin_binomial TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(latin_binomial)) > 0 AND length(latin_binomial) <= 120),
  common_glyph TEXT NOT NULL CHECK (length(common_glyph) >= 1 AND length(common_glyph) <= 16),
  genome_hash_hex TEXT NOT NULL,
  base_hue_deg REAL NOT NULL CHECK (base_hue_deg >= 0 AND base_hue_deg <= 360.0001),
  extant_count INTEGER NOT NULL CHECK (extant_count >= 0),
  mean_fitness REAL NOT NULL CHECK (mean_fitness >= 0),
  version_rev INTEGER NOT NULL DEFAULT 1 CHECK (version_rev >= 1),
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 4. Organism
CREATE TABLE IF NOT EXISTS organisms (
  entity_id INTEGER PRIMARY KEY,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('org_' || lower(hex(randomblob(12)))),
  species_id INTEGER NOT NULL REFERENCES species_lineages(species_id) ON DELETE RESTRICT,
  biome_id INTEGER NOT NULL REFERENCES biome_zones(biome_id) ON DELETE RESTRICT,
  alive INTEGER NOT NULL CHECK (alive IN (0, 1)),
  soft_deleted INTEGER NOT NULL DEFAULT 0 CHECK (soft_deleted IN (0, 1)),
  generation INTEGER NOT NULL CHECK (generation >= 1),
  flaw_mask INTEGER NOT NULL CHECK (flaw_mask >= 0 AND flaw_mask <= 15),
  morphotype_id INTEGER NOT NULL DEFAULT 0 CHECK (morphotype_id >= 0 AND morphotype_id <= 15),
  entangled_partner_id INTEGER NOT NULL DEFAULT -1 CHECK (entangled_partner_id >= -1),
  sleep_stage INTEGER NOT NULL DEFAULT 0 CHECK (sleep_stage IN (0, 1, 2)),
  aurum_wealth REAL NOT NULL DEFAULT 10.0 CHECK (aurum_wealth >= 0),
  umbra_wealth REAL NOT NULL DEFAULT 2.0 CHECK (umbra_wealth >= 0),
  age_sec REAL NOT NULL CHECK (age_sec >= 0),
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  pos_z REAL NOT NULL,
  vel_x REAL NOT NULL,
  vel_y REAL NOT NULL,
  vel_z REAL NOT NULL,
  mass_kg REAL NOT NULL CHECK (mass_kg > 0),
  telomere_integrity REAL NOT NULL CHECK (telomere_integrity >= 0 AND telomere_integrity <= 1.0001),
  version_rev INTEGER NOT NULL DEFAULT 1 CHECK (version_rev >= 1),
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 5. MetabolicLedger (1:1 subtype of Organism; derived pool rollups synced atomically in persistCheckpoint)
CREATE TABLE IF NOT EXISTS metabolic_ledgers (
  entity_id INTEGER PRIMARY KEY REFERENCES organisms(entity_id) ON DELETE CASCADE,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('met_' || lower(hex(randomblob(12)))),
  total_intake_kj REAL NOT NULL CHECK (total_intake_kj >= 0),
  gut_total_kj REAL NOT NULL CHECK (gut_total_kj >= 0),
  blood_glucose_kj REAL NOT NULL CHECK (blood_glucose_kj >= 0),
  glycogen_total_kj REAL NOT NULL CHECK (glycogen_total_kj >= 0),
  adipose_kj REAL NOT NULL CHECK (adipose_kj >= 0),
  atp_buffer_kj REAL NOT NULL CHECK (atp_buffer_kj >= 0),
  dissipated_heat_kj REAL NOT NULL CHECK (dissipated_heat_kj >= 0),
  o2_reserve REAL NOT NULL DEFAULT 0.95 CHECK (o2_reserve >= 0 AND o2_reserve <= 1.0001),
  co2_level REAL NOT NULL DEFAULT 0.12 CHECK (co2_level >= 0 AND co2_level <= 2.0001),
  blood_ph REAL NOT NULL DEFAULT 7.40 CHECK (blood_ph >= 6.5 AND blood_ph <= 8.2),
  ros_damage REAL NOT NULL DEFAULT 0.02 CHECK (ros_damage >= 0 AND ros_damage <= 1.0001),
  hydration REAL NOT NULL CHECK (hydration >= 0 AND hydration <= 1.0001),
  insulin REAL NOT NULL,
  glucagon REAL NOT NULL,
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 6. NeuralCortexState (1:1 subtype of Organism)
CREATE TABLE IF NOT EXISTS neural_cortex_states (
  entity_id INTEGER PRIMARY KEY REFERENCES organisms(entity_id) ON DELETE CASCADE,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('neu_' || lower(hex(randomblob(12)))),
  dopamine_rpe REAL NOT NULL,
  acetylcholine_gate REAL NOT NULL,
  norepinephrine REAL NOT NULL,
  serotonin REAL NOT NULL,
  pci_proxy REAL NOT NULL CHECK (pci_proxy >= 0 AND pci_proxy <= 1.0001),
  thought_curvature_kappa REAL NOT NULL CHECK (thought_curvature_kappa >= 0),
  free_wont_veto_count INTEGER NOT NULL CHECK (free_wont_veto_count >= 0),
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 7. QuantumSubstrate
CREATE TABLE IF NOT EXISTS quantum_substrates (
  substrate_id INTEGER PRIMARY KEY,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('qnt_' || lower(hex(randomblob(12)))),
  epoch_id INTEGER NOT NULL REFERENCES world_epochs(epoch_id) ON DELETE CASCADE,
  entity_id INTEGER NULL REFERENCES organisms(entity_id) ON DELETE SET NULL,
  n_qubits INTEGER NOT NULL CHECK (n_qubits >= 2 AND n_qubits <= 64),
  violated_hexagon_lines INTEGER NOT NULL CHECK (violated_hexagon_lines >= 0),
  fubini_study_trace REAL NOT NULL CHECK (fubini_study_trace >= 0),
  berry_curvature_xy REAL NOT NULL,
  qrng_entropy_bits REAL NOT NULL CHECK (qrng_entropy_bits >= 0 AND qrng_entropy_bits <= 8.0001),
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 8. SocialBond
CREATE TABLE IF NOT EXISTS social_bonds (
  bond_id INTEGER PRIMARY KEY,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('bnd_' || lower(hex(randomblob(12)))),
  source_entity_id INTEGER NOT NULL REFERENCES organisms(entity_id) ON DELETE CASCADE,
  target_entity_id INTEGER NOT NULL REFERENCES organisms(entity_id) ON DELETE CASCADE,
  trust_weight REAL NOT NULL CHECK (trust_weight >= -1.0001 AND trust_weight <= 1.0001),
  kinship_coeff REAL NOT NULL CHECK (kinship_coeff >= 0 AND kinship_coeff <= 1.0001),
  last_signal_tick INTEGER NOT NULL CHECK (last_signal_tick >= 0),
  glossodrom_codeword_hex TEXT NOT NULL,
  syndrome_clean INTEGER NOT NULL CHECK (syndrome_clean IN (0, 1)),
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (source_entity_id, target_entity_id)
);

-- 9. CausalExperiment
CREATE TABLE IF NOT EXISTS causal_experiments (
  experiment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('exp_' || lower(hex(randomblob(12)))),
  epoch_id INTEGER NOT NULL REFERENCES world_epochs(epoch_id) ON DELETE CASCADE,
  benchmark_name TEXT NOT NULL CHECK (length(trim(benchmark_name)) > 0),
  intact_mean REAL NOT NULL,
  lesion_mean REAL NOT NULL,
  cohens_d REAL NOT NULL,
  welchs_t REAL NOT NULL,
  passed_grade_a INTEGER NOT NULL CHECK (passed_grade_a IN (0, 1)),
  recorded_at_tick INTEGER NOT NULL CHECK (recorded_at_tick >= 0),
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 10. HardwareDispatchReceipt
CREATE TABLE IF NOT EXISTS hardware_dispatch_receipts (
  receipt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('rcp_' || lower(hex(randomblob(12)))),
  epoch_id INTEGER NOT NULL REFERENCES world_epochs(epoch_id) ON DELETE CASCADE,
  sim_tick INTEGER NOT NULL CHECK (sim_tick >= 0),
  device_kind TEXT NOT NULL CHECK (device_kind IN ('GPU_CUDA', 'GPU_WEBGPU', 'NPU_OPENVINO', 'IGPU_DML', 'CPU_ZIG_SIMD', 'CPU_ASM_AVX2', 'RUST_LEDGER')),
  kernel_name TEXT NOT NULL CHECK (length(trim(kernel_name)) > 0),
  batch_size INTEGER NOT NULL CHECK (batch_size >= 0),
  elapsed_ms REAL NOT NULL CHECK (elapsed_ms >= 0),
  gflops REAL NOT NULL CHECK (gflops >= 0),
  conservation_valid INTEGER NOT NULL CHECK (conservation_valid IN (0, 1)),
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Covering Foreign-Key & Primary-Journey Filter Indexes (I-116, T-104)
CREATE INDEX IF NOT EXISTS idx_biomes_epoch ON biome_zones(epoch_id);
CREATE INDEX IF NOT EXISTS idx_species_parent ON species_lineages(parent_species_id);
CREATE INDEX IF NOT EXISTS idx_species_caste ON species_lineages(caste_role);
CREATE INDEX IF NOT EXISTS idx_organisms_species ON organisms(species_id);
CREATE INDEX IF NOT EXISTS idx_organisms_biome ON organisms(biome_id);
CREATE INDEX IF NOT EXISTS idx_organisms_alive_active ON organisms(alive, soft_deleted, entity_id);
CREATE INDEX IF NOT EXISTS idx_organisms_public_uid ON organisms(public_uid);
CREATE INDEX IF NOT EXISTS idx_quantum_epoch ON quantum_substrates(epoch_id);
CREATE INDEX IF NOT EXISTS idx_quantum_entity ON quantum_substrates(entity_id);
CREATE INDEX IF NOT EXISTS idx_bonds_src ON social_bonds(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_bonds_dst ON social_bonds(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_experiments_epoch_tick ON causal_experiments(epoch_id, recorded_at_tick DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_epoch_tick ON hardware_dispatch_receipts(epoch_id, sim_tick DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_tick ON hardware_dispatch_receipts(sim_tick);

-- Automatic Database-Managed updated_at_iso Triggers (I-121, T-096)
CREATE TRIGGER IF NOT EXISTS trg_world_epochs_updated_at
AFTER UPDATE ON world_epochs
FOR EACH ROW
WHEN NEW.updated_at_iso = OLD.updated_at_iso
BEGIN
  UPDATE world_epochs
  SET updated_at_iso = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE epoch_id = NEW.epoch_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_biome_zones_updated_at
AFTER UPDATE ON biome_zones
FOR EACH ROW
WHEN NEW.updated_at_iso = OLD.updated_at_iso
BEGIN
  UPDATE biome_zones
  SET updated_at_iso = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE biome_id = NEW.biome_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_species_lineages_updated_at
AFTER UPDATE ON species_lineages
FOR EACH ROW
WHEN NEW.updated_at_iso = OLD.updated_at_iso
BEGIN
  UPDATE species_lineages
  SET updated_at_iso = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE species_id = NEW.species_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_organisms_updated_at
AFTER UPDATE ON organisms
FOR EACH ROW
WHEN NEW.updated_at_iso = OLD.updated_at_iso
BEGIN
  UPDATE organisms
  SET updated_at_iso = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE entity_id = NEW.entity_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_metabolic_ledgers_updated_at
AFTER UPDATE ON metabolic_ledgers
FOR EACH ROW
WHEN NEW.updated_at_iso = OLD.updated_at_iso
BEGIN
  UPDATE metabolic_ledgers
  SET updated_at_iso = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE entity_id = NEW.entity_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_neural_cortex_states_updated_at
AFTER UPDATE ON neural_cortex_states
FOR EACH ROW
WHEN NEW.updated_at_iso = OLD.updated_at_iso
BEGIN
  UPDATE neural_cortex_states
  SET updated_at_iso = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE entity_id = NEW.entity_id;
END;
