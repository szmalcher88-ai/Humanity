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
import { fpReg } from '../debug/Footprints';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';

const FAMILY = 'harbor-district';

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
  const reg = (id: string, x: number, z: number, hx: number, hz: number, y0: number, y1: number, yaw = 0): void => {
    fpReg({ id, family: FAMILY, x, z, hx, hz, y0, y1, yaw, ground: 'grounded' });
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
        // three shrinking octagonal tiers (crossed boxes at 45°) + a cap
        for (const [d, th, tone] of [[5.6, 2.4, 0.72], [4.6, 2.0, 0.74], [3.2, 1.6, 0.76], [1.4, 0.9, 0.7]] as const) {
          const base = sy + (d === 5.6 ? 0 : d === 4.6 ? 2.3 : d === 3.2 ? 4.2 : 5.7);
          mud.box(sx, base, sz, d, th, d, tone, 0.06);
          mud.box(sx, base, sz, d, th, d, tone, 0.06, Math.PI / 4);
        }
        // filling hatch near the top
        mud.box(sx, sy + 4.9, sz + 1.25, 0.6, 0.6, 0.2, 0.12, 0);
      }
      reg('granary', gx, gz, W / 2, L / 2, y, y + 6.8);
    }
  }

  /* --- stone yard by the quay: dressed casing blocks + granite --------------- */
  {
    const yx = 915;
    const yz = -276;
    const hw = 30;
    const hd = 18;
    if (dry(yx, yz, hw, hd, 0, 0.5)) {
      for (let row = 0; row < 4; row++) {
        const rz = yz - hd + 5 + row * 9;
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
        const gzz = yz + hd - 3.5;
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
      reg('stone-yard', yx, yz, hw, hd, grd(yx, yz) - 0.2, grd(yx, yz) + 2.6);
    }
  }

  /* --- cargo slipways into the basin --------------------------------------- */
  {
    // ramps run from the dry road down past the waterline; found by walking
    // toward the basin centre until the bed is 1.2 m under water
    const basin = { x: 1077, z: -135 };
    for (const [k, sx0, sz0] of [[0, 1040, -312], [1, 1160, -302], [2, 1045, 44]] as const) {
      const dx = basin.x - sx0;
      const dz = basin.z - sz0;
      const len0 = Math.hypot(dx, dz);
      const ux = dx / len0;
      const uz = dz / len0;
      let t = 0;
      while (t < 160 && grd(sx0 + ux * t, sz0 + uz * t) > NILE_WATER_Y + 0.3) t += 2;
      const tEnd = t + 7; // run on into the water
      const ramp = Math.max(10, tEnd);
      const yaw = Math.atan2(uz, ux);
      const cx = sx0 + ux * ramp / 2;
      const cz = sz0 + uz * ramp / 2;
      const yTop = grd(sx0, sz0);
      const yBot = NILE_WATER_Y - 1.2;
      // stepped stone runs: 8 segments descending from the road to the bed
      const n = 8;
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const yy = yTop + (yBot - yTop) * f;
        const bed = grd(sx0 + ux * ramp * f, sz0 + uz * ramp * f);
        const base = Math.min(bed, yy) - 0.6;
        tura.box(sx0 + ux * ramp * f, base, sz0 + uz * ramp * f, ramp / n + 0.08, yy - base + 0.25, 6.5, 0.86, 0.02, yaw);
      }
      // timber skid rails laid along the ramp (sledges were dragged on them)
      for (const s of [-1.3, 1.3]) {
        wood.box(cx - uz * s, (yTop + yBot) / 2 + 0.2, cz + ux * s, ramp, 0.16, 0.26, 0.8, 0, yaw);
      }
      fpReg({
        id: `slipway:${k}`, family: FAMILY, x: cx, z: cz, hx: ramp / 2, hz: 3.25,
        y0: yBot - 0.6, y1: yTop + 0.5, yaw, ground: 'none',
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

  /* --- wells --------------------------------------------------------------- */
  for (const [k, wx, wz] of [[0, 1225, -302], [1, 955, 52], [2, 1236, 46], [3, 1062, -402]] as const) {
    if (!dry(wx, wz, 2.2, 2.2)) continue;
    const wy = grd(wx, wz) - 0.2;
    // octagonal mudbrick ring: crossed boxes, with a dark water disc inside
    mud.box(wx, wy, wz, 3.2, 0.95, 3.2, 0.58, 0.02);
    mud.box(wx, wy, wz, 3.2, 0.95, 3.2, 0.58, 0.02, Math.PI / 4);
    mud.box(wx, wy + 0.92, wz, 2.1, 0.06, 2.1, 0.1, 0);
    mud.box(wx, wy + 0.92, wz, 2.1, 0.06, 2.1, 0.1, 0, Math.PI / 4);
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2 + 0.4;
      mud.box(wx + Math.cos(a) * 2.4, wy + 0.2, wz + Math.sin(a) * 2.4, 0.5, 0.7, 0.5, 0.62, 0.14);
    }
    reg(`well:${k}`, wx, wz, 1.9, 1.9, wy, wy + 1.1);
  }

  /* --- materialize ------------------------------------------------------------ */
  const meshes = [
    new Mesh(mud.build(), limestoneMaterial([0.6, 0.48, 0.35], gi, 0.3, 0.45)),
    new Mesh(tura.build(), limestoneMaterial([0.86, 0.83, 0.76], gi, 0.5, 1.15, { rough: 0.68 })),
    // Aswan granite: pink-red feldspar with dark mica — darker and redder
    // than anything else in the frame, honed but not polished
    new Mesh(granite.build(), limestoneMaterial([0.6, 0.39, 0.34], gi, 0.5, 1.15, { rough: 0.6, spec: 0.45 })),
    new Mesh(wood.build(), limestoneMaterial([0.36, 0.27, 0.17], gi, 0.24, 0.32, { rough: 0.8 })),
  ];
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'harbor-district';
    scene.add(m);
  }
  return pieces;
}
