/**
 * Shared world-time uniform for all animated materials (vessel bobbing,
 * vegetation wind sway, …). One uniform, set once per frame from the
 * engine's worldTime — freeze-safe: pausing worldTime freezes every
 * animation coherently (same rule as NileWater's advection).
 */

import { uniform } from 'three/tsl';

export const uWorldTime = uniform(0);

export function setWorldTime(t: number): void {
  uWorldTime.value = t;
}
