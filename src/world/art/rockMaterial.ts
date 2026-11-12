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

export type RockKind = 'gneiss' | 'basalt' | 'rock_face_03' | 'cliff_side';

const URLS: Record<RockKind, { albedo: string; nhr: string; tile: number }> = {
  gneiss: { albedo: new URL('./textures/gneiss_albedo.webp', import.meta.url).href, nhr: new URL('./textures/gneiss_nhr.webp', import.meta.url).href, tile: 8 },
  basalt: { albedo: new URL('./textures/basalt_albedo.webp', import.meta.url).href, nhr: new URL('./textures/basalt_nhr.webp', import.meta.url).href, tile: 4 },
  // round 4 integration: photo-scanned CC0 sets from Poly Haven (docs/ASSETS_AND_LICENSES.md), packed
  // into the same layout (1K; AO from the displacement). Regraded in the shader (RockGrade).
  rock_face_03: { albedo: new URL('./textures/rock_face_03_albedo.webp', import.meta.url).href, nhr: new URL('./textures/rock_face_03_nhr.webp', import.meta.url).href, tile: 4 },
  // round 4 (F-011/F-008 follow-up): Poly Haven "Cliff Side" — a layered cliff face, used as the
  // MACRO layer of the sea cliffs (its bedding and ledges read at 100 m–1 km where the 9 m detail
  // tile has averaged out to a flat grey "canvas")
  cliff_side: { albedo: new URL('./textures/cliff_side_albedo.webp', import.meta.url).href, nhr: new URL('./textures/cliff_side_nhr.webp', import.meta.url).href, tile: 40 },
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
  // without a DOM (Node tests build the scenery too) a 1×1 data texture; in the browser a canvas
  // (the loaded image is swapped into the same texture object, which must not be a DataTexture)
  let t: THREE.Texture;
  if (typeof document === 'undefined') t = new THREE.DataTexture(new Uint8Array([c, c, c, 255]), 1, 1);
  else {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const g = cv.getContext('2d')!;
    g.fillStyle = `rgb(${c},${c},${c})`;
    g.fillRect(0, 0, 1, 1);
    t = new THREE.Texture(cv);
  }
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** acquire the shared texture set (lazy load); pair with releaseRockSet */
export function acquireRockSet(kind: RockKind, maxAnisotropy = 4): SetEntry {
  let e = sets.get(kind);
  if (!e) {
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
    if (typeof document !== 'undefined') loader ??= new THREE.TextureLoader();
    // no DOM (Node tests): keep the flat placeholders
    if (typeof document === 'undefined') {
      e = entry;
      sets.set(kind, e);
      e.refs++;
      return e;
    }
    entry.ready = Promise.all([loader!.loadAsync(u.albedo), loader!.loadAsync(u.nhr)]).then(([a, n]) => {
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
    }).catch((err) => console.warn('rock textures failed to load', err));
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

/**
 * The render origin (World's floating origin), shared by every rock material: the triplanar
 * textures are anchored to absolute world space. The location's scenery copies World.origin here
 * every frame (FjordScenery.update).
 */
export const ROCK_ORIGIN = { value: new THREE.Vector3() };

/** mean linear albedo (channel average) of the scanned sets: the macro term and the regrade divide by it */
const SCAN_LUM: Partial<Record<RockKind, number>> = { rock_face_03: 0.154, cliff_side: 0.1136 };

/**
 * Regrade of a scanned set toward cold Nordic rock (the scans are warm sandstone / brown rock):
 * luminance-based — keep the scan's structure (its luminance), drop most of its colour, scale its
 * mean to `lum` (linear) and tint cold.
 */
export interface RockGrade {
  /** target mean linear albedo */
  lum: number;
  /** 0..1 how much of the scan's own colour is removed */
  desat: number;
  tint: [number, number, number];
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
  /** snow settles where the world normal's y exceeds this (0.6 ≈ 53°; islands use a higher value) */
  snowFrom?: number;
  /** the mesh carries the shared cave's baked `aCave` (sky visibility, AO): darken the chamber */
  caveAttr?: boolean;
  /** regrade (scanned sets) */
  grade?: RockGrade;
  /** world size of one texture tile (m); default: the set's own */
  tile?: number;
  /**
   * A second scanned set as a large-scale layer (luminance and cavity only, triplanar): bedding,
   * ledges and broad tone that read from far away. Tile in m (default: the set's own).
   */
  macroSet?: { kind: RockKind; tile?: number; strength?: number };
  /** dark seepage / wet streaks running down steep faces (0 = none) */
  streaks?: number;
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
export function createRockMaterial(o: RockMaterialOptions = {}): THREE.MeshStandardMaterial & { userData: { rock: RockUniforms; kind: RockKind; macroKind?: RockKind } } {
  const kind = o.kind ?? 'gneiss';
  const set = acquireRockSet(kind);
  const tile = o.tile ?? URLS[kind].tile;
  const m = new THREE.MeshStandardMaterial({ color: o.tint ?? 0xffffff, roughness: 1, metalness: 0, vertexColors: !!o.vertexColors });
  const U: RockUniforms = {
    uWater: { value: o.water ?? -1e9 },
    uSnow: { value: o.snow ?? 1 },
    uOrigin: ROCK_ORIGIN,
    uStrata: { value: o.strata ?? 1 },
    uWet: { value: o.wet ?? 0 },
    uFill: { value: o.fill ?? 0 },
  };
  const macro = o.macro ?? 7.3;
  const hq = o.hq !== false;
  const ms = o.macroSet && hq ? acquireRockSet(o.macroSet.kind) : null;
  const msTile = o.macroSet ? (o.macroSet.tile ?? URLS[o.macroSet.kind].tile) : 1;
  const msLum = o.macroSet ? (SCAN_LUM[o.macroSet.kind] ?? 0.1) : 1;
  const msK = o.macroSet?.strength ?? 1;
  if (ms) m.defines = { ...(m.defines ?? {}), RK_MACRO: '' };
  if ((o.streaks ?? 0) > 0) m.defines = { ...(m.defines ?? {}), RK_STREAKS: (o.streaks ?? 0).toFixed(3) };
  const lumRef = SCAN_LUM[kind] ?? (kind === 'basalt' ? 0.045 : 0.075);
  if (o.caveAttr) m.defines = { ...(m.defines ?? {}), RK_CAVE: '' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { tAlb: { value: set.albedo }, tNhr: { value: set.nhr }, tMac: { value: ms ? ms.albedo : set.albedo } });
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
uniform sampler2D tMac;
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
  // (only the up-facing projection is turned and enlarged — on walls the bedding stays horizontal;
  // seen from above, the jointing must not read as masonry)
  vec2 ux = P.zy * sc, uy = mat2(0.825, -0.565, 0.565, 0.825) * R * P.xz * sc * 0.43, uz = P.xy * sc;
  RkS o;
  o.alb = texture(tAlb, ux) * bw.x + texture(tAlb, uy) * bw.y + texture(tAlb, uz) * bw.z;
  vec4 nx = texture(tNhr, ux), ny = texture(tNhr, uy), nz = texture(tNhr, uz);
  o.nhr = nx * bw.x + ny * bw.y + nz * bw.z;
  // world-space normal perturbation (UDN blend): stash the three tangent XYs in a single vector
  vec2 tx = nx.xy * 2.0 - 1.0, ty = transpose(mat2(0.825, -0.565, 0.565, 0.825) * R) * (ny.xy * 2.0 - 1.0), tz = nz.xy * 2.0 - 1.0;
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
// round 4 (D r4 #2: the 9 m detail tile read as a regular dot lattice across a wall at ~1 km): the
// detail's contrast fades out with distance into its own blurred mean, ~25–70 tiles away, where the
// macro layers carry the look; the detail normals fade with it
{
  float rkDist = length(vRkW - cameraPosition);
  float rkFar = smoothstep(${(tile * 25).toFixed(1)}, ${(tile * 70).toFixed(1)}, rkDist);
  vec4 rkMean = texture(tAlb, rkP.xz * 0.0001, 12.0);
  rkA.alb = mix(rkA.alb, vec4(rkMean.rgb, mix(rkA.alb.a, 1.0, 0.7)), rkFar);
  rkDN *= 1.0 - rkFar;
}
${
  hq
    ? `// macro: the same set ~7× larger, read only as soft luminance from a blurred mip (no second
// pattern of lines: it modulates, it never draws), so the detail tiling breaks up at distance
vec2 rkMx = (rkP.zy + vec2(17.3, 5.1)) * ${(1 / (tile * macro)).toFixed(5)}, rkMy = (rkP.xz + vec2(9.7, 3.3)) * ${(1 / (tile * macro)).toFixed(5)}, rkMz = (rkP.xy + vec2(4.1, 11.9)) * ${(1 / (tile * macro)).toFixed(5)};
vec3 rkMac = texture(tAlb, rkMx, 3.5).rgb * rkBw.x + texture(tAlb, rkMy, 3.5).rgb * rkBw.y + texture(tAlb, rkMz, 3.5).rgb * rkBw.z;
float rkLumB = dot(rkMac, vec3(0.333));
vec4 rkAlb = rkA.alb * vec4(vec3(clamp(0.35 + 0.65 * rkLumB / ${lumRef.toFixed(3)}, 0.55, 1.6)), 1.0);
vec4 rkNhr = rkA.nhr;`
    : `vec4 rkAlb = rkA.alb; vec4 rkNhr = rkA.nhr;`
}
${
  o.grade
    ? `{
  float gl = dot(rkAlb.rgb, vec3(0.2126, 0.7152, 0.0722));
  rkAlb.rgb = mix(rkAlb.rgb, vec3(gl), ${o.grade.desat.toFixed(3)}) * vec3(${o.grade.tint.map((v) => v.toFixed(3)).join(', ')}) * ${(o.grade.lum / (SCAN_LUM[kind] ?? 0.1)).toFixed(4)};
}`
    : ''
}
// macro: dipping strata bands and broad tone patches (read at a kilometre)
float rkY = rkP.y + 0.035 * rkP.x - 0.02 * rkP.z + 9.0 * rk_fbm(rkP.xz * 0.004);
float rkBand = rk_fbm(vec2(rkY * 0.09, rkP.x * 0.0015 + rkP.z * 0.0015));
float rkBand2 = rk_n(vec2(rkY * 0.33, (rkP.x + rkP.z) * 0.01));
vec3 rkCol = rkAlb.rgb * (1.0 + uStrata * (0.55 * (rkBand - 0.5) + 0.22 * (rkBand2 - 0.5)));
rkCol *= 0.82 + 0.36 * rk_fbm(rkP.xz * 0.011 + rkP.y * 0.006);
#ifdef RK_MACRO
{
  // the macro scan: its luminance (bedding, ledges, broad tone) and cavity, never its colour; the
  // top projection is rotated so its layering never draws straight lines across a plateau
  float mt = ${(1 / msTile).toFixed(5)};
  vec3 mP = rkP + vec3(31.7, 7.3, 13.1);
  // (mip-biased: the scan's thin sandstone bedding must not tile into a pinstripe across a wall —
  // only its broad ledges and tone survive)
  vec4 m1 = texture(tMac, mP.zy * mt, 2.2) * rkBw.x + texture(tMac, mat2(0.6, -0.8, 0.8, 0.6) * mP.xz * mt, 2.2) * rkBw.y + texture(tMac, mP.xy * mt, 2.2) * rkBw.z;
  // and the same layer twice as large again, so it never repeats visibly across a whole wall
  vec4 m2 = texture(tMac, mP.zy * mt * 0.37 + 0.31, 1.5) * rkBw.x + texture(tMac, mat2(0.6, -0.8, 0.8, 0.6) * mP.xz * mt * 0.37, 1.5) * rkBw.y + texture(tMac, mP.xy * mt * 0.37 + 0.53, 1.5) * rkBw.z;
  float ml = dot(m1.rgb, vec3(0.2126, 0.7152, 0.0722)) / ${msLum.toFixed(4)};
  float ml2 = dot(m2.rgb, vec3(0.2126, 0.7152, 0.0722)) / ${msLum.toFixed(4)};
  float mod1 = clamp(0.3 + 0.7 * ml * mix(1.0, m1.a, 0.8), 0.35, 1.75);
  float mod2 = clamp(0.45 + 0.55 * ml2 * m2.a, 0.5, 1.5);
  rkCol *= mix(1.0, mod1 * mod2, ${msK.toFixed(3)});
}
#endif
#ifdef RK_STREAKS
{
  // seepage: dark wet streaks down steep faces from ledges and cracks (long in y, narrow across)
  float steep = 1.0 - smoothstep(0.35, 0.7, abs(rkN.y));
  float across = (rkP.x * 0.8 + rkP.z * 0.6) * 0.07;
  float sk = rk_fbm(vec2(across, rkP.y * 0.006 + 0.15 * rk_n(vec2(across * 0.3, 2.0))));
  float st = smoothstep(0.55, 0.78, sk) * (0.6 + 0.4 * rk_n(vec2(across * 2.3, rkP.y * 0.05)));
  rkCol *= 1.0 - RK_STREAKS * 0.5 * st * steep;
  // and broad, cold / warm tone zones a few hundred metres across (no wall is one grey)
  float zone = rk_fbm(vec2((rkP.x + rkP.z) * 0.0021, rkP.y * 0.0035) + 3.7);
  rkCol *= mix(vec3(0.72, 0.78, 0.86), vec3(1.08, 1.06, 1.04), zone) * (0.72 + 0.5 * zone);
}
#endif
float rkAO = rkAlb.a;
float rkH = rkNhr.z;
float rkRough = rkNhr.w;
// sea: wet dark glossy band, thin pale ice foot at the waterline
float rkAbove = rkP.y - uWater;
float rkWetK = max(uWet, 1.0 - smoothstep(0.6, 4.0 + 3.0 * rk_n(rkP.xz * 0.05 + rkP.y * 0.1), rkAbove));
rkCol *= 1.0 - 0.45 * rkWetK;
rkRough = mix(rkRough, 0.32, rkWetK);
// (review p2: a thin, broken rime line ≤ ~0.35 m, not white patches clinging to vertical rock)
float rkIce = smoothstep(0.03, 0.1, rkAbove) * (1.0 - smoothstep(0.22, 0.35, rkAbove)) * step(-1e8, uWater) * smoothstep(0.45, 0.7, rk_n(rkP.xz * 0.35 + rkP.y));
// snow: flat-ish surfaces only, cavities first (height-blended edge), patchy at its limit
float rkSnowT = rkN.y + 0.1 * (0.5 - rkH) + 0.2 * (rk_fbm(rkP.xz * 0.06 + rkP.y * 0.03) - 0.5) + 0.14 * (rk_fbm(rkP.xz * 0.012) - 0.5);
float rkSnow = smoothstep(${(o.snowFrom ?? 0.6).toFixed(3)}, ${((o.snowFrom ?? 0.6) + 0.14).toFixed(3)}, rkSnowT) * uSnow * (1.0 - rkWetK);
// spray zone: no snow lies on the wave-washed foot (the notch's lip and talus just above the sea)
rkSnow *= mix(1.0, smoothstep(2.5, 8.0, rkAbove), step(-1e8, uWater));
#ifdef RK_CAVE
// no snow in the chamber; the floor (kind 1) is grit
rkSnow *= smoothstep(0.55, 0.85, vRkCave.x) * (1.0 - step(0.5, vRkCave.z));
#endif
rkSnow = max(rkSnow, rkIce * 0.55);
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
  // safety net against shadow-map leaks inside (round 4: the shared cave material gates the sun
  // there too; without it an inner wall read as a sunlit tan slab in the mouth)
  float deep = smoothstep(0.03, 0.2, vRkCave.x);
  reflectedLight.directDiffuse *= deep;
  reflectedLight.directSpecular *= deep;
}
#endif`,
      )
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = sf_atmosphere(gl_FragColor.rgb, vRkW);');
  };
  m.customProgramCacheKey = () => `art-rock-${kind}-${hq ? 2 : 1}-${macro}-${o.vertexColors ? 1 : 0}-${o.caveAttr ? 1 : 0}-${o.snowFrom ?? 0.6}-${o.grade ? JSON.stringify(o.grade) : ''}-${tile}-${ms ? `${o.macroSet!.kind}:${msTile}:${msK}` : ''}-${o.streaks ?? 0}`;
  m.userData = { rock: U, kind, macroKind: ms ? o.macroSet!.kind : undefined };
  return m as THREE.MeshStandardMaterial & { userData: { rock: RockUniforms; kind: RockKind; macroKind?: RockKind } };
}

export function disposeRockMaterial(m: THREE.MeshStandardMaterial): void {
  const kind = m.userData['kind'] as RockKind | undefined;
  const mk = m.userData['macroKind'] as RockKind | undefined;
  m.dispose();
  if (kind) releaseRockSet(kind);
  if (mk) releaseRockSet(mk);
}
