import * as THREE from 'three';

export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const saturate = (x: number): number => clamp(x, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = saturate((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** sign(x) * |x|^p */
export function sgnPow(x: number, p: number): number {
  return x === 0 ? 0 : Math.sign(x) * Math.pow(Math.abs(x), p);
}

/** Frame-rate independent exponential smoothing toward a target (critically damped first-order). */
export function damp(cur: number, target: number, rate: number, dt: number): number {
  return target + (cur - target) * Math.exp(-rate * dt);
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - saturate(t), 3);

const _bx = new THREE.Vector3();
const _bz = new THREE.Vector3();
const _bm = new THREE.Matrix4();

/**
 * Build an orientation whose local +Y equals `yAxis` (unit) and whose local +Z is as close as
 * possible to `zHint`.
 */
export function basisQuat(yAxis: THREE.Vector3, zHint: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  _bz.copy(zHint).addScaledVector(yAxis, -zHint.dot(yAxis));
  if (_bz.lengthSq() < 1e-10) {
    _bz.set(0, 0, 1).addScaledVector(yAxis, -yAxis.z);
    if (_bz.lengthSq() < 1e-10) _bz.set(1, 0, 0).addScaledVector(yAxis, -yAxis.x);
  }
  _bz.normalize();
  _bx.crossVectors(yAxis, _bz);
  _bm.makeBasis(_bx, yAxis, _bz);
  return out.setFromRotationMatrix(_bm);
}

const _e = new THREE.Euler();
/** Yaw (Y) then pitch (X) then roll (Z), applied in the local frame. */
export function quatYXZ(yaw: number, pitch: number, roll: number, out: THREE.Quaternion): THREE.Quaternion {
  _e.set(pitch, yaw, roll, 'YXZ');
  return out.setFromEuler(_e);
}

const _rv = new THREE.Vector3();
export function quatFromRotVec(x: number, y: number, z: number, out: THREE.Quaternion): THREE.Quaternion {
  _rv.set(x, y, z);
  const a = _rv.length();
  if (a < 1e-9) return out.identity();
  return out.setFromAxisAngle(_rv.divideScalar(a), a);
}

const _d = new THREE.Vector3();
/**
 * Analytic two-bone IK. Given root joint, target end position and a pole direction, writes the
 * middle joint (knee/elbow), the reached end position and the unit bend direction (pole projected
 * perpendicular to root→end).
 */
export function solveTwoBone(
  root: THREE.Vector3,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  l1: number,
  l2: number,
  outMid: THREE.Vector3,
  outEnd: THREE.Vector3,
  outBend: THREE.Vector3,
): void {
  _d.subVectors(target, root);
  let d = _d.length();
  if (d < 1e-6) {
    _d.set(0, -1, 0);
    d = 1e-6;
  } else _d.divideScalar(d);
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-5);
  const a = (l1 * l1 + d * d - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  outBend.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (outBend.lengthSq() < 1e-10) {
    outBend.set(0, 0, 1).addScaledVector(_d, -_d.z);
    if (outBend.lengthSq() < 1e-10) outBend.set(1, 0, 0);
  }
  outBend.normalize();
  outMid.copy(root).addScaledVector(_d, a).addScaledVector(outBend, h);
  outEnd.copy(root).addScaledVector(_d, d);
}

/** Catmull-Rom sample of a keyed profile table: rows are [key, v1, v2, ...] sorted by key. */
export function sampleKeys(keys: readonly (readonly number[])[], s: number, out: number[]): number[] {
  const n = keys.length;
  const w = keys[0].length - 1;
  out.length = w;
  if (s <= keys[0][0]) {
    for (let c = 0; c < w; c++) out[c] = keys[0][c + 1];
    return out;
  }
  if (s >= keys[n - 1][0]) {
    for (let c = 0; c < w; c++) out[c] = keys[n - 1][c + 1];
    return out;
  }
  let i = 0;
  while (i < n - 2 && s > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(n - 1, i + 2)];
  const t = (s - k1[0]) / (k2[0] - k1[0]);
  const t2 = t * t;
  const t3 = t2 * t;
  for (let c = 1; c <= w; c++) {
    const p0 = k0[c];
    const p1 = k1[c];
    const p2 = k2[c];
    const p3 = k3[c];
    // centripetal-ish uniform Catmull-Rom, tangents scaled by segment spacing for uneven keys
    const m1 = ((p2 - p0) / Math.max(1e-6, k2[0] - k0[0])) * (k2[0] - k1[0]);
    const m2 = ((p3 - p1) / Math.max(1e-6, k3[0] - k1[0])) * (k2[0] - k1[0]);
    out[c - 1] =
      (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2;
  }
  return out;
}
