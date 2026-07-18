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

export class NileWater {
  readonly meshes: Mesh[] = [];
  private uTime = uniform(0);

  constructor(hf: Heightfield, atmosphere: Atmosphere) {
    const noiseA = hf.noiseA as NonNullable<typeof hf.noiseA>;

    const mkMaterial = (flowSpeed: number): MeshPhysicalNodeMaterial => {
      const m = new MeshPhysicalNodeMaterial();
      const wxz = positionWorld.xz;
      const t = float(this.uTime);

      // --- ripple normal: two advected gradient fetches ---------------------
      // flow toward −z (north); cross-drift breaks the lattice
      const flow1 = vec2(0.03, -1).normalize().mul(t.mul(flowSpeed));
      const flow2 = vec2(-0.22, -1).normalize().mul(t.mul(flowSpeed * 0.62));
      const g1 = texture(noiseA, wxz.add(flow1).div(0.11 * PERIOD_FBM)).ba;
      const g2 = texture(noiseA, wxz.add(flow2).div(0.043 * PERIOD_FBM)).ba;
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
      const rdir = reflect(view, nFlat);
      const rdirUp = vec3(rdir.x, rdir.y.abs().max(0.02), rdir.z);
      const sky = atmosphere.skyColor(rdirUp as unknown as NV3);
      const cosV = clamp(view.negate().dot(nFlat), 0, 1);
      const fresnel = float(0.02).add(
        float(0.98).mul(float(1).sub(cosV).pow(5)),
      );

      m.colorNode = mix(body, sky, fresnel.clamp(0, 0.85));
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

    const harbor = new Mesh(new PlaneGeometry(950, 560, 12, 8), mkMaterial(0.12));
    harbor.rotateX(-Math.PI / 2);
    harbor.position.set(1330, NILE_WATER_Y, -130);
    harbor.receiveShadow = true;
    this.meshes.push(harbor);
  }

  /** advance flow (call with engine worldTime — freeze-safe) */
  tick(worldTime: number): void {
    this.uTime.value = worldTime;
  }
}
