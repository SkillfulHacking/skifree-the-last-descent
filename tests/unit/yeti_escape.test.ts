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

  it('a fall after a slow start is not certain capture, and never cheaper than the same fall in a chase skied in (no reason to enter slowly)', () => {
    // (review r3: a hard 11 m/s threshold made entering just slower than that a free fall insurance)
    let slowCaught = 0;
    let fastCaught = 0;
    let n = 0;
    let under = 0;
    let over = 0;
    const gapDiff: number[] = [];
    for (const d of DAYS.slice(0, 4))
      for (const crashAt of [2, 5]) {
        n++;
        if (runEscape(base(d, 'alpine', { startV: 0, crashAt })).outcome === 'caught') slowCaught++;
        if (runEscape(base(d, 'alpine', { crashAt })).outcome === 'caught') fastCaught++;
        // continuous in the start speed: just under and just over 11 m/s are the same chase, near enough
        // (single chases are chaotic — a few cm/s at the start can flip one — so in aggregate)
        const a = runEscape(base(d, 'alpine', { startV: 10.9, crashAt }));
        const b = runEscape(base(d, 'alpine', { startV: 11.1, crashAt }));
        under += +(a.outcome === 'caught');
        over += +(b.outcome === 'caught');
        gapDiff.push(Math.abs((a.gaps[1] ?? 0) - (b.gaps[1] ?? 0)));
      }
    expect(Math.abs(under - over), `caught: 10.9 m/s ${under}, 11.1 m/s ${over}`).toBeLessThanOrEqual(1);
    expect(Math.max(...gapDiff)).toBeLessThan(3);
    expect(slowCaught).toBeLessThan(n);
    expect(slowCaught).toBeGreaterThanOrEqual(fastCaught);
  }, 900_000);

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
