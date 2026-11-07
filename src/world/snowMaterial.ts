/**
 * Physically based snow/rock/ice terrain material: MeshStandardMaterial extended with procedural
 * world-space detail (micro-normals, packed/groomed/ice/powder variation, slope-based rock,
 * drifting cloud shadows). Terrain geometry is in world space (mesh at origin, identity transform).
 */
import * as THREE from 'three';

export const GLSL_NOISE = /* glsl */ `
float sf_hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float sf_noise(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  float a=sf_hash(i), b=sf_hash(i+vec2(1,0)), c=sf_hash(i+vec2(0,1)), d=sf_hash(i+vec2(1,1));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float sf_fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*sf_noise(p); p=p*2.03+17.1; a*=0.5;} return s; }
`;

export interface TerrainUniforms {
  uTime: { value: number };
  uCloudShadow: { value: number };
  uDetail: { value: number };
  uSunDir: { value: THREE.Vector3 };
}

export function createSnowMaterial(quality: 'low' | 'medium' | 'high' | 'ultra'): { material: THREE.MeshStandardMaterial; uniforms: TerrainUniforms } {
  const uniforms: TerrainUniforms = {
    uTime: { value: 0 },
    uCloudShadow: { value: 1 },
    uDetail: { value: quality === 'low' ? 0.0 : quality === 'medium' ? 0.6 : 1.0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCloudShadow = uniforms.uCloudShadow;
    shader.uniforms.uDetail = uniforms.uDetail;
    shader.uniforms.uSunDir = uniforms.uSunDir;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 aSurf;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vSurf;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vWPos = (modelMatrix * vec4(position,1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * normal);
vSurf = aSurf;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uCloudShadow;
uniform float uDetail;
uniform vec3 uSunDir;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vSurf;
${GLSL_NOISE}
float sf_rock = 0.0;
float sf_ice = 0.0;
float sf_powder = 0.0;
float sf_dist = 0.0;
vec2 sf_pp = vec2(0.0);
`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 wp = vWPos;
  sf_dist = length(cameraPosition - wp);
  vec3 wn = normalize(vWNormal);
  float slope = 1.0 - wn.y;
  // project onto a vertical plane on steep faces (avoids streaks from top-down projection)
  float vert = smoothstep(0.22, 0.5, slope);
  vec2 pp = mix(wp.xz, vec2(wp.x * 0.7 + wp.z * 0.7, wp.y * 1.3), vert);
  sf_pp = pp;
  float n1 = sf_fbm(pp * 0.045);
  float n2 = sf_noise(pp * 0.6);
  // rock exposure on steep faces, with strata, snow lingering on ledges
  float rockEdge = 0.42 + 0.24 * (n1 - 0.5) + 0.05 * (n2 - 0.5);
  sf_rock = smoothstep(rockEdge, rockEdge + 0.08, slope);
  sf_ice = vSurf.x; sf_powder = vSurf.y; float groomed = vSurf.z;
  // snow albedo: very slightly blue-white, subtle large-scale tint variation (never pure white)
  vec3 snow = vec3(0.9, 0.92, 0.95);
  snow *= 0.94 + 0.08 * n1;
  snow = mix(snow, vec3(0.80, 0.84, 0.90), groomed * (0.35 + 0.25 * n2));       // packed piste: slightly greyer-blue
  snow = mix(snow, vec3(0.90, 0.915, 0.94), sf_powder * 0.6);                     // powder: brighter, softer
  // groomed corduroy lines along the fall line, fading with distance
  float cord = smoothstep(0.35, 0.5, abs(fract(wp.x * 3.2 + n1 * 2.0) - 0.5)) * groomed * (1.0 - smoothstep(10.0, 45.0, sf_dist)) * uDetail;
  snow *= 1.0 - 0.06 * cord;
  vec3 ice = vec3(0.62, 0.70, 0.78) * (0.92 + 0.12 * n2);
  snow = mix(snow, ice, sf_ice * 0.85);
  float strata = sf_noise(vec2(wp.y * 0.55 + n1 * 3.0, (wp.x + wp.z) * 0.03));
  float crack = smoothstep(0.42, 0.5, abs(sf_noise(pp * 0.25) - 0.5));
  vec3 rock = mix(vec3(0.2, 0.19, 0.19), vec3(0.37, 0.35, 0.33), strata) * (0.78 + 0.35 * n2) * (1.0 - 0.35 * crack);
  // snow clinging in cracks and on ledges of the rock
  rock = mix(rock, snow * 0.92, smoothstep(0.55, 0.8, sf_fbm(pp * 0.18)) * (1.0 - smoothstep(0.45, 0.75, slope)));
  rock = mix(rock, vec3(0.12, 0.13, 0.15), smoothstep(0.55, 0.95, slope) * 0.5);
  vec3 col = mix(snow, rock, sf_rock);
  // drifting cloud shadows
  float cloud = sf_fbm(wp.xz * 0.0016 + vec2(uTime * 0.004, uTime * 0.0025));
  col *= 1.0 - uCloudShadow * 0.22 * smoothstep(0.52, 0.7, cloud);
  // cold, slightly blue-shifted albedo on faces turned away from the sun (reads as crisp winter light)
  float away = 1.0 - clamp(dot(wn, uSunDir), 0.0, 1.0);
  col *= mix(vec3(1.0), vec3(0.9, 0.95, 1.05), 0.25 * away * (1.0 - sf_rock));
  diffuseColor.rgb = col;
}
`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(0.82, 0.93, sf_powder);
roughnessFactor = mix(roughnessFactor, 0.32, sf_ice);
roughnessFactor = mix(roughnessFactor, 0.78, sf_rock);
`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (uDetail > 0.0) {
  // sparse ice-crystal glints where the sun's reflection lines up (not a bloom/sparkle overlay)
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 R = reflect(-uSunDir, normalize(vWNormal));
  float cell = sf_hash(floor(vWPos.xz * 38.0) + floor(vWPos.y * 38.0));
  float glint = step(0.996, cell) * pow(max(dot(R, V), 0.0), 24.0) * (1.0 - smoothstep(4.0, 40.0, sf_dist)) * (1.0 - sf_rock);
  totalEmissiveRadiance += vec3(1.0, 0.97, 0.92) * glint * 1.6 * uDetail;
}
`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
if (uDetail > 0.0) {
  // procedural micro-relief: wind ripples, sastrugi and rock roughness (world space bump)
  vec2 p = sf_pp;
  float fade = 1.0 - smoothstep(30.0, 140.0, sf_dist);
  float e = 0.08;
  float k1 = 1.7, k2 = 0.35;
  #define SF_H(q) ( sf_noise((q)*k1)*0.6 + sf_noise(vec2((q).x*k2*0.4,(q).y*k2*1.6))*1.4*(1.0-sf_ice)*(1.0-sf_rock) + sf_noise((q)*0.9)*1.6*sf_rock )
  float h0 = SF_H(p);
  float hx = SF_H(p + vec2(e, 0.0));
  float hz = SF_H(p + vec2(0.0, e));
  float amp = (0.055 + 0.09 * sf_rock + 0.02 * sf_powder) * fade * uDetail;
  vec3 wn = normalize(vWNormal);
  wn = normalize(vec3(wn.x - (hx - h0) / e * amp, wn.y, wn.z - (hz - h0) / e * amp));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}
`,
      );
  };
  material.customProgramCacheKey = () => 'skifree-snow-v1';
  return { material, uniforms };
}
