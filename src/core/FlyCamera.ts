/**
 * Interactive camera rig — FLY by default, WALK on `G` (Phase 7).
 * Pointer-lock mouse look, WASD + QE, Shift sprint, wheel speed scaling.
 * `P` prints the current pose string.
 *
 * Walk mode hands the vertical axis to WalkRig, which pins the eye to the
 * terrain or to whatever structure the walker is standing on; horizontal
 * input is projected flat so looking up does not launch you off the causeway.
 */

import { Vector3 } from 'three';
import type { Engine } from './Engine';
import type { CamPose } from './Hooks';
import { WalkRig } from './WalkRig';

const BASE_SPEED = 30; // m/s
const SPRINT_MULT = 5;

export class FlyCamera {
  private engine: Engine;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private speedScale = 1;
  private enabled = true;
  private locked = false;
  readonly walk: WalkRig;

  constructor(engine: Engine) {
    this.engine = engine;
    this.walk = new WalkRig((x, z) => engine.hooks.groundProbe?.(x, z).ground ?? 0);

    const canvas = engine.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (this.enabled && !this.locked) {
        canvas.requestPointerLock();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      const lim = Math.PI / 2 - 0.001;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyP') {
        // eslint-disable-next-line no-console
        console.log(`[akhet] pose: ${this.poseString()}`);
      }
      if (e.code === 'KeyG' && !e.repeat && this.enabled) {
        const on = this.walk.toggle(this.engine.camera);
        // eslint-disable-next-line no-console
        console.log(`[akhet] ${on ? 'WALK' : 'FLY'} mode`);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('wheel', (e) => {
      if (!this.locked || !this.enabled) return;
      this.speedScale *= e.deltaY < 0 ? 1.25 : 0.8;
      this.speedScale = Math.max(0.05, Math.min(40, this.speedScale));
    });

    engine.onUpdate((dt) => this.update(dt));
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.keys.clear();
  }

  getPose(): CamPose {
    const p = this.engine.camera.position;
    return { p: [p.x, p.y, p.z], yaw: this.yaw, pitch: this.pitch };
  }

  setPose(pose: CamPose): void {
    this.engine.camera.position.set(pose.p[0], pose.p[1], pose.p[2]);
    this.yaw = pose.yaw;
    this.pitch = pose.pitch;
    if (pose.fov !== undefined) {
      this.engine.camera.fov = pose.fov;
      this.engine.camera.updateProjectionMatrix();
    }
    this.applyRotation();
    this.engine.camera.updateMatrixWorld();
  }

  poseString(): string {
    const p = this.engine.camera.position;
    const f = (n: number): string => n.toFixed(2);
    return `${f(p.x)},${f(p.y)},${f(p.z)},${f(this.yaw)},${f(this.pitch)}`;
  }

  private applyRotation(): void {
    // yaw around +Y, then pitch — matches pose-string convention
    this.engine.camera.rotation.set(0, 0, 0);
    this.engine.camera.rotateY(this.yaw);
    this.engine.camera.rotateX(this.pitch);
  }

  private update(dt: number): void {
    this.applyRotation();
    if (!this.enabled) {
      if (this.walk.active) this.walk.update(this.engine.camera, dt);
      return;
    }

    const cam = this.engine.camera;
    const fwd = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const move = new Vector3();
    if (this.keys.has('KeyW')) move.add(fwd);
    if (this.keys.has('KeyS')) move.sub(fwd);
    if (this.keys.has('KeyD')) move.add(right);
    if (this.keys.has('KeyA')) move.sub(right);
    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    if (this.walk.active) {
      // flatten: pitch must not lift the walker off the ground
      move.y = 0;
      if (move.lengthSq() > 0) {
        move.normalize();
        cam.position.addScaledVector(move, this.walk.speed(sprinting) * dt);
      }
      this.walk.update(cam, dt);
      cam.updateMatrixWorld();
      return;
    }

    if (this.keys.has('KeyE') || this.keys.has('Space')) move.y += 1;
    if (this.keys.has('KeyQ')) move.y -= 1;
    if (move.lengthSq() === 0) return;
    move.normalize();
    const sprint = sprinting ? SPRINT_MULT : 1;
    cam.position.addScaledVector(move, BASE_SPEED * sprint * this.speedScale * dt);
    cam.updateMatrixWorld();
  }
}
