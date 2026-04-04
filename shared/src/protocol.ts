/**
 * LEARNING NOTE: Network Protocol Definition
 *
 * All Socket.IO events and their payload types are defined here.
 * Both client and server import these — ensuring type safety across
 * the network boundary. Events use SCREAMING_SNAKE_CASE.
 *
 * Key concepts: typed events, client-server protocol, payload types
 */

import type { InputState } from './types.js';

// === Branded ID types ===
export type PlayerId = string & { __brand: 'PlayerId' };
export type RoomId = string & { __brand: 'RoomId' };

// === Race Phase ===
export type RacePhase = 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'RESULTS';

// === Player Snapshot (sent 20x/sec from server) ===
export interface PlayerSnapshot {
  id: PlayerId;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  rw: number;
  speed: number;
  steering: number;
}

// === Room Info ===
export interface PlayerInfo {
  id: PlayerId;
  name: string;
  ready: boolean;
}

export interface RoomInfo {
  id: RoomId;
  trackId: string;
  maxPlayers: number;
  laps: number;
  phase: RacePhase;
}

export interface RoomSummary {
  id: RoomId;
  playerCount: number;
  maxPlayers: number;
  phase: RacePhase;
}

export interface RaceResult {
  id: PlayerId;
  name: string;
  time: number;
  position: number;
}

// === Client → Server Events ===
export interface ClientToServerEvents {
  CLIENT_INPUT: (data: {
    seq: number;
    input: InputState;
    pos: { x: number; y: number; z: number; rx: number; ry: number; rz: number; rw: number; speed: number; steering: number };
  }) => void;
  CLIENT_JOIN_ROOM: (data: { roomId: RoomId; playerName: string }) => void;
  CLIENT_CREATE_ROOM: (data: { maxPlayers: number; laps: number }) => void;
  CLIENT_READY: () => void;
  CLIENT_LIST_ROOMS: () => void;
  CLIENT_LEAVE_ROOM: () => void;
  CLIENT_CHECKPOINT_HIT: (data: { checkpointIndex: number; lapNumber: number }) => void;
  CLIENT_FINISHED: (data: { time: number; vehicleId: string }) => void;
  CLIENT_GET_LEADERBOARD: (data: { limit?: number }) => void;
}

// === Server → Client Events ===
export interface ServerToClientEvents {
  SERVER_STATE_UPDATE: (data: { tick: number; players: PlayerSnapshot[] }) => void;
  SERVER_ROOM_JOINED: (data: { room: RoomInfo; players: PlayerInfo[] }) => void;
  SERVER_PLAYER_JOINED: (data: { player: PlayerInfo }) => void;
  SERVER_PLAYER_LEFT: (data: { playerId: PlayerId }) => void;
  SERVER_RACE_COUNTDOWN: (data: { seconds: number }) => void;
  SERVER_RACE_START: (data: { serverTimestamp: number }) => void;
  SERVER_RACE_FINISH: (data: { results: RaceResult[] }) => void;
  SERVER_ROOM_LIST: (data: { rooms: RoomSummary[] }) => void;
  SERVER_ASSIGN_ID: (data: { playerId: PlayerId }) => void;
  SERVER_POSITION_UPDATE: (data: { positions: Array<{ playerId: PlayerId; position: number; lap: number }> }) => void;
  SERVER_LEADERBOARD: (data: { entries: LeaderboardEntry[] }) => void;
  SERVER_ERROR: (data: { message: string }) => void;
}

/** Leaderboard entry from the server database */
export interface LeaderboardEntry {
  id: number;
  name: string;
  vehicleId: string;
  laps: number;
  time: number;
  date: string;
}
