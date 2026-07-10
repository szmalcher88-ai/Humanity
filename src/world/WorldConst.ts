/**
 * World constants — dimensions, grid sizes, vertical datum, surface ids.
 * The authored Giza layout (escarpment, wadi, quarry, river, harbor) lives
 * in GizaControl.ts; load-bearing archaeology in CANON_DIMENSIONS.ts.
 *
 * Frame: origin = Great Pyramid center, +X east, +Z south, Y up.
 * World Y = meters ASL − 60 (G1 base level = 0) — see CANON_DIMENSIONS.
 */

import { FLOODPLAIN_ASL, G1_BASE_ASL, NILE_WATER_ASL } from './CANON_DIMENSIONS';

/** terrain grid edge length (m) — brief floor ≥ 4×4 km */
export const WORLD_SIZE = 4096;
export const WORLD_HALF = WORLD_SIZE / 2;

/**
 * The terrain grid is NOT centered on G1: the plateau needs its western
 * desert and the Nile corridor its east bank. Grid center in world frame:
 */
export const TERRAIN_CX = 800;
export const TERRAIN_CZ = 200;

/** ASL → world Y */
export function aslToY(asl: number): number {
  return asl - G1_BASE_ASL.value;
}

/** world-Y of key levels */
export const FLOODPLAIN_Y = aslToY(FLOODPLAIN_ASL.value); // −44.5
export const NILE_WATER_Y = aslToY(NILE_WATER_ASL.value); // −46.5
export const NILE_BED_Y = aslToY(7.0); // channel bed
export const HARBOR_BED_Y = aslToY(9.5);

/** final heightfield resolution (1 m/texel at 4096) */
export const HEIGHT_RES = 4096;
/** sand-transport / fields simulation grid (2 m/texel) */
export const SIM_RES = 2048;

/** far vista shell outer radius (brief: visible range ≥ 8 km) */
export const FAR_RADIUS = 16000;

/**
 * Prevailing wind: from the NNW (Egyptian etesian winds). Unit vector the
 * wind blows TOWARD, in world xz. Drives sand transport, ripple orientation,
 * smoke/banners/particles in later phases.
 */
export const WIND_X = 0.38;
export const WIND_Z = 0.92;

/** surface classification ids (quantized in the surface texture r-channel) */
export const enum Surface {
  Bedrock = 0, // exposed Mokattam limestone
  Sand = 1, // aeolian sand sheet / drifts
  Gravel = 2, // desert pavement, wadi gravel
  QuarryFloor = 3, // worked extraction floors + debris
  Silt = 4, // floodplain alluvium
  Marsh = 5, // wet margins, reed beds
  Riverbed = 6, // submerged channel bed
  COUNT = 7,
}

export const SURFACE_NAMES: readonly string[] = [
  'bedrock',
  'sand',
  'gravel',
  'quarry',
  'silt',
  'marsh',
  'riverbed',
];

/** quality presets — smaller grids, never fewer systems */
export interface QualityConfig {
  heightRes: number;
  simRes: number;
  sandIters: number;
}

export function qualityConfig(preset: 'low' | 'high' | 'ultra'): QualityConfig {
  switch (preset) {
    case 'low':
      return { heightRes: 2048, simRes: 1024, sandIters: 90 };
    case 'ultra':
      return { heightRes: 4096, simRes: 2048, sandIters: 220 };
    case 'high':
      return { heightRes: HEIGHT_RES, simRes: SIM_RES, sandIters: 150 };
  }
}
