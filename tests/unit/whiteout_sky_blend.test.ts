/**
 * W-043 (round-1 A 5 / C C-9): while a cinematic's weather is handed back to the model
 * (World.releaseWeather), the fog and snow follow the blended storm value. The storm sky must follow
 * the same value, not jump straight to the model's storm (a clear sky under a "STORM" fog, or the
 * reverse, for the length of the blend).
 */
import '../support/domStub';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { StormSky, SKY } from '../../src/world/biomes/whiteout/views/sky';
import { frontAt } from '../../src/world/biomes/whiteout/storm';
import { atmosphere } from '../../src/world/look/atmosphere';

describe('storm sky during a weather hand-back (W-043)', () => {
  it('follows the blended storm value while blending, the model otherwise', () => {
    const seed = 12345;
    let t = 30;
    while (frontAt(t, seed).phase !== 'storm' || frontAt(t, seed).s < 0.7) t += 0.5;
    const frame = (blend: boolean, storm: number) => ({ focus: new THREE.Vector3(0, 0, 500), camPos: new THREE.Vector3(0, 3, 490), origin: new THREE.Vector3(), clock: t, weatherSeed: seed, storm, blend });
    const sky = new StormSky();
    // blending from the cinematic's clear sky (storm 0): cloud shadows still those of a clear day
    sky.update(1 / 60, t, frame(true, 0));
    expect(atmosphere.uCloudK.value).toBeCloseTo(SKY.shadowK, 5);
    // no blend: the model's storm (≥ 0.7) has killed the cloud shadows
    sky.update(1 / 60, t, frame(false, 0));
    expect(atmosphere.uCloudK.value).toBeLessThan(SKY.shadowK * 0.5);
    sky.dispose();
  });
});
