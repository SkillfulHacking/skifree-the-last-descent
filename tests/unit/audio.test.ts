import { describe, expect, it } from 'vitest';
import {
  MODE_BPM,
  StepClock,
  VoiceLimiter,
  adsrEnd,
  adsrValueAt,
  bufferStats,
  chaseMix,
  clamp,
  crowdTargets,
  generateImpulse,
  gustValue,
  introRecentlyPlayed,
  makeDriveCurve,
  makeSoftClipCurve,
  midiToFreq,
  modeFadeIn,
  musicDuck,
  mulberry32,
  skiTargets,
  smoothFactor,
  softClipValue,
  windTargets,
  yetiBreathTargets,
  type SkiInput,
} from '../../src/audio/logic';

const ski = (o: Partial<SkiInput> = {}): SkiInput => ({
  speed: 15,
  grounded: true,
  edgeLoad: 0.5,
  brake: 0,
  drifting: false,
  surface: 'snow',
  crashed: false,
  ...o,
});

describe('basic math', () => {
  it('midiToFreq', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
  });
  it('clamp handles NaN and bounds', () => {
    expect(clamp(2)).toBe(1);
    expect(clamp(-1)).toBe(0);
    expect(clamp(Number.NaN)).toBe(0);
  });
  it('smoothFactor is frame-rate independent', () => {
    const tau = 0.2;
    let a = 0;
    for (let i = 0; i < 60; i++) a += (1 - a) * smoothFactor(1 / 60, tau);
    let b = 0;
    for (let i = 0; i < 120; i++) b += (1 - b) * smoothFactor(1 / 120, tau);
    expect(a).toBeCloseTo(b, 6);
  });
  it('mulberry32 is deterministic and in range', () => {
    const r1 = mulberry32(5);
    const r2 = mulberry32(5);
    for (let i = 0; i < 100; i++) {
      const x = r1();
      expect(x).toBe(r2());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('envelopes', () => {
  const e = { a: 0.1, d: 0.2, s: 0.5, r: 0.4, peak: 1 };
  it('ADSR segments', () => {
    expect(adsrValueAt(-1, 1, e)).toBe(0);
    expect(adsrValueAt(0.05, 1, e)).toBeCloseTo(0.5, 6);
    expect(adsrValueAt(0.1, 1, e)).toBeCloseTo(1, 6);
    expect(adsrValueAt(0.2, 1, e)).toBeCloseTo(0.75, 6);
    expect(adsrValueAt(0.6, 1, e)).toBeCloseTo(0.5, 6);
    expect(adsrValueAt(1.2, 1, e)).toBeCloseTo(0.25, 6);
    expect(adsrValueAt(1.4, 1, e)).toBeCloseTo(0, 9);
    expect(adsrValueAt(1.5, 1, e)).toBe(0);
    expect(adsrEnd(1, e)).toBeCloseTo(1.4, 6);
  });
  it('releases from the current level when gate ends during attack (no jump)', () => {
    const v = adsrValueAt(0.05, 0.05, e);
    expect(adsrValueAt(0.0501, 0.05, e)).toBeLessThanOrEqual(v);
    expect(v).toBeCloseTo(0.5, 6);
  });
});

describe('StepClock lookahead scheduling', () => {
  it('returns steps inside the window and advances', () => {
    const c = new StepClock(120, 0); // 16ths at 120 bpm = 0.125 s
    expect(c.stepDur).toBeCloseTo(0.125, 9);
    const a = c.advance(0.5);
    expect(a.map((x) => x.step)).toEqual([0, 1, 2, 3]);
    expect(a[3]!.time).toBeCloseTo(0.375, 9);
    expect(c.advance(0.5)).toEqual([]);
    const b = c.advance(0.6);
    expect(b).toHaveLength(1);
    expect(b[0]!.step).toBe(4);
  });
  it('repeated small lookahead windows never duplicate or skip steps', () => {
    const c = new StepClock(MODE_BPM.chase, 0);
    const seen: number[] = [];
    for (let now = 0; now < 10; now += 0.025) for (const ev of c.advance(now + 0.15)) seen.push(ev.step);
    for (let i = 0; i < seen.length; i++) expect(seen[i]).toBe(i);
    // 156 bpm * 4 steps/beat over ~10.15 s
    expect(seen.length).toBe(Math.ceil(10.15 / (60 / 156 / 4)));
  });
  it('catchUp skips missed steps after a stall instead of bursting', () => {
    const c = new StepClock(100, 0);
    c.advance(0.2);
    const skipped = c.catchUp(5);
    expect(skipped).toBeGreaterThan(0);
    expect(c.nextTime).toBeGreaterThanOrEqual(5);
    expect(c.nextTime - 5).toBeLessThan(c.stepDur + 1e-9);
    expect(c.catchUp(c.nextTime)).toBe(0);
  });
  it('resync keeps the step counter', () => {
    const c = new StepClock(100, 0);
    c.advance(1);
    const s = c.step;
    c.resync(10);
    const ev = c.advance(10.01);
    expect(ev[0]!.step).toBe(s);
    expect(ev[0]!.time).toBe(10);
  });
});

describe('VoiceLimiter', () => {
  it('caps per-key and global polyphony and frees voices after they end', () => {
    const l = new VoiceLimiter(3);
    expect(l.tryAcquire('a', 0, 1, 2)).toBe(true);
    expect(l.tryAcquire('a', 0, 1, 2)).toBe(true);
    expect(l.tryAcquire('a', 0, 1, 2)).toBe(false);
    expect(l.tryAcquire('b', 0, 1, 5)).toBe(true);
    expect(l.tryAcquire('c', 0, 1, 5)).toBe(false); // global cap
    expect(l.count(0)).toBe(3);
    expect(l.tryAcquire('a', 1.01, 1, 2)).toBe(true);
    expect(l.count(1.01)).toBe(1);
  });
  it('rate-limits retriggers', () => {
    const l = new VoiceLimiter(10);
    expect(l.tryAcquire('x', 0, 0.01, 10, 0.1)).toBe(true);
    expect(l.tryAcquire('x', 0.05, 0.01, 10, 0.1)).toBe(false);
    expect(l.tryAcquire('x', 0.11, 0.01, 10, 0.1)).toBe(true);
  });
});

describe('curves and impulses', () => {
  it('soft clipper is transparent below 0.9 and never reaches 1', () => {
    expect(softClipValue(0.5)).toBe(0.5);
    expect(softClipValue(-0.8)).toBe(-0.8);
    for (const x of [0.95, 1, 2, 10, 1e6]) {
      expect(softClipValue(x)).toBeLessThan(0.99);
      expect(softClipValue(-x)).toBeGreaterThan(-0.99);
    }
    const c = makeSoftClipCurve(1025, 2);
    expect(c[512]).toBeCloseTo(0, 6);
    for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThanOrEqual(c[i - 1]!);
  });
  it('drive curve is odd, monotonic and normalised', () => {
    const c = makeDriveCurve(4, 1001);
    expect(c[0]).toBeCloseTo(-1, 6);
    expect(c[1000]).toBeCloseTo(1, 6);
    expect(c[500]).toBeCloseTo(0, 6);
    for (let i = 0; i < 500; i++) expect(c[i]!).toBeCloseTo(-c[1000 - i]!, 6);
  });
  it('generated impulse decays, is finite and deterministic', () => {
    const [l, r] = generateImpulse(8000, 2, { seed: 3, damping: 0.2 });
    const [l2] = generateImpulse(8000, 2, { seed: 3, damping: 0.2 });
    expect(l.length).toBe(16000);
    expect(r.length).toBe(16000);
    expect(l[1234]).toBe(l2[1234]);
    const energy = (a: Float32Array, s: number, e: number): number => {
      let x = 0;
      for (let i = s; i < e; i++) x += a[i]! * a[i]!;
      return x;
    };
    expect(energy(l, 0, 4000)).toBeGreaterThan(energy(l, 12000, 16000) * 50);
    expect(bufferStats([l, r], 8000).nans).toBe(0);
  });
});

describe('continuous layer mappings', () => {
  it('wind gets louder and brighter with speed and ducks with eerie', () => {
    const slow = windTargets(2, 0, 0.5);
    const fast = windTargets(30, 0, 0.5);
    expect(fast.lowGain).toBeGreaterThan(slow.lowGain);
    expect(fast.whistleGain).toBeGreaterThan(slow.whistleGain);
    expect(fast.whistleFreq).toBeGreaterThan(slow.whistleFreq);
    const eerie = windTargets(30, 1, 0.5);
    expect(eerie.lowGain).toBeLessThan(fast.lowGain * 0.3);
  });
  it('gust stays within 0..1', () => {
    for (let t = 0; t < 200; t += 0.37) {
      const g = gustValue(t);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
  it('ski scrape follows speed × edge load and is silent airborne / crashed', () => {
    expect(skiTargets(ski({ speed: 25, edgeLoad: 1 })).scrapeGain).toBeGreaterThan(skiTargets(ski({ speed: 5, edgeLoad: 0 })).scrapeGain);
    expect(skiTargets(ski({ speed: 25, edgeLoad: 1 })).scrapeFreq).toBeGreaterThan(skiTargets(ski({ speed: 5 })).scrapeFreq);
    for (const o of [{ grounded: false }, { crashed: true }, { speed: 0 }]) {
      const k = skiTargets(ski({ ...o, brake: 1, drifting: true }));
      expect(k.scrapeGain + k.iceGain + k.powderGain).toBe(0);
      if (!('speed' in o)) expect(k.chatterDepth).toBe(0);
    }
  });
  it('braking / drifting adds crunchy chatter', () => {
    expect(skiTargets(ski()).chatterDepth).toBe(0);
    expect(skiTargets(ski({ brake: 1 })).chatterDepth).toBeGreaterThan(0.5);
    expect(skiTargets(ski({ drifting: true })).chatterDepth).toBeGreaterThan(0.5);
  });
  it('surface selects the right layers', () => {
    const ice = skiTargets(ski({ surface: 'ice' }));
    const powder = skiTargets(ski({ surface: 'powder' }));
    const snow = skiTargets(ski({ surface: 'snow' }));
    expect(ice.iceGain).toBeGreaterThan(snow.iceGain);
    expect(ice.scrapeFreq).toBeGreaterThan(snow.scrapeFreq);
    expect(powder.powderGain).toBeGreaterThan(snow.powderGain);
    expect(powder.scrapeGain).toBeLessThan(snow.scrapeGain);
    expect(powder.iceGain).toBe(0);
  });
  it('yeti breathing gets louder as it approaches and faster when running', () => {
    expect(yetiBreathTargets(null, true).active).toBe(false);
    expect(yetiBreathTargets(500, true).active).toBe(false);
    const far = yetiBreathTargets(80, false);
    const near = yetiBreathTargets(8, false);
    expect(near.gain).toBeGreaterThan(far.gain);
    expect(near.gain).toBeLessThanOrEqual(1);
    expect(yetiBreathTargets(8, true).period).toBeLessThan(near.period);
  });
  it('crowd scales with level', () => {
    expect(crowdTargets(0).murmurGain).toBe(0);
    expect(crowdTargets(1).murmurGain).toBeGreaterThan(crowdTargets(0.3).murmurGain);
    expect(crowdTargets(2).laughRate).toBe(crowdTargets(1).laughRate);
  });
});

describe('music state mapping', () => {
  it('tempos match the brief', () => {
    expect(MODE_BPM.explore).toBeGreaterThanOrEqual(95);
    expect(MODE_BPM.explore).toBeLessThanOrEqual(105);
    expect(MODE_BPM.chase).toBeGreaterThanOrEqual(150);
    expect(MODE_BPM.chase).toBeLessThanOrEqual(160);
  });
  it('chase intensity adds layers and opens the filter monotonically', () => {
    const lo = chaseMix(0);
    const hi = chaseMix(1);
    expect(lo.brass).toBe(0);
    expect(lo.extraTaiko || lo.roll || lo.riser || lo.shime).toBe(false);
    expect(hi.extraTaiko && hi.roll && hi.riser && hi.shime).toBe(true);
    expect(hi.brass).toBeCloseTo(1, 6);
    let prev = chaseMix(0);
    for (let i = 0.05; i <= 1.0001; i += 0.05) {
      const m = chaseMix(i);
      expect(m.filterHz).toBeGreaterThan(prev.filterHz);
      expect(m.strings).toBeGreaterThanOrEqual(prev.strings);
      expect(m.brass).toBeGreaterThanOrEqual(prev.brass);
      expect(m.hats).toBeGreaterThanOrEqual(prev.hats);
      prev = m;
    }
    expect(hi.filterHz).toBeLessThan(20000);
    expect(chaseMix(5)).toEqual(hi);
  });
  it('fades and ducking', () => {
    expect(modeFadeIn('menu')).toBeCloseTo(1.5);
    expect(modeFadeIn('defeat')).toBeLessThan(0.5);
    expect(musicDuck(0)).toBe(1);
    expect(musicDuck(1)).toBeGreaterThan(0);
    expect(musicDuck(1)).toBeLessThan(0.5);
  });
  it('victory/defeat intro is skipped only when the one-shot just played', () => {
    expect(introRecentlyPlayed(10, 9)).toBe(true);
    expect(introRecentlyPlayed(10, 2)).toBe(false);
    expect(introRecentlyPlayed(10, -1e9)).toBe(false);
  });
});

describe('bufferStats', () => {
  it('reports peak, rms, NaNs and overs', () => {
    const a = new Float32Array([0, 0.5, -1.5, Number.NaN]);
    const s = bufferStats([a], 100);
    expect(s.peak).toBe(1.5);
    expect(s.nans).toBe(1);
    expect(s.overOne).toBe(1);
    expect(s.rms).toBeCloseTo(Math.sqrt((0.25 + 2.25) / 3), 6);
  });
});
