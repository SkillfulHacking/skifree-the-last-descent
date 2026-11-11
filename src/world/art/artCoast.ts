/**
 * The proposed coast as a Mountain: identical on the land side (gameplay: the piste, the cornice,
 * the caves, every physics query), different only beyond the rim crest, where the heightfield
 * becomes the hidden backing of the cliff kit (./cliffKit.ts) and the fjord bed without
 * heightfield islands (they are meshes now, ./islands.ts). The headland ridges between arms, the
 * far shore and the finish harbour stay as they are.
 *
 * Integration note: in the game this would be a branch of Coast.seaSide behind a biome flag
 * (terrain.coast.cliffKit = true), not a subclass; the subclass keeps the experiment isolated.
 */
import * as THREE from 'three';
import { Mountain } from '../course';
import type { CourseProfile } from '../profile';
import type { Biome } from '../biome';
import { CliffModel, type CoastFrame } from './cliffKit';
import { smoothstep } from './noise3';
import { buildIsland, layoutIslands, type IslandSpec } from './islands';
import { createRockMaterial, disposeRockMaterial } from './rockMaterial';
import { createFoliageMaterial, pineGeometry } from '../props';

export class ArtCoastMountain extends Mountain {
  readonly cliff: CliffModel;
  readonly frame: CoastFrame;

  constructor(profile: CourseProfile, seed: number, biome: Biome) {
    super(profile, seed, biome);
    const coast = this.coast!;
    this.frame = {
      seed,
      rimX: (z) => coast.rimX(z),
      landHeight: (x, z) => this.roundThreeHeight(x, z),
      waterLevel: (z) => coast.seaLevelAt(z),
    };
    this.cliff = new CliffModel(this.frame);
  }

  /** the unmodified (round-3) height */
  roundThreeHeight(x: number, z: number): number {
    return super.heightAt(x, z);
  }

  /** 0..1: how much of the proposed sea side applies at z (none at the headland ridges and the harbour) */
  private kitWeight(z: number): number {
    const c = this.coast!;
    let k = 1;
    for (const cr of c.crestsIn(z - 600, z + 600)) k = Math.min(k, smoothstep(260, 520, Math.abs(z - cr)));
    if (c.finite) k *= 1 - smoothstep(c.finishZ - 520, c.finishZ - 300, z);
    return k;
  }

  override heightAt(x: number, z: number): number {
    const h = super.heightAt(x, z);
    const c = this.coast;
    if (!c) return h;
    const t = c.beyondRim(x, z);
    if (t <= 0.5) return h;
    const k = this.kitWeight(z);
    if (k <= 0) return h;
    let out = this.cliff.backingHeight(z, t, this.biome.terrain.coast?.depth ?? 180);
    // the far shore (across the fjord) is unchanged
    const ef = -x - c.farShore(z);
    if (ef > -760) out = Math.max(out, h * smoothstep(-760, -620, ef) + out * (1 - smoothstep(-760, -620, ef)));
    return h + (out - h) * k;
  }
}

/** The island layout for a region (pure, deterministic). */
export function islandSpecs(m: ArtCoastMountain, region: { x0: number; x1: number; z0: number; z1: number }, seed = m.seed): IslandSpec[] {
  const c = m.coast!;
  const cliff = m.cliff;
  return layoutIslands({
    ...region,
    seed: seed ^ 0x15a1,
    waterAt: (z) => c.seaLevelAt(z),
    allowed: (x, z, r) => {
      const col = cliff.column(z);
      const foot = col.xr - cliff.footOffset(col);
      // clear water between the cliff foot and the island, and well short of the far shore
      return x < foot - 140 - r && -x < c.farShore(z) - 650 - r;
    },
  });
}

/** Island meshes + instanced pines for a region (bounded: at most `max` islands). */
export class IslandSet {
  readonly group = new THREE.Group();
  readonly specs: IslandSpec[];
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private uTime = { value: 0 };
  triangles = 0;

  constructor(m: ArtCoastMountain, region: { x0: number; x1: number; z0: number; z1: number }, opts: { max?: number; seed?: number } = {}) {
    this.group.name = 'art-islands';
    this.specs = islandSpecs(m, region, opts.seed ?? m.seed).slice(0, opts.max ?? 40);
    const byWater = new Map<number, THREE.MeshStandardMaterial>();
    const trees: THREE.Vector3[] = [];
    for (const sp of this.specs) {
      const { geometry, trees: tr } = buildIsland(sp);
      let mat = byWater.get(sp.water);
      if (!mat) {
        mat = createRockMaterial({ kind: 'gneiss', vertexColors: true, water: sp.water, snow: 1, strata: 0.45 });
        byWater.set(sp.water, mat);
        this.mats.push(mat);
      }
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `island-${sp.kind}`;
      this.group.add(mesh);
      this.geos.push(geometry);
      this.triangles += (geometry.index?.count ?? 0) / 3;
      trees.push(...tr);
    }
    if (trees.length) {
      const geo = pineGeometry(1, false, m.biome);
      const mat = createFoliageMaterial(this.uTime, false, m.biome);
      const inst = new THREE.InstancedMesh(geo, mat, trees.length);
      const mtx = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      for (let i = 0; i < trees.length; i++) {
        const p = trees[i]!;
        const s = 0.8 + ((Math.sin(p.x * 12.9898 + p.z * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.9;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.x * 0.37 + p.z * 0.11);
        mtx.compose(p, q, new THREE.Vector3(s, s * 1.1, s));
        inst.setMatrixAt(i, mtx);
      }
      inst.castShadow = true;
      inst.name = 'island-pines';
      this.group.add(inst);
      this.geos.push(geo);
      this.mats.push(mat);
      this.triangles += ((geo.index?.count ?? geo.getAttribute('position').count) / 3) * trees.length;
    }
  }

  get drawCalls(): number {
    return this.group.children.length;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) {
      if ((m as THREE.MeshStandardMaterial).userData['kind']) disposeRockMaterial(m as THREE.MeshStandardMaterial);
      else m.dispose();
    }
    this.group.removeFromParent();
  }
}
