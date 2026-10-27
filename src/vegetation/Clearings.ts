/**
 * Where nothing is planted (2026-10-27): the human's screenshot showed the
 * boatyard's hulls standing among date palms — the groves were sampled with
 * no knowledge of the harbour's works. A tree is kept only clear of
 *  - the working grounds below, which no single footprint covers (the slip
 *    between the hulls, the timber stacks and the saw is open yard), and
 *  - every non-passive footprint of the harbour and works families, grown by
 *    a crown's reach.
 * Read at spawn time: TerrainScene builds the structures (their footprints)
 * before the palms and the shore trees.
 */

import { fpAabb, fpAll } from '../debug/Footprints';

/** open work yards: x0, x1, z0, z1 (world m) */
export const WORK_GROUNDS: readonly [number, number, number, number][] = [
  [955, 1150, 20, 125], // the boatyard: two hulls on stocks, timber, the saw, shades — and its margin
];

const WORK_FAMILIES = ['harbor-district', 'harbor-works', 'tura-yard', 'quarry-works'];

/** a test (x, z) → may a tree stand here; `reach` = the crown's radius */
export function clearOfWorks(reach = 3): (x: number, z: number) => boolean {
  const rects = fpAll()
    .filter((f) => !f.passive && f.ground !== 'afloat' && WORK_FAMILIES.includes(f.family))
    .map(fpAabb);
  return (x, z) =>
    !WORK_GROUNDS.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1) &&
    !rects.some((r) => x > r.x0 - reach && x < r.x1 + reach && z > r.z0 - reach && z < r.z1 + reach);
}
