/**
 * "coastal-shelter" refuge: a red-painted mountain hut with a turf-and-snow roof on a dry-stone
 * base, a stacked-stone wind wall, a flag pole, a glowing lantern and a timber gate hung with a
 * "VARMESTUE" (warming hut) board that the skier passes through. Built per refuge when near, ~10
 * merged draw calls, disposed after.
 */
import * as THREE from 'three';
import type { Mountain } from '../../../course';
import type { RefugeView } from '../../../presentation/refuge';
import { Batch, Rand, mat } from '../../../resort/util';
import { cairn, house, kitMaterials } from './buildings';

function boardTexture(index: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8e2c1d';
  g.fillRect(0, 0, 1024, 192);
  g.strokeStyle = '#f2efe7';
  g.lineWidth = 10;
  g.strokeRect(12, 12, 1000, 168);
  g.fillStyle = '#f2efe7';
  g.textAlign = 'center';
  g.font = '900 84px "Arial Black", Impact, sans-serif';
  g.fillText(`VARMESTUE ${index + 1}`, 512, 106);
  g.font = '700 28px Arial, sans-serif';
  g.fillText('COASTAL SHELTER · REFUGE · BANK YOUR RUN OR PUSH ON', 512, 152);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class CoastalShelter implements RefugeView {
  readonly group = new THREE.Group();
  readonly gate = new THREE.Vector3();
  private mats: THREE.Material[] = [];
  private tex: THREE.Texture;

  constructor(m: Mountain, z: number, index: number) {
    const x = m.routeX(z);
    this.gate.set(x, m.heightAt(x, z), z);
    const rnd = new Rand(777 + index * 13);
    const K = kitMaterials();
    this.tex = boardTexture(index);
    const board = new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.75 });
    const lamp = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a3c, emissiveIntensity: 2.6 });
    const M: Record<string, THREE.Material> = { ...K, board, lamp };
    this.mats.push(...Object.values(M));
    const b = new Batch();
    // gate: two log posts, a crossbeam, the board, a lantern
    const span = 16;
    const gy = this.gate.y;
    for (const s of [-1, 1]) {
      const px = x + s * span * 0.5;
      const py = m.heightAt(px, z);
      b.add('paint', new THREE.CylinderGeometry(0.24, 0.28, 6.4, 8), mat(px, py + 3.1, z), 0x4a3424);
      b.add('snow', new THREE.ConeGeometry(0.42, 0.45, 8), mat(px, py + 6.45, z), 0xffffff);
      cairn(b, px + s * 1.4, py, z + 0.6, 1.3, rnd);
    }
    b.add('paint', new THREE.BoxGeometry(span + 0.8, 0.4, 0.4), mat(x, gy + 6.0, z), 0x4a3424);
    b.add('snow', new THREE.BoxGeometry(span + 0.6, 0.14, 0.42), mat(x, gy + 6.27, z), 0xffffff);
    b.add('board', new THREE.PlaneGeometry(span - 1, 2.2), mat(x, gy + 4.7, z - 0.06, 0, Math.PI, 0), 0xffffff);
    b.add('board', new THREE.PlaneGeometry(span - 1, 2.2), mat(x, gy + 4.7, z + 0.06), 0xffffff);
    b.add('lamp', new THREE.SphereGeometry(0.3, 10, 8), mat(x - span * 0.5, gy + 6.9, z), 0xffffff);
    // the hut, on the wider side of the piste, with a stone wind wall facing the sea
    const side = m.centerX(z) > x ? 1 : -1;
    const hx = x + side * (span * 0.5 + 13);
    const hz = z + 12;
    const hy = Math.min(m.heightAt(hx - 4, hz), m.heightAt(hx + 4, hz), m.heightAt(hx, hz - 3), m.heightAt(hx, hz + 3));
    house(b, hx, hy + 0.4, hz, side * 0.2, { w: 8, d: 5.6, h: 3.2, roofH: 2.2, color: 0x8e2c1d, door: 'side', chimney: true }, rnd);
    // turf showing under the snow at the eaves
    for (const s of [-1, 1]) b.add('paint', new THREE.BoxGeometry(8.6, 0.22, 0.4), mat(hx, hy + 0.4 + 3.2 + 0.05, hz + s * 3.05, 0, side * 0.2, 0), 0x4a4a2a);
    // dry-stone wind wall
    for (let i = 0; i < 9; i++) {
      const wx = hx - side * 7 + rnd.range(-0.4, 0.4);
      const wz = hz - 6 + i * 1.5;
      const t = 0.3 + rnd.range(-0.05, 0.05);
      b.add('stone', new THREE.DodecahedronGeometry(rnd.range(0.7, 1.0), 0).scale(1, 0.8, 1.2), mat(wx, m.heightAt(wx, wz) + 0.4, wz, rnd.range(0, 1), rnd.range(0, 6), 0), new THREE.Color(t, t, t * 1.08));
    }
    // flag pole with a pennant
    const fx = hx + side * 5;
    const fy = m.heightAt(fx, hz - 4);
    b.add('paint', new THREE.CylinderGeometry(0.06, 0.08, 7, 6), mat(fx, fy + 3.5, hz - 4), 0xf2efe7);
    const pen = new THREE.BufferGeometry();
    pen.setAttribute('position', new THREE.Float32BufferAttribute([0, 6.9, 0, 0, 6.1, 0, 2.8, 6.5, 0.2, 0, 6.1, 0, 0, 6.9, 0, 2.8, 6.5, 0.2], 3));
    pen.computeVertexNormals();
    b.add('paint', pen, mat(fx, fy, hz - 4, 0, 0.5, 0), 0xc81e1e);
    for (const me of b.build(M, { cast: true, receive: true })) this.group.add(me);
    // no PointLight: shelters stream in and out mid-run, and a change in the scene's light count
    // recompiles every lit material (three.js keys programs by light counts). The lamp glows by
    // its emissive material alone.
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
    this.tex.dispose();
    this.group.removeFromParent();
  }
}
