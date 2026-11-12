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
constexpr size_t kMaxStreamInstances = 65536;
constexpr size_t kMaxStreamLineVerts = 65536;

inline bool isTranslucentInstance(const cqm2_sim::MeshInstance& inst, int renderMode) {
    int mc = static_cast<int>(inst.rotMat.w + 0.5f);
    return (mc == 3 || mc == 6 || mc == 7 || renderMode == 2 || renderMode == 5);
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
    return glm::perspective(glm::radians(fovDeg), std::max(0.1f, aspect), 0.25f, 460.0f);
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

    // 256x256 Gray-Scott RGBA32F texture
    glGenTextures(1, &m_grayScottTex);
    glBindTexture(GL_TEXTURE_2D, m_grayScottTex);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, cqm2_sim::kGrayScottSize, cqm2_sim::kGrayScottSize, 0, GL_RGBA, GL_FLOAT, nullptr);

    // 3 Live Brain RGBA8 textures (0=APEX/XYLOS, 1=MECHA, 2=GLYPH)
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
    if (m_floorVbo) glDeleteBuffers(1, &m_floorVbo);
    if (m_floorEbo) glDeleteBuffers(1, &m_floorEbo);
    for (auto& slot : m_meshes) {
        if (slot.vao) glDeleteVertexArrays(1, &slot.vao);
        if (slot.vbo) glDeleteBuffers(1, &slot.vbo);
        if (slot.ebo) glDeleteBuffers(1, &slot.ebo);
        slot = {};
    }
    if (m_sharedInstVbo) glDeleteBuffers(1, &m_sharedInstVbo);
    if (m_lineVao) glDeleteVertexArrays(1, &m_lineVao);
    if (m_lineVbo) glDeleteBuffers(1, &m_lineVbo);
    glDeleteProgram(m_progSkyColossus);
    glDeleteProgram(m_progFloor);
    glDeleteProgram(m_progInstanced);
    glDeleteProgram(m_progLine);
    glDeleteProgram(m_progReliquary);
    glDeleteProgram(m_progPost);
    m_inited = false;
}

void NativeCosmosRenderer::buildBaseMeshes() {
    // 1. Displaced Gray-Scott Terrain Grid (128 x 128 across [-84, +84])
    constexpr int G = 128;
    struct FloorVert { glm::vec3 pos; glm::vec2 uv; };
    std::vector<FloorVert> fVerts;
    std::vector<uint32_t> fIdx;
    fVerts.reserve((G + 1) * (G + 1));
    for (int z = 0; z <= G; ++z) {
        float vz = static_cast<float>(z) / static_cast<float>(G);
        for (int x = 0; x <= G; ++x) {
            float vx = static_cast<float>(x) / static_cast<float>(G);
            fVerts.push_back({
                glm::vec3((vx * 2.0f - 1.0f) * 84.0f, 0.0f, (vz * 2.0f - 1.0f) * 84.0f),
                glm::vec2(vx * 3.5f, vz * 3.5f)
            });
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

    // 2. Shared Streaming Instance VBO + All 64 Procedural Indexed 3D Topologies
    glGenBuffers(1, &m_sharedInstVbo);
    glBindBuffer(GL_ARRAY_BUFFER, m_sharedInstVbo);
    glBufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(kMaxStreamInstances * sizeof(cqm2_sim::MeshInstance)), nullptr, GL_STREAM_DRAW);

    for (int id = 0; id < cqm2_meshes::kTotalMeshTopologies; ++id) {
        cqm2_meshes::CpuMeshData cpu = cqm2_meshes::generateMeshTopology(id);
        GpuMeshSlot& slot = m_meshes[id];
        slot.indexCount = static_cast<GLsizei>(cpu.indices.size());

        glGenVertexArrays(1, &slot.vao);
        glGenBuffers(1, &slot.vbo);
        glGenBuffers(1, &slot.ebo);

        glBindVertexArray(slot.vao);
        glBindBuffer(GL_ARRAY_BUFFER, slot.vbo);
        glBufferData(GL_ARRAY_BUFFER,
                     static_cast<GLsizeiptr>(cpu.vertices.size() * sizeof(cqm2_meshes::MeshVertex)),
                     cpu.vertices.data(), GL_STATIC_DRAW);
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, slot.ebo);
        glBufferData(GL_ELEMENT_ARRAY_BUFFER,
                     static_cast<GLsizeiptr>(cpu.indices.size() * sizeof(uint32_t)),
                     cpu.indices.data(), GL_STATIC_DRAW);

        // Per-vertex attributes (locations 0, 1, 2)
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(cqm2_meshes::MeshVertex), reinterpret_cast<const void*>(0));
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(cqm2_meshes::MeshVertex), reinterpret_cast<const void*>(sizeof(glm::vec3)));
        glEnableVertexAttribArray(2);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(cqm2_meshes::MeshVertex), reinterpret_cast<const void*>(2 * sizeof(glm::vec3)));

        // Per-instance attributes from shared streaming VBO (locations 3, 4, 5, 6)
        glBindBuffer(GL_ARRAY_BUFFER, m_sharedInstVbo);
        for (GLuint a = 0; a < 4; ++a) {
            GLuint loc = 3 + a;
            glEnableVertexAttribArray(loc);
            glVertexAttribPointer(loc, 4, GL_FLOAT, GL_FALSE, sizeof(cqm2_sim::MeshInstance),
                                  reinterpret_cast<const void*>(a * sizeof(glm::vec4)));
            glVertexAttribDivisor(loc, 1);
        }
        glBindVertexArray(0);
    }

    // 3. Dynamic Color Line / 4D Tesseract / Xylos VAO
    glGenVertexArrays(1, &m_lineVao);
    glGenBuffers(1, &m_lineVbo);
    glBindVertexArray(m_lineVao);
    glBindBuffer(GL_ARRAY_BUFFER, m_lineVbo);
    glBufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(kMaxStreamLineVerts * sizeof(cqm2_sim::ColorLineVertex)), nullptr, GL_STREAM_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(cqm2_sim::ColorLineVertex), reinterpret_cast<const void*>(0));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 4, GL_FLOAT, GL_FALSE, sizeof(cqm2_sim::ColorLineVertex), reinterpret_cast<const void*>(sizeof(glm::vec3)));
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
    if (!sim.brainTexXylos.empty()) {
        // 0 = APEX (Xylos Hyperbolic), 1 = MECHA (54k STDP), 2 = GLYPH (10x10 Dot Matrix)
        glBindTexture(GL_TEXTURE_2D, m_brainTex[0]);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, cqm2_sim::kBrainTexSize, cqm2_sim::kBrainTexSize, GL_RGBA, GL_UNSIGNED_BYTE, sim.brainTexXylos.data());
        glBindTexture(GL_TEXTURE_2D, m_brainTex[1]);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, cqm2_sim::kBrainTexSize, cqm2_sim::kBrainTexSize, GL_RGBA, GL_UNSIGNED_BYTE, sim.brainTexMecha.data());
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

    const float t = static_cast<float>(sim.simTime);
    if (sim.miniWorldMode) {
        cam.fovDeg = 72.0f;
        if (sim.viewMode == 0 && cam.distance > 14.0f) {
            cam.distance = 8.5f;
            cam.pitch = 0.06f;
        }
    } else if (cam.fovDeg > 64.0f) {
        cam.fovDeg = 56.0f;
    }

    // All 12 Original CQM Camera View Modes:
    // 0=free, 1=orbit, 2=fly, 3=top, 4=follow, 5=chase, 6=cinematic, 7=vortex, 8=titan, 9=specimen, 10=mimic, 11=tree
    switch (sim.viewMode) {
        case 1: // orbit
            cam.yaw = t * 0.14f;
            cam.pitch = 0.18f;
            cam.distance = 44.0f;
            cam.target = glm::vec3(0.0f, 3.8f, -8.0f);
            break;
        case 2: // fly
            cam.yaw = std::sin(t * 0.18f) * 0.95f;
            cam.pitch = 0.08f + 0.08f * std::cos(t * 0.23f);
            cam.distance = 22.0f;
            cam.target = glm::vec3(std::sin(t * 0.12f) * 14.0f, 5.0f, -6.0f + std::cos(t * 0.12f) * 12.0f);
            break;
        case 3: // top
            cam.pitch = 1.38f;
            cam.distance = 86.0f;
            cam.target = glm::vec3(0.0f, 0.0f, -4.0f);
            break;
        case 4: // follow (Archon #0)
            cam.target = sim.archons[0].pos;
            cam.distance = 11.5f;
            cam.pitch = 0.16f;
            break;
        case 5: // chase (Mechalogodrom)
            cam.target = sim.mechalogodromCenter;
            cam.distance = 16.5f;
            cam.pitch = 0.18f;
            break;
        case 6: // cinematic (GodColossus + Xylos sweep)
            cam.yaw = 0.18f + 0.35f * std::sin(t * 0.10f);
            cam.pitch = 0.10f;
            cam.distance = 36.0f;
            cam.target = glm::vec3(-1.0f, 5.2f, -10.0f);
            break;
        case 7: // vortex (Xylos Hyperbolic Portal)
            cam.target = sim.xylosCenter + glm::vec3(0.0f, 4.2f, 0.0f);
            cam.distance = 13.5f;
            cam.yaw = t * 0.22f;
            cam.pitch = 0.16f;
            break;
        case 8: // titan (4D Tesseract Titan #0)
            cam.target = sim.titans[0].pos;
            cam.distance = 10.5f;
            cam.pitch = 0.18f;
            break;
        case 9: // specimen (close-up organism morphology)
            for (int m = 0; m < 40; ++m) {
                if (!sim.dynamicMeshBuckets[m].empty()) {
                    cam.target = glm::vec3(sim.dynamicMeshBuckets[m][0].posScale);
                    cam.distance = 5.5f;
                    cam.pitch = 0.22f;
                    break;
                }
            }
            break;
        case 10: // mimic (Chiral Enantiomeric Xenomimic close-up)
            for (int m = 40; m < 50; ++m) {
                if (!sim.dynamicMeshBuckets[m].empty()) {
                    cam.target = glm::vec3(sim.dynamicMeshBuckets[m][0].posScale);
                    cam.distance = 5.8f;
                    cam.pitch = 0.20f;
                    break;
                }
            }
            break;
        case 11: // tree (Crystal Big Tree of Life)
            cam.target = sim.crystalTreeCenter + glm::vec3(0.0f, 6.5f, 0.0f);
            cam.distance = 19.0f;
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

    glBindFramebuffer(GL_FRAMEBUFFER, m_sceneFbo);
    glViewport(0, 0, fbw, fbh);
    glEnable(GL_DEPTH_TEST);
    glDepthMask(GL_TRUE);
    glDisable(GL_BLEND);
    glClearColor(0.05f, 0.005f, 0.068f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    // Render Mode 10 (`reliquary`): Fullscreen Jolt 5.5 + Filigree SDF Raymarcher
    if (sim.renderMode == 10) {
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
        // Pass 1: Geodesic Dome + GodColossus Mandelbulb Core + Singularity Disk
        glUseProgram(m_progSkyColossus);
        glUniformMatrix4fv(glGetUniformLocation(m_progSkyColossus, "uInvViewProj"), 1, GL_FALSE, glm::value_ptr(invVP));
        glUniformMatrix4fv(glGetUniformLocation(m_progSkyColossus, "uViewProj"), 1, GL_FALSE, glm::value_ptr(VP));
        glUniform3f(glGetUniformLocation(m_progSkyColossus, "uCamPos"), eye.x, eye.y, eye.z);
        glUniform1f(glGetUniformLocation(m_progSkyColossus, "uTime"), t);
        glUniform1i(glGetUniformLocation(m_progSkyColossus, "uWeather"), sim.weatherMode);
        glUniform1i(glGetUniformLocation(m_progSkyColossus, "uSingularity"), sim.singularityMode);
        glUniform1i(glGetUniformLocation(m_progSkyColossus, "uNMode"), sim.nMode);
        glUniform1f(glGetUniformLocation(m_progSkyColossus, "uChaos"), sim.chaosLevel);
        glBindVertexArray(m_emptyVao);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        // Pass 2: 256x256 Live Gray-Scott Displaced Terrain
        glUseProgram(m_progFloor);
        glUniformMatrix4fv(glGetUniformLocation(m_progFloor, "uViewProj"), 1, GL_FALSE, glm::value_ptr(VP));
        glUniform1f(glGetUniformLocation(m_progFloor, "uTime"), t);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, m_grayScottTex);
        glUniform1i(glGetUniformLocation(m_progFloor, "uGrayScottTex"), 0);
        glBindVertexArray(m_floorVao);
        glDrawElements(GL_TRIANGLES, m_floorIndexCount, GL_UNSIGNED_INT, nullptr);

        // Pass 3A (Opaque) & Pass 3B (Translucent) across all 64 Procedural 3D Topologies!
        glUseProgram(m_progInstanced);
        glUniformMatrix4fv(glGetUniformLocation(m_progInstanced, "uViewProj"), 1, GL_FALSE, glm::value_ptr(VP));
        glUniform3f(glGetUniformLocation(m_progInstanced, "uCamPos"), eye.x, eye.y, eye.z);
        glUniform1f(glGetUniformLocation(m_progInstanced, "uTime"), t);
        glUniform1i(glGetUniformLocation(m_progInstanced, "uRenderMode"), sim.renderMode);
        glUniform1i(glGetUniformLocation(m_progInstanced, "uBrutalMode"), sim.brutalMode);

        if (sim.renderMode == 1) { // wire mode
            glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);
        }

        thread_local std::vector<cqm2_sim::MeshInstance> batchBuf;
        batchBuf.reserve(8192);

        auto drawPass = [&](bool translucentPass) {
            for (int id = 0; id < cqm2_meshes::kTotalMeshTopologies; ++id) {
                const auto& stVec = sim.staticMeshBuckets[id];
                const auto& dyVec = sim.dynamicMeshBuckets[id];
                if (stVec.empty() && dyVec.empty()) continue;

                batchBuf.clear();
                for (const auto& inst : stVec) {
                    if (isTranslucentInstance(inst, sim.renderMode) == translucentPass) batchBuf.push_back(inst);
                }
                for (const auto& inst : dyVec) {
                    if (isTranslucentInstance(inst, sim.renderMode) == translucentPass) batchBuf.push_back(inst);
                }
                if (batchBuf.empty()) continue;

                size_t count = std::min(batchBuf.size(), kMaxStreamInstances);
                glBindBuffer(GL_ARRAY_BUFFER, m_sharedInstVbo);
                glBufferSubData(GL_ARRAY_BUFFER, 0,
                                static_cast<GLsizeiptr>(count * sizeof(cqm2_sim::MeshInstance)),
                                batchBuf.data());
                glBindVertexArray(m_meshes[id].vao);
                glDrawElementsInstanced(GL_TRIANGLES, m_meshes[id].indexCount, GL_UNSIGNED_INT, nullptr, static_cast<GLsizei>(count));
            }
        };

        // Opaque meshes first (writes depth)
        glDisable(GL_BLEND);
        glDepthMask(GL_TRUE);
        drawPass(false);

        // Pass 4: 4D Titan Tesseracts, Xylos Sphere Cage & Axons, Lorenz/Rossler Ribbons, Quasicrystal Stars
        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
        if (sim.renderMode == 1) {
            glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);
        }

        glUseProgram(m_progLine);
        glUniformMatrix4fv(glGetUniformLocation(m_progLine, "uViewProj"), 1, GL_FALSE, glm::value_ptr(VP));
        glBindVertexArray(m_lineVao);
        glBindBuffer(GL_ARRAY_BUFFER, m_lineVbo);

        if (!sim.worldColorLines.empty()) {
            size_t cnt = std::min(sim.worldColorLines.size(), kMaxStreamLineVerts);
            glBufferSubData(GL_ARRAY_BUFFER, 0,
                            static_cast<GLsizeiptr>(cnt * sizeof(cqm2_sim::ColorLineVertex)),
                            sim.worldColorLines.data());
            glDrawArrays(GL_LINES, 0, static_cast<GLsizei>(cnt));
        }

        if (!sim.quasicrystalShellPts.empty()) {
            thread_local std::vector<cqm2_sim::ColorLineVertex> qpts;
            size_t nq = std::min<size_t>(sim.quasicrystalShellPts.size(), 512);
            qpts.clear();
            qpts.reserve(nq);
            for (size_t i = 0; i < nq; ++i) {
                glm::vec3 p = sim.godColossusCenter + sim.quasicrystalShellPts[i] * 0.42f;
                qpts.push_back({ p, glm::vec4(0.65f, 0.55f, 0.95f, 0.55f) });
            }
            glBufferSubData(GL_ARRAY_BUFFER, 0,
                            static_cast<GLsizeiptr>(qpts.size() * sizeof(cqm2_sim::ColorLineVertex)),
                            qpts.data());
            glDrawArrays(GL_POINTS, 0, static_cast<GLsizei>(qpts.size()));
        }

        // Translucent glass bells, frosted gyroid clouds, Xylos membranes & solar FireCone (depth-tested, depth-write off)
        glUseProgram(m_progInstanced);
        if (sim.renderMode == 1) {
            glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);
        }
        glDepthMask(GL_FALSE);
        drawPass(true);
        glDepthMask(GL_TRUE);
        if (sim.renderMode == 1) {
            glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);
        }
    }

    // Pass 5: Composite Scene FBO -> Target FBO via ACES Filmic + Singularity Lensing
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
    glUniform1i(glGetUniformLocation(m_progPost, "uRenderMode"), sim.renderMode);
    glUniform1i(glGetUniformLocation(m_progPost, "uSingularity"), sim.singularityMode);

    glBindVertexArray(m_emptyVao);
    glDrawArrays(GL_TRIANGLES, 0, 3);
    glBindVertexArray(0);
}

} // namespace cqm2_render
