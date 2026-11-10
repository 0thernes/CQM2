-- CQM2 v2.1.0 Rollback Migration 001: Drops 001_initial_3nf objects in reverse dependency order
-- Backup requirement: Cqm2SqliteDatabase.runRollbackMigration() refuses execution unless a verified backup is provided (I-115, T-119).

DROP TRIGGER IF EXISTS trg_neural_cortex_states_updated_at;
DROP TRIGGER IF EXISTS trg_metabolic_ledgers_updated_at;
DROP TRIGGER IF EXISTS trg_organisms_updated_at;
DROP TRIGGER IF EXISTS trg_species_lineages_updated_at;
DROP TRIGGER IF EXISTS trg_biome_zones_updated_at;
DROP TRIGGER IF EXISTS trg_world_epochs_updated_at;

DROP INDEX IF EXISTS idx_receipts_tick;
DROP INDEX IF EXISTS idx_receipts_epoch_tick;
DROP INDEX IF EXISTS idx_experiments_epoch_tick;
DROP INDEX IF EXISTS idx_bonds_dst;
DROP INDEX IF EXISTS idx_bonds_src;
DROP INDEX IF EXISTS idx_quantum_entity;
DROP INDEX IF EXISTS idx_quantum_epoch;
DROP INDEX IF EXISTS idx_organisms_public_uid;
DROP INDEX IF EXISTS idx_organisms_alive_active;
DROP INDEX IF EXISTS idx_organisms_biome;
DROP INDEX IF EXISTS idx_organisms_species;
DROP INDEX IF EXISTS idx_species_caste;
DROP INDEX IF EXISTS idx_species_parent;
DROP INDEX IF EXISTS idx_biomes_epoch;

DROP TABLE IF EXISTS hardware_dispatch_receipts;
DROP TABLE IF EXISTS causal_experiments;
DROP TABLE IF EXISTS social_bonds;
DROP TABLE IF EXISTS quantum_substrates;
DROP TABLE IF EXISTS neural_cortex_states;
DROP TABLE IF EXISTS metabolic_ledgers;
DROP TABLE IF EXISTS organisms;
DROP TABLE IF EXISTS species_lineages;
DROP TABLE IF EXISTS biome_zones;
DROP TABLE IF EXISTS world_epochs;

DELETE FROM schema_migrations WHERE version = '001_initial_3nf';
