/**
 * Reed and papyrus cutting on the river margin (v1.2 I2; canon Vol IV
 * "reed harvesting, papyrus cutting", Vol IX §9.24–9.26). Papyrus and reed
 * were cut, bundled and carried off for boats, mats, rope, roofs and fuel.
 *
 * At a handful of reed beds on the river strip (never the harbour latitudes)
 * a cutting gang works the margin, and the cut stems lie tied in bundles on
 * the bank behind them: piles of dried bundles further up, a few fresh green
 * ones still at the water's edge. The gangs are lines handed to the
 * inhabitants system (they keep to ground at least 0.3 m above the water,
 * which its water test enforces); the piles register footprints, so the
 * figures walk around them.
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { NILE_WATER_Y } from '../world/WorldConst';
import { fpReg } from '../debug/Footprints';
import { GeoWriter, limestoneMaterial } from '../monuments/KhufuComplex';
import type { Gang } from '../monuments/Inhabitants';
import type { Parcel } from './Fields';

const FAMILY = 'shore-works';
const NILE_PRIOR: [number, number][] = [[2080, -1900], [1960, -1000], [1900, -200], [1950, 600], [2060, 1400], [2180, 2250]];

function axisX(z: number): number {
  for (let i = 0; i + 1 < NILE_PRIOR.length; i++) {
    const a = NILE_PRIOR[i] as [number, number];
    const b = NILE_PRIOR[i + 1] as [number, number];
    if (z >= a[1] && z <= b[1]) return a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]);
  }
  return z < -1900 ? 2080 : 2180;
}

export interface ReedHarvest {
  sites: number;
  bundles: number;
  /** cutting gangs for the inhabitants system */
  lines: Gang[];
}

export function buildReedHarvest(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  reedSpots: readonly [number, number, number][],
  parcels: readonly Parcel[] = [],
  maxSites = 6,
): ReedHarvest {
  const rng = seed.rng('reed-harvest');
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const dried = new GeoWriter();
  const fresh = new GeoWriter();
  const lash = new GeoWriter();
  const out: ReedHarvest = { sites: 0, bundles: 0, lines: [] };
  const sites: [number, number][] = [];
  // a deterministic walk through the spots, keeping ones far apart
  const order = reedSpots.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  for (const i of order) {
    if (sites.length >= maxSites) break;
    const [x, z, y] = reedSpots[i] as [number, number, number];
    if (x < 1520 || (z > -470 && z < 220)) continue; // river strip only, not the harbour
    if (y < NILE_WATER_Y + 0.3) continue; // cutters must stand on it
    if (sites.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 180)) continue;
    sites.push([x, z]);
  }

  /** props never stand in a crop parcel (v1.2: the first piles sat in a field) */
  const inField = (x: number, z: number, m = 1.5): boolean =>
    parcels.some((p) => p.density > 0 && x > p.x0 - m && x < p.x0 + p.w + m && z > p.z0 - m && z < p.z0 + p.d + m);
  type P3 = [number, number, number];
  const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: P3, b: P3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /** a round prism lying between two points at one height (GeoWriter only
   *  builds boxes and upright drums); every face wound outward */
  const rod = (w: GeoWriter, a: P3, b: P3, r: number, tone: number, sides = 8): void => {
    const d: P3 = sub(b, a);
    const len = Math.hypot(d[0], d[2]) || 1;
    const px = -d[2] / len;
    const pz = d[0] / len;
    const ring = (o: P3): P3[] =>
      Array.from({ length: sides }, (_, i): P3 => {
        const t = (i / sides) * Math.PI * 2;
        return [o[0] + px * Math.cos(t) * r, o[1] + Math.sin(t) * r, o[2] + pz * Math.cos(t) * r];
      });
    const tri = (p: P3, q: P3, s: P3, out: P3): void => {
      const n = cross(sub(q, p), sub(s, p));
      const ordered = dot(n, out) >= 0 ? [p, q, s] : [p, s, q];
      for (const v of ordered) {
        w.pos.push(v[0], v[1], v[2]);
        w.col.push(tone, tone, tone);
      }
    };
    const A = ring(a);
    const B = ring(b);
    const mid: P3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a0 = A[i] as P3;
      const a1 = A[j] as P3;
      const b0 = B[i] as P3;
      const b1 = B[j] as P3;
      const c: P3 = [(a0[0] + b1[0]) / 2, (a0[1] + b1[1]) / 2, (a0[2] + b1[2]) / 2];
      // outward = the face centre's offset from the axis (axial part removed)
      const radial: P3 = [px * dot(sub(c, mid), [px, 0, pz]), c[1] - mid[1], pz * dot(sub(c, mid), [px, 0, pz])];
      tri(a0, a1, b1, radial);
      tri(a0, b1, b0, radial);
    }
    // end caps: the cut stems
    const ax: P3 = [d[0] / len, 0, d[2] / len];
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      tri(a, A[i] as P3, A[j] as P3, [-ax[0], 0, -ax[2]]);
      tri(b, B[i] as P3, B[j] as P3, ax);
    }
  };
  /** one tied bundle lying along `yaw` (centre x, z; underside at y), two
   *  lashings */
  const bundle = (w: GeoWriter, x: number, y: number, z: number, yaw: number, len: number, d: number): void => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const r = d / 2;
    rod(w, [x - c * len * 0.5, y + r, z - s * len * 0.5], [x + c * len * 0.5, y + r, z + s * len * 0.5], r, rng.range(0.92, 1.06));
    for (const f of [-0.3, 0.3]) {
      const lx = x + c * f * len;
      const lz = z + s * f * len;
      rod(lash, [lx - c * 0.035, y + r, lz - s * 0.035], [lx + c * 0.035, y + r, lz + s * 0.035], r * 1.08, 1);
    }
    out.bundles++;
  };

  for (const [sx, sz] of sites) {
    const land = sx < axisX(sz) ? -1 : 1; // west bank: land lies to −x
    const yaw = Math.PI / 2 + rng.range(-0.2, 0.2); // along the bank
    // piles of dried bundles up the bank: 3 + 2 + 1
    for (let p = 0; p < 2; p++) {
      const px = sx + land * rng.range(6, 10);
      const pz = sz + (p === 0 ? -1 : 1) * rng.range(3.5, 6);
      const y = grd(px, pz) - 0.04;
      if (y < NILE_WATER_Y + 0.25 || inField(px, pz)) continue;
      const len = rng.range(2.0, 2.5);
      const d = 0.34;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      for (let row = 0; row < 3; row++) {
        for (let k = 0; k < 3 - row; k++) {
          const off = (k - (2 - row) / 2) * d * 1.02;
          bundle(dried, px - s * off, y + row * d * 0.92, pz + c * off, yaw, len, d);
        }
      }
      fpReg({ id: `reed-pile:${sx.toFixed(0)}:${p}`, family: FAMILY, x: px, z: pz, hx: len / 2 + 0.1, hz: 0.7, yaw, y0: y, y1: y + 1.0, ground: 'grounded' });
    }
    // fresh-cut bundles at the margin, not yet carried up
    for (let k = 0; k < 4; k++) {
      const fx = sx + land * rng.range(1.5, 3.5);
      const fz = sz + rng.range(-7, 7);
      const y = grd(fx, fz) - 0.03;
      if (y < NILE_WATER_Y + 0.05 || inField(fx, fz)) continue;
      bundle(fresh, fx, y, fz, yaw + rng.range(-0.5, 0.5), rng.range(1.8, 2.3), 0.3);
    }
    // the cutting gang along the margin, standing and stooping in the reeds,
    // some carrying bundles up the bank
    out.lines.push({
      x0: sx + land * 1.0, z0: sz - 9, x1: sx + land * 1.0, z1: sz + 9,
      n: 5, spread: 2.2, carry: 0.45, still: 0.6,
    });
    out.sites++;
  }
  if (out.bundles > 0) {
    const meshes = [
      // fine courses read as the stems along the bundle; no cross joints
      new Mesh(dried.build(), limestoneMaterial([0.6, 0.52, 0.33], gi, 0.045, 60, { rough: 0.92 })),
      new Mesh(fresh.build(), limestoneMaterial([0.4, 0.48, 0.24], gi, 0.045, 60, { rough: 0.85 })),
      new Mesh(lash.build(), limestoneMaterial([0.34, 0.27, 0.17], gi, 0.5, 1.15, { rough: 0.9 })),
    ];
    for (const m of meshes) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = 'reed-harvest';
      scene.add(m);
    }
  }
  return out;
}
