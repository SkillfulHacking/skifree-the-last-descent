/**
 * "fjord-sea-cave" dressing around the shared Yeti cave (round 2, art review D5 / cinematic 1–2,
 * critic 5/8). The cave geometry contract is untouched (terrain cut, rock shell, floor, anchors,
 * clearance bake): the Yeti's emergence and grounding are exactly as everywhere else. What changes:
 *
 *  - the cave's own rock reads as sea-worn columnar basalt, not the Alpine strata tinted: the shared
 *    rock material gets a Fjord pass (hexagonal column jointing in plan, cross-joints, near-black
 *    wet rock low down, salt/rime crust and ochre lichen higher up) — a material change only;
 *  - real basalt columns either side of the mouth: individually built hexagonal prisms with
 *    chamfered tops, cross-joints and weathering in their own shader, seated in the snow (bases
 *    sunk below the lowest ground under them) and stepping down like a giant's staircase; snow
 *    cushions sit exactly on each top;
 *  - a frozen tide pool on the cave floor at the mouth (dark green-blue sea ice with white cracks
 *    and a slushy rim, flush with the floor) and a heap of broken sea-ice plates beside the mouth;
 *  - wreckage that makes sense for a beachcombing Yeti: an overturned, staved-in clinker rowing boat
 *    on its gunwale against the columns, a broken spar, silver driftwood, lobster pots, a torn net
 *    draped over a column step (not floating), floats on a grounded line, fish bones;
 *  - an irregular icicle fringe (clusters, a few long ones, gaps), not a comb.
 *
 * Every prop keeps clear of the Yeti's exit path and ledge AND of the shared cave-cinematic camera
 * sight lines (CaveCinematic.caveCameraSightlines); placements are recorded in `userData.props`
 * so tests can check the clearance. The dressing also exposes perches (column tops) for the
 * Fjord cave-cinematic beats (./seaCaveCinematic.ts).
 */
import * as THREE from 'three';
import type { CaveDressing, CaveDressingContext } from '../../../presentation/cave';
import { Batch, Rand, mat } from '../../../resort/util';
import { kitMaterials } from './buildings';
import { PrismSet, clinkerHull, hullKeelY } from './basaltKit';
import { caveCameraSightlines } from '../../../../cinematic/CaveCinematic';
import { dressingTicker } from '../../../presentation/cave';
import { createRockMaterial, disposeRockMaterial } from '../../../art/rockMaterial';
import { bestSeaPose, emergeStations, leapStations, type SeaPose } from './seaFraming';

/** the torn net prop (off since round 4b: it read as a floating black sheet) */
const NET_PLACED = false as boolean;

/** distance from p to the segment ab */
function segDist(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = b.clone().sub(a);
  const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq())));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

/** camera clearance used by the dressing (and its test): props stay this far outside every lens */
export const CAVE_CAM_CLEARANCE = 1.6;

/**
 * True when a prop (bounding sphere at p, radius r) is clear of every shared cave-cinematic sight
 * line: at least r + CAVE_CAM_CLEARANCE from each camera→subject segment (the part of the line
 * nearer than 14 m to the camera, where a prop would fill the frame) and r + 3 m from each camera.
 */
export function clearOfCaveCameras(lines: Array<{ cam: THREE.Vector3; look: THREE.Vector3 }>, p: THREE.Vector3, r: number): boolean {
  for (const l of lines) {
    if (p.distanceTo(l.cam) < r + 3) return false;
    const dir = l.look.clone().sub(l.cam);
    const len = Math.min(14, dir.length());
    const end = l.cam.clone().addScaledVector(dir.normalize(), len);
    // the frame widens with distance: ~0.35 m per metre at these FOVs, capped
    const along = Math.min(len, Math.max(0, p.clone().sub(l.cam).dot(dir)));
    const widen = Math.min(3, along * 0.18);
    if (segDist(p, l.cam, end) < r + CAVE_CAM_CLEARANCE + widen) return false;
  }
  return true;
}

function netTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  for (let i = -128; i < 256; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(i + 128, 0);
    g.lineTo(i, 128);
    g.stroke();
  }
  g.clearRect(70, 40, 34, 30);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

/** sea ice: dark green-blue with white pressure cracks and trapped bubbles (shared, small) */
function iceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, '#0f2a30');
  grd.addColorStop(0.7, '#1a3f47');
  grd.addColorStop(1, '#8fb0b8');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const r = new Rand(77);
  g.strokeStyle = 'rgba(235,245,250,0.75)';
  for (let i = 0; i < 14; i++) {
    g.lineWidth = r.range(0.6, 2.2);
    g.beginPath();
    let x = r.range(30, 226);
    let y = r.range(30, 226);
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += r.range(-28, 28);
      y += r.range(-28, 28);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 80; i++) {
    g.fillStyle = `rgba(230,245,250,${r.range(0.15, 0.5)})`;
    g.beginPath();
    g.arc(r.range(20, 236), r.range(20, 236), r.range(0.8, 3), 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface SeaCavePerch {
  p: THREE.Vector3;
  /** on the portal or the lintel (framed by the brow shot) */
  brow?: boolean;
}

/** smooth value noise in 2D (deterministic, cheap) for column heights */
function vn2(x: number, z: number, seed: number): number {
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}

/**
 * How far the cave's rock face stands out (along the outward direction) at a lateral offset and a
 * height above the mouth: sampled from the rock mesh's own vertices (one pass, binned 0.5 m), so
 * the portal columns and the lintel's column ends sit ON the face. Falls back to the mouth line.
 */
function faceSampler(cave: CaveDressingContext['cave'], mouth: THREE.Vector3, out: THREE.Vector3, tan: THREE.Vector3) {
  const A0 = -16;
  const NA = 64;
  const Y0 = -2;
  const NY = 40;
  const bins = new Float32Array(NA * NY).fill(-Infinity);
  const rock = cave.group.getObjectByName('cave-rock') as THREE.Mesh | undefined;
  const P = rock?.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (rock && P) {
    rock.updateMatrixWorld(true);
    const mw = rock.matrixWorld;
    const v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(mw).sub(mouth);
      const a = Math.floor((v.dot(tan) - A0) / 0.5);
      const y = Math.floor((v.y - Y0) / 0.5);
      if (a < 0 || a >= NA || y < 0 || y >= NY) continue;
      const o = v.dot(out);
      const k = y * NA + a;
      if (o > bins[k]!) bins[k] = o;
    }
  }
  return (along: number, up: number): number | null => {
    const a = Math.floor((along - A0) / 0.5);
    const y = Math.floor((up - Y0) / 0.5);
    if (a < 0 || a >= NA || y < 0 || y >= NY) return null;
    let best = -Infinity;
    for (let dy = -1; dy <= 1; dy++)
      for (let da = -1; da <= 1; da++) {
        const aa = a + da;
        const yy = y + dy;
        if (aa < 0 || aa >= NA || yy < 0 || yy >= NY) continue;
        best = Math.max(best, bins[yy * NA + aa]!);
      }
    return Number.isFinite(best) ? best : null;
  };
}

/** the cinematic's sea-framing poses (null: no station shows the sea with the subject in view) */
export interface SeaShots {
  emerge: SeaPose | null;
  leap: SeaPose | null;
}

interface Partial3 {
  mats: THREE.Material[];
  texs: THREE.Texture[];
  group: THREE.Group | null;
  /** triplanar rock materials (shared textures: released with disposeRockMaterial) */
  rock: THREE.MeshStandardMaterial[];
  /** put the cave's own rock material back */
  restore: (() => void) | null;
}

/** The dressing, built in one go (tests, and presentations without slicing). */
export function dressSeaCave(c: CaveDressingContext): CaveDressing {
  const job = dressSeaCaveSteps(c, Infinity);
  let r = job.next();
  while (!r.done) r = job.next();
  return r.value;
}

/**
 * The dressing as a time-sliced job (CavePresentation.dressSteps): yields between pieces of work
 * once `budgetMs` of main-thread time has passed. If World abandons the job (`return()`), whatever
 * was built so far is disposed in the `finally`.
 */
export function* dressSeaCaveSteps(c: CaveDressingContext, budgetMs = 3): Generator<void, CaveDressing, void> {
  const tick = dressingTicker(budgetMs);
  let done = false;
  const partial: Partial3 = { mats: [], texs: [], group: null, rock: [], restore: null };
  try {
    const d = yield* buildSeaCave(c, tick, partial);
    done = true;
    return d;
  } finally {
    if (!done) {
      partial.group?.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      partial.group?.removeFromParent();
      for (const m of partial.mats) m.dispose();
      for (const t of partial.texs) t.dispose();
      for (const m of partial.rock) disposeRockMaterial(m);
      partial.restore?.();
    }
  }
}

function* buildSeaCave(c: CaveDressingContext, tick: { over(): boolean }, partial: Partial3): Generator<void, CaveDressing, void> {
  const { cave, mountain: m } = c;
  const hi = c.quality === 'high' || c.quality === 'ultra';
  const group = new THREE.Group();
  group.name = 'FjordSeaCave';
  const rnd = new Rand(31337 + Math.round(c.anchor.z));
  const K = kitMaterials();
  // round 4 (art pipeline; review P-M2): the columns take the baked columnar-basalt set, the cave's
  // rock mass a massive, fractured lava set (no column joints on the mound), both triplanar and
  // physically lit — no light multipliers (round 3's 0.32/0.5 left the cave at 0–2/255). FILL: the
  // bounce from the sunlit snowfield in front of the back-lit mouth (the sky IBL's ground is far
  // darker than real snow): the basalt lands at ~35–60/255 in the game, the chamber stays dark
  // (baked visibility, RK_CAVE).
  const FILL = 0.55;
  const basalt = createRockMaterial({ kind: 'basalt', vertexColors: true, snow: 1, strata: 0, macro: 5, fill: FILL, hq: hi });
  partial.rock.push(basalt);
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xd8ecff, roughness: 0.06, transparent: true, opacity: 0.88, emissive: 0x16304a, emissiveIntensity: 0.22, clearcoat: 1 });
  const net = new THREE.MeshStandardMaterial({ color: 0x3f5f4a, roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.4 });
  const drift = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, envMapIntensity: 0.5 });
  const iceTex = iceTexture();
  const seaIce = new THREE.MeshPhysicalMaterial({ map: iceTex, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const plates = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0 });
  const M: Record<string, THREE.Material> = { ...K, ice, drift, plates, hull: hullMat };
  const b = new Batch();
  const out = cave.outward.clone().setY(0).normalize();
  const tan = new THREE.Vector3(out.z, 0, -out.x);
  const mouth = cave.mouth;
  const lines = caveCameraSightlines(cave.mouth, cave.outward, cave.lipTop);
  const props: Array<{ p: THREE.Vector3; r: number; kind: string }> = [];
  const perches: SeaCavePerch[] = [];
  const clearOfPath = (x: number, z: number, r: number) => cave.exitPath.every((p) => Math.hypot(p.x - x, p.z - z) > r + 4.5) && Math.hypot(cave.ledge.x - x, cave.ledge.z - z) > r + 5;
  /** the full placement test: path, ledge and every cinematic lens (prop centre p, radius r) */
  const ok = (p: THREE.Vector3, r: number) => clearOfPath(p.x, p.z, r) && clearOfCaveCameras(lines, p, r);
  const place = (along: number, back: number) => {
    const x = mouth.x + tan.x * along - out.x * back;
    const z = mouth.z + tan.z * along - out.z * back;
    return new THREE.Vector3(x, m.heightAt(x, z), z);
  };
  const shell = cave.group.getObjectByName('cave-rock') as THREE.Mesh | undefined;
  const shellPrev = shell ? shell.material : null;
  const shellMat = createRockMaterial({ kind: 'rock_face_03', snow: 1, strata: 0.25, macro: 6, wet: 0, fill: FILL, hq: hi, caveAttr: !!shell?.geometry.getAttribute('aCave'), grade: { lum: 0.06, desat: 0.9, tint: [0.94, 0.98, 1.05] } });
  partial.rock.push(shellMat);
  if (shell) {
    shell.material = shellMat;
    partial.restore = () => {
      if (shellPrev) shell.material = shellPrev;
    };
  }
  // the shared cave's own icicles hang inside the mouth, where against the dark chamber they read
  // as pale floating shards (round 2, A4): the Fjord hangs its icicles from the lintel instead
  const sharedIce = cave.group.getObjectByName('cave-icicles');
  if (sharedIce) sharedIce.visible = false;
  partial.group = group;
  partial.mats.push(...new Set(Object.values(M)), net, seaIce);
  partial.texs.push(iceTex);
  if (tick.over()) yield;
  const face = faceSampler(cave, mouth, out, tan);
  if (tick.over()) yield;
  const up = new THREE.Vector3(0, 1, 0);

  // ---------------- basalt columns (round 3: irregular, not a bollard grid) ----------------
  // 5–7-sided prisms of varied girth on a jittered hexagonal packing; heights from a smooth field
  // stepped into terraces (a causeway, not a staircase of equal treads), broken and slanted tops,
  // a little lean; snow only on some near-level tops. Three bodies: a large causeway stepping down
  // from the wall on one side, a smaller, partly collapsed one on the other, and a colonnade of
  // tall columns flanking the mouth up to the brow, with a lintel of column ends above the opening
  // (the portal no longer has the shared cave's silhouette).
  const cols = new PrismSet();
  const icicles: Array<{ top: THREE.Vector3; len: number; r: number }> = [];
  const seat = (p: THREE.Vector3, r: number) => {
    let gy = Infinity;
    for (let k = 0; k < 6; k++) gy = Math.min(gy, m.heightAt(p.x + Math.cos(k) * r, p.z + Math.sin(k) * r));
    return gy;
  };
  const column = (p: THREE.Vector3, r: number, top: number, seed: number, kind: string, opts: { slant?: boolean; lean?: number; brow?: boolean } = {}) => {
    const gy = seat(p, r);
    const base = gy - 0.7;
    const h = top - base;
    if (h < 0.9) return false;
    const centre = new THREE.Vector3(p.x, (base + top) / 2, p.z);
    const rad = Math.max(r, h / 2);
    if (!ok(centre, rad)) return false;
    const lean = opts.lean ?? 0.035;
    const mtx = new THREE.Matrix4().compose(new THREE.Vector3(p.x, base, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd.range(-lean, lean), 0, rnd.range(-lean, lean))), new THREE.Vector3(1, 1, 1));
    const broken = opts.slant && rnd.next() < 0.35;
    const slant: [number, number] = broken ? [rnd.range(-0.45, 0.45), rnd.range(-0.45, 0.45)] : [rnd.range(-0.05, 0.05), rnd.range(-0.05, 0.05)];
    const tone = 0.5 + 0.36 * rnd.next(); // (× the baked basalt albedo: per-column variety)
    cols.prism(mtx, { sides: rnd.next() < 0.6 ? 6 : rnd.next() < 0.5 ? 5 : 7, r, h, rot: rnd.range(0, 6.28), slant, tone, seed, ground: gy - base, rnd, snow: rnd.next() < 0.6, up });
    if (!broken) perches.push({ p: new THREE.Vector3(p.x, top + 0.25, p.z), brow: opts.brow });
    props.push({ p: centre, r: rad, kind });
    return true;
  };
  /** a causeway body: jittered hex packing over (along, back) with a terraced height field */
  const causeway = (a0: number, a1: number, b0: number, b1: number, peak: number, wallSide: number, seedK: number, density: number) => {
    const S = 1.3;
    for (let j = 0; ; j++) {
      const bk = b0 + j * S * 0.866;
      if (bk > b1) break;
      for (let i = 0; ; i++) {
        const al = a0 + i * S + (j % 2) * S * 0.5;
        if (al > a1) break;
        // clumps and gaps (a smooth field), not an even scatter
        if (rnd.next() > density * (0.25 + 1.5 * vn2(al * 0.18 + 7.7, bk * 0.18, seedK + 3))) continue;
        const ja = al + rnd.range(-0.18, 0.18) * S;
        const jb = bk + rnd.range(-0.18, 0.18) * S;
        // height: highest against the wall and toward the mouth side, falling off in an
        // irregular front; terraces of ~1.1 m with per-column scatter
        const fromWall = Math.abs(ja - wallSide) / Math.max(1, Math.abs(a1 - a0));
        const f = vn2(ja * 0.22, jb * 0.22, seedK);
        let hgt = peak * Math.max(0, 1 - fromWall * 0.9 - (b1 - jb) * 0.04) * (0.55 + 0.7 * f);
        hgt = Math.round(hgt / 1.1) * 1.1 + rnd.range(-0.3, 0.3);
        if (rnd.next() < 0.1) hgt *= 0.35; // a snapped stump
        if (hgt < 0.4) continue;
        const p = place(ja, jb);
        const r = S * rnd.range(0.46, 0.56);
        column(p, r, seat(p, r) + hgt, rnd.next() * 100, 'column', { slant: true });
      }
    }
  };
  const big = rnd.next() < 0.5 ? -1 : 1;
  // (round 4b, F r4 #1: ~60 evenly packed prisms on bare snow read as a blockout grid: sparser, so
// the causeways break into clumps and gaps with snow between them)
  causeway(big > 0 ? 6.0 : -19, big > 0 ? 19 : -6.0, -10.5, -1.0, 7.5, big > 0 ? 6 : -6, 3.1, hi ? 0.55 : 0.45);
  if (tick.over()) yield;
  causeway(big > 0 ? -13 : 6.5, big > 0 ? -6.5 : 13, -6.5, -1.5, 4.2, big > 0 ? -6.5 : 6.5, 8.4, hi ? 0.45 : 0.35);
  // fallen drums from the collapsed side lying in the snow (column sections on their sides)
  for (let i = 0; i < (hi ? 5 : 3); i++) {
    const p = place(-big * rnd.range(7, 14), -rnd.range(7, 12));
    const r = rnd.range(0.45, 0.62);
    const len = rnd.range(0.9, 2.2);
    const yaw = rnd.range(0, 6.28);
    const centre = p.clone().setY(p.y + r * 0.5);
    if (!ok(centre, len / 2 + r)) continue;
    const mtx = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y + r * 0.45, p.z).addScaledVector(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), -len / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, yaw, rnd.range(-0.2, 0.2), 'YXZ')), new THREE.Vector3(1, 1, 1));
    cols.prism(mtx, { sides: 6, r, h: len, rot: rnd.range(0, 6), tone: 0.72, seed: rnd.next() * 100, ground: -1, rnd });
    props.push({ p: centre, r: len / 2 + r, kind: 'drum' });
  }
  if (tick.over()) yield;
  // the portal: tall columns flanking the mouth, standing on the face line, rising to the brow
  const brow = cave.lipTop.y - mouth.y;
  for (const s of [-1, 1]) {
    let al = 5.0;
    let n = 0;
    while (al < (s === big ? 9.5 : 8.0) && n < 8) {
      const r = rnd.range(0.55, 0.72);
      const f0 = face(s * al, 2.0);
      const back = f0 === null ? 0.3 : -f0 + r * 0.55;
      const p = place(s * al, back);
      const top = mouth.y + brow * (1.05 - (al - 5) * 0.06) + rnd.range(-0.6, 0.4);
      column(p, r, top, rnd.next() * 100, 'column', { lean: 0.02, brow: true });
      al += r * 1.75;
      n++;
    }
  }
  if (tick.over()) yield;
  // the brow above the opening. Round 4 (D r4, candidate 07: "hexagonal blocks floating above the
  // cave mouth"): the lintel of column ends read as a few loose hex nuts stuck on the rock, not as
  // the curved columns of Fingal's Cave, so it is gone; the portal columns and the causeways carry
  // the basalt. Icicles hang from the brow itself, seated on the rock face a hand's width out.
  {
    const hw = 4.6;
    const yUp = 6.1;
    for (let al = -hw; al <= hw; al += 0.7) {
      if (rnd.next() < (hi ? 0.45 : 0.65)) continue;
      const f = face(al, yUp);
      if (f === null) continue;
      const nI = 1 + Math.floor(rnd.next() * 2);
      for (let k = 0; k < nI; k++) {
        const lenI = rnd.next() < 0.2 ? rnd.range(1.2, 2.2) : rnd.range(0.3, 0.9);
        const topP = mouth.clone().addScaledVector(tan, al + rnd.range(-0.25, 0.25)).add(new THREE.Vector3(0, yUp - 0.15, 0)).addScaledVector(out, f + 0.08);
        const pI = topP.clone().add(new THREE.Vector3(0, -lenI / 2, 0));
        if (!clearOfCaveCameras(lines, pI, lenI / 2)) continue;
        icicles.push({ top: topP, len: lenI, r: 0.05 + rnd.range(0, 0.06) });
      }
    }
  }
  if (tick.over()) yield;
  // ---------------- the frozen tide pool on the cave floor + broken sea-ice plates ----------------
  {
    // a dense skin on the floor in front of the mouth (follows floorHeightAt; flush)
    const n = 18;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const cx = mouth.x + out.x * 0.4;
    const cz = mouth.z + out.z * 0.4;
    const RX = 2.6;
    const RZ = 1.9;
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * 2 - 1;
        const v = (j / n) * 2 - 1;
        const rr = Math.max(Math.abs(u), Math.abs(v));
        const a = Math.atan2(v, u);
        const k = rr * (1 + 0.12 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7));
        const x = cx + tan.x * Math.cos(a) * k * RX + out.x * Math.sin(a) * k * RZ;
        const z = cz + tan.z * Math.cos(a) * k * RX + out.z * Math.sin(a) * k * RZ;
        pos.push(x, cave.floorHeightAt(x, z) + 0.015, z);
        uv.push(0.5 + 0.5 * Math.cos(a) * rr, 0.5 + 0.5 * Math.sin(a) * rr);
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a0 = j * (n + 1) + i;
        idx.push(a0, a0 + n + 1, a0 + 1, a0 + 1, a0 + n + 1, a0 + n + 2);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const pool = new THREE.Mesh(g, seaIce);
    pool.receiveShadow = true;
    pool.name = 'fjord-tide-pool';
    group.add(pool);
  }
  // pressure-ridge heap of broken sea-ice plates beside the mouth (one side, clear of the lenses)
  for (const s of [1, -1]) {
    const base = place(s * 5.2, -4.5);
    if (!ok(base.clone().setY(base.y + 0.5), 1.8)) continue;
    for (let i = 0; i < 7; i++) {
      const w = rnd.range(0.7, 1.6);
      const d = rnd.range(0.5, 1.2);
      const g = new THREE.BoxGeometry(w, rnd.range(0.12, 0.22), d, 2, 1, 2);
      const P = g.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < P.count; k++) P.setXYZ(k, P.getX(k) * (1 + 0.15 * Math.sin(k * 1.7)), P.getY(k), P.getZ(k) * (1 + 0.12 * Math.cos(k * 2.3)));
      g.computeVertexNormals();
      const px = base.x + rnd.range(-1.2, 1.2);
      const pz = base.z + rnd.range(-1.0, 1.0);
      b.add('plates', g, mat(px, m.heightAt(px, pz) + 0.1 + i * 0.05, pz, rnd.range(-0.7, 0.7), rnd.range(0, 6), rnd.range(-0.6, 0.6)), (_q, nn) => new THREE.Color(nn.y > 0.7 ? 0xdbe9f2 : 0x5f97a8));
    }
    props.push({ p: base.clone().setY(base.y + 0.5), r: 1.8, kind: 'seaice' });
    break;
  }

  if (tick.over()) yield;
  // ---------------- wreckage: the beachcombing hoard ----------------
  // an overturned clinker rowing boat (round 3: modelled strakes, keel, stem and stern posts, a
  // faded painted sheer strake and a staved-in hole), keel up on the snow, a drift banked on one side
  {
    const p = place(-big * 9.0, -9.5);
    const HL = 5.4;
    const HB = 1.8;
    const HD = 0.72;
    if (ok(p.clone().setY(p.y + 0.6), 3.0)) {
      const yaw = Math.atan2(tan.x, tan.z) - big * 0.55;
      const gy = Math.min(m.heightAt(p.x, p.z), seat(p, 2.0));
      const mtx = new THREE.Matrix4().compose(new THREE.Vector3(p.x, gy - 0.06, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0.07)), new THREE.Vector3(1, 1, 1));
      const hg = clinkerHull(HL, HB, HD);
      hg.applyMatrix4(mtx);
      const hm = new THREE.Mesh(hg, hullMat);
      hm.castShadow = true;
      hm.receiveShadow = true;
      hm.name = 'fjord-hull';
      group.add(hm);
      const ky = hullKeelY(HD);
      // keel, with the stem and stern posts curving down at the ends
      b.add('drift', new THREE.BoxGeometry(0.1, 0.12, HL * 0.92), mtx.clone().multiply(new THREE.Matrix4().makeTranslation(0, ky + 0.04, 0)), new THREE.Color(0.1, 0.08, 0.06));
      for (const e of [-1, 1]) b.add('drift', new THREE.BoxGeometry(0.1, ky + 0.1, 0.14), mtx.clone().multiply(new THREE.Matrix4().makeTranslation(0, (ky + 0.1) / 2, e * HL * 0.49)), new THREE.Color(0.1, 0.08, 0.06));
      // a broken oar beside it and snow along the keel and in the lee
      b.add('drift', new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6).rotateZ(Math.PI / 2), mtx.clone().multiply(new THREE.Matrix4().makeTranslation(-HB * 0.9, 0.05, 0.4)).multiply(new THREE.Matrix4().makeRotationY(0.4)), new THREE.Color(0.55, 0.5, 0.42));
      b.add('drift', new THREE.BoxGeometry(0.16, 0.03, 0.5), mtx.clone().multiply(new THREE.Matrix4().makeTranslation(-HB * 0.9 - 1.2, 0.05, 0.9)).multiply(new THREE.Matrix4().makeRotationY(0.4)), new THREE.Color(0.55, 0.5, 0.42));
      b.add('snow', new THREE.SphereGeometry(1, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.22, 0.09, HL * 0.4), mtx.clone().multiply(new THREE.Matrix4().makeTranslation(0.06, ky + 0.08, 0)), 0xffffff);
      b.add('snow', new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.35, HL * 0.46), mtx.clone().multiply(new THREE.Matrix4().makeTranslation(-HB * 0.55, -0.05, 0)), 0xffffff);
      props.push({ p: p.clone().setY(p.y + 0.6), r: 3.0, kind: 'boat' });
    }
  }
  if (tick.over()) yield;
  // silver driftwood logs
  for (let i = 0; i < 4; i++) {
    const p = place(rnd.range(-14, 14), rnd.range(-15, -8));
    if (!ok(p.clone().setY(p.y + 0.2), 1.8)) continue;
    const L = rnd.range(2.2, 4.2);
    const g = new THREE.CylinderGeometry(0.12, 0.2, L, 7).rotateZ(Math.PI / 2);
    b.add('drift', g, mat(p.x, p.y + 0.08, p.z, rnd.range(-0.1, 0.1), rnd.range(0, 6), 0.05), new THREE.Color(0.4, 0.37, 0.33));
    props.push({ p: p.clone().setY(p.y + 0.2), r: L / 2, kind: 'driftwood' });
  }
  // lobster pots: wooden slat cages with a net funnel end
  for (let i = 0; i < 3; i++) {
    const p = place(-big * (8.5 + i * 1.25), -10 - rnd.range(0, 2.5));
    if (!ok(p.clone().setY(p.y + 0.35), 0.9)) continue;
    const yaw = rnd.range(0, 3);
    for (let k = 0; k < 5; k++) {
      const a = (k / 4) * Math.PI;
      b.add('drift', new THREE.BoxGeometry(1.0, 0.04, 0.05), mat(p.x, p.y + 0.05 + Math.sin(a) * 0.38, p.z, 0, yaw, 0).multiply(new THREE.Matrix4().makeTranslation(0, 0, Math.cos(a) * 0.32)), new THREE.Color(0.42, 0.33, 0.24));
    }
    b.add('drift', new THREE.BoxGeometry(1.04, 0.05, 0.7), mat(p.x, p.y + 0.03, p.z, 0, yaw, 0), new THREE.Color(0.36, 0.28, 0.2));
    props.push({ p: p.clone().setY(p.y + 0.35), r: 0.7, kind: 'pot' });
  }
  // floats on a line lying on the snow: the rope follows the ground (sampled every 0.3 m), the
  // floats are half sunk into it (round 2: the line was a straight chord and hung in the air)
  {
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i < 6; i++) {
      const p = place(-big * (rnd.range(3, 8) + i * 0.4), -rnd.range(15, 17.5));
      if (!ok(p.clone().setY(p.y + 0.2), 0.4)) continue;
      b.add('paint', new THREE.SphereGeometry(0.26, 10, 8), mat(p.x, p.y + 0.07, p.z), i % 2 ? 0xe86a1e : 0xf2efe7);
      if (prev) {
        const n = Math.max(2, Math.ceil(prev.distanceTo(p) / 0.3));
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= n; k++) {
          const q = prev.clone().lerp(p, k / n);
          pts.push(q.setY(m.heightAt(q.x, q.z) + 0.03));
        }
        b.add('drift', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.02, 3), undefined, new THREE.Color(0.8, 0.72, 0.55));
      }
      props.push({ p: p.clone().setY(p.y + 0.2), r: 0.3, kind: 'float' });
      prev = p;
    }
  }
  // fish bones by the mouth (the Yeti's meals)
  for (let i = 0; i < 5; i++) {
    const p = place(rnd.range(-6, 6), -rnd.range(5, 9));
    if (!ok(p.clone().setY(p.y + 0.05), 0.5)) continue;
    const yaw = rnd.range(0, 6.28);
    b.add('paint', new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4).rotateZ(Math.PI / 2), mat(p.x, p.y + 0.04, p.z, 0, yaw, 0), 0xe8e2d0);
    for (let k = -3; k <= 3; k++) b.add('paint', new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3), mat(p.x + Math.cos(yaw) * k * 0.1, p.y + 0.04, p.z - Math.sin(yaw) * k * 0.1, Math.PI / 2, yaw, 0), 0xe8e2d0);
    props.push({ p: p.clone().setY(p.y + 0.05), r: 0.5, kind: 'bones' });
  }

  if (tick.over()) yield;
  // build the columns (one mesh), their snow, and the icicles (one instanced mesh: the cave
  // cinematic drops them in the icicle-shatter beat)
  if (cols.count) {
    const cm = new THREE.Mesh(cols.geometry(), basalt);
    cm.castShadow = true;
    cm.receiveShadow = true;
    cm.name = 'fjord-basalt-columns';
    group.add(cm);
    // (round 4: the snow on the tops comes from the triplanar rock material — the separate cushions
    // read as white-rimmed cups on top of it)
    const sg = null as THREE.BufferGeometry | null;
    if (sg) {
      const sm = new THREE.Mesh(sg, K['snow']!);
      sm.receiveShadow = true;
      sm.name = 'fjord-basalt-snow';
      group.add(sm);
    }
  }
  for (const me of b.build(M, { cast: true, receive: true })) group.add(me);
  let iceMesh: THREE.InstancedMesh | null = null;
  if (icicles.length) {
    iceMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6).rotateX(Math.PI), ice, icicles.length);
    const o = new THREE.Object3D();
    icicles.forEach((ic, i) => {
      o.position.copy(ic.top).add(new THREE.Vector3(0, -ic.len / 2, 0));
      o.scale.set(ic.r, ic.len, ic.r);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      iceMesh!.setMatrixAt(i, o.matrix);
    });
    iceMesh.name = 'fjord-brow-icicles';
    iceMesh.userData['icicles'] = icicles;
    iceMesh.computeBoundingSphere();
    group.add(iceMesh);
  }

  // a torn net draped over the lowest column step on the left (rests on it, sways a little)
  const netG = new THREE.PlaneGeometry(3.4, 2.4, 14, 10);
  const base = new Float32Array((netG.attributes.position as THREE.BufferAttribute).array);
  const netMesh = new THREE.Mesh(netG, net);
  const tex = netTexture();
  net.map = tex;
  const perchL = perches.filter((q) => q.p.clone().sub(mouth).dot(tan) < 0).sort((a, b2) => a.p.y - b2.p.y)[0];
  // (round 4b, F r4 #1 / C r4 #2: lit, the net read as a free-standing black sheet hanging in the
  // air — it is no longer placed)
  if (perchL && clearOfCaveCameras(lines, perchL.p, 1.8) && NET_PLACED) {
    netMesh.position.copy(perchL.p).add(new THREE.Vector3(0, -1.1, 0)).addScaledVector(out, 0.9);
    netMesh.rotation.y = Math.atan2(out.x, out.z);
    netMesh.rotation.x = -0.25;
    group.add(netMesh);
    props.push({ p: netMesh.position.clone(), r: 1.8, kind: 'net' });
  }

  // the cinematic's sea framing (round 4, Phase B): stations around the cave scored by how much open
  // water their frame shows, with the subject in clear view of the terrain and every prop above
  {
    const run = function* <T>(g: Generator<void, T, void>): Generator<void, T, void> {
      let r = g.next();
      while (!r.done) {
        if (tick.over()) yield;
        r = g.next();
      }
      return r.value;
    };
    const emerge = yield* run(bestSeaPose(m, mouth.clone().addScaledVector(out, 1.0).add(new THREE.Vector3(0, 1.7, 0)), emergeStations(mouth, out, tan, (x, z) => m.heightAt(x, z)), props, 52));
    const leap = yield* run(bestSeaPose(m, cave.ledge.clone().addScaledVector(out, 5).add(new THREE.Vector3(0, 2.2, 0)), leapStations(cave.ledge, out, tan, (x, z) => m.heightAt(x, z)), props, 56));
    group.userData['seaShots'] = { emerge, leap } satisfies SeaShots;
  }
  group.userData['props'] = props;
  group.userData['perches'] = perches;
  group.userData['mouth'] = mouth.clone();

  return {
    group,
    update(_dt, time) {
      if (!netMesh.parent) return;
      const P = netG.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < P.count; i++) {
        const x = base[i * 3]!;
        const y = base[i * 3 + 1]!;
        P.setZ(i, Math.sin(time * 1.2 + x * 1.3) * 0.05 * (1.2 - y) + 0.25 * Math.max(0, -y));
      }
      P.needsUpdate = true;
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const mt of new Set(Object.values(M))) mt.dispose();
      disposeRockMaterial(basalt);
      if (shell && shellPrev) shell.material = shellPrev;
      disposeRockMaterial(shellMat);
      net.dispose();
      tex.dispose();
      seaIce.dispose();
      iceTex.dispose();
      hullMat.dispose();
      iceMesh?.dispose();
      group.removeFromParent();
    },
  };
}
