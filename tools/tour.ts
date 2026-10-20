/**
 * Bookmark tour: boots the world ONCE and captures every curated view.
 *
 * shoot.ts boots per frame (~40 s each); the battery already proves that
 * setPose + setTimeOfDay + settle in one session reproduces a framing, so a
 * visual review of all eleven bookmarks no longer costs eleven boots.
 *
 *   npx tsx tools/tour.ts --out shots/tour              # all bookmarks
 *   npx tsx tools/tour.ts --out shots/tour --only 2,3   # a subset (1-based)
 *   npx tsx tools/tour.ts --w 1920 --h 1080 --settle 60 --T 9.5
 *
 * A bookmark that carries its own hour uses it; the others use the hour in
 * HOURS below (their gallery hour), else --T. The dev server must be running.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { MARKS } from '../src/debug/Bookmarks';
import { akhetUrl, launchWebGPU } from './launch';

/** the hour each bookmark was framed for, where the mark itself has none */
const HOURS: Record<string, number> = {
  'dawn from the harbor': 6.4,
  'noon court': 12.4,
  'quarry': 9.0,
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v !== undefined && !v.startsWith('--') ? v : undefined;
}

async function main(): Promise<void> {
  const width = Number(arg('w') ?? 1600);
  const height = Number(arg('h') ?? 900);
  const settle = Number(arg('settle') ?? 48);
  const defaultT = Number(arg('T') ?? 10);
  const outDir = arg('out') ?? 'shots/tour';
  const only = arg('only')?.split(',').map(Number);
  const extra: Record<string, string> = { T: String(defaultT) };
  const preset = arg('preset');
  if (preset) extra['preset'] = preset;
  // --q "cull=0&froxels=0" — any other URL parameters, for ablations
  for (const [k, v] of new URLSearchParams(arg('q') ?? '')) extra[k] = v;

  mkdirSync(outDir, { recursive: true });
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[page:error] ${msg.text()}`);
  });

  await page.goto(akhetUrl({ scene: 'world', freeze: true, extra }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );
  const err = await page.evaluate(() => window.__akhet.error);
  if (err) throw new Error(err);

  const report: Record<string, unknown>[] = [];
  for (let i = 0; i < MARKS.length; i++) {
    const n = i + 1;
    if (only && !only.includes(n)) continue;
    const m = MARKS[i];
    if (!m) continue;
    const t = m.t ?? HOURS[m.name] ?? defaultT;
    const stats = await page.evaluate(
      async ({ p, yaw, pitch, t, settle }) => {
        const h = window.__akhet;
        h.setTimeOfDay?.(t);
        h.setPose?.({ p, yaw, pitch });
        await h.settle?.(settle);
        return h.stats;
      },
      { p: m.p, yaw: m.yaw, pitch: m.pitch, t, settle },
    );
    const slug = m.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const file = `${outDir}/bm${String(n).padStart(2, '0')}-${slug}.png`;
    await page.screenshot({ path: file });
    console.log(
      `[tour] bm${n} ${m.name} T${t} → ${file}  ` +
        `${(stats?.fps ?? 0).toFixed(0)} fps  ${((stats?.triangles ?? 0) / 1e6).toFixed(1)}M tris`,
    );
    report.push({ n, name: m.name, t, file, fps: stats?.fps, tris: stats?.triangles });
  }
  writeFileSync(`${outDir}/tour.json`, JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e: unknown) => {
  console.error('[tour] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
