/**
 * W-038 / round-1 D F-1: the wind-drift spindrift plume must not query the terrain per grain per
 * frame (it cost ~4.8 ms a frame with ~27 drifts animated), must not animate while hidden, and must
 * still sit where it did (heights within a few cm of the per-frame terrain query it replaced).
 */
import '../support/domStub';
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { driftView } from '../../src/world/biomes/whiteout/views/hazardViews';
import { atmosphere } from '../../src/world/look/atmosphere';
import type { HazardInstance } from '../../src/world/hazards/hazard';
import type { DriftParams } from '../../src/world/biomes/whiteout/hazards';
import * as THREE from 'three';

function drifts(n: number) {
  const c = makeCourse('custom', 'sprint', { biome: 'whiteout', customText: 'W038-PLUME' });
  const m = buildMountain(c);
  const env = new BiomeEnvironment(m, worldSeed(c), { difficulty: 'normal' });
  env.hazards.ensure(0, 3000);
  const hs = env.hazards.peek(0, 3000).filter((h) => h.kind === 'wind-drift').slice(0, n) as HazardInstance<DriftParams>[];
  return { m, hs };
}
const PH = { phase: 'active', u: 0, strength: 1 } as never;

describe('wind-drift plume (W-038)', () => {
  it('does not query the terrain while animating, and skips the loop while hidden', () => {
    const { m, hs } = drifts(6);
    expect(hs.length).toBe(6);
    let calls = 0;
    const counted = new Proxy(m, { get: (t, k, r) => (k === 'heightAt' ? (x: number, z: number) => (calls++, t.heightAt(x, z)) : Reflect.get(t, k, r)) });
    const views = hs.map((h) => driftView(h, counted));
    atmosphere.uDriftK.value = 0.6;
    calls = 0;
    for (let f = 0; f < 120; f++) for (const v of views) v.update!(PH, f / 60, 1 / 60);
    expect(calls).toBe(0);
    // hidden (no wind): the positions are not touched
    atmosphere.uDriftK.value = 0;
    const plume = views[0]!.object.children.find((o) => o instanceof THREE.Points) as THREE.Points;
    const before = (plume.geometry.getAttribute('position') as THREE.BufferAttribute).version;
    views[0]!.update!(PH, 3, 1 / 60);
    expect(plume.visible).toBe(false);
    expect((plume.geometry.getAttribute('position') as THREE.BufferAttribute).version).toBe(before);
    for (const v of views) v.dispose();
  });

  it('grains stay within 5 cm of the per-frame terrain height they replaced', () => {
    const { m, hs } = drifts(8);
    atmosphere.uDriftK.value = 0.6;
    let worst = 0;
    for (const h of hs) {
      const v = driftView(h, m);
      const plume = v.object.children.find((o) => o instanceof THREE.Points) as THREE.Points;
      const p = plume.geometry.getAttribute('position') as THREE.BufferAttribute;
      const c = Math.cos(h.rot), s = Math.sin(h.rot);
      const L = h.r * h.params.len, W = h.r * 0.75, H = 1.7 + 0.5 * ((h.seed % 97) / 97), crestZ = 0.35 * W;
      for (const t of [0.3, 1.1, 2.7, 5.9]) {
        v.update!(PH, t, 1 / 60);
        for (let i = 0; i < p.count; i++) {
          // the replaced formula: the ground under the grain's current crest position
          const u = (((h.seed * 31 + i * 977) % 1000) / 1000) * 2 - 1;
          const phase = (Math.sin(h.seed * 0.71 + i * 91.7) * 43758.5453) % 1;
          const jit = ((Math.sin(h.seed * 1.37 + i * 47.3) * 24634.6345) % 1) * 2;
          const life = (((t * 0.55 + Math.abs(phase)) % 1) + 1) % 1;
          const lx = u * L * 0.85 + jit * (0.6 + life * 1.8);
          const y = m.heightAt(h.x + lx * c - crestZ * s, h.z + lx * s + crestZ * c) + H * Math.pow(Math.max(0, 1 - u * u), 0.8) + 0.2 + life * 1.4 - life * life * 1.6;
          worst = Math.max(worst, Math.abs(p.getY(i) - y));
        }
      }
      v.dispose();
    }
    expect(worst).toBeLessThan(0.05);
  });
});
