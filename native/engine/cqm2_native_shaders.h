/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once

namespace cqm2_render {

inline const char* kFullscreenVert = R"GLSL(
#version 330 core
out vec2 vUv;
void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
)GLSL";

// Pass 1: Crimson-Burgundy Geodesic Sky Dome + Towering Iridescent Rainbow Mandelbulb GodColossus
inline const char* kSkyColossusFrag = R"GLSL(
#version 330 core
in vec2 vUv;
out vec4 FragColor;

uniform mat4 uInvViewProj;
uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform float uTime;
uniform int uWeather;
uniform float uChaos;

float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

vec3 rainbowIridescence(float t) {
    return 0.52 + 0.48 * cos(6.2831853 * (t + vec3(0.00, 0.33, 0.67)));
}

// Towering Mandelbulb + Quasicrystal Fold SDF centered at (0, 14, -34)
float mapColossus(vec3 p, out float trapOut) {
    vec3 w = (p - vec3(-2.0, 13.5, -34.0)) / 15.5;
    float bound = length(w) - 1.35;
    if (bound > 0.25) {
        trapOut = 0.0;
        return bound * 15.5;
    }
    // Slow majestic rotation
    float ca = cos(uTime * 0.09), sa = sin(uTime * 0.09);
    w.xz = mat2(ca, -sa, sa, ca) * w.xz;

    vec3 z = w;
    float dr = 1.0;
    float r = 0.0;
    float trap = 1e9;
    float pwr = 7.5 + 1.2 * sin(uTime * 0.17);
    for (int i = 0; i < 6; ++i) {
        r = length(z);
        if (r > 2.2) break;
        trap = min(trap, abs(z.y) + 0.35 * abs(sin(z.x * 6.0 + z.z * 6.0)));
        float theta = acos(clamp(z.z / max(r, 1e-5), -1.0, 1.0));
        float phi = atan(z.y, z.x);
        dr = pow(max(r, 1e-4), pwr - 1.0) * pwr * dr + 1.0;
        float zr = pow(r, pwr);
        theta *= pwr;
        phi *= pwr;
        z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + w;
    }
    trapOut = trap;
    return 0.5 * log(max(r, 1.0001)) * r / max(dr, 1.0) * 15.5;
}

vec3 calcColossusNormal(vec3 p) {
    float dummy;
    vec2 e = vec2(0.035, -0.035);
    return normalize(
        e.xyy * mapColossus(p + e.xyy, dummy) +
        e.yyx * mapColossus(p + e.yyx, dummy) +
        e.yxy * mapColossus(p + e.yxy, dummy) +
        e.xxx * mapColossus(p + e.xxx, dummy)
    );
}

vec3 evalSkyDome(vec3 rd) {
    // Deep velvet midnight plum-burgundy dome matching Original CQM (linear pre-ACES space)
    vec3 horizon = vec3(0.015, 0.0014, 0.022);
    vec3 zenith  = vec3(0.006, 0.0006, 0.011);
    vec3 nadir   = vec3(0.004, 0.0009, 0.008);
    vec3 col = rd.y >= 0.0 ? mix(horizon, zenith, pow(rd.y, 0.65)) : mix(horizon, nadir, clamp(-rd.y * 3.0, 0.0, 1.0));

    // Geodesic dome triangle lattice lines projected onto sphere
    vec3 sphereP = normalize(rd) * 14.0;
    vec3 g1 = abs(fract(sphereP * 0.85) - 0.5);
    float diag = abs(fract((sphereP.x + sphereP.y + sphereP.z) * 0.85) - 0.5);
    float wire = min(min(g1.x, g1.y), min(g1.z, diag));
    float lineMask = smoothstep(0.020, 0.002, wire) * smoothstep(-0.15, 0.25, rd.y);
    col += vec3(0.085, 0.012, 0.095) * lineMask * 0.68;

    // Subtle stars & weather aurora
    float st = hash13(floor(rd * 260.0));
    if (st > 0.9965 && rd.y > -0.05) {
        col += vec3(0.55, 0.48, 0.75) * (st - 0.9965) * 95.0;
    }
    if (uWeather == 4) {
        float aur = pow(0.5 + 0.5 * sin(rd.x * 9.0 + uTime * 0.6) * cos(rd.z * 7.0), 4.0);
        col += vec3(0.015, 0.12, 0.09) * aur * max(rd.y, 0.0);
    }
    return col;
}

void main() {
    vec4 ndcNear = vec4(vUv * 2.0 - 1.0, -1.0, 1.0);
    vec4 ndcFar  = vec4(vUv * 2.0 - 1.0,  1.0, 1.0);
    vec4 wNear = uInvViewProj * ndcNear;
    vec4 wFar  = uInvViewProj * ndcFar;
    vec3 ro = uCamPos;
    vec3 rd = normalize(wFar.xyz / wFar.w - wNear.xyz / wNear.w);

    vec3 sky = evalSkyDome(rd);

    // Bounding-sphere pre-check against GodColossus at (-2, 13.5, -34), R = 21.5
    vec3 oc = ro - vec3(-2.0, 13.5, -34.0);
    float b = dot(oc, rd);
    float c = dot(oc, oc) - 21.5 * 21.5;
    float disc = b * b - c;

    if (disc > 0.0) {
        float tStart = max(0.2, -b - sqrt(disc));
        float tEnd   = -b + sqrt(disc);
        float t = tStart;
        float trap = 0.0;
        bool hit = false;
        for (int i = 0; i < 52; ++i) {
            if (t > tEnd) break;
            float d = mapColossus(ro + rd * t, trap);
            if (d < 0.045) {
                hit = true;
                break;
            }
            t += max(d * 0.78, 0.06);
        }
        if (hit) {
            vec3 hp = ro + rd * t;
            vec3 n = calcColossusNormal(hp);
            vec3 lDir = normalize(vec3(0.45, 0.78, 0.42));
            float diff = 0.38 + 0.62 * max(dot(n, lDir), 0.0);
            float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);

            // Multi-band psychedelic thin-film marbling (sole chromatic monolith!)
            float band = trap * 4.2 + dot(hp, vec3(0.26, 0.35, 0.22)) + uTime * 0.08;
            vec3 irid = pow(rainbowIridescence(band), vec3(2.0)) * 0.42
                      + pow(rainbowIridescence(band * 2.9 + 0.22), vec3(2.0)) * 0.30;
            vec3 col = irid * diff + vec3(0.28, 0.22, 0.36) * fres * 0.35;

            vec4 clip = uViewProj * vec4(hp, 1.0);
            float ndcZ = clip.z / clip.w;
            gl_FragDepth = clamp(ndcZ * 0.5 + 0.5, 0.0001, 0.9998);
            FragColor = vec4(col, 1.0);
            return;
        }
    }

    gl_FragDepth = 0.99999;
    FragColor = vec4(sky, 1.0);
}
)GLSL";

// Pass 2: Undulating 256x256 Live Gray-Scott Reaction-Diffusion Petri Floor
inline const char* kFloorVert = R"GLSL(
#version 330 core
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUv;

uniform mat4 uViewProj;
uniform sampler2D uGrayScottTex;
uniform float uTime;

out vec2 vUv;
out vec3 vWorldPos;
out float vChemV;

void main() {
    vec4 gs = texture(uGrayScottTex, aUv);
    float wave = 0.8 * sin(aPos.x * 0.08) * cos(aPos.z * 0.08) + (gs.g - 0.15) * 2.1;
    vec3 wp = vec3(aPos.x, -4.0 + wave, aPos.z);
    vUv = aUv;
    vWorldPos = wp;
    vChemV = gs.g;
    gl_Position = uViewProj * vec4(wp, 1.0);
}
)GLSL";

inline const char* kFloorFrag = R"GLSL(
#version 330 core
in vec2 vUv;
in vec3 vWorldPos;
in float vChemV;
out vec4 FragColor;

uniform sampler2D uGrayScottTex;
uniform float uTime;

void main() {
    vec4 gs = texture(uGrayScottTex, vUv);
    float r = length(vWorldPos.xz);
    if (r > 82.0) discard;

    vec3 deepTeal = vec3(0.006, 0.032, 0.048);
    vec3 bioCyan  = vec3(0.024, 0.165, 0.195);
    vec3 violet   = vec3(0.018, 0.005, 0.028);

    float c = clamp(gs.g * 2.8, 0.0, 1.0);
    vec3 col = mix(mix(violet, deepTeal, clamp(gs.r, 0.0, 1.0)), bioCyan, c);

    // Subtle concentric Petri coordinate rings
    float ring = abs(fract(r * 0.08) - 0.5);
    col += vec3(0.018, 0.085, 0.115) * smoothstep(0.025, 0.0, ring) * 0.45;

    float edgeFade = smoothstep(82.0, 68.0, r);
    FragColor = vec4(col * edgeFade, 1.0);
}
)GLSL";

// Pass 3: Unified Hardware-Instanced 3D Shader (Creatures, Flora, Big Tree, Voxel Greebles, Achromatic Monoliths, Archons)
inline const char* kInstancedVert = R"GLSL(
#version 330 core
layout(location = 0) in vec3 aVertPos;
layout(location = 1) in vec3 aVertNorm;
layout(location = 2) in vec4 aPosScale;   // xyz = world pos, w = uniform scale
layout(location = 3) in vec4 aDirPhase;   // x = yaw/sx, y = sy/meta, z = sz/chiral, w = phase
layout(location = 4) in vec4 aColorType;  // rgb = color, a = typeId

uniform mat4 uViewProj;
uniform float uTime;

out vec3 vNormal;
out vec3 vLocalPos;
out vec3 vWorldPos;
out vec3 vColor;
flat out int vTypeId;
out float vPhase;

void main() {
    int tid = int(aColorType.a + 0.5);
    vTypeId = tid;
    vColor = aColorType.rgb;
    vLocalPos = aVertPos;
    vPhase = aDirPhase.w;

    vec3 p = aVertPos;
    vec3 n = aVertNorm;
    float yaw = aDirPhase.x;

    if (tid == 23) {
        // Floating emerald lampshade / bell frustums (narrow top, flared bottom like user screenshot!)
        float flare = mix(1.35, 0.58, aVertPos.y + 0.5);
        p.x *= aDirPhase.x * flare * aPosScale.w;
        p.z *= aDirPhase.z * flare * aPosScale.w;
        p.y *= aDirPhase.y * aPosScale.w;
        yaw = aDirPhase.w;
    } else if (tid >= 20 && tid <= 25) {
        // Architectural structures use aDirPhase.xyz as non-uniform box/spire scale & aDirPhase.w as yaw
        p *= aDirPhase.xyz * aPosScale.w;
        if (tid == 20 && aDirPhase.y > 6.0) {
            // Taper tall obsidian needle obelisks to razor points!
            float needle = max(0.06, 1.0 - (aVertPos.y + 0.5) * 0.92);
            p.x *= needle;
            p.z *= needle;
        }
        yaw = aDirPhase.w;
    } else if (tid >= 10 && tid <= 12) {
        // AlienFlora stalks: razor-tapered bioluminescent blades that sway in dome breeze
        float uH = aVertPos.y + 0.5;
        float taper = max(0.08, 1.0 - uH * 0.88);
        p.x *= 0.11 * taper * aPosScale.w;
        p.z *= 0.11 * taper * aPosScale.w;
        p.y = uH * aDirPhase.z * aPosScale.w;
        p.x += sin(uTime * 1.8 + aDirPhase.w + p.y * 0.8) * 0.14 * p.y;
    } else if (tid < 10) {
        // Living Phyla & Xenomimics: organic breathing + chiral twist
        float pulse = 1.0 + 0.18 * sin(aDirPhase.w * 2.0 + p.y * 3.0);
        p *= aPosScale.w * pulse;
        p.x *= (1.0 + 0.35 * sin(p.y * 4.0 * aDirPhase.z));
    } else {
        p *= aPosScale.w;
    }

    float cy = cos(yaw), sy = sin(yaw);
    mat2 rotY = mat2(cy, -sy, sy, cy);
    p.xz = rotY * p.xz;
    n.xz = rotY * n.xz;

    vec3 wp = aPosScale.xyz + p;
    vWorldPos = wp;
    vNormal = normalize(n);
    gl_Position = uViewProj * vec4(wp, 1.0);
}
)GLSL";

inline const char* kInstancedFrag = R"GLSL(
#version 330 core
in vec3 vNormal;
in vec3 vLocalPos;
in vec3 vWorldPos;
in vec3 vColor;
flat in int vTypeId;
in float vPhase;

out vec4 FragColor;

uniform vec3 uCamPos;
uniform float uTime;

float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 L = normalize(vec3(0.42, 0.82, 0.38));
    float diff = 0.32 + 0.68 * max(dot(N, L), 0.0);
    float rim  = pow(1.0 - max(dot(N, V), 0.0), 2.5);

    // STRICT MONOLITH-MEGALITH-ART-DIRECTION LAW: type 22 (Monoliths & Stage II Menger Temple) MUST have r == g == b!
    if (vTypeId == 22) {
        float lum = clamp(vColor.r * diff + rim * 0.18, 0.02, 0.92);
        FragColor = vec4(lum, lum, lum, 0.94);
        return;
    }

    // Neon-Patched Voxel Greeble Cubes (type 21 — matches Original CQM screenshot!)
    if (vTypeId == 21) {
        vec3 cell = floor((vLocalPos + 0.55) * 6.0 + vPhase);
        float h = hash31(cell);
        vec3 base = vec3(0.008, 0.005, 0.014) * diff;
        if (h > 0.74) {
            vec3 neon = (h > 0.93) ? vec3(0.55, 0.50, 0.03)
                      : (h > 0.86) ? vec3(0.48, 0.02, 0.18)
                      : (h > 0.80) ? vec3(0.28, 0.01, 0.02)
                                   : vec3(0.04, 0.45, 0.09);
            base = neon * (0.55 + 0.45 * diff);
        }
        FragColor = vec4(base + rim * vec3(0.025, 0.012, 0.04), 1.0);
        return;
    }

    // Translucent cyan/mint vertical light curtains (type 24)
    if (vTypeId == 24) {
        float vFade = 1.0 - abs(vLocalPos.y) * 1.5;
        FragColor = vec4(vColor * (0.75 + 0.25 * sin(uTime * 1.5 + vPhase)), clamp(vFade * 0.46, 0.10, 0.48));
        return;
    }

    // Stippled frosted crystal clouds (type 25) & Eyed Archon Spheres (type 40)
    if (vTypeId == 25) {
        float n = hash31(floor(vWorldPos * 16.0));
        if (n < 0.34) discard;
        FragColor = vec4(vColor * (0.45 + 0.55 * diff) + rim * vec3(0.18, 0.22, 0.30), 0.82);
        return;
    }

    if (vTypeId == 40) {
        // Stippled Archon Godform Sphere with glowing central gaze eye
        float stip = hash31(floor(vWorldPos * 14.0));
        if (stip < 0.22) discard;
        vec3 ln = normalize(vLocalPos);
        float eyeDot = dot(ln, normalize(vec3(0.0, 0.08, 1.0)));
        vec3 col = vColor * 0.28 * diff + rim * vec3(0.15, 0.28, 0.45);
        if (eyeDot > 0.965) col = vec3(0.005, 0.003, 0.01); // pupil
        else if (eyeDot > 0.90) col = vec3(0.65, 0.42, 0.04); // golden iris
        else if (eyeDot > 0.82) col = vec3(0.45, 0.48, 0.58); // sclera
        FragColor = vec4(col, 0.84);
        return;
    }

    vec3 col = vColor * diff + vColor * rim * 0.55;
    FragColor = vec4(col, 1.0);
}
)GLSL";

// Pass 4: Additive Ribbon & Synaptic Connectome Line Shader
inline const char* kLineVert = R"GLSL(
#version 330 core
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aCol;
uniform mat4 uViewProj;
out vec4 vCol;
void main() {
    vCol = aCol;
    gl_Position = uViewProj * vec4(aPos, 1.0);
    gl_PointSize = 1.8;
}
)GLSL";

inline const char* kLineFrag = R"GLSL(
#version 330 core
in vec4 vCol;
out vec4 FragColor;
void main() {
    FragColor = vCol;
}
)GLSL";

// Pass 5: Native Reliquary Filigree SDF + Jolt Physics 5.5 Fracture Raymarcher
inline const char* kReliquaryFrag = R"GLSL(
#version 330 core
out vec4 FragColor;
in vec2 vUv;

uniform vec2  uResolution;
uniform float uTime;
uniform vec3  uCamPos;
uniform vec3  uCamTarget;
uniform float uBass;
const int MAX_BODIES = 48;
uniform int  uNumBodies;
uniform vec4 uBodyPosScale[MAX_BODIES];
uniform vec4 uBodyQuat[MAX_BODIES];
uniform vec4 uBodyMeta[MAX_BODIES];

const float PI = 3.14159265359;

float hash13(vec3 p){
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x){
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i+vec3(0,0,0)),hash13(i+vec3(1,0,0)),f.x),
                   mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),
                   mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; ++i) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdSphere(vec3 p, float r){ return length(p) - r; }
float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdOcta(vec3 p, float s){ p = abs(p); return (p.x + p.y + p.z - s) * 0.57735027; }
vec3 qrot(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec3 qrotInv(vec4 q, vec3 v){ return qrot(vec4(-q.xyz, q.w), v); }

int gSpecId = 0;
float gSpecHue = 0.0;

float specimen(vec3 p, int id, float t){
    float d;
    if (id == 0) {
        float r = length(p);
        vec3 n = p / max(r, 1e-4);
        float spikes = pow(0.5 + 0.5 * cos(atan(n.z, n.x) * 14.0) * sin(acos(clamp(n.y, -1.0, 1.0)) * 12.0), 6.0);
        d = r - (0.55 + spikes * 0.40) - (fbm(p * 8.0) - 0.5) * 0.03;
    } else if (id == 1) {
        float ring = sdTorus(p, vec2(0.6, 0.16));
        float wedge = sdBox(p - vec3(0.0, -0.7, 0.0), vec3(0.22, 0.35, 0.4));
        d = max(ring, -wedge) - (fbm(p * 7.0 + t * 0.05) - 0.5) * 0.02;
    } else if (id == 2) {
        d = sdTorus(p.xzy, vec2(0.55, 0.22)) - 0.04 * cos(atan(p.z, p.x) * 20.0);
    } else if (id == 3) {
        vec3 q = p; q.y *= 0.6;
        d = sdOcta(q, 0.85) - (fbm(p * 7.0) - 0.5) * 0.04;
    } else if (id == 4) {
        float a = sdBox(p, vec3(0.88, 0.16, 0.16));
        vec3 q1 = p; q1.xz = rot(PI / 3.0) * q1.xz;
        vec3 q2 = p; q2.xz = rot(-PI / 3.0) * q2.xz;
        d = min(a, min(sdBox(q1, vec3(0.88, 0.16, 0.16)), sdBox(q2, vec3(0.88, 0.16, 0.16))));
    } else if (id == 5) {
        d = sdSphere(p, 0.78) - (fbm(p * 4.0) - 0.5) * 0.05;
    } else {
        float shell = abs(sdBox(p, vec3(0.7))) - 0.05;
        vec3 g = abs(fract(p * 3.0) - 0.5);
        d = max(shell, -(min(min(g.x, g.y), g.z) / 3.0 - 0.06));
    }
    return d;
}

float mapScene(vec3 p){
    float best = 1e9;
    for (int i = 0; i < MAX_BODIES; ++i) {
        if (i >= uNumBodies) break;
        vec4 ps = uBodyPosScale[i];
        float s = max(ps.w, 0.05);
        vec3 local = qrotInv(uBodyQuat[i], p - ps.xyz) / s;
        int id = int(uBodyMeta[i].x + 0.5);
        float d = specimen(local, id, uTime) * s;
        if (d < best) { best = d; gSpecId = id; gSpecHue = uBodyMeta[i].y; }
    }
    return best;
}

vec3 calcNorm(vec3 p){
    vec2 e = vec2(1.0, -1.0) * 0.0015;
    return normalize(e.xyy * mapScene(p + e.xyy) + e.yyx * mapScene(p + e.yyx) + e.yxy * mapScene(p + e.yxy) + e.xxx * mapScene(p + e.xxx));
}

void main(){
    vec2 uv = (vUv * uResolution - 0.5 * uResolution) / max(uResolution.y, 1.0);
    vec3 ro = vec3(sin(uTime * 0.12) * 14.0, 4.5, cos(uTime * 0.12) * 14.0);
    vec3 fw = normalize(vec3(0.0) - ro);
    vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rt, fw);
    vec3 rd = normalize(fw * 1.65 + rt * uv.x + up * uv.y);

    vec3 bg = vec3(0.04, 0.015, 0.05) * (1.0 - 0.4 * length(uv));
    float t = 0.2;
    bool hit = false;
    for (int i = 0; i < 96; ++i) {
        float d = mapScene(ro + rd * t);
        if (d < 0.002) { hit = true; break; }
        t += d * 0.85;
        if (t > 40.0) break;
    }
    if (!hit) {
        FragColor = vec4(bg, 1.0);
        return;
    }
    vec3 hp = ro + rd * t;
    vec3 n = calcNorm(hp);
    vec3 l1 = normalize(vec3(0.6, 0.8, 0.4));
    float diff = max(dot(n, l1), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    vec3 jewel = mix(vec3(0.46, 0.26, 0.09), vec3(0.28, 0.34, 0.48), fract(gSpecHue * 2.3));
    if (gSpecId == 5) jewel = vec3(0.55, 0.50, 0.60);
    vec3 col = jewel * (0.22 + 1.15 * diff) + vec3(0.95, 0.65, 0.30) * rim * (0.55 + 0.45 * uBass);
    FragColor = vec4(col, 1.0);
}
)GLSL";

// Pass 6: HDR Post-FX (Gravitational Singularity Lensing + 10 Render Modes + ACES Filmic Tone Mapping)
inline const char* kPostFrag = R"GLSL(
#version 330 core
in vec2 vUv;
out vec4 FragColor;

uniform sampler2D uSceneTex;
uniform vec2 uResolution;
uniform float uTime;
uniform int uRenderMode;
uniform int uSingularity;

vec3 acesFilmic(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 d = (uv - vec2(0.5, 0.54)) * vec2(aspect, 1.0);
    float r = length(d);

    // Singularity spacetime deflection
    if (uSingularity > 0 && r > 0.015) {
        float einsteinR = (uSingularity == 2) ? 0.055 : 0.042;
        vec2 swirl = (uSingularity == 2) ? vec2(-d.y, d.x) * (0.0025 / (r + 0.04)) : vec2(0.0);
        uv -= (d / vec2(aspect, 1.0)) * ((einsteinR * einsteinR) / (r * r + 0.008)) + swirl;
        uv = clamp(uv, vec2(0.001), vec2(0.999));
    }

    vec3 col = texture(uSceneTex, uv).rgb * 1.32;

    if (uRenderMode == 1) {
        // Hologram scanlines
        float scan = 0.82 + 0.18 * sin(uv.y * uResolution.y * 1.4 + uTime * 8.0);
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(0.15, 0.92, 0.88) * lum * 1.6, 0.65) * scan;
    } else if (uRenderMode == 2 || uRenderMode == 3) {
        // Edge / X-Ray highlight
        vec2 px = 1.0 / max(uResolution, vec2(1.0));
        vec3 cx = texture(uSceneTex, uv + vec2(px.x, 0.0)).rgb - texture(uSceneTex, uv - vec2(px.x, 0.0)).rgb;
        vec3 cy = texture(uSceneTex, uv + vec2(0.0, px.y)).rgb - texture(uSceneTex, uv - vec2(0.0, px.y)).rgb;
        float edge = length(cx) + length(cy);
        col = (uRenderMode == 2) ? vec3(0.1, 0.95, 0.65) * edge * 3.2 + col * 0.22
                                 : vec3(0.35, 0.75, 1.0) * (edge * 2.5 + dot(col, vec3(0.33)) * 0.6);
    } else if (uRenderMode == 4) {
        // Thermal FLIR
        float t = clamp(dot(col, vec3(0.35, 0.45, 0.20)), 0.0, 1.0);
        col = mix(vec3(0.08, 0.02, 0.28), mix(vec3(0.92, 0.18, 0.12), vec3(1.0, 0.96, 0.35), smoothstep(0.4, 1.0, t)), smoothstep(0.0, 0.6, t));
    } else if (uRenderMode == 5) {
        // Quantum phase interference
        col *= 0.85 + 0.35 * cos(6.28318 * (r * 9.0 - uTime * 0.5) + vec3(0.0, 2.1, 4.2));
    } else if (uRenderMode == 6) {
        // Brutalist Noir
        float g = dot(col, vec3(0.299, 0.587, 0.114));
        col = vec3(pow(clamp(g * 1.25, 0.0, 1.0), 1.35));
    } else if (uRenderMode == 7) {
        // Biolume boost
        col = pow(max(col, vec3(0.0)), vec3(0.85)) * vec3(0.85, 1.22, 1.15);
    }

    col = acesFilmic(col);
    col = pow(col, vec3(1.0 / 2.2));
    FragColor = vec4(col, 1.0);
}
)GLSL";

} // namespace cqm2_render
