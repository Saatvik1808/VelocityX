/**
 * LEARNING NOTE: Input Abstraction Layer
 *
 * Games map physical inputs (keyboard keys, gamepad buttons) to semantic
 * actions (accelerate, brake, steer). This abstraction lets us support
 * keyboard and gamepad with the same InputState struct — the rest of the
 * game doesn't care which device the player is using.
 *
 * Gamepad API: `navigator.getGamepads()` returns an array of connected
 * gamepads. We poll it each frame (gamepads don't fire events for analog
 * inputs like triggers and sticks).
 *
 * Key concepts: input abstraction, keyboard events, gamepad polling
 */

import type { InputState } from '@neon-drift/shared';

export class InputManager {
  private readonly keysDown = new Set<string>();

  constructor() {
    // Use capture phase to get events BEFORE Babylon.js can intercept them
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Prevent default for ALL game keys
    const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'];
    if (gameKeys.includes(e.code)) {
      e.preventDefault();
      e.stopPropagation(); // Prevent Babylon.js from consuming it
    }
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  /** Read the current input state from keyboard + optional gamepad. */
  getInputState(): InputState {
    // Start with keyboard
    const input: InputState = {
      accelerate: this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp'),
      brake: this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown'),
      steerLeft: this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft'),
      steerRight: this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight'),
      drift: this.keysDown.has('Space'),
      nitro: this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight'),
    };

    // Merge gamepad input (any source can activate)
    this.mergeGamepadInput(input);

    return input;
  }

  private mergeGamepadInput(input: InputState): void {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    if (!gp) return;

    const DEADZONE = 0.15;

    // Left stick X for steering
    const stickX = gp.axes[0] ?? 0;
    if (stickX < -DEADZONE) input.steerLeft = true;
    if (stickX > DEADZONE) input.steerRight = true;

    // Right trigger (axis 5 on standard mapping, or button 7) for accelerate
    const rtButton = gp.buttons[7];
    if (rtButton && rtButton.value > 0.1) input.accelerate = true;

    // Left trigger for brake
    const ltButton = gp.buttons[6];
    if (ltButton && ltButton.value > 0.1) input.brake = true;

    // A button (0) for drift
    const aButton = gp.buttons[0];
    if (aButton?.pressed) input.drift = true;

    // B button (1) for nitro
    const bButton = gp.buttons[1];
    if (bButton?.pressed) input.nitro = true;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
