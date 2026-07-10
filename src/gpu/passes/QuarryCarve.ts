/**
 * Quarry-cut carving (brief §3.4, canon Vol. IV District 8): turns the
 * smooth extraction-depth bowl into TERRACED faces at block scale.
 *
 * Real Old Kingdom quarrying: workers isolated blocks with narrow trenches,
 * then split them free by lifts, leaving stepped faces whose risers are
 * block-height (~1.1 m) and whose bays advance unevenly. We reproduce:
 *  - depth quantized into lifts of ~1.12 m (block + mortar bed)
 *  - bay fronts jittered by worley cells (teams advanced at different rates)
 *  - separation-trench grid scored into the current working floor
 *  - a graded haul-out floor toward the SE exit (kept by the bowl's sector
 *    falloff in GizaControl)
 */

import type { Renderer } from 'three/webgpu';
import {
  Fn,
  If,
  Return,
  abs,
  clamp,
  float,
  instanceIndex,
  min,
  smoothstep,
  vec2,
} from 'three/tsl';
import { valueNoise2 } from '../noise/NoiseTSL';
import { TERRAIN_CX, TERRAIN_CZ, WORLD_SIZE } from '../../world/WorldConst';
import type { FloatBuffer } from './HeightSynthesis';

const LIFT = 1.12; // extraction lift height (m) ~ one course + bed
const TRENCH_PITCH = 2.6; // separation-trench spacing (m) ~ block + trench
const TRENCH_W = 0.55; // trench width (m)
const TRENCH_D = 0.5; // trench depth on the working floor (m)

export async function runQuarryCarve(
  renderer: Renderer,
  height: FloatBuffer,
  quarryDepth: FloatBuffer,
  res: number,
): Promise<void> {
  const N = res * res;
  const kernel = Fn(() => {
    const i = instanceIndex;
    If(i.greaterThanEqual(N), () => {
      Return();
    });
    const d = quarryDepth.element(i).toVar();
    If(d.lessThanEqual(0.02), () => {
      Return();
    });
    const x = i.mod(res);
    const y = i.div(res);
    const wpos = vec2(float(x).add(0.5), float(y).add(0.5))
      .div(res)
      .sub(0.5)
      .mul(WORLD_SIZE)
      .add(vec2(TERRAIN_CX, TERRAIN_CZ));

    // bay jitter: teams advance unevenly — ONE low-frequency octave offsets
    // the depth field before quantizing (two octaves made the bowl fizzy)
    const bay = valueNoise2(wpos.div(34)).mul(1.3);
    const dJit = d.add(bay.sub(0.65)).max(0);

    // terrace: quantize into lifts; risers stay sharp (small blend)
    const lifts = dJit.div(LIFT);
    const tread = lifts.floor();
    const riser = smoothstep(0.82, 0.98, lifts.fract());
    const dTerr = tread.add(riser).mul(LIFT);

    // separation trenches: shallow grid scored into the CURRENT working
    // floor (only where some extraction has happened but rock remains —
    // the deepest floors are finished, the rim is untouched)
    const working = smoothstep(0.4, 1.2, dTerr).mul(smoothstep(9.5, 6.0, dTerr));
    const gx = abs(wpos.x.div(TRENCH_PITCH).fract().sub(0.5)).mul(TRENCH_PITCH);
    const gz = abs(wpos.y.div(TRENCH_PITCH).fract().sub(0.5)).mul(TRENCH_PITCH);
    const nearLine = min(gx, gz);
    const trench = smoothstep(TRENCH_W, TRENCH_W * 0.35, nearLine)
      .mul(TRENCH_D)
      .mul(working);

    const h = height.element(i);
    height.element(i).assign(h.sub(clamp(dTerr, 0, 14)).sub(trench));
  })().compute(N);
  kernel.setName('quarryCarve');
  await renderer.computeAsync(kernel);
}
