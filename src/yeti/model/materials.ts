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

export interface FurUniforms {
  uShells: THREE.IUniform<number>;
  uFurScale: THREE.IUniform<number>;
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
    uGravity: { value: new THREE.Vector3(0, -0.85, 0) },
    uMotion: { value: new THREE.Vector3() },
    uDensity: { value: 210 },
    uClumpDensity: { value: 20 },
    uClump: { value: 0.68 },
    uRim: { value: new THREE.Color(0.55, 0.62, 0.75) },
  };
}

/** Shell fur: one instanced draw; instance attribute `shell` = shell index. */
export function createShellMaterial(u: FurUniforms): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  m.name = 'YetiShellFur';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
attribute float shell;
attribute vec3 furData;
uniform float uShells;
uniform float uFurScale;
uniform vec3 uGravity;
uniform vec3 uMotion;
varying vec3 vFurP;
varying float vFurH;
varying float vFurLen;
varying float vFurAO;`,
      )
      .replace(
        '#include <skinning_vertex>',
        /* glsl */ `#include <skinning_vertex>
  float fh = (shell + 1.0) / uShells;
  float fl = furData.x * uFurScale;
  vec3 fn = normalize(objectNormal);
  // strands rise along the normal, then droop under gravity / trail with motion
  transformed += fn * (fh * fl) + (uGravity + uMotion) * (fh * fh * fl);
  vFurP = position;
  vFurH = fh;
  vFurLen = fl;
  vFurAO = furData.z;`,
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
${NOISE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
  if (vFurLen < 0.007) discard;
  vec3 P = vFurP;
  // clumping: strands converge toward clump centres toward their tips
  vec4 cl = yCell(P * uClumpDensity);
  vec3 cpos = cl.xyz / uClumpDensity;
  float clump = uClump * (0.6 + 0.4 * cl.w);
  vec3 Pc = P + (cpos - P) * clump * vFurH;
  vec4 st = yCell(Pc * uDensity);
  float d = length(st.xyz - Pc * uDensity);
  float hmax = mix(0.5, 1.0, fract(st.w * 17.31));
  // shorter fur gets thicker strands (reads as dense pelt)
  float tH = vFurH / hmax;
  if (tH > 1.0) discard;
  float radius = 0.78 * (1.0 - pow(tH, 1.25));
  if (d > radius) discard;
  float n1 = yNoise(P * 2.1);
  float n2 = yNoise(P * 6.3 + 3.7);
  vec3 cool = vec3(0.86, 0.9, 0.97);
  vec3 cream = vec3(0.95, 0.9, 0.79);
  vec3 grey = vec3(0.66, 0.68, 0.72);
  vec3 fc = mix(cool, cream, smoothstep(0.35, 0.8, n1));
  fc = mix(fc, grey, smoothstep(0.5, 0.85, n2) * 0.55 + smoothstep(0.6, 0.95, cl.w) * 0.2);
  fc *= 0.82 + 0.28 * fract(st.w * 7.13);
  float ao = mix(0.32, 1.0, pow(vFurH, 0.7)) * mix(vFurAO, 1.0, 0.35 + 0.65 * vFurH);
  diffuseColor.rgb = fc * ao;`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `{
    float rimF = pow(1.0 - saturate(dot(normal, geometryViewDir)), 3.0);
    outgoingLight += uRim * rimF * 0.22 * vFurH * diffuseColor.rgb;
  }
  #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'yeti-shell-fur-v1';
  return m;
}

/** Base surface: undercoat in furred areas, dark grey-blue leathery skin on face/palms/soles. */
export function createSkinMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
  m.name = 'YetiSkin';
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 furData;
varying vec3 vSkinP;
varying float vBare;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  vSkinP = position;
  vBare = furData.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vSkinP;
varying float vBare;
${NOISE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  float sn = yNoise(vSkinP * 90.0) * 0.6 + yNoise(vSkinP * 260.0) * 0.4;
  float blot = yNoise(vSkinP * 14.0);
  diffuseColor.rgb *= mix(1.0, 0.82 + 0.3 * sn, vBare) * (0.9 + 0.2 * blot);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = mix(0.95, 0.42 + 0.25 * sn, vBare);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  {
    // leathery wrinkles: perturb the normal with noise gradient on bare skin
    float e = 0.004;
    vec3 q = vSkinP * 70.0;
    float n0 = yNoise(q);
    vec3 g = vec3(yNoise(q + vec3(e*70.0,0,0)) - n0, yNoise(q + vec3(0,e*70.0,0)) - n0, yNoise(q + vec3(0,0,e*70.0)) - n0);
    vec3 gv = (viewMatrix * vec4(g, 0.0)).xyz;
    normal = normalize(normal - gv * 1.6 * vBare);
  }`,
      );
  };
  m.customProgramCacheKey = () => 'yeti-skin-v1';
  return m;
}

/** Canvas atlas of 4 hair locks (white, alpha) — roots at the top (v = 1). */
export function createLockTexture(): THREE.Texture {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  ctx.clearRect(0, 0, W, H);
  let seed = 99;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const cw = W / 4;
  for (let lock = 0; lock < 4; lock++) {
    const x0 = lock * cw;
    const strands = 70;
    for (let s = 0; s < strands; s++) {
      const startX = x0 + cw * (0.2 + 0.6 * rnd());
      const endX = x0 + cw * 0.5 + (rnd() - 0.5) * cw * (0.35 + 0.25 * (lock % 2));
      const len = H * (0.55 + 0.45 * rnd());
      const ctrlX = (startX + endX) / 2 + (rnd() - 0.5) * cw * 0.35;
      const steps = 10;
      const g = Math.floor(200 + 55 * rnd());
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const bx = (t: number): number => (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * endX;
        ctx.strokeStyle = `rgba(${g},${g},${g},${1 - t0 * 0.35})`;
        ctx.lineWidth = Math.max(0.6, 4.2 * (1 - t0) + 0.6);
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

export function createCardMaterial(tex: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    vertexColors: true,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
  });
  m.alphaToCoverage = true;
  m.name = 'YetiFurCards';
  // cards carry the underlying body normal: undo three's back-face normal flip so both sides shade like fur volume
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
  #ifdef DOUBLE_SIDED
    normal *= faceDirection;
  #endif`,
    );
  };
  m.customProgramCacheKey = () => 'yeti-cards-v1';
  return m;
}

export function createHardMaterial(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  });
  m.name = 'YetiTeethClaws';
  return m;
}

export interface EyeMaterial {
  material: THREE.MeshPhysicalMaterial;
  glow: THREE.IUniform<number>;
}

export function createEyeMaterial(): EyeMaterial {
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
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uGlow;`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  totalEmissiveRadiance = emissive * vColor.rgb * vColor.rgb * uGlow * 16.0;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
    // fixed key glint so the eyes always catch a highlight, even deep in the sockets
    vec3 r = reflect(-geometryViewDir, normal);
    float gl = pow(saturate(dot(r, normalize(vec3(0.35, 0.55, 0.75)))), 160.0);
    outgoingLight += vec3(1.0, 0.97, 0.9) * gl * 1.6;
  }
  #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'yeti-eyes-v1';
  return { material: m, glow };
}
