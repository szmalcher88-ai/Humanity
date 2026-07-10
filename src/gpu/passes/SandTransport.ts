/**
 * Wind-driven sand transport & accumulation (brief §3.2).
 *
 * Two-field model over the sim grid: immutable BEDROCK height B and mobile
 * SAND depth S; the rendered surface is B+S. Each iteration:
 *   1. saltation — wind-exposed cells (surface higher than the upwind
 *      surface) lose sand downwind; sheltered/lee cells keep deposits.
 *      This is what banks drifts against every windward obstacle face and
 *      fills hollows downwind of ridges.
 *   2. repose relaxation — sand steeper than its angle of repose (~33°)
 *      avalanches to the lowest neighbor.
 * Pure gather formulation (recompute the upwind donor's outflow) — no
 * atomics, ping-pong buffers.
 *
 * Obstacle masks: monuments/walls arrive in Phases 3–6 as additions to B;
 * the pass re-runs after placement so drifts bank against real walls.
 */

import type { ComputeNode, Renderer } from 'three/webgpu';
import {
  Fn,
  If,
  Return,
  clamp,
  float,
  instanceIndex,
  instancedArray,
  max,
  vec2,
} from 'three/tsl';
import type { NF, NI } from '../TSLTypes';
import { WIND_X, WIND_Z } from '../../world/WorldConst';
import type { FloatBuffer, Vec4Buffer } from './HeightSynthesis';

export interface SandResult {
  /** final sand depth (m), res×res */
  sand: FloatBuffer;
  /** B+S surface for convenience (same layout) */
  surface: FloatBuffer;
}

export interface SandOptions {
  res: number;
  /** meters per texel */
  texel: number;
  iters: number;
  masksA: Vec4Buffer; // x=floodplain y=river z=harbor w=wadi
  masksB: Vec4Buffer; // x=quarry y=bedrockExposure z=moisture
  onProgress?: (done: number, total: number) => void;
}

/** angle of repose for dry sand */
const TAN_REPOSE = 0.65;
/** saltation strength (fraction of exposure moved per iteration) */
const K_SALT = 0.18;
/** max sand a single iteration can move (m) */
const MAX_MOVE = 0.06;

export async function runSandTransport(
  renderer: Renderer,
  bedrock: FloatBuffer,
  opts: SandOptions,
): Promise<SandResult> {
  const { res, texel, iters, masksA, masksB } = opts;
  const N = res * res;
  const sandA = instancedArray(N, 'float');
  const sandB = instancedArray(N, 'float');

  // wind in texel steps (quantized to the dominant axis pair)
  const wx = Math.abs(WIND_X) > 0.4 ? Math.sign(WIND_X) : 0;
  const wz = Math.abs(WIND_Z) > 0.4 ? Math.sign(WIND_Z) : 0;

  /* --- initial deposit: zone-dependent sand budget ----------------------- */
  const initK = Fn(() => {
    const i = instanceIndex;
    If(i.greaterThanEqual(N), () => {
      Return();
    });
    const mA = masksA.element(i);
    const mB = masksB.element(i);
    const plain = mA.x;
    const river = mA.y;
    const harbor = mA.z;
    const wadi = mA.w;
    const quarry = mB.x;
    const rockExp = mB.y;
    // desert base: deeper sheets over soft ground, thin veneer on hard rock
    const desert = plain.oneMinus();
    const base = desert
      .mul(float(1.0).sub(rockExp.mul(0.8)))
      .mul(0.9)
      .add(desert.mul(0.15));
    // wadi floors carry gravel+sand fill; quarry floors are swept clean;
    // the wet plain has silt, not aeolian sand
    const s = base
      .add(wadi.mul(0.5))
      .mul(quarry.mul(0.85).oneMinus())
      .mul(plain.mul(0.95).oneMinus())
      .mul(river.oneMinus())
      .mul(harbor.oneMinus());
    sandA.element(i).assign(clamp(s, 0, 2.5));
  })().compute(N);
  initK.setName('sandInit');
  await renderer.computeAsync(initK);

  /* --- iteration kernels (ping-pong) -------------------------------------- */
  const surfaceAt = (buf: FloatBuffer, xi: NI, yi: NI): NF => {
    const idx = yi.mul(res).add(xi);
    return bedrock.element(idx).add(buf.element(idx));
  };
  const clampI = (v: NF): NI => clamp(v, 0, res - 1).toInt();

  const mkStep = (src: FloatBuffer, dst: FloatBuffer): ComputeNode => {
    const k = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(N), () => {
        Return();
      });
      const x = i.mod(res).toInt();
      const y = i.div(res).toInt();
      const fx = float(x);
      const fy = float(y);

      const sHere = src.element(i).toVar();
      const hHere = bedrock.element(i).add(sHere).toVar();

      /* saltation — gather:
       *   outflow(c) = K·clamp(surface(c) − surface(c−w), 0, ·)·avail(c)
       *   S' = S − outflow(here) + outflow(upwind donor)               */
      const xu = clampI(fx.sub(wx));
      const yu = clampI(fy.sub(wz));
      const hUp = surfaceAt(src, xu, yu);
      const exposure = hHere.sub(hUp);
      const out = clamp(exposure.mul(K_SALT), 0, MAX_MOVE).min(sHere);

      // donor = my upwind cell; recompute ITS outflow (goes to me)
      const xuu = clampI(fx.sub(wx * 2));
      const yuu = clampI(fy.sub(wz * 2));
      const sUp = src.element(yu.mul(res).add(xu));
      const hUpUp = surfaceAt(src, xuu, yuu);
      const expUp = hUp.sub(hUpUp);
      const inFlow = clamp(expUp.mul(K_SALT), 0, MAX_MOVE).min(sUp);

      let s = sHere.sub(out).add(inFlow);

      /* repose relaxation — move to the lowest of 4 neighbors when the
       * TOTAL surface slope exceeds repose (sand-limited) */
      const xm = clampI(fx.sub(1));
      const xp = clampI(fx.add(1));
      const ym = clampI(fy.sub(1));
      const yp = clampI(fy.add(1));
      const h0 = bedrock.element(i).add(s);
      const limit = float(TAN_REPOSE * texel);
      // outgoing avalanche: to the steepest downhill neighbor
      const dL = h0.sub(surfaceAt(src, xm, y));
      const dR = h0.sub(surfaceAt(src, xp, y));
      const dD = h0.sub(surfaceAt(src, x, ym));
      const dU = h0.sub(surfaceAt(src, x, yp));
      const dMax = max(max(dL, dR), max(dD, dU));
      const aOut = clamp(dMax.sub(limit).mul(0.24), 0, MAX_MOVE * 2).min(s);
      // incoming avalanches: neighbors steeper than repose TOWARD me
      const inN = (xi: NI, yi: NI): NF => {
        const idx = yi.mul(res).add(xi);
        const hn = bedrock.element(idx).add(src.element(idx));
        const d = hn.sub(h0);
        return clamp(d.sub(limit).mul(0.24), 0, MAX_MOVE * 2).min(src.element(idx)).mul(0.25);
      };
      const aIn = inN(xm, y).add(inN(xp, y)).add(inN(x, ym)).add(inN(x, yp));
      s = s.sub(aOut).add(aIn);

      // lateral diffusion: the 1-texel saltation step otherwise grows a
      // texel-wavelength transverse-ripple instability (2 m stripes across
      // the whole desert — first top-down finding). Real Giza is sand
      // SHEETS; ripples are material-scale, not heightfield-scale.
      const sAvg = src.element(y.mul(res).add(xm))
        .add(src.element(y.mul(res).add(xp)))
        .add(src.element(ym.mul(res).add(x)))
        .add(src.element(yp.mul(res).add(x)))
        .mul(0.25);
      s = s.mul(0.85).add(sAvg.mul(0.15));

      // water strips sand (river/harbor stay silt/bed)
      const mA = masksA.element(i);
      s = s.mul(mA.y.oneMinus()).mul(mA.z.oneMinus());
      dst.element(i).assign(clamp(s, 0, 4));
    })().compute(N);
    k.setName('sandStep');
    return k;
  };

  const stepAB = mkStep(sandA, sandB);
  const stepBA = mkStep(sandB, sandA);
  const pairs = Math.ceil(iters / 2);
  const BATCH = 8;
  for (let it = 0; it < pairs; it += BATCH) {
    const chunk: ComputeNode[] = [];
    for (let j = it; j < Math.min(it + BATCH, pairs); j++) {
      chunk.push(stepAB, stepBA);
    }
    await renderer.computeAsync(chunk);
    opts.onProgress?.(Math.min((it + BATCH) * 2, iters), iters);
  }

  /* --- surface = B + S ------------------------------------------------------ */
  const surface = instancedArray(N, 'float');
  const finK = Fn(() => {
    const i = instanceIndex;
    If(i.greaterThanEqual(N), () => {
      Return();
    });
    surface.element(i).assign(bedrock.element(i).add(sandA.element(i)));
  })().compute(N);
  finK.setName('sandCompose');
  await renderer.computeAsync(finK);

  void vec2; // TSL import kept for future anisotropic ripple field
  return { sand: sandA, surface };
}
