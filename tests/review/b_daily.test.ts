import { describe, expect, it } from 'vitest';
import { addDays, buildMountain, courseId, courseLabel, customSeed, dailySeed, makeCourse, msUntilRollover, parseCourseId, utcDate } from '../../src/game/CourseConfig';
import { applyRun, loadRecordBook, loadSettings, recordsFor, type KV } from '../../src/core/settings';
const mem = (init: Record<string, string> = {}): KV => { const d = new Map(Object.entries(init)); return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v) }; };
describe('B daily/custom/records', () => {
  it('rollover boundary', () => {
    const t = Date.UTC(2026, 11, 31, 23, 59, 59, 999);
    expect(utcDate(t)).toBe('2026-12-31');
    expect(utcDate(t + 1)).toBe('2027-01-01');
    expect(msUntilRollover(t)).toBe(1);
    expect(msUntilRollover(t + 1)).toBe(86400000);
    const a = makeCourse('daily', 'standard', { now: t }), b = makeCourse('daily', 'standard', { now: t + 1 });
    expect(a.seed).not.toBe(b.seed);
    expect(courseLabel(a)).toContain('2026-12-31 (UTC)');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });
  it('codes', () => {
    const c = makeCourse('daily', 'endless', { date: '2026-10-01' });
    expect(courseId(c)).toBe('DAILY-2026-10-01-INF');
    expect(parseCourseId('daily-2026-10-01-inf')).toEqual(c);
    expect(parseCourseId('DAILY-2026-02-30-STD')).toBeNull();
    const w = makeCourse('custom', 'sprint', { customText: 'Yeti Party' });
    const back = parseCourseId(courseId(w))!;
    expect(back.seed).toBe(w.seed);
    console.log('custom label after code round trip:', courseLabel(w), '->', courseLabel(back));
    console.log('seed collisions: "0" vs "4294967296":', customSeed('0'), customSeed('4294967296'));
    console.log('future daily accepted by makeCourse:', courseId(makeCourse('daily', 'standard', { date: '2099-01-01' })));
    // classic sprint vs generated classic lengths share the classic seed
    expect(buildMountain(makeCourse('classic', 'standard')).seed).toBe(buildMountain(makeCourse('classic', 'sprint')).seed);
    // daily seeds differ day-to-day
    const s = new Set(Array.from({ length: 400 }, (_, i) => dailySeed(addDays('2026-01-01', i))));
    expect(s.size).toBe(400);
  });
  it('records: corrupt values, v1 migration, separation', () => {
    const kv = mem({ 'skifree-tld.records.v2': JSON.stringify({ seenCaveCinematic: true, courses: { 'CLASSIC-STD': { bestTime: 'abc', bestScore: '9999999', runs: 'x' } } }) });
    const book = loadRecordBook(kv);
    const r = recordsFor(book, 'CLASSIC-STD');
    const out = applyRun(r, { won: true, time: 100, distance: 10000, maxSpeed: 30, airtime: 1, longestAir: 1, crashes: 0, survival: 50, score: 50000 });
    console.log('corrupt record merge result:', JSON.stringify(out.records), 'newBest', out.newBest);
    const v1 = mem({ 'skifree-tld.records.v1': JSON.stringify({ bestTime: 200, bestScore: 1234, runs: 3, wins: 1, seenCaveCinematic: true }) });
    const b1 = loadRecordBook(v1);
    expect(b1.courses['CLASSIC-SPR']!.bestScore).toBe(1234);
    expect(recordsFor(b1, 'CLASSIC-STD').runs).toBe(0);
    const garbage = loadRecordBook(mem({ 'skifree-tld.records.v2': '{not json' }));
    expect(garbage.courses).toEqual({});
    const s = loadSettings(mem({ 'skifree-tld.settings.v1': JSON.stringify({ course: 'daily', courseLength: 'galactic', dailyDate: '2026-99-99', customSeed: 42 }) }));
    console.log('sanitized settings', s.course, s.courseLength, s.dailyDate, s.customSeed);
  });
});
