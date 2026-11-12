/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#include "gl_core.h"
#include "cqm2_native_audio.h"
#include "cqm2_native_hud.h"
#include "cqm2_native_renderer.h"
#include "cqm2_native_sim.h"

#include <GLFW/glfw3.h>
#include <imgui.h>

#define STB_IMAGE_WRITE_IMPLEMENTATION
#define STBIW_WINDOWS_UTF8
#if defined(__GNUC__) || defined(__clang__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wmissing-field-initializers"
#pragma GCC diagnostic ignored "-Wsign-compare"
#pragma GCC diagnostic ignored "-Wunused-function"
#endif
#include <stb_image_write.h>
#if defined(__GNUC__) || defined(__clang__)
#pragma GCC diagnostic pop
#endif

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <string>
#include <vector>

namespace {

#ifdef _WIN32
bool dirExistsW(const std::wstring& p) {
    if (p.empty()) return false;
    DWORD a = GetFileAttributesW(p.c_str());
    return (a != INVALID_FILE_ATTRIBUTES) && ((a & FILE_ATTRIBUTE_DIRECTORY) != 0);
}

bool fileExistsW(const std::wstring& p) {
    if (p.empty()) return false;
    DWORD a = GetFileAttributesW(p.c_str());
    return (a != INVALID_FILE_ATTRIBUTES) && ((a & FILE_ATTRIBUTE_DIRECTORY) == 0);
}

std::wstring utf8ToWide(const std::string& s) {
    if (s.empty()) return L"";
    int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
    if (n <= 0) return L"";
    std::wstring out(static_cast<size_t>(n), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), out.data(), n);
    return out;
}

std::wstring parentDirW(const std::wstring& path) {
    size_t pos = path.find_last_of(L"\\/");
    return (pos == std::wstring::npos) ? L"" : path.substr(0, pos);
}

void attachConsoleForCli() {
    HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
    DWORD fileType = hOut ? GetFileType(hOut) : FILE_TYPE_UNKNOWN;
    if (fileType == FILE_TYPE_DISK || fileType == FILE_TYPE_PIPE) {
        // Stdout is already redirected by a test runner / pipe; keep it intact!
        return;
    }
    if (AttachConsole(ATTACH_PARENT_PROCESS)) {
        FILE* fpOut = nullptr;
        FILE* fpErr = nullptr;
        freopen_s(&fpOut, "CONOUT$", "w", stdout);
        freopen_s(&fpErr, "CONOUT$", "w", stderr);
    }
}

void enableHighDpiAwareness() {
    HMODULE hUser32 = GetModuleHandleW(L"user32.dll");
    if (hUser32) {
        using SetDpiCtxFn = BOOL(WINAPI*)(DPI_AWARENESS_CONTEXT);
        auto fn = reinterpret_cast<SetDpiCtxFn>(
            reinterpret_cast<void*>(GetProcAddress(hUser32, "SetProcessDpiAwarenessContext"))
        );
        if (fn) {
            fn(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
            return;
        }
    }
    SetProcessDPIAware();
}

void resolvePaths(std::wstring& outExeDir, std::wstring& outDllDir, std::wstring& outRepoRoot) {
    wchar_t exePath[MAX_PATH * 2]{};
    DWORD len = GetModuleFileNameW(nullptr, exePath, MAX_PATH * 2 - 1);
    std::wstring fullExe(exePath, len);
    outExeDir = parentDirW(fullExe);

    // 1. Check optional cqm2_root.txt sidecar next to CQM2.exe (e.g. on Desktop)
    std::wstring sidecar = outExeDir + L"\\cqm2_root.txt";
    if (fileExistsW(sidecar)) {
        std::ifstream ifs(sidecar.c_str(), std::ios::binary);
        std::string line;
        if (std::getline(ifs, line)) {
            while (!line.empty() && (line.back() == '\r' || line.back() == '\n' || line.back() == ' ')) {
                line.pop_back();
            }
            std::wstring cand = utf8ToWide(line);
            if (dirExistsW(cand)) {
                outRepoRoot = cand;
            }
        }
    }

    // 2. Check <exeDir>\..\.. (when running from CQM2\native\bin\CQM2.exe)
    if (outRepoRoot.empty()) {
        std::wstring up1 = parentDirW(outExeDir);
        std::wstring up2 = parentDirW(up1);
        if (fileExistsW(up2 + L"\\package.json") && dirExistsW(up2 + L"\\native")) {
            outRepoRoot = up2;
        }
    }

    // 3. Canonical workstation fallback path
    if (outRepoRoot.empty()) {
        const std::wstring canonical = L"Z:\\[Vibe Coded (AI)]\\CLAUDECODE\\CQM2";
        if (dirExistsW(canonical)) {
            outRepoRoot = canonical;
        }
    }

    if (!outRepoRoot.empty() && dirExistsW(outRepoRoot + L"\\native\\bin")) {
        outDllDir = outRepoRoot + L"\\native\\bin";
    } else {
        outDllDir = outExeDir;
    }
}
#endif

struct EngineInputState {
    double lastMx{0.0};
    double lastMy{0.0};
    bool hasLastMouse{false};
    float scrollDelta{0.0f};
};

void setProceduralWindowIcon(GLFWwindow* win) {
    constexpr int W = 32;
    constexpr int H = 32;
    std::vector<unsigned char> px(W * H * 4, 0);
    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            float u = (static_cast<float>(x) + 0.5f) / W * 2.0f - 1.0f;
            float v = (static_cast<float>(y) + 0.5f) / H * 2.0f - 1.0f;
            float r = std::sqrt(u * u + v * v);
            size_t idx = static_cast<size_t>((y * W + x) * 4);
            if (r <= 0.96f) {
                float ang = std::atan2(v, u);
                float wave = 0.5f + 0.5f * std::sin(ang * 5.0f + r * 8.0f);
                px[idx + 0] = static_cast<unsigned char>(std::clamp(45.0f + 195.0f * wave * (1.0f - r * 0.4f), 0.0f, 255.0f));
                px[idx + 1] = static_cast<unsigned char>(std::clamp(30.0f + 185.0f * (1.0f - wave) + 40.0f * (1.0f - r), 0.0f, 255.0f));
                px[idx + 2] = static_cast<unsigned char>(std::clamp(95.0f + 155.0f * (1.0f - r * 0.5f), 0.0f, 255.0f));
                px[idx + 3] = 255;
            }
        }
    }
    GLFWimage img{ W, H, px.data() };
    glfwSetWindowIcon(win, 1, &img);
}

void applyViewModePreset(const cqm2_sim::NativeCosmosSim& sim, cqm2_render::OrbitCamera& cam, float dt) {
    switch (sim.viewMode) {
    case 0: // free
        break;
    case 1: // orbit
        cam.yaw += dt * 0.24f;
        cam.pitch = 0.16f;
        cam.distance = 42.0f;
        cam.target = glm::vec3(0.0f, 3.5f, -8.0f);
        break;
    case 2: // top
        cam.pitch = 1.38f;
        cam.distance = 62.0f;
        cam.target = glm::vec3(0.0f, 0.0f, -6.0f);
        break;
    case 3: // side
        cam.yaw = 1.57f;
        cam.pitch = 0.08f;
        cam.distance = 48.0f;
        cam.target = glm::vec3(0.0f, 5.0f, -8.0f);
        break;
    case 4: // entity (close-up on Petri floor + organisms + Viz3D)
        cam.yaw = 0.35f + static_cast<float>(std::sin(sim.simTime * 0.2)) * 0.2f;
        cam.pitch = 0.11f;
        cam.distance = 17.5f;
        cam.target = glm::vec3(2.0f, -1.5f, -4.0f);
        break;
    case 5: // titan
        cam.target = sim.titans[0].pos;
        cam.pitch = 0.14f;
        cam.distance = 15.0f;
        break;
    case 6: // god (Mandelbulb GodColossus)
        cam.yaw = 0.08f;
        cam.pitch = -0.06f;
        cam.distance = 34.0f;
        cam.target = glm::vec3(0.0f, 12.0f, -26.0f);
        break;
    case 7: // temple (Stage II achromatic Menger MonolithTemple)
        cam.yaw = 0.35f;
        cam.pitch = 0.18f;
        cam.distance = 21.0f;
        cam.target = glm::vec3(22.0f, 3.8f, -20.0f);
        break;
    case 8: // tree (Crystal Big Tree + lush AlienFlora)
        cam.yaw = -0.38f;
        cam.pitch = 0.14f;
        cam.distance = 24.0f;
        cam.target = glm::vec3(-28.0f, 8.5f, -22.0f);
        break;
    case 9: // xylos / viz3d
        cam.yaw = 0.42f;
        cam.pitch = 0.10f;
        cam.distance = 14.5f;
        cam.target = glm::vec3(9.0f, -0.8f, -6.0f);
        break;
    case 10: // archon
        cam.target = sim.archons[0].pos;
        cam.pitch = 0.10f;
        cam.distance = 14.0f;
        break;
    case 11: // reliquary (Jolt 5.5 rigid bodies)
        cam.yaw = 0.25f;
        cam.pitch = 0.18f;
        cam.distance = 16.0f;
        cam.target = glm::vec3(0.0f, 1.0f, 0.0f);
        break;
    default:
        break;
    }
}

int matchNameIndex(const std::string& val, const char* const* table, int count) {
    for (int i = 0; i < count; ++i) {
        if (val == table[i]) return i;
    }
    if (!val.empty() && std::isdigit(static_cast<unsigned char>(val[0]))) {
        return std::clamp(std::atoi(val.c_str()), 0, count - 1);
    }
    return -1;
}

} // namespace

int main(int argc, char** argv) {
    bool smokeMode = false;
    std::string shotPath;
    int reqW = 1920;
    int reqH = 1080;
    bool explicitRes = false;
    int warmupFrames = 24;
    int reqTier = 0; // Matches Original CQM 495/1000 default (override via --tier=0..5)
    int reqObsTab = -1;
    int reqNMode = 0;
    int reqSingularity = -1;
    int reqWeather = -1;
    float reqScrollLeft = -1.0f;
    bool cliMiniWorld = false;
    std::string reqWindow;
    std::string reqView;
    std::string reqRender;
    std::string reqBrutal;
    std::string reqSubject;
    bool hasYaw = false, hasPitch = false, hasDist = false, hasTarget = false;
    float cliYaw = 0.16f, cliPitch = 0.11f, cliDist = 38.0f;
    glm::vec3 cliTarget{-1.5f, 4.2f, -9.0f};
    bool cliStage2 = false;
    bool cliAccess = false;
    bool cliNhi = false;
    bool cliXno = false;
    bool cliShatter = false;
    bool cliNoPanels = false;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i] ? argv[i] : "";
        if (arg == "--smoke" || arg == "--self-test") {
            smokeMode = true;
            if (!explicitRes) { reqW = 1280; reqH = 720; }
            reqTier = 0;
        } else if (arg.rfind("--shot=", 0) == 0) {
            shotPath = arg.substr(7);
        } else if (arg == "--w3840x2160" || arg == "--4k") {
            reqW = 3840; reqH = 2160; explicitRes = true;
        } else if (arg == "--w1920x1080" || arg == "--1080p") {
            reqW = 1920; reqH = 1080; explicitRes = true;
        } else if (arg == "--w1536x864") {
            reqW = 1536; reqH = 864; explicitRes = true;
        } else if (arg.rfind("--width=", 0) == 0) {
            reqW = std::clamp(std::atoi(arg.c_str() + 8), 320, 7680); explicitRes = true;
        } else if (arg.rfind("--height=", 0) == 0) {
            reqH = std::clamp(std::atoi(arg.c_str() + 9), 240, 4320); explicitRes = true;
        } else if (arg.rfind("--frames=", 0) == 0) {
            warmupFrames = std::clamp(std::atoi(arg.c_str() + 9), 1, 600);
        } else if (arg.rfind("--tier=", 0) == 0) {
            reqTier = std::clamp(std::atoi(arg.c_str() + 7), 0, cqm2_sim::kTierCount - 1);
        } else if (arg.rfind("--obs-tab=", 0) == 0) {
            reqObsTab = std::clamp(std::atoi(arg.c_str() + 10), 0, 3);
        } else if (arg.rfind("--scroll-left=", 0) == 0) {
            reqScrollLeft = static_cast<float>(std::atof(arg.c_str() + 14));
        } else if (arg.rfind("--nmode=", 0) == 0) {
            reqNMode = std::clamp(std::atoi(arg.c_str() + 8), 1, 2);
        } else if (arg.rfind("--singularity=", 0) == 0) {
            reqSingularity = std::clamp(std::atoi(arg.c_str() + 14), 0, cqm2_sim::kSingularityCount - 1);
        } else if (arg.rfind("--weather=", 0) == 0) {
            reqWeather = std::clamp(std::atoi(arg.c_str() + 10), 0, cqm2_sim::kWeatherCount - 1);
        } else if (arg == "--miniworld") {
            cliMiniWorld = true;
        } else if (arg.rfind("--subject=", 0) == 0) {
            reqSubject = arg.substr(10);
        } else if (arg.rfind("--window=", 0) == 0) {
            reqWindow = arg.substr(9);
        } else if (arg.rfind("--view=", 0) == 0) {
            reqView = arg.substr(7);
        } else if (arg.rfind("--render=", 0) == 0) {
            reqRender = arg.substr(9);
        } else if (arg.rfind("--brutal=", 0) == 0) {
            reqBrutal = arg.substr(9);
        } else if (arg.rfind("--yaw=", 0) == 0) {
            cliYaw = static_cast<float>(std::atof(arg.c_str() + 6)); hasYaw = true;
        } else if (arg.rfind("--pitch=", 0) == 0) {
            cliPitch = static_cast<float>(std::atof(arg.c_str() + 8)); hasPitch = true;
        } else if (arg.rfind("--dist=", 0) == 0) {
            cliDist = static_cast<float>(std::atof(arg.c_str() + 7)); hasDist = true;
        } else if (arg.rfind("--target=", 0) == 0) {
            float tx = 0.0f, ty = 3.5f, tz = -8.0f;
            if (std::sscanf(arg.c_str() + 9, "%f,%f,%f", &tx, &ty, &tz) == 3) {
                cliTarget = glm::vec3(tx, ty, tz);
                hasTarget = true;
            }
        } else if (arg == "--stage2") {
            cliStage2 = true;
        } else if (arg == "--access") {
            cliAccess = true;
        } else if (arg == "--nhi") {
            cliNhi = true;
        } else if (arg == "--xno") {
            cliXno = true;
        } else if (arg == "--shatter") {
            cliShatter = true;
        } else if (arg == "--nopanels") {
            cliNoPanels = true;
        }
    }

    const bool headless = smokeMode || !shotPath.empty();
#ifdef _WIN32
    enableHighDpiAwareness();
    if (headless) {
        attachConsoleForCli();
    }
#endif

    if (!glfwInit()) {
        if (headless) std::fprintf(stderr, "{\"ok\":false,\"error\":\"glfwInit failed\"}\n");
        return 1;
    }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_SAMPLES, 4);
    if (headless) {
        glfwWindowHint(GLFW_VISIBLE, GLFW_FALSE);
    } else {
        glfwWindowHint(GLFW_VISIBLE, GLFW_TRUE);
        glfwWindowHint(GLFW_MAXIMIZED, GLFW_TRUE);
    }

    int initWinW = headless ? 1280 : reqW;
    int initWinH = headless ? 720  : reqH;
    GLFWwindow* window = glfwCreateWindow(
        initWinW,
        initWinH,
        "Cosmogonic Quantum Mechalogodrom — CQM2 v5.0.0 [Quad-Silicon Native Workstation]",
        nullptr,
        nullptr
    );
    if (!window) {
        glfwTerminate();
        if (headless) std::fprintf(stderr, "{\"ok\":false,\"error\":\"glfwCreateWindow failed\"}\n");
        return 1;
    }

    glfwMakeContextCurrent(window);
    if (!headless) {
        glfwSwapInterval(1);
        setProceduralWindowIcon(window);
    } else {
        glfwSwapInterval(0);
    }

    if (!cqm2_gl::loadCoreGL([](const char* name) -> void* {
            return reinterpret_cast<void*>(glfwGetProcAddress(name));
        })) {
        glfwDestroyWindow(window);
        glfwTerminate();
        if (headless) std::fprintf(stderr, "{\"ok\":false,\"error\":\"cqm2_gl::loadCoreGL failed\"}\n");
        return 1;
    }

    std::wstring exeDir, dllDir, repoRoot;
#ifdef _WIN32
    resolvePaths(exeDir, dllDir, repoRoot);
#endif

    cqm2_sim::NativeCosmosSim sim;
    sim.init(dllDir, repoRoot, reqTier);

    cqm2_render::NativeCosmosRenderer renderer;
    if (!renderer.init()) {
        glfwDestroyWindow(window);
        glfwTerminate();
        if (headless) std::fprintf(stderr, "{\"ok\":false,\"error\":\"NativeCosmosRenderer::init failed\"}\n");
        return 1;
    }

    cqm2_hud::NativeCosmosHud hud;
    hud.init(window);

    cqm2_audio::NativeAudioEngine audio;
    audio.start(headless);
    if (!headless) {
        audio.setMusicEnabled(true);
    }

    cqm2_render::OrbitCamera cam;
    if (cliStage2) {
        sim.submitStage2Sigil("UwU");
        sim.rebuildStaticWorld();
    }
    if (cliAccess) {
        sim.accessUnlocked = true;
        sim.heroHudVisible = true;
    }
    if (cliMiniWorld) sim.miniWorldMode = true;
    if (reqNMode > 0) sim.nMode = reqNMode;
    if (reqSingularity >= 0) sim.singularityMode = reqSingularity;
    if (reqWeather >= 0) sim.weatherMode = reqWeather;
    if (reqObsTab >= 0) hud.setObsTab(reqObsTab);
    if (reqScrollLeft >= 0.0f) hud.setLeftScrollFrac(reqScrollLeft);
    if (cliNhi) sim.actionNhiRelease(48);
    if (cliXno) sim.actionSpawnXenomimic(40);
    if (cliShatter) sim.actionShatterReliquary();
    if (cliNoPanels) hud.panelsVisible = false;

    if (!reqSubject.empty()) {
        hasYaw = hasPitch = hasDist = hasTarget = true;
        if (reqSubject == "colossus") {
            cliTarget = sim.godColossusCenter; cliYaw = 0.06f; cliPitch = 0.03f; cliDist = 26.0f;
        } else if (reqSubject == "mecha") {
            cliTarget = sim.mechalogodromCenter; cliYaw = 0.35f; cliPitch = 0.16f; cliDist = 16.5f;
        } else if (reqSubject == "xylos") {
            cliTarget = sim.xylosCenter + glm::vec3(0.0f, 4.5f, 0.0f); cliYaw = 0.48f; cliPitch = 0.18f; cliDist = 13.0f;
        } else if (reqSubject == "tree") {
            cliTarget = sim.crystalTreeCenter + glm::vec3(0.0f, 6.5f, 0.0f); cliYaw = -0.55f; cliPitch = 0.14f; cliDist = 18.0f;
        } else if (reqSubject == "temple") {
            cliTarget = sim.monolithTempleCenter + glm::vec3(0.0f, 4.2f, 0.0f); cliYaw = 0.42f; cliPitch = 0.16f; cliDist = 17.5f;
        } else if (reqSubject == "archon") {
            cliTarget = sim.archons[0].pos; cliYaw = 0.25f; cliPitch = 0.12f; cliDist = 10.5f;
        } else if (reqSubject == "shoggoth") {
            cliTarget = glm::vec3(16.5f, sim.terrainHeightAt(16.5f, 0.0f) + 1.2f, 0.0f); cliYaw = 0.8f; cliPitch = 0.20f; cliDist = 6.5f;
        } else if (reqSubject == "leviathan") {
            cliTarget = glm::vec3(0.0f, 16.0f, 32.0f); cliYaw = 3.14f; cliPitch = 0.12f; cliDist = 18.0f;
        } else if (reqSubject == "flora") {
            cliTarget = glm::vec3(-8.0f, sim.terrainHeightAt(-8.0f, 10.0f) + 1.5f, 10.0f); cliYaw = 0.35f; cliPitch = 0.15f; cliDist = 9.5f;
        }
    }

    if (!reqView.empty()) {
        int vi = matchNameIndex(reqView, cqm2_sim::kViewModeNames, cqm2_sim::kViewModeCount);
        if (vi >= 0) sim.viewMode = vi;
    }
    if (!reqRender.empty()) {
        int ri = matchNameIndex(reqRender, cqm2_sim::kRenderModeNames, cqm2_sim::kRenderModeCount);
        if (ri >= 0) sim.renderMode = ri;
    }
    if (!reqBrutal.empty()) {
        int bi = matchNameIndex(reqBrutal, cqm2_sim::kBrutalModeNames, cqm2_sim::kBrutalModeCount);
        if (bi >= 0) sim.brutalMode = bi;
    }
    if (!reqWindow.empty()) {
        hud.openWindowByName(reqWindow);
    }

    if (hasYaw) cam.yaw = cliYaw;
    if (hasPitch) cam.pitch = cliPitch;
    if (hasDist) cam.distance = cliDist;
    if (hasTarget) cam.target = cliTarget;

    // Headless --smoke or --shot=<png> offscreen exact-resolution FBO execution
    if (headless) {
        GLuint outFbo = 0, outColor = 0, outDepth = 0;
        glGenFramebuffers(1, &outFbo);
        glBindFramebuffer(GL_FRAMEBUFFER, outFbo);

        glGenTextures(1, &outColor);
        glBindTexture(GL_TEXTURE_2D, outColor);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, reqW, reqH, 0, GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, outColor, 0);

        glGenRenderbuffers(1, &outDepth);
        glBindRenderbuffer(GL_RENDERBUFFER, outDepth);
        glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, reqW, reqH);
        glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, outDepth);

        int steps = smokeMode ? 12 : warmupFrames;
        for (int f = 0; f < steps; ++f) {
            glfwPollEvents();
            sim.step(1.0f / 60.0f);
            if (!hasYaw && !hasPitch && !hasDist && !hasTarget) {
                applyViewModePreset(sim, cam, 1.0f / 60.0f);
            }
        }

        // Render 4 full frames into outFbo so Dear ImGui dynamic font textures and scroll offsets settle cleanly
        for (int pass = 0; pass < 4; ++pass) {
            renderer.renderWorld(sim, cam, reqW, reqH, 0.25f, outFbo);
            glBindFramebuffer(GL_FRAMEBUFFER, outFbo);
            glViewport(0, 0, reqW, reqH);
            hud.render(sim, renderer, cam, audio, reqW, reqH, 60.0f, 4.2f);
        }
        glFinish();

        std::vector<unsigned char> rgba(static_cast<size_t>(reqW) * static_cast<size_t>(reqH) * 4u, 0);
        glBindFramebuffer(GL_FRAMEBUFFER, outFbo);
        glPixelStorei(GL_PACK_ALIGNMENT, 1);
        glReadPixels(0, 0, reqW, reqH, GL_RGBA, GL_UNSIGNED_BYTE, rgba.data());

        double meanLum = 0.0;
        size_t nonBlack = 0;
        const size_t totalPx = static_cast<size_t>(reqW) * static_cast<size_t>(reqH);
        for (size_t p = 0; p < totalPx; ++p) {
            unsigned char r = rgba[p * 4 + 0];
            unsigned char g = rgba[p * 4 + 1];
            unsigned char b = rgba[p * 4 + 2];
            rgba[p * 4 + 3] = 255; // Force opaque alpha for crisp PNG screenshots
            double lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            meanLum += lum;
            if (r + g + b > 12) ++nonBlack;
        }
        meanLum /= static_cast<double>(std::max<size_t>(1, totalPx));

        bool shotSaved = true;
        if (!shotPath.empty()) {
            stbi_flip_vertically_on_write(1);
            shotSaved = (stbi_write_png(shotPath.c_str(), reqW, reqH, 4, rgba.data(), reqW * 4) != 0);
        }

        glDeleteRenderbuffers(1, &outDepth);
        glDeleteTextures(1, &outColor);
        glDeleteFramebuffers(1, &outFbo);

        const bool firstLawOk = (std::abs(sim.firstLawDrift) <= 1e-12) && (sim.alifeV3Drift <= 1e-12);
        const bool ok = shotSaved && (nonBlack > totalPx / 20) && firstLawOk;

        std::printf(
            "{\"ok\":%s,\"version\":\"5.0.0\",\"engine\":\"CQM2-Native-64Mesh-OpenGL33-Jolt55-QuadSilicon\","
            "\"width\":%d,\"height\":%d,\"entities\":%d,\"xenomimics\":%d,\"topologies\":64,"
            "\"cuda\":%s,\"nvrtcSm120\":%s,\"npu\":%s,\"dml\":%s,\"zig\":%s,\"moonlab\":%s,\"libirrep\":%s,\"rsw1\":%s,\"rust\":%s,"
            "\"firstLawDrift\":%.3e,\"alifeV3Drift\":%.3e,\"rea0\":%.3f,\"pciLzStar\":%.3f,\"meanLuminance\":%.2f,\"shot\":\"%s\"}\n",
            ok ? "true" : "false",
            reqW, reqH, sim.liveEntityCount, sim.xenomimicCount,
            sim.silicon.cudaReady ? "true" : "false",
            sim.silicon.nvrtcSm120Ready ? "true" : "false",
            sim.silicon.npuLevelZeroReady ? "true" : "false",
            sim.silicon.igpuDmlReady ? "true" : "false",
            sim.silicon.zigLoaded ? "true" : "false",
            sim.silicon.moonlabLoaded ? "true" : "false",
            sim.silicon.libirrepLoaded ? "true" : "false",
            sim.silicon.rsw1StreamOk ? "true" : "false",
            sim.silicon.rustLedgerLoaded ? "true" : "false",
            sim.firstLawDrift,
            sim.alifeV3Drift,
            sim.archons[0].stats16[9],
            sim.pciLzStar,
            meanLum,
            shotPath.c_str()
        );
        std::fflush(stdout);

        audio.stop();
        hud.shutdown();
        renderer.shutdown();
        glfwDestroyWindow(window);
        glfwTerminate();
        return ok ? 0 : 2;
    }

    // Interactive Desktop Workstation Loop
    EngineInputState inp;
    glfwSetWindowUserPointer(window, &inp);
    glfwSetScrollCallback(window, [](GLFWwindow* w, double /*xoff*/, double yoff) {
        auto* st = static_cast<EngineInputState*>(glfwGetWindowUserPointer(w));
        if (st) st->scrollDelta += static_cast<float>(yoff);
    });

    double prevTime = glfwGetTime();
    float smoothFps = 60.0f;
    float smoothMs = 16.6f;
    bool prevSpace = false, prevR = false, prevB = false, prevF = false, prevM = false, prevTab = false, prevF11 = false;
    bool fullscreen = false;
    int savedWinX = 80, savedWinY = 60, savedWinW = 1600, savedWinH = 900;

    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();
        double now = glfwGetTime();
        float dt = static_cast<float>(std::clamp(now - prevTime, 0.0005, 0.1));
        prevTime = now;

        smoothMs = smoothMs * 0.90f + (dt * 1000.0f) * 0.10f;
        smoothFps = 1000.0f / std::max(0.2f, smoothMs);

        ImGuiIO& io = ImGui::GetIO();

        // Keyboard shortcuts when not typing in an ImGui text field
        if (!io.WantCaptureKeyboard) {
            bool sp = glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS;
            if (sp && !prevSpace) sim.paused = !sim.paused;
            prevSpace = sp;

            bool rk = glfwGetKey(window, GLFW_KEY_R) == GLFW_PRESS;
            if (rk && !prevR) sim.renderMode = (sim.renderMode + 1) % cqm2_sim::kRenderModeCount;
            prevR = rk;

            bool bk = glfwGetKey(window, GLFW_KEY_B) == GLFW_PRESS;
            if (bk && !prevB) sim.brutalMode = (sim.brutalMode + 1) % cqm2_sim::kBrutalModeCount;
            prevB = bk;

            bool fk = glfwGetKey(window, GLFW_KEY_F) == GLFW_PRESS;
            if (fk && !prevF) { sim.actionShatterReliquary(); audio.triggerSfx(cqm2_audio::SfxId::Shatter); }
            prevF = fk;

            bool mk = glfwGetKey(window, GLFW_KEY_M) == GLFW_PRESS;
            if (mk && !prevM) audio.setMuted(!audio.isMuted());
            prevM = mk;

            bool tb = glfwGetKey(window, GLFW_KEY_TAB) == GLFW_PRESS;
            if (tb && !prevTab) hud.panelsVisible = !hud.panelsVisible;
            prevTab = tb;

            bool f11 = glfwGetKey(window, GLFW_KEY_F11) == GLFW_PRESS;
            if (f11 && !prevF11) {
                fullscreen = !fullscreen;
                if (fullscreen) {
                    glfwGetWindowPos(window, &savedWinX, &savedWinY);
                    glfwGetWindowSize(window, &savedWinW, &savedWinH);
                    GLFWmonitor* mon = glfwGetPrimaryMonitor();
                    const GLFWvidmode* mode = glfwGetVideoMode(mon);
                    if (mon && mode) {
                        glfwSetWindowMonitor(window, mon, 0, 0, mode->width, mode->height, mode->refreshRate);
                    }
                } else {
                    glfwSetWindowMonitor(window, nullptr, savedWinX, savedWinY, savedWinW, savedWinH, 0);
                }
            }
            prevF11 = f11;

            if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
                if (hud.activeModal != cqm2_hud::ModalWindow::None) {
                    hud.activeModal = cqm2_hud::ModalWindow::None;
                }
            }

            // WASD + QE free-flight camera pan
            float moveSpd = 24.0f * dt;
            glm::vec3 fwd(-std::sin(cam.yaw), 0.0f, -std::cos(cam.yaw));
            glm::vec3 right(std::cos(cam.yaw), 0.0f, -std::sin(cam.yaw));
            if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) { cam.target += fwd * moveSpd; sim.viewMode = 0; }
            if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) { cam.target -= fwd * moveSpd; sim.viewMode = 0; }
            if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) { cam.target += right * moveSpd; sim.viewMode = 0; }
            if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) { cam.target -= right * moveSpd; sim.viewMode = 0; }
            if (glfwGetKey(window, GLFW_KEY_E) == GLFW_PRESS) { cam.target.y += moveSpd; sim.viewMode = 0; }
            if (glfwGetKey(window, GLFW_KEY_Q) == GLFW_PRESS) { cam.target.y -= moveSpd; sim.viewMode = 0; }
        }

        // Mouse orbit / pan / zoom when cursor is over 3D viewport
        double mx = 0.0, my = 0.0;
        glfwGetCursorPos(window, &mx, &my);
        double dx = inp.hasLastMouse ? (mx - inp.lastMx) : 0.0;
        double dy = inp.hasLastMouse ? (my - inp.lastMy) : 0.0;
        inp.lastMx = mx;
        inp.lastMy = my;
        inp.hasLastMouse = true;

        if (!io.WantCaptureMouse) {
            if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_LEFT) == GLFW_PRESS) {
                cam.yaw -= static_cast<float>(dx) * 0.0045f;
                cam.pitch = std::clamp(cam.pitch + static_cast<float>(dy) * 0.0045f, -0.42f, 1.48f);
                sim.viewMode = 0;
            } else if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_RIGHT) == GLFW_PRESS) {
                glm::vec3 right(std::cos(cam.yaw), 0.0f, -std::sin(cam.yaw));
                cam.target -= right * static_cast<float>(dx) * 0.045f;
                cam.target.y += static_cast<float>(dy) * 0.045f;
                sim.viewMode = 0;
            }
            if (std::abs(inp.scrollDelta) > 1e-4f) {
                cam.distance = std::clamp(cam.distance * std::pow(0.88f, inp.scrollDelta), 5.0f, 120.0f);
            }
        }
        inp.scrollDelta = 0.0f;

        sim.step(dt);
        applyViewModePreset(sim, cam, dt);

        int fbw = 0, fbh = 0;
        glfwGetFramebufferSize(window, &fbw, &fbh);
        if (fbw > 0 && fbh > 0) {
            renderer.renderWorld(sim, cam, fbw, fbh, audio.currentBassLevel(), 0);
            glBindFramebuffer(GL_FRAMEBUFFER, 0);
            glViewport(0, 0, fbw, fbh);
            hud.render(sim, renderer, cam, audio, fbw, fbh, smoothFps, smoothMs);
        }

        glfwSwapBuffers(window);
    }

    audio.stop();
    hud.shutdown();
    renderer.shutdown();
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
