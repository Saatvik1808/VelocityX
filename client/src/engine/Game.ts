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
import { PHYSICS } from '@neon-drift/shared';

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
import { CheckpointSystem } from '../track/Checkpoints.js';
import { DriftSystem } from '../vehicles/DriftSystem.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { EntityInterpolation } from '../network/EntityInterpolation.js';
import { RemoteVehicle } from '../network/RemoteVehicle.js';
import { useGameStore } from '../ui/store.js';
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

  private elapsed = 0;
  private prevSpeed = 0;
  private inputSeq = 0;
  private readonly _forward = new Vector3();

  // Interpolation: store previous physics state for smooth rendering
  private prevState = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, rw: 1 };
  private currState = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, rw: 1 };

  // Gameplay
  private checkpointSystem: CheckpointSystem | null = null;
  private driftSystem = new DriftSystem();

  // Multiplayer
  private networkManager: NetworkManager | null = null;
  private entityInterpolation = new EntityInterpolation();
  private remoteVehicles = new Map<PlayerId, RemoteVehicle>();
  private scene: any = null;

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

    // 5b. Create checkpoint system
    this.checkpointSystem = new CheckpointSystem(this.trackBuilder.getCenterline(), scene);
    this.checkpointSystem.startRace(0);
    useGameStore.getState().setTotalCheckpoints(this.checkpointSystem.totalCheckpoints);

    this.checkpointSystem.onCheckpointHit = (index, lap) => {
      const store = useGameStore.getState();
      store.setCurrentCheckpoint(index);
      store.setLap(lap);

      // Send checkpoint to server
      const nm = (window as any).__networkManager;
      if (nm?.connected) {
        nm.socket?.emit('CLIENT_CHECKPOINT_HIT', { checkpointIndex: index, lapNumber: lap });
      }
    };

    this.checkpointSystem.onLapComplete = (lap, lapTime) => {
      console.log(`Lap ${lap} complete: ${lapTime.toFixed(2)}s`);
    };

    this.checkpointSystem.onRaceFinish = (totalTime) => {
      console.log(`Race finished! Time: ${totalTime.toFixed(2)}s`);
      const store = useGameStore.getState();

      // Show results
      const myName = (window as any).__networkManager?.playerId?.slice(0, 6) ?? 'You';
      store.setRaceResults([{
        id: ((window as any).__networkManager?.playerId ?? 'local') as any,
        name: myName,
        time: totalTime,
        position: 1,
      }]);
      store.setGamePhase('RESULTS');

      // Send finish to server
      const nm = (window as any).__networkManager;
      if (nm?.connected) {
        nm.socket?.emit('CLIENT_FINISHED', { time: totalTime });
      }
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
    this.vehiclePhysics = new VehiclePhysics(
      RAPIER, this.world, startInfo.position, startInfo.rotation,
    );

    // 12. Vehicle visuals
    this.vehicleVisuals = new VehicleVisuals(scene);

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

    // 18. Input — disable Babylon.js keyboard interception
    scene.detachControl();
    this.inputManager = new InputManager();

    // 19. Game loop
    this.gameLoop = new GameLoop(this.onFixedUpdate, this.onRender);

    // 20. Set active camera and start
    scene.activeCamera = this.chaseCamera.camera;
    this.scene = scene;
    useGameStore.getState().setGamePhase('PLAYING');
    this.gameLoop.start();

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
      this.checkpointSystem?.startRace(this.elapsed);
      useGameStore.getState().setGamePhase('RACING');
    };

    this.networkManager.onCountdown = (seconds: number) => {
      useGameStore.getState().setCountdownSeconds(seconds);
    };
  }

  private onFixedUpdate = (dt: number): void => {
    if (!this.inputManager || !this.vehiclePhysics || !this.world) return;

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
  };

  private onRender = (alpha: number): void => {
    if (!this.sceneManager || !this.vehiclePhysics || !this.vehicleVisuals ||
        !this.chaseCamera || !this.inputManager) return;

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

    // Quaternion SLERP approximation (normalize after lerp)
    let qx = p.rx + (c.rx - p.rx) * a;
    let qy = p.ry + (c.ry - p.ry) * a;
    let qz = p.rz + (c.rz - p.rz) * a;
    let qw = p.rw + (c.rw - p.rw) * a;
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

    // Checkpoint detection — BEFORE HUD so results show instantly
    this.checkpointSystem?.update(state.position.x, state.position.z, this.elapsed);

    // HUD
    const store = useGameStore.getState();
    store.setSpeed(state.speed * 3.6);
    store.setRaceTime(this.elapsed);
    store.setPlayerWorldPos({ x: state.position.x, z: state.position.z });
    store.setIsDrifting(input.drift && Math.abs(state.speed) > 3);

    // Dynamic position ranking
    if (this.checkpointSystem) {
      const totalRacers = 1 + this.remoteVehicles.size;
      store.setTotalRacers(totalRacers);

      if (this.remoteVehicles.size > 0) {
        const myLap = this.checkpointSystem.currentLap;
        const myCP = this.checkpointSystem.currentCheckpointIndex;
        let myPosition = 1;

        for (const [, rv] of this.remoteVehicles) {
          // Compare: who has more laps? If same lap, who has more checkpoints?
          // Since we don't track remote checkpoints, use distance to next checkpoint
          const rp = rv.root.position;
          const remoteDist = this.checkpointSystem.getProgress(rp.x, rp.z);
          const myDist = this.checkpointSystem.getProgress(state.position.x, state.position.z);

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

    // Apply boost force to car (extra engine force on rear wheels)
    if (boostForce > 0 && this.vehiclePhysics) {
      const chassis = this.vehiclePhysics.getChassisBody();
      const rot = chassis.rotation();
      // Forward direction from quaternion
      const fx = 2 * (rot.x * rot.z + rot.w * rot.y);
      const fz = 1 - 2 * (rot.x * rot.x + rot.y * rot.y);
      chassis.applyImpulse({ x: fx * boostForce * dt, y: 0, z: fz * boostForce * dt }, true);
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

  dispose(): void {
    this.gameLoop?.stop();
    this.inputManager?.dispose();
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
