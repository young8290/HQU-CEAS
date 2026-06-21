import prisma from '../config/database.js';
import { cacheService } from './cacheService.js';

export async function upsertStudentTag(data: {
  academicYearId: number;
  studentId: number;
  classId: number;
  tagType: string;
  tagName: string;
  sourceType: string;
  sourceId?: number;
}) {
  const tag = await prisma.tag.create({ data });
  cacheService.clear('tagSummary');
  return tag;
}

export async function listTags(filters: {
  academicYearId?: number;
  tagType?: string;
  classId?: number;
  tagName?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const where = {
    ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
    ...(filters.tagType ? { tagType: filters.tagType } : {}),
    ...(filters.classId ? { classId: filters.classId } : {}),
    ...(filters.tagName ? { tagName: filters.tagName } : {}),
  };
  const [data, total, classSummary, awardSummary] = await Promise.all([
    prisma.tag.findMany({
      where,
      include: {
        student: { select: { studentNo: true, name: true } },
        class: { select: { name: true, grade: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.tag.count({ where }),
    prisma.tag.groupBy({
      by: ['classId'],
      where: filters.academicYearId ? { academicYearId: filters.academicYearId } : undefined,
      _count: { _all: true },
    }),
    prisma.tag.groupBy({
      by: ['tagName'],
      where: filters.academicYearId ? { academicYearId: filters.academicYearId } : undefined,
      _count: { _all: true },
      orderBy: { tagName: 'asc' },
    }),
  ]);

  const classIds = classSummary.map((item) => item.classId).filter((id): id is number => id !== null);
  const classes = classIds.length
    ? await prisma.class.findMany({
        where: { id: { in: classIds } },
        include: { grade: true },
      })
    : [];
  const classMap = new Map(classes.map((item) => [item.id, item]));

  return {
    data,
    summary: {
      classes: classSummary
        .filter((item) => item.classId)
        .map((item) => {
          const cls = classMap.get(item.classId!);
          return {
            classId: item.classId,
            className: cls ? `${cls.grade.name}${cls.name}` : String(item.classId),
            count: item._count._all,
          };
        }),
      awards: awardSummary.map((item) => ({
        tagName: item.tagName,
        count: item._count._all,
      })),
    },
    pagination: { page, pageSize, total },
  };
}
