/**
 * Heightfield — owner of all terrain GPU state. Orchestrates the generation
 * passes (synthesis → quarry carve → sand transport → compose → derived
 * maps) and exposes buffers/textures + TSL sampling helpers.
 * Skeleton ported from PROJECT LAAS (MIT); the Giza pipeline (authored
 * control, sand instead of rain erosion, quarry terracing) is new.
 *
 * Layout: row-major res×res grids over the terrain extent —
 * texel (x,y) ↔ world ((x+0.5)/res − 0.5)·WORLD_SIZE + TERRAIN_C.
 */

import { FloatType, HalfFloatType, LinearFilter, NearestFilter, RedFormat } from 'three';
import type { Renderer } from 'three/webgpu';
import { StorageTexture } from 'three/webgpu';
import {
  Fn,
  If,
  Return,
  clamp,
  float,
  floor,
  fract,
  instanceIndex,

  mix,
  texture,
  textureStore,
  uvec2,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { AkhetParams } from '../core/Params';
import type { WorldSeed } from '../core/Seed';
import { bilerpFloatBuffer, uvToGrid } from '../gpu/BufferSample';
import { bakeNoiseTextures } from '../gpu/passes/NoiseBake';
import type { NF, NV2, NV3 } from '../gpu/TSLTypes';
import type { FloatBuffer, Vec4Buffer } from '../gpu/passes/HeightSynthesis';
import { runHeightSynthesis } from '../gpu/passes/HeightSynthesis';
import { runQuarryCarve } from '../gpu/passes/QuarryCarve';
import { runSandTransport } from '../gpu/passes/SandTransport';
import { makeGizaParams, type GizaParams } from './GizaControl';
import {
  NILE_WATER_Y,
  TERRAIN_CX,
  TERRAIN_CZ,
  WORLD_SIZE,
  qualityConfig,
  type QualityConfig,
} from './WorldConst';

export type ProgressFn = (p: number, msg: string) => void;

export class Heightfield {
  readonly cfg: QualityConfig;
  readonly gp: GizaParams;
  readonly res: number;

  /** final surface height (world Y), res×res — single source of truth */
  readonly height: FloatBuffer;
  readonly hardness: FloatBuffer;
  /** sand depth at sim res */
  sand: FloatBuffer | null = null;
  simRes = 0;

  /** rgba16f at sim res: x=moisture y=sandDepth z=quarry w=river */
  fieldsTex: StorageTexture | null = null;
  /** rgba16f at sim res: x=floodplain y=harbor z=wadi w=bedrockExposure */
  masksTex: StorageTexture | null = null;

  /** CPU height mirror (full res) — camera clamping, tools, range pyramid */
  cpuHeights: Float32Array | null = null;

  /** r32float height texture (nearest/textureLoad only) */
  readonly heightTex: StorageTexture;
  /** rgba16f: xyz = world-space normal, w = slope (rise/run) */
  readonly normalTex: StorageTexture;
  /** baked tileable noise (NoiseBake channel map) */
  noiseA: StorageTexture | null = null;
  noiseB: StorageTexture | null = null;

  private constructor(
    cfg: QualityConfig,
    gp: GizaParams,
    height: FloatBuffer,
    hardness: FloatBuffer,
    res: number,
    heightTex: StorageTexture,
    normalTex: StorageTexture,
  ) {
    this.cfg = cfg;
    this.gp = gp;
    this.res = res;
    this.height = height;
    this.hardness = hardness;
    this.heightTex = heightTex;
    this.normalTex = normalTex;
  }

  static async generate(
    renderer: Renderer,
    params: AkhetParams,
    seed: WorldSeed,
    progress: ProgressFn,
  ): Promise<Heightfield> {
    const cfg = qualityConfig(params.preset);
    const gp = makeGizaParams(seed);

    progress(0.05, `terrain: baking ${cfg.heightRes}² plateau`);
    const synth = await runHeightSynthesis(renderer, cfg.heightRes, gp, false);

    const heightTex = new StorageTexture(cfg.heightRes, cfg.heightRes);
    heightTex.type = FloatType;
    heightTex.format = RedFormat;
    heightTex.magFilter = NearestFilter;
    heightTex.minFilter = NearestFilter;
    heightTex.generateMipmaps = false;

    const normalTex = new StorageTexture(cfg.heightRes, cfg.heightRes);
    normalTex.type = HalfFloatType;
    normalTex.generateMipmaps = false;

    const hf = new Heightfield(
      cfg, gp, synth.height, synth.hardness, synth.res, heightTex, normalTex,
    );

    const noise = await bakeNoiseTextures(renderer);
    hf.noiseA = noise.texA;
    hf.noiseB = noise.texB;

    progress(0.14, 'terrain: carving quarry terraces');
    await runQuarryCarve(renderer, synth.height, synth.quarryDepth, cfg.heightRes);

    // --- sand transport at sim res, composed back to full res ---------------
    progress(0.2, `terrain: baking ${cfg.simRes}² sand grid`);
    const synthSim = await runHeightSynthesis(renderer, cfg.simRes, gp, true);
    await runQuarryCarve(renderer, synthSim.height, synthSim.quarryDepth, cfg.simRes);

    progress(0.25, `terrain: sand transport (${cfg.sandIters} iterations)`);
    const sandRes = await runSandTransport(renderer, synthSim.height, {
      res: cfg.simRes,
      texel: WORLD_SIZE / cfg.simRes,
      iters: cfg.sandIters,
      masksA: synthSim.masksA,
      masksB: synthSim.masksB,
      onProgress: (d, t) => progress(0.25 + 0.3 * (d / t), `terrain: sand ${d}/${t}`),
    });
    hf.sand = sandRes.sand;
    hf.simRes = cfg.simRes;

    progress(0.6, 'terrain: composing sand onto bedrock');
    await hf.composeSand(renderer);

    progress(0.7, 'terrain: packing field textures');
    await hf.buildFieldTextures(renderer, synthSim.masksA, synthSim.masksB);

    progress(0.8, 'terrain: deriving normal maps');
    await hf.rebuildDerivedMaps(renderer);

    progress(0.9, 'terrain: height readback for camera');
    const ab = await renderer.getArrayBufferAsync(hf.height.value);
    hf.cpuHeights = new Float32Array(ab);
    return hf;
  }

  /** CPU height lookup (bilinear) — camera clamping, bookmarks, tools */
  heightAtCpu(x: number, z: number): number {
    const hts = this.cpuHeights;
    if (!hts) return 0;
    const res = this.res;
    const gx = Math.min(Math.max((((x - TERRAIN_CX) / WORLD_SIZE) + 0.5) * res - 0.5, 0), res - 1.001);
    const gz = Math.min(Math.max((((z - TERRAIN_CZ) / WORLD_SIZE) + 0.5) * res - 0.5, 0), res - 1.001);
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const fx = gx - x0;
    const fz = gz - z0;
    const i = (xx: number, zz: number): number =>
      hts[Math.min(zz, res - 1) * res + Math.min(xx, res - 1)] ?? 0;
    const a = i(x0, z0) * (1 - fx) + i(x0 + 1, z0) * fx;
    const b = i(x0, z0 + 1) * (1 - fx) + i(x0 + 1, z0 + 1) * fx;
    return a * (1 - fz) + b * fz;
  }

  /** water level at (x,z) — Phase 1: the Nile stage; harbor shares it */
  waterYAtCpu(_x: number, _z: number): number {
    return NILE_WATER_Y;
  }

  /** height ← bedrockFull + bilinear-upsampled sand depth */
  private async composeSand(renderer: Renderer): Promise<void> {
    const sand = this.sand;
    if (!sand) return;
    const res = this.res;
    const simRes = this.simRes;
    const kernel = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(res * res), () => {
        Return();
      });
      const x = i.mod(res);
      const y = i.div(res);
      const uv = vec2(float(x).add(0.5), float(y).add(0.5)).div(res);
      const g = uvToGrid(uv, simRes);
      const s = bilerpFloatBuffer(sand, simRes, g);
      this.height.element(i).assign(this.height.element(i).add(s));
    })().compute(res * res);
    kernel.setName('sandComposeFull');
    await renderer.computeAsync(kernel);
  }

  /** pack sim-res fields + masks into filterable rgba16f textures */
  private async buildFieldTextures(
    renderer: Renderer,
    masksA: Vec4Buffer,
    masksB: Vec4Buffer,
  ): Promise<void> {
    const sand = this.sand;
    if (!sand) return;
    const res = this.simRes;
    const mkTex = (): StorageTexture => {
      const t = new StorageTexture(res, res);
      t.type = HalfFloatType;
      t.magFilter = LinearFilter;
      t.minFilter = LinearFilter;
      t.generateMipmaps = false;
      return t;
    };
    const fields = mkTex();
    const masks = mkTex();
    const kernel = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(res * res), () => {
        Return();
      });
      const x = i.mod(res);
      const y = i.div(res);
      const mA = masksA.element(i);
      const mB = masksB.element(i);
      const xy = uvec2(x.toUint(), y.toUint());
      textureStore(fields, xy, vec4(mB.z, sand.element(i), mB.x, mA.y)).toWriteOnly();
      textureStore(masks, xy, vec4(mA.x, mA.z, mA.w, mB.y)).toWriteOnly();
    })().compute(res * res);
    kernel.setName('fieldTexPack');
    await renderer.computeAsync(kernel);
    this.fieldsTex = fields;
    this.masksTex = masks;
  }

  /** height buffer → height texture + central-difference normals/slope */
  async rebuildDerivedMaps(renderer: Renderer): Promise<void> {
    const res = this.res;
    const height = this.height;
    const texel = WORLD_SIZE / res;
    const kernel = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(res * res), () => {
        Return();
      });
      const x = i.mod(res).toInt();
      const y = i.div(res).toInt();
      const xm = clamp(float(x).sub(1), 0, res - 1).toInt();
      const xp = clamp(float(x).add(1), 0, res - 1).toInt();
      const ym = clamp(float(y).sub(1), 0, res - 1).toInt();
      const yp = clamp(float(y).add(1), 0, res - 1).toInt();
      const h = height.element(i).toVar();
      const hl = height.element(y.mul(res).add(xm)).toVar();
      const hr = height.element(y.mul(res).add(xp)).toVar();
      const hd = height.element(ym.mul(res).add(x)).toVar();
      const hu = height.element(yp.mul(res).add(x)).toVar();
      const n = vec3(hl.sub(hr), float(texel * 2), hd.sub(hu)).normalize();
      const slope = vec2(hl.sub(hr), hd.sub(hu)).length().div(texel * 2);
      textureStore(this.heightTex, uvec2(x.toUint(), y.toUint()), vec4(h, 0, 0, 1)).toWriteOnly();
      textureStore(this.normalTex, uvec2(x.toUint(), y.toUint()), vec4(n, slope)).toWriteOnly();
    })().compute(res * res);
    kernel.setName('terrainDerivedMaps');
    await renderer.computeAsync(kernel);
  }

  /** world xz (m) → uv in [0,1]² over the terrain grid */
  uvFromWorld(p: NV2): NV2 {
    return p.sub(vec2(TERRAIN_CX, TERRAIN_CZ)).div(WORLD_SIZE).add(0.5);
  }

  /** manual-bilinear height sample (vertex-stage safe) */
  sampleHeight(p: NV2): NF {
    return this.sampleHeightFrom(this.height, p);
  }

  /** nearest-cell height read — cost-insensitive paths (shadow casting) */
  sampleHeightNearest(p: NV2): NF {
    const res = this.res;
    const uv = this.uvFromWorld(p);
    const g = clamp(uv, 0, 1).mul(res);
    const x = clamp(floor(g.x), 0, res - 1).toInt();
    const y = clamp(floor(g.y), 0, res - 1).toInt();
    return this.height.element(y.mul(res).add(x));
  }

  /** same, from an arbitrary res×res float buffer */
  sampleHeightFrom(buf: FloatBuffer, p: NV2): NF {
    const res = this.res;
    const uv = this.uvFromWorld(p);
    const g = clamp(uv, 0, 1).mul(res).sub(0.5);
    const i0 = floor(g);
    const f = fract(g);
    const x0 = clamp(i0.x, 0, res - 1).toInt();
    const y0 = clamp(i0.y, 0, res - 1).toInt();
    const x1 = clamp(i0.x.add(1), 0, res - 1).toInt();
    const y1 = clamp(i0.y.add(1), 0, res - 1).toInt();
    const h00 = buf.element(y0.mul(res).add(x0));
    const h10 = buf.element(y0.mul(res).add(x1));
    const h01 = buf.element(y1.mul(res).add(x0));
    const h11 = buf.element(y1.mul(res).add(x1));
    return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
  }

  /** filtered normal+slope sample (fragment stage) */
  sampleNormalSlope(p: NV2): { normal: NV3; slope: NF } {
    const t = texture(this.normalTex, this.uvFromWorld(p));
    return { normal: t.xyz.normalize(), slope: t.w };
  }
}
