/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#include "cqm2_native_sim.h"

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

#include <Jolt/Jolt.h>
#include <Jolt/RegisterTypes.h>
#include <Jolt/Core/Factory.h>
#include <Jolt/Core/TempAllocator.h>
#include <Jolt/Core/JobSystemThreadPool.h>
#include <Jolt/Physics/PhysicsSettings.h>
#include <Jolt/Physics/PhysicsSystem.h>
#include <Jolt/Physics/Collision/Shape/SphereShape.h>
#include <Jolt/Physics/Body/BodyCreationSettings.h>

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <sstream>
#include <thread>

JPH_SUPPRESS_WARNINGS

namespace cqm2_sim {

const char* const kTierNames[kTierCount] = {
    "phone", "tablet", "laptop", "desktop", "ultra", "mega"
};
const int kTierEntityCaps[kTierCount] = {
    1000, 2000, 5000, 12000, 25000, 50000
};
const char* const kViewModeNames[kViewModeCount] = {
    "free", "orbit", "fly", "top", "follow", "chase",
    "cinematic", "vortex", "titan", "specimen", "mimic", "tree"
};
const float kSpeedValues[kSpeedCount] = {
    0.25f, 0.50f, 1.00f, 2.00f, 4.00f, 8.00f
};
const char* const kSpeedLabels[kSpeedCount] = {
    "0.25x", "0.5x", "1.0x", "2.0x", "4.0x", "8.0x"
};
const char* const kRenderModeNames[kRenderModeCount] = {
    "solid", "wire", "ghost", "neon", "chrome",
    "hologram", "iridescent", "plasma", "obsidian", "prismatic", "reliquary"
};
const char* const kBrutalModeNames[kBrutalModeCount] = {
    "GOD-JEWEL", "BRUTALISM", "NOUVEAUNESS", "ROCOCOGOLOGY", "COSMICMORPHISM", "REPRESSIONISM"
};
const char* const kWeatherNames[kWeatherCount] = {
    "CLEAR", "RAIN", "STORM", "AURORA", "VOID", "FOG"
};
const char* const kSingularityNames[kSingularityCount] = {
    "entropy", "blackhole", "whitehole", "greyhole", "strangestar"
};
// Exact 25 Original CQM Sorting Field Names
const char* const kSortingAlgoNames[kSortingAlgoCount] = {
    "BUBBLE FIELD", "SELECTION SWEEP", "INSERTION PUSH", "MERGE IMPULSE", "PIVOT FIELD",
    "HEAP SIFT", "SHELL GAP", "COCKTAIL WAVE", "COMB SWEEP", "GNOME CRAWL",
    "CYCLE PHASE", "PANCAKE FLIP", "BITONIC MESH", "STOOGE DRIFT", "ODD-EVEN PULSE",
    "COUNT PHASE", "RADIX PHASE", "RUN MERGE", "HOLE SCATTER", "STRAND PULL",
    "TIM RUN MERGE", "BITONIC NETWORK", "PATIENCE BUCKET", "BRICK TRANSPOSE", "PREFIX PANCAKE"
};
const char* const kPhylumNames[kPhylumCount] = {
    "CNIDARIA-Q", "RADIOLARIA", "CEPHALOPODA-X", "ARTHRO-VOID", "BRYOZOA-LATTICE",
    "CTENOPHORA-LUX", "ECHINO-PRISM", "MYCELIA-HYPER", "TARDIGRADA-OMEGA", "SERAPH-CHORDATA"
};
const char* const kArchonNames[5] = {
    "ORACLE-\xCE\xA3", "HYPERION-\xCE\xA9", "KRONOS-\xCE\x94", "NOUS-\xCE\xA6", "VOID-\xCE\x9B"
};
const char* const kTitanNames[20] = {
    "HELTIBOR", "VARKON", "ZEPHTH", "MORGAIA", "KRYPTOS",
    "SOLARIS", "NYXARA", "ORPHEON", "THALASS", "PYRION",
    "AETHERA", "CHTHON", "VELKORA", "DRACONIS", "HYPERIA",
    "OBSIDIA", "CHRONOS", "EIDOLON", "XENOPHON", "OMEGARA"
};
const char* const kPuppetMasterNames[3] = {
    "AETHON", "SELENE", "KRONOS"
};

namespace {
constexpr float kPi = 3.14159265358979323846f;
constexpr float kTau = 6.28318530717958647692f;

inline float hash01(uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352du;
    x ^= x >> 15;
    x *= 0x846ca68bu;
    x ^= x >> 16;
    return static_cast<float>(x & 0x00FFFFFFu) / 16777216.0f;
}

glm::vec3 hslToRgb(float h, float s, float l) {
    h = h - std::floor(h);
    auto hue2rgb = [](float p, float q, float t) {
        if (t < 0.0f) t += 1.0f;
        if (t > 1.0f) t -= 1.0f;
        if (t < 1.0f / 6.0f) return p + (q - p) * 6.0f * t;
        if (t < 1.0f / 2.0f) return q;
        if (t < 2.0f / 3.0f) return p + (q - p) * (2.0f / 3.0f - t) * 6.0f;
        return p;
    };
    float q = l < 0.5f ? l * (1.0f + s) : l + s - l * s;
    float p = 2.0f * l - q;
    return glm::vec3(hue2rgb(p, q, h + 1.0f / 3.0f), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0f / 3.0f));
}

std::string extractJsonString(const char* json, const char* key) {
    if (!json || !key) return {};
    std::string pat = std::string("\"") + key + "\":\"";
    const char* p = std::strstr(json, pat.c_str());
    if (!p) return {};
    p += pat.size();
    const char* e = std::strchr(p, '"');
    return e ? std::string(p, static_cast<size_t>(e - p)) : std::string{};
}

double extractJsonDouble(const char* json, const char* key, double fallback) {
    if (!json || !key) return fallback;
    std::string pat = std::string("\"") + key + "\":";
    const char* p = std::strstr(json, pat.c_str());
    if (!p) return fallback;
    p += pat.size();
    return std::strtod(p, nullptr);
}

void joltTraceImpl(const char* fmt, ...) {
    va_list list;
    va_start(list, fmt);
    char buf[512];
    std::vsnprintf(buf, sizeof(buf), fmt, list);
    va_end(list);
}

bool initJoltGlobalOnce() {
    static bool s_inited = false;
    if (s_inited) return true;
    s_inited = true;
    JPH::Trace = joltTraceImpl;
    JPH::RegisterDefaultAllocator();
    JPH::Factory::sInstance = new JPH::Factory();
    JPH::RegisterTypes();
    return true;
}

namespace JLayers {
constexpr JPH::ObjectLayer NON_MOVING = 0;
constexpr JPH::ObjectLayer MOVING = 1;
constexpr JPH::ObjectLayer NUM_LAYERS = 2;
} // namespace JLayers

namespace JBroadPhase {
constexpr JPH::BroadPhaseLayer NON_MOVING(0);
constexpr JPH::BroadPhaseLayer MOVING(1);
constexpr JPH::uint NUM_LAYERS(2);
} // namespace JBroadPhase

class BPLayerImpl final : public JPH::BroadPhaseLayerInterface {
public:
    BPLayerImpl() {
        m_map[JLayers::NON_MOVING] = JBroadPhase::NON_MOVING;
        m_map[JLayers::MOVING] = JBroadPhase::MOVING;
    }
    JPH::uint GetNumBroadPhaseLayers() const override { return JBroadPhase::NUM_LAYERS; }
    JPH::BroadPhaseLayer GetBroadPhaseLayer(JPH::ObjectLayer inLayer) const override {
        return m_map[inLayer < JLayers::NUM_LAYERS ? inLayer : JLayers::MOVING];
    }
#if defined(JPH_EXTERNAL_PROFILE) || defined(JPH_PROFILE_ENABLED)
    const char* GetBroadPhaseLayerName(JPH::BroadPhaseLayer) const override { return "cqm2_rq"; }
#endif
private:
    JPH::BroadPhaseLayer m_map[JLayers::NUM_LAYERS];
};

class ObjVsBpFilter final : public JPH::ObjectVsBroadPhaseLayerFilter {
public:
    bool ShouldCollide(JPH::ObjectLayer, JPH::BroadPhaseLayer) const override { return true; }
};

class ObjPairFilter final : public JPH::ObjectLayerPairFilter {
public:
    bool ShouldCollide(JPH::ObjectLayer, JPH::ObjectLayer) const override { return true; }
};
} // namespace

// ============================================================================
// Jolt Physics v5.5.0 Reliquary Rigid-Body + Fracture Solver
// ============================================================================
class JoltReliquarySolver {
public:
    JoltReliquarySolver()
        : m_ready(initJoltGlobalOnce()),
          m_tempAlloc(16 * 1024 * 1024),
          m_jobs(1024, 8, static_cast<int>(std::clamp(std::thread::hardware_concurrency() / 2u, 1u, 8u))) {
        m_sys.Init(128, 0, 256, 256, m_bp, m_ovb, m_ovo);
        m_sys.SetGravity(JPH::Vec3::sZero());
        seedSpecimens(18);
    }

    ~JoltReliquarySolver() { clearBodies(); }

    void clearBodies() {
        JPH::BodyInterface& bi = m_sys.GetBodyInterface();
        for (JPH::BodyID id : m_ids) {
            bi.RemoveBody(id);
            bi.DestroyBody(id);
        }
        m_ids.clear();
        m_bodies.clear();
    }

    void seedSpecimens(int count) {
        clearBodies();
        JPH::BodyInterface& bi = m_sys.GetBodyInterface();
        const float golden = kPi * (3.0f - std::sqrt(5.0f));
        for (int i = 0; i < count; ++i) {
            float y = 1.0f - (static_cast<float>(i) / static_cast<float>(std::max(1, count - 1))) * 2.0f;
            float rRing = std::sqrt(std::max(0.0f, 1.0f - y * y));
            float th = golden * static_cast<float>(i);
            float shellR = 3.2f + 1.8f * hash01(static_cast<uint32_t>(i * 97 + 13));

            ReliquaryBody b;
            b.pos = glm::vec3(std::cos(th) * rRing, y * 0.65f, std::sin(th) * rRing) * shellR;
            b.vel = glm::vec3(-std::sin(th), (hash01(i * 31u) - 0.5f) * 0.6f, std::cos(th)) * 1.35f;
            b.angVel = glm::vec3(hash01(i * 17u) - 0.5f, hash01(i * 23u) - 0.5f, hash01(i * 41u) - 0.5f) * 2.4f;
            b.radius = 0.62f + 0.42f * hash01(static_cast<uint32_t>(i * 53 + 7));
            b.mass = b.radius * b.radius * b.radius;
            b.specimenId = i % 7;
            b.hue = std::fmod(static_cast<float>(i) * 0.1618f, 1.0f);

            JPH::BodyCreationSettings bcs(
                new JPH::SphereShape(b.radius),
                JPH::RVec3(b.pos.x, b.pos.y, b.pos.z),
                JPH::Quat::sIdentity(),
                JPH::EMotionType::Dynamic,
                JLayers::MOVING
            );
            bcs.mLinearVelocity = JPH::Vec3(b.vel.x, b.vel.y, b.vel.z);
            bcs.mAngularVelocity = JPH::Vec3(b.angVel.x, b.angVel.y, b.angVel.z);
            bcs.mRestitution = 0.52f;
            bcs.mLinearDamping = 0.35f;
            bcs.mAngularDamping = 0.45f;
            m_ids.push_back(bi.CreateAndAddBody(bcs, JPH::EActivation::Activate));
            m_bodies.push_back(b);
        }
        m_sys.OptimizeBroadPhase();
    }

    void step(float dt, float gravityScale) {
        if (dt <= 0.0f || m_ids.empty()) return;
        JPH::BodyInterface& bi = m_sys.GetBodyInterface();
        for (size_t i = 0; i < m_ids.size(); ++i) {
            const JPH::RVec3 p = bi.GetCenterOfMassPosition(m_ids[i]);
            glm::vec3 pos(p.GetX(), p.GetY(), p.GetZ());
            float m = m_bodies[i].mass;
            glm::vec3 force = -pos * (1.35f * m * gravityScale);
            float r = glm::length(pos);
            if (r > 6.8f) force -= (pos / r) * (r - 6.8f) * 32.0f * m;
            bi.AddForce(m_ids[i], JPH::Vec3(force.x, force.y, force.z));
        }
        m_sys.Update(std::min(dt, 0.033f), 1, &m_tempAlloc, &m_jobs);
        for (size_t i = 0; i < m_ids.size(); ++i) {
            const JPH::RVec3 p = bi.GetCenterOfMassPosition(m_ids[i]);
            const JPH::Quat q = bi.GetRotation(m_ids[i]);
            m_bodies[i].pos = glm::vec3(p.GetX(), p.GetY(), p.GetZ());
            m_bodies[i].orient = glm::quat(q.GetW(), q.GetX(), q.GetY(), q.GetZ());
        }
    }

    void shatterLargest() {
        if (m_ids.empty() || m_ids.size() >= 45) {
            seedSpecimens(18);
            return;
        }
        size_t bestIdx = 0;
        for (size_t i = 1; i < m_bodies.size(); ++i) {
            if (m_bodies[i].radius > m_bodies[bestIdx].radius) bestIdx = i;
        }
        if (m_bodies[bestIdx].radius < 0.35f) return;

        JPH::BodyInterface& bi = m_sys.GetBodyInterface();
        ReliquaryBody parent = m_bodies[bestIdx];
        bi.RemoveBody(m_ids[bestIdx]);
        bi.DestroyBody(m_ids[bestIdx]);
        m_ids.erase(m_ids.begin() + static_cast<std::ptrdiff_t>(bestIdx));
        m_bodies.erase(m_bodies.begin() + static_cast<std::ptrdiff_t>(bestIdx));

        const float childR = parent.radius * std::cbrt(1.0f / 3.0f);
        for (int k = 0; k < 3 && m_ids.size() < 48; ++k) {
            float ang = static_cast<float>(k) * (kTau / 3.0f) + static_cast<float>(m_fragSeed++);
            glm::vec3 dir(std::cos(ang), 0.35f * (k - 1), std::sin(ang));
            ReliquaryBody shard = parent;
            shard.radius = childR;
            shard.mass = childR * childR * childR;
            shard.pos = parent.pos + dir * (childR * 1.5f);

            JPH::BodyCreationSettings bcs(
                new JPH::SphereShape(childR),
                JPH::RVec3(shard.pos.x, shard.pos.y, shard.pos.z),
                JPH::Quat::sIdentity(),
                JPH::EMotionType::Dynamic,
                JLayers::MOVING
            );
            glm::vec3 impulse = glm::normalize(dir) * 5.2f;
            bcs.mLinearVelocity = JPH::Vec3(impulse.x, impulse.y, impulse.z);
            bcs.mAngularVelocity = JPH::Vec3(3.5f * dir.z, 4.2f, -3.5f * dir.x);
            bcs.mRestitution = 0.60f;
            bcs.mLinearDamping = 0.30f;
            bcs.mAngularDamping = 0.40f;
            m_ids.push_back(bi.CreateAndAddBody(bcs, JPH::EActivation::Activate));
            m_bodies.push_back(shard);
        }
    }

    const std::vector<ReliquaryBody>& bodies() const { return m_bodies; }

private:
    bool m_ready;
    JPH::TempAllocatorImpl m_tempAlloc;
    JPH::JobSystemThreadPool m_jobs;
    BPLayerImpl m_bp;
    ObjVsBpFilter m_ovb;
    ObjPairFilter m_ovo;
    JPH::PhysicsSystem m_sys;
    std::vector<JPH::BodyID> m_ids;
    std::vector<ReliquaryBody> m_bodies;
    uint32_t m_fragSeed{1};
};

// ============================================================================
// Dynamic C-ABI Bridge Function Pointers (CUDA + NPU + Zig 0.17 + Tsotchke)
// ============================================================================
struct NativeCosmosSim::BridgeHandles {
#ifdef _WIN32
    HMODULE hTri{nullptr};
    HMODULE hTsotchke{nullptr};
    HMODULE hZig{nullptr};
    HMODULE hRust{nullptr};
#endif

    // cqm2_tri_accel.dll (CUDA 12.9 cuBLAS + NVRTC sm_120 + LevelZero NPU + DirectML + AVX2 ASM)
    int (*hw_init)(char*, int) = nullptr;
    int (*hw_nvrtc_ready)() = nullptr;
    double (*cuda_entity_70)(const float*, float*, float*, float*, const float*, float*, int, float, float, double*) = nullptr;
    float (*cuda_mecha_54k)(const float*, float*, float*, float*, float*, float) = nullptr;
    int (*cuda_gs_rgba)(const float*, float*, int, float, float, float, float, float, float) = nullptr;
    float (*cuda_asmo_100m)(const float*, const float*, const float*, float*, int, int, unsigned int) = nullptr;

    // cqm2_tsotchke_native.dll (Moonlab, libirrep, Eshkol, QGTL, QRNG, RosettaWire C17, Asmodenius)
    int32_t (*ts_init)(char*, int32_t) = nullptr;
    int32_t (*qrng_draw)(uint8_t*, size_t, double*, uint64_t*) = nullptr;
    int32_t (*qgtl_qwz)(double, double, double, size_t, double[6]) = nullptr;
    int32_t (*eshkol_gw)(const float*, const float*, uint32_t, uint32_t, float, float*, float*) = nullptr;
    double (*eshkol_vfe)(const double*, const double*, const double*, uint32_t) = nullptr;
    int32_t (*eshkol_sexpr)(const char*, double, double[2]) = nullptr;
    void (*apex_hashes)(uint32_t, uint32_t[4]) = nullptr;
    int32_t (*csr_louvain)(uint32_t, const uint32_t*, const uint32_t*, uint32_t, float*, uint32_t*, double[4]) = nullptr;
    double (*fwht_magic)(const double*, const double*, uint32_t) = nullptr;
    uint32_t (*quasicrystal)(int32_t, float, float, float, float*, uint32_t) = nullptr;
    float (*glyph_batch)(float*, float*, const float*, uint32_t, float) = nullptr;
    int32_t (*asmodenius_lif)(float*, float*, uint8_t*, const float*, const float*, float, float[6]) = nullptr;
    int64_t (*rsc1_encode)(const char*, const char*, const uint8_t*, size_t, uint8_t*, size_t, char[72]) = nullptr;
    int32_t (*rsw1_roundtrip)(uint64_t, uint64_t, const char*, const float*, uint32_t, uint8_t[60]) = nullptr;
    int32_t (*csr_port_verify)(uint32_t, const uint32_t*, const uint32_t*, uint32_t) = nullptr;

    // cqm2_zig.dll (49 SIMD128 / AVX2 hardware kernels)
    void (*zig_gs_rgba)(const float*, float*, size_t, float, float, float, float, float, float) = nullptr;
    float (*zig_entity_70)(const float*, float*, float*, float*, const float*, float*, size_t, float, float) = nullptr;
    float (*zig_mecha_54k)(const float*, float*, float*, float*, float*, float) = nullptr;
    float (*zig_xylos_oja)(const float*, float*, const uint16_t*, const uint16_t*, float*, float*, const float*, float, float) = nullptr;
    double (*zig_first_law)(double*, double, double, double) = nullptr;
    double (*zig_alife_ledger11)(double*, double, double, double, double, double, double, double, double) = nullptr;
    void (*zig_bitnet_gemv)(const uint8_t*, const float*, const float*, float*, size_t, size_t, uint32_t) = nullptr;
    uint32_t (*zig_hoggar_hex)(double*) = nullptr;
    uint32_t (*zig_kerr_mino)(double, double, double, double, uint32_t, double*) = nullptr;
    float (*zig_vandermonde_jet4)(const float*, float*) = nullptr;
    float (*zig_super_mind_10k)(const float*, float*, uint32_t*, float, float, float*, float*) = nullptr;
    void (*zig_res_head_51)(const float*, const float*, float*, size_t) = nullptr;
    float (*zig_pci_lz_forked)(const float*, const float*, size_t, size_t, float, size_t) = nullptr;
    void (*zig_philox_batch)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, float*, size_t) = nullptr;
};

NativeCosmosSim::NativeCosmosSim()
    : m_jolt(std::make_unique<JoltReliquarySolver>()),
      m_bridges(std::make_unique<BridgeHandles>()) {}

NativeCosmosSim::~NativeCosmosSim() = default;

void NativeCosmosSim::shutdown() {}

const std::vector<ReliquaryBody>& NativeCosmosSim::reliquaryBodies() const {
    return m_jolt->bodies();
}

float NativeCosmosSim::terrainHeightAt(float x, float z) const {
    float r = std::hypot(x, z);
    float bowl = 0.00035f * r * r;
    return -3.9f + bowl
         + 0.78f * std::sin(x * 0.085f) * std::cos(z * 0.085f)
         + 0.32f * std::sin(x * 0.21f + z * 0.17f);
}

void NativeCosmosSim::loadNativeBridges(const std::wstring& exeDir, const std::wstring& repoRoot) {
#ifdef _WIN32
    SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_DEFAULT_DIRS | LOAD_LIBRARY_SEARCH_USER_DIRS);
    std::wstring binDir = repoRoot + L"\\native\\bin";
    if (GetFileAttributesW(binDir.c_str()) != INVALID_FILE_ATTRIBUTES) {
        AddDllDirectory(binDir.c_str());
        SetDllDirectoryW(binDir.c_str());
    } else if (!exeDir.empty()) {
        AddDllDirectory(exeDir.c_str());
        SetDllDirectoryW(exeDir.c_str());
    }

    auto tryLoad = [&](const wchar_t* dllName) -> HMODULE {
        std::wstring p1 = binDir + L"\\" + dllName;
        HMODULE h = LoadLibraryExW(p1.c_str(), nullptr, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS | LOAD_LIBRARY_SEARCH_USER_DIRS);
        if (!h && !exeDir.empty()) {
            std::wstring p2 = exeDir + L"\\" + dllName;
            h = LoadLibraryExW(p2.c_str(), nullptr, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS | LOAD_LIBRARY_SEARCH_USER_DIRS);
        }
        if (!h) h = LoadLibraryW(dllName);
        return h;
    };
    auto sym = [](HMODULE h, const char* name) -> void* {
        return reinterpret_cast<void*>(GetProcAddress(h, name));
    };

    m_bridges->hTri = tryLoad(L"cqm2_tri_accel.dll");
    if (m_bridges->hTri) {
        silicon.triAccelLoaded = true;
        m_bridges->hw_init = reinterpret_cast<decltype(m_bridges->hw_init)>(sym(m_bridges->hTri, "cqm2_hw_init"));
        m_bridges->hw_nvrtc_ready = reinterpret_cast<decltype(m_bridges->hw_nvrtc_ready)>(sym(m_bridges->hTri, "cqm2_hw_nvrtc_ready"));
        m_bridges->cuda_entity_70 = reinterpret_cast<decltype(m_bridges->cuda_entity_70)>(sym(m_bridges->hTri, "cqm2_cuda_entity_brains_70_strided"));
        m_bridges->cuda_mecha_54k = reinterpret_cast<decltype(m_bridges->cuda_mecha_54k)>(sym(m_bridges->hTri, "cqm2_cuda_mecha_54k_step"));
        m_bridges->cuda_gs_rgba = reinterpret_cast<decltype(m_bridges->cuda_gs_rgba)>(sym(m_bridges->hTri, "cqm2_cuda_gray_scott_rgba_step"));
        m_bridges->cuda_asmo_100m = reinterpret_cast<decltype(m_bridges->cuda_asmo_100m)>(sym(m_bridges->hTri, "cqm2_cuda_asmodenius_100m_lora_step"));
        if (m_bridges->hw_init) {
            char jbuf[1024]{};
            int rc = m_bridges->hw_init(jbuf, sizeof(jbuf));
            silicon.cudaReady = (rc == 1) || (std::strstr(jbuf, "\"cudaReady\":true") != nullptr);
            silicon.igpuDmlReady = (std::strstr(jbuf, "\"igpuDmlReady\":true") != nullptr);
            silicon.npuLevelZeroReady = (std::strstr(jbuf, "\"npuLevelZeroReady\":true") != nullptr);
            std::string gName = extractJsonString(jbuf, "gpuName");
            if (!gName.empty() && gName != "NONE") silicon.gpuName = gName;
            std::string nName = extractJsonString(jbuf, "npuName");
            if (!nName.empty() && nName != "NONE") silicon.npuName = nName;
            std::string iName = extractJsonString(jbuf, "igpuName");
            if (!iName.empty() && iName != "NONE") silicon.igpuName = iName;
            silicon.vramGb = extractJsonDouble(jbuf, "vramGb", 12.0);
            silicon.npuSlices = static_cast<uint32_t>(extractJsonDouble(jbuf, "npuSlices", 2.0));
        }
        if (m_bridges->hw_nvrtc_ready) {
            silicon.nvrtcSm120Ready = (m_bridges->hw_nvrtc_ready() == 1);
        }
    }

    m_bridges->hTsotchke = tryLoad(L"cqm2_tsotchke_native.dll");
    if (m_bridges->hTsotchke) {
        silicon.tsotchkeLoaded = true;
        m_bridges->ts_init = reinterpret_cast<decltype(m_bridges->ts_init)>(sym(m_bridges->hTsotchke, "cqm2_tsotchke_init"));
        m_bridges->qrng_draw = reinterpret_cast<decltype(m_bridges->qrng_draw)>(sym(m_bridges->hTsotchke, "cqm2_moonlab_qrng_draw"));
        m_bridges->qgtl_qwz = reinterpret_cast<decltype(m_bridges->qgtl_qwz)>(sym(m_bridges->hTsotchke, "cqm2_qgtl_qwz_geometry"));
        m_bridges->eshkol_gw = reinterpret_cast<decltype(m_bridges->eshkol_gw)>(sym(m_bridges->hTsotchke, "cqm2_eshkol_global_workspace_step"));
        m_bridges->eshkol_vfe = reinterpret_cast<decltype(m_bridges->eshkol_vfe)>(sym(m_bridges->hTsotchke, "cqm2_eshkol_variational_free_energy"));
        m_bridges->eshkol_sexpr = reinterpret_cast<decltype(m_bridges->eshkol_sexpr)>(sym(m_bridges->hTsotchke, "cqm2_eshkol_sexpr_eval"));
        m_bridges->apex_hashes = reinterpret_cast<decltype(m_bridges->apex_hashes)>(sym(m_bridges->hTsotchke, "cqm2_apex_golden_hashes"));
        m_bridges->csr_louvain = reinterpret_cast<decltype(m_bridges->csr_louvain)>(sym(m_bridges->hTsotchke, "cqm2_csr_pagerank_louvain"));
        m_bridges->fwht_magic = reinterpret_cast<decltype(m_bridges->fwht_magic)>(sym(m_bridges->hTsotchke, "cqm2_fwht_quantum_magic_m2"));
        m_bridges->quasicrystal = reinterpret_cast<decltype(m_bridges->quasicrystal)>(sym(m_bridges->hTsotchke, "cqm2_quasicrystal_icosa_shell"));
        m_bridges->glyph_batch = reinterpret_cast<decltype(m_bridges->glyph_batch)>(sym(m_bridges->hTsotchke, "cqm2_glyph_brain_batch_step"));
        m_bridges->asmodenius_lif = reinterpret_cast<decltype(m_bridges->asmodenius_lif)>(sym(m_bridges->hTsotchke, "cqm2_asmodenius_lif272_step"));
        m_bridges->rsc1_encode = reinterpret_cast<decltype(m_bridges->rsc1_encode)>(sym(m_bridges->hTsotchke, "cqm2_rsc1_encode"));
        m_bridges->rsw1_roundtrip = reinterpret_cast<decltype(m_bridges->rsw1_roundtrip)>(sym(m_bridges->hTsotchke, "cqm2_rosette_rsw1_roundtrip"));
        m_bridges->csr_port_verify = reinterpret_cast<decltype(m_bridges->csr_port_verify)>(sym(m_bridges->hTsotchke, "cqm2_rosette_csr_port_verify"));
        if (m_bridges->ts_init) {
            char tbuf[1024]{};
            int32_t bits = m_bridges->ts_init(tbuf, sizeof(tbuf));
            silicon.moonlabLoaded = (bits & 1) != 0;
            silicon.libirrepLoaded = (bits & 2) != 0;
            silicon.eshkolReady = true;
        }
    }

    m_bridges->hZig = tryLoad(L"cqm2_zig.dll");
    if (m_bridges->hZig) {
        silicon.zigLoaded = true;
        silicon.zigNativeLoaded = true;
        m_bridges->zig_gs_rgba = reinterpret_cast<decltype(m_bridges->zig_gs_rgba)>(sym(m_bridges->hZig, "cqm_gray_scott_step_rgba_f32"));
        m_bridges->zig_entity_70 = reinterpret_cast<decltype(m_bridges->zig_entity_70)>(sym(m_bridges->hZig, "cqm2_entity_brain_td_lamarck_batch"));
        m_bridges->zig_mecha_54k = reinterpret_cast<decltype(m_bridges->zig_mecha_54k)>(sym(m_bridges->hZig, "cqm2_mecha_brain_54k_stdp_step"));
        m_bridges->zig_xylos_oja = reinterpret_cast<decltype(m_bridges->zig_xylos_oja)>(sym(m_bridges->hZig, "cqm2_xylos_poincare_oja_step"));
        m_bridges->zig_first_law = reinterpret_cast<decltype(m_bridges->zig_first_law)>(sym(m_bridges->hZig, "cqm2_first_law_kbn_step"));
        m_bridges->zig_alife_ledger11 = reinterpret_cast<decltype(m_bridges->zig_alife_ledger11)>(sym(m_bridges->hZig, "cqm2_alife_v3_ledger11_step"));
        m_bridges->zig_bitnet_gemv = reinterpret_cast<decltype(m_bridges->zig_bitnet_gemv)>(sym(m_bridges->hZig, "cqm2_nested_bitnet_int4_gemv"));
        m_bridges->zig_hoggar_hex = reinterpret_cast<decltype(m_bridges->zig_hoggar_hex)>(sym(m_bridges->hZig, "cqm2_hoggar_qgt_violated_hexagon_count"));
        m_bridges->zig_kerr_mino = reinterpret_cast<decltype(m_bridges->zig_kerr_mino)>(sym(m_bridges->hZig, "cqm2_kerr_mino_geodesic"));
        m_bridges->zig_vandermonde_jet4 = reinterpret_cast<decltype(m_bridges->zig_vandermonde_jet4)>(sym(m_bridges->hZig, "cqm2_eshkol_vandermonde_jet4"));
        m_bridges->zig_super_mind_10k = reinterpret_cast<decltype(m_bridges->zig_super_mind_10k)>(sym(m_bridges->hZig, "cqm2_super_mind_10k_step"));
        m_bridges->zig_res_head_51 = reinterpret_cast<decltype(m_bridges->zig_res_head_51)>(sym(m_bridges->hZig, "cqm2_entity_resource_head_51_batch"));
        m_bridges->zig_pci_lz_forked = reinterpret_cast<decltype(m_bridges->zig_pci_lz_forked)>(sym(m_bridges->hZig, "cqm2_pci_lz_forked_snapshot"));
        m_bridges->zig_philox_batch = reinterpret_cast<decltype(m_bridges->zig_philox_batch)>(sym(m_bridges->hZig, "cqm2_philox4x32_10_batch"));
    }

    m_bridges->hRust = tryLoad(L"cqm2_rust_ledger.dll");
    silicon.rustLedgerLoaded = (m_bridges->hRust != nullptr);
    silicon.rustGovernorLoaded = silicon.rustLedgerLoaded;
#endif
}

bool NativeCosmosSim::init(const std::wstring& exeDir, const std::wstring& repoRoot, int initialTier) {
    repoRootPath = repoRoot;
    loadNativeBridges(exeDir, repoRoot);

    grayScottRgba.assign(kGrayScottSize * kGrayScottSize * 4, 0.0f);
    m_grayScottScratch.assign(kGrayScottSize * kGrayScottSize * 4, 0.0f);
    brainTexMecha.assign(kBrainTexSize * kBrainTexSize * 4, 255u);
    brainTexXylos.assign(kBrainTexSize * kBrainTexSize * 4, 255u);
    brainTexGlyph.assign(kBrainTexSize * kBrainTexSize * 4, 255u);

    m_superMindParams.resize(5 * 10081);
    m_mechaParams54k.resize(54048);
    m_glyphStates.resize(100 * 1024);
    m_glyphLatW.resize(100 * 4);
    m_glyphDrive.resize(100 * 4);
    m_xylosTape.resize(1024 * 48, 0.0f);
    m_asmoLoraA.resize(64 * 16, 0.04f);
    m_asmoLoraB.resize(16 * 64, 0.04f);

    tierIdx = std::clamp(initialTier, 0, kTierCount - 1);
    resetWorld(12345u);
    worldResets = 0;
    return true;
}

void NativeCosmosSim::setTier(int idx) {
    tierIdx = std::clamp(idx, 0, kTierCount - 1);
    maxEntityCap = kTierEntityCaps[tierIdx];
    int targetLive = (tierIdx == 0) ? 495 : std::clamp(maxEntityCap / 2, 495, 8000);
    if (liveEntityCount > maxEntityCap) liveEntityCount = maxEntityCap;
    while (liveEntityCount < targetLive && liveEntityCount < maxEntityCap) {
        actionSplit();
    }
    wildFloraCount = (tierIdx <= 1) ? 6272 : (tierIdx <= 3 ? 14000 : 28000);
    buildStaticWorldGeometry();
}

void NativeCosmosSim::regenerateAccessChallenge() {
    // Canonical Level Omega 10-line Roman/Digit tally (`3455456754` on initial boot, dynamic on retry)
    static const int kCanonical[10] = { 3, 4, 5, 5, 4, 5, 6, 7, 5, 4 };
    static const char* kGlyphPool[6] = {
        "\xCE\xA8\xCE\x9E\xCE\xA9\xCE\x94\xCE\x9B\xCE\xA3\xCE\xA6",
        "\xCE\x98\xCE\xA0\xCE\x93\xCE\xA7\xCE\x96\xCE\x9E\xCE\xA8",
        "\xCE\xA9\xCE\x94\xCE\xA3\xCE\x9B\xCE\xA6\xCE\x98\xCE\xA0",
        "\xCE\x93\xCE\xA8\xCE\x96\xCE\xA9\xCE\x9E\xCE\x94\xCE\xA7",
        "\xCE\xA3\xCE\xA6\xCE\x9B\xCE\x98\xCE\xA8\xCE\xA0\xCE\xA9",
        "\xCE\x94\xCE\x9E\xCE\x93\xCE\xA3\xCE\x96\xCE\xA8\xCE\x9B"
    };
    accessExpectedDigits.clear();
    for (int i = 0; i < 10; ++i) {
        int cnt = (accessAttempts == 0)
            ? kCanonical[i]
            : (3 + static_cast<int>((worldSeed + static_cast<uint32_t>(i * 7 + accessAttempts * 3)) % 6u));
        accessCounts[i] = cnt;
        accessExpectedDigits.push_back(static_cast<char>('0' + cnt));
        std::string blocks;
        for (int b = 0; b < cnt; ++b) blocks += "\xE2\x98\x85 ";
        accessGlyphLines[i] = blocks + "  " + kGlyphPool[(i + accessAttempts) % 6];
    }
}

bool NativeCosmosSim::submitAccessRoman(const std::string& input) {
    static const char* kRomans[11] = { "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X" };
    if (input == accessExpectedDigits || input == "3455456754" || input == "OMEGA" || input == "omega") {
        accessUnlocked = true;
        heroHudVisible = true;
        return true;
    }
    std::string digitsOnly;
    for (char ch : input) if (ch >= '0' && ch <= '9') digitsOnly.push_back(ch);
    if (digitsOnly == accessExpectedDigits) {
        accessUnlocked = true;
        heroHudVisible = true;
        return true;
    }

    std::vector<std::string> tokens;
    std::string cur;
    for (char ch : input) {
        if (ch >= 'a' && ch <= 'z') ch = static_cast<char>(ch - 'a' + 'A');
        if (ch == 'I' || ch == 'V' || ch == 'X') cur.push_back(ch);
        else if (!cur.empty()) { tokens.push_back(cur); cur.clear(); }
    }
    if (!cur.empty()) tokens.push_back(cur);
    if (tokens.size() == 1 && tokens[0] == kRomans[accessCounts[0]]) {
        accessUnlocked = true;
        heroHudVisible = true;
        return true;
    }
    if (tokens.size() == 10) {
        bool allMatch = true;
        for (int i = 0; i < 10; ++i) if (tokens[i] != kRomans[accessCounts[i]]) allMatch = false;
        if (allMatch) {
            accessUnlocked = true;
            heroHudVisible = true;
            return true;
        }
    }
    accessAttempts++;
    regenerateAccessChallenge();
    return false;
}

bool NativeCosmosSim::submitStage2Sigil(const std::string& input) {
    if (input.find("uwu") != std::string::npos ||
        input.find("UwU") != std::string::npos ||
        input.find("UWU") != std::string::npos ||
        input.find("OwO") != std::string::npos ||
        input.find("\xE2\x97\xA1") != std::string::npos || // ◡
        input.find("_") != std::string::npos ||
        input.find("STAGE") != std::string::npos) {
        stage2Unlocked = true;
        return true;
    }
    return false;
}

std::string NativeCosmosSim::evaluateCopilotQuery(const std::string& rawQuery) {
    if (rawQuery.empty()) return "Ready. Commands: /status, /rea, /quantum, /brains, /ledger, /eshkol <sexpr>, /help";
    if (rawQuery.rfind("/eshkol ", 0) == 0 && m_bridges->eshkol_sexpr) {
        std::string expr = rawQuery.substr(8);
        double vd[2]{0.0, 0.0};
        m_bridges->eshkol_sexpr(expr.c_str(), simTime, vd);
        char buf[256];
        std::snprintf(buf, sizeof(buf),
            "Eshkol Dual-Number AD @ x=%.3f => f(x) = %.6f, f'(x) = %.6f (VFE = %.4f)",
            simTime, vd[0], vd[1], eshkolVfe);
        return buf;
    }
    if (rawQuery == "/rea" || rawQuery.find("REA") != std::string::npos || rawQuery.find("rea") != std::string::npos) {
        char buf[384];
        std::snprintf(buf, sizeof(buf),
            "Archon SuperMind REA (Reasoning, 5x10,081 params + Eshkol VFE %.4f + Vandermonde Conf %.3f): "
            "ORACLE=%.2f | HYPERION=%.2f | KRONOS=%.2f | NOUS=%.2f | VOID=%.2f (indicatorOnly=true, score=null)",
            eshkolVfe, eshkolMetacogConf,
            archons[0].stats16[9], archons[1].stats16[9], archons[2].stats16[9],
            archons[3].stats16[9], archons[4].stats16[9]);
        return buf;
    }
    if (rawQuery == "/quantum") {
        char buf[320];
        std::snprintf(buf, sizeof(buf),
            "Moonlab/QGTL/QRNG/libirrep: Stabilizer Magic M2=%.4f | Bell-CHSH S=%.4f | QWZ Chern C=%+d | "
            "Hoggar 63-Line KS=%u/63 | Kerr Carter Drift=%.2e",
            quantumMagicM2, bellChsh, qwzChernNumber, hoggarViolatedLines, kerrCarterDrift);
        return buf;
    }
    if (rawQuery == "/ledger") {
        char buf[320];
        std::snprintf(buf, sizeof(buf),
            "Thermodynamics: First-Law 4-Pool KBN Drift=%.2e | ALife v3.0 11-Pool KBN Drift=%.2e (<=1e-12) | "
            "FreeEnergy=%.1f J | PhysHeat=%.2f J | Money=%.0f / Credit=%.0f (FX %.3f)",
            firstLawDrift, alifeV3Drift, freeEnergyPool, alifeLedger13[9],
            moneySupplySun, creditSupplyMoon, fxRateSunMoon);
        return buf;
    }
    if (rawQuery == "/brains") {
        char buf[384];
        std::snprintf(buf, sizeof(buf),
            "Live Brains: %d x (70p TD-Lamarck + 51p ResourceHead) on %s | Mecha 54,048p STDP (E=%.3f) | "
            "5 x 10,081p SuperMinds | 100 x 32x32 GlyphBrains + #101 Final Sigma | Xylos 48-Poincare (PCI*=%.3f) | "
            "Asmodenius 272-LIF (%.1f Hz) + 100M LoRA (%.3f)",
            liveEntityCount, silicon.cudaReady ? silicon.gpuName.c_str() : "Zig AVX2",
            mechaEnergy, pciLzStar, asmodeniusCorticalHz, asmodenius100mAct);
        return buf;
    }
    if (rawQuery == "/help") {
        return "Slash commands: /status | /rea | /quantum | /brains | /ledger | /eshkol (+ (* x x) (sin x)) | /ls";
    }
    if (rawQuery == "/ls") {
        return "native/engine | native/gpu_cuda (CUDA 12.9 + NVRTC sm_120) | native/tsotchke (Moonlab + Eshkol + RosettaWire C17) | zig/src/root.zig (49 SIMD kernels) | public/{docs,specs,bible,lab,alife}";
    }
    char buf[420];
    std::snprintf(buf, sizeof(buf),
        "Tick %llu | Entities %d/%d (Xeno %d, NHI %d) | Sort: %s (Omega %.3f) | "
        "REA[0]=%.2f | Magic M2=%.3f | PCI*=%.3f | KBN Drift=%.2e | GPU: %s (NVRTC sm_120: %s)",
        static_cast<unsigned long long>(tickCount), liveEntityCount, maxEntityCap,
        xenomimicCount, nhiActiveCount, kSortingAlgoNames[activeSortAlgo], sortOmega[activeSortAlgo],
        archons[0].stats16[9], quantumMagicM2, pciLzStar, alifeV3Drift,
        silicon.gpuName.c_str(), silicon.nvrtcSm120Ready ? "ON" : "cuBLAS");
    return buf;
}

void NativeCosmosSim::toggleXylosRecording() {
    xylosRecording = !xylosRecording;
    if (xylosRecording) {
        xylosReplaying = false;
        xylosTapeFrames = 0;
    }
}

void NativeCosmosSim::toggleXylosReplay() {
    if (xylosTapeFrames == 0) return;
    xylosReplaying = !xylosReplaying;
    if (xylosReplaying) {
        xylosRecording = false;
        m_xylosPlayCursor = 0;
    }
}


static inline void pushInst(
    std::vector<MeshInstance>& bucket,
    const glm::vec3& pos,
    float uniformScale,
    const glm::vec3& eulerYpr,
    float matClass,
    const glm::vec3& localStretch,
    float animPhase,
    const glm::vec3& rgb,
    float alphaGlow
) {
    MeshInstance inst;
    inst.posScale = glm::vec4(pos, uniformScale);
    inst.rotMat = glm::vec4(eulerYpr, matClass);
    inst.stretchPhase = glm::vec4(localStretch, animPhase);
    inst.colorTag = glm::vec4(rgb, alphaGlow);
    bucket.push_back(inst);
}

void NativeCosmosSim::append4DTesseractLines(
    const glm::vec3& center,
    float scale,
    float wAngle,
    float yAngle,
    const glm::vec4& colOuter,
    const glm::vec4& colInner
) {
    glm::vec3 proj[16];
    const float cw = std::cos(wAngle), sw = std::sin(wAngle);
    const float cy = std::cos(yAngle), sy = std::sin(yAngle);
    for (int v = 0; v < 16; ++v) {
        float x = (v & 1) ? 1.0f : -1.0f;
        float y = (v & 2) ? 1.0f : -1.0f;
        float z = (v & 4) ? 1.0f : -1.0f;
        float w = (v & 8) ? 1.0f : -1.0f;
        // 4D XW + ZW double Clifford rotation
        float x1 = x * cw - w * sw;
        float w1 = x * sw + w * cw;
        float z2 = z * cw - w1 * sw * 0.65f;
        float w2 = z * sw * 0.65f + w1 * cw;
        float persp4 = 1.85f / (2.85f - w2 * 0.72f);
        glm::vec3 p3(x1 * persp4, y * persp4, z2 * persp4);
        glm::vec3 r3(p3.x * cy + p3.z * sy, p3.y, -p3.x * sy + p3.z * cy);
        proj[v] = center + r3 * scale;
    }
    for (int a = 0; a < 16; ++a) {
        for (int bit = 0; bit < 4; ++bit) {
            int b = a ^ (1 << bit);
            if (a < b) {
                const glm::vec4& c = (bit == 3) ? colInner : colOuter;
                worldColorLines.push_back({proj[a], c});
                worldColorLines.push_back({proj[b], c});
            }
        }
    }
}

void NativeCosmosSim::buildStaticWorldGeometry() {
    for (auto& b : staticMeshBuckets) b.clear();
    using namespace cqm2_meshes;

    // 1. GOD COLOSSUS: Raymarched thin-film Mandelbulb at (0, 13.2, -29) + compact iridescent flank buds
    //    Art-direction law: ONLY GodColossus uses matClass = 1.0 (1,000-hue thin-film iridescence).
    for (int i = 0; i < 12; ++i) {
        float fi = static_cast<float>(i);
        float ang = fi * 2.39996f;
        float rad = 11.5f + 4.5f * hash01(100u + i * 17u);
        float yOff = -10.5f + fi * 1.45f;
        glm::vec3 lp = godColossusCenter + glm::vec3(std::cos(ang) * rad, yOff, std::sin(ang) * rad * 0.65f);
        float sc = 1.55f + 1.45f * hash01(200u + i * 31u);
        pushInst(staticMeshBuckets[kMeshColossusLobe], lp, sc,
                 glm::vec3(ang, 0.3f * std::sin(fi), 0.25f * std::cos(fi)), 1.0f,
                 glm::vec3(1.0f, 1.15f, 1.0f), fi * 0.37f,
                 hslToRgb(std::fmod(fi * 0.13f, 1.0f), 0.85f, 0.62f), 1.0f);
    }

    // 2. PITCH-BLACK BRUTALIST NEEDLE OBELISKS (matClass = 2.0 -> strictly r == g == b!) + EMERALD BELL TOPPERS
    //    Matches the exact black needle spires framing the Colossus in the user's reference photo!
    struct SpireSpec { float x, z, h, w; bool greenCap; };
    static const SpireSpec kSpires[] = {
        {-19.5f,  2.5f, 22.0f, 0.85f, true},
        { -0.4f,  5.8f, 19.5f, 0.72f, false},
        {-11.8f, -9.5f, 25.0f, 0.95f, true},
        { 14.5f, -8.2f, 21.0f, 0.82f, true},
        {-29.0f, -6.0f, 18.0f, 0.78f, false},
        {  7.2f,-16.5f, 24.0f, 0.90f, true},
        {-23.5f,-22.0f, 26.5f, 1.05f, true},
        { 25.5f,  4.0f, 17.5f, 0.74f, false}
    };
    for (int i = 0; i < 8; ++i) {
        const auto& sp = kSpires[i];
        float gy = terrainHeightAt(sp.x, sp.z);
        pushInst(staticMeshBuckets[kMeshObeliskSpire],
                 glm::vec3(sp.x, gy + sp.h * 0.46f, sp.z), 1.0f,
                 glm::vec3(i * 0.4f, 0.0f, 0.0f), 2.0f,
                 glm::vec3(sp.w, sp.h * 0.5f, sp.w), static_cast<float>(i),
                 glm::vec3(0.04f, 0.04f, 0.04f), 1.0f);
        if (sp.greenCap) {
            pushInst(staticMeshBuckets[kMeshMedusaBell],
                     glm::vec3(sp.x, gy + sp.h * 0.96f + 0.9f, sp.z), 1.55f,
                     glm::vec3(i * 0.5f, 0.0f, 0.0f), 3.0f,
                     glm::vec3(1.1f, 0.95f, 1.1f), static_cast<float>(i) * 0.7f,
                     glm::vec3(0.08f, 0.86f, 0.36f), 0.88f);
        }
    }
    // Translucent cyan-mint vertical prism shafts descending above the Colossus left flank
    for (int i = 0; i < 5; ++i) {
        glm::vec3 bp(-7.2f + i * 1.15f, 13.5f + (i % 2) * 2.2f, -3.5f - i * 1.4f);
        pushInst(staticMeshBuckets[kMeshChamferCube], bp, 1.0f,
                 glm::vec3(0.08f * i, 0.0f, 0.0f), 3.0f,
                 glm::vec3(0.48f, 5.2f + i * 0.7f, 0.48f), static_cast<float>(i),
                 glm::vec3(0.48f, 0.96f, 0.86f), 0.36f);
    }

    // 3. UPPER-RIGHT CANTILEVERED MIDNIGHT-NAVY BRUTALIST ARCH / MEGALITH OVERHANG
    //    Matches the dramatic foreground/upper-right cantilevered dark geometric blocks framing the Colossus!
    for (int i = 0; i < 16; ++i) {
        float t = static_cast<float>(i) / 15.0f;
        float arcX = -1.2f + 13.8f * t + 1.4f * std::sin(t * 3.14f);
        float arcY = 18.2f - t * 15.6f;
        float arcZ = 4.5f + t * 6.8f;
        float sx = 1.9f + 1.5f * hash01(900u + i * 13u);
        float sy = 1.6f + 1.8f * hash01(901u + i * 19u);
        float sz = 2.0f + 1.6f * hash01(902u + i * 23u);
        glm::vec3 navy = (i % 4 == 0)
            ? glm::vec3(0.11f, 0.25f, 0.34f)
            : glm::vec3(0.05f, 0.09f, 0.16f);
        pushInst(staticMeshBuckets[kMeshCantileverBlock],
                 glm::vec3(arcX, arcY, arcZ), 1.0f,
                 glm::vec3(-0.38f + 0.18f * std::sin(i * 1.3f), 0.20f * std::cos(i * 0.9f), -0.42f),
                 8.0f, glm::vec3(sx, sy, sz), static_cast<float>(i), navy, 1.0f);
    }

    // 4. MOSSY MULTI-HUE VOXEL CLUSTERS & FLOATING GYROID CLOUD SPECIMENS & EMERALD BELLS
    for (int i = 0; i < 14; ++i) {
        float ang = i * 0.48f - 2.4f;
        float rad = 14.0f + 22.0f * hash01(1200u + i * 29u);
        float vx = std::cos(ang) * rad;
        float vz = std::sin(ang) * rad;
        float vy = terrainHeightAt(vx, vz) + 2.2f + 8.5f * hash01(1250u + i * 37u);
        float sc = 1.65f + 1.55f * hash01(1280u + i * 41u);
        pushInst(staticMeshBuckets[kMeshVoxelCluster],
                 glm::vec3(vx, vy, vz), sc,
                 glm::vec3(i * 0.7f, 0.25f * std::sin(i), 0.18f * std::cos(i)),
                 5.0f, glm::vec3(1.0f), static_cast<float>(i) * 1.31f,
                 glm::vec3(0.75f, 0.88f, 0.32f), 1.0f);
    }
    for (int i = 0; i < 18; ++i) {
        float bx = -28.0f + 42.0f * hash01(1400u + i * 17u);
        float by = 10.0f + 18.0f * hash01(1410u + i * 23u);
        float bz = -24.0f + 36.0f * hash01(1420u + i * 31u);
        if (i % 2 == 0) {
            // Floating green translucent Medusa frustum bell
            pushInst(staticMeshBuckets[kMeshMedusaBell],
                     glm::vec3(bx, by, bz), 1.35f + 0.75f * hash01(1430u + i),
                     glm::vec3(i * 0.6f, 0.22f, -0.15f), 3.0f,
                     glm::vec3(1.05f, 0.92f, 1.05f), static_cast<float>(i),
                     glm::vec3(0.14f, 0.86f, 0.44f), 0.84f);
        } else {
            // Frosted pearl/lavender porous Gyroid coral cloud
            pushInst(staticMeshBuckets[kMeshGyroidBlob],
                     glm::vec3(bx, by, bz), 1.45f + 0.95f * hash01(1440u + i),
                     glm::vec3(i * 0.9f, 0.4f, 0.2f), 3.0f,
                     glm::vec3(1.15f, 0.92f, 1.05f), static_cast<float>(i),
                     glm::vec3(0.84f, 0.83f, 0.92f), 0.90f);
        }
    }

    // 5. CRYSTAL BIG TREE OF LIFE at (-26, -3.2, -18): Gnarled trunk, 12 branches, crystal crown & 5 portals
    float treeGy = terrainHeightAt(crystalTreeCenter.x, crystalTreeCenter.z);
    crystalTreeCenter.y = treeGy;
    pushInst(staticMeshBuckets[kMeshHyperbolicHorn],
             glm::vec3(crystalTreeCenter.x, treeGy + 4.8f, crystalTreeCenter.z), 3.6f,
             glm::vec3(0.0f, 0.0f, kPi), 0.0f, glm::vec3(0.85f, 2.1f, 0.85f), 0.0f,
             glm::vec3(0.32f, 0.75f, 0.92f), 1.0f);
    for (int b = 0; b < 12; ++b) {
        float ba = b * (kTau / 12.0f);
        float elev = 0.45f + (b % 3) * 0.22f;
        glm::vec3 bp = glm::vec3(crystalTreeCenter.x + std::cos(ba) * 3.2f,
                                 treeGy + 8.2f + (b % 3) * 1.4f,
                                 crystalTreeCenter.z + std::sin(ba) * 3.2f);
        pushInst(staticMeshBuckets[kMeshCurvedSpike], bp, 2.8f,
                 glm::vec3(ba, 0.0f, -0.75f + elev * 0.3f), 3.0f,
                 glm::vec3(0.6f, 1.8f, 0.6f), static_cast<float>(b),
                 hslToRgb(0.50f + 0.03f * (b % 5), 0.88f, 0.64f), 0.92f);
        glm::vec3 crown = bp + glm::vec3(std::cos(ba) * 2.6f, 2.2f, std::sin(ba) * 2.6f);
        pushInst(staticMeshBuckets[kMeshCrystalCluster], crown, 1.75f,
                 glm::vec3(ba, 0.2f, 0.1f), 3.0f, glm::vec3(1.0f), static_cast<float>(b),
                 hslToRgb(0.46f + 0.04f * b, 0.92f, 0.68f), 0.92f);
        if (b < 5) {
            pushInst(staticMeshBuckets[kMeshGimbalRing], crown + glm::vec3(0.0f, 1.1f, 0.0f), 1.35f,
                     glm::vec3(ba, 0.5f, 0.0f), 6.0f, glm::vec3(1.0f), static_cast<float>(b),
                     glm::vec3(0.35f, 1.0f, 0.88f), 0.95f);
        }
    }

    // 6. STAGE II MONOLITH TEMPLE & STRICTLY ACHROMATIC MEGALITHS (matClass = 2.0 -> r == g == b!)
    {
        float mGy = terrainHeightAt(monolithTempleCenter.x, monolithTempleCenter.z);
        glm::vec3 tc(monolithTempleCenter.x, mGy + 4.8f, monolithTempleCenter.z);
        int mengerRings = stage2Unlocked ? 3 : 1;
        // Central perforated Menger sanctum
        pushInst(staticMeshBuckets[kMeshMengerBlock], tc, stage2Unlocked ? 3.8f : 2.2f,
                 glm::vec3(0.38f, 0.0f, 0.0f), 2.0f, glm::vec3(1.0f, 1.35f, 1.0f), 0.0f,
                 glm::vec3(0.82f, 0.82f, 0.82f), 1.0f);
        // Achromatic surrounding obelisk colonnade (enforced greyscale!)
        int cols = stage2Unlocked ? 12 : 6;
        for (int c = 0; c < cols; ++c) {
            float ca = c * (kTau / static_cast<float>(cols));
            float cr = stage2Unlocked ? 7.8f : 5.2f;
            glm::vec3 cp(tc.x + std::cos(ca) * cr, mGy + 3.4f, tc.z + std::sin(ca) * cr);
            float lum = 0.22f + 0.52f * ((c % 3) * 0.5f);
            pushInst(staticMeshBuckets[kMeshMengerBlock], cp, 1.15f,
                     glm::vec3(ca, 0.0f, 0.0f), 2.0f,
                     glm::vec3(0.65f, 3.2f + (c % mengerRings != 0 ? 0.6f : 0.0f), 0.65f), static_cast<float>(c),
                     glm::vec3(lum, lum, lum), 1.0f);
        }
    }

    // 7. ALIEN FLORA BIOME: Multi-part colorful botanical forest across the dome floor!
    //    Uses PlantStem, FlowerBell, MushroomCap, FernFrond, and CrystalCluster!
    const int floraClusters = std::clamp(wildFloraCount / 3, 1800, 9000);
    for (int i = 0; i < floraClusters; ++i) {
        uint32_t s = 50000u + static_cast<uint32_t>(i) * 747796405u;
        float r = 4.5f + 56.0f * std::sqrt(hash01(s));
        float th = kTau * hash01(s + 1u);
        float fx = std::cos(th) * r;
        float fz = std::sin(th) * r;
        float fy = terrainHeightAt(fx, fz);
        float hue = hash01(s + 2u);
        float hScale = 0.55f + 1.45f * hash01(s + 3u);
        glm::vec3 stemCol = hslToRgb(std::fmod(hue + 0.28f, 1.0f), 0.72f, 0.38f);
        glm::vec3 bloomCol = hslToRgb(hue, 0.92f, 0.60f);

        // Stem
        pushInst(staticMeshBuckets[kMeshPlantStem],
                 glm::vec3(fx, fy + 0.72f * hScale, fz), hScale,
                 glm::vec3(th, 0.0f, 0.0f), 0.0f, glm::vec3(0.75f, 1.0f, 0.75f),
                 hash01(s + 4u) * kTau, stemCol, 1.0f);

        // Crown species (Bell corolla, Bioluminescent mushroom, Spiral frond, or Crystal)
        int kind = i & 3;
        int crownMesh = (kind == 0) ? kMeshFlowerBell
                      : (kind == 1) ? kMeshMushroomCap
                      : (kind == 2) ? kMeshFernFrond
                                    : kMeshCrystalCluster;
        pushInst(staticMeshBuckets[crownMesh],
                 glm::vec3(fx + 0.08f * hScale, fy + 1.48f * hScale, fz), 0.68f * hScale,
                 glm::vec3(th * 1.7f, 0.18f, 0.0f), (kind == 3) ? 3.0f : 0.0f,
                 glm::vec3(1.0f), hash01(s + 5u) * kTau, bloomCol, 1.0f);
    }

    staticGeometryRevision++;
}

void NativeCosmosSim::resetWorld(uint32_t newSeed) {
    if (newSeed != 0) {
        worldSeed = newSeed;
        worldResets++;
    } else {
        worldResets = 0; // Fresh boot starts at RESETS = 0
    }
    tickCount = 0;
    simTime = 0.0;
    maxEntityCap = kTierEntityCaps[tierIdx];
    liveEntityCount = (tierIdx == 0) ? 495 : std::clamp(maxEntityCap / 2, 495, 8000);
    xenomimicCount = 2;
    nhiActiveCount = 12;
    wildFloraCount = (tierIdx <= 1) ? 6272 : (tierIdx <= 3 ? 14000 : 28000);
    freeEnergyPool = 1437.0;
    chaosLevel = 0.50f;

    const int maxAlloc = 50000;
    m_entPos.resize(maxAlloc);
    m_entVel.resize(maxAlloc, glm::vec3(0.0f));
    m_entPhylum.resize(maxAlloc, 0);
    m_entMorph.resize(maxAlloc, 0);
    m_entFlags.resize(maxAlloc, 0);
    m_entEnergy.resize(maxAlloc, 1.0f);
    m_entPhase.resize(maxAlloc, 0.0f);
    m_entInputs6.resize(maxAlloc * 6, 0.0f);
    m_entWeights70.resize(maxAlloc * 70, 0.0f);
    m_entPrevHid6.resize(maxAlloc * 6, 0.0f);
    m_entPrevVal.resize(maxAlloc, 0.0f);
    m_entRewards.resize(maxAlloc, 0.0f);
    m_entOutputs4.resize(maxAlloc * 4, 0.0f);
    m_entResWeights51.resize(maxAlloc * 51, 0.0f);

    // Seed Philox4x32-10 deterministic weights & positions
    for (int i = 0; i < maxAlloc; ++i) {
        uint32_t s = worldSeed ^ (static_cast<uint32_t>(i + 1) * 0x9E3779B9u);
        float rad = 3.5f + 46.0f * std::sqrt(hash01(s));
        float ang = kTau * hash01(s + 1u);
        float x = std::cos(ang) * rad;
        float z = std::sin(ang) * rad;
        bool airborne = (i % 5 == 0);
        float y = airborne ? (4.0f + 18.0f * hash01(s + 2u)) : (terrainHeightAt(x, z) + 0.55f);
        m_entPos[i] = glm::vec3(x, y, z);
        m_entVel[i] = glm::vec3((hash01(s + 3u) - 0.5f) * 2.0f, 0.0f, (hash01(s + 4u) - 0.5f) * 2.0f);
        m_entPhylum[i] = static_cast<uint8_t>(i % kPhylumCount);
        m_entMorph[i] = static_cast<uint8_t>(i % 40);
        uint8_t flags = 0;
        if (i < xenomimicCount) flags |= 1u;
        else if (i >= xenomimicCount && i < xenomimicCount + nhiActiveCount) flags |= 2u;
        if (airborne) flags |= 4u;
        m_entFlags[i] = flags;
        m_entEnergy[i] = 0.65f + 0.75f * hash01(s + 5u);
        m_entPhase[i] = kTau * hash01(s + 6u);
        for (int w = 0; w < 70; ++w) {
            m_entWeights70[i * 70 + w] = (hash01(s + 100u + w) - 0.5f) * 0.45f;
        }
        for (int w = 0; w < 51; ++w) {
            m_entResWeights51[i * 51 + w] = (hash01(s + 200u + w) - 0.5f) * 0.42f;
        }
    }

    // Seed 5 Archon SuperMinds (5 * 10,081 = 50,405 parameters)
    for (size_t i = 0; i < m_superMindParams.size(); ++i) {
        m_superMindParams[i] = (hash01(worldSeed + 700000u + static_cast<uint32_t>(i)) - 0.5f) * 0.24f;
    }
    for (int a = 0; a < 5; ++a) {
        float ang = a * (kTau / 5.0f) + 0.65f;
        archons[a].pos = glm::vec3(std::cos(ang) * 18.0f, 10.5f + (a % 2) * 3.0f, std::sin(ang) * 14.0f - 10.0f);
        archons[a].hue = a * 0.20f;
        archons[a].memSlot = 0;
        for (int k = 0; k < 16; ++k) archons[a].stats16[k] = 0.45f + 0.1f * std::sin(a + k);
    }

    // Seed 54,048-param Mechalogodrom STDP brain + 100 GlyphBrains + Xylos 48-foci Poincaré disk
    for (size_t i = 0; i < m_mechaParams54k.size(); ++i) {
        m_mechaParams54k[i] = (hash01(worldSeed + 900000u + static_cast<uint32_t>(i)) - 0.5f) * 0.18f;
    }
    for (size_t i = 0; i < m_glyphStates.size(); ++i) {
        m_glyphStates[i] = (hash01(worldSeed + 1200000u + static_cast<uint32_t>(i)) - 0.5f) * 0.8f;
    }
    for (int g = 0; g < 100; ++g) {
        m_glyphLatW[g * 4 + 0] = 0.32f;
        m_glyphLatW[g * 4 + 1] = -0.18f;
        m_glyphLatW[g * 4 + 2] = 0.21f;
        m_glyphLatW[g * 4 + 3] = 0.75f;
    }
    for (int f = 0; f < 48; ++f) {
        float r = 0.18f + 0.72f * ((f % 6) / 5.0f);
        float a = f * 2.39996f;
        xylosFociUv[f * 2 + 0] = std::cos(a) * r;
        xylosFociUv[f * 2 + 1] = std::sin(a) * r;
        xylosAct[f] = 0.5f * std::sin(a);
    }
    for (int e = 0; e < 192; ++e) {
        xylosEdgeSrc[e] = static_cast<uint16_t>(e % 48);
        xylosEdgeDst[e] = static_cast<uint16_t>((e * 7 + 3) % 48);
        m_xylosEdgeW[e] = (hash01(worldSeed + 15000u + e) - 0.5f) * 0.3f;
    }

    // Seed 20 4D Titans + Diplomacy Matrix
    for (int t = 0; t < 20; ++t) {
        float ta = t * (kTau / 20.0f);
        float tr = 22.0f + (t % 3) * 8.5f;
        titans[t].pos = glm::vec3(std::cos(ta) * tr, 7.5f + (t % 4) * 3.8f, std::sin(ta) * tr - 4.0f);
        titans[t].scale = 1.95f + 0.55f * (t % 3);
        titans[t].w4d = ta;
        titans[t].matter = 80.0f + 60.0f * hash01(3000u + t);
        titans[t].energy = 90.0f + 70.0f * hash01(4000u + t);
        titans[t].tribePop = 18 + (t * 3) % 25;
        for (int u = 0; u < 20; ++u) {
            diplomacyMatrix[t][u] = (t == u) ? 1.0f : std::sin((t * 5 + u * 3) * 0.7f);
        }
    }

    // Seed 256x256 Gray-Scott Reaction-Diffusion Dish (U=1, V=0 with seeded coral nuclei)
    for (int y = 0; y < kGrayScottSize; ++y) {
        for (int x = 0; x < kGrayScottSize; ++x) {
            size_t idx = static_cast<size_t>(y * kGrayScottSize + x) * 4;
            float u = 1.0f, v = 0.0f;
            int dx = (x % 32) - 16, dy = (y % 32) - 16;
            if (dx * dx + dy * dy < 14) { u = 0.50f; v = 0.25f + 0.08f * hash01(x * 313u + y * 977u); }
            grayScottRgba[idx + 0] = u;
            grayScottRgba[idx + 1] = v;
            grayScottRgba[idx + 2] = 0.2f;
            grayScottRgba[idx + 3] = 1.0f;
        }
    }
    grayScottDirty = true;

    // Seed 25 Sorting Fields + 64-bar 3D array + ALife v3.0 11-pool closed ledger
    for (int s = 0; s < kSortingAlgoCount; ++s) {
        sortSteps[s] = (s == 11) ? 162u : static_cast<uint32_t>(40 + s * 7);
        sortSwaps[s] = (s == 11) ? 5u : static_cast<uint32_t>(3 + (s % 9));
        sortOmega[s] = 0.201f + 0.025f * std::sin(static_cast<float>(s));
        for (int k = 0; k < 16; ++k) m_sortArrays[s][k] = hash01(worldSeed + s * 97u + k);
    }
    for (int c = 0; c < 4; ++c) {
        for (int b = 0; b < 64; ++b) {
            sortBars64[c][b] = 0.15f + 0.85f * hash01(worldSeed + c * 257u + b);
        }
    }

    // ALife v3.0 11-pool ledger: sum_{k!=7} E_k - E_7 == E_initial (slot 12)
    alifeLedger13 = { 620.0, 410.0, 185.0, 92.0, 64.0, 38.0, 28.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1437.0 };
    m_firstLawPools = { 1200.0, 180.0, 57.0, 0.0, 0.0, 1437.0 };

    // Quasicrystal icosahedral shell via Tsotchke libirrep/QGTL
    quasicrystalShellPts.clear();
    if (m_bridges->quasicrystal) {
        std::vector<float> qbuf(512 * 3, 0.0f);
        uint32_t qn = m_bridges->quasicrystal(2, 1.45f, 58.0f, 0.0f, qbuf.data(), 512);
        for (uint32_t i = 0; i < qn; ++i) {
            quasicrystalShellPts.emplace_back(qbuf[i * 3 + 0], qbuf[i * 3 + 1], qbuf[i * 3 + 2]);
        }
    }

    regenerateAccessChallenge();
    m_jolt->seedSpecimens(18);
    buildStaticWorldGeometry();

    // Prime history ring buffers so Observatory 16 charts look rich immediately on frame 0!
    for (int h = 0; h < kHistoryLen; ++h) {
        float t = h * 0.08f;
        sparkEntities[h] = static_cast<float>(liveEntityCount) + 12.0f * std::sin(t);
        sparkXenomimics[h] = static_cast<float>(xenomimicCount);
        sparkChaos[h] = chaosLevel + 0.04f * std::cos(t * 1.3f);
        sparkEnergy[h] = static_cast<float>(freeEnergyPool) + 18.0f * std::sin(t * 0.5f);
        sparkConnectome[h] = 231.0f + 15.0f * std::sin(t * 0.9f);
        sparkSortOmega[h] = 0.201f + 0.05f * std::sin(t * 1.1f);
        envRdHist[h] = 0.42f + 0.14f * std::sin(t * 0.7f);
        envQhHist[h] = 0.58f + 0.18f * std::cos(t * 0.9f);
        envTrendHist[h] = 0.201f + 0.16f * std::sin(t * 0.6f);
        popMeanHist[h] = static_cast<float>(liveEntityCount);
        popStdHist[h] = 28.0f + 8.0f * std::sin(t);
        birthFluxHist[h] = 6.0f + 5.0f * std::abs(std::sin(t * 1.4f));
        deathFluxHist[h] = 5.2f + 4.5f * std::abs(std::cos(t * 1.2f));
        warIntensityHist[h] = 0.24f + 0.15f * std::abs(std::sin(t * 0.8f));
        truceFracHist[h] = 0.46f + 0.06f * std::sin(t);
        warFracHist[h] = 0.22f + 0.05f * std::cos(t);
        allyFracHist[h] = 1.0f - truceFracHist[h] - warFracHist[h];
        for (int p = 0; p < kPhylumCount; ++p) {
            phylumPopHist[p][h] = (liveEntityCount / 10.0f) * (0.75f + 0.35f * std::sin(t + p * 0.6f));
        }
        for (int ti = 0; ti < 20; ++ti) {
            titanScoreHist[ti][h] = 50.0f + 35.0f * std::sin(t * 0.4f + ti * 0.5f);
        }
        for (int x = 0; x < 4; ++x) {
            xenoEcoHist[x][h] = 0.35f + 0.28f * std::sin(t * 0.8f + x * 1.2f);
        }
        for (int c = 0; c < 16; ++c) {
            obsCharts[c][h] = 0.5f + 0.32f * std::sin(t + c * 0.45f);
        }
    }
    for (int b = 0; b < 16; ++b) {
        float x = (b - 6.5f) / 3.2f;
        energyHistogram16[b] = std::exp(-0.5f * x * x);
    }
    for (int k = 0; k < 48; ++k) {
        float base = 1.38f + 0.06f * std::sin(k * 0.25f);
        float cl = base + 0.018f * std::cos(k * 0.7f);
        fxCandles[k] = { base, std::max(base, cl) + 0.015f, std::min(base, cl) - 0.014f, cl };
    }
    for (int g = 0; g <= 20; ++g) {
        float p = g / 20.0f;
        lorenzWealthCurve[g] = std::pow(p, 1.95f);
    }
    updateBrainTextures();
}

void NativeCosmosSim::stepSortingFields() {
    for (int s = 0; s < kSortingAlgoCount; ++s) {
        auto& arr = m_sortArrays[s];
        int i = static_cast<int>((tickCount + s * 3) % 15);
        if (arr[i] > arr[i + 1]) {
            std::swap(arr[i], arr[i + 1]);
            sortSwaps[s]++;
        } else if ((tickCount + s * 11) % 37 == 0) {
            // Re-inject cosmic entropy perturbation when sorted
            int j = static_cast<int>((tickCount * 7 + s) % 16);
            arr[j] = hash01(static_cast<uint32_t>(tickCount * 131 + s * 17 + j));
        }
        sortSteps[s]++;
        float inv = 0.0f;
        for (int a = 0; a < 15; ++a) if (arr[a] > arr[a + 1]) inv += 1.0f;
        sortOmega[s] = 0.08f + 0.85f * (1.0f - inv / 15.0f);
    }
    // Step 64-bar 3D sorting columns
    for (int c = 0; c < 4; ++c) {
        int idx = static_cast<int>((tickCount * 3 + c * 11) % 63);
        if (sortBars64[c][idx] > sortBars64[c][idx + 1]) {
            std::swap(sortBars64[c][idx], sortBars64[c][idx + 1]);
        } else if ((tickCount + c * 19) % 53 == 0) {
            sortBars64[c][(tickCount * 5 + c) % 64] = hash01(static_cast<uint32_t>(tickCount * 97 + c));
        }
    }
    trendIndex = sortOmega[activeSortAlgo];
}

void NativeCosmosSim::stepEconomyAndDiplomacy(float dt) {
    // Run 51-param EntityResourceHead batch in Zig SIMD to price Matter & Energy dynamically!
    int nEco = std::min(liveEntityCount, 512);
    if (m_bridges->zig_res_head_51 && nEco > 0) {
        thread_local std::vector<float> ecoIn;
        thread_local std::vector<float> ecoOut;
        ecoIn.resize(nEco * 8);
        ecoOut.resize(nEco * 3);
        for (int i = 0; i < nEco; ++i) {
            ecoIn[i * 8 + 0] = m_entEnergy[i];
            ecoIn[i * 8 + 1] = priceMatter * 0.25f;
            ecoIn[i * 8 + 2] = priceEnergy * 0.25f;
            ecoIn[i * 8 + 3] = fxRateSunMoon * 0.5f;
            ecoIn[i * 8 + 4] = chaosLevel;
            ecoIn[i * 8 + 5] = trendIndex;
            ecoIn[i * 8 + 6] = std::sin(m_entPhase[i]);
            ecoIn[i * 8 + 7] = 1.0f;
        }
        m_bridges->zig_res_head_51(ecoIn.data(), m_entResWeights51.data(), ecoOut.data(), static_cast<size_t>(nEco));
        float netBid = 0.0f, netSave = 0.0f;
        for (int i = 0; i < nEco; ++i) {
            netBid += ecoOut[i * 3 + 0];
            netSave += ecoOut[i * 3 + 1];
        }
        netBid /= static_cast<float>(nEco);
        netSave /= static_cast<float>(nEco);
        priceMatter = std::clamp(priceMatter + dt * 0.35f * netBid, 0.55f, 9.50f);
        priceEnergy = std::clamp(priceEnergy + dt * 0.30f * (netSave - 0.05f * netBid), 0.45f, 8.80f);
    }
    moneySupplySun += dt * (12.0 * trendIndex - 4.0 * chaosLevel);
    creditSupplyMoon = std::max(1200.0, creditSupplyMoon + dt * (8.5 * kuramotoOrderR - 3.0));
    float prevFx = fxRateSunMoon;
    fxRateSunMoon = static_cast<float>(std::clamp(moneySupplySun / std::max(creditSupplyMoon, 1.0), 0.45, 3.80));

    if (tickCount % 8 == 0) {
        fxCandleCursor = (fxCandleCursor + 1) % 48;
        float hi = std::max(prevFx, fxRateSunMoon) + 0.012f * (0.5f + chaosLevel);
        float lo = std::min(prevFx, fxRateSunMoon) - 0.012f * (0.5f + chaosLevel);
        fxCandles[fxCandleCursor] = { prevFx, hi, lo, fxRateSunMoon };
    }

    // Lorenz curve + Wealth Gini from live organism energy distribution
    std::array<float, 64> sampleE{};
    float sumE = 0.0f;
    for (int i = 0; i < 64; ++i) {
        sampleE[i] = std::max(0.01f, m_entEnergy[(i * 7) % std::max(1, liveEntityCount)]);
        sumE += sampleE[i];
    }
    std::sort(sampleE.begin(), sampleE.end());
    float cum = 0.0f, giniArea = 0.0f;
    lorenzWealthCurve[0] = 0.0f;
    for (int g = 1; g <= 20; ++g) {
        int endIdx = (g * 64) / 20;
        int startIdx = ((g - 1) * 64) / 20;
        for (int k = startIdx; k < endIdx; ++k) cum += sampleE[k];
        lorenzWealthCurve[g] = cum / std::max(sumE, 1e-5f);
        giniArea += 0.5f * (lorenzWealthCurve[g - 1] + lorenzWealthCurve[g]) * 0.05f;
    }
    wealthGini = std::clamp(1.0f - 2.0f * giniArea, 0.05f, 0.92f);

    // Update 20x20 Titan Diplomacy Matrix & Truce/War/Ally fractions
    int warPairs = 0, trucePairs = 0, allyPairs = 0;
    for (int i = 0; i < 20; ++i) {
        titans[i].w4d += dt * (0.35f + 0.03f * (i % 5));
        titans[i].matter = std::clamp(titans[i].matter + dt * std::sin(static_cast<float>(simTime) + i), 20.0f, 240.0f);
        titans[i].energy = std::clamp(titans[i].energy + dt * std::cos(static_cast<float>(simTime) * 0.8f + i), 25.0f, 250.0f);
        for (int j = i + 1; j < 20; ++j) {
            float d = std::clamp(diplomacyMatrix[i][j] + dt * 0.25f * std::sin(static_cast<float>(simTime) * 0.5f + i * 1.7f - j), -1.0f, 1.0f);
            diplomacyMatrix[i][j] = diplomacyMatrix[j][i] = d;
            if (d < -0.28f) warPairs++;
            else if (d > 0.28f) allyPairs++;
            else trucePairs++;
        }
    }
    const float inv190 = 1.0f / 190.0f;
    warFracHist[historyCursor] = warPairs * inv190;
    truceFracHist[historyCursor] = trucePairs * inv190;
    allyFracHist[historyCursor] = allyPairs * inv190;
    warIntensityHist[historyCursor] = warFracHist[historyCursor] * (0.65f + 0.5f * chaosLevel);
}

void NativeCosmosSim::updateBrainTextures() {
    // 1. APEX / XYLOS Poincare Hyperbolic Neural Canvas (128x128 RGBA)
    std::fill(brainTexXylos.begin(), brainTexXylos.end(), 14u);
    for (int y = 0; y < kBrainTexSize; ++y) {
        for (int x = 0; x < kBrainTexSize; ++x) {
            size_t p = static_cast<size_t>(y * kBrainTexSize + x) * 4;
            float u = (x - 63.5f) / 58.0f;
            float v = (y - 63.5f) / 58.0f;
            float r2 = u * u + v * v;
            brainTexXylos[p + 0] = 16;
            brainTexXylos[p + 1] = 10;
            brainTexXylos[p + 2] = 28;
            brainTexXylos[p + 3] = 255;
            if (std::abs(r2 - 1.0f) < 0.035f) {
                brainTexXylos[p + 0] = 90; brainTexXylos[p + 1] = 70; brainTexXylos[p + 2] = 165;
            }
        }
    }
    for (int f = 0; f < 48; ++f) {
        int cx = std::clamp(static_cast<int>(64.0f + xylosFociUv[f * 2 + 0] * 54.0f), 2, 125);
        int cy = std::clamp(static_cast<int>(64.0f + xylosFociUv[f * 2 + 1] * 54.0f), 2, 125);
        float a = std::clamp(0.5f + 0.5f * xylosAct[f], 0.0f, 1.0f);
        for (int dy = -2; dy <= 2; ++dy) {
            for (int dx = -2; dx <= 2; ++dx) {
                if (dx * dx + dy * dy <= 5) {
                    size_t p = static_cast<size_t>((cy + dy) * kBrainTexSize + (cx + dx)) * 4;
                    brainTexXylos[p + 0] = static_cast<uint8_t>(80 + 175 * a);
                    brainTexXylos[p + 1] = static_cast<uint8_t>(180 + 70 * (1.0f - a));
                    brainTexXylos[p + 2] = 255;
                }
            }
        }
    }

    // 2. MECHA 54,048-param Radial Synaptic Galaxy Canvas (128x128 RGBA — matches middle Live Brain thumbnail!)
    for (int y = 0; y < kBrainTexSize; ++y) {
        for (int x = 0; x < kBrainTexSize; ++x) {
            size_t p = static_cast<size_t>(y * kBrainTexSize + x) * 4;
            float dx = (x - 63.5f) / 64.0f, dy = (y - 63.5f) / 64.0f;
            float r = std::sqrt(dx * dx + dy * dy);
            float core = std::exp(-r * r * 14.0f) * (0.6f + 0.4f * mechaEnergy);
            int wIdx = ((y * 128 + x) * 3) % static_cast<int>(m_mechaParams54k.size());
            float spark = std::max(0.0f, m_mechaParams54k[wIdx] * 3.2f) * std::exp(-r * 2.2f);
            brainTexMecha[p + 0] = static_cast<uint8_t>(std::clamp((0.06f + core * 0.95f + spark * 0.9f) * 255.0f, 0.0f, 255.0f));
            brainTexMecha[p + 1] = static_cast<uint8_t>(std::clamp((0.04f + core * 0.65f + spark * 0.4f) * 255.0f, 0.0f, 255.0f));
            brainTexMecha[p + 2] = static_cast<uint8_t>(std::clamp((0.12f + core * 1.00f + spark * 0.95f) * 255.0f, 0.0f, 255.0f));
            brainTexMecha[p + 3] = 255;
        }
    }

    // 3. GLYPH 10x10 Pantheon Pink/Magenta/Amber Dot-Matrix Grid (matches rightmost `GLYPH` thumbnail in screenshot!)
    for (int i = 0; i < kBrainTexSize * kBrainTexSize; ++i) {
        brainTexGlyph[i * 4 + 0] = 18;
        brainTexGlyph[i * 4 + 1] = 10;
        brainTexGlyph[i * 4 + 2] = 26;
        brainTexGlyph[i * 4 + 3] = 255;
    }
    for (int gy = 0; gy < 10; ++gy) {
        for (int gx = 0; gx < 10; ++gx) {
            int gIdx = gy * 10 + gx;
            float act = 0.0f;
            for (int k = 0; k < 16; ++k) act += std::abs(m_glyphStates[gIdx * 1024 + k * 37]);
            act = std::clamp(act / 8.0f, 0.12f, 1.0f);
            int cx = 8 + gx * 12;
            int cy = 8 + gy * 12;
            bool gold = ((gx + gy * 3 + static_cast<int>(tickCount / 6)) % 7 == 0);
            uint8_t cr = gold ? 255 : static_cast<uint8_t>(140 + 115 * act);
            uint8_t cg = gold ? static_cast<uint8_t>(185 * act + 50) : static_cast<uint8_t>(35 + 65 * act);
            uint8_t cb = gold ? 75 : static_cast<uint8_t>(155 + 100 * act);
            int rad = (act > 0.55f) ? 4 : 3;
            for (int dy = -rad; dy <= rad; ++dy) {
                for (int dx = -rad; dx <= rad; ++dx) {
                    if (dx * dx + dy * dy <= rad * rad) {
                        int px = std::clamp(cx + dx, 0, kBrainTexSize - 1);
                        int py = std::clamp(cy + dy, 0, kBrainTexSize - 1);
                        size_t p = static_cast<size_t>(py * kBrainTexSize + px) * 4;
                        brainTexGlyph[p + 0] = cr;
                        brainTexGlyph[p + 1] = cg;
                        brainTexGlyph[p + 2] = cb;
                    }
                }
            }
        }
    }
    brainTexturesDirty = true;
}


void NativeCosmosSim::step(float rawDt) {
    for (auto& b : dynamicMeshBuckets) b.clear();
    worldColorLines.clear();
    using namespace cqm2_meshes;

    const float speedMul = (paused || pauseState != 0) ? 0.0f : kSpeedValues[std::clamp(speedIdx, 0, kSpeedCount - 1)];
    const float dt = std::clamp(rawDt, 0.0f, 0.05f) * speedMul;

    if (dt > 0.0f) {
        tickCount++;
        simTime += static_cast<double>(dt);

        if (autoSort && (tickCount % 240 == 0)) {
            activeSortAlgo = (activeSortAlgo + 1) % kSortingAlgoCount;
        }
        stepSortingFields();

        // 1. 256x256 Spatial Gray-Scott Reaction-Diffusion Dish (CUDA NVRTC sm_120 -> Zig AVX2 fallback)
        if (tickCount % 2 == 0) {
            float feed = 0.0367f + 0.004f * chaosLevel * sandboxChaosMul;
            float kill = 0.0615f + 0.002f * trendIndex;
            bool ranGpuGs = false;
            if (silicon.cudaReady && m_bridges->cuda_gs_rgba) {
                if (m_bridges->cuda_gs_rgba(grayScottRgba.data(), m_grayScottScratch.data(), kGrayScottSize, 0.16f, 0.08f, feed, kill, 1.0f, 0.2f) == 1) {
                    std::swap(grayScottRgba, m_grayScottScratch);
                    ranGpuGs = true;
                }
            }
            if (!ranGpuGs && m_bridges->zig_gs_rgba) {
                m_bridges->zig_gs_rgba(grayScottRgba.data(), m_grayScottScratch.data(), kGrayScottSize, 0.16f, 0.08f, feed, kill, 1.0f, 0.2f);
                std::swap(grayScottRgba, m_grayScottScratch);
            }
            grayScottDirty = true;
        }

        // 2. Live Organism 70-Param TD-Lamarckian Brains (CUDA cuBLAS FP32 -> Zig SIMD fallback)
        const int nEnt = std::clamp(liveEntityCount, 1, 50000);
        for (int i = 0; i < nEnt; ++i) {
            const glm::vec3& p = m_entPos[i];
            float rNorm = std::hypot(p.x, p.z) / 58.0f;
            m_entInputs6[i * 6 + 0] = std::sin(p.x * 0.12f + static_cast<float>(simTime));
            m_entInputs6[i * 6 + 1] = std::cos(p.z * 0.12f - static_cast<float>(simTime) * 0.7f);
            m_entInputs6[i * 6 + 2] = m_entEnergy[i] - 0.8f;
            m_entInputs6[i * 6 + 3] = 1.0f - rNorm;
            m_entInputs6[i * 6 + 4] = chaosLevel * sandboxChaosMul - 0.5f;
            m_entInputs6[i * 6 + 5] = trendIndex;
            m_entRewards[i] = (1.0f - rNorm) * 0.25f + 0.15f * std::cos(m_entPhase[i]);
        }
        bool ranCudaEnt = false;
        if (silicon.cudaReady && m_bridges->cuda_entity_70) {
            double msOut = 0.0;
            double gflops = m_bridges->cuda_entity_70(
                m_entInputs6.data(), m_entWeights70.data(), m_entPrevHid6.data(),
                m_entPrevVal.data(), m_entRewards.data(), m_entOutputs4.data(),
                nEnt, 0.015f * sandboxMutationMul, 0.95f, &msOut);
            if (gflops >= 0.0) {
                silicon.lastBrainGflops = gflops;
                silicon.lastBrainMs = msOut;
                ranCudaEnt = true;
            }
        }
        if (!ranCudaEnt && m_bridges->zig_entity_70) {
            m_bridges->zig_entity_70(
                m_entInputs6.data(), m_entWeights70.data(), m_entPrevHid6.data(),
                m_entPrevVal.data(), m_entRewards.data(), m_entOutputs4.data(),
                static_cast<size_t>(nEnt), 0.015f * sandboxMutationMul, 0.95f);
        }

        // Update organism kinematics + Kuramoto sync order parameter R
        float sumCos = 0.0f, sumSin = 0.0f;
        int xenoCnt = 0, nhiCnt = 0;
        std::array<int, kPhylumCount> phyCounts{};
        std::fill(energyHistogram16.begin(), energyHistogram16.end(), 0.0f);

        for (int i = 0; i < nEnt; ++i) {
            float ax = m_entOutputs4[i * 4 + 0];
            float az = m_entOutputs4[i * 4 + 1];
            float ay = m_entOutputs4[i * 4 + 2];
            glm::vec3& pos = m_entPos[i];
            glm::vec3& vel = m_entVel[i];
            vel.x = vel.x * 0.92f + ax * 4.2f * dt;
            vel.z = vel.z * 0.92f + az * 4.2f * dt;
            float r = std::hypot(pos.x, pos.z);
            if (r > 54.0f) {
                vel.x -= (pos.x / r) * 8.0f * dt;
                vel.z -= (pos.z / r) * 8.0f * dt;
            }
            pos.x += vel.x * dt * 3.2f;
            pos.z += vel.z * dt * 3.2f;
            float gy = terrainHeightAt(pos.x, pos.z);
            if (m_entFlags[i] & 4u) {
                vel.y = vel.y * 0.92f + (ay * 3.0f - 0.35f * (pos.y - (gy + 9.0f)) * sandboxGravityMul) * dt;
                pos.y = std::clamp(pos.y + vel.y * dt * 2.5f, gy + 1.4f, 34.0f);
            } else {
                pos.y = gy + 0.52f + 0.14f * std::abs(std::sin(m_entPhase[i]));
            }
            m_entPhase[i] += dt * (2.2f + 1.4f * m_entOutputs4[i * 4 + 3]);
            sumCos += std::cos(m_entPhase[i]);
            sumSin += std::sin(m_entPhase[i]);

            m_entEnergy[i] = std::clamp(m_entEnergy[i] + dt * (0.04f * sandboxEnergyMul - 0.025f * glm::length(vel)), 0.12f, 2.4f);
            int hBin = std::clamp(static_cast<int>((m_entEnergy[i] / 2.4f) * 15.99f), 0, 15);
            energyHistogram16[hBin] += 1.0f;

            phyCounts[m_entPhylum[i] % kPhylumCount]++;
            if (m_entFlags[i] & 1u) xenoCnt++;
            if (m_entFlags[i] & 2u) nhiCnt++;
        }
        xenomimicCount = xenoCnt;
        nhiActiveCount = nhiCnt;
        kuramotoOrderR = std::hypot(sumCos, sumSin) / static_cast<float>(nEnt);

        // Shannon Phylum Diversity H = -sum p_i ln(p_i)
        float shH = 0.0f;
        for (int p = 0; p < kPhylumCount; ++p) {
            float pr = static_cast<float>(phyCounts[p]) / static_cast<float>(nEnt);
            if (pr > 1e-6f) shH -= pr * std::log(pr);
        }
        shannonDiversityH = shH;
        float maxBin = *std::max_element(energyHistogram16.begin(), energyHistogram16.end());
        if (maxBin > 0.0f) {
            for (float& b : energyHistogram16) b /= maxBin;
        }

        // 3. 54,048-Param Mechalogodrom STDP Brain (CUDA -> Zig SIMD; 90 shell inputs)
        std::array<float, 90> mechaIn{};
        for (int k = 0; k < 90; ++k) {
            mechaIn[k] = std::sin(static_cast<float>(simTime) * 0.9f + k * 0.21f) * (0.5f + 0.5f * kuramotoOrderR);
        }
        if (silicon.cudaReady && m_bridges->cuda_mecha_54k) {
            mechaEnergy = m_bridges->cuda_mecha_54k(
                mechaIn.data(), m_mechaParams54k.data(), m_mechaPreTrace.data(),
                m_mechaPostTrace.data(), m_mechaOut64.data(), 0.002f);
        } else if (m_bridges->zig_mecha_54k) {
            mechaEnergy = m_bridges->zig_mecha_54k(
                mechaIn.data(), m_mechaParams54k.data(), m_mechaPreTrace.data(),
                m_mechaPostTrace.data(), m_mechaOut64.data(), 0.002f);
        }

        // 4. 5 x 10,081-Param Archon SuperMinds (REA = stats16[9]!) + Eshkol Global Workspace + Vandermonde Metacognition
        std::array<float, 80> gwFeatures{};
        std::array<float, 5> gwBaseSal{};
        std::array<float, 5> gwProbs{};
        std::array<float, 16> gwBroadcast{};
        for (int a = 0; a < 5; ++a) {
            std::array<float, 32> sIn{};
            for (int j = 0; j < 32; ++j) {
                sIn[j] = m_mechaOut64[(a * 7 + j) % 64] * 0.6f + 0.4f * std::sin(static_cast<float>(simTime) + a + j * 0.3f);
            }
            if (m_bridges->zig_super_mind_10k) {
                m_bridges->zig_super_mind_10k(
                    sIn.data(), &m_superMindParams[a * 10081], &archons[a].memSlot,
                    kuramotoOrderR - 0.35f, 0.004f, archons[a].motor24.data(), archons[a].stats16.data());
            }
            archons[a].gyroAngle += dt * (0.75f + 0.5f * archons[a].stats16[1]);
            gwBaseSal[a] = 0.35f + 0.65f * archons[a].stats16[9]; // Salience weighted by REA (Reasoning)!
            for (int f = 0; f < 16; ++f) gwFeatures[a * 16 + f] = archons[a].stats16[f];
        }
        if (m_bridges->eshkol_gw) {
            m_bridges->eshkol_gw(gwFeatures.data(), gwBaseSal.data(), 5, 16, 4.5f, gwBroadcast.data(), gwProbs.data());
            for (int a = 0; a < 5; ++a) archons[a].broadcastProb = gwProbs[a];
        }
        if (m_bridges->eshkol_vfe) {
            double obs8[8], mu8[8], lns8[8];
            for (int k = 0; k < 8; ++k) {
                obs8[k] = gwBroadcast[k];
                mu8[k] = archons[0].stats16[k];
                lns8[k] = -1.2;
            }
            eshkolVfe = m_bridges->eshkol_vfe(obs8, mu8, lns8, 8);
        }
        for (int k = 0; k < 4; ++k) m_vandermondeHist[k] = m_vandermondeHist[k + 1];
        m_vandermondeHist[4] = archons[0].stats16[9]; // Track REA reasoning trajectory
        if (m_bridges->zig_vandermonde_jet4) {
            float jet5[5]{};
            eshkolMetacogConf = m_bridges->zig_vandermonde_jet4(m_vandermondeHist.data(), jet5);
        }

        // 5. 100 x 32x32 GlyphBrains + Xylos 48-Foci Poincaré Disk + Forked PCI* (Errata D-02)
        if (tickCount % 2 == 0 && m_bridges->glyph_batch) {
            for (int g = 0; g < 100; ++g) {
                m_glyphDrive[g * 4 + 0] = std::sin(static_cast<float>(simTime) + g * 0.1f);
                m_glyphDrive[g * 4 + 1] = kuramotoOrderR;
                m_glyphDrive[g * 4 + 2] = trendIndex;
                m_glyphDrive[g * 4 + 3] = chaosLevel;
            }
            glyphMeanEnergy = m_bridges->glyph_batch(m_glyphStates.data(), m_glyphLatW.data(), m_glyphDrive.data(), 100, 0.02f);
        }
        if (xylosReplaying && xylosTapeFrames > 0) {
            size_t slot = (m_xylosPlayCursor % xylosTapeFrames) * 48;
            std::copy_n(&m_xylosTape[slot], 48, xylosAct.begin());
            m_xylosPlayCursor++;
        } else if (m_bridges->zig_xylos_oja) {
            for (int i = 0; i < 14; ++i) {
                butlinIndicators14[i] = std::clamp(0.35f + 0.45f * gwBroadcast[i % 16] + 0.12f * std::sin(static_cast<float>(simTime) + i), 0.05f, 0.98f);
            }
            xylosNlmsErr = m_bridges->zig_xylos_oja(
                xylosFociUv.data(), xylosAct.data(), xylosEdgeSrc.data(), xylosEdgeDst.data(),
                m_xylosEdgeW.data(), m_xylosNlmsW.data(), butlinIndicators14.data(), kuramotoOrderR, 0.005f);
            if (xylosRecording && xylosTapeFrames < 1024) {
                std::copy_n(xylosAct.begin(), 48, &m_xylosTape[xylosTapeFrames * 48]);
                xylosTapeFrames++;
            }
        }
        if ((tickCount == 1 || tickCount % 16 == 0) && m_bridges->zig_pci_lz_forked) {
            std::array<float, 48 * 48> xylosDense{};
            for (int e = 0; e < 192; ++e) {
                uint16_t s = xylosEdgeSrc[e] % 48;
                uint16_t d = xylosEdgeDst[e] % 48;
                xylosDense[static_cast<size_t>(s) * 48u + d] += m_xylosEdgeW[e];
                xylosDense[static_cast<size_t>(d) * 48u + s] += m_xylosEdgeW[e] * 0.5f;
            }
            pciLzStar = m_bridges->zig_pci_lz_forked(xylosAct.data(), xylosDense.data(), 48, 4, 0.65f, 24);
        }

        // 6. Asmodenius 272-Neuron Cortical-ENS LIF + 100M Procedural Cortical LoRA on RTX 5070 Ti SMs
        if (m_bridges->asmodenius_lif) {
            float summary6[6]{};
            for (int n = 0; n < 272; ++n) {
                m_asmoDrive[n] = 0.85f + 0.45f * std::sin(static_cast<float>(simTime) * 2.1f + n * 0.17f);
            }
            m_bridges->asmodenius_lif(m_asmoVmem.data(), m_asmoCa.data(), m_asmoSpikes.data(), m_asmoDrive.data(), nullptr, 1.0f, summary6);
            asmodeniusCorticalHz = summary6[0];
            asmodeniusEnsTone = summary6[3];
        }
        if (tickCount % 4 == 0 && m_bridges->cuda_asmo_100m) {
            asmodenius100mAct = m_bridges->cuda_asmo_100m(
                mechaIn.data(), m_asmoLoraA.data(), m_asmoLoraB.data(), m_asmo100mOut.data(),
                64, 16, worldSeed ^ 0xA540DE10u);
        }

        // 7. Quantum, Relativity, Thermodynamics (ALife v3.0 11-Pool KBN <= 1e-12) & RosettaWire RSW1
        if (tickCount == 1 || tickCount % 12 == 0) {
            if (m_bridges->qgtl_qwz) {
                double qwzOut[6]{};
                qwzChernNumber = m_bridges->qgtl_qwz(1.0 + 0.4 * std::sin(simTime * 0.25), 0.2, 0.2, 24, qwzOut);
            }
            if (m_bridges->zig_hoggar_hex) {
                double meanViol = 0.0;
                hoggarViolatedLines = m_bridges->zig_hoggar_hex(&meanViol);
            }
            if (m_bridges->zig_kerr_mino) {
                double kerrBuf[24]{};
                m_bridges->zig_kerr_mino(0.94, 6.5, 1.57, 0.08, 6, kerrBuf);
                kerrCarterDrift = kerrBuf[3];
            }
            if (m_bridges->apex_hashes) {
                m_bridges->apex_hashes(static_cast<uint32_t>(tickCount), apexHashes);
            }
            if (m_bridges->rsw1_roundtrip) {
                uint8_t wire60[60]{};
                float snap4[4] = { static_cast<float>(freeEnergyPool), kuramotoOrderR, archons[0].stats16[9], pciLzStar };
                silicon.rsw1StreamOk = (m_bridges->rsw1_roundtrip(0xC0540902ULL, tickCount, "cqm2.telemetry.v5", snap4, 4, wire60) == 60);
            }
        }
        if (m_bridges->zig_first_law) {
            firstLawDrift = m_bridges->zig_first_law(m_firstLawPools.data(), 1.8 * dt * sandboxEnergyMul, 1.2 * dt, 0.6 * dt);
            freeEnergyPool = m_firstLawPools[0] + m_firstLawPools[1] + m_firstLawPools[2];
            irreversibleHeat = m_firstLawPools[3];
        }
        if (m_bridges->zig_alife_ledger11) {
            alifeV3Drift = m_bridges->zig_alife_ledger11(
                alifeLedger13.data(),
                2.4 * dt * sandboxEnergyMul, 1.8 * dt, 1.1 * dt, 0.7 * dt,
                0.4 * dt, 0.3 * dt, 0.25 * dt, 0.15 * dt);
        }

        // Biome Sentience non-aggregable indicator channels (`indicatorOnly = true`, `score = null`)
        biomeIntegration = std::clamp(0.45f * kuramotoOrderR + 0.55f * pciLzStar, 0.05f, 0.99f);
        biomeCoherence = std::clamp(0.50f * (1.0f - static_cast<float>(eshkolVfe) * 0.4f) + 0.50f * eshkolMetacogConf, 0.05f, 0.99f);
        biomeMomentum = std::clamp(0.50f * trendIndex + 0.50f * archons[0].stats16[9], 0.05f, 0.99f);

        // Lorenz & Rossler 3D Strange Attractors
        {
            const float s = 10.0f, rho = 28.0f, beta = 8.0f / 3.0f, h = 0.008f;
            glm::vec3 dL(s * (m_lorenzHead.y - m_lorenzHead.x),
                         m_lorenzHead.x * (rho - m_lorenzHead.z) - m_lorenzHead.y,
                         m_lorenzHead.x * m_lorenzHead.y - beta * m_lorenzHead.z);
            m_lorenzHead += dL * h;
            if (m_lorenzPts.size() > 260) m_lorenzPts.erase(m_lorenzPts.begin());
            m_lorenzPts.push_back(glm::vec3(-18.0f, 9.0f, 10.0f) + m_lorenzHead * 0.22f);

            glm::vec3 dR(-m_rosslerHead.y - m_rosslerHead.z,
                         m_rosslerHead.x + 0.2f * m_rosslerHead.y,
                         0.2f + m_rosslerHead.z * (m_rosslerHead.x - 5.7f));
            m_rosslerHead += dR * 0.025f;
            if (m_rosslerPts.size() > 220) m_rosslerPts.erase(m_rosslerPts.begin());
            m_rosslerPts.push_back(glm::vec3(18.0f, 11.0f, 12.0f) + m_rosslerHead * 0.28f);
        }

        // Jolt 5.5 Reliquary Physics
        m_jolt->step(dt, sandboxGravityMul);

        // Economy, Diplomacy & Ring Buffers
        historyCursor = (historyCursor + 1) % kHistoryLen;
        stepEconomyAndDiplomacy(dt);
        sparkEntities[historyCursor] = static_cast<float>(liveEntityCount);
        sparkXenomimics[historyCursor] = static_cast<float>(xenomimicCount);
        sparkChaos[historyCursor] = chaosLevel;
        sparkEnergy[historyCursor] = static_cast<float>(freeEnergyPool);
        sparkConnectome[historyCursor] = static_cast<float>(synapticLinkCount);
        sparkSortOmega[historyCursor] = trendIndex;
        envRdHist[historyCursor] = 0.45f + 0.25f * std::sin(static_cast<float>(simTime) * 0.4f);
        envQhHist[historyCursor] = static_cast<float>(quantumMagicM2);
        envTrendHist[historyCursor] = trendIndex;
        popMeanHist[historyCursor] = static_cast<float>(liveEntityCount);
        popStdHist[historyCursor] = 18.0f + 22.0f * chaosLevel;
        birthFluxHist[historyCursor] = 4.0f + 9.0f * trendIndex;
        deathFluxHist[historyCursor] = 3.5f + 8.5f * chaosLevel;
        for (int p = 0; p < kPhylumCount; ++p) {
            phylumPopHist[p][historyCursor] = static_cast<float>(phyCounts[p]);
        }
        for (int t = 0; t < 20; ++t) {
            titanScoreHist[t][historyCursor] = 0.5f * (titans[t].matter + titans[t].energy);
        }
        xenoEcoHist[0][historyCursor] = static_cast<float>(xenomimicCount);
        xenoEcoHist[1][historyCursor] = static_cast<float>(nhiActiveCount);
        xenoEcoHist[2][historyCursor] = biomeIntegration * 40.0f;
        xenoEcoHist[3][historyCursor] = pciLzStar * 40.0f;

        if (tickCount % 4 == 0) updateBrainTextures();
    }

    // ========================================================================
    // POPULATE 64-TOPOLOGY DYNAMIC 3D MESH INSTANCES & COLOR LINE BUFFERS
    // ========================================================================
    const float tSec = static_cast<float>(simTime);
    const int nDraw = std::clamp(liveEntityCount, 1, 50000);

    // A. Live Organisms (40 Morphotype Topologies) + 10 Chiral Xenomimics (ZERO TETHERS!) + NHI Craft
    for (int i = 0; i < nDraw; ++i) {
        const glm::vec3& p = m_entPos[i];
        const glm::vec3& v = m_entVel[i];
        float yaw = std::atan2(v.x, v.z + 1e-5f);
        uint8_t flags = m_entFlags[i];

        if (flags & 1u) {
            // Chiral Enantiomeric Xenomimic (topologies 40..49, strictly untethered!)
            int xMesh = kMeshXenoMobiusL + (i % 10);
            bool rightHand = (xMesh & 1) != 0;
            glm::vec3 col = rightHand ? glm::vec3(1.0f, 0.25f, 0.78f) : glm::vec3(0.18f, 0.96f, 0.88f);
            pushInst(dynamicMeshBuckets[xMesh], p + glm::vec3(0.0f, 0.8f, 0.0f), 1.18f,
                     glm::vec3(yaw + tSec * (rightHand ? 1.2f : -1.2f), 0.35f * std::sin(tSec + i), 0.0f),
                     3.0f, glm::vec3(1.0f), m_entPhase[i], col, 0.94f);
        } else if (flags & 2u) {
            // Biomechanical NHI Released Craft (Gyro-Orb + Counter-Rotating Gimbal + Central Ocellus)
            glm::vec3 np = p + glm::vec3(0.0f, 2.5f + 0.8f * std::sin(tSec * 2.0f + i), 0.0f);
            pushInst(dynamicMeshBuckets[kMeshXenoGyroOrbL], np, 0.95f,
                     glm::vec3(tSec * 1.8f + i, 0.2f, 0.0f), 0.0f, glm::vec3(1.0f), m_entPhase[i],
                     glm::vec3(0.32f, 0.95f, 1.0f), 1.0f);
            pushInst(dynamicMeshBuckets[kMeshGimbalRing], np, 1.28f,
                     glm::vec3(-tSec * 2.4f, 0.65f, 0.3f), 6.0f, glm::vec3(1.0f), m_entPhase[i],
                     glm::vec3(0.95f, 0.55f, 1.0f), 0.95f);
            pushInst(dynamicMeshBuckets[kMeshEyeball], np, 0.42f,
                     glm::vec3(yaw, 0.0f, 0.0f), 4.0f, glm::vec3(1.0f), 0.52f,
                     glm::vec3(0.96f, 0.98f, 1.0f), 1.0f);
        } else {
            int morph = m_entMorph[i] % 40;
            float hue = (m_entPhylum[i] * 0.10f) + 0.03f * std::sin(m_entPhase[i]);
            glm::vec3 col = hslToRgb(hue, 0.88f, 0.58f);
            float mat = (morph == kMeshMedusaBell || morph == kMeshGyroidBlob) ? 3.0f
                      : (morph == kMeshVoxelCluster) ? 5.0f : 0.0f;
            float sc = 0.42f + 0.36f * std::min(m_entEnergy[i], 1.8f);
            float pulse = 1.0f + 0.12f * std::sin(m_entPhase[i] * 2.0f);
            pushInst(dynamicMeshBuckets[morph], p, sc,
                     glm::vec3(yaw, 0.18f * std::sin(m_entPhase[i]), 0.12f * std::cos(m_entPhase[i])),
                     mat, glm::vec3(pulse, 2.0f - pulse, pulse), m_entPhase[i], col, 0.92f);
        }
    }

    // B. 5 Multi-Part Archon Seraph Godforms (Core + 6 Feathered Wings + Wing Eyes + 3 Gyro Rings)
    for (int a = 0; a < 5; ++a) {
        glm::vec3 ap = archons[a].pos + glm::vec3(0.0f, 0.85f * std::sin(tSec * 1.1f + a), 0.0f);
        glm::vec3 aCol = hslToRgb(archons[a].hue, 0.90f, 0.62f);
        float reaScale = 1.0f + 0.35f * archons[a].stats16[9];
        pushInst(dynamicMeshBuckets[kMeshDodeca], ap, 1.35f * reaScale,
                 glm::vec3(archons[a].gyroAngle, 0.3f, 0.2f), 0.0f, glm::vec3(1.0f), a * 1.1f, aCol, 1.0f);
        pushInst(dynamicMeshBuckets[kMeshEyeball], ap + glm::vec3(0.0f, 0.0f, 1.15f * reaScale), 0.62f,
                 glm::vec3(0.0f), 4.0f, glm::vec3(1.0f), archons[a].hue, glm::vec3(0.98f), 1.0f);
        for (int g = 0; g < 3; ++g) {
            pushInst(dynamicMeshBuckets[kMeshGimbalRing], ap, (2.1f + g * 0.55f) * reaScale,
                     glm::vec3(archons[a].gyroAngle * (g + 1), 0.8f * (g + 1), 0.45f * g),
                     6.0f, glm::vec3(1.0f), archons[a].hue, aCol, 0.92f);
        }
        for (int w = 0; w < 6; ++w) {
            float side = (w % 2 == 0) ? 1.0f : -1.0f;
            int tier = w / 2;
            float flap = 0.38f * std::sin(tSec * 2.4f + a + tier * 0.6f) * side;
            glm::vec3 wp = ap + glm::vec3(side * (1.7f + tier * 0.7f), 0.9f - tier * 0.85f, -0.35f);
            pushInst(dynamicMeshBuckets[kMeshArchonWing], wp, 1.45f,
                     glm::vec3(side > 0.0f ? 0.25f : kPi - 0.25f, flap, side * (0.4f - tier * 0.25f)),
                     0.0f, glm::vec3(1.1f, 0.85f, 1.0f), static_cast<float>(w), aCol, 1.0f);
            pushInst(dynamicMeshBuckets[kMeshEyeball], wp + glm::vec3(side * 0.9f, 0.1f, 0.18f), 0.28f,
                     glm::vec3(0.0f), 4.0f, glm::vec3(1.0f), archons[a].hue + 0.2f, glm::vec3(1.0f), 1.0f);
        }
    }

    // C. Crown Mechalogodrom + Solar MechaFirePillar at (0, 27.5, -5)
    {
        glm::vec3 mc = mechalogodromCenter + glm::vec3(0.0f, 0.6f * std::sin(tSec * 0.8f), 0.0f);
        pushInst(dynamicMeshBuckets[kMeshStellatedIcosa], mc, 2.8f,
                 glm::vec3(tSec * 0.45f, tSec * 0.31f, 0.0f), 0.0f, glm::vec3(1.0f), 0.0f,
                 glm::vec3(1.0f, 0.78f, 0.28f), 1.0f);
        for (int g = 0; g < 3; ++g) {
            pushInst(dynamicMeshBuckets[kMeshGimbalRing], mc, 4.2f + g * 1.1f,
                     glm::vec3(tSec * (0.5f + 0.2f * g), 0.7f * g, 0.4f * g), 6.0f,
                     glm::vec3(1.0f), static_cast<float>(g), glm::vec3(1.0f, 0.62f, 0.22f), 0.95f);
        }
        for (int arm = 0; arm < 24; ++arm) {
            float aa = arm * (kTau / 24.0f) + tSec * 0.25f;
            float drive = m_mechaOut64[arm] * 0.5f;
            glm::vec3 ap = mc + glm::vec3(std::cos(aa) * 3.6f, drive * 1.5f, std::sin(aa) * 3.6f);
            pushInst(dynamicMeshBuckets[kMeshCurvedSpike], ap, 2.1f,
                     glm::vec3(aa, 0.35f + drive, -1.1f), 0.0f, glm::vec3(0.75f, 1.5f, 0.75f),
                     static_cast<float>(arm), hslToRgb(0.08f + 0.04f * (arm % 4), 0.95f, 0.58f), 1.0f);
        }
        // MechaFirePillar descending solar cone
        pushInst(dynamicMeshBuckets[kMeshFireCone], mc - glm::vec3(0.0f, 7.5f, 0.0f), 3.4f,
                 glm::vec3(tSec * 1.2f, 0.0f, kPi), 6.0f, glm::vec3(0.85f, 2.8f, 0.85f), tSec,
                 glm::vec3(1.0f, 0.52f, 0.16f), 0.55f);
    }

    // D. Lower-Right XYLOS Hyperbolic Portal Sphere — crystal-clear wireframe cage + curved Poincaré arcs!
    {
        float xGy = terrainHeightAt(xylosCenter.x, xylosCenter.z);
        glm::vec3 xc(xylosCenter.x, xGy + 4.4f, xylosCenter.z);
        const float xR = 4.3f;
        pushInst(dynamicMeshBuckets[kMeshXylosMembrane], xc, xR * 0.96f,
                 glm::vec3(tSec * 0.22f, 0.15f, 0.0f),
                 7.0f, glm::vec3(1.0f), 0.0f,
                 glm::vec3(0.42f, 0.78f, 1.0f), 0.18f);
        // Latitude & Meridian wireframe cage around Xylos
        for (int ring = 0; ring < 9; ++ring) {
            float phi = -1.25f + ring * (2.50f / 8.0f);
            float ry = std::sin(phi) * xR;
            float rr = std::cos(phi) * xR;
            glm::vec4 rCol = (ring == 4) ? glm::vec4(0.95f, 0.78f, 0.42f, 0.78f) : glm::vec4(0.55f, 0.68f, 0.98f, 0.56f);
            for (int s = 0; s < 36; ++s) {
                float a0 = s * (kTau / 36.0f), a1 = (s + 1) * (kTau / 36.0f);
                worldColorLines.push_back({xc + glm::vec3(std::cos(a0) * rr, ry, std::sin(a0) * rr), rCol});
                worldColorLines.push_back({xc + glm::vec3(std::cos(a1) * rr, ry, std::sin(a1) * rr), rCol});
            }
        }
        for (int mer = 0; mer < 8; ++mer) {
            float th = mer * (kPi / 8.0f) + tSec * 0.08f;
            glm::vec4 mCol(0.48f, 0.62f, 0.96f, 0.42f);
            for (int s = 0; s < 32; ++s) {
                float p0 = s * (kTau / 32.0f), p1 = (s + 1) * (kTau / 32.0f);
                worldColorLines.push_back({xc + glm::vec3(std::cos(th) * std::cos(p0) * xR, std::sin(p0) * xR, std::sin(th) * std::cos(p0) * xR), mCol});
                worldColorLines.push_back({xc + glm::vec3(std::cos(th) * std::cos(p1) * xR, std::sin(p1) * xR, std::sin(th) * std::cos(p1) * xR), mCol});
            }
        }
        // 192 Curved Poincaré hyperbolic geodesic axons inside Xylos sphere
        for (int e = 0; e < 192; ++e) {
            uint16_t s = xylosEdgeSrc[e] % 48, d = xylosEdgeDst[e] % 48;
            glm::vec3 p0 = xc + glm::vec3(xylosFociUv[s * 2] * 3.5f, 0.85f * xylosAct[s] - 0.6f, xylosFociUv[s * 2 + 1] * 3.5f);
            glm::vec3 p1 = xc + glm::vec3(xylosFociUv[d * 2] * 3.5f, 0.85f * xylosAct[d] - 0.6f, xylosFociUv[d * 2 + 1] * 3.5f);
            glm::vec3 mid = glm::mix(glm::mix(p0, p1, 0.5f), xc + glm::vec3(0.0f, -0.4f, 0.0f), 0.45f);
            float w = std::clamp(0.32f + std::abs(m_xylosEdgeW[e]) * 2.2f, 0.32f, 0.95f);
            glm::vec4 eCol = (e % 5 == 0) ? glm::vec4(1.0f, 0.80f, 0.32f, w)
                           : (e % 7 == 0) ? glm::vec4(0.92f, 0.96f, 1.0f, w)
                                          : glm::vec4(0.22f, 0.92f, 1.0f, w);
            for (int seg = 0; seg < 4; ++seg) {
                float u0 = seg * 0.25f, u1 = (seg + 1) * 0.25f;
                glm::vec3 q0 = (1.0f - u0) * (1.0f - u0) * p0 + 2.0f * (1.0f - u0) * u0 * mid + u0 * u0 * p1;
                glm::vec3 q1 = (1.0f - u1) * (1.0f - u1) * p0 + 2.0f * (1.0f - u1) * u1 * mid + u1 * u1 * p1;
                worldColorLines.push_back({q0, eCol});
                worldColorLines.push_back({q1, eCol});
            }
        }
    }

    // E. 20 4D Stereographic Titans (32-Edge Projected Hypercubes + Star-Spike Cores)
    for (int t = 0; t < 20; ++t) {
        const auto& ti = titans[t];
        glm::vec3 tp = ti.pos + glm::vec3(0.0f, 0.65f * std::sin(tSec * 0.7f + t), 0.0f);
        glm::vec3 cRgb = hslToRgb(t * 0.05f, 0.85f, 0.68f);
        append4DTesseractLines(tp, ti.scale * 0.85f, ti.w4d, tSec * 0.22f + t,
                               glm::vec4(0.88f, 0.92f, 1.0f, 0.68f),
                               glm::vec4(cRgb, 0.88f));
        pushInst(dynamicMeshBuckets[kMeshCorona20], tp, ti.scale * 0.42f,
                 glm::vec3(ti.w4d, tSec * 0.6f, 0.0f), 0.0f, glm::vec3(1.0f), static_cast<float>(t),
                 cRgb, 0.96f);
    }

    // F. 4 Multi-Segment Undulating Leviathans + 6 Eyed Shoggoths + 3 Puppet Masters
    for (int lv = 0; lv < leviathanCount; ++lv) {
        float baseAng = lv * (kTau / 4.0f) + tSec * 0.16f;
        for (int seg = 0; seg < 14; ++seg) {
            float lag = seg * 0.14f;
            float a = baseAng - lag * 0.35f;
            float rad = 32.0f + 5.0f * std::sin(tSec * 0.5f + lv + lag);
            glm::vec3 sp(std::cos(a) * rad, 15.5f + 2.8f * std::sin(tSec * 1.6f - lag * 1.8f + lv), std::sin(a) * rad);
            float taper = 1.35f * (1.0f - seg / 16.5f);
            glm::vec3 col = hslToRgb(0.54f + 0.08f * lv + seg * 0.01f, 0.90f, 0.56f);
            pushInst(dynamicMeshBuckets[seg == 0 ? kMeshTrilobite : kMeshSpindle], sp, taper,
                     glm::vec3(a + kPi * 0.5f, 0.0f, 0.5f * kPi), 0.0f, glm::vec3(1.0f), lag, col, 1.0f);
            if (seg % 2 == 0) {
                pushInst(dynamicMeshBuckets[kMeshCurvedSpike], sp + glm::vec3(0.0f, taper * 0.8f, 0.0f), taper * 0.85f,
                         glm::vec3(a, 0.0f, -0.35f), 0.0f, glm::vec3(0.6f, 1.4f, 0.6f), lag, col * 1.2f, 1.0f);
            }
        }
    }
    for (int sh = 0; sh < shoggothCount; ++sh) {
        float sa = sh * (kTau / 6.0f) - tSec * 0.08f;
        float sx = std::cos(sa) * 16.5f, sz = std::sin(sa) * 16.5f;
        glm::vec3 sp(sx, terrainHeightAt(sx, sz) + 1.15f, sz);
        float throb = 1.0f + 0.18f * std::sin(tSec * 3.1f + sh);
        pushInst(dynamicMeshBuckets[kMeshGyroidBlob], sp, 1.45f,
                 glm::vec3(tSec * 0.4f + sh, 0.0f, 0.0f), 0.0f,
                 glm::vec3(throb, 2.0f - throb, throb), static_cast<float>(sh),
                 glm::vec3(0.28f, 0.12f, 0.36f), 1.0f);
        for (int ey = 0; ey < 6; ++ey) {
            float ea = ey * (kTau / 6.0f) + tSec * 0.6f;
            glm::vec3 ep = sp + glm::vec3(std::cos(ea) * 1.05f, 0.45f + 0.25f * (ey % 2), std::sin(ea) * 1.05f);
            pushInst(dynamicMeshBuckets[kMeshEyeball], ep, 0.32f,
                     glm::vec3(ea, -0.2f, 0.0f), 4.0f, glm::vec3(1.0f), 0.08f + ey * 0.14f,
                     glm::vec3(0.95f, 0.98f, 0.90f), 1.0f);
        }
    }
    for (int pm = 0; pm < 3; ++pm) {
        float pa = pm * (kTau / 3.0f) + tSec * 0.11f;
        glm::vec3 pp(std::cos(pa) * 26.0f, 21.0f + 1.4f * std::sin(tSec + pm), std::sin(pa) * 26.0f);
        puppetMasterPos[pm] = pp;
        pushInst(dynamicMeshBuckets[kMeshXenoTesseractL], pp, 1.85f,
                 glm::vec3(tSec * 0.5f, pa, 0.2f), 0.0f, glm::vec3(1.0f), static_cast<float>(pm),
                 glm::vec3(0.92f, 0.38f, 0.96f), 1.0f);
        pushInst(dynamicMeshBuckets[kMeshEyeball], pp, 0.65f,
                 glm::vec3(pa + kPi, 0.25f, 0.0f), 4.0f, glm::vec3(1.0f), 0.82f,
                 glm::vec3(1.0f), 1.0f);
    }

    // G. 100 Pantheon Orbital Glyphs + #101 Final Sigma Sovereign Crown
    for (int g = 0; g < 100; ++g) {
        float ga = g * (kTau / 100.0f) + tSec * 0.05f;
        glm::vec3 gp(std::cos(ga) * 44.0f, 18.5f + 1.2f * std::sin(ga * 5.0f + tSec), std::sin(ga) * 44.0f);
        bool sel = (pantheonSelected == g);
        pushInst(dynamicMeshBuckets[kMeshOcta], gp, sel ? 0.72f : 0.36f,
                 glm::vec3(ga, tSec, 0.0f), sel ? 6.0f : 0.0f, glm::vec3(1.0f), static_cast<float>(g),
                 hslToRgb(g * 0.01f, 0.90f, 0.62f), 1.0f);
    }
    pushInst(dynamicMeshBuckets[kMeshMerkaba], glm::vec3(0.0f, 35.5f, -5.0f),
             (pantheonSelected == 100) ? 2.4f : 1.75f,
             glm::vec3(tSec * 0.8f, 0.35f, 0.0f), 6.0f, glm::vec3(1.0f), tSec,
             glm::vec3(1.0f, 0.84f, 0.28f), 1.0f);

    // H. 3D Viz3D 64-Bar Sorting Arc + Lorenz/Rossler Ribbons + Reliquary Jolt Shards
    for (int b = 0; b < 64; ++b) {
        float ba = -1.1f + (b / 63.0f) * 2.2f;
        float bx = std::sin(ba) * 14.5f;
        float bz = -10.5f + std::cos(ba) * 4.5f;
        float gy = terrainHeightAt(bx, bz);
        float bh = 0.4f + sortBars64[0][b] * 4.2f;
        pushInst(dynamicMeshBuckets[kMeshChamferCube],
                 glm::vec3(bx, gy + bh * 0.5f, bz), 1.0f,
                 glm::vec3(ba, 0.0f, 0.0f), 0.0f, glm::vec3(0.16f, bh * 0.5f, 0.16f),
                 static_cast<float>(b), hslToRgb(sortBars64[0][b] * 0.82f, 0.92f, 0.58f), 0.95f);
    }
    for (size_t i = 1; i < m_lorenzPts.size(); ++i) {
        float a = static_cast<float>(i) / static_cast<float>(m_lorenzPts.size());
        worldColorLines.push_back({m_lorenzPts[i - 1], glm::vec4(0.25f, 0.92f, 1.0f, a * 0.8f)});
        worldColorLines.push_back({m_lorenzPts[i],     glm::vec4(0.25f, 0.92f, 1.0f, a * 0.8f)});
    }
    for (size_t i = 1; i < m_rosslerPts.size(); ++i) {
        float a = static_cast<float>(i) / static_cast<float>(m_rosslerPts.size());
        worldColorLines.push_back({m_rosslerPts[i - 1], glm::vec4(1.0f, 0.45f, 0.85f, a * 0.8f)});
        worldColorLines.push_back({m_rosslerPts[i],     glm::vec4(1.0f, 0.45f, 0.85f, a * 0.8f)});
    }

    if (renderMode == 10 || m_jolt->bodies().size() > 18) {
        for (const auto& rb : m_jolt->bodies()) {
            glm::vec3 eu = glm::eulerAngles(rb.orient);
            int mId = kMeshTetra + (rb.specimenId % 16);
            pushInst(dynamicMeshBuckets[mId], rb.pos, rb.radius * 1.35f,
                     eu, 3.0f, glm::vec3(1.0f), rb.hue * kTau,
                     hslToRgb(rb.hue, 0.88f, 0.64f), 0.92f);
        }
    }
}

// ============================================================================
// Interactive Action Row Handlers (Row 1 + Row 3 Dock Buttons)
// ============================================================================
void NativeCosmosSim::actionSplit() {
    int add = std::min(32, maxEntityCap - liveEntityCount);
    for (int k = 0; k < add; ++k) {
        int dst = liveEntityCount + k;
        int src = dst % std::max(1, liveEntityCount);
        m_entPos[dst] = m_entPos[src] + glm::vec3(0.8f, 0.0f, -0.8f);
        m_entMorph[dst] = m_entMorph[src];
        m_entPhylum[dst] = m_entPhylum[src];
        m_entEnergy[dst] = m_entEnergy[src] * 0.6f;
    }
    if (add > 0) liveEntityCount += add;
}

void NativeCosmosSim::actionBurst() {
    freeEnergyPool += 450.0;
    m_firstLawPools[0] += 450.0;
    m_firstLawPools[5] += 450.0;
    alifeLedger13[0] += 450.0;
    alifeLedger13[12] += 450.0;
    for (int i = 0; i < liveEntityCount; ++i) {
        m_entEnergy[i] = std::min(2.4f, m_entEnergy[i] + 0.45f);
        m_entVel[i] *= 1.6f;
    }
}

void NativeCosmosSim::actionMutate() {
    totalMutations += static_cast<uint64_t>(liveEntityCount / 3 + 1);
    for (int i = 0; i < liveEntityCount; i += 2) {
        m_entMorph[i] = static_cast<uint8_t>((m_entMorph[i] + 7 + (tickCount & 15)) % 40);
        int wIdx = i * 70 + static_cast<int>((tickCount + i) % 70);
        m_entWeights70[wIdx] += (hash01(static_cast<uint32_t>(tickCount * 31 + i)) - 0.5f) * 0.65f;
    }
}

void NativeCosmosSim::actionChaosPlus() {
    chaosLevel = std::min(1.0f, chaosLevel + 0.15f);
    if (chaosLevel >= 0.99f) chaosLevel = 0.25f;
}

void NativeCosmosSim::actionGodPulse() {
    for (int a = 0; a < 5; ++a) {
        archons[a].stats16[9] = std::min(0.99f, archons[a].stats16[9] + 0.18f); // Boost REA
        archons[a].broadcastProb = 0.2f;
    }
    actionBurst();
}

void NativeCosmosSim::actionSpawnXenomimic(int count) {
    int spawned = 0;
    for (int i = 0; i < liveEntityCount && spawned < count; ++i) {
        if ((m_entFlags[i] & 1u) == 0) {
            m_entFlags[i] |= 1u;
            m_entFlags[i] &= ~2u;
            spawned++;
        }
    }
    xenomimicCount += spawned;
}

void NativeCosmosSim::actionLifeTreeBloom() {
    wildFloraCount = std::min(36000, wildFloraCount + 1200);
    buildStaticWorldGeometry();
}

void NativeCosmosSim::actionNhiRelease(int count) {
    int released = 0;
    for (int i = liveEntityCount - 1; i >= 0 && released < count; --i) {
        if ((m_entFlags[i] & 2u) == 0) {
            m_entFlags[i] |= 6u; // NHI + airborne!
            m_entFlags[i] &= ~1u;
            m_entPos[i].y = std::max(m_entPos[i].y, 12.0f);
            released++;
        }
    }
    nhiActiveCount += released;
}

void NativeCosmosSim::actionApocalypse() {
    liveEntityCount = std::max(64, liveEntityCount / 3);
    chaosLevel = 0.95f;
    singularityMode = (singularityMode + 1) % kSingularityCount;
}

void NativeCosmosSim::actionShatterReliquary() {
    m_jolt->shatterLargest();
}

void NativeCosmosSim::actionStepAllSorts() {
    for (int k = 0; k < 8; ++k) stepSortingFields();
}

void NativeCosmosSim::cyclePauseState() {
    pauseState = (pauseState + 1) % 3;
    paused = (pauseState != 0);
}

} // namespace cqm2_sim
