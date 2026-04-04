/**
 * LEARNING NOTE: Tron-Style Light Trail (Babylon.js)
 *
 * Creates a glowing neon ribbon behind the car, like Tron light cycles.
 * A ring buffer stores world positions; each frame we rebuild a ribbon
 * mesh with two vertices per point (bottom + top), creating a vertical
 * wall of light. Vertex colors fade alpha along the trail length so the
 * oldest part dissolves. Uses the same dynamic vertex buffer pattern as
 * SkidMarkRenderer.
 *
 * Key concepts: ring buffer, dynamic mesh, vertex color fade, neon ribbon
 */

import {
  Mesh,
  VertexData,
  StandardMaterial,
  Color3,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

/** Maximum number of trail points stored */
const MAX_POINTS = 200;
/** Minimum distance (m) between trail points to avoid overdraw */
const MIN_DIST = 0.5;
/** Trail wall height at the oldest (tallest) end */
const MAX_HEIGHT = 1.2;
/** Trail wall height ramp distance — first N points ramp from 0 to MAX_HEIGHT */
const RAMP_POINTS = 20;

interface TrailPoint {
  x: number;
  z: number;
  /** Perpendicular normal (left-pointing) at this point */
  nx: number;
  nz: number;
}

export class TronTrailRenderer {
  private mesh: Mesh;
  private points: TrailPoint[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private lastX = NaN;
  private lastZ = NaN;
  /** Trail RGB color (default cyan) */
  private trailR = 0;
  private trailG = 1;
  private trailB = 1;

  constructor(scene: Scene, color?: [number, number, number]) {
    if (color) {
      this.trailR = color[0];
      this.trailG = color[1];
      this.trailB = color[2];
    }
    const maxVerts = MAX_POINTS * 2; // bottom + top per point

    this.positions = new Float32Array(maxVerts * 3);
    this.colors = new Float32Array(maxVerts * 4);

    // Pre-build index buffer — triangle strip as indexed triangles
    const indices: number[] = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const bl = i * 2;      // bottom-left
      const tl = bl + 1;     // top-left
      const br = (i + 1) * 2; // bottom-right
      const tr = br + 1;     // top-right
      // Two triangles per quad
      indices.push(bl, br, tl, br, tr, tl);
    }

    this.mesh = new Mesh('tronTrail', scene);
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.colors = this.colors;
    vd.indices = indices;
    vd.applyToMesh(this.mesh, true);

    // Neon emissive material — self-lit glow in trail color
    const mat = new StandardMaterial('tronTrailMat', scene);
    mat.diffuseColor = new Color3(this.trailR * 0.8, this.trailG * 0.8, this.trailB * 0.8);
    mat.emissiveColor = new Color3(this.trailR, this.trailG, this.trailB);
    mat.specularColor = Color3.Black();
    mat.alpha = 1.0;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    this.mesh.material = mat;
    // Vertex colors drive per-vertex alpha fade
    this.mesh.hasVertexAlpha = true;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
  }

  /**
   * Called every render frame with the car's interpolated world position and rotation.
   * @param qx..qw — rotation quaternion (used to derive forward/perpendicular direction)
   */
  update(
    px: number, py: number, pz: number,
    qx: number, qy: number, qz: number, qw: number,
    _speed: number,
  ): void {
    // Derive forward direction from quaternion: rotate (0,0,1) by q
    const fx = 2 * (qx * qz + qw * qy);
    const fz = 1 - 2 * (qx * qx + qy * qy);

    // Perpendicular (right-hand rule, pointing left)
    const len = Math.sqrt(fx * fx + fz * fz) || 1;
    const nx = fz / len;   // perpendicular x
    const nz = -fx / len;  // perpendicular z

    // Check if car moved far enough from last point
    if (isNaN(this.lastX)) {
      // First point ever
      this.lastX = px;
      this.lastZ = pz;
    }

    const dx = px - this.lastX;
    const dz = pz - this.lastZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist >= MIN_DIST) {
      // Append new point
      this.points.push({ x: px, z: pz, nx, nz });

      // Evict oldest if over limit
      if (this.points.length > MAX_POINTS) {
        this.points.shift();
      }

      this.lastX = px;
      this.lastZ = pz;

      // Rebuild vertex buffers
      this.rebuildMesh(py);
    }
  }

  private rebuildMesh(groundY: number): void {
    const count = this.points.length;
    if (count < 2) return;

    const halfWidth = 0.4; // 0.8m total trail width

    for (let i = 0; i < count; i++) {
      const pt = this.points[i]!;
      const vi = i * 2;

      // Age factor: 0 = oldest, 1 = newest
      const ageFactor = i / (count - 1);

      // Height ramps up from car (newest) to full height (older)
      // Newest points are short, oldest are tall — Tron wall effect
      const distFromTip = count - 1 - i;
      const heightFactor = Math.min(distFromTip / RAMP_POINTS, 1);
      const height = MAX_HEIGHT * heightFactor;

      // Bottom vertex (at ground level, centered on trail path)
      this.positions[vi * 3] = pt.x;
      this.positions[vi * 3 + 1] = groundY + 0.02; // just above ground
      this.positions[vi * 3 + 2] = pt.z;

      // Top vertex (wall height)
      this.positions[(vi + 1) * 3] = pt.x;
      this.positions[(vi + 1) * 3 + 1] = groundY + 0.02 + height;
      this.positions[(vi + 1) * 3 + 2] = pt.z;

      // Vertex color: cyan with alpha fade
      // Oldest points (ageFactor near 0) → transparent
      // Newest points (ageFactor near 1) → opaque
      const alpha = ageFactor * 0.85;
      const glow = 0.3 + ageFactor * 0.7; // emissive brightness also fades

      // Bottom vertex color — uses trail color
      this.colors[vi * 4] = this.trailR * glow;
      this.colors[vi * 4 + 1] = this.trailG * glow;
      this.colors[vi * 4 + 2] = this.trailB * glow;
      this.colors[vi * 4 + 3] = alpha * 0.6; // bottom edge slightly dimmer

      // Top vertex color — brighter at the top edge
      this.colors[(vi + 1) * 4] = this.trailR * glow;
      this.colors[(vi + 1) * 4 + 1] = this.trailG * glow;
      this.colors[(vi + 1) * 4 + 2] = this.trailB * glow;
      this.colors[(vi + 1) * 4 + 3] = alpha;
    }

    // Zero out unused vertices
    for (let i = count * 2; i < MAX_POINTS * 2; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = 0;
      this.colors[i * 4] = 0;
      this.colors[i * 4 + 1] = 0;
      this.colors[i * 4 + 2] = 0;
      this.colors[i * 4 + 3] = 0;
    }

    this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, true);
    this.mesh.updateVerticesData(VertexBuffer.ColorKind, this.colors, true);
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
