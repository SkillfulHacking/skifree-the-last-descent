/**
 * Pose solver: turns a PoseSample into bone local quaternions (model space FK + two-bone IK,
 * head stabilisation, foot/hand alignment, finger curls).
 */
import * as THREE from 'three';
import { L, R, type PoseSample } from './animation';
import { B, BONE_COUNT, PARENT_INDEX, armFrame, bindPositions, MOUTH_POS, HEAD_BONE_POS, JAW_BONE_POS } from './rig';

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _e = new THREE.Euler();

function basisQuat(primary: THREE.Vector3, secondary: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  _x.copy(primary).normalize();
  _z.crossVectors(_x, secondary);
  if (_z.lengthSq() < 1e-8) {
    _z.set(0, 0, 1).cross(_x);
    if (_z.lengthSq() < 1e-8) _z.set(1, 0, 0).cross(_x);
  }
  _z.normalize();
  _y.crossVectors(_z, _x);
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

interface Chain {
  a: number;
  b: number;
  c: number;
  la: number;
  lb: number;
  /** inverse bind basis for a and b */
  invA: THREE.Quaternion;
  invB: THREE.Quaternion;
}

export class PoseSolver {
  readonly bind: THREE.Vector3[];
  readonly bindLocal: THREE.Vector3[];
  readonly local: THREE.Quaternion[] = [];
  readonly mq: THREE.Quaternion[] = [];
  readonly mp: THREE.Vector3[] = [];
  readonly hipsOffset = new THREE.Vector3();
  /** total (thigh + shin) length of each leg */
  readonly legLen: number[];
  private legs: Chain[];
  private arms: Chain[];
  private handInv: THREE.Quaternion[];
  private curlAxis: THREE.Vector3[];
  private thumbAxis: THREE.Vector3[];
  private tq = new THREE.Quaternion();
  private tq2 = new THREE.Quaternion();
  private tv = new THREE.Vector3();
  private tv2 = new THREE.Vector3();
  private tv3 = new THREE.Vector3();

  constructor() {
    this.bind = bindPositions();
    this.bindLocal = this.bind.map((p, i) => {
      const pi = PARENT_INDEX[i];
      return pi < 0 ? p.clone() : p.clone().sub(this.bind[pi]);
    });
    for (let i = 0; i < BONE_COUNT; i++) {
      this.local.push(new THREE.Quaternion());
      this.mq.push(new THREE.Quaternion());
      this.mp.push(this.bind[i].clone());
    }
    const mk = (a: number, b: number, c: number, pole: THREE.Vector3): Chain => {
      const da = this.bind[b].clone().sub(this.bind[a]);
      const db = this.bind[c].clone().sub(this.bind[b]);
      return {
        a,
        b,
        c,
        la: da.length(),
        lb: db.length(),
        invA: basisQuat(da, pole, new THREE.Quaternion()).invert(),
        invB: basisQuat(db, pole, new THREE.Quaternion()).invert(),
      };
    };
    this.legs = [
      mk(B.thighL, B.shinL, B.footL, new THREE.Vector3(0, 0, 1)),
      mk(B.thighR, B.shinR, B.footR, new THREE.Vector3(0, 0, 1)),
    ];
    this.legLen = this.legs.map((c) => c.la + c.lb);
    this.arms = [
      mk(B.upperArmL, B.forearmL, B.handL, new THREE.Vector3(0, 0, -1)),
      mk(B.upperArmR, B.forearmR, B.handR, new THREE.Vector3(0, 0, -1)),
    ];
    this.handInv = [1, -1].map((s) => {
      const f = armFrame(s);
      return basisQuat(f.d, f.n, new THREE.Quaternion()).invert();
    });
    this.curlAxis = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1)];
    this.thumbAxis = [1, -1].map((s) => armFrame(s).d.clone().multiplyScalar(s).add(new THREE.Vector3(0, 0, -0.4)).normalize());
  }

  fk(): void {
    for (let i = 0; i < BONE_COUNT; i++) {
      const p = PARENT_INDEX[i];
      const off = i === B.hips ? this.tv3.copy(this.bindLocal[i]).add(this.hipsOffset) : this.bindLocal[i];
      if (p < 0) {
        this.mq[i].copy(this.local[i]);
        this.mp[i].copy(off);
      } else {
        this.mq[i].multiplyQuaternions(this.mq[p], this.local[i]);
        this.mp[i].copy(off).applyQuaternion(this.mq[p]).add(this.mp[p]);
      }
    }
  }

  /** model-space position of a bind-space point rigidly attached to bone i */
  pointOn(i: number, bindPoint: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(bindPoint).sub(this.bind[i]).applyQuaternion(this.mq[i]).add(this.mp[i]);
  }

  mouth(out: THREE.Vector3): THREE.Vector3 {
    this.pointOn(B.head, MOUTH_POS, out);
    this.pointOn(B.jaw, MOUTH_POS, this.tv);
    return out.add(this.tv).multiplyScalar(0.5);
  }

  private setLocalFromModel(i: number, modelQ: THREE.Quaternion, weight: number): void {
    const p = PARENT_INDEX[i];
    this.tq.copy(this.mq[p]).invert().multiply(modelQ);
    if (weight >= 0.999) this.local[i].copy(this.tq);
    else this.local[i].slerp(this.tq, weight);
  }

  /** Re-solve arm k (0 = L) so its wrist reaches `target` (model space), elbow toward `pole`. */
  solveArm(k: number, target: THREE.Vector3, pole: THREE.Vector3): void {
    this.solveChain(this.arms[k], target, pole, 1);
  }

  private solveChain(ch: Chain, target: THREE.Vector3, pole: THREE.Vector3, weight: number): void {
    if (weight <= 1e-3) return;
    const pA = this.mp[ch.a];
    const dir = this.tv.copy(target).sub(pA);
    let d = dir.length();
    const maxD = (ch.la + ch.lb) * 0.999;
    const minD = Math.abs(ch.la - ch.lb) + 0.02;
    d = Math.min(maxD, Math.max(minD, d));
    dir.normalize();
    const yv = this.tv2.copy(pole).addScaledVector(dir, -pole.dot(dir));
    if (yv.lengthSq() < 1e-6) yv.set(0, 0, 1).addScaledVector(dir, -dir.z);
    yv.normalize();
    const cosA = Math.min(1, Math.max(-1, (ch.la * ch.la + d * d - ch.lb * ch.lb) / (2 * ch.la * d)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    const knee = new THREE.Vector3().copy(pA).addScaledVector(dir, ch.la * cosA).addScaledVector(yv, ch.la * sinA);
    const end = new THREE.Vector3().copy(pA).addScaledVector(dir, d);
    const qa = basisQuat(knee.clone().sub(pA), yv, new THREE.Quaternion()).multiply(ch.invA);
    const qb = basisQuat(end.clone().sub(knee), yv, new THREE.Quaternion()).multiply(ch.invB);
    this.setLocalFromModel(ch.a, qa, weight);
    this.fk();
    this.setLocalFromModel(ch.b, qb, weight);
    this.fk();
  }

  /** Full solve without terrain adaptation (flat ground at y = 0). */
  apply(s: PoseSample): void {
    this.applyFK(s);
    this.solveRest(s, null);
  }

  /** Step 1: forward kinematics from the sample's euler offsets and hips offset. */
  applyFK(s: PoseSample): void {
    // 1. FK from eulers
    for (let i = 0; i < BONE_COUNT; i++) {
      _e.set(s.rot[i * 3], s.rot[i * 3 + 1], s.rot[i * 3 + 2], 'XYZ');
      this.local[i].setFromEuler(_e);
    }
    this.local[B.jaw].setFromAxisAngle(_x.set(1, 0, 0), s.jaw);
    for (let k = 0; k < 2; k++) {
      const sfx = k === L ? 'L' : 'R';
      const f1 = sfx === 'L' ? B.fingersL : B.fingersR;
      const f2 = sfx === 'L' ? B.fingers2L : B.fingers2R;
      const th = sfx === 'L' ? B.thumbL : B.thumbR;
      this.local[f1].setFromAxisAngle(this.curlAxis[k], s.curl[k]);
      this.local[f2].setFromAxisAngle(this.curlAxis[k], s.curl2[k]);
      this.local[th].setFromAxisAngle(this.thumbAxis[k], s.thumb[k] * 0.9);
    }
    this.hipsOffset.copy(s.hips);
    this.fk();
  }

  /**
   * Steps 2–4: head look, leg IK and arm IK. `feet` (optional) overrides the leg IK targets with terrain-adapted
   * ankle positions and model-space foot orientations.
   */
  solveRest(s: PoseSample, feet: { ankle: THREE.Vector3[]; q: THREE.Quaternion[] } | null): void {
    // 2. head stabilisation / look
    if (s.look > 1e-3) {
      _e.set(s.lookPitch, s.lookYaw, s.lookRoll, 'YXZ');
      const qd = new THREE.Quaternion().setFromEuler(_e);
      const corr = qd.clone().multiply(this.tq2.copy(this.mq[B.head]).invert());
      const neckM = new THREE.Quaternion().slerp(corr, 0.45).multiply(this.mq[B.neck]);
      this.setLocalFromModel(B.neck, neckM, s.look);
      this.fk();
      this.setLocalFromModel(B.head, qd, s.look);
      this.fk();
    }

    // 3. legs (always IK) + foot alignment
    for (let k = 0; k < 2; k++) {
      const ch = this.legs[k];
      this.solveChain(ch, feet ? feet.ankle[k] : s.foot[k], s.knee[k], 1);
      if (feet) this.setLocalFromModel(ch.c, feet.q[k], 1);
      else {
        _e.set(s.footPitch[k], s.footYaw[k], 0, 'YXZ');
        this.setLocalFromModel(ch.c, this.tq2.setFromEuler(_e), 1);
      }
      const toes = k === L ? B.toesL : B.toesR;
      this.local[toes].setFromAxisAngle(_x.set(1, 0, 0), s.toes[k]);
    }
    this.fk();

    // 4. arms IK (with optional hand-to-mouth target) + hand aim
    for (let k = 0; k < 2; k++) {
      const w = s.armIK[k];
      if (w <= 1e-3) continue;
      const ch = this.arms[k];
      const target = this.tv3.copy(s.hand[k]);
      if (s.mouthHand[k] > 1e-3) {
        const m = this.mouth(new THREE.Vector3()).add(s.mouthOff[k]);
        target.lerp(m, s.mouthHand[k]);
      }
      this.solveChain(ch, target.clone(), s.elbow[k], w);
      if (s.handAim[k] > 1e-3) {
        const hq = basisQuat(s.handDir[k], s.palmDir[k], new THREE.Quaternion()).multiply(this.handInv[k]);
        this.setLocalFromModel(ch.c, hq, s.handAim[k]);
        this.fk();
      }
    }
  }
}

export const HEAD_BIND = HEAD_BONE_POS;
export const JAW_BIND = JAW_BONE_POS;
export { L, R };
