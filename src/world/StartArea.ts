/** Summit start gate: timber posts, a start banner, a little hut and some fencing. */
import * as THREE from 'three';
import { routeX, type Mountain } from './course';

export class StartArea {
  readonly group = new THREE.Group();
  private disposables: Array<{ dispose(): void }> = [];

  constructor(m: Mountain) {
    const z = -4;
    const cx = routeX(0);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6e4a2b, roughness: 0.85 });
    const snow = new THREE.MeshStandardMaterial({ color: 0xe9eef6, roughness: 0.9 });
    this.disposables.push(wood, snow);
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 192;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createLinearGradient(0, 0, 1024, 0);
    grd.addColorStop(0, '#0f2a4a');
    grd.addColorStop(1, '#173f6b');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 1024, 192);
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
    this.disposables.push(tex);
    const span = 9;
    for (const side of [-1, 1]) {
      const x = cx + side * span * 0.5;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 0.35), wood);
      post.position.set(x, m.heightAt(x, z) + 2.0, z);
      post.castShadow = true;
      this.group.add(post);
      this.disposables.push(post.geometry);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(span, 1.5, 0.12), [wood, wood, snow, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })]);
    banner.position.set(cx, m.heightAt(cx, z) + 3.6, z);
    banner.castShadow = true;
    this.group.add(banner);
    // starting wand bar
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0xff3b2f }));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(cx, m.heightAt(cx, z + 1) + 0.55, z + 1);
    this.group.add(bar);
    // hut
    const hx = cx - 16;
    const hz = -14;
    const hy = m.heightAt(hx, hz);
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), wood);
    body.position.set(hx, hy + 1.4, hz);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 3.9, 2.2, 4, 1), snow);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(hx, hy + 4.0, hz);
    roof.scale.set(1, 1, 0.85);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a3c, emissiveIntensity: 1.4 }));
    win.position.set(hx + 2.51, hy + 1.7, hz);
    win.rotation.y = Math.PI / 2;
    for (const o of [body, roof, win]) {
      o.castShadow = true;
      o.receiveShadow = true;
      this.group.add(o);
    }
    // fence lines
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const zz = z - 2 - i * 3;
        const x = cx + side * (span * 0.5 + 0.5 + i * 0.6);
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5), wood);
        p.position.set(x, m.heightAt(x, zz) + 0.6, zz);
        this.group.add(p);
      }
    }
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) this.disposables.push(mesh.geometry);
    });
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
