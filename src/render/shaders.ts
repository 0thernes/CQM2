/**
 * CQM2 v2.2.0 — Custom Relativistic, Prismatic God-Colossus, Bioluminescent Terrain, Alien Flora & Chromatophore GLSL Shaders (`src/render/shaders.ts`).
 * Enforces WCAG 2.3.1 photosensitive safety (`uPulseHz <= 2.2 Hz`) and Lipschitz manifold clamping.
 */

export const KERR_SINGULARITY_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Spinning Kerr Black Hole with Bardeen asymmetric D-shadow, prograde frame-dragging shift ($a/M$),
 * multi-order $n=0,1,2$ photon subrings, and $I_{\text{obs}} = g^4 I_{\text{em}}$ Doppler beaming.
 */
export const KERR_SINGULARITY_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSpinA;
uniform float uPulseHz;
uniform vec3 uTintHot;
uniform vec3 uTintWarm;

void main() {
  vec2 p = (vUv - 0.5) * 2.4;
  float spin = clamp(uSpinA, 0.0, 0.998);
  float shift = 0.15 * spin;
  vec2 q = vec2(p.x - shift, p.y);
  float r = length(q);
  float angle = atan(q.y, q.x);

  float dFlatten = 1.0 - 0.11 * spin * max(0.0, -cos(angle));
  float rCrit = 0.42 * dFlatten * (1.0 - 0.06 * spin * cos(angle));
  if (r > 1.18) {
    discard;
  }

  float beta = 0.48 + 0.16 * spin;
  float betaLos = beta * cos(angle + 0.35);
  float gFactor = sqrt(max(0.08, 1.0 - beta * beta)) / max(0.32, 1.0 - betaLos);
  float g4 = clamp(pow(gFactor, 4.0), 0.12, 4.8);

  float dr = abs(r - rCrit);
  float n0Disk = smoothstep(0.38, 0.02, abs(r - (rCrit + 0.16))) * smoothstep(rCrit - 0.02, rCrit + 0.03, r);
  float n1Ring = exp(-dr * 48.0) * 1.35;
  float n2Ring = exp(-abs(r - (rCrit + 0.012)) * 140.0) * 0.85;

  float safeHz = clamp(uPulseHz, 0.1, 2.2);
  float swirl = 0.88 + 0.12 * sin(angle * 3.0 - uTime * 6.28318 * safeHz * 0.5 + log(max(0.05, r)) * 6.0);

  float shadowMask = smoothstep(rCrit - 0.015, rCrit + 0.012, r);
  float intensity = shadowMask * (n0Disk * 0.72 * swirl + n1Ring + n2Ring) * g4;

  vec3 col = mix(uTintWarm, uTintHot, clamp((gFactor - 0.75) * 1.4, 0.0, 1.0)) * intensity;
  float alpha = clamp(intensity * 0.92 + (1.0 - shadowMask) * step(r, rCrit), 0.0, 0.98);
  gl_FragColor = vec4(col, alpha);
}
`;

export const MANIFOLD_GRID_VERTEX_SHADER = /* glsl */ `
varying vec2 vWorldXz;
varying float vWarpDepth;
uniform float uWarpGain;
uniform float uTime;

void main() {
  vec3 pos = position;
  float r2 = dot(pos.xz, pos.xz);
  float safeGain = clamp(uWarpGain, 0.0, 0.45);
  float well = -safeGain * 18.0 / sqrt(r2 * 0.002 + 24.0);
  float ripple = safeGain * 1.1 * sin(sqrt(r2) * 0.035 - uTime * 0.9);
  pos.y += well + ripple;
  vWorldXz = pos.xz;
  vWarpDepth = -well;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const MANIFOLD_GRID_FRAGMENT_SHADER = /* glsl */ `
precision mediump float;
varying vec2 vWorldXz;
varying float vWarpDepth;

void main() {
  vec2 grid = abs(fract(vWorldXz * 0.035 - 0.5) - 0.5) / fwidth(vWorldXz * 0.035);
  float line = min(grid.x, grid.y);
  float gridAlpha = 1.0 - min(line, 1.0);

  float radialFade = smoothstep(820.0, 120.0, length(vWorldXz));
  vec3 baseCol = mix(vec3(0.32, 0.10, 0.48), vec3(0.18, 0.85, 0.98), clamp(vWarpDepth * 0.12, 0.0, 1.0));
  float alpha = gridAlpha * radialFade * 0.34;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(baseCol, alpha);
}
`;

export const CHROMATOPHORE_SKIN_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;

void main() {
  vUv = uv;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPos.xyz);
  gl_Position = projectionMatrix * mvPos;
}
`;

export const CHROMATOPHORE_SKIN_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
uniform sampler2D uSkinField;
uniform float uTime;
uniform float uPulseHz;
uniform float uConfidence;

void main() {
  vec4 uvSample = texture2D(uSkinField, fract(vUv * 1.5));
  float uConc = uvSample.r;
  float vConc = uvSample.g;

  float ndotv = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 2.6);

  float safeHz = clamp(uPulseHz, 0.1, 2.2);
  float breathe = 0.90 + 0.10 * sin(uTime * 6.28318 * safeHz * 0.45);

  vec3 abyssalBase = vec3(0.08, 0.24, 0.42);
  vec3 cyanBiolum = vec3(0.14, 0.88, 0.98);
  vec3 violetChromatophore = vec3(0.84, 0.36, 0.99);
  vec3 goldIridescence = vec3(0.99, 0.78, 0.22);

  float pattern = clamp(vConc * 2.8 + (1.0 - uConc) * 0.35, 0.0, 1.0);
  vec3 skin = mix(abyssalBase, cyanBiolum, pattern);
  skin = mix(skin, violetChromatophore, clamp(vConc * 2.1 * uConfidence, 0.0, 0.85));
  skin += goldIridescence * fresnel * (0.45 + 0.45 * uConfidence);

  gl_FragColor = vec4(skin * breathe, 1.0);
}
`;

/**
 * Inverted Cosmic Violet-Plum-Oxblood Sky Dome with subtle volumetric coordinate lattice & Aurora/Brutalist crossfade.
 */
export const COSMIC_SKY_DOME_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vWorldDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const COSMIC_SKY_DOME_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec3 vWorldDir;
uniform float uTime;
uniform float uChaos;
uniform float uBrutalFade;
uniform float uNightmare;
uniform float uAurora;

void main() {
  vec3 d = normalize(vWorldDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);

  // Iconic CQM deep cosmic plum-magenta-indigo sky palette
  vec3 nadir = vec3(0.05, 0.01, 0.09);
  vec3 horizon = mix(vec3(0.24, 0.04, 0.31), vec3(0.42, 0.05, 0.22), uNightmare);
  vec3 midSky = mix(vec3(0.16, 0.03, 0.24), vec3(0.28, 0.03, 0.20), uNightmare);
  vec3 zenith = vec3(0.07, 0.015, 0.14);

  vec3 sky = mix(nadir, horizon, smoothstep(0.32, 0.50, h));
  sky = mix(sky, midSky, smoothstep(0.48, 0.72, h));
  sky = mix(sky, zenith, smoothstep(0.70, 0.98, h));

  // Subtle magenta-violet celestial coordinate grid lines overhead
  float lon = atan(d.z, d.x) * 9.5493; // 30 sectors
  float lat = asin(clamp(d.y, -1.0, 1.0)) * 7.6394;
  float gx = smoothstep(0.955, 0.995, cos(lon * 3.14159));
  float gy = smoothstep(0.955, 0.995, cos(lat * 3.14159));
  float gridMask = max(gx, gy) * smoothstep(-0.05, 0.25, d.y);
  sky += vec3(0.46, 0.14, 0.62) * gridMask * (0.28 + 0.18 * clamp(uChaos, 0.0, 1.0));

  // Optional Aurora borealis ribbon
  if (uAurora > 0.01 && d.y > 0.05) {
    float wave = sin(d.x * 9.0 + uTime * 0.45 + sin(d.z * 6.0 - uTime * 0.3) * 2.0);
    float band = exp(-abs(wave) * 4.5) * smoothstep(0.05, 0.45, d.y) * smoothstep(0.92, 0.45, d.y);
    sky += vec3(0.08, 0.92, 0.74) * band * uAurora * 0.42;
  }

  // Brutalist overcast concrete crossfade
  vec3 brutalSky = mix(vec3(0.16, 0.16, 0.18), vec3(0.28, 0.28, 0.31), h);
  sky = mix(sky, brutalSky, clamp(uBrutalFade, 0.0, 1.0));

  gl_FragColor = vec4(sky, 1.0);
}
`;

/**
 * Giant Center-Sky `GodColossus` Billowing Brain-Coral / Quasicrystal Prismatic Contour Sculpture.
 * Uses seamless world-space domain-warped gyroid folding + high-frequency thin-film rainbow contour bands
 * (`0.5 + 0.5 * cos(2*pi*(t + rgb))`) across all organic cumulus lobes at 4K 60+ FPS!
 */
export const GOD_COLOSSUS_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
uniform float uTime;
uniform float uChaos;
uniform float uEntropy;

float gyroid(vec3 p) {
  return sin(p.x) * cos(p.y) + sin(p.y) * cos(p.z) + sin(p.z) * cos(p.x);
}

vec3 evalBillow(vec3 localPos, vec3 worldCenter) {
  vec3 nDir = normalize(localPos);
  vec3 wp = worldCenter + localPos;
  float t = uTime * 0.12;
  float c = clamp(uChaos, 0.0, 1.6) * 0.25;

  // Smooth organic cumulus / brain-coral billowing folds (zero sharp spikes!)
  float g1 = gyroid(wp * 0.022 + vec3(t * 0.45, -t * 0.30, t * 0.22));
  float g2 = gyroid(wp * 0.048 - vec3(g1 * 0.55, t * 0.40, g1 * 0.45));
  float g3 = gyroid(wp * 0.095 + vec3(g2 * 0.40, -t * 0.25, g1 * 0.35));

  // Soft rounded cauliflower pillows via abs/smooth billows
  float pillow1 = 1.0 - abs(g1) * 0.42;
  float pillow2 = 1.0 - abs(g2) * 0.28;
  float disp = (pillow1 - 0.68) * 0.34 + (pillow2 - 0.78) * 0.20 + g3 * 0.045;
  disp *= (1.0 + 0.22 * c) * (1.0 - 0.18 * clamp(uEntropy, 0.0, 1.0));

  float radius = length(localPos);
  return nDir * (radius * (1.0 + clamp(disp, -0.24, 0.32)));
}

void main() {
  vec3 worldCenter = modelMatrix[3].xyz;
  vec3 p0 = evalBillow(position, worldCenter);

  vec3 upRef = abs(normal.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tang = normalize(cross(upRef, normal));
  vec3 bitang = normalize(cross(normal, tang));
  float eps = max(0.8, length(position) * 0.024);
  vec3 px = evalBillow(position + tang * eps, worldCenter);
  vec3 py = evalBillow(position + bitang * eps, worldCenter);
  vec3 dNorm = normalize(cross(px - p0, py - p0));
  if (dot(dNorm, normal) < 0.0) dNorm = -dNorm;

  vec4 wPos = modelMatrix * vec4(p0, 1.0);
  vWorldPos = wPos.xyz;
  vec4 mvPos = viewMatrix * wPos;
  vWorldNormal = normalize(normalMatrix * dNorm);
  vViewDir = normalize(-mvPos.xyz);
  gl_Position = projectionMatrix * mvPos;
}
`;

export const GOD_COLOSSUS_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
uniform float uTime;
uniform float uChaos;
uniform float uEntropy;
uniform float uBrutalFade;

vec3 iqPalette(float t) {
  return 0.56 + 0.50 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

float gyroidF(vec3 p) {
  return sin(p.x) * cos(p.y) + sin(p.y) * cos(p.z) + sin(p.z) * cos(p.x);
}

void main() {
  vec3 nrm = normalize(vWorldNormal);
  vec3 vd = normalize(vViewDir);
  // Continuous world-space coordinate centered on GodColossus so all lobes share seamless fine marbling!
  vec3 p = (vWorldPos - vec3(-8.0, 142.0, -185.0)) * 0.036;

  vec3 z = p;
  float trapA = 10.0;
  float trapB = 10.0;
  float acc = 0.0;
  for (int i = 0; i < 4; i++) {
    float g = gyroidF(z * (1.52 + float(i) * 0.62) + vec3(uTime * 0.06, -uTime * 0.045, float(i) * 1.1));
    z = z * 1.32 + vec3(sin(z.y * 2.05 + g), cos(z.z * 2.05 - g), sin(z.x * 2.05 + g)) * 0.42;
    trapA = min(trapA, abs(g));
    trapB = min(trapB, length(fract(z * 0.5) - 0.5));
    acc += g * (0.52 / float(i + 1));
  }

  float ci = trapA * 2.5 + trapB * 3.2 + acc * 1.45 + uTime * 0.04 + uEntropy * 0.5;
  vec3 col = mix(iqPalette(ci), iqPalette(ci * 1.9 + 0.22 + acc * 0.65), 0.52);

  // High-frequency oil-slick topographic interference bands (lime, magenta, cyan, gold, violet)
  col = mix(col, iqPalette(ci * 6.4 + dot(nrm, vd) * 1.8 + uTime * 0.10), 0.44);

  float diff = max(dot(nrm, normalize(vec3(0.38, 0.78, 0.48))), 0.0);
  float fres = pow(1.0 - clamp(dot(nrm, vd), 0.0, 1.0), 2.5);
  float creviceAo = clamp(0.68 + 0.32 * smoothstep(0.0, 0.52, trapA + trapB * 0.5), 0.58, 1.0);

  col = col * (0.78 + 0.44 * diff) * creviceAo + fres * iqPalette(uTime * 0.06 + ci) * 0.58;

  // Crisp topographic contour hairlines for unmistakable CQM marbled brain-coral definition
  float contour = smoothstep(0.07, 0.30, abs(sin(ci * 24.0)));
  col *= (0.74 + 0.30 * contour);

  if (uBrutalFade > 0.01) {
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(luma * 0.92 + 0.06), clamp(uBrutalFade, 0.0, 1.0));
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Undulating Bioluminescent Alien Terrain with Teal-Cyan Seabed Ripples, Mycelial Veins & Gray-Scott RD Field.
 */
export const TERRAIN_BIOLUM_VERTEX_SHADER = /* glsl */ `
varying vec2 vWorldXz;
varying vec2 vUv;
varying float vElev;
uniform float uTime;
uniform float uChaos;

float terrainH(vec2 xz) {
  float h = sin(xz.x * 0.012) * cos(xz.y * 0.010) * 8.5;
  h += sin((xz.x * 0.04 - xz.y * 0.03)) * 2.8;
  h += cos(xz.x * 0.024 + xz.y * 0.028 + uTime * 0.08) * (1.2 + 1.8 * clamp(uChaos, 0.0, 1.5));
  return h;
}

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  float h = terrainH(worldPos.xz);
  worldPos.y += h;
  vWorldXz = worldPos.xz;
  vElev = h;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const TERRAIN_BIOLUM_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vWorldXz;
varying vec2 vUv;
varying float vElev;
uniform sampler2D uRdTex;
uniform float uTime;
uniform float uBrutalFade;

void main() {
  vec2 p = vWorldXz * 0.032;
  vec4 rd = texture2D(uRdTex, fract(vWorldXz * 0.0035 + 0.5));

  // Luminous CQM abyssal teal-seafoam-indigo undulating floor
  float elev01 = clamp((vElev + 11.0) / 22.0, 0.0, 1.0);
  vec3 basin = vec3(0.05, 0.14, 0.24);
  vec3 ridge = vec3(0.12, 0.34, 0.42);
  vec3 col = mix(basin, ridge, elev01);

  // Subtle topographic elevation rings & mycelial veins
  float topo = exp(-abs(fract(vElev * 0.38) - 0.5) * 16.0);
  float v1 = abs(sin(p.x * 2.1 + sin(p.y * 1.8 + uTime * 0.10) * 1.5));
  float v2 = abs(cos(p.y * 2.5 - cos(p.x * 1.9 - uTime * 0.08) * 1.4));
  float mycelium = exp(-v1 * 13.0);
  float nerve = exp(-v2 * 15.0);

  col += vec3(0.10, 0.68, 0.64) * (mycelium * 0.52 + topo * 0.28);
  col += vec3(0.52, 0.18, 0.72) * nerve * 0.42;
  col += vec3(0.16, 0.76, 0.86) * rd.g * 0.35;

  float dist = length(vWorldXz - vec2(0.0, 180.0));
  float fogF = smoothstep(240.0, 980.0, dist);
  vec3 fogCol = mix(vec3(0.13, 0.025, 0.19), vec3(0.24, 0.24, 0.27), uBrutalFade);

  if (uBrutalFade > 0.01) {
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(luma * 0.85 + 0.08), uBrutalFade);
  }
  col = mix(col, fogCol, fogF);
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * GPU-Instanced Bioluminescent Wild Alien Flora (`6,272` instances across `49` groves, zero per-frame CPU updates).
 */
export const ALIEN_FLORA_VERTEX_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vTipRatio;
varying vec3 vNormalView;
uniform float uTime;
uniform float uWind;

void main() {
  vColor = instanceColor;
  vec3 local = position;
  float hRatio = clamp(local.y / 5.2, 0.0, 1.25);
  vTipRatio = hRatio;

  vec3 instOrigin = instanceMatrix[3].xyz;
  float phase = instOrigin.x * 0.07 + instOrigin.z * 0.09;
  float sway = sin(uTime * 1.35 + phase) * (0.20 + 0.16 * uWind) * hRatio * hRatio;
  float swayZ = cos(uTime * 1.05 + phase * 1.3) * (0.15 + 0.12 * uWind) * hRatio * hRatio;
  local.x += sway;
  local.z += swayZ;

  vec4 worldPos = modelMatrix * instanceMatrix * vec4(local, 1.0);
  vec4 mvPos = viewMatrix * worldPos;
  vNormalView = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * mvPos;
}
`;

export const ALIEN_FLORA_FRAGMENT_SHADER = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vTipRatio;
varying vec3 vNormalView;
uniform float uBrutalFade;

void main() {
  float t = clamp(vTipRatio, 0.0, 1.0);
  float shade = 0.52 + 0.48 * max(dot(normalize(vNormalView), normalize(vec3(0.35, 0.82, 0.45))), 0.0);
  // Deep shadowy emerald-indigo base stem transitioning smoothly into jewel-toned bioluminescent tip!
  vec3 stemBase = mix(vec3(0.05, 0.13, 0.18), vColor * 0.34, 0.45);
  vec3 tipCol = vColor * 1.18 + vec3(0.06, 0.05, 0.08) * (t * t);
  vec3 col = mix(stemBase, tipCol, smoothstep(0.08, 0.88, t)) * shade;

  if (uBrutalFade > 0.01) {
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(luma * 0.9 + 0.05), uBrutalFade);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Compound 3D Chunky Voxel Glitch-Cluster Shader (1 instanced draw call for all multi-cube Rubik/Tetris clusters!).
 * Uses per-subcube vertex `color` attribute + per-instance tint & gentle zero-G tumble.
 */
export const VOXEL_GLITCH_VERTEX_SHADER = /* glsl */ `
attribute vec3 color;
varying vec3 vSubCol;
varying vec3 vInstCol;
varying vec3 vNormalView;
uniform float uTime;

void main() {
  vSubCol = color;
  vInstCol = instanceColor;
  float phase = instanceMatrix[3].x * 0.04 + instanceMatrix[3].z * 0.05;
  float angle = uTime * 0.22 + phase;
  float c = cos(angle);
  float s = sin(angle);
  mat3 spinY = mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  vec3 spun = spinY * position;

  vec4 worldPos = modelMatrix * instanceMatrix * vec4(spun, 1.0);
  worldPos.y += sin(uTime * 0.8 + phase * 3.0) * 1.4;
  vNormalView = normalize(normalMatrix * mat3(instanceMatrix) * (spinY * normal));
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const VOXEL_GLITCH_FRAGMENT_SHADER = /* glsl */ `
precision mediump float;
varying vec3 vSubCol;
varying vec3 vInstCol;
varying vec3 vNormalView;

void main() {
  vec3 n = normalize(vNormalView);
  float key = max(dot(n, normalize(vec3(0.42, 0.82, 0.45))), 0.0);
  float rim = max(dot(n, normalize(vec3(-0.6, -0.2, 0.65))), 0.0);
  float isDarkBlock = step(dot(vSubCol, vec3(0.333)), 0.14);
  vec3 base = isDarkBlock > 0.5 ? vSubCol : mix(vSubCol, vInstCol * 1.15, 0.26);
  vec3 col = base * (0.58 + 0.46 * key + 0.20 * rim);
  gl_FragColor = vec4(col, 1.0);
}
`;
