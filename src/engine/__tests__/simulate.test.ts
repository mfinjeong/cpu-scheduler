import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../simulate.ts';
import { PRESETS } from '../presets.ts';
import { SimulationValidationError, type ProcessInput, type SimConfig, type SimResult } from '../types.ts';

// Nilai harapan dari PRD §9.2–9.3, ditulis tangan.
const SEGMENTS: Record<string, string> = {
  NP1: 'P1 0-2, P2 2-17, P3 17-28, P4 28-29, P5 29-46',
  NP2: 'P1 0-11, P3 11-27, P4 27-33, P5 33-43, P2 43-60',
  P1: 'P1 0-2, P2 2-12, P3 12-22, P4 22-23, P5 23-33, P2 33-38, P3 38-39, P5 39-46',
  P2: 'P1 0-10, P2 10-20, P3 20-30, P1 30-31, P4 31-37, P5 37-47, P2 47-54, P3 54-60',
  I1: 'IDLE 0-3, P1 3-5, IDLE 5-6, P2 6-21, IDLE 21-25, P3 25-36, IDLE 36-40, P4 40-41, IDLE 41-45, P5 45-62',
  I2: 'IDLE 0-2, P1 2-6, P1 6-10, P1 10-13, IDLE 13-20, P2 20-24, P2 24-28, P2 28-32, P2 32-36, P2 36-37, IDLE 37-45, P3 45-49, P3 49-53, P3 53-57, P3 57-61, IDLE 61-70, P4 70-74, P4 74-76, IDLE 76-90, P5 90-94, P5 94-98, P5 98-100, IDLE 100-108, P6 108-112',
};
const METRICS: Record<string, number[][]> = {
  // ST, CT, TAT, WT, RT
  NP1: [[0, 2, 17, 28, 29], [2, 17, 28, 29, 46], [2, 17, 28, 29, 46], [0, 2, 17, 28, 29], [0, 2, 17, 28, 29]],
  NP2: [[0, 43, 11, 27, 33], [11, 60, 27, 33, 43], [11, 56, 19, 21, 27], [0, 39, 3, 15, 17], [0, 39, 3, 15, 17]],
  P1: [[0, 2, 12, 22, 23], [2, 38, 39, 23, 46], [2, 38, 39, 23, 46], [0, 23, 28, 22, 29], [0, 2, 12, 22, 23]],
  P2: [[0, 10, 20, 31, 37], [31, 54, 60, 37, 47], [31, 50, 52, 25, 31], [20, 33, 36, 19, 21], [0, 6, 12, 19, 21]],
  I1: [[3, 6, 25, 40, 45], [5, 21, 36, 41, 62], [2, 15, 11, 1, 17], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
  I2: [[2, 20, 45, 70, 90, 108], [13, 37, 61, 76, 100, 112], [11, 17, 16, 6, 10, 4], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]],
};
const SUMMARY: Record<string, [number, number, number, number, number]> = {
  // ATAT, AWT, ART, idle, utilisasi%
  NP1: [24.4, 15.2, 15.2, 0, 100], NP2: [26.8, 14.8, 14.8, 0, 100], P1: [29.6, 20.4, 11.8, 0, 100],
  P2: [37.8, 25.8, 11.6, 0, 100], I1: [9.2, 0, 0, 16, 74.19], I2: [10.67, 0, 0, 48, 57.14],
};

const fmt = (r: SimResult) => r.segments.map((s) => `${s.processId ?? 'IDLE'} ${s.start}-${s.end}`).join(', ');
const round2 = (n: number) => Math.round(n * 100) / 100;

for (const preset of PRESETS) {
  test(`preset ${preset.id}: segmen, metrik, ringkasan`, () => {
    const r = simulate(preset.processes, preset.config);
    assert.equal(fmt(r), SEGMENTS[preset.id]);
    const m = r.metrics;
    assert.deepEqual(
      [m.map((x) => x.start), m.map((x) => x.completion), m.map((x) => x.turnaround), m.map((x) => x.waiting), m.map((x) => x.response)],
      METRICS[preset.id],
    );
    const s = r.summary;
    assert.deepEqual(
      [round2(s.avgTurnaround), round2(s.avgWaiting), round2(s.avgResponse), s.totalIdle, round2(s.utilization * 100)],
      SUMMARY[preset.id],
    );
    checkInvariants(preset.processes, preset.config, r);
  });
}

test('§9.5 kedatangan tepat di akhir quantum masuk sebelum requeue', () => {
  const r = simulate([{ id: 'A', arrival: 0, burst: 4 }, { id: 'B', arrival: 2, burst: 2 }], { algorithm: 'RR', quantum: 2 });
  assert.equal(fmt(r), 'A 0-2, B 2-4, A 4-6');
  const s2 = r.steps.find((s) => s.time === 2)!;
  assert.deepEqual(s2.events.map((e) => e.type), ['QUANTUM_EXPIRED', 'ARRIVAL', 'REQUEUE', 'DISPATCH']);
  assert.deepEqual(s2.decision!.before.readyQueue, ['B', 'A']);
  assert.equal(s2.decision!.before.running, null);
  assert.deepEqual(s2.state.readyQueue, ['A']);
  assert.equal(s2.state.running, 'B');
});

test('§9.5 kasus tepi lain', () => {
  // AT sama dan BT sama pada SJF: seri AT, lalu urutan input.
  const sjf = simulate([{ id: 'A', arrival: 0, burst: 3 }, { id: 'B', arrival: 1, burst: 2 }, { id: 'C', arrival: 1, burst: 2 }], { algorithm: 'SJF' });
  assert.equal(fmt(sjf), 'A 0-3, B 3-5, C 5-7');
  assert.equal(sjf.steps.find((s) => s.time === 3)!.decision!.reason, 'SJF_TIE_INPUT_ORDER');
  // Quantum lebih besar dari semua BT = FCFS.
  const big = [{ id: 'A', arrival: 0, burst: 2 }, { id: 'B', arrival: 0, burst: 3 }];
  assert.equal(fmt(simulate(big, { algorithm: 'RR', quantum: 10 })), fmt(simulate(big, { algorithm: 'FCFS' })));
  // Satu proses dengan idle awal.
  const one = simulate([{ id: 'X', arrival: 5, burst: 1 }], { algorithm: 'FCFS' });
  assert.equal(fmt(one), 'IDLE 0-5, X 5-6');
  assert.deepEqual(one.steps[0].decision!.chosen, { kind: 'IDLE' });
  assert.equal(one.steps[0].decision!.reason, 'IDLE_NO_READY');
});

test('kedatangan di tengah jatah menjadi langkah sendiri tanpa keputusan', () => {
  const r = simulate([{ id: 'A', arrival: 0, burst: 4 }, { id: 'B', arrival: 1, burst: 1 }], { algorithm: 'RR', quantum: 3 });
  const s1 = r.steps.find((s) => s.time === 1)!;
  assert.deepEqual(s1.events, [{ type: 'ARRIVAL', processId: 'B' }]);
  assert.equal(s1.decision, undefined);
  assert.equal(s1.state.running, 'A');
  assert.equal(s1.state.remaining.A, 3);
});

test('I2 t=6: P1 lanjut sendiri, RR_CONTINUE_SAME, before tidak memuat running', () => {
  const i2 = PRESETS.find((p) => p.id === 'I2')!;
  const step = simulate(i2.processes, i2.config).steps.find((s) => s.time === 6)!;
  assert.deepEqual(step.decision!.chosen, { kind: 'RUN', processId: 'P1' });
  assert.equal(step.decision!.reason, 'RR_CONTINUE_SAME');
  assert.equal(step.decision!.before.running, null);
});

test('proses bernama IDLE dibedakan dari CPU idle', () => {
  const r = simulate([{ id: 'IDLE', arrival: 1, burst: 1 }], { algorithm: 'FCFS' });
  assert.deepEqual(r.steps.map((s) => s.decision?.chosen), [{ kind: 'IDLE' }, { kind: 'RUN', processId: 'IDLE' }, undefined]);
});

test('simulate menolak input tidak valid dengan galat terstruktur', () => {
  const bad: [unknown, unknown][] = [
    [[{ id: 'A', arrival: NaN, burst: 1 }], { algorithm: 'FCFS' }],
    [[{ id: 'A', arrival: 0, burst: Infinity }], { algorithm: 'FCFS' }],
    [[{ id: 'A', arrival: 0.5, burst: 1 }], { algorithm: 'FCFS' }],
    [[{ id: 'A', arrival: 0, burst: 1000 }], { algorithm: 'FCFS' }],
    [[{ id: 'A', arrival: 0, burst: 1 }], { algorithm: 'RR', quantum: 0 }],
    [[{ id: 'A', arrival: 0, burst: 1 }], null],
  ];
  for (const [p, c] of bad) {
    assert.throws(() => simulate(p as ProcessInput[], c as SimConfig), (e: unknown) =>
      e instanceof SimulationValidationError && e.name === 'SimulationValidationError' && e.errors.length > 0);
  }
});

test('determinisme dan input tidak berubah', () => {
  const p = PRESETS[3].processes.map((x) => ({ ...x }));
  const snap = structuredClone(p);
  assert.deepEqual(simulate(p, { algorithm: 'RR', quantum: 3 }), simulate(p, { algorithm: 'RR', quantum: 3 }));
  assert.deepEqual(p, snap);
});

test('invarian pada input acak ber-seed', () => {
  let seed = 12345;
  const rnd = (n: number) => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % n;
  for (let i = 0; i < 300; i++) {
    const p = Array.from({ length: 1 + rnd(6) }, (_, k) => ({ id: `P${k + 1}`, arrival: rnd(30), burst: 1 + rnd(15) }));
    for (const config of [{ algorithm: 'FCFS' }, { algorithm: 'SJF' }, { algorithm: 'RR', quantum: 1 + rnd(6) }] as SimConfig[]) {
      checkInvariants(p, config, simulate(p, config), `seed iter ${i} ${JSON.stringify({ p, config })}`);
    }
  }
});

function checkInvariants(p: readonly ProcessInput[], c: SimConfig, r: SimResult, ctx = '') {
  let t = 0;
  for (const s of r.segments) {
    assert.equal(s.start, t, `INV-4 ${ctx}`);
    assert.ok(s.end > s.start, ctx);
    t = s.end;
    if (s.kind === 'RUN') {
      assert.ok(s.start >= p.find((x) => x.id === s.processId)!.arrival, `INV-5 ${ctx}`);
      if (c.algorithm === 'RR') assert.ok(s.end - s.start <= c.quantum!, `INV-6 ${ctx}`);
    }
  }
  for (const x of p) {
    const busy = r.segments.filter((s) => s.processId === x.id).reduce((a, s) => a + s.end - s.start, 0);
    assert.equal(busy, x.burst, `INV-1 ${ctx}`);
  }
  for (const m of r.metrics) {
    assert.equal(m.turnaround - m.waiting, m.burst, `INV-2 ${ctx}`);
    assert.ok(m.response >= 0 && m.waiting >= 0 && m.start >= m.arrival, `INV-2 ${ctx}`);
  }
  const busy = r.segments.filter((s) => s.kind === 'RUN').reduce((a, s) => a + s.end - s.start, 0);
  assert.equal(busy + r.summary.totalIdle, r.summary.lastCompletion, `INV-3 ${ctx}`);
  for (const s of r.steps) {
    if (s.decision?.chosen.kind === 'IDLE') assert.deepEqual(s.decision.before.readyQueue, [], `INV-7 ${ctx}`);
  }
}
