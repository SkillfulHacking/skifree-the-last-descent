// node tools/capture.mjs <baseUrl> <outDir> <script.json>
// Script: list of steps {do:'start'|'teleport'|'advance'|'wait'|'shot'|'eval'|'autopilot', ...}
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
const [base, outDir, scriptPath] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const steps = JSON.parse(readFileSync(scriptPath, 'utf8'));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
p.on('pageerror', (e) => { errors.push(String(e)); console.log('[pageerror]', String(e).slice(0, 300)); });
p.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('[console.error]', m.text().slice(0, 300)); } });
await p.goto(base + '/?debug');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 180000, polling: 1000 });
for (const s of steps) {
  const t0 = Date.now();
  if (s.do === 'start') await p.evaluate((skip) => window.__skifree.startRun(skip), s.skipIntro ?? true);
  else if (s.do === 'teleport') await p.evaluate(([z, v]) => window.__skifree.teleport(z, v), [s.z, s.speed ?? 18]);
  else if (s.do === 'advance') await p.evaluate((sec) => window.__skifree.advance(sec), s.sec);
  else if (s.do === 'autopilot') await p.evaluate((st) => window.__skifree.autopilot(st), s.style);
  else if (s.do === 'wait') await p.waitForTimeout(s.ms);
  else if (s.do === 'waitFor') await p.waitForFunction(s.fn, null, { timeout: s.timeout ?? 120000, polling: 500 });
  else if (s.do === 'eval') console.log('eval', s.label ?? '', String(JSON.stringify(await p.evaluate(s.fn))).slice(0, 600));
  else if (s.do === 'shot') { await p.screenshot({ path: `${outDir}/${s.name}.png`, timeout: 300000 }); }
  console.log(`step ${s.do} ${s.name ?? s.label ?? ''} ${Date.now() - t0}ms`, JSON.stringify(await p.evaluate(() => window.__skifree.state().session)).slice(0, 260));
}
console.log('ERRORS', errors.length);
await b.close();
