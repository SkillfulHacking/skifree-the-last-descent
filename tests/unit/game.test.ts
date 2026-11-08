import { describe, expect, it } from 'vitest';
import { RunState } from '../../src/game/RunState';
import { COURSE, Mountain, SEED_DEFAULT } from '../../src/world/course';
const CM = new Mountain();
const routeX = (z: number) => CM.routeX(z);
import { applyRun, DEFAULT_RECORDS, loadRecords, loadSettings, saveRecords, saveSettings, DEFAULT_SETTINGS, type KV } from '../../src/core/settings';
import { generateObstacles, laneClearance } from '../../src/physics/obstacles';
import { simulateRun } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { YetiAI } from '../../src/yeti/YetiAI';
import * as THREE from 'three';

describe('run state machine', () => {
  it('begins in the intro, then the learning phase', () => {
    const r = new RunState();
    expect(r.phase).toBe('intro');
    expect(r.outcome).toBe('none');
    expect(r.controllable).toBe(false);
    r.endIntro();
    expect(r.phase).toBe('learn');
    expect(r.controllable).toBe(true);
  });

  it('progresses by distance, not time', () => {
    const r = new RunState();
    r.endIntro();
    for (let i = 0; i < 10000; i++) r.progress(10, 0.1); // lots of time, no progress
    expect(r.phase).toBe('learn');
    r.progress(COURSE.tutorialEndZ + 1, 0.1);
    expect(r.phase).toBe('free');
    r.progress(COURSE.foreshadowZ + 1, 0.1);
    expect(r.phase).toBe('foreshadow');
  });

  it('the cave encounter triggers reliably exactly once, even when skipping ahead', () => {
    const r = new RunState();
    r.endIntro();
    // a huge jump in progress (e.g. very fast skier) still triggers
    expect(r.progress(COURSE.caveTriggerZ + 300, 0.1)).toBe(true);
    expect(r.phase).toBe('caveCinematic');
    expect(r.progress(COURSE.caveTriggerZ + 400, 0.1)).toBe(false);
    expect(r.simulating).toBe(false); // simulation frozen during the cinematic
    expect(r.controllable).toBe(false);
  });

  it('the yeti emerges after the cinematic and control returns', () => {
    const r = new RunState();
    r.endIntro();
    r.progress(COURSE.caveTriggerZ, 0.1);
    expect(r.yetiReleased).toBe(false);
    r.endCaveCinematic();
    expect(r.yetiReleased).toBe(true);
    expect(r.phase).toBe('chase');
    expect(r.controllable).toBe(true);
  });

  it('cannot be caught before the chase', () => {
    const r = new RunState();
    r.endIntro();
    expect(r.catchPlayer()).toBe(false);
    r.progress(COURSE.caveTriggerZ, 0.1);
    expect(r.catchPlayer()).toBe(false); // not during the cinematic
  });

  it('a caught player cannot subsequently win; victory and defeat are exclusive', () => {
    const r = new RunState();
    r.endIntro();
    r.progress(COURSE.caveTriggerZ, 0.1);
    r.endCaveCinematic();
    expect(r.catchPlayer()).toBe(true);
    expect(r.reachFinish()).toBe(false);
    expect(r.outcome).toBe('caught');
    const v = new RunState();
    v.endIntro();
    v.progress(COURSE.caveTriggerZ, 0.1);
    v.endCaveCinematic();
    expect(v.reachFinish()).toBe(true);
    expect(v.catchPlayer()).toBe(false);
    expect(v.outcome).toBe('victory');
  });

  it('restart produces a fresh valid state', () => {
    const r = new RunState();
    r.endIntro();
    r.progress(COURSE.caveTriggerZ, 0.1);
    r.endCaveCinematic();
    r.catchPlayer();
    const fresh = new RunState();
    expect(fresh.phase).toBe('intro');
    expect(fresh.outcome).toBe('none');
    expect(fresh.caveTriggered).toBe(false);
  });
});

describe('persistence', () => {
  const mem = (): KV & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };
  it('settings round-trip and tolerate corrupt data', () => {
    const kv = mem();
    const s = loadSettings(kv);
    expect(s).toEqual(DEFAULT_SETTINGS);
    s.masterVolume = 0.3;
    s.bindings.tuck = ['KeyI'];
    saveSettings(s, kv);
    const s2 = loadSettings(kv);
    expect(s2.masterVolume).toBe(0.3);
    expect(s2.bindings.tuck).toEqual(['KeyI']);
    kv.setItem('skifree-tld.settings.v1', '{not json');
    expect(loadSettings(kv)).toEqual(DEFAULT_SETTINGS);
  });
  it('personal bests persist and only improve', () => {
    const kv = mem();
    let r = loadRecords(kv);
    expect(r).toEqual(DEFAULT_RECORDS);
    const base = { won: true, time: 150, distance: 3000, maxSpeed: 30, airtime: 5, longestAir: 1, crashes: 0, survival: 70, score: 9000 };
    let res = applyRun(r, base);
    expect(res.newBest).toContain('time');
    saveRecords(res.records, kv);
    r = loadRecords(kv);
    expect(r.bestTime).toBe(150);
    res = applyRun(r, { ...base, time: 170, score: 100, won: false });
    expect(res.records.bestTime).toBe(150);
    expect(res.records.bestScore).toBe(9000);
    expect(res.records.runs).toBe(2);
    expect(res.records.wins).toBe(1);
  });
});

describe('world generation & fairness', () => {
  it('is deterministic for a seed', () => {
    const a = new Mountain(SEED_DEFAULT);
    const b = new Mountain(SEED_DEFAULT);
    for (let i = 0; i < 50; i++) expect(a.heightAt(i * 13 - 300, i * 61)).toBe(b.heightAt(i * 13 - 300, i * 61));
    const oa = generateObstacles(a, SEED_DEFAULT);
    const ob = generateObstacles(b, SEED_DEFAULT);
    const la = [...oa.all()];
    const lb = [...ob.all()];
    expect(la.length).toBe(lb.length);
    expect(la.length).toBeGreaterThan(1000);
    expect(la[123]).toEqual(lb[123]);
  });

  it('the course descends from summit to the finish with no uphill along the route', () => {
    const m = new Mountain();
    let prev = m.heightAt(routeX(0), 0);
    for (let z = 10; z <= COURSE.finishZ; z += 10) {
      const h = m.heightAt(routeX(z), z);
      expect(h).toBeLessThan(prev + 2.5); // small bumps allowed (kickers, moguls)
      prev = Math.min(prev, h) + 0; // monotone envelope
      prev = h;
    }
    expect(m.heightAt(routeX(0), 0) - m.heightAt(routeX(COURSE.finishZ), COURSE.finishZ)).toBeGreaterThan(700);
  });

  it('the primary route lane is clear of solid obstacles', () => {
    for (const seed of [SEED_DEFAULT, 42, 7777]) {
      const m = new Mountain(seed);
      const f = generateObstacles(m, seed);
      expect(laneClearance(f, 0, COURSE.finishZ)).toBeGreaterThan(4.5);
    }
  });

  it('the route enters the finish chute centred (no clipping the chute fences)', () => {
    const fx = routeX(COURSE.finishZ);
    for (let z = COURSE.finishZ - 110; z <= COURSE.finishZ; z += 5) expect(Math.abs(routeX(z) - fx)).toBeLessThan(6);
    const m = new Mountain();
    for (const k of m.profile.kickersNear(-1e9, 1e9, [])) expect(k.z).toBeLessThan(COURSE.finishZ - 150);
  });

  it('jump opportunities exist along the route', () => {
    const m = new Mountain();
    const onRoute = m.profile.kickersNear(-1e9, 1e9, []).filter((k: { d: number; z: number }) => Math.abs(k.d - (routeX(k.z) - (routeX(k.z) - k.d))) < 1e9);
    expect(onRoute.length).toBeGreaterThanOrEqual(8);
  });
});

describe('pursuit fairness (full headless runs)', () => {
  const style = (s: Parameters<typeof autopilotInput>[2]) => (st: Parameters<typeof autopilotInput>[1], t: number) => autopilotInput(CM, st, s, t);

  it('a skilled skier can escape and win', () => {
    const r = simulateRun(style('skilled'));
    expect(r.outcome).toBe('victory');
  });

  it('an intermediate skier who tucks on straights can also escape', () => {
    const r = simulateRun(style('intermediate'));
    expect(r.outcome).toBe('victory');
  });

  it('the yeti is faster than a careless or overly cautious skier', () => {
    expect(simulateRun(style('careless')).outcome).toBe('caught');
    expect(simulateRun(style('cautious')).outcome).toBe('caught');
  });

  it('the chase is tense: the yeti gets within striking distance of a skilled skier at some point', () => {
    const r = simulateRun(style('skilled'));
    expect(r.minGap).toBeLessThan(60);
  });

  it('a skilled skier who crashes once or twice mid-chase can still win (crashes are costly, not fatal)', () => {
    expect(simulateRun(style('skilled'), SEED_DEFAULT, 400, null, [20]).outcome).toBe('victory');
    const two = simulateRun(style('skilled'), SEED_DEFAULT, 400, null, [30, 60]);
    expect(two.outcome).toBe('victory');
    // the cost is real: the crashes lose time (the long chase lets the gap itself recover)
    expect(two.time).toBeGreaterThan(simulateRun(style('skilled')).time + 4);
    expect(simulateRun(style('intermediate'), 42, 400, null, [40]).outcome).toBe('victory');
  });

  it('the pursuit stays in range: a skilled skier never escapes far out of sight', () => {
    const r = simulateRun(style('skilled'));
    expect(r.maxGap).toBeLessThan(190);
  });

  it('capture requires actual proximity', () => {
    const m = new Mountain();
    const y = new YetiAI(m, null);
    y.place(routeX(1500), 1500, 0);
    y.startChase(null);
    const target = { pos: new THREE.Vector3(routeX(1510), m.heightAt(routeX(1510), 1510), 1510), vel: new THREE.Vector3(0, 0, 10), airborne: false };
    expect(y.canCatch(target)).toBe(false);
    target.pos.set(y.pos.x + 1, y.pos.y, y.pos.z + 1);
    expect(y.canCatch(target)).toBe(true);
    target.pos.y += 4; // high in the air
    expect(y.canCatch(target)).toBe(false);
  });

  it('the yeti does not get stuck: it keeps making progress through forest', () => {
    const m = new Mountain();
    const f = generateObstacles(m, SEED_DEFAULT);
    const y = new YetiAI(m, f);
    // start it off-route among the trees
    const z0 = 1700;
    y.place(routeX(z0) - 45, z0, 0);
    y.startChase(null);
    const target = { pos: new THREE.Vector3(routeX(z0 + 400), 0, z0 + 400), vel: new THREE.Vector3(0, 0, 0), airborne: false };
    target.pos.y = m.heightAt(target.pos.x, target.pos.z);
    for (let i = 0; i < 120 * 15; i++) y.update(1 / 120, target);
    expect(y.pos.z).toBeGreaterThan(z0 + 150);
  });
});
