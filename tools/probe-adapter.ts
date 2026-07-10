/** Probe which WebGPU adapter each Chromium flag set yields (Optimus check). */
import { chromium } from 'playwright';

const FLAG_SETS: string[][] = [
  [],
  ['--force_high_performance_gpu'],
  ['--gpu-preference=high-performance'],
  ['--use-webgpu-adapter=default'],
  ['--enable-dawn-features=use_dxc'],
  ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
  ['--use-angle=vulkan', '--enable-features=Vulkan'],
];

async function main(): Promise<void> {
  for (const args of FLAG_SETS) {
    let desc = 'launch failed';
    try {
      const browser = await chromium.launch({ headless: true, channel: 'chromium', args });
      const page = await browser.newPage();
      await page.goto('http://localhost:5173/__probe__', { waitUntil: 'domcontentloaded' });
      desc = await page.evaluate(async () => {
        const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
        if (!gpu) return 'no navigator.gpu';
        const a = await gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!a) return 'null adapter';
        return `${a.info?.vendor ?? '?'} / ${a.info?.architecture ?? '?'} ${a.info?.description ?? ''}`;
      });
      await browser.close();
    } catch (e) {
      desc = `error: ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`;
    }
    console.log(`[${args.join(' ') || '(none)'}] → ${desc}`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
