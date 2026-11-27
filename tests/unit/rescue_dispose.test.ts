/**
 * Gitar, round 5: the rescue station's searchlight pool geometry and glare texture were never disposed, so
 * GPU memory grew across world rebuilds. After dispose(), every geometry, material and texture the
 * station's scene graph holds has been released.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

const ctx2d: unknown = new Proxy(
  {},
  {
    get: (_t, k) =>
      k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern'
        ? () => ({ addColorStop() {} })
        : k === 'createImageData' || k === 'getImageData'
          ? (a: number, b: number, c?: number, d?: number) => ({ width: c ?? a, height: d ?? b, data: new Uint8ClampedArray((c ?? a) * (d ?? b) * 4) })
          : k === 'measureText'
            ? () => ({ width: 10 })
            : () => {},
    set: () => true,
  },
);
(globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

await import('../../src/world/biomes');
const { buildMountain, makeCourse } = await import('../../src/game/CourseConfig');
const { RescueStation } = await import('../../src/world/biomes/whiteout/views/rescue');
const { getBiome } = await import('../../src/world/biome');
const { A11Y } = await import('../../src/core/a11y');

describe('rescue station disposal (Gitar, round 5)', () => {
  it('dispose() releases every geometry, material and texture in the station', () => {
    const m = buildMountain(makeCourse('classic', 'sprint', { biome: 'whiteout', difficulty: 'normal' }));
    const fz = m.finishZ;
    const fx = m.routeX(fz);
    const st = new RescueStation({ quality: 'high', mountain: m, biome: getBiome('whiteout'), heightAt: (x, z) => m.heightAt(x, z), finishCenter: new THREE.Vector3(fx, m.heightAt(fx, fz), fz) });
    const held = new Set<{ dispose(): void }>();
    const owner = new Map<object, string>();
    st.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      // three's sprites share one module geometry: not the station's to free
      if (mesh.geometry && !(o as THREE.Sprite).isSprite) {
        held.add(mesh.geometry);
        owner.set(mesh.geometry, `${o.type}:${o.name || o.parent?.name || '?'}`);
      }
      const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      for (const mt of mats) {
        held.add(mt);
        for (const [k, v] of Object.entries(mt as unknown as Record<string, unknown>))
          if (v instanceof THREE.Texture && !v.userData['shared']) {
            held.add(v);
            owner.set(v, `${k} of ${mt.type} on ${o.type}:${o.name || o.parent?.name || '?'}`);
          }
      }
    });
    const spies = [...held].map((h) => vi.spyOn(h, 'dispose'));
    st.dispose();
    const missed = [...held].filter((_, i) => spies[i]!.mock.calls.length === 0).map((h) => owner.get(h) ?? h.constructor.name);
    expect(missed, `not disposed: ${missed.join('; ')}`).toEqual([]);
  });
});

// (Round 6, W-103 / review E5-3: claimed but untested) with Reduce flashes & pulsing, the beacon and the
// snowcat's light bar burn steadily; without it they flash
describe('rescue station under Reduce flashes', () => {
  const m = buildMountain(makeCourse('classic', 'sprint', { biome: 'whiteout', difficulty: 'normal' }));
  const fx = m.routeX(m.finishZ);
  const make = () => new RescueStation({ quality: 'high', mountain: m, biome: getBiome('whiteout'), heightAt: (x, z) => m.heightAt(x, z), finishCenter: new THREE.Vector3(fx, m.heightAt(fx, m.finishZ), m.finishZ) });
  const sample = (calm: boolean) => {
    A11Y.reduceFlashes = calm;
    const st = make() as unknown as { update(dt: number, t: number, s: object): void; beacon: THREE.Sprite; lightBar: THREE.Mesh };
    const vals: number[] = [];
    for (let t = 0; t < 2; t += 0.05) {
      st.update(0.05, t, { cheer: 0, lookAt: null, welcome: 0 });
      vals.push(st.beacon.material.opacity, (st.lightBar.material as THREE.Material).opacity);
    }
    A11Y.reduceFlashes = false;
    return { beacon: vals.filter((_, i) => i % 2 === 0), bar: vals.filter((_, i) => i % 2 === 1) };
  };
  const spread = (a: number[]) => Math.max(...a) - Math.min(...a);
  it('steady with the setting on, flashing with it off', () => {
    const calm = sample(true);
    const live = sample(false);
    expect(spread(calm.beacon)).toBeLessThan(1e-6);
    expect(spread(calm.bar)).toBeLessThan(1e-6);
    expect(spread(live.beacon)).toBeGreaterThan(0.3);
    expect(spread(live.bar)).toBeGreaterThan(0.3);
  });
});
