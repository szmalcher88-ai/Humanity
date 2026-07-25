/**
 * Adapter speed benchmark — pick the preset by what the GPU can DO, not by
 * what it calls itself.
 *
 * The reduced preset used to be selected from `adapter.info.vendor`
 * containing "intel". That works right up until the vendor string is empty,
 * masked, or reported differently — and then a slow adapter runs the FULL
 * preset, a frame takes seconds, Windows' watchdog resets the display driver
 * (DXGI_ERROR_DEVICE_HUNG), and the user gets a black screen a few seconds
 * after launch. Reproduced exactly that way with `?preset=high` on the Intel
 * UHD: boot completes, then the device hangs during rendering.
 *
 * So: run a small, fixed compute workload and time it. An RTX 3050 finishes
 * it in a couple of milliseconds; an Intel UHD takes tens. The number decides
 * the preset, and the vendor string is only a hint that gets logged.
 */

import type { Renderer } from 'three/webgpu';
import { Fn, If, Return, float, instanceIndex, instancedArray, vec2 } from 'three/tsl';
import { fbm2 } from '../gpu/noise/NoiseTSL';
import { gpuSync } from '../gpu/Banded';

/** two probe sizes — the DIFFERENCE between them is the measurement */
const N_SMALL = 1 << 18; // 262,144
const N_LARGE = 1 << 21; // 2,097,152

/**
 * Per-invocation cost above which the adapter cannot carry the full preset,
 * in nanoseconds. MEASURED on this machine: RTX 3050 Laptop **0.8 ns**, Intel
 * UHD gen-12lp **6.9 ns** — an 8.6× separation, which is what makes this a
 * usable gate at all. The threshold sits between them and nearer the fast
 * side on purpose: the failure it prevents is a system-wide display driver
 * reset, so an adapter more than ~4× slower than the dev GPU takes the
 * reduced preset and can opt back in with ?force=1.
 */
export const SLOW_NS = 3;

export interface BenchResult {
  /** ns per invocation, fixed submission overhead removed */
  ns: number;
  /** raw ms for the large probe, for the log line */
  ms: number;
  /** the preset this adapter can actually carry */
  preset: 'low' | 'high';
}

/**
 * Time the SAME kernel at two sizes and take the slope. A single timing is
 * useless here: submission and fence latency are a fixed few milliseconds on
 * every adapter, and at the small size they swamped the actual work — the
 * first version of this probe reported 3.0 ms on an RTX 3050 and 6.4 ms on an
 * Intel UHD, a 2× spread for GPUs an order of magnitude apart. Differencing
 * two sizes cancels the constant and leaves throughput.
 */
export async function benchmarkAdapter(renderer: Renderer): Promise<BenchResult> {
  const time = async (n: number): Promise<number> => {
    const out = instancedArray(n, 'float');
    const kernel = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(n), () => {
        Return();
      });
      const p = vec2(float(i).mod(512), float(i).div(512)).mul(0.017);
      const v = fbm2(p, 4)
        .add(fbm2(p.add(vec2(11.3, 7.7)), 4))
        .add(fbm2(p.mul(2.1), 4));
      out.element(i).assign(v);
    })().compute(n);
    kernel.setName(`adapterBench_${n}`);
    // NOTE: computeAsync does not wait for the GPU (see gpuSync) — timing it
    // alone measured CPU submit and called an Intel UHD a 0.3 ms adapter.
    await renderer.computeAsync(kernel); // warm: pipeline + allocation
    await gpuSync(renderer);
    const t0 = performance.now();
    await renderer.computeAsync(kernel);
    await gpuSync(renderer);
    return performance.now() - t0;
  };

  const tSmall = await time(N_SMALL);
  const tLarge = await time(N_LARGE);
  const ns = Math.max(0, ((tLarge - tSmall) * 1e6) / (N_LARGE - N_SMALL));
  return { ns, ms: tLarge, preset: ns > SLOW_NS ? 'low' : 'high' };
}
