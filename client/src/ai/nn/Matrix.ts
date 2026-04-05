/**
 * LEARNING NOTE: Minimal Matrix Math for Neural Networks (Pure TypeScript)
 *
 * Instead of importing TensorFlow.js (4MB+), we implement the only 3 matrix
 * operations a feedforward neural network needs: multiply, add, and element-wise
 * map (for activation functions). Using Float32Array avoids garbage collection
 * pressure — critical when running hundreds of agents per frame during training.
 *
 * Key concepts: matrix multiplication, activation functions, Float32Array performance
 */

export class Matrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float32Array;

  constructor(rows: number, cols: number, data?: Float32Array) {
    this.rows = rows;
    this.cols = cols;
    this.data = data ?? new Float32Array(rows * cols);
  }

  get(r: number, c: number): number {
    return this.data[r * this.cols + c]!;
  }

  set(r: number, c: number, v: number): void {
    this.data[r * this.cols + c] = v;
  }

  /** Standard matrix multiplication: (m x n) * (n x p) → (m x p) */
  static multiply(a: Matrix, b: Matrix): Matrix {
    const result = new Matrix(a.rows, b.cols);
    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < b.cols; j++) {
        let sum = 0;
        for (let k = 0; k < a.cols; k++) {
          sum += a.data[i * a.cols + k]! * b.data[k * b.cols + j]!;
        }
        result.data[i * b.cols + j] = sum;
      }
    }
    return result;
  }

  /** Element-wise addition (matrices must be same size) */
  static add(a: Matrix, b: Matrix): Matrix {
    const result = new Matrix(a.rows, a.cols);
    for (let i = 0; i < a.data.length; i++) {
      result.data[i] = a.data[i]! + b.data[i]!;
    }
    return result;
  }

  /** Apply a function to every element (for activation functions) */
  static map(m: Matrix, fn: (v: number) => number): Matrix {
    const result = new Matrix(m.rows, m.cols);
    for (let i = 0; i < m.data.length; i++) {
      result.data[i] = fn(m.data[i]!);
    }
    return result;
  }

  /** Create a column vector from a 1D array */
  static fromArray(arr: number[]): Matrix {
    const m = new Matrix(arr.length, 1);
    for (let i = 0; i < arr.length; i++) {
      m.data[i] = arr[i]!;
    }
    return m;
  }

  /** Extract to a regular number array */
  toArray(): number[] {
    return Array.from(this.data);
  }

  /** Fill with random values in [-range, +range] */
  randomize(range: number = 1): Matrix {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = (Math.random() * 2 - 1) * range;
    }
    return this;
  }

  clone(): Matrix {
    return new Matrix(this.rows, this.cols, new Float32Array(this.data));
  }
}

// ── Activation Functions ────────────────────────────────────

/** Hyperbolic tangent: maps to [-1, 1]. Best for driving outputs. */
export function tanh(x: number): number {
  return Math.tanh(x);
}

/** Rectified Linear Unit: max(0, x). Good for hidden layers. */
export function relu(x: number): number {
  return x > 0 ? x : 0;
}

/** Leaky ReLU: avoids "dead neuron" problem */
export function leakyRelu(x: number): number {
  return x > 0 ? x : 0.01 * x;
}

/** Sigmoid: maps to [0, 1]. Good for probabilities. */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
