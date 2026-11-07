/**
 * Autopilot driver used by automated tests (unit simulations and Playwright playthroughs).
 * Not exposed in the normal gameplay UI.
 */
import { clamp, wrapAngle } from '../core/rng';
import type { Mountain } from '../world/course';
import type { SkierInput } from '../physics/SkierPhysics';
import type { SkierState } from '../physics/SkierPhysics';

export type AutopilotStyle = 'skilled' | 'intermediate' | 'average' | 'careless' | 'cautious';

export function autopilotInput(m: Mountain, s: SkierState, style: AutopilotStyle, time: number): SkierInput {
  const speed = s.speed;
  const look = 7 + speed * 0.55;
  const tz = s.pos.z + look;
  const tx = m.routeX(tz);
  const desired = Math.atan2(tx - s.pos.x, tz - s.pos.z);
  const err = wrapAngle(desired - s.heading);
  // also damp lateral velocity relative to heading
  const steer = clamp(-err * 3.2, -1, 1);
  const input: SkierInput = { steer, tuck: 0, brake: 0, drift: false, pop: false, recover: s.crashTime > 1.4 };
  if (style === 'skilled') {
    input.tuck = Math.abs(err) < 0.16 ? 1 : 0;
  } else if (style === 'intermediate') {
    // tucks only on clean straights, checks speed when fast
    input.tuck = Math.abs(err) < 0.07 && speed < 26 ? 1 : 0;
    input.brake = speed > 29 ? 0.4 : 0;
  } else if (style === 'average') {
    // never tucks, scrubs speed above 24 m/s
    input.brake = speed > 24 ? 0.5 : 0;
  } else if (style === 'cautious') {
    input.brake = speed > 16 ? 0.7 : 0;
  } else {
    // careless: alternates between hard braking and wandering, never tucks
    input.brake = Math.sin(time * 0.9) > 0.1 && speed > 10 ? 0.7 : 0;
    input.steer = clamp(input.steer + Math.sin(time * 1.7) * 0.35, -1, 1);
  }
  return input;
}
