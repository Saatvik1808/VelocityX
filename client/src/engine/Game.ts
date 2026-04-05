/**
 * LEARNING NOTE: Game Orchestrator (Babylon.js)
 *
 * Wires all systems together: Babylon.js Engine + Scene, Rapier physics,
 * vehicle, track, camera, particles, HUD. The game loop runs physics at
 * 60Hz fixed timestep and rendering at monitor refresh rate.
 *
 * Key concepts: system orchestration, initialization order, render loop
 */

import { Vector3, Quaternion } from '@babylonjs/core';
import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS, TRACK, VEHICLES, DEFAULT_VEHICLE_ID } from '@neon-drift/shared';

import { Renderer } from './Renderer.js';
import { SceneManager } from './SceneManager.js';
import { InputManager } from './InputManager.js';
import { GameLoop } from './GameLoop.js';
import { TrackBuilder } from '../track/TrackBuilder.js';
import { TrackColliders } from '../track/TrackColliders.js';
import { TrackLighting } from '../track/TrackLighting.js';
import { TrackEnvironment } from '../track/TrackEnvironment.js';
import { VehiclePhysics } from '../vehicles/VehiclePhysics.js';
import { VehicleVisuals } from '../vehicles/VehicleVisuals.js';
import { VehicleEffects } from '../vehicles/VehicleEffects.js';
import { ChaseCamera } from '../camera/ChaseCamera.js';
import { PostProcessingStack } from '../rendering/PostProcessingStack.js';
import { TireSmokeEmitter } from '../particles/TireSmokeEmitter.js';
import { SparkEmitter } from '../particles/SparkEmitter.js';
import { SkidMarkRenderer } from '../track/SkidMarkRenderer.js';
import { TronTrailRenderer } from '../vehicles/TronTrailRenderer.js';
import { CheckpointSystem } from '../track/Checkpoints.js';
import { DriftSystem } from '../vehicles/DriftSystem.js';
import { NitroSystem } from '../vehicles/NitroSystem.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { EntityInterpolation } from '../network/EntityInterpolation.js';
import { RemoteVehicle } from '../network/RemoteVehicle.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { EngineSynth } from '../audio/EngineSynth.js';
import { TireAudio } from '../audio/TireAudio.js';
import { ImpactAudio } from '../audio/ImpactAudio.js';
import { BoostAudio } from '../audio/BoostAudio.js';
import { WindAudio } from '../audio/WindAudio.js';
import { CountdownAudio } from '../audio/CountdownAudio.js';
import { useGameStore } from '../ui/store.js';
import { saveToLeaderboard } from '../ui/Leaderboard.js';
import { TelemetryCollector } from '../ai/telemetry/TelemetryCollector.js';
import type { PlayerId, PlayerSnapshot } from '@neon-drift/shared';

export class Game {
  private renderer: Renderer | null = null;
  private sceneManager: SceneManager | null = null;
  private inputManager: InputManager | null = null;
  private gameLoop: GameLoop | null = null;
  private world: RAPIER.World | null = null;
  private trackBuilder: TrackBuilder | null = null;
  private trackColliders: TrackColliders | null = null;
  private trackLighting: TrackLighting | null = null;
  private trackEnvironment: TrackEnvironment | null = null;
  private vehiclePhysics: VehiclePhysics | null = null;
  private vehicleVisuals: VehicleVisuals | null = null;
  private vehicleEffects: VehicleEffects | null = null;
  private chaseCamera: ChaseCamera | null = null;
  private postProcessing: PostProcessingStack | null = null;
  private tireSmokeEmitter: TireSmokeEmitter | null = null;
  private sparkEmitter: SparkEmitter | null = null;
  private skidMarkRenderer: SkidMarkRenderer | null = null;
  private tronTrail: TronTrailRenderer | null = null;

  // Audio
  private audioEngine: AudioEngine | null = null;
  private engineSynth: EngineSynth | null = null;
  private tireAudio: TireAudio | null = null;
  private impactAudio: ImpactAudio | null = null;
  private boostAudio: BoostAudio | null = null;
  private windAudio: WindAudio | null = null;
  private countdownAudio: CountdownAudio | null = null;

  private elapsed = 0;
  private prevSpeed = 0;
  private inputSeq = 0;
  private readonly _forward = new Vector3();

  // Interpolation: store previous physics state for smooth rendering
  private prevState = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, rw: 1 };
  private currState = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, rw: 1 };

  // Gameplay
  private checkpointSystem: CheckpointSystem | null = null;
  private driftSystem: DriftSystem = new DriftSystem();
  private nitroSystem = new NitroSystem();
  private raceFinished = false;

  // AI Telemetry
  private telemetryCollector: TelemetryCollector | null = null;

  // Multiplayer
  private networkManager: NetworkManager | null = null;
  private entityInterpolation = new EntityInterpolation();
  private remoteVehicles = new Map<PlayerId, RemoteVehicle>();
  private scene: any = null;

  // Track centerline for respawning
  private centerline: readonly { x: number; z: number; nx: number; nz: number }[] = [];

  /** Out-of-bounds thresholds */
  private static readonly FALL_Y = -10;
  private static readonly MAX_TRACK_DIST = 300; // meters from nearest centerline point

  async init(container: HTMLElement): Promise<void> {
    // 1. Initialize Rapier WASM
    await RAPIER.init();

    // 2. Create Babylon.js Engine
    this.renderer = new Renderer(container);
    const engine = this.renderer.engine;

    // 3. Create Scene with lighting
    this.sceneManager = new SceneManager(engine);
    const scene = this.sceneManager.scene;

    // 4. Create physics world
    const gravity = new RAPIER.Vector3(
      PHYSICS.GRAVITY.x, PHYSICS.GRAVITY.y, PHYSICS.GRAVITY.z,
    );
    this.world = new RAPIER.World(gravity);

    // 5. Build track
    this.trackBuilder = new TrackBuilder(scene);

    // 5b. Store centerline for respawn system + checkpoint system
    const cl = this.trackBuilder.getCenterline();
    this.centerline = cl;
    const centerlineForCP = cl.map(p => ({ x: p.x, z: p.z, nx: p.nx, nz: p.nz }));
    this.checkpointSystem = new CheckpointSystem(centerlineForCP, 3);
    this.checkpointSystem.start(0);
    useGameStore.getState().setTotalCheckpoints(this.checkpointSystem.totalCheckpoints);

    this.checkpointSystem.onCheckpoint = (cp, lap) => {
      useGameStore.getState().setCurrentCheckpoint(cp);
      useGameStore.getState().setLap(lap);
      // Notify server
      const nm = (window as any).__networkManager;
      if (nm?.connected) {
        nm.socket?.emit('CLIENT_CHECKPOINT_HIT', { checkpointIndex: cp, lapNumber: lap });
      }
    };

    this.checkpointSystem.onFinish = (totalTime) => {
      this.finishRace(totalTime);
    };

    // 6. Build track colliders
    this.trackColliders = new TrackColliders(
      RAPIER, this.world, this.trackBuilder.getCenterline(),
    );

    // 7. Track lighting
    this.trackLighting = new TrackLighting(scene, this.trackBuilder.getCenterline());

    // 8. Track environment
    this.trackEnvironment = new TrackEnvironment(scene, this.trackBuilder.getCenterline());

    // 9. Environment colliders
    for (const c of this.trackEnvironment.getColliderData()) {
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(c.position.x, c.position.y, c.position.z)
        .setRotation({
          x: 0, y: Math.sin(c.rotationY / 2), z: 0, w: Math.cos(c.rotationY / 2),
        });
      const body = this.world.createRigidBody(bodyDesc);
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(c.halfExtents.x, c.halfExtents.y, c.halfExtents.z)
          .setFriction(0.5).setRestitution(0.3),
        body,
      );
    }

    // 10. Minimap SVG
    const centerline = this.trackBuilder.getCenterline();
    if (centerline.length > 0) {
      const svgParts = centerline.map((pt, i) =>
        `${i === 0 ? 'M' : 'L'} ${(pt.x * 0.3 + 70).toFixed(1)} ${(-pt.z * 0.3 + 55).toFixed(1)}`
      );
      svgParts.push('Z');
      useGameStore.getState().setTrackCenterlineSVG(svgParts.join(' '));
    }

    // 11. Vehicle physics
    // Unique spawn slot per player — use random index so no two players overlap
    // Deterministic spawn slot from player ID — each player gets a unique position
    const nm2 = (window as any).__networkManager;
    let playerIndex = 0;
    if (nm2?.playerId) {
      // Hash the player ID string to get a number
      let hash = 0;
      for (let i = 0; i < nm2.playerId.length; i++) {
        hash = ((hash << 5) - hash + nm2.playerId.charCodeAt(i)) | 0;
      }
      playerIndex = Math.abs(hash) % 8;
    } else {
      playerIndex = Math.floor(Math.random() * 8);
    }
    const startInfo = this.trackBuilder.getStartPosition(playerIndex);
    const selectedVehicle = useGameStore.getState().selectedVehicleId;
    this.vehiclePhysics = new VehiclePhysics(
      RAPIER, this.world, startInfo.position, startInfo.rotation, selectedVehicle,
    );

    // Set vehicle-specific drift charge rate
    const vehicleDef = VEHICLES[selectedVehicle] ?? VEHICLES[DEFAULT_VEHICLE_ID]!;
    this.driftSystem.driftMult = vehicleDef.driftMult;

    // 12. Vehicle visuals — colored by selected vehicle
    this.vehicleVisuals = new VehicleVisuals(scene, selectedVehicle);

    // 12b. Register car as shadow caster, ground as receiver
    this.vehicleVisuals.root.getChildMeshes().forEach((mesh) => {
      this.sceneManager!.addShadowCaster(mesh);
    });
    scene.meshes.forEach((mesh) => {
      if (mesh.name === 'ground' || mesh.name === 'road' || mesh.name === 'shoulder') {
        this.sceneManager!.enableShadowReceiver(mesh);
      }
    });

    // 13. Vehicle effects
    this.vehicleEffects = new VehicleEffects(scene, this.vehicleVisuals.root);
    this.vehicleEffects.setTailLightMaterials(this.vehicleVisuals.getTailLightMaterials());

    // 14. Camera
    this.chaseCamera = new ChaseCamera(scene);

    // 15. Post-processing — skip on mobile for performance
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (!isMobileDevice) {
      try {
        this.postProcessing = new PostProcessingStack(scene, this.chaseCamera.camera);
      } catch (e) {
        console.warn('Post-processing init failed:', e);
      }
    }

    // 16. Particles — skip on mobile for performance
    if (!isMobileDevice) {
      this.tireSmokeEmitter = new TireSmokeEmitter(scene);
      this.sparkEmitter = new SparkEmitter(scene);
    }

    // 17. Skid marks
    this.skidMarkRenderer = new SkidMarkRenderer(scene);

    // 17b. Tron light trail
    this.tronTrail = new TronTrailRenderer(scene);

    // 18. Input — disable Babylon.js keyboard interception
    scene.detachControl();
    this.inputManager = new InputManager();

    // 18b. Audio engine — procedural sound synthesis
    this.audioEngine = new AudioEngine();
    this.audioEngine.init();
    this.engineSynth = new EngineSynth(this.audioEngine);
    this.tireAudio = new TireAudio(this.audioEngine);
    this.impactAudio = new ImpactAudio(this.audioEngine);
    this.boostAudio = new BoostAudio(this.audioEngine);
    this.windAudio = new WindAudio(this.audioEngine);
    this.countdownAudio = new CountdownAudio(this.audioEngine);

    // 19. Game loop
    this.gameLoop = new GameLoop(this.onFixedUpdate, this.onRender);

    // 20. Set active camera and start
    scene.activeCamera = this.chaseCamera.camera;
    this.scene = scene;
    useGameStore.getState().setGamePhase('PLAYING');
    this.gameLoop.start();

    // Expose game instance for AI training panel to access track data
    (window as any).__gameInstance = this;

    // 20b. Telemetry collector for AI systems
    this.telemetryCollector = new TelemetryCollector();
    this.telemetryCollector.startSession(selectedVehicle);

    // 21. Setup multiplayer hooks
    this.setupNetworking(scene);
  }

  /** Connect networking callbacks for multiplayer */
  private setupNetworking(scene: any): void {
    // Find the NetworkManager from the window (set by App.tsx)
    // We'll use a simple global reference
    this.networkManager = (window as any).__networkManager ?? null;

    if (!this.networkManager) return;

    // When server sends state updates, update remote vehicles
    this.networkManager.onStateUpdate = (tick: number, players: PlayerSnapshot[]) => {
      const myId = this.networkManager?.playerId;
      const now = performance.now();

      for (const snapshot of players) {
        if (snapshot.id === myId) continue; // skip self

        // Feed snapshot to interpolation buffer
        this.entityInterpolation.addSnapshot(snapshot.id, snapshot, now);

        // Create remote vehicle if new player
        if (!this.remoteVehicles.has(snapshot.id)) {
          const rv = new RemoteVehicle(scene, snapshot.id, RAPIER, this.world!);
          this.remoteVehicles.set(snapshot.id, rv);
        }
      }
    };

    // When player leaves, remove their car
    this.networkManager.onPlayerLeft = (playerId: PlayerId) => {
      const rv = this.remoteVehicles.get(playerId);
      if (rv) {
        rv.dispose();
        this.remoteVehicles.delete(playerId);
      }
      this.entityInterpolation.removePlayer(playerId);
    };

    // Server sends full race results when all players finish
    this.networkManager.onRaceStart = () => {
      this.checkpointSystem?.start(this.elapsed);
      useGameStore.getState().setGamePhase('RACING');
    };

    this.networkManager.onCountdown = (seconds: number) => {
      useGameStore.getState().setCountdownSeconds(seconds);
      if (seconds > 0) {
        this.countdownAudio?.beepCount();
      } else {
        this.countdownAudio?.beepGo();
      }
    };
  }

  /** Immediately stop the car and show results */
  private finishRace(totalTime: number): void {
    this.raceFinished = true;
    this.countdownAudio?.playFinish();

    // Freeze the car IMMEDIATELY
    if (this.vehiclePhysics) {
      const chassis = this.vehiclePhysics.getChassisBody();
      chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
      chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
      chassis.setBodyType(0, true); // 0 = Fixed — car becomes immovable
    }

    // Save to leaderboard
    const store = useGameStore.getState();
    const myName = (window as any).__networkManager?.playerId?.slice(0, 6) ?? 'You';
    saveToLeaderboard({
      name: myName,
      vehicleId: store.selectedVehicleId,
      laps: 3,
      time: totalTime,
      date: new Date().toISOString(),
    });

    // Show results IMMEDIATELY
    store.setRaceResults([{
      id: ((window as any).__networkManager?.playerId ?? 'local') as any,
      name: myName,
      time: totalTime,
      position: 1,
    }]);
    store.setGamePhase('RESULTS');

    // Save telemetry for AI systems (player skill profiling + physics evolution)
    if (this.telemetryCollector?.recording) {
      const session = this.telemetryCollector.endSession();
      if (session) {
        TelemetryCollector.saveSession(session);
      }
    }

    // Notify server (include vehicleId for leaderboard)
    const nm = (window as any).__networkManager;
    if (nm?.connected) {
      nm.socket?.emit('CLIENT_FINISHED', { time: totalTime, vehicleId: store.selectedVehicleId });
    }
  }

  /**
   * Find the closest centerline point index to a world position.
   * Used for respawning the car back onto the track.
   */
  private findNearestCenterlineIndex(px: number, pz: number): number {
    let minDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < this.centerline.length; i++) {
      const pt = this.centerline[i]!;
      const dx = px - pt.x;
      const dz = pz - pt.z;
      const d = dx * dx + dz * dz; // squared distance is fine for comparison
      if (d < minDist) {
        minDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  /**
   * Teleport the car back onto the track at the nearest centerline point.
   * Zeros velocity/rotation so the player can start clean.
   */
  private respawnToTrack(): void {
    if (!this.vehiclePhysics || this.centerline.length < 2) return;

    const state = this.vehiclePhysics.getState();
    const idx = this.findNearestCenterlineIndex(state.position.x, state.position.z);
    const pt = this.centerline[idx]!;

    // Get forward direction from consecutive centerline points
    const nextIdx = (idx + 1) % this.centerline.length;
    const next = this.centerline[nextIdx]!;
    const dx = next.x - pt.x;
    const dz = next.z - pt.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const fwdX = dx / len;
    const fwdZ = dz / len;
    const rotY = Math.atan2(fwdX, fwdZ);

    // Reset physics body: position, rotation, and all velocities
    const chassis = this.vehiclePhysics.getChassisBody();
    chassis.setTranslation({ x: pt.x, y: 1.0, z: pt.z }, true);
    chassis.setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) }, true);
    chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
    chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);

    // Reset interpolation states so camera doesn't lerp from old position
    this.prevState = {
      px: pt.x, py: 1.0, pz: pt.z,
      rx: 0, ry: Math.sin(rotY / 2), rz: 0, rw: Math.cos(rotY / 2),
    };
    this.currState = { ...this.prevState };
  }

  /**
   * Check if the car is out of bounds and needs automatic respawn.
   * Triggers on: falling below Y=-10, or being too far from any track point.
   */
  private checkOutOfBounds(): boolean {
    if (!this.vehiclePhysics) return false;
    const state = this.vehiclePhysics.getState();

    // Fell off the world
    if (state.position.y < Game.FALL_Y) return true;

    // Too far from track — find nearest centerline point distance
    const idx = this.findNearestCenterlineIndex(state.position.x, state.position.z);
    const pt = this.centerline[idx]!;
    const dx = state.position.x - pt.x;
    const dz = state.position.z - pt.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > Game.MAX_TRACK_DIST) return true;

    return false;
  }

  private onFixedUpdate = (dt: number): void => {
    if (!this.inputManager || !this.vehiclePhysics || !this.world) return;

    // Race finished — no more physics
    if (this.raceFinished) return;

    // Out-of-bounds auto-respawn (fell off world or too far from track)
    if (this.checkOutOfBounds()) {
      this.respawnToTrack();
      return; // skip this physics frame, let next frame pick up clean
    }

    // Manual reset: R key
    if (this.inputManager.consumeReset()) {
      this.respawnToTrack();
      return;
    }

    // Save previous state for interpolation
    this.prevState = { ...this.currState };

    const input = this.inputManager.getInputState();
    this.vehiclePhysics.applyInput(input, dt);
    this.vehiclePhysics.update(dt);
    this.world.step();

    // Save current state after step
    const s = this.vehiclePhysics.getState();
    this.currState = {
      px: s.position.x, py: s.position.y, pz: s.position.z,
      rx: s.rotation.x, ry: s.rotation.y, rz: s.rotation.z, rw: s.rotation.w,
    };

    // Send input + position to server for broadcasting to other players
    if (this.networkManager?.connected) {
      this.inputSeq++;
      (this.networkManager as any).socket?.emit('CLIENT_INPUT', {
        seq: this.inputSeq,
        input,
        pos: {
          x: s.position.x, y: s.position.y, z: s.position.z,
          rx: s.rotation.x, ry: s.rotation.y, rz: s.rotation.z, rw: s.rotation.w,
          speed: s.speed, steering: 0,
        },
      });
    }

    // Record telemetry for AI systems (sampled internally at 20Hz)
    if (this.telemetryCollector?.recording) {
      const store = useGameStore.getState();
      this.telemetryCollector.recordFrame({
        raceTime: store.raceTime,
        speed: s.speed,
        posX: s.position.x,
        posZ: s.position.z,
        isDrifting: store.isDrifting,
        driftChargeLevel: store.boostLevel,
        isNitroActive: store.nitroActive,
        nitroTank: store.nitroTank,
        checkpointIndex: store.currentCheckpoint ?? 0,
        lap: store.lap,
        input,
      });
    }
  };

  private onRender = (alpha: number): void => {
    if (!this.sceneManager || !this.vehiclePhysics || !this.vehicleVisuals ||
        !this.chaseCamera || !this.inputManager) return;

    // Race finished — only render scene, skip all gameplay
    if (this.raceFinished) {
      this.trackEnvironment?.update(this.elapsed);
      this.sceneManager.scene.render();
      return;
    }

    const dt = 1 / 60;
    this.elapsed += dt;

    const input = this.inputManager.getInputState();
    const state = this.vehiclePhysics.getState();

    // Collision detection — only on BIG impacts
    const speedDelta = Math.abs(state.speed - this.prevSpeed);
    if (speedDelta > 12 && Math.abs(state.speed) > 3) {
      this.chaseCamera.shake(speedDelta * 0.01);
    }
    this.prevSpeed = state.speed;

    // Interpolate car position between physics frames for smooth rendering
    const p = this.prevState;
    const c = this.currState;
    const a = Math.min(alpha, 1); // clamp alpha to prevent overshooting

    const lx = p.px + (c.px - p.px) * a;
    const ly = p.py + (c.py - p.py) * a;
    const lz = p.pz + (c.pz - p.pz) * a;

    // Proper quaternion SLERP for smooth rotation interpolation
    // Dot product to check if quaternions are on the same hemisphere
    let dot = p.rx * c.rx + p.ry * c.ry + p.rz * c.rz + p.rw * c.rw;
    // If dot < 0, negate one quaternion to take the short path
    let crx = c.rx, cry = c.ry, crz = c.rz, crw = c.rw;
    if (dot < 0) {
      dot = -dot;
      crx = -crx; cry = -cry; crz = -crz; crw = -crw;
    }

    let qx: number, qy: number, qz: number, qw: number;
    if (dot > 0.9995) {
      // Very close — use normalized LERP (NLERP) to avoid division by near-zero sin
      qx = p.rx + (crx - p.rx) * a;
      qy = p.ry + (cry - p.ry) * a;
      qz = p.rz + (crz - p.rz) * a;
      qw = p.rw + (crw - p.rw) * a;
    } else {
      // Full SLERP
      const theta = Math.acos(dot);
      const sinTheta = Math.sin(theta);
      const w1 = Math.sin((1 - a) * theta) / sinTheta;
      const w2 = Math.sin(a * theta) / sinTheta;
      qx = p.rx * w1 + crx * w2;
      qy = p.ry * w1 + cry * w2;
      qz = p.rz * w1 + crz * w2;
      qw = p.rw * w1 + crw * w2;
    }
    // Normalize
    const qlen = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw) || 1;
    qx /= qlen; qy /= qlen; qz /= qlen; qw /= qlen;

    this.vehicleVisuals.root.position.set(lx, ly, lz);
    if (!this.vehicleVisuals.root.rotationQuaternion) {
      this.vehicleVisuals.root.rotationQuaternion = new Quaternion();
    }
    this.vehicleVisuals.root.rotationQuaternion.set(qx, qy, qz, qw);

    // Update wheels (steering/spin from latest physics — these don't need interpolation)
    this.vehicleVisuals.update(this.vehiclePhysics);
    this.vehicleEffects?.update(input);

    // Tron light trail — follows interpolated car position
    this.tronTrail?.update(lx, ly, lz, qx, qy, qz, qw, state.speed);

    // Moving clouds
    this.trackEnvironment?.update(this.elapsed);

    // Camera uses interpolated position
    this.chaseCamera.update(
      lx, ly, lz, qx, qy, qz, qw,
      state.speed, dt,
    );

    // Particles — emit smoke from both rear wheels
    if (this.tireSmokeEmitter) {
      const wheelPos = this.vehicleVisuals.getRearWheelWorldPositions();
      const steeringAngle = Math.abs(this.vehiclePhysics.getWheelTransform(0).steering);
      // Alternate between left and right rear wheel each frame for coverage
      const midX = (wheelPos[0].x + wheelPos[1].x) / 2;
      const midY = (wheelPos[0].y + wheelPos[1].y) / 2;
      const midZ = (wheelPos[0].z + wheelPos[1].z) / 2;
      this.tireSmokeEmitter.emit(
        midX, midY, midZ,
        steeringAngle, state.speed, input.drift,
      );
    }

    if (this.sparkEmitter) {
      // Extract forward from quaternion
      this._forward.set(0, 0, 1);
      const q = new Quaternion(
        state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w,
      );
      this._forward.rotateByQuaternionToRef(q, this._forward);

      this.sparkEmitter.checkAndEmit(
        state.speed,
        state.position.x, state.position.y, state.position.z,
        this._forward.x, this._forward.z,
      );
    }

    // Skid marks disabled — clean track
    if (this.skidMarkRenderer && false as boolean) {
      const wheelPos = this.vehicleVisuals.getRearWheelWorldPositions();
      const steeringAngle = Math.abs(this.vehiclePhysics.getWheelTransform(0).steering);
      const isSlipping = (input.drift && Math.abs(state.speed) > 8) ||
        (steeringAngle > 0.25 && Math.abs(state.speed) > 20);
      this.skidMarkRenderer.update(
        isSlipping,
        wheelPos[0].x, wheelPos[0].z,
        wheelPos[1].x, wheelPos[1].z,
        dt,
      );
    }

    // Speed-reactive post-processing
    this.postProcessing?.setSpeed(state.speed);

    // === AUDIO UPDATES ===
    // Sync master volume from settings store
    const storeVol = useGameStore.getState().masterVolume;
    this.audioEngine?.setVolume(storeVol);

    const absSpeedMs = Math.abs(state.speed);
    const rpm = Math.min(absSpeedMs / 45, 1); // normalized RPM from speed
    const throttle = input.accelerate ? 1 : 0;

    // Engine synth — RPM and throttle
    this.engineSynth?.update(rpm, throttle, absSpeedMs);

    // Tire screech — drift and turning
    const steerAngleForAudio = Math.abs(this.vehiclePhysics.getWheelTransform(0).steering);
    this.tireAudio?.update(input.drift, state.speed, steerAngleForAudio);

    // Wind noise — scales with speed
    this.windAudio?.update(state.speed);

    // Impact detection for audio
    if (speedDelta > 8 && absSpeedMs > 3) {
      const impactForce = Math.min(speedDelta / 30, 1);
      this.impactAudio?.trigger(impactForce);
    }

    // Checkpoint detection — use visual position (which matches track coordinates)
    const carVisualPos = this.vehicleVisuals.root.position;
    const justFinished = this.checkpointSystem?.update(carVisualPos.x, carVisualPos.z, this.elapsed);

    if (justFinished) {
      // Double ensure — finishRace should already be called via callback
      // but call it again just in case
      if (!this.raceFinished) {
        this.finishRace(this.checkpointSystem!.finishTime);
      }
    }

    // HUD
    const store = useGameStore.getState();
    store.setSpeed(state.speed * 3.6);
    store.setRaceTime(this.elapsed);
    store.setPlayerWorldPos({ x: carVisualPos.x, z: carVisualPos.z });
    store.setIsDrifting(input.drift && Math.abs(state.speed) > 3);

    // Dynamic position ranking
    if (this.checkpointSystem) {
      const totalRacers = 1 + this.remoteVehicles.size;
      store.setTotalRacers(totalRacers);

      if (this.remoteVehicles.size > 0) {
        const myLap = this.checkpointSystem.lap;
        const myCP = this.checkpointSystem.currentCheckpointIndex;
        let myPosition = 1;

        for (const [, rv] of this.remoteVehicles) {
          // Compare: who has more laps? If same lap, who has more checkpoints?
          // Since we don't track remote checkpoints, use distance to next checkpoint
          const rp = rv.root.position;
          const remoteDist = this.checkpointSystem.getProgress(rp.x, rp.z);
          const myDist = this.checkpointSystem.getProgress(carVisualPos.x, carVisualPos.z);

          if (remoteDist > myDist) {
            myPosition++;
          }
        }

        store.setPosition(myPosition);
      }
    }

    // Drift-boost system
    const boostForce = this.driftSystem.update(input, state.speed, dt);
    store.setBoostLevel(this.driftSystem.boostLevel);
    store.setBoostActive(this.driftSystem.boostActive);
    store.setIsDrifting(input.drift && Math.abs(state.speed) > 2);

    // Apply boost force — strong impulse in forward direction
    if (boostForce > 0 && this.vehiclePhysics) {
      const chassis = this.vehiclePhysics.getChassisBody();
      const rot = chassis.rotation();
      const fx = 2 * (rot.x * rot.z + rot.w * rot.y);
      const fz = 1 - 2 * (rot.x * rot.x + rot.y * rot.y);
      // Apply as a big impulse for punchy feel
      const impulseScale = boostForce * dt * 1.5;
      chassis.applyImpulse({ x: fx * impulseScale, y: 0, z: fz * impulseScale }, true);

      // Camera + audio effects on first frame of boost
      if (this.driftSystem.boostJustActivated) {
        const level = this.driftSystem.boostMultiplier;
        this.chaseCamera?.shake(0.3 + level * 0.4);
        this.chaseCamera?.fovKick(5 + level * 10);
        this.boostAudio?.triggerBoost(level);
        this.driftSystem.boostJustActivated = false;
      }
    }

    // Nitro system (NFS-style limited boost)
    const isDrifting = input.drift && Math.abs(state.speed) > 2;
    const driftBoostJustFired = this.driftSystem.boostJustActivated;
    const nitroForce = this.nitroSystem.update(input.nitro, isDrifting, driftBoostJustFired, state.speed, dt);
    store.setNitroTank(this.nitroSystem.tankPercent);
    store.setNitroActive(this.nitroSystem.active);
    this.boostAudio?.updateNitro(this.nitroSystem.active, this.nitroSystem.tankPercent);

    if (nitroForce > 0 && this.vehiclePhysics) {
      const chassis = this.vehiclePhysics.getChassisBody();
      const rot = chassis.rotation();
      const fx = 2 * (rot.x * rot.z + rot.w * rot.y);
      const fz = 1 - 2 * (rot.x * rot.x + rot.y * rot.y);
      chassis.applyImpulse({ x: fx * nitroForce * dt, y: 0, z: fz * nitroForce * dt }, true);

      // Camera effects on nitro activation
      if (this.nitroSystem.justActivated) {
        this.chaseCamera?.shake(0.3);
        this.chaseCamera?.fovKick(8);
        this.nitroSystem.justActivated = false;
      }
    }

    // Check collisions between local car and remote cars
    if (this.vehiclePhysics) {
      const myPos = state.position;
      const myVel = state.velocity;
      const mySpeed = Math.abs(state.speed);

      for (const [, rv] of this.remoteVehicles) {
        const rp = rv.root.position;
        const dx = myPos.x - rp.x;
        const dz = myPos.z - rp.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Cars are ~4.2m long, ~1.9m wide — collision at ~3m center-to-center
        if (dist < 3.0 && dist > 0.1 && mySpeed > 1) {
          // Normalize collision direction
          const nx = dx / dist;
          const nz = dz / dist;

          // Impulse magnitude based on relative speed (conservation of momentum)
          // For equal mass: each car gets half the relative velocity change
          const impulseMag = mySpeed * 0.5;

          // Push remote car away from local car
          rv.applyCollisionPush(-nx * impulseMag, 0, -nz * impulseMag);

          // Camera shake on impact
          if (mySpeed > 5) {
            this.chaseCamera?.shake(Math.min(mySpeed * 0.01, 0.2));
          }
        }
      }
    }

    // Update remote player vehicles from interpolated server snapshots
    const now = performance.now();
    for (const [playerId, rv] of this.remoteVehicles) {
      const interpolated = this.entityInterpolation.getInterpolatedState(playerId, now);
      if (interpolated) {
        rv.updateFromSnapshot(interpolated);
      }
    }

    // Render
    this.sceneManager.scene.render();
  };

  /** Expose track data for AI training system */
  getTrackCenterline(): readonly { x: number; z: number; nx: number; nz: number }[] {
    return this.centerline;
  }

  dispose(): void {
    (window as any).__gameInstance = null;
    this.gameLoop?.stop();
    this.inputManager?.dispose();
    // Audio cleanup
    this.engineSynth?.dispose();
    this.tireAudio?.dispose();
    this.impactAudio?.dispose();
    this.boostAudio?.dispose();
    this.windAudio?.dispose();
    this.countdownAudio?.dispose();
    this.audioEngine?.dispose();
    this.tronTrail?.dispose();
    this.skidMarkRenderer?.dispose();
    this.sparkEmitter?.dispose();
    this.tireSmokeEmitter?.dispose();
    this.postProcessing?.dispose();
    this.vehicleEffects?.dispose();
    this.vehicleVisuals?.dispose();
    this.trackEnvironment?.dispose();
    this.trackLighting?.dispose();
    this.trackColliders?.dispose();
    this.trackBuilder?.dispose();
    this.renderer?.dispose();
  }
}
