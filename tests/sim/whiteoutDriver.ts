/**
 * Weather-reading autopilot for Whiteout Ridge balance measurements (W-014). The same path follower as
 * the 'skilled' autopilot, plus the decisions the brief names, each switchable so its value can be
 * measured on its own:
 *  - lines:   'weather' takes the exposed fast alternate lines in fair weather and keeps to the
 *             sheltered main line once a front is building or blowing; 'always' / 'never' are the
 *             weather-blind fixed policies;
 *  - drifts:  'gap' steers for the gap in a drift row (the shown gap: hazard footprints) once the row
 *             is close (~45 m at speed); 'gapEarly' reads the row from further off (40 m + 2 s of
 *             travel) and drifts across to the gap gradually, keeping the tuck through gentle
 *             corrections (W-034: what a competent player does); 'ignore' skis straight through;
 *  - blizzard: 'brake' stands up and checks speed while a blizzard cell is blowing across the line
 *             ahead (no tuck in the side-slip), 'ignore' keeps tucking.
 * It only uses what the game shows: hazard positions and phases (the telegraph), the front's phase
 * (sky, HUD pill) and the alternate lines (blue lamps). Visibility itself is not modelled headless:
 * the driver sees the line through any fog, so the cost of low visibility for a human is NOT measured
 * here (stated in the analysis).
 */
import { clamp, smoothstep, wrapAngle } from '../../src/core/rng';
import type { Mountain } from '../../src/world/course';
import type { SkierInput, SkierState } from '../../src/physics/SkierPhysics';
import type { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { getHazardKind, hazardPhase, type HazardInstance } from '../../src/world/hazards/hazard';
import { frontAt } from '../../src/world/biomes/whiteout/storm';
import { BLIZZARD, blizzardStrength, type DriftParams } from '../../src/world/biomes/whiteout/hazards';
import { LEE, leeLaneAt, whiteoutExposure } from '../../src/world/biomes/whiteout/storm';
import type { ObstacleField } from '../../src/physics/obstacles';

export interface WhiteoutPolicy {
  lines: 'weather' | 'always' | 'never';
  /**
   * 'gap' / 'gapEarly' (round 2: the same): reads the next row from ~110 m off and bends the line
   * smoothly over to its gap (from 90 m before the row) and back after it, keeping the tuck through
   * the gentle correction; 'hopTimed': ploughs no detour but charges a full jump timed to be at the
   * top over the crest; 'hopSpam': taps a hop whenever a drift is close ahead (the round-1 exploit);
   * 'ignore': skis straight through
   */
  drifts: 'gap' | 'gapEarly' | 'ignore' | 'hopTimed' | 'hopSpam';
  blizzard: 'brake' | 'ignore';
  /** in a front, ski the lee half of the piste (round 2, W-035: the wind is weaker there) */
  lee?: boolean;
  /** how far downwind of the racing line the lee line runs (m; default LEE.lane − 1) */
  leeOff?: number;
  /** on wind-scoured exposed ground in a storm, rise out of the tuck onto the edges (less skid) */
  edge?: boolean;
}
export const INFORMED: WhiteoutPolicy = { lines: 'weather', drifts: 'gap', blizzard: 'brake' };
export const BLIND: WhiteoutPolicy = { lines: 'always', drifts: 'ignore', blizzard: 'ignore' };

const near: HazardInstance[] = [];

/**
 * `react` (s): a human-like driver re-reads the situation and re-aims only this often, holding its
 * input in between, with a softer correction (the same for every policy). 0 = the instant, perfect
 * path follower of the 'skilled' autopilot.
 */
export function whiteoutDriver(m: Mountain, env: BiomeEnvironment, seed: number, p: WhiteoutPolicy, stats?: { alt: number; main: number; gapSteers: number; brakes: number; lee?: number }, react = 0.25, field?: ObstacleField) {
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
  /** the planned offset from the racing line (m) and when it was last moved */
  let plan = 0;
  let planT = -1;
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
    // (round 2) the line is chosen where the lines fork: a skier already out on an alternate line stays
    // on it until it rejoins (cutting 40 m across between the lines when a front builds is not a line
    // anyone skis — round-2 W2H-01 Relaxed); 'weather' takes the fork only in fair weather
    const aHere = m.profile.altRouteX(s.pos.z);
    const onAltNow = aHere !== null && aHere !== undefined && Number.isFinite(aHere) && Math.abs(s.pos.x - aHere) < 8 && Math.abs(s.pos.x - m.routeX(s.pos.z)) > 8;
    // and joins an alternate line only at its fork (where it is still within 8 m of the main line)
    const atFork = aHere !== null && aHere !== undefined && Number.isFinite(aHere) && Math.abs(aHere - m.routeX(s.pos.z)) < 8;
    // ('weather' also reads the storm wall on the horizon: no exposed crest line once it is in sight,
    // ~32 s before the front builds — sky.ts SKY.wallLead — what the player sees coming)
    const wallInSight = f.phase === 'clear' && f.left < 32;
    const useAlt = onAltNow || (atFork && (p.lines === 'always' || (p.lines === 'weather' && !stormy && !wallInSight))) || (p.lines === 'always' && (aHere === null || aHere === undefined));
    let tx = m.routeX(tz);
    let onAlt = false;
    if (useAlt) {
      const a = m.profile.altRouteX(tz);
      if (a !== null && a !== undefined && Number.isFinite(a)) {
        tx = a;
        onAlt = true;
        if (stats) stats.alt++;
      } else if (stats) stats.main++;
    } else if (stats) stats.main++;
    let brake = 0;
    let tuckOk = true;
    env.hazards.near(s.pos.x, s.pos.z + 60, 110, near);
    // drifts: steer for the nearest clear x across the line ahead
    let tuckTol = 0.16;
    // ---- the line across the piste (round 2): one plan, an offset from the racing line, that moves
    // at a rate a skier can carve (≈ 0.22 × speed sideways) — never re-aimed from scratch each look:
    //  - in a front, onto the marked lee shoulder (where there is one);
    //  - for a drift row whose mounds cover that line, over to the row's gap from ~95 m before it,
    //    back after it.
    const leeOff = (z: number) => (p.lee && !onAlt && f.s > 0.3 && leeLaneAt(m, z, f.dir) ? f.dir * (p.leeOff ?? LEE.lane - 1) * smoothstep(0.3, 0.7, f.s) : 0);
    let want = leeOff(tz);
    let pop = false;
    if (p.drifts !== 'ignore') {
      // the next drift row ahead (its mounds carry the row's gap)
      let row: HazardInstance | null = null;
      for (const h of near) {
        if (h.kind !== 'wind-drift') continue;
        const q = h.params as DriftParams;
        if (q.rowZ === undefined || q.rowZ < s.pos.z - 6 || q.rowZ > s.pos.z + 110) continue;
        if (!row || q.rowZ < (row.params as DriftParams).rowZ!) row = h;
      }
      if (row) {
        const q = row.params as DriftParams;
        const rz = q.rowZ!;
        const altAtRow = onAlt ? m.profile.altRouteX(rz) : null;
        const base = onAlt && altAtRow !== null && altAtRow !== undefined && Number.isFinite(altAtRow) ? altAtRow : m.routeX(rz);
        const lineAtRow = base + leeOff(rz);
        const covered = Math.abs(lineAtRow - q.gapX!) > q.gapHalf! - 1.5;
        const dz = rz - s.pos.z;
        if (p.drifts === 'gap' || p.drifts === 'gapEarly') {
          if (covered && dz < 95) {
            // (relative to the line being skied: the main line or the alternate line)
            want = q.gapX! - base;
            tuckTol = 0.3;
            if (stats) stats.gapSteers++;
          }
        } else if (p.drifts === 'hopTimed') {
          // charge fully (0.45 s), release so the top of the jump (~0.45 s) is over the crest
          if (covered && s.grounded && dz > speed * 0.45 && dz < speed * 0.95) pop = true;
        } else if (p.drifts === 'hopSpam') {
          if (s.grounded && dz > -12 && dz < 10 && Math.floor(t * 4) % 2 === 0) pop = true;
        }
      }
    }
    const dtPlan = planT < 0 ? 0 : Math.min(0.5, t - planT);
    planT = t;
    const rate = 0.22 * Math.max(8, speed);
    plan += clamp(want - plan, -rate * dtPlan, rate * dtPlan);
    tx = (onAlt ? tx : m.routeX(tz)) + plan;
    if (stats && Math.abs(plan) > 3 && Math.sign(plan) === Math.sign(f.dir) && p.lee) stats.lee = (stats.lee ?? 0) + 1;
    let edgeUp = false;
    if (p.edge && f.s > 0.5 && s.grounded && whiteoutExposure(m, s.pos.x, s.pos.z, t, seed) > 0.86) edgeUp = true;
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
    // (every policy) a skier who has bogged down poles out, as the game's hint teaches
    const pole = s.grounded && !s.crashed && speed < 4;
    return { steer, tuck: tuckOk && !edgeUp && Math.abs(err) < tuckTol ? 1 : 0, brake, drift: false, pop, recover: s.crashTime > 1.4, pole, polePressed: pole && Math.floor(t * 2) % 2 === 0 };
  }
}
