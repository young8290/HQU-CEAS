import prisma from '../config/database.js';
import { ALL_CATEGORIES, calculateSportsTotal, calculateTotal, validateScoreValue, type ScoreCategory } from '../config/scoreRules.js';

export interface ScoreValueWithRemark {
  value: number;
  remark: string | null;
}

interface RawScoreRecord extends ScoreValueWithRemark {
  category: string;
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
}

export async function getScoresByClass(
  classId: number,
  academicYearId: number,
): Promise<ClassScoreStudent[]> {
  const students = await prisma.student.findMany({
    where: { classId },
    orderBy: { studentNo: 'asc' },
    include: {
      scores: {
        where: { academicYearId },
      },
    },
  }) as RawStudentWithScores[];

  return students.map((student: RawStudentWithScores) => {
    const scoreMap: Record<string, ScoreValueWithRemark> = {};
    for (const score of student.scores) {
      scoreMap[score.category] = { value: score.value, remark: score.remark };
    }

    return {
      id: student.id,
      studentNo: student.studentNo,
      name: student.name,
      scores: scoreMap,
    };
  });
}

export async function getScoresByStudent(
  studentId: number,
  academicYearId: number,
): Promise<Record<string, ScoreValueWithRemark>> {
  const scores = await prisma.score.findMany({
    where: { studentId, academicYearId },
  }) as RawScoreRecord[];

  const scoreMap: Record<string, ScoreValueWithRemark> = {};
  for (const score of scores) {
    scoreMap[score.category] = { value: score.value, remark: score.remark };
  }

  return scoreMap;
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
  if (['sports_base', 'sports_reward', 'physical_test', 'pe_course'].includes(data.category)) {
    await recalculateSportsTotal(data.studentId, data.academicYearId, data.updatedBy);
  }

  // Recalculate total
  await recalculateTotal(data.studentId, data.academicYearId, data.updatedBy);

  // Return updated scores
  return getScoresByStudent(data.studentId, data.academicYearId);
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
    for (const category of ALL_CATEGORIES) {
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
