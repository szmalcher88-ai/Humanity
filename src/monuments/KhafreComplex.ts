/**
 * KhafreComplex (T2-3, T2-4) — Khafre's works, KHAFRE_PERIOD on only (D-19),
 * in canon VII's hierarchy (VOL_VII.md:428-434), one module: the pyramid
 * court paved in INDIVIDUAL slabs (Pillar A, as Khufu's) and its temenos;
 * the mortuary temple at the court's east doorway; the causeway; the
 * granite valley temple; the Sphinx Temple before the Sphinx.
 * The pyramid itself is `Monuments.ts` ('G2'); the levelled platform, the
 * mortuary temple's pad and the shared rock-cut terrace of the Sphinx and
 * the two temples below are the terrain's (GizaControl, under the epoch).
 * Canon VII gives NO figures for any of the four buildings: the sizes are
 * outside figures (C) or reconstructions (D) — D-21, D-22.
 * Plans: docs/plans/T2-3_PLAN.md §3.3, docs/plans/T2-4_PLAN.md §3.3–3.8.
 */

import { Mesh, type Material, type Object3D } from 'three';
import type { Rng, WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { fpReg } from '../debug/Footprints';
import {
  G1_CAUSEWAY_WIDTH,
  G1_TEMENOS_HEIGHT,
  G2_BASE_SIDE,
  G2_CENTER,
  G2_PAD_Y,
  G2_TEMENOS_OFFSET,
  KHAFRE_CAUSEWAY,
  KHAFRE_CAUSEWAY_END_Y,
  KHAFRE_MT_EW,
  KHAFRE_MT_NS,
  KHAFRE_VT_CENTER,
  KHAFRE_VT_H,
  KHAFRE_VT_SIDE,
  SPHINX_FLOOR_Y,
  SPHINX_TEMPLE_CENTER,
  SPHINX_TEMPLE_H,
  SPHINX_TEMPLE_SIDE,
} from '../world/CANON_DIMENSIONS';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';

const EPOCH = 'khafre';
const GRANITE: [number, number, number] = [0.6, 0.39, 0.34]; // the repo's Aswan granite
const LOCAL: [number, number, number] = [0.74, 0.68, 0.57];
const TURA: [number, number, number] = [0.85, 0.825, 0.77];

export interface KhafreInfo {
  slabs: number;
  /** causeway segments, and its steepest grade (‰) */
  cwSegs: number;
  cwMaxGrade: number;
  /** the segment where it is steepest */
  cwMaxAt: number;
}

/** an opening in a north–south wall: a doorway, or a niche (a recess with a
 *  thin back on the wall's outer side) — `hgt` is its height; a lintel
 *  closes the wall above it */
export interface Opening {
  z: number;
  half: number;
  hgt: number;
  niche?: boolean;
}

const BATTER = 0.04;

/** a north–south wall at x from z0 to z1 with its openings; `outer` is the
 *  side its outer face looks to (−1 west, +1 east) — the niches' backs */
export function nsWall(
  w: GeoWriter, x: number, y: number, z0: number, z1: number, th: number, h: number, tone: number,
  openings: Opening[], outer: number,
): void {
  let z = z0;
  for (const o of [...openings].sort((a, b) => a.z - b.z)) {
    const a = o.z - o.half;
    if (a > z) w.box(x, y, (z + a) / 2, th, h, a - z, tone, BATTER);
    if (o.niche) w.box(x + outer * th * 0.3, y, o.z, th * 0.4, o.hgt, o.half * 2, tone, BATTER, 0, 0);
    // the lintel, as thick as the battered jambs ARE at its height (Khufu's
    // rule — a plumb lintel stands proud of a leaning face)
    w.box(x, y + o.hgt, o.z, th - 2 * BATTER * o.hgt, h - o.hgt, o.half * 2, tone, BATTER, 0, 0);
    z = o.z + o.half;
  }
  if (z1 > z) w.box(x, y, (z + z1) / 2, th, h, z1 - z, tone, BATTER);
}

/** a walled rectangle as Khufu's temples: the north and south walls run the
 *  full length and batter all four faces; the west and east walls reach
 *  half-way into them, 2 cm inside their plumb ends (no coplanar faces) */
export function enclosure(
  w: GeoWriter, x0: number, x1: number, z0: number, z1: number, y: number, h: number, th: number, tone: number,
  west: Opening[], east: Opening[],
): void {
  const xc = (x0 + x1) / 2;
  w.box(xc, y, z0 + th / 2, x1 - x0, h, th, tone, BATTER, 0, BATTER);
  w.box(xc, y, z1 - th / 2, x1 - x0, h, th, tone * 0.99, BATTER, 0, BATTER);
  nsWall(w, x0 + th / 2 + 0.02, y, z0 + th / 2, z1 - th / 2, th, h, tone, west, -1);
  nsWall(w, x1 - th / 2 - 0.02, y, z0 + th / 2, z1 - th / 2, th, h, tone, east, 1);
}

export function buildKhafreComplex(
  scene: Object3D, seed: WorldSeed, hf: Heightfield, gi: ProbeGI | null,
): KhafreInfo {
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const cx = G2_CENTER.x;
  const cz = G2_CENTER.z;
  const Y = G2_PAD_Y.value;
  const half = G2_BASE_SIDE.value / 2; // 107.6
  // Khufu's court and wall offsets (D): no survey of Khafre's is in the repo
  const r = half + G2_TEMENOS_OFFSET.value; // the wall's centreline, 127.8
  const F = SPHINX_FLOOR_Y.value; // the temples' rock-cut floor (D-20)
  // `?ktemples=0` (under the epoch): the four buildings and their footprints
  // are skipped — the perf A/B switch (the terrain and the doorway stay)
  const temples = new URLSearchParams(window.location.search).get('ktemples') !== '0';

  const meshes: { name: string; w: GeoWriter; mat: () => Material }[] = [];
  const writer = (name: string, mat: () => Material): GeoWriter => {
    const w = new GeoWriter();
    meshes.push({ name, w, mat });
    return w;
  };
  const turaMat = (): Material => limestoneMaterial(TURA, gi, 0.5);
  const localMat = (): Material => limestoneMaterial(LOCAL, gi, 0.55);
  // granite monoliths: no joint lines (SouthWorks' rule); polished (VII:318)
  const graniteMono = (): Material => limestoneMaterial(GRANITE, gi, 50, 50, { rough: 0.55, spec: 0.45 });
  const tura = writer('khafre-court', turaMat); // fine limestone: the court's slabs
  const local = writer('khafre-temenos', localMat); // local limestone: the temenos

  /* --- the court: individual slabs between the base and the wall --------- */
  let slabs = 0;
  {
    const t: Rng = seed.rng('khafre-pavement');
    for (const [x0, x1, z0, z1] of [
      [-r, r, -r, -half], // north strip
      [-r, r, half, r], // south
      [-r, -half, -half, half], // west
      [half, r, -half, half], // east
    ] as const) {
      let z = z0;
      while (z < z1) {
        const d = Math.min(t.range(0.85, 1.3), z1 - z);
        let x = x0;
        while (x < x1) {
          const w = Math.min(t.range(1.1, 1.9), x1 - x);
          tura.box(cx + x + w / 2, Y, cz + z + d / 2, w - 0.012, 0.14 + t.range(-0.006, 0.006), d - 0.012, t.range(0.93, 1.02));
          slabs++;
          x += w;
        }
        z += d;
      }
    }
    // (T2-4) D, not C: its width rests on G2_TEMENOS_OFFSET (D) — the lower
    // of form and place
    fpReg({
      id: 'khafre:court', family: 'khafre-pavement', x: cx, z: cz, hx: r, hz: r,
      y0: Y, y1: Y + 0.16, ground: 'none', passive: true,
      conf: 'D', basis: "a paved court as Khufu's; the width at Khufu's offsets", epoch: EPOCH,
    });
  }

  /* --- the temenos: Khufu's wall rule, the east wall stops at the temple -- */
  {
    const h = G1_TEMENOS_HEIGHT.value;
    const th = 3.0;
    // as Khufu's (KhufuComplex): the N/S runs batter their ends too and stop
    // 2 cm short of the west wall's outer plane — no coplanar corner faces
    local.box(cx + 0.02, Y, cz - r, 2 * r + th - 0.04, h, th, 0.98, 0.06, 0, 0.06); // north
    local.box(cx + 0.02, Y, cz + r, 2 * r + th - 0.04, h, th, 0.97, 0.06, 0, 0.06); // south
    local.box(cx - r, Y, cz, th, h, 2 * r + th, 0.99, 0.06, 0, 0.06); // west
    // (T2-4) the east wall in two runs that stop AT the mortuary temple's
    // flanks — Khufu's rule (KhufuComplex: the temple front fills the opening)
    const gateHalf = KHAFRE_MT_NS.value / 2 + 0.25;
    const run = r - gateHalf;
    local.box(cx + r, Y, cz - (gateHalf + run / 2), th, h, run, 0.98, 0.06);
    local.box(cx + r, Y, cz + gateHalf + run / 2, th, h, run, 0.98, 0.06);
    const wall = (id: string, x: number, z: number, hx: number, hz: number): void =>
      fpReg({
        id: `khafre:temenos:${id}`, family: 'khafre-temenos', x: cx + x, z: cz + z, hx, hz,
        y0: Y, y1: Y + h, ground: 'platform', allow: ['khafre-pavement'],
        conf: 'D', basis: "a wall at Khufu's offsets and height (D-3); no survey in the repo", epoch: EPOCH,
      });
    wall('north', 0, -r, r + th / 2, th / 2);
    wall('south', 0, r, r + th / 2, th / 2);
    wall('west', -r, 0, th / 2, r + th / 2);
    wall('east-n', r, -(gateHalf + run / 2), th / 2, run / 2);
    wall('east-s', r, gateHalf + run / 2, th / 2, run / 2);
  }

  let cwSegs = 0;
  let cwMaxGrade = 0;
  let cwMaxAt = -1;
  if (temples) {
    /* --- the mortuary temple: on the court's level, west → east: the offering
     *     hall, the open pillared court, the roofed entrance hall ----------- */
    {
      const t = seed.rng('khafre-mortuary');
      const mFloor = writer('khafre-mortuary-floor', turaMat);
      const mWalls = writer('khafre-mortuary-walls', localMat);
      const mGranite = writer('khafre-mortuary-granite', graniteMono);
      const x0 = cx + r; // its west wall on the temenos line
      const x1 = x0 + KHAFRE_MT_EW.value;
      const z0 = cz - KHAFRE_MT_NS.value / 2;
      const z1 = cz + KHAFRE_MT_NS.value / 2;
      const h = 8; // D
      const th = 2.6;
      mFloor.box((x0 + x1) / 2, Y + 0.02, cz, x1 - x0 - 2 * th, 0.16, z1 - z0 - 2 * th, 1.0);
      enclosure(mWalls, x0, x1, z0, z1, Y, h, th, 1.0,
        [{ z: cz, half: 2.2, hgt: 5.5 }], // to the pyramid court
        [{ z: cz, half: 2.4, hgt: 4.6 }], // from the causeway (its corridor is 3.8 m high)
      );
      // the cross walls: offering hall | court | entrance hall
      const xa = x0 + 30;
      const xb = x1 - 29.8;
      for (const xw of [xa, xb]) {
        nsWall(mWalls, xw, Y, z0 + th / 2, z1 - th / 2, 2.0, h, 0.98, [{ z: cz, half: 2.2, hgt: 5.5 }], 1);
      }
      const pillar = (x: number, z: number, top: number): void =>
        mGranite.box(x, Y + 0.18, z, 1.3, top - 0.18, 1.3, 1 + t.range(-0.04, 0.04));
      // the open court: two rows of six granite monoliths along its sides
      for (const pz of [cz - 15, cz + 15]) {
        for (let k = 0; k < 6; k++) pillar(xa + 6 + k * 6.8, pz, 6.4);
      }
      // the two halls, roofed (slabs into the walls; the walls stand 0.8 m
      // over the roof — a parapet), on granite pillars
      for (const [hx0, hx1, cols] of [
        [x0 + th, xa - 1.0, [x0 + 9.6, x0 + 16.6, x0 + 23.6]],
        [xb + 1.0, x1 - th, [xb + 4.5, xb + 10.5, xb + 16.5, xb + 22.5]],
      ] as const) {
        mWalls.box((hx0 + hx1) / 2, Y + 6.6, cz, hx1 - hx0 + 0.6, 0.6, z1 - z0 - 2 * th + 1.0, 0.96);
        for (const px of cols) for (const pz of [cz - 6.5, cz + 6.5]) pillar(px, pz, 6.6);
      }
      fpReg({
        id: 'khafre:mortuary', family: 'khafre-temple', x: (x0 + x1) / 2, z: cz,
        hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: Y, y1: Y + h, ground: 'platform',
        allow: ['khafre-temenos', 'khafre-pavement', 'khafre-causeway'],
        conf: 'D', basis: 'rounded massing (Hölscher 1912 to be checked); the calcite floors omitted', epoch: EPOCH,
      });
    }

    /* --- the causeway: Khufu's section on Khufu's pedestal rule, two legs
     *     round the provisional Sphinx enclosure (D-22), graded over the
     *     WHOLE route so the bend has no step ------------------------------ */
    {
      const t = seed.rng('khafre-causeway');
      const cWalls = writer('khafre-causeway-walls', localMat);
      const cFloor = writer('khafre-causeway-floor', turaMat);
      const w = G1_CAUSEWAY_WIDTH.value; // 9.5 exterior
      const wallTh = 1.3;
      const wallH = 3.8;
      const legs = [134, 46]; // ≈ 2.78 m segments, as Khufu's 180
      type Seg = { xm: number; zm: number; yaw: number; segL: number; s: number; leg: number; j: number };
      const segs: Seg[] = [];
      let s0 = 0;
      for (let l = 0; l < legs.length; l++) {
        const [ax, az] = KHAFRE_CAUSEWAY[l] as readonly [number, number];
        const [bx, bz] = KHAFRE_CAUSEWAY[l + 1] as readonly [number, number];
        const n = legs[l] as number;
        const len = Math.hypot(bx - ax, bz - az);
        const yaw = Math.atan2(bz - az, bx - ax);
        for (let j = 0; j < n; j++) {
          const f = (j + 0.5) / n;
          segs.push({ xm: ax + (bx - ax) * f, zm: az + (bz - az) * f, yaw, segL: len / n, s: s0 + len * f, leg: l, j });
        }
        s0 += len;
      }
      const total = s0;
      const N = segs.length;
      cwSegs = N;
      // the grade: the straight line from the court's level to the deck at
      // the valley temple, lifted over the ground, smoothed SIX passes
      // (Khufu's three left a 15 % lip; K-3)
      const ys = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const sg = segs[i] as Seg;
        const line = Y + (KHAFRE_CAUSEWAY_END_Y.value - Y) * (sg.s / total);
        ys[i] = Math.max(line, grd(sg.xm, sg.zm) + 0.35);
      }
      for (let pass = 0; pass < 6; pass++) {
        for (let i = 1; i < N - 1; i++) {
          ys[i] = ((ys[i - 1] as number) + 2 * (ys[i] as number) + (ys[i + 1] as number)) / 4;
        }
      }
      for (let i = 0; i < N; i++) {
        const sg = segs[i] as Seg;
        const { xm, zm, yaw, segL } = sg;
        const ym = ys[i] as number;
        const yPrev = ys[Math.max(i - 1, 0)] as number;
        const yNext = ys[Math.min(i + 1, N - 1)] as number;
        if (i + 1 < N && Math.abs(yNext - ym) / segL > cwMaxGrade) {
          cwMaxGrade = Math.abs(yNext - ym) / segL;
          cwMaxAt = i;
        }
        // seal against the graded neighbours (Khufu's rule)
        const rise = Math.max(0.02, Math.abs(yNext - ym), Math.abs(yPrev - ym));
        const L = segL * 1.6;
        const ex = Math.cos(yaw);
        const ez = Math.sin(yaw);
        const gs = [
          grd(xm - ex * (L / 2), zm - ez * (L / 2)),
          grd(xm + ex * (L / 2), zm + ez * (L / 2)),
          grd(xm - ez * (w / 2 + 1.2), zm + ex * (w / 2 + 1.2)),
          grd(xm + ez * (w / 2 + 1.2), zm - ex * (w / 2 + 1.2)),
        ];
        const gMin = Math.min(...gs);
        const embBase = Math.min(ym - 1, gMin - 2);
        cWalls.box(xm, embBase, zm, L, ym - embBase + rise, w + 2.4, 0.93, 0.004, yaw);
        cFloor.box(xm, ym - 0.02, zm, L, 0.16 + rise, w - wallTh * 2, t.range(0.94, 1.0), 0, yaw);
        const off = w / 2 - wallTh / 2;
        for (const sd of [-1, 1]) {
          cWalls.box(
            xm - Math.sin(yaw) * sd * off, ym, zm + Math.cos(yaw) * sd * off,
            L, wallH + rise, wallTh, 0.97 + t.range(-0.02, 0.02), 0.03, yaw,
          );
        }
        // the roof slabs with the central light slit (0.8 m — Khufu's formula)
        const roofHalf = (w - 0.45) / 4 + 0.45 / 2;
        for (const sd of [-1, 1]) {
          cWalls.box(
            xm - Math.sin(yaw) * sd * roofHalf, ym + wallH, zm + Math.cos(yaw) * sd * roofHalf,
            L, 0.5 + rise, (w - 0.45) / 2 - 0.35, 0.96, 0, yaw,
          );
        }
        if (sg.j % 6 === 0) {
          const fhx = (segL * 6) / 2;
          const fhz = (w + 2.4) / 2;
          const corner = (lx: number, lz: number): number =>
            grd(xm + lx * ex - lz * ez, zm + lx * ez + lz * ex);
          const gTop = Math.max(corner(-fhx, -fhz), corner(fhx, -fhz), corner(fhx, fhz), corner(-fhx, fhz));
          fpReg({
            id: `khafre:causeway:${i}`, family: 'khafre-causeway', x: xm, z: zm,
            hx: fhx, hz: fhz, y0: embBase, y1: ym + wallH + 0.7, yFloor: ym,
            yaw, ground: 'grounded', allow: ['khafre-temple', 'khafre-temenos', 'khafre-pavement'],
            cutting: Math.max(gTop, ...gs) > ym + 1.5,
            conf: 'D', basis: "the route bent round the provisional enclosure; Khufu's section", epoch: EPOCH,
          });
        }
      }
      // the bend: a square block (pedestal, floor, walls' outer corner, roof)
      // at the mean heading closes the mitre between the two legs
      {
        const [bx, bz] = KHAFRE_CAUSEWAY[1] as readonly [number, number];
        const k = legs[0] as number;
        const yb = ((ys[k - 1] as number) + (ys[k] as number)) / 2;
        const ya = ((segs[k - 1] as Seg).yaw + (segs[k] as Seg).yaw) / 2;
        const gMin = Math.min(grd(bx - 6, bz - 6), grd(bx + 6, bz - 6), grd(bx + 6, bz + 6), grd(bx - 6, bz + 6));
        const embBase = Math.min(yb - 1, gMin - 2);
        const rise = Math.abs((ys[k] as number) - (ys[k - 1] as number)) + 0.02;
        cWalls.box(bx, embBase, bz, 3.2, yb - embBase + rise, w + 2.4, 0.93, 0.004, ya);
        cFloor.box(bx, yb - 0.02, bz, 3.2, 0.16 + rise, w - wallTh * 2, 0.97, 0, ya);
        const off = w / 2 - wallTh / 2;
        const roofHalf = (w - 0.45) / 4 + 0.45 / 2;
        for (const sd of [-1, 1]) {
          cWalls.box(bx - Math.sin(ya) * sd * off, yb, bz + Math.cos(ya) * sd * off, 3.2, wallH + rise, wallTh, 0.97, 0.03, ya);
          cWalls.box(bx - Math.sin(ya) * sd * roofHalf, yb + wallH, bz + Math.cos(ya) * sd * roofHalf, 3.2, 0.5 + rise, (w - 0.45) / 2 - 0.35, 0.96, 0, ya);
        }
      }
    }

    /* --- the valley temple: granite outside, megalithic, a flat roof, two
     *     east doorways, the T-shaped hall of 16 granite pillars (VII:318) -- */
    {
      const t = seed.rng('khafre-valley');
      const vWalls = writer('khafre-valley-walls', () =>
        limestoneMaterial(GRANITE, gi, 1.6, 2.4, { rough: 0.55, spec: 0.45 }));
      const vFloor = writer('khafre-valley-floor', turaMat);
      const vRoof = writer('khafre-valley-roof', localMat);
      const vPillars = writer('khafre-valley-pillars', graniteMono);
      const S = KHAFRE_VT_SIDE.value;
      const vx = KHAFRE_VT_CENTER.x;
      const vz = KHAFRE_VT_CENTER.z;
      const x0 = vx - S / 2;
      const x1 = vx + S / 2;
      const z0 = vz - S / 2;
      const z1 = vz + S / 2;
      const th = 3.0;
      const h = KHAFRE_VT_H.value + 0.6; // the roof at +13, a 0.6 m parapet over it
      const roofY = F + KHAFRE_VT_H.value - 0.6;
      vFloor.box(vx, F + 0.02, vz, S - 2 * th, 0.16, S - 2 * th, 1.0);
      enclosure(vWalls, x0, x1, z0, z1, F, h, th, 1.0, [], [
        { z: vz - 12, half: 1.6, hgt: 6.0 },
        { z: vz + 12, half: 1.6, hgt: 6.0 },
      ]);
      // the roof: slabs into the walls' battered inner faces
      vRoof.box(vx, roofY, vz, S - 2 * (th - 0.6), 0.6, S - 2 * (th - 0.6), 0.95);
      const pillar = (x: number, z: number): void =>
        vPillars.box(x, F + 0.18, z, 1.05, roofY - F - 0.18, 1.05, 1 + t.range(-0.04, 0.04));
      // the T: its bar of six along the east front, its stem of two rows of five
      for (let k = 0; k < 6; k++) pillar(x1 - 9.5, z0 + 7 + k * 6.2);
      for (const pz of [vz - 3.5, vz + 3.5]) for (let k = 0; k < 5; k++) pillar(x0 + 6.5 + k * 5.5, pz);
      fpReg({
        id: 'khafre:valley', family: 'khafre-temple', x: vx, z: vz, hx: S / 2, hz: S / 2,
        y0: F, y1: F + h, ground: 'platform', allow: ['khafre-causeway'],
        conf: 'D', basis: 'the ≈ 45 m square (C); walls, roof, doors and the T-hall reconstructed; the inner descending passage not modelled', epoch: EPOCH,
      });
    }

    /* --- the Sphinx Temple: massive limestone, an open court in a roofed
     *     granite-pillared ambulatory (light from the court, VII:241), two
     *     east doorways, niches on the axis west and east (VII:211-225) ---- */
    {
      const t = seed.rng('khafre-sphinx-temple');
      const sWalls = writer('khafre-sphinx-temple-walls', () => limestoneMaterial(LOCAL, gi, 2.0, 3.0));
      const sFloor = writer('khafre-sphinx-temple-floor', turaMat);
      const sRoof = writer('khafre-sphinx-temple-roof', localMat);
      const sPillars = writer('khafre-sphinx-temple-pillars', graniteMono);
      const S = SPHINX_TEMPLE_SIDE.value;
      const tx = SPHINX_TEMPLE_CENTER.x;
      const tz = SPHINX_TEMPLE_CENTER.z;
      const x0 = tx - S / 2;
      const x1 = tx + S / 2;
      const z0 = tz - S / 2;
      const z1 = tz + S / 2;
      const th = 3.0;
      const h = SPHINX_TEMPLE_H.value;
      sFloor.box(tx, F + 0.02, tz, S - 2 * th, 0.16, S - 2 * th, 1.0);
      enclosure(sWalls, x0, x1, z0, z1, F, h, th, 0.97,
        [{ z: tz, half: 2.5, hgt: 6.0, niche: true }],
        [
          { z: tz - 12, half: 1.6, hgt: 5.5 },
          { z: tz, half: 2.5, hgt: 6.0, niche: true },
          { z: tz + 12, half: 1.6, hgt: 5.5 },
        ],
      );
      // 24 granite pillars on the court's square, 26 m on a side
      const ring = 13;
      const top = 6.6;
      for (let k = 0; k < 7; k++) {
        const a = -ring + (k * 2 * ring) / 6;
        const ps: [number, number][] = [[a, -ring], [a, ring]];
        if (k > 0 && k < 6) ps.push([-ring, a], [ring, a]);
        for (const [px, pz] of ps) {
          sPillars.box(tx + px, F + 0.18, tz + pz, 1.05, top - 0.18, 1.05, 1 + t.range(-0.04, 0.04));
        }
      }
      // the ambulatory's roof: four strips from the walls to the pillar line,
      // the court left open
      const wIn = S / 2 - th + 0.5; // into the walls' battered inner faces
      const cIn = ring - 0.6; // resting on the pillars
      const strip = (x: number, z: number, lx: number, lz: number): void =>
        sRoof.box(tx + x, F + top, tz + z, lx, 0.6, lz, 0.95);
      strip(0, -(wIn + cIn) / 2, 2 * wIn, wIn - cIn);
      strip(0, (wIn + cIn) / 2, 2 * wIn, wIn - cIn);
      strip(-(wIn + cIn) / 2, 0, wIn - cIn, 2 * cIn);
      strip((wIn + cIn) / 2, 0, wIn - cIn, 2 * cIn);
      fpReg({
        id: 'khafre:sphinx-temple', family: 'khafre-temple', x: tx, z: tz, hx: S / 2, hz: S / 2,
        y0: F, y1: F + h, ground: 'platform',
        conf: 'D', basis: "the canon's form (massive limestone, granite elements, an open court); the size and plan reconstructed", epoch: EPOCH,
      });
    }
  }

  /* --- materialize: one mesh per building and material (canon VII's
   *     hierarchy — `?hide=khafre-valley` etc.) ------------------------------ */
  for (const { name, w, mat } of meshes) {
    if (w.pos.length === 0) continue;
    const m = new Mesh(w.build(), mat());
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  return { slabs, cwSegs, cwMaxGrade: Math.round(cwMaxGrade * 1000), cwMaxAt };
}
