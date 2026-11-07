/**
 * Static resort props appended to a Batch in world space: pines, snow shrubs, Adirondack chairs,
 * loungers, fire pit, light poles + catenary wires, ski racks, snow fences, A-boards, finish
 * truss & padded posts, podium blocks + backdrop, cedar hot tub.
 */
import * as THREE from 'three';
import { Batch, Rand, beam, boxBeam, mat, mul, noiseDisplace, vnoise } from './util';

export type Ground = (x: number, z: number) => number;

const tmp = new THREE.Color();

export function pine(b: Batch, x: number, y: number, z: number, h: number, rnd: Rand, hi: boolean): void {
  const seg = hi ? 9 : 7;
  b.add('vcol', new THREE.CylinderGeometry(h * 0.025, h * 0.04, h * 0.3, 6), mat(x, y + h * 0.13, z), 0x4a3222);
  const tiers = hi ? 5 : 4;
  const yaw = rnd.range(0, 6.28);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = h * (0.36 - t * 0.27);
    const th = h * (0.34 - t * 0.12);
    const ty = y + h * 0.18 + t * h * 0.66 + th / 2;
    const cone = new THREE.ConeGeometry(r, th, seg, 2, true);
    // droop the skirt & jitter
    const P = cone.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < P.count; k++) {
      const px = P.getX(k);
      const py = P.getY(k);
      const pz = P.getZ(k);
      if (py < 0) {
        const a = Math.atan2(px, pz);
        const j = 1 + (vnoise(a * 2 + i * 7, i) - 0.5) * 0.35;
        P.setXYZ(k, px * j, py - Math.abs(Math.sin(a * 4.5)) * th * 0.08, pz * j);
      }
    }
    cone.computeVertexNormals();
    const dark = 0.8 + rnd.next() * 0.2;
    b.add('vcol', cone, mat(x, ty, z, 0, yaw + i, 0), (p) => {
      const k = (p.y - (ty - th / 2)) / th; // 0 bottom..1 top of tier
      return tmp.setRGB(0.018 * dark, (0.05 + 0.05 * k) * dark, 0.032 * dark);
    });
    // snow load on the upper side of each tier
    const snow = new THREE.ConeGeometry(r * 0.86, th * 0.62, seg, 2, true);
    noiseDisplace(snow, r * 0.08, 3.0 / Math.max(0.5, r), i * 3 + x);
    b.add('snow', snow, mat(x, ty + th * 0.14, z, 0, yaw + i + 0.3, 0), 0xffffff);
  }
  b.add('snow', new THREE.SphereGeometry(h * 0.03, 6, 4), mat(x, y + h * 1.0, z), 0xffffff);
}

export function shrub(b: Batch, x: number, y: number, z: number, s: number, seed: number): void {
  const g = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  noiseDisplace(g, 0.18, 2.2, seed);
  b.add('snow', g, mat(x, y - 0.1 * s, z, 0, seed, 0, s * 1.2, s * 0.75, s), 0xffffff);
  const rnd = new Rand(seed * 13 + 1);
  for (let i = 0; i < 5; i++) {
    const a = rnd.range(0, 6.28);
    const r = s * rnd.range(0.5, 0.95);
    b.add('vcol', new THREE.ConeGeometry(s * 0.18, s * 0.5, 5), mat(x + Math.sin(a) * r, y + s * 0.3, z + Math.cos(a) * r, rnd.range(-0.4, 0.4), 0, rnd.range(-0.4, 0.4)), 0x1d3a26);
  }
}

/** Adirondack chair at (x,z) facing yaw (local +Z = forward). */
export function adirondack(b: Batch, x: number, y: number, z: number, yaw: number, color: number): void {
  const M = mat(x, y, z, 0, yaw, 0);
  const c = new THREE.Color(color);
  const cd = c.clone().multiplyScalar(0.75);
  // seat slats (sloping back)
  for (let i = 0; i < 6; i++) {
    const zz = 0.3 - i * 0.09;
    b.add('vcol', new THREE.BoxGeometry(0.62, 0.03, 0.07), mul(M, mat(0, 0.38 - i * 0.012, zz, 0.12)), c);
  }
  // back slats fanned
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.09;
    const slat = new THREE.BoxGeometry(0.1, 0.85, 0.025);
    slat.translate(0, 0.42, 0);
    b.add('vcol', slat, mul(M, mat(Math.sin(a) * 0.25, 0.33, -0.2, -0.45, 0, -a)), c);
  }
  // arms
  for (const s of [-1, 1]) {
    b.add('vcol', new THREE.BoxGeometry(0.14, 0.03, 0.75), mul(M, mat(s * 0.37, 0.62, 0.05)), c);
    b.add('vcol', new THREE.BoxGeometry(0.05, 0.62, 0.06), mul(M, mat(s * 0.36, 0.31, 0.32)), cd);
    b.add('vcol', new THREE.BoxGeometry(0.05, 0.45, 0.06), mul(M, mat(s * 0.33, 0.22, -0.25, 0.3)), cd);
    b.add('vcol', new THREE.BoxGeometry(0.05, 0.06, 0.7), mul(M, mat(s * 0.33, 0.36, 0.0, 0.12)), cd);
  }
  // little snow on the arms
  b.add('snow', new THREE.BoxGeometry(0.1, 0.03, 0.5), mul(M, mat(0.37, 0.65, 0.05)), 0xffffff);
}

/** Wooden lounger with sheepskin throw. */
export function lounger(b: Batch, x: number, y: number, z: number, yaw: number): void {
  const M = mat(x, y, z, 0, yaw, 0);
  b.add('vcol', new THREE.BoxGeometry(0.7, 0.08, 1.3), mul(M, mat(0, 0.36, 0.35)), 0x8a5a36);
  b.add('vcol', new THREE.BoxGeometry(0.7, 0.08, 0.9), mul(M, mat(0, 0.62, -0.62, 0.62)), 0x8a5a36);
  for (const [lx, lz] of [
    [-0.3, 0.9],
    [0.3, 0.9],
    [-0.3, -0.5],
    [0.3, -0.5],
  ]) b.add('vcol', new THREE.BoxGeometry(0.06, 0.36, 0.06), mul(M, mat(lx!, 0.18, lz!)), 0x5a3a24);
  const fur = new THREE.BoxGeometry(0.62, 0.07, 1.9, 6, 1, 12);
  noiseDisplace(fur, 0.02, 9, x + z);
  // bend the throw over the backrest
  const P = fur.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const zz = P.getZ(i);
    if (zz < -0.45) {
      const t = -0.45 - zz;
      P.setXYZ(i, P.getX(i), P.getY(i) + t * Math.sin(0.95), -0.45 - t * Math.cos(0.95));
    }
  }
  fur.computeVertexNormals();
  b.add('vcol', fur, mul(M, mat(0, 0.44, 0.45)), 0xf2eadf);
  // folded plaid blanket
  b.add('vcol', new THREE.BoxGeometry(0.55, 0.1, 0.35), mul(M, mat(0, 0.52, 0.75)), (p) => (Math.floor((p.x + 10) * 18) % 2 ? tmp.setHex(0xa3262a) : tmp.setHex(0x2b3d2f)));
}

/** Fire pit: ring of stones, logs teepee. Returns flame base center. */
export function firePit(b: Batch, x: number, y: number, z: number, rnd: Rand): THREE.Vector3 {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.24, 9, 7);
    noiseDisplace(g, 0.05, 5, i);
    const sh = 0.6 + rnd.next() * 0.4;
    b.add('stone', g, mat(x + Math.sin(a) * 0.95, y + 0.12, z + Math.cos(a) * 0.95, rnd.next(), rnd.next(), 0, 1.15, 0.8, 1), tmp.setRGB(sh, sh * 0.97, sh * 0.93).clone(), (gg) => {
      const uv = gg.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.6 + i * 0.13, uv.getY(k) * 0.4);
    });
  }
  b.add('vcol', new THREE.CircleGeometry(0.85, 16).rotateX(-Math.PI / 2), mat(x, y + 0.04, z), 0x1c1714);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const top = new THREE.Vector3(x, y + 0.85, z);
    const bot = new THREE.Vector3(x + Math.sin(a) * 0.55, y + 0.05, z + Math.cos(a) * 0.55);
    b.add('vcol', beam(bot, top, 0.07, 6), undefined, (p) => (p.y > y + 0.45 ? tmp.setHex(0x1a120d) : tmp.setHex(0x5a3a22)));
  }
  // glowing embers bed
  b.add('bulb', new THREE.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), mat(x, y + 0.06, z), 0xff5a10);
  return new THREE.Vector3(x, y + 0.08, z);
}

/** Wooden pole for string lights. Returns top attachment. */
export function lightPole(b: Batch, x: number, y: number, z: number, h: number): THREE.Vector3 {
  b.add('vcol', new THREE.CylinderGeometry(0.07, 0.09, h, 7), mat(x, y + h / 2, z), 0x5a3a24);
  b.add('snow', new THREE.SphereGeometry(0.11, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1), mat(x, y + h, z), 0xffffff);
  b.add('snow', new THREE.ConeGeometry(0.4, 0.3, 8), mat(x, y + 0.1, z), 0xffffff);
  return new THREE.Vector3(x, y + h - 0.12, z);
}

const BULB_COLS = [0xffd28a, 0xffc070, 0xffe0a8, 0xffb55c];
/** Catenary wire with bulbs between a and b. Pushes bulb positions/colours. */
export function stringLights(b: Batch, a: THREE.Vector3, c: THREE.Vector3, sag: number, spacing: number, out: Array<{ p: THREE.Vector3; c: number }>, rnd: Rand): void {
  const len = a.distanceTo(c);
  const n = Math.max(2, Math.round(len / spacing));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(c, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  b.add('metal', new THREE.TubeGeometry(curve, n * 2, 0.012, 3, false), undefined, 0x1a1a1a);
  for (let i = 1; i < n; i++) {
    const p = pts[i]!.clone();
    p.y -= 0.09;
    const col = rnd.next() < 0.12 ? 0xff7a50 : BULB_COLS[i % BULB_COLS.length]!;
    b.add('bulb', new THREE.SphereGeometry(0.055, 6, 5).scale(1, 1.3, 1), mat(p.x, p.y, p.z), col);
    b.add('metal', new THREE.CylinderGeometry(0.02, 0.02, 0.05, 5), mat(p.x, p.y + 0.07, p.z), 0x222222);
    out.push({ p, c: col });
  }
}

/** Ski rack with skis, poles and boards leaning. */
export function skiRack(b: Batch, x: number, y: number, z: number, yaw: number, rnd: Rand): void {
  const M = mat(x, y, z, 0, yaw, 0);
  const L = 3.2;
  for (const s of [-1, 1]) {
    b.add('vcol', new THREE.BoxGeometry(0.12, 1.3, 0.12), mul(M, mat((s * L) / 2, 0.65, 0)), 0x5a3a24);
    b.add('vcol', new THREE.BoxGeometry(0.12, 0.12, 0.9), mul(M, mat((s * L) / 2, 0.06, 0)), 0x5a3a24);
  }
  b.add('vcol', new THREE.BoxGeometry(L + 0.2, 0.1, 0.12), mul(M, mat(0, 1.25, 0)), 0x6b4830);
  b.add('vcol', new THREE.BoxGeometry(L, 0.08, 0.1), mul(M, mat(0, 0.35, 0.28)), 0x6b4830);
  b.add('snow', new THREE.BoxGeometry(L + 0.2, 0.06, 0.14), mul(M, mat(0, 1.33, 0)), 0xffffff);
  const cols = [0xe63a2e, 0x1d4fd8, 0xf2f2f2, 0xffb02e, 0x111827, 0x16a34a, 0xdb2777];
  let px = -L / 2 + 0.25;
  while (px < L / 2 - 0.2) {
    const kind = rnd.next();
    const col = rnd.pick(cols);
    if (kind < 0.65) {
      // pair of skis
      for (const dx of [0, 0.09]) {
        const ski = new THREE.BoxGeometry(0.085, 1.72, 0.022, 1, 8, 1);
        const P = ski.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < P.count; i++) {
          const yy = P.getY(i);
          if (yy > 0.7) P.setZ(i, P.getZ(i) - (yy - 0.7) * (yy - 0.7) * 0.5);
        }
        ski.computeVertexNormals();
        b.add('vcol', ski, mul(M, mat(px + dx, 0.86, 0.2, -0.2)), (p) => (Math.abs(p.y - 0.86 - 0.0) < 0.15 ? tmp.setHex(0x222222) : tmp.setHex(col)));
      }
      px += 0.3;
    } else if (kind < 0.85) {
      const board = new THREE.CapsuleGeometry(0.13, 1.25, 4, 10);
      board.scale(1, 1, 0.12);
      b.add('vcol', board, mul(M, mat(px + 0.1, 0.8, 0.24, -0.22)), (p) => (Math.sin(p.y * 6) > 0.6 ? tmp.setHex(0xffffff) : tmp.setHex(col)));
      px += 0.36;
    } else {
      for (const dx of [0, 0.05]) b.add('metal', new THREE.CylinderGeometry(0.01, 0.01, 1.25, 4), mul(M, mat(px + dx, 0.62, 0.22, -0.18, 0, dx * 2)), 0x9ca3af);
      px += 0.16;
    }
  }
}

/** Orange snow fence along a polyline (net + posts). Net goes into the non-shadow batch. */
export function snowFence(solid: Batch, net: Batch, pts: THREE.Vector3[], ground: Ground, colliders: Array<{ x: number; z: number; r: number }>): void {
  const H = 1.15;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const c = pts[i + 1]!;
    const len = Math.hypot(c.x - a.x, c.z - a.z);
    const n = Math.max(1, Math.round(len / 2.5));
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const x0 = a.x + (c.x - a.x) * t0;
      const z0 = a.z + (c.z - a.z) * t0;
      const x1 = a.x + (c.x - a.x) * t1;
      const z1 = a.z + (c.z - a.z) * t1;
      const y0 = ground(x0, z0);
      const y1 = ground(x1, z1);
      // net quad (slight sag) with UVs in metres
      const g = new THREE.BufferGeometry();
      const sag = 0.06;
      const segs = 4;
      const pos: number[] = [];
      const uv: number[] = [];
      const segLen = Math.hypot(x1 - x0, z1 - z0);
      for (let s = 0; s < segs; s++) {
        const u0 = s / segs;
        const u1 = (s + 1) / segs;
        const P = (u: number, v: number): [number, number, number] => {
          const yb = y0 + (y1 - y0) * u + 0.05;
          return [x0 + (x1 - x0) * u, yb + v * H - Math.sin(u * Math.PI) * sag * v, z0 + (z1 - z0) * u];
        };
        const q = [P(u0, 0), P(u1, 0), P(u1, 1), P(u0, 0), P(u1, 1), P(u0, 1)];
        const quv = [
          [u0, 0],
          [u1, 0],
          [u1, 1],
          [u0, 0],
          [u1, 1],
          [u0, 1],
        ];
        for (let j = 0; j < 6; j++) {
          pos.push(...q[j]!);
          uv.push((quv[j]![0]! * segLen) / 0.42, (quv[j]![1]! * H) / 0.42);
        }
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      net.add('fence', g, undefined, 0xffffff);
      // post
      solid.add('vcol', new THREE.CylinderGeometry(0.035, 0.035, H + 0.35, 5), mat(x0, y0 + (H + 0.35) / 2 - 0.1, z0), 0x2b2b2b);
      // snow banked at the foot of the fence
      solid.add('snow', new THREE.CapsuleGeometry(0.22, segLen, 3, 6).rotateZ(Math.PI / 2).scale(1, 0.5, 1), mat((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, Math.atan2(-(z1 - z0), x1 - x0), 0), 0xffffff);
    }
    // colliders along the segment
    const cn = Math.max(1, Math.round(len / 1.4));
    for (let k = 0; k <= cn; k++) {
      const t = k / cn;
      colliders.push({ x: a.x + (c.x - a.x) * t, z: a.z + (c.z - a.z) * t, r: 0.4 });
    }
  }
  const last = pts[pts.length - 1]!;
  const yl = ground(last.x, last.z);
  solid.add('vcol', new THREE.CylinderGeometry(0.035, 0.035, H + 0.35, 5), mat(last.x, yl + (H + 0.35) / 2 - 0.1, last.z), 0x2b2b2b);
}

/** Branded padded A-board along the chute; u0..v1 is the atlas region. */
export function aBoard(b: Batch, x: number, y: number, z: number, yaw: number, v0: number, v1: number): void {
  const M = mat(x, y, z, 0, yaw, 0);
  const W = 2.6;
  const H = 0.95;
  const lean = 0.32;
  for (const s of [1, -1]) {
    const g = new THREE.PlaneGeometry(W, H);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, s > 0 ? uv.getX(i) : 1 - uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
    const m = mul(M, mat(0, (H / 2) * Math.cos(lean), s * Math.sin(lean) * (H / 2), s * -lean, s > 0 ? 0 : Math.PI, 0));
    b.add('atlas', g, m, 0xffffff);
  }
  b.add('vcol', new THREE.BoxGeometry(W + 0.05, 0.06, 0.08), mul(M, mat(0, H * Math.cos(lean) - 0.02, 0)), 0xdddddd);
  b.add('snow', new THREE.BoxGeometry(W + 0.1, 0.06, 0.12), mul(M, mat(0, H * Math.cos(lean) + 0.03, 0)), 0xffffff);
}

/** Square event truss between two points (4 chords + zig-zag lacing). */
export function truss(b: Batch, a: THREE.Vector3, c: THREE.Vector3, w: number, hi: boolean): void {
  const dir = new THREE.Vector3().subVectors(c, a);
  const len = dir.length();
  dir.normalize();
  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const s1 = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(w / 2);
  const s2 = new THREE.Vector3().crossVectors(dir, s1).normalize().multiplyScalar(w / 2);
  const offs = [s1.clone().add(s2), s1.clone().sub(s2), s1.clone().negate().sub(s2), s1.clone().negate().add(s2)];
  for (const o of offs) b.add('metal', beam(a.clone().add(o), c.clone().add(o), 0.025, 6), undefined, 0xd9dde3);
  const n = Math.round(len / w);
  if (!hi && n > 60) return;
  for (let i = 0; i < n; i++) {
    const p0 = a.clone().addScaledVector(dir, (i * len) / n);
    const p1 = a.clone().addScaledVector(dir, ((i + 1) * len) / n);
    for (let k = 0; k < 4; k++) {
      const o0 = offs[k]!;
      const o1 = offs[(k + 1) % 4]!;
      b.add('metal', beam(p0.clone().add(i % 2 ? o0 : o1), p1.clone().add(i % 2 ? o1 : o0), 0.012, 4), undefined, 0xc9ced6);
    }
  }
}

/** Padded post cover (red with white bands) around a truss leg. */
export function paddedPost(b: Batch, x: number, y: number, z: number): void {
  const g = new THREE.CapsuleGeometry(0.42, 2.4, 6, 14);
  g.translate(0, 1.6, 0);
  b.add('vcol', g, mat(x, y - 0.2, z), (p) => {
    const yy = p.y - y;
    if (yy > 1.05 && yy < 1.35) return tmp.setHex(0xffffff);
    if (yy > 1.9 && yy < 2.05) return tmp.setHex(0xffb02e);
    return tmp.setHex(0xd92d20);
  });
}

/** Cedar barrel hot tub with bench ring. Returns water centre (world). */
export function hotTub(b: Batch, x: number, y: number, z: number, R: number, hi: boolean): THREE.Vector3 {
  const H = 1.0;
  const n = hi ? 34 : 24;
  const sw = ((Math.PI * 2 * R) / n) * 1.03;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const tint = 0.88 + ((i * 37) % 11) / 50;
    const st = new THREE.BoxGeometry(sw, H, 0.07);
    b.add('logs', st, mat(x + Math.sin(a) * R, y + H / 2, z + Math.cos(a) * R, 0, a, 0), new THREE.Color(1.0 * tint, 0.62 * tint, 0.5 * tint));
  }
  for (const hy of [0.18, 0.8]) b.add('metal', new THREE.TorusGeometry(R + 0.04, 0.018, 4, 40).rotateX(Math.PI / 2), mat(x, y + hy, z), 0x2a2a2a);
  b.add('vcol', new THREE.TorusGeometry(R, 0.06, 4, 40).rotateX(Math.PI / 2).scale(1, 0.6, 1), mat(x, y + H, z), 0x8a4a30);
  // bench / step ring around the tub (seat height 0.6)
  const benchH = 0.6;
  const ring = new THREE.CylinderGeometry(R + 0.5, R + 0.5, benchH, 40, 1, true);
  b.add('logs', ring, mat(x, y + benchH / 2, z), 0xa8603e, (g) => {
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 9, uv.getY(k) * 0.4);
  });
  const top = new THREE.RingGeometry(R + 0.03, R + 0.54, 40, 1);
  top.rotateX(-Math.PI / 2);
  b.add('planks', top, mat(x, y + benchH + 0.01, z), (p) => tmp.setRGB(0.85, 0.66, 0.55).multiplyScalar(0.9 + 0.1 * Math.sin(Math.atan2(p.x - x, p.z - z) * 40)));
  // steps up on the front
  b.add('vcol', new THREE.BoxGeometry(0.9, 0.3, 0.45), mat(x, y + 0.15, z + R + 0.85), 0x6e3e28);
  // snow ring around the base
  const snow = new THREE.TorusGeometry(R + 0.56, 0.22, 5, 32).rotateX(Math.PI / 2).scale(1, 0.5, 1);
  noiseDisplace(snow, 0.06, 3, 2);
  b.add('snow', snow, mat(x, y + 0.02, z), 0xffffff);
  // towels stacked on the bench
  const tc = [0xf3f4f6, 0x0ea5a4, 0xf3f4f6];
  for (let i = 0; i < 3; i++) b.add('vcol', new THREE.BoxGeometry(0.42, 0.07, 0.32), mat(x - (R + 0.35), y + benchH + 0.05 + i * 0.075, z - 0.3, 0, 0.8 + i * 0.1, 0), tc[i]!);
  return new THREE.Vector3(x, y + 0.86, z);
}

/** Podium blocks (vertex coloured) + number plates & backdrop (atlas). Front faces -Z. Returns top of 1st step. */
export function podium(b: Batch, x: number, y: number, z: number): { top: THREE.Vector3; heights: number[] } {
  const steps: Array<[number, number, number]> = [
    [0, 1.15, 0], // 1st: dx, height, atlas cell
    [2.1, 0.8, 1],
    [-2.1, 0.55, 2],
  ];
  const W = 2.0;
  const Dp = 1.6;
  for (const [dx, h, cell] of steps) {
    b.add('vcol', new THREE.BoxGeometry(W, h - 0.16, Dp), mat(x + dx, y + (h - 0.16) / 2 - 0.05, z), 0x13234a);
    b.add('vcol', new THREE.BoxGeometry(W + 0.04, 0.1, Dp + 0.04), mat(x + dx, y + h - 0.16, z), 0xffb02e);
    b.add('vcol', new THREE.BoxGeometry(W + 0.06, 0.08, Dp + 0.06), mat(x + dx, y + h - 0.08, z), 0xf8fafc);
    const plate = new THREE.PlaneGeometry(0.9, 0.9 * Math.min(1, (h - 0.2) / 0.9));
    const uv = plate.attributes.uv as THREE.BufferAttribute;
    const ph = Math.min(1, (h - 0.2) / 0.9);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cell + uv.getX(i)) / 4, (0.5 - ph / 2 + uv.getY(i) * ph) * 0.25);
    b.add('atlas', plate, mat(x + dx, y + h / 2 - 0.08, z - Dp / 2 - 0.006, 0, Math.PI, 0), 0xffffff);
    // snow dusting on top edges
    b.add('snow', new THREE.BoxGeometry(W + 0.02, 0.04, 0.12), mat(x + dx, y + h - 0.03, z + Dp / 2 - 0.05), 0xffffff);
  }
  // backdrop board
  const bw = 7.2;
  const bh = 3.6;
  const bz = z + Dp / 2 + 0.6;
  const g = new THREE.PlaneGeometry(bw, bh);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 0.5 + uv.getY(i) * 0.5);
  b.add('atlas', g, mat(x, y + 0.5 + bh / 2, bz - 0.06, 0, Math.PI, 0), 0xffffff);
  b.add('vcol', new THREE.BoxGeometry(bw + 0.2, bh + 0.2, 0.1), mat(x, y + 0.5 + bh / 2, bz), 0x0d1a3a);
  for (const s of [-1, 1]) {
    b.add('metal', new THREE.CylinderGeometry(0.08, 0.08, bh + 1.2, 8), mat(x + (s * bw) / 2, y + (bh + 1.2) / 2 - 0.2, bz + 0.12), 0xc9ced6);
  }
  b.add('snow', new THREE.BoxGeometry(bw + 0.3, 0.1, 0.25), mat(x, y + 0.6 + bh + 0.12, bz), 0xffffff);
  return { top: new THREE.Vector3(x, y + 1.1, z), heights: steps.map((s) => s[1]) };
}

export function flagPole(b: Batch, x: number, y: number, z: number, h: number): THREE.Vector3 {
  b.add('metal', new THREE.CylinderGeometry(0.04, 0.06, h, 8), mat(x, y + h / 2, z), 0xd9dde3);
  b.add('metal', new THREE.SphereGeometry(0.08, 8, 6), mat(x, y + h, z), 0xffc44d);
  b.add('snow', new THREE.ConeGeometry(0.4, 0.3, 8), mat(x, y + 0.1, z), 0xffffff);
  return new THREE.Vector3(x, y + h - 0.2, z);
}

export { boxBeam };

/** Black iron lantern post. Returns lantern centre. */
export function lampPost(b: Batch, x: number, y: number, z: number): THREE.Vector3 {
  b.add('metal', new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), mat(x, y + 0.15, z), 0x1f2328);
  b.add('metal', new THREE.CylinderGeometry(0.05, 0.06, 2.9, 8), mat(x, y + 1.6, z), 0x1f2328);
  b.add('metal', new THREE.BoxGeometry(0.3, 0.05, 0.3), mat(x, y + 3.05, z), 0x1f2328);
  b.add('bulb', new THREE.CylinderGeometry(0.11, 0.09, 0.34, 6), mat(x, y + 3.25, z), 0xffc070);
  for (const [dx, dz] of [
    [0.12, 0.12],
    [-0.12, 0.12],
    [0.12, -0.12],
    [-0.12, -0.12],
  ]) b.add('metal', new THREE.BoxGeometry(0.025, 0.4, 0.025), mat(x + dx!, y + 3.25, z + dz!), 0x1f2328);
  b.add('metal', new THREE.ConeGeometry(0.26, 0.22, 4).rotateY(Math.PI / 4), mat(x, y + 3.55, z), 0x1f2328);
  b.add('snow', new THREE.ConeGeometry(0.22, 0.1, 8), mat(x, y + 3.66, z), 0xffffff);
  b.add('snow', new THREE.ConeGeometry(0.45, 0.25, 8), mat(x, y + 0.08, z), 0xffffff);
  return new THREE.Vector3(x, y + 3.25, z);
}

/** A cheerful snowman with scarf, carrot nose and stick arms. */
export function snowman(b: Batch, x: number, y: number, z: number, yaw: number): void {
  const M = mat(x, y, z, 0, yaw, 0);
  const balls: Array<[number, number]> = [
    [0.5, 0.42],
    [1.18, 0.32],
    [1.68, 0.23],
  ];
  balls.forEach(([cy, r], i) => {
    const g = new THREE.SphereGeometry(r, 16, 12);
    noiseDisplace(g, 0.015, 6, i);
    b.add('snow', g, mul(M, mat(0, cy, 0)), 0xffffff);
  });
  for (const s of [-1, 1]) {
    b.add('vcol', new THREE.SphereGeometry(0.028, 6, 4), mul(M, mat(s * 0.08, 1.74, 0.2)), 0x111111);
    const arm = beam(new THREE.Vector3(s * 0.28, 1.25, 0), new THREE.Vector3(s * 0.75, 1.55, 0.05), 0.02, 4);
    b.add('vcol', arm, M, 0x4a3020);
    b.add('vcol', beam(new THREE.Vector3(s * 0.62, 1.47, 0.03), new THREE.Vector3(s * 0.7, 1.66, 0.05), 0.012, 3), M, 0x4a3020);
  }
  b.add('vcol', new THREE.ConeGeometry(0.035, 0.22, 6).rotateX(Math.PI / 2), mul(M, mat(0, 1.66, 0.3)), 0xf97316);
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25;
    b.add('vcol', new THREE.SphereGeometry(0.018, 5, 4), mul(M, mat(Math.sin(a) * 0.15, 1.6 - Math.cos(a) * 0.05, 0.2)), 0x111111);
  }
  for (let i = 0; i < 3; i++) b.add('vcol', new THREE.SphereGeometry(0.03, 6, 4), mul(M, mat(0, 1.05 + i * 0.12, 0.3 - Math.abs(i - 1) * 0.01)), 0x111111);
  b.add('vcol', new THREE.TorusGeometry(0.2, 0.05, 6, 16).rotateX(Math.PI / 2), mul(M, mat(0, 1.45, 0)), (p) => (Math.floor((p.x + p.z + 10) * 12) % 2 ? tmp.setHex(0xdc2626) : tmp.setHex(0xfafafa)));
  b.add('vcol', new THREE.BoxGeometry(0.1, 0.35, 0.03), mul(M, mat(0.12, 1.3, 0.24, 0, 0, 0.15)), 0xdc2626);
  // top hat
  b.add('vcol', new THREE.CylinderGeometry(0.2, 0.2, 0.025, 14), mul(M, mat(0, 1.88, 0)), 0x111111);
  b.add('vcol', new THREE.CylinderGeometry(0.13, 0.13, 0.22, 14), mul(M, mat(0, 2.0, 0)), 0x111111);
  b.add('vcol', new THREE.CylinderGeometry(0.135, 0.135, 0.04, 14), mul(M, mat(0, 1.92, 0)), 0xb91c1c);
}

/** Simple wooden bench. */
export function bench(b: Batch, x: number, y: number, z: number, yaw: number): void {
  const M = mat(x, y, z, 0, yaw, 0);
  for (let i = 0; i < 3; i++) b.add('vcol', new THREE.BoxGeometry(1.8, 0.05, 0.13), mul(M, mat(0, 0.45, -0.15 + i * 0.15)), 0x8a5a36);
  for (let i = 0; i < 2; i++) b.add('vcol', new THREE.BoxGeometry(1.8, 0.12, 0.04), mul(M, mat(0, 0.68 + i * 0.16, -0.25, -0.12)), 0x8a5a36);
  for (const s of [-1, 1]) {
    b.add('metal', new THREE.BoxGeometry(0.05, 0.45, 0.45), mul(M, mat(s * 0.8, 0.22, 0)), 0x1f2328);
    b.add('metal', new THREE.BoxGeometry(0.04, 0.5, 0.04), mul(M, mat(s * 0.8, 0.7, -0.24, -0.12)), 0x1f2328);
  }
  b.add('snow', new THREE.BoxGeometry(1.6, 0.05, 0.36), mul(M, mat(0.05, 0.5, 0.02)), 0xffffff);
}

/** Directional signpost with arrow boards (atlas strips). */
export function signpost(b: Batch, x: number, y: number, z: number, yaw: number): void {
  const M = mat(x, y, z, 0, yaw, 0);
  b.add('vcol', new THREE.CylinderGeometry(0.07, 0.08, 2.8, 7), mul(M, mat(0, 1.4, 0)), 0x5a3a24);
  b.add('snow', new THREE.SphereGeometry(0.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mul(M, mat(0, 2.8, 0)), 0xffffff);
  const boards: Array<[number, number, number, number]> = [
    [2.35, 0.25, 0.375, 0.5],
    [1.9, -0.35, 0.25, 0.375],
  ];
  for (const [by, ry, v0, v1] of boards) {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.17);
    sh.lineTo(1.3, -0.17);
    sh.lineTo(1.5, 0);
    sh.lineTo(1.3, 0.17);
    sh.lineTo(0, 0.17);
    sh.lineTo(0, -0.17);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false });
    g.translate(0.05, 0, -0.025);
    b.add('vcol', g, mul(M, mat(0, by, 0, 0, ry, 0)), 0x6b4830);
    for (const s of [1, -1]) {
      const p = new THREE.PlaneGeometry(1.25, 0.26);
      const uv = p.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, s > 0 ? uv.getX(i) : 1 - uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
      b.add('atlas', p, mul(M, mat(0, by, 0, 0, ry, 0)).multiply(mat(0.7, 0, s * 0.028, 0, s > 0 ? 0 : Math.PI, 0)), 0xffffff);
    }
  }
}
