/**
 * Fjord art test scene (round-4 experiment): the CURRENT approach and the PROPOSED one, in the
 * game's Fjord lighting, sky, aerial perspective and water, from identical cameras.
 *
 *   /artscene.html?mode=current|proposed&shot=long|cliff|cave|cave_near|islands|island[&q=high][&label=0]
 *
 * Both modes use the same course (Fjord Coast, Classic Sprint: the course of the final-round
 * evidence), the same Environment (sun, sky IBL, hemisphere, fog), the same TerrainRenderer for the
 * land and the same FjordWater. Only the sea side differs:
 *   current  — the heightfield cliffs/islands of src/world/coast.ts; the cave with the round-3
 *              Fjord dressing (dressSeaCave).
 *   proposed — src/world/art/*: cliff-kit meshes on a hidden heightfield backing, archetype island
 *              meshes, the triplanar baked-PBR rock material, and the basalt portal for the cave.
 * window.__ready turns true once the frame is final; window.__stats has the render counts.
 */
import * as THREE from 'three';
import '../../src/world/biomes';
import { getBiome } from '../../src/world/biome';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { Environment } from '../../src/world/Environment';
import { TerrainRenderer } from '../../src/world/TerrainRenderer';
import { FjordWater } from '../../src/world/biomes/fjord/views/water';
import { Cave } from '../../src/world/Cave';
import { dressSeaCave } from '../../src/world/biomes/fjord/views/seaCave';
import type { QualityPreset } from '../../src/core/types';
import type { Mountain } from '../../src/world/course';
import { ArtCoastMountain, IslandSet, islandSpecs } from '../../src/world/art/artCoast';
import { CliffKit } from '../../src/world/art/cliffKit';
import { createRockMaterial, rockSetsReady } from '../../src/world/art/rockMaterial';
import { buildBasaltPortal } from '../../src/world/art/basaltPortal';

declare global {
  interface Window {
    __ready?: boolean;
    __stats?: Record<string, unknown>;
    __error?: string;
  }
}

const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'proposed' ? 'proposed' : 'current';
const shotName = params.get('shot') ?? 'cliff';
const quality = (params.get('q') ?? 'high') as QualityPreset;

const biome = getBiome('fjord');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = biome.lighting.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);
const label = document.getElementById('label')!;
if (params.get('label') !== '0') label.textContent = `${mode.toUpperCase()} · ${shotName}`;
else label.remove();

const scene = new THREE.Scene();
const env = new Environment(scene, renderer, quality, biome);
const base = buildMountain(makeCourse('classic', 'sprint', { biome: 'fjord' }));
// the proposed mountain also derives the cameras (pure), so both modes frame identical shots
const art = new ArtCoastMountain(base.profile, base.seed, base.biome);
const m: Mountain = mode === 'proposed' ? art : base;
const coast = base.coast!;

type Pose = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; focus: THREE.Vector3; zWin: [number, number] };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const anchor = base.caves.find((a) => a.side < 0) ?? base.caves[0]!;

/** the proposed feature island nearest a point (the close island shot aims at it in both modes) */
function featureIsland(): { x: number; z: number; y: number; r: number } {
  const specs = islandSpecs(art, { x0: -2600, x1: -300, z0: 1200, z1: 3400 });
  const target = V(-1000, 0, 2100);
  let best = specs[0];
  let bd = Infinity;
  for (const s of specs) {
    if (s.kind === 'skerry') continue;
    const d = Math.hypot(s.x - target.x, s.z - target.z);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best ? { x: best.x, z: best.z, y: best.water + best.h * 0.4, r: best.a } : { x: target.x, z: target.z, y: coast.seaLevelAt(target.z), r: 200 };
}

let caveRef: Cave | null = null;
function pose(name: string): Pose {
  switch (name) {
    case 'long': {
      // the final-round evidence framing (06_long_distance)
      const z = 900;
      const lv = coast.seaLevelAt(z);
      const x = base.routeX(z);
      return { pos: V(x - 1500, lv + 340, z - 1300), look: V(x + 150, base.heightAt(x, z + 900) - 60, z + 1300), fov: 55, focus: V(x - 300, lv, z), zWin: [-700, 3300] };
    }
    case 'cliff': {
      const z = 1150;
      const lv = coast.seaLevelAt(z);
      const xr = coast.rimX(z);
      return { pos: V(xr - 620, lv + 40, z - 520), look: V(xr - 120, lv + 230, z + 260), fov: 50, focus: V(xr - 150, lv + 60, z), zWin: [200, 2400] };
    }
    case 'cave':
    case 'cave_near': {
      const c = caveRef!;
      const o = c.outward;
      const M = c.mouth;
      if (name === 'cave') return { pos: V(M.x + o.x * 26 + o.z * 9, M.y + 7, M.z + o.z * 26 - o.x * 9 - 8), look: V(M.x, M.y + 3, M.z), fov: 50, focus: M.clone(), zWin: [anchor.z - 600, anchor.z + 1600] };
      const tan = V(o.z, 0, -o.x);
      return { pos: M.clone().addScaledVector(o, 15).addScaledVector(tan, -7).add(V(0, 2.6, 0)), look: M.clone().add(V(0, 3.2, 0)).addScaledVector(tan, -1.5), fov: 58, focus: M.clone(), zWin: [anchor.z - 600, anchor.z + 1600] };
    }
    case 'islands': {
      // the final-round evidence framing (03_mid_mountain)
      const z = 1500;
      const x = base.routeX(z);
      const y = base.heightAt(x, z);
      return { pos: V(x + 60, base.heightAt(x + 60, z - 150) + 30, z - 150), look: V(x - 170, y - 80, z + 240), fov: 52, focus: V(x, y, z), zWin: [600, 4200] };
    }
    case 'island':
    default: {
      const I = featureIsland();
      const lv = coast.seaLevelAt(I.z);
      const d = I.r * 2.6 + 160;
      return { pos: V(I.x + d * 0.75, lv + 28, I.z - d * 0.66), look: V(I.x, lv + 12, I.z), fov: 48, focus: V(I.x, lv, I.z), zWin: [I.z - 1500, I.z + 2500] };
    }
  }
}

async function main() {
  const t0 = performance.now();
  const stats: Record<string, unknown> = { mode, shot: shotName };
  // the cave (both modes) first: some shots are framed on it
  const needCave = shotName.startsWith('cave');
  if (needCave) {
    caveRef = new Cave(m, anchor, quality);
    scene.add(caveRef.group);
  }
  const P = pose(shotName);
  const camera = new THREE.PerspectiveCamera(P.fov, innerWidth / innerHeight, 0.3, 12000);
  camera.position.copy(P.pos);
  camera.lookAt(P.look);
  camera.updateMatrixWorld();

  // terrain (land identical in both modes)
  const terrain = new TerrainRenderer(m, quality);
  terrain.uniforms.uSunDir.value.copy(env.sunDir);
  if (needCave) terrain.pinned.push({ x: caveRef!.mouth.x, z: caveRef!.mouth.z, r: 40 });
  await terrain.prime(P.focus.x, P.focus.z, () => {});
  scene.add(terrain.group);
  const water = new FjordWater(coast, terrain.uniforms, env.sunDir, new THREE.Color(...biome.ranges.skyColor), quality);
  scene.add(water.group);
  water.update(10, camera.position, new THREE.Vector3());

  if (needCave) {
    if (mode === 'current') {
      const d = dressSeaCave({ mountain: m, anchor, cave: caveRef!, quality, biome });
      scene.add(d.group);
    } else {
      const portal = buildBasaltPortal(m, caveRef!, { quality });
      scene.add(portal.group);
      stats['portalColumns'] = portal.columns;
      stats['portalTriangles'] = portal.triangles;
    }
  }
  if (mode === 'proposed') {
    const am = m as ArtCoastMountain;
    const kitMat = createRockMaterial({ kind: 'gneiss', vertexColors: true, water: coast.seaLevelAt(P.focus.z), snow: 1, strata: 1 });
    const kit = new CliffKit(am.cliff, kitMat, 256, 24);
    kit.sync(P.zWin[0], P.zWin[1], camera.position.x, camera.position.z);
    scene.add(kit.group);
    stats['cliffSegments'] = kit.drawCalls;
    stats['cliffTriangles'] = kit.triangles;
    const isl = new IslandSet(am, { x0: -3000, x1: -250, z0: P.zWin[0], z1: P.zWin[1] }, { max: 60 });
    scene.add(isl.group);
    stats['islands'] = isl.specs.length;
    stats['islandKinds'] = isl.specs.reduce<Record<string, number>>((a, s) => ((a[s.kind] = (a[s.kind] ?? 0) + 1), a), {});
    stats['islandTriangles'] = isl.triangles;
    stats['islandDrawCalls'] = isl.drawCalls;
    await rockSetsReady();
  }
  env.update(1 / 60, P.focus, camera.position, 10);
  stats['buildMs'] = Math.round(performance.now() - t0);
  // two frames (shadow maps, texture uploads), then final
  renderer.render(scene, camera);
  await new Promise((r) => requestAnimationFrame(r));
  renderer.render(scene, camera);
  stats['drawCalls'] = renderer.info.render.calls;
  stats['triangles'] = renderer.info.render.triangles;
  stats['textures'] = renderer.info.memory.textures;
  stats['geometries'] = renderer.info.memory.geometries;
  stats['camera'] = { pos: camera.position.toArray().map((v) => Math.round(v * 10) / 10), look: P.look.toArray().map((v) => Math.round(v * 10) / 10), fov: P.fov };
  window.__stats = stats;
  window.__ready = true;
}

main().catch((e) => {
  window.__error = String(e?.stack ?? e);
  console.error(e);
});
