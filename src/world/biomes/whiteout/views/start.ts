/**
 * Whiteout Ridge start (W-019): a summit on an exposed ridge, not the Alpine arch and hut. Same
 * footprint as the shared start (the gate 12 m down the route, the start wand at z = 2.8), so the run
 * and the menu framing work unchanged:
 *  - the gate: two steel lattice towers (the ridge's trail-marker language) guyed against the wind,
 *    each with an amber storm lamp, a steel beam with a weather-bleached START banner;
 *  - a red corrugated bivouac shelter (a half-barrel "bivacco") up-slope on the crest side, guyed down,
 *    snow piled on its windward end, a lit porthole;
 *  - a weather-station mast: anemometer cups, wind vane, solar panel;
 *  - a summit cairn with an iron cross, rimed;
 *  - orange-and-black guide poles down the run-in.
 */
import * as THREE from 'three';
import type { Mountain } from '../../../course';
import { registerStartDressing } from '../../../StartArea';
import { WHITEOUT_ID } from '../biome';

function banner(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b5281c';
  g.fillRect(0, 0, 1024, 192);
  // wind-bleached, frayed: lighter streaks along the wind
  for (let y = 0; y < 192; y += 2) {
    g.fillStyle = `rgba(255,240,230,${0.05 + 0.05 * Math.abs(Math.sin(y * 0.21))})`;
    g.fillRect(0, y, 1024, 1);
  }
  g.fillStyle = '#f4efe6';
  g.textAlign = 'center';
  g.font = '900 108px "Arial Black", Impact, sans-serif';
  g.fillText('START', 512, 116);
  g.font = '700 26px Arial, sans-serif';
  g.fillText('WHITEOUT RIDGE  ·  2,986 M  ·  FOLLOW THE LAMPS', 512, 160);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let glowTex: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function buildWhiteoutStart(m: Mountain, group: THREE.Group): Array<{ dispose(): void }> {
  const out: Array<{ dispose(): void }> = [];
  const mk = <T extends { dispose(): void }>(x: T): T => {
    out.push(x);
    return x;
  };
  const steel = mk(new THREE.MeshStandardMaterial({ color: 0x7d838c, roughness: 0.45, metalness: 0.7 }));
  const dark = mk(new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.7 }));
  const snow = mk(new THREE.MeshStandardMaterial({ color: 0xeef2f8, roughness: 0.9 }));
  const rime = mk(new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.7 }));
  const stone = mk(new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.95, flatShading: true }));
  const lampM = mk(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.68, 0.25) }));
  const cable = mk(new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6 }));
  const tex = mk(banner());
  const bannerM = mk(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
  const band = mk(new THREE.MeshStandardMaterial({ color: 0xf06010, roughness: 0.5, emissive: new THREE.Color(0.25, 0.07, 0), emissiveIntensity: 0.4 }));
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, cast = true) => {
    mk(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const strut = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
    const s = add(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 4), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, false);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return s;
  };
  const R = m.biome.terrain.ridge;
  const crest = R ? -R.dropSide : -1;

  // ---------------- the gate: two lattice towers, a beam and the banner ----------------
  const z = 12;
  const cx = m.routeX(z);
  const span = 8.8;
  const postH = 5.2;
  let topY = -Infinity;
  const feet: number[] = [];
  for (const side of [-1, 1]) {
    const x = cx + side * span * 0.5;
    const gy = m.heightAt(x, z);
    feet.push(gy);
    topY = Math.max(topY, gy + postH);
  }
  for (const [i, side] of [-1, 1].entries()) {
    const x = cx + side * span * 0.5;
    const gy = feet[i]! - 0.4;
    const h = topY - gy;
    // a triangular lattice tower
    const c = [0, 1, 2].map((k) => new THREE.Vector3(x + Math.cos((k / 3) * Math.PI * 2) * 0.32, 0, z + Math.sin((k / 3) * Math.PI * 2) * 0.32));
    for (const p of c) strut(new THREE.Vector3(p.x, gy, p.z), new THREE.Vector3(p.x, gy + h, p.z), 0.045, steel);
    for (let j = 0; j < Math.floor(h); j++)
      for (let k = 0; k < 3; k++) {
        const a = c[k]!, b = c[(k + 1) % 3]!;
        strut(new THREE.Vector3(a.x, gy + j + 0.3, a.z), new THREE.Vector3(b.x, gy + j + 1.2, b.z), 0.016, steel);
      }
    // a concrete-and-stone foot, snow drifted against it
    add(new THREE.CylinderGeometry(0.7, 0.8, 0.9, 8), stone, x, gy + 0.2, z);
    add(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.5, 1), snow, x - 0.4 * side, feet[i]! - 0.15, z - 0.4, false);
    // the storm lamp on top
    add(new THREE.CylinderGeometry(0.18, 0.22, 0.4, 10), dark, x, topY + 0.25, z);
    add(new THREE.SphereGeometry(0.16, 10, 8), lampM, x, topY + 0.25, z + 0.06, false);
    const glowS = new THREE.Sprite(mk(new THREE.SpriteMaterial({ map: glow(), color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    glowS.scale.setScalar(2.2);
    glowS.position.set(x, topY + 0.25, z + 0.1);
    group.add(glowS);
    // guy wires to the snow, up-slope and down-slope
    for (const dz of [-4.5, 4.5]) {
      const ax = x + side * 2.2;
      const az = z + dz;
      strut(new THREE.Vector3(x, gy + h * 0.85, z), new THREE.Vector3(ax, m.heightAt(ax, az), az), 0.01, cable);
    }
  }
  // the beam and the banner (slightly bellied by the wind)
  add(new THREE.BoxGeometry(span, 0.16, 0.16), steel, cx, topY - 0.15, z);
  const bg = new THREE.PlaneGeometry(span - 1.2, 1.3, 16, 2);
  const bp = bg.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) bp.setZ(i, 0.18 * Math.sin(((bp.getX(i) + (span - 1.2) / 2) / (span - 1.2)) * Math.PI));
  bg.computeVertexNormals();
  add(bg, bannerM, cx, topY - 1.0, z - 0.05, false);
  // snow along the beam
  add(new THREE.BoxGeometry(span - 0.3, 0.14, 0.26), snow, cx, topY - 0.02, z, false);

  // ---------------- the bivouac shelter (crest side, up-slope) ----------------
  const bz = -16;
  const bx = m.routeX(bz) + crest * 15;
  const by = Math.min(m.heightAt(bx - 2.2, bz), m.heightAt(bx + 2.2, bz), m.heightAt(bx, bz - 3), m.heightAt(bx, bz + 3));
  const biv = new THREE.Group();
  biv.position.set(bx, by - 0.3, bz);
  biv.rotation.y = crest > 0 ? -0.35 : 0.35;
  group.add(biv);
  const barrel = new THREE.CylinderGeometry(1.7, 1.7, 5.2, 24, 1, true, 0, Math.PI);
  barrel.rotateZ(Math.PI / 2);
  barrel.rotateX(Math.PI / 2);
  // corrugation: ridges along the barrel
  const P = barrel.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const ang = Math.atan2(P.getY(i), P.getX(i));
    const k = 1 + 0.012 * Math.sin(ang * 60);
    P.setX(i, P.getX(i) * k);
    P.setY(i, P.getY(i) * k);
  }
  barrel.computeVertexNormals();
  const shell = new THREE.Mesh(mk(barrel), mk(new THREE.MeshStandardMaterial({ color: 0xc02c1e, roughness: 0.45, metalness: 0.45, side: THREE.DoubleSide })));
  shell.castShadow = true;
  shell.receiveShadow = true;
  biv.add(shell);
  const endM = mk(new THREE.MeshStandardMaterial({ color: 0x9c2418, roughness: 0.55, metalness: 0.3 }));
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(mk(new THREE.CircleGeometry(1.7, 24, 0, Math.PI)), endM);
    e.position.set(0, 0, s * 2.6);
    if (s < 0) e.rotation.y = Math.PI;
    biv.add(e);
  }
  // the lit porthole and a small door on the down-slope end
  const port = new THREE.Mesh(mk(new THREE.CircleGeometry(0.32, 16)), lampM);
  port.position.set(0.7, 0.9, 2.61);
  biv.add(port);
  const door = new THREE.Mesh(mk(new THREE.PlaneGeometry(0.8, 1.3)), dark);
  door.position.set(-0.5, 0.65, 2.62);
  biv.add(door);
  // snow load on the windward end and over the top; guy straps
  const drift = new THREE.Mesh(mk(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), snow);
  drift.scale.set(2.2, 1.5, 1.6);
  drift.position.set(0, -0.1, -2.9);
  biv.add(drift);
  const roofSnow = new THREE.Mesh(mk(new THREE.CylinderGeometry(1.76, 1.76, 4.6, 24, 1, true, 0.55, Math.PI - 1.1)), snow);
  roofSnow.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  biv.add(roofSnow);
  for (const zz of [-1.6, 1.6]) {
    const strap = new THREE.Mesh(mk(new THREE.TorusGeometry(1.74, 0.025, 4, 24, Math.PI)), cable);
    strap.rotation.set(0, 0, 0);
    strap.position.set(0, 0, zz);
    biv.add(strap);
  }

  // ---------------- the weather station ----------------
  const wz = -6;
  const wx = m.routeX(wz) + crest * 9;
  const wy = m.heightAt(wx, wz) - 0.3;
  add(new THREE.CylinderGeometry(0.06, 0.08, 6.5, 8), steel, wx, wy + 3.25, wz);
  // anemometer: three cups on arms
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    strut(new THREE.Vector3(wx, wy + 6.4, wz), new THREE.Vector3(wx + Math.cos(a) * 0.45, wy + 6.4, wz + Math.sin(a) * 0.45), 0.012, steel);
    add(new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI), dark, wx + Math.cos(a) * 0.45, wy + 6.4, wz + Math.sin(a) * 0.45, false).rotation.y = -a;
  }
  // wind vane, solar panel, a rimed instrument box
  const vane = add(new THREE.BoxGeometry(0.04, 0.3, 0.9), dark, wx, wy + 5.7, wz, false);
  vane.rotation.y = 0.6;
  const panel = add(new THREE.BoxGeometry(0.9, 0.04, 0.6), mk(new THREE.MeshStandardMaterial({ color: 0x1c2a44, roughness: 0.2, metalness: 0.6 })), wx, wy + 3.2, wz - 0.4, false);
  panel.rotation.x = -0.9;
  add(new THREE.BoxGeometry(0.45, 0.55, 0.3), rime, wx, wy + 2.0, wz + 0.2);

  // ---------------- the summit cairn and iron cross ----------------
  const kz = -24;
  const kx = m.routeX(kz) - crest * 7;
  const ky = m.heightAt(kx, kz) - 0.4;
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 14; k++) {
    const r = 0.35 + 0.3 * rnd();
    const lvl = Math.floor(k / 5);
    const a = rnd() * Math.PI * 2;
    const rr = (1.2 - lvl * 0.4) * (0.6 + 0.4 * rnd());
    add(new THREE.DodecahedronGeometry(r, 0).scale(1, 0.65, 1), stone, kx + Math.cos(a) * rr, ky + 0.25 + lvl * 0.45, kz + Math.sin(a) * rr);
  }
  add(new THREE.BoxGeometry(0.1, 2.4, 0.1), dark, kx, ky + 2.2, kz);
  add(new THREE.BoxGeometry(1.1, 0.1, 0.1), dark, kx, ky + 2.9, kz);
  // rime feathers grown on the cross's windward side
  add(new THREE.BoxGeometry(0.05, 2.2, 0.16), rime, kx + 0.06, ky + 2.2, kz, false);

  // ---------------- guide poles down the run-in ----------------
  for (let k = 0; k < 6; k++) {
    const pz = 22 + k * 9;
    for (const side of [-1, 1]) {
      const px = m.routeX(pz) + side * 6.2;
      add(new THREE.CylinderGeometry(0.035, 0.045, 1.8, 6), band, px, m.heightAt(px, pz) + 0.7, pz, false);
    }
  }
  void wy;
  return out;
}

registerStartDressing(WHITEOUT_ID, (m, group) => buildWhiteoutStart(m, group));
