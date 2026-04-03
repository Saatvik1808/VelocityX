/**
 * LEARNING NOTE: Fixed-Timestep Game Loop
 *
 * Physics engines need a constant delta-time (dt) each step to remain stable.
 * Spring-damper systems (like vehicle suspension) can explode with variable dt.
 * But monitors refresh at different rates (60Hz, 144Hz, etc.), so frame time varies.
 *
 * The solution: run physics at a FIXED rate (60Hz = 16.67ms per step) regardless
 * of frame rate. We accumulate real elapsed time and step physics in fixed chunks.
 * If a frame takes 33ms, we run two physics steps. If it takes 8ms, we skip
 * physics and just render.
 *
 * The "spiral of death" happens when physics can't keep up: each frame takes
 * longer than the fixed step, accumulator grows forever. We cap it at 100ms
 * to prevent this — better to slow down than to freeze.
 *
 * Key concepts: fixed timestep, accumulator pattern, spiral of death, interpolation
 * Further reading: https://gafferongames.com/post/fix_your_timestep/
 */

import { PHYSICS } from '@neon-drift/shared';
import { clamp } from '../utils/math.js';
import { useGameStore } from '../ui/store.js';

export type FixedUpdateFn = (dt: number) => void;
export type RenderFn = (alpha: number) => void;

export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private readonly fixedDt = PHYSICS.TIMESTEP;

  // FPS tracking
  private frameCount = 0;
  private fpsTimer = 0;

  private onFixedUpdate: FixedUpdateFn;
  private onRender: RenderFn;
  private animationId = 0;
  private running = false;

  constructor(onFixedUpdate: FixedUpdateFn, onRender: RenderFn) {
    this.onFixedUpdate = onFixedUpdate;
    this.onRender = onRender;
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  private tick = (): void => {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this.tick);

    const now = performance.now() / 1000;
    let dt = now - this.lastTime;
    this.lastTime = now;

    // Cap dt to prevent spiral of death
    dt = clamp(dt, 0, 0.1);
    this.accumulator += dt;

    // Fixed physics steps
    while (this.accumulator >= this.fixedDt) {
      this.onFixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Render with interpolation factor
    const alpha = this.accumulator / this.fixedDt;
    this.onRender(alpha);

    // FPS counter (uses rolling average)
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      useGameStore.getState().setFps(Math.round(this.frameCount / this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = 0;
    }
  };
}
