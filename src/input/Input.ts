/**
 * Unified input: keyboard (remappable), Gamepad API (Xbox / PlayStation / standard mapping),
 * optional mouse camera look. Hot-switches the "active device" for on-screen prompts.
 */
import { clamp } from '../core/rng';

export type Action = 'left' | 'right' | 'tuck' | 'brake' | 'drift' | 'pop' | 'recover' | 'lookback' | 'pause' | 'skip';
export type Device = 'keyboard' | 'xbox' | 'playstation' | 'gamepad';

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  tuck: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  drift: ['ShiftLeft', 'ShiftRight'],
  pop: ['Space'],
  recover: ['KeyR'],
  lookback: ['KeyC'],
  pause: ['Escape', 'KeyP'],
  skip: ['Escape', 'Enter'],
};

export const ACTION_LABELS: Record<Action, string> = {
  left: 'Steer left',
  right: 'Steer right',
  tuck: 'French fry (tuck)',
  brake: 'Pizza (brake)',
  drift: 'Drift',
  pop: 'Pop / jump',
  recover: 'Recover',
  lookback: 'Look back',
  pause: 'Pause',
  skip: 'Skip cinematic',
};

/** Standard Gamepad mapping indices. */
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export interface InputSettings {
  deadzone: number; // 0..0.5
  steerSensitivity: number; // 0.5..2
  cameraSensitivity: number;
  invertCameraY: boolean;
  invertCameraX: boolean;
  bindings: Record<Action, string[]>;
}

export interface GameplayInput {
  steer: number;
  tuck: number;
  brake: number;
  drift: boolean;
  pop: boolean;
  recoverPressed: boolean;
  lookBack: boolean;
  pausePressed: boolean;
  skipPressed: boolean;
  camX: number;
  camY: number;
}

export interface MenuInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
}

/** Radial dead zone with rescaling and a mild response curve (pure, unit-tested). */
export function applyDeadzone(x: number, y: number, dz: number): [number, number] {
  const m = Math.hypot(x, y);
  if (m <= dz) return [0, 0];
  const scaled = Math.min(1, (m - dz) / (1 - dz));
  const curved = scaled * (0.35 + 0.65 * scaled); // finer control near centre
  return [(x / m) * curved, (y / m) * curved];
}

/** Trigger values can be reported as buttons (value) or axes (-1..1) on some browsers. */
export function triggerValue(btn: { value: number; pressed: boolean } | undefined, threshold = 0.04): number {
  if (!btn) return 0;
  const v = btn.value > 0 ? btn.value : btn.pressed ? 1 : 0;
  return v < threshold ? 0 : clamp((v - threshold) / (1 - threshold), 0, 1);
}

export function detectPadType(id: string): Device {
  const s = id.toLowerCase();
  if (s.includes('054c') || s.includes('playstation') || s.includes('dualsense') || s.includes('dualshock') || s.includes('sony')) return 'playstation';
  if (s.includes('xbox') || s.includes('045e') || s.includes('xinput') || s.includes('microsoft')) return 'xbox';
  return 'gamepad';
}

/** Minimal shape of a gamepad we read (lets tests inject fakes). */
export interface PadLike {
  id: string;
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: ReadonlyArray<{ value: number; pressed: boolean }>;
}

export class Input {
  private down = new Set<string>();
  private pressedQ = new Set<string>();
  private padPrev: boolean[] = [];
  private padNow: boolean[] = [];
  private steerKb = 0;
  private mouseDX = 0;
  private mouseDY = 0;
  private lastMenuAxis = 0;
  private menuRepeat = 0;
  activeDevice: Device = 'keyboard';
  padConnected = false;
  padName = '';
  onDeviceChange: ((d: Device) => void) | null = null;
  /** For tests/automation: overrides gamepad source. */
  padSource: () => ReadonlyArray<PadLike | null> = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []);
  /** When true, keyboard events are captured (gameplay). When false (text/menus), default browser behaviour is kept for non-game keys. */
  captureKeys = true;
  /** Set by remap UI: next key press is delivered here instead. */
  listenNextKey: ((code: string) => void) | null = null;
  private pad: PadLike | null = null;

  constructor(
    public settings: InputSettings,
    target: Window = window,
  ) {
    target.addEventListener('keydown', (e) => {
      if (this.listenNextKey) {
        e.preventDefault();
        const cb = this.listenNextKey;
        this.listenNextKey = null;
        cb(e.code);
        return;
      }
      // typing in a text field (custom seed / course code) is not game input
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (this.isGameKey(e.code)) e.preventDefault();
      if (!e.repeat || e.code.startsWith('Arrow')) this.pressedQ.add(e.code);
      this.down.add(e.code);
      this.setDevice('keyboard');
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      if (this.isGameKey(e.code)) e.preventDefault();
    });
    target.addEventListener('blur', () => this.down.clear());
    target.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      } else if (e.buttons & 2 || e.buttons & 1) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    target.addEventListener('gamepadconnected', (e) => {
      const ge = e as GamepadEvent;
      this.padConnected = true;
      this.padName = ge.gamepad.id;
    });
    target.addEventListener('gamepaddisconnected', () => {
      this.padConnected = false;
      this.pad = null;
      if (this.activeDevice !== 'keyboard') this.setDevice('keyboard');
    });
  }

  private isGameKey(code: string): boolean {
    if (!this.captureKeys) return false;
    if (code === 'Tab' || code.startsWith('F')) return false;
    for (const k of Object.values(this.settings.bindings)) if (k.includes(code)) return true;
    return code.startsWith('Arrow') || code === 'Space';
  }

  private setDevice(d: Device) {
    if (d !== this.activeDevice) {
      this.activeDevice = d;
      this.onDeviceChange?.(d);
    }
  }

  private key(action: Action): boolean {
    for (const c of this.settings.bindings[action]) if (this.down.has(c)) return true;
    return false;
  }

  private keyPressed(action: Action): boolean {
    for (const c of this.settings.bindings[action]) if (this.pressedQ.has(c)) return true;
    return false;
  }

  /** Poll the gamepad (call once per frame before reading). Robust to disconnects. */
  poll(): void {
    let pads: ReadonlyArray<PadLike | null> = [];
    try {
      pads = this.padSource() ?? [];
    } catch {
      pads = [];
    }
    this.pad = null;
    for (const p of pads) if (p && p.connected) {
      this.pad = p;
      break;
    }
    this.padPrev = this.padNow;
    this.padNow = [];
    if (!this.pad) {
      this.padConnected = false;
      return;
    }
    this.padConnected = true;
    this.padName = this.pad.id;
    const b = this.pad.buttons;
    for (let i = 0; i < b.length; i++) this.padNow[i] = !!b[i]?.pressed || (b[i]?.value ?? 0) > 0.5;
    // device switch on meaningful pad activity
    const ax = this.pad.axes;
    const std = this.pad.mapping === 'standard';
    const moved = Math.abs(ax[0] ?? 0) > 0.35 || Math.abs(ax[1] ?? 0) > 0.35 || (std && (Math.abs(ax[2] ?? 0) > 0.5 || Math.abs(ax[3] ?? 0) > 0.5));
    if (moved || this.padNow.some((v, i) => v && !this.padPrev[i])) this.setDevice(detectPadType(this.pad.id));
  }

  private padPressed(i: number): boolean {
    return !!this.padNow[i] && !this.padPrev[i];
  }

  /** Read gameplay input. dt drives keyboard steering ramp (keyboard acts as a quick analog). */
  gameplay(dt: number): GameplayInput {
    const s = this.settings;
    let kbSteerTarget = (this.key('right') ? 1 : 0) - (this.key('left') ? 1 : 0);
    // ramp keyboard steering for analog-like feel (fast attack, faster release)
    const rate = kbSteerTarget === 0 ? 12 : Math.sign(kbSteerTarget) !== Math.sign(this.steerKb) ? 22 : 9;
    this.steerKb += clamp(kbSteerTarget - this.steerKb, -rate * dt, rate * dt);
    if (kbSteerTarget === 0 && Math.abs(this.steerKb) < 0.02) this.steerKb = 0;
    let steer = this.steerKb;
    let tuck = this.key('tuck') ? 1 : 0;
    let brake = this.key('brake') ? 1 : 0;
    let drift = this.key('drift');
    let pop = this.key('pop');
    let recoverPressed = this.keyPressed('recover');
    let lookBack = this.key('lookback');
    let pausePressed = this.keyPressed('pause');
    let skipPressed = this.keyPressed('skip');
    let camX = this.mouseDX * 0.0025 * s.cameraSensitivity;
    let camY = this.mouseDY * 0.0025 * s.cameraSensitivity;
    this.mouseDX = 0;
    this.mouseDY = 0;

    const p = this.pad;
    if (p) {
      // non-standard mappings: axes beyond the left stick are unknown (triggers may rest at −1), so ignore them
      const std = p.mapping === 'standard';
      const [lx] = applyDeadzone(p.axes[0] ?? 0, p.axes[1] ?? 0, s.deadzone);
      const [rx, ry] = std ? applyDeadzone(p.axes[2] ?? 0, p.axes[3] ?? 0, s.deadzone) : [0, 0];
      if (Math.abs(lx) > Math.abs(steer)) steer = lx;
      // d-pad steering as fallback
      if (this.padNow[PAD.LEFT]) steer = -1;
      if (this.padNow[PAD.RIGHT]) steer = 1;
      tuck = Math.max(tuck, triggerValue(p.buttons[PAD.RT]));
      brake = Math.max(brake, triggerValue(p.buttons[PAD.LT]));
      drift = drift || !!this.padNow[PAD.RB];
      pop = pop || !!this.padNow[PAD.A];
      recoverPressed = recoverPressed || this.padPressed(PAD.Y);
      lookBack = lookBack || !!this.padNow[PAD.B];
      pausePressed = pausePressed || this.padPressed(PAD.START);
      skipPressed = skipPressed || this.padPressed(PAD.START);
      camX += rx * dt * 2.2 * s.cameraSensitivity;
      camY += ry * dt * 1.6 * s.cameraSensitivity;
    }
    if (s.invertCameraX) camX = -camX;
    if (s.invertCameraY) camY = -camY;
    steer = clamp(steer * s.steerSensitivity, -1, 1);
    this.pressedQ.clear();
    return { steer, tuck, brake, drift, pop, recoverPressed, lookBack, pausePressed, skipPressed, camX, camY };
  }

  /** Read menu navigation (edge-triggered, with stick auto-repeat). */
  menu(dt: number): MenuInput {
    const k = this.pressedQ;
    const m: MenuInput = {
      up: k.has('ArrowUp') || k.has('KeyW'),
      down: k.has('ArrowDown') || k.has('KeyS'),
      left: k.has('ArrowLeft') || k.has('KeyA'),
      right: k.has('ArrowRight') || k.has('KeyD'),
      confirm: k.has('Enter') || k.has('Space'),
      back: k.has('Escape') || k.has('Backspace'),
    };
    const p = this.pad;
    if (p) {
      m.up ||= this.padPressed(PAD.UP);
      m.down ||= this.padPressed(PAD.DOWN);
      m.left ||= this.padPressed(PAD.LEFT);
      m.right ||= this.padPressed(PAD.RIGHT);
      m.confirm ||= this.padPressed(PAD.A);
      m.back ||= this.padPressed(PAD.B) || this.padPressed(PAD.START);
      const ay = p.axes[1] ?? 0;
      const ax = p.axes[0] ?? 0;
      const dir = Math.abs(ay) > 0.6 ? Math.sign(ay) * 2 : Math.abs(ax) > 0.6 ? Math.sign(ax) : 0;
      if (dir !== this.lastMenuAxis) {
        this.menuRepeat = 0.35;
        if (dir === -2) m.up = true;
        if (dir === 2) m.down = true;
        if (dir === -1) m.left = true;
        if (dir === 1) m.right = true;
      } else if (dir !== 0) {
        this.menuRepeat -= dt;
        if (this.menuRepeat <= 0) {
          this.menuRepeat = 0.12;
          if (dir === -2) m.up = true;
          if (dir === 2) m.down = true;
          if (dir === -1) m.left = true;
          if (dir === 1) m.right = true;
        }
      }
      this.lastMenuAxis = dir;
    }
    this.pressedQ.clear();
    return m;
  }

  /** Raw pad snapshot for the controller test screen. */
  padSnapshot(): { axes: number[]; buttons: number[]; id: string } | null {
    if (!this.pad) return null;
    return { axes: [...this.pad.axes], buttons: this.pad.buttons.map((b) => b.value || (b.pressed ? 1 : 0)), id: this.pad.id };
  }

  rumble(strong: number, weak: number, ms: number) {
    const p = this.pad as (PadLike & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null;
    try {
      void p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) })?.catch(() => {});
    } catch {
      /* not supported */
    }
  }

  clearHeld() {
    this.down.clear();
    this.steerKb = 0;
  }
}

/** Glyph text for prompts by device. */
export function glyph(device: Device, action: Action, bindings: Record<Action, string[]>): string {
  if (device === 'keyboard') return keyName(bindings[action][0] ?? '?');
  const ps = device === 'playstation';
  switch (action) {
    case 'left':
    case 'right':
      return 'L-Stick';
    case 'tuck':
      return ps ? 'R2' : 'RT';
    case 'brake':
      return ps ? 'L2' : 'LT';
    case 'drift':
      return ps ? 'R1' : 'RB';
    case 'pop':
      return ps ? '✕' : 'A';
    case 'recover':
      return ps ? '△' : 'Y';
    case 'lookback':
      return ps ? '○' : 'B';
    case 'pause':
      return ps ? 'Options' : 'Start';
    case 'skip':
      return ps ? 'Options' : 'Start';
  }
}

export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ShiftLeft: 'Shift',
    ShiftRight: 'R-Shift',
    Space: 'Space',
    Escape: 'Esc',
    Enter: 'Enter',
    ControlLeft: 'Ctrl',
    AltLeft: 'Alt',
  };
  return map[code] ?? code;
}
