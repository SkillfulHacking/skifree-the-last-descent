import '../../tests/support/domStub';
/**
 * Round 7 (C r6 #1): the coastal reveal before the emergence (cave cinematic, every cave whose
 * dressing found no sea-framing station) looks up the sea cliff from low over the water: open water
 * must fill part of the frame. Same pose as seaCaveCinematic.ts.
 */
import { expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse, type LengthMode } from '../../src/game/CourseConfig';
import { Cave } from '../../src/world/Cave';
import { waterFraction } from '../../src/world/biomes/fjord/views/seaFraming';
it('the coastal reveal shows the sea on Sprint, Standard and Endurance caves', () => {
  for (const [len, sd] of [['standard', ''], ['standard', 'C4G'], ['endurance', ''], ['sprint', '']] as [LengthMode, string][]) {
    const m = buildMountain(makeCourse(sd ? 'custom' : 'classic', len, { biome: 'fjord', customText: sd || undefined }));
    for (const e of m.profile.encounters(-Infinity, m.profile.finishZ).slice(0, 2)) {
      const cave = new Cave(m, e.anchor, 'low');
      const M = cave.mouth; const coast = m.coast!;
      const water = coast.seaLevelAt(M.z); const rx = coast.rimX(M.z); const cl = m.cliff;
      const footX = cl ? rx - cl.footOffset(cl.column(M.z)) : rx - 120;
      const cam = new THREE.Vector3(footX - 170, water + 22, M.z - 110);
      const rim = new THREE.Vector3(rx - 10, 0, M.z + 30);
      // tilted up only ~5°: the face fills the frame, the water its lower quarter
      rim.y = water + 22 + Math.tan(THREE.MathUtils.degToRad(5)) * Math.hypot(rim.x - (footX - 170), rim.z - (M.z - 110));
      const hgt = m.heightAt(cam.x, cam.z);
      expect(waterFraction(m, cam, rim, 50), `${len} ${sd} ${e.anchor.z}`).toBeGreaterThanOrEqual(0.1);
      console.log('REV', len, sd, e.anchor.z.toFixed(0), 'water', waterFraction(m, cam, rim, 50).toFixed(2), 'camAboveGround', (cam.y - hgt).toFixed(0), 'M-water', (M.y - water).toFixed(0));
      cave.dispose();
    }
  }
});
