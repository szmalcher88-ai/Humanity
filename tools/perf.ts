/**
 * Perf probe — the battery's perf sweep alone (2560×1440, T 15, hud off, a
 * fresh page per framing, settle 90 frames), with an A/B switch and repeats
 * so both sides are measured in ONE sitting (STATUS PERF NOTE: never across
 * runs). v1.2 I5.
 *
 *   npx tsx tools/perf.ts --bm 7 --runs 2
 *   npx tsx tools/perf.ts --bm 7 --runs 3 --settle 300   # the first run is warm-up
 *   npx tsx tools/perf.ts --bm 1,3,7 --runs 2 --b "hide=south-works,necropolis"
 *
 * With --b, every run measures A (as is) then B (the extra query) in turn.
 * The dev server must be running; close the in-app browser pane first.
 */
import { akhetUrl, launchWebGPU } from './launch';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v !== undefined && !v.startsWith('--') ? v : undefined;
}

async function main(): Promise<void> {
  const bms = (arg('bm') ?? '1,3,7').split(',').map(Number);
  const runs = Number(arg('runs') ?? 1);
  const T = arg('T') ?? '15';
  const b = arg('b');
  const settle = Number(arg('settle') ?? 90);
  const sides: [string, Record<string, string>][] = [['A', {}]];
  if (b) sides.push(['B', Object.fromEntries(new URLSearchParams(b))]);
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
  for (let r = 0; r < runs; r++) {
    for (const [name, q] of sides) {
      const out: string[] = [];
      for (const bm of bms) {
        await page.goto(akhetUrl({ scene: 'world', freeze: true, extra: { T, bm: String(bm), hud: '0', ...q } }), {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForFunction(
          () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
          undefined,
          { timeout: 240000, polling: 250 },
        );
        await page.evaluate(async (n) => window.__akhet.settle?.(n), settle);
        const s = await page.evaluate(() => ({ fps: window.__akhet.stats?.fps ?? 0, tris: window.__akhet.stats?.triangles ?? 0 }));
        out.push(`bm${bm} ${s.fps.toFixed(0)} fps ${(s.tris / 1e6).toFixed(1)}M`);
      }
      console.log(`[perf] run ${r + 1} ${name}: ${out.join('  ')}`);
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
