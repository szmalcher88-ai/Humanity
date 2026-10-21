/**
 * Orchards and gardens of the west-bank belt (v1.2 I4) — canon Vol. IV
 * District 10 lists "vegetables, flax, orchards, date palms" among the
 * fields; until now the belt grew grain and nothing else.
 *  - DATE GROVES and FIG ORCHARDS on the bare plots beside the canals: trees
 *    need water all year, and in the dry season it is carried up from the
 *    canal in jars (Basins.ts cuts a water stair at each gate). Walled in
 *    mudbrick, planted on a regular grid, every tree in its own small damp
 *    watering basin, a feeder channel along each row
 *  - a GARDEN behind each farmstead, in the part of its plot the house,
 *    floor and pen leave free: the chequerboard of square vegetable beds of
 *    the tomb scenes (onions and leeks, lettuce, melons and cucumbers, a bed
 *    fresh-sown), date palms along the wall, a fig or two, the big water
 *    jars by the gate, a gardener at the beds and one bringing water on the
 *    yoke
 * The trees are the shore's sycomore figs (Ficus sycomorus — Shore.ts's
 * "sycamore"), kept smaller by pruning, and the floodplain's date palms,
 * through the same instanced spawners.
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { NILE_WATER_Y } from '../world/WorldConst';
import { CANALS, CANAL_CORRIDOR, SPOIL_OFF } from '../world/Irrigation';
import { fpReg } from '../debug/Footprints';
import { GeoWriter, limestoneMaterial } from '../monuments/KhufuComplex';
import { ColorWriter, addTownsfolk, person, yokeCarrier, type C3 } from '../monuments/Townsfolk';
import type { Gang } from '../monuments/Inhabitants';
import { earthMaterial, type CanalPlot } from './Basins';
import type { Parcel } from './Fields';
import { spawnClass, sycamoreGeometry } from './Shore';
import { spawnPalms } from './Palms';

const FAMILY = 'orchards';
const DAMP: C3 = [0.3, 0.25, 0.19];
const RIDGE: C3 = [0.44, 0.37, 0.28];
const JAR: C3 = [0.6, 0.4, 0.26];
const LEEK: C3 = [0.2, 0.36, 0.12];
const LETTUCE: C3 = [0.34, 0.5, 0.16];
const VINE: C3 = [0.22, 0.34, 0.11];
const MELON: C3 = [0.62, 0.6, 0.28];

export interface OrchardInfo {
  orchards: number;
  gardens: number;
  figs: number;
  palms: number;
  /** water carriers between the canal stairs and the trees */
  lines: Gang[];
}

/** the bare plots that border a canal: they become orchards */
export function pickCanalPlots(
  fallow: readonly Parcel[],
  farms: readonly Parcel[],
  hf: Heightfield,
  max = 9,
): CanalPlot[] {
  const out: CanalPlot[] = [];
  for (const p of fallow) {
    if (out.length >= max) break;
    if (p.x0 > 2100 || farms.includes(p) || p.d < 24 || p.w < 24) continue;
    for (const c of CANALS) {
      const south = Math.abs(p.z0 - (c.z + CANAL_CORRIDOR)) < 0.6;
      const north = Math.abs(p.z0 + p.d - (c.z - CANAL_CORRIDOR)) < 0.6;
      if (!south && !north) continue;
      const lo = Math.min(
        hf.heightAtCpu(p.x0 + 2, p.z0 + 2), hf.heightAtCpu(p.x0 + p.w - 2, p.z0 + 2),
        hf.heightAtCpu(p.x0 + 2, p.z0 + p.d - 2), hf.heightAtCpu(p.x0 + p.w - 2, p.z0 + p.d - 2),
      );
      if (lo > NILE_WATER_Y + 0.6) out.push({ p, canal: c, side: south ? 1 : -1, gateX: p.x0 + Math.min(p.w * 0.5, 14) });
      break;
    }
  }
  return out;
}

export function buildOrchards(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null,
  plots: readonly CanalPlot[],
  farmPlots: readonly Parcel[],
  perf: { cull: boolean; prepass: boolean },
): OrchardInfo {
  const rng = seed.rng('orchards');
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const mud = new GeoWriter();
  const earth = new ColorWriter();
  const folk = new ColorWriter();
  const figSpots: [number, number, number][] = [];
  const palmSpots: [number, number, number][] = [];
  const info: OrchardInfo = { orchards: 0, gardens: 0, figs: 0, palms: 0, lines: [] };
  let walls = 0;

  /** a mudbrick garden wall round [x0,x1]×[z0,z1]; the gate (3.2 m) is in
   *  the north (−1) or south (+1) run at gateX. Laid in ≤ 8 m pieces, each
   *  stepped to its own ground, as such walls are */
  const wall = (x0: number, x1: number, z0: number, z1: number, gateSide: 1 | -1, gateX: number): void => {
    const H = 1.35;
    const T = 0.45;
    const runs: [number, number, number, number][] = [];
    for (const [z, s] of [[z0, -1], [z1, 1]] as const) {
      if (s === gateSide) {
        runs.push([x0, z, gateX - 1.6, z], [gateX + 1.6, z, x1, z]);
      } else runs.push([x0, z, x1, z]);
    }
    runs.push([x0, z0, x0, z1], [x1, z0, x1, z1]);
    for (const [ax, az, bx, bz] of runs) {
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.5) continue;
      const along = Math.abs(bz - az) > Math.abs(bx - ax);
      const n = Math.ceil(len / 8);
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const mx = ax + (bx - ax) * (t0 + t1) / 2;
        const mz = az + (bz - az) * (t0 + t1) / 2;
        const y = Math.min(grd(ax + (bx - ax) * t0, az + (bz - az) * t0), grd(ax + (bx - ax) * t1, az + (bz - az) * t1)) - 0.25;
        const L = (len / n) + T;
        if (along) mud.box(mx, y, mz, T, H + 0.25, L, rng.range(0.54, 0.6), 0.03);
        else mud.box(mx, y, mz, L, H + 0.25, T, rng.range(0.54, 0.6), 0.03);
      }
      fpReg({
        id: `orchard-wall:${walls++}`, family: FAMILY, x: (ax + bx) / 2, z: (az + bz) / 2,
        hx: along ? T / 2 : len / 2, hz: along ? len / 2 : T / 2,
        y0: grd((ax + bx) / 2, (az + bz) / 2) - 0.25, y1: grd((ax + bx) / 2, (az + bz) / 2) + H, ground: 'grounded',
      });
    }
  };

  /** a tree in its watering basin: a damp floor ringed by a low ridge */
  const basin = (x: number, z: number, y: number, r: number): void => {
    earth.box(x, y - 0.03, z, r * 2 - 0.2, 0.05, r * 2 - 0.2, DAMP);
    for (const s of [-1, 1]) {
      earth.box(x, y - 0.06, z + s * r, r * 2 + 0.3, 0.22, 0.3, RIDGE);
      earth.box(x + s * r, y - 0.06, z, 0.3, 0.22, r * 2 - 0.3, RIDGE);
    }
  };

  /** a feeder channel: a damp strip along x, laid in short pieces */
  const channel = (xa: number, xb: number, z: number): void => {
    const n = Math.max(1, Math.ceil((xb - xa) / 6));
    for (let i = 0; i < n; i++) {
      const x = xa + ((xb - xa) * (i + 0.5)) / n;
      earth.box(x, grd(x, z) - 0.04, z, (xb - xa) / n, 0.06, 0.45, DAMP);
    }
  };

  /* --- canal-side orchards ------------------------------------------------- */
  for (const pl of plots) {
    const { p, canal, side } = pl;
    const k = info.orchards;
    const figsHere = k % 3 === 2; // two date groves to every fig orchard
    const x0 = p.x0 + 1.2;
    const x1 = p.x0 + p.w - 1.2;
    const z0 = p.z0 + 1.2;
    const z1 = p.z0 + p.d - 1.2;
    // the gate faces the canal
    wall(x0, x1, z0, z1, side > 0 ? -1 : 1, pl.gateX);
    const pitch = figsHere ? 8.4 : 7.2;
    const nx = Math.floor((x1 - x0 - 7) / pitch);
    const nz = Math.floor((z1 - z0 - 7) / pitch);
    const ox = x0 + (x1 - x0 - nx * pitch) / 2;
    const oz = z0 + (z1 - z0 - nz * pitch) / 2;
    for (let j = 0; j <= nz; j++) {
      const tz0 = oz + j * pitch;
      channel(x0 + 1.5, x1 - 1.5, tz0);
      for (let i = 0; i <= nx; i++) {
        const tx = ox + i * pitch + rng.range(-0.4, 0.4);
        const tz = tz0 + rng.range(-0.3, 0.3);
        if (Math.abs(tx - pl.gateX) < 2.6) continue; // the path in from the gate
        const y = grd(tx, tz);
        if (y < NILE_WATER_Y + 0.6) continue;
        basin(tx, tz, y, figsHere ? 1.5 : 1.25);
        // a fig orchard keeps a row of date palms along its canal side
        const rowCanal = side > 0 ? j === 0 : j === nz;
        if (figsHere && !rowCanal) figSpots.push([tx, tz, y]);
        else palmSpots.push([tx, tz, y]);
      }
    }
    // a gardener at a basin, a carrier just inside the gate
    const gz = side > 0 ? z0 + 4 : z1 - 4;
    yokeCarrier(folk, rng, pl.gateX + 0.4, grd(pl.gateX + 0.4, gz), gz, side > 0 ? Math.PI / 2 : -Math.PI / 2, false);
    const sx = ox + Math.min(nx, 2) * pitch + 1.2;
    const sz = oz + Math.min(nz, 1) * pitch;
    person(folk, rng, sx, grd(sx, sz), sz, Math.PI, 'squat');
    // water carriers walk the stair ↔ the trees
    const stairZ = canal.z + side * SPOIL_OFF;
    info.lines.push({
      x0: pl.gateX, z0: stairZ, x1: pl.gateX + 3, z1: (z0 + z1) / 2,
      n: 3, spread: 1.0, carry: 0.9, still: 0.15,
    });
    info.orchards++;
  }

  /* --- farmstead gardens ---------------------------------------------------- */
  for (const p of farmPlots) {
    const gz0 = p.z0 + 33.5;
    const gz1 = p.z0 + p.d - 2;
    const gx0 = p.x0 + 3;
    const gx1 = p.x0 + Math.min(p.w - 3, 46);
    if (gz1 - gz0 < 11 || gx1 - gx0 < 16) continue;
    const lo = Math.min(grd(gx0, gz0), grd(gx1, gz0), grd(gx0, gz1), grd(gx1, gz1));
    if (lo < NILE_WATER_Y + 0.6) continue;
    const gateX = p.x0 + 14;
    wall(gx0, gx1, gz0, gz1, -1, gateX);

    // the chequerboard: square beds, raised ridges between
    const P = 1.55;
    const cols = Math.max(3, Math.min(10, Math.floor(((gx1 - gx0) * 0.5) / P)));
    // the beds stop short of the palm row along the south wall
    const rows = Math.max(2, Math.min(7, Math.floor((gz1 - gz0 - 7.5) / P)));
    const bx0 = gx0 + 1.6;
    const bz0 = gz0 + 2.4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = bx0 + (c + 0.5) * P;
        const cz = bz0 + (r + 0.5) * P;
        const y = grd(cx, cz);
        earth.box(cx, y - 0.04, cz, P - 0.24, 0.07, P - 0.24, DAMP);
        earth.box(cx, y - 0.05, cz - P / 2, P, 0.17, 0.24, RIDGE);
        earth.box(cx - P / 2, y - 0.05, cz, 0.24, 0.17, P - 0.24, RIDGE);
        if (r === rows - 1) earth.box(cx, y - 0.05, cz + P / 2, P, 0.17, 0.24, RIDGE);
        if (c === cols - 1) earth.box(cx + P / 2, y - 0.05, cz, 0.24, 0.17, P - 0.24, RIDGE);
        const kind = (r + c * 2 + info.gardens) % 4;
        if (kind === 0) {
          // onions and leeks in rows
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
            folk.box(cx - 0.4 + a * 0.4, y, cz - 0.4 + b * 0.4, 0.05, rng.range(0.24, 0.38), 0.05, LEEK);
          }
        } else if (kind === 1) {
          // lettuce rosettes
          for (const [a, b] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]] as const) {
            folk.box(cx + a, y, cz + b, 0.34, 0.15, 0.34, LETTUCE, rng.float());
          }
        } else if (kind === 2) {
          // a melon or cucumber vine over the bed, the fruit in it
          folk.box(cx, y, cz, P - 0.45, 0.07, P - 0.45, VINE, rng.range(-0.2, 0.2));
          for (let f = 0; f < 2; f++) folk.box(cx + rng.range(-0.4, 0.4), y + 0.05, cz + rng.range(-0.4, 0.4), 0.24, 0.16, 0.18, MELON, rng.float() * 3);
        }
        // kind 3: just sown — the damp bed alone
      }
    }

    // date palms along the south wall, a fig or two in the east half
    for (let x = gx0 + 3.5; x < gx1 - 2.5; x += 6.5) {
      const z = gz1 - 2.6;
      const y = grd(x, z);
      basin(x, z, y, 1.2);
      palmSpots.push([x + rng.range(-0.3, 0.3), z, y]);
    }
    const fx = gx0 + (gx1 - gx0) * 0.76;
    for (const fz of gz1 - gz0 > 16 ? [gz0 + 4.5, gz0 + 10.5] : [gz0 + 4.5]) {
      const y = grd(fx, fz);
      basin(fx, fz, y, 1.4);
      figSpots.push([fx, fz, y]);
    }

    // the big water jars by the gate; a gardener at the beds, a carrier
    for (let j = 0; j < 3; j++) {
      const jx = gateX + 2.2 + j * 0.75;
      const jz = gz0 + 0.9;
      const y = grd(jx, jz);
      folk.box(jx, y, jz, 0.5, 0.62, 0.5, JAR, Math.PI / 4);
      folk.box(jx, y + 0.62, jz, 0.26, 0.12, 0.26, JAR);
    }
    const gx = bx0 + P * Math.min(2, cols - 1) + 0.2;
    const gzz = bz0 + P * 0.5 + 0.75;
    person(folk, rng, gx, grd(gx, gzz), gzz, -Math.PI / 2, 'squat');
    yokeCarrier(folk, rng, gateX - 0.3, grd(gateX - 0.3, gz0 + 1.3), gz0 + 1.3, Math.PI / 2);
    info.gardens++;
  }

  /* --- the trees ---------------------------------------------------------------- */
  info.figs = spawnClass(scene, rng.fork('figs'), figSpots, {
    name: 'orchard-fig',
    grow: (r) => sycamoreGeometry(r, 2.3),
    stemTone: [0.37, 0.29, 0.19],
    leafTone: [0.16, 0.27, 0.1],
    fit: () => true,
    scale: [0.6, 0.78],
    giLift: 1.6,
    sway: 0.03,
  }, gi, perf.cull);
  info.palms = spawnPalms(scene, rng.fork('palms'), palmSpots, gi, perf, 'orchard-palm', [0.8, 1.0]);

  /* --- materialize ---------------------------------------------------------- */
  const walls3 = new Mesh(mud.build(), limestoneMaterial([0.56, 0.46, 0.34], gi, 0.3, 0.45));
  const ground = new Mesh(earth.build(), earthMaterial(gi));
  for (const m of [walls3, ground]) {
    m.castShadow = m === walls3;
    m.receiveShadow = true;
    m.name = 'orchards';
    scene.add(m);
  }
  addTownsfolk(scene, folk, gi, 'orchard-folk');
  return info;
}
