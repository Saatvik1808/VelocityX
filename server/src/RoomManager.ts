/**
 * LEARNING NOTE: Room Management
 *
 * Players race in rooms (lobbies). Each room tracks its players,
 * race phase, and settings. The server manages room lifecycle:
 * create, join, leave, auto-delete when empty.
 *
 * Key concepts: room-based multiplayer, lobby system, player management
 */

import type { PlayerId, RoomId, RacePhase, RoomInfo, RoomSummary } from '@neon-drift/shared';
import { NETWORK } from '@neon-drift/shared';
import { PlayerState } from './PlayerState.js';

export interface Room {
  id: RoomId;
  players: Map<PlayerId, PlayerState>;
  maxPlayers: number;
  laps: number;
  phase: RacePhase;
  tick: number;
  countdownTimer: number;
}

export class RoomManager {
  private rooms = new Map<RoomId, Room>();
  private playerRooms = new Map<PlayerId, RoomId>(); // track which room each player is in

  createRoom(maxPlayers: number, laps: number): Room {
    const id = this.generateId();
    const room: Room = {
      id,
      players: new Map(),
      maxPlayers: Math.min(maxPlayers, NETWORK.MAX_PLAYERS),
      laps,
      phase: 'LOBBY',
      tick: 0,
      countdownTimer: 0,
    };
    this.rooms.set(id, room);
    return room;
  }

  joinRoom(roomId: RoomId, player: PlayerState): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.size >= room.maxPlayers) return null;
    if (room.phase !== 'LOBBY') return null;

    room.players.set(player.id, player);
    this.playerRooms.set(player.id, roomId);
    return room;
  }

  leaveRoom(playerId: PlayerId): Room | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.players.delete(playerId);
    this.playerRooms.delete(playerId);

    // Auto-delete empty rooms
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    return room;
  }

  getRoom(roomId: RoomId): Room | null {
    return this.rooms.get(roomId) ?? null;
  }

  getPlayerRoom(playerId: PlayerId): Room | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;
    return this.rooms.get(roomId) ?? null;
  }

  listRooms(): RoomSummary[] {
    const summaries: RoomSummary[] = [];
    for (const room of this.rooms.values()) {
      summaries.push({
        id: room.id,
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        phase: room.phase,
      });
    }
    return summaries;
  }

  getRacingRooms(): Room[] {
    const racing: Room[] = [];
    for (const room of this.rooms.values()) {
      if (room.phase === 'RACING') racing.push(room);
    }
    return racing;
  }

  private generateId(): RoomId {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id as RoomId;
  }
}
