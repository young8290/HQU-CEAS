import test from 'node:test';
import assert from 'node:assert/strict';
import { readSportsImportRow } from './importService.js';

test('readSportsImportRow reads physical test, PE course, grade stage and community score', () => {
  const result = readSportsImportRow({
    studentNo: '20230001',
    name: '学生一',
    physicalTestScore: '82',
    peCourseScore: '91',
    gradeStage: '大二',
    communityScore: '98',
  });

  assert.deepEqual(result, {
    studentNo: '20230001',
    name: '学生一',
    physicalTestScore: 82,
    peCourseScore: 91,
    gradeStage: 'sophomore',
    communityScore: 98,
  });
});

test('readSportsImportRow keeps community score undefined when the cell is empty', () => {
  const result = readSportsImportRow({
    studentNo: '20230002',
    name: '学生二',
    physicalTestScore: '78',
    peCourseScore: '',
    gradeStage: '大三',
    communityScore: '',
  });

  assert.equal(result.gradeStage, 'junior');
  assert.equal(result.communityScore, undefined);
});
