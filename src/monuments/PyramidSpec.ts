/**
 * PyramidSpec — pure geometry of a cased true pyramid (no three.js):
 * course solver + casing-stone layout. One spec drives BOTH the rendered
 * geometry and the machine audits (brief: one source of truth).
 *
 * Course heights follow Petrie's documented profile morphology: tallest
 * first course, decaying upward, with periodic "surges" where a fresh
 * quarry lift resets the thickness (sawtooth) — see CANON G1_COURSE_*.
 */

import { Rng } from '../core/Seed';

export interface PyramidParams {
  /** base side length (m) */
  baseSide: number;
  /** total original height (m) */
  height: number;
  /** face slope from horizontal (deg) */
  slopeDeg: number;
  /** world position of the base-center */
  cx: number;
  cy: number;
  cz: number;
  /** target course count (scaled for queens/satellite) */
  courseCount: number;
  /** first-course height (m) */
  course1: number;
  /** minimum course height (m) */
  courseMin: number;
  /** micro-variation stream */
  rng: Rng;
}

export interface CourseRow {
  /** course base height above pyramid base (m) */
  y0: number;
  /** vertical course height (m) */
  h: number;
  /** face half-width at course mid-height (m) */
  halfMid: number;
}

export interface CasingStone {
  /** face index: 0=N 1=E 2=S 3=W */
  face: number;
  /** distance along the face from its left corner, at stone center (m) */
  s: number;
  /** course base y and vertical height */
  y0: number;
  h: number;
  /** stone width along the face (m) */
  w: number;
  /** per-stone jitters: tone, roughness, tiltU, tiltV (radians) */
  tone: number;
  rough: number;
  tiltU: number;
  tiltV: number;
}

export interface PyramidSpec {
  params: PyramidParams;
  courses: CourseRow[];
  stones: CasingStone[];
  /** derived exacts for the audit */
  derived: {
    apexY: number;
    halfBase: number;
    slopeTan: number;
    stoneCount: number;
  };
}

/** generate the sawtooth course profile, normalized to sum EXACTLY to height */
export function solveCourses(p: PyramidParams): CourseRow[] {
  const hs: number[] = [];
  const rng = p.rng.fork('courses');
  let current = p.course1;
  for (let c = 0; c < p.courseCount; c++) {
    hs.push(current);
    // exponential decay toward the minimum…
    const decayed = p.courseMin + (current - p.courseMin) * 0.955;
    current = decayed * rng.range(0.97, 1.03);
    // …with surges when thin: a fresh quarry lift resets thickness
    if (current < p.courseMin * 1.18 && rng.chance(0.16)) {
      current = p.courseMin + (p.course1 - p.courseMin) * rng.range(0.35, 0.62);
    }
    current = Math.max(p.courseMin * 0.92, current);
  }
  const sum = hs.reduce((a, b) => a + b, 0);
  const k = p.height / sum;
  const halfBase = p.baseSide / 2;
  const rows: CourseRow[] = [];
  let y = 0;
  for (const h0 of hs) {
    const h = h0 * k;
    const yMid = y + h / 2;
    rows.push({ y0: y, h, halfMid: halfBase * (1 - yMid / p.height) });
    y += h;
  }
  return rows;
}

/** lay casing stones along every course of every face */
export function layCasing(p: PyramidParams, courses: CourseRow[]): CasingStone[] {
  const rng = p.rng.fork('casing');
  const stones: CasingStone[] = [];
  for (let ci = 0; ci < courses.length; ci++) {
    const row = courses[ci] as CourseRow;
    const faceW = row.halfMid * 2;
    if (faceW < 0.55) break; // apex region: the pyramidion caps it
    // stone width scales down with height (big blocks low, small high)
    const frac = row.y0 / p.height;
    const wAvg = Math.max(0.7, 2.3 - 1.55 * frac);
    const n = Math.max(1, Math.round(faceW / wAvg));
    for (let face = 0; face < 4; face++) {
      // per-face rng fork keeps faces decorrelated but stable
      const fr = rng.fork(`f${face}c${ci}`);
      // jittered widths normalized to fill the course exactly (corner
      // stones were precision-cut — faces close without gaps)
      const raw: number[] = [];
      for (let i = 0; i < n; i++) raw.push(fr.range(0.75, 1.25));
      const rawSum = raw.reduce((a, b) => a + b, 0);
      let s = 0;
      for (let i = 0; i < n; i++) {
        const w = ((raw[i] as number) / rawSum) * faceW;
        const sc = s + w / 2;
        // Hand-finished planarity: the casing was dressed IN PLACE after
        // laying, so the error field is a SMOOTH undulation across the
        // whole face (waves 15-40 m) with only a whisper of per-stone
        // residual. Independent per-stone tilts (first cut) faceted the
        // face — grazing views magnified 4 mm edge offsets into fake
        // 15 cm reveals and distance views read popcorn noise.
        const ph = face * 11.7;
        const wave = (a: number, b: number): number =>
          Math.sin(sc / a + row.y0 / b + ph) * Math.cos(sc / (b * 1.7) - row.y0 / a + ph * 0.7);
        stones.push({
          face,
          s: sc,
          y0: row.y0,
          h: row.h,
          w,
          tone: fr.range(0.97, 1.015),
          rough: fr.range(-0.04, 0.05),
          tiltU: 0.0035 * wave(17, 29) + fr.range(-0.0006, 0.0006),
          tiltV: 0.003 * wave(23, 13) + fr.range(-0.0006, 0.0006),
        });
        s += w;
      }
    }
  }
  return stones;
}

export function buildSpec(p: PyramidParams): PyramidSpec {
  const courses = solveCourses(p);
  const stones = layCasing(p, courses);
  return {
    params: p,
    courses,
    stones,
    derived: {
      apexY: p.cy + p.height,
      halfBase: p.baseSide / 2,
      slopeTan: Math.tan((p.slopeDeg * Math.PI) / 180),
      stoneCount: stones.length,
    },
  };
}

/**
 * Audit helper: the spec's own consistency — derived height from slope and
 * half-base must match the parameter height; course sum must equal height.
 */
export function auditSpec(spec: PyramidSpec): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const p = spec.params;
  const hDerived = (p.baseSide / 2) * spec.derived.slopeTan;
  if (Math.abs(hDerived - p.height) > p.height * 0.005) {
    notes.push(
      `slope/height mismatch: derived ${hDerived.toFixed(2)} vs ${p.height} (params inconsistent)`,
    );
  }
  const last = spec.courses[spec.courses.length - 1];
  const sum = last ? last.y0 + last.h : 0;
  if (Math.abs(sum - p.height) > 0.02) {
    notes.push(`course sum ${sum.toFixed(3)} != height ${p.height}`);
  }
  return { ok: notes.length === 0, notes };
}
