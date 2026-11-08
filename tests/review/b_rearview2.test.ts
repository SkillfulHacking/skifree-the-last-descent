import { it, expect } from 'vitest';
import * as THREE from 'three';
import { World } from '../../src/game/World';
// Round 2 (B2): replays the round-2 App.render() order: prepareRearView() sets rearCam from absolute
// renderPos / yeti.root.position BEFORE renderShifted, then both cameras are shifted with the scene.
it('rear-view camera stays ~60 m from the Yeti under a shifted origin', () => {
  const scene = new THREE.Scene();
  const yetiRoot = new THREE.Object3D(); scene.add(yetiRoot);
  const skierAbs = new THREE.Vector3(30, -900, 6500);
  yetiRoot.position.set(28, -895, 6440);
  const fake = { origin: new THREE.Vector3(0, -896, 6144), scene } as unknown as World;
  const cam = new THREE.PerspectiveCamera(); cam.position.copy(skierAbs).add(new THREE.Vector3(0, 3, -8));
  const rearCam = new THREE.PerspectiveCamera();
  rearCam.position.set(skierAbs.x + 2.4, skierAbs.y + 1.5, skierAbs.z + 1.5);
  rearCam.lookAt(yetiRoot.position.x, yetiRoot.position.y + 1.6, yetiRoot.position.z);
  rearCam.updateMatrixWorld();
  let d = 0, ahead = 0;
  World.prototype.renderShifted.call(fake, [cam, rearCam], () => {
    yetiRoot.updateMatrixWorld();
    d = rearCam.position.distanceTo(yetiRoot.position);
    const v = yetiRoot.position.clone().add(new THREE.Vector3(0, 1.6, 0)).project(rearCam);
    ahead = Math.hypot(v.x, v.y); // NDC distance from centre (0 = framed in the middle)
  });
  console.log(`round-2 order: rear-cam→yeti ${d.toFixed(1)} m, yeti NDC offset ${ahead.toFixed(3)}; after draw rearCam z=${rearCam.position.z.toFixed(1)} (absolute restored)`);
  expect(d).toBeGreaterThan(50); expect(d).toBeLessThan(70); expect(ahead).toBeLessThan(0.05);
  expect(rearCam.position.z).toBeCloseTo(skierAbs.z + 1.5, 3);
});
