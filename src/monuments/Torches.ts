/**
 * Fire at night (Phase 7) — the worker town's lamps, brazier posts and bakery
 * hearths, plus a pair of harbour lanterns and the causeway watch fires.
 *
 * Inhabited-not-populated applies after dark too: an empty moonlit town reads
 * as a ruin, which is exactly the wrong story for a site with several thousand
 * people living in it. Fire is the only artificial light in 2550 BCE, so it
 * has to carry the whole "someone is home" read.
 *
 * Two halves:
 *  - EMISSIVE flame geometry (a small tapered cone per source, plus a bowl):
 *    always on, costs one draw, and bloom turns it into a believable point of
 *    fire. Emissive is radiance, so it survives the night exposure untouched.
 *  - a SMALL set of real PointLights for the ones close to a wall, so the
 *    mudbrick actually catches warm light and the geometry reads. Point lights
 *    are evaluated per fragment by every lit material — the count is the
 *    budget here, not the shadow maps (they cast none).
 *
 * Both are gated by night-ness: by day the flames dim to a dull ember and the
 * lights go to zero, so the daylight frames pay nothing for them and no
 * torch glows in full sun (a classic tell).
 */

import { AdditiveBlending, Group, Mesh, PointLight, type Object3D } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, float, mix, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import type { WorldSeed } from '../core/Seed';
import type { Heightfield } from '../world/Heightfield';
import { GeoWriter, limestoneMaterial } from './KhufuComplex';
import { CAMP_HEARTHS } from './WorkCamp';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NF, NV3 } from '../gpu/TSLTypes';
import { WORKER_TOWN_CENTER } from '../world/CANON_DIMENSIONS';
import { uWorldTime } from '../render/WorldClock';

interface FireSpot {
  x: number;
  z: number;
  /** height of the flame above the ground (m) */
  h: number;
  /** flame size scale */
  s: number;
  /** gets its own PointLight */
  lit: boolean;
}

export class Torches {
  readonly group = new Group();
  private lights: PointLight[] = [];
  private readonly uNight = uniform(0);
  count = 0;

  constructor(scene: Object3D, seed: WorldSeed, hf: Heightfield, gi: ProbeGI | null) {
    const rng = seed.rng('torches');
    const tx = WORKER_TOWN_CENTER.x;
    const tz = WORKER_TOWN_CENTER.z;
    const spots: FireSpot[] = [];

    // bakery hearth row — the fires that actually burn all night
    for (let i = 0; i < 9; i++) {
      spots.push({
        x: tx - 95 + i * 11.5,
        z: tz + 32 + (i % 2) * 9,
        h: 0.45,
        s: 1.25,
        lit: i % 3 === 1,
      });
    }
    // gallery street: lamp posts down the lane between the blocks
    for (let i = 0; i < 8; i++) {
      spots.push({
        x: tx - 70 + i * 20 + rng.range(-2, 2),
        z: tz - 96 + rng.range(-1.5, 1.5),
        h: 1.85,
        s: 0.85,
        lit: i % 2 === 0,
      });
    }
    // eastern town courtyards
    for (let i = 0; i < 10; i++) {
      spots.push({
        x: tx + 55 + rng.range(0, 70),
        z: tz - 130 + rng.range(0, 90),
        h: 0.9,
        s: 0.7,
        lit: i % 4 === 0,
      });
    }
    // Wall of the Crow gate: a pair flanking the great gate
    for (const dz of [-6, 6]) {
      spots.push({ x: tx - 168, z: tz - 210 + dz, h: 2.1, s: 1.0, lit: true });
    }
    // harbour: lanterns at the quay head and the pier root
    spots.push({ x: 1245, z: -196, h: 2.0, s: 0.95, lit: true });
    spots.push({ x: 1262, z: -74, h: 2.0, s: 0.95, lit: true });
    // causeway watch fires, halfway up the ramp
    spots.push({ x: 700, z: -166, h: 1.4, s: 1.0, lit: true });
    // (v1.2 I4) the haulers' camp: its hearths burn low through the night
    // (no lights of their own — embers, not lamps)
    for (const [x, z] of CAMP_HEARTHS) spots.push({ x, z, h: 0.05, s: 0.9, lit: false });

    /* --- geometry: post + bowl (solid) and flame (emissive) ---------------- */
    const solid = new GeoWriter();
    const flame = new GeoWriter();
    for (const sp of spots) {
      const gy = hf.heightAtCpu(sp.x, sp.z);
      if (!Number.isFinite(gy)) continue;
      if (sp.h > 1.2) {
        // wooden post under a raised lamp
        solid.box(sp.x, gy - 0.1, sp.z, 0.16, sp.h, 0.16, 0.28, 0.02, rng.float());
      }
      // the bowl / hearth ring
      solid.box(sp.x, gy + sp.h, sp.z, 0.5 * sp.s, 0.16, 0.5 * sp.s, 0.34, 0, rng.float());
      // flame: a small tapered box, strongly battered = a tongue of fire
      const fh = rng.range(0.4, 0.62) * sp.s;
      flame.box(
        sp.x,
        gy + sp.h + 0.12,
        sp.z,
        0.3 * sp.s,
        fh,
        0.3 * sp.s,
        // tone.r carries a per-flame phase so they don't flicker in unison
        rng.float(),
        0.42,
        rng.float() * Math.PI,
      );
      this.count++;
      if (sp.lit && this.lights.length < 14) {
        // decay 2 + a tight distance: a torch lights its own doorway, not the
        // whole town. Range is what keeps the per-fragment light loop cheap.
        const l = new PointLight(0xffb066, 0, 26, 2);
        l.position.set(sp.x, gy + sp.h + 0.35, sp.z);
        l.castShadow = false;
        this.lights.push(l); // added to the scene only after dusk — see setNight
      }
    }

    // posts and bowls are ordinary lit wood/clay (§9: nothing unlit shades
    // the world) — dark timber tone, fine course spacing so a 16 cm post
    // doesn't read as coursed masonry
    const solidMesh = new Mesh(
      solid.build(),
      limestoneMaterial([0.3, 0.23, 0.16], gi, 0.22, 0.3),
    );
    solidMesh.castShadow = true;
    solidMesh.receiveShadow = true;
    this.group.add(solidMesh);

    // the flame itself is EMISSIVE, not unlit-basic: a standard material with
    // a black albedo and an emissive tongue. Emissive is radiance, so it
    // survives the night exposure and drives bloom without being "lit".
    const flameMat = new MeshStandardNodeMaterial();
    flameMat.transparent = true;
    flameMat.depthWrite = false;
    flameMat.blending = AdditiveBlending;
    // per-flame phase rides in the tone attribute (GeoWriter writes the scalar
    // into all three channels) so no two tongues flicker in unison
    const phase = (attribute('tone', 'vec3') as unknown as NV3).x as unknown as NF;
    const flick = sin(uWorldTime.mul(6.3).add(phase.mul(41)))
      .mul(0.18)
      .add(sin(uWorldTime.mul(11.7).add(phase.mul(17))).mul(0.1))
      .add(1);
    // hot core → soot-orange tip, brightest at the base of the tongue
    const up = positionLocal.y.clamp(0, 1);
    const col = mix(vec3(2.6, 1.5, 0.55), vec3(1.5, 0.42, 0.08), up);
    flameMat.colorNode = vec3(0, 0, 0);
    flameMat.emissiveNode = col
      .mul(flick)
      .mul(float(this.uNight).mul(0.93).add(0.07))
      .mul(3.2);
    flameMat.opacityNode = float(this.uNight).mul(0.85).add(0.15);

    const flameMesh = new Mesh(flame.build(), flameMat);
    flameMesh.renderOrder = 6;
    flameMesh.frustumCulled = true;
    this.group.add(flameMesh);
    scene.add(this.group);
  }

  /**
   * Night-ness gate: 0 by day (lights out of the scene, flames dull), 1 after
   * dusk.
   *
   * The lights are ADDED and REMOVED, not just dimmed. A PointLight sitting in
   * the scene at intensity 0 still enters every lit material's per-fragment
   * light loop: 14 of them cost 22 fps at 1440p in the daylight frames of the
   * first battery run (52 → 20-25 fps). Toggling membership makes three
   * rebuild the lighting graph once at dusk, which is a one-off hitch in
   * exchange for the daytime frame back.
   */
  setNight(k: number): void {
    this.uNight.value = k;
    const on = k > 0.02;
    if (on !== this.lightsIn) {
      for (const l of this.lights) {
        if (on) this.group.add(l);
        else this.group.remove(l);
      }
      this.lightsIn = on;
    }
    for (const l of this.lights) l.intensity = 26 * k;
  }

  private lightsIn = false;
}
