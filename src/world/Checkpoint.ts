/**
 * Endless-mode checkpoint: a small timber refuge with a gate the skier passes through.
 * Lightweight (a handful of meshes, one canvas texture), built when near and disposed after.
 */
import * as THREE from 'three';
import type { Mountain } from './course';

export class Checkpoint {
  readonly group = new THREE.Group();
  /** gate centre (on the route) */
  readonly gate = new THREE.Vector3();
  private disposables: Array<{ dispose(): void }> = [];

  constructor(m: Mountain, readonly z: number, readonly index: number) {
    const x = m.routeX(z);
    this.gate.set(x, m.heightAt(x, z), z);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4529, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a2617, roughness: 0.9 });
    const snow = new THREE.MeshStandardMaterial({ color: 0xe9eef6, roughness: 0.9 });
    const warm = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a3c, emissiveIntensity: 1.6 });
    this.disposables.push(wood, dark, snow, warm);

    // banner
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 192;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#18324f';
    ctx.fillRect(0, 0, 1024, 192);
    ctx.fillStyle = '#ffb02e';
    ctx.fillRect(0, 168, 1024, 24);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '900 92px "Arial Black", Impact, sans-serif';
    ctx.fillText(`REFUGE ${index + 1}`, 512, 112);
    ctx.font = '700 28px Arial, sans-serif';
    ctx.fillText('CHECKPOINT · BANK YOUR RUN OR PUSH ON', 512, 152);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const bannerMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    this.disposables.push(tex, bannerMat);

    const span = 16;
    const gy = this.gate.y;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, ry = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.rotation.y = ry;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.disposables.push(geo);
      return mesh;
    };
    for (const side of [-1, 1]) {
      const px = x + side * span * 0.5;
      add(new THREE.CylinderGeometry(0.22, 0.26, 6, 8), wood, px, m.heightAt(px, z) + 3, z);
      add(new THREE.ConeGeometry(0.4, 0.5, 8), snow, px, m.heightAt(px, z) + 6.2, z);
    }
    add(new THREE.BoxGeometry(span, 2.2, 0.1), bannerMat, x, gy + 4.9, z);
    add(new THREE.BoxGeometry(span + 0.6, 0.18, 0.4), snow, x, gy + 6.05, z);

    // the refuge hut beside the piste (always on the wider side)
    const side = m.centerX(z) > x ? 1 : -1;
    const hx = x + side * (span * 0.5 + 12);
    const hz = z + 10;
    const hy = Math.min(m.heightAt(hx - 3, hz), m.heightAt(hx + 3, hz), m.heightAt(hx, hz - 3), m.heightAt(hx, hz + 3));
    add(new THREE.BoxGeometry(6, 3.4, 5), wood, hx, hy + 1.7, hz, side * 0.2);
    const roof = add(new THREE.ConeGeometry(5.2, 2.6, 4), snow, hx, hy + 4.6, hz, Math.PI / 4 + side * 0.2);
    roof.scale.set(1, 1, 0.85);
    add(new THREE.BoxGeometry(6.2, 0.6, 5.2), dark, hx, hy + 0.1, hz, side * 0.2);
    const win = add(new THREE.PlaneGeometry(1.4, 0.9), warm, hx - side * 3.02, hy + 1.8, hz, -side * Math.PI / 2 + side * 0.2);
    win.castShadow = false;
    // a glowing lamp at the gate so the refuge reads from far up the slope
    const lamp = add(new THREE.SphereGeometry(0.28, 10, 8), warm, x - span * 0.5, gy + 6.6, z);
    lamp.castShadow = false;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
