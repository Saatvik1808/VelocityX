/**
 * LEARNING NOTE: Impact Sound Synthesis (Web Audio API)
 *
 * Collision sounds are synthesized by combining a short burst of noise
 * (the "crack") with a low-frequency oscillator (the "thud"). Both
 * have fast attack and exponential decay — mimicking a real impact.
 * Louder impacts = lower pitch + longer decay.
 *
 * Key concepts: envelope shaping, noise bursts, oscillator transients
 */

import type { AudioEngine } from './AudioEngine.js';

export class ImpactAudio {
  private ctx: AudioContext;
  private masterOutput: GainNode;
  private lastImpactTime = 0;

  constructor(audioEngine: AudioEngine) {
    this.ctx = audioEngine.getContext();
    this.masterOutput = audioEngine.getMasterGain();
  }

  /**
   * Trigger an impact sound
   * @param force impact force (0-1 normalized, higher = harder hit)
   */
  trigger(force: number): void {
    // Debounce: no more than 1 impact per 100ms
    const now = this.ctx.currentTime;
    if (now - this.lastImpactTime < 0.1) return;
    this.lastImpactTime = now;

    const clampedForce = Math.min(Math.max(force, 0.1), 1.0);

    // === Noise burst (crack/crunch) ===
    const noiseLen = 0.05 + clampedForce * 0.08;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * noiseLen, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length); // decaying noise
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000 + (1 - clampedForce) * 2000;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(clampedForce * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterOutput);
    noiseSource.start(now);
    noiseSource.stop(now + noiseLen);

    // Auto-cleanup
    noiseSource.onended = () => {
      noiseSource.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
    };

    // === Low thud oscillator ===
    const thudDuration = 0.1 + clampedForce * 0.15;
    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(80 + (1 - clampedForce) * 40, now);
    thud.frequency.exponentialRampToValueAtTime(30, now + thudDuration);

    const thudGain = this.ctx.createGain();
    thudGain.gain.setValueAtTime(clampedForce * 0.25, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + thudDuration);

    thud.connect(thudGain);
    thudGain.connect(this.masterOutput);
    thud.start(now);
    thud.stop(now + thudDuration);

    thud.onended = () => {
      thud.disconnect();
      thudGain.disconnect();
    };
  }

  dispose(): void {
    // No persistent nodes to clean up — all impact sounds are transient
  }
}
