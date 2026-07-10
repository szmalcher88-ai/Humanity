/**
 * Color script — per-time-of-day grading (Pillar E, brief §5). Keyframed
 * parameters lerped by ToD, fed as uniforms into the grade node.
 *
 * The AKHET script (canon: no golden-orange "movie Egypt"; brief §Pillar E):
 *   dawn   — cool sand, long blue shadows, the casing catching first fire
 *   noon   — brutal near-neutral high contrast, near-white limestone,
 *            dense blue sky; restrained saturation (heat, not romance)
 *   golden — warm stone against long violet shadows
 *   night  — moonlit blue silhouette, low saturation
 * Structure ported from PROJECT LAAS (MIT); content is AKHET's.
 * Equinox day: sunrise ≈ 6.0, sunset ≈ 18.0 solar time.
 */

import { Vector3 } from 'three';

export interface GradeParams {
  whiteBalance: [number, number, number];
  shadowTint: [number, number, number];
  shadowAmt: number;
  highlightTint: [number, number, number];
  highlightAmt: number;
  saturation: number;
  contrast: number;
}

interface Keyframe extends GradeParams {
  t: number;
}

const KEYFRAMES: Keyframe[] = [
  // deep night — moonlit
  { t: 0, whiteBalance: [0.8, 0.89, 1.14], shadowTint: [0.85, 0.92, 1.15], shadowAmt: 0.45, highlightTint: [0.94, 0.97, 1.1], highlightAmt: 0.22, saturation: 0.72, contrast: 1.07 },
  // pre-dawn blue hour
  { t: 5.3, whiteBalance: [0.86, 0.92, 1.1], shadowTint: [0.83, 0.92, 1.16], shadowAmt: 0.46, highlightTint: [1.0, 0.98, 1.02], highlightAmt: 0.24, saturation: 0.85, contrast: 1.06 },
  // dawn — cool sand, warm first light on east faces
  { t: 6.6, whiteBalance: [1.04, 0.98, 0.96], shadowTint: [0.8, 0.92, 1.18], shadowAmt: 0.44, highlightTint: [1.16, 1.0, 0.84], highlightAmt: 0.4, saturation: 1.08, contrast: 1.05 },
  // mid-morning — clearing to neutral
  { t: 9, whiteBalance: [1.01, 1.0, 0.99], shadowTint: [0.9, 0.97, 1.08], shadowAmt: 0.32, highlightTint: [1.05, 1.01, 0.95], highlightAmt: 0.18, saturation: 1.06, contrast: 1.06 },
  // noon — brutal, near-neutral, high contrast; shadows keep sky blue
  { t: 12, whiteBalance: [1.0, 1.0, 1.0], shadowTint: [0.9, 0.96, 1.08], shadowAmt: 0.26, highlightTint: [1.02, 1.01, 0.98], highlightAmt: 0.12, saturation: 1.0, contrast: 1.1 },
  // afternoon
  { t: 15.5, whiteBalance: [1.02, 1.0, 0.98], shadowTint: [0.9, 0.96, 1.07], shadowAmt: 0.3, highlightTint: [1.06, 1.01, 0.94], highlightAmt: 0.2, saturation: 1.05, contrast: 1.07 },
  // golden hour — warm stone, long violet shadows
  { t: 17.4, whiteBalance: [1.09, 1.0, 0.9], shadowTint: [0.78, 0.88, 1.18], shadowAmt: 0.54, highlightTint: [1.2, 1.02, 0.8], highlightAmt: 0.46, saturation: 1.12, contrast: 1.09 },
  // dusk
  { t: 18.8, whiteBalance: [0.94, 0.95, 1.07], shadowTint: [0.8, 0.9, 1.18], shadowAmt: 0.5, highlightTint: [1.1, 0.98, 0.88], highlightAmt: 0.32, saturation: 0.92, contrast: 1.06 },
  // wrap to night
  { t: 24, whiteBalance: [0.8, 0.89, 1.14], shadowTint: [0.85, 0.92, 1.15], shadowAmt: 0.45, highlightTint: [0.94, 0.97, 1.1], highlightAmt: 0.22, saturation: 0.72, contrast: 1.07 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function gradeParamsAt(tod: number): GradeParams {
  const t = ((tod % 24) + 24) % 24;
  let i = 0;
  while (i < KEYFRAMES.length - 2 && (KEYFRAMES[i + 1] as Keyframe).t < t) i++;
  const a = KEYFRAMES[i] as Keyframe;
  const b = KEYFRAMES[i + 1] as Keyframe;
  const k = b.t === a.t ? 0 : Math.min(Math.max((t - a.t) / (b.t - a.t), 0), 1);
  return {
    whiteBalance: lerp3(a.whiteBalance, b.whiteBalance, k),
    shadowTint: lerp3(a.shadowTint, b.shadowTint, k),
    shadowAmt: lerp(a.shadowAmt, b.shadowAmt, k),
    highlightTint: lerp3(a.highlightTint, b.highlightTint, k),
    highlightAmt: lerp(a.highlightAmt, b.highlightAmt, k),
    saturation: lerp(a.saturation, b.saturation, k),
    contrast: lerp(a.contrast, b.contrast, k),
  };
}

/** mutable uniform targets for the grade node */
export class GradeUniforms {
  whiteBalance = new Vector3(1, 1, 1);
  shadowTint = new Vector3(1, 1, 1);
  highlightTint = new Vector3(1, 1, 1);
  shadowAmt = 0.3;
  highlightAmt = 0.2;
  saturation = 1;
  contrast = 1.03;

  apply(p: GradeParams): void {
    this.whiteBalance.set(...p.whiteBalance);
    this.shadowTint.set(...p.shadowTint);
    this.highlightTint.set(...p.highlightTint);
    this.shadowAmt = p.shadowAmt;
    this.highlightAmt = p.highlightAmt;
    this.saturation = p.saturation;
    this.contrast = p.contrast;
  }
}
