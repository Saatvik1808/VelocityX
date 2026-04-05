/**
 * LEARNING NOTE: Feedforward Neural Network (No Dependencies)
 *
 * A neural network is just a series of matrix multiplications with
 * non-linear "activation functions" between them. Our AI driver's brain
 * is a small network: 22 inputs (what the car sees) → 16 hidden → 12 hidden → 6 outputs
 * (accelerate, brake, steerLeft, steerRight, drift, nitro).
 *
 * Total parameters: ~650 weights. Tiny by ML standards, but enough to
 * learn complex driving behavior through evolution (no backpropagation needed).
 *
 * Key concepts: feedforward propagation, weight serialization, neuroevolution
 */

import { Matrix, tanh, leakyRelu } from './Matrix.js';

export class FeedForwardNet {
  private readonly layerSizes: number[];
  private weights: Matrix[] = [];
  private biases: Matrix[] = [];

  constructor(layerSizes: number[]) {
    this.layerSizes = layerSizes;

    // Initialize weights and biases for each layer transition
    for (let i = 0; i < layerSizes.length - 1; i++) {
      const rows = layerSizes[i + 1]!;
      const cols = layerSizes[i]!;
      // Xavier initialization: scale by sqrt(2 / (fan_in + fan_out))
      const scale = Math.sqrt(2.0 / (cols + rows));
      this.weights.push(new Matrix(rows, cols).randomize(scale));
      this.biases.push(new Matrix(rows, 1).randomize(0.1));
    }
  }

  /** Run a forward pass: inputs → outputs */
  forward(inputs: number[]): number[] {
    let current = Matrix.fromArray(inputs);

    for (let i = 0; i < this.weights.length; i++) {
      // output = activation(W * input + bias)
      current = Matrix.multiply(this.weights[i]!, current);
      current = Matrix.add(current, this.biases[i]!);

      if (i < this.weights.length - 1) {
        // Hidden layers: leaky ReLU (prevents dead neurons)
        current = Matrix.map(current, leakyRelu);
      } else {
        // Output layer: tanh (maps to [-1, 1] for driving controls)
        current = Matrix.map(current, tanh);
      }
    }

    return current.toArray();
  }

  /** Serialize all weights + biases into a single flat Float32Array */
  getWeights(): Float32Array {
    const totalSize = FeedForwardNet.weightCount(this.layerSizes);
    const result = new Float32Array(totalSize);
    let offset = 0;

    for (let i = 0; i < this.weights.length; i++) {
      result.set(this.weights[i]!.data, offset);
      offset += this.weights[i]!.data.length;
      result.set(this.biases[i]!.data, offset);
      offset += this.biases[i]!.data.length;
    }

    return result;
  }

  /** Load weights from a flat Float32Array */
  setWeights(w: Float32Array): void {
    let offset = 0;

    for (let i = 0; i < this.weights.length; i++) {
      const wLen = this.weights[i]!.data.length;
      this.weights[i]!.data.set(w.subarray(offset, offset + wLen));
      offset += wLen;

      const bLen = this.biases[i]!.data.length;
      this.biases[i]!.data.set(w.subarray(offset, offset + bLen));
      offset += bLen;
    }
  }

  /** Calculate total number of trainable parameters for given architecture */
  static weightCount(layers: number[]): number {
    let count = 0;
    for (let i = 0; i < layers.length - 1; i++) {
      count += layers[i + 1]! * layers[i]!; // weights
      count += layers[i + 1]!;              // biases
    }
    return count;
  }

  /** Deep copy this network */
  clone(): FeedForwardNet {
    const net = new FeedForwardNet(this.layerSizes);
    net.setWeights(this.getWeights());
    return net;
  }

  /** Get the architecture description */
  getArchitecture(): number[] {
    return [...this.layerSizes];
  }
}
