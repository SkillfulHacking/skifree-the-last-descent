import { it } from 'vitest';
import { Mountain } from '../../src/world/course';
it('first-touch heightAt beyond the generated frontier vs settled value (Endless)', () => {
  let worst = 0; let at = '';
  for (const seed of [1, 99, 4242, 31337, 777]) {
    for (const zq of [12100, 12400, 13050, 14500, 20000]) {
      const a = Mountain.generated(seed, Infinity);
      const x = 0;
      const first = a.heightAt(x, zq);           // first touch: reads provisional keys, then ensures
      const settled = a.heightAt(x, zq);        // same profile, after ensure
      const d = Math.abs(first - settled);
      if (d > worst) { worst = d; at = `seed ${seed} z ${zq}`; }
    }
  }
  console.log(`worst first-touch height error ${worst.toFixed(3)} m at ${at}`);
});
