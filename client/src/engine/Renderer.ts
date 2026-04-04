/**
 * LEARNING NOTE: Babylon.js Engine Setup (Mobile Compatible)
 *
 * Mobile devices need: lower pixel ratio, smaller shadow maps,
 * WebGL context loss recovery, and delayed initialization to ensure
 * the canvas has proper dimensions.
 *
 * Key concepts: Engine initialization, mobile optimization, WebGL fallback
 */

import { Engine } from '@babylonjs/core';

export class Renderer {
  readonly engine: Engine;
  readonly canvas: HTMLCanvasElement;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none'; // prevent browser gestures on canvas
    container.appendChild(this.canvas);

    // Detect mobile
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    // Lower settings for mobile
    const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2);

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,           // disabled — not all mobile GPUs support it
      antialias: !isMobile,     // disable AA on mobile for performance
      adaptToDeviceRatio: false, // we control pixel ratio manually
      powerPreference: 'high-performance',
    });

    this.engine.setHardwareScalingLevel(1 / pixelRatio);

    // Handle resize + orientation change
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleOrientationChange);

    // Delayed initial resize to ensure container has dimensions
    setTimeout(() => this.handleResize(), 100);
    setTimeout(() => this.handleResize(), 500);
  }

  /** Mobile browsers take up to 1s to settle viewport after orientation change */
  private handleOrientationChange = (): void => {
    this.handleResize();
    setTimeout(() => this.handleResize(), 100);
    setTimeout(() => this.handleResize(), 300);
    setTimeout(() => this.handleResize(), 600);
    setTimeout(() => this.handleResize(), 1000);
  };

  /** Call externally when UI layout changes (e.g., lobby hidden, game starts) */
  forceResize(): void {
    this.handleResize();
    setTimeout(() => this.handleResize(), 50);
    setTimeout(() => this.handleResize(), 200);
  }

  private handleResize = (): void => {
    // Force canvas to fill container (fixes mobile orientation change + lobby→game transition)
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.engine.resize();
  };

  getSize(): { width: number; height: number } {
    return {
      width: this.container.clientWidth || window.innerWidth,
      height: this.container.clientHeight || window.innerHeight,
    };
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleOrientationChange);
    this.engine.dispose();
    this.canvas.remove();
  }
}
