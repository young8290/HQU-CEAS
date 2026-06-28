import prisma from '../config/database.js';
import { evaluateAwardCandidate, type AwardType } from '../config/awardRules.js';
import { cacheService } from './cacheService.js';

type ScoreMap = Record<string, number>;

function scoreValue(scores: ScoreMap, category: string) {
  return scores[category] ?? 0;
}

function rankStudents(students: Array<{ studentId: number; value: number }>) {
  return [...students]
    .sort((a, b) => b.value - a.value)
    .reduce<Record<number, number>>((acc, item, index) => {
      acc[item.studentId] = index + 1;
      return acc;
    }, {});
}

async function loadClassScoreContext(classId: number, academicYearId: number) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      grade: true,
      students: {
        include: {
          scores: { where: { academicYearId } },
          externalAwardRecords: { where: { academicYearId } },
          tags: { where: { academicYearId } },
        },
        orderBy: { studentNo: 'asc' },
      },
    },
  });
  if (!cls) throw new Error('班级不存在');

  const items = cls.students.map((student) => {
    const scores = student.scores.reduce<ScoreMap>((acc, score) => {
      acc[score.category] = score.value;
      return acc;
    }, {});
    return { student, scores };
  });

  const academicRanks = rankStudents(items.map((item) => ({
    studentId: item.student.id,
    value: scoreValue(item.scores, 'academic'),
  })));
  const totalRanks = rankStudents(items.map((item) => ({
    studentId: item.student.id,
    value: scoreValue(item.scores, 'total'),
  })));

  return { cls, items, academicRanks, totalRanks };
}

export async function getAwardCandidates(data: {
  academicYearId: number;
  classId: number;
  awardType?: AwardType;
}) {
  const awardType = data.awardType || 'college_scholarship';
  const key = `${data.academicYearId}:${data.classId}:${awardType}`;
  return cacheService.memo('awardCandidates', key, 30 * 1000, async () => {
    const { cls, items, academicRanks, totalRanks } = await loadClassScoreContext(data.classId, data.academicYearId);
    const classSize = Math.max(1, items.length);

    return items.map(({ student, scores }) => {
      const tags = [
        ...student.externalAwardRecords.map((record) => record.awardType),
        ...student.tags.map((tag) => tag.tagName),
      ];
      const evaluation = evaluateAwardCandidate({
        studentId: student.id,
        classSize,
        isComputerCategory: cls.isComputerCategory,
        academicRank: academicRanks[student.id] || classSize,
        totalRank: totalRanks[student.id] || classSize,
        moralScore: scoreValue(scores, 'moral'),
        sportsBaseScore: scoreValue(scores, 'sports_base'),
        communityScore: scoreValue(scores, 'community'),
        tags,
      }, awardType);

      return {
        studentId: student.id,
        studentNo: student.studentNo,
        name: student.name,
        classId: cls.id,
        className: `${cls.grade.name}${cls.name}`,
        isComputerCategory: cls.isComputerCategory,
        academicRank: academicRanks[student.id] || classSize,
        totalRank: totalRanks[student.id] || classSize,
        totalScore: scoreValue(scores, 'total'),
        moralScore: scoreValue(scores, 'moral'),
        sportsBaseScore: scoreValue(scores, 'sports_base'),
        communityScore: scoreValue(scores, 'community'),
        tags,
        ...evaluation,
      };
    });
  });
}
