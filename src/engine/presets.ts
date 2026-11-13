import type { ProcessInput, SimConfig } from './types.ts';

export interface Preset {
  id: 'NP1' | 'NP2' | 'P1' | 'P2' | 'I1' | 'I2';
  config: SimConfig;
  processes: readonly ProcessInput[];
}

const build = (arrivals: number[], bursts: number[]): ProcessInput[] =>
  arrivals.map((arrival, i) => ({ id: `P${i + 1}`, arrival, burst: bursts[i] }));

// PRD §9.1. Kalimat tujuan belajar milik src/content (frontend).
export const PRESETS: readonly Preset[] = [
  { id: 'NP1', config: { algorithm: 'FCFS' }, processes: build([0, 0, 0, 0, 0], [2, 15, 11, 1, 17]) },
  { id: 'NP2', config: { algorithm: 'SJF' }, processes: build([0, 4, 8, 12, 16], [11, 17, 16, 6, 10]) },
  { id: 'P1', config: { algorithm: 'RR', quantum: 10 }, processes: build([0, 0, 0, 0, 0], [2, 15, 11, 1, 17]) },
  { id: 'P2', config: { algorithm: 'RR', quantum: 10 }, processes: build([0, 4, 8, 12, 16], [11, 17, 16, 6, 10]) },
  { id: 'I1', config: { algorithm: 'FCFS' }, processes: build([3, 6, 25, 40, 45], [2, 15, 11, 1, 17]) },
  { id: 'I2', config: { algorithm: 'RR', quantum: 4 }, processes: build([2, 20, 45, 70, 90, 108], [11, 17, 16, 6, 10, 4]) },
];
