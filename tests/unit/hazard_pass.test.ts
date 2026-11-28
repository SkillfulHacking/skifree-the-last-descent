/**
 * Hazard pass reports and hazard physics (PR #11; Gitar finding r4581847939).
 *
 * The original bug: the near window reaches HAZARD_PASS_RANGE behind the skier, so a hazard left
 * behind was re-tracked with a fresh track every physics step and reported passed again each time
 * (dozens of reports per hazard; thousands of HazardSurvived events per Fjord run), and the fresh
 * track's `struck` re-armed a wind gate's knock behind the skier.
 *
 * The first fix skipped passed hazards entirely — including `k.effect()` — so a sea squall's wind,
 * side-slip, air push and drag stopped at h.r + 2 although the squall acts to h.r + k.reach (4 m).
 *
 * These tests hold both: one report per approach, with the right metadata, and hazard physics
 * identical to production `main` (fixture: tests/unit/hazardWalk.ts run on main 0f365c6) over the
 * whole effect range — except main's re-armed duplicate knock, which must not come back.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment, type EnvironmentEvent } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { makeEnvQuery, makeEnvSample } from '../../src/physics/environment';
import { findGust, peakTime, walk, WALKS, WALK_SEED, type Walk } from './hazardWalk';
import MAIN from './fixtures/hazard_walk_main.json';
import { FJORD_HEADWIND } from '../../src/world/biomes/fjord/biome';
import { HEADWIND_STANCE } from '../../src/physics/environment';

/** production main's Fjord headwind (whatever the stance) when the fixture was recorded */
const MAIN_HEADWIND = 0.0007;

type MainWalk = { hazard: Walk['hazard']; steps: number[][]; events: Walk['events'] };
const main = (MAIN as unknown as { walks: Record<string, MainWalk> }).walks;
const PASS = (w: { events: Walk['events'] }) => w.events.filter((e) => e.type === 'hazard-passed');
const HITS = (w: { events: Walk['events'] }) => w.events.filter((e) => e.type === 'hazard-hit');
/** the walk step at an event's position */
const stepAt = (w: Walk, z: number) => w.steps.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a));

describe('Hazard physics continuity (Gitar r4581847939)', () => {
  const walks = Object.fromEntries(WALKS.map((w) => [w.name, walk(WALK_SEED, w.gate, w.grounded, w.tuck)]));

  it('the walks are the fixture walks (same hazard, same clock, same line)', () => {
    for (const w of WALKS) {
      const a = walks[w.name]!;
      const b = main[w.name]!;
      expect(a.hazard, w.name).toEqual(b.hazard);
      expect(a.steps.length, w.name).toBe(b.steps.length);
      expect(a.hazard.reach).toBe(4);
    }
  });

  it('wind, side-slip, air push and surface drag/friction equal production main at every step (grounded and airborne)', () => {
    for (const w of WALKS) {
      const a = walks[w.name]!;
      const b = main[w.name]!;
      a.steps.forEach((s, i) => {
        const [z, , slipX, airX, drag, friction] = b.steps[i]!;
        const at = `${w.name} z=${z} (${s.over.toFixed(2)} m past the radius)`;
        expect(s.z, at).toBeCloseTo(z!, 9);
        expect(s.slipX, at).toBe(slipX);
        expect(s.airX, at).toBe(airX);
        // (W-080, round 4) the weather's headwind changed on purpose (it now follows the stance, and
        // Fjord's breeze is FJORD_HEADWIND): main's drag, with main's headwind share (0.0007 × gust,
        // whatever the stance) replaced by this build's, must match to rounding — the hazards' own
        // drag is untouched
        const gust = s.headwind / (FJORD_HEADWIND * (1 - (1 - HEADWIND_STANCE.tuck) * w.tuck));
        expect(s.drag - s.headwind, at).toBeCloseTo(drag! - MAIN_HEADWIND * gust, 12);
        expect(s.friction, at).toBe(friction);
      });
    }
  });

  it('the squall still acts between h.r + 2 and h.r + reach, and stops only where its effect does', () => {
    const g = walks['gate-grounded-braced']!;
    const a = walks['gate-airborne']!;
    const p = walks['plain-airborne']!;
    const band = (w: Walk) => w.steps.filter((s) => s.over > 2 && s.over <= w.hazard.reach);
    const past = (w: Walk) => w.steps.filter((s) => s.over > w.hazard.reach + 0.01);
    // grounded: side-slip in the gate's notch (the first PR #11 commit returned 0 here)
    expect(band(g).some((s) => s.slipX > 0)).toBe(true);
    // airborne: the squall's wind adds to the breeze — more than the breeze alone beyond its reach
    const breeze = (w: Walk) => past(w)[0]!.airX;
    expect(band(a).some((s) => s.airX > breeze(a) + 1e-6)).toBe(true);
    expect(band(p).some((s) => s.airX > breeze(p) + 1e-6)).toBe(true);
    // beyond the reach: nothing from the squall
    for (const s of past(g)) expect(s.slipX).toBe(0);
    for (const w of [a, p]) for (const s of past(w)) expect(s.airX).toBeCloseTo(breeze(w), 12);
  });

  it('a tucked skier is knocked no more than on main, never after the hazard is reported, one hit event per knock', () => {
    const a = walks['gate-grounded-tucked']!;
    const b = main['gate-grounded-tucked']!;
    const mainKnock = b.steps.map((s) => s[6] === 1);
    const knocks = a.steps.map((s) => s.knock);
    // every knock is one main also gives at that step
    knocks.forEach((k, i) => {
      if (k) expect(mainKnock[i], `step ${i}`).toBe(true);
    });
    // main's extra knock is the re-armed one: after main's first pass report (a fresh track behind the skier)
    const firstMainPass = PASS(b)[0]!.z;
    knocks.forEach((k, i) => {
      if (mainKnock[i] && !k) expect(a.steps[i]!.z, 'the only knock dropped is main’s re-armed duplicate').toBeGreaterThan(firstMainPass);
    });
    expect(knocks.filter(Boolean).length).toBe(mainKnock.filter(Boolean).length - 1);
    expect(HITS(a).length).toBe(knocks.filter(Boolean).length);
    const passZ = PASS(a)[0]!.z;
    for (const e of HITS(a)) expect(e.z).toBeLessThan(passZ);
  });

  it('each walk reports the hazard passed exactly once, beyond its reach, with main’s metadata', () => {
    for (const w of WALKS) {
      const a = walks[w.name]!;
      const b = main[w.name]!;
      const pa = PASS(a);
      expect(pa.length, w.name).toBe(1);
      expect(PASS(b).length, `${w.name} on main (the original bug)`).toBeGreaterThan(1);
      const at = stepAt(a, pa[0]!.z);
      expect(at.over, w.name).toBeGreaterThan(a.hazard.reach);
      // entered / hit / closest as main's first report gave them (hit: main's knocks before it)
      const pb = PASS(b)[0]!;
      expect({ entered: pa[0]!.entered, closest: pa[0]!.closest }, w.name).toEqual({ entered: pb.entered, closest: pb.closest });
      expect(pa[0]!.hit, w.name).toBe(HITS(a).length > 0);
      // enter / exit / active: once each, as on main
      for (const t of ['hazard-enter', 'hazard-exit', 'hazard-active']) {
        expect(a.events.filter((e) => e.type === t).length, `${w.name} ${t}`).toBe(b.events.filter((e) => e.type === t).length);
      }
    }
  });
});

describe('Hazard pass lifecycle', () => {
  const c = makeCourse('custom', 'sprint', { biome: 'fjord', customText: WALK_SEED, difficulty: 'normal' });
  const ws = worldSeed(c);
  const m = buildMountain(c);
  const h = findGust(m, ws, true)!;
  const t = peakTime(h);
  const G = (h.params as { gate: { x: number; r: number } }).gate;
  const x = G.x - 0.8 * G.r;
  const ski = (env: BiomeEnvironment, z0: number, z1: number, tuck = 0) => {
    const q = makeEnvQuery();
    const out = makeEnvSample();
    const steps: { z: number; slipX: number; knock: boolean }[] = [];
    const dir = z1 >= z0 ? 1 : -1;
    for (let z = z0; dir > 0 ? z <= z1 : z >= z1; z += 0.25 * dir) {
      Object.assign(q, { x, z, y: m.heightAt(x, z), vx: 0, vy: 0, vz: 18 * dir, speed: 18, grounded: true, crashed: false, surface: 'snow', t, tuck });
      env.sample(q, out);
      steps.push({ z, slipX: out.groundSlipX, knock: !!out.knock });
    }
    return steps;
  };
  const listen = (env: BiomeEnvironment) => {
    const ev: EnvironmentEvent[] = [];
    env.listen((e) => {
      if ('hazard' in e && e.hazard.id === h.id) ev.push(e);
    });
    return ev;
  };

  it('frames after the report do not inflate the counters', () => {
    const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
    const ev = listen(env);
    ski(env, h.z - h.r - 10, h.z + h.r + 8, 1);
    const n = ev.length;
    // stand behind it, inside the near window, for many steps
    const q = makeEnvQuery();
    const out = makeEnvSample();
    for (let i = 0; i < 400; i++) {
      Object.assign(q, { x, z: h.z + h.r + 8 + (i % 20) * 0.1, y: m.heightAt(x, h.z + h.r + 8), grounded: true, speed: 18, vz: 18, t, tuck: 1, surface: 'snow' });
      env.sample(q, out);
    }
    expect(ev.length).toBe(n);
    expect(ev.filter((e) => e.type === 'hazard-passed').length).toBe(1);
  });

  it('a run reset clears the record: the next run reports the hazard again, once', () => {
    const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
    const ev = listen(env);
    ski(env, h.z - h.r - 10, h.z + h.r + 8, 1);
    env.reset();
    ski(env, h.z - h.r - 10, h.z + h.r + 8, 1);
    expect(ev.filter((e) => e.type === 'hazard-passed').length).toBe(2);
    expect(ev.filter((e) => e.type === 'hazard-hit').length).toBe(2 * 2);
  });

  it('backtracking into a reported hazard: its wind still acts; no events, no second knock', () => {
    const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
    const ev = listen(env);
    ski(env, h.z - h.r - 10, h.z + h.r + 8, 1);
    const n = ev.length;
    const back = ski(env, h.z + h.r + 8, h.z - h.r - 10, 1);
    expect(ev.length).toBe(n);
    expect(back.some((s) => s.slipX > 0)).toBe(true);
    expect(back.some((s) => s.knock)).toBe(false);
  });

  it('passed ids are pruned on a long course (bounded), and every hazard is still reported once', () => {
    const lc = makeCourse('custom', 'expedition', { biome: 'fjord', customText: 'HP-LONG', difficulty: 'normal' });
    const lws = worldSeed(lc);
    const lm = buildMountain(lc);
    const env = new BiomeEnvironment(lm, lws, { difficulty: 'normal' });
    const seen = new Map<number, number>();
    env.listen((e) => {
      if (e.type === 'hazard-passed') seen.set(e.hazard.id, (seen.get(e.hazard.id) ?? 0) + 1);
    });
    const q = makeEnvQuery();
    const out = makeEnvSample();
    let maxKept = 0;
    for (let z = 0; z < lm.finishZ; z += 1) {
      const xx = lm.routeX(z);
      Object.assign(q, { x: xx, z, y: lm.heightAt(xx, z), vz: 18, speed: 18, grounded: true, crashed: false, surface: 'snow', t: z / 18 });
      env.sample(q, out);
      maxKept = Math.max(maxKept, (env as unknown as { passed: Map<number, number> }).passed.size);
    }
    expect(seen.size).toBeGreaterThan(256);
    for (const [id, n] of seen) expect(n, `hazard ${id}`).toBe(1);
    // the record is pruned to the hazards within 400 m behind once it passes 256 ids
    expect(maxKept).toBeLessThan(256 + 64);
  }, 300_000);
});

describe('Hazard pass reports over a whole run', () => {
  it('each hazard is reported passed at most once per run (Fjord, skilled autopilot)', () => {
    const c = makeCourse('custom', 'sprint', { biome: 'fjord', customText: 'HP1', difficulty: 'normal' });
    const ws = worldSeed(c);
    const m = buildMountain(c);
    const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
    const seen = new Map<number, number>();
    const hits = new Map<number, number>();
    env.listen((e) => {
      if (e.type === 'hazard-passed') seen.set(e.hazard.id, (seen.get(e.hazard.id) ?? 0) + 1);
      if (e.type === 'hazard-hit') hits.set(e.hazard.id, (hits.get(e.hazard.id) ?? 0) + 1);
    });
    simulateCourse(m, new ObstacleField(m, ws), (s, tt) => autopilotInput(m, s, 'skilled', tt), { streaming: true, environment: env, yetiSpeed: DIFFICULTY.normal.yetiSpeed, maxTime: 400 });
    expect(seen.size).toBeGreaterThan(3);
    for (const [id, n] of seen) expect(n, `hazard ${id}`).toBe(1);
    // a gate's knock: at most the two strikes of one approach (in, and out past its core)
    for (const [id, n] of hits) expect(n, `hazard ${id}`).toBeLessThanOrEqual(2);
  }, 300_000);
});
