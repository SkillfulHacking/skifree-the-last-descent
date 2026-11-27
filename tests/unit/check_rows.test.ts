// Round 6 (SonarCloud blockers): the measurement runners' assertions catch a broken or partial measurement.
import { describe, expect, it } from 'vitest';
import { expectResumedRows, expectSimRows } from '../sim/checkRows';

describe('measurement row checks', () => {
  it('pass finished rows', () => {
    expect(() => expectSimRows([{ outcome: 'victory', time: 12.5, minGap: null }], ['time', 'minGap'], 1)).not.toThrow();
  });
  it('fail on no rows, an unknown outcome, a non-finite value or a wrong count', () => {
    expect(() => expectSimRows([])).toThrow();
    expect(() => expectSimRows([{ outcome: 'exploded' }])).toThrow();
    expect(() => expectSimRows([{ outcome: 'caught', time: Number.NaN }], ['time'])).toThrow();
    expect(() => expectSimRows([{ outcome: 'caught' }], [], 2)).toThrow();
  });
  it('a resumable runner fails when a requested run is missing from OUT', () => {
    const lines = [{ k: 'a', outcome: 'victory' }, { k: 'b', outcome: 'caught' }].map((r) => JSON.stringify(r)).join('\n');
    const key = (r: Record<string, unknown>) => String(r.k);
    expect(() => expectResumedRows(lines, key, ['a', 'b'])).not.toThrow();
    expect(() => expectResumedRows(lines, key, ['a', 'b', 'c'])).toThrow(/missing/);
  });
});
