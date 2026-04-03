/**
 * LEARNING NOTE: Heavy Realistic Tire Smoke (Babylon.js)
 *
 * Aggressive, always-visible smoke that responds to speed and drift.
 * High emission rate, large particles, rapid expansion. Two layers:
 * thick contact smoke + wide lingering haze trail.
 *
 * Key concepts: high-rate emission, size gradients, color gradients, turbulence
 */

import {
  ParticleSystem,
  Vector3,
  Color4,
  Texture,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

export class TireSmokeEmitter {
  private thickSmoke: ParticleSystem;
  private hazeTrail: ParticleSystem;
  private smokeTexture: Texture;

  constructor(scene: Scene) {
    this.smokeTexture = this.createSmokeTexture(scene);

    // === LAYER 1: Heavy contact smoke — thick, fast, always visible ===
    this.thickSmoke = new ParticleSystem('smoke', 1500, scene);
    this.thickSmoke.particleTexture = this.smokeTexture;
    this.thickSmoke.emitter = new Vector3(0, 0, 0);
    this.thickSmoke.emitRate = 0;

    this.thickSmoke.minLifeTime = 1.5;
    this.thickSmoke.maxLifeTime = 3.5;

    // Size: small puffs that grow moderately (not blocking view)
    this.thickSmoke.addSizeGradient(0, 0.1, 0.2);
    this.thickSmoke.addSizeGradient(0.2, 0.3, 0.5);
    this.thickSmoke.addSizeGradient(0.5, 0.8, 1.2);
    this.thickSmoke.addSizeGradient(0.8, 1.5, 2.0);
    this.thickSmoke.addSizeGradient(1.0, 2.0, 3.0);

    // Color: bright white → grey → transparent
    this.thickSmoke.addColorGradient(0, new Color4(1.0, 1.0, 1.0, 0.9));
    this.thickSmoke.addColorGradient(0.1, new Color4(0.95, 0.95, 0.96, 0.75));
    this.thickSmoke.addColorGradient(0.3, new Color4(0.8, 0.8, 0.82, 0.5));
    this.thickSmoke.addColorGradient(0.6, new Color4(0.55, 0.55, 0.58, 0.25));
    this.thickSmoke.addColorGradient(1.0, new Color4(0.4, 0.4, 0.42, 0));

    // Direction: strong upward + outward spread
    this.thickSmoke.direction1 = new Vector3(-2, 1, -2);
    this.thickSmoke.direction2 = new Vector3(2, 5, 2);
    this.thickSmoke.minEmitPower = 1.5;
    this.thickSmoke.maxEmitPower = 4.0;

    // Gravity: upward buoyancy (hot smoke rises)
    this.thickSmoke.gravity = new Vector3(0.4, 1.2, 0.2);

    // Rotation for organic look
    this.thickSmoke.minAngularSpeed = -1.0;
    this.thickSmoke.maxAngularSpeed = 1.0;

    this.thickSmoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.thickSmoke.minEmitBox = new Vector3(-0.4, 0, -0.4);
    this.thickSmoke.maxEmitBox = new Vector3(0.4, 0.15, 0.4);

    this.thickSmoke.start();

    // === LAYER 2: Wide haze trail — lingers behind the car ===
    this.hazeTrail = new ParticleSystem('haze', 500, scene);
    this.hazeTrail.particleTexture = this.smokeTexture;
    this.hazeTrail.emitter = new Vector3(0, 0, 0);
    this.hazeTrail.emitRate = 0;

    this.hazeTrail.minLifeTime = 3.0;
    this.hazeTrail.maxLifeTime = 6.0;

    this.hazeTrail.addSizeGradient(0, 0.3, 0.5);
    this.hazeTrail.addSizeGradient(0.3, 1.0, 1.5);
    this.hazeTrail.addSizeGradient(0.6, 2.0, 3.0);
    this.hazeTrail.addSizeGradient(1.0, 3.0, 4.0);

    this.hazeTrail.addColorGradient(0, new Color4(0.8, 0.8, 0.82, 0.35));
    this.hazeTrail.addColorGradient(0.3, new Color4(0.6, 0.6, 0.62, 0.2));
    this.hazeTrail.addColorGradient(0.7, new Color4(0.45, 0.45, 0.47, 0.08));
    this.hazeTrail.addColorGradient(1.0, new Color4(0.35, 0.35, 0.37, 0));

    this.hazeTrail.direction1 = new Vector3(-3, 0.2, -3);
    this.hazeTrail.direction2 = new Vector3(3, 1.5, 3);
    this.hazeTrail.minEmitPower = 0.5;
    this.hazeTrail.maxEmitPower = 1.5;
    this.hazeTrail.gravity = new Vector3(0.6, 0.15, 0.3);
    this.hazeTrail.minAngularSpeed = -0.4;
    this.hazeTrail.maxAngularSpeed = 0.4;
    this.hazeTrail.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.hazeTrail.minEmitBox = new Vector3(-0.8, 0, -0.8);
    this.hazeTrail.maxEmitBox = new Vector3(0.8, 0.1, 0.8);

    this.hazeTrail.start();
  }

  private createSmokeTexture(scene: Scene): Texture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2;

    // Soft cloud-like shape with multiple overlapping gradients
    const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
    g1.addColorStop(0, 'rgba(255,255,255,1)');
    g1.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g1.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    g1.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, size, size);

    // Off-center blobs for organic cloud look
    for (const [ox, oy, r] of [[-10, -8, 0.3], [12, 6, 0.25], [-5, 12, 0.2]] as const) {
      const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, size * r);
      g.addColorStop(0, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }

    return new Texture('data:' + canvas.toDataURL(), scene, false, false);
  }

  emit(
    wheelPosX: number, wheelPosY: number, wheelPosZ: number,
    steeringAngle: number, speed: number, drifting: boolean,
  ): void {
    const absSpeed = Math.abs(speed);
    const absSteer = Math.abs(steeringAngle);

    const isDrifting = drifting && absSpeed > 3;
    const isTurningHard = absSteer > 0.08 && absSpeed > 6;
    const isMovingFast = absSpeed > 15;

    const pos = this.thickSmoke.emitter as Vector3;
    pos.set(wheelPosX, wheelPosY + 0.05, wheelPosZ);
    (this.hazeTrail.emitter as Vector3).copyFrom(pos);

    if (isDrifting) {
      this.thickSmoke.emitRate = 150;
      this.hazeTrail.emitRate = 40;
    } else if (isTurningHard) {
      this.thickSmoke.emitRate = 80;
      this.hazeTrail.emitRate = 20;
    } else if (isMovingFast) {
      this.thickSmoke.emitRate = 30;
      this.hazeTrail.emitRate = 8;
    } else if (absSpeed > 3) {
      this.thickSmoke.emitRate = 12;
      this.hazeTrail.emitRate = 0;
    } else {
      this.thickSmoke.emitRate = 0;
      this.hazeTrail.emitRate = 0;
    }
  }

  update(_dt: number): void {}

  dispose(): void {
    this.thickSmoke.dispose();
    this.hazeTrail.dispose();
    this.smokeTexture.dispose();
  }
}
