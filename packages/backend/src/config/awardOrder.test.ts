import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_EXTERNAL_AWARD_TYPES,
  AWARD_SELECTION_ORDER,
  assertExternalAwardType,
} from './awardRules.js';

test('external award imports are limited to national, inspirational and school scholarships', () => {
  assert.deepEqual(ALLOWED_EXTERNAL_AWARD_TYPES, [
    'national_scholarship',
    'national_inspirational_scholarship',
    'school_scholarship',
  ]);

  assert.doesNotThrow(() => assertExternalAwardType('national_scholarship'));
  assert.throws(() => assertExternalAwardType('moe_hmt_scholarship'), /仅支持导入/);
});

test('award selection order is national and inspirational, then school, then college and honors', () => {
  assert.deepEqual(AWARD_SELECTION_ORDER, [
    'national_scholarship',
    'national_inspirational_scholarship',
    'school_scholarship',
    'college_scholarship',
    'honor_declaration',
  ]);
});
