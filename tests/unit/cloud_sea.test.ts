/**
 * W-065: the valley cloud deck lies on the drop side, below the line and past the rim, follows the
 * camera along the course, and is gone in a full storm.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { CLOUD_SEA, ValleyCloudSea } from '../../src/world/biomes/whiteout/views/cloudSea';

describe('W-065 valley cloud deck', () => {
  const m = buildMountain(makeCourse('classic', 'sprint', { biome: 'whiteout' }));
  const R = m.biome.terrain.ridge!;
  const frame = (z: number, storm: number) => ({ focus: new THREE.Vector3(m.routeX(z), 0, z), camPos: new THREE.Vector3(m.routeX(z), m.heightAt(m.routeX(z), z) + 3, z - 6), origin: new THREE.Vector3(100, -50, z - 200), storm });
  it('below the line, past the rim on the drop side, in render space', () => {
    const c = new ValleyCloudSea(m, [0.74, 0.79, 0.86]);
    for (const z of [500, 1500, 2500]) {
      const f = frame(z, 0);
      c.update(10, f);
      const world = c.mesh.position.clone().add(f.origin);
      const zc = f.camPos.z;
      expect(world.y).toBeCloseTo(m.heightAt(m.routeX(zc), zc) - CLOUD_SEA.drop, 3);
      // the near edge of the plane is at the rim (the shader fades it in from CLOUD_SEA.from past it)
      const near = world.x - R.dropSide * (CLOUD_SEA.across / 2);
      expect(near).toBeCloseTo(m.ridgeRimX(f.camPos.z), 3);
      expect(c.mesh.visible).toBe(true);
    }
    c.dispose();
  });
  it('gone in a full storm, back in the clear', () => {
    const c = new ValleyCloudSea(m, [0.74, 0.79, 0.86]);
    c.update(0, frame(1500, 0.9));
    expect(c.mesh.visible).toBe(false);
    c.update(0, frame(1500, 0.1));
    expect(c.mesh.visible).toBe(true);
    c.dispose();
  });
});
