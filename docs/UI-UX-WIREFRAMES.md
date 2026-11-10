# UI/UX Systems Design, Responsive Wireframes, Typography & Nielsen Heuristics

## 1. Clean `public/` Multi-Page Architecture & Breakpoints (`320px` → `3840×2160` 4K)

CQM2 (`v2.1.0`) serves **7 semantic HTML5 pages** from `public/` (with zero inline `style=` attributes and strict CSP `style-src 'self'`):
`index.html`, `docs.html`, `specs.html`, `bible.html` (13-chapter architectural & scientific bible), `glossary.html`, `downloads.html`, and `lab/quantum-wildbeyond.html` (interactive 4-qubit Ising VQE, Hoggar $H(2)=63$, `KS-18`, and `Voynich-Khôra` anyon braid workbench).

### Mobile Portrait (`320px` – `767px`)
```text
+---------------------------------------+
| [CQM2] Cosmogonic Quantum Mech. v2.1  |
| [Quad-Silicon] [NOT SENTIENT] [Pause] |
+---------------------------------------+
| [1.Cosmos] [2.Silicon] [3.Brains] ->  |  <- Swipeable ARIA tablist (>=44px touch target)
+---------------------------------------+
|     3D Cosmos Viewport (Pinch-Zoom    |  <- 2-pointer touch pinch + click-to-inspect raycast
|     + Mobile Eco DPR cap <=1.25x)     |
+---------------------------------------+
|  Live KPI Grid + 7-Rung God Dials     |
+---------------------------------------+
```

### Desktop & Cinema-4K Observatory (`1120px` – `3840×2160`)
```text
+----------------------------------------------------------------------------------------------------+
| [CQM2 v2.1] Cosmogonic Quantum Mechalogodrom 2  [QUAD-SILICON] [NOT SENTIENT] [4K] [9-Song] [⌘K]   |
+----------------------------------------------------------------------------------------------------+
| [1.Cosmos 4K] [2.Silicon] [3.Brains & 12-Bench] [4.Quantum & 27-Repos] [5.ERP] [6.Export & AI] [7] |
+-----------------------------------------------------------------+----------------------------------+
|  10 Analytical Mechalogodrom Shells (Hopf, Calabi-Yau,          | Live Telemetry KPI Matrix (3x2)  |
|  Clifford 4D, Boys, Mobius-Klein, Schlafli {7,3}, Hoggar 63,    | Selected Organism Raycast Card   |
|  Penrose Ergosphere, Fibonacci, Eshkol Frenet) + Polar Jets     | 10 Render Modes + 8 Cam Presets  |
|  + Big Tree r=14 Sanctuary + Asmodenius 24x24 Turing Skin       | 9-Song Synth + 32-Bin FFT Bar    |
|  + Xylos {7,3} Medusa + Glitchling Vectors                      | 7-Rung God-Dial Sliders (<=2.2Hz)|
+-----------------------------------------------------------------+----------------------------------+
```

## 2. Self-Hosted `.woff2` Typography, WCAG 2.2 AAA Contrast & Nielsen 10 Heuristics

- **Self-Hosted SIL OFL 1.1 Fonts (`public/fonts/`)**: `Inter` (`inter-latin-wght-normal.woff2`) and `JetBrains Mono` (`jetbrains-mono-latin-400/700-normal.woff2`) with `@font-face { font-display: swap }` and `font-variant-numeric: tabular-nums` on every numeric KPI.
- **Verified Contrast**: `#eaf1fb` on `#050913` = **17.4:1** (AAA); `#a8bdd9` on `#0b1221` = **8.9:1** (AAA); `#38bdf8` on `#0b1221` = **8.8:1** (AAA).
- **Jakob Nielsen's 10 Usability Heuristics**:
  1. *Visibility of system status*: Live `/ws` + FPS + per-processor `CUDA`/`NPU`/`iGPU`/`Zig` latency & Merkle hash pills.
  2. *Match between system and real world*: Biophysical units (`kJ`, `ms`, `GFLOPS`, `a/M`, `O₂ %`) and anatomical names.
  3. *User control and freedom*: Reversible `N01` snapshot/rollback (`SQLite` + `IndexedDB`), `Reset Dials`, and `Space` pause.
  4. *Consistency and standards*: Design tokens in `src/styles/tokens.css` (zero `!important`, zero inline styles).
  5. *Error prevention*: Slider bounds, `sanitizeGodDials()`, and confirmation/backup guards on destructive actions.
  6. *Recognition rather than recall*: Searchable `Ctrl+K` Command Palette and inline scientific tooltips/badges.
  7. *Flexibility and efficiency*: URL deep-linking (`?seed=&flaws=&tier=&tab=&mode=`), `1`–`7` hotkeys, `WASD` camera, `8` camera presets.
  8. *Aesthetic and minimalist design*: Collapsible Cinema-4K HUD (`H` toggle) and organized 7-workspace progressive disclosure.
  9. *Help users recognize/recover from errors*: Non-fatal error boundary banner (`role="alert"`) and structured remediation messages.
  10. *Help and documentation*: Built-in `Docs`, `Specs`, `13-Chapter Bible`, `Glossary`, `WildBeyond Lab`, and `OpenAPI 3.1`.
