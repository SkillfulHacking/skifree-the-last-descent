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
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
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
  /** round 2: a gabled entrance porch over the side door */
  porch?: boolean;
  /** round 2: a dormer on the front roof slope */
  dormer?: boolean;
  /** round 2: trim colour (window frames, corner boards); default white */
  trim?: number;
  /** round 2: roof colour; default near-black (tarred / slate) */
  roof?: number;
}

/** a framed window (white frame, cross mullions, warm glass) on a wall facing local ±z or ±x */
function windowAt(b: Batch, M: THREE.Matrix4, x: number, y: number, z: number, axis: 'x' | 'z', sgn: number, w: number, h: number, trim: number, lit: boolean) {
  const t = 0.07;
  const off = 0.05 * sgn;
  const geo = (gw: number, gh: number, gd: number, dx: number, dy: number) => (axis === 'z' ? new THREE.BoxGeometry(gw, gh, gd).translate(x + dx, y + dy, z + off) : new THREE.BoxGeometry(gd, gh, gw).translate(x + off, y + dy, z + dx));
  b.add(lit ? 'glass' : 'paint', geo(w, h, 0.06, 0, 0), M, lit ? 0xffffff : 0x1c2026);
  b.add('paint', geo(w + 0.16, t, 0.1, 0, h / 2), M, trim);
  b.add('paint', geo(w + 0.22, t * 1.4, 0.16, 0, -h / 2), M, trim);
  b.add('paint', geo(t, h, 0.1, -w / 2, 0), M, trim);
  b.add('paint', geo(t, h, 0.1, w / 2, 0), M, trim);
  b.add('paint', geo(0.045, h, 0.1, 0, 0), M, trim);
  b.add('paint', geo(w, 0.045, 0.1, 0, 0.05), M, trim);
}

/**
 * A painted timber house at (x, y, z) facing `yaw` (gable ends along local ±x). `y` is the floor
 * (a stone footing runs 1.5 m below it so the house sits into uneven ground). Round 2: framed,
 * mullioned windows on one or two floors, a real front door with a frame, optional porch and dormer,
 * trim and roof colours.
 */
export function house(b: Batch, x: number, y: number, z: number, yaw: number, o: HouseOpts, rnd: Rand): void {
  const M = mat(x, y, z, 0, yaw, 0);
  const add = (key: string, g: THREE.BufferGeometry, color: number, m = M) => b.add(key, g, m, color);
  const roofH = o.roofH ?? o.d * 0.42;
  const trim = o.trim ?? TRIM;
  const roofC = o.roof ?? ROOF_DARK;
  // footing
  if (o.stilts) {
    for (let px = -o.w / 2 + 0.3; px <= o.w / 2 - 0.29; px += Math.max(1.6, (o.w - 0.6) / 3))
      for (const pz of [-o.d / 2 + 0.3, o.d / 2 - 0.3]) add('paint', new THREE.CylinderGeometry(0.16, 0.18, o.stilts + 0.4, 6).translate(px, -o.stilts / 2, pz), 0x3b2c22);
    // cross bracing between the stilts
    for (const pz of [-o.d / 2 + 0.3, o.d / 2 - 0.3]) add('paint', new THREE.BoxGeometry(o.w - 0.6, 0.12, 0.1).rotateZ(0.35).translate(0, -o.stilts * 0.45, pz), 0x3b2c22);
    add('paint', new THREE.BoxGeometry(o.w + 0.4, 0.25, o.d + 0.4).translate(0, -0.12, 0), 0x4a382a);
  } else add('stone', new THREE.BoxGeometry(o.w + 0.3, 1.6, o.d + 0.3).translate(0, -0.75, 0), 0x55585c);
  // walls: clapboard read from horizontal bands of slightly varied tone
  const body = new THREE.BoxGeometry(o.w, o.h, o.d, 1, Math.max(2, Math.round(o.h / 0.5)), 1).translate(0, o.h / 2, 0);
  const base = new THREE.Color(o.color);
  b.add('paint', body, M, (p) => {
    const k = 0.95 + 0.05 * Math.sin((p.y - y) * 12.6) + 0.03 * Math.sin(p.x * 0.7 + p.z * 0.9);
    return base.clone().multiplyScalar(k);
  });
  // gable ends
  add('paint', gable(o.w, o.d, roofH).translate(0, o.h, 0), o.color);
  // corner boards, fascia and a plinth board (trim)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) add('paint', new THREE.BoxGeometry(0.2, o.h, 0.2).translate((sx * o.w) / 2, o.h / 2, (sz * o.d) / 2), trim);
  for (const sz of [-1, 1]) add('paint', new THREE.BoxGeometry(o.w + 0.1, 0.22, 0.08).translate(0, o.h - 0.11, (sz * (o.d + 0.08)) / 2), trim);
  // roof + a thick snow load on top
  for (const g of roofSides(o.w, o.d, roofH, 0.18)) add('paint', g.translate(0, o.h, 0), roofC);
  for (const g of roofSides(o.w - 0.2, o.d * 0.98, roofH, 0.3)) add('snow', g.translate(0, o.h + 0.19, 0), 0xffffff);
  // windows: one or two floors along both long walls, one in each gable's attic
  if (o.windows !== false) {
    const floors = o.h > 6.6 ? 2 : 1;
    const n = Math.max(1, Math.floor(o.w / 2.4));
    for (let f = 0; f < floors; f++)
      for (const sz of [-1, 1])
        for (let i = 0; i < n; i++) {
          if (sz > 0 && f === 0 && i === Math.floor(n / 2) && o.door === 'side') continue;
          const wx = -o.w / 2 + (o.w * (i + 0.5)) / n;
          const wy = floors === 1 ? o.h * 0.55 : f === 0 ? o.h * 0.3 : o.h * 0.72;
          windowAt(b, M, wx, wy, (sz * o.d) / 2, 'z', sz, 0.85, 1.15, trim, rnd.next() < 0.65);
        }
    for (const sx of [-1, 1]) windowAt(b, M, (sx * o.w) / 2, o.h + roofH * 0.35, 0, 'x', sx, 0.7, 0.8, trim, rnd.next() < 0.5);
  }
  if (o.door === 'side') {
    const dz = o.d / 2;
    add('paint', new THREE.BoxGeometry(1.05, 2.05, 0.1).translate(0, 1.02, dz + 0.04), 0x3b2a1e);
    add('paint', new THREE.BoxGeometry(1.35, 0.12, 0.14).translate(0, 2.12, dz + 0.06), trim);
    for (const sx of [-1, 1]) add('paint', new THREE.BoxGeometry(0.12, 2.1, 0.14).translate(sx * 0.6, 1.05, dz + 0.06), trim);
    add('stone', new THREE.BoxGeometry(1.6, 0.25, 0.8).translate(0, -0.05, dz + 0.45), 0x6a6d70);
    if (o.porch) {
      // gabled porch roof on two posts
      const pr = 1.1;
      for (const sx of [-1, 1]) add('paint', new THREE.BoxGeometry(0.14, 2.5, 0.14).translate(sx * 0.95, 1.25, dz + 1.3), trim);
      const pg = gable(2.4, 2.4, 0.9).rotateY(Math.PI / 2).translate(0, 2.5, dz + 0.75);
      add('paint', pg, o.color);
      for (const g of roofSides(1.6, 2.4, 0.9, 0.12)) add('paint', g.rotateY(Math.PI / 2).translate(0, 2.5, dz + 0.75), roofC);
      for (const g of roofSides(1.5, 2.3, 0.9, 0.16)) add('snow', g.rotateY(Math.PI / 2).translate(0, 2.62, dz + 0.75), 0xffffff);
      void pr;
    }
  }
  if (o.door === 'boat') add('paint', new THREE.BoxGeometry(0.1, o.h * 0.8, o.d * 0.66).translate(-(o.w + 0.06) / 2, (o.h * 0.8) / 2, 0), 0x2b1e16);
  if (o.dormer) {
    const dw = Math.min(2.6, o.w * 0.3);
    const dh = roofH * 0.45;
    const dzc = o.d * 0.2;
    add('paint', new THREE.BoxGeometry(dw, dh + 0.4, 1.4).translate(0, o.h + dh * 0.5 + 0.1, dzc), o.color);
    windowAt(b, M, 0, o.h + dh * 0.5 + 0.1, dzc + 0.7, 'z', 1, 0.8, 0.7, trim, true);
    for (const g of roofSides(1.6, dw + 0.3, 0.6, 0.12)) add('paint', g.rotateY(Math.PI / 2).translate(0, o.h + dh + 0.35, dzc), roofC);
    for (const g of roofSides(1.5, dw + 0.2, 0.6, 0.16)) add('snow', g.rotateY(Math.PI / 2).translate(0, o.h + dh + 0.48, dzc), 0xffffff);
  }
  if (o.chimney) {
    const cx = o.w * 0.25;
    add('stone', new THREE.BoxGeometry(0.6, roofH + 1.2, 0.6).translate(cx, o.h + roofH * 0.6, -o.d * 0.15), 0x6b6560);
    add('snow', new THREE.BoxGeometry(0.66, 0.18, 0.66).translate(cx, o.h + roofH * 1.2 + 0.1, -o.d * 0.15), 0xffffff);
  }
}

/**
 * A tall waterfront warehouse ("sjøhus"): 2½–3 storeys, steep gable facing the water, stacked
 * loading doors with white frames up the gable, a hoist beam, small windows, on piles over the water
 * (`stilts`) or on the quay. Gable to local +x.
 */
export function warehouse(b: Batch, x: number, y: number, z: number, yaw: number, o: { w: number; d: number; h: number; color: number; stilts?: number }, rnd: Rand): void {
  const M = mat(x, y, z, 0, yaw, 0);
  house(b, x, y, z, yaw, { w: o.w, d: o.d, h: o.h, color: o.color, roofH: o.d * 0.62, stilts: o.stilts, windows: false, door: undefined, roof: 0x2a2624 }, rnd);
  const gx = o.w / 2 + 0.05;
  // stacked loading doors up the water gable
  for (let f = 0; f < 3; f++) {
    const yy = 1.2 + f * (o.h / 3);
    if (yy + 1.2 > o.h + o.d * 0.4) break;
    b.add('paint', new THREE.BoxGeometry(0.1, 1.9, 1.6).translate(gx, yy, 0), M, f === 0 ? 0x3b2a1e : 0x2b2420);
    b.add('paint', new THREE.BoxGeometry(0.14, 2.1, 0.12).translate(gx + 0.02, yy, 0.86), M, TRIM);
    b.add('paint', new THREE.BoxGeometry(0.14, 2.1, 0.12).translate(gx + 0.02, yy, -0.86), M, TRIM);
    b.add('paint', new THREE.BoxGeometry(0.14, 0.12, 1.84).translate(gx + 0.02, yy + 1.0, 0), M, TRIM);
  }
  // hoist beam with a block and rope at the gable peak
  b.add('paint', new THREE.BoxGeometry(1.8, 0.28, 0.28).translate(gx + 0.8, o.h + o.d * 0.3, 0), M, 0x3a2a1e);
  b.add('metal', new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4).translate(gx + 1.5, o.h + o.d * 0.3 - 1.3, 0), M, 0xc9b48a);
  // small windows along the long sides, two rows
  for (const sz of [-1, 1])
    for (let i = 0; i < Math.floor(o.w / 3); i++)
      for (const fy of [0.35, 0.72]) windowAt(b, M, -o.w / 2 + 1.6 + i * 3, o.h * fy, (sz * o.d) / 2, 'z', sz, 0.6, 0.75, TRIM, rnd.next() < 0.3);
}

/** A spark (kick-sled): the Nordic stand-up sledge, parked. Runners along local z. */
export function sparkSled(b: Batch, x: number, y: number, z: number, yaw: number, color: number): void {
  const M = mat(x, y, z, 0, yaw, 0);
  for (const sx of [-0.22, 0.22]) {
    b.add('metal', new THREE.BoxGeometry(0.03, 0.03, 1.9).translate(sx, 0.03, -0.2), M, 0x9aa0a8);
    b.add('metal', new THREE.CylinderGeometry(0.015, 0.015, 1.05, 5).rotateX(-0.25).translate(sx, 0.55, -0.85), M, 0x9aa0a8);
  }
  b.add('paint', new THREE.BoxGeometry(0.5, 0.05, 0.45).translate(0, 0.5, 0.15), M, color);
  b.add('paint', new THREE.BoxGeometry(0.5, 0.45, 0.05).translate(0, 0.72, -0.08), M, color);
  b.add('metal', new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5).rotateZ(Math.PI / 2).translate(0, 1.05, -0.98), M, 0x2a2a2a);
}

/** A stockfish drying rack ("hjell"): an A-frame timber rack hung with rows of split cod. */
export function fishRack(b: Batch, x: number, y: number, z: number, yaw: number, len: number, rnd: Rand): void {
  const M = mat(x, y, z, 0, yaw, 0);
  const H = 3.6;
  const spread = 1.4;
  const n = Math.max(2, Math.round(len / 3));
  for (let i = 0; i <= n; i++) {
    const px = -len / 2 + (i * len) / n;
    for (const s of [-1, 1]) b.add('planks', new THREE.CylinderGeometry(0.08, 0.1, H / Math.cos(0.36), 5).rotateX(s * 0.36).translate(px, H / 2, (s * spread) / 2), M, 0x6a5848);
  }
  for (const yy of [H * 0.95, H * 0.62, H * 0.32]) {
    const zz = (spread / 2) * (1 - yy / H);
    for (const s of [-1, 1]) b.add('planks', new THREE.BoxGeometry(len + 0.4, 0.09, 0.09).translate(0, yy, s * zz), M, 0x5a4a3c);
  }
  // fish: pairs tied at the tail hanging over each rail, slight variation, both faces of the A
  for (const yy of [H * 0.95, H * 0.62]) {
    const zz = (spread / 2) * (1 - yy / H);
    for (let k = -len / 2 + 0.25; k < len / 2; k += 0.28) {
      if (rnd.next() < 0.12) continue;
      const tone = 0.62 + rnd.range(-0.08, 0.08);
      const c = new THREE.Color(tone * 1.1, tone * 0.95, tone * 0.72);
      for (const s of [-1, 1]) {
        const g = new THREE.ConeGeometry(0.09, 0.75, 4).scale(1, 1, 0.45);
        b.add('paint', g, mat(x, y, z, 0, yaw, 0).multiply(new THREE.Matrix4().makeTranslation(k, yy - 0.42, s * (zz + 0.06))).multiply(new THREE.Matrix4().makeRotationX(Math.PI + s * 0.12)), c);
      }
    }
  }
  // snow on the top rail
  b.add('snow', new THREE.BoxGeometry(len + 0.3, 0.08, 0.14).translate(0, H * 0.95 + 0.08, 0), M, 0xffffff);
}

/** A row of individual deck planks (with gaps and tone variation) on stringers: a real boardwalk. */
export function plankDeck(b: Batch, cx: number, y: number, cz: number, yaw: number, len: number, width: number, rnd: Rand, key = 'planks'): void {
  const M = mat(cx, y, cz, 0, yaw, 0);
  const pw = 0.24;
  const gap = 0.025;
  for (let s = -len / 2 + pw / 2; s < len / 2; s += pw + gap) {
    const tone = 0.82 + rnd.range(-0.12, 0.1);
    const c = new THREE.Color(0x6b4e36).multiplyScalar(tone);
    // planks are laid across the walk (along local x), butt joints staggered
    b.add(key, new THREE.BoxGeometry(width, 0.06, pw).translate(rnd.range(-0.03, 0.03), 0, s), M, c);
  }
  // stringers and an edge fascia
  for (const sx of [-1, 1]) {
    b.add(key, new THREE.BoxGeometry(0.14, 0.28, len).translate((sx * (width - 0.14)) / 2, -0.17, 0), M, 0x3e2e22);
    b.add(key, new THREE.BoxGeometry(0.08, 0.32, len).translate((sx * width) / 2 + sx * 0.04, -0.12, 0), M, 0x4a3828);
  }
  b.add(key, new THREE.BoxGeometry(width * 0.4, 0.22, len).translate(0, -0.17, 0), M, 0x3e2e22);
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

/**
 * A wind-scoured granite outcrop on the rim (round 2, art review D4: coastal trackside dressing):
 * a half-buried whaleback with ochre and grey-green lichen, sea-spray rime on its seaward face and
 * snow lying in its lee. Base on the ground at y.
 */
export function rimOutcrop(b: Batch, x: number, y: number, z: number, size: number, rnd: Rand): void {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const P = g.attributes.position as THREE.BufferAttribute;
  const k1 = rnd.range(0, 10);
  const k2 = rnd.range(0, 10);
  for (let i = 0; i < P.count; i++) {
    const vx = P.getX(i);
    const vy = P.getY(i);
    const vz = P.getZ(i);
    const n = 1 + 0.16 * Math.sin(vx * 3.1 + k1) * Math.cos(vz * 2.7 + k2) + 0.08 * Math.sin(vy * 5.3 + k1);
    P.setXYZ(i, vx * n * 1.5, vy * n * 0.62, vz * n);
  }
  g.computeVertexNormals();
  const yaw = rnd.range(-0.3, 0.3);
  b.add(
    'rock',
    g,
    mat(x, y - size * 0.22, z, rnd.range(-0.1, 0.1), yaw, rnd.range(-0.08, 0.08), size),
    (p, n) => {
      const t = 0.2 + 0.05 * Math.sin(p.x * 2.1 + p.z * 1.7);
      const c = new THREE.Color(t, t * 1.02, t * 1.08);
      // lichen: ochre and grey-green blotches on the upper surfaces
      const l = Math.sin(p.x * 3.7 + p.z * 2.9) * Math.cos(p.z * 3.3 - p.x * 1.3);
      if (n.y > 0.2 && l > 0.45) c.lerp(new THREE.Color(0.55, 0.42, 0.14), 0.55);
      else if (n.y > 0.1 && l < -0.55) c.lerp(new THREE.Color(0.38, 0.44, 0.34), 0.5);
      // rime on the seaward (−x) face
      if (n.x < -0.45) c.lerp(new THREE.Color(0.82, 0.86, 0.9), 0.55 * Math.min(1, (-n.x - 0.45) * 3));
      // snow in the lee (+x), on top
      if (n.y > 0.75 && n.x > -0.1) c.lerp(new THREE.Color(0.92, 0.94, 0.98), 0.85);
      return c;
    },
  );
}
