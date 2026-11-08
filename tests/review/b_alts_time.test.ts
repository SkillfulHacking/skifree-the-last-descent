import { it } from 'vitest';
import { Mountain } from '../../src/world/course';
import { ObstacleField } from '../../src/physics/obstacles';
import { PHYS_DT, SkierPhysics, type SkierInput } from '../../src/physics/SkierPhysics';
// Round 2 (B3): does skiing an alternate line actually save time vs the guaranteed route?
// Skilled-style driver (same steering law as debug/autopilot) aimed at either the route or the alt line.
function run(m: Mountain, f: ObstacleField, zA: number, zB: number, target: (z: number) => number) {
  const phys = new SkierPhysics(m, f);
  const x0 = m.routeX(zA);
  f.ensure(zA - 300, zB + 700);
  phys.teleport(x0, zA, Math.atan2(m.routeX(zA + 10) - x0, 10), 20);
  let t = 0;
  let ice = 0, n = 0;
  while (phys.s.pos.z < zB && t < 300) {
    const s = phys.s;
    const look = 7 + s.speed * 0.55;
    const tx = target(s.pos.z + look);
    const desired = Math.atan2(tx - s.pos.x, look);
    let err = desired - s.heading; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const inp: SkierInput = { steer: Math.max(-1, Math.min(1, -err * 3.2)), tuck: Math.abs(err) < 0.16 ? 1 : 0, brake: 0, drift: false, pop: false, recover: s.crashTime > 1.4 };
    phys.step(inp, PHYS_DT); t += PHYS_DT;
    if (m.surfaceAt(s.pos.x, s.pos.z) === 'ice') ice++; n++;
  }
  return { t, crashes: phys.s.crashes, ice: ice / Math.max(1, n), v: phys.s.speed };
}
it('alternate lines: time saved vs route (skilled driver)', { timeout: 900_000 }, () => {
  const saves: number[] = []; let crashAlt = 0, crashRoute = 0, lines = 0, faster = 0;
  for (const seed of [1, 7, 77, 31337, 4242, 99]) {
    const m = Mountain.generated(seed, 20000);
    const f = new ObstacleField(m, seed);
    for (const a of m.profile.altRoutes(400, 19000)) {
      const zA = a.z0 - 40, zB = a.z1 + 40;
      const r = run(m, f, zA, zB, (z) => m.routeX(z));
      const al = run(m, f, zA, zB, (z) => (z >= a.z0 && z <= a.z1 ? m.profile.altX(a, z) : m.routeX(z)));
      lines++; saves.push(r.t - al.t); if (r.t > al.t) faster++;
      crashAlt += al.crashes; crashRoute += r.crashes;
      if (lines <= 8) console.log(`seed ${seed} alt ${a.type} ${Math.round(a.z0)}..${Math.round(a.z1)} route ${r.t.toFixed(2)}s (crash ${r.crashes}) alt ${al.t.toFixed(2)}s (crash ${al.crashes}, ice ${(al.ice * 100).toFixed(0)}%) exit v ${r.v.toFixed(1)}/${al.v.toFixed(1)}`);
    }
  }
  saves.sort((p, q) => p - q);
  const mean = saves.reduce((p, q) => p + q, 0) / saves.length;
  console.log(`alts time: ${lines} lines, alt faster in ${faster}; mean saving ${mean.toFixed(2)} s, median ${saves[saves.length >> 1]!.toFixed(2)} s, min ${saves[0]!.toFixed(2)}, max ${saves[saves.length - 1]!.toFixed(2)}; crashes route ${crashRoute} alt ${crashAlt}`);
});
