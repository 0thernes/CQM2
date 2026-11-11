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
    "free", "orbit", "top", "side", "entity", "titan",
    "god", "temple", "tree", "xylos", "archon", "reliquary"
};
const float kSpeedValues[kSpeedCount] = {
    0.10f, 0.25f, 0.50f, 1.00f, 2.00f, 4.00f
};
const char* const kSpeedLabels[kSpeedCount] = {
    "0.1x", "0.25x", "0.5x", "1.0x", "2.0x", "4.0x"
};
const char* const kRenderModeNames[kRenderModeCount] = {
    "prismatic", "hologram", "wireframe", "xray", "thermal",
    "quantum", "noir", "biolume", "voronoi", "reliquary"
};
const char* const kBrutalModeNames[kBrutalModeCount] = {
    "off", "concrete", "obsidian", "monolith", "megastructure", "cathedral"
};
const char* const kWeatherNames[kWeatherCount] = {
    "clear", "nebula", "ion-storm", "spore-rain", "aurora", "void-eclipse"
};
const char* const kSingularityNames[kSingularityCount] = {
    "none", "schwarzschild", "kerr", "wormhole", "naked-ring"
};
const char* const kSortingAlgoNames[kSortingAlgoCount] = {
    "BUBBLE FIELD", "SELECTION SCAN", "INSERTION PULSE", "MERGE IMPULSE", "PIVOT FIELD",
    "HEAP SIFT", "SHELL STRIDE", "COMB SWEEP", "COCKTAIL TIDE", "GNOME MARCH",
    "ODD-EVEN WAVE", "PANCAKE FLIP", "STOOGE TRIAD", "BITONIC LATTICE", "RADIX LSD",
    "COUNTING BIN", "BUCKET CASCADE", "TIMGALLOP", "INTROSORT", "CYCLE ORBIT",
    "GRAVITY BEAD", "PIGEONHOLE", "SMOOTH LEONARDO", "TOURNAMENT TREE", "FLASH QUANTILE"
};
const char* const kPhylumNames[10] = {
    "CNIDARIA-Q", "RADIOLARIA", "CEPHALOPODA-X", "ARTHRO-VOID", "BRYOZOA-LATTICE",
    "CTENOPHORA-LUX", "ECHINO-PRISM", "MYCELIA-HYPER", "TARDIGRADA-OMEGA", "SERAPH-CHORDATA"
};
const char* const kArchonNames[5] = {
    "ORACLE-\xCE\xA3", "STARKILLER-\xCE\xA9", "MANHATTAN-\xCE\xA6", "BROLY-\xCE\xA8", "VOID-\xCE\x9B"
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

    ~JoltReliquarySolver() {
        clearBodies();
    }

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

    void step(float dt) {
        if (dt <= 0.0f || m_ids.empty()) return;
        JPH::BodyInterface& bi = m_sys.GetBodyInterface();
        for (size_t i = 0; i < m_ids.size(); ++i) {
            const JPH::RVec3 p = bi.GetCenterOfMassPosition(m_ids[i]);
            glm::vec3 pos(p.GetX(), p.GetY(), p.GetZ());
            float m = m_bodies[i].mass;
            glm::vec3 force = -pos * (1.35f * m);
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
// Dynamic C-ABI Bridge Function Pointers
// ============================================================================
struct NativeCosmosSim::BridgeHandles {
#ifdef _WIN32
    HMODULE hTri{nullptr};
    HMODULE hTsotchke{nullptr};
    HMODULE hZig{nullptr};
    HMODULE hRust{nullptr};
#endif

    // cqm2_tri_accel.dll
    int (*hw_init)(char*, int) = nullptr;
    double (*cuda_entity_70)(const float*, float*, float*, float*, const float*, float*, int, float, float, double*) = nullptr;
    float (*cuda_mecha_54k)(const float*, float*, float*, float*, float*, float) = nullptr;

    // cqm2_tsotchke_native.dll
    int32_t (*ts_init)(char*, int32_t) = nullptr;
    int32_t (*qrng_draw)(uint8_t*, size_t, double*, uint64_t*) = nullptr;
    int32_t (*qgtl_qwz)(double, double, double, size_t, double[6]) = nullptr;
    int32_t (*eshkol_gw)(const float*, const float*, uint32_t, uint32_t, float, float*, float*) = nullptr;
    double (*eshkol_vfe)(const double*, const double*, const double*, uint32_t) = nullptr;
    void (*apex_hashes)(uint32_t, uint32_t[4]) = nullptr;
    int32_t (*csr_louvain)(uint32_t, const uint32_t*, const uint32_t*, uint32_t, float*, uint32_t*, double[4]) = nullptr;
    double (*fwht_magic)(const double*, const double*, uint32_t) = nullptr;
    uint32_t (*quasicrystal)(int32_t, float, float, float, float*, uint32_t) = nullptr;
    float (*glyph_batch)(float*, float*, const float*, uint32_t, float) = nullptr;
    int32_t (*asmodenius_lif)(float*, float*, uint8_t*, const float*, const float*, float, float[6]) = nullptr;
    int64_t (*rsc1_encode)(const char*, const char*, const uint8_t*, size_t, uint8_t*, size_t, char[72]) = nullptr;

    // cqm2_zig.dll
    void (*zig_gs_rgba)(const float*, float*, size_t, float, float, float, float, float, float) = nullptr;
    float (*zig_entity_70)(const float*, float*, float*, float*, const float*, float*, size_t, float, float) = nullptr;
    float (*zig_mecha_54k)(const float*, float*, float*, float*, float*, float) = nullptr;
    float (*zig_xylos_oja)(const float*, float*, const uint16_t*, const uint16_t*, float*, float*, const float*, float, float) = nullptr;
    double (*zig_first_law)(double*, double, double, double) = nullptr;
    void (*zig_bitnet_gemv)(const uint8_t*, const float*, const float*, float*, size_t, size_t, uint32_t) = nullptr;
    uint32_t (*zig_hoggar_hex)(double*) = nullptr;
    uint32_t (*zig_kerr_mino)(double, double, double, double, uint32_t, double*) = nullptr;
};

NativeCosmosSim::NativeCosmosSim()
    : m_jolt(std::make_unique<JoltReliquarySolver>()),
      m_bridges(std::make_unique<BridgeHandles>()) {}

NativeCosmosSim::~NativeCosmosSim() = default;

const std::vector<ReliquaryBody>& NativeCosmosSim::reliquaryBodies() const {
    return m_jolt->bodies();
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
        m_bridges->cuda_entity_70 = reinterpret_cast<decltype(m_bridges->cuda_entity_70)>(sym(m_bridges->hTri, "cqm2_cuda_entity_brains_70_strided"));
        m_bridges->cuda_mecha_54k = reinterpret_cast<decltype(m_bridges->cuda_mecha_54k)>(sym(m_bridges->hTri, "cqm2_cuda_mecha_54k_step"));
        if (m_bridges->hw_init) {
            char jbuf[1024]{};
            int rc = m_bridges->hw_init(jbuf, sizeof(jbuf));
            silicon.cudaReady = (rc == 1) || ( std::strstr(jbuf, "\"cudaReady\":true") != nullptr );
            silicon.igpuDmlReady = ( std::strstr(jbuf, "\"igpuDmlReady\":true") != nullptr );
            silicon.npuLevelZeroReady = ( std::strstr(jbuf, "\"npuLevelZeroReady\":true") != nullptr );
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
        m_bridges->apex_hashes = reinterpret_cast<decltype(m_bridges->apex_hashes)>(sym(m_bridges->hTsotchke, "cqm2_apex_golden_hashes"));
        m_bridges->csr_louvain = reinterpret_cast<decltype(m_bridges->csr_louvain)>(sym(m_bridges->hTsotchke, "cqm2_csr_pagerank_louvain"));
        m_bridges->fwht_magic = reinterpret_cast<decltype(m_bridges->fwht_magic)>(sym(m_bridges->hTsotchke, "cqm2_fwht_quantum_magic_m2"));
        m_bridges->quasicrystal = reinterpret_cast<decltype(m_bridges->quasicrystal)>(sym(m_bridges->hTsotchke, "cqm2_quasicrystal_icosa_shell"));
        m_bridges->glyph_batch = reinterpret_cast<decltype(m_bridges->glyph_batch)>(sym(m_bridges->hTsotchke, "cqm2_glyph_brain_batch_step"));
        m_bridges->asmodenius_lif = reinterpret_cast<decltype(m_bridges->asmodenius_lif)>(sym(m_bridges->hTsotchke, "cqm2_asmodenius_lif272_step"));
        m_bridges->rsc1_encode = reinterpret_cast<decltype(m_bridges->rsc1_encode)>(sym(m_bridges->hTsotchke, "cqm2_rsc1_encode"));
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
        m_bridges->zig_gs_rgba = reinterpret_cast<decltype(m_bridges->zig_gs_rgba)>(sym(m_bridges->hZig, "cqm_gray_scott_step_rgba_f32"));
        m_bridges->zig_entity_70 = reinterpret_cast<decltype(m_bridges->zig_entity_70)>(sym(m_bridges->hZig, "cqm2_entity_brain_td_lamarck_batch"));
        m_bridges->zig_mecha_54k = reinterpret_cast<decltype(m_bridges->zig_mecha_54k)>(sym(m_bridges->hZig, "cqm2_mecha_brain_54k_stdp_step"));
        m_bridges->zig_xylos_oja = reinterpret_cast<decltype(m_bridges->zig_xylos_oja)>(sym(m_bridges->hZig, "cqm2_xylos_poincare_oja_step"));
        m_bridges->zig_first_law = reinterpret_cast<decltype(m_bridges->zig_first_law)>(sym(m_bridges->hZig, "cqm2_first_law_kbn_step"));
        m_bridges->zig_bitnet_gemv = reinterpret_cast<decltype(m_bridges->zig_bitnet_gemv)>(sym(m_bridges->hZig, "cqm2_nested_bitnet_int4_gemv"));
        m_bridges->zig_hoggar_hex = reinterpret_cast<decltype(m_bridges->zig_hoggar_hex)>(sym(m_bridges->hZig, "cqm2_hoggar_qgt_violated_hexagon_count"));
        m_bridges->zig_kerr_mino = reinterpret_cast<decltype(m_bridges->zig_kerr_mino)>(sym(m_bridges->hZig, "cqm2_kerr_mino_geodesic"));
    }

    m_bridges->hRust = tryLoad(L"cqm2_rust_ledger.dll");
    silicon.rustLedgerLoaded = (m_bridges->hRust != nullptr);
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

    m_mechaParams54k.resize(54048);
    m_glyphStates.resize(100 * 1024);
    m_glyphLatW.resize(100 * 4);
    m_glyphDrive.resize(100 * 4);
    m_xylosTape.resize(1024 * 48, 0.0f);

    tierIdx = std::clamp(initialTier, 0, kTierCount - 1);
    resetWorld(12345u);
    return true;
}

void NativeCosmosSim::setTier(int idx) {
    tierIdx = std::clamp(idx, 0, kTierCount - 1);
    maxEntityCap = kTierEntityCaps[tierIdx];
    int targetLive = std::clamp(maxEntityCap / 2, 495, 8000);
    if (liveEntityCount > maxEntityCap) liveEntityCount = maxEntityCap;
    if (liveEntityCount < targetLive) {
        int add = targetLive - liveEntityCount;
        for (int i = 0; i < add && liveEntityCount < maxEntityCap; ++i) {
            actionSplit();
        }
    }
    wildFloraCount = (tierIdx <= 1) ? 6272 : (tierIdx <= 3 ? 18000 : 42000);
    buildStaticWorldGeometry();
}

void NativeCosmosSim::regenerateAccessChallenge() {
    static const char* kGlyphPool[6] = {
        "\xCE\xA8\xCE\x9E\xCE\xA9\xCE\x94\xCE\x9B\xCE\xA3\xCE\xA6",
        "\xCE\x98\xCE\xA0\xCE\x93\xCE\xA7\xCE\x96\xCE\x9E\xCE\xA8",
        "\xCE\xA9\xCE\x94\xCE\xA3\xCE\x9B\xCE\xA6\xCE\x98\xCE\xA0",
        "\xCE\x93\xCE\xA8\xCE\x96\xCE\xA9\xCE\x9E\xCE\x94\xCE\xA7",
        "\xCE\xA3\xCE\xA6\xCE\x9B\xCE\x98\xCE\xA8\xCE\xA0\xCE\xA9",
        "\xCE\x94\xCE\x9E\xCE\x93\xCE\xA3\xCE\x96\xCE\xA8\xCE\x9B"
    };
    for (int i = 0; i < 10; ++i) {
        int cnt = 3 + static_cast<int>((worldSeed + static_cast<uint32_t>(i * 7 + accessAttempts * 3)) % 6u);
        accessCounts[i] = cnt;
        std::string blocks;
        for (int b = 0; b < cnt; ++b) blocks += "\xE2\x98\x85 ";
        accessGlyphLines[i] = blocks + "  " + kGlyphPool[(i + accessAttempts) % 6];
    }
}

bool NativeCosmosSim::submitAccessRoman(const std::string& input) {
    static const char* kRomans[11] = { "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X" };
    std::vector<std::string> tokens;
    std::string cur;
    for (char ch : input) {
        if (ch >= 'a' && ch <= 'z') ch = static_cast<char>(ch - 'a' + 'A');
        if (ch == 'I' || ch == 'V' || ch == 'X') {
            cur.push_back(ch);
        } else if (!cur.empty()) {
            tokens.push_back(cur);
            cur.clear();
        }
    }
    if (!cur.empty()) tokens.push_back(cur);
    if (input == "OMEGA" || input == "omega") {
        accessUnlocked = true;
        return true;
    }
    if (tokens.size() == 1 && tokens[0] == kRomans[accessCounts[0]]) {
        accessUnlocked = true;
        return true;
    }
    if (tokens.size() == 10) {
        bool allMatch = true;
        for (int i = 0; i < 10; ++i) {
            if (tokens[i] != kRomans[accessCounts[i]]) {
                allMatch = false;
                break;
            }
        }
        if (allMatch) {
            accessUnlocked = true;
            return true;
        }
    }
    accessAttempts++;
    regenerateAccessChallenge();
    return false;
}

bool NativeCosmosSim::submitStage2Sigil(const std::string& input) {
    if (input.find("uwu") != std::string::npos ||
        input.find("UWU") != std::string::npos ||
        input.find("OwO") != std::string::npos ||
        input.find("owo") != std::string::npos ||
        input.find("_") != std::string::npos ||
        input.find("STAGE2") != std::string::npos) {
        stage2Unlocked = true;
        return true;
    }
    return false;
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

void NativeCosmosSim::buildStaticWorldGeometry() {
    floraInstances.clear();
    structureInstances.clear();

    // 1. Lush AlienFlora stalks (linearized jewel colors + varied micro-heights)
    const int floraN = wildFloraCount;
    floraInstances.reserve(static_cast<size_t>(floraN + 900));
    for (int i = 0; i < floraN; ++i) {
        uint32_t s = worldSeed ^ static_cast<uint32_t>(i * 2654435761u);
        float r = 4.5f + 78.0f * std::sqrt(hash01(s));
        float ang = kTau * hash01(s + 1u);
        float x = std::cos(ang) * r;
        float z = std::sin(ang) * r;
        float groundY = -4.0f + 0.8f * std::sin(x * 0.08f) * std::cos(z * 0.08f);
        float scl = 0.25f + 1.15f * std::pow(hash01(s + 2u), 1.6f);
        float hue = std::fmod(0.22f + 0.72f * hash01(s + 3u), 1.0f);
        glm::vec3 srgb = hslToRgb(hue, 0.90f, 0.52f);
        glm::vec3 linCol = glm::pow(srgb, glm::vec3(2.2f)) * 0.65f;

        floraInstances.push_back({
            glm::vec4(x, groundY, z, scl),
            glm::vec4(0.0f, ang, 1.3f + 2.4f * hash01(s + 4u), hash01(s + 5u) * kTau),
            glm::vec4(linCol, 10.0f + static_cast<float>(i % 3))
        });
    }

    // Crystal Big Tree trunk & faceted crystalline canopy at (-28, -4, -22)
    const glm::vec3 treeBase(-28.0f, -4.0f, -22.0f);
    for (int b = 0; b < 780; ++b) {
        uint32_t s = 0x517CC1B7u ^ static_cast<uint32_t>(b * 911u);
        float u = static_cast<float>(b) / 780.0f;
        if (b < 160) {
            float h = (static_cast<float>(b) / 160.0f) * 19.0f;
            float twist = h * 0.38f + (b % 3) * (kTau / 3.0f);
            float rad = (1.0f - h / 22.0f) * 1.8f + 0.22f;
            glm::vec3 p = treeBase + glm::vec3(std::cos(twist) * rad, h, std::sin(twist) * rad);
            floraInstances.push_back({
                glm::vec4(p, 0.52f),
                glm::vec4(0.0f, twist, 1.8f, u * kTau),
                glm::vec4(0.06f, 0.34f, 0.45f, 13.0f)
            });
        } else {
            float th = kTau * hash01(s);
            float ph = std::acos(1.0f - 2.0f * hash01(s + 1u));
            float cr = 1.8f + 7.2f * std::cbrt(hash01(s + 2u));
            glm::vec3 p = treeBase + glm::vec3(0.0f, 18.5f, 0.0f) +
                          glm::vec3(std::sin(ph) * std::cos(th) * cr * 1.15f,
                                    std::cos(ph) * cr * 0.68f,
                                    std::sin(ph) * std::sin(th) * cr * 1.15f);
            bool isFruit = (b % 9 == 0);
            glm::vec3 col = isFruit
                ? glm::vec3(0.62f, 0.32f, 0.02f)
                : glm::pow(hslToRgb(0.46f + 0.38f * hash01(s + 3u), 0.92f, 0.54f), glm::vec3(2.2f)) * 0.65f;
            floraInstances.push_back({
                glm::vec4(p, isFruit ? 0.38f : 0.28f),
                glm::vec4(th, ph, 1.0f, hash01(s + 4u) * kTau),
                glm::vec4(col, isFruit ? 14.0f : 13.0f)
            });
        }
    }

    // 2. Signature Hero Landmarks matching Original CQM Reference Composition:
    // (a) 3 Hero Pitch-Black Needle Obelisks with Glowing Emerald Lampshade Toppers + 14 Ring Spires
    const glm::vec3 heroSpires[3] = {
        { -13.2f, -4.0f,  0.5f },
        {   0.2f, -4.0f, -2.5f },
        {   8.6f, -4.0f, -6.0f }
    };
    const float heroHeights[3] = { 21.5f, 17.5f, 19.0f };
    for (int k = 0; k < 3; ++k) {
        float h = heroHeights[k];
        structureInstances.push_back({
            glm::vec4(heroSpires[k].x, -4.0f + h * 0.5f, heroSpires[k].z, 1.0f),
            glm::vec4(0.78f, h, 0.78f, 0.25f * k),
            glm::vec4(0.004f, 0.005f, 0.008f, 20.0f) // pitch-black needle obelisk
        });
        // Emerald lampshade frustum topper right above spire tip!
        structureInstances.push_back({
            glm::vec4(heroSpires[k].x, -4.0f + h + 0.9f, heroSpires[k].z, 1.0f),
            glm::vec4(1.35f, 1.25f, 1.35f, 0.4f * k),
            glm::vec4(0.015f, 0.36f, 0.075f, 23.0f)
        });
    }
    for (int sIdx = 0; sIdx < 14; ++sIdx) {
        float ang = (static_cast<float>(sIdx) / 14.0f) * kTau + 0.38f;
        float dist = (sIdx % 2 == 0) ? 34.0f : 56.0f;
        float h = 15.0f + 13.0f * hash01(static_cast<uint32_t>(sIdx * 71 + 9));
        structureInstances.push_back({
            glm::vec4(std::cos(ang) * dist, -4.0f + h * 0.5f, std::sin(ang) * dist, 1.0f),
            glm::vec4(0.72f, h, 0.72f, ang),
            glm::vec4(0.005f, 0.006f, 0.009f, 20.0f)
        });
    }

    // (b) Chunky Foreground/Midground Obsidian + Neon-Patched Voxel Glitch Clusters (type 21)
    const glm::vec4 heroVoxels[6] = {
        { -11.5f, -0.4f,  9.5f, 2.35f },
        {  -9.6f, -2.8f, 11.2f, 2.10f },
        {  -3.6f, -0.2f,  4.0f, 1.95f },
        {   1.4f,  2.4f, -4.8f, 2.05f },
        { -15.5f, -2.2f, -3.5f, 1.85f },
        {  13.0f, -1.8f,  6.5f, 1.90f }
    };
    for (int k = 0; k < 6; ++k) {
        float sz = heroVoxels[k].w;
        structureInstances.push_back({
            glm::vec4(heroVoxels[k].x, heroVoxels[k].y, heroVoxels[k].z, 1.0f),
            glm::vec4(sz, sz * 1.05f, sz, 0.45f + 0.35f * k),
            glm::vec4(0.01f, 0.01f, 0.02f, 21.0f)
        });
    }
    for (int g = 0; g < 22; ++g) {
        uint32_t hs = 0x9E3779B9u ^ static_cast<uint32_t>(g * 131u);
        float ang = hash01(hs) * kTau;
        float dist = 18.0f + 50.0f * hash01(hs + 1u);
        float y = (g < 12) ? (-2.2f + 2.5f * hash01(hs + 2u)) : (8.0f + 18.0f * hash01(hs + 2u));
        float sz = 1.4f + 1.9f * hash01(hs + 3u);
        structureInstances.push_back({
            glm::vec4(std::cos(ang) * dist, y, std::sin(ang) * dist, 1.0f),
            glm::vec4(sz, sz * (0.85f + 0.35f * hash01(hs + 4u)), sz, static_cast<float>(g) * 0.7f),
            glm::vec4(0.01f, 0.01f, 0.02f, 21.0f)
        });
    }

    // (c) Upper-Left Floating Emerald Bell Frustums, Stippled White Crystal Polyhedra & Paired Vertical Cyan Light Curtains
    const glm::vec3 heroBells[5] = {
        { -14.5f, 13.8f, -8.0f },
        { -10.8f, 18.2f, -11.0f },
        { -15.8f,  8.6f, -12.0f },
        {  -9.2f,  6.2f, -14.0f },
        {  -6.5f, 19.5f, -16.0f }
    };
    for (int b = 0; b < 5; ++b) {
        structureInstances.push_back({
            glm::vec4(heroBells[b], 1.0f),
            glm::vec4(1.45f, 1.35f, 1.45f, 0.5f * b),
            glm::vec4(0.015f, 0.38f, 0.08f, 23.0f)
        });
    }
    // Paired vertical translucent cyan/mint light-curtain shafts left of GodColossus!
    structureInstances.push_back({
        glm::vec4(-7.6f, 13.2f, -16.0f, 1.0f),
        glm::vec4(1.15f, 11.5f, 0.22f, 0.12f),
        glm::vec4(0.14f, 0.52f, 0.48f, 24.0f)
    });
    structureInstances.push_back({
        glm::vec4(-5.8f, 15.8f, -17.5f, 1.0f),
        glm::vec4(0.95f, 10.0f, 0.22f, -0.10f),
        glm::vec4(0.18f, 0.56f, 0.52f, 24.0f)
    });
    // Stippled frosted white crystal clouds on left/upper sky
    const glm::vec4 heroClouds[6] = {
        { -18.5f, 11.8f, -9.0f,  2.2f },
        { -16.2f, 16.5f, -11.5f, 2.0f },
        {  -9.5f,  4.2f, -9.5f,  2.1f },
        { -11.2f, 13.2f, -18.0f, 1.5f },
        {  -7.2f,  1.8f, -12.5f, 1.6f },
        { -19.0f,  1.5f,  2.0f,  2.4f }
    };
    for (int c = 0; c < 6; ++c) {
        float w = heroClouds[c].w;
        structureInstances.push_back({
            glm::vec4(heroClouds[c].x, heroClouds[c].y, heroClouds[c].z, 1.0f),
            glm::vec4(w * 1.15f, w * 0.95f, w, 0.6f * c),
            glm::vec4(0.42f, 0.44f, 0.52f, 25.0f)
        });
    }

    // (d) Strictly Achromatic (r == g == b) Floating Monoliths & Stage II Menger MonolithTemple at (22, 2, -20)
    for (int m = 0; m < 9; ++m) {
        float ang = static_cast<float>(m) * (kTau / 9.0f) + 0.45f;
        float grey = 0.04f + 0.03f * static_cast<float>(m % 3); // STRICT r == g == b!
        structureInstances.push_back({
            glm::vec4(std::cos(ang) * 40.0f, 6.0f + (m % 3) * 4.2f, std::sin(ang) * 40.0f, 1.0f),
            glm::vec4(1.2f, 5.2f, 0.35f, ang),
            glm::vec4(grey, grey, grey, 22.0f)
        });
    }

    const glm::vec3 templeCenter(22.0f, 1.5f, -20.0f);
    for (int ix = -1; ix <= 1; ++ix) {
        for (int iy = -1; iy <= 1; ++iy) {
            for (int iz = -1; iz <= 1; ++iz) {
                int zeros = (ix == 0 ? 1 : 0) + (iy == 0 ? 1 : 0) + (iz == 0 ? 1 : 0);
                if (zeros >= 2) continue; // Level-1 Menger sponge void!
                float gVal = 0.08f + 0.035f * static_cast<float>((ix + iy + iz + 3) % 3); // STRICT r == g == b!
                structureInstances.push_back({
                    glm::vec4(templeCenter + glm::vec3(ix * 2.9f, iy * 2.9f + 3.0f, iz * 2.9f), 1.0f),
                    glm::vec4(2.75f, 2.75f, 2.75f, 0.0f),
                    glm::vec4(gVal, gVal, gVal, 22.0f)
                });
            }
        }
    }
    // 8 Achromatic Sentinel Obelisks ringing Stage II MonolithTemple (STRICT r == g == b!)
    for (int ob = 0; ob < 8; ++ob) {
        float oa = static_cast<float>(ob) * (kTau / 8.0f);
        float grey = 0.06f + 0.02f * (ob % 2);
        structureInstances.push_back({
            glm::vec4(templeCenter + glm::vec3(std::cos(oa) * 9.5f, 2.5f, std::sin(oa) * 9.5f), 1.0f),
            glm::vec4(0.85f, 8.5f, 0.85f, oa),
            glm::vec4(grey, grey, grey, 22.0f)
        });
    }

    // (e) Dramatic Deep Midnight-Navy Brutalist Megastructure Arch Framing Upper-Right of GodColossus!
    if (brutalMode >= 1) {
        for (int b = 0; b < 16; ++b) {
            float t = static_cast<float>(b) / 15.0f;
            glm::vec3 pos(
                4.8f + t * 14.5f + ((b % 2 == 0) ? 0.9f : -0.7f),
                20.5f - t * 16.5f + ((b % 3 == 0) ? 1.2f : 0.0f),
                5.5f + t * 11.5f
            );
            float sx = 3.2f + 1.8f * (b % 3);
            float sy = 2.6f + 1.5f * ((b + 1) % 3);
            float sz = 3.4f + 1.4f * (b % 2);
            glm::vec3 navyCol = (b % 5 == 3)
                ? glm::vec3(0.006f, 0.042f, 0.024f)
                : glm::vec3(0.005f, 0.014f, 0.032f);
            structureInstances.push_back({
                glm::vec4(pos, 1.0f),
                glm::vec4(sx, sy, sz, 0.48f + t * 0.55f),
                glm::vec4(navyCol, 20.0f)
            });
        }
    }
}

void NativeCosmosSim::resetWorld(uint32_t newSeed) {
    if (newSeed != 0) worldSeed = newSeed;
    else worldSeed = worldSeed * 1664525u + 1013904223u;

    tickCount = 0;
    simTime = 0.0;
    maxEntityCap = kTierEntityCaps[tierIdx];
    liveEntityCount = (tierIdx == 0) ? 495 : std::min(maxEntityCap, 1200);
    xenomimicCount = 2;
    nhiActiveCount = 12;

    const int allocCap = 50000;
    m_entPos.assign(allocCap, glm::vec3(0.0f));
    m_entVel.assign(allocCap, glm::vec3(0.0f));
    m_entPhylum.assign(allocCap, 0u);
    m_entFlags.assign(allocCap, 0u);
    m_entEnergy.assign(allocCap, 1.0f);
    m_entPhase.assign(allocCap, 0.0f);
    m_entInputs6.assign(static_cast<size_t>(allocCap) * 6, 0.0f);
    m_entWeights70.assign(static_cast<size_t>(allocCap) * 70, 0.0f);
    m_entPrevHid6.assign(static_cast<size_t>(allocCap) * 6, 0.0f);
    m_entPrevVal.assign(allocCap, 0.0f);
    m_entRewards.assign(allocCap, 0.0f);
    m_entOutputs4.assign(static_cast<size_t>(allocCap) * 4, 0.0f);

    for (int i = 0; i < liveEntityCount; ++i) {
        uint32_t s = worldSeed ^ static_cast<uint32_t>(i * 747796405u + 1u);
        float r = 4.0f + 58.0f * std::sqrt(hash01(s));
        float a = kTau * hash01(s + 1u);
        m_entPos[i] = glm::vec3(std::cos(a) * r, -3.2f + 3.5f * hash01(s + 2u), std::sin(a) * r);
        m_entVel[i] = glm::vec3(-std::sin(a), 0.0f, std::cos(a)) * (1.2f + 1.5f * hash01(s + 3u));
        m_entPhylum[i] = static_cast<uint8_t>(i % 10);
        m_entFlags[i] = (i < xenomimicCount) ? 1u : ((i >= xenomimicCount && i < xenomimicCount + nhiActiveCount) ? 2u : 0u);
        m_entEnergy[i] = 0.8f + 0.6f * hash01(s + 4u);
        m_entPhase[i] = hash01(s + 5u) * kTau;
        for (int w = 0; w < 70; ++w) {
            m_entWeights70[static_cast<size_t>(i) * 70 + w] = (hash01(s + 10u + w) - 0.5f) * 0.7f;
        }
    }

    // Initialize Gray-Scott reaction-diffusion chemical dish
    for (int y = 0; y < kGrayScottSize; ++y) {
        for (int x = 0; x < kGrayScottSize; ++x) {
            int idx4 = (y * kGrayScottSize + x) * 4;
            float dx = static_cast<float>(x - kGrayScottSize / 2);
            float dy = static_cast<float>(y - kGrayScottSize / 2);
            bool seedPatch = (dx * dx + dy * dy < 160.0f) || (((x * 13 + y * 7) % 29) == 0);
            grayScottRgba[idx4] = seedPatch ? 0.50f : 1.0f;
            grayScottRgba[idx4 + 1] = seedPatch ? 0.25f : 0.0f;
            grayScottRgba[idx4 + 2] = 0.1f;
            grayScottRgba[idx4 + 3] = 1.0f;
        }
    }

    // Initialize Mechalogodrom 54,048-param cortex, 100 GlyphBrains, Xylos 48 Poincaré foci, Asmodenius 272 LIF
    for (size_t i = 0; i < m_mechaParams54k.size(); ++i) {
        m_mechaParams54k[i] = (hash01(worldSeed + static_cast<uint32_t>(i)) - 0.5f) * 0.28f;
    }
    for (size_t i = 0; i < m_glyphStates.size(); ++i) {
        m_glyphStates[i] = (hash01(worldSeed ^ static_cast<uint32_t>(i * 19u)) - 0.5f) * 0.8f;
    }
    for (int g = 0; g < 100; ++g) {
        m_glyphLatW[g * 4 + 0] = 0.14f;
        m_glyphLatW[g * 4 + 1] = 0.14f;
        m_glyphLatW[g * 4 + 2] = -0.08f;
        m_glyphLatW[g * 4 + 3] = 0.12f;
    }
    for (int f = 0; f < 48; ++f) {
        float rr = 0.18f + 0.72f * std::sqrt(static_cast<float>(f + 1) / 49.0f);
        float th = static_cast<float>(f) * 2.3999632f;
        xylosFociUv[f * 2] = std::cos(th) * rr;
        xylosFociUv[f * 2 + 1] = std::sin(th) * rr;
        xylosAct[f] = std::sin(static_cast<float>(f) * 0.5f) * 0.5f;
    }
    for (int e = 0; e < 192; ++e) {
        m_xylosEdgeSrc[e] = static_cast<uint16_t>(e % 48);
        m_xylosEdgeDst[e] = static_cast<uint16_t>((e * 7 + 3) % 48);
        m_xylosEdgeW[e] = (hash01(worldSeed + static_cast<uint32_t>(e * 37)) - 0.5f) * 0.45f;
    }
    for (int k = 0; k < 14; ++k) m_xylosNlmsW[k] = 0.05f;
    m_asmoVmem.fill(-65.0f);
    m_asmoCa.fill(0.1f);

    // 5 Archon SuperMinds (orbiting high & wide so default sightline to Viz3D + GodColossus is 100% clear!) + 20 4D Titans
    for (int a = 0; a < 5; ++a) {
        float ang = static_cast<float>(a) * (kTau / 5.0f) + 0.62f;
        archons[a].pos = glm::vec3(std::cos(ang) * 32.0f, 10.5f + (a % 2) * 3.5f, std::sin(ang) * 32.0f - 8.0f);
        archons[a].radius = 2.15f;
        archons[a].hue = static_cast<float>(a) * 0.2f;
        archons[a].salience = 0.5f + 0.1f * a;
    }
    for (int t = 0; t < 20; ++t) {
        float ang = static_cast<float>(t) * (kTau / 20.0f);
        titans[t].pos = glm::vec3(std::cos(ang) * 44.0f, 0.5f, std::sin(ang) * 44.0f);
        titans[t].scale = 2.4f;
        titans[t].policy = t % 4;
        titans[t].vitality = 1.0f;
    }

    // 6D->3D Quasicrystal shell for GodColossus via native C++/Zig kernel
    quasicrystalShellPts.resize(1024);
    if (m_bridges->quasicrystal) {
        uint32_t nPts = m_bridges->quasicrystal(3, 1.65f, 0.8f, 3.2f, reinterpret_cast<float*>(quasicrystalShellPts.data()), 1024);
        quasicrystalShellPts.resize(nPts);
    }

    // ADR-0007 Apex Golden Hashes + Hoggar 63-line + RosettaWire RSC1 CID
    if (m_bridges->apex_hashes) m_bridges->apex_hashes(worldSeed, apexHashes);
    if (m_bridges->zig_hoggar_hex) {
        double tr = 0.0;
        hoggarViolatedLines = m_bridges->zig_hoggar_hex(&tr);
    }
    if (m_bridges->rsc1_encode) {
        uint8_t cell[256]{};
        char cid[72]{};
        const char* payload = "CQM2-v4.0.0-LOCAL-WORKSTATION";
        if (m_bridges->rsc1_encode("cqm2.boot.v4", "application/octet-stream", reinterpret_cast<const uint8_t*>(payload), std::strlen(payload), cell, sizeof(cell), cid) > 0) {
            silicon.rsc1Cid = cid;
        }
    }

    // Sorting arrays + Lorenz ribbon seed
    for (int s = 0; s < kSortingAlgoCount; ++s) {
        sortSteps[s] = static_cast<uint32_t>(120 + s * 7);
        sortSwaps[s] = static_cast<uint32_t>(3 + (s % 9));
        for (int k = 0; k < 16; ++k) {
            m_sortArrays[s][k] = hash01(worldSeed ^ static_cast<uint32_t>(s * 97 + k));
        }
    }
    lorenzRibbonPts.clear();
    m_lorenzHead = glm::vec3(0.1f, 0.0f, 0.0f);
    for (int i = 0; i < 360; ++i) {
        const float dtL = 0.008f;
        float dx = 10.0f * (m_lorenzHead.y - m_lorenzHead.x);
        float dy = m_lorenzHead.x * (28.0f - m_lorenzHead.z) - m_lorenzHead.y;
        float dz = m_lorenzHead.x * m_lorenzHead.y - (8.0f / 3.0f) * m_lorenzHead.z;
        m_lorenzHead += glm::vec3(dx, dy, dz) * dtL;
        lorenzRibbonPts.push_back(glm::vec3(m_lorenzHead.x * 0.17f + 4.8f, m_lorenzHead.z * 0.13f - 3.6f, m_lorenzHead.y * 0.17f + 3.5f));
    }

    m_firstLawPools = { 1200.0, 180.0, 57.0, 0.0, 0.0, 1437.0 };
    regenerateAccessChallenge();
    buildStaticWorldGeometry();
    m_jolt->seedSpecimens(18);
    step(0.016f);
}

void NativeCosmosSim::stepSortingFields() {
    for (int a = 0; a < kSortingAlgoCount; ++a) {
        auto& arr = m_sortArrays[a];
        int i = static_cast<int>(sortSteps[a] % 15u);
        if (arr[i] > arr[i + 1]) {
            std::swap(arr[i], arr[i + 1]);
            sortSwaps[a]++;
        } else if ((sortSteps[a] % 31u) == 0u) {
            // Re-inject slight entropy wave so sorting fields remain dynamically alive
            int j = static_cast<int>((sortSteps[a] * 7u + a) % 16u);
            arr[j] = hash01(static_cast<uint32_t>(tickCount * 13u + a * 37u + j));
        }
        sortSteps[a]++;
        int ordered = 0;
        for (int k = 0; k < 15; ++k) if (arr[k] <= arr[k + 1]) ordered++;
        sortOmega[a] = static_cast<float>(ordered) / 15.0f;
    }
    if (autoSort && (tickCount % 240u) == 0u) {
        activeSortAlgo = (activeSortAlgo + 1) % kSortingAlgoCount;
    }
}

void NativeCosmosSim::updateBrainTextures() {
    // 1. MECHA / APEX 128x128 neural activation heatmap (purple/cyan/gold)
    for (int y = 0; y < kBrainTexSize; ++y) {
        for (int x = 0; x < kBrainTexSize; ++x) {
            int idx = (y * kBrainTexSize + x) * 4;
            float fx = (static_cast<float>(x) / 127.0f) * 2.0f - 1.0f;
            float fy = (static_cast<float>(y) / 127.0f) * 2.0f - 1.0f;
            float r = std::sqrt(fx * fx + fy * fy);
            int mIdx = ((y / 2) % 64);
            float act = 0.5f + 0.5f * m_mechaOut64[mIdx] * std::cos(r * 9.0f - static_cast<float>(simTime) * 2.5f);
            float glow = std::exp(-r * r * 2.4f) * (0.45f + 0.55f * act);
            brainTexMecha[idx + 0] = static_cast<uint8_t>(std::clamp(glow * 185.0f + 16.0f, 0.0f, 255.0f));
            brainTexMecha[idx + 1] = static_cast<uint8_t>(std::clamp(glow * 95.0f + 12.0f, 0.0f, 255.0f));
            brainTexMecha[idx + 2] = static_cast<uint8_t>(std::clamp(glow * 250.0f + 28.0f, 0.0f, 255.0f));
            brainTexMecha[idx + 3] = 255u;
        }
    }

    // 2. XYLOS 48-foci Poincaré Hyperbolic Disk
    std::fill(brainTexXylos.begin(), brainTexXylos.end(), 0u);
    for (size_t i = 0; i < brainTexXylos.size(); i += 4) {
        brainTexXylos[i + 0] = 14u;
        brainTexXylos[i + 1] = 10u;
        brainTexXylos[i + 2] = 26u;
        brainTexXylos[i + 3] = 255u;
    }
    for (int f = 0; f < 48; ++f) {
        int cx = static_cast<int>((xylosFociUv[f * 2] * 0.46f + 0.5f) * 127.0f);
        int cy = static_cast<int>((xylosFociUv[f * 2 + 1] * 0.46f + 0.5f) * 127.0f);
        float a = 0.5f + 0.5f * xylosAct[f];
        for (int dy = -3; dy <= 3; ++dy) {
            for (int dx = -3; dx <= 3; ++dx) {
                int px = cx + dx, py = cy + dy;
                if (px < 0 || px >= 128 || py < 0 || py >= 128) continue;
                float fall = std::exp(-0.35f * static_cast<float>(dx * dx + dy * dy));
                int p4 = (py * 128 + px) * 4;
                brainTexXylos[p4 + 0] = static_cast<uint8_t>(std::min(255.0f, brainTexXylos[p4 + 0] + fall * 240.0f * a));
                brainTexXylos[p4 + 1] = static_cast<uint8_t>(std::min(255.0f, brainTexXylos[p4 + 1] + fall * 195.0f));
                brainTexXylos[p4 + 2] = static_cast<uint8_t>(std::min(255.0f, brainTexXylos[p4 + 2] + fall * 255.0f));
            }
        }
    }

    // 3. GLYPH 32x32 lattice upscaled 4x -> 128x128 (neon magenta/amber cells like user screenshot!)
    int gSel = std::clamp(pantheonSelected, 0, 99);
    const float* gGrid = m_glyphStates.data() + static_cast<size_t>(gSel) * 1024;
    for (int y = 0; y < 128; ++y) {
        int gy = y >> 2;
        bool borderY = ((y & 3) == 0);
        for (int x = 0; x < 128; ++x) {
            int gx = x >> 2;
            bool border = borderY || ((x & 3) == 0);
            float v = gGrid[gy * 32 + gx];
            float mag = border ? 0.12f : std::abs(v);
            int p4 = (y * 128 + x) * 4;
            if (v >= 0.0f) {
                brainTexGlyph[p4 + 0] = static_cast<uint8_t>(std::clamp(22.0f + mag * 230.0f, 0.0f, 255.0f));
                brainTexGlyph[p4 + 1] = static_cast<uint8_t>(std::clamp(12.0f + mag * 85.0f, 0.0f, 255.0f));
                brainTexGlyph[p4 + 2] = static_cast<uint8_t>(std::clamp(34.0f + mag * 195.0f, 0.0f, 255.0f));
            } else {
                brainTexGlyph[p4 + 0] = static_cast<uint8_t>(std::clamp(24.0f + mag * 245.0f, 0.0f, 255.0f));
                brainTexGlyph[p4 + 1] = static_cast<uint8_t>(std::clamp(18.0f + mag * 205.0f, 0.0f, 255.0f));
                brainTexGlyph[p4 + 2] = static_cast<uint8_t>(std::clamp(20.0f + mag * 55.0f, 0.0f, 255.0f));
            }
            brainTexGlyph[p4 + 3] = 255u;
        }
    }
    brainTexturesDirty = true;
}

void NativeCosmosSim::step(float rawDt) {
    const float dt = paused ? 0.0f : std::clamp(rawDt, 0.001f, 0.05f) * kSpeedValues[speedIdx];
    m_jolt->step(paused ? 0.0f : std::clamp(rawDt, 0.001f, 0.033f));
    if (paused && tickCount > 0) return;

    tickCount++;
    simTime += static_cast<double>(dt);

    // 1. Live Gray-Scott PDE step on Zig SIMD128/AVX2
    if (m_bridges->zig_gs_rgba && (tickCount % 2u == 0u)) {
        m_bridges->zig_gs_rgba(
            grayScottRgba.data(),
            m_grayScottScratch.data(),
            kGrayScottSize,
            0.0367f + 0.004f * chaosLevel,
            0.0649f,
            0.2097f,
            0.1050f,
            1.0f,
            0.008f
        );
        grayScottRgba.swap(m_grayScottScratch);
        grayScottDirty = true;
    }

    // 2. Prepare sensory inputs & evaluate all living 70-parameter EntityBrains on RTX 5070 Ti CUDA (or Zig SIMD)!
    const int N = liveEntityCount;
    int phylumHist[10]{};
    float sinSum = 0.0f, cosSum = 0.0f;
    xenomimicCount = 0;
    nhiActiveCount = 0;

    for (int i = 0; i < N; ++i) {
        const glm::vec3& p = m_entPos[i];
        float rNorm = glm::length(glm::vec2(p.x, p.z)) / 75.0f;
        float* in6 = m_entInputs6.data() + static_cast<size_t>(i) * 6;
        in6[0] = std::tanh(p.x * 0.025f);
        in6[1] = std::tanh(p.z * 0.025f);
        in6[2] = 1.0f - std::clamp(rNorm, 0.0f, 1.5f);
        in6[3] = m_entEnergy[i] - 0.8f;
        in6[4] = chaosLevel * std::sin(m_entPhase[i]);
        in6[5] = (m_entFlags[i] & 1u) ? -1.0f : 1.0f; // chirality sensor!
        m_entRewards[i] = 0.15f * in6[2] + 0.1f * m_entEnergy[i];
    }

    if (N > 0) {
        if (m_bridges->cuda_entity_70) {
            double ms = 0.0;
            silicon.lastBrainGflops = m_bridges->cuda_entity_70(
                m_entInputs6.data(),
                m_entWeights70.data(),
                m_entPrevHid6.data(),
                m_entPrevVal.data(),
                m_entRewards.data(),
                m_entOutputs4.data(),
                N,
                0.02f,
                0.012f,
                &ms
            );
            silicon.lastBrainMs = ms;
        } else if (m_bridges->zig_entity_70) {
            m_bridges->zig_entity_70(
                m_entInputs6.data(),
                m_entWeights70.data(),
                m_entPrevHid6.data(),
                m_entPrevVal.data(),
                m_entRewards.data(),
                m_entOutputs4.data(),
                static_cast<size_t>(N),
                0.02f,
                0.012f
            );
        }
    }

    // 3. Integrate organism kinematics, dome boundary (N(1) Contained vs N(2) Break-Free), & build GPU instance buffer
    organismInstances.clear();
    organismInstances.reserve(static_cast<size_t>(N + 25));
    const float maxR = (nMode == 1) ? 74.0f : 165.0f;

    for (int i = 0; i < N; ++i) {
        const float* out4 = m_entOutputs4.data() + static_cast<size_t>(i) * 4;
        float turn = out4[0] * 2.4f;
        float thrust = (0.55f + 0.45f * out4[1]) * 5.2f;
        bool isXeno = (m_entFlags[i] & 1u) != 0;
        bool isNhi = (m_entFlags[i] & 2u) != 0;
        if (isXeno) {
            xenomimicCount++;
            turn = -turn; // opposite enantiomeric motor chirality!
        }
        if (isNhi) nhiActiveCount++;

        float heading = std::atan2(m_entVel[i].z, m_entVel[i].x) + turn * dt;
        m_entVel[i].x = std::cos(heading) * thrust;
        m_entVel[i].z = std::sin(heading) * thrust;
        m_entPos[i] += m_entVel[i] * dt;

        float r2d = std::hypot(m_entPos[i].x, m_entPos[i].z);
        if (r2d > maxR && r2d > 1e-4f) {
            if (nMode == 1) {
                m_entPos[i].x *= (maxR / r2d);
                m_entPos[i].z *= (maxR / r2d);
                m_entVel[i] = -m_entVel[i] * 0.8f;
            }
        }
        float floorY = -3.8f + 0.8f * std::sin(m_entPos[i].x * 0.08f) * std::cos(m_entPos[i].z * 0.08f);
        m_entPos[i].y = floorY + 0.55f + (isNhi ? 4.5f : 0.0f) + 0.65f * std::abs(std::sin(m_entPhase[i]));
        m_entPhase[i] += dt * (2.6f + std::abs(out4[2]) * 2.0f);

        uint8_t phy = m_entPhylum[i] % 10u;
        phylumHist[phy]++;
        sinSum += std::sin(m_entPhase[i]);
        cosSum += std::cos(m_entPhase[i]);

        glm::vec3 srgb = hslToRgb(static_cast<float>(phy) * 0.1f + 0.03f * out4[2], 0.92f, 0.56f);
        glm::vec3 col = isXeno
            ? glm::vec3(0.04f, 0.72f, 0.48f)
            : (isNhi ? glm::vec3(0.75f, 0.52f, 0.05f) : glm::pow(srgb, glm::vec3(2.2f)) * 0.78f);
        float scl = isNhi ? 0.88f : (isXeno ? 0.68f : (0.38f + 0.24f * m_entEnergy[i]));
        organismInstances.push_back({
            glm::vec4(m_entPos[i], scl),
            glm::vec4(heading, out4[2], isXeno ? -1.0f : 1.0f, m_entPhase[i]),
            glm::vec4(col, static_cast<float>(phy))
        });
    }

    // Append 20 4D Titans into organismInstances (type = 30)
    for (int t = 0; t < 20; ++t) {
        float ang = static_cast<float>(t) * (kTau / 20.0f) + static_cast<float>(simTime) * 0.08f;
        titans[t].pos = glm::vec3(std::cos(ang) * 42.0f, -1.2f + 1.4f * std::sin(static_cast<float>(simTime) + t), std::sin(ang) * 42.0f);
        titans[t].w4d = std::sin(static_cast<float>(simTime) * 0.9f + t * 0.5f);
        glm::vec3 tCol = hslToRgb(0.55f + 0.11f * static_cast<float>(titans[t].policy), 0.85f, 0.62f);
        organismInstances.push_back({
            glm::vec4(titans[t].pos, titans[t].scale),
            glm::vec4(ang, titans[t].w4d, 1.0f, static_cast<float>(simTime) * 1.4f),
            glm::vec4(tCol, 30.0f)
        });
    }

    // Shannon Diversity H & Kuramoto Phase Coherence R
    if (N > 0) {
        float h = 0.0f;
        for (int p = 0; p < 10; ++p) {
            if (phylumHist[p] > 0) {
                float pr = static_cast<float>(phylumHist[p]) / static_cast<float>(N);
                h -= pr * std::log(pr);
            }
        }
        shannonDiversityH = h;
        kuramotoOrderR = std::hypot(sinSum / N, cosSum / N);
    }

    // 4. Sovereign Brains: Mechalogodrom 54k + 100 GlyphBrains + Xylos 48 Poincaré + Asmodenius 272 LIF + Eshkol GWT
    float shellIn90[90]{};
    for (int i = 0; i < 90; ++i) shellIn90[i] = std::sin(static_cast<float>(simTime) * 0.7f + i * 0.21f) * chaosLevel;
    if (m_bridges->cuda_mecha_54k) {
        mechaEnergy = m_bridges->cuda_mecha_54k(shellIn90, m_mechaParams54k.data(), m_mechaPreTrace.data(), m_mechaPostTrace.data(), m_mechaOut64.data(), 0.004f);
    } else if (m_bridges->zig_mecha_54k) {
        mechaEnergy = m_bridges->zig_mecha_54k(shellIn90, m_mechaParams54k.data(), m_mechaPreTrace.data(), m_mechaPostTrace.data(), m_mechaOut64.data(), 0.004f);
    }

    if (m_bridges->glyph_batch && (tickCount % 2u == 0u)) {
        for (int g = 0; g < 100; ++g) {
            m_glyphDrive[g * 4 + 0] = shannonDiversityH * 0.4f;
            m_glyphDrive[g * 4 + 1] = kuramotoOrderR;
            m_glyphDrive[g * 4 + 2] = chaosLevel;
            m_glyphDrive[g * 4 + 3] = mechaEnergy;
        }
        glyphMeanEnergy = m_bridges->glyph_batch(m_glyphStates.data(), m_glyphLatW.data(), m_glyphDrive.data(), 100, 0.01f);
    }

    if (xylosReplaying && xylosTapeFrames > 0) {
        const float* frame = m_xylosTape.data() + (m_xylosPlayCursor % xylosTapeFrames) * 48;
        std::copy(frame, frame + 48, xylosAct.begin());
        m_xylosPlayCursor = (m_xylosPlayCursor + 1) % xylosTapeFrames;
    } else if (m_bridges->zig_xylos_oja) {
        float taps14[14]{
            shannonDiversityH * 0.4f, kuramotoOrderR, chaosLevel, mechaEnergy,
            glyphMeanEnergy, static_cast<float>(modularityQ), static_cast<float>(quantumMagicM2),
            asmodeniusEnsTone, sortOmega[activeSortAlgo], 0.5f, -0.3f, 0.2f, 0.4f, 0.1f
        };
        xylosNlmsErr = m_bridges->zig_xylos_oja(
            xylosFociUv.data(), xylosAct.data(),
            m_xylosEdgeSrc.data(), m_xylosEdgeDst.data(), m_xylosEdgeW.data(),
            m_xylosNlmsW.data(), taps14, kuramotoOrderR, 0.015f
        );
        if (xylosRecording && xylosTapeFrames < 1024) {
            std::copy(xylosAct.begin(), xylosAct.end(), m_xylosTape.data() + xylosTapeFrames * 48);
            xylosTapeFrames++;
        }
    }

    if (m_bridges->asmodenius_lif) {
        for (int n = 0; n < 272; ++n) {
            m_asmoDrive[n] = 0.55f + 0.45f * std::sin(static_cast<float>(simTime) * 3.1f + n * 0.17f) + 0.3f * chaosLevel;
        }
        float nmod[4] = { 0.65f + 0.25f * kuramotoOrderR, 0.55f, 0.45f + 0.35f * chaosLevel, 0.70f };
        float sum6[6]{};
        m_bridges->asmodenius_lif(m_asmoVmem.data(), m_asmoCa.data(), m_asmoSpikes.data(), m_asmoDrive.data(), nmod, 1.0f, sum6);
        asmodeniusCorticalHz = sum6[0];
        asmodeniusEnsTone = sum6[3];
    }

    // 5 Archon SuperMinds + Eshkol Global Workspace Competition
    float sal5[5]{};
    float modVecs[5 * 4]{};
    for (int a = 0; a < 5; ++a) {
        archons[a].gyroAngle += dt * (1.1f + 0.25f * a);
        archons[a].pos.y = 10.5f + (a % 2) * 3.0f + 1.4f * std::sin(static_cast<float>(simTime) * 0.9f + a * 1.2f);
        sal5[a] = 0.4f + 0.5f * std::sin(static_cast<float>(simTime) * 0.6f + a * 1.1f) + 0.2f * mechaEnergy;
        for (int d = 0; d < 4; ++d) modVecs[a * 4 + d] = std::cos(archons[a].gyroAngle + d);
    }
    if (m_bridges->eshkol_gw) {
        float probs[5]{};
        float bcast[4]{};
        m_bridges->eshkol_gw(sal5, modVecs, 5, 4, 0.35f, probs, bcast);
        for (int a = 0; a < 5; ++a) archons[a].broadcastProb = probs[a];
    }
    if (m_bridges->eshkol_vfe) {
        double qB[4] = { 0.45, 0.25, 0.20, 0.10 };
        double pP[4] = { 0.25, 0.25, 0.25, 0.25 };
        double lk[4] = { 0.75, 0.50, 0.35, 0.20 };
        eshkolVfe = m_bridges->eshkol_vfe(qB, pP, lk, 4);
    }

    // 5. Quantum & Thermodynamic Invariants (Errata A-03 KBN First-Law + Moonlab QGTL/QRNG + FWHT Magic + BitNet B-04 + CSR Louvain)
    if (m_bridges->zig_first_law) {
        firstLawDrift = m_bridges->zig_first_law(m_firstLawPools.data(), 0.08 * static_cast<double>(dt), 0.02 * static_cast<double>(dt), 0.68);
        freeEnergyPool = m_firstLawPools[0] + m_firstLawPools[1] + m_firstLawPools[2];
        irreversibleHeat = m_firstLawPools[3];
    }
    if (m_bridges->zig_bitnet_gemv) {
        const uint8_t pk[1] = { 0b01'10'01'01u };
        const float xin[4] = { kuramotoOrderR, shannonDiversityH * 0.4f, chaosLevel, mechaEnergy };
        const float scl[1] = { 0.65f };
        m_bridges->zig_bitnet_gemv(pk, xin, scl, &bitnetProbeOut, 1, 4, 2);
    }

    if ((tickCount % 15u) == 1u) {
        if (m_bridges->qgtl_qwz) {
            double out6[6]{};
            double mParam = 1.0 - 1.6 * std::sin(simTime * 0.15);
            m_bridges->qgtl_qwz(mParam, 0.4, 0.6, 16, out6);
            qwzChernNumber = static_cast<int>(std::round(out6[5]));
        }
        if (m_bridges->qrng_draw) {
            uint8_t qbytes[16]{};
            uint64_t caps = 0;
            m_bridges->qrng_draw(qbytes, sizeof(qbytes), &bellChsh, &caps);
        }
        if (m_bridges->fwht_magic) {
            double th = simTime * 0.35;
            double re[4] = { 0.5, 0.5 * std::cos(th), 0.5, 0.5 * std::cos(th * 1.7) };
            double im[4] = { 0.0, 0.5 * std::sin(th), 0.0, 0.5 * std::sin(th * 1.7) };
            quantumMagicM2 = m_bridges->fwht_magic(re, im, 2);
        }
        if (m_bridges->zig_kerr_mino) {
            double kout[4]{};
            m_bridges->zig_kerr_mino(0.9, kPi * 0.5, 3.8, 2.0, 600, kout);
            kerrCarterDrift = kout[3];
        }

        // Build synaptic connectome lines ( strictly EXCLUDING Xenomimics — zero tether lines!)
        connectomeLines.clear();
        std::vector<uint32_t> eu, ev;
        const int sampleN = std::min(N, 96);
        for (int i = 0; i < sampleN; ++i) {
            if (m_entFlags[i] & 1u) continue;
            for (int j = i + 1; j < sampleN; ++j) {
                if (m_entFlags[j] & 1u) continue;
                glm::vec3 d = m_entPos[j] - m_entPos[i];
                float d2 = glm::dot(d, d);
                if (d2 < 144.0f && eu.size() < 260) {
                    eu.push_back(static_cast<uint32_t>(i));
                    ev.push_back(static_cast<uint32_t>(j));
                    connectomeLines.push_back(m_entPos[i]);
                    connectomeLines.push_back(m_entPos[j]);
                }
            }
        }
        synapticLinkCount = static_cast<int>(eu.size());
        if (m_bridges->csr_louvain && sampleN > 2 && !eu.empty()) {
            std::vector<float> pr(sampleN);
            std::vector<uint32_t> comm(sampleN);
            double st4[4]{};
            m_bridges->csr_louvain(static_cast<uint32_t>(sampleN), eu.data(), ev.data(), static_cast<uint32_t>(eu.size()), pr.data(), comm.data(), st4);
            modularityQ = st4[0];
            degreeEntropyBits = st4[1];
        }
    }

    // Advance Lorenz Viz3D ribbon
    if (!lorenzRibbonPts.empty()) {
        const float dtL = 0.006f;
        float dx = 10.0f * (m_lorenzHead.y - m_lorenzHead.x);
        float dy = m_lorenzHead.x * (28.0f - m_lorenzHead.z) - m_lorenzHead.y;
        float dz = m_lorenzHead.x * m_lorenzHead.y - (8.0f / 3.0f) * m_lorenzHead.z;
        m_lorenzHead += glm::vec3(dx, dy, dz) * dtL;
        lorenzRibbonPts.erase(lorenzRibbonPts.begin());
        lorenzRibbonPts.push_back(glm::vec3(m_lorenzHead.x * 0.17f + 4.8f, m_lorenzHead.z * 0.13f - 3.6f, m_lorenzHead.y * 0.17f + 3.5f));
    }

    stepSortingFields();
    if (tickCount % 4u == 1u) updateBrainTextures();

    // Record sparklines & all 16 Observatory charts
    int c = historyCursor;
    sparkEntities[c] = static_cast<float>(liveEntityCount);
    sparkXenomimics[c] = static_cast<float>(xenomimicCount);
    sparkChaos[c] = chaosLevel;
    sparkEnergy[c] = static_cast<float>(freeEnergyPool);
    sparkSortOmega[c] = sortOmega[activeSortAlgo];

    // Tab 0 (OVER): Population, Free Energy, Shannon H, Kuramoto R
    obsCharts[0][c] = static_cast<float>(liveEntityCount);
    obsCharts[1][c] = static_cast<float>(freeEnergyPool);
    obsCharts[2][c] = shannonDiversityH;
    obsCharts[3][c] = kuramotoOrderR;
    // Tab 1 (VAR): Quantum Magic M2, Modularity Q, Eshkol VFE, Xylos NLMS Error
    obsCharts[4][c] = static_cast<float>(quantumMagicM2);
    obsCharts[5][c] = static_cast<float>(modularityQ);
    obsCharts[6][c] = static_cast<float>(eshkolVfe);
    obsCharts[7][c] = xylosNlmsErr;
    // Tab 2 (ECO): Xenomimics, Synaptic Links, Irreversible Heat, Asmodenius Cortical Hz
    obsCharts[8][c] = static_cast<float>(xenomimicCount);
    obsCharts[9][c] = static_cast<float>(synapticLinkCount);
    obsCharts[10][c] = static_cast<float>(irreversibleHeat);
    obsCharts[11][c] = asmodeniusCorticalHz;
    // Tab 3 (WAR): Titan Cooperation, Mecha 54k Drive, Glyph 100 Energy, Bell CHSH
    obsCharts[12][c] = 0.5f + 0.4f * std::sin(static_cast<float>(simTime) * 0.4f);
    obsCharts[13][c] = mechaEnergy;
    obsCharts[14][c] = glyphMeanEnergy;
    obsCharts[15][c] = static_cast<float>(bellChsh);

    historyCursor = (historyCursor + 1) % kHistoryLen;
}

void NativeCosmosSim::actionSplit() {
    int add = std::min(64, maxEntityCap - liveEntityCount);
    for (int k = 0; k < add; ++k) {
        int src = (liveEntityCount > 0) ? (k % liveEntityCount) : 0;
        int dst = liveEntityCount++;
        m_entPos[dst] = m_entPos[src] + glm::vec3((hash01(dst * 17u) - 0.5f) * 3.0f, 0.0f, (hash01(dst * 31u) - 0.5f) * 3.0f);
        m_entVel[dst] = -m_entVel[src];
        m_entPhylum[dst] = m_entPhylum[src];
        m_entFlags[dst] = m_entFlags[src] & ~1u;
        m_entEnergy[dst] = 0.9f;
        m_entPhase[dst] = m_entPhase[src] + 0.6f;
        std::copy_n(m_entWeights70.data() + static_cast<size_t>(src) * 70, 70, m_entWeights70.data() + static_cast<size_t>(dst) * 70);
    }
}

void NativeCosmosSim::actionBurst() {
    for (int i = 0; i < liveEntityCount; ++i) {
        m_entEnergy[i] = std::min(2.0f, m_entEnergy[i] + 0.45f);
        m_entVel[i] *= 1.35f;
    }
    foodOrbCount += 120;
}

void NativeCosmosSim::actionMutate() {
    for (int i = 0; i < liveEntityCount; ++i) {
        float* w = m_entWeights70.data() + static_cast<size_t>(i) * 70;
        int idx = (i * 13 + static_cast<int>(tickCount)) % 70;
        w[idx] = std::clamp(w[idx] + (hash01(static_cast<uint32_t>(i * 97 + tickCount)) - 0.5f) * 0.5f, -1.5f, 1.5f);
        if ((i % 7) == 0) m_entPhylum[i] = static_cast<uint8_t>((m_entPhylum[i] + 1) % 10);
    }
}

void NativeCosmosSim::actionChaosPlus() {
    chaosLevel = std::clamp(chaosLevel + 0.15f, 0.05f, 2.0f);
    if (chaosLevel >= 1.95f) chaosLevel = 0.25f;
}

void NativeCosmosSim::actionGodPulse() {
    viewMode = 6; // god view
    for (int a = 0; a < 5; ++a) archons[a].salience = 1.0f;
    chaosLevel = std::clamp(chaosLevel * 0.85f + 0.25f, 0.1f, 2.0f);
}

void NativeCosmosSim::actionSpawnXenomimic(int count) {
    int spawned = 0;
    for (int i = 0; i < liveEntityCount && spawned < count; ++i) {
        if ((m_entFlags[i] & 1u) == 0u) {
            m_entFlags[i] |= 1u;
            spawned++;
        }
    }
    xenomimicCount += spawned;
}

void NativeCosmosSim::actionLifeTreeBloom() {
    wildFloraCount = std::min(60000, wildFloraCount + 2500);
    buildStaticWorldGeometry();
}

void NativeCosmosSim::actionNhiRelease(int count) {
    actionSplit();
    int tagged = 0;
    for (int i = liveEntityCount - 1; i >= 0 && tagged < count; --i) {
        m_entFlags[i] = 2u;
        tagged++;
    }
}

void NativeCosmosSim::actionShatterReliquary() {
    m_jolt->shatterLargest();
}

void NativeCosmosSim::actionStepAllSorts() {
    for (int k = 0; k < 12; ++k) stepSortingFields();
}

} // namespace cqm2_sim
