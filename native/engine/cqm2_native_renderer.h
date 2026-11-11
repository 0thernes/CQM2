/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once

#include "gl_core.h"
#include "cqm2_native_sim.h"
#include <glm/glm.hpp>

namespace cqm2_render {

struct OrbitCamera {
    glm::vec3 target{ 0.0f, 3.5f, -8.0f };
    float distance{ 42.0f };
    float yaw{ 0.22f };
    float pitch{ 0.14f };
    float fovDeg{ 54.0f };

    glm::vec3 eyePosition() const;
    glm::mat4 viewMatrix() const;
    glm::mat4 projMatrix(float aspect) const;
};

class NativeCosmosRenderer {
public:
    NativeCosmosRenderer() = default;
    ~NativeCosmosRenderer();

    bool init();
    void shutdown();
    void ensureSceneFbo(int w, int h);
    void renderWorld(const cqm2_sim::NativeCosmosSim& sim, OrbitCamera& cam, int fbw, int fbh, float audioBass, GLuint targetFbo = 0);

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

    // Floor mesh
    GLuint m_floorVao{0};
    GLuint m_floorVbo{0};
    GLuint m_floorEbo{0};
    GLsizei m_floorIndexCount{0};

    // Unit cube + icosphere meshes for instanced drawing
    GLuint m_cubeVao{0};
    GLuint m_cubeMeshVbo{0};
    GLuint m_cubeInstVbo{0};
    GLsizei m_cubeVertCount{0};

    GLuint m_sphereVao{0};
    GLuint m_sphereMeshVbo{0};
    GLuint m_sphereInstVbo{0};
    GLsizei m_sphereVertCount{0};

    // Dynamic lines (Lorenz Viz3D + Connectome + Quasicrystal halo + Viz3D containment sphere)
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
