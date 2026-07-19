/**
 * AKHET entry point — boot sequence:
 * hooks → params → WebGPU probe (fail loud) → engine → scene → camera → HUD →
 * frame loop → ready. Every failure path lands in the fatal overlay AND
 * window.__akhet.error so the harness never waits on a silent black frame.
 */

import { describeDiagnostics, failLoud, installGlobalErrorHooks, probeWebGPU } from './core/Diagnostics';
import { Engine } from './core/Engine';
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
    if (params.dpr === null) params.dpr = 1;
    // eslint-disable-next-line no-console
    console.warn(
      '[akhet] Running on the INTEGRATED GPU — reduced preset engaged. ' +
        'For full quality: Windows Settings > System > Display > Graphics > ' +
        'add your browser > High performance.',
    );
  }

  progress(0.12, 'creating renderer');
  const engine = await Engine.create(params, hooks);
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
