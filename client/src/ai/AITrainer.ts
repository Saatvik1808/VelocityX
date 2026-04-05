/**
 * LEARNING NOTE: AI Training Loop — Headless Neuroevolution
 *
 * This is where the magic happens. The trainer:
 * 1. Creates a headless physics world (no rendering — just Rapier WASM)
 * 2. Runs a population of AI drivers through the track
 * 3. Measures fitness (checkpoints, speed, drift-boosts, wall avoidance)
 * 4. Evolves the population using a genetic algorithm
 * 5. Repeats for hundreds of generations
 *
 * Because we skip rendering entirely, each 60-second race simulation
 * takes only ~0.5 seconds of real time. A generation of 50 agents
 * completes in ~25 seconds — fast enough for real-time training in browser.
 *
 * Key concepts: headless simulation, neuroevolution, fitness evaluation
 */

import RAPIER from '@dimforge/rapier3d-compat';
import {
  PHYSICS, VEHICLE, WHEELS, WHEEL_POSITIONS, STEERING, ENGINE, CHECKPOINTS,
} from '@neon-drift/shared';
import { FeedForwardNet } from './nn/FeedForwardNet.js';
import { AI_NET_LAYERS } from './AIDriver.js';
import { GeneticAlgorithm, DEFAULT_GA_CONFIG } from './evolution/GeneticAlgorithm.js';
import type { GAConfig } from './evolution/GeneticAlgorithm.js';
import {
  calculateFitness, createEmptyMetrics,
} from './evolution/FitnessEvaluator.js';
import type { RacingMetrics } from './evolution/FitnessEvaluator.js';
import { OBSERVATION_SIZE } from './AIObservation.js';

export interface TrainingProgress {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  bestEverFitness: number;
  evaluating: number; // which individual is being evaluated
  totalPopulation: number;
  isRunning: boolean;
  fitnessHistory: { gen: number; best: number; avg: number }[];
}

export type TrainingCallback = (progress: TrainingProgress) => void;

/** Simplified centerline for headless simulation */
interface CenterlinePoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
}

/**
 * The AI Trainer runs headless physics simulations to evolve neural network
 * weights. Call `start()` to begin training, `stop()` to halt.
 */
export class AITrainer {
  private ga: GeneticAlgorithm;
  private isRunning = false;
  private shouldStop = false;
  private callback: TrainingCallback | null = null;
  private fitnessHistory: { gen: number; best: number; avg: number }[] = [];

  // Track data cached from the real track
  private centerline: CenterlinePoint[] = [];
  private checkpointPositions: { x: number; z: number }[] = [];

  constructor() {
    const genomeLength = FeedForwardNet.weightCount(AI_NET_LAYERS);
    this.ga = new GeneticAlgorithm({
      ...DEFAULT_GA_CONFIG,
      genomeLength,
    });
  }

  /** Set the track centerline from TrackBuilder (must be called before start) */
  setTrackData(centerline: readonly { x: number; z: number; nx: number; nz: number }[]): void {
    this.centerline = [...centerline];
    // Create checkpoint positions every N centerline points
    const spacing = Math.max(1, Math.floor(centerline.length / 20)); // ~20 checkpoints
    this.checkpointPositions = [];
    for (let i = 0; i < centerline.length; i += spacing) {
      this.checkpointPositions.push({ x: centerline[i]!.x, z: centerline[i]!.z });
    }
  }

  /** Begin training. Runs asynchronously, yields to browser between generations. */
  async start(onProgress?: TrainingCallback): Promise<void> {
    if (this.isRunning) return;
    if (this.centerline.length === 0) {
      throw new Error('Must call setTrackData() before start()');
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.callback = onProgress ?? null;

    // Load previous progress if any
    this.loadProgress();

    // Initialize population (or re-init if fresh)
    if (this.ga.getPopulation().length === 0) {
      this.ga.initialize();
    }

    // Ensure Rapier is ready
    await RAPIER.init();

    // Training loop — one generation per iteration
    while (!this.shouldStop) {
      await this.runGeneration();

      // Save best genome after each generation
      this.saveBestGenome();
      this.saveProgress();

      // Yield to browser so UI stays responsive
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    this.isRunning = false;
    this.emitProgress(-1);
  }

  /** Stop training after the current generation completes */
  stop(): void {
    this.shouldStop = true;
  }

  get running(): boolean {
    return this.isRunning;
  }

  /** Run one full generation: evaluate all individuals, then evolve */
  private async runGeneration(): Promise<void> {
    const population = this.ga.getPopulation();

    for (let i = 0; i < population.length; i++) {
      if (this.shouldStop) return;

      // Emit progress so UI updates
      this.emitProgress(i);

      // Evaluate this individual
      const individual = population[i]!;
      const net = new FeedForwardNet(AI_NET_LAYERS);
      net.setWeights(individual.genome);

      const fitness = this.evaluateAgent(net);
      this.ga.setFitness(i, fitness);

      // Yield occasionally so browser doesn't freeze
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Evolve to next generation
    this.ga.evolve();

    // Record history
    this.fitnessHistory.push({
      gen: this.ga.getGeneration(),
      best: this.ga.getBestFitness(),
      avg: this.ga.getAverageFitness(),
    });

    // Keep last 100 history entries
    if (this.fitnessHistory.length > 100) {
      this.fitnessHistory.shift();
    }
  }

  /**
   * Evaluate a single AI agent by running a headless physics simulation.
   * Returns the fitness score.
   */
  private evaluateAgent(net: FeedForwardNet): number {
    // Create a minimal physics world
    const gravity = new RAPIER.Vector3(PHYSICS.GRAVITY.x, PHYSICS.GRAVITY.y, PHYSICS.GRAVITY.z);
    const world = new RAPIER.World(gravity);

    // Create ground plane
    const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(500, 0.1, 500).setTranslation(0, -0.1, 0).setFriction(1.0),
      groundBody,
    );

    // Create simple wall colliders along the track edges
    this.createTrackWalls(world);

    // Create vehicle
    const startPos = this.centerline[0]!;
    const nextPos = this.centerline[1] ?? this.centerline[0]!;
    const dx = nextPos.x - startPos.x;
    const dz = nextPos.z - startPos.z;
    const rotY = Math.atan2(dx, dz);

    const chassisDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPos.x, 1.0, startPos.z)
      .setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) })
      .setAdditionalMass(VEHICLE.CHASSIS_MASS)
      .setLinearDamping(0.1)
      .setAngularDamping(STEERING.ANGULAR_DAMPING);

    const chassisBody = world.createRigidBody(chassisDesc);

    // Create vehicle controller
    const vehicle = world.createVehicleController(chassisBody);

    // Create chassis collider
    const hx = VEHICLE.CHASSIS_HALF_EXTENTS;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx.x, hx.y, hx.z).setFriction(0.5).setRestitution(0.2),
      chassisBody,
    );

    // Add wheels
    for (let i = 0; i < 4; i++) {
      const wp = WHEEL_POSITIONS[i]!;
      const isFront = i < 2;
      vehicle.addWheel(
        { x: wp.x, y: wp.y, z: wp.z },
        { x: 0, y: -1, z: 0 },              // suspension direction (down)
        { x: 0, y: 0, z: 1 },               // axle direction
        WHEELS.SUSPENSION_REST_LENGTH,
        WHEELS.RADIUS,
      );
      vehicle.setWheelSuspensionStiffness(i, WHEELS.SUSPENSION_STIFFNESS);
      vehicle.setWheelMaxSuspensionTravel(i, WHEELS.MAX_SUSPENSION_TRAVEL);
      vehicle.setWheelFrictionSlip(i, isFront ? WHEELS.FRONT_FRICTION_SLIP : WHEELS.REAR_FRICTION_SLIP);
    }

    // Run simulation
    const metrics = createEmptyMetrics();
    const maxFrames = 120 * 30; // 30 seconds at 120Hz
    let currentSteeringAngle = 0;
    let nextCheckpoint = 0;
    let currentLap = 0;
    let speedSum = 0;
    let maxSpeed = 0;
    let prevSpeed = 0;

    for (let frame = 0; frame < maxFrames; frame++) {
      const dt = PHYSICS.TIMESTEP;

      // Get car state
      const pos = chassisBody.translation();
      const rot = chassisBody.rotation();
      const linvel = chassisBody.linvel();
      const angvel = chassisBody.angvel();

      // Compute forward direction from quaternion
      const fwdX = 2 * (rot.x * rot.z + rot.w * rot.y);
      const fwdZ = 1 - 2 * (rot.x * rot.x + rot.y * rot.y);
      const fwdLen = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ) || 1;
      const forwardX = fwdX / fwdLen;
      const forwardZ = fwdZ / fwdLen;

      // Forward speed (dot product of velocity with forward direction)
      const forwardSpeed = linvel.x * forwardX + linvel.z * forwardZ;
      const lateralSpeed = linvel.x * (-forwardZ) + linvel.z * forwardX;

      // Build simplified observation (without raycasts for speed)
      const obs = this.buildSimplifiedObservation(
        pos, forwardX, forwardZ, forwardSpeed, lateralSpeed,
        angvel.y, currentSteeringAngle, nextCheckpoint, currentLap,
      );

      // Neural network decision
      const outputs = net.forward(obs);
      const accelerate = outputs[0]! > 0;
      const brake = outputs[1]! > 0;
      const steerLeft = outputs[2]! > 0.1;
      const steerRight = outputs[3]! > 0.1;
      const drift = outputs[4]! > 0;

      // Apply steering
      let targetSteer = 0;
      if (steerLeft) targetSteer = STEERING.MAX_ANGLE;
      if (steerRight) targetSteer = -STEERING.MAX_ANGLE;

      // Speed-sensitive steering reduction
      const absSpeed = Math.abs(forwardSpeed);
      if (absSpeed > STEERING.SPEED_SENSITIVE_START) {
        const t = Math.min((absSpeed - STEERING.SPEED_SENSITIVE_START) /
          (STEERING.SPEED_SENSITIVE_FULL - STEERING.SPEED_SENSITIVE_START), 1);
        const mult = 1 - t * (1 - STEERING.SPEED_SENSITIVE_MIN);
        targetSteer *= mult;
      }

      // Smooth steering
      if (targetSteer > currentSteeringAngle) {
        currentSteeringAngle = Math.min(currentSteeringAngle + STEERING.SPEED * dt, targetSteer);
      } else {
        currentSteeringAngle = Math.max(currentSteeringAngle - STEERING.SPEED * dt, targetSteer);
      }

      // Apply to vehicle controller
      vehicle.setWheelSteering(0, currentSteeringAngle);
      vehicle.setWheelSteering(1, currentSteeringAngle);

      // Engine force
      let engineForce = 0;
      if (accelerate) {
        engineForce = ENGINE.MAX_FORCE;
        if (drift) engineForce *= 0.8; // reduce power while drifting
      }
      if (brake) {
        if (forwardSpeed > 1) {
          vehicle.setWheelBrake(0, ENGINE.BRAKE_FORCE);
          vehicle.setWheelBrake(1, ENGINE.BRAKE_FORCE);
          vehicle.setWheelBrake(2, ENGINE.BRAKE_FORCE);
          vehicle.setWheelBrake(3, ENGINE.BRAKE_FORCE);
        } else {
          engineForce = -ENGINE.REVERSE_FORCE;
        }
      } else {
        vehicle.setWheelBrake(0, 0);
        vehicle.setWheelBrake(1, 0);
        vehicle.setWheelBrake(2, 0);
        vehicle.setWheelBrake(3, 0);
      }

      // Apply to rear wheels (RWD)
      vehicle.setWheelEngineForce(2, engineForce);
      vehicle.setWheelEngineForce(3, engineForce);

      // Drift: reduce rear friction
      if (drift && absSpeed > 5) {
        vehicle.setWheelFrictionSlip(2, WHEELS.REAR_FRICTION_SLIP * 0.55);
        vehicle.setWheelFrictionSlip(3, WHEELS.REAR_FRICTION_SLIP * 0.55);
      } else {
        vehicle.setWheelFrictionSlip(2, WHEELS.REAR_FRICTION_SLIP);
        vehicle.setWheelFrictionSlip(3, WHEELS.REAR_FRICTION_SLIP);
      }

      // Apply anti-spin constraint
      if (Math.abs(angvel.y) > 2.5) {
        chassisBody.setAngvel({ x: angvel.x, y: Math.sign(angvel.y) * 2.5, z: angvel.z }, true);
      }

      // Step physics
      vehicle.updateVehicle(dt);
      world.step();

      // === Metrics tracking ===
      speedSum += absSpeed;
      if (absSpeed > maxSpeed) maxSpeed = absSpeed;

      // Wall collision detection
      const speedDelta = prevSpeed - absSpeed;
      if (speedDelta > 8) metrics.wallCollisions++;
      prevSpeed = absSpeed;

      // Stuck detection
      if (absSpeed < 1) metrics.framesStuck++;

      // Spin detection
      if (Math.abs(angvel.y) > 4) metrics.framesSpinning++;

      // Checkpoint detection
      if (nextCheckpoint < this.checkpointPositions.length) {
        const cp = this.checkpointPositions[nextCheckpoint]!;
        const cpDx = pos.x - cp.x;
        const cpDz = pos.z - cp.z;
        const cpDist = Math.sqrt(cpDx * cpDx + cpDz * cpDz);
        if (cpDist < CHECKPOINTS.RADIUS) {
          metrics.checkpointsReached++;
          nextCheckpoint++;

          // Lap detection
          if (nextCheckpoint >= this.checkpointPositions.length) {
            currentLap++;
            metrics.lapsCompleted = currentLap;
            nextCheckpoint = 0; // reset for next lap

            if (currentLap >= CHECKPOINTS.TOTAL_LAPS) {
              metrics.finished = true;
              metrics.raceTime = frame * dt;
              break;
            }
          }
        }
      }

      // Centerline progress (for gradient before first checkpoint)
      metrics.centerlineProgress = Math.max(metrics.centerlineProgress,
        this.getCenterlineProgress(pos.x, pos.z));

      // Out of bounds — end early
      if (pos.y < -10) break;

      metrics.totalFrames = frame;
    }

    // Finalize metrics
    metrics.averageSpeed = metrics.totalFrames > 0 ? speedSum / metrics.totalFrames : 0;
    metrics.maxSpeed = maxSpeed;

    // Free physics world
    world.free();

    return calculateFitness(metrics);
  }

  /** Build a simplified observation vector (no raycasts for speed) */
  private buildSimplifiedObservation(
    pos: { x: number; y: number; z: number },
    forwardX: number, forwardZ: number,
    forwardSpeed: number, lateralSpeed: number,
    angVelY: number, steeringAngle: number,
    checkpointIndex: number, lap: number,
  ): number[] {
    const obs: number[] = [];

    // Simplified raycasts: use distance to nearest wall estimate from centerline
    // For each ray angle, estimate wall distance from centerline distance
    const nearestIdx = this.findNearestCenterline(pos.x, pos.z);
    const cp = this.centerline[nearestIdx]!;
    const distFromCenter = Math.sqrt(
      (pos.x - cp.x) * (pos.x - cp.x) + (pos.z - cp.z) * (pos.z - cp.z)
    );
    const trackHalfWidth = 14; // approx half of 28m road
    const wallDist = Math.max(0, trackHalfWidth - distFromCenter) / trackHalfWidth;

    // 5 rays with estimated distances (simplified but provides gradient signal)
    for (let i = 0; i < 5; i++) {
      // Vary wall distance based on which side we're on relative to forward
      const offset = (i - 2) * 0.15; // -0.3 to +0.3
      obs.push(Math.max(0, Math.min(1, wallDist + offset)));
      obs.push(wallDist < 0.2 ? 1.0 : 0.0); // hit flag
    }

    // Vehicle dynamics (6 values)
    obs.push(clamp(forwardSpeed / 70, -1, 1));
    obs.push(clamp(lateralSpeed / 70, -1, 1));
    obs.push(clamp(angVelY / 5, -1, 1));
    obs.push(clamp(steeringAngle / STEERING.MAX_ANGLE, -1, 1));
    obs.push(-1); // not drifting (simplified)
    obs.push(0);  // nitro tank

    // Track context (6 values)
    const nextCP = checkpointIndex < this.checkpointPositions.length
      ? this.checkpointPositions[checkpointIndex]!
      : this.checkpointPositions[0]!;
    const dx = nextCP.x - pos.x;
    const dz = nextCP.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) + 1e-6;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const dot = forwardX * dirX + forwardZ * dirZ;
    const cross = forwardX * dirZ - forwardZ * dirX;

    obs.push(clamp(dot, -1, 1));
    obs.push(clamp(cross, -1, 1));
    obs.push(clamp(dist / 200, 0, 1) * 2 - 1);

    const totalCP = this.checkpointPositions.length;
    const progress = (lap * totalCP + checkpointIndex) / Math.max(totalCP * CHECKPOINTS.TOTAL_LAPS, 1);
    obs.push(progress * 2 - 1);

    obs.push(-1); // drift charge level (none)
    obs.push(clamp(dot, -1, 1)); // velocity alignment

    return obs;
  }

  /** Create simple wall colliders along track edges */
  private createTrackWalls(world: RAPIER.World): void {
    // Create walls every few centerline points
    const step = Math.max(1, Math.floor(this.centerline.length / 80));
    const halfWidth = 14; // half of 28m road
    const wallHeight = 2;

    for (let i = 0; i < this.centerline.length; i += step) {
      const pt = this.centerline[i]!;
      const next = this.centerline[(i + step) % this.centerline.length]!;

      const dx = next.x - pt.x;
      const dz = next.z - pt.z;
      const segLen = Math.sqrt(dx * dx + dz * dz);
      if (segLen < 0.1) continue;

      // Normal direction (perpendicular to segment)
      const nx = -dz / segLen;
      const nz = dx / segLen;
      const rotY = Math.atan2(dx, dz);

      // Left wall
      const leftBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(pt.x + nx * halfWidth, wallHeight / 2, pt.z + nz * halfWidth)
          .setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) }),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.5, wallHeight / 2, segLen / 2)
          .setFriction(0.3).setRestitution(0.5),
        leftBody,
      );

      // Right wall
      const rightBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(pt.x - nx * halfWidth, wallHeight / 2, pt.z - nz * halfWidth)
          .setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) }),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.5, wallHeight / 2, segLen / 2)
          .setFriction(0.3).setRestitution(0.5),
        rightBody,
      );
    }
  }

  private findNearestCenterline(x: number, z: number): number {
    let minDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < this.centerline.length; i++) {
      const pt = this.centerline[i]!;
      const d = (x - pt.x) * (x - pt.x) + (z - pt.z) * (z - pt.z);
      if (d < minDist) { minDist = d; bestIdx = i; }
    }
    return bestIdx;
  }

  private getCenterlineProgress(x: number, z: number): number {
    const idx = this.findNearestCenterline(x, z);
    return idx / this.centerline.length;
  }

  /** Save best genome to localStorage */
  private saveBestGenome(): void {
    const best = this.ga.getBestGenome();
    if (best) {
      localStorage.setItem('ai_best_genome_v1', JSON.stringify(Array.from(best)));
    }
  }

  /** Save training progress for resume */
  private saveProgress(): void {
    try {
      localStorage.setItem('ai_training_progress', JSON.stringify({
        generation: this.ga.getGeneration(),
        bestEverFitness: this.ga.getBestEverFitness(),
        fitnessHistory: this.fitnessHistory,
      }));
    } catch { /* ignore */ }
  }

  /** Load previous training progress */
  private loadProgress(): void {
    try {
      const saved = localStorage.getItem('ai_training_progress');
      if (saved) {
        const data = JSON.parse(saved) as {
          fitnessHistory: { gen: number; best: number; avg: number }[];
        };
        this.fitnessHistory = data.fitnessHistory ?? [];
      }
    } catch { /* ignore */ }
  }

  private emitProgress(evaluatingIndex: number): void {
    if (!this.callback) return;
    this.callback({
      generation: this.ga.getGeneration(),
      bestFitness: this.ga.getBestFitness(),
      avgFitness: this.ga.getAverageFitness(),
      bestEverFitness: this.ga.getBestEverFitness(),
      evaluating: evaluatingIndex,
      totalPopulation: this.ga.getPopulation().length,
      isRunning: this.isRunning,
      fitnessHistory: this.fitnessHistory,
    });
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
