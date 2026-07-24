/**
 * Volumetric clouds — 2-layer raymarched Worley–Perlin density field:
 *  - 3D noise textures baked by compute (base 96³ perlin-worley, detail 32³)
 *  - cumulus layer in an altitude band that sits BELOW the high summits so
 *    vistas can look across/down onto cloud tops (reference: Witcher frame)
 *  - half-res raymarch in the post chain with temporal blue-noise jitter,
 *    Beer–Powder lighting, HG phase toward the sun, ambient from the sky LUT
 *  - cloud shadows: a top-down transmittance map sampled by the terrain
 *    material and the light shaft pass
 */

import { HalfFloatType, RedFormat, RepeatWrapping, Vector2 } from 'three';
import type { Renderer } from 'three/webgpu';
import { Storage3DTexture, StorageTexture } from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  Return,
  clamp,
  exp,
  float,
  instanceIndex,
  mix,
  mx_fractal_noise_float,
  mx_worley_noise_float,
  pow,
  smoothstep,
  texture,
  texture3D,
  textureStore,
  uniform,
  uvec2,
  uvec3,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { NF, NI, NV2, NV3 } from '../gpu/TSLTypes';
import { windU } from '../render/Wind';
import { WORLD_SIZE } from '../world/WorldConst';
import type { Atmosphere } from './Atmosphere';
import { SUN_E } from './Atmosphere';

const BASE_RES = 96;
const DETAIL_RES = 32;
const SHADOW_RES = 768;
const WEATHER_RES = 512;
/** weather field world span (m) — tiles beyond this, far past the playable area */
const WEATHER_WORLD = 26000;
/** cloud layer altitudes (m) — below the ~2000 m summits */
export const CLOUD_BOTTOM = 1250;
export const CLOUD_TOP = 1900;
const SHADOW_WORLD = WORLD_SIZE * 1.6;
/** cirrus deck altitude (m ASL) and streak span (m) */
const CIRRUS_H = 6200;
const CIRRUS_SPAN = 34000;

export class Clouds {
  readonly baseNoise: Storage3DTexture;
  readonly detailNoise: Storage3DTexture;
  /** r: weather/coverage field (baked 3-oct fbm — hot path in the march) */
  readonly weatherMap: StorageTexture;
  /** r: transmittance toward the sun through the layer, top-down */
  readonly shadowMap: StorageTexture;
  // Egyptian sky (canon Vol. III: clouds are rare — clear sky, occasional
  // thin cirrus, sparse fair-weather cumulus): seasoning, not cover
  readonly coverage = uniform(0.22);
  readonly density = uniform(0.85);
  /** cirrus opacity scale — seasoning, not cover (?cirrus=0 to ablate) */
  cirrusAmount = 0.36;
  private atmosphere: Atmosphere;
  private shadowKernel: Parameters<Renderer['computeAsync']>[0] | null = null;
  /** ?cloudflat=1 — constant density slab, bypasses noise textures (bisect) */
  private flatDebug = false;
  /**
   * Weather motion (Phase 6 / Pillar F "clouds evolve"): the whole field
   * translates downwind at cloud-layer speed; the detail erosion drifts
   * 1.35× faster, so masses churn instead of sliding as a rigid sheet.
   * CPU-owned clock (uniform) so the periodic shadow re-bake and the live
   * lookup agree exactly.
   */
  private readonly uTime = uniform(0);
  private readonly uDriftBase = uniform(new Vector2());
  private timeAcc = 0;
  private lastBakeT = -1e9;
  private readonly DRIFT_V = 22; // m/s at the cloud layer

  constructor(atmosphere: Atmosphere) {
    this.atmosphere = atmosphere;
    // tuning overrides: ?cov=0.6&cdens=1.2
    const q = new URLSearchParams(window.location.search);
    const covQ = Number(q.get('cov') ?? NaN);
    const densQ = Number(q.get('cdens') ?? NaN);
    if (Number.isFinite(covQ)) this.coverage.value = covQ;
    if (Number.isFinite(densQ)) this.density.value = densQ;
    const cirQ = Number(q.get('cirrus') ?? NaN);
    if (Number.isFinite(cirQ)) this.cirrusAmount = cirQ;
    this.flatDebug = q.get('cloudflat') === '1';
    this.baseNoise = new Storage3DTexture(BASE_RES, BASE_RES, BASE_RES);
    this.baseNoise.type = HalfFloatType;
    this.baseNoise.format = RedFormat;
    this.detailNoise = new Storage3DTexture(DETAIL_RES, DETAIL_RES, DETAIL_RES);
    this.detailNoise.type = HalfFloatType;
    this.detailNoise.format = RedFormat;
    /* SHARD FIX (Phase 7): the density lookups wrapped their domain with
     * `.fract()`. fract() is discontinuous at the wrap — the sampler never
     * interpolates ACROSS the boundary, so every 420 m (detail) and 3600 m
     * (base) the field jumped to an unrelated value along a perfectly flat
     * plane. Those planes cut the cumulus into the pale straight-edged shards
     * the user saw at oblique angles (present in the fix-decks too, so they
     * predate Phase 6). Hardware RepeatWrapping interpolates the last texel
     * into the first, and the detail bake below is made properly periodic. */
    for (const t of [this.baseNoise, this.detailNoise]) {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.wrapR = RepeatWrapping;
    }
    this.shadowMap = new StorageTexture(SHADOW_RES, SHADOW_RES);
    this.shadowMap.type = HalfFloatType;
    this.shadowMap.generateMipmaps = false;
    this.weatherMap = new StorageTexture(WEATHER_RES, WEATHER_RES);
    this.weatherMap.type = HalfFloatType;
    this.weatherMap.generateMipmaps = false;
    // same wrap story as the 3D noise: fract() on the lookup cut a hard
    // straight seam across the sky wherever the weather domain wrapped
    this.weatherMap.wrapS = RepeatWrapping;
    this.weatherMap.wrapT = RepeatWrapping;
  }

  async init(renderer: Renderer): Promise<void> {
    // --- base: perlin-worley remap (tileable enough via domain fract) --------
    const N = BASE_RES;
    const baseK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(N * N * N), () => {
        Return();
      });
      const x = i.mod(N);
      const y = i.div(N).mod(N);
      const z = i.div(N * N);
      const p = vec3(float(x), float(y), float(z)).add(0.5).div(N);
      const pw = p.mul(4);
      const perlin = mx_fractal_noise_float(pw.mul(2), 4, 2.0, 0.55, 1).mul(0.5).add(0.5);
      const w0 = float(1).sub(clamp(mx_worley_noise_float(pw, 1), 0, 1));
      const w1 = float(1).sub(clamp(mx_worley_noise_float(pw.mul(2.03).add(19.7), 1), 0, 1));
      const w2 = float(1).sub(clamp(mx_worley_noise_float(pw.mul(4.01).add(47.3), 1), 0, 1));
      const wfbm = w0.mul(0.625).add(w1.mul(0.25)).add(w2.mul(0.125));
      // remap perlin by worley (Schneider-style perlin-worley)
      const pwv = clamp(perlin.sub(wfbm.oneMinus()).div(wfbm.max(1e-3)), 0, 1);
      textureStore(this.baseNoise, uvec3(x.toUint(), y.toUint(), z.toUint()), vec4(pwv, 0, 0, 1)).toWriteOnly();
    })().compute(N * N * N);
    baseK.setName('cloudBaseNoise');
    await renderer.computeAsync(baseK);

    const M = DETAIL_RES;
    const detailK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(M * M * M), () => {
        Return();
      });
      const x = i.mod(M);
      const y = i.div(M).mod(M);
      const z = i.div(M * M);
      const p = vec3(float(x), float(y), float(z)).add(0.5).div(M);
      // PERIODIC bake: worley isn't tileable, so blend the 8 unit-shifted
      // copies with trilinear corner weights — h(0) ≡ h(1) on every axis, and
      // the erosion field crosses its own wrap without a discontinuity. Only
      // affordable on the 32³ detail texture (8× the noise work); the 96³
      // base relies on hardware repeat and a 3.6 km period.
      const octave = (q: NV3): NF => {
        const a = float(1).sub(clamp(mx_worley_noise_float(q.mul(3), 1), 0, 1));
        const b = float(1).sub(clamp(mx_worley_noise_float(q.mul(6.02).add(7.7), 1), 0, 1));
        return a.mul(0.65).add(b.mul(0.35));
      };
      const d = float(0).toVar();
      for (const [ox, oy, oz] of [
        [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
        [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
      ] as const) {
        const wx = ox === 0 ? p.x.oneMinus() : p.x;
        const wy = oy === 0 ? p.y.oneMinus() : p.y;
        const wz = oz === 0 ? p.z.oneMinus() : p.z;
        d.addAssign(octave(p.add(vec3(ox, oy, oz))).mul(wx).mul(wy).mul(wz));
      }
      textureStore(this.detailNoise, uvec3(x.toUint(), y.toUint(), z.toUint()), vec4(d, 0, 0, 1)).toWriteOnly();
    })().compute(M * M * M);
    detailK.setName('cloudDetailNoise');
    await renderer.computeAsync(detailK);

    // --- weather field bake (wraps at WEATHER_WORLD) ---------------------------
    const W = WEATHER_RES;
    const weatherK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(W * W), () => {
        Return();
      });
      const x = i.mod(W);
      const y = i.div(W);
      const uv01 = vec2(float(x).add(0.5), float(y).add(0.5)).div(W);
      // periodic domain via worley/fractal over a wrapped circle would cost
      // more than it buys at this span; sample fbm directly (seam is 26 km out)
      const wUv = uv01.sub(0.5).mul(WEATHER_WORLD / 5200);
      const v = mx_fractal_noise_float(wUv, 3, 2.2, 0.5, 1).mul(0.5).add(0.5);
      textureStore(this.weatherMap, uvec2(x.toUint(), y.toUint()), vec4(v, 0, 0, 1)).toWriteOnly();
    })().compute(W * W);
    weatherK.setName('cloudWeather');
    await renderer.computeAsync(weatherK);

    // --- cloud shadow map kernel (re-run on sun/ToD change) -------------------
    const S = SHADOW_RES;
    const shadowK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(S * S), () => {
        Return();
      });
      const x = i.mod(S);
      const y = i.div(S);
      const wpos = vec2(float(x).add(0.5), float(y).add(0.5))
        .div(S)
        .sub(0.5)
        .mul(SHADOW_WORLD);
      // march vertically through the layer, accumulate optical depth; the
      // sun-angle offset is approximated by shifting with the sun direction
      const sunDir = this.atmosphere.sunDir;
      const STEPS = 20;
      const dh = (CLOUD_TOP - CLOUD_BOTTOM) / STEPS;
      const tau = float(0).toVar();
      Loop(STEPS, ({ i: si }: { readonly i: NI }) => {
        const h = float(si).add(0.5).mul(dh).add(CLOUD_BOTTOM);
        // shift sample along the sun's horizontal direction as we ascend
        const k = h.sub(CLOUD_BOTTOM).div(sunDir.y.abs().max(0.15));
        const sp = wpos.add(vec2(sunDir.x, sunDir.z).mul(k).negate());
        tau.addAssign(this.sampleDensity(vec3(sp.x, h, sp.y), false, true).mul(dh));
      });
      const trans = exp(tau.mul(-0.045));
      textureStore(this.shadowMap, uvec2(x.toUint(), y.toUint()), vec4(trans, 0, 0, 1)).toWriteOnly();
    })().compute(S * S);
    shadowK.setName('cloudShadowMap');
    this.shadowKernel = shadowK;
    await renderer.computeAsync(shadowK);
  }

  /** re-bake the shadow map (call after sun changes) */
  async refreshShadow(renderer: Renderer): Promise<void> {
    this.uDriftBase.value
      .set(windU.dir.value.x, windU.dir.value.y)
      .multiplyScalar(this.timeAcc * this.DRIFT_V);
    this.lastBakeT = this.timeAcc;
    if (this.shadowKernel) await renderer.computeAsync(this.shadowKernel);
  }

  /** per-frame: advance the weather clock; re-bake the drifted shadow ~2.5 s */
  tick(renderer: Renderer, dt: number): void {
    this.timeAcc += dt;
    this.uTime.value = this.timeAcc;
    if (this.timeAcc - this.lastBakeT > 2.5 && this.shadowKernel) {
      this.uDriftBase.value
        .set(windU.dir.value.x, windU.dir.value.y)
        .multiplyScalar(this.timeAcc * this.DRIFT_V);
      this.lastBakeT = this.timeAcc;
      renderer.compute(this.shadowKernel as Parameters<Renderer['compute']>[0]);
    }
  }

  /** downwind translation of the cloud field at time t (m) */
  private driftAt(t: NF): NV2 {
    return vec2(windU.dir as unknown as NV2).mul(t.mul(this.DRIFT_V));
  }

  /**
   * cloud density at a world position (m). detail=false for the shadow
   * march. `frozen=true` bakes with the drift FIXED at uDriftBase (the
   * shadow map re-bakes every few seconds; shadowAt applies the residual).
   */
  sampleDensity(wp: NV3, detail: boolean, frozen = false): NF {
    const hNorm = wp.y.sub(CLOUD_BOTTOM).div(CLOUD_TOP - CLOUD_BOTTOM);
    const inLayer = smoothstep(0, 0.12, hNorm).mul(smoothstep(1, 0.55, hNorm));
    if (this.flatDebug) return inLayer.mul(0.3).mul(float(this.density));
    const drift = frozen
      ? (vec2(this.uDriftBase) as unknown as NV2)
      : this.driftAt(this.uTime as unknown as NF);
    const xz = wp.xz.sub(drift);
    // weather/coverage field: large-scale variation breaks the layer into
    // cumulus masses with clear lanes (baked texture — fbm here was the
    // hottest math in the march: 40 steps × 4 sun taps × 3 octaves)
    const wUv = xz.div(WEATHER_WORLD).add(0.5);
    // contrast-stretch: raw fbm hovers near 0.5 — dense cores + clear lanes
    const weather = smoothstep(0.3, 0.78, texture(this.weatherMap, wUv, 0).x);
    const cov = clamp(weather.sub(float(1).sub(float(this.coverage))), 0, 1).mul(2.2);
    // no .fract(): RepeatWrapping does the wrap AND interpolates across it
    const base = texture3D(this.baseNoise, vec3(xz.x, wp.y, xz.y).div(3600), 0).x;
    let dens = clamp(base.mul(cov).sub(float(0.32).mul(hNorm.add(0.45))), 0, 1).mul(inLayer);
    if (detail) {
      // detail erodes at a different drift rate — shapes churn, not slide
      const drift2 = frozen
        ? (vec2(this.uDriftBase) as unknown as NV2)
        : this.driftAt((this.uTime as unknown as NF).mul(1.35));
      const xz2 = wp.xz.sub(drift2);
      const det = texture3D(this.detailNoise, vec3(xz2.x, wp.y, xz2.y).div(420), 0).x;
      dens = clamp(dens.sub(det.mul(0.22).mul(float(1).sub(dens))), 0, 1);
    }
    return dens.mul(float(this.density));
  }

  /** sample the top-down cloud shadow transmittance at a world xz */
  shadowAt(wxz: NV2): NF {
    // shift by the drift accumulated since the last shadow bake (kept ≤ a
    // few seconds by tick() — the offset never nears the map border)
    const resid = this.driftAt(this.uTime as unknown as NF).sub(
      vec2(this.uDriftBase) as unknown as NV2,
    );
    const uv = wxz.sub(resid).div(SHADOW_WORLD).add(0.5);
    const inside = smoothstep(0.0, 0.02, uv.x)
      .mul(smoothstep(1.0, 0.98, uv.x))
      .mul(smoothstep(0.0, 0.02, uv.y))
      .mul(smoothstep(1.0, 0.98, uv.y));
    /* SOFTNESS (Phase 7): a cloud shadow edge on the ground is never sharp —
     * the sun is a half-degree disc and the caster sits 1.3 km up, so the
     * penumbra is ~11 m wide before any cloud-edge fuzz. One bilinear tap of
     * an 8.3 m/texel map gave a hard-edged stencil sliding over the plateau.
     * A 5-tap cross at ±2.5 texels costs 4 extra fetches on an already
     * texture-cheap path and lands close to that real penumbra. */
    const r = 2.5 / SHADOW_RES;
    const c = clamp(uv, 0, 1);
    const t = texture(this.shadowMap, c)
      .x.mul(0.36)
      .add(texture(this.shadowMap, clamp(c.add(vec2(r, 0)), 0, 1)).x.mul(0.16))
      .add(texture(this.shadowMap, clamp(c.sub(vec2(r, 0)), 0, 1)).x.mul(0.16))
      .add(texture(this.shadowMap, clamp(c.add(vec2(0, r)), 0, 1)).x.mul(0.16))
      .add(texture(this.shadowMap, clamp(c.sub(vec2(0, r)), 0, 1)).x.mul(0.16));
    return mix(float(1), t, inside);
  }

  /**
   * Raymarch the cloud layer for a view ray; returns rgb radiance + alpha.
   * Designed to run in the post chain after the scene (composited by depth).
   */
  march(camPos: NV3, dir: NV3, maxDistM: NF, jitter: NF): { color: NV3; alpha: NF } {
    const sunDir = this.atmosphere.sunDir.normalize();

    // ray-layer intersection (horizontal slab)
    const t0 = float(CLOUD_BOTTOM).sub(camPos.y).div(dir.y);
    const t1 = float(CLOUD_TOP).sub(camPos.y).div(dir.y);
    const tEnterRaw = t0.min(t1);
    const tExitRaw = t0.max(t1);
    const inside = camPos.y.greaterThan(CLOUD_BOTTOM).and(camPos.y.lessThan(CLOUD_TOP));
    const tEnter = inside.select(float(0), tEnterRaw.max(0));
    // STEP-LENGTH CLAMP (Phase 7): near the horizon the slab chord runs to the
    // 26 km cap, so 32 steps meant 800 m per sample — the march skipped whole
    // cloud masses and printed hard blocky edges that TRAA smeared into pale
    // shards. Capping the marched span keeps the step ≤ ~280 m; everything cut
    // off is behind ~9 km of cloud layer and already transmittance-saturated.
    const tExit = tExitRaw.min(maxDistM).min(26000).min(tEnter.add(9000));

    const valid = tExit.greaterThan(tEnter).and(dir.y.abs().greaterThan(1e-4));

    const STEPS = 32;
    const seg = tExit.sub(tEnter).div(STEPS);
    const trans = float(1).toVar();
    const light = vec3(0).toVar();
    const ambient = this.atmosphere
      .skyColor(vec3(dir.x, dir.y.abs().max(0.25), dir.z))
      .mul(0.5)
      .add(this.atmosphere.skyColor(dir).mul(0.5));
    const nu = dir.dot(sunDir);
    // dual-lobe HG
    const g1 = 0.62;
    const g2 = -0.18;
    const hg = (g: number): NF => {
      const gg = g * g;
      return float((1 - gg) / (4 * Math.PI)).div(
        pow(float(1 + gg).sub(nu.mul(2 * g)), 1.5),
      );
    };
    // isotropic floor ≈ multiple scattering (clouds are never phase-black)
    const phase = hg(g1).mul(0.75).add(hg(g2).mul(0.25)).add(0.14);
    const sunT = this.atmosphere.sampleTransmittance(float(6360.35), clamp(sunDir.y, -1, 1));
    // NIGHT: below the horizon the transmittance LUT still returns a deep-red
    // residual, which lit the cumulus deck like embers at midnight. Gate the
    // sun term and hand the deck to the moon instead — a cloud at night is a
    // dark shape with a pale moonlit top, never a red one.
    const sunUpK = smoothstep(-0.06, 0.04, sunDir.y);
    const nightK = sunUpK.oneMinus();
    const moonLit = vec3(0.5, 0.58, 0.78).mul(nightK).mul(0.05);

    If(valid, () => {
      Loop(STEPS, ({ i: si }: { readonly i: NI }) => {
        const t = tEnter.add(float(si).add(jitter).mul(seg));
        const sp = camPos.add(dir.mul(t));
        const dens = this.sampleDensity(sp, true);
        If(dens.greaterThan(0.002), () => {
          // cheap sun occlusion: 3 coarse steps toward the sun
          const lTau = float(0).toVar();
          for (let ls = 1; ls <= 3; ls++) {
            const lp = sp.add(sunDir.mul(ls * 165));
            lTau.addAssign(this.sampleDensity(lp, false).mul(165));
          }
          const sunVis = exp(lTau.mul(-0.04));
          const powder = float(1).sub(exp(dens.mul(-22)));
          // ambient sees less sky toward the cloud base
          const hn = clamp(
            sp.y.sub(CLOUD_BOTTOM).div(CLOUD_TOP - CLOUD_BOTTOM),
            0,
            1,
          );
          // source radiance: sun (phase-weighted, self-occluded) + sky ambient
          const S = sunT
            .mul(sunVis)
            .mul(phase)
            .mul(SUN_E * 3.4)
            .mul(sunUpK)
            .add(moonLit.mul(sunVis))
            .add(ambient.mul(hn.mul(0.55).add(0.45)).mul(0.38))
            .mul(powder.mul(0.75).add(0.25));
          const stepT = exp(dens.mul(seg).mul(-0.052));
          light.addAssign(S.mul(trans).mul(float(1).sub(stepT)));
          trans.mulAssign(stepT);
        });
      });
    });
    /* --- CIRRUS (canon Vol. III: "clear sky, occasional thin cirrus") -------
     * A single ray-plane hit at 6.2 km, not a march: cirrus is optically thin
     * and one slab sample is indistinguishable from integrating through it.
     * Wispiness comes from sampling the weather fbm with a strongly
     * ANISOTROPIC scale — stretched along the wind, so the streaks lie the way
     * wind-sheared ice actually lies instead of reading as fluffy cumulus. It
     * sits ABOVE the cumulus deck, so it composites BEHIND it.
     */
    const cirrus = this.cirrus(camPos, dir, maxDistM, sunT);
    const cumA = float(1).sub(trans);
    return {
      color: light.add(cirrus.color.mul(trans)),
      alpha: cumA.add(cirrus.alpha.mul(trans)),
    };
  }

  /** thin high ice layer — one slab sample, premultiplied */
  private cirrus(camPos: NV3, dir: NV3, maxDistM: NF, sunT: NV3): { color: NV3; alpha: NF } {
    const sunDir = this.atmosphere.sunDir.normalize();
    const tc = float(CIRRUS_H).sub(camPos.y).div(dir.y);
    const hit = dir.y.greaterThan(0.012).and(tc.lessThan(maxDistM)).and(tc.greaterThan(0));
    const p = camPos.xz.add(dir.xz.mul(tc.max(0)));
    // high-altitude wind runs faster than the cumulus deck and shears the
    // streaks: 2.4× drift, and the sample domain is squashed 5:1 across wind
    const drift = this.driftAt((this.uTime as unknown as NF).mul(2.4));
    const w = vec2(windU.dir as unknown as NV2);
    const q = p.sub(drift);
    const along = q.x.mul(w.x).add(q.y.mul(w.y));
    const across = q.x.mul(w.y.negate()).add(q.y.mul(w.x));
    const uv = vec2(along.div(5.5), across).div(CIRRUS_SPAN).add(0.5);
    const f0 = texture(this.weatherMap, uv, 0).x;
    const f1 = texture(this.weatherMap, uv.mul(3.1).add(0.37), 0).x;
    // large-scale patch mask: canon calls for OCCASIONAL cirrus, and a single
    // stretched octave otherwise bands the whole dome edge to edge
    const patch = smoothstep(
      0.42,
      0.72,
      texture(this.weatherMap, q.div(CIRRUS_SPAN * 0.55).add(vec2(0.61, 0.19)), 0).x,
    );
    const veil = smoothstep(0.5, 0.95, f0.mul(0.68).add(f1.mul(0.32))).mul(patch);
    // grazing rays cross far more ice than vertical ones, and the deck fades
    // out at the horizon where a flat slab would otherwise stretch to a wall
    const slant = clamp(float(0.35).div(dir.y.max(0.05)), 1, 3.2);
    const a = veil
      .mul(float(this.cirrusAmount))
      .mul(slant)
      .mul(smoothstep(0.012, 0.09, dir.y))
      .mul(hit.select(float(1), float(0)))
      .clamp(0, 0.72);
    // thin ice forward-scatters hard: bright rim within ~25° of the sun
    const fwd = pow(clamp(dir.dot(sunDir), 0, 1), 9).mul(2.6).add(1);
    // gate on the sun actually being up: the transmittance LUT still returns
    // a deep-red value below the horizon, which painted pink cirrus over a
    // midnight sky in the first night frame
    const sunUp = smoothstep(-0.06, 0.04, sunDir.y);
    const col = sunT
      .mul(SUN_E * 0.55)
      .mul(fwd)
      .mul(sunUp)
      .add(this.atmosphere.skyFull(dir).mul(0.35));
    return { color: col.mul(a), alpha: a };
  }
}
