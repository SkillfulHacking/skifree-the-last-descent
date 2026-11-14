import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus, type GameEvent, type RunContext } from '../../src/game/events';
import {
  ACHIEVEMENTS,
  AIRBORNE_MIN_AIR,
  BIOME_IDS,
  HAZARD_VENT_ZONE,
  emptyStats,
  evaluateEvent,
  reconcileProgress,
  viewAchievements,
  type AchievementDef,
  type EarnedMap,
} from '../../src/progression/achievements';
import { PROGRESS_KEY, emptySave, loadProgress, writeProgress, type KV, type ProgressSave } from '../../src/progression/save';
import { ProgressTracker } from '../../src/progression/tracker';
import { simulateRun } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { worldFor } from '../../src/game/simulate';
import { SkierPhysics, PHYS_DT } from '../../src/physics/SkierPhysics';
import { RunTelemetry } from '../../src/game/telemetry';
import type { Kicker } from '../../src/world/profile';

const DAY = '2026-11-09';
const NOW = Date.parse(`${DAY}T12:00:00Z`);

function ctx(p: Partial<RunContext> = {}): RunContext {
  return { courseId: 'CLASSIC-SPR', mode: 'classic', length: 'sprint', biome: 'alpine', difficulty: 'normal', date: null, ...p };
}
const started = (p: Partial<RunContext> = {}): GameEvent => ({ type: 'RunStarted', ...ctx(p) });
const finished = (outcome: 'victory' | 'caught' | 'retired', p: Partial<RunContext> = {}): GameEvent => ({ type: 'RunFinished', ...ctx(p), outcome, distance: 3000, time: 200, refuges: 0, crashes: 0, score: 1000 });

/** Run events through a fresh evaluator; returns the ids earned (in order). */
function play(events: GameEvent[], now = NOW, stats = emptyStats(), earned: EarnedMap = {}): string[] {
  let run: RunContext | null = null;
  const out: string[] = [];
  for (const e of events) {
    if (e.type === 'RunStarted') run = ctx(e);
    out.push(...evaluateEvent(stats, earned, e, { run, now }).map((d) => d.id));
  }
  return out;
}

class MemKV implements KV {
  m = new Map<string, string>();
  writes = 0;
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.writes++;
    this.m.set(k, v);
  }
}

describe('achievement definitions', () => {
  it('have unique, stable, well-formed ids and complete metadata', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toMatch(/^[a-z0-9-]+$/);
      expect(a.name.length).toBeGreaterThan(2);
      expect(a.description.length).toBeGreaterThan(10);
      expect(a.icon).toBeTruthy();
    }
    // the stable ids the save format relies on (never rename)
    expect(ids).toEqual(expect.arrayContaining(['first-descent', 'not-today-yeti', 'pizza-party', 'airborne', 'long-haul', 'daily-ritual', 'scenic-route', 'whiteout-survivor', 'ice-dancer', 'steam-runner']));
  });

  it('location achievements are marked as needing their biome (Fjord Coast ships: Scenic Route no longer does)', () => {
    for (const id of ['whiteout-survivor', 'ice-dancer', 'steam-runner']) {
      const a = ACHIEVEMENTS.find((x) => x.id === id)!;
      expect(a.requires).toBeTruthy();
      expect(a.biome).toBeTruthy();
    }
    const scenic = ACHIEVEMENTS.find((x) => x.id === 'scenic-route')!;
    expect(scenic.biome).toBe('fjord');
    expect(scenic.requires).toBeUndefined();
  });
});

describe('working achievements unlock from event sequences', () => {
  it('First Descent: reaching the resort, not being caught or retiring', () => {
    expect(play([started(), finished('caught')])).toEqual([]);
    expect(play([started({ length: 'endless' }), finished('retired', { length: 'endless' })])).toEqual([]);
    expect(play([started(), finished('victory')])).toContain('first-descent');
  });

  it('Not Today, Yeti: escaping to a refuge or the finish', () => {
    expect(play([{ type: 'YetiEncountered', encounter: 0, difficulty: 'normal' }])).toEqual([]);
    expect(play([{ type: 'YetiEscaped', encounter: 0, via: 'refuge', chaseTime: 40, closestGap: 30 }])).toEqual(['not-today-yeti']);
    expect(play([{ type: 'YetiEscaped', encounter: 2, via: 'finish', chaseTime: 40, closestGap: 30 }])).toEqual(['not-today-yeti']);
  });

  it('Close Shave (hidden): escaping after the Yeti got within 6 m', () => {
    expect(play([{ type: 'YetiEscaped', encounter: 0, via: 'refuge', chaseTime: 40, closestGap: 6.5 }])).not.toContain('close-shave');
    expect(play([{ type: 'YetiEscaped', encounter: 0, via: 'refuge', chaseTime: 40, closestGap: 4 }])).toContain('close-shave');
  });

  it('Pizza Party: 1,000 m of controlled pizza, cumulative across runs, with progress', () => {
    const stats = emptyStats();
    const earned: EarnedMap = {};
    const chunk: GameEvent = { type: 'PizzaBraking', distance: 25 };
    expect(play(Array(39).fill(chunk), NOW, stats, earned)).toEqual([]);
    const v = viewAchievements(stats, earned).find((x) => x.def.id === 'pizza-party')!;
    expect(v.progress).toEqual({ value: 975, target: 1000, unit: 'm' });
    // a later run finishes the job
    expect(play([started(), chunk], NOW, stats, earned)).toEqual(['pizza-party']);
    expect(viewAchievements(stats, earned).find((x) => x.def.id === 'pizza-party')!.earned).toBe(true);
  });

  it(`Airborne: a landed jump with ≥ ${AIRBORNE_MIN_AIR} s airtime`, () => {
    expect(play([{ type: 'JumpLanded', airtime: 1.59, distance: 30, clean: true, landed: true }])).toEqual([]);
    expect(play([{ type: 'JumpLanded', airtime: 2.2, distance: 45, clean: false, landed: false }])).toEqual([]);
    expect(play([{ type: 'JumpLanded', airtime: 1.6, distance: 32, clean: false, landed: true }])).toEqual(['airborne']);
  });

  it('Long Haul: reaching the resort on an Expedition course only', () => {
    expect(play([started({ length: 'endurance' }), finished('victory', { length: 'endurance' })])).not.toContain('long-haul');
    expect(play([started({ length: 'expedition' }), finished('caught', { length: 'expedition' })])).not.toContain('long-haul');
    expect(play([started({ length: 'expedition' }), finished('victory', { length: 'expedition' })])).toContain('long-haul');
  });

  it('Daily Ritual: Daily wins on 3 distinct UTC days, each played on its own day', () => {
    const stats = emptyStats();
    const earned: EarnedMap = {};
    const daily = (date: string, now: number, outcome: 'victory' | 'caught' = 'victory') => play([started({ mode: 'daily', date }), finished(outcome, { mode: 'daily', date })], now, stats, earned);
    const at = (d: string) => Date.parse(`${d}T20:00:00Z`);
    expect(daily('2026-11-01', at('2026-11-01'))).not.toContain('daily-ritual');
    expect(daily('2026-11-01', at('2026-11-01'))).not.toContain('daily-ritual'); // same day twice
    expect(daily('2026-11-02', at('2026-11-02'), 'caught')).not.toContain('daily-ritual'); // not finished
    expect(daily('2026-11-03', at('2026-11-05'))).not.toContain('daily-ritual'); // a past day replayed later
    play([started({ mode: 'classic' }), finished('victory')], at('2026-11-04'), stats, earned); // not Daily
    expect(viewAchievements(stats, earned).find((x) => x.def.id === 'daily-ritual')!.progress!.value).toBe(1);
    expect(daily('2026-11-06', at('2026-11-06'))).not.toContain('daily-ritual');
    expect(daily('2026-11-07', at('2026-11-07'))).toContain('daily-ritual');
  });

  it('Dodgeball: 10 dodged snowballs, cumulative', () => {
    const ev: GameEvent[] = [...Array(9).fill({ type: 'SnowballDodged', distance: 6 }), { type: 'SnowballHit', direct: true, distance: 1 }];
    const stats = emptyStats();
    const earned: EarnedMap = {};
    expect(play(ev, NOW, stats, earned)).toEqual([]);
    expect(play([{ type: 'SnowballDodged', distance: 5 }], NOW, stats, earned)).toEqual(['dodgeball']);
  });

  it('an achievement is earned once; the earned timestamp is the evaluation time', () => {
    const stats = emptyStats();
    const earned: EarnedMap = {};
    expect(play([started(), finished('victory')], NOW, stats, earned)).toEqual(['first-descent']);
    expect(play([started(), finished('victory')], NOW + 5000, stats, earned)).toEqual([]);
    expect(earned['first-descent']).toEqual({ earnedAt: NOW });
  });
});

describe('Airborne is a skill threshold the real physics can reach', () => {
  /** classic course, skilled line; with `pop`: tuck into each kicker and pop off the lip */
  function ride(pop: boolean): string[] {
    const { m, f } = worldFor();
    const phys = new SkierPhysics(m, f);
    phys.reset(m.routeX(0), 0, 0, 0);
    const bus = new EventBus();
    const tel = new RunTelemetry(bus);
    const stats = emptyStats();
    const earned: EarnedMap = {};
    const got: string[] = [];
    bus.onAny((e) => got.push(...evaluateEvent(stats, earned, e, { run: null, now: NOW }).map((d) => d.id)));
    const ks: Kicker[] = [];
    let t = 0;
    while (t < 300 && phys.s.pos.z < m.finishZ) {
      const inp = autopilotInput(m, phys.s, 'skilled', t);
      if (pop) {
        ks.length = 0;
        m.profile.kickersNear(phys.s.pos.z, phys.s.pos.z + 12, ks);
        inp.tuck = 1;
        if (ks[0] && phys.s.grounded) inp.pop = ks[0].z - phys.s.pos.z > 0.6;
      }
      phys.step(inp, PHYS_DT);
      t += PHYS_DT;
      for (const e of phys.drainEvents()) tel.onSkierEvent(e, phys.s);
      tel.step(phys.s, PHYS_DT);
    }
    return got;
  }
  it('rolling over the kickers is not enough (longest ~1.45 s); popping off the lip earns it', () => {
    expect(ride(false)).not.toContain('airborne');
    expect(ride(true)).toContain('airborne');
  });
});

describe('location achievements stay unearned on Alpine, unlock from their biome events', () => {
  it('Scenic Route / Whiteout Survivor / Ice Dancer / Steam Runner', () => {
    // Alpine equivalents earn nothing
    const alpine = play([
      started(),
      { type: 'ScenicLocationDiscovered', biome: 'alpine', id: 'summit' },
      { type: 'DriftCompleted', duration: 4, distance: 60, surface: 'ice', surfaces: { ice: 4 }, controlled: true },
      { type: 'HazardSurvived', biome: 'alpine', kind: HAZARD_VENT_ZONE },
      finished('victory'),
    ]);
    expect(alpine).not.toEqual(expect.arrayContaining(['scenic-route']));
    expect(alpine.filter((x) => ['scenic-route', 'whiteout-survivor', 'ice-dancer', 'steam-runner'].includes(x))).toEqual([]);

    expect(play([{ type: 'ScenicLocationDiscovered', biome: BIOME_IDS.fjord, id: 'lookout-1' }])).toEqual(['scenic-route']);
    expect(play([started({ biome: BIOME_IDS.whiteout, difficulty: 'relaxed' }), finished('victory', { biome: BIOME_IDS.whiteout, difficulty: 'relaxed' })])).not.toContain('whiteout-survivor');
    expect(play([started({ biome: BIOME_IDS.whiteout }), finished('victory', { biome: BIOME_IDS.whiteout })])).toContain('whiteout-survivor');
    const drift = (ice: number, controlled = true): GameEvent => ({ type: 'DriftCompleted', duration: ice + 1, distance: 50, surface: 'ice', surfaces: { ice, snow: 1 }, controlled });
    expect(play([started({ biome: BIOME_IDS.frozen }), drift(2.9)])).toEqual([]);
    expect(play([started({ biome: BIOME_IDS.frozen }), drift(3.5, false)])).toEqual([]);
    expect(play([started({ biome: BIOME_IDS.frozen }), drift(3.5)])).toEqual(['ice-dancer']);
    expect(play([{ type: 'HazardSurvived', biome: BIOME_IDS.volcanic, kind: 'lava-bomb' }])).toEqual([]);
    expect(play([{ type: 'HazardSurvived', biome: BIOME_IDS.volcanic, kind: HAZARD_VENT_ZONE }])).toEqual(['steam-runner']);
  });
});

describe('hidden achievements and the view model', () => {
  it('hidden ones are secret (no progress shown) until earned', () => {
    const stats = emptyStats();
    const earned: EarnedMap = {};
    let v = viewAchievements(stats, earned).find((x) => x.def.id === 'close-shave')!;
    expect(v.secret).toBe(true);
    play([{ type: 'YetiEscaped', encounter: 0, via: 'refuge', chaseTime: 1, closestGap: 3 }], NOW, stats, earned);
    v = viewAchievements(stats, earned).find((x) => x.def.id === 'close-shave')!;
    expect(v.secret).toBe(false);
    expect(v.earned).toBe(true);
  });

  it('a faulty definition cannot break evaluation of the others', () => {
    const bad: AchievementDef = { id: 'bad', name: 'Bad', description: 'throws on every event', category: 'skill', icon: 'x', unlock: () => { throw new Error('x'); } };
    const earned: EarnedMap = {};
    const got = evaluateEvent(emptyStats(), earned, finished('victory'), { run: null, now: NOW }, [bad, ACHIEVEMENTS[0]!]);
    expect(got.map((d) => d.id)).toEqual(['first-descent']);
  });

  it('progress achievements added later are reconciled from existing stats', () => {
    const stats = emptyStats();
    stats.counters['pizzaMeters'] = 1500;
    const earned: EarnedMap = {};
    expect(reconcileProgress(stats, earned, NOW).map((d) => d.id)).toEqual(['pizza-party']);
    expect(reconcileProgress(stats, earned, NOW)).toEqual([]);
  });
});

describe('progress persistence', () => {
  it('round-trips earned achievements, timestamps and stats', () => {
    const kv = new MemKV();
    const s = emptySave();
    play([started(), finished('victory'), { type: 'PizzaBraking', distance: 25 }], NOW, s.stats, s.achievements);
    writeProgress(kv, s);
    const back = loadProgress(kv);
    expect(back.readOnly).toBe(false);
    expect(back.save.achievements).toEqual({ 'first-descent': { earnedAt: NOW } });
    expect(back.save.stats.counters['pizzaMeters']).toBe(25);
    expect(back.save.stats.counters['wins']).toBe(1);
  });

  it('missing storage → empty save; corrupt JSON or bad version → fresh save with a backup', () => {
    expect(loadProgress(null).save.achievements).toEqual({});
    for (const junk of ['{nope', '"string"', '[1,2]', JSON.stringify({ version: 'x' }), JSON.stringify({ version: 0 })]) {
      const kv = new MemKV();
      kv.m.set(PROGRESS_KEY, junk);
      const r = loadProgress(kv);
      expect(r.recovered).toBe(true);
      expect(r.save.achievements).toEqual({});
      expect(kv.m.get(`${PROGRESS_KEY}.corrupt`)).toBe(junk);
    }
  });

  it('repairs bad fields but keeps unknown achievement ids and unknown keys', () => {
    const kv = new MemKV();
    kv.m.set(
      PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        achievements: { 'first-descent': { earnedAt: NOW }, 'from-a-future-build': { earnedAt: NOW - 1 }, broken: { earnedAt: 'yesterday' }, neg: { earnedAt: -5 } },
        stats: { counters: { pizzaMeters: 120, bad: 'x', nan: null, neg: -1 }, sets: { dailyDays: ['2026-11-01', 7, '2026-11-01'], notArr: 3 } },
        futureFeature: { keep: true },
      }),
    );
    const r = loadProgress(kv).save;
    expect(Object.keys(r.achievements).sort()).toEqual(['first-descent', 'from-a-future-build']);
    expect(r.stats.counters).toEqual({ pizzaMeters: 120 });
    expect(r.stats.sets).toEqual({ dailyDays: ['2026-11-01'] });
    expect(r['futureFeature']).toEqual({ keep: true });
    // the unknown id survives a save cycle and is invisible to the screen
    writeProgress(kv, r);
    expect(loadProgress(kv).save.achievements['from-a-future-build']).toEqual({ earnedAt: NOW - 1 });
    expect(viewAchievements(r.stats, r.achievements).some((v) => v.def.id === 'from-a-future-build')).toBe(false);
  });

  it('a save from a newer build loads read-only', () => {
    const kv = new MemKV();
    kv.m.set(PROGRESS_KEY, JSON.stringify({ version: 999, achievements: { airborne: { earnedAt: NOW } }, stats: {} }));
    const r = loadProgress(kv);
    expect(r.readOnly).toBe(true);
    expect(r.save.achievements['airborne']).toBeTruthy();
  });

  it('new achievements need no format change: an old save simply lacks them', () => {
    const kv = new MemKV();
    kv.m.set(PROGRESS_KEY, JSON.stringify({ version: 1, achievements: { 'first-descent': { earnedAt: NOW } }, stats: { counters: {}, sets: {} } }));
    const r = loadProgress(kv).save;
    const v = viewAchievements(r.stats, r.achievements);
    expect(v.filter((x) => x.earned).map((x) => x.def.id)).toEqual(['first-descent']);
    expect(v.length).toBe(ACHIEVEMENTS.length);
  });
});

describe('persist policy: debug runs and simulations never award persistent achievements', () => {
  const store = (kv: KV) => ({ write: (s: ProgressSave) => void writeProgress(kv, s) });

  it('a normal run commits unlocks and stats', () => {
    const kv = new MemKV();
    const t = new ProgressTracker(emptySave(), store(kv), ACHIEVEMENTS, () => NOW);
    const bus = new EventBus();
    const unlocked: Array<[string, boolean]> = [];
    t.onUnlock = (d, p) => unlocked.push([d.id, p]);
    const detach = t.attach(bus, () => true);
    bus.emit(started());
    bus.emit({ type: 'JumpLanded', airtime: 2, distance: 40, clean: true, landed: true });
    bus.emit(finished('victory'));
    detach();
    expect(unlocked).toEqual([['airborne', true], ['first-descent', true]]);
    expect(Object.keys(loadProgress(kv).save.achievements).sort()).toEqual(['airborne', 'first-descent']);
    expect(Object.keys(t.saved.achievements).sort()).toEqual(['airborne', 'first-descent']);
  });

  it('a debug run (persist=false) reports unlocks as unsaved and writes nothing', () => {
    const kv = new MemKV();
    const t = new ProgressTracker(emptySave(), store(kv), ACHIEVEMENTS, () => NOW);
    const bus = new EventBus();
    const unlocked: Array<[string, boolean]> = [];
    t.onUnlock = (d, p) => unlocked.push([d.id, p]);
    const detach = t.attach(bus, () => false);
    bus.emit(started());
    bus.emit(finished('victory'));
    detach();
    expect(unlocked).toEqual([['first-descent', false]]);
    expect(kv.writes).toBe(0);
    expect(t.saved.achievements).toEqual({});
  });

  it('a run tainted mid-way (e.g. teleport) never commits, even if later checks pass', () => {
    const kv = new MemKV();
    const t = new ProgressTracker(emptySave(), store(kv), ACHIEVEMENTS, () => NOW);
    const bus = new EventBus();
    let debugUsed = false;
    const detach = t.attach(bus, () => !debugUsed);
    bus.emit(started());
    bus.emit({ type: 'JumpLanded', airtime: 2, distance: 40, clean: true, landed: true }); // legit, committed
    debugUsed = true;
    bus.emit({ type: 'YetiEscaped', encounter: 0, via: 'refuge', chaseTime: 3, closestGap: 50 });
    debugUsed = false; // can't un-taint
    bus.emit(finished('victory'));
    detach();
    expect(Object.keys(loadProgress(kv).save.achievements)).toEqual(['airborne']);
  });

  it('a tracker over a read-only save (newer build) or without a store never writes', () => {
    const kv = new MemKV();
    const t = new ProgressTracker(emptySave(), null, ACHIEVEMENTS, () => NOW);
    const bus = new EventBus();
    const d = t.attach(bus, () => true);
    bus.emit(finished('victory'));
    d();
    expect(kv.writes).toBe(0);
    expect(t.saved.achievements).toEqual({});
  });

  afterEach(() => vi.unstubAllGlobals());

  it('headless simulations never touch storage', () => {
    const ls = new MemKV();
    vi.stubGlobal('localStorage', ls);
    const { m } = worldFor();
    const r = simulateRun((s, t) => autopilotInput(m, s, 'skilled', t), undefined, 30);
    expect(r.time).toBeGreaterThan(0);
    expect(ls.writes).toBe(0);
  });
});
