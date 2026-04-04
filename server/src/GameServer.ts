/**
 * LEARNING NOTE: Game Server (Express + Socket.IO)
 *
 * The server handles player connections, room management, and state
 * broadcasting. Socket.IO provides WebSocket communication with
 * automatic fallback to HTTP long-polling.
 *
 * The server runs a 20Hz tick loop broadcasting all player positions
 * to everyone in the same room. This is the "authoritative server"
 * pattern — the server decides the truth.
 *
 * Key concepts: WebSocket server, room-based multiplayer, state broadcast
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerId,
  RoomId,
} from '@neon-drift/shared';
import { NETWORK } from '@neon-drift/shared';
import { RoomManager } from './RoomManager.js';
import { PlayerState } from './PlayerState.js';
import { RaceStateMachine } from './RaceStateMachine.js';
import { Persistence } from './Persistence.js';

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();
const raceStateMachine = new RaceStateMachine(io);
const persistence = new Persistence();

// Serve client build files in production
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', players: io.engine.clientsCount }));

// REST API: Leaderboard (accessible without WebSocket)
app.get('/api/leaderboard', (_req, res) => {
  const limit = parseInt(String(_req.query.limit)) || 10;
  const entries = persistence.getTopTimes(Math.min(limit, 50));
  res.json({ entries, totalRaces: persistence.getRaceCount() });
});

// Self-ping to prevent Render free tier spin-down (every 4 minutes)
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(`${process.env.RENDER_EXTERNAL_URL}/health`).catch(() => {});
  }, 4 * 60 * 1000);
}

// SPA fallback — serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(join(clientDist, 'index.html'));
});

// === Socket.IO Connection Handling ===
io.on('connection', (socket) => {
  const playerId = socket.id as PlayerId;
  console.log(`Player connected: ${playerId}`);

  // Assign ID to client
  socket.emit('SERVER_ASSIGN_ID', { playerId });

  // === Room Events ===

  socket.on('CLIENT_CREATE_ROOM', (data) => {
    const room = roomManager.createRoom(data.maxPlayers, data.laps);
    const player = new PlayerState(playerId, `Player ${playerId.slice(0, 4)}`);
    roomManager.joinRoom(room.id, player);
    socket.join(room.id);

    socket.emit('SERVER_ROOM_JOINED', {
      room: { id: room.id, trackId: 'figure8', maxPlayers: room.maxPlayers, laps: room.laps, phase: room.phase },
      players: [player.toInfo()],
    });

    console.log(`Room ${room.id} created by ${playerId}`);
  });

  socket.on('CLIENT_JOIN_ROOM', (data) => {
    const player = new PlayerState(playerId, data.playerName || `Player ${playerId.slice(0, 4)}`);
    const room = roomManager.joinRoom(data.roomId, player);

    if (!room) {
      socket.emit('SERVER_ERROR', { message: 'Room not found or full' });
      return;
    }

    socket.join(room.id);

    // Tell the joining player about the room
    const players = Array.from(room.players.values()).map(p => p.toInfo());
    socket.emit('SERVER_ROOM_JOINED', {
      room: { id: room.id, trackId: 'figure8', maxPlayers: room.maxPlayers, laps: room.laps, phase: room.phase },
      players,
    });

    // Tell existing players about the new player
    socket.to(room.id).emit('SERVER_PLAYER_JOINED', { player: player.toInfo() });

    console.log(`Player ${playerId} joined room ${room.id} (${room.players.size}/${room.maxPlayers})`);
  });

  socket.on('CLIENT_LEAVE_ROOM', () => {
    const room = roomManager.leaveRoom(playerId);
    if (room) {
      socket.leave(room.id);
      io.to(room.id).emit('SERVER_PLAYER_LEFT', { playerId });
    }
  });

  socket.on('CLIENT_LIST_ROOMS', () => {
    socket.emit('SERVER_ROOM_LIST', { rooms: roomManager.listRooms() });
  });

  socket.on('CLIENT_READY', () => {
    const room = roomManager.getPlayerRoom(playerId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (player) {
      player.ready = true;
      raceStateMachine.checkAllReady(room);
    }
  });

  // === Game Input ===

  socket.on('CLIENT_INPUT', (data) => {
    const room = roomManager.getPlayerRoom(playerId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    // Store the client's reported position
    player.applyClientInput(data.seq, data.input, data.pos);
  });

  socket.on('CLIENT_CHECKPOINT_HIT', (data) => {
    const room = roomManager.getPlayerRoom(playerId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;

    player.currentCheckpoint = data.checkpointIndex;
    player.currentLap = data.lapNumber;
  });

  socket.on('CLIENT_FINISHED', (data) => {
    const room = roomManager.getPlayerRoom(playerId);
    if (!room) return;

    // Save to leaderboard database
    const player = room.players.get(playerId);
    const playerName = player?.name ?? `Player ${playerId.slice(0, 4)}`;
    const vehicleId = data.vehicleId ?? 'ronin';
    persistence.saveRaceTime(playerName, vehicleId, room.laps, data.time);

    raceStateMachine.playerFinished(room, playerId, data.time);
  });

  socket.on('CLIENT_GET_LEADERBOARD', (data) => {
    const limit = data?.limit ?? 10;
    const entries = persistence.getTopTimes(Math.min(limit, 50));
    socket.emit('SERVER_LEADERBOARD', { entries });
  });

  // === Disconnect ===

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${playerId}`);
    const room = roomManager.leaveRoom(playerId);
    if (room) {
      io.to(room.id).emit('SERVER_PLAYER_LEFT', { playerId });
    }
  });
});

// === Server State Broadcasting (20Hz) ===
const TICK_INTERVAL = 1000 / NETWORK.SERVER_TICK_RATE;

setInterval(() => {
  // Broadcast state for ALL rooms with players (not just RACING)
  for (const room of roomManager.listRooms().map(s => roomManager.getRoom(s.id)).filter(Boolean) as import('./RoomManager.js').Room[]) {
    room.tick++;

    const players = Array.from(room.players.values()).map(p => p.toSnapshot());
    io.to(room.id).emit('SERVER_STATE_UPDATE', { tick: room.tick, players });
  }
}, TICK_INTERVAL);

// === Start Server ===
const PORT = process.env.PORT ? parseInt(process.env.PORT) : NETWORK.SERVER_PORT;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`VelocityX server running on port ${PORT}`);
});
