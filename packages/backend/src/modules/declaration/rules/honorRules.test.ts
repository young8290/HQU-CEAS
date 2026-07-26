import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateHonorCandidate,
  type HonorCandidateInput,
} from './honorRules.js';

const baseCandidate: HonorCandidateInput = {
  studentId: 1,
  classSize: 100,
  isComputerCategory: false,
  academicRank: 25,
  totalRank: 8,
  moralScore: 92,
  sportsBaseScore: 82,
  communityScore: 99,
  tags: ['school_scholarship'],
};

test('evaluateHonorCandidate accepts school excellent student with scholarship tag and rank conditions', () => {
  const result = evaluateHonorCandidate(baseCandidate, 'excellent_student');
  assert.equal(result.eligible, true);
});

test('evaluateHonorCandidate requires stronger rank for regular school excellent student candidates', () => {
  const result = evaluateHonorCandidate({
    ...baseCandidate,
    totalRank: 11,
  }, 'excellent_student');

  assert.equal(result.eligible, false);
  assert.match(result.blockedReasons.join('\n'), /综测排名/);
});

test('evaluateHonorCandidate marks cadre material requirements as manual review requirements', () => {
  const result = evaluateHonorCandidate(baseCandidate, 'excellent_cadre');
  assert.equal(result.eligible, true);
  assert.ok(result.materialRequirements.length > 0);
});
