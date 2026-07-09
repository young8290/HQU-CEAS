import prisma from '../config/database.js';
import { COLLEGE_AWARD_AMOUNTS, validateAwardAllocation } from '../config/awardRules.js';
import { getAwardCandidates } from './awardService.js';
import { cacheService } from './cacheService.js';

export async function getAwardAllocation(data: {
  academicYearId: number;
  classId: number;
  firstCount?: number;
  secondCount?: number;
  thirdCount?: number;
}) {
  const key = JSON.stringify(data);
  return cacheService.memo('awardAllocation', key, 30 * 1000, async () => {
    const candidates = (await getAwardCandidates({
      academicYearId: data.academicYearId,
      classId: data.classId,
      awardType: 'college_scholarship',
    })).filter((item) => item.eligible)
      .sort((a, b) => b.totalScore - a.totalScore);

    const quota = await prisma.awardQuota.findUnique({
      where: {
        academicYearId_classId: {
          academicYearId: data.academicYearId,
          classId: data.classId,
        },
      },
    });
    const quotaCount = quota?.quotaCount ?? candidates.length;
    const availableAmount = quota?.availableAmount ?? Number.MAX_SAFE_INTEGER;
    const firstCount = data.firstCount ?? Math.min(1, candidates.length);
    const secondCount = data.secondCount ?? Math.min(2, Math.max(0, candidates.length - firstCount));
    const thirdCount = data.thirdCount ?? Math.max(0, Math.min(candidates.length - firstCount - secondCount, quotaCount - firstCount - secondCount));
    const validation = validateAwardAllocation({
      quotaCount,
      availableAmount,
      firstCount,
      secondCount,
      thirdCount,
    });

    let cursor = 0;
    const first = candidates.slice(cursor, cursor + firstCount).map((item) => ({ ...item, itemLevel: 'first', amount: COLLEGE_AWARD_AMOUNTS.first }));
    cursor += firstCount;
    const second = candidates.slice(cursor, cursor + secondCount).map((item) => ({ ...item, itemLevel: 'second', amount: COLLEGE_AWARD_AMOUNTS.second }));
    cursor += secondCount;
    const third = candidates.slice(cursor, cursor + thirdCount).map((item) => ({ ...item, itemLevel: 'third', amount: COLLEGE_AWARD_AMOUNTS.third }));

    return {
      quota,
      validation,
      summary: {
        firstCount,
        secondCount,
        thirdCount,
        totalCount: firstCount + secondCount + thirdCount,
        totalAmount: firstCount * COLLEGE_AWARD_AMOUNTS.first
          + secondCount * COLLEGE_AWARD_AMOUNTS.second
          + thirdCount * COLLEGE_AWARD_AMOUNTS.third,
      },
      students: [...first, ...second, ...third],
    };
  });
}
