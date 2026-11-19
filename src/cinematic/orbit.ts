/**
 * A camera move that swings around a subject instead of cutting across it (W-076, owner's decision 1:
 * the cave cinematic's last beat turns from the Yeti on the ledge to the run, so the player has the
 * forward gameplay view when control returns).
 *
 * Both poses are expressed around the pivot: the camera's azimuth, its horizontal distance and its
 * height, and the look point in the camera's own turning frame (along the line to the pivot, across
 * it, and up). Interpolating those keeps the subject framed while the view turns at the orbit's rate —
 * no straight-line lerp through the subject and no whip-pan as the look point crosses the camera.
 */
import * as THREE from 'three';
import { wrapAngle } from '../core/rng';
import type { CamPose } from './Timeline';

interface Polar {
  az: number;
  r: number;
  h: number;
  /** look point relative to the pivot: inward (toward the pivot from the camera), across, up */
  lin: number;
  lac: number;
  lup: number;
}

function toPolar(p: CamPose, c: THREE.Vector3): Polar {
  const dx = p.pos.x - c.x;
  const dz = p.pos.z - c.z;
  const r = Math.max(1e-6, Math.hypot(dx, dz));
  const ux = dx / r;
  const uz = dz / r;
  const lx = p.look.x - c.x;
  const lz = p.look.z - c.z;
  return { az: Math.atan2(dx, dz), r, h: p.pos.y - c.y, lin: -(lx * ux + lz * uz), lac: lx * uz - lz * ux, lup: p.look.y - c.y };
}

/** the pose at `t` (0..1, already eased) on the orbit from `a` to `b` around `pivot` (shortest turn) */
export function orbitPose(a: CamPose, b: CamPose, pivot: THREE.Vector3, t: number, out?: CamPose): CamPose {
  const A = toPolar(a, pivot);
  const B = toPolar(b, pivot);
  const az = A.az + wrapAngle(B.az - A.az) * t;
  const r = A.r + (B.r - A.r) * t;
  const h = A.h + (B.h - A.h) * t;
  const lin = A.lin + (B.lin - A.lin) * t;
  const lac = A.lac + (B.lac - A.lac) * t;
  const lup = A.lup + (B.lup - A.lup) * t;
  const ux = Math.sin(az);
  const uz = Math.cos(az);
  const o = out ?? { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 0 };
  o.pos.set(pivot.x + ux * r, pivot.y + h, pivot.z + uz * r);
  o.look.set(pivot.x - ux * lin + uz * lac, pivot.y + lup, pivot.z - uz * lin - ux * lac);
  o.fov = a.fov + (b.fov - a.fov) * t;
  return o;
}
