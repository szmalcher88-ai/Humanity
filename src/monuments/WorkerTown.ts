/**
 * Heit el-Ghurab — the workers' town SE of the plateau (Phase 6, canon
 * Vol. VIII; DEVIATIONS D-6: shown as the Khufu-era settlement per AERA's
 * dating of the exposed layout):
 *
 *   WALL OF THE CROW — cyclopean stone wall with its great gate
 *   GALLERY COMPLEX — four barrack blocks: street portico on wooden posts,
 *     a REAL doorway into every gallery, per-gallery roof strips with
 *     protruding beam ends, parapets, rear vents
 *   EASTERN TOWN — packed domestic rooms: varied heights, doorways,
 *     courtyards, roof stairs, rooftop jars
 *   BAKERY ROWS — soot-capped rooms with hearths and vat emplacements
 *   RAB — walled administrative compound with a court of beehive silos
 *   PENS — low animal corrals; street clutter (jar rows, woodpiles)
 *
 * v1 read as parking-garage slabs (monolithic roofs, blank walls,
 * ashlar-scale joints). v2 rules: every roof is broken into strips with
 * tone jitter, every doorway is a real gap with a lintel, wood is dark
 * per-vertex tone on the shared mudbrick material (0.30 m courses ×
 * 0.45 m bricks), and no two rooms share a height.
 */

import { Mesh, type Object3D } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { edPos } from '../debug/EditOverrides';
import { fpReg } from '../debug/Footprints';
import { WORKER_TOWN_CENTER, WORKER_TOWN_YAW } from '../world/CANON_DIMENSIONS';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';
import { ColorWriter, addTownsfolk, dog, donkey, goat, goose, person, sheep } from './Townsfolk';
import type { Gang } from './Inhabitants';

/** town-local frame: +u east-ish, +v south-ish, rotated by YAW about center
 *  (the real HeG street grid sits slightly off cardinal) */
const YAW = WORKER_TOWN_YAW;

/** work lines the town contributes to the inhabitants (water carriers,
 *  brewery porters, scribes' runners) — refilled on every town build */
export const townLines: Gang[] = [];

/* per-vertex tone language on the shared mud material:
 *   ~0.55 wall brick · ~0.66 roof plaster · 0.28 wood · 0.12 openings
 *   ~0.74 silo plaster · 0.2 soot */
const T_WOOD = 0.28;
const T_DARK = 0.1;

export function buildWorkerTown(
  scene: Object3D,
  seed: WorldSeed,
  hf: Heightfield,
  gi: ProbeGI | null = null,
): number {
  const rng = seed.rng('worker-town');
  const [tx, tz] = edPos('worker-town', WORKER_TOWN_CENTER.x, WORKER_TOWN_CENTER.z);
  const cy = Math.cos(YAW);
  const sy = Math.sin(YAW);
  const wx = (u: number, v: number): number => tx + u * cy - v * sy;
  const wz = (u: number, v: number): number => tz + u * sy + v * cy;

  const stone = new GeoWriter(); // Wall of the Crow
  const mud = new GeoWriter(); // everything else
  let rooms = 0;
  const pens: { u: number; v: number; w0: number }[] = [];

  const grd = (u: number, v: number): number => hf.heightAtCpu(wx(u, v), wz(u, v));
  /** box in town-local coords at an EXPLICIT base y */
  const lbox = (
    w: GeoWriter, u: number, y: number, v: number,
    lu: number, h: number, lv: number, tone: number, batter = 0, yawExtra = 0,
    batterV = batter,
  ): void => {
    w.box(wx(u, v), y, wz(u, v), lu, h, lv, tone, batter, YAW + yawExtra, batterV);
  };
  /** grounded box (lowest footprint corner − sink); returns base y */
  const gbox = (
    w: GeoWriter, u: number, v: number, lu: number, h: number, lv: number,
    tone: number, batter = 0, sink = 0.35, batterV = batter,
  ): number => {
    const y =
      Math.min(
        grd(u - lu / 2, v - lv / 2), grd(u + lu / 2, v - lv / 2),
        grd(u - lu / 2, v + lv / 2), grd(u + lu / 2, v + lv / 2),
      ) - sink;
    lbox(w, u, y, v, lu, h + sink, lv, tone, batter, 0, batterV);
    return y;
  };
  /** long axis-aligned wall that FOLLOWS the ground: split into ~`seg` m
   *  runs, each grounded on its own lowest corner, so the base and the
   *  coping step down the slope (v1.1 — one flat-based 205 m box on a 10 m
   *  fall buried the Wall of the Crow's west end 6 m deep). Returns the
   *  per-run base heights, west/north first. */
  const gwall = (
    w: GeoWriter, u0: number, v0: number, u1: number, v1: number,
    h: number, th: number, tone: number, batter = 0, sink = 0.35, seg = 14,
  ): { u: number; v: number; len: number; y: number }[] => {
    const alongU = Math.abs(u1 - u0) >= Math.abs(v1 - v0);
    const L = alongU ? Math.abs(u1 - u0) : Math.abs(v1 - v0);
    const n = Math.max(1, Math.round(L / seg));
    const runs: { u: number; v: number; len: number; y: number }[] = [];
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      const u = u0 + (u1 - u0) * f;
      const v = v0 + (v1 - v0) * f;
      // 4 cm overlap so neighbouring runs never open a daylight slit
      const len = L / n + 0.04;
      // batter the thickness only: battered ends would notch every joint
      const y = alongU
        ? gbox(w, u, v, len, h, th, tone, 0, sink, batter)
        : gbox(w, u, v, th, h, len, tone, batter, sink, 0);
      runs.push({ u, v, len, y });
    }
    return runs;
  };
  /** doorway illusion on a wall face: dark slab proud of the face by 4 cm.
   *  faces: 0=north(−v) 1=east(+u) 2=south(+v) 3=west(−u) */
  const door = (
    u: number, v: number, baseY: number, face: number, w0 = 0.95, h0 = 1.75, wr: GeoWriter = mud,
  ): void => {
    const off = 0.06;
    if (face === 0) lbox(wr, u, baseY, v - off, w0, h0, 0.1, 0, 0);
    else if (face === 1) lbox(wr, u + off, baseY, v, 0.1, h0, w0, 0, 0);
    else if (face === 2) lbox(wr, u, baseY, v + off, w0, h0, 0.1, 0, 0);
    else lbox(wr, u - off, baseY, v, 0.1, h0, w0, 0, 0);
  };

  /* --- Wall of the Crow (north boundary, great gate mid-west) -------------- */
  {
    const v = -175;
    const L = 205;
    const th = 9.5;
    const h = 9;
    const gateU = -45;
    const gateHalf = 3.4;
    const runs = [
      ...gwall(stone, -L / 2, v, gateU - gateHalf, v, h, th, 0.85, 0.055, 0.6),
      ...gwall(stone, gateU + gateHalf, v, L / 2, v, h, th, 0.83, 0.055, 0.6),
    ];
    // gate: massive lintel + slightly proud jambs (reveals)
    const gy = Math.min(grd(gateU, v - th / 2), grd(gateU, v + th / 2));
    stone.box(wx(gateU, v), gy + 4.6, wz(gateU, v), gateHalf * 2 + 2.4, 1.7, th, 0.8, 0, YAW);
    for (const s of [-1, 1]) {
      lbox(stone, gateU + s * (gateHalf + 0.35), gy - 0.3, v, 0.7, 4.9, th + 0.5, 0.78, 0.01);
    }
    // one footprint per run: each carries its own base, so the audit can
    // see a run that the slope swallows
    runs.forEach((r, k) => {
      fpReg({
        id: `wall-of-crow:${k}`, family: 'worker-town', x: wx(r.u, v), z: wz(r.u, v),
        hx: r.len / 2, hz: th / 2, y0: r.y, y1: r.y + h + 0.6, yaw: YAW,
        ground: 'grounded', editGroup: 'worker-town',
      });
    });
  }

  /* --- gallery complex: 4 barrack blocks ------------------------------------ */
  const blockW = 78; // E-W
  const blockL = 36; // N-S (gallery length)
  const galleryPitch = 4.7;
  const wallH = 2.9;
  for (let b = 0; b < 4; b++) {
    const bu = -78 + (b % 2) * (blockW + 10);
    const bv = -118 + Math.floor(b / 2) * (blockL + 9);
    const t = rng.fork(`block-${b}`);
    // uniform platform base — mixed per-wall grounding poked walls through
    // the roof on sloping ground
    const base =
      Math.min(
        grd(bu - blockW / 2, bv - blockL / 2), grd(bu + blockW / 2, bv - blockL / 2),
        grd(bu - blockW / 2, bv + blockL / 2), grd(bu + blockW / 2, bv + blockL / 2),
      ) - 0.45;
    const wallT = 0.58 + t.range(-0.02, 0.02);
    const nGal = Math.floor(blockW / galleryPitch);
    // gallery partition walls (full length)
    for (let g = 0; g <= nGal; g++) {
      const gu = bu - blockW / 2 + g * galleryPitch;
      lbox(mud, gu, base, bv, 0.55, wallH + 0.45, blockL, wallT + t.range(-0.05, 0.05), 0.02);
    }
    // rear (south) wall + per-gallery vent patches high up
    lbox(mud, bu, base, bv + blockL / 2, blockW, wallH + 0.45, 0.6, wallT, 0.02);
    for (let g = 0; g < nGal; g++) {
      const gu = bu - blockW / 2 + (g + 0.5) * galleryPitch;
      lbox(mud, gu, base + wallH - 0.7, bv + blockL / 2 + 0.06, 0.45, 0.45, 0.1, T_DARK);
    }
    // FRONT (north): doorway into every gallery — wall segments + lintels
    const fv = bv - blockL / 2;
    const doorW = 1.15;
    for (let g = 0; g < nGal; g++) {
      const gu = bu - blockW / 2 + (g + 0.5) * galleryPitch;
      const segW = (galleryPitch - doorW) / 2;
      lbox(mud, gu - (doorW + segW) / 2, base, fv, segW, wallH + 0.45, 0.6, wallT, 0.02);
      lbox(mud, gu + (doorW + segW) / 2, base, fv, segW, wallH + 0.45, 0.6, wallT, 0.02);
      lbox(mud, gu, base + 2.0, fv, doorW + 0.3, wallH - 1.55, 0.62, wallT - 0.06);
      // wooden door leaf, ajar
      if (t.chance(0.5)) lbox(mud, gu + 0.25, base, fv - 0.1, 0.7, 1.9, 0.08, T_WOOD, 0, 0.3);
    }
    // per-gallery ROOF STRIPS (broken monolith: height + tone jitter)
    for (let g = 0; g < nGal; g++) {
      const gu = bu - blockW / 2 + (g + 0.5) * galleryPitch;
      lbox(
        mud, gu, base + wallH + 0.35 + t.range(-0.06, 0.06), bv,
        galleryPitch + 0.12, 0.2, blockL + 0.7, 0.62 + t.range(-0.05, 0.05),
      );
    }
    // beam ends protruding under the roof line, front + back
    for (let g = 0; g < nGal; g++) {
      const gu = bu - blockW / 2 + (g + 0.5) * galleryPitch;
      for (const du of [-1.4, 0, 1.4]) {
        lbox(mud, gu + du, base + wallH + 0.05, fv - 0.45, 0.16, 0.2, 0.5, T_WOOD);
        lbox(mud, gu + du, base + wallH + 0.05, bv + blockL / 2 + 0.45, 0.16, 0.2, 0.5, T_WOOD);
      }
    }
    // street PORTICO: wooden posts + shade roof along the front
    for (let p = 0; p <= Math.floor(blockW / 2.4); p++) {
      lbox(mud, bu - blockW / 2 + p * 2.4, base, fv - 2.1, 0.18, 2.25, 0.18, T_WOOD);
    }
    lbox(mud, bu, base + 2.25, fv - 1.15, blockW + 0.5, 0.14, 2.3, 0.56);
    // parapet around the block roof
    const py = base + wallH + 0.5;
    lbox(mud, bu, py, bv - blockL / 2 + 0.2, blockW + 0.3, 0.42, 0.3, wallT);
    lbox(mud, bu, py, bv + blockL / 2 - 0.2, blockW + 0.3, 0.42, 0.3, wallT);
    lbox(mud, bu - blockW / 2, py, bv, 0.3, 0.42, blockL, wallT);
    lbox(mud, bu + blockW / 2, py, bv, 0.3, 0.42, blockL, wallT);
    // storage-jar row against the front wall
    for (let j = 0; j < 8; j++) {
      if (!t.chance(0.7)) continue;
      const ju = bu - blockW / 2 + 4 + j * 9 + t.range(-1.5, 1.5);
      lbox(mud, ju, base, fv - 0.85, 0.42, t.range(0.5, 0.75), 0.42, 0.4, 0.06, t.float());
    }
    rooms += nGal;
    fpReg({
      id: `galleries:${b}`, family: 'worker-town', x: wx(bu, bv), z: wz(bu, bv),
      hx: blockW / 2 + 0.5, hz: blockL / 2 + 2.6,
      y0: base, y1: base + wallH + 1,
      yaw: YAW, ground: 'grounded', editGroup: 'worker-town',
    });
  }

  /* --- eastern town: packed domestic rooms (organic, lived-in) --------------- */
  {
    const t = rng.fork('east-town');
    // (v1.2 I3) the public court: cells gu 2-4 × gv 3-4 are drawn as before
    // (same random draws — nothing else in the town moves) but written into
    // a throwaway writer, leaving a ~28 × 17 m square open
    const junk = new GeoWriter();
    for (let gu = 0; gu < 7; gu++) {
      for (let gv = 0; gv < 9; gv++) {
        if (t.chance(0.22)) continue; // courtyards / lanes
        const court = gu >= 2 && gu <= 4 && gv >= 3 && gv <= 4;
        const W0 = court ? junk : mud;
        const u = 62 + gu * 9.5 + t.range(-1.6, 1.6);
        const v = -128 + gv * 8.5 + t.range(-1.4, 1.4);
        const lu = t.range(5.2, 8.4);
        const lv = t.range(4.6, 7.6);
        const h = t.range(2.2, 3.4);
        const wt = 0.52 + t.range(-0.07, 0.07);
        const y = gbox(W0, u, v, lu, h, lv, wt, 0.025);
        // roof slab with a slight overhang, lighter plaster tone
        lbox(W0, u, y + h + 0.32, v, lu + 0.3, 0.16, lv + 0.3, 0.64 + t.range(-0.05, 0.05));
        // doorway toward a lane (random face), sometimes with wood lintel
        const face = t.int(4);
        door(
          face === 0 ? u : face === 1 ? u + lu / 2 : face === 2 ? u : u - lu / 2,
          face === 0 ? v - lv / 2 : face === 2 ? v + lv / 2 : v,
          y + 0.3, face, 0.95, 1.75, W0,
        );
        // rooftop parapet on half the houses
        if (t.chance(0.5)) {
          lbox(W0, u, y + h + 0.44, v - lv / 2 + 0.12, lu + 0.3, 0.34, 0.22, wt);
          lbox(W0, u, y + h + 0.44, v + lv / 2 - 0.12, lu + 0.3, 0.34, 0.22, wt);
        }
        // external stair to the roof on a third
        if (t.chance(0.33)) {
          const su = u + lu / 2 + 0.55;
          const steps = 5;
          for (let s = 0; s < steps; s++) {
            lbox(
              W0, su, y + (s * h) / steps, v - lv / 2 + 0.9 + s * (lv - 1.8) / steps,
              1.05, h / steps + 0.12, (lv - 1.8) / steps + 0.25, wt + 0.04,
            );
          }
        }
        // rooftop jars / clutter
        if (t.chance(0.4)) {
          for (let j = 0; j < t.int(3) + 1; j++) {
            lbox(
              W0, u + t.range(-lu / 3, lu / 3), y + h + 0.4, v + t.range(-lv / 3, lv / 3),
              0.34, t.range(0.4, 0.6), 0.34, 0.42, 0.05, t.float(),
            );
          }
        }
        // courtyard wing on some: low L-wall
        if (t.chance(0.35)) {
          const cw = t.range(3, 4.6);
          lbox(W0, u - lu / 2 - cw / 2, y, v + lv / 2 - 0.15, cw, 1.25, 0.3, wt);
          lbox(W0, u - lu / 2 - cw + 0.15, y, v + lv / 2 - cw / 2, 0.3, 1.25, cw, wt);
        }
        if (court) continue;
        // (v1.2 I3) one footprint per house: a single 70 × 80 m box over
        // the whole quarter made every lane and court solid to the figures
        fpReg({
          id: `house:${gu}:${gv}`, family: 'worker-town', x: wx(u, v), z: wz(u, v),
          hx: lu / 2 + 0.15, hz: lv / 2 + 0.15, y0: y, y1: y + h + 0.6, yaw: YAW,
          ground: 'grounded', editGroup: 'worker-town',
        });
        rooms++;
      }
    }
  }

  /* --- bakery rows (south): soot-capped rooms + hearths + vats --------------- */
  {
    const t = rng.fork('bakeries');
    for (let i = 0; i < 9; i++) {
      const u = -95 + i * 11.5 + t.range(-0.8, 0.8);
      const v = 32 + (i % 2) * 9 + t.range(-0.8, 0.8);
      const h = t.range(2.1, 2.6);
      const y = gbox(mud, u, v, 7.4, h, 6.2, 0.48 + t.range(-0.04, 0.04), 0.025);
      // soot-blackened chimney cap + roof
      lbox(mud, u, y + h + 0.28, v, 7.6, 0.14, 6.4, 0.58);
      lbox(mud, u + t.range(-2, 2), y + h + 0.4, v + 1.6, 0.8, 0.75, 0.8, 0.2);
      door(u, v - 3.1, y + 0.3, 0);
      // hearth + vat emplacements against the south wall
      lbox(mud, u + t.range(-1.6, 1.6), y, v + 2.2, 1.4, 0.9, 1.2, 0.3);
      for (let k = 0; k < 2; k++) {
        lbox(mud, u - 2.4 + k * 1.3, y, v + 2.3, 0.55, 0.55, 0.55, 0.36, 0.06, t.float());
      }
      // (v1.2 I3) one footprint per bakery: the 116 × 24 m box over the row
      // made the bakers' yard solid
      fpReg({
        id: `bakery:${i}`, family: 'worker-town', x: wx(u, v), z: wz(u, v),
        hx: 3.8, hz: 3.2, y0: y, y1: y + h + 0.6, yaw: YAW,
        ground: 'grounded', editGroup: 'worker-town',
      });
      rooms++;
    }
  }

  /* --- RAB: administrative compound with a beehive-silo court ---------------- */
  {
    const cu = 96;
    const cv = 30;
    const W = 46;
    const L = 34;
    const t = rng.fork('rab');
    const y = gbox(mud, cu, cv, W, 3.4, 0.9, 0.58, 0.03); // north wall
    lbox(mud, cu, y, cv + L, W, 3.4, 0.9, 0.57, 0.03);
    lbox(mud, cu - W / 2, y, cv + L / 2, 0.9, 3.4, L, 0.58, 0.03);
    lbox(mud, cu + W / 2, y, cv + L / 2, 0.9, 3.4, L, 0.56, 0.03);
    door(cu - W / 2 - 0.5, cv + L / 2, y + 0.3, 3, 1.4, 2.2);
    // hall along the east wall
    lbox(mud, cu + W / 2 - 5.5, y, cv + L / 2, 9, 3.0, L - 6, 0.54, 0.025);
    lbox(mud, cu + W / 2 - 5.5, y + 3.2, cv + L / 2, 9.4, 0.16, L - 5.6, 0.64);
    // beehive silos: two rows, 3 shrinking octagonal tiers each
    for (let s = 0; s < 6; s++) {
      const su = cu - W / 2 + 7 + (s % 3) * 8;
      const sv = cv + 9 + Math.floor(s / 3) * 12;
      const tiers = [
        [3.4, 1.35], [2.5, 1.1], [1.5, 0.95],
      ] as const;
      let ty = y;
      for (const [d, th2] of tiers) {
        // round tiers (v1.2: drums, not two boxes crossed into a star); the
        // second tone draw is kept so the town's random stream is unchanged
        const tone = 0.74 + t.range(-0.03, 0.03);
        t.range(-0.03, 0.03);
        mud.drum(wx(su, sv), ty, wz(su, sv), d / 2, th2, tone, 0.12, 14);
        ty += th2;
      }
      lbox(mud, su, ty, sv, 0.6, 0.35, 0.6, 0.4, 0.1);
      rooms++;
    }
    const gy = grd(cu, cv + L / 2);
    fpReg({
      id: 'rab', family: 'worker-town', x: wx(cu, cv + L / 2), z: wz(cu, cv + L / 2),
      hx: W / 2 + 0.5, hz: L / 2 + 0.5, y0: gy - 0.6, y1: gy + 5.5, yaw: YAW,
      ground: 'grounded', editGroup: 'worker-town',
    });
  }

  /* --- animal pens + woodpiles (south-west) ----------------------------------- */
  {
    const t = rng.fork('pens');
    for (let p = 0; p < 3; p++) {
      const u = -108 + p * 16 + t.range(-1, 1);
      const v = 58 + t.range(-2, 2);
      const w0 = t.range(10, 13);
      const y = gbox(mud, u, v, w0, 0.95, 0.35, 0.5, 0.02);
      lbox(mud, u, y, v + w0 * 0.75, w0, 0.95, 0.35, 0.5, 0.02);
      lbox(mud, u - w0 / 2, y, v + w0 * 0.375, 0.35, 0.95, w0 * 0.75, 0.5, 0.02);
      lbox(mud, u + w0 / 2, y, v + w0 * 0.375, 0.35, 0.95, w0 * 0.75 - 2.4, 0.5, 0.02);
      pens.push({ u, v, w0 });
      fpReg({
        id: `pen:${p}`, family: 'worker-town', x: wx(u, v + w0 * 0.375), z: wz(u, v + w0 * 0.375),
        hx: w0 / 2 + 0.2, hz: w0 * 0.375 + 0.2, y0: y, y1: y + 1.0, yaw: YAW,
        ground: 'grounded', editGroup: 'worker-town',
      });
    }
    for (let wp = 0; wp < 5; wp++) {
      const u = -70 + wp * 9 + t.range(-2, 2);
      const v = 62 + t.range(-2, 2);
      const y = grd(u, v) - 0.1;
      for (let k = 0; k < 3; k++) {
        lbox(mud, u, y + k * 0.24, v, t.range(1.6, 2.4), 0.22, 0.6 - k * 0.12, T_WOOD, 0, t.range(-0.1, 0.1));
      }
      fpReg({
        id: `woodpile:${wp}`, family: 'worker-town', x: wx(u, v), z: wz(u, v),
        hx: 1.3, hz: 0.45, y0: y, y1: y + 0.75, yaw: YAW, ground: 'grounded', editGroup: 'worker-town',
      });
    }
  }

  /* --- enclosure wall (low mudbrick perimeter, gaps for gates) --------------- */
  {
    const W = 250;
    const L = 240;
    const h = 2.6;
    const th = 1.1;
    // (v1.1) the 250 m south run falls ~8 m east-west: as one box its
    // west half was entirely underground. (v1.2 I3) the "gaps for gates"
    // this comment always promised — three 5 m gates in the south run — the
    // east run moved 2.5 m out (it cut through the easternmost houses), and
    // every run registered, so the figures use the gates
    const vs = L / 2 - 118;
    const gates = [-50, 10, 70];
    let u0 = -W / 2;
    const runs: { u: number; v: number; len: number; y: number; alongU: boolean }[] = [];
    for (const g of [...gates, W / 2 + 2.5]) {
      const u1 = Math.min(g - 2.5, W / 2);
      if (u1 > u0 + 1) for (const r of gwall(mud, u0, vs, u1, vs, h, th, 0.56, 0.03)) runs.push({ ...r, alongU: true });
      u0 = g + 2.5;
    }
    // side runs in ~7 m lengths: they cross the pad edges, where 14 m runs
    // grounded on their lowest corner buried 2.4 m of wall uphill
    for (const r of gwall(mud, -W / 2, -50 - (L - 108) / 2, -W / 2, -50 + (L - 108) / 2, h, th, 0.57, 0.03, 0.35, 7)) runs.push({ ...r, alongU: false });
    // the east run stops at the eastern town's terrace edge (v −48): beyond
    // it the ground falls ~4.5 m in 6 m to the plain, and the old run lay
    // buried 3.7 m deep there (unregistered, the audit never saw it) — the
    // gap is the town's east gate onto the plain
    for (const r of gwall(mud, W / 2 + 2.5, -50 - (L - 108) / 2, W / 2 + 2.5, -48, h, th, 0.55, 0.03, 0.35, 7)) runs.push({ ...r, alongU: false });
    for (const [k, r] of runs.entries()) {
      fpReg({
        id: `enclosure:${k}`, family: 'worker-town', x: wx(r.u, r.v), z: wz(r.u, r.v),
        hx: r.alongU ? r.len / 2 : th / 2, hz: r.alongU ? th / 2 : r.len / 2, y0: r.y, y1: r.y + h + 0.35, yaw: YAW,
        ground: 'grounded', editGroup: 'worker-town',
      });
    }
  }

  /* --- (v1.2 I3) canon Vol VIII: brewery, physicians, scribes, the public
   *      court and the animals; townsfolk figures in their own coloured mesh */
  {
    const folk = new ColorWriter();
    const fr = seed.rng('townsfolk'); // own stream: the town's layout stays
    townLines.length = 0;
    const reg = (id: string, u: number, v: number, hu: number, hv: number, y0: number, y1: number): void => {
      fpReg({
        id, family: 'worker-town', x: wx(u, v), z: wz(u, v), hx: hu, hz: hv, y0, y1, yaw: YAW,
        ground: 'grounded', editGroup: 'worker-town',
      });
    };
    /** world position of a town-local point, on the ground */
    const at = (u: number, v: number, dy = 0): [number, number, number] => [wx(u, v), grd(u, v) - 0.02 + dy, wz(u, v)];
    /** town-local facing angle (from +u toward +v) → world yaw */
    const yw = (a: number): number => YAW + a;
    const line = (
      u0: number, v0: number, u1: number, v1: number, n: number, spread: number, carry: number, still: number, scale = 1,
    ): void => {
      townLines.push({ x0: wx(u0, v0), z0: wz(u0, v0), x1: wx(u1, v1), z1: wz(u1, v1), n, spread, carry, still, scale });
    };
    const CHILD = 0.62;
    const JAR = 0.42;

    // BREWERY beside the bakeries (canon VIII: "Beer served as a staple
    // food"): a walled yard, a roofed shed over mash vats set in a bench,
    // fermentation jars in rows in the open half, a hearth, grain bins
    {
      const bu = 21;
      const bv = 36;
      const y = grd(bu, bv) - 0.3;
      lbox(mud, bu, y, bv - 5, 16, 2.6, 0.5, 0.52, 0.03);
      lbox(mud, bu - 8, y, bv, 0.5, 2.6, 10, 0.53, 0.03);
      lbox(mud, bu + 8, y, bv, 0.5, 2.6, 10, 0.51, 0.03);
      for (const s of [-1, 1]) lbox(mud, bu + s * 4.6, y, bv + 5, 6.8, 2.2, 0.5, 0.52, 0.03); // south front, gate in the middle
      lbox(mud, bu, y + 2.6, bv - 2.6, 16.4, 0.16, 5.4, 0.62); // shed roof
      for (const pu of [-4, 0, 4]) lbox(mud, bu + pu, y, bv + 0.1, 0.3, 2.62, 0.3, T_WOOD);
      lbox(mud, bu, y, bv - 3.7, 13, 0.55, 1.4, 0.46); // the vat bench
      for (let k = 0; k < 6; k++) {
        const u = bu - 5.5 + k * 2.2;
        mud.drum(wx(u, bv - 3.7), y + 0.3, wz(u, bv - 3.7), 0.5, 0.55, JAR, -0.25, 12); // mash vat
        mud.drum(wx(u, bv - 3.7), y + 0.82, wz(u, bv - 3.7), 0.6, 0.05, T_DARK, 0, 12); // the mash
      }
      for (let r = 0; r < 2; r++) {
        for (let k = 0; k < 7; k++) {
          const u = bu - 6 + k * 2;
          const v = bv + 1.4 + r * 1.7;
          const jy = y + 0.3;
          mud.drum(wx(u, v), jy, wz(u, v), 0.24, 0.6, JAR + fr.range(-0.04, 0.04), -0.25, 10);
          mud.drum(wx(u, v), jy + 0.6, wz(u, v), 0.39, 0.35, JAR, 0.6, 10);
          mud.drum(wx(u, v), jy + 0.95, wz(u, v), 0.2, 0.06, 0.6, 0, 10); // mud-sealed lid
        }
      }
      lbox(mud, bu - 6.7, y, bv - 0.6, 1.2, 0.65, 1.4, 0.3); // hearth
      mud.drum(wx(bu - 6.7, bv - 0.6), y + 0.65, wz(bu - 6.7, bv - 0.6), 0.36, 0.42, 0.22, -0.15, 10); // the boiling pot
      for (const dv of [-2.4, 1.6]) {
        // grain bins outside the east wall
        mud.drum(wx(bu + 9.7, bv + dv), y, wz(bu + 9.7, bv + dv), 1.05, 1.5, 0.72, 0.12, 14);
        mud.drum(wx(bu + 9.7, bv + dv), y + 1.5, wz(bu + 9.7, bv + dv), 0.85, 0.7, 0.74, 0.5, 14);
      }
      reg('brewery', bu, bv, 8.3, 5.3, y, y + 2.8);
      reg('brewery-bins', bu + 9.7, bv - 0.4, 1.2, 3.2, y, y + 2.3);
      person(folk, fr, ...at(bu - 3.3, bv - 2.5), yw(-Math.PI / 2), 'kneel'); // at a vat
      const sp = at(bu + 2.2, bv - 2.4);
      person(folk, fr, sp[0], sp[1], sp[2], yw(-Math.PI / 2), 'stand');
      folk.beam(at(bu + 2.2, bv - 2.95, 1.35), at(bu + 2.2, bv - 3.7, 0.6), 0.025, [0.4, 0.3, 0.18]); // stirring pole
      // donkeys with panniers tethered at the gate, waiting for the jars
      lbox(mud, bu + 3.4, y, bv + 6.3, 0.15, 1.2, 0.15, T_WOOD);
      donkey(folk, fr, ...at(bu + 2.4, bv + 7.4), yw(0.15), true);
      donkey(folk, fr, ...at(bu + 4.4, bv + 8.3), yw(-0.2), true);
      line(bu - 6, bv + 6.6, bu + 1, bv + 6.6, 4, 1.4, 0.75, 0.4);
    }

    // PHYSICIANS' HOUSE (canon VIII "Medical facilities"): two rooms under
    // a roof and a walled treatment court — a patient on a bed, the
    // physician kneeling beside him, an assistant with a basin, herb jars
    // on a shelf. "Medicine should appear practical rather than mystical."
    {
      const hu = 71;
      const hv = -31;
      const y = grd(hu, hv) - 0.3;
      lbox(mud, hu, y, hv - 2.5, 12, 2.8, 5, 0.55, 0.025);
      lbox(mud, hu, y + 2.8, hv - 2.5, 12.3, 0.16, 5.3, 0.63);
      door(hu - 2.5, hv, y + 0.3, 2);
      door(hu + 3, hv, y + 0.3, 2);
      lbox(mud, hu - 6, y, hv + 2.5, 0.4, 1.6, 5, 0.54);
      lbox(mud, hu + 6, y, hv + 2.5, 0.4, 1.6, 5, 0.54);
      for (const s of [-1, 1]) lbox(mud, hu + s * 3.6, y, hv + 5, 4.8, 1.6, 0.4, 0.54); // gate in the south wall
      const by = y + 0.3;
      for (const [du, dv] of [[-0.9, -0.38], [0.9, -0.38], [-0.9, 0.38], [0.9, 0.38]] as const) {
        lbox(mud, hu - 1.5 + du, by, hv + 2.4 + dv, 0.07, 0.45, 0.07, T_WOOD);
      }
      lbox(mud, hu - 1.5, by + 0.4, hv + 2.4, 2.0, 0.08, 0.9, T_WOOD); // bed frame
      folk.box(...at(hu - 1.5, hv + 2.4, 0.5), 1.9, 0.05, 0.85, [0.8, 0.77, 0.68], YAW); // linen on the frame (top 0.48)
      person(folk, fr, ...at(hu - 1.5, hv + 2.4, 0.55), yw(Math.PI), 'lie'); // the patient
      person(folk, fr, ...at(hu - 1.4, hv + 3.5), yw(-Math.PI / 2), 'kneel'); // the physician
      person(folk, fr, ...at(hu + 0.6, hv + 1.6), yw(Math.PI), 'stand'); // assistant
      folk.box(...at(hu + 0.1, hv + 1.6, 1.0), 0.32, 0.12, 0.32, [0.58, 0.42, 0.29], YAW); // basin in his hands
      lbox(mud, hu + 5.5, y, hv + 2.5, 0.5, 1.3, 3.8, 0.5); // shelf bench against the east wall
      for (let k = 0; k < 5; k++) {
        const v = hv + 1 + k * 0.75;
        mud.drum(wx(hu + 5.5, v), y + 1.3, wz(hu + 5.5, v), 0.13, 0.3, JAR, -0.15, 8); // herb jars
      }
      mud.drum(wx(hu + 2.5, hv + 3.6), y + 0.3, wz(hu + 2.5, hv + 3.6), 0.45, 0.35, JAR, -0.2, 12); // washing basin
      reg('physicians', hu, hv + 0.5, 6.3, 5.8, y, y + 3.0);
    }

    // SCRIBAL OFFICE in the RAB court (canon VIII "Scribal administration"):
    // a portico against the north wall, shelves of papyrus rolls, scribes
    // seated cross-legged with writing boards, an overseer standing
    {
      const su = 103;
      const sv = 33.2;
      const y = grd(su, sv) - 0.02;
      lbox(mud, su, y + 2.6, sv, 10.4, 0.14, 4.6, 0.62); // portico roof
      for (const pu of [-4.8, 0, 4.8]) lbox(mud, su + pu, y, sv + 2.1, 0.3, 2.6, 0.3, T_WOOD);
      lbox(mud, su, y, sv - 2.6, 9.6, 1.4, 0.45, 0.48); // shelf bench on the wall
      for (let k = 0; k < 16; k++) {
        const p = at(su - 4.4 + k * 0.58, sv - 2.6, 1.4);
        folk.box(p[0], p[1], p[2], 0.12, 0.12, 0.34, [0.8, 0.74, 0.58], YAW + Math.PI / 2 + fr.range(-0.2, 0.2)); // rolls
      }
      for (let k = 0; k < 4; k++) {
        const u = su - 3.3 + k * 2.2;
        person(folk, fr, ...at(u, sv + 0.4), yw(Math.PI / 2), 'sit');
        folk.box(...at(u, sv + 0.78, 0.52), 0.42, 0.03, 0.32, [0.62, 0.55, 0.4], YAW); // writing board
      }
      const op = at(su + 4.2, sv + 1.4);
      person(folk, fr, op[0], op[1], op[2], yw(Math.PI), 'stand');
      reg('scribes', su, sv, 5.4, 2.8, y, y + 2.8);
      line(su - 4, sv + 4.5, su + 4, sv + 4.5, 3, 1.2, 0.8, 0.5); // bringing tallies
    }

    // THE PUBLIC COURT in the eastern town (canon IV "Public gathering
    // areas"; VIII "communal courtyards"): the town's well — the first
    // water source inside the walls — benches, men at a board game under a
    // shade, women grinding at querns, children playing and carrying water
    {
      const cu = 90.5;
      const cv = -98;
      const y = grd(cu, cv);
      mud.drum(wx(cu, cv), y - 0.15, wz(cu, cv), 1.0, 0.95, 0.58, 0.02, 14);
      mud.drum(wx(cu, cv), y + 0.79, wz(cu, cv), 0.68, 0.04, T_DARK, 0, 14);
      for (let k = 0; k < 3; k++) {
        const a = 0.6 + k * 2.1;
        const ju = cu + Math.cos(a) * 1.55;
        const jv = cv + Math.sin(a) * 1.55;
        mud.drum(wx(ju, jv), y - 0.02, wz(ju, jv), 0.2, 0.55, JAR, -0.25, 9);
      }
      reg('court-well', cu, cv, 1.6, 1.6, y, y + 1.0);
      lbox(mud, cu - 8, y - 0.05, cv - 7.2, 8, 0.48, 0.7, 0.5);
      lbox(mud, cu + 9, y - 0.05, cv + 7.0, 7, 0.48, 0.7, 0.5);
      // a mat shade with two men at senet
      const gu = cu + 9;
      const gv = cv - 5;
      for (const [du, dv] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]] as const) lbox(mud, gu + du, y, gv + dv, 0.08, 2.1, 0.08, T_WOOD);
      lbox(mud, gu, y + 2.1, gv, 3.2, 0.06, 2.8, 0.66);
      person(folk, fr, ...at(gu - 0.65, gv), yw(0), 'sit');
      person(folk, fr, ...at(gu + 0.65, gv), yw(Math.PI), 'sit');
      folk.box(...at(gu, gv, 0.02), 0.55, 0.07, 0.2, [0.42, 0.31, 0.19], YAW); // the senet board
      // two women at their querns
      for (let k = 0; k < 2; k++) {
        const qu = cu - 9 + k * 1.8;
        const qv = cv + 5.2;
        lbox(mud, qu + 0.45, y - 0.02, qv, 0.7, 0.2, 0.42, 0.66);
        person(folk, fr, ...at(qu, qv), yw(0), 'kneel', 1, [0.84, 0.81, 0.73]);
      }
      // children: a ring at play, one squatting over a game in the dust
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        person(folk, fr, ...at(cu + 4 + Math.cos(a) * 1.3, cv + 4 + Math.sin(a) * 1.3), yw(a + Math.PI), 'stand', CHILD);
      }
      person(folk, fr, ...at(cu - 4, cv - 4), yw(0.6), 'squat', CHILD);
      dog(folk, fr, ...at(cu + 2.6, cv - 1.4), yw(2.2), true);
      // water carriers: children and women between the well and the lanes
      line(cu - 2.4, cv + 0.4, cu - 12, cv + 3, 3, 0.8, 0.85, 0.1, CHILD);
      line(cu + 2.4, cv - 0.4, cu + 13, cv - 2, 3, 0.8, 0.85, 0.1, CHILD);
      line(cu + 0.4, cv + 2.4, cu + 3, cv + 11, 3, 0.8, 0.9, 0.15);
    }

    // ANIMALS in the pens (canon VIII "Animal management" — "Animals should
    // never wander randomly"): goats, hair sheep, donkeys; geese by the
    // woodpiles; dogs at the gate and by the pens
    {
      const put = (
        pen: { u: number; v: number; w0: number }, n: number, sep: number,
        make: (x: number, y: number, z: number, yaw: number) => void,
      ): void => {
        const pts: [number, number][] = [];
        for (let t = 0; t < n * 30 && pts.length < n; t++) {
          const u = pen.u + fr.range(-pen.w0 / 2 + 1, pen.w0 / 2 - 1);
          const v = pen.v + fr.range(1, pen.w0 * 0.75 - 1);
          if (pts.some(([a, b]) => Math.hypot(a - u, b - v) < sep)) continue;
          pts.push([u, v]);
          make(...at(u, v), yw(fr.float() * Math.PI * 2));
        }
      };
      const [p0, p1, p2] = pens;
      if (p0) put(p0, 7, 1.0, (x, y, z, a) => goat(folk, fr, x, y, z, a));
      if (p1) {
        put(p1, 7, 1.1, (x, y, z, a) => sheep(folk, fr, x, y, z, a));
        put(p1, 2, 1.1, (x, y, z, a) => goat(folk, fr, x, y, z, a));
      }
      if (p2) {
        put(p2, 3, 2.0, (x, y, z, a) => donkey(folk, fr, x, y, z, a));
        dog(folk, fr, ...at(p2.u + p2.w0 / 2 + 0.6, p2.v + p2.w0 * 0.6), yw(Math.PI / 2), true);
      }
      for (let k = 0; k < 9; k++) {
        goose(folk, fr, ...at(-58 + fr.range(-4, 4) + (k % 3) * 1.1, 68 + fr.range(-1.6, 1.6)), yw(fr.range(-0.6, 0.6)));
      }
      dog(folk, fr, ...at(-40, -164), yw(1.4), true); // inside the Wall of the Crow gate
      const dp = at(-30, 66);
      dog(folk, fr, dp[0], dp[1], dp[2], yw(-2.4));
    }

    addTownsfolk(scene, folk, gi, 'townsfolk');
  }

  /* --- materialize ------------------------------------------------------------ */
  // mudbrick: 0.30 m courses × 0.45 m bricks (v1's 0.55×1.15 ashlar grid
  // read as blank concrete from 10 m)
  // slightly lifted base: 0.55/0.44 crushed to near-black on shaded sides
  const mudMesh = new Mesh(mud.build(), limestoneMaterial([0.6, 0.48, 0.35], gi, 0.3, 0.45));
  const stoneMesh = new Mesh(stone.build(), limestoneMaterial([0.66, 0.6, 0.48], gi, 0.6));
  for (const m of [mudMesh, stoneMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  const gy0 = grd(0, 0);
  fpReg({
    id: 'worker-town', family: 'worker-town', x: tx, z: tz,
    hx: 4, hz: 4, y0: gy0, y1: gy0 + 1, yaw: YAW,
    ground: 'none', passive: true, editable: true,
  });
  return rooms;
}
