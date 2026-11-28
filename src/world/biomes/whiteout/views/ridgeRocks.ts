/**
 * Whiteout Ridge: wind-carved rock on the ridge (scanned CC0 boulders, art/scanModels.ts).
 *
 * Three families, placed deterministically per 256 m chunk:
 *  - crest tors: clusters of 2–4 frost-shattered blocks along the broken crest (crest side, where the
 *    crest tops out), the skyline seen across the piste;
 *  - rim bands: where the cornice breaks off (CORNICE breaks), a band of rock just beyond the rim
 *    (past the rim: never inside the skiable area, so they need no collider — a skier there has
 *    already gone over and is returned by the rim guard);
 *  - flank buttresses: big slabs half-buried in the upper flank below the rim, seen when the course
 *    swings toward the edge or in the clear windows;
 *  - rim spires (W-065): towers rooted on the flank just past the rim, standing above it — the drop's
 *    sign from the racing line.
 *
 * Every block is bedded on the slope it stands on: its base is tilted to the ground plane fitted under
 * its footprint (most of the way: a little lean of its own is kept), sunk 25–40 % of its height below
 * the ground at its centre, and lowered further if any point of its base would stand above the snow,
 * so no block shows a gap underneath. (Bedded at the LOWEST point of the footprint without the tilt,
 * a block on the 30–40° crest slopes was buried metres deep on its uphill side: from the course the
 * tors read as flat pale plates of snow-capped rock — dev renders 08/10/11.) Shared triplanar PBR rock material, graded
 * dark (granite/schist), snow on surfaces flatter than ~40°.
 */
import * as THREE from 'three';
import { fbm, hash2 } from '../../../../core/rng';
import type { Mountain } from '../../../course';
import { createRockMaterial, disposeRockMaterial } from '../../../art/rockMaterial';
import { decimateUnit, loadScan, type ScanId } from '../../../art/scanModels';
import { corniceSamples } from './cornice';

/** (W-065) the rim spires: spacing (m), rise above the rim (m: min + random extra), share left out */
// (Round 6, art direction C chosen by blind read: the rim traced by a chain of spires reads as the edge,
// 8/10 in clear weather against 6/10 for the round-5 look) close-set, taller, varied
export const RIM_SPIRES = { every: 45, rise: [10, 20] as [number, number], skip: 0.08 };

export const RIDGE_ROCK_IDS: ScanId[] = ['namaqualand_boulder_02', 'boulder_01', 'namaqualand_boulder_06'];

export interface RockPlacement {
  id: ScanId;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  tilt: number;
  family: 'tor' | 'rim' | 'flank' | 'spire';
  /** orientation (x, y, z, w): yaw, the block's own lean, then tilted onto the ground plane */
  q: [number, number, number, number];
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _n = new THREE.Vector3();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
/** how far a block is turned onto its ground plane (1 = fully) */
const SLOPE_FOLLOW = 0.8;
const RING = 12;

/**
 * Seat a block on the ground: orientation (yaw, lean, then onto the fitted ground plane) and the base
 * height (sunk `sink`·sy at the centre, and below the snow at every point of the footprint's rim).
 */
function seat(m: Mountain, x: number, z: number, sx: number, sy: number, sz: number, yaw: number, tilt: number, sink: number) {
  const a = Math.max(2, 0.5 * Math.max(sx, sz));
  const gx = (m.heightAt(x + a, z) - m.heightAt(x - a, z)) / (2 * a);
  const gz = (m.heightAt(x, z + a) - m.heightAt(x, z - a)) / (2 * a);
  _n.set(-gx, 1, -gz).normalize().lerp(UP, 1 - SLOPE_FOLLOW).normalize();
  _qa.setFromUnitVectors(UP, _n);
  _e.set(0, yaw, tilt, 'YXZ');
  _q.setFromEuler(_e).premultiply(_qa);
  let y = m.heightAt(x, z) - sink * sy;
  // the footprint's rim (the scans fill [-0.5, 0.5]² at their base): never above the snow
  for (let i = 0; i < RING; i++) {
    const t = (i / RING) * Math.PI * 2;
    _v.set(Math.cos(t) * 0.5 * sx, 0, Math.sin(t) * 0.5 * sz).applyQuaternion(_q);
    const over = y + _v.y - m.heightAt(x + _v.x, z + _v.z);
    if (over > 0) y -= over;
  }
  return { y, q: [_q.x, _q.y, _q.z, _q.w] as [number, number, number, number] };
}

/** a block's base points (for the tests): the footprint rim, in world space */
export function rockBaseRing(p: RockPlacement): [number, number, number][] {
  const q = new THREE.Quaternion(...p.q);
  const out: [number, number, number][] = [];
  for (let i = 0; i < RING; i++) {
    const t = (i / RING) * Math.PI * 2;
    const v = new THREE.Vector3(Math.cos(t) * 0.5 * p.sx, 0, Math.sin(t) * 0.5 * p.sz).applyQuaternion(q);
    out.push([p.x + v.x, p.y + v.y, p.z + v.z]);
  }
  return out;
}


/** placements in [z0, z1) (pure; tests check bedding and that none is on the piste) */
export function ridgeRockPlacements(m: Mountain, z0: number, z1: number): RockPlacement[] {
  const R = m.biome.terrain.ridge;
  const out: RockPlacement[] = [];
  if (!R) return out;
  const s = m.seed;
  const P = m.profile;
  const end = Number.isFinite(m.finishZ) ? m.finishZ - 240 : Infinity;
  const pick = (k: number) => RIDGE_ROCK_IDS[Math.floor(hash2(k, 5, s) * RIDGE_ROCK_IDS.length) % RIDGE_ROCK_IDS.length]!;
  const add = (pl: Omit<RockPlacement, 'y' | 'q'>, sink: number) => {
    const st = seat(m, pl.x, pl.z, pl.sx, pl.sy, pl.sz, pl.yaw, pl.tilt, sink);
    // on broken ground (flank ribs and gullies) a block can still end up mostly buried: leave it out
    // rather than show a sliver
    _v.set(0, 1, 0).applyQuaternion(_q.set(...st.q));
    if (st.y + _v.y * pl.sy - m.heightAt(pl.x + _v.x * pl.sy, pl.z + _v.z * pl.sy) < 0.35 * pl.sy) return;
    out.push({ ...pl, ...st });
  };
  // crest tors (the crest side is −dropSide)
  const cs = -R.dropSide as 1 | -1;
  const TOR = 70;
  for (let z = Math.ceil(z0 / TOR) * TOR; z < z1 && z < end; z += TOR) {
    if (z < 80) continue;
    const k = Math.round(z / TOR);
    if (hash2(k, 1, s) < 0.3) continue; // gaps along the crest
    // not over a cave (the cave builds its own rock there)
    if (m.cavesNear(z - 90, z + 90).some((c) => Math.abs(c.z - z) < 90)) continue;
    const w = P.halfWidth(z);
    const e = Math.max(w, w * P.sideSetback(z, cs));
    const zz = z + (hash2(k, 2, s) - 0.5) * 40;
    const x0 = P.centerX(zz) + cs * (e + R.crestE * (0.75 + 0.35 * hash2(k, 3, s)));
    const n = 2 + Math.floor(hash2(k, 4, s) * 3);
    for (let j = 0; j < n; j++) {
      const big = 7 + 10 * hash2(k * 7 + j, 6, s);
      const x = x0 + cs * (hash2(k * 7 + j, 7, s) - 0.5) * 22;
      const z2 = zz + (hash2(k * 7 + j, 8, s) - 0.5) * 26;
      add({ id: pick(k * 7 + j), x, z: z2, sx: big * (0.9 + 0.5 * hash2(k * 7 + j, 9, s)), sy: big * (0.55 + 0.6 * hash2(k * 7 + j, 10, s)), sz: big * (0.8 + 0.5 * hash2(k * 7 + j, 11, s)), yaw: hash2(k * 7 + j, 12, s) * Math.PI * 2, tilt: (hash2(k * 7 + j, 13, s) - 0.5) * 0.35, family: 'tor' }, 0.3);
    }
  }
  // rim bands where the cornice breaks
  const S = corniceSamples(m, z0, z1);
  // (round 4, W-065 blind review: "the snow just stops against haze — no lip") a near-continuous band of
  // low, wide, dark wind-scoured rock along the rim itself: from the line it is the dark edge where the
  // snow ends, seen against the bright distance beyond
  for (let i = 0; i < S.length; i += 2) {
    const c = S[i]!;
    if (c.k > 0.1) continue;
    const k = Math.round(c.z);
    if (hash2(k, 21, s) < 0.12) continue;
    const big = 3 + 3.5 * hash2(k, 22, s);
    add({ id: pick(k), x: c.x + R.dropSide * (0.6 + 1.6 * hash2(k, 23, s)), z: c.z, sx: big * 1.7, sy: big * (0.45 + 0.25 * hash2(k, 24, s)), sz: big * 1.2, yaw: hash2(k, 25, s) * Math.PI * 2, tilt: R.dropSide * 0.25, family: 'rim' }, 0.35);
  }
  // flank buttresses
  const FL = 150;
  for (let z = Math.ceil(z0 / FL) * FL; z < z1 && z < end + 200; z += FL) {
    const k = Math.round(z / FL);
    if (0.5 + 0.5 * fbm(z / 400, 1.7, s + 71, 2) < 0.45) continue;
    const rim = m.ridgeRimX(z);
    const out1 = 70 + 220 * hash2(k, 31, s);
    const big = 16 + 22 * hash2(k, 32, s);
    add({ id: pick(k + 999), x: rim + R.dropSide * out1, z: z + (hash2(k, 33, s) - 0.5) * 80, sx: big * 1.4, sy: big * 0.8, sz: big, yaw: hash2(k, 34, s) * Math.PI * 2, tilt: R.dropSide * 0.45, family: 'flank' }, 0.4);
  }
  // (W-065) rim spires: rock towers rooted on the flank just past the rim, rising above it — from the
  // racing line (40+ m away, the camera 2–3 m above the snow) the flank itself can never be seen, so
  // the drop reads through what stands up out of it: dark rock standing beyond the snow edge with its
  // foot falling out of sight. Past the rim (the rim guard's ground), so no collider is needed.
  const SP = RIM_SPIRES.every;
  for (let z = Math.ceil(z0 / SP) * SP; z < z1 && z < end; z += SP) {
    if (z < 160) continue;
    const k = Math.round(z / SP);
    if (hash2(k, 41, s) < RIM_SPIRES.skip) continue;
    const zz = z + (hash2(k, 42, s) - 0.5) * 50;
    const rim = m.ridgeRimX(zz);
    const rimY = m.heightAt(rim - R.dropSide * 2, zz);
    const x = rim + R.dropSide * (14 + 22 * hash2(k, 43, s));
    const footY = m.heightAt(x, zz);
    const top = rimY + RIM_SPIRES.rise[0] + RIM_SPIRES.rise[1] * hash2(k, 44, s);
    const tall = top - footY;
    if (tall < 14) continue;
    // sized until its top clears the rim by the wanted rise: it is sunk 27 % and lowered again where its
    // footprint sits across the steep flank, so its height is grown and the block re-seated (a few
    // rounds). Stretched at most 2.2×: the instance matrix also bends the normals, and a block stretched
    // further turns its faces skyward — the snow rule (flatter than ~40°) then paints the whole tower
    // white against white haze.
    const sz0 = 0.8 + 0.3 * hash2(k, 46, s);
    const yaw = hash2(k, 47, s) * Math.PI * 2;
    let sy = tall * 1.4 + 10;
    let wide = Math.max(6 + 4 * hash2(k, 45, s), sy / 2.2);
    for (let it = 0; it < 5; it++) {
      const st = seat(m, x, zz, wide, sy, wide * sz0, yaw, R.dropSide * 0.08, 0.27);
      _v.set(0, 1, 0).applyQuaternion(_q.set(...st.q));
      const short = top - (st.y + _v.y * sy);
      if (short <= 0) break;
      sy += short / Math.max(0.5, _v.y) + 2;
      wide = Math.max(wide, sy / 2.2);
    }
    const n0 = out.length;
    add({ id: pick(k + 4242), x, z: zz, sx: wide, sy, sz: wide * sz0, yaw, tilt: R.dropSide * 0.08, family: 'spire' }, 0.27);
    // a spire that ends up no higher than the rim tells nothing: leave it out
    const sp = out[n0];
    if (sp) {
      _v.set(0, 1, 0).applyQuaternion(_q.set(...sp.q));
      if (sp.y + _v.y * sp.sy < rimY + 3) out.length = n0;
    }
  }
  return out;
}

const CHUNK = 256;

/**
 * (Round 5, W-096 / review D4-2: every ridge rock drew the full 5,000-triangle scan on every preset, and
 * the round-4 rim band doubled their count) vertex-clustering grid per family and preset
 * (scanModels.decimateUnit): the tors by the piste keep the most detail; the flank rocks and the rim
 * band, seen beyond the lip and mostly far ahead, take coarse copies.
 */
export const RIDGE_ROCK_GRID: Record<'tor' | 'flank' | 'rim', Record<string, number>> = {
  tor: { low: 9, medium: 10, high: 12, ultra: 12 },
  flank: { low: 7, medium: 8, high: 9, ultra: 9 },
  rim: { low: 7, medium: 8, high: 9, ultra: 10 },
};

export class RidgeRocks {
  readonly group = new THREE.Group();
  private geos = new Map<ScanId, THREE.BufferGeometry>();
  /** decimated copies, per scan and grid */
  private lods = new Map<string, THREE.BufferGeometry>();
  private lod(id: ScanId, g: THREE.BufferGeometry, grid: number): THREE.BufferGeometry {
    const key = `${id}:${grid}`;
    let d = this.lods.get(key);
    if (!d) {
      d = decimateUnit(g, grid);
      this.lods.set(key, d);
    }
    return d;
  }
  private mat: THREE.MeshStandardMaterial;
  private spireMat: THREE.MeshStandardMaterial;
  private chunks = new Map<number, THREE.InstancedMesh[]>();
  private disposed = false;
  private stale = false;

  constructor(
    private m: Mountain,
    private quality: string,
  ) {
    this.group.name = 'whiteout-ridge-rocks';
    this.mat = createRockMaterial({
      kind: 'rock_face_03',
      tile: 7,
      snow: 0.8,
      snowFrom: 0.72,
      strata: 0.25,
      hq: quality !== 'low',
      grade: { lum: 0.055, desat: 0.92, tint: [0.93, 0.97, 1.06] },
      macroSet: { kind: 'cliff_side', tile: 90, strength: 0.35 },
      streaks: 0.35,
      // (Round 5, W-093) rime feathers on the windward faces: the ridge's own look, by the piste
      rime: { dir: [1, 0.25], amount: 0.85 },
    });
    // (W-065) the rim spires: wind-scoured faces, dark against the haze (the snow rule would whiten them)
    this.spireMat = createRockMaterial({
      kind: 'rock_face_03',
      tile: 9,
      snow: 0.18,
      snowFrom: 0.9,
      strata: 0.35,
      hq: quality !== 'low',
      grade: { lum: 0.035, desat: 0.9, tint: [0.9, 0.95, 1.05] },
      macroSet: { kind: 'cliff_side', tile: 90, strength: 0.45 },
      streaks: 0.25,
      rime: { dir: [1, 0.25], amount: 0.6 },
    });
  }

  /**
   * (Round 6, W-105: the rock and spire programs linked mid-run, the first time a streamed rock came into
   * view) one-instance meshes of both rock materials, instanced as the streamed ones are, for the load-time
   * compile; hidden again by the scenery's next update
   */
  warmupProbes(): THREE.Object3D[] {
    const g = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    this.probeGeo = g;
    return [this.mat, this.spireMat].map((m) => {
      const im = new THREE.InstancedMesh(g, m, 1);
      im.setMatrixAt(0, new THREE.Matrix4());
      im.frustumCulled = false;
      im.castShadow = true;
      return im;
    });
  }
  private probeGeo: THREE.BufferGeometry | null = null;

  /** load the scanned rock families; the caller starts it after construction (round 6, SonarCloud) */
  async loadScans(): Promise<void> {
    await Promise.all(
      RIDGE_ROCK_IDS.map(async (id) => {
        const g = await loadScan(id);
        if (this.disposed || !g) return;
        this.geos.set(id, g);
        this.stale = true;
      }),
    );
  }

  /** keep the chunks around z; rebuild the live ones when a scan arrives */
  stream(c0: number, c1: number) {
    for (const [k, list] of this.chunks)
      if (k < c0 || k > c1 || this.stale) {
        for (const im of list) {
          im.removeFromParent();
          im.dispose();
        }
        this.chunks.delete(k);
      }
    this.stale = false;
    if (!this.geos.size) return;
    for (let k = Math.max(0, c0); k <= c1; k++) if (!this.chunks.has(k)) this.build(k);
  }

  private build(k: number) {
    const pls = ridgeRockPlacements(this.m, k * CHUNK, (k + 1) * CHUNK);
    const list: THREE.InstancedMesh[] = [];
    const M = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    // (round 4, W-086 / review D3-2) three draw groups per scan: the tors by the piste cast shadows; the
    // rim and flank rocks below the lip and the tall rim spires do not (Whiteout's shadow pass was 2×
    // Alpine's, most of it these full scans throwing shadows nobody on the line can see)
    const G = (f: 'tor' | 'flank' | 'rim') => RIDGE_ROCK_GRID[f][this.quality] ?? RIDGE_ROCK_GRID[f]['high']!;
    const groups = [
      { fam: (f: string) => f === 'tor', spire: false, shadow: true, grid: G('tor') },
      { fam: (f: string) => f === 'flank', spire: false, shadow: false, grid: G('flank') },
      // the rim band and the spires: wind-scoured, dark (their own material, little snow on top)
      { fam: (f: string) => f === 'rim' || f === 'spire', spire: true, shadow: false, grid: G('rim') },
    ];
    for (const id of RIDGE_ROCK_IDS) {
      const g = this.geos.get(id);
      for (const grp of groups) {
        const mine = pls.filter((pl) => pl.id === id && grp.fam(pl.family));
        if (!g || !mine.length) continue;
        const im = new THREE.InstancedMesh(this.lod(id, g, grp.grid), grp.spire ? this.spireMat : this.mat, mine.length);
        mine.forEach((pl, i) => {
          q.set(...pl.q);
          M.compose(p.set(pl.x, pl.y, pl.z), q, sc.set(pl.sx, pl.sy, pl.sz));
          im.setMatrixAt(i, M);
        });
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = grp.shadow;
        im.receiveShadow = true;
        // (round 2, W-052) culled per chunk against the view and the shadow camera: round 1 drew all
        // ~140 scans (≈ 700k triangles) in both passes whether in view or not
        im.computeBoundingSphere();
        im.frustumCulled = true;
        this.group.add(im);
        list.push(im);
      }
    }
    this.chunks.set(k, list);
  }

  count(): number {
    let n = 0;
    for (const l of this.chunks.values()) for (const im of l) n += im.count;
    return n;
  }

  dispose() {
    this.disposed = true;
    for (const list of this.chunks.values()) for (const im of list) im.dispose();
    this.chunks.clear();
    for (const d of this.lods.values()) d.dispose();
    this.lods.clear();
    disposeRockMaterial(this.mat);
    disposeRockMaterial(this.spireMat);
    this.probeGeo?.dispose();
  }
}
