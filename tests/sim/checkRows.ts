/**
 * Round 6 (SonarCloud, "add at least one assertion to this test case"): what every measurement runner
 * checks before it passes. A runner passes only when it produced the rows it was asked for, each row is a
 * finished simulation with a known outcome and finite numbers, and (for resumable runners) every
 * requested run is present in OUT. A crashed or truncated measurement fails instead of passing silently.
 */
import { expect } from 'vitest';

/** simulateCourse's outcomes, plus the tension runner's 'escaped' (out of its 1.5 km window uncaught) */
export const OUTCOMES = ['victory', 'caught', 'timeout', 'distance', 'escaped'] as const;

type Row = Record<string, unknown>;

/** each row: a known outcome (when it has one) and finite values for the listed numeric fields */
export function expectSimRows(rows: readonly Row[], numeric: readonly string[] = [], expected?: number): void {
  if (expected !== undefined) expect(rows.length, 'rows produced').toBe(expected);
  else expect(rows.length, 'rows produced').toBeGreaterThan(0);
  for (const [i, r] of rows.entries()) {
    if ('outcome' in r) expect(OUTCOMES, `row ${i} outcome`).toContain(r.outcome);
    for (const k of numeric) {
      const v = r[k];
      if (v === null) continue; // a value that does not apply to this row (e.g. no chase): recorded as null
      expect(typeof v === 'number' && Number.isFinite(v), `row ${i} ${k} = ${String(v)}`).toBe(true);
    }
  }
}

/** a resumable runner: every requested key is in OUT, and the rows there pass expectSimRows */
export function expectResumedRows(lines: string, keyOf: (r: Row) => string, wanted: readonly string[], numeric: readonly string[] = []): void {
  const rows = lines.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as Row);
  const have = new Set(rows.map(keyOf));
  const missing = wanted.filter((k) => !have.has(k));
  expect(missing, 'requested runs missing from OUT').toEqual([]);
  const mine = rows.filter((r) => wanted.includes(keyOf(r)));
  expectSimRows(mine, numeric, mine.length || undefined);
}
