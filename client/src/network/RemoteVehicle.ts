/**
 * LEARNING NOTE: Remote Player Vehicle — Neon Cyberpunk
 *
 * Each remote player gets their own neon-themed car with a unique
 * accent color, underglow, and Tron-style light trail. The car is
 * positioned based on interpolated server snapshots. Each remote
 * player gets a deterministic accent color derived from their player
 * ID hash so the same player always has the same color.
 *
 * Key concepts: remote rendering, snapshot interpolation, per-player color
 */

import {
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  PointLight,
  TransformNode,
  Color3,
  Vector3,
  Quaternion,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PlayerId, PlayerSnapshot } from '@neon-drift/shared';
import { VEHICLE, WHEELS } from '@neon-drift/shared';
import { TronTrailRenderer } from '../vehicles/TronTrailRenderer.js';

/** Neon accent color palette for remote players */
const REMOTE_COLORS: [number, number, number][] = [
  [1, 0.2, 0.6],    // hot pink
  [0.2, 1, 0.4],    // neon green
  [1, 0.6, 0],      // amber
  [0.6, 0.2, 1],    // purple
  [1, 1, 0],        // yellow
  [1, 0.3, 0.1],    // orange
  [0.3, 0.6, 1],    // light blue
  [1, 0, 0.3],      // red-pink
];

/** Hash a string to a number */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export class RemoteVehicle {
  readonly root: TransformNode;
  readonly playerId: PlayerId;
  private colliderBody: RAPIER.RigidBody | null = null;
  private rapier: typeof RAPIER | null = null;
  private world: RAPIER.World | null = null;
  private trail: TronTrailRenderer;
  private accentColor: [number, number, number];

  constructor(scene: Scene, playerId: PlayerId, rapier?: typeof RAPIER, world?: RAPIER.World) {
    this.playerId = playerId;
    this.root = new TransformNode(`remote_${playerId}`, scene);

    // Pick a unique accent color from player ID
    const colorIndex = hashStr(playerId) % REMOTE_COLORS.length;
    this.accentColor = REMOTE_COLORS[colorIndex]!;

    this.buildCar(scene);
    this.buildUnderglow(scene);

    // Create Tron trail in the remote player's accent color
    this.trail = new TronTrailRenderer(scene, this.accentColor);

    // Physics collider for car-to-car interactions
    if (rapier && world) {
      this.rapier = rapier;
      this.world = world;
      const { CHASSIS_HALF_EXTENTS, CHASSIS_MASS } = VEHICLE;

      const bodyDesc = rapier.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(0, 1, 0);
      this.colliderBody = world.createRigidBody(bodyDesc);

      const colliderDesc = rapier.ColliderDesc
        .cuboid(CHASSIS_HALF_EXTENTS.x, CHASSIS_HALF_EXTENTS.y, CHASSIS_HALF_EXTENTS.z)
        .setMass(CHASSIS_MASS)
        .setRestitution(0.45)
        .setFriction(0.6);
      world.createCollider(colliderDesc, this.colliderBody);
    }
  }

  private buildCar(scene: Scene): void {
    const W = 1.9, H = 0.7, L = 4.2;
    const hw = W / 2, hl = L / 2;
    const ac = this.accentColor;

    // === MATERIALS — Dark neon themed ===
    const bodyMat = new PBRMaterial(`rBody_${this.playerId}`, scene);
    bodyMat.albedoColor = new Color3(0.03, 0.03, 0.05);
    bodyMat.metallic = 0.85;
    bodyMat.roughness = 0.1;
    bodyMat.clearCoat.isEnabled = true;
    bodyMat.clearCoat.intensity = 1.0;
    bodyMat.clearCoat.roughness = 0.02;
    bodyMat.environmentIntensity = 2.0;

    const darkMat = new PBRMaterial(`rDark_${this.playerId}`, scene);
    darkMat.albedoColor = new Color3(0.02, 0.02, 0.02);
    darkMat.metallic = 0.3;
    darkMat.roughness = 0.7;

    const glassMat = new PBRMaterial(`rGlass_${this.playerId}`, scene);
    glassMat.albedoColor = new Color3(0.02, 0.05, 0.08);
    glassMat.metallic = 0.3;
    glassMat.roughness = 0.02;
    glassMat.alpha = 0.25;

    // Neon accent material — unique per remote player
    const accentMat = new PBRMaterial(`rAccent_${this.playerId}`, scene);
    accentMat.albedoColor = new Color3(ac[0] * 0.3, ac[1] * 0.3, ac[2] * 0.3);
    accentMat.emissiveColor = new Color3(ac[0], ac[1], ac[2]);
    accentMat.emissiveIntensity = 2.0;

    // Headlight material — accent colored
    const hlMat = new PBRMaterial(`rHL_${this.playerId}`, scene);
    hlMat.albedoColor = new Color3(ac[0] * 0.5, ac[1] * 0.5, ac[2] * 0.5);
    hlMat.emissiveColor = new Color3(ac[0], ac[1], ac[2]);
    hlMat.emissiveIntensity = 3.0;

    // Tail light material — accent tinted
    const tlMat = new PBRMaterial(`rTL_${this.playerId}`, scene);
    tlMat.albedoColor = new Color3(ac[0] * 0.5, 0, ac[2] * 0.3);
    tlMat.emissiveColor = new Color3(Math.max(ac[0], 0.6), ac[1] * 0.3, ac[2] * 0.5);
    tlMat.emissiveIntensity = 1.2;

    const chromeMat = new PBRMaterial(`rChrome_${this.playerId}`, scene);
    chromeMat.albedoColor = new Color3(0.7, 0.7, 0.75);
    chromeMat.metallic = 1.0;
    chromeMat.roughness = 0.03;
    chromeMat.environmentIntensity = 3.0;

    // === BODY ===
    const body = MeshBuilder.CreateBox('rb', { width: W, height: H * 0.55, depth: L }, scene);
    body.material = bodyMat;
    body.position.y = H * 0.28;
    body.parent = this.root;

    // Hood
    const hood = MeshBuilder.CreateBox('rh', { width: W * 0.94, height: H * 0.12, depth: L * 0.3 }, scene);
    hood.material = bodyMat;
    hood.position.set(0, H * 0.52, L * 0.23);
    hood.parent = this.root;

    // Cabin
    const cabin = MeshBuilder.CreateBox('rc', { width: W * 0.8, height: H * 0.4, depth: L * 0.28 }, scene);
    cabin.material = glassMat;
    cabin.position.set(0, H * 0.7, -L * 0.03);
    cabin.parent = this.root;

    // Roof
    const roof = MeshBuilder.CreateBox('rr', { width: W * 0.76, height: H * 0.06, depth: L * 0.2 }, scene);
    roof.material = bodyMat;
    roof.position.set(0, H * 0.93, -L * 0.03);
    roof.parent = this.root;

    // Trunk
    const trunk = MeshBuilder.CreateBox('rt', { width: W * 0.92, height: H * 0.14, depth: L * 0.2 }, scene);
    trunk.material = bodyMat;
    trunk.position.set(0, H * 0.48, -L * 0.32);
    trunk.parent = this.root;

    // Bumpers
    const fb = MeshBuilder.CreateBox('rfb', { width: W, height: H * 0.2, depth: 0.12 }, scene);
    fb.material = darkMat;
    fb.position.set(0, H * 0.1, hl + 0.04);
    fb.parent = this.root;

    const rb = MeshBuilder.CreateBox('rrb', { width: W, height: H * 0.18, depth: 0.1 }, scene);
    rb.material = darkMat;
    rb.position.set(0, H * 0.1, -hl - 0.03);
    rb.parent = this.root;

    // Grille — chrome
    const grille = MeshBuilder.CreateBox('rGrille', { width: W * 0.55, height: H * 0.1, depth: 0.03 }, scene);
    grille.material = chromeMat;
    grille.position.set(0, H * 0.16, hl + 0.1);
    grille.parent = this.root;

    // Side skirts + neon accent strips
    for (const s of [-1, 1]) {
      const skirt = MeshBuilder.CreateBox('rSkirt', { width: 0.04, height: H * 0.12, depth: L * 0.5 }, scene);
      skirt.material = darkMat;
      skirt.position.set(hw * s, H * 0.06, 0);
      skirt.parent = this.root;

      // Neon accent strip along the side
      const strip = MeshBuilder.CreateBox('rNeon', { width: 0.02, height: 0.03, depth: L * 0.6 }, scene);
      strip.material = accentMat;
      strip.position.set(hw * s * 1.01, H * 0.12, 0);
      strip.parent = this.root;
    }

    // Headlights — accent colored
    for (const s of [-1, 1]) {
      const h = MeshBuilder.CreateSphere('rHL', { diameter: 0.18, segments: 8 }, scene);
      h.material = hlMat;
      h.position.set(hw * 0.6 * s, H * 0.32, hl + 0.06);
      h.parent = this.root;
    }

    // Tail lights — accent tinted
    for (const s of [-1, 1]) {
      const tl = MeshBuilder.CreateBox('rTL', { width: 0.25, height: 0.06, depth: 0.04 }, scene);
      tl.material = tlMat;
      tl.position.set(hw * 0.6 * s, H * 0.38, -hl - 0.02);
      tl.parent = this.root;
    }

    // Rear light bar
    const bar = MeshBuilder.CreateBox('rBar', { width: W * 0.4, height: 0.02, depth: 0.03 }, scene);
    const barMat = new PBRMaterial(`rBarM_${this.playerId}`, scene);
    barMat.albedoColor = new Color3(ac[0] * 0.3, 0, ac[2] * 0.15);
    barMat.emissiveColor = new Color3(ac[0], ac[1] * 0.2, ac[2] * 0.5);
    barMat.emissiveIntensity = 0.8;
    bar.material = barMat;
    bar.position.set(0, H * 0.38, -hl - 0.01);
    bar.parent = this.root;

    // Spoiler
    for (const s of [-1, 1]) {
      const sp = MeshBuilder.CreateBox('rSp', { width: 0.04, height: H * 0.18, depth: 0.04 }, scene);
      sp.material = bodyMat;
      sp.position.set(hw * 0.55 * s, H * 0.62, -hl + 0.12);
      sp.parent = this.root;
    }
    const wing = MeshBuilder.CreateBox('rWing', { width: W * 0.7, height: 0.025, depth: 0.18 }, scene);
    wing.material = bodyMat;
    wing.position.set(0, H * 0.74, -hl + 0.12);
    wing.parent = this.root;

    // Exhaust tips
    for (const s of [-0.3, 0.3]) {
      const ex = MeshBuilder.CreateCylinder('rEx', { diameter: 0.08, height: 0.12, tessellation: 8 }, scene);
      ex.material = chromeMat;
      ex.rotation.x = Math.PI / 2;
      ex.position.set(s, H * 0.06, -hl - 0.08);
      ex.parent = this.root;
    }

    // Wheels with neon rings
    const tireMat = new PBRMaterial(`rTire_${this.playerId}`, scene);
    tireMat.albedoColor = new Color3(0.04, 0.04, 0.04);
    tireMat.metallic = 0.02;
    tireMat.roughness = 0.95;

    const rimMat = new PBRMaterial(`rRim_${this.playerId}`, scene);
    rimMat.albedoColor = new Color3(0.3, 0.3, 0.35);
    rimMat.metallic = 0.95;
    rimMat.roughness = 0.05;

    const wheelNeonMat = new PBRMaterial(`rWN_${this.playerId}`, scene);
    wheelNeonMat.albedoColor = new Color3(ac[0] * 0.3, ac[1] * 0.3, ac[2] * 0.3);
    wheelNeonMat.emissiveColor = new Color3(ac[0], ac[1], ac[2]);
    wheelNeonMat.emissiveIntensity = 1.0;

    const wheelPositions = [
      { x: -(VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), z: VEHICLE.CHASSIS_HALF_EXTENTS.z - 0.3 },
      { x: (VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), z: VEHICLE.CHASSIS_HALF_EXTENTS.z - 0.3 },
      { x: -(VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), z: -VEHICLE.CHASSIS_HALF_EXTENTS.z + 0.4 },
      { x: (VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), z: -VEHICLE.CHASSIS_HALF_EXTENTS.z + 0.4 },
    ];

    for (let wi = 0; wi < wheelPositions.length; wi++) {
      const wp = wheelPositions[wi]!;
      const r = WHEELS.RADIUS;
      const w = WHEELS.WIDTH;

      const tire = MeshBuilder.CreateCylinder(`rTire${wi}`, {
        diameter: r * 2, height: w, tessellation: 12,
      }, scene);
      tire.material = tireMat;
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wp.x, -0.2, wp.z);
      tire.parent = this.root;

      // Neon ring on each wheel
      const neonRing = MeshBuilder.CreateTorus(`rNR${wi}`, {
        diameter: r * 2.02, thickness: 0.03, tessellation: 16,
      }, scene);
      neonRing.material = wheelNeonMat;
      neonRing.rotation.z = Math.PI / 2;
      neonRing.position.set(wp.x, -0.2, wp.z);
      neonRing.parent = this.root;
    }

    // All meshes non-pickable
    this.root.getChildMeshes().forEach(m => { m.isPickable = false; });
  }

  /** Neon underglow lights — accent colored */
  private buildUnderglow(scene: Scene): void {
    const ac = this.accentColor;

    const underglow = new PointLight(`rUG_${this.playerId}`, new Vector3(0, -0.1, 0), scene);
    underglow.diffuse = new Color3(ac[0], ac[1], ac[2]);
    underglow.intensity = 4.0;
    underglow.range = 9;
    underglow.parent = this.root;

    const rearGlow = new PointLight(`rRG_${this.playerId}`, new Vector3(0, -0.1, -1.5), scene);
    rearGlow.diffuse = new Color3(ac[0] * 0.8, ac[1] * 0.5, ac[2] * 0.8);
    rearGlow.intensity = 3.0;
    rearGlow.range = 6;
    rearGlow.parent = this.root;
  }

  // Collision push offset — visual displacement from being hit
  private pushX = 0;
  private pushY = 0;
  private pushZ = 0;
  private pushVelX = 0;
  private pushVelY = 0;
  private pushVelZ = 0;

  /** Apply a collision push force to this remote car */
  applyCollisionPush(forceX: number, forceY: number, forceZ: number): void {
    this.pushVelX += forceX;
    this.pushVelY += forceY;
    this.pushVelZ += forceZ;
  }

  /** Update position/rotation from interpolated server data */
  updateFromSnapshot(snapshot: PlayerSnapshot): void {
    // Decay push velocity and position (spring back to server pos)
    const dt = 1 / 60;
    this.pushX += this.pushVelX * dt;
    this.pushY += this.pushVelY * dt;
    this.pushZ += this.pushVelZ * dt;
    this.pushVelX *= 0.92;
    this.pushVelY *= 0.92;
    this.pushVelZ *= 0.92;
    this.pushX *= 0.95;
    this.pushY *= 0.95;
    this.pushZ *= 0.95;

    // Final position = server position + collision push offset
    const finalX = snapshot.x + this.pushX;
    const finalY = snapshot.y + this.pushY;
    const finalZ = snapshot.z + this.pushZ;

    this.root.position.set(finalX, finalY, finalZ);
    if (!this.root.rotationQuaternion) {
      this.root.rotationQuaternion = new Quaternion();
    }
    this.root.rotationQuaternion.set(snapshot.rx, snapshot.ry, snapshot.rz, snapshot.rw);

    // Update the Tron trail — feed interpolated position and rotation
    this.trail.update(
      finalX, finalY, finalZ,
      snapshot.rx, snapshot.ry, snapshot.rz, snapshot.rw,
      snapshot.speed,
    );

    // Move the physics body to match
    if (this.colliderBody) {
      this.colliderBody.setTranslation({ x: finalX, y: finalY, z: finalZ }, true);
      this.colliderBody.setRotation(
        { x: snapshot.rx, y: snapshot.ry, z: snapshot.rz, w: snapshot.rw }, true,
      );
    }
  }

  dispose(): void {
    if (this.colliderBody && this.world) {
      this.world.removeRigidBody(this.colliderBody);
    }
    this.trail.dispose();
    this.root.dispose(false, true);
  }
}
