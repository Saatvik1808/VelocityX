/**
 * LEARNING NOTE: Race State Machine
 *
 * The race progresses through phases: LOBBY → COUNTDOWN → RACING → RESULTS.
 * The server is authoritative — only the server transitions between phases.
 * All players must be ready before countdown starts.
 *
 * Key concepts: finite state machine, server authority, game state transitions
 */

import type { Room } from './RoomManager.js';
import type { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, PlayerId, RaceResult } from '@neon-drift/shared';
import { NETWORK } from '@neon-drift/shared';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export class RaceStateMachine {
  private io: IO;
  private countdownIntervals = new Map<string, ReturnType<typeof setInterval>>();

  constructor(io: IO) {
    this.io = io;
  }

  checkAllReady(room: Room): void {
    if (room.phase !== 'LOBBY') return;
    if (room.players.size < 1) return; // need at least 1 player

    let allReady = true;
    for (const player of room.players.values()) {
      if (!player.ready) { allReady = false; break; }
    }

    if (allReady) {
      this.startCountdown(room);
    }
  }

  private startCountdown(room: Room): void {
    room.phase = 'COUNTDOWN';
    let seconds = NETWORK.COUNTDOWN_SECONDS;

    this.io.to(room.id).emit('SERVER_RACE_COUNTDOWN', { seconds });

    const interval = setInterval(() => {
      seconds--;
      if (seconds > 0) {
        this.io.to(room.id).emit('SERVER_RACE_COUNTDOWN', { seconds });
      } else {
        clearInterval(interval);
        this.countdownIntervals.delete(room.id);
        this.startRace(room);
      }
    }, 1000);

    this.countdownIntervals.set(room.id, interval);
  }

  private startRace(room: Room): void {
    room.phase = 'RACING';
    room.tick = 0;
    this.io.to(room.id).emit('SERVER_RACE_START', { serverTimestamp: Date.now() });
  }

  playerFinished(room: Room, playerId: PlayerId, time: number): void {
    const player = room.players.get(playerId);
    if (!player || player.finished) return;

    player.finished = true;
    player.finishTime = time;

    // Check if all finished
    let allFinished = true;
    for (const p of room.players.values()) {
      if (!p.finished) { allFinished = false; break; }
    }

    if (allFinished) {
      this.endRace(room);
    }
  }

  endRace(room: Room): void {
    room.phase = 'RESULTS';

    const results: RaceResult[] = [];
    for (const p of room.players.values()) {
      results.push({
        id: p.id, name: p.name,
        time: p.finishTime || 999999,
        position: 0,
      });
    }
    results.sort((a, b) => a.time - b.time);
    results.forEach((r, i) => r.position = i + 1);

    this.io.to(room.id).emit('SERVER_RACE_FINISH', { results });

    // Return to lobby after 10 seconds
    setTimeout(() => {
      room.phase = 'LOBBY';
      for (const p of room.players.values()) {
        p.ready = false;
        p.finished = false;
        p.finishTime = 0;
      }
    }, 10000);
  }

  dispose(): void {
    for (const interval of this.countdownIntervals.values()) {
      clearInterval(interval);
    }
  }
}
