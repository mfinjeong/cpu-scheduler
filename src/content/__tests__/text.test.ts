import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, pct } from '../text.ts';

test('format angka Indonesia RULE-31', () => {
  assert.equal(num(24.4), '24,40');
  assert.equal(num(0), '0');
  assert.equal(num(10.666666), '10,67');
  assert.equal(num(1000), '1000');
  assert.equal(pct(46 / 62), '74,19%');
  assert.equal(pct(1), '100%');
});
