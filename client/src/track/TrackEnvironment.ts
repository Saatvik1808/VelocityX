/**
 * LEARNING NOTE: Neon Cyberpunk Environment (Babylon.js)
 *
 * Dark cityscape with glowing neon windows, no trees or clouds.
 * Buildings are dark monoliths with colorful emissive windows in
 * cyan, magenta, and amber. Dark mountains frame the horizon.
 * Starfield sky replaces the daytime SkyMaterial.
 *
 * Key concepts: dark aesthetic, emissive materials, procedural neon textures
 */

import {
  MeshBuilder,
  Mesh,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  Color3,
  Color4,
  Vector3,
  Matrix,
  DynamicTexture,
  Texture,
  ParticleSystem,
} from '@babylonjs/core';
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
  private scene: Scene;

  constructor(scene: Scene, centerline: readonly CenterlinePoint[]) {
    this.root = new TransformNode('environment', scene);
    this.centerline = centerline;
    this.scene = scene;
    this.buildSky(scene);
    this.buildCityBuildings(scene);
    this.buildInnerCityBlocks(scene);
    this.buildStreetLamps(scene);
    this.buildGroundNeonStrips(scene);
    this.buildMountains(scene);
    this.buildNeonSigns(scene);
    this.buildGroundHaze(scene);
  }

  getColliderData(): readonly ColliderInfo[] { return this.colliderData; }

  private rand(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  private isSafeFromTrack(px: number, pz: number, minDist: number = 30): boolean {
    // Check minimum distance from track centerline
    for (let j = 0; j < this.centerline.length; j += 5) {
      const cp = this.centerline[j]!;
      const d = Math.sqrt((px - cp.x) ** 2 + (pz - cp.z) ** 2);
      if (d < TRACK.ROAD_WIDTH / 2 + minDist) return false;
    }
    // Reject points inside the track loop (ray-casting point-in-polygon)
    if (this.isInsideTrackLoop(px, pz)) return false;
    return true;
  }

  /** Ray-casting algorithm: cast a ray in +X and count centerline edge crossings.
   *  Odd crossings = inside the polygon, even = outside. */
  private isInsideTrackLoop(px: number, pz: number): boolean {
    const pts = this.centerline;
    const step = Math.max(1, Math.floor(pts.length / 100)); // sample ~100 edges
    let inside = false;
    let j = pts.length - step;
    for (let i = 0; i < pts.length; i += step) {
      const xi = pts[i]!.x, zi = pts[i]!.z;
      const xj = pts[j]!.x, zj = pts[j]!.z;
      if ((zi > pz) !== (zj > pz) &&
          px < (xj - xi) * (pz - zi) / (zj - zi) + xi) {
        inside = !inside;
      }
      j = i;
    }
    return inside;
  }

  private buildSky(scene: Scene): void {
    // Dark skybox — solid near-black
    const skybox = MeshBuilder.CreateBox('sky', { size: 2000 }, scene);
    const skyMat = new StandardMaterial('skyMat', scene);
    skyMat.diffuseColor = new Color3(0.01, 0.005, 0.03);
    skyMat.emissiveColor = new Color3(0.01, 0.005, 0.03);
    skyMat.specularColor = Color3.Black();
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    skybox.material = skyMat;
    skybox.infiniteDistance = true;
    skybox.isPickable = false;
    skybox.parent = this.root;

    // Stars — tiny bright particles scattered on the sky dome
    this.buildStars(scene);
  }

  private buildStars(scene: Scene): void {
    const starSystem = new ParticleSystem('stars', 500, scene);
    starSystem.particleTexture = this.createStarTexture(scene);
    starSystem.emitter = new Vector3(0, 200, 0);
    starSystem.minEmitBox = new Vector3(-800, 0, -800);
    starSystem.maxEmitBox = new Vector3(800, 200, 800);
    starSystem.emitRate = 0;
    starSystem.manualEmitCount = 500;
    starSystem.minLifeTime = 999999;
    starSystem.maxLifeTime = 999999;
    starSystem.minEmitPower = 0;
    starSystem.maxEmitPower = 0;
    starSystem.gravity = Vector3.Zero();
    starSystem.addSizeGradient(0, 0.5, 1.5);
    starSystem.addColorGradient(0, new Color4(0.8, 0.85, 1.0, 0.6));
    starSystem.addColorGradient(1, new Color4(0.9, 0.9, 1.0, 0.4));
    starSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
    starSystem.start();
  }

  private createStarTexture(scene: Scene): Texture {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(200,210,255,0.5)');
    g.addColorStop(1, 'rgba(100,100,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new Texture('data:' + canvas.toDataURL(), scene, false, false);
  }

  /** Dark buildings with neon-colored emissive windows */
  private buildCityBuildings(scene: Scene): void {
    const count = ENVIRONMENT.BUILDING_COUNT;

    // Neon window texture — colored lights on dark facade
    const windowTex = this.genNeonWindowTexture(scene);

    const mat = new PBRMaterial('buildingMat', scene);
    mat.albedoColor = new Color3(0.06, 0.06, 0.08); // slightly visible buildings
    mat.metallic = 0.3;
    mat.roughness = 0.7;
    mat.emissiveTexture = windowTex;
    mat.emissiveColor = new Color3(1.0, 1.0, 1.0);   // full emissive from texture
    mat.emissiveIntensity = 1.0;
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
      // Dark building tints — slight color variation
      const r = 0.03 + this.rand(i + 600) * 0.04;
      const g = 0.03 + this.rand(i + 700) * 0.04;
      const b = 0.05 + this.rand(i + 800) * 0.06;
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

  /** Generate neon-colored window texture — cyan, magenta, amber dots on black */
  private genNeonWindowTexture(scene: Scene): DynamicTexture {
    const s = 256;
    const tex = new DynamicTexture('neonWin', { width: s, height: s }, scene, true);
    const ctx = tex.getContext();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, s, s);

    // Neon color palette
    const neonColors = [
      '#00ffff', // cyan
      '#ff00ff', // magenta
      '#ff6600', // amber/orange
      '#00ff88', // neon green
      '#ff0066', // hot pink
      '#4400ff', // electric blue
      '#ffff00', // yellow
    ];

    let seed = 0;
    for (let y = 4; y < s - 4; y += 12) {
      for (let x = 4; x < s - 4; x += 10) {
        seed++;
        if (this.rand(seed) > 0.5) {  // 50% of windows lit — livelier city
          const color = neonColors[Math.floor(this.rand(seed + 1000) * neonColors.length)]!;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 3, 4);
        }
      }
    }
    tex.update();
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    return tex;
  }

  /** Smaller buildings closer to the track — fills the dark gap between road and skyline */
  private buildInnerCityBlocks(scene: Scene): void {
    const windowTex = this.genNeonWindowTexture(scene);

    const mat = new PBRMaterial('innerBldgMat', scene);
    mat.albedoColor = new Color3(0.05, 0.05, 0.07);
    mat.metallic = 0.4;
    mat.roughness = 0.6;
    mat.emissiveTexture = windowTex;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.emissiveIntensity = 1.2;
    mat.environmentIntensity = 0.25;
    mat.freeze();

    const base = MeshBuilder.CreateBox('innerBldg', { size: 1 }, scene);
    base.material = mat;
    base.isPickable = false;
    base.parent = this.root;

    const matrices: Matrix[] = [];
    const count = 80;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + this.rand(i + 3000) * 0.3;
      // Place between 50m and 200m from center — the dark gap
      const radius = 50 + this.rand(i + 3100) * 180;
      const bx = Math.cos(angle) * radius + (this.rand(i + 3200) - 0.5) * 20;
      const bz = Math.sin(angle) * radius + (this.rand(i + 3300) - 0.5) * 20;

      if (!this.isSafeFromTrack(bx, bz, 22)) continue;

      // Shorter buildings closer to the track
      const height = 8 + this.rand(i + 3400) * 45;
      const width = 6 + this.rand(i + 3500) * 12;
      const depth = 6 + this.rand(i + 3600) * 12;
      const rotY = this.rand(i + 3700) * Math.PI;

      matrices.push(Matrix.Compose(
        new Vector3(width, height, depth),
        new Vector3(0, rotY, 0).toQuaternion(),
        new Vector3(bx, height / 2, bz),
      ));

      // Register physics collider so cars can't pass through
      this.colliderData.push({
        position: { x: bx, y: height / 2, z: bz },
        halfExtents: { x: width / 2, y: height / 2, z: depth / 2 },
        rotationY: rotY,
      });
    }

    if (matrices.length > 0) {
      const buf = new Float32Array(matrices.length * 16);
      matrices.forEach((m, idx) => m.copyToArray(buf, idx * 16));
      base.thinInstanceSetBuffer('matrix', buf, 16);
      base.freezeWorldMatrix();
    }
  }

  /** Street lamps with warm amber glow scattered around the track.
   *  Uses emissive geometry + ground glow discs (no PointLights) — bloom creates the effect. */
  private buildStreetLamps(scene: Scene): void {
    const lampCount = 30;
    const warmColors = [
      new Color3(1.0, 0.7, 0.2),   // warm amber
      new Color3(1.0, 0.8, 0.3),   // golden yellow
      new Color3(0.9, 0.6, 0.15),  // deep amber
      new Color3(0, 0.9, 0.9),     // cyan accent
      new Color3(0.8, 0, 0.6),     // magenta accent
    ];

    // Pole material — dark metal
    const poleMat = new PBRMaterial('lampPoleMat', scene);
    poleMat.albedoColor = new Color3(0.06, 0.06, 0.06);
    poleMat.metallic = 0.7;
    poleMat.roughness = 0.3;
    poleMat.freeze();

    // Shared materials per color (5 head + 5 glow = 10 materials total, not 60)
    const headMats: PBRMaterial[] = [];
    const glowMats: PBRMaterial[] = [];
    for (let c = 0; c < warmColors.length; c++) {
      const hm = new PBRMaterial(`lampHeadMat${c}`, scene);
      hm.albedoColor = new Color3(0.02, 0.02, 0.02);
      hm.emissiveColor = warmColors[c]!;
      hm.emissiveIntensity = 3.0;
      hm.freeze();
      headMats.push(hm);

      const gm = new PBRMaterial(`lampGlowMat${c}`, scene);
      gm.albedoColor = new Color3(0.01, 0.01, 0.01);
      gm.emissiveColor = warmColors[c]!;
      gm.emissiveIntensity = 0.6;
      gm.alpha = 0.4;
      gm.backFaceCulling = false;
      gm.freeze();
      glowMats.push(gm);
    }

    const pole = MeshBuilder.CreateCylinder('lampPole', {
      diameterTop: 0.08, diameterBottom: 0.12, height: 5, tessellation: 5,
    }, scene);
    pole.material = poleMat;
    pole.isPickable = false;
    pole.parent = this.root;

    const poleMatrices: Matrix[] = [];

    for (let i = 0; i < lampCount; i++) {
      const angle = (i / lampCount) * Math.PI * 2 + this.rand(i + 4000) * 0.2;
      const radius = 25 + this.rand(i + 4100) * 95;
      const lx = Math.cos(angle) * radius;
      const lz = Math.sin(angle) * radius;

      if (!this.isSafeFromTrack(lx, lz, 18)) continue;

      poleMatrices.push(Matrix.Translation(lx, 2.5, lz));

      // Register pole collider so cars can't pass through
      this.colliderData.push({
        position: { x: lx, y: 2.5, z: lz },
        halfExtents: { x: 0.15, y: 2.5, z: 0.15 },
        rotationY: 0,
      });

      const colorIdx = i % 5 < 3 ? i % 3 : (3 + i % 2);

      // Glowing lamp head
      const head = MeshBuilder.CreateBox(`lampH${i}`, { width: 0.35, height: 0.15, depth: 0.35 }, scene);
      head.material = headMats[colorIdx]!;
      head.position.set(lx, 5.1, lz);
      head.isPickable = false;
      head.freezeWorldMatrix();
      head.parent = this.root;

      // Emissive ground glow disc — fakes the light pool
      const disc = MeshBuilder.CreateDisc(`lampDisc${i}`, { radius: 4, tessellation: 8 }, scene);
      disc.material = glowMats[colorIdx]!;
      disc.rotation.x = Math.PI / 2;
      disc.position.set(lx, -0.12, lz);
      disc.isPickable = false;
      disc.freezeWorldMatrix();
      disc.parent = this.root;
    }

    if (poleMatrices.length > 0) {
      const buf = new Float32Array(poleMatrices.length * 16);
      poleMatrices.forEach((m, idx) => m.copyToArray(buf, idx * 16));
      pole.thinInstanceSetBuffer('matrix', buf, 16);
      pole.freezeWorldMatrix();
    }
  }

  /** Neon ground strips — glowing lines on the ground like sidewalk lighting */
  private buildGroundNeonStrips(scene: Scene): void {
    const neonColors = [
      new Color3(0, 0.8, 0.8),     // cyan
      new Color3(0.8, 0, 0.6),     // magenta
      new Color3(0.8, 0.4, 0),     // amber
    ];

    const stripMat = new PBRMaterial('groundStripMat', scene);
    stripMat.albedoColor = new Color3(0.02, 0.02, 0.02);
    stripMat.emissiveColor = new Color3(0, 0.7, 0.7);
    stripMat.emissiveIntensity = 0.8;
    stripMat.metallic = 0.5;
    stripMat.roughness = 0.2;
    stripMat.freeze();

    const stripBase = MeshBuilder.CreateBox('gStrip', { width: 1, height: 0.02, depth: 0.1 }, scene);
    stripBase.material = stripMat;
    stripBase.isPickable = false;
    stripBase.parent = this.root;

    const matrices: Matrix[] = [];
    const colors: number[] = [];
    const stripCount = 60;

    for (let i = 0; i < stripCount; i++) {
      const angle = (i / stripCount) * Math.PI * 2 + this.rand(i + 5000) * 0.3;
      const radius = 30 + this.rand(i + 5100) * 100;
      const sx = Math.cos(angle) * radius;
      const sz = Math.sin(angle) * radius;

      if (!this.isSafeFromTrack(sx, sz, 16)) continue;

      const len = 4 + this.rand(i + 5200) * 12;
      const rotY = angle + (this.rand(i + 5300) - 0.5) * 1.0;

      matrices.push(Matrix.Compose(
        new Vector3(len, 1, 1),
        new Vector3(0, rotY, 0).toQuaternion(),
        new Vector3(sx, -0.13, sz),
      ));

      const c = neonColors[i % 3]!;
      colors.push(c.r, c.g, c.b, 1);
    }

    if (matrices.length > 0) {
      const buf = new Float32Array(matrices.length * 16);
      matrices.forEach((m, idx) => m.copyToArray(buf, idx * 16));
      stripBase.thinInstanceSetBuffer('matrix', buf, 16);
      stripBase.thinInstanceSetBuffer('color', new Float32Array(colors), 4);
      stripBase.freezeWorldMatrix();
    }
  }

  private buildMountains(scene: Scene): void {
    // Dark silhouette mountains
    const configs = [
      { x: -400, z: 600, h: 150, r: 120, c: [0.02, 0.01, 0.04] },
      { x: -200, z: 650, h: 200, r: 140, c: [0.03, 0.02, 0.05] },
      { x: 200, z: 680, h: 180, r: 130, c: [0.02, 0.02, 0.04] },
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

  /** Bright neon sign planes on building facades */
  private buildNeonSigns(scene: Scene): void {
    const neonColors = [
      new Color3(0, 1, 1),     // cyan
      new Color3(1, 0, 1),     // magenta
      new Color3(1, 0.5, 0),   // amber
      new Color3(0, 1, 0.5),   // green
      new Color3(1, 0, 0.4),   // pink
    ];

    const signCount = 20;
    for (let i = 0; i < signCount && i < this.colliderData.length; i++) {
      const bldg = this.colliderData[Math.floor(this.rand(i + 9000) * this.colliderData.length)]!;
      const color = neonColors[i % neonColors.length]!;

      const w = 3 + this.rand(i + 7000) * 4;
      const h = 0.8 + this.rand(i + 7100) * 1.5;
      const sign = MeshBuilder.CreatePlane(`neonSign${i}`, { width: w, height: h }, scene);

      const signMat = new PBRMaterial(`signMat${i}`, scene);
      signMat.albedoColor = new Color3(0.02, 0.02, 0.02);
      signMat.emissiveColor = color;
      signMat.emissiveIntensity = 2.5;
      signMat.backFaceCulling = false;
      signMat.freeze();
      sign.material = signMat;

      const signY = 15 + this.rand(i + 7200) * 40;
      const faceAngle = bldg.rotationY + (this.rand(i + 7300) > 0.5 ? 0 : Math.PI / 2);
      const offset = bldg.halfExtents.x + 0.1;
      sign.position.set(
        bldg.position.x + Math.sin(faceAngle) * offset,
        signY,
        bldg.position.z + Math.cos(faceAngle) * offset,
      );
      sign.rotation.y = faceAngle;
      sign.isPickable = false;
      sign.freezeWorldMatrix();
      sign.parent = this.root;
    }
  }

  /** Low-lying atmospheric ground haze — faint purple additive particles */
  private buildGroundHaze(scene: Scene): void {
    const haze = new ParticleSystem('groundHaze', 200, scene);

    // Reuse a soft radial gradient texture
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    haze.particleTexture = new Texture('data:' + canvas.toDataURL(), scene, false, false);

    haze.emitter = new Vector3(0, 1, 0);
    haze.minEmitBox = new Vector3(-300, 0, -300);
    haze.maxEmitBox = new Vector3(300, 3, 300);
    haze.emitRate = 0;
    haze.manualEmitCount = 200;
    haze.minLifeTime = 999999;
    haze.maxLifeTime = 999999;
    haze.minEmitPower = 0;
    haze.maxEmitPower = 0;
    haze.gravity = Vector3.Zero();

    haze.addSizeGradient(0, 8, 20);
    haze.addSizeGradient(1, 15, 30);

    // Very faint purple tint
    haze.addColorGradient(0, new Color4(0.15, 0.05, 0.2, 0.035));
    haze.addColorGradient(1, new Color4(0.1, 0.03, 0.15, 0.025));

    haze.blendMode = ParticleSystem.BLENDMODE_ADD;
    haze.start();
  }

  update(_elapsed: number): void {
    // No cloud animation in neon theme
  }

  dispose(): void { this.root.dispose(false, true); }
}
