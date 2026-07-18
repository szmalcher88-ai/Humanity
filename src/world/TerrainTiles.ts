/**
 * Terrain rendering: CDLOD quadtree of instanced grid patches + far vista
 * shell. Ported from PROJECT LAAS (MIT) and adapted to the Giza frame
 * (off-center grid, desert far shell, Giza splat material).
 *
 * - One InstancedMesh draws every active tile; per-tile data lives in a
 *   storage buffer updated only when the quadtree changes.
 * - CDLOD vertex morphing + skirts → no cracks, no pops.
 * - Far shell: radial ring from the grid edge to FAR_RADIUS with the
 *   analytic 'far' branch of gizaTerrain (valley continues, west desert).
 */

import { InstancedMesh, PlaneGeometry, RingGeometry, Mesh, type PerspectiveCamera } from 'three';
import { IrradianceNode, MeshPhysicalNodeMaterial, type StorageBufferNode } from 'three/webgpu';
import {
  cameraPosition,
  clamp,
  float,
  fract,
  smoothstep,
  instanceIndex,
  instancedArray,
  mix,
  positionLocal,
  positionWorld,
  texture,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { DISP, buildTerrainShading } from '../render/TerrainMaterial';
import { PERIOD_FBM, PERIOD_RID, PERIOD_VAL } from '../gpu/passes/NoiseBake';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NV3 } from '../gpu/TSLTypes';
import type { Heightfield } from './Heightfield';
import { gizaTerrain } from './GizaControl';
import { FAR_RADIUS, TERRAIN_CX, TERRAIN_CZ, WORLD_HALF, WORLD_SIZE } from './WorldConst';

const MAX_TILES = 2048;
const PATCH_SEGS = 64;
const SPLIT_K = 2.1;
const MIN_TILE = 64;
const MIN_TILE_ROUGH = 32;

export class TerrainTiles {
  readonly mesh: InstancedMesh;
  readonly farShell: Mesh;
  private tileData: Float32Array;
  private tileBuf: StorageBufferNode<'vec4'>;
  private hf: Heightfield;
  private lastCamX = Infinity;
  private lastCamZ = Infinity;
  activeTiles = 0;
  private rangePyr: Float32Array[] = [];

  constructor(
    hf: Heightfield,
    debugView: string | null = null,
    opts: { gi?: ProbeGI } = {},
  ) {
    this.hf = hf;
    this.buildRangePyramid();
    const gi = opts.gi ?? null;
    const giPatch = (
      m: MeshPhysicalNodeMaterial,
      normal: NV3,
    ): void => {
      if (!gi) return;
      const irr = gi.irradiance(positionWorld, normal);
      (m as unknown as { setupLightMap: () => unknown }).setupLightMap = () =>
        new IrradianceNode(irr as unknown as ConstructorParameters<typeof IrradianceNode>[0]);
    };

    this.tileData = new Float32Array(MAX_TILES * 4);
    this.tileBuf = instancedArray(this.tileData, 'vec4');

    // patch with one extra skirt ring beyond ±0.5
    const s = 1 / PATCH_SEGS;
    const patch = new PlaneGeometry(1 + 2 * s, 1 + 2 * s, PATCH_SEGS + 2, PATCH_SEGS + 2);
    patch.rotateX(-Math.PI / 2);

    const mat = new MeshPhysicalNodeMaterial();
    mat.specularIntensity = 0.35; // silver-wash guard (LAAS finding)
    const tile = this.tileBuf.element(instanceIndex);
    const tileOrigin = tile.xy;
    const tileSize = tile.z;

    // CDLOD morph + skirt drop
    const rawLocal = positionLocal.xz;
    const clampedLocal = clamp(rawLocal, -0.5, 0.5);
    const isSkirt = rawLocal
      .abs()
      .x.max(rawLocal.abs().y)
      .greaterThan(0.5001)
      .select(float(1), float(0));
    const local = clampedLocal.mul(tileSize);
    const wpos0 = local.add(tileOrigin).toVar();
    const quad = tileSize.div(PATCH_SEGS);
    const gridUV = clampedLocal.add(0.5).mul(PATCH_SEGS);
    const odd = fract(gridUV.mul(0.5)).mul(2);
    const snapped = wpos0.sub(odd.mul(quad));
    const camD = wpos0.sub(cameraPosition.xz).length();
    const rangeEnd = tileSize.mul(SPLIT_K).mul(2);
    const morphK = clamp(camD.sub(rangeEnd.mul(0.7)).div(rangeEnd.mul(0.24)), 0, 1);
    const wpos = mix(wpos0, snapped, morphK);

    const skirtDrop = isSkirt.mul(tileSize.mul(0.045).add(2.5));
    const hSample = hf.sampleHeight(wpos).sub(skirtDrop);

    // micro-displacement (Pillar A: no bare smooth ground) — amplitude by
    // surface family, faded out by DISP.fade0..fade1 meters
    const uvV = wpos.sub(vec2(TERRAIN_CX, TERRAIN_CZ)).div(WORLD_SIZE).add(0.5);
    const nsV = texture(hf.normalTex, uvV, 0);
    const mskV = hf.masksTex ? texture(hf.masksTex, uvV, 0) : vec4(0, 0, 0, 0);
    const fldV = hf.fieldsTex ? texture(hf.fieldsTex, uvV, 0) : vec4(0, 0, 0, 0);
    const rockK = smoothstep(DISP.slopeKnee0, DISP.slopeKnee1, nsV.w).max(
      mskV.w.mul(0.8),
    );
    const gravelK = mskV.z.mul(float(DISP.gravel));
    // quarry floors are WORKED flat — suppress natural rock lumpiness there
    const workedK = fldV.z.mul(0.85);
    const dispAmp = mix(float(DISP.base), float(DISP.rock), rockK)
      .max(gravelK)
      .mul(workedK.oneMinus())
      .mul(clamp(float(DISP.fade1).sub(camD).div(DISP.fade1 - DISP.fade0), 0, 1));
    const noiseA = hf.noiseA as NonNullable<typeof hf.noiseA>;
    const noiseB = hf.noiseB as NonNullable<typeof hf.noiseB>;
    const f1 = texture(noiseA, wpos.div(DISP.sF1 * PERIOD_FBM), 0)
      .y.mul(2)
      .sub(1);
    const f2 = texture(noiseA, wpos.div(DISP.sF2 * PERIOD_VAL).add(vec2(0.31, 0.77)), 0)
      .x.mul(2)
      .sub(1);
    const r1 = texture(noiseB, wpos.div(DISP.sRid * PERIOD_RID), 0)
      .z.mul(2)
      .sub(1);
    const disp = f1
      .mul(DISP.wF1)
      .add(f2.mul(DISP.wF2))
      .add(r1.mul(rockK.mul(1 - DISP.ridBase).add(DISP.ridBase)).mul(DISP.wRid))
      .mul(dispAmp);
    mat.positionNode = vec3(wpos.x, hSample.add(disp), wpos.y);
    mat.castShadowPositionNode = vec3(
      wpos0.x,
      hf.sampleHeightNearest(wpos0).sub(skirtDrop),
      wpos0.y,
    );

    // fragment-stage world xz: positionNode rebuilt the vertex, so
    // positionWorld carries the displaced world position
    const worldXZ = positionWorld.xz;
    const worldUV = positionWorld.xz
      .sub(vec2(TERRAIN_CX, TERRAIN_CZ))
      .div(WORLD_SIZE)
      .add(0.5);
    const shading = buildTerrainShading({
      normalTex: hf.normalTex,
      fieldsTex: hf.fieldsTex as NonNullable<typeof hf.fieldsTex>,
      masksTex: hf.masksTex as NonNullable<typeof hf.masksTex>,
      noiseA,
      noiseB,
      wpos: worldXZ,
      uv: worldUV,
      far: false,
    });
    mat.colorNode = shading.colorNode;
    mat.normalNode = shading.normalNode;
    mat.roughnessNode = shading.roughnessNode;
    mat.metalnessNode = float(0);
    giPatch(mat, shading.worldNormalNode);

    if (debugView === 'lod') {
      const lod = tile.w;
      const edge = positionLocal.xz.abs().x.max(positionLocal.xz.abs().y);
      const grid = edge.greaterThan(0.492).select(float(0.25), float(1));
      mat.colorNode = vec3(0.02);
      mat.emissiveNode = vec3(
        lod.mul(0.9173).add(0.13).fract(),
        lod.mul(0.3719).add(0.41).fract(),
        lod.mul(0.7177).add(0.79).fract(),
      ).mul(grid);
    }
    if (debugView === 'masks') {
      mat.colorNode = vec3(0.02);
      const m = texture(hf.masksTex as NonNullable<typeof hf.masksTex>, worldUV);
      const f = texture(hf.fieldsTex as NonNullable<typeof hf.fieldsTex>, worldUV);
      mat.emissiveNode = vec3(m.x, f.y.mul(0.6), f.w.max(f.z));
    }

    this.mesh = new InstancedMesh(patch, mat, MAX_TILES);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;

    /* --- far shell ------------------------------------------------------- */
    const ring = new RingGeometry(WORLD_HALF * 0.952, FAR_RADIUS, 200, 40);
    ring.rotateX(-Math.PI / 2);
    const farMat = new MeshPhysicalNodeMaterial();
    farMat.specularIntensity = 0.35;
    const fxz = positionLocal.xz.add(vec2(TERRAIN_CX, TERRAIN_CZ));
    const farMacro = gizaTerrain(fxz, hf.gp, 'far');
    const baked = hf.sampleHeight(fxz);
    const edgeBlend = clamp(
      positionLocal.xz.abs().x.max(positionLocal.xz.abs().y)
        .sub(WORLD_HALF * 0.95)
        .div(WORLD_HALF * 0.05),
      0,
      1,
    );
    const farH = mix(baked, farMacro.height, edgeBlend).sub(
      mix(float(9), float(2.5), edgeBlend),
    );
    farMat.positionNode = vec3(fxz.x, farH, fxz.y);
    const eN = 60;
    const hX = gizaTerrain(fxz.add(vec2(eN, 0)), hf.gp, 'far').height;
    const hZ = gizaTerrain(fxz.add(vec2(0, eN)), hf.gp, 'far').height;
    const farNormal = vec3(farMacro.height.sub(hX), float(eN), farMacro.height.sub(hZ))
      .normalize();
    const farNS = varying(vec4(farNormal, float(0.05)));
    void farNS;
    const farShading = buildTerrainShading({
      normalTex: hf.normalTex,
      fieldsTex: hf.fieldsTex as NonNullable<typeof hf.fieldsTex>,
      masksTex: hf.masksTex as NonNullable<typeof hf.masksTex>,
      noiseA,
      noiseB,
      wpos: worldXZ,
      uv: worldUV,
      far: true,
    });
    farMat.colorNode = farShading.colorNode;
    farMat.normalNode = farShading.normalNode;
    farMat.roughnessNode = farShading.roughnessNode;
    farMat.metalnessNode = float(0);
    giPatch(farMat, farShading.worldNormalNode);
    this.farShell = new Mesh(ring, farMat);
    // farMat.positionNode uses positionLocal directly (already offset by
    // fxz = local + TERRAIN_C in the height math) — mesh stays at origin
    this.farShell.frustumCulled = false;
    this.farShell.receiveShadow = true;
  }

  private buildRangePyramid(): void {
    const heights = this.hf.cpuHeights;
    if (!heights) return;
    const res = Math.sqrt(heights.length) | 0;
    const base = 64;
    const cellPx = res / base;
    const l0 = new Float32Array(base * base);
    for (let cy = 0; cy < base; cy++) {
      for (let cx = 0; cx < base; cx++) {
        let mn = Infinity;
        let mx = -Infinity;
        const x0 = cx * cellPx;
        const y0 = cy * cellPx;
        for (let y = y0; y < y0 + cellPx; y += 4) {
          const row = y * res;
          for (let x = x0; x < x0 + cellPx; x += 4) {
            const v = heights[row + x] as number;
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
        }
        l0[cy * base + cx] = mx - mn;
      }
    }
    this.rangePyr = [l0];
    for (let side = base >> 1; side >= 1; side >>= 1) {
      const prev = this.rangePyr[this.rangePyr.length - 1] as Float32Array;
      const pSide = side * 2;
      const lvl = new Float32Array(side * side);
      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          lvl[cy * side + cx] = Math.max(
            prev[cy * 2 * pSide + cx * 2] as number,
            prev[cy * 2 * pSide + cx * 2 + 1] as number,
            prev[(cy * 2 + 1) * pSide + cx * 2] as number,
            prev[(cy * 2 + 1) * pSide + cx * 2 + 1] as number,
          );
        }
      }
      this.rangePyr.push(lvl);
    }
  }

  private heightRange(ox: number, oz: number, size: number): number {
    if (this.rangePyr.length === 0) return 0;
    const lvl = Math.max(
      0,
      Math.min(
        Math.round(Math.log2(Math.max(size, MIN_TILE) / MIN_TILE)),
        this.rangePyr.length - 1,
      ),
    );
    const side = 64 >> lvl;
    const cell = WORLD_SIZE / side;
    const cx = Math.max(
      0,
      Math.min(Math.floor((ox - TERRAIN_CX + WORLD_SIZE / 2) / cell), side - 1),
    );
    const cy = Math.max(
      0,
      Math.min(Math.floor((oz - TERRAIN_CZ + WORLD_SIZE / 2) / cell), side - 1),
    );
    return (this.rangePyr[lvl] as Float32Array)[cy * side + cx] as number;
  }

  update(camera: PerspectiveCamera): void {
    const cx = camera.position.x;
    const cz = camera.position.z;
    if (Math.hypot(cx - this.lastCamX, cz - this.lastCamZ) < 20 && this.activeTiles > 0) return;
    this.lastCamX = cx;
    this.lastCamZ = cz;

    let n = 0;
    const data = this.tileData;
    const emit = (ox: number, oz: number, size: number, lod: number): void => {
      if (n >= MAX_TILES) return;
      data[n * 4] = ox;
      data[n * 4 + 1] = oz;
      data[n * 4 + 2] = size;
      data[n * 4 + 3] = lod;
      n++;
    };
    const cy = camera.position.y;
    const recurse = (ox: number, oz: number, size: number, lod: number): void => {
      const dx = Math.max(Math.abs(cx - ox) - size / 2, 0);
      const dz = Math.max(Math.abs(cz - oz) - size / 2, 0);
      const groundY = this.hf.heightAtCpu(ox, oz);
      const dy = Math.max(Math.abs(cy - groundY) - 250, 0) * 0.8;
      const dist = Math.hypot(dx, dz, dy);
      const range = this.heightRange(ox, oz, size);
      const errBoost = Math.min(1 + (range / size) * 0.8, 1.8);
      const minTile = range > size * 0.85 ? MIN_TILE_ROUGH : MIN_TILE;
      if (size > minTile && dist < size * SPLIT_K * errBoost) {
        const q = size / 4;
        const h = size / 2;
        recurse(ox - q, oz - q, h, lod + 1);
        recurse(ox + q, oz - q, h, lod + 1);
        recurse(ox - q, oz + q, h, lod + 1);
        recurse(ox + q, oz + q, h, lod + 1);
      } else {
        emit(ox, oz, size, lod);
      }
    };
    recurse(TERRAIN_CX, TERRAIN_CZ, WORLD_SIZE, 0);

    this.activeTiles = n;
    this.mesh.count = n;
    const attr = this.tileBuf.value;
    attr.needsUpdate = true;
  }
}
