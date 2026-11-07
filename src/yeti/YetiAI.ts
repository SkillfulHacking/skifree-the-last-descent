/**
 * Yeti pursuit AI — pure, deterministic, renderer-independent.
 *
 * Pursuit model (documented in docs/DESIGN.md):
 *  - The Yeti runs on foot. Its ground speed is capped (YETI.maxSpeed) and acceleration-limited.
 *  - Terrain matters: it is relatively strong on gentle ground (where skis are slow) and weaker
 *    on steep pitches, deep powder and through forest canopy (where a good skier pulls away).
 *  - Pressure: when far behind it digs in (catch-up boost), but never above maxSpeed — a skier
 *    who keeps their average speed above that cap escapes. Crashes, braking and wide lines cost
 *    the seconds that let it close in.
 *  - Close range: a short lunge burst with cooldown, then capture at CATCH_DISTANCE.
 *  - Navigation: follows the route corridor when far, homes in on the skier (with lead) when near,
 *    and steers around tree trunks/boulders; it can plough through canopy (slowed) so it never
 *    gets permanently stuck.
 */
import * as THREE from 'three';
import { clamp, damp, smoothstep, wrapAngle } from '../core/rng';
import type { YetiMode } from '../core/types';
import type { Mountain } from '../world/course';
import type { ObstacleField } from '../physics/obstacles';

export const YETI = {
  baseSpeed: 16.5,
  maxSpeed: 27,
  accel: 6.5,
  catchUpGap: 60, // beyond this distance the yeti pushes harder
  catchUpBoost: 9,
  lungeRange: 13,
  lungeBoost: 7,
  lungeTime: 0.75,
  lungeCooldown: 3.2,
  catchDistance: 2.7,
  startDelay: 0.6,
};

export type YetiPhase = 'dormant' | 'scripted' | 'chase' | 'caught' | 'stopped';

export interface YetiTarget {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  airborne: boolean;
}

const tmp = new THREE.Vector3();
const ids: number[] = [];

export class YetiAI {
  phase: YetiPhase = 'dormant';
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  heading = 0;
  speed = 0;
  turn = 0;
  mode: YetiMode = 'hidden';
  modeTime = 0;
  chaseTime = 0;
  lungeTimer = 0;
  lungeCooldown = 0;
  delay = 0;
  airborne = false;
  vy = 0;
  /** distance to target (3D) */
  distance = Infinity;
  /** debug: last computed desired speed */
  desired = 0;
  /** per-encounter pursuit scaling (1 = classic; Endless escalates) */
  speedMul = 1;

  constructor(
    private mountain: Mountain,
    private obstacles: ObstacleField | null,
  ) {}

  setMode(m: YetiMode) {
    if (m !== this.mode) {
      this.mode = m;
      this.modeTime = 0;
    }
  }

  /** Place for a scripted moment (cinematic). */
  place(x: number, z: number, heading: number, yOffset = 0) {
    this.pos.set(x, this.mountain.heightAt(x, z) + yOffset, z);
    this.heading = heading;
  }

  /** Stand down: the Yeti gives up (Endless checkpoint reached) and vanishes until the next cave. */
  standDown() {
    this.phase = 'dormant';
    this.airborne = false;
    this.vy = 0;
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.setMode('hidden');
  }

  /** Begin the pursuit from the current position with a leap down onto the slope. */
  startChase(leapVelocity: THREE.Vector3 | null) {
    this.phase = 'chase';
    this.chaseTime = 0;
    this.delay = YETI.startDelay;
    if (leapVelocity) {
      this.airborne = true;
      this.vel.copy(leapVelocity);
      this.vy = leapVelocity.y;
      this.setMode('leap');
    } else this.setMode('run');
  }

  update(dt: number, target: YetiTarget) {
    this.modeTime += dt;
    if (this.phase !== 'chase') {
      this.distance = this.pos.distanceTo(target.pos);
      return;
    }
    this.chaseTime += dt;

    if (this.airborne) {
      this.vy -= 9.81 * dt;
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.pos.y += this.vy * dt;
      const h = this.mountain.heightAt(this.pos.x, this.pos.z);
      if (this.pos.y <= h) {
        this.pos.y = h;
        this.airborne = false;
        this.speed = Math.hypot(this.vel.x, this.vel.z) * 0.6;
        this.setMode('run');
      }
      this.distance = this.pos.distanceTo(target.pos);
      return;
    }

    if (this.delay > 0) {
      this.delay -= dt;
    }

    // --- navigation target
    const toT = tmp.subVectors(target.pos, this.pos);
    const dist = Math.hypot(toT.x, toT.z);
    const near = smoothstep(70, 30, dist);
    const lead = clamp(dist / 30, 0, 0.8);
    const aheadZ = this.pos.z + clamp(dist, 15, 45);
    // far: follow the route corridor ahead; near: the skier (with lead)
    const routeTX = THREE.MathUtils.lerp(this.mountain.routeX(aheadZ), target.pos.x, 0.35);
    let tx = THREE.MathUtils.lerp(routeTX, target.pos.x + target.vel.x * lead, near);
    let tz = THREE.MathUtils.lerp(aheadZ, target.pos.z + target.vel.z * lead, near);
    // never target behind itself when the skier is ahead…
    if (target.pos.z > this.pos.z && tz < this.pos.z + 3) tz = this.pos.z + 3;
    // …but if the skier ends up uphill (overshoot, missed lunge) turn around and go straight for them
    if (target.pos.z < this.pos.z - 3) {
      tx = target.pos.x;
      tz = target.pos.z;
    }

    // --- local obstacle avoidance (trunks & boulders)
    let avoidX = 0;
    let canopy = 0;
    if (this.obstacles) {
      this.obstacles.grid.query(this.pos.x, this.pos.z + 4, 9, ids);
      for (const id of ids) {
        const o = this.obstacles.get(id);
        if (!o || o.kind === 'rock' || o.kind === 'stump' || o.kind === 'log') continue;
        const dx = this.pos.x - o.x;
        const dz = o.z - this.pos.z;
        if (dz < -2 || dz > 12) continue;
        const lat = Math.abs(dx);
        const clear = o.r + 1.3;
        if (lat < clear + 2.5) avoidX += Math.sign(dx || 1) * (clear + 2.5 - lat) * (1 - dz / 14) * 2.2;
        if (o.kind === 'tree' && Math.hypot(dx, dz) < o.softR) canopy = Math.max(canopy, 1 - Math.hypot(dx, dz) / o.softR);
      }
    }
    tx += avoidX * 3;

    const desiredHeading = Math.atan2(tx - this.pos.x, tz - this.pos.z);
    const dh = wrapAngle(desiredHeading - this.heading);
    const turnRate = 2.4;
    const step = clamp(dh, -turnRate * dt, turnRate * dt);
    this.heading = wrapAngle(this.heading + step);
    // heading increases toward +X = the yeti's left; the model expects + = turning right
    this.turn = damp(this.turn, clamp(-dh * 1.5, -1, 1), 6, dt);

    // --- speed model
    const slope = this.mountain.slopeDeg(this.pos.z);
    const steepPenalty = 1 - 0.12 * smoothstep(17, 26, slope);
    const d = Math.abs(this.pos.x - this.mountain.centerX(this.pos.z));
    const hw = this.mountain.halfWidth(this.pos.z);
    const offPiste = smoothstep(hw * 0.85, hw * 1.15, d);
    const terrain = steepPenalty * (1 - 0.22 * offPiste) * (1 - 0.35 * canopy);
    const gap = target.pos.z - this.pos.z;
    // pressure: digs in when behind, harder when far behind (keeps it within earshot/sight),
    // still capped so a clean, fast skier keeps their lead
    const pressure = smoothstep(YETI.catchUpGap, YETI.catchUpGap + 120, gap) * YETI.catchUpBoost + smoothstep(105, 170, gap) * 7;
    // ramp in over the first seconds of the chase
    const warm = smoothstep(0, 4, this.chaseTime);
    let desired = (YETI.baseSpeed * this.speedMul + pressure) * terrain * (0.55 + 0.45 * warm);
    // on gentle ground a running beast is not much faster than a gliding skier
    if (slope < 12) desired = Math.min(desired, 13 + 0.5 * slope);

    // lunge
    this.lungeCooldown = Math.max(0, this.lungeCooldown - dt);
    if (this.lungeTimer > 0) this.lungeTimer -= dt;
    else if (dist < YETI.lungeRange && this.lungeCooldown <= 0 && gap > -2) {
      this.lungeTimer = YETI.lungeTime;
      this.lungeCooldown = YETI.lungeCooldown;
    }
    if (this.lungeTimer > 0) desired += YETI.lungeBoost;
    desired = Math.min(desired, YETI.maxSpeed * this.speedMul + smoothstep(105, 170, gap) * 6 + (this.lungeTimer > 0 ? YETI.lungeBoost : 0));
    if (this.delay > 0) desired = 0;
    this.desired = desired;

    const a = desired > this.speed ? YETI.accel : 12;
    this.speed += clamp(desired - this.speed, -a * dt, a * dt);

    this.vel.set(Math.sin(this.heading) * this.speed, 0, Math.cos(this.heading) * this.speed);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y = this.mountain.heightAt(this.pos.x, this.pos.z);

    this.setMode(this.lungeTimer > 0 && dist < 6 ? 'grab' : 'run');

    this.distance = this.pos.distanceTo(target.pos);
  }

  /** Capture condition: actual 3D proximity; a skier high in the air can escape a grab. */
  canCatch(target: YetiTarget): boolean {
    if (this.phase !== 'chase' || this.airborne) return false;
    const dx = target.pos.x - this.pos.x;
    const dz = target.pos.z - this.pos.z;
    const dy = target.pos.y - this.pos.y;
    return Math.hypot(dx, dz) < YETI.catchDistance && dy < 2.6 && dy > -2;
  }
}
