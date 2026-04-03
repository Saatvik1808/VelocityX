/**
 * LEARNING NOTE: Remote Player Vehicle
 *
 * Each remote player gets their own car mesh that's positioned based
 * on interpolated server snapshots. The car looks identical to the
 * local player's car but doesn't have physics — it's purely visual.
 *
 * Key concepts: remote rendering, snapshot interpolation, player labels
 */

import {
  MeshBuilder,
  PBRMaterial,
  TransformNode,
  Color3,
  Vector3,
  Quaternion,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PlayerId, PlayerSnapshot } from '@neon-drift/shared';
import { VEHICLE, WHEELS } from '@neon-drift/shared';

export class RemoteVehicle {
  readonly root: TransformNode;
  readonly playerId: PlayerId;
  private colliderBody: RAPIER.RigidBody | null = null;
  private rapier: typeof RAPIER | null = null;
  private world: RAPIER.World | null = null;

  constructor(scene: Scene, playerId: PlayerId, rapier?: typeof RAPIER, world?: RAPIER.World) {
    this.playerId = playerId;
    this.root = new TransformNode(`remote_${playerId}`, scene);

    this.buildCar(scene);

    // Dynamic physics body — both cars push each other on collision.
    // We set velocity each frame to move it toward the server position
    // instead of teleporting, so Rapier can compute proper collision forces.
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

    // Different color for remote players (blue)
    const bodyMat = new PBRMaterial(`rBody_${this.playerId}`, scene);
    bodyMat.albedoColor = new Color3(0.1, 0.3, 0.8);
    bodyMat.metallic = 0.55;
    bodyMat.roughness = 0.15;
    bodyMat.clearCoat.isEnabled = true;
    bodyMat.clearCoat.intensity = 1.0;
    bodyMat.clearCoat.roughness = 0.04;

    const darkMat = new PBRMaterial(`rDark_${this.playerId}`, scene);
    darkMat.albedoColor = new Color3(0.03, 0.03, 0.03);
    darkMat.metallic = 0.2;
    darkMat.roughness = 0.85;

    // Body
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
    const glassMat = new PBRMaterial(`rGlass_${this.playerId}`, scene);
    glassMat.albedoColor = new Color3(0.08, 0.12, 0.18);
    glassMat.alpha = 0.3;
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

    // Tail lights
    const tlMat = new PBRMaterial(`rTL_${this.playerId}`, scene);
    tlMat.albedoColor = new Color3(1, 0, 0);
    tlMat.emissiveColor = new Color3(0.8, 0, 0);
    for (const s of [-1, 1]) {
      const tl = MeshBuilder.CreateBox('rtl', { width: 0.25, height: 0.06, depth: 0.04 }, scene);
      tl.material = tlMat;
      tl.position.set(hw * 0.6 * s, H * 0.38, -hl - 0.02);
      tl.parent = this.root;
    }

    // Wheels (simple cylinders, no steering needed for remote)
    const tireMat = new PBRMaterial(`rTire_${this.playerId}`, scene);
    tireMat.albedoColor = new Color3(0.06, 0.06, 0.06);
    tireMat.roughness = 0.95;

    const positions = [
      { x: -(VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), z: VEHICLE.CHASSIS_HALF_EXTENTS.z - 0.3 },
      { x: (VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), z: VEHICLE.CHASSIS_HALF_EXTENTS.z - 0.3 },
      { x: -(VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), z: -VEHICLE.CHASSIS_HALF_EXTENTS.z + 0.4 },
      { x: (VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), z: -VEHICLE.CHASSIS_HALF_EXTENTS.z + 0.4 },
    ];

    for (const wp of positions) {
      const tire = MeshBuilder.CreateCylinder('rw', {
        diameter: WHEELS.RADIUS * 2, height: WHEELS.WIDTH, tessellation: 10,
      }, scene);
      tire.material = tireMat;
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wp.x, -0.2, wp.z);
      tire.parent = this.root;
    }

    // All meshes non-pickable
    this.root.getChildMeshes().forEach(m => { m.isPickable = false; });
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
    this.pushVelX *= 0.92; // friction decay
    this.pushVelY *= 0.92;
    this.pushVelZ *= 0.92;
    this.pushX *= 0.95; // spring back to server pos
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
    this.root.dispose(false, true);
  }
}
