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
 *  - gap-marker: banded poles and a pennant line at the lip of a spine's gap gully.
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
    skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -6 }),
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
  // the ground under the streamers, sampled once on a small grid (bilinear between samples)
  // instead of 120 terrain evaluations per frame
  const span = h.r * 2.6;
  const GX = 10;
  const GZ = 6;
  const gx0 = h.x - span / 2;
  const gz0 = h.z - h.r;
  const dx = span / (GX - 1);
  const dz = (2 * h.r) / (GZ - 1);
  const grid = new Float32Array(GX * GZ);
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) grid[j * GX + i] = m.heightAt(gx0 + i * dx, gz0 + j * dz);
  const groundAt = (x: number, z: number) => {
    const fx = Math.min(GX - 1.001, Math.max(0, (x - gx0) / dx));
    const fz = Math.min(GZ - 1.001, Math.max(0, (z - gz0) / dz));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const w = fz - j;
    const a = grid[j * GX + i]! + (grid[j * GX + i + 1]! - grid[j * GX + i]!) * u;
    const b = grid[(j + 1) * GX + i]! + (grid[(j + 1) * GX + i + 1]! - grid[(j + 1) * GX + i]!) * u;
    return a + (b - a) * w;
  };
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
      for (let i = 0; i < N; i++) {
        const s0 = seeds[i * 3]!;
        const s2 = seeds[i * 3 + 2]!;
        const x = h.x - span / 2 + (((s0 * span + t * (11 + 7 * s2)) % span) + span) % span;
        const z = ground[i]!;
        const y = groundAt(x, z) + 0.3 + s2 * s2 * 4.5 + Math.sin(t * 3 + i) * 0.3;
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
/**
 * The ground under a patch sampled once on a small grid (bilinear in between): the skin, ribs, tails
 * and stones drape over it with ~3× fewer terrain samples than sampling every vertex (round 2, D1:
 * a rock view used ~1,100 heightAt calls). 1.5 m cells keep the skin within a few cm of the snow,
 * which the skin's polygon offset absorbs.
 */
export function groundGrid(m: Mountain, cx: number, cz: number, R: number, cell = 1.5): (x: number, z: number) => number {
  const n = Math.ceil((2 * R) / cell) + 1;
  const x0 = cx - R;
  const z0 = cz - R;
  const g = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g[j * n + i] = m.heightAt(x0 + i * cell, z0 + j * cell);
  return (x: number, z: number) => {
    const u = Math.min(n - 1.0001, Math.max(0, (x - x0) / cell));
    const v = Math.min(n - 1.0001, Math.max(0, (z - z0) / cell));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    const a = g[j * n + i]!;
    const b = g[j * n + i + 1]!;
    const c = g[(j + 1) * n + i]!;
    const d = g[(j + 1) * n + i + 1]!;
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
  };
}

export function rockView(h: HazardInstance<{ v: number }>, m: Mountain): HazardView {
  const M = mats();
  // every draped vertex lies within 1.3 r (skin) or r + a rib/tail length of the centre
  const H = groundGrid(m, h.x, h.z, h.r * 1.4 + 3);
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
    pos.push(x, H(x, z) + 0.02, z);
    const { n1, n2 } = tone(x, z);
    // core → rim: gneiss / ice glaze → gravel → wind crust → snow
    // round 3 (A6, visual only): a darker, larger exposed core with lichen-stained patches and only
    // thin glaze, a narrow gravel ring — it reads as rock at 100+ m instead of a grey smudge
    const rock = new THREE.Color(0.03 + 0.04 * n2, 0.034 + 0.038 * n2, 0.04 + 0.045 * n2);
    if (n1 > 0.7) rock.lerp(new THREE.Color(0.09, 0.08, 0.045), (n1 - 0.7) * 2.2);
    const ice = new THREE.Color(0.42, 0.56, 0.66);
    const gravel = new THREE.Color(0.16 + 0.08 * n2, 0.16 + 0.08 * n2, 0.17 + 0.07 * n2);
    const crust = new THREE.Color(0.8, 0.85, 0.92);
    c.copy(rock).lerp(ice, Math.max(0, n1 - 0.8) * 1.5 * (1 - k));
    c.lerp(gravel, Math.min(1, Math.max(0, (k - 0.6 + 0.2 * (n2 - 0.5)) / 0.2)));
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
  const nRib = 6 + (v % 3);
  for (let i = 0; i < nRib; i++) {
    const a = h.rot + i * 2.39996 + v;
    const d = h.r * (0.12 + 0.55 * h01(i, v + 3));
    const x = h.x + Math.cos(a) * d;
    const z = h.z + Math.sin(a) * d;
    const L = 3.0 + 3.6 * h01(i + 7, v);
    const W = 0.8 + 0.9 * h01(i + 11, v);
    const T = 0.3 + 0.16 * h01(i + 13, v);
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
    box.translate(x, 0, z);
    // seat: every vertex follows the snow surface under it (the rib drapes over the slope), with
    // ~45 % of its height buried
    {
      const BP = box.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < BP.count; k++) BP.setY(k, H(BP.getX(k), BP.getZ(k)) + BP.getY(k) + T * 0.15);
      box.computeVertexNormals();
    }
    ribs.push(box);
    // a snow tail in the rib's lee (downwind, +x)
    const tail = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    tail.scale(L * 0.6, 0.16, W * 0.45);
    tail.translate(x + L * 0.75, H(x + L * 0.75, z) - 0.04, z);
    const TP = tail.attributes.position as THREE.BufferAttribute;
    const tc = new Float32Array(TP.count * 3).fill(0.9);
    tail.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    ribs.push(tail);
  }
  // gravel: small angular stones scattered in the gravel ring
  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.22, 0), M.stone, 26);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) {
    const a = h.rot + i * 2.4 + v;
    const d = h.r * (0.35 + 0.55 * h01(i + 23, v));
    const x = h.x + Math.cos(a) * d;
    const z = h.z + Math.sin(a) * d;
    const s = 0.6 + 1.4 * h01(i + 29, v);
    mm.compose(new THREE.Vector3(x, H(x, z) + 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 2, 0)), new THREE.Vector3(s, s * 0.55, s));
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
      // dark gneiss, lighter where the wind has polished the top
      const top = P.getY(k) > 0 ? 1 : 0;
      const t = 0.1 + 0.07 * h01(P.getX(k) * 0.7, P.getZ(k) * 0.9) + 0.06 * top;
      cc.set([t, t * 1.05, t * 1.14], k * 3);
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

/** concatenate non-indexed geometries with position/normal/color (preallocated, no array spreads) */
function mergeSimple(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = list.map((raw) => {
    const gg = raw.index ? raw.toNonIndexed() : raw;
    if (!gg.getAttribute('normal')) gg.computeVertexNormals();
    return gg;
  });
  let n = 0;
  for (const gg of parts) n += (gg.attributes.position as THREE.BufferAttribute).count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const gg of parts) {
    const c = (gg.attributes.position as THREE.BufferAttribute).count;
    pos.set((gg.attributes.position as THREE.BufferAttribute).array as ArrayLike<number>, o * 3);
    nor.set((gg.attributes.normal as THREE.BufferAttribute).array as ArrayLike<number>, o * 3);
    col.set(((gg.attributes.color as THREE.BufferAttribute).array as ArrayLike<number>), o * 3);
    o += c;
  }
  parts.forEach((gg, i) => {
    if (gg !== list[i]) gg.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/**
 * gap-marker: the gully of a spine's gap jump, telegraphed (round 2, E5 / B N3): orange-and-black
 * poles at both ends of the take-off lip and of the far edge, with a line of red pennants strung
 * across the lip — "a drop here, carry speed". One merged draw (the windsock's vertex-colour
 * material).
 */
export function gapMarkerView(h: HazardInstance<{ len: number; hw: number }>, m: Mountain): HazardView {
  const M = mats();
  const parts: THREE.BufferGeometry[] = [];
  const colour = (g: THREE.BufferGeometry, c: number) => {
    const P = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(P.count * 3);
    const cc = new THREE.Color(c);
    for (let i = 0; i < P.count; i++) col.set([cc.r, cc.g, cc.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const { len, hw } = h.params;
  const half = hw - 1.5;
  const pole = (x: number, z: number) => {
    const y = m.heightAt(x, z);
    // banded pole (orange / black), 2.4 m
    for (let k = 0; k < 4; k++) {
      const seg = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6);
      seg.translate(x, y + 0.3 + k * 0.6, z);
      parts.push(colour(seg, k % 2 ? 0x1a1a1a : 0xff6a1a));
    }
    return y + 2.35;
  };
  const lip = h.z - 1.5;
  const tops = [pole(h.x - half, lip), pole(h.x + half, lip)];
  pole(h.x - half, h.z + len);
  pole(h.x + half, h.z + len);
  // pennants on a line across the lip (sagging a little)
  const n = Math.max(6, Math.round((2 * half) / 1.4));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const x = h.x - half + 2 * half * u;
    const y = tops[0]! + (tops[1]! - tops[0]!) * u - 0.35 * Math.sin(Math.PI * u);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([x - 0.35, y, lip, x + 0.35, y, lip, x, y - 0.6, lip + 0.05], 3));
    tri.computeVertexNormals();
    parts.push(colour(tri, i % 2 ? 0xf4f1ea : 0xd8261e));
  }
  const merged = mergeSimple(parts);
  for (const g of parts) g.dispose();
  const mesh = new THREE.Mesh(merged, M.sock);
  mesh.name = 'gap-marker';
  return {
    object: mesh,
    dispose() {
      merged.dispose();
      mesh.removeFromParent();
    },
  };
}

registerHazardView('sea-gust', (h, ctx) => gustView(h, ctx.mountain));
registerHazardView('gap-marker', (h, ctx) => gapMarkerView(h as HazardInstance<{ len: number; hw: number }>, ctx.mountain));
registerHazardView('scoured-rock', (h, ctx) => rockView(h as HazardInstance<{ v: number }>, ctx.mountain));
