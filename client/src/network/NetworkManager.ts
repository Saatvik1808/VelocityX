/**
 * LEARNING NOTE: Client Network Manager
 *
 * Wraps Socket.IO client connection. Handles connecting to the server,
 * sending input, receiving state updates, and room management.
 * All network events are typed via the shared protocol.
 *
 * Key concepts: Socket.IO client, typed events, connection lifecycle
 */

import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerId,
  RoomId,
  InputState,
  PlayerSnapshot,
  PlayerInfo,
  RoomInfo,
  RoomSummary,
} from '@neon-drift/shared';
import { NETWORK } from '@neon-drift/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class NetworkManager {
  private socket: TypedSocket | null = null;
  playerId: PlayerId | null = null;
  connected = false;
  currentRoom: RoomInfo | null = null;
  players: PlayerInfo[] = [];

  // Callbacks
  onStateUpdate: ((tick: number, players: PlayerSnapshot[]) => void) | null = null;
  onPlayerJoined: ((player: PlayerInfo) => void) | null = null;
  onPlayerLeft: ((playerId: PlayerId) => void) | null = null;
  onRoomJoined: ((room: RoomInfo, players: PlayerInfo[]) => void) | null = null;
  onCountdown: ((seconds: number) => void) | null = null;
  onRaceStart: (() => void) | null = null;
  onRoomList: ((rooms: RoomSummary[]) => void) | null = null;

  connect(): void {
    // In production: connect to same origin. In dev: connect to localhost:3001
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const url = isDev ? `http://localhost:${NETWORK.SERVER_PORT}` : window.location.origin;
    this.socket = io(url, { transports: ['websocket', 'polling'] }) as TypedSocket;

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.currentRoom = null;
      console.log('Disconnected from server');
    });

    this.socket.on('SERVER_ASSIGN_ID', (data) => {
      this.playerId = data.playerId;
    });

    this.socket.on('SERVER_STATE_UPDATE', (data) => {
      this.onStateUpdate?.(data.tick, data.players);
    });

    this.socket.on('SERVER_ROOM_JOINED', (data) => {
      this.currentRoom = data.room;
      this.players = data.players;
      this.onRoomJoined?.(data.room, data.players);
    });

    this.socket.on('SERVER_PLAYER_JOINED', (data) => {
      this.players.push(data.player);
      this.onPlayerJoined?.(data.player);
    });

    this.socket.on('SERVER_PLAYER_LEFT', (data) => {
      this.players = this.players.filter(p => p.id !== data.playerId);
      this.onPlayerLeft?.(data.playerId);
    });

    this.socket.on('SERVER_RACE_COUNTDOWN', (data) => {
      this.onCountdown?.(data.seconds);
    });

    this.socket.on('SERVER_RACE_START', () => {
      if (this.currentRoom) this.currentRoom.phase = 'RACING';
      this.onRaceStart?.();
    });

    this.socket.on('SERVER_ROOM_LIST', (data) => {
      this.onRoomList?.(data.rooms);
    });
  }

  sendInput(seq: number, input: InputState, pos?: { x: number; y: number; z: number; rx: number; ry: number; rz: number; rw: number; speed: number; steering: number }): void {
    this.socket?.emit('CLIENT_INPUT', {
      seq, input,
      pos: pos ?? { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, rw: 1, speed: 0, steering: 0 },
    });
  }

  createRoom(maxPlayers: number = 4, laps: number = 3): void {
    this.socket?.emit('CLIENT_CREATE_ROOM', { maxPlayers, laps });
  }

  joinRoom(roomId: RoomId, playerName: string): void {
    this.socket?.emit('CLIENT_JOIN_ROOM', { roomId, playerName });
  }

  setReady(): void {
    this.socket?.emit('CLIENT_READY');
  }

  listRooms(): void {
    this.socket?.emit('CLIENT_LIST_ROOMS');
  }

  leaveRoom(): void {
    this.socket?.emit('CLIENT_LEAVE_ROOM');
    this.currentRoom = null;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
  }
}
