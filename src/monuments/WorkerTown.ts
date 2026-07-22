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
import { WORKER_TOWN_CENTER } from '../world/CANON_DIMENSIONS';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';

/** town-local frame: +u east-ish, +v south-ish, rotated by YAW about center */
const YAW = -0.14; // real HeG street grid sits slightly off cardinal

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

  const grd = (u: number, v: number): number => hf.heightAtCpu(wx(u, v), wz(u, v));
  /** box in town-local coords at an EXPLICIT base y */
  const lbox = (
    w: GeoWriter, u: number, y: number, v: number,
    lu: number, h: number, lv: number, tone: number, batter = 0, yawExtra = 0,
  ): void => {
    w.box(wx(u, v), y, wz(u, v), lu, h, lv, tone, batter, YAW + yawExtra);
  };
  /** grounded box (lowest footprint corner − sink); returns base y */
  const gbox = (
    w: GeoWriter, u: number, v: number, lu: number, h: number, lv: number,
    tone: number, batter = 0, sink = 0.35,
  ): number => {
    const y =
      Math.min(
        grd(u - lu / 2, v - lv / 2), grd(u + lu / 2, v - lv / 2),
        grd(u - lu / 2, v + lv / 2), grd(u + lu / 2, v + lv / 2),
      ) - sink;
    lbox(w, u, y, v, lu, h + sink, lv, tone, batter);
    return y;
  };
  /** doorway illusion on a wall face: dark slab proud of the face by 4 cm.
   *  faces: 0=north(−v) 1=east(+u) 2=south(+v) 3=west(−u) */
  const door = (
    u: number, v: number, baseY: number, face: number, w0 = 0.95, h0 = 1.75,
  ): void => {
    const off = 0.06;
    if (face === 0) lbox(mud, u, baseY, v - off, w0, h0, 0.1, 0, 0);
    else if (face === 1) lbox(mud, u + off, baseY, v, 0.1, h0, w0, 0, 0);
    else if (face === 2) lbox(mud, u, baseY, v + off, w0, h0, 0.1, 0, 0);
    else lbox(mud, u - off, baseY, v, 0.1, h0, w0, 0, 0);
  };

  /* --- Wall of the Crow (north boundary, great gate mid-west) -------------- */
  {
    const v = -175;
    const L = 205;
    const th = 9.5;
    const h = 9;
    const gateU = -45;
    const gateHalf = 3.4;
    const runW = gateU - gateHalf - (-L / 2);
    const runE = L / 2 - (gateU + gateHalf);
    gbox(stone, -L / 2 + runW / 2, v, runW, h, th, 0.85, 0.055, 0.6);
    gbox(stone, gateU + gateHalf + runE / 2, v, runE, h, th, 0.83, 0.055, 0.6);
    // gate: massive lintel + slightly proud jambs (reveals)
    const gy = Math.min(grd(gateU, v - th / 2), grd(gateU, v + th / 2));
    stone.box(wx(gateU, v), gy + 4.6, wz(gateU, v), gateHalf * 2 + 2.4, 1.7, th, 0.8, 0, YAW);
    for (const s of [-1, 1]) {
      lbox(stone, gateU + s * (gateHalf + 0.35), gy - 0.3, v, 0.7, 4.9, th + 0.5, 0.78, 0.01);
    }
    fpReg({
      id: 'wall-of-crow', family: 'worker-town', x: wx(0, v), z: wz(0, v),
      hx: L / 2, hz: th / 2, y0: gy - 0.6, y1: gy + h, yaw: YAW,
      ground: 'grounded', editGroup: 'worker-town',
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
    for (let gu = 0; gu < 7; gu++) {
      for (let gv = 0; gv < 9; gv++) {
        if (t.chance(0.22)) continue; // courtyards / lanes
        const u = 62 + gu * 9.5 + t.range(-1.6, 1.6);
        const v = -128 + gv * 8.5 + t.range(-1.4, 1.4);
        const lu = t.range(5.2, 8.4);
        const lv = t.range(4.6, 7.6);
        const h = t.range(2.2, 3.4);
        const wt = 0.52 + t.range(-0.07, 0.07);
        const y = gbox(mud, u, v, lu, h, lv, wt, 0.025);
        // roof slab with a slight overhang, lighter plaster tone
        lbox(mud, u, y + h + 0.32, v, lu + 0.3, 0.16, lv + 0.3, 0.64 + t.range(-0.05, 0.05));
        // doorway toward a lane (random face), sometimes with wood lintel
        const face = t.int(4);
        door(
          face === 0 ? u : face === 1 ? u + lu / 2 : face === 2 ? u : u - lu / 2,
          face === 0 ? v - lv / 2 : face === 2 ? v + lv / 2 : v,
          y + 0.3, face,
        );
        // rooftop parapet on half the houses
        if (t.chance(0.5)) {
          lbox(mud, u, y + h + 0.44, v - lv / 2 + 0.12, lu + 0.3, 0.34, 0.22, wt);
          lbox(mud, u, y + h + 0.44, v + lv / 2 - 0.12, lu + 0.3, 0.34, 0.22, wt);
        }
        // external stair to the roof on a third
        if (t.chance(0.33)) {
          const su = u + lu / 2 + 0.55;
          const steps = 5;
          for (let s = 0; s < steps; s++) {
            lbox(
              mud, su, y + (s * h) / steps, v - lv / 2 + 0.9 + s * (lv - 1.8) / steps,
              1.05, h / steps + 0.12, (lv - 1.8) / steps + 0.25, wt + 0.04,
            );
          }
        }
        // rooftop jars / clutter
        if (t.chance(0.4)) {
          for (let j = 0; j < t.int(3) + 1; j++) {
            lbox(
              mud, u + t.range(-lu / 3, lu / 3), y + h + 0.4, v + t.range(-lv / 3, lv / 3),
              0.34, t.range(0.4, 0.6), 0.34, 0.42, 0.05, t.float(),
            );
          }
        }
        // courtyard wing on some: low L-wall
        if (t.chance(0.35)) {
          const cw = t.range(3, 4.6);
          lbox(mud, u - lu / 2 - cw / 2, y, v + lv / 2 - 0.15, cw, 1.25, 0.3, wt);
          lbox(mud, u - lu / 2 - cw + 0.15, y, v + lv / 2 - cw / 2, 0.3, 1.25, cw, wt);
        }
        rooms++;
      }
    }
    const gy = grd(90, -92);
    fpReg({
      id: 'east-town', family: 'worker-town', x: wx(90, -92), z: wz(90, -92),
      hx: 42, hz: 46, y0: gy - 0.6, y1: gy + 3.8, yaw: YAW,
      ground: 'grounded', editGroup: 'worker-town',
    });
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
      rooms++;
    }
    const gy = grd(-45, 38);
    fpReg({
      id: 'bakeries', family: 'worker-town', x: wx(-45, 38), z: wz(-45, 38),
      hx: 58, hz: 12, y0: gy - 0.6, y1: gy + 2.8, yaw: YAW,
      ground: 'grounded', editGroup: 'worker-town',
    });
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
        lbox(mud, su, ty, sv, d, th2, d, 0.74 + t.range(-0.03, 0.03), 0.12);
        lbox(mud, su, ty, sv, d, th2, d, 0.74 + t.range(-0.03, 0.03), 0.12, Math.PI / 4);
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
    }
    for (let wp = 0; wp < 5; wp++) {
      const u = -70 + wp * 9 + t.range(-2, 2);
      const v = 62 + t.range(-2, 2);
      const y = grd(u, v) - 0.1;
      for (let k = 0; k < 3; k++) {
        lbox(mud, u, y + k * 0.24, v, t.range(1.6, 2.4), 0.22, 0.6 - k * 0.12, T_WOOD, 0, t.range(-0.1, 0.1));
      }
    }
  }

  /* --- enclosure wall (low mudbrick perimeter, gaps for gates) --------------- */
  {
    const W = 250;
    const L = 240;
    const h = 2.6;
    const th = 1.1;
    gbox(mud, 0, L / 2 - 118, W, h, th, 0.56, 0.03);
    gbox(mud, -W / 2, -50, th, h, L - 108, 0.57, 0.03);
    gbox(mud, W / 2, -50, th, h, L - 108, 0.55, 0.03);
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
