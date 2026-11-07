/**
 * One-shot sound-effect synthesizers. Each builder takes a Dest + start time and returns the sound's
 * duration in seconds. All nodes are created per call and released when the sound ends.
 */
import { clamp } from './logic';
import { type Dest, type Vec3Like, Voice, envAD, envPoints, expPoints } from './graph';

type Pts = ReadonlyArray<readonly [number, number]>;

// ---------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------
export interface FormantSpec {
  f: Pts;
  q: number;
  g: number;
}

export interface ThroatOpts {
  dur: number;
  /** Fundamental frequency contour [time, Hz]. */
  pitch: Pts;
  /** Amplitude envelope [time, 0..1]. */
  amp: Pts;
  formants: FormantSpec[];
  voices?: number;
  /** Detune spread in cents across voices. */
  spread?: number;
  pulse?: boolean;
  subOctave?: number;
  /** Tone (oscillator) level, default 1. */
  tone?: number;
  /** Breath noise level fed into the vocal tract. */
  noise?: number;
  rattleHz?: number;
  rattleDepth?: number;
  vibratoHz?: number;
  vibratoCents?: number;
  drive?: number;
  body?: number;
  bodyFreq?: number;
  level?: number;
}

/**
 * Source–filter "vocal tract": detuned saw/pulse glottal source (+ breath noise) → amplitude rattle
 * (vocal fry / growl) → parallel formant band-passes (+ lowpassed body) → optional drive → amp env.
 * Returns the (unconnected) output node.
 */
export function throat(v: Voice, t: number, o: ThroatOpts): GainNode {
  const src = v.gain(1);
  const voices = Math.max(0, o.voices ?? 2);
  const spread = o.spread ?? 12;
  const tone = o.tone ?? 1;
  const pitched: OscillatorNode[] = [];
  if (tone > 0) {
    for (let i = 0; i < voices; i++) {
      const det = voices === 1 ? 0 : ((i / (voices - 1)) * 2 - 1) * spread;
      const osc = v.osc('sawtooth', 100, det);
      expPoints(osc.frequency, t, o.pitch);
      const g = v.gain((tone * 0.8) / Math.max(1, voices));
      osc.connect(g).connect(src);
      pitched.push(osc);
    }
    if (o.pulse) {
      const sq = v.osc('square', 100, 4);
      expPoints(sq.frequency, t, o.pitch);
      sq.connect(v.gain(0.35 * tone)).connect(src);
      pitched.push(sq);
    }
    if (o.subOctave) {
      const sub = v.osc('sawtooth', 50, -3);
      expPoints(sub.frequency, t, o.pitch, 0.5);
      sub.connect(v.gain(o.subOctave * tone)).connect(src);
      pitched.push(sub);
    }
    if (o.vibratoHz && o.vibratoCents) {
      const lfo = v.osc('sine', o.vibratoHz);
      const depth = v.gain(o.vibratoCents);
      lfo.connect(depth);
      // a slower irregular wobble on top
      const lfo2 = v.osc('triangle', o.vibratoHz * 0.37 + 0.3);
      const depth2 = v.gain(o.vibratoCents * 0.6);
      lfo2.connect(depth2);
      for (const p of pitched) {
        depth.connect(p.detune);
        depth2.connect(p.detune);
      }
    }
  }
  if (o.noise) {
    const n = v.noise('white');
    n.connect(v.gain(o.noise)).connect(src);
  }
  let shaped: AudioNode = src;
  if (o.rattleHz && o.rattleDepth) {
    const dep = clamp(o.rattleDepth);
    const am = v.gain(1 - dep / 2);
    const lfo = v.osc('triangle', o.rattleHz);
    // jitter the rattle rate so it sounds organic rather than buzzy
    const jit = v.osc('sine', 2.3 + v.random() * 2);
    jit.connect(v.gain(o.rattleHz * 0.25)).connect(lfo.frequency);
    lfo.connect(v.gain(dep / 2)).connect(am.gain);
    src.connect(am);
    shaped = am;
  }
  const sum = v.gain(1);
  for (const f of o.formants) {
    const bp = v.filter('bandpass', 500, f.q);
    expPoints(bp.frequency, t, f.f);
    // band-pass loses level as Q rises; compensate a little
    shaped.connect(bp).connect(v.gain(f.g * Math.sqrt(f.q) * 0.9)).connect(sum);
  }
  if (o.body) {
    const lp = v.filter('lowpass', o.bodyFreq ?? 400, 1.2);
    shaped.connect(lp).connect(v.gain(o.body)).connect(sum);
  }
  const out = v.gain(0);
  if (o.drive && o.drive > 0) {
    const post = v.gain(0.55);
    v.chain(sum, v.gain(1.4), v.shaper(o.drive), post);
    post.connect(out);
  } else {
    sum.connect(out);
  }
  const lvl = o.level ?? 0.5;
  envPoints(
    out.gain,
    t,
    o.amp.map(([tt, a]) => [tt, a * lvl] as const),
  );
  return out;
}

function thud(v: Voice, out: AudioNode, t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine'): void {
  const o = v.osc(type, f0);
  expPoints(o.frequency, t, [
    [0, f0],
    [Math.max(0.01, dur * 0.6), f1],
  ]);
  const g = v.gain();
  envAD(g.gain, t, peak, 0.003, dur);
  o.connect(g).connect(out);
}

function burst(
  v: Voice,
  out: AudioNode,
  t: number,
  type: BiquadFilterType,
  freq: number,
  Q: number,
  a: number,
  d: number,
  peak: number,
  kind: 'white' | 'brown' = 'white',
): BiquadFilterNode {
  const n = v.noise(kind);
  const f = v.filter(type, freq, Q);
  const g = v.gain();
  envAD(g.gain, t, peak, a, d);
  n.connect(f).connect(g).connect(out);
  return f;
}

function modal(v: Voice, out: AudioNode, t: number, freqs: number[], decays: number[], peak: number): void {
  freqs.forEach((f, i) => {
    const o = v.osc('sine', f * (1 + (v.random() - 0.5) * 0.04));
    const g = v.gain();
    envAD(g.gain, t, peak / Math.sqrt(i + 1), 0.0015, decays[i] ?? decays[decays.length - 1] ?? 0.1);
    o.connect(g).connect(out);
  });
}

/** Many short spikes on one gain param (cheap clatter / claps / cracks from a single noise source). */
function spikes(p: AudioParam, t: number, times: number[], peaks: number[], decays: number[]): void {
  p.setValueAtTime(0, t);
  let free = 0;
  const order = times.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  for (const [x, i] of order) {
    const start = Math.max(x, free);
    const d = decays[i] ?? 0.03;
    p.setValueAtTime(0, t + start);
    p.linearRampToValueAtTime(peaks[i] ?? 0.5, t + start + 0.0015);
    p.exponentialRampToValueAtTime(1e-4, t + start + 0.0015 + d);
    p.linearRampToValueAtTime(0, t + start + 0.002 + d);
    free = start + 0.003 + d;
  }
}

function sendTo(v: Voice, from: AudioNode, to: AudioNode, level: number): void {
  if (level <= 0) return;
  from.connect(v.gain(level)).connect(to);
}

// ---------------------------------------------------------------------------------------------
// Yeti
// ---------------------------------------------------------------------------------------------
export function yetiRoar(d: Dest, t: number, intensity: number, pos: Vec3Like | null): number {
  const v = new Voice(d);
  const I = clamp(intensity, 0.2, 1);
  const f0 = 60 * (0.92 + 0.16 * v.random());
  const dur = 2.7;
  const sp = v.spatial(pos, 14);
  sp.connect(d.out);
  const bus = v.gain(1);
  bus.connect(sp);
  sendTo(v, bus, d.cave, 0.8 * I);
  sendTo(v, bus, d.echo, 0.22);
  sendTo(v, bus, d.send, 0.25);

  const main = throat(v, t, {
    dur,
    pitch: [
      [0, f0 * 0.75],
      [0.3, f0 * 1.75],
      [0.9, f0 * 1.6],
      [1.6, f0 * 1.4],
      [2.25, f0 * 0.85],
      [dur, f0 * 0.55],
    ],
    amp: [
      [0, 0],
      [0.08, 0.85],
      [0.4, 1],
      [1.5, 0.92],
      [2.1, 0.55],
      [dur, 0],
    ],
    formants: [
      { f: [[0, 340], [0.35, 780], [1.4, 690], [2.2, 430], [dur, 320]], q: 5, g: 1 },
      { f: [[0, 820], [0.35, 1280], [1.4, 1150], [2.2, 780], [dur, 640]], q: 7, g: 0.75 },
      { f: [[0, 2100], [0.35, 2750], [1.4, 2500], [dur, 1900]], q: 9, g: 0.4 },
    ],
    voices: 3,
    spread: 24,
    pulse: true,
    subOctave: 0.55,
    noise: 0.35,
    rattleHz: 33,
    rattleDepth: 0.75,
    vibratoHz: 6.2,
    vibratoCents: 32,
    drive: 3 + 3 * I,
    body: 0.7,
    bodyFreq: 420,
    level: 0.5 + 0.2 * I,
  });
  main.connect(bus);

  // A second, lower and slightly late throat makes the creature sound huge (two sets of vocal folds).
  const low = throat(v, t + 0.04, {
    dur: dur - 0.04,
    pitch: [
      [0, f0 * 0.42],
      [0.32, f0 * 0.82],
      [1.6, f0 * 0.7],
      [dur - 0.04, f0 * 0.3],
    ],
    amp: [
      [0, 0],
      [0.12, 0.8],
      [1.6, 0.85],
      [dur - 0.04, 0],
    ],
    formants: [
      { f: [[0, 250], [0.4, 520], [2, 380], [dur - 0.04, 260]], q: 4, g: 1 },
      { f: [[0, 600], [0.4, 900], [2, 650], [dur - 0.04, 500]], q: 5, g: 0.6 },
    ],
    voices: 2,
    spread: 18,
    rattleHz: 21,
    rattleDepth: 0.85,
    drive: 4,
    body: 0.8,
    bodyFreq: 300,
    level: 0.38 * I,
  });
  low.connect(bus);

  // Breath / spit noise layer
  const n = v.noise('white');
  const bp = v.filter('bandpass', 1200, 0.9);
  expPoints(bp.frequency, t, [
    [0, 900],
    [0.35, 2300],
    [1.5, 1700],
    [dur, 900],
  ]);
  const shelf = v.filter('highshelf', 3200, 0.7, 5);
  const ng = v.gain();
  envPoints(ng.gain, t, [
    [0, 0],
    [0.15, 0.28 * I],
    [0.5, 0.4 * I],
    [1.8, 0.28 * I],
    [dur, 0],
  ]);
  v.chain(n, bp, shelf, ng, bus);

  // Sub-bass impact + sustained sub swell (dry, positional only)
  thud(v, sp, t, 55, 28, 0.9, 0.85 * I);
  const sub = v.osc('sine', 36);
  expPoints(sub.frequency, t, [
    [0, 34],
    [0.4, 42],
    [2.4, 30],
  ]);
  const sg = v.gain();
  envPoints(sg.gain, t, [
    [0, 0],
    [0.3, 0.35 * I],
    [1.8, 0.3 * I],
    [dur, 0],
  ]);
  sub.connect(sg).connect(sp);

  v.play(t, t + dur + 0.1);
  return dur;
}

export function yetiGrowl(d: Dest, t: number, pos: Vec3Like | null, distant: boolean): number {
  const v = new Voice(d);
  const dur = distant ? 1.9 : 1.4;
  const f0 = 46 * (0.9 + 0.2 * v.random());
  const sp = v.spatial(pos, distant ? 30 : 10);
  let dry: AudioNode = sp;
  if (!pos && distant) {
    const p = v.stereo((v.random() * 2 - 1) * 0.7);
    p.connect(d.out);
    dry = p;
  } else {
    sp.connect(d.out);
  }
  if (!pos && distant) sp.connect(dry);
  const bus = v.gain(1);
  if (distant) {
    const lp = v.filter('lowpass', 650, 0.7);
    bus.connect(lp).connect(v.gain(0.3)).connect(sp);
    sendTo(v, lp, d.cave, 1.1);
    sendTo(v, lp, d.echo, 1.0);
  } else {
    bus.connect(sp);
    sendTo(v, bus, d.cave, 0.45);
    sendTo(v, bus, d.echo, 0.15);
  }
  const g = throat(v, t, {
    dur,
    pitch: [
      [0, f0 * 0.85],
      [0.4, f0 * 1.25],
      [1.0, f0 * 1.1],
      [dur, f0 * 0.7],
    ],
    amp: [
      [0, 0],
      [0.25, 0.8],
      [0.7, 1],
      [dur * 0.8, 0.6],
      [dur, 0],
    ],
    formants: [
      { f: [[0, 300], [0.5, 460], [dur, 320]], q: 5, g: 1 },
      { f: [[0, 680], [0.5, 900], [dur, 650]], q: 6, g: 0.6 },
      { f: [[0, 1900], [dur, 1700]], q: 8, g: 0.25 },
    ],
    voices: 3,
    spread: 20,
    subOctave: 0.6,
    noise: 0.25,
    rattleHz: 26,
    rattleDepth: 0.85,
    vibratoHz: 4.5,
    vibratoCents: 25,
    drive: 2.5,
    body: 0.9,
    bodyFreq: 320,
    level: 0.55,
  });
  g.connect(bus);
  v.play(t, t + dur + 0.05);
  return dur;
}

/** One breath half-cycle for the yeti panting loop, connected to `out` (the persistent yeti panner). */
export function yetiBreath(d: Dest, t: number, out: AudioNode, exhale: boolean, running: boolean): number {
  const v = new Voice(d);
  const dur = exhale ? (running ? 0.36 : 0.85) : running ? 0.3 : 0.7;
  const f0 = exhale ? 52 : 68;
  const g = throat(v, t, {
    dur,
    pitch: [
      [0, f0],
      [dur, f0 * 0.85],
    ],
    amp: exhale
      ? [
          [0, 0],
          [dur * 0.12, 1],
          [dur * 0.5, 0.7],
          [dur, 0],
        ]
      : [
          [0, 0],
          [dur * 0.6, 0.8],
          [dur, 0],
        ],
    formants: exhale
      ? [
          { f: [[0, 520], [dur, 450]], q: 3, g: 1 },
          { f: [[0, 1150], [dur, 1000]], q: 4, g: 0.6 },
        ]
      : [
          { f: [[0, 850], [dur, 950]], q: 3, g: 0.8 },
          { f: [[0, 1750], [dur, 1900]], q: 5, g: 0.6 },
        ],
    voices: 1,
    tone: exhale ? 0.35 : 0.12,
    noise: 1,
    rattleHz: exhale ? 19 : 30,
    rattleDepth: exhale ? 0.55 : 0.3,
    body: exhale ? 0.4 : 0,
    bodyFreq: 260,
    level: exhale ? 0.5 : 0.28,
  });
  g.connect(out);
  v.play(t, t + dur + 0.02);
  return dur;
}

export function yetiFootstep(d: Dest, t: number, pos: Vec3Like | null, strength: number): number {
  const v = new Voice(d);
  const s = clamp(strength, 0.1, 1);
  const sp = v.spatial(pos, 10);
  sp.connect(d.out);
  const bus = v.gain(1);
  bus.connect(sp);
  sendTo(v, bus, d.cave, 0.12 * s);
  thud(v, bus, t, 78, 30, 0.45, 0.85 * s);
  thud(v, bus, t, 150, 60, 0.15, 0.25 * s, 'triangle');
  const f = burst(v, bus, t + 0.005, 'bandpass', 1500, 0.8, 0.004, 0.2, 0.3 * s);
  f.frequency.setValueAtTime(1800, t);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.2);
  burst(v, bus, t, 'lowpass', 450, 0.7, 0.004, 0.3, 0.55 * s, 'brown');
  v.play(t, t + 0.6);
  return 0.6;
}

// ---------------------------------------------------------------------------------------------
// Skier / world impacts
// ---------------------------------------------------------------------------------------------
export type ImpactName = 'branch' | 'rock-light' | 'rock-heavy' | 'tree-heavy' | 'crash' | 'log';

export function impact(d: Dest, t: number, kind: ImpactName, intensity: number): number {
  const v = new Voice(d);
  const I = clamp(intensity, 0.05, 1);
  const bus = v.gain(1);
  bus.connect(d.out);
  sendTo(v, bus, d.send, 0.12);
  let dur = 0.5;
  switch (kind) {
    case 'branch': {
      burst(v, bus, t, 'highpass', 2500, 0.7, 0.001, 0.03, 0.9 * I);
      modal(v, bus, t, [1200, 2650, 3900], [0.06, 0.04, 0.03], 0.45 * I);
      burst(v, bus, t + 0.02, 'lowpass', 1300, 0.7, 0.02, 0.28, 0.45 * I);
      dur = 0.4;
      break;
    }
    case 'rock-light': {
      modal(v, bus, t, [520, 1340, 2210], [0.12, 0.07, 0.05], 0.5 * I);
      burst(v, bus, t, 'bandpass', 3000, 1.2, 0.001, 0.015, 0.55 * I);
      thud(v, bus, t, 120, 70, 0.12, 0.55 * I);
      dur = 0.3;
      break;
    }
    case 'rock-heavy': {
      thud(v, bus, t, 95, 38, 0.45, 0.95 * I);
      modal(v, bus, t, [210, 470, 980], [0.25, 0.18, 0.1], 0.35 * I);
      const crunch = v.gain(1);
      crunch.connect(v.shaper(3)).connect(v.gain(0.6)).connect(bus);
      burst(v, crunch, t, 'lowpass', 1600, 0.8, 0.002, 0.3, 0.6 * I);
      burst(v, bus, t + 0.05, 'lowpass', 900, 0.7, 0.05, 0.5, 0.25 * I, 'brown');
      dur = 0.7;
      break;
    }
    case 'tree-heavy': {
      thud(v, bus, t, 115, 52, 0.35, 0.9 * I);
      modal(v, bus, t, [180, 410, 730], [0.22, 0.15, 0.1], 0.35 * I);
      burst(v, bus, t, 'bandpass', 2200, 1, 0.001, 0.03, 0.35 * I);
      // snow dumped from the branches
      const f = burst(v, bus, t + 0.1, 'bandpass', 1800, 0.6, 0.12, 0.9, 0.3 * I);
      f.frequency.setValueAtTime(2200, t + 0.1);
      f.frequency.exponentialRampToValueAtTime(600, t + 1.0);
      burst(v, bus, t + 0.8, 'lowpass', 400, 0.7, 0.01, 0.35, 0.35 * I, 'brown');
      dur = 1.3;
      break;
    }
    case 'log': {
      modal(v, bus, t, [160, 380, 620, 1050], [0.32, 0.2, 0.12, 0.06], 0.45 * I);
      thud(v, bus, t, 85, 50, 0.25, 0.6 * I);
      burst(v, bus, t, 'bandpass', 1500, 1.5, 0.001, 0.02, 0.3 * I);
      dur = 0.6;
      break;
    }
    case 'crash': {
      const hits = [0, 0.17, 0.36, 0.6, 0.85];
      hits.forEach((o, i) => {
        const k = 1 - i * 0.17;
        thud(v, bus, t + o, 100 - i * 6, 45, 0.25, 0.8 * I * k);
      });
      // snow spray throughout the tumble
      const spray = v.noise('white');
      const bp = v.filter('bandpass', 1600, 0.6);
      expPoints(bp.frequency, t, [
        [0, 2500],
        [0.5, 1400],
        [1.1, 800],
      ]);
      const sg = v.gain();
      envPoints(sg.gain, t, [
        [0, 0],
        [0.03, 0.45 * I],
        [0.4, 0.3 * I],
        [1.1, 0],
      ]);
      // granular crunch
      const am = v.gain(0.6);
      v.osc('square', 31).connect(v.gain(0.4)).connect(am.gain);
      v.chain(spray, bp, am, sg, bus);
      // skis clattering
      modal(v, bus, t + 0.22, [1850, 2950, 4100], [0.08, 0.05, 0.04], 0.2 * I);
      modal(v, bus, t + 0.5, [1650, 2700], [0.06, 0.04], 0.14 * I);
      dur = 1.2;
      break;
    }
  }
  v.play(t, t + dur);
  return dur;
}

export function takeoff(d: Dest, t: number, intensity: number): number {
  const v = new Voice(d);
  const I = clamp(intensity, 0.1, 1);
  const n = v.noise('white');
  const bp = v.filter('bandpass', 600, 1.4);
  expPoints(bp.frequency, t, [
    [0, 600],
    [0.35, 2600],
  ]);
  const g = v.gain();
  envPoints(g.gain, t, [
    [0, 0],
    [0.05, 0.3 * I],
    [0.4, 0],
  ]);
  v.chain(n, bp, g, d.out);
  burst(v, d.out, t, 'lowpass', 700, 0.7, 0.03, 0.3, 0.25 * I, 'brown');
  // edge release "tick"
  burst(v, d.out, t, 'highpass', 3000, 0.7, 0.001, 0.02, 0.15 * I);
  v.play(t, t + 0.45);
  return 0.45;
}

export function landing(d: Dest, t: number, intensity: number, hard: boolean): number {
  const v = new Voice(d);
  const I = clamp(intensity, 0.1, 1);
  const bus = v.gain(1);
  bus.connect(d.out);
  thud(v, bus, t, hard ? 85 : 110, hard ? 34 : 50, hard ? 0.4 : 0.22, (hard ? 0.95 : 0.55) * I);
  const n = v.noise('white');
  const lp = v.filter('lowpass', hard ? 2200 : 3200, 0.7);
  const g = v.gain();
  envAD(g.gain, t, (hard ? 0.55 : 0.35) * I, 0.004, hard ? 0.4 : 0.22);
  const am = v.gain(0.65);
  v.osc('square', hard ? 38 : 52).connect(v.gain(0.35)).connect(am.gain);
  v.chain(n, lp, am, g, bus);
  if (hard) {
    modal(v, bus, t + 0.01, [900, 2300, 3400], [0.07, 0.05, 0.04], 0.2 * I);
    burst(v, bus, t + 0.03, 'lowpass', 500, 0.7, 0.02, 0.4, 0.3 * I, 'brown');
  }
  v.play(t, t + (hard ? 0.55 : 0.35));
  return hard ? 0.55 : 0.35;
}

export function pop(d: Dest, t: number): number {
  const v = new Voice(d);
  modal(v, d.out, t, [1800, 3500], [0.03, 0.02], 0.3);
  thud(v, d.out, t, 190, 95, 0.09, 0.5);
  burst(v, d.out, t, 'bandpass', 1800, 0.8, 0.003, 0.08, 0.22);
  v.play(t, t + 0.15);
  return 0.15;
}

export type ExertionKind = 'grunt' | 'yelp' | 'gasp';

export function exertion(d: Dest, t: number, kind: ExertionKind): number {
  const v = new Voice(d);
  const r = 0.94 + v.random() * 0.12;
  let opts: ThroatOpts;
  if (kind === 'grunt') {
    opts = {
      dur: 0.28,
      pitch: [
        [0, 118 * r],
        [0.05, 132 * r],
        [0.28, 96 * r],
      ],
      amp: [
        [0, 0],
        [0.03, 1],
        [0.17, 0.7],
        [0.28, 0],
      ],
      formants: [
        { f: [[0, 600], [0.28, 560]], q: 6, g: 1 },
        { f: [[0, 1150], [0.28, 1050]], q: 8, g: 0.6 },
        { f: [[0, 2400], [0.28, 2350]], q: 10, g: 0.3 },
      ],
      voices: 1,
      noise: 0.3,
      rattleHz: 45,
      rattleDepth: 0.3,
      level: 0.5,
    };
  } else if (kind === 'yelp') {
    opts = {
      dur: 0.42,
      pitch: [
        [0, 300 * r],
        [0.08, 540 * r],
        [0.3, 450 * r],
        [0.42, 370 * r],
      ],
      amp: [
        [0, 0],
        [0.04, 1],
        [0.28, 0.8],
        [0.42, 0],
      ],
      formants: [
        { f: [[0, 750], [0.1, 850], [0.42, 700]], q: 7, g: 1 },
        { f: [[0, 1650], [0.1, 1800], [0.42, 1500]], q: 9, g: 0.7 },
        { f: [[0, 2650], [0.42, 2550]], q: 11, g: 0.35 },
      ],
      voices: 1,
      noise: 0.15,
      vibratoHz: 7,
      vibratoCents: 25,
      level: 0.42,
    };
  } else {
    opts = {
      dur: 0.48,
      pitch: [
        [0, 210 * r],
        [0.48, 260 * r],
      ],
      amp: [
        [0, 0],
        [0.13, 1],
        [0.33, 0.6],
        [0.48, 0],
      ],
      formants: [
        { f: [[0, 750], [0.48, 850]], q: 4, g: 1 },
        { f: [[0, 1250], [0.48, 1400]], q: 5, g: 0.7 },
        { f: [[0, 2600], [0.48, 2800]], q: 6, g: 0.4 },
      ],
      voices: 1,
      tone: 0.12,
      noise: 1,
      level: 0.4,
    };
  }
  const g = throat(v, t, opts);
  g.connect(d.out);
  sendTo(v, g, d.send, 0.1);
  v.play(t, t + opts.dur + 0.02);
  return opts.dur;
}

// ---------------------------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------------------------
export function caveRumble(d: Dest, t: number): number {
  const v = new Voice(d);
  const dur = 4;
  const bus = v.gain(1);
  bus.connect(d.out);
  sendTo(v, bus, d.cave, 0.6);
  // deep rumble
  const n = v.noise('brown');
  const lp = v.filter('lowpass', 80, 0.9);
  expPoints(lp.frequency, t, [
    [0, 70],
    [1, 170],
    [2.5, 110],
    [dur, 55],
  ]);
  const rg = v.gain();
  envPoints(rg.gain, t, [
    [0, 0],
    [0.5, 0.95],
    [2.2, 0.85],
    [dur, 0],
  ]);
  v.chain(n, lp, rg, bus);
  // sub wobble
  const sub = v.osc('sine', 31);
  const am = v.gain(0.6);
  v.osc('sine', 5.5).connect(v.gain(0.4)).connect(am.gain);
  const sg = v.gain();
  envPoints(sg.gain, t, [
    [0, 0],
    [0.7, 0.55],
    [2.4, 0.5],
    [dur, 0],
  ]);
  v.chain(sub, am, sg, bus);
  // crumbling mid layer
  const c = v.noise('brown', 2);
  const cbp = v.filter('bandpass', 380, 1.2);
  const flutter = v.gain(0.6);
  v.osc('square', 11).connect(v.gain(0.4)).connect(flutter.gain);
  const cg = v.gain();
  envPoints(cg.gain, t, [
    [0, 0],
    [0.6, 0.45],
    [2, 0.4],
    [3.5, 0],
  ]);
  v.chain(c, cbp, flutter, cg, bus);
  // rockfall clatter: one noise source, many spikes, resonant stone bands
  const cl = v.noise('white');
  const cgate = v.gain(0);
  const times: number[] = [];
  const peaks: number[] = [];
  const decays: number[] = [];
  for (let i = 0; i < 22; i++) {
    const x = 0.35 + Math.pow(v.random(), 1.3) * 2.8;
    times.push(x);
    peaks.push((0.25 + v.random() * 0.75) * (1 - (x - 0.35) / 3.5));
    decays.push(0.015 + v.random() * 0.05);
  }
  spikes(cgate.gain, t, times, peaks, decays);
  cl.connect(cgate);
  const csum = v.gain(0.9);
  for (const [f, q] of [
    [900, 5],
    [1900, 7],
    [3200, 9],
  ] as const) {
    cgate.connect(v.filter('bandpass', f, q)).connect(v.gain(Math.sqrt(q) * 0.5)).connect(csum);
  }
  const pan = v.stereo(0.3);
  csum.connect(pan).connect(bus);
  v.play(t, t + dur + 0.05);
  return dur;
}

export function snowSlide(d: Dest, t: number): number {
  const v = new Voice(d);
  const dur = 1.5;
  const n = v.noise('white');
  const bp = v.filter('bandpass', 2500, 0.7);
  expPoints(bp.frequency, t, [
    [0, 2600],
    [1.2, 700],
  ]);
  const grain = v.gain(0.7);
  v.osc('square', 13).connect(v.gain(0.3)).connect(grain.gain);
  const g = v.gain();
  envPoints(g.gain, t, [
    [0, 0],
    [0.15, 0.35],
    [0.8, 0.28],
    [1.25, 0],
  ]);
  v.chain(n, bp, grain, g, d.out);
  sendTo(v, g, d.send, 0.2);
  burst(v, d.out, t + 1.0, 'lowpass', 380, 0.7, 0.01, 0.45, 0.45, 'brown');
  v.play(t, t + dur);
  return dur;
}

export function branchSnap(d: Dest, t: number, pos: Vec3Like | null): number {
  const v = new Voice(d);
  const sp = v.spatial(pos, 6);
  sp.connect(d.out);
  sendTo(v, sp, d.send, 0.2);
  const n = v.noise('white');
  const gate = v.gain(0);
  spikes(gate.gain, t, [0, 0.035, 0.1, 0.13], [0.9, 0.55, 0.4, 0.2], [0.018, 0.012, 0.02, 0.01]);
  n.connect(gate);
  gate.connect(v.filter('highpass', 1500, 0.7)).connect(v.gain(0.6)).connect(sp);
  gate.connect(v.filter('bandpass', 2600, 3)).connect(v.gain(0.8)).connect(sp);
  modal(v, sp, t, [700, 1650, 2900], [0.06, 0.04, 0.03], 0.3);
  burst(v, sp, t + 0.12, 'lowpass', 900, 0.7, 0.05, 0.45, 0.2);
  v.play(t, t + 0.65);
  return 0.65;
}

// ---------------------------------------------------------------------------------------------
// Comedic capture
// ---------------------------------------------------------------------------------------------
export function gulp(d: Dest, t: number): number {
  const v = new Voice(d);
  const bus = v.gain(1);
  bus.connect(d.out);
  [0, 0.34].forEach((o, i) => {
    const tt = t + o;
    const s = v.osc('sine', 340);
    expPoints(s.frequency, tt, [
      [0, 360 - i * 70],
      [0.12, 115 - i * 15],
    ]);
    const g = v.gain();
    envAD(g.gain, tt, 0.55, 0.006, 0.14);
    s.connect(v.filter('lowpass', 900, 2)).connect(g).connect(bus);
    burst(v, bus, tt, 'highpass', 2200, 0.7, 0.001, 0.012, 0.18);
    burst(v, bus, tt + 0.02, 'lowpass', 650, 1, 0.01, 0.12, 0.2, 'brown');
  });
  v.play(t, t + 0.6);
  return 0.6;
}

export function burp(d: Dest, t: number): number {
  const v = new Voice(d);
  const dur = 0.9;
  const r = 0.92 + v.random() * 0.16;
  const g = throat(v, t, {
    dur,
    pitch: [
      [0, 92 * r],
      [0.1, 112 * r],
      [0.5, 86 * r],
      [dur, 68 * r],
    ],
    amp: [
      [0, 0],
      [0.04, 1],
      [0.55, 0.85],
      [dur, 0],
    ],
    formants: [
      { f: [[0, 520], [0.3, 600], [dur, 470]], q: 6, g: 1 },
      { f: [[0, 820], [0.3, 900], [dur, 760]], q: 7, g: 0.7 },
      { f: [[0, 2400], [dur, 2300]], q: 9, g: 0.25 },
    ],
    voices: 2,
    spread: 15,
    noise: 0.2,
    rattleHz: 27,
    rattleDepth: 0.85,
    vibratoHz: 9,
    vibratoCents: 40,
    drive: 2,
    body: 0.6,
    bodyFreq: 350,
    level: 0.55,
  });
  g.connect(d.out);
  sendTo(v, g, d.send, 0.25);
  v.play(t, t + dur + 0.02);
  return dur;
}

// ---------------------------------------------------------------------------------------------
// Crowd
// ---------------------------------------------------------------------------------------------
export function laugh(d: Dest, t: number, pan: number, level: number): number {
  const v = new Voice(d);
  const n = 3 + Math.floor(v.random() * 4);
  const f0 = 160 + v.random() * 130;
  const step = 0.12 + v.random() * 0.05;
  const amp: Array<[number, number]> = [[0, 0]];
  const pitch: Array<[number, number]> = [[0, f0 * 1.1]];
  for (let k = 0; k < n; k++) {
    const s = k * step;
    amp.push([s + 0.025, 1 - k * 0.12]);
    amp.push([s + step * 0.7, 0.03]);
    pitch.push([s + step * 0.5, f0 * (1.1 - k * 0.04)]);
  }
  const dur = n * step + 0.05;
  amp.push([dur, 0]);
  const g = throat(v, t, {
    dur,
    pitch,
    amp,
    formants: [
      { f: [[0, 760], [dur, 700]], q: 5, g: 1 },
      { f: [[0, 1300], [dur, 1200]], q: 6, g: 0.6 },
      { f: [[0, 2550], [dur, 2500]], q: 8, g: 0.3 },
    ],
    voices: 1,
    noise: 0.5,
    level: 0.25 * clamp(level),
  });
  const p = v.stereo(pan);
  v.chain(g, v.filter('lowpass', 2600, 0.7), p, d.out);
  sendTo(v, p, d.send, 0.4);
  v.play(t, t + dur + 0.02);
  return dur;
}

export function crowdCheer(d: Dest, t: number, intensity: number): number {
  const v = new Voice(d);
  const I = clamp(intensity, 0.1, 1);
  const dur = 2.8;
  const bus = v.gain(1);
  bus.connect(d.out);
  sendTo(v, bus, d.send, 0.45);
  // "aaah" swell: noise through vowel formants, three spread layers
  for (let k = 0; k < 3; k++) {
    const n = v.noise('white');
    const f1 = 650 + v.random() * 150;
    const f2 = 1100 + v.random() * 250;
    const s = v.gain(1);
    n.connect(s);
    const sum = v.gain(1);
    s.connect(v.filter('bandpass', f1, 4)).connect(v.gain(1.6)).connect(sum);
    s.connect(v.filter('bandpass', f2, 5)).connect(v.gain(1.1)).connect(sum);
    s.connect(v.filter('bandpass', 2600, 6)).connect(v.gain(0.5)).connect(sum);
    const g = v.gain();
    const o = k * 0.08;
    envPoints(g.gain, t, [
      [0, 0],
      [o + 0.3, 0.32 * I],
      [1.4, 0.26 * I],
      [dur, 0],
    ]);
    const am = v.gain(0.8);
    v.osc('sine', 3 + k * 1.7).connect(v.gain(0.2)).connect(am.gain);
    v.chain(sum, am, g, v.stereo(k - 1), bus);
  }
  // "woo" voices
  const nv = 2 + Math.round(I * 2);
  for (let k = 0; k < nv; k++) {
    const o = 0.1 + v.random() * 0.6;
    const f = 260 + v.random() * 160;
    const vd = 0.9 + v.random() * 0.6;
    const w = throat(v, t + o, {
      dur: vd,
      pitch: [
        [0, f],
        [vd * 0.4, f * 1.6],
        [vd, f * 1.25],
      ],
      amp: [
        [0, 0],
        [0.08, 1],
        [vd * 0.7, 0.7],
        [vd, 0],
      ],
      formants: [
        { f: [[0, 400], [vd, 700]], q: 6, g: 1 },
        { f: [[0, 800], [vd, 1200]], q: 7, g: 0.5 },
      ],
      voices: 1,
      noise: 0.2,
      vibratoHz: 6,
      vibratoCents: 30,
      level: 0.09 * I,
    });
    w.connect(v.stereo(v.random() * 1.6 - 0.8)).connect(bus);
  }
  // claps (single noise source, many spikes)
  const cn = v.noise('white');
  const cg = v.gain(0);
  const times: number[] = [];
  const peaks: number[] = [];
  const decays: number[] = [];
  const nc = Math.round(14 + 30 * I);
  for (let i = 0; i < nc; i++) {
    const x = 0.15 + v.random() * 2.3;
    times.push(x);
    peaks.push((0.3 + v.random() * 0.7) * (x < 2 ? 1 : 1 - (x - 2) / 0.6));
    decays.push(0.02 + v.random() * 0.03);
  }
  spikes(cg.gain, t, times, peaks, decays);
  v.chain(cn, cg, v.filter('bandpass', 1300, 1.1), v.gain(0.5 * I), bus);
  // whistle
  const wh = v.osc('sine', 2000);
  expPoints(wh.frequency, t, [
    [0.4, 1700],
    [0.7, 2700],
    [1.3, 2300],
    [1.6, 2900],
  ]);
  v.osc('sine', 7).connect(v.gain(40)).connect(wh.frequency);
  const wg = v.gain();
  envPoints(wg.gain, t, [
    [0, 0],
    [0.4, 0],
    [0.5, 0.06 * I],
    [1.5, 0.05 * I],
    [1.7, 0],
  ]);
  wh.connect(wg).connect(v.stereo(0.5)).connect(bus);
  v.play(t, t + dur + 0.05);
  return dur;
}

// ---------------------------------------------------------------------------------------------
// UI & stingers
// ---------------------------------------------------------------------------------------------
export function uiClick(d: Dest, t: number): number {
  const v = new Voice(d);
  const s = v.osc('sine', 1400);
  expPoints(s.frequency, t, [
    [0, 1500],
    [0.05, 900],
  ]);
  const g = v.gain();
  envAD(g.gain, t, 0.5, 0.002, 0.06);
  s.connect(g).connect(d.out);
  const tr = v.osc('triangle', 2800);
  const g2 = v.gain();
  envAD(g2.gain, t, 0.2, 0.001, 0.02);
  tr.connect(g2).connect(d.out);
  sendTo(v, g, d.send, 0.15);
  v.play(t, t + 0.1);
  return 0.1;
}

export function uiMove(d: Dest, t: number): number {
  const v = new Voice(d);
  const s = v.osc('triangle', 880);
  const g = v.gain();
  envAD(g.gain, t, 0.32, 0.002, 0.035);
  s.connect(g).connect(d.out);
  v.play(t, t + 0.06);
  return 0.06;
}

/** The "RUN." hit: sub drop, noise blast, taiko, and a distorted low brass "braam". */
export function runPrompt(d: Dest, t: number): number {
  const v = new Voice(d);
  const dur = 3;
  const bus = v.gain(1);
  bus.connect(d.out);
  sendTo(v, bus, d.cave, 0.45);
  sendTo(v, bus, d.send, 0.3);
  thud(v, bus, t, 75, 27, 1.1, 0.95);
  const nf = burst(v, bus, t, 'lowpass', 2500, 0.8, 0.003, 0.7, 0.45);
  nf.frequency.setValueAtTime(3000, t);
  nf.frequency.exponentialRampToValueAtTime(180, t + 0.7);
  thud(v, bus, t, 160, 60, 0.3, 0.5, 'triangle');
  // braam
  const braam = v.gain(1);
  const lp = v.filter('lowpass', 200, 3);
  expPoints(lp.frequency, t, [
    [0, 180],
    [0.25, 1900],
    [1.0, 900],
    [dur, 200],
  ]);
  for (const m of [26, 38, 45, 50]) {
    const f = 440 * Math.pow(2, (m - 69) / 12);
    for (const det of [-9, 8]) {
      const o = v.osc('sawtooth', f, det);
      o.connect(v.gain(0.16)).connect(braam);
    }
  }
  const out = v.gain();
  envPoints(out.gain, t, [
    [0, 0],
    [0.03, 0.5],
    [0.6, 0.42],
    [2.2, 0.2],
    [dur, 0],
  ]);
  v.chain(braam, lp, v.gain(1.2), v.shaper(2.5), out, bus);
  v.play(t, t + dur + 0.05);
  return dur;
}
