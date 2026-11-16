/**
 * Shared aerial-perspective model used by the terrain, the forests and the distant ranges.
 *
 * Optical depth along the view ray = (linear extinction · d + (exp² density · d)²) scaled by an
 * analytic exponential height-fog term (thinner air above the viewer, haze pooling in the valley
 * below). Near the camera it reduces to the scene's FogExp2, so materials that still use three's
 * built-in fog (particles, tracks, resort, cave) match in the foreground. The fog colour is
 * brightened and warmed towards the sun (forward in-scattering).
 *
 * The uniforms are module singletons, written by Environment every frame.
 */
import * as THREE from 'three';

export const atmosphere = {
  uFogColor: { value: new THREE.Color(0.72, 0.8, 0.9) },
  uSunHaze: { value: new THREE.Color(1.0, 0.92, 0.8) },
  uAtmSunDir: { value: new THREE.Vector3(0, 1, 0) },
  /** linear extinction per metre (aerial perspective at mid distances) */
  uFogLin: { value: 1 / 16000 },
  /** FogExp2 density (kept equal to scene.fog.density) */
  uFogExp: { value: 0.00036 },
  /** 1 / scale height of the haze, metres */
  uFogFalloff: { value: 1 / 520 },
  /**
   * Moving cloud shadows (Whiteout): darkening strength (0 = off: every other location renders
   * exactly as before), the cloud field's world offset (wind drift, render origin folded in), its
   * coverage (0..1) and altitude (m, render space)
   */
  uCloudK: { value: 0 },
  uCloudOff: { value: new THREE.Vector2() },
  uCloudCov: { value: 0.4 },
  uCloudH: { value: 600 },
  /**
   * Surface spindrift (Whiteout, terrain shader only): strength (0 = off), wind direction (unit XZ),
   * the drift's travelled distance (m, for the moving streaks) and the render origin (stable noise)
   */
  uDriftK: { value: 0 },
  uDriftDir: { value: new THREE.Vector2(1, 0) },
  uDriftS: { value: 0 },
  uDriftOrigin: { value: new THREE.Vector2() },
};

export type AtmosphereUniforms = typeof atmosphere;

export function addAtmosphereUniforms(uniforms: Record<string, THREE.IUniform>) {
  for (const [k, v] of Object.entries(atmosphere)) uniforms[k] = v;
}

/** GLSL declarations + `vec3 sf_atmosphere(vec3 col, vec3 renderSpaceWorldPos)`. Fragment stage. */
/**
 * The cloud field shared by the Whiteout cloud deck and the terrain's cloud shadows: value-noise fbm
 * over world XZ (metres), thresholded by coverage. `sf_cloudDensity` → 0..1.
 */
export const CLOUD_NOISE_GLSL = /* glsl */ `
float sf_cHash(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float sf_cNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sf_cHash(i), sf_cHash(i + vec2(1.0, 0.0)), u.x), mix(sf_cHash(i + vec2(0.0, 1.0)), sf_cHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float sf_cloudDensity(vec2 w, float cov) {
  vec2 p = w / 900.0;
  float n = 0.5 * sf_cNoise(p) + 0.27 * sf_cNoise(p * 2.07 + 3.1) + 0.15 * sf_cNoise(p * 4.13 + 7.7) + 0.08 * sf_cNoise(p * 8.31 + 1.3);
  return smoothstep(1.0 - cov - 0.12, 1.0 - cov + 0.22, n);
}
`;

export const ATMOSPHERE_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform vec3 uSunHaze;
uniform vec3 uAtmSunDir;
uniform float uFogLin;
uniform float uFogExp;
uniform float uFogFalloff;
uniform float uCloudK;
uniform vec2 uCloudOff;
uniform float uCloudCov;
uniform float uCloudH;
uniform float uDriftK;
uniform vec2 uDriftDir;
uniform float uDriftS;
uniform vec2 uDriftOrigin;
${CLOUD_NOISE_GLSL}
float sf_fogAmount(vec3 rel, float d) {
  float k = uFogFalloff * rel.y;
  float hf = abs(k) < 1e-3 ? 1.0 - 0.5 * k : (1.0 - exp(-k)) / k;
  hf = clamp(hf, 0.0, 3.0);
  float e = uFogExp * d;
  return 1.0 - exp(-(uFogLin * d + e * e) * hf);
}
vec3 sf_fogColor(vec3 v) {
  float s = max(dot(v, uAtmSunDir), 0.0);
  return mix(uFogColor, uSunHaze, 0.55 * pow(s, 5.0) + 0.2 * pow(s, 1.5));
}
// snow snakes: thin, fast streams of blowing snow skating over the surface along the wind
// (brightening near the camera only; the far snow is already a blur of fog and spindrift)
vec3 sf_spindrift(vec3 col, vec3 wp, float flatK) {
  if (uDriftK <= 0.0) return col;
  vec2 w = wp.xz + uDriftOrigin;
  vec2 d = uDriftDir;
  vec2 n = vec2(-d.y, d.x);
  float a = dot(w, d) - uDriftS;
  float b = dot(w, n);
  float lanes = sf_cNoise(vec2(b * 0.9, a * 0.05));
  float run = sf_cNoise(vec2(b * 0.25 + 9.0, a * 0.35));
  float streak = smoothstep(0.62, 0.9, lanes) * smoothstep(0.35, 0.75, run);
  float near = 1.0 - smoothstep(25.0, 90.0, length(wp - cameraPosition));
  return mix(col, vec3(0.97, 0.98, 1.0) * max(max(col.r, col.g), col.b) * 1.08, uDriftK * streak * near * flatK);
}
vec3 sf_atmosphere(vec3 col, vec3 wp) {
  if (uCloudK > 0.0) {
    // the cloud overhead along the sun's ray (the same field as the cloud deck)
    vec2 p = wp.xz + uAtmSunDir.xz / max(uAtmSunDir.y, 0.15) * max(uCloudH - wp.y, 0.0);
    float c = sf_cloudDensity(p + uCloudOff, uCloudCov);
    col *= 1.0 - uCloudK * smoothstep(0.15, 0.7, c);
  }
  vec3 rel = wp - cameraPosition;
  float d = length(rel);
  vec3 v = rel / max(d, 1e-3);
  return mix(col, sf_fogColor(v), sf_fogAmount(rel, d));
}
`;
