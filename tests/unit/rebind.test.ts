import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, rebindKey, type Action } from '../../src/input/Input';

const ACTIONS: Action[] = ['left', 'right', 'tuck', 'brake', 'drift', 'pop', 'recover', 'lookback', 'pause'];
const fresh = () => JSON.parse(JSON.stringify(DEFAULT_BINDINGS)) as Record<Action, string[]>;
const usable = (b: Record<Action, string[]>, a: Action) => b[a].some((k) => k !== 'Escape');

describe('Controls rebind (Pass 6 round 2, QA M1)', () => {
  it('Pop → R swaps: Recover takes Space', () => {
    const b = fresh();
    expect(rebindKey(b, 'pop', 'KeyR', ACTIONS)).toBe(true);
    expect(b.pop[0]).toBe('KeyR');
    expect(b.recover).toEqual(['Space']);
  });
  it('Pause → R never leaves Recover on Escape', () => {
    const b = fresh();
    expect(rebindKey(b, 'pause', 'KeyR', ACTIONS)).toBe(true);
    expect(b.recover).toEqual(['KeyP']);
    expect(b.pause).toContain('KeyR');
    expect(b.pause).toContain('Escape');
    expect(b.pause).not.toContain('KeyP');
  });
  it('Pause (Escape only) → Space / C keep Pop and Look back usable', () => {
    for (const [code, victim] of [['Space', 'pop'], ['KeyC', 'lookback']] as const) {
      const b = fresh();
      b.pause = ['Escape'];
      const before = JSON.stringify(b);
      // Pause has only Escape and the victim's only default is the key itself: refused, untouched
      if (!rebindKey(b, 'pause', code, ACTIONS)) expect(JSON.stringify(b)).toBe(before);
      expect(usable(b, victim)).toBe(true);
      expect(b[victim]).not.toContain('Escape');
    }
  });
  it('no key is ever bound to two gameplay actions, nothing is left without a usable key', () => {
    const codes = ['KeyR', 'Space', 'KeyW', 'KeyP', 'KeyC', 'KeyA', 'ShiftLeft', 'KeyF'];
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
    const b = fresh();
    for (let i = 0; i < 400; i++) {
      const a = ACTIONS[rnd(ACTIONS.length)]!;
      const before = JSON.stringify(b);
      const ok = rebindKey(b, a, codes[rnd(codes.length)]!, ACTIONS);
      if (!ok) expect(JSON.stringify(b)).toBe(before);
      for (const x of ACTIONS) expect(usable(b, x) || x === 'pause').toBe(true);
      expect(b.pause).toContain('Escape');
      const seen = new Map<string, Action>();
      for (const x of ACTIONS)
        for (const k of b[x]) {
          if (k === 'Escape') continue;
          expect(seen.get(k), `${k} on ${seen.get(k)} and ${x}`).toBeUndefined();
          seen.set(k, x);
        }
    }
  });
  it('Escape cannot be bound', () => {
    const b = fresh();
    expect(rebindKey(b, 'tuck', 'Escape', ACTIONS)).toBe(false);
    expect(b).toEqual(fresh());
  });
});
