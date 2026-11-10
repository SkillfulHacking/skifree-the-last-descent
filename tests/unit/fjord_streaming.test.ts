/**
 * Fjord Coast, browser-free streaming check (Reviewer D, round 1): 120 km of Endless with the real
 * three.js scenery (time-sliced chunk builds), hazard views and coastal shelters built and
 * disposed exactly as World streams them. Checks bounded residency, constant light count, water on
 * every fjord arm within the far plane, and that every geometry created is disposed.
 */
import '../support/domStub';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { createSnowMaterial, SEA_SLOTS } from '../../src/world/snowMaterial';
import { HAZARD_VIEW_BUDGET_MS, HazardLayer, SCENERY_BUDGET_MS, getScenery, presentationOf, type RefugeView } from '../../src/world/presentation';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { waterReaches } from '../../src/world/biomes/fjord/views/water';
import { ResourceTracker, countLights } from '../support/resourceTracker';

describe('Fjord Coast: Endless streaming of scenery, hazard views and shelters (no browser)', () => {
  it('120 km: bounded residency, no streamed lights, water on every arm in view, everything disposed', () => {
    const KM = 120;
    const course = makeCourse('classic', 'endless', { biome: 'fjord' });
    const m = buildMountain(course);
    const q = 'high' as const;
    const farDist = 2500;
    const { uniforms } = createSnowMaterial(q, m.biome);
    const sc = getScenery('fjord-coast').build({ mountain: m, quality: q, biome: m.biome, terrain: uniforms, sunDir: new THREE.Vector3(0.3, 0.2, 0.9).normalize() });
    const env = new BiomeEnvironment(m, worldSeed(course));
    const layer = new HazardLayer(env, { mountain: m, quality: q, biome: m.biome });
    const P = presentationOf(m.biome);
    const lodges = new Map<number, RefugeView>();
    const tr = new ResourceTracker();
    const origin = new THREE.Vector3();
    const peak: Record<string, number> = { chunks: 0, pending: 0, views: 0, lodges: 0, lights: 0, viewQueue: 0 };
    let shelters = 0;
    let streamZ = -Infinity;
    let t = 0;
    const step = 16; // m per simulated frame (streaming windows are 64–512 m)
    for (let z = 0; z < KM * 1000; z += step) {
      t += step / 30;
      env.clock = t;
      env.stream(z);
      env.hazards.ensure(z + 400, z + 1100);
      if (Math.abs(z - streamZ) > 64) {
        streamZ = z;
        env.release(z - 900, z + farDist + 400);
        sc.stream(z);
        const cps = m.profile.checkpoints(z - 400, z + 1600);
        for (const cz of cps)
          if (!lodges.has(cz)) {
            const r = P.refuge.build({ mountain: m, z: cz, index: lodges.size, quality: q, biome: m.biome });
            lodges.set(cz, r);
            shelters++;
            tr.see(r.group);
            peak.lights = Math.max(peak.lights, countLights(r.group));
          }
        for (const [cz, r] of lodges)
          if (!cps.includes(cz)) {
            r.dispose();
            lodges.delete(cz);
          }
        tr.see(sc.group);
        tr.see(layer.group);
        // water: every fjord arm within the 12 km far plane ahead has a surface
        const drawn = waterReaches(m.coast!, z, SEA_SLOTS);
        for (const r of m.coast!.reaches(z, z + 12000)) expect(drawn.some((d) => d.index === r.index), `arm ${r.index} at z=${z}`).toBe(true);
      }
      sc.pump?.(SCENERY_BUDGET_MS);
      const cam = new THREE.Vector3(m.routeX(z), m.heightAt(m.routeX(z), z) + 3, z - 6);
      sc.update(1 / 60, t, { focus: cam, camPos: cam, origin });
      layer.pump(HAZARD_VIEW_BUDGET_MS, z);
      layer.update(1 / 60, z);
      peak.viewQueue = Math.max(peak.viewQueue!, layer.pendingCount);
      const st = sc.stats!();
      peak.chunks = Math.max(peak.chunks, st['chunks']!);
      peak.pending = Math.max(peak.pending, st['pending']!);
      peak.views = Math.max(peak.views, layer.liveCount);
      peak.lodges = Math.max(peak.lodges, lodges.size);
    }
    console.info(`fjord endless ${KM} km: shelters ${shelters}, peak ${JSON.stringify(peak)}, hazard views created ${layer.stats.created}`);
    expect(shelters).toBeGreaterThan(15);
    expect(peak.lights).toBe(0); // shelters stream in and out: no lights (no mid-run recompiles)
    expect(peak.chunks).toBeLessThanOrEqual(13);
    expect(peak.pending).toBeLessThanOrEqual(12);
    expect(peak.views).toBeLessThan(60);
    expect(peak.lodges).toBeLessThanOrEqual(2);
    expect(layer.stats.created).toBeGreaterThan(500);
    // teardown, as World.dispose does
    for (const r of lodges.values()) r.dispose();
    layer.dispose();
    env.dispose();
    sc.dispose();
    expect(layer.stats.created).toBe(layer.stats.disposed);
    const u = tr.undisposed();
    expect(u.totalGeos).toBeGreaterThan(1000);
    expect(u.geos).toBe(0);
    // module-level singletons (hazard view materials, sign/particle textures) are shared by design
    console.info(`resources: ${JSON.stringify(u)}`);
    expect(u.mats).toBeLessThanOrEqual(6);
    expect(u.texs).toBeLessThanOrEqual(3);
  }, 600_000);
});
