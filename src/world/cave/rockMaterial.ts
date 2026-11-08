/**
 * Cave rock material: MeshStandardMaterial extended with world-space procedural detail.
 *
 * - Rock: tilted bedding planes with a per-bed tone from the same palette as the terrain's exposed rock
 *   (src/world/snowMaterial.ts), lamination, weathering blotches, dark partings between beds, iron staining
 *   and wet run-off on steep faces. Everything is solid 3D noise in absolute world space: no planar
 *   projections (whose switching drew lines along triangle edges) and no per-cell facets.
 * - Snow: opaque, normal-driven cover with a crisp noisy edge on ledges and upward faces, gated by the
 *   baked sky visibility (none gets inside). Its albedo, blue skylight tint, away-from-sun tint and
 *   atmosphere follow the terrain snow so the two read as one snowpack where they meet.
 * - Floor: compacted grit and rubble, snow blown in near the mouth; at the rim (where it meets the
 *   heightfield of the ledge) it becomes plain terrain snow, fully lit, so no edge shows.
 * - Light: baked occlusion on the indirect light (sky visibility × local AO), a faint cold bounce from
 *   the mouth that falls off with depth (the walls read as receding, not as a cut-out), and direct light
 *   gated off deep inside (shadow-map leak safety net).
 *
 * Vertex attribute `aCave` = (sky visibility, local AO, kind [+ rim], bounce) — kind 0 = rock, 1 = floor.
 * Geometry positions are absolute world coordinates (the floating origin only moves the mesh), so the
 * patterns use the object-space position and stay locked to the rock across origin shifts.
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../snowMaterial';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from '../look/atmosphere';

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
float cv_f3(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*cv_n3(p); p=p*2.07+11.3; a*=0.5;} return s/0.875; }
`;

export interface CaveMaterialOptions {
  claw: ClawFrame;
  /** procedural detail level (0 = none, 1 = full) */
  detail: number;
  /** terrain powder weight around the cave (snow albedo match) */
  powder: number;
}

export function createCaveRockMaterial(o: CaveMaterialOptions): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 });
  const uniforms = {
    uClawO: { value: o.claw.origin.clone() },
    uClawT: { value: o.claw.tangent.clone() },
    uClawU: { value: o.claw.up.clone() },
    uClawN: { value: o.claw.normal.clone() },
    uDetail: { value: o.detail },
    uPowder: { value: o.powder },
    /** occlusion floor right inside the mouth (the bounce fades with depth) */
    uBounce: { value: 0.14 },
    /** faint self-lit cold bounce inside (survives the cinematic's ambient dimming: depth cues, not a void) */
    uGlow: { value: 0.035 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    addAtmosphereUniforms(shader.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aCave;
varying vec4 vCave;
varying vec3 vCWPos;
varying vec3 vAPos;
varying vec3 vCWN;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vCave = aCave;
vCWPos = (modelMatrix * vec4(position, 1.0)).xyz;
vAPos = position;
vCWN = normalize(mat3(modelMatrix) * normal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uClawO; uniform vec3 uClawT; uniform vec3 uClawU; uniform vec3 uClawN;
uniform float uDetail;
uniform float uPowder;
uniform float uBounce;
uniform float uGlow;
varying vec4 vCave;
varying vec3 vCWPos;
varying vec3 vAPos;
varying vec3 vCWN;
${GLSL_NOISE}
${GLSL_NOISE3}
${ATMOSPHERE_GLSL}
float cv_snow = 0.0;
float cv_claw = 0.0;
float cv_rough = 0.86;
float cv_vis = 1.0;
float cv_rim = 0.0;
float cv_dist = 0.0;
vec3 cv_wnG = vec3(0.0, 1.0, 0.0);
// claw gouges: 4 slanted tapered strokes in the face's local frame; returns depth 0..1. A thin slab
// around the face plane, only on surfaces that face the same way (a single set, never repeated on rock
// that folds through the slab behind or below it).
float cv_clawDepth(vec3 wp){
  vec3 q = wp - uClawO;
  float n = dot(q, uClawN);
  if (abs(n) > 0.45) return 0.0;
  float facing = smoothstep(0.35, 0.7, dot(cv_wnG, uClawN));
  if (facing <= 0.0) return 0.0;
  float t = dot(q, uClawT), u = dot(q, uClawU);
  float d = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float len = 0.5 + 0.13 * fi - 0.05 * fi * fi;
    float c = (fi - 1.5) * 0.16 + 0.02 * sin(fi * 2.3);
    float along = (u - 0.04 * fi) / len;         // -1..1 along the stroke
    float x = t - c + along * 0.3 + 0.025 * sin(along * 3.0 + fi * 1.7);
    float w = (0.028 + 0.008 * fi) * (1.0 - along * along);
    float s = (1.0 - smoothstep(w * 0.25, w, abs(x))) * step(abs(along), 1.0);
    d = max(d, s * (0.55 + 0.45 * (1.0 - abs(along))));
  }
  return d * facing * (1.0 - smoothstep(0.3, 0.45, abs(n)));
}
// bedding coordinate (tilted, gently warped strata)
float cv_tw(vec3 p){ return p.y + 0.09 * p.z + 0.04 * p.x + 2.4 * (cv_n3(vec3(p.y * 0.21, p.x * 0.02, p.z * 0.02)) - 0.5); }
// soft V groove of half-width w (m) around distance d
float cv_groove(float d, float w){ return 1.0 - smoothstep(0.0, w, d); }
// Sparse, oriented fractures (A34): open bedding partings plus two vertical joint sets with staggered,
// jittered spacing per bed. Lines end where their bed ends or where a stretched mask closes them; width
// varies along each line. No closed cells: every line is the zero of a single oriented coordinate.
float cv_fracture(vec3 p, float tw){
  float bed = floor(tw / 2.3);
  float bf = tw / 2.3 - bed;
  float wob = cv_n3(p * 0.9) - 0.5;
  // bedding partings, at the bed boundary and an occasional sub-bed split
  float dB = min(bf, 1.0 - bf) * 2.3 + 0.06 * wob + 0.22 * (cv_n3(vec3(p.x * 0.35, p.y * 0.2, p.z * 0.35) + 6.0) - 0.5);
  float sub = abs(fract(tw / 0.77 + 0.3 * fract(bed * 0.618)) - 0.5) * 0.77;
  float mB = smoothstep(0.5, 0.75, cv_n3(vec3(p.x * 0.09, bed * 3.7, p.z * 0.09))) * (0.55 + 0.45 * cv_n3(vec3(p.x * 0.5, bed, p.z * 0.5)));
  float mS = smoothstep(0.62, 0.8, cv_n3(vec3(p.x * 0.11, tw * 0.9, p.z * 0.11) + 3.0));
  float wv = 0.4 + 1.2 * cv_n3(vec3(p.x * 0.35, tw, p.z * 0.35) + 17.0);
  float f = cv_groove(abs(dB), 0.05 * wv) * mB;
  f = max(f, 0.6 * cv_groove(abs(sub + 0.04 * wob), 0.025 * wv) * mS);
  // joint set 1 (strike ~37 deg), set 2 (~110 deg, sparser): vertical planes, offset per bed (joints
  // terminate at the bedding and restart staggered in the next bed)
  vec2 d1 = vec2(0.8, 0.6), d2 = vec2(-0.34, 0.94);
  float j1 = dot(p.xz, d1) + 0.5 * wob + 0.08 * p.y;
  float x1 = j1 / 3.3 + fract(sin(bed * 7.13) * 91.7);
  float c1 = floor(x1);
  float o1 = 0.36 * (fract(sin(c1 * 12.7 + bed * 3.1) * 4375.5) - 0.5);
  float e1 = step(0.4, fract(sin(c1 * 5.3 + bed * 17.9) * 2741.3));
  float dist1 = abs(x1 - c1 - 0.5 - o1) * 3.3;
  float m1 = smoothstep(0.38, 0.62, cv_n3(vec3(dot(p.xz, vec2(-d1.y, d1.x)) * 0.16, p.y * 0.35, c1 * 4.1)));
  float ex1 = smoothstep(0.08, 0.18, bf) * smoothstep(0.08, 0.18, 1.0 - bf); // die out toward bed edges
  ex1 = mix(ex1, 1.0, step(0.75, fract(sin(c1 * 3.9 + bed) * 513.1))); // some cut through the parting
  float face1 = 1.0 - smoothstep(0.7, 0.92, abs(dot(cv_wnG.xz, d1)));
  f = max(f, cv_groove(dist1, 0.045 * wv) * e1 * m1 * ex1 * face1);
  float j2 = dot(p.xz, d2) + 0.7 * wob;
  float x2 = j2 / 5.7 + fract(sin(bed * 3.71) * 37.3);
  float c2 = floor(x2);
  float o2 = 0.3 * (fract(sin(c2 * 9.1 + bed * 1.7) * 3115.1) - 0.5);
  float e2 = step(0.62, fract(sin(c2 * 2.9 + bed * 11.3) * 1977.7));
  float dist2 = abs(x2 - c2 - 0.5 - o2) * 5.7;
  float m2 = smoothstep(0.45, 0.66, cv_n3(vec3(dot(p.xz, vec2(-d2.y, d2.x)) * 0.12, p.y * 0.3, c2 * 2.3 + 8.0)));
  float face2 = 1.0 - smoothstep(0.7, 0.92, abs(dot(cv_wnG.xz, d2)));
  f = max(f, 0.8 * cv_groove(dist2, 0.035 * wv) * e2 * m2 * ex1 * face2);
  return f;
}
`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 ap = vAPos;
  vec3 wn = normalize(vCWN);
  cv_wnG = wn;
  float kind = min(vCave.z, 1.0);
  cv_rim = clamp(vCave.z - 1.0, 0.0, 1.0);
  cv_vis = vCave.x;
  float ao = vCave.y;
  cv_dist = length(cameraPosition - vCWPos);
  float steep = 1.0 - clamp(wn.y, 0.0, 1.0);
  // --- rock: tilted beds, each with its own tone (terrain rock palette)
  float tw = cv_tw(ap);
  float bedId = floor(tw / 2.3);
  float bedF = fract(tw / 2.3);
  float tone = fract(sin(bedId * 12.9898 + 4.1) * 43758.5453);
  vec3 rockA = vec3(0.24, 0.235, 0.235);
  vec3 rockB = vec3(0.31, 0.28, 0.25);
  vec3 rockC = vec3(0.16, 0.16, 0.17);
  vec3 rock = tone < 0.45 ? mix(rockA, rockB, tone / 0.45) : mix(rockB, rockC, (tone - 0.45) / 0.55);
  // lamination inside the bed, weathering blotches at two scales, lichen-dark speckle
  rock *= 0.86 + 0.22 * cv_n3(vec3(ap.x * 0.09, tw * 2.6, ap.z * 0.09));
  // weathering: elongated along the beds (not isotropic blobs, which read as pale sheets laid over the rock)
  rock *= 0.88 + 0.22 * cv_f3(vec3(ap.x * 0.12, tw * 0.55, ap.z * 0.12));
  rock *= 1.0 - 0.2 * smoothstep(0.62, 0.78, cv_n3(ap * 2.3));
  // fine grain (close range only)
  float cv_near = 1.0 - smoothstep(8.0, 40.0, length(cameraPosition - vCWPos));
  rock *= 1.0 + 0.16 * (cv_n3(ap * 9.0) - 0.5) * cv_near;
  // sparse oriented fractures (bedding partings + two joint sets), the same field that creases the
  // shading normals; they fade with distance (no texture-like lattice from afar), depth/darkness varies
  float frac = cv_fracture(ap, tw) * (1.0 - smoothstep(35.0, 90.0, cv_dist)) * (1.0 - kind);
  rock *= 1.0 - frac * (0.32 + 0.25 * cv_n3(ap * 0.33 + 4.0));
  // partings between beds: dark, irregular, open only in places (they follow the strata)
  float seam = (1.0 - smoothstep(0.0, 0.05 + 0.05 * cv_n3(ap * 0.4), bedF)) * smoothstep(0.35, 0.6, cv_n3(ap * 0.15 + 2.0));
  rock *= 1.0 - 0.4 * seam;
  // iron staining and wet run-off streaking down the steep faces
  float streak = smoothstep(0.58, 0.85, cv_n3(vec3(ap.x * 0.7, ap.y * 0.05, ap.z * 0.7)));
  rock = mix(rock, rock * vec3(1.3, 1.0, 0.72), streak * 0.5 * steep);
  rock *= 1.0 - 0.3 * smoothstep(0.55, 0.8, cv_n3(vec3(ap.x * 1.4, ap.y * 0.08, ap.z * 1.4) + 5.0)) * steep;
  // --- floor: compacted rubble and grit
  float grit = cv_n3(ap * 3.1);
  float pebble = smoothstep(0.7, 0.85, cv_n3(ap * 2.1 + 7.0)) * 0.6;
  vec3 floorCol = mix(vec3(0.15, 0.145, 0.14), vec3(0.28, 0.265, 0.25), grit) * (0.85 + 0.3 * cv_n3(ap * 0.6));
  floorCol = mix(floorCol, rock * 1.1, pebble);
  vec3 col = mix(rock, floorCol, kind);
  // --- claw gouges (fresh, slightly paler scraped rock with dark grooves)
  // --- claw gouges: freshly scraped rock is paler (crushed grain), with a thin shadowed core
  cv_claw = cv_clawDepth(ap) * (1.0 - kind);
  vec3 scraped = mix(col, vec3(0.52, 0.5, 0.47), 0.55);
  col = mix(col, scraped, smoothstep(0.05, 0.5, cv_claw));
  col *= 1.0 - 0.35 * smoothstep(0.75, 1.0, cv_claw);
  // --- snow: the terrain's snow albedo (snowMaterial.ts), off-piste
  float n1 = sf_fbm(ap.xz * 0.045);
  float n2 = sf_noise(ap.xz * 0.6);
  float L1 = sf_fbm(ap.xz * 0.0019 + 3.7);
  float L2 = sf_noise(ap.xz * 0.00055 + 1.3);
  float wind = smoothstep(0.42, 0.68, L1 * 0.65 + L2 * 0.35);
  vec3 snow = vec3(0.9, 0.92, 0.95) * (0.94 + 0.08 * n1);
  snow = mix(snow, vec3(0.84, 0.87, 0.92), wind * 0.55);
  snow *= 1.0 + 0.035 * (L2 - 0.5);
  snow = mix(snow, vec3(0.91, 0.925, 0.95), uPowder * 0.6);
  // cover: opaque, normal-driven, crisp noisy edge; none where the sky cannot reach
  float sn = cv_f3(ap * 0.35);
  float up = wn.y + 0.3 * (sn - 0.5) + 0.12 * (n2 - 0.5);
  float visGate = smoothstep(0.16, 0.34, cv_vis + 0.12 * (sn - 0.5));
  cv_snow = smoothstep(0.58, 0.66, up) * visGate;
  // floor: a drift blown in through the mouth thinning into the dark (patchy, not a disc), and plain
  // ledge snow at the rim
  float drift = smoothstep(0.18, 0.46, cv_vis + 0.22 * (sn - 0.5) + 0.12 * (cv_n3(ap * 1.7) - 0.5));
  cv_snow = mix(cv_snow, max(drift, cv_rim), kind);
  col = mix(col, snow, cv_snow * (1.0 - cv_claw));
  // faces turned away from the sun read cold (as the terrain snow)
  #if NUM_DIR_LIGHTS > 0
  {
    vec3 sunW = normalize((vec4(directionalLights[0].direction, 0.0) * viewMatrix).xyz);
    float away = 1.0 - clamp(dot(wn, sunW), 0.0, 1.0);
    col *= mix(vec3(1.0), vec3(0.9, 0.95, 1.05), 0.25 * away * cv_snow);
  }
  #endif
  cv_rough = mix(0.86, mix(0.82, 0.93, uPowder), cv_snow);
  cv_rough = max(cv_rough, 0.95 * cv_claw);
  // baked AO darkens the albedo of the rock a little too (crevices read even in direct light)
  col *= mix(1.0, ao, 0.25 * (1.0 - cv_rim));
  diffuseColor.rgb = col;
}
`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = cv_rough;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
if (uDetail > 0.0) {
  vec3 wp = vAPos;
  float fade = (1.0 - smoothstep(25.0, 120.0, cv_dist)) * uDetail;
  if (fade > 0.0) {
    float e = 0.05;
    // rock: rounded knobs and fine grain; snow: soft wind ripples (as weak as the terrain's)
    float amp = mix(1.0, 0.12, cv_snow);
    // knobs and grain, plus sharp creases: bedding-parallel fractures and vertical joints (shading only)
    // smooth knobs stretched along the beds (no abs()/ridged creases: those closed into quilted cells),
    // fine grain, the sparse fracture grooves and the claw gouges
    #define CV_H(p) (cv_n3(vec3((p).x * 0.55, cv_tw(p) * 1.3, (p).z * 0.55)) * 0.5 + cv_n3((p) * 3.3) * 0.12 + cv_n3((p) * 7.1) * 0.05 - 0.11 * cv_fracture(p, cv_tw(p)) - 0.6 * cv_clawDepth(p))
    float h0 = CV_H(wp);
    vec3 g = vec3(CV_H(wp + vec3(e, 0.0, 0.0)) - h0, CV_H(wp + vec3(0.0, e, 0.0)) - h0, CV_H(wp + vec3(0.0, 0.0, e)) - h0) / e;
    vec3 wn = normalize(vCWN);
    g -= wn * dot(g, wn);
    wn = normalize(wn - g * amp * fade * 0.5);
    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  }
}`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
// skylight is blue: shadowed snow reads cold (as the terrain snow)
reflectedLight.indirectDiffuse *= mix(vec3(0.88, 0.97, 1.2), vec3(1.0), (1.0 - cv_snow) * 0.5);`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
{
  float occ = clamp(pow(max(vCave.x, 0.0), 0.85) * (0.35 + 0.65 * vCave.y), 0.0, 1.0);
  // faint cold bounce from the mouth, falling off with depth: walls and floor recede instead of
  // vanishing into a flat black cut-out
  occ = max(occ, uBounce * vCave.w);
  // at the rim the floor is lit exactly like the ledge snow it meets
  occ = mix(occ, 1.0, cv_rim);
  reflectedLight.indirectDiffuse *= occ;
  reflectedLight.indirectSpecular *= occ * occ;
  // safety net against shadow-map leaks deep inside (sunlight never reaches past the bend)
  float deep = max(smoothstep(0.03, 0.2, vCave.x), cv_rim);
  reflectedLight.directDiffuse *= deep;
  reflectedLight.directSpecular *= deep;
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
// light scattered in from the bright snow outside, falling off with depth (vCave.w), only where the sky
// itself is not seen; tints the rock's own albedo, so the strata stay readable as the chamber recedes
totalEmissiveRadiance += diffuseColor.rgb * vec3(0.62, 0.72, 0.95) * uGlow * vCave.w * (1.0 - smoothstep(0.1, 0.4, vCave.x)) * (1.0 - cv_rim);`,
      )
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vCWPos);');
  };
  mat.customProgramCacheKey = () => 'skifree-cave-rock-v4';
  return mat;
}

/** Ice: slightly blue, translucent, glossy. */
export function createIcicleMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xbcd7ee, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.72, envMapIntensity: 1.8, depthWrite: true });
}
