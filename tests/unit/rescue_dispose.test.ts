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
