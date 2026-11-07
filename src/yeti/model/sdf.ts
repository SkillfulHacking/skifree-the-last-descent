/**
 * Tiny signed-distance-field sculpting kit + naive Surface Nets mesher.
 * Used once at load time to sculpt the Yeti's anatomy (smooth-blended muscle masses), then
 * to derive skin weights from primitive "ownership" (soft-min over primitive distances).
 */
import * as THREE from 'three';

/** Accumulates bone weights for one vertex. */
export class WeightAcc {
  readonly w: Float32Array;
  constructor(boneCount: number) {
    this.w = new Float32Array(boneCount);
  }
  clear(): void {
    this.w.fill(0);
  }
  add(bone: number, weight: number): void {
    this.w[bone] += weight;
  }
}

/** Skin assignment for a primitive: given axial parameter t (0..1) add weights scaled by `scale`. */
export type SkinFn = (t: number, acc: WeightAcc, scale: number) => void;

const smooth01 = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** Single bone. */
export const skinBone =
  (bone: number): SkinFn =>
  (_t, acc, s) => acc.add(bone, s);

/** Fixed mix. */
export const skinMix =
  (pairs: Array<[number, number]>): SkinFn =>
  (_t, acc, s) => {
    for (const [b, w] of pairs) acc.add(b, w * s);
  };

/** Linear blend from bone a (t=0) to bone b (t=1), smoothed. */
export const skinLerp =
  (a: number, b: number, t0 = 0, t1 = 1): SkinFn =>
  (t, acc, s) => {
    const u = smooth01((t - t0) / (t1 - t0));
    acc.add(a, (1 - u) * s);
    acc.add(b, u * s);
  };

/**
 * Limb segment: main bone, with 50/50 blending zones at the joints to the parent (t=0) and child (t=1),
 * so that two adjacent segments agree at the joint and bends stay smooth.
 */
export const skinLimb =
  (main: number, parent: number | null, child: number | null, zoneHead = 0.22, zoneTail = 0.22): SkinFn =>
  (t, acc, s) => {
    let wp = 0;
    let wc = 0;
    if (parent !== null && t < zoneHead) wp = 0.5 * (1 - smooth01(t / zoneHead));
    if (child !== null && t > 1 - zoneTail) wc = 0.5 * smooth01((t - (1 - zoneTail)) / zoneTail);
    if (parent !== null) acc.add(parent, wp * s);
    if (child !== null) acc.add(child, wc * s);
    acc.add(main, (1 - wp - wc) * s);
  };

export abstract class Prim {
  /** smooth blend radius used when combining into the field */
  k = 0.06;
  sub = false;
  /** additive primitive applied after all subtractions (e.g. eyelids inside carved sockets) */
  late = false;
  skin: SkinFn;
  /** relative influence when computing skin ownership */
  influence = 1;
  /** bounding sphere */
  bx = 0;
  by = 0;
  bz = 0;
  br = 0;
  constructor(skin: SkinFn) {
    this.skin = skin;
  }
  abstract dist(x: number, y: number, z: number): number;
  axial(_x: number, _y: number, _z: number): number {
    return 0.5;
  }
  blend(k: number): this {
    this.k = k;
    return this;
  }
  subtract(k = 0.02): this {
    this.sub = true;
    this.k = k;
    return this;
  }
  after(): this {
    this.late = true;
    return this;
  }
  weight(i: number): this {
    this.influence = i;
    return this;
  }
}

/** Ellipsoid with arbitrary orientation (IQ's bound-ish approximation). */
export class Ellipsoid extends Prim {
  private cx: number;
  private cy: number;
  private cz: number;
  private ax: THREE.Vector3;
  private ay: THREE.Vector3;
  private az: THREE.Vector3;
  private rx: number;
  private ry: number;
  private rz: number;
  constructor(
    c: THREE.Vector3,
    r: THREE.Vector3,
    skin: SkinFn,
    /** local Y axis direction (default world up) */
    up: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
    /** hint for local Z axis */
    fwd: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
  ) {
    super(skin);
    this.cx = c.x;
    this.cy = c.y;
    this.cz = c.z;
    this.ay = up.clone().normalize();
    const f = fwd.clone().addScaledVector(this.ay, -fwd.dot(this.ay));
    if (f.lengthSq() < 1e-6) f.set(1, 0, 0).addScaledVector(this.ay, -this.ay.x);
    this.az = f.normalize();
    this.ax = new THREE.Vector3().crossVectors(this.ay, this.az).normalize();
    this.rx = r.x;
    this.ry = r.y;
    this.rz = r.z;
    this.bx = c.x;
    this.by = c.y;
    this.bz = c.z;
    this.br = Math.max(r.x, r.y, r.z);
  }
  dist(x: number, y: number, z: number): number {
    const px = x - this.cx;
    const py = y - this.cy;
    const pz = z - this.cz;
    const lx = px * this.ax.x + py * this.ax.y + pz * this.ax.z;
    const ly = px * this.ay.x + py * this.ay.y + pz * this.ay.z;
    const lz = px * this.az.x + py * this.az.y + pz * this.az.z;
    const k0x = lx / this.rx;
    const k0y = ly / this.ry;
    const k0z = lz / this.rz;
    const k1x = lx / (this.rx * this.rx);
    const k1y = ly / (this.ry * this.ry);
    const k1z = lz / (this.rz * this.rz);
    const k0 = Math.sqrt(k0x * k0x + k0y * k0y + k0z * k0z);
    const k1 = Math.sqrt(k1x * k1x + k1y * k1y + k1z * k1z);
    if (k1 < 1e-9) return -Math.min(this.rx, this.ry, this.rz);
    return (k0 * (k0 - 1)) / k1;
  }
  override axial(_x: number, y: number, _z: number): number {
    // along local Y (useful for vertical blends)
    return Math.min(1, Math.max(0, 0.5 - (y - this.cy) / (2 * this.ry)));
  }
}

/** Round cone between a (radius ra) and b (radius rb) (IQ exact). */
export class RoundCone extends Prim {
  private ax: number;
  private ay: number;
  private az: number;
  private bax: number;
  private bay: number;
  private baz: number;
  private l2: number;
  private rr: number;
  private a2: number;
  private il2: number;
  private r1: number;
  private r2: number;
  constructor(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, skin: SkinFn) {
    super(skin);
    this.ax = a.x;
    this.ay = a.y;
    this.az = a.z;
    this.bax = b.x - a.x;
    this.bay = b.y - a.y;
    this.baz = b.z - a.z;
    this.l2 = this.bax * this.bax + this.bay * this.bay + this.baz * this.baz;
    this.r1 = ra;
    this.r2 = rb;
    this.rr = ra - rb;
    this.a2 = this.l2 - this.rr * this.rr;
    this.il2 = 1 / this.l2;
    this.bx = (a.x + b.x) / 2;
    this.by = (a.y + b.y) / 2;
    this.bz = (a.z + b.z) / 2;
    this.br = Math.sqrt(this.l2) / 2 + Math.max(ra, rb);
  }
  dist(x: number, y: number, z: number): number {
    const pax = x - this.ax;
    const pay = y - this.ay;
    const paz = z - this.az;
    const l2 = this.l2;
    const yy = pax * this.bax + pay * this.bay + paz * this.baz;
    const zz = yy - l2;
    const xvx = pax * l2 - this.bax * yy;
    const xvy = pay * l2 - this.bay * yy;
    const xvz = paz * l2 - this.baz * yy;
    const x2 = xvx * xvx + xvy * xvy + xvz * xvz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const rr = this.rr;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * this.a2 * z2 > k) return Math.sqrt(x2 + z2) * this.il2 - this.r2;
    if (Math.sign(yy) * this.a2 * y2 < k) return Math.sqrt(x2 + y2) * this.il2 - this.r1;
    return (Math.sqrt(x2 * this.a2 * this.il2) + yy * rr) * this.il2 - this.r1;
  }
  override axial(x: number, y: number, z: number): number {
    const t = ((x - this.ax) * this.bax + (y - this.ay) * this.bay + (z - this.az) * this.baz) * this.il2;
    return Math.min(1, Math.max(0, t));
  }
}

export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

export interface PartSpec {
  name: string;
  prims: Prim[];
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** voxel size */
  h: number;
  /** optional post-process on the field (cuts etc.) */
  post?: (x: number, y: number, z: number, d: number) => number;
  /** softness of skin ownership (metres) */
  skinSigma: number;
}

export function evalField(part: PartSpec, x: number, y: number, z: number): number {
  let d = 1e9;
  const prims = part.prims;
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i];
    if (p.sub && !p.late) {
      const dx = x - p.bx;
      const dy = y - p.by;
      const dz = z - p.bz;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) - p.br >= p.k - d) continue;
      d = smax(d, -p.dist(x, y, z), p.k);
    } else {
      const dx = x - p.bx;
      const dy = y - p.by;
      const dz = z - p.bz;
      const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.br;
      if (lb > d + p.k) continue;
      d = smin(d, p.dist(x, y, z), p.k);
    }
  }
  if (part.post) d = part.post(x, y, z, d);
  return d;
}

export interface RawMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

/**
 * Naive surface nets over a narrow band. Vertices are projected onto the isosurface with Newton steps
 * and normals come from the field gradient (smooth shading).
 */
export function meshPart(part: PartSpec): RawMesh {
  const h = part.h;
  const nx = Math.ceil((part.max.x - part.min.x) / h) + 1;
  const ny = Math.ceil((part.max.y - part.min.y) / h) + 1;
  const nz = Math.ceil((part.max.z - part.min.z) / h) + 1;
  const ox = part.min.x;
  const oy = part.min.y;
  const oz = part.min.z;
  const field = new Float32Array(nx * ny * nz);
  const idx = (i: number, j: number, k: number): number => i + nx * (j + ny * k);

  // coarse pass
  const C = 4;
  const cnx = Math.ceil(nx / C) + 1;
  const cny = Math.ceil(ny / C) + 1;
  const cnz = Math.ceil(nz / C) + 1;
  const coarse = new Float32Array(cnx * cny * cnz);
  for (let k = 0; k < cnz; k++)
    for (let j = 0; j < cny; j++)
      for (let i = 0; i < cnx; i++)
        coarse[i + cnx * (j + cny * k)] = evalField(part, ox + i * C * h, oy + j * C * h, oz + k * C * h);
  const band = C * h * 2.2;
  for (let k = 0; k < nz; k++) {
    const ck = Math.round(k / C);
    for (let j = 0; j < ny; j++) {
      const cj = Math.round(j / C);
      for (let i = 0; i < nx; i++) {
        const ci = Math.round(i / C);
        const cv = coarse[ci + cnx * (cj + cny * ck)];
        field[idx(i, j, k)] = Math.abs(cv) > band ? cv : evalField(part, ox + i * h, oy + j * h, oz + k * h);
      }
    }
  }
  // force outside on the boundary so meshes close where possible
  // (parts deliberately cut at the boundary are left open inside other parts)

  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i: number, j: number, k: number): number => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corner = new Float32Array(8);
  const EDGES: Array<[number, number]> = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = field[idx(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a];
          const vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const ax = a & 1;
          const ay = (a >> 1) & 1;
          const az = (a >> 2) & 1;
          const bx = b & 1;
          const by = (b >> 1) & 1;
          const bz = (b >> 2) & 1;
          sx += ax + (bx - ax) * t;
          sy += ay + (by - ay) * t;
          sz += az + (bz - az) * t;
          n++;
        }
        cellVert[cidx(i, j, k)] = pos.length / 3;
        pos.push(ox + (i + sx / n) * h, oy + (j + sy / n) * h, oz + (k + sz / n) * h);
      }

  const quads: number[] = [];
  const emit = (a: number, b: number, c: number, d: number, flip: boolean): void => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) quads.push(a, d, c, b);
    else quads.push(a, b, c, d);
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const v0 = field[idx(i, j, k)] < 0;
        if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
          const v1 = field[idx(i + 1, j, k)] < 0;
          if (v0 !== v1)
            emit(
              cellVert[cidx(i, j - 1, k - 1)],
              cellVert[cidx(i, j, k - 1)],
              cellVert[cidx(i, j, k)],
              cellVert[cidx(i, j - 1, k)],
              !v0,
            );
        }
        if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
          const v1 = field[idx(i, j + 1, k)] < 0;
          if (v0 !== v1)
            emit(
              cellVert[cidx(i - 1, j, k - 1)],
              cellVert[cidx(i - 1, j, k)],
              cellVert[cidx(i, j, k)],
              cellVert[cidx(i, j, k - 1)],
              !v0,
            );
        }
        if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
          const v1 = field[idx(i, j, k + 1)] < 0;
          if (v0 !== v1)
            emit(
              cellVert[cidx(i - 1, j - 1, k)],
              cellVert[cidx(i, j - 1, k)],
              cellVert[cidx(i, j, k)],
              cellVert[cidx(i - 1, j, k)],
              !v0,
            );
        }
      }

  // project onto surface and compute normals
  const vcount = pos.length / 3;
  const positions = new Float32Array(pos);
  const normals = new Float32Array(vcount * 3);
  const e = h * 0.35;
  const g = new THREE.Vector3();
  for (let v = 0; v < vcount; v++) {
    let x = positions[v * 3];
    let y = positions[v * 3 + 1];
    let z = positions[v * 3 + 2];
    for (let it = 0; it < 3; it++) {
      const d = evalField(part, x, y, z);
      g.set(
        evalField(part, x + e, y, z) - evalField(part, x - e, y, z),
        evalField(part, x, y + e, z) - evalField(part, x, y - e, z),
        evalField(part, x, y, z + e) - evalField(part, x, y, z - e),
      ).divideScalar(2 * e);
      const gl2 = g.lengthSq();
      if (gl2 < 1e-8) break;
      const step = Math.max(-h * 0.6, Math.min(h * 0.6, d / gl2));
      x -= g.x * step;
      y -= g.y * step;
      z -= g.z * step;
      if (it === 2 || Math.abs(d) < h * 0.01) {
        g.normalize();
        break;
      }
    }
    if (g.lengthSq() > 0) g.normalize();
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    positions[v * 3 + 2] = z;
    normals[v * 3] = g.x;
    normals[v * 3 + 1] = g.y;
    normals[v * 3 + 2] = g.z;
  }

  // triangulate quads along the shorter diagonal, ensure winding agrees with gradient normals
  const tris: number[] = [];
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const pc = new THREE.Vector3();
  const pd = new THREE.Vector3();
  const fnrm = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const avgN = new THREE.Vector3();
  for (let q = 0; q < quads.length; q += 4) {
    let a = quads[q];
    let b = quads[q + 1];
    const c = quads[q + 2];
    let d = quads[q + 3];
    pa.fromArray(positions, a * 3);
    pb.fromArray(positions, b * 3);
    pc.fromArray(positions, c * 3);
    pd.fromArray(positions, d * 3);
    fnrm.subVectors(pc, pa).cross(tmp.subVectors(pd, pb));
    avgN.set(0, 0, 0);
    for (const vi of [a, b, c, d]) avgN.x += normals[vi * 3], avgN.y += normals[vi * 3 + 1], avgN.z += normals[vi * 3 + 2];
    if (fnrm.dot(avgN) < 0) {
      const t = b;
      b = d;
      d = t;
    }
    if (pa.distanceToSquared(pc) < pb.distanceToSquared(pd)) tris.push(a, b, c, a, c, d);
    else tris.push(a, b, d, b, c, d);
  }
  return { positions, normals, indices: new Uint32Array(tris) };
}

/** Soft ownership skinning: returns top-4 bone indices & weights per vertex. */
export function skinPart(
  part: PartSpec,
  mesh: RawMesh,
  boneCount: number,
): { skinIndex: Uint16Array; skinWeight: Float32Array; boneW: Float32Array[] } {
  const vcount = mesh.positions.length / 3;
  const skinIndex = new Uint16Array(vcount * 4);
  const skinWeight = new Float32Array(vcount * 4);
  const acc = new WeightAcc(boneCount);
  const prims = part.prims.filter((p) => !p.sub);
  const dists = new Float32Array(prims.length);
  const sigma = part.skinSigma;
  const boneW: Float32Array[] = [];
  for (let v = 0; v < vcount; v++) {
    const x = mesh.positions[v * 3];
    const y = mesh.positions[v * 3 + 1];
    const z = mesh.positions[v * 3 + 2];
    let dmin = 1e9;
    for (let i = 0; i < prims.length; i++) {
      const d = prims[i].dist(x, y, z);
      dists[i] = d;
      if (d < dmin) dmin = d;
    }
    acc.clear();
    for (let i = 0; i < prims.length; i++) {
      const rel = (dists[i] - dmin) / sigma;
      if (rel > 8) continue;
      const w = Math.exp(-rel) * prims[i].influence;
      prims[i].skin(prims[i].axial(x, y, z), acc, w);
    }
    // top 4
    const top: Array<[number, number]> = [];
    for (let b = 0; b < boneCount; b++) {
      const w = acc.w[b];
      if (w <= 1e-5) continue;
      top.push([b, w]);
    }
    top.sort((p, q) => q[1] - p[1]);
    const n = Math.min(4, top.length);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += top[i][1];
    const bw = new Float32Array(boneCount);
    for (let i = 0; i < n; i++) {
      skinIndex[v * 4 + i] = top[i][0];
      skinWeight[v * 4 + i] = top[i][1] / sum;
      bw[top[i][0]] = top[i][1] / sum;
    }
    boneW.push(bw);
  }
  return { skinIndex, skinWeight, boneW };
}
