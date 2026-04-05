/**
 * LEARNING NOTE: AI Training Visualization Panel
 *
 * Shows the neuroevolution training process in real-time. Players can
 * click START to begin evolving AI drivers, and watch fitness improve
 * generation by generation. The trained network weights are saved to
 * localStorage and used by AI opponents in Solo Mode.
 *
 * Key concepts: training visualization, fitness tracking, user-facing ML
 */

import { useState, useEffect, useRef } from 'react';
import { FeedForwardNet } from '../ai/nn/FeedForwardNet.js';
import { AI_NET_LAYERS } from '../ai/AIDriver.js';
import { DEFAULT_GA_CONFIG } from '../ai/evolution/GeneticAlgorithm.js';
import { AITrainer } from '../ai/AITrainer.js';
import type { TrainingProgress } from '../ai/AITrainer.js';

// Global trainer instance so it persists across panel open/close
let globalTrainer: AITrainer | null = null;

export function AITrainingPanel({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState<TrainingProgress>({
    generation: 0,
    bestFitness: 0,
    avgFitness: 0,
    bestEverFitness: 0,
    evaluating: -1,
    totalPopulation: DEFAULT_GA_CONFIG.populationSize,
    isRunning: false,
    fitnessHistory: [],
  });
  const [status, setStatus] = useState<string>('');
  const [hasSavedWeights, setHasSavedWeights] = useState(false);
  const trainerRef = useRef<AITrainer | null>(globalTrainer);

  useEffect(() => {
    const saved = localStorage.getItem('ai_best_genome_v1');
    setHasSavedWeights(saved !== null);

    // Load previous progress
    try {
      const prev = localStorage.getItem('ai_training_progress');
      if (prev) {
        const data = JSON.parse(prev) as { generation: number; bestEverFitness: number; fitnessHistory: TrainingProgress['fitnessHistory'] };
        setProgress(p => ({
          ...p,
          generation: data.generation ?? 0,
          bestEverFitness: data.bestEverFitness ?? 0,
          fitnessHistory: data.fitnessHistory ?? [],
          isRunning: globalTrainer?.running ?? false,
        }));
      }
    } catch { /* ignore */ }

    // If trainer is already running, reconnect progress callback
    if (globalTrainer?.running) {
      setProgress(p => ({ ...p, isRunning: true }));
    }
  }, []);

  const handleStart = async () => {
    if (trainerRef.current?.running) return;

    setStatus('Initializing Rapier physics...');

    // Get track data from the game instance
    const game = (window as any).__gameInstance;
    const centerline = game?.getTrackCenterline?.();

    if (!centerline || centerline.length === 0) {
      setStatus('Enter Solo Mode first to load the track, then come back here to train AI.');
      return;
    }

    const trainer = new AITrainer();
    trainer.setTrackData(centerline);
    trainerRef.current = trainer;
    globalTrainer = trainer;

    setStatus('Training started! Evolving AI drivers...');

    try {
      await trainer.start((p) => {
        setProgress(p);
        setHasSavedWeights(!!localStorage.getItem('ai_best_genome_v1'));
        if (p.evaluating >= 0) {
          setStatus(`Gen ${p.generation} — Evaluating agent ${p.evaluating + 1}/${p.totalPopulation}`);
        }
      });
      setStatus('Training stopped.');
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  };

  const handleStop = () => {
    trainerRef.current?.stop();
    globalTrainer = null;
    setStatus('Stopping after current agent...');
  };

  const handleReset = () => {
    trainerRef.current?.stop();
    globalTrainer = null;
    localStorage.removeItem('ai_best_genome_v1');
    localStorage.removeItem('ai_training_progress');
    setHasSavedWeights(false);
    setProgress({
      generation: 0, bestFitness: 0, avgFitness: 0, bestEverFitness: 0,
      evaluating: -1, totalPopulation: DEFAULT_GA_CONFIG.populationSize,
      isRunning: false, fitnessHistory: [],
    });
    setStatus('Training data cleared.');
  };

  const totalParams = FeedForwardNet.weightCount(AI_NET_LAYERS);
  const isRunning = progress.isRunning;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'rgba(10, 10, 25, 0.95)',
        border: '1px solid rgba(0, 255, 200, 0.15)',
        borderRadius: 16,
        padding: '24px 28px',
        width: 440,
        maxHeight: '90vh',
        overflowY: 'auto',
        color: '#fff',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        boxShadow: '0 0 40px rgba(0, 255, 200, 0.1)',
      }}>
        {/* Title */}
        <div style={{
          fontSize: 20, fontWeight: 800, letterSpacing: 3, marginBottom: 20,
          textAlign: 'center',
          background: 'linear-gradient(135deg, #00ffc8, #00aaff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          AI NEURAL EVOLUTION
        </div>

        {/* Network Architecture */}
        <div style={{
          background: 'rgba(0, 255, 200, 0.04)',
          borderRadius: 10, padding: 14, marginBottom: 16,
          border: '1px solid rgba(0, 255, 200, 0.08)',
        }}>
          <div style={{ fontSize: 10, opacity: 0.4, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Neural Network Architecture
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {AI_NET_LAYERS.map((size, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  background: i === 0 ? 'rgba(0, 200, 255, 0.15)' :
                    i === AI_NET_LAYERS.length - 1 ? 'rgba(255, 100, 0, 0.15)' :
                      'rgba(0, 255, 200, 0.1)',
                  border: `1px solid ${i === 0 ? 'rgba(0, 200, 255, 0.3)' :
                    i === AI_NET_LAYERS.length - 1 ? 'rgba(255, 100, 0, 0.3)' :
                      'rgba(0, 255, 200, 0.2)'}`,
                  borderRadius: 8, padding: '6px 12px', textAlign: 'center' as const,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#00ffc8' }}>{size}</div>
                  <div style={{ fontSize: 8, opacity: 0.5 }}>
                    {i === 0 ? 'INPUT' : i === AI_NET_LAYERS.length - 1 ? 'OUTPUT' : 'HIDDEN'}
                  </div>
                </div>
                {i < AI_NET_LAYERS.length - 1 && (
                  <div style={{ color: '#00ffc8', opacity: 0.4, fontSize: 12 }}>→</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, opacity: 0.3, textAlign: 'center', marginTop: 6 }}>
            {totalParams.toLocaleString()} trainable parameters
          </div>
        </div>

        {/* Training Status Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16,
        }}>
          <StatBox label="Generation" value={progress.generation.toString()} color="#00ffc8" />
          <StatBox label="Best Ever" value={progress.bestEverFitness.toFixed(0)} color="#ffaa00" />
          <StatBox label="Gen Best" value={progress.bestFitness.toFixed(0)} color="#00aaff" />
          <StatBox label="Gen Average" value={progress.avgFitness.toFixed(0)} color="#ff66aa" />
        </div>

        {/* Progress bar for current generation */}
        {isRunning && progress.evaluating >= 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: 'linear-gradient(90deg, #00ffc8, #00aaff)',
                width: `${((progress.evaluating + 1) / progress.totalPopulation) * 100}%`,
                transition: 'width 0.2s',
              }} />
            </div>
            <div style={{ fontSize: 10, opacity: 0.3, marginTop: 4, textAlign: 'center' }}>
              Agent {progress.evaluating + 1} / {progress.totalPopulation}
            </div>
          </div>
        )}

        {/* Fitness History Chart */}
        {progress.fitnessHistory.length > 1 && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 10, padding: 12, marginBottom: 16,
            height: 80, position: 'relative',
          }}>
            <div style={{ fontSize: 9, opacity: 0.3, position: 'absolute', top: 4, left: 8 }}>
              FITNESS OVER GENERATIONS
            </div>
            <div style={{ fontSize: 9, opacity: 0.3, position: 'absolute', top: 4, right: 8 }}>
              <span style={{ color: '#00ffc8' }}>— best</span>{' '}
              <span style={{ color: 'rgba(0,170,255,0.6)' }}>— avg</span>
            </div>
            <FitnessChart history={progress.fitnessHistory} />
          </div>
        )}

        {/* Status message */}
        {status && (
          <div style={{
            fontSize: 11, color: '#88bbaa', textAlign: 'center',
            marginBottom: 12, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(0, 255, 200, 0.04)',
            border: '1px solid rgba(0, 255, 200, 0.06)',
          }}>
            {status}
          </div>
        )}

        {/* START / STOP button */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {!isRunning ? (
            <button onClick={handleStart} style={{
              flex: 2, padding: '12px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #00cc88, #00aaff)',
              color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 14,
              letterSpacing: 2,
              boxShadow: '0 4px 20px rgba(0,255,200,0.3)',
              transition: 'all 0.2s',
            }}>
              START TRAINING
            </button>
          ) : (
            <button onClick={handleStop} style={{
              flex: 2, padding: '12px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #ff4444, #ff6644)',
              color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 14,
              letterSpacing: 2,
              boxShadow: '0 4px 20px rgba(255,100,0,0.3)',
              transition: 'all 0.2s',
            }}>
              STOP TRAINING
            </button>
          )}
          <button onClick={handleReset} style={{
            flex: 1, padding: '12px', borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#888',
            cursor: 'pointer', fontWeight: 700, fontSize: 12,
            letterSpacing: 1, transition: 'all 0.2s',
          }}>
            RESET
          </button>
        </div>

        {/* Saved weights status */}
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 12,
          background: hasSavedWeights ? 'rgba(0, 200, 100, 0.08)' : 'rgba(255, 150, 0, 0.08)',
          border: `1px solid ${hasSavedWeights ? 'rgba(0, 200, 100, 0.15)' : 'rgba(255, 150, 0, 0.15)'}`,
          fontSize: 12,
          color: hasSavedWeights ? '#44dd88' : '#ddaa44',
        }}>
          {hasSavedWeights
            ? '✓ Trained AI brain saved — AI opponents will use it in races'
            : '⚠ No trained brain yet — click START TRAINING to evolve one'
          }
        </div>

        {/* How it works */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 10, padding: 12, marginBottom: 12,
          fontSize: 11, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, color: '#00ffc8', marginBottom: 4, fontSize: 10, letterSpacing: 1 }}>
            HOW IT WORKS
          </div>
          <div style={{ opacity: 0.5 }}>
            1. <strong>Population</strong> of {DEFAULT_GA_CONFIG.populationSize} neural networks is created<br/>
            2. Each AI drives the track in a <strong>headless physics simulation</strong><br/>
            3. <strong>Fitness</strong> is scored: checkpoints, speed, drifts, wall avoidance<br/>
            4. Best AIs are <strong>bred + mutated</strong> (genetic algorithm)<br/>
            5. Repeat — AI gets smarter each generation<br/>
            6. Best brain is <strong>saved</strong> and used by AI opponents
          </div>
        </div>

        {/* What the AI sees/controls */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 10, padding: 12, marginBottom: 16,
          fontSize: 11, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, color: '#00aaff', marginBottom: 2 }}>
            Inputs (22): wall rays, speed, drift, checkpoint direction, progress
          </div>
          <div style={{ fontWeight: 700, color: '#ff8800' }}>
            Outputs (6): accelerate, brake, steer L/R, drift, nitro
          </div>
        </div>

        {/* Close */}
        <button onClick={onClose} style={{
          width: '100%', padding: '11px', borderRadius: 10, border: 'none',
          background: 'rgba(255,255,255,0.06)', color: '#ccc',
          cursor: 'pointer', fontWeight: 700, fontSize: 14,
          letterSpacing: 2, transition: 'all 0.2s',
        }}>
          CLOSE
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 8, padding: '8px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, opacity: 0.4, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function FitnessChart({ history }: { history: { gen: number; best: number; avg: number }[] }) {
  if (history.length < 2) return null;

  const maxFitness = Math.max(...history.map(h => h.best), 1);

  const bestPoints = history.map((entry, i) => {
    const x = (i / (history.length - 1)) * 100;
    const y = 100 - (entry.best / maxFitness) * 100;
    return `${x},${y}`;
  }).join(' ');

  const avgPoints = history.map((entry, i) => {
    const x = (i / (history.length - 1)) * 100;
    const y = 100 - (entry.avg / maxFitness) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, padding: '16px 8px 4px 8px' }}>
      <polyline points={avgPoints} fill="none" stroke="rgba(0,170,255,0.4)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polyline points={bestPoints} fill="none" stroke="#00ffc8" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
