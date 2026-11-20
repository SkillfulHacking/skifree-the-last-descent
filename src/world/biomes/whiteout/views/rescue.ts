/**
 * "whiteout-rescue" finish: the mountain-rescue station at the foot of the ridge.
 *
 * Full production (brief §7). A timber-clad station on a dry-stone base — the warm heart of a grey
 * world, aimed for through the storm:
 *  - the main hall: vertical red-stained boarding (canvas texture + bump), white corner trims and
 *    window frames with mullions, warm light behind every pane, a steep gable roof with a deep eave,
 *    a thick wind-shaped snow load curling over the eave and a fringe of icicles along it (hung from
 *    the eave line itself), the rescue cross on both gables and the sign over the porch;
 *  - a covered porch (posts, deck, its own small roof) in front of the door; the door swings open
 *    on a warm interior (the victory);
 *  - a lean-to garage on the side with its roller door half up, light spilling under it and the
 *    snowcat's nose parked half inside;
 *  - wind drifts banked against the walls (seated in the terrain), snow on every horizontal;
 *  - a lattice radio mast with the red beacon and a searchlight sweeping the slope through the snow;
 *  - the snowcat (tracks, cab with framed windows, amber light bar, snow load) and an akja rescue
 *    sled; a stack of avalanche probes and a pair of skis by the porch;
 *  - two rescuers in red jackets and helmets on the porch who wave the skier in and cheer;
 *  - the trophy: a brass storm lantern on a stone plinth beside the door.
 */
import * as THREE from 'three';
import type { CircleCollider, FinishBuildContext, FinishEnvironment, FinishState } from '../../../presentation/finish';
import { Guest, type GuestLook } from '../../../resort/Guest';

const C = {
  hutW: 10,
  hutD: 7.5,
  wall: 3.6,
  roof: 3.6,
  eave: 0.9,
  /** the hut stands this far below the finish line, to the side of the run-out */
  ahead: 34,
  side: 15,
  garageW: 5.2,
  garageD: 6.8,
  garageH: 3.4,
} as const;

/**
 * Where the station stands, which way its door faces, and the skier's and the Yeti's marks (xz;
 * pure — the view builds from it, and victory_steer.test.ts checks the stop against it).
 */
export function rescueLayout(m: { routeX(z: number): number; centerX(z: number): number }, F: { x: number; z: number }) {
  const z = F.z + C.ahead;
  const side = m.routeX(F.z) >= m.centerX(F.z) ? -1 : 1;
  const x = m.routeX(z) + side * C.side;
  const faces = new THREE.Vector3(F.x - x, 0, F.z - z).normalize();
  const yaw = Math.atan2(faces.x, faces.z);
  const local = (lx: number, lz: number) => new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(x, 0, z));
  const door = local(DOOR_X, C.hutD / 2 + 0.6);
  const stop = door.clone().addScaledVector(faces, STOP_OUT);
  const across = new THREE.Vector3(faces.z, 0, -faces.x);
  const yeti = door.clone().addScaledVector(faces, 30).addScaledVector(across, -side * 12);
  return { x, z, side, faces, yaw, door, stop, yeti };
}
/** the door's offset along the front of the hall, and the skier's mark this far out from it */
const DOOR_X = -2.4;
const STOP_OUT = 8;

function signTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#1b1b1f';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = '#c41a12';
  g.fillRect(24, 24, 80, 80);
  g.fillStyle = '#f4f1ea';
  g.fillRect(54, 34, 20, 60);
  g.fillRect(34, 54, 60, 20);
  g.fillStyle = '#1b1b1f';
  g.font = 'bold 40px sans-serif';
  g.textBaseline = 'middle';
  g.fillText('MOUNTAIN RESCUE', 124, 52);
  g.font = '24px sans-serif';
  g.fillText('RIDGE STATION  ·  2,412 m', 126, 94);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** vertical boarding: stained boards, grain, dark gaps (albedo) and the matching bump map */
function boardTextures(): { map: THREE.Texture; bump: THREE.Texture } {
  const W = 256;
  const a = document.createElement('canvas');
  const b = document.createElement('canvas');
  a.width = a.height = b.width = b.height = W;
  const g = a.getContext('2d')!;
  const h = b.getContext('2d')!;
  let s = 12345;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const boards = 8;
  for (let i = 0; i < boards; i++) {
    const x0 = (i / boards) * W;
    const tone = 0.82 + 0.18 * r();
    g.fillStyle = `rgb(${Math.round(150 * tone)},${Math.round(34 * tone)},${Math.round(26 * tone)})`;
    g.fillRect(x0, 0, W / boards, W);
    h.fillStyle = '#c0c0c0';
    h.fillRect(x0, 0, W / boards, W);
    // grain
    for (let k = 0; k < 26; k++) {
      const gx = x0 + r() * (W / boards);
      g.strokeStyle = `rgba(40,8,6,${0.08 + 0.12 * r()})`;
      g.lineWidth = 0.6 + r();
      g.beginPath();
      g.moveTo(gx, 0);
      g.bezierCurveTo(gx + (r() - 0.5) * 6, W * 0.3, gx + (r() - 0.5) * 6, W * 0.7, gx + (r() - 0.5) * 4, W);
      g.stroke();
    }
    // the gap between boards (dark, recessed)
    g.fillStyle = 'rgba(20,6,5,0.9)';
    g.fillRect(x0, 0, 2, W);
    h.fillStyle = '#202020';
    h.fillRect(x0, 0, 2, W);
    // weathering at the foot
    const grd = g.createLinearGradient(0, W * 0.75, 0, W);
    grd.addColorStop(0, 'rgba(60,40,35,0)');
    grd.addColorStop(1, 'rgba(60,40,35,0.25)');
    g.fillStyle = grd;
    g.fillRect(x0, W * 0.75, W / boards, W * 0.25);
  }
  const map = new THREE.CanvasTexture(a);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(b);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  return { map, bump };
}

let glowTex: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** a gable prism (width w across x, height h, depth d along z), base at y = 0 */
function gable(w: number, h: number, d: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(w / 2, 0);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

/** one roof slope's snow load: a thick slab with a rounded, curling lower edge (local: along +x down the slope) */
function roofSnow(len: number, depth: number, thick: number, curl: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(len, 0);
  s.quadraticCurveTo(len + curl, thick * 0.2, len + curl * 0.6, thick * 0.95);
  s.quadraticCurveTo(len * 0.5, thick * 1.25, 0, thick);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

const RESCUER_BASE = { hatColor: 0xffffff, hatColor2: 0xffffff, scarf: null, fur: null, mug: null, mugColor: 0xffffff, lips: 0xa0605a, beard: false } as const;
const RESCUERS: GuestLook[] = [
  { ...RESCUER_BASE, male: true, height: 1.84, skin: 0xe0b090, hair: 0x4a3426, hairStyle: 'short', headwear: 'beanie', hatColor: 0xf2f2ee, hatColor2: 0xc8241a, top: 'parka', topColor: 0xc8241a, accent: 0x1b1b1f, pants: 'ski', pantsColor: 0x1d2330, boots: 'snow', bootColor: 0x1a1a1a, gloves: 0x1a1a1a, eyes: 0x4a6a8a, beard: true },
  { ...RESCUER_BASE, male: false, height: 1.7, skin: 0xc89070, hair: 0x2a1c14, hairStyle: 'ponytail', headwear: 'beanie', hatColor: 0xc8241a, hatColor2: 0xf2f2ee, top: 'skiJacket', topColor: 0xd02a1c, accent: 0xf0f0ea, pants: 'ski', pantsColor: 0x1d2330, boots: 'snow', bootColor: 0x2a2a2a, gloves: 0x1a1a1a, eyes: 0x5a4030 },
];

export class RescueStation implements FinishEnvironment {
  readonly group = new THREE.Group();
  readonly trophy: THREE.Object3D;
  readonly finishZ: number;
  /** the hut's door (world), the warm light the skier aims for */
  readonly door = new THREE.Vector3();
  /** the hut's centre on the ground and the direction its door faces (unit, xz) */
  readonly hut = new THREE.Vector3();
  readonly faces = new THREE.Vector3();
  readonly beaconPos = new THREE.Vector3();
  /** the rescuers on the porch (the victory script cues them) */
  readonly rescuers: Guest[] = [];
  private stop = new THREE.Vector3();
  private yetiPt = new THREE.Vector3();
  private podium = new THREE.Vector3();
  private cols: CircleCollider[] = [];
  private disposables: Array<{ dispose(): void }> = [];
  private beacon: THREE.Sprite;
  private lightBar: THREE.Sprite;
  private doorLight: THREE.PointLight;
  private search: THREE.SpotLight;
  private beam: THREE.Mesh;
  private searchPivot = new THREE.Object3D();
  private windsock: THREE.Mesh;
  private smoke: THREE.Points;
  private smokeBase = new THREE.Vector3();
  private doorLeaf: THREE.Mesh;
  /** 0..1: how far the door is open (the victory opens it) */
  doorOpen = 0;
  /** 0..1 rescuers' welcome (the victory raises it on arrival) */
  welcome = 0;
  /** 0..1 rescuers' cheer (the lantern beat) */
  cheer = 0;
  /** where the searchlight points (world); null: it sweeps the slope */
  searchTarget: THREE.Vector3 | null = null;
  /** 0..1 the lantern raised (the lantern beat): its glow and light swell (W-042) */
  lanternUp = 0;
  private aimCur: THREE.Vector3 | null = null;
  private flame: THREE.PointLight | null = null;
  private halo: THREE.Sprite | null = null;

  constructor(ctx: FinishBuildContext) {
    const H = ctx.heightAt;
    const F = ctx.finishCenter;
    this.finishZ = F.z;
    this.group.name = 'rescue-station';
    const m = ctx.mountain;
    // the run-out bends toward the hut: it stands to the side of the line, below the finish
    const L = rescueLayout(m, F);
    const { x, z, side } = L;
    // level pad on the high corner; the low side stands on the stone base (never buried, never floating)
    let maxY = -Infinity;
    let minY = Infinity;
    const W2 = C.hutW / 2 + C.garageW;
    for (const [dx, dz] of [[-W2, -C.hutD / 2], [W2, -C.hutD / 2], [-W2, C.hutD / 2 + 2], [W2, C.hutD / 2 + 2], [0, 0]] as const) {
      const hy = H(x + dx, z + dz);
      maxY = Math.max(maxY, hy);
      minY = Math.min(minY, hy);
    }
    const y0 = maxY - 0.3;
    const footing = y0 - minY + 0.9;
    this.hut.set(x, y0, z);
    // the door faces back up toward the arriving skier (toward the finish line)
    this.faces.set(F.x - x, 0, F.z - z).normalize();
    const yaw = Math.atan2(this.faces.x, this.faces.z);
    const hut = new THREE.Group();
    hut.position.set(x, y0, z);
    hut.rotation.y = yaw;
    this.group.add(hut);
    const toWorld = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(this.hut);
    const mk = <T extends THREE.Material>(mat: T): T => {
      this.disposables.push(mat);
      return mat;
    };
    const geo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.disposables.push(g);
      return g;
    };
    const boards = boardTextures();
    this.disposables.push(boards.map, boards.bump);
    const wallM = (rx: number, ry: number) => {
      const map = boards.map.clone();
      const bump = boards.bump.clone();
      map.repeat.set(rx, ry);
      bump.repeat.set(rx, ry);
      map.needsUpdate = bump.needsUpdate = true;
      this.disposables.push(map, bump);
      return mk(new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.82 }));
    };
    const trim = mk(new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.6 }));
    const roofM = mk(new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.55, metalness: 0.35 }));
    const snowM = mk(new THREE.MeshStandardMaterial({ color: 0xf4f7fc, roughness: 0.9 }));
    const stone = mk(new THREE.MeshStandardMaterial({ color: 0x5c6068, roughness: 0.95 }));
    // unlit: the lit door and windows must glow through the storm whatever the exposure
    const warm = mk(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.66, 0.28) }));
    const warmDim = mk(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.78, 0.45, 0.18) }));
    const dark = mk(new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.8 }));
    const steel = mk(new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.4, metalness: 0.7 }));
    const yellow = mk(new THREE.MeshStandardMaterial({ color: 0xe8b416, roughness: 0.55 }));
    const red = mk(new THREE.MeshStandardMaterial({ color: 0xb3241a, roughness: 0.55, metalness: 0.15 }));
    const glass = mk(new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.08, metalness: 0.3 }));
    const ice = mk(new THREE.MeshStandardMaterial({ color: 0xd6eaf8, roughness: 0.12, transparent: true, opacity: 0.88 }));
    const wood = mk(new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.8 }));
    const add = (g: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, parent: THREE.Object3D = hut, cast = true) => {
      const mesh = new THREE.Mesh(geo(g), mat);
      mesh.position.set(px, py, pz);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const FL = 0.7; // floor level above the pad
    // --- the main hall
    add(new THREE.BoxGeometry(C.hutW, C.wall, C.hutD), wallM(5, 1.4), 0, FL + C.wall / 2, 0);
    // the stone base, down to the lowest ground
    add(new THREE.BoxGeometry(C.hutW + 0.3, FL + footing, C.hutD + 0.3), stone, 0, (FL - footing) / 2, 0);
    // corner trims
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.22, C.wall, 0.22), trim, sx * (C.hutW / 2 + 0.02), FL + C.wall / 2, sz * (C.hutD / 2 + 0.02));
    // the roof: a steep gable along x (the ridge runs along z), deep eaves
    const roofY = FL + C.wall;
    add(gable(C.hutW + 2 * C.eave, C.roof, C.hutD + 1.4), roofM, 0, roofY, 0);
    // gable infill boarding
    for (const s of [1, -1]) {
      const gi = add(gable(C.hutW, C.roof - 0.25, 0.1), wallM(4, 1), 0, roofY, s * (C.hutD / 2 - 0.02));
      gi.castShadow = false;
    }
    // the snow load on each slope (thick, wind-shaped, curling over the eave)
    const pitch = Math.atan2(C.roof, C.hutW / 2 + C.eave);
    const slopeLen = Math.hypot(C.roof, C.hutW / 2 + C.eave);
    for (const s of [1, -1]) {
      const sn = add(roofSnow(slopeLen - 0.3, C.hutD + 1.5, s > 0 ? 0.62 : 0.4, 0.55), snowM, 0, roofY + C.roof + 0.04, 0);
      sn.rotation.set(0, s > 0 ? 0 : Math.PI, -pitch);
      // icicles along this eave (hung from the eave line itself)
      const n = 16;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const len = 0.25 + 0.75 * Math.abs(Math.sin(i * 2.7 + s));
        if ((i * 7 + (s > 0 ? 3 : 0)) % 5 === 0) continue;
        const ic = add(new THREE.ConeGeometry(0.05 + 0.03 * Math.abs(Math.sin(i * 1.3)), len, 5), ice, s * (C.hutW / 2 + C.eave - 0.05), roofY - len / 2 + 0.02, (t - 0.5) * (C.hutD + 1.2), hut, false);
        ic.rotation.x = Math.PI;
      }
    }
    // rescue cross on both gables, high
    for (const s of [1, -1]) {
      add(new THREE.BoxGeometry(0.5, 1.6, 0.06), trim, 0, roofY + 1.3, s * (C.hutD / 2 + 0.05));
      add(new THREE.BoxGeometry(1.6, 0.5, 0.06), trim, 0, roofY + 1.3, s * (C.hutD / 2 + 0.05));
      add(new THREE.BoxGeometry(0.34, 1.44, 0.07), red, 0, roofY + 1.3, s * (C.hutD / 2 + 0.06), hut, false);
      add(new THREE.BoxGeometry(1.44, 0.34, 0.07), red, 0, roofY + 1.3, s * (C.hutD / 2 + 0.06), hut, false);
    }
    // windows: warm pane recessed in a white frame with a mullion cross (front, back and side)
    const window = (px: number, pz: number, ry: number, w = 1.2, hh = 1.0, lit = warm) => {
      const g = new THREE.Group();
      g.position.set(px, FL + 2.0, pz);
      g.rotation.y = ry;
      hut.add(g);
      add(new THREE.PlaneGeometry(w, hh), lit, 0, 0, -0.03, g, false);
      add(new THREE.BoxGeometry(w + 0.24, 0.12, 0.12), trim, 0, hh / 2 + 0.06, 0.02, g, false);
      add(new THREE.BoxGeometry(w + 0.34, 0.14, 0.22), trim, 0, -hh / 2 - 0.07, 0.06, g, false);
      add(new THREE.BoxGeometry(0.12, hh, 0.12), trim, -w / 2 - 0.06, 0, 0.02, g, false);
      add(new THREE.BoxGeometry(0.12, hh, 0.12), trim, w / 2 + 0.06, 0, 0.02, g, false);
      add(new THREE.BoxGeometry(0.06, hh, 0.06), trim, 0, 0, 0.02, g, false);
      add(new THREE.BoxGeometry(w, 0.06, 0.06), trim, 0, 0, 0.02, g, false);
      // a little snow on the sill
      add(new THREE.BoxGeometry(w + 0.2, 0.08, 0.2), snowM, 0, -hh / 2 + 0.01, 0.08, g, false);
    };
    for (const wx of [1.6, 3.6]) window(wx, C.hutD / 2 + 0.01, 0);
    for (const wx of [-3, 0.6, 3.4]) window(wx, -C.hutD / 2 - 0.01, Math.PI, 1.2, 1.0, warmDim);
    for (const wz of [-1.8, 1.8]) window(-C.hutW / 2 - 0.01, wz, -Math.PI / 2);
    // --- the porch and the door
    const doorX = DOOR_X;
    const doorFrame = add(new THREE.BoxGeometry(1.5, 2.3, 0.1), warm, doorX, FL + 1.15, C.hutD / 2 + 0.02, hut, false);
    doorFrame.name = 'door-light';
    add(new THREE.BoxGeometry(1.8, 0.16, 0.16), trim, doorX, FL + 2.38, C.hutD / 2 + 0.06, hut, false);
    const leafG = new THREE.BoxGeometry(1.4, 2.2, 0.08);
    leafG.translate(0.7, 0, 0);
    this.doorLeaf = add(leafG, mk(new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.7 })), doorX - 0.7, FL + 1.12, C.hutD / 2 + 0.08);
    // the deck, two posts and the porch roof (with its own snow)
    const deckD = 2.4;
    add(new THREE.BoxGeometry(4.2, 0.18, deckD), wood, doorX, FL - 0.09, C.hutD / 2 + deckD / 2);
    add(new THREE.BoxGeometry(4.2, FL + footing * 0.5, 0.2), stone, doorX, (FL - footing * 0.5) / 2 - 0.1, C.hutD / 2 + deckD - 0.1);
    for (const px of [doorX - 1.9, doorX + 1.9]) add(new THREE.BoxGeometry(0.18, 2.6, 0.18), wood, px, FL + 1.3, C.hutD / 2 + deckD - 0.15);
    const porchRoof = add(new THREE.BoxGeometry(4.6, 0.14, deckD + 0.5), roofM, doorX, FL + 2.72, C.hutD / 2 + deckD / 2);
    porchRoof.rotation.x = -0.18;
    const porchSnow = add(new THREE.BoxGeometry(4.5, 0.3, deckD + 0.4), snowM, doorX, FL + 2.94, C.hutD / 2 + deckD / 2);
    porchSnow.rotation.x = -0.18;
    // the sign over the porch
    const signTex = signTexture();
    this.disposables.push(signTex);
    add(new THREE.PlaneGeometry(4.6, 1.15), mk(new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 })), 1.6, FL + C.wall - 0.55, C.hutD / 2 + 0.07, hut, false);
    // probes and skis by the porch
    for (let k = 0; k < 5; k++) {
      const p = add(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 4), yellow, doorX + 2.3 + k * 0.05, FL + 1.1, C.hutD / 2 + 0.25, hut, false);
      p.rotation.z = 0.12;
    }
    for (const sx of [0, 0.14]) {
      const ski = add(new THREE.BoxGeometry(0.08, 1.75, 0.02), red, doorX - 2.3 - sx, FL + 0.9, C.hutD / 2 + 0.12, hut, false);
      ski.rotation.z = -0.08;
    }
    // chimney + smoke
    add(new THREE.BoxGeometry(0.8, 2.2, 0.8), stone, 2.8, roofY + C.roof * 0.55, -1.4);
    add(new THREE.BoxGeometry(0.95, 0.25, 0.95), snowM, 2.8, roofY + C.roof * 0.55 + 1.2, -1.4, hut, false);
    this.smokeBase.copy(toWorld(2.8, roofY + C.roof * 0.55 + 1.5, -1.4));
    const sp = new Float32Array(48 * 3);
    const sg = geo(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const smokeM = mk(new THREE.PointsMaterial({ size: 1.8, map: glow(), color: 0xd8dade, transparent: true, opacity: 0.35, depthWrite: false }));
    this.smoke = new THREE.Points(sg, smokeM);
    this.smoke.frustumCulled = false;
    this.group.add(this.smoke);
    // the porch light: a warm point light that reaches the snow in front of the door
    this.doorLight = new THREE.PointLight(0xffb060, 20, 24, 1.6);
    this.doorLight.position.set(doorX, FL + 2.5, C.hutD / 2 + 1.4);
    hut.add(this.doorLight);
    add(new THREE.SphereGeometry(0.14, 10, 8), warm, doorX, FL + 2.55, C.hutD / 2 + 0.2, hut, false);
    this.door.copy(toWorld(doorX, FL, C.hutD / 2 + 0.6));
    // --- the garage lean-to on the side (+x), its roller door half up, light spilling under it
    const gx = C.hutW / 2 + C.garageW / 2;
    const gz = C.hutD / 2 - C.garageD / 2 + 0.6;
    add(new THREE.BoxGeometry(C.garageW, C.garageH, C.garageD), wallM(2.6, 1.3), gx, FL + C.garageH / 2 - 0.4, gz);
    add(new THREE.BoxGeometry(C.garageW + 0.3, FL + footing, C.garageD + 0.3), stone, gx, (FL - footing) / 2 - 0.4, gz);
    const gRoof = add(new THREE.BoxGeometry(C.garageW + 0.9, 0.16, C.garageD + 0.9), roofM, gx + 0.2, FL + C.garageH - 0.25, gz);
    gRoof.rotation.z = -0.22;
    const gSnow = add(new THREE.BoxGeometry(C.garageW + 0.8, 0.45, C.garageD + 0.8), snowM, gx + 0.2, FL + C.garageH + 0.02, gz);
    gSnow.rotation.z = -0.22;
    // roller door (half up) and the lit interior below it
    const gdZ = gz + C.garageD / 2 + 0.02;
    add(new THREE.PlaneGeometry(C.garageW - 0.8, 1.3), warm, gx, FL + 0.25, gdZ, hut, false);
    const roller = add(new THREE.BoxGeometry(C.garageW - 0.6, 1.6, 0.1), mk(new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.5, metalness: 0.4 })), gx, FL + 1.95, gdZ + 0.04);
    roller.castShadow = false;
    // --- wind drifts banked against the walls (mounds seated in the terrain)
    const drift = (lx: number, lz: number, len: number, h: number, ry: number) => {
      const g = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = toWorld(lx, 0, lz);
      const gy = H(p.x, p.z);
      const mesh = new THREE.Mesh(geo(g), snowM);
      mesh.scale.set(len, h, h * 1.6);
      mesh.rotation.y = yaw + ry;
      mesh.position.set(p.x, Math.min(gy, y0) - 0.35, p.z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    drift(0, -C.hutD / 2 - 0.4, C.hutW * 0.62, 1.4, 0);
    drift(-C.hutW / 2 - 0.4, 0, C.hutD * 0.55, 1.2, Math.PI / 2);
    drift(gx + 1.4, gz - C.garageD / 2 - 0.4, C.garageW * 0.6, 1.0, 0);
    drift(3.6, C.hutD / 2 + 0.5, 1.8, 0.8, 0);
    // --- the radio mast (lattice) with the beacon, the windsock and the searchlight
    const mastLocal = new THREE.Vector3(-C.hutW / 2 - 2.6, 0, -1.8);
    const mast = new THREE.Group();
    mast.position.set(mastLocal.x, FL - 0.5, mastLocal.z);
    hut.add(mast);
    const mastH = 14;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      add(new THREE.CylinderGeometry(0.04, 0.05, mastH, 5), steel, Math.cos(a) * 0.32, mastH / 2, Math.sin(a) * 0.32, mast);
    }
    for (let j = 0; j < 13; j++) {
      for (let k = 0; k < 3; k++) {
        const a0 = (k / 3) * Math.PI * 2;
        const a1 = ((k + 1) / 3) * Math.PI * 2;
        const p0 = new THREE.Vector3(Math.cos(a0) * 0.32, j + 0.4, Math.sin(a0) * 0.32);
        const p1 = new THREE.Vector3(Math.cos(a1) * 0.32, j + 1.4, Math.sin(a1) * 0.32);
        const br = add(new THREE.CylinderGeometry(0.015, 0.015, p0.distanceTo(p1), 3), steel, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2, mast, false);
        br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
      }
    }
    this.beaconPos.copy(toWorld(mastLocal.x, FL - 0.5 + mastH + 0.3, mastLocal.z));
    const bm = mk(new THREE.SpriteMaterial({ map: glow(), color: 0xff2a14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.beacon = new THREE.Sprite(bm);
    this.beacon.position.copy(this.beaconPos);
    this.beacon.scale.setScalar(3);
    this.group.add(this.beacon);
    const sockG = new THREE.ConeGeometry(0.35, 2.2, 10, 1, true);
    sockG.rotateZ(Math.PI / 2);
    sockG.translate(1.1, 0, 0);
    this.windsock = add(sockG, mk(new THREE.MeshStandardMaterial({ color: 0xff6a10, roughness: 0.7, side: THREE.DoubleSide })), 0, mastH - 2.2, 0, mast);
    // the searchlight: a lamp head at 10 m, a real spot light and a faint visible beam in the snow
    const head = new THREE.Group();
    head.position.set(0, 10, 0);
    mast.add(head);
    head.add(this.searchPivot);
    add(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 12), dark, 0, 0, 0.1, this.searchPivot).rotation.x = Math.PI / 2;
    add(new THREE.CircleGeometry(0.27, 16), mk(new THREE.MeshBasicMaterial({ color: 0xfff4dc })), 0, 0, 0.36, this.searchPivot, false);
    this.search = new THREE.SpotLight(0xfff0d8, 220, 140, 0.16, 0.6, 1.4);
    this.search.castShadow = false;
    this.search.position.set(0, 0, 0.4);
    this.searchPivot.add(this.search);
    const tgt = new THREE.Object3D();
    tgt.position.set(0, 0, 30);
    this.searchPivot.add(tgt);
    this.search.target = tgt;
    const beamG = new THREE.ConeGeometry(4.6, 60, 18, 1, true);
    beamG.translate(0, -30, 0);
    beamG.rotateX(-Math.PI / 2);
    const beamM = mk(
      new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0.12 } },
        vertexShader: 'varying float vD; void main(){ vD = -position.z / 60.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uK; varying float vD; void main(){ gl_FragColor = vec4(1.0, 0.95, 0.85, uK * (1.0 - vD) * smoothstep(0.0, 0.08, vD)); }',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.beam = new THREE.Mesh(geo(beamG), beamM);
    this.beam.position.set(0, 0, 0.4);
    this.beam.frustumCulled = false;
    this.searchPivot.add(this.beam);
    // --- the snowcat, half inside the garage (nose out), and the akja sled
    const cat = new THREE.Group();
    cat.position.set(gx, FL - 0.35, gz + C.garageD / 2 + 0.6);
    cat.rotation.y = 0.05;
    hut.add(cat);
    for (const s of [-1, 1]) {
      // tracks: a rounded run (capsule on its side) with tread bands
      const tr = new THREE.CapsuleGeometry(0.42, 3.8, 6, 12);
      tr.rotateX(Math.PI / 2);
      add(tr, dark, s * 1.32, 0.45, 0, cat);
    }
    add(new THREE.BoxGeometry(2.3, 0.9, 4.2), red, 0, 1.15, -0.1, cat);
    const nose = add(new THREE.BoxGeometry(2.3, 0.7, 1.2), red, 0, 1.0, 2.2, cat);
    nose.rotation.x = 0.35;
    add(new THREE.BoxGeometry(2.1, 1.25, 1.9), red, 0, 2.2, -0.6, cat);
    add(new THREE.BoxGeometry(1.92, 0.85, 1.94), glass, 0, 2.3, -0.6, cat, false);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 1.0, 0.08), dark, s * 0.97, 2.3, 0.37, cat, false);
    add(new THREE.BoxGeometry(2.0, 0.3, 1.8), snowM, 0, 2.95, -0.6, cat);
    add(new THREE.BoxGeometry(3.4, 0.95, 0.25), yellow, 0, 0.7, 2.95, cat);
    add(new THREE.BoxGeometry(1.2, 0.14, 0.24), dark, 0, 2.95, 0.25, cat, false);
    const lb = mk(new THREE.SpriteMaterial({ map: glow(), color: 0xffa020, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.lightBar = new THREE.Sprite(lb);
    this.lightBar.scale.setScalar(1.2);
    this.lightBar.position.set(0, 3.1, 0.25);
    cat.add(this.lightBar);
    // the akja: a boat-shaped rescue sled with handles and a blanket
    const akja = new THREE.Group();
    akja.position.set(doorX - 3.2, FL - 0.2, C.hutD / 2 + 3.4);
    akja.rotation.y = 0.55;
    hut.add(akja);
    const hullPts = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.38, 0.05), new THREE.Vector2(0.45, 0.28), new THREE.Vector2(0.42, 0.36)];
    const hull = new THREE.LatheGeometry(hullPts, 18, Math.PI / 2, Math.PI);
    hull.scale(1, 1, 3.4);
    add(hull, mk(new THREE.MeshStandardMaterial({ color: 0xd8361e, roughness: 0.4, side: THREE.DoubleSide })), 0, 0.02, 0, akja);
    add(new THREE.BoxGeometry(0.62, 0.12, 1.6), mk(new THREE.MeshStandardMaterial({ color: 0xf0b018, roughness: 0.9 })), 0, 0.26, 0.1, akja);
    for (const s of [-1, 1]) {
      const h1 = add(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5), steel, s * 0.32, 0.5, 1.9, akja, false);
      h1.rotation.x = 1.15;
    }
    // --- the trophy: a brass storm lantern (held part first) on a stone plinth beside the door
    const tro = new THREE.Group();
    tro.name = 'Trophy';
    const brass = mk(new THREE.MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.28 }));
    const lantern = new THREE.Group();
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 16), brass, 0, 0.04, 0, lantern);
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.34, 16), mk(new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: new THREE.Color(1, 0.7, 0.3), emissiveIntensity: 2.5, transparent: true, opacity: 0.9 })), 0, 0.25, 0, lantern, false);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      add(new THREE.BoxGeometry(0.02, 0.36, 0.02), brass, Math.cos(a) * 0.15, 0.25, Math.sin(a) * 0.15, lantern);
    }
    add(new THREE.ConeGeometry(0.19, 0.16, 16), brass, 0, 0.5, 0, lantern);
    add(new THREE.TorusGeometry(0.08, 0.012, 6, 16), brass, 0, 0.62, 0, lantern);
    const flame = new THREE.PointLight(0xffa850, 4, 7, 1.8);
    flame.position.set(0, 0.25, 0);
    lantern.add(flame);
    this.flame = flame;
    // (W-042) a warm halo round the glass — the lantern reads as a light, not a brass object, in the
    // storm and at gameplay resolution
    const haloC = document.createElement('canvas');
    haloC.width = haloC.height = 64;
    const hg = haloC.getContext('2d');
    if (hg) {
      const grad = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,214,150,1)');
      grad.addColorStop(0.25, 'rgba(255,170,80,0.55)');
      grad.addColorStop(1, 'rgba(255,140,40,0)');
      hg.fillStyle = grad;
      hg.fillRect(0, 0, 64, 64);
    }
    const haloT = new THREE.CanvasTexture(haloC);
    haloT.colorSpace = THREE.SRGBColorSpace;
    this.disposables.push(haloT);
    const haloM = new THREE.SpriteMaterial({ map: haloT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.55 });
    this.disposables.push(haloM);
    const halo = new THREE.Sprite(haloM);
    halo.position.set(0, 0.26, 0);
    halo.scale.setScalar(0.9);
    halo.renderOrder = 9;
    lantern.add(halo);
    this.halo = halo;
    tro.add(lantern);
    const plinth = new THREE.Group();
    add(new THREE.BoxGeometry(0.6, 1.1, 0.6), stone, 0, -0.55, 0, plinth);
    add(new THREE.BoxGeometry(0.66, 0.06, 0.66), snowM, 0, 0.0, 0, plinth, false);
    tro.add(plinth);
    this.podium.copy(toWorld(doorX + 1.8, FL + 1.1, C.hutD / 2 + 1.5));
    this.podium.y = Math.max(this.podium.y, H(this.podium.x, this.podium.z) + 1.1);
    tro.position.copy(this.podium);
    this.trophy = tro;
    this.group.add(tro);
    // marker poles leading from the finish line to the door
    const pole = geo(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6));
    const poleM = mk(new THREE.MeshStandardMaterial({ color: 0xf06010, roughness: 0.5, emissive: new THREE.Color(0.3, 0.08, 0), emissiveIntensity: 0.4 }));
    for (let k = 1; k <= 3; k++) {
      const p = new THREE.Vector3().lerpVectors(new THREE.Vector3(F.x, 0, F.z), this.door, k / 4);
      for (const s of [-1, 1]) {
        const px = p.x + s * 7 * this.faces.z;
        const pz = p.z - s * 7 * this.faces.x;
        const mesh = new THREE.Mesh(pole, poleM);
        mesh.position.set(px, H(px, pz) + 1.1, pz);
        this.group.add(mesh);
      }
    }
    // --- the rescuers on the porch
    const guestMat = mk(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide }));
    const deckY = y0 + FL;
    RESCUERS.forEach((look, i) => {
      const g = new Guest(look, { cheerStyle: i === 0 ? 'pump' : 'armsUp', canWalk: false, seed: 401 + i * 17, waveArm: i === 0 ? 'R' : 'L', energy: 0.8 }, guestMat, () => deckY);
      const p = toWorld(doorX + (i === 0 ? -1.2 : 1.1), FL, C.hutD / 2 + 1.5);
      g.place(p.x, p.z, yaw + (i === 0 ? 0.25 : -0.25), null);
      this.rescuers.push(g);
      this.group.add(g.group);
    });
    // stop in front of the door; the Yeti halts up the slope, at the edge of the light
    this.stop.copy(this.door).addScaledVector(this.faces, STOP_OUT);
    this.stop.y = H(this.stop.x, this.stop.z);
    const across = new THREE.Vector3(this.faces.z, 0, -this.faces.x);
    this.yetiPt.copy(this.door).addScaledVector(this.faces, 30).addScaledVector(across, -side * 12);
    this.yetiPt.y = H(this.yetiPt.x, this.yetiPt.z);
    // colliders: the hall (two circles), the garage, the mast, the snowcat, the porch posts
    for (const lx of [-2.6, 2.6]) {
      const p = toWorld(lx, 0, 0);
      this.cols.push({ x: p.x, z: p.z, r: 3.9 });
    }
    const gp = toWorld(gx, 0, gz);
    this.cols.push({ x: gp.x, z: gp.z, r: 3.4 });
    const mp = toWorld(mastLocal.x, 0, mastLocal.z);
    this.cols.push({ x: mp.x, z: mp.z, r: 0.7 });
    const cp = toWorld(gx, 0, gz + C.garageD / 2 + 0.6);
    this.cols.push({ x: cp.x, z: cp.z, r: 2.4 });
    for (const px of [doorX - 1.9, doorX + 1.9]) {
      const p = toWorld(px, 0, C.hutD / 2 + deckD - 0.15);
      this.cols.push({ x: p.x, z: p.z, r: 0.3 });
    }
    this.update(0, 0, { cheer: 0, lookAt: null, welcome: 0 });
  }

  update(dt: number, time: number, st: FinishState): void {
    // the beacon flashes (1 Hz), the light bar turns, the windsock swings, the chimney smokes
    const f = 0.5 + 0.5 * Math.sin(time * Math.PI * 2);
    this.beacon.material.opacity = 0.35 + 0.65 * f * f;
    this.beacon.scale.setScalar(2.4 + 1.6 * f);
    const lb = 0.5 + 0.5 * Math.sin(time * 9);
    this.lightBar.material.opacity = 0.25 + 0.75 * lb * lb;
    this.windsock.rotation.y = 0.5 * Math.sin(time * 0.7) + 0.2 * Math.sin(time * 2.9);
    this.windsock.rotation.z = -0.15 + 0.08 * Math.sin(time * 3.7);
    this.doorLeaf.rotation.y = -1.6 * this.doorOpen;
    this.doorLight.intensity = 20 + 26 * this.doorOpen;
    // the searchlight sweeps the slope above the station (or holds on a target)
    const P = this.searchPivot;
    P.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3().setFromMatrixPosition(P.matrixWorld);
    const aim = this.searchTarget
      ? this.searchTarget.clone()
      : this.door.clone().addScaledVector(this.faces, 42 + 10 * Math.sin(time * 0.31)).add(new THREE.Vector3(this.faces.z, 0, -this.faces.x).multiplyScalar(18 * Math.sin(time * 0.45)));
    if (!this.searchTarget) aim.y = this.door.y;
    // (W-042) the light swings onto a target (≈ 0.6 s), it does not snap; on a target the beam is
    // bright in the driving snow, so the beat reads
    if (!this.aimCur) this.aimCur = aim.clone();
    else this.aimCur.lerp(aim, 1 - Math.exp(-(this.searchTarget ? 4.5 : 8) * Math.max(0, dt)));
    P.lookAt(this.aimCur);
    const uK = (this.beam.material as THREE.ShaderMaterial).uniforms.uK!;
    uK.value += ((this.searchTarget ? 0.42 : 0.12) - uK.value) * (1 - Math.exp(-3 * Math.max(0, dt)));
    this.search.intensity = this.searchTarget ? 420 : 220;
    // the lantern swells as it is raised
    if (this.flame) this.flame.intensity = 4 + 14 * this.lanternUp;
    if (this.flame) this.flame.distance = 7 + 9 * this.lanternUp;
    if (this.halo) {
      this.halo.scale.setScalar(0.9 + 1.3 * this.lanternUp + 0.08 * Math.sin(time * 11));
      (this.halo.material as THREE.SpriteMaterial).opacity = 0.55 + 0.4 * this.lanternUp;
    }
    void pos;
    const p = (this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < 48; i++) {
      const life = (time * 0.18 + i / 48) % 1;
      p[i * 3] = this.smokeBase.x + life * 6 + Math.sin(i * 3.1 + time) * 0.4 * life;
      p[i * 3 + 1] = this.smokeBase.y + life * 7;
      p[i * 3 + 2] = this.smokeBase.z + Math.cos(i * 1.7) * life * 1.5;
    }
    this.smoke.geometry.getAttribute('position').needsUpdate = true;
    // the rescuers: they watch the skier, wave them in, cheer the lantern
    const look = st.lookAt;
    for (const g of this.rescuers) g.update(dt, time, Math.max(st.cheer, this.cheer), look, Math.max(st.welcome, this.welcome));
  }
  getStopPoint(t: THREE.Vector3) {
    return t.copy(this.stop);
  }
  getYetiStopPoint(t: THREE.Vector3) {
    return t.copy(this.yetiPt);
  }
  getPodiumTop(t: THREE.Vector3) {
    return t.copy(this.podium);
  }
  getCelebrationFocus(t: THREE.Vector3) {
    return t.copy(this.door);
  }
  colliders(): CircleCollider[] {
    return this.cols;
  }
  dispose(): void {
    for (const g of this.rescuers) g.dispose();
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
