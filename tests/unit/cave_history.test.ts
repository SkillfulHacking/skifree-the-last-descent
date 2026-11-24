// Round 4, owner's decision B: each location keeps its own cave-cinematic history (RecordBook.seenCave),
// with a backward-compatible, idempotent migration of the old global flag that keeps every record and
// every field it does not know.
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { caveSeen, loadRecordBook, markCaveSeen, migrateCaveHistory, saveRecordBook, cleanRecords, type RecordBook } from '../../src/core/settings';

type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const mem = (init: Record<string, string> = {}): KV & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const V2 = 'skifree-tld.records.v2';
const V1 = 'skifree-tld.records.v1';
const rec = (runs: number, extra: Record<string, unknown> = {}) => ({ bestTime: 120.5, bestScore: 4321, bestDistance: 3000, bestSurvival: 90, runs, wins: 1, seenCaveCinematic: true, ...extra });

describe('per-location cave-cinematic history', () => {
  it('a new player has seen no location; seeing one never marks another', () => {
    const b = loadRecordBook(mem());
    for (const l of ['alpine', 'fjord', 'whiteout'] as const) expect(caveSeen(b, l)).toBe(false);
    markCaveSeen(b, 'fjord');
    expect(caveSeen(b, 'fjord')).toBe(true);
    expect(caveSeen(b, 'alpine')).toBe(false);
    expect(caveSeen(b, 'whiteout')).toBe(false);
  });

  it('the history survives a reload; marking is per location', () => {
    const kv = mem();
    const b = loadRecordBook(kv);
    markCaveSeen(b, 'alpine');
    saveRecordBook(b, kv);
    const b2 = loadRecordBook(kv);
    expect(caveSeen(b2, 'alpine')).toBe(true);
    expect(caveSeen(b2, 'whiteout')).toBe(false);
    markCaveSeen(b2, 'whiteout');
    saveRecordBook(b2, kv);
    const b3 = loadRecordBook(kv);
    expect([caveSeen(b3, 'alpine'), caveSeen(b3, 'fjord'), caveSeen(b3, 'whiteout')]).toEqual([true, false, true]);
  });
});

describe('migration of the old global flag', () => {
  it('a player who watched Alpine and never visited Fjord or Whiteout: Alpine seen, the others not', () => {
    const kv = mem({ [V2]: JSON.stringify({ seenCaveCinematic: true, courses: { 'CLASSIC-STD': rec(5), 'CLASSIC-SPR-H': rec(2) } }) });
    const b = loadRecordBook(kv);
    expect([caveSeen(b, 'alpine'), caveSeen(b, 'fjord'), caveSeen(b, 'whiteout')]).toEqual([true, false, false]);
    // every record kept as it was
    expect(b.courses['CLASSIC-STD']).toEqual(cleanRecords(rec(5)));
    expect(b.courses['CLASSIC-SPR-H']).toEqual(cleanRecords(rec(2)));
  });

  it('Whiteout is never inferred from the old flag, even when it is the only location played', () => {
    expect(migrateCaveHistory(true, { 'CLASSIC-SPR@WHITE': cleanRecords(rec(3)) }, { WHITE: 'whiteout', FJORD: 'fjord' })).toEqual({});
    const b = loadRecordBook(mem({ [V2]: JSON.stringify({ seenCaveCinematic: true, courses: { 'CLASSIC-SPR@WHITE': rec(3), 'CLASSIC-STD': rec(1) } }) }));
    expect(caveSeen(b, 'whiteout')).toBe(false);
    expect(caveSeen(b, 'alpine')).toBe(true);
  });

  it('the flag can only have come from Fjord when Fjord is the only location with runs', () => {
    const b = loadRecordBook(mem({ [V2]: JSON.stringify({ seenCaveCinematic: true, courses: { 'CLASSIC-SPR@FJORD': rec(4), 'DAILY-2026-10-01-STD@FJORD': rec(1) } }) }));
    expect([caveSeen(b, 'alpine'), caveSeen(b, 'fjord'), caveSeen(b, 'whiteout')]).toEqual([false, true, false]);
  });

  it('without the old flag nothing is marked, whatever was played', () => {
    const b = loadRecordBook(mem({ [V2]: JSON.stringify({ seenCaveCinematic: false, courses: { 'CLASSIC-STD': rec(9), 'CLASSIC-SPR@FJORD': rec(2) } }) }));
    expect(b.seenCave).toEqual({});
  });

  it('v1 records (before courses) migrate to CLASSIC-SPR, Alpine seen', () => {
    const b = loadRecordBook(mem({ [V1]: JSON.stringify({ bestScore: 999, runs: 3, wins: 1, seenCaveCinematic: true }) }));
    expect(b.courses['CLASSIC-SPR']!.bestScore).toBe(999);
    expect(caveSeen(b, 'alpine')).toBe(true);
    expect(caveSeen(b, 'whiteout')).toBe(false);
  });

  it('is idempotent: a migrated book is never migrated again (a later Whiteout viewing stays, nothing is re-inferred)', () => {
    const kv = mem({ [V2]: JSON.stringify({ seenCaveCinematic: true, courses: { 'CLASSIC-STD': rec(5) } }) });
    const b = loadRecordBook(kv);
    saveRecordBook(b, kv);
    const once = kv.data[V2];
    saveRecordBook(loadRecordBook(kv), kv);
    expect(kv.data[V2]).toBe(once);
    // the player then clears nothing but watches Whiteout: kept; Fjord still not inferred
    const b2 = loadRecordBook(kv);
    markCaveSeen(b2, 'whiteout');
    saveRecordBook(b2, kv);
    const b3 = loadRecordBook(kv);
    expect(b3.seenCave).toEqual({ alpine: true, whiteout: true });
  });

  it('keeps every field it does not know (top level and per course), and never overwrites records with defaults', () => {
    const stored = { seenCaveCinematic: true, futureFlag: { a: 1 }, courses: { 'CLASSIC-STD': rec(5, { ghostLap: [1, 2, 3] }), 'SEED-7-SPR@FJORD': rec(2) } };
    const kv = mem({ [V2]: JSON.stringify(stored) });
    const b: RecordBook = loadRecordBook(kv);
    b.courses['SEED-7-SPR@FJORD'] = { ...b.courses['SEED-7-SPR@FJORD']!, runs: 3 };
    saveRecordBook(b, kv);
    const out = JSON.parse(kv.data[V2]!);
    expect(out.futureFlag).toEqual({ a: 1 });
    expect(out.courses['CLASSIC-STD'].ghostLap).toEqual([1, 2, 3]);
    expect(out.courses['CLASSIC-STD'].bestScore).toBe(4321);
    expect(out.courses['CLASSIC-STD'].bestTime).toBe(120.5);
    expect(out.courses['SEED-7-SPR@FJORD'].runs).toBe(3);
    expect(out.seenCaveCinematic).toBe(true);
    expect(out.seenCave).toEqual({ alpine: true });
  });
});
