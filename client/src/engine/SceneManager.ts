/**
 * LEARNING NOTE: Production Scene Lighting (Babylon.js)
 *
 * Production lighting uses: cascaded shadow maps for soft shadows at
 * multiple distances, HDR image-based lighting for realistic ambient,
 * and separated sun/fill/hemisphere lights for depth and warmth.
 *
 * Key concepts: CascadedShadowGenerator, environment intensity, PBR lighting
 */

import {
  Scene,
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  CascadedShadowGenerator,
  Vector3,
} from '@babylonjs/core';
import type { Engine, AbstractMesh } from '@babylonjs/core';

export class SceneManager {
  readonly scene: Scene;
  private shadowGenerator: ShadowGenerator | CascadedShadowGenerator | null = null;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.53, 0.68, 0.80, 1.0);

    // Performance optimizations
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = true;
    this.scene.skipPointerMovePicking = true;
    this.scene.blockMaterialDirtyMechanism = true;

    // PBR environment intensity
    this.scene.environmentIntensity = 0.8;

    this.setupLights();
    this.setupFog();
  }

  private setupLights(): void {
    // Main sun — warm golden, low angle for long shadows
    const sunLight = new DirectionalLight(
      'sun',
      new Vector3(0.5, -0.4, -0.8).normalize(),
      this.scene,
    );
    sunLight.intensity = 2.5;
    sunLight.diffuse = new Color3(1.0, 0.92, 0.75);
    sunLight.specular = new Color3(1.0, 0.95, 0.88);
    sunLight.position = new Vector3(-80, 60, 100);

    // Shadow generator — skip on mobile for performance
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isMobile) {
      // No shadows on mobile — too expensive
    } else try {
      this.shadowGenerator = new ShadowGenerator(1024, sunLight);
      this.shadowGenerator.usePercentageCloserFiltering = true;
      this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_LOW;
      this.shadowGenerator.bias = 0.001;
      this.shadowGenerator.normalBias = 0.02;
      this.shadowGenerator.darkness = 0.5;
      this.shadowGenerator.transparencyShadow = true;
    } catch (e) {
      console.warn('Shadow generator failed:', e);
    }

    // Cool fill light from opposite side
    const fillLight = new DirectionalLight(
      'fill',
      new Vector3(-0.4, -0.15, 0.6).normalize(),
      this.scene,
    );
    fillLight.intensity = 0.25;
    fillLight.diffuse = new Color3(0.6, 0.7, 0.9);
    fillLight.specular = Color3.Black(); // no specular from fill

    // Hemisphere — sky/ground gradient
    const hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.35;
    hemiLight.diffuse = new Color3(0.6, 0.8, 1.0);
    hemiLight.groundColor = new Color3(0.4, 0.35, 0.2);
    hemiLight.specular = Color3.Black();
  }

  private setupFog(): void {
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0004; // Very light fog — distant objects visible
    this.scene.fogColor = new Color3(0.7, 0.78, 0.85);
  }

  addShadowCaster(mesh: AbstractMesh): void {
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(mesh, true);
    }
  }

  enableShadowReceiver(mesh: AbstractMesh): void {
    mesh.receiveShadows = true;
  }
}
