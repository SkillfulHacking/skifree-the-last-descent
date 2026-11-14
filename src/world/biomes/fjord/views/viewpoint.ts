/**
 * A rim viewpoint ("utsikt"): a flagstone platform with a timber railing toward the fjord, a
 * bench, a coin telescope, a sign and a tall pole with a red pennant that reads from far up the
 * slope. Optional: skiing onto the platform reports ScenicLocationDiscovered (GameSession).
 */
import * as THREE from 'three';
import { mat, type Batch, type Rand } from '../../../resort/util';
import type { Mountain } from '../../../course';
import type { Lookout } from '../../../coast';

export function viewpointProps(b: Batch, m: Mountain, l: Lookout, rnd: Rand): void {
  const coast = m.coast!;
  const { x, z } = l;
  // face the sea (−x), turned a little down the fjord
  const yaw = -Math.PI / 2 + 0.35;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const sx = Math.cos(yaw);
  const sz = -Math.sin(yaw);
  // flagstone platform (follows the ground; its stones poke through the snow)
  for (let i = -2; i <= 2; i++)
    for (let j = -1; j <= 2; j++) {
      const px = x + sx * i * 1.8 + fx * j * 1.8;
      const pz = z + sz * i * 1.8 + fz * j * 1.8;
      const t = 0.3 + rnd.range(-0.05, 0.05);
      b.add('stone', new THREE.BoxGeometry(1.7, 0.4, 1.7), mat(px, m.heightAt(px, pz) - 0.12, pz, rnd.range(-0.04, 0.04), yaw + rnd.range(-0.1, 0.1), 0), new THREE.Color(t, t, t * 1.06));
    }
  // railing toward the fjord
  const rx = x + fx * 5;
  const rz = z + fz * 5;
  for (let i = -3; i <= 3; i++) {
    const px = rx + sx * i * 1.5;
    const pz = rz + sz * i * 1.5;
    b.add('paint', new THREE.CylinderGeometry(0.07, 0.08, 1.15, 6), mat(px, m.heightAt(px, pz) + 0.5, pz), 0x5a4030);
  }
  const ry = m.heightAt(rx, rz);
  b.add('paint', new THREE.BoxGeometry(9.4, 0.1, 0.14), mat(rx, ry + 1.05, rz, 0, yaw, 0), 0x6b4a35);
  b.add('paint', new THREE.BoxGeometry(9.4, 0.07, 0.1), mat(rx, ry + 0.6, rz, 0, yaw, 0), 0x6b4a35);
  b.add('snow', new THREE.BoxGeometry(9.2, 0.06, 0.16), mat(rx, ry + 1.13, rz, 0, yaw, 0), 0xffffff);
  // bench facing the view
  const bx = x - sx * 2.2 + fx * 1.2;
  const bz = z - sz * 2.2 + fz * 1.2;
  const by = m.heightAt(bx, bz);
  b.add('paint', new THREE.BoxGeometry(2.0, 0.08, 0.5), mat(bx, by + 0.48, bz, 0, yaw, 0), 0x7a5236);
  b.add('paint', new THREE.BoxGeometry(2.0, 0.45, 0.07), mat(bx - fx * 0.25, by + 0.78, bz - fz * 0.25, 0, yaw, 0), 0x7a5236);
  for (const k of [-0.8, 0.8]) b.add('paint', new THREE.BoxGeometry(0.08, 0.46, 0.46), mat(bx + sx * k, by + 0.23, bz + sz * k, 0, yaw, 0), 0x3a2a1e);
  b.add('snow', new THREE.BoxGeometry(1.9, 0.05, 0.42), mat(bx, by + 0.54, bz, 0, yaw, 0), 0xffffff);
  // coin telescope on a post
  const tx = x + sx * 2.2 + fx * 3.6;
  const tz = z + sz * 2.2 + fz * 3.6;
  const ty = m.heightAt(tx, tz);
  b.add('metal', new THREE.CylinderGeometry(0.08, 0.12, 1.1, 8), mat(tx, ty + 0.55, tz), 0x2f5d3a);
  b.add('metal', new THREE.CylinderGeometry(0.16, 0.12, 0.7, 10).rotateX(Math.PI / 2 - 0.15), mat(tx, ty + 1.25, tz, 0, yaw, 0), 0x2f5d3a);
  b.add('metal', new THREE.BoxGeometry(0.26, 0.3, 0.22), mat(tx - fx * 0.05, ty + 1.12, tz - fz * 0.05, 0, yaw, 0), 0x2a4a30);
  // sign board on two posts (faces back up the slope, toward arriving skiers)
  const gx = x - fx * 2.2 + sx * 3.4;
  const gz = z - fz * 2.2 + sz * 3.4;
  const gy = m.heightAt(gx, gz);
  for (const k of [-0.75, 0.75]) b.add('paint', new THREE.CylinderGeometry(0.06, 0.07, 2.2, 6), mat(gx + sx * k, gy + 1.1, gz + sz * k), 0x4a3426);
  b.add('sign', new THREE.PlaneGeometry(1.9, 0.6), mat(gx - fx * 0.05, gy + 1.75, gz - fz * 0.05, 0, yaw + Math.PI, 0), 0xffffff);
  b.add('paint', new THREE.BoxGeometry(2.0, 0.7, 0.05), mat(gx, gy + 1.75, gz, 0, yaw, 0), 0x2a2420);
  // tall pole with a red pennant: visible from far up the slope
  const px = x - sx * 3.8;
  const pz = z - sz * 3.8;
  const py = m.heightAt(px, pz);
  b.add('paint', new THREE.CylinderGeometry(0.06, 0.09, 8, 6), mat(px, py + 4, pz), 0xf2efe7);
  const pen = new THREE.BufferGeometry();
  pen.setAttribute('position', new THREE.Float32BufferAttribute([0, 7.9, 0, 0, 7.0, 0, 3.2, 7.45, 0.25, 0, 7.0, 0, 0, 7.9, 0, 3.2, 7.45, 0.25], 3));
  pen.computeVertexNormals();
  b.add('paint', pen, mat(px, py, pz, 0, -0.6, 0), 0xc81e1e);
  // a ring of cairns marks the platform's edge toward the cliff
  void coast;
}
