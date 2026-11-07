import { describe, expect, it } from 'vitest';
import { Mountain } from '../../src/world/course';
import { ENDLESS, chaseLength } from '../../src/world/profile';
import { ObstacleField, laneClearance } from '../../src/physics/obstacles';
import { simulateGenerated } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { RunState } from '../../src/game/RunState';
import {
  LENGTH_INFO,
  LENGTH_MODES,
  addDays,
  buildMountain,
  courseId,
  customSeed,
  dailySeed,
  isValidDate,
  makeCourse,
  msUntilRollover,
  parseCourseId,
  utcDate,
  courseSpec,
} from '../../src/game/CourseConfig';
import { applyRun, loadRecordBook, loadSettings, recordsFor, saveRecordBook, saveSettings, type KV, type RunStats } from '../../src/core/settings';

const mem = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const skilled = (m: Mountain) => (s: Parameters<typeof autopilotInput>[1], t: number) => autopilotInput(m, s, 'skilled', t);
const careless = (m: Mountain) => (s: Parameters<typeof autopilotInput>[1], t: number) => autopilotInput(m, s, 'careless', t);

describe('course config & daily mountain', () => {
  it('daily seed is deterministic per UTC date and differs between days', () => {
    expect(dailySeed('2026-11-07')).toBe(dailySeed('2026-11-07'));
    const seeds = new Set(Array.from({ length: 60 }, (_, i) => dailySeed(addDays('2026-11-07', -i))));
    expect(seeds.size).toBe(60);
  });

  it('rolls over at 00:00 UTC (not local midnight)', () => {
    const before = Date.UTC(2026, 10, 7, 23, 59, 59);
    const after = Date.UTC(2026, 10, 8, 0, 0, 1);
    expect(utcDate(before)).toBe('2026-11-07');
    expect(utcDate(after)).toBe('2026-11-08');
    expect(makeCourse('daily', 'standard', { now: before }).seed).not.toBe(makeCourse('daily', 'standard', { now: after }).seed);
    expect(msUntilRollover(before)).toBe(1000);
    expect(msUntilRollover(Date.UTC(2026, 10, 8))).toBe(24 * 3600 * 1000);
  });

  it('date helpers handle month/year boundaries and reject bad dates', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-11-07')).toBe(true);
    expect(isValidDate('nope')).toBe(false);
  });

  it('course ids round-trip and are shareable', () => {
    for (const l of LENGTH_MODES) {
      for (const c of [makeCourse('classic', l), makeCourse('daily', l, { date: '2026-10-31' }), makeCourse('custom', l, { customText: '424242' })]) {
        const back = parseCourseId(courseId(c));
        expect(back).not.toBeNull();
        expect(back!.seed).toBe(c.seed);
        expect(back!.length).toBe(c.length);
        expect(courseId(back!)).toBe(courseId(c));
      }
    }
    expect(courseId(makeCourse('daily', 'endurance', { date: '2026-11-07' }))).toBe('DAILY-2026-11-07-END');
    expect(parseCourseId('daily-2026-11-07-std')!.date).toBe('2026-11-07');
    expect(parseCourseId('DAILY-2026-02-30-STD')).toBeNull();
    expect(parseCourseId('garbage')).toBeNull();
  });

  it('difficulty is part of the course identity and round-trips', () => {
    const h = makeCourse('daily', 'standard', { date: '2026-11-01', difficulty: 'hard' });
    expect(courseId(h)).toBe('DAILY-2026-11-01-STD-H');
    expect(parseCourseId('DAILY-2026-11-01-STD-H')!.difficulty).toBe('hard');
    expect(parseCourseId('CLASSIC-SPR-R')!.difficulty).toBe('relaxed');
    expect(parseCourseId('CLASSIC-SPR-X')).toBeNull();
    expect(courseId(makeCourse('classic', 'sprint'))).toBe('CLASSIC-SPR'); // normal adds no suffix
  });

  it('the whole course is exportable as a serialisable spec', () => {
    const spec = courseSpec(makeCourse('custom', 'endurance', { customText: 'YETI' }));
    const json = JSON.parse(JSON.stringify(spec));
    expect(json.id).toBe(spec.id);
    expect(json.finishZ).toBe(20000);
    expect(json.segments.length).toBeGreaterThan(10);
    expect(json.encounters.length).toBe(2);
    expect(json.refuges.length).toBe(1);
    expect(json.route.length).toBeGreaterThan(150);
    expect(JSON.stringify(courseSpec(makeCourse('custom', 'endurance', { customText: 'YETI' })))).toBe(JSON.stringify(spec));
  });

  it('custom seeds: numbers are used directly, words are hashed case-insensitively', () => {
    expect(customSeed('12345')).toBe(12345);
    expect(customSeed('powder')).toBe(customSeed('POWDER'));
    expect(customSeed('powder')).not.toBe(customSeed('powdery'));
  });

  it('different daily seeds produce meaningfully different geometry', () => {
    const a = buildMountain(makeCourse('daily', 'standard', { date: '2026-11-07' }));
    const b = buildMountain(makeCourse('daily', 'standard', { date: '2026-11-08' }));
    let diff = 0;
    for (let z = 500; z < 9500; z += 250) diff += Math.abs(a.centerX(z) - b.centerX(z)) + Math.abs(a.slopeDeg(z) - b.slopeDeg(z));
    expect(diff / 36).toBeGreaterThan(5);
    const segA = (a.profile as unknown as { segmentList: Array<{ type: string }> }).segmentList.map((s) => s.type).join();
    const segB = (b.profile as unknown as { segmentList: Array<{ type: string }> }).segmentList.map((s) => s.type).join();
    expect(segA).not.toBe(segB);
  });

  it('the same config always builds the same mountain', () => {
    const c = makeCourse('custom', 'endurance', { customText: 'YETI' });
    const a = buildMountain(c);
    const b = buildMountain(c);
    for (let i = 0; i < 80; i++) expect(a.heightAt(i * 7 - 200, i * 251)).toBe(b.heightAt(i * 7 - 200, i * 251));
  });

  it('settings persist course mode, length, seed text and past-day replay', () => {
    const kv = mem();
    const s = loadSettings(kv);
    expect(s.courseLength).toBe('standard'); // the default
    s.course = 'daily';
    s.courseLength = 'expedition';
    s.dailyDate = '2026-11-01';
    s.customSeed = 'AVALANCHE';
    saveSettings(s, kv);
    const t = loadSettings(kv);
    expect([t.course, t.courseLength, t.dailyDate, t.customSeed]).toEqual(['daily', 'expedition', '2026-11-01', 'AVALANCHE']);
    kv.setItem('skifree-tld.settings.v1', JSON.stringify({ course: 'mars', courseLength: 'forever', dailyDate: 42 }));
    const u = loadSettings(kv);
    expect([u.course, u.courseLength, u.dailyDate]).toEqual(['classic', 'standard', null]);
  });

  it('records are kept separately per course and migrated from the old single set', () => {
    const kv = mem();
    kv.setItem('skifree-tld.records.v1', JSON.stringify({ bestScore: 999, runs: 3, wins: 1, seenCaveCinematic: true }));
    const book = loadRecordBook(kv);
    expect(book.seenCaveCinematic).toBe(true);
    expect(recordsFor(book, 'CLASSIC-SPR').bestScore).toBe(999);
    expect(recordsFor(book, 'CLASSIC-STD').runs).toBe(0);
    const run: RunStats = { won: true, time: 300, distance: 10000, maxSpeed: 30, airtime: 3, longestAir: 1, crashes: 0, survival: 100, score: 50000 };
    book.courses['DAILY-2026-11-07-STD'] = applyRun(recordsFor(book, 'DAILY-2026-11-07-STD'), run).records;
    saveRecordBook(book, kv);
    const again = loadRecordBook(kv);
    expect(recordsFor(again, 'DAILY-2026-11-07-STD').bestScore).toBe(50000);
    expect(recordsFor(again, 'DAILY-2026-11-08-STD').bestScore).toBe(0);
    expect(recordsFor(again, 'CLASSIC-SPR').bestScore).toBe(999);
  });
});

describe('configurable course lengths', () => {
  it('Classic Sprint is the original hand-tuned course; other lengths are generated', () => {
    expect(buildMountain(makeCourse('classic', 'sprint')).profile.kind).toBe('classic');
    expect(buildMountain(makeCourse('classic', 'standard')).profile.kind).toBe('generated');
  });

  for (const l of ['sprint', 'standard', 'endurance', 'expedition'] as const) {
    it(`${l}: finish at ${LENGTH_INFO[l].metres} m, a valid descending route with a clear lane, the cave late`, () => {
      const L = LENGTH_INFO[l].metres;
      const m = Mountain.generated(4242, L);
      expect(m.finishZ).toBe(L);
      const enc = m.profile.encounters(-Infinity, Infinity);
      const main = enc.at(-1)!;
      // long courses add earlier skirmishes that end at refuges; the main one ends at the finish
      expect(enc.length).toBe(L >= 45000 ? 4 : L >= 18000 ? 2 : 1);
      expect(main.caveZ).toBe(Math.max(1350, L - chaseLength(L)));
      expect(main.chaseEndZ).toBe(L);
      expect(main.checkpointZ).toBeNull();
      for (const e of enc.slice(0, -1)) {
        expect(e.checkpointZ).toBe(e.chaseEndZ);
        expect(e.chaseEndZ).toBeLessThan(main.foreshadowZ);
      }
      // main confrontation in the final part of the course
      if (L >= 10000) expect(main.caveZ / L).toBeGreaterThan(0.6);
      // the route descends everywhere (small bumps allowed)
      let prev = m.heightAt(m.routeX(0), 0);
      let worst = 0;
      for (let z = 5; z <= L; z += 5) {
        const h = m.heightAt(m.routeX(z), z);
        worst = Math.max(worst, h - prev);
        prev = h;
      }
      expect(worst).toBeLessThan(2.5);
      // the guaranteed route stays inside the piste
      for (let z = 0; z <= L; z += 20) expect(Math.abs(m.routeX(z) - m.centerX(z))).toBeLessThan(m.halfWidth(z));
      // lane clear of solid obstacles (sampled windows for long courses)
      const f = new ObstacleField(m, 4242);
      const windows = L <= 10000 ? [[0, L]] : Array.from({ length: 8 }, (_, i) => [i * (L / 8), i * (L / 8) + 1200]);
      for (const [a, b] of windows) {
        expect(laneClearance(f, a!, b!)).toBeGreaterThan(4.5);
        f.release(Infinity, Infinity);
      }
      // the route enters the finish chute straight
      const fx = m.routeX(L);
      for (let z = L - 110; z <= L; z += 5) expect(Math.abs(m.routeX(z) - fx)).toBeLessThan(6);
      // segment variety
      const types = new Set((m.profile as unknown as { segmentList: Array<{ type: string }> }).segmentList.map((s) => s.type));
      expect(types.size).toBeGreaterThanOrEqual(L >= 10000 ? 6 : 3);
    });
  }
});

describe('alternate lines', () => {
  it('generated courses offer alternate lines: inside the piste, skiable, clear, and shorter than the route', () => {
    let total = 0;
    let shorter = 0;
    for (const seed of [4242, 7, 99, 2026]) {
      const m = Mountain.generated(seed, 20000);
      const alts = m.profile.altRoutes(0, 20000);
      total += alts.length;
      const f = new ObstacleField(m, seed);
      for (const a of alts) {
        let prevH = Infinity;
        let altLen = 0;
        let routeLen = 0;
        for (let z = a.z0; z <= a.z1; z += 5) {
          const x = m.profile.altRouteX(z)!;
          expect(x).not.toBeNull();
          expect(Math.abs(x - m.centerX(z))).toBeLessThan(m.halfWidth(z));
          const h = m.heightAt(x, z);
          if (prevH !== Infinity) expect(h - prevH, `seed ${seed} z ${z}`).toBeLessThan(2.5);
          prevH = h;
          if (z > a.z0) {
            altLen += Math.hypot(x - m.profile.altRouteX(z - 5)!, 5);
            routeLen += Math.hypot(m.routeX(z) - m.routeX(z - 5), 5);
          }
        }
        if (altLen < routeLen) shorter++;
        // a hard-packed, slightly sunken line: fast but low grip
        const zm = (a.z0 + a.z1) / 2;
        const xm = m.profile.altRouteX(zm)!;
        expect(m.surfaceAt(xm, zm)).toBe('ice');
        expect(m.heightAt(xm, zm)).toBeLessThan(m.heightAt(xm + 9, zm) + 0.2);
        // no solid obstacle in the alternate lane
        f.ensure(a.z0, a.z1);
        for (const o of f.inRange(a.z0, a.z1)) {
          if (!o.collidable || o.kind === 'log') continue;
          const x = m.profile.altRouteX(o.z);
          if (x !== null) expect(Math.abs(o.x - x) - o.r, `seed ${seed} obstacle at z ${o.z.toFixed(0)}`).toBeGreaterThan(4.5);
        }
        f.release(Infinity, Infinity);
      }
    }
    expect(total).toBeGreaterThanOrEqual(8);
    expect(shorter / total).toBeGreaterThan(0.8);
  });

  it('the hand-tuned classic course is unchanged (no alternate lines added)', () => {
    expect(new Mountain().profile.altRoutes(0, 3000)).toEqual([]);
  });
});

describe('long-course completion (headless, streaming obstacles)', () => {
  for (const [l, maxTime] of [
    ['sprint', 400],
    ['standard', 1100],
    ['endurance', 2100],
    ['expedition', 5000],
  ] as const) {
    it(`a skilled skier completes ${l} (${LENGTH_INFO[l].metres / 1000} km) and wins`, { timeout: 240_000 }, () => {
      const r = simulateGenerated(4242, LENGTH_INFO[l].metres, skilled, { maxTime });
      expect(r.outcome).toBe('victory');
      expect(r.distance).toBeGreaterThanOrEqual(LENGTH_INFO[l].metres);
      expect(r.chaseTime).toBeGreaterThan(30);
      // streaming keeps memory bounded however long the course is
      expect(r.peakBands).toBeLessThanOrEqual(6);
    });
  }

  it('difficulty matters: Relaxed is escapable for an intermediate skier, Hard is measurably tougher', { timeout: 240_000 }, () => {
    const inter = (m: Mountain) => (st: Parameters<typeof autopilotInput>[1], t: number) => autopilotInput(m, st, 'intermediate', t);
    const relaxed = simulateGenerated(4242, 10000, inter, { maxTime: 1100, yetiSpeed: 0.93 });
    const hard = simulateGenerated(4242, 10000, inter, { maxTime: 1100, yetiSpeed: 1.07 });
    expect(relaxed.outcome).toBe('victory');
    expect(hard.outcome === 'caught' || hard.finalGap < relaxed.finalGap - 10).toBe(true);
  });

  it('a careless skier is caught on a generated course (loss is possible)', { timeout: 120_000 }, () => {
    expect(simulateGenerated(4242, 10000, careless, { maxTime: 1100 }).outcome).toBe('caught');
  });
});

describe('endless', () => {
  it('generates segments, encounters and refuges without end, escalating', () => {
    const m = Mountain.generated(99, Infinity);
    expect(m.finishZ).toBe(Infinity);
    const enc = m.profile.encounters(0, 200_000);
    expect(enc.length).toBeGreaterThanOrEqual(20);
    enc.forEach((e, i) => {
      expect(e.caveZ).toBe(ENDLESS.firstCave + i * ENDLESS.cycle);
      expect(e.checkpointZ).toBe(e.chaseEndZ);
      if (i) expect(e.speedMul).toBeGreaterThanOrEqual(enc[i - 1]!.speedMul);
    });
    expect(enc.at(-1)!.speedMul).toBeLessThanOrEqual(1.3);
    expect(enc.at(-1)!.speedMul).toBeGreaterThan(1.25);
    expect(m.profile.checkpoints(0, 200_000).length).toBe(enc.length);
    // terrain stays finite and descending far down the mountain
    const h1 = m.heightAt(m.routeX(150_000), 150_000);
    const h2 = m.heightAt(m.routeX(150_500), 150_500);
    expect(Number.isFinite(h1)).toBe(true);
    expect(h2).toBeLessThan(h1);
  });

  it('a skilled skier crosses many segment boundaries and refuges; memory stays bounded', { timeout: 240_000 }, () => {
    const m = Mountain.generated(99, Infinity);
    const r = simulateGenerated(99, Infinity, skilled, { maxZ: 25_000, maxTime: 3000 });
    expect(r.outcome).toBe('distance');
    expect(r.distance).toBeGreaterThanOrEqual(25_000);
    expect(r.encountersSurvived).toBeGreaterThanOrEqual(2);
    expect(r.peakBands).toBeLessThanOrEqual(6);
    const segs = (m.profile as unknown as { segmentList: Array<{ z0: number }> }).segmentList.filter((s) => s.z0 < 25_000);
    expect(segs.length).toBeGreaterThan(10);
  });

  it('run state: refuges end a chase and the next encounter follows', () => {
    const m = Mountain.generated(99, Infinity);
    const r = new RunState({ tutorialEndZ: m.profile.tutorialEndZ, finishZ: m.finishZ, encounters: (a, b) => m.profile.encounters(a, b) });
    r.endIntro();
    const [e0, e1] = m.profile.encounters(0, 20000);
    expect(r.progress(e0!.triggerZ, 0.1)).toBe(true);
    expect(r.encounter!.index).toBe(0);
    r.endCaveCinematic();
    expect(r.reachCheckpoint(e0!.chaseEndZ - 1)).toBe(false);
    expect(r.reachCheckpoint(e0!.chaseEndZ)).toBe(true);
    expect(r.phase).toBe('free');
    expect(r.checkpointsReached).toBe(1);
    expect(r.reachFinish()).toBe(false);
    expect(r.progress(e0!.chaseEndZ + 50, 0.1)).toBe(false);
    expect(r.encounter!.index).toBe(1);
    expect(r.progress(e1!.foreshadowZ + 1, 0.1)).toBe(false);
    expect(r.phase).toBe('foreshadow');
    expect(r.progress(e1!.triggerZ, 0.1)).toBe(true);
    r.endCaveCinematic();
    expect(r.retire()).toBe(true);
    expect(r.outcome).toBe('retired');
    expect(r.catchPlayer()).toBe(false);
  });
});
