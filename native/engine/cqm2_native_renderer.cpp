/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#include "cqm2_native_renderer.h"
#include "cqm2_native_shaders.h"

#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

namespace cqm2_render {

namespace {
constexpr float kPi = 3.14159265358979323846f;
constexpr float kTau = 6.28318530717958647692f;

struct MeshVertex {
    glm::vec3 pos;
    glm::vec3 norm;
};

struct LineVertex {
    glm::vec3 pos;
    glm::vec4 col;
};

void setupInstancedAttribs(GLuint vao, GLuint meshVbo, GLuint instVbo) {
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER, meshVbo);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(MeshVertex), reinterpret_cast<const void*>(0));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(MeshVertex), reinterpret_cast<const void*>(sizeof(glm::vec3)));

    glBindBuffer(GL_ARRAY_BUFFER, instVbo);
    glEnableVertexAttribArray(2);
    glVertexAttribPointer(2, 4, GL_FLOAT, GL_FALSE, sizeof(cqm2_sim::InstanceData), reinterpret_cast<const void*>(0));
    glVertexAttribDivisor(2, 1);

    glEnableVertexAttribArray(3);
    glVertexAttribPointer(3, 4, GL_FLOAT, GL_FALSE, sizeof(cqm2_sim::InstanceData), reinterpret_cast<const void*>(sizeof(glm::vec4)));
    glVertexAttribDivisor(3, 1);

    glEnableVertexAttribArray(4);
    glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, sizeof(cqm2_sim::InstanceData), reinterpret_cast<const void*>(2 * sizeof(glm::vec4)));
    glVertexAttribDivisor(4, 1);
    glBindVertexArray(0);
}
} // namespace

glm::vec3 OrbitCamera::eyePosition() const {
    float cp = std::cos(pitch);
    return target + glm::vec3(
        std::sin(yaw) * cp * distance,
        std::sin(pitch) * distance,
        std::cos(yaw) * cp * distance
    );
}

glm::mat4 OrbitCamera::viewMatrix() const {
    return glm::lookAt(eyePosition(), target, glm::vec3(0.0f, 1.0f, 0.0f));
}

glm::mat4 OrbitCamera::projMatrix(float aspect) const {
    return glm::perspective(glm::radians(fovDeg), std::max(0.1f, aspect), 0.25f, 420.0f);
}

NativeCosmosRenderer::~NativeCosmosRenderer() {
    shutdown();
}

bool NativeCosmosRenderer::init() {
    if (m_inited) return true;
    char log[2048]{};

    m_progSkyColossus = cqm2_gl::compileProgram(kFullscreenVert, kSkyColossusFrag, log, sizeof(log));
    if (!m_progSkyColossus) { std::fprintf(stderr, "[Renderer] SkyColossus shader error: %s\n", log); return false; }

    m_progFloor = cqm2_gl::compileProgram(kFloorVert, kFloorFrag, log, sizeof(log));
    if (!m_progFloor) { std::fprintf(stderr, "[Renderer] Floor shader error: %s\n", log); return false; }

    m_progInstanced = cqm2_gl::compileProgram(kInstancedVert, kInstancedFrag, log, sizeof(log));
    if (!m_progInstanced) { std::fprintf(stderr, "[Renderer] Instanced shader error: %s\n", log); return false; }

    m_progLine = cqm2_gl::compileProgram(kLineVert, kLineFrag, log, sizeof(log));
    if (!m_progLine) { std::fprintf(stderr, "[Renderer] Line shader error: %s\n", log); return false; }

    m_progReliquary = cqm2_gl::compileProgram(kFullscreenVert, kReliquaryFrag, log, sizeof(log));
    if (!m_progReliquary) { std::fprintf(stderr, "[Renderer] Reliquary shader error: %s\n", log); return false; }

    m_progPost = cqm2_gl::compileProgram(kFullscreenVert, kPostFrag, log, sizeof(log));
    if (!m_progPost) { std::fprintf(stderr, "[Renderer] Post shader error: %s\n", log); return false; }

    glGenVertexArrays(1, &m_emptyVao);
    buildBaseMeshes();

    // Gray-Scott RGBA32F texture
    glGenTextures(1, &m_grayScottTex);
    glBindTexture(GL_TEXTURE_2D, m_grayScottTex);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, cqm2_sim::kGrayScottSize, cqm2_sim::kGrayScottSize, 0, GL_RGBA, GL_FLOAT, nullptr);

    // 3 Live Brain RGBA8 textures
    glGenTextures(3, m_brainTex);
    for (int i = 0; i < 3; ++i) {
        glBindTexture(GL_TEXTURE_2D, m_brainTex[i]);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, cqm2_sim::kBrainTexSize, cqm2_sim::kBrainTexSize, 0, GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
    }

    glEnable(GL_PROGRAM_POINT_SIZE);
    m_inited = true;
    return true;
}

void NativeCosmosRenderer::shutdown() {
    if (!m_inited) return;
    if (m_sceneFbo) glDeleteFramebuffers(1, &m_sceneFbo);
    if (m_sceneColorTex) glDeleteTextures(1, &m_sceneColorTex);
    if (m_sceneDepthRbo) glDeleteRenderbuffers(1, &m_sceneDepthRbo);
    if (m_grayScottTex) glDeleteTextures(1, &m_grayScottTex);
    glDeleteTextures(3, m_brainTex);
    if (m_emptyVao) glDeleteVertexArrays(1, &m_emptyVao);
    if (m_floorVao) glDeleteVertexArrays(1, &m_floorVao);
    if (m_cubeVao) glDeleteVertexArrays(1, &m_cubeVao);
    if (m_sphereVao) glDeleteVertexArrays(1, &m_sphereVao);
    if (m_lineVao) glDeleteVertexArrays(1, &m_lineVao);
    glDeleteProgram(m_progSkyColossus);
    glDeleteProgram(m_progFloor);
    glDeleteProgram(m_progInstanced);
    glDeleteProgram(m_progLine);
    glDeleteProgram(m_progReliquary);
    glDeleteProgram(m_progPost);
    m_inited = false;
}

void NativeCosmosRenderer::buildBaseMeshes() {
    // 1. Floor grid (96 x 96 subdivisions across [-84, 84])
    constexpr int G = 96;
    struct FloorVert { glm::vec3 pos; glm::vec2 uv; };
    std::vector<FloorVert> fVerts;
    std::vector<uint32_t> fIdx;
    fVerts.reserve((G + 1) * (G + 1));
    for (int z = 0; z <= G; ++z) {
        float vz = static_cast<float>(z) / static_cast<float>(G);
        for (int x = 0; x <= G; ++x) {
            float vx = static_cast<float>(x) / static_cast<float>(G);
            fVerts.push_back({ glm::vec3((vx * 2.0f - 1.0f) * 84.0f, 0.0f, (vz * 2.0f - 1.0f) * 84.0f), glm::vec2(vx * 3.0f, vz * 3.0f) });
        }
    }
    for (int z = 0; z < G; ++z) {
        for (int x = 0; x < G; ++x) {
            uint32_t i0 = z * (G + 1) + x;
            uint32_t i1 = i0 + 1;
            uint32_t i2 = i0 + (G + 1);
            uint32_t i3 = i2 + 1;
            fIdx.insert(fIdx.end(), { i0, i2, i1, i1, i2, i3 });
        }
    }
    m_floorIndexCount = static_cast<GLsizei>(fIdx.size());
    glGenVertexArrays(1, &m_floorVao);
    glGenBuffers(1, &m_floorVbo);
    glGenBuffers(1, &m_floorEbo);
    glBindVertexArray(m_floorVao);
    glBindBuffer(GL_ARRAY_BUFFER, m_floorVbo);
    glBufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(fVerts.size() * sizeof(FloorVert)), fVerts.data(), GL_STATIC_DRAW);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, m_floorEbo);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, static_cast<GLsizeiptr>(fIdx.size() * sizeof(uint32_t)), fIdx.data(), GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(FloorVert), reinterpret_cast<const void*>(0));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(FloorVert), reinterpret_cast<const void*>(sizeof(glm::vec3)));
    glBindVertexArray(0);

    // 2. Unit Cube [-0.5, 0.5]^3 (36 vertices) for Voxel Greebles, Spires, Monoliths & Flora
    const glm::vec3 nrms[6] = {
        {0,0,1}, {0,0,-1}, {1,0,0}, {-1,0,0}, {0,1,0}, {0,-1,0}
    };
    const glm::vec3 tangs[6] = {
        {1,0,0}, {-1,0,0}, {0,0,-1}, {0,0,1}, {1,0,0}, {1,0,0}
    };
    std::vector<MeshVertex> cubeV;
    for (int f = 0; f < 6; ++f) {
        glm::vec3 n = nrms[f];
        glm::vec3 t = tangs[f];
        glm::vec3 b = glm::cross(n, t);
        glm::vec3 p0 = n * 0.5f - t * 0.5f - b * 0.5f;
        glm::vec3 p1 = n * 0.5f + t * 0.5f - b * 0.5f;
        glm::vec3 p2 = n * 0.5f + t * 0.5f + b * 0.5f;
        glm::vec3 p3 = n * 0.5f - t * 0.5f + b * 0.5f;
        cubeV.push_back({p0, n}); cubeV.push_back({p1, n}); cubeV.push_back({p2, n});
        cubeV.push_back({p0, n}); cubeV.push_back({p2, n}); cubeV.push_back({p3, n});
    }
    m_cubeVertCount = static_cast<GLsizei>(cubeV.size());
    glGenVertexArrays(1, &m_cubeVao);
    glGenBuffers(1, &m_cubeMeshVbo);
    glGenBuffers(1, &m_cubeInstVbo);
    glBindBuffer(GL_ARRAY_BUFFER, m_cubeMeshVbo);
    glBufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(cubeV.size() * sizeof(MeshVertex)), cubeV.data(), GL_STATIC_DRAW);
    glBindBuffer(GL_ARRAY_BUFFER, m_cubeInstVbo);
    glBufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(65000 * sizeof(cqm2_sim::InstanceData)), nullptr, GL_STREAM_DRAW);
    setupInstancedAttribs(m_cubeVao, m_cubeMeshVbo, m_cubeInstVbo);

    // 3. UV Sphere (14 stacks x 18 slices) for Living Organisms, Xenomimics, Archon Eyed Spheres & Canopy Fruits
    std::vector<MeshVertex> sphV;
    constexpr int ST = 12, SL = 16;
    for (int i = 0; i < ST; ++i) {
        float v0 = static_cast<float>(i) / ST * kPi;
        float v1 = static_cast<float>(i + 1) / ST * kPi;
        for (int j = 0; j < SL; ++j) {
            float u0 = static_cast<float>(j) / SL * kTau;
            float u1 = static_cast<float>(j + 1) / SL * kTau;
            auto pt = [](float th, float ph) {
                return glm::vec3(std::sin(th) * std::cos(ph), std::cos(th), std::sin(th) * std::sin(ph));
            };
            glm::vec3 q00 = pt(v0, u0), q10 = pt(v0, u1), q01 = pt(v1, u0), q11 = pt(v1, u1);
            sphV.push_back({q00 * 0.65f, q00}); sphV.push_back({q01 * 0.65f, q01}); sphV.push_back({q10 * 0.65f, q10});
            sphV.push_back({q10 * 0.65f, q10}); sphV.push_back({q01 * 0.65f, q01}); sphV.push_back({q11 * 0.65f, q11});
        }
    }
    m_sphereVertCount = static_cast<GLsizei>(sphV.size());
    glGenVertexArrays(1, &m_sphereVao);
    glGenBuffers(1, &m_sphereMeshVbo);
    glGenBuffers(1, &m_sphereInstVbo);
    glBindBuffer(GL_ARRAY_BUFFER, m_sphereMeshVbo);
    glBufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(sphV.size() * sizeof(MeshVertex)), sphV.data(), GL_STATIC_DRAW);
    glBindBuffer(GL_ARRAY_BUFFER, m_sphereInstVbo);
    glBufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(55000 * sizeof(cqm2_sim::InstanceData)), nullptr, GL_STREAM_DRAW);
    setupInstancedAttribs(m_sphereVao, m_sphereMeshVbo, m_sphereInstVbo);

    // 4. Dynamic Line/Ribbon VAO
    glGenVertexArrays(1, &m_lineVao);
    glGenBuffers(1, &m_lineVbo);
    glBindVertexArray(m_lineVao);
    glBindBuffer(GL_ARRAY_BUFFER, m_lineVbo);
    glBufferData(GL_ARRAY_BUFFER, 32768 * sizeof(LineVertex), nullptr, GL_STREAM_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(LineVertex), reinterpret_cast<const void*>(0));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 4, GL_FLOAT, GL_FALSE, sizeof(LineVertex), reinterpret_cast<const void*>(sizeof(glm::vec3)));
    glBindVertexArray(0);
}

void NativeCosmosRenderer::ensureSceneFbo(int w, int h) {
    w = std::max(16, w);
    h = std::max(16, h);
    if (m_sceneFbo && m_fboW == w && m_fboH == h) return;

    if (m_sceneFbo) glDeleteFramebuffers(1, &m_sceneFbo);
    if (m_sceneColorTex) glDeleteTextures(1, &m_sceneColorTex);
    if (m_sceneDepthRbo) glDeleteRenderbuffers(1, &m_sceneDepthRbo);

    m_fboW = w;
    m_fboH = h;

    glGenFramebuffers(1, &m_sceneFbo);
    glBindFramebuffer(GL_FRAMEBUFFER, m_sceneFbo);

    glGenTextures(1, &m_sceneColorTex);
    glBindTexture(GL_TEXTURE_2D, m_sceneColorTex);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, w, h, 0, GL_RGBA, GL_FLOAT, nullptr);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, m_sceneColorTex, 0);

    glGenRenderbuffers(1, &m_sceneDepthRbo);
    glBindRenderbuffer(GL_RENDERBUFFER, m_sceneDepthRbo);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, w, h);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, m_sceneDepthRbo);

    glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

void NativeCosmosRenderer::uploadSimTextures(const cqm2_sim::NativeCosmosSim& sim) {
    if (!sim.grayScottRgba.empty()) {
        glBindTexture(GL_TEXTURE_2D, m_grayScottTex);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, cqm2_sim::kGrayScottSize, cqm2_sim::kGrayScottSize, GL_RGBA, GL_FLOAT, sim.grayScottRgba.data());
    }
    if (!sim.brainTexMecha.empty()) {
        glBindTexture(GL_TEXTURE_2D, m_brainTex[0]);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, cqm2_sim::kBrainTexSize, cqm2_sim::kBrainTexSize, GL_RGBA, GL_UNSIGNED_BYTE, sim.brainTexMecha.data());
        glBindTexture(GL_TEXTURE_2D, m_brainTex[1]);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, cqm2_sim::kBrainTexSize, cqm2_sim::kBrainTexSize, GL_RGBA, GL_UNSIGNED_BYTE, sim.brainTexXylos.data());
        glBindTexture(GL_TEXTURE_2D, m_brainTex[2]);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, cqm2_sim::kBrainTexSize, cqm2_sim::kBrainTexSize, GL_RGBA, GL_UNSIGNED_BYTE, sim.brainTexGlyph.data());
    }
}

void NativeCosmosRenderer::renderWorld(
    const cqm2_sim::NativeCosmosSim& sim,
    OrbitCamera& cam,
    int fbw,
    int fbh,
    float audioBass,
    GLuint targetFbo
) {
    if (!m_inited || fbw <= 0 || fbh <= 0) return;
    ensureSceneFbo(fbw, fbh);
    uploadSimTextures(sim);

    // Apply camera view mode overrides when non-free mode selected
    const float t = static_cast<float>(sim.simTime);
    if (sim.miniWorld) {
        cam.fovDeg = 64.0f;
    }
    switch (sim.viewMode) {
        case 1: // orbit
            cam.yaw = t * 0.14f;
            cam.pitch = 0.22f;
            cam.distance = 52.0f;
            cam.target = glm::vec3(0.0f, 3.0f, -6.0f);
            break;
        case 2: // top
            cam.pitch = 1.38f;
            cam.distance = 88.0f;
            cam.target = glm::vec3(0.0f, 0.0f, 0.0f);
            break;
        case 3: // side
            cam.pitch = 0.05f;
            cam.distance = 58.0f;
            cam.target = glm::vec3(0.0f, 4.0f, -8.0f);
            break;
        case 4: // entity close-up
            if (!sim.organismInstances.empty()) {
                cam.target = glm::vec3(sim.organismInstances[0].posScale);
                cam.distance = 8.5f;
                cam.pitch = 0.25f;
            }
            break;
        case 5: // 4D Titan close-up
            cam.target = sim.titans[0].pos;
            cam.distance = 12.0f;
            cam.pitch = 0.18f;
            break;
        case 6: // GodColossus Mandelbulb close-up
            cam.target = glm::vec3(-2.0f, 13.5f, -34.0f);
            cam.distance = 32.0f;
            cam.pitch = 0.08f;
            break;
        case 7: // Stage II MonolithTemple close-up
            cam.target = glm::vec3(22.0f, 3.8f, -20.0f);
            cam.distance = 21.0f;
            cam.pitch = 0.18f;
            break;
        case 8: // Crystal Big Tree close-up
            cam.target = glm::vec3(-28.0f, 8.5f, -22.0f);
            cam.distance = 24.0f;
            cam.pitch = 0.14f;
            break;
        case 10: // Archon Godform close-up
            cam.target = sim.archons[0].pos;
            cam.distance = 14.0f;
            cam.pitch = 0.14f;
            break;
        default:
            break;
    }

    const float aspect = static_cast<float>(fbw) / static_cast<float>(fbh);
    const glm::mat4 V = cam.viewMatrix();
    const glm::mat4 P = cam.projMatrix(aspect);
    const glm::mat4 VP = P * V;
    const glm::mat4 invVP = glm::inverse(VP);
    const glm::vec3 eye = cam.eyePosition();

    // Render into HDR scene FBO
    glBindFramebuffer(GL_FRAMEBUFFER, m_sceneFbo);
    glViewport(0, 0, fbw, fbh);
    glEnable(GL_DEPTH_TEST);
    glDepthMask(GL_TRUE);
    glDisable(GL_BLEND);
    glClearColor(0.16f, 0.02f, 0.15f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    // Special Reliquary SDF + Jolt 5.5 Fracture mode
    if (sim.renderMode == 9 || sim.viewMode == 11) {
        glDisable(GL_DEPTH_TEST);
        glUseProgram(m_progReliquary);
        glUniform2f(glGetUniformLocation(m_progReliquary, "uResolution"), static_cast<float>(fbw), static_cast<float>(fbh));
        glUniform1f(glGetUniformLocation(m_progReliquary, "uTime"), t);
        glUniform1f(glGetUniformLocation(m_progReliquary, "uBass"), audioBass);

        const auto& bodies = sim.reliquaryBodies();
        int nb = std::min(static_cast<int>(bodies.size()), 48);
        glm::vec4 ps[48]{}, qt[48]{}, mt[48]{};
        for (int i = 0; i < nb; ++i) {
            ps[i] = glm::vec4(bodies[i].pos, bodies[i].radius);
            qt[i] = glm::vec4(bodies[i].orient.x, bodies[i].orient.y, bodies[i].orient.z, bodies[i].orient.w);
            mt[i] = glm::vec4(static_cast<float>(bodies[i].specimenId), bodies[i].hue, 0.0f, 0.0f);
        }
        glUniform1i(glGetUniformLocation(m_progReliquary, "uNumBodies"), nb);
        glUniform4fv(glGetUniformLocation(m_progReliquary, "uBodyPosScale"), nb, glm::value_ptr(ps[0]));
        glUniform4fv(glGetUniformLocation(m_progReliquary, "uBodyQuat"), nb, glm::value_ptr(qt[0]));
        glUniform4fv(glGetUniformLocation(m_progReliquary, "uBodyMeta"), nb, glm::value_ptr(mt[0]));

        glBindVertexArray(m_emptyVao);
        glDrawArrays(GL_TRIANGLES, 0, 3);
    } else {
        // Pass 1: Crimson-Burgundy Geodesic Sky Dome + Iridescent Rainbow Mandelbulb GodColossus (writes exact gl_FragDepth!)
        glUseProgram(m_progSkyColossus);
        glUniformMatrix4fv(glGetUniformLocation(m_progSkyColossus, "uInvViewProj"), 1, GL_FALSE, glm::value_ptr(invVP));
        glUniformMatrix4fv(glGetUniformLocation(m_progSkyColossus, "uViewProj"), 1, GL_FALSE, glm::value_ptr(VP));
        glUniform3f(glGetUniformLocation(m_progSkyColossus, "uCamPos"), eye.x, eye.y, eye.z);
        glUniform1f(glGetUniformLocation(m_progSkyColossus, "uTime"), t);
        glUniform1i(glGetUniformLocation(m_progSkyColossus, "uWeather"), sim.weatherMode);
        glUniform1f(glGetUniformLocation(m_progSkyColossus, "uChaos"), sim.chaosLevel);
        glBindVertexArray(m_emptyVao);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        // Pass 2: Live 128x128 Gray-Scott Reaction-Diffusion Undulating Floor
        glUseProgram(m_progFloor);
        glUniformMatrix4fv(glGetUniformLocation(m_progFloor, "uViewProj"), 1, GL_FALSE, glm::value_ptr(VP));
        glUniform1f(glGetUniformLocation(m_progFloor, "uTime"), t);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, m_grayScottTex);
        glUniform1i(glGetUniformLocation(m_progFloor, "uGrayScottTex"), 0);
        glBindVertexArray(m_floorVao);
        glDrawElements(GL_TRIANGLES, m_floorIndexCount, GL_UNSIGNED_INT, nullptr);

        // Pass 3: Hardware-Instanced Structures, AlienFlora, Crystal Big Tree, Organisms, Xenomimics & Archons
        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
        glUseProgram(m_progInstanced);
        glUniformMatrix4fv(glGetUniformLocation(m_progInstanced, "uViewProj"), 1, GL_FALSE, glm::value_ptr(VP));
        glUniform3f(glGetUniformLocation(m_progInstanced, "uCamPos"), eye.x, eye.y, eye.z);
        glUniform1f(glGetUniformLocation(m_progInstanced, "uTime"), t);

        // Combine cube-based instances (Flora stalks tid 10..12 + Architectural Structures: Spires, Voxels, Monoliths)
        std::vector<cqm2_sim::InstanceData> cubeBatch;
        cubeBatch.reserve(sim.structureInstances.size() + sim.floraInstances.size());
        cubeBatch.insert(cubeBatch.end(), sim.structureInstances.begin(), sim.structureInstances.end());

        // Sphere-based instances (Living Phyla + Chiral Xenomimics + 4D Titans + Crystal Big Tree Canopy + 5 Eyed Archons)
        std::vector<cqm2_sim::InstanceData> sphereBatch = sim.organismInstances;
        sphereBatch.reserve(sim.organismInstances.size() + 1024);
        for (const auto& fl : sim.floraInstances) {
            if (fl.colorType.w >= 13.5f || fl.colorType.w >= 12.5f) {
                sphereBatch.push_back(fl);
            } else {
                cubeBatch.push_back(fl);
            }
        }
        if (!cubeBatch.empty()) {
            size_t count = std::min<size_t>(cubeBatch.size(), 65000);
            glBindBuffer(GL_ARRAY_BUFFER, m_cubeInstVbo);
            glBufferSubData(GL_ARRAY_BUFFER, 0, static_cast<GLsizeiptr>(count * sizeof(cqm2_sim::InstanceData)), cubeBatch.data());
            glBindVertexArray(m_cubeVao);
            glDrawArraysInstanced(GL_TRIANGLES, 0, m_cubeVertCount, static_cast<GLsizei>(count));
        }

        for (int a = 0; a < 5; ++a) {
            const auto& ar = sim.archons[a];
            sphereBatch.push_back({
                glm::vec4(ar.pos, ar.radius),
                glm::vec4(ar.gyroAngle, 1.0f, 1.0f, t),
                glm::vec4(0.35f + 0.4f * ar.broadcastProb, 0.55f, 0.95f, 40.0f)
            });
        }
        if (!sphereBatch.empty()) {
            size_t count = std::min<size_t>(sphereBatch.size(), 55000);
            glBindBuffer(GL_ARRAY_BUFFER, m_sphereInstVbo);
            glBufferSubData(GL_ARRAY_BUFFER, 0, static_cast<GLsizeiptr>(count * sizeof(cqm2_sim::InstanceData)), sphereBatch.data());
            glBindVertexArray(m_sphereVao);
            glDrawArraysInstanced(GL_TRIANGLES, 0, m_sphereVertCount, static_cast<GLsizei>(count));
        }

        // Pass 4: Viz3D Glowing Containment Orb + Cyan/Gold Lorenz Attractor Ribbons + Archon Gyroscope Rings + Synaptic Web
        glUseProgram(m_progLine);
        glUniformMatrix4fv(glGetUniformLocation(m_progLine, "uViewProj"), 1, GL_FALSE, glm::value_ptr(VP));
        glBindVertexArray(m_lineVao);
        glBindBuffer(GL_ARRAY_BUFFER, m_lineVbo);

        std::vector<LineVertex> lines;
        lines.reserve(8192);

        // Enforce Original CQM Tether-Removal Law (connectome topology is evaluated for CSR Louvain Q/Entropy, never drawn as dome laser lines)

        // Viz3D Glowing Woven Containment Sphere + Lorenz chaotic ribbons at (4.8, -0.4, 3.5) (matches user screenshot!)
        const glm::vec3 vizCenter(4.8f, -0.4f, 3.5f);
        const float vizR = 4.2f;
        for (int ring = 0; ring < 11; ++ring) {
            float lat = (static_cast<float>(ring) / 10.0f - 0.5f) * 2.5f;
            float rr = std::cos(lat) * vizR;
            float yy = std::sin(lat) * vizR;
            for (int s = 0; s < 48; ++s) {
                float a0 = static_cast<float>(s) / 48.0f * kTau + t * 0.25f;
                float a1 = static_cast<float>(s + 1) / 48.0f * kTau + t * 0.25f;
                lines.push_back({ vizCenter + glm::vec3(std::cos(a0) * rr, yy, std::sin(a0) * rr), glm::vec4(0.22f, 0.36f, 0.62f, 0.34f) });
                lines.push_back({ vizCenter + glm::vec3(std::cos(a1) * rr, yy, std::sin(a1) * rr), glm::vec4(0.38f, 0.22f, 0.62f, 0.34f) });
            }
        }
        // Longitude meridian arcs on Viz3D orb
        for (int mer = 0; mer < 8; ++mer) {
            float phi = static_cast<float>(mer) / 8.0f * kPi + t * 0.18f;
            for (int s = 0; s < 36; ++s) {
                float b0 = static_cast<float>(s) / 36.0f * kTau;
                float b1 = static_cast<float>(s + 1) / 36.0f * kTau;
                glm::vec3 p0(std::sin(b0) * std::cos(phi), std::cos(b0), std::sin(b0) * std::sin(phi));
                glm::vec3 p1(std::sin(b1) * std::cos(phi), std::cos(b1), std::sin(b1) * std::sin(phi));
                lines.push_back({ vizCenter + p0 * vizR, glm::vec4(0.26f, 0.32f, 0.58f, 0.22f) });
                lines.push_back({ vizCenter + p1 * vizR, glm::vec4(0.36f, 0.20f, 0.54f, 0.22f) });
            }
        }
        for (size_t i = 0; i + 1 < sim.lorenzRibbonPts.size(); ++i) {
            float u = static_cast<float>(i) / static_cast<float>(sim.lorenzRibbonPts.size());
            glm::vec4 ccol = (i % 2 == 0) ? glm::vec4(0.06f, 0.62f, 0.65f, 0.85f * u)
                                          : glm::vec4(0.68f, 0.44f, 0.06f, 0.85f * u);
            lines.push_back({ sim.lorenzRibbonPts[i], ccol });
            lines.push_back({ sim.lorenzRibbonPts[i + 1], ccol });
        }

        // Archon orbital gyroscope rings
        for (int a = 0; a < 5; ++a) {
            const auto& ar = sim.archons[a];
            float gr = ar.radius * 1.38f;
            for (int s = 0; s < 32; ++s) {
                float a0 = static_cast<float>(s) / 32.0f * kTau + ar.gyroAngle;
                float a1 = static_cast<float>(s + 1) / 32.0f * kTau + ar.gyroAngle;
                lines.push_back({ ar.pos + glm::vec3(std::cos(a0) * gr, std::sin(a0) * gr * 0.35f, std::sin(a0) * gr), glm::vec4(1.0f, 0.84f, 0.32f, 0.65f) });
                lines.push_back({ ar.pos + glm::vec3(std::cos(a1) * gr, std::sin(a1) * gr * 0.35f, std::sin(a1) * gr), glm::vec4(0.32f, 0.95f, 0.92f, 0.65f) });
            }
        }

        if (!lines.empty()) {
            size_t cnt = std::min<size_t>(lines.size(), 32768);
            glBufferSubData(GL_ARRAY_BUFFER, 0, static_cast<GLsizeiptr>(cnt * sizeof(LineVertex)), lines.data());
            glDrawArrays(GL_LINES, 0, static_cast<GLsizei>(cnt));
        }

        // 6D->3D Quasicrystal shimmering star halo around GodColossus
        if (!sim.quasicrystalShellPts.empty()) {
            std::vector<LineVertex> qpts;
            size_t nq = std::min<size_t>(sim.quasicrystalShellPts.size(), 1024);
            qpts.reserve(nq);
            for (size_t i = 0; i < nq; ++i) {
                glm::vec3 p = glm::vec3(-2.0f, 13.5f, -34.0f) + sim.quasicrystalShellPts[i] * 6.8f;
                qpts.push_back({ p, glm::vec4(0.28f, 0.20f, 0.38f, 0.42f) });
            }
            glBufferSubData(GL_ARRAY_BUFFER, 0, static_cast<GLsizeiptr>(qpts.size() * sizeof(LineVertex)), qpts.data());
            glDrawArrays(GL_POINTS, 0, static_cast<GLsizei>(qpts.size()));
        }
    }

    // Pass 5: Composite Scene FBO -> Target FBO via ACES Filmic + Singularity Lensing + 10 Render Modes
    glBindFramebuffer(GL_FRAMEBUFFER, targetFbo);
    glViewport(0, 0, fbw, fbh);
    glDisable(GL_DEPTH_TEST);
    glDisable(GL_BLEND);

    glUseProgram(m_progPost);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, m_sceneColorTex);
    glUniform1i(glGetUniformLocation(m_progPost, "uSceneTex"), 0);
    glUniform2f(glGetUniformLocation(m_progPost, "uResolution"), static_cast<float>(fbw), static_cast<float>(fbh));
    glUniform1f(glGetUniformLocation(m_progPost, "uTime"), t);
    glUniform1i(glGetUniformLocation(m_progPost, "uRenderMode"), sim.renderMode == 9 ? 0 : sim.renderMode);
    glUniform1i(glGetUniformLocation(m_progPost, "uSingularity"), sim.singularityMode);

    glBindVertexArray(m_emptyVao);
    glDrawArrays(GL_TRIANGLES, 0, 3);
    glBindVertexArray(0);
}

} // namespace cqm2_render
