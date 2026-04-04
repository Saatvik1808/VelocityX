/**
 * LEARNING NOTE: Vehicle Stat Definitions
 *
 * Each vehicle has different stats that affect physics tuning. Instead of
 * hardcoding physics values, we define multipliers per vehicle that scale
 * the base constants. This lets us have cars that feel different while
 * sharing the same underlying physics engine.
 *
 * The star ratings from the design doc map to concrete multipliers:
 * ⭐⭐⭐⭐⭐ = 1.2x, ⭐⭐⭐⭐ = 1.1x, ⭐⭐⭐ = 1.0x, ⭐⭐ = 0.9x, ⭐ = 0.8x
 *
 * Key concepts: data-driven design, stat multipliers, vehicle archetypes
 */

export interface VehicleDef {
  id: string;
  name: string;
  description: string;
  style: string;

  // Physics multipliers (applied to base constants)
  topSpeedMult: number;      // multiplies ENGINE.MAX_SPEED
  accelMult: number;         // multiplies ENGINE.MAX_FORCE
  handlingMult: number;      // multiplies STEERING.MAX_ANGLE
  driftMult: number;         // multiplies drift charge rate
  massMult: number;          // multiplies VEHICLE.CHASSIS_MASS

  // Visual
  bodyColor: [number, number, number];      // RGB 0-1
  accentColor: [number, number, number];    // neon accent RGB 0-1
  underglowColor: [number, number, number]; // underglow RGB 0-1
}

export const VEHICLES: Record<string, VehicleDef> = {
  ronin: {
    id: 'ronin',
    name: 'RONIN',
    description: 'Balanced Japanese sports car. Great all-rounder.',
    style: 'Japanese Sports Car (GTR)',
    topSpeedMult: 1.1,
    accelMult: 1.0,
    handlingMult: 1.0,
    driftMult: 1.0,
    massMult: 1.0,
    bodyColor: [0.03, 0.03, 0.05],
    accentColor: [0, 1, 1],        // cyan
    underglowColor: [0, 1, 1],
  },
  viper: {
    id: 'viper',
    name: 'VIPER',
    description: 'Heavy muscle car. Top speed king, drifts wide.',
    style: 'American Muscle',
    topSpeedMult: 1.25,
    accelMult: 0.85,
    handlingMult: 0.85,
    driftMult: 1.15,
    massMult: 1.2,
    bodyColor: [0.06, 0.01, 0.01],
    accentColor: [1, 0, 0.4],      // hot pink
    underglowColor: [1, 0, 0.5],
  },
  phantom: {
    id: 'phantom',
    name: 'PHANTOM',
    description: 'Lightweight hypercar. Lightning acceleration.',
    style: 'European Hypercar',
    topSpeedMult: 1.0,
    accelMult: 1.3,
    handlingMult: 1.15,
    driftMult: 0.85,
    massMult: 0.8,
    bodyColor: [0.01, 0.02, 0.06],
    accentColor: [0.3, 0.5, 1],    // electric blue
    underglowColor: [0.2, 0.4, 1],
  },
  riot: {
    id: 'riot',
    name: 'RIOT',
    description: 'Tiny drift machine. Maximum agility & drift.',
    style: 'Kei Drift Car',
    topSpeedMult: 0.85,
    accelMult: 1.1,
    handlingMult: 1.3,
    driftMult: 1.35,
    massMult: 0.75,
    bodyColor: [0.04, 0.01, 0.05],
    accentColor: [1, 0, 1],        // magenta
    underglowColor: [1, 0, 1],
  },
} as const;

export const VEHICLE_IDS = Object.keys(VEHICLES) as (keyof typeof VEHICLES)[];
export const DEFAULT_VEHICLE_ID = 'ronin';
