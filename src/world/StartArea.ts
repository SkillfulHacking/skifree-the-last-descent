/**
 * Summit start: a timber start arch with a banner a few metres down the route (the skier waits
 * at z≈1 behind a start wand and skis through the arch), a little hut and fencing.
 *
 * Layout is chosen for the menu's orbiting camera (radius ~26 m around routeX(0), first looking
 * down the route from behind-right): the arch sits far enough down the route that the whole
 * banner is in frame and both posts stay clear of the waiting skier.
 *
 * Materials are smooth and bevelled (no flat-shaded boxes): procedural wood grain (canvas texture
 * used as colour and bump), rounded posts with snow caps, a framed banner board.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Rng } from '../core/rng';
import type { Mountain } from './course';

/** Procedural wood grain: long wavy fibres, a few knots. Used as map and bump map. */
function woodTexture(seed: number): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rng = new Rng(seed);
  g.fillStyle = '#7a5434';
  g.fillRect(0, 0, W, H);
  // fibres
  for (let i = 0; i < 140; i++) {
    const x0 = rng.float() * W;
    const w = rng.range(0.6, 2.4);
    const l = rng.range(0.25, 0.75);
    g.strokeStyle = `rgba(${rng.float() < 0.5 ? '52,32,18' : '150,112,76'},${rng.range(0.15, 0.45) * l})`;
    g.lineWidth = w;
    g.beginPath();
    const ph = rng.float() * 6.28;
    for (let y = 0; y <= H; y += 8) {
      const x = x0 + Math.sin(y * 0.012 + ph) * 4 + Math.sin(y * 0.05 + ph * 2) * 1.2;
      if (y === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // knots
  for (let i = 0; i < 4; i++) {
    const x = rng.float() * W;
    const y = rng.float() * H;
    const r = rng.range(5, 11);
    const grd = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
    grd.addColorStop(0, 'rgba(40,24,12,0.9)');
    grd.addColorStop(0.4, 'rgba(70,44,24,0.5)');
    grd.addColorStop(1, 'rgba(70,44,24,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x, y, r * 1.4, r * 2.6, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class StartArea {
  readonly group = new THREE.Group();
  private disposables: Array<{ dispose(): void }> = [];

  constructor(m: Mountain) {
    const grain = woodTexture(77);
    const wood = new THREE.MeshStandardMaterial({ color: 0xc9a27e, map: grain, bumpMap: grain, bumpScale: 1.2, roughness: 0.82 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x8a6a52, map: grain, bumpMap: grain, bumpScale: 1.2, roughness: 0.85 });
    const snow = new THREE.MeshStandardMaterial({ color: 0xe9eef6, roughness: 0.9 });
    this.disposables.push(grain, wood, darkWood, snow);

    // --- banner texture ---------------------------------------------------------------
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 192;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createLinearGradient(0, 0, 1024, 0);
    grd.addColorStop(0, '#0f2a4a');
    grd.addColorStop(1, '#173f6b');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 1024, 192);
    // subtle fabric weave so the board is not a flat colour field
    for (let y = 0; y < 192; y += 3) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + 0.015 * Math.sin(y * 0.7)})`;
      ctx.fillRect(0, y, 1024, 1);
    }
    ctx.fillStyle = '#ff6a2b';
    ctx.fillRect(0, 168, 1024, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 108px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('START', 512, 126);
    ctx.font = '700 26px Arial, sans-serif';
    ctx.fillText('THE LAST DESCENT  ·  SUMMIT 0 M', 512, 160);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const bannerMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
    this.disposables.push(tex, bannerMat);

    // --- start arch, down the route ---------------------------------------------------
    const z = 12;
    const cx = m.routeX(z);
    const span = 8;
    const postH = 4.4;
    const postGeo = new THREE.CylinderGeometry(0.17, 0.21, postH, 16, 1);
    const capGeo = new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeo.scale(1, 0.55, 1);
    let topY = -Infinity;
    for (const side of [-1, 1]) {
      const x = cx + side * span * 0.5;
      const gy = m.heightAt(x, z);
      topY = Math.max(topY, gy + postH - 0.15);
      const post = new THREE.Mesh(postGeo, wood);
      post.position.set(x, gy + postH / 2 - 0.15, z);
      post.castShadow = true;
      this.group.add(post);
      // snow drift round the foot of the post
      const drift = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), snow);
      drift.scale.set(1, 0.32, 0.8);
      drift.position.set(x, gy - 0.05, z);
      this.group.add(drift);
    }
    // the banner board hangs between the posts, just below their tops
    const by = topY - 1.0;
    const board = new THREE.Mesh(new RoundedBoxGeometry(span + 0.2, 1.72, 0.16, 3, 0.06), darkWood);
    board.position.set(cx, by, z);
    board.castShadow = true;
    this.group.add(board);
    for (const dir of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.2, 1.5), bannerMat);
      face.position.set(cx, by, z + dir * 0.085);
      if (dir < 0) face.rotation.y = Math.PI;
      this.group.add(face);
    }
    // snow lying on the board and post tops
    const snowTop = new THREE.Mesh(new RoundedBoxGeometry(span + 0.1, 0.12, 0.22, 2, 0.05), snow);
    snowTop.position.set(cx, by + 0.9, z);
    this.group.add(snowTop);
    for (const side of [-1, 1]) {
      const cap = new THREE.Mesh(capGeo, snow);
      cap.position.set(cx + side * span * 0.5, topY, z);
      this.group.add(cap);
    }

    // --- start wand just ahead of the waiting skier ------------------------------------
    const cw = m.routeX(2.8);
    const wandMat = new THREE.MeshStandardMaterial({ color: 0xff3b2f, roughness: 0.5 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.6 });
    this.disposables.push(wandMat, orange);
    for (const side of [-1, 1]) {
      const x = cw + side * 1.25;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 12), orange);
      p.position.set(x, m.heightAt(x, 2.8) + 0.48, 2.8);
      this.group.add(p);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 10), wandMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(cw, m.heightAt(cw, 2.8) + 0.62, 2.8);
    this.group.add(bar);

    // --- hut (bevelled timber, gable roof under snow) -------------------------------
    const z0 = 0;
    const cx0 = m.routeX(z0);
    const hx = cx0 - 16;
    const hz = -14;
    const hy = m.heightAt(hx, hz);
    const body = new THREE.Mesh(new RoundedBoxGeometry(5, 3, 4, 3, 0.12), wood);
    body.position.set(hx, hy + 1.4, hz);
    const roofGroup = new THREE.Group();
    for (const side of [-1, 1]) {
      const slab = new THREE.Mesh(new RoundedBoxGeometry(5.8, 0.26, 2.9, 2, 0.1), darkWood);
      slab.position.set(0, 0, side * 1.15);
      slab.rotation.x = side * 0.62;
      const sn = new THREE.Mesh(new RoundedBoxGeometry(5.9, 0.22, 2.95, 2, 0.1), snow);
      sn.position.set(0, 0.2, side * 1.24);
      sn.rotation.x = side * 0.62;
      roofGroup.add(slab, sn);
    }
    roofGroup.position.set(hx, hy + 3.75, hz);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a3c, emissiveIntensity: 1.4 }));
    win.position.set(hx + 2.53, hy + 1.7, hz);
    win.rotation.y = Math.PI / 2;
    this.disposables.push(win.material as THREE.Material);
    for (const o of [body, win]) {
      o.castShadow = true;
      o.receiveShadow = true;
      this.group.add(o);
    }
    roofGroup.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    this.group.add(roofGroup);

    // --- fence lines either side of the start pen ------------------------------------
    const fenceGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.2, 10);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const zz = -6 - i * 3;
        const x = m.routeX(zz) + side * (5 + i * 0.6);
        const p = new THREE.Mesh(fenceGeo, darkWood);
        p.position.set(x, m.heightAt(x, zz) + 0.5, zz);
        this.group.add(p);
      }
    }
    const geos = new Set<THREE.BufferGeometry>();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) geos.add(mesh.geometry);
    });
    for (const g of geos) this.disposables.push(g);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
