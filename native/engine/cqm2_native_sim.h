/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once

#include "cqm2_native_meshes.hpp"
#include <glm/glm.hpp>
#include <glm/gtc/quaternion.hpp>
#include <array>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace cqm2_sim {

inline constexpr int kPhylumCount = 10;
inline constexpr int kSortingAlgoCount = 25;
inline constexpr int kViewModeCount = 12;
inline constexpr int kRenderModeCount = 11;
inline constexpr int kBrutalModeCount = 6;
inline constexpr int kWeatherCount = 6;
inline constexpr int kSingularityCount = 5;
inline constexpr int kTierCount = 6;
inline constexpr int kSpeedCount = 6;
inline constexpr int kHistoryLen = 120;
inline constexpr int kGrayScottSize = 256;
inline constexpr int kBrainTexSize = 128;

extern const char* const kPhylumNames[kPhylumCount];
extern const char* const kSortingAlgoNames[kSortingAlgoCount];
extern const char* const kViewModeNames[kViewModeCount];
extern const char* const kRenderModeNames[kRenderModeCount];
extern const char* const kBrutalModeNames[kBrutalModeCount];
extern const char* const kWeatherNames[kWeatherCount];
extern const char* const kSingularityNames[kSingularityCount];
extern const char* const kTierNames[kTierCount];
extern const int kTierEntityCaps[kTierCount];
extern const char* const kSpeedLabels[kSpeedCount];
extern const float kSpeedValues[kSpeedCount];
extern const char* const kArchonNames[5];
extern const char* const kTitanNames[20];
extern const char* const kPuppetMasterNames[3];

struct alignas(16) MeshInstance {
    glm::vec4 posScale;     // xyz = world pos, w = uniform scale
    glm::vec4 rotMat;       // x = yaw, y = pitch, z = roll, w = matClass
    glm::vec4 stretchPhase; // xyz = local scale (sx, sy, sz), w = animPhase / irisSeed
    glm::vec4 colorTag;     // rgb = linear/sRGB tint, a = glow / alpha tag
};

struct ColorLineVertex {
    glm::vec3 pos;
    glm::vec4 color;
};

struct ReliquaryBody {
    glm::vec3 pos{0.0f};
    glm::vec3 vel{0.0f};
    glm::vec3 angVel{0.0f};
    glm::quat orient{1.0f, 0.0f, 0.0f, 0.0f};
    float radius{0.75f};
    float mass{1.0f};
    int specimenId{0};
    float hue{0.5f};
};

struct ArchonState {
    glm::vec3 pos{0.0f};
    float radius{2.3f};
    float hue{0.0f};
    float salience{0.5f};
    float broadcastProb{0.2f};
    float gyroAngle{0.0f};
    uint32_t memSlot{0};
    std::array<float, 16> stats16{}; // VAL, ARO, DOM, SUR, AGG, DEC, CUR, DRE, HAL, REA, SAW, NOV, IGN, INTG, PHI, CONF
    std::array<float, 24> motor24{};
};

struct TitanState {
    glm::vec3 pos{0.0f};
    float scale{2.4f};
    float w4d{0.0f};
    int policy{0};
    float vitality{1.0f};
    float matter{100.0f};
    float energy{100.0f};
    int tribePop{24};
};

struct OhlcCandle {
    float open{1.0f};
    float high{1.02f};
    float low{0.98f};
    float close{1.0f};
};

struct SiliconStatus {
    bool triAccelLoaded{false};
    bool cudaReady{false};
    bool nvrtcSm120Ready{false};
    bool npuLevelZeroReady{false};
    bool igpuDmlReady{false};
    bool zigLoaded{false};
    bool zigNativeLoaded{false};
    bool tsotchkeLoaded{false};
    bool rustLedgerLoaded{false};
    bool rustGovernorLoaded{false};
    bool moonlabLoaded{false};
    bool libirrepLoaded{false};
    bool eshkolReady{false};
    std::string gpuName{"AVX2-FMA Vector Fallback"};
    std::string npuName{"CPU NPU Emulation"};
    std::string igpuName{"Shared System Adapter"};
    double vramGb{0.0};
    uint32_t npuSlices{0};
    double lastBrainGflops{0.0};
    double lastBrainMs{0.0};
    uint64_t merkleTipHash{0};
    std::string rsc1Cid{"sha256:pending"};
    bool rsw1StreamOk{false};
    bool csrPortsValid{false};
};

class JoltReliquarySolver;

class NativeCosmosSim {
public:
    NativeCosmosSim();
    ~NativeCosmosSim();

    bool init(const std::wstring& exeDir, const std::wstring& repoRoot, int initialTier = 0);
    void setTier(int idx);
    void shutdown();

    void resetWorld(uint32_t newSeed = 0);
    void step(float dtSeconds);

    // Terrain height helper (shared between renderer ground mesh and surface-locked creatures/flora/xenomimics!)
    float terrainHeightAt(float x, float z) const;

    // Interactive HUD & keyboard actions
    void actionSplit();
    void actionBurst();
    void actionMutate();
    void actionChaosPlus();
    void actionGodPulse();
    void actionSpawnXenomimic(int count = 24);
    void actionLifeTreeBloom();
    void actionNhiRelease(int count = 32);
    void actionApocalypse();
    void actionShatterReliquary();
    void actionStepAllSorts();
    void cyclePauseState();

    // Cryptographic / Puzzle Gates (`ACCESS` & `STAGE II`) + Eshkol Evaluator
    bool submitAccessRoman(const std::string& input);
    void regenerateAccessChallenge();
    bool submitStage2Sigil(const std::string& input);
    std::string evaluateCopilotQuery(const std::string& rawQuery);

    // Xylos 192 KiB deterministic tape recorder
    void toggleXylosRecording();
    void toggleXylosReplay();

    const std::vector<ReliquaryBody>& reliquaryBodies() const;
    void rebuildStaticWorld() { buildStaticWorldGeometry(); }

    // --- Public Simulation & Telemetry State ---
    SiliconStatus silicon;
    std::wstring repoRootPath;

    bool paused{false};
    int pauseState{0};        // 0 = RUNNING, 1 = SUSPENDED, 2 = FROZEN
    int speedIdx{0};          // Default 0 = 0.25x (matches user screenshot `SPEED 0.25x`!)
    int tierIdx{0};           // Default 0 = phone cap 1000 (matches user screenshot `495/1000`!)
    int viewMode{0};          // 0..11 (`free` default)
    int renderMode{9};        // Default 9 = `prismatic` (matches user screenshot `RENDER prismatic`!)
    int brutalMode{0};        // 0..5 (`GOD-JEWEL ✦` default)
    int weatherMode{0};       // 0..5
    int singularityMode{0};   // 0..4 (`entropy` default)
    int nMode{1};             // 1 = N(1) Contained Genesis, 2 = N(2) Break-Free
    bool miniWorldMode{false};
    bool heroMode{false};
    bool heroHudVisible{false};
    bool entropyDrive{true};
    bool chaosDrive{true};
    bool autoSort{true};
    int activeSortAlgo{11};   // Default 11 = `PANCAKE FLIP` (matches user screenshot!)
    uint32_t worldResets{0};

    // Sandbox 0..300% multipliers (unlocked via ACCESS -> SANDBOX)
    float sandboxGravityMul{1.0f};
    float sandboxMutationMul{1.0f};
    float sandboxEnergyMul{1.0f};
    float sandboxChaosMul{1.0f};
    bool sandboxCustomActive() const {
        return std::abs(sandboxGravityMul - 1.0f) > 0.01f ||
               std::abs(sandboxMutationMul - 1.0f) > 0.01f ||
               std::abs(sandboxEnergyMul - 1.0f) > 0.01f ||
               std::abs(sandboxChaosMul - 1.0f) > 0.01f;
    }

    uint64_t tickCount{0};
    double simTime{0.0};
    uint32_t worldSeed{0xC0540902u};

    int liveEntityCount{495};
    int maxEntityCap{1000};
    int xenomimicCount{2};
    int nhiActiveCount{12};
    int shoggothCount{6};
    int leviathanCount{4};
    int wildFloraCount{6272};
    int synapticLinkCount{231};
    int foodOrbCount{240};
    int activeMorphCount{215};
    uint64_t totalMutations{142};
    int activeTribeCount{20};

    float chaosLevel{0.50f};
    float trendIndex{0.201f};
    float windSpeed{4.2f};
    float domeTempKelvin{294.5f};
    double freeEnergyPool{1437.0};
    double irreversibleHeat{0.0};
    double firstLawDrift{0.0};
    double alifeV3Drift{0.0};
    std::array<double, 13> alifeLedger13{};

    // Economy (`Money ☉`, `Credit ☾`, `FX`, `Matter ◇`, `Energy ❖`, `Wealth Gini`)
    double moneySupplySun{12480.0};
    double creditSupplyMoon{8920.0};
    float fxRateSunMoon{1.399f};
    float priceMatter{2.45f};
    float priceEnergy{1.82f};
    float wealthGini{0.318f};
    std::array<OhlcCandle, 48> fxCandles{};
    int fxCandleCursor{0};
    std::array<float, 21> lorenzWealthCurve{};

    // Quantum, Topological, Neural & Consciousness Indicators (`indicatorOnly = true`, `score = null`)
    float shannonDiversityH{2.18f};
    float kuramotoOrderR{0.42f};
    double modularityQ{0.38};
    double degreeEntropyBits{2.45};
    double quantumMagicM2{0.41};
    double bellChsh{2.8284};
    int qwzChernNumber{1};
    uint32_t hoggarViolatedLines{63};
    double eshkolVfe{0.184};
    float eshkolMetacogConf{0.91f};
    double kerrCarterDrift{1.2e-14};
    float pciLzStar{0.54f};
    float csrSpectralSigma{0.94f};
    float asmodeniusCorticalHz{18.4f};
    float asmodeniusEnsTone{0.62f};
    float asmodenius100mAct{0.31f};
    float mechaEnergy{0.48f};
    float glyphMeanEnergy{0.36f};
    float xylosNlmsErr{0.08f};
    float bitnetProbeOut{0.0f};
    uint32_t apexHashes[4]{0, 0, 0, 0};

    // Biome Sentience Gauge Components (strictly `indicatorOnly = true`, never collapsed into a sentient verdict)
    float biomeIntegration{0.61f};
    float biomeCoherence{0.54f};
    float biomeMomentum{0.47f};
    std::array<float, 14> butlinIndicators14{}; // C1..C14 non-aggregable indicator profile

    // Sorting Fields telemetry (25 fields)
    std::array<uint32_t, kSortingAlgoCount> sortSteps{};
    std::array<uint32_t, kSortingAlgoCount> sortSwaps{};
    std::array<float, kSortingAlgoCount> sortOmega{};
    std::array<std::array<float, 64>, 4> sortBars64{}; // 64 bars for 3D Viz3D + HUD

    // Sparkline & 16-Chart Data-Science Ring Buffers
    int historyCursor{0};
    std::array<float, kHistoryLen> sparkEntities{};
    std::array<float, kHistoryLen> sparkXenomimics{};
    std::array<float, kHistoryLen> sparkChaos{};
    std::array<float, kHistoryLen> sparkEnergy{};
    std::array<float, kHistoryLen> sparkConnectome{};
    std::array<float, kHistoryLen> sparkSortOmega{};

    // Rich Observatory multi-series buffers
    std::array<std::array<float, kHistoryLen>, kPhylumCount> phylumPopHist{};
    std::array<std::array<float, kHistoryLen>, 20> titanScoreHist{};
    std::array<std::array<float, 20>, 20> diplomacyMatrix{}; // [-1=War, 0=Truce, +1=Ally]
    std::array<float, kHistoryLen> envRdHist{};
    std::array<float, kHistoryLen> envQhHist{};
    std::array<float, kHistoryLen> envTrendHist{};
    std::array<float, kHistoryLen> popMeanHist{};
    std::array<float, kHistoryLen> popStdHist{};
    std::array<float, 16> energyHistogram16{};
    std::array<float, kHistoryLen> birthFluxHist{};
    std::array<float, kHistoryLen> deathFluxHist{};
    std::array<std::array<float, kHistoryLen>, 4> xenoEcoHist{};
    std::array<float, kHistoryLen> warIntensityHist{};
    std::array<float, kHistoryLen> truceFracHist{};
    std::array<float, kHistoryLen> warFracHist{};
    std::array<float, kHistoryLen> allyFracHist{};
    std::array<std::array<float, kHistoryLen>, 16> obsCharts{};

    // Gates & Sovereign Overrides
    bool accessUnlocked{false};
    std::array<int, 10> accessCounts{};
    std::string accessExpectedDigits{"3455456754"};
    std::array<std::string, 10> accessGlyphLines{};
    int accessAttempts{0};
    bool stage2Unlocked{false};
    int pantheonSelected{100}; // 0..99 = GlyphBrains, 100 = #101 Final Sigma Apex
    int pantheonSubTab{0};     // 0=Attractor, 1=Winding, 2=Blaschke, 3=Mega4D
    int archonSelected{0};     // 0..4
    int archonNeuralTab{0};    // 0=World I, 1=Cognition II, 2=Quantum III, 3=Brain IV MEGA 4D

    // Xylos 48-foci Poincaré disk + 192 KiB tape
    std::array<float, 96> xylosFociUv{};
    std::array<float, 48> xylosAct{};
    std::array<uint16_t, 192> xylosEdgeSrc{};
    std::array<uint16_t, 192> xylosEdgeDst{};
    bool xylosRecording{false};
    bool xylosReplaying{false};
    size_t xylosTapeFrames{0};

    // 5 Archon SuperMinds + 20 4D Titans + 3 Puppet Masters
    std::array<ArchonState, 5> archons{};
    std::array<TitanState, 20> titans{};
    std::array<glm::vec3, 3> puppetMasterPos{};

    // 64-Topology Multi-Mesh Instance Buffers for OpenGL 4.3 Renderer
    std::array<std::vector<MeshInstance>, cqm2_meshes::kTotalMeshTopologies> staticMeshBuckets{};
    std::array<std::vector<MeshInstance>, cqm2_meshes::kTotalMeshTopologies> dynamicMeshBuckets{};
    uint64_t staticGeometryRevision{0};

    // Line / Wireframe / Ribbon Buffers
    std::vector<ColorLineVertex> worldColorLines; // 4D Tesseracts, Dome Cage, Xylos Axons, Connectome, Lorenz/Rossler!
    std::vector<glm::vec3> quasicrystalShellPts;

    // Live 256x256 Gray-Scott Terrain RGBA float texture + 3 Live Brain RGBA8 textures (128x128)
    std::vector<float> grayScottRgba;
    bool grayScottDirty{true};
    std::vector<uint8_t> brainTexMecha;
    std::vector<uint8_t> brainTexXylos;
    std::vector<uint8_t> brainTexGlyph;
    bool brainTexturesDirty{true};

    // Key landmark coordinates for camera View modes & multi-angle photography
    glm::vec3 godColossusCenter{0.0f, 13.2f, -29.0f};
    glm::vec3 mechalogodromCenter{-17.0f, 25.5f, -15.0f};
    glm::vec3 crystalTreeCenter{-26.0f, -3.2f, -18.0f};
    glm::vec3 xylosCenter{10.5f, -0.8f, 7.0f};
    glm::vec3 monolithTempleCenter{22.0f, 3.8f, -20.0f};

private:
    struct BridgeHandles;
    std::unique_ptr<JoltReliquarySolver> m_jolt;
    std::unique_ptr<BridgeHandles> m_bridges;
    void loadNativeBridges(const std::wstring& exeDir, const std::wstring& repoRoot);

    // Organism SoA arrays (up to 50,000 entities)
    std::vector<glm::vec3> m_entPos;
    std::vector<glm::vec3> m_entVel;
    std::vector<uint8_t> m_entPhylum;
    std::vector<uint8_t> m_entMorph;   // 0..39 topology!
    std::vector<uint8_t> m_entFlags;   // bit0 = Xenomimic, bit1 = NHI, bit2 = FloatingBell/Blob/Voxel
    std::vector<float> m_entEnergy;
    std::vector<float> m_entPhase;
    std::vector<float> m_entInputs6;
    std::vector<float> m_entWeights70;
    std::vector<float> m_entPrevHid6;
    std::vector<float> m_entPrevVal;
    std::vector<float> m_entRewards;
    std::vector<float> m_entOutputs4;
    std::vector<float> m_entResWeights51;

    // Sovereign Brains memory
    std::vector<float> m_superMindParams; // 5 * 10,081 = 50,405 f32!
    std::vector<float> m_mechaParams54k;
    std::array<float, 64> m_mechaPreTrace{};
    std::array<float, 64> m_mechaPostTrace{};
    std::array<float, 64> m_mechaOut64{};
    std::vector<float> m_glyphStates;     // 100 * 1024
    std::vector<float> m_glyphLatW;       // 100 * 4
    std::vector<float> m_glyphDrive;      // 100 * 4
    std::array<float, 192> m_xylosEdgeW{};
    std::array<float, 14> m_xylosNlmsW{};
    std::vector<float> m_xylosTape;       // 1024 * 48 = 196,608 bytes (192 KiB)
    size_t m_xylosPlayCursor{0};

    // Asmodenius 272-LIF + 100M CUDA LoRA adapters
    std::array<float, 272> m_asmoVmem{};
    std::array<float, 272> m_asmoCa{};
    std::array<uint8_t, 272> m_asmoSpikes{};
    std::array<float, 272> m_asmoDrive{};
    std::vector<float> m_asmoLoraA;       // 64 * 16
    std::vector<float> m_asmoLoraB;       // 16 * 64
    std::array<float, 64> m_asmo100mOut{};

    // First-Law FP64 KBN 4-reservoir + Gray-Scott scratch + Vandermonde 5-tap history
    std::array<double, 6> m_firstLawPools{1200.0, 180.0, 57.0, 0.0, 0.0, 1437.0};
    std::array<float, 5> m_vandermondeHist{0.5f, 0.5f, 0.5f, 0.5f, 0.5f};
    std::vector<float> m_grayScottScratch;
    std::array<std::array<float, 16>, kSortingAlgoCount> m_sortArrays{};
    std::vector<glm::vec3> m_lorenzPts;
    glm::vec3 m_lorenzHead{0.1f, 0.0f, 0.0f};
    std::vector<glm::vec3> m_rosslerPts;
    glm::vec3 m_rosslerHead{0.2f, 0.1f, 0.0f};

    void buildStaticWorldGeometry();
    void append4DTesseractLines(const glm::vec3& center, float scale, float wAngle, float yAngle, const glm::vec4& colOuter, const glm::vec4& colInner);
    void stepSortingFields();
    void stepEconomyAndDiplomacy(float dt);
    void updateBrainTextures();
};

} // namespace cqm2_sim
