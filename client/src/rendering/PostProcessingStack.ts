/**
 * LEARNING NOTE: Neon Post-Processing Pipeline (Babylon.js)
 *
 * Heavy bloom makes neon emissives glow and bleed light. Lower bloom
 * threshold catches all the neon colors. Vignette darkens edges for
 * a cinematic tunnel-vision effect. ACES tone mapping with high
 * contrast for deep blacks and bright neons.
 *
 * Key concepts: bloom for neon glow, vignette, ACES tone mapping
 */

import {
  DefaultRenderingPipeline,
  MotionBlurPostProcess,
  ImageProcessingConfiguration,
  Color4,
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

    // Bloom — wide cinematic neon glow
    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 0.25;   // catch more neon glow
    this.pipeline.bloomWeight = 0.5;       // balanced glow intensity
    this.pipeline.bloomKernel = 48;        // wider, softer cinematic spread
    this.pipeline.bloomScale = 0.6;

    // FXAA
    this.pipeline.fxaaEnabled = true;

    // Vignette — subtle darkened edges for cinematic focus
    this.pipeline.imageProcessing.vignetteEnabled = true;
    this.pipeline.imageProcessing.vignetteWeight = 2.0;
    this.pipeline.imageProcessing.vignetteStretch = 1.0;
    this.pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 1);
    this.pipeline.imageProcessing.vignetteCameraFov = 0.6;

    // Chromatic aberration — subtle at rest, intensifies with speed
    this.pipeline.chromaticAberrationEnabled = true;
    this.pipeline.chromaticAberration.aberrationAmount = 8;

    // Tone mapping — ACES filmic with high contrast for neon pop
    this.pipeline.imageProcessing.toneMappingEnabled = true;
    this.pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.pipeline.imageProcessing.exposure = 1.15;    // brighter — city is visible
    this.pipeline.imageProcessing.contrast = 1.35;    // less crushed blacks, more detail

    // Film grain — cinematic texture
    this.pipeline.grainEnabled = true;
    this.pipeline.grain.intensity = 8;
    this.pipeline.grain.animated = true;
  }

  setSpeed(speedMs: number): void {
    const absSpeed = Math.abs(speedMs);
    const t = Math.min(absSpeed / 50, 1);

    // Increase chromatic aberration with speed
    if (this.pipeline.chromaticAberrationEnabled) {
      this.pipeline.chromaticAberration.aberrationAmount = 8 + t * 40;
    }
  }

  dispose(): void {
    this.pipeline.dispose();
    this.motionBlur?.dispose();
  }
}
