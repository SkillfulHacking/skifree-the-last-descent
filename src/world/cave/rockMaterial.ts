/**
 * Cave rock material: MeshStandardMaterial extended with world-space procedural detail that matches the
 * terrain's exposed rock (src/world/snowMaterial.ts — same noise, same dark warm grey-brown palette), plus
 * bedding-plane strata, joints, iron staining, rubble floor, snow on ledges/upward faces (gated by baked
 * sky visibility so none gets inside), claw gouges beside the mouth, procedural bump, and baked
 * occlusion applied to the indirect light (and as a safety net to the direct light deep inside).
 *
 * Vertex attribute `aCave` = (sky visibility, local AO, kind) — kind 0 = rock, 1 = floor.
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../snowMaterial';

export interface ClawFrame {
  origin: THREE.Vector3;
  tangent: THREE.Vector3; // along the face, horizontal
  up: THREE.Vector3;
  normal: THREE.Vector3;
}

const GLSL_NOISE3 = /* glsl */ `
float cv_h3(vec3 p){ p = fract(p*0.3183099+vec3(0.71,0.113,0.419)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float cv_n3(vec3 x){
  vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(cv_h3(i),cv_h3(i+vec3(1,0,0)),f.x), mix(cv_h3(i+vec3(0,1,0)),cv_h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(cv_h3(i+vec3(0,0,1)),cv_h3(i+vec3(1,0,1)),f.x), mix(cv_h3(i+vec3(0,1,1)),cv_h3(i+vec3(1,1,1)),f.x),f.y), f.z);
}
vec2 cv_h22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
// 2D Voronoi: x = distance to the nearest cell border (≈F2-F1), y = cell hash, z/w = direction of the border
vec4 cv_vor(vec2 p){
  vec2 n = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0; vec2 r1 = vec2(0.0), r2 = vec2(0.0), c1 = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + cv_h22(n + g) * 0.85 - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; r2 = r1; d1 = d; r1 = r; c1 = n + g; } else if (d < d2) { d2 = d; r2 = r; }
  }
  float edge = dot(0.5 * (r1 + r2), normalize(r2 - r1));
  return vec4(edge, fract(sin(dot(c1, vec2(12.9898, 78.233))) * 43758.5453), normalize(r2 - r1));
}
float cv_f3(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*cv_n3(p); p=p*2.07+11.3; a*=0.5;} return s/0.875; }
`;

export function createCaveRockMaterial(claw: ClawFrame, detail: number): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 });
  const uniforms = {
    uClawO: { value: claw.origin.clone() },
    uClawT: { value: claw.tangent.clone() },
    uClawU: { value: claw.up.clone() },
    uClawN: { value: claw.normal.clone() },
    uDetail: { value: detail },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aCave;
varying vec4 vCave;
varying vec3 vCWPos;
varying vec3 vCWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vCave = aCave;
vCWPos = (modelMatrix * vec4(position, 1.0)).xyz;
vCWN = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uClawO; uniform vec3 uClawT; uniform vec3 uClawU; uniform vec3 uClawN;
uniform float uDetail;
varying vec4 vCave;
varying vec3 vCWPos;
varying vec3 vCWN;
${GLSL_NOISE}
${GLSL_NOISE3}
float cv_snow = 0.0;
float cv_claw = 0.0;
float cv_rough = 0.85;
float cv_vis = 1.0;
vec4 cv_v = vec4(1.0);
vec2 cv_pp = vec2(0.0);
// claw gouges: 4 slanted tapered strokes in the face's local frame; returns depth 0..1
float cv_clawDepth(vec3 wp){
  vec3 q = wp - uClawO;
  float n = dot(q, uClawN);
  if (abs(n) > 0.9) return 0.0;
  float t = dot(q, uClawT), u = dot(q, uClawU);
  float d = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float len = 0.62 + 0.08 * fi - 0.06 * fi * fi * 0.3;
    float c = (fi - 1.5) * 0.17;
    float along = u / len;                       // -1..1 along the stroke
    float x = t - c + along * 0.32 + 0.03 * sin(along * 3.0 + fi);
    float w = 0.045 * (1.0 - along * along);
    float s = (1.0 - smoothstep(w * 0.3, w, abs(x))) * step(abs(along), 1.0);
    d = max(d, s * (0.6 + 0.4 * (1.0 - abs(along))));
  }
  return d;
}
`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 wp = vCWPos;
  vec3 wn = normalize(vCWN);
  float kind = min(vCave.z, 1.0);
  float rim = clamp(vCave.z - 1.0, 0.0, 1.0);
  cv_vis = vCave.x;
  float ao = vCave.y;
  float slope = 1.0 - wn.y;
  // planar projection chosen per face orientation (no streaks on steep faces)
  vec3 an = abs(wn);
  vec2 pp = an.y > 0.7 ? wp.xz : (an.x > an.z ? vec2(wp.z, wp.y * 1.3) : vec2(wp.x, wp.y * 1.3));
  float n1 = sf_fbm(pp * 0.045);
  float n2 = sf_noise(pp * 0.6);
  // --- rock (same palette and strata as the terrain rock in snowMaterial.ts, a touch darker and warmer)
  float tilt = wp.y + 0.09 * wp.z + 0.04 * wp.x;
  float strata = sf_noise(vec2(wp.y * 0.55 + n1 * 3.0, (wp.x + wp.z) * 0.03));
  float crack = smoothstep(0.42, 0.5, abs(sf_noise(pp * 0.25) - 0.5));
  vec3 rock = mix(vec3(0.2, 0.19, 0.19), vec3(0.37, 0.35, 0.33), strata) * (0.78 + 0.35 * n2) * (1.0 - 0.35 * crack);
  vec3 terrainRock = mix(rock, vec3(0.12, 0.13, 0.15), smoothstep(0.55, 0.95, slope) * 0.5);
  float band = vCave.w;
  rock *= 0.8;
  // each bed has its own tone (sandier / darker shale), partings are irregular dark seams
  float tw = tilt + 1.2 * (cv_n3(vec3(wp.y * 0.21, wp.x * 0.02, wp.z * 0.02)) - 0.5) * 2.0;
  float bedId = floor(tw / 2.3);
  float bed = fract(tw / 2.3);
  float layer = cv_n3(vec3(bedId * 3.1, wp.x * 0.03, wp.z * 0.03));
  rock *= mix(vec3(0.84, 0.85, 0.88), vec3(1.16, 1.08, 0.97), layer);
  float seam = (1.0 - smoothstep(0.0, 0.05 + 0.05 * cv_n3(wp * 0.4), bed)) * smoothstep(0.35, 0.6, cv_n3(wp * 0.15 + 2.0));
  rock *= 1.0 - 0.3 * seam;
  // blotchy weathering at two scales, lichen-dark speckle, iron staining streaking down the face
  float blot = cv_f3(wp * 0.22);
  rock *= 0.85 + 0.3 * blot;
  rock *= 1.0 - 0.25 * smoothstep(0.6, 0.75, cv_n3(wp * 2.3));
  float streak = smoothstep(0.58, 0.85, cv_n3(vec3(wp.x * 0.7, wp.y * 0.05, wp.z * 0.7)));
  rock = mix(rock, rock * vec3(1.35, 1.0, 0.7), streak * 0.6 * slope);
  // wet dark run-off below the brow
  rock *= 1.0 - 0.3 * smoothstep(0.55, 0.8, cv_n3(vec3(wp.x * 1.4, wp.y * 0.08, wp.z * 1.4) + 5.0)) * slope;
  // toward the flanks the rock takes on the terrain cliff's colour, so the two read as one cliff
  rock = mix(rock, terrainRock, 0.5 * smoothstep(0.0, 0.5, band));
  // fractured blocks: crack network on a 1.5–2 m cell scale, each block slightly different in tone
  // blocks elongated along the bedding (anisotropic cells); only some of their joints are open cracks
  cv_pp = an.y > 0.7 ? pp * vec2(0.35, 0.35) : pp * vec2(0.3, 0.62);
  cv_v = cv_vor(cv_pp);
  float openJoint = smoothstep(0.55, 0.75, cv_n3(vec3(cv_pp * 1.7, 3.0)));
  float crackLine = (1.0 - smoothstep(0.01, 0.045, cv_v.x)) * openJoint;
  rock *= 0.92 + 0.16 * cv_v.y;
  rock *= 1.0 - 0.45 * crackLine * (1.0 - kind);
  // --- floor: compacted rubble and grit
  float grit = cv_n3(wp * 3.1);
  float pebble = smoothstep(0.7, 0.85, cv_n3(wp * 2.1 + 7.0)) * 0.6;
  vec3 floorCol = mix(vec3(0.16, 0.15, 0.14), vec3(0.3, 0.28, 0.26), grit) * (0.85 + 0.3 * n2);
  floorCol = mix(floorCol, rock * 1.1, pebble);
  vec3 col = mix(rock, floorCol, kind);
  // --- claw gouges (fresh, slightly paler scraped rock with dark grooves)
  cv_claw = cv_clawDepth(wp) * (1.0 - kind);
  col = mix(col, col * 0.5, cv_claw);
  // --- snow: upward faces and ledges, outside only (sky visibility gate)
  vec3 snow = vec3(0.9, 0.92, 0.95) * (0.94 + 0.08 * n1);
  float sn = cv_f3(wp * 0.35);
  float up = wn.y + 0.35 * (sn - 0.5) + 0.12 * (n2 - 0.5) + 0.45 * smoothstep(0.15, 0.8, band);
  float visGate = smoothstep(0.18, 0.42, cv_vis + 0.12 * (sn - 0.5));
  cv_snow = smoothstep(0.52, 0.72, up) * visGate;
  // floor: snow blown in near the mouth, thinning into the dark
  cv_snow = mix(cv_snow, max(smoothstep(0.2, 0.45, cv_vis + 0.25 * (sn - 0.5)), rim), kind);
  // a dusting on moderately steep rock
  cv_snow = max(cv_snow, smoothstep(0.25, 0.5, up) * 0.35 * visGate * (1.0 - kind));
  col = mix(col, snow, cv_snow * (1.0 - cv_claw));
  cv_rough = mix(0.86, 0.9, cv_snow);
  // baked AO darkens the albedo a little too (crevices read even in direct light)
  col *= mix(1.0, ao, 0.25);
  diffuseColor.rgb = col;
}
`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = cv_rough;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (uDetail > 0.0) {
  vec3 wp = vCWPos;
  float dist = length(cameraPosition - wp);
  float fade = (1.0 - smoothstep(25.0, 120.0, dist)) * uDetail;
  if (fade > 0.0) {
    float e = 0.05;
    float amp = mix(1.0, 0.25, cv_snow);
    #define CV_H(p) (abs(cv_n3((p) * 0.8) - 0.5) * 0.9 + cv_n3((p) * 3.3) * 0.18 + cv_n3((p) * 7.1) * 0.06 - 1.4 * cv_clawDepth(p))
    float h0 = CV_H(wp);
    vec3 g = vec3(CV_H(wp + vec3(e, 0.0, 0.0)) - h0, CV_H(wp + vec3(0.0, e, 0.0)) - h0, CV_H(wp + vec3(0.0, 0.0, e)) - h0) / e;
    vec3 wn = normalize(vCWN);
    g -= wn * dot(g, wn);
    float rockK = 1.0 - min(vCave.z, 1.0);
    // facets: every Voronoi block is a slightly tilted plane, bevelled into the crack between blocks
    vec3 fr = vec3(fract(cv_v.y * 13.7), fract(cv_v.y * 71.3), fract(cv_v.y * 37.1)) - 0.5;
    vec3 an2 = abs(wn);
    vec3 tU = an2.y > 0.7 ? vec3(1.0, 0.0, 0.0) : (an2.x > an2.z ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0));
    vec3 tV = an2.y > 0.7 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    float oj = smoothstep(0.55, 0.75, cv_n3(vec3(cv_pp * 1.7, 3.0)));
    vec3 bevel = (tU * cv_v.z + tV * cv_v.w) * (1.0 - smoothstep(0.01, 0.08, cv_v.x)) * oj;
    wn = normalize(wn - g * amp * fade * 0.5 + (fr * 0.3 - bevel * 0.45) * amp * fade * rockK);
    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  }
}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
{
  float occ = clamp(pow(max(vCave.x, 0.0), 0.85) * (0.35 + 0.65 * vCave.y), 0.0, 1.0);
  reflectedLight.indirectDiffuse *= occ;
  reflectedLight.indirectSpecular *= occ * occ;
  // safety net against shadow-map leaks deep inside (sunlight never reaches past the bend)
  float deep = smoothstep(0.03, 0.2, vCave.x);
  reflectedLight.directDiffuse *= deep;
  reflectedLight.directSpecular *= deep;
}`);
  };
  mat.customProgramCacheKey = () => 'skifree-cave-rock-v1';
  return mat;
}

export function createIcicleMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xd4e6f7, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.88, envMapIntensity: 1.6 });
}
