/**
 * Monuments — assembles the Tier-1 pyramid ensemble from CANON dimensions:
 * the Great Pyramid, the three queens' pyramids (G1-a/b/c), and the
 * satellite pyramid (G1-d). Every dimension flows from CANON_DIMENSIONS
 * through PyramidSpec; heights are DERIVED from base × slope so the specs
 * stay internally consistent (the audit enforces it).
 */

import type { Object3D, Vector3 } from 'three';
import type { WorldSeed } from '../core/Seed';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { edPos } from '../debug/EditOverrides';
import { fpReg } from '../debug/Footprints';
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
  G2_BASE_SIDE,
  G2_CENTER,
  G2_COURSE_COUNT,
  G2_GRANITE_COURSES,
  G2_PAD_Y,
  G2_SLOPE_DEG,
  G3_BASE_SIDE,
  G3_CENTER,
  G3_COURSE_COUNT,
  G3_GRANITE_COURSES,
  G3_PAD_Y,
  G3_SLOPE_DEG,
  G3A_SLOPE_DEG,
  MENKAURE_QUEENS,
} from '../world/CANON_DIMENSIONS';
import { atLeast, DEFAULT_EPOCH, type Epoch } from '../world/Epoch';
import type { Confidence } from '../world/CANON_DIMENSIONS';
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

export function buildMonuments(
  scene: Object3D,
  seed: WorldSeed,
  gi: ProbeGI | null = null,
  epoch: Epoch = DEFAULT_EPOCH,
): MonumentSite[] {
  const sites: MonumentSite[] = [];

  const add = (
    name: string,
    baseSide: number,
    slopeDeg: number,
    cx0: number,
    cy: number,
    cz0: number,
    courseCount: number,
    course1: number,
    courseMin: number,
    graniteCourses = 0,
    evidence?: { conf: Confidence; basis: string; epoch: string },
    shadowLod?: number,
    graniteUndressed = false,
  ): void => {
    const [cx, cz] = edPos(`pyramid:${name}`, cx0, cz0);
    const H = heightFromSlope(baseSide, slopeDeg);
    const spec = buildSpec({
      baseSide,
      height: H,
      slopeDeg,
      cx,
      cy,
      cz,
      courseCount,
      course1,
      courseMin,
      graniteCourses,
      ...(shadowLod !== undefined ? { shadowLod } : {}),
      ...(graniteUndressed ? { graniteUndressed } : {}),
      rng: seed.rng(`monument-${name}`),
    });
    const lod = buildPyramid(spec, gi);
    scene.add(lod.near);
    scene.add(lod.far);
    sites.push({ name, spec, lod });
    fpReg({
      id: `pyramid:${name}`,
      family: 'pyramids',
      x: cx,
      z: cz,
      hx: baseSide / 2,
      hz: baseSide / 2,
      y0: cy,
      y1: cy + H,
      ground: 'platform',
      editable: name !== 'G1', // the world origin stays put
      ...evidence,
    });
    if (evidence) {
      lod.near.name = `pyramid-${name}`;
      lod.far.name = `pyramid-${name}`;
    }
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

  // (T2-3) Khafre's pyramid, KHAFRE_PERIOD on — LAST, on its own stream, so
  // nothing before it moves; on the terrain's levelled platform (G2_PAD_Y).
  // `?g2=0` skips it (the pad stays): the perf A/B switch — `?hide=` cannot
  // isolate a pyramid, the LOD switch rewrites `near.visible` every frame
  if (atLeast(epoch, 'KHAFRE_PERIOD') && new URLSearchParams(window.location.search).get('g2') !== '0') {
    add(
      'G2',
      G2_BASE_SIDE.value,
      G2_SLOPE_DEG.value,
      G2_CENTER.x, G2_PAD_Y.value, G2_CENTER.z,
      G2_COURSE_COUNT.value,
      G1_COURSE1_HEIGHT.value,
      G1_COURSE_MIN_HEIGHT.value,
      G2_GRANITE_COURSES.value,
      {
        conf: 'C',
        basis: "Petrie's base and the 5¼-palm seked (B); the course count an estimate, the platform level an outside figure, the site the authored knoll (D-21)",
        epoch: 'khafre',
      },
      300, // the shadow LOD (perf A/B, T2-3 §3.5): the far shell casts beyond 300 m
    );
  }

  // (T2-5) Menkaure's pyramid, MENKAURE_PERIOD on — LAST, on its own stream;
  // its sixteen granite courses left undressed. `?g3=0` skips it (the pad
  // stays): the perf A/B switch, as `?g2=0`
  if (atLeast(epoch, 'MENKAURE_PERIOD') && new URLSearchParams(window.location.search).get('g3') !== '0') {
    add(
      'G3',
      G3_BASE_SIDE.value,
      G3_SLOPE_DEG.value,
      G3_CENTER.x, G3_PAD_Y.value, G3_CENTER.z,
      G3_COURSE_COUNT.value,
      G1_COURSE1_HEIGHT.value,
      G1_COURSE_MIN_HEIGHT.value,
      G3_GRANITE_COURSES.value,
      {
        conf: 'D',
        basis: 'the published base and slope (C); the course count an estimate, the site moved 53 m north off the Main Wadi (D-23)',
        epoch: 'menkaure',
      },
      300,
      true,
    );
  }

  // (T2-6) Menkaure's east queen, G3-a, the one FINISHED queen (the two
  // western are stepped cores, MenkaureComplex): a true pyramid on its own
  // terrace and stream, LAST; skipped with the other works by `?mworks=0`
  const qa = MENKAURE_QUEENS[0];
  if (qa && atLeast(epoch, 'MENKAURE_PERIOD') && new URLSearchParams(window.location.search).get('mworks') !== '0') {
    add(
      qa.name,
      qa.base,
      G3A_SLOPE_DEG.value,
      qa.x, qa.level, qa.z,
      44, 0.95, 0.5, // Khufu's queens' course parameters
      0,
      {
        conf: 'D',
        basis: 'a true pyramid (C: Reisner); its base, row and terrace reconstructed (D-24)',
        epoch: 'menkaure',
      },
    );
  }

  return sites;
}

export function updateMonumentLods(sites: MonumentSite[], camPos: Vector3): void {
  for (const s of sites) s.lod.update(camPos);
}
