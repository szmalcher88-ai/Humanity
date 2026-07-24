/**
 * Numeric frame differ — the regression metric behind every perf/refactor
 * claim in this project ("identical output" has to be measured, not asserted).
 *
 * Usage:
 *   npx tsx tools/diff.ts --a shots/x.png --b shots/y.png [--out shots/d.png]
 *   npx tsx tools/diff.ts --a a.png --b b.png --region "x0,y0,x1,y1"
 *
 * Prints mean |Δ| (0-255), p99, max, and the share of pixels over ±2/±8/±24.
 * TRAA + film grain put a healthy floor of ~0.3-0.8 mean on any two captures
 * of the same frame; treat mean < 1.0 with pct8 < 0.5% as "no visible change".
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    out[a.slice(2)] = next !== undefined && !next.startsWith('--') ? (i++, next) : '1';
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const aPath = args['a'];
  const bPath = args['b'];
  if (!aPath || !bPath) throw new Error('need --a and --b');

  const [a, b] = await Promise.all([
    sharp(aPath).raw().toBuffer({ resolveWithObject: true }),
    sharp(bPath).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    throw new Error(
      `size mismatch: ${a.info.width}x${a.info.height} vs ${b.info.width}x${b.info.height}`,
    );
  }
  const { width: W, height: H, channels: C } = a.info;
  let x0 = 0;
  let y0 = 0;
  let x1 = W;
  let y1 = H;
  const region = args['region'];
  if (region) {
    const p = region.split(',').map(Number);
    [x0, y0, x1, y1] = [p[0] ?? 0, p[1] ?? 0, p[2] ?? W, p[3] ?? H];
  }

  const diffs: number[] = [];
  let sum = 0;
  let max = 0;
  let n2 = 0;
  let n8 = 0;
  let n24 = 0;
  const outBuf = args['out'] ? Buffer.alloc(W * H * 3) : null;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * C;
      const d = Math.max(
        Math.abs((a.data[i] as number) - (b.data[i] as number)),
        Math.abs((a.data[i + 1] as number) - (b.data[i + 1] as number)),
        Math.abs((a.data[i + 2] as number) - (b.data[i + 2] as number)),
      );
      diffs.push(d);
      sum += d;
      if (d > max) max = d;
      if (d > 2) n2++;
      if (d > 8) n8++;
      if (d > 24) n24++;
      if (outBuf) {
        const o = (y * W + x) * 3;
        const v = Math.min(255, d * 8);
        outBuf[o] = v;
        outBuf[o + 1] = d > 24 ? 255 : v;
        outBuf[o + 2] = v;
      }
    }
  }
  const N = diffs.length;
  diffs.sort((p, q) => p - q);
  const pct = (k: number): string => ((k / N) * 100).toFixed(3);
  console.log(
    `[diff] mean=${(sum / N).toFixed(3)} p99=${diffs[Math.floor(N * 0.99)]} max=${max} ` +
      `>2=${pct(n2)}% >8=${pct(n8)}% >24=${pct(n24)}% (${N} px)`,
  );
  const out = args['out'];
  if (outBuf && out) {
    mkdirSync(dirname(out), { recursive: true });
    await sharp(outBuf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(out);
    console.log(`[diff] wrote ${out} (Δ×8, green = Δ>24)`);
  }
}

main().catch((e: unknown) => {
  console.error('[diff] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
