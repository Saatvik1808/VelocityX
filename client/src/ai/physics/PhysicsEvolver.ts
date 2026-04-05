/**
 * LEARNING NOTE: Self-Tuning Physics — The Game Rewrites Its Own Code
 *
 * This is the most experimental system: the game EVOLVES its own physics
 * constants using a genetic algorithm. Instead of a human spending hours
 * tweaking suspension stiffness and tire friction, the GA tests hundreds
 * of parameter combinations and keeps the ones that produce the most fun races.
 *
 * The process:
 * 1. Collect telemetry from real player races (what happens with current physics)
 * 2. Create a population of mutated physics configs
 * 3. Simulate races with AI drivers using each config
 * 4. Measure fitness: drift success rate, speed variance, wall collision rate
 * 5. Evolve: keep the best configs, breed + mutate
 * 6. Apply the winner as the new default physics
 *
 * This is similar to how OpenAI evolved robot locomotion policies —
 * except we're evolving the physics parameters, not the controller.
 *
 * Key concepts: co-evolution, hyperparameter optimization, A/B testing
 */

import {
  VEHICLE, WHEELS, STEERING, ENGINE, DRIFT_BOOST,
} from '@neon-drift/shared';

/** A mutable physics configuration that can be evolved */
export interface TunablePhysicsConfig {
  engineMaxForce: number;
  brakeForce: number;
  reverseForce: number;
  rollingResistance: number;
  maxSteeringAngle: number;
  steeringSpeed: number;
  steeringReturnSpeed: number;
  speedSensitiveMin: number;
  suspensionStiffness: number;
  suspensionCompression: number;
  suspensionRelaxation: number;
  frontFrictionSlip: number;
  rearFrictionSlip: number;
  driftLevel1Time: number;
  driftLevel1Multiplier: number;
  driftLevel2Time: number;
  driftLevel2Multiplier: number;
  driftLevel3Time: number;
  driftLevel3Multiplier: number;
  chassisMass: number;
  angularDamping: number;
}

/** Valid ranges for each parameter (prevents absurd values) */
export const TUNABLE_RANGES: Record<keyof TunablePhysicsConfig, { min: number; max: number }> = {
  engineMaxForce:       { min: 5000, max: 25000 },
  brakeForce:           { min: 30, max: 300 },
  reverseForce:         { min: 1000, max: 8000 },
  rollingResistance:    { min: 1, max: 15 },
  maxSteeringAngle:     { min: 0.3, max: 1.2 },
  steeringSpeed:        { min: 4, max: 18 },
  steeringReturnSpeed:  { min: 3, max: 15 },
  speedSensitiveMin:    { min: 0.2, max: 0.8 },
  suspensionStiffness:  { min: 10, max: 50 },
  suspensionCompression: { min: 1, max: 10 },
  suspensionRelaxation: { min: 1, max: 8 },
  frontFrictionSlip:    { min: 1.0, max: 5.0 },
  rearFrictionSlip:     { min: 0.5, max: 4.0 },
  driftLevel1Time:      { min: 0.1, max: 1.0 },
  driftLevel1Multiplier: { min: 0.1, max: 0.8 },
  driftLevel2Time:      { min: 0.4, max: 2.0 },
  driftLevel2Multiplier: { min: 0.3, max: 1.2 },
  driftLevel3Time:      { min: 1.0, max: 4.0 },
  driftLevel3Multiplier: { min: 0.5, max: 2.0 },
  chassisMass:          { min: 800, max: 2500 },
  angularDamping:       { min: 0.5, max: 5.0 },
};

/** Create a config from the current game constants (the "baseline") */
export function createDefaultConfig(): TunablePhysicsConfig {
  return {
    engineMaxForce: ENGINE.MAX_FORCE,
    brakeForce: ENGINE.BRAKE_FORCE,
    reverseForce: ENGINE.REVERSE_FORCE,
    rollingResistance: ENGINE.ROLLING_RESISTANCE,
    maxSteeringAngle: STEERING.MAX_ANGLE,
    steeringSpeed: STEERING.SPEED,
    steeringReturnSpeed: STEERING.RETURN_SPEED,
    speedSensitiveMin: STEERING.SPEED_SENSITIVE_MIN,
    suspensionStiffness: WHEELS.SUSPENSION_STIFFNESS,
    suspensionCompression: WHEELS.SUSPENSION_COMPRESSION,
    suspensionRelaxation: WHEELS.SUSPENSION_RELAXATION,
    frontFrictionSlip: WHEELS.FRONT_FRICTION_SLIP,
    rearFrictionSlip: WHEELS.REAR_FRICTION_SLIP,
    driftLevel1Time: DRIFT_BOOST.LEVEL_1_TIME,
    driftLevel1Multiplier: DRIFT_BOOST.LEVEL_1_MULTIPLIER,
    driftLevel2Time: DRIFT_BOOST.LEVEL_2_TIME,
    driftLevel2Multiplier: DRIFT_BOOST.LEVEL_2_MULTIPLIER,
    driftLevel3Time: DRIFT_BOOST.LEVEL_3_TIME,
    driftLevel3Multiplier: DRIFT_BOOST.LEVEL_3_MULTIPLIER,
    chassisMass: VEHICLE.CHASSIS_MASS,
    angularDamping: STEERING.ANGULAR_DAMPING,
  };
}

/** Serialize config to a flat Float32Array (for the genetic algorithm) */
export function configToGenome(config: TunablePhysicsConfig): Float32Array {
  const keys = Object.keys(TUNABLE_RANGES) as (keyof TunablePhysicsConfig)[];
  const genome = new Float32Array(keys.length);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const range = TUNABLE_RANGES[key]!;
    // Normalize to [0, 1]
    genome[i] = (config[key] - range.min) / (range.max - range.min);
  }
  return genome;
}

/** Deserialize from Float32Array back to config (with clamping) */
export function genomeToConfig(genome: Float32Array): TunablePhysicsConfig {
  const keys = Object.keys(TUNABLE_RANGES) as (keyof TunablePhysicsConfig)[];
  const config: Record<string, number> = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const range = TUNABLE_RANGES[key]!;
    // Denormalize from [0, 1] and clamp
    const value = genome[i]! * (range.max - range.min) + range.min;
    config[key] = clamp(value, range.min, range.max);
  }
  return config as unknown as TunablePhysicsConfig;
}

/** Get the number of tunable parameters */
export function getGenomeLength(): number {
  return Object.keys(TUNABLE_RANGES).length;
}

/**
 * Physics fitness function: evaluates a config based on aggregated race telemetry.
 * Used by the GA to decide which configs are "good."
 */
export function evaluatePhysicsFitness(telemetry: {
  driftSuccessRate: number;     // [0, 1] higher = drifts work well
  avgTimeOnTrack: number;       // [0, 1] fraction of race time NOT against walls
  speedVariance: number;        // std dev of speed (higher = more exciting)
  avgSpeed: number;             // m/s (higher = more fun, to a point)
  wallCollisionRate: number;    // hits per minute (lower = less frustrating)
  completionRate: number;       // [0, 1] fraction of racers who finished
}): number {
  // Drift should work ~ 50-70% of the time (not too easy, not too hard)
  const driftScore = 1 - Math.abs(telemetry.driftSuccessRate - 0.6) * 2;

  // Players should be on-track most of the time
  const trackScore = telemetry.avgTimeOnTrack;

  // Speed variance should be moderate (mix of fast straights and slow corners)
  const varianceScore = clamp(telemetry.speedVariance / 15, 0, 1);

  // Average speed should be in a "fun" range (20-45 m/s)
  const speedScore = 1 - Math.abs(telemetry.avgSpeed - 32) / 25;

  // Low wall collision rate
  const wallScore = clamp(1 - telemetry.wallCollisionRate / 8, 0, 1);

  // Most players should be able to finish
  const completionScore = telemetry.completionRate;

  return (
    driftScore * 0.25 +
    trackScore * 0.20 +
    varianceScore * 0.15 +
    clamp(speedScore, 0, 1) * 0.15 +
    wallScore * 0.15 +
    completionScore * 0.10
  );
}

/** Save the best evolved config to localStorage */
export function saveEvolvedConfig(config: TunablePhysicsConfig): void {
  try {
    localStorage.setItem('neon_drift_evolved_physics', JSON.stringify(config));
  } catch { /* ignore */ }
}

/** Load the best evolved config from localStorage */
export function loadEvolvedConfig(): TunablePhysicsConfig | null {
  try {
    const saved = localStorage.getItem('neon_drift_evolved_physics');
    if (!saved) return null;
    return JSON.parse(saved) as TunablePhysicsConfig;
  } catch {
    return null;
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
