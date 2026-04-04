/**
 * LEARNING NOTE: Production Chase Camera (Babylon.js)
 *
 * Smooth follow with lerp-based position/rotation, speed-dependent FOV
 * widening, and high-speed vibration for immersion. Pre-allocated vectors
 * avoid per-frame allocation.
 *
 * Key concepts: smooth follow, spring-damper, speed FOV, camera shake
 */

import { FreeCamera, Vector3, Quaternion as BJSQuaternion } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { CAMERA } from '@neon-drift/shared';
import { lerp, remap, smoothDamp, type SmoothDampVelocity } from '../utils/math.js';

export class ChaseCamera {
  readonly camera: FreeCamera;

  // Smooth damp velocities
  private velX: SmoothDampVelocity = { value: 0 };
  private velY: SmoothDampVelocity = { value: 0 };
  private velZ: SmoothDampVelocity = { value: 0 };
  private velLookX: SmoothDampVelocity = { value: 0 };
  private velLookY: SmoothDampVelocity = { value: 0 };
  private velLookZ: SmoothDampVelocity = { value: 0 };

  // Pre-allocated vectors (zero per-frame allocation)
  private readonly _currentPos = new Vector3();
  private readonly _smoothLook = new Vector3();
  private readonly _fw = new Vector3();
  private readonly _quat = new BJSQuaternion();
  private initialized = false;

  // Shake state
  private shakeIntensity = 0;
  private highSpeedShake = 0;
  private boostFovKick = 0;

  constructor(scene: Scene) {
    this.camera = new FreeCamera('chase', new Vector3(0, 5, -10), scene);
    this.camera.fov = CAMERA.FOV_MIN * (Math.PI / 180);
    this.camera.minZ = 0.5;
    this.camera.maxZ = 2500;
    this.camera.detachControl();
  }

  update(
    tx: number, ty: number, tz: number,
    qx: number, qy: number, qz: number, qw: number,
    speed: number, dt: number,
  ): void {
    // Forward direction from quaternion
    this._fw.set(0, 0, 1);
    this._quat.set(qx, qy, qz, qw);
    this._fw.rotateByQuaternionToRef(this._quat, this._fw);

    // Desired position: behind and above
    const dx = tx - this._fw.x * CAMERA.DISTANCE;
    const dy = ty + CAMERA.HEIGHT;
    const dz = tz - this._fw.z * CAMERA.DISTANCE;

    if (!this.initialized) {
      this._currentPos.set(dx, dy, dz);
      this._smoothLook.set(tx, ty, tz);
      this.initialized = true;
    }

    // Smooth damp position
    const st = 1.0 / CAMERA.STIFFNESS;
    this._currentPos.x = smoothDamp(this._currentPos.x, dx, this.velX, st, dt);
    this._currentPos.y = smoothDamp(this._currentPos.y, dy, this.velY, st * 0.5, dt);
    this._currentPos.z = smoothDamp(this._currentPos.z, dz, this.velZ, st, dt);

    // Look-at target (ahead of car, slightly raised for better road view)
    const lx = tx + this._fw.x * CAMERA.LOOK_AHEAD;
    const ly = ty + 0.8;
    const lz = tz + this._fw.z * CAMERA.LOOK_AHEAD;

    const ls = CAMERA.ROTATION_SMOOTHING;
    this._smoothLook.x = smoothDamp(this._smoothLook.x, lx, this.velLookX, ls, dt);
    this._smoothLook.y = smoothDamp(this._smoothLook.y, ly, this.velLookY, ls, dt);
    this._smoothLook.z = smoothDamp(this._smoothLook.z, lz, this.velLookZ, ls, dt);

    // Impact shake (decays exponentially)
    if (this.shakeIntensity > 0.001) {
      this._currentPos.x += (Math.random() - 0.5) * this.shakeIntensity;
      this._currentPos.y += (Math.random() - 0.5) * this.shakeIntensity * 0.4;
      this._currentPos.z += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= Math.exp(-8 * dt);
    }

    // High-speed vibration (subtle, continuous)
    const absSpeed = Math.abs(speed);
    if (absSpeed > 25) {
      const vibration = (absSpeed - 25) / 50 * 0.015;
      this._currentPos.x += (Math.random() - 0.5) * vibration;
      this._currentPos.y += (Math.random() - 0.5) * vibration * 0.3;
    }

    // Apply
    this.camera.position.copyFrom(this._currentPos);
    this.camera.setTarget(this._smoothLook);

    // FOV: smooth widen with speed + boost kick
    const baseFov = remap(absSpeed, CAMERA.FOV_SPEED_RANGE[0], CAMERA.FOV_SPEED_RANGE[1],
      CAMERA.FOV_MIN, CAMERA.FOV_MAX);
    const targetFov = (baseFov + this.boostFovKick) * (Math.PI / 180);
    this.camera.fov = lerp(this.camera.fov, targetFov, 0.05);

    // Decay boost FOV kick
    this.boostFovKick *= Math.exp(-3 * dt);
    if (this.boostFovKick < 0.1) this.boostFovKick = 0;
  }

  shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  /** FOV kick for boost — widens then snaps back */
  fovKick(degrees: number): void {
    this.boostFovKick = degrees;
  }
}
