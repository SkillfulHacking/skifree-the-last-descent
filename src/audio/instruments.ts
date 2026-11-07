/**
 * Synthesized music instruments. Each call schedules one note/chord at time `t` on a Dest and frees
 * its nodes when finished.
 */
import { clamp, midiToFreq } from './logic';
import { type Dest, Voice, envAD, envASR, envPoints, expPoints } from './graph';

export interface PadOpts {
  gain?: number;
  attack?: number;
  release?: number;
  cutoff?: number;
  detune?: number;
  send?: number;
}

/** Warm detuned-saw pad through a slowly breathing lowpass. */
export function pad(d: Dest, t: number, notes: number[], dur: number, o: PadOpts = {}): void {
  const v = new Voice(d);
  const a = o.attack ?? 1.2;
  const r = o.release ?? 2;
  const gain = o.gain ?? 0.1;
  const det = o.detune ?? 9;
  const lp = v.filter('lowpass', o.cutoff ?? 1200, 0.8);
  const lfo = v.osc('sine', 0.13 + v.random() * 0.1);
  lfo.connect(v.gain((o.cutoff ?? 1200) * 0.35)).connect(lp.frequency);
  const sum = v.gain(1 / Math.sqrt(Math.max(1, notes.length * 2)));
  for (const m of notes) {
    const f = midiToFreq(m);
    for (const dt of [-det, det]) v.osc('sawtooth', f, dt + (v.random() - 0.5) * 4).connect(sum);
    v.osc('triangle', f * 0.5).connect(v.gain(0.35)).connect(sum);
  }
  const g = v.gain();
  envASR(g.gain, t, gain, a, Math.max(0, dur - a), r);
  v.chain(sum, lp, g, d.out);
  g.connect(v.gain(o.send ?? 0.5)).connect(d.send);
  v.play(t, t + dur + r + 0.05);
}

/** FM bell / celesta. */
export function bell(d: Dest, t: number, midi: number, gain = 0.1, decay = 2.2, send = 0.6, detuneCents = 0): void {
  const v = new Voice(d);
  const f = midiToFreq(midi);
  const car = v.osc('sine', f, detuneCents);
  const mod = v.osc('sine', f * 3.5, detuneCents);
  const idx = v.gain(0);
  idx.gain.setValueAtTime(f * 2.2, t);
  idx.gain.exponentialRampToValueAtTime(f * 0.05, t + decay * 0.6);
  mod.connect(idx).connect(car.frequency);
  const g = v.gain();
  envAD(g.gain, t, gain, 0.002, decay);
  car.connect(g).connect(d.out);
  const p2 = v.osc('sine', f * 2.76, detuneCents);
  const g2 = v.gain();
  envAD(g2.gain, t, gain * 0.25, 0.002, decay * 0.3);
  p2.connect(g2).connect(d.out);
  g.connect(v.gain(send)).connect(d.send);
  v.play(t, t + decay + 0.05);
}

/** Plucked synth (saw+square through a fast-closing lowpass). */
export function pluck(d: Dest, t: number, midi: number, gain = 0.08, bright = 1, decay = 0.35, send = 0.3): void {
  const v = new Voice(d);
  const f = midiToFreq(midi);
  const sum = v.gain(0.5);
  v.osc('sawtooth', f, -4).connect(sum);
  v.osc('square', f, 5).connect(v.gain(0.5)).connect(sum);
  const lp = v.filter('lowpass', 3000, 2);
  expPoints(lp.frequency, t, [
    [0, 600 + 3600 * bright],
    [decay * 0.7, 350],
  ]);
  const g = v.gain();
  envAD(g.gain, t, gain, 0.003, decay);
  v.chain(sum, lp, g, d.out);
  g.connect(v.gain(send)).connect(d.send);
  v.play(t, t + decay + 0.05);
}

/** Aggressive bass (saw + sub square, resonant filter envelope, mild drive). */
export function bass(d: Dest, t: number, midi: number, dur: number, gain = 0.2, cutoff = 900): void {
  const v = new Voice(d);
  const f = midiToFreq(midi);
  const sum = v.gain(0.6);
  v.osc('sawtooth', f, -6).connect(sum);
  v.osc('sawtooth', f, 7).connect(sum);
  v.osc('square', f * 0.5).connect(v.gain(0.6)).connect(sum);
  const lp = v.filter('lowpass', cutoff, 5);
  expPoints(lp.frequency, t, [
    [0, cutoff],
    [Math.max(0.03, dur * 0.8), Math.max(80, cutoff * 0.22)],
  ]);
  const g = v.gain();
  envASR(g.gain, t, gain, 0.004, Math.max(0, dur - 0.03), 0.04, 0.7);
  v.chain(sum, lp, v.shaper(1.5), g, d.out);
  v.play(t, t + dur + 0.06);
}

/** Soft sine bass / sub. */
export function subBass(d: Dest, t: number, midi: number, dur: number, gain = 0.18): void {
  const v = new Voice(d);
  const o = v.osc('sine', midiToFreq(midi));
  const o2 = v.osc('triangle', midiToFreq(midi));
  const g = v.gain();
  envASR(g.gain, t, gain, 0.02, Math.max(0, dur - 0.1), 0.15, 0.85);
  o.connect(g);
  o2.connect(v.gain(0.25)).connect(g);
  g.connect(d.out);
  v.play(t, t + dur + 0.2);
}

/** Taiko-like drum: pitch-dropping body + skin noise. `size` scales pitch (1 = big drum). */
export function taiko(d: Dest, t: number, vel: number, size = 1, send = 0.35): void {
  const v = new Voice(d);
  const k = clamp(vel, 0, 1.2);
  const bus = v.gain(1);
  bus.connect(d.out);
  bus.connect(v.gain(send)).connect(d.send);
  const body = v.osc('sine', 140 / size);
  expPoints(body.frequency, t, [
    [0, 150 / size],
    [0.18, 58 / size],
  ]);
  const g = v.gain();
  envAD(g.gain, t, 0.7 * k, 0.002, 0.55 * size);
  body.connect(g).connect(bus);
  const m2 = v.osc('triangle', 230 / size);
  expPoints(m2.frequency, t, [
    [0, 240 / size],
    [0.1, 120 / size],
  ]);
  const g2 = v.gain();
  envAD(g2.gain, t, 0.22 * k, 0.002, 0.18);
  m2.connect(g2).connect(bus);
  const n = v.noise('white');
  const lp = v.filter('lowpass', 1100 / size, 0.8);
  const ng = v.gain();
  envAD(ng.gain, t, 0.35 * k, 0.001, 0.09);
  v.chain(n, lp, ng, bus);
  v.play(t, t + 0.6 * size + 0.05);
}

/** Small high drum (shime-daiko-ish). */
export function shime(d: Dest, t: number, vel: number): void {
  const v = new Voice(d);
  const o = v.osc('sine', 420);
  expPoints(o.frequency, t, [
    [0, 480],
    [0.06, 300],
  ]);
  const g = v.gain();
  envAD(g.gain, t, 0.25 * vel, 0.001, 0.09);
  o.connect(g).connect(d.out);
  const n = v.noise('white');
  const bp = v.filter('bandpass', 2600, 1.5);
  const ng = v.gain();
  envAD(ng.gain, t, 0.2 * vel, 0.001, 0.035);
  v.chain(n, bp, ng, d.out);
  v.play(t, t + 0.13);
}

export function hat(d: Dest, t: number, vel: number, open = false): void {
  const v = new Voice(d);
  const n = v.noise('white');
  const hp = v.filter('highpass', 7000, 0.7);
  const g = v.gain();
  envAD(g.gain, t, 0.12 * vel, 0.001, open ? 0.22 : 0.04);
  v.chain(n, hp, g, d.out);
  v.play(t, t + (open ? 0.26 : 0.06));
}

export function clap(d: Dest, t: number, vel: number): void {
  const v = new Voice(d);
  const n = v.noise('white');
  const bp = v.filter('bandpass', 1200, 0.9);
  const g = v.gain(0);
  const p = g.gain;
  p.setValueAtTime(0, t);
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 0.011;
    p.setValueAtTime(0.3 * vel, tt);
    p.exponentialRampToValueAtTime(0.03 * vel, tt + 0.009);
  }
  p.setValueAtTime(0.25 * vel, t + 0.034);
  p.exponentialRampToValueAtTime(1e-4, t + 0.16);
  p.linearRampToValueAtTime(0, t + 0.17);
  v.chain(n, bp, g, d.out);
  g.connect(v.gain(0.4)).connect(d.send);
  v.play(t, t + 0.2);
}

export function softKick(d: Dest, t: number, vel: number): void {
  const v = new Voice(d);
  const o = v.osc('sine', 120);
  expPoints(o.frequency, t, [
    [0, 125],
    [0.12, 45],
  ]);
  const g = v.gain();
  envAD(g.gain, t, 0.45 * vel, 0.002, 0.25);
  o.connect(g).connect(d.out);
  v.play(t, t + 0.3);
}

/** Short staccato string chord (detuned saws, filtered). */
export function stacStrings(d: Dest, t: number, notes: number[], dur: number, gain: number, cutoff: number): void {
  const v = new Voice(d);
  const sum = v.gain(1 / Math.sqrt(notes.length * 2));
  for (const m of notes) {
    const f = midiToFreq(m);
    v.osc('sawtooth', f, -7).connect(sum);
    v.osc('sawtooth', f, 6).connect(sum);
  }
  const lp = v.filter('lowpass', cutoff, 1.2);
  const hp = v.filter('highpass', 180, 0.7);
  const g = v.gain();
  envASR(g.gain, t, gain, 0.006, Math.max(0, dur - 0.04), 0.06, 0.6);
  v.chain(sum, hp, lp, g, d.out);
  g.connect(v.gain(0.3)).connect(d.send);
  v.play(t, t + dur + 0.08);
}

/** Sustained string swell with tremolo — for dissonant tension swells and defeat lines. */
export function swellStrings(d: Dest, t: number, notes: number[], dur: number, gain: number, cutoff = 1400, tremolo = 0): void {
  const v = new Voice(d);
  const sum = v.gain(1 / Math.sqrt(notes.length * 2));
  for (const m of notes) {
    const f = midiToFreq(m);
    for (const dt of [-8, 7]) {
      const o = v.osc('sawtooth', f, dt);
      v.osc('sine', 5 + v.random()).connect(v.gain(6)).connect(o.detune);
      o.connect(sum);
    }
  }
  const lp = v.filter('lowpass', cutoff, 0.9);
  const trem = v.gain(1 - tremolo / 2);
  if (tremolo > 0) v.osc('sine', 7.5).connect(v.gain(tremolo / 2)).connect(trem.gain);
  const g = v.gain();
  envPoints(g.gain, t, [
    [0, 0],
    [dur * 0.85, gain],
    [dur, 0],
  ]);
  v.chain(sum, lp, trem, g, d.out);
  g.connect(v.gain(0.7)).connect(d.send);
  v.play(t, t + dur + 0.05);
}

/** Brass stab / note: detuned saws with pitch scoop and an opening filter ("blat"). */
export function brass(d: Dest, t: number, notes: number[], dur: number, gain: number, bright = 1): void {
  const v = new Voice(d);
  const sum = v.gain(1 / Math.sqrt(notes.length * 2));
  for (const m of notes) {
    const f = midiToFreq(m);
    for (const dt of [-6, 5]) {
      const o = v.osc('sawtooth', f, dt);
      o.detune.setValueAtTime(dt - 45, t);
      o.detune.linearRampToValueAtTime(dt, t + 0.06);
      o.connect(sum);
    }
  }
  const lp = v.filter('lowpass', 300, 2.2);
  const peak = 600 + 2600 * bright;
  lp.frequency.setValueAtTime(320, t);
  lp.frequency.exponentialRampToValueAtTime(peak, t + 0.07);
  lp.frequency.exponentialRampToValueAtTime(Math.max(400, peak * 0.55), t + Math.max(0.12, dur));
  const g = v.gain();
  envASR(g.gain, t, gain, 0.025, Math.max(0, dur - 0.025), 0.18, 0.8);
  v.chain(sum, lp, g, d.out);
  g.connect(v.gain(0.45)).connect(d.send);
  v.play(t, t + dur + 0.25);
}

/** Timpani hit (tuned sine body + mallet noise). */
export function timpani(d: Dest, t: number, midi: number, vel: number): void {
  const v = new Voice(d);
  const f = midiToFreq(midi);
  const o = v.osc('sine', f);
  o.frequency.setValueAtTime(f * 1.06, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  const o2 = v.osc('sine', f * 1.5);
  const g = v.gain();
  envAD(g.gain, t, 0.55 * vel, 0.003, 1.4);
  const g2 = v.gain();
  envAD(g2.gain, t, 0.18 * vel, 0.003, 0.5);
  o.connect(g).connect(d.out);
  o2.connect(g2).connect(d.out);
  const n = v.noise('white');
  const lp = v.filter('lowpass', 900, 0.7);
  const ng = v.gain();
  envAD(ng.gain, t, 0.2 * vel, 0.001, 0.06);
  v.chain(n, lp, ng, d.out);
  g.connect(v.gain(0.4)).connect(d.send);
  v.play(t, t + 1.5);
}

/** Cymbal swell or crash from filtered noise. */
export function cymbal(d: Dest, t: number, dur: number, gain: number, swell: boolean): void {
  const v = new Voice(d);
  const n = v.noise('white');
  const hp = v.filter('highpass', 4500, 0.7);
  const pk = v.filter('peaking', 8000, 2, 6);
  const g = v.gain();
  if (swell) {
    envPoints(g.gain, t, [
      [0, 0],
      [dur * 0.95, gain],
      [dur, 0],
    ]);
  } else {
    envAD(g.gain, t, gain, 0.003, dur);
  }
  v.chain(n, hp, pk, g, d.out);
  g.connect(v.gain(0.6)).connect(d.send);
  v.play(t, t + dur + 0.05);
}

/** Heartbeat lub-dub. */
export function heartbeat(d: Dest, t: number, gain: number): void {
  const v = new Voice(d);
  for (const [o, k] of [
    [0, 1],
    [0.21, 0.7],
  ] as const) {
    const s = v.osc('sine', 60);
    expPoints(s.frequency, t + o, [
      [0, 62],
      [0.1, 38],
    ]);
    const g = v.gain();
    envAD(g.gain, t + o, gain * k, 0.008, 0.16);
    s.connect(g).connect(d.out);
  }
  v.play(t, t + 0.45);
}

/** Low drone (saws through a slowly moving lowpass). */
export function drone(d: Dest, t: number, notes: number[], dur: number, gain: number, cutoff = 220): void {
  const v = new Voice(d);
  const sum = v.gain(1 / Math.sqrt(notes.length * 2));
  for (const m of notes) {
    const f = midiToFreq(m);
    v.osc('sawtooth', f, -5).connect(sum);
    v.osc('sawtooth', f, 6).connect(sum);
  }
  const lp = v.filter('lowpass', cutoff, 2);
  v.osc('sine', 0.07).connect(v.gain(cutoff * 0.5)).connect(lp.frequency);
  const g = v.gain();
  const a = Math.min(2.5, dur * 0.3);
  envASR(g.gain, t, gain, a, Math.max(0, dur - 2 * a), a);
  v.chain(sum, lp, g, d.out);
  g.connect(v.gain(0.4)).connect(d.send);
  v.play(t, t + dur + 0.05);
}

/** Noise riser. */
export function riser(d: Dest, t: number, dur: number, gain: number): void {
  const v = new Voice(d);
  const n = v.noise('white');
  const bp = v.filter('bandpass', 300, 2);
  expPoints(bp.frequency, t, [
    [0, 300],
    [dur, 6500],
  ]);
  const g = v.gain();
  envPoints(g.gain, t, [
    [0, 0],
    [dur * 0.95, gain],
    [dur, 0],
  ]);
  v.chain(n, bp, g, d.out);
  g.connect(v.gain(0.5)).connect(d.send);
  v.play(t, t + dur + 0.02);
}

/** Inharmonic gong-like tail for the defeat sting. */
export function gong(d: Dest, t: number, gain: number): void {
  const v = new Voice(d);
  for (const [f, k, dec] of [
    [73, 1, 3.5],
    [104, 0.6, 3],
    [161, 0.45, 2.4],
    [233, 0.3, 1.8],
    [347, 0.2, 1.2],
  ] as const) {
    const o = v.osc('sine', f);
    const g = v.gain();
    envAD(g.gain, t, gain * k, 0.01, dec);
    o.connect(g).connect(d.out);
    g.connect(v.gain(0.5)).connect(d.send);
  }
  v.play(t, t + 3.6);
}
