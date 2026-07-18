/**
 * World scene — the plateau, wadi, quarry, floodplain, and Nile corridor,
 * lit by the Phase-2 stack: Hillaire atmosphere + astronomical sun + IBL +
 * CSM/PCSS shadows + post (aerial perspective, GTAO, TRAA, bloom, grade).
 * Water is a flat stage plane until Phase 5's flowing Nile.
 */

import { Mesh, PlaneGeometry } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { float, vec3 } from 'three/tsl';
import { ProbeGI } from '../gpu/passes/ProbeGI';
import { buildKhufuComplex } from '../monuments/KhufuComplex';
import { buildMonuments, updateMonumentLods } from '../monuments/Monuments';
import { PostStack } from '../render/PostStack';
import { setupSunShadows } from '../render/ShadowSetup';
import { Clouds } from '../sky/Clouds';
import { SunSky } from '../sky/SunSky';
import { Heightfield } from '../world/Heightfield';
import { TerrainTiles } from '../world/TerrainTiles';
import { NILE_WATER_Y, TERRAIN_CZ } from '../world/WorldConst';
import type { WorldContext } from './Scenes';

export async function buildWorldScene(ctx: WorldContext): Promise<void> {
  const { engine, seed } = ctx;
  const { scene, renderer, camera } = engine;

  const hf = await Heightfield.generate(renderer, engine.params, seed, ctx.progress);

  // sky FIRST: the probe field needs the atmosphere, and materials take
  // their GI hook at construction time
  ctx.progress(0.84, 'sky: atmosphere LUTs');
  const sunSky = new SunSky(engine, engine.params.timeOfDay);
  await sunSky.init(renderer);

  ctx.progress(0.85, 'gi: irradiance probe field');
  const gi = new ProbeGI(hf, sunSky.atmosphere);
  await gi.init(renderer);
  engine.onUpdate(() => gi.tick(renderer));
  sunSky.dimAmbientForGI();

  ctx.progress(0.86, 'terrain: building tiles');
  const debugView = new URLSearchParams(window.location.search).get('view');
  const tiles = new TerrainTiles(hf, debugView, { gi });
  scene.add(tiles.mesh);
  scene.add(tiles.farShell);
  engine.onUpdate(() => {
    tiles.update(camera);
    engine.stats.counters['terrain.tiles'] = tiles.activeTiles;
  });

  ctx.progress(0.88, 'monuments: casing the pyramids');
  const sites = buildMonuments(scene, seed, gi);
  engine.onUpdate(() => updateMonumentLods(sites, camera.position));
  engine.stats.counters['monuments.stones'] = sites.reduce(
    (a, s) => a + s.lod.stoneCount,
    0,
  );

  ctx.progress(0.89, 'monuments: temples, causeway, mastaba fields');
  buildKhufuComplex(scene, seed, gi);

  // --- placeholder water stages (flat, dark; Phase 5 = flowing river) ------
  // constrained to the river corridor + harbor so terrain that happens to
  // dip below stage level elsewhere never shows phantom water
  const mkWater = (): MeshPhysicalNodeMaterial => {
    const m = new MeshPhysicalNodeMaterial();
    m.colorNode = vec3(0.05, 0.1, 0.1);
    m.roughnessNode = float(0.08);
    m.metalnessNode = float(0);
    // classic depth: bias water away so terrain wins far coplanar ties
    m.polygonOffset = true;
    m.polygonOffsetFactor = 2;
    m.polygonOffsetUnits = 8;
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

  // --- rest of the lighting stack ---------------------------------------------
  ctx.progress(0.92, 'sky: cloud noise');
  const clouds = new Clouds(sunSky.atmosphere);
  await clouds.init(renderer);
  await clouds.refreshShadow(renderer);
  engine.onUpdate((dt) => clouds.tick(renderer, dt));

  ctx.progress(0.94, 'shadows: CSM + PCSS');
  setupSunShadows(
    sunSky.sun,
    camera,
    (wxz) => clouds.shadowAt(wxz),
    { maxFar: 3600, lightMargin: 900 },
  );

  ctx.progress(0.96, 'post: pipeline');
  const post = new PostStack(engine, sunSky.atmosphere, engine.params.timeOfDay, clouds);
  engine.post = post;

  // --- hooks ------------------------------------------------------------------
  engine.hooks.setTimeOfDay = (t): void => {
    engine.params.timeOfDay = t;
    void sunSky.setTimeOfDay(t).then(() => clouds.refreshShadow(renderer));
    gi.invalidate(); // probes re-converge fast after the sun jump
    post.setTimeOfDay(t);
  };
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
