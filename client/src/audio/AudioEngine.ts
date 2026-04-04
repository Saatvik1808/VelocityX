/**
 * LEARNING NOTE: Master Audio Engine (Web Audio API)
 *
 * The Web Audio API uses a graph of nodes: sources → effects → destination.
 * We create one AudioContext and route all game sounds through a master
 * gain node. The context starts suspended (browser policy) and resumes
 * on first user interaction. All game audio modules connect to this master.
 *
 * Key concepts: AudioContext, gain node, audio graph, user gesture requirement
 * Further reading: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted = false;
  private _volume = 0.7;

  /** Lazily create AudioContext on first user interaction */
  init(): AudioContext {
    if (this.ctx) return this.ctx;

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._volume;
    this.masterGain.connect(this.ctx.destination);

    // Resume if suspended (required by browsers until user gesture)
    if (this.ctx.state === 'suspended') {
      const resume = () => {
        this.ctx?.resume();
        document.removeEventListener('click', resume);
        document.removeEventListener('keydown', resume);
      };
      document.addEventListener('click', resume);
      document.addEventListener('keydown', resume);
    }

    return this.ctx;
  }

  getContext(): AudioContext {
    if (!this.ctx) this.init();
    return this.ctx!;
  }

  getMasterGain(): GainNode {
    if (!this.masterGain) this.init();
    return this.masterGain!;
  }

  get muted(): boolean { return this._muted; }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this._volume;
    }
  }

  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.value = this._volume;
    }
  }

  dispose(): void {
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }
}
