/**
 * The watched cave hand-off's camera (W-076): the player has control while the Yeti is in the air.
 *
 * The follow camera's own look-back view carries it: the skier in the foreground, the cave and the
 * leaping Yeti behind them (review C, C6/C7: a free swing from the shot to the follow aim either never
 * turned or whip-panned past both of them, and the landing happened out of frame).
 * - `shotBlend`: the first 0.7 s ease from the cinematic's last shot (behind the skier's position,
 *   looking up at the cave) into that look-back view — both face uphill, so this is a short move;
 * - `lookBackAt`: the look-back held until the landing + LAND_HOLD, then released with a smoothstep
 *   over HANDOFF_CAM.release s — about 3° of turn per frame at most at 60 fps (unit test: ≤ 3.6°).
 */
import * as THREE from 'three';
import { smoothstep } from '../core/rng';

export const HANDOFF_CAM = { shot: 0.7, landHold: 0.35, release: 2.3 } as const;

export interface HandoffBlend {
  /** the shot's camera when control returned */
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  fov: number;
  /** seconds since the hand-off; the landing time (s since the hand-off), once known */
  t: number;
  landedAt: number | null;
}

/** the follow camera's scripted look-back at time B.t (null when the hand-off camera is over) */
export function lookBackAt(B: HandoffBlend): number | null {
  if (B.landedAt === null) return 1;
  const u = (B.t - B.landedAt - HANDOFF_CAM.landHold) / HANDOFF_CAM.release;
  if (u >= 1) return null;
  return 1 - smoothstep(0, 1, u);
}

/**
 * (W-076 reviews E N1 / F N1) the look-back is the player's to end: when they act (steer, brake, move
 * the camera) — or 3 s pass without a landing — the turn to the run starts at once.
 */
export function releaseHandoffOnInput(B: HandoffBlend, acting: boolean): void {
  if (!acting && B.t <= 3) return;
  if (B.landedAt === null || B.landedAt > B.t - HANDOFF_CAM.landHold) B.landedAt = B.t - HANDOFF_CAM.landHold;
}

const q = new THREE.Quaternion();
const p = new THREE.Vector3();

/** ease `camera` (holding the follow pose) from the shot over the first HANDOFF_CAM.shot s */
export function shotBlend(camera: THREE.PerspectiveCamera, B: HandoffBlend): void {
  const k = smoothstep(0, 1, B.t / HANDOFF_CAM.shot);
  if (k >= 1) return;
  q.copy(camera.quaternion);
  p.copy(camera.position);
  camera.position.lerpVectors(B.pos, p, k);
  camera.quaternion.copy(B.quat).slerp(q, k);
  camera.fov = B.fov + (camera.fov - B.fov) * k;
  camera.updateProjectionMatrix();
}
