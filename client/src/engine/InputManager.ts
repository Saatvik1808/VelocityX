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

  constructor() {
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'];
    if (gameKeys.includes(e.code)) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
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
