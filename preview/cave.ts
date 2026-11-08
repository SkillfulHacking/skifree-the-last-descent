/**
 * Visual harness for src/world/Cave.ts (the Yeti cave formation).
 * URL params:
 *   ?cam=approach|front|inside|mouth|threequarter|above|closeup|wide|side|piste|c1..c12|orbit
 *        c1..c12 = the CaveCinematic shots, one per shot, with the real Yeti and skier models where the
 *        timeline has them (the cinematic's dimming/eye glow is not reproduced: capture the game for that)
 *   &debug=1  floor sample grid (green ≥ 4.2 m clearance, amber ≥ 3.6 m, red below), exit path, key points
 *   &yeti=1   the Yeti standing on the ledge in the non-cinematic views (scale check)
 *   &prints=0 no Yeti prints on the ledge
 *   &q=low|medium|high|ultra   &res=0.5 (terrain grid metres)   &info=0 hides the overlay
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Mountain } from '../src/world/course';
import { createSnowMaterial } from '../src/world/snowMaterial';
import { Environment } from '../src/world/Environment';
import { Cave } from '../src/world/Cave';
import type { QualityPreset, SkierPose, YetiMode } from '../src/core/types';
import { YetiModel } from '../src/yeti/YetiModel';
import { SkierModel } from '../src/player/SkierModel';
import { Footprints } from '../src/world/Cave';

declare global {
  interface Window {
    __ready?: boolean;
    __cave?: Cave;
    __setCam?: (name: string) => Promise<void>;
    __inFrame?: { name: string; subject: string; fraction: number };
  }
}

const params = new URLSearchParams(location.search);
const camName = params.get('cam') ?? 'threequarter';
const quality = (params.get('q') ?? 'high') as QualityPreset;
const res = Number(params.get('res') ?? '0.5');
const debug = params.get('debug') === '1';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 0.78;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const env = new Environment(scene, renderer, quality);
const m = new Mountain();
const anchor = m.caves[0]!;

// --- local terrain (260 m square around the cave) with the game's snow material
const { material: snowMat, uniforms } = createSnowMaterial(quality);
uniforms.uSunDir.value.copy(env.sunDir);
{
  const size = 260;
  const cx = anchor.centerX + anchor.side * (anchor.d - 30), cz = anchor.z + 10;
  const n = Math.round(size / res) + 1;
  const pos = new Float32Array(n * n * 3);
  const surf = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = cx - size / 2 + i * res, z = cz - size / 2 + j * res;
      const k = (i + j * n) * 3;
      pos[k] = x;
      pos[k + 1] = m.heightAt(x, z);
      pos[k + 2] = z;
      // the same surface weights the game's terrain chunks carry
      const w = m.surfaceWeights(x, z);
      surf[k] = w.ice;
      surf[k + 1] = w.powder;
      surf[k + 2] = w.groomed;
    }
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let t = 0;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = i + j * n, b = a + 1, c = a + n, d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b;
      idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, snowMat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.visible = params.get('terrain') !== '0';
  scene.add(mesh);
}

const cave = new Cave(m, anchor, quality);
window.__cave = cave;
scene.add(cave.group);
if (params.get('rock') === '0') cave.group.visible = false;
if (debug) cave.setDebug(true);

const M = cave.mouth.clone();
const O = cave.outward.clone();
const at = (base: THREE.Vector3, ox: number, oy: number, oz: number) => base.clone().addScaledVector(O, ox).add(new THREE.Vector3(0, oy, oz));
const lerp = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
// the skier where the cinematic starts (trigger at cave z + 22, on the route)
const pz = anchor.z + 22;
const P = new THREE.Vector3(m.routeX(pz), 0, pz);
P.y = m.heightAt(P.x, P.z);
const downhill = new THREE.Vector3(0, 0, 1);
const toCave = new THREE.Vector3(M.x - P.x, 0, M.z - P.z).normalize();

// --- actors: the real Yeti and skier models (as in the cinematic), plus a few Yeti prints on the ledge
const yeti = new YetiModel({ quality });
yeti.setGround((x, z) => cave.floorHeightAt(x, z));
scene.add(yeti.root);
const skier = new SkierModel({ quality });
skier.root.position.copy(P);
scene.add(skier.root);
const prints = new Footprints(m, 16);
scene.add(prints.mesh);
if (params.get('prints') !== '0') {
  // a few prints stepping off the ledge toward the piste (soft depressions, not outlines)
  const L = cave.ledge;
  const head = Math.atan2(O.x, O.z);
  for (let i = 0; i < 4; i++) {
    const d = 1.4 + i * 1.35;
    const sideOff = (i % 2 ? 0.45 : -0.45);
    const x = L.x + O.x * d - O.z * sideOff, z = L.z + O.z * d + O.x * sideOff;
    prints.add(x, z, head, i % 2 ? 'left' : 'right', 1.15);
  }
}
const skierPose = (lookBack: number): SkierPose => ({ steer: 0, lean: 0, tuck: 0.15, pizza: 0, drift: 0, driftAngle: 0, crouch: 0, airborne: false, airTime: 0, landImpact: 0, crashed: false, crashTime: 0, recover: 0, speed: 9, lookBack, celebrate: 0, wobble: 0, time: 0 });
skier.root.rotation.y = 0; // heading downhill (+Z)

/** The exit path (as CaveCinematic maps it): depth s → floor point. */
const pathS = cave.exitPath.map((p, i) => ({ s: i === cave.exitPath.length - 1 ? -2.2 : 14 - 0.75 * i, p }));
function placeYeti(s: number) {
  let i = 0;
  while (i < pathS.length - 2 && pathS[i + 1]!.s > s) i++;
  const a = pathS[i]!, b = pathS[i + 1] ?? a;
  const f = a.s === b.s ? 0 : Math.min(1, Math.max(0, (a.s - s) / (a.s - b.s)));
  yeti.root.position.lerpVectors(a.p, b.p, f);
  yeti.root.position.y = cave.floorHeightAt(yeti.root.position.x, yeti.root.position.z);
  yeti.root.rotation.set(0, Math.atan2(O.x, O.z), 0);
}
/** Pose the Yeti in a mode and let the animation settle. */
function poseYeti(mode: YetiMode, settle = 1.2, speed = 0) {
  const dt = 1 / 30;
  for (let t = 0; t < settle; t += dt) yeti.update(dt, { mode, modeTime: t, speed, turn: 0, time: t });
}

type Pose = { pos: THREE.Vector3; look: THREE.Vector3; fov: number };
interface Shot {
  /** cinematic time (s) the preset represents, and what it shows */
  t: number;
  setup: () => void;
  pose: () => Pose;
  /** the subject that must be in frame */
  subject: 'cave' | 'yeti' | 'skier';
}
const leapTarget = () => {
  const tx = m.centerX(anchor.z + 14) + 18 * anchor.side, tz = anchor.z + 14;
  return new THREE.Vector3(tx, m.heightAt(tx, tz), tz);
};
const hand = new THREE.Vector3();
const headP = new THREE.Vector3();
const yetiAt = (s: number, mode: YetiMode, settle = 1.2, speed = 0) => () => {
  yeti.setVisible(true);
  placeYeti(s);
  poseYeti(mode, settle, speed);
};
const still = (pose: () => Pose): Pick<Shot, 'pose'> => ({ pose });
// presets c1..c12 follow src/cinematic/CaveCinematic.ts shot by shot (the camera at the end of each shot,
// the actors where the timeline has them)
const shots: Record<string, Shot> = {
  c1: { t: 2.4, setup: yetiAt(12.5, 'crawl'), subject: 'cave', ...still(() => ({ pos: at(M, 30, 7, 14), look: M.clone().add(new THREE.Vector3(0, 5, 0)), fov: 42 })) },
  c2: { t: 3.1, setup: yetiAt(11, 'crawl', 1.2, 0.6), subject: 'cave', ...still(() => ({ pos: lerp(at(M, 24, 3.5, 9), at(M, 21, 3.2, 7), 0.5), look: cave.lipTop.clone().add(new THREE.Vector3(0, -0.5, 0)), fov: 40 })) },
  c3: { t: 4.2, setup: yetiAt(6.5, 'crawl', 1.2, 0.8), subject: 'yeti', ...still(() => ({ pos: lerp(at(M, 12, 2.4, 1.5), at(M, 6.5, 2.3, 0.6), 0.15), look: cave.inside.clone().lerp(yeti.root.position, 0.6).add(new THREE.Vector3(0, 1.6, 0)), fov: 37 })) },
  c4: { t: 6.5, setup: yetiAt(0.6, 'crawl'), subject: 'yeti', ...still(() => ({ pos: at(M, 6.5, 2.3, 0.6), look: yeti.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)), fov: 30 })) },
  c5: {
    t: 7.2,
    setup: yetiAt(0.6, 'crawl'),
    subject: 'yeti',
    pose: () => {
      yeti.getHandWorldPosition('right', hand);
      yeti.getHeadWorldPosition(headP);
      return { pos: hand.clone().addScaledVector(O, 2.6).add(new THREE.Vector3(0, 0.55, 0.9)), look: hand.clone().lerp(headP, 0.35), fov: 33 };
    },
  },
  c6: { t: 8.6, setup: yetiAt(0.0, 'emerge', 0.7, 1.2), subject: 'yeti', ...still(() => ({ pos: lerp(at(M, 9.0, 1.4, 3.2), at(M, 8.2, 1.2, 2.8), 0.25), look: lerp(M.clone().addScaledVector(O, 0.6).add(new THREE.Vector3(0, 1.8, 0)), M.clone().addScaledVector(O, 1.6).add(new THREE.Vector3(0, 2.6, 0)), 0.25), fov: 49.5 })) },
  c7: { t: 10.6, setup: yetiAt(-2.2, 'stand', 1.0), subject: 'yeti', ...still(() => ({ pos: at(M, 8.2, 1.2, 2.8), look: M.clone().addScaledVector(O, 1.6).add(new THREE.Vector3(0, 2.6, 0)), fov: 48 })) },
  c8: { t: 11.8, setup: yetiAt(-2.2, 'roar', 0.8), subject: 'yeti', ...still(() => ({ pos: at(M, 7, 0.5, 3), look: M.clone().add(new THREE.Vector3(-1.5, 3.2, 0)), fov: 44 })) },
  c9: {
    t: 13.2,
    setup: yetiAt(-2.2, 'roar', 1.6),
    subject: 'yeti',
    pose: () => {
      yeti.getHeadWorldPosition(headP);
      return { pos: headP.clone().addScaledVector(O, 2.1).add(new THREE.Vector3(0, -0.2, 0.7)), look: headP.clone(), fov: 30 };
    },
  },
  c10: {
    t: 14.2,
    setup: () => {
      yetiAt(-2.2, 'roar', 2.5)();
      skier.update(1 / 30, skierPose(1));
    },
    subject: 'skier',
    ...still(() => ({ pos: P.clone().addScaledVector(downhill, 3.0).addScaledVector(toCave, -2.2).add(new THREE.Vector3(0, 1.4, 0)), look: P.clone().add(new THREE.Vector3(0, 1.35, 0)), fov: 45 })),
  },
  c11: {
    t: 15.3,
    setup: () => {
      // airborne half-way from the ledge to the landing point
      const L = cave.ledge, T = leapTarget();
      yeti.setVisible(true);
      yeti.root.position.set((L.x + T.x) / 2, Math.max(L.y, T.y) + 2.2, (L.z + T.z) / 2);
      yeti.root.rotation.set(0, Math.atan2(T.x - L.x, T.z - L.z), 0);
      poseYeti('leap', 0.4, 6);
      skier.update(1 / 30, skierPose(1));
    },
    subject: 'yeti',
    pose: () => {
      const cam = P.clone().addScaledVector(downhill, -2.6).addScaledVector(toCave, -1.6).add(new THREE.Vector3(0, 1.8, 0));
      return { pos: cam, look: yeti.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)), fov: 36 };
    },
  },
  c12: {
    t: 16.4,
    setup: () => {
      const T = leapTarget();
      yeti.setVisible(true);
      yeti.root.position.copy(T);
      yeti.root.rotation.set(0, Math.atan2(P.x - T.x, P.z - T.z), 0);
      poseYeti('run', 0.6, 8);
      skier.update(1 / 30, skierPose(0));
    },
    subject: 'skier',
    ...still(() => ({ pos: P.clone().addScaledVector(downhill, -5).add(new THREE.Vector3(0, 3, 0)), look: P.clone().add(new THREE.Vector3(0, 1.2, 4)), fov: 58 })),
  },
};
const hideYeti = () => yeti.setVisible(params.get('yeti') === '1');
const view = (pose: () => Pose): Shot => ({ t: -1, setup: () => {
  hideYeti();
  if (params.get('yeti') === '1') {
    placeYeti(-2.2);
    poseYeti('stand', 1.0);
  }
}, subject: 'cave', pose });
const presets: Record<string, Shot> = {
  approach: view(() => {
    const z = anchor.z - 55, x = m.routeX(z);
    return { pos: new THREE.Vector3(x, m.heightAt(x, z) + 3.2, z), look: M.clone().add(new THREE.Vector3(0, 7, 0)), fov: 55 };
  }),
  front: view(() => ({ pos: at(M, 24, 3.0, 0.5), look: M.clone().add(new THREE.Vector3(0, 5, 0)), fov: 50 })),
  inside: view(() => ({ pos: at(M, 3.5, 2.0, 0.6), look: cave.deepStart.clone().add(new THREE.Vector3(0, 1.8, 0)), fov: 55 })),
  mouth: view(() => ({ pos: at(M, 9, 1.7, 1.5), look: M.clone().add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(O, -3), fov: 50 })),
  threequarter: view(() => ({ pos: at(M, 20, 6, 20), look: M.clone().add(new THREE.Vector3(0, 6, 0)), fov: 50 })),
  above: view(() => ({ pos: at(M, 38, 42, 18), look: M.clone().add(new THREE.Vector3(0, 6, 4)), fov: 50 })),
  closeup: view(() => ({ pos: at(M, 4.5, 2.2, -7.5), look: M.clone().add(new THREE.Vector3(0, 3.2, -3.5)), fov: 45 })),
  wide: view(() => ({ pos: at(M, 70, 14, 4), look: M.clone().add(new THREE.Vector3(0, 8, 4)), fov: 60 })),
  plan: view(() => ({ pos: M.clone().add(new THREE.Vector3(0, 140, 8)).addScaledVector(O, -6), look: M.clone().add(new THREE.Vector3(0, 0, 8)).addScaledVector(O, -6.01), fov: 45 })),
  side: view(() => ({ pos: at(M, 30, 12, 60), look: M.clone().add(new THREE.Vector3(0, 8, 10)), fov: 55 })),
  piste: view(() => ({ pos: P.clone().add(new THREE.Vector3(0, 1.7, -30)), look: M.clone().add(new THREE.Vector3(0, 6, 0)), fov: 60 })),
  ...shots,
};
presets['orbit'] = presets['threequarter']!;
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 6000);
let controls: OrbitControls | null = null;

/** Fraction of the subject's bounding box corners that project inside the frame (and in front of the camera). */
function subjectInFrame(sub: Shot['subject']): number {
  const box = new THREE.Box3();
  if (sub === 'yeti') box.setFromObject(yeti.root);
  else if (sub === 'skier') box.setFromObject(skier.root);
  else box.setFromCenterAndSize(M.clone().add(new THREE.Vector3(0, 3, 0)), new THREE.Vector3(6, 6, 6));
  camera.updateMatrixWorld();
  let inside = 0;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    if (v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) inside++;
  }
  return inside / 8;
}

function apply(name: string) {
  const sh = presets[name] ?? presets['threequarter']!;
  sh.setup();
  yeti.root.updateMatrixWorld(true);
  const p = sh.pose();
  camera.fov = p.fov;
  camera.position.copy(p.pos);
  camera.lookAt(p.look);
  camera.updateProjectionMatrix();
  const f = subjectInFrame(sh.subject);
  window.__inFrame = { name, subject: sh.subject, fraction: f };
  return p;
}
const pose0 = apply(camName);
if (camName === 'orbit') {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(pose0.look);
  controls.update();
}

const info = document.getElementById('info')!;
if (params.get('info') !== '0') {
  const s = cave.stats;
  info.textContent = `cam=${camName}  q=${quality}  build ${s.ms.toFixed(0)} ms  tris ${s.triangles}  draws ${s.drawCalls}`;
} else info.style.display = 'none';

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// batch capture hook: switch preset in place (the terrain/cave are built once)
window.__setCam = (name: string) => {
  apply(name);
  if (params.get('info') !== '0') info.textContent = `cam=${name}  q=${quality}  build ${cave.stats.ms.toFixed(0)} ms  tris ${cave.stats.triangles}`;
  return new Promise<void>((res) => {
    let n = 0;
    const f = () => (++n >= 3 ? res() : requestAnimationFrame(f));
    requestAnimationFrame(f);
  });
};

let frames = 0;
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  controls?.update();
  env.update(dt, M, camera.position, 0);
  renderer.render(scene, camera);
  if (++frames === 3) window.__ready = true;
  requestAnimationFrame(frame);
}
frame();
