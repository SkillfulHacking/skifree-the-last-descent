/**
 * Hazard-reading autopilot for headless balance tests: the same path follower as the 'skilled'
 * autopilot (src/debug/autopilot.ts), plus what a player who reads the Fjord would do:
 *  - goes round scoured rock that lies on the line (the short way round, inside the piste);
 *  - before and during a squall lane's telegraph/active phase, holds a line ~3 m upwind (sea side)
 *    (optionally stands up out of the tuck: biting edges resist the side-slip);
 *  - takes off upwind of a kicker when its squall will blow while it is in the air;
 *  - takes alternate lines (ridgeline spines, gap jumps) when they are there.
 * It only uses information the game shows (hazard positions and the windsock's phase).
 */
import { clamp, wrapAngle } from '../../src/core/rng';
import type { Mountain } from '../../src/world/course';
import type { SkierInput, SkierState } from '../../src/physics/SkierPhysics';
import type { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { getHazardKind, hazardPhase, type HazardInstance } from '../../src/world/hazards/hazard';

export interface ReaderOptions {
  /** go round rock on the line */
  rocks?: boolean;
  /** hold upwind through squall lanes */
  squalls?: boolean;
  /** stand up out of the tuck inside a blowing squall lane */
  standUp?: boolean;
  /** take alternate lines */
  alts?: boolean;
}

const near: HazardInstance[] = [];
const smooth = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

export function readerDriver(m: Mountain, env: BiomeEnvironment | null, o: ReaderOptions = { rocks: true, squalls: true, alts: true }) {
  return (s: SkierState, t: number): SkierInput => {
    const speed = s.speed;
    const look = 7 + speed * 0.55;
    const tz = s.pos.z + look;
    const lineX = (z: number) => {
      if (o.alts) {
        const a = m.profile.altRouteX(z);
        if (a !== null) return a;
      }
      return m.routeX(z);
    };
    let tx = lineX(tz);
    let standUp = false;
    if (env) {
      env.hazards.ensure(s.pos.z - 1, s.pos.z + 120);
      env.hazards.near(s.pos.x, s.pos.z + 60, 90, near);
      for (const h of near) {
        if (h.kind === 'scoured-rock' && o.rocks) {
          if (h.z < s.pos.z - h.r - 2) continue;
          const lx = lineX(h.z);
          const clear = h.r + 1.6;
          if (Math.abs(lx - h.x) >= clear) continue;
          const a = h.x - clear;
          const b = h.x + clear;
          const w = m.halfWidth(h.z) - 2;
          const c = m.centerX(h.z);
          const ok = (x: number) => Math.abs(x - c) < w;
          const go = ok(a) && (!ok(b) || Math.abs(a - lx) <= Math.abs(b - lx)) ? a : b;
          // ease onto the way round early and back after it (a smooth line keeps the tuck)
          const wgt = smooth(h.z - h.r - 75, h.z - h.r - 20, tz) * (1 - smooth(h.z + h.r + 2, h.z + h.r + 30, tz));
          tx += (go - lx) * wgt;
        } else if (h.kind === 'sea-gust' && o.squalls && ((h.params as { push?: number }).push ?? 0) > 0) {
          // a squall over a jump: if it will blow while I am in the air, take off upwind (sea side)
          // of the kicker's centre so the gust carries me back over the landing instead of onto rock
          const lip = h.z - 7;
          if (s.pos.z > lip + 2 || tz < lip - 70) continue;
          const k = getHazardKind(h.kind);
          const tl = t + Math.max(0, (lip - s.pos.z) / Math.max(5, speed));
          let live = false;
          for (let u = tl - 0.25; u <= tl + 1.0 && !live; u += 0.25) live = hazardPhase(k, h, u).phase === 'active';
          if (!live) continue;
          tx -= 2.8 * smooth(lip - 70, lip - 25, tz) * (1 - smooth(lip + 8, lip + 30, tz));
        } else if (h.kind === 'sea-gust' && o.squalls && (h.params as { slip?: number }).slip) {
          if (s.pos.z > h.z + h.r + 4 || tz < h.z - h.r - 60) continue;
          const k = getHazardKind(h.kind);
          // will it be blowing while I am in it? (the windsock shows the cycle)
          const t0 = t + Math.max(0, (h.z - h.r - s.pos.z) / Math.max(5, speed));
          const t1 = t + Math.max(0, (h.z + h.r - s.pos.z) / Math.max(5, speed));
          let live = false;
          for (let u = t0; u <= t1 + 1e-6 && !live; u += 0.25) live = hazardPhase(k, h, u).phase === 'active';
          if (!live) continue;
          // hold a line upwind (the sea side) so the gust carries you back onto it
          tx -= 3 * smooth(h.z - h.r - 60, h.z - h.r - 15, tz) * (1 - smooth(h.z + h.r - 5, h.z + h.r + 15, tz));
          const inside = Math.hypot(s.pos.x - h.x, s.pos.z - h.z) < h.r + 2;
          if (o.standUp && inside && hazardPhase(k, h, t).phase === 'active') standUp = true;
        }
      }
    }
    const desired = Math.atan2(tx - s.pos.x, tz - s.pos.z);
    const err = wrapAngle(desired - s.heading);
    const steer = clamp(-err * 3.2, -1, 1);
    return { steer, tuck: !standUp && Math.abs(err) < 0.16 ? 1 : 0, brake: 0, drift: false, pop: false, recover: s.crashTime > 1.4 };
  };
}
