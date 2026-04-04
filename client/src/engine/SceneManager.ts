/**
 * LEARNING NOTE: Neon Cyberpunk Scene Lighting (Babylon.js)
 *
 * Dark atmospheric scene with deep blacks and neon-tinted ambient light.
 * Low-intensity directional lights preserve darkness while neon emissives
 * pop. Dense fog adds depth and glow diffusion for that cyberpunk look.
 *
 * Key concepts: dark scene setup, colored fog, ambient neon lighting
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
    // Deep dark sky — almost black with slight purple tint
    this.scene.clearColor = new Color4(0.02, 0.01, 0.05, 1.0);

    // Performance optimizations
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = true;
    this.scene.skipPointerMovePicking = true;
    this.scene.blockMaterialDirtyMechanism = true;

    // Moderate environment intensity — dark mood but PBR materials pick up neon reflections
    this.scene.environmentIntensity = 0.5;

    this.setupLights();
    this.setupFog();
  }

  private setupLights(): void {
    // Moonlight — cold blue, very dim
    const moonLight = new DirectionalLight(
      'moon',
      new Vector3(0.3, -0.6, -0.5).normalize(),
      this.scene,
    );
    moonLight.intensity = 1.2;
    moonLight.diffuse = new Color3(0.35, 0.4, 0.65);   // brighter cold blue moonlight
    moonLight.specular = new Color3(0.45, 0.5, 0.75);
    moonLight.position = new Vector3(-80, 60, 100);

    // Shadow generator
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isMobile) {
      // No shadows on mobile
    } else try {
      this.shadowGenerator = new ShadowGenerator(1024, moonLight);
      this.shadowGenerator.usePercentageCloserFiltering = true;
      this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_LOW;
      this.shadowGenerator.bias = 0.001;
      this.shadowGenerator.normalBias = 0.02;
      this.shadowGenerator.darkness = 0.85;  // very dark shadows
      this.shadowGenerator.transparencyShadow = true;
    } catch (e) {
      console.warn('Shadow generator failed:', e);
    }

    // Neon ambient fill — faint magenta/cyan mix
    const fillLight = new DirectionalLight(
      'fill',
      new Vector3(-0.4, -0.15, 0.6).normalize(),
      this.scene,
    );
    fillLight.intensity = 0.35;
    fillLight.diffuse = new Color3(0.25, 0.12, 0.45);   // visible purple fill
    fillLight.specular = Color3.Black();

    // Rim/backlight — cool blue edge highlight that outlines geometry
    const rimLight = new DirectionalLight(
      'rim',
      new Vector3(0.5, -0.3, -0.8).normalize(),
      this.scene,
    );
    rimLight.intensity = 0.25;
    rimLight.diffuse = new Color3(0.1, 0.3, 0.5);
    rimLight.specular = new Color3(0.2, 0.4, 0.6);

    // Hemisphere — dark sky with neon ground bounce
    const hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.4;
    hemiLight.diffuse = new Color3(0.08, 0.08, 0.2);    // dark blue sky
    hemiLight.groundColor = new Color3(0.15, 0.04, 0.2); // purple ground bounce
    hemiLight.specular = Color3.Black();
  }

  private setupFog(): void {
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0008;  // lighter fog — see further into the city
    this.scene.fogColor = new Color3(0.04, 0.02, 0.08);  // purple-tinted atmospheric fog
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
