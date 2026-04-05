/**
 * LEARNING NOTE: AI Driver — A Neural Network That Races
 *
 * This is the runtime AI that uses a trained neural network to drive a car.
 * It implements the same InputState interface as the human InputManager,
 * so it can be swapped in seamlessly. Every frame:
 *   1. Build observation vector (what the AI "sees")
 *   2. Run neural network forward pass (~0.01ms)
 *   3. Convert 6 tanh outputs to boolean InputState
 *
 * The network was trained via neuroevolution (genetic algorithm) — it
 * learned to race by competing against itself across hundreds of generations.
 *
 * Key concepts: trained model inference, observation-action loop, input abstraction
 */

import { FeedForwardNet } from './nn/FeedForwardNet.js';
import { buildObservation, OBSERVATION_SIZE } from './AIObservation.js';
import type { ObservationContext } from './AIObservation.js';
import type { InputState } from '@neon-drift/shared';

/** Network architecture: must match the architecture used during training */
export const AI_NET_LAYERS = [OBSERVATION_SIZE, 16, 12, 6];

export interface DifficultyParams {
  /** Frames of reaction delay (0 = instant, 6 = ~50ms at 120Hz) */
  reactionDelay: number;
  /** Random noise added to steering (-1 to 1 scale) */
  steeringNoise: number;
  /** Multiplier on top speed (0.85 = slow, 1.05 = fast) */
  topSpeedMultiplier: number;
  /** Probability of attempting a drift per corner */
  driftProbability: number;
  /** Probability per second of making a random mistake */
  mistakeRate: number;
}

export const DEFAULT_DIFFICULTY: DifficultyParams = {
  reactionDelay: 0,
  steeringNoise: 0,
  topSpeedMultiplier: 1.0,
  driftProbability: 0.8,
  mistakeRate: 0.02,
};

export class AIDriver {
  private readonly net: FeedForwardNet;
  private difficulty: DifficultyParams;

  /** Circular buffer for reaction delay */
  private observationHistory: number[][] = [];
  private historyIndex = 0;
  private readonly maxHistorySize = 12; // supports up to 12 frames (~100ms) delay

  /** Mistake state */
  private mistakeTimer = 0;
  private isMistaking = false;
  private mistakeDuration = 0;

  constructor(weights?: Float32Array, difficulty?: DifficultyParams) {
    this.net = new FeedForwardNet(AI_NET_LAYERS);
    if (weights) {
      this.net.setWeights(weights);
    }
    this.difficulty = difficulty ?? DEFAULT_DIFFICULTY;

    // Initialize observation history
    for (let i = 0; i < this.maxHistorySize; i++) {
      this.observationHistory.push(new Array(OBSERVATION_SIZE).fill(0));
    }
  }

  /** Load weights from a saved Float32Array */
  loadWeights(weights: Float32Array): void {
    this.net.setWeights(weights);
  }

  /** Load weights from localStorage */
  loadFromStorage(key: string = 'ai_best_genome_v1'): boolean {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return false;
      const arr = JSON.parse(saved) as number[];
      this.net.setWeights(new Float32Array(arr));
      return true;
    } catch {
      return false;
    }
  }

  /** Set difficulty parameters (for adaptive difficulty) */
  setDifficulty(params: DifficultyParams): void {
    this.difficulty = params;
  }

  /**
   * Get the AI's input decision for this frame.
   * Drop-in replacement for InputManager.getInputState()
   */
  getInputState(ctx: ObservationContext): InputState {
    // Build current observation
    const currentObs = buildObservation(ctx);

    // Store in history buffer (for reaction delay)
    this.observationHistory[this.historyIndex % this.maxHistorySize] = currentObs;
    this.historyIndex++;

    // Read from delayed observation (reaction delay)
    const delayedIndex = Math.max(0, this.historyIndex - 1 - this.difficulty.reactionDelay);
    const obs = this.observationHistory[delayedIndex % this.maxHistorySize]!;

    // Forward pass through neural network
    const outputs = this.net.forward(obs);

    // Convert tanh outputs [-1, 1] to boolean inputs
    // Threshold at 0: positive = true, negative = false
    let input: InputState = {
      accelerate: outputs[0]! > 0,
      brake: outputs[1]! > 0,
      steerLeft: outputs[2]! > 0.1,   // slight deadzone
      steerRight: outputs[3]! > 0.1,  // slight deadzone
      drift: outputs[4]! > 0,
      nitro: outputs[5]! > 0,
    };

    // ── Apply difficulty modifiers ──

    // Steering noise
    if (this.difficulty.steeringNoise > 0) {
      const noise = (Math.random() * 2 - 1) * this.difficulty.steeringNoise;
      if (noise > 0.3 && !input.steerRight) input.steerRight = true;
      if (noise < -0.3 && !input.steerLeft) input.steerLeft = true;
    }

    // Drift probability (suppress drift attempts on easier difficulty)
    if (input.drift && Math.random() > this.difficulty.driftProbability) {
      input.drift = false;
    }

    // Random mistakes
    this.updateMistakes();
    if (this.isMistaking) {
      input = this.applyMistake(input);
    }

    return input;
  }

  /** Track and trigger random mistakes based on difficulty */
  private updateMistakes(): void {
    if (this.isMistaking) {
      this.mistakeTimer++;
      if (this.mistakeTimer > this.mistakeDuration) {
        this.isMistaking = false;
        this.mistakeTimer = 0;
      }
      return;
    }

    // Check if a new mistake should happen (per-frame probability)
    const perFrameRate = this.difficulty.mistakeRate / 120; // convert per-second to per-frame
    if (Math.random() < perFrameRate) {
      this.isMistaking = true;
      this.mistakeTimer = 0;
      this.mistakeDuration = Math.floor(20 + Math.random() * 40); // 20-60 frames
    }
  }

  /** Apply a random mistake to the input */
  private applyMistake(input: InputState): InputState {
    const kind = Math.floor(Math.random() * 3);
    switch (kind) {
      case 0: // brake tap
        return { ...input, brake: true, accelerate: false };
      case 1: // wrong steer
        return { ...input, steerLeft: !input.steerLeft, steerRight: !input.steerRight };
      case 2: // lift throttle
        return { ...input, accelerate: false };
      default:
        return input;
    }
  }

  /** Get the underlying network (for cloning, mutation, etc.) */
  getNetwork(): FeedForwardNet {
    return this.net;
  }
}
