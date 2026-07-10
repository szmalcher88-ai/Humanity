/**
 * CANON_DIMENSIONS — single source of truth for every load-bearing dimension
 * on the plateau (brief: "consumed by both the geometry and the audit tests").
 *
 * Confidence levels follow canon Vol. II:
 *   A = direct archaeological evidence (survey measurement)
 *   B = strong scholarly consensus
 *   C = evidence-based reconstruction
 *   D = reasoned extrapolation (documented in DEVIATIONS.md)
 *
 * World frame: origin = center of the Great Pyramid at its base level.
 *   +X = true east, +Z = true south, +Y = up. Units: meters.
 *   Elevations in comments are meters ASL; world Y = ASL − G1_BASE_ASL.
 */

export interface CanonEntry {
  value: number;
  unit: 'm' | 'deg' | 'cubit' | 'count' | 'm_asl';
  confidence: 'A' | 'B' | 'C' | 'D';
  source: string;
}

function e(
  value: number,
  unit: CanonEntry['unit'],
  confidence: CanonEntry['confidence'],
  source: string,
): CanonEntry {
  return { value, unit, confidence, source };
}

/* ------------------------------------------------------------------ */
/* Units and geodesy                                                    */
/* ------------------------------------------------------------------ */

export const ROYAL_CUBIT = e(0.52375, 'm', 'A',
  'Petrie 1883, The Pyramids and Temples of Gizeh — 20.620 in derived from King\'s Chamber');

/** Giza latitude/longitude — drives the astronomical sun path (brief §5). */
export const GIZA_LAT_DEG = e(29.9792, 'deg', 'A', 'WGS84 position of Great Pyramid');
export const GIZA_LON_DEG = e(31.1342, 'deg', 'A', 'WGS84 position of Great Pyramid');

/**
 * Canonical day of year: spring equinox (day 79). Rationale: (1) sun rises
 * due east / sets due west — the cardinal-alignment shadow audit gets its
 * cleanest signal; (2) noon solar altitude ≈ 60° — strong vertical light;
 * (3) peret/harvest transition — floodplain fields mature green (canon
 * Vol. I growing season), river at navigable non-flood stage.
 * Interpretive choice → DEVIATIONS.md D-2.
 */
export const CANONICAL_DAY_OF_YEAR = e(79, 'count', 'D', 'Project choice, see DEVIATIONS.md D-2');

/* ------------------------------------------------------------------ */
/* The Great Pyramid (G1, Akhet Khufu)                                  */
/* ------------------------------------------------------------------ */

/** Mean base side length. Cole 1925: 230.364 m; Dash 2015 resurvey: 230.363 m. */
export const G1_BASE_SIDE = e(230.363, 'm', 'A',
  'Cole 1925 Survey of Egypt paper 39; Glen Dash 2015 AERA base survey');

/** Original height with casing and capstone. 280 royal cubits. */
export const G1_HEIGHT = e(146.6, 'm', 'A',
  'Lehner 1997, The Complete Pyramids p.108 (146.6 m); Petrie 1883 (146.71±0.18 by slope)');

/**
 * Face slope from horizontal. Seked 5½ palms → arctan(14/11) = 51.8428°;
 * Petrie measured 51°52'±2'; Dash 2015 casing analysis 51°50'40"±.
 */
export const G1_SLOPE_DEG = e(51.8428, 'deg', 'A',
  'Seked 5½ (Rhind papyrus method); Petrie 1883; Dash 2015');

/**
 * Cardinal alignment error: sides average ~3.8 arcmin COUNTERCLOCKWISE of
 * true cardinal (west of north). We render true cardinal (error is far
 * below one pixel at any range); the audit tolerance is ±0.1°.
 */
export const G1_ALIGNMENT_ERROR_ARCMIN = e(-3.8, 'deg', 'A',
  'Dash 2017 JAEA "Occam\'s Egyptian razor" — mean axis rotation ≈ 3.8\' CCW');

/** Original number of courses to the apex (201 survive today, truncated). */
export const G1_COURSE_COUNT = e(210, 'count', 'B',
  'Goyon 1978 course survey; Maragioglio & Rinaldi 1965');

/** First (bottom) course height — the tallest regular course. */
export const G1_COURSE1_HEIGHT = e(1.49, 'm', 'A', 'Petrie 1883 course measurements (58.6 in)');

/** Typical minimum course height high on the monument. */
export const G1_COURSE_MIN_HEIGHT = e(0.52, 'm', 'A', 'Petrie 1883 course measurements');

/**
 * Course heights are NOT monotonic: they decay then jump back up in
 * documented "surges" (fresh quarry lifts). The generator reproduces the
 * sawtooth statistically (period 20–40 courses, surge amplitude
 * +0.25–0.65 m over local minimum) — profile shape confidence C.
 */
export const G1_COURSE_SURGE_PERIOD = e(30, 'count', 'C', 'Petrie 1883 course chart morphology');

/** Baseline leveling: perimeter pavement is level within ~2.1 cm. */
export const G1_BASE_LEVEL_TOLERANCE = e(0.021, 'm', 'A', 'Lehner & Goodman 1985 survey');

/** Estimated block count (core + casing) — sanity bound for the generator. */
export const G1_BLOCK_COUNT_EST = e(2_300_000, 'count', 'B', 'Lehner 1997 p.108');

/** Entrance: north face, height above base and offset east of the axis. */
export const G1_ENTRANCE_HEIGHT = e(16.9, 'm', 'A', 'Maragioglio & Rinaldi 1965; Petrie 1883');
export const G1_ENTRANCE_EAST_OFFSET = e(7.29, 'm', 'A', 'Petrie 1883 (287.1 in east of centre)');

/** Tura-limestone court pavement width around the pyramid base. */
export const G1_COURT_PAVEMENT_WIDTH = e(10.1, 'm', 'C', 'Lehner 1997 p.109 (≈10 m paved court)');

/** Temenos (enclosure) wall: distance from pyramid base and height. */
export const G1_TEMENOS_DISTANCE = e(10.1, 'm', 'C', 'Lehner 1997 p.109');
export const G1_TEMENOS_HEIGHT = e(8.0, 'm', 'D', 'Reconstruction; wall footings only — DEVIATIONS D-3');

/* ------------------------------------------------------------------ */
/* Khufu complex                                                        */
/* ------------------------------------------------------------------ */

/** Mortuary temple footprint on the east side (N–S × E–W). */
export const G1_MORTUARY_TEMPLE_NS = e(52.5, 'm', 'B',
  'Lehner 1997 p.109 — basalt pavement remains');
export const G1_MORTUARY_TEMPLE_EW = e(40.0, 'm', 'C', 'Lehner 1997 p.109 reconstruction plans');

/** Causeway: length, width, roofed interpretation (DEVIATIONS D-4). */
export const G1_CAUSEWAY_LENGTH = e(825, 'm', 'B',
  'Lehner 1997 p.109; Herodotus II.124 (5 stadia); trace to Nazlet el-Samman');
export const G1_CAUSEWAY_WIDTH = e(9.5, 'm', 'C', 'Lehner 1997; Hawass 1990s trench sections');
/** Bearing north of due east for the descent (bend simplified straight). */
export const G1_CAUSEWAY_AZIMUTH_N_OF_E = e(8.0, 'deg', 'D',
  'Trace under Nazlet el-Samman trends N of E — DEVIATIONS D-4');

/** Queens' pyramids G1-a/b/c (east field, N→S). Bases ≈ 1/5 of G1. */
export const QUEENS_BASE_SIDE = e(46.0, 'm', 'C',
  'Lehner 1997 p.116 (each ≈ 45–49 m); per-pyramid exactness pending — DEVIATIONS D-5');
export const QUEENS_SLOPE_DEG = e(51.75, 'deg', 'C', 'Surviving casing lines, Maragioglio & Rinaldi');

/** Satellite pyramid G1-d (SE corner, found 1993). */
export const G1D_BASE_SIDE = e(21.75, 'm', 'A', 'Hawass 1996 report on G1-d discovery');
export const G1D_SLOPE_DEG = e(51.84, 'deg', 'C', 'Reconstructed to match complex seked');

/** Khufu ship (southern boat pit) — reference vessel for Phase 5 classes. */
export const KHUFU_SHIP_LENGTH = e(43.63, 'm', 'A', 'Restored vessel, Giza Solar Boat Museum');
export const KHUFU_SHIP_BEAM = e(5.66, 'm', 'A', 'Restored vessel');

/** Southern boat pits: rock-cut, rectangular, with limestone cover beams. */
export const BOAT_PIT_SOUTH_LENGTH = e(32.5, 'm', 'A', 'Excavation reports (pit interior)');

/* ------------------------------------------------------------------ */
/* Cemeteries and settlement                                            */
/* ------------------------------------------------------------------ */

/** Western Field nucleus mastaba: typical footprint and height (Reisner grid). */
export const MASTABA_NUCLEUS_LENGTH = e(24.0, 'm', 'C', 'Reisner 1942, Giza Necropolis I — G4000 series');
export const MASTABA_NUCLEUS_WIDTH = e(11.0, 'm', 'C', 'Reisner 1942');
export const MASTABA_NUCLEUS_HEIGHT = e(4.5, 'm', 'C', 'Reisner 1942; surviving cores');
/** Grid pitch of the western "streets of the dead". */
export const MASTABA_GRID_PITCH_EW = e(31.0, 'm', 'C', 'Reisner 1942 cemetery plans');
export const MASTABA_GRID_PITCH_NS = e(16.0, 'm', 'C', 'Reisner 1942 cemetery plans');

/** Wall of the Crow (Heit el-Ghurab NW boundary). */
export const WALL_OF_CROW_LENGTH = e(200, 'm', 'A', 'Lehner AERA excavation reports');
export const WALL_OF_CROW_HEIGHT = e(10, 'm', 'A', 'Lehner AERA excavation reports');

/* ------------------------------------------------------------------ */
/* Plateau geography (drives the Phase 1 terrain control map)           */
/* ------------------------------------------------------------------ */

/** Elevation of the G1 base platform (meters ASL). World Y=0 here. */
export const G1_BASE_ASL = e(60.0, 'm_asl', 'B', 'Survey of Egypt contours; Lehner & Hawass 2017');

/** Old Kingdom floodplain surface near Giza (meters ASL). */
export const FLOODPLAIN_ASL = e(15.5, 'm_asl', 'C',
  'Sheisha et al. 2022 PNAS (Khufu branch cores); Bunbury & Jeffreys valley studies');

/** Khufu-branch water level at non-flood stage (meters ASL). */
export const NILE_WATER_ASL = e(13.5, 'm_asl', 'C', 'Sheisha et al. 2022 PNAS');

/** High point of the Maadi-formation knoll SW of the plateau (m ASL). */
export const PLATEAU_SW_HIGH_ASL = e(102.0, 'm_asl', 'B', 'Survey of Egypt 1:5000 contours');

/** Mokattam formation dip: the plateau surface falls ~3–6° to the SE. */
export const PLATEAU_DIP_DEG = e(4.5, 'deg', 'B', 'Aigner 1983 Giza limestone geology');

/** Streamed world extent (brief floor ≥ 4×4 km), origin at G1 center. */
export const WORLD_WEST = e(-1200, 'm', 'D', 'Project frame');
export const WORLD_EAST = e(2800, 'm', 'D', 'Project frame');
export const WORLD_NORTH = e(-1800, 'm', 'D', 'Project frame');
export const WORLD_SOUTH = e(2200, 'm', 'D', 'Project frame');

/* ------------------------------------------------------------------ */
/* Placements in the world frame (X east, Z south, meters from G1)      */
/* Derived from WGS84 deltas at Giza: 1° lat ≈ 110.9 km,               */
/* 1° lon ≈ 96.5 km (cos 29.98°).                                      */
/* ------------------------------------------------------------------ */

export interface CanonPlacement {
  x: number;
  z: number;
  confidence: CanonEntry['confidence'];
  source: string;
}

/** Khufu quarry (Central Field horseshoe, S–SSE of G1). */
export const QUARRY_KHUFU_CENTER: CanonPlacement = {
  x: 100, z: 450, confidence: 'B',
  source: 'Lehner & Hawass 2017 ch.4 quarry maps',
};

/** Queens' pyramids G1-a/b/c: N→S row east of G1, south of the mortuary
 *  temple axis. Row x-offset and ~52 m pitch from published plans. */
export const QUEENS_CENTERS: CanonPlacement[] = [
  { x: 190, z: -18, confidence: 'C', source: 'Lehner 1997 p.116 plan (G1-a)' },
  { x: 190, z: 34, confidence: 'C', source: 'Lehner 1997 p.116 plan (G1-b)' },
  { x: 190, z: 86, confidence: 'C', source: 'Lehner 1997 p.116 plan (G1-c)' },
];

/** Satellite pyramid G1-d, just outside the SE corner of the enclosure. */
export const G1D_CENTER: CanonPlacement = {
  x: 130, z: 130, confidence: 'B', source: 'Hawass 1996 (SE corner find)',
};

/** Heit el-Ghurab worker town (SE, beyond Wall of the Crow). */
export const WORKER_TOWN_CENTER: CanonPlacement = {
  x: 560, z: 860, confidence: 'B',
  source: 'AERA site maps (29.9715N 31.1400E vs G1 center)',
};

/** Khufu valley temple / harbor basin (under Nazlet el-Samman). */
export const VALLEY_TEMPLE_CENTER: CanonPlacement = {
  x: 817, z: -115, confidence: 'C',
  source: 'Basalt paving + causeway trace; Hawass 1990s observations — DEVIATIONS D-4',
};

/** Derived: causeway end = mortuary temple east front. */
export function causewayStart(): { x: number; z: number } {
  return { x: G1_BASE_SIDE.value / 2 + G1_MORTUARY_TEMPLE_EW.value, z: 0 };
}

/* ------------------------------------------------------------------ */
/* Derived helpers (geometry AND audit consume these — one truth)       */
/* ------------------------------------------------------------------ */

/** Half-base at a given height fraction 0..1 (0 = base, 1 = apex). */
export function g1HalfBaseAt(hFrac: number): number {
  return (G1_BASE_SIDE.value / 2) * (1 - hFrac);
}

/** Expected height from base side and slope — cross-checks G1_HEIGHT. */
export function g1HeightFromSlope(): number {
  return (G1_BASE_SIDE.value / 2) * Math.tan((G1_SLOPE_DEG.value * Math.PI) / 180);
}

/** Consistency audit: derived height must sit within 0.5 m of the survey height. */
export function auditSelfConsistency(): { ok: boolean; derivedHeight: number } {
  const h = g1HeightFromSlope();
  return { ok: Math.abs(h - G1_HEIGHT.value) < 0.5, derivedHeight: h };
}
