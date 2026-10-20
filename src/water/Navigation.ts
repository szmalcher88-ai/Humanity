/**
 * Navigation for moving vessels (v1.2 I2, canon Vol IX §9.16–9.17, §9.32).
 *
 * A vessel's motion is a TIME TRACK: a list of samples taken every DT
 * seconds of its journey — position, heading and load — that the vertex
 * stage interpolates (Vessels.ts, moving fleet). Everything the canon asks of
 * the movement is decided here, on the CPU, once:
 *   - routes follow the deep water: river lanes are laid on the probed
 *     channel (not the noise-free spline: the meander noise moves the bank by
 *     up to ±40 m), harbour legs are planned by A* over cells deep enough for
 *     the hull and clear of every registered hull, pier and quay;
 *   - turns follow arcs and are smoothed, so no hull rotates on the spot;
 *   - speed comes from the leg (current, wind, propulsion), and a stop is a
 *     run of identical samples — the boat really waits at the landing;
 *   - load changes during a stop (unloading), and the shader reads it to show
 *     the cargo one item at a time and to let the hull rise as it empties.
 * Navigation authority and visual motion are the same data (canon §9.17):
 * what the planner rejected, the hull cannot visually cross.
 */

import type { Heightfield } from '../world/Heightfield';
import { NILE_WATER_Y } from '../world/WorldConst';
import { fpAll } from '../debug/Footprints';

export type P2 = [number, number];

/** seconds between track samples */
export const DT = 2;

export interface TrackPoint {
  x: number;
  z: number;
  /** heading (rad) of hull-local +x: (cos a, sin a) in world x/z, unwrapped */
  a: number;
  /** 1 = full cargo, 0 = empty */
  load: number;
}

/** the Nile's analytic spline (GizaControl.NILE) — only a PRIOR for probing */
const NILE_PRIOR: P2[] = [[2080, -1900], [1960, -1000], [1900, -200], [1950, 600], [2060, 1400], [2180, 2250]];

function priorX(z: number): number {
  for (let i = 0; i + 1 < NILE_PRIOR.length; i++) {
    const a = NILE_PRIOR[i] as P2;
    const b = NILE_PRIOR[i + 1] as P2;
    if (z >= a[1] && z <= b[1]) return a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]);
  }
  return z < -1900 ? 2080 : 2180;
}

/**
 * The probed deep-channel axis every `step` m of z: for each z, the run of
 * samples deeper than `depth` that lies nearest the spline prior, then
 * smoothed. Returns [x, z] points north to south.
 */
export function riverAxis(hf: Heightfield, z0: number, z1: number, step = 40, depth = 3): P2[] {
  const out: P2[] = [];
  let last = priorX(z0);
  for (let z = z0; z <= z1; z += step) {
    const px = priorX(z);
    let best: [number, number] | null = null;
    let runStart = Number.NaN;
    for (let x = px - 240; x <= px + 244; x += 4) {
      const deep = x <= px + 240 && hf.heightAtCpu(x, z) < NILE_WATER_Y - depth;
      if (deep && Number.isNaN(runStart)) runStart = x;
      if (!deep && !Number.isNaN(runStart)) {
        const c = (runStart + x - 4) / 2;
        const wdt = x - 4 - runStart;
        if (wdt > 40 && (!best || Math.abs(c - px) < Math.abs(best[0] - px))) best = [c, wdt];
        runStart = Number.NaN;
      }
    }
    const c = best ? best[0] : last;
    out.push([c, z]);
    last = c;
  }
  // three passes of a 5-tap moving average: lanes curve, they do not zigzag
  for (let pass = 0; pass < 3; pass++) {
    const src = out.map((p) => p[0]);
    for (let i = 0; i < out.length; i++) {
      let s = 0;
      let n = 0;
      for (let k = -2; k <= 2; k++) {
        const v = src[i + k];
        if (v !== undefined) {
          s += v;
          n++;
        }
      }
      (out[i] as P2)[0] = s / n;
    }
  }
  return out;
}

/** a lane at a fixed offset east (+) or west (−) of the axis */
export function lane(axis: readonly P2[], offset: number): P2[] {
  return axis.map(([x, z]) => [x + offset, z] as P2);
}

/** Chaikin corner cutting (open polyline, endpoints kept) */
export function smooth(poly: readonly P2[], passes = 3): P2[] {
  let p = poly.map((q) => [q[0], q[1]] as P2);
  for (let k = 0; k < passes; k++) {
    if (p.length < 3) break;
    const out: P2[] = [p[0] as P2];
    for (let i = 0; i + 1 < p.length; i++) {
      const a = p[i] as P2;
      const b = p[i + 1] as P2;
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(p[p.length - 1] as P2);
    p = out;
  }
  return p;
}

/** an arc from `from` turning about centre c through `sweep` rad (+ = ccw in x/z) */
export function arc(c: P2, r: number, a0: number, sweep: number, n = 16): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

/** a rectangle obstacle (yawed), expanded by the planner's clearance */
interface Obstacle {
  x: number;
  z: number;
  hx: number;
  hz: number;
  yaw: number;
}

/**
 * A* over water cells (canon §9.32: depth, width and clearance decide what is
 * navigable). `depth` is the hull's draft plus safety; `clear` the half-beam
 * plus a margin kept from every registered hull, pier and quay and from the
 * extra obstacles (e.g. slipway ramps). Returns a smoothed path or null.
 */
export function planWater(
  hf: Heightfield, from: P2, to: P2,
  opts: { depth: number; clear: number; box: [number, number, number, number]; cell?: number; extra?: Obstacle[]; ignore?: (id: string) => boolean },
): P2[] | null {
  const cell = opts.cell ?? 5;
  const [x0, z0, x1, z1] = opts.box;
  const nx = Math.ceil((x1 - x0) / cell);
  const nz = Math.ceil((z1 - z0) / cell);
  const obs: Obstacle[] = [...(opts.extra ?? [])];
  for (const f of fpAll()) {
    if (f.family !== 'vessels' && f.family !== 'harbor-works') continue;
    if (opts.ignore?.(f.id)) continue;
    obs.push({ x: f.x, z: f.z, hx: f.hx, hz: f.hz, yaw: f.yaw ?? 0 });
  }
  const blockedAt = (x: number, z: number): boolean => {
    if (hf.heightAtCpu(x, z) > NILE_WATER_Y - opts.depth) return true;
    for (const o of obs) {
      const c = Math.cos(-o.yaw);
      const s = Math.sin(-o.yaw);
      const dx = x - o.x;
      const dz = z - o.z;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < o.hx + opts.clear && Math.abs(lz) < o.hz + opts.clear) return true;
    }
    return false;
  };
  const free = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) free[j * nx + i] = blockedAt(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell) ? 0 : 1;
  }
  const idx = (p: P2): number => {
    const i = Math.min(nx - 1, Math.max(0, Math.floor((p[0] - x0) / cell)));
    const j = Math.min(nz - 1, Math.max(0, Math.floor((p[1] - z0) / cell)));
    return j * nx + i;
  };
  const s0 = idx(from);
  const g0 = idx(to);
  if (!free[s0] || !free[g0]) return null;
  // binary-heap A* with octile moves
  const gScore = new Float32Array(nx * nz).fill(Infinity);
  const came = new Int32Array(nx * nz).fill(-1);
  const heap: Array<[number, number]> = [];
  const push = (f: number, n: number): void => {
    heap.push([f, n]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((heap[p] as [number, number])[0] <= f) break;
      [heap[p], heap[i]] = [heap[i] as [number, number], heap[p] as [number, number]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0] as [number, number];
    const last = heap.pop() as [number, number];
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && (heap[l] as [number, number])[0] < (heap[m] as [number, number])[0]) m = l;
        if (r < heap.length && (heap[r] as [number, number])[0] < (heap[m] as [number, number])[0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i] as [number, number], heap[m] as [number, number]];
        i = m;
      }
    }
    return top;
  };
  const gi = g0 % nx;
  const gj = Math.floor(g0 / nx);
  const h = (n: number): number => {
    const di = Math.abs((n % nx) - gi);
    const dj = Math.abs(Math.floor(n / nx) - gj);
    return (Math.max(di, dj) + 0.414 * Math.min(di, dj)) * cell;
  };
  gScore[s0] = 0;
  push(h(s0), s0);
  while (heap.length) {
    const [, n] = pop();
    if (n === g0) break;
    const i = n % nx;
    const j = Math.floor(n / nx);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const m = jj * nx + ii;
        if (!free[m]) continue;
        if (di && dj && (!free[j * nx + ii] || !free[jj * nx + i])) continue; // no corner cutting
        const gs = (gScore[n] as number) + (di && dj ? 1.414 : 1) * cell;
        if (gs < (gScore[m] as number)) {
          gScore[m] = gs;
          came[m] = n;
          push(gs + h(m), m);
        }
      }
    }
  }
  if (came[g0] === -1 && g0 !== s0) return null;
  const cells: P2[] = [];
  for (let n = g0; n !== -1; n = came[n] as number) {
    cells.push([x0 + ((n % nx) + 0.5) * cell, z0 + (Math.floor(n / nx) + 0.5) * cell]);
    if (n === s0) break;
  }
  cells.reverse();
  // string-pull: keep a cell only when the straight line from the last kept
  // point to the next one would cross a blocked cell
  const sight = (a: P2, b: P2): boolean => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / (cell * 0.5)));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (!free[idx([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])]) return false;
    }
    return true;
  };
  const kept: P2[] = [from];
  let anchor = from;
  for (let k = 1; k < cells.length; k++) {
    const next = cells[k + 1] ?? to;
    if (!sight(anchor, next)) {
      anchor = cells[k] as P2;
      kept.push(anchor);
    }
  }
  kept.push(to);
  return smooth(kept, 2);
}

/** builds a time track: legs of travel at a speed, and stops */
export class TrackBuilder {
  readonly pts: TrackPoint[] = [];
  private carry = 0; // metres already travelled past the last sample

  /** travel the polyline at v m/s with the given load; `reverse`: stern
   *  first (backing off a landing — the heading stays bow-forward) */
  travel(poly: readonly P2[], v: number, load: number, reverse = false): this {
    if (poly.length < 2) return this;
    let segI = 0;
    let along = this.carry;
    const step = v * DT;
    for (;;) {
      const a = poly[segI] as P2;
      const b = poly[segI + 1] as P2;
      const sl = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (along > sl) {
        along -= sl;
        segI++;
        if (segI + 1 >= poly.length) break;
        continue;
      }
      const t = sl > 0 ? along / sl : 0;
      const hd = Math.atan2(b[1] - a[1], b[0] - a[0]) + (reverse ? Math.PI : 0);
      this.emit(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, hd, load);
      along += step;
    }
    this.carry = along;
    return this;
  }

  /** wait in place `seconds`, the load moving linearly from l0 to l1 */
  stop(seconds: number, l0: number, l1: number): this {
    const last = this.pts[this.pts.length - 1];
    if (!last) return this;
    const n = Math.max(1, Math.round(seconds / DT));
    for (let i = 1; i <= n; i++) this.pts.push({ x: last.x, z: last.z, a: last.a, load: l0 + ((l1 - l0) * i) / n });
    return this;
  }

  private emit(x: number, z: number, a: number, load: number): void {
    const prev = this.pts[this.pts.length - 1];
    let aa = a;
    if (prev) {
      // unwrap against the previous heading so interpolation never spins
      while (aa - prev.a > Math.PI) aa -= Math.PI * 2;
      while (aa - prev.a < -Math.PI) aa += Math.PI * 2;
    }
    this.pts.push({ x, z, a: aa, load });
  }

  /** headings eased over ±k samples: the hull swings through a turn */
  finish(k = 3): TrackPoint[] {
    const src = this.pts.map((p) => p.a);
    for (let i = 0; i < this.pts.length; i++) {
      let s = 0;
      let n = 0;
      for (let d = -k; d <= k; d++) {
        const v = src[i + d];
        if (v !== undefined) {
          s += v;
          n++;
        }
      }
      (this.pts[i] as TrackPoint).a = s / n;
    }
    return this.pts;
  }
}
