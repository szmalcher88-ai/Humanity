/**
 * Close-up capture of registered footprints: boots the world ONCE, picks
 * footprints whose id starts with --id, and shoots each one with a
 * telephoto camera from a fixed bearing — the quick way to eyeball small
 * props (boat crews, kilns, chips) that bookmarks frame too wide to judge.
 *
 *   npx tsx tools/closeup.ts --id vessel: --n 6
 *   npx tsx tools/closeup.ts --id stall:,slipway:,furnace: --n 2   # n per prefix
 *   npx tsx tools/closeup.ts --id kiln --dist 18 --elev 0.3 --fov 30 --T 9
 *
 * The dev server must be running. Frames land in shots/closeup/.
 */

import { mkdirSync } from 'node:fs';
import { akhetUrl, launchWebGPU } from './launch';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v !== undefined && !v.startsWith('--') ? v : undefined;
}
const num = (name: string, d: number): number => {
  const v = Number(arg(name));
  return Number.isFinite(v) ? v : d;
};

interface Target {
  id: string;
  x: number;
  z: number;
  y: number;
  r: number;
}

async function main(): Promise<void> {
  const prefix = arg('id') ?? 'vessel:';
  const n = num('n', 6);
  const fov = num('fov', 28);
  const elev = num('elev', 0.22); // camera elevation angle above the target (rad)
  const bearing = num('bearing', 0.7); // camera bearing around the target (rad)
  const T = num('T', 9.5);
  const outDir = arg('out') ?? 'shots/closeup';
  mkdirSync(outDir, { recursive: true });

  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  await page.goto(akhetUrl({ scene: 'world', freeze: true, extra: { T: String(T), clean: '1' } }), {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );
  const err = await page.evaluate(() => window.__akhet.error);
  if (err) throw new Error(err);

  const all: Target[] = await page.evaluate(() =>
    (window.__akhet.footprints?.() ?? []).map((f) => ({
      id: f.id, x: f.x, z: f.z, y: (f.y0 + f.y1) / 2, r: Math.max(f.hx, f.hz),
    })),
  );
  const targets: Target[] = [];
  for (const pre of prefix.split(',')) {
    const hits = all.filter((f) => f.id.startsWith(pre));
    console.log(`[closeup] ${hits.length} footprints match "${pre}"`);
    targets.push(...hits.slice(0, n));
  }

  for (const t of targets) {
    // distance that frames the footprint's radius in the vertical fov
    const dist = num('dist', Math.max(8, (t.r * 1.5) / Math.tan(((fov / 2) * Math.PI) / 180)));
    const cx = t.x + Math.sin(bearing) * Math.cos(elev) * dist;
    const cz = t.z + Math.cos(bearing) * Math.cos(elev) * dist;
    const cy = t.y + Math.sin(elev) * dist;
    // three.js camera looks down -Z: forward = (-sin yaw, ·, -cos yaw)
    const yaw = Math.atan2(-(t.x - cx), -(t.z - cz));
    const pitch = Math.atan2(t.y - cy, Math.hypot(t.x - cx, t.z - cz));
    await page.evaluate(
      async ({ p, yaw, pitch, fov }) => {
        const h = window.__akhet;
        h.setPose?.({ p, yaw, pitch, fov });
        await h.settle?.(48);
      },
      { p: [cx, cy, cz] as [number, number, number], yaw, pitch, fov },
    );
    const file = `${outDir}/${t.id.replace(/[^a-z0-9-]+/gi, '_')}.png`;
    await page.screenshot({ path: file });
    console.log(`[closeup] ${t.id} @ ${t.x.toFixed(0)},${t.z.toFixed(0)} → ${file}`);
  }
  await browser.close();
}

main().catch((e: unknown) => {
  console.error('[closeup] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
