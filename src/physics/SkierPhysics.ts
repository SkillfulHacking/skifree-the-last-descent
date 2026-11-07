/**
 * Skier physics — a simplified but physically motivated ski model on the heightfield.
 * Fixed-timestep, deterministic, renderer-independent (unit tested).
 *
 * Model summary
 *  - gravity projected onto the local terrain tangent plane;
 *  - skis have a heading; velocity decomposes into along-ski and lateral parts;
 *  - lateral velocity decays at a "grip" rate (carving = high, drift/ice = low) and is
 *    partially redirected along the skis (carving preserves momentum, skidding bleeds it);
 *  - Coulomb snow friction (by surface) + quadratic air drag (CdA depends on tuck);
 *  - pizza (snowplow) adds a progressive braking force; tuck lowers drag and steering authority;
 *  - airborne when the terrain falls away faster than gravity can follow (natural jumps);
 *  - landings evaluate impact speed into the surface and ski/velocity alignment;
 *  - obstacle collisions classify light / heavy / catastrophic contacts.
 */
import * as THREE from 'three';
import { clamp, damp, smoothstep, wrapAngle } from '../core/rng';
import type { ImpactKind, SurfaceType } from '../core/types';
import type { Mountain } from '../world/course';
import type { Obstacle, ObstacleField } from './obstacles';

export const PHYS_DT = 1 / 120;
export const GRAVITY = 9.81;
export const SKIER_RADIUS = 0.38;
export const DRIFT_MIN_SPEED = 9;

export const TUNING = {
  turnRateSlow: 2.5, // rad/s at low speed
  turnRateFast: 1.05, // rad/s at high speed
  tuckTurnPenalty: 0.5,
  driftTurnBoost: 2.2,
  gripCarve: 9.5,
  gripDrift: 3.8,
  carveEfficiency: 0.93,
  driftEfficiency: 0.68,
  mu: { snow: 0.06, packed: 0.04, powder: 0.11, ice: 0.025 } as Record<SurfaceType, number>,
  gripMul: { snow: 1, packed: 1.1, powder: 0.85, ice: 0.32 } as Record<SurfaceType, number>,
  powderDrag: 0.006, // extra v² drag in deep powder
  dragUpright: 0.0085, // 0.5·ρ·CdA/m
  dragTuck: 0.0040,
  brakeBase: 3.8,
  brakeSpeed: 0.12,
  driftDecel: 0.4,
  skatePush: 1.6,
  popBase: 2.0,
  popCharge: 2.4,
  landHard: 8.0,
  landCrash: 11.5,
};

export interface SkierInput {
  steer: number; // -1..1 (+ = right)
  tuck: number; // 0..1
  brake: number; // 0..1
  drift: boolean;
  pop: boolean; // held
  recover: boolean; // pressed
}

export const NO_INPUT: SkierInput = { steer: 0, tuck: 0, brake: 0, drift: false, pop: false, recover: false };

export type SkierEvent =
  | { type: 'takeoff'; speed: number }
  | { type: 'land'; impact: number; hard: boolean; airTime: number; clean: boolean }
  | { type: 'impact'; kind: ImpactKind; intensity: number; x: number; z: number }
  | { type: 'crash'; reason: string; intensity: number }
  | { type: 'pop' }
  | { type: 'recover' }
  | { type: 'trick'; name: string; points: number };

export class SkierState {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  /** Ski heading (yaw). Direction = (sin h, 0, cos h). 0 = straight downhill (+Z). */
  heading = 0;
  grounded = true;
  airTime = 0;
  airStartHeading = 0;
  airSpin = 0;
  crashed = false;
  crashTime = 0;
  recoverTime = 0; // >0 while getting up
  tuck = 0;
  brake = 0;
  drifting = false;
  driftAmount = 0;
  driftAngle = 0;
  popCharge = 0;
  popCooldown = 0;
  landImpact = 0;
  wobble = 0;
  edgeLoad = 0;
  surface: SurfaceType = 'snow';
  normal = new THREE.Vector3(0, 1, 0);
  /** rise/run of the path over the last grounded step */
  pathSlope = 0;
  steerSmoothed = 0;
  lean = 0;
  /** ids of tree canopies currently brushing (to fire one event per contact) */
  touching = new Set<number>();
  // stats
  maxSpeed = 0;
  totalAir = 0;
  longestAir = 0;
  crashes = 0;
  style = 0;
  time = 0;

  get speed(): number {
    return this.vel.length();
  }
}

const _n = { x: 0, y: 1, z: 0 };
const tmpN = new THREE.Vector3();
const tmpF = new THREE.Vector3();
const tmpL = new THREE.Vector3();
const tmpG = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const queryOut: number[] = [];

export class SkierPhysics {
  readonly s = new SkierState();
  events: SkierEvent[] = [];
  /** world-space slide direction while crashed */
  constructor(
    private mountain: Mountain,
    private obstacles: ObstacleField | null,
    private extraColliders: () => ReadonlyArray<{ x: number; z: number; r: number }> = () => [],
  ) {}

  reset(x: number, z: number, heading = 0, speed = 0) {
    const s = this.s;
    Object.assign(s, new SkierState());
    s.pos.set(x, this.mountain.heightAt(x, z), z);
    s.heading = heading;
    s.vel.set(Math.sin(heading) * speed, 0, Math.cos(heading) * speed);
    this.sampleNormal();
    s.vel.addScaledVector(s.normal, -s.vel.dot(s.normal));
    const hs = Math.hypot(s.vel.x, s.vel.z);
    s.pathSlope = hs > 1e-3 ? s.vel.y / hs : -Math.hypot(s.normal.x, s.normal.z) / s.normal.y;
  }

  private sampleNormal() {
    this.mountain.normalAt(this.s.pos.x, this.s.pos.z, _n);
    this.s.normal.set(_n.x, _n.y, _n.z);
  }

  private emit(e: SkierEvent) {
    this.events.push(e);
  }

  step(input: SkierInput, dt = PHYS_DT): void {
    const s = this.s;
    s.time += dt;
    s.popCooldown = Math.max(0, s.popCooldown - dt);
    s.landImpact = Math.max(0, s.landImpact - dt * 2.4);
    s.wobble = Math.max(0, s.wobble - dt * 1.3);
    s.steerSmoothed = damp(s.steerSmoothed, input.steer, 22, dt);

    if (s.crashed) {
      this.stepCrashed(input, dt);
      return;
    }
    if (s.recoverTime > 0) s.recoverTime = Math.max(0, s.recoverTime - dt);
    const control = s.recoverTime > 0 ? 0.35 : 1;

    s.tuck = damp(s.tuck, input.tuck * control, 8, dt);
    s.brake = damp(s.brake, input.brake * control, 9, dt);

    if (s.grounded) this.stepGrounded(input, dt, control);
    else this.stepAir(input, dt);

    this.collide(dt);
    const sp = s.speed;
    if (sp > s.maxSpeed) s.maxSpeed = sp;
  }

  private stepGrounded(input: SkierInput, dt: number, control: number) {
    const s = this.s;
    this.sampleNormal();
    const n = tmpN.copy(s.normal);
    s.surface = this.mountain.surfaceAt(s.pos.x, s.pos.z);
    const surf = s.surface;

    // keep velocity in the tangent plane
    s.vel.addScaledVector(n, -s.vel.dot(n));
    let speed = s.vel.length();

    // --- drift state
    const wantDrift = input.drift && speed > DRIFT_MIN_SPEED;
    if (wantDrift) s.drifting = true;
    else if (!input.drift || speed < DRIFT_MIN_SPEED - 3) s.drifting = false;
    s.driftAmount = damp(s.driftAmount, s.drifting ? 1 : 0, s.drifting ? 7 : 4, dt);

    // --- steering: speed-dependent authority
    const authority = THREE.MathUtils.lerp(TUNING.turnRateSlow, TUNING.turnRateFast, smoothstep(2, 30, speed));
    let rate = authority * (1 - TUNING.tuckTurnPenalty * s.tuck) * (1 + (TUNING.driftTurnBoost - 1) * s.driftAmount);
    rate *= 1 - 0.15 * s.brake;
    rate *= control;
    if (speed < 1.2) rate = 1.9 * control; // pivot / sidestep when nearly stopped
    s.heading = wrapAngle(s.heading - s.steerSmoothed * rate * dt);

    // ski axes in the tangent plane
    const f = tmpF.set(Math.sin(s.heading), 0, Math.cos(s.heading));
    f.addScaledVector(n, -f.dot(n)).normalize();
    const l = tmpL.crossVectors(n, f).normalize();

    // --- lateral grip: decay lateral velocity, redirect part of it along the skis
    let vf = s.vel.dot(f);
    let vl = s.vel.dot(l);
    const pizzaGrip = 1 + 0.25 * s.brake;
    const wobbleGrip = 1 - 0.35 * s.wobble;
    const grip = THREE.MathUtils.lerp(TUNING.gripCarve, TUNING.gripDrift, s.driftAmount) * TUNING.gripMul[surf] * pizzaGrip * wobbleGrip;
    const removed = vl * (1 - Math.exp(-grip * dt));
    const vlNew = vl - removed;
    const eff = THREE.MathUtils.lerp(TUNING.carveEfficiency, TUNING.driftEfficiency, s.driftAmount) * (surf === 'ice' ? 0.85 : 1);
    // The edge force is perpendicular to the ski: it rotates velocity toward the ski axis (no work),
    // minus a skid loss. Energy-consistent: |v| never increases from grip.
    const lateralKE = vl * vl - vlNew * vlNew;
    vf = Math.sign(vf || 1) * Math.sqrt(Math.max(0, vf * vf + lateralKE * eff));
    vl = vlNew;
    s.edgeLoad = damp(s.edgeLoad, clamp(Math.abs(removed) / dt / 14, 0, 1), 10, dt);
    s.vel.copy(f).multiplyScalar(vf).addScaledVector(l, vl);

    // drift visual angle (skis vs travel)
    const travelAngle = Math.atan2(vl, Math.abs(vf) + 1e-3);
    s.driftAngle = damp(s.driftAngle, s.drifting ? clamp(-travelAngle * 2.4 - s.steerSmoothed * 0.55, -1.25, 1.25) : 0, 8, dt);

    // --- gravity along the tangent plane
    tmpG.set(0, -GRAVITY, 0);
    const gN = tmpG.dot(n); // negative
    tmpG.addScaledVector(n, -gN);
    s.vel.addScaledVector(tmpG, dt);

    // --- resistive forces (decelerations opposite to velocity)
    speed = s.vel.length();
    const normalLoad = -gN; // ≈ g cosθ
    let decel = TUNING.mu[surf] * normalLoad;
    const dragK = THREE.MathUtils.lerp(TUNING.dragUpright, TUNING.dragTuck, s.tuck) + 0.0012 * s.brake + (surf === 'powder' ? TUNING.powderDrag : 0);
    decel += dragK * speed * speed;
    decel += s.brake * (TUNING.brakeBase + TUNING.brakeSpeed * speed);
    decel += TUNING.driftDecel * s.driftAmount + 0.55 * Math.abs(vl);
    if (speed > 1e-4) {
      const dv = Math.min(speed, decel * dt);
      s.vel.multiplyScalar((speed - dv) / speed);
    }

    // skating push on flats (tuck input at low speed)
    if (input.tuck > 0.2 && speed < 7 && control > 0.5) {
      s.vel.addScaledVector(f, TUNING.skatePush * input.tuck * dt * (1 - speed / 7));
    }

    // --- pop (Space): charge while held, release to jump
    if (input.pop && s.popCooldown <= 0) {
      s.popCharge = Math.min(1, s.popCharge + dt / 0.45);
    } else if (!input.pop && s.popCharge > 0.05) {
      const imp = TUNING.popBase + TUNING.popCharge * s.popCharge;
      s.vel.addScaledVector(n, imp);
      s.popCharge = 0;
      s.popCooldown = 0.45;
      this.emit({ type: 'pop' });
      this.goAirborne();
      s.pos.addScaledVector(s.vel, dt);
      return;
    } else if (!input.pop) s.popCharge = 0;

    // --- integrate & ground follow / natural takeoff
    // The path slope from the previous step (secant) is the launch direction: sampling the
    // smoothed normal right on a crest would bend the velocity down before the lip.
    const prevY = s.pos.y;
    tmpA.copy(s.pos).addScaledVector(s.vel, dt);
    const hNew = this.mountain.heightAt(tmpA.x, tmpA.z);
    const hd = Math.hypot(tmpA.x - s.pos.x, tmpA.z - s.pos.z);
    const yBallistic = prevY + s.pathSlope * hd - 0.5 * GRAVITY * dt * dt;
    const fallAway = yBallistic - hNew;
    // Leaves the ground when the terrain drops away faster than gravity can follow.
    if (fallAway > 0.006 && speed > 6) {
      const hs = Math.hypot(s.vel.x, s.vel.z);
      s.vel.y = s.pathSlope * hs - GRAVITY * dt;
      s.pos.copy(tmpA);
      s.pos.y = yBallistic;
      this.goAirborne();
      return;
    }
    s.pos.copy(tmpA);
    s.pos.y = hNew;
    if (hd > 1e-5) s.pathSlope = (hNew - prevY) / hd;
    // re-project onto the new tangent plane while conserving speed (compressions)
    let sp0 = s.vel.length();
    this.sampleNormal();
    // compressions (velocity driven into the snow by a concave transition) cost a little speed and
    // load the legs/camera; smooth terrain changes are energy-neutral
    const into = -s.vel.dot(s.normal);
    if (into > 0.4) {
      sp0 *= 1 - Math.min(0.08, 0.018 * into);
      s.landImpact = Math.max(s.landImpact, clamp(into / 8, 0, 0.6));
      if (into > 2.5) s.wobble = Math.max(s.wobble, clamp(into / 10, 0, 0.5));
    }
    s.vel.addScaledVector(s.normal, -s.vel.dot(s.normal));
    const sp1 = s.vel.length();
    if (sp1 > 1e-5) s.vel.multiplyScalar(sp0 / sp1);

    // lean (for animation): centripetal / g, plus steering intent
    const lat = speed * s.steerSmoothed * rate;
    s.lean = damp(s.lean, clamp(Math.atan2(lat, GRAVITY) * 0.9, -0.9, 0.9), 9, dt);
  }

  private goAirborne() {
    const s = this.s;
    s.grounded = false;
    s.airTime = 0;
    s.airStartHeading = s.heading;
    s.airSpin = 0;
    s.drifting = false;
    this.emit({ type: 'takeoff', speed: s.speed });
  }

  private stepAir(input: SkierInput, dt: number) {
    const s = this.s;
    s.airTime += dt;
    // limited mid-air rotation (style spins), no air control of trajectory
    const spinRate = 2.6;
    const dh = -input.steer * spinRate * dt;
    s.heading = wrapAngle(s.heading + dh);
    s.airSpin += dh;
    s.driftAmount = damp(s.driftAmount, 0, 5, dt);
    s.driftAngle = damp(s.driftAngle, 0, 5, dt);
    s.lean = damp(s.lean, 0, 4, dt);
    const sp = s.vel.length();
    const dragK = THREE.MathUtils.lerp(TUNING.dragUpright, TUNING.dragTuck, s.tuck);
    if (sp > 1e-4) s.vel.multiplyScalar(Math.max(0, sp - dragK * sp * sp * dt) / sp);
    s.vel.y -= GRAVITY * dt;
    s.pos.addScaledVector(s.vel, dt);
    const h = this.mountain.heightAt(s.pos.x, s.pos.z);
    if (s.pos.y <= h) {
      s.pos.y = h;
      this.land();
    }
  }

  private land() {
    const s = this.s;
    this.sampleNormal();
    const n = s.normal;
    const vn = -s.vel.dot(n); // impact speed into surface
    s.vel.addScaledVector(n, vn); // remove normal component
    const sp = s.vel.length();
    s.grounded = true;
    s.pathSlope = Math.hypot(s.vel.x, s.vel.z) > 1e-3 ? s.vel.y / Math.hypot(s.vel.x, s.vel.z) : 0;
    const air = s.airTime;
    s.airTime = 0;
    // alignment of skis with travel direction
    let misalign = 0;
    if (sp > 2) {
      const travel = Math.atan2(s.vel.x, s.vel.z);
      misalign = Math.abs(wrapAngle(travel - s.heading));
      // landing switch (backwards) is allowed if nearly aligned backwards
      misalign = Math.min(misalign, Math.PI - misalign + 0.35);
    }
    const tooSideways = misalign > 1.05 && sp > 7;
    if (vn > TUNING.landCrash || tooSideways || (vn > TUNING.landHard && misalign > 0.6)) {
      this.crash(tooSideways ? 'sideways landing' : 'hard landing', clamp(vn / 14, 0.4, 1));
      this.emit({ type: 'land', impact: clamp(vn / 12, 0, 1), hard: true, airTime: air, clean: false });
      return;
    }
    const hard = vn > TUNING.landHard;
    // impact absorbs some speed; skidding landings bleed more
    const loss = clamp(0.015 * vn + (hard ? 0.12 : 0) + misalign * 0.25, 0, 0.55);
    s.vel.multiplyScalar(1 - loss);
    s.landImpact = clamp(vn / 9, 0.15, 1);
    if (hard) s.wobble = Math.max(s.wobble, 0.8);
    if (air > 0.12) {
      s.totalAir += air;
      s.longestAir = Math.max(s.longestAir, air);
    }
    const clean = !hard && misalign < 0.3;
    this.emit({ type: 'land', impact: clamp(vn / 12, 0, 1), hard, airTime: air, clean });
    if (air > 0.45) {
      const spins = Math.round(Math.abs(s.airSpin) / Math.PI);
      let name = air > 1.6 ? 'BIG AIR' : air > 0.9 ? 'AIR' : 'HOP';
      let pts = Math.round(air * 120);
      if (spins >= 2 && misalign < 0.6) {
        name = `${spins * 180}`;
        pts += spins * 150;
      }
      if (clean) pts = Math.round(pts * 1.5);
      s.style += pts;
      this.emit({ type: 'trick', name: clean ? `CLEAN ${name}` : name, points: pts });
    }
  }

  private crash(reason: string, intensity: number) {
    const s = this.s;
    if (s.crashed) return;
    s.crashed = true;
    s.crashTime = 0;
    s.crashes++;
    s.drifting = false;
    s.driftAmount = 0;
    s.tuck = 0;
    s.brake = 0;
    s.popCharge = 0;
    this.emit({ type: 'crash', reason, intensity });
  }

  private stepCrashed(input: SkierInput, dt: number) {
    const s = this.s;
    s.crashTime += dt;
    s.grounded = true;
    this.sampleNormal();
    const n = s.normal;
    s.vel.addScaledVector(n, -s.vel.dot(n));
    tmpG.set(0, -GRAVITY, 0);
    const gN = tmpG.dot(n);
    tmpG.addScaledVector(n, -gN);
    // tumbling body: heavy friction, gravity still pulls on steep ground
    s.vel.addScaledVector(tmpG, dt * 0.6);
    const sp = s.vel.length();
    const decel = 7.5 + 0.02 * sp * sp;
    if (sp > 0) s.vel.multiplyScalar(Math.max(0, sp - decel * dt) / sp);
    s.pos.addScaledVector(s.vel, dt);
    s.pos.y = this.mountain.heightAt(s.pos.x, s.pos.z);
    this.collide(dt);
    const canRecover = s.crashTime > 1.0;
    if ((canRecover && input.recover) || s.crashTime > 3.2) this.recover();
  }

  recover() {
    const s = this.s;
    if (!s.crashed) return;
    s.crashed = false;
    s.crashTime = 0;
    s.recoverTime = 0.7;
    // point the skis down the fall line, or along any remaining momentum
    const sp = s.vel.length();
    if (sp > 2) s.heading = Math.atan2(s.vel.x, s.vel.z);
    else {
      // fall line = horizontal component of the terrain normal
      this.sampleNormal();
      s.heading = Math.atan2(s.normal.x, s.normal.z);
    }
    // don't get up facing straight into a trunk: pick a heading ±60° off any solid obstacle ahead
    if (this.obstacles) {
      this.obstacles.grid.query(s.pos.x, s.pos.z, 3, queryOut);
      for (const id of queryOut) {
        const o = this.obstacles.get(id);
        if (!o || o.kind === 'rock' || o.kind === 'stump') continue;
        const dx = o.x - s.pos.x;
        const dz = o.z - s.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 2.5 + o.r) continue;
        const toObs = Math.atan2(dx, dz);
        const off = wrapAngle(toObs - s.heading);
        if (Math.abs(off) < 1.0) {
          s.heading = wrapAngle(toObs + (off >= 0 ? -1.05 : 1.05));
          s.pos.x -= (dx / Math.max(d, 1e-3)) * 0.3;
          s.pos.z -= (dz / Math.max(d, 1e-3)) * 0.3;
          s.vel.set(Math.sin(s.heading), 0, Math.cos(s.heading)).multiplyScalar(Math.max(1.5, s.vel.length()));
        }
      }
    }
    for (const c of this.extraColliders()) {
      const dx = c.x - s.pos.x;
      const dz = c.z - s.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.5 + c.r) continue;
      const toObs = Math.atan2(dx, dz);
      const off = wrapAngle(toObs - s.heading);
      if (Math.abs(off) < 1.0) s.heading = wrapAngle(toObs + (off >= 0 ? -1.05 : 1.05));
      s.pos.x -= (dx / Math.max(d, 1e-3)) * 0.3;
      s.pos.z -= (dz / Math.max(d, 1e-3)) * 0.3;
    }
    s.vel.multiplyScalar(0.4);
    this.emit({ type: 'recover' });
  }

  // --- collisions -------------------------------------------------------------
  private collide(dt: number) {
    const s = this.s;
    const field = this.obstacles;
    const stillTouching = this.touchB;
    stillTouching.clear();
    this.solidNow.clear();
    if (field) {
      field.grid.query(s.pos.x, s.pos.z, 4, queryOut);
      for (const id of queryOut) {
        const o = field.get(id);
        if (!o) continue;
        this.collideObstacle(o, dt, stillTouching);
        if (s.crashed && !this.s.crashed) break;
      }
    }
    for (const c of this.extraColliders()) {
      const dx = s.pos.x - c.x;
      const dz = s.pos.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < c.r + SKIER_RADIUS && d > 1e-4) this.solidHit(-1 - this.extraIndex(c), dx / d, dz / d, c.r + SKIER_RADIUS - d, 'tree-heavy', c.x, c.z, 9, 4);
    }
    // swap buffers (no per-step allocations)
    this.touchB = s.touching;
    s.touching = stillTouching;
    const t = this.solidPrev;
    this.solidPrev = this.solidNow;
    this.solidNow = t;
  }

  private touchB = new Set<number>();
  private solidPrev = new Set<number>();
  private solidNow = new Set<number>();

  private collideObstacle(o: Obstacle, dt: number, still: Set<number>) {
    const s = this.s;
    const above = s.pos.y - o.y;
    let dx: number;
    let dz: number;
    let dist: number;
    if (o.kind === 'log') {
      const ux = Math.sin(o.rot);
      const uz = Math.cos(o.rot);
      const px = s.pos.x - o.x;
      const pz = s.pos.z - o.z;
      const t = clamp(px * ux + pz * uz, -o.halfLen, o.halfLen);
      dx = px - ux * t;
      dz = pz - uz * t;
      dist = Math.hypot(dx, dz);
    } else {
      dx = s.pos.x - o.x;
      dz = s.pos.z - o.z;
      dist = Math.hypot(dx, dz);
    }
    if (dist < 1e-4) {
      dx = 1;
      dz = 0;
      dist = 1e-4;
    }
    const nx = dx / dist;
    const nz = dz / dist;

    // branches: soft contact (trees only), skier clears if well above the canopy
    if (o.kind === 'tree' && dist < o.softR + 0.25 && above < o.height * 0.9) {
      still.add(o.id);
      if (!s.crashed) {
        const depth = clamp(1 - (dist - o.r) / (o.softR - o.r + 0.25), 0, 1);
        const sp = s.speed;
        if (sp > 0.1) s.vel.multiplyScalar(Math.max(0, sp - (3 + 0.12 * sp) * depth * dt) / sp);
        s.wobble = Math.max(s.wobble, 0.35 + 0.5 * depth);
        if (!s.touching.has(o.id)) this.emit({ type: 'impact', kind: 'branch', intensity: clamp(sp / 20, 0.2, 1), x: o.x, z: o.z });
      }
    }

    const coreR = o.r + SKIER_RADIUS;
    if (dist >= coreR) return;
    if (above > o.height + 0.05) return; // cleared it (jumped over)

    const pen = coreR - dist;
    switch (o.kind) {
      case 'tree':
        this.solidHit(o.id, nx, nz, pen, 'tree-heavy', o.x, o.z, 8.5, 3.5);
        break;
      case 'boulder':
        this.solidHit(o.id, nx, nz, pen, 'rock-heavy', o.x, o.z, 9, 3.5);
        break;
      case 'log':
        this.solidHit(o.id, nx, nz, pen, 'log', o.x, o.z, 6, 2.5);
        break;
      case 'rock':
      case 'stump': {
        // small: knocks you about; jumping over is possible; fast hits can trip you
        const vn = -(s.vel.x * nx + s.vel.z * nz);
        s.pos.x += nx * pen;
        s.pos.z += nz * pen;
        if (vn > 0 && !s.crashed) {
          if (vn > 15 && s.grounded) {
            this.crash('caught a rock', 0.8);
            this.emit({ type: 'impact', kind: 'rock-heavy', intensity: 1, x: o.x, z: o.z });
          } else {
            s.vel.x += nx * vn * 0.6;
            s.vel.z += nz * vn * 0.6;
            s.vel.multiplyScalar(0.82);
            if (s.grounded && vn > 4) {
              s.vel.y += 1.4; // bump
            }
            s.wobble = Math.max(s.wobble, 0.7);
            this.emit({ type: 'impact', kind: 'rock-light', intensity: clamp(vn / 12, 0.2, 1), x: o.x, z: o.z });
          }
        }
        break;
      }
    }
  }

  /** Solid contact: classifies by approach speed into light / heavy / catastrophic. */
  private extraIndex(c: { x: number; z: number }): number {
    return Math.abs(Math.round(c.x * 7 + c.z * 13)) % 100000;
  }

  private solidHit(id: number, nx: number, nz: number, pen: number, kind: ImpactKind, ox: number, oz: number, crashAt: number, heavyAt: number) {
    const s = this.s;
    s.pos.x += nx * pen;
    s.pos.z += nz * pen;
    this.solidNow.add(id);
    const fresh = !this.solidPrev.has(id);
    const vn = -(s.vel.x * nx + s.vel.z * nz);
    if (vn <= 0) return;
    if (s.crashed) {
      // tumbling body stops against it
      s.vel.x += nx * vn;
      s.vel.z += nz * vn;
      s.vel.multiplyScalar(0.5);
      return;
    }
    if (vn >= crashAt) {
      s.vel.x += nx * vn * 1.15;
      s.vel.z += nz * vn * 1.15;
      s.vel.multiplyScalar(0.3);
      this.emit({ type: 'impact', kind, intensity: 1, x: ox, z: oz });
      this.crash(kind === 'log' ? 'tripped on a log' : kind === 'rock-heavy' ? 'hit a boulder' : 'hit a tree', 1);
      return;
    }
    if (vn >= heavyAt) {
      s.vel.x += nx * vn * 1.25;
      s.vel.z += nz * vn * 1.25;
      s.vel.multiplyScalar(0.62);
      s.wobble = 1;
      this.emit({ type: 'impact', kind, intensity: clamp(vn / crashAt, 0.4, 0.95), x: ox, z: oz });
      return;
    }
    // light glancing contact: remove only the inward component, mild friction, small outward push
    // (never pins the skier against a trunk)
    s.vel.x += nx * (vn + 0.6);
    s.vel.z += nz * (vn + 0.6);
    s.vel.multiplyScalar(Math.exp(-1.5 * PHYS_DT));
    s.wobble = Math.max(s.wobble, 0.4);
    if (fresh || vn > 1.5) this.emit({ type: 'impact', kind: kind === 'tree-heavy' ? 'branch' : 'rock-light', intensity: clamp(vn / heavyAt, 0.1, 0.4), x: ox, z: oz });
  }

  /** Test hook: force a crash (used by balance simulations). */
  forceCrash(reason = 'test') {
    this.crash(reason, 1);
  }

  /** Debug/test: place the skier. */
  teleport(x: number, z: number, heading: number, speed: number) {
    this.reset(x, z, heading, speed);
  }

  drainEvents(): SkierEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
