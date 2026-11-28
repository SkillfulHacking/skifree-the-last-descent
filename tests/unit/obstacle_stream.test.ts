// Review B3-2 (round 3): W-065's off-piste terrain change re-rolled Whiteout's on-piste obstacles
// (the band's one random stream: steep off-piste ground changed how many draws a cell took).
// With biome.obstacles.cellStream each cell has its own stream: changing the terrain beyond the
// piste leaves every on-piste obstacle where it was.
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { generateBand } from '../../src/physics/obstacles';

function onPiste(biome: string, perturb: boolean): string[] {
  const c = makeCourse('classic', 'sprint', { biome, difficulty: 'normal' } as never);
  const m = buildMountain(c);
  const ws = worldSeed(c);
  if (perturb) {
    // a different off-piste landscape: steep bumps everywhere beyond the piste edge
    const h0 = m.heightAt.bind(m);
    (m as { heightAt: (x: number, z: number) => number }).heightAt = (x, z) => {
      const e = Math.abs(x - m.centerX(z)) - m.halfWidth(z);
      return h0(x, z) + (e > 0 ? 6 * Math.sin(x / 3.1) * Math.cos(z / 2.7) * Math.min(1, e / 5) : 0);
    };
  }
  const out: string[] = [];
  for (let b = 1; b < 8; b++) for (const o of generateBand(m, ws, b)) {
    if (Math.abs(o.x - m.centerX(o.z)) < m.halfWidth(o.z)) out.push(`${o.kind} ${o.x.toFixed(3)} ${o.z.toFixed(3)} ${o.r.toFixed(3)}`);
  }
  return out;
}

describe('B3-2 on-piste obstacles do not depend on off-piste terrain', () => {
  it('Whiteout (cellStream): identical on-piste layout under a different off-piste landscape', () => {
    const a = onPiste('whiteout', false);
    expect(a.length).toBeGreaterThan(100);
    expect(onPiste('whiteout', true)).toEqual(a);
  });
});
