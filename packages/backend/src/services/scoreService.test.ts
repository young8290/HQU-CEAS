import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../config/database.js';
import { getScoresByClass } from './scoreService.js';

function replaceMethod(target: any, key: string, value: any) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const originalValue = target[key];
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });
  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Object.defineProperty(target, key, {
        configurable: true,
        writable: true,
        value: originalValue,
      });
    }
  };
}

test('getScoresByClass returns bonus details with score cells', async () => {
  const restore = replaceMethod(prisma.student, 'findMany', async () => [
    {
      id: 101,
      studentNo: '20240001',
      name: '学生一',
      scores: [
        {
          category: 'sports_reward',
          value: 1.5,
          remark: '运动会获奖',
          bonusDetails: [
            {
              id: 501,
              itemName: '运动会 100 米第二名',
              itemScore: 1.5,
              sortOrder: 0,
            },
          ],
        },
        {
          category: 'total',
          value: 85.5,
          remark: null,
          bonusDetails: [],
        },
      ],
    },
  ]);

  try {
    const result = await getScoresByClass(12, 2025);

    assert.equal(result[0].details?.sports_reward?.[0].itemName, '运动会 100 米第二名');
    assert.equal(result[0].details?.sports_reward?.[0].itemScore, 1.5);
    assert.deepEqual(result[0].details?.total, undefined);
  } finally {
    restore();
  }
});
