/**
 * LEARNING NOTE: Input Abstraction Layer (Keyboard + Gamepad + Touch)
 *
 * Maps physical inputs to semantic actions. Touch controls work via
 * a global touchState object that the UI touch buttons write to.
 * The InputManager reads from keyboard, gamepad, AND touch each frame.
 *
 * Key concepts: input abstraction, touch controls, multi-input support
 */

import type { InputState } from '@neon-drift/shared';

// Global touch state — written by TouchControls UI component
export const touchState = {
  accelerate: false,
  brake: false,
  steerLeft: false,
  steerRight: false,
  drift: false,
  nitro: false,
};

export class InputManager {
  private readonly keysDown = new Set<string>();
  /** True for one frame when R is pressed (consumed after reading) */
  private _resetRequested = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
  }

  /** Check if focus is on a text input — if so, don't intercept keys */
  private isTypingInInput(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Don't steal keys when user is typing in an input field (e.g., name field)
    if (this.isTypingInInput()) return;

    const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'Backquote'];
    if (gameKeys.includes(e.code)) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.keysDown.add(e.code);
    if (e.code === 'Backquote') this._resetRequested = true;
  };

  /** Returns true once per tilde keypress, then resets */
  consumeReset(): boolean {
    if (this._resetRequested) {
      this._resetRequested = false;
      return true;
    }
    return false;
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.isTypingInInput()) {
      // Clear all keys when typing — prevents stuck keys from before focus
      this.keysDown.clear();
      return;
    }
    this.keysDown.delete(e.code);
  };

  getInputState(): InputState {
    const input: InputState = {
      accelerate: this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp') || touchState.accelerate,
      brake: this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown') || touchState.brake,
      steerLeft: this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft') || touchState.steerLeft,
      steerRight: this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight') || touchState.steerRight,
      drift: this.keysDown.has('Space') || touchState.drift,
      nitro: this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight') || touchState.nitro,
    };

    this.mergeGamepadInput(input);
    return input;
  }

  private mergeGamepadInput(input: InputState): void {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    if (!gp) return;

    const DEADZONE = 0.15;
    const stickX = gp.axes[0] ?? 0;
    if (stickX < -DEADZONE) input.steerLeft = true;
    if (stickX > DEADZONE) input.steerRight = true;

    const rtButton = gp.buttons[7];
    if (rtButton && rtButton.value > 0.1) input.accelerate = true;

    const ltButton = gp.buttons[6];
    if (ltButton && ltButton.value > 0.1) input.brake = true;

    const aButton = gp.buttons[0];
    if (aButton?.pressed) input.drift = true;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
  }
}
