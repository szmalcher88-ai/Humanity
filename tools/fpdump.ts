/**
 * Footprint dump: boots the world once and writes every registered
 * footprint whose id starts with one of the --id prefixes to a JSON file —
 * the before/after check for layout changes that must not move anything
 * else (v1.2 I5: the West Field's surviving tombs must match to the cm).
 *
 *   npx tsx tools/fpdump.ts --id mastaba:w: --out shots/fp-before.json
 *   npx tsx tools/fpdump.ts --id mastaba:w:,chapel: --out shots/fp-after.json
 *   npx tsx tools/fpdump.ts --id vessel:,pier: --fleet 0,600 --out shots/fp.json
 *   npx tsx tools/fpdump.ts --q "epoch=KHAFRE_PERIOD" --out shots/fp-khafre.json
 *     (--fleet: also the moving fleet at those world times, v1.2 I6)
 *
 * The dev server must be running.
 */
import { writeFileSync } from 'node:fs';
import { akhetUrl, launchWebGPU } from './launch';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v !== undefined && !v.startsWith('--') ? v : undefined;
}

async function main(): Promise<void> {
  const prefixes = (arg('id') ?? '').split(',');
  const out = arg('out') ?? 'shots/footprints.json';
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  // --q "epoch=KHAFRE_PERIOD": extra URL params (T2-5 — the KHAFRE world's
  // own before/after check, as tour.ts and closeup.ts take them)
  const extra: Record<string, string> = { clean: '1' };
  for (const [k, v] of new URLSearchParams(arg('q') ?? '')) extra[k] = v;
  await page.goto(akhetUrl({ scene: 'world', freeze: true, extra }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );
  const err = await page.evaluate(() => window.__akhet.error);
  if (err) throw new Error(err);
  const all = await page.evaluate(() => window.__akhet.footprints?.() ?? []);
  const hits = all.filter((f) => prefixes.some((p) => f.id.startsWith(p)));
  const fleet: Record<string, unknown> = {};
  for (const t of (arg('fleet') ?? '').split(',').filter((v) => v !== '').map(Number)) {
    fleet[String(t)] = await page.evaluate(async (wt) => {
      window.__akhet.setWorldClock?.(wt);
      await window.__akhet.settle?.(2);
      return window.__akhet.fleet?.() ?? [];
    }, t);
  }
  writeFileSync(out, JSON.stringify(Object.keys(fleet).length ? { footprints: hits, fleet } : hits, null, 1));
  console.log(`[fpdump] ${hits.length} of ${all.length} footprints → ${out}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
