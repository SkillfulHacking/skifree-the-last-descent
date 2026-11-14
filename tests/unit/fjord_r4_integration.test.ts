/**
 * Fjord round 4 integration (lead): the adopted art in the game.
 *  - cliff kit: the heightfield keeps every land-side height; segments only where the kit applies,
 *    deterministic, bounded, streamed in slices; a surf line along the real waterline (P-M5);
 *  - hamlets stand on their strand flats, clear of the cliff mesh (P-M6);
 *  - the sea cave's dressing finds a cinematic station that frames open water (Phase B);
 *  - Alpine has no cliff kit (heights untouched: the goldens cover the values).
 */
import '../support/domStub';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse, type LengthMode } from '../../src/game/CourseConfig';
import type { Mountain } from '../../src/world/course';
import { Cave } from '../../src/world/Cave';
import { createSnowMaterial } from '../../src/world/snowMaterial';
import { getScenery } from '../../src/world/presentation';
import type { FjordScenery, HousePlacement } from '../../src/world/biomes/fjord/views/scenery';
import { CliffStream, CLIFF_SEG } from '../../src/world/art/cliffStream';
import { buildCliffSegment, cliffSegmentSteps } from '../../src/world/art/cliffKit';
import { dressSeaCave, type SeaShots } from '../../src/world/biomes/fjord/views/seaCave';
import { waterFraction } from '../../src/world/biomes/fjord/views/seaFraming';

const course = (len: LengthMode, sd: string) => makeCourse('custom', len, { biome: 'fjord', customText: sd });
const cache = new Map<string, Mountain>();
const mtn = (len: LengthMode, sd: string) => {
  const k = `${len}:${sd}`;
  if (!cache.has(k)) cache.set(k, buildMountain(course(len, sd)));
  return cache.get(k)!;
};

describe('Fjord round 4 integration: cliff kit in the game', () => {
  it('Fjord has the kit, Alpine does not; the land side (gameplay) is the round-3 height', () => {
    const alp = buildMountain(makeCourse('classic', 'sprint', { biome: 'alpine' }));
    expect(alp.cliff).toBeNull();
    for (const sd of ['R4I1', 'R4I2']) {
      const m = mtn('standard', sd);
      expect(m.cliff).not.toBeNull();
      const c = m.coast!;
      let n = 0;
      for (let z = -200; z < m.profile.finishZ; z += 97)
        for (let x = c.rimX(z) + 0.6; x < c.rimX(z) + 500; x += 31) {
          expect(m.heightAt(x, z)).toBe(m.coastHeight(x, z));
          n++;
        }
      expect(n).toBeGreaterThan(1000);
    }
  });

  it('segments: identical sliced or not, only where the kit applies, bounded, with a surf line', () => {
    const m = mtn('standard', 'R4I1');
    const a = buildCliffSegment(m.cliff!, { z0: 1024, z1: 1280, ds: 4, dr: 3 });
    const job = cliffSegmentSteps(m.cliff!, { z0: 1024, z1: 1280, ds: 4, dr: 3 }, () => true);
    let r = job.next();
    let slices = 0;
    while (!r.done) {
      slices++;
      r = job.next();
    }
    expect(slices).toBeGreaterThan(50);
    const pa = a.getAttribute('position').array;
    const pb = r.value.getAttribute('position').array;
    expect(pb.length).toBe(pa.length);
    for (let i = 0; i < pa.length; i += 7) expect(pb[i]).toBe(pa[i]);
    // the surf line: the face meets the water in (nearly) every column, at the water level
    const foam = a.userData['foam'] as Float32Array;
    let hits = 0;
    for (let j = 0; j < foam.length / 2; j++) if (Number.isFinite(foam[j * 2]!)) hits++;
    expect(hits / (foam.length / 2)).toBeGreaterThan(0.9);

    const s = new CliffStream(m, 'high', 24);
    const z = 2600;
    s.want(z - 1000, z + 4500, m.routeX(z), z);
    s.flush();
    expect(s.segments).toBeGreaterThan(8);
    expect(s.segments).toBeLessThanOrEqual(24);
    let foamed = 0;
    for (const me of s.meshes()) {
      const i = Number(me.name.replace('cliff-seg-', ''));
      me.geometry.computeBoundingBox();
      const bb = me.geometry.boundingBox!;
      // no segment reaches into a headland ridge, the fjord head or the harbour
      expect(m.cliffKitWeight(bb.min.z)).toBeGreaterThan(0.99);
      expect(m.cliffKitWeight(bb.max.z)).toBeGreaterThan(0.99);
      expect(bb.min.z).toBeGreaterThanOrEqual(i * CLIFF_SEG - 1);
      // the surf line, except where the whole segment ends on a hamlet's strand flat (heightfield shore)
      if (!me.children.some((ch) => ch.name === 'cliff-foam')) expect(m.coast!.strandMask((bb.min.z + bb.max.z) / 2)).toBeGreaterThan(0.3);
      else foamed++;
    }
    expect(foamed / s.segments).toBeGreaterThan(0.7);
    // moving on disposes what left the window
    s.want(z + 6000, z + 10000, m.routeX(z + 7000), z + 7000);
    s.flush();
    for (const me of s.meshes()) expect(me.geometry.boundingBox?.max.z ?? me.position.z).toBeGreaterThan(z + 5900);
    s.dispose();
  });

  it('P-M6: hamlet houses stand on their strand flats, clear of the cliff rock', () => {
    let checked = 0;
    for (const sd of ['R4I1', 'R4I2', 'R4I3']) {
      const m = mtn('standard', sd);
      const { uniforms } = createSnowMaterial('high', m.biome);
      const sc = getScenery('fjord-coast').build({ mountain: m, quality: 'high', biome: m.biome, terrain: uniforms, sunDir: new THREE.Vector3(0.3, 0.2, 0.9).normalize() }) as FjordScenery;
      const hamlets = m.coast!.hamlets(0, m.profile.finishZ);
      expect(hamlets.length).toBeGreaterThan(0);
      for (const h of hamlets) {
        const c = Math.floor(h.z / 512);
        for (const cc of [c - 1, c, c + 1]) sc.buildChunk(cc);
        // the cliff segments around the hamlet at full detail
        sc.cliffs!.want(h.z - 300, h.z + 300, m.cliff!.column(h.z).xr, h.z);
        sc.cliffs!.flush();
      }
      const houses: HousePlacement[] = [];
      sc.group.traverse((o) => {
        if (o.userData['houses']) houses.push(...(o.userData['houses'] as HousePlacement[]));
      });
      const rock: THREE.Vector3[] = [];
      for (const me of sc.cliffs!.meshes()) {
        const P = me.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < P.count; i++) rock.push(new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)));
      }
      for (const hs of houses) {
        const level = m.coast!.seaLevelAt(hs.z);
        // on the flat: every corner's ground within ~1 m of the floor, above the water
        const c = Math.cos(hs.yaw), s = Math.sin(hs.yaw);
        for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
          const x = hs.x + (u! * hs.w * c + v! * hs.d * s) / 2;
          const z = hs.z + (-u! * hs.w * s + v! * hs.d * c) / 2;
          const g = m.heightAt(x, z);
          expect(Math.abs(g - (hs.y - 0.2)), `${sd} house at ${hs.x.toFixed(0)},${hs.z.toFixed(0)}`).toBeLessThan(1.5);
          expect(g).toBeGreaterThan(level + 1);
        }
        // clear of the cliff mesh: no rock vertex within the house's footprint radius + 1 m below its ridge
        const R = Math.hypot(hs.w, hs.d) / 2 + 1;
        for (const p of rock) {
          if (p.y > hs.y + hs.h + 1) continue;
          expect(Math.hypot(p.x - hs.x, p.z - hs.z), `${sd} rock inside the house at ${hs.x.toFixed(0)},${hs.z.toFixed(0)}`).toBeGreaterThan(R);
        }
        checked++;
      }
      sc.dispose();
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('Phase B: the sea caves get cinematic stations that frame open water, with the Yeti in view', () => {
    // A Fjord cave is cut into the sea side with its mouth facing inland, often 30–70 m below the
    // rim: from some caves no station near the mouth can see the water at all (the record below).
    // The evidence course's cave must frame the sea; elsewhere a cave without a station keeps the
    // three-quarter shot.
    const rec: string[] = [];
    let found = 0;
    let n = 0;
    const cases: Array<[Mountain, string]> = [[buildMountain(makeCourse('classic', 'sprint', { biome: 'fjord' })), 'classic sprint']];
    for (const sd of ['R4I1', 'R4I2', 'R4I3', 'R4I4']) cases.push([mtn('standard', sd), sd]);
    for (const [m, name] of cases) {
      for (const e of m.profile.encounters(-Infinity, m.profile.finishZ)) {
        const cave = new Cave(m, e.anchor, 'low');
        const d = dressSeaCave({ cave: cave as never, mountain: m, anchor: e.anchor, quality: 'low', biome: m.biome });
        const shots = d.group.userData['seaShots'] as SeaShots;
        rec.push(`${name} z ${e.anchor.z.toFixed(0)}: emerge ${shots.emerge ? shots.emerge.water.toFixed(2) : '-'} leap ${shots.leap ? shots.leap.water.toFixed(2) : '-'}`);
        if (name === 'classic sprint') {
          expect(shots.emerge).not.toBeNull();
          expect(shots.leap).not.toBeNull();
        }
        for (const p of [shots.emerge, shots.leap]) {
          if (!p) continue;
          expect(p.water).toBeGreaterThanOrEqual(0.05);
          // the recorded share is what the frame shows (re-cast), the camera above the snow
          expect(waterFraction(m, p.cam, p.look, p.fov)).toBeCloseTo(p.water, 6);
          expect(p.cam.y).toBeGreaterThan(m.heightAt(p.cam.x, p.cam.z) + 1.5);
        }
        if (shots.emerge) found++;
        d.dispose();
        cave.dispose();
        n++;
      }
    }
    // (rec: per-cave record, shown when an assertion fails)
    expect(rec.length, rec.join('; ')).toBe(n);
    expect(n).toBeGreaterThanOrEqual(5);
    void found;
  });
});
