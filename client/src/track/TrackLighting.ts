/**
 * LEARNING NOTE: Neon Track Lighting (Babylon.js)
 *
 * Neon-colored point lights along the track in cyan, magenta, and amber.
 * Glowing neon strip barriers line both edges of the road.
 * Start/finish gantry with bright neon accent.
 *
 * Key concepts: colored PointLights, emissive neon materials, neon barriers
 */

import {
  MeshBuilder,
  PBRMaterial,
  Color3,
  Vector3,
  Matrix,
  PointLight,
  TransformNode,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { TRACK } from '@neon-drift/shared';

interface CenterlinePoint { x: number; z: number; nx: number; nz: number; }

// Neon color palette
const NEON_CYAN = new Color3(0, 1, 1);
const NEON_MAGENTA = new Color3(1, 0, 1);
const NEON_AMBER = new Color3(1, 0.5, 0);
const NEON_GREEN = new Color3(0, 1, 0.5);
const NEON_PINK = new Color3(1, 0, 0.4);
const NEON_COLORS = [NEON_CYAN, NEON_MAGENTA, NEON_AMBER, NEON_GREEN, NEON_PINK];

export class TrackLighting {
  readonly root: TransformNode;
  private lights: PointLight[] = [];

  constructor(scene: Scene, centerline: readonly CenterlinePoint[]) {
    this.root = new TransformNode('trackLighting', scene);
    this.buildNeonBarriers(scene, centerline);
    this.buildNeonLights(scene, centerline);
    this.buildNeonArches(scene, centerline);
    this.buildStartFinishLine(scene, centerline);
    this.buildStartGantry(scene, centerline);
  }

  /** Glowing neon strip barriers along both track edges */
  private buildNeonBarriers(scene: Scene, centerline: readonly CenterlinePoint[]): void {
    const hw = TRACK.ROAD_WIDTH / 2;
    const count = centerline.length;
    const step = Math.max(1, Math.floor(count / 200));

    for (const side of [-1, 1]) {
      // Alternate neon colors along the barrier
      const base = MeshBuilder.CreateBox('barrier', { width: 1, height: 0.15, depth: 0.15 }, scene);
      const barrierMat = new PBRMaterial('barrierMat' + side, scene);
      barrierMat.albedoColor = new Color3(0.02, 0.02, 0.02);
      barrierMat.emissiveColor = side === -1 ? NEON_CYAN : NEON_MAGENTA;
      barrierMat.emissiveIntensity = 2.0;
      barrierMat.metallic = 0.8;
      barrierMat.roughness = 0.2;
      barrierMat.freeze();
      base.material = barrierMat;
      base.isPickable = false;
      base.parent = this.root;

      const matrices: Matrix[] = [];

      for (let i = 0; i < count; i += step) {
        const a = centerline[i]!;
        const b = centerline[(i + step) % count]!;
        const ax = a.x + a.nx * (hw + 0.5) * side;
        const az = a.z + a.nz * (hw + 0.5) * side;
        const bx = b.x + b.nx * (hw + 0.5) * side;
        const bz = b.z + b.nz * (hw + 0.5) * side;
        const dx = bx - ax, dz = bz - az;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.01) continue;

        const angle = Math.atan2(dx, dz);
        matrices.push(Matrix.Compose(
          new Vector3(len, 1, 1),
          new Vector3(0, angle, 0).toQuaternion(),
          new Vector3((ax + bx) / 2, 0.08, (az + bz) / 2),
        ));
      }

      if (matrices.length > 0) {
        const buf = new Float32Array(matrices.length * 16);
        matrices.forEach((m, idx) => m.copyToArray(buf, idx * 16));
        base.thinInstanceSetBuffer('matrix', buf, 16);
        base.freezeWorldMatrix();
      }
    }
  }

  /** Neon-colored point lights along the track */
  private buildNeonLights(scene: Scene, centerline: readonly CenterlinePoint[]): void {
    const hw = TRACK.ROAD_WIDTH / 2;
    const lightCount = 20;
    const total = centerline.length;
    const interval = Math.floor(total / lightCount);

    // Dark pole material
    const poleMat = new PBRMaterial('poleMat', scene);
    poleMat.albedoColor = new Color3(0.05, 0.05, 0.05);
    poleMat.metallic = 0.7; poleMat.roughness = 0.3;
    poleMat.freeze();

    const pole = MeshBuilder.CreateCylinder('pole', {
      diameterTop: 0.14, diameterBottom: 0.2, height: 6, tessellation: 5,
    }, scene);
    pole.material = poleMat;
    pole.isPickable = false;
    pole.parent = this.root;

    const poleM: Matrix[] = [];

    for (let i = 0; i < lightCount; i++) {
      const idx = (i * interval) % total;
      const pt = centerline[idx]!;
      const side = i % 2 === 0 ? -1 : 1;
      const px = pt.x + pt.nx * (hw + 20) * side;
      const pz = pt.z + pt.nz * (hw + 20) * side;

      poleM.push(Matrix.Translation(px, 3, pz));

      // Pick neon color
      const neonColor = NEON_COLORS[i % NEON_COLORS.length]!;

      const light = new PointLight(`nl${i}`, new Vector3(px, 6, pz), scene);
      light.diffuse = neonColor;
      light.intensity = 8.0;
      light.range = 70;
      this.lights.push(light);

      // Glowing fixture
      const fixtureMat = new PBRMaterial(`fixMat${i}`, scene);
      fixtureMat.albedoColor = new Color3(0.02, 0.02, 0.02);
      fixtureMat.emissiveColor = neonColor;
      fixtureMat.emissiveIntensity = 2.0;
      fixtureMat.freeze();

      const fixture = MeshBuilder.CreateBox(`fixture${i}`, { width: 0.5, height: 0.15, depth: 0.3 }, scene);
      fixture.material = fixtureMat;
      fixture.position.set(px, 6.1, pz);
      fixture.isPickable = false;
      fixture.parent = this.root;
    }

    this.applyThin(pole, poleM);
    pole.freezeWorldMatrix();
  }

  private applyThin(mesh: any, matrices: Matrix[]): void {
    if (!matrices.length) return;
    const buf = new Float32Array(matrices.length * 16);
    matrices.forEach((m, i) => m.copyToArray(buf, i * 16));
    mesh.thinInstanceSetBuffer('matrix', buf, 16);
  }

  /** Neon arches spanning the road — tunnel-of-neon effect */
  private buildNeonArches(scene: Scene, centerline: readonly CenterlinePoint[]): void {
    const hw = TRACK.ROAD_WIDTH / 2;
    const archCount = 6;
    const total = centerline.length;
    const interval = Math.floor(total / archCount);

    for (let i = 0; i < archCount; i++) {
      const idx = ((i + 1) * interval) % total;
      const pt = centerline[idx]!;
      const next = centerline[(idx + 1) % total]!;
      const angle = Math.atan2(next.x - pt.x, next.z - pt.z);
      const neonColor = NEON_COLORS[i % NEON_COLORS.length]!;

      const archMat = new PBRMaterial(`archMat${i}`, scene);
      archMat.albedoColor = new Color3(0.03, 0.03, 0.03);
      archMat.emissiveColor = neonColor;
      archMat.emissiveIntensity = 1.8;
      archMat.metallic = 0.6;
      archMat.roughness = 0.3;
      archMat.freeze();

      // Two thin poles on each side
      for (const side of [-1, 1]) {
        const pole = MeshBuilder.CreateBox(`archPole${i}_${side}`, {
          width: 0.12, height: 7, depth: 0.12,
        }, scene);
        pole.material = archMat;
        const ox = Math.cos(angle) * hw * side;
        const oz = -Math.sin(angle) * hw * side;
        pole.position.set(pt.x + ox, 3.5, pt.z + oz);
        pole.rotation.y = angle;
        pole.isPickable = false;
        pole.freezeWorldMatrix();
        pole.parent = this.root;
      }

      // Crossbar across the top
      const crossbar = MeshBuilder.CreateBox(`archBar${i}`, {
        width: TRACK.ROAD_WIDTH + 0.5, height: 0.2, depth: 0.2,
      }, scene);
      crossbar.material = archMat;
      crossbar.position.set(pt.x, 7, pt.z);
      crossbar.rotation.y = angle;
      crossbar.isPickable = false;
      crossbar.freezeWorldMatrix();
      crossbar.parent = this.root;

      // Light underneath the arch
      const archLight = new PointLight(`archLight${i}`, new Vector3(pt.x, 6.5, pt.z), scene);
      archLight.diffuse = neonColor;
      archLight.intensity = 6.0;
      archLight.range = 35;
      this.lights.push(archLight);
    }
  }

  private buildStartFinishLine(scene: Scene, centerline: readonly CenterlinePoint[]): void {
    const start = centerline[0];
    if (!start) return;
    const line = MeshBuilder.CreateBox('startLine', { width: TRACK.ROAD_WIDTH, height: 0.02, depth: 1 }, scene);
    const mat = new PBRMaterial('slMat', scene);
    mat.albedoColor = new Color3(0.02, 0.02, 0.02);
    mat.emissiveColor = NEON_CYAN;
    mat.emissiveIntensity = 1.2;
    mat.freeze();
    line.material = mat;
    line.position.set(start.x, 0.02, start.z);
    const next = centerline[1];
    if (next) line.rotation.y = Math.atan2(next.x - start.x, next.z - start.z);
    line.isPickable = false;
    line.freezeWorldMatrix();
    line.parent = this.root;
  }

  private buildStartGantry(scene: Scene, centerline: readonly CenterlinePoint[]): void {
    const start = centerline[0], next = centerline[1];
    if (!start || !next) return;
    const angle = Math.atan2(next.x - start.x, next.z - start.z);
    const hw = TRACK.ROAD_WIDTH / 2;

    const gMat = new PBRMaterial('gMat', scene);
    gMat.albedoColor = new Color3(0.03, 0.03, 0.03);
    gMat.emissiveColor = NEON_MAGENTA;
    gMat.emissiveIntensity = 0.6;
    gMat.metallic = 0.6; gMat.roughness = 0.3;
    gMat.freeze();

    for (const side of [-1, 1]) {
      const p = MeshBuilder.CreateBox('gp', { width: 0.4, height: 8, depth: 0.4 }, scene);
      p.material = gMat;
      const ox = Math.cos(angle) * hw * side, oz = -Math.sin(angle) * hw * side;
      p.position.set(start.x + ox, 4, start.z + oz);
      p.rotation.y = angle;
      p.isPickable = false; p.freezeWorldMatrix();
      p.parent = this.root;
    }

    const crossbar = MeshBuilder.CreateBox('cb', { width: TRACK.ROAD_WIDTH + 1, height: 0.6, depth: 0.6 }, scene);
    crossbar.material = gMat;
    crossbar.position.set(start.x, 8, start.z);
    crossbar.rotation.y = angle;
    crossbar.isPickable = false; crossbar.freezeWorldMatrix();
    crossbar.parent = this.root;

    // Neon light at gantry
    const gantryLight = new PointLight('gantryLight', new Vector3(start.x, 7, start.z), scene);
    gantryLight.diffuse = NEON_MAGENTA;
    gantryLight.intensity = 8.0;
    gantryLight.range = 40;
    this.lights.push(gantryLight);
  }

  update(_elapsed: number): void {}

  dispose(): void {
    for (const l of this.lights) l.dispose();
    this.root.dispose(false, true);
  }
}
