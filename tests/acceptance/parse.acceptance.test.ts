// QA acceptance: parseInput vs ADR-002 + PRD FR-11. Expected values from ADR table, not engine output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput } from '../../src/engine/parse.ts';

const row = (arrival: unknown, burst: unknown = '1', id: unknown = 'P1') => ({ id, arrival, burst });
const fcfs = { algorithm: 'FCFS' };
const codes = (r: ReturnType<typeof parseInput>) => (r.ok ? [] : r.errors);
const has = (r: ReturnType<typeof parseInput>, e: object) =>
  assert.ok(codes(r).some((x) => Object.entries(e).every(([k, v]) => (x as never)[k] === v)),
    `missing ${JSON.stringify(e)} in ${JSON.stringify(codes(r))}`);

// QA-PARSE-01: numeric grammar table (ADR-002)
const table: [unknown, string | number][] = [
  ['', 'EMPTY'], ['   ', 'EMPTY'],
  ['1.0', 1], ['+1', 1], ['01', 1], [' 7 ', 7], [0, 0], ['999', 999],
  ['1.5', 'NOT_INTEGER'], [1.5, 'NOT_INTEGER'],
  ['-1', 'AT_NEGATIVE'],
  ['1e2', 'NOT_NUMBER'], ['0x10', 'NOT_NUMBER'], ['1,5', 'NOT_NUMBER'], ['.5', 'NOT_NUMBER'], ['1.', 'NOT_NUMBER'],
  ['NaN', 'NOT_NUMBER'], ['Infinity', 'NOT_NUMBER'], [NaN, 'NOT_NUMBER'], [Infinity, 'NOT_NUMBER'],
  [true, 'NOT_NUMBER'], [null, 'NOT_NUMBER'], [undefined, 'NOT_NUMBER'], [[1], 'NOT_NUMBER'], [{}, 'NOT_NUMBER'],
  ['1000', 'OUT_OF_RANGE'], [1000, 'OUT_OF_RANGE'],
];
for (const [input, want] of table) {
  test(`QA-PARSE-01 arrival ${JSON.stringify(input) ?? 'undefined'} -> ${want}`, () => {
    const r = parseInput([row(input)], fcfs);
    if (typeof want === 'number') {
      assert.equal(r.ok, true, JSON.stringify(codes(r)));
      if (r.ok) assert.equal(r.processes[0].arrival, want);
    } else {
      assert.equal(r.ok, false);
      assert.deepEqual(codes(r), [{ code: want, field: 'arrival', row: 0 }]);
    }
  });
}

test('QA-PARSE-02 BT boundary: 0 and -1 -> BT_NOT_POSITIVE, 1 ok', () => {
  has(parseInput([row('0', '0')], fcfs), { code: 'BT_NOT_POSITIVE', field: 'burst', row: 0 });
  has(parseInput([row('0', '-1')], fcfs), { code: 'BT_NOT_POSITIVE', field: 'burst', row: 0 });
  assert.equal(parseInput([row('0', '1')], fcfs).ok, true);
});

test('QA-PARSE-03 quantum only for RR; no row', () => {
  assert.equal(parseInput([row('0')], { algorithm: 'FCFS', quantum: 'abc' }).ok, true);
  assert.equal(parseInput([row('0')], { algorithm: 'SJF' }).ok, true);
  for (const [q, code] of [['0', 'QUANTUM_NOT_POSITIVE'], ['', 'EMPTY'], [undefined, 'NOT_NUMBER'], ['1000', 'OUT_OF_RANGE']] as const)
    assert.deepEqual(codes(parseInput([row('0')], { algorithm: 'RR', quantum: q })), [{ code, field: 'quantum' }]);
  const ok = parseInput([row('0')], { algorithm: 'RR', quantum: '4' });
  assert.ok(ok.ok && ok.config.quantum === 4);
});

test('QA-PARSE-04 broken config -> single INVALID_ALGORITHM, no row, quantum unread', () => {
  for (const c of [null, undefined, [], 'RR', {}, { algorithm: 'SRTF', quantum: 'x' }, { algorithm: 'rr' }])
    assert.deepEqual(codes(parseInput([row('0')], c)), [{ code: 'INVALID_ALGORITHM', field: 'algorithm' }], JSON.stringify(c));
});

test('QA-PARSE-05 broken config + invalid process: both errors reported', () => {
  const r = parseInput([row('x')], null);
  has(r, { code: 'INVALID_ALGORITHM', field: 'algorithm' });
  has(r, { code: 'NOT_NUMBER', field: 'arrival', row: 0 });
});

test('QA-PARSE-06 process count bounds', () => {
  for (const p of [[], null, undefined, 'P1', {}])
    assert.deepEqual(codes(parseInput(p, fcfs)), [{ code: 'TOO_FEW', field: 'processes' }], JSON.stringify(p));
  const seven = Array.from({ length: 7 }, (_, i) => row('0', '1', `P${i + 1}`));
  has(parseInput(seven, fcfs), { code: 'TOO_MANY', field: 'processes' });
  assert.equal(parseInput(seven.slice(0, 6), fcfs).ok, true);
});

test('QA-PARSE-07 ID rules (A1)', () => {
  has(parseInput([row('0', '1', '  ')], fcfs), { code: 'ID_EMPTY', field: 'id', row: 0 });
  has(parseInput([row('0', '1', 'P-1')], fcfs), { code: 'ID_INVALID', field: 'id', row: 0 });
  has(parseInput([row('0', '1', 'ABCDEFGHI')], fcfs), { code: 'ID_INVALID', field: 'id', row: 0 });
  has(parseInput([row('0', '1', '<b>')], fcfs), { code: 'ID_INVALID', field: 'id', row: 0 });
  const ok8 = parseInput([row('0', '1', ' ABCDEFGH ')], fcfs);
  assert.ok(ok8.ok && ok8.processes[0].id === 'ABCDEFGH');
  const dup = parseInput([row('0', '1', 'p1'), row('0', '1', 'P1'), row('0', '1', ' P1 ')], fcfs);
  assert.deepEqual(codes(dup).filter((e) => e.code === 'ID_DUPLICATE').map((e) => e.row), [1, 2]);
  const idle = parseInput([row('0', '1', 'IDLE')], fcfs);
  assert.ok(idle.ok && idle.processes[0].id === 'IDLE');
});

test('QA-PARSE-09 non-string ID (ADR-002): null/undefined EMPTY, others INVALID, no coercion', () => {
  for (const id of [null, undefined])
    assert.deepEqual(codes(parseInput([{ id, arrival: '0', burst: '1' }], fcfs)), [{ code: 'ID_EMPTY', field: 'id', row: 0 }], String(id));
  for (const id of [42, true, {}, ['P1']])
    assert.deepEqual(codes(parseInput([row('0', '1', id)], fcfs)), [{ code: 'ID_INVALID', field: 'id', row: 0 }], JSON.stringify(id));
});

test('QA-PARSE-08 input not mutated', () => {
  const p = [row(' 1.0 ', '+2', ' a1 ')];
  const c = { algorithm: 'RR', quantum: '3' };
  const before = JSON.stringify([p, c]);
  parseInput(p, c);
  assert.equal(JSON.stringify([p, c]), before);
});
