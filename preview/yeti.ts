/**
 * Yeti preview harness.
 * URL params: mode=<YetiMode> t=<s into mode> speed=<m/s> turn=<-1..1> cam=front|side|threequarter|face|back|low
 *             quality=low|medium|high|ultra glow=<0..1> from=<YetiMode> (cross-fade test: plays `from` for 1 s first)
 *             dark=1 (night lighting for the eye-glow reveal)
 */
import * as THREE from 'three';
import { YetiModel } from '../src/yeti/YetiModel';
import type { QualityPreset, YetiMode } from '../src/core/types';

declare global {
  interface Window {
    __ready?: boolean;
    __yeti?: YetiModel;
    __renderer?: THREE.WebGLRenderer;
  }
}

console.log(`script start ${performance.now().toFixed(0)} ms`);
const q = new URLSearchParams(location.search);
const mode = (q.get('mode') ?? 'stand') as YetiMode;
const T = parseFloat(q.get('t') ?? '2');
const speed = parseFloat(q.get('speed') ?? (mode === 'run' ? '10' : mode === 'walk' || mode === 'turnAway' ? '2.5' : mode === 'emerge' ? '1.4' : '0'));
const turn = parseFloat(q.get('turn') ?? '0');
const camName = q.get('cam') ?? 'threequarter';
const quality = (q.get('quality') ?? 'high') as QualityPreset;
const glow = parseFloat(q.get('glow') ?? '0');
const from = q.get('from') as YetiMode | null;
const dark = q.get('dark') === '1';
const strip = Math.max(1, parseInt(q.get('strip') ?? '1', 10));
const stripStep = parseFloat(q.get('step') ?? '0.15');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = dark ? 0.9 : 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
window.__renderer = renderer;

const scene = new THREE.Scene();
scene.background = new THREE.Color(dark ? 0x05070b : 0x8fc3ea);
scene.fog = new THREE.Fog(scene.background.getHex(), 18, 60);

const hemi = new THREE.HemisphereLight(0xcfe3ff, 0xe8eef8, dark ? 0.05 : 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1df, dark ? 0.05 : 3.0);
sun.position.set(5, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -4;
sun.shadow.camera.right = 4;
sun.shadow.camera.top = 5;
sun.shadow.camera.bottom = -2;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 30;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

// snow ground with gentle procedural undulation
const groundGeo = new THREE.PlaneGeometry(80, 80, 120, 120);
groundGeo.rotateX(-Math.PI / 2);
const gp = groundGeo.getAttribute('position');
for (let i = 0; i < gp.count; i++) {
  const x = gp.getX(i);
  const z = gp.getZ(i);
  const r = Math.hypot(x, z);
  const h = r < 3 ? 0 : (Math.sin(x * 0.35) * Math.cos(z * 0.27) * 0.25 + Math.sin(x * 1.3 + z) * 0.04) * Math.min(1, (r - 3) / 4);
  gp.setY(i, h);
}
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.85 }));
ground.receiveShadow = true;
scene.add(ground);

const tBuild = performance.now();
const yetis: YetiModel[] = [];
let footsteps = 0;
const printMat = new THREE.MeshBasicMaterial({ color: 0x9fb4cc, transparent: true, opacity: 0.6, depthWrite: false });
const printGeo = new THREE.CircleGeometry(0.12, 16).rotateX(-Math.PI / 2);
const dt = 1 / 60;
for (let k = 0; k < strip; k++) {
  const yeti = new YetiModel({ quality });
  yetis.push(yeti);
  scene.add(yeti.root);
  // strips: lined up along Z (side camera) or X (front camera)
  const off = (k - (strip - 1) / 2) * 3.1;
  if (camName === 'front') yeti.root.position.x = off;
  else yeti.root.position.z = -off;
  yeti.setEyeGlow(glow);
  if (q.get('nofur') === '1') yeti.setFurVisible(false);
  yeti.onFootstep = (_side, pos, strength) => {
    footsteps++;
    const m = new THREE.Mesh(printGeo, printMat);
    m.position.copy(pos);
    m.position.y = 0.005;
    m.scale.setScalar(0.6 + strength);
    m.visible = q.get('prints') === '1';
    scene.add(m);
  };
  // deterministic simulation; the root stays put (in game it is translated by the game)
  let time = 0;
  if (from) {
    for (let i = 0; i < 60; i++) {
      time += dt;
      yeti.update(dt, { mode: from, modeTime: i * dt, speed, turn, time });
    }
  }
  const steps = Math.round((T + k * stripStep) / dt);
  for (let i = 0; i <= steps; i++) {
    yeti.update(i === 0 && !from ? 0 : dt, { mode, modeTime: i * dt, speed, turn, time });
    time += dt;
  }
}
console.log(`build+sim ${(performance.now() - tBuild).toFixed(0)} ms`);
const yeti = yetis[Math.floor((strip - 1) / 2)];
window.__yeti = yeti;
const widen = strip > 1 ? 1 + (strip - 1) * 0.55 : 1;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 200);
const head = yeti.getHeadWorldPosition(new THREE.Vector3());
const target = yeti.root.position.clone().add(new THREE.Vector3(0, 1.55, 0.2));
switch (camName) {
  case 'front':
    camera.position.set(0, 1.7, 7.4 * widen);
    break;
  case 'side':
    camera.position.set(7.4 * widen, 1.7, 0.4);
    break;
  case 'back':
    camera.position.set(-2.5, 2.2, -6.5);
    break;
  case 'low':
    camera.position.set(1.4, 0.5, 4.2);
    target.set(0, 2.1, 0);
    break;
  case 'face': {
    camera.fov = 30;
    target.copy(head).add(new THREE.Vector3(0, -0.05, 0.1));
    camera.position.copy(head).add(new THREE.Vector3(0.5, 0.05, 1.35));
    break;
  }
  case 'face3q': {
    camera.fov = 30;
    target.copy(head).add(new THREE.Vector3(0, -0.05, 0.1));
    camera.position.copy(head).add(new THREE.Vector3(1.1, 0.0, 0.95));
    break;
  }
  case 'faceside': {
    camera.fov = 30;
    target.copy(head).add(new THREE.Vector3(0, -0.05, 0.1));
    camera.position.copy(head).add(new THREE.Vector3(1.45, 0.0, 0.1));
    break;
  }
  case 'threequarter':
  default:
    camera.position.set(4.6 * widen, 2.1, 5.6 * widen);
    break;
}
camera.lookAt(target);
camera.updateProjectionMatrix();

const info = document.getElementById('info');
if (info) info.textContent = `mode=${mode} t=${T} speed=${speed} turn=${turn} q=${quality} footsteps=${footsteps}`;

let frames = 0;
function frame(): void {
  const tr = performance.now();
  renderer.render(scene, camera);
  console.log(`frame ${frames} ${(performance.now() - tr).toFixed(0)} ms at ${performance.now().toFixed(0)}`);
  frames++;
  if (frames === 2) {
    window.__ready = true;
    const i = renderer.info.render;
    if (info) info.textContent += ` calls=${i.calls} tris=${i.triangles}`;
  }
  if (frames < 2) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
