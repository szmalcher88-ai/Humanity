/**
 * Screenshot tool: boots AKHET at a given scene/seed/T/cam, waits for
 * readiness, settles temporal effects, captures a PNG, prints engine stats.
 * Ported from PROJECT LAAS (MIT) — see LICENSE-THIRD-PARTY.
 *
 * Usage:
 *   npx tsx tools/shoot.ts --scene sanity --out shots/sanity.png
 *   npx tsx tools/shoot.ts --scene world --T 17.5 --cam "10,50,30,1.2,-0.1" \
 *     --w 1920 --h 1080 --stats shots/sanity-stats.json [--hud 1]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { launchWebGPU, akhetUrl } from './launch';

interface Args {
  [k: string]: string | boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function str(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const width = Number(str(args['w']) ?? 1920);
  const height = Number(str(args['h']) ?? 1080);
  const scene = str(args['scene']) ?? 'world';
  const out = str(args['out']) ?? `shots/${scene}-${Date.now()}.png`;
  const settleFrames = Number(str(args['settle']) ?? 24);
  const timeoutMs = Number(str(args['timeout']) ?? 180000);

  const { browser } = await launchWebGPU();
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.startsWith('[akhet]') || msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[page:${msg.type()}] ${t}`);
    }
  });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  const urlOpts: Parameters<typeof akhetUrl>[0] = { scene, width, height };
  if (args['seed'] !== undefined) urlOpts.seed = Number(str(args['seed']));
  if (args['T'] !== undefined) urlOpts.T = Number(str(args['T']));
  const cam = str(args['cam']);
  if (cam) urlOpts.cam = cam;
  const preset = str(args['preset']);
  if (preset) urlOpts.preset = preset;
  urlOpts.hud = args['hud'] === true || args['hud'] === '1';
  urlOpts.freeze = args['nofreeze'] !== true;
  const consumed = new Set([
    'w', 'h', 'scene', 'out', 'settle', 'timeout', 'seed', 'T', 'cam',
    'preset', 'hud', 'nofreeze', 'stats',
  ]);
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(args)) {
    if (!consumed.has(k)) extra[k] = v === true ? '1' : String(v);
  }
  if (Object.keys(extra).length > 0) urlOpts.extra = extra;
  const url = akhetUrl(urlOpts);
  console.log(`[shoot] ${url} → ${out}`);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  await page
    .waitForFunction(
      () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
      undefined,
      { timeout: timeoutMs, polling: 250 },
    )
    .catch(async () => {
      const prog = await page.evaluate(() =>
        window.__akhet ? `${window.__akhet.progressMsg} (${window.__akhet.progress})` : 'no hooks',
      );
      throw new Error(`Timed out waiting for ready; last progress: ${prog}`);
    });

  const error = await page.evaluate(() => window.__akhet.error);
  if (error) {
    await page.screenshot({ path: out.replace(/\.png$/, '-FAILED.png') });
    throw new Error(`App reported fatal error:\n${error}`);
  }
  console.log(`[shoot] ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await page.evaluate(
    async (frames) => window.__akhet.settle && (await window.__akhet.settle(frames)),
    settleFrames,
  );

  // --framealign N: settle until stats.frame % 1024 === N (pins frame-indexed
  // jitter phase so two builds produce bit-comparable captures)
  const fAlign = str(args['framealign']);
  if (fAlign !== undefined) {
    const target = ((Number(fAlign) % 1024) + 1024) % 1024;
    await page.evaluate(
      async (t) => {
        const s = window.__akhet;
        if (!s.settle || !s.stats) return;
        for (let guard = 0; guard < 1100; guard++) {
          if (s.stats.frame % 1024 === t) break;
          await s.settle(1);
        }
      },
      target,
    );
    const at = await page.evaluate(() => window.__akhet.stats?.frame ?? -1);
    console.log(`[shoot] frame-aligned at ${at} (mod 1024 = ${at % 1024})`);
  }

  // --gpusample N: poll GPU pass timings N times → median (timestamps are noisy)
  const gpuN = Number(str(args['gpusample']) ?? 0);
  if (gpuN > 0) {
    const samples: number[] = [];
    const perKey = new Map<string, number[]>();
    for (let i = 0; i < gpuN; i++) {
      await page.evaluate(async () => window.__akhet.settle && (await window.__akhet.settle(12)));
      const g = await page.evaluate(() => window.__akhet.stats?.gpuPasses ?? {});
      const v = (g['render'] ?? 0) + (g['compute'] ?? 0);
      if (v > 0) {
        samples.push(v);
        for (const [k, ms] of Object.entries(g)) {
          if (!perKey.has(k)) perKey.set(k, []);
          perKey.get(k)?.push(ms);
        }
      }
    }
    samples.sort((a, b) => a - b);
    const med = samples[Math.floor(samples.length / 2)] ?? 0;
    console.log(`[gpu] median=${med.toFixed(1)}ms over ${samples.length} samples`);
    const medOf = (a: number[]): number => {
      const s = [...a].sort((x, y) => x - y);
      return s[Math.floor(s.length / 2)] ?? 0;
    };
    const rows = [...perKey.entries()]
      .map(([k, a]) => [k, medOf(a)] as const)
      .filter(([k, m]) => (k.startsWith('r.') || k.startsWith('c.')) && m >= 0.01)
      .sort((a, b) => b[1] - a[1]);
    for (const [k, m] of rows) console.log(`[gpu]   ${m.toFixed(2).padStart(7)} ms  ${k}`);
  }

  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out });

  const stats = await page.evaluate(() => JSON.stringify(window.__akhet.stats));
  console.log(`[stats] ${stats}`);
  const statsOut = str(args['stats']);
  if (statsOut) {
    mkdirSync(dirname(statsOut), { recursive: true });
    writeFileSync(statsOut, stats);
  }

  await browser.close();
  console.log(`[shoot] wrote ${out}`);
}

main().catch((e: unknown) => {
  console.error('[shoot] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
