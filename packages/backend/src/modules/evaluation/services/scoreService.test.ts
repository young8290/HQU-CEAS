import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../../core/db.js';
import { getScoresByClass, saveScoreBonusDetails } from './scoreService.js';
import { replaceMethod } from '../../../core/utils/testUtils.js';

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

function mockScoreDetailPersistence() {
  const upserts: any[] = [];
  const createdDetails: any[] = [];
  const restores = [
    replaceMethod(prisma, '$transaction', async (handler: any) => handler(prisma)),
    replaceMethod(prisma.score, 'upsert', async (args: any) => {
      upserts.push(args);
      return { id: 8801, ...args.create };
    }),
    replaceMethod(prisma.score, 'findMany', async () => []),
    replaceMethod(prisma.score, 'findUnique', async () => null),
    replaceMethod(prisma.scoreBonusDetail, 'deleteMany', async () => ({ count: 0 })),
    replaceMethod(prisma.scoreBonusDetail, 'createMany', async ({ data }: any) => {
      createdDetails.push(...data);
      return { count: data.length };
    }),
  ];
  return {
    upserts,
    createdDetails,
    restore: () => restores.reverse().forEach((restore) => restore()),
  };
}

function findCategoryUpsert(upserts: any[], category: string) {
  return upserts.find((args) => args.where.studentId_academicYearId_category.category === category);
}

test('saveScoreBonusDetails treats moral details as deductions from 100', async () => {
  const mock = mockScoreDetailPersistence();

  try {
    await saveScoreBonusDetails({
      studentId: 101,
      academicYearId: 2025,
      category: 'moral',
      items: [
        { itemName: '无故缺勤班会', itemScore: 2 },
        { itemName: '宿舍卫生不合格', itemScore: 3 },
      ],
      updatedBy: 1,
    });

    const moralUpsert = findCategoryUpsert(mock.upserts, 'moral');
    assert.ok(moralUpsert);
    // 最终得分 = 100 − 扣分合计（2 + 3）
    assert.equal(moralUpsert.update.value, 95);
    assert.equal(moralUpsert.create.value, 95);
    assert.equal(moralUpsert.update.remark, '2条扣分明细');
    assert.equal(mock.createdDetails.length, 2);
    assert.deepEqual(mock.createdDetails.map((item) => item.itemScore), [2, 3]);
  } finally {
    mock.restore();
  }
});

test('saveScoreBonusDetails stores full moral score when no deduction items exist', async () => {
  const mock = mockScoreDetailPersistence();

  try {
    await saveScoreBonusDetails({
      studentId: 101,
      academicYearId: 2025,
      category: 'moral',
      items: [],
      updatedBy: 1,
    });

    const moralUpsert = findCategoryUpsert(mock.upserts, 'moral');
    assert.ok(moralUpsert);
    assert.equal(moralUpsert.update.value, 100);
    assert.equal(moralUpsert.update.remark, null);
    assert.equal(mock.createdDetails.length, 0);
  } finally {
    mock.restore();
  }
});

test('saveScoreBonusDetails rejects moral deductions summing beyond 100', async () => {
  const mock = mockScoreDetailPersistence();

  try {
    await assert.rejects(
      () => saveScoreBonusDetails({
        studentId: 101,
        academicYearId: 2025,
        category: 'moral',
        items: [
          { itemName: '重大违纪一', itemScore: 60 },
          { itemName: '重大违纪二', itemScore: 60 },
        ],
        updatedBy: 1,
      }),
      /德育测评扣分合计需在0到100之间/,
    );
    assert.equal(findCategoryUpsert(mock.upserts, 'moral'), undefined);
  } finally {
    mock.restore();
  }
});

test('saveScoreBonusDetails keeps additive semantics for non-moral categories', async () => {
  const mock = mockScoreDetailPersistence();

  try {
    await saveScoreBonusDetails({
      studentId: 101,
      academicYearId: 2025,
      category: 'labor',
      items: [
        { itemName: '劳动实践一', itemScore: 1 },
        { itemName: '劳动实践二', itemScore: 2 },
      ],
      updatedBy: 1,
    });

    const laborUpsert = findCategoryUpsert(mock.upserts, 'labor');
    assert.ok(laborUpsert);
    assert.equal(laborUpsert.update.value, 3);
    assert.equal(laborUpsert.update.remark, '2条加分明细');
  } finally {
    mock.restore();
  }
});
