import prisma from '../config/database.js';
import { cacheService } from './cacheService.js';
import { recordAuditLog } from './auditService.js';

export async function listDeclarationReviews(filters: {
  academicYearId?: number;
  declarationType?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const where = {
    ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
    ...(filters.declarationType ? { declarationType: filters.declarationType } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.declarationBatch.findMany({
      where,
      include: {
        class: { include: { grade: true } },
        students: { include: { student: true } },
        submittedByUser: { select: { username: true, displayName: true } },
      },
      orderBy: { submittedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.declarationBatch.count({ where }),
  ]);

  return { data, pagination: { page, pageSize, total } };
}

export async function getDeclarationReviewDetail(id: number) {
  return prisma.declarationBatch.findUnique({
    where: { id },
    include: {
      class: { include: { grade: true } },
      students: { include: { student: true } },
      checklistItems: true,
      agreementSignatures: { include: { pdfFile: { include: { storedFile: true } } } },
      submittedByUser: { select: { username: true, displayName: true } },
      reviewedByUser: { select: { username: true, displayName: true } },
    },
  });
}

export async function returnDeclaration(id: number, opinion: string, actorId: number) {
  const updated = await prisma.declarationBatch.update({
    where: { id },
    data: {
      status: 'returned',
      reviewOpinion: opinion,
      reviewedBy: actorId,
      reviewedAt: new Date(),
    },
  });
  cacheService.clear('declarationList');
  await recordAuditLog({
    module: 'declaration_review',
    action: 'return',
    actorId,
    targetType: 'DeclarationBatch',
    targetId: id,
    after: { opinion },
  });
  return updated;
}

export async function approveDeclaration(
  id: number,
  opinion: string,
  actorId: number,
  studentLevels?: Array<{ declarationStudentId: number; itemLevel: string }>,
) {
  const updated = await prisma.$transaction(async (tx) => {
    if (studentLevels?.length) {
      for (const item of studentLevels) {
        await tx.declarationStudent.update({
          where: { id: item.declarationStudentId },
          data: { itemLevel: item.itemLevel },
        });
      }
    }

    const batch = await tx.declarationBatch.update({
      where: { id },
      data: {
        status: 'approved',
        reviewOpinion: opinion,
        reviewedBy: actorId,
        reviewedAt: new Date(),
      },
      include: { students: true },
    });
    await tx.tag.deleteMany({
      where: {
        tagType: 'declaration',
        sourceType: 'declaration_batch',
        sourceId: batch.id,
      },
    });
    for (const student of batch.students) {
      await tx.tag.create({
        data: {
          academicYearId: batch.academicYearId,
          studentId: student.studentId,
          classId: batch.classId,
          tagType: 'declaration',
          tagName: `${batch.declarationType}_approved`,
          sourceType: 'declaration_batch',
          sourceId: batch.id,
        },
      });
    }
    return batch;
  });
  cacheService.clear('declarationList');
  cacheService.clear('tagSummary');
  await recordAuditLog({
    module: 'declaration_review',
    action: 'approve',
    actorId,
    targetType: 'DeclarationBatch',
    targetId: id,
    after: { opinion },
  });
  return updated;
}
