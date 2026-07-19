/**
 * Dimension & alignment audit (brief §7.2) — machine-checks the monument
 * math against CANON_DIMENSIONS and the sun path against true cardinal
 * directions, then (optionally, --shadow) measures the RENDERED shadow
 * direction of the Great Pyramid from a top-down screenshot.
 *
 *   npx tsx tools/audit.ts            # spec + sun-path checks (fast, CPU)
 *   npx tsx tools/audit.ts --shadow   # + rendered shadow-vector test
 */

import { Vector3 } from 'three';
import { Rng } from '../src/core/Seed';
import { buildSpec, auditSpec } from '../src/monuments/PyramidSpec';
import {
  G1_BASE_SIDE,
  G1_HEIGHT,
  G1_SLOPE_DEG,
  G1_COURSE_COUNT,
  G1_COURSE1_HEIGHT,
  G1_COURSE_MIN_HEIGHT,
  auditSelfConsistency,
} from '../src/world/CANON_DIMENSIONS';
import { SunSky } from '../src/sky/SunSky';

let failures = 0;
function check(name: string, ok: boolean, detail: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// --- 1. CANON self-consistency -------------------------------------------------
const canon = auditSelfConsistency();
check(
  'canon slope↔height',
  canon.ok,
  `derived ${canon.derivedHeight.toFixed(3)} vs survey ${G1_HEIGHT.value}`,
);

// --- 2. G1 spec ------------------------------------------------------------------
const h = (G1_BASE_SIDE.value / 2) * Math.tan((G1_SLOPE_DEG.value * Math.PI) / 180);
const spec = buildSpec({
  baseSide: G1_BASE_SIDE.value,
  height: h,
  slopeDeg: G1_SLOPE_DEG.value,
  cx: 0,
  cy: 0,
  cz: 0,
  courseCount: G1_COURSE_COUNT.value,
  course1: G1_COURSE1_HEIGHT.value,
  courseMin: G1_COURSE_MIN_HEIGHT.value,
  rng: new Rng(1),
});
const sa = auditSpec(spec);
check('G1 spec consistency', sa.ok, sa.notes.join('; ') || `${spec.courses.length} courses`);
check(
  'G1 base within survey tolerance',
  Math.abs(spec.params.baseSide - 230.363) < 0.01,
  `${spec.params.baseSide}`,
);
check(
  'G1 height within 0.5 m of survey',
  Math.abs(h - G1_HEIGHT.value) < 0.5,
  `${h.toFixed(3)} vs ${G1_HEIGHT.value}`,
);
check(
  'G1 course count',
  spec.courses.length === G1_COURSE_COUNT.value,
  `${spec.courses.length}`,
);
const c0 = spec.courses[0];
check(
  'first course ≈ 1.49 m (post-normalization)',
  c0 !== undefined && Math.abs(c0.h - 1.49) < 0.35,
  c0 ? c0.h.toFixed(3) : 'missing',
);
check('casing stone floor (>40k for G1)', spec.stones.length > 40000, `${spec.stones.length}`);

// --- 3. sun path cardinality (equinox) -------------------------------------------
const v = new Vector3();
SunSky.sunDirection(6.0, v);
check(
  'T=6 sunrise due EAST',
  Math.abs(v.z) < 0.02 && v.x > 0.99,
  `dir (${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`,
);
SunSky.sunDirection(12.0, v);
check(
  'T=12 sun due SOUTH at 60°',
  Math.abs(v.x) < 0.02 && v.z > 0 && Math.abs(Math.asin(v.y) * (180 / Math.PI) - 60.02) < 0.6,
  `alt ${(Math.asin(v.y) * (180 / Math.PI)).toFixed(2)}°, dir (${v.x.toFixed(3)}, _, ${v.z.toFixed(3)})`,
);
SunSky.sunDirection(18.0, v);
check(
  'T=18 sunset due WEST',
  Math.abs(v.z) < 0.02 && v.x < -0.99,
  `dir (${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`,
);

// --- 4. rendered shadow vector (optional; needs dev server) ----------------------
async function shadowTest(): Promise<void> {
  const { launchWebGPU, akhetUrl } = await import('./launch');
  const sharp = (await import('sharp')).default;
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  // T=10: sun SE at ~44° alt → shadow points NW; measure its screen angle.
  // 1500 m altitude: high enough to frame the shadow, low enough that the
  // CSM cascades still cover the ground plane.
  const url = akhetUrl({ scene: 'world', T: 10, cam: '0,700,0,0,-1.5708', hud: false });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );
  await page.evaluate(async () => window.__akhet.settle && (await window.__akhet.settle(24)));
  const buf = await page.screenshot();
  await browser.close();
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  // top-down 1024² at 2600 m, fov 55 → world-per-px = 2·2600·tan(27.5°)/1024
  const mpp = (2 * 700 * Math.tan((27.5 * Math.PI) / 180)) / 1024;
  const cxPx = 512;
  const cyPx = 512;
  const basePx = 115.2 / mpp;
  // RELATIVE threshold: the no-black-shadows law keeps shadowed ground
  // bright — absolute cutoffs find nothing. Median-luminance ratio instead.
  const lums = new Float32Array((info.width * info.height) / 4);
  let li = 0;
  const lumAt = (x: number, y: number): number => {
    const i = (y * info.width + x) * info.channels;
    return 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
  };
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x += 2) lums[li++] = lumAt(x, y);
  }
  void li;
  void lums;
  // SECTOR method: absolute thresholds fail (sky fill keeps top-down
  // shadows bright). The darkest 5°-sector mean in the shadow-reach
  // annulus IS the shadow direction — contrast-independent.
  const SEC = 72;
  const sum = new Float64Array(SEC);
  const num = new Float64Array(SEC);
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x += 2) {
      const dx = x - cxPx;
      const dy = y - cyPx;
      const distPx = Math.hypot(dx, dy);
      if (distPx < basePx * 1.2 || distPx > basePx * 2.4) continue;
      // az from north (up), clockwise
      const az = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
      const si = Math.floor(az / (360 / SEC)) % SEC;
      sum[si] = (sum[si] ?? 0) + lumAt(x, y);
      num[si] = (num[si] ?? 0) + 1;
    }
  }
  const means = Array.from({ length: SEC }, (_, i) =>
    (num[i] ?? 0) > 4 ? (sum[i] ?? 0) / (num[i] ?? 1) : Infinity,
  );
  // smooth over 3 sectors, find the minimum
  let bestI = 0;
  let bestV = Infinity;
  for (let i = 0; i < SEC; i++) {
    const m =
      ((means[(i + SEC - 1) % SEC] ?? Infinity) +
        (means[i] ?? Infinity) * 2 +
        (means[(i + 1) % SEC] ?? Infinity)) /
      4;
    if (m < bestV) {
      bestV = m;
      bestI = i;
    }
  }
  const got = (bestI + 0.5) * (360 / SEC);
  SunSky.sunDirection(10, v);
  const sunAz = ((Math.atan2(v.x, -v.z) * 180) / Math.PI + 360) % 360;
  const expected = (sunAz + 180) % 360;
  let diff = Math.abs(got - expected);
  if (diff > 180) diff = 360 - diff;
  console.log(`  sector scan: darkest ${got.toFixed(1)}° (mean ${bestV.toFixed(1)})`);
  check(
    'rendered shadow vector matches solar azimuth',
    diff < 7.0,
    `shadow az ${got.toFixed(1)}° vs expected ${expected.toFixed(1)}° (Δ ${diff.toFixed(1)}°)`,
  );
}

/** boot the world headless and gate on the footprint collision audit —
 *  overlaps, floating and buried structures, stranded hulls */
async function collisionTest(): Promise<void> {
  const { launchWebGPU, akhetUrl } = await import('./launch');
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('console', (msg) => {
    if (msg.text().startsWith('[akhet] collision')) console.log(`  ${msg.text()}`);
  });
  await page.goto(akhetUrl({ scene: 'world', hud: false }), {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );
  const issues = await page.evaluate(() =>
    window.__akhet.collisionAudit ? window.__akhet.collisionAudit() : null,
  );
  await browser.close();
  if (issues === null) {
    check('collision audit hook present', false, 'collisionAudit hook missing');
    return;
  }
  for (const it of issues.slice(0, 12)) {
    console.log(
      `  ${it.kind}: ${it.a}${it.b ? ` × ${it.b}` : ''} depth ${it.depth.toFixed(2)} at (${it.x.toFixed(0)}, ${it.z.toFixed(0)})`,
    );
  }
  check(
    'footprint collision audit clean',
    issues.length === 0,
    `${issues.length} issue(s): overlaps / floating / buried / stranded hulls`,
  );
}

const wantShadow = process.argv.includes('--shadow');
const skipWorld = process.argv.includes('--fast');
(skipWorld ? Promise.resolve() : collisionTest())
  .then(() => (wantShadow ? shadowTest() : Promise.resolve()))
  .then(() => {
    console.log(failures === 0 ? '\nAUDIT PASSED' : `\nAUDIT FAILED (${failures})`);
    process.exit(failures === 0 ? 0 : 1);
  });
