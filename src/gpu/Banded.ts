/**
 * Banded compute — the fix for "the monitor goes black a few seconds after
 * launch".
 *
 * Windows runs a watchdog on the display driver (TDR): if a single GPU job
 * does not finish inside ~2 seconds, the driver is RESET. The monitor blanks
 * for a moment, every WebGPU resource dies with the device, and the page is
 * left holding its last frame — which reads as the app going black and never
 * coming back.
 *
 * The boot path had several dispatches large enough to trip it on a slow
 * adapter. The worst was the heightfield: ONE dispatch of res² = 16.7M
 * invocations at 4096², each evaluating the whole authored Giza terrain
 * function. That is comfortably a multi-second job on an Intel UHD. (The
 * watchdog times the SUBMIT, not the dispatch, so a batch of medium
 * dispatches submitted together counts as one job too — see SandTransport.)
 *
 * Splitting the same work into bands costs nothing — identical output, same
 * total invocations — and buys three things: no single job long enough to trip
 * the watchdog, the browser stays responsive between bands, and the boot
 * progress bar can move during the long passes.
 *
 * The kernel reads its global index as `bandIndex(uOff)` instead of
 * `instanceIndex`, and the caller runs it once per band.
 */

import type { Renderer } from 'three/webgpu';
import { instanceIndex, uint, uniform } from 'three/tsl';

/**
 * Actually wait for the GPU.
 *
 * `renderer.computeAsync()` is a misnomer in three 0.184: it awaits
 * initialisation and then calls `compute()` — it does NOT wait for the work to
 * finish (Renderer.js:2800), and `waitForGPU()` was removed. So `await
 * computeAsync(...)` in a loop submits every band back-to-back and the driver
 * still sees one unbroken stretch of work; the benchmark that used it measured
 * CPU submit time and cheerfully reported 0.3 ms for an Intel UHD.
 *
 * `queue.onSubmittedWorkDone()` is the real fence.
 */
export async function gpuSync(renderer: Renderer): Promise<void> {
  const device = (renderer as unknown as { backend?: { device?: GPUDevice } }).backend?.device;
  if (device) await device.queue.onSubmittedWorkDone();
}

/** invocations per band — sized so even a weak iGPU finishes well inside TDR.
 *  `?band=N` overrides it, which is how the split is A/B-tested: a band larger
 *  than the total reproduces the original single-dispatch behaviour exactly,
 *  so any pixel difference between the two is a banding bug. */
export const BAND = (() => {
  const q = Number(new URLSearchParams(window.location.search).get('band') ?? NaN);
  return Number.isFinite(q) && q > 0 ? Math.floor(q) : 1 << 19; // 524,288
})();

/**
 * The per-band offset. Kept as a float uniform (the type TSL models cleanly)
 * and converted to uint at the single place it is consumed.
 */
export type BandOffset = ReturnType<typeof uniform>;

export function bandOffset(): BandOffset {
  return uniform(0);
}

/** the kernel's global index: `instanceIndex` shifted into the current band */
export function bandIndex(offset: BandOffset): typeof instanceIndex {
  const n = uint(offset as unknown as Parameters<typeof uint>[0]);
  return instanceIndex.add(n as unknown as number) as unknown as typeof instanceIndex;
}

/**
 * Dispatch `node` once per band of `band` invocations until `total` is
 * covered, awaiting each band so the driver sees short jobs and the event loop
 * gets a turn. `onProgress` receives 0..1 for the boot bar.
 */
export async function runBanded(
  renderer: Renderer,
  node: Parameters<Renderer['computeAsync']>[0],
  offset: BandOffset,
  total: number,
  band = BAND,
  onProgress?: (f: number) => void,
): Promise<void> {
  for (let o = 0; o < total; o += band) {
    (offset as unknown as { value: number }).value = o;
    await renderer.computeAsync(node);
    await gpuSync(renderer); // the band is only a band if we wait for it
    onProgress?.(Math.min(1, (o + band) / total));
  }
}
