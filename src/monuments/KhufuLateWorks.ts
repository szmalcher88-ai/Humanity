/**
 * KhufuLateWorks (T3-2) — the logistics of KHUFU_LATE, "advanced
 * construction and limestone transport" (VOL_IX:121), KHUFU_LATE only and
 * behind `lateWorks` (D-26):
 *  - Khufu's quarry AT WORK: extraction faces on its two free floors (the
 *    west floor and the ENE arm) — blocks standing proud in their channels
 *    on the trench grid's 2.6 m pitch, gaps where blocks went, one levered
 *    up on rockers, waste chips (canon "Partially extracted blocks … Waste
 *    piles", MPB:2583-2587); a rubble TRANSPORT RAMP from the floor at the
 *    haul road's start up to the north lip with timber sleepers ("Transport
 *    ramps", :2589) — built DOWN from the lip, never steeper than 12 %, and
 *    (2026-10-27) on until its deck meets the floor; staged blocks at its
 *    top; sledges and their teams at the faces (the hauling teams on the
 *    ramp are HaulTrains', animated);
 *  - the Tura casing arriving (IX:828 — "the block enters the pyramid
 *    construction sequence"): a staging yard of casing blocks by size at the
 *    south-shore slipway; sledges hauling Tura blocks up the causeway's bare
 *    foundation, the materials road (the second barge is Vessels').
 * Static figures (walkers stand on the terrain only — Inhabitants); one
 * walker line appended LAST. Plan: docs/plans/T3-2_PLAN.md §3.4–3.5.
 */

import { Mesh, type Object3D } from 'three';
import type { Rng, WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { fpReg } from '../debug/Footprints';
import { earthMaterial } from '../vegetation/Basins';
import { slipwayRamp } from './HarborDistrict';
import { CAUSEWAY_LATE_LIFT, GeoWriter, limestoneMaterial, type ComplexInfo } from './KhufuComplex';
import { addTownsfolk, ColorWriter, person, type C3 } from './Townsfolk';
import type { Gang } from './Inhabitants';

const EV = { conf: 'D' as const, epoch: 'khufu-late' };
const FILL: C3 = [0.62, 0.56, 0.44];
const ROPE: C3 = [0.6, 0.52, 0.36];

/** the quarrymen walking between the west faces and the transport ramp */
export const khufuLateLines: Gang[] = [
  { x0: -20, z0: 474, x1: 86, z1: 394, n: 40, spread: 4, carry: 0.5, still: 0.3 },
];

export interface KhufuLateInfo {
  faceBlocks: number;
  rampSegments: number;
  turaStaged: number;
  /** (2026-10-27) the transport ramp's deck centre line, the lip → the
   *  floor: x, y, z (HaulTrains' route) */
  rampRoute: [number, number, number][];
  /** the ramp's deck height above the floor where it ends (m) */
  rampEndLip: number;
  /** (2026-10-27) the causeway foundation's walking line, its foot → the
   *  plateau: x, y (the slabs' top), z (HaulTrains' Tura road) */
  causewayRoute: [number, number, number][];
}

export function buildKhufuLateWorks(
  scene: Object3D, seed: WorldSeed, hf: Heightfield, gi: ProbeGI | null, complex: ComplexInfo,
  /** (2026-10-27) HaulTrains runs the causeway: its static teams stay out */
  hauling = false,
): KhufuLateInfo {
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const rng = seed.rng('quarry-late');
  const tyRng = seed.rng('tura-yard');
  const folkRng = seed.rng('quarry-folk');
  const fill = new ColorWriter();
  const folk = new ColorWriter();
  const stone = new GeoWriter(); // local limestone: the faces, the staged blocks
  const tura = new GeoWriter(); // Tura casing blocks
  const wood = new GeoWriter();
  const info: KhufuLateInfo = { faceBlocks: 0, rampSegments: 0, turaStaged: 0, rampRoute: [], rampEndLip: 0, causewayRoute: [] };

  /** a block on its sledge with a hauling team ahead of it (static figures) */
  const sledge = (w: GeoWriter, x: number, y: number, z: number, yaw: number, t: Rng, haulers = 8, slopeK = 0): void => {
    const fx = Math.cos(yaw);
    const fz = Math.sin(yaw);
    for (const d of [-0.6, 0.6]) wood.box(x - fz * d, y - 0.02, z + fx * d, 3.6, 0.22, 0.3, 0.8, 0, yaw);
    wood.box(x, y + 0.2, z, 3.4, 0.14, 1.5, 0.85, 0, yaw);
    w.box(x, y + 0.34, z, 2.0, 1.1, 1.3, t.range(0.94, 1.03), 0.004, yaw);
    for (let i = 0; i < haulers; i++) {
      const along = 3.2 + Math.floor(i / 2) * 1.2;
      const side = i % 2 ? 0.7 : -0.7;
      const px = x + fx * along - fz * side;
      const pz = z + fz * along + fx * side;
      person(folk, folkRng, px, y + slopeK * along, pz, -yaw - Math.PI / 2, 'stand');
    }
    for (const side of [-0.7, 0.7]) {
      folk.beam([x + fx * 1.7 - fz * side * 0.6, y + 0.4, z + fz * 1.7 + fx * side * 0.6],
        [x + fx * (3 + haulers * 0.6) - fz * side, y + 1.0 + slopeK * haulers * 0.6, z + fz * (3 + haulers * 0.6) + fx * side], 0.02, ROPE);
    }
    // the water pourer at the runners
    person(folk, folkRng, x - fx * 1.9, y, z - fz * 1.9, -yaw + Math.PI / 2, 'stand');
  };
  const chips = (cx: number, cz: number, r: number, n: number, t: Rng): void => {
    for (let k = 0; k < n; k++) {
      const a = t.range(0, Math.PI * 2);
      const d = Math.sqrt(t.float()) * r;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const s = t.range(0.15, 0.5);
      stone.box(x, grd(x, z) - 0.05, z, s, s * 0.5, s * t.range(0.6, 1.0), t.range(0.95, 1.1), 0.1, t.range(0, Math.PI));
    }
  };

  /* --- the extraction faces ---------------------------------------------------- */
  const face = (id: string, cx: number, cz: number, nx: number, nz: number, teamYaw: number): void => {
    const P = 2.6; // the trench grid's pitch (QuarryCarve)
    const B = P - 0.55; // a block between its channels
    let lo = Infinity;
    let hi = -Infinity;
    let levered = false;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = cx + (i - (nx - 1) / 2) * P;
        const z = cz + (j - (nz - 1) / 2) * P;
        const g = grd(x, z);
        lo = Math.min(lo, g);
        hi = Math.max(hi, g);
        if (rng.chance(0.25)) continue; // a block already taken out
        if (!levered && i === nx - 1 && j === 0) {
          // one levered up on timber rockers, the lever still under it
          for (const d of [-0.6, 0.6]) wood.box(x + d, g, z, 0.25, 0.3, 1.8, 0.8);
          stone.box(x, g + 0.3, z, B, 1.12, B, rng.range(0.92, 1.04), 0.01, 0.06);
          wood.box(x + B * 0.9, g + 0.05, z, 3.2, 0.14, 0.16, 0.85, 0, 0.35);
          levered = true;
        } else {
          stone.box(x, g - 0.05, z, B, 1.12, B, rng.range(0.92, 1.04), 0.01);
        }
        info.faceBlocks++;
      }
    }
    chips(cx + nx * 1.6, cz + nz * 1.6, 5, 40, rng);
    const sx = cx + nx * P * 0.5 + 6;
    const sz = cz - nz * P * 0.5 - 4;
    sledge(stone, sx, grd(sx, sz), sz, teamYaw, rng);
    fpReg({
      id: `quarry-works:face:${id}`, family: 'quarry-works', x: cx, z: cz, hx: (nx * P) / 2, hz: (nz * P) / 2,
      y0: lo - 0.2, y1: hi + 1.4, ground: 'none', passive: true,
      basis: 'an extraction face on the trench grid, at work (MPB:2583-2587); its layout reconstructed', ...EV,
    });
  };
  face('west', -32, 478, 6, 4, -0.6);
  // (T2-7) the ENE arm now runs down into the Sphinx's shelf (measured 9 m
  // of fall across the old face): the second face moved onto the bowl's floor
  // (110 … 140, 410 … 432 — within 1.9 m)
  face('ene', 125, 421, 5, 4, Math.PI - 0.4);

  /* --- the transport ramp: floor (90, 390) → the north lip (70, 306) ---------- */
  {
    const A: [number, number] = [70, 306]; // the lip (built from here, downhill)
    const Bp: [number, number] = [90, 390]; // the floor at the haul road's start
    const len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]);
    const ux = (Bp[0] - A[0]) / len;
    const uz = (Bp[1] - A[1]) / len;
    const yaw = Math.atan2(uz, ux);
    const SEG = 3;
    const N0 = Math.ceil(len / SEG);
    const seg = len / N0;
    const ys: number[] = [];
    const gAt = (s: number): number => grd(A[0] + ux * s, A[1] + uz * s);
    for (let i = 0; i < N0; i++) {
      const g = gAt((i + 0.5) * seg) + 0.3;
      ys.push(i === 0 ? g : Math.max(g, (ys[i - 1] as number) - 0.12 * seg));
    }
    // (2026-10-27) on past the floor point until the deck comes down to the
    // floor: it ended 1.3 m up in the air (T3-2's measure; more since T2-7
    // lowered the bowl) — the human's "a ramp ending abruptly, no slope"
    while (ys.length < N0 + 24) {
      const last = ys[ys.length - 1] as number;
      if (last - 0.12 * seg <= gAt(ys.length * seg) + 0.05) break;
      ys.push(Math.max(gAt((ys.length + 0.5) * seg) + 0.3, last - 0.12 * seg));
    }
    const N = ys.length;
    const gEnd = gAt(N * seg);
    const yEnd = Math.max((ys[N - 1] as number) - 0.12 * seg, Math.min(ys[N - 1] as number, gEnd + 0.02));
    info.rampEndLip = yEnd - gEnd;
    for (let i = 0; i < N; i++) info.rampRoute.push([A[0] + ux * i * seg, ys[i] as number, A[1] + uz * i * seg]);
    info.rampRoute.push([A[0] + ux * N * seg, yEnd, A[1] + uz * N * seg]);
    const half = 4;
    for (let i = 0; i < N; i++) {
      const s0 = i * seg;
      const s1 = s0 + seg;
      const xm = A[0] + ux * (s0 + seg / 2);
      const zm = A[1] + uz * (s0 + seg / 2);
      const yHi = ys[i] as number; // nearer the lip
      const yLo = i + 1 < N ? Math.min(yHi, ys[i + 1] as number) : yEnd;
      const gMin = Math.min(grd(xm - uz * half, zm + ux * half), grd(xm + uz * half, zm - ux * half), grd(xm, zm)) - 0.3;
      fill.box(xm, gMin, zm, seg + 0.04, Math.max(0.05, yLo - gMin), half * 2, FILL, yaw);
      const px = uz * half;
      const pz = -ux * half;
      const [ax, az] = [A[0] + ux * s0, A[1] + uz * s0];
      const [bx, bz] = [A[0] + ux * (s1 + 0.04), A[1] + uz * (s1 + 0.04)];
      // the deck slopes from the lip side (yHi) down to the floor side (yLo)
      const q: [C3, C3, C3, C3] = [[bx + px, yLo, bz + pz], [bx - px, yLo, bz - pz], [ax - px, yHi, az - pz], [ax + px, yHi, az + pz]];
      const ny = (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]);
      if (ny > 0) fill.quad(q[0], q[1], q[2], q[3], FILL);
      else fill.quad(q[0], q[3], q[2], q[1], FILL);
      // timber cross-sleepers
      for (const f of [0.25, 0.75]) {
        const sx = A[0] + ux * (s0 + seg * f);
        const sz = A[1] + uz * (s0 + seg * f);
        wood.box(sx, yHi + (yLo - yHi) * f - 0.04, sz, 0.25, 0.15, half * 2 - 1, rng.range(0.85, 1.0), 0, yaw);
      }
      if (i % 3 === 0) {
        fpReg({
          id: `quarry-works:ramp:${i}`, family: 'quarry-works', x: xm, z: zm, hx: seg * 1.5, hz: half, yaw,
          y0: gMin, y1: yHi + 0.2, yFloor: yLo, ground: 'grounded', cutting: true,
          basis: 'a transport ramp out of the quarry (MPB:2589), built down from the lip at ≤ 12 %', ...EV,
        });
      }
      info.rampSegments++;
    }
    // (2026-10-27) its static team is gone: HaulTrains' teams come up it
    // blocks staged at its head, on the lip
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const x = 50 + c * 2.6;
        const z = 292 + r * 2.4;
        const g = grd(x, z);
        stone.box(x, g - 0.04, z, rng.range(1.6, 2.2), rng.range(0.9, 1.2), rng.range(1.1, 1.4), rng.range(0.92, 1.04), 0.004);
      }
    }
    fpReg({
      id: 'quarry-works:stack', family: 'quarry-works', x: 55.2, z: 294.4, hx: 6.5, hz: 3.6,
      y0: grd(55, 294) - 0.3, y1: grd(55, 294) + 1.4, ground: 'none', passive: true,
      basis: 'blocks staged at the quarry lip for the haul road', ...EV,
    });
  }

  /* --- the Tura staging yard at the south-shore slipway ---------------------- */
  {
    const r = slipwayRamp(grd, 2);
    const yaw = Math.atan2(r.uz, r.ux);
    const along = (t: number, side: number): [number, number] => [r.sx0 + r.ux * t - r.uz * side, r.sz0 + r.uz * t + r.ux * side];
    const east = -r.uz < 0 ? -1 : 1; // the side opposite the tableau's staging (Vessels)
    // three rows by size up the ramp head, inland: casing, standard, small;
    // [L min, L max, H min, H max, W min, W max], L along the row (the ramp's line)
    const ROWS: [number, number, number, number, number, number][] = [
      [2.0, 2.4, 1.2, 1.4, 1.1, 1.3],
      [1.4, 1.9, 1.0, 1.3, 0.9, 1.3],
      [1.1, 1.6, 0.8, 1.1, 0.85, 1.2],
    ];
    for (const [row, [l0, l1, h0, h1, w0, w1]] of ROWS.entries()) {
      let t = -10;
      const side = east * (7 + row * 2.6);
      for (let k = 0; k < 7; k++) {
        const L = tyRng.range(l0, l1);
        const W = tyRng.range(w0, w1);
        const [x, z] = along(t - L / 2, side);
        const g = grd(x, z);
        // two timber sleepers across the row under each block
        for (const d of [-0.3, 0.3]) {
          wood.box(x + r.ux * d * L, g - 0.02, z + r.uz * d * L, 0.22, 0.18, W + 0.3, 0.8, 0, yaw);
        }
        tura.box(x, g + 0.16, z, L, tyRng.range(h0, h1), W, tyRng.range(0.95, 1.03), 0.004, yaw);
        t -= L + tyRng.range(0.4, 0.6);
        info.turaStaged++;
      }
    }
    const [cx, cz] = along(-20, east * 9.6);
    const g = grd(cx, cz);
    fpReg({
      id: 'tura-yard:staging', family: 'tura-yard', x: cx, z: cz, hx: 12, hz: 4.5, yaw,
      y0: g - 0.3, y1: g + 1.8, ground: 'none', passive: true,
      basis: 'Tura casing staged by size at the slipway (the Diary of Merer: Tura limestone to Giza)', ...EV,
    });
  }

  /* --- Tura blocks hauled up the causeway's foundation (the materials road) -- */
  {
    const a = complex.causewayStart;
    const b = complex.causewayEnd;
    const ys = complex.causewayDeck;
    const n = ys.length;
    const yaw = Math.atan2(b.z - a.z, b.x - a.x) + Math.PI; // nose up the road, toward the pyramid
    // the walking line, foot → top: the sloped deck's (KhufuComplex)
    for (let i = n - 2; i >= 3; i--) {
      info.causewayRoute.push([a.x + (b.x - a.x) * ((i + 0.5) / n), (ys[i] as number) + CAUSEWAY_LATE_LIFT, a.z + (b.z - a.z) * ((i + 0.5) / n)]);
    }
    for (const f of hauling ? [] : [0.22, 0.48, 0.74]) {
      const i = Math.min(n - 1, Math.floor(f * n));
      const x = a.x + (b.x - a.x) * ((i + 0.5) / n);
      const z = a.z + (b.z - a.z) * ((i + 0.5) / n);
      const slopeK = i > 0 ? ((ys[i - 1] as number) - (ys[i] as number)) / (Math.hypot(b.x - a.x, b.z - a.z) / n) : 0;
      sledge(tura, x, (ys[i] as number) + CAUSEWAY_LATE_LIFT, z, yaw, tyRng, 10, slopeK);
    }
  }

  /* --- materialize ----------------------------------------------------------- */
  const meshes = [
    new Mesh(fill.build(), earthMaterial(gi)),
    new Mesh(stone.build(), limestoneMaterial([0.74, 0.68, 0.57], gi, 50, 50)),
    new Mesh(tura.build(), limestoneMaterial([0.85, 0.825, 0.77], gi, 50, 50, { rough: 0.7 })),
    new Mesh(wood.build(), limestoneMaterial([0.36, 0.27, 0.17], gi, 0.24, 0.32, { rough: 0.8 })),
  ];
  const names = ['quarry-works-fill', 'quarry-works-stone', 'tura-yard-blocks', 'quarry-works-wood'];
  meshes.forEach((m, i) => {
    m.name = names[i] as string;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  });
  addTownsfolk(scene, folk, gi, 'khufu-late-works');
  return info;
}
