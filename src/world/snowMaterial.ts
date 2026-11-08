/**
 * Physically based snow/rock/ice terrain material: MeshStandardMaterial extended with procedural
 * world-space detail (micro-normals, packed/groomed/ice/powder variation, slope-based rock,
 * drifting cloud shadows). Terrain chunk meshes carry their own translation; with the floating
 * origin the scene is rendered shifted by −uOrigin, so procedural patterns sample (render pos +
 * uOrigin) to stay locked to the ground across origin shifts.
 *
 * Anti-aliasing (round 2): every procedural term is band-limited against the pixel footprint
 * (each noise octave fades to its mean once a cell is smaller than ~½ pixel) and every threshold
 * is widened by fwidth() of its input, so nothing aliases into contour lines, stipple or speckle
 * at any distance. Patterns use triplanar projection (no stretched/mixed coordinates on steep
 * faces). Large-scale relief (tone + a screen-derivative bump of a ~85 m fbm) survives distance,
 * so far valley walls never render as flat grey slabs.
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

/**
 * Band-limited value noise with an integer hash (stable at km-scale coordinates, where the float
 * hash above loses precision). `fp` = pixel footprint in noise cells; octaves finer than the
 * pixel fade to their mean instead of aliasing.
 */
export const GLSL_NOISE_BL = /* glsl */ `
float sf_h2(vec2 i){
  uvec2 q = uvec2(i + 1048576.0) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  n ^= n >> 16;
  return float(n) * 2.3283064e-10;
}
float sf_vn(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  float a=sf_h2(i), b=sf_h2(i+vec2(1,0)), c=sf_h2(i+vec2(0,1)), d=sf_h2(i+vec2(1,1));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float sf_vnBL(vec2 p, float fp){ return mix(sf_vn(p), 0.5, smoothstep(0.2, 0.6, fp)); }
float sf_fbmBL(vec2 p, float fp){
  float s=0.0, a=0.5;
  for(int i=0;i<4;i++){ s += a*sf_vnBL(p, fp); p = p*2.03 + 17.1; fp *= 2.03; a *= 0.5; }
  return s / 0.9375;
}
// derivative-aware threshold: transition widened by the pixel footprint of x
float sf_aa(float e0, float e1, float x){ float w = fwidth(x); return smoothstep(e0 - w, e1 + w, x); }
`;

export interface TerrainUniforms {
  uTime: { value: number };
  uCloudShadow: { value: number };
  uDetail: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uOrigin: { value: THREE.Vector3 };
  /** multiplier on the sparse sun-glint sparkles (0 = off; the cave cinematic dims them) */
  uGlint: { value: number };
}

export function createSnowMaterial(quality: 'low' | 'medium' | 'high' | 'ultra'): { material: THREE.MeshStandardMaterial; uniforms: TerrainUniforms } {
  const uniforms: TerrainUniforms = {
    uTime: { value: 0 },
    uCloudShadow: { value: 1 },
    uDetail: { value: quality === 'low' ? 0.0 : quality === 'medium' ? 0.6 : 1.0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uOrigin: { value: new THREE.Vector3() },
    uGlint: { value: 1 },
  };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCloudShadow = uniforms.uCloudShadow;
    shader.uniforms.uDetail = uniforms.uDetail;
    shader.uniforms.uSunDir = uniforms.uSunDir;
    shader.uniforms.uOrigin = uniforms.uOrigin;
    shader.uniforms.uGlint = uniforms.uGlint;
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
uniform float uGlint;
varying vec3 vNPos;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vSurf;
${GLSL_NOISE}
${GLSL_NOISE_BL}
${ATMOSPHERE_GLSL}
float sf_rock = 0.0;
float sf_wind = 0.0;
float sf_ice = 0.0;
float sf_powder = 0.0;
float sf_dist = 0.0;
vec3 sf_wn = vec3(0.0, 1.0, 0.0);
// triplanar state: weights, side projections and their per-axis pixel footprints (metres)
vec3 sf_tw = vec3(0.0, 1.0, 0.0);
vec2 sf_pX = vec2(0.0);
vec2 sf_pZ = vec2(0.0);
vec2 sf_fX = vec2(1.0);
vec2 sf_fY = vec2(1.0);
vec2 sf_fZ = vec2(1.0);
float sf_fp(vec2 f, vec2 sc){ return max(f.x * sc.x, f.y * sc.y); }
/** triplanar band-limited fbm (anisotropic scale sc, applied to (horizontal, vertical) on sides) */
float sf_triF(vec2 sc, float off){
  float s = 0.0;
  if (sf_tw.y > 0.0) s += sf_tw.y * sf_fbmBL(vNPos.xz * sc.x + off, sf_fp(sf_fY, sc.xx));
  if (sf_tw.x > 0.0) s += sf_tw.x * sf_fbmBL(sf_pX * sc + off, sf_fp(sf_fX, sc));
  if (sf_tw.z > 0.0) s += sf_tw.z * sf_fbmBL(sf_pZ * sc + off, sf_fp(sf_fZ, sc));
  return s;
}
/** triplanar band-limited single-octave noise */
float sf_triN(vec2 sc, float off){
  float s = 0.0;
  if (sf_tw.y > 0.0) s += sf_tw.y * sf_vnBL(vNPos.xz * sc.x + off, sf_fp(sf_fY, sc.xx));
  if (sf_tw.x > 0.0) s += sf_tw.x * sf_vnBL(sf_pX * sc + off, sf_fp(sf_fX, sc));
  if (sf_tw.z > 0.0) s += sf_tw.z * sf_vnBL(sf_pZ * sc + off, sf_fp(sf_fZ, sc));
  return s;
}
/** noise on the vertical projections only (fall-line streaks, joints); 0.5 on flat ground */
float sf_sideN(vec2 sc, float off){
  float s = 0.5 * sf_tw.y;
  if (sf_tw.x > 0.0) s += sf_tw.x * sf_vnBL(sf_pX * sc + off, sf_fp(sf_fX, sc));
  if (sf_tw.z > 0.0) s += sf_tw.z * sf_vnBL(sf_pZ * sc + off, sf_fp(sf_fZ, sc));
  return s;
}
`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 wp = vNPos; // pattern space (absolute world)
  sf_dist = length(cameraPosition - vWPos);
  vec3 gn = normalize(vWNormal);
  float slope = 1.0 - gn.y;
  // triplanar weights (sharpened so most of the slope uses a single projection)
  vec3 tw = pow(max(abs(gn) - 0.25, 0.0), vec3(3.0));
  sf_tw = tw / max(tw.x + tw.y + tw.z, 1e-6);
  sf_pX = wp.zy;
  sf_pZ = wp.xy;
  // footprints from render-space positions (precise near the camera)
  sf_fX = fwidth(vWPos.zy);
  sf_fY = fwidth(vWPos.xz);
  sf_fZ = fwidth(vWPos.xy);
  // detail fade: fine terms are gone by ~120 m whatever the footprint says
  float sf_near = 1.0 - smoothstep(40.0, 120.0, sf_dist);
  float farA = smoothstep(80.0, 600.0, sf_dist);

  float M = sf_triF(vec2(1.0 / 85.0), 1.3);    // macro relief / tone (survives distance)
  float n1 = sf_triF(vec2(0.045), 7.7);         // mid-scale
  float n2 = sf_triN(vec2(0.6), 3.1);           // fine (band-limited)
  // km-scale snowpack regions: wind-packed slab (greyer, bluer, smoother) vs deep powder fields
  float L1 = sf_fbmBL(wp.xz * 0.0019 + 3.7, sf_fp(sf_fY, vec2(0.0019)));
  float L2 = sf_vn(wp.xz * 0.00055 + 1.3);
  sf_wind = smoothstep(0.42, 0.68, L1 * 0.65 + L2 * 0.35);

  // geology: tilted, warped strata with varying thickness; band boundaries anti-aliased
  float warp = 46.0 * (sf_fbmBL(wp.xz * 0.0024 + 5.0, sf_fp(sf_fY, vec2(0.0024))) - 0.5)
             + 9.0 * (sf_vnBL(wp.xz * 0.019 + 2.0, sf_fp(sf_fY, vec2(0.019))) - 0.5);
  float dip = wp.y + 0.2 * wp.x - 0.13 * wp.z + warp;
  float b0 = dip * 0.036;
  float band = b0 + 0.2 * sin(b0 * 2.4 + 1.3) + 0.06 * sin(b0 * 5.3);
  float fb = fwidth(band);
  float bandId = floor(band);
  float bandF = fract(band);
  float bw = clamp(fb * 1.5, 0.04, 0.5);
  float tr = smoothstep(1.0 - bw, 1.0, bandF);
  float bandFade = smoothstep(0.25, 0.7, fb);
  float hard = mix(mix(step(0.45, sf_h2(vec2(bandId, 7.0))), step(0.45, sf_h2(vec2(bandId + 1.0, 7.0))), tr), 0.55, bandFade);
  float tone = mix(mix(sf_h2(vec2(bandId, 3.0)), sf_h2(vec2(bandId + 1.0, 3.0)), tr), 0.45, bandFade);

  // rock exposure on steep faces (threshold widened by its own footprint and with distance)
  float rockEdge = 0.43 + 0.2 * (n1 - 0.5) + 0.16 * (M - 0.5) + 0.05 * (n2 - 0.5) - 0.07 * hard;
  float sw = 0.05 + 0.1 * farA + fwidth(slope) * 1.5;
  sf_rock = smoothstep(rockEdge - sw, rockEdge + sw, slope);
  sf_ice = vSurf.x; sf_powder = vSurf.y; float groomed = vSurf.z;

  // snow albedo: very slightly blue-white, subtle large-scale tint variation (never pure white)
  vec3 snow = vec3(0.9, 0.92, 0.95);
  snow *= 0.94 + 0.08 * n1;
  snow = mix(snow, vec3(0.84, 0.87, 0.92), sf_wind * 0.55 * (1.0 - groomed));        // wind slab
  snow *= 1.0 + 0.035 * (L2 - 0.5);
  snow = mix(snow, vec3(0.80, 0.84, 0.90), groomed * (0.35 + 0.25 * n2));       // packed piste: slightly greyer-blue
  snow = mix(snow, vec3(0.91, 0.925, 0.95), sf_powder * 0.6);                     // powder: brighter, softer
  // groomed corduroy along the fall line (anti-aliased triangle wave, gone when unresolvable)
  float cx = wp.x * 3.2 + n1 * 2.0;
  float cw = fwidth(cx);
  float cord = smoothstep(0.32 - cw, 0.5, abs(fract(cx) - 0.5)) * (1.0 - smoothstep(0.15, 0.4, cw));
  snow *= 1.0 - 0.06 * cord * groomed * sf_near * uDetail;
  vec3 ice = vec3(0.62, 0.70, 0.78) * (0.92 + 0.12 * n2);
  snow = mix(snow, ice, sf_ice * 0.85);

  // rock colour: per-band tone (cool grey / warm grey-brown / dark) ...
  vec3 rockA = vec3(0.25, 0.245, 0.245);
  vec3 rockB = vec3(0.34, 0.30, 0.26);
  vec3 rockC = vec3(0.15, 0.15, 0.165);
  vec3 rock = tone < 0.45 ? mix(rockA, rockB, tone / 0.45) : mix(rockB, rockC, (tone - 0.45) / 0.55);
  // ... large-scale weathering tone and fall-line staining (both survive distance)
  rock *= 0.66 + 0.68 * M;
  float streak = sf_sideN(vec2(0.07, 0.006), 4.0);
  rock *= 0.8 + 0.4 * streak;
  // fine bedding along the strata: only where it is resolvable
  float bq = dip * 0.45;
  float bed = mix(sf_vn(vec2(bq, (wp.x + wp.z) * 0.02)), 0.5, smoothstep(0.15, 0.45, fwidth(bq)));
  rock *= mix(1.0, 0.86 + 0.28 * bed, sf_near);
  // vertical joints (cracks) on the vertical projections, stronger in hard layers
  float jn = abs(sf_sideN(vec2(0.22, 0.03), 9.0) - 0.5);
  float joint = sf_aa(0.42, 0.5, jn) * (1.0 - smoothstep(0.1, 0.3, fwidth(jn)));
  rock *= 1.0 - (0.22 + 0.18 * hard) * joint * (1.0 - farA);
  rock *= 0.86 + 0.28 * n2 * sf_near + 0.14 * n1;
  // snow held on benches at the top of hard layers (broken up, AA'd, gone when bands are sub-pixel)
  float lw = fb * 1.5;
  float ledge = smoothstep(0.8 - lw, 0.92 + lw, bandF) * (1.0 - tr) * hard * (1.0 - bandFade)
              * (1.0 - smoothstep(0.5, 0.8, slope)) * smoothstep(0.42, 0.68, n1);
  // snow clinging in hollows: mid-scale patches modulated by the macro field (so they survive distance)
  float clingN = sf_triF(vec2(0.12), 11.0) + 0.3 * (M - 0.5);
  float cling = sf_aa(0.52, 0.74, clingN) * (1.0 - smoothstep(0.42, 0.75, slope));
  rock = mix(rock, snow * 0.92, max(cling, ledge * 0.55));
  rock = mix(rock, rock * 0.62, smoothstep(0.6, 0.95, slope) * 0.55);
  vec3 col = mix(snow, rock, sf_rock);
  // drifting cloud shadows
  float cloud = sf_fbm(wp.xz * 0.0016 + vec2(uTime * 0.004, uTime * 0.0025));
  col *= 1.0 - uCloudShadow * 0.22 * smoothstep(0.52, 0.7, cloud);
  // cold, slightly blue-shifted albedo on faces turned away from the sun (reads as crisp winter light)
  float away = 1.0 - clamp(dot(gn, uSunDir), 0.0, 1.0);
  col *= mix(vec3(1.0), vec3(0.9, 0.95, 1.05), 0.25 * away * (1.0 - sf_rock));
  diffuseColor.rgb = col;

  // relief: one height field (macro + mid + band-limited micro), applied as a screen-derivative bump
  float Hm = (M - 0.5) * 7.0 * (0.3 + 0.7 * sf_rock) + (n1 - 0.5) * 1.8 * (0.35 + 0.65 * sf_rock);
  float sast = sf_vnBL(vec2(wp.x * 0.14, wp.z * 0.56), sf_fp(sf_fY, vec2(0.14, 0.56)));
  float Hd = (sf_triN(vec2(1.7), 0.0) - 0.5) * 0.05 * (1.0 - sf_ice)
           + (sast - 0.5) * 0.1 * sf_tw.y * (1.0 - sf_ice) * (1.0 - sf_rock)
           + (n2 - 0.5) * (0.04 + 0.3 * sf_rock);
  float H = Hm + Hd * sf_near * uDetail;
  vec3 dpx = dFdx(vWPos);
  vec3 dpy = dFdy(vWPos);
  vec3 r1 = cross(dpy, gn);
  vec3 r2 = cross(gn, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dFdx(H) * r1 + dFdy(H) * r2);
  sf_wn = normalize(abs(det) * gn - grad);
  // never let the bump tip a face past horizontal-facing (keeps grazing views stable)
  if (dot(sf_wn, gn) < 0.3) sf_wn = gn;
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
{
  // sparse ice-crystal glints where the sun's reflection lines up; cells fade once sub-pixel
  vec2 gq = mod(vNPos.xz, 1024.0) * 38.0;
  float gfp = max(fwidth(vWPos.x), fwidth(vWPos.z)) * 38.0;
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 R = reflect(-uSunDir, sf_wn);
  float cell = sf_h2(floor(gq) + floor(mod(vNPos.y, 1024.0) * 38.0));
  float glint = step(0.996, cell) * pow(max(dot(R, V), 0.0), 24.0) * (1.0 - smoothstep(4.0, 30.0, sf_dist)) * (1.0 - smoothstep(0.3, 0.7, gfp)) * (1.0 - sf_rock);
  totalEmissiveRadiance += vec3(1.0, 0.97, 0.92) * glint * 1.6 * uDetail * uGlint;
}
`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
normal = normalize((viewMatrix * vec4(sf_wn, 0.0)).xyz);
`,
      );
  };
  material.customProgramCacheKey = () => 'skifree-snow-v6';
  return { material, uniforms };
}
