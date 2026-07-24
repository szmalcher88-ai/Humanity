/**
 * SunSky — time-of-day model wiring the Atmosphere into the scene:
 * sun DirectionalLight (transmittance-tinted), sky background, and IBL
 * (PMREM re-baked from the sky on ToD changes). `[` / `]` step time live.
 */

import { Color, CubeCamera, HalfFloatType, HemisphereLight, Scene, Vector3 } from 'three';
import { DirectionalLight } from 'three';
import { positionWorldDirection } from 'three/tsl';
import { CubeRenderTarget, type Renderer } from 'three/webgpu';
import type { Engine } from '../core/Engine';
import { Atmosphere, SUN_E } from './Atmosphere';
import { NightSky, moonDirection } from './NightSky';

const SUN_DISTANCE = 9000;

export class SunSky {
  readonly atmosphere: Atmosphere;
  readonly night = new NightSky();
  readonly sun: DirectionalLight;
  timeOfDay: number;
  private engine: Engine;
  private iblScene: Scene;
  private iblCube: CubeRenderTarget;
  private iblCam: CubeCamera;
  private renderer: Renderer | null = null;
  private iblDirty = true;
  private sunDirWorld = new Vector3();
  private moonDirWorld = new Vector3();
  /** 0 by day → 1 at night; the light rig swings to the moon across it */
  nightAmount = 0;
  private hemi!: HemisphereLight;
  /** ambient floor scale: dropped to ~0.15 when probe GI is active */
  private ambientScale = 1;

  constructor(engine: Engine, initialTod: number) {
    this.engine = engine;
    this.atmosphere = new Atmosphere();
    this.timeOfDay = initialTod;
    this.sun = new DirectionalLight(0xffffff, 5);
    this.sun.castShadow = false; // shadow setup module enables + configures
    engine.scene.add(this.sun);
    engine.scene.add(this.sun.target);

    this.night.setSunRef(this.atmosphere.sunDir);
    this.atmosphere.nightSky = this.night;
    this.iblScene = new Scene();
    this.iblCube = new CubeRenderTarget(64, { type: HalfFloatType });
    this.iblCam = new CubeCamera(0.1, 50, this.iblCube);

    // Ambient stopgap until Phase-3 probe GI: sky/ground hemisphere driven by
    // the atmosphere's CPU side. Guarantees the no-black-shadows law from day
    // one even where the env-map path underdelivers.
    this.hemi = new HemisphereLight(0x9db8e8, 0x55503e, 1);
    engine.scene.add(this.hemi);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        const step = e.code === 'BracketLeft' ? -0.5 : 0.5;
        void this.setTimeOfDay((this.timeOfDay + step + 24) % 24);
        // eslint-disable-next-line no-console
        console.log(`[akhet] T=${this.timeOfDay.toFixed(2)}`);
      }
    });
  }

  async init(renderer: Renderer): Promise<void> {
    this.renderer = renderer;
    await this.atmosphere.init(renderer);
    this.engine.scene.backgroundNode = this.atmosphere
      .backgroundNode()
      .add(this.night.radiance(positionWorldDirection.normalize() as unknown as Parameters<NightSky['radiance']>[0]));
    // IBL env: sky only — the sun's direct term comes from the DirectionalLight
    this.iblScene.backgroundNode = this.atmosphere.skyColor(
      positionWorldDirection.normalize(),
    );
    await this.setTimeOfDay(this.timeOfDay);
  }

  /**
   * hours [0,24) solar time → sun world direction, ASTRONOMICAL for Giza
   * (lat 29.9792°N) on the canonical equinox day (CANON_DIMENSIONS D-2).
   * World frame: +X east, +Z south, north = −Z. At equinox the sun rises
   * due EAST and sets due WEST — the cardinal-alignment shadow audit keys
   * off this. Declination hook stays for solstice audit runs (?decl=).
   */
  static sunDirection(t: number, out: Vector3, declDeg = 0): Vector3 {
    const lat = (29.9792 * Math.PI) / 180;
    const decl = (declDeg * Math.PI) / 180;
    const hourAngle = ((t - 12) / 24) * 2 * Math.PI;
    const sinAlt =
      Math.sin(lat) * Math.sin(decl) +
      Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
    const alt = Math.asin(Math.min(1, Math.max(-1, sinAlt)));
    const cosAz =
      (Math.sin(decl) - Math.sin(alt) * Math.sin(lat)) /
      (Math.cos(alt) * Math.cos(lat) || 1e-6);
    let azFromN = Math.acos(Math.min(1, Math.max(-1, cosAz)));
    if (t > 12) azFromN = 2 * Math.PI - azFromN; // afternoon: sun west
    const h = Math.cos(alt);
    out.set(Math.sin(azFromN) * h, Math.sin(alt), -Math.cos(azFromN) * h);
    return out.normalize();
  }

  async setTimeOfDay(t: number): Promise<void> {
    this.timeOfDay = t;
    SunSky.sunDirection(t, this.sunDirWorld);
    moonDirection(t, this.moonDirWorld);
    await this.atmosphere.setSun(this.sunDirWorld);

    const [tr, tg, tb] = this.atmosphere.sunTransmittanceCpu(this.sunDirWorld);
    const lum = 0.2126 * tr + 0.7152 * tg + 0.0722 * tb;
    const above = Math.max(0, Math.min(1, (this.sunDirWorld.y + 0.03) / 0.06));
    this.sun.intensity = SUN_E * lum * above;
    const m = Math.max(tr, tg, tb) || 1;
    this.sun.color = new Color(tr / m, tg / m, tb / m);
    this.sun.position.copy(this.sunDirWorld).multiplyScalar(SUN_DISTANCE);
    this.sun.target.position.set(0, 0, 0);

    /* --- NIGHT: the same light becomes moonlight (Phase 7) ------------------
     * Re-aiming the existing DirectionalLight costs nothing and keeps CSM,
     * PCSS and contact shadows working after dusk. Moonlight is ~1/400,000 of
     * sunlight in reality; at that level auto-exposure (gain capped at 4×)
     * would show mud. 0.4% of noon is the cinematic convention and keeps the
     * value structure the night keyframe of the colour script expects. */
    const nk = NightSky.amountFor(this.sunDirWorld.y);
    this.nightAmount = nk;
    this.night.nightK.value = nk;
    (this.night.moonDir.value as Vector3).copy(this.moonDirWorld);
    if (nk > 0) {
      const moonUp = Math.max(0, Math.min(1, (this.moonDirWorld.y + 0.02) / 0.08));
      const moonI = SUN_E * 0.016 * moonUp;
      this.sun.intensity = this.sun.intensity * (1 - nk) + moonI * nk;
      // sunlit-by-day → moonlit-by-night: cool, slightly desaturated
      const dayCol = new Color(tr / m, tg / m, tb / m);
      this.sun.color = dayCol.lerp(new Color(0.72, 0.8, 1.0), nk);
      // swing the shadow-casting direction to the moon
      const dir = this.sunDirWorld.clone().lerp(this.moonDirWorld, nk).normalize();
      this.sun.position.copy(dir).multiplyScalar(SUN_DISTANCE);
    }

    // hemisphere ambient ≈ sky irradiance: cool zenith over WARM SAND/
    // LIMESTONE bounce (Pillar B: shade is filled with warm bounce off
    // stone and sand — the look of Egypt); dims/warms with transmittance
    const day = above * lum;
    const warm = 1 - Math.min(1, Math.max(0, this.sunDirWorld.y * 3));
    // night floor: starlight + airglow + moon-lit sky. Small, but never zero —
    // the no-black-shadows law does not clock off at sunset.
    // the night term deliberately SKIPS ambientScale: that factor exists
    // because probe GI carries the daytime bounce, and probe GI is faded out
    // after dusk (ProbeGI.gain) — something has to hold the shadow floor up
    this.hemi.intensity =
      SUN_E * (0.06 + 0.075 * day) * this.ambientScale * (1 - nk) +
      SUN_E * 0.024 * nk;
    this.hemi.color = new Color(
      0.34 + 0.25 * warm * 0.4,
      0.45 + 0.08 * warm * 0.2,
      0.78 - 0.12 * warm,
    ).lerp(new Color(0.34, 0.45, 0.95), nk);
    this.hemi.groundColor = new Color(
      0.52 + 0.18 * warm,
      0.44 + 0.08 * warm,
      0.32,
    ).lerp(new Color(0.28, 0.33, 0.46), nk);

    this.iblDirty = true;
    await this.refreshIBL();
  }

  /** current sun world direction (surface → sun), unit length */
  get sunDir(): Vector3 {
    return this.sunDirWorld;
  }

  /** probe GI active: hemisphere becomes a small safety floor only */
  dimAmbientForGI(): void {
    this.ambientScale = 0.15;
    this.hemi.intensity *= 0.15;
  }

  /** re-bake the environment cube from the sky (ToD changes only) */
  private async refreshIBL(): Promise<void> {
    if (!this.renderer || !this.iblDirty) return;
    this.iblDirty = false;
    this.iblCam.update(this.renderer as unknown as Parameters<CubeCamera['update']>[0], this.iblScene);
    // WebGPU environment pipeline PMREMs cube textures internally
    this.engine.scene.environment = this.iblCube.texture;
    this.engine.scene.environmentIntensity = 1.0;
  }
}
