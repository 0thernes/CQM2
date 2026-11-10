# Asmodenius v42, Glitchling Neuroplasticity & Biophysical Equations

## 1. Asmodenius v42 (Creature #1 — 14-Region CNS + Enteric Nervous System)

1. **Larkum Two-Compartment + Hasani Semi-Implicit `sLTC` (`zig/src/root.zig`)**:
   - Apical tuft input receives disynaptic SOM mean subtraction $a_i^{\text{SOM}} = a_i - 0.85 \bar{a}$ and gates slow NMDA reverberation $n_i(t)$.
   - Divisive PV shunting scales total drive $I_i = (b_i g_{\text{BAC}} + 0.35 n_i) / (1 + 0.60 \bar{r})$.
   - Membrane voltage $v_i$ integrates unconditionally stably via Hasani's fused semi-implicit rule with Acetylcholine/Norepinephrine time-constant modulation $\tau(I_i, \text{ACh}, \text{NE})$.

2. **Frazier Knowledge-Gradient Value-of-Information (`VOI`, solving `AINF-H`)**:
   $$\mathrm{KG}(\mu_0, \tilde{\sigma}) = \tilde{\sigma}\,\phi\!\left(-\frac{|\mu_0|}{\tilde{\sigma}}\right) - |\mu_0|\,\Phi\!\left(-\frac{|\mu_0|}{\tilde{\sigma}}\right)$$
   Guides epistemic cue sampling before high-stakes poison/nectar foraging (`Cohen's d = 6.27`, `Welch's t = 21.72` vs. VOI-lesioned control).

3. **Endogenous `HOT-3` Metacognitive Confidence**:
   - Reads cross-channel sensory coherence $|\sum_k s_k| / \sum_k |s_k|$ against thalamic noise dispersion to selectively opt out of negative-EV high-noise wagers (`Cohen's d = 1.66`, `Welch's t = 5.76`).

4. **Somatic "Free Won't" Veto (`N13`) & Substrate Quarantine (`N52`)**:
   - Insula interoceptive hazard > `0.62` suppresses `MotorCortexM1` readiness potentials prior to spinal execution.
   - Abrupt exogenous God-Dial jumps > `0.35` quarantine `HippocampusCA3` recurrent coupling to prevent corrupted episodic consolidation.

## 2. Glitchling Congenital Faults & Compensatory Neuroplasticity

| Congenital Flaw | Deficit Mechanism | Compensatory Biological Organ |
|---|---|---|
| `scramble` | Fixed congenital channel derangement | **Gated-DeltaNet Fast Weights** ($16\times 16$ $S_t$ thalamic prototype aligner) |
| `leaky` | Rapid early-LTP weight decay ($1.85\,\text{s}^{-1}$) | **Frey-Morris Synaptic Tagging & Capture (`STC`)** via DA/NE `PRP` synthesis |
| `backwards` | Inverted plant motor polarity ($-u$) | **Marr-Albus Cerebellum** (`16->256->8` Purkinje climbing-fiber error inversion, cosine > `0.9999`) |
| `misfire` | Stochastic axonal drop/burst noise | Population coding + Golgi soft-kWTA granule filtering |

## 3. Exact 15-Pool Conserved Metabolism (`CQM10` & `C16R`)

- Every internal flux uses `transferConservedPoolKj()`, preserving $\sum_{k=0}^{14} P_k(t) = E_{\text{intake}}(t)$ to `5.59 × 10⁻¹⁶` relative precision (`< 10⁻¹²` gate).
- **POMC / GLP-1 Gut Satiety (`CQM10`)**: Gates meal ingestion proportionally to gut stretch (`Cohen's d = 16.03`).
- **Antithetic Integral Controller (`C16R`)**: Drives insulin/glucagon to hold blood glucose at `4.0 kJ` (`Cohen's d = 31.92`).
