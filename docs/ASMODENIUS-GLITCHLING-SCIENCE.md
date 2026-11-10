# Asmodenius v42, Xylos v2, Thaler Creativity, Glitchling & 12-Benchmark Causal Matrix

## 1. Asmodenius v42 (Creature #1 — 14-Region CNS + Enteric Nervous System)

1. **Larkum Two-Compartment + Hasani Semi-Implicit `sLTC` (`zig/src/root.zig`)**:
   - Apical tuft input receives disynaptic SOM mean subtraction $a_i^{\text{SOM}} = a_i - 0.85 \bar{a}$ and gates slow NMDA reverberation $n_i(t)$.
   - Divisive PV shunting scales total drive $I_i = (b_i g_{\text{BAC}} + 0.35 n_i) / (1 + 0.60 \bar{r})$.
   - Membrane voltage $v_i$ integrates unconditionally stably via Hasani's fused semi-implicit rule with Acetylcholine/Norepinephrine time-constant modulation $\tau(I_i, \text{ACh}, \text{NE})$.
2. **Frazier Knowledge-Gradient Value-of-Information (`VOI`, solving `AINF-H`)**:
   $$\mathrm{KG}(\mu_0, \tilde{\sigma}) = \tilde{\sigma}\,\phi\!\left(-\frac{|\mu_0|}{\tilde{\sigma}}\right) - |\mu_0|\,\Phi\!\left(-\frac{|\mu_0|}{\tilde{\sigma}}\right)$$
   Guides epistemic cue sampling before high-stakes foraging (`Cohen's d > 5.0`).
3. **Endogenous `HOT-3` CalibHead Confidence & Non-Destructive `TMS` Arousal Assays**:
   - Multi-channel coherence + CalibHead calibration opts out of high-noise negative-EV wagers (`Cohen's d > 1.6`).
   - State-cloned `runTmsPokeTest(mode)` evaluates Lempel-Ziv spatiotemporal Perturbational Complexity (`PCI`) across `WAKE`, `NREM_SLOW_WAVE`, and `PROPOFOL_ANESTHESIA` without mutating the live organism (`WAKE PCI > NREM/PROPOFOL PCI`).

## 2. Xylos v2 (`Creature #002`) & Thaler Creativity Engine

- **Xylos v2 (`src/brains/xylos.ts`)**: Hyperbolic `{7,3}` Poincaré medusa computing all **14 Butlin computational indicators** (`RPT-1..2`, `GWT-1..4`, `HOT-1..4`, `AST-1`, `PP-1..2`, `AE-1`) and non-oracle corollary-discharge reality monitoring (`ROC-AUC > 0.90` separating endogenous imagination from exogenous sensory drive).
- **Thaler Creativity Engine (`src/brains/thaler-creativity.ts`)**: Evaluates all **9 quantitative novelty/value attractor markers** and verifies strict superiority against **4 falsification ablations** (`Zero Noise`, `Frozen Attractor`, `Random Soup`, `Unconstrained Drift`).

## 3. Glitchling Neuroplasticity & 12-Benchmark Causal Lesion Suite (`src/brains/causal-benchmarks.ts`)

Every cognitive/homeostatic organ in CQM2 (`v2.1.0`) is verified across 24 paired trials/arm (`intact` vs `targeted lesion`, requiring `Cohen's d >= 0.8`):
1. `B01` Frazier Knowledge-Gradient VOI foraging
2. `B02` HOT-3 CalibHead metacognitive wagering
3. `B03` POMC/GLP-1 vagal gut satiety
4. `B04` Briat-Gupta-Khammash Antithetic Integral glycemic homeostasis
5. `B05` Gated-DeltaNet fast-weight sensory unscrambling (`scramble`)
6. `B06` Frey-Morris Synaptic Tagging & Capture consolidation (`leaky`)
7. `B07` Marr-Albus cerebellar Purkinje motor inversion (`backwards`, cosine `> 0.9999`)
8. `B08` Insula somatic "Free Won't" pre-motor hazard veto (`N13`)
9. `B09` Hippocampus CA3 substrate anomaly quarantine (`N52`)
10. `B10` Xylos corollary-discharge reality monitoring (`HOT-4`)
11. `B11` Thaler noise-seeded attractor creativity vs frozen ablation
12. `B12` Cormidium-16 + Glossodrom `RS[15,11]` erasure/corruption healing
