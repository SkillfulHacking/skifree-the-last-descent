/**
 * W-056 (the default Whiteout course was lost by every tested policy): two general placement rules,
 * checked on the Classic courses, Dailies and held-out Custom seeds —
 * - no blizzard cell's knock zone reaches a drift row's way through (its flagged gap, the approach
 *   and the rejoin, and the strip between the line and the gap);
 * - every chase opens on a fair stretch (CHASE_OPENING m past the cave trigger): no cell's knock zone
 *   reaches it, and a drift row there leaves its gap on the racing line.
 * Before the rules, 123 of 145 cells on these courses sat over a row's way through
 * (balance/w056/README.md); this test fails on that code.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed, type LengthMode } from '../../src/game/CourseConfig';
import { generateHazardBand } from '../../src/world/hazards/field';
import { capabilitiesOf } from '../../src/world/capabilities/index';
import { getHazardKind } from '../../src/world/hazards/hazard';
import { BAND } from '../../src/physics/obstacles';
import { BLIZZARD_KNOCK_R, CHASE_OPENING, blizzardOverRow, inChaseOpening, type DriftParams } from '../../src/world/biomes/whiteout/hazards';

function hazards(course: ReturnType<typeof makeCourse>) {
  const m = buildMountain(course);
  const seed = worldSeed(course);
  const caps = capabilitiesOf(m.biome);
  const kinds = caps.hazards.kinds.map(getHazardKind);
  const all = [];
  const end = Number.isFinite(m.finishZ) ? m.finishZ + 300 : 12000;
  for (let b = 0; b * BAND < end; b++) all.push(...generateHazardBand(m, seed, kinds, caps.hazards.density, b));
  return { m, cells: all.filter((h) => h.kind === 'blizzard'), rows: all.filter((h) => h.kind === 'wind-drift' && (h.params as DriftParams).lead) };
}

const COURSES: Array<[string, ReturnType<typeof makeCourse>]> = [];
for (const len of ['sprint', 'standard'] as LengthMode[]) {
  for (const d of ['normal', 'hard'] as const) COURSES.push([`Classic ${len} ${d}`, makeCourse('classic', len, { biome: 'whiteout', difficulty: d })]);
  for (const date of ['2026-11-01', '2026-11-04', '2026-11-07']) COURSES.push([`Daily ${date} ${len}`, makeCourse('daily', len, { biome: 'whiteout', date, difficulty: 'normal' })]);
  for (let i = 1; i <= 6; i++) COURSES.push([`W3H-0${i} ${len}`, makeCourse('custom', len, { biome: 'whiteout', customText: `W3H-0${i}`, difficulty: 'normal' })]);
}
COURSES.push(['Classic endurance normal', makeCourse('classic', 'endurance', { biome: 'whiteout', difficulty: 'normal' })]);

describe('W-056: fair weather placement', () => {
  it('the knock radius follows the cell constants', () => {
    expect(BLIZZARD_KNOCK_R).toBeGreaterThan(40);
    expect(BLIZZARD_KNOCK_R).toBeLessThan(60);
  });
  for (const [name, course] of COURSES)
    it(`${name}: no cell over a row's way through; chase openings are fair`, () => {
      const { m, cells, rows } = hazards(course);
      for (const c of cells) {
        for (const r of rows) expect(blizzardOverRow(c.x, c.z, r.params as DriftParams), `cell at ${c.z.toFixed(0)} over the row at ${(r.params as DriftParams).rowZ!.toFixed(0)}`).toBe(false);
        expect(inChaseOpening(m, c.z - BLIZZARD_KNOCK_R, c.z + BLIZZARD_KNOCK_R), `cell at ${c.z.toFixed(0)} reaches a chase opening`).toBe(false);
      }
      for (const r of rows) {
        const p = r.params as DriftParams;
        if (inChaseOpening(m, p.rowZ! - 60, p.rowZ! + 35)) expect(p.gapX, `row at ${p.rowZ!.toFixed(0)} in a chase opening`).toBe(p.lineX);
      }
      // the weather is still there: cells and rows on every course
      expect(rows.length).toBeGreaterThan(0);
      if (Number.isFinite(m.finishZ) && m.finishZ > 2500) expect(cells.length).toBeGreaterThan(0);
      expect(CHASE_OPENING).toBe(320);
    });
});
