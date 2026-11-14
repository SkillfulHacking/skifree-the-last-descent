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
