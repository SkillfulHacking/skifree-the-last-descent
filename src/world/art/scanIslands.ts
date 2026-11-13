/**
 * Islands and skerries from photo-scanned CC0 rock (round 6: methodology change).
 *
 * Three rounds of tuning the heightfield islands (domes, archetype profiles, crags) never got past
 * "loaves / saucers" on screen: the far terrain tiles (32–64 m) cannot carry a craggy silhouette.
 * Here every island of the coast's cluster layout (Coast.islandBlobs: positions, long axis, size,
 * height and archetype, unchanged and deterministic) is drawn as a scaled, real rock scan from
 * Poly Haven — a cliff block for the high islands, boulders for the whalebacks, a rock cluster for
 * the skerries — sunk into the water, with the shared triplanar rock material (scanned rock detail,
 * snow on the flatter tops, a wet band and foam at the waterline). Geology is roughly scale
 * invariant, so a 2 m boulder scan reads as a 300 m glaciated island. The heightfield keeps only
 * the fjord bed there (Coast.MESH_ISLANDS).
 *
 * Models: src/world/art/models/*.skm, made by tools/artbake/scan_to_skm.mjs from the Poly Haven glTF
 * (simplified to 5k triangles, quantised). Provenance: docs/ASSETS_AND_LICENSES.md.
 * Loaded lazily (one small fetch each), shared by every island, disposed with the set.
 */
import * as THREE from 'three';
import type { Mountain } from '../course';
import { createRockMaterial, disposeRockMaterial } from './rockMaterial';

type ModelId = 'mountainside' | 'namaqualand_cliff_02' | 'namaqualand_boulder_02' | 'namaqualand_boulder_06' | 'boulder_01' | 'namaqualand_boulders_01';

const URLS: Record<ModelId, string> = {
  mountainside: new URL('./models/mountainside.skm', import.meta.url).href,
  namaqualand_cliff_02: new URL('./models/namaqualand_cliff_02.skm', import.meta.url).href,
  namaqualand_boulder_02: new URL('./models/namaqualand_boulder_02.skm', import.meta.url).href,
  namaqualand_boulder_06: new URL('./models/namaqualand_boulder_06.skm', import.meta.url).href,
  boulder_01: new URL('./models/boulder_01.skm', import.meta.url).href,
  namaqualand_boulders_01: new URL('./models/namaqualand_boulders_01.skm', import.meta.url).href,
};

/** archetype → candidate scans (picked per island by its seed) */
const BY_KIND: Record<0 | 1 | 2, ModelId[]> = {
  0: ['namaqualand_boulders_01', 'namaqualand_boulder_06'],
  1: ['namaqualand_boulder_02', 'boulder_01', 'namaqualand_boulder_06'],
  2: ['mountainside', 'namaqualand_cliff_02'],
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

export class ScanIslands {
  readonly group = new THREE.Group();
  private geos = new Map<ModelId, THREE.BufferGeometry>();
  private loading = new Set<ModelId>();
  private mats = new Map<number, THREE.MeshStandardMaterial>();
  private live = new Map<string, THREE.Mesh>();
  private win: [number, number] = [1, 0];
  private disposed = false;

  constructor(
    private readonly m: Mountain,
    private readonly quality: string,
  ) {
    this.group.name = 'fjord-scan-islands';
  }

  private material(water: number): THREE.MeshStandardMaterial {
    const key = Math.round(water * 10) / 10;
    let mt = this.mats.get(key);
    if (!mt) {
      mt = createRockMaterial({ kind: 'rock_face_03', tile: 14, water: key, snow: 1, strata: 0.6, snowFrom: 0.62, hq: this.quality !== 'low', grade: { lum: 0.07, desat: 0.94, tint: [0.92, 0.98, 1.08] }, macroSet: { kind: 'cliff_side', tile: 120, strength: 0.4 }, streaks: 0.8 });
      this.mats.set(key, mt);
    }
    return mt;
  }

  private load(id: ModelId): THREE.BufferGeometry | null {
    const g = this.geos.get(id);
    if (g) return g;
    if (!this.loading.has(id) && typeof fetch !== 'undefined' && typeof document !== 'undefined') {
      this.loading.add(id);
      fetch(URLS[id])
        .then((r) => r.arrayBuffer())
        .then((b) => {
          if (this.disposed) return;
          this.geos.set(id, decodeSkm(b));
          this.win = [1, 0]; // rebuild the window with the new model
        })
        .catch((e) => console.warn('island scan failed to load', id, e));
    }
    return null;
  }

  /** keep the islands of z in [z0, z1] (every x) in the scene */
  want(z0: number, z1: number): void {
    if (this.disposed || (z0 >= this.win[0] - 200 && z1 <= this.win[1] + 200 && this.win[1] > this.win[0])) return;
    this.win = [z0 - 1500, z1 + 1500];
    const c = this.m.coast;
    if (!c) return;
    const want = new Set<string>();
    for (const b of c.islandBlobs(this.win[0], this.win[1])) {
      const key = `${b.x.toFixed(1)}:${b.z.toFixed(1)}`;
      want.add(key);
      if (this.live.has(key)) continue;
      const list = BY_KIND[b.kind];
      const id = list[Math.floor(b.k * 7.31) % list.length]!;
      const g = this.load(id);
      if (!g) continue;
      const water = c.seaLevelAt(b.z);
      // only where the coast keeps an island (its low base stands out of the water there: not in the
      // harbour lane, the cliff-foot band or on land)
      const hc = this.m.heightAt(b.x, b.z);
      if (hc < water - 1 || hc > water + 2.5) continue;
      // and clear of the land all round (the finish's headlands: a scan beside one read as a giant
      // boulder parked in the harbour mouth)
      let landy = false;
      for (let k = 0; k < 10 && !landy; k++) {
        const a = (k / 10) * Math.PI * 2;
        const rx = Math.cos(a) * b.a * 1.6;
        const rz = Math.sin(a) * b.b * 1.6;
        if (this.m.heightAt(b.x + rx * b.c - rz * b.s, b.z + rx * b.s + rz * b.c) > water + 4) landy = true;
      }
      if (landy) continue;
      const mesh = new THREE.Mesh(g, this.material(water));
      // long axis along the cluster's grain; the scans' long axis is x
      mesh.rotation.y = -Math.atan2(b.s, b.c) + (b.k % 1 > 0.5 ? Math.PI : 0);
      const sink = b.kind === 0 ? 0.35 : 0.18;
      const h = b.h * (b.kind === 0 ? 1.8 : b.kind === 1 ? 1.6 : 1.3);
      mesh.scale.set(2.4 * b.a, h, 2.4 * b.b);
      mesh.position.set(b.x, water - sink * h, b.z);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.name = `island-${id}`;
      this.group.add(mesh);
      this.live.set(key, mesh);
    }
    for (const [k, mesh] of this.live)
      if (!want.has(k)) {
        mesh.removeFromParent();
        this.live.delete(k);
      }
  }

  get count(): number {
    return this.live.size;
  }

  dispose(): void {
    this.disposed = true;
    for (const mesh of this.live.values()) mesh.removeFromParent();
    this.live.clear();
    for (const g of this.geos.values()) g.dispose();
    this.geos.clear();
    for (const mt of this.mats.values()) disposeRockMaterial(mt);
    this.mats.clear();
  }
}
