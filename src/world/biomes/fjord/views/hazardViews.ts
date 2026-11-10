/**
 * Views for the Fjord hazards (driven on the physics clock by HazardLayer).
 *
 *  - sea-gust: an orange-and-white windsock on a pole beside the jump (it hangs limp when calm,
 *    lifts during the telegraph and streams flat while the squall blows) plus spindrift streamers
 *    racing across the jump, sparse in the build-up and dense in the gust. Readable at speed and in
 *    the rear-view; the same cue as the 'gust-build' sound.
 *  - scoured-rock: a dark patch of wind-scoured rock slabs and gravel flush with the snow, with a
 *    few loose stones on it — reads as "no snow here" from 100 m away.
 */
import * as THREE from 'three';
import { registerHazardView, type HazardView } from '../../../presentation/hazardViews';
import type { HazardInstance, HazardPhaseState } from '../../../hazards/hazard';
import type { Mountain } from '../../../course';
import { softParticle } from '../../../resort/textures';

let shared: { pole: THREE.Material; sock: THREE.Material; rock: THREE.Material; stone: THREE.Material; drift: THREE.PointsMaterial; tex: THREE.Texture } | null = null;
function mats() {
  if (shared) return shared;
  const tex = softParticle();
  shared = {
    pole: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 }),
    sock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9, flatShading: true }),
    drift: new THREE.PointsMaterial({ size: 0.9, map: tex, color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, sizeAttenuation: true }),
    tex,
  };
  return shared;
}

function windsockGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.42, 0.18, 2.2, 12, 5, true);
  g.rotateZ(-Math.PI / 2);
  g.translate(1.1, 0, 0);
  const P = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const band = Math.floor((P.getX(i) / 2.2) * 5 - 1e-3);
    const c = new THREE.Color(band % 2 ? 0xf4f1ea : 0xe8561e);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function gustView(h: HazardInstance, m: Mountain): HazardView {
  const M = mats();
  const obj = new THREE.Group();
  obj.name = 'sea-gust';
  // windsock on a pole at the side of the jump (upwind side: the sea, −x)
  const px = h.x - h.r * 0.75 - 2;
  const pz = h.z - 6;
  const py = m.heightAt(px, pz);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.2, 6), M.pole);
  pole.position.set(px, py + 2.6, pz);
  pole.castShadow = true;
  const pivot = new THREE.Group();
  pivot.position.set(px, py + 5.0, pz);
  const sockGeo = windsockGeometry();
  const sock = new THREE.Mesh(sockGeo, M.sock);
  pivot.add(sock);
  obj.add(pole, pivot);
  // spindrift streamers crossing the jump
  const N = 70;
  const pos = new Float32Array(N * 3);
  const seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.sin(i * 12.9898 + h.seed) * 43758.5453;
    const u = a - Math.floor(a);
    const b2 = Math.sin(i * 78.233 + h.seed * 0.7) * 23421.631;
    const v = b2 - Math.floor(b2);
    seeds.set([u, v, (u * 7.3 + v * 3.1) % 1], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = M.drift.clone();
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  obj.add(pts);
  const ground = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const z = h.z - h.r + seeds[i * 3 + 1]! * h.r * 2;
    ground[i] = z;
  }
  let lift = 0;
  return {
    object: obj,
    update(ph: HazardPhaseState, t: number, dt: number) {
      const target = ph.phase === 'telegraph' ? 0.25 + 0.55 * ph.u : ph.phase === 'active' ? 1 : ph.phase === 'recovery' ? 1 - ph.u : 0.05;
      lift += (target - lift) * Math.min(1, dt * 5);
      // windsock: limp (hangs down) → streaming downwind (+x, inland)
      pivot.rotation.set(0, 0, -(1 - lift) * 1.35 + Math.sin(t * 7 + h.seed) * 0.06 * lift);
      sock.scale.set(1, 0.75 + 0.25 * lift, 0.75 + 0.25 * lift);
      // streamers
      const density = ph.phase === 'active' ? 1 : ph.phase === 'telegraph' ? 0.35 * ph.u : ph.phase === 'recovery' ? 0.6 * (1 - ph.u) : 0;
      mat.opacity = 0.75 * density;
      pts.visible = density > 0.01;
      if (!pts.visible) return;
      const span = h.r * 2.6;
      for (let i = 0; i < N; i++) {
        const s0 = seeds[i * 3]!;
        const s2 = seeds[i * 3 + 2]!;
        const x = h.x - span / 2 + (((s0 * span + t * (11 + 7 * s2)) % span) + span) % span;
        const z = ground[i]!;
        const y = m.heightAt(x, z) + 0.2 + s2 * 1.8 + Math.sin(t * 3 + i) * 0.2;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
      }
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    },
    dispose() {
      pole.geometry.dispose();
      sockGeo.dispose();
      geo.dispose();
      mat.dispose();
      obj.removeFromParent();
    },
  };
}

function rockView(h: HazardInstance<{ v: number }>, m: Mountain): HazardView {
  const M = mats();
  const obj = new THREE.Group();
  obj.name = 'scoured-rock';
  // irregular slab patch conforming to the terrain
  const rings = 5;
  const segs = 28;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const rr = (a: number) => h.r * (0.82 + 0.18 * Math.sin(a * 3 + h.params.v) + 0.08 * Math.sin(a * 7 + h.seed));
  pos.push(h.x, m.heightAt(h.x, h.z) + 0.07, h.z);
  col.push(0.09, 0.095, 0.105);
  for (let r = 1; r <= rings; r++)
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2 + h.rot;
      const k = r / rings;
      const x = h.x + Math.cos(a) * rr(a) * k;
      const z = h.z + Math.sin(a) * rr(a) * k;
      pos.push(x, m.heightAt(x, z) + 0.07 - (r === rings ? 0.06 : 0), z);
      const n = 0.5 + 0.5 * Math.sin(x * 1.7 + z * 2.3) * Math.cos(x * 0.6 - z * 1.1);
      // dark gneiss slabs, lighter gravel, a dusting of snow at the rim
      const snow = r === rings ? 0.75 : r === rings - 1 ? 0.25 * n : 0;
      const g = 0.08 + 0.1 * n;
      col.push(g + (0.85 - g) * snow, g * 1.03 + (0.88 - g) * snow, g * 1.12 + (0.94 - g) * snow);
    }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++)
    for (let s = 0; s < segs; s++) {
      const a = 1 + (r - 1) * segs + s;
      const b = 1 + (r - 1) * segs + ((s + 1) % segs);
      const c = a + segs;
      const d = b + segs;
      idx.push(a, b, d, a, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const patch = new THREE.Mesh(g, M.rock);
  patch.receiveShadow = true;
  obj.add(patch);
  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.35, 0), M.stone, 10);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < 10; i++) {
    const a = h.rot + i * 2.4;
    const d = h.r * (0.2 + 0.6 * ((i * 0.37) % 1));
    const x = h.x + Math.cos(a) * d;
    const z = h.z + Math.sin(a) * d;
    const s = 0.5 + ((i * 0.53) % 1) * 1.1;
    mm.compose(new THREE.Vector3(x, m.heightAt(x, z) + 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 2, 0)), new THREE.Vector3(s, s * 0.6, s));
    stones.setMatrixAt(i, mm);
  }
  stones.castShadow = true;
  obj.add(stones);
  return {
    object: obj,
    dispose() {
      g.dispose();
      stones.geometry.dispose();
      stones.dispose();
      obj.removeFromParent();
    },
  };
}

registerHazardView('sea-gust', (h, ctx) => gustView(h, ctx.mountain));
registerHazardView('scoured-rock', (h, ctx) => rockView(h as HazardInstance<{ v: number }>, ctx.mountain));
