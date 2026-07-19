/**
 * Inspector smoke test: boot the world, nudge a queen pyramid into the
 * mortuary temple via the edit hook, assert the collision audit CATCHES
 * the overlap after the live rebuild, reset, assert clean again, and
 * check the export patch round-trip. Exit 0 = all good.
 */

import { akhetUrl, launchWebGPU } from './launch';

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', (m) => {
    if (m.text().startsWith('[akhet] collision')) console.log(`  ${m.text()}`);
  });
  await page.goto(`${akhetUrl({ scene: 'world', hud: false })}&edit=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );

  const r = await page.evaluate(() => {
    const h = window.__akhet;
    if (!h.collisionAudit || !h.editNudge || !h.editExport) return { err: 'hooks missing' };
    const clean0 = h.collisionAudit().length;
    const t0 = performance.now();
    h.editNudge('pyramid:G1-a', -40, -40); // shove G1-a into the temple
    const rebuildMs = performance.now() - t0;
    const broken = h.collisionAudit().map((i) => `${i.kind}:${i.a}${i.b ? '×' + i.b : ''}`);
    const patch = h.editExport();
    h.editNudge('pyramid:G1-a', 40, 40); // move back
    const clean1 = h.collisionAudit().length;
    return { clean0, rebuildMs, broken, patch, clean1 };
  });
  await browser.close();

  console.log(JSON.stringify(r, null, 2));
  if ('err' in r) throw new Error(r.err as string);
  const ok =
    r.clean0 === 0 &&
    (r.broken as string[]).some((s) => s.includes('pyramid:G1-a')) &&
    (r.patch as string).includes('pyramid:G1-a') &&
    r.clean1 === 0;
  console.log(ok ? 'INSPECTOR TEST PASSED' : 'INSPECTOR TEST FAILED');
  process.exit(ok ? 0 : 1);
}

void main();
