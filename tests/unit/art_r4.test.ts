/**
 * Round-4 art experiment (src/world/art): determinism, gameplay invariance and the hidden-backing
 * contract of the cliff kit; deterministic island layout; bounded sizes.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { ArtCoastMountain, islandSpecs } from '../../src/world/art/artCoast';
import { buildCliffSegment, CliffModel } from '../../src/world/art/cliffKit';
import { buildIsland } from '../../src/world/art/islands';

const base = buildMountain(makeCourse('classic', 'sprint', { biome: 'fjord' }));
const art = () => new ArtCoastMountain(base.profile, base.seed, base.biome);

describe('art r4: proposed coast', () => {
  it('leaves every land-side height (gameplay) unchanged', () => {
    const a = art();
    const c = base.coast!;
    let n = 0;
    for (let z = -200; z < 2900; z += 37) {
      for (let x = c.rimX(z) + 0.6; x < c.rimX(z) + 400; x += 23) {
        expect(a.heightAt(x, z)).toBe(base.heightAt(x, z));
        n++;
      }
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('builds identical cliff segments regardless of query order', () => {
    const a = art();
    const b = art();
    // warm b's column cache in a different order
    for (let z = 1300; z > 1000; z -= 7) b.cliff.column(z);
    const ga = buildCliffSegment(a.cliff, { z0: 1024, z1: 1280, ds: 4, dr: 3 });
    const gb = buildCliffSegment(b.cliff, { z0: 1024, z1: 1280, ds: 4, dr: 3 });
    const pa = ga.getAttribute('position').array as Float32Array;
    const pb = gb.getAttribute('position').array as Float32Array;
    expect(pa.length).toBe(pb.length);
    for (let i = 0; i < pa.length; i++) expect(pa[i]).toBe(pb[i]);
    // bounded: a near-LOD 256 m segment stays well under 100k vertices
    expect(pa.length / 3).toBeLessThan(100_000);
  });

  it('keeps the heightfield backing behind the cliff face', () => {
    const a = art();
    const m: CliffModel = a.cliff;
    let worst = -Infinity;
    for (let z = 300; z < 2600; z += 53) {
      const col = m.column(z);
      // (above the talus cones, which are meant to bank against the foot of the face)
      for (let dz = 15; dz < col.H * 0.88 - 12; dz += 9) {
        const t = m.offsetAt(col, dz);
        // the face (undisplaced) at seaward offset t is at hRim − dz; displacement may push it at
        // most 6 m inland: the backing there must still be below the face
        const back = m.backingHeight(z, t - 6, 180);
        worst = Math.max(worst, back - (col.hRim - dz));
      }
    }
    expect(worst).toBeLessThan(0.5);
  });

  it('lays out islands deterministically, with several archetypes', () => {
    const r = { x0: -3000, x1: -250, z0: 0, z1: 3400 };
    const s1 = islandSpecs(art(), r);
    const s2 = islandSpecs(art(), r);
    expect(s1).toEqual(s2);
    expect(new Set(s1.map((s) => s.kind)).size).toBeGreaterThanOrEqual(3);
    const g = buildIsland(s1[0]!);
    expect(g.geometry.getAttribute('position').count).toBeLessThan(40_000);
  });
});
