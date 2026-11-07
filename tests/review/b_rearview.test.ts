import { it, expect } from 'vitest';
import * as THREE from 'three';
import { World } from '../../src/game/World';
// Replays App.render(): renderShifted([camera, rearCam], () => { render main; renderRearView() })
// where renderRearView sets rearCam from GameSession.rearView(): pos from renderPos (absolute, not in
// the scene) and look from yeti.root.position (a scene child, shifted during draw).
it('rear-view camera is placed in absolute coordinates inside the shifted render', () => {
  const scene = new THREE.Scene();
  const yetiRoot = new THREE.Object3D(); scene.add(yetiRoot);
  const skierAbs = new THREE.Vector3(30, -900, 2500); // renderPos (absolute)
  yetiRoot.position.set(28, -895, 2440); // 60 m behind
  const fake = { origin: new THREE.Vector3(0, 0, 2048), scene } as unknown as World;
  const cam = new THREE.PerspectiveCamera(); cam.position.copy(skierAbs).add(new THREE.Vector3(0, 3, -8));
  const rearCam = new THREE.PerspectiveCamera();
  let seen: { rear: THREE.Vector3; yeti: THREE.Vector3; main: THREE.Vector3 } | null = null;
  World.prototype.renderShifted.call(fake, [cam, rearCam], () => {
    const p = skierAbs; // GameSession.rearView: out.pos from this.renderPos
    rearCam.position.set(p.x + 2.4, p.y + 1.5, p.z + 1.5);
    rearCam.lookAt(yetiRoot.position.x, yetiRoot.position.y + 1.6, yetiRoot.position.z);
    rearCam.updateMatrixWorld();
    seen = { rear: rearCam.position.clone(), yeti: yetiRoot.position.clone(), main: cam.position.clone() };
  });
  const d = seen!.rear.distanceTo(seen!.yeti);
  console.log(`during draw: main cam z=${seen!.main.z.toFixed(0)}, yeti z=${seen!.yeti.z.toFixed(0)}, rear cam z=${seen!.rear.z.toFixed(0)}; rear-cam→yeti distance ${d.toFixed(0)} m (should be ~60)`);
  expect(d).toBeGreaterThan(1000);
});
