/**
 * LEARNING NOTE: Babylon.js Engine Setup
 *
 * Babylon.js uses an `Engine` class that manages the WebGL/WebGPU context.
 * Unlike Three.js where you create a renderer and call render() manually,
 * Babylon.js has a built-in render loop via `engine.runRenderLoop()`.
 * However, we manage our own game loop for fixed-timestep physics, so
 * we call `scene.render()` manually each frame instead.
 *
 * Key concepts: Engine initialization, canvas management, resize handling
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
    container.appendChild(this.canvas);

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
    });

    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 2));

    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  private handleResize = (): void => {
    this.engine.resize();
  };

  getSize(): { width: number; height: number } {
    return {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    };
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.engine.dispose();
    this.canvas.remove();
  }
}
