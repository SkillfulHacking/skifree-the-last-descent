import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SkierModel } from '../src/player/SkierModel';
import type { QualityPreset, SkierPose } from '../src/core/types';

declare global {
  interface Window {
    __ready?: boolean;
  }
}

const params = new URLSearchParams(location.search);
const poseName = params.get('pose') ?? 'neutral';
const camName = params.get('cam') ?? 'threequarter';
const quality = (params.get('q') ?? 'ultra') as QualityPreset;
const animate = params.get('anim') === '1';
const tParam = params.get('t');
const recoverParam = params.get('recover');
const zoom = Number(params.get('zoom') ?? '1');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9f0);
scene.fog = new THREE.Fog(0x8ec9f0, 25, 80);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xf4f6fa, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e2, 2.6);
sun.position.set(4, 7, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -3;
sun.shadow.camera.right = 3;
sun.shadow.camera.top = 3;
sun.shadow.camera.bottom = -3;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 20;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const snow = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0xf7f9fc, roughness: 0.92 }),
);
snow.rotation.x = -Math.PI / 2;
snow.receiveShadow = true;
scene.add(snow);

const skier = new SkierModel({
  quality,
  jacketColor: params.get('jacket') ? parseInt(params.get('jacket') as string, 16) : undefined,
});
scene.add(skier.root);
if (params.get('yaw')) skier.root.rotation.y = Number(params.get('yaw'));

// trophy stand-in parented to the socket for the celebrate pose
const trophy = new THREE.Group();
{
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b830, metalness: 1, roughness: 0.25 });
  const cup = new THREE.Mesh(new THREE.LatheGeometry([0, 0.02, 0.05, 0.06, 0.065].map((r, k) => new THREE.Vector2(r + 0.001, 0.08 + k * 0.03)), 16), gold);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.08, 10), gold);
  stem.position.y = 0.04;
  cup.castShadow = stem.castShadow = true;
  trophy.add(cup, stem);
  trophy.position.y = 0.02;
}
if (poseName === 'celebrate') skier.rightHandSocket.add(trophy);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.05, 200);
const target = new THREE.Vector3(0, 0.85, 0.1);
const camPos: Record<string, [number, number, number]> = {
  side: [4.2, 1.1, 0.1],
  front: [0, 1.2, 4.4],
  back: [0, 1.6, -4.4],
  threequarter: [3.1, 1.6, 3.1],
  top: [0.01, 5.5, 0.4],
  low: [2.2, 0.35, 2.6],
  head: [0.6, 1.5, 1.1],
};
const cp = camPos[camName] ?? camPos.threequarter;
camera.position.set(cp[0] / zoom, cp[1], cp[2] / zoom).add(new THREE.Vector3(0, 0, 0));
if (camName === 'head') target.set(0, 1.35, 0.15);
if (poseName === 'crashed' || poseName === 'crash') target.set(0, 0.35, 0.2);
// free camera override: &cp=x,y,z&ct=x,y,z
if (params.get('cp')) camera.position.fromArray((params.get('cp') as string).split(',').map(Number));
if (params.get('ct')) target.fromArray((params.get('ct') as string).split(',').map(Number));
camera.lookAt(target);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.update();
controls.addEventListener('change', () => renderer.render(scene, camera));

function makePose(name: string, time: number): SkierPose {
  const p: SkierPose = {
    steer: 0, lean: 0, tuck: 0, pizza: 0, drift: 0, driftAngle: 0, crouch: 0, airborne: false, airTime: 0,
    landImpact: 0, crashed: false, crashTime: 0, recover: 0, speed: 12, lookBack: 0, celebrate: 0, wobble: 0, time,
  };
  switch (name) {
    case 'carveL':
      p.steer = -1;
      p.lean = -0.55;
      p.speed = 18;
      break;
    case 'carveR':
      p.steer = 1;
      p.lean = 0.55;
      p.speed = 18;
      break;
    case 'tuck':
      p.tuck = 1;
      p.speed = 28;
      break;
    case 'pizza':
      p.pizza = 1;
      p.speed = 5;
      break;
    case 'drift':
      p.drift = 1;
      p.driftAngle = 1.1;
      p.lean = 0.15;
      p.speed = 10;
      break;
    case 'crouch':
      p.crouch = 1;
      break;
    case 'air':
      p.airborne = true;
      p.airTime = 0.8;
      break;
    case 'land':
      p.landImpact = 1;
      break;
    case 'crash':
      p.crashed = true;
      p.crashTime = 0.5;
      p.lean = 0.3;
      break;
    case 'crashed':
      p.crashed = true;
      p.crashTime = 3;
      p.lean = 0.3;
      break;
    case 'recover':
      p.crashed = true;
      p.crashTime = 4;
      p.recover = 0.5;
      break;
    case 'celebrate':
      p.celebrate = 1;
      p.speed = 0;
      break;
    case 'lookback':
      p.lookBack = 1.3;
      break;
    case 'wobble':
      p.wobble = 1;
      break;
  }
  if (tParam !== null && p.crashed) p.crashTime = Number(tParam);
  if (recoverParam !== null) p.recover = Number(recoverParam);
  if (params.get('lean')) p.lean = Number(params.get('lean'));
  return p;
}

// animated demo: cycle through poses
const demo = ['neutral', 'carveL', 'carveR', 'tuck', 'pizza', 'drift', 'air', 'wobble', 'lookback', 'celebrate', 'crash'];
function demoPose(time: number): SkierPose {
  const slot = Math.floor(time / 3) % demo.length;
  const name = demo[slot];
  const p = makePose(name, time);
  const local = time % 3;
  if (name === 'crash') {
    p.crashTime = local;
    p.recover = 0;
  }
  if (name === 'air') p.airTime = local;
  if (name === 'carveL' || name === 'carveR') p.lean *= Math.min(1, local * 2);
  return p;
}

// debug markers for the public getters (&dbg=1)
const dbg = params.get('dbg') === '1';
const markers: THREE.Mesh[] = [];
if (dbg) {
  const colors = [0xff0000, 0xff0000, 0x00c000, 0x00c000, 0x0060ff, 0x0060ff];
  for (const c of colors) {
    const mk = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: c, depthTest: false }));
    mk.renderOrder = 10;
    scene.add(mk);
    markers.push(mk);
  }
  // exercise dispose on a second, shared-geometry instance
  const tmp = new SkierModel({ quality });
  tmp.update(1 / 60, makePose('neutral', 0));
  tmp.dispose();
}
function placeMarkers(): void {
  if (!dbg) return;
  skier.getSkiTipWorld('left', markers[0].position);
  skier.getSkiTipWorld('right', markers[1].position);
  skier.getSkiTailWorld('left', markers[2].position);
  skier.getSkiTailWorld('right', markers[3].position);
  skier.getHandWorldPosition('left', markers[4].position);
  skier.getHandWorldPosition('right', markers[5].position);
}

const info = document.getElementById('info') as HTMLDivElement;
let time = 0;
// let the internal smoothing settle before the screenshot
const settleFrames = animate ? 1 : 240;
for (let k = 0; k < settleFrames; k++) {
  time += 1 / 60;
  const p = animate ? demoPose(time) : makePose(poseName, time);
  // for the crash poses advance crashTime from 0 so the tumble starts properly
  if (!animate && p.crashed && tParam === null && poseName !== 'recover') {
    const target = p.crashTime;
    p.crashTime = Math.max(0, target - (settleFrames - 1 - k) / 60);
  }
  skier.update(1 / 60, p);
}

let frames = 0;
let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (animate) {
    time += dt;
    skier.update(dt, demoPose(time));
    if (Math.floor(time / 3) % demo.length === demo.indexOf('celebrate')) {
      if (!trophy.parent) skier.rightHandSocket.add(trophy);
    } else trophy.removeFromParent();
  }
  controls.update();
  placeMarkers();
  renderer.render(scene, camera);
  frames++;
  info.textContent = `pose=${poseName} cam=${camName} q=${quality} tris=${renderer.info.render.triangles} (model≈${skier.triangleCount}) calls=${renderer.info.render.calls}`;
  if (frames === 3) {
    window.__ready = true;
    if (!animate) renderer.setAnimationLoop(null);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
