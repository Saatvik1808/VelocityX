/**
 * LEARNING NOTE: Neon-Tinted Tire Smoke (Babylon.js)
 *
 * Tire smoke picks up the neon colors from the environment — starting
 * with a cyan/magenta tint and fading to dark grey. The smoke is lit
 * by the neon underglow creating colored volumetric clouds.
 *
 * Key concepts: neon-tinted particles, color gradients, smoke dynamics
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

    // === LAYER 1: Neon-tinted contact smoke ===
    this.thickSmoke = new ParticleSystem('smoke', 1500, scene);
    this.thickSmoke.particleTexture = this.smokeTexture;
    this.thickSmoke.emitter = new Vector3(0, 0, 0);
    this.thickSmoke.emitRate = 0;

    this.thickSmoke.minLifeTime = 1.5;
    this.thickSmoke.maxLifeTime = 3.5;

    this.thickSmoke.addSizeGradient(0, 0.1, 0.2);
    this.thickSmoke.addSizeGradient(0.2, 0.3, 0.5);
    this.thickSmoke.addSizeGradient(0.5, 0.8, 1.2);
    this.thickSmoke.addSizeGradient(0.8, 1.5, 2.0);
    this.thickSmoke.addSizeGradient(1.0, 2.0, 3.0);

    // Neon-tinted smoke: cyan → white → dark transparent
    this.thickSmoke.addColorGradient(0, new Color4(0.2, 0.9, 1.0, 0.95));   // vivid cyan tint
    this.thickSmoke.addColorGradient(0.1, new Color4(0.4, 0.8, 0.9, 0.7));
    this.thickSmoke.addColorGradient(0.3, new Color4(0.3, 0.4, 0.5, 0.45));
    this.thickSmoke.addColorGradient(0.6, new Color4(0.15, 0.15, 0.2, 0.2));
    this.thickSmoke.addColorGradient(1.0, new Color4(0.05, 0.05, 0.08, 0));

    this.thickSmoke.direction1 = new Vector3(-2, 1, -2);
    this.thickSmoke.direction2 = new Vector3(2, 5, 2);
    this.thickSmoke.minEmitPower = 1.5;
    this.thickSmoke.maxEmitPower = 4.0;

    this.thickSmoke.gravity = new Vector3(0.4, 1.2, 0.2);
    this.thickSmoke.minAngularSpeed = -1.0;
    this.thickSmoke.maxAngularSpeed = 1.0;

    // Use additive blend for neon glow effect
    this.thickSmoke.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.thickSmoke.minEmitBox = new Vector3(-0.4, 0, -0.4);
    this.thickSmoke.maxEmitBox = new Vector3(0.4, 0.15, 0.4);

    this.thickSmoke.start();

    // === LAYER 2: Neon haze trail ===
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

    // Magenta-tinted haze
    this.hazeTrail.addColorGradient(0, new Color4(0.6, 0.1, 0.5, 0.3));
    this.hazeTrail.addColorGradient(0.3, new Color4(0.3, 0.05, 0.3, 0.15));
    this.hazeTrail.addColorGradient(0.7, new Color4(0.1, 0.02, 0.12, 0.06));
    this.hazeTrail.addColorGradient(1.0, new Color4(0.03, 0.01, 0.04, 0));

    this.hazeTrail.direction1 = new Vector3(-3, 0.2, -3);
    this.hazeTrail.direction2 = new Vector3(3, 1.5, 3);
    this.hazeTrail.minEmitPower = 0.5;
    this.hazeTrail.maxEmitPower = 1.5;
    this.hazeTrail.gravity = new Vector3(0.6, 0.15, 0.3);
    this.hazeTrail.minAngularSpeed = -0.4;
    this.hazeTrail.maxAngularSpeed = 0.4;
    this.hazeTrail.blendMode = ParticleSystem.BLENDMODE_ADD;
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

    const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
    g1.addColorStop(0, 'rgba(255,255,255,1)');
    g1.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g1.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    g1.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, size, size);

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
