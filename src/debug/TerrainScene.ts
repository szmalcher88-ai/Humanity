/**
 * World scene — the plateau, wadi, quarry, floodplain, and Nile corridor,
 * lit by the Phase-2 stack: Hillaire atmosphere + astronomical sun + IBL +
 * CSM/PCSS shadows + post (aerial perspective, GTAO, TRAA, bloom, grade).
 * Water is a flat stage plane until Phase 5's flowing Nile.
 */

import { ProbeGI } from '../gpu/passes/ProbeGI';
import { buildKhufuComplex } from '../monuments/KhufuComplex';
import { buildMonuments, updateMonumentLods } from '../monuments/Monuments';
import { PostStack } from '../render/PostStack';
import { setupSunShadows } from '../render/ShadowSetup';
import { Clouds } from '../sky/Clouds';
import { SunSky } from '../sky/SunSky';
import { buildFields } from '../vegetation/Fields';
import { buildPalms } from '../vegetation/Palms';
import { NileWater } from '../water/NileWater';
import { buildHarbor } from '../water/Vessels';
import { Heightfield } from '../world/Heightfield';
import { TerrainTiles } from '../world/TerrainTiles';
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

  ctx.progress(0.9, 'floodplain: palms and field parcels');
  const palmCount = buildPalms(scene, seed, hf, gi);
  const fields = buildFields(scene, seed, hf, gi);
  engine.stats.counters['veg.palms'] = palmCount;
  engine.stats.counters['veg.tufts'] = fields.count;
  engine.stats.counters['veg.parcels'] = fields.parcels;

  // --- Nile + harbor water (flow, sky reflection, depth absorption) --------
  ctx.progress(0.91, 'water: the Nile');
  const water = new NileWater(hf, sunSky.atmosphere);
  for (const m of water.meshes) scene.add(m);
  engine.onUpdate((_dt, worldTime) => water.tick(worldTime));

  ctx.progress(0.915, 'harbor: quay, piers, vessels');
  engine.stats.counters['harbor.vessels'] = buildHarbor(scene, seed, gi);

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
