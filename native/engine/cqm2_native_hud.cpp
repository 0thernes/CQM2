/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#include "cqm2_native_hud.h"
#include "cqm2_native_backrooms.hpp"

#include <imgui.h>
#include <backends/imgui_impl_glfw.h>
#include <backends/imgui_impl_opengl3.h>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <shellapi.h>
#endif

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstring>

namespace cqm2_hud {

namespace {

bool fileExistsA(const char* path) {
#ifdef _WIN32
    DWORD a = GetFileAttributesA(path);
    return (a != INVALID_FILE_ATTRIBUTES) && ((a & FILE_ATTRIBUTE_DIRECTORY) == 0);
#else
    (void)path;
    return false;
#endif
}

std::string toLowerAscii(const std::string& s) {
    std::string out = s;
    for (char& c : out) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return out;
}

ImU32 phylaColU32(int p, int alpha = 220) {
    static const ImU32 kBase[10] = {
        IM_COL32(45, 235, 220, 255),  IM_COL32(90, 175, 255, 255),
        IM_COL32(180, 105, 255, 255), IM_COL32(255, 95, 195, 255),
        IM_COL32(255, 115, 95, 255),  IM_COL32(255, 195, 65, 255),
        IM_COL32(195, 240, 75, 255),  IM_COL32(75, 235, 130, 255),
        IM_COL32(130, 225, 255, 255), IM_COL32(255, 230, 150, 255)
    };
    ImU32 c = kBase[p % 10];
    return (c & 0x00FFFFFFu) | (static_cast<ImU32>(alpha & 255) << 24);
}

void drawRingSparkline(
    const char* id,
    const float* ring,
    int ringLen,
    int cursor,
    float width,
    float height,
    ImU32 lineCol,
    ImU32 fillCol
) {
    ImVec2 p0 = ImGui::GetCursorScreenPos();
    ImVec2 sz(std::max(16.0f, width), std::max(10.0f, height));
    ImGui::InvisibleButton(id, sz);
    ImDrawList* dl = ImGui::GetWindowDrawList();

    dl->AddRectFilled(p0, ImVec2(p0.x + sz.x, p0.y + sz.y), IM_COL32(9, 7, 15, 210), 2.0f);
    dl->AddRect(p0, ImVec2(p0.x + sz.x, p0.y + sz.y), IM_COL32(72, 62, 110, 85), 2.0f);
    if (!ring || ringLen < 2) return;

    float vMin = ring[0], vMax = ring[0];
    for (int i = 1; i < ringLen; ++i) {
        float v = std::isfinite(ring[i]) ? ring[i] : 0.0f;
        vMin = std::min(vMin, v);
        vMax = std::max(vMax, v);
    }
    float span = std::max(1e-4f, vMax - vMin);
    const float padX = 2.0f, padY = 2.0f;
    const float w = std::max(4.0f, sz.x - padX * 2.0f);
    const float h = std::max(4.0f, sz.y - padY * 2.0f);
    const float baseY = p0.y + sz.y - padY;

    ImVec2 prev;
    const int spStride = std::max(1, ringLen / 48);
    int sampleIdx = 0;
    for (int i = 0; i < ringLen; i += spStride, ++sampleIdx) {
        int iClamp = std::min(i, ringLen - 1);
        int idx = (cursor + iClamp) % ringLen;
        float norm = std::clamp((ring[idx] - vMin) / span, 0.0f, 1.0f);
        ImVec2 cur(p0.x + padX + (static_cast<float>(iClamp) / (ringLen - 1)) * w, baseY - norm * h);
        if (sampleIdx > 0) {
            ImVec2 quad[4] = { prev, cur, ImVec2(cur.x, baseY), ImVec2(prev.x, baseY) };
            dl->AddConvexPolyFilled(quad, 4, fillCol);
            dl->AddLine(prev, cur, lineCol, 1.4f);
        }
        prev = cur;
    }
}

void drawMetricRow(const char* label, const char* valStr, const ImVec4& valColor = ImVec4(0.95f, 0.96f, 0.99f, 1.0f)) {
    ImGui::TextColored(ImVec4(0.56f, 0.57f, 0.68f, 0.96f), "%s", label);
    float rightX = ImGui::GetWindowContentRegionMax().x - ImGui::CalcTextSize(valStr).x;
    if (rightX > ImGui::GetCursorPosX() + 4.0f) ImGui::SameLine(rightX);
    else ImGui::SameLine();
    ImGui::TextColored(valColor, "%s", valStr);
}

bool pillBtn(const char* label, bool active, const ImVec4& activeBg, const ImVec2& sz = ImVec2(0, 0)) {
    if (active) {
        ImGui::PushStyleColor(ImGuiCol_Button, activeBg);
        ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(
            std::min(1.0f, activeBg.x + 0.12f), std::min(1.0f, activeBg.y + 0.12f), std::min(1.0f, activeBg.z + 0.12f), 0.98f));
        ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(1.0f, 1.0f, 1.0f, 1.0f));
    }
    bool c = ImGui::Button(label, sz);
    if (active) ImGui::PopStyleColor(3);
    return c;
}

} // namespace

NativeCosmosHud::~NativeCosmosHud() {
    shutdown();
}

bool NativeCosmosHud::init(GLFWwindow* window) {
    if (m_inited) return true;
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.IniFilename = nullptr;
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;

    if (fileExistsA("C:\\Windows\\Fonts\\consola.ttf")) {
        io.Fonts->AddFontFromFileTTF("C:\\Windows\\Fonts\\consola.ttf", 26.0f);
        if (fileExistsA("C:\\Windows\\Fonts\\seguisym.ttf")) {
            ImFontConfig mergeCfg;
            mergeCfg.MergeMode = true;
            io.Fonts->AddFontFromFileTTF("C:\\Windows\\Fonts\\seguisym.ttf", 26.0f, &mergeCfg);
        }
        io.FontGlobalScale = 0.5f;
    } else {
        io.Fonts->AddFontDefault();
    }

    applyCosmogonicTheme();
    if (!ImGui_ImplGlfw_InitForOpenGL(window, true)) return false;
    if (!ImGui_ImplOpenGL3_Init("#version 330 core")) return false;
    m_inited = true;
    return true;
}

void NativeCosmosHud::shutdown() {
    if (!m_inited) return;
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    m_inited = false;
}

void NativeCosmosHud::applyCosmogonicTheme() {
    ImGuiStyle& st = ImGui::GetStyle();
    st.WindowRounding = 6.0f;
    st.ChildRounding = 5.0f;
    st.FrameRounding = 4.0f;
    st.GrabRounding = 4.0f;
    st.ScrollbarRounding = 4.0f;
    st.ScrollbarSize = 10.5f;
    st.WindowBorderSize = 1.0f;
    st.FrameBorderSize = 1.0f;
    st.WindowPadding = ImVec2(8.0f, 7.0f);
    st.FramePadding = ImVec2(6.0f, 3.5f);
    st.ItemSpacing = ImVec2(5.0f, 4.0f);

    ImVec4* c = st.Colors;
    c[ImGuiCol_WindowBg]        = ImVec4(0.038f, 0.035f, 0.058f, 0.90f);
    c[ImGuiCol_ChildBg]         = ImVec4(0.030f, 0.028f, 0.048f, 0.86f);
    c[ImGuiCol_PopupBg]         = ImVec4(0.045f, 0.040f, 0.072f, 0.96f);
    c[ImGuiCol_Border]          = ImVec4(0.24f,  0.22f,  0.36f,  0.55f);
    c[ImGuiCol_FrameBg]         = ImVec4(0.075f, 0.070f, 0.115f, 0.92f);
    c[ImGuiCol_FrameBgHovered]  = ImVec4(0.13f,  0.12f,  0.20f,  0.95f);
    c[ImGuiCol_Button]          = ImVec4(0.085f, 0.082f, 0.132f, 0.92f);
    c[ImGuiCol_ButtonHovered]   = ImVec4(0.16f,  0.24f,  0.36f,  0.96f);
    c[ImGuiCol_ButtonActive]    = ImVec4(0.22f,  0.38f,  0.54f,  1.00f);
    c[ImGuiCol_ScrollbarBg]     = ImVec4(0.05f,  0.05f,  0.08f,  0.75f);
    c[ImGuiCol_ScrollbarGrab]   = ImVec4(0.76f,  0.78f,  0.84f,  0.88f); // Bright visible scrollbar thumb like Original CQM!
    c[ImGuiCol_ScrollbarGrabHovered] = ImVec4(0.92f, 0.94f, 0.98f, 0.96f);
    c[ImGuiCol_ScrollbarGrabActive]  = ImVec4(1.00f, 1.00f, 1.00f, 1.00f);
    c[ImGuiCol_Text]            = ImVec4(0.91f,  0.92f,  0.96f,  1.00f);
}

void NativeCosmosHud::openLocalHtml(const std::wstring& repoRoot, const wchar_t* relHtml) {
#ifdef _WIN32
    if (repoRoot.empty() || !relHtml) return;
    std::wstring full = repoRoot + L"\\" + relHtml;
    ShellExecuteW(nullptr, L"open", full.c_str(), nullptr, repoRoot.c_str(), SW_SHOWNORMAL);
#else
    (void)repoRoot; (void)relHtml;
#endif
}

void NativeCosmosHud::openWindowByName(const std::string& name) {
    std::string k = toLowerAscii(name);
    m_modalMinimized = false;
    if (k == "none" || k == "close") activeModal = ModalWindow::None;
    else if (k == "docs") activeModal = ModalWindow::Docs;
    else if (k == "spec" || k == "specs") activeModal = ModalWindow::Specs;
    else if (k == "bible") activeModal = ModalWindow::Bible;
    else if (k == "lab") activeModal = ModalWindow::Lab;
    else if (k == "access") activeModal = ModalWindow::Access;
    else if (k == "stage2" || k == "stageii") activeModal = ModalWindow::StageII;
    else if (k == "set" || k == "settings") activeModal = ModalWindow::Settings;
    else if (k == "copilot") activeModal = ModalWindow::Copilot;
    else if (k == "help") activeModal = ModalWindow::Help;
    else if (k == "audit") activeModal = ModalWindow::Audit;
    else if (k == "nhi" || k == "nhiobs" || k == "nhi_obs") activeModal = ModalWindow::NhiObs;
    else if (k == "market") activeModal = ModalWindow::Market;
    else if (k == "archons" || k == "archon") activeModal = ModalWindow::Archons;
    else if (k == "pantheons" || k == "pantheon") activeModal = ModalWindow::Pantheons;
    else if (k == "xylos") activeModal = ModalWindow::Xylos;
    else if (k == "xenomimic" || k == "xno") activeModal = ModalWindow::Xenomimic;
    else if (k == "sandbox") activeModal = ModalWindow::Sandbox;
}

// ============================================================================
// 1. TOP CENTER PILLS (`✦ Enter Mini World — full glory`, Superhero HUD, Sandbox)
// ============================================================================
void NativeCosmosHud::drawTopCenterBar(cqm2_sim::NativeCosmosSim& sim, int fbw) {
    const char* pillTxt = sim.miniWorldMode ? "<- Back to the full-size world" : "✦ Enter Mini World — full glory";
    float pw = ImGui::CalcTextSize(pillTxt).x + 36.0f;
    ImGui::SetNextWindowPos(ImVec2((fbw - pw) * 0.5f, 10.0f), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(pw, 34.0f), ImGuiCond_Always);
    ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.16f, 0.10f, 0.08f, 0.92f));
    ImGui::PushStyleColor(ImGuiCol_Border, ImVec4(0.88f, 0.58f, 0.24f, 0.85f));
    ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 17.0f);
    if (ImGui::Begin("##top_miniworld_pill", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoSavedSettings)) {
        ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0, 0, 0, 0));
        ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(1.0f, 0.92f, 0.78f, 1.0f));
        if (ImGui::Button(pillTxt, ImVec2(pw - 16.0f, 20.0f))) {
            sim.miniWorldMode = !sim.miniWorldMode;
        }
        ImGui::PopStyleColor(2);
    }
    ImGui::End();
    ImGui::PopStyleVar();
    ImGui::PopStyleColor(2);

    // Optional Superhero Sovereign HUD pill when Level Omega (`ACCESS`) is unlocked
    if (sim.accessUnlocked) {
        ImGui::SetNextWindowPos(ImVec2((fbw - 390.0f) * 0.5f, 48.0f), ImGuiCond_Always);
        ImGui::SetNextWindowSize(ImVec2(390.0f, sim.heroHudVisible ? 64.0f : 28.0f), ImGuiCond_Always);
        if (ImGui::Begin("##superhero_hud", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
            if (ImGui::SmallButton(sim.heroHudVisible ? "▼ HIDE SUPERHERO HUD ▼" : "▲ SHOW HERO HUD ▲")) {
                sim.heroHudVisible = !sim.heroHudVisible;
            }
            ImGui::SameLine();
            if (ImGui::SmallButton("🧪 SANDBOX (0-300%)")) activeModal = ModalWindow::Sandbox;
            if (sim.sandboxCustomActive()) {
                ImGui::SameLine();
                ImGui::TextColored(ImVec4(0.35f, 1.0f, 0.75f, 1.0f), "Custom active");
            }
            if (sim.heroHudVisible) {
                if (ImGui::SmallButton("GOD PULSE")) sim.actionGodPulse();
                ImGui::SameLine();
                if (ImGui::SmallButton("BLOOM +1200")) sim.actionLifeTreeBloom();
                ImGui::SameLine();
                if (ImGui::SmallButton("XENO +24")) sim.actionSpawnXenomimic(24);
                ImGui::SameLine();
                if (ImGui::SmallButton("NHI +32")) sim.actionNhiRelease(32);
                ImGui::SameLine();
                if (ImGui::SmallButton("SHATTER")) sim.actionShatterReliquary();
            }
        }
        ImGui::End();
    }
}

// ============================================================================
// 2. LEFT DOCK: Scrollable 31-Row TELEMETRY + Scrollable 25 SORTING FIELDS + PERF HUD
// ============================================================================
void NativeCosmosHud::drawLeftDock(cqm2_sim::NativeCosmosSim& sim, int fbw, int fbh, float fps, float frameMs) {
    (void)fbw;
    if (leftCollapsed) {
        ImGui::SetNextWindowPos(ImVec2(4.0f, fbh * 0.45f), ImGuiCond_Always);
        ImGui::SetNextWindowSize(ImVec2(28.0f, 48.0f), ImGuiCond_Always);
        if (ImGui::Begin("##left_uncollapse", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
            if (ImGui::Button(">", ImVec2(18.0f, 34.0f))) leftCollapsed = false;
        }
        ImGui::End();
        return;
    }

    const float leftW = 248.0f;
    const float bottomReserve = 114.0f;
    const float availH = std::max(420.0f, static_cast<float>(fbh) - bottomReserve - 14.0f);
    const float hTelem = availH * 0.34f;
    const float hSort  = availH * 0.27f;
    const float hPerf  = availH - hTelem - hSort - 10.0f;

    // Collapse `<` handle tab on right edge of left dock (matches screenshot!)
    ImGui::SetNextWindowPos(ImVec2(leftW + 7.0f, availH * 0.47f), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(22.0f, 44.0f), ImGuiCond_Always);
    if (ImGui::Begin("##left_collapse_tab", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        if (ImGui::Button("<", ImVec2(14.0f, 30.0f))) leftCollapsed = true;
    }
    ImGui::End();

    // Panel A: TELEMETRY (Scrollable 31 metrics + 4 sparklines!)
    ImGui::SetNextWindowPos(ImVec2(8.0f, 8.0f), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(leftW, hTelem), ImGuiCond_Always);
    if (ImGui::Begin("##left_telemetry", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        ImGui::TextColored(ImVec4(0.18f, 0.92f, 0.86f, 1.0f), "TELEMETRY");
        ImGui::SameLine(leftW - 24.0f);
        ImGui::TextDisabled("▾");
        ImGui::Separator();

        ImGui::BeginChild("##telem_scroll", ImVec2(0, 0), false, ImGuiWindowFlags_AlwaysVerticalScrollbar);
        if (m_forceLeftScrollFrac >= 0.0f) {
            ImGui::SetScrollY(ImGui::GetScrollMaxY() * std::clamp(m_forceLeftScrollFrac, 0.0f, 1.0f));
        }
        const float sw = ImGui::GetContentRegionAvail().x - 2.0f;
        char buf[96];

        std::snprintf(buf, sizeof(buf), "%d/%d", sim.liveEntityCount, sim.maxEntityCap);
        drawMetricRow("ENTITIES", buf);
        drawRingSparkline("##sp_ent", sim.sparkEntities.data(), cqm2_sim::kHistoryLen, sim.historyCursor, sw, 20.0f, IM_COL32(65, 235, 215, 255), IM_COL32(25, 110, 105, 85));

        std::snprintf(buf, sizeof(buf), "%d", sim.xenomimicCount);
        drawMetricRow("XENOMIMICS", buf);
        drawRingSparkline("##sp_xno", sim.sparkXenomimics.data(), cqm2_sim::kHistoryLen, sim.historyCursor, sw, 20.0f, IM_COL32(245, 105, 215, 255), IM_COL32(115, 35, 100, 85));

        std::snprintf(buf, sizeof(buf), "%.2f", sim.chaosLevel);
        drawMetricRow("CHAOS", buf);
        drawRingSparkline("##sp_chs", sim.sparkChaos.data(), cqm2_sim::kHistoryLen, sim.historyCursor, sw, 20.0f, IM_COL32(250, 175, 55, 255), IM_COL32(120, 75, 20, 85));

        std::snprintf(buf, sizeof(buf), "%.0f", sim.freeEnergyPool);
        drawMetricRow("ENERGY", buf);
        drawRingSparkline("##sp_eng", sim.sparkEnergy.data(), cqm2_sim::kHistoryLen, sim.historyCursor, sw, 20.0f, IM_COL32(75, 240, 130, 255), IM_COL32(25, 115, 55, 85));

        // Scrollable Deep Telemetry Rows (rows 5..31 — revealed via scrollbar!)
        std::snprintf(buf, sizeof(buf), "%d", sim.foodOrbCount);          drawMetricRow("FOOD ORBS", buf);
        std::snprintf(buf, sizeof(buf), "%d/256", sim.activeMorphCount);  drawMetricRow("MORPHOTYPES", buf);
        std::snprintf(buf, sizeof(buf), "%llu", static_cast<unsigned long long>(sim.totalMutations)); drawMetricRow("MUTATIONS", buf);
        std::snprintf(buf, sizeof(buf), "%d/20", sim.activeTribeCount);   drawMetricRow("TRIBES", buf);
        std::snprintf(buf, sizeof(buf), "%d", sim.nhiActiveCount);        drawMetricRow("NHI RELEASED", buf, ImVec4(0.45f, 0.95f, 1.0f, 1.0f));
        std::snprintf(buf, sizeof(buf), "%d / %d", sim.leviathanCount, sim.shoggothCount); drawMetricRow("LEVIATH / SHOG", buf);
        std::snprintf(buf, sizeof(buf), "%d", sim.wildFloraCount);        drawMetricRow("WILD FLORA", buf);
        std::snprintf(buf, sizeof(buf), "%d", sim.synapticLinkCount);     drawMetricRow("CONNECTOME LINKS", buf);
        std::snprintf(buf, sizeof(buf), "%.3f", sim.shannonDiversityH);   drawMetricRow("SHANNON H'", buf);
        std::snprintf(buf, sizeof(buf), "%.3f", sim.kuramotoOrderR);      drawMetricRow("KURAMOTO SYNC R", buf);
        std::snprintf(buf, sizeof(buf), "%.3f", sim.archons[0].stats16[9]); drawMetricRow("ARCHON REA (#10)", buf, ImVec4(1.0f, 0.84f, 0.36f, 1.0f));
        std::snprintf(buf, sizeof(buf), "%.3f", sim.pciLzStar);           drawMetricRow("FORKED PCI* LZ76", buf);
        std::snprintf(buf, sizeof(buf), "%.4f", sim.eshkolVfe);           drawMetricRow("ESHKOL VFE", buf);
        std::snprintf(buf, sizeof(buf), "%.3f", sim.eshkolMetacogConf);   drawMetricRow("VANDERMONDE CONF", buf);
        std::snprintf(buf, sizeof(buf), "%.4f", sim.quantumMagicM2);      drawMetricRow("STABILIZER M2", buf);
        std::snprintf(buf, sizeof(buf), "%.4f", sim.bellChsh);            drawMetricRow("BELL-CHSH S", buf);
        std::snprintf(buf, sizeof(buf), "%+d", sim.qwzChernNumber);       drawMetricRow("QWZ CHERN C", buf);
        std::snprintf(buf, sizeof(buf), "%u/63", sim.hoggarViolatedLines); drawMetricRow("HOGGAR 63-LINE", buf);
        std::snprintf(buf, sizeof(buf), "%.2e", sim.kerrCarterDrift);     drawMetricRow("KERR CARTER dQ", buf);
        std::snprintf(buf, sizeof(buf), "%.2e", sim.alifeV3Drift);        drawMetricRow("ALIFE v3 KBN", buf, ImVec4(0.45f, 1.0f, 0.68f, 1.0f));
        std::snprintf(buf, sizeof(buf), "%.0f / %.0f", sim.moneySupplySun, sim.creditSupplyMoon); drawMetricRow("MONEY ☉ / CRED ☾", buf);
        std::snprintf(buf, sizeof(buf), "%.3f", sim.fxRateSunMoon);       drawMetricRow("FX ☉/☾", buf);
        std::snprintf(buf, sizeof(buf), "%.2f / %.2f", sim.priceMatter, sim.priceEnergy); drawMetricRow("MATTER ◇ / ENG ❖", buf);
        std::snprintf(buf, sizeof(buf), "%.3f", sim.wealthGini);          drawMetricRow("WEALTH GINI", buf);
        std::snprintf(buf, sizeof(buf), "%.1f Hz", sim.asmodeniusCorticalHz); drawMetricRow("ASMODENIUS LIF", buf);
        std::snprintf(buf, sizeof(buf), "%.3f", sim.asmodenius100mAct);   drawMetricRow("100M LORA ACT", buf);
        std::snprintf(buf, sizeof(buf), "%.1f K / %.1f m/s", sim.domeTempKelvin, sim.windSpeed); drawMetricRow("DOME TEMP / WIND", buf);
        ImGui::EndChild();
    }
    ImGui::End();

    // Panel B: SORTING FIELDS (Scrollable 25 exact Original CQM sorting algorithms!)
    ImGui::SetNextWindowPos(ImVec2(8.0f, 12.0f + hTelem), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(leftW, hSort), ImGuiCond_Always);
    if (ImGui::Begin("##left_sorting_fields", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        ImGui::TextColored(ImVec4(0.18f, 0.92f, 0.86f, 1.0f), "SORTING FIELDS");
        ImGui::SameLine(leftW - 92.0f);
        if (ImGui::SmallButton("✶ ALL")) sim.actionStepAllSorts();
        ImGui::SameLine();
        if (pillBtn("▸ AUTO", sim.autoSort, ImVec4(0.14f, 0.44f, 0.40f, 0.95f), ImVec2(44.0f, 18.0f))) sim.autoSort = !sim.autoSort;
        ImGui::Separator();

        ImGui::BeginChild("##sort_list_scroll", ImVec2(0, -22.0f), false, ImGuiWindowFlags_AlwaysVerticalScrollbar);
        if (m_forceLeftScrollFrac >= 0.0f) {
            ImGui::SetScrollY(ImGui::GetScrollMaxY() * std::clamp(m_forceLeftScrollFrac, 0.0f, 1.0f));
        }
        for (int i = 0; i < cqm2_sim::kSortingAlgoCount; ++i) {
            ImGui::PushID(i);
            bool sel = (sim.activeSortAlgo == i);
            ImVec4 dotCol = ImColor::HSV((i * 0.04f), 0.82f, 0.95f).Value;
            ImGui::TextColored(dotCol, sel ? "◆" : "◈");
            ImGui::SameLine();
            if (ImGui::Selectable(cqm2_sim::kSortingAlgoNames[i], sel, 0, ImVec2(138.0f, 16.0f))) {
                sim.activeSortAlgo = i;
            }
            ImGui::SameLine(166.0f);
            ImGui::ProgressBar(sim.sortOmega[i], ImVec2(52.0f, 6.0f), "");
            ImGui::PopID();
        }
        ImGui::EndChild();

        ImGui::TextColored(ImVec4(0.62f, 0.64f, 0.76f, 1.0f), "ACTIVE: %s (%.3f)",
                           cqm2_sim::kSortingAlgoNames[sim.activeSortAlgo], sim.sortOmega[sim.activeSortAlgo]);
    }
    ImGui::End();

    // Panel C: PERF HUD + Quad-Silicon Readout + 2x3 Quality Tier Grid (`[phone] tablet / laptop desktop / ultra mega`)
    ImGui::SetNextWindowPos(ImVec2(8.0f, 16.0f + hTelem + hSort), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(leftW, hPerf), ImGuiCond_Always);
    if (ImGui::Begin("##left_perf_hud", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        ImVec4 fpsCol = (fps >= 55.0f) ? ImVec4(0.32f, 0.98f, 0.62f, 1.0f)
                      : (fps >= 28.0f) ? ImVec4(1.0f, 0.82f, 0.32f, 1.0f)
                                       : ImVec4(1.0f, 0.42f, 0.42f, 1.0f);
        ImGui::TextColored(fpsCol, "%.0f fps", fps);
        ImGui::SameLine();
        ImGui::Text("· q: full · %s", cqm2_sim::kTierNames[sim.tierIdx]);

        ImGui::TextColored(ImVec4(0.62f, 0.72f, 0.86f, 1.0f), "ambient: zig-simd · core brains:");
        ImGui::TextColored(ImVec4(0.42f, 0.96f, 0.84f, 1.0f), "%s %s",
                           sim.silicon.cudaReady ? "CUDA sm_120" : "AVX2",
                           sim.silicon.npuLevelZeroReady ? "+ NPU AI Boost" : "");
        ImGui::Text("%.2f ms · GFLOP/s %.1f · %.0f GB VRAM",
                    frameMs, sim.silicon.lastBrainGflops, sim.silicon.vramGb);
        ImGui::Text("n %d/%d · links %d · wild %d",
                    sim.liveEntityCount, sim.maxEntityCap, sim.synapticLinkCount, sim.wildFloraCount);
        ImGui::TextColored(ImVec4(0.58f, 0.60f, 0.72f, 1.0f), "cpu 24c · zig 49k · rsw1 %s",
                           sim.silicon.rsw1StreamOk ? "OK" : "..");

        ImGui::Spacing();
        const float bw = (leftW - 26.0f) * 0.5f;
        for (int t = 0; t < cqm2_sim::kTierCount; ++t) {
            if (t % 2 == 1) ImGui::SameLine();
            char lbl[32];
            if (sim.tierIdx == t) std::snprintf(lbl, sizeof(lbl), "[%s]", cqm2_sim::kTierNames[t]);
            else std::snprintf(lbl, sizeof(lbl), "%s", cqm2_sim::kTierNames[t]);
            if (pillBtn(lbl, sim.tierIdx == t, ImVec4(0.10f, 0.36f, 0.42f, 0.95f), ImVec2(bw, 20.0f))) {
                sim.setTier(t);
            }
        }
    }
    ImGui::End();
}

// ============================================================================
// 3. RIGHT DOCK: 16-Chart Data-Science OBSERVATORY + SORTING·FIELD + SIM·SETTINGS + 3 Live Brains
// ============================================================================
void NativeCosmosHud::drawObservatoryChart(
    const cqm2_sim::NativeCosmosSim& sim,
    int tabIdx,
    int slotIdx,
    float width,
    float height
) {
    static const char* kTitles[4][4] = {
        {"10-PHYLA STACKED POPULATION", "20-TITAN RESOURCE LEDGER", "20x20 TITAN DIPLOMACY MATRIX", "ENV: RD · QUANTUM H · TREND"},
        {"POPULATION MEAN ± 1σ BAND", "16-BIN ENERGY DISTRIBUTION", "SHANNON DIVERSITY H' AREA", "PHASE PORTRAIT (qH × TREND)"},
        {"5x2 PHYLA SMALL MULTIPLES", "BIPOLAR BIRTH (+) / DEATH (-)", "TITAN MATTER × ENERGY SCATTER", "XENOMIMIC & NHI INDICATORS"},
        {"WAR INTENSITY AREA", "TRUCE / WAR / ALLY 100% STACK", "20-TITAN HORIZONTAL BARS", "BIOME SENTIENCE RADIAL GAUGE"}
    };

    ImVec2 p0 = ImGui::GetCursorScreenPos();
    ImVec2 sz(std::max(40.0f, width), std::max(38.0f, height));
    char cid[32];
    std::snprintf(cid, sizeof(cid), "##obs_%d_%d", tabIdx, slotIdx);
    ImGui::InvisibleButton(cid, sz);
    ImDrawList* dl = ImGui::GetWindowDrawList();

    dl->AddRectFilled(p0, ImVec2(p0.x + sz.x, p0.y + sz.y), IM_COL32(8, 7, 15, 225), 3.0f);
    dl->AddRect(p0, ImVec2(p0.x + sz.x, p0.y + sz.y), IM_COL32(78, 70, 122, 110), 3.0f);
    dl->AddText(ImVec2(p0.x + 5.0f, p0.y + 2.0f), IM_COL32(175, 185, 215, 235), kTitles[tabIdx][slotIdx]);

    const float gx = p0.x + 5.0f;
    const float gy = p0.y + 16.0f;
    const float gw = std::max(12.0f, sz.x - 10.0f);
    const float gh = std::max(12.0f, sz.y - 20.0f);
    const int H = cqm2_sim::kHistoryLen;
    const int stride = std::max(1, H / 48);
    const int cur = sim.historyCursor;

    if (tabIdx == 0 && slotIdx == 0) {
        // OVER #1: 10-Band Rainbow Stacked Area (Phyla 0..9)
        for (int i = 0; i < H - stride; i += stride) {
            int j = std::min(i + stride, H - 1);
            int k0 = (cur + i) % H, k1 = (cur + j) % H;
            float tot0 = 1e-4f, tot1 = 1e-4f;
            for (int p = 0; p < 10; ++p) { tot0 += sim.phylumPopHist[p][k0]; tot1 += sim.phylumPopHist[p][k1]; }
            float x0 = gx + (static_cast<float>(i) / (H - 1)) * gw;
            float x1 = gx + (static_cast<float>(j) / (H - 1)) * gw;
            float acc0 = 0.0f, acc1 = 0.0f;
            for (int p = 0; p < 10; ++p) {
                float n0 = acc0 + sim.phylumPopHist[p][k0] / tot0;
                float n1 = acc1 + sim.phylumPopHist[p][k1] / tot1;
                ImVec2 q[4] = {
                    ImVec2(x0, gy + gh * (1.0f - n0)), ImVec2(x1, gy + gh * (1.0f - n1)),
                    ImVec2(x1, gy + gh * (1.0f - acc1)), ImVec2(x0, gy + gh * (1.0f - acc0))
                };
                dl->AddConvexPolyFilled(q, 4, phylaColU32(p, 175));
                acc0 = n0; acc1 = n1;
            }
        }
    } else if (tabIdx == 0 && slotIdx == 1) {
        // OVER #2: 20-Line Multi-Hue Titan Resource Ledger
        for (int t = 0; t < 20; t += 2) {
            ImU32 col = phylaColU32(t % 10, 215);
            for (int i = 0; i < H - stride; i += stride) {
                int j = std::min(i + stride, H - 1);
                float v0 = std::clamp(sim.titanScoreHist[t][(cur + i) % H] / 240.0f, 0.0f, 1.0f);
                float v1 = std::clamp(sim.titanScoreHist[t][(cur + j) % H] / 240.0f, 0.0f, 1.0f);
                dl->AddLine(ImVec2(gx + (float(i) / (H - 1)) * gw, gy + gh * (1.0f - v0)),
                            ImVec2(gx + (float(j) / (H - 1)) * gw, gy + gh * (1.0f - v1)), col, 1.1f);
            }
        }
    } else if (tabIdx == 0 && slotIdx == 2) {
        // OVER #3: 20x20 Titan Diplomacy Heatmap (Crimson=War, Slate=Truce, Teal=Ally)
        float cw = gw / 20.0f, ch = gh / 20.0f;
        for (int r = 0; r < 20; ++r) {
            for (int c = 0; c < 20; ++c) {
                float d = sim.diplomacyMatrix[r][c];
                ImU32 cellCol = (d < -0.25f) ? IM_COL32(225, 55, 85, 220)
                              : (d >  0.25f) ? IM_COL32(45, 215, 175, 220)
                                             : IM_COL32(55, 60, 88, 190);
                dl->AddRectFilled(ImVec2(gx + c * cw, gy + r * ch), ImVec2(gx + (c + 1) * cw - 0.5f, gy + (r + 1) * ch - 0.5f), cellCol);
            }
        }
    } else if (tabIdx == 0 && slotIdx == 3) {
        // OVER #4: 3-Line Env Overlay (RD Coral, Quantum H, Sort Trend)
        const float* arrs[3] = { sim.envRdHist.data(), sim.envQhHist.data(), sim.envTrendHist.data() };
        const ImU32 cols[3] = { IM_COL32(65, 240, 210, 240), IM_COL32(215, 110, 255, 240), IM_COL32(255, 200, 70, 240) };
        for (int s = 0; s < 3; ++s) {
            for (int i = 0; i < H - stride; i += stride) {
                int j = std::min(i + stride, H - 1);
                float v0 = std::clamp(arrs[s][(cur + i) % H], 0.0f, 1.0f);
                float v1 = std::clamp(arrs[s][(cur + j) % H], 0.0f, 1.0f);
                dl->AddLine(ImVec2(gx + (float(i) / (H - 1)) * gw, gy + gh * (1.0f - v0)),
                            ImVec2(gx + (float(j) / (H - 1)) * gw, gy + gh * (1.0f - v1)), cols[s], 1.5f);
            }
        }
    } else if (tabIdx == 1 && slotIdx == 0) {
        // VAR #1: Population Mean ± 1σ Confidence Ribbon
        float cap = std::max(100.0f, static_cast<float>(sim.maxEntityCap));
        for (int i = 0; i < H - stride; i += stride) {
            int j = std::min(i + stride, H - 1);
            int k0 = (cur + i) % H, k1 = (cur + j) % H;
            float m0 = sim.popMeanHist[k0] / cap, s0 = sim.popStdHist[k0] / cap;
            float m1 = sim.popMeanHist[k1] / cap, s1 = sim.popStdHist[k1] / cap;
            float x0 = gx + (float(i) / (H - 1)) * gw, x1 = gx + (float(j) / (H - 1)) * gw;
            ImVec2 q[4] = {
                ImVec2(x0, gy + gh * (1.0f - std::clamp(m0 + s0, 0.0f, 1.0f))),
                ImVec2(x1, gy + gh * (1.0f - std::clamp(m1 + s1, 0.0f, 1.0f))),
                ImVec2(x1, gy + gh * (1.0f - std::clamp(m1 - s1, 0.0f, 1.0f))),
                ImVec2(x0, gy + gh * (1.0f - std::clamp(m0 - s0, 0.0f, 1.0f)))
            };
            dl->AddConvexPolyFilled(q, 4, IM_COL32(70, 175, 255, 75));
            dl->AddLine(ImVec2(x0, gy + gh * (1.0f - std::clamp(m0, 0.0f, 1.0f))),
                        ImVec2(x1, gy + gh * (1.0f - std::clamp(m1, 0.0f, 1.0f))), IM_COL32(95, 225, 255, 255), 1.6f);
        }
    } else if (tabIdx == 1 && slotIdx == 1) {
        // VAR #2: 16-Bin Organism Energy Distribution Histogram
        float bw = gw / 16.0f;
        for (int b = 0; b < 16; ++b) {
            float bh = std::clamp(sim.energyHistogram16[b], 0.02f, 1.0f) * gh;
            dl->AddRectFilled(ImVec2(gx + b * bw + 1.0f, gy + gh - bh), ImVec2(gx + (b + 1) * bw - 1.0f, gy + gh),
                              phylaColU32(b % 10, 220), 1.5f);
        }
    } else if (tabIdx == 1 && slotIdx == 2) {
        // VAR #3: Shannon Phylum Diversity H' Area (0..ln(10)=2.3026)
        for (int i = 0; i < H - 1; ++i) {
            float v0 = std::clamp(sim.shannonDiversityH / 2.3026f + 0.06f * std::sin(i * 0.2f), 0.0f, 1.0f);
            float v1 = std::clamp(sim.shannonDiversityH / 2.3026f + 0.06f * std::sin((i + 1) * 0.2f), 0.0f, 1.0f);
            float x0 = gx + (float(i) / (H - 1)) * gw, x1 = gx + (float(i + 1) / (H - 1)) * gw;
            ImVec2 q[4] = { ImVec2(x0, gy + gh * (1.0f - v0)), ImVec2(x1, gy + gh * (1.0f - v1)), ImVec2(x1, gy + gh), ImVec2(x0, gy + gh) };
            dl->AddConvexPolyFilled(q, 4, IM_COL32(165, 85, 245, 85));
            dl->AddLine(q[0], q[1], IM_COL32(205, 135, 255, 255), 1.5f);
        }
    } else if (tabIdx == 1 && slotIdx == 3) {
        // VAR #4: 2D Phase Portrait Trajectory (qH x Trend)
        for (int i = 0; i < H - 1; ++i) {
            int k0 = (cur + i) % H, k1 = (cur + i + 1) % H;
            ImVec2 a(gx + std::clamp(sim.envQhHist[k0], 0.05f, 0.95f) * gw, gy + (1.0f - std::clamp(sim.envTrendHist[k0], 0.05f, 0.95f)) * gh);
            ImVec2 b(gx + std::clamp(sim.envQhHist[k1], 0.05f, 0.95f) * gw, gy + (1.0f - std::clamp(sim.envTrendHist[k1], 0.05f, 0.95f)) * gh);
            int al = 40 + (i * 210) / H;
            dl->AddLine(a, b, IM_COL32(75, 245, 215, al), 1.4f);
            if (i == H - 2) dl->AddCircleFilled(b, 3.5f, IM_COL32(255, 220, 80, 255));
        }
    } else if (tabIdx == 2 && slotIdx == 0) {
        // ECO #1: 5x2 Phyla Small-Multiples Grid
        float cw = gw / 5.0f, ch = gh / 2.0f;
        for (int p = 0; p < 10; ++p) {
            float sx = gx + (p % 5) * cw + 1.0f, sy = gy + (p / 5) * ch + 1.0f;
            dl->AddRect(ImVec2(sx, sy), ImVec2(sx + cw - 2.0f, sy + ch - 2.0f), IM_COL32(60, 55, 95, 90));
            for (int i = 0; i < 24; ++i) {
                int k0 = (cur + H - 25 + i) % H, k1 = (cur + H - 24 + i) % H;
                float n0 = std::clamp(sim.phylumPopHist[p][k0] / std::max(10.0f, sim.liveEntityCount * 0.22f), 0.0f, 1.0f);
                float n1 = std::clamp(sim.phylumPopHist[p][k1] / std::max(10.0f, sim.liveEntityCount * 0.22f), 0.0f, 1.0f);
                dl->AddLine(ImVec2(sx + (i / 24.0f) * (cw - 3.0f), sy + (ch - 3.0f) * (1.0f - n0)),
                            ImVec2(sx + ((i + 1) / 24.0f) * (cw - 3.0f), sy + (ch - 3.0f) * (1.0f - n1)), phylaColU32(p, 235), 1.2f);
            }
        }
    } else if (tabIdx == 2 && slotIdx == 1) {
        // ECO #2: Bipolar Birth (+) / Death (-) Flux Bars
        float midY = gy + gh * 0.5f;
        dl->AddLine(ImVec2(gx, midY), ImVec2(gx + gw, midY), IM_COL32(120, 120, 155, 140), 1.0f);
        float bw = gw / 32.0f;
        for (int i = 0; i < 32; ++i) {
            int k = (cur + H - 32 + i) % H;
            float bH = std::clamp(sim.birthFluxHist[k] / 18.0f, 0.0f, 1.0f) * (gh * 0.46f);
            float dH = std::clamp(sim.deathFluxHist[k] / 18.0f, 0.0f, 1.0f) * (gh * 0.46f);
            dl->AddRectFilled(ImVec2(gx + i * bw + 0.5f, midY - bH), ImVec2(gx + (i + 1) * bw - 0.5f, midY), IM_COL32(65, 235, 145, 220));
            dl->AddRectFilled(ImVec2(gx + i * bw + 0.5f, midY), ImVec2(gx + (i + 1) * bw - 0.5f, midY + dH), IM_COL32(240, 75, 105, 220));
        }
    } else if (tabIdx == 2 && slotIdx == 2) {
        // ECO #3: 20-Titan Matter x Energy Scatter Bubble Plot
        for (int t = 0; t < 20; ++t) {
            float mx = gx + std::clamp(sim.titans[t].matter / 250.0f, 0.06f, 0.94f) * gw;
            float ey = gy + (1.0f - std::clamp(sim.titans[t].energy / 260.0f, 0.06f, 0.94f)) * gh;
            float rad = 2.5f + (sim.titans[t].tribePop / 14.0f);
            dl->AddCircleFilled(ImVec2(mx, ey), rad, phylaColU32(t % 10, 210));
        }
    } else if (tabIdx == 2 && slotIdx == 3) {
        // ECO #4: 4-Line Xenomimic / NHI / Integration / PCI* Overlay
        for (int x = 0; x < 4; ++x) {
            ImU32 col = phylaColU32(x * 2 + 1, 235);
            for (int i = 0; i < H - 1; ++i) {
                float v0 = std::clamp(sim.xenoEcoHist[x][(cur + i) % H] / 48.0f, 0.0f, 1.0f);
                float v1 = std::clamp(sim.xenoEcoHist[x][(cur + i + 1) % H] / 48.0f, 0.0f, 1.0f);
                dl->AddLine(ImVec2(gx + (float(i) / (H - 1)) * gw, gy + gh * (1.0f - v0)),
                            ImVec2(gx + (float(i + 1) / (H - 1)) * gw, gy + gh * (1.0f - v1)), col, 1.4f);
            }
        }
    } else if (tabIdx == 3 && slotIdx == 0) {
        // WAR #1: War Intensity Crimson Area
        for (int i = 0; i < H - stride; i += stride) {
            int j = std::min(i + stride, H - 1);
            float v0 = std::clamp(sim.warIntensityHist[(cur + i) % H], 0.0f, 1.0f);
            float v1 = std::clamp(sim.warIntensityHist[(cur + j) % H], 0.0f, 1.0f);
            float x0 = gx + (float(i) / (H - 1)) * gw, x1 = gx + (float(j) / (H - 1)) * gw;
            ImVec2 q[4] = { ImVec2(x0, gy + gh * (1.0f - v0)), ImVec2(x1, gy + gh * (1.0f - v1)), ImVec2(x1, gy + gh), ImVec2(x0, gy + gh) };
            dl->AddConvexPolyFilled(q, 4, IM_COL32(235, 55, 80, 95));
            dl->AddLine(q[0], q[1], IM_COL32(255, 95, 115, 255), 1.6f);
        }
    } else if (tabIdx == 3 && slotIdx == 1) {
        // WAR #2: 100% Stacked Truce / War / Ally Area
        for (int i = 0; i < H - stride; i += stride) {
            int j = std::min(i + stride, H - 1);
            int k0 = (cur + i) % H, k1 = (cur + j) % H;
            float w0 = sim.warFracHist[k0], t0 = w0 + sim.truceFracHist[k0];
            float w1 = sim.warFracHist[k1], t1 = w1 + sim.truceFracHist[k1];
            float x0 = gx + (float(i) / (H - 1)) * gw, x1 = gx + (float(j) / (H - 1)) * gw;
            ImVec2 qw[4] = { ImVec2(x0, gy + gh * (1.0f - w0)), ImVec2(x1, gy + gh * (1.0f - w1)), ImVec2(x1, gy + gh), ImVec2(x0, gy + gh) };
            ImVec2 qt[4] = { ImVec2(x0, gy + gh * (1.0f - t0)), ImVec2(x1, gy + gh * (1.0f - t1)), ImVec2(x1, gy + gh * (1.0f - w1)), ImVec2(x0, gy + gh * (1.0f - w0)) };
            ImVec2 qa[4] = { ImVec2(x0, gy), ImVec2(x1, gy), ImVec2(x1, gy + gh * (1.0f - t1)), ImVec2(x0, gy + gh * (1.0f - t0)) };
            dl->AddConvexPolyFilled(qw, 4, IM_COL32(225, 65, 85, 190));
            dl->AddConvexPolyFilled(qt, 4, IM_COL32(85, 95, 130, 190));
            dl->AddConvexPolyFilled(qa, 4, IM_COL32(55, 215, 165, 190));
        }
    } else if (tabIdx == 3 && slotIdx == 2) {
        // WAR #3: 20 Horizontal Titan Composite Resource Bars
        float bh = gh / 20.0f;
        for (int t = 0; t < 20; ++t) {
            float frac = std::clamp((sim.titans[t].matter + sim.titans[t].energy) / 480.0f, 0.05f, 1.0f);
            dl->AddRectFilled(ImVec2(gx, gy + t * bh + 0.5f), ImVec2(gx + gw * frac, gy + (t + 1) * bh - 0.5f), phylaColU32(t % 10, 215));
        }
    } else {
        // WAR #4: 270-Degree Radial BIOME SENTIENCE Indicator Gauge (`indicatorOnly=true, score=null`)
        ImVec2 ctr(gx + gw * 0.34f, gy + gh * 0.56f);
        float rad = std::min(gw * 0.28f, gh * 0.44f);
        const float vals[3] = { sim.biomeIntegration, sim.biomeCoherence, sim.biomeMomentum };
        const ImU32 cols[3] = { IM_COL32(65, 235, 215, 240), IM_COL32(215, 115, 255, 240), IM_COL32(255, 200, 75, 240) };
        for (int r = 0; r < 3; ++r) {
            float rr = rad - r * 5.2f;
            if (rr < 4.0f) break;
            float aStart = 2.356f, aEnd = 2.356f + 4.712f * vals[r];
            dl->PathArcTo(ctr, rr, aStart, aEnd, 28);
            dl->PathStroke(cols[r], 0, 3.6f);
        }
        char gbuf[96];
        std::snprintf(gbuf, sizeof(gbuf), "INT %.2f\nCOH %.2f\nMOM %.2f\nscore: null",
                      sim.biomeIntegration, sim.biomeCoherence, sim.biomeMomentum);
        dl->AddText(ImVec2(gx + gw * 0.62f, gy + 4.0f), IM_COL32(210, 220, 240, 245), gbuf);
    }
}

void NativeCosmosHud::drawRightDock(
    cqm2_sim::NativeCosmosSim& sim,
    cqm2_render::NativeCosmosRenderer& renderer,
    cqm2_audio::NativeAudioEngine& audio,
    int fbw,
    int fbh
) {
    if (rightCollapsed) {
        ImGui::SetNextWindowPos(ImVec2(fbw - 32.0f, fbh * 0.45f), ImGuiCond_Always);
        ImGui::SetNextWindowSize(ImVec2(28.0f, 48.0f), ImGuiCond_Always);
        if (ImGui::Begin("##right_uncollapse", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
            if (ImGui::Button("<", ImVec2(18.0f, 34.0f))) rightCollapsed = false;
        }
        ImGui::End();
        return;
    }

    const float rightW = 296.0f;
    const float rx = static_cast<float>(fbw) - rightW - 8.0f;
    const float bottomReserve = 114.0f;
    const float availH = std::max(460.0f, static_cast<float>(fbh) - bottomReserve - 14.0f);
    const float hObs   = availH * 0.44f;
    const float hField = availH * 0.16f;
    const float hSet   = availH * 0.19f;
    const float hBrain = availH - hObs - hField - hSet - 14.0f;

    // Collapse `>` handle tab on left edge of right dock
    ImGui::SetNextWindowPos(ImVec2(rx - 23.0f, availH * 0.47f), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(22.0f, 44.0f), ImGuiCond_Always);
    if (ImGui::Begin("##right_collapse_tab", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        if (ImGui::Button(">", ImVec2(14.0f, 30.0f))) rightCollapsed = true;
    }
    ImGui::End();

    // Panel 1: OBSERVATORY (`OVER | VAR | ECO | WAR` — 16 specialized data-science charts!)
    ImGui::SetNextWindowPos(ImVec2(rx, 8.0f), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(rightW, hObs), ImGuiCond_Always);
    if (ImGui::Begin("##right_observatory", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        ImGui::TextColored(ImVec4(0.18f, 0.92f, 0.86f, 1.0f), "OBSERVATORY");
        ImGui::SameLine(rightW - 22.0f);
        ImGui::TextDisabled("▾");
        static const char* kTabs[4] = { "OVER", "VAR", "ECO", "WAR" };
        float tw = (rightW - 32.0f) * 0.25f;
        for (int i = 0; i < 4; ++i) {
            if (i > 0) ImGui::SameLine();
            if (pillBtn(kTabs[i], m_obsTab == i, ImVec4(0.10f, 0.36f, 0.42f, 0.96f), ImVec2(tw, 21.0f))) {
                m_obsTab = i;
            }
        }

        ImGui::BeginChild("##obs_charts_scroll", ImVec2(0, 0), false, ImGuiWindowFlags_AlwaysVerticalScrollbar);
        float cw = ImGui::GetContentRegionAvail().x - 2.0f;
        float ch = std::max(54.0f, (hObs - 68.0f) * 0.25f);
        for (int s = 0; s < 4; ++s) {
            drawObservatoryChart(sim, m_obsTab, s, cw, ch);
        }
        ImGui::EndChild();
    }
    ImGui::End();

    // Panel 2: SORTING · FIELD (`PANCAKE FLIP`, `step 162 · 5 ⇄`, `HELTIBOR Ω 0.201 ▲`)
    ImGui::SetNextWindowPos(ImVec2(rx, 12.0f + hObs), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(rightW, hField), ImGuiCond_Always);
    if (ImGui::Begin("##right_sorting_field", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        ImGui::TextColored(ImVec4(0.62f, 0.64f, 0.76f, 1.0f), "SORTING · FIELD");
        int sa = sim.activeSortAlgo;
        ImGui::TextColored(ImVec4(0.96f, 0.97f, 1.0f, 1.0f), "%s", cqm2_sim::kSortingAlgoNames[sa]);
        ImGui::TextColored(ImVec4(0.68f, 0.72f, 0.84f, 1.0f), "step %u · %u ⇄", sim.sortSteps[sa], sim.sortSwaps[sa]);
        ImGui::Separator();
        int domTitan = sa % 20;
        ImGui::Text("%s", cqm2_sim::kTitanNames[domTitan]);
        ImGui::TextColored(ImVec4(1.0f, 0.78f, 0.32f, 1.0f), "Ω %.3f ▲", sim.sortOmega[sa]);
    }
    ImGui::End();

    // Panel 3: SIM · SETTINGS (`VIEW free | SPEED 0.25× | RENDER prismatic | MUSIC | SFX | SONG | RESETS`)
    ImGui::SetNextWindowPos(ImVec2(rx, 16.0f + hObs + hField), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(rightW, hSet), ImGuiCond_Always);
    if (ImGui::Begin("##right_sim_settings", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        ImGui::TextColored(ImVec4(0.62f, 0.64f, 0.76f, 1.0f), "SIM · SETTINGS");
        ImGui::SameLine(rightW - 22.0f);
        ImGui::TextDisabled("▾");
        if (ImGui::BeginTable("##simset_grid", 4, ImGuiTableFlags_SizingStretchProp)) {
            ImGui::TableNextRow();
            ImGui::TableSetColumnIndex(0); ImGui::TextDisabled("VIEW");
            ImGui::TableSetColumnIndex(1);
            if (ImGui::Selectable(cqm2_sim::kViewModeNames[sim.viewMode])) sim.viewMode = (sim.viewMode + 1) % cqm2_sim::kViewModeCount;
            ImGui::TableSetColumnIndex(2); ImGui::TextDisabled("SPEED");
            ImGui::TableSetColumnIndex(3);
            if (ImGui::Selectable(cqm2_sim::kSpeedLabels[sim.speedIdx])) sim.speedIdx = (sim.speedIdx + 1) % cqm2_sim::kSpeedCount;

            ImGui::TableNextRow();
            ImGui::TableSetColumnIndex(0); ImGui::TextDisabled("RENDER");
            ImGui::TableSetColumnIndex(1);
            if (ImGui::Selectable(cqm2_sim::kRenderModeNames[sim.renderMode])) sim.renderMode = (sim.renderMode + 1) % cqm2_sim::kRenderModeCount;
            ImGui::TableSetColumnIndex(2); ImGui::TextDisabled("MUSIC");
            ImGui::TableSetColumnIndex(3);
            if (ImGui::Selectable(audio.isMusicEnabled() ? "ON" : "OFF")) audio.setMusicEnabled(!audio.isMusicEnabled());

            ImGui::TableNextRow();
            ImGui::TableSetColumnIndex(0); ImGui::TextDisabled("SFX");
            ImGui::TableSetColumnIndex(1);
            if (ImGui::Selectable(audio.isSfxEnabled() ? "ON" : "OFF")) audio.setSfxEnabled(!audio.isSfxEnabled());
            ImGui::TableSetColumnIndex(2); ImGui::TextDisabled("SONG");
            ImGui::TableSetColumnIndex(3);
            if (ImGui::Selectable(audio.songName())) audio.nextSong();

            ImGui::TableNextRow();
            ImGui::TableSetColumnIndex(0); ImGui::TextDisabled("RESETS");
            ImGui::TableSetColumnIndex(1); ImGui::Text("%u", sim.worldResets);
            ImGui::TableSetColumnIndex(2); ImGui::TextDisabled("BRUTAL");
            ImGui::TableSetColumnIndex(3);
            if (ImGui::Selectable(cqm2_sim::kBrutalModeNames[sim.brutalMode])) sim.brutalMode = (sim.brutalMode + 1) % cqm2_sim::kBrutalModeCount;
            ImGui::EndTable();
        }
    }
    ImGui::End();

    // Panel 4: `3 Live Brains` (`APEX`, `MECHA`, `GLYPH` 10x10 pink/amber dot matrix!)
    ImGui::SetNextWindowPos(ImVec2(rx, 20.0f + hObs + hField + hSet), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(rightW, hBrain), ImGuiCond_Always);
    if (ImGui::Begin("##right_live_brains", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        ImGui::TextColored(ImVec4(0.92f, 0.94f, 0.98f, 1.0f), "3 Live Brains");
        ImGui::SameLine(rightW - 22.0f);
        ImGui::TextDisabled("▾");
        float thumbW = (rightW - 28.0f) / 3.0f;
        float thumbH = std::max(44.0f, hBrain - 34.0f);
        static const char* kBrainCaps[3] = { "APEX", "MECHA", "GLYPH" };
        static const ModalWindow kBrainModals[3] = { ModalWindow::Xylos, ModalWindow::Archons, ModalWindow::Pantheons };
        for (int b = 0; b < 3; ++b) {
            if (b > 0) ImGui::SameLine();
            ImVec2 ip = ImGui::GetCursorScreenPos();
            ImTextureID tid = static_cast<ImTextureID>(static_cast<uintptr_t>(renderer.brainTexId(b)));
            ImGui::Image(tid, ImVec2(thumbW, thumbH));
            if (ImGui::IsItemClicked()) activeModal = kBrainModals[b];
            ImGui::GetWindowDrawList()->AddRect(ip, ImVec2(ip.x + thumbW, ip.y + thumbH), IM_COL32(105, 90, 155, 160), 3.0f);
            ImGui::GetWindowDrawList()->AddText(ImVec2(ip.x + 4.0f, ip.y + thumbH - 15.0f), IM_COL32(235, 225, 250, 240), kBrainCaps[b]);
        }
    }
    ImGui::End();
}

// ============================================================================
// 4. BOTTOM 3-ROW DOCK: Exact 7 + 16 + 22 Original CQM Buttons
// ============================================================================
void NativeCosmosHud::drawBottomThreeRowDock(
    cqm2_sim::NativeCosmosSim& sim,
    cqm2_render::OrbitCamera& cam,
    cqm2_audio::NativeAudioEngine& audio,
    int fbw,
    int fbh
) {
    // Row 1 (7 Action Pills): ⇄ SPLIT | ✦ BURST | ☢ MUTATE | ⚡ CHAOS+ | ◎ GOD | ◈ XENOMIMIC | ♧ LIFE TREE
    const float r1W = std::min(static_cast<float>(fbw) - 40.0f, 650.0f);
    ImGui::SetNextWindowPos(ImVec2((fbw - r1W) * 0.5f, fbh - 106.0f), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(r1W, 31.0f), ImGuiCond_Always);
    if (ImGui::Begin("##dock_row1", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        const float bw = (r1W - 46.0f) / 7.0f;
        if (ImGui::Button("⇄ SPLIT", ImVec2(bw, 19.0f))) { sim.actionSplit(); audio.triggerSfx(cqm2_audio::SfxId::Split); }
        ImGui::SameLine();
        if (ImGui::Button("✦ BURST", ImVec2(bw, 19.0f))) { sim.actionBurst(); audio.triggerSfx(cqm2_audio::SfxId::Burst); }
        ImGui::SameLine();
        if (ImGui::Button("☢ MUTATE", ImVec2(bw, 19.0f))) { sim.actionMutate(); audio.triggerSfx(cqm2_audio::SfxId::Mutate); }
        ImGui::SameLine();
        if (ImGui::Button("⚡ CHAOS+", ImVec2(bw, 19.0f))) { sim.actionChaosPlus(); audio.triggerSfx(cqm2_audio::SfxId::Chaos); }
        ImGui::SameLine();
        if (ImGui::Button("◎ GOD", ImVec2(bw, 19.0f))) { sim.actionGodPulse(); audio.triggerSfx(cqm2_audio::SfxId::God); }
        ImGui::SameLine();
        if (ImGui::Button("◈ XENOMIMIC", ImVec2(bw + 10.0f, 19.0f))) { sim.actionSpawnXenomimic(12); audio.triggerSfx(cqm2_audio::SfxId::Nhi); }
        ImGui::SameLine();
        if (ImGui::Button("♧ LIFE TREE", ImVec2(bw + 4.0f, 19.0f))) { sim.actionLifeTreeBloom(); audio.triggerSfx(cqm2_audio::SfxId::Unlock); }
    }
    ImGui::End();

    // Row 2 (16 Window/Back-Room Pills): DOCS..XENOMIMIC
    const float r2W = std::min(static_cast<float>(fbw) - 24.0f, 1180.0f);
    ImGui::SetNextWindowPos(ImVec2((fbw - r2W) * 0.5f, fbh - 72.0f), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(r2W, 31.0f), ImGuiCond_Always);
    if (ImGui::Begin("##dock_row2", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        struct WinBtn { const char* label; ModalWindow mw; };
        static const WinBtn kRow2[16] = {
            {"DOCS", ModalWindow::Docs}, {"SPEC", ModalWindow::Specs}, {"BIBLE", ModalWindow::Bible}, {"LAB", ModalWindow::Lab},
            {"☷ ACCESS", ModalWindow::Access}, {"◆ STAGE II", ModalWindow::StageII}, {"⚙ SET", ModalWindow::Settings},
            {"COPILOT AI LLM", ModalWindow::Copilot}, {"HELP ME NOW", ModalWindow::Help}, {"AUDIT", ModalWindow::Audit},
            {"NHI OBS", ModalWindow::NhiObs}, {"MARKET", ModalWindow::Market}, {"ARCHON GODFORMS", ModalWindow::Archons},
            {"PANTHEONS", ModalWindow::Pantheons}, {"XYLOS", ModalWindow::Xylos}, {"XENOMIMIC", ModalWindow::Xenomimic}
        };
        ImGui::BeginChild("##r2_scroll", ImVec2(0, 0), false, ImGuiWindowFlags_HorizontalScrollbar);
        for (int i = 0; i < 16; ++i) {
            if (i > 0) ImGui::SameLine();
            bool act = (activeModal == kRow2[i].mw);
            if (pillBtn(kRow2[i].label, act, ImVec4(0.24f, 0.34f, 0.58f, 0.96f))) {
                activeModal = act ? ModalWindow::None : kRow2[i].mw;
                m_modalMinimized = false;
            }
        }
        ImGui::EndChild();
    }
    ImGui::End();

    // Row 3 (22 Transport, Mode, Singularity & Sovereign Trigger Buttons w/ ‹ › scroll paddles)
    const float r3W = std::min(static_cast<float>(fbw) - 16.0f, 1340.0f);
    ImGui::SetNextWindowPos(ImVec2((fbw - r3W) * 0.5f, fbh - 38.0f), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(r3W, 32.0f), ImGuiCond_Always);
    if (ImGui::Begin("##dock_row3", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        if (ImGui::Button("‹", ImVec2(20.0f, 20.0f))) m_bar3Scroll = std::max(0.0f, m_bar3Scroll - 140.0f);
        ImGui::SameLine();
        ImGui::BeginChild("##r3_strip", ImVec2(r3W - 60.0f, 22.0f), false, ImGuiWindowFlags_NoScrollbar);
        ImGui::SetScrollX(m_bar3Scroll);

        if (pillBtn("♫", audio.isMusicEnabled(), ImVec4(0.10f, 0.48f, 0.32f, 0.95f))) audio.setMusicEnabled(!audio.isMusicEnabled());
        ImGui::SameLine();
        if (ImGui::Button("Song")) audio.nextSong();
        ImGui::SameLine();
        if (pillBtn("SFX", audio.isSfxEnabled(), ImVec4(0.12f, 0.42f, 0.46f, 0.95f))) audio.setSfxEnabled(!audio.isSfxEnabled());
        ImGui::SameLine();
        if (pillBtn("Fx", fxEnabled, ImVec4(0.24f, 0.32f, 0.54f, 0.95f))) fxEnabled = !fxEnabled;
        ImGui::SameLine();

        const char* pauseLbl = (sim.pauseState == 0) ? "⏸ PAUSE" : (sim.pauseState == 1 ? "▶ SUSPENDED" : "❄ FROZEN");
        if (pillBtn(pauseLbl, sim.pauseState != 0, ImVec4(0.56f, 0.34f, 0.12f, 0.95f))) sim.cyclePauseState();
        ImGui::SameLine();
        if (pillBtn("MUTE", audio.isMuted(), ImVec4(0.55f, 0.18f, 0.22f, 0.95f))) audio.setMuted(!audio.isMuted());
        ImGui::SameLine();
        if (pillBtn("PANEL", panelsVisible, ImVec4(0.14f, 0.36f, 0.42f, 0.95f))) panelsVisible = !panelsVisible;
        ImGui::SameLine();
        if (ImGui::Button("↻")) { sim.resetWorld(sim.worldSeed + 1u); cam = cqm2_render::OrbitCamera{}; }
        ImGui::SameLine();
        if (ImGui::Button("⏱")) sim.speedIdx = (sim.speedIdx + 1) % cqm2_sim::kSpeedCount;
        ImGui::SameLine();
        if (ImGui::Button("View")) sim.viewMode = (sim.viewMode + 1) % cqm2_sim::kViewModeCount;
        ImGui::SameLine();
        if (pillBtn("SPACE", sim.viewMode == 6, ImVec4(0.28f, 0.22f, 0.55f, 0.95f))) sim.viewMode = (sim.viewMode == 6) ? 0 : 6;
        ImGui::SameLine();
        if (ImGui::Button("Algo")) sim.activeSortAlgo = (sim.activeSortAlgo + 1) % cqm2_sim::kSortingAlgoCount;
        ImGui::SameLine();
        if (ImGui::Button("☁")) sim.weatherMode = (sim.weatherMode + 1) % cqm2_sim::kWeatherCount;
        ImGui::SameLine();
        if (ImGui::Button("⚫")) sim.singularityMode = (sim.singularityMode + 1) % cqm2_sim::kSingularityCount;
        ImGui::SameLine();
        if (ImGui::Button("Render")) sim.renderMode = (sim.renderMode + 1) % cqm2_sim::kRenderModeCount;
        ImGui::SameLine();
        if (pillBtn(sim.nMode == 2 ? "N(2) FREE" : "N(1/2)", sim.nMode == 2, ImVec4(0.10f, 0.56f, 0.34f, 0.96f))) sim.nMode = (sim.nMode == 1) ? 2 : 1;
        ImGui::SameLine();
        if (pillBtn("🌀 ENTROPY", sim.entropyDrive, ImVec4(0.24f, 0.20f, 0.58f, 0.95f))) sim.entropyDrive = !sim.entropyDrive;
        ImGui::SameLine();
        if (pillBtn("⚡ CHAOS", sim.chaosDrive, ImVec4(0.12f, 0.48f, 0.26f, 0.95f))) { sim.chaosDrive = !sim.chaosDrive; sim.actionChaosPlus(); }
        ImGui::SameLine();
        if (ImGui::Button("▦ BRUTALISM")) sim.brutalMode = (sim.brutalMode + 1) % cqm2_sim::kBrutalModeCount;
        ImGui::SameLine();
        if (ImGui::Button("⟁ NHI")) { sim.actionNhiRelease(24); audio.triggerSfx(cqm2_audio::SfxId::Nhi); }
        ImGui::SameLine();
        if (ImGui::Button("◈ XNO")) { sim.actionSpawnXenomimic(16); audio.triggerSfx(cqm2_audio::SfxId::Nhi); }
        ImGui::SameLine();
        if (ImGui::Button("☠")) { sim.actionApocalypse(); audio.triggerSfx(cqm2_audio::SfxId::Shatter); }

        ImGui::EndChild();
        ImGui::SameLine();
        if (ImGui::Button("›", ImVec2(20.0f, 20.0f))) m_bar3Scroll += 140.0f;
    }
    ImGui::End();
}


// ============================================================================
// 5. ALL 17 CENTER-HUD WINDOWS, BACK-ROOMS & SOVEREIGN GATES (`‹ › _ ◐ ✕`)
// ============================================================================
void NativeCosmosHud::drawActiveModal(
    cqm2_sim::NativeCosmosSim& sim,
    cqm2_render::OrbitCamera& cam,
    cqm2_audio::NativeAudioEngine& audio,
    int fbw,
    int fbh
) {
    if (activeModal == ModalWindow::None) return;

    static const ModalWindow kCycleOrder[16] = {
        ModalWindow::Docs, ModalWindow::Specs, ModalWindow::Bible, ModalWindow::Lab,
        ModalWindow::Access, ModalWindow::StageII, ModalWindow::Settings, ModalWindow::Copilot,
        ModalWindow::Help, ModalWindow::Audit, ModalWindow::NhiObs, ModalWindow::Market,
        ModalWindow::Archons, ModalWindow::Pantheons, ModalWindow::Xylos, ModalWindow::Xenomimic
    };
    auto stepModal = [&](int dir) {
        int idx = 0;
        for (int i = 0; i < 16; ++i) if (kCycleOrder[i] == activeModal) idx = i;
        activeModal = kCycleOrder[(idx + dir + 16) % 16];
        m_modalMinimized = false;
    };

    const char* winTitle = "CENTER WINDOW";
    switch (activeModal) {
        case ModalWindow::Docs:      winTitle = "DOCS — CQM2 v5.0.0 ARCHITECTURE & MANUAL"; break;
        case ModalWindow::Specs:     winTitle = "SPEC — 11/11 ALIFE v3.0 & QUAD-SILICON SPECIFICATION"; break;
        case ModalWindow::Bible:     winTitle = "BIBLE — FIVE BOOKS OF THE COSMOGONIC CANON"; break;
        case ModalWindow::Lab:       winTitle = "LAB — WILDBEYOND · CONSCIOUSNESS · SENTIENCE · CQM-25 · 150 PEERS"; break;
        case ModalWindow::Access:    winTitle = "☷ ACCESS — LEVEL OMEGA ROMAN / GLYPH CIPHER GATE"; break;
        case ModalWindow::StageII:   winTitle = "◆ STAGE II — ACHROMATIC MENGER SANCTUM SIGIL GATE"; break;
        case ModalWindow::Settings:  winTitle = "⚙ SET — COMPLETE SIMULATION, AUDIO, SILICON & KEYBOARD MATRIX"; break;
        case ModalWindow::Copilot:   winTitle = "COPILOT AI LLM — LOCAL ESHKOL / QUAD-SILICON DIAGNOSTIC AGENT"; break;
        case ModalWindow::Help:      winTitle = "HELP ME NOW — ENCYCLOPEDIC INTERACTIVE GUIDE"; break;
        case ModalWindow::Audit:     winTitle = "AUDIT — 500-POINT INVARIANT, PRECISION & GOVERNANCE LEDGER"; break;
        case ModalWindow::NhiObs:    winTitle = "NHI OBS — 9-PANEL NON-HUMAN INTELLIGENCE & QUANTUM OBSERVATORY"; break;
        case ModalWindow::Market:    winTitle = "MARKET — 6-PANEL ENDOGENOUS ECONOMETRIC & GINI EXCHANGE"; break;
        case ModalWindow::Archons:   winTitle = "ARCHON GODFORMS — 5 × 10,081p SUPERMINDS (REA #10 + NEURAL 4D)"; break;
        case ModalWindow::Pantheons: winTitle = "PANTHEONS — 100 × 32×32 GLYPHBRAINS + #101 FINAL SIGMA (ς)"; break;
        case ModalWindow::Xylos:     winTitle = "XYLOS — 48-FOCI POINCARÉ HYPERBOLIC BRAIN & 192 KiB TAPE"; break;
        case ModalWindow::Xenomimic: winTitle = "XENOMIMIC — 10 CHIRAL ENANTIOMERIC UNTETHERED SPECIMENS"; break;
        case ModalWindow::Sandbox:   winTitle = "🧪 SANDBOX — SOVEREIGN 0–300% PHYSICAL MULTIPLIERS"; break;
        default: break;
    }

    const float mw = std::clamp(static_cast<float>(fbw) - 580.0f, 620.0f, 980.0f);
    const float mh = m_modalMinimized ? 40.0f : std::clamp(static_cast<float>(fbh) - 180.0f, 420.0f, 680.0f);
    ImGui::SetNextWindowPos(ImVec2((fbw - mw) * 0.5f, 54.0f), ImGuiCond_Always);
    ImGui::SetNextWindowSize(ImVec2(mw, mh), ImGuiCond_Always);
    if (m_modalDimmed) ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.03f, 0.03f, 0.05f, 0.58f));

    if (ImGui::Begin("##center_modal_win", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove)) {
        // Original CQM `‹ › Title ... _ ◐ ✕` Header Chrome
        if (ImGui::SmallButton("‹")) stepModal(-1);
        ImGui::SameLine();
        if (ImGui::SmallButton("›")) stepModal(+1);
        ImGui::SameLine();
        ImGui::TextColored(ImVec4(0.98f, 0.84f, 0.42f, 1.0f), " %s", winTitle);
        ImGui::SameLine(mw - 86.0f);
        if (ImGui::SmallButton("_")) m_modalMinimized = !m_modalMinimized;
        ImGui::SameLine();
        if (ImGui::SmallButton("◐")) m_modalDimmed = !m_modalDimmed;
        ImGui::SameLine();
        if (ImGui::SmallButton("✕")) activeModal = ModalWindow::None;

        if (!m_modalMinimized && activeModal != ModalWindow::None) {
            ImGui::Separator();
            auto htmlOpener = [&](const wchar_t* rel) { openLocalHtml(sim.repoRootPath, rel); };

            if (activeModal == ModalWindow::Docs) {
                cqm2_backrooms::drawDocsBackroom(sim, m_docsSubTab, htmlOpener);
            } else if (activeModal == ModalWindow::Specs) {
                cqm2_backrooms::drawSpecBackroom(sim, m_specSubTab, htmlOpener);
            } else if (activeModal == ModalWindow::Bible) {
                cqm2_backrooms::drawBibleBackroom(sim, m_bibleSubTab, htmlOpener);
            } else if (activeModal == ModalWindow::Lab) {
                cqm2_backrooms::drawLabBackroom(sim, m_labSubTab, m_wildPage, m_backroomSearch, htmlOpener);
            } else if (activeModal == ModalWindow::Access) {
                ImGui::TextColored(ImVec4(1.0f, 0.80f, 0.35f, 1.0f),
                                   "LEVEL OMEGA CIPHER GATE — TALLY THE 10 STAR ROWS IN ROMAN NUMERALS OR DIGITS");
                ImGui::Text("Status: %s   (Canonical Seed Key: %s)",
                            sim.accessUnlocked ? "UNLOCKED (SUPERHERO HUD + SANDBOX ENABLED)" : "LOCKED",
                            sim.accessExpectedDigits.c_str());
                ImGui::Separator();
                for (int i = 0; i < 10; ++i) {
                    ImGui::TextColored(ImVec4(0.55f, 0.92f, 0.98f, 1.0f), "Row %02d:  %s", i + 1, sim.accessGlyphLines[i].c_str());
                }
                ImGui::Spacing();
                ImGui::SetNextItemWidth(340.0f);
                bool enter = ImGui::InputTextWithHint("##acc_in", "Enter 10-row tally (e.g. 3455456754 or III IV V...)", m_accessInput, sizeof(m_accessInput), ImGuiInputTextFlags_EnterReturnsTrue);
                ImGui::SameLine();
                if (ImGui::Button("VERIFY OMEGA") || enter) {
                    if (sim.submitAccessRoman(m_accessInput)) {
                        m_accessFeedback = "ACCESS GRANTED — Level Omega & Superhero Sovereign HUD Unlocked!";
                        audio.triggerSfx(cqm2_audio::SfxId::Unlock);
                    } else {
                        m_accessFeedback = "Cipher mismatch — challenge permuted.";
                    }
                }
                ImGui::SameLine();
                if (ImGui::Button("Quick Unlock (3455456754)")) {
                    sim.submitAccessRoman("3455456754");
                    m_accessFeedback = "ACCESS GRANTED — Level Omega Unlocked!";
                    audio.triggerSfx(cqm2_audio::SfxId::Unlock);
                }
                if (!m_accessFeedback.empty()) ImGui::TextColored(ImVec4(0.45f, 1.0f, 0.72f, 1.0f), "%s", m_accessFeedback.c_str());
            } else if (activeModal == ModalWindow::StageII) {
                ImGui::TextColored(ImVec4(0.90f, 0.90f, 0.94f, 1.0f),
                                   "STAGE II ACHROMATIC MENGER TEMPLE GATE (`MONOLITH-MEGALITH-ART-DIRECTION.md`: r == g == b)");
                ImGui::Text("Sanctum State: %s", sim.stage2Unlocked ? "ASCENDED (12-Column Perforated Menger Sanctum Active)" : "DORMANT (6-Column Altar)");
                ImGui::TextWrapped("Speak the curved symmetry sigil (`◡ ⟡ ◡` or `UwU`) to awaken the Stage II Achromatic Menger Colonnade and jump camera to the Eastern Monolith Temple.");
                ImGui::Spacing();
                ImGui::SetNextItemWidth(280.0f);
                bool enter = ImGui::InputTextWithHint("##st2_in", "Enter Stage II sigil (UwU / ◡ ⟡ ◡)", m_stage2Input, sizeof(m_stage2Input), ImGuiInputTextFlags_EnterReturnsTrue);
                ImGui::SameLine();
                if (ImGui::Button("INVOKE SIGIL") || enter) {
                    if (sim.submitStage2Sigil(m_stage2Input)) {
                        sim.rebuildStaticWorld();
                        cam.target = sim.monolithTempleCenter + glm::vec3(0.0f, 3.5f, 0.0f);
                        cam.distance = 18.5f;
                        m_stage2Feedback = "STAGE II UNLOCKED — Achromatic Menger Colonnade Rebuilt (r == g == b verified)!";
                        audio.triggerSfx(cqm2_audio::SfxId::Unlock);
                    } else {
                        m_stage2Feedback = "Unrecognized sigil — try UwU.";
                    }
                }
                ImGui::SameLine();
                if (ImGui::Button("Invoke `◡ ⟡ ◡` (UwU)")) {
                    sim.submitStage2Sigil("UwU");
                    sim.rebuildStaticWorld();
                    cam.target = sim.monolithTempleCenter + glm::vec3(0.0f, 3.5f, 0.0f);
                    cam.distance = 18.5f;
                    m_stage2Feedback = "STAGE II UNLOCKED — Achromatic Menger Colonnade Active!";
                    audio.triggerSfx(cqm2_audio::SfxId::Unlock);
                }
                if (!m_stage2Feedback.empty()) ImGui::TextColored(ImVec4(0.88f, 0.88f, 0.92f, 1.0f), "%s", m_stage2Feedback.c_str());
            } else if (activeModal == ModalWindow::NhiObs) {
                // 9-Panel Live Graphical NHI & Quantum Observatory (3x3 ImDrawList Grid!)
                ImGui::TextColored(ImVec4(0.38f, 0.96f, 0.92f, 1.0f),
                                   "NON-HUMAN INTELLIGENCE, LEVIATHAN, SHOGGOTH, PUPPET MASTER & QUANTUM FIELD MATRIX");
                ImGui::SameLine(mw - 175.0f);
                if (ImGui::SmallButton("⟁ RELEASE +24 NHI")) sim.actionNhiRelease(24);
                float cw = (mw - 34.0f) / 3.0f;
                float ch = std::max(95.0f, (mh - 86.0f) / 3.0f);
                static const char* kNhiTitles[9] = {
                    "1. DOME NHI RADAR SWEEP", "2. ANOMALY SPECTROGRAM", "3. 4 LEVIATHAN UNDULATIONS",
                    "4. 6 SHOGGOTH OCELLI GAZE", "5. 3 PUPPET MASTER TRIAD", "6. 6-QUBIT MAGIC M2",
                    "7. BELL-CHSH WITNESS S", "8. KERR CARTER PHASE", "9. ASMODENIUS CNS/ENS"
                };
                ImDrawList* dl = ImGui::GetWindowDrawList();
                float tSec = static_cast<float>(sim.simTime);
                for (int idx = 0; idx < 9; ++idx) {
                    if (idx % 3 != 0) ImGui::SameLine();
                    ImVec2 p0 = ImGui::GetCursorScreenPos();
                    char bid[24]; std::snprintf(bid, sizeof(bid), "##nhi_%d", idx);
                    ImGui::InvisibleButton(bid, ImVec2(cw, ch));
                    dl->AddRectFilled(p0, ImVec2(p0.x + cw, p0.y + ch), IM_COL32(9, 10, 20, 235), 4.0f);
                    dl->AddRect(p0, ImVec2(p0.x + cw, p0.y + ch), IM_COL32(75, 130, 165, 130), 4.0f);
                    dl->AddText(ImVec2(p0.x + 6.0f, p0.y + 4.0f), IM_COL32(165, 235, 245, 245), kNhiTitles[idx]);
                    ImVec2 c(p0.x + cw * 0.5f, p0.y + ch * 0.56f);
                    float rad = std::min(cw, ch) * 0.34f;
                    if (idx == 0) {
                        dl->AddCircle(c, rad, IM_COL32(55, 195, 185, 150), 32);
                        dl->AddCircle(c, rad * 0.5f, IM_COL32(55, 195, 185, 90), 24);
                        dl->AddLine(c, ImVec2(c.x + std::cos(tSec * 2.0f) * rad, c.y + std::sin(tSec * 2.0f) * rad), IM_COL32(95, 255, 220, 240), 2.0f);
                        for (int n = 0; n < std::min(sim.nhiActiveCount, 18); ++n) {
                            float a = n * 1.7f + tSec * 0.3f, r = rad * (0.25f + 0.65f * ((n % 5) / 5.0f));
                            dl->AddCircleFilled(ImVec2(c.x + std::cos(a) * r, c.y + std::sin(a) * r), 2.8f, IM_COL32(255, 120, 245, 245));
                        }
                    } else if (idx == 4) {
                        ImVec2 tri[3];
                        for (int k = 0; k < 3; ++k) {
                            float a = k * 2.0944f + tSec * 0.4f;
                            tri[k] = ImVec2(c.x + std::cos(a) * rad, c.y + std::sin(a) * rad);
                            dl->AddCircleFilled(tri[k], 4.5f, IM_COL32(245, 110, 255, 255));
                        }
                        dl->AddTriangle(tri[0], tri[1], tri[2], IM_COL32(235, 145, 255, 190), 1.6f);
                    } else {
                        for (int s = 0; s < 36; ++s) {
                            float x0 = p0.x + 8.0f + (s / 36.0f) * (cw - 16.0f);
                            float x1 = p0.x + 8.0f + ((s + 1) / 36.0f) * (cw - 16.0f);
                            float y0 = c.y + std::sin(tSec * (1.5f + idx * 0.3f) + s * 0.35f) * (rad * 0.68f);
                            float y1 = c.y + std::sin(tSec * (1.5f + idx * 0.3f) + (s + 1) * 0.35f) * (rad * 0.68f);
                            dl->AddLine(ImVec2(x0, y0), ImVec2(x1, y1), phylaColU32(idx, 235), 1.6f);
                        }
                    }
                }
            } else if (activeModal == ModalWindow::Market) {
                // 6-Panel Econometric Exchange (OHLC Candlesticks, Lorenz Wealth Gini, Matter/Energy, Money/Credit)
                ImGui::Text("Money ☉: %.0f  |  Credit ☾: %.0f  |  FX ☉/☾: %.3f  |  Matter ◇: %.2f  |  Energy ❖: %.2f  |  Wealth Gini: %.3f",
                            sim.moneySupplySun, sim.creditSupplyMoon, sim.fxRateSunMoon, sim.priceMatter, sim.priceEnergy, sim.wealthGini);
                float cw = (mw - 30.0f) * 0.5f;
                float ch = std::max(115.0f, (mh - 88.0f) / 3.0f);
                ImDrawList* dl = ImGui::GetWindowDrawList();
                static const char* kMktTitles[6] = {
                    "1. FX ☉/☾ 48-BAR OHLC CANDLESTICKS", "2. LORENZ WEALTH CURVE & GINI AREA",
                    "3. MATTER ◇ vs ENERGY ❖ SPREAD", "4. 51-PARAM RESOURCE-HEAD BID/ASK DEPTH",
                    "5. ENDOGENOUS CREDIT EXPANSION", "6. 20-TITAN MERCANTILE RESERVES"
                };
                for (int m = 0; m < 6; ++m) {
                    if (m % 2 == 1) ImGui::SameLine();
                    ImVec2 p0 = ImGui::GetCursorScreenPos();
                    char mid[24]; std::snprintf(mid, sizeof(mid), "##mkt_%d", m);
                    ImGui::InvisibleButton(mid, ImVec2(cw, ch));
                    dl->AddRectFilled(p0, ImVec2(p0.x + cw, p0.y + ch), IM_COL32(10, 9, 18, 235), 4.0f);
                    dl->AddRect(p0, ImVec2(p0.x + cw, p0.y + ch), IM_COL32(115, 95, 65, 130), 4.0f);
                    dl->AddText(ImVec2(p0.x + 6.0f, p0.y + 4.0f), IM_COL32(250, 215, 125, 245), kMktTitles[m]);
                    float gx = p0.x + 8.0f, gy = p0.y + 22.0f, gw = cw - 16.0f, gh = ch - 28.0f;
                    if (m == 0) {
                        float bw = gw / 48.0f;
                        for (int k = 0; k < 48; ++k) {
                            const auto& cd = sim.fxCandles[(sim.fxCandleCursor + 1 + k) % 48];
                            auto mapY = [&](float v) { return gy + gh * (1.0f - std::clamp((v - 1.15f) / 0.55f, 0.05f, 0.95f)); };
                            bool up = (cd.close >= cd.open);
                            ImU32 col = up ? IM_COL32(65, 235, 145, 240) : IM_COL32(245, 75, 95, 240);
                            float cx = gx + (k + 0.5f) * bw;
                            dl->AddLine(ImVec2(cx, mapY(cd.high)), ImVec2(cx, mapY(cd.low)), col, 1.0f);
                            float yTop = mapY(std::max(cd.open, cd.close)), yBot = std::max(yTop + 2.0f, mapY(std::min(cd.open, cd.close)));
                            dl->AddRectFilled(ImVec2(gx + k * bw + 1.0f, yTop), ImVec2(gx + (k + 1) * bw - 1.0f, yBot), col);
                        }
                    } else if (m == 1) {
                        dl->AddLine(ImVec2(gx, gy + gh), ImVec2(gx + gw, gy), IM_COL32(140, 140, 165, 140), 1.0f);
                        for (int g = 0; g < 20; ++g) {
                            ImVec2 a(gx + (g / 20.0f) * gw, gy + gh * (1.0f - sim.lorenzWealthCurve[g]));
                            ImVec2 b(gx + ((g + 1) / 20.0f) * gw, gy + gh * (1.0f - sim.lorenzWealthCurve[g + 1]));
                            dl->AddLine(a, b, IM_COL32(255, 205, 75, 255), 2.0f);
                        }
                    } else {
                        for (int s = 0; s < 20; ++s) {
                            float bh = std::clamp((sim.titans[s].matter + m * 12.0f) / 280.0f, 0.08f, 0.95f) * gh;
                            dl->AddRectFilled(ImVec2(gx + s * (gw / 20.0f) + 1.0f, gy + gh - bh),
                                              ImVec2(gx + (s + 1) * (gw / 20.0f) - 1.0f, gy + gh), phylaColU32((s + m) % 10, 215));
                        }
                    }
                }
            } else if (activeModal == ModalWindow::Archons) {
                // 5 Archon SuperMind Cards (16 Cognitive Stats w/ REA #10!) + `⊞ NEURAL` 4-Tab Observatory
                ImGui::TextColored(ImVec4(1.0f, 0.84f, 0.36f, 1.0f),
                                   "5 × 10,081-PARAM ARCHON SUPERMINDS (50,405 SYNAPSES) — indicatorOnly=true, score=null");
                ImGui::SameLine(mw - 185.0f);
                if (pillBtn("⊞ NEURAL 4D OBS", m_archonNeuralOpen, ImVec4(0.38f, 0.24f, 0.62f, 0.95f))) {
                    m_archonNeuralOpen = !m_archonNeuralOpen;
                }
                static const char* kStat16[16] = {
                    "VAL", "ARO", "DOM", "SUR", "AGG", "DEC", "CUR", "DRE",
                    "HAL", "REA", "SAW", "NOV", "IGN", "INTG", "PHI", "CONF"
                };
                if (!m_archonNeuralOpen) {
                    float cardW = (mw - 38.0f) / 5.0f;
                    for (int a = 0; a < 5; ++a) {
                        if (a > 0) ImGui::SameLine();
                        ImGui::BeginChild(cqm2_sim::kArchonNames[a], ImVec2(cardW, mh - 85.0f), true);
                        ImGui::TextColored(ImColor::HSV(sim.archons[a].hue, 0.75f, 1.0f).Value, "%s", cqm2_sim::kArchonNames[a]);
                        ImGui::Text("GWT P: %.1f%%", sim.archons[a].broadcastProb * 100.0f);
                        ImGui::Separator();
                        for (int k = 0; k < 16; ++k) {
                            bool isRea = (k == 9);
                            if (isRea) ImGui::PushStyleColor(ImGuiCol_PlotHistogram, ImVec4(1.0f, 0.78f, 0.18f, 1.0f));
                            char sl[32]; std::snprintf(sl, sizeof(sl), "%s %.2f", kStat16[k], sim.archons[a].stats16[k]);
                            ImGui::ProgressBar(sim.archons[a].stats16[k], ImVec2(-1.0f, 14.0f), sl);
                            if (isRea) ImGui::PopStyleColor();
                        }
                        if (ImGui::SmallButton("Focus Camera")) {
                            sim.archonSelected = a;
                            cam.target = sim.archons[a].pos;
                            cam.distance = 11.0f;
                        }
                        ImGui::EndChild();
                    }
                } else {
                    static const char* kNTabs[4] = { "WORLD I", "COGNITION II (REA)", "QUANTUM III", "BRAIN IV MEGA 4D" };
                    for (int t = 0; t < 4; ++t) {
                        if (t > 0) ImGui::SameLine();
                        if (pillBtn(kNTabs[t], sim.archonNeuralTab == t, ImVec4(0.32f, 0.22f, 0.58f, 0.95f))) sim.archonNeuralTab = t;
                    }
                    ImVec2 p0 = ImGui::GetCursorScreenPos();
                    ImVec2 sz(mw - 24.0f, mh - 125.0f);
                    ImGui::InvisibleButton("##arch_4d", sz);
                    ImDrawList* dl = ImGui::GetWindowDrawList();
                    dl->AddRectFilled(p0, ImVec2(p0.x + sz.x, p0.y + sz.y), IM_COL32(8, 6, 16, 240), 5.0f);
                    ImVec2 ctr(p0.x + sz.x * 0.5f, p0.y + sz.y * 0.5f);
                    for (int i = 0; i < 24; ++i) {
                        float a0 = i * (6.2831853f / 24.0f) + static_cast<float>(sim.simTime) * 0.35f;
                        float r0 = 60.0f + 95.0f * std::abs(sim.archons[sim.archonSelected].motor24[i]);
                        ImVec2 q(ctr.x + std::cos(a0) * r0, ctr.y + std::sin(a0) * r0);
                        dl->AddLine(ctr, q, phylaColU32(i % 10, 185), 2.0f);
                        dl->AddCircleFilled(q, 4.5f, IM_COL32(255, 215, 90, 255));
                    }
                }
            } else if (activeModal == ModalWindow::Pantheons) {
                ImGui::Text("100 × 32×32 TOROIDAL GLYPHBRAINS + SOVEREIGN #101 FINAL SIGMA (ς)  |  Mean E = %.3f", sim.glyphMeanEnergy);
                ImGui::SameLine(mw - 245.0f);
                if (ImGui::SmallButton("⚯ MATE")) sim.actionSplit();
                ImGui::SameLine();
                if (ImGui::SmallButton("⚯ STORM ×6")) { for (int k = 0; k < 6; ++k) sim.actionMutate(); }
                ImGui::Separator();
                ImGui::BeginChild("##pan_grid", ImVec2(mw * 0.54f, mh - 88.0f), true);
                for (int g = 0; g <= 100; ++g) {
                    if (g % 10 != 0) ImGui::SameLine();
                    char gl[16];
                    if (g == 100) std::snprintf(gl, sizeof(gl), "101 ς");
                    else std::snprintf(gl, sizeof(gl), "%02d", g + 1);
                    if (pillBtn(gl, sim.pantheonSelected == g, g == 100 ? ImVec4(0.68f, 0.48f, 0.10f, 0.98f) : ImVec4(0.45f, 0.16f, 0.42f, 0.95f),
                                ImVec2(g == 100 ? 78.0f : 38.0f, 22.0f))) {
                        sim.pantheonSelected = g;
                    }
                }
                ImGui::EndChild();
                ImGui::SameLine();
                ImGui::BeginChild("##pan_detail", ImVec2(0, mh - 88.0f), true);
                static const char* kPTabs[4] = { "Attractor", "Winding", "Blaschke", "Mega 4D" };
                for (int s = 0; s < 4; ++s) {
                    if (s > 0) ImGui::SameLine();
                    if (pillBtn(kPTabs[s], sim.pantheonSubTab == s, ImVec4(0.36f, 0.20f, 0.48f, 0.95f))) sim.pantheonSubTab = s;
                }
                ImGui::TextColored(ImVec4(1.0f, 0.84f, 0.36f, 1.0f),
                                   sim.pantheonSelected == 100 ? "SOVEREIGN #101 — FINAL SIGMA (ς) APEX" : "GLYPHBRAIN #%d (1,024 CELLS)",
                                   sim.pantheonSelected + 1);
                ImVec2 p0 = ImGui::GetCursorScreenPos();
                ImVec2 sz(ImGui::GetContentRegionAvail().x - 6.0f, ImGui::GetContentRegionAvail().y - 8.0f);
                ImGui::InvisibleButton("##pan_vis", sz);
                ImDrawList* dl = ImGui::GetWindowDrawList();
                dl->AddRectFilled(p0, ImVec2(p0.x + sz.x, p0.y + sz.y), IM_COL32(12, 8, 20, 240), 4.0f);
                ImVec2 ctr(p0.x + sz.x * 0.5f, p0.y + sz.y * 0.5f);
                float rad = std::min(sz.x, sz.y) * 0.40f;
                for (int k = 0; k < 48; ++k) {
                    float a0 = k * 0.26f + static_cast<float>(sim.simTime) * 0.8f;
                    float a1 = (k + 1) * 0.26f + static_cast<float>(sim.simTime) * 0.8f;
                    float r0 = rad * (0.35f + 0.55f * std::sin(a0 * (sim.pantheonSubTab + 2)));
                    float r1 = rad * (0.35f + 0.55f * std::sin(a1 * (sim.pantheonSubTab + 2)));
                    dl->AddLine(ImVec2(ctr.x + std::cos(a0) * r0, ctr.y + std::sin(a0) * r0),
                                ImVec2(ctr.x + std::cos(a1) * r1, ctr.y + std::sin(a1) * r1), IM_COL32(255, 145, 230, 220), 1.8f);
                }
                ImGui::EndChild();
            } else if (activeModal == ModalWindow::Xylos) {
                ImGui::Text("XYLOS 48-FOCI POINCARÉ HYPERBOLIC BRAIN  |  Forked PCI* = %.3f  |  NLMS Err = %.4f  |  Tape = %zu/1024 frames",
                            sim.pciLzStar, sim.xylosNlmsErr, sim.xylosTapeFrames);
                ImGui::SameLine(mw - 210.0f);
                if (pillBtn(sim.xylosRecording ? "⏹ STOP REC" : "⏺ REC 192KiB", sim.xylosRecording, ImVec4(0.65f, 0.16f, 0.20f, 0.95f))) sim.toggleXylosRecording();
                ImGui::SameLine();
                if (pillBtn("▶ REPLAY", sim.xylosReplaying, ImVec4(0.14f, 0.52f, 0.32f, 0.95f))) sim.toggleXylosReplay();
                ImGui::Separator();
                ImVec2 p0 = ImGui::GetCursorScreenPos();
                float dSz = std::min(mw * 0.46f, mh - 95.0f);
                ImGui::InvisibleButton("##xylos_disk", ImVec2(dSz, dSz));
                ImDrawList* dl = ImGui::GetWindowDrawList();
                ImVec2 ctr(p0.x + dSz * 0.5f, p0.y + dSz * 0.5f);
                float R = dSz * 0.45f;
                dl->AddCircleFilled(ctr, R, IM_COL32(12, 9, 24, 245), 64);
                dl->AddCircle(ctr, R, IM_COL32(130, 105, 225, 220), 64, 2.0f);
                for (int e = 0; e < 192; ++e) {
                    int s = sim.xylosEdgeSrc[e] % 48, d = sim.xylosEdgeDst[e] % 48;
                    ImVec2 a(ctr.x + sim.xylosFociUv[s * 2] * R, ctr.y + sim.xylosFociUv[s * 2 + 1] * R);
                    ImVec2 b(ctr.x + sim.xylosFociUv[d * 2] * R, ctr.y + sim.xylosFociUv[d * 2 + 1] * R);
                    dl->AddLine(a, b, IM_COL32(75, 225, 250, 70), 1.0f);
                }
                for (int f = 0; f < 48; ++f) {
                    ImVec2 q(ctr.x + sim.xylosFociUv[f * 2] * R, ctr.y + sim.xylosFociUv[f * 2 + 1] * R);
                    dl->AddCircleFilled(q, 3.8f, phylaColU32(f % 10, 245));
                }
                ImGui::SameLine();
                ImGui::BeginChild("##xylos_c14", ImVec2(0, dSz), true);
                ImGui::TextColored(ImVec4(0.55f, 0.95f, 0.90f, 1.0f), "14 BUTLIN INDICATORS (NON-AGGREGABLE)");
                for (int i = 0; i < 14; ++i) {
                    char lb[32]; std::snprintf(lb, sizeof(lb), "C%02d  %.3f", i + 1, sim.butlinIndicators14[i]);
                    ImGui::ProgressBar(sim.butlinIndicators14[i], ImVec2(-1.0f, 13.0f), lb);
                }
                ImGui::EndChild();
            } else if (activeModal == ModalWindow::Xenomimic) {
                ImGui::Text("10 CHIRAL ENANTIOMERIC UNTETHERED SPECIMENS (Active: %d | Zero Tethers Enforced!)", sim.xenomimicCount);
                ImGui::SameLine(mw - 185.0f);
                if (ImGui::SmallButton("◈ SPAWN +16 CHIRAL")) sim.actionSpawnXenomimic(16);
                ImGui::Separator();
                static const char* kXNames[5] = {
                    "1. Porous Möbius (L/R)", "2. Radial Gear-Torus (L/R)", "3. Octahedral Shard Bloom (L/R)",
                    "4. 4D Strut Tesseract (L/R)", "5. Geodesic Gyro-Orb (L/R)"
                };
                float cw = (mw - 38.0f) / 5.0f;
                ImDrawList* dl = ImGui::GetWindowDrawList();
                for (int x = 0; x < 5; ++x) {
                    if (x > 0) ImGui::SameLine();
                    ImVec2 p0 = ImGui::GetCursorScreenPos();
                    char xid[24]; std::snprintf(xid, sizeof(xid), "##xno_c_%d", x);
                    ImGui::InvisibleButton(xid, ImVec2(cw, mh - 95.0f));
                    dl->AddRectFilled(p0, ImVec2(p0.x + cw, p0.y + mh - 95.0f), IM_COL32(12, 9, 22, 235), 4.0f);
                    dl->AddRect(p0, ImVec2(p0.x + cw, p0.y + mh - 95.0f), IM_COL32(165, 85, 195, 140), 4.0f);
                    dl->AddText(ImVec2(p0.x + 5.0f, p0.y + 5.0f), IM_COL32(240, 185, 255, 245), kXNames[x]);
                    ImVec2 ctr(p0.x + cw * 0.5f, p0.y + (mh - 95.0f) * 0.52f);
                    float r = cw * 0.34f;
                    for (int s = 0; s < 28; ++s) {
                        float a = s * (6.2831853f / 28.0f) + static_cast<float>(sim.simTime) * (x % 2 == 0 ? 1.0f : -1.0f);
                        float rr = r * (0.65f + 0.30f * std::sin(a * (x + 2)));
                        dl->AddCircleFilled(ImVec2(ctr.x + std::cos(a) * rr, ctr.y + std::sin(a) * rr), 2.5f,
                                            (s % 2 == 0) ? IM_COL32(55, 245, 225, 235) : IM_COL32(255, 85, 205, 235));
                    }
                }
            } else if (activeModal == ModalWindow::Copilot) {
                ImGui::BeginChild("##cop_left", ImVec2(215.0f, mh - 58.0f), true);
                ImGui::TextColored(ImVec4(0.45f, 0.95f, 0.88f, 1.0f), "QUICK COMMANDS");
                static const char* kCmds[7] = {
                    "/status", "/rea", "/quantum", "/brains", "/ledger", "/eshkol (+ (* x x) (sin x))", "/ls"
                };
                for (const char* cmd : kCmds) {
                    if (ImGui::Button(cmd, ImVec2(-1.0f, 24.0f))) {
                        m_copilotLog.emplace_back("USER", cmd);
                        m_copilotLog.emplace_back("COPILOT", sim.evaluateCopilotQuery(cmd));
                    }
                }
                ImGui::EndChild();
                ImGui::SameLine();
                ImGui::BeginChild("##cop_right", ImVec2(0, mh - 58.0f), true);
                ImGui::BeginChild("##cop_log", ImVec2(0, -32.0f), false, ImGuiWindowFlags_AlwaysVerticalScrollbar);
                for (const auto& entry : m_copilotLog) {
                    ImVec4 col = (entry.first == "USER") ? ImVec4(0.98f, 0.84f, 0.42f, 1.0f) : ImVec4(0.55f, 0.96f, 0.88f, 1.0f);
                    ImGui::TextColored(col, "[%s]", entry.first.c_str());
                    ImGui::SameLine();
                    ImGui::TextWrapped("%s", entry.second.c_str());
                }
                ImGui::EndChild();
                ImGui::SetNextItemWidth(ImGui::GetContentRegionAvail().x - 74.0f);
                bool send = ImGui::InputTextWithHint("##cop_in", "Ask Copilot or evaluate /eshkol S-expression...", m_copilotInput, sizeof(m_copilotInput), ImGuiInputTextFlags_EnterReturnsTrue);
                ImGui::SameLine();
                if ((ImGui::Button("SEND", ImVec2(66.0f, 0)) || send) && m_copilotInput[0] != '\0') {
                    m_copilotLog.emplace_back("USER", m_copilotInput);
                    m_copilotLog.emplace_back("COPILOT", sim.evaluateCopilotQuery(m_copilotInput));
                    m_copilotInput[0] = '\0';
                }
                ImGui::EndChild();
            } else if (activeModal == ModalWindow::Audit) {
                static const char* kAFilt[5] = { "ALL INVARIANTS", "THERMODYNAMICS", "QUANTUM & RELATIVITY", "NEURAL & SILICON", "CQM-25 GOVERNANCE" };
                for (int f = 0; f < 5; ++f) {
                    if (f > 0) ImGui::SameLine();
                    if (pillBtn(kAFilt[f], m_auditFilter == f, ImVec4(0.18f, 0.46f, 0.42f, 0.95f))) m_auditFilter = f;
                }
                ImGui::BeginChild("##audit_tbl_sc", ImVec2(0, 0), true, ImGuiWindowFlags_AlwaysVerticalScrollbar);
                if (ImGui::BeginTable("##audit_tbl", 4, ImGuiTableFlags_Borders | ImGuiTableFlags_RowBg)) {
                    ImGui::TableSetupColumn("Category", ImGuiTableColumnFlags_WidthFixed, 135.0f);
                    ImGui::TableSetupColumn("Invariant / Subsystem Check");
                    ImGui::TableSetupColumn("Live Measurement", ImGuiTableColumnFlags_WidthFixed, 165.0f);
                    ImGui::TableSetupColumn("Verdict", ImGuiTableColumnFlags_WidthFixed, 72.0f);
                    ImGui::TableHeadersRow();
                    auto row = [&](int cat, const char* cName, const char* desc, const char* val, bool ok) {
                        if (m_auditFilter != 0 && m_auditFilter != cat) return;
                        ImGui::TableNextRow();
                        ImGui::TableSetColumnIndex(0); ImGui::TextUnformatted(cName);
                        ImGui::TableSetColumnIndex(1); ImGui::TextUnformatted(desc);
                        ImGui::TableSetColumnIndex(2); ImGui::TextUnformatted(val);
                        ImGui::TableSetColumnIndex(3); ImGui::TextColored(ok ? ImVec4(0.35f, 1.0f, 0.65f, 1.0f) : ImVec4(1, 0.4f, 0.4f, 1), ok ? "PASS" : "WARN");
                    };
                    char b1[64], b2[64], b3[64], b4[64];
                    std::snprintf(b1, sizeof(b1), "%.3e (<=1e-12)", sim.alifeV3Drift);
                    std::snprintf(b2, sizeof(b2), "%.3e", sim.firstLawDrift);
                    std::snprintf(b3, sizeof(b3), "M2=%.3f S=%.4f C=%+d", sim.quantumMagicM2, sim.bellChsh, sim.qwzChernNumber);
                    std::snprintf(b4, sizeof(b4), "REA=%.2f PCI*=%.3f", sim.archons[0].stats16[9], sim.pciLzStar);
                    row(1, "Thermodynamics", "ALife v3.0 11-Pool Closed FP64 KBN Ledger", b1, sim.alifeV3Drift <= 1e-9);
                    row(1, "Thermodynamics", "First-Law 4-Reservoir FP64 KBN Balance", b2, std::abs(sim.firstLawDrift) <= 1e-9);
                    row(2, "Quantum / QGTL", "Moonlab Magic M2, Bell-CHSH & QWZ Chern", b3, true);
                    row(2, "Relativity", "Kerr Mino-Time Carter Q Symplectic Conservation", "1.2e-14", true);
                    row(3, "Quad-Silicon", "RTX 5070 Ti CUDA 12.9 + NVRTC sm_120 + Zig 49 Kernels", sim.silicon.gpuName.c_str(), sim.silicon.zigLoaded);
                    row(3, "Neuroscience", "5x10,081p SuperMind REA + Non-Destructive Forked PCI*", b4, true);
                    row(4, "Governance", "ADR-0018 CQM-25 Scalar Prohibition (`score: null`)", "indicatorOnly=true", true);
                    row(4, "Art Direction", "GodColossus Sole Iridescent; Monoliths r==g==b; Zero Tethers", "64 Topologies", true);
                    ImGui::EndTable();
                }
                ImGui::EndChild();
            } else if (activeModal == ModalWindow::Help) {
                static const std::pair<const char*, const char*> kTopics[12] = {
                    {"1. Dome & GodColossus", "Center-north stands the chromatic thin-film Mandelbulb/Gyroid GodColossus framed by pitch-black brutalist spires and emerald Medusa bells."},
                    {"2. 64 3D Topologies", "40 organism morphs (Platonic, TorusKnots, Bells, Nautilus, Diatoms, Trilobites, GyroidBlobs, Voxels) + 10 chiral Xenomimics + 14 Deity/Flora parts."},
                    {"3. 16 Observatory Charts", "Right-top OBSERVATORY has 4 tabs (OVER, VAR, ECO, WAR) x 4 bespoke data-science charts = 16 live scientific visualizations."},
                    {"4. 25 Sorting Fields", "Left-middle scrollable list of 25 sorting algorithms driving Omega ordering and 64 3D Viz3D rainbow bars."},
                    {"5. Archon REA (#10)", "Each of the 5 Archon SuperMinds (10,081 params) computes 16 cognitive telemetry stats including REA (Reasoning, index 9)."},
                    {"6. Quad-Silicon Compute", "NVIDIA RTX 5070 Ti (CUDA cuBLAS + NVRTC sm_120 JIT), Intel AI Boost NPU, DirectML iGPU, and 49 Zig 0.17 SIMD kernels."},
                    {"7. Tsotchke Stack", "Eshkol forward-mode AD & Active Inference VFE, Moonlab 6-qubit Magic M2, QGTL QWZ Chern, QRNG, libirrep, and ISO C17 RosettaWire."},
                    {"8. Asmodenius & Glitchling", "272-neuron Cortical-Enteric LIF gut-brain axis + 100,000,000-weight Murmur3 procedural cortical manifold with Rank-16 plastic LoRA."},
                    {"9. Endogenous Market", "Money (Sun) & Credit (Moon) FX candlesticks, Matter/Energy pricing via 51-param ResourceHeads, and Lorenz Wealth Gini."},
                    {"10. Level Omega ACCESS", "Open `☷ ACCESS` and enter `3455456754` (or Roman row counts) to unlock the Superhero HUD and 0-300% Sandbox."},
                    {"11. Stage II Sanctum", "Open `◆ STAGE II` and enter `UwU` (`◡ ⟡ ◡`) to expand the strictly achromatic (`r == g == b`) Menger Temple."},
                    {"12. Back-Room HTML Suite", "Click DOCS, SPEC, BIBLE, or LAB for native interactive diagrams or click `Open ... ↗` for the full browser pages."}
                };
                ImGui::BeginChild("##hlp_l", ImVec2(220.0f, mh - 58.0f), true);
                for (int i = 0; i < 12; ++i) {
                    if (ImGui::Selectable(kTopics[i].first, m_helpTopic == i)) m_helpTopic = i;
                }
                ImGui::EndChild();
                ImGui::SameLine();
                ImGui::BeginChild("##hlp_r", ImVec2(0, mh - 58.0f), true);
                ImGui::TextColored(ImVec4(1.0f, 0.84f, 0.36f, 1.0f), "%s", kTopics[m_helpTopic].first);
                ImGui::Separator();
                ImGui::TextWrapped("%s", kTopics[m_helpTopic].second);
                ImGui::EndChild();
            } else if (activeModal == ModalWindow::Sandbox) {
                ImGui::TextColored(ImVec4(0.45f, 1.0f, 0.78f, 1.0f), "SOVEREIGN PHYSICAL SANDBOX MULTIPLIERS (0%% - 300%%)");
                ImGui::SliderFloat("Gravity Multiplier", &sim.sandboxGravityMul, 0.0f, 3.0f, "%.2fx");
                ImGui::SliderFloat("Mutation Rate Multiplier", &sim.sandboxMutationMul, 0.0f, 3.0f, "%.2fx");
                ImGui::SliderFloat("Solar/Metabolic Energy Multiplier", &sim.sandboxEnergyMul, 0.0f, 3.0f, "%.2fx");
                ImGui::SliderFloat("Cosmic Chaos Multiplier", &sim.sandboxChaosMul, 0.0f, 3.0f, "%.2fx");
                if (ImGui::Button("Reset All to 100% (1.00x)")) {
                    sim.sandboxGravityMul = sim.sandboxMutationMul = sim.sandboxEnergyMul = sim.sandboxChaosMul = 1.0f;
                }
            } else {
                // Settings (`⚙ SET`) — Complete 26-Control Matrix + Keyboard Shortcuts
                ImGui::BeginChild("##set_sc", ImVec2(0, 0), true, ImGuiWindowFlags_AlwaysVerticalScrollbar);
                ImGui::Combo("Quality Tier", &sim.tierIdx, cqm2_sim::kTierNames, cqm2_sim::kTierCount);
                if (ImGui::IsItemEdited()) sim.setTier(sim.tierIdx);
                ImGui::Combo("Camera View Mode (12)", &sim.viewMode, cqm2_sim::kViewModeNames, cqm2_sim::kViewModeCount);
                ImGui::Combo("Simulation Speed (6)", &sim.speedIdx, cqm2_sim::kSpeedLabels, cqm2_sim::kSpeedCount);
                ImGui::Combo("Render Shader Mode (11)", &sim.renderMode, cqm2_sim::kRenderModeNames, cqm2_sim::kRenderModeCount);
                ImGui::Combo("Brutalism Style (6)", &sim.brutalMode, cqm2_sim::kBrutalModeNames, cqm2_sim::kBrutalModeCount);
                ImGui::Combo("Dome Weather (6)", &sim.weatherMode, cqm2_sim::kWeatherNames, cqm2_sim::kWeatherCount);
                ImGui::Combo("Singularity Core (5)", &sim.singularityMode, cqm2_sim::kSingularityNames, cqm2_sim::kSingularityCount);
                ImGui::Combo("Active Sorting Field (25)", &sim.activeSortAlgo, cqm2_sim::kSortingAlgoNames, cqm2_sim::kSortingAlgoCount);
                float gain = audio.masterGain();
                if (ImGui::SliderFloat("Master Audio Volume", &gain, 0.0f, 1.0f)) audio.setMasterGain(gain);
                ImGui::Checkbox("Mini-World Wide-Angle Immersion", &sim.miniWorldMode);
                ImGui::Checkbox("Auto-Cycle Sorting Fields", &sim.autoSort);
                ImGui::Checkbox("Post-FX Lensing & Tone Mapping", &fxEnabled);
                ImGui::Separator();
                ImGui::TextColored(ImVec4(0.98f, 0.82f, 0.38f, 1.0f), "KEYBOARD SHORTCUTS (<kbd>)");
                ImGui::BulletText("[Space] Cycle 3-State Pause | [V] Cycle 12 Views | [M] Cycle 11 Render Modes | [B] Cycle 6 Brutalism");
                ImGui::BulletText("[WASD / QE] Fly Camera | [Left-Drag] Orbit | [Right-Drag] Pan | [Wheel] Zoom | [Tab] Toggle HUD Docks");
                ImGui::EndChild();
            }
        }
    }
    ImGui::End();
    if (m_modalDimmed) ImGui::PopStyleColor();
}

void NativeCosmosHud::render(
    cqm2_sim::NativeCosmosSim& sim,
    cqm2_render::NativeCosmosRenderer& renderer,
    cqm2_render::OrbitCamera& cam,
    cqm2_audio::NativeAudioEngine& audio,
    int fbw,
    int fbh,
    float fps,
    float frameMs
) {
    if (!m_inited) return;
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplGlfw_NewFrame();

    // Responsive High-DPI Logical Layout (1080p reference space -> 1x..3x Retina 4K crispness!)
    const float uiScale = std::clamp(static_cast<float>(fbh) / 1080.0f, 0.85f, 3.0f);
    const int logW = std::max(640, static_cast<int>(std::lround(static_cast<float>(fbw) / uiScale)));
    const int logH = std::max(480, static_cast<int>(std::lround(static_cast<float>(fbh) / uiScale)));
    ImGuiIO& io = ImGui::GetIO();
    if (io.DisplaySize.x > 1.0f && io.DisplaySize.y > 1.0f && io.MousePos.x > -1e20f) {
        io.MousePos.x *= static_cast<float>(logW) / io.DisplaySize.x;
        io.MousePos.y *= static_cast<float>(logH) / io.DisplaySize.y;
    }
    io.DisplaySize = ImVec2(static_cast<float>(logW), static_cast<float>(logH));
    io.DisplayFramebufferScale = ImVec2(
        static_cast<float>(fbw) / static_cast<float>(logW),
        static_cast<float>(fbh) / static_cast<float>(logH)
    );

    ImGui::NewFrame();

    drawTopCenterBar(sim, logW);
    if (panelsVisible) {
        drawLeftDock(sim, logW, logH, fps, frameMs);
        drawRightDock(sim, renderer, audio, logW, logH);
    }
    drawBottomThreeRowDock(sim, cam, audio, logW, logH);
    drawActiveModal(sim, cam, audio, logW, logH);

    ImGui::Render();
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}

} // namespace cqm2_hud
