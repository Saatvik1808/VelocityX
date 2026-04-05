/**
 * LEARNING NOTE: AI Opponent Manager — Making Solo Racing Fun
 *
 * This system manages AI-controlled cars in single-player mode. Each AI
 * opponent has its own neural network brain, physics body, and visual
 * representation. The manager:
 * 1. Creates N opponents with varied difficulty (based on player skill)
 * 2. Each frame: builds observations → runs neural nets → applies inputs
 * 3. Updates visuals, effects, and race progress for all AI cars
 *
 * The AI opponents use networks trained via neuroevolution (see AITrainer).
 * Different opponents use slightly mutated copies of the best network,
 * giving each car a unique "personality" while maintaining competence.
 *
 * Key concepts: NPC management, difficulty spread, AI personality variation
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { AIDriver, AI_NET_LAYERS } from './AIDriver.js';
import { FeedForwardNet } from './nn/FeedForwardNet.js';
import { createBaseDifficulty, getRubberBandMultiplier } from './difficulty/DifficultyAdjuster.js';
import { PlayerSkillProfiler } from './difficulty/PlayerSkillProfiler.js';
import type { ObservationContext } from './AIObservation.js';
import type { InputState } from '@neon-drift/shared';

export interface AIOpponent {
  id: string;
  name: string;
  driver: AIDriver;
  vehicleId: string;
  /** Color for visuals [r, g, b] 0-1 */
  color: [number, number, number];
  // External systems attach physics/visuals to these
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  speed: number;
  checkpointIndex: number;
  lap: number;
  finished: boolean;
  finishTime: number;
}

const AI_NAMES = [
  'GHOST', 'NOVA', 'BLITZ', 'CIPHER',
  'WRAITH', 'PULSE', 'APEX', 'DRIFT',
];

const AI_COLORS: [number, number, number][] = [
  [1.0, 0.2, 0.3],   // red
  [0.2, 1.0, 0.4],   // green
  [1.0, 0.6, 0.1],   // orange
  [0.8, 0.2, 1.0],   // purple
  [1.0, 1.0, 0.2],   // yellow
  [0.2, 0.8, 1.0],   // light blue
  [1.0, 0.4, 0.7],   // pink
  [0.4, 1.0, 0.8],   // teal
];

const AI_VEHICLES = ['ronin', 'viper', 'phantom', 'riot'];

export class AIOpponentManager {
  private opponents: AIOpponent[] = [];
  private skillProfiler: PlayerSkillProfiler;
  private baseWeights: Float32Array | null = null;

  constructor() {
    this.skillProfiler = new PlayerSkillProfiler();
    this.loadBestWeights();
  }

  /** Load the best trained AI weights from localStorage */
  private loadBestWeights(): void {
    try {
      const saved = localStorage.getItem('ai_best_genome_v1');
      if (saved) {
        this.baseWeights = new Float32Array(JSON.parse(saved) as number[]);
      }
    } catch { /* no saved weights yet */ }
  }

  /**
   * Create AI opponents for a race.
   * @param count Number of AI opponents (1-7)
   */
  createOpponents(count: number): AIOpponent[] {
    this.opponents = [];
    const skill = this.skillProfiler.getSkillLevel();

    for (let i = 0; i < Math.min(count, 7); i++) {
      const difficulty = createBaseDifficulty(skill, i, count);
      const driver = new AIDriver(undefined, difficulty);

      // Load trained weights if available
      if (this.baseWeights) {
        // Create a slightly mutated copy for personality variation
        const mutatedWeights = this.mutateWeights(this.baseWeights, 0.05 + i * 0.02);
        driver.loadWeights(mutatedWeights);
      } else {
        // No trained weights — use random network (will drive poorly but that's ok)
        driver.loadFromStorage();
      }

      this.opponents.push({
        id: `ai_${i}`,
        name: AI_NAMES[i % AI_NAMES.length]!,
        driver,
        vehicleId: AI_VEHICLES[i % AI_VEHICLES.length]!,
        color: AI_COLORS[i % AI_COLORS.length]!,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        speed: 0,
        checkpointIndex: 0,
        lap: 0,
        finished: false,
        finishTime: 0,
      });
    }

    return this.opponents;
  }

  /**
   * Update all AI opponents for one physics frame.
   * Returns the input decisions for each opponent.
   */
  update(
    contexts: Map<string, ObservationContext>,
    playerProgress: number,
  ): Map<string, InputState> {
    const inputs = new Map<string, InputState>();

    for (const opp of this.opponents) {
      if (opp.finished) continue;

      const ctx = contexts.get(opp.id);
      if (!ctx) continue;

      // Get AI decision
      const input = opp.driver.getInputState(ctx);

      // Apply rubber-banding
      const aiProgress = (opp.lap * 100 + opp.checkpointIndex) / 300; // approximate
      const rubberBand = getRubberBandMultiplier(
        {
          playerPosition: 1,
          totalRacers: this.opponents.length + 1,
          playerProgress,
          aiProgress,
          raceTime: 0,
        },
        this.skillProfiler.getSkillLevel(),
      );

      // If rubber-banding says slow down and we're ahead, occasionally lift throttle
      if (rubberBand < 0.95 && input.accelerate && Math.random() < (1 - rubberBand) * 2) {
        input.accelerate = false;
      }

      inputs.set(opp.id, input);
    }

    return inputs;
  }

  /** Get all active opponents */
  getOpponents(): AIOpponent[] {
    return this.opponents;
  }

  /** Update opponent state from external physics */
  updateOpponentState(
    id: string,
    pos: { x: number; y: number; z: number },
    rot: { x: number; y: number; z: number; w: number },
    speed: number,
    checkpoint: number,
    lap: number,
  ): void {
    const opp = this.opponents.find(o => o.id === id);
    if (opp) {
      opp.position = pos;
      opp.rotation = rot;
      opp.speed = speed;
      opp.checkpointIndex = checkpoint;
      opp.lap = lap;
    }
  }

  /** Mark an opponent as finished */
  markFinished(id: string, time: number): void {
    const opp = this.opponents.find(o => o.id === id);
    if (opp) {
      opp.finished = true;
      opp.finishTime = time;
    }
  }

  /** Feed player skill data after a race */
  updatePlayerSkill(summary: {
    totalTime: number;
    avgSpeed: number;
    maxSpeed: number;
    wallCollisionCount: number;
    driftAttempts: number;
    driftSuccesses: number;
    nitroUsageSeconds: number;
    checkpointsReached: number;
    lapsCompleted: number;
    offTrackSeconds: number;
    topSpeedKmh: number;
    avgDriftDuration: number;
  }): void {
    this.skillProfiler.addRaceResult(summary);
  }

  /** Get player skill level (0-1) */
  getPlayerSkill(): number {
    return this.skillProfiler.getSkillLevel();
  }

  /** Clean up */
  dispose(): void {
    this.opponents = [];
  }

  /** Apply small random mutations to weights for personality variation */
  private mutateWeights(base: Float32Array, strength: number): Float32Array {
    const mutated = new Float32Array(base);
    for (let i = 0; i < mutated.length; i++) {
      if (Math.random() < 0.15) { // mutate 15% of weights
        const u1 = Math.random();
        const u2 = Math.random();
        const noise = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
        mutated[i] = mutated[i]! + noise * strength;
      }
    }
    return mutated;
  }
}
