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
  /** 0..1 the foot is (authored as) bearing weight on the ground: drives foot locking & slope alignment */
  readonly plant = [1, 1];
  /** 0..1 the hand target is authored relative to the ground (knuckle-walking): it follows the terrain */
  readonly handGround = [0, 0];
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
      this.plant[i] = 1;
      this.handGround[i] = 0;
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
      this.plant[i] = o.plant[i];
      this.handGround[i] = o.handGround[i];
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
      this.plant[i] = k(this.plant[i], o.plant[i]);
      this.handGround[i] = k(this.handGround[i], o.handGround[i]);
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
  return 0.66 - 0.3 * clamp((v - 1) / 4, 0, 1);
}
export function bipedFreq(v: number): number {
  return 0.55 + 0.11 * v;
}
export function gallopFreq(v: number): number {
  return 1.35 + 0.07 * v;
}
export const CRAWL_DUTY = 0.68;
/** longest distance a foot travels (relative to the body) while planted, m */
const MAX_STANCE_TRAVEL = 1.35;
const MAX_CRAWL_TRAVEL = 1.0;
const MAX_GALLOP_TRAVEL = 1.3;
const GALLOP_FOOT_DUTY = 0.24;
export function crawlFreq(v: number): number {
  return 0.55 + 0.4 * v;
}
/** Gait frequency (Hz) of a mode at ground speed v. Stride length is derived from it so that stride × frequency = v. */
export function modeFreq(mode: YetiMode, v: number, gallopW: number): number {
  if (mode === 'crawl') return Math.max(crawlFreq(v), (v * CRAWL_DUTY) / MAX_CRAWL_TRAVEL);
  // the cadence rises when needed so the stance travel stays within the reach of the legs
  const fb = Math.max(bipedFreq(v) * (mode === 'emerge' ? 0.85 : mode === 'turnAway' ? 0.9 : 1), (v * bipedDuty(v)) / MAX_STANCE_TRAVEL);
  const fg = Math.max(gallopFreq(v), (v * GALLOP_FOOT_DUTY) / MAX_GALLOP_TRAVEL);
  return fb * (1 - gallopW) + fg * gallopW;
}
/** Authored plant weight for a limb in a cyclic gait: 1 in stance, ramps 1→0 / 0→1 over the first/last 10 % of swing. */
function gaitPlant(ph: number, duty: number): number {
  if (ph < duty) return 1;
  const u = (ph - duty) / (1 - duty);
  return clamp(Math.max(1 - u / 0.1, (u - 0.9) / 0.1), 0, 1);
}

function biped(o: PoseSample, c: AnimCtx, st: GaitStyle): void {
  const v = c.speed;
  const amp = smooth(0.05, 0.8, v);
  const runK = smooth(3, 8, v);
  posture(o, st.hunch + 0.25 * runK);
  const duty = bipedDuty(v);
  // stride length × frequency = speed, so planted feet do not slide (amp only scales the flourish)
  const len = Math.min(1.75, (v * duty) / Math.max(0.3, c.freq));
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
    o.plant[i] = amp < 0.15 ? 1 : gaitPlant(ph, duty);
  }
  const C = Math.cos(TAU * P);
  // bob: dips after each foot strike
  const bobA = (0.035 + 0.012 * v) * amp * (1 + 0.6 * st.heavy);
  o.hips.y += -bobA * (0.5 + 0.5 * Math.cos(2 * TAU * (P - 0.1)));
  // weight acceptance: a short sharp sag just after each heel strike, the mass of the torso and the
  // dangling arms following a beat later (the head is stabilised by the look solver)
  const ph2 = frac(2 * P);
  const imp = Math.exp(-(((ph2 - 0.09) / 0.075) ** 2)) * amp * (0.4 + 0.6 * st.heavy) * (1 - 0.6 * runK);
  o.hips.y += -0.045 * imp;
  o.add('spine1', 0.05 * imp);
  o.add('spine3', 0.035 * imp);
  for (let i = 0; i < 2; i++) o.addSide('forearm', i, -0.08 * imp);
  o.hips.x += 0.055 * Math.sin(TAU * P) * amp * (1 - 0.7 * runK);
  o.add('hips', 0.02 * v * amp, -0.13 * C * amp, 0.05 * Math.sin(TAU * P) * amp * (1 + st.heavy));
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
  // a long, low, stretched body (shoulders well ahead of the hips) so that the four limbs read as separate
  // columns in silhouette rather than bunching under the chest
  o.hips.y += -0.1 + 0.08 * Math.sin(TAU * (P - 0.35));
  o.hips.z += -0.26;
  o.add('hips', 0.8 + 0.08 * und);
  o.add('spine1', 0.2 + 0.07 * und);
  o.add('spine2', 0.12 + 0.06 * und);
  o.add('spine3', 0.02 + 0.04 * und);
  o.add('neck', -0.72 - 0.05 * und);
  o.add('head', -0.5);
  const hDuty = 0.27;
  const fDuty = GALLOP_FOOT_DUTY;
  // stance travel = speed × stance time for hands and feet alike (no skating)
  const len = Math.min(1.9, (v * hDuty) / Math.max(0.5, c.freq));
  const lenF = Math.min(1.5, (v * fDuty) / Math.max(0.5, c.freq));
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    // hands
    const ph = frac(P - (i === R ? 0.1 : 0));
    footCycle(ph, hDuty, len, 0.5, fc);
    const swing = ph >= hDuty ? (ph - hDuty) / (1 - hDuty) : 0;
    o.armIK[i] = 1;
    // the recovering hand swings low and forward (not up to the chin): the fore limbs read as legs
    o.hand[i].set(0.5 * s, 0.33 + fc[1] * 0.75, 1.6 + fc[0]);
    o.elbow[i].set(0.6 * s, -0.3, -1);
    o.handAim[i] = 1;
    const reach = Math.sin(Math.PI * swing);
    o.handDir[i].set(0.05 * s, -1, 0.15 + 0.9 * reach).normalize();
    o.palmDir[i].set(-0.35 * s, 0, -1).normalize();
    o.curl[i] = 1.45 - 0.6 * reach;
    o.curl2[i] = 1.5 - 0.7 * reach;
    o.thumb[i] = 0.9;
    o.handGround[i] = 1;
    // feet
    const pf = frac(P - 0.5 - (i === R ? 0.1 : 0));
    footCycle(pf, fDuty, lenF, 0.4, fc);
    o.plant[i] = gaitPlant(pf, fDuty);
    o.foot[i].set(0.36 * s, 0.2 + fc[1], -0.42 + fc[0]);
    o.footPitch[i] = fc[2];
    o.toes[i] = -fc[2] * 0.7;
    o.knee[i].set(0.3 * s, -0.2, 1);
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
    o.handGround[i] = 1;
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
  o.handGround[L] = 1;
  for (let i = 0; i < 2; i++) {
    o.foot[i].set(0.4 * SGN[i], 0.2, 0.0 + (i === L ? 0.15 : -0.1));
    o.knee[i].set(0.5 * SGN[i], 0, 1);
  }
  o.look = 0.85;
  o.lookPitch = 0.02;
  o.lookYaw = -0.1;
  o.jaw = 0.08 + 0.05 * (0.5 + 0.5 * br);
}

/** Heavy, hunched step-out: long slow strides (stride × frequency = speed), the knees stay bent under the
 * load, shoulders rolling over each planted foot, arms hanging low and swinging like dead weight. */
function emerge(o: PoseSample, _t: number, c: AnimCtx): void {
  biped(o, c, { hunch: 1.4, armSwing: 0.2, heavy: 1.35, slump: 0 });
  const amp = smooth(0.05, 0.8, c.speed);
  const P = c.phase;
  const sway = Math.sin(TAU * P);
  o.hips.y += -0.1 * amp;
  // the torso rolls over the stance side, the head pushes forward and scans
  o.add('spine2', 0, 0.05 * Math.cos(TAU * P) * amp, -0.05 * sway * amp);
  o.add('neck', 0.05, 0.06 * sway);
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    o.addSide('clav', i, 0, 0, -0.06 * s * amp);
    o.addSide('upperArm', i, -0.12, 0, 0.05 * s);
    o.foot[i].x += 0.04 * s;
  }
  o.lookPitch = -0.02;
  o.jaw = 0.12 + 0.05 * Math.sin(TAU * 0.4 * c.time);
}

/** Deliberate crouch-to-stand: the feet stay planted and the height comes from the legs and spine unfolding. */
function stand(o: PoseSample, t: number, c: AnimCtx): void {
  const u = smooth(0.05, 1.1, t);
  const puff = smooth(0.8, 1.2, t) * (1 - 0.6 * smooth(1.3, 2.2, t));
  posture(o, 1.4 * (1 - u) + 0.08);
  // starts from the emerge crouch (knees bent under the load) and pushes up through the legs first
  const legs = smooth(0.0, 0.75, t);
  o.hips.y += -0.2 * (1 - legs) + 0.02 * u;
  for (let i = 0; i < 2; i++) o.foot[i].x += 0.04 * SGN[i] * (1 - u);
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

/**
 * Leap: crouch → launch → a held pounce for the whole flight (no starfish): the torso is pitched toward the
 * landing, both arms reach forward and down with the claws spread (elbows bent, close to the body line), one
 * knee is drawn up under the chest and the other leg trails behind — a compact, asymmetric, readable silhouette
 * from the side and from behind. The pose holds until the game switches mode on landing.
 */
function leap(o: PoseSample, t: number, c: AnimCtx): void {
  const crouch = smooth(0, 0.22, t) * (1 - smooth(0.24, 0.38, t));
  const launch = smooth(0.22, 0.36, t) * (1 - smooth(0.42, 0.6, t));
  const air = smooth(0.3, 0.5, t);
  const br = Math.sin(TAU * 1.3 * c.time);
  posture(o, 1.0 + 0.5 * crouch - 0.6 * launch + 0.25 * air);
  o.hips.y += -0.42 * crouch + 0.08 * launch;
  // in flight the whole body pitches toward the landing (a pounce, chest leading, back long)
  o.add('hips', 0.42 * air);
  o.add('spine1', 0.1 * air);
  o.add('spine2', 0.15 * crouch - 0.05 * launch + 0.08 * air);
  o.add('spine3', 0.1 * crouch - 0.1 * launch);
  o.add('neck', -0.35 * air);
  o.add('head', -0.15 * air);
  const bindHipY = 1.42;
  const hipY = bindHipY + o.hips.y;
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    const lead = i === L;
    // feet: ground stance -> trailing push -> pounce (left knee drawn up, right leg trailing)
    const ground = new THREE.Vector3(0.36 * s, 0.2, 0.0);
    const push = new THREE.Vector3(0.3 * s, hipY - 1.3, -0.45);
    const pounce = lead
      ? new THREE.Vector3(0.32 * s, hipY - 0.55, 0.5)
      : new THREE.Vector3(0.3 * s, hipY - 0.8, -0.85);
    const p = ground.clone().lerp(push, launch * (1 - air * 0.5));
    p.lerp(pounce, air);
    o.foot[i].copy(p);
    o.plant[i] = 1 - smooth(0.25, 0.35, t);
    o.footPitch[i] = 0.7 * launch + (lead ? -0.35 : 0.6) * air;
    o.toes[i] = (lead ? 0.2 : -0.3) * air;
    o.knee[i].set(0.15 * s, lead ? 0.2 : -0.3, 1);
    // arms: swing back on the crouch (FK), then reach forward/down for the landing (IK), claws spread
    o.addSide('upperArm', i, 0.7 * crouch - 1.2 * launch * (1 - air));
    o.addSide('forearm', i, -0.3 * launch * (1 - air));
    o.armIK[i] = air;
    o.hand[i].set(0.42 * s, hipY + 0.05 + 0.05 * br * (lead ? 1 : -1), 1.45 + (lead ? 0.12 : 0));
    o.elbow[i].set(0.45 * s, -0.4, -0.8);
    o.handAim[i] = air;
    o.handDir[i].set(0.1 * s, -0.55, 1).normalize();
    o.palmDir[i].set(-0.2 * s, -1, 0.1).normalize();
    o.curl[i] = 0.2 + 0.3 * crouch + 0.25 * air;
    o.curl2[i] = 0.35 + 0.3 * air;
    o.thumb[i] = 0.2;
  }
  o.look = 0.85;
  o.lookPitch = 0.05 + 0.18 * air;
  o.jaw = 0.2 + 0.5 * launch + 0.55 * air;
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
  o.plant[L] = Math.sin(Math.PI * step) > 0.12 ? 0 : 1;
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

/**
 * Low all-fours prowl (lateral-sequence walk: hind L 0, fore L 0.25, hind R 0.5, fore R 0.75). Used for the
 * approach from deep inside the cave. Heavy: the pelvis sways over the supporting hind leg, the shoulder
 * blades roll up over each loaded hand, the head hangs low between the shoulders and scans.
 */
function crawl(o: PoseSample, _t: number, c: AnimCtx): void {
  const v = c.speed;
  const amp = smooth(0.03, 0.6, v);
  const P = c.phase;
  const br = Math.sin(TAU * 0.3 * c.time);
  const duty = CRAWL_DUTY;
  const len = Math.min(1.5, (v * duty) / Math.max(0.3, c.freq));
  o.hips.y += -0.46 + 0.012 * br;
  o.hips.z += -0.25;
  o.add('hips', 0.76);
  o.add('spine1', 0.3 + 0.015 * br);
  o.add('spine2', 0.2 + 0.02 * br);
  o.add('spine3', 0.04);
  o.add('neck', -0.18);
  o.add('head', -0.2);
  const S = Math.sin(TAU * P);
  // pelvis sways over the supporting hind leg and dips after each hind strike
  o.hips.x += 0.05 * S * amp;
  o.hips.y += -0.035 * amp * (0.5 + 0.5 * Math.cos(2 * TAU * (P - 0.1)));
  o.add('hips', 0, -0.07 * Math.cos(TAU * P) * amp, 0.05 * S * amp);
  // the chest rolls the other way, a quarter cycle later (fore limbs lead by 0.25)
  o.add('spine3', 0.02 * Math.cos(2 * TAU * (P - 0.35)) * amp, 0.09 * Math.cos(TAU * (P - 0.25)) * amp, -0.06 * Math.sin(TAU * (P - 0.25)) * amp);
  for (let i = 0; i < 2; i++) {
    const s = SGN[i];
    // hind feet
    const pf = frac(P + i * 0.5);
    footCycle(pf, duty, len, 0.16 * amp, fc);
    // hind feet under the hips (not splayed): the knees point forward/down under the belly, so the hind legs
    // read as legs in the silhouette instead of looping out sideways
    o.foot[i].set(0.33 * s, 0.2 + fc[1], -0.12 + fc[0]);
    o.footPitch[i] = fc[2] * 0.8;
    o.toes[i] = -fc[2] * 0.6;
    o.knee[i].set(0.2 * s, -0.3, 1);
    o.plant[i] = amp < 0.15 ? 1 : gaitPlant(pf, duty);
    // fore limbs: knuckle-walk
    const ph = frac(P - 0.25 - i * 0.5);
    footCycle(ph, duty, len, 0.2 * amp, fc);
    const sw = ph >= duty ? (ph - duty) / (1 - duty) : 0;
    const reach = Math.sin(Math.PI * sw);
    const load = ph < duty ? Math.sin((Math.PI * ph) / duty) : 0;
    o.armIK[i] = 1;
    o.hand[i].set(0.6 * s, 0.33 + fc[1], 1.1 + fc[0]);
    o.elbow[i].set(0.9 * s, 0.1, -1);
    o.handAim[i] = 1;
    o.handDir[i].set(0.05 * s, -1, 0.15 + 0.8 * reach).normalize();
    o.palmDir[i].set(-0.35 * s, 0, -1).normalize();
    o.curl[i] = 1.42 - 0.55 * reach;
    o.curl2[i] = 1.45 - 0.6 * reach;
    o.thumb[i] = 0.9;
    o.handGround[i] = 1;
    // shoulder blade rides up over the loaded arm, drops and rolls forward as it reaches
    o.addSide('clav', i, 0, -0.1 * s * reach * amp, (0.1 * load - 0.04 * reach) * s * amp);
  }
  // the head stays on the line of travel and only scans a little (±~10°)
  o.look = 0.85;
  o.lookPitch = -0.02;
  o.lookYaw = 0.12 * Math.sin(0.35 * c.time) + 0.04 * Math.sin(TAU * (P - 0.25)) * amp;
  o.jaw = 0.1 + 0.05 * (0.5 + 0.5 * br);
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
    case 'crawl':
      crawl(o, t, c);
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

export const GAIT_MODES: ReadonlySet<YetiMode> = new Set<YetiMode>(['walk', 'run', 'emerge', 'turnAway', 'crawl']);

/** Cross-fade duration (s) when switching from `from` to `to`. */
export function crossfadeTime(from: YetiMode, to: YetiMode): number {
  if (from === 'crawl' || to === 'crawl') return 0.9;
  if (from === 'emerge' && to === 'stand') return 0.6;
  if (from === 'grip' && to === 'emerge') return 0.6;
  if (from === 'lurk' || to === 'lurk') return 0.6;
  return 0.3;
}

/** Timing of the overarm snowball throw (seconds from its start). The ball leaves the hand at RELEASE. */
export const THROW = { windup: 0.42, release: 0.42, end: 1.0 } as const;

const _gh = new THREE.Vector3();
/**
 * Snowball throw layered over whatever the body is doing (the chase gallop): the right arm leaves
 * the ground, scoops the ball up behind the shoulder, whips over the top and follows through; the
 * chest twists into it and the head stays on the target. `t` is seconds since the throw began.
 */
export function applyThrow(o: PoseSample, t: number): void {
  if (!(t >= 0) || t > THROW.end) return;
  const w = smooth(0, 0.14, t) * (1 - smooth(0.72, THROW.end, t));
  if (w <= 0) return;
  const r = THROW.release;
  // hand path in root space (+z forward towards the skier, right side is -x)
  const back = { x: -0.78, y: 2.75, z: -0.75 };
  const top = { x: -0.62, y: 3.05, z: 0.35 };
  const fwd = { x: -0.42, y: 1.55, z: 1.45 };
  let hx: number, hy: number, hz: number;
  if (t < r) {
    const u = smooth(0, r, t);
    hx = back.x;
    hy = 1.2 + (back.y - 1.2) * u;
    hz = 0.6 + (back.z - 0.6) * u;
  } else if (t < r + 0.1) {
    const u = (t - r) / 0.1;
    hx = back.x + (top.x - back.x) * u;
    hy = back.y + (top.y - back.y) * u;
    hz = back.z + (top.z - back.z) * u;
  } else {
    const u = smooth(r + 0.1, r + 0.32, t);
    hx = top.x + (fwd.x - top.x) * u;
    hy = top.y + (fwd.y - top.y) * u;
    hz = top.z + (fwd.z - top.z) * u;
  }
  _gh.copy(o.hand[R]);
  const ik = o.armIK[R];
  if (ik < 1e-3) _gh.set(hx, hy, hz);
  o.hand[R].set(hx, hy, hz).lerp(_gh, 1 - w);
  o.armIK[R] = ik + (1 - ik) * w;
  o.handGround[R] *= 1 - w;
  o.curl[R] += (0.85 - o.curl[R]) * w;
  o.curl2[R] += (0.85 - o.curl2[R]) * w;
  // body: coil (twist right, lean back) then uncoil through the release
  const coil = t < r ? smooth(0, r, t) : 1 - smooth(r, r + 0.25, t);
  const whip = t < r ? 0 : Math.sin(Math.min(1, (t - r) / 0.35) * Math.PI);
  o.add('spine2', (-0.12 * coil + 0.22 * whip) * w, (-0.32 * coil + 0.28 * whip) * w, 0);
  o.add('spine3', (-0.08 * coil + 0.14 * whip) * w, (-0.2 * coil + 0.18 * whip) * w, 0);
  o.jaw = Math.max(o.jaw, 0.35 * whip * w);
}
