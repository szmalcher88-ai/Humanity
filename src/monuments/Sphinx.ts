/**
 * The Great Sphinx (T2-2) — KHAFRE_PERIOD on only (D-19). Canon VII: carved
 * "from the original limestone ridge"; the body is the bedrock left standing
 * in its quarried enclosure (the terrain does that: GizaControl, under the
 * epoch), and this is what was carved free of it — the head in its nemes,
 * the chest, the forepaws. Facing due east (Lehner, B). No beard: the
 * braided divine beard is a New Kingdom addition. No paint by default.
 * PROVISIONAL HEIGHT: the enclosure is cut into the current ground, which
 * stands ~40 m above the real site (D-20) — re-siteable when that is decided.
 * Plan: docs/plans/T2_PLAN.md §3.3.
 */

import { Mesh, type Object3D } from 'three';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { fpReg } from '../debug/Footprints';
import { SPHINX_CENTER, SPHINX_FLOOR_Y } from '../world/CANON_DIMENSIONS';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';

const FAMILY = 'sphinx';
const EVIDENCE = {
  conf: 'D' as const,
  basis: "form after Lehner's survey (B); the enclosure depth provisional — the plateau stands ~40 m too high here (D-20)",
  epoch: 'khafre',
};

export function buildSphinx(scene: Object3D, gi: ProbeGI | null): number {
  const sx = SPHINX_CENTER.x;
  const sz = SPHINX_CENTER.z;
  const F = SPHINX_FLOOR_Y.value;
  const rock = new GeoWriter();
  /** a box in the Sphinx's own frame: u forward (east), v across (south) */
  const b = (u0: number, u1: number, v: number, w: number, y0: number, y1: number, tone: number, batter = 0): void =>
    rock.box(sx + (u0 + u1) / 2, F + y0, sz + v, u1 - u0, y1 - y0, w, tone, batter);

  // chest and neck, carved free of the body's front
  b(29.5, 36, 0, 10, -0.3, 9, 0.88, 0.05);
  b(30, 34, 0, 6.2, 9, 13.2, 0.94, 0.02);
  // the nemes: the headcloth narrowing upward, its crown, the forehead band
  b(27.5, 33.6, 0, 8.6, 12, 19.4, 1.0, 0.17);
  b(28.2, 33, 0, 5.4, 19.3, 19.8, 1.02, 0.25);
  b(33.4, 33.8, 0, 4.7, 18.2, 18.7, 1.08);
  // its lappets falling to the chest, striped
  for (const v of [-3.05, 3.05]) {
    for (let k = 0; k < 12; k++) b(33.6, 34.4, v, 1.3, 9.6 + k * 0.5, 10.1 + k * 0.5, k % 2 ? 0.9 : 1.1);
  }
  // the face: modest, idealised (canon VII)
  b(33, 34.6, 0, 4.1, 13.6, 18.3, 1.04, 0.01);
  b(34.5, 35, 0, 3.8, 17.35, 17.8, 1.06); // the brow
  for (const v of [-0.95, 0.95]) b(34.54, 34.66, v, 0.9, 16.8, 17.25, 0.32); // the eyes
  b(34.6, 35.3, 0, 0.55, 15.6, 16.95, 1.05); // the nose
  b(34.58, 34.68, 0, 1.5, 15.0, 15.2, 0.4); // the mouth
  b(34.2, 34.9, 0, 2.2, 13.6, 14.5, 1.02); // the chin
  for (const v of [-2.35, 2.35]) b(32.6, 33.4, v, 0.3, 15.8, 17.2, 0.98); // the ears
  b(34.5, 34.9, 0, 0.35, 18.4, 19.4, 1.1); // the uraeus
  // the forepaws reaching east, the toes, the chest between them
  for (const v of [-3.8, 3.8]) {
    b(34, 48.6, v, 2.6, -0.3, 2.2, 0.86, 0.06);
    b(48.4, 49.6, v, 2.4, -0.3, 1.8, 0.88, 0.12);
    for (let k = 0; k < 4; k++) b(49.5, 50.2, v - 0.9 + k * 0.6, 0.5, -0.3, 1.1, 0.84, 0.1);
  }
  const reg = (id: string, u0: number, u1: number, hz: number, y0: number, y1: number, ground: 'none' | 'grounded'): void =>
    fpReg({
      id, family: FAMILY, x: sx + (u0 + u1) / 2, z: sz, hx: (u1 - u0) / 2, hz,
      y0: F + y0, y1: F + y1, ground, ...EVIDENCE,
    });
  reg('sphinx:body', -36.5, 29.5, 9.5, 0, 12.5, 'none');
  reg('sphinx:head', 27.5, 35.3, 4.3, 9, 19.8, 'none');
  reg('sphinx:chest', 29.5, 36, 5, -0.3, 9, 'none'); // carved from the body: its rock stands in the chest's footprint
  reg('sphinx:paws', 34, 50.2, 5.1, -0.3, 2.2, 'grounded');

  // the carved bedrock: no joints — it is one stone
  const m = new Mesh(rock.build(), limestoneMaterial([0.8, 0.72, 0.57], gi, 50, 50, { rough: 0.85 }));
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = 'sphinx';
  scene.add(m);
  return 1;
}
