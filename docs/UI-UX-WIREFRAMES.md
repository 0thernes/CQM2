# UI/UX Systems Design, Responsive Wireframes, Typography & Ergonomics

## 1. Viewport Breakpoint Wireframes (`320px` → `3840×2160` 4K)

### Mobile Portrait (`320px` – `767px`)
```text
+---------------------------------------+
| [CQM2] Cosmogonic Quantum Mech. v2.0  |
| [Browser Mode] [NOT SENTIENT] [Pause] |
+---------------------------------------+
| [1.Cosmos] [2.Silicon] [3.Brains] ->  |  <- Horizontal swipeable ARIA tablist (>=44px height)
+---------------------------------------+
|                                       |
|     3D Cosmos Viewport (320px+ H)     |  <- Touch orbit + Mobile Eco DPR cap (<=1.25x)
|     [Tick 120 · Alive 128]            |
+---------------------------------------+
|  Live KPI Grid (2-col fluid cards)    |
|  7-Rung God-Dial Sliders (full width) |
+---------------------------------------+
```

### Desktop & 4K UHD Observatory (`1120px` – `3840×2160`)
```text
+--------------------------------------------------------------------------------------------------+
| [CQM2] Cosmogonic Quantum Mechalogodrom 2     [LOCAL TRI-ENGINE] [NOT SENTIENT] [4K] [Pause] [⌘K]|
+--------------------------------------------------------------------------------------------------+
| [1.Cosmos 4K] [2.Silicon] [3.Asmodenius & Glitchling] [4.Quantum & Tsotchke] [5.ERP] [6.Export]  |
+---------------------------------------------------------------+----------------------------------+
|                                                               | Live Telemetry KPI Matrix (3x2)  |
|                                                               |----------------------------------|
|             4K InstancedMesh Relativistic Cosmos              | Rung 1: Kerr Spin a/M     [0.84] |
|          Kerr g^4 Singularity + 10-Shell Mechalogodrom        | Rung 1: Manifold Warp     [0.22] |
|          Asmodenius 8-Somite Spine + S^3 Zooid Strands        | Rung 2: Pauli Coupling    [0.65] |
|                                                               | Rung 3: Vent Flux kJ/s    [85.0] |
| [Tick 480 · Alive 128 · Merkle 0x168671d0]    [WASD/Drag/Zoom]| Rung 4..7 Sliders (<=2.2 Hz safe)|
+---------------------------------------------------------------+----------------------------------+
```

## 2. Typography, Contrast & Accessibility Standards

- **UI Sans Font**: `Inter`, system geometric sans fallback, fluid `clamp()` sizing from `0.75rem` to `1.85rem`.
- **Telemetry Numeric Font**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` on every live KPI, benchmark cell, and coordinate readout to prevent horizontal layout jitter.
- **Verified WCAG 2.2 Contrast**:
  - Primary `#eaf1fb` on `#050913` void = **17.4:1** (AAA)
  - Secondary `#a8bdd9` on `#0b1221` panel = **8.9:1** (AAA)
  - Cyan `#38bdf8` on `#0b1221` = **8.8:1** (AAA)
  - Gold `#fbbf24` on `#0b1221` = **11.2:1** (AAA)
- **Ergonomics & Safety**:
  - Zero `!important` declarations in `src/styles/tokens.css` (enforced by `scripts/lint.ts`).
  - Minimum `44px` interactive height (`--touch-min: 44px`) on buttons, tabs, and selects.
  - Hard `<= 2.2 Hz` temporal pulse clamp (`WCAG 2.3.1` Three Flashes or Below Threshold).
  - Full keyboard control: `1`–`7` workspace switching, `ArrowLeft`/`ArrowRight` ARIA tab focus, `WASD`/Arrows/`+`/`-`/`0` 3D camera navigation, `Space` Play/Pause, `Ctrl+K` Command Palette, and `.skip-link` bypass block.
