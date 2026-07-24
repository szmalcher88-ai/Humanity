/**
 * Tonal-range instrument for the DELTA loop.
 *
 * The colour-script arguments in this project ("chalky", "washed out", "near
 * white") are unarguable once they are numbers. This prints, for a frame:
 *   - the share of pixels at or near clipping (>250, >245) and crushed (<8)
 *   - mean / median luminance and the 5th–95th percentile spread
 *   - mean RGB + luminance for any number of named sample boxes
 *
 * Usage:
 *   npx tsx tools/levels.ts --in shots/x.png
 *   npx tsx tools/levels.ts --in shots/x.png --box "casing:900,300,1000,420" \
 *       --box "sand:200,800,400,900"
 */

import sharp from 'sharp';

function parseArgs(argv: string[]): { in?: string; box: string[] } {
  const out: { in?: string; box: string[] } = { box: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--in') out.in = argv[++i];
    else if (a === '--box') out.box.push(argv[++i] as string);
  }
  return out;
}

const LUM = (r: number, g: number, b: number): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in) throw new Error('need --in <png>');
  const { data, info } = await sharp(args.in).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  let clip250 = 0;
  let clip245 = 0;
  let crushed = 0;
  const lums: number[] = [];
  for (let i = 0; i < W * H; i++) {
    const o = i * C;
    const r = data[o] as number;
    const g = data[o + 1] as number;
    const b = data[o + 2] as number;
    const mx = Math.max(r, g, b);
    if (mx > 250) clip250++;
    if (mx > 245) clip245++;
    if (mx < 8) crushed++;
    lums.push(LUM(r, g, b));
  }
  lums.sort((a, b) => a - b);
  const N = lums.length;
  const q = (p: number): number => Math.round(lums[Math.floor(N * p)] as number);
  const mean = lums.reduce((a, b) => a + b, 0) / N;
  const pct = (k: number): string => ((k / N) * 100).toFixed(2);
  console.log(
    `[levels] ${args.in} ${W}x${H}\n` +
      `  clip>250 ${pct(clip250)}%  >245 ${pct(clip245)}%  crushed<8 ${pct(crushed)}%\n` +
      `  luminance mean ${mean.toFixed(1)}  p05 ${q(0.05)}  p50 ${q(0.5)}  p95 ${q(0.95)}`,
  );

  for (const spec of args.box) {
    const [name, rest] = spec.split(':');
    const [x0, y0, x1, y1] = (rest ?? '').split(',').map(Number) as number[];
    if ([x0, y0, x1, y1].some((v) => !Number.isFinite(v))) continue;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = y0 as number; y < (y1 as number); y++) {
      for (let x = x0 as number; x < (x1 as number); x++) {
        const o = (y * W + x) * C;
        r += data[o] as number;
        g += data[o + 1] as number;
        b += data[o + 2] as number;
        n++;
      }
    }
    if (n === 0) continue;
    const rm = r / n;
    const gm = g / n;
    const bm = b / n;
    console.log(
      `  ${(name ?? '?').padEnd(12)} rgb(${rm.toFixed(0)},${gm.toFixed(0)},${bm.toFixed(0)})` +
        ` lum ${LUM(rm, gm, bm).toFixed(1)}  sat ${((Math.max(rm, gm, bm) - Math.min(rm, gm, bm)) / Math.max(1, Math.max(rm, gm, bm))).toFixed(3)}`,
    );
  }
}

main().catch((e: unknown) => {
  console.error('[levels] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
