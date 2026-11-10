/**
 * Coastal architecture kit (three.js, procedural): painted timber houses with snow-laden gable
 * roofs, red boathouses on stilts ("rorbuer"), jetties, fishing boats, a coastal ferry and stone
 * cairns. Everything is appended to a resort `Batch` (merged per material: a handful of draw
 * calls per group) with vertex colours, so a whole hamlet or the harbour is cheap to draw.
 */
import * as THREE from 'three';
import { Batch, mat, type Rand } from '../../../resort/util';

/** the shoreline palette: falu red, ochre, white, harbour blue, sea green, salmon */
export const PAINT = [0x8e2c1d, 0xd59f3a, 0xece7dc, 0x2d4c78, 0x4e6f4b, 0xc76b4c, 0x9b3524, 0xe2c26a] as const;
const TRIM = 0xf2efe7;
const ROOF_DARK = 0x2a2624;

/** Materials used by the kit (create once per group; dispose with it). */
export function kitMaterials(): Record<string, THREE.Material> {
  return {
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
    snow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, color: 0xf3f7ff }),
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.2, emissive: new THREE.Color(0xffb46a), emissiveIntensity: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 }),
    sign: new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.7 }),
  };
}

let signTex: THREE.CanvasTexture | null = null;
/** "UTSIKT · VIEWPOINT" board (shared; never disposed with a chunk: one small texture per page) */
function signTexture(): THREE.CanvasTexture {
  if (signTex) return signTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f3f63';
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#f2efe7';
  g.lineWidth = 8;
  g.strokeRect(10, 10, 492, 140);
  g.fillStyle = '#f2efe7';
  g.textAlign = 'center';
  g.font = '900 64px "Arial Black", Impact, sans-serif';
  g.fillText('UTSIKT', 256, 86);
  g.font = '700 30px Arial, sans-serif';
  g.fillText('VIEWPOINT  \u25B2  FJORD', 256, 128);
  signTex = new THREE.CanvasTexture(c);
  signTex.colorSpace = THREE.SRGBColorSpace;
  return signTex;
}

/** gable prism (ridge along local x) of width w (x), depth d (z), height h */
function gable(w: number, d: number, h: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** a roof slab (one side of a gable), slightly oversized */
function roofSides(w: number, d: number, h: number, t: number): THREE.BufferGeometry[] {
  const len = Math.hypot(d / 2, h) + 0.35;
  const ang = Math.atan2(h, d / 2);
  const out: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(w + 0.6, t, len);
    g.translate(0, 0, (s * len) / 2);
    g.rotateX(s * ang);
    g.translate(0, h - 0.05, 0);
    out.push(g);
  }
  return out;
}

export interface HouseOpts {
  w: number;
  d: number;
  /** wall height */
  h: number;
  color: number;
  /** roof pitch height */
  roofH?: number;
  /** stilts below the floor (boathouses over the water): depth to the bed */
  stilts?: number;
  windows?: boolean;
  door?: 'side' | 'gable' | 'boat';
  chimney?: boolean;
}

/**
 * A painted timber house at (x, y, z) facing `yaw` (gable ends along local ±x). `y` is the floor
 * (a stone footing runs 1.5 m below it so the house sits into uneven ground).
 */
export function house(b: Batch, x: number, y: number, z: number, yaw: number, o: HouseOpts, rnd: Rand): void {
  const M = mat(x, y, z, 0, yaw, 0);
  const add = (key: string, g: THREE.BufferGeometry, color: number, m = M) => b.add(key, g, m, color);
  const roofH = o.roofH ?? o.d * 0.42;
  // footing
  if (o.stilts) {
    for (const px of [-o.w / 2 + 0.3, 0, o.w / 2 - 0.3])
      for (const pz of [-o.d / 2 + 0.3, o.d / 2 - 0.3]) add('paint', new THREE.CylinderGeometry(0.16, 0.18, o.stilts + 0.4, 6).translate(px, -o.stilts / 2, pz), 0x3b2c22);
    add('paint', new THREE.BoxGeometry(o.w + 0.4, 0.25, o.d + 0.4).translate(0, -0.12, 0), 0x4a382a);
  } else add('stone', new THREE.BoxGeometry(o.w + 0.3, 1.6, o.d + 0.3).translate(0, -0.75, 0), 0x55585c);
  // walls: clapboard read from vertical stripes of slightly varied tone
  const body = new THREE.BoxGeometry(o.w, o.h, o.d).translate(0, o.h / 2, 0);
  const base = new THREE.Color(o.color);
  b.add('paint', body, M, (p) => {
    const k = 0.93 + 0.07 * Math.sin(p.x * 9.1 + p.z * 9.1) + 0.04 * (p.y - y) / o.h;
    return base.clone().multiplyScalar(k);
  });
  // gable ends
  add('paint', gable(o.w, o.d, roofH).translate(0, o.h, 0), o.color);
  // corner boards & fascia (white trim)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) add('paint', new THREE.BoxGeometry(0.18, o.h, 0.18).translate((sx * o.w) / 2, o.h / 2, (sz * o.d) / 2), TRIM);
  // roof (dark) + a thick snow load on top
  for (const g of roofSides(o.w, o.d, roofH, 0.18)) add('paint', g.translate(0, o.h, 0), ROOF_DARK);
  for (const g of roofSides(o.w - 0.2, o.d * 0.98, roofH, 0.32)) add('snow', g.translate(0, o.h + 0.2, 0), 0xffffff);
  // windows (warm light) with white frames
  if (o.windows !== false) {
    const n = Math.max(1, Math.floor(o.w / 2.6));
    for (const sz of [-1, 1])
      for (let i = 0; i < n; i++) {
        if (sz > 0 && i === Math.floor(n / 2) && o.door === 'side') continue;
        const wx = -o.w / 2 + (o.w * (i + 0.5)) / n;
        add('paint', new THREE.BoxGeometry(1.0, 1.2, 0.08).translate(wx, o.h * 0.55, (sz * (o.d + 0.02)) / 2), TRIM);
        if (rnd.next() < 0.7) add('glass', new THREE.BoxGeometry(0.78, 0.98, 0.1).translate(wx, o.h * 0.55, (sz * (o.d + 0.04)) / 2), 0xffffff);
      }
    add('paint', new THREE.BoxGeometry(0.08, 0.9, 0.8).translate((o.w + 0.02) / 2, o.h + roofH * 0.35, 0), TRIM);
  }
  if (o.door === 'side') add('paint', new THREE.BoxGeometry(1.0, 2.0, 0.1).translate(0, 1.0, (o.d + 0.06) / 2), 0x3b2a1e);
  if (o.door === 'boat') add('paint', new THREE.BoxGeometry(0.1, o.h * 0.75, o.d * 0.6).translate(-(o.w + 0.06) / 2, (o.h * 0.75) / 2, 0), 0x2b1e16);
  if (o.chimney) {
    const cx = o.w * 0.25;
    add('stone', new THREE.BoxGeometry(0.6, roofH + 1.2, 0.6).translate(cx, o.h + roofH * 0.6, -o.d * 0.15), 0x6b6560);
    add('snow', new THREE.BoxGeometry(0.66, 0.18, 0.66).translate(cx, o.h + roofH * 1.2 + 0.1, -o.d * 0.15), 0xffffff);
  }
}

/** A timber jetty from (x0, z0) to (x1, z1) at deck height y (posts down to y − depth). */
export function jetty(b: Batch, a: THREE.Vector3, c: THREE.Vector3, width: number, depth: number): void {
  const len = Math.hypot(c.x - a.x, c.z - a.z);
  const yaw = Math.atan2(c.x - a.x, c.z - a.z);
  const M = mat((a.x + c.x) / 2, a.y, (a.z + c.z) / 2, 0, yaw, 0);
  b.add('paint', new THREE.BoxGeometry(width, 0.22, len), M, (p) => new THREE.Color(0x5b4634).multiplyScalar(0.85 + 0.15 * Math.sin(p.x * 13 + p.z * 21)));
  b.add('snow', new THREE.BoxGeometry(width * 0.7, 0.06, len * 0.9).translate(0, 0.14, 0), M, 0xffffff);
  for (let s = -len / 2 + 0.4; s <= len / 2; s += 3)
    for (const sx of [-1, 1]) b.add('paint', new THREE.CylinderGeometry(0.15, 0.17, depth + 1.2, 6).translate((sx * width) / 2, -depth / 2 + 0.5, s), M, 0x2e231a);
}

export interface BoatOpts {
  len: number;
  hull: number;
  stripe: number;
  cabin: number;
}

/** A small fishing boat (hull, gunwale stripe, wheelhouse, mast), its waterline at y. */
export function fishingBoat(b: Batch, x: number, y: number, z: number, yaw: number, o: BoatOpts): void {
  const M = mat(x, y, z, 0, yaw, 0);
  const L = o.len;
  const B = L * 0.32;
  // hull: a box whose bow is pinched to a stem and whose bottom is narrowed (keel)
  const g = new THREE.BoxGeometry(B, L * 0.22, L, 4, 3, 10);
  const P = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const px = P.getX(i);
    const py = P.getY(i);
    const pz = P.getZ(i);
    const t = pz / L + 0.5; // 0 stern → 1 bow
    const bow = Math.pow(Math.max(0, t - 0.55) / 0.45, 1.6);
    const keel = 1 - 0.55 * Math.max(0, -py / (L * 0.11));
    const sheer = py > 0 ? L * 0.05 * bow : 0;
    P.setXYZ(i, px * (1 - 0.92 * bow) * keel, py + sheer + L * 0.04, pz);
  }
  g.computeVertexNormals();
  b.add('paint', g, M, (p) => new THREE.Color(p.y > y + L * 0.1 ? o.stripe : o.hull));
  b.add('paint', new THREE.BoxGeometry(B * 0.62, L * 0.2, L * 0.26).translate(0, L * 0.25, -L * 0.12), M, o.cabin);
  b.add('snow', new THREE.BoxGeometry(B * 0.66, 0.08, L * 0.29).translate(0, L * 0.355, -L * 0.12), M, 0xffffff);
  b.add('glass', new THREE.BoxGeometry(B * 0.5, L * 0.06, 0.06).translate(0, L * 0.29, L * 0.01), M, 0xffffff);
  b.add('metal', new THREE.CylinderGeometry(0.06, 0.08, L * 0.55, 5).translate(0, L * 0.45, L * 0.18), M, 0xd8d8d8);
  b.add('metal', new THREE.CylinderGeometry(0.04, 0.04, L * 0.3, 5).rotateX(1.0).translate(0, L * 0.5, L * 0.08), M, 0xd8d8d8);
}

/**
 * A coastal ferry (black hull, white superstructure, red funnel) of length L, waterline at y.
 * Built at the origin facing +z; returned as its own merged meshes so it can sail.
 */
export function ferry(b: Batch, L: number): void {
  const B = L * 0.16;
  const g = new THREE.BoxGeometry(B, L * 0.09, L, 3, 2, 12);
  const P = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const t = P.getZ(i) / L + 0.5;
    const bow = Math.pow(Math.max(0, t - 0.7) / 0.3, 1.5);
    P.setX(i, P.getX(i) * (1 - 0.9 * bow));
    P.setY(i, P.getY(i) + L * 0.035 + (P.getY(i) > 0 ? L * 0.02 * bow : 0));
  }
  g.computeVertexNormals();
  b.add('paint', g, undefined, (p) => new THREE.Color(p.y < L * 0.012 ? 0x8a1f17 : 0x15171b));
  b.add('paint', new THREE.BoxGeometry(B * 0.92, L * 0.07, L * 0.62).translate(0, L * 0.115, -L * 0.04), undefined, 0xf1f1ee);
  b.add('paint', new THREE.BoxGeometry(B * 0.8, L * 0.05, L * 0.38).translate(0, L * 0.17, -L * 0.02), undefined, 0xf1f1ee);
  b.add('glass', new THREE.BoxGeometry(B * 0.94, L * 0.012, L * 0.6).translate(0, L * 0.12, -L * 0.04), undefined, 0xffffff);
  b.add('paint', new THREE.CylinderGeometry(B * 0.16, B * 0.18, L * 0.08, 10).translate(0, L * 0.23, -L * 0.12), undefined, 0xc22a1f);
  b.add('paint', new THREE.CylinderGeometry(B * 0.165, B * 0.165, L * 0.014, 10).translate(0, L * 0.268, -L * 0.12), undefined, 0x15171b);
}

/** A stone cairn ("varde"): stacked stones with a painted red T on top, base on the ground at y. */
export function cairn(b: Batch, x: number, y: number, z: number, h: number, rnd: Rand): void {
  let yy = y - 0.15;
  let r = h * 0.36;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const s = r * (0.9 + rnd.range(-0.1, 0.12));
    const g = new THREE.DodecahedronGeometry(s, 0);
    g.scale(1, 0.62, 1);
    const ox = rnd.range(-0.08, 0.08) * h;
    const oz = rnd.range(-0.08, 0.08) * h;
    const tone = 0.32 + rnd.range(-0.06, 0.06);
    b.add('stone', g, mat(x + ox, yy + s * 0.5, z + oz, rnd.range(-0.3, 0.3), rnd.range(0, 6), 0), new THREE.Color(tone, tone * 1.02, tone * 1.08));
    yy += s * 0.95;
    r *= 0.78;
  }
  // a snow cap and the trail mark
  b.add('snow', new THREE.SphereGeometry(r * 1.2, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), mat(x, yy, z), 0xffffff);
  b.add('paint', new THREE.BoxGeometry(0.42, 0.1, 0.03), mat(x, yy - h * 0.18, z + r * 1.05), 0xc81e1e);
  b.add('paint', new THREE.BoxGeometry(0.1, 0.36, 0.03), mat(x, yy - h * 0.18 - 0.2, z + r * 1.05), 0xc81e1e);
}
