/**
 * Shared loader for the scanned CC0 rock models (src/world/art/models/*.skm, see ./scanIslands.ts and
 * docs/ASSETS_AND_LICENSES.md). Each model is fetched once and decoded into a unit geometry
 * (footprint x, z in [-0.5, 0.5], y in [0, 1]) shared by every user; nothing is fetched without a
 * DOM (Node tests). Geometries live for the session (six small meshes, ~45 KB each).
 */
import * as THREE from 'three';
import { decodeSkm } from './scanIslands';

export type ScanId = 'mountainside' | 'namaqualand_boulder_02' | 'namaqualand_boulder_06' | 'boulder_01';

const URLS: Record<ScanId, string> = {
  mountainside: new URL('./models/mountainside.skm', import.meta.url).href,
  namaqualand_boulder_02: new URL('./models/namaqualand_boulder_02.skm', import.meta.url).href,
  namaqualand_boulder_06: new URL('./models/namaqualand_boulder_06.skm', import.meta.url).href,
  boulder_01: new URL('./models/boulder_01.skm', import.meta.url).href,
};

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
