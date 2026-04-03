/**
 * LEARNING NOTE: GPU Particle System (Babylon.js)
 *
 * Babylon.js has a built-in GPUParticleSystem that runs entirely on the
 * GPU — no per-particle JavaScript updates needed. It handles thousands
 * of particles at 60fps. We wrap it to provide a simple emit/update API.
 *
 * Key concepts: GPUParticleSystem, particle textures, emission
 */

// Babylon.js GPUParticleSystem is used directly by emitters.
// This file is kept as a common interface definition.

export interface ParticleEmitOptions {
  positionX: number;
  positionY: number;
  positionZ: number;
  directionX: number;
  directionY: number;
  directionZ: number;
}
