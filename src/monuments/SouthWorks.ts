/**
 * South of the enclosure (v1.2 I5) — plan docs/plans/I5_PLAN.md §3.2–3.3.
 *
 * D-7, THE RAMP REMNANT (variant A). Canon: "partially dismantled ramps, sled
 * tracks"; "Temporary ramps, stone staging areas, and worker activity may
 * still exist"; "Waste should appear managed rather than randomly
 * scattered"; brief "Remnant ramp(s) per chosen hypothesis". The court is
 * finished and walled, so the supply ramp inside the enclosure is gone; its
 * body outside the south wall (cut back 8 m from it) is being taken down
 * from the QUARRY END, its fill carried back to the quarry's worked-out
 * bays, its mud brick salvaged:
 *  - the HEAD: a vertical cut face where the ramp was severed, its fill in
 *    bands (limestone chips, tafl, gypsum debris), the brick walls in section
 *  - the INTACT stretch: the old track with timber cross-sleepers
 *  - the WORKING FRONT: two lifts cut down, risers facing the quarry, the
 *    retaining walls broken where the brick is coming out
 *  - the CLEARED toe: a low rubble tongue and the wall footings
 *  - beside it, sorted: salvaged brick in stacks, stone fragments and tafl
 *    in separate heaps; a dump at the quarry's lip; diggers with hoes,
 *    basket fillers, carriers, an overseer, a scribe tallying baskets
 *
 * THE ROYAL WORKS YARD on the flat strip south of the enclosure — canon:
 * "Fine limestone staging. Granite storage. Stone dressing areas", "Storage
 * architecture should separate materials", brief "stone stockpiles staged
 * by size": the granite store fenced apart (four pillars the exact size of
 * the mortuary temple's, three architraves, a half-dressed pillar at the
 * pounding station — granite was dressed by pounding with dolerite balls,
 * not cut with copper), Tura limestone in three rows by size (casing,
 * standard blocks, paving slabs) with red control marks, the dressing area,
 * the scribe's tally under a reed shade, a block leaving on its sledge.
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { fpReg } from '../debug/Footprints';
import { earthMaterial } from '../vegetation/Basins';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';
import { ColorWriter, addTownsfolk, person, reedRoof, townsfolkMesh, type C3 } from './Townsfolk';
import type { Gang } from './Inhabitants';

const FAMILY_RAMP = 'ramp-remnant';
const FAMILY_YARD = 'works-yard';
const FILL: C3 = [0.62, 0.56, 0.44]; // compacted fill, tafl-toned track
const RUBBLE: C3 = [0.56, 0.52, 0.43];
const CHIPS: C3 = [0.78, 0.75, 0.66];
const TAFL: C3 = [0.55, 0.48, 0.36];
const GYPSUM: C3 = [0.9, 0.88, 0.82];
const BASKET: C3 = [0.58, 0.48, 0.3];
const COPPER: C3 = [0.55, 0.35, 0.2];
const OCHRE: C3 = [0.55, 0.18, 0.12];
const DOLERITE: C3 = [0.25, 0.25, 0.24];
const WOOD: C3 = [0.42, 0.31, 0.19];

/** the ramp's axis: head (by the wall) → toe (toward the quarry) */
const HEAD: [number, number] = [-8, 147];
const TOE: [number, number] = [10, 236];

/** the gangs at work here (Inhabitants extras, appended last) */
export const southLines: Gang[] = [
  // basket carriers: the ramp's fill back to the quarry's worked-out bays
  { x0: 18, z0: 210, x1: 45, z1: 302, n: 12, spread: 2, carry: 0.85, still: 0.1 },
  // the gang at the working front, on the spoil side
  { x0: 14, z0: 186, x1: 20, z1: 210, n: 8, spread: 3, carry: 0.2, still: 0.7 },
  // the works yard
  { x0: -118, z0: 165, x1: -56, z1: 145, n: 8, spread: 6, carry: 0.3, still: 0.75 },
];

export interface SouthInfo {
  rampSegments: number;
  tura: number;
  granite: number;
}

export function buildSouthWorks(scene: Object3D, seed: WorldSeed, hf: Heightfield, gi: ProbeGI | null): SouthInfo {
  const rng = seed.rng('south-works');
  const folkRng = seed.rng('south-folk');
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const fill = new ColorWriter();
  const props = new ColorWriter();
  const folk = new ColorWriter();
  const mud = new GeoWriter();
  const rubble = new GeoWriter();
  const tura = new GeoWriter();
  const granite = new GeoWriter();
  const wood = new GeoWriter();
  const info: SouthInfo = { rampSegments: 0, tura: 0, granite: 0 };

  /* --- the ramp remnant ---------------------------------------------------- */
  const LEN = Math.hypot(TOE[0] - HEAD[0], TOE[1] - HEAD[1]);
  const ux = (TOE[0] - HEAD[0]) / LEN;
  const uz = (TOE[1] - HEAD[1]) / LEN;
  const YAW = Math.atan2(uz, ux);
  /** axis frame: s along the ramp from the head, sd toward its east side */
  const P = (s: number, sd: number): [number, number] => [HEAD[0] + ux * s + uz * sd, HEAD[1] + uz * s - ux * sd];
  const groundSpan = (s0: number, s1: number, half: number): [number, number, number] => {
    const g: number[] = [];
    for (const s of [s0, (s0 + s1) / 2, s1]) for (const sd of [-half, 0, half]) g.push(grd(...P(s, sd)));
    return [Math.min(...g), Math.max(...g), grd(...P((s0 + s1) / 2, 0))];
  };
  /** height of the fill over the ground's high side, by station */
  const profile = (s: number): number => {
    if (s < 6) return 5.6;
    if (s < 40) return 5.4 + ((3.0 - 5.4) * (s - 6)) / 34;
    if (s < 49) return 2.0;
    if (s < 58) return 1.0;
    return 0.6 + ((0.1 - 0.6) * (s - 58)) / (LEN - 58);
  };
  const tops: { s0: number; s1: number; top: number }[] = [];
  const topAt = (s: number): number => {
    const t = tops.find((q) => s >= q.s0 && s < q.s1) ?? tops[tops.length - 1]!;
    return t.top;
  };
  // the body, in 2-ish m pieces, each seated on its own ground
  const pieces: [number, number][] = [[0, 6]];
  for (let k = 0; k < 16; k++) pieces.push([6 + k * 2.125, 6 + (k + 1) * 2.125]);
  for (let k = 0; k < 9; k++) pieces.push([40 + k * 2, 42 + k * 2]);
  for (let k = 0; k < 8; k++) pieces.push([58 + (k * (LEN - 58)) / 8, 58 + ((k + 1) * (LEN - 58)) / 8]);
  for (const [s0, s1] of pieces) {
    const cleared = s0 >= 58;
    const [lo, hi, mid] = groundSpan(s0, s1, cleared ? 11 : 9);
    const y0 = lo - 0.3;
    const h = profile((s0 + s1) / 2);
    const top = cleared ? mid + h : hi + h;
    tops.push({ s0, s1, top });
    const [cx, cz] = P((s0 + s1) / 2, 0);
    const len = s1 - s0 + 0.02;
    fill.box(cx, y0, cz, len, top - y0, cleared ? 22 : 15.6, cleared ? RUBBLE : FILL, YAW);
    // the retaining walls (footings only on the cleared toe), broken at the
    // front where the brick is coming out
    for (const side of [-1, 1]) {
      const sm = (s0 + s1) / 2;
      if (side > 0 && sm > 42 && sm < 47) continue;
      if (side < 0 && sm > 50 && sm < 55) continue;
      const [wx, wz] = P(sm, side * 8.4);
      const wTop = cleared ? grd(wx, wz) + 0.4 : top;
      mud.box(wx, y0, wz, len, wTop - y0, 1.2, rng.range(0.52, 0.6), 0, YAW, 0.12);
    }
    info.rampSegments++;
  }
  // the cut face: the fill in bands, laid on the severed end
  {
    const t0 = tops[0]!.top;
    const [lo] = groundSpan(0, 6, 9);
    let y = lo;
    const bands: C3[] = [CHIPS, TAFL, CHIPS, GYPSUM, TAFL, CHIPS, TAFL, GYPSUM, CHIPS];
    for (let k = 0; y < t0 - 0.05; k++) {
      const bh = Math.min(t0 - y, rng.range(0.35, 0.8));
      const [bx, bz] = P(-0.012, rng.range(-0.3, 0.3));
      props.box(bx, y, bz, 0.03, bh, 15.4, bands[k % bands.length]!, YAW);
      y += bh;
    }
  }
  // the old track: timber cross-sleepers along the intact stretch
  for (let s = 7; s < 39.5; s += 1.6) {
    const [sx, sz] = P(s, 0);
    wood.box(sx, topAt(s) - 0.04, sz, 0.25, 0.15, 10, rng.range(0.85, 1.0), 0, YAW);
  }
  fpReg({ id: 'ramp:head', family: FAMILY_RAMP, ...ctr(P, 3, 0), hx: 3, hz: 9.6, yaw: YAW, y0: groundSpan(0, 6, 9)[0] - 0.3, y1: tops[0]!.top, ground: 'grounded' });
  for (let k = 0; k < 4; k++) {
    const s0 = 6 + k * 8.5;
    const [lo] = groundSpan(s0, s0 + 8.5, 9);
    fpReg({ id: `ramp:upper:${k}`, family: FAMILY_RAMP, ...ctr(P, s0 + 4.25, 0), hx: 4.25, hz: 9.6, yaw: YAW, y0: lo - 0.3, y1: topAt(s0 + 4), ground: 'grounded' });
  }
  for (let k = 0; k < 2; k++) {
    const s0 = 40 + k * 9;
    const [lo] = groundSpan(s0, s0 + 9, 9);
    // `cutting`: the lifts are cut DOWN into the fill — on ground rising
    // toward the quarry a 1 m tread stands low on its uphill side by design
    // (its top never drops below the ground: top = highest ground + lift)
    fpReg({ id: `ramp:front:${k}`, family: FAMILY_RAMP, ...ctr(P, s0 + 4.5, 0), hx: 4.5, hz: 9.6, yaw: YAW, y0: lo - 0.3, y1: topAt(s0 + 4), ground: 'grounded', cutting: true });
  }
  // the cleared toe is a low spread that follows the ground (ground: none)
  fpReg({ id: 'ramp:toe', family: FAMILY_RAMP, ...ctr(P, (58 + LEN) / 2, 0), hx: (LEN - 58) / 2, hz: 11, yaw: YAW, y0: groundSpan(58, LEN, 11)[0] - 0.3, y1: topAt(60), ground: 'none', passive: true });

  /* the salvage, sorted, on the east side (toward the haul road) */
  for (let k = 0; k < 4; k++) {
    const [bx, bz] = P(44 + k * 4, 17.5 + (k % 2) * 0.6);
    const g = grd(bx, bz) - 0.05;
    mud.box(bx, g, bz, 2.0, 1.0, 1.2, rng.range(0.55, 0.62), 0.02, YAW + rng.range(-0.08, 0.08));
    fpReg({ id: `bricks:${k}`, family: FAMILY_RAMP, x: bx, z: bz, hx: 1.0, hz: 0.6, yaw: YAW, y0: g, y1: g + 1.0, ground: 'grounded' });
  }
  for (const [k, [s, sd, r, h, tone]] of ([[52, 21.5, 2.0, 1.1, 0.8], [61, 21, 2.0, 1.0, 0.77], [70, 20.5, 1.8, 0.9, 0.92]] as const).entries()) {
    const [hx, hz] = P(s, sd);
    const g = grd(hx, hz) - 0.08;
    rubble.drum(hx, g, hz, r, h, tone, r / h * 0.9, 14);
    fpReg({ id: `spoil:${k}`, family: FAMILY_RAMP, x: hx, z: hz, hx: r * 0.8, hz: r * 0.8, y0: g, y1: g + h, ground: 'grounded' });
  }
  // the dump at the quarry's lip, a tongue down the first bay
  {
    const dx = 45;
    const dz = 302;
    for (let k = 0; k < 4; k++) {
      const z = dz + k * 3.2;
      rubble.drum(dx + k * 0.4, grd(dx + k * 0.4, z) - 0.1, z, 4 - k * 0.8, 2 - k * 0.4, 0.8, 1.5, 14);
    }
    const g = grd(dx, dz);
    fpReg({ id: 'ramp:dump', family: FAMILY_RAMP, x: dx, z: dz + 3, hx: 4, hz: 6.5, y0: g - 0.1, y1: g + 2, ground: 'none' });
  }

  /* the people at the front and the toe */
  {
    const onRamp = (s: number, sd: number, yawOff: number, pose: 'stand' | 'kneel' | 'squat'): [number, number, number] => {
      const [x, z] = P(s, sd);
      const y = topAt(s);
      person(folk, folkRng, x, y, z, YAW + Math.PI + yawOff, pose);
      return [x, y, z];
    };
    // diggers with copper-bladed hoes, facing the riser they cut (north)
    for (const [s, sd] of [[42.5, -4.5], [43.2, 0.6], [42.8, 5.2], [51.5, -3.2], [52.2, 2.0], [51.8, 6.0]] as const) {
      const [x, y, z] = onRamp(s, sd, folkRng.range(-0.3, 0.3), 'stand');
      const [hx, hz] = P(s - 0.9, sd);
      folk.beam([x - ux * 0.25, y + 1.0, z - uz * 0.25], [hx, y + 0.15, hz], 0.025, WOOD);
      folk.box(hx, y + 0.02, hz, 0.22, 0.04, 0.16, COPPER, YAW);
    }
    // basket fillers kneeling, a basket beside each
    for (const [s, sd] of [[45, -2], [46, 3.5], [54.5, -1], [55, 4.5]] as const) {
      onRamp(s, sd, 0.4, 'kneel');
      const [bx, bz] = P(s + 0.2, sd + 0.8);
      props.box(bx, topAt(s), bz, 0.55, 0.32, 0.55, BASKET, YAW);
    }
    // two carriers with full baskets on the head, stepping off the front
    for (const [s, sd] of [[57, 7], [59.5, 8.5]] as const) {
      const [x, y, z] = onRamp(s, sd, Math.PI, 'stand');
      folk.box(x, y + 1.72, z, 0.5, 0.3, 0.5, BASKET, YAW);
    }
    // the overseer with his staff on the intact top
    {
      const [x, y, z] = onRamp(38, 2.5, 0, 'stand');
      folk.beam([x + 0.25, y, z + 0.1], [x + 0.25, y + 1.9, z + 0.1], 0.02, WOOD);
    }
    // a scribe on a mat at the toe, tallying baskets
    {
      const [x, z] = P(84, 14);
      const g = grd(x, z);
      props.box(x, g, z, 1.4, 0.03, 0.9, [0.55, 0.47, 0.3], YAW);
      person(folk, folkRng, x, g + 0.03, z, YAW + Math.PI / 2, 'sit');
      const [bx, bz] = P(84, 13.6);
      folk.box(bx, g + 0.42, bz, 0.36, 0.03, 0.26, [0.72, 0.66, 0.52], YAW);
    }
  }

  /* --- the royal works yard ------------------------------------------------- */
  const Y0 = (x: number, z: number): number => grd(x, z);
  fpReg({ id: 'yard:ground', family: FAMILY_YARD, x: -87, z: 155, hx: 35, hz: 12, y0: Y0(-87, 155) - 0.1, y1: Y0(-87, 155) + 0.2, ground: 'none', passive: true });

  // the granite store, fenced apart, open 2 m to the east
  {
    const fence = (id: string, ax: number, az: number, bx: number, bz: number): void => {
      const len = Math.hypot(bx - ax, bz - az);
      const along = Math.abs(bz - az) > Math.abs(bx - ax);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const g = Math.min(Y0(ax, az), Y0(bx, bz)) - 0.08;
      mud.box(mx, g, mz, along ? 0.9 : len, 1.45, along ? len : 0.9, rng.range(0.54, 0.6), 0.03);
      fpReg({ id: `yard:fence:${id}`, family: FAMILY_YARD, x: mx, z: mz, hx: along ? 0.45 : len / 2, hz: along ? len / 2 : 0.45, y0: g, y1: g + 1.45, ground: 'grounded' });
    };
    fence('n', -122, 143.4, -100, 143.4);
    fence('s', -122, 166.6, -100, 166.6);
    fence('w', -121.55, 143.85, -121.55, 166.15);
    fence('e1', -100.45, 143.85, -100.45, 150.6);
    fence('e2', -100.45, 152.6, -100.45, 166.15);

    // four pillars, the size of the mortuary temple's, on timber sleepers
    for (const [k, z] of [147, 150, 153, 156].entries()) {
      const x = -114 + rng.range(-0.4, 0.4);
      const g = Y0(x, z);
      for (const dx of [-1.8, 1.8]) wood.box(x + dx, g - 0.02, z, 0.3, 0.2, 1.6, 0.8);
      granite.box(x, g + 0.18, z, 5.2, 1.3, 1.3, rng.range(0.94, 1.04), 0.003, rng.range(-0.02, 0.02));
      if (k % 2 === 0) for (const dx of [-1.9, 1.9]) granite.box(x + dx, g + 1.48, z, 0.35, 0.4, 0.35, 1.0);
      fpReg({ id: `yard:granite:${k}`, family: FAMILY_YARD, x, z, hx: 2.6, hz: 0.8, y0: g, y1: g + 1.9, ground: 'grounded' });
      info.granite++;
    }
    // three architraves (the harbour's roofing-beam class)
    for (const [k, z] of [159.6, 161.95, 164.3].entries()) {
      const L = rng.range(5.2, 7.4);
      const hh = rng.range(1.1, 1.5);
      const d = rng.range(1.2, 1.5);
      const x = -112.5;
      const g = Y0(x, z);
      for (const dx of [-L / 2 + 0.8, L / 2 - 0.8]) wood.box(x + dx, g - 0.02, z, 0.3, 0.2, d + 0.3, 0.8);
      granite.box(x, g + 0.18, z, L, hh, d, rng.range(0.9, 1.02), 0.003);
      fpReg({ id: `yard:granite:${4 + k}`, family: FAMILY_YARD, x, z, hx: L / 2, hz: d / 2 + 0.15, y0: g, y1: g + 0.18 + hh, ground: 'grounded' });
      info.granite++;
    }
    // the pounding station by the opening: a pillar half-dressed, the
    // pounders, a heap of dolerite balls
    {
      const x = -105;
      const z = 151.6;
      const g = Y0(x, z);
      for (const dx of [-1.8, 1.8]) wood.box(x + dx, g - 0.02, z, 0.3, 0.2, 1.6, 0.8);
      granite.box(x - 1.3, g + 0.18, z, 2.6, 1.3, 1.3, 1.02, 0.003); // dressed
      granite.box(x + 1.3, g + 0.14, z, 2.6, 1.42, 1.44, 0.8, 0.02); // still rough
      for (const dz of [-1.25, 1.25]) {
        person(folk, folkRng, x + 1.2, g, z + dz, dz > 0 ? -Math.PI / 2 : Math.PI / 2, 'squat');
      }
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const r = k < 8 ? 0.32 : 0.12;
        props.box(x + 2.9 + Math.cos(a) * r, g + (k < 8 ? 0 : 0.2), z + 2.4 + Math.sin(a) * r, 0.24, 0.22, 0.24, DOLERITE, a);
      }
      fpReg({ id: 'yard:granite:pounding', family: FAMILY_YARD, x, z, hx: 2.7, hz: 0.8, y0: g, y1: g + 1.6, ground: 'grounded' });
      info.granite++;
    }
  }

  // Tura limestone staged by size: casing, standard blocks, paving
  for (const [k, z] of [148, 155, 162].entries()) {
    const g = Y0(-82, z);
    for (const dz of [-0.45, 0.45]) wood.box(-82, g - 0.02, z + dz, 28, 0.18, 0.22, 0.8);
    let x = -95.4;
    let deep = 0;
    while (x < -69) {
      let lx: number;
      let lz: number;
      if (k === 0) {
        lx = rng.range(2.0, 2.4);
        const h = rng.range(1.1, 1.3);
        lz = rng.range(1.2, 1.4);
        tura.box(x + lx / 2, g + 0.16, z, lx, h, lz, rng.range(0.94, 1.04), 0.004);
        if (rng.chance(0.2)) props.box(x + lx / 2, g + 0.16 + h * 0.5, z + lz / 2 + 0.006, 0.25, 0.12, 0.012, OCHRE);
      } else if (k === 1) {
        lx = rng.range(1.3, 1.9);
        const h = rng.range(0.9, 1.3);
        lz = rng.range(1.0, 1.4);
        tura.box(x + lx / 2, g + 0.16, z, lx, h, lz, rng.range(0.9, 1.04), 0.004);
        if (rng.chance(0.45)) {
          const h2 = rng.range(0.8, h);
          tura.box(x + lx / 2 + rng.range(-0.08, 0.08), g + 0.16 + h, z, lx * 0.92, h2, lz * 0.9, rng.range(0.9, 1.04), 0.004);
        }
        if (rng.chance(0.2)) props.box(x + lx / 2, g + 0.16 + h * 0.5, z + lz / 2 + 0.006, 0.25, 0.12, 0.012, OCHRE);
      } else {
        lx = rng.range(1.1, 1.9);
        lz = rng.range(0.85, 1.3);
        const n = 6 + rng.int(4);
        for (let s = 0; s < n; s++) {
          tura.box(x + lx / 2 + rng.range(-0.04, 0.04), g + 0.16 + s * 0.145, z, lx, 0.14, lz, rng.range(0.92, 1.05), 0, rng.range(-0.02, 0.02));
        }
      }
      deep = Math.max(deep, lz);
      x += lx + rng.range(0.35, 0.6);
      info.tura++;
    }
    fpReg({ id: `yard:tura:${k}`, family: FAMILY_YARD, x: (-95.4 + x) / 2, z, hx: (x + 95.4) / 2, hz: deep / 2, y0: g, y1: g + 2.6, ground: 'grounded' });
  }

  // the dressing area and the tally
  {
    for (const [k, [bx, bz]] of ([[-61, 149], [-56.5, 151.5]] as const).entries()) {
      const g = Y0(bx, bz);
      tura.box(bx, g, bz, 2.2, 0.75, 1.2, 1.0, 0.004); // the dressed lower part
      tura.box(bx, g + 0.75, bz, 2.32, 0.55, 1.32, 0.86, 0.02); // the rough top, coming down
      person(folk, folkRng, bx + 1.6, g, bz, Math.PI, 'squat');
      folk.box(bx + 1.25, g + 0.55, bz + 0.15, 0.2, 0.14, 0.14, WOOD, 0.3); // mallet
      folk.box(bx + 1.25, g + 0.6, bz - 0.12, 0.2, 0.03, 0.03, COPPER, 0.2); // chisel
      if (k === 0) person(folk, folkRng, bx, g, bz - 1.4, Math.PI / 2, 'kneel');
      fpReg({ id: `yard:dressing:${k}`, family: FAMILY_YARD, x: bx, z: bz, hx: 1.16, hz: 0.66, y0: g, y1: g + 1.3, ground: 'grounded' });
    }
    // a mason's square on the ground, the chip heap
    const g0 = Y0(-59, 153.5);
    folk.box(-59, g0, 153.5, 1.0, 0.04, 0.06, WOOD, 0);
    folk.box(-59.47, g0, 153.95, 0.06, 0.04, 0.9, WOOD, 0);
    rubble.drum(-62.5, g0 - 0.05, 152.8, 1.4, 0.35, 0.92, 2.5, 12);
    for (let k = 0; k < 30; k++) {
      const a = rng.float() * Math.PI * 2;
      const r = rng.range(0.3, 2.6);
      const cx = -62.5 + Math.cos(a) * r;
      const cz = 152.8 + Math.sin(a) * r;
      props.box(cx, Y0(cx, cz), cz, rng.range(0.06, 0.16), rng.range(0.03, 0.07), rng.range(0.05, 0.12), CHIPS, rng.float() * 3);
    }
    // the tally: a reed shade, the scribe and the overseer
    const tx = -57.5;
    const tz = 161;
    const g = Y0(tx, tz) - 0.05;
    for (const [dx, dz] of [[-1.9, -1.5], [1.9, -1.5], [-1.9, 1.5], [1.9, 1.5]] as const) props.box(tx + dx, g, tz + dz, 0.12, 2.25, 0.12, WOOD);
    reedRoof(props, [tx - 2.1, g + 2.25, tz - 1.7], [tx + 2.1, g + 2.25, tz - 1.7], [tx + 2.1, g + 2.25, tz + 1.7], [tx - 2.1, g + 2.25, tz + 1.7], [0.62, 0.55, 0.37]);
    props.box(tx - 0.4, g + 0.05, tz, 1.4, 0.03, 0.9, [0.55, 0.47, 0.3]);
    person(folk, folkRng, tx - 0.4, g + 0.08, tz, -Math.PI / 2, 'sit');
    folk.box(tx - 0.4, g + 0.47, tz - 0.32, 0.36, 0.03, 0.26, [0.72, 0.66, 0.52]);
    person(folk, folkRng, tx + 1.0, g + 0.05, tz - 0.6, -Math.PI / 2 - 0.5, 'stand', 1, [0.9, 0.87, 0.78]);
    fpReg({ id: 'yard:tally', family: FAMILY_YARD, x: tx, z: tz, hx: 2.1, hz: 1.7, y0: g, y1: g + 2.35, ground: 'grounded' });
  }

  // a block leaves on its sledge, the rope team ahead, water poured before
  // the runners
  {
    const sx = -46;
    const sz = 155;
    const g = Y0(sx, sz);
    for (const dz of [-0.6, 0.6]) wood.box(sx, g - 0.02, sz + dz, 3.6, 0.22, 0.3, 0.8);
    wood.box(sx, g + 0.2, sz, 3.4, 0.14, 1.5, 0.85);
    tura.box(sx, g + 0.34, sz, 2.2, 1.2, 1.3, 1.0, 0.004);
    for (const dz of [-0.4, 0.4]) {
      folk.beam([sx + 1.7, g + 0.25, sz + dz], [sx + 11.5, g + 0.9, sz + dz * 3], 0.02, [0.6, 0.52, 0.36]);
    }
    for (let k = 0; k < 6; k++) {
      const px = sx + 5.2 + Math.floor(k / 2) * 2.2;
      const pz = sz + (k % 2 === 0 ? -1.0 : 1.0);
      person(folk, folkRng, px, Y0(px, pz), pz, 0, 'stand');
    }
    const wx = sx + 2.6;
    person(folk, folkRng, wx, Y0(wx, sz - 1.4), sz - 1.4, Math.PI / 2, 'stand');
    folk.box(wx + 0.3, Y0(wx, sz) + 0.9, sz - 1.0, 0.3, 0.36, 0.3, [0.6, 0.4, 0.26], Math.PI / 4);
    props.box(wx + 0.3, Y0(wx, sz) - 0.01, sz, 1.6, 0.02, 1.6, [0.4, 0.33, 0.26]); // the wetted ground
    fpReg({ id: 'yard:sledge', family: FAMILY_YARD, x: sx, z: sz, hx: 1.8, hz: 0.9, y0: g, y1: g + 1.6, ground: 'grounded' });
  }

  /* --- materialize ------------------------------------------------------------ */
  const mono = { rough: 0.62, spec: 0.4 }; // monoliths: no joint lines
  const meshes = [
    new Mesh(fill.build(), earthMaterial(gi)),
    new Mesh(mud.build(), limestoneMaterial([0.56, 0.46, 0.34], gi, 0.3, 0.45)),
    new Mesh(rubble.build(), limestoneMaterial([0.66, 0.62, 0.52], gi, 0.5)),
    new Mesh(tura.build(), limestoneMaterial([0.85, 0.825, 0.77], gi, 50, 50, { rough: 0.7 })),
    new Mesh(granite.build(), limestoneMaterial([0.6, 0.39, 0.34], gi, 50, 50, mono)),
    new Mesh(wood.build(), limestoneMaterial([0.36, 0.27, 0.17], gi, 0.24, 0.32, { rough: 0.8 })),
  ];
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'south-works';
    scene.add(m);
  }
  // the props writer holds no figures: addTownsfolk would drop it
  if (props.pos.length > 0) scene.add(townsfolkMesh(props, gi, 'south-works'));
  addTownsfolk(scene, folk, gi, 'south-works');
  return info;
}

/** a footprint centre at axis station (s, sd) */
function ctr(P: (s: number, sd: number) => [number, number], s: number, sd: number): { x: number; z: number } {
  const [x, z] = P(s, sd);
  return { x, z };
}
