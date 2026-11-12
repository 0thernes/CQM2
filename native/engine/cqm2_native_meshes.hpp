/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once
/**
 * @file cqm2_native_meshes.hpp
 * @brief Pure C++20 Procedural 64-Topology Indexed 3D Mesh Generator for CQM2 v5.0.0.
 *
 * Replaces v4.0.0's placeholder sphere/cube with Original CQM's complete procedural
 * morphology library:
 *   - [0..39]  40 Organism Morphotype Topologies (Platonic/Geodesic, Torus & TorusKnots,
 *              Lathe Bells/Amphorae/Spindles/Horns/Nautilus/Diatoms, Radiolarians,
 *              Helical Ribbons, Trilobites, Winged Mantas, Gyroid Blobs, Voxel Clusters)
 *   - [40..49] 10 Chiral Enantiomeric Xenomimic Topologies (Porous Möbius, Radial Gear-Torus,
 *              Cantilevered Octahedral Shard Bloom, 4D Strut Tesseract, Geodesic Gyro-Orb)
 *   - [50..63] 14 Deity, Botanical, Architectural & Cosmic Rig Parts (Curved Catmull-Rom
 *              Spike/Tentacle, Archon Wing Blade, 4-Layer Eyeball, Gimbal Halo Ring,
 *              Botanical Stem, Alien Corolla Bell, Bioluminescent Mushroom, Spiral Frond,
 *              Dark Monolith Obelisk Spire, Cantilevered Brutalist Ziggurat Block,
 *              Xylos Folded Hyperbolic Möbius Membrane, GodColossus Mandelbulb/Gyroid Lobe,
 *              Achromatic Menger-Perforated Temple Block, MechaFirePillar Solar Cone)
 */

#include <glm/glm.hpp>
#include <glm/gtc/constants.hpp>
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <vector>

namespace cqm2_meshes {

inline constexpr int kTotalMeshTopologies = 64;

struct MeshVertex {
    glm::vec3 pos;
    glm::vec3 nrm;
    glm::vec2 uv;
};

struct CpuMeshData {
    std::vector<MeshVertex> vertices;
    std::vector<uint32_t> indices;
};

enum MeshId : int {
    // 0..39: 40 Organism Morphotype Topologies
    kMeshTetra = 0,
    kMeshOcta = 1,
    kMeshChamferCube = 2,
    kMeshDodeca = 3,
    kMeshIcosa = 4,
    kMeshGeodesic = 5,
    kMeshMerkaba = 6,
    kMeshStellatedIcosa = 7,
    kMeshTorus = 8,
    kMeshHexTorus = 9,
    kMeshKnot23 = 10,
    kMeshKnot35 = 11,
    kMeshKnot25 = 12,
    kMeshKnot37 = 13,
    kMeshKnot45 = 14,
    kMeshHopfLink = 15,
    kMeshMedusaBell = 16,      // Green floating frustum/lampshade bell!
    kMeshAmphora = 17,
    kMeshSpindle = 18,
    kMeshHyperbolicHorn = 19,
    kMeshNautilus = 20,
    kMeshUrchinTest = 21,
    kMeshDiatomFrustule = 22,
    kMeshChalice = 23,
    kMeshPagodaBell = 24,
    kMeshAcornPod = 25,
    kMeshRadiolarian12 = 26,
    kMeshCorona20 = 27,
    kMeshDoubleHelix = 28,
    kMeshMobiusLoop = 29,
    kMeshTrilobite = 30,
    kMeshMantaGlider = 31,
    kMeshCrystalCluster = 32,
    kMeshStarPrism5 = 33,
    kMeshStarPrism7 = 34,
    kMeshGyroCage = 35,
    kMeshGyroidBlob = 36,      // Porous organic coral/gyroid cloud blob!
    kMeshVoxelCluster = 37,    // Voxelized multi-cell mossy cube cluster!
    kMeshCrownedJelly = 38,
    kMeshTripodWalker = 39,

    // 40..49: 10 Chiral Xenomimic Topologies (L/R pairs)
    kMeshXenoMobiusL = 40,
    kMeshXenoMobiusR = 41,
    kMeshXenoGearL = 42,
    kMeshXenoGearR = 43,
    kMeshXenoShardL = 44,
    kMeshXenoShardR = 45,
    kMeshXenoTesseractL = 46,
    kMeshXenoTesseractR = 47,
    kMeshXenoGyroOrbL = 48,
    kMeshXenoGyroOrbR = 49,

    // 50..63: Deity, Botanical, Architectural & Cosmic Rig Parts
    kMeshCurvedSpike = 50,
    kMeshArchonWing = 51,
    kMeshEyeball = 52,
    kMeshGimbalRing = 53,
    kMeshPlantStem = 54,
    kMeshFlowerBell = 55,
    kMeshMushroomCap = 56,
    kMeshFernFrond = 57,
    kMeshObeliskSpire = 58,
    kMeshCantileverBlock = 59,
    kMeshXylosMembrane = 60,
    kMeshColossusLobe = 61,
    kMeshMengerBlock = 62,
    kMeshFireCone = 63
};

namespace detail {

constexpr float kPi = 3.14159265358979323846f;
constexpr float kTau = 6.28318530717958647692f;

inline float hash31(glm::vec3 p) {
    p = glm::fract(p * glm::vec3(443.897f, 441.423f, 437.195f));
    p += glm::dot(p, glm::vec3(p.y, p.z, p.x) + 19.19f);
    return glm::fract((p.x + p.y) * p.z);
}

inline float noise3(const glm::vec3& x) {
    glm::vec3 i = glm::floor(x);
    glm::vec3 f = glm::fract(x);
    f = f * f * (3.0f - 2.0f * f);
    float n000 = hash31(i + glm::vec3(0, 0, 0));
    float n100 = hash31(i + glm::vec3(1, 0, 0));
    float n010 = hash31(i + glm::vec3(0, 1, 0));
    float n110 = hash31(i + glm::vec3(1, 1, 0));
    float n001 = hash31(i + glm::vec3(0, 0, 1));
    float n101 = hash31(i + glm::vec3(1, 0, 1));
    float n011 = hash31(i + glm::vec3(0, 1, 1));
    float n111 = hash31(i + glm::vec3(1, 1, 1));
    return glm::mix(
        glm::mix(glm::mix(n000, n100, f.x), glm::mix(n010, n110, f.x), f.y),
        glm::mix(glm::mix(n001, n101, f.x), glm::mix(n011, n111, f.x), f.y),
        f.z
    );
}

inline void addTri(CpuMeshData& m, const glm::vec3& a, const glm::vec3& b, const glm::vec3& c,
                   const glm::vec2& uva = {0, 0}, const glm::vec2& uvb = {1, 0}, const glm::vec2& uvc = {0.5f, 1}) {
    glm::vec3 e1 = b - a;
    glm::vec3 e2 = c - a;
    glm::vec3 n = glm::cross(e1, e2);
    float len = glm::length(n);
    n = (len > 1e-7f) ? (n / len) : glm::vec3(0.0f, 1.0f, 0.0f);
    uint32_t base = static_cast<uint32_t>(m.vertices.size());
    m.vertices.push_back({a, n, uva});
    m.vertices.push_back({b, n, uvb});
    m.vertices.push_back({c, n, uvc});
    m.indices.push_back(base);
    m.indices.push_back(base + 1);
    m.indices.push_back(base + 2);
}

inline void addQuad(CpuMeshData& m, const glm::vec3& a, const glm::vec3& b, const glm::vec3& c, const glm::vec3& d,
                    const glm::vec2& uv0 = {0, 0}, const glm::vec2& uv1 = {1, 1}) {
    addTri(m, a, b, c, {uv0.x, uv0.y}, {uv1.x, uv0.y}, {uv1.x, uv1.y});
    addTri(m, a, c, d, {uv0.x, uv0.y}, {uv1.x, uv1.y}, {uv0.x, uv1.y});
}

inline void addBox(CpuMeshData& m, const glm::vec3& center, const glm::vec3& halfExt, float uvTag = 0.0f) {
    const glm::vec3& c = center;
    const glm::vec3& h = halfExt;
    glm::vec3 p000(c.x - h.x, c.y - h.y, c.z - h.z);
    glm::vec3 p100(c.x + h.x, c.y - h.y, c.z - h.z);
    glm::vec3 p110(c.x + h.x, c.y + h.y, c.z - h.z);
    glm::vec3 p010(c.x - h.x, c.y + h.y, c.z - h.z);
    glm::vec3 p001(c.x - h.x, c.y - h.y, c.z + h.z);
    glm::vec3 p101(c.x + h.x, c.y - h.y, c.z + h.z);
    glm::vec3 p111(c.x + h.x, c.y + h.y, c.z + h.z);
    glm::vec3 p011(c.x - h.x, c.y + h.y, c.z + h.z);
    glm::vec2 u0(uvTag, 0.0f), u1(uvTag + 0.25f, 1.0f);
    addQuad(m, p001, p101, p111, p011, u0, u1); // +Z
    addQuad(m, p100, p000, p010, p110, u0, u1); // -Z
    addQuad(m, p101, p100, p110, p111, u0, u1); // +X
    addQuad(m, p000, p001, p011, p010, u0, u1); // -X
    addQuad(m, p011, p111, p110, p010, u0, u1); // +Y
    addQuad(m, p000, p100, p101, p001, u0, u1); // -Y
}

inline void addStrut(CpuMeshData& m, const glm::vec3& a, const glm::vec3& b, float radius, int sides = 5) {
    glm::vec3 axis = b - a;
    float len = glm::length(axis);
    if (len < 1e-5f) return;
    glm::vec3 fwd = axis / len;
    glm::vec3 up = (std::abs(fwd.y) < 0.92f) ? glm::vec3(0, 1, 0) : glm::vec3(1, 0, 0);
    glm::vec3 right = glm::normalize(glm::cross(up, fwd));
    glm::vec3 bitan = glm::cross(fwd, right);

    uint32_t base = static_cast<uint32_t>(m.vertices.size());
    for (int r = 0; r <= 1; ++r) {
        glm::vec3 ctr = (r == 0) ? a : b;
        for (int s = 0; s <= sides; ++s) {
            float th = (static_cast<float>(s) / static_cast<float>(sides)) * kTau;
            glm::vec3 dir = std::cos(th) * right + std::sin(th) * bitan;
            m.vertices.push_back({ctr + dir * radius, dir, {static_cast<float>(s) / sides, static_cast<float>(r)}});
        }
    }
    int stride = sides + 1;
    for (int s = 0; s < sides; ++s) {
        uint32_t i0 = base + s;
        uint32_t i1 = i0 + 1;
        uint32_t i2 = i0 + stride;
        uint32_t i3 = i2 + 1;
        m.indices.insert(m.indices.end(), {i0, i2, i1, i1, i2, i3});
    }
}

inline void recomputeSmoothNormals(CpuMeshData& m) {
    std::vector<glm::vec3> acc(m.vertices.size(), glm::vec3(0.0f));
    for (size_t i = 0; i + 2 < m.indices.size(); i += 3) {
        uint32_t i0 = m.indices[i], i1 = m.indices[i + 1], i2 = m.indices[i + 2];
        glm::vec3 n = glm::cross(m.vertices[i1].pos - m.vertices[i0].pos, m.vertices[i2].pos - m.vertices[i0].pos);
        acc[i0] += n;
        acc[i1] += n;
        acc[i2] += n;
    }
    for (size_t v = 0; v < m.vertices.size(); ++v) {
        float l = glm::length(acc[v]);
        m.vertices[v].nrm = (l > 1e-7f) ? (acc[v] / l) : glm::normalize(m.vertices[v].pos + glm::vec3(0, 1e-4f, 0));
    }
}

// Base icosahedron vertices & triangles
inline void makeBaseIcosa(std::vector<glm::vec3>& verts, std::vector<glm::uvec3>& tris) {
    const float t = (1.0f + std::sqrt(5.0f)) * 0.5f;
    const glm::vec3 raw[12] = {
        {-1,  t,  0}, { 1,  t,  0}, {-1, -t,  0}, { 1, -t,  0},
        { 0, -1,  t}, { 0,  1,  t}, { 0, -1, -t}, { 0,  1, -t},
        { t,  0, -1}, { t,  0,  1}, {-t,  0, -1}, {-t,  0,  1}
    };
    verts.resize(12);
    for (int i = 0; i < 12; ++i) verts[i] = glm::normalize(raw[i]);
    tris = {
        {0,11,5}, {0,5,1}, {0,1,7}, {0,7,10}, {0,10,11},
        {1,5,9}, {5,11,4}, {11,10,2}, {10,7,6}, {7,1,8},
        {3,9,4}, {3,4,2}, {3,2,6}, {3,6,8}, {3,8,9},
        {4,9,5}, {2,4,11}, {6,2,10}, {8,6,7}, {9,8,1}
    };
}

inline CpuMeshData buildPolyhedron(int subdiv, float spikeHeight) {
    std::vector<glm::vec3> v;
    std::vector<glm::uvec3> t;
    makeBaseIcosa(v, t);
    for (int sub = 0; sub < subdiv; ++sub) {
        std::vector<glm::uvec3> nextT;
        nextT.reserve(t.size() * 4);
        for (const auto& tri : t) {
            uint32_t a = tri.x, b = tri.y, c = tri.z;
            uint32_t ab = static_cast<uint32_t>(v.size()); v.push_back(glm::normalize(v[a] + v[b]));
            uint32_t bc = static_cast<uint32_t>(v.size()); v.push_back(glm::normalize(v[b] + v[c]));
            uint32_t ca = static_cast<uint32_t>(v.size()); v.push_back(glm::normalize(v[c] + v[a]));
            nextT.push_back({a, ab, ca});
            nextT.push_back({b, bc, ab});
            nextT.push_back({c, ca, bc});
            nextT.push_back({ab, bc, ca});
        }
        t.swap(nextT);
    }
    CpuMeshData m;
    for (const auto& tri : t) {
        glm::vec3 pa = v[tri.x], pb = v[tri.y], pc = v[tri.z];
        if (std::abs(spikeHeight) > 1e-4f) {
            glm::vec3 ctr = glm::normalize(pa + pb + pc) * (1.0f + spikeHeight);
            addTri(m, pa, pb, ctr, {0, 0}, {1, 0}, {0.5f, 1});
            addTri(m, pb, pc, ctr, {0, 0}, {1, 0}, {0.5f, 1});
            addTri(m, pc, pa, ctr, {0, 0}, {1, 0}, {0.5f, 1});
        } else {
            addTri(m, pa, pb, pc);
        }
    }
    return m;
}

template <typename RadiusFn>
inline CpuMeshData buildLathe(int stacks, int slices, float yMin, float yMax, RadiusFn&& radFn, bool capBottom = false, bool capTop = false) {
    CpuMeshData m;
    for (int i = 0; i <= stacks; ++i) {
        float v = static_cast<float>(i) / static_cast<float>(stacks);
        float y = glm::mix(yMin, yMax, v);
        for (int j = 0; j <= slices; ++j) {
            float u = static_cast<float>(j) / static_cast<float>(slices);
            float th = u * kTau;
            float r = std::max(0.002f, radFn(v, th));
            glm::vec3 p(std::cos(th) * r, y, std::sin(th) * r);
            m.vertices.push_back({p, glm::normalize(glm::vec3(std::cos(th), 0.2f, std::sin(th))), {u, v}});
        }
    }
    int stride = slices + 1;
    for (int i = 0; i < stacks; ++i) {
        for (int j = 0; j < slices; ++j) {
            uint32_t i0 = static_cast<uint32_t>(i * stride + j);
            uint32_t i1 = i0 + 1;
            uint32_t i2 = i0 + stride;
            uint32_t i3 = i2 + 1;
            m.indices.insert(m.indices.end(), {i0, i2, i1, i1, i2, i3});
        }
    }
    recomputeSmoothNormals(m);
    if (capBottom) {
        for (int j = 0; j < slices; ++j) {
            float t0 = (static_cast<float>(j) / slices) * kTau;
            float t1 = (static_cast<float>(j + 1) / slices) * kTau;
            float r0 = std::max(0.002f, radFn(0.0f, t0));
            float r1 = std::max(0.002f, radFn(0.0f, t1));
            addTri(m, {0, yMin, 0}, {std::cos(t1) * r1, yMin, std::sin(t1) * r1}, {std::cos(t0) * r0, yMin, std::sin(t0) * r0});
        }
    }
    if (capTop) {
        for (int j = 0; j < slices; ++j) {
            float t0 = (static_cast<float>(j) / slices) * kTau;
            float t1 = (static_cast<float>(j + 1) / slices) * kTau;
            float r0 = std::max(0.002f, radFn(1.0f, t0));
            float r1 = std::max(0.002f, radFn(1.0f, t1));
            addTri(m, {0, yMax, 0}, {std::cos(t0) * r0, yMax, std::sin(t0) * r0}, {std::cos(t1) * r1, yMax, std::sin(t1) * r1});
        }
    }
    return m;
}

inline CpuMeshData buildTorusKnot(int p, int q, float R, float tubeR, int segs, int sides, float twistAmp = 0.0f) {
    CpuMeshData m;
    auto evalPt = [&](float t) {
        float qr = std::cos(q * t);
        float r = R * (1.0f + 0.38f * qr);
        return glm::vec3(r * std::cos(p * t), R * 0.42f * std::sin(q * t), r * std::sin(p * t));
    };
    for (int i = 0; i <= segs; ++i) {
        float u = static_cast<float>(i) / static_cast<float>(segs);
        float t = u * kTau;
        glm::vec3 c = evalPt(t);
        glm::vec3 cNext = evalPt(t + 0.005f);
        glm::vec3 tang = glm::normalize(cNext - c);
        glm::vec3 up = (std::abs(tang.y) < 0.9f) ? glm::vec3(0, 1, 0) : glm::vec3(1, 0, 0);
        glm::vec3 nrm = glm::normalize(glm::cross(up, tang));
        glm::vec3 bin = glm::cross(tang, nrm);
        for (int j = 0; j <= sides; ++j) {
            float v = static_cast<float>(j) / static_cast<float>(sides);
            float ph = v * kTau;
            float tr = tubeR * (1.0f + twistAmp * std::cos(4.0f * ph + 6.0f * t));
            glm::vec3 dir = std::cos(ph) * nrm + std::sin(ph) * bin;
            m.vertices.push_back({c + dir * tr, dir, {u, v}});
        }
    }
    int stride = sides + 1;
    for (int i = 0; i < segs; ++i) {
        for (int j = 0; j < sides; ++j) {
            uint32_t i0 = static_cast<uint32_t>(i * stride + j);
            uint32_t i1 = i0 + 1;
            uint32_t i2 = i0 + stride;
            uint32_t i3 = i2 + 1;
            m.indices.insert(m.indices.end(), {i0, i2, i1, i1, i2, i3});
        }
    }
    return m;
}

inline CpuMeshData buildMobius(float R, float halfWidth, float thickness, int segs, float chirality, bool porous) {
    CpuMeshData m;
    for (int i = 0; i < segs; ++i) {
        if (porous && ((i % 5) == 2)) continue; // Porous fenestrations!
        float u0 = static_cast<float>(i) / segs;
        float u1 = static_cast<float>(i + 1) / segs;
        auto pt = [&](float u, float s, float side) {
            float t = u * kTau;
            float halfT = 0.5f * t * chirality;
            glm::vec3 radial(std::cos(t), 0.0f, std::sin(t));
            glm::vec3 up(0.0f, 1.0f, 0.0f);
            glm::vec3 widthDir = std::cos(halfT) * up + std::sin(halfT) * radial;
            glm::vec3 thickDir = -std::sin(halfT) * up + std::cos(halfT) * radial;
            return radial * R + widthDir * (s * halfWidth) + thickDir * (side * thickness);
        };
        for (int w = -2; w < 2; ++w) {
            if (porous && w == 0 && (i % 3 == 0)) continue;
            float s0 = static_cast<float>(w) * 0.5f;
            float s1 = static_cast<float>(w + 1) * 0.5f;
            addQuad(m, pt(u0, s0, 1), pt(u1, s0, 1), pt(u1, s1, 1), pt(u0, s1, 1), {u0, (s0 + 1) * 0.5f}, {u1, (s1 + 1) * 0.5f});
            addQuad(m, pt(u1, s0, -1), pt(u0, s0, -1), pt(u0, s1, -1), pt(u1, s1, -1), {u0, (s0 + 1) * 0.5f}, {u1, (s1 + 1) * 0.5f});
        }
    }
    return m;
}

} // namespace detail

inline CpuMeshData generateMeshTopology(int id) {
    using namespace detail;
    CpuMeshData m;

    switch (id) {
    case kMeshTetra: {
        const glm::vec3 v[4] = {
            glm::normalize(glm::vec3( 1,  1,  1)),
            glm::normalize(glm::vec3(-1, -1,  1)),
            glm::normalize(glm::vec3(-1,  1, -1)),
            glm::normalize(glm::vec3( 1, -1, -1))
        };
        addTri(m, v[0], v[2], v[1]);
        addTri(m, v[0], v[1], v[3]);
        addTri(m, v[0], v[3], v[2]);
        addTri(m, v[1], v[2], v[3]);
        return m;
    }
    case kMeshOcta: {
        const glm::vec3 px(1, 0, 0), nx(-1, 0, 0), py(0, 1.15f, 0), ny(0, -1.15f, 0), pz(0, 0, 1), nz(0, 0, -1);
        addTri(m, py, pz, px); addTri(m, py, px, nz); addTri(m, py, nz, nx); addTri(m, py, nx, pz);
        addTri(m, ny, px, pz); addTri(m, ny, nz, px); addTri(m, ny, nx, nz); addTri(m, ny, pz, nx);
        return m;
    }
    case kMeshChamferCube: {
        addBox(m, {0, 0, 0}, {0.68f, 0.68f, 0.68f});
        addBox(m, {0, 0, 0}, {0.82f, 0.48f, 0.48f}, 0.3f);
        addBox(m, {0, 0, 0}, {0.48f, 0.82f, 0.48f}, 0.6f);
        addBox(m, {0, 0, 0}, {0.48f, 0.48f, 0.82f}, 0.8f);
        return m;
    }
    case kMeshDodeca:
        return buildPolyhedron(1, -0.08f);
    case kMeshIcosa:
        return buildPolyhedron(0, 0.0f);
    case kMeshGeodesic:
        return buildPolyhedron(2, 0.0f);
    case kMeshMerkaba: {
        const float s = 0.95f;
        const glm::vec3 a[4] = {{s, s, s}, {-s, -s, s}, {-s, s, -s}, {s, -s, -s}};
        const glm::vec3 b[4] = {{-s, -s, -s}, {s, s, -s}, {s, -s, s}, {-s, s, s}};
        addTri(m, a[0], a[2], a[1]); addTri(m, a[0], a[1], a[3]); addTri(m, a[0], a[3], a[2]); addTri(m, a[1], a[2], a[3]);
        addTri(m, b[0], b[1], b[2]); addTri(m, b[0], b[3], b[1]); addTri(m, b[0], b[2], b[3]); addTri(m, b[1], b[3], b[2]);
        return m;
    }
    case kMeshStellatedIcosa:
        return buildPolyhedron(0, 0.72f);

    case kMeshTorus:
        return buildTorusKnot(1, 0, 0.72f, 0.28f, 36, 16);
    case kMeshHexTorus:
        return buildTorusKnot(1, 0, 0.74f, 0.25f, 18, 6, 0.22f);
    case kMeshKnot23:
        return buildTorusKnot(2, 3, 0.64f, 0.16f, 72, 10);
    case kMeshKnot35:
        return buildTorusKnot(3, 5, 0.62f, 0.13f, 84, 9);
    case kMeshKnot25:
        return buildTorusKnot(2, 5, 0.64f, 0.14f, 84, 10);
    case kMeshKnot37:
        return buildTorusKnot(3, 7, 0.62f, 0.11f, 96, 8);
    case kMeshKnot45:
        return buildTorusKnot(4, 5, 0.60f, 0.11f, 96, 8);
    case kMeshHopfLink: {
        CpuMeshData t1 = buildTorusKnot(1, 0, 0.58f, 0.14f, 32, 10);
        m = t1;
        for (const auto& v : t1.vertices) {
            glm::vec3 p(v.pos.x + 0.35f, -v.pos.z, v.pos.y);
            glm::vec3 n(v.nrm.x, -v.nrm.z, v.nrm.y);
            m.vertices.push_back({p, n, v.uv});
        }
        uint32_t off = static_cast<uint32_t>(t1.vertices.size());
        for (uint32_t idx : t1.indices) m.indices.push_back(idx + off);
        return m;
    }

    // 16..25: Parametric Lathe & Marine/Xeno Shells
    case kMeshMedusaBell: // Iconic floating translucent frustum/lampshade bell!
        return buildLathe(14, 24, -0.55f, 0.65f, [](float v, float th) {
            float baseR = glm::mix(0.95f, 0.42f, std::pow(v, 0.85f));
            return baseR * (1.0f + 0.06f * std::cos(12.0f * th) * (1.0f - v));
        }, false, true);
    case kMeshAmphora:
        return buildLathe(18, 20, -0.95f, 0.95f, [](float v, float) {
            if (v < 0.15f) return 0.22f + v * 2.2f;
            if (v < 0.68f) return 0.55f + 0.35f * std::sin((v - 0.15f) / 0.53f * kPi);
            if (v < 0.88f) return 0.26f;
            return 0.26f + (v - 0.88f) * 1.8f;
        }, true, false);
    case kMeshSpindle:
        return buildLathe(16, 18, -1.1f, 1.1f, [](float v, float th) {
            return std::sin(v * kPi) * (0.58f + 0.08f * std::cos(8.0f * th));
        });
    case kMeshHyperbolicHorn:
        return buildLathe(18, 20, -0.9f, 0.9f, [](float v, float th) {
            float twist = 0.08f * std::sin(6.0f * th + v * 8.0f);
            return 0.14f + 0.78f * std::pow(1.0f - v, 1.8f) + twist;
        }, true, false);
    case kMeshNautilus: {
        const int segs = 56, sides = 12;
        for (int i = 0; i <= segs; ++i) {
            float u = static_cast<float>(i) / segs;
            float ang = u * 3.2f * kPi;
            float R = 0.14f * std::exp(0.19f * ang);
            float tr = R * 0.42f;
            glm::vec3 ctr(std::cos(ang) * R, std::sin(ang) * R, 0.0f);
            glm::vec3 radDir(std::cos(ang), std::sin(ang), 0.0f);
            for (int j = 0; j <= sides; ++j) {
                float ph = (static_cast<float>(j) / sides) * kTau;
                glm::vec3 dir = std::cos(ph) * radDir + std::sin(ph) * glm::vec3(0, 0, 1);
                m.vertices.push_back({ctr + dir * tr * (1.0f + 0.08f * std::sin(u * 40.0f)), dir, {u, static_cast<float>(j) / sides}});
            }
        }
        int st = sides + 1;
        for (int i = 0; i < segs; ++i)
            for (int j = 0; j < sides; ++j) {
                uint32_t i0 = i * st + j, i1 = i0 + 1, i2 = i0 + st, i3 = i2 + 1;
                m.indices.insert(m.indices.end(), {i0, i2, i1, i1, i2, i3});
            }
        return m;
    }
    case kMeshUrchinTest:
        return buildLathe(16, 25, -0.72f, 0.72f, [](float v, float th) {
            return std::sin(v * kPi) * (0.85f + 0.14f * std::abs(std::cos(5.0f * th)));
        });
    case kMeshDiatomFrustule:
        return buildLathe(14, 24, -0.55f, 0.55f, [](float v, float th) {
            float rim = (v > 0.42f && v < 0.58f) ? 0.08f : 0.0f;
            return (0.78f + rim) * (1.0f + 0.04f * std::cos(16.0f * th));
        }, true, true);
    case kMeshChalice:
        return buildLathe(18, 20, -0.9f, 0.85f, [](float v, float th) {
            if (v < 0.12f) return 0.58f * (1.0f - v * 3.0f) + 0.14f;
            if (v < 0.45f) return 0.14f;
            return 0.14f + 0.72f * std::pow((v - 0.45f) / 0.55f, 0.75f) * (1.0f + 0.05f * std::cos(10.0f * th));
        }, true, false);
    case kMeshPagodaBell:
        return buildLathe(20, 18, -0.9f, 0.95f, [](float v, float) {
            float tier = std::abs(std::sin(v * 3.0f * kPi));
            return (1.0f - 0.72f * v) * (0.45f + 0.42f * tier);
        }, true, true);
    case kMeshAcornPod:
        return buildLathe(16, 18, -0.9f, 0.9f, [](float v, float th) {
            float cap = (v > 0.62f) ? 1.14f : 1.0f;
            return std::sin(v * kPi) * 0.78f * cap * (1.0f + 0.04f * std::sin(12.0f * th));
        });

    // 26..39: Radiolarian, Helical, Arthro, Gyroid & Voxel Morphs
    case kMeshRadiolarian12:
        return buildPolyhedron(1, 0.52f);
    case kMeshCorona20:
        return buildPolyhedron(1, 0.85f);
    case kMeshDoubleHelix: {
        for (int strand = 0; strand < 2; ++strand) {
            float off = strand * kPi;
            glm::vec3 prev(0.0f);
            for (int k = 0; k <= 24; ++k) {
                float u = static_cast<float>(k) / 24.0f;
                float ang = u * 3.0f * kTau + off;
                glm::vec3 cur(std::cos(ang) * 0.52f, (u - 0.5f) * 2.1f, std::sin(ang) * 0.52f);
                if (k > 0) addStrut(m, prev, cur, 0.09f, 6);
                if (strand == 0 && (k % 3 == 0)) {
                    glm::vec3 mate(-cur.x, cur.y, -cur.z);
                    addStrut(m, cur, mate, 0.055f, 5);
                }
                prev = cur;
            }
        }
        return m;
    }
    case kMeshMobiusLoop:
        return buildMobius(0.75f, 0.28f, 0.045f, 44, 1.0f, false);
    case kMeshTrilobite: {
        for (int seg = 0; seg < 7; ++seg) {
            float t = static_cast<float>(seg) / 6.0f;
            float z = (t - 0.5f) * 1.7f;
            float w = std::sin((t * 0.85f + 0.08f) * kPi) * 0.78f;
            addBox(m, {0.0f, 0.12f * (1.0f - std::abs(t - 0.4f)), z}, {w, 0.14f, 0.11f}, t);
        }
        return m;
    }
    case kMeshMantaGlider: {
        addBox(m, {0, 0, 0}, {0.22f, 0.14f, 0.85f});
        addTri(m, {0.18f, 0.02f, 0.45f}, {1.25f, 0.12f, -0.15f}, {0.15f, -0.02f, -0.55f});
        addTri(m, {0.18f, -0.02f, 0.45f}, {0.15f, -0.02f, -0.55f}, {1.25f, 0.12f, -0.15f});
        addTri(m, {-0.18f, 0.02f, 0.45f}, {-0.15f, -0.02f, -0.55f}, {-1.25f, 0.12f, -0.15f});
        addTri(m, {-0.18f, -0.02f, 0.45f}, {-1.25f, 0.12f, -0.15f}, {-0.15f, -0.02f, -0.55f});
        return m;
    }
    case kMeshCrystalCluster: {
        const glm::vec3 dirs[7] = {
            {0, 1, 0}, {0.55f, 0.75f, 0.2f}, {-0.5f, 0.7f, 0.3f},
            {0.2f, 0.65f, -0.6f}, {-0.35f, 0.6f, -0.5f}, {0.7f, 0.4f, -0.2f}, {-0.7f, 0.45f, 0.1f}
        };
        for (int k = 0; k < 7; ++k) {
            glm::vec3 d = glm::normalize(dirs[k]);
            float len = (k == 0) ? 1.25f : (0.75f + 0.1f * (k % 3));
            addStrut(m, -d * 0.2f, d * len, (k == 0) ? 0.22f : 0.14f, 6);
        }
        return m;
    }
    case kMeshStarPrism5:
    case kMeshStarPrism7: {
        int pts = (id == kMeshStarPrism5) ? 10 : 14;
        return buildLathe(2, pts, -0.32f, 0.32f, [](float, float th) {
            int k = static_cast<int>(std::round(th / kTau * 10.0f));
            return (k % 2 == 0) ? 0.95f : 0.42f;
        }, true, true);
    }
    case kMeshGyroCage: {
        CpuMeshData r1 = buildTorusKnot(1, 0, 0.82f, 0.06f, 32, 6);
        m = r1;
        uint32_t o1 = static_cast<uint32_t>(m.vertices.size());
        for (const auto& v : r1.vertices) m.vertices.push_back({{v.pos.x, -v.pos.z, v.pos.y}, {v.nrm.x, -v.nrm.z, v.nrm.y}, v.uv});
        for (uint32_t idx : r1.indices) m.indices.push_back(idx + o1);
        uint32_t o2 = static_cast<uint32_t>(m.vertices.size());
        for (const auto& v : r1.vertices) m.vertices.push_back({{-v.pos.y, v.pos.x, v.pos.z}, {-v.nrm.y, v.nrm.x, v.nrm.z}, v.uv});
        for (uint32_t idx : r1.indices) m.indices.push_back(idx + o2);
        return m;
    }
    case kMeshGyroidBlob: { // Organic porous coral/cloud gyroid blob!
        CpuMeshData base = buildPolyhedron(3, 0.0f);
        for (auto& v : base.vertices) {
            glm::vec3 p = v.pos * 4.2f;
            float gyr = std::sin(p.x) * std::cos(p.y) + std::sin(p.y) * std::cos(p.z) + std::sin(p.z) * std::cos(p.x);
            float r = 0.78f + 0.24f * gyr + 0.10f * noise3(p * 1.7f);
            v.pos *= r;
            v.uv = {0.5f + 0.3f * gyr, 0.5f};
        }
        recomputeSmoothNormals(base);
        return base;
    }
    case kMeshVoxelCluster: { // Iconic voxelized mossy/multicolored cube cluster from user screenshot!
        for (int ix = -2; ix <= 2; ++ix)
        for (int iy = -2; iy <= 2; ++iy)
        for (int iz = -2; iz <= 2; ++iz) {
            int manh = std::abs(ix) + std::abs(iy) + std::abs(iz);
            if (manh > 4 || manh < 2) continue;
            uint32_t h = static_cast<uint32_t>((ix + 3) * 73856093 ^ (iy + 3) * 19349663 ^ (iz + 3) * 83492791);
            if ((h % 5u) == 0u) continue;
            float tag = static_cast<float>(h % 8u) * 0.125f;
            addBox(m, glm::vec3(ix, iy, iz) * 0.30f, glm::vec3(0.148f), tag);
        }
        return m;
    }
    case kMeshCrownedJelly: {
        m = buildLathe(14, 20, -0.2f, 0.75f, [](float v, float th) {
            return std::sin((v * 0.7f + 0.25f) * kPi) * (0.72f + 0.12f * std::cos(8.0f * th));
        });
        for (int k = 0; k < 8; ++k) {
            float a = k * (kTau / 8.0f);
            addStrut(m, {std::cos(a) * 0.45f, -0.15f, std::sin(a) * 0.45f},
                        {std::cos(a + 0.4f) * 0.25f, -1.05f, std::sin(a + 0.4f) * 0.25f}, 0.045f, 5);
        }
        return m;
    }
    case kMeshTripodWalker: {
        CpuMeshData head = buildPolyhedron(1, 0.0f);
        for (auto& v : head.vertices) v.pos = v.pos * 0.42f + glm::vec3(0, 0.45f, 0);
        m = head;
        for (int leg = 0; leg < 3; ++leg) {
            float a = leg * (kTau / 3.0f);
            glm::vec3 hip(std::cos(a) * 0.3f, 0.35f, std::sin(a) * 0.3f);
            glm::vec3 knee(std::cos(a) * 0.75f, 0.0f, std::sin(a) * 0.75f);
            glm::vec3 foot(std::cos(a) * 0.55f, -0.95f, std::sin(a) * 0.55f);
            addStrut(m, hip, knee, 0.065f, 5);
            addStrut(m, knee, foot, 0.05f, 5);
        }
        return m;
    }

    // 40..49: 10 Chiral Enantiomeric Xenomimic Topologies (Untethered!)
    case kMeshXenoMobiusL:
    case kMeshXenoMobiusR:
        return buildMobius(0.78f, 0.34f, 0.055f, 48, (id == kMeshXenoMobiusL) ? -1.0f : 1.0f, true);

    case kMeshXenoGearL:
    case kMeshXenoGearR: {
        float chir = (id == kMeshXenoGearL) ? -1.0f : 1.0f;
        m = buildTorusKnot(1, 0, 0.72f, 0.16f, 36, 8);
        for (int tooth = 0; tooth < 12; ++tooth) {
            float a = tooth * (kTau / 12.0f);
            glm::vec3 r0(std::cos(a) * 0.72f, 0.0f, std::sin(a) * 0.72f);
            glm::vec3 r1(std::cos(a + 0.14f * chir) * 1.08f, 0.12f * chir, std::sin(a + 0.14f * chir) * 1.08f);
            addStrut(m, r0, r1, 0.075f, 4);
        }
        return m;
    }

    case kMeshXenoShardL:
    case kMeshXenoShardR: {
        float chir = (id == kMeshXenoShardL) ? -1.0f : 1.0f;
        for (int k = 0; k < 9; ++k) {
            float a = k * 2.39996f * chir;
            float y = -0.6f + 0.15f * k;
            glm::vec3 dir = glm::normalize(glm::vec3(std::cos(a), y, std::sin(a)));
            addStrut(m, dir * 0.08f, dir * (0.85f + 0.25f * (k % 3)), 0.15f, 4);
        }
        return m;
    }

    case kMeshXenoTesseractL:
    case kMeshXenoTesseractR: {
        float rot = (id == kMeshXenoTesseractL) ? -0.32f : 0.32f;
        glm::vec3 inner[8], outer[8];
        for (int b = 0; b < 8; ++b) {
            glm::vec3 s((b & 1) ? 1.0f : -1.0f, (b & 2) ? 1.0f : -1.0f, (b & 4) ? 1.0f : -1.0f);
            outer[b] = s * 0.72f;
            float cx = s.x * std::cos(rot) - s.z * std::sin(rot);
            float cz = s.x * std::sin(rot) + s.z * std::cos(rot);
            inner[b] = glm::vec3(cx, s.y, cz) * 0.34f;
            addStrut(m, inner[b], outer[b], 0.032f, 4);
        }
        for (int i = 0; i < 8; ++i) {
            for (int bit = 0; bit < 3; ++bit) {
                int j = i ^ (1 << bit);
                if (i < j) {
                    addStrut(m, outer[i], outer[j], 0.035f, 4);
                    addStrut(m, inner[i], inner[j], 0.028f, 4);
                }
            }
        }
        return m;
    }

    case kMeshXenoGyroOrbL:
    case kMeshXenoGyroOrbR: {
        float chir = (id == kMeshXenoGyroOrbL) ? -1.0f : 1.0f;
        m = buildPolyhedron(0, 0.35f);
        for (auto& v : m.vertices) v.pos *= 0.45f;
        CpuMeshData ring = buildTorusKnot(1, 0, 0.88f, 0.055f, 32, 6);
        uint32_t off = static_cast<uint32_t>(m.vertices.size());
        for (const auto& v : ring.vertices) {
            glm::vec3 p(v.pos.x, v.pos.y * 0.7f - chir * v.pos.z * 0.7f, chir * v.pos.y * 0.7f + v.pos.z * 0.7f);
            m.vertices.push_back({p, v.nrm, v.uv});
        }
        for (uint32_t idx : ring.indices) m.indices.push_back(idx + off);
        return m;
    }

    // 50..63: Deity, Botanical, Architectural & Cosmic Rig Parts
    case kMeshCurvedSpike: { // Catmull-Rom curved tapered horn/tentacle along +Y [0..1]
        const int segs = 12, sides = 8;
        for (int i = 0; i <= segs; ++i) {
            float v = static_cast<float>(i) / segs;
            glm::vec3 ctr(0.28f * v * v, v * 1.4f, 0.12f * std::sin(v * kPi));
            float r = std::max(0.01f, 0.18f * std::pow(1.0f - v, 1.15f));
            for (int j = 0; j <= sides; ++j) {
                float u = static_cast<float>(j) / sides;
                float th = u * kTau;
                glm::vec3 dir(std::cos(th), 0.15f, std::sin(th));
                m.vertices.push_back({ctr + glm::vec3(std::cos(th) * r, 0.0f, std::sin(th) * r), glm::normalize(dir), {u, v}});
            }
        }
        int st = sides + 1;
        for (int i = 0; i < segs; ++i)
            for (int j = 0; j < sides; ++j) {
                uint32_t i0 = i * st + j, i1 = i0 + 1, i2 = i0 + st, i3 = i2 + 1;
                m.indices.insert(m.indices.end(), {i0, i2, i1, i1, i2, i3});
            }
        return m;
    }

    case kMeshArchonWing: { // Faceted seraphic wing blade extending along +X
        const glm::vec3 root(0, 0, 0);
        const glm::vec3 lead1(0.65f, 0.35f, 0.04f);
        const glm::vec3 lead2(1.45f, 0.52f, 0.02f);
        const glm::vec3 tip(2.05f, 0.25f, 0.0f);
        const glm::vec3 trail2(1.35f, -0.22f, -0.03f);
        const glm::vec3 trail1(0.55f, -0.28f, -0.04f);
        addTri(m, root, lead1, trail1); addTri(m, root, trail1, lead1);
        addQuad(m, trail1, lead1, lead2, trail2);
        addQuad(m, lead1, trail1, trail2, lead2);
        addTri(m, trail2, lead2, tip); addTri(m, lead2, trail2, tip);
        return m;
    }

    case kMeshEyeball: // UV-aligned sphere where v=1 is the anterior pupil/iris pole (+Y)
        return buildLathe(14, 18, -0.5f, 0.5f, [](float v, float) {
            return 0.5f * std::sin(v * kPi);
        });

    case kMeshGimbalRing:
        return buildTorusKnot(1, 0, 1.0f, 0.038f, 48, 8);

    case kMeshPlantStem:
        return buildLathe(10, 7, 0.0f, 1.0f, [](float v, float) {
            return glm::mix(0.085f, 0.032f, v);
        });

    case kMeshFlowerBell:
        return buildLathe(12, 16, 0.0f, 0.85f, [](float v, float th) {
            float petal = 1.0f + 0.24f * std::cos(6.0f * th) * v;
            return (0.06f + 0.58f * std::pow(v, 0.65f)) * petal;
        });

    case kMeshMushroomCap:
        return buildLathe(12, 20, -0.15f, 0.55f, [](float v, float th) {
            return std::sin(v * 0.88f * kPi + 0.12f) * (0.85f + 0.05f * std::cos(14.0f * th));
        }, true, false);

    case kMeshFernFrond: {
        addStrut(m, {0, 0, 0}, {0.15f, 1.25f, 0}, 0.035f, 5);
        for (int k = 1; k <= 8; ++k) {
            float v = static_cast<float>(k) / 9.0f;
            glm::vec3 spine(0.15f * v, 1.25f * v, 0.0f);
            float span = 0.42f * std::sin(v * kPi);
            addTri(m, spine, spine + glm::vec3(0.05f, 0.09f, span), spine + glm::vec3(0.02f, 0.14f, 0.0f));
            addTri(m, spine, spine + glm::vec3(0.02f, 0.14f, 0.0f), spine + glm::vec3(0.05f, 0.09f, span));
            addTri(m, spine, spine + glm::vec3(0.02f, 0.14f, 0.0f), spine + glm::vec3(0.05f, 0.09f, -span));
            addTri(m, spine, spine + glm::vec3(0.05f, 0.09f, -span), spine + glm::vec3(0.02f, 0.14f, 0.0f));
        }
        return m;
    }

    case kMeshObeliskSpire: // Towering faceted dark obsidian obelisk spire (y in [0, 1])!
        return buildLathe(8, 4, 0.0f, 1.0f, [](float v, float) {
            if (v < 0.86f) return glm::mix(0.18f, 0.075f, v / 0.86f);
            return glm::mix(0.075f, 0.004f, (v - 0.86f) / 0.14f);
        }, true, false);

    case kMeshCantileverBlock: { // Stepped cantilevered architectural brutalist ziggurat massing!
        addBox(m, {0.0f, 0.0f, 0.0f}, {0.65f, 0.42f, 0.55f}, 0.1f);
        addBox(m, {0.48f, 0.36f, 0.18f}, {0.58f, 0.24f, 0.36f}, 0.2f);
        addBox(m, {-0.42f, -0.28f, -0.22f}, {0.52f, 0.22f, 0.38f}, 0.3f);
        addBox(m, {0.15f, 0.68f, -0.10f}, {0.32f, 0.20f, 0.30f}, 0.4f);
        return m;
    }

    case kMeshXylosMembrane: // Folded hyperbolic Möbius membrane for Xylos
        return buildMobius(0.92f, 0.42f, 0.022f, 56, 1.0f, false);

    case kMeshColossusLobe: { // High-detail organic Mandelbulb/Gyroid displaced mountain lobe for GodColossus!
        CpuMeshData base = buildPolyhedron(4, 0.0f); // 20 * 4^4 = 5,120 triangles!
        for (auto& v : base.vertices) {
            glm::vec3 d = v.pos;
            glm::vec3 p1 = d * 3.4f;
            glm::vec3 p2 = d * 7.8f;
            float g1 = std::sin(p1.x) * std::cos(p1.y) + std::sin(p1.y) * std::cos(p1.z) + std::sin(p1.z) * std::cos(p1.x);
            float g2 = std::sin(p2.x) * std::cos(p2.y) + std::sin(p2.y) * std::cos(p2.z) + std::sin(p2.z) * std::cos(p2.x);
            float n = noise3(d * 5.5f + glm::vec3(1.7f));
            float disp = 0.82f + 0.22f * g1 + 0.09f * g2 + 0.14f * n;
            v.pos = d * disp;
            // Encode rich multi-band thin-film phase into uv.x so GodColossus swirls with 1,000 iridescent hues!
            v.uv = {glm::fract(0.5f + 0.35f * g1 + 0.25f * g2 + 0.4f * n), 0.5f + 0.5f * d.y};
        }
        recomputeSmoothNormals(base);
        return base;
    }

    case kMeshMengerBlock: { // Strictly achromatic 2-iter Menger Sponge perforated monolith block!
        for (int ix = -1; ix <= 1; ++ix)
        for (int iy = -1; iy <= 1; ++iy)
        for (int iz = -1; iz <= 1; ++iz) {
            int zeros = (ix == 0 ? 1 : 0) + (iy == 0 ? 1 : 0) + (iz == 0 ? 1 : 0);
            if (zeros >= 2) continue; // Level-1 Menger cross void!
            for (int jx = -1; jx <= 1; ++jx)
            for (int jy = -1; jy <= 1; ++jy)
            for (int jz = -1; jz <= 1; ++jz) {
                int z2 = (jx == 0 ? 1 : 0) + (jy == 0 ? 1 : 0) + (jz == 0 ? 1 : 0);
                if (z2 >= 2) continue; // Level-2 Menger cross void!
                glm::vec3 ctr = glm::vec3(ix, iy, iz) * (2.0f / 3.0f) + glm::vec3(jx, jy, jz) * (2.0f / 9.0f);
                addBox(m, ctr, glm::vec3(0.98f / 9.0f), 0.5f);
            }
        }
        return m;
    }

    case kMeshFireCone:
    default:
        return buildLathe(14, 24, 0.0f, 1.0f, [](float v, float th) {
            return (0.28f + 0.65f * v) * (1.0f + 0.08f * std::sin(7.0f * th + v * 6.0f));
        });
    }
}

} // namespace cqm2_meshes
