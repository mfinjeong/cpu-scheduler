// Kontrak engine sesuai ADR-002. Perubahan wajib lewat software-architect (PRD §13.3).

export type Algorithm = 'FCFS' | 'SJF' | 'RR';

export interface ProcessInput {
  id: string;
  arrival: number;
  burst: number;
}

export interface SimConfig {
  algorithm: Algorithm;
  quantum?: number;
}

export interface RawProcessRow {
  id: unknown;
  arrival: unknown;
  burst: unknown;
}

export type ValidationCode =
  | 'EMPTY'
  | 'NOT_NUMBER'
  | 'NOT_INTEGER'
  | 'AT_NEGATIVE'
  | 'BT_NOT_POSITIVE'
  | 'QUANTUM_NOT_POSITIVE'
  | 'ID_EMPTY'
  | 'ID_DUPLICATE'
  | 'ID_INVALID'
  | 'TOO_MANY'
  | 'TOO_FEW'
  | 'OUT_OF_RANGE'
  | 'INVALID_ALGORITHM';

export interface ValidationError {
  code: ValidationCode;
  field: 'id' | 'arrival' | 'burst' | 'quantum' | 'processes' | 'algorithm';
  row?: number; // 0-based, hanya galat baris
}

export type ParseResult =
  | { ok: true; processes: ProcessInput[]; config: SimConfig }
  | { ok: false; errors: ValidationError[] };

export class SimulationValidationError extends Error {
  override readonly name = 'SimulationValidationError';
  readonly errors: ValidationError[];
  constructor(errors: ValidationError[]) {
    super('Input simulasi tidak valid');
    this.errors = errors;
  }
}

export type ReasonCode =
  | 'FCFS_EARLIEST_ARRIVAL'
  | 'FCFS_TIE_INPUT_ORDER'
  | 'FCFS_ONLY_CANDIDATE'
  | 'SJF_SHORTEST_BURST'
  | 'SJF_TIE_ARRIVAL'
  | 'SJF_TIE_INPUT_ORDER'
  | 'SJF_ONLY_CANDIDATE'
  | 'RR_QUEUE_HEAD'
  | 'RR_CONTINUE_SAME'
  | 'IDLE_NO_READY';

export type SegmentEnd = 'COMPLETED' | 'QUANTUM_EXPIRED' | 'IDLE_END';

export interface Segment {
  kind: 'RUN' | 'IDLE';
  processId: string | null;
  start: number;
  end: number;
  endReason: SegmentEnd;
  continuesSameProcess: boolean;
}

export type SimEvent =
  | { type: 'ARRIVAL'; processId: string }
  | { type: 'COMPLETE'; processId: string }
  | { type: 'QUANTUM_EXPIRED'; processId: string; remaining: number }
  | { type: 'REQUEUE'; processId: string }
  | { type: 'DISPATCH'; processId: string; reason: ReasonCode }
  | { type: 'IDLE_START'; until: number }
  | { type: 'ALL_DONE' };

export interface Snapshot {
  time: number;
  running: string | null;
  readyQueue: string[];
  remaining: Record<string, number>;
  completed: string[];
  notArrived: string[];
}

export type Choice = { kind: 'RUN'; processId: string } | { kind: 'IDLE' };

export interface Decision {
  before: Snapshot; // setelah COMPLETE/QUANTUM_EXPIRED, ARRIVAL, REQUEUE; sebelum DISPATCH/IDLE_START
  candidates: string[];
  chosen: Choice;
  reason: ReasonCode;
}

export interface Step {
  index: number;
  time: number;
  events: SimEvent[];
  state: Snapshot; // setelah semua event
  decision?: Decision;
}

export interface ProcessMetrics {
  id: string;
  arrival: number;
  burst: number;
  start: number;
  completion: number;
  turnaround: number;
  waiting: number;
  response: number;
}

export interface Summary {
  avgTurnaround: number;
  avgWaiting: number;
  avgResponse: number;
  totalBurst: number;
  totalIdle: number;
  lastCompletion: number;
  utilization: number; // 0..1
}

export interface SimResult {
  segments: Segment[];
  steps: Step[];
  metrics: ProcessMetrics[];
  summary: Summary;
}
