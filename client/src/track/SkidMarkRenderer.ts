/**
 * LEARNING NOTE: Skid Mark Renderer (Babylon.js)
 *
 * Skid marks are ribbon meshes that follow the wheel path. Each strip
 * is a dynamic Mesh with updatable vertex positions. Old marks fade
 * via vertex alpha and get recycled.
 *
 * Key concepts: dynamic mesh, vertex updates, ribbon geometry
 */

import {
  Mesh,
  VertexData,
  StandardMaterial,
  Color3,
  Vector3,
  TransformNode,
  VertexBuffer,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

const MAX_STRIPS = 15;
const MAX_POINTS = 40;
const FADE_DURATION = 2.5;
const MIN_DISTANCE = 0.5;

interface SkidStrip {
  mesh: Mesh;
  pointCount: number;
  active: boolean;
  age: number;
  lastX: number;
  lastZ: number;
  positions: Float32Array;
  colors: Float32Array;
}

export class SkidMarkRenderer {
  readonly root: TransformNode;
  private strips: SkidStrip[] = [];
  private activeStripIndex = -1;
  private wasSlipping = false;

  constructor(scene: Scene) {
    this.root = new TransformNode('skidMarks', scene);

    const mat = new StandardMaterial('skidMat', scene);
    mat.diffuseColor = new Color3(0.03, 0.03, 0.03);
    mat.specularColor = Color3.Black();
    mat.alpha = 0.7;
    mat.backFaceCulling = false;

    for (let i = 0; i < MAX_STRIPS; i++) {
      const maxVerts = MAX_POINTS * 2;
      const positions = new Float32Array(maxVerts * 3);
      const colors = new Float32Array(maxVerts * 4);
      const indices: number[] = [];

      for (let j = 0; j < MAX_POINTS - 1; j++) {
        const bl = j * 2, br = bl + 1, tl = (j + 1) * 2, tr = tl + 1;
        indices.push(bl, br, tl, br, tr, tl);
      }

      const mesh = new Mesh(`skid${i}`, scene);
      const vd = new VertexData();
      vd.positions = positions;
      vd.colors = colors;
      vd.indices = indices;
      vd.applyToMesh(mesh, true); // updatable = true

      mesh.material = mat.clone(`skidMat${i}`);
      // Use material alpha for fading
      mesh.setEnabled(false);
      mesh.parent = this.root;

      this.strips.push({
        mesh,
        pointCount: 0,
        active: false,
        age: 0,
        lastX: 0,
        lastZ: 0,
        positions,
        colors,
      });
    }
  }

  update(
    isSlipping: boolean,
    leftWheelX: number, leftWheelZ: number,
    rightWheelX: number, rightWheelZ: number,
    dt: number,
  ): void {
    if (isSlipping && !this.wasSlipping) {
      this.startNewStrip(leftWheelX, leftWheelZ, rightWheelX, rightWheelZ);
    }

    if (isSlipping && this.activeStripIndex >= 0) {
      const strip = this.strips[this.activeStripIndex]!;
      const dx = leftWheelX - strip.lastX;
      const dz = leftWheelZ - strip.lastZ;
      if (Math.sqrt(dx * dx + dz * dz) >= MIN_DISTANCE && strip.pointCount < MAX_POINTS) {
        this.addPoint(strip, leftWheelX, leftWheelZ, rightWheelX, rightWheelZ);
      }
    }

    if (!isSlipping && this.wasSlipping) {
      this.activeStripIndex = -1;
    }
    this.wasSlipping = isSlipping;

    // Fade inactive strips
    for (const strip of this.strips) {
      if (!strip.active || strip === this.strips[this.activeStripIndex]) continue;
      strip.age += dt;
      if (strip.age >= FADE_DURATION) {
        this.resetStrip(strip);
      } else {
        const alpha = (1.0 - strip.age / FADE_DURATION) * 0.7;
        (strip.mesh.material as StandardMaterial).alpha = alpha;
      }
    }
  }

  private startNewStrip(lx: number, lz: number, rx: number, rz: number): void {
    let bestIdx = -1;
    let bestAge = -1;
    for (let i = 0; i < this.strips.length; i++) {
      if (!this.strips[i]!.active) { bestIdx = i; break; }
      if (this.strips[i]!.age > bestAge) { bestAge = this.strips[i]!.age; bestIdx = i; }
    }
    if (bestIdx === -1) return;

    const strip = this.strips[bestIdx]!;
    this.resetStrip(strip);
    strip.active = true;
    strip.mesh.setEnabled(true);
    this.activeStripIndex = bestIdx;
    this.addPoint(strip, lx, lz, rx, rz);
  }

  private addPoint(strip: SkidStrip, lx: number, lz: number, rx: number, rz: number): void {
    const vi = strip.pointCount * 2;
    strip.positions[vi * 3] = lx;
    strip.positions[vi * 3 + 1] = 0.02;
    strip.positions[vi * 3 + 2] = lz;
    strip.positions[(vi + 1) * 3] = rx;
    strip.positions[(vi + 1) * 3 + 1] = 0.02;
    strip.positions[(vi + 1) * 3 + 2] = rz;

    strip.pointCount++;
    strip.lastX = lx;
    strip.lastZ = lz;

    // Update mesh vertex buffer
    strip.mesh.updateVerticesData(VertexBuffer.PositionKind, strip.positions, true);
    (strip.mesh.material as StandardMaterial).alpha = 0.7;
  }

  private resetStrip(strip: SkidStrip): void {
    strip.active = false;
    strip.age = 0;
    strip.pointCount = 0;
    strip.mesh.setEnabled(false);
  }

  dispose(): void {
    this.root.dispose(false, true);
  }
}
