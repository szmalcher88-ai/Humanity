/**
 * The worker town's local frame (+u east-ish, +v south-ish, rotated by
 * WORKER_TOWN_YAW about the canon centre) as a pure helper, so systems that
 * are not the town builder — particles, inhabitants, the industrial
 * district — place things in the SAME frame the buildings use.
 *
 * (v1.1: the bakery smoke anchors were laid out in town-local numbers but on
 * world axes, so the columns rose up to 13 m away from the chimneys.)
 */

import { WORKER_TOWN_CENTER, WORKER_TOWN_YAW } from './CANON_DIMENSIONS';

const C = Math.cos(WORKER_TOWN_YAW);
const S = Math.sin(WORKER_TOWN_YAW);

/** town-local (u, v) → world (x, z) */
export function townToWorld(u: number, v: number): [number, number] {
  return [WORKER_TOWN_CENTER.x + u * C - v * S, WORKER_TOWN_CENTER.z + u * S + v * C];
}
