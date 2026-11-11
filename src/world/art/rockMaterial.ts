/**
 * Triplanar PBR rock material for authored/sculpted geology (cliff kit, islands, sea-cave basalt).
 *
 * - Detail: a baked, tileable PBR set (./textures, made by tools/artbake/bake.mjs): albedo + cavity
 *   AO, and normal XY + height + roughness. Sampled triplanar in absolute world space, at two scales
 *   (the detail tile and a rotated macro tile ~7× larger) so neither the tiling nor any UV stretch
 *   shows — vertical faces are textured exactly like flat ones (the "vertical smearing" of the
 *   heightfield cliffs came from shading a stretched grid; these meshes have no such stretch).
 * - Macro: world-space strata banding (gently dipping, so layers read at a kilometre) and broad
 *   tone variation; optional per-vertex colour (tint × baked AO) from the mesh builders.
 * - Snow: settles only on surfaces flatter than ~55° and fills the cavities of the height map first
 *   (height-blended edges, no white smears on near-vertical faces).
 * - Sea: a wet, dark, glossy band and a thin pale ice-foot just above the water level.
 * - Fog: the game's shared aerial perspective (look/atmosphere.ts), so far cliffs fade exactly
 *   like the terrain and the water.
 *
 * Textures are loaded lazily on first use, shared by every material instance (ref-counted) and
 * freed with the last one. Until they arrive the material renders with flat 0.5 detail (no pop:
 * the macro terms carry the look).
 */
import * as THREE from 'three';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from '../look/atmosphere';

export type RockKind = 'gneiss' | 'basalt';

const URLS: Record<RockKind, { albedo: string; nhr: string; tile: number }> = {
  gneiss: { albedo: new URL('./textures/gneiss_albedo.webp', import.meta.url).href, nhr: new URL('./textures/gneiss_nhr.webp', import.meta.url).href, tile: 8 },
  basalt: { albedo: new URL('./textures/basalt_albedo.webp', import.meta.url).href, nhr: new URL('./textures/basalt_nhr.webp', import.meta.url).href, tile: 4 },
};

interface SetEntry {
  albedo: THREE.Texture;
  nhr: THREE.Texture;
  refs: number;
  ready: Promise<void>;
}
const sets = new Map<RockKind, SetEntry>();
let loader: THREE.TextureLoader | null = null;

function placeholder(c: number, srgb: boolean): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const g = cv.getContext('2d')!;
  g.fillStyle = `rgb(${c},${c},${c})`;
  g.fillRect(0, 0, 1, 1);
  const t = new THREE.Texture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** acquire the shared texture set (lazy load); pair with releaseRockSet */
export function acquireRockSet(kind: RockKind, maxAnisotropy = 4): SetEntry {
  let e = sets.get(kind);
  if (!e) {
    loader ??= new THREE.TextureLoader();
    const u = URLS[kind];
    const albedo = placeholder(70, true);
    const nhr = placeholder(128, false);
    const setup = (t: THREE.Texture, srgb: boolean) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = maxAnisotropy;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
    };
    const entry: SetEntry = { albedo, nhr, refs: 0, ready: Promise.resolve() };
    entry.ready = Promise.all([loader.loadAsync(u.albedo), loader.loadAsync(u.nhr)]).then(([a, n]) => {
      setup(a, true);
      setup(n, false);
      // swap the image into the existing texture objects: materials keep their uniform references
      for (const [dst, src] of [[entry.albedo, a], [entry.nhr, n]] as const) {
        dst.image = src.image;
        dst.colorSpace = src.colorSpace;
        dst.wrapS = dst.wrapT = THREE.RepeatWrapping;
        dst.anisotropy = maxAnisotropy;
        dst.generateMipmaps = true;
        dst.minFilter = THREE.LinearMipmapLinearFilter;
        dst.magFilter = THREE.LinearFilter;
        dst.flipY = true;
        dst.needsUpdate = true;
        src.dispose();
      }
    });
    e = entry;
    sets.set(kind, e);
  }
  e.refs++;
  return e;
}

export function releaseRockSet(kind: RockKind): void {
  const e = sets.get(kind);
  if (!e) return;
  if (--e.refs <= 0) {
    e.albedo.dispose();
    e.nhr.dispose();
    sets.delete(kind);
  }
}

/** every texture set requested so far has finished loading */
export function rockSetsReady(): Promise<void> {
  return Promise.all([...sets.values()].map((s) => s.ready)).then(() => undefined);
}

export interface RockMaterialOptions {
  kind?: RockKind;
  /** water level for the wet band / ice foot (world y); -1e9 = none */
  water?: number;
  /** 0..1 snow cover on flat surfaces */
  snow?: number;
  /** overall tint multiplier on the albedo */
  tint?: THREE.ColorRepresentation;
  /** strength of the world-space strata banding (0 = none) */
  strata?: number;
  /** use the mesh's vertex colours (tint × baked AO) */
  vertexColors?: boolean;
  /** macro scale multiplier of the detail tile (default 7.3) */
  macro?: number;
  /** wet, glossy look everywhere (sea caves); 0..1 */
  wet?: number;
  /** extra skylight floor for shadowed faces (0 = physical only) */
  fill?: number;
  /** two triplanar scales (true) or one (low quality) */
  hq?: boolean;
  /** the mesh carries the shared cave's baked `aCave` (sky visibility, AO): darken the chamber */
  caveAttr?: boolean;
}

export interface RockUniforms {
  uWater: { value: number };
  uSnow: { value: number };
  uOrigin: { value: THREE.Vector3 };
  uStrata: { value: number };
  uWet: { value: number };
  uFill: { value: number };
}

/** A triplanar rock material. Dispose with disposeRockMaterial (releases the shared textures). */
export function createRockMaterial(o: RockMaterialOptions = {}): THREE.MeshStandardMaterial & { userData: { rock: RockUniforms; kind: RockKind } } {
  const kind = o.kind ?? 'gneiss';
  const set = acquireRockSet(kind);
  const tile = URLS[kind].tile;
  const m = new THREE.MeshStandardMaterial({ color: o.tint ?? 0xffffff, roughness: 1, metalness: 0, vertexColors: !!o.vertexColors });
  const U: RockUniforms = {
    uWater: { value: o.water ?? -1e9 },
    uSnow: { value: o.snow ?? 1 },
    uOrigin: { value: new THREE.Vector3() },
    uStrata: { value: o.strata ?? 1 },
    uWet: { value: o.wet ?? 0 },
    uFill: { value: o.fill ?? 0 },
  };
  const macro = o.macro ?? 7.3;
  const hq = o.hq !== false;
  const lumRef = kind === 'basalt' ? 0.045 : 0.075;
  if (o.caveAttr) m.defines = { ...(m.defines ?? {}), RK_CAVE: '' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { tAlb: { value: set.albedo }, tNhr: { value: set.nhr } });
    addAtmosphereUniforms(sh.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRkW;\nvarying vec3 vRkN;\n#ifdef RK_CAVE\nattribute vec4 aCave;\nvarying vec4 vRkCave;\n#endif')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRkW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRkN = normalize(mat3(modelMatrix) * objectNormal);\n#ifdef RK_CAVE\nvRkCave = aCave;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
varying vec3 vRkW;
varying vec3 vRkN;
#ifdef RK_CAVE
varying vec4 vRkCave;
#endif
uniform sampler2D tAlb;
uniform sampler2D tNhr;
uniform float uWater;
uniform float uSnow;
uniform vec3 uOrigin;
uniform float uStrata;
uniform float uWet;
uniform float uFill;
${ATMOSPHERE_GLSL}
float rk_h(vec2 i) { i = mod(i, 289.0); return fract(sin(dot(i, vec2(12.9898, 78.233))) * 43758.5453); }
float rk_n(vec2 q) {
  vec2 i = floor(q), f = fract(q); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rk_h(i), rk_h(i + vec2(1, 0)), u.x), mix(rk_h(i + vec2(0, 1)), rk_h(i + vec2(1, 1)), u.x), u.y);
}
float rk_fbm(vec2 q) { return 0.5 * rk_n(q) + 0.3 * rk_n(q * 2.07 + 5.3) + 0.2 * rk_n(q * 4.11 + 1.7); }
struct RkS { vec4 alb; vec4 nhr; };
// triplanar sample at scale sc (1/m), with a rotation of the planes for the macro layer
RkS rk_tri(vec3 P, vec3 bw, float sc, float rot) {
  float c = cos(rot), s = sin(rot);
  mat2 R = mat2(c, -s, s, c);
  vec2 ux = R * P.zy * sc, uy = R * P.xz * sc, uz = R * P.xy * sc;
  RkS o;
  o.alb = texture(tAlb, ux) * bw.x + texture(tAlb, uy) * bw.y + texture(tAlb, uz) * bw.z;
  vec4 nx = texture(tNhr, ux), ny = texture(tNhr, uy), nz = texture(tNhr, uz);
  o.nhr = nx * bw.x + ny * bw.y + nz * bw.z;
  // world-space normal perturbation (UDN blend): stash the three tangent XYs in a single vector
  vec2 tx = R * (nx.xy * 2.0 - 1.0), ty = R * (ny.xy * 2.0 - 1.0), tz = R * (nz.xy * 2.0 - 1.0);
  o.nhr.xy = vec2(0.0);
  rk_dN = vec3(0.0, tx.y, tx.x) * bw.x + vec3(ty.x, 0.0, ty.y) * bw.y + vec3(tz.x, tz.y, 0.0) * bw.z;
  return o;
}
`.replace('struct RkS', 'vec3 rk_dN;\nstruct RkS'),
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
vec3 rkP = vRkW + uOrigin;
vec3 rkN = normalize(vRkN);
vec3 rkBw = pow(abs(rkN), vec3(5.0));
rkBw /= dot(rkBw, vec3(1.0));
RkS rkA = rk_tri(rkP, rkBw, ${(1 / tile).toFixed(5)}, 0.0);
vec3 rkDN = rk_dN;
${
  hq
    ? `RkS rkB = rk_tri(rkP + vec3(17.3, 5.1, 9.7), rkBw, ${(1 / (tile * macro)).toFixed(5)}, 0.9);
float rkFar = smoothstep(60.0, 600.0, length(vRkW - cameraPosition));
float rkLumB = dot(rkB.alb.rgb, vec3(0.333));
vec4 rkAlb = mix(rkA.alb * vec4(vec3(clamp(0.45 + 0.55 * rkLumB / ${lumRef.toFixed(3)}, 0.5, 1.8)), 1.0), rkB.alb, 0.25 + 0.5 * rkFar);
vec4 rkNhr = mix(rkA.nhr, rkB.nhr, 0.35 + 0.4 * rkFar);
rkDN = mix(rkDN, rk_dN, 0.35 + 0.4 * rkFar);`
    : `vec4 rkAlb = rkA.alb; vec4 rkNhr = rkA.nhr;`
}
// macro: dipping strata bands and broad tone patches (read at a kilometre)
float rkY = rkP.y + 0.035 * rkP.x - 0.02 * rkP.z + 9.0 * rk_fbm(rkP.xz * 0.004);
float rkBand = rk_fbm(vec2(rkY * 0.09, rkP.x * 0.0015 + rkP.z * 0.0015));
float rkBand2 = rk_n(vec2(rkY * 0.33, (rkP.x + rkP.z) * 0.01));
vec3 rkCol = rkAlb.rgb * (1.0 + uStrata * (0.55 * (rkBand - 0.5) + 0.22 * (rkBand2 - 0.5)));
rkCol *= 0.82 + 0.36 * rk_fbm(rkP.xz * 0.011 + rkP.y * 0.006);
float rkAO = rkAlb.a;
float rkH = rkNhr.z;
float rkRough = rkNhr.w;
// sea: wet dark glossy band, thin pale ice foot at the waterline
float rkAbove = rkP.y - uWater;
float rkWetK = max(uWet, 1.0 - smoothstep(0.6, 4.0 + 3.0 * rk_n(rkP.xz * 0.05 + rkP.y * 0.1), rkAbove));
rkCol *= 1.0 - 0.45 * rkWetK;
rkRough = mix(rkRough, 0.32, rkWetK);
float rkIce = smoothstep(0.0, 0.35, rkAbove) * (1.0 - smoothstep(0.9, 1.6 + rk_n(rkP.xz * 0.1), rkAbove)) * step(-1e8, uWater);
// snow: flat-ish surfaces only, cavities first (height-blended edge), patchy at its limit
float rkSnowT = rkN.y + 0.3 * (0.5 - rkH) + 0.16 * (rk_fbm(rkP.xz * 0.06 + rkP.y * 0.03) - 0.5);
float rkSnow = smoothstep(0.6, 0.74, rkSnowT) * uSnow * (1.0 - rkWetK);
#ifdef RK_CAVE
// no snow in the chamber; the floor (kind 1) is grit
rkSnow *= smoothstep(0.55, 0.85, vRkCave.x) * (1.0 - step(0.5, vRkCave.z));
#endif
rkSnow = max(rkSnow, rkIce * 0.85);
vec3 rkSnowCol = vec3(0.86, 0.9, 0.955) * (0.94 + 0.06 * rk_n(rkP.xz * 1.7));
diffuseColor.rgb *= mix(rkCol, rkSnowCol, rkSnow);
`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = mix(rkRough, 0.62, rkSnow);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `{
  vec3 rkNW = normalize(rkN + rkDN * (1.0 - 0.85 * rkSnow) * 1.15);
  normal = normalize((viewMatrix * vec4(rkNW, 0.0)).xyz);
}`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= mix(rkAO, 1.0, rkSnow);
reflectedLight.indirectSpecular *= mix(rkAO, 1.0, rkSnow);
// optional skylight floor for faces in shadow (stylistic fill, kept small)
reflectedLight.indirectDiffuse += uFill * diffuseColor.rgb * vec3(0.55, 0.68, 0.9);
#ifdef RK_CAVE
{
  float vis = clamp(vRkCave.x, 0.0, 1.0) * mix(1.0, clamp(vRkCave.y, 0.0, 1.0), 0.7);
  reflectedLight.indirectDiffuse *= vis;
  reflectedLight.indirectSpecular *= vis;
  // a faint cold bounce deep inside: depth cues, not a void
  reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.03, 0.04, 0.055) * (1.0 - vis);
}
#endif`,
      )
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vRkW);');
  };
  m.customProgramCacheKey = () => `art-rock-${kind}-${hq ? 2 : 1}-${macro}-${o.vertexColors ? 1 : 0}-${o.caveAttr ? 1 : 0}`;
  m.userData = { rock: U, kind };
  return m as THREE.MeshStandardMaterial & { userData: { rock: RockUniforms; kind: RockKind } };
}

export function disposeRockMaterial(m: THREE.MeshStandardMaterial): void {
  const kind = m.userData['kind'] as RockKind | undefined;
  m.dispose();
  if (kind) releaseRockSet(kind);
}
