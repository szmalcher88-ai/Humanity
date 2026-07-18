/**
 * Irradiance probe field — replaces the hemisphere ambient (brief §2 GI
 * floor). Ported from PROJECT LAAS (MIT) and adapted to Giza:
 *
 *  - 256×256 probes over the 4 km grid (16 m), 6 TERRAIN-RELATIVE layers
 *    (1.5…110 m above ground); heightfield ray-march gather; SH-L1; EMA;
 *    time-sliced full refresh in <1 s.
 *  - NO canopy slab (no forest here). Instead, the gather rays intersect
 *    the GREAT PYRAMID analytically (4 face planes + base): the polished
 *    casing is a BOUNCE AND OCCLUSION SOURCE — canon Vol. V's "primary
 *    lighting reference object of the plateau" made literal. Shaded courts
 *    east of the monument pick up warm casing light; probes inside its
 *    shadow lose their sun-bounce term.
 *  - Ground bounce albedo proxy from the Giza splat masks (sand/limestone/
 *    silt/quarry, moisture-darkened).
 */

import { HalfFloatType } from 'three';
import type { Renderer } from 'three/webgpu';
import { Storage3DTexture, type StorageBufferNode } from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  Return,
  clamp,
  dot,
  float,
  instanceIndex,
  instancedArray,
  log2,
  max,
  mix,
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
import { TERRAIN_CX, TERRAIN_CZ, WORLD_SIZE } from '../../world/WorldConst';
import { G1_BASE_SIDE, G1_SLOPE_DEG } from '../../world/CANON_DIMENSIONS';
import type { Heightfield } from '../../world/Heightfield';
import type { Atmosphere } from '../../sky/Atmosphere';
import { SUN_E } from '../../sky/Atmosphere';
import { hash12 } from '../noise/NoiseTSL';
import type { NF, NI, NV2, NV3 } from '../TSLTypes';

export const PROBE_XZ = 256;
export const PROBE_LAYERS = 6;
const LAYER_BASE = 1.5;
const LAYER_RATIO = 2.36;
const TOTAL = PROBE_XZ * PROBE_XZ * PROBE_LAYERS;
const PROBES_PER_FRAME = 3072;
const DIRS = 16;
const MARCH_STEPS = 16;

/** G1 face geometry for the analytic intersector (world frame, cy = 0) */
const THETA = (G1_SLOPE_DEG.value * Math.PI) / 180;
const SIN_T = Math.sin(THETA);
const COS_T = Math.cos(THETA);
const HALF_B = G1_BASE_SIDE.value / 2;
/** casing albedo for the bounce term */
const TURA = [0.84, 0.815, 0.755] as const;

export class ProbeGI {
  readonly texR: Storage3DTexture;
  readonly texG: Storage3DTexture;
  readonly texB: Storage3DTexture;
  private shR: StorageBufferNode<'vec4'>;
  private shG: StorageBufferNode<'vec4'>;
  private shB: StorageBufferNode<'vec4'>;
  private gatherK: Parameters<Renderer['compute']>[0] | null = null;
  private publishK: Parameters<Renderer['compute']>[0] | null = null;
  private frameBase = uniform(0);
  private blend = uniform(0.22);
  private rot = uniform(0);
  private boost = 0;

  constructor(
    private hf: Heightfield,
    private atmosphere: Atmosphere,
  ) {
    const mk = (): Storage3DTexture => {
      const t = new Storage3DTexture(PROBE_XZ, PROBE_XZ, PROBE_LAYERS);
      t.type = HalfFloatType;
      t.generateMipmaps = false;
      return t;
    };
    this.texR = mk();
    this.texG = mk();
    this.texB = mk();
    this.shR = instancedArray(TOTAL, 'vec4');
    this.shG = instancedArray(TOTAL, 'vec4');
    this.shB = instancedArray(TOTAL, 'vec4');
  }

  async init(renderer: Renderer): Promise<void> {
    const hf = this.hf;
    const heightAt = (p: NV2): NF => hf.sampleHeight(p);
    const gridUv = (p: NV2): NV2 =>
      p.sub(vec2(TERRAIN_CX, TERRAIN_CZ)).div(WORLD_SIZE).add(0.5);

    /**
     * Ray vs the Great Pyramid (convex clip against 4 face planes + base).
     * Returns tHit (<0 = miss) and writes the hit face normal to outN.
     * Face plane i: outward normal nI, passing through the base edge point
     * qI = NfI·HALF_B (y=0).
     */
    const FACES: [number, number][] = [
      [0, -1], // north
      [1, 0], // east
      [0, 1], // south
      [-1, 0], // west
    ];
    const pyramidHit = (
      o: NV3,
      d: NV3,
    ): { t: NF; n: NV3 } => {
      const tEnter = float(-1e9).toVar();
      const tExit = float(1e9).toVar();
      const hitN = vec3(0, 1, 0).toVar();
      const miss = float(0).toVar();
      for (const [nx, nz] of FACES) {
        const n = vec3(nx * SIN_T, COS_T, nz * SIN_T);
        const q = vec3(nx * HALF_B, 0, nz * HALF_B);
        const s0 = dot(n, o.sub(q));
        const den = dot(n, d);
        const tP = s0.negate().div(den);
        const entering = den.lessThan(-1e-7);
        const leaving = den.greaterThan(1e-7);
        const parallelOut = den.abs().lessThanEqual(1e-7).and(s0.greaterThan(0));
        miss.assign(parallelOut.select(float(1), miss));
        If(entering.and(tP.greaterThan(tEnter)), () => {
          tEnter.assign(tP);
          hitN.assign(n);
        });
        If(leaving, () => {
          tExit.assign(tExit.min(tP));
        });
      }
      // base plane y >= 0: outward normal (0,-1,0), through origin
      {
        const s0 = o.y.negate();
        const den = d.y.negate();
        const tP = s0.negate().div(den);
        const entering = den.lessThan(-1e-7);
        const leaving = den.greaterThan(1e-7);
        If(entering.and(tP.greaterThan(tEnter)), () => {
          tEnter.assign(tP);
          hitN.assign(vec3(0, -1, 0));
        });
        If(leaving, () => {
          tExit.assign(tExit.min(tP));
        });
      }
      const valid = tEnter
        .lessThan(tExit)
        .and(tEnter.greaterThan(0.1))
        .and(miss.lessThan(0.5));
      return { t: valid.select(tEnter, float(-1)), n: hitN };
    };

    const sunDir = this.atmosphere.sunDir;

    /** is the point sun-blocked by the pyramid? (boolean 0/1 transmittance) */
    const pyramidSunVis = (p: NV3): NF => {
      const hit = pyramidHit(p, vec3(sunDir.x, sunDir.y, sunDir.z).normalize());
      return hit.t.greaterThan(0).select(float(0), float(1));
    };

    /** ground-hit bounce radiance: Giza surface albedo × (sun + sky) */
    const hitRadiance = (hp: NV3): NV3 => {
      const uv = gridUv(hp.xz);
      const msk = texture(hf.masksTex as NonNullable<typeof hf.masksTex>, uv, 0);
      const fld = texture(hf.fieldsTex as NonNullable<typeof hf.fieldsTex>, uv, 0);
      const nrm = texture(hf.normalTex, uv, 0).xyz;
      const sand = vec3(0.66, 0.56, 0.4);
      const stone = vec3(0.58, 0.53, 0.44);
      const silt = vec3(0.2, 0.165, 0.13);
      const quarry = vec3(0.74, 0.7, 0.6);
      let albedo: NV3 = mix(stone, sand, smoothstep(0.06, 0.35, fld.y));
      albedo = mix(albedo, quarry, fld.z) as NV3;
      albedo = mix(albedo, silt, msk.x) as NV3;
      albedo = albedo.mul(fld.x.mul(0.45).oneMinus()) as NV3;
      // sun visibility: short heightfield horizon march + pyramid block
      const sVis = float(1).toVar();
      const sunXZ = vec2(sunDir.x, sunDir.z);
      for (let s = 1; s <= 6; s++) {
        const t = 14 * s * s;
        const sp = hp.xz.add(sunXZ.mul(t));
        const sy = hp.y.add(sunDir.y.mul(t));
        sVis.mulAssign(heightAt(sp).lessThan(sy.add(1)).select(float(1), float(0)));
      }
      sVis.mulAssign(pyramidSunVis(hp));
      const ndl = clamp(dot(nrm, sunDir), 0, 1);
      const sun = this.atmosphere
        .sampleTransmittance(float(6360.35), clamp(sunDir.y, -1, 1))
        .mul(SUN_E)
        .mul(ndl)
        .mul(sVis)
        .div(Math.PI);
      const skyUp = this.atmosphere.skyColor(vec3(0, 1, 0)).mul(0.25);
      return albedo.mul(sun.add(skyUp.mul(clamp(nrm.y, 0, 1))));
    };

    /** casing-hit bounce radiance: bright Tura × sun N·L (faces are exposed) */
    const casingRadiance = (n: NV3): NV3 => {
      const ndl = clamp(dot(n, sunDir), 0, 1);
      const sun = this.atmosphere
        .sampleTransmittance(float(6360.35), clamp(sunDir.y, -1, 1))
        .mul(SUN_E)
        .mul(ndl)
        .div(Math.PI);
      const skyUp = this.atmosphere
        .skyColor(vec3(0, 1, 0))
        .mul(0.3)
        .mul(clamp(n.y, 0, 1).mul(0.6).add(0.4));
      return vec3(...TURA).mul(sun.add(skyUp));
    };

    this.gatherK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(PROBES_PER_FRAME), () => {
        Return();
      });
      const pid = float(this.frameBase).add(float(i)).mod(TOTAL).toInt();
      const lay = pid.div(PROBE_XZ * PROBE_XZ);
      const rem = pid.mod(PROBE_XZ * PROBE_XZ);
      const px = rem.mod(PROBE_XZ);
      const pz = rem.div(PROBE_XZ);
      const wx = float(px).add(0.5).div(PROBE_XZ).sub(0.5).mul(WORLD_SIZE).add(TERRAIN_CX);
      const wz = float(pz).add(0.5).div(PROBE_XZ).sub(0.5).mul(WORLD_SIZE).add(TERRAIN_CZ);
      const ground = heightAt(vec2(wx, wz));
      const layerH = float(LAYER_BASE).mul(float(LAYER_RATIO).pow(float(lay)));
      const ppos = vec3(wx, ground.add(layerH), wz).toVar();

      const c0R = float(0).toVar();
      const c0G = float(0).toVar();
      const c0B = float(0).toVar();
      const c1R = vec3(0).toVar();
      const c1G = vec3(0).toVar();
      const c1B = vec3(0).toVar();

      Loop(DIRS, ({ i: di }: { readonly i: NI }) => {
        const fi = float(di).add(hash12(vec2(float(pid), float(this.rot))).mul(0.8));
        const phi = fi.mul(2.39996323).add(float(this.rot));
        const y = float(1).sub(fi.add(0.5).mul(2 / DIRS));
        const r = float(1).sub(y.mul(y)).max(0).sqrt();
        const dir = vec3(phi.cos().mul(r), y, phi.sin().mul(r)).toVar();

        // heightfield march
        const hitT = float(-1).toVar();
        const t = float(6).toVar();
        Loop(MARCH_STEPS, () => {
          const sp = ppos.add(dir.mul(t));
          If(sp.y.lessThan(heightAt(sp.xz)).and(hitT.lessThan(0)), () => {
            hitT.assign(t);
          });
          t.mulAssign(1.6);
        });

        // pyramid intersection — may occlude the terrain hit or the sky
        const pyr = pyramidHit(ppos, dir);
        const pyrCloser = pyr.t
          .greaterThan(0)
          .and(hitT.lessThan(0).or(pyr.t.lessThan(hitT)));

        const L = vec3(0).toVar();
        If(pyrCloser, () => {
          L.assign(casingRadiance(pyr.n));
        })
          .ElseIf(hitT.greaterThan(0), () => {
            L.assign(hitRadiance(ppos.add(dir.mul(hitT))));
          })
          .Else(() => {
            L.assign(this.atmosphere.skyColor(dir));
          });

        const w = 4 / DIRS;
        c0R.addAssign(L.x.mul(w));
        c0G.addAssign(L.y.mul(w));
        c0B.addAssign(L.z.mul(w));
        c1R.addAssign(dir.mul(L.x.mul(w)));
        c1G.addAssign(dir.mul(L.y.mul(w)));
        c1B.addAssign(dir.mul(L.z.mul(w)));
      });

      const blend = float(this.blend);
      const prevR = this.shR.element(pid);
      const prevG = this.shG.element(pid);
      const prevB = this.shB.element(pid);
      prevR.assign(mix(prevR, vec4(c0R, c1R.x, c1R.y, c1R.z), blend));
      prevG.assign(mix(prevG, vec4(c0G, c1G.x, c1G.y, c1G.z), blend));
      prevB.assign(mix(prevB, vec4(c0B, c1B.x, c1B.y, c1B.z), blend));
    })().compute(PROBES_PER_FRAME);
    this.gatherK.setName('probeGather');

    this.publishK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(PROBES_PER_FRAME), () => {
        Return();
      });
      const pid = float(this.frameBase).add(float(i)).mod(TOTAL).toInt();
      const lay = pid.div(PROBE_XZ * PROBE_XZ);
      const rem = pid.mod(PROBE_XZ * PROBE_XZ);
      const px = rem.mod(PROBE_XZ);
      const pz = rem.div(PROBE_XZ);
      const xyz = uvec3(px.toUint(), pz.toUint(), lay.toUint());
      textureStore(this.texR, xyz, this.shR.element(pid)).toWriteOnly();
      textureStore(this.texG, xyz, this.shG.element(pid)).toWriteOnly();
      textureStore(this.texB, xyz, this.shB.element(pid)).toWriteOnly();
    })().compute(PROBES_PER_FRAME);
    this.publishK.setName('probePublish');

    // warm the whole field once
    this.blend.value = 1;
    const batches = Math.ceil(TOTAL / PROBES_PER_FRAME);
    for (let n = 0; n < batches; n++) {
      const wait = n % 16 === 15 || n === batches - 1;
      if (wait) await renderer.computeAsync([this.gatherK, this.publishK]);
      else {
        renderer.compute(this.gatherK);
        renderer.compute(this.publishK);
      }
      this.frameBase.value = (this.frameBase.value + PROBES_PER_FRAME) % TOTAL;
    }
    this.blend.value = 0.22;
  }

  /** one time slice per frame (sync submit, no readback) */
  tick(renderer: Renderer): void {
    if (!this.gatherK || !this.publishK) return;
    renderer.compute(this.gatherK);
    renderer.compute(this.publishK);
    this.frameBase.value = (this.frameBase.value + PROBES_PER_FRAME) % TOTAL;
    this.rot.value = (this.rot.value + 1.61803) % 6.2831;
    if (this.boost > 0) {
      this.boost--;
      if (this.boost === 0) this.blend.value = 0.22;
    }
  }

  /** call after a time-of-day jump: converge faster for a full cycle */
  invalidate(): void {
    this.blend.value = 0.6;
    this.boost = Math.ceil(TOTAL / PROBES_PER_FRAME) + 2;
  }

  /** SH-L1 irradiance at a world position/normal */
  irradiance(wp: NV3, n: NV3, lift = 2.0): NV3 {
    const hAbove = max(wp.y.sub(this.hf.sampleHeight(wp.xz)).add(lift), 0.0);
    const li = clamp(
      log2(hAbove.div(LAYER_BASE).max(1)).div(Math.log2(LAYER_RATIO)),
      0,
      PROBE_LAYERS - 1,
    );
    const uvw = vec3(
      wp.x.sub(TERRAIN_CX).div(WORLD_SIZE).add(0.5),
      wp.z.sub(TERRAIN_CZ).div(WORLD_SIZE).add(0.5),
      li.add(0.5).div(PROBE_LAYERS),
    );
    const R = texture3D(this.texR, uvw, 0);
    const G = texture3D(this.texG, uvw, 0);
    const B = texture3D(this.texB, uvw, 0);
    const a0 = 0.6;
    const a1 = 0.7;
    const e = vec3(
      R.x.mul(a0).add(dot(R.yzw, n).mul(a1)),
      G.x.mul(a0).add(dot(G.yzw, n).mul(a1)),
      B.x.mul(a0).add(dot(B.yzw, n).mul(a1)),
    );
    return max(e, vec3(0));
  }
}
