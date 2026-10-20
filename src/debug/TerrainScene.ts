/**
 * World scene — the plateau, wadi, quarry, floodplain, and Nile corridor,
 * lit by the Phase-2 stack: Hillaire atmosphere + astronomical sun + IBL +
 * CSM/PCSS shadows + post (aerial perspective, GTAO, TRAA, bloom, grade).
 * Water is a flat stage plane until Phase 5's flowing Nile.
 */

import { Group, Mesh, type Material } from 'three';
import { isReduced } from '../core/Params';
import { ProbeGI } from '../gpu/passes/ProbeGI';
import { Froxels } from '../gpu/passes/Froxels';
import { buildKhufuComplex } from '../monuments/KhufuComplex';
import { buildMonuments, updateMonumentLods, type MonumentSite } from '../monuments/Monuments';
import { buildWorkerTown } from '../monuments/WorkerTown';
import { buildHarborDistrict } from '../monuments/HarborDistrict';
import { buildIndustryDistrict } from '../monuments/IndustryDistrict';
import { Torches } from '../monuments/Torches';
import { buildInhabitants } from '../monuments/Inhabitants';
import { PostStack } from '../render/PostStack';
import { installPositionInvariance } from '../render/DepthPrepass';
import { clearCulling, cullingActive, updateInstanceCulling } from '../render/InstanceCull';
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
  const gi = new ProbeGI(hf, sunSky.atmosphere, engine.params.preset);
  await gi.init(renderer);
  // reduced preset: probe refresh every 3rd frame (PERF II — the gather was
  // 6.3 ms of a 66 ms iGPU frame; the field is temporally EMA'd anyway, so a
  // slower refresh only lengthens the converge tail after a ToD jump)
  let giFrame = 0;
  const giEvery =
    engine.params.preset === 'safe' ? 6 : engine.params.preset === 'low' ? 3 : 1;
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
    'worker-town', 'harbor-district', 'industry',
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
    engine.stats.counters['harbor.district'] = buildHarborDistrict(structures, seed, hf, gi);
    engine.stats.counters['industry'] = buildIndustryDistrict(structures, seed, hf, gi);
    engine.stats.counters['monuments.stones'] = sites.reduce(
      (a, s) => a + s.lod.stoneCount,
      0,
    );
  };

  ctx.progress(0.88, 'monuments: casing the pyramids');
  ctx.progress(0.89, 'monuments: temples, causeway, mastaba fields');
  rebuildStructures();
  engine.onUpdate(() => updateMonumentLods(sites, camera.position));

  // PERF I: scatter systems draw indirectly, one draw per visible spatial
  // cell; the depth prepass makes the lit pass run once per visible pixel
  const perf = { cull: engine.params.cull, prepass: engine.params.prepass };
  if (perf.prepass) installPositionInvariance(renderer);
  clearCulling();

  ctx.progress(0.9, 'floodplain: palms and field parcels');
  const palmCount = buildPalms(scene, seed, hf, gi, engine.params.preset, perf);
  const fields = buildFields(scene, seed, hf, gi, engine.params.preset, perf);
  engine.stats.counters['veg.palms'] = palmCount;
  engine.stats.counters['veg.tufts'] = fields.count;
  engine.stats.counters['veg.parcels'] = fields.parcels;

  ctx.progress(0.905, 'shorelines: papyrus, reeds, shade trees');
  const shore = buildShore(scene, seed, hf, gi, engine.params.preset, perf.cull);
  engine.stats.counters['veg.reeds'] = shore.clumps;
  engine.stats.counters['veg.trees'] = shore.trees;

  ctx.progress(0.908, 'works: stone debris fields');
  engine.stats.counters['debris'] = buildDebris(
    scene, seed, hf, gi, engine.params.preset, perf.cull,
  );

  ctx.progress(0.909, 'works: dust and hearth smoke');
  const particles = new WorkParticles(scene, seed, hf, engine.params.preset, perf.cull);
  engine.stats.counters['particles'] = particles.meshes.reduce((a, m) => a + m.count, 0);
  engine.onUpdate(() => particles.tick(camera));

  ctx.progress(0.9092, 'inhabited: worker gangs, ox trains, scaffolding');
  const people = buildInhabitants(scene, seed, hf, gi, engine.params.preset, perf.cull);
  engine.stats.counters['workers'] = people.figures;
  engine.stats.counters['oxen'] = people.oxen;
  engine.stats.counters['sledges'] = people.sledges;

  // --- night: torches, hearths and lanterns (gated by night-ness) ---------
  ctx.progress(0.9095, 'night: torches and hearth fires');
  const torches = new Torches(scene, seed, hf, gi);
  torches.setNight(sunSky.nightAmount);
  gi.gain.value = 1 - sunSky.nightAmount * 0.98;
  engine.stats.counters['torches'] = torches.count;

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

  // ?hide=debris,particles — ablation: hide scene objects by name prefix
  const hide = new URLSearchParams(window.location.search).get('hide');
  if (hide) {
    const prefixes = hide.split(',').filter((p) => p.length > 0);
    scene.traverse((o) => {
      if (prefixes.some((p) => o.name.startsWith(p))) o.visible = false;
    });
  }

  // PERF I: rebuild the indirect-draw offset lists from the FINAL camera pose
  if (cullingActive()) {
    engine.onPreRender(() => {
      updateInstanceCulling(camera, sunSky.sunDir, engine.stats.counters);
    });
  }

  // --- rest of the lighting stack ---------------------------------------------
  ctx.progress(0.92, 'sky: cloud noise');
  const clouds = new Clouds(sunSky.atmosphere, engine.params.preset);
  await clouds.init(renderer);
  await clouds.refreshShadow(renderer);
  engine.onUpdate((dt) => clouds.tick(renderer, dt));

  ctx.progress(0.94, 'shadows: CSM + PCSS');
  const lowQ = isReduced(engine.params.preset);
  setupSunShadows(
    sunSky.sun,
    camera,
    (wxz) => clouds.shadowAt(wxz),
    // PERF II: the reduced preset's shadow pass measured 17.5 ms of a 70 ms
    // iGPU frame — it is CASTER-BOUND (terrain patches + palms + every
    // structure re-rasterized per cascade), so the fix is a shorter throw and
    // a smaller map, not a cheaper filter
    engine.params.preset === 'safe'
      ? { maxFar: 700, lightMargin: 320, cascades: 1, mapSize: 512 }
      : lowQ
        ? { maxFar: 1100, lightMargin: 450, cascades: 1, mapSize: 1024 }
        : { maxFar: 3600, lightMargin: 900 },
  );

  ctx.progress(0.95, 'volumetrics: dust columns and valley mist');
  // froxels must exist before the post stack — PostStack folds them into the
  // aerial node (local volumetrics UNDER the km-scale haze)
  // SAFE drops froxels entirely: it is the one system whose absence costs
  // atmosphere but no geometry, and on an adapter that hangs its driver the
  // priority is a frame that finishes
  const froxels =
    new URLSearchParams(window.location.search).get('froxels') === '0' ||
    engine.params.preset === 'safe'
      ? null
      : new Froxels(hf, sunSky.atmosphere, clouds, engine.params.preset);
  if (froxels) {
    engine.onPreRender(() => froxels.update(renderer, camera, sunSky.sun));
  }

  ctx.progress(0.96, 'post: pipeline');
  const post = new PostStack(
    engine, sunSky.atmosphere, engine.params.timeOfDay, clouds, froxels,
  );
  engine.post = post;

  // --- hooks ------------------------------------------------------------------
  engine.hooks.setTimeOfDay = (t): void => {
    engine.params.timeOfDay = t;
    void sunSky.setTimeOfDay(t).then(() => {
      torches.setNight(sunSky.nightAmount);
      gi.gain.value = 1 - sunSky.nightAmount * 0.98;
      return clouds.refreshShadow(renderer);
    });
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
