/**
 * Shared Playwright launcher that guarantees a WebGPU-capable Chromium.
 * Probes flag sets (headless first, headed fallback) and caches the winner
 * in .cache/webgpu-flags.json so subsequent runs start instantly.
 * Ported from PROJECT LAAS (MIT) — see LICENSE-THIRD-PARTY.
 *
 * Windows notes (this machine: RTX 3050 Laptop + Intel UHD, Optimus):
 *  - WebGPU needs a secure context — probe on http://localhost, never about:blank.
 *  - Playwright default headless is the GPU-less "headless shell"; full Chromium
 *    new-headless via channel:'chromium' (or channel:'chrome' if installed).
 *  - D3D12 adapter selection may land on the iGPU; extra candidates force
 *    the high-performance adapter.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, type Browser } from 'playwright';

interface LaunchRecipe {
  headless: boolean;
  channel?: string;
  args: string[];
}

const CANDIDATES: LaunchRecipe[] = [
  // VERIFIED on this machine (tools/probe-adapter.ts, 2026-07-10):
  // plain headless chromium → intel/gen-12lp; this flag → nvidia/ampere.
  { headless: true, channel: 'chromium', args: ['--force_high_performance_gpu'] },
  { headless: true, channel: 'chromium', args: [] },
  { headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu'] },
  { headless: true, channel: 'chrome', args: ['--force_high_performance_gpu'] },
  { headless: true, channel: 'chrome', args: [] },
  { headless: false, args: [] },
];

const CACHE_PATH = '.cache/webgpu-flags.json';
const PROBE_BASE = 'http://localhost:5173';

async function probeRecipe(recipe: LaunchRecipe): Promise<Browser | null> {
  let browser: Browser | null = null;
  try {
    const launchOpts: Parameters<typeof chromium.launch>[0] = {
      headless: recipe.headless,
      args: recipe.args,
    };
    if (recipe.channel) launchOpts.channel = recipe.channel;
    browser = await chromium.launch(launchOpts);
    const page = await browser.newPage();
    await page.goto(`${PROBE_BASE}/__webgpu_probe__`, { waitUntil: 'domcontentloaded' });
    const ok = await page.evaluate(async () => {
      const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      if (!gpu) return false;
      const adapter = await gpu.requestAdapter();
      return adapter !== null;
    });
    await page.close();
    if (ok) return browser;
    await browser.close();
    return null;
  } catch {
    if (browser) await browser.close().catch(() => undefined);
    return null;
  }
}

export async function launchWebGPU(): Promise<{ browser: Browser; recipe: LaunchRecipe }> {
  try {
    const cached = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as LaunchRecipe;
    const browser = await probeRecipe(cached);
    if (browser) return { browser, recipe: cached };
  } catch {
    /* no cache yet */
  }
  for (const recipe of CANDIDATES) {
    const browser = await probeRecipe(recipe);
    if (browser) {
      mkdirSync('.cache', { recursive: true });
      writeFileSync(CACHE_PATH, JSON.stringify(recipe, null, 2));
      console.log(
        `[launch] WebGPU OK — headless=${recipe.headless} channel=${recipe.channel ?? 'default'} args=[${recipe.args.join(' ')}]`,
      );
      return { browser, recipe };
    }
  }
  throw new Error(
    'No Chromium launch recipe produced a WebGPU adapter (requires dev server on :5173 for the secure-context probe). ' +
      'Tried channel:chromium/chrome headless and headed.',
  );
}

export interface AkhetPageOptions {
  scene?: string;
  seed?: number;
  T?: number;
  cam?: string;
  preset?: string;
  hud?: boolean;
  freeze?: boolean;
  width?: number;
  height?: number;
  extra?: Record<string, string>;
}

export function akhetUrl(opts: AkhetPageOptions, base = 'http://localhost:5173/'): string {
  const q = new URLSearchParams();
  if (opts.scene) q.set('scene', opts.scene);
  if (opts.seed !== undefined) q.set('seed', String(opts.seed));
  if (opts.T !== undefined) q.set('T', String(opts.T));
  if (opts.cam) q.set('cam', opts.cam);
  if (opts.preset) q.set('preset', opts.preset);
  q.set('hud', opts.hud ? '1' : '0');
  if (opts.freeze !== false) q.set('freeze', '1');
  for (const [k, v] of Object.entries(opts.extra ?? {})) q.set(k, v);
  return `${base}?${q.toString()}`;
}
