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
import { loadScan, type ScanId } from './scanModels';

type ModelId = ScanId;

/** archetype → candidate scans (picked per island by its seed) */
const BY_KIND: Record<0 | 1 | 2, ModelId[]> = {
  // (round 8: not the stone-cluster scan — scaled up its thin flat stones read as folded white paper)
  0: ['namaqualand_boulder_06', 'boulder_01'],
  1: ['namaqualand_boulder_02', 'boulder_01', 'namaqualand_boulder_06'],
  // (round 8: no terrain-patch scans — the cliff slab and the mountainside, stretched to island size,
  // read as white folded slabs and crumpled ribbons on the sea in 06 and the menu, A7-M1; a pixel
  // probe named each. The big islands are the boulder scans, kept rounder: ≤ 1:3)
  2: ['namaqualand_boulder_02', 'boulder_01', 'namaqualand_boulder_06'],
};

export { decodeSkm } from './scanModels';

/** one island blob, decided once: where it stands and as which model (null: rejected) */
interface Placement {
  id: ModelId;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  water: number;
}

/**
 * The scanned islands of the coast. Round 9 (D r8 #1: want() placed the whole window in one frame,
 * 45–66 ms CPU every ~4 km, outside the frame budget): want() only queues the blobs that came into
 * the window; pump() places them under the scenery's slice; each blob's decision (11 coast-height
 * probes) is made once and remembered; the scans come from the shared loader (one fetch each, D r8
 * #5) and are session-lifetime (never disposed here); materials no live island uses are freed
 * (D r8 #4: they grew 5 → 15 over 40 km of Endless).
 */
export class ScanIslands {
  readonly group = new THREE.Group();
  private geos = new Map<ModelId, THREE.BufferGeometry>();
  private mats = new Map<number, THREE.MeshStandardMaterial>();
  private live = new Map<string, THREE.Mesh>();
  private decided = new Map<string, Placement | null>();
  private queue: Array<{ key: string; b: ReturnType<NonNullable<Mountain['coast']>['islandBlobs']>[number] }> = [];
  private win: [number, number] = [1, 0];
  private disposed = false;

  constructor(
    private readonly m: Mountain,
    private readonly quality: string,
  ) {
    this.group.name = 'fjord-scan-islands';
    const ids = new Set<ModelId>(([0, 1, 2] as const).flatMap((k) => BY_KIND[k]));
    for (const id of ids)
      void loadScan(id).then((g) => {
        if (this.disposed || !g) return;
        this.geos.set(id, g);
        // islands decided for this model but not yet shown: show them now
        for (const [key, pl] of this.decided) if (pl && pl.id === id && !this.live.has(key) && pl.z >= this.win[0] && pl.z <= this.win[1]) this.show(key, pl);
      });
  }

  private material(water: number): THREE.MeshStandardMaterial {
    const key = Math.round(water * 10) / 10;
    let mt = this.mats.get(key);
    if (!mt) {
      mt = createRockMaterial({ kind: 'rock_face_03', tile: 14, water: key, snow: 0.6, strata: 0.6, snowFrom: 0.8, hq: this.quality !== 'low', grade: { lum: 0.07, desat: 0.94, tint: [0.92, 0.98, 1.08] }, macroSet: { kind: 'cliff_side', tile: 120, strength: 0.4 }, streaks: 0.8 });
      this.mats.set(key, mt);
    }
    return mt;
  }

  /** keep the islands of z in [z0, z1] (every x) in the scene: queues new ones, drops far ones */
  want(z0: number, z1: number): void {
    if (this.disposed || (z0 >= this.win[0] - 200 && z1 <= this.win[1] + 200 && this.win[1] > this.win[0])) return;
    this.win = [z0 - 1500, z1 + 1500];
    const c = this.m.coast;
    if (!c) return;
    const want = new Set<string>();
    this.queue = [];
    for (const b of c.islandBlobs(this.win[0], this.win[1])) {
      const key = `${b.x.toFixed(1)}:${b.z.toFixed(1)}`;
      want.add(key);
      if (this.live.has(key)) continue;
      if (this.decided.has(key)) {
        const pl = this.decided.get(key)!;
        if (pl && this.geos.has(pl.id)) this.queue.push({ key, b });
        continue;
      }
      this.queue.push({ key, b });
    }
    let dropped = false;
    for (const [k, mesh] of this.live)
      if (!want.has(k)) {
        mesh.removeFromParent();
        this.live.delete(k);
        dropped = true;
      }
    // forget decisions far outside the window (bounded memory over a long Endless run)
    if (this.decided.size > 600) for (const k of this.decided.keys()) if (!want.has(k)) this.decided.delete(k);
    if (dropped) this.freeMaterials();
  }

  /** place queued islands until `deadlineMs` (performance.now() value) */
  pump(deadlineMs: number): void {
    while (this.queue.length && performance.now() < deadlineMs) {
      const { key, b } = this.queue.shift()!;
      if (this.live.has(key)) continue;
      let pl = this.decided.get(key);
      if (pl === undefined) {
        pl = this.decide(b);
        this.decided.set(key, pl);
      }
      if (pl && this.geos.has(pl.id)) this.show(key, pl);
    }
  }

  /** place every queued island now (loading screen, tests) */
  flush(): void {
    this.pump(Infinity);
  }

  get pending(): number {
    return this.queue.length;
  }

  private decide(b: ReturnType<NonNullable<Mountain['coast']>['islandBlobs']>[number]): Placement | null {
    const c = this.m.coast!;
    const list = BY_KIND[b.kind];
    const id = list[Math.floor(b.k * 7.31) % list.length]!;
    const water = c.seaLevelAt(b.z);
    // only where the coast keeps an island (its low base stands out of the water there: not in the
    // harbour lane, the cliff-foot band or on land)
    const hc = this.m.heightAt(b.x, b.z);
    // (the coast leaves a shoal ~8 m under the water where an island stands)
    if (hc < water - 11 || hc > water + 1) return null;
    // and clear of the land all round (the finish's headlands: a scan beside one read as a giant
    // boulder parked in the harbour mouth)
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const rx = Math.cos(a) * b.a * 1.25;
      const rz = Math.sin(a) * b.b * 1.25;
      if (this.m.heightAt(b.x + rx * b.c - rz * b.s, b.z + rx * b.s + rz * b.c) > water + 15) return null;
    }
    // long axis along the cluster's grain; the scans' long axis is x
    const yaw = -Math.atan2(b.s, b.c) + (b.k % 1 > 0.5 ? Math.PI : 0);
    const sink = b.kind === 0 ? 0.35 : 0.18;
    const h = b.h * (b.kind === 0 ? 2.5 : b.kind === 1 ? 1.6 : 1.3);
    // (skerries: a smaller footprint — stretched to the cluster's ellipse they flattened into white
    // snow-topped plates)
    const f = b.kind === 0 ? 0.9 : 2.4;
    // never flatter than 1:4 (round 7, A r6 M1), the big ones 1:3 (round 8)
    const cap = b.kind === 2 ? 3 : 4;
    return { id, x: b.x, y: water - sink * h, z: b.z, sx: Math.min(f * b.a, cap * h), sy: h, sz: Math.min(f * b.b, cap * h), yaw, water };
  }

  private show(key: string, pl: Placement): void {
    const g = this.geos.get(pl.id);
    if (!g || this.disposed) return;
    const mesh = new THREE.Mesh(g, this.material(pl.water));
    mesh.rotation.y = pl.yaw;
    mesh.scale.set(pl.sx, pl.sy, pl.sz);
    mesh.position.set(pl.x, pl.y, pl.z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = `island-${pl.id}`;
    this.group.add(mesh);
    this.live.set(key, mesh);
  }

  private freeMaterials(): void {
    const used = new Set<THREE.Material>();
    for (const mesh of this.live.values()) used.add(mesh.material as THREE.Material);
    for (const [k, mt] of this.mats)
      if (!used.has(mt)) {
        disposeRockMaterial(mt);
        this.mats.delete(k);
      }
  }

  get count(): number {
    return this.live.size;
  }

  dispose(): void {
    this.disposed = true;
    for (const mesh of this.live.values()) mesh.removeFromParent();
    this.live.clear();
    // (the scan geometries are shared and session-lifetime: scanModels.ts)
    this.geos.clear();
    this.queue = [];
    for (const mt of this.mats.values()) disposeRockMaterial(mt);
    this.mats.clear();
  }
}
