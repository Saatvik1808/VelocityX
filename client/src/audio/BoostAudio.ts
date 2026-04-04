/**
 * LEARNING NOTE: Boost & Nitro Sound Effects (Web Audio API)
 *
 * Boost activation uses a rising "whoosh" (filtered noise sweep) combined
 * with a bass hit (low oscillator). Nitro uses a continuous roar (noise
 * through resonant filter). These sounds provide critical gameplay feedback
 * — players need to HEAR when boost fires to feel the reward.
 *
 * Key concepts: filter sweeps, transient synthesis, continuous audio states
 */

import type { AudioEngine } from './AudioEngine.js';

export class BoostAudio {
  private ctx: AudioContext;
  private masterOutput: GainNode;

  // Nitro continuous sound
  private nitroNoiseSource: AudioBufferSourceNode | null = null;
  private nitroGain: GainNode;
  private nitroFilter: BiquadFilterNode;
  private nitroStarted = false;
  private noiseBuffer: AudioBuffer;

  constructor(audioEngine: AudioEngine) {
    this.ctx = audioEngine.getContext();
    this.masterOutput = audioEngine.getMasterGain();

    // Noise buffer for nitro roar
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Nitro chain
    this.nitroFilter = this.ctx.createBiquadFilter();
    this.nitroFilter.type = 'bandpass';
    this.nitroFilter.frequency.value = 800;
    this.nitroFilter.Q.value = 2.0;

    this.nitroGain = this.ctx.createGain();
    this.nitroGain.gain.value = 0;

    this.nitroFilter.connect(this.nitroGain);
    this.nitroGain.connect(this.masterOutput);
  }

  /** Trigger drift-boost activation sound (one-shot whoosh + bass) */
  triggerBoost(level: number): void {
    const now = this.ctx.currentTime;
    const duration = 0.3 + level * 0.2;

    // Whoosh — noise with rising high-pass sweep
    const whooshLen = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, whooshLen, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < whooshLen; i++) {
      const env = Math.sin((i / whooshLen) * Math.PI); // bell envelope
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + duration * 0.7);
    filter.Q.value = 1.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08 + level * 0.06, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterOutput);
    source.start(now);
    source.stop(now + duration);

    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    // Bass hit
    const bass = this.ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(60 + level * 20, now);
    bass.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    const bassGain = this.ctx.createGain();
    bassGain.gain.setValueAtTime(0.15 + level * 0.1, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    bass.connect(bassGain);
    bassGain.connect(this.masterOutput);
    bass.start(now);
    bass.stop(now + 0.3);

    bass.onended = () => {
      bass.disconnect();
      bassGain.disconnect();
    };
  }

  /** Update nitro continuous sound */
  updateNitro(active: boolean, tank: number): void {
    const now = this.ctx.currentTime;

    if (active && !this.nitroStarted) {
      // Start nitro roar
      this.nitroNoiseSource = this.ctx.createBufferSource();
      this.nitroNoiseSource.buffer = this.noiseBuffer;
      this.nitroNoiseSource.loop = true;
      this.nitroNoiseSource.connect(this.nitroFilter);
      this.nitroNoiseSource.start();
      this.nitroStarted = true;
    }

    if (active) {
      this.nitroGain.gain.setTargetAtTime(0.1, now, 0.05);
      this.nitroFilter.frequency.setTargetAtTime(600 + tank * 600, now, 0.1);
    } else {
      this.nitroGain.gain.setTargetAtTime(0, now, 0.08);
      if (this.nitroStarted && this.nitroGain.gain.value < 0.001) {
        try { this.nitroNoiseSource?.stop(); } catch (_) { /* */ }
        this.nitroStarted = false;
      }
    }
  }

  dispose(): void {
    try { this.nitroNoiseSource?.stop(); } catch (_) { /* */ }
    this.nitroGain.disconnect();
    this.nitroFilter.disconnect();
  }
}
