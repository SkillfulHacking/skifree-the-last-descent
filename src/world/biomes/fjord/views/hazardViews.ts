/**
 * Views for the Fjord hazards (driven on the physics clock by HazardLayer).
 *
 *  - sea-gust: an orange-and-white windsock on a pole beside the jump (it hangs limp when calm,
 *    lifts during the telegraph and streams flat while the squall blows) plus spindrift streamers
 *    racing across the jump, sparse in the build-up and dense in the gust. Readable at speed and in
 *    the rear-view; the same cue as the 'gust-build' sound.
 *  - scoured-rock: a wind-scoured outcrop sitting in the snow: dark polished rock and blue ice glaze
 *    in the core, low chamfered rock ribs breaking through along the wind grain with snow tails in
 *    their lee, gravel, and a wind-crust rim that fades into the slope — reads as "no snow here"
 *    from 100 m away.
 */
import * as THREE from 'three';
import { registerHazardView, type HazardView } from '../../../presentation/hazardViews';
import type { HazardInstance, HazardPhaseState } from '../../../hazards/hazard';
import type { Mountain } from '../../../course';
import { softParticle } from '../../../resort/textures';

let shared: { pole: THREE.Material; sock: THREE.Material; rock: THREE.Material; skin: THREE.Material; stone: THREE.Material; drift: THREE.PointsMaterial; tex: THREE.Texture } | null = null;
function mats() {
  if (shared) return shared;
  const tex = softParticle();
  shared = {
    pole: new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 }),
    sock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }),
    // ground skin: vertex alpha fades the rim into the snow; pulled toward the camera in depth
    // instead of lifted, so it hugs the terrain at every LOD
    skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9, flatShading: true }),
    drift: new THREE.PointsMaterial({ size: 2.2, map: tex, color: 0xf4f8ff, transparent: true, opacity: 0.0, depthWrite: false, sizeAttenuation: true }),
    tex,
  };
  return shared;
}

function windsockGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.62, 0.26, 3.4, 12, 5, true);
  g.rotateZ(-Math.PI / 2);
  g.translate(1.7, 0, 0);
  const P = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const band = Math.floor((P.getX(i) / 3.4) * 5 - 1e-3);
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
  const px = h.x - h.r * 0.6 - 1.5;
  const pz = h.z - 8;
  const py = m.heightAt(px, pz);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7.2, 6), M.pole);
  pole.position.set(px, py + 3.6, pz);
  pole.castShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 16).rotateY(Math.PI / 2), M.stone);
  const pivot = new THREE.Group();
  pivot.position.set(px, py + 6.9, pz);
  pivot.add(ring);
  const sockGeo = windsockGeometry();
  const sock = new THREE.Mesh(sockGeo, M.sock);
  pivot.add(sock);
  obj.add(pole, pivot);
  // spindrift streamers crossing the jump
  const N = 120;
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
        const y = m.heightAt(x, z) + 0.3 + s2 * s2 * 4.5 + Math.sin(t * 3 + i) * 0.3;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
      }
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    },
    dispose() {
      pole.geometry.dispose();
      ring.geometry.dispose();
      sockGeo.dispose();
      geo.dispose();
      mat.dispose();
      obj.removeFromParent();
    },
  };
}

/** deterministic 0..1 hash */
function h01(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * A wind-scoured outcrop (round 2, art review D8): instead of a draped polygon with cubes on it,
 * the patch is (1) a dense ground skin that follows the terrain closely (many samples, polygon
 * offset rather than a lift, so it can neither float nor sink), whose colour runs from dark
 * polished gneiss and blue wind-glazed ice in the core through gravel to wind-crust and drifted
 * snow at a ragged edge that fades into the slope (vertex alpha), and (2) a few low, flat-topped,
 * chamfered rock ribs breaking through along the wind grain (+x), half-buried, never more than
 * ~0.35 m proud (skis pass over them: the hazard only adds friction), with snow tails in their lee.
 */
function rockView(h: HazardInstance<{ v: number }>, m: Mountain): HazardView {
  const M = mats();
  const obj = new THREE.Group();
  obj.name = 'scoured-rock';
  const rings = 12;
  const segs = 44;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const v = h.params.v;
  const rr = (a: number) => h.r * (1.08 + 0.16 * Math.sin(a * 3 + v) + 0.09 * Math.sin(a * 7 + h.seed) + 0.05 * Math.sin(a * 13 + v * 2));
  const tone = (x: number, z: number) => {
    const n1 = 0.5 + 0.5 * Math.sin(x * 1.3 + z * 0.4 + v) * Math.cos(z * 1.1 - x * 0.35);
    const n2 = 0.5 + 0.5 * Math.sin(x * 4.1 - z * 3.3 + h.seed) * Math.sin(z * 5.3 + x * 0.9);
    return { n1, n2 };
  };
  const c = new THREE.Color();
  const push = (x: number, z: number, k: number) => {
    pos.push(x, m.heightAt(x, z) + 0.02, z);
    const { n1, n2 } = tone(x, z);
    // core → rim: gneiss / ice glaze → gravel → wind crust → snow
    const rock = new THREE.Color(0.07 + 0.06 * n2, 0.075 + 0.06 * n2, 0.085 + 0.065 * n2);
    const ice = new THREE.Color(0.42, 0.55, 0.66);
    const gravel = new THREE.Color(0.24 + 0.08 * n2, 0.235 + 0.08 * n2, 0.23 + 0.07 * n2);
    const crust = new THREE.Color(0.74, 0.8, 0.88);
    c.copy(rock).lerp(ice, Math.max(0, n1 - 0.62) * 1.6 * (1 - k));
    c.lerp(gravel, Math.min(1, Math.max(0, (k - 0.45 + 0.2 * (n2 - 0.5)) / 0.25)));
    c.lerp(crust, Math.min(1, Math.max(0, (k - 0.72 + 0.15 * (n1 - 0.5)) / 0.2)));
    const a = 1 - Math.min(1, Math.max(0, (k - 0.82) / 0.18));
    col.push(c.r, c.g, c.b, a);
  };
  push(h.x, h.z, 0);
  for (let r = 1; r <= rings; r++)
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2 + h.rot;
      const k = r / rings;
      // a little radial jitter so the rings never read as contour lines
      const kj = Math.min(1, k + (h01(r + v, s) - 0.5) * 0.04 * (r < rings ? 1 : 0));
      push(h.x + Math.cos(a) * rr(a) * kj, h.z + Math.sin(a) * rr(a) * kj, kj);
    }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++)
    for (let s = 0; s < segs; s++) {
      const a = 1 + (r - 1) * segs + s;
      const b = 1 + (r - 1) * segs + ((s + 1) % segs);
      idx.push(a, b, b + segs, a, b + segs, a + segs);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const skin = new THREE.Mesh(g, M.skin);
  skin.receiveShadow = true;
  skin.renderOrder = 1;
  obj.add(skin);

  // rock ribs breaking through along the wind grain, half-buried
  const ribs: THREE.BufferGeometry[] = [];
  const nRib = 4 + (v % 3);
  for (let i = 0; i < nRib; i++) {
    const a = h.rot + i * 2.39996 + v;
    const d = h.r * (0.12 + 0.55 * h01(i, v + 3));
    const x = h.x + Math.cos(a) * d;
    const z = h.z + Math.sin(a) * d;
    const L = 1.6 + 2.6 * h01(i + 7, v);
    const W = 0.55 + 0.7 * h01(i + 11, v);
    const T = 0.22 + 0.16 * h01(i + 13, v);
    const box = new THREE.BoxGeometry(L, T * 2.4, W, 6, 2, 3);
    const P = box.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < P.count; k++) {
      const px = P.getX(k);
      const py = P.getY(k);
      const pz = P.getZ(k);
      // chamfer the top edges, taper the ends, rough the faces
      const ex = Math.abs(px) / (L / 2);
      const ez = Math.abs(pz) / (W / 2);
      const top = py > 0 ? 1 - 0.45 * Math.max(0, ez - 0.4) - 0.6 * Math.pow(Math.max(0, ex - 0.55), 1.5) : 1;
      const j = 0.06 * (h01(px * 3.1 + i, pz * 2.7 + v) - 0.5);
      P.setXYZ(k, px * (1 - 0.18 * Math.max(0, py) / T), py * top + j, pz * (1 - 0.3 * Math.pow(ex, 3)));
    }
    box.computeVertexNormals();
    const yaw = 0.25 * (h01(i + 17, v) - 0.5); // along the wind (+x) with a little scatter
    box.rotateY(yaw);
    box.rotateZ(0.08 * (h01(i + 19, v) - 0.5));
    // seat: the lowest terrain point under the rib, minus the buried part (~60 %)
    let gy = Infinity;
    for (const sx of [-L / 2, 0, L / 2]) for (const sz of [-W / 2, W / 2]) gy = Math.min(gy, m.heightAt(x + sx * Math.cos(yaw), z - sx * Math.sin(yaw) + sz));
    box.translate(x, gy - T * 0.2, z);
    ribs.push(box);
    // a snow tail in the rib's lee (downwind, +x)
    const tail = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    tail.scale(L * 0.6, 0.16, W * 0.45);
    tail.translate(x + L * 0.75, m.heightAt(x + L * 0.75, z) - 0.04, z);
    const TP = tail.attributes.position as THREE.BufferAttribute;
    const tc = new Float32Array(TP.count * 3).fill(0.9);
    tail.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    ribs.push(tail);
  }
  // gravel: small angular stones scattered in the gravel ring
  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.16, 0), M.stone, 26);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) {
    const a = h.rot + i * 2.4 + v;
    const d = h.r * (0.35 + 0.55 * h01(i + 23, v));
    const x = h.x + Math.cos(a) * d;
    const z = h.z + Math.sin(a) * d;
    const s = 0.6 + 1.4 * h01(i + 29, v);
    mm.compose(new THREE.Vector3(x, m.heightAt(x, z) + 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 2, 0)), new THREE.Vector3(s, s * 0.55, s));
    stones.setMatrixAt(i, mm);
  }
  stones.castShadow = true;
  obj.add(stones);
  const ribColored = ribs.map((r) => {
    if (r.getAttribute('color')) return r.index ? r.toNonIndexed() : r;
    const n = r.index ? r.toNonIndexed() : r;
    const P = n.attributes.position as THREE.BufferAttribute;
    const cc = new Float32Array(P.count * 3);
    for (let k = 0; k < P.count; k++) {
      const t = 0.11 + 0.08 * h01(P.getX(k) * 0.7, P.getZ(k) * 0.9);
      cc.set([t, t * 1.04, t * 1.12], k * 3);
    }
    n.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    return n;
  });
  const merged = mergeSimple(ribColored);
  for (const r of ribs) r.dispose();
  for (const r of ribColored) r.dispose();
  const ribMesh = new THREE.Mesh(merged, M.rock);
  ribMesh.castShadow = true;
  ribMesh.receiveShadow = true;
  obj.add(ribMesh);
  return {
    object: obj,
    dispose() {
      g.dispose();
      merged.dispose();
      stones.geometry.dispose();
      stones.dispose();
      obj.removeFromParent();
    },
  };
}

/** concatenate non-indexed geometries with position/normal/color */
function mergeSimple(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  for (const raw of list) {
    const gg = raw.index ? raw.toNonIndexed() : raw;
    if (!gg.getAttribute('normal')) gg.computeVertexNormals();
    pos.push(...(gg.attributes.position as THREE.BufferAttribute).array);
    nor.push(...(gg.attributes.normal as THREE.BufferAttribute).array);
    col.push(...(gg.attributes.color as THREE.BufferAttribute).array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

registerHazardView('sea-gust', (h, ctx) => gustView(h, ctx.mountain));
registerHazardView('scoured-rock', (h, ctx) => rockView(h as HazardInstance<{ v: number }>, ctx.mountain));
