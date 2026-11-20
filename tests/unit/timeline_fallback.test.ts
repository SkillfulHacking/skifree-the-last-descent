/**
 * Gitar (round 3): past every shot, the timeline holds the shot that ends last — not the last one
 * pushed. A location's cinematic pushes its own (earlier) shots after the base ones; on the cave
 * cinematic's final frame the camera snapped back to Fjord's roar close-up.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Timeline, pose } from '../../src/cinematic/Timeline';

describe('Timeline.apply past the end', () => {
  it('holds the latest-ending shot, whatever the order the shots were pushed in', () => {
    const tl = new Timeline();
    const P = (x: number) => () => pose(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 0, 10), 50);
    tl.shot({ start: 14.2, end: 14.6, from: P(1), to: P(2) }); // the base cinematic's last shot
    tl.shot({ start: 11.0, end: 12.3, from: P(90), to: P(91) }); // a location's roar close-up, pushed later
    tl.advance(14.6 + 1 / 30);
    const cam = new THREE.PerspectiveCamera();
    expect(tl.apply(cam)).toBe(true);
    expect(cam.position.x).toBeCloseTo(2, 6);
  });
  it('on a tie, the later-pushed shot (as inside the shots)', () => {
    const tl = new Timeline();
    const P = (x: number) => () => pose(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 0, 10), 50);
    tl.shot({ start: 0, end: 2, from: P(1), to: P(2) });
    tl.shot({ start: 1, end: 2, from: P(7), to: P(8) });
    tl.advance(3);
    const cam = new THREE.PerspectiveCamera();
    tl.apply(cam);
    expect(cam.position.x).toBeCloseTo(8, 6);
  });
});
