import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../simulate.ts';
import { SimulationValidationError, type ProcessInput, type SimConfig } from '../types.ts';

for (const [field, value, code] of [['arrival', '1', 'NOT_NUMBER'], ['burst', '1', 'NOT_NUMBER'], ['id', ' a ', 'ID_INVALID'], ['id', null, 'ID_INVALID']] as const) {
  test(`simulate rejects raw ${field}: ${value}`, () => {
    const input = [{ id: 'A', arrival: 0, burst: 1, [field]: value }];
    assert.throws(() => simulate(input as unknown as ProcessInput[], { algorithm: 'FCFS' }), (error: unknown) => {
      assert.ok(error instanceof SimulationValidationError);
      assert.deepEqual(error.errors, [{ code, field, row: 0 }]);
      return true;
    });
  });
}
test('simulate rejects text quantum for RR', () => {
  assert.throws(() => simulate([{ id: 'A', arrival: 0, burst: 1 }], { algorithm: 'RR', quantum: '2' } as unknown as SimConfig), (error: unknown) => {
    assert.ok(error instanceof SimulationValidationError);
    assert.deepEqual(error.errors, [{ code: 'NOT_NUMBER', field: 'quantum' }]);
    return true;
  });
});
