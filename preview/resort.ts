/**
 * Visual harness for src/world/Resort.ts.
 * URL params: ?cam=wide|finish|hottub|podium|guests|crane|lodge|face&cheer=0..1&welcome=0..1&t=<seconds>&q=high|low
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Resort } from '../src/world/Resort';
import type { QualityPreset } from '../src/core/types';

declare global {
  interface Window {
    __ready?: boolean;
    __calls?: number;
  }
}

const params = new URLSearchParams(location.search);
const cam = params.get('cam') ?? 'wide';
const cheer = Number(params.get('cheer') ?? '0');
const welcome = Number(params.get('welcome') ?? '0');
const T = Number(params.get('t') ?? '2');
const quality = (params.get('q') ?? 'high') as QualityPreset;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyTop = new THREE.Color(0x4f86d0);
const skyHorizon = new THREE.Color(0xdbe8f6);
scene.fog = new THREE.Fog(skyHorizon, 90, 420);

// sky dome
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: skyTop }, hor: { value: skyHorizon } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(hor, top, smoothstep(0.0, 0.5, h)), 1.0); }',
  }),
);
scene.add(sky);

// environment from a tiny sky scene
{
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.add(sky.clone());
  const g = new THREE.Mesh(new THREE.CircleGeometry(800, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xeef3fa }));
  g.position.y = -5;
  es.add(g);
  scene.environment = pm.fromScene(es, 0.02).texture;
  scene.environmentIntensity = 0.55;
}

const heightAt = (x: number, z: number): number => -0.05 * Math.max(0, -z) + Math.sin(x * 0.05) * 0.3 + Math.cos(z * 0.04) * 0.2;

// terrain
{
  const g = new THREE.PlaneGeometry(700, 700, 220, 220);
  g.rotateX(-Math.PI / 2);
  const P = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i);
    const z = P.getZ(i) + 100;
    P.setXYZ(i, x, heightAt(x, z), z);
  }
  g.computeVertexNormals();
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = 238 + Math.random() * 14;
    img.data[i * 4] = v - 3;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(160, 160);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, color: 0xf4f7fc, roughness: 0.95 }));
  m.receiveShadow = true;
  scene.add(m);
}

// distant forest (context for the Yeti stop point)
{
  const cone = new THREE.ConeGeometry(2.2, 9, 7);
  cone.translate(0, 4.5, 0);
  const inst = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0x1d3527, roughness: 0.9 }), 260);
  const m = new THREE.Matrix4();
  let n = 0;
  let seed = 3;
  const r = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (n < 260) {
    const side = r() < 0.5 ? -1 : 1;
    const x = side * (62 + r() * 90);
    const z = -120 + r() * 300;
    if (side > 0 && z > 40 && z < 120 && x < 80) continue;
    const s = 0.7 + r() * 0.8;
    m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.3, z), new THREE.Quaternion(), new THREE.Vector3(s, s * (0.9 + r() * 0.5), s));
    inst.setMatrixAt(n++, m);
  }
  inst.castShadow = true;
  inst.receiveShadow = true;
  scene.add(inst);
  // behind the lodge
  for (let i = 0; i < 0; i++) void i;
}

// lights
const hemi = new THREE.HemisphereLight(0xcfe2ff, 0xf2f5fb, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 3.0);
sun.position.set(-70, 90, -40);
sun.target.position.set(5, 0, 55);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -85;
sc.right = 85;
sc.top = 85;
sc.bottom = -85;
sc.near = 10;
sc.far = 300;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const t0 = performance.now();
const resort = new Resort({ quality, heightAt, finishCenter: new THREE.Vector3(0, heightAt(0, 0), 0) });
scene.add(resort.group);
const buildMs = performance.now() - t0;

// skier stand-in at the stop point
const stop = resort.getStopPoint(new THREE.Vector3());
const skier = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 4, 10), new THREE.MeshStandardMaterial({ color: 0xd92d20 }));
skier.position.copy(stop).add(new THREE.Vector3(0, 0.85, 0));
skier.castShadow = true;
scene.add(skier);
const yeti = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 1.6, 4, 10), new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 1 }));
yeti.position.copy(resort.getYetiStopPoint(new THREE.Vector3())).add(new THREE.Vector3(0, 1.6, 0));
scene.add(yeti);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
const tub = resort.getHotTubCenter(new THREE.Vector3());
const pod = resort.getPodiumTop(new THREE.Vector3());
const shots: Record<string, [THREE.Vector3, THREE.Vector3, number?]> = {
  wide: [new THREE.Vector3(-34, 20, -30), new THREE.Vector3(8, 3, 52)],
  finish: [new THREE.Vector3(2, 2.4, -24), new THREE.Vector3(2, 4.2, 12)],
  hottub: [tub.clone().add(new THREE.Vector3(-3.6, 1.0, -4.6)), tub.clone().add(new THREE.Vector3(0, 0.6, 0)), 45],
  podium: [pod.clone().add(new THREE.Vector3(2.5, 0.6, -7.5)), pod.clone().add(new THREE.Vector3(0, 0.5, 0)), 45],
  guests: [new THREE.Vector3(2.5, 1.9, 33), new THREE.Vector3(8.4, 1.3, 40.5), 40],
  guestsB: [new THREE.Vector3(-1.5, 1.8, 36.5), new THREE.Vector3(-5.2, 1.2, 42.4), 40],
  face: [new THREE.Vector3(5.5, 1.65, 36.2), new THREE.Vector3(7.4, 1.55, 38.9), 22],
  fire: [new THREE.Vector3(-1.5, 1.7, 55.0), new THREE.Vector3(3, 0.9, 61), 45],
  crane: [new THREE.Vector3(-6, 46, -18), new THREE.Vector3(10, 0, 62)],
  lodge: [new THREE.Vector3(-6, 6, 44), new THREE.Vector3(24, 6, 74)],
  deck: [tub.clone().add(new THREE.Vector3(-6, 2.2, -7)), tub.clone().add(new THREE.Vector3(8, 1.5, 3)), 50],
  yeti: [new THREE.Vector3(6, 4, 30), resort.getYetiStopPoint(new THREE.Vector3()).add(new THREE.Vector3(0, 2, 0))],
};
if (params.has('from') && params.has('at')) {
  const f = params.get('from')!.split(',').map(Number);
  const a = params.get('at')!.split(',').map(Number);
  shots.custom = [new THREE.Vector3(f[0], f[1], f[2]), new THREE.Vector3(a[0], a[1], a[2]), Number(params.get('fov') ?? '35')];
}
const shot = shots[params.has('from') ? 'custom' : cam] ?? shots.wide!;
camera.position.copy(shot[0]);
camera.fov = shot[2] ?? 50;
camera.updateProjectionMatrix();
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(shot[1]);
controls.update();

const lookAt = cheer > 0 || welcome > 0 || params.has('look') ? skier.position.clone().setY(stop.y) : null;
const state = { cheer, lookAt, welcome };
const dt = 1 / 30;
let time = 0;
while (time < T) {
  resort.update(dt, time, state);
  time += dt;
}

renderer.render(scene, camera);
const info = document.getElementById('info')!;
const calls = renderer.info.render.calls;
window.__calls = calls;
info.textContent = `cam=${cam} cheer=${cheer} welcome=${welcome} t=${T.toFixed(1)} | draw calls ${calls} | tris ${renderer.info.render.triangles} | build ${buildMs.toFixed(0)}ms | colliders ${resort.colliders().length}`;
let guestTris = 0;
let staticTris = 0;
resort.group.traverse((o) => {
  if (o instanceof THREE.SkinnedMesh) guestTris += o.geometry.attributes.position!.count / 3;
  else if (o instanceof THREE.Mesh) staticTris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position!.count) / 3;
});
info.textContent += ` | guest tris ${guestTris} static tris ${staticTris}`;
console.log(info.textContent);
window.__ready = true;

let last = performance.now();
if (params.has('live')) renderer.setAnimationLoop(() => {
  const now = performance.now();
  const d = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += d;
  resort.update(d, time, state);
  renderer.render(scene, camera);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
