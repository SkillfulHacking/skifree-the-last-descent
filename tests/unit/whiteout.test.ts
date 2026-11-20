/**
 * Whiteout Ridge (Pass 5): registration, the storm fronts, exposure, the surface, the hazards and
 * playability. Pure (no three.js) except the registration check.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { getBiome } from '../../src/world/biome';
import { capabilitiesOf, validateCapabilities } from '../../src/world/capabilities';
import { validateWeather, makeWeatherSample } from '../../src/world/capabilities/weather';
import { IDENTITY_SURFACE, type SurfaceModifiers } from '../../src/world/capabilities/surface';
const makeSurfaceModifiers = (): SurfaceModifiers => ({ ...IDENTITY_SURFACE });
import { buildMountain, DIFFICULTY, makeCourse, parseCourseId, courseId, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField, LANE_HALF } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { whiteoutDriver, BLIND, type WhiteoutPolicy } from '../sim/whiteoutDriver';
import { WEATHER_FX_FOG_KEEP } from '../../src/world/look/weatherFx';
/** the round-2 full weather reader (tests/sim/balance.ts POLICIES.informed2) */
const INFORMED2: WhiteoutPolicy = { lines: 'weather', drifts: 'gap', blizzard: 'brake', lee: true };
import { collectPlacements } from '../../src/world/hazards/testkit';
import { getHazardKind, hazardPhase } from '../../src/world/hazards/hazard';
import { FRONT, frontAt, frontType, FRONT_TYPES, STORM_FOG, whiteoutExposure, WHITEOUT_WEATHER } from '../../src/world/biomes/whiteout/storm';
import { HARDPACK, WHITEOUT_SURFACE } from '../../src/world/biomes/whiteout/biome';
import { BLIZZARD_TIMING } from '../../src/world/biomes/whiteout/hazards';

const course = (len: LengthMode, seed: string, difficulty: Difficulty = 'normal') => makeCourse('custom', len, { biome: 'whiteout', customText: seed, difficulty });

describe('Whiteout Ridge: registration', () => {
  it('registers with valid capabilities, a 3/5 rating and its own code', () => {
    const b = getBiome('whiteout');
    expect(b.id).toBe('whiteout');
    expect(validateCapabilities(b)).toEqual([]);
    expect(capabilitiesOf(b).rating.level).toBe(3);
    expect(capabilitiesOf(getBiome('fjord')).rating.level).toBeLessThan(3);
    const c = course('standard', 'W1');
    expect(courseId(c)).toMatch(/@WHITE$/);
    expect(parseCourseId(courseId(c))?.biome).toBe('whiteout');
  });
});

describe('Whiteout Ridge: storm fronts', () => {
  it('pass validateWeather and are deterministic', () => {
    expect(validateWeather(WHITEOUT_WEATHER)).toEqual([]);
    const a = makeWeatherSample();
    const b = makeWeatherSample();
    for (const t of [0, 40, 77.7, 300, 1234.5]) {
      WHITEOUT_WEATHER.sample(10, 900, t, 42, a);
      WHITEOUT_WEATHER.sample(10, 900, t, 42, b);
      expect(a).toEqual(b);
    }
  });

  it('start calm, telegraph each storm for the build time, then storm and ease; every front clears', () => {
    expect(frontAt(5, 7).phase).toBe('clear');
    expect(frontAt(5, 7).s).toBe(0);
    for (const seed of [1, 7, 99, 12345]) {
      let prev = 'clear';
      let buildStart = 0;
      let storms = 0;
      for (let t = 0; t < 1200; t += 0.25) {
        const f = frontAt(t, seed);
        if (f.phase !== prev) {
          // the phases always come in order
          const order = ['clear', 'build', 'storm', 'ease'];
          expect(order.indexOf(f.phase)).toBe((order.indexOf(prev) + 1) % 4);
          if (f.phase === 'build') buildStart = t;
          if (f.phase === 'storm') {
            expect(t - buildStart).toBeGreaterThanOrEqual(FRONT.build - 0.3);
            storms++;
          }
          prev = f.phase;
        }
        // full storms close right in; grazing fronts only partly (FRONT_TYPES)
        if (f.phase === 'storm') expect(f.s).toBeGreaterThanOrEqual(frontType(f.k, seed) === 'graze' ? 0.44 : 0.59);
      }
      // a front every ~1.5–2 min on average: clear vista windows between them
      expect(storms).toBeGreaterThanOrEqual(7);
      expect(storms).toBeLessThanOrEqual(16);
    }
  });

  it('the weather is not a metronome: front types and spacing vary along a long run', () => {
    for (const seed of [5, 77, 2024]) {
      const types = new Set<string>();
      const gaps: number[] = [];
      let lastBuild = -1;
      let k = -1;
      for (let t = 0; t < 3600; t += 0.5) {
        const f = frontAt(t, seed);
        if (f.phase === 'build' && f.k !== k) {
          k = f.k;
          types.add(frontType(k, seed));
          if (lastBuild >= 0) gaps.push(t - lastBuild);
          lastBuild = t;
        }
      }
      expect(types.size, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
      // the spacing between storms varies a lot (coefficient of variation ≥ 0.25)
      expect(sd / mean).toBeGreaterThan(0.25);
      expect(Object.keys(FRONT_TYPES)).toContain(frontType(3, seed));
    }
  });

  it('the fog closes in hard in a storm but stays within the accessibility ceiling', () => {
    const b = getBiome('whiteout');
    const s = makeWeatherSample();
    let maxVis = 0;
    for (let t = 0; t < 600; t += 1) {
      WHITEOUT_WEATHER.sample(0, 1000, t, 3, s);
      maxVis = Math.max(maxVis, s.visibility);
    }
    expect(maxVis).toBeGreaterThan(16);
    // (round 2, W-039) a storm reads as a whiteout: half the contrast gone by ~50 m (FogExp2) — the
    // ceiling still keeps it there (≥ 50 m), the drift-gap markers keep ~45% of their colour through
    // it, and Reduce Weather Effects keeps the round-1 ceiling: half the contrast at ≥ 75 m
    const max = b.atmosphere.maxFogDensity!;
    expect(Math.sqrt(Math.LN2) / max).toBeGreaterThanOrEqual(50);
    expect(Math.sqrt(Math.LN2) / max).toBeLessThan(60);
    const reduced = b.atmosphere.fogDensity * (1 + (STORM_FOG.storm - 1) * WEATHER_FX_FOG_KEEP);
    expect(Math.sqrt(Math.LN2) / Math.min(max, reduced)).toBeGreaterThanOrEqual(75);
  });
});

describe('Whiteout Ridge: exposure and snow', () => {
  it('the trees and gullies are sheltered, the ridges and the fast lines exposed', () => {
    const m = buildMountain(course('standard', 'W2'));
    const P = m.profile;
    let shelter = 0;
    let open = 0;
    let altHigher = 0;
    let alts = 0;
    for (let z = 300; z < m.finishZ - 300; z += 50) {
      const seg = P.segmentAt(z);
      const e = whiteoutExposure(m, m.routeX(z), z);
      // (inside a segment, away from the 80 m blend at its ends)
      if (P.segmentAt(z - 40) !== seg || P.segmentAt(z + 40) !== seg) continue;
      if (seg === 'forest' || seg === 'chute') expect(e).toBeLessThan(0.62), shelter++;
      if (seg === 'ridgeline' || seg === 'basin') expect(e).toBeGreaterThan(0.75), open++;
      const ax = P.altRouteX(z);
      if (ax !== null && m.altLane(ax, z) > 0.9) {
        alts++;
        if (whiteoutExposure(m, ax, z) >= e) altHigher++;
      }
    }
    expect(shelter + open).toBeGreaterThan(20);
    if (alts) expect(altHigher / alts).toBeGreaterThan(0.95);
  });

  it('exposed hard pack: less friction and grip, longer carve; sheltered: slower soft snow', () => {
    const m = buildMountain(course('standard', 'W2'));
    const out = makeSurfaceModifiers();
    let exposed = false;
    let soft = false;
    for (let z = 300; z < m.finishZ - 300 && !(exposed && soft); z += 25) {
      const x = m.routeX(z);
      const e = whiteoutExposure(m, x, z);
      WHITEOUT_SURFACE.modifiers({ biomeId: 'whiteout', x, z, kind: 'snow', mountain: m, weights: () => m.surfaceWeights(x, z) } as never, out);
      if (e >= 0.95) {
        exposed = true;
        expect(out.friction).toBeLessThan(1);
        expect(out.grip).toBeLessThan(1);
        expect(out.carveRadius).toBeGreaterThan(1);
        expect(out.friction).toBeGreaterThanOrEqual(HARDPACK.friction - 1e-9);
      }
      if (e <= 0.3) {
        soft = true;
        expect(out.friction).toBeGreaterThan(1);
      }
    }
    expect(exposed).toBe(true);
  });

  it('the crosswind and gust wobble are scaled by exposure (sheltered lines ski calmer)', () => {
    const c = course('standard', 'W3');
    const m = buildMountain(c);
    const e = new BiomeEnvironment(m, worldSeed(c), { difficulty: 'normal', headwind: false });
    const q = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 15, speed: 15, grounded: true, crashed: false, surface: 'snow' as const, t: 0 };
    const S = { surface: makeSurfaceModifiers(), airAccelX: 0, airAccelZ: 0, groundSlipX: 0, groundSlipZ: 0, balance: 0, knock: null, crash: null, relocate: null };
    // a storm moment
    let t = 0;
    while (frontAt(t, worldSeed(c)).phase !== 'storm') t += 1;
    const sample = (z: number, grounded: boolean) => {
      q.z = z;
      q.x = m.routeX(z);
      q.t = t;
      q.grounded = grounded;
      e.sample(q, S);
      return grounded ? S.balance : Math.abs(S.airAccelX);
    };
    let pairs = 0;
    for (let z = 400; z < m.finishZ - 400; z += 60) {
      const ex = whiteoutExposure(m, m.routeX(z), z);
      const air = sample(z, false);
      if (e.hazards.empty || air === 0) continue;
      // airborne crosswind ∝ exposure (± the hazards' own push, which this check skips where present)
      expect(e.lastExposure).toBeCloseTo(ex, 6);
      pairs++;
    }
    expect(pairs).toBeGreaterThan(5);
  });
});

describe('Whiteout Ridge: hazards', () => {
  it('drift rows leave a gap the width of the lane, on the line or beside it; a blizzard never crashes, and knocks only a tucked, fast skier at its peak', () => {
    const c = course('standard', 'W4');
    const m = buildMountain(c);
    const drift = getHazardKind('wind-drift');
    const bliz = getHazardKind('blizzard');
    // (W-014) the blizzard's gust knocks a skier who stays tucked and fast through its peak — never a crash
    expect(bliz.severity).toBe('knock');
    expect(drift.severity).toBe('slow');
    {
      const h = { id: 1, kind: 'blizzard', x: 0, y: 0, z: 0, r: 58, rot: 0, seed: 1, band: 0, params: { dir: 1 } } as never;
      const peak = { phase: 'active', u: 0.4 } as never;
      const at = (tuck: number, speed: number) => bliz.effect(h, peak, { dx: 0, dz: 0, dist: 0, inside: true, speed, grounded: true, heightAbove: 0, t: 0, intensity: 1, tuck });
      expect(at(1, 22)?.knock).toBeTruthy();
      expect(at(0, 22)?.knock).toBeUndefined();
      expect(at(1, 12)?.knock).toBeUndefined();
      for (const e of [at(1, 22), at(0, 22), at(1, 30)]) expect(e?.crash).toBeUndefined();
    }
    expect(BLIZZARD_TIMING.telegraph).toBeGreaterThanOrEqual(4);
    const list = collectPlacements(m, worldSeed(c), [drift], 1, 0, m.finishZ);
    expect(list.length).toBeGreaterThan(10);
    // group by row (same band)
    const rows = new Map<number, typeof list>();
    for (const h of list) rows.set(h.band, [...(rows.get(h.band) ?? []), h]);
    let onLineGaps = 0;
    for (const row of rows.values()) {
      const z = row[0]!.z;
      const xs = row.map((h) => [h.x - h.r, h.x + h.r] as const).sort((a, b) => a[0] - b[0]);
      const lo = m.centerX(z) - m.halfWidth(z);
      const hi = m.centerX(z) + m.halfWidth(z);
      // the widest open stretch of the piste across the row
      let best = 0;
      let bestMid = 0;
      let cur = lo;
      for (const [a, b] of [...xs, [hi, hi] as const]) {
        if (a - cur > best) (best = a - cur), (bestMid = (a + cur) / 2);
        cur = Math.max(cur, b);
      }
      expect(best).toBeGreaterThanOrEqual(LANE_HALF * 1.2);
      if (Math.abs(bestMid - m.routeX(z)) < LANE_HALF) onLineGaps++;
    }
    // sometimes the gap is on the line, sometimes it is off to one side: a route choice
    expect(onLineGaps).toBeGreaterThan(0);
    expect(onLineGaps).toBeLessThan(rows.size);
  });

  it('a blizzard cell telegraphs, blows (fog, side-slip / air push) and passes; placement is deterministic', () => {
    const c = course('standard', 'W5');
    const m = buildMountain(c);
    const bliz = getHazardKind('blizzard');
    const a = collectPlacements(m, worldSeed(c), [bliz], 1, 0, m.finishZ);
    const b = collectPlacements(m, worldSeed(c), [bliz], 1, 0, m.finishZ);
    expect(a.map((h) => [h.x, h.z])).toEqual(b.map((h) => [h.x, h.z]));
    expect(a.length).toBeGreaterThan(3);
    const h = a[0]!;
    const seen = new Set<string>();
    let slip = 0;
    let fog = 0;
    for (let t = 0; t < 40; t += 0.1) {
      const ph = hazardPhase(bliz, h, t);
      seen.add(ph.phase);
      const eff = bliz.effect(h, ph, { dx: 0, dz: 0, dist: 0, inside: true, speed: 20, grounded: true, heightAbove: 0, t, intensity: 1 });
      if (eff?.slipX) slip = Math.max(slip, Math.abs(eff.slipX));
      if (eff?.visibility) fog = Math.max(fog, eff.visibility);
      expect(eff?.knock ?? null).toBeNull();
      expect(eff?.crash ?? null).toBeNull();
    }
    expect([...seen].sort()).toEqual(['active', 'dormant', 'recovery', 'telegraph']);
    expect(slip).toBeGreaterThan(1.5);
    expect(slip).toBeLessThanOrEqual(4);
    expect(fog).toBeGreaterThan(3);
  });
});

describe('Whiteout Ridge: playability', () => {
  const sim = (len: LengthMode, seed: string, diff: Difficulty, style: 'skilled' | 'careless') => {
    const c = course(len, seed, diff);
    const ws = worldSeed(c);
    const m = buildMountain(c);
    return simulateCourse(m, new ObstacleField(m, ws), (s, t) => autopilotInput(m, s, style, t), {
      streaming: true,
      environment: new BiomeEnvironment(m, ws, { difficulty: diff }),
      yetiSpeed: DIFFICULTY[diff].yetiSpeed,
      maxTime: len === 'standard' ? 1300 : 900,
      snowballs: diff === 'hard',
      dodge: diff === 'hard' && style === 'skilled',
    });
  };
  // (W-014/W-015) Normal is no longer an automatic escape for a skier who ignores the weather: the
  // tests drive a player who reads it (tests/sim/whiteoutDriver: 0.25 s reaction, steers round what
  // it can see) — and one who doesn't — on fixed seeds, recorded in DEFECTS.md.
  const play = (seed: string, diff: Difficulty, p: WhiteoutPolicy) => {
    const c = course('sprint', seed, diff);
    const ws = worldSeed(c);
    const m = buildMountain(c);
    const env = new BiomeEnvironment(m, ws, { difficulty: diff });
    const field = new ObstacleField(m, ws);
    return simulateCourse(m, field, whiteoutDriver(m, env, ws, p, undefined, 0.25, field), {
      streaming: true, environment: env, yetiSpeed: DIFFICULTY[diff].yetiSpeed, maxTime: 900,
      snowballs: diff === 'hard', dodge: diff === 'hard',
    }).outcome;
  };
  it('a skilled skier finishes Relaxed Sprint on every seed; a careless one is caught on Normal', () => {
    const wins = ['WP1', 'WP2', 'WP3', 'WP4'].filter((s) => sim('sprint', s, 'relaxed', 'skilled').outcome === 'victory').length;
    expect(wins).toBe(4);
    expect(sim('sprint', 'WP1', 'normal', 'careless').outcome).toBe('caught');
  }, 900_000);
  it('Normal rewards reading the weather; Hard is winnable by a skier who reads it', () => {
    // (round 2, W-035: the full weather reader — storm line, drift gaps, blizzard stance, the lee —
    // balance/w035-final) WD8 / WD2 Normal: the informed skier escapes, the weather-blind one is caught
    // (round 3, W-056: every chase now opens on a fair stretch, and blind play wins more Sprints — 18/24
    // on W3H and W2H, the reader 24/24, balance/w056) WD10: the reader escapes, the weather-blind one
    // is caught; WD1: both escape, the blind one by 4.8 m (the reader by 49)
    expect(play('WD10', 'normal', INFORMED2)).toBe('victory');
    expect(play('WD10', 'normal', BLIND)).toBe('caught');
    for (const s of ['WD2', 'WD8']) expect(play(s, 'normal', INFORMED2), s).toBe('victory');
    for (const s of ['WD3', 'WD5']) expect(play(s, 'normal', INFORMED2), s).toBe('victory');
    // Hard: a skier who reads the weather can win (WD3); not automatic for the blind one (WD1, WD2)
    expect(play('WD3', 'hard', INFORMED2)).toBe('victory');
    for (const s of ['WD1', 'WD2']) expect(play(s, 'hard', BLIND), s).toBe('caught');
  }, 900_000);
});
