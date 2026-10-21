/**
 * Terrain heights at TOWN-LOCAL rectangles — for choosing a new pad's level
 * (WORKER_TOWN_PADS) from the ground it replaces, not by guess — or at
 * WORLD rectangles (v1.2 I5: `--wrect x0,z0,x1,z1`).
 *
 *   npx tsx tools/ground.ts --rect "4,25,30,48" --rect "62,-38,80,-24"
 *   npx tsx tools/ground.ts --wrect "-122,143,-52,167"
 *
 * Prints min / max / mean of a 5×5 sample grid per rectangle.
 */

import { townToWorld } from '../src/world/TownFrame';
import { akhetUrl, launchWebGPU } from './launch';

async function main(): Promise<void> {
  const rects: { r: number[]; world: boolean }[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--rect' || a === '--wrect') rects.push({ r: (process.argv[i + 1] ?? '').split(',').map(Number), world: a === '--wrect' });
  }
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.goto(akhetUrl({ scene: 'world', freeze: true, extra: { clean: '1' } }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );
  for (const { r, world } of rects) {
    const [u0, v0, u1, v1] = r as [number, number, number, number];
    const pts: [number, number][] = [];
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const u = u0 + ((u1 - u0) * i) / 4;
        const v = v0 + ((v1 - v0) * j) / 4;
        pts.push(world ? [u, v] : townToWorld(u, v));
      }
    }
    const hs = await page.evaluate((ps) => ps.map(([x, z]) => window.__akhet.groundAt?.(x, z) ?? Number.NaN), pts);
    const mean = hs.reduce((a, b) => a + b, 0) / hs.length;
    console.log(`[ground] ${world ? 'wrect' : 'rect'} ${r.join(',')}: min ${Math.min(...hs).toFixed(2)} max ${Math.max(...hs).toFixed(2)} mean ${mean.toFixed(2)}`);
  }
  await browser.close();
}

main().catch((e: unknown) => {
  console.error('[ground] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
