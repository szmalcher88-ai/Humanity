/**
 * Monuments — assembles the Tier-1 pyramid ensemble from CANON dimensions:
 * the Great Pyramid, the three queens' pyramids (G1-a/b/c), and the
 * satellite pyramid (G1-d). Every dimension flows from CANON_DIMENSIONS
 * through PyramidSpec; heights are DERIVED from base × slope so the specs
 * stay internally consistent (the audit enforces it).
 */

import type { Scene, Vector3 } from 'three';
import type { WorldSeed } from '../core/Seed';
import {
  G1_BASE_SIDE,
  G1_COURSE1_HEIGHT,
  G1_COURSE_COUNT,
  G1_COURSE_MIN_HEIGHT,
  G1_SLOPE_DEG,
  G1D_BASE_SIDE,
  G1D_CENTER,
  G1D_SLOPE_DEG,
  QUEENS_BASE_SIDE,
  QUEENS_CENTERS,
  QUEENS_SLOPE_DEG,
} from '../world/CANON_DIMENSIONS';
import { buildPyramid, type PyramidLod } from './PyramidBuilder';
import { buildSpec, type PyramidSpec } from './PyramidSpec';

export interface MonumentSite {
  name: string;
  spec: PyramidSpec;
  lod: PyramidLod;
}

function heightFromSlope(baseSide: number, slopeDeg: number): number {
  return (baseSide / 2) * Math.tan((slopeDeg * Math.PI) / 180);
}

export function buildMonuments(scene: Scene, seed: WorldSeed): MonumentSite[] {
  const sites: MonumentSite[] = [];

  const add = (
    name: string,
    baseSide: number,
    slopeDeg: number,
    cx: number,
    cy: number,
    cz: number,
    courseCount: number,
    course1: number,
    courseMin: number,
  ): void => {
    const spec = buildSpec({
      baseSide,
      height: heightFromSlope(baseSide, slopeDeg),
      slopeDeg,
      cx,
      cy,
      cz,
      courseCount,
      course1,
      courseMin,
      rng: seed.rng(`monument-${name}`),
    });
    const lod = buildPyramid(spec);
    scene.add(lod.near);
    scene.add(lod.far);
    sites.push({ name, spec, lod });
  };

  // Akhet Khufu — platform leveled at world Y = 0
  add(
    'G1',
    G1_BASE_SIDE.value,
    G1_SLOPE_DEG.value,
    0, 0, 0,
    G1_COURSE_COUNT.value,
    G1_COURSE1_HEIGHT.value,
    G1_COURSE_MIN_HEIGHT.value,
  );

  // queens' row terrace at −1.2 (GizaControl qPad)
  const qNames = ['G1-a', 'G1-b', 'G1-c'];
  QUEENS_CENTERS.forEach((c, i) => {
    add(
      qNames[i] ?? `G1-q${i}`,
      QUEENS_BASE_SIDE.value,
      QUEENS_SLOPE_DEG.value,
      c.x, -1.2, c.z,
      46, 0.95, 0.5,
    );
  });

  // satellite pyramid on the G1 platform
  add(
    'G1-d',
    G1D_BASE_SIDE.value,
    G1D_SLOPE_DEG.value,
    G1D_CENTER.x, 0, G1D_CENTER.z,
    24, 0.75, 0.42,
  );

  return sites;
}

export function updateMonumentLods(sites: MonumentSite[], camPos: Vector3): void {
  for (const s of sites) s.lod.update(camPos);
}
