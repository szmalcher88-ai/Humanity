/**
 * World scene — the plateau, wadi, quarry, floodplain, and Nile corridor,
 * lit by the Phase-2 stack: Hillaire atmosphere + astronomical sun + IBL +
 * CSM/PCSS shadows + post (aerial perspective, GTAO, TRAA, bloom, grade).
 * Water is a flat stage plane until Phase 5's flowing Nile.
 */

import { Group, Mesh, type Material } from 'three';
import { ProbeGI } from '../gpu/passes/ProbeGI';
import { buildKhufuComplex } from '../monuments/KhufuComplex';
import { buildMonuments, updateMonumentLods, type MonumentSite } from '../monuments/Monuments';
import { buildWorkerTown } from '../monuments/WorkerTown';
import { PostStack } from '../render/PostStack';
import { setupSunShadows } from '../render/ShadowSetup';
import { Clouds } from '../sky/Clouds';
import { SunSky } from '../sky/SunSky';
import { buildFields } from '../vegetation/Fields';
import { buildPalms } from '../vegetation/Palms';
import { buildShore } from '../vegetation/Shore';
import { NileWater } from '../water/NileWater';
import { buildHarbor } from '../water/Vessels';
import { setWorldTime } from '../render/WorldClock';
import { buildDebris } from '../world/Debris';
import { Heightfield } from '../world/Heightfield';
import { WorkParticles } from '../world/Particles';
import { TerrainTiles } from '../world/TerrainTiles';
import { attachBookmarks } from './Bookmarks';
import { fpClear } from './Footprints';
import { Inspector } from './Inspector';
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
  // reduced preset: probe refresh every 2nd frame (halves compute cost;
  // the field is temporally EMA'd anyway)
  let giFrame = 0;
  const giEvery = engine.params.preset === 'low' ? 2 : 1;
  engine.onUpdate(() => {
    if (giFrame++ % giEvery === 0) gi.tick(renderer);
  });
  sunSky.dimAmbientForGI();

  ctx.progress(0.86, 'terrain: building tiles');
  const debugView = new URLSearchParams(window.location.search).get('view');
  const tiles = new TerrainTiles(hf, debugView, { gi, preset: engine.params.preset });
  scene.add(tiles.mesh);
  scene.add(tiles.farShell);
  engine.onUpdate(() => {
    tiles.update(camera);
    engine.stats.counters['terrain.tiles'] = tiles.activeTiles;
  });

  // --- structures: pyramids + complex + harbor works in one rebuildable
  // group. The Inspector re-runs this with edit overrides applied; the
  // footprint registry is cleared and re-filled on every build.
  const STRUCT_FAMILIES = [
    'pyramids', 'temenos', 'temple', 'causeway', 'boatpits', 'chapels',
    'mastabas-west', 'mastabas-east', 'pavement', 'vessels', 'harbor-works',
    'worker-town',
  ];
  const structures = new Group();
  scene.add(structures);
  let sites: MonumentSite[] = [];
  const rebuildStructures = (): void => {
    fpClear(STRUCT_FAMILIES);
    for (const c of [...structures.children]) {
      c.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const m = o.material as Material | Material[];
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      structures.remove(c);
    }
    sites = buildMonuments(structures, seed, gi);
    buildKhufuComplex(structures, seed, hf, gi);
    engine.stats.counters['harbor.vessels'] = buildHarbor(structures, seed, hf, gi);
    engine.stats.counters['town.rooms'] = buildWorkerTown(structures, seed, hf, gi);
    engine.stats.counters['monuments.stones'] = sites.reduce(
      (a, s) => a + s.lod.stoneCount,
      0,
    );
  };

  ctx.progress(0.88, 'monuments: casing the pyramids');
  ctx.progress(0.89, 'monuments: temples, causeway, mastaba fields');
  rebuildStructures();
  engine.onUpdate(() => updateMonumentLods(sites, camera.position));

  ctx.progress(0.9, 'floodplain: palms and field parcels');
  const palmCount = buildPalms(scene, seed, hf, gi, engine.params.preset);
  const fields = buildFields(scene, seed, hf, gi, engine.params.preset);
  engine.stats.counters['veg.palms'] = palmCount;
  engine.stats.counters['veg.tufts'] = fields.count;
  engine.stats.counters['veg.parcels'] = fields.parcels;

  ctx.progress(0.905, 'shorelines: papyrus, reeds, shade trees');
  const shore = buildShore(scene, seed, hf, gi, engine.params.preset);
  engine.stats.counters['veg.reeds'] = shore.clumps;
  engine.stats.counters['veg.trees'] = shore.trees;

  ctx.progress(0.908, 'works: stone debris fields');
  engine.stats.counters['debris'] = buildDebris(scene, seed, hf, gi, engine.params.preset);

  ctx.progress(0.909, 'works: dust and hearth smoke');
  const particles = new WorkParticles(scene, seed, hf, engine.params.preset);
  engine.stats.counters['particles'] = particles.meshes.reduce((a, m) => a + m.count, 0);
  engine.onUpdate(() => particles.tick(camera));

  // --- Nile + harbor water (flow, sky reflection, depth absorption) --------
  ctx.progress(0.91, 'water: the Nile');
  const water = new NileWater(hf, sunSky.atmosphere);
  for (const m of water.meshes) scene.add(m);
  engine.onUpdate((_dt, worldTime) => {
    water.tick(worldTime);
    setWorldTime(worldTime); // vessel bobbing + vegetation wind sway
  });

  ctx.progress(0.915, 'harbor: quay, piers, vessels');
  // (harbor is part of rebuildStructures above)

  // --- placement Inspector + collision audit (E key / ?edit=1) -------------
  const inspector = new Inspector({
    scene,
    camera,
    canvas: renderer.domElement as HTMLCanvasElement,
    hf,
    rebuild: rebuildStructures,
  });
  const boot = inspector.audit();
  engine.stats.counters['collision.issues'] = boot.length;
  window.__akhet.collisionAudit = () => {
    const issues = inspector.audit();
    engine.stats.counters['collision.issues'] = issues.length;
    return issues;
  };
  window.__akhet.editNudge = (id, dx, dz) => inspector.nudge(id, dx, dz);
  window.__akhet.editExport = () => inspector.exportPatch();

  // Phase 7: bookmark keys 1-9 + F flythrough (?bm=N for tooling)
  attachBookmarks(engine);

  // --- rest of the lighting stack ---------------------------------------------
  ctx.progress(0.92, 'sky: cloud noise');
  const clouds = new Clouds(sunSky.atmosphere);
  await clouds.init(renderer);
  await clouds.refreshShadow(renderer);
  engine.onUpdate((dt) => clouds.tick(renderer, dt));

  ctx.progress(0.94, 'shadows: CSM + PCSS');
  const lowQ = engine.params.preset === 'low';
  setupSunShadows(
    sunSky.sun,
    camera,
    (wxz) => clouds.shadowAt(wxz),
    lowQ
      ? { maxFar: 2400, lightMargin: 900, cascades: 2, mapSize: 1024 }
      : { maxFar: 3600, lightMargin: 900 },
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
