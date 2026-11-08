/**
 * Yeti materials: leathery skin/undercoat base, instanced shell fur, fur-lock cards,
 * teeth/claws and the eyes (glint + glow). All procedural.
 */
import * as THREE from 'three';

const NOISE_GLSL = /* glsl */ `
vec3 yHash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float yHash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float yNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = yHash13(i), n100 = yHash13(i + vec3(1,0,0)), n010 = yHash13(i + vec3(0,1,0)), n110 = yHash13(i + vec3(1,1,0));
  float n001 = yHash13(i + vec3(0,0,1)), n101 = yHash13(i + vec3(1,0,1)), n011 = yHash13(i + vec3(0,1,1)), n111 = yHash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
// nearest jittered feature point among the 8 closest cells: xyz = point (cell units), w = random id
vec4 yCell(vec3 p) {
  vec3 ip = floor(p); vec3 fp = p - ip;
  vec3 o = step(0.5, fp) - 1.0;
  float best = 1e9; vec4 res = vec4(0.0);
  for (int k = 0; k < 2; k++) for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec3 c = ip + o + vec3(float(i), float(j), float(k));
    vec3 r = yHash33(c);
    vec3 fpnt = c + 0.12 + 0.76 * r;
    vec3 dv = fpnt - p; float d2 = dot(dv, dv);
    if (d2 < best) { best = d2; res = vec4(fpnt, r.z); }
  }
  return res;
}
`;

/**
 * Procedural facial relief in bind space (metres): negative = crease. Crow's feet and under-eye folds,
 * horizontal nose-bridge creases, brow furrows, deep snarl (nasolabial) folds, vertical lip wrinkles, pores.
 */
const WRINKLE_GLSL = /* glsl */ `
float ySegDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float yWrinkle(vec3 p) {
  float h = 0.0;
  float ax = abs(p.x);
  // irregularity: every family of folds is broken up by low-frequency noise
  float m1 = smoothstep(0.25, 0.75, yNoise(p * 55.0 + 3.1));
  float m2 = smoothstep(0.3, 0.8, yNoise(p * 38.0 + 7.7));
  float jit = (yNoise(p * 140.0) - 0.5) * 2.0;
  // eyes: radial crow's feet on the outer side, two soft folds under the eye
  vec2 e = vec2(ax - 0.085, p.y - 2.948);
  float d = length(e * vec2(1.0, 1.25));
  float ring = smoothstep(0.03, 0.04, d) * (1.0 - smoothstep(0.05, 0.068, d));
  float ang = atan(e.y, e.x);
  float outer = smoothstep(0.005, 0.03, e.x);
  h -= ring * outer * pow(abs(sin(ang * 9.0 + jit * 0.8)), 8.0) * 0.35 * (0.5 + 0.5 * m1);
  float below = smoothstep(-0.004, -0.025, e.y) * (1.0 - smoothstep(0.02, 0.05, abs(e.x)));
  h -= ring * below * pow(0.5 + 0.5 * sin(d * 260.0 + jit), 6.0) * 0.3;
  // nose bridge: a few horizontal creases between the eyes
  float bridge = exp(-pow(p.x / 0.028, 2.0)) * smoothstep(2.935, 2.95, p.y) * (1.0 - smoothstep(2.975, 2.99, p.y));
  h -= bridge * pow(0.5 + 0.5 * sin(p.y * 470.0 + jit * 1.5), 6.0) * 0.4 * (0.4 + 0.6 * m2);
  // snarl folds from the nostril wings down past the mouth corners (the one strong crease)
  float sd = ySegDist(vec2(ax, p.y), vec2(0.062, 2.885), vec2(0.122, 2.8)) + jit * 0.0015;
  float front = smoothstep(0.27, 0.33, p.z);
  h -= exp(-pow(sd / 0.007, 2.0)) * front * 0.9;
  h += exp(-pow((sd - 0.012) / 0.009, 2.0)) * front * 0.18;
  // upper lip: faint, irregular vertical wrinkles
  float lip = smoothstep(2.8, 2.81, p.y) * (1.0 - smoothstep(2.835, 2.85, p.y)) * smoothstep(0.35, 0.375, p.z);
  h -= lip * pow(0.5 + 0.5 * sin(p.x * 330.0 + jit * 2.0), 8.0) * 0.18 * m1;
  // pores + leathery grain
  h -= pow(yNoise(p * 1100.0), 6.0) * 0.45;
  h += (yNoise(p * 260.0) - 0.5) * 0.14 + (yNoise(p * 90.0) - 0.5) * 0.12;
  return h;
}
`;

/**
 * Depth shade shared by every Yeti material (1 = normal, 0 = black): scales ALL reflected light — diffuse,
 * specular, clearcoat, environment, the fur rim term and the fake eye glints — but not emissive radiance, so a
 * shaded Yeti deep in a cave goes near-black while the glowing eyes stay visible. Fog is applied afterwards.
 */
export type ShadeUniform = THREE.IUniform<number>;
export function createShadeUniform(): ShadeUniform {
  return { value: 1 };
}
const SHADE_DECL = 'uniform float uShade;';
/** GLSL: scale the non-emissive part of outgoingLight (insert right before <opaque_fragment>). */
const SHADE_APPLY = /* glsl */ `outgoingLight = (outgoingLight - totalEmissiveRadiance) * uShade + totalEmissiveRadiance;`;
function injectShade(shader: THREE.WebGLProgramParametersWithUniforms, u: ShadeUniform): void {
  shader.uniforms.uShade = u;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${SHADE_DECL}`)
    .replace('#include <opaque_fragment>', `${SHADE_APPLY}\n  #include <opaque_fragment>`);
}

export interface FurUniforms {
  uShells: THREE.IUniform<number>;
  uFurScale: THREE.IUniform<number>;
  /** longest shell strand (m): the shells are the dense short undercoat, the long shag is the lock cards */
  uShellMax: THREE.IUniform<number>;
  uGravity: THREE.IUniform<THREE.Vector3>;
  uMotion: THREE.IUniform<THREE.Vector3>;
  uDensity: THREE.IUniform<number>;
  uClumpDensity: THREE.IUniform<number>;
  uClump: THREE.IUniform<number>;
  uRim: THREE.IUniform<THREE.Color>;
}

export function createFurUniforms(shells: number): FurUniforms {
  return {
    uShells: { value: shells },
    uFurScale: { value: 1 },
    uShellMax: { value: 0.035 },
    uGravity: { value: new THREE.Vector3(0, -0.9, -0.25) },
    uMotion: { value: new THREE.Vector3() },
    uDensity: { value: 380 },
    uClumpDensity: { value: 36 },
    uClump: { value: 0.75 },
    uRim: { value: new THREE.Color(0.62, 0.6, 0.57) },
  };
}

/** Warm off-white pelt palette shared by shells and cards (no blue cast: the sky light supplies the cool side). */
/**
 * White fur scatters light into its own shadows: the indirect (sky) light reaching the pelt is warmed and lifted a
 * little instead of reading as cold blue in every gap between the locks. It only rescales light that arrives (it
 * vanishes in a dark cave and follows uShade).
 */
const FUR_SCATTER = /* glsl */ `reflectedLight.indirectDiffuse *= vec3(1.12, 1.04, 0.9);
  #include <aomap_fragment>`;

const FUR_PALETTE_GLSL = /* glsl */ `
vec3 yFurColor(vec3 P, float id, float clumpId) {
  float n1 = yNoise(P * 2.1);
  float n2 = yNoise(P * 6.3 + 3.7);
  vec3 ivory = vec3(0.93, 0.91, 0.86);
  vec3 cream = vec3(0.95, 0.89, 0.78);
  vec3 ash = vec3(0.7, 0.68, 0.65);
  vec3 c = mix(ivory, cream, smoothstep(0.35, 0.8, n1));
  c = mix(c, ash, smoothstep(0.55, 0.9, n2) * 0.5 + smoothstep(0.65, 0.95, clumpId) * 0.18);
  return c * (0.86 + 0.2 * id);
}
`;

/**
 * Shell fur = the dense, short undercoat (one instanced draw; instance attribute \`shell\` = shell index).
 * Strands are fine, clumped toward their tips and combed along gravity/motion; their edges are soft (alpha-to-coverage
 * when MSAA is on, a plain alpha test otherwise). The shells are capped at uShellMax so the spacing between shells
 * stays a few millimetres (no stacked "rice grain" slices, no chips floating off the silhouette).
 */
export function createShellMaterial(u: FurUniforms, shade: ShadeUniform): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, alphaTest: 0.5 });
  m.alphaToCoverage = true;
  m.name = 'YetiShellFur';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
attribute float shell;
attribute vec4 furData;
attribute vec3 furComb;
uniform float uShells;
uniform float uFurScale;
uniform float uShellMax;
uniform vec3 uGravity;
uniform vec3 uMotion;
varying vec3 vFurP;
varying float vFurH;
varying float vFurLen;
varying float vFurAO;
varying float vFurCov;`,
      )
      .replace(
        '#include <skinning_vertex>',
        /* glsl */ `#include <skinning_vertex>
  float fh = (shell + 1.0) / uShells;
  // short undercoat: long pelts are capped (the lock cards carry the length), short fur keeps its length
  float fl0 = furData.x * uFurScale;
  float fl = min(fl0 * 0.6, uShellMax) * smoothstep(0.0, 0.012, fl0);
  vec3 fn = normalize(objectNormal);
  #ifdef USE_SKINNING
    vec3 fcomb = (skinMatrix * vec4(furComb, 0.0)).xyz;
  #else
    vec3 fcomb = furComb;
  #endif
  // strands leave the skin along the normal and lie down along gravity / trail with motion (combed pelt);
  // facial fringe hairs are combed over the edge of the skin
  vec3 lay = uGravity + uMotion + fcomb;
  lay -= fn * min(0.0, dot(lay, fn)) * 0.7;
  transformed += fn * (fh * fl * 0.75) + lay * (fh * fh * fl);
  vFurP = position;
  vFurH = fh;
  vFurLen = fl;
  vFurAO = furData.z;
  vFurCov = furData.w;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform float uDensity;
uniform float uClumpDensity;
uniform float uClump;
uniform vec3 uRim;
varying vec3 vFurP;
varying float vFurH;
varying float vFurLen;
varying float vFurAO;
varying float vFurCov;
${NOISE_GLSL}
${FUR_PALETTE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
  if (vFurLen < 0.004 || vFurCov < 0.01) discard;
  vec3 P = vFurP;
  // combed pelt: the strand/clump lattice is stretched along the comb direction (hangs down the body, sweeps back
  // from the face over the skull), so each shell slice is a short dash along the hair and the stack reads as
  // directional hair rather than a uniform plush
  vec3 fHead = normalize(vec3(P.x, P.y - 2.86, P.z - 0.55)) + vec3(0.0, -0.55, 0.0);
  vec3 F = normalize(mix(vec3(0.0, -1.0, -0.25), normalize(fHead), smoothstep(2.6, 2.72, P.y)));
  vec3 Pf = P - F * (dot(P, F) * 0.62);
  // clumping: strands converge toward clump centres toward their tips (tufts, not dots)
  vec4 cl = yCell(Pf * uClumpDensity);
  vec3 cpos = cl.xyz / uClumpDensity;
  float clump = uClump * (0.55 + 0.45 * cl.w);
  vec3 Pc = Pf + (cpos - Pf) * clump * vFurH;
  vec4 st = yCell(Pc * uDensity);
  float d = length(st.xyz - Pc * uDensity);
  // toward the face the pelt does not thin into scattered single strands (they read as confetti over the dark
  // skin): the coat ends at an organic, noisy edge and the fringe lock cards overlap that edge instead
  float edgeN = yNoise(P * 28.0) * 0.5 + yNoise(P * 90.0) * 0.3 + yNoise(P * 240.0) * 0.2;
  float covN = vFurCov + (edgeN - 0.5) * 0.3;
  // closed coat inside the edge; a band of dense, short strands combed over the edge (fuzzy, not dotted)
  float coat = smoothstep(0.64, 0.72, covN);
  float zone = smoothstep(0.5, 0.58, covN);
  if (zone < 0.01) discard;
  float hmax = mix(0.55, 1.0, fract(st.w * 17.31)) * mix(0.55, 1.0, coat);
  float tH = vFurH / hmax;
  float radius = 0.95 * (1.0 - pow(min(tH, 1.0), 1.6));
  float a = (1.0 - smoothstep(radius * 0.45, radius, d)) * step(tH, 1.0);
  // the lowest shells are a closed undercoat (only inside the coat edge); above it strands taper to fine tips
  a = max(a, (1.0 - smoothstep(0.2, 0.36, vFurH)) * coat);
  a *= 1.0 - smoothstep(0.75, 1.0, tH) * 0.6;
  a *= zone;
  diffuseColor.a = a;
  vec3 fc = yFurColor(P, fract(st.w * 7.13), cl.w);
  // self-shadowing toward the roots: the gaps between strands read darker, so the combed strands show as texture
  // (not a flat plush) — kept moderate so it does not turn into salt-and-pepper
  float ao = mix(0.6, 1.0, pow(vFurH, 0.8)) * mix(vFurAO, 1.0, 0.5 + 0.5 * vFurH);
  diffuseColor.rgb = fc * ao * diffuse;`,
      )
      .replace('#include <aomap_fragment>', FUR_SCATTER)
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `{
    float rimF = pow(1.0 - saturate(dot(normal, geometryViewDir)), 3.0);
    outgoingLight += uRim * rimF * 0.12 * vFurH * diffuseColor.rgb;
  }
  #include <opaque_fragment>`,
      );
    injectShade(shader, shade);
  };
  m.customProgramCacheKey = () => 'yeti-shell-fur-v4';
  return m;
}

/** Base surface: undercoat in furred areas, dark grey-blue leathery skin on face/palms/soles. */
export function createSkinMaterial(shade: ShadeUniform): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
  m.name = 'YetiSkin';
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 furData;
varying vec3 vSkinP;
varying float vBare;
varying mat3 vB2V;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  vSkinP = position;
  vBare = furData.y;
  #ifdef USE_SKINNING
    vB2V = normalMatrix * mat3(skinMatrix);
  #else
    vB2V = normalMatrix;
  #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vSkinP;
varying float vBare;
varying mat3 vB2V;
${NOISE_GLSL}
${WRINKLE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  float sn = yNoise(vSkinP * 90.0) * 0.6 + yNoise(vSkinP * 260.0) * 0.4;
  float blot = yNoise(vSkinP * 14.0);
  diffuseColor.rgb *= mix(1.0, 0.86 + 0.2 * sn, vBare) * (0.95 + 0.1 * blot);
  // wrinkles & pores (bind space) on bare skin: height + gradient by central differences
  float yWr = 0.0;
  vec3 yWrG = vec3(0.0);
  if (vBare > 0.02) {
    const float he = 0.0012;
    yWr = yWrinkle(vSkinP);
    yWrG = vec3(yWrinkle(vSkinP + vec3(he, 0.0, 0.0)), yWrinkle(vSkinP + vec3(0.0, he, 0.0)), yWrinkle(vSkinP + vec3(0.0, 0.0, he))) - yWr;
    yWrG /= he;
    // creases and pores collect darkness, ridges catch a little light
    diffuseColor.rgb *= mix(1.0, clamp(1.0 + 0.7 * yWr, 0.55, 1.1), vBare);
  }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  // greasy leather: shinier on the ridges, matte in the creases
  roughnessFactor = mix(0.95, 0.6 + 0.2 * sn - 0.2 * clamp(yWr, -0.4, 0.4), vBare);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  if (vBare > 0.02) {
    // wrinkle / pore relief: bind-space height gradient carried to view space through the skinning
    vec3 gv = vB2V * yWrG;
    gv -= normal * dot(gv, normal);
    normal = normalize(normal - gv * 0.0024 * vBare);
  }`,
      );
    injectShade(shader, shade);
  };
  m.customProgramCacheKey = () => 'yeti-skin-v3';
  return m;
}

/** Number of lock variants in the card atlas (columns). */
export const LOCK_VARIANTS = 8;

/**
 * Canvas atlas of LOCK_VARIANTS clumped hair locks (white, alpha), roots at the top (v = 1). Each lock is a bundle of
 * tapering strands that spread at the root and converge into a pointed, slightly curled tip — a clump of hair,
 * not a flat feather. The core of the bundle is dense (its coverage survives mip-mapping) and the flanks carry a
 * few loose strands, so the card edge breaks up into hairs instead of a hard cut.
 */
export function createLockTexture(): THREE.Texture {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round';
  let seed = 99;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const cw = W / LOCK_VARIANTS;
  for (let lock = 0; lock < LOCK_VARIANTS; lock++) {
    const x0 = lock * cw;
    const cx = x0 + cw * 0.5;
    // tip position and curl of this lock
    const tipX = cx + (rnd() - 0.5) * cw * 0.3;
    const curl = (rnd() - 0.5) * cw * 0.5;
    const strands = 46;
    for (let s = 0; s < strands; s++) {
      const stray = s >= strands - 7;
      const u = rnd() * 2 - 1; // position across the root
      const startX = cx + u * cw * (stray ? 0.42 : 0.34);
      const len = H * (stray ? 0.45 + 0.4 * rnd() : 0.72 + 0.27 * rnd()) * (1 - 0.18 * Math.abs(u));
      // strands converge toward the tip (clump) — strays less so
      const conv = stray ? 0.35 : 0.8 + 0.2 * rnd();
      const endX = startX + (tipX + (rnd() - 0.5) * cw * 0.12 - startX) * conv * (len / H);
      const ctrlX = (startX + endX) / 2 + curl * (0.6 + 0.4 * rnd()) + (rnd() - 0.5) * cw * 0.08;
      const steps = 14;
      const g = Math.floor(185 + 70 * rnd());
      const w0 = stray ? 1.3 : 1.8 + 1.6 * rnd();
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const bx = (t: number): number => (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * endX;
        const a = (1 - Math.pow(t0, 2.2) * 0.75) * (stray ? 0.8 : 1);
        ctx.strokeStyle = `rgba(${g},${g},${g},${a})`;
        ctx.lineWidth = Math.max(0.7, w0 * (1 - 0.8 * t0));
        ctx.beginPath();
        ctx.moveTo(bx(t0), t0 * len);
        ctx.lineTo(bx(t1), t1 * len);
        ctx.stroke();
      }
    }
  }
  // Rebuild as a DataTexture whose transparent texels keep a light colour, so filtering/mips
  // never bleed a dark fringe around the strands.
  const img = ctx.getImageData(0, 0, W, H);
  const src = img.data;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 4;
      const di = ((H - 1 - y) * W + x) * 4; // flip so roots (canvas top) are at v = 1
      const a = src[si + 3];
      const c = a > 8 ? src[si] : 225;
      data[di] = c;
      data[di + 1] = c;
      data[di + 2] = c;
      data[di + 3] = a;
    }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Lock cards: alpha-to-coverage (smooth edges with MSAA, a plain alpha test without), lit with the underlying body
 * normal (soft fur volume rather than flat shiny blades), a tip-ward alpha boost so the mip-mapped lock keeps
 * its shape at a distance.
 */
export function createCardMaterial(tex: THREE.Texture, shade: ShadeUniform, fur: FurUniforms): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    vertexColors: true,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.97,
    metalness: 0,
  });
  m.alphaToCoverage = true;
  m.name = 'YetiFurCards';
  // cards carry the underlying body normal: undo three's back-face normal flip so both sides shade like fur volume
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uMotion = fur.uMotion;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 cardData;
uniform vec3 uMotion;`,
      )
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
  // after skinning (model space, +Y up): the tips sag under gravity whatever the body's pitch, and trail
  // behind the motion (combed back along the velocity in the gallop, so the limbs read in silhouette)
  transformed += (vec3(0.0, -0.32, 0.0) + uMotion * 1.6) * (cardData.x * cardData.x * cardData.y);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
  #ifdef DOUBLE_SIDED
    normal *= faceDirection;
  #endif`,
      )
      .replace('#include <aomap_fragment>', FUR_SCATTER)
      .replace(
        '#include <alphatest_fragment>',
        `// mip-mapped strands lose alpha at a distance: sharpen the coverage so the lock keeps its body
  diffuseColor.a = clamp((diffuseColor.a - 0.5) * 1.6 + 0.5, 0.0, 1.0);
  #include <alphatest_fragment>`,
      );
    injectShade(shader, shade);
  };
  m.customProgramCacheKey = () => 'yeti-cards-v3';
  return m;
}

export function createHardMaterial(shade: ShadeUniform): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  });
  m.name = 'YetiTeethClaws';
  m.onBeforeCompile = (shader) => injectShade(shader, shade);
  m.customProgramCacheKey = () => 'yeti-hard-v1';
  return m;
}

export interface EyeMaterial {
  material: THREE.MeshPhysicalMaterial;
  glow: THREE.IUniform<number>;
}

export function createEyeMaterial(shade: ShadeUniform): EyeMaterial {
  const glow: THREE.IUniform<number> = { value: 0 };
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.15,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    emissive: new THREE.Color(1.0, 0.62, 0.18),
  });
  m.name = 'YetiEyes';
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow;
    shader.uniforms.uShade = shade;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uGlow;\n${SHADE_DECL}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  // both eyes share one glow; a faint self-illumination of the iris keeps them alive in shadowed sockets
  float yFace = saturate(dot(normal, isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-vViewPosition)));
  totalEmissiveRadiance = emissive * vColor.rgb * vColor.rgb * (uGlow * 16.0 + 0.9 * uShade) * (0.55 + 0.45 * yFace);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
    // fixed key glint so the eyes always catch a highlight, even deep in the sockets
    // (a key glint plus a near-camera catch-light, both in view space: whichever part of each eye is visible
    // gets one, so neither eye reads dead from a 3/4 view)
    vec3 r = reflect(-geometryViewDir, normal);
    float gl = pow(saturate(dot(r, normalize(vec3(0.35, 0.55, 0.75)))), 160.0);
    float gc = pow(saturate(dot(r, normalize(vec3(0.12, 0.3, 1.0)))), 420.0);
    float wet = pow(1.0 - yFace, 3.0) * 0.12;
    // reflected light follows the depth shade; the glints survive in the dark only as far as the eyes glow
    ${SHADE_APPLY}
    float glintK = max(uShade, min(1.0, uGlow * 1.5));
    outgoingLight += (vec3(1.0, 0.97, 0.9) * (gl * 1.6 + gc * 2.2) + vec3(0.8, 0.85, 0.9) * wet) * glintK;
  }
  #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'yeti-eyes-v3';
  return { material: m, glow };
}
