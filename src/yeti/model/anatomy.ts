/**
 * Sculpted anatomy of the Yeti as SDF primitives (bind pose, model space).
 * A towering, hunched alpine predator: massive trapezius & deltoids, barrel chest,
 * gorilla-length arms, heavy thighs, big clawed feet and a small brutal head.
 */
import * as THREE from 'three';
import {
  Ellipsoid,
  RoundCone,
  type PartSpec,
  type Prim,
  skinBone,
  skinLerp,
  skinLimb,
  skinMix,
  smax,
} from './sdf';
import { B, armFrame, legFrame, MOUTH_POS, SIDES, sideSign, type Side } from './rig';

const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const lerpV = (a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 => a.clone().lerp(b, t);

function sortPrims(prims: Prim[]): Prim[] {
  const adds = prims.filter((p) => !p.sub && !p.late).sort((a, b) => b.br - a.br);
  const subs = prims.filter((p) => p.sub);
  const late = prims.filter((p) => p.late && !p.sub);
  return [...adds, ...subs, ...late];
}

function sdBox(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
): number {
  const qx = Math.abs(x - cx) - hx;
  const qy = Math.abs(y - cy) - hy;
  const qz = Math.abs(z - cz) - hz;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0);
}

export function bodyPart(h: number): PartSpec {
  const P: Prim[] = [];
  // ---- torso: barrel chest, huge hunched trapezius, deep belly
  P.push(new Ellipsoid(V(0, 1.47, -0.03), V(0.34, 0.26, 0.3), skinBone(B.hips)).blend(0.1));
  P.push(new Ellipsoid(V(0, 1.72, 0.1), V(0.38, 0.33, 0.36), skinMix([[B.spine1, 0.8], [B.hips, 0.2]])).blend(0.12));
  P.push(new Ellipsoid(V(0, 1.78, -0.1), V(0.33, 0.3, 0.25), skinBone(B.spine1)).blend(0.1));
  P.push(new Ellipsoid(V(0, 2.08, 0.05), V(0.53, 0.46, 0.43), skinMix([[B.spine2, 0.55], [B.spine3, 0.45]])).blend(0.12));
  P.push(new Ellipsoid(V(0, 2.46, -0.12), V(0.47, 0.27, 0.3), skinBone(B.spine3)).blend(0.14));
  // hunched hump of the upper back
  P.push(new Ellipsoid(V(0, 2.3, -0.22), V(0.4, 0.33, 0.23), skinMix([[B.spine3, 0.7], [B.spine2, 0.3]])).blend(0.12));
  // trapezius rising up behind the skull: the head sits low between the shoulders
  P.push(new Ellipsoid(V(0, 2.68, -0.13), V(0.3, 0.2, 0.2), skinMix([[B.spine3, 0.5], [B.neck, 0.5]])).blend(0.12));
  // neck
  P.push(
    new RoundCone(V(0, 2.38, -0.01), V(0, 2.84, 0.08), 0.26, 0.17, skinLerp(B.spine3, B.head, 0.15, 1.0)).blend(0.14),
  );
  for (const side of SIDES) {
    const s = sideSign(side);
    const a = armFrame(s);
    const sfx = side;
    const clav = B[`clav${sfx}`];
    const upper = B[`upperArm${sfx}`];
    const fore = B[`forearm${sfx}`];
    const hand = B[`hand${sfx}`];
    const thigh = B[`thigh${sfx}`];
    const shin = B[`shin${sfx}`];
    const foot = B[`foot${sfx}`];
    // pecs
    P.push(new Ellipsoid(V(0.23 * s, 2.24, 0.22), V(0.28, 0.19, 0.17), skinMix([[B.spine3, 0.85], [clav, 0.15]])).blend(0.09));
    // lats
    P.push(new Ellipsoid(V(0.41 * s, 2.0, -0.08), V(0.22, 0.37, 0.25), skinMix([[B.spine2, 0.5], [B.spine3, 0.5]])).blend(0.1));
    // trapezius slope neck -> shoulder
    P.push(new RoundCone(V(0, 2.7, -0.05), V(0.58 * s, 2.47, -0.06), 0.2, 0.17, skinLerp(B.spine3, clav, 0.3, 1)).blend(0.12));
    // deltoid cap
    P.push(
      new Ellipsoid(V(0.71 * s, 2.35, -0.03), V(0.25, 0.3, 0.27), skinMix([[upper, 0.65], [clav, 0.35]]), a.d).blend(0.09),
    );
    // upper arm
    P.push(new RoundCone(a.shoulder, a.elbow, 0.19, 0.145, skinLimb(upper, clav, fore, 0.18, 0.25)).blend(0.07));
    P.push(
      new Ellipsoid(lerpV(a.shoulder, a.elbow, 0.48).add(V(0, 0, 0.07)), V(0.14, 0.25, 0.14), skinLimb(upper, null, fore), a.d).blend(0.07),
    );
    P.push(
      new Ellipsoid(lerpV(a.shoulder, a.elbow, 0.4).add(V(0.02 * s, 0, -0.075)), V(0.15, 0.27, 0.15), skinLimb(upper, null, fore), a.d).blend(0.07),
    );
    // forearm: gorilla-massive near the elbow
    P.push(new RoundCone(a.elbow, a.wrist, 0.155, 0.095, skinLimb(fore, upper, hand, 0.25, 0.18)).blend(0.07));
    P.push(
      new Ellipsoid(lerpV(a.elbow, a.wrist, 0.3).addScaledVector(a.n, -0.025), V(0.185, 0.29, 0.17), skinLimb(fore, upper, null, 0.4), a.d).blend(0.08),
    );
    // ---- legs ----
    const l = legFrame(s);
    // glutes
    P.push(new Ellipsoid(V(0.18 * s, 1.38, -0.16), V(0.23, 0.25, 0.2), skinMix([[B.hips, 0.6], [thigh, 0.4]])).blend(0.1));
    const thighDir = l.knee.clone().sub(l.hip).normalize();
    P.push(new RoundCone(l.hip, l.knee, 0.26, 0.16, skinLimb(thigh, B.hips, shin, 0.25, 0.22)).blend(0.09));
    P.push(
      new Ellipsoid(lerpV(l.hip, l.knee, 0.45).add(V(0.02 * s, 0, 0.08)), V(0.19, 0.32, 0.18), skinLimb(thigh, null, shin), thighDir).blend(0.08),
    );
    P.push(
      new Ellipsoid(lerpV(l.hip, l.knee, 0.4).add(V(0, 0, -0.075)), V(0.18, 0.3, 0.17), skinLimb(thigh, null, shin), thighDir).blend(0.08),
    );
    const shinDir = l.ankle.clone().sub(l.knee).normalize();
    P.push(new RoundCone(l.knee, l.ankle.clone().add(V(0, -0.06, 0)), 0.16, 0.1, skinLimb(shin, thigh, foot, 0.22, 0.2)).blend(0.07));
    // calf
    P.push(new Ellipsoid(lerpV(l.knee, l.ankle, 0.3).add(V(0, 0, -0.08)), V(0.15, 0.24, 0.15), skinBone(shin), shinDir).blend(0.07));
  }
  return {
    name: 'body',
    prims: sortPrims(P),
    min: V(-1.38, 0.18, -0.6),
    max: V(1.38, 2.92, 0.66),
    h,
    skinSigma: 0.04,
  };
}

const MY = MOUTH_POS.y;

export function headPart(h: number): PartSpec {
  const P: Prim[] = [];
  const hb = skinBone(B.head);
  // low, heavy cranium with a sagittal crest (no cute dome)
  P.push(new Ellipsoid(V(0, 2.95, 0.09), V(0.19, 0.17, 0.2), hb).blend(0.08));
  P.push(new Ellipsoid(V(0, 3.05, 0.03), V(0.06, 0.07, 0.15), hb).blend(0.1));
  P.push(new Ellipsoid(V(0, 2.87, -0.01), V(0.18, 0.16, 0.16), hb).blend(0.08));
  P.push(new RoundCone(V(0, 2.58, -0.04), V(0, 2.86, 0.05), 0.19, 0.17, skinLerp(B.neck, B.head, 0.2, 1)).blend(0.1));
  for (const s of [1, -1]) {
    // heavy brow ridge (two arcs meeting above the nose)
    P.push(new RoundCone(V(0.17 * s, 2.995, 0.26), V(0.0, 2.985, 0.35), 0.052, 0.048, hb).blend(0.035));
    // cheekbones
    P.push(new Ellipsoid(V(0.135 * s, 2.915, 0.255), V(0.075, 0.055, 0.08), hb).blend(0.05));
    // jowls at the side of the muzzle
    P.push(new Ellipsoid(V(0.12 * s, 2.845, 0.27), V(0.075, 0.075, 0.09), hb).blend(0.05));
    // eye sockets (carved deep under the brow)
    P.push(new Ellipsoid(V(0.08 * s, 2.946, 0.33), V(0.042, 0.03, 0.045), hb).subtract(0.016));
    // nostrils (carved, flared)
    P.push(new Ellipsoid(V(0.034 * s, 2.876, 0.432), V(0.021, 0.014, 0.024), hb).subtract(0.01));
    // nostril wings
    P.push(new Ellipsoid(V(0.05 * s, 2.885, 0.41), V(0.03, 0.026, 0.03), hb).blend(0.02));
    // heavy, angry upper lids: slope down toward the nose
    P.push(new Ellipsoid(V(0.08 * s, 2.963, 0.298), V(0.04, 0.019, 0.034), hb, V(-0.42 * s, 1, 0)).blend(0.012).after());
  }
  // prognathic muzzle
  P.push(new Ellipsoid(V(0, 2.855, 0.3), V(0.145, 0.09, 0.125), hb).blend(0.06));
  // broad flat nose + bridge
  P.push(new Ellipsoid(V(0, 2.9, 0.392), V(0.08, 0.048, 0.048), hb).blend(0.035));
  P.push(new RoundCone(V(0, 2.975, 0.335), V(0, 2.925, 0.39), 0.033, 0.036, hb).blend(0.03));
  // upper lip
  P.push(new Ellipsoid(V(0, 2.81, 0.36), V(0.13, 0.048, 0.078), hb).blend(0.04));
  return {
    name: 'head',
    prims: sortPrims(P),
    min: V(-0.29, 2.56, -0.2),
    max: V(0.29, 3.2, 0.49),
    h,
    skinSigma: 0.025,
    post: (x, y, z, d) => {
      // carve the mouth opening: everything below the mouth line in front belongs to the jaw
      const box = sdBox(x, y, z, 0, MY - 0.16, 0.12 + 0.3, 0.2, 0.16, 0.3);
      return smax(d, -box, 0.02);
    },
  };
}

export function jawPart(h: number): PartSpec {
  const P: Prim[] = [];
  const jb = skinBone(B.jaw);
  P.push(new Ellipsoid(V(0, 2.745, 0.27), V(0.135, 0.075, 0.145), jb).blend(0.05));
  P.push(new Ellipsoid(V(0, 2.722, 0.352), V(0.1, 0.068, 0.068), jb).blend(0.05));
  P.push(new Ellipsoid(V(0, 2.7, 0.2), V(0.12, 0.065, 0.14), jb).blend(0.06));
  P.push(new Ellipsoid(V(0, 2.776, 0.36), V(0.12, 0.03, 0.072), jb).blend(0.03));
  for (const s of [1, -1]) {
    P.push(new RoundCone(V(0.12 * s, 2.75, 0.17), V(0.13 * s, 2.86, 0.09), 0.05, 0.04, jb).blend(0.05));
    // cheek membrane: stretches between skull and jaw when the mouth opens
    P.push(new RoundCone(V(0.128 * s, 2.87, 0.235), V(0.128 * s, 2.75, 0.245), 0.034, 0.045, skinLerp(B.head, B.jaw, 0.1, 0.9)).blend(0.04));
  }
  return {
    name: 'jaw',
    prims: sortPrims(P),
    min: V(-0.22, 2.6, 0.0),
    max: V(0.22, 2.93, 0.46),
    h,
    skinSigma: 0.02,
    post: (x, y, z, d) => {
      // hollow out the floor of the mouth (tongue sits lower than the gum rim)
      const box = sdBox(x, y, z, 0, MY + 0.08, 0.33, 0.092, 0.1, 0.25);
      return smax(d, -box, 0.02);
    },
  };
}

export interface HandFrame {
  W: THREE.Vector3;
  d: THREE.Vector3;
  n: THREE.Vector3;
  w: THREE.Vector3;
  at: (u: number, v: number, q: number) => THREE.Vector3;
}

export function handFrame(s: number): HandFrame {
  const a = armFrame(s);
  const W = a.wrist;
  return {
    W,
    d: a.d,
    n: a.n,
    w: a.w,
    at: (u, v, q) => W.clone().addScaledVector(a.d, u).addScaledVector(a.n, v).addScaledVector(a.w, q),
  };
}

export const FINGERS: Array<{ q: number; len: number; r: number }> = [
  { q: 0.078, len: 0.95, r: 0.036 }, // index
  { q: 0.026, len: 1.0, r: 0.037 },
  { q: -0.026, len: 0.96, r: 0.035 },
  { q: -0.076, len: 0.8, r: 0.032 }, // pinky
];

export function fingerTip(f: HandFrame, fi: (typeof FINGERS)[number]): { tip: THREE.Vector3; mid: THREE.Vector3 } {
  const mid = f.at(0.235 + 0.15 * fi.len, 0.0, fi.q * 1.05);
  const tip = f.at(0.235 + 0.27 * fi.len, 0.006, fi.q * 1.08);
  return { tip, mid };
}

export function thumbPoints(f: HandFrame): THREE.Vector3[] {
  return [f.at(0.04, 0.02, 0.07), f.at(0.15, 0.05, 0.125), f.at(0.24, 0.085, 0.13)];
}

export function handPart(side: Side, h: number): PartSpec {
  const s = sideSign(side);
  const f = handFrame(s);
  const fore = B[`forearm${side}`];
  const hand = B[`hand${side}`];
  const f1 = B[`fingers${side}`];
  const f2 = B[`fingers2${side}`];
  const th = B[`thumb${side}`];
  const P: Prim[] = [];
  P.push(new RoundCone(f.at(-0.13, 0, 0), f.at(0.05, 0, 0), 0.095, 0.085, skinLerp(fore, hand, 0.3, 0.85)).blend(0.04));
  P.push(new Ellipsoid(f.at(0.13, 0, 0), V(0.115, 0.13, 0.06), skinBone(hand), f.d, f.n).blend(0.05));
  P.push(new Ellipsoid(f.at(0.1, 0.035, 0.055), V(0.06, 0.075, 0.04), skinBone(hand), f.d, f.n).blend(0.04));
  P.push(new RoundCone(f.at(0.225, -0.012, -0.08), f.at(0.225, -0.012, 0.078), 0.043, 0.045, skinMix([[hand, 0.7], [f1, 0.3]])).blend(0.03));
  for (const fi of FINGERS) {
    const base = f.at(0.235, 0, fi.q);
    const { tip, mid } = fingerTip(f, fi);
    P.push(new RoundCone(base, mid, fi.r, fi.r * 0.92, skinLimb(f1, hand, f2, 0.3, 0.25)).blend(0.015));
    P.push(new RoundCone(mid, tip, fi.r * 0.9, fi.r * 0.72, skinLimb(f2, f1, null, 0.25)).blend(0.015));
  }
  const tp = thumbPoints(f);
  P.push(new RoundCone(tp[0], tp[1], 0.046, 0.039, skinLerp(hand, th, 0, 0.6)).blend(0.03));
  P.push(new RoundCone(tp[1], tp[2], 0.037, 0.03, skinBone(th)).blend(0.015));
  const pts = [f.at(-0.14, 0, 0), f.at(0.55, 0, 0), f.at(0.2, 0.15, 0.2), f.at(0.2, -0.15, -0.2), f.at(0.2, 0.15, -0.2), f.at(0.2, -0.15, 0.2)];
  const box = new THREE.Box3().setFromPoints(pts);
  return { name: `hand${side}`, prims: sortPrims(P), min: box.min, max: box.max, h, skinSigma: 0.012 };
}

export const TOES: Array<{ dx: number; r: number; len: number }> = [
  { dx: -0.085, r: 0.052, len: 0.15 }, // big toe (inner)
  { dx: -0.028, r: 0.044, len: 0.16 },
  { dx: 0.026, r: 0.041, len: 0.145 },
  { dx: 0.076, r: 0.038, len: 0.12 },
];

export function toeTip(s: number, t: (typeof TOES)[number]): { base: THREE.Vector3; tip: THREE.Vector3 } {
  const l = legFrame(s);
  const base = V(l.ball.x + t.dx * s, 0.058, 0.19);
  const tip = V(l.ball.x + t.dx * s * 1.18, 0.042, 0.19 + t.len);
  return { base, tip };
}

export function footPart(side: Side, h: number): PartSpec {
  const s = sideSign(side);
  const l = legFrame(s);
  const shin = B[`shin${side}`];
  const foot = B[`foot${side}`];
  const toes = B[`toes${side}`];
  const P: Prim[] = [];
  const x = l.ankle.x;
  P.push(new RoundCone(V(x - 0.005 * s, 0.45, -0.035), V(x, 0.2, -0.07), 0.1, 0.095, skinLerp(shin, foot, 0.35, 0.95)).blend(0.05));
  P.push(new Ellipsoid(V(x, 0.1, -0.12), V(0.088, 0.1, 0.1), skinBone(foot)).blend(0.06));
  P.push(new RoundCone(V(x, 0.12, -0.06), V(x + 0.01 * s, 0.075, 0.17), 0.1, 0.085, skinLimb(foot, null, toes, 0.2, 0.3)).blend(0.06));
  P.push(new Ellipsoid(V(x + 0.01 * s, 0.06, 0.16), V(0.125, 0.06, 0.08), skinMix([[foot, 0.6], [toes, 0.4]])).blend(0.05));
  for (const t of TOES) {
    const { base, tip } = toeTip(s, t);
    P.push(new RoundCone(base, tip, t.r, t.r * 0.78, skinLimb(toes, foot, null, 0.3)).blend(0.02));
  }
  return {
    name: `foot${side}`,
    prims: sortPrims(P),
    min: V(x - 0.24, -0.05, -0.28),
    max: V(x + 0.24, 0.47, 0.42),
    h,
    skinSigma: 0.015,
    post: (_x, y, _z, d) => smax(d, -y, 0.03),
  };
}
