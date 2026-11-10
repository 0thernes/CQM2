/**
 * CQM2 v2.1.0 Custom Relativistic, Quantum-Manifold & Gray-Scott Chromatophore GLSL Shaders.
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
 * Renders a Spinning Kerr Black Hole with Bardeen asymmetric D-shadow,
 * prograde frame-dragging shift ($a/M$), multi-order $n=0,1,2$ photon subrings,
 * and $I_{\text{obs}} = g^4 I_{\text{em}}$ relativistic Doppler beaming.
 */
export const KERR_SINGULARITY_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSpinA;
uniform float uPulseHz;

void main() {
  vec2 p = (vUv - 0.5) * 2.4;
  float spin = clamp(uSpinA, 0.0, 0.998);
  // Prograde Bardeen shadow centroid shift + prograde vertical D-flattening
  float shift = 0.15 * spin;
  vec2 q = vec2(p.x - shift, p.y);
  float r = length(q);
  float angle = atan(q.y, q.x);

  float dFlatten = 1.0 - 0.11 * spin * max(0.0, -cos(angle));
  float rCrit = 0.42 * dFlatten * (1.0 - 0.06 * spin * cos(angle));
  if (r > 1.18) {
    discard;
  }

  // Relativistic Keplerian Doppler factor g = sqrt(1 - beta^2) / (1 - beta_los)
  float beta = 0.48 + 0.16 * spin;
  float betaLos = beta * cos(angle + 0.35);
  float gFactor = sqrt(max(0.08, 1.0 - beta * beta)) / max(0.32, 1.0 - betaLos);
  float g4 = clamp(pow(gFactor, 4.0), 0.12, 4.8);

  // n=0 primary lensed disk + n=1, n=2 exponentially demagnified photon subrings
  float dr = abs(r - rCrit);
  float n0Disk = smoothstep(0.38, 0.02, abs(r - (rCrit + 0.16))) * smoothstep(rCrit - 0.02, rCrit + 0.03, r);
  float n1Ring = exp(-dr * 48.0) * 1.35;
  float n2Ring = exp(-abs(r - (rCrit + 0.012)) * 140.0) * 0.85;

  float safeHz = clamp(uPulseHz, 0.1, 2.2);
  float swirl = 0.88 + 0.12 * sin(angle * 3.0 - uTime * 6.28318 * safeHz * 0.5 + log(max(0.05, r)) * 6.0);

  float shadowMask = smoothstep(rCrit - 0.015, rCrit + 0.012, r);
  float intensity = shadowMask * (n0Disk * 0.72 * swirl + n1Ring + n2Ring) * g4;

  vec3 hotColor = vec3(0.55, 0.88, 1.0);
  vec3 warmColor = vec3(1.0, 0.58, 0.18);
  vec3 col = mix(warmColor, hotColor, clamp((gFactor - 0.75) * 1.4, 0.0, 1.0)) * intensity;

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
  float well = -safeGain * 9.5 / sqrt(r2 + 36.0);
  float ripple = safeGain * 0.35 * sin(sqrt(r2) * 0.25 - uTime * 1.2);
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
  vec2 grid = abs(fract(vWorldXz * 0.125 - 0.5) - 0.5) / fwidth(vWorldXz * 0.125);
  float line = min(grid.x, grid.y);
  float gridAlpha = 1.0 - min(line, 1.0);

  float radialFade = smoothstep(78.0, 18.0, length(vWorldXz));
  vec3 baseCol = mix(vec3(0.06, 0.22, 0.38), vec3(0.22, 0.76, 0.96), clamp(vWarpDepth * 0.65, 0.0, 1.0));
  float alpha = gridAlpha * radialFade * 0.42;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(baseCol, alpha);
}
`;

/**
 * Live Gray-Scott Reaction-Diffusion Chromatophore & Guanine Thin-Film Iridescence Shader
 * driven directly from `world.skinUGs` / `world.skinVGs` `32x32` `THREE.DataTexture`.
 */
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

  vec3 abyssalBase = vec3(0.04, 0.24, 0.38);
  vec3 cyanBiolum = vec3(0.14, 0.84, 0.96);
  vec3 violetChromatophore = vec3(0.75, 0.42, 0.99);
  vec3 goldIridescence = vec3(0.98, 0.76, 0.18);

  float pattern = clamp(vConc * 2.8 + (1.0 - uConc) * 0.35, 0.0, 1.0);
  vec3 skin = mix(abyssalBase, cyanBiolum, pattern);
  skin = mix(skin, violetChromatophore, clamp(vConc * 2.1 * uConfidence, 0.0, 0.85));
  skin += goldIridescence * fresnel * (0.45 + 0.45 * uConfidence);

  gl_FragColor = vec4(skin * breathe, 1.0);
}
`;
