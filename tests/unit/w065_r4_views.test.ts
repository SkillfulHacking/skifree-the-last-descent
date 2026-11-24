// Round 4, W-065 / W-093 (blind art review A): the drop side reads as depth, the edge is marked.
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { wandGeometry, CORNICE } from '../../src/world/biomes/whiteout/views/cornice';

describe('W-065 round 4: the drop side', () => {
  it('the ranges beyond the drop stay below the racing line (no white wall at eye height)', () => {
    for (const len of ['sprint', 'standard'] as const) {
      const m = buildMountain(makeCourse('classic', len, { biome: 'whiteout', difficulty: 'normal' }));
      let n = 0;
      for (let z = 400; z < m.finishZ - 200; z += 150) {
        const line = m.heightAt(m.routeX(z), z);
        const rim = m.ridgeRimX(z);
        // the far ranges: 1.5–6 km past the rim on the drop side (+X)
        for (const e of [1500, 2500, 4000, 6000]) {
          expect(m.heightAt(rim + e, z), `z ${z}, ${e} m past the rim`).toBeLessThan(line - 20);
          n++;
        }
      }
      expect(n).toBeGreaterThan(40);
    }
  });
  it('the ranges behind the crest (the other side) are unchanged: they still rise above the line', () => {
    const m = buildMountain(makeCourse('classic', 'standard', { biome: 'whiteout', difficulty: 'normal' }));
    let above = 0, n = 0;
    for (let z = 400; z < m.finishZ - 200; z += 300) {
      const line = m.heightAt(m.routeX(z), z);
      n++;
      if (m.heightAt(m.centerX(z) - 4000, z) > line + 100) above++;
    }
    expect(above / n).toBeGreaterThan(0.6);
  });
});

describe('W-065 round 4: the rim wands', () => {
  it('2.4 m poles with a fluorescent flag panel at the top, set across the course', () => {
    expect(CORNICE.wandH).toBe(2.4);
    const g = wandGeometry();
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color');
    let flag = 0, minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (col.getX(i) > 0.99 && col.getY(i) < 0.4 && col.getZ(i) < 0.1) {
        flag++;
        minX = Math.min(minX, pos.getX(i));
        maxX = Math.max(maxX, pos.getX(i));
        expect(pos.getY(i)).toBeGreaterThan(CORNICE.wandH - 0.6);
      }
    }
    expect(flag).toBeGreaterThan(0);
    expect(maxX - minX).toBeGreaterThan(0.55);
  });
});
