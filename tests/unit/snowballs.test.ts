import { describe, expect, it } from 'vitest';
import { SnowballBarrage, SNOWBALL, ballPosition, type SnowballEvent } from '../../src/yeti/Snowballs';
import { simulateGenerated } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';

const flat = () => 0;
const run = (b: SnowballBarrage, gap: number, secs: number, canThrow = true) => {
  const ev: SnowballEvent[] = [];
  const skier = { pos: { x: 0, y: 0, z: 1000 }, vel: { x: 0, y: 0, z: 20 } };
  const yeti = { x: 0, y: 0, z: 1000 - gap };
  for (let t = 0; t < secs; t += 1 / 60) {
    b.update(1 / 60, yeti, skier, canThrow, ev);
    skier.pos.z += skier.vel.z / 60;
    yeti.z += skier.vel.z / 60;
  }
  return ev;
};

describe('Hard mode snowballs', () => {
  it('throws only in range, after a grace period, and never when not allowed', () => {
    expect(run(new SnowballBarrage(1, flat), 60, SNOWBALL.firstDelay - 0.1).filter((e) => e.type === 'throw')).toHaveLength(0);
    expect(run(new SnowballBarrage(1, flat), 60, 30).filter((e) => e.type === 'throw').length).toBeGreaterThanOrEqual(3);
    expect(run(new SnowballBarrage(1, flat), 10, 30).filter((e) => e.type === 'throw')).toHaveLength(0); // too close
    expect(run(new SnowballBarrage(1, flat), 400, 30).filter((e) => e.type === 'throw')).toHaveLength(0); // too far
    expect(run(new SnowballBarrage(1, flat), 60, 30, false).filter((e) => e.type === 'throw')).toHaveLength(0);
  });

  it('aims at or ahead of the skier, with the landing zone known at the throw', () => {
    const ev = run(new SnowballBarrage(7, flat), 70, 120);
    const throws = ev.filter((e) => e.type === 'throw');
    expect(throws.length).toBeGreaterThan(10);
    for (const e of ev) {
      if (e.type !== 'hit') continue;
      // a skier holding a straight line at constant speed is in (or right by) the marked zone
      expect(e.distance).toBeLessThan(12);
    }
    // the ball starts at the Yeti, up high, and ends exactly on the marked point
    const b = throws[0]!.ball;
    const p = { x: 0, y: 0, z: 0 };
    expect(b.from.y).toBeGreaterThan(2.5);
    b.t = b.flight;
    ballPosition(b, p);
    expect(Math.hypot(p.x - b.to.x, p.y - b.to.y, p.z - b.to.z)).toBeLessThan(1e-9);
  });

  it('classifies hits by distance from the marked point', () => {
    const b = new SnowballBarrage(3, flat);
    const ev = run(b, 60, 60);
    for (const e of ev) if (e.type === 'hit') expect(e.hit).toBe(e.distance < SNOWBALL.hitRadius ? 'direct' : e.distance < SNOWBALL.nearRadius ? 'near' : 'miss');
    expect(b.hits + b.nearMisses).toBeGreaterThan(0);
  });

  it('winds up before every throw', () => {
    const ev = run(new SnowballBarrage(5, flat), 60, 30);
    const kinds = ev.filter((e) => e.type === 'windup' || e.type === 'throw').map((e) => e.type);
    expect(kinds.length).toBeGreaterThan(4);
    for (let i = 0; i + 1 < kinds.length; i += 2) expect([kinds[i], kinds[i + 1]]).toEqual(['windup', 'throw']);
  });

  it('cutting through the zone as the ball comes down is a hit, even if clear at the instant of impact', () => {
    const b = new SnowballBarrage(9, flat);
    const skier = { pos: { x: 0, y: 0, z: 1000 }, vel: { x: 0, y: 0, z: 20 } };
    const yeti = { x: 0, y: 0, z: 940 };
    const ev: SnowballEvent[] = [];
    // wait for a ball
    let guard = 0;
    while (!b.balls.length && guard++ < 1000) b.update(1 / 60, yeti, skier, true, ev);
    const ball = b.balls[0]!;
    // the skier is elsewhere, then crosses the centre of the zone 0.3 s before impact and keeps going
    ev.length = 0;
    const crossAt = ball.flight - 0.3;
    while (b.balls.length) {
      const dt = 1 / 60;
      const tc = ball.t - crossAt;
      skier.pos.x = ball.to.x + tc * 20; // sideways through the zone at 20 m/s
      skier.pos.z = ball.to.z;
      b.update(dt, yeti, skier, false, ev);
    }
    // at impact it is ~6 m clear of the centre, outside even the near radius…
    expect(Math.abs(0.3 * 20)).toBeGreaterThan(SNOWBALL.nearRadius);
    // …but it went through the zone while the ball was coming down
    const hit = ev.find((e) => e.type === 'hit');
    expect(hit && hit.type === 'hit' && hit.hit).toBe('direct');
  });

  it('crossing the zone while the ball is still high is not a hit', () => {
    const b = new SnowballBarrage(9, flat);
    const skier = { pos: { x: 0, y: 0, z: 1000 }, vel: { x: 0, y: 0, z: 20 } };
    const yeti = { x: 0, y: 0, z: 940 };
    const ev: SnowballEvent[] = [];
    let guard = 0;
    while (!b.balls.length && guard++ < 1000) b.update(1 / 60, yeti, skier, true, ev);
    const ball = b.balls[0]!;
    ev.length = 0;
    const crossAt = 0.5; // early in the flight
    while (b.balls.length) {
      skier.pos.x = ball.to.x + (ball.t - crossAt) * 20;
      skier.pos.z = ball.to.z;
      b.update(1 / 60, yeti, skier, false, ev);
    }
    const hit = ev.find((e) => e.type === 'hit');
    expect(hit && hit.type === 'hit' && hit.hit).toBe('miss');
  });

  it('is deterministic for a seed', () => {
    const a = run(new SnowballBarrage(42, flat), 60, 40).map((e) => (e.type === 'throw' ? `${e.ball.to.x.toFixed(3)},${e.ball.to.z.toFixed(3)}` : e.type === 'hit' ? e.hit : e.type));
    const b = run(new SnowballBarrage(42, flat), 60, 40).map((e) => (e.type === 'throw' ? `${e.ball.to.x.toFixed(3)},${e.ball.to.z.toFixed(3)}` : e.type === 'hit' ? e.hit : e.type));
    expect(a).toEqual(b);
  });

  it('Hard Sprint: a skilled skier who reads the marks escapes; one who ignores them is snowballed and pays for it', () => {
    const drive = (m: Parameters<typeof autopilotInput>[0]) => (s: Parameters<typeof autopilotInput>[1], t: number) => autopilotInput(m, s, 'skilled', t);
    for (const seed of [7, 2026]) {
      const reader = simulateGenerated(seed, 3000, drive, { maxTime: 600, yetiSpeed: 1.07, snowballs: true, dodge: true });
      expect(reader.outcome, `seed ${seed}`).toBe('victory');
      expect(reader.snowballs!.throws).toBeGreaterThan(10);
      expect(reader.snowballs!.hits).toBe(0);
      const ignorer = simulateGenerated(seed, 3000, drive, { maxTime: 600, yetiSpeed: 1.07, snowballs: true });
      expect(ignorer.snowballs!.hits).toBeGreaterThan(0);
      // getting hit is costly: caught, or a much closer chase than the reader's
      expect(ignorer.outcome === 'caught' || ignorer.minGap < reader.minGap - 5, `seed ${seed}: ${ignorer.outcome} ${ignorer.minGap} vs ${reader.minGap}`).toBe(true);
    }
  }, 120000);
});
