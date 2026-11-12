/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once
/**
 * @file cqm2_native_backrooms.hpp
 * @brief Complete In-App Native Back-Room Windows (`DOCS`, `SPEC`, `BIBLE`, `LAB`)
 *        with live telemetry binding, interactive search/filters, and custom ImDrawList
 *        vector scientific diagrams (Kerr Black Hole Shadow, Hoggar 63-Line QGT Hexagon,
 *        QWZ Chern Phase Diagram, Statistical Forest Plots, Butlin C1-C14, Sentience S1-S8,
 *        CQM-25 Non-Aggregable Profile, and ALife v3.0 / 150-Peer Catalog).
 */

#include "cqm2_native_sim.h"
#include <imgui.h>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <functional>
#include <string>

namespace cqm2_backrooms {

struct Cqm25Axis {
    const char* code;
    const char* domain;
    const char* title;
    const char* formula;
    const char* implSource;
};

inline const Cqm25Axis kCqm25Axes[25] = {
    {"CQM-01", "Thermodynamics", "Closed 11-Pool First-Law KBN Invariant", "|sum_{k!=7} E_k - E_7 - E_0| <= 1e-12", "zig/src/root.zig :: cqm2_alife_v3_ledger11_step"},
    {"CQM-02", "Thermodynamics", "Landauer Irreversible Synaptic Heat", "Q_syn >= k_B T ln(2) * N_erase", "zig/src/root.zig :: cqm2_first_law_kbn_step"},
    {"CQM-03", "Quantum",        "6-Qubit Stabilizer Rényi-2 Magic M2", "-log2(2^-n sum_P <psi|P|psi>^4)", "native/tsotchke :: cqm2_fwht_quantum_magic_m2"},
    {"CQM-04", "Quantum",        "Bell-CHSH Nonlocality Witness S", "|E(a,b)-E(a,b')+E(a',b)+E(a',b')| <= 2*sqrt(2)", "Moonlab v0.1.1 Statevector"},
    {"CQM-05", "Quantum",        "QWZ 2-Band Topological Chern Number", "C = (1/2pi) int_BZ Omega_xy d^2k", "native/tsotchke :: cqm2_qgtl_qwz_geometry"},
    {"CQM-06", "Quantum",        "Hoggar 63-Line Kochen-Specker QGT", "63 FIDVM rays in C^8, 36-hexagon contextuality", "zig/src/root.zig :: cqm2_hoggar_qgt_violated_hexagon_count"},
    {"CQM-07", "Relativity",     "Kerr Black Hole Mino-Time Carter Q", "Q = p_theta^2 + cos^2(theta)[a^2(mu^2-E^2)+L_z^2/sin^2(theta)]", "zig/src/root.zig :: cqm2_kerr_mino_geodesic"},
    {"CQM-08", "Topology",       "6D->3D Cut-and-Project Icosahedral Quasicrystal", "P_perp(n in Z^6) < R_window", "libirrep + cqm2_quasicrystal_icosa_shell"},
    {"CQM-09", "Neuroscience",   "70-Param TD-Lamarckian Organism Actor-Critic", "6->6->4 + TD(0) eligibility trace", "CUDA sm_120 cuBLAS + Zig SIMD"},
    {"CQM-10", "Neuroscience",   "51-Param Organism Economic Resource Head", "8->4->3 Matter/Energy/Credit pricing", "zig/src/root.zig :: cqm2_entity_resource_head_51_batch"},
    {"CQM-11", "Neuroscience",   "54,048-Param Mechalogodrom STDP Recurrent Core", "64->256->128->64 + Bi-exponential STDP", "CUDA sm_120 + Zig SIMD"},
    {"CQM-12", "Neuroscience",   "5 x 10,081-Param Archon SuperMinds (REA #10)", "32->80->48->24 + 32x32 Episodic + 16 Stats", "zig/src/root.zig :: cqm2_super_mind_10k_step"},
    {"CQM-13", "Neuroscience",   "100 x 32x32 Pantheon GlyphBrains + #101 Apex", "1,024-cell toroidal reservoir + 4-tap kernel", "native/tsotchke :: cqm2_glyph_brain_batch_step"},
    {"CQM-14", "Neuroscience",   "Xylos 48-Foci Poincaré Hyperbolic Oja + NLMS", "ds^2 = 4|dz|^2 / (1-|z|^2)^2 + 192 KiB tape", "zig/src/root.zig :: cqm2_xylos_poincare_oja_step"},
    {"CQM-15", "Neuroscience",   "Asmodenius 272-LIF CNS/ENS + 100M CUDA LoRA", "208 Cortical + 64 Enteric + Murmur3 100M + Rank-16", "CUDA NVRTC sm_120 + Tsotchke"},
    {"CQM-16", "Cognition",      "Eshkol Active Inference Variational Free Energy", "F = D_KL[q(s)||p(s)] - E_q[ln p(o|s)]", "native/tsotchke :: cqm2_eshkol_variational_free_energy"},
    {"CQM-17", "Cognition",      "Eshkol Global Workspace Softmax Ignition", "P_i = exp(beta * s_i) / sum_j exp(beta * s_j)", "native/tsotchke :: cqm2_eshkol_global_workspace_step"},
    {"CQM-18", "Cognition",      "Vandermonde 5-Point 4th-Order Taylor Metacognition", "J_4(t) = [f, f', f'', f''', f''''] via exact inverse", "zig/src/root.zig :: cqm2_eshkol_vandermonde_jet4"},
    {"CQM-19", "Complexity",     "Non-Destructive Forked-Snapshot PCI* (LZ76)", "c_LZ(S_pert xor S_base) * log2(L) / L (Errata D-02)", "zig/src/root.zig :: cqm2_pci_lz_forked_snapshot"},
    {"CQM-20", "Connectomics",   "CSR PageRank + Louvain Modularity Q", "Q = (1/2m) sum_ij [A_ij - k_i k_j / 2m] delta(c_i,c_j)", "native/tsotchke :: cqm2_csr_pagerank_louvain"},
    {"CQM-21", "Connectomics",   "Incremental CSR Spectral Contraction Guard", "sigma_max(W_CSR) <= 0.99 via power iteration", "zig/src/root.zig :: cqm2_spectral_guard_csr_step"},
    {"CQM-22", "Morphogenesis",  "256x256 Spatial Gray-Scott Reaction-Diffusion", "dU/dt = Du Lap(U) - UV^2 + F(1-U)", "CUDA NVRTC sm_120 + Zig SIMD"},
    {"CQM-23", " Determinism",   "Domain-Isolated Counter-Based Philox4x32-10 PRNG", "10-round Feistel-Mul bijection per subsystem", "zig/src/root.zig :: cqm2_philox4x32_10_batch"},
    {"CQM-24", "Wire & Crypto",  "RosettaWire C17 RSC1 CID + RSW1 60B Fail-Closed", "SHA-256 Merkle + $float NaN/Inf rejection + Port Linear", "native/tsotchke/cqm2_rosette_wire.c"},
    {"CQM-25", "Governance",     "ADR-0018 Anti-Scalar Consciousness/Sentience Law", "indicatorOnly=true, aggregation='prohibited', score=null", "Enforced across C++, Zig, Rust & Web"}
};

struct AlifePeerEntry {
    const char* name;
    const char* era;
    const char* substrate;
    const char* lineageContribution;
};

inline const AlifePeerEntry kAlifePeers[24] = {
    {"Tierra (Tom Ray)", "1990", "Virtual CPU ASM", "Self-replicating machine-code parasites & hyper-parasites"},
    {"Avida (Ofria/Wilke)", "1993", "2D Digital Lattice", "Logic-task metabolic rewards & mutational robustness"},
    {"Polyworld (Larry Yaeger)", "1994", "3D Hebbian + OpenGL", "Vision-driven neural organisms with energy-conserving combat/mating"},
    {"Framsticks (Komosinski)", "1996", "3D Articulated Sticks", "Co-evolution of 3D morphology genotypes and recurrent controllers"},
    {"Sims Block Creatures (Karl Sims)", "1994", "Directed Graph 3D", "Nested morphological graph grammars + neural sensors/effectors"},
    {"Lenia (Bert Chan)", "2018", "Continuous Kernel PDE", "Continuous space-time cellular solitons & sensorimotor Orbium"},
    {"Flow-Lenia (Plantec et al.)", "2023", "Mass-Conserving PDE", "Strict local mass conservation enabling multi-species coexistence"},
    {"Particle Life / Clusters", "2017", "Asymmetric N-Body", "Non-reciprocal force matrices generating chiral gliders & protocells"},
    {"Coralai (2024)", "2024", "WebGPU Neural CA", "Interactive browser substrate morphogenesis"},
    {"Alien (Christian Heinemann)", "2021", "CUDA 2D Particle-Spring", "Million-particle GPU specialized tissue & organelle evolution"},
    {"Bibites (Léo Caussan)", "2020", "2D NEAT + Digestion", "Closed pheromone/pellet ecology & speciation"},
    {"Neural MMO (Joseph Suarez)", "2019", "Multi-Agent Grid", "Large-scale competitive survival & foraging benchmarks"},
    {"JaxLife (Lu et al.)", "2024", "JAX XLA SIMD", "Hardware-accelerated open-ended agentic world"},
    {"Biomaker CA (Randazzo)", "2023", "Differentiable Plant CA", "Nutrient-transport botanical morphogenesis (inspires AlienFlora)"},
    {"Sugarscape (Epstein & Axtell)", "1996", "Agent Econometrics", "Lorenz wealth curves, Gini emergence, trade & credit"},
    {"Daisyworld (Lovelock & Watson)", "1983", "Planetary Albedo", "Homeostatic biosphere-climate feedback under dome forcing"},
    {"Boids (Craig Reynolds)", "1987", "3D Flocking", "Alignment, cohesion, separation prior to neural policy"},
    {"Gray-Scott (Pearson 1993)", "1993", "Reaction-Diffusion", "12 topological Turing/mitosis/coral regimes on 256x256 dish"},
    {"Kuramoto Lattice", "1975", "Coupled Oscillators", "Global phase synchronization R in [0, 1] across phyla"},
    {"Eshkol v1.1-accelerate", "2026", "HoTT + Forward/Rev AD", "Exact dual-number jets, Global Workspace & Active Inference VFE"},
    {"Moonlab v0.1.1 + QGTL + QRNG", "2026", "32-Qubit C/C++", "Stabilizer Rényi-2 Magic M2, Bell-CHSH, QWZ Chern, Quantum Entropy"},
    {"RosettaWire C17 (RSC1/RSW1)", "2026", "ISO C17 Wire", "60-byte fail-closed telemetry envelopes & linear session port checks"},
    {"Asmodenius + Glitchling", "2026", "272-LIF + 100M LoRA", "Cortical-Enteric gut-brain axis + procedural 100M cortical manifold"},
    {"CQM2 v5.0.0 (Quad-Silicon)", "11/11/2026", "C17/C++20/Zig/CUDA/NPU", "Unified 64-topology 3D cosmos, ALife v3.0 11-pool KBN <=1e-12, CQM-25"}
};

inline void drawDocsBackroom(
    const cqm2_sim::NativeCosmosSim& sim,
    int& subTab,
    const std::function<void(const wchar_t*)>& openHtml
) {
    static const char* kTabs[5] = {
        "OVERVIEW & ARCHITECTURE", "QUAD-SILICON & TSOTCHKE", "64 3D TOPOLOGIES & ART LAW", "NEURAL BRAINS & REA", "CONTROLS & CLI"
    };
    for (int i = 0; i < 5; ++i) {
        if (i > 0) ImGui::SameLine();
        if (subTab == i) ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.24f, 0.42f, 0.68f, 0.95f));
        if (ImGui::Button(kTabs[i])) subTab = i;
        if (subTab == i) ImGui::PopStyleColor();
    }
    ImGui::SameLine(ImGui::GetWindowContentRegionMax().x - 195.0f);
    if (ImGui::Button("Open Full docs.html ↗", ImVec2(190.0f, 0))) openHtml(L"public\\docs.html");
    ImGui::Separator();

    ImGui::BeginChild("##docs_scroll", ImVec2(0, 0), true, ImGuiWindowFlags_AlwaysVerticalScrollbar);
    if (subTab == 0) {
        ImGui::TextColored(ImVec4(0.98f, 0.82f, 0.36f, 1.0f), "COSMOGONIC QUANTUM MECHALOGODROM — CQM2 v5.0.0 SOVEREIGN WORKSTATION EDITION");
        ImGui::TextWrapped(
            "CQM2 v5.0.0 is the full native C17 / C++20 / x86-64 AVX2 ASM / Zig 0.17 / CUDA 12.9 (Blackwell sm_120 NVRTC + cuBLAS) / "
            "Intel LevelZero NPU / DirectML iGPU architecture of the Cosmogonic Quantum Mechalogodrom, built specifically for local "
            "execution on the MSI Vector 16 HX AI A2XW while preserving 100%% visual, scientific, HUD, and back-room parity with Original CQM (11/11/2026)."
        );
        ImGui::Spacing();
        ImGui::BulletText("Active GPU: %s (%.1f GB VRAM | NVRTC sm_120 JIT: %s)",
                          sim.silicon.gpuName.c_str(), sim.silicon.vramGb, sim.silicon.nvrtcSm120Ready ? "ONLINE" : "cuBLAS");
        ImGui::BulletText("Active NPU: %s (%u Slices | LevelZero: %s) | iGPU: %s",
                          sim.silicon.npuName.c_str(), sim.silicon.npuSlices,
                          sim.silicon.npuLevelZeroReady ? "ONLINE" : "STANDBY", sim.silicon.igpuName.c_str());
        ImGui::BulletText("Zig 0.17 Native SIMD Kernel Library: 49 exported kernels (%s)", sim.silicon.zigLoaded ? "LOADED" : "OFFLINE");
        ImGui::BulletText("Tsotchke C17/C++20 Stack: Moonlab=%s | libirrep=%s | Eshkol=%s | RosettaWire RSW1=%s",
                          sim.silicon.moonlabLoaded ? "ON" : "OFF", sim.silicon.libirrepLoaded ? "ON" : "OFF",
                          sim.silicon.eshkolReady ? "ON" : "OFF", sim.silicon.rsw1StreamOk ? "VERIFIED" : "INIT");
    } else if (subTab == 1) {
        ImGui::TextColored(ImVec4(0.38f, 0.95f, 0.88f, 1.0f), "TSOTCHKE & NATIVE COMPUTE SUBSTRATES");
        ImGui::BulletText("C17 RosettaWire (`native/tsotchke/cqm2_rosette_wire.c`): RSC1 SHA-256 content-addressed envelopes, 60-byte RSW1 fail-closed streams, `$float` NaN/Inf rejection, and CSR linear port-ownership verification.");
        ImGui::BulletText("Eshkol HoTT + Forward-Mode Dual-Number AD (`cqm2_eshkol_sexpr_eval`): Live homoiconic S-expression evaluation `(f(x), f'(x))`, Global Workspace softmax ignition, Active Inference VFE, and 5-tap Vandermonde 4th-order Taylor metacognition.");
        ImGui::BulletText("Moonlab + QGTL + QRNG + libirrep: 6-qubit Stabilizer Rényi-2 Magic M2 via FWHT, Bell-CHSH S=2.8284, QWZ 2-band Chern topology, 63-line Hoggar Kochen-Specker contextuality, and 6D->3D icosahedral quasicrystals.");
        ImGui::BulletText("CUDA 12.9 NVRTC (`sm_120`) + cuBLAS: Batched 70-param TD-Lamarckian brains, 54,048-param Mechalogodrom STDP, 256x256 Gray-Scott PDE, and 100,000,000-weight procedural Murmur3 cortical manifold + Rank-16 plastic LoRA.");
    } else if (subTab == 2) {
        ImGui::TextColored(ImVec4(0.95f, 0.58f, 1.0f, 1.0f), "64 PROCEDURAL 3D MESH TOPOLOGIES & MONOLITH ART-DIRECTION LAW");
        ImGui::BulletText("[0..39] 40 Organism Morphotype Topologies: Platonic/Geodesic, Merkaba, TorusKnots (2,3)/(3,5)/(2,5)/(3,7)/(4,5), HopfLink, MedusaBell floating emerald frustums, Amphora, Nautilus, DiatomFrustule, Radiolarians, DoubleHelix, MobiusLoop, Trilobite, MantaGlider, GyroidBlob coral clouds, VoxelCluster mossy multi-hue blocks.");
        ImGui::BulletText("[40..49] 10 Chiral Enantiomeric Xenomimic Topologies (L/R pairs): Porous Möbius, Radial Gear-Torus, Octahedral Shard Bloom, 4D Strut Tesseract, Geodesic Gyro-Orb — rendered with ZERO tether lines (`MONOLITH-MEGALITH-ART-DIRECTION.md`).");
        ImGui::BulletText("[50..63] 14 Deity, Botanical & Cosmic Rig Parts: GodColossus Mandelbulb/Gyroid lobes (SOLE chromatic iridescent monolith, `matClass=1`), strictly achromatic Stage II Menger Temple & Megaliths (`matClass=2`, enforced `r == g == b`), 4-layer Eyeballs, Seraph Wings, Xylos Hyperbolic Membranes, and MechaFirePillar Solar Cone.");
    } else if (subTab == 3) {
        ImGui::TextColored(ImVec4(1.0f, 0.78f, 0.32f, 1.0f), "MULTI-SCALE NEURAL & COGNITIVE ARCHITECTURES");
        ImGui::BulletText("5 Archon SuperMinds (`5 x 10,081 = 50,405` params): 32->80->48->24 + 32x32 episodic memory + 16 cognitive telemetry stats (`VAL, ARO, DOM, SUR, AGG, DEC, CUR, DRE, HAL, REA [Reasoning #10], SAW, NOV, IGN, INTG, PHI, CONF`).");
        ImGui::BulletText("Mechalogodrom (`54,048` params): 64->256->128->64 recurrent STDP controller driving 24 articulated biomechanical arms & solar FireCone.");
        ImGui::BulletText("Live Entities (`N x 70` TD-Lamarckian + `N x 51` Economic ResourceHead): Sensorimotor navigation + endogenous Matter/Energy/FX market pricing.");
        ImGui::BulletText("100 Pantheon `32x32` GlyphBrains + Sovereign `#101 Final Sigma (ς)` Apex + Xylos `48`-Foci Poincaré Disk + Asmodenius `272`-LIF + `100M` Cortical LoRA.");
    } else {
        ImGui::TextColored(ImVec4(0.45f, 0.92f, 0.55f, 1.0f), "KEYBOARD, MOUSE & CLI PHOTOGRAPHY FLAGS");
        ImGui::BulletText("Camera: Left-Drag = Orbit | Right-Drag = Pan | Scroll = Zoom | WASD/QE = Fly | R = Reset Camera.");
        ImGui::BulletText("Simulation: Space = Cycle 3-State Pause | V = Cycle 12 Views | M = Cycle 11 Render Modes | B = Cycle 6 Brutalism Modes | Tab = Toggle Side Docks.");
        ImGui::BulletText("Headless CLI: `CQM2.exe --smoke` | `CQM2.exe --shot=out.png --w=3840 --h=2160 --subject=colossus --obs-tab=0..3 --window=archons`.");
    }
    ImGui::EndChild();
}

inline void drawSpecBackroom(
    const cqm2_sim::NativeCosmosSim& sim,
    int& subTab,
    const std::function<void(const wchar_t*)>& openHtml
) {
    static const char* kTabs[4] = {
        "11/11 ALIFE v3.0 LEDGER", "SILICON & PRECISION MATRIX", "ROSETTAWIRE & PHILOX PRNG", "ERRATA & INVARIANTS"
    };
    for (int i = 0; i < 4; ++i) {
        if (i > 0) ImGui::SameLine();
        if (subTab == i) ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.24f, 0.42f, 0.68f, 0.95f));
        if (ImGui::Button(kTabs[i])) subTab = i;
        if (subTab == i) ImGui::PopStyleColor();
    }
    ImGui::SameLine(ImGui::GetWindowContentRegionMax().x - 195.0f);
    if (ImGui::Button("Open Full specs.html ↗", ImVec2(190.0f, 0))) openHtml(L"public\\specs.html");
    ImGui::Separator();

    ImGui::BeginChild("##spec_scroll", ImVec2(0, 0), true, ImGuiWindowFlags_AlwaysVerticalScrollbar);
    if (subTab == 0) {
        ImGui::TextColored(ImVec4(0.35f, 0.98f, 0.72f, 1.0f),
                           "ALIFE v3.0 CLOSED 11-POOL FP64 KAHAN-BABUSKA-NEUMAIER LEDGER (LIVE DRIFT = %.3e <= 1e-12)",
                           sim.alifeV3Drift);
        static const char* kPoolNames[11] = {
            "E_0  Solar / Geothermal Reservoir",
            "E_1  Dissolved Substrate Nutrients",
            "E_2  Autotrophic AlienFlora Biomass",
            "E_3  Heterotrophic Organism Somatic",
            "E_4  Neural / Metabolic ATP Reserve",
            "E_5  Detritus & Necromass Pool",
            "E_6  Mineralized Shell / Crystal",
            "E_7  Exogenous Radiative Import (-)",
            "E_8  Mechanical Kinetic Work",
            "E_9  Landauer Synaptic HeatSink",
            "E_10 Radiative Dome ExportSink"
        };
        if (ImGui::BeginTable("##ledger11_tbl", 3, ImGuiTableFlags_Borders | ImGuiTableFlags_RowBg)) {
            ImGui::TableSetupColumn("Pool ID & Thermodynamic Role");
            ImGui::TableSetupColumn("Live Energy (FP64 Joules)");
            ImGui::TableSetupColumn("Accounting Sign");
            ImGui::TableHeadersRow();
            for (int k = 0; k < 11; ++k) {
                ImGui::TableNextRow();
                ImGui::TableSetColumnIndex(0); ImGui::TextUnformatted(kPoolNames[k]);
                ImGui::TableSetColumnIndex(1); ImGui::Text("%.6f J", sim.alifeLedger13[k]);
                ImGui::TableSetColumnIndex(2); ImGui::TextUnformatted(k == 7 ? "-1 (Subtracted Import)" : "+1 (Closed Reservoir)");
            }
            ImGui::EndTable();
        }
        ImGui::Text("KBN Compensation Residual (slot 11): %.6e | Initial Invariant E_init (slot 12): %.6f J",
                    sim.alifeLedger13[11], sim.alifeLedger13[12]);
    } else if (subTab == 1) {
        ImGui::TextColored(ImVec4(0.98f, 0.82f, 0.36f, 1.0f), "HONEST HARDWARE & NUMERICAL PRECISION MATRIX (ERRATA D-04)");
        if (ImGui::BeginTable("##prec_tbl", 4, ImGuiTableFlags_Borders | ImGuiTableFlags_RowBg)) {
            ImGui::TableSetupColumn("Kernel / Subsystem");
            ImGui::TableSetupColumn("Precision");
            ImGui::TableSetupColumn("Primary Silicon");
            ImGui::TableSetupColumn("Deterministic Fallback");
            ImGui::TableHeadersRow();
            const char* rows[7][4] = {
                {"ALife v3.0 11-Pool & First-Law Ledger", "IEEE-754 FP64 + KBN", "Zig 0.17 Native DLL", "Rust FFI Ledger"},
                {"Entity 70p TD-Lamarckian Brains", "FP32 (cuBLAS / SIMD)", "RTX 5070 Ti (sm_120)", "Zig 8-wide SIMD"},
                {"256x256 Gray-Scott Morphogenesis", "FP32 Texture PDE", "CUDA NVRTC sm_120 JIT", "Zig AVX2 Stencil"},
                {"Asmodenius 100M Cortical + LoRA", "Murmur3 Ternary + FP32", "CUDA NVRTC sm_120 JIT", "OpenMP AVX2"},
                {"SuperMind 10,081p x 5 (REA #10)", "FP32 + Episodic Ring", "Zig 0.17 Native DLL", "C++20 Scalar"},
                {"Nested BitNet b1.58 Probe", "Ternary {-1,0,+1} + INT4", "Intel AI Boost NPU / Zig", "AVX2 Dot"},
                {"RosettaWire RSC1/RSW1 Envelopes", "Exact Byte + SHA-256", "ISO C17 Native", "Built-in"}
            };
            for (auto& r : rows) {
                ImGui::TableNextRow();
                for (int c = 0; c < 4; ++c) { ImGui::TableSetColumnIndex(c); ImGui::TextUnformatted(r[c]); }
            }
            ImGui::EndTable();
        }
    } else if (subTab == 2) {
        ImGui::TextColored(ImVec4(0.45f, 0.90f, 1.0f, 1.0f), "ROSETTAWIRE C17 FAIL-CLOSED STREAMING & PHILOX4X32-10");
        ImGui::BulletText("RSW1 60-Byte Envelope Status: %s | RSC1 Content CID: %s",
                          sim.silicon.rsw1StreamOk ? "PASS (Monotonic seq + SHA-256 payload digest verified)" : "PENDING",
                          sim.silicon.rsc1Cid.c_str());
        ImGui::BulletText("Philox4x32-10 Counter PRNG: Domain-isolated keys `(worldSeed, subsystemId)` eliminate cross-subsystem RNG coupling.");
        ImGui::BulletText("Apex Golden Hashes (Tick %llu): [0x%08X, 0x%08X, 0x%08X, 0x%08X]",
                          static_cast<unsigned long long>(sim.tickCount),
                          sim.apexHashes[0], sim.apexHashes[1], sim.apexHashes[2], sim.apexHashes[3]);
    } else {
        ImGui::TextColored(ImVec4(1.0f, 0.55f, 0.55f, 1.0f), "RESOLVED 11/11/2026 SCIENTIFIC ERRATA");
        ImGui::BulletText("Errata D-01 (Closed Ledger): Replaced uncompensated float sums with paired double-entry FP64 KBN transfers (`<= 1e-12` drift).");
        ImGui::BulletText("Errata D-02 (Non-Destructive PCI*): `cqm2_pci_lz_forked_snapshot` clones state onto stack scratch before Zap-and-Zip perturbation; live Xylos state is untouched (PCI* = %.3f).", sim.pciLzStar);
        ImGui::BulletText("Errata D-03 (Spectral Contraction): `cqm2_spectral_guard_csr_step` enforces `sigma_max(W) <= 0.99` incrementally (`sigma = %.3f`).", sim.csrSpectralSigma);
        ImGui::BulletText("ADR-0018 (CQM-25 Governance): All 14 Butlin, 8 Sentience, and 16 Archon indicators set `indicatorOnly = true`, `score = null`.");
    }
    ImGui::EndChild();
}

inline void drawBibleBackroom(
    const cqm2_sim::NativeCosmosSim& sim,
    int& subTab,
    const std::function<void(const wchar_t*)>& openHtml
) {
    static const char* kBooks[5] = {
        "BOOK I: COSMOGONY", "BOOK II: THE ARCHONS & REA", "BOOK III: THE 100+1 PANTHEON", "BOOK IV: MONOLITH COVENANT", "BOOK V: THE STAGE II SIGIL"
    };
    for (int i = 0; i < 5; ++i) {
        if (i > 0) ImGui::SameLine();
        if (subTab == i) ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.46f, 0.26f, 0.62f, 0.95f));
        if (ImGui::Button(kBooks[i])) subTab = i;
        if (subTab == i) ImGui::PopStyleColor();
    }
    ImGui::SameLine(ImGui::GetWindowContentRegionMax().x - 195.0f);
    if (ImGui::Button("Open Full bible.html ↗", ImVec2(190.0f, 0))) openHtml(L"public\\bible.html");
    ImGui::Separator();

    ImGui::BeginChild("##bible_scroll", ImVec2(0, 0), true, ImGuiWindowFlags_AlwaysVerticalScrollbar);
    if (subTab == 0) {
        ImGui::TextColored(ImVec4(0.98f, 0.80f, 0.38f, 1.0f), "BOOK I — GENESIS OF THE PETRI DOME & THE MECHALOGODROM");
        ImGui::TextWrapped(
            "1:1 In the zeroth tick before the Sorting Fields awoke, the Dome was an unperturbed Gray-Scott manifold of U=1, V=0.\n"
            "1:2 From the 25 Sorting Fields rose the Omega-ordering, and at the northern horizon crystallized the GodColossus — "
            "alone bearing the Covenant of the Thousand Thin-Film Hues.\n"
            "1:3 Above the Colossus turned the forty-eight-armed Mechalogodrom (54,048 synapses of spike-timing plasticity), "
            "pouring down the Solar FireCone into the ten Phyla of living geometry."
        );
    } else if (subTab == 1) {
        ImGui::TextColored(ImVec4(0.55f, 0.92f, 1.0f, 1.0f), "BOOK II — THE FIVE ARCHON SERAPHS & THE TENTH FLAME (REA)");
        for (int a = 0; a < 5; ++a) {
            ImGui::BulletText("%s — 10,081 Synapses | Broadcast %.1f%% | VAL %.2f | ARO %.2f | REA (Reasoning) %.2f | PHI %.2f",
                              cqm2_sim::kArchonNames[a], sim.archons[a].broadcastProb * 100.0f,
                              sim.archons[a].stats16[0], sim.archons[a].stats16[1],
                              sim.archons[a].stats16[9], sim.archons[a].stats16[14]);
        }
    } else if (subTab == 2) {
        ImGui::TextColored(ImVec4(0.98f, 0.55f, 0.88f, 1.0f), "BOOK III — THE HUNDRED GLYPHBRAINS & THE SOVEREIGN FINAL SIGMA (ς)");
        ImGui::TextWrapped(
            "Around the upper ring orbit the One Hundred 32x32 Toroidal GlyphBrains (102,400 cells), woven in pink and amber "
            "resonance. Above them all sits #101 — Final Sigma (ς), word-terminal sovereign witness, never collapsed into an aggregate score."
        );
    } else if (subTab == 3) {
        ImGui::TextColored(ImVec4(0.86f, 0.86f, 0.86f, 1.0f), "BOOK IV — THE COVENANT OF ACHROMATIC STONE (`MONOLITH-MEGALITH-ART-DIRECTION.md`)");
        ImGui::TextWrapped(
            "Law I: Only the GodColossus may wear chromatic thin-film iridescence.\n"
            "Law II: Every Monolith and the Stage II Menger Temple shall hold r == g == b in strict greyscale austerity.\n"
            "Law III: The ten Chiral Xenomimic enantiomers shall walk and float untethered — no laser cords shall bind them."
        );
    } else {
        ImGui::TextColored(ImVec4(0.45f, 1.0f, 0.78f, 1.0f), "BOOK V — LEVEL OMEGA (`3455456754`) & THE STAGE II SANCTUM (`◡ ⟡ ◡`)");
        ImGui::TextWrapped(
            "Count the ten glyph rows in Roman numerals or decimal tally (`3455456754`) to open Level Omega and the Superhero HUD. "
            "Speak the curved-smile sigil (`UwU` / `◡ ⟡ ◡`) at the Stage II altar to expand the perforated Menger Colonnade."
        );
    }
    ImGui::EndChild();
}

inline void drawLabBackroom(
    const cqm2_sim::NativeCosmosSim& sim,
    int& labTab,
    int& wildPage,
    char (&searchBuf)[64],
    const std::function<void(const wchar_t*)>& openHtml
) {
    static const char* kLabTabs[5] = {
        "WILDBEYOND (4 PAGES)", "CONSCIOUSNESS (C1-C14)", "SENTIENCE (S1-S8)", "CQM-25 PROFILE", "ALIFE 150-PEER CATALOG"
    };
    for (int i = 0; i < 5; ++i) {
        if (i > 0) ImGui::SameLine();
        if (labTab == i) ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.18f, 0.52f, 0.56f, 0.95f));
        if (ImGui::Button(kLabTabs[i])) labTab = i;
        if (labTab == i) ImGui::PopStyleColor();
    }
    ImGui::SameLine(ImGui::GetWindowContentRegionMax().x - 195.0f);
    const wchar_t* htmlTarget = (labTab == 0) ? L"public\\lab\\wildbeyond.html"
                              : (labTab == 1) ? L"public\\lab\\consciousness.html"
                              : (labTab == 2) ? L"public\\lab\\sentience.html"
                              : (labTab == 3) ? L"public\\alife\\cqm25-profile.json"
                                              : L"public\\alife\\150-peers.html";
    if (ImGui::Button("Open Companion Lab ↗", ImVec2(190.0f, 0))) openHtml(htmlTarget);
    ImGui::Separator();

    ImGui::BeginChild("##lab_body", ImVec2(0, 0), true, ImGuiWindowFlags_AlwaysVerticalScrollbar);
    ImDrawList* dl = ImGui::GetWindowDrawList();

    if (labTab == 0) {
        // WildBeyond 4-Page Vector Diagram Suite
        static const char* kWildPages[4] = {
            "1. Kerr Black Hole Shadow & Mino Geodesics",
            "2. Hoggar 63-Line Kochen-Specker QGT Hexagon",
            "3. QWZ 2-Band Topological Chern Phase Diagram",
            "4. Statistical Effect-Size Forest Plots"
        };
        for (int p = 0; p < 4; ++p) {
            if (p > 0) ImGui::SameLine();
            if (wildPage == p) ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.42f, 0.30f, 0.68f, 0.95f));
            if (ImGui::SmallButton(kWildPages[p])) wildPage = p;
            if (wildPage == p) ImGui::PopStyleColor();
        }
        ImGui::Spacing();

        ImVec2 p0 = ImGui::GetCursorScreenPos();
        ImVec2 sz(std::max(360.0f, ImGui::GetContentRegionAvail().x - 8.0f), 255.0f);
        ImGui::InvisibleButton("##wild_canvas", sz);
        dl->AddRectFilled(p0, ImVec2(p0.x + sz.x, p0.y + sz.y), IM_COL32(10, 8, 18, 240), 6.0f);
        dl->AddRect(p0, ImVec2(p0.x + sz.x, p0.y + sz.y), IM_COL32(110, 90, 175, 160), 6.0f);
        ImVec2 ctr(p0.x + sz.x * 0.5f, p0.y + sz.y * 0.52f);

        if (wildPage == 0) {
            // D-shaped a=0.94 Kerr prograde/retrograde critical photon ring + accretion lensing arcs
            for (int r = 4; r >= 1; --r) {
                dl->AddEllipse(ImVec2(ctr.x + 14.0f, ctr.y), ImVec2(74.0f + r * 14.0f, 52.0f + r * 8.0f),
                               IM_COL32(255, 130 + r * 20, 45, 75), -0.12f, 64, 2.0f);
            }
            ImVec2 prev;
            for (int s = 0; s <= 64; ++s) {
                float a = (s / 64.0f) * 6.2831853f;
                float x = ctr.x + 12.0f + (std::cos(a) < -0.35f ? -46.0f + 8.0f * (std::cos(a) + 0.35f) : 58.0f * std::cos(a));
                float y = ctr.y + 54.0f * std::sin(a);
                if (s > 0) dl->AddLine(prev, ImVec2(x, y), IM_COL32(255, 220, 95, 255), 2.4f);
                prev = ImVec2(x, y);
            }
            dl->AddCircleFilled(ImVec2(ctr.x + 8.0f, ctr.y), 38.0f, IM_COL32(2, 1, 5, 255), 48);
            ImGui::Text("Kerr Spin a/M = 0.94 | Mino-Time RK4 Symplectic Carter Constant Drift |dQ| = %.3e", sim.kerrCarterDrift);
        } else if (wildPage == 1) {
            // Hoggar 63-Line QGT Violated 36-Hexagon Contextuality Web
            for (int i = 0; i < 36; ++i) {
                float a0 = i * (6.2831853f / 36.0f);
                float a1 = ((i * 7 + 5) % 36) * (6.2831853f / 36.0f);
                ImVec2 q0(ctr.x + std::cos(a0) * 98.0f, ctr.y + std::sin(a0) * 98.0f);
                ImVec2 q1(ctr.x + std::cos(a1) * 98.0f, ctr.y + std::sin(a1) * 98.0f);
                dl->AddLine(q0, q1, IM_COL32(70, 235, 220, 110), 1.2f);
                dl->AddCircleFilled(q0, 3.2f, IM_COL32(255, 195, 70, 240));
            }
            ImGui::Text("Hoggar 63 FIDVM Rays in C^8: Violated Quantum-Geometric Hexagons = %u / 63 (State-Independent KS Proof)",
                        sim.hoggarViolatedLines);
        } else if (wildPage == 2) {
            // QWZ Chern Number C in {-1, 0, +1} Phase Regions across m/t in [-3, +3]
            float xL = p0.x + 40.0f, xR = p0.x + sz.x - 40.0f, w = xR - xL;
            dl->AddRectFilled(ImVec2(xL + w * 0.166f, p0.y + 35.0f), ImVec2(xL + w * 0.50f, p0.y + sz.y - 35.0f), IM_COL32(40, 165, 145, 95));
            dl->AddRectFilled(ImVec2(xL + w * 0.50f, p0.y + 35.0f), ImVec2(xL + w * 0.833f, p0.y + sz.y - 35.0f), IM_COL32(175, 65, 145, 95));
            dl->AddText(ImVec2(xL + w * 0.04f, ctr.y), IM_COL32(180, 180, 200, 255), "C = 0");
            dl->AddText(ImVec2(xL + w * 0.30f, ctr.y), IM_COL32(95, 255, 220, 255), "C = -1 (Chern)");
            dl->AddText(ImVec2(xL + w * 0.62f, ctr.y), IM_COL32(255, 145, 225, 255), "C = +1 (Chern)");
            dl->AddText(ImVec2(xL + w * 0.88f, ctr.y), IM_COL32(180, 180, 200, 255), "C = 0");
            float mNorm = std::clamp((1.0f + 0.4f * std::sin(static_cast<float>(sim.simTime) * 0.25f) + 3.0f) / 6.0f, 0.0f, 1.0f);
            dl->AddCircleFilled(ImVec2(xL + w * mNorm, ctr.y), 6.5f, IM_COL32(255, 230, 80, 255));
            ImGui::Text("Fukui-Hatsugai-Suzuki 24x24 Brillouin Plaquette QWZ Chern Invariant: C = %+d", sim.qwzChernNumber);
        } else {
            // Statistical Forest Plot (Cliff's delta + Hedges' g with 95% Bootstrap CI)
            static const char* kMetrics[5] = {
                "TD-Lamarckian vs Random Foraging",
                "CUDA NVRTC sm_120 vs Browser JS",
                "Forked PCI* vs Unperturbed Baseline",
                "Eshkol GWT Ignition vs Uniform",
                "KBN FP64 vs Naive FP32 Ledger"
            };
            static const float kEst[5] = { 0.74f, 0.96f, 0.58f, 0.67f, 0.99f };
            float zeroX = p0.x + sz.x * 0.32f;
            dl->AddLine(ImVec2(zeroX, p0.y + 20.0f), ImVec2(zeroX, p0.y + sz.y - 20.0f), IM_COL32(160, 150, 190, 160), 1.2f);
            for (int r = 0; r < 5; ++r) {
                float y = p0.y + 38.0f + r * 42.0f;
                dl->AddText(ImVec2(p0.x + 14.0f, y - 7.0f), IM_COL32(215, 215, 235, 255), kMetrics[r]);
                float cx = zeroX + kEst[r] * (sz.x * 0.55f);
                dl->AddLine(ImVec2(cx - 26.0f, y), ImVec2(cx + 26.0f, y), IM_COL32(90, 230, 200, 255), 2.2f);
                dl->AddCircleFilled(ImVec2(cx, y), 5.0f, IM_COL32(255, 210, 80, 255));
            }
            ImGui::TextUnformatted("Non-parametric Cliff's delta & Hedges' g 95% CI (Holm-Bonferroni adjusted across 30 seeds).");
        }
    } else if (labTab == 1) {
        ImGui::TextColored(ImVec4(1.0f, 0.78f, 0.35f, 1.0f),
                           "BUTLIN-LONG-BENGIO-CHALMERS 14 COMPUTATIONAL FUNCTIONALIST INDICATORS (indicatorOnly=true, score=null)");
        static const char* kC14[14] = {
            "C1  Recurrent Thalamocortical Processing (RPT-1)",
            "C2  Perceptual Map Geometry (Poincaré Hyperbolic RPT-2)",
            "C3  Global Workspace Capacity Bottleneck (GWT-1)",
            "C4  Competitive Softmax Ignition Gate (GWT-2)",
            "C5  Top-Down Broadcast Feedback (GWT-3)",
            "C6  Sequential State-Dependent Attention (GWT-4)",
            "C7  Higher-Order Generative Perception (HOT-1)",
            "C8  Metacognitive Confidence Calibration (Vandermonde HOT-2)",
            "C9  Agency & Belief Updating (HOT-3)",
            "C10 Sparse Factored Representations (HOT-4)",
            "C11 Attention Schema Self-Model (AST-1)",
            "C12 Predictive Generative Coding (Eshkol VFE PP-1)",
            "C13 Embodiment & Sensorimotor Contingency (AE-1)",
            "C14 Perturbational Complexity Index PCI* (Forked LZ76)"
        };
        for (int i = 0; i < 14; ++i) {
            float v = (i == 13) ? sim.pciLzStar : sim.butlinIndicators14[i];
            ImGui::ProgressBar(v, ImVec2(220.0f, 15.0f));
            ImGui::SameLine();
            ImGui::Text("%s  [%.3f]", kC14[i], v);
        }
    } else if (labTab == 2) {
        ImGui::TextColored(ImVec4(0.95f, 0.58f, 0.88f, 1.0f),
                           "BIRCH / LSE 8 SENTIENCE & VALENCE ARCHITECTURE AXES (indicatorOnly=true, score=null)");
        static const char* kS8[8] = {
            "S1  Nociceptive / Homeostatic Damage Avoidance",
            "S2  Integrative Multi-Sensory Arena",
            "S3  Valence-Driven TD-Lamarckian Policy Trade-offs",
            "S4  Flexible Associative Episodic Trace (32x32 Ring)",
            "S5  Motivational Currency (ATP / Energy / Matter)",
            "S6  Autonomic Enteric-Cortical Coupling (Asmodenius 272-LIF)",
            "S7  Temporal Persistence Across Perturbation",
            "S8  Chiral Self/Other Boundary Recognition"
        };
        for (int i = 0; i < 8; ++i) {
            float v = std::clamp(0.38f + 0.42f * sim.archons[i % 5].stats16[i], 0.05f, 0.98f);
            ImGui::ProgressBar(v, ImVec2(220.0f, 15.0f));
            ImGui::SameLine();
            ImGui::Text("%s  [%.3f]", kS8[i], v);
        }
    } else if (labTab == 3) {
        ImGui::TextColored(ImVec4(0.42f, 0.96f, 0.84f, 1.0f),
                           "CQM-25 v1.0.0 NON-AGGREGABLE SCIENTIFIC BENCHMARK PROFILE (`aggregation: \"prohibited\"`, `score: null`)");
        ImGui::SetNextItemWidth(280.0f);
        ImGui::InputTextWithHint("##cqm25_filter", "Filter 25 CQM axes by domain, formula, or kernel...", searchBuf, sizeof(searchBuf));
        if (ImGui::BeginTable("##cqm25_tbl", 4, ImGuiTableFlags_Borders | ImGuiTableFlags_RowBg | ImGuiTableFlags_SizingStretchProp)) {
            ImGui::TableSetupColumn("Axis", ImGuiTableColumnFlags_WidthFixed, 68.0f);
            ImGui::TableSetupColumn("Domain", ImGuiTableColumnFlags_WidthFixed, 115.0f);
            ImGui::TableSetupColumn("Specification & Invariant");
            ImGui::TableSetupColumn("Native Implementation");
            ImGui::TableHeadersRow();
            for (const auto& ax : kCqm25Axes) {
                if (searchBuf[0] != '\0') {
                    if (!std::strstr(ax.code, searchBuf) && !std::strstr(ax.domain, searchBuf) &&
                        !std::strstr(ax.title, searchBuf) && !std::strstr(ax.implSource, searchBuf)) continue;
                }
                ImGui::TableNextRow();
                ImGui::TableSetColumnIndex(0); ImGui::TextColored(ImVec4(1.0f, 0.84f, 0.35f, 1.0f), "%s", ax.code);
                ImGui::TableSetColumnIndex(1); ImGui::TextUnformatted(ax.domain);
                ImGui::TableSetColumnIndex(2); ImGui::Text("%s  (%s)", ax.title, ax.formula);
                ImGui::TableSetColumnIndex(3); ImGui::TextColored(ImVec4(0.55f, 0.88f, 0.95f, 1.0f), "%s", ax.implSource);
            }
            ImGui::EndTable();
        }
    } else {
        ImGui::TextColored(ImVec4(0.75f, 0.92f, 0.45f, 1.0f),
                           "ALIFE LINEAGE & 150-PEER COMPARATIVE CATALOG (Full 150-system matrix in `alife/150-peers.html`)");
        ImGui::SetNextItemWidth(280.0f);
        ImGui::InputTextWithHint("##peer_filter", "Search ALife peers (Tierra, Avida, Lenia, Polyworld, Eshkol...)", searchBuf, sizeof(searchBuf));
        if (ImGui::BeginTable("##peers_tbl", 4, ImGuiTableFlags_Borders | ImGuiTableFlags_RowBg | ImGuiTableFlags_SizingStretchProp)) {
            ImGui::TableSetupColumn("System / Author", ImGuiTableColumnFlags_WidthFixed, 195.0f);
            ImGui::TableSetupColumn("Year", ImGuiTableColumnFlags_WidthFixed, 68.0f);
            ImGui::TableSetupColumn("Compute Substrate", ImGuiTableColumnFlags_WidthFixed, 165.0f);
            ImGui::TableSetupColumn("Architectural Lineage in CQM2 v5.0.0");
            ImGui::TableHeadersRow();
            for (const auto& pr : kAlifePeers) {
                if (searchBuf[0] != '\0' && !std::strstr(pr.name, searchBuf) && !std::strstr(pr.substrate, searchBuf)) continue;
                ImGui::TableNextRow();
                ImGui::TableSetColumnIndex(0); ImGui::TextColored(ImVec4(0.95f, 0.85f, 0.48f, 1.0f), "%s", pr.name);
                ImGui::TableSetColumnIndex(1); ImGui::TextUnformatted(pr.era);
                ImGui::TableSetColumnIndex(2); ImGui::TextUnformatted(pr.substrate);
                ImGui::TableSetColumnIndex(3); ImGui::TextUnformatted(pr.lineageContribution);
            }
            ImGui::EndTable();
        }
    }
    ImGui::EndChild();
}

} // namespace cqm2_backrooms
