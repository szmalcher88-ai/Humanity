/**
 * Diagnostics HUD. DEFAULT: a minimal FPS chip only — the full debug panel
 * (per-pass GPU timings, counters, providers) toggles with F3 (?hud=1 boots
 * with it open for tooling shots). Subsystems contribute line providers;
 * re-renders at 4 Hz. Floor checks read `window.__akhet.stats` directly —
 * the HUD is for humans. Ported from PROJECT LAAS (MIT).
 */

import type { Engine } from '../core/Engine';
import type { AkhetParams } from '../core/Params';

export type HudProvider = () => string[];

export class Hud {
  private el: HTMLDivElement;
  private fpsEl: HTMLDivElement;
  private providers: HudProvider[] = [];
  private visible: boolean;
  private engine: Engine;
  private params: AkhetParams;
  private acc = 0;

  constructor(engine: Engine, params: AkhetParams) {
    this.engine = engine;
    this.params = params;
    this.visible = params.hud;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.style.cssText = [
      'position:fixed', 'top:10px', 'left:10px', 'z-index:1000',
      'color:#e8dfc8', 'background:rgba(14,11,8,0.66)', 'padding:10px 12px',
      'font:11px/1.45 ui-monospace,Menlo,monospace', 'white-space:pre',
      'pointer-events:none', 'border-radius:4px', 'max-height:90vh', 'overflow:hidden',
    ].join(';');
    document.body.appendChild(this.el);

    this.fpsEl = document.createElement('div');
    this.fpsEl.id = 'hud-fps';
    this.fpsEl.style.cssText = [
      'position:fixed', 'top:10px', 'left:10px', 'z-index:1000',
      'color:#e8dfc8', 'background:rgba(14,11,8,0.5)', 'padding:3px 8px',
      'font:12px/1.2 ui-monospace,Menlo,monospace', 'white-space:pre',
      'pointer-events:none', 'border-radius:4px',
    ].join(';');
    document.body.appendChild(this.fpsEl);
    this.applyVisibility();

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.visible = !this.visible;
        this.applyVisibility();
      }
    });

    // adapter tag on the always-on chip: on Optimus laptops the browser
    // silently lands on the Intel iGPU (2 fps vs 50) — make it VISIBLE
    const vendor = (engine.hooks.diag?.vendor ?? '?').split(' ')[0];
    const igpu = vendor?.toLowerCase().includes('intel') ?? false;
    engine.onUpdate((dt) => {
      this.acc += dt;
      if (this.acc >= 0.25) {
        this.acc = 0;
        if (this.visible) this.render();
        else {
          const fps = this.engine.stats.fps;
          let line = `${fps.toFixed(0)} fps · ${vendor}${this.params.preset === 'low' ? ' · low' : ''}`;
          if (igpu && fps < 24) {
            line +=
              '\n⚠ integrated GPU — set your browser to' +
              '\n"High performance" in Windows Graphics settings';
          }
          this.fpsEl.textContent = line;
        }
      }
    });
  }

  private applyVisibility(): void {
    this.el.style.display = this.visible ? 'block' : 'none';
    this.fpsEl.style.display = this.visible ? 'none' : 'block';
  }

  addProvider(p: HudProvider): void {
    this.providers.push(p);
  }

  private render(): void {
    const s = this.engine.stats;
    const c = this.engine.camera.position;
    const fmt = (n: number): string => n.toLocaleString('en-US');
    const lines: string[] = [
      `AKHET  seed=${this.params.seed} scene=${this.params.scene} T=${this.params.timeOfDay}`,
      `${s.fps.toFixed(0)} fps  ${s.frameMs.toFixed(2)} ms (p95 ${s.frameMsP95.toFixed(2)})`,
      `draws ${fmt(s.drawCalls)}  tris ${fmt(s.triangles)}`,
      `gpu render ${s.gpuPasses['render']?.toFixed(2) ?? '–'} ms  compute ${s.gpuPasses['compute']?.toFixed(2) ?? '–'} ms`,
      `cam ${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}`,
    ];
    const passes = Object.entries(s.gpuPasses)
      .filter(([k, v]) => (k.startsWith('r.') || k.startsWith('c.')) && v >= 0.005)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16);
    if (passes.length > 0) {
      lines.push('—');
      for (const [k, v] of passes) lines.push(`${v.toFixed(2).padStart(6)} ${k}`);
    }
    const counterKeys = Object.keys(s.counters);
    if (counterKeys.length > 0) {
      lines.push('—');
      for (const k of counterKeys.sort()) lines.push(`${k}: ${fmt(s.counters[k] ?? 0)}`);
    }
    for (const p of this.providers) lines.push('—', ...p());
    lines.push('—', 'F3 hud · 1-9 bookmarks · F flythrough · P pose');
    this.el.textContent = lines.join('\n');
  }
}
