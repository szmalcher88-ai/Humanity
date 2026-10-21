/**
 * The irrigation works of the west-bank belt (v1.2 I4) — canon Vol. IV
 * District 10 ("irrigation basins, small canals"), the CANAL SYSTEM
 * ("Artificial canals connect: harbors, fields …"; they "should exhibit:
 * stone reinforcements, wooden docks, sluice structures where appropriate,
 * small bridges"), brief §2 "irrigation basins and canals obeying gravity
 * (canon: no decorative water)" and the field dressing rule "irrigation
 * moisture gradients, paths, field huts".
 *
 * GRAVITY. The epoch is the low river at the spring equinox (D-2): the
 * plain stands 2 m above the water. Basin irrigation filled the basins from
 * the FLOOD (Akhet); now, in early harvest, they are dry and drained — the
 * dykes stand round shorn and ripening fields. The only standing water is
 * in the main canals, which are dug BELOW the river's low stage and open to
 * it, so they hold the river's own level (still water, no flow, nothing
 * uphill). Water for gardens and orchards is lifted from them by hand, in
 * jars on a yoke — the shaduf is a New Kingdom device and is not shown.
 *
 * Fixed works, like the harbour approach channel: the terrain is cut by
 * them (GizaControl), the canal water sheets follow them (NileWater), and
 * the crop parcels are cut back to their banks (Fields — the parcel plan's
 * random draws are untouched, only the edges that run into a work move).
 * Lines sit on the parcel plan's row gaps for the default seed.
 */

import { NILE_WATER_Y } from './WorldConst';

/** a main canal: an east–west cut from the river (x1, inside the channel)
 *  to its blind west end (x0) at the desert edge of the belt */
export interface Canal {
  z: number;
  x0: number;
  x1: number;
}

export const CANALS: readonly Canal[] = [
  { z: -997.3, x0: 1205, x1: 1975 },
  { z: 855.2, x0: 1205, x1: 2000 },
  { z: 1667.3, x0: 1205, x1: 2110 },
];

/** canal bed: 1.1 m below the river's low stage — it holds water */
export const CANAL_BED_Y = NILE_WATER_Y - 1.1;
/** flat bed half-width, and the half-width where the cut meets the plain */
export const CANAL_BED_HALF = 3.2;
export const CANAL_TOP_HALF = 7.4;
/** spoil banks (the dug earth heaped along both sides): centre offset */
export const SPOIL_OFF = 9.8;
/** strip kept clear of crops either side of a canal's centre line */
export const CANAL_CORRIDOR = 12.2;

/** transverse dykes between the basins (z of each east–west bank) */
export const DYKES: readonly number[] = [
  -1584.3, -1303.8, -738.8, -530.2, 251.8, 531, 1130.9, 1415.4, 1898.6,
];
export const DYKE_HALF_BASE = 2.8;
export const DYKE_CORRIDOR = 3.0;
/** the west-bank belt's desert edge (Fields' west band starts here) */
export const BELT_WEST_X = 1170;

/** z-intervals kept clear of crops: every canal and dyke corridor */
export function corridors(): [number, number][] {
  return [
    ...CANALS.map((c): [number, number] => [c.z - CANAL_CORRIDOR, c.z + CANAL_CORRIDOR]),
    ...DYKES.map((z): [number, number] => [z - DYKE_CORRIDOR, z + DYKE_CORRIDOR]),
  ];
}

/**
 * Cut a west-bank parcel's z-span [z0, z0 + d] back out of every corridor
 * it runs into; where a corridor splits it, the larger piece is kept.
 */
export function clipToCorridors(z0: number, d: number): [number, number] {
  let a = z0;
  let b = z0 + d;
  for (const [c0, c1] of corridors()) {
    if (b <= c0 || a >= c1) continue;
    const north = c0 - a;
    const south = b - c1;
    if (north >= south) b = Math.min(b, c0);
    else a = Math.max(a, c1);
  }
  return [a, Math.max(0.5, b - a)];
}
