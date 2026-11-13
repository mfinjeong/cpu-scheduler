import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput } from '../parse.ts';

const row = (arrival: unknown, burst: unknown = '1', id: unknown = 'P1') => ({ id, arrival, burst });
const fcfs = { algorithm: 'FCFS' };
const errs = (p: unknown, c: unknown) => {
  const r = parseInput(p, c);
  return r.ok ? [] : r.errors;
};

const numeric: [unknown, string | number][] = [
  ['', 'EMPTY'], ['   ', 'EMPTY'],
  ['1.0', 1], ['+1', 1], ['01', 1], [' 7 ', 7], [5, 5],
  ['1.5', 'NOT_INTEGER'], [1.5, 'NOT_INTEGER'],
  ['-1', 'AT_NEGATIVE'],
  ['1e2', 'NOT_NUMBER'], ['0x10', 'NOT_NUMBER'], ['1,5', 'NOT_NUMBER'], ['.5', 'NOT_NUMBER'], ['1.', 'NOT_NUMBER'],
  ['NaN', 'NOT_NUMBER'], ['Infinity', 'NOT_NUMBER'], [NaN, 'NOT_NUMBER'], [Infinity, 'NOT_NUMBER'],
  [true, 'NOT_NUMBER'], [null, 'NOT_NUMBER'], [undefined, 'NOT_NUMBER'], [{}, 'NOT_NUMBER'],
  ['999', 999], ['1000', 'OUT_OF_RANGE'],
];

for (const [input, want] of numeric) {
  test(`arrival ${JSON.stringify(input) ?? String(input)} -> ${want}`, () => {
    const r = parseInput([row(input)], fcfs);
    if (typeof want === 'number') {
      assert.ok(r.ok);
      assert.equal(r.processes[0].arrival, want);
    } else {
      assert.deepEqual(errs([row(input)], fcfs), [{ code: want, field: 'arrival', row: 0 }]);
    }
  });
}

test('burst 0 -> BT_NOT_POSITIVE', () => {
  assert.deepEqual(errs([row('0', '0')], fcfs), [{ code: 'BT_NOT_POSITIVE', field: 'burst', row: 0 }]);
});

test('RR quantum: 0, empty, missing', () => {
  const p = [row('0')];
  assert.deepEqual(errs(p, { algorithm: 'RR', quantum: '0' }), [{ code: 'QUANTUM_NOT_POSITIVE', field: 'quantum' }]);
  assert.deepEqual(errs(p, { algorithm: 'RR', quantum: '' }), [{ code: 'EMPTY', field: 'quantum' }]);
  assert.deepEqual(errs(p, { algorithm: 'RR' }), [{ code: 'NOT_NUMBER', field: 'quantum' }]);
});

test('quantum ignored for FCFS/SJF', () => {
  const r = parseInput([row('0')], { algorithm: 'SJF', quantum: 'x' });
  assert.ok(r.ok);
  assert.deepEqual(r.config, { algorithm: 'SJF' });
});

for (const c of [null, undefined, [], 'RR', {}, { algorithm: 'SRTF', quantum: 'x' }]) {
  test(`config ${JSON.stringify(c) ?? 'undefined'} -> single INVALID_ALGORITHM`, () => {
    assert.deepEqual(errs([row('0')], c), [{ code: 'INVALID_ALGORITHM', field: 'algorithm' }]);
  });
}

test('broken config does not hide process errors', () => {
  assert.deepEqual(errs([row('')], null), [
    { code: 'EMPTY', field: 'arrival', row: 0 },
    { code: 'INVALID_ALGORITHM', field: 'algorithm' },
  ]);
});

test('process count', () => {
  assert.deepEqual(errs([], fcfs), [{ code: 'TOO_FEW', field: 'processes' }]);
  assert.deepEqual(errs(null, fcfs), [{ code: 'TOO_FEW', field: 'processes' }]);
  assert.deepEqual(errs('x', fcfs), [{ code: 'TOO_FEW', field: 'processes' }]);
  const seven = Array.from({ length: 7 }, (_, i) => row('0', '1', `P${i + 1}`));
  assert.deepEqual(errs(seven, fcfs), [{ code: 'TOO_MANY', field: 'processes' }]);
});

test('ID rules: trim, empty, invalid, length, case-insensitive duplicate on 2nd+', () => {
  const r = parseInput([row('0', '1', ' p1 ')], fcfs);
  assert.ok(r.ok);
  assert.equal(r.processes[0].id, 'p1');
  assert.deepEqual(errs([row('0', '1', '  ')], fcfs), [{ code: 'ID_EMPTY', field: 'id', row: 0 }]);
  assert.deepEqual(errs([row('0', '1', 'P-1')], fcfs), [{ code: 'ID_INVALID', field: 'id', row: 0 }]);
  assert.deepEqual(errs([row('0', '1', 'ABCDEFGHI')], fcfs), [{ code: 'ID_INVALID', field: 'id', row: 0 }]);
  assert.deepEqual(errs([row('0', '1', 'Ä1')], fcfs), [{ code: 'ID_INVALID', field: 'id', row: 0 }]);
  assert.deepEqual(errs([row('0', '1', 42)], fcfs), [{ code: 'ID_INVALID', field: 'id', row: 0 }]);
  assert.deepEqual(errs([row('0', '1', 'P1'), row('0', '1', 'p1'), row('0', '1', 'P1')], fcfs), [
    { code: 'ID_DUPLICATE', field: 'id', row: 1 },
    { code: 'ID_DUPLICATE', field: 'id', row: 2 },
  ]);
  assert.ok(parseInput([row('0', '1', 'IDLE')], fcfs).ok);
});

test('non-object row -> errors on all fields, no TypeError', () => {
  assert.equal(errs([null], fcfs).length > 0, true);
});

test('does not mutate input', () => {
  const p = [row(' 1 ')];
  const snap = structuredClone(p);
  parseInput(p, fcfs);
  assert.deepEqual(p, snap);
});
