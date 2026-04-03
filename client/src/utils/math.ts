/**
 * LEARNING NOTE: Math Utilities for Game Development
 *
 * Games constantly interpolate between values — camera position, UI elements,
 * physics state for rendering. These pure functions are the building blocks.
 * `smoothDamp` is especially important: it's a spring-damper system that
 * smoothly moves a value toward a target, used by cameras in almost every
 * 3D game (this is Unity's `Mathf.SmoothDamp` reimplemented).
 *
 * Key concepts: linear interpolation, clamping, spring-damper systems
 */

/** Linear interpolation between a and b by factor t (0..1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value to the range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Remap a value from one range to another. */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, t);
}

/** Convert degrees to radians. */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** Convert radians to degrees. */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Velocity container for smoothDamp — passed by reference so the function
 * can update it across frames.
 */
export interface SmoothDampVelocity {
  value: number;
}

/**
 * Smoothly move `current` toward `target` using a spring-damper system.
 * This is the standard "SmoothDamp" function used in Unity and other engines.
 *
 * @param current - Current value
 * @param target - Target value to approach
 * @param velocity - Mutable velocity state (persists across frames)
 * @param smoothTime - Approximate time to reach the target (seconds)
 * @param dt - Delta time for this frame
 * @param maxSpeed - Maximum speed (optional, defaults to Infinity)
 * @returns The new current value
 */
export function smoothDamp(
  current: number,
  target: number,
  velocity: SmoothDampVelocity,
  smoothTime: number,
  dt: number,
  maxSpeed: number = Infinity,
): number {
  // Clamp smoothTime to prevent division by zero
  const st = Math.max(0.0001, smoothTime);
  const omega = 2.0 / st;
  const x = omega * dt;
  // Approximation of exp(-x) that's fast and good enough for games
  const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);

  let delta = current - target;

  // Clamp maximum speed
  const maxDelta = maxSpeed * st;
  delta = clamp(delta, -maxDelta, maxDelta);
  const adjustedTarget = current - delta;

  const temp = (velocity.value + omega * delta) * dt;
  velocity.value = (velocity.value - omega * temp) * exp;

  let result = adjustedTarget + (delta + temp) * exp;

  // Prevent overshooting
  if ((target - current > 0) === (result > target)) {
    result = target;
    velocity.value = (result - target) / dt;
  }

  return result;
}
