/**
 * "ridge-rescue-hut" refuge (W-020; spec: "Whiteout: illuminated rescue stations"): the refuge gate
 * between two lattice towers with amber storm lamps and a red REFUGE banner, and beside the piste a
 * small rescue hut (red boarding, white rescue cross, lit windows, a heavy snow load, a red beacon on
 * a short mast, a drift on its windward wall) that reads from far up the slope in a storm. Same
 * footprint as the Alpine refuge (gate on the line, hut on the wider side), ~25 meshes, disposed with
 * the refuge.
 */
import * as THREE from 'three';
import type { Mountain } from '../../../course';
import type { RefugeView } from '../../../presentation/refuge';

function bannerTexture(index: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b5281c';
  g.fillRect(0, 0, 1024, 192);
  g.fillStyle = '#f4efe6';
  g.fillRect(28, 40, 112, 112);
  g.fillStyle = '#b5281c';
  g.fillRect(70, 52, 28, 88);
  g.fillRect(40, 82, 88, 28);
  g.fillStyle = '#f4efe6';
  g.textAlign = 'center';
  g.font = '900 86px "Arial Black", Impact, sans-serif';
  g.fillText(`RESCUE HUT ${index + 1}`, 580, 108);
  g.font = '700 26px Arial, sans-serif';
  g.fillText('REFUGE  ·  SHELTER FROM THE STORM  ·  BANK YOUR RUN OR PUSH ON', 580, 156);
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

export class RidgeRescueHut implements RefugeView {
  readonly group = new THREE.Group();
  readonly gate = new THREE.Vector3();
  private disposables: Array<{ dispose(): void }> = [];

  constructor(m: Mountain, z: number, index: number) {
    const x = m.routeX(z);
    this.gate.set(x, m.heightAt(x, z), z);
    const mk = <T extends { dispose(): void }>(o: T): T => {
      this.disposables.push(o);
      return o;
    };
    const steel = mk(new THREE.MeshStandardMaterial({ color: 0x7d838c, roughness: 0.45, metalness: 0.7 }));
    const redWall = mk(new THREE.MeshStandardMaterial({ color: 0xa3231a, roughness: 0.8 }));
    const trim = mk(new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.6 }));
    const roofM = mk(new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.55, metalness: 0.35 }));
    const snow = mk(new THREE.MeshStandardMaterial({ color: 0xeef2f8, roughness: 0.9 }));
    const stone = mk(new THREE.MeshStandardMaterial({ color: 0x585c63, roughness: 0.95 }));
    const warm = mk(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.66, 0.28) }));
    const tex = mk(bannerTexture(index));
    const bannerM = mk(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, parent: THREE.Object3D = this.group, cast = true) => {
      mk(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const sprite = (color: number, scale: number, px: number, py: number, pz: number) => {
      const s = new THREE.Sprite(mk(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
      s.scale.setScalar(scale);
      s.position.set(px, py, pz);
      this.group.add(s);
    };
    // the gate: two lattice towers with lamps, the banner between them
    const span = 16;
    const gy = this.gate.y;
    for (const side of [-1, 1]) {
      const px = x + side * span * 0.5;
      const py = m.heightAt(px, z) - 0.3;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        add(new THREE.CylinderGeometry(0.04, 0.05, 6.6, 5), steel, px + Math.cos(a) * 0.3, py + 3.3, z + Math.sin(a) * 0.3, this.group, false);
      }
      for (let j = 1; j <= 5; j++) add(new THREE.TorusGeometry(0.3, 0.015, 3, 6), steel, px, py + j * 1.1, z, this.group, false).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 10), stone, px, py + 6.75, z);
      add(new THREE.SphereGeometry(0.17, 10, 8), warm, px, py + 6.75, z + 0.12, this.group, false);
      sprite(0xffa040, 2.6, px, py + 6.75, z + 0.15);
    }
    add(new THREE.BoxGeometry(span - 1, 2.0, 0.08), bannerM, x, gy + 4.9, z);
    add(new THREE.BoxGeometry(span, 0.14, 0.14), steel, x, gy + 6.0, z);
    add(new THREE.BoxGeometry(span - 0.6, 0.14, 0.3), snow, x, gy + 6.12, z, this.group, false);
    // the hut beside the piste (on the wider side), facing the line
    const side = m.centerX(z) > x ? 1 : -1;
    const hx = x + side * (span * 0.5 + 13);
    const hz = z + 10;
    const hy = Math.min(m.heightAt(hx - 3.5, hz), m.heightAt(hx + 3.5, hz), m.heightAt(hx, hz - 3), m.heightAt(hx, hz + 3)) - 0.2;
    const hut = new THREE.Group();
    hut.position.set(hx, hy, hz);
    hut.rotation.y = side > 0 ? -Math.PI / 2 + 0.15 : Math.PI / 2 - 0.15;
    this.group.add(hut);
    add(new THREE.BoxGeometry(6.4, 0.9, 5.2), stone, 0, 0.25, 0, hut);
    add(new THREE.BoxGeometry(6, 3.0, 4.8), redWall, 0, 2.2, 0, hut);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.18, 3.0, 0.18), trim, sx * 3.01, 2.2, sz * 2.41, hut, false);
    // steep gable roof with a thick snow load
    const shape = new THREE.Shape();
    shape.moveTo(-3.7, 0);
    shape.lineTo(0, 2.6);
    shape.lineTo(3.7, 0);
    shape.lineTo(-3.7, 0);
    const roofG = new THREE.ExtrudeGeometry(shape, { depth: 5.6, bevelEnabled: false });
    roofG.translate(0, 0, -2.8);
    add(roofG, roofM, 0, 3.7, 0, hut);
    const snowG = new THREE.ExtrudeGeometry(shape, { depth: 5.8, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2 });
    snowG.translate(0, 0, -2.9);
    add(snowG, snow, 0, 3.92, 0, hut).scale.set(0.97, 0.9, 1);
    // the rescue cross on the gable facing the line, lit windows and the door
    add(new THREE.BoxGeometry(0.42, 1.3, 0.05), trim, 0, 4.6, 2.43, hut, false);
    add(new THREE.BoxGeometry(1.3, 0.42, 0.05), trim, 0, 4.6, 2.43, hut, false);
    for (const wx of [-1.6, 1.6]) {
      add(new THREE.PlaneGeometry(1.0, 0.8), warm, wx, 2.5, 2.42, hut, false);
      add(new THREE.BoxGeometry(1.2, 0.1, 0.12), trim, wx, 2.95, 2.45, hut, false);
      add(new THREE.BoxGeometry(1.2, 0.1, 0.16), snow, wx, 2.06, 2.48, hut, false);
    }
    add(new THREE.PlaneGeometry(1.0, 2.0), mk(new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.7 })), 0, 1.75, 2.42, hut, false);
    add(new THREE.SphereGeometry(0.12, 8, 6), warm, 0, 3.0, 2.55, hut, false);
    // a drift banked on the windward wall
    const drift = add(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), snow, 0, 0.1, -2.7, hut, false);
    drift.scale.set(3.4, 1.4, 1.6);
    // the beacon mast
    add(new THREE.CylinderGeometry(0.05, 0.06, 4.5, 6), steel, 3.4, 2.25, -1.8, hut);
    const bp = new THREE.Vector3(3.4, 4.6, -1.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), hut.rotation.y).add(hut.position);
    sprite(0xff2a14, 2.4, bp.x, bp.y, bp.z);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
