/**
 * LEARNING NOTE: Core Type Definitions
 *
 * These types are shared between the client and server to ensure both sides
 * agree on data shapes. By keeping them in a separate package with zero
 * dependencies, we avoid pulling Three.js or Rapier into the server bundle.
 * Plain object interfaces (Vec3Like, QuatLike) are used instead of library
 * types so any math library can satisfy them.
 *
 * Key concepts: branded types, structural typing, shared protocol types
 */

/** A 3-component vector as a plain object (no library dependency). */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** A quaternion as a plain object (no library dependency). */
export interface QuatLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * The full input state captured each frame.
 * Phase 1 uses accelerate, brake, steerLeft, steerRight.
 * Drift and nitro are included for future phases.
 */
export interface InputState {
  accelerate: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  drift: boolean;
  nitro: boolean;
}

/**
 * A snapshot of a vehicle's physics state.
 * Uses plain objects so it can be serialized for networking (Phase 3).
 */
export interface VehicleState {
  position: Vec3Like;
  rotation: QuatLike;
  velocity: Vec3Like;
  /** Speed in m/s along the car's forward axis (positive = forward). */
  speed: number;
  /** Engine RPM for audio synthesis (Phase 5). */
  engineRpm: number;
}

/** High-level game phase for UI state management. */
export type GamePhase = 'LOADING' | 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'RACING' | 'RESULTS' | 'PAUSED';
