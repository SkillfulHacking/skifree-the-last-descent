// W-092 (review B3-9): a new chase does not inherit the last chase's lunge cooldown or a lunge in progress.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { YetiAI } from '../../src/yeti/YetiAI';

describe('W-092 Yeti lunge state per chase', () => {
  it('startChase clears the lunge timer and cooldown', () => {
    const c = makeCourse('classic', 'endurance', { biome: 'alpine', difficulty: 'normal' });
    const m = buildMountain(c);
    const y = new YetiAI(m, new ObstacleField(m, worldSeed(c)));
    y.lungeTimer = 0.5;
    y.lungeCooldown = 2.9;
    y.standDown();
    y.place(m.routeX(2000), 2000, 0);
    y.startChase(new THREE.Vector3(0, 4, 8));
    expect(y.lungeTimer).toBe(0);
    expect(y.lungeCooldown).toBe(0);
  });
});
