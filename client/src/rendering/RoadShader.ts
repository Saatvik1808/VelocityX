/**
 * LEARNING NOTE: Neon Wet Road Material (Babylon.js)
 *
 * Dark asphalt with high metallic and low roughness to create wet-look
 * reflections. The road surface picks up neon light reflections from
 * the environment, creating the cyberpunk wet-road aesthetic.
 *
 * Key concepts: PBRMaterial, wet surface simulation, environment reflections
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

  // Dark asphalt — high metallic + low roughness = rain-slicked neon mirror
  mat.albedoColor = new Color3(0.06, 0.06, 0.08);
  mat.metallic = 0.65;       // very reflective wet surface
  mat.roughness = 0.2;       // sharp neon reflections
  mat.environmentIntensity = 1.2;  // strong neon light pickup
  mat.specularIntensity = 1.5;
  mat.backFaceCulling = false;

  // Clearcoat — thin water film creating specular highlights from neon lights
  mat.clearCoat.isEnabled = true;
  mat.clearCoat.intensity = 0.4;
  mat.clearCoat.roughness = 0.05;

  return mat;
}
