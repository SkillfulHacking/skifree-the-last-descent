/**
 * Yeti skeleton definition (bind pose, model space).
 *
 * Conventions: +Y up, the creature faces +Z, its LEFT side is +X (s = +1) and its RIGHT side is -X (s = -1).
 * All bones have identity rotation in the bind pose, so a bone's local rotation axes are the model axes
 * (X = pitch, Y = yaw, Z = roll) which keeps procedural animation authoring intuitive.
 */
import * as THREE from 'three';

export type Side = 'L' | 'R';
export const SIDES: readonly Side[] = ['L', 'R'];
export const sideSign = (side: Side): number => (side === 'L' ? 1 : -1);

export const BONE_NAMES = [
  'rig',
  'hips',
  'spine1',
  'spine2',
  'spine3',
  'neck',
  'head',
  'jaw',
  'clavL',
  'upperArmL',
  'forearmL',
  'handL',
  'fingersL',
  'fingers2L',
  'thumbL',
  'clavR',
  'upperArmR',
  'forearmR',
  'handR',
  'fingersR',
  'fingers2R',
  'thumbR',
  'thighL',
  'shinL',
  'footL',
  'toesL',
  'thighR',
  'shinR',
  'footR',
  'toesR',
] as const;

export type BoneName = (typeof BONE_NAMES)[number];
export const BONE_COUNT = BONE_NAMES.length;
export const B: Record<BoneName, number> = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i])) as Record<
  BoneName,
  number
>;

/** Arm is posed in a slight A-pose in bind so the limbs do not fuse with the torso when meshing. */
export const ARM_ANGLE = (20 * Math.PI) / 180;

export interface ArmFrame {
  shoulder: THREE.Vector3;
  elbow: THREE.Vector3;
  wrist: THREE.Vector3;
  knuckles: THREE.Vector3;
  fingers2: THREE.Vector3;
  thumb: THREE.Vector3;
  clav: THREE.Vector3;
  /** unit, down the arm */
  d: THREE.Vector3;
  /** unit, palm normal (points out of the palm, toward the thigh in bind) */
  n: THREE.Vector3;
  /** unit, across the knuckles toward the thumb (+Z) */
  w: THREE.Vector3;
}

export const UPPER_ARM_LEN = 0.84;
export const FOREARM_LEN = 0.8;
export const PALM_LEN = 0.24;
export const FINGER1_LEN = 0.15;

export function armFrame(s: number): ArmFrame {
  const d = new THREE.Vector3(Math.sin(ARM_ANGLE) * s, -Math.cos(ARM_ANGLE), 0);
  const n = new THREE.Vector3(-Math.cos(ARM_ANGLE) * s, -Math.sin(ARM_ANGLE), 0);
  const w = new THREE.Vector3(0, 0, 1);
  const shoulder = new THREE.Vector3(0.66 * s, 2.4, -0.04);
  const elbow = shoulder.clone().addScaledVector(d, UPPER_ARM_LEN);
  const wrist = elbow.clone().addScaledVector(d, FOREARM_LEN);
  const knuckles = wrist.clone().addScaledVector(d, PALM_LEN);
  const fingers2 = knuckles.clone().addScaledVector(d, FINGER1_LEN);
  const thumb = wrist.clone().addScaledVector(d, 0.07).addScaledVector(w, 0.085).addScaledVector(n, 0.02);
  const clav = new THREE.Vector3(0.14 * s, 2.45, 0.0);
  return { shoulder, elbow, wrist, knuckles, fingers2, thumb, clav, d, n, w };
}

export interface LegFrame {
  hip: THREE.Vector3;
  knee: THREE.Vector3;
  ankle: THREE.Vector3;
  ball: THREE.Vector3;
}

export function legFrame(s: number): LegFrame {
  return {
    hip: new THREE.Vector3(0.26 * s, 1.38, 0.0),
    knee: new THREE.Vector3(0.3 * s, 0.77, 0.1),
    ankle: new THREE.Vector3(0.32 * s, 0.2, -0.07),
    ball: new THREE.Vector3(0.33 * s, 0.06, 0.2),
  };
}

export const HEAD_BONE_POS = new THREE.Vector3(0, 2.76, 0.08);
export const JAW_BONE_POS = new THREE.Vector3(0, 2.865, 0.1);
/** Mouth line (between the lips) in bind space. */
export const MOUTH_POS = new THREE.Vector3(0, 2.785, 0.39);
export const HEAD_CENTER = new THREE.Vector3(0, 2.93, 0.15);
/**
 * Head proportions: the head is sculpted at bind scale and enlarged about the head bone (HEAD_BONE_POS) at runtime,
 * and the head bone sits HEAD_LIFT higher/further forward than its bind pivot, so the stretch of the neck-to-head
 * skin blend reads as a neck under a head that is big enough for the shoulders.
 */
export const HEAD_SCALE = 1.42;
export const HEAD_LIFT = new THREE.Vector3(0, 0.1, 0.04);

export function bindPositions(): THREE.Vector3[] {
  const p: THREE.Vector3[] = new Array<THREE.Vector3>(BONE_COUNT);
  const set = (n: BoneName, v: THREE.Vector3): void => {
    p[B[n]] = v.clone();
  };
  set('rig', new THREE.Vector3(0, 0, 0));
  set('hips', new THREE.Vector3(0, 1.42, 0));
  set('spine1', new THREE.Vector3(0, 1.6, -0.01));
  set('spine2', new THREE.Vector3(0, 1.86, 0.0));
  set('spine3', new THREE.Vector3(0, 2.14, 0.0));
  set('neck', new THREE.Vector3(0, 2.56, 0.02));
  set('head', HEAD_BONE_POS);
  set('jaw', JAW_BONE_POS);
  for (const side of SIDES) {
    const s = sideSign(side);
    const a = armFrame(s);
    set(`clav${side}`, a.clav);
    set(`upperArm${side}`, a.shoulder);
    set(`forearm${side}`, a.elbow);
    set(`hand${side}`, a.wrist);
    set(`fingers${side}`, a.knuckles);
    set(`fingers2${side}`, a.fingers2);
    set(`thumb${side}`, a.thumb);
    const l = legFrame(s);
    set(`thigh${side}`, l.hip);
    set(`shin${side}`, l.knee);
    set(`foot${side}`, l.ankle);
    set(`toes${side}`, l.ball);
  }
  return p;
}

export const PARENTS: Record<BoneName, BoneName | null> = {
  rig: null,
  hips: 'rig',
  spine1: 'hips',
  spine2: 'spine1',
  spine3: 'spine2',
  neck: 'spine3',
  head: 'neck',
  jaw: 'head',
  clavL: 'spine3',
  upperArmL: 'clavL',
  forearmL: 'upperArmL',
  handL: 'forearmL',
  fingersL: 'handL',
  fingers2L: 'fingersL',
  thumbL: 'handL',
  clavR: 'spine3',
  upperArmR: 'clavR',
  forearmR: 'upperArmR',
  handR: 'forearmR',
  fingersR: 'handR',
  fingers2R: 'fingersR',
  thumbR: 'handR',
  thighL: 'hips',
  shinL: 'thighL',
  footL: 'shinL',
  toesL: 'footL',
  thighR: 'hips',
  shinR: 'thighR',
  footR: 'shinR',
  toesR: 'footR',
};

export const PARENT_INDEX: Int32Array = Int32Array.from(BONE_NAMES.map((n) => {
  const p = PARENTS[n];
  return p === null ? -1 : B[p];
}));
