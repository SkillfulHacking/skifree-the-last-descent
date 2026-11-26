/**
 * Round 5, review D4-5 / D4-6: the storm-cave dressing is built in slices; World.disposeCave abandons an
 * unfinished one (generator return). Everything built so far must be released, and each live cave
 * scrolls its own copy of the shared spindrift texture (two caves must not double its speed).
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

// a canvas stub: the dressing paints textures with 2D-context calls whose results are not inspected
const ctx2d: unknown = new Proxy(
  {},
  {
    get: (_t, k) =>
      k === 'createLinearGradient' || k === 'createRadialGradient'
        ? () => ({ addColorStop() {} })
        : k === 'createImageData' || k === 'getImageData'
          ? (a: number, b: number, c?: number, d?: number) => {
              const w = c ?? a;
              const h = d ?? b;
              return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
            }
          : () => {},
    set: () => true,
  },
);
(globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const { dressStormCaveSteps } = await import('../../src/world/biomes/whiteout/views/stormCave');

function fakeCave() {
  const group = new THREE.Group();
  return {
    mountain: {} as never,
    anchor: { z: 1200, x: 0, side: 1 } as never,
    quality: 'high' as never,
    biome: {} as never,
    cave: { group, outward: new THREE.Vector3(1, 0, 0), lipTop: new THREE.Vector3(0, 9, 1200), mouth: new THREE.Vector3(1, 1, 1200) } as never,
  };
}

/** dispose calls on geometries, materials and textures from now on */
function disposeCounter() {
  const spies = [THREE.BufferGeometry, THREE.Material, THREE.Texture].map((C) => vi.spyOn(C.prototype as { dispose(): void }, 'dispose'));
  return () => spies.reduce((n, s) => n + s.mock.calls.length, 0);
}

describe('storm cave dressing (round 5, D4-5 / D4-6)', () => {
  it('abandoning the dressing part-way disposes what it built', () => {
    const disposed = disposeCounter();
    const gen = dressStormCaveSteps(fakeCave());
    gen.next(); // first slice: the grains
    gen.next(); // into the architecture
    gen.next();
    const mid = disposed();
    expect(mid).toBe(0);
    gen.return(null as never);
    // the two grain layers (geometry, material, texture each) and the architecture's materials so far
    expect(disposed() - mid).toBeGreaterThanOrEqual(6);
    vi.restoreAllMocks();
  });

  it('each cave scrolls its own spindrift texture', () => {
    const build = () => {
      const g = dressStormCaveSteps(fakeCave());
      let r = g.next();
      while (!r.done) r = g.next();
      return r.value;
    };
    const a = build();
    const b = build();
    const sheet = (d: { group: THREE.Object3D }) => (d.group.getObjectByName('storm-cave-spindrift-sheet') as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(sheet(a).map).not.toBe(sheet(b).map);
    const y0 = sheet(a).map!.offset.y;
    a.update!(0.1, 0);
    b.update!(0.1, 0);
    const stepA = sheet(a).map!.offset.y - y0;
    expect(stepA).toBeGreaterThan(0);
    // b's update did not move a's sheet
    expect(sheet(a).map!.offset.y - y0).toBeCloseTo(stepA, 9);
    expect(sheet(a).map!.image).toBe(sheet(b).map!.image);
    a.dispose?.();
    b.dispose?.();
  });
});
