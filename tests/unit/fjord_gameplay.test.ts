/**
 * Fjord Coast gameplay (round-2 remediation): the environment has to create decisions that a
 * skilled player can read and a careless one pays for, without ever punishing at random.
 *  - squall lanes: telegraphed onshore side-slip on exposed stretches of the racing line, with
 *    scoured rock downwind: a reactive skier drifts onto it, one who holds upwind does not;
 *  - scoured rock across the line: the fast line costs speed, the way round costs (almost) nothing;
 *  - ridgeline spines with gap jumps: a separate, optional line with a gully to clear; a slow
 *    skier who drops in gets out again;
 *  - the sea-cliff rim: no way to leave the playable area over the cornice (updraft + recovery);
 *  - viewpoints only where nothing chases you, with ids unique per course and location;
 *  - balance: Relaxed stays approachable; the environment costs a hazard-blind skier more than a
 *    reader; forgiving course-code input.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, parseCourseId, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import type { Mountain } from '../../src/world/course';
import { LANE_HALF, ObstacleField, generateBand, BAND } from '../../src/physics/obstacles';
import { NO_INPUT, PHYS_DT, SkierPhysics, type SkierInput } from '../../src/physics/SkierPhysics';
import { BiomeEnvironment, RIM_GUARD } from '../../src/world/capabilities/environment';
import { getHazardKind, hazardPhase, type HazardInstance } from '../../src/world/hazards/hazard';
import { collectPlacements, probe } from '../../src/world/hazards/testkit';
import { LEE_ROCK_INSET, SQUALL } from '../../src/world/biomes/fjord/hazards';
import { LOOKOUT_CHASE_MAX, LOOKOUT_CHASE_MIN } from '../../src/world/coast';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { readerDriver } from '../sim/readerDriver';
import { clamp, wrapAngle } from '../../src/core/rng';

const course = (length: LengthMode, seed: string, difficulty: Difficulty = 'normal') => makeCourse('custom', length, { biome: 'fjord', customText: seed, difficulty });
const cache = new Map<string, Mountain>();
const mtn = (length: LengthMode, seed: string) => {
  const k = `${length}:${seed}`;
  if (!cache.has(k)) cache.set(k, buildMountain(course(length, seed)));
  return cache.get(k)!;
};
const gust = getHazardKind('sea-gust');
const rock = getHazardKind('scoured-rock');
const placements = (m: Mountain, seed: string, len: LengthMode) => collectPlacements(m, worldSeed(course(len, seed)), [gust, rock], 1, 0, Number.isFinite(m.finishZ) ? m.finishZ : 20000);
const isLane = (h: HazardInstance) => ((h.params as { slip?: number }).slip ?? 0) > 0;

/** follow the racing line (look-ahead path follower, like every autopilot) with an x offset */
function follow(m: Mountain, offset: (z: number, t: number) => number, tuck = 1) {
  return (s: SkierPhysics['s'], t: number): SkierInput => {
    const look = 7 + s.speed * 0.55;
    const tz = s.pos.z + look;
    const err = wrapAngle(Math.atan2(m.routeX(tz) + offset(tz, t) - s.pos.x, look) - s.heading);
    return { ...NO_INPUT, steer: clamp(-err * 3.2, -1, 1), tuck, recover: true };
  };
}

describe('Fjord: squall lanes push grounded skiers onshore; reading them keeps you off the rock', () => {
  const seeds = ['RB1', 'RB2', 'RB3'];
  it('lanes span the racing line on exposed stretches, slip only onshore (+X) and only while it blows, each with rock downwind', () => {
    let lanes = 0;
    for (const sd of seeds) {
      const m = mtn('standard', sd);
      const all = placements(m, sd, 'standard');
      const e = new BiomeEnvironment(m, worldSeed(course('standard', sd)));
      for (const h of all.filter(isLane)) {
        lanes++;
        expect(Math.abs(h.x - m.routeX(h.z))).toBeLessThan(h.r * 0.5);
        // rock in the lee: onshore of the line, within ~25 m downstream
        expect(all.some((r) => r.kind === 'scoured-rock' && r.z > h.z && r.z < h.z + 30 && r.x > m.routeX(r.z))).toBe(true);
        for (let t = 0; t < 30; t += 0.37) {
          const ph = hazardPhase(gust, h, t).phase;
          const g = probe(e, m.routeX(h.z), h.z, t, 20, true).sample;
          expect(g.groundSlipX).toBeGreaterThanOrEqual(0);
          expect(g.groundSlipX).toBeLessThanOrEqual(SQUALL.slip * 1.05 + 1e-9);
          expect(g.groundSlipZ).toBe(0);
          if (ph === 'dormant') expect(g.groundSlipX).toBe(0);
          const a = probe(e, m.routeX(h.z), h.z, t, 20, false).sample;
          expect(a.groundSlipX).toBe(0);
        }
      }
    }
    expect(lanes).toBeGreaterThanOrEqual(9);
  });

  it('crossing a lane while it blows: a reactive skier drifts ≥ 1.5 m onshore, one holding 2.5 m upwind stays on the line', () => {
    const sd = 'RB1';
    const m = mtn('standard', sd);
    const ws = worldSeed(course('standard', sd));
    const f = new ObstacleField(m, ws);
    const lanes = placements(m, sd, 'standard').filter(isLane).slice(0, 4);
    expect(lanes.length).toBe(4);
    for (const h of lanes) {
      let tAct = 0;
      for (let t = 0.02; t < 30; t += 0.02) if (hazardPhase(gust, h, t).phase === 'active' && hazardPhase(gust, h, t - 0.02).phase !== 'active') {
        tAct = t;
        break;
      }
      const lee = placements(m, sd, 'standard').find((r) => r.kind === 'scoured-rock' && r.z > h.z && r.z < h.z + 30 && r.x > m.routeX(r.z))!;
      let onRock = false;
      const dev = (upwind: number, on: boolean) => {
        onRock = false;
        const p = new SkierPhysics(m, f, undefined, on ? new BiomeEnvironment(m, ws) : null);
        const z0 = h.z - 120;
        f.ensure(z0 - 100, h.z + 300);
        p.reset(m.routeX(z0), z0, Math.atan2(m.routeX(z0 + 10) - m.routeX(z0), 10), 20);
        p.s.time = tAct + 0.3 - 6;
        const drive = follow(m, (z) => (Math.abs(z - h.z) < h.r + 25 ? -upwind : 0));
        let max = -Infinity;
        while (p.s.pos.z < h.z + 60) {
          p.step(drive(p.s, p.s.time), PHYS_DT);
          if (p.s.pos.z > h.z - h.r) max = Math.max(max, p.s.pos.x - m.routeX(p.s.pos.z));
          if (Math.hypot(p.s.pos.x - lee.x, p.s.pos.z - lee.z) < lee.r * 0.8) onRock = true;
        }
        return max;
      };
      // reactive: carried ≥ 1.5 m further onshore, onto the rough part of the lee rock
      const calm = dev(0, false);
      expect(onRock).toBe(false);
      expect(dev(0, true) - calm).toBeGreaterThan(1.5);
      expect(onRock).toBe(true);
      // holding 2.5 m upwind: the gust carries you back over the line, short of the rock's core
      expect(dev(2.5, true)).toBeLessThan(LEE_ROCK_INSET - 1);
      expect(onRock).toBe(false);
    }
  });
});

describe('Fjord: scoured rock across the racing line', () => {
  it('the fast line through it costs ≥ 1.5 m/s at 20 m/s; going round on the clear side costs < 0.4 m/s; never knocks or crashes', () => {
    let n = 0;
    for (const sd of ['FJ1', 'FJ3', 'RB4']) {
      const m = mtn('sprint', sd);
      const ws = worldSeed(course('sprint', sd));
      const f = new ObstacleField(m, ws);
      const onLine = placements(m, sd, 'sprint').filter((h) => h.kind === 'scoured-rock' && Math.abs(h.x - m.routeX(h.z)) < h.r * 0.5);
      for (const h of onLine.slice(0, 2)) {
        n++;
        const run = (round: boolean, on: boolean) => {
          const p = new SkierPhysics(m, f, undefined, on ? new BiomeEnvironment(m, ws) : null);
          const z0 = h.z - 90;
          f.ensure(z0 - 100, h.z + 200);
          p.reset(m.routeX(z0), z0, Math.atan2(m.routeX(z0 + 10) - m.routeX(z0), 10), 20);
          const side = h.x > m.routeX(h.z) ? -1 : 1;
          const shift = side * (h.r + 1.6 - Math.abs(h.x - m.routeX(h.z)));
          const drive = follow(m, (z) => (round ? shift * clamp((z - (h.z - h.r - 75)) / 55, 0, 1) * clamp((h.z + h.r + 30 - z) / 28, 0, 1) : 0));
          let crashes = 0;
          while (p.s.pos.z < h.z + 40) {
            p.step(drive(p.s, p.s.time), PHYS_DT);
            for (const e of p.drainEvents()) if (e.type === 'crash') crashes++;
          }
          expect(crashes).toBe(0);
          return p.s.speed;
        };
        const off = run(false, false);
        expect(off - run(false, true)).toBeGreaterThan(1.5);
        expect(run(true, false) - run(true, true)).toBeLessThan(0.4);
        // and the way round is clear of obstacles (inside the cleared lane)
        const clearX = m.routeX(h.z) + (h.x > m.routeX(h.z) ? -1 : 1) * (h.r + 1.6 - Math.abs(h.x - m.routeX(h.z)));
        expect(Math.abs(clearX - m.routeX(h.z))).toBeLessThan(LANE_HALF + 1.5);
        const s = probe(new BiomeEnvironment(m, ws), h.x, h.z, 1, 20).sample;
        expect(s.knock).toBeNull();
        expect(s.crash).toBeNull();
      }
    }
    expect(n).toBeGreaterThanOrEqual(4);
  });
});

describe('Fjord: ridgeline spines with gap jumps', () => {
  it('ridgelines carry a separate spine line; its gully is ≥ 2 m deep and ≥ 12 m from the racing line', () => {
    let spines = 0;
    let gaps = 0;
    for (const sd of ['RB1', 'R5', 'RB3']) {
      const m = mtn('standard', sd);
      for (const a of m.profile.altRoutes(0, m.finishZ)) {
        if (a.type !== 'ridgeline') continue;
        expect(a.bow).toBeLessThan(0); // toward the sea-side ridge
        spines++;
      }
      for (const g of m.profile.gapsNear!(0, m.finishZ, [])) {
        gaps++;
        const zc = g.z + g.len / 2;
        const around = (m.heightAt(g.x, g.z - 1.5) + m.heightAt(g.x, g.z + g.len + 1.5)) / 2;
        expect(around - m.heightAt(g.x, zc)).toBeGreaterThan(1.8);
        expect(Math.abs(g.x - m.routeX(zc)) - (g.hw - 5)).toBeGreaterThan(12);
        expect(m.profile.kickersNear(g.lipZ - 1, g.lipZ + 1, []).length).toBeGreaterThan(0);
      }
    }
    expect(spines).toBeGreaterThanOrEqual(6);
    expect(gaps).toBeGreaterThanOrEqual(3);
  });

  it('at racing speed the gap is cleared without a crash; a slow skier who drops in gets out (no soft-lock)', () => {
    for (const sd of ['RB1', 'R5']) {
      const m = mtn('standard', sd);
      const ws = worldSeed(course('standard', sd));
      const f = new ObstacleField(m, ws);
      for (const g of m.profile.gapsNear!(0, m.finishZ, []).slice(0, 2)) {
        const a = m.profile.altRoutes(g.lipZ, g.lipZ).find((q) => g.lipZ >= q.z0 && g.lipZ <= q.z1)!;
        for (const v0 of [21, 7]) {
          const p = new SkierPhysics(m, f, undefined, new BiomeEnvironment(m, ws));
          const z0 = g.lipZ - 45;
          f.ensure(z0 - 100, g.lipZ + 200);
          p.reset(m.profile.altX(a, z0), z0, 0, v0);
          let crashes = 0;
          let inGully = 0;
          for (let i = 0; i < 25 / PHYS_DT && p.s.pos.z < g.z + g.len + 25; i++) {
            const s = p.s;
            const look = 7 + s.speed * 0.55;
            const tz = Math.min(a.z1, s.pos.z + look);
            const err = wrapAngle(Math.atan2(m.profile.altX(a, tz) - s.pos.x, tz - s.pos.z + 1e-3) - s.heading);
            p.step({ ...NO_INPUT, steer: clamp(-err * 3.2, -1, 1), tuck: s.speed < 7 ? 1 : 0.5, recover: true }, PHYS_DT);
            for (const e of p.drainEvents()) if (e.type === 'crash') crashes++;
            if (m.coast!.gapDepth(s.pos.x, s.pos.z) > 1 && s.grounded) inGully += PHYS_DT;
          }
          if (v0 > 15) {
            expect(crashes, `${sd} gap at ${g.lipZ.toFixed(0)} v0=${v0}`).toBe(0);
            expect(inGully).toBe(0);
          }
          // nobody stays stuck in the gully
          expect(p.s.pos.z, `${sd} gap at ${g.lipZ.toFixed(0)} v0=${v0}`).toBeGreaterThan(g.z + g.len + 5);
        }
      }
    }
  });
});

describe('Fjord: no way off the playable area over the cornice', () => {
  it('a charged pop toward the cliff from any heading and speed never leaves the skier beyond the rim; going over sends them back to the piste', () => {
    const sd = 'RB3';
    const m = mtn('standard', sd);
    const c = m.coast!;
    const ws = worldSeed(course('standard', sd));
    let relocations = 0;
    for (const z0 of [900, 1610, 3400, 5200, 7000, 9010])
      for (const v0 of [18, 28, 34])
        for (const ang of [0.3, 0.7, 1.1]) {
          const p = new SkierPhysics(m, null, () => [], new BiomeEnvironment(m, ws));
          p.reset(m.centerX(z0) - m.halfWidth(z0) * 0.5, z0, -ang, v0);
          let popped = false;
          let worst = -Infinity;
          for (let i = 0; i < 12 / PHYS_DT; i++) {
            const s = p.s;
            if (!popped && c.guard(s.pos.x, s.pos.z) > 0.05 && s.grounded) {
              popped = true;
              for (let j = 0; j < 28; j++) p.step({ ...NO_INPUT, pop: true });
            }
            const err = wrapAngle(-ang - s.heading);
            p.step({ ...NO_INPUT, steer: clamp(-err * 3, -1, 1), tuck: 1 });
            for (const e of p.drainEvents()) if (e.type === 'relocate') relocations++;
            worst = Math.max(worst, c.beyondRim(s.pos.x, s.pos.z));
          }
          expect(worst, `z0=${z0} v0=${v0} ang=${ang}`).toBeLessThan(RIM_GUARD.over + 3);
          expect(c.beyondRim(p.s.pos.x, p.s.pos.z)).toBeLessThan(0);
        }
    expect(relocations).toBeLessThanOrEqual(6);
  });
});

describe('Fjord: viewpoints are free to explore', () => {
  const LENS = ['sprint', 'standard', 'endurance', 'expedition', 'endless'] as LengthMode[];
  const endOf = (m: Mountain) => (Number.isFinite(m.finishZ) ? m.finishZ : 30000);

  it('free-stretch ones outside chases; chase ones 16–30 m beside the line on clean, flat snow; several per Sprint and Standard; ids unique', () => {
    const ids = new Map<string, string>();
    for (const len of LENS)
      for (const sd of ['RB1', 'FJ2', 'V3X']) {
        const m = mtn(len, sd);
        const end = endOf(m);
        const list = m.coast!.lookouts(0, end);
        const enc = m.profile.encounters(-Infinity, end);
        expect(list.length, `${len} ${sd}`).toBeGreaterThanOrEqual(len === 'sprint' ? 2 : len === 'standard' ? 4 : enc.length + 2);
        for (const l of list) {
          const inChase = enc.some((e) => l.z >= e.triggerZ - 20 && l.z <= e.chaseEndZ);
          expect(inChase, `${len} ${sd} ${l.id}`).toBe(!!l.chase);
          const key = `${len}:${sd}`;
          expect(ids.get(l.id) ?? key, `${l.id} on two courses`).toBe(key);
          ids.set(l.id, key);
          const lane = m.routeX(l.z) - l.x;
          if (l.chase) {
            expect(lane).toBeGreaterThanOrEqual(LOOKOUT_CHASE_MIN - 1e-6);
            expect(lane).toBeLessThanOrEqual(LOOKOUT_CHASE_MAX + 1e-6);
            expect(Math.abs(m.heightAt(l.x, l.z) - m.heightAt(m.routeX(l.z), l.z))).toBeLessThan(3);
          } else {
            expect(Math.abs(lane)).toBeGreaterThan(20);
            expect(m.heightAt(l.x, l.z) - m.heightAt(m.routeX(l.z), l.z)).toBeLessThan(9);
          }
          expect(m.coast!.guard(l.x, l.z)).toBe(0);
        }
        const seed = worldSeed(course(len, sd));
        for (const l of list.slice(0, 4))
          for (const o of generateBand(m, seed, Math.floor(l.z / BAND))) {
            if (o.kind === 'tree' || o.kind === 'boulder') expect(Math.hypot(o.x - l.x, o.z - l.z)).toBeGreaterThan(10);
            // the swerve from the line to a chase viewpoint is clear of anything solid
            if (l.chase && o.collidable && o.kind !== 'stump') expect(o.z > l.z - 60 && o.z < l.z + 30 && o.x > l.x - 5 && o.x < m.routeX(o.z) - LANE_HALF, `${len} ${sd} ${o.kind}`).toBe(false);
          }
      }
  });

  it('the same viewpoints whatever the query pattern (round 2, E1): 40 m windows down the course, bands in reverse, one big query', () => {
    for (const len of LENS)
      for (const sd of ['RB1', 'V3X']) {
        const end = Math.min(endOf(mtn(len, sd)), 30000);
        const ref = buildMountain(course(len, sd)).coast!.lookouts(-1000, end).map((l) => l.id);
        // the game's pattern: small windows around the skier, walking down
        const walk = buildMountain(course(len, sd)).coast!;
        const seen = new Set<string>();
        for (let z = -60; z < end; z += 40) for (const l of walk.lookouts(z - 20, z + 20)) seen.add(l.id);
        expect([...seen].sort(), `${len} ${sd} walk`).toEqual([...ref].sort());
        // obstacle bands generated far end first
        const rev = buildMountain(course(len, sd));
        const seed = worldSeed(course(len, sd));
        for (let b = Math.floor(end / BAND); b >= 0; b -= 7) generateBand(rev, seed, b);
        expect(rev.coast!.lookouts(-1000, end).map((l) => l.id), `${len} ${sd} reverse`).toEqual(ref);
      }
  });

  it('the obstacle layout does not depend on the order its bands are generated in', () => {
    for (const len of ['sprint', 'endurance'] as LengthMode[]) {
      const sd = 'V3X';
      const seed = worldSeed(course(len, sd));
      const end = endOf(mtn(len, sd));
      const nb = Math.ceil(end / BAND);
      const fwd = buildMountain(course(len, sd));
      const a = Array.from({ length: nb }, (_, b) => generateBand(fwd, seed, b));
      const back = buildMountain(course(len, sd));
      const b2: ReturnType<typeof generateBand>[] = [];
      for (let b = nb - 1; b >= 0; b--) b2[b] = generateBand(back, seed, b);
      for (let b = 0; b < nb; b++) expect(b2[b]!.map((o) => `${o.kind}:${o.x.toFixed(3)}:${o.z.toFixed(3)}`), `${len} band ${b}`).toEqual(a[b]!.map((o) => `${o.kind}:${o.x.toFixed(3)}:${o.z.toFixed(3)}`));
    }
  });

  it('a chase viewpoint costs at most ~0.3 s: swerving into its radius and back, against holding the line', () => {
    let n = 0;
    let worst = -Infinity;
    for (const sd of ['RB1', 'FJ2', 'V3X'])
      for (const len of ['sprint', 'standard'] as LengthMode[]) {
        const m = mtn(len, sd);
        const f = new ObstacleField(m, worldSeed(course(len, sd)));
        for (const l of m.coast!.lookouts(0, m.finishZ).filter((q) => q.chase)) {
          const z0 = l.z - 260;
          const z1 = l.z + 160;
          f.ensure(z0 - 50, z1 + 50);
          const run = (detour: boolean) => {
            const p = new SkierPhysics(m, f, () => [], null);
            p.reset(m.routeX(z0), z0, 0, 24);
            // aim to pass 4 m inside the discovery radius edge, eased in and out over ~120 m
            const reach = m.routeX(l.z) - l.x - (l.r - 4);
            const off = (z: number) => (detour ? -Math.max(0, reach) * Math.exp(-(((z - l.z) / 70) ** 2)) : 0);
            const drive = follow(m, off);
            let t = 0;
            let close = Infinity;
            while (p.s.pos.z < z1 && t < 60) {
              p.step(drive(p.s, t));
              t += PHYS_DT;
              close = Math.min(close, Math.hypot(p.s.pos.x - l.x, p.s.pos.z - l.z));
            }
            return { t, close, crashes: p.s.crashes };
          };
          const a = run(false);
          const b = run(true);
          expect(b.close, l.id).toBeLessThan(l.r);
          expect(b.crashes, l.id).toBe(0);
          worst = Math.max(worst, b.t - a.t);
          if ((globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env.VPLOG) console.log("VP", l.id, (m.routeX(l.z) - l.x).toFixed(1), (b.t - a.t).toFixed(2), a.t.toFixed(2), b.close.toFixed(1), b.crashes);
          n++;
        }
      }
    expect(n).toBeGreaterThanOrEqual(6);
    expect(worst).toBeLessThan(0.33);
  });
});

describe('Fjord: difficulty 2/5 — approachable on Relaxed, the environment rewards reading it', () => {
  const sim = (sd: string, diff: Difficulty, who: 'reader' | 'skilled' | 'average', env: boolean) => {
    const c = course('sprint', sd, diff);
    const m = buildMountain(c);
    const ws = worldSeed(c);
    const e = env ? new BiomeEnvironment(m, ws) : null;
    const drive = who === 'reader' ? readerDriver(m, e) : (s: SkierPhysics['s'], t: number) => autopilotInput(m, s, who, t);
    return simulateCourse(m, new ObstacleField(m, ws), drive, { streaming: true, environment: e, yetiSpeed: DIFFICULTY[diff].yetiSpeed, maxTime: 600 });
  };

  it('Relaxed Sprint: a skier who never tucks ("average") escapes on at least 3 of 5 seeds', () => {
    const wins = ['RB1', 'RB2', 'RB3', 'RB4', 'RB5'].filter((sd) => sim(sd, 'relaxed', 'average', true).outcome === 'victory').length;
    expect(wins).toBeGreaterThanOrEqual(3);
  });

  it('the environment costs a hazard-blind skier more time than one who reads it, and the reader is faster', () => {
    let blindLoss = 0;
    let readerLoss = 0;
    let faster = 0;
    const seeds = ['FJ1', 'FJ3', 'RB4'];
    for (const sd of seeds) {
      const bOn = sim(sd, 'normal', 'skilled', true);
      const bOff = sim(sd, 'normal', 'skilled', false);
      const rOn = sim(sd, 'normal', 'reader', true);
      const rOff = sim(sd, 'normal', 'reader', false);
      for (const r of [bOn, bOff, rOn, rOff]) expect(r.outcome).toBe('victory');
      blindLoss += bOn.time - bOff.time;
      readerLoss += rOn.time - rOff.time;
      if (rOn.time < bOn.time - 1) faster++;
    }
    expect(blindLoss / seeds.length).toBeGreaterThan(1);
    expect(readerLoss).toBeLessThan(blindLoss);
    expect(faster).toBe(seeds.length);
  });
});

describe('Course codes: forgiving input', () => {
  it('accepts a %40-encoded location and stray spaces', () => {
    expect(parseCourseId('CLASSIC-SPR%40FJORD')?.biome).toBe('fjord');
    expect(parseCourseId(' classic-spr @ fjord ')?.biome).toBe('fjord');
    expect(parseCourseId('SEED-1234-SPR-H %40FJORD')?.difficulty).toBe('hard');
    expect(parseCourseId('CLASSIC-SPR%4')).toBeNull();
    expect(parseCourseId('CLASSIC-STD')?.biome).toBe('alpine');
  });
});
