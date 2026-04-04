/**
 * LEARNING NOTE: Tire Screech Synthesis (Web Audio API)
 *
 * Tire screech is essentially filtered noise. We generate white noise
 * (random samples) and pass it through a band-pass filter tuned to
 * screech frequencies (~2-6kHz). The volume scales with drift intensity.
 * A second layer adds a lower rumble for rolling tire sound.
 *
 * Key concepts: noise generation, AudioBuffer, band-pass filter, gain envelope
 */

import type { AudioEngine } from './AudioEngine.js';

export class TireAudio {
  private ctx: AudioContext;
  private noiseBuffer: AudioBuffer;

  // Screech layer — high-pitched tire squeal
  private screechSource: AudioBufferSourceNode | null = null;
  private screechGain: GainNode;
  private screechFilter: BiquadFilterNode;

  // Roll layer — low rumble
  private rollSource: AudioBufferSourceNode | null = null;
  private rollGain: GainNode;
  private rollFilter: BiquadFilterNode;

  private started = false;

  constructor(audioEngine: AudioEngine) {
    this.ctx = audioEngine.getContext();

    // Generate 2 seconds of white noise
    this.noiseBuffer = this.createNoiseBuffer(2);

    // === Screech layer ===
    this.screechFilter = this.ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.value = 3500;
    this.screechFilter.Q.value = 3.0;

    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.value = 0;

    this.screechFilter.connect(this.screechGain);
    this.screechGain.connect(audioEngine.getMasterGain());

    // === Roll layer ===
    this.rollFilter = this.ctx.createBiquadFilter();
    this.rollFilter.type = 'lowpass';
    this.rollFilter.frequency.value = 400;
    this.rollFilter.Q.value = 1.0;

    this.rollGain = this.ctx.createGain();
    this.rollGain.gain.value = 0;

    this.rollFilter.connect(this.rollGain);
    this.rollGain.connect(audioEngine.getMasterGain());
  }

  private createNoiseBuffer(durationSecs: number): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * durationSecs;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;

    // Looping noise source for screech
    this.screechSource = this.ctx.createBufferSource();
    this.screechSource.buffer = this.noiseBuffer;
    this.screechSource.loop = true;
    this.screechSource.connect(this.screechFilter);
    this.screechSource.start();

    // Looping noise source for roll
    this.rollSource = this.ctx.createBufferSource();
    this.rollSource.buffer = this.noiseBuffer;
    this.rollSource.loop = true;
    this.rollSource.connect(this.rollFilter);
    this.rollSource.start();
  }

  /**
   * Update tire audio
   * @param drifting whether car is currently drifting
   * @param speed absolute speed in m/s
   * @param slipAngle lateral slip angle (higher = more screech)
   */
  update(drifting: boolean, speed: number, slipAngle: number): void {
    this.ensureStarted();

    const now = this.ctx.currentTime;
    const absSpeed = Math.abs(speed);

    // Screech: loud when drifting, faint when turning hard
    if (drifting && absSpeed > 3) {
      const intensity = Math.min(slipAngle * 2, 1);
      this.screechGain.gain.setTargetAtTime(0.06 + intensity * 0.12, now, 0.05);
      // Pitch shifts with speed
      this.screechFilter.frequency.setTargetAtTime(2500 + absSpeed * 50, now, 0.08);
    } else if (absSpeed > 10 && slipAngle > 0.1) {
      // Light tire noise during hard turns
      this.screechGain.gain.setTargetAtTime(slipAngle * 0.04, now, 0.08);
    } else {
      this.screechGain.gain.setTargetAtTime(0, now, 0.1);
    }

    // Roll: constant road noise proportional to speed
    if (absSpeed > 2) {
      const rollVol = Math.min(absSpeed / 60, 1) * 0.04;
      this.rollGain.gain.setTargetAtTime(rollVol, now, 0.1);
      this.rollFilter.frequency.setTargetAtTime(200 + absSpeed * 5, now, 0.1);
    } else {
      this.rollGain.gain.setTargetAtTime(0, now, 0.15);
    }
  }

  dispose(): void {
    try { this.screechSource?.stop(); } catch (_) { /* */ }
    try { this.rollSource?.stop(); } catch (_) { /* */ }
    this.screechGain.disconnect();
    this.rollGain.disconnect();
    this.screechFilter.disconnect();
    this.rollFilter.disconnect();
  }
}
