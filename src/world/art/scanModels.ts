/**
 * Shared loader for the scanned CC0 rock models (src/world/art/models/*.skm, see ./scanIslands.ts and
 * docs/ASSETS_AND_LICENSES.md). Each model is fetched once and decoded into a unit geometry
 * (footprint x, z in [-0.5, 0.5], y in [0, 1]) shared by every user; nothing is fetched without a
 * DOM (Node tests). Geometries live for the session (six small meshes, ~45 KB each).
 */
import * as THREE from 'three';

export type ScanId = 'namaqualand_boulder_02' | 'namaqualand_boulder_06' | 'boulder_01';

const URLS: Record<ScanId, string> = {
  namaqualand_boulder_02: new URL('./models/namaqualand_boulder_02.skm', import.meta.url).href,
  namaqualand_boulder_06: new URL('./models/namaqualand_boulder_06.skm', import.meta.url).href,
  boulder_01: new URL('./models/boulder_01.skm', import.meta.url).href,
};

/** Decode an .skm (see the tool) into a unit geometry: footprint x,z in [-0.5, 0.5], y in [0, 1]. */
export function decodeSkm(buf: ArrayBuffer): THREE.BufferGeometry {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'SKM1') throw new Error('not an SKM1 mesh');
  const vc = dv.getUint32(4, true);
  const ic = dv.getUint32(8, true);
  const q = new Uint16Array(buf, 36, vc * 3);
  const pos = new Float32Array(vc * 3);
  for (let i = 0; i < vc * 3; i++) {
    const a = i % 3;
    const t = q[i]! / 65535;
    pos[i] = a === 1 ? t : t - 0.5;
  }
  let o = 36 + vc * 6;
  const big = vc >= 65536;
  if (big && o % 4) o += 4 - (o % 4);
  const idx = big ? new Uint32Array(buf.slice(o, o + ic * 4)) : new Uint16Array(buf.slice(o, o + ic * 2));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * A lighter copy of a unit scan by vertex clustering (round 3, R2 D N-1: the 5,000-triangle scans put
 * ~5× Alpine's triangle load on the GPU): vertices snap to an n³ grid over the unit box, each cell's
 * vertices merge to their mean, and collapsed triangles are dropped. Pure, O(vertices).
 */
export function decimateUnit(g: THREE.BufferGeometry, n: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const idx = g.getIndex();
  const cellOf = new Int32Array(pos.count);
  const map = new Map<number, number>();
  const sum: number[] = [];
  const cnt: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = Math.min(n - 1, Math.floor((pos.getX(i) + 0.5) * n));
    const y = Math.min(n - 1, Math.floor(pos.getY(i) * n));
    const z = Math.min(n - 1, Math.floor((pos.getZ(i) + 0.5) * n));
    const key = (x * n + y) * n + z;
    let c = map.get(key);
    if (c === undefined) {
      c = cnt.length;
      map.set(key, c);
      cnt.push(0);
      sum.push(0, 0, 0);
    }
    cellOf[i] = c;
    cnt[c]!++;
    sum[c * 3] += pos.getX(i);
    sum[c * 3 + 1] += pos.getY(i);
    sum[c * 3 + 2] += pos.getZ(i);
  }
  const out = new Float32Array(cnt.length * 3);
  for (let c = 0; c < cnt.length; c++) for (let a = 0; a < 3; a++) out[c * 3 + a] = sum[c * 3 + a]! / cnt[c]!;
  const tris: number[] = [];
  const seen = new Set<string>();
  const nTri = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < nTri; t++) {
    const a = cellOf[idx ? idx.getX(t * 3) : t * 3]!;
    const b = cellOf[idx ? idx.getX(t * 3 + 1) : t * 3 + 1]!;
    const c = cellOf[idx ? idx.getX(t * 3 + 2) : t * 3 + 2]!;
    if (a === b || b === c || a === c) continue;
    const k = [a, b, c].sort((p, q) => p - q).join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    tris.push(a, b, c);
  }
  const d = new THREE.BufferGeometry();
  d.setAttribute('position', new THREE.BufferAttribute(out, 3));
  d.setIndex(tris);
  d.computeVertexNormals();
  d.computeBoundingSphere();
  return d;
}

/** grid resolution of the scan LOD per quality preset (0 = the full scan; ~850 / ~1,200 / 5,000 triangles) */
export const SCAN_GRID = { low: 0, medium: 10, high: 12, ultra: 0 } as const;
/** quality presets that use the scans at all (low keeps the procedural rock) */
export const SCAN_ON = { low: false, medium: true, high: true, ultra: true } as const;

const cache = new Map<ScanId, Promise<THREE.BufferGeometry | null>>();

/** the unit geometry of a scan (null without a DOM or when it fails to load) */
export function loadScan(id: ScanId): Promise<THREE.BufferGeometry | null> {
  let p = cache.get(id);
  if (!p) {
    p =
      typeof document === 'undefined' || typeof fetch === 'undefined'
        ? Promise.resolve(null)
        : fetch(URLS[id])
            .then((r) => r.arrayBuffer())
            .then((b) => decodeSkm(b))
            .catch((e) => {
              console.warn('rock scan failed to load', id, e);
              return null;
            });
    cache.set(id, p);
  }
  return p;
}
