/**
 * The Yeti cave: a dark tunnel cut into the cliff, capped by a hood of snow-dusted boulders and
 * framed with icicles, plus the foreshadowing set dressing along the route (footprint trail, snapped
 * trees, warning sign) and an instanced footprint decal system shared with the live Yeti.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng, gnoise } from '../core/rng';
import { CAVE_D, COURSE, centerX, routeX, type Mountain } from './course';
import { brokenTreeGeometry, rockGeometry } from './props';

export class Cave {
  readonly group = new THREE.Group();
  /** world position of the mouth centre at floor level */
  readonly mouth = new THREE.Vector3();
  /** a point deep inside (where the Yeti lurks) */
  readonly inside = new THREE.Vector3();
  /** outward direction of the mouth (toward the piste, -X) */
  readonly outward = new THREE.Vector3(-1, 0, 0);
  readonly lipTop = new THREE.Vector3();
  private disposables: Array<{ dispose(): void }> = [];

  constructor(m: Mountain) {
    const z = COURSE.caveZ;
    const mx = centerX(z) + CAVE_D - 3; // floor ledge point at the mouth
    const floorY = m.heightAt(mx + 4, z);
    this.mouth.set(mx, floorY, z);
    this.inside.set(mx + 8.5, floorY, z);
    const g = this.group;

    // --- tunnel: a displaced half-tube running into the cliff (+X), closed at the back
    const len = 31;
    const radius = 6.2;
    const tube = new THREE.CylinderGeometry(radius, radius * 0.72, len, 26, 16, true, 0, Math.PI);
    tube.rotateZ(Math.PI / 2); // axis along X; the half-shell now arches over +Y (open floor)
    const tp = tube.getAttribute('position') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const cols = new Float32Array(tp.count * 3);
    for (let i = 0; i < tp.count; i++) {
      v.fromBufferAttribute(tp, i);
      const along = (v.x + len / 2) / len; // 0 mouth .. 1 back
      const n = gnoise(v.x * 0.35, v.y * 0.5 + v.z * 0.4, 51) * 1.0 + gnoise(v.x * 1.4, v.z * 1.2, 52) * 0.35;
      const r = Math.hypot(v.y, v.z);
      const k = (r + n) / Math.max(r, 1e-3);
      v.y = Math.max(-0.5, v.y * k * 1.12);
      v.z *= k;
      tp.setXYZ(i, v.x + len / 2, v.y, v.z);
      // darker the deeper you go; a cold blue ice tint near the mouth
      const dark = 0.5 * Math.pow(1 - along, 2.4) + 0.015;
      cols[i * 3] = dark * 0.82;
      cols[i * 3 + 1] = dark * 0.9;
      cols[i * 3 + 2] = dark * 1.08;
    }
    tube.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tube.computeVertexNormals();
    const tunnelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    const tunnel = new THREE.Mesh(tube, tunnelMat);
    tunnel.position.set(mx - 0.5, floorY - 0.6, z);
    tunnel.castShadow = true;
    tunnel.receiveShadow = true;
    g.add(tunnel);
    // back wall + dark floor so the interior reads as a deep void
    const back = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.25, 16), new THREE.MeshBasicMaterial({ color: 0x020305, side: THREE.DoubleSide }));
    back.position.set(mx + len - 1, floorY + 1, z);
    back.rotation.y = -Math.PI / 2;
    g.add(back);
    const floorGeo = new THREE.PlaneGeometry(len, radius * 2.1, 24, 6).rotateX(-Math.PI / 2);
    const fp = floorGeo.getAttribute('position') as THREE.BufferAttribute;
    const fcol = new Float32Array(fp.count * 3);
    for (let i = 0; i < fp.count; i++) {
      const along = (fp.getX(i) + len / 2) / len;
      fp.setY(i, gnoise(fp.getX(i) * 0.6, fp.getZ(i) * 0.6, 5) * 0.12);
      const c = 0.42 * Math.pow(1 - along, 2.2) + 0.03;
      fcol.set([c * 0.9, c * 0.95, c * 1.05], i * 3);
    }
    floorGeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    floor.position.set(mx + len / 2 - 0.5, floorY + 0.32, z);
    floor.receiveShadow = true;
    g.add(floor);
    this.disposables.push(tube, tunnelMat, back.geometry, back.material as THREE.Material, floorGeo, floor.material as THREE.Material);

    // --- rock frame: big boulders around the mouth (hide the tunnel/terrain seam)
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
    this.disposables.push(rockMat);
    const rng = new Rng(707);
    const rockGeos = [0, 1, 2, 3].map((i) => rockGeometry(i + 7, true, { flatten: 0.85, snow: 0.55, detail: 3 }));
    this.disposables.push(...rockGeos);
    const frame: THREE.Matrix4[] = [];
    const place = (x: number, y: number, zz: number, s: number, sy: number) => {
      const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y, zz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.3, 0.3), rng.range(0, 6), rng.range(-0.3, 0.3))), new THREE.Vector3(s, sy, s));
      frame.push(m4);
    };
    // arch crown around the mouth
    for (let a = 0; a <= 10; a++) {
      const t = (a / 10) * Math.PI;
      const ax = Math.cos(t) * (radius + 0.9);
      const ay = Math.sin(t) * (radius + 0.6);
      place(mx + rng.range(-0.2, 1.0), floorY + ay - 0.4, z + ax, rng.range(1.8, 2.8), rng.range(1.6, 2.4));
    }
    // the hood: a mass of huge boulders capping the tunnel and blending into the cliff behind
    for (let i = 0; i < 9; i++) {
      const along = 1.5 + i * 3.0;
      for (const side of [-1, 0, 1]) {
        const s = rng.range(3.4, 4.8) - Math.abs(side) * 0.6;
        place(mx + along + rng.range(-0.8, 0.8), floorY + radius + 1.4 + rng.range(-0.4, 1.4) - Math.abs(side) * 1.2, z + side * (radius * 0.75) + rng.range(-0.6, 0.6), s, s * rng.range(0.7, 0.95));
      }
    }
    // flanking piles and cliff-base rubble
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const zz = z + side * rng.range(radius + 1.5, radius + 20);
      const xx = mx + rng.range(-1, 6);
      const rs = rng.range(1.2, 3.6);
      place(xx, m.heightAt(xx, zz) - rs * 0.45, zz, rs, rs * rng.range(0.7, 1.1));
    }
    // outcrops embedded in the cliff face either side of the cave: break up the heightfield wall
    for (let i = 0; i < 46; i++) {
      const zz = z + (i % 2 ? 1 : -1) * rng.range(9, 75);
      const dd = rng.range(1, 9);
      const xx = centerX(zz) + CAVE_D + dd;
      const s = rng.range(2.5, 6.5);
      const yy = m.heightAt(xx, zz) - s * rng.range(0.35, 0.55);
      place(xx, yy, zz, s, s * rng.range(0.8, 1.3));
    }
    const ims = rockGeos.map((geo) => new THREE.InstancedMesh(geo, rockMat, frame.length));
    const counts = [0, 0, 0, 0];
    frame.forEach((m4, i) => {
      const k = i % 4;
      ims[k]!.setMatrixAt(counts[k]!++, m4);
    });
    ims.forEach((im, k) => {
      im.count = counts[k]!;
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      g.add(im);
    });

    // --- icicles hanging from the lip
    const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, roughness: 0.08, transmission: 0.6, thickness: 0.4, ior: 1.31, transparent: true, opacity: 0.9 });
    this.disposables.push(iceMat);
    const icicles: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 26; i++) {
      const t = (0.12 + 0.76 * (i / 25)) * Math.PI;
      const L = rng.range(0.4, 2.0);
      const c = new THREE.ConeGeometry(rng.range(0.06, 0.16), L, 6);
      c.rotateX(Math.PI);
      c.translate(mx - 1.0 + rng.range(-0.3, 0.3), floorY + Math.sin(t) * radius * 1.02 - L / 2 - 0.1, z + Math.cos(t) * radius * 0.95);
      icicles.push(c);
    }
    const iceGeo = mergeGeometries(icicles, false)!;
    this.disposables.push(iceGeo);
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.castShadow = true;
    g.add(ice);
    this.lipTop.set(mx, floorY + radius + 1.5, z);

    // claw marks on the rock beside the mouth (dark gouges)
    const clawMat = new THREE.MeshBasicMaterial({ color: 0x15171b, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.disposables.push(clawMat);
    for (let s = 0; s < 2; s++) {
      for (let k = 0; k < 4; k++) {
        const claw = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 1.5 + k * 0.12).translate(0, 0, 0), clawMat);
        claw.position.set(mx - 2.2, floorY + 2.4 + s * 0.5, z + (s ? 1 : -1) * (radius + 1.6) + k * 0.22);
        claw.rotation.set(0, -Math.PI / 2, 0.35);
        g.add(claw);
        this.disposables.push(claw.geometry);
      }
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}

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

  constructor(m: Mountain, footprints: Footprints) {
    // 1) a trail of huge footprints crossing the piste (twice)
    for (const [z0, dir] of [
      [905, 1],
      [1185, -1],
    ] as const) {
      const cx = centerX(z0);
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
    for (const [z, off, rot] of [
      [912, 26, 0.4],
      [1178, -24, 2.1],
      [1240, 30, 4.0],
    ] as const) {
      const x = routeX(z) + off;
      const t = new THREE.Mesh(broken, mat);
      t.position.set(x, m.heightAt(x, z) - 0.1, z);
      t.rotation.y = rot;
      t.castShadow = true;
      this.group.add(t);
    }
    // 3) an abandoned, half-buried warning sign (original wording)
    const z = 1010;
    const x = routeX(z) + 9;
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
    sign.rotation.y = Math.PI + 0.35; // faces uphill toward the approaching skier
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
