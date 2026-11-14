/**
 * RunTelemetry: turns the skier's validated per-step physics state into gameplay events
 * (DistanceReached, JumpLanded, DriftCompleted, PizzaBraking, ObstacleHit, Crashed). Kept out of
 * GameSession so the session only forwards a few hooks, and so it is unit-testable without a
 * renderer (it only reads plain numbers from the skier state).
 */
import type { SkierEvent } from '../physics/SkierPhysics';
import type { SurfaceType } from '../core/types';
import { PIZZA_CHUNK, type EventBus } from './events';

/** Minimum brake input that counts as deliberate pizza braking. */
export const PIZZA_MIN_BRAKE = 0.5;
/** Pizza braking only counts above this speed (m/s): standing still with the skis in a wedge is not braking. */
export const PIZZA_MIN_SPEED = 2;
/** Jumps shorter than this (s) are terrain hops and are not reported (same cut as the airtime stats). */
export const JUMP_MIN_AIR = 0.12;
/** Drifts shorter than this (s) are not reported. */
export const DRIFT_MIN_TIME = 0.25;
export const MILESTONE = 1000;

/** The subset of SkierState the telemetry reads (all validated physics output). */
export interface TelemetryState {
  pos: { x: number; z: number };
  speed: number;
  grounded: boolean;
  crashed: boolean;
  drifting: boolean;
  brake: number;
  surface: SurfaceType;
}

export class RunTelemetry {
  private nextMilestone = MILESTONE;
  private pizzaAcc = 0;
  private takeoff: { x: number; z: number } | null = null;
  private drift: { t: number; dist: number; bySurface: Map<SurfaceType, number> } | null = null;
  private lastX = 0;
  private lastZ = 0;
  private started = false;

  constructor(private bus: EventBus) {}

  /** Call once per fixed physics step, after the physics step and its events were handled. */
  step(s: TelemetryState, dt: number) {
    const dx = this.started ? s.pos.x - this.lastX : 0;
    const dz = this.started ? s.pos.z - this.lastZ : 0;
    this.started = true;
    this.lastX = s.pos.x;
    this.lastZ = s.pos.z;
    // milestones (a debug teleport crosses several at once: each is reported)
    while (s.pos.z >= this.nextMilestone) {
      this.bus.emit({ type: 'DistanceReached', meters: this.nextMilestone });
      this.nextMilestone += MILESTONE;
    }
    // controlled pizza: grounded, upright, not drifting, really braking at speed
    if (s.grounded && !s.crashed && !s.drifting && s.brake >= PIZZA_MIN_BRAKE && s.speed > PIZZA_MIN_SPEED) {
      this.pizzaAcc += Math.min(Math.hypot(dx, dz), s.speed * dt * 1.5);
      if (this.pizzaAcc >= PIZZA_CHUNK) {
        this.bus.emit({ type: 'PizzaBraking', distance: PIZZA_CHUNK });
        this.pizzaAcc -= PIZZA_CHUNK;
      }
    }
    // drifts
    if (s.drifting && s.grounded && !s.crashed) {
      if (!this.drift) this.drift = { t: 0, dist: 0, bySurface: new Map() };
      this.drift.t += dt;
      this.drift.dist += Math.hypot(dx, dz);
      this.drift.bySurface.set(s.surface, (this.drift.bySurface.get(s.surface) ?? 0) + dt);
    } else if (this.drift) this.endDrift(!s.crashed);
  }

  /** Forward the skier's physics events (takeoff/land/impact/crash). */
  onSkierEvent(e: SkierEvent, s: TelemetryState) {
    switch (e.type) {
      case 'takeoff':
        this.takeoff = { x: s.pos.x, z: s.pos.z };
        if (this.drift) this.endDrift(true);
        break;
      case 'land': {
        const from = this.takeoff;
        this.takeoff = null;
        if (e.airTime <= JUMP_MIN_AIR) break;
        const distance = from ? Math.hypot(s.pos.x - from.x, s.pos.z - from.z) : 0;
        // a crash on landing: physics reports hard=true, clean=false and the skier is down
        this.bus.emit({ type: 'JumpLanded', airtime: e.airTime, distance, clean: e.clean, landed: !s.crashed });
        break;
      }
      case 'impact':
        this.bus.emit({ type: 'ObstacleHit', kind: e.kind, intensity: e.intensity });
        break;
      case 'relocate':
        this.takeoff = null;
        break;
      case 'crash':
        if (this.drift) this.endDrift(false);
        this.bus.emit({ type: 'Crashed', reason: e.reason });
        break;
    }
  }

  /** End of run: report the last partial pizza chunk and an open drift. */
  flush() {
    if (this.pizzaAcc >= 1) this.bus.emit({ type: 'PizzaBraking', distance: Math.round(this.pizzaAcc * 10) / 10 });
    this.pizzaAcc = 0;
    if (this.drift) this.endDrift(true);
  }

  /** debug teleports move the skier without skiing: don't count the jump as distance */
  resync(s: TelemetryState) {
    this.lastX = s.pos.x;
    this.lastZ = s.pos.z;
    this.takeoff = null;
    this.drift = null;
  }

  private endDrift(controlled: boolean) {
    const d = this.drift!;
    this.drift = null;
    if (d.t < DRIFT_MIN_TIME) return;
    let surface: SurfaceType = 'snow';
    let best = -1;
    for (const [k, v] of d.bySurface) if (v > best) ((best = v), (surface = k));
    const surfaces: Partial<Record<SurfaceType, number>> = {};
    for (const [k, v] of d.bySurface) surfaces[k] = v;
    this.bus.emit({ type: 'DriftCompleted', duration: d.t, distance: d.dist, surface, surfaces, controlled });
  }
}
