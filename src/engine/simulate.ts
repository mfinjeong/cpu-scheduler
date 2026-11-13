import { parseInput } from './parse.ts';
import {
  SimulationValidationError,
  type Choice,
  type ProcessInput,
  type ProcessMetrics,
  type ReasonCode,
  type Segment,
  type SimConfig,
  type SimEvent,
  type SimResult,
  type Snapshot,
  type Step,
} from './types.ts';

function pick(config: SimConfig, queue: string[], byId: Map<string, ProcessInput & { order: number }>, requeued: string | null): [number, ReasonCode] {
  if (config.algorithm === 'RR') {
    return [0, queue.length === 1 && queue[0] === requeued ? 'RR_CONTINUE_SAME' : 'RR_QUEUE_HEAD'];
  }
  const items = queue.map((id) => byId.get(id)!);
  if (config.algorithm === 'FCFS') {
    // Antrean sudah urut AT lalu urutan input (RULE-10).
    if (items.length === 1) return [0, 'FCFS_ONLY_CANDIDATE'];
    return [0, items.some((p, i) => i > 0 && p.arrival === items[0].arrival) ? 'FCFS_TIE_INPUT_ORDER' : 'FCFS_EARLIEST_ARRIVAL'];
  }
  if (items.length === 1) return [0, 'SJF_ONLY_CANDIDATE'];
  let best = 0;
  items.forEach((p, i) => {
    const b = items[best];
    if (p.burst < b.burst || (p.burst === b.burst && (p.arrival < b.arrival || (p.arrival === b.arrival && p.order < b.order)))) best = i;
  });
  const b = items[best];
  const sameBurst = items.filter((p) => p.burst === b.burst);
  if (sameBurst.length === 1) return [best, 'SJF_SHORTEST_BURST'];
  return [best, sameBurst.some((p) => p !== b && p.arrival === b.arrival) ? 'SJF_TIE_INPUT_ORDER' : 'SJF_TIE_ARRIVAL'];
}

export function simulate(processes: readonly ProcessInput[], config: SimConfig): SimResult {
  const parsed = parseInput(processes, config);
  const errors = parsed.ok ? [] : [...parsed.errors];
  const reject = (error: import('./types.ts').ValidationError) => {
    const index = errors.findIndex((e) => e.field === error.field && e.row === error.row);
    if (index < 0) errors.push(error);
    else errors[index] = error;
  };
  if (Array.isArray(processes)) {
    processes.forEach((p, row) => {
      if (typeof p?.id !== 'string' || p.id !== p.id.trim()) reject({ code: 'ID_INVALID', field: 'id', row });
      for (const field of ['arrival', 'burst'] as const) {
        if (typeof p?.[field] !== 'number') reject({ code: 'NOT_NUMBER', field, row });
      }
    });
  }
  if (config?.algorithm === 'RR' && typeof config.quantum !== 'number') reject({ code: 'NOT_NUMBER', field: 'quantum' });
  if (errors.length || !parsed.ok) throw new SimulationValidationError(errors);
  const cfg = parsed.config;

  const procs = parsed.processes.map((p, order) => ({ ...p, order }));
  const byId = new Map(procs.map((p) => [p.id, p]));
  // Urutan kedatangan: AT lalu urutan input (sort stabil).
  const pending = [...procs].sort((a, b) => a.arrival - b.arrival);
  const remaining: Record<string, number> = Object.fromEntries(procs.map((p) => [p.id, p.burst]));
  const start: Record<string, number> = {};
  const completion: Record<string, number> = {};
  const completed: string[] = [];
  const queue: string[] = [];
  const segments: Segment[] = [];
  const steps: Step[] = [];

  let t = 0;
  let running: string | null = null;
  let sliceEnd = 0;
  let idleUntil: number | null = null;

  const snapshot = (): Snapshot => ({
    time: t,
    running,
    readyQueue: [...queue],
    // Sisa burst proses aktif dihitung pada waktu t, bukan di akhir jatah.
    remaining: running === null ? { ...remaining } : { ...remaining, [running]: remaining[running] - (t - segments[segments.length - 1].start) },
    completed: [...completed],
    notArrived: pending.map((p) => p.id),
  });

  for (;;) {
    const events: SimEvent[] = [];
    let requeue: string | null = null;

    // RULE-20.1: selesai atau quantum habis.
    if (running !== null && t === sliceEnd) {
      const seg = segments[segments.length - 1];
      remaining[running] -= seg.end - seg.start;
      if (remaining[running] === 0) {
        events.push({ type: 'COMPLETE', processId: running });
        completed.push(running);
        completion[running] = t;
      } else {
        seg.endReason = 'QUANTUM_EXPIRED';
        events.push({ type: 'QUANTUM_EXPIRED', processId: running, remaining: remaining[running] });
        requeue = running;
      }
      running = null;
    }
    if (idleUntil === t) idleUntil = null;

    // RULE-20.2: kedatangan.
    while (pending.length > 0 && pending[0].arrival <= t) {
      const p = pending.shift()!;
      queue.push(p.id);
      events.push({ type: 'ARRIVAL', processId: p.id });
    }

    // RULE-20.3: requeue setelah kedatangan (RULE-13).
    if (requeue !== null) {
      queue.push(requeue);
      events.push({ type: 'REQUEUE', processId: requeue });
    }

    // RULE-20.4: keputusan.
    let decision: Step['decision'];
    if (running === null && idleUntil === null) {
      const before = snapshot();
      if (queue.length > 0) {
        const [i, reason] = pick(cfg, queue, byId, requeue);
        const id = queue.splice(i, 1)[0];
        running = id;
        start[id] ??= t;
        sliceEnd = t + (cfg.algorithm === 'RR' ? Math.min(remaining[id], cfg.quantum!) : remaining[id]);
        const prev = segments[segments.length - 1];
        if (prev && prev.kind === 'RUN' && prev.processId === id && prev.end === t) prev.continuesSameProcess = true;
        segments.push({ kind: 'RUN', processId: id, start: t, end: sliceEnd, endReason: 'COMPLETED', continuesSameProcess: false });
        events.push({ type: 'DISPATCH', processId: id, reason });
        decision = { before, candidates: before.readyQueue, chosen: { kind: 'RUN', processId: id } satisfies Choice, reason };
      } else if (pending.length > 0) {
        idleUntil = pending[0].arrival;
        segments.push({ kind: 'IDLE', processId: null, start: t, end: idleUntil, endReason: 'IDLE_END', continuesSameProcess: false });
        events.push({ type: 'IDLE_START', until: idleUntil });
        decision = { before, candidates: [], chosen: { kind: 'IDLE' }, reason: 'IDLE_NO_READY' };
      } else {
        events.push({ type: 'ALL_DONE' });
      }
    }

    if (events.length > 0) steps.push({ index: steps.length, time: t, events, state: snapshot(), ...(decision && { decision }) });
    if (events.at(-1)?.type === 'ALL_DONE') break;

    t = Math.min(running !== null ? sliceEnd : Infinity, idleUntil ?? Infinity, pending[0]?.arrival ?? Infinity);
  }

  const metrics: ProcessMetrics[] = procs.map(({ id, arrival, burst }) => {
    const turnaround = completion[id] - arrival;
    return { id, arrival, burst, start: start[id], completion: completion[id], turnaround, waiting: turnaround - burst, response: start[id] - arrival };
  });
  const n = metrics.length;
  const sum = (f: (m: ProcessMetrics) => number) => metrics.reduce((a, m) => a + f(m), 0);
  const totalBurst = sum((m) => m.burst);
  const lastCompletion = Math.max(...metrics.map((m) => m.completion));

  return {
    segments,
    steps,
    metrics,
    summary: {
      avgTurnaround: sum((m) => m.turnaround) / n,
      avgWaiting: sum((m) => m.waiting) / n,
      avgResponse: sum((m) => m.response) / n,
      totalBurst,
      totalIdle: lastCompletion - totalBurst,
      lastCompletion,
      utilization: totalBurst / lastCompletion,
    },
  };
}
