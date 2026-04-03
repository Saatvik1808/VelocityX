/**
 * LEARNING NOTE: Production Track Lighting (Babylon.js)
 *
 * Streetlights with PBR poles, frozen base meshes, thin instances.
 * Start gantry and finish line for track identity.
 *
 * Key concepts: PBRMaterial, PointLight, thin instances, freeze
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
import { TRACK, TRACK_COLORS } from '@neon-drift/shared';

interface CenterlinePoint { x: number; z: number; nx: number; nz: number; }

export class TrackLighting {
  readonly root: TransformNode;
  private lights: PointLight[] = [];

  constructor(scene: Scene, centerline: readonly CenterlinePoint[]) {
    this.root = new TransformNode('trackLighting', scene);
    this.buildStreetlights(scene, centerline);
    this.buildStartFinishLine(scene, centerline);
    this.buildStartGantry(scene, centerline);
  }

  private buildStreetlights(scene: Scene, centerline: readonly CenterlinePoint[]): void {
    const hw = TRACK.ROAD_WIDTH / 2;
    const lightCount = 6; // Fewer lights = better FPS
    const total = centerline.length;
    const interval = Math.floor(total / lightCount);

    const poleMat = new PBRMaterial('poleMat', scene);
    poleMat.albedoColor = new Color3(0.3, 0.3, 0.3);
    poleMat.metallic = 0.5; poleMat.roughness = 0.5;
    poleMat.freeze();

    const fixtureMat = new PBRMaterial('fixMat', scene);
    fixtureMat.albedoColor = new Color3(0.85, 0.85, 0.8);
    fixtureMat.emissiveColor = Color3.FromHexString('#FFD699');
    fixtureMat.emissiveIntensity = 0.5;
    fixtureMat.freeze();

    const pole = MeshBuilder.CreateCylinder('pole', {
      diameterTop: 0.14, diameterBottom: 0.2, height: 6, tessellation: 5,
    }, scene);
    pole.material = poleMat;
    pole.isPickable = false;
    pole.parent = this.root;

    const fixture = MeshBuilder.CreateBox('fixture', { width: 0.5, height: 0.15, depth: 0.3 }, scene);
    fixture.material = fixtureMat;
    fixture.isPickable = false;
    fixture.parent = this.root;

    const poleM: Matrix[] = [];
    const fixM: Matrix[] = [];

    for (let i = 0; i < lightCount; i++) {
      const idx = (i * interval) % total;
      const pt = centerline[idx]!;
      const side = i % 2 === 0 ? -1 : 1;
      const px = pt.x + pt.nx * (hw + 20) * side;
      const pz = pt.z + pt.nz * (hw + 20) * side;

      poleM.push(Matrix.Translation(px, 3, pz));
      fixM.push(Matrix.Translation(px, 6.1, pz));

      const light = new PointLight(`sl${i}`, new Vector3(px, 6, pz), scene);
      light.diffuse = Color3.FromHexString('#FFD699');
      light.intensity = TRACK_COLORS.STREETLIGHT_INTENSITY;
      light.range = TRACK_COLORS.STREETLIGHT_DISTANCE;
      this.lights.push(light);
    }

    this.applyThin(pole, poleM);
    this.applyThin(fixture, fixM);
    pole.freezeWorldMatrix();
    fixture.freezeWorldMatrix();
  }

  private applyThin(mesh: any, matrices: Matrix[]): void {
    if (!matrices.length) return;
    const buf = new Float32Array(matrices.length * 16);
    matrices.forEach((m, i) => m.copyToArray(buf, i * 16));
    mesh.thinInstanceSetBuffer('matrix', buf, 16);
  }

  private buildStartFinishLine(scene: Scene, centerline: readonly CenterlinePoint[]): void {
    const start = centerline[0];
    if (!start) return;
    const line = MeshBuilder.CreateBox('startLine', { width: TRACK.ROAD_WIDTH, height: 0.02, depth: 1 }, scene);
    const mat = new PBRMaterial('slMat', scene);
    mat.albedoColor = new Color3(0.93, 0.93, 0.93);
    mat.emissiveColor = new Color3(0.1, 0.45, 0.15);
    mat.emissiveIntensity = 0.6;
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
    gMat.albedoColor = new Color3(0.25, 0.25, 0.25);
    gMat.metallic = 0.4; gMat.roughness = 0.6;
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
  }

  update(_elapsed: number): void {}

  dispose(): void {
    for (const l of this.lights) l.dispose();
    this.root.dispose(false, true);
  }
}
