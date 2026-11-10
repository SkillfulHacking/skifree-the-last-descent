/**
 * Procedural après-ski guest: one SkinnedMesh (single draw call) with smooth-weighted torso,
 * limbs and rigid head/hands, driven by a small 18-bone rig, two-bone arm IK and layered
 * procedural animation (idle / chat / sip / cheer / jump / look-at / welcome walk & wave).
 */
import * as THREE from 'three';
import { Rand, clamp01, damp, lerp, smooth, vnoise3 } from './util';

export type HairStyle = 'long' | 'waves' | 'ponytail' | 'bun' | 'bob' | 'curly' | 'braids' | 'short' | 'buzz';
export type Headwear = 'none' | 'beanie' | 'headband' | 'earmuffs' | 'hood';
export type TopStyle = 'puffer' | 'cropPuffer' | 'parka' | 'sweater' | 'robe' | 'skiJacket';
export type CheerStyle = 'clap' | 'armsUp' | 'pump' | 'toast';

export interface GuestLook {
  male?: boolean;
  height: number;
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  headwear: Headwear;
  hatColor: number;
  hatColor2: number;
  top: TopStyle;
  topColor: number;
  accent: number;
  fur: number | null;
  scarf: number | null;
  scarf2?: number;
  pants: 'ski' | 'leggings';
  pantsColor: number;
  boots: 'snow' | 'fluffy';
  bootColor: number;
  gloves: number | null;
  mug: 'L' | 'R' | null;
  mugColor: number;
  lips: number;
  eyes: number;
  beard?: boolean;
  /** hair part / bang side, -1..1 */
  part?: number;
}

export interface GuestBehaviour {
  seated?: boolean;
  canWalk?: boolean;
  cheerStyle: CheerStyle;
  jumpy?: boolean;
  /** which arm waves in welcome */
  waveArm?: 'L' | 'R';
  /** amplitude multiplier for reactions (bystanders are calmer) */
  energy?: number;
  seed: number;
}

const enum Bn {
  ROOT = 0,
  PELVIS,
  SPINE,
  CHEST,
  HEAD,
  HAIR,
  UARM_L,
  FARM_L,
  HAND_L,
  UARM_R,
  FARM_R,
  HAND_R,
  THIGH_L,
  SHIN_L,
  FOOT_L,
  THIGH_R,
  SHIN_R,
  FOOT_R,
}

type Infl = Array<[number, number]>;
type ColFn = (p: THREE.Vector3, ang: number) => THREE.Color;

const L1 = 0.28;
const L2 = 0.25;
const HEAD_C = new THREE.Vector3(0, 1.595, 0.012);
const HEAD_R = new THREE.Vector3(0.095, 0.124, 0.105);

interface Ring {
  y: number;
  rx: number;
  rz: number;
  cx?: number;
  cz?: number;
}

/** Elliptical ring sweep along +Y (rings must be in ascending y). */
function ringTube(rings: Ring[], seg: number, capBottom: boolean, capTop: boolean, phi0 = 0, phiLen = Math.PI * 2): THREE.BufferGeometry {
  const full = Math.abs(phiLen - Math.PI * 2) < 1e-6;
  const cols = full ? seg : seg + 1;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) {
    for (let j = 0; j < cols; j++) {
      const a = phi0 + (j / seg) * phiLen;
      pos.push((r.cx ?? 0) + Math.sin(a) * r.rx, r.y, (r.cz ?? 0) + Math.cos(a) * r.rz);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j1 = full ? (j + 1) % seg : j + 1;
      const a = i * cols + j;
      const b = i * cols + j1;
      const c = (i + 1) * cols + j;
      const d = (i + 1) * cols + j1;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (capBottom) {
    const r = rings[0]!;
    const ci = pos.length / 3;
    pos.push(r.cx ?? 0, r.y, r.cz ?? 0);
    for (let j = 0; j < seg; j++) idx.push(ci, full ? (j + 1) % seg : j + 1, j);
  }
  if (capTop) {
    const r = rings[rings.length - 1]!;
    const ci = pos.length / 3;
    pos.push(r.cx ?? 0, r.y, r.cz ?? 0);
    const base = (rings.length - 1) * cols;
    for (let j = 0; j < seg; j++) idx.push(ci, base + j, base + (full ? (j + 1) % seg : j + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function interp(table: ReadonlyArray<readonly number[]>, y: number, k: number): number {
  if (y <= table[0]![0]!) return table[0]![k]!;
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i]!;
    const b = table[i + 1]!;
    if (y <= b[0]!) {
      const t = (y - a[0]!) / (b[0]! - a[0]!);
      return lerp(a[k]!, b[k]!, t);
    }
  }
  return table[table.length - 1]![k]!;
}

// y, rx, rz, oz
const BODY_F: ReadonlyArray<readonly number[]> = [
  [0.78, 0.11, 0.08, 0],
  [0.8, 0.145, 0.105, -0.005],
  [0.84, 0.165, 0.118, -0.012],
  [0.89, 0.172, 0.122, -0.012],
  [0.95, 0.162, 0.114, -0.006],
  [1.02, 0.14, 0.1, 0],
  [1.08, 0.134, 0.098, 0],
  [1.15, 0.143, 0.105, 0.006],
  [1.22, 0.15, 0.112, 0.012],
  [1.29, 0.155, 0.106, 0.006],
  [1.35, 0.158, 0.096, 0],
  [1.39, 0.15, 0.086, -0.006],
  [1.42, 0.112, 0.074, -0.01],
  [1.47, 0.07, 0.066, -0.006],
];
const BODY_M: ReadonlyArray<readonly number[]> = [
  [0.78, 0.11, 0.085, 0],
  [0.8, 0.142, 0.108, -0.004],
  [0.86, 0.156, 0.118, -0.008],
  [0.95, 0.156, 0.116, -0.004],
  [1.04, 0.152, 0.112, 0.004],
  [1.15, 0.163, 0.118, 0.008],
  [1.25, 0.175, 0.12, 0.01],
  [1.33, 0.182, 0.108, 0.004],
  [1.39, 0.172, 0.094, -0.004],
  [1.42, 0.125, 0.08, -0.01],
  [1.47, 0.076, 0.07, -0.006],
];

const C = (hex: number): THREE.Color => new THREE.Color(hex);
const tmpC = new THREE.Color();

class SkinBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  si: number[] = [];
  sw: number[] = [];
  add(src: THREE.BufferGeometry, color: THREE.Color | ColFn, w: number | ((p: THREE.Vector3) => Infl), m?: THREE.Matrix4): void {
    const g0 = m ? src.applyMatrix4(m) : src;
    if (!g0.attributes.normal) g0.computeVertexNormals();
    const g = g0.index ? g0.toNonIndexed() : g0;
    const P = g.attributes.position as THREE.BufferAttribute;
    const N = g.attributes.normal as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      p.fromBufferAttribute(P, i);
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(N.getX(i), N.getY(i), N.getZ(i));
      const c = typeof color === 'function' ? color(p, Math.atan2(p.x, p.z)) : color;
      this.col.push(c.r, c.g, c.b);
      const infl: Infl = typeof w === 'number' ? [[w, 1]] : w(p);
      let tot = 0;
      for (const [, ww] of infl) tot += ww;
      for (let k = 0; k < 4; k++) {
        const e = infl[k];
        this.si.push(e ? e[0] : 0);
        this.sw.push(e ? e[1] / (tot || 1) : 0);
      }
    }
    g.dispose();
    if (g !== g0) g0.dispose();
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    return g;
  }
}

function blend(a: number, b: number, t: number): Infl {
  const s = smooth(t);
  if (s <= 0) return [[a, 1]];
  if (s >= 1) return [[b, 1]];
  return [
    [a, 1 - s],
    [b, s],
  ];
}

function ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, ws = 14, hs = 10): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  g.translate(cx, cy, cz);
  return g;
}

function fluffy(g: THREE.BufferGeometry, amp: number, freq: number, seed: number): THREE.BufferGeometry {
  const P = g.attributes.position as THREE.BufferAttribute;
  g.computeVertexNormals();
  const N = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i);
    const y = P.getY(i);
    const z = P.getZ(i);
    const d = (vnoise3(x * freq + seed, y * freq, z * freq) - 0.5) * 2 * amp;
    P.setXYZ(i, x + N.getX(i) * d, y + N.getY(i) * d, z + N.getZ(i) * d);
  }
  g.computeVertexNormals();
  return g;
}

/** Torus in the XZ plane, elliptical. */
function ringTorus(cx: number, cy: number, cz: number, R: number, r: number, sx = 1, sz = 1, tilt = 0, rs = 8, ts = 24): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(R, r, rs, ts);
  g.rotateX(Math.PI / 2);
  g.scale(sx, 1, sz);
  g.rotateX(tilt);
  g.translate(cx, cy, cz);
  return g;
}

/** Point on the front of the (deformed) head surface at given x,y (character space). */
function headZ(x: number, y: number): number {
  const ty = (y - HEAD_C.y) / HEAD_R.y;
  const kx = jawK(y);
  const t = 1 - (x / (HEAD_R.x * kx)) ** 2 - ty * ty;
  return HEAD_C.z + HEAD_R.z * kzK(y) * Math.sqrt(Math.max(0, t));
}
function jawK(y: number): number {
  const t = clamp01((HEAD_C.y - y) / HEAD_R.y);
  return 1 - 0.3 * t ** 1.6;
}
function kzK(y: number): number {
  const t = clamp01((HEAD_C.y - y) / HEAD_R.y);
  return 1 - 0.12 * t ** 2;
}

/** Head ellipsoid deformed with jaw taper. scale >1 for hair/hat shells. mask: hide vertices (pull inside). */
function headShell(scale: number, mask?: (d: THREE.Vector3) => boolean, dy = 0, dz = 0, ws = 22, hs = 16): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const P = g.attributes.position as THREE.BufferAttribute;
  const d = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    d.fromBufferAttribute(P, i);
    let s = scale;
    if (mask && mask(d)) s = 0.75;
    const y = HEAD_C.y + d.y * HEAD_R.y * s + dy;
    const k = jawK(y);
    P.setXYZ(i, d.x * HEAD_R.x * s * k, y, HEAD_C.z + dz + d.z * HEAD_R.z * s * kzK(y));
  }
  g.computeVertexNormals();
  return g;
}

/** Two-bone IK result applied to bones. Target & pole in parent (chest) space. */
const _u = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Vector3();
const _w = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
function solveArm(upper: THREE.Bone, fore: THREE.Bone, S: THREE.Vector3, T: THREE.Vector3, pole: THREE.Vector3): void {
  _u.subVectors(T, S);
  let d = _u.length();
  d = Math.min(Math.max(d, 0.08), L1 + L2 - 0.002);
  _u.normalize();
  _p.copy(pole).addScaledVector(_u, -pole.dot(_u));
  if (_p.lengthSq() < 1e-6) _p.set(0, -1, 0).addScaledVector(_u, _u.y);
  _p.normalize();
  const ca = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const a = Math.acos(Math.min(1, Math.max(-1, ca)));
  _e.copy(S).addScaledVector(_u, L1 * Math.cos(a)).addScaledVector(_p, L1 * Math.sin(a));
  const cg = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
  const bend = Math.PI - Math.acos(Math.min(1, Math.max(-1, cg)));
  // basis for upper arm
  _y.subVectors(S, _e).normalize(); // local +Y points up the arm
  const wx = S.x + _u.x * d - _e.x;
  const wy = S.y + _u.y * d - _e.y;
  const wz = S.z + _u.z * d - _e.z;
  _w.set(wx, wy, wz);
  _z.copy(_w).addScaledVector(_y, -_w.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.copy(_p).multiplyScalar(-1).addScaledVector(_y, _p.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _z.crossVectors(_x, _y).normalize();
  _m4.makeBasis(_x, _y, _z);
  upper.quaternion.setFromRotationMatrix(_m4);
  fore.rotation.set(-bend, 0, 0);
}

export class Guest {
  readonly group = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  private bones: THREE.Bone[] = [];
  private look: GuestLook;
  private beh: GuestBehaviour;
  private sw: number;
  private home = new THREE.Vector3();
  private homeYaw = 0;
  private yaw = 0;
  private cur = new THREE.Vector3();
  private walkPhase = 0;
  private walkAmt = 0;
  private headYaw = 0;
  private headPitch = 0;
  private sipT = 0;
  private nextSip: number;
  private chatTarget: THREE.Vector3 | null = null;
  private groundAt: (x: number, z: number) => number;
  private rnd: Rand;
  private ph: number;
  private tempo: number;
  private cheerS = 0;
  private welcomeS = 0;
  private SL: THREE.Vector3;
  private SR: THREE.Vector3;
  private mugHand: THREE.Bone | null = null;
  private sipping = 0;
  /**
   * Scripted-pose overrides for victory staging (0 = off: no guest outside a scripted beat ever
   * sets them, so every existing pose is unchanged).
   *  - hold: both hands together in front of the chest, as if presenting an object;
   *  - holdLift: 0 chest height … 1 raised to head height (with `hold`);
   *  - tuck: a cannonball (knees to the chest, arms hugging the shins).
   */
  hold = 0;
  holdLift = 0;
  tuck = 0;
  /** forced run cycle (stride phase, radians) for a scripted dash; null = off */
  run: number | null = null;

  constructor(look: GuestLook, beh: GuestBehaviour, material: THREE.Material, groundAt: (x: number, z: number) => number) {
    this.look = look;
    this.beh = beh;
    this.groundAt = groundAt;
    this.rnd = new Rand(beh.seed);
    this.ph = this.rnd.range(0, Math.PI * 2);
    this.tempo = this.rnd.range(0.85, 1.2);
    this.nextSip = this.rnd.range(1, 6);
    this.sw = look.male ? 1.1 : 1;
    this.SL = new THREE.Vector3(0.19 * this.sw, 0.16, 0);
    this.SR = new THREE.Vector3(-0.19 * this.sw, 0.16, 0);
    this.buildRig();
    const geo = this.buildGeometry();
    this.mesh = new THREE.SkinnedMesh(geo, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.bones[0]!);
    this.group.add(this.mesh);
    this.group.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(this.bones));
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), 1.7);
    const s = look.height / (look.male ? 1.8 : 1.7) * (look.male ? 1.04 : 1);
    this.group.scale.setScalar(s);
    if (look.mug) this.mugHand = this.bones[look.mug === 'L' ? Bn.HAND_L : Bn.HAND_R]!;
  }

  /** Place at home position with facing yaw; optional chat partner position to look at when idle. */
  place(x: number, z: number, yaw: number, chatTarget: THREE.Vector3 | null): void {
    this.home.set(x, 0, z);
    this.cur.copy(this.home);
    this.homeYaw = yaw;
    this.yaw = yaw;
    this.chatTarget = chatTarget;
    this.group.position.set(x, this.groundAt(x, z), z);
    this.group.rotation.y = yaw;
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** world position of a hand (props held by a scripted guest, e.g. a trophy presenter) */
  handWorld(side: 'L' | 'R', out: THREE.Vector3): THREE.Vector3 {
    const b = this.bones[side === 'L' ? Bn.HAND_L : Bn.HAND_R]!;
    b.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(b.matrixWorld);
  }

  private buildRig(): void {
    const sw = this.sw;
    const mk = (name: string, x: number, y: number, z: number, parent: number | null): THREE.Bone => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(x, y, z);
      if (parent !== null) this.bones[parent]!.add(b);
      this.bones.push(b);
      return b;
    };
    mk('root', 0, 0, 0, null);
    mk('pelvis', 0, 0.92, 0, Bn.ROOT);
    mk('spine', 0, 0.1, 0, Bn.PELVIS);
    mk('chest', 0, 0.2, 0, Bn.SPINE);
    mk('head', 0, 0.2, 0, Bn.CHEST);
    mk('hair', 0, 0.24, -0.09, Bn.HEAD);
    mk('uarmL', 0.19 * sw, 0.16, 0, Bn.CHEST);
    mk('farmL', 0, -L1, 0, Bn.UARM_L);
    mk('handL', 0, -L2, 0, Bn.FARM_L);
    mk('uarmR', -0.19 * sw, 0.16, 0, Bn.CHEST);
    mk('farmR', 0, -L1, 0, Bn.UARM_R);
    mk('handR', 0, -L2, 0, Bn.FARM_R);
    mk('thighL', 0.095, -0.05, 0, Bn.PELVIS);
    mk('shinL', 0, -0.43, 0, Bn.THIGH_L);
    mk('footL', 0, -0.37, 0, Bn.SHIN_L);
    mk('thighR', -0.095, -0.05, 0, Bn.PELVIS);
    mk('shinR', 0, -0.43, 0, Bn.THIGH_R);
    mk('footR', 0, -0.37, 0, Bn.SHIN_R);
  }

  private buildGeometry(): THREE.BufferGeometry {
    const L = this.look;
    const sb = new SkinBuilder();
    const male = !!L.male;
    const body = male ? BODY_M : BODY_F;
    const sw = this.sw;
    const top = L.top;
    const hem = top === 'parka' ? 0.6 : top === 'robe' ? 0.5 : top === 'cropPuffer' ? 0.99 : top === 'puffer' ? 0.88 : top === 'skiJacket' ? 0.86 : 0.9;
    const thick = top === 'puffer' || top === 'cropPuffer' ? 0.03 : top === 'parka' ? 0.03 : top === 'robe' ? 0.034 : top === 'skiJacket' ? 0.022 : 0.012;
    const quilt = top === 'puffer' || top === 'cropPuffer' ? 0.075 : top === 'parka' ? 0.13 : 0;
    const pantsAdd = L.pants === 'ski' ? 0.012 : 0.003;
    const topC = C(L.topColor);
    const accC = C(L.accent);
    const pantsC = C(L.pantsColor);
    const skinC = C(L.skin);
    const furC = L.fur !== null ? C(L.fur) : topC;

    const quiltF = (y: number): number => {
      if (!quilt) return 0;
      const s = Math.abs(Math.sin((y / quilt) * Math.PI));
      return Math.sqrt(s);
    };

    // ---------------- torso -----------------
    const rings: Ring[] = [];
    const yBottom = hem < 0.78 ? hem : 0.78;
    const yTop = 1.47;
    const coat = hem < 0.78;
    for (let y = yBottom; y <= yTop + 1e-6; y += 0.017) {
      const inJacket = y >= hem;
      let rx: number;
      let rz: number;
      let oz: number;
      if (y < 0.79) {
        // coat skirt
        const t = (0.79 - y) / (0.79 - hem + 1e-6);
        rx = 0.19 + t * 0.03 + (top === 'robe' ? 0.01 : 0);
        rz = 0.145 + t * 0.025;
        oz = -0.012;
      } else {
        rx = interp(body, y, 1);
        rz = interp(body, y, 2);
        oz = interp(body, y, 3);
        if (inJacket) {
          const neckFade = clamp01((y - 1.42) / 0.05);
          const th = thick * (1 - neckFade * 0.4) + (quilt ? quiltF(y) * 0.012 : 0);
          rx += th;
          rz += th;
          if (coat && y < 0.95) {
            // coat flares over the hips
            const t = clamp01((0.95 - y) / 0.16);
            rx = Math.max(rx, lerp(rx, 0.19, t));
            rz = Math.max(rz, lerp(rz, 0.145, t));
          }
        } else {
          rx += pantsAdd;
          rz += pantsAdd;
        }
      }
      rings.push({ y, rx, rz, cz: oz });
      // sharp hem step for short jackets
      if (!coat && hem > y && hem <= y + 0.017) {
        rings.push({ y: hem - 0.001, rx: rx * 0.98, rz: rz * 0.98, cz: oz });
      }
    }
    rings.sort((a, b) => a.y - b.y);
    const torso = ringTube(rings, 22, true, false);
    const torsoColor: ColFn = (p, ang) => {
      const y = p.y;
      if (y < hem - 0.0005 && !coat) return pantsC;
      if (y < 0.79 && coat) {
        if (y < hem + 0.03 && L.fur !== null && top === 'parka') return furC;
        // front opening line of the coat
        if (Math.abs(p.x) < 0.006 && p.z > 0) return tmpC.copy(topC).multiplyScalar(0.55);
        return topC;
      }
      let c = tmpC.copy(topC);
      if (top === 'sweater') {
        const yoke = y > 1.28 && y < 1.41;
        const band = y > 0.93 && y < 0.99;
        if (yoke || band) {
          const ia = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 56);
          const iy = Math.floor(y / 0.011);
          const diamond = (ia + iy) % 4 === 0 || (((ia - iy) % 4) + 4) % 4 === 0;
          const edge = Math.abs(y - 1.285) < 0.006 || Math.abs(y - 1.405) < 0.006 || Math.abs(y - 0.935) < 0.005 || Math.abs(y - 0.985) < 0.005;
          if (diamond || edge) c.copy(accC);
        }
        if (y < 0.93 || y > 1.43) c.multiplyScalar(0.85 + 0.15 * (Math.floor(ang * 40) % 2));
        return c;
      }
      if (top === 'robe') {
        if (y > 1.02 && y < 1.06) return accC; // belt
        if (p.z > 0 && Math.abs(p.x) < 0.07 - (1.42 - y) * 0.25 && y > 1.15) return tmpC.copy(topC).multiplyScalar(0.92);
        return c;
      }
      if (quilt) {
        const s = quiltF(y);
        c.multiplyScalar(0.72 + 0.28 * s);
      }
      if (top === 'skiJacket' && y > 1.2 && y < 1.3) c.copy(accC);
      if (Math.abs(p.x) < 0.005 && p.z > 0 && y > hem) c.copy(accC).multiplyScalar(0.6);
      if (y > 1.43 && L.fur !== null && top === 'parka') c.copy(furC);
      return c;
    };
    const torsoW = (p: THREE.Vector3): Infl => {
      const y = p.y;
      if (y >= 1.25) return [[Bn.CHEST, 1]];
      if (y >= 1.15) return blend(Bn.SPINE, Bn.CHEST, (y - 1.15) / 0.1);
      if (y >= 1.07) return [[Bn.SPINE, 1]];
      if (y >= 0.97) return blend(Bn.PELVIS, Bn.SPINE, (y - 0.97) / 0.1);
      if (y < 0.86) {
        // coat skirt / hips: front follows the thighs
        const t = clamp01((0.86 - y) / 0.14) * smooth((p.z + 0.02) / 0.12);
        if (t > 0.001) {
          const l = smooth((p.x + 0.05) / 0.1);
          return [
            [Bn.PELVIS, 1 - t],
            [Bn.THIGH_L, t * l],
            [Bn.THIGH_R, t * (1 - l)],
          ];
        }
      }
      return [[Bn.PELVIS, 1]];
    };
    sb.add(torso, torsoColor, torsoW);

    // fur hem ring on parka
    if (top === 'parka' && L.fur !== null) {
      sb.add(fluffy(ringTorus(0, hem + 0.012, -0.012, 0.215, 0.022, 1, 0.8, 0, 6, 36), 0.01, 40, 3), furC, torsoW);
    }

    // ---------------- arms ----------------
    const armThick = top === 'puffer' || top === 'cropPuffer' || top === 'parka' ? 0.022 : top === 'robe' ? 0.03 : top === 'skiJacket' ? 0.016 : 0.008;
    const armQuilt = top === 'puffer' || top === 'cropPuffer' ? 0.07 : 0;
    const ARM: ReadonlyArray<readonly number[]> = [
      [0.86, 0.036],
      [0.95, 0.039],
      [1.1, 0.043],
      [1.25, 0.049],
      [1.35, 0.053],
      [1.41, 0.046],
      [1.445, 0.018],
    ];
    for (const side of [1, -1]) {
      const sx = 0.19 * sw * side;
      const ub = side > 0 ? Bn.UARM_L : Bn.UARM_R;
      const fb = side > 0 ? Bn.FARM_L : Bn.FARM_R;
      const hb = side > 0 ? Bn.HAND_L : Bn.HAND_R;
      const ar: Ring[] = [];
      for (let y = 0.86; y <= 1.445 + 1e-6; y += 0.018) {
        let r = interp(ARM, y, 1) + armThick * clamp01((1.445 - y) / 0.04);
        if (armQuilt) r += Math.sqrt(Math.abs(Math.sin((y / armQuilt) * Math.PI))) * 0.008;
        if (y < 0.9 && top === 'robe') r += 0.012;
        ar.push({ y, rx: r, rz: r, cx: sx });
      }
      const arm = ringTube(ar, 12, true, false);
      const armCol: ColFn = (p) => {
        let c = tmpC.copy(topC);
        if (armQuilt) c.multiplyScalar(0.72 + 0.28 * Math.sqrt(Math.abs(Math.sin((p.y / armQuilt) * Math.PI))));
        if (top === 'sweater' && p.y < 0.92) c.multiplyScalar(0.85 + 0.15 * (Math.floor(Math.atan2(p.x - sx, p.z) * 6) % 2));
        if (top === 'skiJacket' && p.y > 1.18 && p.y < 1.24) c = tmpC.copy(accC);
        return c;
      };
      sb.add(arm, armCol, (p) => {
        if (p.y > 1.13) return [[ub, 1]];
        if (p.y > 1.06) return blend(fb, ub, (p.y - 1.06) / 0.07);
        return [[fb, 1]];
      });
      // shoulder ball (rigid with upper arm)
      const sr = 0.056 + armThick;
      sb.add(ellipsoid(sx * 0.98, 1.385, 0, sr, sr * 0.92, sr * 0.9), topC, ub);
      // cuff
      if (L.fur !== null && (top === 'parka' || top === 'robe' || top === 'cropPuffer')) {
        sb.add(fluffy(ringTorus(sx, 0.875, 0, 0.044 + armThick * 0.6, 0.017, 1, 1, 0, 6, 18), 0.006, 60, side), furC, fb);
      } else {
        sb.add(ringTorus(sx, 0.872, 0, 0.038 + armThick * 0.5, 0.01, 1, 1, 0, 6, 16), tmpC.copy(top === 'sweater' ? topC : accC).multiplyScalar(0.8).clone(), fb);
      }
      // hand: mitten / glove or bare hand
      const bare = L.gloves === null;
      const hc = bare ? skinC : C(L.gloves ?? 0x333333);
      const hr: Ring[] = [];
      const HAND: ReadonlyArray<readonly number[]> = bare
        ? [
            [0.725, 0.006, 0.01],
            [0.735, 0.014, 0.022],
            [0.76, 0.018, 0.032],
            [0.8, 0.019, 0.036],
            [0.84, 0.017, 0.029],
            [0.87, 0.018, 0.026],
          ]
        : [
            [0.685, 0.008, 0.012],
            [0.695, 0.019, 0.03],
            [0.72, 0.025, 0.042],
            [0.79, 0.026, 0.045],
            [0.84, 0.026, 0.04],
            [0.87, 0.028, 0.036],
          ];
      for (const h of HAND) hr.push({ y: h[0]!, rx: h[1]!, rz: h[2]!, cx: sx, cz: 0.004 });
      sb.add(ringTube(hr, 12, true, false), hc, hb);
      // thumb
      sb.add(ellipsoid(sx - side * 0.012, 0.79, 0.034, 0.014, 0.03, 0.014, 8, 6), hc, hb);
      // mug
      if (L.mug === (side > 0 ? 'L' : 'R')) this.addMug(sb, sx, side, hb);
    }

    // ---------------- legs ----------------
    const LEG: ReadonlyArray<readonly number[]> = [
      [0.07, 0.034],
      [0.14, 0.038],
      [0.26, 0.047],
      [0.34, 0.049],
      [0.44, 0.047],
      [0.55, 0.058],
      [0.7, 0.07],
      [0.84, 0.078],
      [0.92, 0.07],
    ];
    const bootTop = L.boots === 'fluffy' ? 0.3 : 0.27;
    const bootC = C(L.bootColor);
    for (const side of [1, -1]) {
      const lx = 0.095 * side;
      const tb = side > 0 ? Bn.THIGH_L : Bn.THIGH_R;
      const shb = side > 0 ? Bn.SHIN_L : Bn.SHIN_R;
      const fb = side > 0 ? Bn.FOOT_L : Bn.FOOT_R;
      const lr: Ring[] = [];
      for (let y = 0.12; y <= 0.92 + 1e-6; y += 0.04) {
        let r = interp(LEG, y, 1) + pantsAdd;
        if (L.pants === 'ski') r += clamp01((0.5 - y) / 0.4) * 0.012;
        lr.push({ y, rx: r, rz: r * 1.05, cx: lx - side * clamp01((y - 0.6) / 0.3) * 0.006 });
      }
      const leg = ringTube(lr, 11, true, true);
      sb.add(
        leg,
        (p) => {
          if (L.pants === 'ski' && Math.abs(p.x - lx - side * 0.06) < 0.006 && p.y > 0.2) return tmpC.copy(pantsC).multiplyScalar(0.6);
          return pantsC;
        },
        (p) => {
          if (p.y > 0.86) return [
            [tb, 1 - (p.y - 0.86) / 0.12],
            [Bn.PELVIS, (p.y - 0.86) / 0.12],
          ];
          if (p.y > 0.48) return [[tb, 1]];
          if (p.y > 0.4) return blend(shb, tb, (p.y - 0.4) / 0.08);
          return [[shb, 1]];
        },
      );
      // boot shaft
      const br: Ring[] = [];
      const bR = L.boots === 'fluffy' ? 0.064 : 0.056;
      for (let y = 0.02; y <= bootTop + 1e-6; y += 0.025) {
        const t = (y - 0.02) / (bootTop - 0.02);
        br.push({ y, rx: bR * (0.92 + 0.08 * Math.sin(t * Math.PI)), rz: bR * 1.08, cx: lx, cz: -0.004 });
      }
      let boot = ringTube(br, 12, false, true);
      if (L.boots === 'fluffy') boot = fluffy(boot, 0.006, 50, side * 3);
      sb.add(boot, bootC, (p) => (p.y < 0.07 ? [[fb, 1]] : [[shb, 1]]));
      if (L.boots === 'fluffy') {
        sb.add(fluffy(ringTorus(lx, bootTop, -0.004, bR + 0.005, 0.022, 1, 1.08, 0, 6, 18), 0.008, 45, side), C(L.fur ?? 0xf3ead8), shb);
      } else {
        sb.add(ringTorus(lx, bootTop - 0.005, -0.004, bR, 0.012, 1, 1.08, 0, 6, 16), tmpC.copy(bootC).multiplyScalar(0.7).clone(), shb);
        // laces
        for (let k = 0; k < 4; k++) sb.add(new THREE.BoxGeometry(0.05, 0.006, 0.006).translate(lx, 0.1 + k * 0.035, bR * 1.08 - 0.002), C(0xe8e0d0), shb);
      }
      // foot
      const foot = ellipsoid(lx, 0.05, 0.045, 0.054, 0.05, 0.12, 12, 8);
      sb.add(foot, bootC, fb);
      sb.add(new THREE.BoxGeometry(0.112, 0.026, 0.25).translate(lx, 0.013, 0.045), C(L.boots === 'fluffy' ? 0xd8cfc0 : 0x2a2420), fb);
    }

    // ---------------- neck & head ----------------
    const nr: Ring[] = [];
    for (let y = 1.38; y <= 1.53; y += 0.025) nr.push({ y, rx: 0.044, rz: 0.046, cz: 0.0 });
    sb.add(ringTube(nr, 12, false, false), top === 'sweater' ? topC : skinC, (p) => blend(Bn.CHEST, Bn.HEAD, (p.y - 1.42) / 0.06));
    sb.add(headShell(1, undefined, 0, 0, 20, 14), skinC, Bn.HEAD);
    // ears
    for (const s of [1, -1]) sb.add(ellipsoid(s * 0.088, 1.59, 0.0, 0.014, 0.027, 0.02, 8, 6), tmpC.copy(skinC).multiplyScalar(0.93).clone(), Bn.HEAD);
    this.addFace(sb);
    this.addHair(sb);
    this.addHeadwear(sb);

    // scarf / collar
    if (L.scarf !== null) {
      const sc = C(L.scarf);
      const sc2 = C(L.scarf2 ?? 0xffffff);
      const scarfCol: ColFn = (p) => (Math.floor((p.y + 0.003) / 0.022) % 2 === 0 ? sc : sc2);
      sb.add(fluffy(ringTorus(0, 1.465, 0.005, 0.072, 0.03, 1.05, 1, -0.1, 8, 24), 0.003, 80, 2), scarfCol, Bn.CHEST);
      const tail = new THREE.BoxGeometry(0.075, 0.26, 0.022, 1, 6, 1);
      tail.rotateZ(0.12);
      tail.translate(0.055, 1.33, 0.115);
      sb.add(tail, (p) => (Math.floor((p.y + 0.003) / 0.03) % 2 === 0 ? sc : sc2), Bn.CHEST);
    } else if (L.fur !== null && L.headwear !== 'hood' && (top === 'parka' || top === 'cropPuffer' || top === 'robe')) {
      sb.add(fluffy(ringTorus(0, 1.455, -0.012, 0.095, 0.036, 1.15, 0.95, -0.18, 8, 28), 0.012, 35, 5), furC, (p) => blend(Bn.CHEST, Bn.HEAD, (p.y - 1.47) / 0.08));
      if (top === 'parka') sb.add(ellipsoid(0, 1.42, -0.125, 0.12, 0.075, 0.06), topC, Bn.CHEST);
    } else if (top === 'puffer' || top === 'skiJacket') {
      // stand-up collar
      sb.add(ringTube([
        { y: 1.42, rx: 0.08, rz: 0.075, cz: -0.004 },
        { y: 1.5, rx: 0.074, rz: 0.07, cz: -0.004 },
      ], 18, false, false), tmpC.copy(topC).multiplyScalar(0.9).clone(), Bn.CHEST);
    }
    return sb.build();
  }

  private addMug(sb: SkinBuilder, sx: number, side: number, hb: number): void {
    const L = this.look;
    // mug axis along local +Z (vertical once the forearm is raised and the hand is corrected)
    const cx = sx - side * 0.068;
    const cy = 0.78;
    const mug = new THREE.CylinderGeometry(0.043, 0.038, 0.1, 14, 1, true);
    mug.rotateX(Math.PI / 2);
    mug.translate(cx, cy, 0);
    sb.add(mug, C(L.mugColor), hb);
    const bottom = new THREE.CircleGeometry(0.038, 12);
    bottom.translate(cx, cy, -0.05);
    bottom.rotateX(0); // faces +Z already; flip for bottom
    sb.add(bottom.rotateY(Math.PI).translate(2 * cx, 0, -0.1 + 0.0), C(L.mugColor), hb);
    const cocoa = new THREE.CircleGeometry(0.039, 14);
    cocoa.translate(cx, cy, 0.035);
    sb.add(cocoa, C(0x4a2614), hb);
    // whipped cream + marshmallows
    sb.add(fluffy(ellipsoid(cx, cy, 0.05, 0.034, 0.034, 0.022, 10, 6), 0.004, 120, side), C(0xfff6ea), hb);
    sb.add(new THREE.TorusGeometry(0.026, 0.008, 6, 12, Math.PI).rotateZ(-Math.PI / 2 * side).rotateY(0).translate(cx + side * 0.043, cy, 0.0).rotateX(0), C(L.mugColor), (p) => {
      void p;
      return [[hb, 1]];
    });
  }

  private addFace(sb: SkinBuilder): void {
    const L = this.look;
    const male = !!L.male;
    const dark = C(0x1d130e);
    const eyeC = C(L.eyes);
    for (const s of [1, -1]) {
      const ex = 0.034 * s;
      const ey = 1.598;
      const ez = headZ(ex, ey);
      // eye white (small) + iris + highlight
      sb.add(ellipsoid(ex, ey, ez - 0.006, 0.019, 0.013, 0.008, 8, 6), C(0xf6f1ea), Bn.HEAD);
      sb.add(ellipsoid(ex + s * 0.001, ey - 0.001, ez - 0.002, 0.0115, 0.0125, 0.007, 8, 6), eyeC, Bn.HEAD);
      sb.add(ellipsoid(ex + s * 0.001, ey - 0.001, ez + 0.0015, 0.006, 0.0068, 0.004, 8, 6), dark, Bn.HEAD);
      sb.add(ellipsoid(ex - 0.004, ey + 0.004, ez + 0.004, 0.0032, 0.0032, 0.002, 6, 4), C(0xffffff), Bn.HEAD);
      // upper lid line / lashes
      const lid = new THREE.TorusGeometry(0.019, male ? 0.0022 : 0.0034, 4, 10, Math.PI * 0.9);
      lid.scale(1, 0.75, 1);
      lid.rotateZ(Math.PI * 0.05);
      lid.translate(ex, ey - 0.002, ez - 0.001);
      sb.add(lid, dark, Bn.HEAD);
      if (!male) {
        const flick = new THREE.BoxGeometry(0.012, 0.0035, 0.004);
        flick.rotateZ(s * 0.6);
        flick.translate(ex + s * 0.021, ey + 0.005, ez - 0.004);
        sb.add(flick, dark, Bn.HEAD);
      }
      // brow: arched tube
      const by = 1.632;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(ex - s * 0.018, by - 0.002, headZ(ex - s * 0.018, by) + 0.001),
        new THREE.Vector3(ex + s * 0.002, by + 0.008, headZ(ex, by) + 0.003),
        new THREE.Vector3(ex + s * 0.022, by - 0.004, headZ(ex + s * 0.022, by) - 0.001),
      );
      sb.add(new THREE.TubeGeometry(curve, 6, male ? 0.0055 : 0.0038, 4, false), tmpC.copy(C(L.hair)).multiplyScalar(0.7).clone(), Bn.HEAD);
      // blush
      if (!male) {
        const bx = 0.052 * s;
        const byy = 1.568;
        sb.add(ellipsoid(bx, byy, headZ(bx, byy) - 0.006, 0.018, 0.011, 0.008, 8, 6), tmpC.copy(C(L.skin)).lerp(C(0xe0707a), 0.28).clone(), Bn.HEAD);
      }
    }
    // nose
    const nz = headZ(0, 1.57);
    sb.add(ellipsoid(0, 1.572, nz + 0.004, 0.012, 0.016, 0.012, 8, 6), tmpC.copy(C(L.skin)).multiplyScalar(0.96).clone(), Bn.HEAD);
    sb.add(ellipsoid(0, 1.592, nz - 0.002, 0.007, 0.018, 0.008, 6, 6), C(L.skin), Bn.HEAD);
    // smile: crescent shape with teeth
    const my = 1.537;
    const mz = headZ(0, my) + 0.001;
    const w = male ? 0.042 : 0.046;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0.005);
    shape.quadraticCurveTo(0, -0.002, w / 2, 0.005);
    shape.quadraticCurveTo(0, -0.03, -w / 2, 0.005);
    const mouth = new THREE.ShapeGeometry(shape, 8);
    const mP = mouth.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < mP.count; i++) {
      const x = mP.getX(i);
      const y = mP.getY(i);
      mP.setXYZ(i, x, my + y, headZ(x, my + y) + 0.0015);
    }
    mouth.computeVertexNormals();
    sb.add(mouth, C(0x6a1f2a), Bn.HEAD);
    const tshape = new THREE.Shape();
    tshape.moveTo(-w * 0.4, 0.0035);
    tshape.quadraticCurveTo(0, -0.002, w * 0.4, 0.0035);
    tshape.quadraticCurveTo(0, -0.011, -w * 0.4, 0.0035);
    const teeth = new THREE.ShapeGeometry(tshape, 6);
    const tP = teeth.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tP.count; i++) {
      const x = tP.getX(i);
      const y = tP.getY(i);
      tP.setXYZ(i, x, my + y, headZ(x, my + y) + 0.0025);
    }
    teeth.computeVertexNormals();
    sb.add(teeth, C(0xfbf7f0), Bn.HEAD);
    // lips: lower lip & corners
    const lip = new THREE.TorusGeometry(w * 0.52, male ? 0.0035 : 0.0055, 4, 12, Math.PI * 0.8);
    lip.rotateZ(Math.PI + Math.PI * 0.1);
    lip.scale(1, 0.55, 1);
    lip.translate(0, my + 0.008, mz - 0.003);
    sb.add(lip, C(L.lips), Bn.HEAD);
    if (L.beard) {
      const hc = C(L.hair);
      sb.add(
        headShell(1.06, (d) => !(d.y < -0.15 && d.z > -0.3) || (d.y > -0.62 && Math.abs(d.x) < 0.42 && d.z > 0.6 && d.y > -0.75)),
        hc,
        Bn.HEAD,
      );
    }
  }

  private addHair(sb: SkinBuilder): void {
    const L = this.look;
    const hc = C(L.hair);
    const hairCol: ColFn = (p) => {
      const n = vnoise3(p.x * 300, p.y * 40, p.z * 300);
      return tmpC.copy(hc).multiplyScalar(0.82 + n * 0.3);
    };
    const part = L.part ?? 0.3;
    const style = L.hairStyle;
    if (L.headwear === 'hood') {
      // a few curls/strands visible at forehead
      sb.add(headShell(1.03, (d) => d.y < 0.4 || d.z < 0.2 || Math.abs(d.x) > 0.75), hairCol, Bn.HEAD);
      return;
    }
    const low = style === 'short' || style === 'buzz';
    // face-zone mask in unit-sphere directions
    const mask = (d: THREE.Vector3): boolean => {
      const hairline = style === 'bob' ? 0.22 + d.x * part * 0.3 : low ? 0.48 : 0.4 + (d.x - part) * part * 0.35;
      if (d.z > 0.18 && d.y < hairline) return true;
      if (d.z > -0.2 && d.y < 0.05 && Math.abs(d.x) > 0.5) return !(style === 'long' || style === 'waves' || style === 'bob' || style === 'curly') || d.y < -0.15;
      if (d.y < (low ? -0.35 : -0.55)) return true;
      return false;
    };
    const scale = style === 'curly' ? 1.14 : style === 'buzz' ? 1.02 : 1.065;
    let shell = headShell(scale, mask, 0.004, -0.006, 22, 15);
    if (style === 'curly') shell = fluffy(shell, 0.012, 55, 7);
    sb.add(shell, hairCol, Bn.HEAD);
    // side-swept bang
    if (style === 'long' || style === 'waves' || style === 'ponytail') {
      const bang = ellipsoid(0, 0, 0, 0.07, 0.028, 0.04, 12, 8);
      bang.rotateZ(-part * 0.4);
      bang.translate(part * 0.03, 1.668, headZ(part * 0.03, 1.668) - 0.028);
      sb.add(bang, hairCol, Bn.HEAD);
    }
    const hairW = (p: THREE.Vector3): Infl => {
      const t = clamp01((1.6 - p.y) / 0.25);
      return [
        [Bn.HEAD, 1 - t],
        [Bn.HAIR, t],
      ];
    };
    if (style === 'long' || style === 'waves') {
      const rr: Ring[] = [];
      const bottom = style === 'waves' ? 1.3 : 1.27;
      const topY = 1.65;
      for (let y = bottom; y <= topY + 1e-6; y += 0.02) {
        const t = (y - bottom) / (topY - bottom); // 0 bottom .. 1 top
        // hug the skull at the top, fall slightly wider over the shoulders, taper at the ends
        const skull = Math.sqrt(Math.max(0, 1 - ((y - HEAD_C.y) / (HEAD_R.y * 1.08)) ** 2));
        let rx = y > 1.56 ? HEAD_R.x * 1.1 * Math.max(skull, 0.55) * jawK(y) + 0.008 : 0.104 + (1 - t) * 0.012;
        let rz = y > 1.56 ? HEAD_R.z * 1.08 * Math.max(skull, 0.55) + 0.006 : 0.082 + (1 - t) * 0.01;
        if (style === 'waves' && y < 1.56) {
          rx += Math.sin(y * 70) * 0.007;
          rz += Math.sin(y * 70 + 1) * 0.005;
        }
        const tip = Math.min(1, t * 8);
        rx *= 0.75 + 0.25 * tip;
        rz *= 0.6 + 0.4 * tip;
        rr.push({ y, rx, rz, cz: y > 1.56 ? HEAD_C.z - 0.012 : -0.03 - (1 - t) * 0.03 });
      }
      sb.add(ringTube(rr, 14, true, false, Math.PI * 0.42, Math.PI * 1.16), hairCol, hairW);
      // front locks framing the face
      for (const s of [1, -1]) {
        const lr: Ring[] = [];
        for (let y = 1.4; y <= 1.62; y += 0.02) {
          const t = (y - 1.4) / 0.22;
          lr.push({ y, rx: 0.016 + t * 0.008, rz: 0.03, cx: s * (0.096 + (1 - t) * 0.03), cz: 0.012 - (1 - t) * 0.02 });
        }
        sb.add(ringTube(lr, 8, true, true), hairCol, (p) => blend(Bn.CHEST, Bn.HEAD, (p.y - 1.45) / 0.12));
      }
    } else if (style === 'bob') {
      const rr: Ring[] = [];
      for (let y = 1.5; y <= 1.66; y += 0.02) {
        const t = (y - 1.5) / 0.16;
        rr.push({ y, rx: 0.112 + (1 - t) * 0.012, rz: 0.11 + (1 - t) * 0.008, cz: -0.006 });
      }
      sb.add(ringTube(rr, 22, true, false, Math.PI * 0.32, Math.PI * 1.36), hairCol, Bn.HEAD);
      // fringe
      const fr = headShell(1.075, (d) => !(d.z > 0.35 && d.y > 0.12 && d.y < 0.65), 0, 0.004, 18, 12);
      sb.add(fr, hairCol, Bn.HEAD);
    } else if (style === 'ponytail') {
      sb.add(ellipsoid(0, 1.67, -0.105, 0.022, 0.022, 0.018, 8, 6), C(this.look.accent), Bn.HEAD);
      const rr: Ring[] = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12; // 0 bottom .. 1 top
        const y = 1.41 + t * 0.26;
        const r = Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.042 + 0.006;
        rr.push({ y, rx: r, rz: r * 0.9, cz: -0.12 - (1 - t) * 0.06 - Math.sin(t * Math.PI) * 0.035 });
      }
      sb.add(ringTube(rr, 10, true, true), hairCol, (p) => (p.y > 1.64 ? [[Bn.HEAD, 1]] : [[Bn.HAIR, 1]]));
    } else if (style === 'bun') {
      sb.add(fluffy(ellipsoid(0, 1.715, -0.06, 0.05, 0.042, 0.05, 12, 8), 0.005, 70, 1), hairCol, Bn.HEAD);
    } else if (style === 'curly') {
      const rnd = new Rand(this.beh.seed + 99);
      for (let i = 0; i < 22; i++) {
        const a = rnd.range(Math.PI * 0.35, Math.PI * 1.65);
        const y = rnd.range(1.47, 1.7);
        const rr = 0.12 + (1.7 - y) * 0.15;
        sb.add(fluffy(ellipsoid(Math.sin(a) * rr, y, Math.cos(a) * rr * 0.85 - 0.02, 0.038, 0.038, 0.038, 8, 6), 0.006, 90, i), hairCol, (p) => (p.y < 1.55 ? [[Bn.HAIR, 1]] : [[Bn.HEAD, 1]]));
      }
    } else if (style === 'braids') {
      for (const s of [1, -1]) {
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const x = s * (0.085 + t * 0.03);
          const y = 1.56 - t * 0.27;
          const z = -0.02 + t * 0.09;
          sb.add(ellipsoid(x, y, z, 0.021 - t * 0.006, 0.026, 0.02 - t * 0.005, 8, 6), hairCol, (p) => blend(Bn.CHEST, Bn.HEAD, (p.y - 1.4) / 0.14));
        }
        sb.add(ellipsoid(s * 0.115, 1.27, 0.07, 0.012, 0.012, 0.012, 6, 4), C(this.look.accent), Bn.CHEST);
      }
    }
  }

  private addHeadwear(sb: SkinBuilder): void {
    const L = this.look;
    const c1 = C(L.hatColor);
    const c2 = C(L.hatColor2);
    if (L.headwear === 'beanie') {
      const knit: ColFn = (p) => {
        const a = Math.atan2(p.x, p.z - HEAD_C.z);
        return tmpC.copy(c1).multiplyScalar(0.82 + 0.18 * (Math.floor(a * 14 + 100) % 2));
      };
      const shell = headShell(1.16, (d) => d.y < (d.z > 0 ? 0.4 : 0.1) - d.z * 0.05, 0.012, -0.012, 20, 12);
      sb.add(shell, knit, Bn.HEAD);
      sb.add(ringTorus(0, 1.652, -0.002, 0.098, 0.022, 1.0, 1.09, 0.12, 8, 28), (p) => (Math.floor((p.y - 1.62) / 0.014) % 2 === 0 ? c2 : c1), Bn.HEAD);
      sb.add(fluffy(ellipsoid(0, 1.765, -0.02, 0.04, 0.038, 0.04, 12, 8), 0.007, 80, 4), c2, Bn.HEAD);
    } else if (L.headwear === 'headband') {
      sb.add(fluffy(ringTorus(0, 1.635, -0.006, 0.1, 0.017, 1.0, 1.1, 0.42, 8, 32), 0.002, 120, 1), c1, Bn.HEAD);
      sb.add(ringTorus(0, 1.636, -0.006, 0.1, 0.019, 1.0, 1.1, 0.42, 6, 32).scale(1, 1, 1), c1, Bn.HEAD);
      // knot bow at the top side
      sb.add(ellipsoid(0.04, 1.7, 0.07, 0.025, 0.018, 0.016, 8, 6), c2, Bn.HEAD);
    } else if (L.headwear === 'earmuffs') {
      for (const s of [1, -1]) sb.add(fluffy(ellipsoid(s * 0.1, 1.59, -0.004, 0.028, 0.044, 0.042, 12, 8), 0.007, 70, s), c1, Bn.HEAD);
      const band = new THREE.TorusGeometry(0.112, 0.006, 5, 20, Math.PI);
      band.scale(0.95, 1.1, 1);
      band.translate(0, 1.595, -0.01);
      sb.add(band, c2, Bn.HEAD);
    } else if (L.headwear === 'hood') {
      const shell = headShell(1.42, (d) => d.z > 0.42 && d.y > -0.75, -0.012, -0.03, 20, 14);
      sb.add(shell, tmpC.copy(C(L.topColor)).multiplyScalar(0.95).clone(), (p) => (p.y < 1.5 ? blend(Bn.CHEST, Bn.HEAD, (p.y - 1.42) / 0.08) : [[Bn.HEAD, 1]]));
      // fur ruff around face opening
      const fur = new THREE.TorusGeometry(0.105, 0.034, 8, 32);
      fur.scale(1.0, 1.25, 1);
      fur.translate(0, HEAD_C.y - 0.01, HEAD_C.z + 0.072);
      fur.rotateX(0);
      sb.add(fluffy(fur, 0.016, 32, 9), C(L.fur ?? 0xeadfcc), Bn.HEAD);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Animation
  // ---------------------------------------------------------------------------------------------
  private tL = new THREE.Vector3();
  private tR = new THREE.Vector3();
  private pL = new THREE.Vector3();
  private pR = new THREE.Vector3();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  update(dt: number, time: number, cheerIn: number, lookAt: THREE.Vector3 | null, welcomeIn: number): void {
    const b = this.bones;
    const beh = this.beh;
    const energy = beh.energy ?? 1;
    const t = time * this.tempo + this.ph;
    // personal reaction delay & smoothing
    this.cheerS += (cheerIn * energy - this.cheerS) * damp(2.5 + (beh.seed % 3), dt);
    this.welcomeS += (welcomeIn - this.welcomeS) * damp(1.6 + (beh.seed % 4) * 0.3, dt);
    const cheer = clamp01(this.cheerS);
    const welcome = clamp01(this.welcomeS);
    const seated = !!beh.seated;

    // ---------- locomotion (welcome walk) ----------
    let speed = 0;
    if (!seated && beh.canWalk) {
      const want = this.tmpA.copy(this.home);
      if (lookAt && welcome > 0.01) {
        const dx = lookAt.x - this.home.x;
        const dz = lookAt.z - this.home.z;
        const dist = Math.hypot(dx, dz);
        const step = Math.min(3.2, Math.max(0, dist - 2.6)) * smooth(welcome * 1.4 - 0.2);
        if (dist > 0.01) want.set(this.home.x + (dx / dist) * step, 0, this.home.z + (dz / dist) * step);
      }
      const mx = want.x - this.cur.x;
      const mz = want.z - this.cur.z;
      const md = Math.hypot(mx, mz);
      if (md > 0.02) {
        const v = Math.min(1.15, md * 2.2);
        const s = Math.min(md, v * dt);
        this.cur.x += (mx / md) * s;
        this.cur.z += (mz / md) * s;
        speed = s / Math.max(dt, 1e-4);
      }
    }
    this.walkAmt += (clamp01(speed / 0.9) - this.walkAmt) * damp(6, dt);
    this.walkPhase += speed * dt * 4.6;
    if (this.run !== null) {
      this.walkAmt = 1.25;
      this.walkPhase = this.run;
    }

    // ---------- facing ----------
    let wantYaw = this.homeYaw;
    if (lookAt) {
      const ly = Math.atan2(lookAt.x - this.cur.x, lookAt.z - this.cur.z);
      const engage = seated ? 0 : Math.max(cheer, welcome, 0.35);
      wantYaw = this.homeYaw + wrap(ly - this.homeYaw) * engage;
    }
    if (speed > 0.2) wantYaw = Math.atan2(this.tmpA.x - this.cur.x, this.tmpA.z - this.cur.z);
    this.yaw += wrap(wantYaw - this.yaw) * damp(seated ? 1 : 3, dt);

    // ---------- reset pose ----------
    for (const bone of b) bone.quaternion.identity();
    b[Bn.PELVIS]!.position.set(0, 0.92, 0);

    // ---------- legs / pelvis ----------
    let rootY = 0;
    const shift = Math.sin(t * 0.45) * (1 - cheer) * (1 - this.walkAmt);
    if (seated) {
      const bounce = cheer * Math.max(0, Math.sin(t * 7)) * 0.025;
      b[Bn.PELVIS]!.position.set(0, 0.5 + bounce, 0);
      const kick = Math.sin(t * 1.6) * 0.18;
      b[Bn.THIGH_L]!.rotation.set(-1.5, 0, 0.08);
      b[Bn.THIGH_R]!.rotation.set(-1.5, 0, -0.08);
      b[Bn.SHIN_L]!.rotation.set(1.45 + kick * (0.4 + cheer), 0, 0);
      b[Bn.SHIN_R]!.rotation.set(1.45 - kick * (0.4 + cheer), 0, 0);
      b[Bn.FOOT_L]!.rotation.set(0.1, 0, 0);
      b[Bn.FOOT_R]!.rotation.set(0.1, 0, 0);
      b[Bn.SPINE]!.rotation.set(-0.06 + cheer * 0.04 * Math.sin(t * 7), 0, 0);
    } else {
      // weight shift: hip sways over the standing leg; the other knee relaxes
      const kL = 0.04 + Math.max(0, shift) * 0.14;
      const kR = 0.04 + Math.max(0, -shift) * 0.14;
      let crouch = 0;
      let air = 0;
      if (beh.jumpy && cheer > 0.05) {
        const j = Math.sin(t * 7.4);
        if (j > 0) air = Math.pow(j, 1.3) * 0.15 * cheer;
        else crouch = -j * 0.38 * cheer;
      } else if (cheer > 0.05) {
        crouch = (0.5 + 0.5 * Math.sin(t * 6.2)) * 0.18 * cheer; // bouncing on the knees
      }
      const wp = this.walkPhase;
      const wa = this.walkAmt;
      const legs: Array<[number, number, number, number]> = [
        [Bn.THIGH_L, Bn.SHIN_L, Bn.FOOT_L, kL],
        [Bn.THIGH_R, Bn.SHIN_R, Bn.FOOT_R, kR],
      ];
      let drop = 0;
      legs.forEach(([th, sh, ft, k], i) => {
        const ph = wp + i * Math.PI;
        const swing = Math.sin(ph) * 0.42 * wa;
        const lift = Math.max(0, Math.sin(ph - 1.2)) * 0.75 * wa;
        const c = crouch + k + air * 1.8;
        b[th]!.rotation.set(-c - swing, 0, (i === 0 ? 1 : -1) * (0.03 + shift * 0.02 * (i === 0 ? -1 : 1)));
        b[sh]!.rotation.set(c * 2 + lift, 0, 0);
        b[ft]!.rotation.set(-c + swing * 0.3 - lift * 0.3, 0, 0);
        drop += (0.43 + 0.37) * (1 - Math.cos(c)) * 0.5;
      });
      b[Bn.PELVIS]!.position.set(shift * 0.035, 0.92 - drop + Math.abs(Math.sin(wp)) * 0.025 * wa, 0);
      b[Bn.PELVIS]!.rotation.set(0, Math.sin(wp) * 0.12 * wa, -shift * 0.05);
      b[Bn.SPINE]!.rotation.set(0.03 + crouch * 0.4 - wa * 0.04, -Math.sin(wp) * 0.1 * wa, shift * 0.06);
      rootY = air;
    }
    if (this.tuck > 0) {
      const k = clamp01(this.tuck);
      for (const [th, sh, ft, sd] of [
        [Bn.THIGH_L, Bn.SHIN_L, Bn.FOOT_L, 1],
        [Bn.THIGH_R, Bn.SHIN_R, Bn.FOOT_R, -1],
      ] as const) {
        b[th]!.rotation.set(b[th]!.rotation.x + (-2.15 - b[th]!.rotation.x) * k, 0, sd * 0.12 * k);
        b[sh]!.rotation.set(b[sh]!.rotation.x + (2.45 - b[sh]!.rotation.x) * k, 0, 0);
        b[ft]!.rotation.set(0.5 * k, 0, 0);
      }
      b[Bn.SPINE]!.rotation.x += 0.55 * k;
    }
    // breathing
    const breath = Math.sin(t * 1.7) * 0.015;
    b[Bn.CHEST]!.rotation.set(-breath - cheer * 0.06, 0, 0);

    // ---------- head look ----------
    this.group.updateMatrixWorld(false);
    let lyaw = 0;
    let lpitch = 0.05;
    const target = lookAt ?? this.chatTarget;
    const chatGlance = Math.sin(t * 0.21) > 0.6 ? 0.5 : 0;
    if (target) {
      const hx = this.cur.x;
      const hz = this.cur.z;
      const headY = this.group.position.y + (seated ? 1.05 : 1.6) * this.group.scale.y;
      const dx = target.x - hx;
      const dz = target.z - hz;
      const rel = wrap(Math.atan2(dx, dz) - this.yaw);
      lyaw = Math.max(-1.25, Math.min(1.25, rel));
      const ty = (target === lookAt ? target.y + 1.2 : target.y + 1.5) - headY;
      lpitch = Math.max(-0.45, Math.min(0.35, -Math.atan2(ty, Math.hypot(dx, dz))));
      if (!lookAt) lyaw += chatGlance * (beh.seed % 2 ? 0.6 : -0.6);
    }
    // idle nods while chatting
    const nod = Math.sin(t * 2.3) * 0.04 * (1 - cheer) + Math.sin(t * 7) * 0.05 * cheer;
    this.headYaw += (lyaw - this.headYaw) * damp(4, dt);
    this.headPitch += (lpitch - this.headPitch) * damp(4, dt);
    b[Bn.CHEST]!.rotation.y += this.headYaw * 0.3;
    b[Bn.HEAD]!.rotation.set(this.headPitch + nod, this.headYaw * 0.7, Math.sin(t * 0.37 + 1) * 0.08 * (1 - cheer));
    b[Bn.HAIR]!.rotation.set(Math.sin(t * 1.3) * 0.04 + this.headPitch * -0.5 + cheer * 0.1 * Math.sin(t * 7.4), -this.headYaw * 0.3, Math.sin(t * 0.9) * 0.05);

    // ---------- arms ----------
    const mug = this.look.mug;
    const sipCycle = this.updateSip(dt, cheer, welcome);
    for (const side of [1, -1]) {
      const isL = side > 0;
      const T = isL ? this.tL : this.tR;
      const P = isL ? this.pL : this.pR;
      const hasMug = mug === (isL ? 'L' : 'R');
      const armPh = t + (isL ? 0 : 1.7);
      // base
      if (hasMug) {
        T.set(side * 0.15, -0.22 + Math.sin(armPh * 0.8) * 0.01, 0.25);
        P.set(side * 0.6, -1, -0.5);
        if (sipCycle > 0) {
          this.tmpB.set(side * 0.085, 0.17, 0.22);
          T.lerp(this.tmpB, sipCycle);
        }
      } else {
        // relaxed / chatting gestures with the free hand
        const gest = smooth(Math.sin(armPh * 0.55 + side) * 1.4 - 0.2);
        T.set(side * 0.23, -0.36, 0.05);
        if (seated) T.set(side * 0.2, -0.24, 0.24);
        this.tmpB.set(side * (0.17 + Math.sin(armPh * 2.1) * 0.04), -0.12 + Math.sin(armPh * 1.7) * 0.05, 0.27 + Math.sin(armPh * 1.3) * 0.03);
        T.lerp(this.tmpB, gest * (1 - this.walkAmt) * 0.85);
        P.set(side * 0.5, -1, -0.6);
        // walking arm swing
        T.z += Math.sin(this.walkPhase + (isL ? Math.PI : 0)) * 0.16 * this.walkAmt;
      }
      // cheer
      if (cheer > 0.01) {
        const style = beh.cheerStyle;
        const ct = this.tmpB;
        const cp = this.tmpA;
        if (hasMug && style !== 'clap') {
          // raise the mug in a toast
          ct.set(side * 0.2, 0.5 + Math.sin(t * 6) * 0.04, 0.24);
          cp.set(side, -0.6, -0.3);
        } else if (style === 'clap' && !hasMug) {
          const open = 0.5 + 0.5 * Math.sin(t * 17);
          ct.set(side * (0.025 + 0.11 * open), 0.08 + Math.sin(t * 3) * 0.03, 0.31);
          cp.set(side, -0.8, -0.2);
        } else if (style === 'pump') {
          const pumpPh = Math.sin(t * 7 + (isL ? 0 : Math.PI * 0.5));
          ct.set(side * 0.24, 0.42 + pumpPh * 0.16, 0.16);
          cp.set(side, -0.4, -0.4);
        } else {
          ct.set(side * (0.3 + Math.sin(t * 5 + side) * 0.06), 0.68, 0.08 + Math.sin(t * 4.3) * 0.04);
          cp.set(side, -0.2, -0.6);
        }
        T.lerp(ct, cheer);
        P.lerp(cp, cheer).normalize();
      }
      // welcome: wave with one arm, then beckon toward the hot tub
      const waveArm = beh.waveArm ?? (mug === 'L' ? 'R' : 'L');
      if (welcome > 0.01 && waveArm === (isL ? 'L' : 'R')) {
        const ww = welcome * (1 - cheer * 0.5);
        const cyc = (time * 0.35 + beh.seed * 0.13) % 1; // wave for 60%, beckon for 40%
        const ct = this.tmpB;
        if (cyc < 0.6 || seated) {
          ct.set(side * 0.4 + side * Math.sin(t * 13) * 0.08, 0.36, 0.14);
          this.tmpA.set(side, -0.7, -0.1);
        } else {
          const s = 0.5 + 0.5 * Math.sin(t * 9);
          ct.set(side * 0.16, 0.02 + s * 0.08, 0.36 - s * 0.14);
          this.tmpA.set(side, -1, -0.2);
        }
        T.lerp(ct, ww);
        P.lerp(this.tmpA, ww).normalize();
      }
      if (this.hold > 0) {
        // present: both hands together in front of the chest (raised with holdLift)
        const lift = clamp01(this.holdLift);
        this.tmpB.set(side * 0.1 - 0.17, -0.04 + 0.4 * lift, 0.36 - 0.06 * lift);
        T.lerp(this.tmpB, clamp01(this.hold));
        this.tmpA.set(side * 0.9, -1, -0.1);
        P.lerp(this.tmpA, clamp01(this.hold)).normalize();
      }
      if (this.tuck > 0) {
        // hug the shins
        this.tmpB.set(side * 0.16, -0.32, 0.36);
        T.lerp(this.tmpB, clamp01(this.tuck));
        this.tmpA.set(side, -0.3, -0.6);
        P.lerp(this.tmpA, clamp01(this.tuck)).normalize();
      }
      const S = isL ? this.SL : this.SR;
      solveArm(b[isL ? Bn.UARM_L : Bn.UARM_R]!, b[isL ? Bn.FARM_L : Bn.FARM_R]!, S, T, P);
      // wrist
      const hand = b[isL ? Bn.HAND_L : Bn.HAND_R]!;
      if (!hasMug) hand.rotation.set(-0.15, side * 0.2, 0);
      if (this.hold > 0 && !hasMug) hand.rotation.set(-0.15 - 0.6 * this.hold, side * (0.2 + 0.9 * this.hold), 0);
    }

    // ---------- place group ----------
    this.group.position.set(this.cur.x, this.groundAt(this.cur.x, this.cur.z) + rootY, this.cur.z);
    this.group.rotation.y = this.yaw;
    this.group.updateMatrixWorld(true);
    if (this.mugHand) this.uprightMug(this.mugHand, sipCycle);
  }

  private updateSip(dt: number, cheer: number, welcome: number): number {
    if (!this.look.mug) return 0;
    this.nextSip -= dt;
    if (this.nextSip <= 0 && this.sipT <= 0 && cheer < 0.3 && welcome < 0.3) {
      this.sipT = 2.4;
      this.nextSip = this.rnd.range(5, 11);
    }
    if (this.sipT > 0) this.sipT -= dt;
    const s = this.sipT > 0 ? Math.sin(Math.PI * (1 - this.sipT / 2.4)) : 0;
    this.sipping = smooth(Math.min(1, s * 1.6));
    return this.sipping;
  }

  private uprightMug(hand: THREE.Bone, sip: number): void {
    const parent = hand.parent;
    if (!parent) return;
    const qh = _qa;
    hand.getWorldQuaternion(qh);
    const axis = _va.set(0, 0, 1).applyQuaternion(qh);
    const up = _vb.set(0, 1, 0);
    if (sip > 0) {
      // tilt mug top toward the face (character backwards)
      up.x -= Math.sin(this.yaw) * sip * 0.9;
      up.z -= Math.cos(this.yaw) * sip * 0.9;
      up.normalize();
    }
    const qWorld = _qb.setFromUnitVectors(axis, up).multiply(qh);
    parent.getWorldQuaternion(_qc);
    hand.quaternion.copy(_qc.invert().multiply(qWorld));
    hand.updateMatrixWorld(true);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.skeleton.dispose();
  }
}

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
