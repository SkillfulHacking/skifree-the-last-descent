/**
 * Whiteout Ridge hazard views (three.js):
 *  - `wind-drift`: a smooth wind-loaded mound draped on the snow, a sharp crest on its lee side and a
 *    plume of spindrift streaming off the crest in the wind (reads as "deep snow" from 100 m: brighter
 *    and smoother than the piste, with a shadowed lee face);
 *  - `blizzard`: a wall of driven snow. In the telegraph it is seen coming in from upwind (a dense
 *    band of streaking flakes and a pale curtain sweeping toward the line), active it fills the
 *    piste, then it blows through and thins out.
 */
import * as THREE from 'three';
import type { Mountain } from '../../../course';
import type { HazardInstance, HazardPhaseState } from '../../../hazards/hazard';
import { registerHazardView, type HazardView } from '../../../presentation/hazardViews';
import { makeFlakeTexture } from '../../../Environment';
import { BLIZZARD, blizzardStrength, type BlizzardParams, type DriftParams } from '../hazards';

let shared: { drift: THREE.MeshStandardMaterial; plume: THREE.PointsMaterial; curtain: THREE.MeshBasicMaterial; flake: THREE.Texture } | null = null;
function mats() {
  if (shared) return shared;
  const flake = makeFlakeTexture();
  shared = {
    // fresh wind-loaded snow: brighter and smoother than the piste around it
    drift: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.97, 0.985, 1.0), roughness: 0.62, metalness: 0, vertexColors: true }),
    plume: new THREE.PointsMaterial({ size: 0.9, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, map: flake, sizeAttenuation: true }),
    curtain: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.93, 0.97), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: true }),
    flake,
  };
  return shared;
}

/** A drift: an elongated mound across the fall line (gentle windward side, steep lee), draped on the snow. */
function driftView(h: HazardInstance<DriftParams>, m: Mountain): HazardView {
  const M = mats();
  const obj = new THREE.Group();
  obj.name = 'wind-drift';
  const L = h.r * h.params.len;
  const W = h.r * 0.75;
  const H = 1.7 + 0.5 * ((h.seed % 97) / 97);
  const nu = 26;
  const nv = 14;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = Math.cos(h.rot);
  const s = Math.sin(h.rot);
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1; // along the drift (x)
      const v = (j / nv) * 2 - 1; // across it (z): −1 windward (uphill) … +1 lee
      const lx = u * L;
      const lz = v * W;
      const x = h.x + lx * c - lz * s;
      const z = h.z + lx * s + lz * c;
      // profile: long windward ramp, crest at v≈0.35, steep lee
      const across = v < 0.35 ? Math.pow(Math.max(0, (v + 1) / 1.35), 1.6) : Math.max(0, 1 - Math.pow((v - 0.35) / 0.65, 0.7));
      const along = Math.pow(Math.max(0, 1 - u * u), 0.8);
      const ripple = 0.06 * Math.sin(lx * 1.7 + h.seed) * across;
      const y = H * across * along + ripple;
      pos.push(x, m.heightAt(x, z) + y + 0.03, z);
      // the lee face sits in its own shadow (a touch bluer)
      const lee = v > 0.35 ? Math.min(1, (v - 0.35) * 2.2) * along : 0;
      col.push(1 - 0.3 * lee, 1 - 0.22 * lee, 1 - 0.06 * lee);
    }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, M.drift);
  mesh.receiveShadow = true;
  obj.add(mesh);
  // spindrift off the crest
  const n = 70;
  const pp = new Float32Array(n * 3);
  const seedU = new Float32Array(n);
  for (let i = 0; i < n; i++) seedU[i] = (((h.seed * 31 + i * 977) % 1000) / 1000) * 2 - 1;
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const plume = new THREE.Points(pg, M.plume);
  plume.frustumCulled = false;
  obj.add(plume);
  const crestZ = 0.35 * W;
  return {
    object: obj,
    update(_ph: HazardPhaseState, t: number) {
      for (let i = 0; i < n; i++) {
        const u = seedU[i]!;
        const life = (t * 0.55 + (i * 0.137) % 1) % 1;
        const lx = u * L * 0.85;
        const lz = crestZ + life * 6;
        const x = h.x + lx * c - lz * s;
        const z = h.z + lx * s + lz * c;
        pp[i * 3] = x + life * 2.5;
        pp[i * 3 + 1] = m.heightAt(h.x + lx * c - crestZ * s, h.z + lx * s + crestZ * c) + H * Math.pow(Math.max(0, 1 - u * u), 0.8) + 0.2 + life * 1.4 - life * life * 1.6;
        pp[i * 3 + 2] = z;
      }
      (pg.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    },
    dispose() {
      g.dispose();
      pg.dispose();
    },
  };
}

/** A blizzard cell: streaking flakes in a box over the piste + pale curtains, driven by the cell's phase. */
function blizzardView(h: HazardInstance<BlizzardParams>, m: Mountain): HazardView {
  const M = mats();
  const obj = new THREE.Group();
  obj.name = 'blizzard';
  const dir = h.params.dir;
  const R = h.r + BLIZZARD.reach * 0.5;
  const n = 1400;
  const p = new Float32Array(n * 3);
  const base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = ((i * 2654435761) >>> 0) / 4294967296;
    const b = ((i * 40503 + h.seed * 97) % 10007) / 10007;
    const c = ((i * 69069 + 12345) % 9973) / 9973;
    base[i * 3] = (a * 2 - 1) * R;
    base[i * 3 + 1] = b * 22;
    base[i * 3 + 2] = (c * 2 - 1) * R;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const flakeMat = new THREE.PointsMaterial({ size: 0.55, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, map: M.flake, sizeAttenuation: true });
  const pts = new THREE.Points(g, flakeMat);
  pts.frustumCulled = false;
  obj.add(pts);
  // pale curtains (vertical sheets across the fall line, swept along with the cell)
  const curtains: THREE.Mesh[] = [];
  const cm = M.curtain.clone();
  for (let k = 0; k < 4; k++) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 26, 1, 1), cm);
    sheet.rotation.y = Math.PI / 2 + (k - 1.5) * 0.12;
    curtains.push(sheet);
    obj.add(sheet);
  }
  const ground = m.heightAt(h.x, h.z);
  return {
    object: obj,
    update(ph: HazardPhaseState, t: number) {
      const w = blizzardStrength(ph.phase, ph.u);
      // the cell's centre sweeps across the piste: from far upwind in the telegraph to over the line
      // when active, then on downwind as it blows through
      const off = ph.phase === 'telegraph' ? -dir * (1 - ph.u) * 110 : ph.phase === 'recovery' ? dir * ph.u * 70 : ph.phase === 'dormant' ? -dir * 110 : 0;
      const cx = h.x + off;
      const visible = ph.phase !== 'dormant' && w > 0.005;
      obj.visible = visible || ph.phase === 'telegraph';
      if (!obj.visible) return;
      flakeMat.opacity = Math.min(0.95, 0.25 + 0.9 * Math.max(w, ph.phase === 'telegraph' ? 0.35 * ph.u : 0));
      const speed = 16;
      for (let i = 0; i < n; i++) {
        let x = base[i * 3]! + dir * ((t * speed + i * 0.73) % (2 * R));
        if (x > R) x -= 2 * R;
        if (x < -R) x += 2 * R;
        const z = base[i * 3 + 2]!;
        const y = base[i * 3 + 1]! - ((t * 3.5 + i * 0.31) % 22);
        p[i * 3] = cx + x;
        p[i * 3 + 1] = ground + (y < 0 ? y + 22 : y) - 1;
        p[i * 3 + 2] = h.z + z;
      }
      (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      cm.opacity = 0.16 * Math.max(w, ph.phase === 'telegraph' ? 0.6 * ph.u : 0);
      curtains.forEach((sh, k) => {
        sh.position.set(cx + (k - 1.5) * R * 0.42 + dir * ((t * 9 + k * 13) % 24) - dir * 12, ground + 11, h.z);
      });
    },
    dispose() {
      g.dispose();
      flakeMat.dispose();
      cm.dispose();
      curtains.forEach((sh) => sh.geometry.dispose());
    },
  };
}

registerHazardView('wind-drift', (h, ctx) => driftView(h as HazardInstance<DriftParams>, ctx.mountain));
registerHazardView('blizzard', (h, ctx) => blizzardView(h as HazardInstance<BlizzardParams>, ctx.mountain));
