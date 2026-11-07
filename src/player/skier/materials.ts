import * as THREE from 'three';
import type { QualityPreset } from '../../core/types';
import type { SkierGeometry } from './parts';

export interface FlutterUniforms {
  uTime: { value: number };
  uFlutter: { value: number };
}

export interface SkierMaterials {
  jacket: THREE.MeshStandardMaterial;
  stripe: THREE.MeshStandardMaterial;
  pants: THREE.MeshStandardMaterial;
  gaiter: THREE.MeshStandardMaterial;
  headFill: THREE.MeshStandardMaterial;
  helmet: THREE.MeshStandardMaterial;
  helmetDark: THREE.MeshStandardMaterial;
  goggleFrame: THREE.MeshStandardMaterial;
  lens: THREE.MeshStandardMaterial;
  strap: THREE.MeshStandardMaterial;
  glove: THREE.MeshStandardMaterial;
  bootShell: THREE.MeshStandardMaterial;
  bootDark: THREE.MeshStandardMaterial;
  bootCuff: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  binding: THREE.MeshStandardMaterial;
  bindingAccent: THREE.MeshStandardMaterial;
  ski: THREE.MeshStandardMaterial;
  poleGrip: THREE.MeshStandardMaterial;
  poleShaft: THREE.MeshStandardMaterial;
  flutter: FlutterUniforms;
  list: THREE.Material[];
}

type PhysParams = THREE.MeshPhysicalMaterialParameters;

/** Adds a cheap travelling ripple (fabric flutter) to the vertex stage. */
function addFlutter(mat: THREE.Material, u: FlutterUniforms, freq: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uFlutter = u.uFlutter;
    shader.vertexShader =
      'uniform float uTime;\nuniform float uFlutter;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float ph = position.y * ${(38 * freq).toFixed(2)} + position.x * ${(21 * freq).toFixed(2)} - uTime * 24.0;
          float fl = sin(ph) * (0.6 + 0.4 * sin(position.z * ${(31 * freq).toFixed(2)} + uTime * 15.0));
          transformed += objectNormal * fl * uFlutter;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `skier-flutter-${freq}`;
}

export function createSkierMaterials(
  q: QualityPreset,
  geo: SkierGeometry,
  jacketColor: number,
  pantsColor: number,
): SkierMaterials {
  const rich = q === 'high' || q === 'ultra';
  const mk = (p: PhysParams): THREE.MeshStandardMaterial => {
    if (rich) return new THREE.MeshPhysicalMaterial(p);
    // strip physical-only params for the cheaper standard path
    const { clearcoat, clearcoatRoughness, sheen, sheenColor, sheenRoughness, iridescence, iridescenceIOR, iridescenceThicknessRange, specularIntensity, ...std } = p;
    void clearcoat;
    void clearcoatRoughness;
    void sheen;
    void sheenColor;
    void sheenRoughness;
    void iridescence;
    void iridescenceIOR;
    void iridescenceThicknessRange;
    void specularIntensity;
    return new THREE.MeshStandardMaterial(std as THREE.MeshStandardMaterialParameters);
  };
  const env = geo.envTexture;
  const jc = new THREE.Color(jacketColor);
  const sheenC = jc.clone().lerp(new THREE.Color(0xffffff), 0.45);
  // contrasting stripe: near-white on dark/saturated jackets, charcoal on very light ones
  const lum = jc.r * 0.3 + jc.g * 0.59 + jc.b * 0.11;
  const stripeColor = lum > 0.7 ? 0x23262d : 0xf1efe8;

  const flutter: FlutterUniforms = { uTime: { value: 0 }, uFlutter: { value: 0 } };
  const m: Omit<SkierMaterials, 'list' | 'flutter'> = {
    jacket: mk({ color: jacketColor, roughness: 0.62, metalness: 0, vertexColors: true, sheen: 0.6, sheenColor: sheenC, sheenRoughness: 0.45, envMap: env, envMapIntensity: 0.35 }),
    stripe: mk({ color: stripeColor, roughness: 0.55, vertexColors: true, sheen: 0.4, sheenColor: 0xffffff, sheenRoughness: 0.5, envMap: env, envMapIntensity: 0.3 }),
    pants: mk({ color: pantsColor, roughness: 0.82, vertexColors: true, sheen: 0.35, sheenColor: new THREE.Color(pantsColor).lerp(new THREE.Color(0xffffff), 0.35), sheenRoughness: 0.6, envMap: env, envMapIntensity: 0.25 }),
    gaiter: mk({ color: 0x3c4d63, roughness: 0.95, vertexColors: true, sheen: 0.5, sheenColor: 0x8aa0bd, sheenRoughness: 0.8 }),
    headFill: mk({ color: 0x2c3646, roughness: 0.95 }),
    helmet: mk({ color: 0xeef0f2, roughness: 0.3, metalness: 0, vertexColors: true, clearcoat: 1, clearcoatRoughness: 0.06, envMap: env, envMapIntensity: 0.8 }),
    helmetDark: mk({ color: 0x1a1c20, roughness: 0.55, envMap: env, envMapIntensity: 0.3 }),
    goggleFrame: mk({ color: 0x15171b, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2, envMap: env, envMapIntensity: 0.5 }),
    lens: mk({
      color: 0xffa040,
      roughness: 0.05,
      metalness: 0.9,
      envMap: env,
      envMapIntensity: 1.4,
      emissive: 0x401800,
      emissiveIntensity: 0.25,
      iridescence: 1,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [250, 650],
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    }),
    strap: mk({ color: jacketColor, roughness: 0.75, vertexColors: true }),
    glove: mk({ color: 0x1b1c20, roughness: 0.68, vertexColors: true, sheen: 0.3, sheenColor: 0x555a66, sheenRoughness: 0.5, envMap: env, envMapIntensity: 0.25 }),
    bootShell: mk({ color: 0xe4e7eb, roughness: 0.28, vertexColors: true, clearcoat: 0.8, clearcoatRoughness: 0.12, envMap: env, envMapIntensity: 0.7 }),
    bootDark: mk({ color: 0x1d1f24, roughness: 0.8 }),
    bootCuff: mk({ color: 0x2c3038, roughness: 0.3, vertexColors: true, clearcoat: 0.8, clearcoatRoughness: 0.15, envMap: env, envMapIntensity: 0.6 }),
    metal: mk({ color: 0xc9ced6, roughness: 0.28, metalness: 1, envMap: env, envMapIntensity: 1.0 }),
    binding: mk({ color: 0x24272d, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, envMap: env, envMapIntensity: 0.5 }),
    bindingAccent: mk({ color: 0xff7a1a, roughness: 0.4, clearcoat: 0.5, envMap: env, envMapIntensity: 0.5 }),
    ski: mk({ color: 0xffffff, map: geo.skiTexture, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 0.6 }),
    poleGrip: mk({ color: 0x18191d, roughness: 0.75 }),
    poleShaft: mk({ color: 0xb9c0c9, roughness: 0.3, metalness: 1, envMap: env, envMapIntensity: 1.0 }),
  };
  m.lens.side = THREE.DoubleSide;
  if (q !== 'low') {
    addFlutter(m.jacket, flutter, 1);
    addFlutter(m.stripe, flutter, 1);
    addFlutter(m.pants, flutter, 0.8);
  }
  const list = Object.values(m) as THREE.Material[];
  return { ...m, flutter, list };
}
