/**
 * Gallery capture: boots the world ONCE and renders the curated README
 * frames into the TRACKED folder docs/gallery/ as JPEG.
 *
 * Why it exists (v1.1): the README gallery pointed into shots/, which is
 * gitignored — on GitHub every image was broken. Gallery frames are now
 * build products of this script, small enough to commit (~0.3 MB each).
 *
 *   npx tsx tools/gallery.ts              # all frames, 1920×1080
 *   npx tsx tools/gallery.ts --only dawn  # frames whose name contains "dawn"
 *
 * The dev server must be running. `?clean=1` hides every overlay.
 */

import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { MARKS } from '../src/debug/Bookmarks';
import { akhetUrl, launchWebGPU } from './launch';

interface Frame {
  name: string;
  p: [number, number, number];
  yaw: number;
  pitch: number;
  t: number;
}

const mark = (n: number, t?: number): Omit<Frame, 'name'> => {
  const m = MARKS[n - 1];
  if (!m) throw new Error(`no bookmark ${n}`);
  return { p: [...m.p], yaw: m.yaw, pitch: m.pitch, t: t ?? m.t ?? 10 };
};

const FRAMES: Frame[] = [
  { name: 'dawn-from-harbor', ...mark(2, 6.4) },
  { name: 'noon-on-plateau', ...mark(3, 12.4) },
  { name: 'harbor-panorama', ...mark(1, 9.5) },
  { name: 'queens-and-temple', ...mark(8, 10) },
  { name: 'temple-scaffolding', ...mark(11) },
  { name: 'worker-town', p: [560, 25, 600], yaw: Math.PI, pitch: -0.42, t: 9.5 },
  { name: 'boatyard', p: [1062, -40, 112], yaw: 0.05, pitch: -0.14, t: 9 },
  { name: 'river-shore', ...mark(9, 10) },
  { name: 'night-harbour', ...mark(10) },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v !== undefined && !v.startsWith('--') ? v : undefined;
}

async function main(): Promise<void> {
  const only = arg('only');
  const outDir = arg('out') ?? 'docs/gallery';
  mkdirSync(outDir, { recursive: true });
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  await page.goto(akhetUrl({ scene: 'world', freeze: true, extra: { T: '10', clean: '1' } }), {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );
  const err = await page.evaluate(() => window.__akhet.error);
  if (err) throw new Error(err);

  for (const f of FRAMES) {
    if (only && !f.name.includes(only)) continue;
    await page.evaluate(
      async ({ p, yaw, pitch, t }) => {
        const h = window.__akhet;
        h.setTimeOfDay?.(t);
        h.setPose?.({ p, yaw, pitch });
        // longer than the tour: GI probes and TRAA converge after a jump
        await h.settle?.(72);
      },
      { p: f.p, yaw: f.yaw, pitch: f.pitch, t: f.t },
    );
    const png = await page.screenshot();
    const file = `${outDir}/${f.name}.jpg`;
    await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(file);
    console.log(`[gallery] ${f.name} T${f.t} → ${file}`);
  }
  await browser.close();
}

main().catch((e: unknown) => {
  console.error('[gallery] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
