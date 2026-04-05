/**
 * LEARNING NOTE: Predictive Interpolation — ML-Enhanced Multiplayer Smoothing
 *
 * Standard entity interpolation renders remote players ~100ms in the past.
 * But when a network packet is late (jitter), we have NO future data and
 * the remote car freezes or snaps. Predictive interpolation solves this:
 *
 * 1. From the last 3+ snapshots, compute velocity AND acceleration
 * 2. When we need to extrapolate (no future snapshot), use kinematic
 *    equations: pos = pos0 + vel*t + 0.5*accel*t²
 * 3. When the real snapshot arrives, smoothly correct toward it
 *
 * This is similar to how Rocket League handles high-latency situations.
 * The prediction is physics-aware: it follows kinematic motion instead of
 * naive linear extrapolation, so curved paths are handled better.
 *
 * Key concepts: extrapolation, kinematic prediction, error correction, jitter buffer
 */

export interface PredictiveSnapshot {
  timestamp: number;
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number; rw: number;
  speed: number;
  steering: number;
  // Derived (computed, not from network)
  vx?: number; vy?: number; vz?: number;
  angVelY?: number;
}

interface PlayerBuffer {
  snapshots: PredictiveSnapshot[];
  /** Estimated velocity from recent snapshots */
  velocity: { x: number; y: number; z: number };
  /** Estimated acceleration from recent snapshots */
  acceleration: { x: number; y: number; z: number };
  /** Angular velocity around Y axis (for rotation prediction) */
  angularVelocityY: number;
  /** Correction state for smooth error correction */
  correctionOffset: { x: number; y: number; z: number };
  correctionDecay: number;
}

const MAX_SNAPSHOTS = 8;
const INTERPOLATION_DELAY_MS = 100;
const MAX_EXTRAPOLATION_MS = 200;
const CORRECTION_DECAY_RATE = 8; // exponential decay speed

export class PredictiveInterpolation {
  private players = new Map<string, PlayerBuffer>();

  /** Add a new server snapshot for a player */
  addSnapshot(playerId: string, snapshot: PredictiveSnapshot): void {
    let buffer = this.players.get(playerId);
    if (!buffer) {
      buffer = {
        snapshots: [],
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        angularVelocityY: 0,
        correctionOffset: { x: 0, y: 0, z: 0 },
        correctionDecay: 0,
      };
      this.players.set(playerId, buffer);
    }

    const snaps = buffer.snapshots;
    snaps.push(snapshot);

    // Keep only recent snapshots
    while (snaps.length > MAX_SNAPSHOTS) {
      snaps.shift();
    }

    // ── Compute velocity from last 2 snapshots ──
    if (snaps.length >= 2) {
      const s1 = snaps[snaps.length - 2]!;
      const s2 = snaps[snaps.length - 1]!;
      const dt = (s2.timestamp - s1.timestamp) / 1000;
      if (dt > 0.001) {
        const newVel = {
          x: (s2.x - s1.x) / dt,
          y: (s2.y - s1.y) / dt,
          z: (s2.z - s1.z) / dt,
        };

        // ── Compute acceleration from velocity change ──
        if (snaps.length >= 3) {
          const s0 = snaps[snaps.length - 3]!;
          const dt0 = (s1.timestamp - s0.timestamp) / 1000;
          if (dt0 > 0.001) {
            const oldVel = {
              x: (s1.x - s0.x) / dt0,
              y: (s1.y - s0.y) / dt0,
              z: (s1.z - s0.z) / dt0,
            };
            const avgDt = (dt + dt0) * 0.5;
            buffer.acceleration = {
              x: (newVel.x - oldVel.x) / avgDt,
              y: (newVel.y - oldVel.y) / avgDt,
              z: (newVel.z - oldVel.z) / avgDt,
            };
          }
        }

        buffer.velocity = newVel;

        // ── Compute angular velocity (yaw) from quaternion difference ──
        // Simplified: extract yaw from quaternion and differentiate
        const yaw1 = quaternionToYaw(s1.rx, s1.ry, s1.rz, s1.rw);
        const yaw2 = quaternionToYaw(s2.rx, s2.ry, s2.rz, s2.rw);
        let yawDiff = yaw2 - yaw1;
        // Wrap to [-PI, PI]
        while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
        while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
        buffer.angularVelocityY = yawDiff / dt;
      }
    }

    // ── Calculate correction offset ──
    // If we were predicting and the new snapshot arrives, compute how far off we were
    // This offset will decay smoothly to zero over the next few frames
    if (snaps.length >= 2) {
      const prev = snaps[snaps.length - 2]!;
      const curr = snaps[snaps.length - 1]!;
      const predictDt = (curr.timestamp - prev.timestamp) / 1000;

      // What we WOULD have predicted
      const predicted = {
        x: prev.x + buffer.velocity.x * predictDt + 0.5 * buffer.acceleration.x * predictDt * predictDt,
        y: prev.y + buffer.velocity.y * predictDt + 0.5 * buffer.acceleration.y * predictDt * predictDt,
        z: prev.z + buffer.velocity.z * predictDt + 0.5 * buffer.acceleration.z * predictDt * predictDt,
      };

      // Error between prediction and reality
      buffer.correctionOffset = {
        x: predicted.x - curr.x,
        y: predicted.y - curr.y,
        z: predicted.z - curr.z,
      };
      buffer.correctionDecay = 1.0; // start decaying
    }
  }

  /**
   * Get the interpolated/predicted state for a player at the current time.
   * Returns null if no data available.
   */
  getInterpolatedState(
    playerId: string,
    currentTime: number,
    dt: number = 1 / 60,
  ): PredictiveSnapshot | null {
    const buffer = this.players.get(playerId);
    if (!buffer || buffer.snapshots.length === 0) return null;

    const renderTime = currentTime - INTERPOLATION_DELAY_MS;
    const snaps = buffer.snapshots;

    // ── Case 1: Standard interpolation (between two known snapshots) ──
    for (let i = 0; i < snaps.length - 1; i++) {
      const s1 = snaps[i]!;
      const s2 = snaps[i + 1]!;
      if (renderTime >= s1.timestamp && renderTime <= s2.timestamp) {
        const t = (renderTime - s1.timestamp) / (s2.timestamp - s1.timestamp);
        return this.lerpSnapshots(s1, s2, t, buffer, dt);
      }
    }

    // ── Case 2: Extrapolation (render time is past all known snapshots) ──
    const latest = snaps[snaps.length - 1]!;
    const extrapolateMs = renderTime - latest.timestamp;

    if (extrapolateMs > 0 && extrapolateMs < MAX_EXTRAPOLATION_MS) {
      const t = extrapolateMs / 1000; // to seconds
      const confidence = 1 - (extrapolateMs / MAX_EXTRAPOLATION_MS);

      // Kinematic prediction: pos = pos0 + vel*t + 0.5*accel*t²
      const predX = latest.x + buffer.velocity.x * t + 0.5 * buffer.acceleration.x * t * t;
      const predY = latest.y + buffer.velocity.y * t + 0.5 * buffer.acceleration.y * t * t;
      const predZ = latest.z + buffer.velocity.z * t + 0.5 * buffer.acceleration.z * t * t;

      // Blend prediction with last known position based on confidence
      const x = lerp(latest.x, predX, confidence);
      const y = lerp(latest.y, predY, confidence);
      const z = lerp(latest.z, predZ, confidence);

      // Predict rotation using angular velocity
      const yaw = quaternionToYaw(latest.rx, latest.ry, latest.rz, latest.rw);
      const predictedYaw = yaw + buffer.angularVelocityY * t * confidence;
      const [rx, ry, rz, rw] = yawToQuaternion(predictedYaw);

      // Apply decaying correction offset
      const cx = buffer.correctionOffset.x * buffer.correctionDecay;
      const cy = buffer.correctionOffset.y * buffer.correctionDecay;
      const cz = buffer.correctionOffset.z * buffer.correctionDecay;
      buffer.correctionDecay *= Math.exp(-CORRECTION_DECAY_RATE * dt);

      return {
        timestamp: renderTime,
        x: x - cx,
        y: y - cy,
        z: z - cz,
        rx, ry, rz, rw,
        speed: latest.speed,
        steering: latest.steering,
      };
    }

    // ── Case 3: Too far in the past or future — return latest known ──
    // Decay correction
    buffer.correctionDecay *= Math.exp(-CORRECTION_DECAY_RATE * dt);
    return latest;
  }

  /** Standard linear interpolation between two snapshots */
  private lerpSnapshots(
    s1: PredictiveSnapshot,
    s2: PredictiveSnapshot,
    t: number,
    buffer: PlayerBuffer,
    dt: number,
  ): PredictiveSnapshot {
    // Decay correction offset
    buffer.correctionDecay *= Math.exp(-CORRECTION_DECAY_RATE * dt);
    const cx = buffer.correctionOffset.x * buffer.correctionDecay;
    const cy = buffer.correctionOffset.y * buffer.correctionDecay;
    const cz = buffer.correctionOffset.z * buffer.correctionDecay;

    return {
      timestamp: lerp(s1.timestamp, s2.timestamp, t),
      x: lerp(s1.x, s2.x, t) - cx,
      y: lerp(s1.y, s2.y, t) - cy,
      z: lerp(s1.z, s2.z, t) - cz,
      rx: lerp(s1.rx, s2.rx, t),
      ry: lerp(s1.ry, s2.ry, t),
      rz: lerp(s1.rz, s2.rz, t),
      rw: lerp(s1.rw, s2.rw, t),
      speed: lerp(s1.speed, s2.speed, t),
      steering: lerp(s1.steering, s2.steering, t),
    };
  }

  /** Remove a player's buffer when they disconnect */
  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  /** Clear all data */
  clear(): void {
    this.players.clear();
  }
}

// ── Math helpers ──

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function quaternionToYaw(x: number, y: number, z: number, w: number): number {
  // Extract yaw (rotation around Y axis) from quaternion
  return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
}

function yawToQuaternion(yaw: number): [number, number, number, number] {
  // Create quaternion from yaw rotation around Y axis
  const halfYaw = yaw * 0.5;
  return [0, Math.sin(halfYaw), 0, Math.cos(halfYaw)];
}
