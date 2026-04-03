/**
 * LEARNING NOTE: PBR Car Paint Material (Babylon.js)
 *
 * Automotive paint uses clearCoat for the glossy top layer and
 * sheen for subtle color-shift at grazing angles.
 *
 * Key concepts: PBRMaterial, clearCoat, automotive paint
 */

import { PBRMaterial, Color3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

export function createCarPaintMaterial(
  scene: Scene,
  color: { r: number; g: number; b: number },
): PBRMaterial {
  const mat = new PBRMaterial('carPaint', scene);
  mat.albedoColor = new Color3(color.r, color.g, color.b);
  mat.metallic = 0.45;
  mat.roughness = 0.2;
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.9;
  mat.clearCoat.roughness = 0.08;
  mat.environmentIntensity = 1.0;
  mat.specularIntensity = 1.0;
  return mat;
}

export function createWindowMaterial(scene: Scene): PBRMaterial {
  const mat = new PBRMaterial('window', scene);
  mat.albedoColor = new Color3(0.15, 0.2, 0.25);
  mat.metallic = 0.1;
  mat.roughness = 0.05;
  mat.alpha = 0.35;
  mat.environmentIntensity = 0.6;
  return mat;
}
