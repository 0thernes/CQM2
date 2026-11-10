# Accessibility Conformance & Verification (`WCAG 2.2 Level AA` — CQM2 v2.1.0)

**Cosmogonic Quantum Mechalogodrom 2 (`CQM2 v2.1.0`)** conforms to **WCAG 2.2 Level AA** across all 7 HTML surfaces (`index.html`, `docs.html`, `specs.html`, `bible.html`, `lab/quantum-wildbeyond.html`, `glossary.html`, `downloads.html`) from `320×568` mobile viewports up to `3840×2160` 4K UHD.

## 1. Conformance Summary Matrix

| Principle | WCAG 2.2 Criteria Covered | CQM2 v2.1.0 Implementation & Verification |
|---|---|---|
| **1. Perceivable** | `1.1.1`, `1.3.1`–`1.3.5`, `1.4.1`, `1.4.3`, `1.4.4`, `1.4.10`, `1.4.11`, `1.4.12`, `1.4.13` | `>= 15.4:1` primary text (`#eaf1fb` on `#050913`), `>= 7.2:1` secondary (`#a8bdd9`), zero horizontal overflow at `320px` (`200%` zoom), semantic landmarks (`banner`, `tablist`, `tabpanel`, `main`, `contentinfo`), `aria-live="polite"` + tabular readouts for `<canvas>`. |
| **2. Operable** | `2.1.1`, `2.1.2`, `2.1.4`, `2.2.2`, `2.3.1`, `2.4.1`–`2.4.7`, `2.4.11`, `2.5.1`–`2.5.3`, `2.5.7`, `2.5.8` | Hard **`<= 2.2 Hz`** shader & UI flash clamp (`WCAG 2.3.1`), automatic `prefers-reduced-motion: reduce` freeze, `.skip-link` bypass, full keyboard camera orbit (`WASD`/Arrows/`+-`/`0`) + single-click camera preset dropdown (`2.5.7`), `>= 44px` `--touch-min` targets (`2.5.8`), focus-preserving toggle buttons. |
| **3. Understandable** | `3.1.1`, `3.2.1`–`3.2.4`, `3.2.6`, `3.3.1`–`3.3.4` | `<html lang="en">`, consistent 7-page navigation and footer support link (`3.2.6`), explicit `<label for="...">` on every slider/select/input, non-fatal error boundary banner (`role="alert"`). |
| **4. Robust** | `4.1.2`, `4.1.3` | Valid ARIA `tablist`/`tab`/`tabpanel` roving `tabindex`, `<dialog>` Command Palette (`Ctrl+K`), polite status announcer (`#aria-live-status`). |

## 2. Screen-Reader Walkthrough (`NVDA` on Windows 11 / `VoiceOver` on macOS & iOS)

1. Press `Tab` on load to reveal **"Skip to main workstation"** or navigate landmarks (`Banner` -> `CQM2 Scientific Workspaces` tablist -> `Main`).
2. Use `Left Arrow` / `Right Arrow` across the 7 workspace tabs; `#aria-live-status` announces workspace transitions without stealing focus.
3. Press `Space` (outside text inputs) to pause/resume simulation ticks; live KPI cards and relational tables expose exact numerical values in DOM text (`tabular-nums`).

## 3. Feedback

Report any accessibility issue via GitHub Issues or `0_0@0thernes.art`.
