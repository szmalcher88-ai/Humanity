/**
 * NileWater — the flowing river + harbor stage (Phase 5 v1).
 *
 * One material drives both sheets:
 *  - flow-advected ripple normals (two scales, drifting NORTH — the Nile
 *    flows toward −Z; harbor water drifts slower)
 *  - TRUE sky reflection: fresnel (on a flattened normal — LAAS lesson:
 *    full ripple normals saturate Schlick into a white sheet) mixed over
 *    depth-absorbed water color; the sun's glint comes from the material's
 *    own specular response
 *  - depth from the REAL riverbed (heightfield sample): shallow margins
 *    tint silty green-brown, the channel core goes deep blue-green
 * Freeze-deterministic: advection runs on engine worldTime.
 */

import { Mesh, PlaneGeometry } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  cameraPosition,
  clamp,
  float,
  mix,
  normalize,
  positionWorld,
  reflect,
  smoothstep,
  texture,
  transformNormalToView,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import type { Atmosphere } from '../sky/Atmosphere';
import type { Heightfield } from '../world/Heightfield';
import type { NV3 } from '../gpu/TSLTypes';
import { PERIOD_FBM } from '../gpu/passes/NoiseBake';
import { NILE_WATER_Y, TERRAIN_CZ } from '../world/WorldConst';
import { CANALS, CANAL_TOP_HALF } from '../world/Irrigation';

export class NileWater {
  readonly meshes: Mesh[] = [];
  private uTime = uniform(0);

  constructor(hf: Heightfield, atmosphere: Atmosphere) {
    const noiseA = hf.noiseA as NonNullable<typeof hf.noiseA>;

    const mkMaterial = (flowSpeed: number, waveK = 1): MeshPhysicalNodeMaterial => {
      const m = new MeshPhysicalNodeMaterial();
      const wxz = positionWorld.xz;
      const t = float(this.uTime);

      // --- ripple normal: two advected gradient fetches ---------------------
      // flow toward −z (north); cross-drift breaks the lattice.
      // waveK scales the WAVELENGTH: the sheltered harbor basin has no fetch,
      // so it carries short choppy wavelets, not the river's long swell.
      const flow1 = vec2(0.03, -1).normalize().mul(t.mul(flowSpeed));
      const flow2 = vec2(-0.22, -1).normalize().mul(t.mul(flowSpeed * 0.62));
      const g1 = texture(noiseA, wxz.add(flow1).div(0.11 * waveK * PERIOD_FBM)).ba;
      const g2 = texture(noiseA, wxz.add(flow2).div(0.043 * waveK * PERIOD_FBM)).ba;
      const grad = g1.mul(0.65).add(g2.mul(0.35)).mul(0.14);
      const n = normalize(vec3(grad.x.negate(), 1, grad.y.negate()));
      // flattened normal for fresnel (steep ripple normals → white sheet)
      const nFlat = normalize(vec3(grad.x.negate().mul(0.35), 1, grad.y.negate().mul(0.35)));

      // --- depth from the real bed ------------------------------------------
      const bed = hf.sampleHeight(wxz);
      const depth = float(NILE_WATER_Y).sub(bed).max(0);

      // --- water body color --------------------------------------------------
      const silty = vec3(0.1, 0.14, 0.1);
      const deep = vec3(0.015, 0.05, 0.06);
      const body = mix(silty, deep, smoothstep(0.3, 3.5, depth));

      // --- sky reflection ----------------------------------------------------
      const view = normalize(positionWorld.sub(cameraPosition));
      // reflection direction takes MORE of the ripple than the fresnel term
      // does: flattening both (LAAS's white-sheet fix) made the sheet a
      // perfect mirror — a dawn river streaks and breaks up the far shore.
      // Fresnel keeps the flattened normal; only the sampled direction wobbles.
      const nRefl = normalize(vec3(grad.x.negate().mul(0.75), 1, grad.y.negate().mul(0.75)));
      const rdir = reflect(view, nRefl);
      const rdirUp = vec3(rdir.x, rdir.y.abs().max(0.02), rdir.z);
      const sky = atmosphere.skyFull(rdirUp as unknown as NV3);
      const cosV = clamp(view.negate().dot(nFlat), 0, 1);
      const fresnel = float(0.02).add(
        float(0.98).mul(float(1).sub(cosV).pow(5)),
      );

      /* --- LOW-SUN GLINT (Phase 7) -------------------------------------------
       * The dawn frame's water read DEAD BLACK, and the cause was an energy
       * bookkeeping error, not a missing highlight: the mirror reflection was
       * fed in as ALBEDO (`colorNode`), so it was multiplied AGAIN by the
       * scene lighting. At noon that is invisible; at dawn the sun term is
       * ~0.2 and dimmed hemisphere ambient is all that is left, so the sky
       * reflection — the thing that should carry the whole surface — was
       * scaled to nothing. Reflected radiance is radiance: it belongs in
       * emissive, unlit.
       *
       * On top of it, an explicit Blinn glint lobe. The GGX response to the
       * DirectionalLight cannot draw a sun road: at 1 km one ripple is far
       * below a pixel, the normal map averages flat, and the highlight
       * collapses to an aliased sliver. Widening the lobe with distance is
       * the cheap stand-in for that lost sub-pixel normal variance (LEAN
       * mapping's idea): near field stays a tight sparkle, the far field
       * opens into the broad shimmering road low sun always makes.
       */
      const camD = positionWorld.sub(cameraPosition).length();
      const L = normalize(vec3(atmosphere.sunDir));
      const H = normalize(view.negate().add(L));
      const wide = smoothstep(60, 1200, camD);
      const shin = mix(float(1200), float(70), wide);
      const lobe = clamp(n.dot(H), 0, 1).pow(shin);
      // glitter: a fine, fast-advected octave breaks the road into sparkle
      // instead of a smooth airbrushed streak
      const spark = texture(
        noiseA,
        wxz.add(vec2(0.4, -1).normalize().mul(t.mul(flowSpeed * 1.7)))
          .div(0.012 * waveK * PERIOD_FBM),
      ).x;
      const glitter = spark.mul(1.5).add(0.45);
      // the sun's own colour at the surface — a white highlight in a dawn
      // frame is the giveaway of a faked glint
      const sunRad = atmosphere.sunRadiance();
      const sunUp = smoothstep(-0.03, 0.05, L.y);
      const glint = sunRad
        .mul(lobe.mul(glitter))
        .mul(fresnel.mul(3).add(0.2))
        .mul(sunUp)
        .mul(1.6);
      // turbidity floor: silt scatters the sky dome back out, so even water
      // facing away from every light source is never black (no-black law)
      const dome = atmosphere.skyFull(vec3(0, 1, 0) as unknown as NV3);

      m.colorNode = body;
      m.emissiveNode = sky
        .mul(fresnel.clamp(0, 0.9))
        .add(glint)
        .add(body.mul(dome).mul(0.5));
      m.normalNode = transformNormalToView(n);
      m.roughnessNode = float(0.09).add(smoothstep(1.2, 0.05, depth).mul(0.1));
      m.metalnessNode = float(0);
      m.specularIntensity = 1.0;
      m.polygonOffset = true;
      m.polygonOffsetFactor = 2;
      m.polygonOffsetUnits = 8;
      return m;
    };

    const river = new Mesh(new PlaneGeometry(700, 4600, 8, 60), mkMaterial(0.55));
    river.rotateX(-Math.PI / 2);
    river.position.set(2050, NILE_WATER_Y, TERRAIN_CZ);
    river.receiveShadow = true;
    this.meshes.push(river);

    const harbor = new Mesh(new PlaneGeometry(950, 560, 12, 8), mkMaterial(0.12, 0.42));
    harbor.rotateX(-Math.PI / 2);
    harbor.position.set(1330, NILE_WATER_Y, -130);
    harbor.receiveShadow = true;
    this.meshes.push(harbor);

    // (v1.2 I4) the irrigation canals: still water at the river's own low
    // stage — they are cut below it and open to it (Irrigation.ts), so this
    // is the river standing in them, not a level chosen by eye. Each sheet
    // runs from the canal's blind west end to the river sheet's west edge
    // (x 1700); beyond it the river sheet already lies at the same level.
    const RIVER_W_EDGE = 2050 - 700 / 2;
    const still = mkMaterial(0.035, 0.3);
    for (const c of CANALS) {
      const xa = c.x0 - CANAL_TOP_HALF;
      const len = RIVER_W_EDGE - xa;
      const sheet = new Mesh(new PlaneGeometry(len, CANAL_TOP_HALF * 2 + 1, Math.ceil(len / 40), 1), still);
      sheet.rotateX(-Math.PI / 2);
      sheet.position.set(xa + len / 2, NILE_WATER_Y, c.z);
      sheet.receiveShadow = true;
      sheet.name = 'canal-water';
      this.meshes.push(sheet);
    }
  }

  /** advance flow (call with engine worldTime — freeze-safe) */
  tick(worldTime: number): void {
    this.uTime.value = worldTime;
  }
}
