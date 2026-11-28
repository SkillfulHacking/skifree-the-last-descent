// Round 4, W-065 / W-093 (blind art review A): the drop side reads as depth, the edge is marked.
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { wandGeometry, wandSpots, CORNICE } from '../../src/world/biomes/whiteout/views/cornice';

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

describe('W-065 round 5: the rim wands', () => {
  it('3.4 m poles with a fluorescent flag panel at the top', () => {
    expect(CORNICE.wandH).toBe(3.4);
    const g = wandGeometry();
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color');
    let flag = 0, minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (col.getX(i) > 0.99 && col.getY(i) < 0.4 && col.getZ(i) < 0.1) {
        flag++;
        minX = Math.min(minX, pos.getX(i));
        maxX = Math.max(maxX, pos.getX(i));
        expect(pos.getY(i)).toBeGreaterThan(CORNICE.wandH - 0.75);
      }
    }
    expect(flag).toBeGreaterThan(0);
    expect(maxX - minX).toBeGreaterThan(0.85);
  });

  // (review A4-2: the round-4 test checked the wand's shape, never whether the line could see it — the
  // roll-down bank hid every one) the flags are in sight from the gameplay camera on the racing line
  it('from the gameplay camera on the line, the wand flags clear the bank (sight lines)', () => {
    for (const len of ['sprint', 'standard'] as const) {
      const m = buildMountain(makeCourse('classic', len, { biome: 'whiteout', difficulty: 'normal' }));
      let seen = 0;
      let n = 0;
      for (const w of wandSpots(m, 400, m.finishZ - 300)) {
        // the camera: on the line ~30 m back up the course, ~3 m above the snow (the chase camera)
        const cz = w.z - 30;
        const cx = m.routeX(cz);
        const cam = { x: cx, y: m.heightAt(cx, cz) + 3, z: cz };
        const lateral = Math.abs(w.x - cx);
        if (lateral > 90) continue; // too far to matter from the line
        n++;
        const top = { x: w.x, y: w.y + CORNICE.wandH - 0.4, z: w.z };
        let clear = true;
        for (let i = 1; i < 40; i++) {
          const u = i / 40;
          const x = cam.x + (top.x - cam.x) * u, z = cam.z + (top.z - cam.z) * u, y = cam.y + (top.y - cam.y) * u;
          if (y < m.heightAt(x, z) + 0.05) {
            clear = false;
            break;
          }
        }
        if (clear) seen++;
      }
      expect(n, `${len}: wands within 90 m of the line`).toBeGreaterThan(5);
      expect(seen / n, `${len}: share of wand flags in sight`).toBeGreaterThan(0.8);
    }
  });
});

describe('W-065 round 5: spindrift off the lip', () => {
  it('every veil hangs beyond the rim on the drop side, never over skiable ground', async () => {
    const { rimSpindriftVeils } = await import('../../src/world/biomes/whiteout/views/rimSpindrift');
    const { corniceSamples, dropSide } = await import('../../src/world/biomes/whiteout/views/cornice');
    for (const len of ['sprint', 'standard'] as const) {
      const m = buildMountain(makeCourse('classic', len, { biome: 'whiteout', difficulty: 'normal' }));
      const side = dropSide(m);
      const veils = rimSpindriftVeils(m, corniceSamples(m, 0, m.finishZ));
      expect(veils.length, `${len}: veils along the rim`).toBeGreaterThan(m.finishZ / 200);
      for (const v of veils) {
        const z = v.top.z;
        // beyond the rim, outward
        expect(side * (v.top.x - m.ridgeRimX(z)), `z ${z.toFixed(0)}: beyond the rim`).toBeGreaterThan(0.5);
        // and well off the piste
        expect(Math.abs(v.top.x - m.centerX(z)), `z ${z.toFixed(0)}: off the piste`).toBeGreaterThan(m.halfWidth(z) + 5);
      }
    }
  });
});
