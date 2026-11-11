// Capture the Fjord art test scene: every shot in both modes, identical cameras.
//   npx vite --config tools/artscene/vite.config.mts --port 4480 &
//   node tools/artscene/capture.mjs [outDir=docs/reviews/biomes/fjord/round-4/artscene] [WxH=1920x1080] [shots=long,cliff,cave,cave_near,islands,island] [modes=current,proposed] [base=http://127.0.0.1:4480]
// Software rendering (SwiftShader): each frame takes minutes on 2 CPUs.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [outDir = 'docs/reviews/biomes/fjord/round-4/artscene', size = '1920x1080', shotsArg = 'long,cliff,cave,cave_near,islands,island', modesArg = 'current,proposed', base = 'http://127.0.0.1:4480'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const sha = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain --untracked-files=no').toString().trim() ? '+dirty' : '');
  } catch {
    return 'unknown';
  }
})();
const manPath = `${outDir}/manifest.json`;
const manifest = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : { shots: [] };
manifest.sha = sha;
manifest.viewport = size;
manifest.date = new Date().toISOString();
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const shot of shotsArg.split(',')) {
  for (const mode of modesArg.split(',')) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 400)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 400)));
    await page.goto(`${base}/artscene.html?mode=${mode}&shot=${shot}`);
    await page.waitForFunction(() => window.__ready === true || !!window.__error, null, { timeout: 1_800_000, polling: 2000 });
    const err = await page.evaluate(() => window.__error ?? null);
    if (err) errors.push(err);
    const stats = await page.evaluate(() => window.__stats ?? null);
    const name = `${shot}_${mode}`;
    await page.screenshot({ path: `${outDir}/${name}.png`, timeout: 1_800_000 });
    manifest.shots = manifest.shots.filter((s) => s.name !== name);
    manifest.shots.push({ name, mode, shot, stats, errors });
    writeFileSync(manPath, JSON.stringify(manifest, null, 2));
    log('shot', name, JSON.stringify(stats), errors.length ? `ERRORS: ${errors.join(' | ')}` : '');
    await page.close();
  }
}
await browser.close();
