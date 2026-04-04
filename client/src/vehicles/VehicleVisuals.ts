/**
 * LEARNING NOTE: Neon Cyberpunk Car (Babylon.js)
 *
 * Dark metallic body with neon underglow, cyan headlights, and
 * glowing accent strips. The car should look like it belongs in
 * a cyberpunk night race — chrome and neon on black.
 *
 * Key concepts: emissive neon accents, dark PBR, underglow lighting
 */

import {
  MeshBuilder,
  Mesh,
  PBRMaterial,
  PointLight,
  TransformNode,
  Color3,
  Vector3,
  Quaternion,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { VEHICLE, WHEELS, WHEEL_POSITIONS, VEHICLES, DEFAULT_VEHICLE_ID } from '@neon-drift/shared';
import type { VehicleDef } from '@neon-drift/shared';
import type { VehiclePhysics } from './VehiclePhysics.js';

export class VehicleVisuals {
  readonly root: TransformNode;
  private bodyNode: TransformNode;
  private scene: Scene;
  private smoothRoll = 0;
  private smoothPitch = 0;
  private vehicleDef: VehicleDef;

  private wheelContainers: TransformNode[] = [];
  private wheelSpinners: TransformNode[] = [];
  private tailLightMats: PBRMaterial[] = [];

  private readonly _rearLeftWorld = new Vector3();
  private readonly _rearRightWorld = new Vector3();

  constructor(scene: Scene, vehicleId?: string) {
    this.scene = scene;
    this.vehicleDef = VEHICLES[vehicleId ?? DEFAULT_VEHICLE_ID] ?? VEHICLES[DEFAULT_VEHICLE_ID]!;
    this.root = new TransformNode('vehicle', scene);
    this.bodyNode = new TransformNode('bodyNode', scene);
    this.bodyNode.parent = this.root;
    this.bodyNode.position.y = 0;
    this.buildCar();
    this.buildWheels();
    this.buildUnderglow();
  }

  private buildCar(): void {
    const W = 1.9, H = 0.7, L = 4.2;
    const hw = W / 2, hl = L / 2;
    const def = this.vehicleDef;

    // === MATERIALS — Dark & Neon (colored per vehicle) ===
    const bodyMat = new PBRMaterial('carBody', this.scene);
    bodyMat.albedoColor = new Color3(def.bodyColor[0], def.bodyColor[1], def.bodyColor[2]);
    bodyMat.metallic = 0.85;
    bodyMat.roughness = 0.1;   // very reflective — mirrors neon
    bodyMat.clearCoat.isEnabled = true;
    bodyMat.clearCoat.intensity = 1.0;
    bodyMat.clearCoat.roughness = 0.02;
    bodyMat.environmentIntensity = 2.0;

    const glassMat = new PBRMaterial('glass', this.scene);
    glassMat.albedoColor = new Color3(0.02, 0.05, 0.08);
    glassMat.metallic = 0.3;
    glassMat.roughness = 0.02;
    glassMat.alpha = 0.25;

    const darkMat = new PBRMaterial('dark', this.scene);
    darkMat.albedoColor = new Color3(0.02, 0.02, 0.02);
    darkMat.metallic = 0.3;
    darkMat.roughness = 0.7;

    const chromeMat = new PBRMaterial('chrome', this.scene);
    chromeMat.albedoColor = new Color3(0.7, 0.7, 0.75);
    chromeMat.metallic = 1.0;
    chromeMat.roughness = 0.03;
    chromeMat.environmentIntensity = 3.0;

    // Neon headlight material — uses vehicle accent color
    const ac = def.accentColor;
    const hlMat = new PBRMaterial('hl', this.scene);
    hlMat.albedoColor = new Color3(ac[0] * 0.5, ac[1] * 0.5, ac[2] * 0.5);
    hlMat.emissiveColor = new Color3(ac[0], ac[1], ac[2]);
    hlMat.emissiveIntensity = 3.0;

    // Neon accent strip material — uses vehicle accent color
    const accentMat = new PBRMaterial('accent', this.scene);
    accentMat.albedoColor = new Color3(ac[0] * 0.3, ac[1] * 0.3, ac[2] * 0.3);
    accentMat.emissiveColor = new Color3(ac[0], ac[1], ac[2]);
    accentMat.emissiveIntensity = 2.0;

    // === BODY — main lower body ===
    const body = MeshBuilder.CreateBox('body', { width: W, height: H * 0.55, depth: L }, this.scene);
    body.material = bodyMat;
    body.position.y = H * 0.28;
    body.parent = this.bodyNode;

    // Hood
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

    // Grille — chrome
    const grille = MeshBuilder.CreateBox('grille', { width: W * 0.55, height: H * 0.1, depth: 0.03 }, this.scene);
    grille.material = chromeMat;
    grille.position.set(0, H * 0.16, hl + 0.1);
    grille.parent = this.bodyNode;

    // Side skirts with neon accent strip
    for (const s of [-1, 1]) {
      const skirt = MeshBuilder.CreateBox('skirt', { width: 0.04, height: H * 0.12, depth: L * 0.5 }, this.scene);
      skirt.material = darkMat;
      skirt.position.set(hw * s, H * 0.06, 0);
      skirt.parent = this.bodyNode;

      // Neon accent strip along the side
      const strip = MeshBuilder.CreateBox('sideNeon', { width: 0.02, height: 0.03, depth: L * 0.6 }, this.scene);
      strip.material = accentMat;
      strip.position.set(hw * s * 1.01, H * 0.12, 0);
      strip.parent = this.bodyNode;
    }

    // Fenders
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

    // Headlights — neon cyan
    for (const s of [-1, 1]) {
      const h = MeshBuilder.CreateSphere('hl', { diameter: 0.18, segments: 8 }, this.scene);
      h.material = hlMat;
      h.position.set(hw * 0.6 * s, H * 0.32, hl + 0.06);
      h.parent = this.bodyNode;
    }

    // Tail lights — tinted by accent color
    for (const s of [-1, 1]) {
      const tlMat = new PBRMaterial('tl', this.scene);
      tlMat.albedoColor = new Color3(ac[0] * 0.5, ac[1] * 0.1, ac[2] * 0.3);
      tlMat.emissiveColor = new Color3(Math.max(ac[0], 0.6), ac[1] * 0.3, ac[2] * 0.5);
      tlMat.emissiveIntensity = 1.2;
      const tl = MeshBuilder.CreateBox('tl', { width: 0.25, height: 0.06, depth: 0.04 }, this.scene);
      tl.material = tlMat;
      tl.position.set(hw * 0.6 * s, H * 0.38, -hl - 0.02);
      tl.parent = this.bodyNode;
      this.tailLightMats.push(tlMat);
    }

    // Rear light bar — neon
    const bar = MeshBuilder.CreateBox('bar', { width: W * 0.4, height: 0.02, depth: 0.03 }, this.scene);
    const barMat = new PBRMaterial('barM', this.scene);
    barMat.albedoColor = new Color3(0.3, 0, 0.15);
    barMat.emissiveColor = new Color3(1, 0, 0.5);
    barMat.emissiveIntensity = 0.8;
    bar.material = barMat;
    bar.position.set(0, H * 0.38, -hl - 0.01);
    bar.parent = this.bodyNode;

    // Exhaust tips — chrome
    for (const s of [-0.3, 0.3]) {
      const ex = MeshBuilder.CreateCylinder('ex', { diameter: 0.08, height: 0.12, tessellation: 8 }, this.scene);
      ex.material = chromeMat;
      ex.rotation.x = Math.PI / 2;
      ex.position.set(s, H * 0.06, -hl - 0.08);
      ex.parent = this.bodyNode;
    }
  }

  /** Neon underglow — colored per vehicle definition */
  private buildUnderglow(): void {
    const ug = this.vehicleDef.underglowColor;
    const ac = this.vehicleDef.accentColor;

    // Primary underglow — vehicle underglow color
    const underglow = new PointLight('underglow', new Vector3(0, -0.1, 0), this.scene);
    underglow.diffuse = new Color3(ug[0], ug[1], ug[2]);
    underglow.intensity = 4.5;
    underglow.range = 10;
    underglow.parent = this.root;

    // Rear underglow — accent color shifted
    const rearGlow = new PointLight('rearGlow', new Vector3(0, -0.1, -1.5), this.scene);
    rearGlow.diffuse = new Color3(ac[0], ac[1], ac[2]);
    rearGlow.intensity = 3.5;
    rearGlow.range = 7;
    rearGlow.parent = this.root;
  }

  private buildWheels(): void {
    // Tire material — dark rubber
    const tireMat = new PBRMaterial('tire', this.scene);
    tireMat.albedoColor = new Color3(0.04, 0.04, 0.04);
    tireMat.metallic = 0.02;
    tireMat.roughness = 0.95;

    // Rim material — dark chrome with neon tint
    const rimMat = new PBRMaterial('rim', this.scene);
    rimMat.albedoColor = new Color3(0.3, 0.3, 0.35);
    rimMat.metallic = 0.95;
    rimMat.roughness = 0.05;
    rimMat.environmentIntensity = 2.0;

    // Hub material
    const hubMat = new PBRMaterial('hub', this.scene);
    hubMat.albedoColor = new Color3(0.15, 0.15, 0.18);
    hubMat.metallic = 0.8;
    hubMat.roughness = 0.2;

    // Neon wheel ring material — vehicle accent color
    const wac = this.vehicleDef.accentColor;
    const wheelNeonMat = new PBRMaterial('wheelNeon', this.scene);
    wheelNeonMat.albedoColor = new Color3(wac[0] * 0.3, wac[1] * 0.3, wac[2] * 0.3);
    wheelNeonMat.emissiveColor = new Color3(wac[0], wac[1], wac[2]);
    wheelNeonMat.emissiveIntensity = 1.0;

    for (let wi = 0; wi < WHEEL_POSITIONS.length; wi++) {
      const wp = WHEEL_POSITIONS[wi]!;

      const container = new TransformNode(`wc${wi}`, this.scene);
      container.position.set(wp.x, wp.y, wp.z);
      container.parent = this.root;

      const spinner = new TransformNode(`ws${wi}`, this.scene);
      spinner.parent = container;

      const r = WHEELS.RADIUS;
      const w = WHEELS.WIDTH;

      // Tire
      const tire = MeshBuilder.CreateCylinder(`tire${wi}`, {
        diameter: r * 2,
        height: w,
        tessellation: 16,
      }, this.scene);
      tire.material = tireMat;
      tire.rotation.z = Math.PI / 2;
      tire.parent = spinner;

      // Rim disc
      const rim = MeshBuilder.CreateCylinder(`rim${wi}`, {
        diameter: r * 1.5,
        height: w * 0.3,
        tessellation: 12,
      }, this.scene);
      rim.material = rimMat;
      rim.rotation.z = Math.PI / 2;
      rim.parent = spinner;

      // Neon ring around the tire
      const neonRing = MeshBuilder.CreateTorus(`neonRing${wi}`, {
        diameter: r * 2.02,
        thickness: 0.03,
        tessellation: 16,
      }, this.scene);
      neonRing.material = wheelNeonMat;
      neonRing.rotation.z = Math.PI / 2;
      neonRing.parent = spinner;

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
