/**
 * (Round 5, W-065: four blind reads — "the drop is implied, not shown"; the racing line comes no nearer
 * than ~55 m to the rim, from where the flank below the lip is out of sight) wind-blown snow pouring off
 * the cornice: veils of spindrift spilling over the lip and falling away into the void below it, the way
 * a corniced edge smokes in a wind. Only an edge does this, so from the line the rim reads as a drop.
 *
 * Presentation only and beyond the lip: nothing here is on (or claims to be) skiable ground. One merged
 * mesh per chunk of camera-facing quads (billboarded in the vertex shader about each veil's top), one
 * shared material; strength follows the wind.
 */
import * as THREE from 'three';
import type { Mountain } from '../../../course';
import { dropSide, type CorniceSample } from './cornice';

export const RIM_SPINDRIFT = {
  /** one veil every `step` m of rim where the cornice is full (k ≥ kMin) */
  step: 34,
  kMin: 0.45,
  /** veil width and drop (m) */
  width: [12, 20] as [number, number],
  drop: [26, 44] as [number, number],
  /** how far out past the rim the veil hangs (× the lip's overhang, + m) */
  out: [0.7, 1.2] as [number, number],
};

const VERT = /* glsl */ `
attribute vec3 aTop;
attribute vec3 aSize; // width, drop, seed
varying vec2 vUv;
varying float vSeed;
varying float vD;
void main() {
  vUv = vec2(position.x + 0.5, -position.y);
  vSeed = aSize.z;
  vec3 c = (modelMatrix * vec4(aTop, 1.0)).xyz;
  vec2 tc = cameraPosition.xz - c.xz;
  vec2 f = length(tc) > 1e-3 ? normalize(tc) : vec2(0.0, 1.0);
  vec3 right = vec3(f.y, 0.0, -f.x);
  vec3 w = c + right * position.x * aSize.x + vec3(0.0, position.y * aSize.y, 0.0);
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uK;
varying vec2 vUv;
varying float vSeed;
varying float vD;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // streaks falling down the veil, curling apart as they fall
  float y = vUv.y;
  float x = vUv.x + 0.12 * (n(vec2(y * 2.0 + vSeed, uTime * 0.2)) - 0.5) * y;
  float st = n(vec2(x * 9.0 + vSeed * 7.0, y * 2.2 - uTime * 0.9)) * 0.65 + n(vec2(x * 23.0 + vSeed, y * 5.0 - uTime * 1.6)) * 0.35;
  float body = smoothstep(0.0, 0.22, x) * smoothstep(1.0, 0.78, x);
  // dense at the lip, thinning out as it falls
  float fall = smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.25, 1.0, y));
  float near = smoothstep(8.0, 30.0, vD);
  float far = 1.0 - smoothstep(700.0, 1400.0, vD);
  float a = uK * body * fall * smoothstep(0.35, 0.8, st) * near * far;
  if (a < 0.004) discard;
  gl_FragColor = vec4(0.93, 0.95, 0.99, a);
}`;

let mat: THREE.ShaderMaterial | null = null;
/** the shared veil material (uTime, uK = strength 0..1) */
export function rimSpindriftMaterial(): THREE.ShaderMaterial {
  if (mat) return mat;
  mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uK: { value: 0.6 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return mat;
}

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** veil tops for these cornice samples: where the lip is full, one per RIM_SPINDRIFT.step m */
export function rimSpindriftVeils(m: Mountain, samples: CorniceSample[]): Array<{ top: THREE.Vector3; w: number; drop: number; seed: number }> {
  const side = dropSide(m);
  const out: Array<{ top: THREE.Vector3; w: number; drop: number; seed: number }> = [];
  if (!side) return out;
  const R = RIM_SPINDRIFT;
  let next = -Infinity;
  for (const s of samples) {
    if (s.z < next || s.k < R.kMin) continue;
    const u = hash(Math.round(s.z), 3.1);
    const o = s.ov * (R.out[0] + (R.out[1] - R.out[0]) * u) + 1.0;
    out.push({
      top: new THREE.Vector3(s.x + side * o, s.y + s.h * 0.55, s.z),
      w: R.width[0] + (R.width[1] - R.width[0]) * hash(Math.round(s.z), 5.7),
      drop: R.drop[0] + (R.drop[1] - R.drop[0]) * hash(Math.round(s.z), 9.3),
      seed: u * 17,
    });
    next = s.z + R.step * (0.75 + 0.5 * hash(Math.round(s.z), 1.9));
  }
  return out;
}

/** one merged mesh of veils (null when the stretch has none) */
export function buildRimSpindrift(m: Mountain, samples: CorniceSample[]): THREE.Mesh | null {
  const veils = rimSpindriftVeils(m, samples);
  if (!veils.length) return null;
  const pos: number[] = [];
  const top: number[] = [];
  const size: number[] = [];
  const idx: number[] = [];
  veils.forEach((v, i) => {
    const corners = [
      [-0.5, 0],
      [0.5, 0],
      [0.5, -1],
      [-0.5, -1],
    ];
    for (const [cx, cy] of corners) {
      pos.push(cx!, cy!, 0);
      top.push(v.top.x, v.top.y, v.top.z);
      size.push(v.w, v.drop, v.seed);
    }
    const b = i * 4;
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, rimSpindriftMaterial());
  mesh.name = 'whiteout-rim-spindrift';
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return mesh;
}
