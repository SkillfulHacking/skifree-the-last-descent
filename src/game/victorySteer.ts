/**
 * The victory auto-steer (pure; GameSession.fixedStepVictory feeds its input to the physics): steer
 * to the finish's stop point, then a hockey stop.
 *
 * Two ways to stop:
 * - default (Alpine, Fjord): the hockey stop starts 22 m out — the skier slides to a halt in the
 *   finish area, near the mark;
 * - `onMark` (round 3, R2 C N-1; Whiteout's rescue station, whose staging needs the skier at the
 *   porch): brake in on the approach and start the hockey stop only within stopping distance of the
 *   mark, so the skier halts on it.
 */
import { clamp, smoothstep, wrapAngle as wrap } from '../core/rng';
import type { SkierInput } from '../physics/SkierPhysics';

export interface VictorySteerState {
  hockey: boolean;
}

/** the hockey stop's deceleration (m/s², measured on the finish run-outs: victorySteer.test.ts) */
export const HOCKEY_DECEL = 6;

export function victorySteer(
  s: { pos: { x: number; z: number }; vel: { x: number; z: number }; heading: number; speed: number },
  sp: { x: number; z: number },
  st: VictorySteerState,
  opts: { onMark?: boolean; driftMin: number },
): { input: SkierInput; hockeyStarted: boolean; dist: number } {
  const d = Math.hypot(sp.x - s.pos.x, sp.z - s.pos.z);
  const want = Math.atan2(sp.x - s.pos.x, Math.max(2, sp.z - s.pos.z));
  const err = wrap(want - s.heading);
  const stopDist = opts.onMark ? clamp((s.speed * s.speed) / (2 * HOCKEY_DECEL) + 1, 1.5, 22) : 22;
  const stopping = d < stopDist || s.pos.z > sp.z - (opts.onMark ? 0.5 : 4);
  const travel = s.speed > 1 ? Math.atan2(s.vel.x, s.vel.z) : s.heading;
  const across = Math.abs(wrap(s.heading - travel));
  let hockeyStarted = false;
  if (stopping && !st.hockey) {
    st.hockey = true;
    hockeyStarted = true;
  }
  // onMark: come in at a controlled pace (≤ ~9 m/s inside 40 m) so the stop lands on the mark
  const approachBrake = opts.onMark ? clamp((s.speed - (3 + d * 0.15)) / 4, 0, 1) * smoothstep(80, 30, d) : smoothstep(60, 20, d) * 0.6;
  const input: SkierInput = {
    steer: stopping ? (across < 1.45 && s.speed > 2 ? 1 : 0) : clamp(-err * 2.5, -1, 1),
    tuck: 0,
    brake: stopping ? 1 : approachBrake,
    drift: stopping && s.speed > opts.driftMin,
    pop: false,
    recover: true,
  };
  return { input, hockeyStarted, dist: d };
}
