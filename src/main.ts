/**
 * AKHET entry point — boot sequence:
 * hooks → params → WebGPU probe (fail loud) → engine → scene → camera → HUD →
 * frame loop → ready. Every failure path lands in the fatal overlay AND
 * window.__akhet.error so the harness never waits on a silent black frame.
 */

import {
  DISCRETE_GPU_STEPS,
  describeDiagnostics,
  failLoud,
  installGlobalErrorHooks,
  probeWebGPU,
  showNotice,
} from './core/Diagnostics';
import { Engine } from './core/Engine';
import { SLOW_NS, benchmarkAdapter } from './core/GpuBench';
import { FlyCamera } from './core/FlyCamera';
import { initHooks } from './core/Hooks';
import { parseCamString, parseParams } from './core/Params';
import { WorldSeed } from './core/Seed';
import { Hud } from './debug/HUD';
import { resolveScene } from './debug/Scenes';

async function boot(): Promise<void> {
  const hooks = initHooks();
  installGlobalErrorHooks();
  const params = parseParams();

  const bootFill = document.getElementById('boot-fill');
  const bootMsg = document.getElementById('boot-msg');
  const progress = (p: number, msg: string): void => {
    hooks.progress = p;
    hooks.progressMsg = msg;
    if (bootFill) bootFill.style.width = `${Math.round(p * 100)}%`;
    if (bootMsg) bootMsg.textContent = msg;
  };

  progress(0.05, 'probing WebGPU');
  const diag = await probeWebGPU();
  hooks.diag = diag;
  if (!diag.ok) {
    failLoud('WebGPU unavailable', [
      diag.reason ?? 'unknown reason',
      '',
      'AKHET is WebGPU-only by design (no WebGL fallback).',
      'Use a current Chromium browser with hardware acceleration enabled.',
    ]);
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[akhet] WebGPU adapter:', describeDiagnostics(diag).join(' | '));

  // Optimus trap: browsers default to the power-saving iGPU and Windows
  // ignores powerPreference (crbug 369219127). If we landed on Intel and
  // the user didn't pick a preset, drop to the reduced preset (smaller
  // grids and instance counts — never fewer systems) and cap DPR at 1.
  const onIGpu = (diag.vendor ?? '').toLowerCase().includes('intel');
  if (onIGpu && !new URLSearchParams(window.location.search).has('preset')) {
    params.preset = 'low';
    // RENDER SCALE is the single biggest iGPU lever (PERF II): the Intel
    // UHD is fill-bound, not geometry-bound — 43 ms of an 83 ms frame was
    // the forward pass alone at 1600×900. 0.7 halves the shaded pixels and
    // the canvas scales back up; TRAA hides most of the softness.
    if (params.dpr === null) params.dpr = 0.62;
    // eslint-disable-next-line no-console
    console.warn('[akhet] Running on the INTEGRATED GPU — reduced preset engaged.');
    // ON SCREEN, not just in the console: the console warning meant the app
    // silently ran on the wrong adapter at a fraction of the frame rate, and
    // the user had no way to know why it looked and ran the way it did.
    showNotice(`⚠ Running on the integrated GPU (${diag.vendor ?? '?'})`, [
      'Reduced preset engaged. Chrome ignores a page request for the',
      'discrete GPU on Windows (crbug 369219127), so this has to be set',
      'outside the browser:',
      '',
      ...DISCRETE_GPU_STEPS,
      '',
      'Force full quality on this adapter anyway: add ?preset=high to the URL.',
    ]);
  }

  progress(0.12, 'creating renderer');
  const engine = await Engine.create(params, hooks);

  /* --- adapter speed gate ---------------------------------------------------
   * The vendor-string check above is a HINT, not a gate: an adapter that does
   * not say "intel" but performs like one used to get the full preset, take
   * hundreds of ms per frame, and hang the display driver
   * (DXGI_ERROR_DEVICE_HUNG) a few seconds after launch — a black screen with
   * no explanation. Time a fixed workload instead and believe the number.
   *
   * This runs even when ?preset= is explicit. The failure mode here is not a
   * bad frame rate, it is a SYSTEM-LEVEL display driver reset: the monitor
   * blanks and every GPU application on the machine is affected. Reproduced
   * on the Intel UHD with ?preset=high — and the runtime guard below could not
   * save it, because by the time twelve 350 ms frames have gone by the driver
   * is already past the watchdog. So a request that is known to hang the
   * driver is downgraded, loudly, and ?force=1 is there for anyone who means
   * it. */
  {
    const q = new URLSearchParams(window.location.search);
    progress(0.15, 'measuring adapter speed');
    const bench = await benchmarkAdapter(engine.renderer);
    hooks.benchMs = bench.ns;
    // eslint-disable-next-line no-console
    console.log(
      `[akhet] adapter bench: ${bench.ns.toFixed(1)} ns/invocation ` +
        `(${bench.ms.toFixed(1)} ms large probe) → preset ${bench.preset}`,
    );
    const wantsMore = params.preset !== 'low';
    if (bench.preset === 'low' && wantsMore && q.get('force') !== '1') {
      const asked = q.has('preset');
      params.preset = 'low';
      if (params.dpr === null) params.dpr = 0.62;
      if (!onIGpu || asked) {
        showNotice(
          asked
            ? '⚠ preset=high refused on this adapter'
            : '⚠ Slow GPU detected — reduced preset engaged',
          [
            `This adapter costs ${bench.ns.toFixed(0)} ns per GPU invocation on a`,
            `throughput probe; the full preset needs under ${SLOW_NS} ns.`,
            '',
            'At the full preset this adapter produces frames slow enough for',
            "Windows to reset the display driver — the monitor blanks and every",
            'GPU app on the machine is affected. Reduced preset engaged instead.',
            '',
            ...(onIGpu ? DISCRETE_GPU_STEPS : []),
            '',
            'Run it anyway with ?force=1 (it will most likely hang the driver).',
          ],
        );
      }
    }
  }

  const seed = new WorldSeed(params.seed);

  progress(0.2, `building scene '${params.scene}'`);
  const build = await resolveScene(params.scene);
  await build({ engine, seed, progress });

  const fly = new FlyCamera(engine);
  const camOverride = params.cam ? parseCamString(params.cam) : null;
  if (camOverride) {
    fly.setPose(camOverride);
  } else if (hooks.initialPose) {
    fly.setPose(hooks.initialPose);
  } else {
    // keep whatever pose the scene set on the camera; sync rig angles to it
    fly.setPose({
      p: [engine.camera.position.x, engine.camera.position.y, engine.camera.position.z],
      yaw: engine.camera.rotation.y,
      pitch: engine.camera.rotation.x,
    });
  }

  new Hud(engine, params);

  hooks.setPose = (pose): void => fly.setPose(pose);
  hooks.getPose = (): ReturnType<FlyCamera['getPose']> => fly.getPose();
  hooks.settle = (frames?: number): Promise<void> => engine.settle(frames ?? 8);
  hooks.flyCamEnabled = (on): void => fly.setEnabled(on);
  hooks.setWalk = (on): void => {
    if (fly.walk.active !== on) fly.walk.toggle(engine.camera);
  };
  hooks.surfaceProbe = (x, z, feetY): number => fly.walk.surfaceAt(x, z, feetY);
  if (new URLSearchParams(window.location.search).get('walk') === '1') {
    fly.walk.toggle(engine.camera);
  }
  if (!hooks.setTimeOfDay) {
    // scenes with a sky wire their own; fallback stores the value only
    hooks.setTimeOfDay = (t): void => {
      engine.params.timeOfDay = Math.min(24, Math.max(0, t));
    };
  }

  progress(0.95, 'first frames');
  engine.start();
  await engine.settle(4);

  const boot = document.getElementById('boot');
  if (boot) {
    // remove immediately — a slow fade ghosts into harness screenshots
    boot.remove();
  }
  progress(1, 'ready');
  hooks.ready = true;
  // eslint-disable-next-line no-console
  console.log('[akhet] ready', JSON.stringify({ scene: params.scene, seed: params.seed }));
}

boot().catch((err: unknown) => {
  failLoud('Boot failed', [err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)]);
});
