/**
 * LEARNING NOTE: Optimized Procedural Environment (Babylon.js)
 *
 * Procedural box buildings with window textures (no GLB loading = fast).
 * All meshes frozen, materials frozen, thin instances for buildings.
 * Lightweight trees, distant mountains, dynamic sky.
 *
 * Key concepts: thin instances, frozen meshes, procedural textures, performance
 */

import {
  MeshBuilder,
  Mesh,
  PBRMaterial,
  TransformNode,
  Color3,
  Vector3,
  Matrix,
  DynamicTexture,
  Texture,
} from '@babylonjs/core';
import { SkyMaterial } from '@babylonjs/materials';
import type { Scene } from '@babylonjs/core';
import { TRACK, ENVIRONMENT } from '@neon-drift/shared';

interface CenterlinePoint { x: number; z: number; nx: number; nz: number; }
interface ColliderInfo {
  position: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
  rotationY: number;
}

export class TrackEnvironment {
  readonly root: TransformNode;
  private colliderData: ColliderInfo[] = [];
  private centerline: readonly CenterlinePoint[] = [];
  private skyMat: SkyMaterial | null = null;
  private scene: Scene;

  constructor(scene: Scene, centerline: readonly CenterlinePoint[]) {
    this.root = new TransformNode('environment', scene);
    this.centerline = centerline;
    this.scene = scene;
    this.buildSky(scene);
    this.buildCityBuildings(scene);
    this.buildTrees(scene);
    this.buildMountains(scene);
  }

  getColliderData(): readonly ColliderInfo[] { return this.colliderData; }

  private rand(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  private isSafeFromTrack(px: number, pz: number, minDist: number = 30): boolean {
    for (let j = 0; j < this.centerline.length; j += 5) {
      const cp = this.centerline[j]!;
      const d = Math.sqrt((px - cp.x) ** 2 + (pz - cp.z) ** 2);
      if (d < TRACK.ROAD_WIDTH / 2 + minDist) return false;
    }
    return true;
  }

  private clouds: Mesh[] = [];

  private buildSky(scene: Scene): void {
    // Fixed sunny daytime sky — no day/night cycle
    const skybox = MeshBuilder.CreateBox('sky', { size: 2000 }, scene);
    this.skyMat = new SkyMaterial('skyMat', scene);
    this.skyMat.backFaceCulling = false;
    this.skyMat.turbidity = 4;        // clear sky
    this.skyMat.luminance = 1.1;      // bright
    this.skyMat.inclination = 0.35;   // sun fairly high
    this.skyMat.azimuth = 0.25;
    this.skyMat.rayleigh = 2.0;       // strong blue
    this.skyMat.mieDirectionalG = 0.85;
    this.skyMat.mieCoefficient = 0.003; // subtle sun glow
    skybox.material = this.skyMat;
    skybox.infiniteDistance = true;
    skybox.isPickable = false;
    skybox.parent = this.root;

    // === CLOUDS — flat planes with procedural cloud textures ===
    this.buildClouds(scene);
  }

  private buildClouds(scene: Scene): void {
    // Generate several unique cloud textures for variety
    const cloudTextures = [
      this.genRealisticCloud(scene, 0),
      this.genRealisticCloud(scene, 1000),
      this.genRealisticCloud(scene, 2000),
    ];

    // Place 15 clouds at various heights
    for (let i = 0; i < 15; i++) {
      const tex = cloudTextures[i % cloudTextures.length]!;

      const mat = new PBRMaterial(`cloudMat${i}`, scene);
      mat.albedoColor = new Color3(1, 1, 1);
      mat.emissiveColor = new Color3(0.97, 0.97, 1.0);
      mat.emissiveIntensity = 0.25;
      mat.metallic = 0;
      mat.roughness = 1;
      mat.alpha = 0.55 + this.rand(i + 5500) * 0.25; // varied opacity
      mat.backFaceCulling = false;
      mat.disableLighting = true;
      mat.albedoTexture = tex;
      mat.opacityTexture = tex;

      const w = 120 + this.rand(i + 5000) * 250;
      const d = 60 + this.rand(i + 5100) * 150;
      const cloud = MeshBuilder.CreatePlane(`cloud${i}`, { width: w, height: d }, scene);
      cloud.material = mat;
      cloud.rotation.x = Math.PI / 2;
      cloud.position.set(
        (this.rand(i + 5200) - 0.5) * 900,
        100 + this.rand(i + 5300) * 80,
        (this.rand(i + 5400) - 0.5) * 900,
      );
      cloud.isPickable = false;
      cloud.parent = this.root;
      this.clouds.push(cloud);
    }
  }

  /** Generate a realistic cloud texture using layered noise blobs */
  private genRealisticCloud(scene: Scene, seedOffset: number): DynamicTexture {
    const s = 512;
    const tex = new DynamicTexture(`cloud${seedOffset}`, { width: s, height: s }, scene, true);
    const ctx = tex.getContext();

    ctx.clearRect(0, 0, s, s);

    // Layer 1: Large base cloud blobs
    for (let i = 0; i < 15; i++) {
      const cx = s * 0.15 + this.rand(i + seedOffset + 100) * s * 0.7;
      const cy = s * 0.15 + this.rand(i + seedOffset + 200) * s * 0.7;
      const r = 40 + this.rand(i + seedOffset + 300) * 80;
      const alpha = 0.3 + this.rand(i + seedOffset + 400) * 0.5;

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.3, `rgba(255,255,255,${alpha * 0.7})`);
      g.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.3})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }

    // Layer 2: Smaller detail puffs on top
    for (let i = 0; i < 25; i++) {
      const cx = s * 0.1 + this.rand(i + seedOffset + 500) * s * 0.8;
      const cy = s * 0.1 + this.rand(i + seedOffset + 600) * s * 0.8;
      const r = 15 + this.rand(i + seedOffset + 700) * 40;
      const alpha = 0.15 + this.rand(i + seedOffset + 800) * 0.35;

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.4})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }

    // Layer 3: Bright highlights in the center
    for (let i = 0; i < 5; i++) {
      const cx = s * 0.3 + this.rand(i + seedOffset + 900) * s * 0.4;
      const cy = s * 0.3 + this.rand(i + seedOffset + 950) * s * 0.4;
      const r = 20 + this.rand(i + seedOffset + 980) * 30;

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.6)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }

    tex.update();
    tex.hasAlpha = true;
    return tex;
  }

  /** Procedural box buildings with brick texture + window emissive overlay */
  private buildCityBuildings(scene: Scene): void {
    const count = ENVIRONMENT.BUILDING_COUNT;

    // Brick + window texture
    const brickTex = new Texture('/textures/brick_diff.jpg', scene);
    brickTex.wrapU = Texture.WRAP_ADDRESSMODE;
    brickTex.wrapV = Texture.WRAP_ADDRESSMODE;
    brickTex.uScale = 3;
    brickTex.vScale = 5;

    const windowTex = this.genWindowTexture(scene);

    const mat = new PBRMaterial('buildingMat', scene);
    mat.albedoTexture = brickTex;
    mat.albedoColor = new Color3(0.85, 0.82, 0.78);
    mat.metallic = 0.02;
    mat.roughness = 0.88;
    mat.emissiveTexture = windowTex;
    mat.emissiveColor = new Color3(0.95, 0.85, 0.7);
    mat.emissiveIntensity = 0.4;
    mat.environmentIntensity = 0.2;
    mat.freeze();

    const base = MeshBuilder.CreateBox('building', { size: 1 }, scene);
    base.material = mat;
    base.isPickable = false;
    base.parent = this.root;

    const matrices: Matrix[] = [];
    const colors: number[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 300 + this.rand(i) * 250;
      const bx = Math.cos(angle) * radius + (this.rand(i + 50) - 0.5) * 30;
      const bz = Math.sin(angle) * radius + (this.rand(i + 60) - 0.5) * 30;

      if (!this.isSafeFromTrack(bx, bz)) continue;

      const height = 60 + this.rand(i + 200) * 250;
      const width = 15 + this.rand(i + 300) * 30;
      const depth = 15 + this.rand(i + 400) * 30;
      const rotY = this.rand(i + 500) * Math.PI;

      matrices.push(Matrix.Compose(
        new Vector3(width, height, depth),
        new Vector3(0, rotY, 0).toQuaternion(),
        new Vector3(bx, height / 2, bz),
      ));
      const r = 0.5 + this.rand(i + 600) * 0.3;
      const g = 0.48 + this.rand(i + 700) * 0.25;
      const b = 0.45 + this.rand(i + 800) * 0.2;
      colors.push(r, g, b, 1);

      this.colliderData.push({
        position: { x: bx, y: height / 2, z: bz },
        halfExtents: { x: width / 2, y: height / 2, z: depth / 2 },
        rotationY: rotY,
      });
    }

    if (matrices.length > 0) {
      const buf = new Float32Array(matrices.length * 16);
      matrices.forEach((m, i) => m.copyToArray(buf, i * 16));
      base.thinInstanceSetBuffer('matrix', buf, 16);
      base.thinInstanceSetBuffer('color', new Float32Array(colors), 4);
    }
    base.freezeWorldMatrix();
  }

  private genWindowTexture(scene: Scene): DynamicTexture {
    const s = 256;
    const tex = new DynamicTexture('win', { width: s, height: s }, scene, true);
    const ctx = tex.getContext();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, s, s);
    let seed = 0;
    for (let y = 4; y < s - 4; y += 12) {
      for (let x = 4; x < s - 4; x += 10) {
        seed++;
        if (this.rand(seed) > 0.35) {
          const b = 180 + Math.floor(this.rand(seed + 1000) * 75);
          const w = Math.floor(this.rand(seed + 2000) * 40);
          ctx.fillStyle = `rgb(${b},${b - w},${b - w * 2})`;
          ctx.fillRect(x, y, 3, 4);
        }
      }
    }
    tex.update();
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    return tex;
  }

  private buildTrees(scene: Scene): void {
    const trunkMat = new PBRMaterial('trunkMat', scene);
    trunkMat.albedoColor = new Color3(0.35, 0.22, 0.11);
    trunkMat.metallic = 0; trunkMat.roughness = 0.95;
    trunkMat.freeze();

    const leafMat = new PBRMaterial('leafMat', scene);
    leafMat.albedoColor = new Color3(0.2, 0.45, 0.18);
    leafMat.metallic = 0; leafMat.roughness = 0.88;
    leafMat.freeze();

    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2 + this.rand(i + 1000) * 0.3;
      const radius = 150 + this.rand(i + 1100) * 100;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;

      if (!this.isSafeFromTrack(tx, tz, 20)) continue;

      const s = 1.5 + this.rand(i + 1200) * 2;

      const trunk = MeshBuilder.CreateCylinder(`t${i}`, {
        diameterTop: 0.3 * s, diameterBottom: 0.4 * s, height: 3 * s, tessellation: 4,
      }, scene);
      trunk.material = trunkMat;
      trunk.position.set(tx, 1.5 * s, tz);
      trunk.isPickable = false;
      trunk.freezeWorldMatrix();
      trunk.parent = this.root;

      const leaf = MeshBuilder.CreateSphere(`l${i}`, { diameter: 4 * s, segments: 4 }, scene);
      leaf.material = leafMat;
      leaf.position.set(tx, 4.5 * s, tz);
      leaf.isPickable = false;
      leaf.freezeWorldMatrix();
      leaf.parent = this.root;

      this.colliderData.push({
        position: { x: tx, y: 1.5 * s, z: tz },
        halfExtents: { x: 0.3 * s, y: 1.5 * s, z: 0.3 * s },
        rotationY: 0,
      });
    }
  }

  private buildMountains(scene: Scene): void {
    const configs = [
      { x: -400, z: 600, h: 150, r: 120, c: [0.38, 0.32, 0.44] },
      { x: -200, z: 650, h: 200, r: 140, c: [0.44, 0.38, 0.50] },
      { x: 200, z: 680, h: 180, r: 130, c: [0.50, 0.38, 0.30] },
    ];

    for (const m of configs) {
      const mt = MeshBuilder.CreateCylinder('mt', {
        diameterTop: 0, diameterBottom: m.r * 2, height: m.h, tessellation: 4,
      }, scene);
      const mat = new PBRMaterial('mtMat', scene);
      mat.albedoColor = new Color3(m.c[0]!, m.c[1]!, m.c[2]!);
      mat.metallic = 0; mat.roughness = 0.95;
      mat.freeze();
      mt.material = mat;
      mt.position.set(m.x, m.h / 2, m.z);
      mt.isPickable = false;
      mt.freezeWorldMatrix();
      mt.parent = this.root;
    }
  }

  /** Move clouds slowly across the sky */
  update(elapsed: number): void {
    const windSpeed = 5; // m/s
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i]!;
      cloud.position.x += windSpeed * (1 / 60) * (0.8 + this.rand(i + 7000) * 0.4);
      cloud.position.z += windSpeed * (1 / 60) * 0.3;

      // Wrap around when too far
      if (cloud.position.x > 500) cloud.position.x = -500;
      if (cloud.position.z > 500) cloud.position.z = -500;
    }
  }

  dispose(): void { this.root.dispose(false, true); }
}
