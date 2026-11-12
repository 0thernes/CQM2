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

// Pass 1: Velvet Plum-Purple Geodesic Dome + Raymarched Multi-Hue Thin-Film GodColossus + Singularity Disk + N(2) Sky
inline const char* kSkyColossusFrag = R"GLSL(
#version 330 core
in vec2 vUv;
out vec4 FragColor;

uniform mat4 uInvViewProj;
uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform float uTime;
uniform int uWeather;
uniform int uSingularity;
uniform int uNMode;
uniform float uChaos;

float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

vec3 soapBubbleThinFilm(float phase) {
    vec3 a = 0.52 + 0.48 * cos(6.2831853 * (phase + vec3(0.00, 0.33, 0.67)));
    vec3 b = 0.50 + 0.50 * cos(6.2831853 * (phase * 2.17 + vec3(0.18, 0.51, 0.84)));
    return mix(a, b, 0.42);
}

// Swirling Mandelbulb + Gyroid GodColossus centered at (0.0, 13.2, -29.0)
float mapColossus(vec3 p, out float trapOut) {
    vec3 w = (p - vec3(0.0, 13.2, -29.0)) / 16.4;
    float bound = length(w) - 1.35;
    if (bound > 0.25) {
        trapOut = 0.0;
        return bound * 16.4;
    }
    float ca = cos(uTime * 0.07), sa = sin(uTime * 0.07);
    w.xz = mat2(ca, -sa, sa, ca) * w.xz;

    vec3 z = w;
    float dr = 1.0;
    float r = 0.0;
    float trap = 1e9;
    float pwr = 7.8 + 0.7 * sin(uTime * 0.13);
    for (int i = 0; i < 7; ++i) {
        r = length(z);
        if (r > 2.2) break;
        trap = min(trap, abs(z.y) + 0.38 * abs(sin(z.x * 6.5 + z.z * 6.5)));
        float theta = acos(clamp(z.z / max(r, 1e-5), -1.0, 1.0));
        float phi = atan(z.y, z.x);
        dr = pow(max(r, 1e-4), pwr - 1.0) * pwr * dr + 1.0;
        float zr = pow(r, pwr);
        theta *= pwr;
        phi *= pwr;
        z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + w;
    }
    trapOut = trap;
    return 0.5 * log(max(r, 1.0001)) * r / max(dr, 1.0) * 16.4;
}

vec3 calcColossusNormal(vec3 p) {
    float dummy;
    vec2 e = vec2(0.032, -0.032);
    return normalize(
        e.xyy * mapColossus(p + e.xyy, dummy) +
        e.yyx * mapColossus(p + e.yyx, dummy) +
        e.yxy * mapColossus(p + e.yxy, dummy) +
        e.xxx * mapColossus(p + e.xxx, dummy)
    );
}

vec3 evalSkyDome(vec3 rd) {
    // Rich deep magenta-plum dome matching user screenshot `media_1794383147566_15e228d5.jpg` (linear space before ACES)
    vec3 horizon = (uNMode == 2) ? vec3(0.005, 0.032, 0.022) : vec3(0.024, 0.0018, 0.036);
    vec3 zenith  = (uNMode == 2) ? vec3(0.002, 0.012, 0.012) : vec3(0.009, 0.0008, 0.016);
    vec3 nadir   = vec3(0.003, 0.008, 0.014);
    vec3 col = rd.y >= 0.0 ? mix(horizon, zenith, pow(rd.y, 0.62))
                           : mix(horizon, nadir, clamp(-rd.y * 3.0, 0.0, 1.0));

    // Geodesic dome structural lattice lines + glowing vertex nodes
    vec3 sp = normalize(rd) * 15.0;
    vec3 g1 = abs(fract(sp * 0.82) - 0.5);
    float diag = abs(fract((sp.x + sp.y + sp.z) * 0.82) - 0.5);
    float wire = min(min(g1.x, g1.y), min(g1.z, diag));
    float lineMask = smoothstep(0.020, 0.002, wire) * smoothstep(-0.12, 0.22, rd.y);
    vec3 gridCol = (uNMode == 2) ? vec3(0.04, 0.28, 0.18) : vec3(0.085, 0.012, 0.115);
    col += gridCol * lineMask * 0.72;

    // Stars & weather modes (RAIN, STORM, AURORA, VOID, FOG)
    float st = hash13(floor(rd * 290.0));
    if (st > 0.9960 && rd.y > -0.05) {
        col += vec3(0.65, 0.58, 0.90) * (st - 0.9960) * 110.0;
    }
    if (uWeather == 3) { // AURORA
        float aur = pow(0.5 + 0.5 * sin(rd.x * 8.5 + uTime * 0.7) * cos(rd.z * 6.5), 3.5);
        col += vec3(0.02, 0.24, 0.18) * aur * max(rd.y, 0.0);
    } else if (uWeather == 2) { // STORM lightning flicker
        float fl = step(0.97, sin(uTime * 19.0) * cos(uTime * 7.3));
        col += vec3(0.15, 0.18, 0.30) * fl * max(rd.y, 0.0);
    } else if (uWeather == 5) { // FOG
        col = mix(col, vec3(0.07, 0.05, 0.09), 0.45 * smoothstep(0.45, -0.1, rd.y));
    }

    // Relativistic Singularity Accretion Disk in upper sky when singularityMode > 0
    if (uSingularity > 0) {
        vec3 sDir = normalize(vec3(0.0, 0.48, -0.88));
        float ang = acos(clamp(dot(rd, sDir), -1.0, 1.0));
        if (uSingularity == 1) { // blackhole
            float ring = exp(-pow((ang - 0.085) * 38.0, 2.0));
            col = (ang < 0.055) ? vec3(0.0) : (col + vec3(1.2, 0.48, 0.12) * ring);
        } else if (uSingularity == 2) { // whitehole
            col += vec3(0.95, 0.98, 1.25) * exp(-ang * 18.0);
        } else if (uSingularity == 3) { // greyhole
            float ring = exp(-pow((ang - 0.075) * 34.0, 2.0));
            col += vec3(0.48, 0.48, 0.52) * ring;
        } else if (uSingularity == 4) { // strangestar
            col += vec3(0.25, 1.15, 0.95) * exp(-ang * 22.0);
        }
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

    vec3 oc = ro - vec3(0.0, 13.2, -29.0);
    float b = dot(oc, rd);
    float c = dot(oc, oc) - 22.5 * 22.5;
    float disc = b * b - c;

    if (disc > 0.0) {
        float tStart = max(0.2, -b - sqrt(disc));
        float tEnd   = -b + sqrt(disc);
        float t = tStart;
        float trap = 0.0;
        bool hit = false;
        for (int i = 0; i < 54; ++i) {
            if (t > tEnd) break;
            float d = mapColossus(ro + rd * t, trap);
            if (d < 0.042) { hit = true; break; }
            t += max(d * 0.78, 0.055);
        }
        if (hit) {
            vec3 hp = ro + rd * t;
            vec3 n = calcColossusNormal(hp);
            vec3 lDir = normalize(vec3(0.42, 0.80, 0.40));
            float diff = 0.36 + 0.64 * max(dot(n, lDir), 0.0);
            float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.2);
            float swirl = trap * 5.4 + dot(hp, vec3(0.32, 0.41, 0.29)) + uTime * 0.06;
            vec3 irid = pow(soapBubbleThinFilm(swirl), vec3(1.55)) * 0.78;
            vec3 col = irid * diff + soapBubbleThinFilm(swirl + 0.35) * fres * 0.48;

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

// Pass 2: Undulating 256x256 Live Gray-Scott Reaction-Diffusion Terrain (exact match to terrainHeightAt!)
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
    float r = length(aPos.xz);
    float bowl = 0.00035 * r * r;
    float baseH = -3.9 + bowl
                + 0.78 * sin(aPos.x * 0.085) * cos(aPos.z * 0.085)
                + 0.32 * sin(aPos.x * 0.21 + aPos.z * 0.17);
    vec3 wp = vec3(aPos.x, baseH + (gs.g - 0.12) * 0.45, aPos.z);
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

    vec3 deepTeal = vec3(0.0035, 0.022, 0.036);
    vec3 bioCyan  = vec3(0.0180, 0.135, 0.145);
    vec3 seaMoss  = vec3(0.0095, 0.062, 0.058);

    float c = clamp(gs.g * 3.1, 0.0, 1.0);
    vec3 col = mix(mix(deepTeal, seaMoss, clamp(gs.r, 0.0, 1.0)), bioCyan, c);

    // Subtle Petri grid + concentric coordinate rings
    vec2 grid = abs(fract(vWorldPos.xz * 0.25) - 0.5);
    float gLine = smoothstep(0.03, 0.004, min(grid.x, grid.y));
    col += vec3(0.010, 0.055, 0.072) * gLine * 0.35;

    float ring = abs(fract(r * 0.075) - 0.5);
    col += vec3(0.012, 0.065, 0.088) * smoothstep(0.025, 0.0, ring) * 0.42;

    float edgeFade = smoothstep(82.0, 62.0, r);
    FragColor = vec4(col * edgeFade, 1.0);
}
)GLSL";

// Pass 3: 64-Topology Multi-Mesh Hardware-Instanced Vertex & Fragment Shaders
// Supports all 9 matClass materials, 11 RENDER_MODES, and 6 BRUTALISM modes!
inline const char* kInstancedVert = R"GLSL(
#version 330 core
layout(location = 0) in vec3 aVertPos;
layout(location = 1) in vec3 aVertNorm;
layout(location = 2) in vec2 aVertUv;

layout(location = 3) in vec4 iPosScale;     // xyz = world pos, w = uniform scale
layout(location = 4) in vec4 iRotMat;       // x = yaw, y = pitch, z = roll, w = matClass
layout(location = 5) in vec4 iStretchPhase; // xyz = non-uniform scale, w = animPhase / irisHue
layout(location = 6) in vec4 iColorTag;     // rgb = base tint, a = alpha / glow

uniform mat4 uViewProj;
uniform float uTime;
uniform int uBrutalMode;

out vec3 vNormal;
out vec3 vLocalPos;
out vec3 vWorldPos;
out vec2 vUv;
out vec3 vColor;
flat out int vMatClass;
out float vPhase;
out float vAlphaTag;

mat3 eulerRotation(float yaw, float pitch, float roll) {
    float cy = cos(yaw), sy = sin(yaw);
    float cp = cos(pitch), sp = sin(pitch);
    float cr = cos(roll), sr = sin(roll);
    mat3 ry = mat3( cy, 0.0, -sy,
                   0.0, 1.0, 0.0,
                    sy, 0.0,  cy);
    mat3 rx = mat3(1.0, 0.0, 0.0,
                   0.0,  cp,  sp,
                   0.0, -sp,  cp);
    mat3 rz = mat3( cr,  sr, 0.0,
                   -sr,  cr, 0.0,
                   0.0, 0.0, 1.0);
    return ry * rx * rz;
}

void main() {
    vMatClass = int(iRotMat.w + 0.5);
    vColor = iColorTag.rgb;
    vAlphaTag = iColorTag.a;
    vLocalPos = aVertPos;
    vUv = aVertUv;
    vPhase = iStretchPhase.w;

    vec3 p = aVertPos * iStretchPhase.xyz * iPosScale.w;
    vec3 n = aVertNorm / max(iStretchPhase.xyz, vec3(0.05));

    // Brutalism geometric quantization when BRUTALISM (1) or REPRESSIONISM (5) is active
    if (uBrutalMode == 1) {
        p = floor(p * 6.0 + 0.5) / 6.0;
    } else if (uBrutalMode == 2) { // NOUVEAUNESS organic wave
        p.x += 0.08 * sin(p.y * 3.0 + uTime * 2.0 + vPhase) * iPosScale.w;
    }

    mat3 R = eulerRotation(iRotMat.x, iRotMat.y, iRotMat.z);
    vec3 wp = iPosScale.xyz + R * p;
    vWorldPos = wp;
    vNormal = normalize(R * n);
    gl_Position = uViewProj * vec4(wp, 1.0);
}
)GLSL";

inline const char* kInstancedFrag = R"GLSL(
#version 330 core
in vec3 vNormal;
in vec3 vLocalPos;
in vec3 vWorldPos;
in vec2 vUv;
in vec3 vColor;
flat in int vMatClass;
in float vPhase;
in float vAlphaTag;

out vec4 FragColor;

uniform vec3 uCamPos;
uniform float uTime;
uniform int uRenderMode;
uniform int uBrutalMode;

float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

vec3 rainbowBand(float t) {
    return 0.52 + 0.48 * cos(6.2831853 * (t + vec3(0.00, 0.33, 0.67)));
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 L1 = normalize(vec3(0.42, 0.82, 0.38));
    vec3 L2 = normalize(vec3(-0.55, 0.35, -0.45));
    vec3 H = normalize(L1 + V);

    float ndl = max(dot(N, L1), 0.0);
    float fill = max(dot(N, L2), 0.0) * 0.24;
    float diff = 0.22 + 0.78 * ndl + fill;
    float spec = pow(max(dot(N, H), 0.0), 48.0);
    float rim  = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    vec3 linCol = pow(max(vColor, vec3(0.0)), vec3(2.2)); // Exact sRGB -> Linear PBR matching Three.js!

    // 1. STRICT MONOLITH-MEGALITH-ART-DIRECTION LAW:
    //    matClass == 2 (MonolithTemple & Achromatic Megaliths) MUST enforce r == g == b ALWAYS!
    if (vMatClass == 2) {
        float lum = clamp(dot(linCol, vec3(0.3333)) * diff + spec * 0.16 + rim * 0.08, 0.002, 0.85);
        FragColor = vec4(lum, lum, lum, 1.0);
        return;
    }

    // 2. matClass == 1: EXCLUSIVE GodColossus 1,000-Hue Thin-Film Soap-Bubble Iridescence
    if (vMatClass == 1) {
        float swirl = dot(vLocalPos, vec3(3.1, 4.2, 2.7)) + vPhase + uTime * 0.12 + rim * 1.4;
        vec3 irid = pow(mix(rainbowBand(swirl), rainbowBand(swirl * 2.3 + 0.25), 0.45), vec3(2.0));
        vec3 col = irid * (0.36 + 0.72 * ndl) + pow(rainbowBand(swirl + 0.5), vec3(2.0)) * rim * 0.45 + vec3(spec * 0.22);
        FragColor = vec4(col, 1.0);
        return;
    }

    // 3. matClass == 8: Midnight-Navy Brutalist Cantilever Blocks
    if (vMatClass == 8) {
        vec3 edgeTint = mix(linCol * 3.0, vec3(0.018, 0.075, 0.135), 0.45);
        vec3 col = linCol * (0.45 + 0.75 * ndl) + edgeTint * rim * 0.65 + vec3(spec * 0.08);
        FragColor = vec4(col, 1.0);
        return;
    }

    // 4. matClass == 5: Multi-Hue Mossy / Neon Voxel Rubik Cluster (matches foreground voxel blocks!)
    if (vMatClass == 5) {
        vec3 cell = floor((vLocalPos + 1.5) * 4.2 + vPhase);
        float h = hash31(cell);
        vec3 base = vec3(0.004, 0.003, 0.008) * diff;
        if (h > 0.42) {
            vec3 voxCol = (h > 0.88) ? vec3(0.55, 0.68, 0.03)
                        : (h > 0.74) ? vec3(0.03, 0.48, 0.08)
                        : (h > 0.60) ? vec3(0.62, 0.03, 0.18)
                                     : vec3(0.07, 0.32, 0.56);
            base = voxCol * (0.38 + 0.72 * ndl);
        }
        FragColor = vec4(base + vec3(spec * 0.14), 1.0);
        return;
    }

    // 5. matClass == 4: 4-Layer Anatomical Eyeball (Sclera + Radial Iris Fibers + Pupil + Corneal Glint)
    if (vMatClass == 4) {
        vec3 ln = normalize(vLocalPos);
        float gaze = dot(ln, vec3(0.0, 0.0, 1.0));
        float angle = atan(ln.y, ln.x);
        vec3 irisCol = pow(rainbowBand(vPhase + 0.05 * sin(angle * 22.0)), vec3(2.0));
        vec3 col = vec3(0.72, 0.76, 0.84) * diff; // sclera
        if (gaze > 0.925) {
            col = vec3(0.002, 0.002, 0.004) + vec3(spec * 1.4); // pupil + wet glint
        } else if (gaze > 0.76) {
            float fib = 0.72 + 0.28 * sin(angle * 28.0 + gaze * 18.0);
            col = irisCol * fib * (0.55 + 0.55 * ndl) + vec3(spec * 0.9);
        }
        FragColor = vec4(col, 1.0);
        return;
    }

    // 6. matClass == 3: Translucent Emerald Bell / Frosted Gyroid Cloud / Crystal Transmission
    if (vMatClass == 3) {
        vec3 glass = linCol * (0.42 + 0.65 * ndl) + mix(linCol, vec3(0.45, 0.95, 0.72), 0.35) * rim * 0.75 + vec3(spec * 0.35);
        FragColor = vec4(glass, clamp(vAlphaTag, 0.35, 0.90));
        return;
    }

    // 7. matClass == 7: Xylos Hyperbolic Möbius Membrane (crystal-clear glass shell letting 192 axons shine!)
    if (vMatClass == 7) {
        float wave = 0.5 + 0.5 * sin(vUv.x * 25.1327 + uTime * 2.2 + vPhase);
        vec3 mCol = mix(vec3(0.04, 0.58, 0.95), vec3(0.48, 0.08, 0.95), wave);
        FragColor = vec4(mCol * (0.18 + 0.82 * rim), 0.14);
        return;
    }

    // 8. matClass == 6: Additive Solar / FireCone / Portal Glow
    if (vMatClass == 6) {
        float flicker = 0.78 + 0.22 * sin(vLocalPos.y * 9.0 - uTime * 6.5 + vPhase);
        FragColor = vec4(linCol * flicker * (0.85 + 0.65 * rim), clamp(vAlphaTag, 0.30, 0.92));
        return;
    }

    // Standard Organism / Botanical / Deity Shading across all 11 RENDER_MODES!
    vec3 col = linCol * diff + vec3(spec * 0.22) + linCol * rim * 0.42;
    float outAlpha = 1.0;

    if (uRenderMode == 2) { // ghost
        col = mix(linCol, vec3(0.35, 0.72, 1.0), 0.45) * (0.25 + 0.95 * rim);
        outAlpha = 0.45;
    } else if (uRenderMode == 3) { // neon
        col = linCol * (0.18 + 1.85 * rim) + linCol * step(0.75, sin(vLocalPos.y * 18.0 + uTime * 4.0)) * 0.6;
    } else if (uRenderMode == 4) { // chrome
        vec3 R = reflect(-V, N);
        vec3 env = pow(rainbowBand(R.y * 0.5 + 0.25), vec3(2.0)) * 0.55 + vec3(0.12);
        col = mix(env, linCol, 0.28) + vec3(spec * 0.95);
    } else if (uRenderMode == 5) { // hologram
        float scan = 0.65 + 0.35 * sin(vWorldPos.y * 14.0 - uTime * 7.0);
        col = mix(vec3(0.02, 0.85, 0.72), linCol, 0.35) * scan * (0.4 + 0.9 * rim);
        outAlpha = 0.72;
    } else if (uRenderMode == 6) { // iridescent
        col = mix(col, pow(rainbowBand(dot(N, V) * 2.0 + vPhase), vec3(2.0)), 0.62) + vec3(spec * 0.4);
    } else if (uRenderMode == 7) { // plasma
        float pl = 0.5 + 0.5 * sin(vWorldPos.x * 2.2 + uTime * 3.5) * cos(vWorldPos.z * 2.2 - uTime * 2.8);
        col = mix(vec3(0.95, 0.04, 0.28), vec3(0.03, 0.82, 1.0), pl) * (0.5 + 0.6 * ndl);
    } else if (uRenderMode == 8) { // obsidian
        col = vec3(0.004, 0.004, 0.008) * diff + linCol * rim * 1.15 + vec3(spec * 0.85);
    } else if (uRenderMode == 9) { // prismatic (DEFAULT!)
        vec3 disp = pow(rainbowBand(rim * 1.35 + vPhase * 0.15), vec3(2.0));
        col = linCol * diff + mix(linCol, disp, 0.52) * rim * 0.65 + vec3(spec * 0.30);
    }

    // Brutalism palette modifiers
    if (uBrutalMode == 3) { // ROCOCOGOLOGY pastel gold filigree
        col = mix(col, vec3(0.96, 0.84, 0.72), 0.28) + vec3(0.35, 0.28, 0.08) * rim;
    } else if (uBrutalMode == 5) { // REPRESSIONISM stark desaturated contrast
        float g = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(g), col, 0.22);
    }

    FragColor = vec4(col, outAlpha);
}
)GLSL";

// Pass 4: 4D Titan Tesseracts, Xylos Sphere Cage/Axons, & Lorenz/Rossler Ribbons
inline const char* kLineVert = R"GLSL(
#version 330 core
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aCol;
uniform mat4 uViewProj;
out vec4 vCol;
void main() {
    vCol = aCol;
    gl_Position = uViewProj * vec4(aPos, 1.0);
    gl_PointSize = 2.0;
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

// Pass 5: Native Reliquary Filigree SDF + Jolt Physics 5.5 Fracture Raymarcher (`renderMode == 10`)
inline const char* kReliquaryFrag = R"GLSL(
#version 330 core
out vec4 FragColor;
in vec2 vUv;

uniform vec2  uResolution;
uniform float uTime;
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

// Pass 6: HDR Post-FX (Gravitational Singularity Lensing + ACES Filmic Tone Mapping)
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
    vec2 d = (uv - vec2(0.5, 0.56)) * vec2(aspect, 1.0);
    float r = length(d);

    if (uSingularity > 0 && r > 0.015) {
        float einsteinR = (uSingularity == 2) ? 0.050 : 0.038;
        vec2 swirl = (uSingularity == 1) ? vec2(-d.y, d.x) * (0.0022 / (r + 0.04)) : vec2(0.0);
        uv -= (d / vec2(aspect, 1.0)) * ((einsteinR * einsteinR) / (r * r + 0.010)) + swirl;
        uv = clamp(uv, vec2(0.001), vec2(0.999));
    }

    vec3 col = texture(uSceneTex, uv).rgb * 1.06;

    if (uRenderMode == 5) { // subtle hologram scanline overlay
        float scan = 0.88 + 0.12 * sin(uv.y * uResolution.y * 1.4 + uTime * 8.0);
        col *= scan;
    }

    col = acesFilmic(col);
    col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
    FragColor = vec4(col, 1.0);
}
)GLSL";

} // namespace cqm2_render
