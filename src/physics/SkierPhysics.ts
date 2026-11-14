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
 *  - obstacle collisions classify light / heavy / catastrophic contacts;
 *  - terrain steeper than TERRAIN_CONTACT.wallDeg that the skier moves into is a WALL, not a ramp: the step is
 *    blocked, the velocity into the face is removed (light / heavy / crash like a boulder) and the
 *    skier slides along it; ground snapping never creates mechanical energy beyond a tiny
 *    discretisation allowance (see groundFollow / wallHit);
 *  - a location (biome) changes the feel only through ONE hook, the optional PhysicsEnvironment
 *    (./environment.ts): surface modifiers, crosswind, balance, hazard knocks/crashes. With no
 *    environment, or Alpine's identity one, every number below is used unchanged.
 */
import * as THREE from 'three';
import { clamp, damp, smoothstep, wrapAngle } from '../core/rng';
import type { ImpactKind, SurfaceType } from '../core/types';
import type { Mountain } from '../world/course';
import type { Obstacle, ObstacleField } from './obstacles';
import { makeEnvQuery, makeEnvSample, type EnvSample, type PhysicsEnvironment } from './environment';

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

/** How a grounded side-slip (EnvSample.groundSlip*) takes hold, by what the skier is doing. */
export const SLIP_EDGE = { base: 1, tuck: 0.6, brake: 0.45, drift: 0.6 } as const;

/**
 * Terrain-contact limits (engine-wide, every location).
 *  - wallDeg: terrain the skier would have to climb more steeply than this in one step is a wall.
 *    Pistes, kickers, rollers and banks are far below it (steepest grounded climb seen in normal
 *    Alpine runs: rise/run 0.10, ≈ 6°); cave cliff faces and cliff-band sides are far above it.
 *  - snapExcessTol: how far (m) one step's ground snap may lift the skier above the straight-line
 *    prediction before the extra height is paid for out of kinetic energy. Smooth terrain stays well
 *    under it (normal-run max 0.013 m), so only kinks pay; the most energy one step can gain from
 *    snapping is g·snapExcessTol ≈ 0.25 J/kg.
 *  - Wall impacts use the boulder thresholds (normal speed into the face, m/s).
 */
/** pinned-against-a-wall rescue (SkierPhysics.pinWatchdog): seconds without getting `escape` m away, wall contact within `contact` s */
export const PIN_WATCH = { window: 4, escape: 3, contact: 1, offPiste: 10 };

export const TERRAIN_CONTACT = {
  wallDeg: 50,
  wallSlope: Math.tan((50 * Math.PI) / 180),
  snapExcessTol: 0.025,
  /**
   * most mechanical energy a takeoff step may gain from turning the velocity to the path's secant
   * slope: takeoffTolJ J/kg + takeoffTolFrac of the kinetic energy. Real kicker lips gain up to
   * 1.97 % (6.1 J/kg at 25 m/s; crests are slightly convex); steep-face and cave-mouth "launches"
   * gained 8–155 % before this cap.
   */
  takeoffTolJ: 2,
  takeoffTolFrac: 0.03,
  /**
   * most the path slope (rise/run) may steepen in one grounded step; more is a ledge, not a curve
   * (normal-run max 0.094; a one-step 20 cm ledge at a cave mouth is ≈ 1.2)
   */
  maxSlopeStep: 0.25,
  wallCos: Math.cos((50 * Math.PI) / 180),
  /**
   * an oblique contact with a wall-steep face counts once the skier would climb it faster than
   * wallClimbMax m/s, or heads into it at more than wallIntoFrac of the speed (sliding along its foot,
   * on a contour, does not count)
   */
  wallClimbMax: 0.3,
  wallIntoFrac: 0.03,
  /** stencil (m) for the face's own slope and orientation (wall test and wall response) */
  faceProbe: 0.1,
  /** a wall must rise at least this far (m) above the skier within wallProbe m: lower steps are bumps */
  wallMinRise: 0.5,
  wallProbe: 0.5,
  wallCrash: 9,
  wallHeavy: 3.5,
  /** the terrain-normal stencil half-width (m), as Mountain.normalAt; see sampleNormal */
  normalEps: 0.35,
  /**
   * concavity (m, sum of both side rises over ±normalEps) that marks the foot of a wall rather than
   * a curve; normal Alpine runs peak at 0.064 (kicker transitions)
   */
  kinkRise: 0.15,
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
  /** put back on the piste after going out of bounds (see SkierPhysics.relocate) */
  | { type: 'relocate'; reason: string; x: number; z: number }
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
  /** crashed against a wall in mid-air: the body falls to the ground before it can recover */
  crashFalling = false;
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
  /** last time (s) a grounded wall contact happened (TERRAIN_CONTACT walls) */
  wallContactT = -1e9;
  /** pinned-against-a-wall watchdog: where the skier was when the current 4 s window began */
  pinAnchorX = 0;
  pinAnchorZ = 0;
  pinAnchorT = 0;
  /** since when (s) the player has been continuously trying to move (tuck/skate or steer held) */
  pushSince = 0;

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
  /** what the location did to the skier this step (identity without an environment) */
  readonly envOut: EnvSample = makeEnvSample();
  private envQ = makeEnvQuery();
  constructor(
    private mountain: Mountain,
    private obstacles: ObstacleField | null,
    private extraColliders: () => ReadonlyArray<{ x: number; z: number; r: number }> = () => [],
    /** the location's physics hook (surface, wind, hazards); null = original physics */
    readonly env: PhysicsEnvironment | null = null,
  ) {}

  reset(x: number, z: number, heading = 0, speed = 0) {
    const s = this.s;
    Object.assign(s, new SkierState());
    this.env?.reset?.();
    s.pos.set(x, this.mountain.heightAt(x, z), z);
    s.heading = heading;
    s.vel.set(Math.sin(heading) * speed, 0, Math.cos(heading) * speed);
    this.sampleNormal();
    s.vel.addScaledVector(s.normal, -s.vel.dot(s.normal));
    const hs = Math.hypot(s.vel.x, s.vel.z);
    s.pathSlope = hs > 1e-3 ? s.vel.y / hs : -Math.hypot(s.normal.x, s.normal.z) / s.normal.y;
  }

  /**
   * Terrain normal under the skier: central differences ±normalEps (the same stencil and arithmetic as
   * Mountain.normalAt), except beside the foot of a wall. There the stencil would blend the face into
   * the floor and turn horizontal speed into vertical; on an axis with a sharp concave kink (see
   * kinkRise) the one-sided difference on the lower (floor) side is used instead. Skiable terrain never
   * has such kinks, so everywhere else the result is bit-identical to Mountain.normalAt.
   */
  private sampleNormal() {
    const m = this.mountain;
    const s = this.s;
    const x = s.pos.x;
    const z = s.pos.z;
    const e = TERRAIN_CONTACT.normalEps;
    const hl = m.heightAt(x - e, z);
    const hr = m.heightAt(x + e, z);
    const hd = m.heightAt(x, z - e);
    const hu = m.heightAt(x, z + e);
    let nx = hl - hr;
    let nz = hd - hu;
    const ny = 2 * e;
    // a sharp concave kink on an axis (both sides together rise more than kinkRise above the skier,
    // the steep one too): take the slope on the lower side only, i.e. the floor's
    const K = TERRAIN_CONTACT.kinkRise;
    const y = s.pos.y;
    const dl = hl - y;
    const dr = hr - y;
    if (dl + dr > K && Math.max(dl, dr) > K) nx = dr > dl ? 2 * dl : -2 * dr;
    const dd = hd - y;
    const du = hu - y;
    if (dd + du > K && Math.max(dd, du) > K) nz = du > dd ? 2 * dd : -2 * du;
    const l = Math.hypot(nx, ny, nz);
    s.normal.set(nx / l, ny / l, nz / l);
  }

  /**
   * Is the terrain at (x1, z1) — one step from (x0, z0), where the skier was at height y0, moving with
   * horizontal velocity (vx, vz) — a wall? Either the step itself climbs more steeply than wallSlope
   * (head-on), or it climbs onto a face steeper than wallDeg while moving into it (oblique: a face
   * that steep cannot be traversed or edged up either). And the face must rise more than wallMinRise
   * above the skier within wallProbe (a low step is a bump to ride over). Only climbing steps pay for
   * the closer look; on skiable terrain it always answers no.
   */
  private isWall(y0: number, x0: number, z0: number, x1: number, z1: number, h1: number, ref: boolean, vx: number, vz: number): boolean {
    const T = TERRAIN_CONTACT;
    const hd = Math.hypot(x1 - x0, z1 - z0);
    if (h1 - y0 <= 1e-4) return false; // only a step that climbs can meet a wall
    const base = ref ? this.groundRef(y0, x0, z0) : y0;
    if (h1 - base <= 1e-4) return false;
    this.mountain.normalAt(x1, z1, _n, T.faceProbe); // a tight stencil: the face's own orientation
    let steep = h1 - base > T.wallSlope * hd + 1e-4;
    const gl = Math.hypot(_n.x, _n.z);
    if (!steep && gl > 1e-6) {
      // oblique: the face's slope at and just uphill of (x1, z1)
      const ux = -_n.x / gl;
      const uz = -_n.z / gl;
      const d = T.faceProbe;
      const face = Math.max(gl / _n.y, (this.mountain.heightAt(x1 + ux * d, z1 + uz * d) - h1) / d);
      if (face > T.wallSlope) {
        // really moving into it: fast enough to climb it (rate = into · face slope), or at a real angle
        // (sliding along its foot, on a contour, is fine)
        const into = vx * ux + vz * uz;
        steep = into * face > T.wallClimbMax || into > T.wallIntoFrac * Math.hypot(vx, vz);
      }
    }
    if (!steep) return false;
    if (h1 - base > T.wallMinRise) return true;
    // tall enough? probe up the face (its gradient) and straight on
    if (gl > 1e-6 && this.mountain.heightAt(x1 - (_n.x / gl) * T.wallProbe, z1 - (_n.z / gl) * T.wallProbe) - base > T.wallMinRise) return true;
    const k = hd > 1e-9 ? T.wallProbe / hd : 0;
    return this.mountain.heightAt(x1 + (x1 - x0) * k, z1 + (z1 - z0) * k) - base > T.wallMinRise;
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

    if (!s.crashed && s.grounded) s.surface = this.mountain.surfaceAt(s.pos.x, s.pos.z);
    // the location's single physics hook (see ./environment.ts)
    const E = this.envOut;
    if (this.env) {
      const q = this.envQ;
      q.x = s.pos.x;
      q.y = s.pos.y;
      q.z = s.pos.z;
      q.vx = s.vel.x;
      q.vy = s.vel.y;
      q.vz = s.vel.z;
      q.speed = s.vel.length();
      q.grounded = s.grounded;
      q.crashed = s.crashed;
      q.surface = s.surface;
      q.t = s.time;
      q.tuck = s.tuck;
      this.env.sample(q, E);
      if (E.relocate) this.relocate(E.relocate.x, E.relocate.z, E.relocate.reason);
      else if (E.crash && !s.crashed) this.crash(E.crash.reason, E.crash.intensity);
      else if (E.knock) this.knock(E.knock.keep, E.knock.wobble);
    }
    this.pinWatchdog(input);

    if (s.crashed) {
      this.stepCrashed(input, dt);
      return;
    }
    if (s.recoverTime > 0) s.recoverTime = Math.max(0, s.recoverTime - dt * E.surface.recovery);
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
    const surf = s.surface; // sampled in step()
    const E = this.envOut;
    const M = E.surface;
    if (E.balance > 0) s.wobble = Math.max(s.wobble, E.balance);

    // keep velocity in the tangent plane
    s.vel.addScaledVector(n, -s.vel.dot(n));
    let speed = s.vel.length();

    // --- drift state
    const driftMin = DRIFT_MIN_SPEED * M.driftThreshold;
    const wantDrift = input.drift && speed > driftMin;
    if (wantDrift) s.drifting = true;
    else if (!input.drift || speed < driftMin - 3) s.drifting = false;
    s.driftAmount = damp(s.driftAmount, s.drifting ? 1 : 0, s.drifting ? 7 : 4, dt);

    // --- steering: speed-dependent authority
    const authority = THREE.MathUtils.lerp(TUNING.turnRateSlow, TUNING.turnRateFast, smoothstep(2, 30, speed));
    let rate = authority * (1 - TUNING.tuckTurnPenalty * s.tuck) * (1 + (TUNING.driftTurnBoost - 1) * s.driftAmount);
    rate *= 1 - 0.15 * s.brake;
    rate *= control;
    rate /= M.carveRadius;
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
    // no edge holds on a face steeper than a wall: the skier slides down it (never on skiable terrain)
    const faceGrip = n.y < TERRAIN_CONTACT.wallCos ? 0 : 1;
    const grip = THREE.MathUtils.lerp(TUNING.gripCarve, TUNING.gripDrift, s.driftAmount) * TUNING.gripMul[surf] * pizzaGrip * wobbleGrip * M.grip * faceGrip;
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
    let decel = TUNING.mu[surf] * M.friction * normalLoad;
    const dragK = THREE.MathUtils.lerp(TUNING.dragUpright, TUNING.dragTuck, s.tuck) + 0.0012 * s.brake + (surf === 'powder' ? TUNING.powderDrag : 0) + M.dragAdd;
    decel += dragK * speed * speed;
    decel += s.brake * (TUNING.brakeBase + TUNING.brakeSpeed * speed) * M.brake;
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
    if (!this.groundFollow(dt, speed)) return; // took off, or crashed into a wall

    // lean (for animation): centripetal / g, plus steering intent
    const lat = speed * s.steerSmoothed * rate;
    s.lean = damp(s.lean, clamp(Math.atan2(lat, GRAVITY) * 0.9, -0.9, 0.9), 9, dt);
  }

  /**
   * Move one grounded step along the terrain. Returns false when the skier left the ground or
   * crashed (the caller stops there).
   *
   * The path slope from the previous step (secant) is the launch direction: sampling the smoothed
   * normal right on a crest would bend the velocity down before the lip.
   *
   * Energy rules (the cave-wall launch fix): the step never climbs a face steeper than
   * TERRAIN_CONTACT.wallSlope (that is a wall: wallHit), a snap that lifts the skier above the
   * straight-line prediction by more than snapExcessTol pays for the extra height out of kinetic
   * energy, a one-step ledge does not become the launch direction (maxSlopeStep), and a takeoff gains
   * at most takeoffTolJ + takeoffTolFrac of the kinetic energy (the secant launch's own slack).
   */
  private groundFollow(dt: number, speed: number): boolean {
    const s = this.s;
    const T = TERRAIN_CONTACT;
    for (let attempt = 0; ; attempt++) {
      const prevY = s.pos.y;
      tmpA.copy(s.pos).addScaledVector(s.vel, dt);
      // a location's side-slip (a squall blowing the snow out from under the skis): moves the skier
      // without changing their speed. Biting edges (pizza) resist it; a tuck or a drift gives it more.
      const E = this.envOut;
      if (E.groundSlipX !== 0 || E.groundSlipZ !== 0) {
        const k = SLIP_EDGE.base * (1 + SLIP_EDGE.tuck * s.tuck) * (1 - SLIP_EDGE.brake * s.brake) * (1 + SLIP_EDGE.drift * s.driftAmount);
        tmpA.x += E.groundSlipX * k * dt;
        tmpA.z += E.groundSlipZ * k * dt;
      }
      const hNew = this.mountain.heightAt(tmpA.x, tmpA.z);
      const hd = Math.hypot(tmpA.x - s.pos.x, tmpA.z - s.pos.z);
      // a face too steep to ski up: collide with it instead of climbing it (one retry along the face)
      if (this.isWall(prevY, s.pos.x, s.pos.z, tmpA.x, tmpA.z, hNew, true, s.vel.x, s.vel.z)) {
        if (!this.wallHit(tmpA.x, tmpA.z, true)) return false;
        // the path now runs along the floor in the new direction (not up the face it never climbed)
        const hs = Math.hypot(s.vel.x, s.vel.z);
        s.pathSlope = hs > 1e-3 ? s.vel.y / hs : 0;
        if (attempt === 0) continue;
        // still against the face: stay put this step, and stop (round 4, B r4 #1: a skier left
        // here kept a non-zero velocity while not moving — frozen, unable to skate away)
        s.vel.set(0, 0, 0);
        return true;
      }
      const yBallistic = prevY + s.pathSlope * hd - 0.5 * GRAVITY * dt * dt;
      const fallAway = yBallistic - hNew;
      // Leaves the ground when the terrain drops away faster than gravity can follow.
      if (fallAway > 0.006 && speed > 6) {
        const sp = s.vel.length();
        const hs = Math.hypot(s.vel.x, s.vel.z);
        const vyTangent = s.vel.y;
        s.vel.y = s.pathSlope * hs - GRAVITY * dt;
        // The launch direction comes from the path, but the takeoff may not gain energy: kinetic plus
        // the height above where the velocity was heading stays within the takeoff tolerance.
        const lift = GRAVITY * (yBallistic - prevY - vyTangent * dt);
        const out2 = s.vel.lengthSq();
        const tol = T.takeoffTolJ + T.takeoffTolFrac * 0.5 * sp * sp;
        if (0.5 * (out2 - sp * sp) + lift > tol && out2 > 1e-12) s.vel.multiplyScalar(Math.sqrt(Math.max(0, sp * sp + 2 * (tol - lift)) / out2));
        s.pos.copy(tmpA);
        s.pos.y = yBallistic;
        this.goAirborne();
        return false;
      }
      const predictedY = prevY + s.vel.y * dt;
      const px = s.pos.x;
      const pz = s.pos.z;
      s.pos.copy(tmpA);
      s.pos.y = hNew;
      // the path slope is the next launch direction: a one-step ledge (the secant jumping up far more
      // than any curve can turn in one step) is a bump to ride over, not a ramp to launch from
      if (hd > 1e-5) s.pathSlope = Math.min((hNew - prevY) / hd, s.pathSlope + T.maxSlopeStep);
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
      // a kink lifted the skier above where the velocity was heading: that height is not free
      let excess = hNew - predictedY - T.snapExcessTol;
      if (excess > 0) excess = hNew - (predictedY - prevY + this.groundRef(prevY, px, pz)) - T.snapExcessTol;
      if (excess > 0) sp0 = Math.sqrt(Math.max(0, sp0 * sp0 - 2 * GRAVITY * excess));
      s.vel.addScaledVector(s.normal, -s.vel.dot(s.normal));
      const sp1 = s.vel.length();
      if (sp1 > 1e-5) s.vel.multiplyScalar(sp0 / sp1);
      return true;
    }
  }

  /**
   * Height the skier's last step really started from: its y, or the ground under it if an obstacle
   * push moved it sideways onto higher ground since (pushes change x/z only). Only evaluated when a
   * cheap test against y alone has already fired, so normal steps pay nothing for it.
   */
  private groundRef(y: number, x: number, z: number): number {
    return Math.max(y, this.mountain.heightAt(x, z));
  }

  /**
   * Contact with terrain too steep to ride (a cliff or cave wall) at (x, z), which the skier was
   * about to move into. Removes the horizontal velocity into the face like a boulder contact
   * (light: slide along it; heavy: bounce and lose speed; at ≥ wallCrash m/s: crash). The skier's
   * position is not changed (the step into the face is cancelled). Never adds energy.
   * Returns false if the skier crashed.
   */
  private wallHit(x: number, z: number, grounded: boolean): boolean {
    const s = this.s;
    const T = TERRAIN_CONTACT;
    if (grounded) s.wallContactT = s.time;
    // face normal (horizontal, pointing out of the face) from the terrain gradient there, on the same
    // tight stencil as the wall test (the ±0.35 m one would blend in the floor's own fall line)
    this.mountain.normalAt(x, z, _n, TERRAIN_CONTACT.faceProbe);
    const nl = Math.hypot(_n.x, _n.z);
    if (nl < 1e-6) return true;
    const nx = _n.x / nl;
    const nz = _n.z / nl;
    const vn = -(s.vel.x * nx + s.vel.z * nz); // speed into the face
    if (vn <= 0) return true;
    if (s.crashed) {
      s.vel.x += nx * vn;
      s.vel.z += nz * vn;
      s.vel.multiplyScalar(0.5);
      return false;
    }
    const sp0 = s.vel.length();
    if (vn >= T.wallCrash) {
      s.vel.x += nx * vn;
      s.vel.z += nz * vn;
      s.vel.multiplyScalar(0.3);
      this.emit({ type: 'impact', kind: 'rock-heavy', intensity: 1, x, z });
      this.crash('hit the cliff', 1);
      return false;
    }
    if (vn >= T.wallHeavy) {
      // bounce off a little, but never faster than before the hit
      s.vel.x += nx * vn * 1.25;
      s.vel.z += nz * vn * 1.25;
      s.vel.multiplyScalar(0.62);
      s.wobble = 1;
      this.emit({ type: 'impact', kind: 'rock-heavy', intensity: clamp(vn / T.wallCrash, 0.4, 0.95), x, z });
    } else {
      s.vel.x += nx * vn;
      s.vel.z += nz * vn;
      s.vel.multiplyScalar(Math.exp(-1.5 * PHYS_DT));
      s.wobble = Math.max(s.wobble, 0.4);
      if (vn > 1.5) this.emit({ type: 'impact', kind: 'rock-light', intensity: clamp(vn / T.wallHeavy, 0.1, 0.4), x, z });
    }
    const sp1 = s.vel.length();
    if (sp1 > sp0 && sp1 > 1e-9) s.vel.multiplyScalar(sp0 / sp1);
    if (grounded) {
      // back into the floor's tangent plane (the floor under the skier, not the face)
      this.sampleNormal();
      const n = s.normal;
      const before = s.vel.length();
      s.vel.addScaledVector(n, -s.vel.dot(n));
      const after = s.vel.length();
      if (after > before && after > 1e-9) s.vel.multiplyScalar(before / after);
    }
    return true;
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
    // crosswind (zero unless the location's weather couples to physics)
    const E = this.envOut;
    if (E.airAccelX !== 0 || E.airAccelZ !== 0) {
      s.vel.x += E.airAccelX * dt;
      s.vel.z += E.airAccelZ * dt;
    }
    s.vel.y -= GRAVITY * dt;
    const px = s.pos.x;
    const py = s.pos.y;
    const pz = s.pos.z;
    s.pos.addScaledVector(s.vel, dt);
    let h = this.mountain.heightAt(s.pos.x, s.pos.z);
    if (s.pos.y <= h) {
      // flew into a face too steep to land on (it rises above where the skier just was): a wall hit,
      // not a landing on top of it — the step into the face is cancelled and the skier falls beside it
      if (this.isWall(py, px, pz, s.pos.x, s.pos.z, h, false, s.vel.x, s.vel.z)) {
        const ok = this.wallHit(s.pos.x, s.pos.z, false);
        s.pos.x = px;
        s.pos.z = pz;
        h = this.mountain.heightAt(px, pz);
        if (!ok) {
          s.crashFalling = s.pos.y > h;
          if (!s.crashFalling) s.pos.y = h;
          return;
        }
        if (s.pos.y > h) return;
      }
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
    if (s.crashFalling) {
      // knocked off a wall in mid-air: fall (no recovery until on the ground)
      s.vel.y -= GRAVITY * dt;
      const px = s.pos.x;
      const py = s.pos.y;
      const pz = s.pos.z;
      s.pos.addScaledVector(s.vel, dt);
      let h = this.mountain.heightAt(s.pos.x, s.pos.z);
      if (s.pos.y <= h && this.isWall(py, px, pz, s.pos.x, s.pos.z, h, false, s.vel.x, s.vel.z)) {
        this.wallHit(s.pos.x, s.pos.z, false);
        s.pos.x = px;
        s.pos.z = pz;
        h = this.mountain.heightAt(px, pz);
      }
      if (s.pos.y <= h) {
        s.pos.y = h;
        s.crashFalling = false;
        s.crashTime = Math.min(s.crashTime, 0.5);
        this.sampleNormal();
        s.vel.addScaledVector(s.normal, -s.vel.dot(s.normal));
        s.vel.multiplyScalar(0.4);
      }
      return;
    }
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
    const px = s.pos.x;
    const py = s.pos.y;
    const pz = s.pos.z;
    s.pos.addScaledVector(s.vel, dt);
    const h = this.mountain.heightAt(s.pos.x, s.pos.z);
    if (this.isWall(py, px, pz, s.pos.x, s.pos.z, h, true, s.vel.x, s.vel.z)) {
      // a tumbling body stops against a wall instead of climbing it
      this.wallHit(s.pos.x, s.pos.z, false);
      s.pos.x = px;
      s.pos.z = pz;
      s.pos.y = this.mountain.heightAt(px, pz);
    } else s.pos.y = h;
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

  /**
   * Engine-wide pinned-against-a-wall rescue (round 4, reviewer B r4 #1: the wall rule can leave a
   * skier in a pocket at the foot of a steep face — a cave mouth, a cliff foot — that they cannot
   * skate out of, before any Yeti comes). Like the Fjord cornice stall: if the skier has been in
   * touch with a wall within the last second and has not got 3 m away from where they were 4 s
   * ago, they are put back on the piste. A skier who stops deliberately on open snow is never moved
   * (no wall contact), and anyone skating along or away from a face gets clear of the window.
   */
  private pinWatchdog(input: SkierInput) {
    const s = this.s;
    // (round 9, B r8 #1: a held steer key alone counted as pushing — a player standing still on open
    // snow, turning or holding brake plus a direction, was teleported and given a crash. Only skating
    // forward (tuck, no brake) is trying to get going)
    if (!(input.tuck > 0.5 && input.brake < 0.3)) s.pushSince = s.time;
    if (s.crashed || !s.grounded || Math.hypot(s.pos.x - s.pinAnchorX, s.pos.z - s.pinAnchorZ) > PIN_WATCH.escape) {
      s.pinAnchorX = s.pos.x;
      s.pinAnchorZ = s.pos.z;
      s.pinAnchorT = s.time;
      return;
    }
    if (s.time - s.pinAnchorT <= PIN_WATCH.window) return;
    const z = s.pos.z;
    const rx = this.mountain.routeX(z);
    // boxed in against a face, or trying to get going (pushing/steering the whole window) off the
    // piste and getting nowhere — a pocket at a cave mouth or a cliff foot
    const walled = s.time - s.wallContactT < PIN_WATCH.contact;
    const stranded = s.time - s.pushSince > PIN_WATCH.window && Math.abs(s.pos.x - rx) > PIN_WATCH.offPiste;
    if (walled || stranded) {
      this.relocate(rx, z, 'pinned against the rock', false);
      s.pinAnchorX = s.pos.x;
      s.pinAnchorZ = s.pos.z;
      s.pinAnchorT = s.time;
    }
  }

  /**
   * Out of bounds (the location's rule, e.g. over a sea cliff's crest): put the skier back on the
   * piste at (x, z), stopped and crashed (they get up facing downhill), keeping the run's stats.
   */
  relocate(x: number, z: number, reason: string, crash = true) {
    const s = this.s;
    s.pos.set(x, this.mountain.heightAt(x, z), z);
    s.vel.set(0, 0, 0);
    s.grounded = true;
    s.airTime = 0;
    s.airSpin = 0;
    s.pathSlope = 0;
    s.crashFalling = false;
    s.touching.clear();
    this.emit({ type: 'relocate', reason, x, z });
    s.crashed = false;
    // (round 9, E r8 #1: being boxed in by the terrain is not the player's mistake — the pin rescue
    // puts them back standing, with no wipeout and no multiplier loss)
    if (crash) this.crash(reason, 0.6);
    s.heading = 0;
  }

  /** Struck by something (a Yeti snowball): keep `keep` of the speed and stagger. */
  knock(keep: number, wobble: number) {
    const s = this.s;
    if (s.crashed) return;
    s.vel.x *= keep;
    s.vel.z *= keep;
    s.wobble = Math.max(s.wobble, wobble);
    s.tuck = 0;
    s.drifting = false;
    s.driftAmount = 0;
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
