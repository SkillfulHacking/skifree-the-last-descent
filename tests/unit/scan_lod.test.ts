/** Round 3 (R2 D N-1): the scanned boulders get a lighter LOD on medium/high; low keeps the procedural rock. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { decimateUnit, decodeSkm, SCAN_GRID, SCAN_ON } from '../../src/world/art/scanModels';

const load = async (id: string) => {
  const fs = (await import('node:fs' as string)) as { readFileSync: (p: string) => Uint8Array };
  const b = fs.readFileSync(`src/world/art/models/${id}.skm`);
  return decodeSkm(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
};

describe('scan LOD', () => {
  it('quality presets: low has no scans, ultra the high decimation (round 4, W-086: the full scan cost round 2\'s load)', () => {
    expect(SCAN_ON.low).toBe(false);
    expect(SCAN_GRID.ultra).toBe(SCAN_GRID.high);
  });
  for (const id of ['boulder_01', 'namaqualand_boulder_02', 'namaqualand_boulder_06']) {
    it(`${id}: high ≤ 1,600 and medium ≤ 1,100 triangles (from 5,000), same footprint and height`, async () => {
      const g = await load(id);
      const full = new THREE.Box3().setFromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute);
      for (const [q, max] of [['high', 1600], ['medium', 1100]] as const) {
        const d = decimateUnit(g, SCAN_GRID[q]);
        expect(d.getIndex()!.count / 3).toBeLessThanOrEqual(max);
        expect(d.getIndex()!.count / 3).toBeGreaterThan(400);
        const bb = new THREE.Box3().setFromBufferAttribute(d.getAttribute('position') as THREE.BufferAttribute);
        for (const a of ['x', 'y', 'z'] as const) {
          expect(Math.abs(bb.max[a] - full.max[a])).toBeLessThan(0.12);
          expect(Math.abs(bb.min[a] - full.min[a])).toBeLessThan(0.12);
        }
      }
    });
  }
});
