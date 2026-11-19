/**
 * The camera's swing from the cave cinematic's last shot back to the follow camera, while the player
 * already has control and the Yeti is in the air (W-076). Pure: GameSession calls it every frame of
 * the swing after the follow camera has placed `camera`; tests/unit/handoff_blend.test.ts.
 *
 * The position and field of view ease from the shot's to the follow camera's over the whole swing;
 * the aim stays on the leaping Yeti for the first half, then turns onto the follow camera's own aim,
 * so the landing is seen and the swing ends exactly on the follow pose (no cut). (Review C, C1: a
 * slerp of the camera's quaternion onto itself kept the shot's direction, then snapped at the end.)
 */
import * as THREE from 'three';
import { smoothstep } from '../core/rng';

export interface HandoffBlend {
  /** the shot's camera position and fov when control returned */
  pos: THREE.Vector3;
  /** the point the shot was aimed at when control returned (on the shot's line of sight) */
  look: THREE.Vector3;
  fov: number;
  /** seconds into the swing, and its length */
  t: number;
  dur: number;
}

const followPos = new THREE.Vector3();
const followLook = new THREE.Vector3();
const fwd = new THREE.Vector3();
const look = new THREE.Vector3();
const yetiAim = new THREE.Vector3();

/** `camera` holds the follow pose on entry; `yeti` the Yeti's position (aimed at early in the swing). Returns false once the swing is over. */
export function applyHandoffBlend(camera: THREE.PerspectiveCamera, B: HandoffBlend, yeti: THREE.Vector3): boolean {
  const u = Math.min(1, B.t / B.dur);
  const k = smoothstep(0, 1, u);
  followPos.copy(camera.position);
  camera.getWorldDirection(fwd);
  followLook.copy(followPos).addScaledVector(fwd, 30);
  const followFov = camera.fov;
  camera.position.lerpVectors(B.pos, followPos, k);
  // the aim: from the shot's own aim (no jump on the first frame) onto the leaping Yeti, then, over
  // the second half, onto the follow camera's aim
  yetiAim.set(yeti.x, yeti.y + 1.6, yeti.z);
  look.copy(B.look).lerp(yetiAim, smoothstep(0, 0.3, u)).lerp(followLook, smoothstep(0.5, 1, u));
  if (u >= 1) {
    camera.position.copy(followPos);
    look.copy(followLook);
  }
  camera.lookAt(look);
  camera.fov = B.fov + (followFov - B.fov) * k;
  camera.updateProjectionMatrix();
  return u < 1;
}
