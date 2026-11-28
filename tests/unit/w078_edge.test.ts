// W-078: the drop-side piste edge of a rolled-down ridge bank (W-065) has no slope break.
// Round 3: the piste's cross-section rose to the edge (slope 0.0032·w ≈ 0.14) and then turned flat
// and downhill — a convex crease that launched a skier re-entering the piste (Review B3-1: edge-probe
// crashes 154 → 481 of 1,422). The bank now leaves the edge on the piste's own slope and eases over.
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { SkierPhysics, PHYS_DT } from '../../src/physics/SkierPhysics';

type Course = ReturnType<typeof makeCourse>;
const courses = (): Course[] => [
  makeCourse('classic', 'sprint', { biome: 'whiteout', difficulty: 'normal' }),
  makeCourse('custom', 'standard', { biome: 'whiteout', customText: 'W3H-06', difficulty: 'normal' } as never),
  makeCourse('custom', 'sprint', { biome: 'whiteout', customText: 'W3H-01', difficulty: 'normal' } as never),
];

describe('W-078 drop-side piste edge', () => {
  it('the lateral slope changes smoothly across the edge (no break; old bank median 0.068, max 0.335)', () => {
    const breaks: number[] = [];
    for (const c of courses()) {
      const m = buildMountain(c);
      const side = (m as unknown as { kRidge?: { dropSide: number } }).kRidge?.dropSide ?? 1;
      for (let z = 300; z < m.finishZ - 100; z += 20) {
        const edge = m.centerX(z) + side * m.halfWidth(z);
        const h = (dx: number) => m.heightAt(edge + side * dx, z);
        const d = 0.25;
        const inside = (h(0) - h(-d)) / d;
        const outside = (h(d) - h(0)) / d;
        breaks.push(Math.abs(inside - outside));
      }
    }
    breaks.sort((a, b) => a - b);
    const med = breaks[breaks.length >> 1]!;
    const max = breaks[breaks.length - 1]!;
    expect(med).toBeLessThan(0.03);
    expect(max).toBeLessThan(0.15);
  });

  it('a skier who strays past the drop edge and steers back stays on his skis (edge probe, Review B3-1)', () => {
    let cases = 0, crashed = 0, airborneNearEdge = 0;
    for (const c of courses()) {
      const m = buildMountain(c);
      const ws = worldSeed(c);
      const side = (m as unknown as { kRidge?: { dropSide: number } }).kRidge?.dropSide ?? 1;
      for (let z0 = 400; z0 < m.finishZ - 200; z0 += 180) {
        for (const deg of [8, 15, 25]) for (const react of [0.4, 0.8]) {
          const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
          const p = new SkierPhysics(m, null, () => [], env);
          const x0 = m.centerX(z0) + side * (m.halfWidth(z0) - 2);
          p.reset(x0, z0, (side * deg * Math.PI) / 180, 18);
          let t = 0, crash = false, reloc = false;
          while (t < 6) {
            const back = t >= react;
            p.step({ steer: back ? side : 0, tuck: back ? 0 : 1, brake: 0, drift: false, pop: false, recover: false }, PHYS_DT);
            for (const e of p.drainEvents()) if ((e as { type: string }).type === 'relocate') reloc = true;
            const s = p.s;
            if (s.crashed) crash = true;
            const b = side * (s.pos.x - m.centerX(s.pos.z)) - m.halfWidth(s.pos.z);
            if (!s.grounded && Math.abs(b) < 2 && s.speed <= 20) airborneNearEdge++;
            t += PHYS_DT;
            if (reloc) break;
          }
          cases++;
          if (crash) crashed++;
        }
      }
    }
    expect(cases).toBeGreaterThan(100);
    // the pre-W-065 bank crashed 10.8 % of B's 1,422 cases (round 3: 33.8 %)
    expect(crashed / cases).toBeLessThanOrEqual(0.11);
    expect(airborneNearEdge * PHYS_DT).toBeLessThan(0.5 * cases * 0.02);
  });
});
