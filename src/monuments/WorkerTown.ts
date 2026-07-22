/**
 * Heit el-Ghurab — the workers' town SE of the plateau (Phase 6, canon
 * Vol. VIII; DEVIATIONS D-6: shown as the Khufu-era settlement per AERA's
 * dating of the exposed layout):
 *
 *   WALL OF THE CROW — cyclopean stone wall with its great gate, the
 *     town's north boundary toward the plateau
 *   GALLERY COMPLEX — four blocks of long parallel barrack galleries
 *     (sleeping platforms for rotating labor gangs), streets between
 *   EASTERN TOWN — irregular packed domestic rooms (jittered grid)
 *   BAKERY ROWS — small production rooms with hearth blocks (south)
 *   ENCLOSURE — low mudbrick perimeter, gated toward the plain
 *
 * Mudbrick massing via GeoWriter, mud-toned course material (0.32 m
 * courses read as brick, not ashlar). Every building grounded on its
 * lowest footprint corner; whole town is one editable placement
 * ('worker-town') and registers footprints for the collision gate.
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
  /** grounded box in town-local coords (lowest corner − sink) */
  const gbox = (
    w: GeoWriter, u: number, v: number, lu: number, h: number, lv: number,
    tone: number, batter = 0, sink = 0.35,
  ): number => {
    const y =
      Math.min(
        grd(u - lu / 2, v - lv / 2), grd(u + lu / 2, v - lv / 2),
        grd(u - lu / 2, v + lv / 2), grd(u + lu / 2, v + lv / 2),
      ) - sink;
    w.box(wx(u, v), y, wz(u, v), lu, h + sink, lv, tone, batter, YAW);
    return y;
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
    // massive gate lintel
    const lintelY = Math.min(grd(gateU, v - th / 2), grd(gateU, v + th / 2)) + 4.6;
    stone.box(wx(gateU, v), lintelY, wz(gateU, v), gateHalf * 2 + 2.4, 1.7, th, 0.8, 0, YAW);
    const gy = grd(0, v);
    fpReg({
      id: 'wall-of-crow', family: 'worker-town', x: wx(0, v), z: wz(0, v),
      hx: L / 2, hz: th / 2, y0: gy - 0.6, y1: gy + h, yaw: YAW,
      ground: 'grounded', editGroup: 'worker-town',
    });
  }

  /* --- gallery complex: 4 blocks of parallel barrack galleries -------------- */
  // each block: outer wall, internal gallery walls every ~4.7 m, roof slab
  const blockW = 78; // E-W
  const blockL = 36; // N-S (gallery length)
  const galleryPitch = 4.7;
  const wallH = 2.9;
  for (let b = 0; b < 4; b++) {
    const bu = -78 + (b % 2) * (blockW + 10);
    const bv = -118 + Math.floor(b / 2) * (blockL + 9);
    const t = 0.55 + rng.range(-0.02, 0.02);
    // long N/S outer walls + internal gallery partitions
    const nGal = Math.floor(blockW / galleryPitch);
    for (let g = 0; g <= nGal; g++) {
      const gu = bu - blockW / 2 + g * galleryPitch;
      gbox(mud, gu, bv, 0.55, wallH, blockL, t + rng.range(-0.04, 0.04), 0.02);
    }
    // end walls (with door gaps toward the north street)
    gbox(mud, bu, bv + blockL / 2, blockW, wallH, 0.6, t, 0.02);
    gbox(mud, bu, bv - blockL / 2 + 0.3, blockW, 1.1, 0.6, t, 0.02);
    // roof slab (galleries were roofed — reads as a low mass from above)
    const roofY =
      Math.min(grd(bu - blockW / 2, bv), grd(bu + blockW / 2, bv), grd(bu, bv)) +
      wallH - 0.1;
    mud.box(wx(bu, bv), roofY, wz(bu, bv), blockW + 0.8, 0.22, blockL + 0.8, 0.5, 0, YAW);
    rooms += nGal;
    fpReg({
      id: `galleries:${b}`, family: 'worker-town', x: wx(bu, bv), z: wz(bu, bv),
      hx: blockW / 2 + 0.5, hz: blockL / 2 + 0.5,
      y0: roofY - wallH - 0.5, y1: roofY + 0.25,
      yaw: YAW, ground: 'grounded', editGroup: 'worker-town',
    });
  }

  /* --- eastern town: packed domestic rooms (jittered, organic) -------------- */
  {
    const t = rng.fork('east-town');
    for (let gu = 0; gu < 7; gu++) {
      for (let gv = 0; gv < 9; gv++) {
        if (t.chance(0.22)) continue; // courtyards / lanes
        const u = 62 + gu * 9.5 + t.range(-1.6, 1.6);
        const v = -128 + gv * 8.5 + t.range(-1.4, 1.4);
        const lu = t.range(5.2, 8.4);
        const lv = t.range(4.6, 7.6);
        const h = t.range(2.3, 3.1);
        gbox(mud, u, v, lu, h, lv, 0.52 + t.range(-0.06, 0.06), 0.025);
        // inner cross wall on the larger rooms
        if (lu > 6.8 && t.chance(0.6)) {
          gbox(mud, u + t.range(-1, 1), v, 0.5, h - 0.4, lv - 1.2, 0.5, 0.02);
        }
        rooms++;
      }
    }
    const gy = grd(90, -92);
    fpReg({
      id: 'east-town', family: 'worker-town', x: wx(90, -92), z: wz(90, -92),
      hx: 40, hz: 45, y0: gy - 0.6, y1: gy + 3.2, yaw: YAW,
      ground: 'grounded', editGroup: 'worker-town',
    });
  }

  /* --- bakery rows (south): small rooms + hearth blocks ---------------------- */
  {
    const t = rng.fork('bakeries');
    for (let i = 0; i < 9; i++) {
      const u = -95 + i * 11.5 + t.range(-0.8, 0.8);
      const v = 32 + (i % 2) * 9 + t.range(-0.8, 0.8);
      const h = t.range(2.1, 2.6);
      gbox(mud, u, v, 7.4, h, 6.2, 0.48 + t.range(-0.04, 0.04), 0.025);
      // hearth / vat emplacements against the south wall
      gbox(mud, u + t.range(-1.6, 1.6), v + 2.2, 1.4, 0.9, 1.2, 0.34, 0);
      rooms++;
    }
    const gy = grd(-45, 38);
    fpReg({
      id: 'bakeries', family: 'worker-town', x: wx(-45, 38), z: wz(-45, 38),
      hx: 58, hz: 12, y0: gy - 0.6, y1: gy + 2.8, yaw: YAW,
      ground: 'grounded', editGroup: 'worker-town',
    });
  }

  /* --- enclosure wall (low mudbrick perimeter, gaps for gates) --------------- */
  {
    const W = 250;
    const L = 240;
    const h = 2.6;
    const th = 1.1;
    // south + east + west runs (north is the Wall of the Crow)
    gbox(mud, 0, L / 2 - 118, W, h, th, 0.56, 0.03);
    gbox(mud, -W / 2, -50, th, h, L - 108, 0.57, 0.03);
    gbox(mud, W / 2, -50, th, h, L - 108, 0.55, 0.03);
  }

  /* --- materialize ------------------------------------------------------------ */
  // mudbrick: warm mud tone, small 0.32 m courses (brick, not ashlar)
  const mudMesh = new Mesh(mud.build(), limestoneMaterial([0.55, 0.44, 0.31], gi, 0.32));
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
