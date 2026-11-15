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
  YETI.syncMargin = 1e9;
  try {
    return fn();
  } finally {
    YETI.syncMargin = m;
  }
};
const DAYS = ['2026-10-20', '2026-10-24', '2026-10-29', '2026-11-02', '2026-11-08', '2026-11-12'];

describe('Yeti escape after a slow start', () => {
  it('Alpine Normal, 2 m/s at the chase start, tucking: never caught in the first 20 s (was caught in ~6–10 s without the start sync on some seeds)', () => {
    let before = 0;
    for (const d of DAYS) {
      const r = runEscape(base(d, 'alpine', { startV: 2 }));
      expect(r.outcome === 'caught' && (r.captureT ?? 0) < 20, `${d} ${r.captureT}`).toBe(false);
      const o = withoutSync(() => runEscape(base(d, 'alpine', { startV: 2, driver: 'gravity' })));
      if (o.outcome === 'caught' && (o.captureT ?? 99) < 12) before++;
    }
    // the trap was real: without the sync an upright skier was caught within 12 s on most of these
    expect(before).toBeGreaterThanOrEqual(3);
  }, 600_000);

  it('a chase that starts at speed is unchanged by the start sync', () => {
    for (const [d, b] of [['2026-10-20', 'alpine'], ['2026-11-02', 'fjord'], ['2026-11-08', 'alpine']] as const) {
      const a = runEscape(base(d, b, { driver: 'skilled' }));
      const o = withoutSync(() => runEscape(base(d, b, { driver: 'skilled' })));
      expect(a.v0).toBeGreaterThan(10);
      expect(a.gaps).toEqual(o.gaps);
      expect(a.minGap).toBe(o.minGap);
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
