import * as THREE from 'three';
import { sgnPow } from './math';

/** Skin influences for one vertex (bone indices + weights, up to 4). */
export interface SkinW {
  idx: number[];
  w: number[];
}

export interface GridOpts {
  rows: number;
  cols: number;
  /** wrap columns around (tube) */
  closed: boolean;
  /** duplicate the first column at the end (clean UV seam) */
  seam?: boolean;
  pos: (i: number, j: number, out: THREE.Vector3) => void;
  /** a point inside the surface near row i (used to orient triangles outward) */
  inside: (i: number, out: THREE.Vector3) => void;
  capStart?: THREE.Vector3 | null;
  capEnd?: THREE.Vector3 | null;
  shade?: (p: THREE.Vector3, i: number, j: number) => number;
  skin?: (p: THREE.Vector3) => SkinW;
}

/**
 * Generic row/column surface builder (rings × segments). Produces an indexed geometry with
 * smooth normals, uv, grey vertex colour ("baked AO"/seams) and optional skin attributes.
 * Triangles are automatically oriented outward.
 */
export function grid(o: GridOpts): THREE.BufferGeometry {
  const nc = o.closed ? (o.seam ? o.cols + 1 : o.cols) : o.cols;
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const p = new THREE.Vector3();
  const push = (v: THREE.Vector3, u: number, vv: number, sh: number): void => {
    pos.push(v.x, v.y, v.z);
    uv.push(u, vv);
    col.push(sh, sh, sh);
    if (o.skin) {
      const s = o.skin(v);
      for (let k = 0; k < 4; k++) {
        si.push(s.idx[k] ?? 0);
        sw.push(s.w[k] ?? 0);
      }
    }
  };
  for (let i = 0; i < o.rows; i++) {
    for (let j = 0; j < nc; j++) {
      o.pos(i, j, p);
      push(p, j / (o.closed ? o.cols : Math.max(1, o.cols - 1)), i / Math.max(1, o.rows - 1), o.shade ? o.shade(p, i, j) : 1);
    }
  }
  const vi = (i: number, j: number): number => i * nc + (o.closed && !o.seam ? j % o.cols : j);
  const quadCols = o.closed ? o.cols : o.cols - 1;
  const body: number[] = [];
  for (let i = 0; i < o.rows - 1; i++) {
    for (let j = 0; j < quadCols; j++) {
      const a = vi(i, j);
      const b = vi(i + 1, j);
      const c = vi(i, j + 1);
      const d = vi(i + 1, j + 1);
      body.push(a, b, c, b, d, c);
    }
  }
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  const N = new THREE.Vector3();
  const Q = new THREE.Vector3();
  const tri = (idx: number[], t: number): void => {
    A.fromArray(pos, idx[t] * 3);
    B.fromArray(pos, idx[t + 1] * 3);
    C.fromArray(pos, idx[t + 2] * 3);
    N.subVectors(B, A).cross(C.sub(A));
  };
  const flip = (idx: number[], from: number, to: number): void => {
    for (let t = from; t < to; t += 3) {
      const tmp = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = tmp;
    }
  };
  // orient body
  if (o.rows > 1) {
    const i0 = Math.floor((o.rows - 1) / 2);
    o.inside(i0, Q);
    let sum = 0;
    for (let j = 0; j < quadCols; j++) {
      const t = (i0 * quadCols + j) * 6;
      tri(body, t);
      sum += N.dot(A.fromArray(pos, body[t] * 3).sub(Q));
    }
    if (sum < 0) flip(body, 0, body.length);
  }
  const addCap = (row: number, center: THREE.Vector3, adjRow: number): void => {
    const ci = pos.length / 3;
    push(center, 0.5, row === 0 ? 0 : 1, o.shade ? o.shade(center, row, 0) : 1);
    const start = body.length;
    for (let j = 0; j < quadCols; j++) body.push(ci, vi(row, j + 1), vi(row, j));
    o.inside(adjRow, Q);
    const out = new THREE.Vector3().subVectors(center, Q);
    let sum = 0;
    for (let t = start; t < body.length; t += 3) {
      tri(body, t);
      sum += N.dot(out);
    }
    if (sum < 0) flip(body, start, body.length);
  };
  if (o.capStart) addCap(0, o.capStart, Math.min(1, o.rows - 1));
  if (o.capEnd) addCap(o.rows - 1, o.capEnd, Math.max(0, o.rows - 2));

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (o.skin) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  }
  g.setIndex(body);
  g.computeVertexNormals();
  return g;
}

export interface Ring {
  c: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  a: number;
  b: number;
  /** superellipse exponent (2 = ellipse, larger = boxier) */
  n: number;
}

export interface LoftOpts {
  segs: number;
  seam?: boolean;
  theta0?: number;
  /** dome height of start cap (null/undefined = open) */
  capStart?: number | null;
  capEnd?: number | null;
  radial?: (theta: number, i: number) => number;
  shade?: (p: THREE.Vector3, i: number, theta: number) => number;
  skin?: (p: THREE.Vector3) => SkinW;
}

/** Loft a closed (super)elliptic cross-section through a list of rings. */
export function loft(rings: Ring[], o: LoftOpts): THREE.BufferGeometry {
  const t0 = o.theta0 ?? 0;
  const th = (j: number): number => t0 + (Math.PI * 2 * j) / o.segs;
  const cap = (k: number, adj: number, dome: number | null | undefined): THREE.Vector3 | null => {
    if (dome === null || dome === undefined) return null;
    const c = rings[k].c.clone();
    const dir = new THREE.Vector3().subVectors(rings[k].c, rings[adj].c);
    if (dir.lengthSq() > 1e-12) c.addScaledVector(dir.normalize(), dome);
    return c;
  };
  return grid({
    rows: rings.length,
    cols: o.segs,
    closed: true,
    seam: o.seam,
    pos: (i, j, out) => {
      const r = rings[i];
      const t = th(j);
      const e = 2 / r.n;
      const m = o.radial ? o.radial(t, i) : 1;
      out
        .copy(r.c)
        .addScaledVector(r.u, r.a * sgnPow(Math.cos(t), e) * m)
        .addScaledVector(r.v, r.b * sgnPow(Math.sin(t), e) * m);
    },
    inside: (i, out) => {
      out.copy(rings[i].c);
    },
    capStart: cap(0, Math.min(1, rings.length - 1), o.capStart),
    capEnd: cap(rings.length - 1, Math.max(0, rings.length - 2), o.capEnd),
    shade: o.shade
      ? (p, i, j) => (o.shade as NonNullable<LoftOpts['shade']>)(p, i, th(j))
      : undefined,
    skin: o.skin,
  });
}

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
/** Horizontal ring (cross-section in the XZ plane) for vertical tubes. */
export function hring(x: number, y: number, z: number, a: number, b: number, n = 2): Ring {
  return { c: new THREE.Vector3(x, y, z), u: X, v: Z, a, b, n };
}

/** Ensure a geometry carries the same attribute set as loft output (for merging). */
export function normalizeAttrs(g: THREE.BufferGeometry, shade = 1, skinBone = -1): THREE.BufferGeometry {
  const geo = g;
  const n = geo.getAttribute('position').count;
  if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (!geo.getAttribute('color')) {
    const c = new Float32Array(n * 3).fill(shade);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  }
  if (skinBone >= 0) {
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      si[k * 4] = skinBone;
      sw[k * 4] = 1;
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  }
  for (const name of Object.keys(geo.attributes)) {
    if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(name)) geo.deleteAttribute(name);
  }
  if (!geo.index) {
    const idx: number[] = [];
    for (let k = 0; k < n; k++) idx.push(k);
    geo.setIndex(idx);
  }
  return geo;
}

/** Build normalized skin weights from (bone, weight) pairs; keeps top 4. */
export function skinOf(pairs: [number, number][]): SkinW {
  const m = new Map<number, number>();
  for (const [b, w] of pairs) if (w > 1e-4) m.set(b, (m.get(b) ?? 0) + w);
  const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const tot = arr.reduce((s, e) => s + e[1], 0) || 1;
  return { idx: arr.map((e) => e[0]), w: arr.map((e) => e[1] / tot) };
}
