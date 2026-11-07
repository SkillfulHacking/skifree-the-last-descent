/**
 * "The Last Lodge": a log chalet with stone plinth, steep snow-loaded gable roof, glazed front
 * gable, timber deck with railings, stone chimney, shutters, window boxes and lanterns.
 * All geometry is appended to a Batch (merged per material) in lodge-local space then transformed by M.
 */
import * as THREE from 'three';
import { Batch, Rand, beam, boxBeam, mat, mul, projectUV, vnoise } from './util';

export const LODGE = {
  W: 14,
  D: 16,
  base: 1.1,
  eave: 5.7,
  pitch: (50 * Math.PI) / 180,
  ovSide: 1.3,
  ovFront: 1.9,
  deckDepth: 6.5,
  deckY: 1.1,
} as const;

export interface LodgeInfo {
  /** lodge-local points of interest */
  entranceLamp: THREE.Vector3;
  chimneyTop: THREE.Vector3;
  signCenter: THREE.Vector3;
  deckCorners: THREE.Vector3[];
  eaveFront: THREE.Vector3[];
  heaterTops: THREE.Vector3[];
  bulbs: THREE.Vector3[];
}

const WOOD_DARK = 0x4a2f1e;
const WOOD_MID = 0x7a5232;

/** Project UVs in local space before transforming into the lodge frame. */
function uvGeo(g: THREE.BufferGeometry, local: THREE.Matrix4 | null, tileU: number, tileV = tileU): THREE.BufferGeometry {
  if (local) g.applyMatrix4(local);
  const n = g.index ? g.toNonIndexed() : g;
  if (n !== g) g.dispose();
  projectUV(n, tileU, tileV);
  return n;
}

function logCyl(batch: Batch, M: THREE.Matrix4, a: THREE.Vector3, b: THREE.Vector3, r: number, tint: number, seg = 10): void {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  // scale UVs: v along length
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * (len / 1.7) + tint * 3.1);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  // random roll so the grain/knots differ per log
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tint * 40));
  const local = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  const c = new THREE.Color(0xffffff).multiplyScalar(0.82 + (tint % 1) * 0.3);
  batch.add('logs', g, mul(M, local), c);
  for (const [p, s] of [
    [a, -1],
    [b, 1],
  ] as const) {
    const cap = new THREE.CircleGeometry(r * 0.97, seg);
    const qn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().multiplyScalar(s));
    const m = new THREE.Matrix4().compose(p, qn, new THREE.Vector3(1, 1, 1));
    batch.add('logEnd', cap, mul(M, m), c);
  }
}

export function buildLodge(batch: Batch, M: THREE.Matrix4, rnd: Rand, sinkDepth: number, hi: boolean): LodgeInfo {
  const { W, D, base, eave, pitch, ovSide, ovFront, deckDepth, deckY } = LODGE;
  const hw = W / 2;
  const hd = D / 2;
  const tanP = Math.tan(pitch);
  const ridge = eave + 0.3 + hw * tanP;
  const logR = 0.2;
  const course = 0.37;
  const ext = 0.45; // corner overhang of logs
  const seg = hi ? 12 : 8;

  // ---------- stone plinth ----------
  const plinthH = base + sinkDepth;
  const plinth = new THREE.BoxGeometry(W + 0.5, plinthH, D + 0.5);
  batch.add('stone', uvGeo(plinth, mat(0, base - plinthH / 2, 0), 1.6), M, 0xffffff);
  // plinth cap ledge
  batch.add('stone', uvGeo(new THREE.BoxGeometry(W + 0.75, 0.14, D + 0.75), mat(0, base - 0.02, 0), 1.6), M, 0xd8d2c8);

  // ---------- log walls ----------
  interface Opening {
    a: number;
    b: number;
    y0: number;
    y1: number;
  }
  const front: Opening[] = [
    { a: -1.15, b: 1.15, y0: base, y1: base + 2.55 },
    { a: -5.6, b: -2.1, y0: base + 0.75, y1: base + 3.85 },
    { a: 2.1, b: 5.6, y0: base + 0.75, y1: base + 3.85 },
  ];
  const side: Opening[] = [
    { a: -5.4, b: -3.6, y0: base + 1.0, y1: base + 3.2 },
    { a: -1.0, b: 1.0, y0: base + 1.0, y1: base + 3.2 },
    { a: 3.4, b: 5.2, y0: base + 1.0, y1: base + 3.2 },
  ];
  const back: Opening[] = [
    { a: -4.5, b: -2.7, y0: base + 1.2, y1: base + 3.0 },
    { a: 2.7, b: 4.5, y0: base + 1.2, y1: base + 3.0 },
  ];
  const wallLogs = (along: 'x' | 'z', fixed: number, half: number, yOff: number, openings: Opening[]): void => {
    for (let y = base + logR + yOff; y < eave + 0.01; y += course) {
      // intervals excluding openings
      const cuts = openings.filter((o) => y + logR * 0.6 > o.y0 && y - logR * 0.6 < o.y1).sort((p, q) => p.a - q.a);
      let s = -half - ext;
      const segs: Array<[number, number]> = [];
      for (const o of cuts) {
        if (o.a > s) segs.push([s, o.a]);
        s = Math.max(s, o.b);
      }
      segs.push([s, half + ext]);
      for (const [s0, s1] of segs) {
        if (s1 - s0 < 0.15) continue;
        const a = along === 'x' ? new THREE.Vector3(s0, y, fixed) : new THREE.Vector3(fixed, y, s0);
        const b = along === 'x' ? new THREE.Vector3(s1, y, fixed) : new THREE.Vector3(fixed, y, s1);
        logCyl(batch, M, a, b, logR * (0.94 + rnd.next() * 0.1), rnd.next() * 7, seg);
      }
    }
  };
  wallLogs('x', hd, hw, 0, front);
  wallLogs('x', -hd, hw, 0, back);
  wallLogs('z', hw, hd, course / 2, side);
  wallLogs('z', -hw, hd, course / 2, side);
  // chinking (light mortar strips) behind logs: a slightly inset box per wall
  for (const [w, d, x, z] of [
    [W, 0.24, 0, hd - 0.2],
    [W, 0.24, 0, -hd + 0.2],
    [0.24, D, hw - 0.2, 0],
    [0.24, D, -hw + 0.2, 0],
  ] as const) {
    batch.add('vcol', new THREE.BoxGeometry(w, eave - base, d), mul(M, mat(x, (eave + base) / 2, z)), 0xcfc4b0);
  }
  // back gable: logs shortening upward
  for (let y = eave + logR; y < ridge - 0.5; y += course) {
    const half = (ridge - 0.25 - y) / tanP - 0.1;
    if (half < 0.3) break;
    logCyl(batch, M, new THREE.Vector3(-half, y, -hd), new THREE.Vector3(half, y, -hd), logR, rnd.next() * 7, seg);
  }

  // ---------- window frames, glass, door ----------
  const addWindow = (cx: number, cy: number, w: number, h: number, nrm: THREE.Vector3, along: THREE.Vector3, depthPos: THREE.Vector3, mullV: number, mullH: number, shutters: boolean): void => {
    // glass recessed slightly into the wall plane
    const qn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    const pos = depthPos.clone().addScaledVector(along, cx).setY(cy);
    const glass = new THREE.PlaneGeometry(w, h);
    batch.add('glass', glass, mul(M, new THREE.Matrix4().compose(pos.clone().addScaledVector(nrm, -0.05), qn, new THREE.Vector3(1, 1, 1))), 0xffffff);
    const frameT = 0.14;
    const fm = (dx: number, dy: number, fw: number, fh: number, dz = 0.06, fd = 0.16): void => {
      const p = pos.clone().addScaledVector(along, dx).setY(cy + dy).addScaledVector(nrm, dz);
      batch.add('vcol', new THREE.BoxGeometry(fw, fh, fd), mul(M, new THREE.Matrix4().compose(p, qn, new THREE.Vector3(1, 1, 1))), WOOD_DARK);
    };
    fm(0, h / 2 + frameT / 2, w + frameT * 2, frameT);
    fm(0, -h / 2 - frameT / 2, w + frameT * 2.4, frameT * 1.2, 0.1, 0.26); // sill
    fm(-w / 2 - frameT / 2, 0, frameT, h);
    fm(w / 2 + frameT / 2, 0, frameT, h);
    for (let i = 1; i < mullV; i++) fm(-w / 2 + (w * i) / mullV, 0, 0.07, h, 0.0, 0.08);
    for (let i = 1; i < mullH; i++) fm(0, -h / 2 + (h * i) / mullH, w, 0.07, 0.0, 0.08);
    // lintel log-beam
    fm(0, h / 2 + frameT + 0.06, w + 0.8, 0.12, 0.12, 0.22);
    if (shutters) {
      for (const s of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const p = pos.clone().addScaledVector(along, s * (w / 2 + frameT + w * 0.25) + (k - 1.5) * (w * 0.5) / 4.1 * 1).setY(cy).addScaledVector(nrm, 0.16);
          const board = new THREE.BoxGeometry((w * 0.5) / 4.3, h + 0.1, 0.05);
          batch.add('vcol', board, mul(M, new THREE.Matrix4().compose(p, qn, new THREE.Vector3(1, 1, 1))), k % 2 ? 0x7d1f1a : 0x8b2620);
        }
        // Z brace
        const p0 = pos.clone().addScaledVector(along, s * (w / 2 + frameT + w * 0.25)).setY(cy).addScaledVector(nrm, 0.2);
        batch.add('vcol', new THREE.BoxGeometry(w * 0.5, 0.09, 0.03), mul(M, new THREE.Matrix4().compose(p0.clone().setY(cy + h * 0.32), qn, new THREE.Vector3(1, 1, 1))), 0x5e1612);
        batch.add('vcol', new THREE.BoxGeometry(w * 0.5, 0.09, 0.03), mul(M, new THREE.Matrix4().compose(p0.clone().setY(cy - h * 0.32), qn, new THREE.Vector3(1, 1, 1))), 0x5e1612);
      }
      // window box with snow & greenery
      const pb = pos.clone().setY(cy - h / 2 - 0.32).addScaledVector(nrm, 0.25);
      batch.add('vcol', new THREE.BoxGeometry(w + 0.2, 0.32, 0.32), mul(M, new THREE.Matrix4().compose(pb, qn, new THREE.Vector3(1, 1, 1))), 0x6b2a1c);
      for (let k = 0; k < 5; k++) {
        const pg = pos.clone().addScaledVector(along, -w / 2 + 0.15 + (k * (w - 0.3)) / 4).setY(cy - h / 2 - 0.1).addScaledVector(nrm, 0.27);
        batch.add('vcol', new THREE.ConeGeometry(0.14, 0.3, 6), mul(M, new THREE.Matrix4().compose(pg, qn, new THREE.Vector3(1, 1, 1))), 0x24452c);
      }
      const ps = pos.clone().setY(cy - h / 2 - 0.12).addScaledVector(nrm, 0.25);
      const snow = new THREE.CapsuleGeometry(0.15, w - 0.1, 4, 8);
      snow.rotateZ(Math.PI / 2);
      snow.scale(1, 0.55, 1);
      batch.add('snow', snow, mul(M, new THREE.Matrix4().compose(ps, qn, new THREE.Vector3(1, 1, 1))), 0xffffff);
    }
  };
  const nF = new THREE.Vector3(0, 0, 1);
  const nB = new THREE.Vector3(0, 0, -1);
  const nL = new THREE.Vector3(-1, 0, 0);
  const nR = new THREE.Vector3(1, 0, 0);
  // front windows (big)
  for (const o of front.slice(1)) addWindow((o.a + o.b) / 2, (o.y0 + o.y1) / 2, o.b - o.a - 0.1, o.y1 - o.y0 - 0.1, nF, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, hd), 3, 2, false);
  // sides
  for (const o of side) {
    addWindow((o.a + o.b) / 2, (o.y0 + o.y1) / 2, o.b - o.a - 0.1, o.y1 - o.y0 - 0.1, nR, new THREE.Vector3(0, 0, -1), new THREE.Vector3(hw, 0, 0), 2, 2, true);
    addWindow(-(o.a + o.b) / 2, (o.y0 + o.y1) / 2, o.b - o.a - 0.1, o.y1 - o.y0 - 0.1, nL, new THREE.Vector3(0, 0, 1), new THREE.Vector3(-hw, 0, 0), 2, 2, true);
  }
  for (const o of back) addWindow(-(o.a + o.b) / 2, (o.y0 + o.y1) / 2, o.b - o.a - 0.1, o.y1 - o.y0 - 0.1, nB, new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -hd), 2, 2, true);
  // door: double glazed door with heavy frame
  {
    const d = front[0]!;
    const dw = d.b - d.a;
    const dh = d.y1 - d.y0;
    const p = new THREE.Vector3(0, d.y0 + dh / 2, hd - 0.04);
    for (const s of [-1, 1]) {
      const leaf = new THREE.BoxGeometry(dw / 2 - 0.08, dh - 0.08, 0.08);
      batch.add('vcol', leaf, mul(M, mat(s * dw / 4, p.y, p.z)), 0x5a361f);
      batch.add('glass', new THREE.PlaneGeometry(dw / 2 - 0.45, dh - 0.9), mul(M, mat(s * dw / 4, p.y + 0.15, p.z + 0.045)), 0xffffff);
      batch.add('metal', new THREE.BoxGeometry(0.04, 0.5, 0.06), mul(M, mat(s * 0.12, p.y, p.z + 0.08)), 0x2b2b2b);
    }
    batch.add('vcol', new THREE.BoxGeometry(dw + 0.5, 0.25, 0.3), mul(M, mat(0, d.y1 + 0.12, hd + 0.05)), WOOD_DARK);
    batch.add('vcol', new THREE.BoxGeometry(0.22, dh, 0.3), mul(M, mat(-dw / 2 - 0.11, p.y, hd + 0.05)), WOOD_DARK);
    batch.add('vcol', new THREE.BoxGeometry(0.22, dh, 0.3), mul(M, mat(dw / 2 + 0.11, p.y, hd + 0.05)), WOOD_DARK);
  }

  // ---------- front gable: glazed triangle with heavy timber frame ----------
  {
    const z = hd - 0.05;
    const yb = eave + 0.15;
    const yt = ridge - 0.55;
    const hb = hw - 0.4;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-hb, yb, z, hb, yb, z, 0, yt, z], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    tri.computeVertexNormals();
    batch.add('glass', tri, M, 0xffffff);
    const T = 0.24;
    const fz = z + 0.1;
    const add = (a: THREE.Vector3, b: THREE.Vector3, w = T): void => batch.add('vcol', boxBeam(a, b, w, 0.3), M, WOOD_DARK);
    add(new THREE.Vector3(-hw - 0.2, yb - 0.05, fz), new THREE.Vector3(hw + 0.2, yb - 0.05, fz), 0.36);
    add(new THREE.Vector3(-hb, yb, fz), new THREE.Vector3(0, yt + 0.1, fz));
    add(new THREE.Vector3(hb, yb, fz), new THREE.Vector3(0, yt + 0.1, fz));
    for (const x of [-hb * 0.66, -hb * 0.33, 0, hb * 0.33, hb * 0.66]) {
      const top = yb + (yt - yb) * (1 - Math.abs(x) / hb);
      add(new THREE.Vector3(x, yb, fz - 0.03), new THREE.Vector3(x, top, fz - 0.03), x === 0 ? 0.22 : 0.1);
    }
    const ym = yb + (yt - yb) * 0.42;
    const xm = hb * (1 - 0.42);
    add(new THREE.Vector3(-xm, ym, fz - 0.03), new THREE.Vector3(xm, ym, fz - 0.03), 0.12);
    // king post brace (decorative)
    add(new THREE.Vector3(-xm * 0.6, yb, fz + 0.06), new THREE.Vector3(0, ym, fz + 0.06), 0.16);
    add(new THREE.Vector3(xm * 0.6, yb, fz + 0.06), new THREE.Vector3(0, ym, fz + 0.06), 0.16);
  }

  // ---------- loft balcony on the front gable ----------
  {
    const by = eave + 0.25;
    const bz0 = hd;
    const bz1 = hd + 1.3;
    const bw = 4.2;
    batch.add('planks', uvGeo(new THREE.BoxGeometry(bw * 2, 0.16, bz1 - bz0), mat(0, by, (bz0 + bz1) / 2), 1.6), M, 0xb0a090);
    for (const x of [-bw, -bw / 2, 0, bw / 2, bw]) {
      batch.add('vcol', beam(new THREE.Vector3(x, by - 0.1, bz0), new THREE.Vector3(x, by - 0.1, bz1 + 0.1), 0.11, 6), M, WOOD_DARK);
    }
    // carved baluster boards
    for (let x = -bw + 0.1; x <= bw - 0.1; x += 0.24) {
      batch.add('vcol', new THREE.BoxGeometry(0.17, 0.9, 0.04), mul(M, mat(x, by + 0.53, bz1)), WOOD_MID);
    }
    for (const s of [-1, 1]) {
      for (let z = bz0 + 0.15; z < bz1; z += 0.24) batch.add('vcol', new THREE.BoxGeometry(0.04, 0.9, 0.17), mul(M, mat(s * bw, by + 0.53, z)), WOOD_MID);
    }
    batch.add('vcol', new THREE.BoxGeometry(bw * 2 + 0.15, 0.1, 0.14), mul(M, mat(0, by + 1.02, bz1)), WOOD_DARK);
    batch.add('snow', new THREE.BoxGeometry(bw * 2 + 0.1, 0.07, 0.16), mul(M, mat(0, by + 1.1, bz1)), 0xffffff);
  }

  // ---------- roof ----------
  const roofT = 0.3;
  const snowT = 0.55;
  const roofDepth = D + ovFront * 2;
  const run = hw + ovSide;
  const slabLen = run / Math.cos(pitch);
  const bulbs: THREE.Vector3[] = [];
  const eaveFront: THREE.Vector3[] = [];
  for (const s of [1, -1]) {
    const nrm = new THREE.Vector3(s * Math.sin(pitch), Math.cos(pitch), 0);
    const midX = (s * run) / 2;
    const midY = ridge - (run / 2) * tanP;
    const rot = mat(0, 0, 0, 0, 0, -s * pitch);
    const slab = new THREE.BoxGeometry(slabLen, roofT, roofDepth);
    const p = new THREE.Vector3(midX, midY, 0).addScaledVector(nrm, roofT / 2);
    batch.add('vcol', slab, mul(M, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(rot)), 0x3b2618);
    // snow layer (lumpy top)
    const sseg = hi ? 28 : 14;
    const sl = new THREE.BoxGeometry(slabLen + 0.25, snowT, roofDepth + 0.15, sseg, 1, sseg);
    const P = sl.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const z = P.getZ(i);
      if (y > 0) {
        const n = vnoise(x * 0.9 + s * 10, z * 0.7) * 0.22 + vnoise(x * 3, z * 3) * 0.05;
        // thinner toward ridge, rounded at the eave edge
        const tEave = (x * s + slabLen / 2) / slabLen; // 0 ridge side .. 1 eave side (in rotated slab frame x points downslope for s>0)
        const edgeZ = Math.abs(z) / (roofDepth / 2);
        const round = Math.max(0, edgeZ - 0.9) * 2.5;
        P.setY(i, y + n - round * 0.35 - (tEave < 0.04 ? 0.15 : 0));
      }
    }
    sl.computeVertexNormals();
    const ps = new THREE.Vector3(midX + s * 0.1, midY, 0).addScaledVector(nrm, roofT + snowT / 2 - 0.02);
    const rotS = mat(0, 0, 0, 0, 0, -s * pitch);
    const snowG = sl.toNonIndexed();
    sl.dispose();
    projectUV(snowG, 3);
    batch.add('snow', snowG, mul(M, new THREE.Matrix4().makeTranslation(ps.x, ps.y, ps.z).multiply(rotS)), 0xffffff);
    // eave cornice: rounded snow lip hanging over the edge
    const eaveX = s * run;
    const eaveY = ridge - run * tanP;
    const lip = new THREE.CapsuleGeometry(0.32, roofDepth - 0.3, 4, 10);
    lip.rotateX(Math.PI / 2);
    lip.scale(1, 0.8, 1);
    const lipP = new THREE.Vector3(eaveX - s * 0.05, eaveY, 0).addScaledVector(nrm, roofT + 0.18);
    batch.add('snow', lip, mul(M, mat(lipP.x, lipP.y, lipP.z)), 0xffffff);
    // fascia board
    batch.add('vcol', new THREE.BoxGeometry(0.08, 0.42, roofDepth), mul(M, mat(eaveX + s * Math.sin(pitch) * 0.1, eaveY + 0.12, 0, 0, 0, -s * pitch * 0.2)), WOOD_DARK);
    // icicles
    const icN = hi ? 70 : 34;
    for (let i = 0; i < icN; i++) {
      const z = -roofDepth / 2 + 0.3 + (i / icN) * (roofDepth - 0.6) + rnd.range(-0.1, 0.1);
      const len = Math.pow(rnd.next(), 2.2) * 0.9 + 0.08;
      const ic = new THREE.ConeGeometry(0.025 + len * 0.03, len, 5);
      ic.rotateX(Math.PI);
      batch.add('ice', ic, mul(M, mat(eaveX + s * 0.04, eaveY - 0.05 - len / 2, z)), 0xffffff);
    }
    // string of bulbs along the eave (lodge side only near front)
    for (let k = 0; k <= 26; k++) {
      const z = -roofDepth / 2 + 0.4 + (k / 26) * (roofDepth - 0.8);
      bulbs.push(new THREE.Vector3(eaveX - s * 0.05, eaveY - 0.12 - 0.08 * Math.sin((k % 3) * 1.05), z));
    }
    eaveFront.push(new THREE.Vector3(eaveX, eaveY - 0.15, roofDepth / 2 - 0.3));
  }
  // ridge snow cap & ridge beam
  {
    const cap = new THREE.CapsuleGeometry(0.33, roofDepth - 0.2, 4, 10);
    cap.rotateX(Math.PI / 2);
    cap.scale(1.3, 0.8, 1);
    batch.add('snow', cap, mul(M, mat(0, ridge + roofT + snowT * 0.4, 0)), 0xffffff);
  }
  // barge boards along gables + carved purlin/ridge log ends under the overhang
  for (const zEnd of [hd + ovFront, -hd - ovFront]) {
    const zs = Math.sign(zEnd);
    for (const s of [1, -1]) {
      const a = new THREE.Vector3(0, ridge + roofT + 0.05, zEnd + zs * 0.03);
      const b = new THREE.Vector3(s * run, ridge - run * tanP + roofT * 0.4, zEnd + zs * 0.03);
      batch.add('vcol', boxBeam(a, b, 0.5, 0.1), M, 0x3a2416);
      // snow on top of the barge board
      batch.add('snow', boxBeam(a.clone().add(new THREE.Vector3(0, 0.45, 0)), b.clone().add(new THREE.Vector3(0, 0.45, 0)), 0.16, 0.28), M, 0xffffff);
    }
    for (const x of [0, -hw * 0.5, hw * 0.5, -hw * 0.95, hw * 0.95]) {
      const y = ridge - Math.abs(x) * tanP - 0.24;
      const z0 = zs * (hd - 0.5);
      const z1 = zEnd - zs * 0.1;
      logCyl(batch, M, new THREE.Vector3(x, y, z0), new THREE.Vector3(x, y, z1), x === 0 ? 0.24 : 0.19, rnd.next() * 7, seg);
    }
  }
  // front knee braces under the overhang
  for (const s of [-1, 1]) {
    batch.add('vcol', boxBeam(new THREE.Vector3(s * (hw - 0.1), eave - 1.3, hd + 0.2), new THREE.Vector3(s * hw * 0.95, ridge - hw * 0.95 * tanP - 0.35, hd + ovFront - 0.3), 0.2, 0.2), M, WOOD_DARK);
  }

  // ---------- stone chimney on the +X side ----------
  const chX = hw + 0.75;
  const chZ = -2.5;
  const chTop = ridge + 0.8;
  {
    const h = chTop + sinkDepth;
    batch.add('stone', uvGeo(new THREE.BoxGeometry(1.5, h, 1.7), mat(chX, chTop - h / 2, chZ), 1.4), M, 0xffffff);
    // shoulder taper
    batch.add('stone', uvGeo(new THREE.BoxGeometry(1.9, 2.4, 2.1), mat(chX + 0.1, 1.2, chZ), 1.4), M, 0xffffff);
    batch.add('stone', uvGeo(new THREE.BoxGeometry(1.8, 0.22, 2.0), mat(chX, chTop + 0.1, chZ), 1.4), M, 0xbdb6aa);
    batch.add('metal', new THREE.CylinderGeometry(0.28, 0.28, 0.6, 10), mul(M, mat(chX, chTop + 0.5, chZ)), 0x2c2c2c);
    batch.add('metal', new THREE.ConeGeometry(0.45, 0.3, 10), mul(M, mat(chX, chTop + 0.95, chZ)), 0x2c2c2c);
    batch.add('snow', new THREE.BoxGeometry(1.85, 0.16, 2.05), mul(M, mat(chX, chTop + 0.28, chZ)), 0xffffff);
    // flashing where the chimney meets the roof (snow drift)
  }

  // ---------- deck ----------
  const deckX0 = -hw - 1.2;
  const deckX1 = hw + 1.2;
  const deckZ0 = hd + 0.25;
  const deckZ1 = hd + deckDepth;
  const deckW = deckX1 - deckX0;
  batch.add('planks', uvGeo(new THREE.BoxGeometry(deckW, 0.14, deckZ1 - deckZ0), mat((deckX0 + deckX1) / 2, deckY - 0.07, (deckZ0 + deckZ1) / 2), 2.4), M, 0xd6c3a8);
  // rim joists
  batch.add('vcol', new THREE.BoxGeometry(deckW + 0.1, 0.32, 0.12), mul(M, mat((deckX0 + deckX1) / 2, deckY - 0.26, deckZ1)), 0x5a3a24);
  for (const x of [deckX0, deckX1]) batch.add('vcol', new THREE.BoxGeometry(0.12, 0.32, deckZ1 - deckZ0), mul(M, mat(x, deckY - 0.26, (deckZ0 + deckZ1) / 2)), 0x5a3a24);
  // lattice skirt (stone underneath)
  batch.add('stone', uvGeo(new THREE.BoxGeometry(deckW - 0.2, deckY + sinkDepth - 0.3, deckZ1 - deckZ0 - 0.2), mat((deckX0 + deckX1) / 2, (deckY - 0.3 - sinkDepth) / 2, (deckZ0 + deckZ1) / 2), 1.6), M, 0xb8b0a4);
  // posts + railing
  const stairHalf = 1.4;
  const railY = deckY + 1.0;
  const postAt = (x: number, z: number): void => {
    batch.add('vcol', new THREE.BoxGeometry(0.2, 1.25, 0.2), mul(M, mat(x, deckY + 0.58, z)), 0x5a3a24);
    batch.add('snow', new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1), mul(M, mat(x, deckY + 1.21, z)), 0xffffff);
  };
  const railRun = (a: THREE.Vector3, b: THREE.Vector3): void => {
    const len = a.distanceTo(b);
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    batch.add('vcol', boxBeam(a.clone().setY(railY), b.clone().setY(railY), 0.14, 0.09), M, 0x5a3a24);
    batch.add('snow', boxBeam(a.clone().setY(railY + 0.09), b.clone().setY(railY + 0.09), 0.12, 0.06), M, 0xffffff);
    batch.add('vcol', boxBeam(a.clone().setY(deckY + 0.12), b.clone().setY(deckY + 0.12), 0.1, 0.07), M, 0x5a3a24);
    const n = Math.floor(len / 0.16);
    for (let i = 1; i < n; i++) {
      const p = a.clone().addScaledVector(dir, (i * len) / n);
      batch.add('vcol', new THREE.BoxGeometry(0.045, 0.85, 0.045), mul(M, mat(p.x, deckY + 0.55, p.z)), WOOD_MID);
    }
  };
  const corners = [
    new THREE.Vector3(deckX0, 0, deckZ0),
    new THREE.Vector3(deckX0, 0, deckZ1),
    new THREE.Vector3(-stairHalf, 0, deckZ1),
    new THREE.Vector3(stairHalf, 0, deckZ1),
    new THREE.Vector3(deckX1, 0, deckZ1),
    new THREE.Vector3(deckX1, 0, deckZ0),
  ];
  railRun(corners[0]!, corners[1]!);
  railRun(corners[1]!, corners[2]!);
  railRun(corners[3]!, corners[4]!);
  railRun(corners[4]!, corners[5]!);
  for (const c of corners) postAt(c.x, c.z);
  for (const x of [deckX0 + deckW * 0.25, deckX0 + deckW * 0.75]) postAt(x, deckZ1);
  // stairs
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const y = deckY - ((i + 1) * deckY) / (steps + 0.5);
    const z = deckZ1 + 0.35 + i * 0.36;
    batch.add('planks', uvGeo(new THREE.BoxGeometry(stairHalf * 2 - 0.1, 0.1, 0.38), mat(0, y, z), 2.4), M, 0xd6c3a8);
  }
  for (const s of [-1, 1]) batch.add('vcol', boxBeam(new THREE.Vector3(s * (stairHalf - 0.02), deckY - 0.1, deckZ1), new THREE.Vector3(s * (stairHalf - 0.02), -0.2, deckZ1 + steps * 0.36 + 0.3), 0.1, 0.3), M, 0x5a3a24);
  // entrance arch over the stairs with the sign
  const archZ = deckZ1 + 0.1;
  const archH = deckY + 3.4;
  for (const s of [-1, 1]) {
    logCyl(batch, M, new THREE.Vector3(s * (stairHalf + 0.15), -0.4, archZ), new THREE.Vector3(s * (stairHalf + 0.15), archH, archZ), 0.17, rnd.next() * 7, seg);
  }
  logCyl(batch, M, new THREE.Vector3(-stairHalf - 0.8, archH - 0.1, archZ), new THREE.Vector3(stairHalf + 0.8, archH - 0.1, archZ), 0.16, rnd.next() * 7, seg);
  batch.add('snow', new THREE.CapsuleGeometry(0.15, stairHalf * 2 + 1.4, 4, 8).rotateZ(Math.PI / 2).scale(1, 0.6, 1), mul(M, mat(0, archH + 0.08, archZ)), 0xffffff);
  for (const s of [-1, 1]) {
    batch.add('metal', beam(new THREE.Vector3(s * 1.25, archH - 0.25, archZ), new THREE.Vector3(s * 1.25, archH - 0.62, archZ), 0.012, 4), M, 0x333333);
    // lanterns on arch posts
    const lp = new THREE.Vector3(s * (stairHalf + 0.15), deckY + 2.3, archZ + 0.25);
    batch.add('metal', new THREE.BoxGeometry(0.22, 0.3, 0.22), mul(M, mat(lp.x, lp.y, lp.z)), 0x1e1e1e);
    batch.add('metal', new THREE.ConeGeometry(0.2, 0.14, 4).rotateY(Math.PI / 4), mul(M, mat(lp.x, lp.y + 0.22, lp.z)), 0x1e1e1e);
    batch.add('bulb', new THREE.BoxGeometry(0.16, 0.24, 0.16), mul(M, mat(lp.x, lp.y, lp.z)), 0xffc070);
    bulbs.push(lp.clone());
  }
  // wall sconces beside the door
  for (const s of [-1, 1]) {
    const p = new THREE.Vector3(s * 1.75, base + 2.1, hd + 0.3);
    batch.add('metal', new THREE.BoxGeometry(0.2, 0.32, 0.2), mul(M, mat(p.x, p.y, p.z)), 0x1e1e1e);
    batch.add('bulb', new THREE.BoxGeometry(0.15, 0.24, 0.15), mul(M, mat(p.x, p.y, p.z)), 0xffc070);
    bulbs.push(p.clone());
  }

  // ---------- deck furniture: high tables, benches, patio heaters ----------
  const heaterTops: THREE.Vector3[] = [];
  const tables = [
    [-5.2, hd + 3.0],
    [-2.6, hd + 4.6],
    [3.2, hd + 3.6],
    [5.8, hd + 4.8],
  ];
  for (const [x, z] of tables) {
    batch.add('vcol', new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14), mul(M, mat(x!, deckY + 1.05, z!)), WOOD_MID);
    batch.add('metal', new THREE.CylinderGeometry(0.04, 0.04, 1.02, 6), mul(M, mat(x!, deckY + 0.53, z!)), 0x222222);
    batch.add('metal', new THREE.CylinderGeometry(0.25, 0.28, 0.04, 12), mul(M, mat(x!, deckY + 0.02, z!)), 0x222222);
    // mugs/candle on table
    batch.add('vcol', new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), mul(M, mat(x! + 0.12, deckY + 1.13, z!)), 0xc23b2c);
    batch.add('bulb', new THREE.CylinderGeometry(0.035, 0.035, 0.07, 8), mul(M, mat(x! - 0.1, deckY + 1.12, z! + 0.05)), 0xffb050);
  }
  // long bench against the façade
  for (const x0 of [-6.0, 3.0]) {
    batch.add('vcol', new THREE.BoxGeometry(3.0, 0.08, 0.45), mul(M, mat(x0 + 1.5, deckY + 0.45, hd + 0.6)), WOOD_MID);
    batch.add('vcol', new THREE.BoxGeometry(3.0, 0.5, 0.06), mul(M, mat(x0 + 1.5, deckY + 0.75, hd + 0.4, -0.15)), WOOD_MID);
    for (const dx of [0.15, 2.85]) batch.add('vcol', new THREE.BoxGeometry(0.08, 0.45, 0.4), mul(M, mat(x0 + dx, deckY + 0.22, hd + 0.6)), WOOD_DARK);
    // sheepskins on the bench
    batch.add('vcol', new THREE.BoxGeometry(0.6, 0.06, 0.45).translate(0, 0, 0), mul(M, mat(x0 + 0.8, deckY + 0.5, hd + 0.62)), 0xf1e9dc);
    batch.add('vcol', new THREE.BoxGeometry(0.6, 0.06, 0.45), mul(M, mat(x0 + 2.1, deckY + 0.5, hd + 0.62)), 0xe9ddcc);
  }
  // patio heaters
  for (const [x, z] of [
    [-6.8, hd + 5.6],
    [6.9, hd + 2.0],
  ]) {
    batch.add('metal', new THREE.CylinderGeometry(0.3, 0.36, 0.25, 12), mul(M, mat(x!, deckY + 0.12, z!)), 0x3a3a3a);
    batch.add('metal', new THREE.CylinderGeometry(0.06, 0.06, 2.0, 8), mul(M, mat(x!, deckY + 1.2, z!)), 0x8a8a8a);
    batch.add('bulb', new THREE.CylinderGeometry(0.13, 0.13, 0.5, 10, 1, true), mul(M, mat(x!, deckY + 2.0, z!)), 0xff7a2a);
    batch.add('metal', new THREE.ConeGeometry(0.75, 0.3, 14, 1, true), mul(M, mat(x!, deckY + 2.45, z!)), 0x8a8a8a);
    batch.add('snow', new THREE.ConeGeometry(0.7, 0.18, 14), mul(M, mat(x!, deckY + 2.62, z!)), 0xffffff);
    heaterTops.push(new THREE.Vector3(x!, deckY + 2.0, z!));
  }

  // ---------- snow drifts around the base ----------
  const drift = (x: number, z: number, sx: number, sz: number, h: number): void => {
    const g = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const P = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < P.count; i++) {
      const n = vnoise(P.getX(i) * 2 + x, P.getZ(i) * 2 + z);
      P.setY(i, P.getY(i) * (0.7 + n * 0.6));
    }
    g.computeVertexNormals();
    batch.add('snow', g, mul(M, mat(x, -0.05, z, 0, 0, 0, sx, h, sz)), 0xffffff);
  };
  for (let z = -hd + 1; z < hd; z += 2.6) {
    drift(hw + 0.4, z + rnd.range(-0.4, 0.4), 0.9, 1.4, 0.5 + rnd.next() * 0.4);
    drift(-hw - 0.4, z + rnd.range(-0.4, 0.4), 0.9, 1.4, 0.5 + rnd.next() * 0.4);
  }
  for (let x = -hw + 1; x < hw; x += 2.8) drift(x, -hd - 0.4, 1.4, 0.9, 0.6 + rnd.next() * 0.4);
  drift(deckX0 - 0.2, deckZ1 + 0.2, 1.3, 1.0, 0.7);
  drift(deckX1 + 0.2, deckZ1 + 0.2, 1.3, 1.0, 0.8);
  drift(-stairHalf - 1.0, deckZ1 + 0.5, 0.9, 0.7, 0.55);
  drift(stairHalf + 1.0, deckZ1 + 0.5, 0.9, 0.7, 0.55);

  return {
    entranceLamp: new THREE.Vector3(0, deckY + 2.8, archZ + 1.0),
    chimneyTop: new THREE.Vector3(chX, chTop + 1.1, chZ),
    signCenter: new THREE.Vector3(0, archH - 0.95, archZ + 0.02),
    deckCorners: corners,
    eaveFront,
    heaterTops,
    bulbs,
  };
}
