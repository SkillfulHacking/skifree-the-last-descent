/**
 * Skier skeleton dimensions (metres) for a ~1.78 m adult, and bone indices.
 * Bind pose: standing straight, arms hanging, every bone with identity local rotation.
 * All limb bones point along their local -Y; local +Z is the "front" of the limb.
 * Index 0 = left (character's left, +X), 1 = right (-X). The model faces +Z.
 */
export const DIM = {
  PELVIS_BIND_Y: 1.0,
  SPINE_Y: 0.1,
  CHEST_Y: 0.17,
  NECK_Y: 0.23,
  HEAD_Y: 0.1,
  CLAV_X: 0.035,
  CLAV_Y: 0.175,
  CLAV_Z: -0.01,
  SHOULDER_X: 0.15,
  SHOULDER_Y: -0.005,
  UPPER_ARM: 0.29,
  FOREARM: 0.26,
  HIP_X: 0.092,
  HIP_Y: -0.065,
  THIGH: 0.44,
  SHIN: 0.42,
  /** ankle joint height above ski base */
  ANKLE_H: 0.15,
  /** fist centre below the wrist (hand-local) */
  FIST_Y: -0.075,
  /** skull centre in head-local space */
  HEAD_CX: 0,
  HEAD_CY: 0.085,
  HEAD_CZ: 0.012,
  SKI_HALF: 0.85,
  /** ski centre forward of the ankle (boot centre) */
  SKI_MOUNT_Z: 0.07,
  POLE_LEN: 1.12,
} as const;

export const BONE = {
  pelvis: 0,
  spine: 1,
  chest: 2,
  neck: 3,
  head: 4,
  clavL: 5,
  upperArmL: 6,
  forearmL: 7,
  handL: 8,
  clavR: 9,
  upperArmR: 10,
  forearmR: 11,
  handR: 12,
  thighL: 13,
  shinL: 14,
  footL: 15,
  thighR: 16,
  shinR: 17,
  footR: 18,
} as const;

export const BONE_COUNT = 19;

export const sideSign = (i: number): number => (i === 0 ? 1 : -1);
export const armBones = (i: number): { clav: number; upper: number; fore: number; hand: number } =>
  i === 0
    ? { clav: BONE.clavL, upper: BONE.upperArmL, fore: BONE.forearmL, hand: BONE.handL }
    : { clav: BONE.clavR, upper: BONE.upperArmR, fore: BONE.forearmR, hand: BONE.handR };
export const legBones = (i: number): { thigh: number; shin: number; foot: number } =>
  i === 0
    ? { thigh: BONE.thighL, shin: BONE.shinL, foot: BONE.footL }
    : { thigh: BONE.thighR, shin: BONE.shinR, foot: BONE.footR };

/** Bind-pose (absolute, body space) joint heights used for skin weighting. */
export const BIND = {
  pelvis: DIM.PELVIS_BIND_Y,
  spine: DIM.PELVIS_BIND_Y + DIM.SPINE_Y,
  chest: DIM.PELVIS_BIND_Y + DIM.SPINE_Y + DIM.CHEST_Y,
  neck: DIM.PELVIS_BIND_Y + DIM.SPINE_Y + DIM.CHEST_Y + DIM.NECK_Y,
  head: DIM.PELVIS_BIND_Y + DIM.SPINE_Y + DIM.CHEST_Y + DIM.NECK_Y + DIM.HEAD_Y,
  shoulderX: DIM.CLAV_X + DIM.SHOULDER_X,
  shoulderY: DIM.PELVIS_BIND_Y + DIM.SPINE_Y + DIM.CHEST_Y + DIM.CLAV_Y + DIM.SHOULDER_Y,
  shoulderZ: DIM.CLAV_Z,
  hipY: DIM.PELVIS_BIND_Y + DIM.HIP_Y,
} as const;
