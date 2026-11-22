/**
 * W-035 drift-row measurement (round 2): for every drift row whose mounds cover the racing line on
 * W034-01..N (Normal Sprint), the same approach (110 m before the row, on the line, 17 m/s, tucked)
 * skied six ways: plough straight through; a smooth line through the marked gap bent over 40 / 70 /
 * 100 m; a full jump timed to top out over the crest; repeated short hops (the round-1 exploit); a
 * mistimed jump that comes down in the row (round 3).
 * Time to 40 m past the row, exit and minimum speed, path length, time in deep snow, knocks.
 *   N=24 OUT=… npx vitest run --config vitest.sim.config.ts tests/sim/driftRow.measure.test.ts
 */
import { it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { SkierPhysics, PHYS_DT } from '../../src/physics/SkierPhysics';
import { clamp, wrapAngle } from '../../src/core/rng';
import { DRIFT } from '../../src/world/biomes/whiteout/hazards';
const proc = (globalThis as any).process;
it('drift micro', async () => {
  const fs = await import('node:fs' as string);
  if (proc.env.DRAG) (DRIFT as any).drag = Number(proc.env.DRAG);
  if (proc.env.FRIC) (DRIFT as any).friction = Number(proc.env.FRIC);
  if (proc.env.CLIPK) (DRIFT as any).clipKeep = Number(proc.env.CLIPK);
  const out: any[] = [];
  const crashLog: string[] = [];
  const N = Number(proc.env.N ?? 12);
  for (let i = 1; i <= N; i++) {
    const c = makeCourse('custom', 'sprint', { biome: 'whiteout', customText: `W034-${String(i).padStart(2, '0')}`, difficulty: 'normal' });
    const m = buildMountain(c); const ws = worldSeed(c);
    const env0 = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
    env0.hazards.ensure(0, 2400);
    const drifts = env0.hazards.peek(0, 2400).filter((h) => h.kind === 'wind-drift');
    const rows = new Map<number, typeof drifts>();
    for (const h of drifts) { const k = (h.params as any).row; (rows.get(k) ?? rows.set(k, []).get(k)!).push(h); }
    for (const [row, hs] of rows) {
      const zr = hs.reduce((a, h) => a + h.z, 0) / hs.length;
      if (zr < 200) continue;
      const rx = m.routeX(zr);
      const P0: any = hs[0]!.params;
      const cover = (x: number) => Math.abs(x - P0.gapX) > P0.gapHalf;
      if (!cover(rx)) continue; // gap on the line: no decision
      // the gap centre: the widest clear x across the piste
      const cx = m.centerX(zr), hw = m.halfWidth(zr);
      void cx; void hw;
      const gap = P0.gapX as number, a = gap - P0.gapHalf, b = gap + P0.gapHalf;
      const res: any = { seed: i, row, zr: Math.round(zr), offset: +(gap - rx).toFixed(1), gapWidth: +(b - a).toFixed(1) };
      for (const [name, lead] of [['plough', 0], ['gap40', 40], ['gap70', 70], ['gap100', 100], ['hopTimed', -1], ['hopSpam', -2], ['hopClip', -3]] as const) {
        const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
        const field = new ObstacleField(m, ws);
        field.ensure(zr - 300, zr + 300);
        const ph = new SkierPhysics(m, field, undefined, env);
        const z0 = zr - 110;
        ph.reset(m.routeX(z0), z0, 0, 17);
        let t = 0, path = 0, lastX = ph.s.pos.x, lastZ = ph.s.pos.z, minV = 99, inDrift = 0, knocks = 0;
        env.listen((e: any) => { if (e.type === 'hazard-hit') knocks++; });
        while (ph.s.pos.z < zr + 40 && t < 30) {
          const s = ph.s;
          const zA = s.pos.z;
          // target line: the racing line, bent smoothly to the gap over `lead` m before the row and back over 30 m after
          const tx = (z: number) => {
            if (lead <= 0) return m.routeX(z);
            const kIn = clamp((z - (zr - lead)) / (lead - 6), 0, 1), kOut = clamp((z - (zr + 6)) / 30, 0, 1);
            const k = (kIn * kIn * (3 - 2 * kIn)) * (1 - kOut * kOut * (3 - 2 * kOut));
            return m.routeX(z) + (gap - rx) * k;
          };
          const look = 7 + s.speed * 0.55;
          const desired = Math.atan2(tx(zA + look) - s.pos.x, look);
          const err = wrapAngle(desired - s.heading);
          // hops: 'hopTimed' charges fully and releases so the apex (~0.45 s) is over the row's crest;
          // 'hopSpam' taps a short hop whenever a mound is within 10 m ahead (the round-1 exploit)
          let pop = false;
          const dz = zr - s.pos.z;
          if (lead === -1) pop = dz < s.speed * 0.45 + s.speed * 0.45 && dz > s.speed * 0.45 && s.grounded;
          if (lead === -2) pop = s.grounded && dz > -12 && dz < 10 && Math.floor(t * 4) % 2 === 0;
          // (round 3, R2 B N4) a mistimed jump: released late, so the skis come down into the row
          if (lead === -3) pop = s.grounded && dz < s.speed * 0.3 && dz > s.speed * 0.1;
          ph.step({ steer: clamp(-err * 3.2, -1, 1), tuck: Math.abs(err) < 0.3 ? 1 : 0, brake: 0, drift: false, pop, recover: s.crashTime > 1.4 }, PHYS_DT);
          for (const ev of ph.drainEvents()) if ((ev as any).type === 'crash') crashLog.push(`${name} seed ${i} row ${row} z=${s.pos.z.toFixed(0)} x=${s.pos.x.toFixed(1)} line=${m.routeX(s.pos.z).toFixed(1)} gap=${gap.toFixed(1)} ${(ev as any).reason}`);
          t += PHYS_DT; path += Math.hypot(s.pos.x - lastX, s.pos.z - lastZ); lastX = s.pos.x; lastZ = s.pos.z;
          if (Math.abs(s.pos.z - zr) < 12) { minV = Math.min(minV, s.speed); if (cover(s.pos.x)) inDrift += PHYS_DT; }
        }
        res[name] = { t: +t.toFixed(2), vExit: +ph.s.speed.toFixed(2), minV: +minV.toFixed(2), path: +path.toFixed(1), inDrift: +inDrift.toFixed(2), crashes: ph.s.crashes, knocks };
      }
      out.push(res);
    }
  }
  fs.writeFileSync(proc.env.OUT ?? '.measure/drift_micro.json', JSON.stringify(out));
  fs.writeFileSync((proc.env.OUT ?? '.measure/drift_micro.json') + '.crashes.txt', crashLog.join('\n'));
  const med = (k: string, f: string) => { const v = out.map((r) => r[k][f]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  console.log('rows', out.length);
  console.log(crashLog.join('\n'));
  for (const k of ['plough', 'gap40', 'gap70', 'gap100', 'hopTimed', 'hopSpam']) console.log(k, 't', med(k, 't'), 'vExit', med(k, 'vExit'), 'minV', med(k, 'minV'), 'path', med(k, 'path'), 'inDrift', med(k, 'inDrift'));
});
