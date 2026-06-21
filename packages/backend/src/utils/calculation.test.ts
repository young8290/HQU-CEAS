import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSportsBaseScore } from './calculation.js';

test('calculateSportsBaseScore uses physical test and PE course for freshman and sophomore students', () => {
  assert.equal(calculateSportsBaseScore({
    gradeStage: 'freshman',
    physicalTestScore: 80,
    peCourseScore: 90,
  }), 83);

  assert.equal(calculateSportsBaseScore({
    gradeStage: 'sophomore',
    physicalTestScore: 75,
    peCourseScore: 85,
  }), 78);
});

test('calculateSportsBaseScore uses physical test score for junior students', () => {
  assert.equal(calculateSportsBaseScore({
    gradeStage: 'junior',
    physicalTestScore: 81.5,
  }), 81.5);
});

test('calculateSportsBaseScore rejects missing PE course score for freshman and sophomore students', () => {
  assert.throws(() => calculateSportsBaseScore({
    gradeStage: 'freshman',
    physicalTestScore: 80,
  }), /体育课成绩/);
});
