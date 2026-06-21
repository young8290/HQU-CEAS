import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAwardCandidate,
  validateAwardAllocation,
  type AwardCandidateInput,
} from './awardRules.js';

const baseCandidate: AwardCandidateInput = {
  studentId: 1,
  classSize: 100,
  isComputerCategory: false,
  academicRank: 20,
  totalRank: 25,
  moralScore: 95,
  physicalTestScore: 70,
  communityScore: 99,
  tags: [],
};

test('evaluateAwardCandidate applies school scholarship rank thresholds for regular classes', () => {
  const result = evaluateAwardCandidate(baseCandidate, 'school_scholarship');
  assert.equal(result.eligible, true);
  assert.equal(result.blockedReasons.length, 0);
});

test('evaluateAwardCandidate applies stricter college scholarship rules for computer category classes', () => {
  const result = evaluateAwardCandidate({
    ...baseCandidate,
    isComputerCategory: true,
    academicRank: 26,
    totalRank: 30,
  }, 'college_scholarship');

  assert.equal(result.eligible, false);
  assert.match(result.blockedReasons.join('\n'), /学习成绩排名/);
});

test('evaluateAwardCandidate excludes college scholarship when mutual exclusion tags exist', () => {
  const result = evaluateAwardCandidate({
    ...baseCandidate,
    tags: ['national_scholarship'],
  }, 'college_scholarship');

  assert.equal(result.eligible, false);
  assert.match(result.blockedReasons.join('\n'), /互斥/);
});

test('validateAwardAllocation checks amount quota and award level structure', () => {
  assert.deepEqual(validateAwardAllocation({
    quotaCount: 4,
    availableAmount: 3000,
    firstCount: 1,
    secondCount: 1,
    thirdCount: 2,
  }), { valid: true, issues: [] });

  const invalid = validateAwardAllocation({
    quotaCount: 4,
    availableAmount: 3000,
    firstCount: 2,
    secondCount: 1,
    thirdCount: 1,
  });

  assert.equal(invalid.valid, false);
  assert.match(invalid.issues.join('\n'), /一等奖人数/);
});
