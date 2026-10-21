/**
 * MenkaureComplex (T2-5) — Menkaure's works, MENKAURE_PERIOD on only (D-19,
 * D-23): the court of G3 paved in INDIVIDUAL slabs (Pillar A) and its
 * temenos at Khufu's offsets, with a doorway on the east axis for the later
 * mortuary temple (T2-6: the temples, the causeway, the three queens).
 * The pyramid itself is `Monuments.ts` ('G3'); its platform is the
 * terrain's (GizaControl, under the epoch). A copy of KhafreComplex's first
 * block on its own streams — sharing that code would risk the KHAFRE world's
 * float order. Plan: docs/plans/T2-5_PLAN.md §4.5.
 */

import { Mesh, type Object3D } from 'three';
import type { Rng, WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { fpReg } from '../debug/Footprints';
import {
  G1_TEMENOS_HEIGHT,
  G3_BASE_SIDE,
  G3_CENTER,
  G3_PAD_Y,
  G3_TEMENOS_OFFSET,
} from '../world/CANON_DIMENSIONS';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';

const EPOCH = 'menkaure';

export function buildMenkaureComplex(scene: Object3D, seed: WorldSeed, gi: ProbeGI | null): { slabs: number } {
  const cx = G3_CENTER.x;
  const cz = G3_CENTER.z;
  const Y = G3_PAD_Y.value;
  const half = G3_BASE_SIDE.value / 2; // 51.7
  const r = half + G3_TEMENOS_OFFSET.value; // the wall's centreline, 71.9

  const tura = new GeoWriter(); // fine limestone: the court's slabs
  const local = new GeoWriter(); // local limestone: the temenos

  /* --- the court: individual slabs between the base and the wall --------- */
  let slabs = 0;
  {
    const t: Rng = seed.rng('menkaure-pavement');
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
    fpReg({
      id: 'menkaure:court', family: 'menkaure-pavement', x: cx, z: cz, hx: r, hz: r,
      y0: Y, y1: Y + 0.16, ground: 'none', passive: true,
      conf: 'D', basis: "a paved court as Khufu's; the width at Khufu's offsets", epoch: EPOCH,
    });
  }

  /* --- the temenos: Khufu's wall rule, a doorway on the east axis ---------- */
  {
    const h = G1_TEMENOS_HEIGHT.value;
    const th = 3.0;
    local.box(cx + 0.02, Y, cz - r, 2 * r + th - 0.04, h, th, 0.98, 0.06, 0, 0.06); // north
    local.box(cx + 0.02, Y, cz + r, 2 * r + th - 0.04, h, th, 0.97, 0.06, 0, 0.06); // south
    local.box(cx - r, Y, cz, th, h, 2 * r + th, 0.99, 0.06, 0, 0.06); // west
    // the east wall in two runs either side of a doorway on the axis — the
    // temple step (T2-6) widens it to the temple's flanks, as Khafre's
    const gateHalf = 3;
    const run = r - gateHalf;
    local.box(cx + r, Y, cz - (gateHalf + run / 2), th, h, run, 0.98, 0.06);
    local.box(cx + r, Y, cz + gateHalf + run / 2, th, h, run, 0.98, 0.06);
    const wall = (id: string, x: number, z: number, hx: number, hz: number): void =>
      fpReg({
        id: `menkaure:temenos:${id}`, family: 'menkaure-temenos', x: cx + x, z: cz + z, hx, hz,
        y0: Y, y1: Y + h, ground: 'platform', allow: ['menkaure-pavement'],
        conf: 'D', basis: "a wall at Khufu's offsets and height (D-3); no survey in the repo", epoch: EPOCH,
      });
    wall('north', 0, -r, r + th / 2, th / 2);
    wall('south', 0, r, r + th / 2, th / 2);
    wall('west', -r, 0, th / 2, r + th / 2);
    wall('east-n', r, -(gateHalf + run / 2), th / 2, run / 2);
    wall('east-s', r, gateHalf + run / 2, th / 2, run / 2);
  }

  /* --- materialize (Khufu's two limestones) -------------------------------- */
  const turaMesh = new Mesh(tura.build(), limestoneMaterial([0.85, 0.825, 0.77], gi, 0.5));
  const localMesh = new Mesh(local.build(), limestoneMaterial([0.74, 0.68, 0.57], gi, 0.55));
  turaMesh.name = 'menkaure-court';
  localMesh.name = 'menkaure-temenos';
  for (const m of [turaMesh, localMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  return { slabs };
}
