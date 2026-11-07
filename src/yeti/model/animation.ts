/**
 * Procedural Yeti animation: every YetiMode produces a PoseSample (FK euler offsets + IK targets),
 * which are cross-faded by YetiModel and resolved with two-bone IK.
 */
import * as THREE from 'three';
import type { YetiMode } from '../../core/types';
import { B, BONE_COUNT, type BoneName } from './rig';

export const L = 0;
export const R = 1;
const SGN = [1, -1];

export class PoseSample {
  readonly rot = new Float32Array(BONE_COUNT * 3);
  readonly hips = new THREE.Vector3();
  readonly foot = [new THREE.Vector3(), new THREE.Vector3()];
  readonly footPitch = [0, 0];
  readonly footYaw = [0, 0];
  readonly toes = [0, 0];
  readonly knee = [new THREE.Vector3(), new THREE.Vector3()];
  readonly armIK = [0, 0];
  readonly hand = [new THREE.Vector3(), new THREE.Vector3()];
  readonly elbow = [new THREE.Vector3(), new THREE.Vector3()];
  readonly handAim = [0, 0];
  readonly handDir = [new THREE.Vector3(), new THREE.Vector3()];
  readonly palmDir = [new THREE.Vector3(), new THREE.Vector3()];
  readonly mouthHand = [0, 0];
  readonly mouthOff = [new THREE.Vector3(), new THREE.Vector3()];
  readonly curl = [0, 0];
  readonly curl2 = [0, 0];
  readonly thumb = [0, 0];
  jaw = 0;
  look = 0;
  lookPitch = 0;
  lookYaw = 0;
  lookRoll = 0;

  reset(): void {
    this.rot.fill(0);
    this.hips.set(0, 0, 0);
    for (let i = 0; i < 2; i++) {
      const s = SGN[i];
      this.foot[i].set(0.34 * s, 0.2, -0.04);
      this.footPitch[i] = 0;
      this.footYaw[i] = 0.06 * s;
      this.toes[i] = 0;
      this.knee[i].set(0.25 * s, 0, 1);
      this.armIK[i] = 0;
      this.hand[i].set(0.6 * s, 0.4, 0.3);
      this.elbow[i].set(0.5 * s, -0.1, -1);
      this.handAim[i] = 0;
      this.handDir[i].set(0, -1, 0);
      this.palmDir[i].set(0, 0, -1);
      this.mouthHand[i] = 0;
      this.mouthOff[i].set(0, -0.2, 0.25);
      this.curl[i] = 0.35;
      this.curl2[i] = 0.35;
      this.thumb[i] = 0.25;
    }
    this.jaw = 0.02;
    this.look = 0;
    this.lookPitch = 0;
    this.lookYaw = 0;
    this.lookRoll = 0;
  }

  copy(o: PoseSample): this {
    this.rot.set(o.rot);
    this.hips.copy(o.hips);
    for (let i = 0; i < 2; i++) {
      this.foot[i].copy(o.foot[i]);
      this.footPitch[i] = o.footPitch[i];
      this.footYaw[i] = o.footYaw[i];
      this.toes[i] = o.toes[i];
      this.knee[i].copy(o.knee[i]);
      this.armIK[i] = o.armIK[i];
      this.hand[i].copy(o.hand[i]);
      this.elbow[i].copy(o.elbow[i]);
      this.handAim[i] = o.handAim[i];
      this.handDir[i].copy(o.handDir[i]);
      this.palmDir[i].copy(o.palmDir[i]);
      this.mouthHand[i] = o.mouthHand[i];
      this.mouthOff[i].copy(o.mouthOff[i]);
      this.curl[i] = o.curl[i];
      this.curl2[i] = o.curl2[i];
      this.thumb[i] = o.thumb[i];
    }
    this.jaw = o.jaw;
    this.look = o.look;
    this.lookPitch = o.lookPitch;
    this.lookYaw = o.lookYaw;
    this.lookRoll = o.lookRoll;
    return this;
  }

  /** this = lerp(this, o, t) */
  lerpTo(o: PoseSample, t: number): this {
    const k = (a: number, b: number): number => a + (b - a) * t;
    for (let i = 0; i < this.rot.length; i++) this.rot[i] = k(this.rot[i], o.rot[i]);
    this.hips.lerp(o.hips, t);
    for (let i = 0; i < 2; i++) {
      this.foot[i].lerp(o.foot[i], t);
      this.footPitch[i] = k(this.footPitch[i], o.footPitch[i]);
      this.footYaw[i] = k(this.footYaw[i], o.footYaw[i]);
      this.toes[i] = k(this.toes[i], o.toes[i]);
      this.knee[i].lerp(o.knee[i], t);
      // IK targets: blend positions weighted by their activation so a fading-in IK doesn't drag from a stale target
      const wa = this.armIK[i];
      const wb = o.armIK[i];
      if (wa < 1e-3) this.hand[i].copy(o.hand[i]);
      else if (wb > 1e-3) this.hand[i].lerp(o.hand[i], t);
      this.armIK[i] = k(wa, wb);
      this.elbow[i].lerp(o.elbow[i], t);
      const ha = this.handAim[i];
      if (ha < 1e-3) {
        this.handDir[i].copy(o.handDir[i]);
        this.palmDir[i].copy(o.palmDir[i]);
      } else if (o.handAim[i] > 1e-3) {
        this.handDir[i].lerp(o.handDir[i], t);
        this.palmDir[i].lerp(o.palmDir[i], t);
      }
      this.handAim[i] = k(ha, o.handAim[i]);
      if (this.mouthHand[i] < 1e-3) this.mouthOff[i].copy(o.mouthOff[i]);
      else this.mouthOff[i].lerp(o.mouthOff[i], t);
      this.mouthHand[i] = k(this.mouthHand[i], o.mouthHand[i]);
      this.curl[i] = k(this.curl[i], o.curl[i]);
      this.curl2[i] = k(this.curl2[i], o.curl2[i]);
      this.thumb[i] = k(this.thumb[i], o.thumb[i]);
    }
    this.jaw = k(this.jaw, o.jaw);
    this.look = k(this.look, o.look);
    this.lookPitch = k(this.lookPitch, o.lookPitch);
    this.lookYaw = k(this.lookYaw, o.lookYaw);
    this.lookRoll = k(this.lookRoll, o.lookRoll);
    return this;
  }

  add(bone: BoneName, x: number, y = 0, z = 0): void {
    const i = B[bone] * 3;
    this.rot[i] += x;
    this.rot[i + 1] += y;
    this.rot[i + 2] += z;
  }
  addSide(base: 'clav' | 'upperArm' | 'forearm' | 'hand' | 'thigh' | 'shin', side: number, x: number, y = 0, z = 0): void {
    const name = (base + (side === L ? 'L' : 'R')) as BoneName;
    this.add(name, x, y, z);
  }
}

export interface AnimCtx {
  speed: number;
  turn: number;
  time: number;
  /** gait phase (cycles) */
  phase: number;
  /** gait frequency (Hz) */
  freq: number;
  /** 0..1 knuckle-gallop blend for run */
  gallop: number;
}

// ------------------------------------------------------------------ helpers
export const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const frac = (x: number): number => x - Math.floor(x);
const TAU = Math.PI * 2;
/** cheap smooth 1D noise */
const noise1 = (x: number): number =>
  Math.sin(x * 1.0) * 0.5 + Math.sin(x * 2.31 + 1.3) * 0.3 + Math.sin(x * 4.73 + 2.1) * 0.2;

/** Hunched resting posture; h = 0 upright, 1 normal hunch, 1.5 deep crouch. */
function posture(o: PoseSample, h: number): void {
  o.hips.y += -0.1 * h;
  o.hips.z += -0.05 * h;
  o.add('hips', 0.2 * h);
  o.add('spine1', 0.13 * h);
  o.add('spine2', 0.16 * h);
  o.add('spine3', 0.15 * h);
  o.add('neck', -0.28 * h);
  o.add('head', -0.26 * h);
  const lean = 0.64 * h;
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    o.addSide('clav', i, 0, -0.12 * s * h, -0.04 * s * h);
    o.addSide('upperArm', i, -lean * 0.88 - 0.05, 0.05 * s, -0.17 * s);
    o.addSide('forearm', i, -0.28 - 0.08 * h);
    o.addSide('hand', i, -0.1, 0, 0.05 * s);
    o.foot[i].z += 0.03 * h;
    o.foot[i].x += 0.03 * SGN[i] * h;
  }
}

/** Foot cycle: returns [z, y, pitch] for phase in [0,1), stance first. */
function footCycle(ph: number, duty: number, len: number, height: number, out: number[]): void {
  if (ph < duty) {
    const u = ph / duty;
    out[0] = len * (0.5 - u);
    out[1] = 0;
    out[2] = 0;
    if (u > 0.72) {
      const k = (u - 0.72) / 0.28;
      out[2] = 0.55 * k * k * Math.min(1, len * 2);
      out[1] = 0.1 * k * k * Math.min(1, len * 2);
    }
  } else {
    const u = (ph - duty) / (1 - duty);
    const e = u * u * u * (u * (u * 6 - 15) + 10);
    const lift = Math.min(1, len * 2);
    out[0] = len * (-0.5 + e);
    out[1] = height * Math.sin(Math.PI * u) + 0.1 * lift * (1 - u) * (1 - u);
    out[2] = lift * (0.55 * (1 - u) * (1 - u) - 0.4 * Math.sin(Math.PI * u) * u);
  }
}

const fc = [0, 0, 0];

export interface GaitStyle {
  hunch: number;
  armSwing: number;
  heavy: number;
  slump: number;
}

/** Bipedal walk / run. Strike: left foot at phase 0, right foot at 0.5. */
export function bipedDuty(v: number): number {
  return 0.66 - 0.3 * clamp((v - 1) / 7, 0, 1);
}
export function bipedFreq(v: number): number {
  return 0.55 + 0.11 * v;
}
export function gallopFreq(v: number): number {
  return 1.2 + 0.06 * v;
}

function biped(o: PoseSample, c: AnimCtx, st: GaitStyle): void {
  const v = c.speed;
  const amp = smooth(0.05, 0.8, v);
  const runK = smooth(3, 8, v);
  posture(o, st.hunch + 0.25 * runK);
  const duty = bipedDuty(v);
  const len = Math.min(1.75, (v * duty) / Math.max(0.3, c.freq)) * amp;
  const height = (0.14 + 0.035 * v) * amp * (1 - 0.3 * st.heavy);
  const P = c.phase;
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    const ph = frac(P + i * 0.5);
    footCycle(ph, duty, len, Math.min(0.5, height), fc);
    const swing = ph >= duty ? Math.sin((Math.PI * (ph - duty)) / (1 - duty)) : 0;
    o.foot[i].set(o.foot[i].x - 0.025 * s * swing, 0.2 + fc[1], 0.06 + fc[0] + 0.05 * runK);
    o.footPitch[i] = fc[2];
    o.toes[i] = -fc[2] * 0.7;
    o.knee[i].set(0.2 * s, 0, 1);
  }
  const C = Math.cos(TAU * P);
  // bob: dips after each foot strike
  const bobA = (0.035 + 0.012 * v) * amp * (1 + 0.6 * st.heavy);
  o.hips.y += -bobA * (0.5 + 0.5 * Math.cos(2 * TAU * (P - 0.1)));
  o.hips.x += 0.055 * Math.sin(TAU * P) * amp * (1 - 0.7 * runK);
  o.add('hips', 0.02 * v * amp, -0.13 * C * amp, 0.04 * Math.sin(TAU * P) * amp * (1 + st.heavy));
  o.add('spine2', 0.012 * v, 0.06 * C * amp);
  o.add('spine3', 0.01 * v, 0.09 * C * amp, -0.035 * Math.sin(TAU * P) * amp * (1 + st.heavy));
  o.add('spine1', 0.05 * st.heavy * Math.cos(2 * TAU * (P - 0.1)) * amp);
  // arms: counter-swing, heavy shoulder roll
  const A = (st.armSwing + 0.035 * v) * amp;
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    const sw = -Math.cos(TAU * (P - (i === L ? 0.5 : 0))); // -1 = forward
    o.addSide('upperArm', i, A * sw - 0.04 * v * runK, 0, -0.05 * s * runK);
    o.addSide('forearm', i, -0.25 * runK * (1.2 + 0.5 * Math.max(0, -sw)) - 0.15 * Math.max(0, -sw) * amp);
    o.addSide('clav', i, 0, 0.12 * s * sw * amp * (0.5 + st.heavy), (0.05 + 0.04 * st.heavy) * s * Math.max(0, -sw) * amp);
    o.curl[i] = 0.6 + 0.6 * runK;
    o.curl2[i] = 0.5 + 0.7 * runK;
    o.thumb[i] = 0.4 + 0.4 * runK;
  }
  // lean into turns
  const lean = c.turn * 0.25 * smooth(0.5, 5, v);
  o.add('hips', 0, 0, lean);
  o.add('spine2', 0, -c.turn * 0.08, -lean * 0.3);
  o.look = 0.85 * (1 - st.slump);
  o.lookPitch = 0.08 + 0.1 * st.heavy;
  o.lookYaw = -c.turn * 0.3;
  o.jaw = 0.06 + 0.16 * runK + 0.06 * runK * Math.sin(2 * TAU * P);
}

/** Gorilla knuckle gallop. Strikes: hand L 0, hand R 0.1, foot L 0.5, foot R 0.6. */
export const GALLOP_STRIKES: Array<{ ph: number; side: number; hand: boolean }> = [
  { ph: 0.0, side: L, hand: true },
  { ph: 0.1, side: R, hand: true },
  { ph: 0.5, side: L, hand: false },
  { ph: 0.6, side: R, hand: false },
];

function gallop(o: PoseSample, c: AnimCtx): void {
  const v = c.speed;
  const P = c.phase;
  const und = Math.sin(TAU * (P - 0.2));
  o.hips.y += -0.1 + 0.08 * Math.sin(TAU * (P - 0.35));
  o.hips.z += -0.12;
  o.add('hips', 0.55 + 0.1 * und);
  o.add('spine1', 0.26 + 0.12 * und);
  o.add('spine2', 0.2 + 0.1 * und);
  o.add('spine3', 0.12 + 0.06 * und);
  o.add('neck', -0.55 - 0.05 * und);
  o.add('head', -0.45);
  const hDuty = 0.32;
  const fDuty = 0.3;
  const len = Math.min(1.9, (v * hDuty) / Math.max(0.5, c.freq));
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    // hands
    const ph = frac(P - (i === R ? 0.1 : 0));
    footCycle(ph, hDuty, len, 0.5, fc);
    const swing = ph >= hDuty ? (ph - hDuty) / (1 - hDuty) : 0;
    o.armIK[i] = 1;
    o.hand[i].set(0.52 * s, 0.33 + fc[1] * 1.1, 1.05 + fc[0]);
    o.elbow[i].set(0.6 * s, -0.3, -1);
    o.handAim[i] = 1;
    const reach = Math.sin(Math.PI * swing);
    o.handDir[i].set(0.05 * s, -1, 0.15 + 0.9 * reach).normalize();
    o.palmDir[i].set(-0.35 * s, 0, -1).normalize();
    o.curl[i] = 1.45 - 0.6 * reach;
    o.curl2[i] = 1.5 - 0.7 * reach;
    o.thumb[i] = 0.9;
    // feet
    const pf = frac(P - 0.5 - (i === R ? 0.1 : 0));
    footCycle(pf, fDuty, len * 0.85, 0.4, fc);
    o.foot[i].set(0.38 * s, 0.2 + fc[1], 0.12 + fc[0]);
    o.footPitch[i] = fc[2];
    o.toes[i] = -fc[2] * 0.7;
    o.knee[i].set(0.45 * s, 0, 1);
    o.addSide('clav', i, 0, -0.15 * s * reach, 0.1 * s * reach);
  }
  const lean = c.turn * 0.3;
  o.add('hips', 0, -c.turn * 0.1, lean);
  o.add('spine3', 0, 0, -lean * 0.4);
  o.look = 0.92;
  o.lookPitch = 0.05;
  o.lookYaw = -c.turn * 0.35;
  o.jaw = 0.35 + 0.12 * Math.sin(TAU * (P - 0.1));
}

const tmpSample = new PoseSample();

// ------------------------------------------------------------------ modes
function lurk(o: PoseSample, t: number, c: AnimCtx): void {
  posture(o, 1.5);
  o.hips.y += -0.36;
  o.hips.z += -0.08;
  const br = Math.sin(TAU * 0.22 * c.time);
  o.add('spine3', 0.03 * br);
  o.add('spine2', 0.02 * br);
  o.hips.y += 0.015 * br;
  o.add('hips', 0, 0, 0.03 * Math.sin(TAU * 0.11 * c.time));
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    o.foot[i].set(0.44 * s, 0.2, 0.08);
    o.knee[i].set(0.6 * s, 0, 1);
    o.armIK[i] = 1;
    o.hand[i].set(0.55 * s, 0.33, 0.72 + 0.05 * i);
    o.elbow[i].set(0.7 * s, 0, -1);
    o.handAim[i] = 1;
    o.handDir[i].set(0.05 * s, -1, 0.2).normalize();
    o.palmDir[i].set(-0.4 * s, 0, -1).normalize();
    o.curl[i] = 1.35;
    o.curl2[i] = 1.4;
    o.thumb[i] = 0.9;
  }
  o.look = 0.75;
  o.lookPitch = -0.08;
  o.lookYaw = 0.22 * Math.sin(0.3 * c.time + 0.4 * noise1(c.time * 0.2));
  o.jaw = 0.06 + 0.04 * (br * 0.5 + 0.5);
  void t;
}

function grip(o: PoseSample, t: number, c: AnimCtx): void {
  posture(o, 1.25);
  o.hips.y += -0.2;
  o.hips.z += 0.05;
  const br = Math.sin(TAU * 0.25 * c.time);
  const pull = smooth(0.0, 0.8, t);
  o.add('spine3', 0.04 * br + 0.05 * pull);
  o.add('spine2', 0, -0.12 * pull);
  // right hand reaches forward to the rock edge at chest height
  o.armIK[R] = smooth(0, 0.6, t);
  o.hand[R].set(-0.36, 1.92 + 0.02 * br, 1.0 - 0.04 * pull);
  o.elbow[R].set(-0.8, -0.4, -0.6);
  o.handAim[R] = o.armIK[R];
  o.handDir[R].set(0.05, -0.3, 1).normalize();
  o.palmDir[R].set(0.0, -1, -0.3).normalize();
  o.curl[R] = 0.6 + 0.55 * smooth(0.3, 1.0, t) + 0.05 * br;
  o.curl2[R] = 0.6 + 0.5 * smooth(0.3, 1.0, t);
  o.thumb[R] = 0.8;
  // left hand on the ground
  o.armIK[L] = 1;
  o.hand[L].set(0.55, 0.33, 0.62);
  o.elbow[L].set(0.7, 0, -1);
  o.handAim[L] = 1;
  o.handDir[L].set(0.05, -1, 0.2).normalize();
  o.palmDir[L].set(-0.4, 0, -1).normalize();
  o.curl[L] = 1.35;
  o.curl2[L] = 1.4;
  for (let i = 0; i < 2; i++) {
    o.foot[i].set(0.4 * SGN[i], 0.2, 0.0 + (i === L ? 0.15 : -0.1));
    o.knee[i].set(0.5 * SGN[i], 0, 1);
  }
  o.look = 0.85;
  o.lookPitch = 0.02;
  o.lookYaw = -0.1;
  o.jaw = 0.08 + 0.05 * (0.5 + 0.5 * br);
}

function emerge(o: PoseSample, _t: number, c: AnimCtx): void {
  biped(o, c, { hunch: 1.35, armSwing: 0.22, heavy: 1, slump: 0 });
  const sway = Math.sin(TAU * c.phase);
  o.add('neck', 0.05, 0.06 * sway);
  o.jaw = 0.12 + 0.05 * Math.sin(TAU * 0.4 * c.time);
}

function stand(o: PoseSample, t: number, c: AnimCtx): void {
  const u = smooth(0, 1.1, t);
  const puff = smooth(0.8, 1.2, t) * (1 - 0.6 * smooth(1.3, 2.2, t));
  posture(o, 1.25 * (1 - u) + 0.08);
  o.hips.y += 0.02 * u;
  o.add('spine2', -0.07 * puff);
  o.add('spine3', -0.08 * puff);
  const br = Math.sin(TAU * 0.28 * c.time);
  o.add('spine3', 0.02 * br);
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    o.addSide('upperArm', i, 0.05 * u, 0, 0.08 * s * u + 0.04 * s * puff);
    o.addSide('clav', i, 0, 0.06 * s * puff, 0.08 * s * puff);
    o.curl[i] = 0.6 + 0.5 * puff;
    o.curl2[i] = 0.6 + 0.5 * puff;
  }
  o.look = 0.7;
  o.lookPitch = 0.12 + 0.05 * u;
  o.jaw = 0.02 + 0.06 * puff;
}

function roar(o: PoseSample, t: number, c: AnimCtx): void {
  const a = smooth(0, 0.35, t);
  const b = smooth(0.32, 0.62, t);
  const e = 1 - smooth(2.15, 2.6, t);
  const w = a * (1 - b);
  const r = b * e;
  posture(o, 0.3 + 0.55 * w - 0.25 * r);
  o.hips.y += -0.1 * w + 0.03 * r;
  o.hips.z += -0.06 * r;
  // chest expands
  o.add('spine1', -0.05 * r + 0.08 * w);
  o.add('spine2', -0.12 * r + 0.1 * w);
  o.add('spine3', -0.14 * r + 0.08 * w);
  // head thrown forward, face up into the roar
  o.add('neck', 0.5 * r + 0.32 * w);
  o.add('head', -0.62 * r + 0.25 * w);
  o.jaw = 0.12 * w + 0.98 * r;
  const tr = r * (0.6 + 0.4 * smooth(0.6, 1.0, t));
  const n = (k: number): number => noise1(c.time * 38 + k) * 0.022 * tr;
  o.add('spine3', n(0), n(1), n(2));
  o.add('neck', n(3), n(4));
  o.add('head', n(5), n(6), n(7));
  o.jaw += n(8) * 2;
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    o.addSide('clav', i, 0, 0.2 * s * r - 0.1 * s * w, 0.28 * s * r);
    // wind-up: arms drawn in (FK); roar: arms thrown wide & back, elbows bent, claws up (IK)
    o.addSide('upperArm', i, 0.15 * w, 0, -0.05 * w * s);
    o.addSide('forearm', i, -0.5 * w);
    o.armIK[i] = r;
    o.hand[i].set((1.55 + n(9 + i) * 3) * s, 2.72 + n(11 + i) * 3, -0.28);
    o.elbow[i].set(0.3 * s, -1, -0.5);
    o.handAim[i] = r;
    o.handDir[i].set(0.35 * s, 1, 0.1).normalize();
    o.palmDir[i].set(-0.2 * s, 0, 1).normalize();
    o.curl[i] = 0.7 * w + 0.25 * r;
    o.curl2[i] = 0.7 * w + 0.55 * r;
    o.thumb[i] = 0.1 + 0.4 * w;
    o.foot[i].x += 0.06 * SGN[i] * r;
  }
  o.look = 0;
}

function leap(o: PoseSample, t: number, _c: AnimCtx): void {
  const crouch = smooth(0, 0.22, t) * (1 - smooth(0.24, 0.38, t));
  const launch = smooth(0.22, 0.38, t) * (1 - smooth(0.45, 0.6, t));
  const tuck = smooth(0.42, 0.6, t) * (1 - smooth(0.72, 0.9, t));
  const ext = smooth(0.72, 0.95, t);
  const air = smooth(0.3, 0.42, t);
  posture(o, 1.0 + 0.5 * crouch - 0.6 * launch + 0.2 * tuck);
  o.hips.y += -0.42 * crouch + 0.08 * launch;
  o.add('spine2', 0.15 * crouch - 0.05 * launch + 0.1 * tuck);
  o.add('spine3', 0.1 * crouch - 0.1 * launch);
  const bindHipY = 1.42;
  const hipY = bindHipY + o.hips.y;
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    // feet: ground stance -> trailing push -> tucked under -> reaching forward for the landing
    const ground = new THREE.Vector3(0.36 * s, 0.2, 0.0);
    const push = new THREE.Vector3(0.3 * s, hipY - 1.3, -0.45);
    const tucked = new THREE.Vector3(0.38 * s, hipY - 0.7, 0.35);
    const reach = new THREE.Vector3(0.4 * s, hipY - 1.05, 0.5 + 0.05 * i);
    const p = ground.clone().lerp(push, launch * air);
    p.lerp(tucked, tuck);
    p.lerp(reach, ext);
    o.foot[i].copy(p);
    o.footPitch[i] = 0.7 * launch * air - 0.3 * ext;
    o.knee[i].set(0.3 * s, 0, 1);
    // arms: swing back on crouch, throw forward/up on launch, spread for landing
    o.addSide('upperArm', i, 0.7 * crouch - 1.6 * launch - 1.2 * tuck - 0.5 * ext, 0, (0.15 * launch + 0.7 * ext) * s);
    o.addSide('forearm', i, -0.3 * launch - 0.7 * tuck - 0.3 * ext);
    o.curl[i] = 0.2 + 0.3 * crouch;
    o.curl2[i] = 0.4;
    o.thumb[i] = 0.2;
  }
  o.look = 0.85;
  o.lookPitch = 0.05 + 0.15 * ext;
  o.jaw = 0.2 + 0.5 * launch + 0.6 * ext;
}

function grab(o: PoseSample, t: number, _c: AnimCtx): void {
  const u = smooth(0, 0.35, t);
  const close = smooth(0.36, 0.52, t);
  const pull = smooth(0.7, 1.3, t);
  posture(o, 0.9 + 0.35 * u - 0.3 * pull);
  o.hips.z += 0.25 * u - 0.15 * pull;
  o.hips.y += -0.14 * u + 0.06 * pull;
  o.add('spine2', 0.08 * u, 0.22 * u * (1 - 0.6 * pull));
  o.add('spine3', 0.05 * u, 0.2 * u * (1 - 0.6 * pull));
  // contralateral step forward with the left foot
  const step = smooth(0, 0.3, t);
  o.foot[L].set(0.38, 0.2 + 0.25 * Math.sin(Math.PI * step), -0.04 + 0.55 * step);
  o.footPitch[L] = -0.25 * Math.sin(Math.PI * step);
  o.foot[R].set(-0.36, 0.2, -0.15 * u);
  // right arm lunges forward
  o.armIK[R] = 1;
  const rest = new THREE.Vector3(-0.62, 0.95, 0.35);
  const reach = new THREE.Vector3(-0.18, 1.35, 1.75);
  const hold = new THREE.Vector3(-0.38, 1.7, 0.95);
  o.hand[R].copy(rest).lerp(reach, u).lerp(hold, pull);
  o.elbow[R].set(-0.8, -0.6, -0.4);
  o.handAim[R] = 1;
  o.handDir[R].set(0.1, -0.15, 1).normalize().lerp(new THREE.Vector3(0.3, 0.4, 0.8), pull).normalize();
  o.palmDir[R].set(0.85, -0.5, 0).normalize();
  o.curl[R] = 0.05 + 1.15 * close;
  o.curl2[R] = 0.15 + 1.0 * close;
  o.thumb[R] = 0.1 + 1.0 * close;
  // left arm back for balance
  o.addSide('upperArm', L, 0.6 * u, 0, 0.25 * u);
  o.addSide('forearm', L, -0.3 * u);
  o.curl[L] = 0.3;
  o.look = 0.9;
  o.lookPitch = 0.18 - 0.1 * pull;
  o.lookYaw = 0.05 * u;
  o.jaw = 0.1 + 0.45 * u * (1 - close * 0.5) + 0.15 * pull;
}

function eat(o: PoseSample, t: number, c: AnimCtx): void {
  const raise = smooth(0.05, 0.85, t) * (1 - smooth(1.35, 1.9, t));
  const open = smooth(0.45, 0.85, t) * (1 - smooth(1.0, 1.12, t));
  const chew = smooth(1.05, 1.15, t) * (1 - smooth(2.15, 2.3, t));
  const gulp = smooth(2.25, 2.5, t) * (1 - smooth(2.75, 3.0, t));
  const pat = smooth(2.8, 3.1, t) * (1 - smooth(4.6, 5.0, t));
  const happy = smooth(2.9, 3.3, t);
  posture(o, 0.45 - 0.1 * gulp);
  o.add('spine3', -0.05 * gulp);
  // right hand to the mouth
  o.armIK[R] = raise;
  o.mouthHand[R] = 1;
  o.mouthOff[R].set(-0.06, -0.26, 0.27);
  o.hand[R].set(-0.45, 1.6, 0.6);
  o.elbow[R].set(-0.9, -0.6, -0.2);
  o.handAim[R] = raise;
  o.handDir[R].set(0.15, 0.75, -0.65).normalize();
  o.palmDir[R].set(0.2, 0.4, -1).normalize();
  o.curl[R] = 1.0 - 0.7 * smooth(0.95, 1.15, t);
  o.curl2[R] = 0.9 - 0.6 * smooth(0.95, 1.15, t);
  o.thumb[R] = 0.8 - 0.5 * smooth(0.95, 1.15, t);
  // jaw: open wide, chomp, gulp
  const chomp = 0.5 + 0.5 * Math.sin(TAU * 3.2 * (t - 1.1));
  o.jaw = 0.05 + 0.9 * open + chew * (0.05 + 0.32 * chomp);
  o.add('head', -0.12 * open + 0.06 * chew * chomp - 0.4 * gulp, 0, 0.05 * chew * Math.sin(TAU * 1.6 * t));
  o.add('neck', 0.08 * open - 0.15 * gulp);
  // left hand pats belly
  o.armIK[L] = pat;
  const patOsc = Math.max(0, Math.sin(TAU * 2.6 * t));
  o.hand[L].set(0.2, 1.52, 0.56 + 0.07 * patOsc);
  o.elbow[L].set(1, -0.3, -0.3);
  o.handAim[L] = pat;
  o.handDir[L].set(-0.7, -0.3, 0.45).normalize();
  o.palmDir[L].set(-0.3, 0.1, -1).normalize();
  o.curl[L] = 0.25;
  o.curl2[L] = 0.2;
  o.look = 0.4 * happy;
  o.lookPitch = -0.05;
  o.lookRoll = 0.15 * happy;
  o.add('spine1', -0.04 * happy);
  void c;
}

function disgust(o: PoseSample, t: number, c: AnimCtx): void {
  const rec = smooth(0, 0.3, t) * (1 - 0.5 * smooth(1.6, 2.6, t));
  const wave = smooth(0.45, 0.75, t) * (1 - smooth(1.9, 2.3, t));
  const shake = smooth(0.85, 1.05, t) * (1 - smooth(2.3, 2.8, t));
  posture(o, 0.55);
  o.add('spine1', -0.08 * rec);
  o.add('spine2', -0.12 * rec);
  o.add('spine3', -0.1 * rec, 0.15 * rec);
  o.hips.z += -0.14 * rec;
  o.foot[R].z += -0.2 * rec;
  // dismissive "shoo" wave with the right hand
  const osc = Math.sin(TAU * 2.6 * t);
  o.addSide('upperArm', R, -1.05 * wave, 0.25 * wave * osc, -0.35 * wave);
  o.addSide('forearm', R, -1.25 * wave, 0, 0);
  o.addSide('hand', R, 0.3 * wave * osc, 0, 0.2 * wave);
  o.curl[R] = 0.35 - 0.3 * wave;
  o.curl2[R] = 0.35 - 0.3 * wave;
  o.thumb[R] = 0.1;
  o.addSide('upperArm', L, 0.1 * rec, 0, 0.1 * rec);
  // head turned aside, then shaking
  o.look = 1;
  o.lookPitch = 0.0 - 0.15 * rec;
  o.lookYaw = 0.45 * rec * (1 - shake) + 0.42 * shake * Math.sin(TAU * 2.7 * t);
  o.lookRoll = -0.12 * rec;
  o.jaw = 0.18 * rec + 0.08 * shake * (0.5 + 0.5 * Math.sin(TAU * 5.0 * t));
  void c;
}

function turnAway(o: PoseSample, _t: number, c: AnimCtx): void {
  biped(o, c, { hunch: 1.0, armSwing: 0.12, heavy: 0.6, slump: 1 });
  o.add('neck', 0.25);
  o.add('head', 0.3);
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    o.addSide('clav', i, 0, -0.15 * s, -0.12 * s);
    o.addSide('upperArm', i, 0.08, 0, -0.06 * s);
    o.curl[i] = 0.3;
    o.curl2[i] = 0.3;
  }
  o.jaw = 0.05;
}

function walk(o: PoseSample, _t: number, c: AnimCtx): void {
  biped(o, c, { hunch: 0.85, armSwing: 0.3, heavy: 0.5, slump: 0 });
}

function run(o: PoseSample, _t: number, c: AnimCtx): void {
  const g = c.gallop;
  if (g < 0.999) biped(o, c, { hunch: 1.0, armSwing: 0.45, heavy: 0.3, slump: 0 });
  if (g > 0.001) {
    tmpSample.reset();
    gallop(tmpSample, c);
    o.lerpTo(tmpSample, g);
  }
}

export function sampleMode(mode: YetiMode, o: PoseSample, t: number, c: AnimCtx): void {
  o.reset();
  switch (mode) {
    case 'hidden':
    case 'lurk':
      lurk(o, t, c);
      break;
    case 'grip':
      grip(o, t, c);
      break;
    case 'emerge':
      emerge(o, t, c);
      break;
    case 'stand':
      stand(o, t, c);
      break;
    case 'roar':
      roar(o, t, c);
      break;
    case 'walk':
      walk(o, t, c);
      break;
    case 'run':
      run(o, t, c);
      break;
    case 'leap':
      leap(o, t, c);
      break;
    case 'grab':
      grab(o, t, c);
      break;
    case 'eat':
      eat(o, t, c);
      break;
    case 'disgust':
      disgust(o, t, c);
      break;
    case 'turnAway':
      turnAway(o, t, c);
      break;
  }
}

export const GAIT_MODES: ReadonlySet<YetiMode> = new Set<YetiMode>(['walk', 'run', 'emerge', 'turnAway']);
