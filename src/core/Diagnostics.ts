/**
 * WebGPU capability probe + fail-loud reporting.
 * Brief §1: no WebGL fallback. If WebGPU is unavailable we stop and explain.
 * Ported from PROJECT LAAS (MIT) — see LICENSE-THIRD-PARTY.
 */

import type { GpuDiagnostics } from './Hooks';

const INTERESTING_LIMITS: readonly (keyof GPUSupportedLimits & string)[] = [
  'maxTextureDimension2D',
  'maxTextureDimension3D',
  'maxTextureArrayLayers',
  'maxBindGroups',
  'maxStorageBufferBindingSize',
  'maxBufferSize',
  'maxComputeWorkgroupSizeX',
  'maxComputeWorkgroupsPerDimension',
  'maxComputeInvocationsPerWorkgroup',
  'maxColorAttachments',
  'maxStorageBuffersPerShaderStage',
  'maxStorageTexturesPerShaderStage',
  'maxSampledTexturesPerShaderStage',
  'maxUniformBuffersPerShaderStage',
];

/**
 * Limits we ask the device for (clamped to what the adapter reports).
 * Compute passes bind many storage buffers — the default 8 is not enough.
 */
export function buildRequiredLimits(d: GpuDiagnostics): Record<string, number> {
  const want: Record<string, number> = {
    maxStorageBuffersPerShaderStage: 16,
    maxStorageTexturesPerShaderStage: 8,
    maxBufferSize: 1 << 30,
    maxStorageBufferBindingSize: 1 << 30,
  };
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(want)) {
    const adapterMax = d.limits[k];
    if (adapterMax !== undefined) out[k] = Math.min(v, adapterMax);
  }
  return out;
}

export async function probeWebGPU(): Promise<GpuDiagnostics> {
  if (!('gpu' in navigator) || !navigator.gpu) {
    return {
      ok: false,
      reason: 'navigator.gpu is missing — this browser has no WebGPU. Use Chrome 113+ / Edge.',
      features: [],
      limits: {},
    };
  }
  let adapter: GPUAdapter | null = null;
  try {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch (e) {
    return {
      ok: false,
      reason: `requestAdapter threw: ${e instanceof Error ? e.message : String(e)}`,
      features: [],
      limits: {},
    };
  }
  if (!adapter) {
    return {
      ok: false,
      reason:
        'requestAdapter returned null — WebGPU present but no adapter. If headless, check launch flags (e.g. --enable-unsafe-webgpu, ANGLE backend). On Optimus laptops ensure the browser uses the discrete GPU.',
      features: [],
      limits: {},
    };
  }
  const limits: Record<string, number> = {};
  for (const k of INTERESTING_LIMITS) {
    const v = adapter.limits[k];
    if (typeof v === 'number') limits[k] = v;
  }
  const info = adapter.info;
  return {
    ok: true,
    vendor: info?.vendor ?? 'unknown',
    architecture: info?.architecture ?? 'unknown',
    device: info?.device ?? 'unknown',
    description: info?.description ?? '',
    features: [...adapter.features].map(String).sort(),
    limits,
  };
}

/**
 * How to make a Windows machine hand the browser its discrete GPU. Chrome
 * IGNORES `powerPreference: 'high-performance'` on Windows (crbug 369219127),
 * and there is nothing a page can do about it from script — so the honest fix
 * is to tell the user exactly which switch to flip, on screen, where they will
 * actually see it.
 */
export const DISCRETE_GPU_STEPS = [
  'Windows: Settings → System → Display → Graphics → browse for your browser',
  '        → Options → High performance → Save, then restart the browser.',
  'NVIDIA: Control Panel → Manage 3D settings → Program Settings → add the',
  '        browser → "High-performance NVIDIA processor".',
  'Or launch the browser once with:  --force_high_performance_gpu',
];

/**
 * Non-fatal on-screen notice. The iGPU fallback used to be a console warning
 * nobody reads: the app just silently ran at a third of the frame rate on the
 * wrong adapter.
 */
export function showNotice(title: string, lines: string[]): void {
  const el = document.createElement('div');
  el.id = 'akhet-notice';
  el.style.cssText = [
    'position:fixed', 'left:12px', 'bottom:12px', 'z-index:9998',
    'max-width:min(560px,calc(100vw - 24px))', 'background:rgba(24,20,14,0.94)',
    'border:1px solid #6b5a33', 'border-radius:6px', 'color:#e8d9b5',
    'font-family:ui-monospace,Menlo,monospace', 'font-size:12px',
    'line-height:1.55', 'padding:12px 14px', 'white-space:pre-wrap',
    'box-shadow:0 6px 24px rgba(0,0,0,0.5)',
  ].join(';');
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = 'color:#ffd479;font-weight:bold;margin-bottom:6px';
  el.appendChild(h);
  const body = document.createElement('div');
  body.textContent = lines.join('\n');
  el.appendChild(body);
  const close = document.createElement('button');
  close.textContent = 'dismiss';
  close.style.cssText = [
    'margin-top:9px', 'background:#3a3120', 'color:#e8d9b5',
    'border:1px solid #6b5a33', 'border-radius:4px', 'padding:3px 10px',
    'font:inherit', 'cursor:pointer',
  ].join(';');
  close.addEventListener('click', () => el.remove());
  el.appendChild(close);
  document.body.appendChild(el);
}

/**
 * A lost WebGPU device is the difference between "the app crashed" and "the
 * screen just went black". Without this handler the render loop simply stops
 * producing frames and the canvas stays on its last contents — which on
 * Windows, after a driver reset (TDR), reads to the user as the MONITOR going
 * black and never coming back.
 */
export const SAFE_FLAG = 'akhet.deviceLost';

/** URL for the current page with the safe preset forced on */
export function safeModeUrl(): string {
  const u = new URL(window.location.href);
  u.searchParams.set('preset', 'safe');
  u.searchParams.delete('force');
  return u.toString();
}

export function installDeviceLostHandler(device: GPUDevice, vendor?: string): void {
  void device.lost.then((info: GPUDeviceLostInfo) => {
    if (info.reason === 'destroyed') return; // ordinary teardown
    // remember it: the NEXT load starts in safe mode by itself. A user whose
    // driver just reset should not have to read an overlay and edit a URL to
    // get a working session — the app already knows what happened.
    try {
      window.localStorage.setItem(SAFE_FLAG, String(Date.now()));
    } catch {
      /* private mode / storage disabled — the overlay button still works */
    }
    const onIntel = (vendor ?? '').toLowerCase().includes('intel');
    failLoud('WebGPU device lost', [
      `reason: ${info.reason || 'unknown'} — ${info.message || 'no message'}`,
      '',
      'The GPU driver reset while the scene was building or rendering. On',
      'Windows this is TDR: a single GPU job ran past the ~2 s watchdog, so',
      'the display driver restarted (the monitor blanks for a moment) and',
      'every WebGPU resource went with it.',
      '',
      'RELOADING NOW WILL START IN SAFE MODE (smaller bakes, fewer',
      'instances, no volumetrics, half render scale) — that is the button',
      'below, and it is also what happens automatically on the next load.',
      '',
      ...(onIntel
        ? [
            `This session was running on the INTEGRATED GPU (${vendor ?? '?'}),`,
            'which is where this almost always happens. For full quality, move',
            'the browser to the discrete GPU:',
            '',
            ...DISCRETE_GPU_STEPS,
          ]
        : [
            'If it repeats even in safe mode, check for a pending graphics-',
            'driver update.',
          ]),
    ], { label: 'Reload in safe mode', href: safeModeUrl() });
  });
}

let failShown = false;

/** Render an unmissable full-screen failure overlay and record it on hooks. */
export function failLoud(
  title: string,
  details: string[],
  action?: { label: string; href: string },
): void {
  if (window.__akhet) window.__akhet.error = `${title}\n${details.join('\n')}`;
  // eslint-disable-next-line no-console
  console.error('[AKHET FATAL]', title, details);
  if (failShown) return;
  failShown = true;

  const boot = document.getElementById('boot');
  if (boot) boot.style.display = 'none';

  const el = document.createElement('div');
  el.id = 'akhet-fatal';
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999', 'background:#140b0b',
    'color:#ff9d9d', 'font-family:ui-monospace,Menlo,monospace', 'padding:48px',
    'overflow:auto', 'white-space:pre-wrap', 'line-height:1.5',
  ].join(';');
  const h = document.createElement('div');
  h.textContent = `✕ ${title}`;
  h.style.cssText = 'font-size:24px;color:#ff5c5c;margin-bottom:20px;font-weight:bold';
  el.appendChild(h);
  const body = document.createElement('div');
  body.style.cssText = 'font-size:13px;color:#e0b0b0';
  body.textContent = details.join('\n');
  el.appendChild(body);
  if (action) {
    // a fatal overlay that only explains is half a fix — give the user the
    // working configuration in one click
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.style.cssText = [
      'margin-top:22px', 'background:#4a1f1f', 'color:#ffd7d7',
      'border:1px solid #a05252', 'border-radius:5px', 'padding:9px 18px',
      'font:inherit', 'font-size:14px', 'cursor:pointer',
    ].join(';');
    btn.addEventListener('click', () => {
      window.location.href = action.href;
    });
    el.appendChild(btn);
  }
  document.body.appendChild(el);
}

/** Route uncaught errors to the overlay so failures are never silent. */
export function installGlobalErrorHooks(): void {
  window.addEventListener('error', (ev) => {
    failLoud('Uncaught error', [String(ev.message), ev.filename ? `at ${ev.filename}:${ev.lineno}` : '']);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r: unknown = ev.reason;
    const msg = r instanceof Error ? `${r.message}\n${r.stack ?? ''}` : String(r);
    failLoud('Unhandled rejection', [msg]);
  });
}

export function describeDiagnostics(d: GpuDiagnostics): string[] {
  return [
    `adapter: ${d.vendor ?? '?'} / ${d.architecture ?? '?'} ${d.description ? `(${d.description})` : ''}`,
    `features: ${d.features.join(', ') || 'none reported'}`,
    ...Object.entries(d.limits).map(([k, v]) => `  ${k} = ${v}`),
  ];
}
