/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once

#include "cqm2_native_audio.h"
#include "cqm2_native_renderer.h"
#include "cqm2_native_sim.h"
#include <string>

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
    Xenomimic
};

class NativeCosmosHud {
public:
    NativeCosmosHud() = default;
    ~NativeCosmosHud();

    bool init(GLFWwindow* window);
    void shutdown();

    void openWindowByName(const std::string& name);
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
    int m_obsTab{0}; // 0=OVER, 1=VAR, 2=ECO, 3=WAR
    int m_labSubTab{0}; // 0=Wildbeyond, 1=Consciousness, 2=Sentience, 3=CQM-25 Profile
    float m_bar3Scroll{0.0f};
    char m_accessInput[64]{};
    char m_stage2Input[64]{};
    char m_copilotInput[256]{};
    std::string m_accessFeedback;
    std::string m_stage2Feedback;
    std::vector<std::pair<std::string, std::string>> m_copilotLog{
        {"SYSTEM", "Cosmogonic Local Sovereign Copilot online (Quad-Silicon + Eshkol Active Inference + Asmodenius 272-LIF)."},
        {"MANHATTAN", "CQM-25 indicatorOnly=true; scalar sentience/consciousness aggregation strictly prohibited."}
    };
};

} // namespace cqm2_hud
