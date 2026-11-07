/**
 * Terrain grounding for the Yeti.
 *
 * Contract: the game places `root` ON the ground (y = ground height at the root XZ) with a yaw-only rotation
 * (unit scale). Animation is authored for flat ground at model y = 0; this pass adapts it to the sampled
 * terrain every frame:
 *  - foot locking: a planted sole stays fixed in world XZ; if the authored foot drifts too far from its lock
 *    (turning on the spot, stopping, a mode change) the foot takes a short corrective step;
 *  - feet are aligned to the local slope and placed so the lowest sole probe touches the ground
 *    (no penetration, no floating of a planted foot), swing feet keep their authored lift above the terrain;
 *  - pelvis adaptation: the hips sink to the lower foot (the uphill knee bends rather than the downhill leg
 *    over-stretching), roll slightly toward the downhill side and drop further whenever a leg cannot reach;
 *  - knuckle-walking hands follow the terrain.
 * All filtered state snaps when the root teleports or on the first update, so the first visible frame is correct.
 */
import * as THREE from 'three';
import type { PoseSample } from './animation';
import type { PoseSolver } from './pose';
import { B, armFrame } from './rig';

const FINGER_TIP = [armFrame(1).d.clone().multiplyScalar(0.13), armFrame(-1).d.clone().multiplyScalar(0.13)];
const HAND_CLEARANCE = 0.03;

export type GroundSampler = (x: number, z: number) => number;

const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const SGN = [1, -1];
const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Sole centre relative to the ankle (foot frame). */
export const SOLE_CENTER = V(0, -0.2, 0.09);
/** Sole probes relative to the ankle (foot frame, x mirrored per side): heel, ball inner, ball outer, centre. */
const PROBES = [V(0, -0.2, -0.075), V(-0.075, -0.194, 0.23), V(0.075, -0.194, 0.23), V(0, -0.2, 0.09)];
/** Toe pivot relative to the ankle (x mirrored) and the toe-tip sole point relative to the pivot. */
const TOE_PIVOT = V(0.01, -0.14, 0.27);
const TOE_TIP = V(0, -0.055, 0.135);
export const PROBE_COUNT = PROBES.length + 1;
/** rolling pivots (foot frame, relative to the ankle): the heel at heel-strike, the ball at toe-off */
const BALL = V(0, -0.196, 0.23);
const HEEL = V(0, -0.2, -0.075);

/** default drift (m) of the authored foot from its lock before a corrective step */
const STEP_THRESHOLD = 0.15;
const STEP_TIME = 0.34;
const MAX_SLOPE = 0.6;
const UP = V(0, 1, 0);

interface FootState {
  locked: boolean;
  lx: number;
  lz: number;
  stepping: boolean;
  st: number;
  sx: number;
  sz: number;
  /** residual world offset carried from the lock into the swing, decays to 0 */
  ox: number;
  oz: number;
  lockAge: number;
  /** authored lift when the lock began: a locked foot settles onto the ground over ~0.12 s */
  lockLift: number;
  /** authored-vs-lock offset when the lock (re)started: drift is measured relative to it */
  ex: number;
  ez: number;
}

export class Grounding {
  sampler: GroundSampler | null = null;
  /** outputs for the leg IK (model space) */
  readonly ankle = [V(0, 0, 0), V(0, 0, 0)];
  readonly q = [new THREE.Quaternion(), new THREE.Quaternion()];
  /** effective plant 0..1 after locking / corrective steps */
  readonly plant = [1, 1];
  /** 0 while the root is airborne (well above the ground), else 1 */
  weight = 1;
  /** fired when a foot plants (lock begins) */
  onPlant: ((foot: number) => void) | null = null;
  debug = false;
  /** drift (m) of the authored foot from its lock that triggers a corrective step (larger when standing still) */
  stepThreshold = STEP_THRESHOLD;
  /** debug: model-space ground samples under each probe [foot][probe] */
  readonly dbgGround: THREE.Vector3[][] = [[], []];

  private feet: FootState[] = [0, 1].map(() => ({ locked: false, lx: 0, lz: 0, stepping: false, st: 0, sx: 0, sz: 0, ox: 0, oz: 0, lockAge: 0, lockLift: 0, ex: 0, ez: 0 }));
  private e: ArrayLike<number> = new THREE.Matrix4().elements;
  private base = 0;
  private roll = 0;
  private lift = [0, 0];
  private tx = [0, 0];
  private tz = [0, 0];
  private gS = [0, 0];
  private qa = [new THREE.Quaternion(), new THREE.Quaternion()];
  /** current rolling pivot of each foot (foot frame) */
  private pv = [V(0, 0, 0), V(0, 0, 0)];
  private v1 = V(0, 0, 0);
  private v2 = V(0, 0, 0);
  private v3 = V(0, 0, 0);
  private qs = new THREE.Quaternion();
  private qt = new THREE.Quaternion();
  private eul = new THREE.Euler();
  private w2: [number, number] = [0, 0];

  constructor() {
    for (let f = 0; f < 2; f++) for (let k = 0; k < PROBE_COUNT; k++) this.dbgGround[f].push(V(0, 0, 0));
  }

  /** ground height in model space under model-space (x, z) */
  gm(x: number, z: number): number {
    const e = this.e;
    const wx = e[0] * x + e[8] * z + e[12];
    const wz = e[2] * x + e[10] * z + e[14];
    return (this.sampler ? this.sampler(wx, wz) : e[13]) - e[13];
  }

  private toWorld(x: number, z: number): [number, number] {
    const e = this.e;
    this.w2[0] = e[0] * x + e[8] * z + e[12];
    this.w2[1] = e[2] * x + e[10] * z + e[14];
    return this.w2;
  }

  /** world XZ → model XZ (yaw-only root) */
  private toModel(wx: number, wz: number): [number, number] {
    const e = this.e;
    const dx = wx - e[12];
    const dz = wz - e[14];
    this.w2[0] = e[0] * dx + e[2] * dz;
    this.w2[1] = e[8] * dx + e[10] * dz;
    return this.w2;
  }

  /**
   * Before FK: foot locks / corrective steps, pelvis base height & roll (written into the sample),
   * knuckle heights. `snap` resets all temporal state (teleport, first frame).
   */
  prepare(s: PoseSample, rootMatrix: THREE.Matrix4, dt: number, snap: boolean, rebase = false): void {
    this.e = rootMatrix.elements;
    const rootG = this.gm(0, 0);
    this.weight = 1 - smooth(0.15, 0.5, -rootG);
    const w = this.weight;
    for (let i = 0; i < 2; i++) {
      const F = this.feet[i];
      const qa = this.qa[i];
      this.eul.set(s.footPitch[i], s.footYaw[i], 0, 'YXZ');
      qa.setFromEuler(this.eul);
      // the foot rolls over a pivot that moves heel -> centre -> ball; the lock holds the *flat* sole centre so
      // that whichever part of the sole bears weight stays fixed in the world while the heel peels off
      const pitch = s.footPitch[i];
      const pv = this.pv[i].copy(SOLE_CENTER).lerp(BALL, smooth(0.03, 0.3, pitch)).lerp(HEEL, smooth(0.03, 0.3, -pitch));
      const S = this.v1.copy(pv).applyQuaternion(qa).add(s.foot[i]);
      this.lift[i] = S.y;
      const fx = Math.sin(s.footYaw[i]);
      const fz = Math.cos(s.footYaw[i]);
      const dz = pv.z - SOLE_CENTER.z;
      const [wx, wz] = this.toWorld(S.x - fx * dz, S.z - fz * dz);
      const p = s.plant[i] * w;
      let tx = wx;
      let tz = wz;
      let stepLift = 0;
      const lift0 = Math.max(0, S.y);
      if (snap || w < 0.05) {
        F.lockLift = 0;
        F.ex = 0;
        F.ez = 0;
        F.locked = p > 0.5;
        F.lx = wx;
        F.lz = wz;
        F.stepping = false;
        F.ox = 0;
        F.oz = 0;
        F.lockAge = 0;
      } else if (F.stepping) {
        F.st = Math.min(1, F.st + dt / STEP_TIME);
        const k = F.st * F.st * (3 - 2 * F.st);
        tx = F.sx + (wx - F.sx) * k;
        tz = F.sz + (wz - F.sz) * k;
        const dist = Math.hypot(wx - F.sx, wz - F.sz);
        stepLift = (0.04 + 0.14 * Math.min(1, dist / 0.35)) * Math.sin(Math.PI * F.st);
        if (F.st >= 1) {
          F.stepping = false;
          F.locked = p > 0.5;
          F.lx = wx;
          F.lz = wz;
          F.lockAge = 0;
          F.lockLift = lift0;
          F.ex = 0;
          F.ez = 0;
          if (F.locked) this.onPlant?.(i);
        }
      } else if (p > 0.5 && (F.locked || lift0 < 0.015)) {
        if (!F.locked) {
          F.locked = true;
          F.lx = wx + F.ox;
          F.lz = wz + F.oz;
          F.ox = 0;
          F.oz = 0;
          F.lockAge = 0;
          F.lockLift = lift0;
          F.ex = F.lx - wx;
          F.ez = F.lz - wz;
          this.onPlant?.(i);
        }
        if (rebase) {
          // a new gait starts: the foot stays where it is, drift is measured from here
          F.ex = F.lx - wx;
          F.ez = F.lz - wz;
        }
        F.lockAge += dt;
        const err = Math.hypot(F.lx - wx - F.ex, F.lz - wz - F.ez);
        const O = this.feet[1 - i];
        const otherSupports = O.locked && !O.stepping;
        if (err > this.stepThreshold && otherSupports && F.lockAge > 0.08) {
          // corrective step (only one foot at a time, the other must be bearing weight)
          F.stepping = true;
          F.locked = false;
          F.st = 0;
          F.sx = F.lx;
          F.sz = F.lz;
        } else if (err > 0.75) {
          // cannot step (no support): let the foot drag rather than stretch the leg
          const k = 1 - Math.exp(-dt * 6);
          F.lx += (wx - F.lx) * k;
          F.lz += (wz - F.lz) * k;
        }
        if (!F.stepping) {
          tx = F.lx;
          tz = F.lz;
        } else {
          tx = F.sx;
          tz = F.sz;
        }
      } else {
        if (F.locked) {
          F.locked = false;
          F.ox = F.lx - wx;
          F.oz = F.lz - wz;
        }
        const k = Math.exp(-dt * 9);
        F.ox *= k;
        F.oz *= k;
        tx = wx + F.ox;
        tz = wz + F.oz;
      }
      const [mx, mz] = this.toModel(tx, tz);
      this.tx[i] = mx + fx * dz;
      this.tz[i] = mz + fz * dz;
      // a weight-bearing foot rests on the ground (blends may still carry some authored lift)
      if (F.locked && !F.stepping) this.lift[i] = Math.min(this.lift[i], F.lockLift * Math.max(0, 1 - F.lockAge / 0.12));
      this.lift[i] += stepLift;
      this.plant[i] = F.stepping ? 0 : F.locked ? 1 : p;
      this.gS[i] = this.gm(mx, mz) * w;
    }
    // pelvis: sink to the lower foot (uphill knee bends), roll a little toward the downhill side
    const baseT = clamp(Math.min(this.gS[0], this.gS[1]), -0.6, 0.3);
    const rollT = clamp(Math.atan2(this.gS[0] - this.gS[1], 0.7) * 0.45, -0.12, 0.12);
    const k = snap ? 1 : 1 - Math.exp(-dt * 10);
    this.base += (baseT - this.base) * k;
    this.roll += (rollT - this.roll) * k;
    s.hips.y += this.base;
    s.add('hips', 0, 0, this.roll);
    s.add('spine1', 0, 0, -this.roll * 0.8);
    // knuckle-walking hands follow the terrain
    for (let i = 0; i < 2; i++) {
      const hg = s.handGround[i] * s.armIK[i] * w;
      if (hg > 1e-3) s.hand[i].y += this.gm(s.hand[i].x, s.hand[i].z) * hg;
    }
  }

  /** After FK: slope-aligned foot orientation, sole-contact correction and pelvis reach drop. */
  finish(s: PoseSample, solver: PoseSolver): void {
    const w = this.weight;
    for (let i = 0; i < 2; i++) {
      const sx = SGN[i];
      const qa = this.qa[i];
      const x = this.tx[i];
      const z = this.tz[i];
      // local ground plane from 4 samples around the sole centre, in the foot's heading frame
      const fwd = this.v1.set(0, 0, 1).applyQuaternion(qa);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
      fwd.normalize();
      const rx = fwd.z;
      const rz = -fwd.x;
      const gF = this.gm(x + fwd.x * 0.16, z + fwd.z * 0.16);
      const gB = this.gm(x - fwd.x * 0.16, z - fwd.z * 0.16);
      const gR = this.gm(x + rx * 0.09, z + rz * 0.09);
      const gL = this.gm(x - rx * 0.09, z - rz * 0.09);
      const dF = (gF - gB) / 0.32;
      const dR = (gR - gL) / 0.18;
      const n = this.v2.set(-dF * fwd.x - dR * rx, 1, -dF * fwd.z - dR * rz).normalize();
      const pe = this.plant[i];
      const a = w * (0.35 + 0.65 * pe);
      const ang = Math.acos(clamp(n.y, -1, 1));
      this.qs.setFromUnitVectors(UP, n);
      const scale = (ang > MAX_SLOPE ? MAX_SLOPE / ang : 1) * a;
      this.qt.identity().slerp(this.qs, scale);
      const q = this.q[i].copy(this.qt).multiply(qa);
      // rolling pivot on the ground (+ authored lift), ankle derived from it
      const gC = this.gm(x, z) * w;
      const A = this.ankle[i];
      A.set(x, gC + this.lift[i], z).sub(this.v3.copy(this.pv[i]).applyQuaternion(q));
      // probe the sole: never below the ground; a planted foot rests on its lowest probe
      let minD = Infinity;
      for (let k = 0; k < PROBE_COUNT; k++) {
        const P = this.probe(i, k, A, q, s.toes[i], this.v3);
        const g = this.gm(P.x, P.z) * w;
        if (this.debug) this.dbgGround[i][k].set(P.x, g, P.z);
        minD = Math.min(minD, P.y - g);
      }
      const pen = Math.max(0, -minD);
      const full = clamp((pe - 0.5) * 2, 0, 1) * (1 - smooth(0.01, 0.05, this.lift[i]));
      A.y += pen + full * (-minD - pen);
      void sx;
    }
    // reach: lower the pelvis whenever a leg cannot reach its target
    let drop = 0;
    for (let i = 0; i < 2; i++) {
      const H = solver.mp[i === 0 ? B.thighL : B.thighR];
      const A = this.ankle[i];
      const R = solver.legLen[i] * 0.985;
      const dx = H.x - A.x;
      const dz = H.z - A.z;
      const h2 = dx * dx + dz * dz;
      const vy = H.y - A.y;
      const d = h2 < R * R ? vy - Math.sqrt(R * R - h2) : vy;
      // only a weight-bearing leg pulls the pelvis down (a trailing swing leg may simply not reach)
      drop = Math.max(drop, d * clamp((this.plant[i] - 0.3) / 0.6, 0, 1));
    }
    drop = Math.min(drop, 0.55) * w;
    if (drop > 1e-4) {
      solver.hipsOffset.y -= drop;
      solver.fk();
    }
  }

  /** After the full solve: no hand / claw may sink into the terrain (FK arms dragging on a downhill slope). */
  post(s: PoseSample, solver: PoseSolver): void {
    if (this.weight < 0.05) return;
    for (let i = 0; i < 2; i++) {
      const f2 = i === 0 ? B.fingers2L : B.fingers2R;
      const f1 = i === 0 ? B.fingersL : B.fingersR;
      const tip = this.v3.copy(FINGER_TIP[i]).applyQuaternion(solver.mq[f2]).add(solver.mp[f2]);
      let c = tip.y - this.gm(tip.x, tip.z) * this.weight;
      const k1 = solver.mp[f1];
      c = Math.min(c, k1.y - 0.035 - this.gm(k1.x, k1.z) * this.weight);
      if (c >= HAND_CLEARANCE) continue;
      const wrist = solver.mp[i === 0 ? B.handL : B.handR];
      this.v1.copy(wrist);
      this.v1.y += HAND_CLEARANCE - c;
      solver.solveArm(i, this.v1, s.elbow[i]);
    }
  }

  /** model-space position of sole probe k of foot i for ankle A / foot orientation q / toe angle */
  probe(i: number, k: number, A: THREE.Vector3, q: THREE.Quaternion, toes: number, out: THREE.Vector3): THREE.Vector3 {
    const sx = SGN[i];
    if (k < PROBES.length) {
      const p = PROBES[k];
      return out.set(p.x * sx, p.y, p.z).applyQuaternion(q).add(A);
    }
    // toe tip on the toes bone
    const c = Math.cos(toes);
    const sn = Math.sin(toes);
    out.set(TOE_TIP.x, TOE_TIP.y * c - TOE_TIP.z * sn, TOE_TIP.y * sn + TOE_TIP.z * c);
    out.add(TOE_PIVOT).setX(out.x + (TOE_PIVOT.x * sx - TOE_PIVOT.x));
    return out.applyQuaternion(q).add(A);
  }

  /**
   * Actual sole contact of foot i from the solved skeleton: the probe lowest relative to the ground
   * (model space). Returns its clearance above the ground (m).
   */
  contact(i: number, solver: PoseSolver, out: THREE.Vector3): number {
    const foot = i === 0 ? B.footL : B.footR;
    const toes = i === 0 ? B.toesL : B.toesR;
    const sx = SGN[i];
    let best = Infinity;
    const P = this.v3;
    for (let k = 0; k < PROBE_COUNT; k++) {
      if (k < PROBES.length) {
        const p = PROBES[k];
        P.set(p.x * sx, p.y, p.z).applyQuaternion(solver.mq[foot]).add(solver.mp[foot]);
      } else P.copy(TOE_TIP).applyQuaternion(solver.mq[toes]).add(solver.mp[toes]);
      const d = P.y - this.gm(P.x, P.z);
      if (d < best) {
        best = d;
        out.copy(P);
      }
    }
    return best;
  }

  /** Tests: model-space positions of all sole probes of foot i from the solved skeleton. */
  probesSolved(i: number, solver: PoseSolver, out: THREE.Vector3[]): void {
    const foot = i === 0 ? B.footL : B.footR;
    const toes = i === 0 ? B.toesL : B.toesR;
    const sx = SGN[i];
    for (let k = 0; k < PROBE_COUNT; k++) {
      if (k < PROBES.length) {
        const p = PROBES[k];
        out[k].set(p.x * sx, p.y, p.z).applyQuaternion(solver.mq[foot]).add(solver.mp[foot]);
      } else out[k].copy(TOE_TIP).applyQuaternion(solver.mq[toes]).add(solver.mp[toes]);
    }
  }

  /** debug: lock state */
  isLocked(i: number): boolean {
    return this.feet[i].locked && !this.feet[i].stepping;
  }
  isStepping(i: number): boolean {
    return this.feet[i].stepping;
  }
}
