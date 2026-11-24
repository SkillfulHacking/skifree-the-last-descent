// W-081: one push direction per blizzard gust. The caption names it at the first warning and the
// push, the wind and the air push keep it for the whole gust — even when a front crosses 30 % strength
// mid-gust (round 3: 11 of 120 warnings named the wrong side; 3 cells reversed inside the gust).
import { describe, expect, it } from 'vitest';
import { blizzardPushDir, BLIZZARD_CELL, BLIZZARD_TIMING } from '../../src/world/biomes/whiteout/hazards';
import { periodicPhase } from '../../src/world/hazards/hazard';
import { frontAt } from '../../src/world/biomes/whiteout/storm';

const T = { kind: 'periodic' as const, ...BLIZZARD_TIMING };

describe('W-081 blizzard direction is latched per gust', () => {
  it('telegraph through active: one direction, the one a warning at any moment of the gust names', () => {
    let gusts = 0, crossing = 0;
    for (const seed of [913, 7, 31, 4242, 99001, 123457]) {
      for (let c = 0; c < 12; c++) {
        const h = { seed: 1000 + c * 7919 + seed, params: { dir: c % 2 ? 1 : -1 } };
        const off = (h.seed % 10007) / 10007;
        // group every 0.1 s of telegraph + active by the gust it belongs to (its telegraph start)
        const by = new Map<number, { dirs: Set<number>; sMin: number; sMax: number }>();
        for (let t = 0; t < 900; t += 0.1) {
          const ph = periodicPhase(t, off, T);
          if (ph.phase !== 'telegraph' && ph.phase !== 'active') continue;
          const intoGust = ph.phase === 'telegraph' ? ph.u * T.telegraph : T.telegraph + ph.u * T.active;
          const g = Math.round((t - intoGust) * 2) / 2;
          const e = by.get(g) ?? { dirs: new Set<number>(), sMin: 1, sMax: 0 };
          e.dirs.add(blizzardPushDir(h, t, seed));
          const s = frontAt(t, seed).s;
          e.sMin = Math.min(e.sMin, s); e.sMax = Math.max(e.sMax, s);
          by.set(g, e);
        }
        for (const [g, e] of by) {
          gusts++;
          if (e.sMin <= 0.3 && e.sMax > 0.3) crossing++;
          expect(e.dirs.size, `seed ${seed} cell ${c} gust ${g}`).toBe(1);
        }
      }
    }
    expect(gusts).toBeGreaterThan(900);
    expect(crossing).toBeGreaterThan(5); // the case that reversed before
  });

  it('a gust that blows inside a front pushes the front\'s way (the HUD arrow); in the clear, its own', () => {
    const seed = 913;
    let storm = 0, clear = 0;
    for (let c = 0; c < 40; c++) {
      const h = { seed: 50 + c * 104729, params: { dir: c % 2 ? 1 : -1 } };
      const off = (h.seed % 10007) / 10007;
      for (let t = 0; t < 900; t += 0.5) {
        const ph = periodicPhase(t, off, T);
        if (ph.phase !== 'active') continue;
        const f = frontAt(t, seed);
        const d = blizzardPushDir(h, t, seed);
        if (f.s > 0.5) { expect(d).toBe(f.dir); storm++; }
        else if (f.s === 0 && frontAt(t - 15, seed).s === 0 && frontAt(t + 15, seed).s === 0) { expect(d).toBe(h.params.dir); clear++; }
      }
    }
    expect(storm).toBeGreaterThan(50);
    expect(clear).toBeGreaterThan(50);
  });

  it('the effect pushes, blows and airs the latched direction', () => {
    const seed = 913;
    const h = { x: 0, z: 0, r: 58, seed: 4711, params: { dir: 1 } };
    for (let t = 0; t < 600; t += 0.7) {
      const d = blizzardPushDir(h, t, seed);
      const base = { dx: 0, dz: 0, dist: 0, inside: true, speed: 15, heightAbove: 0, t, intensity: 0.8, seed, tuck: 0 };
      const g = BLIZZARD_CELL.effect(h as never, { phase: 'active', u: 0.5 } as never, { ...base, grounded: true } as never)!;
      const a = BLIZZARD_CELL.effect(h as never, { phase: 'active', u: 0.5 } as never, { ...base, grounded: false } as never)!;
      expect(Math.sign(g.slipX!)).toBe(d);
      expect(Math.sign(g.windX!)).toBe(d);
      expect(Math.sign(a.airPushX!)).toBe(d);
    }
  });
});
