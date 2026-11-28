/** Cinematic building blocks: eased camera moves, shots and fire-once timed events. */
import * as THREE from 'three';
import { clamp } from '../core/rng';
import { orbitPose } from './orbit';

export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => t * t * (3 - 2 * t),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - (1 - t) * (1 - t),
  in: (t: number) => t * t,
};

export interface CamPose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

/** A shot: a camera move from `from` to `to` (each may be a function evaluated every frame, for tracking). */
export interface Shot {
  start: number;
  end: number;
  from: () => CamPose;
  to: () => CamPose;
  /** Optional middle control pose for curved moves (quadratic bezier). */
  via?: () => CamPose;
  easing?: (t: number) => number;
  /** Handheld-like drift amplitude (metres). */
  handheld?: number;
  /** Swing around this point instead of a straight move (cinematic/orbit.ts); `via` is ignored. */
  orbit?: () => THREE.Vector3;
  /**
   * Optional: the shot plays only while this holds, read every frame (round 4, W-088: a setting changed
   * in the pause menu mid-cinematic takes effect at once). A skipped shot leaves the time to the others.
   */
  when?: () => boolean;
}

export interface TimedEvent {
  at: number;
  fn: () => void;
  fired?: boolean;
}

export class Timeline {
  time = 0;
  /**
   * (Round 5, W-098 / review E4-3) Reduce Camera Motion, read live: every shot holds its end framing
   * (a cut, not a crane or dolly) and the handheld drift is off. A shot that follows a moving subject
   * still follows it — its end pose is recomputed each frame.
   */
  calm: () => boolean = () => false;
  readonly shots: Shot[] = [];
  readonly events: TimedEvent[] = [];
  duration = 0;

  shot(s: Shot) {
    this.shots.push(s);
    this.duration = Math.max(this.duration, s.end);
    return this;
  }

  at(t: number, fn: () => void) {
    this.events.push({ at: t, fn });
    this.duration = Math.max(this.duration, t);
    return this;
  }

  /** Advance; fire due events (in order). */
  advance(dt: number) {
    this.time += dt;
    for (const e of this.events) {
      if (!e.fired && this.time >= e.at) {
        e.fired = true;
        e.fn();
      }
    }
  }

  /** Fire every remaining event immediately (used when skipping). */
  flush() {
    for (const e of [...this.events].sort((a, b) => a.at - b.at))
      if (!e.fired) {
        e.fired = true;
        e.fn();
      }
    this.time = this.duration;
  }

  /** Skip to the end without firing the remaining events (no sound pile-up). */
  skip() {
    for (const e of this.events) e.fired = true;
    this.time = this.duration;
  }

  get done() {
    return this.time >= this.duration;
  }

  /** Evaluate the active shot into the camera. Returns false if no shot covers the current time. */
  apply(camera: THREE.PerspectiveCamera, shakeOffset?: THREE.Vector3): boolean {
    let active: Shot | null = null;
    for (const s of this.shots) if (this.time >= s.start && this.time < s.end && (!s.when || s.when())) active = s;
    if (!active) {
      // past every shot: hold the one that ends last (on a tie, the later-pushed one, as above) — not
      // the last pushed (Gitar, round 3: a location's earlier shots, pushed after the base ones,
      // snapped the camera back to the roar close-up on the cinematic's final frame)
      let last: Shot | null = null;
      for (const s of this.shots) if ((!s.when || s.when()) && (!last || s.end >= last.end)) last = s;
      if (!last || this.time < last.end) return false;
      active = last;
    }
    const calm = this.calm();
    const raw = calm ? 1 : clamp((this.time - active.start) / (active.end - active.start), 0, 1);
    const t = (active.easing ?? ease.inOut)(raw);
    const a = active.from();
    const b = active.to();
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (active.orbit) {
      const o = orbitPose(a, b, active.orbit(), t);
      pos.copy(o.pos);
      look.copy(o.look);
    } else if (active.via) {
      const v = active.via();
      const u = 1 - t;
      pos.copy(a.pos).multiplyScalar(u * u).addScaledVector(v.pos, 2 * u * t).addScaledVector(b.pos, t * t);
      look.copy(a.look).multiplyScalar(u * u).addScaledVector(v.look, 2 * u * t).addScaledVector(b.look, t * t);
    } else {
      pos.lerpVectors(a.pos, b.pos, t);
      look.lerpVectors(a.look, b.look, t);
    }
    if (active.handheld && !calm) {
      const h = active.handheld;
      const tt = this.time;
      pos.x += Math.sin(tt * 1.3) * h;
      pos.y += Math.sin(tt * 1.7 + 1) * h * 0.6;
      look.x += Math.sin(tt * 0.9 + 2) * h * 0.5;
    }
    if (shakeOffset) look.add(shakeOffset);
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    camera.fov = a.fov + (b.fov - a.fov) * t;
    camera.updateProjectionMatrix();
    return true;
  }
}

export const pose = (pos: THREE.Vector3, look: THREE.Vector3, fov = 50): CamPose => ({ pos: pos.clone(), look: look.clone(), fov });
