/**
 * Diagnostics HUD. DEFAULT: a minimal FPS chip only — the full debug panel
 * (per-pass GPU timings, counters, providers) toggles with F3 (?hud=1 boots
 * with it open for tooling shots). Subsystems contribute line providers;
 * re-renders at 4 Hz. Floor checks read `window.__akhet.stats` directly —
 * the HUD is for humans. Ported from PROJECT LAAS (MIT).
 */

import type { Engine } from '../core/Engine';
import type { AkhetParams } from '../core/Params';
import { DEFAULT_EPOCH, IMPLEMENTED, type Epoch } from '../world/Epoch';

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
    this.epochMenu();

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

  /** ?clean=1 — no overlays at all (gallery frames, trailer capture) */
  private readonly clean = new URLSearchParams(window.location.search).get('clean') === '1';

  /**
   * The epoch switch (top right): canon IX §9.3's presets as a small menu.
   * The terrain is baked per boot, so a switch RELOADS into the epoch — with
   * the current camera carried over as `?cam=`, so the view stays where it
   * is. Buttons, not a <select>: a focused select takes letter keys (E, A,
   * W … the fly keys) and would switch epochs by accident. Hidden for the
   * tools (`?hud=0`, which every harness URL sets) and gallery frames
   * (`?clean=1`).
   */
  private epochMenu(): void {
    const q0 = new URLSearchParams(window.location.search);
    if (this.clean || q0.get('hud') === '0') return;
    // (T3-3) built = in Epoch's IMPLEMENTED (the one list, no copy to keep)
    const ITEMS: [Epoch, string, boolean][] = ([
      ['KHUFU_EARLY', 'Khufu — the lower courses'],
      ['KHUFU_LATE', 'Khufu — the pyramid rising'],
      ['KHUFU_COMPLETION', 'Khufu — the pyramid completed (default)'],
      ['KHAFRE_PERIOD', 'Khafre — the Sphinx, Khafre’s pyramid'],
      ['MENKAURE_PERIOD', 'Menkaure — Menkaure’s works'],
      ['EVIDENCE_VIEW', 'Evidence view (confidence overlay)'],
    ] as [Epoch, string][]).map(([e, t]) => [e, t, IMPLEMENTED.includes(e)]);
    const current = this.params.epoch;
    const label = (e: Epoch): string => (ITEMS.find(([k]) => k === e)?.[1] ?? e).replace(' (default)', '');
    const box = document.createElement('div');
    box.id = 'hud-epoch';
    box.style.cssText = [
      'position:fixed', 'top:10px', 'right:10px', 'z-index:1001', 'color:#e8dfc8',
      'font:12px/1.3 ui-monospace,Menlo,monospace', 'text-align:right', 'user-select:none',
    ].join(';');
    const style = (b: HTMLElement, active: boolean): void => {
      b.style.cssText = [
        'display:block', 'margin:0 0 2px auto', 'padding:4px 9px', 'border:0', 'border-radius:4px',
        'font:inherit', 'text-align:right', 'cursor:pointer', 'color:#e8dfc8',
        `background:${active ? 'rgba(120,90,40,0.85)' : 'rgba(14,11,8,0.62)'}`,
      ].join(';');
    };
    const head = document.createElement('button');
    head.textContent = `epoch: ${label(current)} ▾`;
    style(head, false);
    const list = document.createElement('div');
    list.style.display = 'none';
    for (const [epoch, text, built] of ITEMS) {
      const b = document.createElement('button');
      b.textContent = text;
      style(b, epoch === current);
      if (!built) {
        b.disabled = true;
        b.style.opacity = '0.45';
        b.style.cursor = 'default';
      }
      b.addEventListener('mousedown', (e) => e.preventDefault()); // never take focus
      b.addEventListener('click', () => {
        if (!built || epoch === current) {
          list.style.display = 'none';
          return;
        }
        const q = new URLSearchParams(window.location.search);
        if (epoch === DEFAULT_EPOCH) q.delete('epoch');
        else q.set('epoch', epoch);
        q.delete('bm'); // a bookmark would move the camera away
        const pose = this.engine.hooks.getPose?.();
        if (pose) q.set('cam', [pose.p[0], pose.p[1], pose.p[2], pose.yaw, pose.pitch].map((n) => n.toFixed(3)).join(','));
        window.location.search = q.toString();
      });
      list.appendChild(b);
    }
    head.addEventListener('mousedown', (e) => e.preventDefault());
    head.addEventListener('click', () => {
      list.style.display = list.style.display === 'none' ? 'block' : 'none';
    });
    box.append(head, list);
    document.body.appendChild(box);
  }

  private applyVisibility(): void {
    this.el.style.display = this.visible ? 'block' : 'none';
    this.fpsEl.style.display = this.visible || this.clean ? 'none' : 'block';
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
    lines.push('—', 'F3 hud · 1-9 bookmarks · F flythrough · P pose · epoch: top right');
    this.el.textContent = lines.join('\n');
  }
}
