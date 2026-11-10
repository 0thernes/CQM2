/**
 * CQM2 Custom Relativistic, Quantum-Manifold & Thin-Film Iridescent GLSL Shaders.
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
 * Renders a Schwarzschild/Kerr Black Hole with $b_{\text{crit}} = \sqrt{27}\,M$ shadow,
 * prograde frame-dragging shift ($a/M$), multi-order $n=0,1,2$ photon subrings,
 * and $I_{\text{obs}} = g^4 I_{\text{em}}$ relativistic Doppler beaming!
 */
export const KERR_SINGULARITY_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSpinA;
uniform float uPulseHz;

void main() {
  vec2 p = (vUv - 0.5) * 2.4;
  // Prograde frame-dragging shadow centroid shift
  float shift = 0.14 * clamp(uSpinA, 0.0, 0.998);
  vec2 q = vec2(p.x - shift, p.y);
  float r = length(q);
  float angle = atan(q.y, q.x);

  // Event horizon shadow r_shadow ~ 0.42 in normalized quad units
  float rCrit = 0.42 * (1.0 - 0.08 * uSpinA * cos(angle));
  if (r > 1.18) {
    discard;
  }

  // Relativistic Keplerian Doppler factor g = sqrt(1 - beta^2) / (1 - beta_los)
  float beta = 0.48 + 0.16 * uSpinA;
  float betaLos = beta * cos(angle + 0.35);
  float gFactor = sqrt(max(0.08, 1.0 - beta * beta)) / max(0.32, 1.0 - betaLos);
  float g4 = clamp(pow(gFactor, 4.0), 0.12, 4.8);

  // n=0 primary lensed disk + n=1, n=2 exponentially demagnified photon subrings!
  float dr = abs(r - rCrit);
  float n0Disk = smoothstep(0.38, 0.02, abs(r - (rCrit + 0.16))) * smoothstep(rCrit - 0.02, rCrit + 0.03, r);
  float n1Ring = exp(-dr * 48.0) * 1.35;
  float n2Ring = exp(-abs(r - (rCrit + 0.012)) * 140.0) * 0.85;

  float safeHz = clamp(uPulseHz, 0.1, 2.2);
  float swirl = 0.88 + 0.12 * sin(angle * 3.0 - uTime * 6.28318 * safeHz * 0.5 + log(max(0.05, r)) * 6.0);

  float shadowMask = smoothstep(rCrit - 0.015, rCrit + 0.012, r);
  float intensity = shadowMask * (n0Disk * 0.72 * swirl + n1Ring + n2Ring) * g4;

  // Spectral blackbody + gravitational redshift tint (cyan-white blueshift -> amber-crimson redshift)
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
  // Lipschitz-bounded Flamm paraboloid + gentle quantum Berry ripple
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
