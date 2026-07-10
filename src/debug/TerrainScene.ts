/**
 * World scene — Phase 1: the plateau, wadi, quarry, floodplain, and Nile
 * corridor as terrain. Lighting is a placeholder sun (Phase 2 brings the
 * Hillaire atmosphere + CSM); water is a flat stage plane (Phase 5 brings
 * the flowing Nile) — both are honest stand-ins so the geography reads.
 */

import { DirectionalLight, HemisphereLight, Mesh, PlaneGeometry, Vector3 } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { float, vec3 } from 'three/tsl';
import { Heightfield } from '../world/Heightfield';
import { TerrainTiles } from '../world/TerrainTiles';
import { NILE_WATER_Y, TERRAIN_CZ } from '../world/WorldConst';
import type { WorldContext } from './Scenes';

/** solar position for Giza on the canonical equinox day, hour T (0..24).
 *  Phase 2 replaces this with the full astronomical model + atmosphere. */
export function sunDirection(T: number): Vector3 {
  const lat = (29.9792 * Math.PI) / 180;
  const hourAngle = ((T - 12) / 24) * 2 * Math.PI;
  const decl = 0; // equinox
  const sinAlt =
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const alt = Math.asin(sinAlt);
  const cosAz =
    (Math.sin(decl) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  let azFromN = Math.acos(Math.min(1, Math.max(-1, cosAz)));
  if (T > 12) azFromN = 2 * Math.PI - azFromN; // afternoon: sun in the west
  // world frame: +X east, +Z south, north = −Z. Azimuth measured from north.
  const dx = Math.sin(azFromN);
  const dz = -Math.cos(azFromN);
  const y = Math.sin(alt);
  const h = Math.cos(alt);
  return new Vector3(dx * h, y, dz * h);
}

export async function buildWorldScene(ctx: WorldContext): Promise<void> {
  const { engine, seed } = ctx;
  const { scene, renderer, camera } = engine;

  const hf = await Heightfield.generate(renderer, engine.params, seed, ctx.progress);

  ctx.progress(0.92, 'terrain: building tiles');
  const debugView = new URLSearchParams(window.location.search).get('view');
  const tiles = new TerrainTiles(hf, debugView);
  scene.add(tiles.mesh);
  scene.add(tiles.farShell);
  engine.onUpdate(() => {
    tiles.update(camera);
    engine.stats.counters['terrain.tiles'] = tiles.activeTiles;
  });

  // --- placeholder water stages (flat, dark; Phase 5 = flowing river) ------
  // constrained to the river corridor + harbor so terrain that happens to
  // dip below stage level elsewhere never shows phantom water
  const mkWater = (): MeshPhysicalNodeMaterial => {
    const m = new MeshPhysicalNodeMaterial();
    m.colorNode = vec3(0.05, 0.1, 0.1);
    m.roughnessNode = float(0.08);
    m.metalnessNode = float(0);
    return m;
  };
  const river = new Mesh(new PlaneGeometry(700, 4600), mkWater());
  river.rotateX(-Math.PI / 2);
  river.position.set(2050, NILE_WATER_Y, TERRAIN_CZ);
  river.receiveShadow = true;
  scene.add(river);
  const harbor = new Mesh(new PlaneGeometry(950, 560), mkWater());
  harbor.rotateX(-Math.PI / 2);
  harbor.position.set(1330, NILE_WATER_Y, -130);
  harbor.receiveShadow = true;
  scene.add(harbor);

  // --- placeholder sun + skylight (Phase 2: atmosphere/IBL/CSM) -------------
  const T = engine.params.timeOfDay;
  const sunDir = sunDirection(T);
  const sun = new DirectionalLight(0xfff0d8, 3.2);
  sun.position.copy(sunDir.clone().multiplyScalar(2500));
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const S = 1600;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 6000;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(new HemisphereLight(0x9db8e0, 0x6a5940, 0.55));

  // --- hooks ------------------------------------------------------------------
  engine.hooks.groundProbe = (x, z) => ({
    ground: hf.heightAtCpu(x, z),
    water: hf.waterYAtCpu(x, z),
  });

  // default spawn: SE of the pyramid site looking NW across the plateau
  const sx = 420;
  const sz = 520;
  engine.hooks.initialPose = {
    p: [sx, hf.heightAtCpu(sx, sz) + 1.7, sz],
    yaw: Math.PI * 0.78,
    pitch: 0.02,
  };
  engine.hooks.initialPoseMode = 'fly';

  engine.stats.counters['terrain.res'] = hf.res;
  ctx.progress(0.97, 'world: done');
}
