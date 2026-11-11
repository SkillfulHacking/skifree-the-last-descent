/**
 * Islands and skerries as authored meshes with archetypes (round-4 art experiment).
 *
 * The heightfield islands were one rounded "loaf" repeated (a dome resolved by 32–64 m far tiles).
 * Real fjord archipelagos are glacial: low polished skerries in chains along the ice-flow grain,
 * whalebacks with a gentle up-ice (stoss) slope and a plucked, cliffed down-ice (lee) end, the
 * odd high cliff-girt island, low wooded islets, gravel coves. Each archetype here is a polar mesh
 * (rings dense at the shoreline, so the shore and the lee cliffs are resolved at metres, not tens
 * of metres) with a noise-warped coastline, a profile per archetype and sculpted relief; trees are
 * instanced on gentle ground of the wooded/whaleback kinds.
 *
 * Deterministic: the layout is a pure function of (seed, cell); every island from its own seed.
 */
import * as THREE from 'three';
import { Rng, gnoise } from '../../core/rng';
import { fbm3, terraced, smoothstep, clamp } from './noise3';

export type IslandKind = 'skerry' | 'whaleback' | 'cliffed' | 'wooded';

export interface IslandSpec {
  kind: IslandKind;
  x: number;
  z: number;
  /** semi-axes of the base ellipse (m) */
  a: number;
  b: number;
  /** long-axis direction (rad), also the ice-flow direction (stoss at −axis, lee at +axis) */
  ang: number;
  /** height above the water (m) */
  h: number;
  water: number;
  seed: number;
}

/** periodic noise around the shoreline (angle → [-1, 1]) */
function ring(theta: number, freq: number, seed: number): number {
  return gnoise(Math.cos(theta) * freq + 11.3, Math.sin(theta) * freq - 7.1, seed);
}

/** shoreline radius factor around the island: coves and points (domain-warped) */
function shoreFactor(sp: IslandSpec, theta: number): number {
  const w = theta + 0.35 * ring(theta, 1.3, sp.seed + 3);
  let f = 1 + 0.2 * ring(w, 1.6, sp.seed + 5) + 0.1 * ring(w, 3.7, sp.seed + 7) + 0.045 * ring(w, 9.1, sp.seed + 9);
  if (sp.kind === 'skerry') f += 0.12 * ring(w, 2.4, sp.seed + 13);
  return Math.max(0.45, f);
}

/** normalized height (0..1 of sp.h) at normalized radius rho (1 = shoreline) toward local direction u (along the axis, −1 stoss … +1 lee) */
function profile(sp: IslandSpec, rho: number, u: number, theta: number): number {
  if (rho >= 1) return -Math.min(1, (rho - 1) * 6) * (6 / Math.max(6, sp.h)) - (rho - 1) * 0.6;
  const lee = smoothstep(0.1, 0.8, u);
  switch (sp.kind) {
    case 'skerry': {
      // polished dome, a little steeper on the lee
      const p = Math.pow(1 - rho * rho, 0.55 + 0.4 * lee);
      return p;
    }
    case 'wooded': {
      return Math.pow(1 - rho * rho, 0.8) * (0.85 + 0.15 * ring(theta, 2, sp.seed + 21));
    }
    case 'whaleback': {
      // stoss: long convex ramp; lee: plateau that breaks off in a plucked cliff near the shore
      const stoss = Math.pow(1 - rho * rho, 0.7);
      const cliffAt = 0.8 + 0.08 * ring(theta, 3, sp.seed + 23);
      const leeP = (1 - smoothstep(cliffAt, cliffAt + 0.12, rho)) * (0.86 + 0.14 * (1 - rho)) + 0.12 * (1 - smoothstep(cliffAt + 0.1, 1, rho));
      return stoss + (leeP - stoss) * lee;
    }
    case 'cliffed': {
      // a high plateau with a girdle of cliffs; one cove with a gravel beach
      const cove = smoothstep(0.75, 0.95, Math.cos(theta - sp.ang - 1.9)) ;
      const edge = 0.84 + 0.06 * ring(theta, 4, sp.seed + 25);
      const plateau = 0.78 + 0.22 * Math.pow(Math.max(0, 1 - rho / edge), 0.5);
      const wall = 1 - smoothstep(edge, edge + 0.07, rho);
      const toe = 0.08 * (1 - smoothstep(edge + 0.05, 1, rho));
      const cliffy = plateau * wall + toe;
      const beach = Math.pow(1 - rho, 1.2) * 0.9;
      return cliffy + (beach - cliffy) * cove;
    }
  }
}

/** Build the island mesh (world coordinates). Trees: positions on gentle, dry, snowy ground. */
export function buildIsland(sp: IslandSpec, detail = 1): { geometry: THREE.BufferGeometry; trees: THREE.Vector3[] } {
  const big = Math.max(sp.a, sp.b);
  const na = Math.max(40, Math.min(160, Math.round((big * 2 * Math.PI) / (big > 200 ? 9 : 5) * detail)));
  // ring radii: sparse inside, dense across the shore and the lee/girdle cliffs, then the sea bed
  const rhos: number[] = [];
  for (let r = 0; r < 0.7; r += 0.1) rhos.push(r);
  for (let r = 0.7; r < 0.98; r += 0.025 / detail) rhos.push(r);
  for (let r = 0.98; r < 1.06; r += 0.012 / detail) rhos.push(r);
  rhos.push(1.1, 1.18, 1.3);
  const nr = rhos.length;
  const pos = new Float32Array(na * nr * 3 + 3);
  const col = new Float32Array(na * nr * 3 + 3);
  const ca = Math.cos(sp.ang), sa = Math.sin(sp.ang);
  const trees: THREE.Vector3[] = [];
  const rng = new Rng(sp.seed ^ 0x51ab);
  for (let j = 0; j < na; j++) {
    const th = (j / na) * Math.PI * 2;
    const ct = Math.cos(th), st = Math.sin(th);
    // ellipse radius in this direction (local frame: u along the axis)
    const lu = ct * ca + st * sa;
    const lv = -ct * sa + st * ca;
    const Re = 1 / Math.sqrt((lu * lu) / (sp.a * sp.a) + (lv * lv) / (sp.b * sp.b));
    const R = Re * shoreFactor(sp, th);
    for (let i = 0; i < nr; i++) {
      const rho = rhos[i]!;
      let r = rho * R;
      let x = sp.x + ct * r;
      let z = sp.z + st * r;
      const u = (lu * rho);
      let hN = profile(sp, rho, u, th);
      // knobbly glacial relief on top (low), blocky relief on steep parts
      const y0 = sp.water + hN * sp.h;
      const steepK = rho < 1 ? smoothstep(0.6, 0.95, rho) : 0;
      const n1 = fbm3(x / 40, y0 / 25, z / 40, sp.seed + 31, 3);
      const knob = (sp.kind === 'skerry' ? 0.06 : 0.04) * sp.h * n1 * (rho < 1 ? 1 - steepK * 0.5 : 0.3);
      const blocks = (terraced(0.5 + 0.5 * fbm3(x / 22, y0 / 9, z / 22, sp.seed + 37, 2), 4, 0.35) - 0.5) * Math.min(6, sp.h * 0.08);
      r += blocks * steepK * (rho < 1 ? 1 : 0.3);
      x = sp.x + ct * r;
      z = sp.z + st * r;
      let y = y0 + knob;
      if (rho >= 1) y = Math.min(y, sp.water - 0.6 - (rho - 1) * R * 0.25);
      const k = (j * nr + i) * 3;
      pos[k] = x;
      pos[k + 1] = y;
      pos[k + 2] = z;
      // baked tint: the lee cliffs a little darker (wet, plucked), tops paler (weathered)
      const ao = 1 - 0.25 * steepK * smoothstep(0.1, 0.7, u) - (rho > 0.97 && rho < 1.03 ? 0.1 : 0);
      col[k] = ao;
      col[k + 1] = ao;
      col[k + 2] = ao * 1.02;
      hN = (y - sp.water) / sp.h;
    }
  }
  // centre vertex (closes the fan)
  const ci = na * nr;
  pos[ci * 3] = sp.x;
  pos[ci * 3 + 1] = sp.water + profile(sp, 0, 0, 0) * sp.h;
  pos[ci * 3 + 2] = sp.z;
  col[ci * 3] = col[ci * 3 + 1] = col[ci * 3 + 2] = 1;
  const idx: number[] = [];
  for (let j = 0; j < na; j++) {
    const jn = (j + 1) % na;
    idx.push(ci, jn * nr, j * nr);
    for (let i = 0; i < nr - 1; i++) {
      const a = j * nr + i, b = a + 1, c = jn * nr + i, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  {
    // make sure the surface faces up
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
    let sy = 0;
    for (let i = 0; i < nrm.count; i++) sy += nrm.getY(i);
    if (sy < 0) {
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i + 1]!;
        idx[i + 1] = idx[i + 2]!;
        idx[i + 2] = t;
      }
      g.setIndex(idx);
      g.computeVertexNormals();
    }
  }
  // trees on gentle, dry ground (wooded islets thickly, whalebacks/cliffed tops sparsely)
  const density = sp.kind === 'wooded' ? 1 / 160 : sp.kind === 'whaleback' ? 1 / 900 : sp.kind === 'cliffed' ? 1 / 700 : 0;
  if (density > 0) {
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
    const area = Math.PI * sp.a * sp.b;
    const want = Math.min(400, Math.round(area * density));
    for (let t = 0; t < want * 3 && trees.length < want; t++) {
      const j = rng.int(0, na - 1);
      const i = rng.int(1, nr - 1);
      if (rhos[i]! > 0.9) continue;
      const k = j * nr + i;
      if (nrm.getY(k) < 0.82) continue;
      const y = pos[k * 3 + 1]!;
      if (y < sp.water + 3) continue;
      // clumps: keep where a low-frequency noise is high
      const x = pos[k * 3]! + rng.range(-3, 3), z = pos[k * 3 + 2]! + rng.range(-3, 3);
      if (sp.kind !== 'wooded' && gnoise(x / 60, z / 60, sp.seed + 41) < 0.1) continue;
      trees.push(new THREE.Vector3(x, y - 0.3, z));
    }
  }
  g.computeBoundingSphere();
  return { geometry: g, trees };
}

export interface IslandLayoutOptions {
  /** region in world x/z */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  waterAt(z: number): number;
  /** false where no island may stand (too close to the cliff foot, the far shore, a lane) */
  allowed(x: number, z: number, r: number): boolean;
  seed: number;
  /** cluster cell size (m) */
  cell?: number;
}

/**
 * Archipelago layout: per cell, maybe a cluster built around one feature island, with satellites
 * strung along the shared ice-flow grain (a regional direction that wanders slowly), so groups read
 * as one glaciated archipelago rather than an even scatter of identical domes.
 */
export function layoutIslands(o: IslandLayoutOptions): IslandSpec[] {
  const cell = o.cell ?? 1100;
  const out: IslandSpec[] = [];
  for (let cj = Math.floor(o.z0 / cell); cj <= Math.floor(o.z1 / cell); cj++)
    for (let ci = Math.floor(o.x0 / cell); ci <= Math.floor(o.x1 / cell); ci++) {
      const r = new Rng((o.seed ^ Math.imul(ci + 733, 0x2c1b3c6d) ^ Math.imul(cj + 157, 0x297a2d39)) >>> 0);
      if (r.float() > 0.62) continue;
      const cx = (ci + r.range(0.2, 0.8)) * cell;
      const cz = (cj + r.range(0.2, 0.8)) * cell;
      // ice flowed down-fjord (+z) and out to sea (−x): the grain wanders around that
      const grain = -0.5 + 0.35 * gnoise(cx / 3000, cz / 3000, o.seed + 77) + r.range(-0.15, 0.15);
      const roll = r.float();
      const kind: IslandKind = roll < 0.3 ? 'whaleback' : roll < 0.45 ? 'cliffed' : roll < 0.7 ? 'wooded' : 'skerry';
      const water = o.waterAt(cz);
      const main: IslandSpec =
        kind === 'cliffed'
          ? { kind, x: cx, z: cz, a: r.range(170, 300), b: 0, ang: grain, h: r.range(55, 110), water, seed: r.int(1, 1e9) }
          : kind === 'whaleback'
            ? { kind, x: cx, z: cz, a: r.range(220, 420), b: 0, ang: grain, h: r.range(35, 90), water, seed: r.int(1, 1e9) }
            : kind === 'wooded'
              ? { kind, x: cx, z: cz, a: r.range(110, 220), b: 0, ang: grain, h: r.range(14, 30), water, seed: r.int(1, 1e9) }
              : { kind, x: cx, z: cz, a: r.range(40, 90), b: 0, ang: grain, h: r.range(4, 10), water, seed: r.int(1, 1e9) };
      main.b = main.a * (kind === 'whaleback' ? r.range(0.35, 0.5) : r.range(0.55, 0.85));
      const group: IslandSpec[] = [];
      if (o.allowed(main.x, main.z, main.a * 1.2)) group.push(main);
      // satellites: skerry chains along the grain off the lee end, and the odd small islet
      const ns = kind === 'skerry' ? r.int(3, 7) : r.int(2, 5);
      let px = main.x, pz = main.z;
      const dir = r.chance(0.5) ? 1 : -1;
      for (let k = 0; k < ns; k++) {
        const step = main.a * (k === 0 ? 1.1 : 0.35) + r.range(40, 140);
        px += Math.cos(grain) * step * dir + r.range(-60, 60);
        pz += Math.sin(grain) * step * dir + r.range(-60, 60);
        const small = r.float() < 0.75;
        const s: IslandSpec = { kind: small ? 'skerry' : 'wooded', x: px, z: pz, a: small ? r.range(18, 60) : r.range(60, 120), b: 0, ang: grain + r.range(-0.3, 0.3), h: small ? r.range(2, 7) : r.range(10, 22), water, seed: r.int(1, 1e9) };
        s.b = s.a * r.range(0.4, 0.75);
        if (o.allowed(s.x, s.z, s.a * 1.2)) group.push(s);
      }
      out.push(...group);
    }
  return out;
}

/** coarse height of a laid-out island at (x, z) (for placement checks / the heightfield bed); −Infinity outside */
export function islandHeightApprox(sp: IslandSpec, x: number, z: number): number {
  const dx = x - sp.x, dz = z - sp.z;
  const th = Math.atan2(dz, dx);
  const ca = Math.cos(sp.ang), sa = Math.sin(sp.ang);
  const lu = Math.cos(th) * ca + Math.sin(th) * sa;
  const lv = -Math.cos(th) * sa + Math.sin(th) * ca;
  const Re = 1 / Math.sqrt((lu * lu) / (sp.a * sp.a) + (lv * lv) / (sp.b * sp.b));
  const rho = Math.hypot(dx, dz) / (Re * shoreFactor(sp, th));
  if (rho > 1.3) return -Infinity;
  return sp.water + clamp(profile(sp, rho, lu * rho, th), -1, 1) * sp.h;
}
