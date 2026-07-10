/**
 * Terrain splat shading — the surface look of the plateau (Pillar A/E,
 * macro–meso–micro law). Five surface families blend by the baked masks:
 *
 *   bedrock   — Mokattam limestone, strata banding, ridged cavity dirt
 *   sand      — pale aeolian sheet, wind-oriented ripple bump
 *   gravel    — wadi floors / desert pavement, worley pebble speckle
 *   quarry    — fresh-cut faces, brighter, chip litter tone
 *   silt      — floodplain alluvium, moisture darkening, green wash
 *               (real field/vegetation geometry arrives in Phase 5)
 *
 * A macro variation layer (~700 m value noise) breaks tiling; all noise
 * comes from the baked NoiseBake textures (one fetch each, gradients
 * pre-derived). Structure follows LAAS TerrainMaterial (MIT).
 */

import type { StorageTexture } from 'three/webgpu';
import {
  cameraPosition,
  clamp,
  float,
  mix,
  positionWorld,
  smoothstep,
  texture,
  transformNormalToView,
  vec2,
  vec3,
} from 'three/tsl';
import type { NF, NV2, NV3 } from '../gpu/TSLTypes';
import { PERIOD_FBM, PERIOD_RID, PERIOD_VAL, PERIOD_WOR } from '../gpu/passes/NoiseBake';
import { WIND_X, WIND_Z } from '../world/WorldConst';

/** micro-displacement tuning (consumed by TerrainTiles vertex stage) */
export const DISP = {
  base: 0.05, // sand/silt baseline amplitude (m)
  rock: 0.14, // exposed bedrock/scarp amplitude
  gravel: 0.08,
  sF1: 0.9, // fbm domain scale (m per period-unit)
  sF2: 5.0,
  sRid: 2.2,
  wF1: 0.5,
  wF2: 0.3,
  wRid: 0.55,
  ridBase: 0.25,
  slopeKnee0: 0.25,
  slopeKnee1: 0.75,
  fade0: 60,
  fade1: 95,
};

export interface TerrainShadingInputs {
  normalTex: StorageTexture;
  fieldsTex: StorageTexture; // x=moisture y=sand z=quarry w=river
  masksTex: StorageTexture; // x=floodplain y=harbor z=wadi w=bedrockExposure
  noiseA: StorageTexture;
  noiseB: StorageTexture;
  /** world xz of the fragment */
  wpos: NV2;
  /** uv over the terrain grid for the baked textures */
  uv: NV2;
  far: boolean;
}

export interface TerrainShading {
  colorNode: NV3;
  normalNode: NV3;
  roughnessNode: NF;
  worldNormalNode: NV3;
}

/* palette (linear-ish sRGB values; graded in Phase 2's color script) */
const LIMESTONE = vec3(0.71, 0.66, 0.55);
const LIMESTONE_BAND = vec3(0.60, 0.52, 0.41);
const SAND_LIGHT = vec3(0.80, 0.70, 0.52);
const SAND_WARM = vec3(0.72, 0.60, 0.42);
const GRAVEL = vec3(0.55, 0.48, 0.38);
const QUARRY_FRESH = vec3(0.84, 0.80, 0.68);
const SILT = vec3(0.35, 0.28, 0.21);
const SILT_WET = vec3(0.20, 0.16, 0.12);
const VEG_WASH = vec3(0.31, 0.42, 0.19);
const RIVERBED = vec3(0.22, 0.19, 0.15);

export function buildTerrainShading(inp: TerrainShadingInputs): TerrainShading {
  const { wpos, uv, far } = inp;

  const ns = texture(inp.normalTex, uv);
  const baseNormal = ns.xyz.normalize();
  const slope = ns.w;
  const fld = texture(inp.fieldsTex, uv);
  const msk = texture(inp.masksTex, uv);
  const moisture = fld.x;
  const sandD = fld.y;
  const quarry = fld.z;
  const river = fld.w;
  const plain = msk.x;
  const wadi = msk.z;
  const rockExp = msk.w;

  /* --- noise fetches ------------------------------------------------------ */
  const nA1 = texture(inp.noiseA, wpos.div(1.1 * PERIOD_FBM)); // fbm + grads
  const nB1 = texture(inp.noiseB, wpos.div(2.3 * PERIOD_RID)); // ridged + grads
  const nWor = texture(inp.noiseB, wpos.div(0.45 * PERIOD_WOR)).a; // pebbles
  const macro = texture(inp.noiseA, wpos.div(2.9 * PERIOD_VAL)).r; // ~740 m
  const macroK = macro.mul(0.24).add(0.88); // ±12% tone variation

  // wind-anisotropic ripple domain: compress along wind, stretch across —
  // ridge lines form perpendicular to the wind (real aeolian ripples).
  // NORMAL-ONLY close-range detail: albedo streaking at grazing angles was
  // the ugliest defect of the first eye-level shots (brushed-metal smear).
  const wdir = vec2(WIND_X, WIND_Z);
  const perp = vec2(-WIND_Z, WIND_X);
  const rippleP = vec2(wpos.dot(wdir).div(0.4), wpos.dot(perp).div(1.6));
  const ripple = texture(inp.noiseA, rippleP.div(PERIOD_FBM));
  const rippleH = ripple.g; // fbm value = crest/trough
  const rippleGrad = ripple.ba; // d/dx, d/dz in ripple space
  // camera-distance fade for all ripple contributions (close-range meso)
  const camDist = positionWorld.sub(cameraPosition).length();
  const rippleFade = smoothstep(70, 25, camDist);
  // fine grain speckle — the actual texture of sand at eye height
  const grain = texture(inp.noiseA, wpos.div(0.021 * PERIOD_VAL)).r;

  /* --- per-family albedo ---------------------------------------------------- */
  // bedrock: strata banding comes from the baked geometry benches; here we
  // band the TONE with a ridged pattern + cavity darkening in the creases
  const ridged = nB1.b;
  const cavity = ridged.mul(0.5).add(0.5).clamp(0, 1);
  const strataTone = smoothstep(0.35, 0.75, nA1.g).mul(0.85).add(0.15);
  let rockCol = mix(LIMESTONE, LIMESTONE_BAND, strataTone.mul(0.7));
  rockCol = rockCol.mul(cavity.mul(0.35).oneMinus().add(0.12));

  // sand: pale sheet; tone comes from broad patches + fine grain speckle,
  // with only a whisper of ripple shading very close to the camera
  const rippleShade = rippleH.mul(0.05).mul(rippleFade).add(1);
  let sandCol = mix(SAND_LIGHT, SAND_WARM, nA1.r.mul(0.7))
    .mul(grain.mul(0.14).add(0.93))
    .mul(rippleShade);

  // gravel: pebble speckle (worley cells → per-pebble tone)
  const pebble = smoothstep(0.15, 0.5, nWor);
  const gravelCol = mix(GRAVEL, GRAVEL.mul(1.35), pebble).mul(nA1.g.mul(0.2).add(0.9));

  // quarry: fresh cuts bright, floors dustier
  const quarryCol = QUARRY_FRESH.mul(nA1.g.mul(0.18).add(0.9));

  // silt: moisture-darkened alluvium with a vegetation wash on the wet plain
  let siltCol = mix(SILT, SILT_WET, smoothstep(0.15, 0.8, moisture));
  const vegK = smoothstep(0.18, 0.55, moisture).mul(plain).mul(nA1.g.mul(0.45).add(0.55));
  siltCol = mix(siltCol, VEG_WASH, vegK.mul(0.62));

  /* --- family blending ------------------------------------------------------ */
  const sandK = smoothstep(0.06, 0.35, sandD).mul(plain.oneMinus());
  const gravelK = wadi
    .mul(sandK.oneMinus())
    .max(
      smoothstep(0.02, 0.09, sandD)
        .mul(smoothstep(0.35, 0.12, sandD))
        .mul(rockExp.oneMinus())
        .mul(plain.oneMinus())
        .mul(0.8),
    );
  const quarryK = quarry.mul(smoothstep(0.5, 0.15, sandD));

  let col: NV3 = rockCol;
  col = mix(col, gravelCol, gravelK);
  col = mix(col, sandCol, sandK);
  col = mix(col, quarryCol, quarryK);
  col = mix(col, siltCol, plain);
  col = mix(col, RIVERBED, river.mul(0.9));
  col = col.mul(macroK);

  /* --- normal detail ---------------------------------------------------------- */
  // bedrock: ridged gradient; sand: ripple gradient rotated back to world
  const rockGrad = nB1.rg.mul(0.4);
  const rippleWorld = wdir
    .mul(rippleGrad.x.div(0.4))
    .add(perp.mul(rippleGrad.y.div(1.6)))
    .mul(0.1)
    .mul(rippleFade);
  const sandGrad = rippleWorld;
  const siltGrad = nA1.ba.mul(0.12);
  // worked quarry surfaces: faint chip texture, not natural rock lumps
  const quarryGrad = nA1.ba.mul(0.08);
  const gradK = far ? float(0.35) : float(1);
  let grad: NV2 = rockGrad;
  grad = mix(grad, sandGrad, sandK);
  grad = mix(grad, quarryGrad, quarryK);
  grad = mix(grad, siltGrad, plain);
  grad = grad.mul(gradK).mul(smoothstep(0.95, 0.55, slope).mul(0.7).add(0.3));
  const nDetail = vec3(grad.x.negate(), float(1), grad.y.negate());
  // blend detail into the baked base normal (world space), then to view
  const worldN = baseNormal.add(nDetail.mul(0.6)).normalize();

  /* --- roughness --------------------------------------------------------------- */
  let rough: NF = float(0.86);
  rough = mix(rough, float(0.96), sandK);
  rough = mix(rough, float(0.9), gravelK);
  rough = mix(rough, float(0.78), quarryK);
  const siltRough = mix(float(0.9), float(0.45), smoothstep(0.25, 0.85, moisture));
  rough = mix(rough, siltRough, plain);
  rough = mix(rough, float(0.4), river);

  return {
    colorNode: clamp(col, 0, 1),
    normalNode: transformNormalToView(worldN),
    roughnessNode: clamp(rough, 0.05, 1),
    worldNormalNode: worldN,
  };
}
