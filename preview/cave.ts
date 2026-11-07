/**
 * Visual harness for src/world/Cave.ts (the Yeti cave formation).
 * URL params:
 *   ?cam=approach|front|inside|threequarter|above|closeup|c1..c12|orbit   (c-presets = CaveCinematic shots)
 *   &debug=1  floor sample grid (green ≥ 4.2 m clearance, amber ≥ 3.6 m, red below), exit path, key points
 *   &yeti=1   a 3.3 m stand-in figure on the ledge (scale check)
 *   &q=low|medium|high|ultra   &res=0.5 (terrain grid metres)   &info=0 hides the overlay
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Mountain } from '../src/world/course';
import { createSnowMaterial } from '../src/world/snowMaterial';
import { Environment } from '../src/world/Environment';
import { Cave } from '../src/world/Cave';
import type { QualityPreset } from '../src/core/types';

declare global {
  interface Window {
    __ready?: boolean;
    __cave?: Cave;
    __setCam?: (name: string) => Promise<void>;
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
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = cx - size / 2 + i * res, z = cz - size / 2 + j * res;
      const k = (i + j * n) * 3;
      pos[k] = x;
      pos[k + 1] = m.heightAt(x, z);
      pos[k + 2] = z;
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
  g.setAttribute('aSurf', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, snowMat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);
}

const cave = new Cave(m, anchor, quality);
window.__cave = cave;
scene.add(cave.group);
if (debug) cave.setDebug(true);

const M = cave.mouth.clone();
const O = cave.outward.clone();
const at = (base: THREE.Vector3, ox: number, oy: number, oz: number) => base.clone().addScaledVector(O, ox).add(new THREE.Vector3(0, oy, oz));
const lerp = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
const pz = anchor.z + 22;
const P = new THREE.Vector3(m.routeX(pz), 0, pz);
P.y = m.heightAt(P.x, P.z);
const downhill = new THREE.Vector3(0, 0, 1);
const toCave = new THREE.Vector3(M.x - P.x, 0, M.z - P.z).normalize();

if (params.get('yeti') === '1' || camName === 'c5' || camName === 'c6' || camName === 'c7' || camName === 'c8' || camName === 'c9') {
  // a hunched 3.3 m stand-in (dark grey) so scale and clearance read in the shots
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 1 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 1.5, 6, 12), mat);
  const p = camName === 'c5' ? M.clone().addScaledVector(O, -2.2) : cave.ledge.clone();
  body.position.copy(p).add(new THREE.Vector3(0, 1.75, 0));
  body.castShadow = true;
  scene.add(body);
}

type Pose = { pos: THREE.Vector3; look: THREE.Vector3; fov: number };
const head = cave.ledge.clone().addScaledVector(O, 0.3).add(new THREE.Vector3(0, 3.0, 0));
const hand = M.clone().addScaledVector(O, -1.4).add(new THREE.Vector3(0, 2.4, -3.0));
const leapMid = (() => {
  const tx = m.centerX(anchor.z + 14) + 18 * anchor.side, tz = anchor.z + 14;
  const L = cave.ledge;
  return new THREE.Vector3((L.x + tx) / 2, L.y + 6.5 * 0.5 - 4.905 * 0.25, (L.z + tz) / 2);
})();
const presets: Record<string, () => Pose> = {
  approach: () => {
    const z = anchor.z - 55, x = m.routeX(z);
    return { pos: new THREE.Vector3(x, m.heightAt(x, z) + 3.2, z), look: M.clone().add(new THREE.Vector3(0, 7, 0)), fov: 55 };
  },
  front: () => ({ pos: at(M, 24, 3.0, 0.5), look: M.clone().add(new THREE.Vector3(0, 5, 0)), fov: 50 }),
  inside: () => ({ pos: at(M, 3.5, 2.0, 0.6), look: cave.deepStart.clone().add(new THREE.Vector3(0, 1.8, 0)), fov: 55 }),
  threequarter: () => ({ pos: at(M, 20, 6, 20), look: M.clone().add(new THREE.Vector3(0, 6, 0)), fov: 50 }),
  above: () => ({ pos: at(M, 38, 42, 18), look: M.clone().add(new THREE.Vector3(0, 6, 4)), fov: 50 }),
  closeup: () => ({ pos: at(M, 4.5, 2.2, -7.5), look: M.clone().add(new THREE.Vector3(0, 3.2, -3.5)), fov: 45 }),
  wide: () => ({ pos: at(M, 70, 14, 4), look: M.clone().add(new THREE.Vector3(0, 8, 4)), fov: 60 }),
  side: () => ({ pos: at(M, 30, 12, 60), look: M.clone().add(new THREE.Vector3(0, 8, 10)), fov: 55 }),
  c1: () => ({ pos: at(M, 30, 7, 14), look: M.clone().add(new THREE.Vector3(0, 5, 0)), fov: 42 }),
  c2: () => ({ pos: lerp(at(M, 24, 3.5, 9), at(M, 21, 3.2, 7), 0.5), look: cave.lipTop.clone().add(new THREE.Vector3(0, -0.5, 0)), fov: 40 }),
  c3: () => ({ pos: lerp(at(M, 12, 2.4, 1.5), at(M, 6.5, 2.3, 0.6), 0.5), look: cave.inside.clone().add(new THREE.Vector3(-1, 2.3, 0)), fov: 34 }),
  c4: () => ({ pos: at(M, 6.5, 2.3, 0.6), look: cave.inside.clone().add(new THREE.Vector3(-2, 2.4, 0)), fov: 30 }),
  c5: () => ({ pos: hand.clone().addScaledVector(O, 1.75).add(new THREE.Vector3(0, -0.5, -0.9)), look: hand.clone().add(new THREE.Vector3(0, -0.2, 0)), fov: 29 }),
  c6: () => ({ pos: lerp(at(M, 6.0, 1.5, 2.4), at(M, 5.2, 1.3, 2.0), 0.5), look: M.clone().add(new THREE.Vector3(-0.9, 2.6, 0)), fov: 49 }),
  c7: () => ({ pos: at(M, 5.2, 1.3, 2.0), look: M.clone().add(new THREE.Vector3(-1.0, 3.0, 0)), fov: 48 }),
  c8: () => ({ pos: at(M, 7.25, 0.55, 3.1), look: M.clone().add(new THREE.Vector3(-1.5, 3.1, 0)), fov: 45 }),
  c9: () => ({ pos: head.clone().addScaledVector(O, 2.35).add(new THREE.Vector3(0, -0.17, 0.8)), look: head, fov: 32 }),
  c10: () => ({ pos: P.clone().addScaledVector(downhill, 3.0).addScaledVector(toCave, -2.2).add(new THREE.Vector3(0, 1.4, 0)), look: P.clone().add(new THREE.Vector3(0, 1.35, 0)), fov: 46 }),
  c11: () => ({ pos: P.clone().addScaledVector(downhill, -2.6).addScaledVector(toCave, -1.6).add(new THREE.Vector3(0, 1.5, 0)), look: leapMid.clone().add(new THREE.Vector3(0, 1.6, 0)), fov: 34 }),
  c12: () => ({ pos: P.clone().addScaledVector(downhill, -5).add(new THREE.Vector3(0, 3, 0)), look: P.clone().add(new THREE.Vector3(0, 1.2, 4)), fov: 58 }),
};
presets['orbit'] = presets['threequarter']!;
const pose = (presets[camName] ?? presets['threequarter']!)();
const camera = new THREE.PerspectiveCamera(pose.fov, innerWidth / innerHeight, 0.1, 6000);
camera.position.copy(pose.pos);
camera.lookAt(pose.look);
let controls: OrbitControls | null = null;
if (camName === 'orbit') {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(pose.look);
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
  const p = (presets[name] ?? presets['threequarter']!)();
  camera.fov = p.fov;
  camera.position.copy(p.pos);
  camera.lookAt(p.look);
  camera.updateProjectionMatrix();
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
