/**
 * "fjord-harbour" finish: the course runs out of the mountains onto a snowy waterfront and stops
 * at a fishing harbour — no ski village. A timber finish gate hung with net floats, a rope-and-buoy
 * chute, a plaza on the quay with a fish-crate podium and a gilded lighthouse trophy, a row of
 * painted sea houses along the quay, a timber boardwalk on piles over the water, finger piers with
 * moored fishing boats, a wood-fired bathing tub ("badestamp") on the pier with a bonfire basket,
 * string lights, après-ski guests and a lighthouse on a skerry at the harbour mouth. The open sea
 * runs to the horizon beyond (the coast's final reach).
 *
 * Merged per material (a dozen draw calls) plus guests (one skinned mesh each), a few particle
 * systems and lights. Registered in ./index.ts with its victory script (./harbourVictory.ts).
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../../../core/types';
import type { Mountain } from '../../../course';
import type { CircleCollider, FinishEnvironment, FinishState } from '../../../presentation/finish';
import { Batch, Rand, mat } from '../../../resort/util';
import { lampPost, stringLights, bench } from '../../../resort/props';
import { Banner, Glows, Particles, flameMaterial, waterMaterial } from '../../../resort/fx';
import { envCube, softParticle } from '../../../resort/textures';
import { Guest, type GuestBehaviour, type GuestLook } from '../../../resort/Guest';
import { PAINT, ferry, fishRack, fishingBoat, house, kitMaterials, plankDeck, sparkSled, warehouse } from './buildings';

export interface HarbourOptions {
  quality: QualityPreset;
  mountain: Mountain;
  heightAt: (x: number, z: number) => number;
  finishCenter: THREE.Vector3;
}

function bannerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 160);
  grd.addColorStop(0, '#1d3a5f');
  grd.addColorStop(1, '#142a45');
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 160);
  g.fillStyle = '#c8281e';
  g.fillRect(0, 0, 1024, 14);
  g.fillRect(0, 146, 1024, 14);
  g.fillStyle = '#f4efe4';
  g.textAlign = 'center';
  g.font = '900 78px "Arial Black", Impact, sans-serif';
  g.fillText('MÅL · FINISH', 512, 100);
  g.font = '700 24px Arial, sans-serif';
  g.fillText('FJORD COAST  ·  THE HARBOUR AT THE END OF THE MOUNTAIN', 512, 134);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** granite setts: rows of slightly irregular grey stones with snow in the joints (tiles 3 × 3 m) */
function settTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9d0d8';
  g.fillRect(0, 0, 512, 512);
  const r = new Rand(911);
  const rows = 16;
  const h = 512 / rows;
  for (let j = 0; j < rows; j++) {
    let x = j % 2 ? -h * 0.5 : 0;
    while (x < 512) {
      const w = h * r.range(0.9, 1.5);
      const t = Math.round(110 + r.range(-14, 14));
      const warm = r.range(-6, 6);
      g.fillStyle = `rgb(${t + warm},${t + 2},${t + 6 - warm})`;
      const m = r.range(2, 4);
      g.beginPath();
      if (g.roundRect) g.roundRect(x + m, j * h + m, w - 2 * m, h - 2 * m, 4);
      else g.rect(x + m, j * h + m, w - 2 * m, h - 2 * m);
      g.fill();
      // wear and a little frost on the stone
      g.fillStyle = `rgba(255,255,255,${r.range(0.0, 0.18)})`;
      g.fillRect(x + m + 2, j * h + m + 2, (w - 2 * m) * r.range(0.2, 0.7), (h - 2 * m) * 0.3);
      x += w;
    }
  }
  // swept snow patches lying in drifts
  for (let i = 0; i < 40; i++) {
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grd.addColorStop(0, 'rgba(236,241,247,0.85)');
    grd.addColorStop(1, 'rgba(236,241,247,0)');
    g.save();
    g.translate(r.range(0, 512), r.range(0, 512));
    g.scale(r.range(20, 70), r.range(8, 22));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** the plunge: run-up and flight, s (the victory script drives `plunge` 0 → 1 over `total`) */
export const PLUNGE_TIMES = { run: 0.8, air: 0.95, total: 1.75 } as const;

/** torn spray sheet: white streaks thinning to ragged tips, soft sides */
function sprayTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 256);
  const r = new Rand(515);
  for (let i = 0; i < 60; i++) {
    const x = r.range(10, 118);
    const top = r.range(10, 160);
    const w = r.range(3, 12);
    const grd = g.createLinearGradient(0, 256, 0, top);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x - w / 2, top, w, 256 - top);
  }
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(255,255,255,${r.range(0.4, 0.9)})`;
    g.beginPath();
    g.arc(r.range(8, 120), r.range(4, 120), r.range(1.2, 3.5), 0, Math.PI * 2);
    g.fill();
  }
  // soft sides
  g.globalCompositeOperation = 'destination-in';
  const side = g.createLinearGradient(0, 0, 128, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(0.25, 'rgba(0,0,0,1)');
  side.addColorStop(0.75, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = side;
  g.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** foam patch: lacy, broken white with a soft, irregular edge */
function foamTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);
  const r = new Rand(616);
  for (let i = 0; i < 420; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = Math.pow(r.next(), 0.6) * 118;
    const x = 128 + Math.cos(a) * d;
    const y = 128 + Math.sin(a) * d;
    const rr = r.range(2, 9) * (1 - d / 160);
    g.fillStyle = `rgba(255,255,255,${r.range(0.15, 0.5) * (1 - d / 140)})`;
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const LOOKS: Array<{ look: GuestLook; beh: GuestBehaviour }> = (() => {
  const base = { hatColor: 0xffffff, hatColor2: 0xffffff, scarf: null, fur: null, gloves: null, mug: null, mugColor: 0xffffff, beard: false } as const;
  return [
    { look: { ...base, male: true, height: 1.84, skin: 0xf0c8a8, hair: 0xd8b070, hairStyle: 'short', headwear: 'beanie', hatColor: 0xb3261e, hatColor2: 0xf2efe7, top: 'sweater', topColor: 0x1f3554, accent: 0xf2efe7, pants: 'ski', pantsColor: 0x2b2b2b, boots: 'snow', bootColor: 0x3a2a20, mug: 'R', mugColor: 0xf2efe7, lips: 0xb0705e, eyes: 0x4a6a8a, beard: true }, beh: { cheerStyle: 'toast', canWalk: true, seed: 211, waveArm: 'L' } },
    { look: { ...base, height: 1.7, skin: 0xf3d2bc, hair: 0xe0c48a, hairStyle: 'braids', headwear: 'headband', hatColor: 0xf2efe7, hatColor2: 0xb3261e, top: 'puffer', topColor: 0xd59f3a, accent: 0x6b4a10, pants: 'ski', pantsColor: 0x1d2838, boots: 'fluffy', bootColor: 0xe8dcc8, mug: 'L', mugColor: 0xc8281e, lips: 0xc8606e, eyes: 0x5a7aa0, part: 0.3 }, beh: { cheerStyle: 'clap', canWalk: true, seed: 223, jumpy: true, waveArm: 'R' } },
    { look: { ...base, height: 1.66, skin: 0x8a5a3c, hair: 0x15100c, hairStyle: 'curly', headwear: 'beanie', hatColor: 0x2d4c78, hatColor2: 0xd59f3a, top: 'parka', topColor: 0x8e2c1d, accent: 0x3a1209, fur: 0xe8dcc6, pants: 'ski', pantsColor: 0x3a3d44, boots: 'snow', bootColor: 0x2a2018, gloves: 0x2a2a2a, lips: 0x8a3c44, eyes: 0x2a1a10 }, beh: { cheerStyle: 'pump', canWalk: true, seed: 227, jumpy: true, waveArm: 'R' } },
    { look: { ...base, male: true, height: 1.79, skin: 0xd8a87c, hair: 0x3a2a1c, hairStyle: 'buzz', headwear: 'none', top: 'skiJacket', topColor: 0x4e6f4b, accent: 0xf2efe7, pants: 'ski', pantsColor: 0x1b1b1f, boots: 'snow', bootColor: 0x333333, mug: 'R', mugColor: 0xd59f3a, lips: 0xa0605a, eyes: 0x3a2a1a }, beh: { cheerStyle: 'armsUp', canWalk: true, seed: 229, waveArm: 'L' } },
    { look: { ...base, height: 1.69, skin: 0xf1cbb0, hair: 0x7a3a20, hairStyle: 'long', headwear: 'earmuffs', hatColor: 0xf2efe7, hatColor2: 0xd59f3a, top: 'cropPuffer', topColor: 0xf2efe7, accent: 0x2d4c78, fur: 0xf2efe7, pants: 'leggings', pantsColor: 0x2d4c78, boots: 'fluffy', bootColor: 0xf0e8dc, mug: 'R', mugColor: 0x2d4c78, lips: 0xd0606e, eyes: 0x4a6b3a, part: -0.4 }, beh: { cheerStyle: 'toast', canWalk: true, seed: 233, waveArm: 'R' } },
    // in the bathing tub (robes = bare shoulders in steam)
    { look: { ...base, height: 1.72, skin: 0xf2d0b8, hair: 0x5a3420, hairStyle: 'bun', headwear: 'beanie', hatColor: 0xc8281e, hatColor2: 0xf2efe7, top: 'robe', topColor: 0xf5f2ec, accent: 0xb38b6d, fur: 0xf8f6f2, pants: 'leggings', pantsColor: 0x9ca3af, boots: 'fluffy', bootColor: 0xf1e8d8, mug: 'R', mugColor: 0xd59f3a, lips: 0xc25a6a, eyes: 0x4a6b8a }, beh: { cheerStyle: 'armsUp', seated: true, seed: 239, waveArm: 'L' } },
    { look: { ...base, male: true, height: 1.82, skin: 0xe8c0a0, hair: 0x2a1a10, hairStyle: 'short', headwear: 'beanie', hatColor: 0x1f3554, hatColor2: 0xf2efe7, top: 'robe', topColor: 0xf5f2ec, accent: 0xb38b6d, fur: 0xf8f6f2, pants: 'leggings', pantsColor: 0x9ca3af, boots: 'fluffy', bootColor: 0xf1e8d8, mug: 'L', mugColor: 0xf2efe7, lips: 0xb06a60, eyes: 0x3a2a1a, beard: true }, beh: { cheerStyle: 'toast', seated: true, seed: 241, waveArm: 'R' } },
    // the cold-plunge enthusiast on the pier
    { look: { ...base, male: true, height: 1.8, skin: 0xf0cfb0, hair: 0xe8d090, hairStyle: 'short', headwear: 'none', top: 'robe', topColor: 0xc8281e, accent: 0xf2efe7, fur: null, pants: 'leggings', pantsColor: 0x1d2838, boots: 'snow', bootColor: 0x2a2a2a, lips: 0xb06a60, eyes: 0x4a6a8a }, beh: { cheerStyle: 'armsUp', canWalk: false, seed: 251, jumpy: true, waveArm: 'R', energy: 1.2 } },
  ];
})();

/** The "fjord-harbour" finish environment. */
/** waterfront roof finishes (tar paper, mossy turf, red tile, slate) */
const WATERFRONT_ROOFS = [0x2a2624, 0x4a4a2c, 0x6e2a1e, 0x3b4148, 0x2a2624, 0x55503a] as const;

export class Harbour implements FinishEnvironment {
  readonly group = new THREE.Group();
  readonly trophy: THREE.Object3D;
  readonly finishZ: number;
  /** sea level of the harbour */
  readonly sea: number;
  /** the pier end the plunger jumps from, and the splash point */
  readonly plungeFrom = new THREE.Vector3();
  readonly plungeEdge = new THREE.Vector3();
  readonly plungeTo = new THREE.Vector3();
  /** set on the frame the bather hits the water (the victory script adds the droplets) */
  splashNow = false;
  /** a camera position out on the water (harbour mouth) used by the victory reveal */
  readonly seaward = new THREE.Vector3();
  /** quay front z */
  readonly quayZ: number;
  /** the quay wall's top front edge, per 4 m bay (victory staging, tests) */
  quayFront: THREE.Vector3[] = [];
  private cols: CircleCollider[] = [];
  private podiumTop = new THREE.Vector3();
  private stamp = new THREE.Vector3();
  private stop = new THREE.Vector3();
  private yetiPt = new THREE.Vector3();
  private banner: Banner;
  private water: THREE.ShaderMaterial;
  private flame: THREE.ShaderMaterial;
  private flameMesh: THREE.Mesh;
  private fireLight: THREE.PointLight;
  private beacon: THREE.Mesh;
  private beaconLight: THREE.PointLight;
  private particles: Particles[] = [];
  private glows: Glows;
  private guests: Guest[] = [];
  /** the plunger (animated by the victory script through `plunge`) */
  readonly plunger: Guest;
  private plungerHome = new THREE.Vector3();
  /** 0 = standing on the pier … 1 = in the water (driven by the victory script) */
  plunge = 0;
  private splash: Particles;
  private ring: THREE.Mesh;
  private crown: THREE.Mesh;
  private splashT = -1;
  private plungerScale = 1;
  private splashed = false;
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private boats: THREE.Group;
  /** top of the sauna's stovepipe (smoke) */
  private saunaChimney = new THREE.Vector3();
  /** the harbourmaster who presents the trophy (victory) */
  readonly presenter: Guest;
  /** where the Yeti's fish-rack gag happens: the rack's centre and its long axis */
  readonly rack = new THREE.Vector3();
  /** the rack on the quay where the victory gag is staged (round 3) */
  readonly quayRack = new THREE.Vector3();
  readonly rackAxis = new THREE.Vector3(0, 0, 1);
  /** the presentation spot (presenter stands here, facing the skier's stop point) */
  readonly presentAt = new THREE.Vector3();
  private boatsBob: Array<{ o: THREE.Object3D; y: number; ph: number }> = [];

  constructor(o: HarbourOptions) {
    const hi = o.quality === 'high' || o.quality === 'ultra';
    const H = o.heightAt;
    const F = o.finishCenter.clone();
    const coast = o.mountain.coast!;
    this.finishZ = F.z;
    this.sea = coast.seaLevel;
    const sea = this.sea;
    this.quayZ = coast.shoreZ(F.x) - 8;
    const zq = this.quayZ;
    this.group.name = 'Harbour';
    const rnd = new Rand(4242);
    const W = (dx: number, dz: number) => new THREE.Vector3(F.x + dx, H(F.x + dx, F.z + dz), F.z + dz);
    const deckY = sea + 2.4;

    const K = kitMaterials();
    const env = envCube();
    const soft = softParticle();
    const bannerT = bannerTexture();
    this.textures.push(env, soft, bannerT);
    const M: Record<string, THREE.Material> = {
      ...K,
      vcol: K['paint']!,
      bulb: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      planks: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
    };
    (M['bulb'] as THREE.MeshBasicMaterial).color.setScalar(1.6);
    for (const m of new Set(Object.values(M))) this.materials.push(m);
    const b = new Batch();
    const nb = new Batch();

    // ---------------- finish gate: two carved posts, a beam hung with net floats ----------------
    const postX = 14.5;
    const gy = (H(F.x - postX, F.z) + H(F.x + postX, F.z)) / 2;
    const topY = gy + 7.4;
    for (const s of [-1, 1]) {
      const g = W(s * postX, 0);
      b.add('planks', new THREE.BoxGeometry(0.8, topY - g.y + 0.6, 0.8), mat(g.x, (g.y + topY) / 2, g.z), 0x4a3424);
      b.add('paint', new THREE.BoxGeometry(0.95, 0.5, 0.95), mat(g.x, g.y + 0.25, g.z), 0x2d4c78);
      // carved dragon-head-ish finial: a curled prow
      b.add('planks', new THREE.TorusGeometry(0.55, 0.16, 6, 12, Math.PI * 1.3).rotateY(Math.PI / 2), mat(g.x, topY + 1.0, g.z, 0, 0, s * 0.4), 0x5a3e2a);
      b.add('snow', new THREE.BoxGeometry(0.9, 0.12, 0.9), mat(g.x, topY + 0.32, g.z), 0xffffff);
      this.cols.push({ x: g.x, z: g.z, r: 0.75 });
    }
    b.add('planks', new THREE.BoxGeometry(postX * 2 + 1.6, 0.7, 0.7), mat(F.x, topY, F.z), 0x5a3e2a);
    b.add('snow', new THREE.BoxGeometry(postX * 2 + 1.4, 0.16, 0.6), mat(F.x, topY + 0.42, F.z), 0xffffff);
    // net floats hanging along the beam
    for (let i = 0; i <= 22; i++) {
      const x = F.x - postX + (i / 22) * postX * 2;
      const sag = Math.sin((i / 22) * Math.PI) * 0.5;
      b.add('paint', new THREE.SphereGeometry(0.2, 8, 6), mat(x, topY - 0.55 - sag, F.z + 0.4), i % 2 ? 0xe86a1e : 0xf2efe7);
    }
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerT, roughness: 0.65 });
    this.materials.push(bannerMat);
    this.banner = new Banner(24, 1.8, bannerMat);
    this.banner.group.position.set(F.x, topY - 1.9, F.z);
    this.group.add(this.banner.group);
    nb.add('paint', new THREE.PlaneGeometry(postX * 2 - 1, 0.5, 24, 1).rotateX(-Math.PI / 2), undefined, 0xc8281e, (g) => {
      const P = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i) + F.x;
        const z = P.getZ(i) + F.z;
        P.setXYZ(i, x, H(x, z) + 0.03, z);
      }
    });

    // ---------------- chute: rope on posts strung with buoys ----------------
    for (const s of [-1, 1]) {
      let prev: THREE.Vector3 | null = null;
      for (let dz = -72; dz <= 18; dz += 6) {
        const p = W(s * (15 + Math.max(0, dz) * 0.5), dz);
        b.add('planks', new THREE.CylinderGeometry(0.09, 0.1, 1.3, 6), mat(p.x, p.y + 0.55, p.z), 0x4a3424);
        if (prev) {
          const a = prev.clone().setY(prev.y + 1.05);
          const c = p.clone().setY(p.y + 1.05);
          const mid = a.clone().lerp(c, 0.5);
          mid.y -= 0.18;
          b.add('metal', new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, c), 6, 0.025, 4), undefined, 0xd8c8a0);
          b.add('paint', new THREE.SphereGeometry(0.17, 7, 5), mat(mid.x, mid.y - 0.12, mid.z), (dz / 6) % 2 ? 0xe86a1e : 0xf2efe7);
        }
        this.cols.push({ x: p.x, z: p.z, r: 0.25 });
        prev = p;
      }
    }

    // ---------------- quay, boardwalk and piers ----------------
    // round 2 (art review D6, critic 4): a real boardwalk of individual planks on piles, finger
    // piers of planks, a granite quay wall with a capping course and bollards
    const quayW = 150;
    // round 3 (art review A1): a granite quay WALL standing at the real waterline along the whole
    // waterfront. The heightfield's shore wanders in x (shoreZ is taken at the centre only), so a
    // straight wall at zq left a sloping, wet-blotched snow bank between the houses and the water.
    // Per 4 m bay: find where the ground meets the sea, fill the bank with a solid granite quay
    // (its top, the apron, at deck level), face it with coursed blocks, a capping course, a wet
    // weed line at the tide mark and iron bollards.
    const shoreAt = (x: number) => {
      let z = zq - 24;
      while (z < zq + 140 && H(x, z) > sea + 0.15) z += 2;
      let lo = z - 2;
      let hi2 = z;
      for (let k = 0; k < 5; k++) {
        const mid = (lo + hi2) / 2;
        if (H(x, mid) > sea + 0.15) lo = mid;
        else hi2 = mid;
      }
      return hi2;
    };
    const wallBase = sea - 2.6;
    this.quayFront = [];
    for (let x = -quayW - 12; x < quayW + 12; x += 4) {
      const px = F.x + x + 2;
      const zs = Math.max(zq + 1.4, Math.min(shoreAt(px - 1.5), shoreAt(px), shoreAt(px + 1.5)) + 0.6);
      this.quayFront.push(new THREE.Vector3(px, deckY, zs));
      const z0 = zq - 4;
      const t = 0.33 + 0.05 * Math.sin(x * 1.7);
      // the fill and its apron (top just under the boardwalk planks)
      b.add('stone', new THREE.BoxGeometry(4.02, deckY - 0.08 - wallBase, zs - z0), mat(px, (deckY - 0.08 + wallBase) / 2, (z0 + zs) / 2), new THREE.Color(t * 1.1, t * 1.1, t * 1.13));
      // coursed face blocks (three courses, staggered joints, each block its own tone)
      for (let c = 0; c < (hi ? 3 : 0); c++) {
        const y0 = wallBase + 0.4 + c * ((deckY - 0.35 - wallBase - 0.4) / 3);
        const hC = (deckY - 0.35 - wallBase - 0.4) / 3 - 0.06;
        const split = c % 2 ? 1.3 : 2.4;
        for (const [a0, a1] of [
          [-2, -2 + split],
          [-2 + split, 2],
        ] as const) {
          const tb = 0.28 + 0.1 * Math.abs(Math.sin(x * 3.1 + c * 1.7 + a0));
          b.add('stone', new THREE.BoxGeometry(a1 - a0 - 0.06, hC, 0.5), mat(px + (a0 + a1) / 2, y0 + hC / 2, zs + 0.18), new THREE.Color(tb, tb * 1.02, tb * 1.07));
        }
      }
      // capping course, proud of the face
      b.add('stone', new THREE.BoxGeometry(4.0, 0.32, 0.95), mat(px, deckY - 0.18, zs + 0.1), new THREE.Color(t * 1.35, t * 1.35, t * 1.38));
      // wet weed band at the tide line
      b.add('stone', new THREE.BoxGeometry(4.04, 0.9, 0.12), mat(px, sea + 0.25, zs + 0.45), new THREE.Color(0.07, 0.085, 0.06));
      if (((x + quayW + 12) / 4) % 5 === 2) b.add('metal', new THREE.CylinderGeometry(0.22, 0.28, 0.6, 10), mat(px, deckY + 0.25, zs - 0.35), 0x1e2226);
    }
    const bwz0 = zq + 2.2;
    const bwz1 = zq + 10;
    plankDeck(b, F.x, deckY + 0.03, (bwz0 + bwz1) / 2, Math.PI / 2, quayW * 2, bwz1 - bwz0, rnd);
    // snow swept to the landward edge of the boardwalk (a strip, not a sheet)
    nb.add('snow', new THREE.BoxGeometry(quayW * 2 - 2, 0.05, 1.2), mat(F.x, deckY + 0.07, bwz0 + 0.8), 0xffffff);
    // (low preset: half the piles and railing posts — round 3, tech review D5)
    for (let x = -quayW + 2; x < quayW; x += hi ? 4 : 8)
      for (const pz of [bwz0 + 0.4, bwz1 - 0.4]) b.add('planks', new THREE.CylinderGeometry(0.18, 0.2, 7, 6), mat(F.x + x, deckY - 3.6, pz), 0x2e231a);
    // railing posts with rope along the outer edge
    for (let x = -quayW + 1; x < quayW; x += hi ? 3 : 6) b.add('planks', new THREE.CylinderGeometry(0.06, 0.07, 1.0, 5), mat(F.x + x, deckY + 0.5, bwz1 - 0.2), 0x3b2c22);
    b.add('metal', new THREE.BoxGeometry(quayW * 2, 0.05, 0.05), mat(F.x, deckY + 0.95, bwz1 - 0.2), 0xd8c8a0);
    // finger piers (planks on piles), with bollards and tyres
    const piers = [-58, 22, 92];
    for (const px of piers) {
      const a0 = new THREE.Vector3(F.x + px, deckY - 0.05, bwz1);
      const a1 = new THREE.Vector3(F.x + px + 4, deckY - 0.05, bwz1 + 62);
      const len = Math.hypot(a1.x - a0.x, a1.z - a0.z);
      const yaw = Math.atan2(a1.x - a0.x, a1.z - a0.z);
      plankDeck(b, (a0.x + a1.x) / 2, deckY - 0.02, (a0.z + a1.z) / 2, yaw, len, 3.2, rnd);
      for (let sAl = -len / 2 + 0.4; sAl <= len / 2; sAl += 3)
        for (const sx of [-1, 1]) b.add('planks', new THREE.CylinderGeometry(0.15, 0.17, 10, 6).translate((sx * 3.2) / 2, -5 + 0.3, sAl), mat((a0.x + a1.x) / 2, deckY - 0.05, (a0.z + a1.z) / 2, 0, yaw, 0), 0x2e231a);
      for (let sAl = -len / 2 + 6; sAl < len / 2; sAl += 12)
        for (const sx of [-1, 1]) b.add('paint', new THREE.TorusGeometry(0.32, 0.12, 6, 12).rotateY(Math.PI / 2).translate(sx * 1.72, -0.35, sAl), mat((a0.x + a1.x) / 2, deckY - 0.05, (a0.z + a1.z) / 2, 0, yaw, 0), 0x1a1a1a);
    }
    // the bathing pier platform (stamp, bonfire, sauna): planks with an edge trim and a ladder
    const sp = new THREE.Vector3(F.x + 22 + 2, deckY, bwz1 + 40);
    plankDeck(b, sp.x + 6.5, deckY + 0.02, sp.z, 0, 12, 13, rnd);
    for (const dx of [1, 6.5, 12]) for (const dz of [-5.6, 0, 5.6]) b.add('planks', new THREE.CylinderGeometry(0.18, 0.2, 9, 6), mat(sp.x + dx, deckY - 4.6, sp.z + dz), 0x2e231a);
    for (let k = 0; k < 6; k++) b.add('metal', new THREE.BoxGeometry(0.5, 0.04, 0.04), mat(sp.x + 13.1, deckY - 0.4 - k * 0.35, sp.z + 4.2), 0x9aa0a8);
    for (const dz of [3.95, 4.45]) b.add('metal', new THREE.CylinderGeometry(0.025, 0.025, 2.4, 5), mat(sp.x + 13.1, deckY - 0.6, sp.z + dz), 0x9aa0a8);
    // a little wood-fired sauna hut on the platform (red, turf roof, smoking chimney)
    {
      const sx0 = sp.x + 3.2;
      const sz0 = sp.z + 3.4;
      house(b, sx0, deckY + 0.06, sz0, 0, { w: 3.6, d: 2.8, h: 2.3, color: 0x8e2c1d, roofH: 0.9, windows: false, door: 'side', roof: 0x4a4a2c, chimney: true }, rnd);
      this.saunaChimney.set(sx0 + 0.9, deckY + 4.6, sz0 - 0.42);
      this.cols.push({ x: sx0, z: sz0, r: 2.2 });
    }

    // ---------------- the bathing tub ("badestamp") ----------------
    const tub = new THREE.Vector3(sp.x + 8, deckY, sp.z + 1.5);
    const tubR = 1.25;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      b.add('planks', new THREE.BoxGeometry(0.29, 1.05, 0.11), mat(tub.x + Math.cos(a) * tubR, tub.y + 0.52, tub.z + Math.sin(a) * tubR, 0, -a + Math.PI / 2, 0), new THREE.Color(0x7a5236).multiplyScalar(0.88 + ((i * 37) % 9) / 40));
    }
    for (const hy of [0.25, 0.85]) b.add('metal', new THREE.TorusGeometry(tubR + 0.07, 0.035, 5, 32).rotateX(Math.PI / 2), mat(tub.x, tub.y + hy, tub.z), 0x2a2a2a);
    // its little iron stove with a chimney
    b.add('metal', new THREE.CylinderGeometry(0.28, 0.3, 0.9, 10), mat(tub.x + tubR + 0.5, tub.y + 0.45, tub.z), 0x222222);
    b.add('metal', new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), mat(tub.x + tubR + 0.5, tub.y + 1.6, tub.z), 0x222222);
    this.stamp.set(tub.x, tub.y + 0.82, tub.z);
    this.cols.push({ x: tub.x, z: tub.z, r: tubR + 0.6 });
    this.water = waterMaterial();
    this.materials.push(this.water);
    const tubWater = new THREE.Mesh(new THREE.CircleGeometry(tubR - 0.05, 32).rotateX(-Math.PI / 2), this.water);
    tubWater.position.copy(this.stamp);
    this.group.add(tubWater);
    // bonfire in an iron basket on the pier
    const fire = new THREE.Vector3(sp.x + 3, deckY, sp.z - 3.5);
    b.add('metal', new THREE.CylinderGeometry(0.75, 0.45, 0.7, 10, 1, true), mat(fire.x, fire.y + 0.85, fire.z), 0x1d1d1d);
    for (let i = 0; i < 3; i++) b.add('metal', new THREE.CylinderGeometry(0.04, 0.04, 0.9, 4), mat(fire.x + Math.cos(i * 2.1) * 0.5, fire.y + 0.4, fire.z + Math.sin(i * 2.1) * 0.5, Math.cos(i * 2.1) * 0.3, 0, Math.sin(i * 2.1) * 0.3), 0x1d1d1d);
    this.flame = flameMaterial();
    this.materials.push(this.flame);
    {
      const pos: number[] = [];
      const uv: number[] = [];
      // layered tongues: three outer cards and three smaller, brighter inner ones (round 2: C4)
      for (let i = 0; i < 6; i++) {
        const big = i < 3;
        const g = new THREE.PlaneGeometry(big ? 1.0 : 0.6, big ? 1.6 : 1.05).translate(big ? 0 : 0.08 * Math.cos(i), big ? 0.8 : 0.55, 0).rotateY((i * Math.PI) / 3 + (big ? 0 : 0.5)).toNonIndexed();
        pos.push(...(g.attributes.position as THREE.BufferAttribute).array);
        uv.push(...(g.attributes.uv as THREE.BufferAttribute).array);
        g.dispose();
      }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      this.flameMesh = new THREE.Mesh(fg, this.flame);
      this.flameMesh.position.set(fire.x, fire.y + 1.05, fire.z);
      this.flameMesh.renderOrder = 4;
      this.group.add(this.flameMesh);
    }
    this.fireLight = new THREE.PointLight(0xff8a3a, 12, 16, 2);
    this.fireLight.position.set(fire.x, fire.y + 2, fire.z);
    this.group.add(this.fireLight);
    this.cols.push({ x: fire.x, z: fire.z, r: 1 });
    // the plunge (round 3, C3): a run-up of ~4.5 m across the open side of the platform (clear of
    // the ladder, the tub, the stove and the sauna), off the edge and into the fjord ~3 m out
    this.plungeFrom.set(sp.x + 7.6, deckY + 0.05, sp.z + 5.4);
    this.plungeEdge.set(sp.x + 12.45, deckY + 0.05, sp.z + 5.4);
    this.plungeTo.set(sp.x + 15.6, sea, sp.z + 5.9);

    // ---------------- the waterfront (round 2, art review D6 / critic 4) ----------------
    // Not one gable box in a row: tall warehouses ("sjøhus") on piles at the water's edge with
    // their loading gables to the sea, low red boathouses between them, and behind the quay a
    // street of homes of several types (two-storey with porch, cottage with dormer, eaves-on
    // houses, a long low net loft) lining the run-out, so the view from the finish runs down a
    // village street onto the quay and the water.
    const sideRow = (x0: number, x1: number, dir: 1 | -1) => {
      let x = x0;
      let i = 0;
      while ((dir > 0 && x < x1) || (dir < 0 && x > x1)) {
        const kind = i % 3 === 1 ? 'home' : 'warehouse';
        const w = kind === 'warehouse' ? rnd.range(8, 10.5) : rnd.range(9, 12);
        const cx = x + (dir * w) / 2;
        const px = F.x + cx;
        const d = kind === 'warehouse' ? rnd.range(13, 17) : rnd.range(11, 14);
        // (round 8, F r6/r7 D8 "regimented waterfront", F-032: the gables stood in one ruler line at
        // one height under one roof colour — the fronts now step back off the quay edge, every fourth
        // building turns its eaves to the sea, and the roofs are tar, turf-moss, tile or slate)
        const hz = zq + 0.6 - d / 2 - (i % 2 === 0 ? rnd.range(0, 1.2) : rnd.range(1.5, 4.5));
        let gy = Infinity;
        for (const ex of [-w / 2, w / 2]) for (const ez of [-d / 2, d / 2]) gy = Math.min(gy, H(px + ex, hz + ez));
        gy = Math.max(gy, deckY);
        const col = PAINT[(i * 3 + (dir > 0 ? 1 : 0)) % PAINT.length]!;
        const roof = WATERFRONT_ROOFS[(i * 2 + (dir > 0 ? 1 : 0)) % WATERFRONT_ROOFS.length]!;
        const eaves = i % 4 === 3;
        if (kind === 'warehouse') warehouse(b, px, gy + 0.05, hz, eaves ? 0 : -Math.PI / 2, eaves ? { w, d, h: rnd.range(6.5, 8), color: col, roof } : { w: d, d: w, h: rnd.range(7.5, 12), color: col, roof }, rnd);
        else house(b, px, gy + 0.05, hz, -Math.PI / 2, { w: d, d: w, h: rnd.range(5.6, 8.4), roofH: w * rnd.range(0.4, 0.62), color: col, door: 'side', chimney: true, dormer: i % 2 === 0, roof }, rnd);
        for (let cxx = -w / 2 + 1.6; cxx < w / 2; cxx += 3.2) this.cols.push({ x: px + cxx, z: hz - d / 2 + 1.6, r: 2.0 }, { x: px + cxx, z: hz, r: 2.2 }, { x: px + cxx, z: hz + d / 2 - 1.6, r: 2.0 });
        x += dir * (w + rnd.range(1.2, 3.5));
        i++;
      }
      // red boathouses on stilts over the water beyond the end of the boardwalk
      for (let k = 0; k < 2; k++) {
        const px = F.x + dir * (156 + k * 9);
        house(b, px, deckY - 0.3, zq + 6, -Math.PI / 2, { w: 9, d: 7, h: 3.4, color: k ? 0x9b3524 : 0x8e2c1d, roofH: 2.6, stilts: 7, door: 'boat', windows: false }, rnd);
      }
    };
    sideRow(-34, -146, -1);
    sideRow(34, 146, 1);
    // the street of homes either side of the run-out, gables or eaves to the street
    const homeTypes = [
      { w: 10, d: 7.5, h: 7.4, porch: true, dormer: false, roofK: 0.5 },
      { w: 8, d: 6.5, h: 4.4, porch: false, dormer: true, roofK: 0.62 },
      { w: 12, d: 6, h: 4.8, porch: true, dormer: true, roofK: 0.45 },
      { w: 7, d: 7, h: 6.2, porch: false, dormer: false, roofK: 0.75 },
      { w: 15, d: 6, h: 4.0, porch: false, dormer: false, roofK: 0.4 },
    ];
    for (const side of [-1, 1] as const) {
      let dz = 40 + rnd.range(0, 8);
      let j = side > 0 ? 1 : 0;
      while (dz < zq - F.z - 26) {
        const T = homeTypes[j % homeTypes.length]!;
        const eavesToStreet = j % 3 !== 2;
        const dx = side * (40 + rnd.range(0, 6) + (eavesToStreet ? T.d / 2 : T.w / 2));
        const p = W(dx, dz + (eavesToStreet ? T.w / 2 : T.d / 2));
        let gy = Infinity;
        for (const ex of [-T.w / 2, T.w / 2]) for (const ez of [-T.d / 2, T.d / 2]) gy = Math.min(gy, H(p.x + ex, p.z + ez));
        const yaw = eavesToStreet ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0;
        const col = PAINT[(j * 3 + (side > 0 ? 1 : 4)) % PAINT.length]!;
        const trim = j % 5 === 3 ? 0x2d4c78 : 0xf2efe7;
        house(b, p.x, gy + 0.05, p.z, yaw, { w: T.w, d: T.d, h: T.h, color: col, roofH: T.d * T.roofK, door: 'side', porch: T.porch, dormer: T.dormer, chimney: j % 2 === 0, trim }, rnd);
        this.cols.push({ x: p.x, z: p.z, r: Math.max(T.w, T.d) * 0.55 });
        // a picket fence and a parked kick-sled by every other door
        if (j % 2 === 1) {
          const q = W(dx - side * (T.d / 2 + 2.4), dz + 1.5);
          sparkSled(b, q.x, q.y, q.z, side > 0 ? 0.3 : -0.3, j % 4 === 1 ? 0xc8281e : 0x2d4c78);
        }
        dz += (eavesToStreet ? T.w : T.d) + rnd.range(3, 8);
        j++;
      }
    }

    // ---------------- the quay plaza: paving, podium, lamps, lights, benches, crates ----------------
    {
      // granite setts with snow in the joints, from the end of the chute to the quay edge,
      // between the house rows; a ragged snow edge (vertex alpha) blends it into the run-out
      const x0 = -34;
      const x1 = 34;
      const z0 = 24;
      const z1 = zq - F.z;
      const nx = 34;
      const nz = Math.max(8, Math.round((z1 - z0) / 2));
      const pos: number[] = [];
      const uv: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= nz; j++)
        for (let i = 0; i <= nx; i++) {
          const dx = x0 + ((x1 - x0) * i) / nx;
          const dz = z0 + ((z1 - z0) * j) / nz;
          const x = F.x + dx;
          const z = F.z + dz;
          pos.push(x, Math.max(H(x, z), j === nz ? deckY : -Infinity) + 0.03, z);
          uv.push(dx / 4.5, dz / 4.5);
          // a street that widens into the quay square near the water; the edge is feathered
          // and ragged (swept snow banks), never a rectangle
          const toQuay = (z1 - dz) / Math.max(1, z1 - z0);
          const halfW = 11 + 23 * (1 - Math.min(1, Math.max(0, (toQuay - 0.15) / 0.45)));
          const wob = 2.2 * Math.sin(dz * 0.31 + dx * 0.2) + 1.4 * Math.sin(dz * 0.83 - dx * 0.5);
          const edge = Math.min(1, (dz - z0) / 14, (halfW + wob - Math.abs(dx)) / 7);
          const a = Math.max(0, Math.min(1, edge));
          col.push(1, 1, 1, a);
        }
      for (let j = 0; j < nz; j++)
        for (let i = 0; i < nx; i++) {
          const q = j * (nx + 1) + i;
          idx.push(q, q + nx + 1, q + 1, q + 1, q + nx + 1, q + nx + 2);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
      g.setIndex(idx);
      g.computeVertexNormals();
      const tex = settTexture();
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
      const pm = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, transparent: true, roughness: 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      this.textures.push(tex);
      this.materials.push(pm);
      const paving = new THREE.Mesh(g, pm);
      paving.receiveShadow = true;
      paving.renderOrder = 1;
      paving.name = 'harbour-paving';
      this.group.add(paving);
    }
    // the presentation spot: a low stack of fish crates the harbourmaster stands on, beside the
    // stop point (off the line the skier comes in on), facing the skier
    const pod = W(-5.5, 38.5);
    this.presentAt.copy(pod);
    {
      const crate = (x: number, y: number, z: number, c: number, ry: number) => {
        b.add('planks', new THREE.BoxGeometry(1.2, 0.55, 0.8), mat(x, y + 0.275, z, 0, ry, 0), new THREE.Color(c));
        for (const sx of [-0.62, 0.62]) b.add('planks', new THREE.BoxGeometry(0.04, 0.5, 0.82), mat(x + sx * Math.cos(ry), y + 0.28, z - sx * Math.sin(ry), 0, ry, 0), 0x3a2a1e);
      };
      for (const dx of [-0.62, 0.62]) for (const dz of [-0.42, 0.42]) crate(pod.x + dx, pod.y, pod.z + dz, 0x2d4c78, 0);
      // stacks beside it: red and ochre crates, the trophy waits on the tallest
      for (let l = 0; l < 2; l++) crate(pod.x + 2.2, pod.y + l * 0.55, pod.z, 0xc8281e, 0.1);
      crate(pod.x - 2.1, pod.y, pod.z + 0.2, 0xd59f3a, -0.15);
      this.podiumTop.set(pod.x + 2.2, pod.y + 2 * 0.55, pod.z);
      this.cols.push({ x: pod.x, z: pod.z, r: 1.4 }, { x: pod.x + 2.2, z: pod.z, r: 0.9 }, { x: pod.x - 2.1, z: pod.z, r: 0.9 });
      b.add('metal', new THREE.TorusGeometry(0.45, 0.09, 6, 16).rotateX(Math.PI / 2), mat(pod.x + 3.6, pod.y + 0.1, pod.z + 0.4), 0xc9b48a);
      b.add('paint', new THREE.SphereGeometry(0.35, 10, 8), mat(pod.x - 3.4, pod.y + 0.35, pod.z + 0.9), 0xe86a1e);
    }
    const bulbs: Array<{ p: THREE.Vector3; c: number }> = [];
    const poles = [W(-24, 56), W(22, 54), W(26, 112), W(-28, 116), W(0, 150)];
    const tops = poles.map((p) => {
      const t = lampPost(b, p.x, p.y, p.z);
      bulbs.push({ p: t, c: 0xffc070 });
      this.cols.push({ x: p.x, z: p.z, r: 0.3 });
      return t;
    });
    for (let i = 0; i < tops.length; i++) stringLights(b, tops[i]!, tops[(i + 1) % tops.length]!, 0.7, hi ? 0.6 : 0.9, bulbs, rnd);
    for (const [dx, dz, ry] of [
      [-10, 120, 0],
      [12, 124, 0.2],
      [-30, 86, 1.4],
    ] as const) {
      const p = W(dx, dz);
      bench(b, p.x, p.y, p.z, ry);
      this.cols.push({ x: p.x, z: p.z, r: 0.9 });
    }
    // mid-ground life on the street: a fish kiosk with a striped awning, a flag mast, parked
    // kick-sleds and stacked lobster pots (round 2: the 10b eye-level view was an empty plain)
    {
      const k = W(15, 82);
      const ky = k.y;
      b.add('planks', new THREE.BoxGeometry(3.2, 1.1, 1.6), mat(k.x, ky + 0.55, k.z, 0, -0.35, 0), 0x6b4e36);
      for (const [sx, sz] of [[-1.5, -0.7], [1.5, -0.7], [-1.5, 0.7], [1.5, 0.7]] as const) b.add('planks', new THREE.BoxGeometry(0.1, 2.4, 0.1), mat(k.x, ky, k.z, 0, -0.35, 0).multiply(new THREE.Matrix4().makeTranslation(sx, 1.2, sz)), 0x4a3424);
      for (let i = 0; i < 8; i++) b.add('paint', new THREE.BoxGeometry(0.42, 0.06, 2.0), mat(k.x, ky, k.z, 0, -0.35, 0).multiply(new THREE.Matrix4().makeTranslation(-1.47 + i * 0.42, 2.45, 0)).multiply(new THREE.Matrix4().makeRotationX(0.25)), i % 2 ? 0xf2efe7 : 0xc8281e);
      for (let i = 0; i < 5; i++) b.add('paint', new THREE.BoxGeometry(0.45, 0.14, 0.3), mat(k.x, ky, k.z, 0, -0.35, 0).multiply(new THREE.Matrix4().makeTranslation(-1.0 + i * 0.5, 1.18, 0.3)), [0xb9a172, 0xd8c8a0, 0xc76b4c][i % 3]!);
      this.cols.push({ x: k.x, z: k.z, r: 2 });
      const fm = W(-17, 30);
      b.add('paint', new THREE.CylinderGeometry(0.07, 0.12, 10, 8), mat(fm.x, fm.y + 5, fm.z), 0xf2efe7);
      b.add('metal', new THREE.SphereGeometry(0.14, 8, 6), mat(fm.x, fm.y + 10.05, fm.z), 0xd9b24a);
      nb.add('paint', new THREE.PlaneGeometry(3.4, 0.4, 8, 1).translate(1.7, 0, 0), mat(fm.x + 0.05, fm.y + 9.5, fm.z, 0, 0, -0.08), (q) => new THREE.Color(q.x - fm.x < 0.6 ? 0xf2efe7 : 0xc8281e));
      this.cols.push({ x: fm.x, z: fm.z, r: 0.3 });
      for (let i = 0; i < 3; i++) {
        const q = W(9 + i * 0.9, 54 + i * 0.3);
        sparkSled(b, q.x, q.y, q.z, 0.2 + i * 0.1, [0xc8281e, 0x2d4c78, 0x4e6f4b][i]!);
      }
      for (let i = 0; i < 4; i++) {
        const q = W(-14 + (i % 2) * 1.1, 66 + Math.floor(i / 2) * 0.1);
        b.add('planks', new THREE.BoxGeometry(1.0, 0.55, 0.7), mat(q.x, q.y + 0.28 + Math.floor(i / 2) * 0.56, q.z, 0, 0.1, 0), 0x6a5444);
      }
      this.cols.push({ x: F.x - 13.5, z: F.z + 66, r: 1.2 });
    }

    // fish crates, barrels and a hand cart along the quay edge
    for (let i = 0; i < 9; i++) {
      let dx = rnd.range(-30, 30);
      if (dx < -12 && dx > -36) dx += 24; // keep the quay rack (the Yeti's gag) clear
      const p = W(dx, zq - F.z - rnd.range(2.5, 6));
      const y0 = Math.max(p.y, deckY);
      const c = [0x2d4c78, 0xc8281e, 0xd59f3a, 0xece7dc][i % 4]!;
      for (let l = 0; l < 1 + (i % 3); l++) b.add('planks', new THREE.BoxGeometry(1.2, 0.5, 0.8), mat(p.x, y0 + 0.25 + l * 0.5, p.z, 0, rnd.range(-0.2, 0.2), 0), c);
      this.cols.push({ x: p.x, z: p.z, r: 0.8 });
    }
    // stockfish racks ("hjell"): the big one up at the snow line where the Yeti stops, two more
    // along the edge of the village
    {
      const rp = W(-46, 10);
      fishRack(b, rp.x, rp.y - 0.1, rp.z, Math.PI / 2, 12, rnd);
      this.rack.set(rp.x, rp.y, rp.z);
      this.rackAxis.set(0, 0, 1);
      for (const dz of [-5.5, 0, 5.5]) for (const s of [-0.75, 0.75]) this.cols.push({ x: rp.x + s, z: rp.z + dz, r: 0.3 });
      // round 3 (C4/A11): the gag rack stands on the quay by the water — the Yeti is filmed in
      // front of it with the boats, the fjord and the islands behind him
      {
        const q = W(-24, zq - F.z - 12);
        const qy = Math.max(q.y, deckY);
        fishRack(b, q.x, qy - 0.1, q.z, 0, 10, rnd);
        this.quayRack.set(q.x, qy, q.z);
        for (const dx of [-4.5, 0, 4.5]) for (const s2 of [-0.75, 0.75]) this.cols.push({ x: q.x + dx, z: q.z + s2, r: 0.3 });
      }
      for (const [dx, dz, ry] of [
        [58, 18, 0.3],
        [-64, 64, Math.PI / 2],
      ] as const) {
        const q = W(dx, dz);
        fishRack(b, q.x, q.y - 0.1, q.z, ry, 9, rnd);
        this.cols.push({ x: q.x, z: q.z, r: 1.2 });
      }
    }

    // ---------------- lighthouse on a skerry at the harbour mouth ----------------
    const lh = new THREE.Vector3(F.x + 175, sea, zq + 230);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = rnd.range(5, 11);
      const s = rnd.range(3, 6);
      const t = 0.18 + rnd.range(0, 0.08);
      b.add('stone', new THREE.DodecahedronGeometry(s, 0).scale(1, 0.6, 1), mat(lh.x + Math.cos(a) * r, sea + rnd.range(-1.5, 1.2), lh.z + Math.sin(a) * r, rnd.range(0, 1), rnd.range(0, 6), 0), new THREE.Color(t, t, t * 1.1));
    }
    b.add('stone', new THREE.CylinderGeometry(6, 8, 6, 10), mat(lh.x, sea + 1, lh.z), 0x3a3c40);
    for (let k = 0; k < 4; k++) b.add('paint', new THREE.CylinderGeometry(2.2 - k * 0.18, 2.4 - k * 0.18, 4, 14), mat(lh.x, sea + 6 + k * 4, lh.z), k % 2 ? 0xc8281e : 0xf2efe7);
    b.add('metal', new THREE.CylinderGeometry(1.6, 1.6, 2.2, 10, 1, true), mat(lh.x, sea + 22.2, lh.z), 0x222222);
    b.add('paint', new THREE.ConeGeometry(2.0, 1.8, 10), mat(lh.x, sea + 24.2, lh.z), 0xc8281e);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe6a0, toneMapped: false }));
    this.materials.push(this.beacon.material as THREE.Material);
    this.beacon.position.set(lh.x, sea + 22.2, lh.z);
    this.group.add(this.beacon);
    this.beaconLight = new THREE.PointLight(0xffd890, 30, 80, 2);
    this.beaconLight.position.copy(this.beacon.position);
    this.group.add(this.beaconLight);
    this.seaward.set(F.x + 60, sea + 7, zq + 330);

    // ---------------- island dressing (round 3, A3) ----------------
    // the islands off the harbour (the finish, the reveal) get life: sparse pine stands on their
    // flanks, a red boathouse at a landing, a small light on an outlying skerry. Island tops are
    // found by sampling the terrain on a coarse grid once.
    {
      const sz = coast.shoreZ(F.x);
      const tops: Array<{ x: number; z: number; h: number }> = [];
      const step = hi ? 70 : 110;
      for (let z = sz + 450; z < sz + 3200; z += step)
        for (let x = F.x - 2400; x < F.x + 2400; x += step) {
          const h = H(x, z);
          if (h < sea + 14) continue;
          if (H(x + step, z) > h || H(x - step, z) > h || H(x, z + step) > h || H(x, z - step) > h) continue;
          tops.push({ x, z, h });
        }
      tops.sort((a, c) => c.h - a.h);
      const pine = (x: number, y: number, z: number, hgt: number) => {
        b.add('paint', new THREE.CylinderGeometry(0.06 * hgt, 0.09 * hgt, hgt * 0.3, 5), mat(x, y + hgt * 0.15, z), 0x3a2a1e);
        for (let k = 0; k < 3; k++) b.add('paint', new THREE.ConeGeometry(hgt * (0.3 - k * 0.07), hgt * 0.45, 6), mat(x, y + hgt * (0.35 + k * 0.2), z), k === 2 ? 0x32523e : 0x1f3a2b);
      };
      const nIsl = Math.min(tops.length, hi ? 7 : 4);
      for (let i = 0; i < nIsl; i++) {
        const t = tops[i]!;
        const rh = t.h - sea;
        if (i % 3 !== 2) {
          // pines on the lower flanks (sheltered), in a few clumps
          for (let c2 = 0; c2 < (hi ? 4 : 2); c2++) {
            const a = rnd.range(0, Math.PI * 2);
            const d = rnd.range(0.3, 0.8) * Math.min(220, rh * 2.4);
            const cx = t.x + Math.cos(a) * d;
            const cz = t.z + Math.sin(a) * d;
            for (let k = 0; k < (hi ? 7 : 4); k++) {
              const px = cx + rnd.range(-18, 18);
              const pz = cz + rnd.range(-18, 18);
              const py = H(px, pz);
              if (py < sea + 4 || py > t.h - rh * 0.15) continue;
              pine(px, py - 0.5, pz, rnd.range(9, 16));
            }
          }
        }
        if (i % 3 === 1) {
          // a red boathouse at a landing on the shore
          for (let k = 0; k < 12; k++) {
            const a = rnd.range(0, Math.PI * 2);
            const px = t.x + Math.cos(a) * rh * 2.2;
            const pz = t.z + Math.sin(a) * rh * 2.2;
            const py = H(px, pz);
            if (py > sea + 1 && py < sea + 10) {
              house(b, px, py, pz, a + Math.PI / 2, { w: 14, d: 9, h: 6, color: 0x8e2c1d, roofH: 4, windows: false, door: 'boat' }, rnd);
              break;
            }
          }
        }
      }
      // a small light on the lowest outlying skerry
      const sk = tops.filter((q) => q.h < sea + 40).pop() ?? tops[tops.length - 1];
      if (sk) {
        const y = H(sk.x, sk.z);
        b.add('paint', new THREE.CylinderGeometry(2.0, 2.6, 12, 10), mat(sk.x, y + 6, sk.z), 0xf2efe7);
        b.add('paint', new THREE.CylinderGeometry(2.05, 2.05, 3, 10), mat(sk.x, y + 8, sk.z), 0xc8281e);
        b.add('paint', new THREE.ConeGeometry(2.4, 2.4, 10), mat(sk.x, y + 13.2, sk.z), 0xc8281e);
      }
    }

    // ---------------- moored boats (bob gently) ----------------
    this.boats = new THREE.Group();
    // round 2 (art review D6): boats where the finish cameras and the player see them — moored
    // stern-to along the central boardwalk, alongside the finger piers, a bigger trawler at the
    // end of the east pier, two boats underway further out
    const moor: Array<[number, number, number, number]> = [
      [-22, 5.5, 1.5, 0],
      [-8, 5.0, 1.62, 1],
      [9, 5.5, 1.48, 2],
      [-52, 20, 0.1, 3],
      [-64, 42, -0.08, 4],
      [28, 24, 0.05, 5],
      [100, 30, -0.1, 3],
      [84, 56, 0.12, 4],
      [-20, 46, 0.3, 0],
      [-150, 160, 0.9, 1],
      [120, 230, -0.6, 2],
    ];
    const hulls = [0x2d4c78, 0xc8281e, 0xf2efe7, 0x1d4a3a, 0xd59f3a, 0x15171b];
    const boatMeshes: THREE.Group[] = [];
    for (const [mi, [dx, dz, yaw, k]] of moor.entries()) {
      // low preset: every other moored boat (each boat is its own few draw calls)
      if (!hi && mi % 2 === 1) continue;
      const one = new Batch();
      fishingBoat(one, 0, 0, 0, 0, { len: dx === 100 ? 18 : rnd.range(9, 13), hull: hulls[k]!, stripe: k === 2 ? 0x2d4c78 : 0xf2efe7, cabin: k === 2 ? 0x2d4c78 : 0xf2efe7 });
      const g = new THREE.Group();
      for (const me of one.build(M, { cast: hi, receive: true })) g.add(me);
      g.position.set(F.x + dx, sea, bwz1 + dz);
      g.rotation.y = yaw;
      this.boats.add(g);
      boatMeshes.push(g);
      this.boatsBob.push({ o: g, y: sea, ph: rnd.range(0, 6) });
    }
    // distant ships on the horizon: a coastal freighter and a ferry heading out (static silhouettes)
    for (const [dx, dz, L, yaw] of [
      [-900, 2600, 110, 0.4],
      [700, 3600, 140, -1.2],
    ] as const) {
      const sb = new Batch();
      ferry(sb, L);
      const g = new THREE.Group();
      for (const me of sb.build(M, { cast: false, receive: false })) g.add(me);
      g.position.set(F.x + dx, sea, zq + dz);
      g.rotation.y = yaw;
      this.boats.add(g);
    }
    this.group.add(this.boats);

    // ---------------- build ----------------
    for (const me of b.build(M, { cast: true, receive: true })) this.group.add(me);
    for (const me of nb.build(M, { cast: false, receive: true })) this.group.add(me);

    // ---------------- trophy: a gilded lighthouse on a rope-bound driftwood plinth ----------------
    this.trophy = this.buildTrophy(env);
    this.trophy.position.copy(this.podiumTop);
    this.trophy.rotation.y = Math.PI;
    this.group.add(this.trophy);

    // ---------------- particles & glows ----------------
    this.particles.push(
      new Particles({ count: hi ? 60 : 24, origin: this.stamp.clone(), radius: tubR * 0.8, life: [3, 6], rise: [0.4, 0.8], drift: new THREE.Vector3(0.6, 0, 0.1), size: [0.8, 3.2], alpha: 0.4, color: 0xf3f8ff, swirl: 0.25 }, soft),
      new Particles({ count: hi ? 24 : 10, origin: new THREE.Vector3(tub.x + tubR + 0.5, tub.y + 2.5, tub.z), radius: 0.1, life: [3, 6], rise: [0.6, 1.0], drift: new THREE.Vector3(0.8, 0, 0.2), size: [0.5, 2.6], alpha: 0.25, color: 0xd8dde4, colorEnd: 0xa8b0bc, swirl: 0.3 }, soft),
      new Particles({ count: hi ? 22 : 10, origin: fire.clone().setY(fire.y + 1.2), radius: 0.3, life: [0.8, 2.0], rise: [0.9, 1.7], drift: new THREE.Vector3(0.2, 0, 0.05), size: [0.08, 0.04], alpha: 1, color: 0xffc050, colorEnd: 0xff3000, additive: true, swirl: 0.5 }, soft),
    );
    this.particles.push(new Particles({ count: hi ? 26 : 10, origin: this.saunaChimney.clone(), radius: 0.08, life: [3, 6], rise: [0.7, 1.1], drift: new THREE.Vector3(0.9, 0, 0.2), size: [0.5, 2.8], alpha: 0.3, color: 0xdde2e8, colorEnd: 0xa8b0bc, swirl: 0.3 }, soft));
    this.splash = new Particles({ count: hi ? 70 : 30, origin: this.plungeTo.clone(), radius: 0.7, life: [0.6, 1.4], rise: [3.5, 6], drift: new THREE.Vector3(0, 0, 0), size: [0.25, 0.7], alpha: 0.85, color: 0xffffff, swirl: 0.1 }, soft);
    this.splash.points.visible = false;
    this.particles.push(this.splash);
    // round 3 (A8/C3): a crown splash — a ring of torn spray sheets thrown up and out, a central
    // jet, and a feathered foam patch that spreads and breaks up (no flat opaque ring)
    {
      const sprayT = sprayTexture();
      const foamT = foamTexture();
      this.textures.push(sprayT, foamT);
      const sprayM = new THREE.MeshBasicMaterial({ map: sprayT, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xf4f9fc, opacity: 0 });
      const foamM = new THREE.MeshBasicMaterial({ map: foamT, transparent: true, depthWrite: false, color: 0xeef6fa, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.materials.push(sprayM, foamM);
      const pos: number[] = [];
      const uv: number[] = [];
      const N = 16;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + Math.sin(i * 2.7) * 0.12;
        const w = 0.55 + 0.25 * Math.abs(Math.sin(i * 1.9));
        const hgt = 0.75 + 0.5 * Math.abs(Math.sin(i * 3.3));
        // a sheet leaning outward: bottom on a unit ring, top further out (scaled per frame)
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const tx = -sn;
        const tz = c;
        const b0 = [c - tx * w * 0.5, 0, sn - tz * w * 0.5];
        const b1 = [c + tx * w * 0.5, 0, sn + tz * w * 0.5];
        const t0 = [c * 1.45 - tx * w * 0.7, hgt, sn * 1.45 - tz * w * 0.7];
        const t1 = [c * 1.45 + tx * w * 0.7, hgt, sn * 1.45 + tz * w * 0.7];
        pos.push(...b0, ...b1, ...t1, ...b0, ...t1, ...t0);
        uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      }
      // the central jet: two crossed tall cards
      for (const a of [0, Math.PI / 2]) {
        const c = Math.cos(a) * 0.35;
        const sn = Math.sin(a) * 0.35;
        pos.push(-c, 0, -sn, c, 0, sn, c * 0.5, 2.2, sn * 0.5, -c, 0, -sn, c * 0.5, 2.2, sn * 0.5, -c * 0.5, 2.2, -sn * 0.5);
        uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      this.crown = new THREE.Mesh(g, sprayM);
      this.crown.position.copy(this.plungeTo).setY(this.sea);
      this.crown.visible = false;
      this.crown.renderOrder = 5;
      this.group.add(this.crown);
      this.ring = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), foamM);
      this.ring.position.copy(this.plungeTo).setY(this.sea + 0.05);
      this.ring.visible = false;
      this.ring.renderOrder = 4;
      this.group.add(this.ring);
    }
    for (const p of this.particles) this.group.add(p.points);
    const gl = bulbs.map((q) => ({ p: q.p, c: q.c, size: 0.55, a: 0.5 }));
    gl.push({ p: fire.clone().setY(fire.y + 1.4), c: 0xff7a20, size: 2.6, a: 0.35 });
    gl.push({ p: this.beacon.position.clone(), c: 0xffe0a0, size: 9, a: 0.55 });
    this.glows = new Glows(gl, soft);
    this.group.add(this.glows.points);

    // ---------------- guests ----------------
    const guestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide });
    this.materials.push(guestMat);
    this.stop.copy(W(0, 38));
    // the Yeti stops at the stockfish rack (round 2: C7 — the gag is staged at the rack)
    // round 3: by the quay rack, on its landward side (filmed from up the street, the sea behind)
    this.yetiPt.copy(this.quayRack).add(new THREE.Vector3(0.6, 0, -2.3));
    this.yetiPt.y = Math.max(H(this.yetiPt.x, this.yetiPt.z), deckY);
    const ground = (x: number, z: number) => Math.max(H(x, z), x > F.x - quayW && x < F.x + quayW && z > zq ? deckY + 0.1 : -Infinity);
    const seat = () => this.stamp.y - 0.42;
    const pierY = () => deckY + 0.1;
    LOOKS.forEach((s, i) => {
      if (!hi && (i === 3 || i === 4)) return;
      const g = new Guest(s.look, s.beh, guestMat, s.beh.seated ? seat : i === 7 ? pierY : ground);
      if (i < 5) {
        const spots: Array<[number, number]> = [
          [9, 52],
          [-7, 55],
          [12, 62],
          [-15, 60],
          [4, 66],
        ];
        const [dx, dz] = spots[i]!;
        const p = W(dx, dz);
        g.place(p.x, p.z, Math.atan2(this.stop.x - p.x, this.stop.z - p.z), null);
      } else if (s.beh.seated) {
        // inside the staves (round 2: C4), facing the middle of the tub
        const a = (i === 5 ? -0.7 : 1.3) + Math.PI;
        g.place(tub.x + Math.sin(a) * (tubR - 0.62), tub.z + Math.cos(a) * (tubR - 0.62), a + Math.PI, null);
      } else {
        g.place(this.plungeFrom.x, this.plungeFrom.z, Math.atan2(this.plungeTo.x - this.plungeFrom.x, this.plungeTo.z - this.plungeFrom.z), null);
      }
      this.guests.push(g);
      this.group.add(g.group);
    });
    this.plunger = this.guests[this.guests.length - 1]!;
    this.plungerHome.copy(this.plunger.group.position);
    this.plungerScale = this.plunger.group.scale.x;
    // yaw first, then the forward roll about the bather's own right axis
    this.plunger.group.rotation.order = 'YXZ';
    // the harbourmaster in yellow oilskins, standing on the crates, who presents the trophy
    {
      const base = { hatColor: 0xffffff, hatColor2: 0xffffff, scarf: null, fur: null, gloves: null, mug: null, mugColor: 0xffffff, beard: false } as const;
      const look: GuestLook = { ...base, male: true, height: 1.86, skin: 0xe8b898, hair: 0xb8b0a0, hairStyle: 'short', headwear: 'beanie', hatColor: 0x1f3554, hatColor2: 0x1f3554, top: 'parka', topColor: 0xe8b21e, accent: 0x6b4a10, pants: 'ski', pantsColor: 0x1d2838, boots: 'snow', bootColor: 0x1a1a1a, gloves: 0x2a2a2a, lips: 0xa0605a, eyes: 0x4a6a8a, beard: true };
      const pTop = this.presentAt.y + 0.55;
      const pa = this.presentAt.clone();
      // on his crates, or on the ground when the victory script brings him to the skier
      const g = new Guest(look, { cheerStyle: 'clap', canWalk: false, seed: 263, waveArm: 'R', energy: 0.6 }, guestMat, (x, z) => (Math.hypot(x - pa.x, z - pa.z) < 1.4 ? pTop : ground(x, z)));
      g.place(this.presentAt.x, this.presentAt.z, Math.atan2(this.stop.x - this.presentAt.x, this.stop.z - this.presentAt.z), null);
      this.presenter = g;
      this.guests.push(g);
      this.group.add(g.group);
    }
    this.update(0.016, 0, { cheer: 0, lookAt: null, welcome: 0 });
  }

  private buildTrophy(env: THREE.CubeTexture): THREE.Object3D {
    const g = new THREE.Group();
    g.name = 'Trophy';
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xffb02a, metalness: 1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 1.4 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4e36, roughness: 0.75 });
    const rope = new THREE.MeshStandardMaterial({ color: 0xcdb98c, roughness: 0.9 });
    this.materials.push(gold, wood, rope);
    const v = (r: number, y: number) => new THREE.Vector2(r, y);
    // gilded lighthouse: tapering tower, gallery, lantern, cap (held part = first child)
    const tower = new THREE.LatheGeometry([v(0, 0.2), v(0.13, 0.2), v(0.13, 0.23), v(0.105, 0.25), v(0.085, 0.62), v(0.12, 0.64), v(0.12, 0.66), v(0.07, 0.66), v(0.07, 0.74), v(0.095, 0.75), v(0.06, 0.8), v(0.0, 0.83)], 28);
    const rings = [0.33, 0.45, 0.56].map((y) => new THREE.TorusGeometry(0.098 - (y - 0.33) * 0.05, 0.01, 6, 28).rotateX(Math.PI / 2).translate(0, y, 0));
    const ship = new THREE.TorusGeometry(0.17, 0.012, 6, 32).translate(0, 0.36, 0);
    const spokes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spokes.push(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 5).rotateZ(a).translate(0, 0.36, 0));
      spokes.push(new THREE.SphereGeometry(0.018, 6, 5).translate(Math.sin(a) * 0.21, 0.36 + Math.cos(a) * 0.21, 0));
    }
    const parts = [tower, ...rings, ship, ...spokes].map((p) => {
      const n = p.index ? p.toNonIndexed() : p;
      for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
      return n;
    });
    const pos: number[] = [];
    const nor: number[] = [];
    for (const p of parts) {
      pos.push(...(p.attributes.position as THREE.BufferAttribute).array);
      nor.push(...(p.attributes.normal as THREE.BufferAttribute).array);
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    merged.scale(1.45, 1.45, 1.45);
    const goldMesh = new THREE.Mesh(merged, gold);
    goldMesh.castShadow = true;
    g.add(goldMesh);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.2, 9).translate(0, 0.1, 0).scale(1.45, 1.45, 1.45), wood);
    plinth.castShadow = true;
    g.add(plinth);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 24).rotateX(Math.PI / 2).translate(0, 0.17, 0).scale(1.45, 1.45, 1.45), rope);
    g.add(coil);
    return g;
  }

  update(dt: number, time: number, s: FinishState): void {
    this.banner.update(time);
    this.water.uniforms['uTime']!.value = time;
    this.flame.uniforms['uTime']!.value = time;
    const fl = 0.8 + 0.2 * Math.sin(time * 11.3) * Math.sin(time * 7.1 + 1);
    this.fireLight.intensity = 12 * fl;
    this.flameMesh.scale.set(1, 0.9 + fl * 0.15, 1);
    // the lighthouse lamp pulses (a slow rotating beam seen side-on)
    const beam = Math.pow(0.5 + 0.5 * Math.sin(time * 1.3), 4);
    this.beaconLight.intensity = 10 + 40 * beam;
    this.beacon.scale.setScalar(0.8 + 0.5 * beam);
    for (const bt of this.boatsBob) {
      bt.o.position.y = bt.y + 0.18 * Math.sin(time * 0.8 + bt.ph);
      bt.o.rotation.z = 0.035 * Math.sin(time * 0.65 + bt.ph * 1.3);
      bt.o.rotation.x = 0.02 * Math.sin(time * 0.5 + bt.ph);
    }
    for (const p of this.particles) p.update(dt, time);
    this.glows.update(time);
    const cheer = Math.min(1, Math.max(0, s.cheer));
    const welcome = Math.min(1, Math.max(0, s.welcome));
    for (const g of this.guests) if (g !== this.plunger || this.plunge <= 0) g.update(dt, time, cheer, s.lookAt, welcome);
    // the cold plunge (round 3, C3): a real run-up across the deck (a stride cycle, leaning in),
    // a spring off the edge, a tucked cannonball that hangs at the apex, the crown splash
    if (this.plunge > 0) {
      const T = PLUNGE_TIMES;
      const tt = Math.min(1, this.plunge) * T.total;
      const g = this.plunger.group;
      const home = this.plungerHome;
      const edge = this.plungeEdge;
      const yaw = Math.atan2(edge.x - home.x, edge.z - home.z);
      if (tt < T.run) {
        const u = tt / T.run;
        // accelerate from a standing start
        this.plunger.run = time * 14;
        this.plunger.tuck = 0;
        this.plunger.update(dt, time, 0, null, 0);
        g.position.lerpVectors(home, edge, u * u * (3 - 2 * u) * 0.35 + u * u * 0.65);
        g.position.y = home.y;
        g.rotation.set(0.12 + 0.12 * u, yaw, 0);
        g.scale.setScalar(this.plungerScale);
      } else {
        const u = Math.min(1, (tt - T.run) / T.air);
        this.plunger.run = null;
        // tuck: knees up within the first fifth of the flight, held to the water
        this.plunger.tuck = Math.min(1, u / 0.2);
        this.plunger.update(dt, time, 0, null, 0);
        // a hang at the apex: time runs slower over the top of the arc
        const w = u + 0.12 * Math.sin(u * Math.PI * 2) * (1 - u);
        const p = edge.clone().lerp(this.plungeTo, w);
        const apex = 1.05;
        const y0 = edge.y;
        const y1 = this.sea - 0.4;
        p.y = y0 + (y1 - y0) * w * w + 4 * apex * w * (1 - w);
        g.position.copy(p);
        g.scale.setScalar(this.plungerScale);
        // a slow forward roll, the body balled up
        g.rotation.set(0.25 + w * 1.6, yaw, 0);
      }
      if (tt >= T.run + T.air && !this.splashed) {
        this.splashed = true;
        this.splashNow = true;
        this.splash.points.visible = true;
        this.plunger.group.visible = false;
        this.splashT = 0;
      }
    }
    if (this.splashT >= 0) {
      this.splashT += dt;
      const t = this.splashT;
      // crown: thrown up and out fast, hangs, then collapses back into the water
      const up = t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.35) / 1.1);
      this.crown.visible = t < 1.5;
      this.crown.scale.set(0.8 + 1.1 * Math.sqrt(Math.min(1, t / 0.6)), 0.15 + 2.2 * up, 0.8 + 1.1 * Math.sqrt(Math.min(1, t / 0.6)));
      (this.crown.material as THREE.MeshBasicMaterial).opacity = 0.95 * Math.min(1, t / 0.08) * (t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) / 0.6));
      // foam: spreads and thins out over a few seconds
      const u = Math.min(1, t / 3.2);
      this.ring.visible = u < 1;
      this.ring.scale.setScalar(1.0 + 3.2 * Math.sqrt(u));
      this.ring.rotation.y = t * 0.1;
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u * u);
    }
  }

  getStopPoint(t: THREE.Vector3) {
    return t.copy(this.stop);
  }
  getYetiStopPoint(t: THREE.Vector3) {
    return t.copy(this.yetiPt);
  }
  getPodiumTop(t: THREE.Vector3) {
    return t.copy(this.podiumTop);
  }
  /** the bathing tub on the pier: the heart of the celebration */
  getCelebrationFocus(t: THREE.Vector3) {
    return t.copy(this.stamp);
  }
  colliders(): CircleCollider[] {
    return this.cols;
  }

  /** reset per-run animation state (World returns the trophy separately) */
  resetCelebration() {
    this.plunge = 0;
    this.splashed = false;
    this.splash.points.visible = false;
    this.plunger.group.visible = true;
    this.plunger.group.rotation.x = 0;
    this.plunger.group.scale.setScalar(this.plungerScale);
    this.plunger.group.position.copy(this.plungerHome);
    this.plunger.tuck = 0;
    this.plunger.run = null;
    this.splashT = -1;
    this.splashNow = false;
    this.ring.visible = false;
    this.crown.visible = false;
    this.presenter.hold = 0;
    this.presenter.holdLift = 0;
    this.presenter.holdSide = 0;
    this.presenter.place(this.presentAt.x, this.presentAt.z, Math.atan2(this.stop.x - this.presentAt.x, this.stop.z - this.presentAt.z), null);
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose();
    });
    for (const g of this.guests) g.dispose();
    this.banner.dispose();
    for (const p of this.particles) p.dispose();
    this.glows.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.group.removeFromParent();
  }
}
