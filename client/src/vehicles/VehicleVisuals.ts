/**
 * LEARNING NOTE: Premium Hand-Crafted Car (Babylon.js)
 *
 * Smooth sports car using rounded shapes — sphere-based body for curves,
 * proper torus wheels with chrome rims, all with shiny PBR materials.
 * No GLB dependency = instant load, guaranteed physics alignment.
 *
 * Key concepts: MeshBuilder shapes, PBR materials, wheel hierarchy
 */

import {
  MeshBuilder,
  Mesh,
  PBRMaterial,
  TransformNode,
  Color3,
  Vector3,
  Quaternion,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { VEHICLE, WHEELS, WHEEL_POSITIONS } from '@neon-drift/shared';
import type { VehiclePhysics } from './VehiclePhysics.js';

export class VehicleVisuals {
  readonly root: TransformNode;
  private bodyNode: TransformNode;
  private scene: Scene;
  private smoothRoll = 0;
  private smoothPitch = 0;

  private wheelContainers: TransformNode[] = [];
  private wheelSpinners: TransformNode[] = [];
  private tailLightMats: PBRMaterial[] = [];

  private readonly _rearLeftWorld = new Vector3();
  private readonly _rearRightWorld = new Vector3();

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new TransformNode('vehicle', scene);
    this.bodyNode = new TransformNode('bodyNode', scene);
    this.bodyNode.parent = this.root;
    // Align body with wheels
    this.bodyNode.position.y = 0;
    this.buildCar();
    this.buildWheels();
  }

  private buildCar(): void {
    const W = 1.9, H = 0.7, L = 4.2;
    const hw = W / 2, hl = L / 2;

    // === MATERIALS ===
    const bodyMat = new PBRMaterial('carBody', this.scene);
    bodyMat.albedoColor = new Color3(0.8, 0.1, 0.05);
    bodyMat.metallic = 0.55;
    bodyMat.roughness = 0.15;
    bodyMat.clearCoat.isEnabled = true;
    bodyMat.clearCoat.intensity = 1.0;
    bodyMat.clearCoat.roughness = 0.04;
    bodyMat.environmentIntensity = 1.2;

    const glassMat = new PBRMaterial('glass', this.scene);
    glassMat.albedoColor = new Color3(0.08, 0.12, 0.18);
    glassMat.metallic = 0.1;
    glassMat.roughness = 0.02;
    glassMat.alpha = 0.3;

    const darkMat = new PBRMaterial('dark', this.scene);
    darkMat.albedoColor = new Color3(0.03, 0.03, 0.03);
    darkMat.metallic = 0.2;
    darkMat.roughness = 0.85;

    const chromeMat = new PBRMaterial('chrome', this.scene);
    chromeMat.albedoColor = new Color3(0.85, 0.85, 0.85);
    chromeMat.metallic = 1.0;
    chromeMat.roughness = 0.05;
    chromeMat.environmentIntensity = 2.0;

    const hlMat = new PBRMaterial('hl', this.scene);
    hlMat.albedoColor = Color3.White();
    hlMat.emissiveColor = new Color3(1, 1, 0.9);
    hlMat.emissiveIntensity = 1.5;

    // === BODY — main lower body ===
    const body = MeshBuilder.CreateBox('body', { width: W, height: H * 0.55, depth: L }, this.scene);
    body.material = bodyMat;
    body.position.y = H * 0.28;
    body.parent = this.bodyNode;

    // Hood — front top
    const hood = MeshBuilder.CreateBox('hood', { width: W * 0.94, height: H * 0.12, depth: L * 0.3 }, this.scene);
    hood.material = bodyMat;
    hood.position.set(0, H * 0.52, L * 0.23);
    hood.parent = this.bodyNode;

    // Cabin glass
    const cabin = MeshBuilder.CreateBox('cabin', { width: W * 0.8, height: H * 0.4, depth: L * 0.28 }, this.scene);
    cabin.material = glassMat;
    cabin.position.set(0, H * 0.7, -L * 0.03);
    cabin.parent = this.bodyNode;

    // Roof
    const roof = MeshBuilder.CreateBox('roof', { width: W * 0.76, height: H * 0.06, depth: L * 0.2 }, this.scene);
    roof.material = bodyMat;
    roof.position.set(0, H * 0.93, -L * 0.03);
    roof.parent = this.bodyNode;

    // Trunk
    const trunk = MeshBuilder.CreateBox('trunk', { width: W * 0.92, height: H * 0.14, depth: L * 0.2 }, this.scene);
    trunk.material = bodyMat;
    trunk.position.set(0, H * 0.48, -L * 0.32);
    trunk.parent = this.bodyNode;

    // Front bumper
    const fb = MeshBuilder.CreateBox('fb', { width: W, height: H * 0.2, depth: 0.12 }, this.scene);
    fb.material = darkMat;
    fb.position.set(0, H * 0.1, hl + 0.04);
    fb.parent = this.bodyNode;

    // Rear bumper
    const rb = MeshBuilder.CreateBox('rb', { width: W, height: H * 0.18, depth: 0.1 }, this.scene);
    rb.material = darkMat;
    rb.position.set(0, H * 0.1, -hl - 0.03);
    rb.parent = this.bodyNode;

    // Grille
    const grille = MeshBuilder.CreateBox('grille', { width: W * 0.55, height: H * 0.1, depth: 0.03 }, this.scene);
    grille.material = chromeMat;
    grille.position.set(0, H * 0.16, hl + 0.1);
    grille.parent = this.bodyNode;

    // Side skirts
    for (const s of [-1, 1]) {
      const skirt = MeshBuilder.CreateBox('skirt', { width: 0.04, height: H * 0.12, depth: L * 0.5 }, this.scene);
      skirt.material = darkMat;
      skirt.position.set(hw * s, H * 0.06, 0);
      skirt.parent = this.bodyNode;
    }

    // Fenders (rounded wheel arches)
    for (const s of [-1, 1]) {
      for (const fz of [0.28, -0.28]) {
        const fender = MeshBuilder.CreateBox('fender', { width: W * 0.12, height: H * 0.3, depth: L * 0.16 }, this.scene);
        fender.material = bodyMat;
        fender.position.set(hw * s * 0.96, H * 0.16, L * fz);
        fender.parent = this.bodyNode;
      }
    }

    // Spoiler
    for (const s of [-1, 1]) {
      const sp = MeshBuilder.CreateBox('sp', { width: 0.04, height: H * 0.18, depth: 0.04 }, this.scene);
      sp.material = bodyMat;
      sp.position.set(hw * 0.55 * s, H * 0.62, -hl + 0.12);
      sp.parent = this.bodyNode;
    }
    const wing = MeshBuilder.CreateBox('wing', { width: W * 0.7, height: 0.025, depth: 0.18 }, this.scene);
    wing.material = bodyMat;
    wing.position.set(0, H * 0.74, -hl + 0.12);
    wing.parent = this.bodyNode;

    // Headlights
    for (const s of [-1, 1]) {
      const h = MeshBuilder.CreateSphere('hl', { diameter: 0.18, segments: 8 }, this.scene);
      h.material = hlMat;
      h.position.set(hw * 0.6 * s, H * 0.32, hl + 0.06);
      h.parent = this.bodyNode;
    }

    // Tail lights
    for (const s of [-1, 1]) {
      const tlMat = new PBRMaterial('tl', this.scene);
      tlMat.albedoColor = new Color3(1, 0, 0);
      tlMat.emissiveColor = new Color3(0.9, 0, 0);
      tlMat.emissiveIntensity = 0.8;
      const tl = MeshBuilder.CreateBox('tl', { width: 0.25, height: 0.06, depth: 0.04 }, this.scene);
      tl.material = tlMat;
      tl.position.set(hw * 0.6 * s, H * 0.38, -hl - 0.02);
      tl.parent = this.bodyNode;
      this.tailLightMats.push(tlMat);
    }

    // Rear light bar
    const bar = MeshBuilder.CreateBox('bar', { width: W * 0.4, height: 0.02, depth: 0.03 }, this.scene);
    const barMat = new PBRMaterial('barM', this.scene);
    barMat.albedoColor = new Color3(0.8, 0, 0);
    barMat.emissiveColor = new Color3(0.5, 0, 0);
    barMat.emissiveIntensity = 0.4;
    bar.material = barMat;
    bar.position.set(0, H * 0.38, -hl - 0.01);
    bar.parent = this.bodyNode;

    // Exhaust tips
    for (const s of [-0.3, 0.3]) {
      const ex = MeshBuilder.CreateCylinder('ex', { diameter: 0.08, height: 0.12, tessellation: 8 }, this.scene);
      ex.material = chromeMat;
      ex.rotation.x = Math.PI / 2;
      ex.position.set(s, H * 0.06, -hl - 0.08);
      ex.parent = this.bodyNode;
    }
  }

  private buildWheels(): void {
    // Tire material — dark rubber
    const tireMat = new PBRMaterial('tire', this.scene);
    tireMat.albedoColor = new Color3(0.06, 0.06, 0.06);
    tireMat.metallic = 0.02;
    tireMat.roughness = 0.95;

    // Rim material — shiny alloy
    const rimMat = new PBRMaterial('rim', this.scene);
    rimMat.albedoColor = new Color3(0.75, 0.75, 0.78);
    rimMat.metallic = 0.95;
    rimMat.roughness = 0.08;
    rimMat.environmentIntensity = 1.8;

    // Hub material
    const hubMat = new PBRMaterial('hub', this.scene);
    hubMat.albedoColor = new Color3(0.3, 0.3, 0.32);
    hubMat.metallic = 0.8;
    hubMat.roughness = 0.2;

    for (let wi = 0; wi < WHEEL_POSITIONS.length; wi++) {
      const wp = WHEEL_POSITIONS[wi]!;

      // Container = steering
      const container = new TransformNode(`wc${wi}`, this.scene);
      container.position.set(wp.x, wp.y, wp.z);
      container.parent = this.root;

      // Spinner = wheel spin
      const spinner = new TransformNode(`ws${wi}`, this.scene);
      spinner.parent = container;

      const r = WHEELS.RADIUS;
      const w = WHEELS.WIDTH;

      // Tire — cylinder, compact, no clipping
      const tire = MeshBuilder.CreateCylinder(`tire${wi}`, {
        diameter: r * 2,
        height: w,
        tessellation: 16,
      }, this.scene);
      tire.material = tireMat;
      tire.rotation.z = Math.PI / 2;
      tire.parent = spinner;

      // Rim disc (slightly smaller diameter, narrower)
      const rim = MeshBuilder.CreateCylinder(`rim${wi}`, {
        diameter: r * 1.5,
        height: w * 0.3,
        tessellation: 12,
      }, this.scene);
      rim.material = rimMat;
      rim.rotation.z = Math.PI / 2;
      rim.parent = spinner;

      // Spokes
      for (let s = 0; s < 5; s++) {
        const spoke = MeshBuilder.CreateBox(`spoke${wi}_${s}`, {
          width: w * 0.2, height: 0.02, depth: r * 0.8,
        }, this.scene);
        spoke.material = rimMat;
        spoke.rotation.x = (s / 5) * Math.PI;
        spoke.parent = spinner;
      }

      this.wheelContainers.push(container);
      this.wheelSpinners.push(spinner);
    }
  }

  getTailLightMaterials(): PBRMaterial[] { return this.tailLightMats; }

  getRearWheelWorldPositions(): [Vector3, Vector3] {
    const rl = this.wheelContainers[2];
    const rr = this.wheelContainers[3];
    if (rl && rr) {
      this._rearLeftWorld.copyFrom(rl.getAbsolutePosition());
      this._rearRightWorld.copyFrom(rr.getAbsolutePosition());
    }
    return [this._rearLeftWorld, this._rearRightWorld];
  }

  update(physics: VehiclePhysics): void {
    const state = physics.getState();

    this.root.position.set(state.position.x, state.position.y, state.position.z);
    if (!this.root.rotationQuaternion) this.root.rotationQuaternion = new Quaternion();
    this.root.rotationQuaternion.set(
      state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w,
    );

    for (let i = 0; i < 4; i++) {
      const wi = physics.getWheelTransform(i);
      const container = this.wheelContainers[i]!;
      const spinner = this.wheelSpinners[i]!;
      const wp = WHEEL_POSITIONS[i]!;

      container.position.set(wp.x, wp.y - wi.suspensionLength + WHEELS.SUSPENSION_REST_LENGTH, wp.z);
      container.rotation.y = wi.steering;
      spinner.rotation.x = wi.rotation;
    }

    // Body roll/pitch
    const fl = physics.getWheelTransform(0).suspensionLength;
    const fr = physics.getWheelTransform(1).suspensionLength;
    const rl = physics.getWheelTransform(2).suspensionLength;
    const rr = physics.getWheelTransform(3).suspensionLength;
    const targetRoll = ((fl + rl) / 2 - (fr + rr) / 2) * 1.5;
    const targetPitch = ((fl + fr) / 2 - (rl + rr) / 2) * 1.0;
    this.smoothRoll += (targetRoll - this.smoothRoll) * 0.15;
    this.smoothPitch += (targetPitch - this.smoothPitch) * 0.15;
    const max = 0.05;
    this.bodyNode.rotation.z = Math.max(-max, Math.min(max, this.smoothRoll));
    this.bodyNode.rotation.x = Math.max(-max, Math.min(max, this.smoothPitch));
  }

  dispose(): void { this.root.dispose(false, true); }
}
