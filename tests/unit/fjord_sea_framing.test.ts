/**
 * Pass 5 (C r8–r9, F r9): on the default course (Classic · Standard) and the longer ones the sea cave
 * sits ~300 m above the water with its hill between, so no near camera station sees the fjord. The
 * dressing then finds a far telephoto station: the Yeti at the mouth and open water in one frame.
 */
import '../support/domStub';
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { Cave } from '../../src/world/Cave';
import { dressSeaCave, type SeaShots } from '../../src/world/biomes/fjord/views/seaCave';
import { clearShot, waterFraction } from '../../src/world/biomes/fjord/views/seaFraming';

describe('Fjord cave emergence shares a frame with the sea', () => {
  for (const len of ['standard', 'endurance', 'expedition'] as const)
    it(`Classic ${len}, first cave`, () => {
      const m = buildMountain(makeCourse('classic', len, { biome: 'fjord' }));
      const e = m.profile.encounters(-Infinity, m.finishZ)[0]!;
      const cave = new Cave(m, e.anchor, 'high');
      const d = dressSeaCave({ cave, mountain: m, anchor: e.anchor, quality: 'high', biome: m.biome } as never);
      const s = d.group.userData['seaShots'] as SeaShots;
      const pose = s.emerge ?? s.emergeFar ?? null;
      expect(pose).not.toBeNull();
      const subject = cave.mouth.clone().add({ x: 0, y: 1.7, z: 0 } as never);
      expect(clearShot(m, pose!.cam, subject, [])).toBe(true);
      expect(waterFraction(m, pose!.cam, pose!.look, pose!.fov)).toBeGreaterThanOrEqual(0.08);
      // the Yeti (2.5 m) stays readable: ≥ 4 % of the frame's height
      const dist = pose!.cam.distanceTo(subject);
      const share = 2.5 / (2 * dist * Math.tan(((pose!.fov / 2) * Math.PI) / 180));
      expect(share).toBeGreaterThanOrEqual(0.04);
      d.dispose();
    }, 300_000);
});
