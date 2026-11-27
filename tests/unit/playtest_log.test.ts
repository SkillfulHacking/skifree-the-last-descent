// Round 6 (owner ruling 3): the opt-in playtest log records events and 1 Hz samples, bounded, no personal data.
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/game/events';
import { PLAYTEST_MAX_ENTRIES, PlaytestLog } from '../../src/game/playtestLog';

describe('PlaytestLog', () => {
  it('records events, run starts and one sample per second', () => {
    const log = new PlaytestLog({ gitHead: 'abc' });
    const bus = new EventBus();
    const detach = log.attach(bus);
    log.runStarted('CLASSIC-SPR@WHITE', { uiScale: 1.5 });
    for (let i = 0; i < 180; i++) log.tick(1 / 60, { phase: 'chase', z: i, speed: 15.234, yetiDistance: 40.55, crashes: 0 });
    bus.emit({ type: 'Crashed', reason: 'tree' });
    detach();
    bus.emit({ type: 'Crashed', reason: 'rock' });
    const j = log.toJSON();
    expect(j.format).toBe('skifree-playtest-log/1');
    expect(j.build).toEqual({ gitHead: 'abc' });
    expect(j.entries.filter((e) => e.kind === 'sample')).toHaveLength(3);
    expect(j.entries.filter((e) => e.kind === 'event')).toHaveLength(1);
    expect(j.entries[0]).toMatchObject({ kind: 'run', course: 'CLASSIC-SPR@WHITE', settings: { uiScale: 1.5 } });
    const s = j.entries.find((e) => e.kind === 'sample');
    expect(s && s.kind === 'sample' && s.sample.speed).toBe(15.2);
  });

  it('takes no samples outside a run and stays bounded', () => {
    const log = new PlaytestLog();
    for (let i = 0; i < 10; i++) log.tick(2, null);
    expect(log.entries).toHaveLength(0);
    for (let i = 0; i < PLAYTEST_MAX_ENTRIES + 5; i++) log.tick(1, { phase: 'free', z: 0, speed: 0, yetiDistance: Infinity, crashes: 0 });
    expect(log.entries).toHaveLength(PLAYTEST_MAX_ENTRIES);
    expect(log.dropped).toBe(5);
  });

  it('is off without ?playtest and visibly tagged when on', async () => {
    const fs = (await import('node:fs' as string)) as { readFileSync(p: string, e: string): string };
    const app = fs.readFileSync('src/game/App.ts', 'utf8');
    expect(app).toMatch(/has\('playtest'\) \? new PlaytestLog\(\) : null/);
    expect(app).toMatch(/Playtest log on/);
    const src = fs.readFileSync('src/game/playtestLog.ts', 'utf8');
    expect(src).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|localStorage/);
  });
});
