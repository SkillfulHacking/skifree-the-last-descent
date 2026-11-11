/**
 * Proposed Fjord sea-cave dressing (round-4 art experiment): a columnar-basalt portal that reads in
 * the backlit sea-side orientation.
 *
 * What was wrong (final round, A M1 / F): the cave faces inland, away from the low sun over the
 * sea, so the mouth is lit only by the sky — and the round-3 basalt multiplied the indirect light
 * by 0.32 and the direct by 0.5 on top of a 0.016–0.02 albedo. Result: 0–2/255. And the columns
 * were individual, separated prisms with white caps: a crowd of black bollards.
 *
 * Here:
 *  - The shared cave's rock takes the triplanar basalt material (./rockMaterial.ts): a physically
 *    plausible weathered-basalt albedo (≈0.05–0.09 linear), real normal detail, roughness from the
 *    bake, a wet foot; NO light multipliers. In sky light it lands at ~35–60/255, dark but legible.
 *  - Columns are packed edge to edge on a hexagonal lattice (as basalt really cracks), in three
 *    bodies: a colonnade framing the mouth (Fingal's Cave), a causeway stepping down beside it and
 *    a lower, partly collapsed group on the other side. Tops follow a smooth surface quantised
 *    into ~0.9 m treads with per-column scatter, some broken off at an angle; snow settles on the
 *    level tops through the material (no separate caps).
 *  - One merged mesh, one draw call; flat-shaded column faces so every column edge catches the
 *    rim light from the sun behind the cave.
 *
 * Keeps the cave contract: never inside the Yeti's exit path / ledge nor the shared cinematic's
 * sight lines (same tests as the round-3 dressing).
 */
import * as THREE from 'three';
import type { Cave } from '../Cave';
import type { Mountain } from '../course';
import { Rng } from '../../core/rng';
import { createRockMaterial, disposeRockMaterial } from './rockMaterial';
import { noise3, smoothstep } from './noise3';
import { clearOfCaveCameras } from '../biomes/fjord/views/seaCave';
import { caveCameraSightlines } from '../../cinematic/CaveCinematic';

export interface BasaltPortal {
  group: THREE.Group;
  columns: number;
  triangles: number;
  dispose(): void;
}

/** column prism builder (non-indexed, flat normals, per-vertex colour) */
class Prisms {
  pos: number[] = [];
  col: number[] = [];
  count = 0;
  private tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ca: number, cb: number, cc: number) {
    // (the hexagon runs clockwise seen from above: emit a, c, b so faces wind outward)
    this.pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    this.col.push(ca, ca, ca * 1.03, cc, cc, cc * 1.03, cb, cb, cb * 1.03);
  }
  /**
   * a hexagonal column: centre (x, z), circumradius r, from y0 to the top plane through (x, top, z)
   * with slope (sx, sz); `rot` turns the hexagon; `tone` per column; the top gets a small bevel
   */
  add(x: number, z: number, r: number, y0: number, top: number, sx: number, sz: number, rot: number, tone: number) {
    const n = 6;
    const ring: THREE.Vector3[] = [];
    const ringTop: THREE.Vector3[] = [];
    const bev = Math.min(0.12, r * 0.15);
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const ty = top + sx * (px - x) + sz * (pz - z);
      ring.push(new THREE.Vector3(px, y0, pz));
      ringTop.push(new THREE.Vector3(px, ty - bev, pz));
    }
    const inner: THREE.Vector3[] = ringTop.map((p) => new THREE.Vector3(x + (p.x - x) * 0.82, p.y + bev, z + (p.z - z) * 0.82));
    const cTop = new THREE.Vector3(x, top + 0.04, z);
    const foot = tone * 0.55; // damp, shadowed foot
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      // side face (outward winding)
      this.tri(ring[k]!, ringTop[k2]!, ringTop[k]!, foot, tone, tone);
      this.tri(ring[k]!, ring[k2]!, ringTop[k2]!, foot, foot, tone);
      // bevel
      this.tri(ringTop[k]!, ringTop[k2]!, inner[k2]!, tone, tone, tone * 1.05);
      this.tri(ringTop[k]!, inner[k2]!, inner[k]!, tone, tone * 1.05, tone * 1.05);
      // cap
      this.tri(inner[k]!, inner[k2]!, cTop, tone * 1.05, tone * 1.05, tone * 1.08);
    }
    this.count++;
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); // non-indexed → flat normals
    g.computeBoundingSphere();
    return g;
  }
}

export function buildBasaltPortal(m: Mountain, cave: Cave, opts: { quality?: string; seed?: number } = {}): BasaltPortal {
  const group = new THREE.Group();
  group.name = 'art-basalt-portal';
  const rnd = new Rng((opts.seed ?? 0x5ea) ^ Math.round(cave.mouth.z * 7));
  const out = cave.outward.clone().setY(0).normalize();
  const tan = new THREE.Vector3(out.z, 0, -out.x);
  const M = cave.mouth;
  const lines = caveCameraSightlines(cave.mouth, cave.outward, cave.lipTop);
  const clearOfPath = (x: number, z: number, r: number) => cave.exitPath.every((p) => Math.hypot(p.x - x, p.z - z) > r + 1.6) && Math.hypot(cave.ledge.x - x, cave.ledge.z - z) > r + 2.4;
  const ok = (p: THREE.Vector3, r: number) => clearOfPath(p.x, p.z, r) && clearOfCaveCameras(lines, p, r);

  // 1) the cave's own rock: triplanar basalt, physically lit (no multipliers)
  const rock = cave.group.getObjectByName('cave-rock') as THREE.Mesh | undefined;
  const rockMat = createRockMaterial({ kind: 'basalt', snow: 1, strata: 0.25, macro: 6, wet: 0, caveAttr: !!rock?.geometry.getAttribute('aCave') });
  let prevRockMat: THREE.Material | THREE.Material[] | null = null;
  if (rock) {
    prevRockMat = rock.material;
    rock.material = rockMat;
  }
  const sharedIce = cave.group.getObjectByName('cave-icicles');
  if (sharedIce) sharedIce.visible = false;

  // 2) the columns
  const P = new Prisms();
  const S = 1.18; // flat-to-flat (m): columns touch
  const r = S / Math.sqrt(3);
  const seat = (x: number, z: number) => {
    let gy = Infinity;
    for (let k = 0; k < 6; k++) gy = Math.min(gy, m.heightAt(x + Math.cos(k) * r, z + Math.sin(k) * r));
    return Math.min(gy, cave.floorHeightAt(x, z) + 0.3);
  };
  const rot = Math.atan2(tan.z, tan.x);
  const body = (a0: number, a1: number, b0: number, b1: number, height: (a: number, b: number) => number, seed: number) => {
    // hex lattice in the (along, back) frame
    for (let j = 0; ; j++) {
      const b = b0 + j * S * 0.866;
      if (b > b1) break;
      for (let i = 0; ; i++) {
        const a = a0 + i * S + (j % 2) * S * 0.5;
        if (a > a1) break;
        const x = M.x + tan.x * a - out.x * b;
        const z = M.z + tan.z * a - out.z * b;
        let h = height(a, b);
        if (h < 0.5) continue;
        // treads (~0.9 m) with scatter; the odd column snapped low
        h = Math.round(h / 0.9) * 0.9 + rnd.range(-0.22, 0.22);
        if (rnd.float() < 0.07) h *= rnd.range(0.3, 0.6);
        const gy = seat(x, z);
        const top = gy + h;
        const cen = new THREE.Vector3(x, gy + h / 2, z);
        if (!ok(cen, r)) continue;
        const broken = rnd.float() < 0.18;
        const sx = broken ? rnd.range(-0.5, 0.5) : rnd.range(-0.04, 0.04);
        const sz = broken ? rnd.range(-0.5, 0.5) : rnd.range(-0.04, 0.04);
        const tone = 0.78 + 0.4 * rnd.float() + 0.12 * noise3(x * 0.3, top * 0.2, z * 0.3, seed);
        P.add(x, z, r * rnd.range(0.97, 1.0), gy - 1.2, top, sx, sz, rot + (j % 2) * 0, tone);
      }
    }
  };
  const hw = 4.2; // half-width of the opening plus jamb clearance
  // colonnade framing the mouth: tall, tightest against the opening, both sides
  const colon = (a: number, b: number, side: number) => {
    const d = Math.abs(a) - hw;
    // tallest at the back against the face, stepping down toward the front rows
    return (8.5 - d * 1.1 + 1.2 * noise3(a * 0.4, b * 0.4, side, 11)) * (0.3 + 0.7 * smoothstep(-5.5, 1.8, b));
  };
  body(-hw - 5.5, -hw, -5.5, 2.2, (a, b) => colon(a, b, -1), 3);
  body(hw, hw + 5.5, -5.5, 2.2, (a, b) => colon(a, b, 1), 5);
  // causeway stepping down and out on +along
  body(hw + 4.5, hw + 19, -1.5, 9, (a, b) => {
    const fa = (a - hw - 4.5) / 14.5;
    const front = 6.5 + 2.5 * noise3(a * 0.18, 0, 0, 21);
    return (5.2 * (1 - fa) + 0.9 * noise3(a * 0.25, b * 0.25, 2, 23)) * (b < front ? 1 : 0) * (1 - Math.max(0, -b) * 0.15);
  }, 7);
  // a lower, partly collapsed group on −along
  body(-hw - 15, -hw - 4.5, -1, 5, (a, b) => {
    const fa = (-a - hw - 4.5) / 10.5;
    return (3.4 * (1 - fa) + 1.4 * noise3(a * 0.3, b * 0.3, 3, 29)) * (noise3(a * 0.22, b * 0.22, 4, 31) > -0.25 ? 1 : 0);
  }, 9);
  const colGeo = P.geometry();
  const colMat = createRockMaterial({ kind: 'basalt', vertexColors: true, snow: 1, strata: 0, macro: 5 });
  const cols = new THREE.Mesh(colGeo, colMat);
  cols.castShadow = true;
  cols.receiveShadow = true;
  cols.name = 'art-basalt-columns';
  group.add(cols);
  return {
    group,
    columns: P.count,
    triangles: colGeo.getAttribute('position').count / 3,
    dispose() {
      colGeo.dispose();
      disposeRockMaterial(colMat);
      if (rock && prevRockMat) rock.material = prevRockMat;
      disposeRockMaterial(rockMat);
      if (sharedIce) sharedIce.visible = true;
      group.removeFromParent();
    },
  };
}
