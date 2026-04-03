/**
 * LEARNING NOTE: PBR Road Material with Real Textures
 *
 * Uses real asphalt diffuse texture. The albedoColor multiplies with the
 * texture — keep it bright so the texture detail shows through.
 *
 * Key concepts: PBRMaterial, texture tiling, wrap mode
 */

import { PBRMaterial, Texture, Color3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

export function createRoadMaterial(scene: Scene): PBRMaterial {
  const mat = new PBRMaterial('road', scene);

  const diffuse = new Texture('/textures/asphalt_diff.jpg', scene);
  diffuse.wrapU = Texture.WRAP_ADDRESSMODE;
  diffuse.wrapV = Texture.WRAP_ADDRESSMODE;
  diffuse.uScale = 3;
  diffuse.vScale = 40;
  diffuse.anisotropicFilteringLevel = 16;
  mat.albedoTexture = diffuse;

  mat.albedoColor = new Color3(0.6, 0.6, 0.6); // Let texture show through
  mat.metallic = 0.0;
  mat.roughness = 0.85;
  mat.environmentIntensity = 0.1;
  mat.backFaceCulling = false;

  return mat;
}
