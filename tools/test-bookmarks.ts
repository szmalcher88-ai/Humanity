/** Bookmarks smoke test: boot with ?bm=3, expect the camera at mark 3;
 *  then simulate KeyF and confirm the pose starts moving (flythrough).
 *  v1.1: also every authored mark must stand ABOVE the ground it frames —
 *  bm5/bm6 had sunk 3-4 m under the town when the terrain moved, and a
 *  buried camera renders the world from below (debris "floating" in the sky). */

import { MARKS } from '../src/debug/Bookmarks';
import { akhetUrl, launchWebGPU } from './launch';

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.goto(`${akhetUrl({ scene: 'world', hud: false })}&bm=3`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => window.__akhet && (window.__akhet.ready || window.__akhet.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );
  await page.evaluate(async () => window.__akhet.settle && (await window.__akhet.settle(4)));
  const buried = await page.evaluate(
    (marks) =>
      marks.flatMap((m) => {
        const g = window.__akhet.groundProbe?.(m.p[0], m.p[2]);
        if (!g) return [`${m.name}: no ground probe`];
        const clear = m.p[1] - Math.max(g.ground, g.water);
        return clear < 1.2 ? [`${m.name}: eye ${clear.toFixed(2)} m over ground`] : [];
      }),
    MARKS.map((m) => ({ name: m.name, p: m.p })),
  );
  for (const b of buried) console.log(`buried bookmark — ${b}`);
  const pose1 = await page.evaluate(() => window.__akhet.getPose?.());
  // flythrough: press F, let it run ~1.5 s, pose must have moved
  await page.keyboard.press('KeyF');
  await page.evaluate(async () => window.__akhet.settle && (await window.__akhet.settle(60)));
  const pose2 = await page.evaluate(() => window.__akhet.getPose?.());
  await browser.close();

  console.log('bm3 pose:', JSON.stringify(pose1));
  console.log('fly pose:', JSON.stringify(pose2));
  if (!pose1 || !pose2) throw new Error('getPose missing');
  const atMark =
    Math.abs(pose1.p[0] - 265) < 1 && Math.abs(pose1.p[1] - 7) < 1 &&
    Math.abs(pose1.p[2] - 265) < 1 && Math.abs(pose1.yaw - 0.785) < 0.01;
  const moved =
    Math.hypot(pose2.p[0] - pose1.p[0], pose2.p[2] - pose1.p[2]) > 2;
  const ok = atMark && moved && buried.length === 0;
  console.log(ok ? 'BOOKMARKS TEST PASSED' : 'BOOKMARKS TEST FAILED');
  process.exit(ok ? 0 : 1);
}

void main();
