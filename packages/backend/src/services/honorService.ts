import prisma from '../config/database.js';
import { evaluateHonorCandidate, type HonorType } from '../config/honorRules.js';
import { cacheService } from './cacheService.js';

type ScoreMap = Record<string, number>;

function getScore(scores: ScoreMap, category: string) {
  return scores[category] ?? 0;
}

function rank(values: Array<{ studentId: number; value: number }>) {
  return [...values]
    .sort((a, b) => b.value - a.value)
    .reduce<Record<number, number>>((acc, item, index) => {
      acc[item.studentId] = index + 1;
      return acc;
    }, {});
}

export async function getHonorCandidates(data: {
  academicYearId: number;
  classId: number;
  honorType?: HonorType;
}) {
  const honorType = data.honorType || 'excellent_student';
  const key = `${data.academicYearId}:${data.classId}:${honorType}`;
  return cacheService.memo('honorCandidates', key, 30 * 1000, async () => {
    const cls = await prisma.class.findUnique({
      where: { id: data.classId },
      include: {
        grade: true,
        students: {
          include: {
            scores: { where: { academicYearId: data.academicYearId } },
            tags: { where: { academicYearId: data.academicYearId } },
            externalAwardRecords: { where: { academicYearId: data.academicYearId } },
            declarationSupplements: { where: { academicYearId: data.academicYearId } },
          },
          orderBy: { studentNo: 'asc' },
        },
        classHonorRecords: { where: { academicYearId: data.academicYearId } },
      },
    });
    if (!cls) throw new Error('班级不存在');

    const items = cls.students.map((student) => ({
      student,
      scores: student.scores.reduce<ScoreMap>((acc, score) => {
        acc[score.category] = score.value;
        return acc;
      }, {}),
    }));
    const classSize = Math.max(1, items.length);
    const academicRanks = rank(items.map((item) => ({ studentId: item.student.id, value: getScore(item.scores, 'academic') })));
    const totalRanks = rank(items.map((item) => ({ studentId: item.student.id, value: getScore(item.scores, 'total') })));

    return items.map(({ student, scores }) => {
      const tags = [
        ...student.tags.map((tag) => tag.tagName),
        ...student.externalAwardRecords.map((record) => record.awardType),
      ];
      const supplement = student.declarationSupplements[0] || null;
      const evaluation = evaluateHonorCandidate({
        studentId: student.id,
        classSize,
        isComputerCategory: cls.isComputerCategory,
        academicRank: academicRanks[student.id] || classSize,
        totalRank: totalRanks[student.id] || classSize,
        moralScore: getScore(scores, 'moral'),
        physicalTestScore: getScore(scores, 'physical_test'),
        communityScore: getScore(scores, 'community'),
        tags,
        hasClassHonorQuotaBonus: cls.classHonorRecords.length > 0,
      }, honorType);

      return {
        studentId: student.id,
        studentNo: student.studentNo,
        name: student.name,
        classId: cls.id,
        className: `${cls.grade.name}${cls.name}`,
        academicRank: academicRanks[student.id] || classSize,
        totalRank: totalRanks[student.id] || classSize,
        moralScore: getScore(scores, 'moral'),
        physicalTestScore: getScore(scores, 'physical_test'),
        communityScore: getScore(scores, 'community'),
        averageGpa: supplement?.averageGpa ?? null,
        gender: supplement?.gender ?? null,
        disciplinaryAction: supplement?.disciplinaryAction || '无',
        recommendationLevel: honorType === 'excellent_cadre'
          ? supplement?.excellentCadreRecommendationLevel
          : supplement?.excellentStudentRecommendationLevel,
        recommendationSource: honorType === 'excellent_cadre'
          ? supplement?.excellentCadreRecommendationSource || '班级推荐'
          : '班级推荐',
        intent: honorType === 'excellent_cadre'
          ? supplement?.excellentCadreIntent ?? null
          : supplement?.excellentStudentIntent ?? null,
        positionInfo: supplement?.positionInfo || '',
        competitionActivity: supplement?.competitionActivity || '',
        remark: supplement?.remark || '',
        classHonorQuota: cls.classHonorRecords.length > 0 ? 2 : 1,
        tags,
        ...evaluation,
      };
    });
  });
}
