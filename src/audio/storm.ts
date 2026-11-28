/**
 * Storm sound (Whiteout Ridge), synthesized: cues for the blizzard cells and the wind drifts.
 *  - 'blizzard-build': a rising, widening roar of wind from upwind (the cell coming in);
 *  - 'blizzard-roar': the cell arriving — a deep, buffeting roar with a hiss of driven snow;
 *  - 'drift-plough': skis ploughing into deep drifted snow (a soft, muffled whump).
 */
import type { Dest, Vec3Like } from './graph';
import { Voice, envAD, envPoints, expPoints } from './graph';

export const STORM_CUES = ['blizzard-build', 'blizzard-roar', 'drift-plough'] as const;

export function isStormCue(id: string): boolean {
  return (STORM_CUES as readonly string[]).includes(id);
}

export function stormCue(d: Dest, t: number, id: string, pos: Vec3Like | null): number {
  const v = new Voice(d);
  const sp = v.spatial(pos, 30);
  sp.connect(d.out);
  if (id === 'blizzard-build' || id === 'blizzard-roar') {
    const build = id === 'blizzard-build';
    const dur = build ? 4.6 : 3.2;
    const n = v.noise('white');
    const bp = v.filter('bandpass', 400, 0.8);
    const g = v.gain(0);
    expPoints(bp.frequency, t, build ? [[0, 220], [dur, 1100]] : [[0, 900], [dur * 0.5, 600], [dur, 300]]);
    envPoints(g.gain, t, build ? [[0, 0], [dur * 0.9, 0.38], [dur, 0.3]] : [[0, 0.3], [0.4, 0.62], [dur * 0.7, 0.45], [dur, 0]]);
    n.connect(bp).connect(g).connect(sp);
    // buffeting: slow amplitude wobble on a low roar
    const lo = v.noise('brown');
    const lg = v.gain(0);
    envPoints(lg.gain, t, [[0, 0], [dur * 0.5, build ? 0.3 : 0.7], [dur, build ? 0.4 : 0]]);
    const am = v.osc('sine', build ? 1.3 : 2.1);
    const amg = v.gain(0.25);
    am.connect(amg).connect(lg.gain);
    lo.connect(v.filter('lowpass', 260, 0.7)).connect(lg).connect(sp);
    // the hiss of driven snow
    const hs = v.noise('white');
    const hg = v.gain(0);
    envPoints(hg.gain, t, [[0, 0], [dur * 0.8, build ? 0.06 : 0.12], [dur, 0]]);
    hs.connect(v.filter('highpass', 4200, 0.7)).connect(hg).connect(sp);
    v.play(t, t + dur + 0.05);
    return dur;
  }
  if (id === 'drift-plough') {
    const n = v.noise('brown');
    const g = v.gain(0);
    envAD(g.gain, t, 0.5, 0.03, 0.45);
    n.connect(v.filter('lowpass', 520, 0.9)).connect(g).connect(sp);
    v.play(t, t + 0.55);
    return 0.55;
  }
  v.play(t, t + 0.01);
  return 0;
}
