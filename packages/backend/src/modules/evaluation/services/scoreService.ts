import prisma from '../../../core/db.js';
import type { Prisma } from '@prisma/client';
import {
  EVALUATION_SCORE_CATEGORIES_ORDER,
  PERSONAL_FORM_DETAIL_CATEGORIES,
  calculateSportsTotal,
  calculateTotal,
  validateScoreValue,
  type ScoreCategory,
} from '../rules/scoreRules.js';

export interface ScoreValueWithRemark {
  value: number;
  remark: string | null;
}

interface RawScoreRecord extends ScoreValueWithRemark {
  category: string;
  bonusDetails?: Array<{
    id: number;
    itemName: string;
    itemScore: number;
    sortOrder: number;
  }>;
}

interface RawStudentWithScores {
  id: number;
  studentNo: string;
  name: string;
  scores: RawScoreRecord[];
}

export interface ClassScoreStudent {
  id: number;
  studentNo: string;
  name: string;
  scores: Record<string, ScoreValueWithRemark>;
  details?: Record<string, ScoreBonusDetailItem[]>;
}

export interface ScoreBonusDetailItem {
  id?: number;
  itemName: string;
  itemScore: number;
  sortOrder?: number;
}

const EVALUATION_CATEGORY_FILTER = new Set<string>(EVALUATION_SCORE_CATEGORIES_ORDER);
const PERSONAL_FORM_DETAIL_CATEGORY_FILTER = new Set<string>(PERSONAL_FORM_DETAIL_CATEGORIES);

function filterEvaluationScores(scores: Record<string, ScoreValueWithRemark>) {
  const next: Record<string, ScoreValueWithRemark> = {};
  for (const [category, score] of Object.entries(scores)) {
    if (EVALUATION_CATEGORY_FILTER.has(category)) {
      next[category] = score;
    }
  }
  return next;
}

function mapStudentsToScoreRecords(
  students: RawStudentWithScores[],
  filter?: Set<string>,
): ClassScoreStudent[] {
  return students.map((student: RawStudentWithScores) => {
    const scoreMap: Record<string, ScoreValueWithRemark> = {};
    const detailMap: Record<string, ScoreBonusDetailItem[]> = {};
    for (const score of student.scores) {
      if (!filter || filter.has(score.category)) {
        scoreMap[score.category] = { value: score.value, remark: score.remark };
        if (score.bonusDetails?.length) {
          detailMap[score.category] = score.bonusDetails.map((item) => ({
            id: item.id,
            itemName: item.itemName,
            itemScore: item.itemScore,
            sortOrder: item.sortOrder,
          }));
        }
      }
    }

    return {
      id: student.id,
      studentNo: student.studentNo,
      name: student.name,
      scores: scoreMap,
      ...(Object.keys(detailMap).length ? { details: detailMap } : {}),
    };
  });
}

function scoreSummary(items: ScoreBonusDetailItem[], category?: ScoreCategory) {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0].itemName;
  return category === 'moral' ? `${items.length}条扣分明细` : `${items.length}条加分明细`;
}

async function loadStudentsWithScores(classId: number, academicYearId: number) {
  const rows = await prisma.student.findMany({
    where: { classId },
    orderBy: { studentNo: 'asc' },
    include: {
      scores: {
        where: { academicYearId },
        include: {
          bonusDetails: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });
  return rows as unknown as RawStudentWithScores[];
}

async function loadStudentScores(studentId: number, academicYearId: number) {
  const rows = await prisma.score.findMany({
    where: { studentId, academicYearId },
  });
  return rows as unknown as RawScoreRecord[];
}

export async function getScoresByClass(
  classId: number,
  academicYearId: number,
): Promise<ClassScoreStudent[]> {
  const students = await loadStudentsWithScores(classId, academicYearId);
  return mapStudentsToScoreRecords(students, EVALUATION_CATEGORY_FILTER);
}

export async function getScoresByClassForExport(
  classId: number,
  academicYearId: number,
): Promise<ClassScoreStudent[]> {
  const students = await loadStudentsWithScores(classId, academicYearId);
  return mapStudentsToScoreRecords(students);
}

export async function getScoresByStudent(
  studentId: number,
  academicYearId: number,
): Promise<Record<string, ScoreValueWithRemark>> {
  const scores = await loadStudentScores(studentId, academicYearId);

  const scoreMap: Record<string, ScoreValueWithRemark> = {};
  for (const score of scores) {
    scoreMap[score.category] = { value: score.value, remark: score.remark };
  }

  return filterEvaluationScores(scoreMap);
}

export async function getScoreBonusDetails(data: {
  studentId: number;
  academicYearId: number;
  category: ScoreCategory;
}): Promise<ScoreBonusDetailItem[]> {
  const score = await prisma.score.findUnique({
    where: {
      studentId_academicYearId_category: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        category: data.category,
      },
    },
    include: {
      bonusDetails: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  return (score?.bonusDetails || []).map((item: {
    id: number;
    itemName: string;
    itemScore: number;
    sortOrder: number;
  }) => ({
    id: item.id,
    itemName: item.itemName,
    itemScore: item.itemScore,
    sortOrder: item.sortOrder,
  }));
}

export async function assertStudentInClass(studentId: number, classId: number) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true },
  });
  if (!student) {
    throw new Error('student_not_found');
  }
  if (student.classId !== classId) {
    throw new Error('student_class_mismatch');
  }
  return student;
}

/**
 * 事务内重算派生分（体育总分/总分），复用单次载入的分数数据（PLAN_V2 §5.3）。
 * 返回该生该学年的完整分数映射（含重算后的 sports_total/total），供调用方直接
 * 组装响应，免去事后再全量查询一次。
 */
async function recalcDerivedTotals(
  db: Prisma.TransactionClient,
  studentId: number,
  academicYearId: number,
  updatedBy: number | undefined,
  recalcSports: boolean,
): Promise<Record<string, ScoreValueWithRemark>> {
  // 单次载入该生全学年分数（在本类别 upsert 之后执行，已含最新值）
  const rows = await db.score.findMany({
    where: { studentId, academicYearId },
  }) as RawScoreRecord[];

  const scoreMap: Record<string, ScoreValueWithRemark> = {};
  for (const row of rows) {
    scoreMap[row.category] = { value: row.value, remark: row.remark };
  }

  if (recalcSports) {
    const sportsTotal = calculateSportsTotal(
      scoreMap.sports_base?.value || 0,
      scoreMap.sports_reward?.value || 0,
    );
    await db.score.upsert({
      where: {
        studentId_academicYearId_category: { studentId, academicYearId, category: 'sports_total' },
      },
      update: { value: sportsTotal, updatedBy },
      create: { studentId, academicYearId, category: 'sports_total', value: sportsTotal, updatedBy },
    });
    scoreMap.sports_total = { value: sportsTotal, remark: scoreMap.sports_total?.remark ?? null };
  }

  const numericScores: Record<string, number> = {};
  for (const [category, score] of Object.entries(scoreMap)) {
    numericScores[category] = score.value;
  }
  const total = calculateTotal(numericScores);
  await db.score.upsert({
    where: {
      studentId_academicYearId_category: { studentId, academicYearId, category: 'total' },
    },
    update: { value: total, updatedBy },
    create: { studentId, academicYearId, category: 'total', value: total, updatedBy },
  });
  scoreMap.total = { value: total, remark: scoreMap.total?.remark ?? null };

  return scoreMap;
}

export async function updateScore(data: {
  studentId: number;
  academicYearId: number;
  category: ScoreCategory;
  value: number;
  remark?: string | null;
  updatedBy?: number;
}) {
  // Validate
  const error = validateScoreValue(data.category, data.value);
  if (error) throw new Error(error);

  // 写入 + 派生分重算合并进单事务（PLAN_V2 §5.2/§5.3）
  const scoreMap = await prisma.$transaction(async (tx) => {
    await tx.score.upsert({
      where: {
        studentId_academicYearId_category: {
          studentId: data.studentId,
          academicYearId: data.academicYearId,
          category: data.category,
        },
      },
      update: {
        value: data.value,
        remark: data.remark !== undefined ? data.remark : undefined,
        updatedBy: data.updatedBy,
      },
      create: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        category: data.category,
        value: data.value,
        remark: data.remark || null,
        updatedBy: data.updatedBy,
      },
    });

    // sports_base/sports_reward 变更时联动重算 sports_total；总分始终重算
    return recalcDerivedTotals(
      tx,
      data.studentId,
      data.academicYearId,
      data.updatedBy,
      ['sports_base', 'sports_reward'].includes(data.category),
    );
  });

  // 返回形状与 v1 一致（原 getScoresByStudent）：复用事务内已载数据组装
  return filterEvaluationScores(scoreMap);
}

export async function saveScoreBonusDetails(data: {
  studentId: number;
  academicYearId: number;
  category: ScoreCategory;
  items: ScoreBonusDetailItem[];
  updatedBy?: number;
}) {
  if (!PERSONAL_FORM_DETAIL_CATEGORY_FILTER.has(data.category)) {
    throw new Error('该分数类别不支持明细填写');
  }

  const normalizedItems = data.items
    .map((item, index) => ({
      itemName: item.itemName.trim(),
      itemScore: Number(item.itemScore),
      sortOrder: item.sortOrder ?? index,
    }))
    .filter((item) => item.itemName || item.itemScore !== 0);

  for (const item of normalizedItems) {
    const error = validateScoreValue(data.category, item.itemScore);
    if (error) throw new Error(error);
  }

  const itemsTotal = normalizedItems.reduce((sum, item) => sum + item.itemScore, 0);

  let total: number;
  if (data.category === 'moral') {
    // 德育测评明细为扣分项：最终得分 = 100 − 扣分合计（其余类别仍为加分求和）。
    if (itemsTotal < 0 || itemsTotal > 100) {
      throw new Error('德育测评扣分合计需在0到100之间');
    }
    total = Math.round((100 - itemsTotal) * 100) / 100;
    const finalError = validateScoreValue('moral', total);
    if (finalError) throw new Error(finalError);
  } else {
    total = itemsTotal;
    const totalError = validateScoreValue(data.category, total);
    if (totalError) throw new Error(totalError);
  }

  const remarkSummary = scoreSummary(normalizedItems, data.category);

  // 明细写入 + 汇总分写入 + 派生分重算合并进单事务，复用已查数据（PLAN_V2 §5.3）
  return prisma.$transaction(async (tx) => {
    const score = await tx.score.upsert({
      where: {
        studentId_academicYearId_category: {
          studentId: data.studentId,
          academicYearId: data.academicYearId,
          category: data.category,
        },
      },
      update: {
        value: total,
        remark: remarkSummary,
        updatedBy: data.updatedBy,
      },
      create: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        category: data.category,
        value: total,
        remark: remarkSummary,
        updatedBy: data.updatedBy,
      },
    });

    await tx.scoreBonusDetail.deleteMany({ where: { scoreId: score.id } });
    if (normalizedItems.length > 0) {
      await tx.scoreBonusDetail.createMany({
        data: normalizedItems.map((item) => ({
          scoreId: score.id,
          itemName: item.itemName,
          itemScore: item.itemScore,
          sortOrder: item.sortOrder ?? 0,
          updatedBy: data.updatedBy,
        })),
      });
    }

    // 与原 getScoreBonusDetails 同形查询（取回带生成 id 的明细），复用同一事务
    const scoreWithDetails = await tx.score.findUnique({
      where: {
        studentId_academicYearId_category: {
          studentId: data.studentId,
          academicYearId: data.academicYearId,
          category: data.category,
        },
      },
      include: {
        bonusDetails: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    const details: ScoreBonusDetailItem[] = (scoreWithDetails?.bonusDetails || []).map((item: {
      id: number;
      itemName: string;
      itemScore: number;
      sortOrder: number;
    }) => ({
      id: item.id,
      itemName: item.itemName,
      itemScore: item.itemScore,
      sortOrder: item.sortOrder,
    }));

    const scoreMap = await recalcDerivedTotals(
      tx,
      data.studentId,
      data.academicYearId,
      data.updatedBy,
      data.category === 'sports_reward',
    );

    return {
      details,
      scores: filterEvaluationScores(scoreMap),
    };
  });
}

export async function calculateAndSortClass(classId: number, academicYearId: number) {
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true },
  }) as Array<{ id: number }>;

  // Recalculate totals for each student（每生一个事务，单次载入复用重算）
  for (const student of students) {
    await prisma.$transaction(async (tx) => {
      await recalcDerivedTotals(tx, student.id, academicYearId, undefined, true);
    });
  }

  // Return sorted results
  const results = await getScoresByClass(classId, academicYearId);
  return results.sort((a: ClassScoreStudent, b: ClassScoreStudent) => {
    const totalA = a.scores.total?.value || 0;
    const totalB = b.scores.total?.value || 0;
    return totalB - totalA;
  });
}

export async function validateClassScores(classId: number, academicYearId: number) {
  const students = await getScoresByClass(classId, academicYearId);
  const issues: Array<{ studentNo: string; name: string; category: string; issue: string }> = [];

  for (const student of students) {
    for (const category of EVALUATION_SCORE_CATEGORIES_ORDER) {
      const score = student.scores[category];
      if (!score && category !== 'total' && category !== 'sports_total') {
        issues.push({
          studentNo: student.studentNo,
          name: student.name,
          category,
          issue: `缺少${category}分数`,
        });
        continue;
      }
      if (score) {
        const error = validateScoreValue(category as ScoreCategory, score.value);
        if (error) {
          issues.push({
            studentNo: student.studentNo,
            name: student.name,
            category,
            issue: error,
          });
        }
      }
    }
  }

  return issues;
}
