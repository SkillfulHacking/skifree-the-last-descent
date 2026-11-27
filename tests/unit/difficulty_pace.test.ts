/**
 * Round 5 (W-094 / W-095): each location's Yeti pace per difficulty is its own and fixed for the run —
 * Alpine's Hard-only pace is not inherited by locations derived from Alpine, Whiteout's Normal pace is
 * Normal's alone, and nothing here depends on how the player is skiing.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { DIFFICULTY, yetiSpeedFor } from '../../src/game/CourseConfig';

describe('per-location difficulty pace', () => {
  it('Alpine: Hard only', () => {
    expect(yetiSpeedFor('normal', 'alpine')).toBe(DIFFICULTY.normal.yetiSpeed);
    expect(yetiSpeedFor('relaxed', 'alpine')).toBe(DIFFICULTY.relaxed.yetiSpeed);
    expect(yetiSpeedFor('hard', 'alpine')).toBeCloseTo(DIFFICULTY.hard.yetiSpeed * 1.135, 9);
  });
  it('Fjord does not inherit Alpine’s Hard pace', () => {
    for (const d of ['relaxed', 'normal', 'hard'] as const) expect(yetiSpeedFor(d, 'fjord')).toBe(DIFFICULTY[d].yetiSpeed);
  });
  it('Whiteout: Normal only (Hard is the storm, not the Yeti)', () => {
    expect(yetiSpeedFor('normal', 'whiteout')).toBeCloseTo(1.06, 9);
    expect(yetiSpeedFor('hard', 'whiteout')).toBe(DIFFICULTY.hard.yetiSpeed);
    expect(yetiSpeedFor('relaxed', 'whiteout')).toBe(DIFFICULTY.relaxed.yetiSpeed);
  });
  it('stays under the documented ceiling (+33 % over the classic Yeti) with every encounter pace', () => {
    for (const b of ['alpine', 'fjord', 'whiteout'] as const) for (const d of ['relaxed', 'normal', 'hard'] as const) expect(yetiSpeedFor(d, b) * 1.05).toBeLessThan(1.33);
  });
});
