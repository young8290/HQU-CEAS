import test from 'node:test';
import assert from 'node:assert/strict';
import { readDeclarationSupplementRow } from './declarationSupplementService.js';

test('readDeclarationSupplementRow reads the template without average GPA column', () => {
  const row = readDeclarationSupplementRow([
    '2225121000',
    '张三',
    '男',
    '无',
    '是',
    '院级',
    '是',
    '学生会推荐',
    '校级',
    '2024-2025学年担任班长。',
    '华侨大学电脑大赛二等奖。',
    '境外生源地',
  ]);

  assert.equal(row.studentNo, '2225121000');
  assert.equal(row.averageGpa, null);
  assert.equal(row.disciplinaryAction, '无');
  assert.equal(row.excellentCadreRecommendationSource, '学生会推荐');
  assert.equal(row.excellentCadreRecommendationLevel, '校级');
  assert.equal(row.positionInfo, '2024-2025学年担任班长。');
  assert.equal(row.competitionActivity, '华侨大学电脑大赛二等奖。');
  assert.equal(row.remark, '境外生源地');
});
