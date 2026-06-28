import prisma from '../config/database.js';
import {
  EVALUATION_SCORE_CATEGORIES_ORDER,
  PERSONAL_FORM_DETAIL_CATEGORIES,
  calculateSportsTotal,
  calculateTotal,
  validateScoreValue,
  type ScoreCategory,
} from '../config/scoreRules.js';

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

function scoreSummary(items: ScoreBonusDetailItem[]) {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0].itemName;
  return `${items.length}条加分明细`;
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

  // Upsert the score
  await prisma.score.upsert({
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

  // If sports_base or sports_reward changed, recalculate sports_total
  if (['sports_base', 'sports_reward'].includes(data.category)) {
    await recalculateSportsTotal(data.studentId, data.academicYearId, data.updatedBy);
  }

  // Recalculate total
  await recalculateTotal(data.studentId, data.academicYearId, data.updatedBy);

  // Return updated scores
  return getScoresByStudent(data.studentId, data.academicYearId);
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

  const total = normalizedItems.reduce((sum, item) => sum + item.itemScore, 0);
  const totalError = validateScoreValue(data.category, total);
  if (totalError) throw new Error(totalError);

  const score = await prisma.score.upsert({
    where: {
      studentId_academicYearId_category: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        category: data.category,
      },
    },
    update: {
      value: total,
      remark: scoreSummary(normalizedItems),
      updatedBy: data.updatedBy,
    },
    create: {
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      category: data.category,
      value: total,
      remark: scoreSummary(normalizedItems),
      updatedBy: data.updatedBy,
    },
  });

  await prisma.scoreBonusDetail.deleteMany({ where: { scoreId: score.id } });
  if (normalizedItems.length > 0) {
    await prisma.scoreBonusDetail.createMany({
      data: normalizedItems.map((item) => ({
        scoreId: score.id,
        itemName: item.itemName,
        itemScore: item.itemScore,
        sortOrder: item.sortOrder ?? 0,
        updatedBy: data.updatedBy,
      })),
    });
  }

  if (data.category === 'sports_reward') {
    await recalculateSportsTotal(data.studentId, data.academicYearId, data.updatedBy);
  }
  await recalculateTotal(data.studentId, data.academicYearId, data.updatedBy);

  return {
    details: await getScoreBonusDetails({
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      category: data.category,
    }),
    scores: await getScoresByStudent(data.studentId, data.academicYearId),
  };
}

async function recalculateSportsTotal(studentId: number, academicYearId: number, updatedBy?: number) {
  const scores = await prisma.score.findMany({
    where: {
      studentId,
      academicYearId,
      category: { in: ['sports_base', 'sports_reward'] },
    },
  }) as RawScoreRecord[];

  const sportsBase = scores.find((score: RawScoreRecord) => score.category === 'sports_base')?.value || 0;
  const sportsReward = scores.find((score: RawScoreRecord) => score.category === 'sports_reward')?.value || 0;
  const sportsTotal = calculateSportsTotal(sportsBase, sportsReward);

  await prisma.score.upsert({
    where: {
      studentId_academicYearId_category: {
        studentId,
        academicYearId,
        category: 'sports_total',
      },
    },
    update: { value: sportsTotal, updatedBy },
    create: {
      studentId,
      academicYearId,
      category: 'sports_total',
      value: sportsTotal,
      updatedBy,
    },
  });
}

async function recalculateTotal(studentId: number, academicYearId: number, updatedBy?: number) {
  const scores = await prisma.score.findMany({
    where: { studentId, academicYearId },
  }) as RawScoreRecord[];

  const scoreMap: Record<string, number> = {};
  for (const s of scores) {
    scoreMap[s.category] = s.value;
  }

  const total = calculateTotal(scoreMap);

  await prisma.score.upsert({
    where: {
      studentId_academicYearId_category: {
        studentId,
        academicYearId,
        category: 'total',
      },
    },
    update: { value: total, updatedBy },
    create: {
      studentId,
      academicYearId,
      category: 'total',
      value: total,
      updatedBy,
    },
  });
}

export async function calculateAndSortClass(classId: number, academicYearId: number) {
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true },
  }) as Array<{ id: number }>;

  // Recalculate totals for each student
  for (const student of students) {
    await recalculateSportsTotal(student.id, academicYearId);
    await recalculateTotal(student.id, academicYearId);
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
