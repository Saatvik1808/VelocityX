/**
 * LEARNING NOTE: Physics Colliders vs Visual Meshes
 *
 * In games, the physics world and the visual world are separate. Physics
 * colliders don't need to match visual meshes exactly — simplified shapes
 * (boxes, spheres) are standard for performance. A detailed car model might
 * have 50,000 triangles, but its physics collider is just a box.
 *
 * "Fixed" rigid bodies don't move but still participate in collisions.
 * The track ground and walls are fixed bodies — they can push the car
 * around but the car can't push them.
 *
 * Key concepts: collision shapes, fixed vs dynamic bodies, physics world separation
 */

import type RAPIER from '@dimforge/rapier3d-compat';
import { TRACK } from '@neon-drift/shared';

interface CenterlinePoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
}

export class TrackColliders {
  private world: RAPIER.World;
  private rapier: typeof RAPIER;
  private bodies: RAPIER.RigidBody[] = [];

  constructor(rapier: typeof RAPIER, world: RAPIER.World, centerline: readonly CenterlinePoint[]) {
    this.world = world;
    this.rapier = rapier;

    this.buildGround();
    // Walls removed — open track with natural boundaries
  }

  /** Large flat ground collider covering the entire track area. */
  private buildGround(): void {
    const bodyDesc = this.rapier.RigidBodyDesc.fixed()
      .setTranslation(0, -5, 0); // center of 10m thick slab
    const body = this.world.createRigidBody(bodyDesc);

    // 10m thick ground slab — impossible to fall through
    const halfExtent = 500;
    const colliderDesc = this.rapier.ColliderDesc.cuboid(halfExtent, 5, halfExtent)
      .setFriction(1.0)
      .setRestitution(0.0);
    this.world.createCollider(colliderDesc, body);
    this.bodies.push(body);
  }

  /** Wall colliders along both edges of the track. */
  private buildWalls(centerline: readonly CenterlinePoint[]): void {
    const { ROAD_WIDTH, WALL_HEIGHT, WALL_THICKNESS } = TRACK;
    const halfWidth = ROAD_WIDTH / 2;
    const halfWallH = WALL_HEIGHT / 2;
    const halfWallT = WALL_THICKNESS / 2;

    for (const side of [-1, 1]) {
      for (let i = 0; i < centerline.length; i++) {
        const a = centerline[i]!;
        const b = centerline[(i + 1) % centerline.length]!;

        const ax = a.x + a.nx * halfWidth * side;
        const az = a.z + a.nz * halfWidth * side;
        const bx = b.x + b.nx * halfWidth * side;
        const bz = b.z + b.nz * halfWidth * side;

        const dx = bx - ax;
        const dz = bz - az;
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length < 0.01) continue;

        const angle = Math.atan2(dx, dz);
        const cx = (ax + bx) / 2;
        const cz = (az + bz) / 2;

        const bodyDesc = this.rapier.RigidBodyDesc.fixed()
          .setTranslation(cx, halfWallH, cz)
          .setRotation({
            x: 0,
            y: Math.sin(angle / 2),
            z: 0,
            w: Math.cos(angle / 2),
          });
        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = this.rapier.ColliderDesc
          .cuboid(length / 2, halfWallH, halfWallT)
          .setFriction(0.3)
          .setRestitution(0.5);
        this.world.createCollider(colliderDesc, body);
        this.bodies.push(body);
      }
    }
  }

  dispose(): void {
    for (const body of this.bodies) {
      this.world.removeRigidBody(body);
    }
    this.bodies.length = 0;
  }
}
