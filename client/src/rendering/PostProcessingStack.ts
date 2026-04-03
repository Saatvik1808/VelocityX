/**
 * LEARNING NOTE: Production Post-Processing (Babylon.js)
 *
 * DefaultRenderingPipeline provides bloom, FXAA, motion blur, chromatic
 * aberration, vignette, depth of field, and tone mapping in one pipeline.
 * All GPU-efficient with a single pass.
 *
 * Key concepts: DefaultRenderingPipeline, MotionBlurPostProcess, HDR
 */

import {
  DefaultRenderingPipeline,
  MotionBlurPostProcess,
  ImageProcessingConfiguration,
} from '@babylonjs/core';
import type { Scene, Camera } from '@babylonjs/core';
import { RENDERING } from '@neon-drift/shared';

export class PostProcessingStack {
  private pipeline: DefaultRenderingPipeline;
  private motionBlur: MotionBlurPostProcess | null = null;

  constructor(scene: Scene, camera: Camera) {
    this.pipeline = new DefaultRenderingPipeline(
      'pipeline', true, scene, [camera],
    );

    // Bloom — subtle glow on bright surfaces
    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 0.8;
    this.pipeline.bloomWeight = 0.35;
    this.pipeline.bloomKernel = 16; // minimal for performance
    this.pipeline.bloomScale = 0.25;

    // FXAA — fast anti-aliasing
    this.pipeline.fxaaEnabled = true;

    // Vignette — VERY subtle, no darkening at speed
    this.pipeline.imageProcessing.vignetteEnabled = false;

    // Chromatic aberration disabled for performance
    this.pipeline.chromaticAberrationEnabled = false;

    // Tone mapping — ACES filmic for cinematic look
    this.pipeline.imageProcessing.toneMappingEnabled = true;
    this.pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.pipeline.imageProcessing.exposure = 1.4;
    this.pipeline.imageProcessing.contrast = 1.25;

    // Motion blur disabled for performance
  }

  setSpeed(speedMs: number): void {
    const absSpeed = Math.abs(speedMs);
    const t = Math.min(absSpeed / 50, 1);

    // No speed-reactive effects — performance first
  }

  dispose(): void {
    this.pipeline.dispose();
    this.motionBlur?.dispose();
  }
}
