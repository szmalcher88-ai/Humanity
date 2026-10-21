/**
 * Dimension & alignment audit (brief §7.2) — machine-checks the monument
 * math against CANON_DIMENSIONS and the sun path against true cardinal
 * directions, then (optionally, --shadow) measures the RENDERED shadow
 * direction of the Great Pyramid from a top-down screenshot.
 *
 *   npx tsx tools/audit.ts            # spec + sun-path checks (fast, CPU)
 *   npx tsx tools/audit.ts --shadow   # + rendered shadow-vector test
 *   npx tsx tools/audit.ts --epoch KHAFRE_PERIOD   # that epoch's monuments + world
 */

import { Vector3 } from 'three';
import { WorldSeed } from '../src/core/Seed';
import { atLeast, parseEpoch, type Epoch } from '../src/world/Epoch';
import { buildSpec, auditSpec } from '../src/monuments/PyramidSpec';
import {
  G1_BASE_SIDE,
  G1_HEIGHT,
  G1_SLOPE_DEG,
  G1_COURSE_COUNT,
  G1_COURSE1_HEIGHT,
  G1_COURSE_MIN_HEIGHT,
  G2_BASE_SIDE,
  G2_COURSE_COUNT,
  G2_GRANITE_COURSES,
  G2_SLOPE_DEG,
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

// --- 2. the monuments' specs ----------------------------------------------------
// (T2-3) one row per pyramid that has a survey to hold it to, built on the
// WORLD's stream (`monument-<name>`, seed 1 — the default world) and only in
// the epochs that show it: `--epoch KHAFRE_PERIOD` adds G2. (The old
// course-count check was a tautology — the solver always emits exactly
// courseCount rows — it is now: the solved course sum IS the slope's height.)
const ei = process.argv.indexOf('--epoch');
const epochArg = ei > 0 ? process.argv[ei + 1] : undefined;
const epoch = parseEpoch(epochArg ?? null).epoch;
interface Row {
  name: string; base: number; slope: number; survey: number; baseSurvey: number;
  courses: number; c1: number; cMin: number; granite: number; floor: number; from: Epoch;
}
const ROWS: Row[] = [
  {
    name: 'G1', base: G1_BASE_SIDE.value, slope: G1_SLOPE_DEG.value, survey: G1_HEIGHT.value, baseSurvey: 230.363,
    courses: G1_COURSE_COUNT.value, c1: G1_COURSE1_HEIGHT.value, cMin: G1_COURSE_MIN_HEIGHT.value,
    granite: 0, floor: 40000, from: 'KHUFU_EARLY',
  },
  {
    name: 'G2', base: G2_BASE_SIDE.value, slope: G2_SLOPE_DEG.value, survey: 143.5, baseSurvey: 215.25,
    courses: G2_COURSE_COUNT.value, c1: G1_COURSE1_HEIGHT.value, cMin: G1_COURSE_MIN_HEIGHT.value,
    granite: G2_GRANITE_COURSES.value, floor: 45000, from: 'KHAFRE_PERIOD',
  },
];
const seed = new WorldSeed(1);
for (const r of ROWS.filter((x) => atLeast(epoch, x.from))) {
  const h = (r.base / 2) * Math.tan((r.slope * Math.PI) / 180);
  const spec = buildSpec({
    baseSide: r.base, height: h, slopeDeg: r.slope, cx: 0, cy: 0, cz: 0,
    courseCount: r.courses, course1: r.c1, courseMin: r.cMin, graniteCourses: r.granite,
    rng: seed.rng(`monument-${r.name}`),
  });
  const sa = auditSpec(spec);
  check(`${r.name} spec consistency`, sa.ok, sa.notes.join('; ') || `${spec.courses.length} courses`);
  check(`${r.name} base within survey tolerance`, Math.abs(r.base - r.baseSurvey) < 0.01, `${r.base}`);
  check(`${r.name} height within 0.5 m of survey`, Math.abs(h - r.survey) < 0.5, `${h.toFixed(3)} vs ${r.survey}`);
  const last = spec.courses[spec.courses.length - 1];
  const top = last ? last.y0 + last.h : 0;
  check(`${r.name} courses sum to the slope's height`, Math.abs(top - h) < h * 0.005, `${top.toFixed(3)} vs ${h.toFixed(3)}`);
  const c0 = spec.courses[0];
  check(
    `${r.name} first course ≈ ${r.c1} m (post-normalization)`,
    c0 !== undefined && Math.abs(c0.h - r.c1) < 0.35,
    c0 ? c0.h.toFixed(3) : 'missing',
  );
  check(`${r.name} casing stone floor (>${r.floor / 1000}k)`, spec.stones.length > r.floor, `${spec.stones.length}`);
  if (r.granite > 0) {
    const gTop = spec.courses[r.granite]?.y0 ?? 0;
    check(`${r.name} granite band: ${r.granite} course(s)`, gTop > 0.5 && gTop < 2.5 * r.granite, `top ${gTop.toFixed(3)} m`);
  }
}

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
    if (msg.text().startsWith('[akhet] collision') || msg.text().startsWith('[akhet] evidence') || msg.text().startsWith('[akhet] fleet')) console.log(`  ${msg.text()}`);
  });
  // (T2) --epoch KHAFRE_PERIOD audits that epoch's world (default: Khufu's)
  await page.goto(akhetUrl({ scene: 'world', hud: false, ...(epochArg ? { extra: { epoch: epochArg } } : {}) }), {
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
  // (v1.2 I6) harbour evidence tags and the moving fleet's clearance
  const counters = await page.evaluate(() => window.__akhet.stats?.counters ?? {});
  await browser.close();
  check('evidence: every piece tagged (harbour, Sphinx, Khafre)', (counters['evidence.untagged'] ?? 1) === 0, `${counters['evidence.untagged'] ?? '?'} untagged, ${counters['evidence.tagged'] ?? '?'} tagged`);
  check('moving fleet clears the harbour works', (counters['fleet.clashes'] ?? 1) === 0, `${counters['fleet.clashes'] ?? '?'} clash(es)`);
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
