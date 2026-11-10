# Entity Relationship Diagram (`ERD`), Modeling (`ERM`) & Programming (`ERP`)

CQM2 models every cosmological, ecological, physiological, cognitive, quantum, and hardware state variable across **10 normalized third-normal-form (`3NF`) entities**, implemented in-memory as Structure-of-Arrays (`SoA`) columns (`src/erp/relational-store.ts`) and persisted on disk in SQLite `WAL` (`src/server/db.ts`).

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
    string seed_hex
    int sim_tick
    float sim_time_sec
    string merkle_root_hex
    float free_energy_reserve_kj
  }
  BIOME_ZONES {
    int biome_id PK
    int epoch_id FK
    string name
    string kind
    float nutrient_pool_kj
    float detritus_pool_kj
    float o2_saturation
  }
  SPECIES_LINEAGES {
    int species_id PK
    int parent_species_id FK
    string caste_role
    string latin_binomial
    int extant_count
  }
  ORGANISMS {
    int entity_id PK
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
```

## 2. Entity Relational Programming (`ERP`) Invariants

1. **Referential Integrity**: `spawnOrganism()` and `upsertSocialBond()` verify foreign keys in $O(1)$ before mutating typed-array slots; SQLite enforces `PRAGMA foreign_keys = ON` with `ON DELETE CASCADE` / `ON DELETE RESTRICT`.
2. **Zero-GC Contiguous Strides**:
   - `MetabolicLedger.pools15`: `Float64Array(maxEntities * 15)` — stride-15 contiguous layout passed directly by pointer into `cqm2_rust_audit_metabolic_conservation`.
   - `NeuralCortexState.weights126`: `Float32Array(maxEntities * 126)` — stride-126 contiguous layout passed directly into `cqm2_organism_brain_batch_simd` and WebGPU `WGSL` storage buffers.
3. **Reversible Time-Travel Ring (`NOVEL-100 N01`)**: `captureSnapshot()` and `rollbackToSnapshot(tick)` save and restore complete multi-table world epochs deterministically.
