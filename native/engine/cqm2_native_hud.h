/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once

#include "cqm2_native_audio.h"
#include "cqm2_native_renderer.h"
#include "cqm2_native_sim.h"
#include <string>
#include <utility>
#include <vector>

struct GLFWwindow;

namespace cqm2_hud {

enum class ModalWindow : int {
    None = 0,
    Docs,
    Specs,
    Bible,
    Lab,
    Access,
    StageII,
    Settings,
    Copilot,
    Help,
    Audit,
    NhiObs,
    Market,
    Archons,
    Pantheons,
    Xylos,
    Xenomimic,
    Sandbox
};

class NativeCosmosHud {
public:
    NativeCosmosHud() = default;
    ~NativeCosmosHud();

    bool init(GLFWwindow* window);
    void shutdown();

    void openWindowByName(const std::string& name);
    void setObsTab(int idx) { m_obsTab = (idx >= 0 && idx < 4) ? idx : 0; }
    void setLeftScrollFrac(float f) { m_forceLeftScrollFrac = f; }

    void render(
        cqm2_sim::NativeCosmosSim& sim,
        cqm2_render::NativeCosmosRenderer& renderer,
        cqm2_render::OrbitCamera& cam,
        cqm2_audio::NativeAudioEngine& audio,
        int fbw,
        int fbh,
        float fps,
        float frameMs
    );

    bool panelsVisible{true};
    bool leftCollapsed{false};
    bool rightCollapsed{false};
    bool fxEnabled{true};
    ModalWindow activeModal{ModalWindow::None};

private:
    void applyCosmogonicTheme();
    void drawLeftDock(cqm2_sim::NativeCosmosSim& sim, int fbw, int fbh, float fps, float frameMs);
    void drawTopCenterBar(cqm2_sim::NativeCosmosSim& sim, int fbw);
    void drawRightDock(
        cqm2_sim::NativeCosmosSim& sim,
        cqm2_render::NativeCosmosRenderer& renderer,
        cqm2_audio::NativeAudioEngine& audio,
        int fbw,
        int fbh
    );
    void drawObservatoryChart(const cqm2_sim::NativeCosmosSim& sim, int tabIdx, int slotIdx, float width, float height);
    void drawBottomThreeRowDock(
        cqm2_sim::NativeCosmosSim& sim,
        cqm2_render::OrbitCamera& cam,
        cqm2_audio::NativeAudioEngine& audio,
        int fbw,
        int fbh
    );
    void drawActiveModal(
        cqm2_sim::NativeCosmosSim& sim,
        cqm2_render::OrbitCamera& cam,
        cqm2_audio::NativeAudioEngine& audio,
        int fbw,
        int fbh
    );
    void openLocalHtml(const std::wstring& repoRoot, const wchar_t* relHtml);

    bool m_inited{false};
    int m_obsTab{0};         // 0=OVER, 1=VAR, 2=ECO, 3=WAR
    int m_docsSubTab{0};
    int m_specSubTab{0};
    int m_bibleSubTab{0};
    int m_labSubTab{0};
    int m_wildPage{0};
    int m_auditFilter{0};    // 0=ALL, 1=THERMO, 2=QUANTUM, 3=NEURAL, 4=GOVERNANCE
    int m_helpTopic{0};
    bool m_modalMinimized{false};
    bool m_modalDimmed{false};
    bool m_archonNeuralOpen{false};
    float m_bar3Scroll{0.0f};
    float m_forceLeftScrollFrac{-1.0f};

    char m_backroomSearch[64]{};
    char m_helpSearch[64]{};
    char m_accessInput[64]{};
    char m_stage2Input[64]{};
    char m_copilotInput[256]{};
    std::string m_accessFeedback;
    std::string m_stage2Feedback;
    std::vector<std::pair<std::string, std::string>> m_copilotLog{
        {"SYSTEM", "Cosmogonic Sovereign Copilot v5.0.0 online (Quad-Silicon + Eshkol AD + Asmodenius 272-LIF + 100M LoRA)."},
        {"MANHATTAN", "CQM-25 v1.0.0 active: indicatorOnly=true, aggregation='prohibited', score=null. Try /rea, /quantum, /brains, /ledger, /eshkol (+ (* x x) (sin x))."}
    };
};

} // namespace cqm2_hud
