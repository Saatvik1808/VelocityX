/**
 * LEARNING NOTE: Spline-Based Track with ExtrudeShape (Babylon.js)
 *
 * Instead of manually placing tiles, we define control points and generate
 * a smooth Catmull-Rom spline curve. The road mesh is extruded along
 * this curve using MeshBuilder.ExtrudeShape, giving smooth curves,
 * consistent width, and natural elevation changes.
 *
 * Key concepts: Catmull-Rom spline, ExtrudeShape, elevation, track design
 */

import {
  MeshBuilder,
  Mesh,
  VertexData,
  PBRMaterial,
  Texture,
  Color3,
  Vector3,
  Matrix,
  Curve3,
  TransformNode,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { TRACK } from '@neon-drift/shared';
import type { Vec3Like, QuatLike } from '@neon-drift/shared';
import { createRoadMaterial } from '../rendering/RoadShader.js';

interface CenterlinePoint {
  x: number; z: number; nx: number; nz: number;
}

export class TrackBuilder {
  readonly root: TransformNode;
  private centerline: CenterlinePoint[] = [];
  private splinePath: Vector3[] = [];
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new TransformNode('track', scene);
    this.buildSplineTrack();
    this.buildGroundPlane();
    this.buildRoadShoulders();
  }

  /**
   * Generate a figure-8 racing track using Catmull-Rom spline.
   * Control points define: long straights, medium turns, sharp corners, S-curves.
   * Elevation varies for hills and dips.
   */
  /**
   * F1-style circuit — no intersections.
   * Features: long main straight, hard braking zone, hairpin,
   * fast sweeper, chicane (S-curve), medium-speed corners.
   */
  private buildSplineTrack(): void {
    // Clean clockwise circuit — all turns go RIGHT, no crossings possible.
    // Think of it like driving around a deformed rectangle.
    const controlPoints = [
      // Main straight (bottom edge, going right)
      new Vector3(-150, 0, -80),     // start/finish
      new Vector3(-50, 0, -80),
      new Vector3(50, 0, -80),
      new Vector3(130, 0, -80),      // end of main straight

      // Turn 1 — right turn going up
      new Vector3(170, 0, -60),
      new Vector3(190, 0, -20),

      // Right side straight (going up)
      new Vector3(190, 0, 40),
      new Vector3(180, 0, 80),

      // Turn 2 — right sweeper at top-right
      new Vector3(150, 0, 110),
      new Vector3(100, 0, 120),

      // Top straight (going left)
      new Vector3(30, 0, 115),
      new Vector3(-40, 0, 120),

      // Turn 3 — chicane / S-curve at top-left
      new Vector3(-80, 0, 110),
      new Vector3(-110, 0, 80),
      new Vector3(-130, 0, 50),

      // Left side (going down)
      new Vector3(-150, 0, 10),
      new Vector3(-160, 0, -30),

      // Turn 4 — right turn back to start
      new Vector3(-170, 0, -60),
      new Vector3(-160, 0, -75),
    ];

    // Close the loop
    controlPoints.push(controlPoints[0]!.clone());

    // Generate smooth spline (60 points per segment = very smooth)
    const spline = Curve3.CreateCatmullRomSpline(controlPoints, 60, true);
    this.splinePath = spline.getPoints();

    // Build centerline data for other systems (lighting, environment, colliders)
    this.buildCenterlineFromSpline();

    // Create road mesh via ExtrudeShape
    this.buildRoadFromSpline();
  }

  private buildCenterlineFromSpline(): void {
    const path = this.splinePath;
    this.centerline = [];

    for (let i = 0; i < path.length; i++) {
      const pt = path[i]!;
      const next = path[(i + 1) % path.length]!;
      const dx = next.x - pt.x;
      const dz = next.z - pt.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.001) continue;

      // Normal is perpendicular to direction (rotated 90°)
      this.centerline.push({
        x: pt.x,
        z: pt.z,
        nx: -dz / len,
        nz: dx / len,
      });
    }
  }

  private buildRoadFromSpline(): void {
    const hw = TRACK.ROAD_WIDTH / 2;

    // Road cross-section shape (completely flat at ground level)
    // Road at Y=0 — exactly on the physics ground surface
    const shape = [
      new Vector3(-hw, 0, 0),
      new Vector3(hw, 0, 0),
    ];

    // Extrude the road shape along the spline path
    const road = MeshBuilder.ExtrudeShape('road', {
      shape: shape,
      path: this.splinePath,
      sideOrientation: Mesh.DOUBLESIDE,
      updatable: false,
    }, this.scene);

    road.material = createRoadMaterial(this.scene);
    road.receiveShadows = true;
    road.freezeWorldMatrix();
    road.parent = this.root;
  }

  private buildGroundPlane(): void {
    const ground = MeshBuilder.CreateGround('ground', {
      width: 2000, height: 2000, subdivisions: 40,
    }, this.scene);
    ground.position.y = -0.15;

    const mat = new PBRMaterial('grassMat', this.scene);

    const grassDiffuse = new Texture('/textures/grass_color.jpg', this.scene);
    grassDiffuse.uScale = 100;
    grassDiffuse.vScale = 100;
    grassDiffuse.anisotropicFilteringLevel = 8;
    mat.albedoTexture = grassDiffuse;

    const grassNormal = new Texture('/textures/grass_normal.jpg', this.scene);
    grassNormal.uScale = 100;
    grassNormal.vScale = 100;
    mat.bumpTexture = grassNormal;

    mat.albedoColor = new Color3(0.9, 0.95, 0.85);
    mat.metallic = 0.0;
    mat.roughness = 0.92;
    mat.environmentIntensity = 0.15;

    ground.material = mat;
    ground.receiveShadows = true;
    ground.freezeWorldMatrix();
    ground.parent = this.root;
  }

  private buildRoadShoulders(): void {
    const hw = TRACK.ROAD_WIDTH / 2;
    const sw = 4; // shoulder width

    const shoulderMat = new PBRMaterial('shoulderMat', this.scene);
    shoulderMat.albedoColor = new Color3(0.5, 0.44, 0.38);
    shoulderMat.metallic = 0.0;
    shoulderMat.roughness = 0.92;
    shoulderMat.freeze();

    for (const side of [-1, 1]) {
      // Shoulder cross-section
      const shape = [
        new Vector3(0, 0, 0),
        new Vector3(sw * side, -0.02, 0),
      ];

      // Offset path for the shoulder edge
      const offsetPath = this.splinePath.map((pt, i) => {
        const next = this.splinePath[(i + 1) % this.splinePath.length]!;
        const dx = next.x - pt.x;
        const dz = next.z - pt.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;
        return new Vector3(
          pt.x + nx * hw * side,
          pt.y - 0.01,
          pt.z + nz * hw * side,
        );
      });

      const shoulder = MeshBuilder.ExtrudeShape('shoulder', {
        shape: shape,
        path: offsetPath,
        sideOrientation: Mesh.DOUBLESIDE,
        updatable: false,
      }, this.scene);

      shoulder.material = shoulderMat;
      shoulder.receiveShadows = true;
      shoulder.freezeWorldMatrix();
      shoulder.parent = this.root;
    }
  }

  private buildCurbStrips(): void {
    const hw = TRACK.ROAD_WIDTH / 2 - 0.3;
    const count = this.centerline.length;

    const curbMat = new PBRMaterial('curbMat', this.scene);
    curbMat.albedoColor = new Color3(0.93, 0.93, 0.93);
    curbMat.metallic = 0.0;
    curbMat.roughness = 0.6;
    curbMat.freeze();

    // Sample every Nth point for curb placement (not every point)
    const step = Math.max(1, Math.floor(count / 200));

    for (const side of [-1, 1]) {
      const base = MeshBuilder.CreateBox('curb', { width: 1, height: 0.03, depth: 0.4 }, this.scene);
      base.material = curbMat;
      base.parent = this.root;

      const matrices: Matrix[] = [];
      const colors: number[] = [];

      for (let i = 0; i < count; i += step) {
        const a = this.centerline[i]!;
        const b = this.centerline[(i + step) % count]!;
        const ax = a.x + a.nx * hw * side;
        const az = a.z + a.nz * hw * side;
        const bx = b.x + b.nx * hw * side;
        const bz = b.z + b.nz * hw * side;
        const dx = bx - ax, dz = bz - az;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.01) continue;

        const angle = Math.atan2(dx, dz);
        matrices.push(Matrix.Compose(
          new Vector3(len, 1, 1),
          new Vector3(0, angle, 0).toQuaternion(),
          new Vector3((ax + bx) / 2, 0.06, (az + bz) / 2),
        ));
        if ((i / step) % 2 === 0) colors.push(0.7, 0.2, 0.15, 1);
        else colors.push(0.9, 0.9, 0.88, 1);
      }

      if (matrices.length > 0) {
        const buf = new Float32Array(matrices.length * 16);
        matrices.forEach((m, idx) => m.copyToArray(buf, idx * 16));
        base.thinInstanceSetBuffer('matrix', buf, 16);
        base.thinInstanceSetBuffer('color', new Float32Array(colors), 4);
        base.freezeWorldMatrix();
      }
    }
  }

  getCenterline(): readonly CenterlinePoint[] { return this.centerline; }

  /**
   * Get spawn position for a player. Each player gets a different grid slot.
   * @param playerIndex 0-based index (0 = pole position)
   */
  getStartPosition(playerIndex: number = 0): { position: Vec3Like; rotation: QuatLike } {
    const start = this.centerline[0];
    if (!start) return { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };

    const next = this.centerline[1];
    let rotY = 0;
    let fwdX = 0, fwdZ = 1;
    if (next) {
      const dx = next.x - start.x;
      const dz = next.z - start.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      fwdX = dx / len;
      fwdZ = dz / len;
      rotY = Math.atan2(dx, dz);
    }

    // All cars side by side on the same start line, evenly spaced
    const totalSlots = 8; // max players
    const spacing = 4; // 4m between car centers (car is ~1.9m wide)
    const totalWidth = (totalSlots - 1) * spacing;
    const lateralOffset = -totalWidth / 2 + playerIndex * spacing;
    const backOffset = 0; // all on the same line

    // Perpendicular direction (right of forward)
    const rightX = -fwdZ;
    const rightZ = fwdX;

    return {
      position: {
        x: start.x + rightX * lateralOffset - fwdX * backOffset,
        y: 0.8, // just above ground — wheels touch immediately
        z: start.z + rightZ * lateralOffset - fwdZ * backOffset,
      },
      rotation: { x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) },
    };
  }

  dispose(): void { this.root.dispose(false, true); }
}
