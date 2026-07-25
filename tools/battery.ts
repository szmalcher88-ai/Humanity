/**
 * Full verification battery (Phase 7 close-out).
 *
 * One command that boots the world and asserts everything the project claims,
 * with numbers rather than screenshots-and-vibes. Every check prints PASS/FAIL
 * and the process exits non-zero if any hard gate fails.
 *
 *   npx tsx tools/battery.ts            # everything
 *   npx tsx tools/battery.ts --quick    # skip the perf sweep
 *
 * The dev server must be running (npm run dev).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { akhetUrl, launchWebGPU } from './launch';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  hard: boolean;
}

const checks: Check[] = [];
function record(name: string, ok: boolean, detail: string, hard = true): void {
  checks.push({ name, ok, detail, hard });
  const tag = ok ? 'PASS' : hard ? 'FAIL' : 'WARN';
  console.log(`[${tag}] ${name.padEnd(34)} ${detail}`);
}

async function boot(page: Page, extra: Record<string, string>): Promise<void> {
  const url = akhetUrl({ scene: 'world', freeze: true, extra });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );
  const err = await page.evaluate(() => window.__akhet.error);
  if (err) throw new Error(err);
}

async function main(): Promise<void> {
  const quick = process.argv.includes('--quick');
  mkdirSync('shots/battery', { recursive: true });

  // ---- 1. the standalone audits (canon, spec, cardinality, collisions) ----
  try {
    const out = execFileSync('npx', ['tsx', 'tools/audit.ts'], {
      encoding: 'utf8',
      shell: true,
    });
    const fails = (out.match(/FAIL/g) ?? []).length;
    record('canon + geometry audit', fails === 0, `${fails} failing checks`);
  } catch (e) {
    record('canon + geometry audit', false, e instanceof Error ? e.message.slice(0, 120) : 'threw');
  }
  for (const [label, script] of [
    ['bookmark poses', 'tools/test-bookmarks.ts'],
    ['inspector round-trip', 'tools/test-inspector.ts'],
  ] as const) {
    try {
      execFileSync('npx', ['tsx', script], { encoding: 'utf8', shell: true });
      record(label, true, 'smoke test clean');
    } catch (e) {
      record(label, false, e instanceof Error ? e.message.slice(0, 120) : 'threw');
    }
  }

  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  // ---- 2. boot + runtime invariants -------------------------------------
  await boot(page, { T: '12.4', hud: '0' });
  const stats = await page.evaluate(() => window.__akhet.stats);
  const counters = (stats?.counters ?? {}) as Record<string, number>;
  record('boot without fatal error', true, `${Object.keys(counters).length} counters`);
  record(
    'collision audit clean',
    (counters['collision.issues'] ?? 1) === 0,
    `${counters['collision.issues'] ?? '?'} issues`,
  );

  // brief §2 content floors
  const floors: [string, string, number][] = [
    ['heightfield ≥4096²', 'terrain.res', 4096],
    ['palms ≥5k', 'veg.palms', 5000],
    ['field instances ≥500k', 'veg.tufts', 500_000],
    ['debris ≥80k', 'debris', 80_000],
    ['particles ≥100k', 'particles', 100_000],
    ['pyramid stones ≥60k', 'monuments.stones', 60_000],
    ['vessel variants ≥12', 'harbor.vessels', 12],
    ['inhabitants ≥300', 'workers', 300],
  ];
  for (const [name, key, min] of floors) {
    const v = counters[key] ?? 0;
    record(`floor: ${name}`, v >= min, `${key} = ${v}`);
  }

  // ---- 3. walk mode: eye height holds over terrain AND structures --------
  {
    // stand on the causeway embankment and step along it
    const probe = await page.evaluate(async () => {
      const h = window.__akhet;
      h.setPose?.({ p: [620, 40, -150], yaw: 2.25, pitch: 0 });
      h.setWalk?.(true);
      await h.settle?.(6);
      const samples: { y: number; surf: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const pose = h.getPose?.();
        if (!pose) break;
        const s = h.surfaceProbe?.(pose.p[0], pose.p[2], pose.p[1] - 1.55) ?? 0;
        samples.push({ y: pose.p[1], surf: s });
        h.setPose?.({ p: [pose.p[0] - 12, pose.p[1], pose.p[2]], yaw: 2.25, pitch: 0 });
        await h.settle?.(4);
      }
      h.setWalk?.(false);
      return samples;
    });
    const errs = probe.map((s) => Math.abs(s.y - s.surf - 1.55));
    const worst = errs.length > 0 ? Math.max(...errs) : 99;
    record(
      'walk mode holds eye height',
      worst < 0.35,
      `max |eye − surface − 1.55| = ${worst.toFixed(3)} m over ${probe.length} steps`,
    );
    const climbed = probe.length > 1 && Math.max(...probe.map((s) => s.surf)) - Math.min(...probe.map((s) => s.surf)) > 1;
    record('walk mode climbs structures', climbed, 'causeway grade followed', false);
  }

  // ---- 4. no-black-shadows law ------------------------------------------
  {
    await page.evaluate(async () => {
      window.__akhet.setPose?.({ p: [265, 7, 265], yaw: 0.785, pitch: 0.2 });
      await window.__akhet.settle?.(24);
    });
    await page.screenshot({ path: 'shots/battery/noon-court.png' });
    const lv = execFileSync(
      'npx',
      ['tsx', 'tools/levels.ts', '--in', 'shots/battery/noon-court.png'],
      { encoding: 'utf8', shell: true },
    );
    const crushed = Number(/crushed<8 ([\d.]+)%/.exec(lv)?.[1] ?? '99');
    record('no black shadows', crushed < 0.2, `${crushed}% of pixels below 8/255`);
  }

  // ---- 5. midday tonal separation (the DELTA gate) -----------------------
  {
    await page.evaluate(async () => {
      window.__akhet.setTimeOfDay?.(12.4);
      window.__akhet.setPose?.({ p: [265, 7, 265], yaw: 0.785, pitch: 0.2 });
      await window.__akhet.settle?.(30);
    });
    await page.screenshot({ path: 'shots/battery/noon-separation.png' });
    const lv = execFileSync(
      'npx',
      [
        'tsx', 'tools/levels.ts', '--in', 'shots/battery/noon-separation.png',
        '--box', 'casing:620,450,760,560',
        '--box', 'ground:250,760,500,860',
      ],
      { encoding: 'utf8', shell: true },
    );
    const lum = (name: string): number =>
      Number(new RegExp(`${name}\\s+rgb\\([^)]*\\) lum ([\\d.]+)`).exec(lv)?.[1] ?? '0');
    const casing = lum('casing');
    const ground = lum('ground');
    const sep = casing > 0 ? (casing - ground) / casing : 0;
    record(
      'casing separates from ground',
      sep > 0.12,
      `casing ${casing.toFixed(0)} vs ground ${ground.toFixed(0)} → ${(sep * 100).toFixed(1)}%`,
    );
  }

  // ---- 6. perf sweep -----------------------------------------------------
  if (!quick) {
    // The 1600×900 page MUST go first. Leaving it open costs ~20 fps on the
    // measurement page: two live WebGPU contexts share one GPU, and the first
    // run of this battery reported 26-31 fps for framings that measure 47-52
    // standalone. A perf gate that measures the harness is worse than no gate.
    await page.close();
    const big = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    const results: [number, number][] = [];
    for (const bm of [1, 3, 7]) {
      await boot(big, { T: '15', bm: String(bm), hud: '0' });
      await big.evaluate(async () => window.__akhet.settle?.(90));
      const fps = await big.evaluate(() => window.__akhet.stats?.fps ?? 0);
      results.push([bm, fps]);
    }
    await big.close();
    const worst = Math.min(...results.map((r) => r[1]));
    record(
      'perf ≥45 fps @1440p (dev GPU)',
      worst >= 45,
      results.map(([b, f]) => `bm${b} ${f.toFixed(0)}`).join('  '),
      false, // the dev RTX 3050 is BELOW the 3060 target class — advisory
    );
  }

  await browser.close();

  const hardFails = checks.filter((c) => !c.ok && c.hard).length;
  const warns = checks.filter((c) => !c.ok && !c.hard).length;
  console.log(
    `\n[battery] ${checks.length - hardFails - warns}/${checks.length} passed` +
      (warns > 0 ? `, ${warns} warnings` : '') +
      (hardFails > 0 ? `, ${hardFails} FAILURES` : ''),
  );
  process.exit(hardFails > 0 ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error('[battery] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
