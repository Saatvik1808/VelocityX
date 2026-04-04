/**
 * LEARNING NOTE: Neon Collision Sparks (Babylon.js)
 *
 * Sparks are neon-colored — cycling through cyan, magenta, and white.
 * Additive blending creates intense bright glow against the dark scene.
 * These sparks look electric rather than metallic.
 *
 * Key concepts: neon additive particles, electric spark colors
 */

import {
  ParticleSystem,
  Vector3,
  Color4,
  Texture,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

export class SparkEmitter {
  private system: ParticleSystem;
  private prevSpeed = 0;

  constructor(scene: Scene) {
    this.system = new ParticleSystem('sparks', 300, scene);
    this.system.particleTexture = this.createSparkTexture(scene);
    this.system.emitter = new Vector3(0, 0, 0);
    this.system.emitRate = 0;

    this.system.minLifeTime = 0.15;
    this.system.maxLifeTime = 0.6;

    // Size: tiny bright dots
    this.system.addSizeGradient(0, 0.1, 0.2);
    this.system.addSizeGradient(0.5, 0.04, 0.08);
    this.system.addSizeGradient(1.0, 0.0, 0.02);

    // Neon electric colors: bright white → cyan → magenta → gone
    this.system.addColorGradient(0, new Color4(1.0, 1.0, 1.0, 1.0));     // white hot
    this.system.addColorGradient(0.2, new Color4(0.2, 1.0, 1.0, 1.0));   // cyan
    this.system.addColorGradient(0.5, new Color4(0.8, 0.2, 1.0, 0.8));   // magenta
    this.system.addColorGradient(0.8, new Color4(0.3, 0.05, 0.5, 0.4));  // dark purple
    this.system.addColorGradient(1.0, new Color4(0.1, 0.0, 0.2, 0));     // transparent

    this.system.direction1 = new Vector3(-10, 2, -10);
    this.system.direction2 = new Vector3(10, 12, 10);
    this.system.minEmitPower = 5;
    this.system.maxEmitPower = 18;

    this.system.gravity = new Vector3(0, -25, 0);
    this.system.blendMode = ParticleSystem.BLENDMODE_ADD;

    this.system.minEmitBox = new Vector3(-0.3, 0, -0.3);
    this.system.maxEmitBox = new Vector3(0.3, 0.5, 0.3);

    this.system.start();
  }

  private createSparkTexture(scene: Scene): Texture {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    // Bright neon center with cyan-white glow
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.2, 'rgba(100, 255, 255, 0.8)');
    g.addColorStop(0.5, 'rgba(150, 100, 255, 0.3)');
    g.addColorStop(1, 'rgba(100, 50, 200, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    return new Texture('data:' + canvas.toDataURL(), scene, false, false);
  }

  checkAndEmit(
    speed: number,
    carPosX: number, carPosY: number, carPosZ: number,
    fwdX: number, fwdZ: number,
  ): void {
    const speedDelta = Math.abs(speed - this.prevSpeed);
    this.prevSpeed = speed;

    if (speedDelta > 5 && Math.abs(speed) > 2) {
      const pos = this.system.emitter as Vector3;
      pos.set(carPosX + fwdX * 2.5, carPosY + 0.3, carPosZ + fwdZ * 2.5);
      this.system.manualEmitCount = Math.min(Math.floor(speedDelta * 5), 80);
    }
  }

  update(_dt: number): void {}

  dispose(): void {
    this.system.dispose();
  }
}
