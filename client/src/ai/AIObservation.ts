/**
 * LEARNING NOTE: Observation Builder — What the AI "Sees"
 *
 * An RL agent needs a fixed-size numerical vector representing the world.
 * We convert the raw game state into 22 normalized values:
 * - 10 distance rays (wall detection via Rapier raycasts)
 * - 6 vehicle dynamics (speed, lateral velocity, angular velocity, etc.)
 * - 6 track context (direction to next checkpoint, progress)
 *
 * All values are normalized to roughly [-1, 1] so the neural network
 * trains efficiently — large input values would dominate small ones.
 *
 * Key concepts: observation space, raycasting, feature normalization
 */

import RAPIER from '@dimforge/rapier3d-compat';

/** Configuration for the observation builder */
export const AI_OBSERVATION_CONFIG = {
  /** Number of directional raycasts for wall detection */
  RAY_COUNT: 5,
  /** Maximum raycast distance in meters */
  RAY_MAX_DISTANCE: 50.0,
  /** Ray angles relative to car forward (radians) */
  RAY_ANGLES: [
    0,                       // forward
    -Math.PI / 6,            // 30 degrees left
    Math.PI / 6,             // 30 degrees right
    -Math.PI / 3,            // 60 degrees left
    Math.PI / 3,             // 60 degrees right
  ],
  /** Max speed for normalization (m/s) */
  MAX_SPEED: 70.0,
  /** Max angular velocity for normalization (rad/s) */
  MAX_ANG_VEL: 5.0,
  /** Max checkpoint distance for normalization */
  MAX_CP_DISTANCE: 200.0,
} as const;

/** Total size of the observation vector */
export const OBSERVATION_SIZE =
  AI_OBSERVATION_CONFIG.RAY_COUNT * 2 +  // distance + hit flag per ray
  6 +                                     // vehicle dynamics
  6;                                      // track context

export interface ObservationContext {
  /** Rapier physics world for raycasting */
  world: RAPIER.World;
  /** Car body handle for excluding from raycasts */
  carBodyHandle: number;
  /** Car position (x, y, z) */
  carPos: { x: number; y: number; z: number };
  /** Car forward direction (unit vector in xz plane) */
  carForward: { x: number; z: number };
  /** Car right direction (unit vector in xz plane) */
  carRight: { x: number; z: number };
  /** Forward speed in m/s */
  forwardSpeed: number;
  /** Lateral (sideways) speed in m/s */
  lateralSpeed: number;
  /** Angular velocity around Y axis (yaw rate) in rad/s */
  angularVelocityY: number;
  /** Current steering angle normalized [-1, 1] */
  steeringNormalized: number;
  /** Is the car currently drifting? */
  isDrifting: boolean;
  /** Nitro tank level [0, 1] */
  nitroTank: number;
  /** Drift charge level [0, 3] */
  driftChargeLevel: number;
  /** Next checkpoint position (x, z) */
  nextCheckpointX: number;
  nextCheckpointZ: number;
  /** Checkpoint index (for progress calculation) */
  checkpointIndex: number;
  totalCheckpoints: number;
  /** Current lap */
  currentLap: number;
  totalLaps: number;
}

// Pre-allocated ray and vector to avoid GC during gameplay
const _rayOrigin = { x: 0, y: 0, z: 0 };
const _rayDir = { x: 0, y: 0, z: 0 };

/**
 * Build a normalized observation vector from the current game state.
 * Returns a Float32Array of size OBSERVATION_SIZE.
 */
export function buildObservation(ctx: ObservationContext): number[] {
  const obs: number[] = [];

  // ── 1. RAYCASTS (10 values: 5 distances + 5 hit flags) ──
  const rayOriginY = ctx.carPos.y + 0.5; // slightly above ground to avoid self-hits

  for (const angle of AI_OBSERVATION_CONFIG.RAY_ANGLES) {
    // Rotate car forward by the ray angle
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dirX = ctx.carForward.x * cos - ctx.carForward.z * sin;
    const dirZ = ctx.carForward.x * sin + ctx.carForward.z * cos;

    _rayOrigin.x = ctx.carPos.x;
    _rayOrigin.y = rayOriginY;
    _rayOrigin.z = ctx.carPos.z;
    _rayDir.x = dirX;
    _rayDir.y = 0;
    _rayDir.z = dirZ;

    const ray = new RAPIER.Ray(_rayOrigin, _rayDir);
    const hit = ctx.world.castRay(
      ray,
      AI_OBSERVATION_CONFIG.RAY_MAX_DISTANCE,
      true, // solid
      undefined,
      undefined,
      undefined,
      undefined, // don't exclude any specific collider; we rely on ray origin being above chassis
    );

    if (hit !== null) {
      // Normalize distance to [0, 1] where 0 = touching wall, 1 = max distance
      const normalizedDist = hit.timeOfImpact / AI_OBSERVATION_CONFIG.RAY_MAX_DISTANCE;
      obs.push(normalizedDist);
      obs.push(1.0); // hit flag
    } else {
      obs.push(1.0); // max distance (nothing detected)
      obs.push(0.0); // no hit
    }
  }

  // ── 2. VEHICLE DYNAMICS (6 values) ──
  obs.push(clamp(ctx.forwardSpeed / AI_OBSERVATION_CONFIG.MAX_SPEED, -1, 1));
  obs.push(clamp(ctx.lateralSpeed / AI_OBSERVATION_CONFIG.MAX_SPEED, -1, 1));
  obs.push(clamp(ctx.angularVelocityY / AI_OBSERVATION_CONFIG.MAX_ANG_VEL, -1, 1));
  obs.push(clamp(ctx.steeringNormalized, -1, 1));
  obs.push(ctx.isDrifting ? 1.0 : -1.0);
  obs.push(ctx.nitroTank * 2 - 1); // [0,1] → [-1,1]

  // ── 3. TRACK CONTEXT (6 values) ──
  // Direction to next checkpoint (sin/cos components for smooth circular representation)
  const dx = ctx.nextCheckpointX - ctx.carPos.x;
  const dz = ctx.nextCheckpointZ - ctx.carPos.z;
  const dist = Math.sqrt(dx * dx + dz * dz) + 1e-6;
  const dirToCP_x = dx / dist;
  const dirToCP_z = dz / dist;

  // Angle between car forward and checkpoint direction
  // Using dot product (cos) and cross product (sin)
  const dotForward = ctx.carForward.x * dirToCP_x + ctx.carForward.z * dirToCP_z;
  const crossForward = ctx.carForward.x * dirToCP_z - ctx.carForward.z * dirToCP_x;
  obs.push(clamp(dotForward, -1, 1));  // cos(angle to checkpoint)
  obs.push(clamp(crossForward, -1, 1)); // sin(angle to checkpoint) — sign tells left/right

  // Distance to next checkpoint (normalized)
  obs.push(clamp(dist / AI_OBSERVATION_CONFIG.MAX_CP_DISTANCE, 0, 1) * 2 - 1);

  // Overall race progress [0, 1] → [-1, 1]
  const totalProgress = ctx.totalCheckpoints * ctx.totalLaps;
  const currentProgress = ctx.currentLap * ctx.totalCheckpoints + ctx.checkpointIndex;
  obs.push((currentProgress / Math.max(totalProgress, 1)) * 2 - 1);

  // Drift charge level normalized
  obs.push(ctx.driftChargeLevel / 3 * 2 - 1);

  // Speed relative to track alignment (are we going the right direction?)
  // Positive = moving toward checkpoint, negative = moving away
  const velocityAlignment = ctx.forwardSpeed > 0 ? dotForward : -1;
  obs.push(clamp(velocityAlignment, -1, 1));

  return obs;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
