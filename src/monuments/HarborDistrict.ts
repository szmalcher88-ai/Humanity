/**
 * Harbor district (v1.1 detail pass) — the dry ground around the dredged
 * basin, canon Vol. IV District 5 ("Royal Harbor": docks, cargo ramps, boat
 * repair, unloading areas, storage, wells). Until v1.1 the whole works zone
 * around the basin — ~1.1 × 0.5 km, kept clear of field parcels on purpose —
 * was bare silt: the busiest place on the site read as an empty mud flat.
 *
 *   north shore — storage magazines (long roofed mudbrick ranges with
 *                 doorways and roof vents) + a walled granary court of
 *                 beehive silos, the RAB's silo language
 *   west shore  — stone yard by the quay: dressed Tura casing blocks in
 *                 stacked rows, a few Aswan granite beams (pink, darker,
 *                 one with lifting bosses), sledge runners and levers
 *   both shores — cargo slipways: battered stone ramps running into the
 *                 water, where sledges meet the barges
 *   south shore — boatyard: a hull on stocks still in FRAMES (keel, ribs,
 *                 a single sheer strake) and a second half-planked, timber
 *                 and plank stacks, a sawing frame, reed-mat shades
 *   scattered   — wells (low mudbrick rings with water jars)
 *   north-west  — (v1.2) a market on the shore road: two rows of stalls
 *                 under reed-mat shades facing a lane — fish, onions and
 *                 leeks, loaves, pots, linen — after the Saqqara market
 *                 scenes (Niankhkhnum & Khnumhotep, Tepemankh)
 *
 * Every piece is grounded on the CPU height mirror and placed only where all
 * of its footprint is DRY (the basin edges are dredged steep); each one
 * registers a footprint so the collision audit polices it against the quay,
 * piers, moored hulls and the valley temple.
 *
 * Old Kingdom only: no shaduf (New Kingdom), no pulleys, no wheels; boats
 * are plank-built, sewn and frameless in strict terms — the "frames" here
 * are the yard's temporary moulds and thwart beams, which is how the hull
 * shape was held while the strakes were lashed (Khufu boat evidence).
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Heightfield } from '../world/Heightfield';
import { NILE_WATER_Y } from '../world/WorldConst';
import { fpReg, type GroundPolicy } from '../debug/Footprints';
import { ColorWriter, addTownsfolk, donkey, person, reedRoof, townsfolkMesh, type C3 } from './Townsfolk';
import { earthMaterial } from '../vegetation/Basins';
import type { Gang } from './Inhabitants';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';

const FAMILY = 'harbor-district';

/** cargo slipway heads [k, x, z] on the dry road, each running toward the
 *  basin centre (shared with the moving fleet, which docks at them) */
/** (v1.2 I6) gangs at the cargo yard (Inhabitants extras, appended last) */
export const harborLines: Gang[] = [
  // handlers at work in the bays
  { x0: 806, z0: -228, x1: 846, z1: -170, n: 8, spread: 4, carry: 0.3, still: 0.7 },
  // carriers between the cargo landing and the yard
  { x0: 870, z0: -188, x1: 848, z1: -200, n: 6, spread: 1.5, carry: 0.8, still: 0.1 },
];

export const SLIPWAY_STARTS = [[0, 1040, -312], [1, 1160, -302], [2, 1045, 44]] as const;
const BASIN_C = { x: 1077, z: -135 };

/** one slipway's line: unit direction toward the basin, the distance to the
 *  waterline crossing (tShore) and the ramp length (7 m on under water) */
export function slipwayRamp(
  grd: (x: number, z: number) => number, k: number,
): { sx0: number; sz0: number; ux: number; uz: number; tShore: number; ramp: number } {
  const s = SLIPWAY_STARTS[k] as readonly [number, number, number];
  const sx0 = s[1];
  const sz0 = s[2];
  const dx = BASIN_C.x - sx0;
  const dz = BASIN_C.z - sz0;
  const len0 = Math.hypot(dx, dz);
  const ux = dx / len0;
  const uz = dz / len0;
  let t = 0;
  while (t < 160 && grd(sx0 + ux * t, sz0 + uz * t) > NILE_WATER_Y + 0.3) t += 2;
  return { sx0, sz0, ux, uz, tShore: t, ramp: Math.max(10, t + 7) };
}

export function buildHarborDistrict(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null = null,
): number {
  const rng = seed.rng('harbor-district');
  const grd = (x: number, z: number): number => hf.heightAtCpu(x, z);
  const mud = new GeoWriter();
  const tura = new GeoWriter();
  const granite = new GeoWriter();
  const wood = new GeoWriter();
  const reed = new GeoWriter();
  const ware = new GeoWriter();
  const produce = new GeoWriter();
  const fish = new GeoWriter();
  let pieces = 0;

  /** every corner of an (axis-aligned, yawed) footprint is dry land */
  const dry = (x: number, z: number, hx: number, hz: number, yaw = 0, margin = 0.7): boolean => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (const [lx, lz] of [[0, 0], [-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as const) {
      if (grd(x + lx * c - lz * s, z + lx * s + lz * c) < NILE_WATER_Y + margin) return false;
    }
    return true;
  };
  /** lowest corner of a footprint (structures seat on it, a little sunk) */
  const low = (x: number, z: number, hx: number, hz: number, yaw = 0): number => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    let m = Infinity;
    for (const [lx, lz] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as const) {
      m = Math.min(m, grd(x + lx * c - lz * s, z + lx * s + lz * c));
    }
    return m;
  };
  const reg = (
    id: string, x: number, z: number, hx: number, hz: number, y0: number, y1: number, yaw = 0,
    ground: GroundPolicy = 'grounded', passive = false,
  ): void => {
    fpReg({ id, family: FAMILY, x, z, hx, hz, y0, y1, yaw, ground, passive });
    pieces++;
  };

  /* --- north shore: storage magazines ---------------------------------------
   * Three ranges of long vaulted-roof storerooms opening south onto the
   * basin road — the same cellular plan as the town's galleries, smaller. */
  {
    const ranges = [
      { x: 1010, z: -352, L: 74 },
      { x: 1098, z: -356, L: 70 },
      { x: 1184, z: -350, L: 66 },
    ];
    for (const [k, r] of ranges.entries()) {
      const D = 15;
      if (!dry(r.x, r.z, r.L / 2, D / 2)) continue;
      const y = low(r.x, r.z, r.L / 2, D / 2) - 0.3;
      const h = 3.1 + rng.range(-0.15, 0.25);
      const cells = Math.floor(r.L / 4.4);
      const pitch = r.L / cells;
      // back + end walls
      mud.box(r.x, y, r.z - D / 2 + 0.3, r.L, h + 0.3, 0.6, 0.55, 0.02);
      mud.box(r.x - r.L / 2 + 0.3, y, r.z, 0.6, h + 0.3, D, 0.56, 0.02);
      mud.box(r.x + r.L / 2 - 0.3, y, r.z, 0.6, h + 0.3, D, 0.54, 0.02);
      for (let c = 0; c < cells; c++) {
        const cx = r.x - r.L / 2 + (c + 0.5) * pitch;
        // partition wall on the west side of each cell
        if (c > 0) mud.box(cx - pitch / 2, y, r.z, 0.5, h + 0.3, D, 0.55 + rng.range(-0.03, 0.03), 0.015);
        // front (south) wall pierced by a doorway: two piers + a lintel band
        const dw = 1.0;
        const side = (pitch - dw) / 2;
        mud.box(cx - dw / 2 - side / 2, y, r.z + D / 2 - 0.3, side, h + 0.3, 0.6, 0.55, 0.02);
        mud.box(cx + dw / 2 + side / 2, y, r.z + D / 2 - 0.3, side, h + 0.3, 0.6, 0.55, 0.02);
        mud.box(cx, y + 0.3 + 1.85, r.z + D / 2 - 0.3, dw + 0.05, h - 1.85, 0.6, 0.55, 0);
        // dark doorway slab (reads as an opening from the road)
        mud.box(cx, y + 0.3, r.z + D / 2 - 0.62, dw, 1.85, 0.08, 0.11, 0);
        // vaulted roof read: a slightly crowned roof strip per cell
        mud.box(cx, y + h + 0.3, r.z, pitch - 0.1, 0.22 + rng.range(0, 0.06), D - 0.2, 0.64 + rng.range(-0.04, 0.04), 0.02);
        // roof vent on every other cell
        if (c % 2 === 0) mud.box(cx, y + h + 0.52, r.z - D / 4, 0.7, 0.45, 0.7, 0.5, 0.05);
      }
      // jar rows against the front wall (stores in transit)
      for (let j = 0; j < 10; j++) {
        if (rng.chance(0.35)) continue;
        const jx = r.x - r.L / 2 + 3 + rng.float() * (r.L - 6);
        const jz = r.z + D / 2 + 0.8 + rng.range(0, 0.6);
        const jy = grd(jx, jz) - 0.05;
        for (let q = 0; q < 2 + rng.int(4); q++) {
          mud.box(jx + q * 0.62, jy, jz, 0.5, 0.75 + rng.range(-0.1, 0.1), 0.5, 0.6, 0.12);
        }
      }
      reg(`magazine:${k}`, r.x, r.z, r.L / 2, D / 2 + 1.6, y, y + h + 0.8);
    }
  }

  /* --- granary court: walled yard of beehive silos ------------------------- */
  {
    const gx = 1262;
    const gz = -330;
    const W = 34;
    const L = 26;
    if (dry(gx, gz, W / 2, L / 2)) {
      const y = low(gx, gz, W / 2, L / 2) - 0.3;
      const wh = 2.6;
      mud.box(gx, y, gz - L / 2, W, wh, 0.8, 0.57, 0.03);
      mud.box(gx - W / 2, y, gz, 0.8, wh, L, 0.56, 0.03);
      mud.box(gx + W / 2, y, gz, 0.8, wh, L, 0.55, 0.03);
      // south wall with a gate gap
      mud.box(gx - W / 4 - 1.5, y, gz + L / 2, W / 2 - 3, wh, 0.8, 0.57, 0.03);
      mud.box(gx + W / 4 + 1.5, y, gz + L / 2, W / 2 - 3, wh, 0.8, 0.57, 0.03);
      for (let s = 0; s < 8; s++) {
        const sx = gx - W / 2 + 5 + (s % 4) * 8;
        const sz = gz - L / 4 + Math.floor(s / 4) * 11;
        const sy = grd(sx, sz) - 0.2;
        // three shrinking round tiers + a cap (v1.2: drums — the crossed
        // boxes at 45° made eight-pointed stars)
        for (const [d, th, tone] of [[5.6, 2.4, 0.72], [4.6, 2.0, 0.74], [3.2, 1.6, 0.76], [1.4, 0.9, 0.7]] as const) {
          const base = sy + (d === 5.6 ? 0 : d === 4.6 ? 2.3 : d === 3.2 ? 4.2 : 5.7);
          mud.drum(sx, base, sz, d / 2, th, tone, 0.06, 16);
        }
        // filling hatch near the top
        mud.box(sx, sy + 4.9, sz + 1.25, 0.6, 0.6, 0.2, 0.12, 0);
      }
      reg('granary', gx, gz, W / 2, L / 2, y, y + 6.8);
    }
  }

  /* --- stone yard on the south shore road: dressed casing blocks + granite --- */
  {
    const yx = 915;
    const yz = -276;
    const hw = 30;
    const hd = 18;
    if (dry(yx, yz, hw, hd, 0, 0.5)) {
      // three rows of casing blocks (v1.2: a fourth row at z -262 ran
      // straight through the granite beams)
      for (let row = 0; row < 3; row++) {
        const rz = yz - hd + 5 + row * 9;
        reg(`stone-row:${row}`, yx, rz, hw - 2, 0.9, grd(yx, rz) - 0.1, grd(yx, rz) + 2.6);
        let x = yx - hw + 3;
        while (x < yx + hw - 3) {
          const bl = rng.range(1.3, 1.9);
          const bw = rng.range(1.0, 1.4);
          const bh = rng.range(0.9, 1.3);
          const by = grd(x, rz) - 0.08;
          tura.box(x, by, rz, bl, bh, bw, rng.range(0.9, 1.02), 0.005, rng.range(-0.03, 0.03));
          // stacked second course on some
          if (rng.chance(0.45)) {
            tura.box(x + rng.range(-0.08, 0.08), by + bh, rz, bl * 0.96, bh * 0.95, bw * 0.96, rng.range(0.9, 1.02), 0.005);
          }
          x += bl + rng.range(0.35, 1.1);
        }
      }
      // Aswan granite: long beams (roofing-beam class) on timber sleepers
      for (let g = 0; g < 4; g++) {
        const gxx = yx - 12 + g * 7.5;
        const gzz = yz + hd - 5;
        const gy = grd(gxx, gzz);
        for (const s of [-2.2, 2.2]) wood.box(gxx + s, gy - 0.05, gzz, 0.35, 0.3, 2.1, 0.9, 0);
        const L = rng.range(5.2, 7.4);
        granite.box(gxx, gy + 0.25, gzz, L, rng.range(1.1, 1.5), rng.range(1.2, 1.6), rng.range(0.92, 1.05), 0.004, Math.PI / 2 + rng.range(-0.05, 0.05));
        // lifting bosses left on the faces (removed only once set)
        if (g % 2 === 0) granite.box(gxx + 0.75, gy + 0.6, gzz, 0.35, 0.4, 0.35, 0.95, 0);
      }
      // sledge + levers resting by the blocks
      const sx = yx + hw - 8;
      const sz = yz - 2;
      const sy = grd(sx, sz);
      for (const s of [-0.7, 0.7]) wood.box(sx, sy - 0.02, sz + s, 4.4, 0.24, 0.28, 0.85, 0.02);
      for (let k = 0; k < 5; k++) wood.box(sx - 1.6 + k * 0.8, sy + 0.2, sz, 0.18, 0.12, 1.8, 0.8, 0);
      for (let k = 0; k < 4; k++) wood.box(sx + 3.5, sy + 0.02 + k * 0.1, sz - 1 + k * 0.55, 3.6, 0.12, 0.14, 0.75, 0, rng.range(-0.2, 0.2));
      reg('granite', yx - 0.75, yz + hd - 5, 13.6, 3.9, grd(yx, yz + hd - 5) - 0.1, grd(yx, yz + hd - 5) + 1.9);
      reg('sledge-levers', yx + hw - 6.5, yz - 2, 4.2, 1.2, grd(yx + hw - 8, yz - 2) - 0.1, grd(yx + hw - 8, yz - 2) + 0.6);
      // the yard itself is open ground between the rows (v1.2: one solid box
      // over all of it pushed the yard gang out of the yard)
      fpReg({
        id: 'stone-yard', family: FAMILY, x: yx, z: yz, hx: hw, hz: hd,
        y0: grd(yx, yz) - 0.2, y1: grd(yx, yz) + 0.1, ground: 'none', passive: true,
      });
      pieces++;
    }
  }

  /* --- cargo slipways into the basin --------------------------------------- */
  {
    // ramps run from the dry road down past the waterline and 7 m on into
    // the water, toward the basin centre (slipwayRamp, shared with the fleet)
    for (const [k] of SLIPWAY_STARTS) {
      const { sx0, sz0, ux, uz, ramp } = slipwayRamp(grd, k);
      const yaw = Math.atan2(uz, ux);
      const cx = sx0 + ux * ramp / 2;
      const cz = sz0 + uz * ramp / 2;
      const yTop = grd(sx0, sz0);
      // stepped stone runs that FOLLOW THE GROUND from the road, down the
      // dredged edge and on under the water — a paved slip, not a cutting.
      // (v1.2: the runs were a straight line from road to bed; over the flat
      // shore that line ran underground, so the ramp showed as a few pale
      // slabs in mid-plain and never met the water. Each run now sits on its
      // lowest bed sample with its tread a hand above the centre ground: on
      // the edge's ~0.3 slope that is a ~0.5 m riser per 3.6 m run.)
      const n = Math.max(6, Math.round(ramp / 3.6));
      let yMin = Infinity;
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const sx = sx0 + ux * ramp * f;
        const sz = sz0 + uz * ramp * f;
        const hl = ramp / n / 2;
        const bed = Math.min(grd(sx, sz), grd(sx + ux * hl, sz + uz * hl), grd(sx - ux * hl, sz - uz * hl));
        const tread = grd(sx, sz) + 0.25;
        const base = bed - 0.6;
        yMin = Math.min(yMin, base);
        tura.box(sx, base, sz, ramp / n + 0.08, tread - base, 6.5, 0.86, 0.02, yaw);
        // timber skid rails on each run's tread (sledges were dragged on them)
        for (const s2 of [-1.3, 1.3]) {
          wood.box(sx - uz * s2, tread, sz + ux * s2, ramp / n + 0.02, 0.16, 0.26, 0.8, 0, yaw);
        }
      }
      fpReg({
        id: `slipway:${k}`, family: FAMILY, x: cx, z: cz, hx: ramp / 2, hz: 3.25,
        y0: yMin, y1: yTop + 0.5, yaw, ground: 'none',
      });
      pieces++;
    }
  }

  /* --- boatyard on the south shore ------------------------------------------ */
  {
    const hulls = [
      { x: 1006, z: 64, L: 30, B: 5.8, planked: 0 },
      { x: 1102, z: 70, L: 24, B: 5.0, planked: 0.55 },
    ];
    for (const [k, hu] of hulls.entries()) {
      const yaw = 0.12; // keel roughly parallel to the shore, bow east
      if (!dry(hu.x, hu.z, hu.L / 2 + 3, hu.B / 2 + 3, yaw)) continue;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const at = (u: number, v: number): [number, number] => [hu.x + u * c - v * s, hu.z + u * s + v * c];
      const gy = low(hu.x, hu.z, hu.L / 2, hu.B / 2, yaw);
      const keelY = gy + 0.75; // up on its stocks
      // stocks (keel blocks) every ~3 m
      for (let u = -hu.L / 2 + 2; u <= hu.L / 2 - 2; u += 3.1) {
        const [x, z] = at(u, 0);
        wood.box(x, grd(x, z) - 0.1, z, 0.6, keelY - grd(x, z) + 0.1, 1.4, 0.72, 0, yaw);
      }
      // keel plank (flat-bottomed river hull), sweeping up at both ends
      const nK = 14;
      for (let i = 0; i < nK; i++) {
        const f = (i + 0.5) / nK - 0.5; // −0.5..0.5
        const rise = Math.pow(Math.abs(f) * 2, 3) * 1.6;
        const [x, z] = at(f * hu.L, 0);
        wood.box(x, keelY + rise, z, hu.L / nK + 0.05, 0.28, 0.9, 0.82, 0, yaw);
      }
      // frames: U-moulds of three lashed members, beam tapering to the ends
      const nF = Math.round(hu.L / 1.9);
      for (let i = 1; i < nF; i++) {
        const f = i / nF - 0.5;
        const taper = 1 - Math.pow(Math.abs(f) * 2, 2.2) * 0.85;
        const half = (hu.B / 2) * taper;
        const depth = 1.7 * (0.55 + 0.45 * taper);
        const rise = Math.pow(Math.abs(f) * 2, 3) * 1.6;
        const [x, z] = at(f * hu.L, 0);
        const y0 = keelY + rise + 0.2;
        // floor timber across the keel
        wood.box(x, y0, z, 0.22, 0.2, half * 1.7, 0.78, 0, yaw);
        // two side members leaning out (approximated by stacked offsets)
        for (const sd of [-1, 1]) {
          for (let q = 0; q < 4; q++) {
            const qy = y0 + 0.2 + q * (depth / 4);
            const off = half * (0.82 + 0.06 * q);
            const [px, pz] = at(f * hu.L, sd * off);
            wood.box(px, qy, pz, 0.2, depth / 4 + 0.02, 0.2, 0.76, 0, yaw);
          }
        }
        // thwart beam at the sheer on every second frame
        if (i % 2 === 0) wood.box(x, y0 + depth + 0.12, z, 0.24, 0.18, half * 2.1, 0.74, 0, yaw);
      }
      // strakes: a sheer strake on the bare hull; lower strakes on the second
      const strakes = hu.planked > 0 ? 4 : 1;
      for (let sk = 0; sk < strakes; sk++) {
        const level = hu.planked > 0 ? 0.25 + sk * 0.38 : 1.55;
        const span = hu.planked > 0 ? hu.planked : 0.9;
        const nS = 10;
        for (const sd of [-1, 1]) {
          for (let i = 0; i < nS; i++) {
            const f = ((i + 0.5) / nS - 0.5) * span;
            const taper = 1 - Math.pow(Math.abs(f) * 2, 2.2) * 0.85;
            const half = (hu.B / 2) * taper * (0.84 + 0.12 * (level / 1.7));
            const rise = Math.pow(Math.abs(f) * 2, 3) * 1.6;
            const [px, pz] = at(f * hu.L, sd * half);
            wood.box(px, keelY + rise + 0.2 + level, pz, (hu.L * span) / nS + 0.06, 0.34, 0.09, 0.86, 0, yaw);
          }
        }
      }
      reg(`hull-on-stocks:${k}`, hu.x, hu.z, hu.L / 2 + 0.5, hu.B / 2 + 0.6, gy - 0.1, keelY + 3.6, yaw);
    }

    // timber stacks (cedar baulks) and plank piles beside the slip
    for (let t = 0; t < 4; t++) {
      const tx = 1040 + t * 13 + rng.range(-2, 2);
      const tz = 92 + rng.range(-2, 2);
      if (!dry(tx, tz, 4, 2)) continue;
      const ty = grd(tx, tz) - 0.05;
      const layers = 2 + rng.int(3);
      for (let l = 0; l < layers; l++) {
        const along = l % 2 === 0;
        for (let b = 0; b < 4; b++) {
          const off = -1.2 + b * 0.8;
          if (along) wood.box(tx, ty + l * 0.42, tz + off, 7.2, 0.4, 0.42, 0.8 + rng.range(-0.06, 0.06), 0);
          else wood.box(tx + off * 2.2, ty + l * 0.42, tz, 0.42, 0.4, 3.4, 0.82, 0);
        }
      }
      reg(`timber:${t}`, tx, tz, 3.8, 1.8, ty, ty + layers * 0.42 + 0.1);
    }
    // sawing frame: two forked posts, a baulk across, a plank half-cut
    {
      const fx = 1060;
      const fz = 40;
      if (dry(fx, fz, 4, 2)) {
        const fy = grd(fx, fz);
        for (const s of [-2.6, 2.6]) wood.box(fx + s, fy - 0.3, fz, 0.3, 2.1, 0.3, 0.7, 0.01);
        wood.box(fx, fy + 1.55, fz, 7.4, 0.5, 0.5, 0.84, 0);
        wood.box(fx + 1.2, fy + 1.3, fz + 0.2, 4.2, 0.12, 0.5, 0.92, 0);
        reg('saw-frame', fx, fz, 3.8, 0.5, fy - 0.3, fy + 2.1);
      }
    }
    // reed-mat sunshades over the work (four posts + a mat)
    for (const [k, mx, mz] of [[0, 1024, 50], [1, 1124, 52], [2, 1150, -318]] as const) {
      if (!dry(mx, mz, 3, 2.5)) continue;
      const my = grd(mx, mz);
      for (const [px, pz] of [[-2.6, -2], [2.6, -2], [-2.6, 2], [2.6, 2]] as const) {
        wood.box(mx + px, my - 0.2, mz + pz, 0.16, 2.6, 0.16, 0.66, 0);
      }
      mud.box(mx, my + 2.38, mz, 6.0, 0.08, 4.8, 0.78, 0);
      reg(`shade:${k}`, mx, mz, 3, 2.4, my - 0.2, my + 2.5);
    }
  }

  /* --- market on the north-shore road (v1.2) --------------------------------
   * canon Vol. IV District 5 lists "markets"; the Old Kingdom evidence is the
   * Saqqara market reliefs — sellers on the ground behind flat baskets of
   * fish, onions, loaves and sandals, buyers bartering grain or linen. Two
   * rows of stalls face a lane between the stone yard and the first
   * magazine range; each stall is solid, so the crowd keeps to the lane. */
  {
    const lane = -334;
    let k = 0;
    for (const side of [-1, 1]) {
      for (let x = 928 + (side > 0 ? 3 : 0); x < 992; x += rng.range(6.2, 7.6)) {
        const sz = lane + side * 4.6;
        if (!dry(x, sz, 2.3, 1.9)) continue;
        const y = low(x, sz, 1.95, 1.6) - 0.05;
        // reed-mat shade on four poles, a mat on the ground
        for (const [px, pz] of [[-1.7, -1.4], [1.7, -1.4], [-1.7, 1.4], [1.7, 1.4]] as const) {
          wood.box(x + px, y, sz + pz, 0.12, 2.15, 0.12, 0.8, 0);
        }
        reed.box(x, y + 2.15, sz, 3.9, 0.06, 3.3, rng.range(0.92, 1.08), 0);
        reed.box(x, y, sz, 3.2, 0.06, 2.6, rng.range(0.78, 0.9), 0);
        // the wares, in a row of flat baskets on the lane side
        const kind = rng.int(5);
        const gz = sz - side * 0.75;
        for (let b = 0; b < 3; b++) {
          const bx = x - 1.05 + b * 1.05 + rng.range(-0.1, 0.1);
          const by = y + 0.06;
          if (kind === 3) {
            // potter: jars and bowls straight on the mat
            const jh = rng.range(0.55, 0.8);
            ware.drum(bx, by, gz, 0.2, jh * 0.6, rng.range(0.9, 1.1), -0.25, 10); // belly
            ware.drum(bx, by + jh * 0.6, gz, 0.29, jh * 0.4, 1.0, 0.45, 10); // shoulder + neck
            ware.drum(bx + 0.3, by, gz - side * 0.45, 0.14, 0.14, 1.05, -0.6, 10); // bowl
            continue;
          }
          reed.drum(bx, by, gz, 0.39, 0.2, 0.72, -0.12, 9);
          const top = by + 0.2;
          for (let j = 0; j < 4; j++) {
            const jx = bx + rng.range(-0.2, 0.2);
            const jz = gz + rng.range(-0.2, 0.2);
            if (kind === 0) fish.box(jx, top, jz, 0.38, 0.07, 0.11, rng.range(0.85, 1.1), 0, rng.float() * Math.PI);
            else if (kind === 1) produce.box(jx, top, jz, 0.14, 0.24, 0.14, rng.range(0.8, 1.15), 0.2);
            else if (kind === 2) ware.box(jx, top, jz, 0.2, 0.2, 0.2, rng.range(1.15, 1.3), 0.35); // conical loaves
            else tura.box(jx, top, jz, 0.42, 0.1, 0.24, rng.range(0.95, 1.02), 0, rng.float() * Math.PI); // linen, sandals
          }
        }
        // the seller's water jar and stool-mat at the back
        ware.drum(x + 1.3, y + 0.06, sz + side * 0.9, 0.18, 0.55, 0.95, 0.12, 10);
        reg(`stall:${k++}`, x, sz, 1.95, 1.7, y, y + 2.25);
      }
    }
  }

  /* --- wells --------------------------------------------------------------- */
  for (const [k, wx, wz] of [[0, 1225, -302], [1, 955, 52], [2, 1236, 46], [3, 1062, -402]] as const) {
    if (!dry(wx, wz, 2.2, 2.2)) continue;
    const wy = grd(wx, wz) - 0.2;
    // round mudbrick ring with a dark water disc inside
    mud.drum(wx, wy, wz, 1.6, 0.95, 0.58, 0.02, 14);
    mud.drum(wx, wy + 0.92, wz, 1.05, 0.06, 0.1, 0, 14);
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2 + 0.4;
      mud.box(wx + Math.cos(a) * 2.4, wy + 0.2, wz + Math.sin(a) * 2.4, 0.5, 0.7, 0.5, 0.62, 0.14);
    }
    // jars stand on a 2.4 m ring: the footprint covers them (v1.2: 1.9 m
    // left the jars and the 45°-turned ring's corners outside it)
    reg(`well:${k}`, wx, wz, 2.7, 2.7, wy, wy + 1.1);
  }

  /* --- (v1.2 I6) the CARGO YARD behind the cargo landing (canon IX §9.12
   *      "cargo yards sufficiently large for temporary material storage and
   *      handling", "Dedicated locations for stone, rope, timber, food, and
   *      equipment"; VIII "Storage architecture should separate materials"):
   *      four bays walled apart, and the ADMINISTRATIVE SHELTER at its corner
   *      on the road from the landing — §9.21 "Scribes — Record cargo
   *      movements, supplies, and assignments", §9.23 "Clay sealings and
   *      recording materials suggest administrative control". Its own
   *      streams: the district's draws above are untouched. Plan §3.2. ------ */
  const yr = seed.rng('harbor-yard');
  const yf = seed.rng('harbor-folk');
  const yardProps = new ColorWriter();
  const yardFolk = new ColorWriter();
  const paths = new ColorWriter();
  {
    const X0 = 802;
    const X1 = 848;
    const bays = [-235, -217, -198, -179, -165]; // bay edges (z), north → south
    const yLow = (x: number, z: number, hx: number, hz: number): number =>
      Math.min(grd(x - hx, z - hz), grd(x + hx, z - hz), grd(x + hx, z + hz), grd(x - hx, z + hz));
    // the back wall and the walls between the bays (open at the east end)
    const wall = (id: string, ax: number, az: number, bx: number, bz: number): void => {
      const along = Math.abs(bz - az) > Math.abs(bx - ax);
      const len = Math.hypot(bx - ax, bz - az);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const y = yLow(mx, mz, along ? 0.45 : len / 2, along ? len / 2 : 0.45) - 0.1;
      mud.box(mx, y, mz, along ? 0.9 : len, 1.3, along ? len : 0.9, yr.range(0.92, 1.04), 0.03);
      reg(`cargo-yard:wall:${id}`, mx, mz, along ? 0.45 : len / 2, along ? len / 2 : 0.45, y, y + 1.3);
    };
    wall('w', X0 - 1, bays[0]!, X0 - 1, bays[4]!);
    for (let k = 1; k <= 3; k++) wall(`${k}`, X0 - 0.55, bays[k]!, X1 - 4, bays[k]!);
    reg('cargo-yard:ground', (X0 + X1) / 2, -200, (X1 - X0) / 2 + 1, 35, grd(825, -200) - 0.2, grd(825, -200) + 0.2, 0, 'none', true);

    // FOOD: grain sacks on mats, rows of sealed jars, baskets
    for (let r = 0; r < 3; r++) {
      const z = -231 + r * 4.5;
      const y = yLow(815, z, 11, 1.2);
      reed.box(815, y - 0.02, z, 22, 0.04, 2.4, 0.95); // the mat
      for (let x = 805; x < 825; x += yr.range(0.85, 1.05)) {
        reed.box(x, y + 0.02, z + yr.range(-0.4, 0.4), 0.7, yr.range(0.5, 0.65), 0.5, yr.range(0.88, 1.08), 0.12);
      }
      reg(`cargo-yard:food:${r}`, 815, z, 11, 1.2, y, y + 0.7);
    }
    for (let r = 0; r < 2; r++) {
      const z = -230 + r * 6;
      for (let x = 830; x < 845; x += 0.75) {
        const y = grd(x, z);
        ware.drum(x, y, z, 0.3, 0.55, yr.range(0.9, 1.05), -0.2, 9);
        ware.drum(x, y + 0.55, z, 0.19, 0.12, 0.7, 0, 9); // the mud stopper
      }
      reg(`cargo-yard:jars:${r}`, 837.5, z, 7.6, 0.35, grd(837.5, z), grd(837.5, z) + 0.7);
    }
    // ROPE: coils stacked in twos, a dark core, two rope-makers coiling
    for (let k = 0; k < 10; k++) {
      const x = 806 + (k % 5) * 3.2;
      const z = -212 + Math.floor(k / 5) * 3.4;
      const y = grd(x, z);
      for (let l = 0; l < 2; l++) {
        reed.drum(x, y + l * 0.26, z, 0.95 - l * 0.08, 0.24, 0.78, 0, 16);
        yardProps.box(x, y + l * 0.26 + 0.22, z, 0.5, 0.03, 0.5, [0.22, 0.18, 0.12], k);
      }
      reg(`cargo-yard:rope:${k}`, x, z, 0.95, 0.95, y, y + 0.55);
    }
    for (const [k, [x, z]] of ([[824, -210], [826.5, -206]] as const).entries()) {
      person(yardFolk, yf, x, grd(x, z), z, k === 0 ? Math.PI : 0, 'squat');
      reed.drum(x + (k === 0 ? -0.9 : 0.9), grd(x, z), z, 0.6, 0.18, 0.82, 0, 14); // a coil under way
    }
    // EQUIPMENT: sledges, levers, mallets, water jars for the sledge paths
    for (let k = 0; k < 2; k++) {
      const x = 810 + k * 7;
      const z = -190;
      const y = grd(x, z);
      for (const dz of [-0.6, 0.6]) wood.box(x, y - 0.02, z + dz, 3.6, 0.22, 0.28, 0.9);
      wood.box(x, y + 0.2, z, 3.3, 0.12, 1.5, 0.95);
      reg(`cargo-yard:sledge:${k}`, x, z, 1.8, 0.8, y, y + 0.35);
    }
    for (let k = 0; k < 8; k++) {
      const y = grd(826, -192);
      wood.box(826, y + Math.floor(k / 4) * 0.16, -194 + (k % 4) * 0.35, 4.2, 0.15, 0.16, yr.range(0.85, 1.0), 0, yr.range(-0.04, 0.04));
    }
    reg('cargo-yard:levers', 826, -193.5, 2.1, 0.8, grd(826, -193.5), grd(826, -193.5) + 0.35);
    for (let k = 0; k < 6; k++) {
      const x = 832 + k * 0.8;
      const y = grd(x, -186);
      ware.drum(x, y, -186, 0.32, 0.62, yr.range(0.92, 1.05), -0.2, 9);
    }
    reg('cargo-yard:water', 834, -186, 2.4, 0.4, grd(834, -186), grd(834, -186) + 0.7);
    // TIMBER: cedar baulks on sleepers
    for (let r = 0; r < 2; r++) {
      const z = -175 + r * 4;
      const y = grd(815, z);
      for (const dx of [-5, 0, 5]) wood.box(815 + dx, y - 0.02, z, 0.3, 0.2, 2.6, 0.8);
      for (let l = 0; l < 3; l++) {
        for (let c = 0; c < 4 - l; c++) {
          wood.box(815 + yr.range(-0.3, 0.3), y + 0.18 + l * 0.42, z - 0.9 + c * 0.6 + l * 0.3, 12.5, 0.4, 0.5, yr.range(1.05, 1.22));
        }
      }
      reg(`cargo-yard:timber:${r}`, 815, z, 6.4, 1.3, y, y + 1.5);
    }

    // the ADMINISTRATIVE SHELTER: a mud-brick room, a reed portico over a
    // bench, three scribes with their boards, an overseer, sealed jars and a
    // basket of clay sealings, a donkey waiting with panniers
    {
      const cx = 842;
      const cz = -172;
      const y = yLow(cx, cz, 2.3, 2.8) - 0.1;
      mud.box(cx - 2, y, cz, 0.5, 2.6, 5.5, 1.0, 0.02);
      mud.box(cx, y, cz - 2.5, 4.5, 2.6, 0.5, 1.0, 0.02);
      mud.box(cx, y, cz + 2.5, 4.5, 2.6, 0.5, 1.0, 0.02);
      mud.box(cx + 2, y, cz - 1.55, 0.5, 2.6, 2.4, 1.0, 0.02); // east wall, the doorway south of it
      mud.box(cx + 2, y + 2.0, cz + 1.35, 0.5, 0.6, 1.8, 1.0, 0); // over the door
      mud.box(cx + 2, y, cz + 2.0, 0.5, 2.0, 0.5, 1.0, 0);
      mud.box(cx, y + 2.6, cz, 4.9, 0.18, 5.9, 1.08); // the roof
      reg('admin', cx, cz, 2.45, 2.95, y, y + 2.8);
      // the portico east of it, over a mud bench
      const px = cx + 4.4;
      for (const [dx, dz] of [[-1.8, -2.6], [1.8, -2.6], [-1.8, 2.6], [1.8, 2.6]] as const) {
        yardProps.box(px + dx, y, cz + dz, 0.12, 2.3, 0.12, [0.4, 0.31, 0.2]);
      }
      reedRoof(yardProps, [px - 2.0, y + 2.3, cz - 2.8], [px + 2.0, y + 2.3, cz - 2.8], [px + 2.0, y + 2.3, cz + 2.8], [px - 2.0, y + 2.3, cz + 2.8], [0.62, 0.55, 0.37]);
      mud.box(px - 1.2, y, cz, 0.6, 0.45, 4.2, 1.05, 0); // the bench
      for (let k = 0; k < 3; k++) {
        const sz = cz - 1.4 + k * 1.4;
        person(yardFolk, yf, px - 0.3, y + 0.04, sz, 0, 'sit'); // facing the landing
        yardFolk.box(px + 0.05, y + 0.42, sz, 0.26, 0.03, 0.36, [0.72, 0.66, 0.52]); // writing board
        yardFolk.box(px + 0.1, y + 0.46, sz + 0.12, 0.1, 0.02, 0.24, [0.3, 0.26, 0.2]); // palette
      }
      person(yardFolk, yf, px + 1.4, y, cz + 1.8, Math.PI - 0.5, 'stand', 1, [0.9, 0.87, 0.78]);
      yardFolk.beam([px + 1.62, y, cz + 1.9], [px + 1.62, y + 1.85, cz + 1.9], 0.02, [0.4, 0.31, 0.2]); // staff
      for (let k = 0; k < 4; k++) {
        ware.drum(px + 1.2 + (k % 2) * 0.6, y, cz - 2.0 + Math.floor(k / 2) * 0.6, 0.24, 0.5, 1.0, -0.15, 9);
        yardProps.box(px + 1.2 + (k % 2) * 0.6, y + 0.5, cz - 2.0 + Math.floor(k / 2) * 0.6, 0.18, 0.06, 0.18, [0.52, 0.44, 0.34]); // the seal
      }
      yardProps.box(px + 0.6, y, cz - 2.2, 0.5, 0.25, 0.5, [0.55, 0.46, 0.3]); // basket of clay sealings
      for (let k = 0; k < 9; k++) yardProps.box(px + 0.48 + (k % 3) * 0.12, y + 0.25, cz - 2.32 + Math.floor(k / 3) * 0.12, 0.08, 0.04, 0.08, [0.5, 0.3, 0.22], k);
      reg('admin:portico', px, cz, 2.0, 2.8, y, y + 2.4);
      donkey(yardFolk, yf, px + 4.2, grd(px + 4.2, cz - 5), cz - 5, Math.PI / 2, true);
    }
  }
  // worn paths: from each landing and ramp up to the road behind the bank
  // ("Paths worn between unloading areas and inland transport routes")
  {
    const PATH: C3 = [0.5, 0.43, 0.33];
    for (const [z, w] of [[-187, 6], [-115, 6], [-70, 3], [-212, 3]] as const) {
      for (let x = 846; x < 866; x += 1) {
        const P = (px: number, pz: number): C3 => [px, grd(px, pz) + 0.05, pz];
        const a = P(x, z - w / 2);
        const b = P(x, z + w / 2);
        const c = P(x + 1, z + w / 2);
        const d = P(x + 1, z - w / 2);
        paths.quad(a, b, c, d, PATH);
      }
    }
  }

  /* --- materialize ------------------------------------------------------------ */
  const meshes = [
    new Mesh(mud.build(), limestoneMaterial([0.6, 0.48, 0.35], gi, 0.3, 0.45)),
    new Mesh(tura.build(), limestoneMaterial([0.86, 0.83, 0.76], gi, 0.5, 1.15, { rough: 0.68 })),
    // Aswan granite: pink-red feldspar with dark mica — darker and redder
    // than anything else in the frame, honed but not polished
    new Mesh(granite.build(), limestoneMaterial([0.6, 0.39, 0.34], gi, 0.5, 1.15, { rough: 0.6, spec: 0.45 })),
    new Mesh(wood.build(), limestoneMaterial([0.36, 0.27, 0.17], gi, 0.24, 0.32, { rough: 0.8 })),
    // market (v1.2): reed matting coursed like weave, red-brown ware,
    // green produce, silvery fish
    new Mesh(reed.build(), limestoneMaterial([0.7, 0.6, 0.41], gi, 0.08, 0.3, { rough: 0.92 })),
    new Mesh(ware.build(), limestoneMaterial([0.6, 0.41, 0.29], gi, 0.5, 1.15, { rough: 0.85 })),
    new Mesh(produce.build(), limestoneMaterial([0.33, 0.42, 0.2], gi, 0.5, 1.15, { rough: 0.75 })),
    new Mesh(fish.build(), limestoneMaterial([0.55, 0.56, 0.54], gi, 0.5, 1.15, { rough: 0.45, spec: 0.6 })),
  ];
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'harbor-district';
    scene.add(m);
  }
  // (v1.2 I6) the yard's props (no figures: addTownsfolk would drop them),
  // its people, and the worn paths
  if (yardProps.pos.length > 0) scene.add(townsfolkMesh(yardProps, gi, 'harbor-district'));
  addTownsfolk(scene, yardFolk, gi, 'harbor-district');
  if (paths.pos.length > 0) {
    const pm = new Mesh(paths.build(), earthMaterial(gi));
    pm.receiveShadow = true;
    pm.name = 'harbor-district';
    scene.add(pm);
  }
  return pieces;
}
