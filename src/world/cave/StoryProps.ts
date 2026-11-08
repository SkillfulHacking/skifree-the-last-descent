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
    // a big print pressed into the snow, built as a height field: one irregular depression (heel and ball
    // merged, the toes only lumps along its front edge, never separate dots) with a low ridge of pushed-out
    // snow around it and crumbled, noisy edges. The normal map carries the read (walls catch and lose the
    // light); colour is only a faint cold shade in the deepest part and a brighter crust on the ridge, so
    // there is no graphic outline or icon shape.
    const N = 128;
    const hgt = new Float32Array(N * N);
    const vn = (x: number, y: number, sd: number) => {
      const h = (i: number, j: number) => {
        let k = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(sd, 1442695041);
        k = Math.imul(k ^ (k >>> 13), 1274126177);
        return ((k ^ (k >>> 16)) >>> 0) / 4294967296;
      };
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
      return h(i, j) + (h(i + 1, j) - h(i, j)) * u + (h(i, j + 1) - h(i, j) + (h(i + 1, j + 1) - h(i + 1, j) - h(i, j + 1) + h(i, j)) * u) * w;
    };
    // signed "inside" field: >0 inside the print
    const shape = (x: number, y: number) => {
      const e = (cx: number, cy: number, rx: number, ry: number) => 1 - Math.hypot((x - cx) / rx, (y - cy) / ry);
      let f = Math.max(e(64, 86, 21, 24), e(62, 56, 26, 22), e(66, 70, 22, 26));
      // toes: overlapping lumps on the front edge (merged, uneven sizes)
      const toes: Array<[number, number, number]> = [[38, 34, 10], [50, 27, 10.5], [63, 24, 11], [76, 27, 10], [87, 35, 9]];
      for (const [tx, ty, r] of toes) f = Math.max(f, (1 - Math.hypot((x - tx) / r, (y - ty) / (r * 1.25))) * 0.75);
      return f + 0.16 * (vn(x * 0.11, y * 0.11, 3) - 0.5) + 0.07 * (vn(x * 0.33, y * 0.33, 4) - 0.5);
    };
    const S = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) S[x + y * N] = shape(x, y);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const f = S[x + y * N]!;
        // depth: steep crumbly wall, packed (flat-ish, uneven) bottom
        const depth = Math.min(1, Math.max(0, f * 4.5)) * (0.8 + 0.2 * vn(x * 0.2, y * 0.2, 5));
        // pushed-out ridge just outside the wall
        const ridge = Math.max(0, 1 - Math.abs(f + 0.08) / 0.09) * (0.25 + 0.2 * vn(x * 0.15, y * 0.15, 6));
        hgt[x + y * N] = depth - ridge;
      }
    }
    // fade everything to zero at the quad border (no edge)
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const bx = Math.min(x, N - 1 - x) / 10, by = Math.min(y, N - 1 - y) / 10;
        hgt[x + y * N]! *= Math.min(1, bx, by);
      }
    }
    const cCol = document.createElement('canvas');
    const cNrm = document.createElement('canvas');
    cCol.width = cCol.height = cNrm.width = cNrm.height = N;
    const col = cCol.getContext('2d')!.createImageData(N, N);
    const nrm = cNrm.getContext('2d')!.createImageData(N, N);
    const H = (x: number, y: number) => hgt[Math.min(N - 1, Math.max(0, x)) + Math.min(N - 1, Math.max(0, y)) * N]!;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const k = (x + y * N) * 4;
        const d = H(x, y);
        // depression: surface height = -d (smoothed gradient over 2 px)
        const gx = -(H(x + 2, y) - H(x - 2, y)) * 0.25, gy = -(H(x, y + 2) - H(x, y - 2)) * 0.25;
        const s = 7;
        let nx = -gx * s, ny = gy * s, nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l; ny /= l; nz /= l;
        nrm.data[k] = (nx * 0.5 + 0.5) * 255;
        nrm.data[k + 1] = (ny * 0.5 + 0.5) * 255;
        nrm.data[k + 2] = (nz * 0.5 + 0.5) * 255;
        nrm.data[k + 3] = 255;
        const deep = Math.max(0, d), crust = Math.max(0, -d) * 3;
        const c = deep > crust ? [0.8, 0.85, 0.93] : [0.97, 0.98, 1.0];
        col.data[k] = c[0]! * 255;
        col.data[k + 1] = c[1]! * 255;
        col.data[k + 2] = c[2]! * 255;
        // alpha only carries the normal map's lighting; the tint itself stays faint
        col.data[k + 3] = Math.min(0.85, Math.max(deep * 1.4, crust * 0.7, Math.hypot(gx, gy) * 5)) * 255;
      }
    }
    cCol.getContext('2d')!.putImageData(col, 0, 0);
    cNrm.getContext('2d')!.putImageData(nrm, 0, 0);
    const tex = new THREE.CanvasTexture(cCol);
    tex.colorSpace = THREE.SRGBColorSpace;
    const ntex = new THREE.CanvasTexture(cNrm);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      normalMap: ntex,
      normalScale: new THREE.Vector2(1, 1),
      transparent: true,
      depthWrite: false,
      roughness: 0.92,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
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
    mat.normalMap?.dispose();
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
