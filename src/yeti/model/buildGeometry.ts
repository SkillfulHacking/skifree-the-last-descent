/**
 * Builds all procedural CPU-side geometry for the Yeti once per quality preset (cached):
 *  - body: merged skinned surface (torso/limbs, head, jaw, hands, feet) with fur attributes
 *  - hard: teeth and claws (skinned)
 *  - cards: shaggy fur tufts/fringes (skinned alpha-tested strips)
 *  - eyes: two eyeballs (rigid, parented to the head bone)
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../core/types';
import { bodyPart, footPart, handFrame, handPart, headPart, jawPart, FINGERS, fingerTip, thumbPoints, TOES, toeTip } from './anatomy';
import { evalField, meshPart, skinPart, type PartSpec } from './sdf';
import { B, BONE_COUNT, BONE_NAMES, MOUTH_POS, SIDES, legFrame, sideSign } from './rig';
import { LOCK_VARIANTS } from './materials';

export interface GeoArrays {
  position: Float32Array;
  normal: Float32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  color: Float32Array;
  index: Uint32Array;
  /** fur data: x = fur length (m), y = bareness 0..1, z = baked ambient occlusion, w = strand coverage 0..1 */
  fur?: Float32Array;
  /** fur comb (bind space): extra tip displacement per metre of fur length (fringe falling over the face) */
  comb?: Float32Array;
  uv?: Float32Array;
  /** lock cards: x = 0 at the root .. 1 at the tip, y = lock length (m) — drives droop/trail in the shader */
  card?: Float32Array;
}

export interface YetiGeometrySet {
  body: GeoArrays;
  /** index buffer for the fur shells: only triangles that carry fur */
  shellIndex: Uint32Array;
  hard: GeoArrays;
  cards: GeoArrays;
  eyes: GeoArrays;
  /** eye centres in bind space */
  eyeCenters: THREE.Vector3[];
  eyeRadius: number;
}

export interface QualityConfig {
  bodyH: number;
  headH: number;
  limbH: number;
  /** shell count of the short undercoat */
  shells: number;
  /** clumped lock cards over the body (the long shag) */
  cards: number;
  /** short fringe locks around the face */
  fringe: number;
}

export function qualityConfig(q: QualityPreset): QualityConfig {
  switch (q) {
    case 'low':
      return { bodyH: 0.042, headH: 0.016, limbH: 0.022, shells: 4, cards: 4200, fringe: 160 };
    case 'medium':
      return { bodyH: 0.0445, headH: 0.015, limbH: 0.022, shells: 6, cards: 8000, fringe: 260 };
    case 'high':
      return { bodyH: 0.038, headH: 0.0125, limbH: 0.019, shells: 9, cards: 19000, fringe: 420 };
    case 'ultra':
      return { bodyH: 0.0272, headH: 0.01, limbH: 0.013, shells: 14, cards: 44000, fringe: 700 };
  }
}

// ---------------------------------------------------------------- utilities
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** small deterministic value noise (for irregular skin/fur boundaries) */
function hash3(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number): number => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number): number => hash3(ix + dx, iy + dy, iz + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const FUR_BY_BONE: Record<string, number> = {
  rig: 0.08,
  hips: 0.085,
  spine1: 0.065,
  spine2: 0.08,
  spine3: 0.12,
  neck: 0.14,
  head: 0.1,
  jaw: 0.085,
  clav: 0.15,
  upperArm: 0.1,
  forearm: 0.13,
  hand: 0.06,
  fingers: 0.035,
  fingers2: 0.028,
  thumb: 0.03,
  thigh: 0.095,
  shin: 0.115,
  foot: 0.06,
  toes: 0.035,
};
const CARDS_BY_BONE: Record<string, number> = {
  rig: 0,
  hips: 0.6,
  spine1: 0.55,
  spine2: 0.75,
  spine3: 1,
  neck: 1,
  head: 0.9,
  jaw: 0.8,
  clav: 1,
  upperArm: 0.6,
  forearm: 1.1,
  hand: 0.45,
  fingers: 0,
  fingers2: 0,
  thumb: 0,
  thigh: 0.7,
  shin: 0.95,
  foot: 0.6,
  toes: 0,
};
const baseName = (i: number): string => BONE_NAMES[i].replace(/[LR]$/, '');
const FUR_TABLE = Float32Array.from(BONE_NAMES.map((_, i) => FUR_BY_BONE[baseName(i)] ?? 0.08));
const CARD_TABLE = Float32Array.from(BONE_NAMES.map((_, i) => CARDS_BY_BONE[baseName(i)] ?? 0));

const COL = {
  // skin under the pelt: light and warm, so gaps between strands read as fur roots, not as dark holes
  under: [0.56, 0.54, 0.5],
  skin: [0.15, 0.142, 0.15],
  lip: [0.05, 0.05, 0.06],
  gum: [0.36, 0.1, 0.12],
  palate: [0.2, 0.05, 0.065],
  tongue: [0.42, 0.14, 0.17],
  // palms and soles: dusky leather (only these stay dark: the backs of hands and feet are furred)
  pad: [0.2, 0.2, 0.24],
};

interface VertAttr {
  fur: number;
  bare: number;
  col: number[];
  cards: number;
  ao: number;
  /** strand density 0..1 (feathers the fur toward the face) */
  cov: number;
  /** fringe weight 0..1 (long overlapping hairs at the skin edge) */
  fringe: number;
  comb: [number, number, number];
}

/** comb direction for the facial fringe: over the edge toward the face centre, falling down */
const FACE_C = new THREE.Vector3(0, 2.9, 0.44);
function fringeComb(p: THREE.Vector3, n: THREE.Vector3, w: number, down: number): [number, number, number] {
  const d = FACE_C.clone().sub(p);
  d.y *= 0.6;
  d.addScaledVector(n, -d.dot(n));
  if (d.lengthSq() > 1e-8) d.normalize();
  d.multiplyScalar(0.75).add(new THREE.Vector3(0, -down, 0.15));
  d.addScaledVector(n, -d.dot(n) * 0.7);
  return [d.x * w, d.y * w, d.z * w];
}
const nearEye = (p: THREE.Vector3): number =>
  Math.min(p.distanceTo(EYE_CENTERS[0]), p.distanceTo(EYE_CENTERS[1]));

const MY = MOUTH_POS.y;

function attrFor(part: string, p: THREE.Vector3, n: THREE.Vector3, bw: Float32Array): VertAttr {
  let fur = 0;
  let cards = 0;
  for (let b = 0; b < BONE_COUNT; b++) {
    if (bw[b] === 0) continue;
    fur += bw[b] * FUR_TABLE[b];
    cards += bw[b] * CARD_TABLE[b];
  }
  let bare = 0;
  let col = COL.under;
  let cov = 1;
  let fringe = 0;
  let comb: [number, number, number] = [0, 0, 0];
  if (part === 'body') {
    const chest = n.z > 0.35 && p.y > 1.45 && p.y < 2.35 && Math.abs(p.x) < 0.5 ? 1 : 0;
    fur *= 1 - 0.3 * chest;
    cards *= 1 - 0.15 * chest;
    if (p.y > 2.15 && n.y > 0.1) fur *= 1.35; // mane over the shoulders / hump
    const fore = (bw[B.forearmL] + bw[B.forearmR]) * Math.max(0, -n.z * 0.7 + Math.abs(n.x) * 0.5);
    fur *= 1 + 0.35 * fore;
    const calf = (bw[B.shinL] + bw[B.shinR]) * Math.max(0, -n.z);
    fur *= 1 + 0.3 * calf;
    cards *= 1 + calf;
  } else if (part === 'head') {
    // face mask: wide at the eyes/brow, narrower at the muzzle
    const wx = 0.15 + 0.04 * smoothstep(2.86, 2.95, p.y);
    const fx = p.x / wx;
    const fy = (p.y - 2.9) / 0.135;
    // irregular hairline: fur creeps onto the cheeks in tufts
    // (mirror-symmetric noise: an irregular but balanced hairline)
    const r = Math.sqrt(fx * fx + fy * fy) + (vnoise(Math.abs(p.x) * 40, p.y * 40, p.z * 40) - 0.5) * 0.16;
    // the pelt thins out gradually over ~6–12 cm toward the face (no hard mask edge)
    const rr = r + (0.23 - Math.min(0.23, p.z)) * 3.5 + smoothstep(3.0, 3.06, p.y) * 0.8;
    cov = smoothstep(0.52, 1.22, rr);
    // eyes, nostrils and lips stay clear
    cov *= smoothstep(0.035, 0.06, nearEye(p));
    const noseD = Math.hypot(p.x / 0.09, (p.y - 2.89) / 0.055, (p.z - 0.41) / 0.06);
    cov *= smoothstep(1.0, 1.6, noseD);
    if (p.y < 2.835 && p.z > 0.32) cov *= 1 - smoothstep(0.32, 0.35, p.z);
    // skin shows where the coat ends (the shell coat edge sits at cov ≈ 0.66): dark leather right up to the
    // edge, hidden under it — no half-tone grey band between the fur and the face
    bare = 1 - smoothstep(0.52, 0.72, cov);
    // fur framing the face starts short and lengthens away from it, with a band of long fringe hairs
    // (brow, cheeks) at the thinning edge that falls over onto the skin
    fur *= 0.45 + 0.55 * smoothstep(0.95, 1.6, rr);
    fringe = cov > 0.02 ? Math.exp(-(((cov - 0.42) / 0.26) ** 2)) * smoothstep(0.2, 0.26, p.z + 0.06) : 0;
    // eye shield: above and beside the eyes the hair is short and swept up/back so nothing droops into them
    const ex = Math.abs(p.x) - 0.085;
    const ey = p.y - 2.948;
    const shield = p.z > 0.12 ? (1 - smoothstep(0.07, 0.13, Math.hypot(ex * 0.8, Math.max(0, ey) * 0.7, Math.min(0, ey) * 2.5))) : 0;
    fringe *= 1 - shield;
    fur *= 1 + fringe * 1.0;
    fur = Math.min(fur, 0.018 + (fur - 0.018) * (1 - shield));
    comb = fringeComb(p, n, fringe, 0.55);
    comb[1] += 0.75 * shield;
    comb[2] -= 0.35 * shield;
    col = COL.skin;
    // lips & nose: darker leather
    const nose = Math.hypot(p.x / 0.1, (p.y - 2.895) / 0.06, (p.z - 0.4) / 0.07);
    if (nose < 1 || (p.y < 2.83 && p.z > 0.33)) col = COL.lip;
    if (p.y < MY + 0.012 && n.y < -0.25 && p.z < 0.41 && Math.abs(p.x) < 0.2) {
      if (Math.abs(p.x) > 0.115 && p.z > 0.25) col = COL.lip;
      else col = p.z > 0.33 ? COL.gum : COL.palate;
      bare = 1;
    }
    if (p.y < 2.88 && p.z < 0.25) fur *= 1.45; // ruff around the face / mane
    if (Math.abs(p.x) > 0.14 && p.z > 0.0) fur *= 1.3;
    cards *= smoothstep(0.7, 1.0, cov) * 3.2;
    // the crown and brow carry locks too, but they are combed back/up (flowAt), so none hangs over the face
  } else if (part === 'jaw') {
    col = COL.skin;
    // only the lower lip rim is bare leather; the chin carries a beard that hangs over it
    const lipRim = smoothstep(0.335, 0.365, p.z) * smoothstep(2.738, 2.758, p.y);
    const chin = smoothstep(0.3, 0.35, p.z) * smoothstep(2.74, 2.7, p.y);
    cov = (1 - lipRim) * (1 - 0.35 * smoothstep(0.33, 0.37, p.z) * (1 - chin));
    if (lipRim > 0.3) col = COL.lip;
    if (p.y > MY - 0.03 && n.y > 0.2 && Math.abs(p.x) < 0.112 && p.z < 0.395) {
      // gum rim / floor of the mouth
      col = Math.abs(p.x) < 0.085 && p.y < MY - 0.005 ? COL.tongue : COL.gum;
      cov = 0;
    }
    // cheeks partially bare where the mouth stretches
    if (Math.abs(p.x) > 0.09 && p.y > 2.77 && p.z > 0.21) cov = Math.min(cov, 0.45);
    bare = 1 - smoothstep(0.52, 0.72, cov);
    fur *= 1.2;
    // beard: longer under the chin, combed down and slightly forward
    const beard = smoothstep(2.78, 2.7, p.y) * smoothstep(0.12, 0.3, p.z) * cov;
    fur *= 1 + 0.7 * beard;
    fringe = beard;
    comb = [0, -0.75 * beard, 0.25 * beard];
    cards *= smoothstep(0.75, 1.0, cov) * 2.0;
  } else if (part.startsWith('hand')) {
    const s = part.endsWith('L') ? 1 : -1;
    const f = handFrame(s);
    const rel = p.clone().sub(f.W);
    const u = rel.dot(f.d);
    const v = rel.dot(f.n);
    col = COL.pad;
    if (u < 0.02) {
      bare = 0;
      fur = 0.11;
    } else {
      // palm side bare; the back of the hand and the backs of the fingers carry short fur
      // (only the palm face itself and the finger pads: the sides of the hand and of the thumb are furred too)
      bare = u > 0.22 ? smoothstep(0.004, 0.022, v) : smoothstep(0.018, 0.042, v);
      // digits (fingers and thumb): only the pads — the side facing the palm — are bare; the backs carry a short,
      // close-lying coat so each digit keeps its own outline (no mitten)
      const thumbW = bw[B.thumbL] + bw[B.thumbR];
      if (u > 0.22 || thumbW > 0.3) bare = smoothstep(0.05, 0.45, n.dot(f.n));
      fur = u > 0.22 || thumbW > 0.3 ? 0.02 : 0.065;
    }
  } else if (part.startsWith('foot')) {
    col = COL.pad;
    // only the sole and the toe pads are bare; the top of the foot and the toes are furred
    bare = Math.max(smoothstep(0.04, 0.018, p.y), p.z > 0.2 ? smoothstep(-0.35, -0.7, n.y) : 0);
    if (p.y > 0.24) fur = 0.12;
    else if (p.z > 0.2) fur = 0.02; // toes: short, so each toe keeps its outline
    else fur = 0.065;
  }
  if (part !== 'head' && part !== 'jaw') cov = 1 - bare;
  if (cov < 0.02) cov = 0;
  return { fur: cov > 0 ? fur * (part === 'head' || part === 'jaw' ? 1 : 1 - bare) : 0, bare, col, cards: cards * (1 - bare), ao: 1, cov, fringe, comb };
}

function mixCol(a: number[], b: number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

interface BuiltPart {
  name: string;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  attrs: VertAttr[];
  h: number;
}

function buildPart(spec: PartSpec): BuiltPart {
  const mesh = meshPart(spec);
  const sk = skinPart(spec, mesh, BONE_COUNT);
  const attrs: VertAttr[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  // SDF ambient occlusion (sockets, under the brow, nostrils, creases)
  const step = spec.name === 'body' ? 0.05 : spec.name.startsWith('hand') || spec.name.startsWith('foot') ? 0.02 : 0.014;
  for (let v = 0; v < mesh.positions.length / 3; v++) {
    p.fromArray(mesh.positions, v * 3);
    n.fromArray(mesh.normals, v * 3);
    const a = attrFor(spec.name, p, n, sk.boneW[v]);
    let occ = 0;
    let wsum = 0.5;
    for (let i = 1; i <= 5; i++) {
      const dd = i * step;
      const f = evalField(spec, p.x + n.x * dd, p.y + n.y * dd, p.z + n.z * dd);
      occ += (wsum * Math.max(0, dd - f)) / dd;
      wsum *= 0.6;
    }
    a.ao = Math.max(0.15, Math.min(1, 1 - occ * 0.9));
    attrs.push(a);
  }
  return { name: spec.name, ...mesh, skinIndex: sk.skinIndex, skinWeight: sk.skinWeight, attrs, h: spec.h };
}

function mergeBody(parts: BuiltPart[]): GeoArrays {
  let vc = 0;
  let ic = 0;
  for (const p of parts) {
    vc += p.positions.length / 3;
    ic += p.indices.length;
  }
  const out: GeoArrays = {
    position: new Float32Array(vc * 3),
    normal: new Float32Array(vc * 3),
    skinIndex: new Uint16Array(vc * 4),
    skinWeight: new Float32Array(vc * 4),
    color: new Float32Array(vc * 3),
    index: new Uint32Array(ic),
    fur: new Float32Array(vc * 4),
    comb: new Float32Array(vc * 3),
  };
  let vo = 0;
  let io = 0;
  for (const p of parts) {
    const n = p.positions.length / 3;
    out.position.set(p.positions, vo * 3);
    out.normal.set(p.normals, vo * 3);
    out.skinIndex.set(p.skinIndex, vo * 4);
    out.skinWeight.set(p.skinWeight, vo * 4);
    for (let i = 0; i < p.indices.length; i++) out.index[io + i] = p.indices[i] + vo;
    for (let v = 0; v < n; v++) {
      const a = p.attrs[v];
      const c = mixCol(COL.under, a.col, a.bare);
      const ao = a.ao * a.ao;
      out.color.set([c[0] * ao, c[1] * ao, c[2] * ao], (vo + v) * 3);
      out.fur![(vo + v) * 4] = a.fur;
      out.fur![(vo + v) * 4 + 1] = a.bare;
      out.fur![(vo + v) * 4 + 2] = a.ao;
      out.fur![(vo + v) * 4 + 3] = a.cov;
      out.comb!.set(a.comb, (vo + v) * 3);
    }
    vo += n;
    io += p.indices.length;
  }
  return out;
}

// ---------------------------------------------------------------- hard parts (teeth / claws)
class GeoBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  si: number[] = [];
  sw: number[] = [];
  idx: number[] = [];
  uv: number[] = [];
  card: number[] = [];
  vert(p: THREE.Vector3, n: THREE.Vector3, c: number[], bone: number, bone2 = -1, w2 = 0): number {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.col.push(c[0], c[1], c[2]);
    if (bone2 >= 0 && w2 > 0) {
      this.si.push(bone, bone2, 0, 0);
      this.sw.push(1 - w2, w2, 0, 0);
    } else {
      this.si.push(bone, 0, 0, 0);
      this.sw.push(1, 0, 0, 0);
    }
    return this.pos.length / 3 - 1;
  }
  build(): GeoArrays {
    return {
      position: new Float32Array(this.pos),
      normal: new Float32Array(this.nrm),
      color: new Float32Array(this.col),
      skinIndex: new Uint16Array(this.si),
      skinWeight: new Float32Array(this.sw),
      index: new Uint32Array(this.idx),
      uv: this.uv.length ? new Float32Array(this.uv) : undefined,
      card: this.card.length ? new Float32Array(this.card) : undefined,
    };
  }
}

/** Curved tapered horn (tooth / claw). */
function horn(
  g: GeoBuilder,
  base: THREE.Vector3,
  dir: THREE.Vector3,
  curve: THREE.Vector3,
  len: number,
  r0: number,
  flat: number,
  colBase: number[],
  colTip: number[],
  bone: number,
): void {
  const rings = 7;
  const segs = 8;
  const d = dir.clone().normalize();
  const side = new THREE.Vector3().crossVectors(d, curve);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0).cross(d);
  side.normalize();
  const start = g.pos.length / 3;
  const pt = (t: number): THREE.Vector3 =>
    base.clone().addScaledVector(d, len * t).addScaledVector(curve, len * 0.45 * t * t);
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const c = pt(t);
    const tan = pt(Math.min(1, t + 0.02)).sub(pt(Math.max(0, t - 0.02))).normalize();
    const b1 = new THREE.Vector3().crossVectors(tan, side).normalize();
    const b2 = new THREE.Vector3().crossVectors(b1, tan).normalize();
    const r = r0 * Math.pow(1 - t, 0.85) + 0.0006;
    const colr = mixCol(colBase, colTip, Math.pow(t, 0.7));
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const nn = b1.clone().multiplyScalar(Math.cos(a)).addScaledVector(b2, Math.sin(a) * flat).normalize();
      const p = c.clone().addScaledVector(b1, Math.cos(a) * r).addScaledVector(b2, Math.sin(a) * r * flat);
      g.vert(p, nn, colr, bone);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = start + i * segs + j;
      const b = start + i * segs + ((j + 1) % segs);
      const c = a + segs;
      const dd = b + segs;
      g.idx.push(a, c, b, b, c, dd);
    }
  // base cap omitted (embedded in flesh)
}

function buildHard(): GeoArrays {
  const g = new GeoBuilder();
  const ivory = [0.66, 0.6, 0.47];
  const ivoryTip = [0.93, 0.9, 0.8];
  const clawBase = [0.06, 0.055, 0.05];
  const clawTip = [0.2, 0.18, 0.15];
  // upper teeth (head bone), pointing down
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a = -1.2 + (2.4 * i) / (N - 1);
    const fang = Math.abs(Math.abs(a) - 0.62) < 0.12;
    const molar = Math.abs(a) > 0.8;
    const x = 0.104 * Math.sin(a);
    const z = 0.27 + 0.125 * Math.cos(a);
    const base = new THREE.Vector3(x, MY + 0.02, z);
    const len = fang ? 0.085 : molar ? 0.028 : 0.032;
    const r = fang ? 0.017 : molar ? 0.014 : 0.0105;
    const out = new THREE.Vector3(x, 0, z - 0.23).normalize();
    horn(g, base, new THREE.Vector3(0, -1, 0).addScaledVector(out, fang ? 0.12 : 0.05), out.clone().multiplyScalar(-1), len, r, fang ? 0.85 : 0.6, ivory, ivoryTip, B.head);
  }
  // lower teeth (jaw bone), pointing up
  for (let i = 0; i < N; i++) {
    const a = -1.15 + (2.3 * i) / (N - 1);
    const fang = Math.abs(Math.abs(a) - 0.52) < 0.12;
    const molar = Math.abs(a) > 0.8;
    const x = 0.096 * Math.sin(a);
    const z = 0.264 + 0.115 * Math.cos(a);
    const base = new THREE.Vector3(x, MY - 0.022, z);
    const len = fang ? 0.07 : molar ? 0.026 : 0.03;
    const r = fang ? 0.015 : molar ? 0.013 : 0.0095;
    const out = new THREE.Vector3(x, 0, z - 0.23).normalize();
    horn(g, base, new THREE.Vector3(0, 1, 0).addScaledVector(out, fang ? 0.15 : 0.04), out.clone().multiplyScalar(-1), len, r, 0.7, ivory, ivoryTip, B.jaw);
  }
  // finger & thumb claws
  for (const side of SIDES) {
    const s = sideSign(side);
    const f = handFrame(s);
    for (const fi of FINGERS) {
      const { tip, mid } = fingerTip(f, fi);
      const dir = tip.clone().sub(mid).normalize();
      const base = tip.clone().addScaledVector(dir, -0.035).addScaledVector(f.n, -0.012);
      horn(g, base, dir, f.n.clone(), 0.095, 0.02, 0.8, clawBase, clawTip, B[`fingers2${side}`]);
    }
    const tp = thumbPoints(f);
    const tdir = tp[2].clone().sub(tp[1]).normalize();
    horn(g, tp[2].clone().addScaledVector(tdir, -0.03), tdir, f.n.clone(), 0.08, 0.019, 0.8, clawBase, clawTip, B[`thumb${side}`]);
    // toe claws
    for (const t of TOES) {
      const { base, tip } = toeTip(s, t);
      const dir = tip.clone().sub(base).normalize();
      horn(
        g,
        tip.clone().addScaledVector(dir, -0.03).add(new THREE.Vector3(0, 0.012, 0)),
        dir,
        new THREE.Vector3(0, -1, 0),
        0.075,
        t.r * 0.5,
        0.8,
        clawBase,
        clawTip,
        B[`toes${side}`],
      );
    }
  }
  return g.build();
}

// ---------------------------------------------------------------- eyes
export const EYE_RADIUS = 0.025;
export const EYE_CENTERS = [new THREE.Vector3(0.085, 2.948, 0.305), new THREE.Vector3(-0.085, 2.948, 0.305)];

function buildEyes(): GeoArrays {
  const g = new GeoBuilder();
  const rnd = mulberry32(7);
  const streak: number[] = [];
  for (let i = 0; i < 64; i++) streak.push(rnd());
  for (const c of EYE_CENTERS) {
    const fwd = new THREE.Vector3(c.x * 0.6, -0.08, 1).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const up2 = new THREE.Vector3().crossVectors(fwd, right);
    const W = 24;
    const H = 16;
    const start = g.pos.length / 3;
    for (let i = 0; i <= H; i++) {
      const th = (i / H) * Math.PI; // angle from forward axis
      for (let j = 0; j <= W; j++) {
        const ph = (j / W) * Math.PI * 2;
        const n = fwd
          .clone()
          .multiplyScalar(Math.cos(th))
          .addScaledVector(right, Math.sin(th) * Math.cos(ph))
          .addScaledVector(up2, Math.sin(th) * Math.sin(ph));
        const p = c.clone().addScaledVector(n, EYE_RADIUS);
        // pupil: slightly vertical oval
        const pupil = th / (0.2 + 0.07 * Math.abs(Math.cos(ph)));
        let col: number[];
        if (pupil < 1) col = [0.01, 0.01, 0.01];
        else if (th < 0.66) {
          const k = (th - 0.2) / 0.46;
          const s = streak[Math.floor((ph / (Math.PI * 2)) * 64) % 64];
          const inner = [1.0, 0.72, 0.22];
          const outer = [0.55, 0.22, 0.03];
          col = mixCol(inner, outer, Math.min(1, k * 1.1));
          const m = 0.75 + 0.45 * s;
          col = [col[0] * m, col[1] * m, col[2] * m];
          if (k > 0.9) col = mixCol(col, [0.08, 0.03, 0.01], (k - 0.9) / 0.1);
        } else col = [0.16, 0.07, 0.05];
        g.vert(p, n, col, 0);
      }
    }
    for (let i = 0; i < H; i++)
      for (let j = 0; j < W; j++) {
        const a = start + i * (W + 1) + j;
        const b = a + 1;
        const cc = a + W + 1;
        const d = cc + 1;
        g.idx.push(a, cc, b, b, cc, d);
      }
  }
  return g.build();
}

// ---------------------------------------------------------------- fur cards
const CARD_TINTS = [
  [0.95, 0.93, 0.88],
  [0.96, 0.91, 0.82],
  [0.82, 0.8, 0.76],
  [0.92, 0.9, 0.87],
  [0.9, 0.86, 0.8],
];

/**
 * Comb direction of the pelt at a bind-space point (unit, tangent to the skin): on the body the hair hangs and
 * parts outward over the shoulders and the hump (the limbs are in an A-pose in bind, so "down" runs along them);
 * on the head it sweeps back from the face over the crown and down the cheeks into the beard.
 */
function flowAt(part: string, p: THREE.Vector3, n: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  if (part === 'head' || part === 'jaw') {
    out.set(p.x, p.y - 2.86, p.z - 0.55).normalize();
    out.y -= 0.55;
  } else {
    const r = Math.hypot(p.x, p.z * 0.6) || 1;
    out.set((p.x / r) * 0.3, -1, -0.18 + (p.z * 0.6 * 0.3) / r);
  }
  out.addScaledVector(n, -out.dot(n));
  if (out.lengthSq() < 0.02) out.set(0, 0, -1).addScaledVector(n, -n.z);
  return out.normalize();
}

/**
 * The long shag: narrow, clumped lock cards (aspect ≥ 1:5, a converging bundle of strands in the texture) rooted
 * in the skin, combed along flowAt() and layered densely so that they overlap like a pelt. In the shader the tips
 * droop with gravity and trail with motion (see createCardMaterial).
 */
function buildCards(body: GeoArrays, parts: BuiltPart[], count: number, fringe: number): GeoArrays {
  const g = new GeoBuilder();
  const rnd = mulberry32(1337);
  // candidate vertices with area-normalised weight
  const cand: number[] = [];
  const candPart: string[] = [];
  const cw: number[] = [];
  let vo = 0;
  let total = 0;
  for (const p of parts) {
    const n = p.positions.length / 3;
    const area = p.h * p.h;
    for (let v = 0; v < n; v++) {
      const a = p.attrs[v];
      if (a.cards <= 0.02 || a.fur < 0.025) continue;
      const w = a.cards * area;
      total += w;
      cand.push(vo + v);
      candPart.push(p.name);
      cw.push(total);
    }
    vo += n;
  }
  const pick = (): number => {
    const r = rnd() * total;
    let lo = 0;
    let hi = cw.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cw[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const F = new THREE.Vector3();
  const SEG = 4;
  for (let c = 0; c < count; c++) {
    const k = pick();
    const v = cand[k];
    const part = candPart[k];
    P.fromArray(body.position, v * 3);
    N.fromArray(body.normal, v * 3);
    // a little jitter so cards picked at the same vertex do not stack
    P.addScaledVector(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5), 0.02);
    const fur = body.fur![v * 4];
    const ao0 = body.fur![v * 4 + 2];
    const extremity = part.startsWith('hand') || part.startsWith('foot');
    let len = Math.min(extremity ? 0.1 : 0.34, Math.max(0.05, fur * 1.75 + 0.025)) * (0.7 + 0.6 * rnd());
    // shorter on the face and the back of the skull's front half
    if ((part === 'head' || part === 'jaw') && P.z > 0.12) len *= 0.75;
    // brow/crown locks: shorter, lying flat (they are combed up and back away from the eyes)
    const brow = part === 'head' && P.y > 2.9 && P.z > 0.0;
    if (brow) len *= 0.7;
    const width = len * (0.15 + 0.07 * rnd());
    flowAt(part, P, N, F);
    // locks leave the skin at a shallow angle and lie along the comb direction (layered, not bristling)
    // mane over the shoulders / hump and the ruff around the neck: longer and standing off the body (the
    // menacing bulk of the silhouette), clumps still combed down and outward
    const mane = part === 'body' && P.y > 2.1 && N.y > -0.15 ? smoothstep(2.1, 2.45, P.y) : 0;
    len *= 1 + 0.35 * mane;
    const lift = (brow ? 0.15 : 0.3) + 0.35 * rnd() + 0.25 * mane;
    const dir = F.clone()
      .addScaledVector(N, lift)
      .add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.22))
      .normalize();
    // card plane ~tangent to the skin (cross-wise to the strand), randomly twisted so silhouettes catch some
    let wax = new THREE.Vector3().crossVectors(dir, N);
    if (wax.lengthSq() < 1e-4) wax.set(1, 0, 0);
    wax.normalize();
    wax = wax.applyAxisAngle(dir, (rnd() - 0.5) * 1.1);
    const col = CARD_TINTS[Math.floor(rnd() * CARD_TINTS.length)];
    const bright = 0.88 + 0.16 * rnd();
    const lock = Math.floor(rnd() * LOCK_VARIANTS);
    const si = [body.skinIndex[v * 4], body.skinIndex[v * 4 + 1], body.skinIndex[v * 4 + 2], body.skinIndex[v * 4 + 3]];
    const sw = [body.skinWeight[v * 4], body.skinWeight[v * 4 + 1], body.skinWeight[v * 4 + 2], body.skinWeight[v * 4 + 3]];
    const start = g.pos.length / 3;
    // rooted inside the shell undercoat, so no lock floats detached from the skin
    let cur = P.clone().addScaledVector(N, -0.008);
    let d = dir.clone();
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      if (i > 0) {
        // each segment bends further along the comb and back toward the body (the lock lies down)
        d = d.addScaledVector(F, 0.22).addScaledVector(N, -0.12).normalize();
        cur = cur.clone().addScaledVector(d, len / SEG);
      }
      // root occlusion kept mild: a dark root on a lying lock reads as a grey dash on the pelt
      const ao = (0.7 + 0.3 * Math.pow(t, 0.7)) * (0.65 + 0.35 * ao0);
      const cc = [col[0] * bright * ao, col[1] * bright * ao, col[2] * bright * ao];
      const w = width * (1 - 0.3 * t) * 0.5;
      for (const sgn of [-1, 1]) {
        const p = cur.clone().addScaledVector(wax, sgn * w);
        g.pos.push(p.x, p.y, p.z);
        g.nrm.push(N.x, N.y, N.z);
        g.col.push(cc[0], cc[1], cc[2]);
        g.si.push(si[0], si[1], si[2], si[3]);
        g.sw.push(sw[0], sw[1], sw[2], sw[3]);
        g.uv.push((lock + (sgn < 0 ? 0.02 : 0.98)) / LOCK_VARIANTS, 1 - t * 0.98);
        g.card.push(t, len);
      }
    }
    for (let i = 0; i < SEG; i++) {
      const a = start + i * 2;
      g.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  buildFringe(g, body, parts, fringe, rnd, CARD_TINTS);
  return g.build();
}

/**
 * Facial fringe: short, narrow locks rooted in the thinning band around the face (brow, cheeks, beard), combed
 * over the edge of the bare skin so the fur → skin transition has overlapping hairs instead of a cut line.
 */
function buildFringe(g: GeoBuilder, body: GeoArrays, parts: BuiltPart[], count: number, rnd: () => number, tints: number[][]): void {
  const cand: number[] = [];
  const cw: number[] = [];
  let total = 0;
  let vo = 0;
  for (const p of parts) {
    const n = p.positions.length / 3;
    if (p.name === 'head' || p.name === 'jaw') {
      for (let v = 0; v < n; v++) {
        const a = p.attrs[v];
        // rooted in the coat just inside its edge (cov ≈ 0.66), falling over onto the skin
        if (a.fringe < 0.05 || a.cov < 0.56 || a.cov > 0.95 || a.fur < 0.015) continue;
        total += a.fringe;
        cand.push(vo + v);
        cw.push(total);
      }
    }
    vo += n;
  }
  if (!cand.length) return;
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const C = new THREE.Vector3();
  const SEG = 2;
  let made = 0;
  for (let tries = 0; made < count && tries < count * 8; tries++) {
    const r = rnd() * total;
    let lo = 0;
    let hi = cw.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cw[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const v = cand[lo];
    P.fromArray(body.position, v * 3);
    N.fromArray(body.normal, v * 3);
    C.fromArray(body.comb!, v * 3);
    const fur = body.fur![v * 4];
    if (P.y > 2.93 && P.z > 0.15) continue; // no locks from the brow
    if (Math.hypot(Math.abs(P.x) - 0.125, P.y - 2.79, (P.z - 0.3) * 0.7) < 0.06) continue; // nor at the mouth corners
    const len = Math.min(0.075, Math.max(0.03, fur * 0.9)) * (0.75 + 0.5 * rnd());
    const dir = N.clone().multiplyScalar(0.22).addScaledVector(C, 1.1);
    dir.add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.25)).normalize();
    // the locks must never veil the eyes or plug the nostrils
    const tip = P.clone().addScaledVector(dir, len);
    const mid = P.clone().addScaledVector(dir, len * 0.5);
    if (Math.min(nearEye(tip), nearEye(mid)) < 0.06) continue;
    // nor cover them as seen from the front
    const eye2d = (q: THREE.Vector3): number => Math.min(Math.hypot(q.x - 0.085, q.y - 2.948), Math.hypot(q.x + 0.085, q.y - 2.948));
    if (tip.z > 0.22 && Math.min(eye2d(tip), eye2d(mid)) < 0.065) continue;
    if (Math.hypot(tip.x / 0.09, (tip.y - 2.89) / 0.05, (tip.z - 0.41) / 0.06) < 1.2) continue;
    if (tip.y < 2.84 && tip.y > 2.72 && tip.z > 0.33 && Math.abs(tip.x) < 0.13) continue;
    made++;
    const width = len * (0.17 + 0.08 * rnd());
    let wax = new THREE.Vector3().crossVectors(dir, N);
    if (wax.lengthSq() < 1e-4) wax.set(1, 0, 0);
    wax.normalize().applyAxisAngle(dir, (rnd() - 0.5) * 0.8);
    const col = tints[Math.floor(rnd() * tints.length)];
    const bright = 0.8 + 0.2 * rnd();
    const lock = Math.floor(rnd() * LOCK_VARIANTS);
    const si = [body.skinIndex[v * 4], body.skinIndex[v * 4 + 1], body.skinIndex[v * 4 + 2], body.skinIndex[v * 4 + 3]];
    const sw = [body.skinWeight[v * 4], body.skinWeight[v * 4 + 1], body.skinWeight[v * 4 + 2], body.skinWeight[v * 4 + 3]];
    const start = g.pos.length / 3;
    let cur = P.clone().addScaledVector(N, -0.004);
    let d = dir.clone();
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      if (i > 0) {
        d = d.add(new THREE.Vector3(0, -0.3, 0)).addScaledVector(N, -0.15).normalize();
        cur = cur.clone().addScaledVector(d, len / SEG);
      }
      const ao = 0.5 + 0.5 * t;
      const cc = [col[0] * bright * ao, col[1] * bright * ao, col[2] * bright * ao];
      const w = width * (1 - 0.45 * t) * 0.5;
      for (const sgn of [-1, 1]) {
        const p = cur.clone().addScaledVector(wax, sgn * w);
        g.pos.push(p.x, p.y, p.z);
        g.nrm.push(N.x, N.y, N.z);
        g.col.push(cc[0], cc[1], cc[2]);
        g.si.push(si[0], si[1], si[2], si[3]);
        g.sw.push(sw[0], sw[1], sw[2], sw[3]);
        g.uv.push((lock + (sgn < 0 ? 0.02 : 0.98)) / LOCK_VARIANTS, 1 - t * 0.98);
        // fringe locks are short and combed: no shader droop
        g.card.push(t, 0);
      }
    }
    for (let i = 0; i < SEG; i++) {
      const a = start + i * 2;
      g.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
}

// ---------------------------------------------------------------- entry
const cache = new Map<QualityPreset, YetiGeometrySet>();

export function buildYetiGeometry(q: QualityPreset): YetiGeometrySet {
  const hit = cache.get(q);
  if (hit) return hit;
  const cfg = qualityConfig(q);
  const specs: PartSpec[] = [bodyPart(cfg.bodyH), headPart(cfg.headH), jawPart(cfg.headH)];
  for (const side of SIDES) {
    specs.push(handPart(side, cfg.limbH));
    specs.push(footPart(side, cfg.limbH));
  }
  const parts = specs.map(buildPart);
  const body = mergeBody(parts);
  const si: number[] = [];
  const fl = body.fur!;
  for (let t = 0; t < body.index.length; t += 3) {
    const a = body.index[t];
    const b = body.index[t + 1];
    const c = body.index[t + 2];
    if (Math.max(fl[a * 4], fl[b * 4], fl[c * 4]) > 0.007) si.push(a, b, c);
  }
  const set: YetiGeometrySet = {
    body,
    shellIndex: new Uint32Array(si),
    hard: buildHard(),
    cards: buildCards(body, parts, cfg.cards, cfg.fringe),
    eyes: buildEyes(),
    eyeCenters: EYE_CENTERS,
    eyeRadius: EYE_RADIUS,
  };
  cache.set(q, set);
  return set;
}

/** Ground-contact reference points (bind space) */
export function footSolePoint(side: 'L' | 'R'): THREE.Vector3 {
  const l = legFrame(sideSign(side));
  return new THREE.Vector3(l.ankle.x, 0, 0.08);
}

export function toBufferGeometry(a: GeoArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(a.color, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(a.skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(a.skinWeight, 4));
  if (a.fur) g.setAttribute('furData', new THREE.BufferAttribute(a.fur, 4));
  if (a.comb) g.setAttribute('furComb', new THREE.BufferAttribute(a.comb, 3));
  if (a.uv) g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
  if (a.card) g.setAttribute('cardData', new THREE.BufferAttribute(a.card, 2));
  g.setIndex(new THREE.BufferAttribute(a.index, 1));
  return g;
}
