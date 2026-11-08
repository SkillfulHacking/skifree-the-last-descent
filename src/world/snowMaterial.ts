/**
 * Physically based snow/rock/ice terrain material: MeshStandardMaterial extended with procedural
 * world-space detail (micro-normals, packed/groomed/ice/powder variation, slope-based rock,
 * drifting cloud shadows). Terrain chunk meshes carry their own translation; with the floating
 * origin the scene is rendered shifted by −uOrigin, so procedural patterns sample (render pos +
 * uOrigin) to stay locked to the ground across origin shifts.
 */
import * as THREE from 'three';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from './look/atmosphere';

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
  uOrigin: { value: THREE.Vector3 };
}

export function createSnowMaterial(quality: 'low' | 'medium' | 'high' | 'ultra'): { material: THREE.MeshStandardMaterial; uniforms: TerrainUniforms } {
  const uniforms: TerrainUniforms = {
    uTime: { value: 0 },
    uCloudShadow: { value: 1 },
    uDetail: { value: quality === 'low' ? 0.0 : quality === 'medium' ? 0.6 : 1.0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uOrigin: { value: new THREE.Vector3() },
  };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCloudShadow = uniforms.uCloudShadow;
    shader.uniforms.uDetail = uniforms.uDetail;
    shader.uniforms.uSunDir = uniforms.uSunDir;
    shader.uniforms.uOrigin = uniforms.uOrigin;
    addAtmosphereUniforms(shader.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 aSurf;
uniform vec3 uOrigin;
varying vec3 vNPos;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vSurf;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vWPos = (modelMatrix * vec4(position,1.0)).xyz;
vNPos = vWPos + uOrigin;
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
varying vec3 vNPos;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vSurf;
${GLSL_NOISE}
${ATMOSPHERE_GLSL}
float sf_rock = 0.0;
float sf_wind = 0.0;
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
  vec3 wp = vNPos; // pattern space (absolute world)
  sf_dist = length(cameraPosition - vWPos);
  vec3 wn = normalize(vWNormal);
  float slope = 1.0 - wn.y;
  // project onto a vertical plane on steep faces (avoids streaks from top-down projection)
  float vert = smoothstep(0.22, 0.5, slope);
  vec2 pp = mix(wp.xz, vec2(wp.x * 0.7 + wp.z * 0.7, wp.y * 1.3), vert);
  sf_pp = pp;
  float n1 = sf_fbm(pp * 0.045);
  float n2 = sf_noise(pp * 0.6);
  // km-scale snowpack regions: wind-packed slab (greyer, bluer, smoother) vs deep powder fields
  float L1 = sf_fbm(wp.xz * 0.0019 + 3.7);
  float L2 = sf_noise(wp.xz * 0.00055 + 1.3);
  sf_wind = smoothstep(0.42, 0.68, L1 * 0.65 + L2 * 0.35);
  // geology: dipping strata (bands tens of metres thick) with hard, cliff-forming layers
  float dip = wp.y + 0.18 * wp.x - 0.11 * wp.z + 22.0 * sf_noise(wp.xz * 0.004);
  float band = dip * 0.034 + 0.8 * sf_noise(wp.xz * 0.0021 + 9.0);
  float bandId = floor(band);
  float bandF = fract(band);
  float hard = step(0.45, sf_hash(vec2(bandId, 7.0)));
  float tone = sf_hash(vec2(bandId, 3.0));
  // rock exposure on steep faces; hard layers stay bare on gentler slopes, soft layers hold snow
  // high-frequency terms and hard thresholds alias into stippled contour lines at distance:
  // fade them out and soften the rock/snow transition with distance
  float farA = smoothstep(120.0, 700.0, sf_dist);
  float rockEdge = 0.44 + 0.22 * (n1 - 0.5) + 0.05 * (n2 - 0.5) * (1.0 - farA) - 0.1 * hard + 0.06 * (1.0 - hard) * smoothstep(0.6, 0.95, bandF);
  sf_rock = smoothstep(rockEdge - 0.06 * farA, rockEdge + 0.07 + 0.16 * farA, slope);
  sf_ice = vSurf.x; sf_powder = vSurf.y; float groomed = vSurf.z;
  // snow albedo: very slightly blue-white, subtle large-scale tint variation (never pure white)
  vec3 snow = vec3(0.9, 0.92, 0.95);
  snow *= 0.94 + 0.08 * n1;
  snow = mix(snow, vec3(0.84, 0.87, 0.92), sf_wind * 0.55 * (1.0 - groomed));        // wind slab
  snow *= 1.0 + 0.035 * (L2 - 0.5);
  snow = mix(snow, vec3(0.80, 0.84, 0.90), groomed * (0.35 + 0.25 * n2));       // packed piste: slightly greyer-blue
  snow = mix(snow, vec3(0.91, 0.925, 0.95), sf_powder * 0.6);                     // powder: brighter, softer
  // groomed corduroy lines along the fall line, fading with distance
  float cord = smoothstep(0.35, 0.5, abs(fract(wp.x * 3.2 + n1 * 2.0) - 0.5)) * groomed * (1.0 - smoothstep(10.0, 45.0, sf_dist)) * uDetail;
  snow *= 1.0 - 0.06 * cord;
  vec3 ice = vec3(0.62, 0.70, 0.78) * (0.92 + 0.12 * n2);
  snow = mix(snow, ice, sf_ice * 0.85);
  // rock colour: per-band tone (cool grey / warm grey-brown / dark), fine bedding fades with distance
  vec3 rockA = vec3(0.24, 0.235, 0.235);
  vec3 rockB = vec3(0.33, 0.29, 0.25);
  vec3 rockC = vec3(0.14, 0.14, 0.155);
  vec3 rock = tone < 0.45 ? mix(rockA, rockB, tone / 0.45) : mix(rockB, rockC, (tone - 0.45) / 0.55);
  float fineFade = 1.0 - smoothstep(60.0, 260.0, sf_dist);
  float bedding = sf_noise(vec2(dip * 0.5, (wp.x + wp.z) * 0.02));
  rock *= mix(1.0, 0.82 + 0.3 * bedding, fineFade);
  // vertical joints (cracks) on the vertical projection, stronger in hard layers
  float joint = smoothstep(0.43, 0.5, abs(sf_noise(vec2(pp.x * 0.22, pp.y * 0.03)) - 0.5));
  rock *= 1.0 - (0.25 + 0.2 * hard) * joint * mix(0.5, 1.0, fineFade);
  rock *= 0.82 + 0.3 * n2 * fineFade + 0.15 * n1;
  // snow on the ledge at the top of each band and in cracks; less on vertical faces
  float ledge = smoothstep(0.86, 0.97, bandF) * (1.0 - smoothstep(0.5, 0.8, slope)) * smoothstep(0.45, 0.75, sf_noise(pp * 0.05 + bandId));
  float clingN = mix(sf_fbm(pp * 0.18), 0.62, farA); // its detail aliases far away: average it out
  float cling = max(smoothstep(0.55, 0.8, clingN) * (1.0 - smoothstep(0.45, 0.72, slope)), ledge * 0.45 * (1.0 - 0.6 * farA));
  rock = mix(rock, snow * 0.92, cling);
  rock = mix(rock, rock * 0.6, smoothstep(0.6, 0.95, slope) * 0.6);
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
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
// skylight is blue: shadowed snow reads cold while the sunlit side stays warm
reflectedLight.indirectDiffuse *= mix(vec3(0.88, 0.97, 1.2), vec3(1.0), sf_rock * 0.5);`,
      )
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vWPos);')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(0.82, 0.93, sf_powder);
roughnessFactor = mix(roughnessFactor, 0.74, sf_wind * (1.0 - sf_powder));
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
  float cell = sf_hash(floor(mod(vNPos.xz, 1024.0) * 38.0) + floor(mod(vNPos.y, 1024.0) * 38.0));
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
  float amp = (0.05 + 0.09 * sf_rock + 0.02 * sf_powder + 0.03 * sf_wind) * fade * uDetail;
  vec3 wn = normalize(vWNormal);
  wn = normalize(vec3(wn.x - (hx - h0) / e * amp, wn.y, wn.z - (hz - h0) / e * amp));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}
`,
      );
  };
  material.customProgramCacheKey = () => 'skifree-snow-v4';
  return { material, uniforms };
}
