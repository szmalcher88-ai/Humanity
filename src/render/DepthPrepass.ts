/**
 * Depth prepass for high-overdraw instanced vegetation (Phase 7 — PERF I).
 * Ported from PROJECT LAAS `render/VegPrepass.ts` (MIT) — see
 * LICENSE-THIRD-PARTY.
 *
 * A tuft field shades every covered pixel several times over: instances inside
 * one InstancedMesh rasterize in buffer order, so early-Z never gets a chance.
 * The classic fix, zero visual change: rasterize the SAME geometry depth-only
 * first, then run the shaded pass with depthFunc=EQUAL so the full lighting
 * model (PCSS taps, probe GI, BRDF) executes exactly once per visible pixel.
 *
 * Correctness hinges on both passes producing identical positions and
 * identical discards: the twin shares the live positionNode (same TSL graph,
 * same uniforms, same storage buffers), and `@invariant` on the clip-space
 * output stops the driver from reassociating the position math differently
 * between the two pipelines (a last-ulp mismatch fails depthFunc=EQUAL and the
 * shaded pass drops out, leaving blade-shaped holes to the sky).
 *
 * The twin uses a bare NodeMaterial with colorWrite off — a technical depth
 * writer, not a world surface (§9's MeshBasicMaterial ban targets unlit world
 * SHADING; nothing here shades). Shadow passes are unaffected: three builds its
 * own override material for them and copies only positionNode/colorNode/
 * depthNode, so depthFunc=EQUAL on the colour material never reaches a cascade.
 */

import { EqualDepth, Mesh, type Material, type Side } from 'three';
import { NodeMaterial, type WebGPURenderer } from 'three/webgpu';
import { vec4 } from 'three/tsl';

/**
 * Mark every vertex shader's clip-space position `@invariant`. The builder
 * class isn't exported from the three/webgpu bundle — take the prototype from
 * a live instance. Cost: only position-expression optimisations are
 * restricted, identically in every pipeline.
 */
export function installPositionInvariance(renderer: WebGPURenderer): void {
  const backend = renderer.backend as unknown as {
    createNodeBuilder(o: object, r: unknown): object;
  };
  const builder = backend.createNodeBuilder(new Mesh(), renderer);
  const proto = Object.getPrototypeOf(builder) as {
    _getWGSLVertexCode(d: unknown): string;
    __akhetInvariant?: boolean;
  };
  if (proto.__akhetInvariant === true) return;
  proto.__akhetInvariant = true;
  const orig = proto._getWGSLVertexCode;
  proto._getWGSLVertexCode = function (this: unknown, d: unknown): string {
    return orig.call(this, d).replace(
      '@builtin( position ) builtinClipSpace',
      '@invariant @builtin( position ) builtinClipSpace',
    );
  };
}

export interface PrepassNodes {
  positionNode: unknown;
  /** alpha-tested cutouts: share the opacity chain + threshold */
  opacityNode?: unknown;
  alphaTest?: number;
  side: Side;
}

interface NodeMatShape {
  positionNode: unknown;
  opacityNode: unknown;
  colorNode: unknown;
}

/**
 * Build the depth-only twin for `mesh` (sharing its geometry — and with it the
 * indirect-draw slot, so instance culling drives both passes) and flip the
 * colour material to depthFunc=EQUAL. The caller adds the twin to the scene.
 */
export function depthPrepassTwin(mesh: Mesh, nodes: PrepassNodes): Mesh {
  const m = new NodeMaterial();
  const ms = m as unknown as NodeMatShape;
  ms.positionNode = nodes.positionNode;
  if (nodes.opacityNode !== undefined) {
    ms.opacityNode = nodes.opacityNode;
    m.alphaTest = nodes.alphaTest ?? 0.5;
    // alpha = colorNode.a × opacity — pin a=1 so the test sees the cutout
    ms.colorNode = vec4(0, 0, 0, 1);
  }
  m.side = nodes.side;
  m.colorWrite = false;
  m.depthWrite = true;
  m.depthTest = true;
  m.fog = false;

  const twin = new Mesh(mesh.geometry, m);
  twin.frustumCulled = false;
  twin.castShadow = false;
  twin.receiveShadow = false;
  twin.renderOrder = -100; // before all opaque — later draws z-cull against it
  twin.name = `${mesh.name || 'veg'}-depth`;

  const colorMat = mesh.material as Material;
  colorMat.depthFunc = EqualDepth;
  colorMat.depthWrite = false;
  return twin;
}
