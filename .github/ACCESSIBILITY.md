# Accessibility Conformance & Controls (`WCAG 2.2 Level AA`)

**Cosmogonic Quantum Mechalogodrom 2 (`CQM2`)** is engineered so its 3D simulation viewport, brain-lab instruments, telemetry tables, and documentation surfaces remain operable, legible, and seizure-safe across keyboards, assistive technologies, and screen sizes (`320px` to `3840px` 4K).

## Key Accessibility Features

1. **Photosensitive Seizure Safety (`WCAG 2.3.1` — P1 Gate)**:
   - All shaders (Schwarzschild/Kerr photon rings, FitzHugh-Nagumo chromatophores, Glitchling misfire flashes, and non-Euclidean manifold transitions) enforce a hard luminance-modulation rate clamp (`<= 2.2 Hz`, strictly under the `3 flashes/sec` threshold).
   - Automatic **`prefers-reduced-motion: reduce`** detection dampens camera bobbing, orbital auto-spin, and high-frequency shader animation, with an explicit **Reduced Motion** toggle in the top HUD.
2. **100% Keyboard Operability (`WCAG 2.1.1` & `2.1.2`)**:
   - Every workspace tab, simulation transport button (`Space` Play/Suspend/Freeze, `S` Single-Step), camera preset (`1`–`7`), Glitchling flaw toggle, TMS Poke Test button, and `Ctrl+K` Command Palette is operable via standard `Tab`, `Shift+Tab`, `Arrow`, `Enter`, and `Escape` keys with zero focus traps.
   - Single-click camera preset and entity-selection buttons provide full alternatives to pointer-drag orbital rotation (`WCAG 2.5.7`).
3. **Contrast, Typography & Touch Targets (`WCAG 1.4.3`, `1.4.11`, `2.5.8`)**:
   - Text contrast ratios exceed **`4.5:1`** (`>= 7.2:1` primary telemetry on obsidian `#090d16` surfaces); interactive UI borders/controls exceed **`3:1`**.
   - Body typography defaults to `16px` `Inter` (`line-height: 1.5`, prose measure `<= 72ch`), with `JetBrains Mono` (`font-variant-numeric: tabular-nums`) preventing layout jitter in live counters.
   - Mobile/touch controls meet or exceed `44×44 CSS px` target sizes.
4. **Screen-Reader Live Telemetry Alternative (`WCAG 1.1.1` & `4.1.2`)**:
   - The WebGL2/WebGPU `<canvas>` exposes `role="img"` with a dynamically summarized `aria-label`, paired with semantic HTML `<section>`, `<table>`, and `aria-live="polite"` status regions so NVDA/VoiceOver users can inspect population counts, Asmodenius metabolic pools, quantum contextuality metrics, and causal experiment results without relying solely on pixels.

## Feedback

If you encounter any accessibility barrier in `CQM2`, please open an issue using the bug template or email `0_0@0thernes.art`.
