import * as THREE from 'three';
import { DIM, sideSign } from './rig';
import { clamp, lerp, quatFromRotVec, quatYXZ, smoothstep } from './math';

/**
 * A complete target pose in "body space" (bodyRoot local; equals model root space unless the
 * whole body is being tumbled). Arms and legs are described by IK targets.
 */
export class PoseSpec {
  bodyPos = new THREE.Vector3();
  bodyQuat = new THREE.Quaternion();
  pelvisPos = new THREE.Vector3();
  pelvisQuat = new THREE.Quaternion();
  spine = new THREE.Quaternion();
  chest = new THREE.Quaternion();
  neck = new THREE.Quaternion();
  head = new THREE.Quaternion();
  clav: [THREE.Quaternion, THREE.Quaternion] = [new THREE.Quaternion(), new THREE.Quaternion()];
  /** wrist targets */
  hand: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  elbowPole: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  /** pole shaft direction (grip → tip) */
  poleDir: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  poleSlide: [number, number] = [0, 0];
  ankle: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  foot: [THREE.Quaternion, THREE.Quaternion] = [new THREE.Quaternion(), new THREE.Quaternion()];
  kneePole: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];

  blend(a: PoseSpec, b: PoseSpec, t: number): this {
    this.bodyPos.lerpVectors(a.bodyPos, b.bodyPos, t);
    this.bodyQuat.slerpQuaternions(a.bodyQuat, b.bodyQuat, t);
    this.pelvisPos.lerpVectors(a.pelvisPos, b.pelvisPos, t);
    this.pelvisQuat.slerpQuaternions(a.pelvisQuat, b.pelvisQuat, t);
    this.spine.slerpQuaternions(a.spine, b.spine, t);
    this.chest.slerpQuaternions(a.chest, b.chest, t);
    this.neck.slerpQuaternions(a.neck, b.neck, t);
    this.head.slerpQuaternions(a.head, b.head, t);
    for (let i = 0; i < 2; i++) {
      this.clav[i].slerpQuaternions(a.clav[i], b.clav[i], t);
      this.hand[i].lerpVectors(a.hand[i], b.hand[i], t);
      this.elbowPole[i].lerpVectors(a.elbowPole[i], b.elbowPole[i], t).normalize();
      this.poleDir[i].lerpVectors(a.poleDir[i], b.poleDir[i], t).normalize();
      this.poleSlide[i] = lerp(a.poleSlide[i], b.poleSlide[i], t);
      this.ankle[i].lerpVectors(a.ankle[i], b.ankle[i], t);
      this.foot[i].slerpQuaternions(a.foot[i], b.foot[i], t);
      this.kneePole[i].lerpVectors(a.kneePole[i], b.kneePole[i], t).normalize();
    }
    return this;
  }
}

/** Internally smoothed drivers. */
export interface SmoothedPose {
  steer: number;
  lean: number;
  tuck: number;
  pizza: number;
  drift: number;
  driftAngle: number;
  crouch: number;
  air: number;
  airTime: number;
  land: number;
  crashW: number;
  crashTime: number;
  crashSide: number;
  speed: number;
  lookBack: number;
  celebrate: number;
  wobble: number;
  time: number;
}

// scratch
const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const qIncl = new THREE.Quaternion();
const qI = new THREE.Quaternion();
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
const chestP = new THREE.Vector3();
const chestQ = new THREE.Quaternion();
const shoulder = new THREE.Vector3();
const base = [new THREE.Vector3(), new THREE.Vector3()];
const UP = new THREE.Vector3(0, 1, 0);

/** FK of the spine chain of a spec → chest bone transform in body space. */
function chestFrame(s: PoseSpec): void {
  chestQ.copy(s.pelvisQuat).multiply(s.spine);
  chestP.copy(s.pelvisPos).add(vA.set(0, DIM.SPINE_Y, 0).applyQuaternion(s.pelvisQuat));
  chestP.add(vA.set(0, DIM.CHEST_Y, 0).applyQuaternion(chestQ));
  chestQ.multiply(s.chest);
}
function shoulderOf(i: number, out: THREE.Vector3): THREE.Vector3 {
  const sg = sideSign(i);
  return out
    .set(sg * (DIM.CLAV_X + DIM.SHOULDER_X), DIM.CLAV_Y + DIM.SHOULDER_Y, DIM.CLAV_Z)
    .applyQuaternion(chestQ)
    .add(chestP);
}
/** chest-frame offset from shoulder → body-space wrist target */
function handFromChest(i: number, x: number, y: number, z: number, out: THREE.Vector3): void {
  shoulderOf(i, shoulder);
  out.set(x, y, z).applyQuaternion(chestQ).add(shoulder);
}

const hipOff = (i: number, out: THREE.Vector3): THREE.Vector3 => out.set(sideSign(i) * DIM.HIP_X, DIM.HIP_Y, 0);

/** Keep hips within reach of the ankle targets by pulling the pelvis toward the feet. */
function clampReach(s: PoseSpec): void {
  const maxR = (DIM.THIGH + DIM.SHIN) * 0.985;
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < 2; i++) {
      const h = hipOff(i, vA).applyQuaternion(s.pelvisQuat).add(s.pelvisPos);
      const d = vB.subVectors(s.ankle[i], h);
      const L = d.length();
      if (L > maxR) s.pelvisPos.addScaledVector(d, (L - maxR) / L);
    }
  }
}

// ---------------------------------------------------------------------------------------------

type V3 = [number, number, number];
function mix3(out: V3, b: V3, t: number): V3 {
  out[0] += (b[0] - out[0]) * t;
  out[1] += (b[1] - out[1]) * t;
  out[2] += (b[2] - out[2]) * t;
  return out;
}

/** The regular (not crashed) skiing pose. */
export function buildActivePose(st: SmoothedPose, out: PoseSpec): void {
  const { tuck, pizza: pz, drift: dr, crouch: cr, air, land, celebrate: cel, wobble: wob } = st;
  const lean = st.lean;
  const steer = st.steer;
  const t = st.time;
  const psi = st.driftAngle * dr;
  const breathe = Math.sin(t * 1.7);
  const leanN = clamp(lean / 0.55, -1, 1);
  const grounded = 1 - air;

  // body inclination (rotation vector in body space) about the snow contact
  const wobSway = Math.sin(t * 7.3) * 0.07 * wob;
  const inclX = -0.36 * dr * grounded;
  const inclZ = lean * (1 - 0.2 * tuck) + wobSway;
  quatFromRotVec(inclX, 0, inclZ, qIncl);

  // ---- skis / feet ----
  const halfW = 0.118 + pz * 0.125 + dr * 0.035 - tuck * 0.018 - air * 0.01;
  const cpsi = Math.cos(psi);
  const spsi = Math.sin(psi);
  for (let i = 0; i < 2; i++) {
    const sg = sideSign(i);
    const insideAmt = Math.max(0, -sg * leanN); // lean>0 (right turn) → right ski (sg=-1) inside
    const outsideAmt = Math.max(0, sg * leanN);
    const fwd = 0.1 * insideAmt - 0.03 * outsideAmt + 0.02 * dr * sg * Math.sign(psi);
    const lx = sg * halfW;
    const x = lx * cpsi + fwd * spsi;
    const z = -lx * spsi + fwd * cpsi;
    const yaw = psi - sg * pz * 0.23;
    // edge angle = inclination projected on the ski's long axis, plus inner-edging in pizza
    const roll = clamp(inclZ * Math.cos(yaw) + inclX * Math.sin(yaw), -1.1, 1.1) * grounded + sg * pz * 0.2;
    const pitch = -0.13 * air;
    quatYXZ(yaw, pitch, roll, out.foot[i]);
    const lift = 0.05 * Math.abs(Math.sin(roll)) + air * 0.12;
    base[i].set(x, lift, z);
    out.ankle[i].set(0, DIM.ANKLE_H, 0).applyQuaternion(out.foot[i]).add(base[i]);
    // knees track forward along the travel/drift heading; slightly inward when snowplouging
    out.kneePole[i].set(sg * (0.07 - 0.1 * pz), 0.05, 1).applyAxisAngle(UP, psi).normalize();
  }

  // ---- pelvis ----
  const h = 0.865 - cr * 0.17 - tuck * 0.27 - land * 0.2 - air * 0.05 - pz * 0.03 - dr * 0.07 + cel * 0.07 + breathe * 0.003 - wob * 0.05;
  const zp = -0.07 - tuck * 0.16 - pz * 0.05 - cr * 0.05 + cel * 0.05 - land * 0.03;
  vA.set(0, h, zp).applyAxisAngle(UP, psi * 0.6).applyQuaternion(qIncl);
  out.pelvisPos.set((base[0].x + base[1].x) / 2, 0, (base[0].z + base[1].z) / 2).add(vA);
  const pelvisPitch = 0.2 + tuck * 0.6 + cr * 0.2 + land * 0.18 + pz * 0.05 - cel * 0.16 + air * 0.06;
  qA.slerpQuaternions(qI, qIncl, 0.8);
  quatYXZ(psi * 0.85 + steer * 0.04, pelvisPitch, 0, qB);
  out.pelvisQuat.copy(qA).multiply(qB);
  clampReach(out);

  // ---- spine chain ----
  const counterYaw = steer * 0.22 - psi * 0.72;
  const lb = st.lookBack;
  const wobRoll = Math.sin(t * 8.1) * 0.16 * wob;
  const spP = 0.1 + tuck * 0.5 + cr * 0.08 - cel * 0.1 + Math.sin(t * 6.3) * 0.08 * wob;
  const chP = 0.07 + tuck * 0.4 + breathe * 0.012 - cel * 0.12 - air * 0.06;
  quatYXZ(counterYaw * 0.4 + lb * 0.12, spP, -lean * 0.25 + wobRoll, out.spine);
  quatYXZ(counterYaw * 0.6 + lb * 0.25, chP, -lean * 0.22 + wobRoll * 0.7, out.chest);
  const T = pelvisPitch + spP + chP;
  quatYXZ(lb * 0.25, -T * 0.42, lean * 0.12, out.neck);
  quatYXZ(lb * 0.38, -T * 0.52 + 0.1 - cel * 0.3, lean * 0.15 - wobRoll * 0.5, out.head);

  for (let i = 0; i < 2; i++) {
    const sg = sideSign(i);
    quatYXZ(-sg * 0.22 * tuck, 0, sg * (0.2 * cel + 0.08 * air * (1 - tuck)), out.clav[i]);
  }

  // ---- arms (chest-frame offsets from the shoulder joint) ----
  chestFrame(out);
  for (let i = 0; i < 2; i++) {
    const sg = sideSign(i);
    const insideAmt = Math.max(0, -sg * leanN);
    const hnd: V3 = [sg * 0.1, -0.4, 0.3];
    const elb: V3 = [sg * 0.75, -0.35, -0.6];
    hnd[1] += 0.04 * insideAmt;
    hnd[2] += 0.07 * insideAmt;
    mix3(hnd, [sg * 0.17, -0.38, 0.28], pz);
    mix3(hnd, [sg * 0.23, -0.33, 0.25], dr);
    mix3(hnd, [sg * 0.07, -0.35, 0.36], cr * (1 - tuck));
    mix3(hnd, [-sg * 0.09, 0.4, 0.07], tuck);
    mix3(elb, [sg * 0.3, -0.35, 0.9], tuck);
    mix3(hnd, [sg * 0.42, -0.27, 0.18], air * (1 - tuck));
    mix3(elb, [sg * 0.35, -0.6, -0.7], air * (1 - tuck));
    if (wob > 0.001) {
      const ph = t * 9 + (i === 0 ? 0 : Math.PI * 0.85);
      mix3(hnd, [sg * 0.3, 0.05 + Math.cos(ph) * 0.36, 0.1 + Math.sin(ph) * 0.34], wob);
      mix3(elb, [sg * 0.8, 0, -0.5], wob);
    }
    const right = i === 1;
    mix3(hnd, right ? [sg * 0.17, 0.51, 0.1] : [sg * 0.27, 0.45, 0.06], cel);
    mix3(elb, [sg * 1, 0.1, -0.35], cel);
    handFromChest(i, hnd[0], hnd[1], hnd[2], out.hand[i]);
    out.elbowPole[i].set(elb[0], elb[1], elb[2]).applyQuaternion(chestQ).normalize();

    // ---- poles ----
    const pd = out.poleDir[i].set(sg * 0.12, -0.78, -0.62);
    pd.z += 0.3 * insideAmt;
    if (tuck > 0.001) {
      // run the shaft from the hands back under the armpit
      shoulderOf(i, vB);
      vB.add(vC.set(sg * 0.07, -0.14, -0.3));
      vC.subVectors(vB, out.hand[i]).normalize();
      pd.lerp(vC, tuck);
    }
    pd.lerp(vC.set(sg * 0.45, -0.55, -0.7), air * (1 - tuck));
    pd.lerp(vC.set(sg * 0.7, -0.55, -0.2), wob);
    pd.lerp(vC.set(sg * 0.04, -1, 0.04), cel);
    pd.normalize();
    // keep the tip above the snow
    const L = DIM.POLE_LEN + 0.06;
    const minY = 0.04 - out.hand[i].y;
    if (pd.y * L < minY) {
      const ny = clamp(minY / L, -0.999, 0.999);
      const hl = Math.hypot(pd.x, pd.z) || 1;
      const k = Math.sqrt(1 - ny * ny) / hl;
      pd.set(pd.x * k, ny, pd.z * k);
    }
    out.poleSlide[i] = -0.11 * cel;
  }

  // ---- whole-body airborne rotation ----
  const airPitch = air * (0.14 * smoothstep(0.15, 1.4, st.airTime) - 0.05);
  quatFromRotVec(airPitch, 0, 0, out.bodyQuat);
  vA.set(0, 0.8, 0);
  out.bodyPos.copy(vA).sub(vB.copy(vA).applyQuaternion(out.bodyQuat));
}

// ---------------------------------------------------------------------------------------------

const tumble = new PoseSpec();
const lying = new PoseSpec();
const qX = new THREE.Quaternion();
const qZ = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0);
const AZ = new THREE.Vector3(0, 0, 1);

/** Crash: a tumble (body rolled about an offset pivot) that settles into a sprawl on the snow. */
export function buildCrashPose(st: SmoothedPose, out: PoseSpec): void {
  const t = st.crashTime;
  const side = st.crashSide;

  // --- tumbling limbs
  {
    const s = tumble;
    const curl = 0.35 + 0.25 * Math.sin(t * 6.1);
    s.pelvisPos.set(0, 0.85, -0.04);
    quatYXZ(0.2 * Math.sin(t * 4.3), curl, 0.15 * Math.sin(t * 5.2), s.pelvisQuat);
    quatYXZ(0.15 * Math.sin(t * 5.7), 0.3 + 0.2 * Math.sin(t * 7.1), 0.2 * Math.sin(t * 6.3), s.spine);
    quatYXZ(0.2 * Math.sin(t * 4.9), 0.2, 0.1 * Math.sin(t * 8.3), s.chest);
    quatYXZ(0.3 * Math.sin(t * 6.7), -0.25, 0, s.neck);
    quatYXZ(0.3 * Math.sin(t * 5.3), -0.2 + 0.3 * Math.sin(t * 9.1), 0.2 * Math.sin(t * 7.7), s.head);
    for (let i = 0; i < 2; i++) {
      const sg = sideSign(i);
      quatYXZ(0, 0, sg * 0.15, s.clav[i]);
    }
    chestFrame(s);
    for (let i = 0; i < 2; i++) {
      const sg = sideSign(i);
      handFromChest(
        i,
        sg * (0.36 + 0.12 * Math.sin(t * 9.3 + sg)),
        0.12 + 0.34 * Math.sin(t * 7.3 + 1.7 * sg),
        0.08 + 0.26 * Math.cos(t * 8.1 + 0.5 * sg),
        s.hand[i],
      );
      s.elbowPole[i].set(sg, -0.2, -0.5).applyQuaternion(chestQ).normalize();
      s.poleDir[i].set(sg * 0.5, -0.35 + 0.5 * Math.sin(t * 8.2 + sg), -0.6 + 0.3 * Math.cos(t * 5.1)).normalize();
      s.poleSlide[i] = 0;
      const ax = sg * (0.17 + 0.09 * Math.sin(t * 5.3 + sg));
      const ay = -0.6 + 0.15 * Math.sin(t * 7.2 + 2 * sg);
      const az = 0.14 + 0.2 * Math.sin(t * 6.1 + sg);
      s.ankle[i].set(ax, ay, az).applyQuaternion(s.pelvisQuat).add(s.pelvisPos);
      quatYXZ(sg * 0.25, 0.45 + 0.3 * Math.sin(t * 6.3 + sg), sg * 0.3 * Math.sin(t * 4.1), qA);
      s.foot[i].copy(s.pelvisQuat).multiply(qA);
      s.kneePole[i].set(sg * 0.25, 0, 1).applyQuaternion(s.pelvisQuat).normalize();
    }
  }

  // --- lying sprawled on the back (body +Z = away from the snow, body +Y = toward the head)
  {
    const s = lying;
    const br = Math.sin(st.time * 2.2) * 0.02; // heavy breathing
    s.pelvisPos.set(0, 0.85, 0);
    quatYXZ(0, -0.05, side * 0.1, s.pelvisQuat);
    quatYXZ(0.05 * side, 0.04 + br, 0, s.spine);
    quatYXZ(0, 0.1 + br, -0.05 * side, s.chest);
    quatYXZ(0.2 * side, 0.22, 0, s.neck);
    quatYXZ(0.45 * side, 0.12, 0.1 * side, s.head);
    for (let i = 0; i < 2; i++) quatYXZ(0, 0, sideSign(i) * 0.1, s.clav[i]);
    chestFrame(s);
    for (let i = 0; i < 2; i++) {
      const sg = sideSign(i);
      // snow-angel arms
      handFromChest(i, sg * (i === 0 ? 0.48 : 0.42), i === 0 ? 0.2 : -0.12, -0.07, s.hand[i]);
      s.elbowPole[i].set(sg * 0.3, 0, 1).normalize();
      s.poleDir[i].set(sg * (i === 0 ? 0.35 : 0.85), i === 0 ? 0.92 : 0.4, -0.06).normalize();
      s.poleSlide[i] = 0;
    }
    // left leg: knee up, ski flat on the snow
    hipOff(0, vA).applyQuaternion(s.pelvisQuat).add(s.pelvisPos);
    s.ankle[0].copy(vA).add(vB.set(0.16, -0.55, 0.02));
    qX.setFromAxisAngle(AX, Math.PI / 2);
    qZ.setFromAxisAngle(AZ, 0.38);
    s.foot[0].copy(qZ).multiply(qX);
    s.kneePole[0].set(0.35, 0, 1).normalize();
    // right leg: knee fallen outward, ski on its edge
    hipOff(1, vA).applyQuaternion(s.pelvisQuat).add(s.pelvisPos);
    s.ankle[1].copy(vA).add(vB.set(-0.34, -0.6, -0.03));
    qZ.setFromAxisAngle(AZ, -0.55);
    qA.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -1.25);
    s.foot[1].copy(qZ).multiply(qA).multiply(qX);
    s.kneePole[1].set(-1, 0, 0.45).normalize();
  }

  const L = smoothstep(0.85, 1.7, t);
  out.blend(tumble, lying, L);

  // whole-body tumble: fall onto the side, then log-roll forward and settle face-up
  const fall = smoothstep(0, 0.38, t);
  const roll = smoothstep(0.1, 1.25, t) * Math.PI * 1.5;
  qZ.setFromAxisAngle(AZ, side * (Math.PI / 2) * fall);
  qX.setFromAxisAngle(AX, roll);
  out.bodyQuat.copy(qX).multiply(qZ);
  // pivot near the hips; height is resolved by the ground clamp in SkierModel
  vA.set(0, 0.8, 0);
  vB.set(0, lerp(0.8, 0.25, fall), 0);
  out.bodyPos.copy(vB).sub(vC.copy(vA).applyQuaternion(out.bodyQuat));
}
