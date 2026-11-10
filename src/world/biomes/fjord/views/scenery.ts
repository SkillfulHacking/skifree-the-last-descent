/**
 * "fjord-coast" scenery: everything streamed along the Fjord course that is not terrain, obstacles
 * or hazards — the water surfaces, sea mist, fishing hamlets, boats and ships, the cairns along the
 * cliff rim and the viewpoints. Built once per course; pieces near the skier are created by
 * `stream(z)` and disposed when far behind (bounded on any length, Endless included).
 */
import * as THREE from 'three';
import { registerScenery, type SceneryContext, type SceneryFrame, type SceneryView } from '../../../presentation/scenery';
import { FjordWater } from './water';

export class FjordScenery implements SceneryView {
  readonly group = new THREE.Group();
  readonly water: FjordWater;

  constructor(ctx: SceneryContext) {
    const coast = ctx.mountain.coast;
    if (!coast) throw new Error('fjord-coast scenery needs a coastal mountain');
    this.group.name = 'FjordScenery';
    this.water = new FjordWater(coast, ctx.terrain, ctx.sunDir, new THREE.Color(...ctx.biome.ranges.skyColor), ctx.quality);
    this.group.add(this.water.group);
  }

  stream(_z: number): void {}

  update(_dt: number, time: number, f: SceneryFrame): void {
    this.water.update(time, f.camPos, f.origin);
  }

  stats() {
    return { water: this.water.active.length };
  }

  dispose(): void {
    this.water.dispose();
    this.group.removeFromParent();
  }
}

export const FJORD_SCENERY = registerScenery({ id: 'fjord-coast', build: (ctx) => new FjordScenery(ctx) });
