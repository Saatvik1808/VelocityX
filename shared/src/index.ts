export type {
  Vec3Like,
  QuatLike,
  InputState,
  VehicleState,
  GamePhase,
} from './types.js';

export {
  PHYSICS,
  VEHICLE,
  WHEELS,
  WHEEL_POSITIONS,
  STEERING,
  ENGINE,
  CAMERA,
  RENDERING,
  TRACK_COLORS,
  TRACK,
  ENVIRONMENT,
  HUD_CONFIG,
  NETWORK,
  CHECKPOINTS,
  DRIFT_BOOST,
} from './constants.js';

export type {
  PlayerId,
  RoomId,
  RacePhase,
  PlayerSnapshot,
  PlayerInfo,
  RoomInfo,
  RoomSummary,
  RaceResult,
  ClientToServerEvents,
  ServerToClientEvents,
  LeaderboardEntry,
} from './protocol.js';

export type { VehicleDef } from './vehicles.js';
export { VEHICLES, VEHICLE_IDS, DEFAULT_VEHICLE_ID } from './vehicles.js';
