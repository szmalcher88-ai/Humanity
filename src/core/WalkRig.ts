/**
 * Walk mode (Phase 7) — `G` drops the camera to eye height and pins it to
 * whatever it is standing on.
 *
 * Flying is how you inspect a site; WALKING is how you feel its scale. The
 * causeway's corridor is 632 m long (825 m from the pyramid's centre to the
 * valley temple) and the difference between "a ramp in a plan" and
 * "a walled corridor you climb for ten minutes" only lands on foot.
 *
 * WHAT IT STANDS ON. The terrain is easy (the CPU height mirror). Structures
 * are not: the complex is merged geometry in a handful of million-triangle
 * draws, and a per-frame raycast against that is out of the question. But the
 * FOOTPRINT REGISTRY already carries a logical OBB — including its world-Y
 * span — for every structure placed in the world, because the collision audit
 * needs one. That registry is exactly a walkable-surface database: if the
 * walker's feet are inside a footprint's XZ box and its top is within a step
 * of them, the top IS the floor. So the causeway, the quay, the temple
 * platforms and the mastaba tops all become walkable for free, and they stay
 * correct when the Inspector moves a structure.
 *
 * Vertical motion is a critically-damped follow rather than a snap: a step up
 * onto the causeway embankment reads as a step, and the 1.12 m pyramid courses
 * do not teleport the eye.
 */

import type { PerspectiveCamera } from 'three';
import { fpAll, fpAabb, type Footprint } from '../debug/Footprints';

/** Old Kingdom male mean stature 1.65 m ⇒ eye at ~1.55 m */
export const EYE_HEIGHT = 1.55;
/** the tallest single step the walker will take without a ramp */
const STEP_UP = 1.25;
const WALK_SPEED = 1.6;
const RUN_SPEED = 4.8;

export class WalkRig {
  /** whether walk mode owns the camera */
  active = false;
  private groundY = 0;
  private smoothY = 0;
  private first = true;
  private lastX = NaN;
  private lastZ = NaN;

  constructor(
    private readonly heightAt: (x: number, z: number) => number,
  ) {}

  toggle(camera: PerspectiveCamera): boolean {
    this.active = !this.active;
    if (this.active) {
      this.first = true;
      this.snap(camera);
    }
    return this.active;
  }

  /** horizontal speed for the current mode */
  speed(sprint: boolean): number {
    return sprint ? RUN_SPEED : WALK_SPEED;
  }

  /**
   * The surface height under (x, z): the terrain, raised by any structure
   * footprint whose top is standable from the walker's current feet level.
   */
  surfaceAt(x: number, z: number, feetY: number): number {
    let best = this.heightAt(x, z);
    if (!Number.isFinite(best)) best = 0;
    for (const f of fpAll() as readonly Footprint[]) {
      if (f.ground === 'afloat' || f.ground === 'none') continue;
      const bb = fpAabb(f);
      if (x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1) continue;
      // a surface is standable if it is at or below the knee-high step limit;
      // anything taller is a wall the walker goes around, not up
      if (f.y1 > best && f.y1 <= feetY + STEP_UP) best = f.y1;
    }
    return best;
  }

  private snap(camera: PerspectiveCamera): void {
    const p = camera.position;
    this.groundY = this.surfaceAt(p.x, p.z, p.y);
    this.smoothY = this.groundY;
    p.y = this.groundY + EYE_HEIGHT;
  }

  /** call after the horizontal move: pins the eye to the surface */
  update(camera: PerspectiveCamera, dt: number): void {
    if (!this.active) return;
    const p = camera.position;
    // a jump larger than a stride is a TELEPORT (bookmark, setPose, flythrough
    // handoff) — smoothing across it slid the eye for a third of a second and
    // read as sinking into the causeway
    const jumped =
      !Number.isFinite(this.lastX) ||
      Math.hypot(p.x - this.lastX, p.z - this.lastZ) > 2.5;
    this.lastX = p.x;
    this.lastZ = p.z;
    if (jumped) this.first = true;
    const feet = this.first ? p.y : this.smoothY;
    this.groundY = this.surfaceAt(p.x, p.z, feet);
    if (this.first) {
      this.smoothY = this.groundY;
      this.first = false;
    } else {
      // critically-damped follow: ~90 ms to close the gap. Instant would make
      // every 1.12 m course a teleport; slower and the walker floats upstairs.
      const k = 1 - Math.exp(-dt / 0.09);
      this.smoothY += (this.groundY - this.smoothY) * k;
    }
    p.y = this.smoothY + EYE_HEIGHT;
  }
}
