/**
 * Distant mountain skyline: three concentric rings of snow-and-rock ridges well beyond the
 * playable terrain (8–11 km), plus a horizon haze band that blends the sky into the fog colour.
 * The group follows the viewer (like the sky dome), so it works on any course length; its height
 * follows the valley floor near the skier so the ranges always rise out of the haze below.
 *
 * Cost: 3 ridge rings (~2.3k triangles each) + 1 band = 4 draw calls.
 */
import * as THREE from 'three';
import { Rng, gnoise, ridged, smoothstep } from '../../core/rng';
import { GLSL_NOISE } from '../snowMaterial';
import { ATMOSPHERE_GLSL, addAtmosphereUniforms } from './atmosphere';
import { getBiome, glslVec3, type BiomeRangesLook } from '../biome';

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
  { radius: 10900, h0: 500, h1: 2100, freq: 5.5, haze: 0.45, seed: 31 },
  { radius: 9700, h0: 350, h1: 1650, freq: 8, haze: 0.33, seed: 57 },
  { radius: 8500, h0: 200, h1: 1250, freq: 12, haze: 0.22, seed: 83 },
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

/** angular distance (radians, 0..π) */
function angDist(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/**
 * Far-plane guard. The haze band (r = 11.6 km) and the outer ridge ring (up to ~11.6 km with its
 * lean-back) sit just inside the camera's 12 km far plane, so with any pitch their lower parts
 * cross it: the GPU clips them and the raw sky dome shows through as a hard-edged block (the Fjord
 * round-1 "peach rectangle" in 04b/06: the clipped region of the band in front of the warm
 * low-sun sky). Where a fragment would lie beyond the far plane it is pinned just inside it instead
 * (depth order with everything nearer is unchanged). Only for looks with an open sector (Fjord):
 * there no ridge stands behind the band to hide the hole, and the Alpine shaders stay unchanged.
 */
function FAR_CLAMP(look: BiomeRangesLook): string {
  return look.openSector ? '\n  gl_Position.z = min(gl_Position.z, gl_Position.w * 0.99999);' : '';
}

function ringGeometry(L: Layer, open?: BiomeRangesLook['openSector'], rot = 0): THREE.BufferGeometry {
  const rng = new Rng(L.seed * 977);
  const nR = ROWS.length;
  const pos = new Float32Array((SEG + 1) * nR * 3);
  const uvh = new Float32Array((SEG + 1) * nR * 2);
  const jit: number[] = [];
  for (let i = 0; i <= SEG; i++) jit.push(i === SEG ? jit[0]! : rng.range(-0.25, 0.25));
  for (let i = 0; i <= SEG; i++) {
    const a = ((i + jit[i]! * 0.5) / SEG) * Math.PI * 2;
    let h = ridgeHeight(a, L);
    if (open) {
      // the mesh is rotated by `rot` about Y: local angle a points at world angle a − rot
      const m = 1 - smoothstep(open.halfWidth * 0.55, open.halfWidth, angDist(a - rot, open.center));
      h *= 1 - m * (1 - open.floor);
    }
    // sub-ridges: spurs running down the face
    for (let r = 0; r < nR; r++) {
      const [f, back] = ROWS[r]!;
      // spurs and buttresses running down the face (more depth relief: A31 "flat cards")
      const spur = r > 0 && r < nR - 1 ? 0.22 * h * gnoise(a * 60 + r * 1.7, r * 3.1, L.seed + 9) : 0;
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

function ridgeMaterial(L: Layer, sunDir: THREE.Vector3, sunColor: THREE.Color, skyColor: THREE.Color, look: BiomeRangesLook): THREE.ShaderMaterial {
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
  gl_Position = projectionMatrix * viewMatrix * w;${FAR_CLAMP(look)}
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
  vec3 n0 = normalize(vN);
  // pattern coordinates: around the ring (metres of arc) and height
  float ang = atan(vL.z, vL.x);
  vec2 q = vec2(ang * 1600.0, vL.y);
  float h = vH.y;
  // couloirs and rock ribs: streaks running down the fall line, more rock on steep faces
  float rib = sf_fbm(vec2(q.x * 0.012 + uSeed, q.y * 0.0022));
  float streak = sf_noise(vec2(q.x * 0.045 + uSeed, q.y * 0.0009));
  float big = sf_noise(vec2(q.x * 0.0021 + uSeed * 3.0, q.y * 0.0011));
  // relief: ribs/gullies and buttresses as a screen-derivative bump (the mesh is only 5 rows)
  float Hr = rib * 340.0 + streak * 110.0 + big * 420.0;
  vec3 dpx = dFdx(vW);
  vec3 dpy = dFdy(vW);
  vec3 r1 = cross(dpy, n0);
  vec3 r2 = cross(n0, dpx);
  float det = dot(dpx, r1);
  vec3 n = normalize(abs(det) * n0 - sign(det) * (dFdx(Hr) * r1 + dFdy(Hr) * r2));
  if (dot(n, n0) < 0.25) n = n0;
  float steep = 1.0 - clamp(n.y, 0.0, 1.0);
  float rock = smoothstep(0.45, 0.72, steep + 0.45 * (rib - 0.5) + 0.25 * (streak - 0.5));
  rock = max(rock, smoothstep(0.6, 0.8, rib) * smoothstep(0.08, 0.3, h) * 0.85);
  // lower slopes: forested / rocky (dark), fading in under the snowline
  float low = 1.0 - smoothstep(0.02, 0.2, h + 0.1 * (rib - 0.5));
  vec3 snow = ${glslVec3(look.snow)};
  vec3 stone = mix(${glslVec3(look.stoneDark)}, ${glslVec3(look.stoneLight)}, rib) * (0.8 + 0.4 * big);
  vec3 alb = mix(snow, stone, rock);
  alb = mix(alb, ${glslVec3(look.lowland)}, low * 0.8);
  float ndl = max(dot(n, uSun), 0.0);
  float detail = 0.88 + 0.24 * sf_fbm(vec2(q.x * 0.03, q.y * 0.012) + uSeed);
  // stronger key/fill contrast so faces turned from the sun read as relief, not a flat card
  vec3 col = alb * detail * (uSunCol * ndl * 1.7 + uSkyCol * (0.36 + 0.4 * n.y));
  // sun-side rim along the crests
  vec2 hn = normalize(n.xz + 1e-4);
  float rim = smoothstep(0.72, 0.98, h) * pow(max(dot(hn, normalize(uSun.xz + 1e-4)), 0.0), 2.0) * (1.0 - rock * 0.5);
  col += uSunCol * rim * 0.22;
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
  // aerial gradient within each layer: lighter, hazier towards its base
  f = max(f, uHaze * 0.45 + (1.0 - uHaze * 0.45) * 0.55 * pow(1.0 - clamp(h, 0.0, 1.0), 2.0));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, sf_fogColor(v), clamp(f, 0.0, 1.0));
}`,
    fog: false,
  });
}

function hazeBand(look: BiomeRangesLook): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } {
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
  gl_Position = projectionMatrix * viewMatrix * w;${FAR_CLAMP(look)}
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

  constructor(sunDir: THREE.Vector3, sunColor: THREE.Color, skyColor: THREE.Color, look: BiomeRangesLook = getBiome().ranges) {
    this.group.name = 'DistantRanges';
    for (const L of LAYERS) {
      const g = look.openSector ? ringGeometry(L, look.openSector, L.seed * 0.71) : ringGeometry(L);
      const m = ridgeMaterial(L, sunDir, sunColor, skyColor, look);
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = -5;
      // rotate each layer so the main massifs do not line up
      mesh.rotation.y = L.seed * 0.71;
      this.group.add(mesh);
      this.geos.push(g);
      this.mats.push(m);
    }
    const band = hazeBand(look);
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
