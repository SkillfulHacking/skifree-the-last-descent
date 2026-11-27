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

describe('W-103: Reduce Camera Motion holds the inset lens', () => {
  it('holds a fixed lens while the wanted one drifts, and cuts only on a large change', async () => {
    const { heldInsetFov, HELD_INSET_FOVS } = await import('../../src/game/App');
    let held = 48;
    const seen = new Set<number>();
    let changes = 0;
    // the Yeti closing from 120 m to 15 m: the continuous lens narrows smoothly; the held one steps
    for (let d = 120; d >= 15; d -= 0.5) {
      const want = Math.min(48, (2 * Math.atan(2.6 / (0.32 * 2 * d)) * 180) / Math.PI);
      const f = heldInsetFov(held, Math.max(9, want));
      if (f !== held) changes++;
      held = f;
      seen.add(f);
    }
    for (const f of seen) expect(HELD_INSET_FOVS).toContain(f);
    expect(changes).toBeLessThanOrEqual(4);
  });
});
