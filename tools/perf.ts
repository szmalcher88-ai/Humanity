/**
 * Perf A/B — the I7 protocol (docs/plans/I7_PLAN.md §3.1). One number from
 * one EMA read on a freshly booted page is worse than none (the bm7 "drift"
 * swung 62 → 44 on one build), so a reading here is:
 *  - URL PINNED: `preset=high&force=1&dpr=1&T=15&hud=0` (force: the boot
 *    bench must not cap the preset mid-study — RTX only, never the iGPU),
 *  - a fresh page per arm and round, bookmarks in a shuffled order,
 *  - settle, then 8 s of requestAnimationFrame intervals → median fps and
 *    the 10th-percentile fps (the slow frames),
 *  - INVALID if the TDR guard cut the render scale (`perf.dprCuts` > 0):
 *    such a page renders 0.36× the pixels and reads far too fast.
 * With --b, each round measures A (as is) and B (the extra query) in turn.
 * The dev server must be running; close the in-app browser pane (or measure
 * it: that is arm P1). v1.2 I5–I7.
 *
 *   npx tsx tools/perf.ts --bm 7 --runs 3
 *   npx tsx tools/perf.ts --bm 1,3,7 --runs 3 --b "noguard=1"
 *   npx tsx tools/perf.ts --bm 7 --runs 3 --b "hide=south-works,necropolis"
 *   npx tsx tools/perf.ts --bm 7 --free      # unpinned: the app's own preset/dpr
 *   npx tsx tools/perf.ts --bm 12,4 --runs 3 --q "epoch=KHAFRE_PERIOD" --b "g2=0"
 *     (--q: params for BOTH arms — an A/B inside an epoch, T2-3)
 * Each reading also carries the GPU pass times (`stats.gpuPasses`): the main
 * scene pass and the sum of the shadow cascades, in ms.
 */
import { akhetUrl, launchWebGPU } from './launch';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v !== undefined && !v.startsWith('--') ? v : undefined;
}

interface Reading {
  bm: number;
  fps: number;
  p10: number;
  ema: number;
  tris: number;
  cuts: number;
  bench: number;
  /** GPU ms: the main scene pass, the shadow cascades summed */
  scene: number;
  shadow: number;
}

async function main(): Promise<void> {
  const bms = (arg('bm') ?? '1,3,7').split(',').map(Number);
  const runs = Number(arg('runs') ?? 1);
  const T = arg('T') ?? '15';
  const settle = Number(arg('settle') ?? 120);
  const sampleMs = Number(arg('sample') ?? 8000);
  const free = process.argv.includes('--free');
  const b = arg('b');
  const both = Object.fromEntries(new URLSearchParams(arg('q') ?? ''));
  const pin: Record<string, string> = free ? {} : { preset: 'high', force: '1', dpr: '1' };
  const sides: [string, Record<string, string>][] = [['A', {}]];
  if (b) sides.push(['B', Object.fromEntries(new URLSearchParams(b))]);
  const { browser } = await launchWebGPU();
  const all: Record<string, Reading[]> = { A: [], B: [] };
  for (let r = 0; r < runs; r++) {
    // a different bookmark order each round (rotation), so no framing is
    // always the cold first boot
    const order = bms.map((_, i) => bms[(i + r) % bms.length] as number);
    for (const [name, q] of sides) {
      const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
      const out: string[] = [];
      for (const bm of order) {
        await page.goto(akhetUrl({ scene: 'world', freeze: true, extra: { T, bm: String(bm), hud: '0', ...pin, ...both, ...q } }), {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForFunction(
          () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
          undefined,
          { timeout: 240000, polling: 250 },
        );
        await page.evaluate(async (n) => window.__akhet.settle?.(n), settle);
        // a string, not a function: tsx wraps named closures in a `__name`
        // helper that does not exist in the page
        const s = (await page.evaluate(`(async () => {
          const dts = [];
          await new Promise((done) => {
            let last = performance.now();
            const t0 = last;
            const step = (now) => {
              dts.push(now - last);
              last = now;
              if (now - t0 < ${sampleMs}) requestAnimationFrame(step);
              else done();
            };
            requestAnimationFrame(step);
          });
          dts.shift();
          dts.sort((x, y) => x - y);
          const med = dts[Math.floor(dts.length / 2)] || 1;
          const slow = dts[Math.floor(dts.length * 0.9)] || 1;
          const st = window.__akhet.stats;
          const gp = (st && st.gpuPasses) || {};
          let shadow = 0;
          for (const k in gp) if (k.startsWith('r.shadow.')) shadow += gp[k];
          return {
            scene: gp['r.scene'] || 0, shadow,
            fps: 1000 / med, p10: 1000 / slow, ema: st ? st.fps : 0, tris: st ? st.triangles : 0,
            cuts: (st && st.counters && st.counters['perf.dprCuts']) || 0, bench: window.__akhet.benchMs || 0,
          };
        })()`)) as Omit<Reading, 'bm'>;
        all[name]!.push({ bm, ...s });
        out.push(`bm${bm} ${s.fps.toFixed(0)} fps (p10 ${s.p10.toFixed(0)}, ema ${s.ema.toFixed(0)}) ${(s.tris / 1e6).toFixed(1)}M [scene ${s.scene.toFixed(1)} shadow ${s.shadow.toFixed(1)} ms]${s.cuts > 0 ? ` INVALID: ${s.cuts} dpr cut(s)` : ''}`);
      }
      await page.close();
      console.log(`[perf] round ${r + 1} ${name}: ${out.join('  ')}`);
    }
  }
  // medians of the valid readings per side and bookmark
  for (const [name] of sides) {
    const line = bms.map((bm) => {
      const v = all[name]!.filter((x) => x.bm === bm && x.cuts === 0).map((x) => x.fps).sort((x, y) => x - y);
      return `bm${bm} ${v.length ? (v[Math.floor(v.length / 2)] as number).toFixed(0) : '—'} (${v.map((x) => x.toFixed(0)).join('/')})`;
    });
    console.log(`[perf] ${name} median: ${line.join('  ')}`);
    const gpu = bms.map((bm) => {
      const v = all[name]!.filter((x) => x.bm === bm && x.cuts === 0);
      const med = (f: (x: Reading) => number): string => {
        const w = v.map(f).sort((x, y) => x - y);
        return w.length ? (w[Math.floor(w.length / 2)] as number).toFixed(2) : '—';
      };
      return `bm${bm} scene ${med((x) => x.scene)} shadow ${med((x) => x.shadow)}`;
    });
    console.log(`[perf] ${name} gpu ms: ${gpu.join('  ')}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
