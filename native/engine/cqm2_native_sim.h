/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once

#include <glm/glm.hpp>
#include <glm/gtc/quaternion.hpp>
#include <array>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace cqm2_sim {

inline constexpr int kTierCount = 6;
inline constexpr int kViewModeCount = 12;
inline constexpr int kSpeedCount = 6;
inline constexpr int kRenderModeCount = 10;
inline constexpr int kBrutalModeCount = 6;
inline constexpr int kWeatherCount = 6;
inline constexpr int kSingularityCount = 5;
inline constexpr int kSortingAlgoCount = 25;
inline constexpr int kObsChartCount = 16; // 4 tabs (OVER, VAR, ECO, WAR) x 4 charts
inline constexpr int kHistoryLen = 180;
inline constexpr int kGrayScottSize = 128; // 128x128 RGBA32F real-time Zig SIMD PDE floor
inline constexpr int kBrainTexSize = 128;

extern const char* const kTierNames[kTierCount];
extern const int kTierEntityCaps[kTierCount];
extern const char* const kViewModeNames[kViewModeCount];
extern const float kSpeedValues[kSpeedCount];
extern const char* const kSpeedLabels[kSpeedCount];
extern const char* const kRenderModeNames[kRenderModeCount];
extern const char* const kBrutalModeNames[kBrutalModeCount];
extern const char* const kWeatherNames[kWeatherCount];
extern const char* const kSingularityNames[kSingularityCount];
extern const char* const kSortingAlgoNames[kSortingAlgoCount];
extern const char* const kPhylumNames[10];
extern const char* const kArchonNames[5];

struct InstanceData {
    // 12 floats (48 bytes) per GPU instance:
    // aPosScale: xyz = world pos, w = scale
    // aDirPhase: xyz = forward/euler/meta, w = anim phase
    // aColorType: rgb = linear color, a = packed shape/phylum id
    glm::vec4 posScale;
    glm::vec4 dirPhase;
    glm::vec4 colorType;
};

struct ReliquaryBody {
    glm::vec3 pos{0.0f};
    glm::quat orient{1.0f, 0.0f, 0.0f, 0.0f};
    glm::vec3 vel{0.0f};
    glm::vec3 angVel{0.0f};
    float radius{0.8f};
    float mass{1.0f};
    int specimenId{0};
    float hue{0.0f};
};

struct ArchonState {
    glm::vec3 pos{0.0f};
    float radius{3.8f};
    float hue{0.0f};
    float salience{0.5f};
    float broadcastProb{0.2f};
    float gyroAngle{0.0f};
};

struct TitanState {
    glm::vec3 pos{0.0f};
    float scale{2.6f};
    int policy{0}; // 0=COOPERATE, 1=DEFECT, 2=TRIBUTE, 3=SIEGE
    float vitality{1.0f};
    float w4d{0.0f};
};

struct SiliconStatus {
    bool triAccelLoaded{false};
    bool cudaReady{false};
    bool igpuDmlReady{false};
    bool npuLevelZeroReady{false};
    bool tsotchkeLoaded{false};
    bool moonlabLoaded{false};
    bool libirrepLoaded{false};
    bool eshkolReady{false};
    bool zigLoaded{false};
    bool rustLedgerLoaded{false};
    bool joltActive{true};

    std::string gpuName{"NVIDIA GeForce RTX 5070 Ti Laptop GPU"};
    std::string npuName{"Intel(R) AI Boost"};
    std::string igpuName{"Intel(R) Graphics"};
    double vramGb{12.0};
    uint32_t npuSlices{0};
    double lastBrainGflops{0.0};
    double lastBrainMs{0.0};
    uint64_t merkleTipHash{0xCBF29CE484222325ULL};
    std::string rsc1Cid{"sha256:pending"};
};

class JoltReliquarySolver;

class NativeCosmosSim {
public:
    NativeCosmosSim();
    ~NativeCosmosSim();

    bool init(const std::wstring& exeDir, const std::wstring& repoRoot, int initialTier = 3);
    void setTier(int tierIdx);
    void resetWorld(uint32_t newSeed = 0);
    void step(float rawDt);

    // Interactive actions (Row 1 + Row 3 buttons)
    void actionSplit();
    void actionBurst();
    void actionMutate();
    void actionChaosPlus();
    void actionGodPulse();
    void actionSpawnXenomimic(int count = 24);
    void actionLifeTreeBloom();
    void actionNhiRelease(int count = 32);
    void actionShatterReliquary();
    void actionStepAllSorts();

    // Access & Stage II puzzles
    bool submitAccessRoman(const std::string& input);
    bool submitStage2Sigil(const std::string& input);
    void regenerateAccessChallenge();

    // Xylos 192 KiB deterministic Record / Replay
    void toggleXylosRecording();
    void toggleXylosReplay();

    // Configuration state
    int tierIdx{3};          // default desktop (12,000 cap, ~1,200 live initial)
    int viewMode{0};         // 0 = free
    int speedIdx{3};         // 3 = 1.0x
    int renderMode{0};       // 0 = prismatic
    int brutalMode{4};       // 4 = megastructure (authentic Original CQM silhouette!)
    int weatherMode{1};      // 1 = nebula
    int singularityMode{2};  // 2 = kerr
    int nMode{1};            // 1 = N(1) Contained, 2 = N(2) Break-Free
    bool paused{false};
    bool miniWorld{false};
    bool sandboxMode{false};
    bool heroMode{false};
    bool entropyDrive{true};
    bool chaosDrive{false};
    bool autoSort{true};
    int activeSortAlgo{11};  // 11 = PANCAKE FLIP (matches user screenshot!)

    bool accessUnlocked{false};
    int accessAttempts{0};
    std::array<int, 10> accessCounts{};
    std::array<std::string, 10> accessGlyphLines{};

    bool stage2Unlocked{false};
    int pantheonSelected{100}; // #101 FINAL SIGMA (0..99 glyphs, 100 = Apex)
    int pantheonSubTab{0};     // 0=ATTRACTOR, 1=WINDING, 2=BLASCHKE, 3=MEGA 4D

    // Simulation clocks & telemetry
    uint64_t tickCount{0};
    double simTime{0.0};
    uint32_t worldSeed{12345u};
    int resetCount{0};

    int liveEntityCount{0};
    int maxEntityCap{12000};
    int xenomimicCount{2};
    int nhiActiveCount{12};
    int synapticLinkCount{231};
    int wildFloraCount{12000};
    int foodOrbCount{640};

    float chaosLevel{0.50f};
    double freeEnergyPool{1437.0};
    double firstLawDrift{0.0};
    double irreversibleHeat{0.0};
    float shannonDiversityH{2.18f};
    float kuramotoOrderR{0.64f};
    double modularityQ{0.41};
    double degreeEntropyBits{3.12};
    double quantumMagicM2{0.415};
    int qwzChernNumber{1};
    double bellChsh{2.8284};
    uint32_t hoggarViolatedLines{63};
    double kerrCarterDrift{0.0};
    double eshkolVfe{0.38};
    float mechaEnergy{0.52f};
    float xylosNlmsErr{0.041f};
    float glyphMeanEnergy{0.47f};
    float asmodeniusCorticalHz{18.4f};
    float asmodeniusEnsTone{0.62f};
    float bitnetProbeOut{0.71f};
    uint32_t apexHashes[4]{0, 0, 0, 0};

    // Sorting Field telemetry
    std::array<uint32_t, kSortingAlgoCount> sortSteps{};
    std::array<uint32_t, kSortingAlgoCount> sortSwaps{};
    std::array<float, kSortingAlgoCount> sortOmega{};
    std::string activeSortEntityName{"HELTIBOR"};

    // Sparklines & 16 Observatory charts
    std::array<float, kHistoryLen> sparkEntities{};
    std::array<float, kHistoryLen> sparkXenomimics{};
    std::array<float, kHistoryLen> sparkChaos{};
    std::array<float, kHistoryLen> sparkEnergy{};
    std::array<float, kHistoryLen> sparkSortOmega{};
    std::array<std::array<float, kHistoryLen>, kObsChartCount> obsCharts{};
    int historyCursor{0};

    // GPU upload buffers
    std::vector<float> grayScottRgba;              // [kGrayScottSize * kGrayScottSize * 4]
    std::vector<uint8_t> brainTexMecha;            // [128 * 128 * 4]
    std::vector<uint8_t> brainTexXylos;            // [128 * 128 * 4]
    std::vector<uint8_t> brainTexGlyph;            // [128 * 128 * 4]
    bool brainTexturesDirty{true};
    bool grayScottDirty{true};

    std::vector<InstanceData> organismInstances;   // Living morphotypes + Xenomimics + NHI + Food
    std::vector<InstanceData> floraInstances;      // Lush AlienFlora + Crystal Big Tree canopy
    std::vector<InstanceData> structureInstances;  // Voxel greeble ziggurats + obsidian spires + black monoliths + dome floaters
    std::vector<glm::vec3> quasicrystalShellPts;   // 6D->3D icosahedral points around GodColossus
    std::vector<glm::vec3> lorenzRibbonPts;        // Viz3D chaotic attractor ribbon
    std::vector<glm::vec3> connectomeLines;        // Synaptic web pairs (p0, p1)

    std::array<ArchonState, 5> archons{};
    std::array<TitanState, 20> titans{};
    std::array<float, 96> xylosFociUv{};
    std::array<float, 48> xylosAct{};
    bool xylosRecording{false};
    bool xylosReplaying{false};
    size_t xylosTapeFrames{0};

    const std::vector<ReliquaryBody>& reliquaryBodies() const;
    SiliconStatus silicon;
    std::wstring repoRootPath;

private:
    void loadNativeBridges(const std::wstring& exeDir, const std::wstring& repoRoot);
    void buildStaticWorldGeometry();
    void updateBrainTextures();
    void stepSortingFields();

    // Entity SoA brain & state arrays
    std::vector<glm::vec3> m_entPos;
    std::vector<glm::vec3> m_entVel;
    std::vector<uint8_t> m_entPhylum;
    std::vector<uint8_t> m_entFlags; // bit0 = xenomimic, bit1 = nhi
    std::vector<float> m_entEnergy;
    std::vector<float> m_entPhase;
    std::vector<float> m_entInputs6;
    std::vector<float> m_entWeights70;
    std::vector<float> m_entPrevHid6;
    std::vector<float> m_entPrevVal;
    std::vector<float> m_entRewards;
    std::vector<float> m_entOutputs4;

    // Sovereign brains state
    std::vector<float> m_mechaParams54k;
    std::array<float, 64> m_mechaPreTrace{};
    std::array<float, 64> m_mechaPostTrace{};
    std::array<float, 64> m_mechaOut64{};

    std::vector<float> m_glyphStates;   // 100 * 1024
    std::vector<float> m_glyphLatW;     // 100 * 4
    std::vector<float> m_glyphDrive;    // 100 * 4

    std::array<uint16_t, 192> m_xylosEdgeSrc{};
    std::array<uint16_t, 192> m_xylosEdgeDst{};
    std::array<float, 192> m_xylosEdgeW{};
    std::array<float, 14> m_xylosNlmsW{};
    std::vector<float> m_xylosTape;     // 192 KiB (1024 frames x 48 floats)
    size_t m_xylosPlayCursor{0};

    std::array<float, 272> m_asmoVmem{};
    std::array<float, 272> m_asmoCa{};
    std::array<uint8_t, 272> m_asmoSpikes{};
    std::array<float, 272> m_asmoDrive{};

    std::array<double, 6> m_firstLawPools{ 1200.0, 180.0, 57.0, 0.0, 0.0, 1437.0 };
    std::vector<float> m_grayScottScratch;
    std::array<std::array<float, 16>, kSortingAlgoCount> m_sortArrays{};

    glm::vec3 m_lorenzHead{ 0.1f, 0.0f, 0.0f };
    std::unique_ptr<JoltReliquarySolver> m_jolt;
    struct BridgeHandles;
    std::unique_ptr<BridgeHandles> m_bridges;
};

} // namespace cqm2_sim
