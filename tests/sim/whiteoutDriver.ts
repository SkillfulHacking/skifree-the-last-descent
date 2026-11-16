/**
 * Weather-reading autopilot for Whiteout Ridge balance measurements (W-014). The same path follower as
 * the 'skilled' autopilot, plus the decisions the brief names, each switchable so its value can be
 * measured on its own:
 *  - lines:   'weather' takes the exposed fast alternate lines in fair weather and keeps to the
 *             sheltered main line once a front is building or blowing; 'always' / 'never' are the
 *             weather-blind fixed policies;
 *  - drifts:  'gap' steers for the gap in a drift row (the shown gap: hazard footprints), 'ignore'
 *             skis straight through;
 *  - blizzard: 'brake' stands up and checks speed while a blizzard cell is blowing across the line
 *             ahead (no tuck in the side-slip), 'ignore' keeps tucking.
 * It only uses what the game shows: hazard positions and phases (the telegraph), the front's phase
 * (sky, HUD pill) and the alternate lines (blue lamps). Visibility itself is not modelled headless:
 * the driver sees the line through any fog, so the cost of low visibility for a human is NOT measured
 * here (stated in the analysis).
 */
import { clamp, wrapAngle } from '../../src/core/rng';
import type { Mountain } from '../../src/world/course';
import type { SkierInput, SkierState } from '../../src/physics/SkierPhysics';
import type { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { getHazardKind, hazardPhase, type HazardInstance } from '../../src/world/hazards/hazard';
import { frontAt } from '../../src/world/biomes/whiteout/storm';
import { BLIZZARD, blizzardStrength } from '../../src/world/biomes/whiteout/hazards';
import type { ObstacleField } from '../../src/physics/obstacles';

export interface WhiteoutPolicy {
  lines: 'weather' | 'always' | 'never';
  drifts: 'gap' | 'ignore';
  blizzard: 'brake' | 'ignore';
}
export const INFORMED: WhiteoutPolicy = { lines: 'weather', drifts: 'gap', blizzard: 'brake' };
export const BLIND: WhiteoutPolicy = { lines: 'always', drifts: 'ignore', blizzard: 'ignore' };

const near: HazardInstance[] = [];

/**
 * `react` (s): a human-like driver re-reads the situation and re-aims only this often, holding its
 * input in between, with a softer correction (the same for every policy). 0 = the instant, perfect
 * path follower of the 'skilled' autopilot.
 */
export function whiteoutDriver(m: Mountain, env: BiomeEnvironment, seed: number, p: WhiteoutPolicy, stats?: { alt: number; main: number; gapSteers: number; brakes: number }, react = 0.25, field?: ObstacleField) {
  const ids: number[] = [];
  /** a player steers round rock and logs they can see: the nearest clear lateral offset of the aim */
  const clearOf = (sx: number, sz: number, tx: number, tz: number): number => {
    if (!field) return tx;
    const blocked = (ax: number) => {
      for (const k of [0.35, 0.65, 1]) {
        const x = sx + (ax - sx) * k;
        const z = sz + (tz - sz) * k;
        field.grid.query(x, z, 4, ids);
        for (const id of ids) {
          const o = field.get(id);
          if (o && Math.hypot(o.x - x, o.z - z) < o.r + 1.4) return true;
        }
      }
      return false;
    };
    if (!blocked(tx)) return tx;
    for (let d = 2; d <= 18; d += 2) {
      if (!blocked(tx + d)) return tx + d;
      if (!blocked(tx - d)) return tx - d;
    }
    return tx;
  };
  let held: SkierInput | null = null;
  let next = -1;
  return (s: SkierState, t: number): SkierInput => {
    if (held && t < next && !s.crashed) return held;
    next = t + react;
    held = decide(s, t);
    return held;
  };
  function decide(s: SkierState, t: number): SkierInput {
    const speed = s.speed;
    const look = 7 + speed * 0.55;
    const tz = s.pos.z + look;
    const f = frontAt(t, seed);
    const stormy = f.phase === 'storm' || f.phase === 'build' || (f.phase === 'ease' && f.s > 0.4);
    const useAlt = p.lines === 'always' || (p.lines === 'weather' && !stormy);
    let tx = m.routeX(tz);
    if (useAlt) {
      const a = m.profile.altRouteX(tz);
      if (a !== null && a !== undefined && Number.isFinite(a)) {
        tx = a;
        if (stats) stats.alt++;
      } else if (stats) stats.main++;
    } else if (stats) stats.main++;
    let brake = 0;
    let tuckOk = true;
    env.hazards.near(s.pos.x, s.pos.z + 60, 110, near);
    // drifts: steer for the nearest clear x across the line ahead
    if (p.drifts === 'gap') {
      const drifts = near.filter((h) => h.kind === 'wind-drift' && h.z > s.pos.z + 4 && h.z < s.pos.z + 26 + speed * 1.2);
      const blocked = (x: number) => drifts.some((h) => Math.hypot(x - h.x, (h.z - (s.pos.z + 20)) * 0.15) < h.r + 1.2);
      if (drifts.length && blocked(tx)) {
        let best = tx;
        for (let d = 1; d < 40; d += 1) {
          if (!blocked(tx + d)) { best = tx + d; break; }
          if (!blocked(tx - d)) { best = tx - d; break; }
        }
        const hw = m.profile.halfWidth(tz);
        const cx = m.profile.centerX(tz);
        tx = clamp(best, cx - hw + 4, cx + hw - 4);
        if (stats) stats.gapSteers++;
      }
    }
    // blizzard cells blowing across the line ahead
    if (p.blizzard === 'brake') {
      for (const h of near) {
        if (h.kind !== 'blizzard') continue;
        if (h.z < s.pos.z - 10 || h.z > s.pos.z + 70) continue;
        const ph = hazardPhase(getHazardKind(h.kind), h, t);
        const w = blizzardStrength(ph.phase, ph.u);
        // rise out of the tuck while the cell is really blowing at you (what the caption teaches)
        if (w > BLIZZARD.knockAt - 0.05 && Math.hypot(h.x - s.pos.x, h.z - s.pos.z) < h.r + 2) {
          tuckOk = false;
          if (stats) stats.brakes++;
        }
      }
    }
    tx = clearOf(s.pos.x, s.pos.z, tx, tz);
    const desired = Math.atan2(tx - s.pos.x, tz - s.pos.z);
    const err = wrapAngle(desired - s.heading);
    const steer = clamp(-err * (react > 0 ? 2.2 : 3.2), -1, 1);
    return { steer, tuck: tuckOk && Math.abs(err) < 0.16 ? 1 : 0, brake, drift: false, pop: false, recover: s.crashTime > 1.4 };
  }
}
