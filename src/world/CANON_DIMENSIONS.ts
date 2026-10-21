/**
 * CANON_DIMENSIONS — single source of truth for every load-bearing dimension
 * on the plateau (brief: "consumed by both the geometry and the audit tests").
 *
 * Confidence levels follow the Bible's Levels A–E ("Every reconstructed
 * asset should internally include a confidence classification" — the
 * MASTER_PROMPT_BIBLE's levels; v1.1 cited a "Vol. II" that does not exist):
 *   A = direct archaeological evidence (survey measurement)
 *   B = strong scholarly consensus
 *   C = evidence-based reconstruction
 *   D = reasoned extrapolation (documented in DEVIATIONS.md)
 *   E = clearly marked speculative reconstruction (v1.2 I6)
 *
 * World frame: origin = center of the Great Pyramid at its base level.
 *   +X = true east, +Z = true south, +Y = up. Units: meters.
 *   Elevations in comments are meters ASL; world Y = ASL − G1_BASE_ASL.
 */

export type Confidence = 'A' | 'B' | 'C' | 'D' | 'E';

export interface CanonEntry {
  value: number;
  unit: 'm' | 'deg' | 'cubit' | 'count' | 'm_asl';
  confidence: Confidence;
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

/** Temenos (enclosure) wall: distance from the COURT'S OUTER EDGE (the
 *  geometry puts the wall's centreline at base + pavement + this = 135.38 m
 *  from the centre; v1.2 I7, D-3 note) and height. */
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
  // Row starts SOUTH of the mortuary temple (temple spans z ±26.25): the
  // first placement (z −18/34/86) overlapped G1-a with the temple's SE
  // corner — walls ran through the pyramid. G1-a's north edge now clears
  // the temple south wall by ~2.8 m, matching the published plan where
  // the row begins just south of the temple/causeway line.
  { x: 190, z: 52, confidence: 'C', source: 'Lehner 1997 p.116 plan (G1-a)' },
  { x: 190, z: 104, confidence: 'C', source: 'Lehner 1997 p.116 plan (G1-b)' },
  { x: 190, z: 156, confidence: 'C', source: 'Lehner 1997 p.116 plan (G1-c)' },
];

/** (T2-2) The Great Sphinx — shown from KHAFRE_PERIOD on only (D-19, D-20).
 *  Body centre at the real WGS84 delta, facing due east (Lehner); body
 *  ≈ 73 m long, ≈ 19 m wide, ≈ 20 m from the enclosure floor to the head. */
export const SPHINX_CENTER: CanonPlacement = {
  x: 325, z: 431, confidence: 'B', source: 'Lehner, Giza Plateau Mapping Project (WGS84 deltas)',
};
export const SPHINX_LENGTH = e(73, 'm', 'B', 'Lehner 1991, The Archaeology of an Image');
export const SPHINX_WIDTH = e(19, 'm', 'B', 'Lehner 1991');
export const SPHINX_HEIGHT = e(20, 'm', 'B', 'Lehner 1991');
/** PROVISIONAL: the enclosure floor 14 m under the CURRENT ground at the
 *  site (≈ +1.2 world), not its real ≈ 20 m ASL (−40 world) — the plateau
 *  here stands ~40 m too high (T2 plan finding 6; D-20) */
export const SPHINX_FLOOR_Y = e(-12.8, 'm', 'D', 'provisional — DEVIATIONS D-20');

/** (T2-3) Khafre's pyramid G2 — shown from KHAFRE_PERIOD on only (D-19,
 *  D-21). None of these numbers is in the canon (VII gives no G2 figures):
 *  each carries its outside source. */
export const G2_BASE_SIDE = e(215.25, 'm', 'B', 'Petrie 1883, The Pyramids and Temples of Gizeh');
/** the seked of 5¼ palms — rise/run 4/3 — giving 143.5 m (Petrie's measured
 *  53°10′ would give ≈ 143.7 m) */
export const G2_SLOPE_DEG = e(53.1301, 'deg', 'B', 'seked 5¼ palms (atan 4/3); Petrie 1883 53°10′');
export const G2_COURSE_COUNT = e(205, 'count', 'D', "ESTIMATE: G1's 210 scaled by height (143.5 / 146.6) — no Khafre count in the repo");
/** the authored knoll (GizaControl BEDROCK_KNOLLS) — its pad clears the West
 *  Field; the WGS84 delta (−322, 339) would put it onto the last tomb row */
export const G2_CENTER: CanonPlacement = {
  x: -330, z: 350, confidence: 'C', source: 'the WGS84 delta (−322, 339) moved to the authored knoll — DEVIATIONS D-21',
};
/** the levelled platform: a net CUT into the knoll's SW shoulder (≤ 4.0 m,
 *  ≈ 101k m³ under the base; fill ≤ 2.9 m at the NE corner) — the commonly
 *  cited "base ≈ 10 m above Khufu's" (T2-3 plan finding 1) */
export const G2_PAD_Y = e(10.0, 'm', 'D', 'outside figure (Khafre base ≈ 10 m above Khufu); the canon gives none — D-21');
export const G2_GRANITE_COURSES = e(1, 'count', 'C', "Lehner 1997 (Khafre's lowest casing course red granite) — not in the canon, D-21");
/** court + wall offset from the base — Khufu's 10.1 + 10.1 reused */
export const G2_TEMENOS_OFFSET = e(20.2, 'm', 'D', "Khufu's court and temenos offsets reused — no survey in the repo (D-21)");

/** (T2-4) Khafre's mortuary temple, causeway, valley temple and the Sphinx
 *  Temple — KHAFRE_PERIOD only (D-22). Canon VII gives NO figures for any
 *  of them: every number is an outside figure (C) or a reconstruction (D). */
export const KHAFRE_MT_EW = e(110, 'm', 'D', 'rounded; Hölscher 1912 to be checked — D-22');
export const KHAFRE_MT_NS = e(50, 'm', 'D', 'rounded; Hölscher 1912 to be checked — D-22');
/** the causeway's route: the mortuary temple's east front → a bend → the
 *  valley temple's west face, 499.5 m (the commonly cited ≈ 495 m, C). It
 *  BENDS because our provisional Sphinx enclosure and Khufu's quarry bowl
 *  differ from the real ones — the real causeway is straight (D-22) */
export const KHAFRE_CAUSEWAY: readonly (readonly [number, number])[] = [[-92.2, 350], [255, 484], [382.5, 484]];
/** the deck at the valley temple, just under its roof (+0.2): −0.5, not the
 *  plan's −2.0 — the ground before the temple's terrace stands at ≈ −0.6
 *  under the seed noise, and a deck pinned 1.5 m lower dropped 106 ‰ over
 *  its last three segments (the audit's 100 ‰ gate) */
export const KHAFRE_CAUSEWAY_END_Y = e(-0.5, 'm', 'D', 'the deck at the valley temple, near its roof — D-22');
/** the valley temple (granite) and the Sphinx Temple share the Sphinx's
 *  rock-cut floor (SPHINX_FLOOR_Y, D-20) — the real three share one level */
export const KHAFRE_VT_CENTER: CanonPlacement = { x: 405, z: 500, confidence: 'D', source: 'south of the Sphinx Temple, on the causeway — D-22' };
export const KHAFRE_VT_SIDE = e(45, 'm', 'C', 'the commonly cited ≈ 45 m square (outside figure)');
export const KHAFRE_VT_H = e(13, 'm', 'D', 'reconstruction — D-22');
export const SPHINX_TEMPLE_CENTER: CanonPlacement = { x: 405, z: 431, confidence: 'D', source: 'on the Sphinx axis, 6.8 m east of the paws — D-22' };
export const SPHINX_TEMPLE_SIDE = e(46, 'm', 'D', 'reconstruction — D-22');
export const SPHINX_TEMPLE_H = e(9, 'm', 'D', 'reconstruction — D-22');

/** (T2-5) Menkaure's pyramid G3 — MENKAURE_PERIOD only (D-23). The canon
 *  names it (the Bible's southern district) but gives no figures. */
/** the mean of the published 102.2 × 104.6 m base (Petrie; Maragioglio &
 *  Rinaldi) — the builder takes a square */
export const G3_BASE_SIDE = e(103.4, 'm', 'C', 'mean of 102.2 × 104.6 m (Petrie 1883; Maragioglio & Rinaldi)');
/** ≈ 51°20′ (Petrie) → 64.5 m; ≈ 65.5 m is usually cited with the 104.6 side */
export const G3_SLOPE_DEG = e(51.3, 'deg', 'C', 'Petrie 1883 (≈ 51°20′)');
export const G3_COURSE_COUNT = e(92, 'count', 'D', "ESTIMATE: G1's 210 scaled by height (64.5 / 146.6)");
/** the lowest sixteen courses in red granite, left UNDRESSED (its working
 *  faces never dressed down — widely published) */
export const G3_GRANITE_COURSES = e(16, 'count', 'C', 'the lowest sixteen courses red granite, undressed (widely published)');
/** the WGS84 delta (−588, 743) moved 53 m north off the authored Main Wadi's
 *  band — at the delta its court would stand on 22.6 m of fill (D-23) */
export const G3_CENTER: CanonPlacement = {
  x: -588, z: 690, confidence: 'D', source: 'the WGS84 delta (−588, 743) moved 53 m north — DEVIATIONS D-23',
};
export const G3_PAD_Y = e(12.0, 'm', 'D', 'the plateau cap there (GizaControl) — D-23');
export const G3_TEMENOS_OFFSET = e(20.2, 'm', 'D', "Khufu's court and temenos offsets reused, as G2's (D-23)");

/** distance (m, plan view) from a point to the causeway's axis — the corridor
 *  the KHAFRE world keeps clear of gangs and debris (T2-4 K-10) */
export function khafreCorridorDist(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < KHAFRE_CAUSEWAY.length; i++) {
    const [ax, az] = KHAFRE_CAUSEWAY[i] as readonly [number, number];
    const [bx, bz] = KHAFRE_CAUSEWAY[i + 1] as readonly [number, number];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}

/** Satellite pyramid G1-d, just OUTSIDE the SE corner of the enclosure —
 *  at z=130 the south temenos wall (z≈135) ran straight through it. */
export const G1D_CENTER: CanonPlacement = {
  x: 130, z: 151, confidence: 'B', source: 'Hawass 1996 (SE corner find)',
};

/** Heit el-Ghurab worker town (SE, beyond Wall of the Crow). */
export const WORKER_TOWN_CENTER: CanonPlacement = {
  x: 560, z: 860, confidence: 'B',
  source: 'AERA site maps (29.9715N 31.1400E vs G1 center)',
};

/** HeG street grid rotation (rad about +Y): the town-local frame shared by
 *  the settlement builder and the terrain's building platforms */
export const WORKER_TOWN_YAW = -0.14;

/**
 * Worker-town building platforms, in the town-local frame (+u east-ish,
 * +v south-ish): [u0, v0, u1, v1, level]. The town sits on the 2-3 % fall
 * from the Wadi mouth to the plain, and its blocks are flat-based — a
 * gallery is a 78 × 36 m roofed hall — so on the raw slope the uphill side
 * sank to roof level (v1.1). Each district stands on its own dead-flat
 * terrace at the MEAN of the natural surface under it (cut ≈ fill ≈ 1.5 m).
 * Levels measured 2026-10-20 with groundProbe over the pre-platform surface;
 * the collision audit's `sunk` rule is the guard if the terrain moves.
 */
export const WORKER_TOWN_PADS: readonly (readonly [number, number, number, number, number])[] = [
  // north rows reach 4 m past the blocks: their street porticos stand there
  [-120, -143, -36, -97, -34.2], // galleries NW
  [-32, -143, 52, -97, -35.4], // galleries NE
  [-120, -94, -36, -52, -35.0], // galleries SW
  [-32, -94, 52, -52, -36.5], // galleries SE
  // starts 6.5 m (one blend width) east of the NE galleries: overlapping,
  // its lower level dragged the gallery's east corners down 2.1 m
  [56, -138, 132, -46, -37.5], // eastern town
  [-103, 25, 4, 48, -36.6], // bakery rows
  [70, 26, 122, 68, -41.9], // Royal Administrative Building
  [-116, 52, -30, 72, -36.6], // animal pens + woodpiles
  // (v1.2 I3) canon Vol VIII — levels from tools/ground.ts (cut/fill mean of
  // the ground they replace); the brewery pad starts 6 m (one blend) east of
  // the bakery row so it never drags the last oven down
  [10, 26, 32, 48, -38.3], // brewery
  [62, -38, 80, -24, -37.9], // physicians' house
  // industrial quarter (v1.1, monuments/IndustryDistrict.ts) — the
  // brickyard stands on the dead-flat alluvium and needs no terrace
  [-30, 108, 30, 152, -39.7], // pottery yard
  [-30, 162, 20, 202, -42.0], // copper works
];

/** Khufu valley temple / harbor basin (under Nazlet el-Samman). */
export const VALLEY_TEMPLE_CENTER: CanonPlacement = {
  x: 817, z: -115, confidence: 'C',
  source: 'Basalt paving + causeway trace; Hawass 1990s observations — DEVIATIONS D-4',
};

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
