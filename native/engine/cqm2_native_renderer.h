/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once

#include "gl_core.h"
#include "cqm2_native_sim.h"
#include <glm/glm.hpp>
#include <array>

namespace cqm2_render {

struct OrbitCamera {
    glm::vec3 target{ -1.5f, 4.2f, -9.0f };
    float distance{ 38.0f };
    float yaw{ 0.16f };
    float pitch{ 0.11f };
    float fovDeg{ 56.0f };

    glm::vec3 eyePosition() const;
    glm::mat4 viewMatrix() const;
    glm::mat4 projMatrix(float aspect) const;
};

struct GpuMeshSlot {
    GLuint vao{0};
    GLuint vbo{0};
    GLuint ebo{0};
    GLsizei indexCount{0};
};

class NativeCosmosRenderer {
public:
    NativeCosmosRenderer() = default;
    ~NativeCosmosRenderer();

    bool init();
    void shutdown();
    void ensureSceneFbo(int w, int h);
    void renderWorld(const cqm2_sim::NativeCosmosSim& sim, OrbitCamera& cam, int fbw, int fbh, float audioBass, GLuint targetFbo = 0);

    // 0 = APEX/XYLOS, 1 = MECHA, 2 = GLYPH
    GLuint brainTexId(int idx) const { return m_brainTex[idx % 3]; }

private:
    void buildBaseMeshes();
    void uploadSimTextures(const cqm2_sim::NativeCosmosSim& sim);

    bool m_inited{false};
    GLuint m_progSkyColossus{0};
    GLuint m_progFloor{0};
    GLuint m_progInstanced{0};
    GLuint m_progLine{0};
    GLuint m_progReliquary{0};
    GLuint m_progPost{0};

    GLuint m_emptyVao{0};

    // Floor mesh (128x128 Gray-Scott displaced grid)
    GLuint m_floorVao{0};
    GLuint m_floorVbo{0};
    GLuint m_floorEbo{0};
    GLsizei m_floorIndexCount{0};

    // 64 Procedural 3D Topologies + Shared Streaming Instance Buffer
    std::array<GpuMeshSlot, cqm2_meshes::kTotalMeshTopologies> m_meshes{};
    GLuint m_sharedInstVbo{0};

    // Dynamic lines (4D Titan Tesseracts + Xylos Sphere + Lorenz/Rossler + Quasicrystal Halo)
    GLuint m_lineVao{0};
    GLuint m_lineVbo{0};

    // Textures (Gray-Scott RGBA32F + 3 Live Brains RGBA8)
    GLuint m_grayScottTex{0};
    GLuint m_brainTex[3]{0, 0, 0};

    // Offscreen HDR scene FBO for post-FX
    GLuint m_sceneFbo{0};
    GLuint m_sceneColorTex{0};
    GLuint m_sceneDepthRbo{0};
    int m_fboW{0};
    int m_fboH{0};
};

} // namespace cqm2_render
