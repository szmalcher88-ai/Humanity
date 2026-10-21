/**
 * Irrigation earthworks of the west-bank basins (v1.2 I4). The layout and
 * the gravity argument live in world/Irrigation.ts; this builds what stands
 * on the ground, all of it following the CPU height mirror (earth strips are
 * sunk 15 cm at the toe — no edge floats):
 *  - SPOIL BANKS along both sides of each canal: the dug earth heaped up,
 *    broken where an intake, a water stair, the bridge or the regulator
 *    crosses them
 *  - INTAKES: cuts through the bank into a basin, shut with an earth plug
 *    since the last watering (dry season), the damp feeder ditch beyond
 *  - WATER STAIRS cut down the canal bank to the water, where the jars are
 *    filled — one at each canal-side orchard's gate
 *  - a REGULATOR near each canal mouth: stone-faced abutments narrowing the
 *    cut, grooved timber posts, the stop-planks stacked on the bank (the
 *    canal stands open to the river), a palm-log deck over it, and a timber
 *    landing stage beside it (canon: "stone reinforcements, wooden docks,
 *    sluice structures … small bridges")
 *  - a FOOTBRIDGE of palm logs on trestles half-way along each canal
 *  - TRANSVERSE DYKES between the basins, their crests the field paths;
 *    a dyke stops at any building standing in its line
 *  - FIELD HUTS: the watchmen's reed shelters at the corners of bare plots
 *    (brief dressing rule: "fields → irrigation moisture gradients, paths,
 *    field huts")
 */

import { Mesh, type Object3D } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { attribute, float, positionWorld, vec3 } from 'three/tsl';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NV3 } from '../gpu/TSLTypes';
import { valueNoise2 } from '../gpu/noise/NoiseTSL';
import { giLightMap } from '../monuments/PyramidBuilder';
import { GeoWriter, limestoneMaterial } from '../monuments/KhufuComplex';
import { ColorWriter, addTownsfolk, person, reedMat, reedRoof, yokeCarrier, type C3 } from '../monuments/Townsfolk';
import { fpAabb, fpAll, fpReg } from '../debug/Footprints';
import type { Heightfield } from '../world/Heightfield';
import { NILE_WATER_Y } from '../world/WorldConst';
import {
  BELT_WEST_X,
  CANALS,
  CANAL_BED_Y,
  DYKES,
  DYKE_HALF_BASE,
  SPOIL_OFF,
  type Canal,
} from '../world/Irrigation';
import type { Parcel } from './Fields';

const FAMILY = 'irrigation';
const EARTH: C3 = [0.42, 0.35, 0.26]; // dug silt, a shade drier than the plain
const CREST: C3 = [0.5, 0.43, 0.33]; // the trodden path along a crest
const DAMP: C3 = [0.29, 0.24, 0.18];
const REED: C3 = [0.62, 0.55, 0.36];
const POLE: C3 = [0.4, 0.31, 0.2];
/** the river sheet's west edge: canal works west of it stand in canal water */
const RIVER_SHEET_X = 1700;

/** a canal-side plot that draws its water by hand from the canal */
export interface CanalPlot {
  p: Parcel;
  canal: Canal;
  /** +1: the plot lies south of the canal (larger z), −1 north */
  side: 1 | -1;
  /** x of the water stair and of the plot's gate */
  gateX: number;
}

export interface WorksInfo {
  /** metres of dyke and spoil bank built */
  banks: number;
  intakes: number;
  stairs: number;
  huts: number;
}

/** dug earth: two value-noise bands of clods and trodden patches over the
 *  vertex tone (one noise alone is banned — brief, macro–meso–micro) */
export function earthMaterial(gi: ProbeGI | null): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial();
  const tone = attribute('tone', 'vec3') as unknown as NV3;
  const wxz = positionWorld.xz;
  const mott = valueNoise2(wxz.div(1.9))
    .mul(0.12)
    .add(valueNoise2(wxz.div(0.42).add(9.1)).mul(0.09))
    .add(0.85);
  m.colorNode = tone.mul(mott);
  m.roughnessNode = float(0.96);
  m.metalnessNode = float(0);
  m.specularIntensity = 0.12;
  giLightMap(m, gi, vec3(0, 1, 0) as unknown as NV3, 1.1);
  return m;
}

/** quad wound so its normal points along `hint` */
function face(w: ColorWriter, a: C3, b: C3, c: C3, d: C3, t: C3, hint: C3): void {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
  if (n[0]! * hint[0] + n[1]! * hint[1] + n[2]! * hint[2] >= 0) w.quad(a, b, c, d, t);
  else w.quad(d, c, b, a, t);
}

export function buildIrrigationWorks(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  plots: readonly CanalPlot[],
  bare: readonly Parcel[],
): WorksInfo {
  const rng = seed.rng('irrigation');
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const earth = new ColorWriter();
  const stone = new GeoWriter();
  const wood = new GeoWriter();
  const folk = new ColorWriter();
  const info: WorksInfo = { banks: 0, intakes: 0, stairs: 0, huts: 0 };

  /**
   * An east–west earth bank from xa to xb centred on zc: base half-width
   * hb, crest half-width ht, crest h above the ground under its centre.
   * Stations every ≤ 5 m; `skip(x)` breaks it (a gap, a building).
   */
  const bank = (xa: number, xb: number, zc: number, hb: number, ht: number, h: number, skip: (x: number) => boolean): void => {
    const n = Math.max(1, Math.ceil((xb - xa) / 5));
    // a rounded section: toe, shoulder, crest edge — each side
    type St = { x: number; yb: number; yt: number; ys: number; w: number; wc: number; ws: number };
    let run: St[] = [];
    const flush = (): void => {
      if (run.length >= 2) {
        const P = (e: St, k: number): C3 => {
          const zz = [-e.w, -e.ws, -e.wc, e.wc, e.ws, e.w][k] as number;
          const yy = [e.yb, e.ys, e.yt, e.yt, e.ys, e.yb][k] as number;
          return [e.x, yy, zc + zz];
        };
        const hints: C3[] = [[0, 1, -1.6], [0, 1, -0.6], [0, 1, 0], [0, 1, 0.6], [0, 1, 1.6]];
        for (let i = 0; i + 1 < run.length; i++) {
          const a = run[i]!;
          const b = run[i + 1]!;
          for (let k = 0; k < 5; k++) {
            face(earth, P(a, k), P(b, k), P(b, k + 1), P(a, k + 1), k === 2 ? CREST : EARTH, hints[k]!);
          }
          info.banks += b.x - a.x;
        }
        for (const [e, dir] of [[run[0]!, -1], [run[run.length - 1]!, 1]] as const) {
          face(earth, P(e, 0), P(e, 1), P(e, 4), P(e, 5), EARTH, [dir, 0, 0]);
          face(earth, P(e, 1), P(e, 2), P(e, 3), P(e, 4), EARTH, [dir, 0, 0]);
        }
      }
      run = [];
    };
    for (let i = 0; i <= n; i++) {
      const x = xa + ((xb - xa) * i) / n;
      if (skip(x)) {
        flush();
        continue;
      }
      // heaped by hand: the crest wanders in height and width, and the bank
      // eases down over its last 8 m instead of ending in a cut face
      const ease = Math.max(0.12, Math.min(1, (x - xa) / 8, (xb - x) / 8));
      const hh = h * ease * rng.range(0.86, 1.12);
      const jw = rng.range(0.92, 1.08);
      const g = grd(x, zc);
      const yb = Math.min(g, grd(x, zc - hb), grd(x, zc + hb)) - 0.15;
      run.push({ x, yb, yt: g + hh, ys: g + hh * 0.74, w: hb * jw, wc: ht * jw, ws: (ht + (hb - ht) * 0.42) * jw });
    }
    flush();
  };

  /* --- the canals' own works ------------------------------------------------ */
  for (const c of CANALS) {
    // where the plain falls away to the river: the banks end there
    let xEnd = c.x0;
    while (xEnd < c.x1 && grd(xEnd + 5, c.z - SPOIL_OFF) > NILE_WATER_Y + 1.1 && grd(xEnd + 5, c.z + SPOIL_OFF) > NILE_WATER_Y + 1.1) xEnd += 5;
    const regX = Math.min(xEnd - 30, RIVER_SHEET_X - 60);
    const bridgeX = c.x0 + (regX - c.x0) * 0.45;
    // gaps per side: [centre x, half-width]
    const gaps: Record<number, [number, number][]> = { [-1]: [], [1]: [] };
    for (const s of [-1, 1] as const) {
      gaps[s]!.push([regX, 4.5], [bridgeX, 2.4]);
    }
    gaps[1]!.push([regX - 34, 3.2]); // the landing stage's head
    for (const pl of plots) if (pl.canal === c) gaps[pl.side]!.push([pl.gateX, 2.0]);
    // intakes: one per basin reach on alternating sides, away from the rest
    const intakes: [number, 1 | -1][] = [];
    for (let k = 0, x = c.x0 + 95; x < regX - 40; k++, x += 175) {
      const s: 1 | -1 = k % 2 === 0 ? 1 : -1;
      if (gaps[s]!.some(([gx, gw]) => Math.abs(gx - x) < gw + 8)) continue;
      gaps[s]!.push([x, 1.8]);
      intakes.push([x, s]);
    }
    for (const s of [-1, 1] as const) {
      const zc = c.z + s * SPOIL_OFF;
      bank(c.x0 - 6, xEnd, zc, 1.9, 0.55, 0.85, (x) => gaps[s]!.some(([gx, gw]) => Math.abs(x - gx) < gw));
    }

    /* intakes: the earth plug on the canal side, the damp ditch beyond */
    for (const [x, s] of intakes) {
      const zp = c.z + s * (SPOIL_OFF - 1.1);
      earth.box(x, grd(x, zp) - 0.2, zp, 3.6, 0.72, 1.6, DAMP);
      // the wet apron where the last watering ran out into the basin
      const za = c.z + s * (SPOIL_OFF + 1.1);
      earth.box(x, grd(x, za) - 0.03, za, 1.4, 0.06, 2.6, DAMP);
      info.intakes++;
    }

    /* water stairs at the orchards' gates, a carrier at each */
    for (const pl of plots) {
      if (pl.canal !== c) continue;
      const s = pl.side;
      const x = pl.gateX;
      const top = grd(x, c.z + s * 8.2);
      for (let k = 0; k < 5; k++) {
        const dz = 7.3 - k * 0.6;
        const yk = top - 0.12 - k * 0.42;
        const z = c.z + s * (dz - 0.3);
        earth.box(x, yk - 1.1, z, 1.7, 1.1, 0.62, k === 4 ? DAMP : EARTH);
      }
      // one kneels at the water filling a jar, one shoulders the yoke
      // (on the last step, facing the water)
      person(folk, rng, x - 0.4, top - 0.12 - 4 * 0.42, c.z + s * 4.75, s > 0 ? -Math.PI / 2 : Math.PI / 2, 'kneel');
      folk.box(x + 0.15, NILE_WATER_Y - 0.05, c.z + s * 4.1, 0.3, 0.32, 0.3, [0.6, 0.4, 0.26], Math.PI / 4);
      const cz = c.z + s * 10.8;
      yokeCarrier(folk, rng, x + 0.6, grd(x + 0.6, cz), cz, s > 0 ? Math.PI / 2 : -Math.PI / 2);
      info.stairs++;
    }

    /* the regulator: stone-faced abutments, grooved posts, the stop-planks
     * stacked on the bank, a log deck over it */
    {
      const x = regX;
      const top = Math.max(grd(x, c.z - 8.6), grd(x, c.z + 8.6));
      const y0 = CANAL_BED_Y - 0.3;
      for (const s of [-1, 1] as const) {
        // the abutment: dressed limestone face toward the water
        stone.box(x, y0, c.z + s * 6.4, 4.2, top + 0.45 - y0, 4.0, 0.98, 0.05);
        stone.box(x, top + 0.45, c.z + s * 6.4, 4.4, 0.18, 4.2, 1.06); // coping
        for (const dx of [-0.32, 0.32]) {
          wood.box(x + dx, y0 + 0.5, c.z + s * 4.3, 0.22, top + 1.55 - y0 - 0.5, 0.24, 0.8);
        }
      }
      // the deck: four palm logs on the abutments, planks across them
      for (let k = 0; k < 4; k++) {
        const dx = -1.05 + k * 0.7;
        wood.box(x + dx, top + 0.63, c.z, 0.3, 0.26, 12.4, 0.74 + (k % 2) * 0.08);
      }
      for (let k = 0; k < 18; k++) {
        wood.box(x, top + 0.89, c.z - 4.25 + k * 0.5, 2.6, 0.06, 0.44, 0.86 + rng.range(-0.06, 0.06));
      }
      // the stop-planks lifted out and stacked on the north bank: open
      for (let k = 0; k < 6; k++) {
        const g = grd(x + 7, c.z - 12.2);
        wood.box(x + 7 + rng.range(-0.1, 0.1), g + k * 0.13, c.z - 12.2, 9.4, 0.12, 0.34, 0.9, 0, rng.range(-0.02, 0.02));
      }
      fpReg({ id: `irr:reg:${c.z.toFixed(0)}`, family: FAMILY, x, z: c.z, hx: 3.4, hz: 8.5, y0, y1: top + 0.95, ground: 'none', passive: true });

      // a timber landing stage just upstream (canon "wooden docks")
      // its deck flush with the bank top, reaching out over the water
      const lx = x - 34;
      const deckY = grd(lx, c.z + 8.2) - 0.3;
      for (const px of [-2.6, 0, 2.6]) {
        for (const dz of [4.3, 6.2]) wood.box(lx + px, CANAL_BED_Y - 0.2, c.z + dz, 0.22, deckY - CANAL_BED_Y + 0.2, 0.22, 0.7);
      }
      for (let k = 0; k < 12; k++) {
        wood.box(lx - 2.75 + k * 0.5, deckY, c.z + 5.8, 0.46, 0.08, 3.6, 0.88 + rng.range(-0.06, 0.06));
      }
      fpReg({ id: `irr:landing:${c.z.toFixed(0)}`, family: FAMILY, x: lx, z: c.z + 5.8, hx: 3.0, hz: 1.9, y0: CANAL_BED_Y, y1: deckY + 0.1, ground: 'none', passive: true });
    }

    /* the footbridge: palm logs on two trestles */
    {
      const x = bridgeX;
      const top = Math.min(grd(x, c.z - 9), grd(x, c.z + 9)) + 0.04; // the log ends rest on the plain
      for (const dz of [-3.6, 3.6]) {
        for (const dx of [-0.6, 0.6]) wood.box(x + dx, CANAL_BED_Y - 0.2, c.z + dz, 0.2, top - CANAL_BED_Y + 0.2, 0.2, 0.68);
        wood.box(x, top - 0.18, c.z + dz, 1.6, 0.18, 0.24, 0.72); // trestle cap
      }
      for (const dx of [-0.45, 0, 0.45]) wood.box(x + dx, top, c.z, 0.3, 0.26, 18.6, 0.76);
      fpReg({ id: `irr:bridge:${c.z.toFixed(0)}`, family: FAMILY, x, z: c.z, hx: 0.9, hz: 9.3, y0: CANAL_BED_Y, y1: top + 0.3, ground: 'none', passive: true });
    }
  }

  /* --- transverse dykes between the basins ---------------------------------- */
  // a dyke stops at a building in its line (+2 m)
  const solid = fpAll().filter((f) => !f.passive).map(fpAabb);
  for (const z of DYKES) {
    let xEnd = BELT_WEST_X + 2;
    while (xEnd < 2150 && grd(xEnd + 5, z) > NILE_WATER_Y + 1.3) xEnd += 5;
    const blocked = (x: number): boolean =>
      solid.some((b) => x > b.x0 - 2 && x < b.x1 + 2 && z + DYKE_HALF_BASE > b.z0 - 2 && z - DYKE_HALF_BASE < b.z1 + 2);
    bank(BELT_WEST_X + 2, xEnd, z, DYKE_HALF_BASE, 0.8, 1.0, blocked);
  }

  /* --- field huts: reed shelters at the corners of bare plots --------------- */
  for (const p of bare) {
    if (info.huts >= 12) break;
    if (p.x0 > 2100 || p.d < 20) continue;
    const hx = p.x0 + 4;
    const hz = p.z0 + 4;
    const y = Math.min(grd(hx - 1.2, hz - 1.2), grd(hx + 1.2, hz + 1.2)) - 0.05;
    if (y < NILE_WATER_Y + 0.6) continue;
    const yaw = rng.range(-0.3, 0.3);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const at = (f: number, sd: number): [number, number] => [hx + f * c - sd * s, hz + f * s + sd * c];
    for (const [f, sd] of [[-1.25, -1.0], [1.25, -1.0], [-1.25, 1.0], [1.25, 1.0]] as const) {
      const [px, pz] = at(f, sd);
      folk.box(px, y, pz, 0.1, 1.5, 0.1, POLE, yaw);
    }
    // the ridge pole on two forked uprights, the mats laid over it
    for (const f of [-1.45, 1.45]) {
      const [px, pz] = at(f, 0);
      folk.box(px, y, pz, 0.12, 2.3, 0.12, POLE, yaw);
    }
    const [r0x, r0z] = at(-1.6, 0);
    const [r1x, r1z] = at(1.6, 0);
    folk.beam([r0x, y + 2.25, r0z], [r1x, y + 2.25, r1z], 0.06, POLE);
    for (const sd of [-1, 1]) {
      const [ex0, ez0] = at(-1.55, sd * 1.25);
      const [ex1, ez1] = at(1.55, sd * 1.25);
      reedRoof(folk, [r0x, y + 2.27, r0z], [r1x, y + 2.27, r1z], [ex1, y + 1.42, ez1], [ex0, y + 1.42, ez0], REED);
    }
    const [bx, bz] = at(-1.27, 0);
    reedMat(folk, bx, y, bz, 2.1, 1.45, yaw + Math.PI / 2, REED); // the back, against the wind
    const [mx, mz] = at(0.1, 0.1);
    folk.box(mx, y, mz, 1.8, 0.04, 0.9, [0.55, 0.47, 0.3], yaw); // sleeping mat
    if (info.huts % 3 === 0) person(folk, rng, mx, y + 0.04, mz, yaw + Math.PI / 2, 'sit');
    fpReg({ id: `irr:hut:${info.huts}`, family: FAMILY, x: hx, z: hz, hx: 1.6, hz: 1.3, yaw, y0: y, y1: y + 2.4, ground: 'grounded' });
    info.huts++;
  }

  /* --- materialize ------------------------------------------------------------- */
  const earthMesh = new Mesh(earth.build(), earthMaterial(gi));
  const meshes = [
    earthMesh,
    new Mesh(stone.build(), limestoneMaterial([0.56, 0.5, 0.41], gi, 0.55, 1.15, { rough: 0.82 })),
    new Mesh(wood.build(), limestoneMaterial([0.36, 0.27, 0.17], gi, 0.24, 0.32, { rough: 0.8 })),
  ];
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'irrigation';
    scene.add(m);
  }
  addTownsfolk(scene, folk, gi, 'irrigation-folk');
  return info;
}
