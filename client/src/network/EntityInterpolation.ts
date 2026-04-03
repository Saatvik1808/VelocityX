/**
 * LEARNING NOTE: Entity Interpolation for Remote Players
 *
 * We can't predict other players' movements (we don't know their input).
 * Instead, we buffer the last few server snapshots and render remote
 * cars slightly in the past (~100ms behind). We smoothly interpolate
 * between snapshots for smooth movement.
 *
 * Key concepts: snapshot buffer, render delay, lerp/slerp, smooth remote rendering
 */

import type { PlayerSnapshot, PlayerId } from '@neon-drift/shared';
import { NETWORK } from '@neon-drift/shared';

interface TimedSnapshot {
  time: number;
  snapshot: PlayerSnapshot;
}

export class EntityInterpolation {
  private buffers = new Map<PlayerId, TimedSnapshot[]>();
  private readonly maxBufferSize = 5;

  /** Add a new server snapshot for a player */
  addSnapshot(playerId: PlayerId, snapshot: PlayerSnapshot, serverTime: number): void {
    let buffer = this.buffers.get(playerId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(playerId, buffer);
    }

    buffer.push({ time: serverTime, snapshot });

    // Keep buffer small
    while (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }
  }

  /** Get interpolated state for a remote player */
  getInterpolatedState(playerId: PlayerId, currentTime: number): PlayerSnapshot | null {
    const buffer = this.buffers.get(playerId);
    if (!buffer || buffer.length < 2) return buffer?.[0]?.snapshot ?? null;

    // Render in the past (interpolation delay)
    const renderTime = currentTime - NETWORK.INTERPOLATION_DELAY;

    // Find two snapshots surrounding renderTime
    let before: TimedSnapshot | null = null;
    let after: TimedSnapshot | null = null;

    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i]!.time <= renderTime && buffer[i + 1]!.time >= renderTime) {
        before = buffer[i]!;
        after = buffer[i + 1]!;
        break;
      }
    }

    // If renderTime is past all snapshots, use the latest
    if (!before || !after) {
      return buffer[buffer.length - 1]!.snapshot;
    }

    // Interpolate between before and after
    const range = after.time - before.time;
    const t = range > 0 ? (renderTime - before.time) / range : 0;
    const a = before.snapshot;
    const b = after.snapshot;

    return {
      id: playerId,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      rx: a.rx + (b.rx - a.rx) * t,
      ry: a.ry + (b.ry - a.ry) * t,
      rz: a.rz + (b.rz - a.rz) * t,
      rw: a.rw + (b.rw - a.rw) * t,
      speed: a.speed + (b.speed - a.speed) * t,
      steering: a.steering + (b.steering - a.steering) * t,
    };
  }

  /** Remove a player's buffer (when they leave) */
  removePlayer(playerId: PlayerId): void {
    this.buffers.delete(playerId);
  }

  /** Get all tracked player IDs */
  getTrackedPlayers(): PlayerId[] {
    return Array.from(this.buffers.keys());
  }
}
