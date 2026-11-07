/**
 * Trail markers for an alternate line: pairs of slim poles with coloured tips along both edges of
 * the cleared lane, so the shortcut reads from up the slope. One instanced mesh per line.
 */
import * as THREE from 'three';
import type { AltRoute, Mountain } from './course';

const geo = new THREE.CylinderGeometry(0.035, 0.045, 1.8, 5).translate(0, 0.9, 0);
const mat = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.6 });
{
  // tip colour band via a second material group would cost a draw call; use instance colours
  mat.color.set(0xffffff);
}

export class AltMarkers {
  readonly mesh: THREE.InstancedMesh;

  constructor(m: Mountain, readonly alt: AltRoute) {
    const zs: number[] = [];
    for (let z = alt.z0; z <= alt.z1; z += 28) zs.push(z);
    this.mesh = new THREE.InstancedMesh(geo, mat, zs.length * 2);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    let i = 0;
    for (const z of zs) {
      const x = m.profile.altRouteX(z);
      if (x === null) continue;
      for (const side of [-1, 1]) {
        const px = x + side * 5.2;
        m4.makeTranslation(px, m.heightAt(px, z) - 0.05, z);
        this.mesh.setMatrixAt(i, m4);
        this.mesh.setColorAt(i, col.set(side < 0 ? 0xff7a1a : 0x2d7dff));
        i++;
      }
    }
    this.mesh.count = i;
    this.mesh.castShadow = true;
    this.mesh.computeBoundingSphere();
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.dispose();
  }
}
