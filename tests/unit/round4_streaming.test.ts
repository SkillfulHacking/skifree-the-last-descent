/**
 * Round 4 (Phase E): one streaming budget per frame shared by every consumer (World.update), the
 * finer coastal far tiles gated to medium and above, and the snowball throw slot warmed at start.
 * CPU-side only (Node, no GPU): frame-time numbers are in docs/reviews/biomes/fjord/round-4.
 */
import '../support/domStub';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { World, STREAM_STARVE_FRAMES } from '../../src/game/World';
import { makeCourse } from '../../src/game/CourseConfig';
import { fakeRenderer } from '../support/fakeRenderer';
import { frameBudget } from '../../src/core/frameBudget';
import { makeTick } from '../../src/world/cave/budget';
import { TerrainRenderer } from '../../src/world/TerrainRenderer';
import { buildMountain } from '../../src/game/CourseConfig';
import { SnowballView } from '../../src/yeti/SnowballView';
import { ObstacleField, generateBand, BAND } from '../../src/physics/obstacles';
import { worldSeed } from '../../src/game/CourseConfig';

describe('Round 4: shared per-frame streaming budget', () => {
  it('slices end with the frame budget: a tick reset after the budget is spent allows only a minimal slice', () => {
    frameBudget.begin(0);
    const tk = makeTick(4);
    tk.reset();
    const t0 = performance.now();
    while (!tk.over()) if (performance.now() - t0 > 50) break;
    expect(performance.now() - t0).toBeLessThan(3);
    frameBudget.end();
    expect(frameBudget.remaining()).toBe(Infinity);
  });

  it('World.update streams Fjord on one budget: everything gets built (nothing starves), queues stay short, the next cave exists in time', { timeout: 120_000 }, async () => {
    const w = await World.create(fakeRenderer, 'low', makeCourse('classic', 'endless', { biome: 'fjord' }), () => {});
    const m = w.mountain;
    const focus = new THREE.Vector3();
    let maxHazardPending = 0;
    let waited = 0;
    let maxWait = 0;
    for (let i = 1; i <= 4000; i++) {
      const z = i * 0.5;
      focus.set(m.routeX(z), m.heightAt(m.routeX(z), z), z);
      w.update(1 / 60, i / 60, focus, focus);
      maxHazardPending = Math.max(maxHazardPending, w.hazardViews.pendingCount);
      // terrain near the skier never waits long
      waited = w.terrain.pendingNear > 0 ? waited + 1 : 0;
      maxWait = Math.max(maxWait, waited);
    }
    expect(maxHazardPending).toBeLessThan(40);
    expect(w.caveCount).toBeGreaterThanOrEqual(1);
    // the starvation guard: a full queue still drains (bounded by its size, not stuck)
    expect(maxWait).toBeLessThan(600);
    expect(STREAM_STARVE_FRAMES).toBeGreaterThan(0);
    // and after a few quiet frames standing still, every queue is empty
    for (let i = 0; i < 3000 && (w.terrain.pending || w.hazardViews.pendingCount); i++) w.update(1 / 60, 100 + i / 60, focus, focus);
    expect(w.terrain.pending).toBe(0);
    expect(w.hazardViews.pendingCount).toBe(0);
    w.dispose();
  });
});

describe('Round 4: time-sliced obstacle bands', () => {
  it('a band generated in slices (any slice size, finished by ensure or by prefetch) is identical to one generated at once', () => {
    for (const biome of ['alpine', 'fjord']) {
      const c = makeCourse('custom', 'standard', { biome, customText: 'SLICE1' });
      const m = buildMountain(c);
      const ws = worldSeed(c);
      const f = new ObstacleField(m, ws);
      f.prefetch(5 * BAND, 5 * BAND, 0); // one row of band 5
      f.prefetch(6 * BAND, 6 * BAND, 0.05);
      f.ensure(5 * BAND, 5 * BAND); // finishes band 5's job synchronously
      for (let i = 0; i < 200 && f.missing(6 * BAND, 7 * BAND); i++) f.prefetch(6 * BAND, 7 * BAND, 0);
      for (const b of [5, 6, 7]) {
        const got = [...f.inRange(b * BAND, b * BAND + BAND - 1e-6)];
        expect(got, `${biome} band ${b}`).toEqual(generateBand(m, ws, b).filter((o) => o.z <= b * BAND + BAND - 1e-6));
      }
    }
  });
});

describe('Round 4: finer coastal far tiles only on medium and above (D r3 defect 2)', () => {
  it('low builds the coastal far field at 64 m; medium at 32 m beside the corridor', () => {
    const m = buildMountain(makeCourse('custom', 'sprint', { biome: 'fjord', customText: 'PERF1' }));
    const tris = (q: 'low' | 'medium') => {
      const t = new TerrainRenderer(m, q);
      t.update(m.routeX(0), 0, 1e9, 0);
      t.flushFar();
      let n = 0;
      t.group.traverse((o) => {
        if (o instanceof THREE.Mesh && o.position.x >= -3072 && o.position.x + 2048 <= 3072 && Math.abs(o.position.x) > 600) n += (o.geometry.index?.count ?? 0) / 3;
      });
      t.dispose();
      return n;
    };
    const low = tris('low');
    const med = tris('medium');
    expect(low).toBeGreaterThan(0);
    expect(med).toBeGreaterThan(low * 2);
  });
});

describe('Round 4: snowball throw slot is warmed with the session (D r3 defect 5)', () => {
  it('the beam (the only alphaMap material) exists and is visible for the start-of-run compile, then hidden', () => {
    const v = new SnowballView((_x, _z, out) => {
      out.x = 0;
      out.y = 1;
      out.z = 0;
    });
    const beams = () => {
      const out: THREE.Mesh[] = [];
      v.group.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material as THREE.MeshBasicMaterial).alphaMap) out.push(o);
      });
      return out;
    };
    expect(beams().length).toBe(1);
    // the session's set-up call keeps it shown (App compiles warmupObjects with traverseVisible)
    v.update(null, 0, new THREE.Vector3(), new THREE.Vector3(0, -5000, 0));
    const vis = (o: THREE.Object3D) => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
      return true;
    };
    expect(beams().every(vis)).toBe(true);
    v.update(null, 0.016, new THREE.Vector3());
    expect(beams().some(vis)).toBe(false);
  });
});
