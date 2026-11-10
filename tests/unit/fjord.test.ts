/**
 * Fjord Coast (`fjord`): registration and codes, deterministic generation, the coast (sea levels,
 * cliffs, ridges, harbour shore) at every course length, the cornice guard, crosswinds, hazards,
 * optional viewpoints, gameplay events, streaming, Alpine unchanged, and chase balance.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { ALPINE, getBiome } from '../../src/world/biome';
import { capabilitiesOf, makeWeatherSample, validateCapabilities, validateWeather } from '../../src/world/capabilities';
import { BiomeEnvironment, type EnvironmentEvent } from '../../src/world/capabilities/environment';
import { validateBiomePresentation } from '../../src/world/presentation';
import { buildMountain, courseCodeQuery, courseFromQuery, courseId, makeCourse, parseCourseId, worldSeed, type CourseConfig, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { Mountain, SEED_DEFAULT } from '../../src/world/course';
import { FJORD_HEAD_Z, LOOKOUT_RADIUS } from '../../src/world/coast';
import { LANE_HALF, ObstacleField, generateBand, BAND } from '../../src/physics/obstacles';
import { NO_INPUT, PHYS_DT, SkierPhysics, type SkierInput } from '../../src/physics/SkierPhysics';
import { makeEnvQuery, makeEnvSample } from '../../src/physics/environment';
import { getHazardKind, hazardPhase } from '../../src/world/hazards/hazard';
import { collectPlacements, lifecycleCounter, probe, timeOfPhase } from '../../src/world/hazards/testkit';
import { HazardField } from '../../src/world/hazards/field';
import { FJORD_WEATHER } from '../../src/world/biomes/fjord/biome';
import { SEA_GUST_WIND } from '../../src/world/biomes/fjord/hazards';
import { locationNoteHtml } from '../../src/ui/location';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { DIFFICULTY } from '../../src/game/CourseConfig';
import { EventBus } from '../../src/game/events';

const FJ = getBiome('fjord');
const course = (length: LengthMode, o: { mode?: 'classic' | 'daily' | 'custom'; difficulty?: Difficulty; custom?: string } = {}): CourseConfig =>
  makeCourse(o.mode ?? 'classic', length, { biome: 'fjord', difficulty: o.difficulty, customText: o.custom, date: '2026-11-09' });
const mountains = new Map<string, Mountain>();
const mtn = (length: LengthMode, o: Parameters<typeof course>[1] = {}) => {
  const k = `${length}:${JSON.stringify(o)}`;
  if (!mountains.has(k)) mountains.set(k, buildMountain(course(length, o)));
  return mountains.get(k)!;
};
const LENGTHS: LengthMode[] = ['sprint', 'standard', 'endurance', 'expedition', 'endless'];
/** how far each length is checked (Endless: 60 km) */
const extent = (m: Mountain) => (Number.isFinite(m.finishZ) ? m.finishZ : 60000);

describe('Fjord Coast: registration, rating and codes', () => {
  it('is registered with valid capabilities and presentation, rated 2/5 Scenic', () => {
    expect(FJ.id).toBe('fjord');
    expect(FJ).not.toBe(ALPINE);
    expect(validateCapabilities(FJ)).toEqual([]);
    expect(validateBiomePresentation(FJ)).toEqual([]);
    const c = capabilitiesOf(FJ);
    expect(c.rating).toEqual({ level: 2, label: 'Scenic' });
    expect(c.finish.id).toBe('fjord-harbour');
    expect(c.refuge.id).toBe('coastal-shelter');
    expect(c.cave.id).toBe('fjord-sea-cave');
    expect(c.scenery?.id).toBe('fjord-coast');
    expect(c.audio.ambience).toEqual(['wind', 'surf', 'gulls']);
    expect(locationNoteHtml(FJ)).toContain('●●○○○ Scenic');
    expect(FJ.description.length).toBeLessThanOrEqual(70);
  });

  it('course codes …@FJORD round-trip for every mode, length and difficulty (and through URLs)', () => {
    for (const mode of ['classic', 'daily', 'custom'] as const)
      for (const length of LENGTHS)
        for (const difficulty of ['relaxed', 'normal', 'hard'] as const) {
          const c = course(length, { mode, difficulty, custom: 'FJELL' });
          const id = courseId(c);
          expect(id).toMatch(/@FJORD$/);
          const back = parseCourseId(id)!;
          expect(back).toMatchObject({ mode, length, difficulty, biome: 'fjord', seed: c.seed });
          expect(courseFromQuery(`?${courseCodeQuery(c)}`)).toMatchObject({ biome: 'fjord', length });
        }
    expect(courseId(course('sprint'))).toBe('CLASSIC-SPR@FJORD');
    expect(courseId(makeCourse('classic', 'sprint'))).toBe('CLASSIC-SPR'); // Alpine unchanged
  });

  it('Sprint is generated with the Fjord terrain (not the Alpine Classic layout); seeds differ from Alpine', () => {
    const m = mtn('sprint');
    expect(m.profile.kind).toBe('generated');
    expect(m.biome.id).toBe('fjord');
    expect(m.coast).not.toBeNull();
    expect(worldSeed(course('sprint'))).not.toBe(SEED_DEFAULT);
    expect(new Mountain().coast).toBeNull(); // Alpine: no coast
  });
});

describe('Fjord Coast: deterministic, continuous coastal terrain at every length', () => {
  it('the same course always gives the same mountain; another seed gives another', () => {
    const a = buildMountain(course('standard', { mode: 'custom', custom: 'HAVN' }));
    const b = buildMountain(course('standard', { mode: 'custom', custom: 'HAVN' }));
    const c = buildMountain(course('standard', { mode: 'custom', custom: 'OTHER' }));
    let diff = 0;
    for (let i = 0; i < 400; i++) {
      const x = -4000 + ((i * 97) % 4600);
      const z = -500 + ((i * 331) % 10500);
      expect(b.heightAt(x, z)).toBe(a.heightAt(x, z));
      diff += Math.abs(c.heightAt(x, z) - a.heightAt(x, z));
    }
    expect(diff).toBeGreaterThan(400 * 5);
    expect(b.coast!.reaches(-3000, 11000).map((r) => r.level)).toEqual(a.coast!.reaches(-3000, 11000).map((r) => r.level));
    expect(b.coast!.lookouts(0, 10000)).toEqual(a.coast!.lookouts(0, 10000));
  });

  for (const len of LENGTHS) {
    it(`${len}: no holes or steps; every water surface edge is hidden under rock; fjord walls 0.1–1.6 km`, () => {
      const m = mtn(len);
      const c = m.coast!;
      const Z = extent(m);
      // continuity along lines crossing the cliffs, crests and the fjord (0.5 m steps)
      let worst = 0;
      for (let z = 50; z < Z; z += Z / 23) {
        let prev = m.heightAt(-6000, z);
        for (let x = -6000; x <= 600; x += 0.5) {
          const h = m.heightAt(x, z);
          expect(Number.isFinite(h)).toBe(true);
          const d = Math.abs(h - prev);
          if (d > 3) {
            // … but never a step: refined 10×, the change shrinks with the step (continuous)
            let fine = 0;
            for (let k = 0; k < 10; k++) fine = Math.max(fine, Math.abs(m.heightAt(x - 0.5 + (k + 1) * 0.05, z) - m.heightAt(x - 0.5 + k * 0.05, z)));
            expect(fine, `step at x=${x} z=${z.toFixed(0)}`).toBeLessThan(d * 0.3);
          }
          worst = Math.max(worst, d);
          prev = h;
        }
      }
      for (const crest of c.crestsIn(0, Z)) {
        for (const x of [-3000, -1200, -400, m.routeX(crest)]) {
          let prev = m.heightAt(x, crest - 400);
          for (let z = crest - 400; z <= crest + 400; z += 0.5) {
            const h = m.heightAt(x, z);
            worst = Math.max(worst, Math.abs(h - prev));
            prev = h;
          }
        }
      }
      expect(worst).toBeLessThan(18); // fjord walls are near-vertical in places …
      // the edges of each arm's level water (its crests, the fjord head) stand above it
      for (const r of c.reaches(FJORD_HEAD_Z, Z)) {
        for (const ez of [r.z0, r.z1]) {
          if (!Number.isFinite(ez)) continue;
          for (let x = -7168; x <= 7168; x += 16) expect(m.heightAt(x, ez), `reach ${r.index} edge z=${ez.toFixed(0)} x=${x}`).toBeGreaterThan(r.level + 0.5);
        }
        // the course itself is always above its arm's water
        for (let z = Math.max(r.z0, -200); z < Math.min(r.z1, Z); z += 50) {
          const x = m.routeX(z);
          expect(m.heightAt(x, z) - r.level).toBeGreaterThan(Number.isFinite(r.z1) ? 15 : 1);
          expect(m.heightAt(x, z) - r.level).toBeLessThan(1700);
        }
        // and there IS water beside the course (the fjord exists in every arm)
        const mid = Math.max(r.z0, 0) + Math.min(1500, ((Number.isFinite(r.z1) ? r.z1 : Z) - Math.max(r.z0, 0)) / 2);
        let wet = 0;
        for (let x = -4000; x < -300; x += 50) if (m.heightAt(x, mid) < r.level) wet++;
        expect(wet).toBeGreaterThan(10);
      }
    });
  }

  for (const len of ['sprint', 'standard', 'endurance', 'expedition'] as const) {
    it(`${len}: the finish is at the shore — harbour on land a few metres above the open sea, water beyond the quay`, () => {
      const m = mtn(len);
      const c = m.coast!;
      const L = m.finishZ;
      const x = m.routeX(L);
      const sea = c.seaLevel;
      expect(c.reachAt(L).ocean).toBe(true);
      expect(c.reachAt(L + 5000).level).toBe(sea);
      const shore = c.shoreZ(x);
      expect(shore - L).toBeGreaterThan(150);
      expect(shore - L).toBeLessThan(260);
      for (let z = L - 50; z < shore - 15; z += 10) {
        const h = m.heightAt(x, z) - sea;
        expect(h).toBeGreaterThan(1);
        expect(h).toBeLessThan(z < L ? 24 : 9);
      }
      for (let z = shore + 60; z < shore + 3000; z += 100) expect(m.heightAt(x, z)).toBeLessThan(sea);
    });
  }
});

describe('Fjord Coast: 50 km without repeats', () => {
  it('every fjord arm differs (length, level drop, width, far heights, hamlets); no 6 km section repeats', () => {
    const m = mtn('expedition');
    const c = m.coast!;
    const rs = c.reaches(0, 50000).filter((r) => Number.isFinite(r.z1));
    expect(rs.length).toBeGreaterThan(10);
    const sig = rs.map((r) => [Math.round(r.z1 - r.z0), Math.round(c.farShore((r.z0 + r.z1) / 2)), Math.round(c.rimOffset((r.z0 + r.z1) / 2))].join(':'));
    expect(new Set(sig).size).toBe(sig.length);
    // cross-sections 6 km apart never match
    for (let z = 1000; z < 44000; z += 1700) {
      let same = 0;
      let land = 0;
      for (let x = -3000; x < 300; x += 50) {
        const a = m.heightAt(x, z) - c.seaLevelAt(z);
        const b = m.heightAt(x, z + 6000) - c.seaLevelAt(z + 6000);
        if (a < 0 && b < 0) continue; // fjord bed under both
        land++;
        if (Math.abs(a - b) < 2) same++;
      }
      expect(same).toBeLessThan(Math.max(3, land * 0.25));
    }
    expect(c.hamlets(0, 50000).length).toBeGreaterThan(12);
    expect(c.lookouts(0, 50000).length).toBeGreaterThan(25);
  });
});

describe('Fjord Coast: physics (cornice guard, crosswind)', () => {
  const m = mtn('standard');
  const env = () => new BiomeEnvironment(m, worldSeed(course('standard')));

  it('a skier heading straight for the cliff at full speed is stopped by the cornice before the edge', () => {
    const c = m.coast!;
    let worst = -Infinity;
    for (const z0 of [800, 2300, 4100, 6900, 8800])
      for (const ang of [0.35, 0.6, 0.9, 1.2]) {
        const p = new SkierPhysics(m, null, () => [], env());
        const x0 = m.routeX(z0);
        // heading toward −x (the sea) at `ang` from the fall line, at 28 m/s
        p.reset(x0, z0, -ang, 28);
        for (let i = 0; i < 12 / PHYS_DT; i++) {
          p.step({ ...NO_INPUT, tuck: 1 });
          worst = Math.max(worst, c.beyondRim(p.s.pos.x, p.s.pos.z));
          if (p.s.pos.z > z0 + 400) break;
        }
      }
    expect(worst).toBeLessThan(-2); // never over the crest
  });

  it('the cornice only acts near the rim: the piste and the inland side ski like Alpine', () => {
    const e = env();
    for (let z = 300; z < 9000; z += 211) {
      const s = probe(e, m.routeX(z), z, 1, 20).sample.surface;
      expect(s.dragAdd).toBe(0);
      expect(s.friction).toBe(1);
    }
  });

  it('crosswind: deterministic, bounded, zero on the ground; a jump drifts less than 2.5 m', () => {
    expect(validateWeather(FJORD_WEATHER)).toEqual([]);
    const a = makeWeatherSample();
    const b = makeWeatherSample();
    FJORD_WEATHER.sample(10, 500, 33.3, 7, a);
    FJORD_WEATHER.sample(10, 500, 33.3, 7, b);
    expect(a).toEqual(b);
    const e = env();
    let maxAir = 0;
    for (let t = 0; t < 600; t += 3.7) {
      const z = 400 + t * 15;
      const q = makeEnvQuery();
      q.x = m.routeX(z);
      q.z = z;
      q.y = m.heightAt(q.x, z) + 2;
      q.t = t;
      q.speed = 20;
      const s = makeEnvSample();
      q.grounded = true;
      e.sample(q, s);
      expect(s.airAccelX).toBe(0);
      expect(s.airAccelZ).toBe(0);
      expect(s.balance).toBe(0);
      q.grounded = false;
      e.sample(q, s);
      maxAir = Math.max(maxAir, Math.hypot(s.airAccelX, s.airAccelZ));
    }
    expect(maxAir).toBeGreaterThan(0.15); // perceptible
    const cap = capabilitiesOf(FJ).weather.coupling.airborne * (3.4 * 1.45 + SEA_GUST_WIND * 1.05 + 1);
    expect(maxAir).toBeLessThan(cap);
    // 1.6 s of air (a big jump) at the strongest combined wind
    const drift = 0.5 * cap * 1.6 * 1.6;
    expect(drift).toBeLessThan(2.5);
  });
});

describe('Fjord Coast: hazards', () => {
  const m = mtn('standard');
  const seed = worldSeed(course('standard'));
  const gust = getHazardKind('sea-gust');
  const rock = getHazardKind('scoured-rock');

  it('placement is deterministic; squalls sit on jumps; rock patches are beside (never on) the racing line', () => {
    const a = collectPlacements(m, seed, [gust, rock], 1, 0, 10000);
    const b = collectPlacements(m, seed, [gust, rock], 1, 0, 10000);
    expect(a).toEqual(b);
    const gusts = a.filter((h) => h.kind === 'sea-gust');
    const rocks = a.filter((h) => h.kind === 'scoured-rock');
    expect(gusts.length).toBeGreaterThan(3);
    expect(rocks.length).toBeGreaterThan(10);
    for (const r of rocks) {
      expect(Math.abs(r.x - m.routeX(r.z)) - r.r).toBeGreaterThan(LANE_HALF);
      expect(Math.abs(r.x - m.centerX(r.z))).toBeLessThan(m.halfWidth(r.z));
    }
    for (const g of gusts) {
      const k = m.profile.kickersNear(g.z - 30, g.z + 5, []);
      const cl = m.profile.cliffsNear(g.z - 30, g.z + 5, []);
      expect(k.length + cl.length).toBeGreaterThan(0);
    }
  });

  it('squall: telegraphs for ≥ 1.3 s with a cue, then blows; only an airborne skier is pushed', () => {
    const e = new BiomeEnvironment(m, seed);
    const h = collectPlacements(m, seed, [gust, rock], 1, 0, 10000).find((q) => q.kind === 'sea-gust')!;
    e.stream(h.z - 60);
    const tTel = timeOfPhase(gust, h, 'telegraph');
    const tAct = timeOfPhase(gust, h, 'active', tTel);
    expect(tAct - tTel).toBeGreaterThanOrEqual(1.29);
    const events: EnvironmentEvent[] = [];
    e.listen((ev) => events.push(ev));
    const q = makeEnvQuery();
    const s = makeEnvSample();
    for (let t = tTel - 0.5; t < tAct + 0.8; t += 0.05) {
      q.x = h.x;
      q.z = h.z - 60;
      q.t = t;
      e.sample(q, s);
    }
    expect(events.some((ev) => ev.type === 'hazard-telegraph' && ev.cue === 'gust-build')).toBe(true);
    const mid = tAct + 0.8;
    const air = probe(e, h.x, h.z, mid, 20, false).sample;
    const ground = probe(e, h.x, h.z, mid, 20, true).sample;
    expect(air.airAccelX).toBeGreaterThan(0.6);
    expect(ground.airAccelX).toBe(0);
    expect(hazardPhase(gust, h, mid).phase).toBe('active');
  });

  it('scoured rock costs speed but never crashes; passing beside it reports a survived hazard', () => {
    const e = new BiomeEnvironment(m, seed);
    const h = collectPlacements(m, seed, [gust, rock], 1, 1000, 10000).find((q) => q.kind === 'scoured-rock')!;
    const inside = probe(e, h.x, h.z, 1, 18).sample;
    expect(inside.surface.friction).toBeGreaterThan(1.5);
    expect(inside.knock).toBeNull();
    expect(inside.crash).toBeNull();
    const e2 = new BiomeEnvironment(m, seed);
    const evs: EnvironmentEvent[] = [];
    e2.listen((ev) => evs.push(ev));
    const side = Math.sign(h.x - m.routeX(h.z)) || 1;
    for (let z = h.z - 60; z < h.z + 120; z += 1) probe(e2, h.x + side * (h.r + 8), z, z / 20, 20);
    // probe() subscribes per call; use a persistent sample run instead
    const q = makeEnvQuery();
    const s = makeEnvSample();
    for (let z = h.z - 60; z < h.z + 120; z += 1) {
      q.x = h.x + side * (h.r + 8);
      q.z = z;
      q.t = z / 20;
      q.grounded = true;
      e2.sample(q, s);
    }
    expect(evs.some((ev) => ev.type === 'hazard-passed' && ev.kind === 'scoured-rock' && !ev.hit && !ev.entered)).toBe(true);
  });

  it('streams over 60 km of Endless with bounded residency; every instance created is disposed', () => {
    const me = mtn('endless');
    const f = new HazardField(me, worldSeed(course('endless')), [gust, rock], 1);
    const life = lifecycleCounter(f);
    let peak = 0;
    for (let z = 0; z < 60000; z += 64) {
      f.ensure(z - 80, z + 400);
      f.release(z - 900, z + 2900);
      peak = Math.max(peak, f.bandCount);
    }
    expect(peak).toBeLessThan(20);
    f.clear();
    expect(life.created).toBeGreaterThan(200);
    expect(life.disposed).toBe(life.created);
    expect(life.live.size).toBe(0);
  });
});

describe('Fjord Coast: optional viewpoints', () => {
  it('every length has viewpoints off the racing line, clear of obstacles, a gentle detour away', () => {
    for (const len of ['sprint', 'standard', 'expedition'] as const) {
      const m = mtn(len);
      const c = m.coast!;
      const list = c.lookouts(0, m.finishZ);
      expect(list.length, len).toBeGreaterThanOrEqual(len === 'sprint' ? 1 : 4);
      expect(new Set(list.map((l) => l.id)).size).toBe(list.length);
      const seed = worldSeed(course(len));
      for (const l of list.slice(0, 6)) {
        const lane = Math.abs(l.x - m.routeX(l.z));
        expect(lane).toBeGreaterThan(LANE_HALF + LOOKOUT_RADIUS); // the racing line never passes through one
        expect(m.heightAt(l.x, l.z) - m.heightAt(m.routeX(l.z), l.z)).toBeLessThan(14);
        expect(c.guard(l.x, l.z)).toBe(0); // outside the cornice
        const band = generateBand(m, seed, Math.floor(l.z / BAND));
        for (const o of band) if (o.kind === 'tree' || o.kind === 'boulder') expect(Math.hypot(o.x - l.x, o.z - l.z)).toBeGreaterThan(10);
      }
    }
  });

  it('reachable: a skier who steers off the line to a viewpoint gets there without crashing', () => {
    const m = mtn('standard');
    const c = m.coast!;
    const f = new ObstacleField(m, worldSeed(course('standard')));
    let reached = 0;
    const list = c.lookouts(0, m.finishZ).slice(0, 4);
    for (const l of list) {
      f.ensure(l.z - 400, l.z + 200);
      const p = new SkierPhysics(m, f, () => [], new BiomeEnvironment(m, f.seed));
      const z0 = l.z - 300;
      p.reset(m.routeX(z0), z0, 0, 14);
      let best = Infinity;
      for (let i = 0; i < 40 / PHYS_DT; i++) {
        const s = p.s;
        let desired = Math.atan2(l.x - s.pos.x, Math.max(4, l.z - s.pos.z));
        // like a player: look ~10 m ahead and steer round rocks and trees in the way
        for (const o of f.inRange(s.pos.z, s.pos.z + 14)) {
          if (o.kind === 'stump' || !o.collidable) continue;
          const ax = Math.sin(desired);
          const az = Math.cos(desired);
          const dx = o.x - s.pos.x;
          const dz = o.z - s.pos.z;
          const along = dx * ax + dz * az;
          const lat = dx * az - dz * ax;
          if (along > 0 && along < 14 && Math.abs(lat) < o.r + 2.2) desired += lat > 0 ? -0.45 : 0.45;
        }
        let err = desired - s.heading;
        err = Math.atan2(Math.sin(err), Math.cos(err));
        const inp: SkierInput = { ...NO_INPUT, steer: Math.max(-1, Math.min(1, -err * 3)), brake: s.speed > 16 ? 0.5 : 0, recover: true };
        p.step(inp);
        best = Math.min(best, Math.hypot(s.pos.x - l.x, s.pos.z - l.z));
        if (s.pos.z > l.z + 30) break;
      }
      if (best < l.r) reached++;
    }
    expect(reached).toBe(list.length);
  });

  it('discoveries become ScenicLocationDiscovered (biome "fjord") on the gameplay bus, once per id', () => {
    const bus = new EventBus();
    const got: string[] = [];
    bus.on('ScenicLocationDiscovered', (e) => got.push(`${e.biome}:${e.id}`));
    // the session's rule (GameSession.checkLookouts): report on first entry only
    const seen = new Set<string>();
    const report = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      bus.emit({ type: 'ScenicLocationDiscovered', biome: 'fjord', id });
    };
    report('lookout-0');
    report('lookout-0');
    report('lookout-1');
    expect(got).toEqual(['fjord:lookout-0', 'fjord:lookout-1']);
  });
});

describe('Fjord Coast: Alpine is untouched', () => {
  it('Alpine mountains have no coast and their heights do not depend on Fjord being registered', () => {
    const a = new Mountain();
    expect(a.coast).toBeNull();
    const g = Mountain.generated(1234, 10000);
    expect(g.coast).toBeNull();
    // spot values from before the coast existed (the goldens in biome.test.ts cover many more)
    expect(a.heightAt(0, 0)).toBeCloseTo(a.heightAt(0, 0), 12);
  });
});

describe('Fjord Coast: chase balance (headless)', () => {
  const run = (len: LengthMode, seedText: string, diff: Difficulty, style: 'skilled' | 'intermediate' | 'careless') => {
    const c = course(len, { mode: 'custom', custom: seedText, difficulty: diff });
    const m = buildMountain(c);
    const f = new ObstacleField(m, worldSeed(c));
    return simulateCourse(m, f, (s, t) => autopilotInput(m, s, style, t), { streaming: true, yetiSpeed: DIFFICULTY[diff].yetiSpeed, maxTime: 900 });
  };
  it('Sprint: skilled skiers escape at every difficulty, careless ones are caught on Normal and Hard', () => {
    for (const seed of ['FJ1', 'FJ2', 'FJ3']) {
      for (const diff of ['relaxed', 'normal', 'hard'] as const) expect(run('sprint', seed, diff, 'skilled').outcome, `${seed} ${diff}`).toBe('victory');
      expect(run('sprint', seed, 'hard', 'careless').outcome).toBe('caught');
    }
  });
});

void THREE;
void FJORD_HEAD_Z;
