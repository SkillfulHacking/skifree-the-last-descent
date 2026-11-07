/**
 * Foreshadowing set dressing along the route before a cave (footprint trail, snapped trees, warning
 * sign) and the instanced footprint decal system shared with the live Yeti.
 */
import * as THREE from 'three';
import type { Mountain } from '../course';
import type { CaveAnchor } from '../caveTerrain';
import { brokenTreeGeometry } from '../props';

/** Instanced footprint decals (ring buffer). */
export class Footprints {
  readonly mesh: THREE.InstancedMesh;
  private head = 0;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private n = { x: 0, y: 1, z: 0 };

  constructor(private m: Mountain, capacity = 400) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    // a big five-toed print: soft blue-grey shadowed impression
    const grad = (x: number, y: number, r: number) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(70,90,120,0.85)');
      gr.addColorStop(0.7, 'rgba(90,110,140,0.55)');
      gr.addColorStop(1, 'rgba(120,140,170,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    grad(64, 78, 30);
    grad(64, 46, 26);
    for (let i = 0; i < 5; i++) grad(34 + i * 15, 18 + Math.abs(i - 2) * 4, 9);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const geo = new THREE.PlaneGeometry(0.9, 1.3).rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.count = capacity;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, hide);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
  }

  add(x: number, z: number, heading: number, side: 'left' | 'right', scale = 1) {
    this.m.normalAt(x, z, this.n);
    const y = this.m.heightAt(x, z) + 0.03;
    const yaw = new THREE.Quaternion().setFromAxisAngle(this.up, heading + (side === 'left' ? 0.12 : -0.12));
    this.q.setFromUnitVectors(this.up, new THREE.Vector3(this.n.x, this.n.y, this.n.z)).multiply(yaw);
    this.m4.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(scale * (side === 'left' ? -1 : 1), 1, scale));
    this.mesh.setMatrixAt(this.head, this.m4);
    this.head = (this.head + 1) % this.mesh.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Hide all prints (start of a new run). */
  clear() {
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.mesh.count; i++) this.mesh.setMatrixAt(i, hide);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.head = 0;
  }

  dispose() {
    this.mesh.geometry.dispose();
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.map?.dispose();
    mat.dispose();
  }
}

/** Foreshadowing set dressing along the route between foreshadowZ and the cave. */
export class StoryProps {
  readonly group = new THREE.Group();
  readonly signPos = new THREE.Vector3();
  private disposables: Array<{ dispose(): void }> = [];

  constructor(m: Mountain, footprints: Footprints, anchor: CaveAnchor) {
    const Z = anchor.z;
    const side = anchor.side;
    // 1) a trail of huge footprints crossing the piste (twice)
    for (const [dz, dir0] of [
      [-445, 1],
      [-165, -1],
    ] as const) {
      const z0 = Z + dz;
      const dir = dir0 * side;
      const cx = m.centerX(z0);
      for (let i = -14; i <= 14; i++) {
        const x = cx + i * 2.4 * dir;
        const z = z0 + i * 0.9 + (i % 2) * 0.6;
        footprints.add(x, z, Math.atan2(2.4 * dir, 0.9), i % 2 ? 'left' : 'right', 1.15);
      }
    }
    // 2) snapped trees next to the trail
    const broken = brokenTreeGeometry();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    this.disposables.push(broken, mat);
    for (const [dz, off, rot] of [
      [-438, 26, 0.4],
      [-172, -24, 2.1],
      [-110, 30, 4.0],
    ] as const) {
      const z = Z + dz;
      const x = m.routeX(z) + off * side;
      const t = new THREE.Mesh(broken, mat);
      t.position.set(x, m.heightAt(x, z) - 0.1, z);
      t.rotation.y = side > 0 ? rot : -rot;
      t.castShadow = true;
      this.group.add(t);
    }
    // 3) an abandoned, half-buried warning sign (original wording)
    const z = Z - 340;
    const x = m.routeX(z) + 9 * side;
    this.signPos.set(x, m.heightAt(x, z), z);
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.06 + (i % 3) * 0.04})`;
      ctx.fillRect(0, i * 29, 512, 2);
    }
    ctx.fillStyle = '#f2e9d8';
    ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TURN BACK', 256, 92);
    ctx.font = 'bold 34px "Arial Black", sans-serif';
    ctx.fillText('PISTE CLOSED BEYOND', 256, 150);
    ctx.fillText('THIS POINT', 256, 192);
    // claw scratches across the board
    ctx.strokeStyle = 'rgba(20,12,6,0.85)';
    ctx.lineWidth = 7;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(300 + i * 26, 20);
      ctx.lineTo(220 + i * 26, 240);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.9 });
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.08), [woodMat, woodMat, woodMat, woodMat, faceMat, woodMat]);
    board.position.set(0, 1.5, 0);
    board.rotation.set(0.05, 0, -0.22);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), woodMat);
    post.position.set(0.1, 0.9, -0.08);
    post.rotation.z = -0.18;
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xe8edf5, roughness: 0.9 });
    const snowCap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.2), snowMat);
    snowCap.position.set(-0.02, 2.13, 0);
    snowCap.rotation.copy(board.rotation);
    const sign = new THREE.Group();
    sign.add(board, post, snowCap);
    sign.position.copy(this.signPos);
    sign.rotation.y = Math.PI + 0.35 * side; // faces uphill toward the approaching skier
    sign.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    this.group.add(sign);
    this.disposables.push(tex, woodMat, faceMat, snowMat, board.geometry, post.geometry, snowCap.geometry);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
