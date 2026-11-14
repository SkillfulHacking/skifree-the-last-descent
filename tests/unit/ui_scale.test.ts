import { describe, expect, it } from 'vitest';
import { autoUiScale } from '../../src/ui/scale';

describe('UI resolution scale (round-3 E #3)', () => {
  it('is 1 at 1080p and below, keeps 1080p proportions above, capped', () => {
    expect(autoUiScale(1920, 1080)).toBe(1);
    expect(autoUiScale(1366, 768)).toBe(1);
    expect(autoUiScale(1920, 900)).toBe(1);
    expect(autoUiScale(2560, 1440)).toBeCloseTo(4 / 3, 6);
    expect(autoUiScale(3440, 1440)).toBeCloseTo(4 / 3, 6); // ultrawide: height decides
    expect(autoUiScale(3840, 2160)).toBe(1.6);
  });
});
