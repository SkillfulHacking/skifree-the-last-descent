/**
 * Round 5, W-082 (review F4-2: the Yeti ~15 px at 28 m, 3–4 px at 75 m in the rear-view inset): the
 * inset's telephoto lens keeps a 2.6 m Yeti readable — at least 40 px tall in the 1366×768 inset (171 px)
 * anywhere within 60 m, and never framed wider than the old 48°.
 */
import { describe, expect, it } from 'vitest';

// App.ts pulls the whole game; the pure lens function is all this test needs
const { rearInsetFov } = await import('../../src/game/App');

const px = (d: number, insetH = 171) => (2.6 / (2 * d * Math.tan((rearInsetFov(d) * Math.PI) / 360))) * insetH;

describe('rear-view inset lens', () => {
  it('the Yeti is at least 40 px tall within 60 m', () => {
    for (let d = 8; d <= 60; d += 4) expect(px(d), `${d} m`).toBeGreaterThanOrEqual(40);
  });
  it('within 48° and no tighter than 9°', () => {
    for (let d = 1; d <= 200; d += 7) {
      expect(rearInsetFov(d)).toBeLessThanOrEqual(48);
      expect(rearInsetFov(d)).toBeGreaterThanOrEqual(9);
    }
  });
});
