/**
 * Small helpers for the resort module: deterministic RNG/noise, a static geometry batcher that
 * merges everything sharing a material into one draw call, and UV projection utilities.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Mulberry32 deterministic PRNG. */
export class Rand {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length] as T;
  }
}

/** Cheap hash-based 2D value noise in [0,1]. */
export function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm2(x: number, y: number, oct = 4): number {
  let a = 0.5;
  let f = 1;
  let s = 0;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += vnoise(x * f, y * f) * a;
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
}
export function vnoise3(x: number, y: number, z: number): number {
  return (vnoise(x + z * 1.7, y - z * 2.3) + vnoise(y * 1.3 + z, x * 0.7 - z)) * 0.5;
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
/** Frame-rate independent exponential damping factor. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

export type ColorFn = (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color;

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();

/** Ensure geometry is non-indexed and has position/normal/uv/color attributes. */
export function normalizeGeo(src: THREE.BufferGeometry, color: THREE.ColorRepresentation | ColorFn = 0xffffff): THREE.BufferGeometry {
  let g = src.index ? src.toNonIndexed() : src.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const count = g.attributes.position!.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  const cols = new Float32Array(count * 3);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  if (typeof color === 'function') {
    for (let i = 0; i < count; i++) {
      _p.fromBufferAttribute(pos, i);
      _n.fromBufferAttribute(nor, i);
      const c = color(_p, _n);
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
  } else {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.groups.length = 0;
  if (g !== src && src.index === null) {
    // clone path: fine
  }
  g = g as THREE.BufferGeometry;
  return g;
}

/**
 * Box/triplanar UV projection in the geometry's current space: each triangle picks the axis most
 * aligned with its face normal. `tile` metres per texture repeat. Geometry must be non-indexed.
 */
export function projectUV(g: THREE.BufferGeometry, tileU: number, tileV = tileU, offU = 0, offV = 0): void {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const p = k === 0 ? a : k === 1 ? b : c;
      let u: number;
      let v: number;
      if (ay >= ax && ay >= az) {
        u = p.x;
        v = p.z;
      } else if (ax >= az) {
        u = p.z;
        v = p.y;
      } else {
        u = p.x;
        v = p.y;
      }
      uv.setXY(i + k, u / tileU + offU, v / tileV + offV);
    }
  }
  uv.needsUpdate = true;
}

/** Accumulates geometry per material key, merging into one mesh per key on build(). */
export class Batch {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  add(key: string, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4, color: THREE.ColorRepresentation | ColorFn = 0xffffff, uv?: (g: THREE.BufferGeometry) => void): void {
    const g = normalizeGeo(geo, typeof color === 'function' ? 0xffffff : color);
    if (matrix) g.applyMatrix4(matrix);
    if (typeof color === 'function') {
      const cols = g.attributes.color as THREE.BufferAttribute;
      const pos = g.attributes.position as THREE.BufferAttribute;
      const nor = g.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        _p.fromBufferAttribute(pos, i);
        _n.fromBufferAttribute(nor, i);
        const c = color(_p, _n);
        cols.setXYZ(i, c.r, c.g, c.b);
      }
    }
    if (uv) uv(g);
    let list = this.parts.get(key);
    if (!list) {
      list = [];
      this.parts.set(key, list);
    }
    list.push(g);
    if (geo !== g) geo.dispose();
  }
  has(key: string): boolean {
    return (this.parts.get(key)?.length ?? 0) > 0;
  }
  build(materials: Record<string, THREE.Material>, opts: { cast?: boolean; receive?: boolean } = {}): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [key, list] of this.parts) {
      const mat = materials[key];
      if (!mat || list.length === 0) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const m = new THREE.Mesh(merged, mat);
      m.name = `resort_${key}`;
      m.castShadow = opts.cast ?? true;
      m.receiveShadow = opts.receive ?? true;
      out.push(m);
    }
    this.parts.clear();
    return out;
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _t = new THREE.Vector3();
/** Compose a matrix from position, Euler rotation and scale. */
export function mat(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _t.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_t, _q, _s);
}
/** parent * local */
export function mul(parent: THREE.Matrix4, local: THREE.Matrix4): THREE.Matrix4 {
  return _m.multiplyMatrices(parent, local).clone();
}

/** Cylinder between two points. */
export function beam(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8, r2 = r): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, false);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

/** Box between two points (square section w x d). */
export function boxBeam(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(w, len, d);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Displace vertices radially by noise (fluffy fur / snow lumps). Geometry indexed or not. */
export function noiseDisplace(g: THREE.BufferGeometry, amp: number, freq: number, seed = 0): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  g.computeVertexNormals();
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const d = (vnoise3(p.x * freq + seed, p.y * freq, p.z * freq) - 0.5) * 2 * amp;
    pos.setXYZ(i, p.x + n.x * d, p.y + n.y * d, p.z + n.z * d);
  }
  g.computeVertexNormals();
  return g;
}
