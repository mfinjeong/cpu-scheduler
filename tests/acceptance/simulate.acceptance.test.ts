// QA acceptance: simulate vs PRD §4, §9, ADR-002. Expected values typed from PRD, NOT from engine output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../../src/engine/simulate.ts';
import { PRESETS } from '../../src/engine/presets.ts';
import type { ProcessInput, SimConfig, SimResult } from '../../src/engine/types.ts';

const P = (ats: number[], bts: number[]): ProcessInput[] => ats.map((arrival, i) => ({ id: `P${i + 1}`, arrival, burst: bts[i] }));
const segStr = (r: SimResult) => r.segments.map((s) => `${s.processId ?? 'IDLE'} ${s.start}-${s.end}`).join(', ');
const r2 = (x: number) => Math.round(x * 100) / 100;

// PRD §9.1–9.3 transcribed by hand.
const FIX = {
  NP1: { alg: 'FCFS', at: [0, 0, 0, 0, 0], bt: [2, 15, 11, 1, 17], avg: [24.4, 15.2, 15.2], idle: 0, util: 1,
    seg: 'P1 0-2, P2 2-17, P3 17-28, P4 28-29, P5 29-46',
    st: [0, 2, 17, 28, 29], ct: [2, 17, 28, 29, 46], tat: [2, 17, 28, 29, 46], wt: [0, 2, 17, 28, 29], rt: [0, 2, 17, 28, 29] },
  NP2: { alg: 'SJF', at: [0, 4, 8, 12, 16], bt: [11, 17, 16, 6, 10], avg: [26.8, 14.8, 14.8], idle: 0, util: 1,
    seg: 'P1 0-11, P3 11-27, P4 27-33, P5 33-43, P2 43-60',
    st: [0, 43, 11, 27, 33], ct: [11, 60, 27, 33, 43], tat: [11, 56, 19, 21, 27], wt: [0, 39, 3, 15, 17], rt: [0, 39, 3, 15, 17] },
  P1: { alg: 'RR', q: 10, at: [0, 0, 0, 0, 0], bt: [2, 15, 11, 1, 17], avg: [29.6, 20.4, 11.8], idle: 0, util: 1,
    seg: 'P1 0-2, P2 2-12, P3 12-22, P4 22-23, P5 23-33, P2 33-38, P3 38-39, P5 39-46',
    st: [0, 2, 12, 22, 23], ct: [2, 38, 39, 23, 46], tat: [2, 38, 39, 23, 46], wt: [0, 23, 28, 22, 29], rt: [0, 2, 12, 22, 23] },
  P2: { alg: 'RR', q: 10, at: [0, 4, 8, 12, 16], bt: [11, 17, 16, 6, 10], avg: [37.8, 25.8, 11.6], idle: 0, util: 1,
    seg: 'P1 0-10, P2 10-20, P3 20-30, P1 30-31, P4 31-37, P5 37-47, P2 47-54, P3 54-60',
    st: [0, 10, 20, 31, 37], ct: [31, 54, 60, 37, 47], tat: [31, 50, 52, 25, 31], wt: [20, 33, 36, 19, 21], rt: [0, 6, 12, 19, 21] },
  I1: { alg: 'FCFS', at: [3, 6, 25, 40, 45], bt: [2, 15, 11, 1, 17], avg: [9.2, 0, 0], idle: 16, util: 0.7419,
    seg: 'IDLE 0-3, P1 3-5, IDLE 5-6, P2 6-21, IDLE 21-25, P3 25-36, IDLE 36-40, P4 40-41, IDLE 41-45, P5 45-62',
    st: [3, 6, 25, 40, 45], ct: [5, 21, 36, 41, 62], tat: [2, 15, 11, 1, 17], wt: [0, 0, 0, 0, 0], rt: [0, 0, 0, 0, 0] },
  I2: { alg: 'RR', q: 4, at: [2, 20, 45, 70, 90, 108], bt: [11, 17, 16, 6, 10, 4], avg: [10.67, 0, 0], idle: 48, util: 0.5714,
    seg: 'IDLE 0-2, P1 2-6, P1 6-10, P1 10-13, IDLE 13-20, P2 20-24, P2 24-28, P2 28-32, P2 32-36, P2 36-37, IDLE 37-45, P3 45-49, P3 49-53, P3 53-57, P3 57-61, IDLE 61-70, P4 70-74, P4 74-76, IDLE 76-90, P5 90-94, P5 94-98, P5 98-100, IDLE 100-108, P6 108-112',
    st: [2, 20, 45, 70, 90, 108], ct: [13, 37, 61, 76, 100, 112], tat: [11, 17, 16, 6, 10, 4], wt: [0, 0, 0, 0, 0, 0], rt: [0, 0, 0, 0, 0, 0] },
} as const;

for (const [name, f] of Object.entries(FIX)) {
  test(`QA-FIX-${name} preset input, segments, per-process metrics, summary (M1)`, () => {
    const procs = P([...f.at], [...f.bt]);
    const cfg: SimConfig = 'q' in f ? { algorithm: f.alg, quantum: f.q } : { algorithm: f.alg };
    const pre = PRESETS.find((p) => p.id === name);
    assert.ok(pre, `preset ${name} missing`);
    assert.deepEqual([...pre.processes], procs, 'preset data != PRD');
    assert.deepEqual(pre.config, cfg, 'preset config != PRD');
    const r = simulate(procs, cfg);
    assert.equal(segStr(r), f.seg);
    const m = r.metrics;
    assert.deepEqual(m.map((x) => x.id), procs.map((x) => x.id));
    assert.deepEqual(m.map((x) => x.start), [...f.st]);
    assert.deepEqual(m.map((x) => x.completion), [...f.ct]);
    assert.deepEqual(m.map((x) => x.turnaround), [...f.tat]);
    assert.deepEqual(m.map((x) => x.waiting), [...f.wt]);
    assert.deepEqual(m.map((x) => x.response), [...f.rt]);
    const s = r.summary;
    assert.deepEqual([r2(s.avgTurnaround), r2(s.avgWaiting), r2(s.avgResponse)], [...f.avg]);
    assert.equal(s.totalIdle, f.idle);
    assert.equal(Math.round(s.utilization * 10000) / 10000, f.util);
  });
}

test('QA-FIX-P2b P1 completes at t=31 (PRD §9.2 note)', () => {
  const r = simulate(P([0, 4, 8, 12, 16], [11, 17, 16, 6, 10]), { algorithm: 'RR', quantum: 10 });
  assert.equal(r.metrics[0].completion, 31);
});

test('QA-AVG-01 averages from raw values, not rounded (RULE-31)', () => {
  const r = simulate(P([2, 20, 45, 70, 90, 108], [11, 17, 16, 6, 10, 4]), { algorithm: 'RR', quantum: 4 });
  assert.equal(r.summary.avgTurnaround, 64 / 6);
});

// §9.5 edge cases, expected values computed by hand.
const edge: [string, ProcessInput[], SimConfig, string][] = [
  ['arrival exactly at quantum end (A0/4, B2/2, q2)', [{ id: 'A', arrival: 0, burst: 4 }, { id: 'B', arrival: 2, burst: 2 }], { algorithm: 'RR', quantum: 2 }, 'A 0-2, B 2-4, A 4-6'],
  ['same AT FCFS keeps input order', P([5, 5, 5], [3, 1, 2]), { algorithm: 'FCFS' }, 'IDLE 0-5, P1 5-8, P2 8-9, P3 9-11'],
  ['SJF equal BT tie on AT then input order', P([0, 2, 1, 1], [5, 3, 3, 3]), { algorithm: 'SJF' }, 'P1 0-5, P3 5-8, P4 8-11, P2 11-14'],
  ['SJF ignores not-yet-arrived shorter job', P([0, 1], [5, 1]), { algorithm: 'SJF' }, 'P1 0-5, P2 5-6'],
  ['quantum larger than all BT == FCFS', P([0, 0, 0], [2, 3, 1]), { algorithm: 'RR', quantum: 50 }, 'P1 0-2, P2 2-5, P3 5-6'],
  ['single process', P([0], [3]), { algorithm: 'RR', quantum: 1 }, 'P1 0-1, P1 1-2, P1 2-3'],
  ['empty queue mid-simulation', P([0, 10], [2, 2]), { algorithm: 'SJF' }, 'P1 0-2, IDLE 2-10, P2 10-12'],
  ['idle at start', P([4], [1]), { algorithm: 'FCFS' }, 'IDLE 0-4, P1 4-5'],
  ['RR arrival mid-slice no preemption', P([0, 1], [3, 1]), { algorithm: 'RR', quantum: 3 }, 'P1 0-3, P2 3-4'],
];
for (const [name, procs, cfg, want] of edge)
  test(`QA-EDGE ${name}`, () => assert.equal(segStr(simulate(procs, cfg)), want));

test('QA-RULE20 same-time event order: expire, arrival, requeue, dispatch', () => {
  const r = simulate([{ id: 'A', arrival: 0, burst: 4 }, { id: 'B', arrival: 2, burst: 2 }], { algorithm: 'RR', quantum: 2 });
  const s = r.steps.find((x) => x.time === 2);
  assert.ok(s);
  assert.deepEqual(s.events.map((e) => `${e.type}:${'processId' in e ? e.processId : ''}`),
    ['QUANTUM_EXPIRED:A', 'ARRIVAL:B', 'REQUEUE:A', 'DISPATCH:B']);
  assert.deepEqual(s.decision?.before.readyQueue, ['B', 'A']);
  assert.equal(s.decision?.before.running, null);
  assert.deepEqual(s.decision?.chosen, { kind: 'RUN', processId: 'B' });
  assert.equal(s.state.running, 'B');
  assert.deepEqual(s.state.readyQueue, ['A']);
});

test('QA-STEP-01 mid-slice arrival is own step; running unchanged (FR-06 AC4)', () => {
  const r = simulate(P([0, 4, 8, 12, 16], [11, 17, 16, 6, 10]), { algorithm: 'RR', quantum: 10 });
  assert.equal(r.steps[0].time, 0);
  const s = r.steps.find((x) => x.time === 4);
  assert.ok(s, 'no step at t=4');
  assert.deepEqual(s.events, [{ type: 'ARRIVAL', processId: 'P2' }]);
  assert.equal(s.decision, undefined);
  assert.equal(s.state.running, 'P1');
  assert.deepEqual(s.state.readyQueue, ['P2']);
  assert.equal(s.state.remaining.P1, 7);
  assert.deepEqual(r.steps.map((x) => x.index), r.steps.map((_, i) => i));
  const times = r.steps.map((x) => x.time);
  assert.deepEqual(times, [...new Set(times)].sort((a, b) => a - b), 'one step per time point');
});

test('QA-PRACT-01 I2 t=6: decision before is leak-free; continue-same', () => {
  const r = simulate(P([2, 20, 45, 70, 90, 108], [11, 17, 16, 6, 10, 4]), { algorithm: 'RR', quantum: 4 });
  const s = r.steps.find((x) => x.time === 6);
  assert.ok(s?.decision);
  assert.equal(s.decision.before.running, null);
  assert.deepEqual(s.decision.before.readyQueue, ['P1']);
  assert.equal(s.decision.before.remaining.P1, 7);
  assert.deepEqual(s.decision.candidates, ['P1']);
  assert.deepEqual(s.decision.chosen, { kind: 'RUN', processId: 'P1' });
  assert.equal(s.decision.reason, 'RR_CONTINUE_SAME');
  const seg = r.segments.find((x) => x.start === 2);
  assert.equal(seg?.continuesSameProcess, true);
});

test('QA-PRACT-02 idle decision uses Choice IDLE; process named IDLE distinct', () => {
  const r = simulate([{ id: 'IDLE', arrival: 3, burst: 1 }], { algorithm: 'FCFS' });
  assert.deepEqual(r.steps[0].decision?.chosen, { kind: 'IDLE' });
  assert.equal(r.steps[0].decision?.reason, 'IDLE_NO_READY');
  assert.deepEqual(r.segments.map((x) => [x.kind, x.processId]), [['IDLE', null], ['RUN', 'IDLE']]);
  const d = r.steps.find((x) => x.time === 3)?.decision;
  assert.deepEqual(d?.chosen, { kind: 'RUN', processId: 'IDLE' });
});

test('QA-REASON-01 SJF tie reasons', () => {
  const r = simulate(P([0, 2, 1, 1], [5, 3, 3, 3]), { algorithm: 'SJF' });
  const reasons = r.steps.filter((x) => x.decision?.chosen.kind === 'RUN').map((x) => x.decision?.reason);
  // t=5: P2/P3/P4 BT 3; AT narrows to P3/P4; input order decides -> deepest tiebreak used.
  // t=8: P2 vs P4 BT 3; AT decides.
  assert.deepEqual(reasons, ['SJF_ONLY_CANDIDATE', 'SJF_TIE_INPUT_ORDER', 'SJF_TIE_ARRIVAL', 'SJF_ONLY_CANDIDATE']);
});

test('QA-ERR-01 direct simulate rejects invalid input structurally, no partial result', () => {
  const bad: [unknown, unknown, string, string][] = [
    [[{ id: '1', arrival: '1', burst: 1 }], { algorithm: 'FCFS' }, 'NOT_NUMBER', 'arrival'],
    [[{ id: 'P1', arrival: 0, burst: '1' }], { algorithm: 'FCFS' }, 'NOT_NUMBER', 'burst'],
    [P([0], [1]), { algorithm: 'RR', quantum: '2' }, 'NOT_NUMBER', 'quantum'],
    [[{ id: ' a ', arrival: 0, burst: 1 }], { algorithm: 'FCFS' }, 'ID_INVALID', 'id'],
    [[{ id: 42, arrival: 0, burst: 1 }], { algorithm: 'FCFS' }, 'ID_INVALID', 'id'],
    [P([NaN], [1]), { algorithm: 'FCFS' }, 'NOT_NUMBER', 'arrival'],
    [P([0], [Infinity]), { algorithm: 'FCFS' }, 'NOT_NUMBER', 'burst'],
    [P([0.5], [1]), { algorithm: 'FCFS' }, 'NOT_INTEGER', 'arrival'],
    [P([1000], [1]), { algorithm: 'FCFS' }, 'OUT_OF_RANGE', 'arrival'],
    [P([0], [1]), { algorithm: 'RR', quantum: 0 }, 'QUANTUM_NOT_POSITIVE', 'quantum'],
    [P([0], [1]), { algorithm: 'RR' }, 'NOT_NUMBER', 'quantum'],
    [P([0], [1]), { algorithm: 'SRTF' }, 'INVALID_ALGORITHM', 'algorithm'],
    [P([0], [1]), null, 'INVALID_ALGORITHM', 'algorithm'],
    [[], { algorithm: 'FCFS' }, 'TOO_FEW', 'processes'],
    [null, { algorithm: 'FCFS' }, 'TOO_FEW', 'processes'],
  ];
  for (const [p, c, code, field] of bad)
    assert.throws(() => simulate(p as never, c as never), (e: unknown) => {
      const err = e as { name: string; errors: { code: string; field: string }[] };
      assert.equal(err.name, 'SimulationValidationError');
      assert.ok(err.errors.some((x) => x.code === code && x.field === field), `${code}/${field}: ${JSON.stringify(err.errors)}`);
      return true;
    });
});

// ---- Property tests (M2), seeded, reproducible: QA_SEED=<n> ----
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SEED = Number(process.env.QA_SEED ?? 20261113);

test(`QA-PROP-01 INV-1..8 + algorithm properties, 500 cases, seed ${SEED}`, () => {
  const rnd = mulberry32(SEED);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  for (let k = 0; k < 500; k++) {
    const n = int(1, 6);
    const small = rnd() < 0.8; // mostly small values to force ties
    const procs = Array.from({ length: n }, (_, i) => ({ id: `P${i + 1}`, arrival: small ? int(0, 12) : int(0, 999), burst: small ? int(1, 8) : int(1, 999) }));
    const alg = (['FCFS', 'SJF', 'RR'] as const)[int(0, 2)];
    const cfg: SimConfig = alg === 'RR' ? { algorithm: alg, quantum: small ? int(1, 5) : int(1, 999) } : { algorithm: alg };
    const ctx = `case ${k} seed ${SEED}: ${JSON.stringify({ procs, cfg })}`;
    const frozen = JSON.stringify([procs, cfg]);
    const r = simulate(procs, cfg);
    assert.equal(JSON.stringify([procs, cfg]), frozen, `INV-8 ${ctx}`);
    assert.deepEqual(simulate(procs, cfg), r, `NFR-05 ${ctx}`);
    const segs = r.segments;
    const last = r.summary.lastCompletion;
    // INV-4
    assert.equal(segs[0].start, 0, `INV-4 ${ctx}`);
    segs.forEach((s, i) => { assert.ok(s.end > s.start, `INV-4 ${ctx}`); if (i) assert.equal(s.start, segs[i - 1].end, `INV-4 ${ctx}`); });
    assert.equal(segs.at(-1)!.end, last, ctx);
    let busy = 0, idle = 0;
    for (const p of procs) {
      const mine = segs.filter((s) => s.processId === p.id && s.kind === 'RUN');
      assert.equal(mine.reduce((a, s) => a + s.end - s.start, 0), p.burst, `INV-1 ${ctx}`);
      assert.ok(mine.every((s) => s.start >= p.arrival), `INV-5 ${ctx}`);
      if (alg !== 'RR') assert.equal(mine.length, 1, `non-preemptive ${ctx}`);
      const m = r.metrics.find((x) => x.id === p.id)!;
      assert.equal(m.start, mine[0].start, ctx);
      assert.equal(m.completion, mine.at(-1)!.end, ctx);
      assert.equal(m.turnaround - m.waiting, p.burst, `INV-2 ${ctx}`);
      assert.ok(m.response >= 0 && m.waiting >= 0 && m.start >= p.arrival, `INV-2 ${ctx}`);
    }
    for (const s of segs) {
      if (s.kind === 'IDLE') {
        idle += s.end - s.start;
        // INV-7: nobody ready during idle; idle ends at next arrival
        assert.ok(procs.every((p) => p.arrival <= s.start ? r.metrics.find((x) => x.id === p.id)!.completion <= s.start : p.arrival >= s.end), `INV-7 ${ctx}`);
        assert.ok(procs.some((p) => p.arrival === s.end), `IDLE_END ${ctx}`);
      } else busy += s.end - s.start;
      if (alg === 'RR' && s.kind === 'RUN') assert.ok(s.end - s.start <= cfg.quantum!, `INV-6 ${ctx}`);
    }
    assert.equal(busy + idle, last, `INV-3 ${ctx}`);
    assert.equal(r.summary.totalIdle, last - procs.reduce((a, p) => a + p.burst, 0), `RULE-33 ${ctx}`);
    // continuesSameProcess consistent with neighbours
    segs.forEach((s, i) => assert.equal(s.continuesSameProcess, s.kind === 'RUN' && segs[i + 1]?.processId === s.processId, `RULE-15 ${ctx}`));
    // decisions: snapshots + choice rule
    for (const st of r.steps) {
      assert.ok(st.state.running === null || !st.state.readyQueue.includes(st.state.running), `queue excludes running ${ctx}`);
      const d = st.decision;
      if (!d) continue;
      assert.equal(d.before.running, null, `before.running ${ctx}`);
      assert.deepEqual(d.candidates, d.before.readyQueue, ctx);
      if (d.chosen.kind === 'IDLE') { assert.equal(d.candidates.length, 0, ctx); continue; }
      const id = d.chosen.processId;
      const by = (x: string) => procs.find((p) => p.id === x)!;
      if (alg === 'RR') assert.equal(id, d.candidates[0], `RULE-12 ${ctx}`);
      if (alg === 'FCFS') assert.ok(d.candidates.every((c) => by(c).arrival >= by(id).arrival), `RULE-10 ${ctx}`);
      if (alg === 'SJF') {
        const key = (x: string) => [by(x).burst, by(x).arrival, procs.indexOf(by(x))];
        const best = [...d.candidates].sort((a, b) => { const ka = key(a), kb = key(b); return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2]; })[0];
        assert.equal(id, best, `RULE-11 ${ctx}`);
      }
    }
  }
});

test('QA-PERF-01 RR max input (6 x BT 999, q=1) under 50 ms in Node (NFR-04 proxy only)', () => {
  const procs = P([0, 0, 0, 0, 0, 0], [999, 999, 999, 999, 999, 999]);
  simulate(procs, { algorithm: 'RR', quantum: 1 });
  const times: number[] = [];
  let r!: SimResult;
  for (let i = 0; i < 5; i++) { const t = performance.now(); r = simulate(procs, { algorithm: 'RR', quantum: 1 }); times.push(performance.now() - t); }
  times.sort((a, b) => a - b);
  console.log(`QA-PERF-01 times ms: ${times.map((x) => x.toFixed(1)).join(', ')}`);
  assert.equal(r.segments.length, 5994);
  assert.ok(times[2] < 50, `median ${times[2]} ms`);
});
