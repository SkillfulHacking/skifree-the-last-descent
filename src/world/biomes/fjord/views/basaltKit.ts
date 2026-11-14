/**
 * Geometry kit for the Fjord sea cave (round 3): irregular columnar-basalt prisms and an overturned
 * clinker-built rowing boat, written straight into flat arrays (no per-prop BufferGeometry, so a
 * cave's worth of columns costs a few milliseconds, not tens).
 *
 * Columns are 5–7-sided with jittered corners, per-face tone, optional slanted (broken) tops and a
 * small lean; snow lies only on near-level tops, as an off-centre drift, not as a uniform cap.
 */
import * as THREE from 'three';
import type { Rand } from '../../../resort/util';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();

export class PrismSet {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  /** (column seed, height above the ground along the column axis, column height) */
  readonly aj: number[] = [];
  readonly snowPos: number[] = [];
  readonly snowCol: number[] = [];
  count = 0;

  private tri(m: THREE.Matrix4, a: number[], b: number[], c: number[], tone: number[], ja: number[], jb: number[], jc: number[]) {
    for (const [p, j] of [
      [a, ja],
      [b, jb],
      [c, jc],
    ] as const) {
      _v.set(p[0]!, p[1]!, p[2]!).applyMatrix4(m);
      this.pos.push(_v.x, _v.y, _v.z);
      this.col.push(tone[0]!, tone[1]!, tone[2]!);
      this.aj.push(j[0]!, j[1]!, j[2]!);
    }
  }

  /**
   * One prism along local +Y (base at local y = 0, top at h plus the slant), transformed by `m`.
   * `ground` is the local height of the snow surface (for the shader's wet band and joints).
   */
  prism(
    m: THREE.Matrix4,
    o: { sides: number; r: number; h: number; rot: number; slant?: [number, number]; tone: number; seed: number; ground: number; rnd: Rand; snow?: boolean; up?: THREE.Vector3 },
  ): void {
    const { sides: n, r, h, rot, tone, seed, ground, rnd } = o;
    const [sx, sz] = o.slant ?? [0, 0];
    const cs: Array<[number, number]> = [];
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2 + rnd.range(-0.12, 0.12);
      const rr = r * rnd.range(0.9, 1.08);
      cs.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const topY = (x: number, z: number) => h + x * sx + z * sz;
    const H = h;
    const cool = [tone, tone * 1.04, tone * 1.12];
    for (let k = 0; k < n; k++) {
      const [x0, z0] = cs[k]!;
      const [x1, z1] = cs[(k + 1) % n]!;
      const f = 0.78 + 0.44 * rnd.next();
      const t = [cool[0]! * f, cool[1]! * f, cool[2]! * f];
      const y0 = topY(x0, z0);
      const y1 = topY(x1, z1);
      // side quad (outward winding)
      this.tri(m, [x0, 0, z0], [x1, y1, z1], [x1, 0, z1], t, [seed, -ground, H], [seed, y1 - ground, H], [seed, -ground, H]);
      this.tri(m, [x0, 0, z0], [x0, y0, z0], [x1, y1, z1], t, [seed, -ground, H], [seed, y0 - ground, H], [seed, y1 - ground, H]);
    }
    // top: a slightly lighter, weathered face (fan)
    const tt = [cool[0]! * 1.25, cool[1]! * 1.25, cool[2]! * 1.25];
    for (let k = 0; k < n; k++) {
      const [x0, z0] = cs[k]!;
      const [x1, z1] = cs[(k + 1) % n]!;
      const j = [seed, H - ground + 0.05, H];
      this.tri(m, [0, topY(0, 0), 0], [x1, topY(x1, z1), z1], [x0, topY(x0, z0), z0], tt, j, j, j);
    }
    this.count++;
    // snow: an off-centre drift on near-level tops only
    if (o.snow && Math.hypot(sx, sz) < 0.12) {
      const up = o.up ?? new THREE.Vector3(0, 1, 0);
      _n.set(0, 1, 0).transformDirection(m);
      if (_n.dot(up) < 0.92) return;
      const cx = rnd.range(-0.25, 0.25) * r;
      const cz = rnd.range(-0.25, 0.25) * r;
      const dome = rnd.range(0.06, 0.16);
      const rim: Array<[number, number, number]> = [];
      for (let k = 0; k < n; k++) {
        const [x, z] = cs[k]!;
        const s = rnd.range(0.55, 0.9);
        const px = cx + (x - cx) * s;
        const pz = cz + (z - cz) * s;
        rim.push([px, topY(px, pz) + 0.02, pz]);
      }
      const c: [number, number, number] = [cx, topY(cx, cz) + dome, cz];
      for (let k = 0; k < n; k++) {
        const a = rim[k]!;
        const b = rim[(k + 1) % n]!;
        for (const p of [c, b, a]) {
          _v.set(p[0], p[1], p[2]).applyMatrix4(m);
          this.snowPos.push(_v.x, _v.y, _v.z);
          this.snowCol.push(1, 1, 1);
        }
      }
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aJ', new THREE.Float32BufferAttribute(this.aj, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }

  snowGeometry(): THREE.BufferGeometry | null {
    if (!this.snowPos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.snowPos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.snowCol, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * An overturned clinker-built rowing boat (keel up, gunwales on the ground), in local space: length
 * along z, beam along x, ground at y = 0. Overlapping strakes (each one stands proud of the one above
 * it), a keel with rising stem and stern posts, a faded painted sheer strake and a staved-in patch.
 */
export function clinkerHull(L: number, B: number, D: number): THREE.BufferGeometry {
  const N = 7; // strakes per side
  const nz = 26;
  const pos: number[] = [];
  const col: number[] = [];
  const tar = new THREE.Color(0.055, 0.045, 0.038);
  const paint = new THREE.Color(0.2, 0.34, 0.46);
  const white = new THREE.Color(0.62, 0.6, 0.55);
  // upright section at s ∈ [-1, 1] along the length, θ ∈ [0, 1] keel → gunwale
  const sheer = (s: number) => 0.18 * s * s;
  const pt = (s: number, th: number, side: number, step: number): [number, number, number] => {
    const hb = (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), 2.2)), 0.55);
    const phi = (th * Math.PI) / 2;
    const x = hb * Math.pow(Math.sin(phi), 0.65) + step * 0.035 * Math.pow(Math.sin(phi), 0.3);
    const yUp = (D + sheer(s)) * (1 - Math.pow(Math.cos(phi), 0.85)) - step * 0.02;
    // overturned: keel up, gunwale on the ground
    return [side * x, D + 0.18 - yUp, (s * L) / 2];
  };
  const push = (p: [number, number, number], c: THREE.Color) => {
    pos.push(p[0], p[1], p[2]);
    col.push(c.r, c.g, c.b);
  };
  for (const side of [-1, 1]) {
    for (let k = 0; k < N; k++) {
      // each strake: from its upper edge (no step) to its lower edge (stands proud by `step`)
      const th0 = k / N;
      const th1 = (k + 1) / N - 0.004;
      const c = k === N - 1 ? (side > 0 ? paint : white) : tar.clone().multiplyScalar(0.85 + 0.35 * (((k * 7 + (side > 0 ? 3 : 0)) % 5) / 5));
      for (let i = 0; i < nz; i++) {
        const s0 = -1 + (2 * i) / nz;
        const s1 = -1 + (2 * (i + 1)) / nz;
        const a = pt(s0, th0, side, 0);
        const b = pt(s1, th0, side, 0);
        const cc = pt(s1, th1, side, 1);
        const d = pt(s0, th1, side, 1);
        // the stove-in patch: a dark, dented hole on the +x side amidships
        const hole = side > 0 && (k === 3 || k === 4) && Math.abs((s0 + s1) / 2 - 0.1) < 0.16;
        const cl = hole ? new THREE.Color(0.01, 0.01, 0.012) : c;
        if (hole) for (const p of [a, b, cc, d]) p[0] -= 0.12 * side;
        const tri = side > 0 ? [a, cc, b, a, d, cc] : [a, b, cc, a, cc, d];
        for (const p of tri) push(p, cl);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** height of the overturned hull's keel line at s ∈ [-1, 1] (for the keel, posts and snow) */
export function hullKeelY(D: number): number {
  return D + 0.18;
}
