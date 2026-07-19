/**
 * In-browser placement Inspector + collision overlay (the "Unity-lite" the
 * fixed-layout pillar allows): click a structure to select its footprint,
 * nudge it with the arrow keys (world axes), the affected builders rebuild
 * live, and the collision audit re-runs after every move. Edits are DELTAS
 * over the canonical placements — exported as a patch (X key) to be applied
 * to CANON_DIMENSIONS / builder constants; nothing persists in the scene.
 *
 *   E      — toggle edit mode (or boot with ?edit=1)
 *   click  — select footprint under cursor (red = collision issue)
 *   arrows — move ±1 m (Shift ×5, Alt ×0.2) along world X/Z
 *   R      — reset selected delta      X — export patch (console+clipboard)
 *   Esc    — deselect
 *
 * Collision overlay alone (no editing) is available via ?debug=collisions.
 */

import {
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Raycaster,
  Vector2,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import type { Heightfield } from '../world/Heightfield';
import { runCollisionAudit, type CollisionIssue } from './CollisionAudit';
import { edDeltas, edExport, edLoad, edNudge, edReset } from './EditOverrides';
import { fpAabb, fpAll, type Footprint } from './Footprints';

export interface InspectorOpts {
  scene: Scene;
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
  hf: Heightfield;
  /** rebuild all structure builders with current overrides applied */
  rebuild: () => void;
}

export class Inspector {
  issues: CollisionIssue[] = [];
  private enabled = false;
  private selectedId: string | null = null;
  private readonly overlay = new Group();
  private readonly highlight: LineSegments;
  private readonly panel: HTMLDivElement;
  private readonly o: InspectorOpts;
  private readonly ray = new Raycaster();

  constructor(o: InspectorOpts) {
    this.o = o;
    edLoad();
    this.overlay.renderOrder = 999;
    o.scene.add(this.overlay);
    this.highlight = new LineSegments(
      new EdgesGeometry(new BoxGeometry(1, 1, 1)),
      new LineBasicMaterial({ color: 0x33ff88, depthTest: false }),
    );
    this.highlight.visible = false;
    this.highlight.renderOrder = 1000;
    o.scene.add(this.highlight);

    this.panel = document.createElement('div');
    this.panel.style.cssText =
      'position:fixed;left:10px;bottom:10px;z-index:30;font:12px/1.5 monospace;' +
      'color:#dcd6c8;background:rgba(20,18,14,0.82);padding:8px 12px;' +
      'border:1px solid #5a5244;border-radius:4px;white-space:pre;display:none;' +
      'pointer-events:none;max-width:44em';
    document.body.appendChild(this.panel);

    window.addEventListener('keydown', (e) => this.onKey(e), { capture: true });
    o.canvas.addEventListener('pointerdown', (e) => this.onClick(e));

    const q = new URLSearchParams(window.location.search);
    if (q.get('edit') === '1') this.setEnabled(true);
    if (q.get('debug') === 'collisions') this.overlay.visible = true;
  }

  /** run the audit, refresh the overlay boxes, log a summary */
  audit(): CollisionIssue[] {
    this.issues = runCollisionAudit(this.o.hf);
    for (const c of [...this.overlay.children]) {
      this.overlay.remove(c);
      (c as LineSegments).geometry.dispose();
    }
    for (const it of this.issues) {
      const f = fpAll().find((p) => p.id === it.a);
      const size = f ? { x: f.hx * 2, y: f.y1 - f.y0, z: f.hz * 2 } : { x: 4, y: 4, z: 4 };
      const box = new LineSegments(
        new EdgesGeometry(new BoxGeometry(size.x, Math.max(size.y, 0.5), size.z)),
        new LineBasicMaterial({
          color: it.kind === 'overlap' ? 0xff3333 : 0xffcc22,
          depthTest: false,
        }),
      );
      box.position.set(it.x, (f ? (f.y0 + f.y1) / 2 : it.y), it.z);
      if (f?.yaw) box.rotation.y = -f.yaw;
      box.renderOrder = 999;
      this.overlay.add(box);
    }
    if (this.issues.length > 0) {
      console.warn(`[akhet] collision audit: ${this.issues.length} issue(s)`);
      console.table(
        this.issues.map((i) => ({
          kind: i.kind, a: i.a, b: i.b ?? '', depth: i.depth.toFixed(2),
          at: `${i.x.toFixed(0)},${i.z.toFixed(0)}`,
        })),
      );
    } else {
      console.log('[akhet] collision audit: clean');
    }
    this.refreshPanel();
    return this.issues;
  }

  /** harness hook: nudge by id without pointer interaction */
  nudge(id: string, dx: number, dz: number): void {
    edNudge(id, dx, dz);
    this.o.rebuild();
    this.audit();
    this.refreshPanel();
  }

  exportPatch(): string {
    const patch = edExport();
    console.log(patch);
    void navigator.clipboard?.writeText(patch).catch(() => undefined);
    return patch;
  }

  private setEnabled(on: boolean): void {
    this.enabled = on;
    this.overlay.visible = on || new URLSearchParams(window.location.search).get('debug') === 'collisions';
    this.panel.style.display = on ? 'block' : 'none';
    if (!on) this.select(null);
    this.refreshPanel();
  }

  private select(id: string | null): void {
    this.selectedId = id;
    const f = id ? fpAll().find((p) => p.id === id) : undefined;
    if (f) {
      this.highlight.visible = true;
      this.highlight.scale.set(f.hx * 2, f.y1 - f.y0, f.hz * 2);
      this.highlight.position.set(f.x, (f.y0 + f.y1) / 2, f.z);
      this.highlight.rotation.y = -(f.yaw ?? 0);
    } else {
      this.highlight.visible = false;
    }
    this.refreshPanel();
  }

  private onClick(e: PointerEvent): void {
    if (!this.enabled || e.button !== 0) return;
    const r = this.o.canvas.getBoundingClientRect();
    const ndc = new Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.o.camera);
    const ro = this.ray.ray.origin;
    const rd = this.ray.ray.direction;
    let best: { f: Footprint; t: number } | null = null;
    for (const f of fpAll()) {
      const bb = fpAabb(f);
      // slab test against the footprint's world AABB
      let t0 = 0;
      let t1 = Infinity;
      let ok = true;
      for (const [o, d, lo, hi] of [
        [ro.x, rd.x, bb.x0, bb.x1],
        [ro.y, rd.y, f.y0, f.y1],
        [ro.z, rd.z, bb.z0, bb.z1],
      ] as const) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) { ok = false; break; }
          continue;
        }
        const a = (lo - o) / d;
        const b = (hi - o) / d;
        t0 = Math.max(t0, Math.min(a, b));
        t1 = Math.min(t1, Math.max(a, b));
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < (best?.t ?? Infinity)) best = { f, t: t0 };
    }
    this.select(best ? best.f.id : null);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'KeyE' && !e.repeat) {
      this.setEnabled(!this.enabled);
      return;
    }
    if (!this.enabled) return;
    const consume = (): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    if (e.code === 'Escape') { this.select(null); consume(); return; }
    if (e.code === 'KeyX') { this.exportPatch(); consume(); return; }
    const sel = this.selectedId ? fpAll().find((p) => p.id === this.selectedId) : undefined;
    if (!sel) return;
    const target = sel.editGroup ?? (sel.editable ? sel.id : null);
    if (e.code === 'KeyR') {
      if (target) {
        edReset(target);
        this.o.rebuild();
        this.audit();
        this.select(this.selectedId);
      }
      consume();
      return;
    }
    const step = e.shiftKey ? 5 : e.altKey ? 0.2 : 1;
    const move: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    const m = move[e.code];
    if (!m) return;
    consume();
    if (!target) {
      this.refreshPanel('(not editable — derived placement)');
      return;
    }
    edNudge(target, m[0], m[1]);
    this.o.rebuild();
    this.audit();
    this.select(this.selectedId); // re-resolve at the new position
  }

  private refreshPanel(note = ''): void {
    if (!this.enabled) return;
    const sel = this.selectedId ? fpAll().find((p) => p.id === this.selectedId) : undefined;
    const deltas = edDeltas();
    const target = sel ? (sel.editGroup ?? (sel.editable ? sel.id : null)) : null;
    const d = target ? deltas[target] : undefined;
    const lines = [
      `EDIT MODE   issues: ${this.issues.length}`,
      sel
        ? `sel: ${sel.id}${target && target !== sel.id ? ` → ${target}` : ''}` +
          `  (${sel.x.toFixed(1)}, ${sel.z.toFixed(1)})` +
          (d ? `  Δ(${d.dx.toFixed(1)}, ${d.dz.toFixed(1)})` : '') +
          (target ? '' : '  [read-only]')
        : 'click a structure to select',
      'arrows move · Shift ×5 · Alt ×0.2 · R reset · X export patch · E exit',
    ];
    if (note) lines.push(note);
    const pending = Object.keys(deltas).length;
    if (pending > 0) lines.push(`pending deltas: ${pending} (X to export)`);
    this.panel.textContent = lines.join('\n');
  }
}
