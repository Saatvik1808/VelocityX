/**
 * LEARNING NOTE: Per-Player Server State
 *
 * Each connected player has a state object on the server tracking their
 * position, input, and connection status. The server trusts client
 * position reports initially (client-authoritative) and validates later.
 *
 * Key concepts: server state, client authority, connection management
 */

import type { PlayerId, PlayerSnapshot, PlayerInfo, InputState } from '@neon-drift/shared';

export class PlayerState {
  readonly id: PlayerId;
  name: string;
  ready = false;
  connected = true;
  disconnectTime = 0;

  // Physics state (from client reports)
  x = 0; y = 0; z = 0;
  rx = 0; ry = 0; rz = 0; rw = 1;
  speed = 0;
  steering = 0;

  // Last input received
  lastInput: InputState = {
    accelerate: false, brake: false,
    steerLeft: false, steerRight: false,
    drift: false, nitro: false,
  };
  lastSeq = 0;

  // Race progress
  currentLap = 1;
  currentCheckpoint = 0;
  finishTime = 0;
  finished = false;

  constructor(id: PlayerId, name: string) {
    this.id = id;
    this.name = name;
  }

  applyClientInput(seq: number, input: InputState, snapshot: { x: number; y: number; z: number; rx: number; ry: number; rz: number; rw: number; speed: number; steering: number }): void {
    this.lastSeq = seq;
    this.lastInput = input;
    this.x = snapshot.x;
    this.y = snapshot.y;
    this.z = snapshot.z;
    this.rx = snapshot.rx;
    this.ry = snapshot.ry;
    this.rz = snapshot.rz;
    this.rw = snapshot.rw;
    this.speed = snapshot.speed;
    this.steering = snapshot.steering;
  }

  toSnapshot(): PlayerSnapshot {
    return {
      id: this.id,
      x: this.x, y: this.y, z: this.z,
      rx: this.rx, ry: this.ry, rz: this.rz, rw: this.rw,
      speed: this.speed, steering: this.steering,
    };
  }

  toInfo(): PlayerInfo {
    return { id: this.id, name: this.name, ready: this.ready };
  }
}
