/**
 * W-076 review C (C1): the camera's swing from the cave cinematic's last shot to the follow camera
 * turns the camera — it starts exactly on the shot (no jump), watches the Yeti, and ends exactly on
 * the follow pose (no snap). The old quaternion slerp aliased the camera's own quaternion and kept
 * the shot's direction for the whole swing, then snapped round at its end.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyHandoffBlend } from '../../src/camera/handoffBlend';

const followCam = () => {
  const c = new THREE.PerspectiveCamera(64);
  c.position.set(0, 3, -6);
  c.lookAt(0, 1, 20); // downhill, ahead of the skier
  c.updateMatrixWorld();
  return c;
};
const dir = (c: THREE.Camera) => c.getWorldDirection(new THREE.Vector3());

describe('cave hand-off camera swing', () => {
  const shotPos = new THREE.Vector3(4, 2, -2);
  const shotLook = new THREE.Vector3(30, 8, -40); // back up the hill at the cave, ~160° from the follow aim
  const yeti = new THREE.Vector3(28, 6, -35);
  const run = (t: number) => {
    const c = followCam();
    const B = { pos: shotPos.clone(), look: shotLook.clone(), fov: 46, t, dur: 2.5 };
    const going = applyHandoffBlend(c, B, yeti);
    c.updateMatrixWorld();
    return { c, going };
  };
  it('starts on the shot: same position, aim and fov', () => {
    const { c } = run(0);
    expect(c.position.distanceTo(shotPos)).toBeLessThan(1e-9);
    expect(dir(c).angleTo(shotLook.clone().sub(shotPos).normalize())).toBeLessThan(1e-6);
    expect(c.fov).toBeCloseTo(46, 9);
  });
  it('turns steadily from the shot to the follow aim, with no jump between frames', () => {
    const f = dir(followCam());
    let prev = Infinity;
    let prevDir = dir(run(0).c);
    let maxStep = 0;
    for (let t = 1 / 60; t <= 2.5 + 1e-9; t += 1 / 60) {
      const d = dir(run(t).c);
      maxStep = Math.max(maxStep, d.angleTo(prevDir));
      prevDir = d;
      if (t > 1.25) {
        const a = d.angleTo(f);
        expect(a).toBeLessThanOrEqual(prev + 1e-9);
        prev = a;
      }
    }
    // the largest frame-to-frame turn: a swing, not a cut (well under 10° per frame at 60 fps)
    expect(maxStep).toBeLessThan((10 * Math.PI) / 180);
  });
  it('ends exactly on the follow pose (no snap when the swing is dropped)', () => {
    const { c, going } = run(2.5);
    const f = followCam();
    expect(going).toBe(false);
    expect(c.position.distanceTo(f.position)).toBeLessThan(1e-9);
    expect(dir(c).angleTo(dir(f))).toBeLessThan(1e-6);
    expect(c.fov).toBeCloseTo(64, 9);
  });
  it('mid-swing the camera is pointed between the shot and the follow aim (the old blend stayed on the shot)', () => {
    const d = dir(run(1.9).c);
    const shot = shotLook.clone().sub(shotPos).normalize();
    expect(d.angleTo(shot)).toBeGreaterThan(0.3);
    expect(d.angleTo(dir(followCam()))).toBeGreaterThan(0.1);
  });
});
