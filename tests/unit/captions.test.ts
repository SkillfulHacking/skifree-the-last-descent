/**
 * W-046 / W-047 (round-1 E1, E2, B F3): storm warnings are never lost behind the Yeti's cues or a
 * report, wait in a deterministic queue, go stale when no longer useful, and stay up long enough to
 * read.
 */
import '../support/fakeDom';
import { describe, expect, it } from 'vitest';
import { Hud } from '../../src/ui/Hud';

const hud = () => {
  const h = new Hud(document.createElement('div') as unknown as HTMLElement, {} as never);
  return h;
};
const step = (h: Hud, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) h.tickCaptions(0.1);
};

describe('captions (round 2)', () => {
  it('a Yeti cue and a location warning show together; the warning is not dropped', () => {
    const h = hud();
    h.caption('[heavy footsteps behind you]', 1.2);
    expect(h.caption('[a blizzard builds ahead — stand up out of the tuck; it pushes you left]', 2.8, { soft: true, priority: 2 })).toBe(true);
    expect(h.captionText).toContain('heavy footsteps');
    expect(h.captionText).toContain('blizzard');
  });

  it('footsteps re-sent every frame extend the line instead of replacing it', () => {
    const h = hud();
    for (let i = 0; i < 30; i++) {
      h.caption('[heavy footsteps behind you]', 1.2);
      h.tickCaptions(1 / 60);
    }
    expect(h.captionText).toBe('[heavy footsteps behind you]');
  });

  it('a warning that cannot show waits, then shows when the line frees — highest priority first, oldest first', () => {
    const h = hud();
    h.caption('[a storm front rolls in — the wind pushes you left; ski the flagged gaps in the drifts]', 3.2, { soft: true, priority: 2 });
    h.caption('[a blizzard is blowing across the piste ahead — stand up out of the tuck; it pushes you right]', 2.8, { soft: true, priority: 2, ttl: 30 });
    h.caption('[skis plough into a deep drift]', 1.4, { soft: true, priority: 1 }); // a report: dropped, not queued
    expect(h.captionQueue).toEqual(['[a blizzard is blowing across the piste ahead — stand up out of the tuck; it pushes you right]']);
    step(h, 7);
    expect(h.captionText).toContain('blizzard is blowing');
  });

  it('a queued warning that goes stale is dropped (no warning for a cell already passed)', () => {
    const h = hud();
    h.caption('[a storm front rolls in — the wind pushes you left; ski the flagged gaps in the drifts]', 3.2, { soft: true, priority: 2 });
    h.caption('[a blizzard builds ahead — stand up out of the tuck; it pushes you left]', 2.8, { soft: true, priority: 2, ttl: 1 });
    step(h, 10);
    expect(h.captionText).toBeNull();
    expect(h.captionQueue).toEqual([]);
  });

  it('a warning replaces a report on screen at once', () => {
    const h = hud();
    h.caption('[skis scrape over bare rock]', 1.6, { soft: true, priority: 1 });
    h.caption('[a blizzard builds ahead — stand up out of the tuck; it pushes you left]', 2.8, { soft: true, priority: 2 });
    expect(h.captionText).toContain('blizzard');
  });

  it('every caption stays up for its reading time (15 characters a second, + 1 s)', () => {
    const text = '[a storm front rolls in — the wind pushes you left; ski the flagged gaps in the drifts]';
    expect(Hud.readSeconds(text, 3.2)).toBeCloseTo(1 + text.length / 15, 5);
    const h = hud();
    h.caption(text, 3.2, { soft: true, priority: 2 });
    step(h, 1 + text.length / 15 - 0.3);
    expect(h.captionText).toBe(text);
    step(h, 0.6);
    expect(h.captionText).toBeNull();
  });
});

describe('captions (round 3)', () => {
  it('a front warning is taken back when the storm eases (R2 A N8): on screen or queued', () => {
    const h = hud();
    const front = '[a storm front rolls in — the wind pushes you left; ski the flagged gaps in the drifts]';
    h.caption(front, 3.2, { soft: true, priority: 2 });
    expect(h.captionText).toContain('storm front');
    h.withdrawCaption((t) => t.startsWith('[a storm front rolls in'));
    expect(h.captionText).toBeNull();
    // queued behind another warning: dropped from the queue as well
    h.caption('[a blizzard builds ahead — stand up out of the tuck; it pushes you left]', 2.8, { soft: true, priority: 2 });
    h.caption(front, 3.2, { soft: true, priority: 2 });
    expect(h.captionQueue).toContain(front);
    h.withdrawCaption((t) => t.startsWith('[a storm front rolls in'));
    expect(h.captionQueue).not.toContain(front);
    expect(h.captionText).toContain('blizzard');
  });
});
