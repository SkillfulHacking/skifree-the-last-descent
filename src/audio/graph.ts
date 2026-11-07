/**
 * Web Audio graph helpers shared by the synth builders. Everything accepts a BaseAudioContext so the
 * same code renders in realtime (AudioContext) and offline (OfflineAudioContext).
 */
import { generateImpulse, makeDriveCurve, makeSoftClipCurve, mulberry32 } from './logic';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Where a synthesized sound goes. */
export interface Dest {
  ctx: BaseAudioContext;
  noise: AudioBuffer;
  brown: AudioBuffer;
  /** Dry output. */
  out: AudioNode;
  /** Shared hall reverb send. */
  send: AudioNode;
  /** Long dark cave reverb send. */
  cave: AudioNode;
  /** Mountain echo (feedback delay) send. */
  echo: AudioNode;
}

// --- buffers ----------------------------------------------------------------------------------
const bufferCache = new WeakMap<BaseAudioContext, { white: AudioBuffer; brown: AudioBuffer }>();

export function noiseBuffers(ctx: BaseAudioContext): { white: AudioBuffer; brown: AudioBuffer } {
  const hit = bufferCache.get(ctx);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const rnd = mulberry32(777);
  const white = ctx.createBuffer(1, Math.floor(sr * 2.5), sr);
  const w = new Float32Array(white.length);
  for (let i = 0; i < w.length; i++) w[i] = rnd() * 2 - 1;
  white.copyToChannel(w, 0);
  const b = new Float32Array(Math.floor(sr * 4));
  let last = 0;
  let peak = 0;
  for (let i = 0; i < b.length; i++) {
    last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02;
    b[i] = last;
    peak = Math.max(peak, Math.abs(last));
  }
  // remove DC drift, normalise, crossfade the loop seam
  let mean = 0;
  for (let i = 0; i < b.length; i++) mean += b[i]!;
  mean /= b.length;
  const norm = 0.9 / Math.max(1e-6, peak);
  for (let i = 0; i < b.length; i++) b[i] = (b[i]! - mean) * norm;
  const xf = Math.floor(sr * 0.05);
  for (let i = 0; i < xf; i++) {
    const k = i / xf;
    const tail = b.length - xf + i;
    b[tail] = b[tail]! * (1 - k) + b[i]! * k;
  }
  const brown = ctx.createBuffer(1, b.length - xf, sr);
  brown.copyToChannel(b.slice(xf), 0);
  const res = { white, brown };
  bufferCache.set(ctx, res);
  return res;
}

export function makeImpulseBuffer(ctx: BaseAudioContext, seconds: number, damping: number, seed: number, preDelay = 0.015): AudioBuffer {
  const [l, r] = generateImpulse(ctx.sampleRate, seconds, { damping, seed, preDelay });
  const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
  buf.copyToChannel(l, 0);
  buf.copyToChannel(r, 1);
  return buf;
}

const driveCache = new Map<number, Float32Array<ArrayBuffer>>();
export function driveCurve(drive: number): Float32Array<ArrayBuffer> {
  const key = Math.round(drive * 10) / 10;
  let c = driveCache.get(key);
  if (!c) {
    c = makeDriveCurve(key);
    driveCache.set(key, c);
  }
  return c;
}

// --- param helpers -----------------------------------------------------------------------------
/** Click-free ramp from the current value to `v` over `dur` seconds starting at `now`. */
export function rampParam(p: AudioParam, v: number, now: number, dur: number): void {
  const cur = p.value;
  if (typeof p.cancelAndHoldAtTime === 'function') {
    p.cancelAndHoldAtTime(now);
  } else {
    p.cancelScheduledValues(now);
    p.setValueAtTime(cur, now);
  }
  p.linearRampToValueAtTime(v, now + Math.max(0.005, dur));
}

/** Set a smoothly-approaching target (cheap per-frame update). */
export function target(p: AudioParam, v: number, now: number, tau: number): void {
  if (!Number.isFinite(v)) return;
  p.setTargetAtTime(v, now, Math.max(0.001, tau));
}

/** Piecewise envelope: points are [timeOffset, value]; linear segments; starts at points[0]. */
export function envPoints(p: AudioParam, t: number, pts: ReadonlyArray<readonly [number, number]>): void {
  if (pts.length === 0) return;
  p.setValueAtTime(pts[0]![1], t + pts[0]![0]);
  for (let i = 1; i < pts.length; i++) p.linearRampToValueAtTime(pts[i]![1], t + pts[i]![0]);
}

/** Piecewise exponential (for frequencies; values must be > 0). */
export function expPoints(p: AudioParam, t: number, pts: ReadonlyArray<readonly [number, number]>, mult = 1): void {
  if (pts.length === 0) return;
  p.setValueAtTime(Math.max(1e-3, pts[0]![1] * mult), t + pts[0]![0]);
  for (let i = 1; i < pts.length; i++) p.exponentialRampToValueAtTime(Math.max(1e-3, pts[i]![1] * mult), t + pts[i]![0]);
}

/** Attack/decay: 0 → peak in `a`, exponential-ish decay to silence at `a + d`. */
export function envAD(p: AudioParam, t: number, peak: number, a: number, d: number): void {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + Math.max(0.001, a));
  p.exponentialRampToValueAtTime(Math.max(1e-4, peak * 1e-3), t + a + Math.max(0.005, d));
  p.linearRampToValueAtTime(0, t + a + d + 0.01);
}

/** Attack / sustain-hold / release envelope for sustained notes. */
export function envASR(p: AudioParam, t: number, peak: number, a: number, hold: number, r: number, sustain = 1): void {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + Math.max(0.002, a));
  p.linearRampToValueAtTime(peak * sustain, t + a + Math.max(0, hold));
  p.linearRampToValueAtTime(0, t + a + Math.max(0, hold) + Math.max(0.01, r));
}

// --- Voice: a disposable group of nodes ---------------------------------------------------------
/**
 * Collects the nodes of one one-shot sound. `play()` starts/stops every source; once all sources have
 * ended, every node is disconnected so the graph can be garbage-collected.
 */
export class Voice {
  private nodes: AudioNode[] = [];
  private oscs: AudioScheduledSourceNode[] = [];
  private bufs: AudioBufferSourceNode[] = [];
  private consts: ConstantSourceNode[] = [];
  private rnd: () => number;
  constructor(readonly d: Dest, seed = Math.floor(Math.random() * 1e9)) {
    this.rnd = mulberry32(seed);
  }
  get ctx(): BaseAudioContext {
    return this.d.ctx;
  }
  random(): number {
    return this.rnd();
  }
  private track<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }
  gain(v = 0): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return this.track(g);
  }
  osc(type: OscillatorType, freq: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    this.oscs.push(o);
    return this.track(o);
  }
  noise(kind: 'white' | 'brown' = 'white', rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = kind === 'white' ? this.d.noise : this.d.brown;
    s.loop = true;
    s.playbackRate.value = rate;
    this.bufs.push(s);
    return this.track(s);
  }
  constant(v: number): ConstantSourceNode {
    const c = this.ctx.createConstantSource();
    c.offset.value = v;
    this.consts.push(c);
    return this.track(c);
  }
  filter(type: BiquadFilterType, freq: number, Q = 0.707, gainDb = 0): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    f.gain.value = gainDb;
    return this.track(f);
  }
  shaper(drive: number, oversample: OverSampleType = '2x'): WaveShaperNode {
    const w = this.ctx.createWaveShaper();
    w.curve = driveCurve(drive);
    w.oversample = oversample;
    return this.track(w);
  }
  delay(time: number, max = 2): DelayNode {
    const d = this.ctx.createDelay(max);
    d.delayTime.value = time;
    return this.track(d);
  }
  stereo(pan: number): StereoPannerNode {
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    return this.track(p);
  }
  /** HRTF panner at `pos`, or a unity gain when `pos` is null (non-positional). */
  spatial(pos: Vec3Like | null, refDistance = 8): AudioNode {
    if (!pos) return this.gain(1);
    const p = createPanner(this.ctx, refDistance);
    setPannerPosition(p, pos, 0);
    return this.track(p);
  }
  /** Connect `src` → `chain[0]` → `chain[1]` … and return the last node. */
  chain(src: AudioNode, ...chain: AudioNode[]): AudioNode {
    let cur = src;
    for (const n of chain) {
      cur.connect(n);
      cur = n;
    }
    return cur;
  }
  /** Start every source at t0, stop at t1, and clean up after. */
  play(t0: number, t1: number): void {
    const all: AudioScheduledSourceNode[] = [...this.oscs, ...this.bufs, ...this.consts];
    if (all.length === 0) {
      this.dispose();
      return;
    }
    let remaining = all.length;
    const onEnd = (): void => {
      remaining--;
      if (remaining <= 0) this.dispose();
    };
    for (const s of all) s.onended = onEnd;
    for (const o of this.oscs) o.start(t0);
    for (const c of this.consts) c.start(t0);
    for (const b of this.bufs) {
      const dur = b.buffer ? b.buffer.duration : 1;
      b.start(t0, this.rnd() * Math.max(0, dur - 0.1));
    }
    for (const s of all) s.stop(Math.max(t1, t0 + 0.01));
  }
  dispose(): void {
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.nodes = [];
    this.oscs = [];
    this.bufs = [];
    this.consts = [];
  }
}

export function createPanner(ctx: BaseAudioContext, refDistance = 8): PannerNode {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = refDistance;
  p.maxDistance = 3000;
  p.rolloffFactor = 1;
  return p;
}

export function setPannerPosition(p: PannerNode, pos: Vec3Like, now: number, tau = 0): void {
  if (p.positionX) {
    if (tau > 0) {
      target(p.positionX, pos.x, now, tau);
      target(p.positionY, pos.y, now, tau);
      target(p.positionZ, pos.z, now, tau);
    } else {
      p.positionX.setValueAtTime(pos.x, now);
      p.positionY.setValueAtTime(pos.y, now);
      p.positionZ.setValueAtTime(pos.z, now);
    }
  } else {
    (p as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(pos.x, pos.y, pos.z);
  }
}

const upInitialised = new WeakSet<BaseAudioContext>();

export function setListenerPose(ctx: BaseAudioContext, pos: Vec3Like, fwd: Vec3Like, now: number): void {
  const l = ctx.listener;
  if (!Number.isFinite(pos.x + pos.y + pos.z + fwd.x + fwd.y + fwd.z)) return;
  const len = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
  const fx = fwd.x / len;
  const fy = fwd.y / len;
  const fz = fwd.z / len;
  if (l.positionX) {
    const tau = 0.015;
    target(l.positionX, pos.x, now, tau);
    target(l.positionY, pos.y, now, tau);
    target(l.positionZ, pos.z, now, tau);
    target(l.forwardX, fx, now, tau);
    target(l.forwardY, fy, now, tau);
    target(l.forwardZ, fz, now, tau);
    if (!upInitialised.has(ctx)) {
      upInitialised.add(ctx);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
  } else {
    const legacy = l as unknown as {
      setPosition(x: number, y: number, z: number): void;
      setOrientation(x: number, y: number, z: number, ux: number, uy: number, uz: number): void;
    };
    legacy.setPosition(pos.x, pos.y, pos.z);
    legacy.setOrientation(fx, fy, fz, 0, 1, 0);
  }
}

// --- Mix graph ---------------------------------------------------------------------------------
export interface MixOptions {
  /** Skip the master soft-clipper (used by the test bench to measure real headroom). */
  bypassClipper?: boolean;
}

/**
 * Master graph:
 *   music instances → musicIn → musicPause → musicDuck → musicVol ─┐
 *   music sends → musicSend(scaled) ─→ hall reverb ─→ reverbReturn ─┤
 *   sfxIn ─→ sfxVol ────────────────────────────────────────────────┤
 *   ambIn → ambPause → sfxVol                                        ├→ preMaster → masterVol → comp → limiter → softclip → out
 *   sfx sends → sfxSend(scaled) ─→ hall reverb                       │
 *   caveIn(scaled) → cave reverb ───────────────────────────────────┤
 *   echoIn(scaled) → feedback delay → (out, cave) ───────────────────┘
 */
export class Mix {
  readonly ctx: BaseAudioContext;
  readonly white: AudioBuffer;
  readonly brown: AudioBuffer;
  readonly musicIn: GainNode;
  readonly musicSendIn: GainNode;
  readonly sfxIn: GainNode;
  readonly sfxSendIn: GainNode;
  readonly ambIn: GainNode;
  readonly caveIn: GainNode;
  readonly echoIn: GainNode;
  private musicPause: GainNode;
  private musicDuck: GainNode;
  private musicVol: GainNode;
  private musicSendScale: GainNode;
  private sfxVol: GainNode;
  private sfxSendScale: GainNode;
  private caveScale: GainNode;
  private echoScale: GainNode;
  private ambPause: GainNode;
  private masterVol: GainNode;
  private all: AudioNode[] = [];
  private levels = { master: 0.9, music: 0.7, sfx: 0.9, duck: 1, paused: false };

  constructor(ctx: BaseAudioContext, opts: MixOptions = {}) {
    this.ctx = ctx;
    const { white, brown } = noiseBuffers(ctx);
    this.white = white;
    this.brown = brown;
    const g = (v: number): GainNode => {
      const n = ctx.createGain();
      n.gain.value = v;
      this.all.push(n);
      return n;
    };
    const preMaster = g(1);
    this.masterVol = g(this.levels.master);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.008;
    comp.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.1;
    this.all.push(comp, lim);
    preMaster.connect(this.masterVol).connect(comp).connect(lim);
    if (opts.bypassClipper) {
      lim.connect(ctx.destination);
    } else {
      const pre = g(0.5);
      const clip = ctx.createWaveShaper();
      clip.curve = makeSoftClipCurve(4096, 2);
      clip.oversample = '2x';
      this.all.push(clip);
      lim.connect(pre).connect(clip).connect(ctx.destination);
    }

    // hall reverb (shared)
    const hall = ctx.createConvolver();
    hall.buffer = makeImpulseBuffer(ctx, 2.8, 0.18, 11);
    const reverbReturn = g(0.55);
    hall.connect(reverbReturn).connect(preMaster);
    // cave reverb (long, dark)
    const cave = ctx.createConvolver();
    cave.buffer = makeImpulseBuffer(ctx, 5, 0.07, 23, 0.04);
    const caveReturn = g(0.7);
    cave.connect(caveReturn).connect(preMaster);
    this.all.push(hall, cave);

    // music
    this.musicIn = g(1);
    this.musicPause = g(1);
    this.musicDuck = g(1);
    this.musicVol = g(this.levels.music);
    this.musicIn.connect(this.musicPause).connect(this.musicDuck).connect(this.musicVol).connect(preMaster);
    this.musicSendIn = g(1);
    this.musicSendScale = g(this.levels.music);
    this.musicSendIn.connect(this.musicSendScale).connect(hall);

    // sfx
    this.sfxIn = g(1);
    this.sfxVol = g(this.levels.sfx);
    this.sfxIn.connect(this.sfxVol).connect(preMaster);
    this.ambIn = g(1);
    this.ambPause = g(1);
    this.ambIn.connect(this.ambPause).connect(this.sfxVol);
    this.sfxSendIn = g(1);
    this.sfxSendScale = g(this.levels.sfx);
    this.sfxSendIn.connect(this.sfxSendScale).connect(hall);
    this.caveIn = g(1);
    this.caveScale = g(this.levels.sfx);
    this.caveIn.connect(this.caveScale).connect(cave);

    // mountain echo: two taps with damped feedback, partly fed into the cave reverb
    this.echoIn = g(1);
    this.echoScale = g(this.levels.sfx);
    this.echoIn.connect(this.echoScale);
    const d1 = ctx.createDelay(2);
    d1.delayTime.value = 0.43;
    const d2 = ctx.createDelay(2);
    d2.delayTime.value = 0.71;
    const fb = g(0.38);
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1800;
    const echoOut = g(0.6);
    this.all.push(d1, d2, damp);
    this.echoScale.connect(d1);
    d1.connect(damp);
    damp.connect(d2);
    d2.connect(fb).connect(d1);
    damp.connect(echoOut);
    d2.connect(echoOut);
    echoOut.connect(preMaster);
    const echoToCave = g(0.35);
    echoOut.connect(echoToCave).connect(cave);
  }

  /** Destination for a sfx one-shot. */
  sfxDest(): Dest {
    return { ctx: this.ctx, noise: this.white, brown: this.brown, out: this.sfxIn, send: this.sfxSendIn, cave: this.caveIn, echo: this.echoIn };
  }
  ambDest(): Dest {
    return { ctx: this.ctx, noise: this.white, brown: this.brown, out: this.ambIn, send: this.sfxSendIn, cave: this.caveIn, echo: this.echoIn };
  }

  setVolumes(master: number, music: number, sfx: number, now: number): void {
    this.levels.master = master;
    this.levels.music = music;
    this.levels.sfx = sfx;
    this.apply(now, 0.05);
  }
  setDuck(duck: number, now: number): void {
    if (Math.abs(duck - this.levels.duck) < 0.005) return;
    this.levels.duck = duck;
    target(this.musicDuck.gain, duck, now, 0.3);
    target(this.musicSendScale.gain, this.levels.music * duck * (this.levels.paused ? 0 : 1), now, 0.3);
  }
  setPaused(paused: boolean, now: number): void {
    this.levels.paused = paused;
    const fade = paused ? 0.35 : 0.6;
    rampParam(this.musicPause.gain, paused ? 0 : 1, now, fade);
    rampParam(this.ambPause.gain, paused ? 0 : 1, now, fade);
    rampParam(this.musicSendScale.gain, paused ? 0 : this.levels.music * this.levels.duck, now, fade);
  }
  private apply(now: number, tau: number): void {
    const l = this.levels;
    target(this.masterVol.gain, l.master, now, tau);
    target(this.musicVol.gain, l.music, now, tau);
    target(this.musicSendScale.gain, l.paused ? 0 : l.music * l.duck, now, tau);
    target(this.sfxVol.gain, l.sfx, now, tau);
    target(this.sfxSendScale.gain, l.sfx, now, tau);
    target(this.caveScale.gain, l.sfx, now, tau);
    target(this.echoScale.gain, l.sfx, now, tau);
  }
  dispose(): void {
    for (const n of this.all) {
      try {
        n.disconnect();
      } catch {
        /* noop */
      }
    }
    for (const n of [this.musicIn, this.musicSendIn, this.sfxIn, this.sfxSendIn, this.ambIn, this.caveIn, this.echoIn]) {
      try {
        n.disconnect();
      } catch {
        /* noop */
      }
    }
  }
}
