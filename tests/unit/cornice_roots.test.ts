/** Round 3 (R2 D N-2): the cornice roots come from a pre-gathered triangle list, matching three's Raycaster. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { browTriangles, rayTris } from '../../src/world/biomes/whiteout/views/stormCave';

describe('cornice roots without a per-column raycast of the whole rock', () => {
  it('gives the same hits as Raycaster on a 40k-triangle rock, and is far cheaper', () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(10, 200, 100), new THREE.MeshBasicMaterial());
    rock.position.set(3, 2, -4);
    rock.rotation.set(0.3, 0.7, 0.1);
    rock.scale.set(1.4, 0.9, 1.1);
    rock.updateWorldMatrix(true, false);
    const out = new THREE.Vector3(0.6, 0, 0.8).normalize();
    const along = new THREE.Vector3(out.z, 0, -out.x);
    const lip = new THREE.Vector3(3, 2, -4).addScaledVector(out, 9);
    const y = 4;
    const t0 = performance.now();
    const tris = browTriangles(rock, lip, along, out, y, 8);
    const gather = performance.now() - t0;
    const ray = new THREE.Raycaster();
    let mine = 0;
    let theirs = 0;
    for (let i = 0; i <= 28; i++) {
      const o = lip.clone().addScaledVector(along, (i / 28 - 0.5) * 14).addScaledVector(out, 8);
      o.y = y;
      const dir = out.clone().negate();
      const ta = performance.now();
      const t = rayTris(o, dir, tris, 16);
      mine += performance.now() - ta;
      const tb = performance.now();
      ray.set(o, dir);
      ray.far = 16;
      const hit = ray.intersectObject(rock, false)[0];
      theirs += performance.now() - tb;
      if (!hit) expect(t).toBeNull();
      else expect(t).toBeCloseTo(hit.distance, 4);
    }
    expect(gather + mine).toBeLessThan(theirs);
    expect(tris.length / 9).toBeLessThan(rock.geometry.getIndex()!.count / 3 / 10);
    (globalThis as { process?: { stdout: { write(s: string): void } } }).process?.stdout.write(`\ncornice roots: gather ${gather.toFixed(1)} ms (rays ${mine.toFixed(2)} ms) vs Raycaster ${theirs.toFixed(1)} ms, ${tris.length / 9} triangles kept\n`);
  });
});
