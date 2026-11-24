/**
 * The one hook through which a location changes skier physics.
 *
 * SkierPhysics calls `env.sample(query, out)` once per fixed step (before integrating) and applies
 * the result in fixed places:
 *  - out.surface   → grip, friction, steering (carve radius), pizza braking, drift threshold,
 *                    recovery rate, extra drag (see SurfaceModifiers);
 *  - out.airAccel* → horizontal acceleration while airborne (crosswind);
 *  - out.groundSlip* → side-slip while grounded (a squall across the piste): moves the skier
 *                    without changing their speed; edging (braking) resists it, tuck/drift add to it;
 *  - out.balance   → minimum wobble while grounded (gusts, rough ground);
 *  - out.knock     → speed loss + stagger (once, like a snowball hit);
 *  - out.crash     → a crash with that reason;
 *  - out.relocate  → out of bounds (e.g. over a sea cliff's crest): the skier falls and is put back
 *                    on the piste at (x, z), crashed, so the run goes on (no invisible failure zone).
 *
 * With no environment (null) or an identity one (Alpine), the output is bit-identical to the
 * original physics. Pure: no three.js.
 */
import type { SurfaceType } from '../core/types';
import { IDENTITY_SURFACE, type SurfaceModifiers } from '../world/capabilities/surface';

/** How a grounded side-slip (EnvSample.groundSlip*) takes hold, by what the skier is doing (SkierPhysics). */
export const SLIP_EDGE = { base: 1, tuck: 0.6, brake: 0.45, drift: 0.6 } as const;
/**
 * (round 4, W-080) How much of the weather's headwind drag a fully tucked skier takes, relative to an
 * upright one: the ratio of the two air-drag coefficients (TUNING.dragTuck / TUNING.dragUpright — the
 * tuck's smaller frontal area; checked by a unit test). Round 3 charged the upright figure whatever the
 * stance, a flat tax a perfect run could not reduce. (An object so measurement runs can compare tuck = 1.)
 */
export const HEADWIND_STANCE = { tuck: 0.004 / 0.0085 };

export interface EnvQuery {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  grounded: boolean;
  crashed: boolean;
  /** surface under the skis (valid while grounded; last known otherwise) */
  surface: SurfaceType;
  /** physics time since the run (re)started, s */
  t: number;
  /** how far the skier is tucked, 0..1 (optional: hazards that treat a tucked skier differently) */
  tuck?: number;
}

export interface EnvSample {
  surface: SurfaceModifiers;
  airAccelX: number;
  airAccelZ: number;
  /** side-slip of a grounded skier, m/s (0 unless a hazard blows the skier sideways) */
  groundSlipX: number;
  groundSlipZ: number;
  balance: number;
  knock: { keep: number; wobble: number } | null;
  crash: { reason: string; intensity: number } | null;
  relocate: { x: number; z: number; reason: string } | null;
}

export interface PhysicsEnvironment {
  sample(q: EnvQuery, out: EnvSample): void;
  /** the run restarted (physics reset/teleport): forget per-run state */
  reset?(): void;
}

export function makeEnvSample(): EnvSample {
  return { surface: { ...IDENTITY_SURFACE }, airAccelX: 0, airAccelZ: 0, groundSlipX: 0, groundSlipZ: 0, balance: 0, knock: null, crash: null, relocate: null };
}

export function makeEnvQuery(): EnvQuery {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, grounded: true, crashed: false, surface: 'snow', t: 0 };
}
