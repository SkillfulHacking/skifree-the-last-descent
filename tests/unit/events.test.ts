import { describe, expect, it, vi } from 'vitest';
import { EventBus, PIZZA_CHUNK, type GameEvent } from '../../src/game/events';
import { RunTelemetry, PIZZA_MIN_BRAKE, type TelemetryState } from '../../src/game/telemetry';

describe('event bus', () => {
  it('delivers typed events synchronously, in subscription order, typed + any', () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.on('JumpLanded', (e) => seen.push(`jump:${e.airtime}`));
    bus.onAny((e) => seen.push(`any:${e.type}`));
    bus.on('Crashed', (e) => seen.push(`crash:${e.reason}`));
    bus.emit({ type: 'JumpLanded', airtime: 1.2, distance: 20, clean: true, landed: true });
    expect(seen).toEqual(['jump:1.2', 'any:JumpLanded']);
    bus.emit({ type: 'Crashed', reason: 'tree' });
    expect(seen.slice(2)).toEqual(['crash:tree', 'any:Crashed']);
  });

  it('unsubscribes', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on('SnowballThrown', fn);
    bus.emit({ type: 'SnowballThrown' });
    off();
    bus.emit({ type: 'SnowballThrown' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a throwing listener never breaks the others', () => {
    const bus = new EventBus();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    bus.onAny(() => {
      throw new Error('boom');
    });
    bus.onAny(after);
    expect(() => bus.emit({ type: 'SnowballThrown' })).not.toThrow();
    expect(after).toHaveBeenCalledOnce();
    err.mockRestore();
  });

  it('events emitted from a listener are delivered after the current one (same order for everyone)', () => {
    const bus = new EventBus();
    const a: string[] = [];
    const b: string[] = [];
    bus.onAny((e) => {
      a.push(e.type);
      if (e.type === 'RefugeReached') bus.emit({ type: 'SnowballThrown' });
    });
    bus.onAny((e) => b.push(e.type));
    bus.emit({ type: 'RefugeReached', index: 1 });
    expect(a).toEqual(['RefugeReached', 'SnowballThrown']);
    expect(b).toEqual(a);
  });
});

function state(p: Partial<TelemetryState> = {}): TelemetryState {
  return { pos: { x: 0, z: 0 }, speed: 10, grounded: true, crashed: false, drifting: false, brake: 0, surface: 'snow', ...p };
}

describe('run telemetry', () => {
  const dt = 1 / 120;
  const collect = () => {
    const bus = new EventBus();
    const ev: GameEvent[] = [];
    bus.onAny((e) => ev.push(e));
    return { bus, ev, tel: new RunTelemetry(bus) };
  };

  it('reports whole-kilometre milestones once each (also when several are crossed at once)', () => {
    const { ev, tel } = collect();
    const s = state();
    for (const z of [0, 500, 999, 1000, 1500, 3200]) tel.step({ ...s, pos: { x: 0, z } }, dt);
    expect(ev.filter((e) => e.type === 'DistanceReached').map((e) => (e as { meters: number }).meters)).toEqual([1000, 2000, 3000]);
  });

  it('counts only controlled pizza braking, in chunks, and flushes the remainder', () => {
    const { ev, tel } = collect();
    let z = 0;
    const run = (n: number, p: Partial<TelemetryState>) => {
      for (let i = 0; i < n; i++) {
        z += 10 * dt;
        tel.step(state({ pos: { x: 0, z }, speed: 10, ...p }), dt);
      }
    };
    run(120 * 6, { brake: 1 }); // 60 m of pizza
    run(120 * 3, { brake: 1, crashed: true }); // sliding on the back: not braking
    run(120 * 3, { brake: 1, grounded: false }); // airborne
    run(120 * 3, { brake: 1, drifting: true }); // drift-braking is a drift, not pizza
    run(120 * 3, { brake: PIZZA_MIN_BRAKE - 0.1 }); // light feathering
    run(120 * 3, { brake: 1, speed: 1 }); // standing in a wedge
    tel.flush();
    const pizza = ev.filter((e) => e.type === 'PizzaBraking').map((e) => (e as { distance: number }).distance);
    expect(pizza.slice(0, 2)).toEqual([PIZZA_CHUNK, PIZZA_CHUNK]);
    expect(pizza.reduce((a, b) => a + b, 0)).toBeCloseTo(60, 0);
  });

  it('reports a jump with airtime and horizontal distance; a crash landing is landed=false; hops are ignored', () => {
    const { ev, tel } = collect();
    tel.onSkierEvent({ type: 'takeoff', speed: 20 }, state({ pos: { x: 0, z: 100 } }));
    tel.onSkierEvent({ type: 'land', impact: 0.2, hard: false, airTime: 1.7, clean: true }, state({ pos: { x: 3, z: 134 } }));
    tel.onSkierEvent({ type: 'takeoff', speed: 20 }, state({ pos: { x: 0, z: 200 } }));
    tel.onSkierEvent({ type: 'land', impact: 0.9, hard: true, airTime: 2, clean: false }, state({ pos: { x: 0, z: 240 }, crashed: true }));
    tel.onSkierEvent({ type: 'takeoff', speed: 20 }, state({ pos: { x: 0, z: 300 } }));
    tel.onSkierEvent({ type: 'land', impact: 0, hard: false, airTime: 0.1, clean: true }, state({ pos: { x: 0, z: 301 } }));
    const jumps = ev.filter((e) => e.type === 'JumpLanded');
    expect(jumps).toHaveLength(2);
    expect(jumps[0]).toMatchObject({ airtime: 1.7, clean: true, landed: true });
    expect((jumps[0] as { distance: number }).distance).toBeCloseTo(Math.hypot(3, 34));
    expect(jumps[1]).toMatchObject({ landed: false });
  });

  it('reports drifts with duration, dominant surface and per-surface time; crashes end them uncontrolled', () => {
    const { ev, tel } = collect();
    let z = 0;
    const go = (n: number, p: Partial<TelemetryState>) => {
      for (let i = 0; i < n; i++) tel.step(state({ pos: { x: 0, z: (z += 0.1) }, ...p }), dt);
    };
    go(120, { drifting: true, surface: 'ice' });
    go(60, { drifting: true, surface: 'snow' });
    go(10, {});
    go(120, { drifting: true });
    tel.onSkierEvent({ type: 'crash', reason: 'tree', intensity: 1 }, state());
    go(10, { drifting: true });
    go(1, {}); // 10 steps < DRIFT_MIN_TIME: not reported
    const d = ev.filter((e) => e.type === 'DriftCompleted') as Extract<GameEvent, { type: 'DriftCompleted' }>[];
    expect(d).toHaveLength(2);
    expect(d[0]!.duration).toBeCloseTo(1.5, 2);
    expect(d[0]!.surface).toBe('ice');
    expect(d[0]!.surfaces.ice).toBeCloseTo(1, 2);
    expect(d[0]!.controlled).toBe(true);
    expect(d[1]!.controlled).toBe(false);
    expect(ev.some((e) => e.type === 'Crashed')).toBe(true);
  });

  it('forwards obstacle contacts', () => {
    const { ev, tel } = collect();
    tel.onSkierEvent({ type: 'impact', kind: 'rock-light', intensity: 0.4, x: 0, z: 0 }, state());
    expect(ev).toEqual([{ type: 'ObstacleHit', kind: 'rock-light', intensity: 0.4 }]);
  });
});
