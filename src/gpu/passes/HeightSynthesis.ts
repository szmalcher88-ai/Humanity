/**
 * Heightfield synthesis — bakes the authored Giza terrain into storage
 * buffers at a given resolution: height (world Y), hardness, quarry-depth
 * potential, and a packed mask field for downstream passes.
 */

import type { Renderer, StorageBufferNode } from 'three/webgpu';
import { Fn, If, Return, float, instancedArray, vec2, vec4 } from 'three/tsl';
import type { GizaParams } from '../../world/GizaControl';
import { gizaTerrain } from '../../world/GizaControl';
import { TERRAIN_CX, TERRAIN_CZ, WORLD_SIZE } from '../../world/WorldConst';
import { BAND, bandIndex, bandOffset, runBanded } from '../Banded';

export type FloatBuffer = StorageBufferNode<'float'>;
export type Vec4Buffer = StorageBufferNode<'vec4'>;

export interface SynthesisResult {
  /** height in world Y, res×res row-major */
  height: FloatBuffer;
  /** rock hardness 0..1 */
  hardness: FloatBuffer;
  /** quarry extraction-depth potential (m) */
  quarryDepth: FloatBuffer;
  /** masks: x=floodplain y=river z=harbor w=wadi */
  masksA: Vec4Buffer;
  /** masks: x=quarry y=bedrockExposure z=moisture w=unused */
  masksB: Vec4Buffer;
  res: number;
}

/**
 * VRAM note (4 GB dev GPU): vec4 mask buffers at 4096² would cost 268 MB
 * each — masks are only baked when `withMasks` (the sim-res run). The
 * full-res run bakes height/hardness/quarryDepth only (67 MB each).
 */
export async function runHeightSynthesis(
  renderer: Renderer,
  res: number,
  gp: GizaParams,
  withMasks: boolean,
  onProgress?: (f: number) => void,
): Promise<SynthesisResult> {
  const height = instancedArray(res * res, 'float');
  const hardness = instancedArray(res * res, 'float');
  const quarryDepth = instancedArray(res * res, 'float');
  const maskN = withMasks ? res * res : 4;
  const masksA = instancedArray(maskN, 'vec4');
  const masksB = instancedArray(maskN, 'vec4');

  // BANDED (see gpu/Banded.ts): at 4096² this is 16.7M invocations each
  // evaluating the whole authored terrain function. As one dispatch it ran
  // past the Windows TDR watchdog on a slow adapter, the display driver reset,
  // and the app went black mid-boot. Same work, same output, short jobs.
  const uOff = bandOffset();
  const kernel = Fn(() => {
    const i = bandIndex(uOff);
    If(i.greaterThanEqual(res * res), () => {
      Return();
    });
    const x = i.mod(res);
    const y = i.div(res);
    const wpos = vec2(float(x).add(0.5), float(y).add(0.5))
      .div(res)
      .sub(0.5)
      .mul(WORLD_SIZE)
      .add(vec2(TERRAIN_CX, TERRAIN_CZ));
    const g = gizaTerrain(wpos, gp, 'full');
    height.element(i).assign(g.height);
    hardness.element(i).assign(g.hardness);
    quarryDepth.element(i).assign(g.quarryDepth);
    if (withMasks) {
      masksA.element(i).assign(vec4(g.floodplain, g.river, g.harbor, g.wadi));
      masksB.element(i).assign(vec4(g.quarry, g.bedrockExposure, g.moisture, g.worked));
    }
  });
  const total = res * res;
  const node = kernel().compute(Math.min(total, BAND));
  node.setName(`heightSynthesis_${res}`);

  await runBanded(renderer, node, uOff, total, BAND, onProgress);
  return { height, hardness, quarryDepth, masksA, masksB, res };
}
