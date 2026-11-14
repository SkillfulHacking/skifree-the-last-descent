// Tracks GPU-backed resources reachable from scene roots and whether each received a 'dispose' event.
import type * as THREE from 'three';

export class ResourceTracker {
  geos = new Map<THREE.BufferGeometry, boolean>();
  mats = new Map<THREE.Material, boolean>();
  texs = new Map<THREE.Texture, boolean>();
  lights = 0;
  see(root: THREE.Object3D) {
    root.traverse((o) => {
      const any = o as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[]; isLight?: boolean };
      if (any.isLight) this.lights++;
      if (any.geometry) this.g(any.geometry);
      const ms = Array.isArray(any.material) ? any.material : any.material ? [any.material] : [];
      for (const m of ms) this.m(m);
    });
  }
  private g(g: THREE.BufferGeometry) {
    if (this.geos.has(g)) return;
    this.geos.set(g, false);
    g.addEventListener('dispose', () => this.geos.set(g, true));
  }
  private m(m: THREE.Material) {
    if (!this.mats.has(m)) {
      this.mats.set(m, false);
      m.addEventListener('dispose', () => this.mats.set(m, true));
    }
    for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) this.t(v as THREE.Texture);
    const u = (m as THREE.ShaderMaterial).uniforms;
    if (u) for (const x of Object.values(u)) if ((x?.value as THREE.Texture | undefined)?.isTexture) this.t(x.value as THREE.Texture);
  }
  private t(t: THREE.Texture) {
    if (this.texs.has(t)) return;
    this.texs.set(t, false);
    t.addEventListener('dispose', () => this.texs.set(t, true));
  }
  undisposed() {
    const c = (m: Map<unknown, boolean>) => [...m.values()].filter((v) => !v).length;
    return { geos: c(this.geos), mats: c(this.mats), texs: c(this.texs), totalGeos: this.geos.size, totalMats: this.mats.size, totalTexs: this.texs.size };
  }
}

/** Lights under a root (any light added mid-run would recompile every lit material). */
export function countLights(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as THREE.Light).isLight) n++;
  });
  return n;
}
