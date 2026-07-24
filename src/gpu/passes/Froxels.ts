/**
 * Froxel volumetrics (Phase 7) — work-site dust columns + morning valley
 * mist. Ported from PROJECT LAAS `gpu/passes/Froxels.ts` (MIT, see
 * LICENSE-THIRD-PARTY) and re-aimed at Giza: LAAS's canopy shafts and
 * hydrology fog become the two things that actually hang in this air —
 * the dust a construction site of 20,000 people throws up, and the mist that
 * sits over the flooded basin at first light.
 *
 * A camera-frustum-aligned froxel grid is rebuilt every frame:
 *
 *   SCATTER (per froxel): extinction = ground-hugging valley layer (gated to
 *   the wet floodplain and to LOW SUN — noon owns its distance haze through
 *   the Hillaire aerial term and a global fog there just washes the frame) +
 *   WORK-SITE columns (analytic gaussians at the quarry faces, the haul
 *   corridor, the masons' yards and the town lanes, gated to working hours),
 *   all broken up by wind-advected noise. Sun visibility = a terrain horizon
 *   march plus the cloud shadow map. In-scatter = sun × Henyey–Greenstein
 *   (g = 0.5, forward-leaning so the columns bloom toward the sun) + a
 *   visibility-weighted sky ambient.
 *
 *   INTEGRATE (per screen column): front-to-back walk of the slices with the
 *   closed-form per-slice integral S/σ·(1−e^(−σ·dz)) — exact for a
 *   homogeneous slice, so the coarse far slices carry no thin-slice bias.
 *
 * PostStack samples the integrated texture at each fragment's (screenUV,
 * depth-slice) BEFORE the aerial perspective: local volumetrics under the
 * km-scale haze. Slices are exponential (2 m → 520 m); past that the aerial
 * term owns the ray.
 *
 * Freeze-safe: advection runs on the shared world clock, not TSL `time`.
 */

import { Color, HalfFloatType, Matrix4, Vector3 } from 'three';
import type { DirectionalLight, PerspectiveCamera } from 'three';
import type { ComputeNode, Renderer } from 'three/webgpu';
import { Storage3DTexture } from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  Return,
  exp,
  float,
  instanceIndex,
  mat4,
  smoothstep,
  texture,
  texture3D,
  textureStore,
  uniform,
  uvec3,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { Clouds } from '../../sky/Clouds';
import type { Atmosphere } from '../../sky/Atmosphere';
import type { Heightfield } from '../../world/Heightfield';
import { windU } from '../../render/Wind';
import { uWorldTime } from '../../render/WorldClock';
import { NILE_WATER_Y } from '../../world/WorldConst';
import { QUARRY_KHUFU_CENTER, WORKER_TOWN_CENTER } from '../../world/CANON_DIMENSIONS';
import { PERIOD_FBM } from './NoiseBake';
import { hash13 } from '../noise/NoiseTSL';
import type { NF, NI, NV2, NV3, NV4 } from '../TSLTypes';

const NEAR = 2;
const FAR = 520;

const GRID = {
  low: [96, 54, 32],
  high: [144, 81, 48],
  ultra: [160, 90, 64],
} as const;

/** dust column: centre, radius, strength */
type Column = readonly [number, number, number, number];

export class Froxels {
  /** integrated per-slice (accumulated in-scatter rgb, transmittance a) */
  readonly integTex: Storage3DTexture;
  private readonly scatterTex: Storage3DTexture;
  private readonly scatterK: ComputeNode;
  private readonly integK: ComputeNode;
  private readonly uCamPos = uniform(new Vector3());
  private readonly uProjInv = uniform(new Matrix4());
  private readonly uCamWorld = uniform(new Matrix4());
  private readonly uSunCol = uniform(new Vector3(1, 1, 1));
  /** base density scale (?fog=N) */
  readonly fogK = uniform(1);
  /** work-site dust scale (?dust=N) */
  readonly dustK = uniform(1);
  private readonly fx: number;
  private readonly fy: number;
  private readonly fz: number;

  constructor(
    hf: Heightfield,
    atm: Atmosphere,
    clouds: Clouds | null,
    preset: 'low' | 'high' | 'ultra' = 'high',
  ) {
    const [FX, FY, FZ] = GRID[preset];
    this.fx = FX;
    this.fy = FY;
    this.fz = FZ;
    const q = new URLSearchParams(window.location.search);
    const fogQ = Number(q.get('fog') ?? NaN);
    const dustQ = Number(q.get('dust') ?? NaN);
    if (Number.isFinite(fogQ)) this.fogK.value = fogQ;
    if (Number.isFinite(dustQ)) this.dustK.value = dustQ;

    const mk = (): Storage3DTexture => {
      const t = new Storage3DTexture(FX, FY, FZ);
      t.type = HalfFloatType;
      t.generateMipmaps = false;
      return t;
    };
    this.scatterTex = mk();
    this.integTex = mk();

    const noiseA = hf.noiseA;
    if (!noiseA) throw new Error('froxels need the baked noise textures');

    const qx = QUARRY_KHUFU_CENTER.x;
    const qz = QUARRY_KHUFU_CENTER.z;
    const tx = WORKER_TOWN_CENTER.x;
    const tz = WORKER_TOWN_CENTER.z;
    // the same anchors the work particles emit from — the dust column and the
    // sprite plume have to agree or the plume floats in clear air
    const columns: Column[] = [
      [qx, qz, 95, 1.0],
      [qx - 60, qz - 70, 55, 0.6],
      [qx + 70, qz + 60, 60, 0.55],
      [qx - 30, qz - 170, 65, 0.5], // haul corridor
      [30, 210, 55, 0.4], // ramp head
      [185, 180, 45, 0.35], // masons' yards
      [tx - 60, tz - 210, 70, 0.3], // town lanes
      [tx - 95, tz + 32, 45, 0.35], // bakery row
    ];

    /** exponential slice parameter (0..1) → view distance (m) */
    const sliceDist = (u: NF): NF => float(NEAR).mul(float(FAR / NEAR).pow(u));

    // ---------------- scatter: source + extinction per froxel ----------------
    this.scatterK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(FX * FY * FZ), () => {
        Return();
      });
      const x = i.mod(FX);
      const y = i.div(FX).mod(FY);
      const z = i.div(FX * FY);

      // world ray through the froxel column (mirrors getViewPosition's
      // WebGPU branch: screen-uv y flips into NDC)
      const su = vec2(float(x).add(0.5).div(FX), float(y).add(0.5).div(FY));
      const ndc = vec2(su.x, su.y.oneMinus()).mul(2).sub(1);
      const clip = vec4(ndc.x, ndc.y, 0.5, 1);
      const viewP = mat4(this.uProjInv).mul(clip);
      const dirV = viewP.xyz.div(viewP.w).normalize();
      const dirW = mat4(this.uCamWorld).mul(vec4(dirV, 0)).xyz.normalize().toVar();
      const camPos = vec3(this.uCamPos);

      // jittered sample depth inside the slice hides exp-slice banding
      const jit = hash13(vec3(float(x), float(y), float(z)));
      const dist = sliceDist(float(z).add(jit.mul(0.8).add(0.1)).div(FZ));
      const p = camPos.add(dirW.mul(dist)).toVar();

      const groundY = hf.sampleHeightNearest(p.xz);
      const hAbove = p.y.sub(groundY).max(0);
      const sunDirN = vec3(atm.sunDir).normalize().toVar();

      // --- density (extinction, 1/m) -------------------------------------------
      const drift = vec2(windU.dir as unknown as NV2).mul(uWorldTime.mul(3.2));
      const billow = (texture(noiseA, p.xz.add(drift).div(38 * PERIOD_FBM), 0) as unknown as NV4)
        .y.mul(0.85)
        .add(0.45);

      /* VALLEY MIST — the flooded basin at first light. Gated three ways:
       * to the wet floodplain (height above the water table), to the ground
       * layer, and to LOW SUN. Noon must go near-zero: the Hillaire aerial
       * term already owns daytime distance haze, and stacking a global fog on
       * top only washes the frame out (LAAS learned this the hard way). */
      const wetness = smoothstep(7.0, 0.4, p.y.sub(NILE_WATER_Y).max(0));
      const todK = smoothstep(0.38, 0.03, sunDirN.y).mul(1.9).add(0.06);
      // a tight 9 m scale height makes it read as a LAYER you look across,
      // not a global tint — dawn mist over the basin has a visible top
      const rhoGround = exp(hAbove.div(-9));
      const mist = rhoGround.mul(wetness.mul(wetness).mul(2.4).add(0.04)).mul(todK);

      /* WORK-SITE DUST — analytic gaussian columns over the quarry faces, the
       * haul corridor, the yards and the town. Dust hangs LOW and thins fast
       * with height; it is a working-hours phenomenon, so it fades out with
       * the light rather than sitting over an empty site at midnight. */
      const work = float(0).toVar();
      for (const [cx, cz, r, w] of columns) {
        const d2 = p.xz.sub(vec2(cx, cz)).lengthSq();
        work.addAssign(exp(d2.div(-(r * r))).mul(w));
      }
      // dust hangs ABOVE the workings — a thick layer at eye level reads as
      // a fog bank, not as stone dust rising off a quarry floor
      const dustHeight = exp(hAbove.div(-22)).mul(smoothstep(0, 11, hAbove).mul(0.85).add(0.15));
      const working = smoothstep(-0.02, 0.12, sunDirN.y);
      const dust = work
        .mul(dustHeight)
        .mul(working)
        .mul(float(this.dustK))
        .mul(0.28); // 1.35 buried the quarry bowl; 0.5 still fogged eye level

      const rho = float(this.fogK)
        .mul(billow)
        .mul(mist.add(dust))
        .mul(0.0088)
        .toVar();

      // --- sun visibility --------------------------------------------------------
      const vis = float(1).toVar();
      // terrain horizon: log-spaced probes along the sun ray. The escarpment
      // and the pyramid's own bulk are what carve the columns into shafts.
      for (const dSun of [12, 34, 85, 200, 460]) {
        const s = p.add(sunDirN.mul(dSun));
        vis.mulAssign(smoothstep(-10, 2, s.y.sub(hf.sampleHeightNearest(s.xz))));
      }
      if (clouds) vis.mulAssign(clouds.shadowAt(p.xz));

      // --- in-scatter source -----------------------------------------------------
      const g = 0.5; // forward-leaning HG: columns bloom toward the sun
      const cosT = dirW.dot(sunDirN);
      const phase = float((1 - g * g) / (4 * Math.PI)).div(
        float(1 + g * g).sub(cosT.mul(2 * g)).pow(1.5),
      );
      const sunCol = vec3(this.uSunCol);
      // ambient in-scatter mostly follows sun visibility: a flat term lifts
      // blacks across the whole frame; shadowed dust should sit DARK so the
      // lit columns have something to read against
      const amb = atm
        .skyColor(vec3(0, 1, 0) as unknown as NV3)
        .mul(0.02)
        .mul(vis.mul(0.6).add(0.4));
      const src = sunCol.mul(phase).mul(vis).add(amb).mul(rho);
      textureStore(
        this.scatterTex,
        uvec3(x.toUint(), y.toUint(), z.toUint()),
        vec4(src, rho),
      ).toWriteOnly();
    })().compute(FX * FY * FZ);
    this.scatterK.setName('froxelScatter');

    // ---------------- integrate: front-to-back per screen column ----------------
    this.integK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(FX * FY), () => {
        Return();
      });
      const x = i.mod(FX);
      const y = i.div(FX);
      const T = float(1).toVar();
      const L = vec3(0, 0, 0).toVar();
      Loop(FZ, ({ i: k }: { readonly i: NI }) => {
        const u0 = float(k).div(FZ);
        const u1 = float(k).add(1).div(FZ);
        const dz = sliceDist(u1).sub(sliceDist(u0));
        const uvw = vec3(
          float(x).add(0.5).div(FX),
          float(y).add(0.5).div(FY),
          float(k).add(0.5).div(FZ),
        );
        const s = texture3D(this.scatterTex, uvw, 0) as unknown as NV4;
        const Ts = exp(s.a.mul(dz).negate());
        const Li = s.rgb.div(s.a.max(1e-6)).mul(float(1).sub(Ts));
        L.addAssign(Li.mul(T));
        T.mulAssign(Ts);
        textureStore(
          this.integTex,
          uvec3(x.toUint(), y.toUint(), k.toUint()),
          vec4(L, T),
        ).toWriteOnly();
      });
    })().compute(FX * FY);
    this.integK.setName('froxelIntegrate');
    void this.fx;
    void this.fy;
    void this.fz;
  }

  /** per frame, before the scene pass */
  update(renderer: Renderer, camera: PerspectiveCamera, sun: DirectionalLight): void {
    this.uCamPos.value.copy(camera.position);
    this.uProjInv.value.copy(camera.projectionMatrixInverse);
    this.uCamWorld.value.copy(camera.matrixWorld);
    const c = sun.color as Color;
    (this.uSunCol.value as Vector3).set(
      c.r * sun.intensity,
      c.g * sun.intensity,
      c.b * sun.intensity,
    );
    renderer.compute(this.scatterK);
    renderer.compute(this.integK);
  }

  /** composite: volumetrics applied to a fragment colour (dist in metres) */
  apply(col: NV3, dist: NF, screenUV: NV2): NV3 {
    const w = dist
      .max(NEAR)
      .div(NEAR)
      .log2()
      .div(Math.log2(FAR / NEAR))
      .clamp(0, 1);
    const fr = texture3D(
      this.integTex,
      vec3(screenUV.x, screenUV.y, w),
      0,
    ) as unknown as NV4;
    return col.mul(fr.a).add(fr.rgb);
  }
}
