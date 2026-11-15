/**
 * Pass 6: Yeti escape fairness after a cave (tests/sim/escape.ts; full sweep in
 * docs/reviews/pass6/ESCAPE_ANALYSIS.md).
 *  - A skier who comes into the cave slowly (2 m/s at the chase start) and simply tucks is not
 *    caught in the first seconds on Normal: the Yeti's own pace comes up with the skier's.
 *  - Chases that start at speed are exactly as before (the start cap never binds).
 *  - Pole pushing helps (a larger gap early) without making the chase easier for a fast skier.
 */
import { describe, expect, it } from 'vitest';
import { runEscape, type EscapeCase } from '../sim/escape';
import { YETI } from '../../src/yeti/YetiAI';

const base = (key: string, biome: string, extra: Partial<EscapeCase> = {}): EscapeCase => ({ mode: 'daily', len: 'sprint', key, biome, diff: 'normal', driver: 'straight', ...extra });
const withoutSync = <T>(fn: () => T): T => {
  const m = YETI.syncMargin;
  const d = YETI.slowDelay;
  YETI.syncMargin = 1e9;
  YETI.slowDelay = 0;
  try {
    return fn();
  } finally {
    YETI.syncMargin = m;
    YETI.slowDelay = d;
  }
};
const DAYS = ['2026-10-20', '2026-10-24', '2026-10-29', '2026-11-02', '2026-11-08', '2026-11-12'];

describe('Yeti escape after a slow start', () => {
  it('starting slower is never better: the gap 10 s in grows with the start speed (within 2 m seed by seed: terrain and lunges add noise) and stays below a chase begun at speed', () => {
    for (const d of DAYS.slice(0, 4))
      for (const b of ['alpine', 'fjord']) {
        const g = [0, 4, 8].map((v) => runEscape(base(d, b, { startV: v })).gaps[2] ?? 0);
        const fast = runEscape(base(d, b)).gaps[2] ?? 0;
        expect(g[1]!, `${d} ${b} ${g}`).toBeGreaterThanOrEqual(g[0]! - 2);
        expect(g[2]!, `${d} ${b} ${g}`).toBeGreaterThanOrEqual(g[1]! - 2);
        expect(fast).toBeGreaterThan(g[2]!);
      }
  }, 900_000);

  it('falls across the whole band: stopping before the cave does not pay (reviews r3–r5)', () => {
    // fall times from 0.5 s (inside the roar) to 12 s × start speeds 0–11.1 m/s; single chases are
    // chaotic, so in aggregate. ESCAPE_ANALYSIS round 6: the only edge left for a standstill is a fall
    // within ~1 s of the start (the lower pace cap), and over all fall times it is caught at least as
    // often as a start at 7–11 m/s.
    const speeds = [0, 4, 7, 10.9, 11.1];
    const falls = [0.5, 1, 3, 6, 12];
    const caught = speeds.map(() => falls.map(() => 0));
    const gap5: number[][] = speeds.map(() => []);
    for (const d of DAYS.slice(0, 3))
      for (const b of ['alpine', 'fjord'])
        falls.forEach((crashAt, j) =>
          speeds.forEach((v, i) => {
            const r = runEscape(base(d, b, { startV: v, crashAt }));
            caught[i]![j]! += +(r.outcome === 'caught');
            gap5[i]!.push(r.gaps[1] ?? 0);
          }),
        );
    const total = caught.map((row) => row.reduce((a, c) => a + c, 0));
    const msg = `caught per speed ${speeds.join('/')} × falls ${falls.join('/')}: ${JSON.stringify(caught)}`;
    // over all fall times a standstill is caught at least as often as a start at 7 m/s or more
    for (let i = 2; i < speeds.length; i++) expect(total[0]!, msg).toBeGreaterThanOrEqual(total[i]!);
    // from 3 s on, a standstill is never better than any faster start (one chase of slack for chaos)
    for (let j = 2; j < falls.length; j++) for (let i = 1; i < speeds.length; i++) expect(caught[0]![j]!, msg).toBeGreaterThanOrEqual(caught[i]![j]! - 1);
    // no step at 11 m/s
    expect(Math.abs(total[3]! - total[4]!)).toBeLessThanOrEqual(2);
    for (let k = 0; k < gap5[3]!.length; k++) expect(Math.abs(gap5[3]![k]! - gap5[4]![k]!)).toBeLessThan(3);
  }, 1_800_000);

  it('Alpine Normal, a standstill at the chase start, tucking: escapes (without the slow-start rules an upright skier was caught in ~6–10 s)', () => {
    let before = 0;
    for (const d of DAYS) {
      const r = runEscape(base(d, 'alpine', { startV: 0 }));
      expect(r.outcome, `${d} ${r.captureT}`).not.toBe('caught');
      const o = withoutSync(() => runEscape(base(d, 'alpine', { startV: 2, driver: 'gravity' })));
      if (o.outcome === 'caught' && (o.captureT ?? 99) < 12) before++;
    }
    // the trap was real: without the sync an upright skier was caught within 12 s on most of these
    expect(before).toBeGreaterThanOrEqual(3);
  }, 600_000);

  it('a chase that starts at speed is unchanged by the slow-start rules, with or without an early fall', () => {
    // (review r2: an early fall used to restart the cap in fast chases too, making the fall nearly free)
    for (const [d, b, crashAt] of [['2026-10-20', 'alpine', undefined], ['2026-11-02', 'fjord', undefined], ['2026-11-08', 'alpine', 3], ['2026-11-02', 'fjord', 2], ['2026-10-24', 'fjord', 9]] as const) {
      const c = base(d, b, { driver: 'skilled', ...(crashAt !== undefined ? { crashAt } : {}) });
      const a = runEscape(c);
      const o = withoutSync(() => runEscape(c));
      expect(a.v0).toBeGreaterThan(YETI.syncSlow);
      expect(a.gaps).toEqual(o.gaps);
      expect(a.minGap).toBe(o.minGap);
      expect(a.outcome).toBe(o.outcome);
    }
  }, 600_000);

  it('poles help after a slow start (bigger gap at 5 s) but do not change a chase skied at speed', () => {
    let better = 0;
    for (const d of DAYS.slice(0, 4)) {
      const t = runEscape(base(d, 'alpine', { startV: 2 }));
      const p = runEscape(base(d, 'alpine', { startV: 2, driver: 'poles' }));
      if ((p.gaps[1] ?? 0) > (t.gaps[1] ?? 0) + 2) better++;
      // at speed the poles do nothing (above 40 km/h the driver tucks; above 55 the poles give nothing)
      const fs = runEscape(base(d, 'alpine', { driver: 'straight' }));
      const fp = runEscape(base(d, 'alpine', { driver: 'poles' }));
      expect(Math.abs((fp.gaps[3] ?? 0) - (fs.gaps[3] ?? 0))).toBeLessThan(8);
    }
    expect(better).toBeGreaterThanOrEqual(3);
  }, 600_000);
});
