/**
 * Single-boot integrated-GPU smoke test — the TDR regression gate.
 *
 * Launches headless Chromium WITHOUT --force_high_performance_gpu (so it lands
 * on the Intel adapter, the same one Edge picks by default) and asserts that
 * the world scene reaches `ready` without losing the device. That is the exact
 * failure the user hit: a boot-time GPU job ran past the Windows watchdog, the
 * display driver reset, and the app went black.
 *
 * Prints boot time and the last progress message, so a hang is diagnosable
 * even when it does not throw.
 */

import { chromium } from 'playwright';

/** `--band N` reproduces the pre-fix behaviour: a band larger than the whole
 *  workload is one dispatch again, which is the controlled counterfactual for
 *  the TDR diagnosis. */
const bandArg = process.argv.indexOf('--band');
const BAND = bandArg > 0 ? process.argv[bandArg + 1] : null;
const presetArg = process.argv.indexOf('--preset');
const PRESET = presetArg > 0 ? process.argv[presetArg + 1] : null;
const FORCE = process.argv.includes('--force');
const URL =
  'http://localhost:5173/?scene=world&T=9&freeze=1&hud=0&cam=1700,60,300,1.1,-0.12' +
  (BAND ? `&band=${BAND}` : '') +
  (PRESET ? `&preset=${PRESET}` : '') +
  (FORCE ? '&force=1' : '') +
  // (v1.2 I7) --q appends a query (A/B arms)
  (process.argv.indexOf('--q') > 0 ? `&${process.argv[process.argv.indexOf('--q') + 1] ?? ''}` : '');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => {
    const t = m.text();
    if (t.startsWith('[akhet]') || t.startsWith('[AKHET')) console.log(`  ${t.slice(0, 160)}`);
  });
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(
      () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
      undefined,
      { timeout: 600000, polling: 500 },
    );
  } catch {
    const p = await page.evaluate(() =>
      window.__akhet ? `${window.__akhet.progressMsg} (${window.__akhet.progress})` : 'no hooks',
    );
    console.log(`[igpu-boot] FAIL  timed out; last progress: ${p}`);
    await browser.close();
    process.exit(1);
  }
  const err = await page.evaluate(() => window.__akhet.error);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (err) {
    console.log(`[igpu-boot] FAIL  after ${secs}s:\n${err}`);
    await browser.close();
    process.exit(1);
  }
  // hold a while: TDR can also fire on the first heavy rendered frames
  await page.evaluate(async () => window.__akhet.settle?.(120));
  const err2 = await page.evaluate(() => window.__akhet.error);
  const st = await page.evaluate(() => ({
    fps: window.__akhet.stats?.fps ?? 0,
    vendor: window.__akhet.diag?.vendor ?? '?',
  }));
  await browser.close();
  if (err2) {
    console.log(`[igpu-boot] FAIL  device died while rendering:\n${err2}`);
    process.exit(1);
  }
  console.log(
    `[igpu-boot] PASS  adapter=${st.vendor} boot=${secs}s fps=${st.fps.toFixed(1)} (no device loss)`,
  );
})().catch((e: unknown) => {
  console.error('[igpu-boot] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
