/**
 * Collision & consistency audit over the footprint registry:
 *
 *   overlap — two solid footprints from different families (or intra-flagged
 *             siblings) intersect in 3D beyond tolerance
 *   float   — a grounded footprint's base hangs above the terrain everywhere
 *   buried  — a grounded footprint is swallowed by terrain (top below ground)
 *   afloat  — a hull neither rides the waterline nor sits its keel on the bed
 *
 * Pure function over (footprints, heightfield): runs once at boot (console +
 * HUD warning), on every Inspector edit, and headless in tools/audit.ts as a
 * gate — this class of defect can no longer ship silently.
 */

import type { Heightfield } from '../world/Heightfield';
import { NILE_WATER_Y } from '../world/WorldConst';
import { fpAabb, fpAll, type Footprint } from './Footprints';

export interface CollisionIssue {
  kind: 'overlap' | 'float' | 'buried' | 'afloat';
  a: string;
  b?: string;
  /** worst penetration / gap in meters */
  depth: number;
  x: number;
  z: number;
  y: number;
}

const OVERLAP_TOL = 0.15; // m of penetration before we call it a defect
const FLOAT_TOL = 0.45; // base must be within this of the ground somewhere
const CELL = 64; // spatial hash cell (m)

function allowed(a: Footprint, b: Footprint): boolean {
  const hit = (list: string[] | undefined, o: Footprint): boolean =>
    !!list && (list.includes(o.family) || list.includes(o.id));
  return hit(a.allow, b) || hit(b.allow, a);
}

function groundSamples(f: Footprint, hf: Heightfield): number[] {
  const c = Math.cos(f.yaw ?? 0);
  const s = Math.sin(f.yaw ?? 0);
  const pts: number[] = [];
  for (const [lx, lz] of [
    [0, 0],
    [-f.hx, -f.hz],
    [f.hx, -f.hz],
    [f.hx, f.hz],
    [-f.hx, f.hz],
  ] as const) {
    pts.push(hf.heightAtCpu(f.x + lx * c - lz * s, f.z + lx * s + lz * c));
  }
  return pts;
}

export function runCollisionAudit(hf: Heightfield): CollisionIssue[] {
  const issues: CollisionIssue[] = [];
  const fps = fpAll();

  /* --- pairwise overlaps via spatial hash ---------------------------------- */
  const grid = new Map<string, number[]>();
  const aabbs = fps.map(fpAabb);
  for (let i = 0; i < fps.length; i++) {
    const bb = aabbs[i];
    if (!bb) continue;
    for (let gx = Math.floor(bb.x0 / CELL); gx <= Math.floor(bb.x1 / CELL); gx++) {
      for (let gz = Math.floor(bb.z0 / CELL); gz <= Math.floor(bb.z1 / CELL); gz++) {
        const k = `${gx},${gz}`;
        const cell = grid.get(k);
        if (cell) cell.push(i);
        else grid.set(k, [i]);
      }
    }
  }
  const seen = new Set<number>();
  for (const cell of grid.values()) {
    for (let ci = 0; ci < cell.length; ci++) {
      for (let cj = ci + 1; cj < cell.length; cj++) {
        const i = cell[ci] as number;
        const j = cell[cj] as number;
        const key = i < j ? i * 100000 + j : j * 100000 + i;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = fps[i] as Footprint;
        const b = fps[j] as Footprint;
        if (a.passive || b.passive) continue;
        if (a.family === b.family && !(a.intra && b.intra)) continue;
        if (allowed(a, b)) continue;
        const A = aabbs[i];
        const B = aabbs[j];
        if (!A || !B) continue;
        const px = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        const pz = Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0);
        const py = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (px > OVERLAP_TOL && pz > OVERLAP_TOL && py > OVERLAP_TOL) {
          issues.push({
            kind: 'overlap',
            a: a.id,
            b: b.id,
            depth: Math.min(px, pz, py),
            x: (Math.max(A.x0, B.x0) + Math.min(A.x1, B.x1)) / 2,
            z: (Math.max(A.z0, B.z0) + Math.min(A.z1, B.z1)) / 2,
            y: (Math.max(a.y0, b.y0) + Math.min(a.y1, b.y1)) / 2,
          });
        }
      }
    }
  }

  /* --- grounding ------------------------------------------------------------ */
  for (const f of fps) {
    if (f.ground === 'grounded' || f.ground === 'platform') {
      const g = groundSamples(f, hf);
      const gMin = Math.min(...g);
      const gMax = Math.max(...g);
      if (f.y0 - gMax > FLOAT_TOL) {
        issues.push({ kind: 'float', a: f.id, depth: f.y0 - gMax, x: f.x, z: f.z, y: f.y0 });
      } else if (f.y1 < gMin - 0.3) {
        issues.push({ kind: 'buried', a: f.id, depth: gMin - f.y1, x: f.x, z: f.z, y: f.y1 });
      }
    } else if (f.ground === 'afloat') {
      const bed = hf.heightAtCpu(f.x, f.z);
      const draft = f.draft ?? 0.5;
      const wet = bed < NILE_WATER_Y - draft - 0.25;
      const ok = wet
        ? Math.abs(f.y0 + draft - NILE_WATER_Y) < 0.4 // riding the waterline
        : Math.abs(f.y0 - bed) < 0.7; // keel seated on the bank/bed
      if (!ok) {
        issues.push({
          kind: 'afloat',
          a: f.id,
          depth: wet ? f.y0 + draft - NILE_WATER_Y : f.y0 - bed,
          x: f.x,
          z: f.z,
          y: f.y0,
        });
      }
    }
  }

  return issues;
}
