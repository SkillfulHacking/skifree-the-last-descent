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
};

export type AtmosphereUniforms = typeof atmosphere;

export function addAtmosphereUniforms(uniforms: Record<string, THREE.IUniform>) {
  for (const [k, v] of Object.entries(atmosphere)) uniforms[k] = v;
}

/** GLSL declarations + `vec3 sf_atmosphere(vec3 col, vec3 renderSpaceWorldPos)`. Fragment stage. */
export const ATMOSPHERE_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform vec3 uSunHaze;
uniform vec3 uAtmSunDir;
uniform float uFogLin;
uniform float uFogExp;
uniform float uFogFalloff;
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
vec3 sf_atmosphere(vec3 col, vec3 wp) {
  vec3 rel = wp - cameraPosition;
  float d = length(rel);
  vec3 v = rel / max(d, 1e-3);
  return mix(col, sf_fogColor(v), sf_fogAmount(rel, d));
}
`;
