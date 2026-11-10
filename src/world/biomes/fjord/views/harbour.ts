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
import { PAINT, fishingBoat, house, jetty, kitMaterials } from './buildings';

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
export class Harbour implements FinishEnvironment {
  readonly group = new THREE.Group();
  readonly trophy: THREE.Object3D;
  readonly finishZ: number;
  /** sea level of the harbour */
  readonly sea: number;
  /** the pier end the plunger jumps from, and the splash point */
  readonly plungeFrom = new THREE.Vector3();
  readonly plungeTo = new THREE.Vector3();
  /** a camera position out on the water (harbour mouth) used by the victory reveal */
  readonly seaward = new THREE.Vector3();
  /** quay front z */
  readonly quayZ: number;
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
  private splashed = false;
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private boats: THREE.Group;
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
    const quayW = 150;
    // granite quay wall along the shore
    for (let x = -quayW; x < quayW; x += 4) {
      const px = F.x + x + 2;
      const t = 0.33 + 0.05 * Math.sin(x * 1.7);
      b.add('stone', new THREE.BoxGeometry(4.05, 6, 2.4), mat(px, deckY - 3.15, zq + 1.2), new THREE.Color(t, t * 1.01, t * 1.05));
    }
    // timber boardwalk on piles over the water along the quay
    const bwz0 = zq + 2.2;
    const bwz1 = zq + 10;
    b.add('planks', new THREE.BoxGeometry(quayW * 2, 0.28, bwz1 - bwz0), mat(F.x, deckY - 0.1, (bwz0 + bwz1) / 2), (p) => new THREE.Color(0x6b4e36).multiplyScalar(0.85 + 0.15 * Math.sin(p.x * 3.3)));
    nb.add('snow', new THREE.BoxGeometry(quayW * 2 - 2, 0.05, (bwz1 - bwz0) * 0.6), mat(F.x, deckY + 0.07, bwz0 + 2.5), 0xffffff);
    for (let x = -quayW + 2; x < quayW; x += 4)
      for (const pz of [bwz0 + 0.4, bwz1 - 0.4]) b.add('planks', new THREE.CylinderGeometry(0.18, 0.2, 7, 6), mat(F.x + x, deckY - 3.6, pz), 0x2e231a);
    // railing posts with rope along the outer edge
    for (let x = -quayW + 1; x < quayW; x += 3) b.add('planks', new THREE.CylinderGeometry(0.06, 0.07, 1.0, 5), mat(F.x + x, deckY + 0.5, bwz1 - 0.2), 0x3b2c22);
    b.add('metal', new THREE.BoxGeometry(quayW * 2, 0.05, 0.05), mat(F.x, deckY + 0.95, bwz1 - 0.2), 0xd8c8a0);
    // finger piers
    const piers = [-58, 22, 92];
    for (const px of piers) jetty(b, new THREE.Vector3(F.x + px, deckY - 0.05, bwz1), new THREE.Vector3(F.x + px + 4, deckY - 0.05, bwz1 + 62), 3.2, 9);
    // the bathing pier platform (stamp + bonfire)
    const sp = new THREE.Vector3(F.x + 22 + 2, deckY, bwz1 + 40);
    b.add('planks', new THREE.BoxGeometry(12, 0.28, 12), mat(sp.x + 6.5, deckY - 0.1, sp.z), 0x6b4e36);
    for (const dx of [1, 6.5, 12]) for (const dz of [-5.6, 0, 5.6]) b.add('planks', new THREE.CylinderGeometry(0.18, 0.2, 9, 6), mat(sp.x + dx, deckY - 4.6, sp.z + dz), 0x2e231a);

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
      for (let i = 0; i < 3; i++) {
        const g = new THREE.PlaneGeometry(1.0, 1.6).translate(0, 0.8, 0).rotateY((i * Math.PI) / 3).toNonIndexed();
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
    // a ladder down into the sea at the pier end (the plunge)
    this.plungeFrom.set(sp.x + 12.2, deckY + 0.05, sp.z + 4.2);
    this.plungeTo.set(sp.x + 17.5, sea, sp.z + 6.5);

    // ---------------- sea houses along the quay ----------------
    const fronts: Array<[number, number]> = [];
    for (let x = -142; x <= -34; x += 0) {
      const w = rnd.range(9, 13);
      fronts.push([x + w / 2, w]);
      x += w + rnd.range(0.6, 3);
    }
    for (let x = 34; x <= 146; x += 0) {
      const w = rnd.range(9, 13);
      fronts.push([x + w / 2, w]);
      x += w + rnd.range(0.6, 3);
    }
    fronts.forEach(([dx, w], i) => {
      const d = rnd.range(12, 16);
      const hz = zq - 2 - d / 2;
      const x = F.x + dx;
      let gy = Infinity;
      for (const ex of [-w / 2, w / 2]) for (const ez of [-d / 2, d / 2]) gy = Math.min(gy, H(x + ex, hz + ez));
      gy = Math.max(gy, deckY);
      const col = PAINT[(i * 3 + rnd.int(0, 1)) % PAINT.length]!;
      house(b, x, gy, hz, Math.PI / 2, { w: d, d: w, h: rnd.range(6.5, 9.5), roofH: w * 0.55, color: col, door: 'side', chimney: rnd.next() < 0.3 }, rnd);
      // warehouse loading door + hoist beam on the gable facing the water
      b.add('paint', new THREE.BoxGeometry(w * 0.32, 2.4, 0.12), mat(x, gy + 5.2, hz + d / 2 + 0.05), 0xf2efe7);
      b.add('planks', new THREE.BoxGeometry(0.25, 0.25, 1.4), mat(x, gy + 7.4, hz + d / 2 + 0.6), 0x3a2a1e);
      for (let cx = -w / 2 + 1.6; cx < w / 2; cx += 3.2) this.cols.push({ x: x + cx, z: hz - d / 2 + 1.6, r: 2.0 }, { x: x + cx, z: hz, r: 2.2 }, { x: x + cx, z: hz + d / 2 - 1.6, r: 2.0 });
    });
    // a second row of homes up the slope behind, on both sides of the run-out
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const dx = side * rnd.range(48, 120);
      const dz = rnd.range(-40, 60);
      const p = W(dx, dz);
      house(b, p.x, p.y, p.z, rnd.range(0, 1) < 0.5 ? 0 : Math.PI / 2, { w: rnd.range(8, 11), d: rnd.range(6, 7.5), h: rnd.range(5, 6.4), color: PAINT[rnd.int(0, PAINT.length - 1)]!, door: 'side', chimney: true }, rnd);
      this.cols.push({ x: p.x, z: p.z, r: 5.5 });
    }

    // ---------------- plaza: podium of fish crates, lamp posts, string lights, benches ----------------
    const pod = W(-12, 70);
    {
      const crate = (x: number, y: number, z: number, c: number, ry: number) => {
        b.add('planks', new THREE.BoxGeometry(1.2, 0.55, 0.8), mat(x, y + 0.275, z, 0, ry, 0), new THREE.Color(c));
        for (const sx of [-0.62, 0.62]) b.add('planks', new THREE.BoxGeometry(0.04, 0.5, 0.82), mat(x + sx * Math.cos(ry), y + 0.28, z - sx * Math.sin(ry), 0, ry, 0), 0x3a2a1e);
      };
      const stack: Array<[number, number, number]> = [
        // dx, levels, colour
        [0, 3, 0x2d4c78],
        [1.3, 2, 0xc8281e],
        [-1.3, 1, 0xd59f3a],
      ];
      for (const [dx, levels, c] of stack)
        for (let l = 0; l < levels; l++) {
          crate(pod.x + dx, pod.y + l * 0.55, pod.z, c, 0);
          crate(pod.x + dx, pod.y + l * 0.55, pod.z + 0.82, c, 0);
        }
      this.podiumTop.set(pod.x, pod.y + 3 * 0.55, pod.z + 0.4);
      this.cols.push({ x: pod.x, z: pod.z + 0.4, r: 1.0 }, { x: pod.x + 1.3, z: pod.z + 0.4, r: 1.0 }, { x: pod.x - 1.3, z: pod.z + 0.4, r: 1.0 });
      // a coil of rope and a buoy beside it
      b.add('metal', new THREE.TorusGeometry(0.45, 0.09, 6, 16).rotateX(Math.PI / 2), mat(pod.x + 2.6, pod.y + 0.1, pod.z + 0.2), 0xc9b48a);
      b.add('paint', new THREE.SphereGeometry(0.35, 10, 8), mat(pod.x - 2.6, pod.y + 0.35, pod.z + 0.6), 0xe86a1e);
    }
    const bulbs: Array<{ p: THREE.Vector3; c: number }> = [];
    const poles = [W(-22, 52), W(20, 50), W(24, 100), W(-26, 104), W(0, 128)];
    const tops = poles.map((p) => {
      const t = lampPost(b, p.x, p.y, p.z);
      bulbs.push({ p: t, c: 0xffc070 });
      this.cols.push({ x: p.x, z: p.z, r: 0.3 });
      return t;
    });
    for (let i = 0; i < tops.length; i++) stringLights(b, tops[i]!, tops[(i + 1) % tops.length]!, 0.7, hi ? 0.6 : 0.9, bulbs, rnd);
    for (const [dx, dz, ry] of [
      [-8, 112, 0],
      [10, 116, 0.2],
      [-30, 80, 1.4],
    ] as const) {
      const p = W(dx, dz);
      bench(b, p.x, p.y, p.z, ry);
      this.cols.push({ x: p.x, z: p.z, r: 0.9 });
    }
    // drying racks for stockfish ("hjell"): a timber frame hung with fish
    for (const [dx, dz] of [
      [-70, 30],
      [62, 20],
    ] as const) {
      const p = W(dx, dz);
      for (const s of [-1, 1]) b.add('planks', new THREE.CylinderGeometry(0.1, 0.12, 3.4, 5), mat(p.x + s * 4, p.y + 1.7, p.z), 0x5a4030);
      b.add('planks', new THREE.BoxGeometry(8.4, 0.16, 0.16), mat(p.x, p.y + 3.2, p.z), 0x5a4030);
      for (let k = -3.7; k < 3.8; k += 0.45) b.add('paint', new THREE.ConeGeometry(0.12, 1.0, 4), mat(p.x + k, p.y + 2.55, p.z, Math.PI, 0, 0), new THREE.Color(0xb59a6a).multiplyScalar(0.8 + 0.2 * Math.sin(k * 7)));
      this.cols.push({ x: p.x - 4, z: p.z, r: 0.4 }, { x: p.x + 4, z: p.z, r: 0.4 });
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

    // ---------------- moored boats (bob gently) ----------------
    this.boats = new THREE.Group();
    const boatB = new Batch();
    const moor: Array<[number, number, number, number]> = [
      [-52, 20, 0.1, 0],
      [-66, 44, -0.08, 1],
      [28, 26, 0.05, 2],
      [100, 30, -0.1, 3],
      [84, 56, 0.12, 4],
      [-20, 46, 0.3, 5],
    ];
    const hulls = [0x2d4c78, 0xc8281e, 0xf2efe7, 0x1d4a3a, 0xd59f3a, 0x15171b];
    const boatMeshes: THREE.Group[] = [];
    for (const [dx, dz, yaw, k] of moor) {
      const one = new Batch();
      fishingBoat(one, 0, 0, 0, 0, { len: k === 3 ? 16 : rnd.range(9, 13), hull: hulls[k]!, stripe: k === 2 ? 0x2d4c78 : 0xf2efe7, cabin: k === 2 ? 0x2d4c78 : 0xf2efe7 });
      const g = new THREE.Group();
      for (const me of one.build(M, { cast: hi, receive: true })) g.add(me);
      g.position.set(F.x + dx, sea, bwz1 + dz);
      g.rotation.y = yaw;
      this.boats.add(g);
      boatMeshes.push(g);
      this.boatsBob.push({ o: g, y: sea, ph: rnd.range(0, 6) });
    }
    void boatB;
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
    this.splash = new Particles({ count: 60, origin: this.plungeTo.clone(), radius: 0.6, life: [0.6, 1.4], rise: [3.5, 6], drift: new THREE.Vector3(0, 0, 0), size: [0.25, 0.6], alpha: 0.85, color: 0xffffff, swirl: 0.1 }, soft);
    this.splash.points.visible = false;
    this.particles.push(this.splash);
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
    this.yetiPt.copy(W(-62, -16));
    const ground = (x: number, z: number) => Math.max(H(x, z), x > F.x - quayW && x < F.x + quayW && z > zq ? deckY + 0.1 : -Infinity);
    const seat = () => this.stamp.y - 0.25;
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
        const a = (i === 5 ? -0.7 : 0.9) + Math.PI;
        g.place(tub.x + Math.sin(a) * (tubR - 0.1), tub.z + Math.cos(a) * (tubR - 0.1), a + Math.PI, null);
      } else {
        g.place(this.plungeFrom.x, this.plungeFrom.z, Math.atan2(this.plungeTo.x - this.plungeFrom.x, this.plungeTo.z - this.plungeFrom.z), null);
      }
      this.guests.push(g);
      this.group.add(g.group);
    });
    this.plunger = this.guests[this.guests.length - 1]!;
    this.plungerHome.copy(this.plunger.group.position);
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
    // the cold plunge: a run off the pier end, an arc, a splash
    if (this.plunge > 0) {
      const k = Math.min(1, this.plunge);
      const p = this.plungerHome.clone().lerp(this.plungeTo, k);
      p.y = this.plungerHome.y + (this.plungeTo.y - 1.4 - this.plungerHome.y) * k * k + Math.sin(k * Math.PI) * 2.2;
      this.plunger.group.position.copy(p);
      this.plunger.group.rotation.x = k * 2.6;
      this.plunger.update(dt, time, 1, null, 0);
      if (k >= 1 && !this.splashed) {
        this.splashed = true;
        this.splash.points.visible = true;
        this.plunger.group.visible = false;
      }
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
    this.plunger.group.position.copy(this.plungerHome);
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
