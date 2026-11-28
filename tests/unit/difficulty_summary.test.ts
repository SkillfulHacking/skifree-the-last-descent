// Round 6 (owner ruling 1): the difficulty selector says what each setting changes on the chosen location,
// derived from the live configuration (no claim of a faster Yeti where the pace is about the same).
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { difficultySummary, yetiSpeedFor } from '../../src/game/CourseConfig';

describe('difficulty summaries', () => {
  it('name a faster Yeti only where the pace differs by 3 % or more', () => {
    for (const b of ['alpine', 'fjord', 'whiteout'] as const)
      for (const d of ['relaxed', 'hard'] as const) {
        const s = difficultySummary(d, b);
        const pace = yetiSpeedFor(d, b) / yetiSpeedFor('normal', b);
        if (Math.abs(pace - 1) < 0.03) expect(s, `${b} ${d}`).toMatch(/about Normal pace/);
        else expect(s, `${b} ${d}`).toMatch(pace > 1 ? /faster Yeti/ : /slower Yeti/);
      }
  });
  it('Hard on Whiteout names the stronger, building storm and the snowballs', () => {
    const s = difficultySummary('hard', 'whiteout');
    expect(s).toMatch(/stronger hazards/);
    expect(s).toMatch(/storms build over long courses/);
    expect(s).toMatch(/snowballs/);
  });
});
