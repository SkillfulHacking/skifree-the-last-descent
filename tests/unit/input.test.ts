import { describe, expect, it, beforeEach } from 'vitest';
import { applyDeadzone, triggerValue, detectPadType, Input, DEFAULT_BINDINGS, PAD, type PadLike } from '../../src/input/Input';

/** Minimal window stand-in with event dispatch. */
class FakeWindow {
  private l = new Map<string, Array<(e: unknown) => void>>();
  addEventListener(t: string, fn: (e: unknown) => void) {
    (this.l.get(t) ?? this.l.set(t, []).get(t)!).push(fn);
  }
  fire(t: string, e: object) {
    for (const fn of this.l.get(t) ?? []) fn({ preventDefault() {}, repeat: false, ...e });
  }
}

function pad(over: Partial<{ axes: number[]; buttons: Array<{ value: number; pressed: boolean }> }> = {}, id = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)'): PadLike {
  const buttons = Array.from({ length: 17 }, () => ({ value: 0, pressed: false }));
  over.buttons?.forEach((b, i) => (buttons[i] = b));
  return { id, connected: true, mapping: 'standard', axes: over.axes ?? [0, 0, 0, 0], buttons };
}

const settings = () => ({ deadzone: 0.15, steerSensitivity: 1, cameraSensitivity: 1, invertCameraX: false, invertCameraY: false, bindings: structuredClone(DEFAULT_BINDINGS) });

beforeEach(() => {
  (globalThis as unknown as { document: object }).document = { pointerLockElement: null };
});

describe('input', () => {
  it('dead zone: zero inside, continuous and rescaled outside', () => {
    expect(applyDeadzone(0.1, 0.05, 0.15)).toEqual([0, 0]);
    const [a] = applyDeadzone(0.2, 0, 0.15);
    const [b] = applyDeadzone(0.5, 0, 0.15);
    const [c] = applyDeadzone(1, 0, 0.15);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeCloseTo(1, 5);
  });

  it('analog trigger values behave continuously', () => {
    let prev = -1;
    for (let v = 0; v <= 1.0001; v += 0.05) {
      const t = triggerValue({ value: v, pressed: v > 0.5 });
      expect(t).toBeGreaterThanOrEqual(prev);
      expect(t).toBeLessThanOrEqual(1);
      prev = t;
    }
    expect(triggerValue({ value: 0, pressed: true })).toBe(1); // digital-only triggers
    expect(triggerValue(undefined)).toBe(0);
  });

  it('detects controller families', () => {
    expect(detectPadType('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe('xbox');
    expect(detectPadType('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(detectPadType('8BitDo Pro 2')).toBe('gamepad');
  });

  it('keyboard movement works (steer ramps, tuck, brake, drift, pop)', () => {
    const w = new FakeWindow();
    const inp = new Input(settings(), w as unknown as Window);
    inp.padSource = () => [];
    w.fire('keydown', { code: 'KeyD' });
    w.fire('keydown', { code: 'KeyW' });
    w.fire('keydown', { code: 'ShiftLeft' });
    inp.poll();
    let g = inp.gameplay(1 / 60);
    expect(g.steer).toBeGreaterThan(0);
    expect(g.steer).toBeLessThan(1); // ramped
    for (let i = 0; i < 30; i++) g = inp.gameplay(1 / 60);
    expect(g.steer).toBeCloseTo(1, 5);
    expect(g.tuck).toBe(1);
    expect(g.drift).toBe(true);
    w.fire('keyup', { code: 'KeyD' });
    w.fire('keydown', { code: 'ArrowLeft' });
    for (let i = 0; i < 30; i++) g = inp.gameplay(1 / 60);
    expect(g.steer).toBeCloseTo(-1, 5);
    expect(inp.activeDevice).toBe('keyboard');
  });

  it('gamepad inputs map correctly and hot-switch the active device', () => {
    const w = new FakeWindow();
    const inp = new Input(settings(), w as unknown as Window);
    const buttons: Array<{ value: number; pressed: boolean }> = [];
    buttons[PAD.RT] = { value: 0.6, pressed: true };
    buttons[PAD.LT] = { value: 0.25, pressed: false };
    buttons[PAD.RB] = { value: 1, pressed: true };
    buttons[PAD.A] = { value: 1, pressed: true };
    let p = pad({ axes: [-0.9, 0, 0.5, 0], buttons });
    inp.padSource = () => [null, p];
    inp.poll();
    const g = inp.gameplay(1 / 60);
    expect(g.steer).toBeLessThan(-0.6);
    expect(g.tuck).toBeGreaterThan(0.5);
    expect(g.tuck).toBeLessThan(0.65);
    expect(g.brake).toBeGreaterThan(0.15);
    expect(g.drift).toBe(true);
    expect(g.pop).toBe(true);
    expect(g.camX).toBeGreaterThan(0);
    expect(inp.activeDevice).toBe('xbox');
    // press Y → recover edge (once)
    const b2 = [...p.buttons];
    b2[PAD.Y] = { value: 1, pressed: true };
    p = { ...p, buttons: b2 };
    inp.poll();
    expect(inp.gameplay(1 / 60).recoverPressed).toBe(true);
    inp.poll();
    expect(inp.gameplay(1 / 60).recoverPressed).toBe(false);
    // keyboard press switches back
    w.fire('keydown', { code: 'KeyA' });
    expect(inp.activeDevice).toBe('keyboard');
  });

  it('gamepad disconnects and broken sources do not crash', () => {
    const w = new FakeWindow();
    const inp = new Input(settings(), w as unknown as Window);
    inp.padSource = () => [pad({ axes: [1, 0, 0, 0] })];
    inp.poll();
    expect(inp.gameplay(1 / 60).steer).toBeGreaterThan(0.5);
    inp.padSource = () => [null, null];
    expect(() => inp.poll()).not.toThrow();
    expect(inp.gameplay(1 / 60).steer).toBe(0);
    inp.padSource = () => {
      throw new Error('getGamepads blocked');
    };
    expect(() => inp.poll()).not.toThrow();
    w.fire('gamepaddisconnected', {});
    expect(inp.activeDevice).toBe('keyboard');
  });

  it('pause works from keyboard and gamepad start', () => {
    const w = new FakeWindow();
    const inp = new Input(settings(), w as unknown as Window);
    inp.padSource = () => [];
    w.fire('keydown', { code: 'Escape' });
    inp.poll();
    expect(inp.gameplay(1 / 60).pausePressed).toBe(true);
    expect(inp.gameplay(1 / 60).pausePressed).toBe(false);
    const b: Array<{ value: number; pressed: boolean }> = [];
    b[PAD.START] = { value: 1, pressed: true };
    inp.padSource = () => [pad({ buttons: b })];
    inp.poll();
    expect(inp.gameplay(1 / 60).pausePressed).toBe(true);
  });

  it('remapped keys are honoured', () => {
    const w = new FakeWindow();
    const s = settings();
    s.bindings.tuck = ['KeyI'];
    const inp = new Input(s, w as unknown as Window);
    inp.padSource = () => [];
    w.fire('keydown', { code: 'KeyW' });
    expect(inp.gameplay(1 / 60).tuck).toBe(0);
    w.fire('keydown', { code: 'KeyI' });
    expect(inp.gameplay(1 / 60).tuck).toBe(1);
  });
});
