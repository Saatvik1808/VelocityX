/**
 * LEARNING NOTE: Production Vehicle Effects (Babylon.js)
 *
 * SpotLights for headlights with visible beam cones. Brake light
 * modulation via PBR emissive color. All using pre-allocated Color3.
 *
 * Key concepts: SpotLight, PBR emissive, volumetric beam cones
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
  private readonly brakeColor = new Color3(1.0, 0.15, 0.1);
  private readonly idleColor = new Color3(0.4, 0, 0);

  constructor(scene: Scene, vehicleRoot: TransformNode) {
    const hz = VEHICLE.CHASSIS_HALF_EXTENTS.z;

    const beamMat = new PBRMaterial('beamMat', scene);
    beamMat.albedoColor = new Color3(1.0, 0.95, 0.85);
    beamMat.emissiveColor = new Color3(0.08, 0.07, 0.06);
    beamMat.alpha = 0.025;
    beamMat.backFaceCulling = false;
    beamMat.disableLighting = true;
    beamMat.freeze();

    for (const x of [-0.55, 0.55]) {
      const hl = new SpotLight('hl', new Vector3(x, 0.1, hz + 0.15),
        new Vector3(0, -0.08, 1).normalize(), Math.PI / 6, 2, scene);
      hl.diffuse = new Color3(1.0, 0.93, 0.87);
      hl.intensity = 4.0;
      hl.range = 60;
      hl.parent = vehicleRoot;
      this.headlights.push(hl);

      const cone = MeshBuilder.CreateCylinder('beam', {
        diameterTop: 0.15, diameterBottom: 3.5, height: 12, tessellation: 4,
      }, scene);
      cone.material = beamMat;
      cone.rotation.x = Math.PI / 2 + 0.08;
      cone.position.set(x, 0.1, hz + 6.5);
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
