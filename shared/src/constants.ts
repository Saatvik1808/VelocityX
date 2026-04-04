/**
 * LEARNING NOTE: Centralized Game Constants
 *
 * Every tuning value in the game lives here — never inline magic numbers.
 * This makes tweaking physics, camera, and gameplay a matter of changing
 * one file rather than hunting through dozens. During playtesting, this is
 * the file you'll iterate on most. Small changes to suspension stiffness
 * or engine force dramatically change how the car feels.
 *
 * Key concepts: single source of truth, const assertions, gameplay tuning
 */

import type { Vec3Like } from './types.js';

export const PHYSICS = {
  /** Fixed physics timestep in seconds (120Hz for smooth high-speed). */
  TIMESTEP: 1 / 120,
  /** Gravity vector. */
  GRAVITY: { x: 0, y: -9.81, z: 0 } satisfies Vec3Like,
} as const;

export const VEHICLE = {
  /** Half-extents of the chassis box collider (meters). */
  CHASSIS_HALF_EXTENTS: { x: 0.9, y: 0.4, z: 2.1 } satisfies Vec3Like,
  /** Total vehicle mass in kg. */
  CHASSIS_MASS: 1500,
  /** Lower the center of mass to prevent rollovers. */
  CENTER_OF_MASS_Y_OFFSET: -0.3,
} as const;

export const WHEELS = {
  /** Wheel radius in meters. */
  RADIUS: 0.35,
  /** Wheel visual width in meters. */
  WIDTH: 0.22,
  /** Suspension spring rest length. */
  SUSPENSION_REST_LENGTH: 0.3,
  /** Suspension spring stiffness (N/m). Softer = smoother ride, less jitter. */
  SUSPENSION_STIFFNESS: 25.0,
  /** Suspension compression damping. */
  SUSPENSION_COMPRESSION: 4.0,
  /** Suspension relaxation (rebound) damping. */
  SUSPENSION_RELAXATION: 3.0,
  /** Maximum suspension travel in meters. */
  MAX_SUSPENSION_TRAVEL: 0.2,
  /** Maximum force the suspension can exert. */
  MAX_SUSPENSION_FORCE: 6000.0,
  /** Friction slip for front wheels (higher = more grip for steering). */
  FRONT_FRICTION_SLIP: 2.5,
  /** Friction slip for rear wheels (lower = allows oversteer/drift). */
  REAR_FRICTION_SLIP: 2.0,
} as const;

/**
 * Wheel connection points relative to the chassis center.
 * Order: front-left, front-right, rear-left, rear-right.
 */
export const WHEEL_POSITIONS: readonly Vec3Like[] = [
  { x: -(VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), y: -0.2, z: VEHICLE.CHASSIS_HALF_EXTENTS.z - 0.3 },  // FL
  { x: (VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), y: -0.2, z: VEHICLE.CHASSIS_HALF_EXTENTS.z - 0.3 },   // FR
  { x: -(VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), y: -0.2, z: -VEHICLE.CHASSIS_HALF_EXTENTS.z + 0.4 }, // RL
  { x: (VEHICLE.CHASSIS_HALF_EXTENTS.x + 0.15), y: -0.2, z: -VEHICLE.CHASSIS_HALF_EXTENTS.z + 0.4 },  // RR
] as const;

export const STEERING = {
  /** Maximum steering angle in radians (~40 degrees). */
  MAX_ANGLE: Math.PI / 4.5,
  /** How fast steering input applies (radians/sec). */
  SPEED: 10.0,
  /** How fast steering returns to center when no input (radians/sec). */
  RETURN_SPEED: 8.0,
  /** Speed (m/s) at which steering starts reducing. */
  SPEED_SENSITIVE_START: 20,
  /** Minimum steering multiplier at top speed. */
  SPEED_SENSITIVE_MIN: 0.4,
  /** Speed (m/s) at which steering reaches its minimum multiplier. */
  SPEED_SENSITIVE_FULL: 55,
  /** Angular damping on the chassis. Lower = smoother turns. */
  ANGULAR_DAMPING: 2.0,
} as const;

export const ENGINE = {
  /** Maximum engine force applied to drive wheels (Newtons). */
  MAX_FORCE: 12000.0,
  /** Brake impulse per wheel. */
  BRAKE_FORCE: 100.0,
  /** Engine force when reversing. */
  REVERSE_FORCE: 3000.0,
  /** Rolling resistance when no input (slight deceleration). */
  ROLLING_RESISTANCE: 4.0,
  /** Top speed in km/h (used for HUD, not enforced by physics). */
  MAX_SPEED_KMH: 250,
} as const;

export const CAMERA = {
  /** Distance behind the car in meters. */
  DISTANCE: 10.0,
  /** Height above the car in meters. */
  HEIGHT: 4.5,
  /** Spring stiffness for position smoothing. Lower = smoother follow. */
  STIFFNESS: 7.0,
  /** Damping ratio for position smoothing. */
  DAMPING: 0.95,
  /** FOV (degrees) — fixed, no zoom. */
  FOV_MIN: 60,
  FOV_MAX: 60,
  /** Speed range (m/s) over which FOV interpolates. */
  FOV_SPEED_RANGE: [0, 50] as readonly [number, number],
  /** Look-ahead distance along car forward vector (meters). */
  LOOK_AHEAD: 5.0,
  /** Smoothing time for camera rotation (seconds). Higher = smoother. */
  ROTATION_SMOOTHING: 0.14,
} as const;

export const RENDERING = {
  BLOOM_STRENGTH: 0.3,
  BLOOM_RADIUS: 0.3,
  BLOOM_THRESHOLD: 0.85,
  FILM_GRAIN_INTENSITY: 0.0,
  VIGNETTE_INTENSITY: 0.2,
  CHROMATIC_ABERRATION_MAX: 0.001,
  CHROMATIC_ABERRATION_SPEED_RANGE: [0, 50] as readonly [number, number],
  COLOR_TINT_STRENGTH: 0.03,
} as const;

export const TRACK_COLORS = {
  CURB_CYAN: 0x00ffff,
  CURB_MAGENTA: 0xff00ff,
  BARRIER_NEON: 0x00ffff,
  START_FINISH: 0x111111,
  START_FINISH_EMISSIVE: 0x00ffff,
  START_FINISH_EMISSIVE_INTENSITY: 1.5,
  STREETLIGHT_COLOR: 0x00ffff,
  STREETLIGHT_INTENSITY: 5.0,
  STREETLIGHT_DISTANCE: 50,
  STREETLIGHT_DECAY: 1.5,
  STREETLIGHT_POLE_COLOR: 0x111111,
} as const;

export const TRACK = {
  /** Length of each straight section in meters. */
  STRAIGHT_LENGTH: 200,
  /** Radius of each semicircular curve in meters. */
  CURVE_RADIUS: 60,
  /** Total road width in meters. */
  ROAD_WIDTH: 28,
  /** Height of track boundary walls in meters. */
  WALL_HEIGHT: 2.0,
  /** Thickness of track boundary walls in meters. */
  WALL_THICKNESS: 0.5,
  /** Number of segments to approximate each semicircle. */
  CURVE_SEGMENTS: 32,
} as const;

export const ENVIRONMENT = {
  BUILDING_COUNT: 120,
  TREE_COUNT: 60,
  BRIDGE_HEIGHT: 8.0,
  BRIDGE_WIDTH: 12.0,
  RIVER_LENGTH: 180,
  RIVER_WIDTH: 30,
  MOUNTAIN_COUNT: 7,
  FOG_DENSITY: 0.0008,
} as const;

export const HUD_CONFIG = {
  TOTAL_LAPS: 3,
  TOTAL_RACERS: 1,
  MAX_SPEED_KMH: 250,
} as const;

export const NETWORK = {
  /** Client sends input at this rate (Hz). */
  CLIENT_TICK_RATE: 60,
  /** Server broadcasts state at this rate (Hz). */
  SERVER_TICK_RATE: 20,
  /** Delay for entity interpolation (ms). */
  INTERPOLATION_DELAY: 100,
  /** Max players per room. */
  MAX_PLAYERS: 8,
  /** Input buffer size (frames stored for replay). */
  INPUT_BUFFER_SIZE: 240,
  /** Position tolerance for reconciliation (meters). */
  RECONCILIATION_TOLERANCE: 0.5,
  /** Server port. */
  SERVER_PORT: 3001,
  /** Countdown seconds before race start. */
  COUNTDOWN_SECONDS: 3,
} as const;

export const CHECKPOINTS = {
  RADIUS: 15,
  TOTAL_LAPS: 3,
} as const;

export const DRIFT_BOOST = {
  DRIFT_ANGLE_THRESHOLD: Math.PI / 6,
  /** Charge times — how long you must hold drift to reach each level */
  LEVEL_1_TIME: 0.2,
  LEVEL_1_DURATION: 1.2,
  LEVEL_1_MULTIPLIER: 0.35,
  LEVEL_2_TIME: 0.8,
  LEVEL_2_DURATION: 2.0,
  LEVEL_2_MULTIPLIER: 0.6,
  LEVEL_3_TIME: 1.8,
  LEVEL_3_DURATION: 3.0,
  LEVEL_3_MULTIPLIER: 1.0,
} as const;
