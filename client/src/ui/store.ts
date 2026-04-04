/**
 * LEARNING NOTE: Zustand State Management
 *
 * The game loop pushes values into this store each frame, and React
 * components subscribe to read them. This one-way flow (game -> store -> UI)
 * keeps the game loop decoupled from React's render cycle.
 *
 * Key concepts: global state, subscriptions, game-UI bridge
 */

import { create } from 'zustand';
import type { GamePhase } from '@neon-drift/shared';

interface GameStore {
  gamePhase: GamePhase;
  speed: number;
  fps: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  raceTime: number;
  playerWorldPos: { x: number; z: number };
  trackCenterlineSVG: string;
  isDrifting: boolean;
  boostLevel: number;
  boostActive: boolean;
  nitroTank: number;      // 0-1 percentage
  nitroActive: boolean;
  countdownSeconds: number;
  currentCheckpoint: number;
  totalCheckpoints: number;
  raceResults: import('@neon-drift/shared').RaceResult[];

  setGamePhase: (phase: GamePhase) => void;
  setSpeed: (speed: number) => void;
  setFps: (fps: number) => void;
  setLap: (lap: number) => void;
  setPosition: (pos: number) => void;
  setTotalRacers: (total: number) => void;
  setRaceTime: (time: number) => void;
  setPlayerWorldPos: (pos: { x: number; z: number }) => void;
  setTrackCenterlineSVG: (svg: string) => void;
  setIsDrifting: (drifting: boolean) => void;
  setBoostLevel: (level: number) => void;
  setBoostActive: (active: boolean) => void;
  setNitroTank: (pct: number) => void;
  setNitroActive: (active: boolean) => void;
  setCountdownSeconds: (s: number) => void;
  setCurrentCheckpoint: (cp: number) => void;
  setTotalCheckpoints: (total: number) => void;
  setRaceResults: (results: import('@neon-drift/shared').RaceResult[]) => void;
}

export const useGameStore = create<GameStore>()((set) => ({
  gamePhase: 'LOADING',
  speed: 0,
  fps: 0,
  lap: 1,
  totalLaps: 3,
  position: 1,
  totalRacers: 1,
  raceTime: 0,
  playerWorldPos: { x: 0, z: 0 },
  trackCenterlineSVG: '',
  isDrifting: false,
  boostLevel: 0,
  boostActive: false,
  nitroTank: 1,
  nitroActive: false,
  countdownSeconds: 0,
  currentCheckpoint: 0,
  totalCheckpoints: 0,
  raceResults: [],

  setGamePhase: (phase) => set({ gamePhase: phase }),
  setSpeed: (speed) => set({ speed }),
  setFps: (fps) => set({ fps }),
  setLap: (lap) => set({ lap }),
  setPosition: (position) => set({ position }),
  setTotalRacers: (totalRacers) => set({ totalRacers }),
  setRaceTime: (time) => set({ raceTime: time }),
  setPlayerWorldPos: (pos) => set({ playerWorldPos: pos }),
  setTrackCenterlineSVG: (svg) => set({ trackCenterlineSVG: svg }),
  setIsDrifting: (drifting) => set({ isDrifting: drifting }),
  setBoostLevel: (level: number) => set({ boostLevel: level }),
  setBoostActive: (active: boolean) => set({ boostActive: active }),
  setNitroTank: (pct: number) => set({ nitroTank: pct }),
  setNitroActive: (active: boolean) => set({ nitroActive: active }),
  setCountdownSeconds: (s: number) => set({ countdownSeconds: s }),
  setCurrentCheckpoint: (cp: number) => set({ currentCheckpoint: cp }),
  setTotalCheckpoints: (total: number) => set({ totalCheckpoints: total }),
  setRaceResults: (results: import('@neon-drift/shared').RaceResult[]) => set({ raceResults: results }),
}));
