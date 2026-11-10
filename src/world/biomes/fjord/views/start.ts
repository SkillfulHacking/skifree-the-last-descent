/**
 * Fjord Coast start (round 2, art review D4 / critic 7): a coastal-mountain start, not the Alpine
 * arch, hut and fence line. Same footprint as the shared start (the gate 12 m down the route, the
 * start wand at z = 2.8, the shelter up-slope on the sea side) so the run and the menu framing
 * work unchanged:
 *
 *  - the gate: two silver-grey, weather-checked driftwood posts lashed with rope, a beam hung with
 *    netted glass fishing floats and a line of nautical signal pennants, a falu-red START board;
 *  - a dry-stone shelter with a turf roof under snow, a red door and a lit window;
 *  - a flag mast with a long split pennant and a wind vane (the onshore breeze, at a glance);
 *  - a stone cairn with a red T trail mark, and a rope line on short posts strung with floats in
 *    place of a fence.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Rng } from '../../../../core/rng';
import type { Mountain } from '../../../course';
import { registerStartDressing } from '../../../StartArea';
import { FJORD_ID } from '../biome';

function board(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8e2c1d';
  g.fillRect(0, 0, 1024, 192);
  // painted planks
  for (let y = 0; y < 192; y += 48) {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, y, 1024, 2);
    for (let x = 0; x < 1024; x += 3) {
      g.fillStyle = `rgba(255,255,255,${0.025 * Math.abs(Math.sin(x * 0.37 + y))})`;
      g.fillRect(x, y + 2, 1, 46);
    }
  }
  g.strokeStyle = '#f2efe7';
  g.lineWidth = 8;
  g.strokeRect(12, 12, 1000, 168);
  g.fillStyle = '#f4efe4';
  g.textAlign = 'center';
  g.font = '900 104px "Arial Black", Impact, sans-serif';
  g.fillText('START', 512, 118);
  g.font = '700 26px Arial, sans-serif';
  g.fillText('FJORD COAST  ·  TOPPEN 0 M  ·  TO THE SEA', 512, 160);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** International-code-style signal pennants: simple bold two-colour designs. */
const PENNANTS: Array<[number, number]> = [
  [0xd8261c, 0xf4f1ea],
  [0x1f4f9a, 0xf4f1ea],
  [0xf2c230, 0x1f4f9a],
  [0xf4f1ea, 0xd8261c],
  [0x1b1b1b, 0xf2c230],
  [0x1f4f9a, 0xd8261c],
];

function pennantGeo(w: number, h: number, a: number, b: number): THREE.BufferGeometry {
  // a triangle split in two colour bands (vertex colours)
  const g = new THREE.BufferGeometry();
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  const pos = [-w / 2, 0, 0, w / 2, 0, 0, 0, -h, 0, -w / 4, -h / 2, 0, w / 4, -h / 2, 0];
  // two triangles: top band (0,1,4,3) in a, tip (3,4,2) in b
  const P: number[] = [];
  const C: number[] = [];
  const tri = (i: number, j: number, k: number, c: THREE.Color) => {
    for (const q of [i, j, k]) {
      P.push(pos[q * 3]!, pos[q * 3 + 1]!, pos[q * 3 + 2]!);
      C.push(c.r, c.g, c.b);
    }
  };
  tri(0, 3, 1, ca);
  tri(1, 3, 4, ca);
  tri(3, 2, 4, cb);
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  return g;
}

export function buildFjordStart(m: Mountain, group: THREE.Group, woodTexture: (seed: number) => THREE.CanvasTexture): Array<{ dispose(): void }> {
  const out: Array<{ dispose(): void }> = [];
  const rng = new Rng(9137);
  const grain = woodTexture(141);
  // driftwood: silver-grey, weather-checked
  const drift = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, map: grain, bumpMap: grain, bumpScale: 1.6, roughness: 0.92 });
  const tarred = new THREE.MeshStandardMaterial({ color: 0x5a4a3c, map: grain, bumpMap: grain, bumpScale: 1.0, roughness: 0.8 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xe9eef6, roughness: 0.9 });
  const rope = new THREE.MeshStandardMaterial({ color: 0xcdb98c, roughness: 0.95 });
  const glassFloat = new THREE.MeshPhysicalMaterial({ color: 0x3f8f7a, roughness: 0.08, metalness: 0, transmission: 0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x0b2a22, emissiveIntensity: 0.4 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8561e, roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe7, roughness: 0.6 });
  const flagMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  const stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const turf = new THREE.MeshStandardMaterial({ color: 0x4a4a2c, roughness: 1 });
  const red = new THREE.MeshStandardMaterial({ color: 0x8e2c1d, roughness: 0.7 });
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a3c, emissiveIntensity: 1.4 });
  const boardTex = board();
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.75 });
  out.push(grain, drift, tarred, snow, rope, glassFloat, orange, white, flagMat, stone, turf, red, winMat, boardTex, boardMat);
  const add = (o: THREE.Mesh, shadow = true) => {
    o.castShadow = shadow;
    o.receiveShadow = true;
    group.add(o);
    return o;
  };

  // ---------------- the gate ----------------
  const z = 12;
  const cx = m.routeX(z);
  const span = 8.4;
  const postH = 4.8;
  let topY = -Infinity;
  for (const side of [-1, 1]) {
    const x = cx + side * span * 0.5;
    const gy = m.heightAt(x, z);
    topY = Math.max(topY, gy + postH - 0.2);
    // a slightly crooked driftwood trunk with a root flare
    const post = new THREE.CylinderGeometry(0.2, 0.3, postH + 0.4, 9, 4);
    const P = post.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i);
      P.setX(i, P.getX(i) + 0.07 * Math.sin(y * 1.3 + side));
      P.setZ(i, P.getZ(i) + 0.05 * Math.sin(y * 0.9 + 2 * side));
    }
    post.computeVertexNormals();
    add(new THREE.Mesh(post, drift)).position.set(x, gy + postH / 2 - 0.3, z);
    // rope lashing near the top and a snow cap
    for (const ly of [postH - 1.2, postH - 0.95]) add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 14).rotateX(Math.PI / 2), rope), false).position.set(x, gy + ly, z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), snow);
    add(cap, false).position.set(x, gy + postH - 0.05, z);
    // a heap of stones holding the foot
    for (let k = 0; k < 6; k++) {
      const s = rng.range(0.25, 0.45);
      const st = new THREE.DodecahedronGeometry(s, 0).scale(1, 0.6, 1);
      const t = 0.3 + rng.range(-0.05, 0.05);
      const cc = new Float32Array((st.attributes.position as THREE.BufferAttribute).count * 3);
      for (let q = 0; q < cc.length; q += 3) cc.set([t, t * 1.02, t * 1.08], q);
      st.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      const a = (k / 6) * Math.PI * 2;
      add(new THREE.Mesh(st, stone)).position.set(x + Math.cos(a) * 0.45, m.heightAt(x, z) + s * 0.2, z + Math.sin(a) * 0.45);
    }
  }
  // the beam (a split log) and the START board hung below it on two chains
  const beam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, span + 1.2, 9).rotateZ(Math.PI / 2), drift));
  beam.position.set(cx, topY, z);
  add(new THREE.Mesh(new RoundedBoxGeometry(span + 1.0, 0.12, 0.3, 2, 0.05), snow), false).position.set(cx, topY + 0.2, z);
  const by = topY - 1.35;
  const bd = add(new THREE.Mesh(new RoundedBoxGeometry(span - 1.0, 1.5, 0.14, 3, 0.05), tarred));
  bd.position.set(cx, by, z);
  for (const dir of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(span - 1.3, 1.3), boardMat);
    face.position.set(cx, by, z + dir * 0.075);
    if (dir < 0) face.rotation.y = Math.PI;
    group.add(face);
  }
  for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 5), rope), false).position.set(cx + sx * (span / 2 - 1.2), by + 1.0, z);
  add(new THREE.Mesh(new RoundedBoxGeometry(span - 1.1, 0.1, 0.18, 2, 0.04), snow), false).position.set(cx, by + 0.8, z);
  // netted glass floats and buoys hanging from the beam ends
  for (const sx of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const x = cx + sx * (span / 2 - 0.45 - k * 0.42);
      const yy = topY - 0.55 - k * 0.22;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, topY - yy, 4), rope), false).position.set(x, (topY + yy) / 2, z + 0.25);
      const f = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), k === 1 ? orange : glassFloat), false);
      f.position.set(x, yy - 0.2, z + 0.25);
      // the net: a coarse wire cage
      add(new THREE.Mesh(new THREE.SphereGeometry(0.215, 6, 4), new THREE.MeshBasicMaterial({ color: 0x2a2620, wireframe: true })), false).position.copy(f.position);
    }
  // signal pennants on a line above the beam, between the post tops
  const line: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    line.push(new THREE.Vector3(cx - span / 2 + t * span, topY + 0.55 - Math.sin(t * Math.PI) * 0.35, z));
  }
  add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line), 24, 0.012, 4), rope), false);
  for (let i = 1; i < 12; i++) {
    const [a, b] = PENNANTS[(i - 1) % PENNANTS.length]!;
    const pg = pennantGeo(0.5, 0.75, a, b);
    const pm = add(new THREE.Mesh(pg, flagMat), false);
    pm.position.copy(line[i]!);
    pm.rotation.set(0.15 * Math.sin(i), 0, 0.12 * Math.cos(i * 1.7));
  }
  // short posts at the gate's foot carrying a rope line strung with floats (the "fence")
  for (const side of [-1, 1]) {
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i < 7; i++) {
      const zz = -4 - i * 3.2;
      const x = m.routeX(zz) + side * (5 + i * 0.7);
      const gy = m.heightAt(x, zz);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 7), drift)).position.set(x, gy + 0.45, zz);
      const top = new THREE.Vector3(x, gy + 0.95, zz);
      if (prev) {
        const mid = prev.clone().lerp(top, 0.5);
        mid.y -= 0.16;
        add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(prev, mid, top), 6, 0.02, 4), rope), false);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), i % 2 ? orange : white), false).position.set(mid.x, mid.y - 0.1, mid.z);
      }
      prev = top;
    }
  }

  // ---------------- start wand (as the shared start: the skier waits behind it) ----------------
  const cw = m.routeX(2.8);
  for (const side of [-1, 1]) {
    const x = cw + side * 1.25;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 10), orange), false).position.set(x, m.heightAt(x, 2.8) + 0.48, 2.8);
  }
  const bar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 10), red), false);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(cw, m.heightAt(cw, 2.8) + 0.62, 2.8);

  // ---------------- dry-stone shelter with a turf roof ----------------
  const cx0 = m.routeX(0);
  const hx = cx0 - 17;
  const hz = -15;
  let hy = Infinity;
  for (const [dx, dz] of [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5]] as const) hy = Math.min(hy, m.heightAt(hx + dx, hz + dz));
  const W = 5.6;
  const D = 4.4;
  const wallH = 2.3;
  {
    // coursed stones (vertex-coloured, merged): rows of slightly varied blocks
    const pos: number[] = [];
    const col: number[] = [];
    const ring: Array<[number, number, number, number]> = [
      [-W / 2, -D / 2, W / 2, -D / 2],
      [W / 2, -D / 2, W / 2, D / 2],
      [W / 2, D / 2, -W / 2, D / 2],
      [-W / 2, D / 2, -W / 2, -D / 2],
    ];
    for (let row = 0; row < 7; row++) {
      const y = -0.5 + row * 0.42;
      ring.forEach(([x0, z0, x1, z1], side) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        let s = row % 2 ? 0.35 : 0;
        while (s < len - 0.2) {
          const l = Math.min(len - s, rng.range(0.55, 1.05));
          const t0 = (s + l / 2) / len;
          // the door gap on the side facing the piste (+x): two rows of opening
          const px = x0 + (x1 - x0) * t0;
          const pz = z0 + (z1 - z0) * t0;
          s += l + 0.04;
          if (side === 1 && Math.abs(pz) < 0.55 && row < 5) continue;
          if (side === 3 && Math.abs(pz) < 0.5 && row >= 3 && row <= 4) continue;
          const g = new THREE.BoxGeometry(l, 0.4, 0.55, 1, 1, 1);
          const yaw = Math.atan2(z1 - z0, x1 - x0);
          g.rotateY(-yaw);
          g.translate(px, y + 0.2, pz);
          const ng = g.toNonIndexed();
          g.dispose();
          const P = ng.attributes.position as THREE.BufferAttribute;
          const t = 0.27 + rng.range(-0.07, 0.07);
          const warm = rng.range(0.96, 1.08);
          for (let k = 0; k < P.count; k++) {
            pos.push(P.getX(k) + rng.range(-0.02, 0.02), P.getY(k) + rng.range(-0.03, 0.03), P.getZ(k));
            col.push(t * warm, t, t * 1.06 / warm);
          }
          ng.dispose();
        }
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    add(new THREE.Mesh(g, stone)).position.set(hx, hy, hz);
    // the back fill (so the walls are solid, not a shell)
    add(new THREE.Mesh(new THREE.BoxGeometry(W - 1.0, wallH + 0.4, D - 1.0), new THREE.MeshStandardMaterial({ color: 0x1a1816 })), false).position.set(hx, hy + wallH / 2 - 0.3, hz);
  }
  // turf roof: a low gable of thick sod under a heavy snow load, bargeboards
  const roof = new THREE.Group();
  const pitch = 0.42;
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 0.9, 0.4, D / 2 / Math.cos(pitch) + 0.6, 2, 0.12), turf);
    slab.position.set(0, 0, side * (D / 4 + 0.1));
    slab.rotation.x = side * pitch;
    const sn = new THREE.Mesh(new RoundedBoxGeometry(W + 1.0, 0.32, D / 2 / Math.cos(pitch) + 0.55, 2, 0.14), snow);
    sn.position.set(0, 0.3, side * (D / 4 + 0.16));
    sn.rotation.x = side * pitch;
    roof.add(slab, sn);
  }
  roof.position.set(hx, hy + wallH + 0.15, hz);
  roof.traverse((o) => ((o.castShadow = true), (o.receiveShadow = true)));
  group.add(roof);
  for (const sx of [-1, 1]) {
    for (const side of [-1, 1]) {
      const bb = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, D / 2 / Math.cos(pitch) + 0.6), tarred));
      bb.position.set(hx + sx * (W / 2 + 0.48), hy + wallH + 0.3, hz + side * (D / 4 + 0.12));
      bb.rotation.x = side * pitch;
    }
  }
  // the door (red, facing the piste) and a lit window on the far gable
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.75, 0.95), red)).position.set(hx + W / 2 + 0.02, hy + 0.55, hz);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.75), winMat), false).position.set(hx - W / 2 - 0.01, hy + 1.2, hz);
  // a little stovepipe with smoke-blackened cap
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8), tarred)).position.set(hx - 1.3, hy + wallH + 1.2, hz - 0.6);

  // ---------------- flag mast with a split pennant and a wind vane ----------------
  const mx = hx + 5.5;
  const mz = hz + 4.5;
  const my = m.heightAt(mx, mz);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 9, 8), white)).position.set(mx, my + 4.5, mz);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.8, roughness: 0.3 })), false).position.set(mx, my + 9.05, mz);
  {
    // long swallow-tailed pennant streaming inland (+x, downwind), gently waved
    const L = 3.6;
    const g = new THREE.PlaneGeometry(L, 0.42, 16, 1);
    const P = g.attributes.position as THREE.BufferAttribute;
    const C: number[] = [];
    const cr = new THREE.Color(0xc8281e);
    const cw2 = new THREE.Color(0xf2efe7);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) + L / 2;
      const t = x / L;
      const yy = P.getY(i) * (1 - 0.65 * t);
      P.setXYZ(i, x, yy - (t > 0.8 ? (P.getY(i) > 0 ? 0.0 : 0) : 0), 0.18 * Math.sin(t * 7) * t);
      const c = t < 0.2 ? cw2 : cr;
      C.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.computeVertexNormals();
    add(new THREE.Mesh(g, flagMat), false).position.set(mx + 0.05, my + 8.5, mz);
  }
  // wind vane (a little fish) on a cross just under the top
  {
    const fish = new THREE.ConeGeometry(0.16, 0.9, 6).rotateZ(-Math.PI / 2);
    add(new THREE.Mesh(fish, new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.7, roughness: 0.35 })), false).position.set(mx + 0.3, my + 8.9, mz);
  }

  // ---------------- a cairn on the sea side of the start ----------------
  {
    const kx = m.routeX(-4) - 11;
    const kz = -4;
    let yy = m.heightAt(kx, kz) - 0.1;
    let r = 0.6;
    for (let i = 0; i < 5; i++) {
      const s = r * rng.range(0.9, 1.05);
      const g = new THREE.DodecahedronGeometry(s, 0).scale(1, 0.62, 1);
      const t = 0.3 + rng.range(-0.05, 0.05);
      const cc = new Float32Array((g.attributes.position as THREE.BufferAttribute).count * 3);
      for (let q = 0; q < cc.length; q += 3) cc.set([t, t * 1.02, t * 1.08], q);
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      add(new THREE.Mesh(g, stone)).position.set(kx + rng.range(-0.06, 0.06), yy + s * 0.5, kz + rng.range(-0.06, 0.06));
      yy += s * 0.95;
      r *= 0.78;
    }
    add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), snow), false).position.set(kx, yy, kz);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.03), red), false).position.set(kx + 0.55, yy - 0.5, kz);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.03), red), false).position.set(kx + 0.55, yy - 0.7, kz);
  }

  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      geos.add(mesh.geometry);
      mats.add(mesh.material as THREE.Material);
    }
  });
  for (const g of geos) out.push(g);
  for (const mm of mats) if (!out.includes(mm)) out.push(mm);
  return out;
}

registerStartDressing(FJORD_ID, buildFjordStart);
