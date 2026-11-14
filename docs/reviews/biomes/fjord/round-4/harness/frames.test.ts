// Round-4 frame replay (Phase E): drives the REAL World.update in Node, frame by frame (0.5 m per frame = 30 m/s at 60 fps, Endless).
// CPU-side only: no GPU, no draws, no uploads, no shader compiles. Timings: per-thread CPU (process.threadCpuUsage) and wall clock.
//   BIOME=fjord|alpine Q=high|low KM=24 OUT=x.json [DEEP=1] npx vitest run --config docs/reviews/biomes/fjord/round-4/harness/vitest.config.ts docs/reviews/biomes/fjord/round-4/harness/frames.test.ts --pool=forks
// Round-4 frame replay: drives the REAL World (src/game/World.ts) frame by frame in Node with a stub
// renderer (no GPU, no draw calls, no shader compiles, no uploads). CPU-side only.
import '../../../../../../tests/support/domStub';
import { it } from 'vitest';
import * as THREE from 'three';
import '../../../../../../src/world/biomes';
import { World } from '../../../../../../src/game/World';
import { makeCourse } from '../../../../../../src/game/CourseConfig';
import { fakeRenderer } from '../../../../../../tests/support/fakeRenderer';

const env = (globalThis as any).process.env as Record<string, string | undefined>;
const BIOME = env.BIOME ?? 'fjord';
const Q = (env.Q ?? 'high') as 'high' | 'low';
const KM = Number(env.KM ?? 24);
const OUT = env.OUT ?? `/tmp/frames_${BIOME}_${Q}.json`;
const cpu = () => { const u = (process as any).threadCpuUsage(); return (u.user + u.system) / 1000; };

it(`frames ${BIOME} ${Q} ${KM} km`, async () => {
  const c = makeCourse('classic', 'endless', { biome: BIOME });
  const w = await World.create(fakeRenderer, Q, c, () => {});
  // prime terrain synchronously (World.create already primed); time per component via wrappers
  const parts: Record<string, number> = {};
  const wrap = (obj: any, name: string, tag: string) => {
    const f = obj?.[name];
    if (typeof f !== 'function') return;
    obj[name] = function (...a: unknown[]) { const t0 = cpu(); try { return f.apply(this, a); } finally { parts[tag] = (parts[tag] ?? 0) + cpu() - t0; } };
  };
  const W: any = w;
  wrap(W, 'stream', 'stream');
  wrap(W, 'stepCaves', 'caves');
  wrap(W, 'stepLodges', 'lodges');
  wrap(W, 'stepStreaming', 'streaming');
  wrap(W.hazardViews, 'pump', 'hazardViews');
  wrap(W.scenery, 'pump', 'scenery');
  wrap(W.terrain, 'update', 'terrain');
  if (env.DEEP) {
    wrap(W.obstacles, 'ensure', 'obstEnsure');
    wrap(W.obstacles, 'release', 'obstRelease');
    wrap(W.environment.hazards, 'ensure', 'hazEnsure');
    wrap(W.environment, 'release', 'hazRelease');
    wrap(W, 'syncCaves', 'syncCaves');
    wrap(W, 'syncLodges', 'syncLodges');
    wrap(W.scenery, 'stream', 'scenStream');
  }
  wrap(W.terrain, 'pumpNear', 'terrainNear');
  wrap(W.terrain, 'pumpFar', 'terrainFar');
  wrap(W.terrain, 'syncLod', 'terrainSync');
  wrap(W.vegetation, 'update', 'vegetation');
  wrap(W.hazardViews, 'update', 'hazardUpd');
  wrap(W.scenery, 'update', 'sceneryUpd');
  wrap(W.env, 'update', 'envUpd');
  const m = w.mountain;
  const focus = new THREE.Vector3();
  const cam = new THREE.Vector3();
  const wall: number[] = [];
  const cpuT: number[] = [];
  const worst: Array<{ z: number; ms: number; parts: Record<string, number> }> = [];
  let time = 0;
  const peak: Record<string, number> = {};
  const frames = Math.round((KM * 1000) / 0.5);
  for (let i = 1; i <= frames; i++) {
    const z = i * 0.5;
    focus.set(m.routeX(z), m.heightAt(m.routeX(z), z), z);
    cam.set(m.routeX(z - 8), focus.y + 4, z - 8);
    for (const k in parts) parts[k] = 0;
    time += 1 / 60;
    const c0 = cpu();
    const t0 = performance.now();
    w.updateOrigin(focus);
    // (round 5, D r4 #1: the shipped per-frame streaming budget — World.STREAM_BUDGET_MS — unless BUDGET is set)
    w.update(1 / 60, time, focus, cam, env.BUDGET ? Number(env.BUDGET) : undefined);
    const dt = performance.now() - t0;
    const dc = cpu() - c0;
    wall.push(dt);
    if ((i & 63) === 0) { const q = { t: W.terrain.pending ?? 0, h: W.hazardViews.pendingCount ?? 0, s: W.scenery?.pending ?? 0, v: W.vegetation.pending ?? 0 }; for (const k in q) peak[k] = Math.max(peak[k] ?? 0, (q as any)[k]); }
    cpuT.push(dc);
    if (dc > 16) worst.push({ z, ms: +dc.toFixed(1), wall: +dt.toFixed(1), parts: Object.fromEntries(Object.entries(parts).filter(([, v]) => v > 0.5).map(([k, v]) => [k, +v.toFixed(1)])) });
  }
  let tris = 0; W.terrain.group.traverse((o: any) => { if (o.isMesh && o.geometry.index) tris += o.geometry.index.count / 3; });
  console.log('terrainTris', Math.round(tris / 1000), 'kt');
  const fs = await import('node:fs' as string);
  fs.writeFileSync(OUT, JSON.stringify({ biome: BIOME, q: Q, km: KM, wall: wall.map((x) => +x.toFixed(2)), cpu: cpuT.map((x) => +x.toFixed(2)), worst, peak, starved: W.streamStats?.starvedTurns ?? null, caves: W.caveCount }));
  // pending work at the end (did anything fall behind?) and peak queues
  const s = [...cpuT].sort((a, b) => a - b);
  const p = (q: number) => s[Math.min(s.length - 1, Math.floor(s.length * q))]!.toFixed(2);
  console.log('peak', JSON.stringify(peak)); console.log(`${BIOME} ${Q} cpu: n=${s.length} p50 ${p(0.5)} p90 ${p(0.9)} p99 ${p(0.99)} max ${s[s.length - 1]!.toFixed(1)} >16 ${s.filter((x) => x > 16).length} >33 ${s.filter((x) => x > 33).length}`);
  w.dispose();
}, 7_200_000);
