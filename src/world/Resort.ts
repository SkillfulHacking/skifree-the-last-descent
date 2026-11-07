/**
 * The resort finish area at the bottom of the mountain: finish arch & chute, podium with trophy,
 * "The Last Lodge" with deck, hot tub, fire pit, string lights, props and animated après-ski guests.
 *
 * Coordinate convention: +Y up, course runs downhill toward +Z, finish line spans X at finishCenter.z.
 * All static geometry is merged per material (one draw call each); guests are single SkinnedMeshes.
 */
import * as THREE from 'three';
import type { QualityPreset } from '../core/types';
import { Batch, Rand, mat } from './resort/util';
import {
  bannerTexture,
  brandAtlas,
  envCube,
  fenceTexture,
  lodgeSignTexture,
  logEndTexture,
  logTexture,
  plankTexture,
  snowTexture,
  softParticle,
  stoneTexture,
  windowTexture,
} from './resort/textures';
import { LODGE, buildLodge } from './resort/lodge';
import { aBoard, adirondack, bench, firePit, hotTub, lampPost, lightPole, lounger, paddedPost, pine, podium, shrub, signpost, skiRack, snowFence, snowman, stringLights, truss } from './resort/props';
import { Banner, Glows, Particles, flameMaterial, waterMaterial } from './resort/fx';
import { Guest, type GuestBehaviour, type GuestLook } from './resort/Guest';

export interface ResortOptions {
  quality: QualityPreset;
  /** terrain height sampler (world coords) — place everything on the snow with it */
  heightAt: (x: number, z: number) => number;
  /** world position of the centre of the finish line (on the snow) */
  finishCenter: THREE.Vector3;
}
export interface CircleCollider {
  x: number;
  z: number;
  r: number;
}

interface GuestSpec {
  look: GuestLook;
  beh: GuestBehaviour;
}

export class Resort {
  readonly group = new THREE.Group();
  readonly trophy: THREE.Object3D;
  readonly finishZ: number;

  private F: THREE.Vector3;
  private h: (x: number, z: number) => number;
  private hi: boolean;
  private cols: CircleCollider[] = [];
  private podiumTop = new THREE.Vector3();
  private tubCenter = new THREE.Vector3();
  private stopPoint = new THREE.Vector3();
  private yetiPoint = new THREE.Vector3();
  private banner: Banner;
  private water: THREE.ShaderMaterial;
  private flame: THREE.ShaderMaterial;
  private flameMesh: THREE.Mesh;
  private particles: Particles[] = [];
  private glows: Glows;
  private guests: Guest[] = [];
  private fireLight: THREE.PointLight;
  private tubLight: THREE.PointLight;
  private textures: THREE.Texture[] = [];
  private materials: THREE.Material[] = [];

  constructor(opts: ResortOptions) {
    const q = opts.quality;
    this.hi = q === 'high' || q === 'ultra';
    const hi = this.hi;
    this.h = opts.heightAt;
    this.F = opts.finishCenter.clone();
    this.finishZ = this.F.z;
    this.group.name = 'Resort';
    const F = this.F;
    const H = this.h;
    const rnd = new Rand(1234);
    const W = (dx: number, dz: number): THREE.Vector3 => new THREE.Vector3(F.x + dx, H(F.x + dx, F.z + dz), F.z + dz);

    // ---------------- textures & materials ----------------
    const texSize = hi ? 512 : 256;
    const log = logTexture(texSize);
    const stone = stoneTexture(texSize);
    const planks = plankTexture(texSize);
    const snow = snowTexture();
    const logEnd = logEndTexture();
    const win = windowTexture();
    const atlasT = brandAtlas();
    const bannerT = bannerTexture();
    const signT = lodgeSignTexture();
    const fenceT = fenceTexture();
    const soft = softParticle();
    const env = envCube();
    this.textures.push(log.map, log.normal, stone.map, stone.normal, planks.map, planks.normal, snow.map, snow.normal, logEnd, win, atlasT, bannerT, signT, fenceT, soft, env);

    const M: Record<string, THREE.Material> = {
      logs: new THREE.MeshStandardMaterial({ map: log.map, normalMap: log.normal, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: 0.82 }),
      logEnd: new THREE.MeshStandardMaterial({ map: logEnd, vertexColors: true, roughness: 0.9 }),
      stone: new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normal, normalScale: new THREE.Vector2(1.2, 1.2), vertexColors: true, roughness: 0.95 }),
      planks: new THREE.MeshStandardMaterial({ map: planks.map, normalMap: planks.normal, vertexColors: true, roughness: 0.88 }),
      snow: new THREE.MeshStandardMaterial({ map: snow.map, normalMap: snow.normal, normalScale: new THREE.Vector2(0.6, 0.6), vertexColors: true, roughness: 0.9, color: 0xf6f9ff }),
      vcol: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
      metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.75, envMap: env }),
      glass: new THREE.MeshStandardMaterial({
        color: 0x2a2018,
        roughness: 0.12,
        metalness: 0.4,
        envMap: env,
        envMapIntensity: 0.6,
        emissive: new THREE.Color(0xff9a50),
        emissiveMap: win,
        emissiveIntensity: 0.9,
      }),
      bulb: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      ice: new THREE.MeshStandardMaterial({ color: 0xe4f4ff, roughness: 0.08, metalness: 0.1, envMap: env, transparent: true, opacity: 0.82 }),
      atlas: new THREE.MeshStandardMaterial({ map: atlasT, roughness: 0.55 }),
      sign: new THREE.MeshStandardMaterial({ map: signT, roughness: 0.75 }),
      fence: new THREE.MeshStandardMaterial({ map: fenceT, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7 }),
    };
    (M.bulb as THREE.MeshBasicMaterial).color.setScalar(1.6);
    for (const m of Object.values(M)) this.materials.push(m);

    const batch = new Batch();
    const noShadow = new Batch();

    // ---------------- finish arch ----------------
    const postX = 14.5;
    const yA = (H(F.x - postX, F.z) + H(F.x + postX, F.z)) / 2;
    const trussY = yA + 7.9;
    for (const s of [-1, 1]) {
      const g = W(s * postX, 0);
      truss(batch, new THREE.Vector3(g.x, g.y - 0.3, g.z), new THREE.Vector3(g.x, trussY + 0.25, g.z), 0.45, hi);
      paddedPost(batch, g.x, g.y, g.z);
      batch.add('metal', new THREE.BoxGeometry(0.9, 0.06, 0.9), mat(g.x, g.y + 0.02, g.z), 0x555b63);
      this.cols.push({ x: g.x, z: g.z, r: 0.65 });
    }
    truss(batch, new THREE.Vector3(F.x - postX - 0.25, trussY, F.z), new THREE.Vector3(F.x + postX + 0.25, trussY, F.z), 0.45, hi);
    batch.add('snow', new THREE.BoxGeometry(postX * 2 + 0.4, 0.06, 0.4), mat(F.x, trussY + 0.26, F.z), 0xffffff);
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerT, roughness: 0.65, side: THREE.FrontSide });
    this.materials.push(bannerMat);
    this.banner = new Banner(26.5, 1.75, bannerMat);
    this.banner.group.position.set(F.x, trussY - 0.4 - 1.75 / 2, F.z);
    this.group.add(this.banner.group);
    // banner ties
    for (let i = 0; i <= 8; i++) {
      const x = F.x - 13.2 + (i * 26.4) / 8;
      batch.add('metal', new THREE.CylinderGeometry(0.01, 0.01, 0.42, 3), mat(x, trussY - 0.2, F.z), 0x222222);
    }
    // finish line painted on the snow
    noShadow.add('vcol', new THREE.PlaneGeometry(postX * 2 - 1, 0.5, 24, 1).rotateX(-Math.PI / 2), undefined, 0xd92d20, (g) => {
      const P = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i) + F.x;
        const z = P.getZ(i) + F.z;
        P.setXYZ(i, x, H(x, z) + 0.03, z);
      }
    });

    // ---------------- chute fences & A-boards ----------------
    for (const s of [-1, 1]) {
      const pts = [W(s * 15, -70), W(s * 15, 16), W(s * 23, 29)];
      snowFence(batch, noShadow, pts, H, this.cols);
      let k = 0;
      for (let z = -27; z <= 12; z += 3.0, k++) {
        const p = W(s * 14.1, z);
        const strip = k % 2 === 0 ? [0.375, 0.5] : [0.25, 0.375];
        aBoard(batch, p.x, p.y, p.z, s < 0 ? Math.PI / 2 : -Math.PI / 2, strip[0]!, strip[1]!);
        this.cols.push({ x: p.x, z: p.z - 0.8, r: 0.6 }, { x: p.x, z: p.z + 0.8, r: 0.6 });
      }
    }

    // ---------------- podium & trophy ----------------
    const pod = W(-11, 46);
    const podInfo = podium(batch, pod.x, pod.y, pod.z);
    this.podiumTop.copy(podInfo.top);
    this.cols.push({ x: pod.x, z: pod.z, r: 1.2 }, { x: pod.x + 2.1, z: pod.z, r: 1.15 }, { x: pod.x - 2.1, z: pod.z, r: 1.15 }, { x: pod.x, z: pod.z + 1.4, r: 0.8 }, { x: pod.x + 3, z: pod.z + 1.4, r: 0.8 }, { x: pod.x - 3, z: pod.z + 1.4, r: 0.8 });
    this.trophy = this.buildTrophy(env);
    this.trophy.position.copy(this.podiumTop);
    this.trophy.rotation.y = Math.PI;
    this.group.add(this.trophy);

    // ---------------- lodge ----------------
    const lodgeC = new THREE.Vector2(F.x + 28, F.z + 80);
    const face = new THREE.Vector2(F.x + 2, F.z + 38).sub(lodgeC);
    const yaw = Math.atan2(face.x, face.y);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const L2W = (lx: number, lz: number): THREE.Vector2 => new THREE.Vector2(lodgeC.x + lx * cy + lz * sy, lodgeC.y - lx * sy + lz * cy);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const p = L2W(-LODGE.W / 2 - 1.3 + (i / 4) * (LODGE.W + 2.6), -LODGE.D / 2 - 0.5 + (j / 4) * (LODGE.D + LODGE.deckDepth + 2));
        const y = H(p.x, p.y);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    const baseY = minY + (maxY - minY) * 0.3;
    const sink = baseY - minY + 1.2;
    const LM = mat(lodgeC.x, baseY, lodgeC.y, 0, yaw, 0);
    const lodge = buildLodge(batch, LM, rnd, sink, hi);
    const toW = (v: THREE.Vector3): THREE.Vector3 => v.clone().applyMatrix4(LM);
    // signs: entrance arch + façade
    {
      const sp = lodge.signCenter;
      const g1 = new THREE.PlaneGeometry(2.9, 0.725);
      batch.add('sign', g1, mat(0, 0, 0).premultiply(new THREE.Matrix4().makeTranslation(sp.x, sp.y, sp.z + 0.05)).premultiply(LM), 0xffffff);
      batch.add('vcol', new THREE.BoxGeometry(3.05, 0.85, 0.08), mat(0, 0, 0).premultiply(new THREE.Matrix4().makeTranslation(sp.x, sp.y, sp.z)).premultiply(LM), 0x3a2416);
      const g2 = new THREE.PlaneGeometry(5.2, 1.3);
      const fz = LODGE.D / 2 + 0.36;
      const fy = LODGE.base + 4.42;
      batch.add('sign', g2, new THREE.Matrix4().makeTranslation(0, fy, fz + 0.06).premultiply(LM), 0xffffff);
      batch.add('vcol', new THREE.BoxGeometry(5.4, 1.45, 0.1), new THREE.Matrix4().makeTranslation(0, fy, fz).premultiply(LM), 0x3a2416);
      batch.add('snow', new THREE.BoxGeometry(5.4, 0.08, 0.14), new THREE.Matrix4().makeTranslation(0, fy + 0.76, fz).premultiply(LM), 0xffffff);
    }
    // lodge colliders: grid over footprint + deck
    for (let lx = -LODGE.W / 2 - 0.6; lx <= LODGE.W / 2 + 1.6; lx += 2.2) {
      for (let lz = -LODGE.D / 2; lz <= LODGE.D / 2 + LODGE.deckDepth; lz += 2.2) {
        const p = L2W(lx, lz);
        this.cols.push({ x: p.x, z: p.y, r: 1.6 });
      }
    }
    const deckWorldY = baseY + LODGE.deckY;

    // ---------------- hot tub ----------------
    const tubL = L2W(LODGE.W / 2 + 4.4, LODGE.D / 2 + 3.4);
    const tubR = 1.3;
    const tubY = H(tubL.x, tubL.y);
    this.tubCenter.copy(hotTub(batch, tubL.x, tubY, tubL.y, tubR, hi));
    this.cols.push({ x: tubL.x, z: tubL.y, r: tubR + 0.75 });
    this.water = waterMaterial();
    this.materials.push(this.water);
    const waterMesh = new THREE.Mesh(new THREE.CircleGeometry(tubR - 0.04, 40).rotateX(-Math.PI / 2), this.water);
    waterMesh.position.copy(this.tubCenter);
    waterMesh.receiveShadow = false;
    this.group.add(waterMesh);
    this.tubLight = new THREE.PointLight(0x4fe3dc, 6, 7, 2);
    this.tubLight.position.copy(this.tubCenter).add(new THREE.Vector3(0, 0.5, 0));
    this.group.add(this.tubLight);

    // loungers beside the tub
    for (let i = 0; i < 3; i++) {
      const p = L2W(LODGE.W / 2 + 7.6, LODGE.D / 2 - 1.0 + i * 1.25);
      lounger(batch, p.x, H(p.x, p.y), p.y, yaw + Math.PI / 2 + 0.25);
      this.cols.push({ x: p.x, z: p.y, r: 0.9 });
    }

    // ---------------- fire pit, chairs, string lights ----------------
    const fp = W(3, 61);
    const flameBase = firePit(batch, fp.x, fp.y, fp.z, rnd);
    this.cols.push({ x: fp.x, z: fp.z, r: 1.3 });
    const chairCols = [0xb91c1c, 0x1e3a8a, 0x166534, 0xca8a04, 0xf5f5f4];
    const chairN = 5;
    for (let i = 0; i < chairN; i++) {
      const a = (i / chairN) * Math.PI * 2 + 0.5;
      const cx = fp.x + Math.sin(a) * 2.7;
      const cz = fp.z + Math.cos(a) * 2.7;
      adirondack(batch, cx, H(cx, cz), cz, a + Math.PI, chairCols[i % chairCols.length]!);
      this.cols.push({ x: cx, z: cz, r: 0.55 });
    }
    this.flame = flameMaterial();
    this.materials.push(this.flame);
    {
      const geos: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const g = new THREE.PlaneGeometry(1.25, 2.0);
        g.translate(0, 1.0, 0);
        g.rotateY((i * Math.PI) / 3);
        geos.push(g);
      }
      const merged = new THREE.BufferGeometry();
      const pos: number[] = [];
      const uv: number[] = [];
      for (const g of geos) {
        const ng = g.toNonIndexed();
        pos.push(...(ng.attributes.position as THREE.BufferAttribute).array);
        uv.push(...(ng.attributes.uv as THREE.BufferAttribute).array);
        g.dispose();
        ng.dispose();
      }
      merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      this.flameMesh = new THREE.Mesh(merged, this.flame);
      this.flameMesh.position.copy(flameBase);
      this.flameMesh.renderOrder = 4;
      this.group.add(this.flameMesh);
    }
    this.fireLight = new THREE.PointLight(0xff8a3a, 14, 14, 2);
    this.fireLight.position.copy(flameBase).add(new THREE.Vector3(0, 1.0, 0));
    this.group.add(this.fireLight);

    // poles around the fire pit, wires to each other and to the lodge deck
    const bulbs: Array<{ p: THREE.Vector3; c: number }> = [];
    const poleSpots = [W(-4.5, 56), W(10.5, 55), W(11, 67.5), W(-4, 68)];
    const poleTops = poleSpots.map((p) => lightPole(batch, p.x, p.y, p.z, 4.4));
    for (const p of poleSpots) this.cols.push({ x: p.x, z: p.z, r: 0.25 });
    const spacing = hi ? 0.55 : 0.8;
    for (let i = 0; i < poleTops.length; i++) stringLights(batch, poleTops[i]!, poleTops[(i + 1) % poleTops.length]!, 0.55, spacing, bulbs, rnd);
    stringLights(batch, poleTops[0]!, poleTops[2]!, 0.9, spacing, bulbs, rnd);
    // to the lodge deck corners (top of the arch & deck posts)
    const deckA = toW(new THREE.Vector3(-LODGE.W / 2 - 1.2, LODGE.deckY + 2.6, LODGE.D / 2 + LODGE.deckDepth));
    const deckB = toW(new THREE.Vector3(LODGE.W / 2 + 1.2, LODGE.deckY + 2.6, LODGE.D / 2 + LODGE.deckDepth));
    for (const d of [deckA, deckB]) batch.add('vcol', new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), mat(d.x, d.y - 1.3, d.z), 0x5a3a24);
    stringLights(batch, poleTops[2]!, deckB, 0.8, spacing, bulbs, rnd);
    stringLights(batch, poleTops[1]!, deckA, 1.0, spacing, bulbs, rnd);
    stringLights(batch, deckA, deckB, 0.7, spacing, bulbs, rnd);
    // eave bulbs (lodge)
    for (const b of lodge.bulbs) bulbs.push({ p: toW(b), c: 0xffc070 });
    for (const b of lodge.bulbs.slice(0, 54)) {
      const w = toW(b);
      batch.add('bulb', new THREE.SphereGeometry(0.05, 5, 4), mat(w.x, w.y, w.z), 0xffd28a);
    }

    // ---------------- ski racks ----------------
    const racks: Array<[THREE.Vector2, number]> = [
      [L2W(-4.8, LODGE.D / 2 + LODGE.deckDepth + 2.6), yaw],
      [L2W(4.9, LODGE.D / 2 + LODGE.deckDepth + 2.8), yaw],
      [new THREE.Vector2(F.x + 21, F.z + 38), -0.5],
    ];
    for (const [p, ry] of racks) {
      skiRack(batch, p.x, H(p.x, p.y), p.y, ry, rnd);
      const dx = Math.cos(ry) * 1.2;
      const dz = -Math.sin(ry) * 1.2;
      this.cols.push({ x: p.x - dx, z: p.y - dz, r: 0.6 }, { x: p.x, z: p.y, r: 0.6 }, { x: p.x + dx, z: p.y + dz, r: 0.6 });
    }

    // ---------------- pines & shrubs ----------------
    const pines: Array<[number, number, number]> = [
      [-26, 34, 7],
      [-31, 52, 9],
      [-24, 63, 6],
      [-36, 70, 10],
      [-20, 82, 7.5],
      [-30, 95, 9],
      [-12, 104, 8],
      [2, 112, 9.5],
      [18, 108, 7],
      [45, 100, 10],
      [52, 78, 8.5],
      [49, 60, 7],
      [38, 50, 5.5],
      [28, 42, 4.5],
      [-18, 30, 4.5],
      [-33, 22, 6],
      [33, 24, 6.5],
      [40, 34, 8],
      [58, 92, 9],
      [10, 96, 5],
      [-40, 44, 8],
      [-44, 84, 11],
      [-22, 112, 8.5],
      [30, 112, 9],
      [62, 70, 10],
      [56, 44, 7.5],
      [-27, 28, 5],
      [-38, 60, 7],
    ];
    const pineCount = hi ? pines.length : 12;
    for (let i = 0; i < pineCount; i++) {
      const [dx, dz, ht] = pines[i]!;
      const p = W(dx, dz);
      pine(batch, p.x, p.y, p.z, ht, rnd, hi);
      this.cols.push({ x: p.x, z: p.z, r: 0.45 + ht * 0.03 });
    }
    const shrubs: Array<[number, number, number]> = [
      [-15, 42, 0.9],
      [-8, 52, 0.7],
      [-16, 50, 1.1],
      [16, 52, 0.8],
      [18, 60, 1.0],
      [-9, 66, 0.9],
      [-14, 74, 1.2],
      [6, 74, 0.8],
      [26, 46, 0.9],
      [30, 56, 1.1],
      [-22, 46, 0.8],
      [14, 88, 1.0],
      [-24, 56, 1.3],
      [-19, 70, 0.9],
      [22, 40, 0.7],
      [34, 64, 1.0],
      [42, 72, 1.2],
      [-10, 90, 1.0],
      [-28, 38, 1.0],
      [8, 104, 1.1],
      [24, 98, 0.9],
      [-6, 28, 0.6],
    ];
    shrubs.forEach(([dx, dz, s], i) => {
      const p = W(dx, dz);
      shrub(batch, p.x, p.y, p.z, s, i + 1);
      this.cols.push({ x: p.x, z: p.z, r: s * 0.9 });
    });

    // ---------------- path to the lodge, lamp posts, benches, snowman, signpost ----------------
    const stairs = L2W(0, LODGE.D / 2 + LODGE.deckDepth + 2.0);
    const pathCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(F.x + 0, 0, F.z + 30),
      new THREE.Vector3(F.x + 3, 0, F.z + 44),
      new THREE.Vector3(F.x + 7, 0, F.z + 52),
      new THREE.Vector3((F.x + 7 + stairs.x) / 2 + 1.5, 0, (F.z + 52 + stairs.y) / 2 - 1),
      new THREE.Vector3(stairs.x, 0, stairs.y),
    ]);
    {
      const n = 60;
      const pos: number[] = [];
      const pts = pathCurve.getSpacedPoints(n);
      for (let i = 0; i < n; i++) {
        const a = pts[i]!;
        const b2 = pts[i + 1]!;
        const d = new THREE.Vector3().subVectors(b2, a).normalize();
        const side = new THREE.Vector3(d.z, 0, -d.x);
        const wA = 1.6 + Math.sin(i * 0.7) * 0.25;
        const wB = 1.6 + Math.sin((i + 1) * 0.7) * 0.25;
        const q = [a.clone().addScaledVector(side, wA), a.clone().addScaledVector(side, -wA), b2.clone().addScaledVector(side, -wB), b2.clone().addScaledVector(side, wB)];
        for (const v of q) v.y = H(v.x, v.z) + 0.025;
        for (const k of [0, 1, 2, 0, 2, 3]) pos.push(q[k]!.x, q[k]!.y, q[k]!.z);
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      pg.computeVertexNormals();
      noShadow.add('snow', pg, undefined, (p) => new THREE.Color(0.86, 0.88, 0.93).multiplyScalar(0.97 + 0.03 * Math.sin(p.x * 3 + p.z * 2)), (g) => {
        const P = g.attributes.position as THREE.BufferAttribute;
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < P.count; i++) uv.setXY(i, P.getX(i) / 2, P.getZ(i) / 2);
        // make sure the ribbon faces up
        const N = g.attributes.normal as THREE.BufferAttribute;
        for (let i = 0; i < N.count; i += 3) {
          if (N.getY(i) < 0) {
            for (let k = 0; k < 3; k++) N.setXYZ(i + k, -N.getX(i + k), -N.getY(i + k), -N.getZ(i + k));
            const ax = P.getX(i), ay = P.getY(i), az = P.getZ(i);
            P.setXYZ(i, P.getX(i + 1), P.getY(i + 1), P.getZ(i + 1));
            P.setXYZ(i + 1, ax, ay, az);
          }
        }
      });
    }
    const lampTs = [0.12, 0.34, 0.56, 0.78, 0.95];
    lampTs.forEach((t, i) => {
      const p = pathCurve.getPointAt(t);
      const d = pathCurve.getTangentAt(t);
      const s = i % 2 === 0 ? 1 : -1;
      const x = p.x + d.z * 2.4 * s;
      const z = p.z - d.x * 2.4 * s;
      const lp = lampPost(batch, x, H(x, z), z);
      bulbs.push({ p: lp, c: 0xffc070 });
      this.cols.push({ x, z, r: 0.3 });
    });
    for (const [dx, dz, ry] of [
      [-3.5, 50, 0.9],
      [18.5, 51, -2.2],
    ] as const) {
      const p = W(dx, dz);
      bench(batch, p.x, p.y, p.z, ry);
      this.cols.push({ x: p.x, z: p.z, r: 0.9 });
    }
    {
      const p = W(-17, 40);
      snowman(batch, p.x, p.y, p.z, -0.4);
      this.cols.push({ x: p.x, z: p.z, r: 0.5 });
      const sp = W(4.5, 31.5);
      signpost(batch, sp.x, sp.y, sp.z, -2.6);
      this.cols.push({ x: sp.x, z: sp.z, r: 0.25 });
    }

    // ---------------- build merged meshes ----------------
    for (const m of batch.build(M, { cast: true, receive: true })) this.group.add(m);
    for (const m of noShadow.build(M, { cast: false, receive: true })) this.group.add(m);

    // ---------------- lights ----------------
    const entrance = new THREE.PointLight(0xffb36b, 10, 13, 2);
    entrance.position.copy(toW(lodge.entranceLamp));
    this.group.add(entrance);

    // ---------------- particles & glows ----------------
    this.particles.push(
      new Particles(
        {
          count: hi ? 70 : 28,
          origin: this.tubCenter.clone().add(new THREE.Vector3(0, 0.05, 0)),
          radius: tubR * 0.85,
          life: [3.5, 6.5],
          rise: [0.35, 0.7],
          drift: new THREE.Vector3(0.3, 0, 0.12),
          size: [0.8, 3.4],
          alpha: 0.42,
          color: 0xf3f8ff,
          swirl: 0.25,
        },
        soft,
      ),
      new Particles(
        {
          count: hi ? 30 : 14,
          origin: toW(lodge.chimneyTop),
          radius: 0.25,
          life: [5, 9],
          rise: [0.7, 1.1],
          drift: new THREE.Vector3(0.7, 0, 0.3),
          size: [1.0, 5.0],
          alpha: 0.22,
          color: 0xe0e4ea,
          colorEnd: 0xbac1cc,
          swirl: 0.35,
        },
        soft,
      ),
      new Particles(
        {
          count: hi ? 26 : 12,
          origin: flameBase.clone().add(new THREE.Vector3(0, 0.4, 0)),
          radius: 0.35,
          life: [1.0, 2.4],
          rise: [0.9, 1.8],
          drift: new THREE.Vector3(0.15, 0, 0.05),
          size: [0.09, 0.04],
          alpha: 1,
          color: 0xffc050,
          colorEnd: 0xff3000,
          additive: true,
          swirl: 0.5,
        },
        soft,
      ),
    );
    for (const p of this.particles) this.group.add(p.points);
    const glowPts: Array<{ p: THREE.Vector3; c: number; size: number; a?: number }> = bulbs.map((b) => ({ p: b.p, c: b.c, size: 0.55, a: 0.5 }));
    glowPts.push({ p: toW(lodge.entranceLamp), c: 0xffb060, size: 2.2, a: 0.35 });
    for (const t of lodge.heaterTops) glowPts.push({ p: toW(t), c: 0xff6a20, size: 1.4, a: 0.5 });
    glowPts.push({ p: flameBase.clone().add(new THREE.Vector3(0, 0.7, 0)), c: 0xff7a20, size: 2.4, a: 0.3 });
    glowPts.push({ p: this.tubCenter.clone().add(new THREE.Vector3(0, 0.15, 0)), c: 0x3fd8d0, size: 3.6, a: 0.3 });
    this.glows = new Glows(glowPts, soft);
    this.group.add(this.glows.points);

    // ---------------- guests ----------------
    const guestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide });
    this.materials.push(guestMat);
    const specs = this.guestSpecs();
    const stop = W(0, 35);
    this.stopPoint.copy(stop);
    this.yetiPoint.copy(W(-58, -12));
    const groundWorld = (x: number, z: number): number => H(x, z);
    const deckGround = (): number => deckWorldY;
    const seatY = tubY + 0.6;
    const seatGround = (): number => seatY;
    const groupA = W(8.6, 39.6);
    const groupB = W(-5.2, 42.4);
    const faceTo = (from: THREE.Vector3, to: THREE.Vector3): number => Math.atan2(to.x - from.x, to.z - from.z);
    const mix = (a: number, b: number, t: number): number => {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return a + d * t;
    };
    const placeStanding = (g: Guest, p: THREE.Vector3, center: THREE.Vector3): void => {
      const y = mix(faceTo(p, center), faceTo(p, stop), 0.4);
      g.place(p.x, p.z, y, center);
    };
    const tubToStop = Math.atan2(stop.x - tubL.x, stop.z - tubL.y);
    specs.forEach((s, i) => {
      if (!hi && i >= 10) return; // low quality: fewer bystanders
      const seated = !!s.beh.seated;
      const onDeck = i >= 8;
      const g = new Guest(s.look, s.beh, guestMat, seated ? seatGround : onDeck ? deckGround : groundWorld);
      if (i < 5) {
        // chatting groups arranged as an arc that opens toward the arrival point
        const c = i < 3 ? groupA : groupB;
        const k = i < 3 ? i - 1 : (i - 3) * 2 - 1;
        const away = Math.atan2(c.x - stop.x, c.z - stop.z);
        const a = away + k * (i < 3 ? 1.15 : 0.9);
        const r = i < 3 ? 1.25 : 0.85;
        placeStanding(g, W(c.x - F.x + Math.sin(a) * r, c.z - F.z + Math.cos(a) * r), c);
      } else if (i === 5) {
        const p = W(fp.x - F.x + 1.6, fp.z - F.z - 1.9);
        placeStanding(g, p, fp);
      } else if (seated) {
        const a = tubToStop + (i === 6 ? -0.5 : 0.45);
        const px = tubL.x + Math.sin(a) * (tubR + 0.04);
        const pz = tubL.y + Math.cos(a) * (tubR + 0.04);
        g.place(px, pz, a, null);
      } else {
        const deckSpots: Array<[number, number, number]> = [
          [-5.2, LODGE.D / 2 + 2.3, 0.2],
          [-4.3, LODGE.D / 2 + 3.6, -2.4],
          [3.9, LODGE.D / 2 + 3.1, 1.6],
          [6.4, LODGE.D / 2 + 5.4, -1.2],
        ];
        const [lx, lz, ly] = deckSpots[i - 8]!;
        const p = L2W(lx, lz);
        const partner = L2W(i % 2 === 0 ? lx + 0.6 : lx - 0.6, i % 2 === 0 ? lz + 1.0 : lz - 1.0);
        g.place(p.x, p.y, yaw + ly, new THREE.Vector3(partner.x, deckWorldY, partner.y));
      }
      this.guests.push(g);
      this.group.add(g.group);
    });
    // one idle frame so the pose isn't the bind pose
    this.update(0.016, 0, { cheer: 0, lookAt: null, welcome: 0 });
  }

  private guestSpecs(): GuestSpec[] {
    const base = { hatColor: 0xffffff, hatColor2: 0xffffff, scarf: null, fur: null, gloves: null, mug: null, mugColor: 0xffffff, beard: false } as const;
    const women: GuestSpec[] = [
      {
        look: { ...base, height: 1.69, skin: 0xf2d0b8, hair: 0x5a3420, hairStyle: 'waves', headwear: 'earmuffs', hatColor: 0xf6d2da, hatColor2: 0xe5e7eb, top: 'cropPuffer', topColor: 0xf1ece2, accent: 0xc9b48a, fur: 0xefe6d6, pants: 'ski', pantsColor: 0x1b1b1f, boots: 'fluffy', bootColor: 0xe9dfcf, mug: 'R', mugColor: 0xc0392b, lips: 0xc25a6a, eyes: 0x4a6b8a, part: 0.4 },
        beh: { cheerStyle: 'toast', canWalk: true, seed: 11, waveArm: 'L' },
      },
      {
        look: { ...base, height: 1.73, skin: 0x6b4330, hair: 0x120d0b, hairStyle: 'curly', headwear: 'hood', top: 'parka', topColor: 0x7a1f2e, accent: 0x3a0f16, fur: 0xe8dcc6, pants: 'ski', pantsColor: 0xb89c7a, boots: 'snow', bootColor: 0x4a3426, gloves: 0x3a2a22, mug: 'L', mugColor: 0xf1e7d0, lips: 0x8c3b45, eyes: 0x2b1a10 },
        beh: { cheerStyle: 'pump', canWalk: true, seed: 23, jumpy: false, waveArm: 'R' },
      },
      {
        look: { ...base, height: 1.66, skin: 0xeccfb3, hair: 0x15110f, hairStyle: 'long', headwear: 'beanie', hatColor: 0xc62828, hatColor2: 0xf5f5f5, top: 'sweater', topColor: 0x1f2d4d, accent: 0xf3f3f3, pants: 'ski', pantsColor: 0xeeeeee, boots: 'snow', bootColor: 0x1d1d1d, lips: 0xc65b6b, eyes: 0x2a1a12, part: -0.3 },
        beh: { cheerStyle: 'clap', canWalk: true, seed: 37, jumpy: true, waveArm: 'R' },
      },
      {
        look: { ...base, height: 1.71, skin: 0xf0c9a8, hair: 0xd9b26a, hairStyle: 'ponytail', headwear: 'headband', hatColor: 0x14a39a, hatColor2: 0x0f766e, top: 'puffer', topColor: 0xd9a21b, accent: 0x7a5a10, pants: 'leggings', pantsColor: 0x18181b, boots: 'fluffy', bootColor: 0xc8b8a0, fur: null, gloves: 0xf2f2f2, lips: 0xc8606e, eyes: 0x3d6b4a, part: 0.5 },
        beh: { cheerStyle: 'armsUp', canWalk: true, seed: 41, jumpy: true, waveArm: 'L' },
      },
      {
        look: { ...base, height: 1.68, skin: 0xb57e57, hair: 0x1e1410, hairStyle: 'bun', headwear: 'none', top: 'parka', topColor: 0x1f5c47, accent: 0x0f2e23, fur: 0xd8c8b0, pants: 'ski', pantsColor: 0x33363d, boots: 'snow', bootColor: 0x5b4030, mug: 'L', mugColor: 0xf59e0b, lips: 0x9c4a50, eyes: 0x2a1a10, scarf: null },
        beh: { cheerStyle: 'toast', canWalk: true, seed: 53, waveArm: 'R' },
      },
      {
        look: { ...base, height: 1.7, skin: 0xf6d5c2, hair: 0x8a3b1e, hairStyle: 'bob', headwear: 'beanie', hatColor: 0xefe7da, hatColor2: 0xe8a0a8, top: 'puffer', topColor: 0xe8a0a8, accent: 0xffffff, pants: 'ski', pantsColor: 0x2c2f4a, boots: 'snow', bootColor: 0xf0f0f0, gloves: 0xf0f0f0, scarf: 0xf3f4f6, scarf2: 0xe8a0a8, lips: 0xd0606e, eyes: 0x5a7a3a, part: 0.2 },
        beh: { cheerStyle: 'pump', canWalk: true, seed: 67, jumpy: true, waveArm: 'R' },
      },
      {
        look: { ...base, height: 1.72, skin: 0x5a3624, hair: 0x120c0a, hairStyle: 'braids', headwear: 'none', top: 'robe', topColor: 0xf5f2ec, accent: 0xb38b6d, fur: 0xf8f6f2, pants: 'leggings', pantsColor: 0x9ca3af, boots: 'fluffy', bootColor: 0xf1e8d8, mug: 'R', mugColor: 0x1e3a8a, lips: 0x7f3a44, eyes: 0x24140c },
        beh: { cheerStyle: 'armsUp', seated: true, seed: 79, waveArm: 'L' },
      },
      {
        look: { ...base, height: 1.67, skin: 0xf3d6c6, hair: 0xe5c78a, hairStyle: 'long', headwear: 'headband', hatColor: 0xf1e8d8, hatColor2: 0xa99bd6, top: 'parka', topColor: 0xa99bd6, accent: 0x5b4b8a, fur: 0xf3ece0, pants: 'leggings', pantsColor: 0xe5e7eb, boots: 'fluffy', bootColor: 0xf1e8d8, mug: 'L', mugColor: 0xf7f7f7, lips: 0xcf6a78, eyes: 0x4a78a0, part: -0.4 },
        beh: { cheerStyle: 'toast', seated: true, seed: 83, waveArm: 'R' },
      },
    ];
    const bystanders: GuestSpec[] = [
      {
        look: { ...base, male: true, height: 1.83, skin: 0xe8c0a0, hair: 0x5a3a22, hairStyle: 'short', headwear: 'beanie', hatColor: 0x6b7280, hatColor2: 0x374151, top: 'skiJacket', topColor: 0xe8590c, accent: 0x1f2937, pants: 'ski', pantsColor: 0x111827, boots: 'snow', bootColor: 0x3f3f46, gloves: null, mug: 'R', mugColor: 0x7c2d12, lips: 0xb06a60, eyes: 0x3a2a1a, beard: true },
        beh: { cheerStyle: 'toast', seed: 97, energy: 0.7 },
      },
      {
        look: { ...base, male: true, height: 1.78, skin: 0x8d5a3b, hair: 0x1a1a1a, hairStyle: 'buzz', headwear: 'none', top: 'puffer', topColor: 0x1e3a5f, accent: 0x93c5fd, pants: 'ski', pantsColor: 0x4b5563, boots: 'snow', bootColor: 0x292524, mug: 'L', mugColor: 0xe5e7eb, lips: 0x7a4038, eyes: 0x24140c },
        beh: { cheerStyle: 'toast', seed: 101, energy: 0.6 },
      },
      {
        look: { ...base, height: 1.65, skin: 0xf0cfb8, hair: 0xc8c8c8, hairStyle: 'bob', headwear: 'none', top: 'skiJacket', topColor: 0x0f766e, accent: 0xf1f5f9, pants: 'ski', pantsColor: 0x1f2937, boots: 'snow', bootColor: 0x44403c, mug: 'R', mugColor: 0xfbbf24, lips: 0xb0606a, eyes: 0x4a6080, part: 0.6 },
        beh: { cheerStyle: 'toast', seed: 113, energy: 0.6 },
      },
      {
        look: { ...base, male: true, height: 1.8, skin: 0xd8a878, hair: 0x6b4a2a, hairStyle: 'buzz', headwear: 'beanie', hatColor: 0x7f1d1d, hatColor2: 0xfef3c7, top: 'parka', topColor: 0x4d5b3a, accent: 0x2b3320, fur: 0xcdbf9f, pants: 'ski', pantsColor: 0xa8a29e, boots: 'snow', bootColor: 0x57534e, gloves: 0x292524, lips: 0xa0605a, eyes: 0x3a5a3a, beard: false },
        beh: { cheerStyle: 'clap', seed: 127, energy: 0.8 },
      },
    ];
    return [...women, ...bystanders];
  }

  private buildTrophy(env: THREE.CubeTexture): THREE.Object3D {
    const g = new THREE.Group();
    g.name = 'Trophy';
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xffb02a, metalness: 1, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 1.4 });
    const plinthM = new THREE.MeshPhysicalMaterial({ color: 0x111318, roughness: 0.25, metalness: 0.1, clearcoat: 1, envMap: env });
    this.materials.push(gold, plinthM);
    const v = (r: number, y: number): THREE.Vector2 => new THREE.Vector2(r, y);
    // stem + foot (lathe)
    const stem = new THREE.LatheGeometry(
      [v(0.0, 0.2), v(0.15, 0.2), v(0.15, 0.225), v(0.12, 0.24), v(0.06, 0.27), v(0.035, 0.3), v(0.032, 0.34), v(0.065, 0.36), v(0.07, 0.375), v(0.06, 0.39), v(0.03, 0.41), v(0.03, 0.43), v(0.055, 0.45), v(0.06, 0.46)],
      32,
    );
    // cup: outer up, lip, inner back down
    const cupPts = [v(0.06, 0.455), v(0.09, 0.47), v(0.15, 0.51), v(0.19, 0.57), v(0.205, 0.64), v(0.205, 0.7), v(0.215, 0.77), v(0.235, 0.83), v(0.245, 0.845), v(0.24, 0.85), v(0.225, 0.845), v(0.205, 0.8), v(0.19, 0.7), v(0.17, 0.6), v(0.11, 0.53), v(0.0, 0.5)];
    const cup = new THREE.LatheGeometry(cupPts, 40);
    const band = new THREE.TorusGeometry(0.207, 0.012, 8, 48).rotateX(Math.PI / 2).translate(0, 0.66, 0);
    const parts: THREE.BufferGeometry[] = [stem, cup, band];
    for (const s of [-1, 1]) {
      const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(s * 0.2, 0.79, 0), new THREE.Vector3(s * 0.4, 0.84, 0), new THREE.Vector3(s * 0.4, 0.56, 0), new THREE.Vector3(s * 0.15, 0.53, 0));
      parts.push(new THREE.TubeGeometry(curve, 24, 0.022, 10, false));
      parts.push(new THREE.SphereGeometry(0.03, 10, 8).translate(s * 0.15, 0.53, 0));
      parts.push(new THREE.SphereGeometry(0.028, 10, 8).translate(s * 0.2, 0.79, 0));
    }
    // star finial on a short spire above the rim (decorative)
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 === 0 ? 0.075 : 0.032;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const starG = new THREE.ExtrudeGeometry(star, { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
    starG.translate(0, 0, -0.01);
    starG.translate(0, 0.33, 0.152);
    // plate on the plinth front
    const plate = new THREE.BoxGeometry(0.2, 0.07, 0.006).translate(0, 0.1, 0.171);
    const all = [...parts, starG, plate].map((p) => {
      const n = p.index ? p.toNonIndexed() : p;
      for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
      return n;
    });
    const merged = new THREE.BufferGeometry();
    const pos: number[] = [];
    const nor: number[] = [];
    for (const p of all) {
      pos.push(...(p.attributes.position as THREE.BufferAttribute).array);
      nor.push(...(p.attributes.normal as THREE.BufferAttribute).array);
    }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const goldMesh = new THREE.Mesh(merged, gold);
    goldMesh.castShadow = true;
    goldMesh.receiveShadow = true;
    g.add(goldMesh);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.34).translate(0, 0.1, 0), plinthM);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    g.add(plinth);
    // bake the size into the geometry so the Object3D keeps unit scale for the game
    for (const m of [goldMesh, plinth]) {
      m.geometry.scale(1.45, 1.45, 1.45);
      m.geometry.computeBoundingSphere();
    }
    return g;
  }

  update(dt: number, time: number, state: { cheer: number; lookAt: THREE.Vector3 | null; welcome: number }): void {
    this.banner.update(time);
    this.water.uniforms.uTime!.value = time;
    this.flame.uniforms.uTime!.value = time;
    const fl = 0.8 + 0.2 * Math.sin(time * 11.3) * Math.sin(time * 7.1 + 1) + 0.1 * Math.sin(time * 23.7);
    this.fireLight.intensity = 14 * fl;
    this.flameMesh.scale.set(1, 0.9 + fl * 0.15, 1);
    this.tubLight.intensity = 6 + Math.sin(time * 1.7) * 0.6;
    for (const p of this.particles) p.update(dt, time);
    this.glows.update(time);
    const cheer = Math.min(1, Math.max(0, state.cheer));
    const welcome = Math.min(1, Math.max(0, state.welcome));
    for (const g of this.guests) g.update(dt, time, cheer, state.lookAt, welcome);
  }

  getPodiumTop(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.podiumTop);
  }
  getHotTubCenter(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.tubCenter);
  }
  getStopPoint(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.stopPoint);
  }
  getYetiStopPoint(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.yetiPoint);
  }
  colliders(): CircleCollider[] {
    return this.cols;
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
