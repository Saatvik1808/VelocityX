/**
 * LEARNING NOTE: Checkpoint System
 *
 * Checkpoints are placed along the track spline. The car must pass
 * within range of each one in order. Visible markers show where
 * checkpoints are so the player knows the path.
 *
 * Key concepts: trigger volumes, lap counting, progress tracking
 */

import { CHECKPOINTS } from '@neon-drift/shared';
import { MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

interface CenterlinePoint { x: number; z: number; nx: number; nz: number; }

interface CheckpointData {
  x: number;
  z: number;
  index: number;
}

export class CheckpointSystem {
  private checkpoints: CheckpointData[] = [];
  private nextCheckpoint = 0;
  currentLap = 1;
  totalLaps = CHECKPOINTS.TOTAL_LAPS;
  finished = false;
  finishTime = 0;
  private detectionRadius = 35; // very generous — instant detection when near

  onCheckpointHit: ((index: number, lap: number) => void) | null = null;
  onLapComplete: ((lap: number, lapTime: number) => void) | null = null;
  onRaceFinish: ((totalTime: number) => void) | null = null;

  private lapStartTime = 0;
  private raceStartTime = 0;

  constructor(centerline: readonly CenterlinePoint[], scene?: Scene) {
    // Place 8 checkpoints evenly along the track
    const numCheckpoints = 8;
    const spacing = Math.max(1, Math.floor(centerline.length / numCheckpoints));

    for (let i = 0; i < numCheckpoints; i++) {
      const idx = (i * spacing) % centerline.length;
      const pt = centerline[idx]!;
      this.checkpoints.push({ x: pt.x, z: pt.z, index: i });
    }

    console.log(`Checkpoints: ${this.checkpoints.length} placed, radius: ${this.detectionRadius}m`);
    this.checkpoints.forEach((cp, i) => {
      console.log(`  CP${i}: (${cp.x.toFixed(0)}, ${cp.z.toFixed(0)})`);
    });

    // Create visible checkpoint markers
    if (scene) {
      this.createVisualMarkers(scene);
    }
  }

  private createVisualMarkers(scene: Scene): void {
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i]!;
      const next = this.checkpoints[(i + 1) % this.checkpoints.length]!;

      // Direction arrow pointing toward next checkpoint
      const dx = next.x - cp.x;
      const dz = next.z - cp.z;
      const angle = Math.atan2(dx, dz);

      // Arrow shape — thin box as the line
      const arrowMat = new StandardMaterial(`cpMat${i}`, scene);
      arrowMat.diffuseColor = new Color3(0, 0.8, 1);
      arrowMat.emissiveColor = new Color3(0, 0.4, 0.6);
      arrowMat.alpha = 0.25;

      const line = MeshBuilder.CreateBox(`cpLine${i}`, {
        width: 6, height: 0.05, depth: 0.8,
      }, scene);
      line.material = arrowMat;
      line.position.set(cp.x, 0.1, cp.z);
      line.rotation.y = angle;
      line.isPickable = false;

      // Arrow head — small triangle (box rotated 45deg)
      const head = MeshBuilder.CreateBox(`cpHead${i}`, {
        width: 2, height: 0.05, depth: 2,
      }, scene);
      head.material = arrowMat;
      head.position.set(
        cp.x + Math.sin(angle) * 4,
        0.1,
        cp.z + Math.cos(angle) * 4,
      );
      head.rotation.y = angle + Math.PI / 4;
      head.isPickable = false;
    }
  }

  get totalCheckpoints(): number { return this.checkpoints.length; }
  get currentCheckpointIndex(): number { return this.nextCheckpoint; }

  startRace(time: number): void {
    this.raceStartTime = time;
    this.lapStartTime = time;
    this.currentLap = 1;
    this.nextCheckpoint = 0;
    this.finished = false;
  }

  update(carX: number, carZ: number, currentTime: number): void {
    if (this.finished || this.checkpoints.length === 0) return;

    const cp = this.checkpoints[this.nextCheckpoint]!;
    const dx = carX - cp.x;
    const dz = carZ - cp.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < this.detectionRadius) {
      console.log(`Checkpoint ${this.nextCheckpoint} hit! (dist: ${dist.toFixed(1)}m) Lap: ${this.currentLap}`);
      this.onCheckpointHit?.(this.nextCheckpoint, this.currentLap);
      this.nextCheckpoint++;

      if (this.nextCheckpoint >= this.checkpoints.length) {
        const lapTime = currentTime - this.lapStartTime;
        this.onLapComplete?.(this.currentLap, lapTime);
        console.log(`Lap ${this.currentLap} complete! Time: ${lapTime.toFixed(2)}s`);

        if (this.currentLap >= this.totalLaps) {
          this.finished = true;
          this.finishTime = currentTime - this.raceStartTime;
          console.log(`RACE FINISHED! Total time: ${this.finishTime.toFixed(2)}s`);
          this.onRaceFinish?.(this.finishTime);
        } else {
          this.currentLap++;
          this.nextCheckpoint = 0;
          this.lapStartTime = currentTime;
        }
      }
    }
  }

  getProgress(carX: number, carZ: number): number {
    if (this.finished) return this.currentLap * this.checkpoints.length + this.checkpoints.length;

    const total = this.checkpoints.length;
    const baseProgress = (this.currentLap - 1) * total + this.nextCheckpoint;

    if (this.nextCheckpoint < total) {
      const cp = this.checkpoints[this.nextCheckpoint]!;
      const prevIdx = this.nextCheckpoint > 0 ? this.nextCheckpoint - 1 : total - 1;
      const prev = this.checkpoints[prevIdx]!;
      const segLen = Math.sqrt((cp.x - prev.x) ** 2 + (cp.z - prev.z) ** 2);
      if (segLen > 0.1) {
        const carDist = Math.sqrt((carX - prev.x) ** 2 + (carZ - prev.z) ** 2);
        return baseProgress + Math.min(carDist / segLen, 1);
      }
    }

    return baseProgress;
  }
}
