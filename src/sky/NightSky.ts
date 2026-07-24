/**
 * Night sky (Phase 7) — stars, Milky Way and a phase-shaded moon, plus the
 * moonlight rig that takes over the sun's DirectionalLight after dusk.
 *
 * Why it matters here: 2550 BCE has ZERO light pollution and the canon treats
 * the sky as an instrument (Vol. II — the shafts, the circumpolar "imperishable
 * stars"). A night frame with an empty black dome would be the least authentic
 * thing in the build.
 *
 * Everything is analytic — no star catalogue, no texture. Stars come from a 3D
 * cell hash over the view direction (near-uniform cells on the sphere, unlike
 * an equirect grid which clumps at the zenith), in three magnitude classes.
 *
 * MOONLIGHT SHARES THE SUN'S LIGHT: rather than adding a second
 * DirectionalLight (a second CSM setup, doubled shadow passes, a second entry
 * in every material's light loop), the existing sun light is RE-AIMED at the
 * moon and re-tinted once the sun is below the horizon. Shadows, cascades and
 * contact shadows all keep working at night for free — cast by the moon,
 * which is what actually happens.
 *
 * DEVIATION (D-10): the moon's ephemeris is not computed. Its hour angle is
 * offset from the sun's by a fixed 137° with a +12° declination — a waxing
 * gibbous standing high in the south-east at dusk. The canonical day is an
 * equinox (D-2) and no canon source fixes a lunar date, so this is an
 * art-directed choice, chosen to light the plateau's east faces at night.
 */

import { Vector3 } from 'three';
import {
  clamp,
  float,
  floor,
  mix,
  pow,
  sin,
  smoothstep,
  step,
  uniform,
  vec3,
} from 'three/tsl';
import { hash13 } from '../gpu/noise/NoiseTSL';
import type { NV3 } from '../gpu/TSLTypes';
import type { Atmosphere } from './Atmosphere';

/** angular radius of the moon disc (rad). The true value is 0.00454 (0.26°);
 *  like the sun disc (Atmosphere), it is oversized ~2.2× — at true scale in a
 *  55° frame the moon is an 8 px dot and reads as a lens artefact. */
const MOON_ANGULAR_R = 0.0102;
/** hour-angle offset of the moon from the sun (rad) — see D-10 */
const MOON_LAG = 2.39;
const MOON_DECL_DEG = 12;

/** moon world direction for a given solar time, same frame as SunSky */
export function moonDirection(t: number, out: Vector3): Vector3 {
  const lat = (29.9792 * Math.PI) / 180;
  const decl = (MOON_DECL_DEG * Math.PI) / 180;
  const hourAngle = ((t - 12) / 24) * 2 * Math.PI + MOON_LAG;
  const sinAlt =
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const alt = Math.asin(Math.min(1, Math.max(-1, sinAlt)));
  const cosAz =
    (Math.sin(decl) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat) || 1e-6);
  let azFromN = Math.acos(Math.min(1, Math.max(-1, cosAz)));
  if (Math.sin(hourAngle) > 0) azFromN = 2 * Math.PI - azFromN;
  const h = Math.cos(alt);
  out.set(Math.sin(azFromN) * h, Math.sin(alt), -Math.cos(azFromN) * h);
  return out.normalize();
}

export class NightSky {
  /** 0 by day, 1 once the sun is well down — drives every night term */
  readonly nightK = uniform(0);
  readonly moonDir = uniform(new Vector3(0, 0.7, -0.7));
  /** slow clock for the twinkle (seconds; freeze-safe via the world clock) */
  readonly time = uniform(0);

  /** how much the night rig owns the frame, 0..1, for a given sun elevation */
  static amountFor(sunY: number): number {
    return Math.min(1, Math.max(0, (0.03 - sunY) / 0.13));
  }

  /**
   * Night radiance for a view direction: airglow + Milky Way + stars + moon.
   * Returned in the same HDR units as Atmosphere.skyColor, ready to ADD to the
   * daytime sky (nightK already folded in, so it vanishes by day).
   */
  radiance(dir: NV3): NV3 {
    const k = float(this.nightK);
    const moon = vec3(this.moonDir).normalize();

    /* --- stars: three magnitude classes over a 3D cell hash ---------------- */
    const layer = (scale: number, thresh: number, size: number, gain: number): NV3 => {
      const p = dir.mul(scale);
      const c = floor(p);
      const f = p.sub(c);
      const present = step(float(thresh), hash13(c));
      const jx = hash13(c.add(vec3(0.13, 7.71, 3.19)));
      const jy = hash13(c.add(vec3(5.27, 1.31, 9.73)));
      const jz = hash13(c.add(vec3(2.77, 4.41, 6.13)));
      const d = f.sub(vec3(jx, jy, jz)).length();
      const core = smoothstep(float(size), float(0), d);
      const b = hash13(c.add(vec3(11.13, 3.37, 7.79)));
      // scintillation: atmospheric, so it is strongest near the horizon
      const tw = sin(
        float(this.time).mul(b.mul(4).add(1.7)).add(b.mul(37)),
      )
        .mul(smoothstep(0.5, 0.03, dir.y.abs()).mul(0.22).add(0.06))
        .add(1);
      // O/B blue-white through K orange — a monochrome field reads as noise
      const tint = mix(vec3(1.0, 0.87, 0.72), vec3(0.75, 0.85, 1.0), b);
      return tint.mul(core.mul(present).mul(tw).mul(b.mul(0.75).add(0.35)).mul(gain));
    };
    const stars = layer(58, 0.955, 0.075, 1.0)
      .add(layer(97, 0.976, 0.055, 0.55))
      .add(layer(151, 0.984, 0.045, 0.3));

    /* --- Milky Way: unresolved glow in a band, dust-mottled ---------------- */
    // galactic plane pole, tilted so the band arcs across the southern sky
    const gp = vec3(0.36, 0.62, -0.7).normalize();
    const band = smoothstep(0.42, 0.0, dir.dot(gp).abs());
    const mottle = hash13(dir.mul(11).add(vec3(3.1, 1.7, 8.3)))
      .mul(0.55)
      .add(hash13(dir.mul(4.3)).mul(0.45));
    const milky = vec3(0.72, 0.76, 0.95).mul(band.mul(band).mul(mottle.mul(0.7).add(0.4)));

    /* --- moon: disc with a real terminator + a small halo ------------------ */
    const cosM = dir.dot(moon);
    const cosR = Math.cos(MOON_ANGULAR_R);
    const disc = smoothstep(float(cosR), float(cosR + 2e-6), cosM);
    // disc-local offset → surface normal of the visible hemisphere
    const q = dir.sub(moon.mul(cosM)).div(MOON_ANGULAR_R);
    const r2 = clamp(q.dot(q), 0, 1);
    const nrm = q.mul(0.999).sub(moon.mul(r2.oneMinus().sqrt())).normalize();
    // phase: lit by the sun, which is below OUR horizon but still lights it
    const sunToMoon = vec3(this.sunDirRef).normalize();
    const litRaw = clamp(nrm.dot(sunToMoon), 0, 1);
    // Lambert would make a gibbous moon fade to nothing at the limb; the real
    // regolith is strongly backscattering (opposition surge) — flatten it
    const lit = pow(litRaw, 0.45).mul(smoothstep(0.0, 0.06, litRaw));
    const moonCol = vec3(1.0, 0.97, 0.92).mul(lit).mul(disc).mul(26.0);
    // atmospheric halo around the disc
    // tight aureole only: pow(cos,60) spans ±8.6° and turned the moon into a
    // fuzzy blob with a pinhole in it
    const halo = pow(clamp(cosM, 0, 1), 5200).mul(0.5).add(
      pow(clamp(cosM, 0, 1), 420).mul(0.028),
    );
    const haloCol = vec3(0.72, 0.8, 1.0).mul(halo);

    /* --- airglow: the sky is never truly black, and horizon > zenith ------- */
    const glow = vec3(0.016, 0.023, 0.045).mul(
      smoothstep(0.75, -0.05, dir.y).mul(0.7).add(0.5),
    );

    return stars.add(milky.mul(0.06)).add(moonCol).add(haloCol).add(glow).mul(k);
  }

  /** the atmosphere's sun-direction uniform — the moon's phase needs it */
  private sunDirRef: Atmosphere['sunDir'] = uniform(new Vector3(0, 1, 0));
  setSunRef(u: Atmosphere['sunDir']): void {
    this.sunDirRef = u;
  }
}
