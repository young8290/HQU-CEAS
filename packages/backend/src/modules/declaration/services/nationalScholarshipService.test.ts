import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../../core/db.js';
import {
  computeEvaluation,
  gpaFromAcademic,
  loadUnitStudents,
  suggestClasses,
} from './nationalScholarshipService.js';
import { replaceMethod } from '../../../core/utils/testUtils.js';

test('gpaFromAcademic 按 academic/8 − 2.5 折算并保留两位', () => {
  assert.equal(gpaFromAcademic(52), 4);
  assert.equal(gpaFromAcademic(36), 2);
  assert.equal(gpaFromAcademic(34), 1.75);
  assert.equal(gpaFromAcademic(0), -2.5);
});

test('loadUnitStudents 合并多个班级并映射 g/z（缺分默认 0）', async () => {
  const classes: Record<number, any> = {
    21: {
      id: 21,
      name: '计算机1班',
      grade: { id: 3, name: '2023级' },
      students: [
        {
          id: 101,
          studentNo: 'S001',
          name: '学生甲',
          scores: [
            { category: 'academic', value: 52 },
            { category: 'total', value: 90 },
          ],
        },
      ],
    },
    22: {
      id: 22,
      name: '计算机2班',
      grade: { id: 3, name: '2023级' },
      students: [
        { id: 102, studentNo: 'S002', name: '学生乙', scores: [] },
      ],
    },
  };
  const restore = replaceMethod(prisma.class, 'findUnique', async (args: any) => classes[args.where.id] ?? null);

  try {
    const students = await loadUnitStudents(2025, [21, 22]);

    assert.equal(students.length, 2);
    assert.deepEqual(students[0], {
      studentId: 101,
      studentNo: 'S001',
      name: '学生甲',
      classId: 21,
      className: '计算机1班',
      gradeName: '2023级',
      gpa: 4,
      totalScore: 90,
    });
    // 无成绩学生：z 缺省 0，g = gpaFromAcademic(0) = −2.5，排名自然垫底
    assert.equal(students[1].gpa, -2.5);
    assert.equal(students[1].totalScore, 0);

    await assert.rejects(() => loadUnitStudents(2025, [99]), /班级 99 不存在/);
  } finally {
    restore();
  }
});

test('suggestClasses 按去掉尾部"N班"的专业名分组平行班', async () => {
  const restoreGrade = replaceMethod(prisma.grade, 'findUnique', async () => ({ id: 5, name: '2023级' }));
  const restoreClasses = replaceMethod(prisma.class, 'findMany', async () => [
    { id: 1, name: '计算机科学与技术1班', _count: { students: 30 } },
    { id: 2, name: '计算机科学与技术2班', _count: { students: 28 } },
    { id: 3, name: '软件工程1班', _count: { students: 29 } },
  ]);

  try {
    const groups = await suggestClasses(2025, 5);

    assert.equal(groups.length, 2);
    assert.equal(groups[0].major, '计算机科学与技术');
    assert.deepEqual(groups[0].classes.map((cls: any) => cls.id), [1, 2]);
    assert.equal(groups[1].major, '软件工程');
    assert.deepEqual(groups[1].classes, [{ id: 3, name: '软件工程1班', studentCount: 29 }]);
  } finally {
    restoreGrade();
    restoreClasses();
  }
});

test('computeEvaluation 跑三算法、写回 B 值并保留人工字段（幂等重建）', async () => {
  const evaluationFixture = {
    id: 7,
    academicYearId: 2025,
    name: '2023级计算机（合组）',
    classIdsJson: '[11,12]',
    quota: 1,
    poolRatio: 0.5,
    paramW: 0.5,
    paramD: 1.0,
    status: 'draft',
  };
  // 班 11：甲 g=4.0 z=90，乙 g=3.9 z=85；班 12：丙 g=3.0 z=95，丁 g=2.0 z=60
  const classes: Record<number, any> = {
    11: {
      id: 11,
      name: '计算机1班',
      grade: { id: 3, name: '2023级' },
      students: [
        { id: 1, studentNo: 'S001', name: '甲', scores: [{ category: 'academic', value: 52 }, { category: 'total', value: 90 }] },
        { id: 2, studentNo: 'S002', name: '乙', scores: [{ category: 'academic', value: 51.2 }, { category: 'total', value: 85 }] },
      ],
    },
    12: {
      id: 12,
      name: '计算机2班',
      grade: { id: 3, name: '2023级' },
      students: [
        { id: 3, studentNo: 'S003', name: '丙', scores: [{ category: 'academic', value: 44 }, { category: 'total', value: 95 }] },
        { id: 4, studentNo: 'S004', name: '丁', scores: [{ category: 'academic', value: 36 }, { category: 'total', value: 60 }] },
      ],
    },
  };

  let createdRows: any[] = [];
  let updateData: any = null;
  let deleteCalled = 0;
  let auditEntry: any = null;

  const restores = [
    replaceMethod(prisma.nationalScholarshipEvaluation, 'findUnique', async () => ({ ...evaluationFixture })),
    replaceMethod(prisma.class, 'findUnique', async (args: any) => classes[args.where.id] ?? null),
    // 上一轮遗留的人工字段：丁被标记重大成果并有评议留痕
    replaceMethod(prisma.nationalScholarshipCandidate, 'findMany', async () => [
      {
        id: 900,
        evaluationId: 7,
        studentId: 4,
        classId: 12,
        isClassRecommended: false,
        hasMajorAchievement: true,
        achievements: '获得XX竞赛国家级奖项',
        reviewNote: '保留',
        finalRank: null,
        selected: false,
      },
    ]),
    replaceMethod(prisma.nationalScholarshipCandidate, 'deleteMany', async () => {
      deleteCalled += 1;
      return { count: 1 };
    }),
    replaceMethod(prisma.nationalScholarshipCandidate, 'createMany', async (args: any) => {
      createdRows = args.data;
      return { count: args.data.length };
    }),
    replaceMethod(prisma.nationalScholarshipEvaluation, 'update', async (args: any) => {
      updateData = args.data;
      return { ...evaluationFixture, ...args.data };
    }),
    replaceMethod(prisma.auditLog, 'create', async (args: any) => {
      auditEntry = args.data;
      return { id: 1, ...args.data };
    }),
  ];

  try {
    const result = await computeEvaluation(7, 42);

    // 算法二：B_解析 = 0.5，B_经验 = median(两班九分位 |Δ|) = 1.45，B = min = 0.5
    assert.equal(result.analyticB, 0.5);
    assert.ok(result.empiricalB !== null && Math.abs(result.empiricalB - 1.45) < 1e-9);
    assert.equal(result.effectiveB, 0.5);
    assert.equal(result.candidateCount, 4);
    assert.equal(result.poolCount, 4);
    assert.equal(deleteCalled, 1);
    assert.equal(updateData.status, 'computed');
    assert.equal(updateData.analyticB, 0.5);
    assert.equal(updateData.effectiveB, 0.5);
    assert.equal(auditEntry.module, 'national_scholarship');
    assert.equal(auditEntry.action, 'compute');
    assert.equal(auditEntry.actorId, 42);

    assert.equal(createdRows.length, 4);
    const rowA = createdRows.find((row) => row.studentId === 1);
    const rowD = createdRows.find((row) => row.studentId === 4);

    // 算法一：N=4、p=0.5 → k=2；甲绩点第 1、综测第 2 → 双通道入池
    assert.equal(rowA.gRank, 1);
    assert.equal(rowA.zRank, 2);
    assert.deepEqual(JSON.parse(rowA.poolReasonsJson), ['专业绩点前50%', '专业综测前50%']);
    assert.equal(rowA.inPool, true);
    assert.equal(rowA.robustRank, 1);

    // 丁不满足 J/K，但保留的"重大成果"标记使其入池；人工字段全部保留
    assert.equal(rowD.hasMajorAchievement, true);
    assert.equal(rowD.achievements, '获得XX竞赛国家级奖项');
    assert.equal(rowD.reviewNote, '保留');
    assert.deepEqual(JSON.parse(rowD.poolReasonsJson), ['重大成果']);
    assert.equal(rowD.inPool, true);
    // 算法三：甲/乙/丙均稳健占优丁（g 差 > 0.5 且 z 不低）→ 被 3 人占优、层名次 4
    assert.equal(rowD.dominatedByCount, 3);
    assert.equal(rowD.robustRank, 4);
    assert.equal(rowD.isCritical, false);
  } finally {
    restores.forEach((restore) => restore());
  }
});
