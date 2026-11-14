/**
 * Sea-cliff kit (src/world/art): determinism and the hidden-backing contract of the shipped cliff
 * model (the Fjord mountain's own), bounded segment size. (The round-4 experiment coast that these
 * tests first ran on, artCoast.ts, was never part of the game and has been removed.)
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { buildCliffSegment, CliffModel } from '../../src/world/art/cliffKit';

// a fresh mountain per call: its cliff model has its own column cache
const art = () => buildMountain(makeCourse('classic', 'sprint', { biome: 'fjord' })) as unknown as { cliff: CliffModel | null };

describe('sea-cliff kit', () => {
  it('builds identical cliff segments regardless of query order', () => {
    const a = art();
    const b = art();
    // warm b's column cache in a different order
    for (let z = 1300; z > 1000; z -= 7) b.cliff!.column(z);
    const ga = buildCliffSegment(a.cliff!, { z0: 1024, z1: 1280, ds: 4, dr: 3 });
    const gb = buildCliffSegment(b.cliff!, { z0: 1024, z1: 1280, ds: 4, dr: 3 });
    const pa = ga.getAttribute('position').array as Float32Array;
    const pb = gb.getAttribute('position').array as Float32Array;
    expect(pa.length).toBe(pb.length);
    for (let i = 0; i < pa.length; i++) expect(pa[i]).toBe(pb[i]);
    // bounded: a near-LOD 256 m segment stays well under 100k vertices
    expect(pa.length / 3).toBeLessThan(100_000);
  });

  it('keeps the heightfield backing behind the cliff face', () => {
    const a = art();
    const m: CliffModel = a.cliff!;
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

});
