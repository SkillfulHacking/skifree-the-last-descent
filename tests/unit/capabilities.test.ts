/**
 * Pass 4 Stage 1 — biome capability foundations:
 * Alpine identity of every module, registry validation, deterministic hazard placement and
 * streaming lifecycle, the hazard runtime (telegraph / hit / recovery / passed), course rules,
 * URL-safe codes and the Location menu labels.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SkierPhysics, PHYS_DT, NO_INPUT, DRIFT_MIN_SPEED, type SkierInput, type SkierEvent } from '../../src/physics/SkierPhysics';
import type { EnvSample, PhysicsEnvironment } from '../../src/physics/environment';
import { generateObstacles, LANE_HALF } from '../../src/physics/obstacles';
import { Mountain, SEED_DEFAULT } from '../../src/world/course';
import { ALPINE, deriveBiome, getBiome, listBiomes, registerBiome, unregisterBiome, type Biome } from '../../src/world/biome';
import '../../src/world/biomes';
import { ALPINE_CAPABILITIES, ALPINE_SURFACE, ALPINE_WEATHER, IDENTITY_SURFACE, capabilitiesOf, combineSurface, makeWeatherSample, parametricWeather, resetSurface, surfaceTable, validateCapabilities, validateSurfaceModifiers, validateWeather, type SurfaceModifiers } from '../../src/world/capabilities';
import { BiomeEnvironment, type EnvironmentEvent } from '../../src/world/capabilities/environment';
import { getHazardKind, hasHazardKind, hazardPhase, periodicPhase, registerHazardKind, unregisterHazardKind, validateHazardKind, MIN_TELEGRAPH_S, type HazardInstance, type HazardKind } from '../../src/world/hazards/hazard';
import { HazardField, generateHazardBand, hazardReserved } from '../../src/world/hazards/field';
import { EXAMPLE_PULSE_HAZARD, collectPlacements, lifecycleCounter, probe, timeOfPhase } from '../../src/world/hazards/testkit';
import { HazardLayer, getFinish, hasCavePresentation, hasFinish, hasRefuge, registerHazardView, unregisterHazardView, validateBiomePresentation } from '../../src/world/presentation';
import { buildMountain, courseCodeQuery, courseFromQuery, courseId, makeCourse, parseCourseId, usesClassicLayout, worldSeed } from '../../src/game/CourseConfig';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { locationNoteHtml, locationOptionLabel, locationRatingText, ratingPips } from '../../src/ui/location';
import { DEBUG_TEST_BIOME_ID, makeDebugTestBiome, wantsDebugTestBiome } from '../../src/world/biomes/debugTestBiome';

// ------------------------------------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------------------------------------
/** Flat synthetic slope (same as physics.test.ts). */
class Slope extends Mountain {
  constructor(private deg: number) {
    super(1);
  }
  override heightAt(_x: number, z: number) {
    return -Math.tan((this.deg * Math.PI) / 180) * z;
  }
  override surfaceWeights() {
    return { ice: 0, powder: 0, groomed: 1 };
  }
}

/** An environment that applies fixed modifiers (isolates the physics hook). */
function fixedEnv(mods: Partial<SurfaceModifiers>, extra: Partial<Omit<EnvSample, 'surface'>> = {}): PhysicsEnvironment {
  return {
    sample(_q, out) {
      resetSurface(out.surface);
      combineSurface(out.surface, mods);
      out.airAccelX = extra.airAccelX ?? 0;
      out.airAccelZ = extra.airAccelZ ?? 0;
      out.balance = extra.balance ?? 0;
      out.knock = extra.knock ?? null;
      out.crash = extra.crash ?? null;
    },
  };
}

function run(p: SkierPhysics, input: SkierInput | ((t: number) => SkierInput), seconds: number, events?: SkierEvent[]) {
  const n = Math.round(seconds / PHYS_DT);
  for (let i = 0; i < n; i++) {
    p.step(typeof input === 'function' ? input(i * PHYS_DT) : input);
    const e = p.drainEvents();
    if (events) events.push(...e);
  }
}

const inp = (o: Partial<SkierInput>): SkierInput => ({ ...NO_INPUT, ...o });

/** A busy scripted input exercising every control. */
const script = (t: number): SkierInput => ({
  steer: Math.sin(t * 0.9) * (t % 11 < 6 ? 1 : 0.4),
  tuck: t % 10 < 3 ? 1 : 0,
  brake: t % 13 > 10 ? 1 : 0,
  drift: t % 7 > 4 && t % 7 < 5.6,
  pop: t % 9 > 8 && t % 9 < 8.4,
  recover: true,
});

function snapshot(p: SkierPhysics): number[] {
  const s = p.s;
  return [s.pos.x, s.pos.y, s.pos.z, s.vel.x, s.vel.y, s.vel.z, s.heading, s.wobble, s.recoverTime, s.driftAmount, s.edgeLoad, s.lean, s.crashed ? 1 : 0, s.grounded ? 1 : 0, ['snow', 'packed', 'powder', 'ice'].indexOf(s.surface)];
}

/** Trace a scripted run on the real Alpine classic course. */
function trace(env: PhysicsEnvironment | null, seconds = 70) {
  const m = new Mountain();
  const f = generateObstacles(m, SEED_DEFAULT);
  const p = new SkierPhysics(m, f, () => [], env);
  p.reset(m.routeX(2), 2, 0, 0);
  const states: number[][] = [];
  const events: SkierEvent[] = [];
  const n = Math.round(seconds / PHYS_DT);
  for (let i = 0; i < n; i++) {
    p.step(script(i * PHYS_DT));
    events.push(...p.drainEvents());
    if (i % 12 === 0) states.push(snapshot(p));
  }
  states.push(snapshot(p));
  return { states, events };
}

const TEST_HAZ_BIOME: Biome = deriveBiome(ALPINE, {
  id: 'test-hazards',
  code: 'THAZ',
  name: 'Test Hazards',
  description: 'Unit-test location with the example hazard.',
  capabilities: { hazards: { kinds: ['test-pulse'], density: 1 }, rating: { level: 2, label: 'Test' } },
});

beforeAll(() => {
  if (!hasHazardKind(EXAMPLE_PULSE_HAZARD.id)) registerHazardKind(EXAMPLE_PULSE_HAZARD);
});
afterAll(() => {
  unregisterHazardKind(EXAMPLE_PULSE_HAZARD.id);
  unregisterBiome('test-hazards');
});

// ------------------------------------------------------------------------------------------------
describe('Alpine identity (every capability reproduces the original game)', () => {
  it('Alpine resolves to the default capability set', () => {
    const c = capabilitiesOf(ALPINE);
    expect(ALPINE.capabilities).toBeUndefined();
    expect(c.surface).toBe(ALPINE_SURFACE);
    expect(c.weather).toBe(ALPINE_WEATHER);
    expect(c.hazards.kinds).toEqual([]);
    expect(c.finish.id).toBe('alpine-resort');
    expect(c.refuge.id).toBe('ski-patrol-cabin');
    expect(c.cave.id).toBe('alpine-cave');
    expect(c.audio.ambience).toEqual(['wind']);
    expect(c.rating).toEqual({ level: 1, label: 'Beginner' });
    expect(validateCapabilities(ALPINE)).toEqual([]);
    expect(validateBiomePresentation(ALPINE)).toEqual([]);
  });

  it('surface: identity modifiers for every surface and position', () => {
    const m = new Mountain();
    const out = { ...IDENTITY_SURFACE, grip: 7 };
    for (const kind of ['snow', 'packed', 'powder', 'ice'] as const)
      for (let z = 0; z < 3000; z += 250) {
        ALPINE_SURFACE.modifiers({ biomeId: 'alpine', x: m.routeX(z) + 7, z, kind, weights: () => m.surfaceWeights(m.routeX(z) + 7, z) }, out);
        expect(out).toEqual(IDENTITY_SURFACE);
      }
  });

  it("weather: today's constants (flake drift windX = 1, base fog, base flakes) and zero physics coupling", () => {
    const w = makeWeatherSample();
    for (let t = 0; t < 600; t += 41) for (let z = -200; z < 50000; z += 7300) expect(ALPINE_WEATHER.sample(13, z, t, 999, w)).toEqual({ windX: 1, windZ: 0, visibility: 1, snowfall: 1, gust: 0 });
    expect(ALPINE_WEATHER.coupling).toEqual({ airborne: 0, balance: 0 });
    expect(validateWeather(ALPINE_WEATHER)).toEqual([]);
  });

  it('hazards: Alpine places none and streaming is a no-op', () => {
    const env = new BiomeEnvironment(Mountain.generated(7, 20000), 7);
    expect(env.physicsIdentity).toBe(true);
    env.stream(0);
    env.stream(9000);
    expect(env.hazards.bandCount).toBe(0);
    expect(env.hazardVisibility(0, 500, 3)).toBe(1);
  });

  it('physics: a scripted run on the Alpine course is bit-identical with and without the hook', () => {
    const base = trace(null);
    const alpine = trace(new BiomeEnvironment(new Mountain(), SEED_DEFAULT));
    // the non-short-circuit path: a surface model that is not flagged identity but returns 1s
    const slow = new BiomeEnvironment(new Mountain(SEED_DEFAULT, undefined, deriveBiome(ALPINE, { id: 'test-identity-path', code: 'TIDP', name: 'x', capabilities: { surface: { id: 'unit-identity', modifiers: (_q, o) => void resetSurface(o) } } })), SEED_DEFAULT);
    expect(slow.physicsIdentity).toBe(false);
    const viaModel = trace(slow);
    expect(base.events.length).toBeGreaterThan(10); // the script really exercised the skier (pops, landings, crashes)
    expect(base.events.some((e) => e.type === 'land')).toBe(true);
    expect(alpine.states).toEqual(base.states);
    expect(alpine.events).toEqual(base.events);
    expect(viaModel.states).toEqual(base.states);
    expect(viaModel.events).toEqual(base.events);
  });

  it('simulation: an autopilot run of the Alpine classic course is identical with and without the environment', () => {
    const m = new Mountain();
    const f = generateObstacles(m, SEED_DEFAULT);
    const drive = (s: Parameters<typeof autopilotInput>[1], t: number) => autopilotInput(m, s, 'skilled', t);
    const a = simulateCourse(m, f, drive, { environment: null });
    const b = simulateCourse(m, generateObstacles(m, SEED_DEFAULT), drive, {});
    expect(b).toEqual(a);
    expect(a.outcome).toBe('victory');
  });
});

// ------------------------------------------------------------------------------------------------
describe('surface modifiers through the physics hook', () => {
  const stopDistance = (env: PhysicsEnvironment | null) => {
    const p = new SkierPhysics(new Slope(4), null, undefined, env);
    p.reset(0, 0, 0, 15);
    const z0 = p.s.pos.z;
    run(p, inp({ brake: 1 }), 12);
    return { d: p.s.pos.z - z0, v: p.s.speed };
  };

  it('brake: weaker pizza → longer stopping distance', () => {
    const a = stopDistance(null);
    const b = stopDistance(fixedEnv({ brake: 0.5 }));
    expect(a.v).toBeLessThan(0.5);
    expect(b.d).toBeGreaterThan(a.d * 1.3);
  });

  it('friction and extra drag: glide further / lower top speed', () => {
    const speedAfter = (env: PhysicsEnvironment | null, deg = 6) => {
      const p = new SkierPhysics(new Slope(deg), null, undefined, env);
      p.reset(0, 0, 0, 3);
      run(p, NO_INPUT, 8);
      return p.s.speed;
    };
    expect(speedAfter(fixedEnv({ friction: 0.3 }))).toBeGreaterThan(speedAfter(null) + 0.5);
    expect(speedAfter(fixedEnv({ dragAdd: 0.02 }), 25)).toBeLessThan(speedAfter(null, 25) - 2);
  });

  it('carve radius and grip: wider turns, more sideways slip', () => {
    const turn = (env: PhysicsEnvironment | null) => {
      const p = new SkierPhysics(new Slope(12), null, undefined, env);
      p.reset(0, 0, 0, 16);
      let slip = 0;
      run(p, (t) => {
        const s = p.s;
        slip += Math.abs(Math.sin(Math.atan2(s.vel.x, s.vel.z) - s.heading)) * PHYS_DT;
        return inp({ steer: t < 1.2 ? 1 : 0 });
      }, 1.6);
      return { heading: Math.abs(p.s.heading), slip };
    };
    const a = turn(null);
    expect(turn(fixedEnv({ carveRadius: 1.8 })).heading).toBeLessThan(a.heading * 0.7);
    expect(turn(fixedEnv({ grip: 0.3 })).slip).toBeGreaterThan(a.slip * 1.5);
  });

  it('drift threshold: drifts start at a lower speed on slippery ground', () => {
    const drifting = (env: PhysicsEnvironment | null) => {
      const p = new SkierPhysics(new Slope(0), null, undefined, env);
      p.reset(0, 0, 0, DRIFT_MIN_SPEED - 1.5);
      p.step(inp({ drift: true }));
      return p.s.drifting;
    };
    expect(drifting(null)).toBe(false);
    expect(drifting(fixedEnv({ driftThreshold: 0.7 }))).toBe(true);
  });

  it('recovery: control returns more slowly after a crash', () => {
    const left = (env: PhysicsEnvironment | null) => {
      const p = new SkierPhysics(new Slope(10), null, undefined, env);
      p.reset(0, 0, 0, 5);
      p.forceCrash();
      p.recover();
      run(p, NO_INPUT, 0.3);
      return p.s.recoverTime;
    };
    expect(left(fixedEnv({ recovery: 0.5 }))).toBeGreaterThan(left(null) + 0.1);
  });

  it('knock and crash from the environment', () => {
    const p = new SkierPhysics(new Slope(10), null, undefined, fixedEnv({}, { knock: { keep: 0.5, wobble: 0.7 } }));
    p.reset(0, 0, 0, 20);
    p.step(NO_INPUT);
    expect(p.s.speed).toBeLessThan(12);
    expect(p.s.wobble).toBeGreaterThan(0.6);
    const q = new SkierPhysics(new Slope(10), null, undefined, fixedEnv({}, { crash: { reason: 'fell into a test', intensity: 1 } }));
    q.reset(0, 0, 0, 20);
    q.step(NO_INPUT);
    expect(q.s.crashed).toBe(true);
    expect(q.drainEvents().find((e) => e.type === 'crash')).toMatchObject({ reason: 'fell into a test' });
  });

  it('surfaceTable blends per-kind modifiers by the surface weights; validation catches broken values', () => {
    const model = surfaceTable('test-ice', { ice: { grip: 0.5, brake: 0.4 } });
    const out = { ...IDENTITY_SURFACE };
    model.modifiers({ biomeId: 't', x: 0, z: 0, kind: 'ice', weights: () => ({ ice: 1, powder: 0, groomed: 0 }) }, out);
    expect(out.grip).toBeCloseTo(0.5);
    expect(out.brake).toBeCloseTo(0.4);
    model.modifiers({ biomeId: 't', x: 0, z: 0, kind: 'snow', weights: () => ({ ice: 0.5, powder: 0, groomed: 0 }) }, out);
    expect(out.grip).toBeCloseTo(Math.sqrt(0.5));
    expect(validateSurfaceModifiers(out)).toEqual([]);
    expect(validateSurfaceModifiers({ ...IDENTITY_SURFACE, grip: 0, carveRadius: NaN })).toHaveLength(2);
  });
});

// ------------------------------------------------------------------------------------------------
describe('weather capability', () => {
  const gusty = parametricWeather({ id: 'test-gusty', wind: [4, 0], gustiness: 0.6, gustPeriod: 3, frontPeriod: 60, visibility: [1, 3], snowfall: [0.5, 2], fogBanks: { coverage: 0.3, visibility: 2, size: 300 }, coupling: { airborne: 0.12, balance: 0.3 } });

  it('is deterministic in (position, time, seed) and varies over time', () => {
    const a = makeWeatherSample();
    const b = makeWeatherSample();
    const seen = new Set<string>();
    for (let t = 0; t < 120; t += 7) {
      gusty.sample(10, 900, t, 42, a);
      gusty.sample(10, 900, t, 42, b);
      expect(a).toEqual(b);
      seen.add(a.windX.toFixed(2));
    }
    expect(seen.size).toBeGreaterThan(5);
    expect(validateWeather(gusty)).toEqual([]);
  });

  it('crosswind pushes an airborne skier; balance coupling wobbles a grounded one', () => {
    const p = new SkierPhysics(new Slope(10), null, undefined, fixedEnv({}, { airAccelX: 2 }));
    p.reset(0, 0, 0, 10);
    p.s.grounded = false;
    p.s.pos.y += 20;
    run(p, NO_INPUT, 0.5);
    expect(p.s.vel.x).toBeCloseTo(1, 1);
    const env = new BiomeEnvironment(Mountain.generated(5, 3000, deriveBiome(ALPINE, { id: 'test-windy', code: 'TWND', name: 'Windy', capabilities: { weather: gusty } })), 5);
    const air = probe(env, 0, 800, 12, 15, false).sample;
    const w = env.weatherAt(0, 800, 12);
    expect(air.airAccelX).toBeCloseTo(0.12 * w.windX, 10);
    const ground = probe(env, 0, 800, 12, 15, true).sample;
    expect(ground.airAccelX).toBe(0);
    expect(ground.balance).toBeCloseTo(0.3 * w.gust, 10);
  });
});

// ------------------------------------------------------------------------------------------------
describe('registries and validation', () => {
  it('hazard kinds: fairness rules are enforced', () => {
    expect(validateHazardKind(EXAMPLE_PULSE_HAZARD as HazardKind)).toEqual([]);
    const bad = (o: Partial<HazardKind>) => validateHazardKind({ ...(EXAMPLE_PULSE_HAZARD as HazardKind), ...o });
    expect(bad({ timing: { kind: 'periodic', dormant: 2, telegraph: MIN_TELEGRAPH_S / 2, active: 1, recovery: 0 } }).join()).toMatch(/telegraphs for only/);
    expect(bad({ view: undefined }).join()).toMatch(/needs a view/);
    expect(bad({ audio: {} }).join()).toMatch(/audio cue/);
    expect(bad({ audio: { hit: 'x' } }).join()).toMatch(/telegraph audio cue/);
    expect(bad({ id: 'Bad Id' }).join()).toMatch(/lowercase/);
    // cosmetic kinds need neither
    expect(bad({ severity: 'cosmetic', view: undefined, audio: undefined })).toEqual([]);
    expect(() => registerHazardKind({ ...(EXAMPLE_PULSE_HAZARD as HazardKind), id: 'test-bad', view: undefined })).toThrow();
    expect(() => registerHazardKind({ ...(EXAMPLE_PULSE_HAZARD as HazardKind) })).toThrow(/already registered/);
    expect(getHazardKind('test-pulse')).toBe(EXAMPLE_PULSE_HAZARD);
  });

  it('biomes: capabilities are validated at registration', () => {
    const make = (caps: Biome['capabilities'], id = 'test-caps') => deriveBiome(ALPINE, { id, code: 'TCAP', name: 'Caps', capabilities: caps });
    expect(() => registerBiome(make({ hazards: { kinds: ['no-such-hazard'], density: 1 } }))).toThrow(/not registered/);
    expect(() => registerBiome(make({ rating: { level: 7 as 1, label: 'x' } }))).toThrow(/rating/);
    expect(() => registerBiome(make({ audio: { ambience: ['no-such-bed'] } }))).toThrow(/ambience/);
    expect(() => registerBiome(make({ weather: { ...ALPINE_WEATHER, id: 'w', coupling: { airborne: 5, balance: 0 } } }))).toThrow(/airborne/);
    expect(listBiomes().map((b) => b.id)).not.toContain('test-caps');
    // the hazard test biome is valid; its presentation needs the hazard view
    expect(validateCapabilities(TEST_HAZ_BIOME)).toEqual([]);
    expect(validateBiomePresentation(TEST_HAZ_BIOME).join()).toMatch(/view "test-pulse" is not registered/);
    expect(validateBiomePresentation(make({ finish: { id: 'nowhere' }, refuge: { id: 'nope', name: 'Nope' }, cave: { id: 'nada' } }))).toHaveLength(3);
  });

  it('presentation registries hold the Alpine finish, refuge and cave', () => {
    expect(hasFinish('alpine-resort') && hasRefuge('ski-patrol-cabin') && hasCavePresentation('alpine-cave')).toBe(true);
    expect(typeof getFinish('alpine-resort').victory).toBe('function');
  });

  it('deriveBiome shares capability models by reference and can derive from a derived biome', () => {
    const a = deriveBiome(ALPINE, { id: 'test-a', code: 'TA', name: 'A', capabilities: { weather: parametricWeather({ id: 'x', wind: [1, 0], gustiness: 0, gustPeriod: 1, frontPeriod: 10, visibility: [1, 1], snowfall: [1, 1], coupling: { airborne: 0, balance: 0 } }) } });
    const b = deriveBiome(a, { id: 'test-b', code: 'TB', name: 'B', capabilities: { rating: { level: 4, label: 'Hard' } }, lighting: { sunIntensity: 1 } });
    expect(b.capabilities!.weather).toBe(a.capabilities!.weather);
    expect(capabilitiesOf(b).rating.level).toBe(4);
    expect(capabilitiesOf(b).surface).toBe(ALPINE_SURFACE);
    expect(b.lighting.sunColor).toEqual(ALPINE.lighting.sunColor);
    expect(capabilitiesOf(a).rating).toEqual(ALPINE_CAPABILITIES.rating);
  });
});

// ------------------------------------------------------------------------------------------------
describe('hazards: deterministic placement and streaming', () => {
  const seed = 9137;
  const m = Mountain.generated(seed, 10000, TEST_HAZ_BIOME);
  const kinds = [EXAMPLE_PULSE_HAZARD as HazardKind];

  it('placement is deterministic, order-independent and seed-dependent', () => {
    const a = collectPlacements(m, seed, kinds, 1, 0, 10000);
    const b = collectPlacements(m, seed, kinds, 1, 0, 10000);
    expect(a.length).toBeGreaterThan(40);
    expect(b).toEqual(a);
    // bands built in reverse order give the same instances
    const rev: HazardInstance[] = [];
    for (let band = Math.floor(9999 / 256); band >= 0; band--) rev.unshift(...generateHazardBand(m, seed, kinds, 1, band));
    expect(rev.filter((h) => h.z < 10000)).toEqual(a);
    const other = collectPlacements(Mountain.generated(seed + 1, 10000, TEST_HAZ_BIOME), seed + 1, kinds, 1, 0, 10000);
    expect(other.map((h) => h.z)).not.toEqual(a.map((h) => h.z));
    // ids are unique
    expect(new Set(a.map((h) => h.id)).size).toBe(a.length);
  });

  it('respects reservations, keeps the lane clear for dangerous kinds, follows density', () => {
    const a = collectPlacements(m, seed, kinds, 1, -300, 10500);
    for (const h of a) {
      expect(hazardReserved(m, h.x, h.z, h.r)).toBe(false);
      expect(Math.abs(h.x - m.routeX(h.z)) - h.r).toBeGreaterThanOrEqual(LANE_HALF);
      expect(h.y).toBe(m.heightAt(h.x, h.z));
    }
    // nothing at the start, the finish or the cave mouths
    const lat = (h: HazardInstance) => Math.abs(h.x - m.centerX(h.z)) - h.r;
    expect(a.some((h) => h.z < 60 + h.r)).toBe(false); // summit, start platform and run-in
    expect(a.some((h) => h.z > m.finishZ - 120 - h.r && lat(h) < 160)).toBe(false); // finish
    for (const e of m.profile.encounters(0, 10000)) expect(a.some((h) => Math.hypot(h.x - (e.anchor.centerX + e.anchor.side * e.anchor.d), h.z - e.anchor.z) < 34 + h.r)).toBe(false);
    expect(collectPlacements(m, seed, kinds, 0, 0, 10000)).toEqual([]);
    expect(collectPlacements(m, seed, kinds, 2, 0, 10000).length).toBeGreaterThan(a.length * 1.6);
  });

  it('streams with the course: bounded residency, every created instance is disposed', () => {
    const endless = Mountain.generated(seed, Infinity, TEST_HAZ_BIOME);
    const field = new HazardField(endless, seed, kinds, 1);
    const c = lifecycleCounter(field);
    let peakBands = 0;
    for (let z = 0; z < 30000; z += 64) {
      field.ensure(z - 80, z + 400);
      field.release(z - 900, z + 1600);
      peakBands = Math.max(peakBands, field.bandCount);
      expect(c.live.size).toBe(field.count);
    }
    expect(peakBands).toBeLessThanOrEqual(12);
    expect(c.created).toBeGreaterThan(150);
    expect(field.stats.created).toBe(c.created);
    field.clear();
    expect(c.disposed).toBe(c.created);
    expect(c.live.size).toBe(0);
    // rebuilt bands are identical to the first build
    const again = new HazardField(endless, seed, kinds, 1);
    again.ensure(20000, 20600);
    expect([...again.all()]).toEqual(collectPlacements(endless, seed, kinds, 1, Math.floor(20000 / 256) * 256, (Math.floor(20600 / 256) + 1) * 256));
  });

  it('views are created and disposed with the hazard bands (HazardLayer)', () => {
    let made = 0;
    let freed = 0;
    registerHazardView('test-pulse', (h) => {
      made++;
      const o = new THREE.Object3D();
      o.position.set(h.x, h.y, h.z);
      return { object: o, dispose: () => void freed++, update: () => {} };
    });
    try {
      expect(validateBiomePresentation(TEST_HAZ_BIOME)).toEqual([]);
      const env = new BiomeEnvironment(Mountain.generated(seed, Infinity, TEST_HAZ_BIOME), seed);
      const layer = new HazardLayer(env, { mountain: env.mountain, quality: 'low', biome: TEST_HAZ_BIOME });
      for (let z = 0; z < 12000; z += 64) {
        env.stream(z);
        env.release(z - 900, z + 1600);
        layer.update(1 / 60);
        expect(layer.liveCount).toBe(env.hazards.count);
        expect(layer.group.children.length).toBe(env.hazards.count);
      }
      expect(made).toBe(env.hazards.stats.created);
      expect(freed).toBe(env.hazards.stats.disposed);
      expect(made).toBeGreaterThan(50);
      layer.dispose();
      expect(freed).toBe(made);
      expect(layer.group.children.length).toBe(0);
      env.dispose();
    } finally {
      unregisterHazardView('test-pulse');
    }
  });
});

// ------------------------------------------------------------------------------------------------
describe('hazards: timing, effects, recovery and gameplay events', () => {
  const seed = 4242;
  const kind = EXAMPLE_PULSE_HAZARD as HazardKind;
  const setup = () => {
    const env = new BiomeEnvironment(Mountain.generated(seed, 10000, TEST_HAZ_BIOME), seed);
    env.stream(1200);
    const h = [...env.hazards.inRange(1000, 1600)][0]!;
    return { env, h };
  };

  it('periodic phases cycle dormant → telegraph → active → recovery with a per-instance offset', () => {
    const T = { kind: 'periodic' as const, dormant: 2, telegraph: 1, active: 0.8, recovery: 0.6 };
    expect(periodicPhase(0.5, 0, T).phase).toBe('dormant');
    expect(periodicPhase(2.5, 0, T)).toEqual({ phase: 'telegraph', u: 0.5 });
    expect(periodicPhase(3.4, 0, T).phase).toBe('active');
    expect(periodicPhase(4.1, 0, T).phase).toBe('recovery');
    expect(periodicPhase(4.5, 0, T).phase).toBe('dormant');
    const { h } = setup();
    expect(hazardPhase(kind, h, 7)).toEqual(hazardPhase(kind, h, 7 + 4.4));
  });

  it('active contact knocks once per contact and reports it; telegraph is announced first', () => {
    const { env, h } = setup();
    const tT = timeOfPhase(kind, h, 'telegraph', 1);
    const before = probe(env, h.x, h.z - 60, tT - 0.02);
    expect(before.events.filter((e) => e.type === 'hazard-telegraph')).toHaveLength(0);
    const warn = probe(env, h.x, h.z - 59, tT + 0.02);
    expect(warn.events.find((e) => e.type === 'hazard-telegraph')).toMatchObject({ kind: 'test-pulse', cue: 'test-pulse-warn' });
    const tA = timeOfPhase(kind, h, 'active', tT);
    expect(tA - tT).toBeGreaterThanOrEqual(MIN_TELEGRAPH_S);
    const hit = probe(env, h.x, h.z, tA + 0.05);
    expect(hit.sample.knock).toEqual({ keep: 0.75, wobble: 0.6 });
    expect(hit.events.map((e) => e.type)).toEqual(expect.arrayContaining(['hazard-active', 'hazard-enter', 'hazard-hit']));
    expect(probe(env, h.x, h.z + 0.5, tA + 0.06).sample.knock).toBeNull(); // still the same contact
    expect(env.hazardVisibility(h.x, h.z, tA + 0.05)).toBeCloseTo(1.5);
  });

  it('recovery phase only reduces grip; dormant/telegraph contact is harmless', () => {
    const { env, h } = setup();
    const tR = timeOfPhase(kind, h, 'recovery', 1);
    const rec = probe(env, h.x, h.z, tR + 0.05).sample;
    expect(rec.knock).toBeNull();
    expect(rec.surface.grip).toBeCloseTo(0.8);
    const tD = timeOfPhase(kind, h, 'dormant', tR);
    const dor = probe(env, h.x, h.z, tD + 0.05).sample;
    expect(dor.knock).toBeNull();
    expect(dor.surface).toEqual(IDENTITY_SURFACE);
  });

  it("'hazard-passed' tells survived (no hit) from hit — the HazardSurvived source", () => {
    const passOnce = (phase: 'dormant' | 'active') => {
      const { env, h } = setup();
      const t = timeOfPhase(kind, h, phase, 1) + 0.05;
      const ev: EnvironmentEvent[] = [];
      env.listen((e) => ev.push(e));
      probe(env, h.x, h.z, t);
      probe(env, h.x, h.z + h.r + 12, t + 0.5);
      return ev.find((e) => e.type === 'hazard-passed' && e.hazard.id === h.id);
    };
    expect(passOnce('dormant')).toMatchObject({ hit: false, entered: true });
    expect(passOnce('active')).toMatchObject({ hit: true, entered: true });
  });

  it('surface-change events fire on every biome (Alpine included)', () => {
    const env = new BiomeEnvironment(new Mountain(), SEED_DEFAULT);
    const ev: EnvironmentEvent[] = [];
    env.listen((e) => ev.push(e));
    const m = env.mountain;
    for (let z = 100; z < 2800; z += 3) probe(env, m.routeX(z) + 9, z, z / 20);
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.type === 'surface-change')).toBe(true);
  });

  it('a skier driven through hazards by the physics is knocked and recovers (full pipeline)', () => {
    const env = new BiomeEnvironment(Mountain.generated(seed, 10000, TEST_HAZ_BIOME), seed);
    const m = env.mountain;
    env.stream(1200);
    const h = [...env.hazards.inRange(1000, 1600)][0]!;
    const tA = timeOfPhase(kind, h, 'active', 3);
    // start 12 m above the pad, timed to arrive while it is active, aimed straight at it
    const p = new SkierPhysics(m, null, undefined, env);
    p.reset(h.x, h.z - 12, 0, 14);
    const hits: EnvironmentEvent[] = [];
    env.listen((e) => e.type === 'hazard-hit' && hits.push(e));
    p.s.time = tA - 12 / 14 + 0.1;
    run(p, NO_INPUT, 1.5);
    expect(hits.length).toBe(1);
    expect(p.s.crashed).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
describe('course rules and codes', () => {
  beforeAll(() => registerBiome(TEST_HAZ_BIOME));

  it('the hand-authored Classic Sprint layout is Alpine-only; other locations get a generated Sprint', () => {
    const alp = makeCourse('classic', 'sprint');
    const loc = makeCourse('classic', 'sprint', { biome: 'test-hazards' });
    expect(usesClassicLayout(alp)).toBe(true);
    expect(usesClassicLayout(loc)).toBe(false);
    expect(buildMountain(alp).profile.kind).toBe('classic');
    const m = buildMountain(loc);
    expect(m.profile.kind).toBe('generated');
    expect(m.biome.id).toBe('test-hazards');
    expect(m.seed).toBe(worldSeed(loc));
    expect(m.finishZ).toBeGreaterThan(2500);
    expect(m.finishZ).toBeLessThan(3600);
    // other modes/lengths unchanged
    for (const c of [makeCourse('classic', 'standard'), makeCourse('daily', 'sprint', { date: '2026-11-07' }), makeCourse('custom', 'sprint', { customText: '9' })]) expect(usesClassicLayout(c)).toBe(false);
  });

  it('existing codes are byte-identical; location codes round-trip; codes are URL-safe', () => {
    for (const code of ['CLASSIC-SPR', 'CLASSIC-STD-H', 'DAILY-2026-11-07-STD-H', 'SEED-777-INF', 'SEED-4294967295-EXP-R']) expect(courseId(parseCourseId(code)!)).toBe(code);
    const c = makeCourse('classic', 'sprint', { biome: 'test-hazards' });
    expect(courseId(c)).toBe('CLASSIC-SPR@THAZ');
    expect(courseCodeQuery(c)).toBe('course=CLASSIC-SPR%40THAZ');
    expect(courseFromQuery(`?debug&${courseCodeQuery(c)}`)).toEqual(c);
    expect(courseFromQuery('?course=CLASSIC-SPR@THAZ')).toEqual(c); // a raw '@' in a query also works
    expect(courseFromQuery('?course=DAILY-2026-11-07-STD')).toEqual(makeCourse('daily', 'standard', { date: '2026-11-07' }));
    expect(courseFromQuery('?course=nope')).toBeNull();
    expect(courseFromQuery('?debug')).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
describe('Location menu', () => {
  it('Alpine and Fjord Coast ship: the game registers no placeholder locations', () => {
    expect(listBiomes().filter((b) => b.id.startsWith('test-') === false).map((b) => b.id)).toEqual(['alpine', 'fjord']);
    expect(getBiome(DEBUG_TEST_BIOME_ID)).toBe(ALPINE);
  });

  it('labels show the name, the 1–5 rating and a one-line description (escaped)', () => {
    expect(ratingPips(1)).toBe('●○○○○');
    expect(ratingPips(5)).toBe('●●●●●');
    expect(locationOptionLabel(ALPINE)).toBe('Alpine');
    expect(locationRatingText(ALPINE)).toBe('Difficulty 1/5 · Beginner');
    const html = locationNoteHtml(ALPINE);
    expect(html).toContain('●○○○○ Beginner');
    expect(html).toContain(ALPINE.description);
    expect(html).not.toMatch(/\n/);
    const odd = deriveBiome(ALPINE, { id: 'test-odd', code: 'TODD', name: 'Odd', description: 'Fish & <chips>', capabilities: { rating: { level: 4, label: 'Expert' } } });
    expect(locationNoteHtml(odd)).toContain('●●●●○ Expert');
    expect(locationNoteHtml(odd)).toContain('Fish &amp; &lt;chips&gt;');
  });

  it('selecting a registered location selects its course and code', () => {
    const c = makeCourse('daily', 'standard', { date: '2026-11-07', biome: 'test-hazards' });
    expect(c.biome).toBe('test-hazards');
    expect(courseId(c)).toBe('DAILY-2026-11-07-STD@THAZ');
    expect(listBiomes().map((b) => b.id)).toContain('test-hazards');
  });

  it('the debug test location is opt-in (?debug&testbiome) and valid', () => {
    expect(wantsDebugTestBiome('?debug&testbiome')).toBe(true);
    expect(wantsDebugTestBiome('?testbiome&debug=1')).toBe(true);
    expect(wantsDebugTestBiome('?debug')).toBe(false);
    expect(wantsDebugTestBiome('?testbiome')).toBe(false);
    const b = makeDebugTestBiome();
    expect(validateCapabilities(b)).toEqual([]);
    expect(validateBiomePresentation(b)).toEqual([]);
    expect(b.name).toMatch(/debug/i);
  });
});
