/**
 * W-076 decision 3: the Yeti's presence cues are presentation only and fire when they should.
 */
import { describe, expect, it } from 'vitest';
import { ChasePresence, PRESENCE } from '../../src/yeti/presence';

const DT = 1 / 60;
function run(gapAt: (t: number) => number, seconds: number, seed = 1) {
  const p = new ChasePresence(seed);
  const calls: number[] = [];
  const closing: number[] = [];
  for (let i = 0; i * DT < seconds; i++) {
    const t = i * DT;
    const c = p.update(DT, gapAt(t));
    if (c.call) calls.push(+t.toFixed(2));
    if (c.closing) closing.push(t);
  }
  return { calls, closing };
}

describe('chase presence cues', () => {
  it('out of sight, he calls every 9–14 s, never before 6 s', () => {
    const { calls } = run(() => 200, 60);
    expect(calls[0]).toBeGreaterThanOrEqual(PRESENCE.callFirst - DT);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]! - calls[i - 1]!).toBeGreaterThanOrEqual(9 - 1e-6);
      expect(calls[i]! - calls[i - 1]!).toBeLessThanOrEqual(14 + DT);
    }
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it('in sight, no calls; leaving sight, the first call comes ≥ 9 s later', () => {
    const { calls } = run((t) => (t < 20 ? 60 : 150), 40);
    expect(calls.every((c) => c >= 29 - 1e-6)).toBe(true);
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('deterministic: the same seed gives the same calls', () => {
    expect(run(() => 200, 60, 7).calls).toEqual(run(() => 200, 60, 7).calls);
  });

  it('closing: shown while the gap shrinks faster than 1.5 m/s within 90 m, held ≥ 1 s', () => {
    // steady at 50 m, then losing 3 m/s for 5 s, then steady again
    const gap = (t: number) => (t < 5 ? 50 : t < 10 ? 50 - 3 * (t - 5) : 35);
    const { closing } = run(gap, 15);
    expect(closing.length).toBeGreaterThan(0);
    expect(Math.min(...closing)).toBeGreaterThan(5.5);
    expect(Math.min(...closing)).toBeLessThan(7.5);
    expect(Math.max(...closing)).toBeGreaterThan(10);
    expect(Math.max(...closing)).toBeLessThan(12.5);
  });

  it('not closing: a steady or growing gap, slow loss, or loss far away', () => {
    expect(run(() => 40, 10).closing).toEqual([]);
    expect(run((t) => 40 + t, 10).closing).toEqual([]);
    expect(run((t) => 60 - 1.0 * t, 10).closing).toEqual([]);
    expect(run((t) => 200 - 5 * t, 10).closing).toEqual([]);
  });
});
