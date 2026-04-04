/**
 * LEARNING NOTE: Neon Vehicle Effects (Babylon.js)
 *
 * Cyan neon headlight beams, magenta brake lights. The headlight
 * cones are tinted cyan for the cyberpunk look. All emissive colors
 * are neon-saturated.
 *
 * Key concepts: colored SpotLights, neon beam cones, brake modulation
 */

import {
  SpotLight,
  MeshBuilder,
  PBRMaterial,
  Vector3,
  Color3,
  TransformNode,
} from '@babylonjs/core';
import type { Scene, Mesh } from '@babylonjs/core';
import { VEHICLE } from '@neon-drift/shared';
import type { InputState } from '@neon-drift/shared';

export class VehicleEffects {
  private headlights: SpotLight[] = [];
  private beamCones: Mesh[] = [];
  private tailLightMaterials: PBRMaterial[] = [];
  private readonly brakeColor = new Color3(1.0, 0, 0.6);     // neon magenta brake
  private readonly idleColor = new Color3(0.4, 0, 0.25);     // dim magenta idle

  constructor(scene: Scene, vehicleRoot: TransformNode) {
    const hz = VEHICLE.CHASSIS_HALF_EXTENTS.z;

    const beamMat = new PBRMaterial('beamMat', scene);
    beamMat.albedoColor = new Color3(0, 0.8, 0.8);    // cyan tint
    beamMat.emissiveColor = new Color3(0, 0.2, 0.2);
    beamMat.alpha = 0.06;
    beamMat.backFaceCulling = false;
    beamMat.disableLighting = true;
    beamMat.freeze();

    for (const x of [-0.55, 0.55]) {
      const hl = new SpotLight('hl', new Vector3(x, 0.1, hz + 0.15),
        new Vector3(0, -0.08, 1).normalize(), Math.PI / 6, 2, scene);
      hl.diffuse = new Color3(0, 0.9, 1.0);   // cyan headlights
      hl.intensity = 8.0;
      hl.range = 80;
      hl.parent = vehicleRoot;
      this.headlights.push(hl);

      const cone = MeshBuilder.CreateCylinder('beam', {
        diameterTop: 0.15, diameterBottom: 4.5, height: 16, tessellation: 4,
      }, scene);
      cone.material = beamMat;
      cone.rotation.x = Math.PI / 2 + 0.08;
      cone.position.set(x, 0.1, hz + 8.5);
      cone.isPickable = false;
      cone.parent = vehicleRoot;
      this.beamCones.push(cone);
    }
  }

  setTailLightMaterials(materials: PBRMaterial[]): void {
    this.tailLightMaterials = materials;
  }

  update(input: InputState): void {
    const color = input.brake ? this.brakeColor : this.idleColor;
    for (const mat of this.tailLightMaterials) {
      mat.emissiveColor = color;
    }
  }

  dispose(): void {
    for (const hl of this.headlights) hl.dispose();
    for (const c of this.beamCones) c.dispose();
  }
}
