/**
 * Third-person follow camera: behind and above the skier, looking ahead down the fall line.
 * Speed-sensitive distance/FOV, critically damped motion, terrain & obstacle anti-clipping,
 * stable horizon, trauma-based shake, optional orbit with auto-recentre.
 */
import * as THREE from 'three';
import { clamp, damp, gnoise, smoothstep, wrapAngle } from '../core/rng';
import type { Mountain } from '../world/course';
import type { ObstacleField } from '../physics/obstacles';

export interface FollowTarget {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  heading: number;
  grounded: boolean;
  crashed: boolean;
  speed: number;
}

const ids: number[] = [];

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private orbitYaw = 0;
  private orbitPitch = 0;
  private orbitIdle = 0;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private lookVel = new THREE.Vector3();
  private airY = 0;
  private trauma = 0;
  private shakeT = 0;
  private dist = 6;
  private fov = 64;
  /** 0..1 how menacing the framing is (chase) */
  chaseFrame = 0;
  shakeScale = 1;
  reduceMotion = false;
  initialized = false;
  /** A large body to keep the camera out of (the yeti), or null. */
  avoid: THREE.Vector3 | null = null;
  /** 0..1 look back over the shoulder (held input) */
  lookBack = 0;
  private lookBackS = 0;
  private avoidS = 0;
  private avoidSide = 1;
  /** Optional point to keep in frame (e.g. the yeti behind) */
  private tmp = new THREE.Vector3();
  private relPos = new THREE.Vector3();
  private relGoal = new THREE.Vector3();
  private relLook = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    private mountain: Mountain,
    private obstacles: ObstacleField | null,
  ) {
    this.camera = camera;
  }

  /** Read & decay shake trauma (used by cinematics, which own the camera). */
  consumeTrauma(dt: number): number {
    const t = this.trauma;
    this.trauma = Math.max(0, t - dt * 0.9);
    return t;
  }

  addTrauma(t: number) {
    this.trauma = clamp(this.trauma + t, 0, 1);
  }

  orbit(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    this.orbitYaw = clamp(this.orbitYaw - dx, -2.6, 2.6);
    this.orbitPitch = clamp(this.orbitPitch + dy, -0.35, 0.6);
    this.orbitIdle = 0;
  }

  /** Snap to the ideal pose immediately (after cuts / teleports). */
  snap(t: FollowTarget) {
    this.initialized = false;
    this.update(1 / 60, t);
  }

  /** Current ideal pose, used by cinematics to blend back into gameplay seamlessly. */
  idealPose(t: FollowTarget, outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    const sp = t.speed;
    const travel = sp > 2 ? Math.atan2(t.vel.x, t.vel.z) : t.heading;
    const yaw = this.initialized ? this.yaw : travel;
    const dist = THREE.MathUtils.lerp(5.4, 7.6, smoothstep(0, 32, sp)) - 0.6 * this.chaseFrame;
    const height = THREE.MathUtils.lerp(2.3, 2.9, smoothstep(0, 30, sp)) - 0.35 * this.chaseFrame;
    const ay = yaw + this.orbitYaw;
    outPos.set(t.pos.x - Math.sin(ay) * dist, t.pos.y + height + this.orbitPitch * dist, t.pos.z - Math.cos(ay) * dist);
    const ahead = THREE.MathUtils.lerp(4, 15, smoothstep(0, 30, sp));
    outLook.set(t.pos.x + Math.sin(yaw) * ahead, t.pos.y + 0.6, t.pos.z + Math.cos(yaw) * ahead);
    outLook.y = Math.min(outLook.y, this.mountain.heightAt(outLook.x, outLook.z) + 1.2);
    outLook.y = THREE.MathUtils.lerp(outLook.y, t.pos.y + 1.0, 0.5);
  }

  update(dt: number, t: FollowTarget) {
    const sp = t.speed;
    // yaw follows the direction of travel (blend with ski heading at low speed)
    const travel = sp > 2 ? Math.atan2(t.vel.x, t.vel.z) : t.heading;
    const want = sp > 6 ? travel : wrapAngle(t.heading + wrapAngle(travel - t.heading) * smoothstep(0, 6, sp));
    if (!this.initialized) this.yaw = want;
    const yawLambda = t.crashed ? 0.8 : t.grounded ? 3.2 : 1.6;
    this.yaw = wrapAngle(this.yaw + wrapAngle(want - this.yaw) * (1 - Math.exp(-yawLambda * dt)));

    // orbit auto-recentre
    this.orbitIdle += dt;
    if (this.orbitIdle > 1.4) {
      this.orbitYaw = damp(this.orbitYaw, 0, 2.2, dt);
      this.orbitPitch = damp(this.orbitPitch, 0, 2.2, dt);
    }

    const dist = THREE.MathUtils.lerp(5.4, 7.6, smoothstep(0, 32, sp)) - 0.6 * this.chaseFrame + (t.crashed ? 2 : 0);
    this.dist = this.initialized ? damp(this.dist, dist, 2, dt) : dist;
    const height = THREE.MathUtils.lerp(2.3, 2.9, smoothstep(0, 30, sp)) - 0.35 * this.chaseFrame + (t.crashed ? 1.5 : 0);
    // airborne: don't chase the vertical motion fully (lets jumps read)
    const groundUnder = this.mountain.heightAt(t.pos.x, t.pos.z);
    const air = Math.max(0, t.pos.y - groundUnder);
    this.airY = damp(this.airY, air, t.grounded ? 6 : 1.8, dt);
    const baseY = t.pos.y - air + this.airY * 0.75 + air * 0.25;

    this.lookBackS = damp(this.lookBackS, this.lookBack, 6, dt);
    // keep out of the yeti: when it is close behind, lift the boom and swing to the side so it
    // reads over the skier's shoulder instead of filling the screen
    let avoidK = 0;
    if (this.avoid) {
      const ax = this.avoid.x - t.pos.x;
      const az = this.avoid.z - t.pos.z;
      const back = -(ax * Math.sin(this.yaw) + az * Math.cos(this.yaw)); // distance behind the skier
      const lat = ax * Math.cos(this.yaw) - az * Math.sin(this.yaw);
      const dist = Math.hypot(ax, az);
      avoidK = smoothstep(16, 6, dist) * smoothstep(-2, 3, back);
      if (avoidK > 0.01 && this.avoidS < 0.05) this.avoidSide = lat >= 0 ? -1 : 1;
    }
    this.avoidS = damp(this.avoidS, avoidK, 4, dt);
    const ay = this.yaw + this.orbitYaw + this.avoidSide * this.avoidS * 1.0 + Math.PI * this.lookBackS;
    const boom = this.dist * (1 - 0.15 * this.avoidS) * (1 - 0.15 * this.lookBackS);
    const goal = this.tmp.set(t.pos.x - Math.sin(ay) * boom, baseY + height + this.orbitPitch * this.dist + 2.2 * this.avoidS + 0.6 * this.lookBackS, t.pos.z - Math.cos(ay) * boom);

    // terrain clearance along the boom
    for (let i = 1; i <= 4; i++) {
      const f = i / 4;
      const x = THREE.MathUtils.lerp(t.pos.x, goal.x, f);
      const z = THREE.MathUtils.lerp(t.pos.z, goal.z, f);
      const minY = this.mountain.heightAt(x, z) + 0.9 + 0.5 * f;
      if (goal.y < minY) goal.y = minY;
    }
    // obstacle clearance: pull in if a trunk/boulder sits between skier and camera
    if (this.obstacles) {
      this.obstacles.grid.query((t.pos.x + goal.x) / 2, (t.pos.z + goal.z) / 2, this.dist / 2 + 2, ids);
      let best = 1;
      const dx = goal.x - t.pos.x;
      const dz = goal.z - t.pos.z;
      const len2 = dx * dx + dz * dz;
      for (const id of ids) {
        const o = this.obstacles.get(id);
        if (!o) continue;
        if (o.kind === 'rock' || o.kind === 'stump' || o.kind === 'log') continue;
        const r = o.kind === 'tree' ? Math.max(o.r + 0.5, o.softR * 0.55) : o.r + 0.4;
        const ox = o.x - t.pos.x;
        const oz = o.z - t.pos.z;
        const proj = clamp((ox * dx + oz * dz) / len2, 0, 1);
        const px = dx * proj - ox;
        const pz = dz * proj - oz;
        if (px * px + pz * pz < r * r && goal.y < o.y + o.height) best = Math.min(best, Math.max(0.35, proj - 0.12));
      }
      if (best < 1) {
        goal.x = t.pos.x + dx * best;
        goal.z = t.pos.z + dz * best;
        goal.y = Math.max(goal.y, t.pos.y + 1.6);
      }
    }

    const look = new THREE.Vector3();
    const ahead = THREE.MathUtils.lerp(4, 15, smoothstep(0, 30, sp));
    const lyaw = this.yaw + Math.PI * this.lookBackS;
    look.set(t.pos.x + Math.sin(lyaw) * ahead, baseY + 0.6, t.pos.z + Math.cos(lyaw) * ahead);
    // aim slightly down the slope so the upcoming terrain is in view
    const gy = this.mountain.heightAt(look.x, look.z) + 1.2;
    look.y = THREE.MathUtils.lerp(Math.min(look.y, gy), baseY + 1.0, 0.5);

    if (!this.initialized) {
      this.pos.copy(goal);
      this.look.copy(look);
      this.relPos.copy(goal).sub(t.pos);
      this.relLook.copy(look).sub(t.pos);
      this.vel.set(0, 0, 0);
      this.lookVel.set(0, 0, 0);
      this.initialized = true;
    } else {
      // critically damped springs on the offsets relative to the skier (a world-space spring
      // would trail ~2v/ω behind at speed)
      springTo(this.relPos, this.vel, this.relGoal.copy(goal).sub(t.pos), 7, dt);
      this.pos.copy(t.pos).add(this.relPos);
      springTo(this.relLook, this.lookVel, this.relGoal.copy(look).sub(t.pos), 10, dt);
      this.look.copy(t.pos).add(this.relLook);
      // the spring may cut through terrain: final clamp
      const gh = this.mountain.heightAt(this.pos.x, this.pos.z) + 0.6;
      if (this.pos.y < gh) {
        this.pos.y = gh;
        this.relPos.y = gh - t.pos.y;
      }
    }

    // FOV with speed (capped to avoid nausea), narrower when reduceMotion
    // reduce motion: constant FOV, no shake/buzz
    const fovTarget = this.reduceMotion ? 64 : THREE.MathUtils.lerp(62, 78, smoothstep(6, 34, sp)) + 4 * this.chaseFrame;
    this.fov = damp(this.fov, fovTarget, 2.5, dt);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    this.camera.position.copy(this.pos);
    this.camera.up.set(0, 1, 0); // stable horizon (no roll)
    this.camera.lookAt(this.look);

    // shake
    this.trauma = Math.max(0, this.trauma - dt * 1.1);
    this.shakeT += dt;
    const sh = this.trauma * this.trauma * this.shakeScale * (this.reduceMotion ? 0 : 1);
    // subtle high-speed buzz
    const buzz = smoothstep(24, 36, sp) * 0.02 * this.shakeScale * (this.reduceMotion ? 0 : 1) * (t.grounded ? 1 : 0);
    if (sh > 0.0001 || buzz > 0) {
      const a = sh * 0.06 + buzz * 0.25;
      this.camera.rotateX(gnoise(this.shakeT * 25, 1.3, 5) * a);
      this.camera.rotateY(gnoise(this.shakeT * 25, 7.1, 6) * a);
      this.camera.rotateZ(gnoise(this.shakeT * 20, 3.7, 7) * a * 0.6);
    }
  }

  get position(): THREE.Vector3 {
    return this.pos;
  }
  get lookTarget(): THREE.Vector3 {
    return this.look;
  }
}

/** Critically damped spring (frame-rate independent). */
export function springTo(x: THREE.Vector3, v: THREE.Vector3, target: THREE.Vector3, omega: number, dt: number) {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  for (const k of ['x', 'y', 'z'] as const) {
    const detX = f * x[k] + dt * v[k] + hhoo * target[k];
    const detV = v[k] + hoo * (target[k] - x[k]);
    x[k] = detX * det;
    v[k] = detV * det;
  }
}
