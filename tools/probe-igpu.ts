/**
 * iGPU perf probe: launches headless Chromium WITHOUT the high-performance
 * flag (→ Intel UHD on this Optimus laptop — the same adapter Edge lands
 * on by default) and reports fps at a heavy framing, before/after the
 * auto-reduced preset. Reproduces the user's "2 fps in Edge" environment.
 */

import { chromium } from 'playwright';

async function measure(url: string, label: string): Promise<void> {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 300000, polling: 500 },
  );
  const err = await page.evaluate(() => window.__akhet.error);
  if (err) throw new Error(err);
  const adapter = await page.evaluate(() => window.__akhet.diag?.vendor ?? '?');
  await page.evaluate(async () => window.__akhet.settle && (await window.__akhet.settle(90)));
  const stats = await page.evaluate(() => ({
    fps: window.__akhet.stats?.fps ?? 0,
    ms: window.__akhet.stats?.frameMs ?? 0,
    tris: window.__akhet.stats?.triangles ?? 0,
  }));
  console.log(
    `[${label}] adapter=${adapter} fps=${stats.fps.toFixed(1)} frame=${stats.ms.toFixed(1)}ms tris=${(stats.tris / 1e6).toFixed(1)}M`,
  );
  const passes = await page.evaluate(() => window.__akhet.stats?.gpuPasses ?? {});
  const rows = Object.entries(passes)
    .filter(([k, v]) => (k.startsWith('r.') || k.startsWith('c.')) && v > 0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [k, v] of rows) console.log(`    ${v.toFixed(2).padStart(7)} ms  ${k}`);
  await browser.close();
}

const base = 'http://localhost:5173/?scene=world&T=9&freeze=1&hud=0';
(async () => {
  await measure(`${base}&cam=1700,60,300,1.1,-0.12`, 'fields+water+palms');
  await measure(`${base}&cam=-400,30,600,1.57,-0.1`, 'bare desert west');
  await measure(`${base}&cam=1700,60,300,1.1,0.9`, 'mostly sky');
})().catch((e: unknown) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
