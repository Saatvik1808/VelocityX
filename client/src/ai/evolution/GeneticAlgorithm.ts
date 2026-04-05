/**
 * LEARNING NOTE: Genetic Algorithm for Neuroevolution
 *
 * Instead of training with backpropagation (gradient descent), we EVOLVE
 * neural network weights using biological principles:
 * 1. Create a population of random networks
 * 2. Test them all (let them drive)
 * 3. Keep the best ones (natural selection)
 * 4. Breed new ones by mixing parents' weights (crossover)
 * 5. Add random mutations (exploration)
 * 6. Repeat for hundreds of generations
 *
 * This is called "neuroevolution" — it's gradient-free, works with any
 * fitness function (even non-differentiable ones like "did the car finish?"),
 * and is embarrassingly simple to implement.
 *
 * Key concepts: genetic algorithm, elitism, tournament selection, crossover, mutation
 */

export interface GAConfig {
  populationSize: number;
  genomeLength: number;
  eliteCount: number;
  mutationRate: number;      // probability per gene (0-1)
  mutationStrength: number;  // std dev of Gaussian noise
  crossoverRate: number;     // probability of crossover vs clone (0-1)
  tournamentSize: number;    // number of candidates in tournament selection
}

export interface Individual {
  genome: Float32Array;
  fitness: number;
}

export const DEFAULT_GA_CONFIG: GAConfig = {
  populationSize: 50,
  genomeLength: 0,  // set based on network architecture
  eliteCount: 5,
  mutationRate: 0.1,
  mutationStrength: 0.3,
  crossoverRate: 0.7,
  tournamentSize: 3,
};

export class GeneticAlgorithm {
  private readonly config: GAConfig;
  private population: Individual[] = [];
  private generation = 0;
  private bestEverFitness = -Infinity;
  private bestEverGenome: Float32Array | null = null;

  constructor(config: GAConfig) {
    this.config = config;
  }

  /** Fill population with random genomes in [-1, 1] */
  initialize(): void {
    this.population = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      const genome = new Float32Array(this.config.genomeLength);
      for (let j = 0; j < genome.length; j++) {
        genome[j] = (Math.random() * 2 - 1);
      }
      this.population.push({ genome, fitness: 0 });
    }
    this.generation = 0;
  }

  /** Get the current population for evaluation */
  getPopulation(): Individual[] {
    return this.population;
  }

  /** Set fitness for a specific individual */
  setFitness(index: number, fitness: number): void {
    if (index < this.population.length) {
      this.population[index]!.fitness = fitness;
    }
  }

  /** Evolve to next generation after all individuals have been evaluated */
  evolve(): void {
    // Sort by fitness (best first)
    this.population.sort((a, b) => b.fitness - a.fitness);

    // Track all-time best
    const currentBest = this.population[0]!;
    if (currentBest.fitness > this.bestEverFitness) {
      this.bestEverFitness = currentBest.fitness;
      this.bestEverGenome = new Float32Array(currentBest.genome);
    }

    const newPopulation: Individual[] = [];

    // Elitism: keep top N individuals unchanged
    for (let i = 0; i < this.config.eliteCount && i < this.population.length; i++) {
      newPopulation.push({
        genome: new Float32Array(this.population[i]!.genome),
        fitness: 0,
      });
    }

    // Fill remaining slots with offspring
    while (newPopulation.length < this.config.populationSize) {
      const parent1 = this.tournamentSelect();
      const parent2 = this.tournamentSelect();

      let childGenome: Float32Array;

      if (Math.random() < this.config.crossoverRate) {
        childGenome = this.crossover(parent1.genome, parent2.genome);
      } else {
        childGenome = new Float32Array(parent1.genome);
      }

      this.mutate(childGenome);

      newPopulation.push({ genome: childGenome, fitness: 0 });
    }

    this.population = newPopulation;
    this.generation++;
  }

  /** Tournament selection: pick N random, return the best */
  private tournamentSelect(): Individual {
    let best: Individual | null = null;
    for (let i = 0; i < this.config.tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      const candidate = this.population[idx]!;
      if (!best || candidate.fitness > best.fitness) {
        best = candidate;
      }
    }
    return best!;
  }

  /** Single-point crossover: swap genes at a random point */
  private crossover(a: Float32Array, b: Float32Array): Float32Array {
    const child = new Float32Array(a.length);
    const crossPoint = Math.floor(Math.random() * a.length);
    for (let i = 0; i < a.length; i++) {
      child[i] = i < crossPoint ? a[i]! : b[i]!;
    }
    return child;
  }

  /** Gaussian mutation: add random noise to each gene with some probability */
  private mutate(genome: Float32Array): void {
    for (let i = 0; i < genome.length; i++) {
      if (Math.random() < this.config.mutationRate) {
        // Box-Muller transform for Gaussian random number
        const u1 = Math.random();
        const u2 = Math.random();
        const noise = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
        genome[i] = genome[i]! + noise * this.config.mutationStrength;
        // Clamp to prevent exploding weights
        genome[i] = Math.max(-3, Math.min(3, genome[i]!));
      }
    }
  }

  // ── Getters ──

  getGeneration(): number { return this.generation; }

  getBestFitness(): number {
    if (this.population.length === 0) return 0;
    return Math.max(...this.population.map(i => i.fitness));
  }

  getAverageFitness(): number {
    if (this.population.length === 0) return 0;
    return this.population.reduce((sum, i) => sum + i.fitness, 0) / this.population.length;
  }

  getBestGenome(): Float32Array | null {
    return this.bestEverGenome;
  }

  getBestEverFitness(): number {
    return this.bestEverFitness;
  }

  /** Serialize entire GA state (for saving/loading training progress) */
  serialize(): string {
    return JSON.stringify({
      generation: this.generation,
      bestEverFitness: this.bestEverFitness,
      bestEverGenome: this.bestEverGenome ? Array.from(this.bestEverGenome) : null,
      config: this.config,
    });
  }

  /** Restore from saved state */
  static deserialize(json: string, config: GAConfig): GeneticAlgorithm {
    const data = JSON.parse(json) as {
      generation: number;
      bestEverFitness: number;
      bestEverGenome: number[] | null;
    };
    const ga = new GeneticAlgorithm(config);
    ga.generation = data.generation;
    ga.bestEverFitness = data.bestEverFitness;
    ga.bestEverGenome = data.bestEverGenome ? new Float32Array(data.bestEverGenome) : null;
    ga.initialize(); // re-fill population (fitness reset)
    // Inject best genome as first individual for elitism continuity
    if (ga.bestEverGenome && ga.population.length > 0) {
      ga.population[0]!.genome = new Float32Array(ga.bestEverGenome);
    }
    return ga;
  }
}
