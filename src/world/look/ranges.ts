/**
 * Distant mountain skyline: three concentric rings of snow-and-rock ridges well beyond the
 * playable terrain (8–11 km), plus a horizon haze band that blends the sky into the fog colour.
 * The group follows the viewer (like the sky dome), so it works on any course length; its height
 * follows the valley floor near the skier so the ranges always rise out of the haze below.
 *
 * Cost: 3 ridge rings (~2.3k triangles each) + 1 band = 4 draw calls.
 */
import * as THREE from 'three';
import { Rng, gnoise, ridged } from '../../core/rng';
import { GLSL_NOISE } from '../snowMaterial';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from './atmosphere';

interface Layer {
  radius: number;
  /** ridge height range above the base, metres */
  h0: number;
  h1: number;
  /** angular frequency of the main peaks */
  freq: number;
  haze: number;
  seed: number;
}

const LAYERS: Layer[] = [
  { radius: 10900, h0: 500, h1: 2100, freq: 5.5, haze: 0.5, seed: 31 },
  { radius: 9700, h0: 350, h1: 1650, freq: 8, haze: 0.4, seed: 57 },
  { radius: 8500, h0: 200, h1: 1250, freq: 12, haze: 0.3, seed: 83 },
];

const SEG = 480;
/** vertical rows: fraction of the ridge height, and how far the face leans back (m) */
const ROWS: Array<[number, number]> = [
  [-0.35, -260],
  [0.0, 0],
  [0.38, 260],
  [0.72, 470],
  [1.0, 620],
];

function ridgeHeight(a: number, L: Layer): number {
  // sample noise on a circle (seamless around 360°)
  const cx = Math.cos(a) * L.freq;
  const cz = Math.sin(a) * L.freq;
  const r = ridged(cx + 11, cz + 7, L.seed, 5); // 0..~1, sharp crests
  const broad = 0.5 + 0.5 * gnoise(cx * 0.35 + 3, cz * 0.35 - 5, L.seed + 1);
  const t = Math.min(1, Math.max(0, 0.15 + 0.75 * r * (0.55 + 0.6 * broad)));
  return L.h0 + (L.h1 - L.h0) * t;
}

function ringGeometry(L: Layer): THREE.BufferGeometry {
  const rng = new Rng(L.seed * 977);
  const nR = ROWS.length;
  const pos = new Float32Array((SEG + 1) * nR * 3);
  const uvh = new Float32Array((SEG + 1) * nR * 2);
  const jit: number[] = [];
  for (let i = 0; i <= SEG; i++) jit.push(i === SEG ? jit[0]! : rng.range(-0.25, 0.25));
  for (let i = 0; i <= SEG; i++) {
    const a = ((i + jit[i]! * 0.5) / SEG) * Math.PI * 2;
    const h = ridgeHeight(a, L);
    // sub-ridges: spurs running down the face
    for (let r = 0; r < nR; r++) {
      const [f, back] = ROWS[r]!;
      const spur = r > 0 && r < nR - 1 ? 0.12 * h * gnoise(a * 60 + r * 1.7, r * 3.1, L.seed + 9) : 0;
      const y = f < 0 ? -2600 : f * h + (r === 1 ? 0 : spur * 0.5);
      const rad = L.radius + back * (h / 1800) + spur;
      const k = (i * nR + r) * 3;
      pos[k] = Math.cos(a) * rad;
      pos[k + 1] = y;
      pos[k + 2] = Math.sin(a) * rad;
      uvh[(i * nR + r) * 2] = i / SEG;
      uvh[(i * nR + r) * 2 + 1] = Math.max(0, f);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < SEG; i++)
    for (let r = 0; r + 1 < nR; r++) {
      const a = i * nR + r;
      const b = (i + 1) * nR + r;
      // faces point towards the ring centre (the viewer)
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.BufferAttribute(uvh, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the ring seam (i = 0 and i = SEG coincide): average their normals
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let r = 0; r < nR; r++) {
    const i0 = r;
    const i1 = SEG * nR + r;
    const x = n.getX(i0) + n.getX(i1);
    const y = n.getY(i0) + n.getY(i1);
    const z = n.getZ(i0) + n.getZ(i1);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i0, x / l, y / l, z / l);
    n.setXYZ(i1, x / l, y / l, z / l);
  }
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), L.radius + 2000);
  return g;
}

function ridgeMaterial(L: Layer, sunDir: THREE.Vector3, sunColor: THREE.Color, skyColor: THREE.Color): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = {
    uSun: { value: sunDir },
    uSunCol: { value: sunColor },
    uSkyCol: { value: skyColor },
    uHaze: { value: L.haze },
    uSeed: { value: L.seed * 0.37 },
  };
  addAtmosphereUniforms(uniforms);
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
attribute vec2 aH;
varying vec3 vN;
varying vec3 vW;
varying vec3 vL;
varying vec2 vH;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vL = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vH = aH;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform float uHaze;
uniform float uSeed;
varying vec3 vN;
varying vec3 vW;
varying vec3 vL;
varying vec2 vH;
${GLSL_NOISE}
${ATMOSPHERE_GLSL}
void main() {
  vec3 n = normalize(vN);
  // pattern coordinates: around the ring (metres of arc) and height
  float ang = atan(vL.z, vL.x);
  vec2 q = vec2(ang * 1600.0, vL.y);
  float h = vH.y;
  // couloirs and rock ribs: streaks running down the fall line, more rock on steep faces
  float rib = sf_fbm(vec2(q.x * 0.012 + uSeed, q.y * 0.0022));
  float streak = sf_noise(vec2(q.x * 0.045 + uSeed, q.y * 0.0009));
  float steep = 1.0 - clamp(n.y, 0.0, 1.0);
  float rock = smoothstep(0.5, 0.75, steep + 0.45 * (rib - 0.5) + 0.25 * (streak - 0.5));
  rock = max(rock, smoothstep(0.62, 0.8, rib) * smoothstep(0.08, 0.3, h) * 0.85);
  // lower slopes: forested / rocky (dark), fading in under the snowline
  float low = 1.0 - smoothstep(0.02, 0.2, h + 0.1 * (rib - 0.5));
  vec3 snow = vec3(0.92, 0.94, 0.98);
  vec3 stone = mix(vec3(0.18, 0.18, 0.2), vec3(0.32, 0.3, 0.3), rib);
  vec3 alb = mix(snow, stone, rock);
  alb = mix(alb, vec3(0.1, 0.13, 0.13), low * 0.8);
  float ndl = max(dot(n, uSun), 0.0);
  float detail = 0.88 + 0.24 * sf_fbm(vec2(q.x * 0.03, q.y * 0.012) + uSeed);
  vec3 col = alb * detail * (uSunCol * ndl * 1.3 + uSkyCol * (0.75 + 0.35 * n.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // haze: thick at the base, thinner towards the summits (the shared aerial model + a per-layer floor)
  vec3 rel = vW - cameraPosition;
  float d = length(rel);
  vec3 v = rel / d;
  // anything at or below the viewer's horizon is where terrain would be: pure haze, so the skyline
  // can never show through gaps in the streamed terrain; summits are clearest
  float above = (rel.y - 80.0) / 1500.0;
  float f = mix(1.0, uHaze * 0.45, smoothstep(0.0, 1.0, above));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, sf_fogColor(v), clamp(f, 0.0, 1.0));
}`,
    fog: false,
  });
}

function hazeBand(): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } {
  const R = 11600;
  const g = new THREE.CylinderGeometry(R, R, 9000, 64, 1, true);
  g.translate(0, 1500, 0);
  const uniforms: Record<string, THREE.IUniform> = {};
  addAtmosphereUniforms(uniforms);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
varying vec3 vW;
varying float vY;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
varying vec3 vW;
varying float vY;
${ATMOSPHERE_GLSL}
void main() {
  vec3 v = normalize(vW - cameraPosition);
  // elevation angle of the view ray (the band follows the viewer)
  float el = v.y;
  float a = 1.0 - smoothstep(-0.02, 0.16, el);
  a = a * a * (3.0 - 2.0 * a);
  // fog colour is a display-space value (as with three's built-in fog, mixed after tone mapping)
  gl_FragColor = vec4(sf_fogColor(v), a * 0.92);
}`,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, mat };
}

export class DistantRanges {
  readonly group = new THREE.Group();
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  /** smoothed base height (follows the valley floor near the skier) */
  private baseY = NaN;

  constructor(sunDir: THREE.Vector3, sunColor: THREE.Color, skyColor: THREE.Color) {
    this.group.name = 'DistantRanges';
    for (const L of LAYERS) {
      const g = ringGeometry(L);
      const m = ridgeMaterial(L, sunDir, sunColor, skyColor);
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = -5;
      // rotate each layer so the main massifs do not line up
      mesh.rotation.y = L.seed * 0.71;
      this.group.add(mesh);
      this.geos.push(g);
      this.mats.push(m);
    }
    const band = hazeBand();
    this.group.add(band.mesh);
    this.geos.push(band.mesh.geometry);
    this.mats.push(band.mat);
  }

  update(focus: THREE.Vector3, camPos: THREE.Vector3, dt: number) {
    // ranges sit a little below the valley floor at the skier, so they emerge from the haze
    const target = Math.min(focus.y, camPos.y) - 900;
    if (!Number.isFinite(this.baseY) || dt <= 0 || Math.abs(target - this.baseY) > 400) this.baseY = target;
    else this.baseY += (target - this.baseY) * Math.min(1, dt * 0.5);
    this.group.position.set(camPos.x, this.baseY, camPos.z);
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
