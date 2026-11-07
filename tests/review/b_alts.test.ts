import { it } from 'vitest';
import { Mountain } from '../../src/world/course';
it('alternate line stats', () => {
  let n = 0, km = 0, save = 0, sep = 0, cliff = 0, cave = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const m = Mountain.generated(seed, 20000); km += 20;
    for (const a of m.profile.altRoutes(0, 20000)) {
      n++;
      let la = 0, lr = 0, maxSep = 0;
      for (let z = a.z0 + 5; z <= a.z1; z += 5) {
        la += Math.hypot(m.profile.altRouteX(z)! - m.profile.altRouteX(z - 5)!, 5);
        lr += Math.hypot(m.routeX(z) - m.routeX(z - 5), 5);
        maxSep = Math.max(maxSep, Math.abs(m.profile.altRouteX(z)! - m.routeX(z)));
      }
      save += lr - la; sep += maxSep;
      if (m.profile.cliffsNear(a.z0, a.z1, []).length) cliff++;
      if (m.profile.encounters(a.z0, a.z1).some((e) => Math.abs(e.caveZ - (a.z0 + a.z1) / 2) < (a.z1 - a.z0) / 2 + 60)) cave++;
    }
  }
  console.log(`alts: ${n} over ${km} km (${(n / km * 10).toFixed(1)} per 10 km); mean saving ${(save / n).toFixed(1)} m; mean max separation from route ${(sep / n).toFixed(1)} m; overlapping cliffs ${cliff}; near caves ${cave}`);
});
