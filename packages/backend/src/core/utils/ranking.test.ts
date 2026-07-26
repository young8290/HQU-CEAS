import test from 'node:test';
import assert from 'node:assert/strict';
import { rankByScoreDesc } from './ranking.js';

test('rankByScoreDesc assigns 1-based ranks by descending value', () => {
  const ranks = rankByScoreDesc([
    { studentId: 1, value: 75 },
    { studentId: 2, value: 92.5 },
    { studentId: 3, value: 88 },
  ]);

  assert.deepEqual(ranks, { 2: 1, 3: 2, 1: 3 });
});

test('rankByScoreDesc gives equal values adjacent distinct ranks in input order', () => {
  // 现状锁定：不处理并列——分值相同的学生按输入数组顺序（稳定排序）
  // 获得相邻的不同名次，而不是共享同一名次。
  const ranks = rankByScoreDesc([
    { studentId: 11, value: 90 },
    { studentId: 12, value: 90 },
    { studentId: 13, value: 95 },
    { studentId: 14, value: 90 },
  ]);

  assert.equal(ranks[13], 1);
  assert.equal(ranks[11], 2);
  assert.equal(ranks[12], 3);
  assert.equal(ranks[14], 4);
});

test('rankByScoreDesc returns empty map for empty input', () => {
  assert.deepEqual(rankByScoreDesc([]), {});
});

test('rankByScoreDesc does not mutate the input array', () => {
  const input = [
    { studentId: 1, value: 60 },
    { studentId: 2, value: 80 },
  ];

  rankByScoreDesc(input);

  assert.deepEqual(input.map((item) => item.studentId), [1, 2]);
});
