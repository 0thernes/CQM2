# Entity Relationship Diagram (`ERD`), Modeling (`ERM`) & Programming (`ERP`)

CQM2 (`v2.1.0`) models every cosmological, ecological, physiological, cognitive, quantum, hardware, and audit state variable across **10 normalized third-normal-form (`3NF`) simulation entities** plus an append-only **`audit_events` governance ledger**, implemented in-memory as Structure-of-Arrays (`SoA`) columns (`src/erp/relational-store.ts`) and persisted on disk via reversible SQL migrations (`migrations/001..002`) in SQLite `WAL` (`src/server/db.ts`).

## 1. Entity Relationship Diagram (`ERD`)

```mermaid
erDiagram
  WORLD_EPOCHS ||--o{ BIOME_ZONES : "contains"
  WORLD_EPOCHS ||--o{ QUANTUM_SUBSTRATES : "hosts"
  WORLD_EPOCHS ||--o{ CAUSAL_EXPERIMENTS : "records"
  WORLD_EPOCHS ||--o{ HARDWARE_DISPATCH_RECEIPTS : "logs"
  SPECIES_LINEAGES ||--o{ SPECIES_LINEAGES : "evolves_from"
  SPECIES_LINEAGES ||--o{ ORGANISMS : "classifies"
  BIOME_ZONES ||--o{ ORGANISMS : "inhabited_by"
  ORGANISMS ||--|| METABOLIC_LEDGERS : "conserves_15_pools"
  ORGANISMS ||--|| NEURAL_CORTEX_STATES : "embodies_brain"
  ORGANISMS ||--o{ SOCIAL_BONDS : "signals_source"
  ORGANISMS ||--o{ SOCIAL_BONDS : "signals_target"
  ORGANISMS ||--o{ QUANTUM_SUBSTRATES : "couples_to"

  WORLD_EPOCHS {
    int epoch_id PK
    string public_uid UK
    int version_rev
    string seed_hex
    int sim_tick
    float sim_time_sec
    string merkle_root_hex
    float free_energy_reserve_kj
  }
  BIOME_ZONES {
    int biome_id PK
    string public_uid UK
    int version_rev
    int epoch_id FK
    string name
    string kind
    float nutrient_pool_kj
    float detritus_pool_kj
    float o2_saturation
  }
  SPECIES_LINEAGES {
    int species_id PK
    string public_uid UK
    int version_rev
    int parent_species_id FK
    string caste_role
    string latin_binomial
    int extant_count
  }
  ORGANISMS {
    int entity_id PK
    string public_uid UK
    int version_rev
    int species_id FK
    int biome_id FK
    int alive
    int flaw_mask
    float pos_x
    float pos_y
    float pos_z
    float telomere_integrity
  }
  METABOLIC_LEDGERS {
    int entity_id PK_FK
    float total_intake_kj
    float blood_glucose_kj
    float atp_buffer_kj
    float dissipated_heat_kj
    float hydration
  }
  NEURAL_CORTEX_STATES {
    int entity_id PK_FK
    float dopamine_rpe
    float acetylcholine_gate
    float pci_proxy
    float thought_curvature_kappa
    int free_wont_veto_count
  }
  QUANTUM_SUBSTRATES {
    int substrate_id PK
    int epoch_id FK
    int entity_id FK
    int violated_hexagon_lines
    float fubini_study_trace
  }
  SOCIAL_BONDS {
    int bond_id PK
    int source_entity_id FK
    int target_entity_id FK
    float trust_weight
    string glossodrom_codeword_hex
    int syndrome_clean
  }
  CAUSAL_EXPERIMENTS {
    int experiment_id PK
    int epoch_id FK
    string benchmark_name
    float cohens_d
    float welchs_t
    int passed_grade_a
  }
  HARDWARE_DISPATCH_RECEIPTS {
    int receipt_id PK
    int epoch_id FK
    int sim_tick
    string device_kind
    float elapsed_ms
    float gflops
  }
  AUDIT_EVENTS {
    int event_id PK
    string public_uid UK
    string created_at_iso
    string actor_kind
    string action_code
    string payload_sha256
  }
```

## 2. Entity Relational Programming (`ERP`) & SQLite WAL Invariants

1. **Referential Integrity & Opaque External IDs (`I-092`)**: `spawnOrganism()` and `upsertSocialBond()` verify foreign keys in $O(1)$ before mutating typed-array slots; SQLite enforces `PRAGMA foreign_keys = ON`, `CHECK` constraints, `public_uid` opaque tokens, and `version_rev` optimistic concurrency (`409 Conflict` on stale write).
2. **Reversible SQL Migrations & Verified Backups (`I-089..I-095`)**: `migrations/001_initial_3nf.{up,down}.sql` and `migrations/002_audit_events_ledger.{up,down}.sql` execute inside atomic transactions; `rollbackMigration()` refuses execution unless a verified `VACUUM INTO` snapshot is supplied, and `audit_events` enforces SQLite `BEFORE UPDATE`/`BEFORE DELETE` abort triggers.
3. **Zero-GC Contiguous Strides & Bit-Exact `N01` Rollback**:
   - `MetabolicLedger.pools15`: `Float64Array(maxEntities * 15)` passed zero-copy by pointer into `cqm2_rust_audit_metabolic_conservation`.
   - `NeuralCortexState.weights126`: `Float32Array(maxEntities * 126)` passed directly into `cqm2_cuda_organism_brains_strided`, `cqm2_organism_brain_batch_simd`, and WebGPU `WGSL` storage buffers.
   - `captureWorldSnapshot()` and `rollbackToSnapshot()` restore complete world state + PRNG substreams bit-exactly (`merkleRootHex` verified identical on replay).
