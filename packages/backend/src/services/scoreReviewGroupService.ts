import prisma from '../config/database.js';
import { cacheService } from './cacheService.js';
import { generatePdfMaterial } from './pdfService.js';
import { recordAuditLog } from './auditService.js';

const DEFAULT_SCORE_REVIEW_MEMBERS = [
  { name: '班长', roleName: '班长' },
  { name: '团支书', roleName: '团支书' },
  { name: '学习委员', roleName: '学习委员' },
];

export async function getOrCreateScoreReviewRecord(data: {
  academicYearId: number;
  classId: number;
}) {
  const record = await prisma.scoreReviewRecord.upsert({
    where: {
      academicYearId_classId: {
        academicYearId: data.academicYearId,
        classId: data.classId,
      },
    },
    update: {},
    create: {
      academicYearId: data.academicYearId,
      classId: data.classId,
      status: 'draft',
    },
    include: {
      members: { orderBy: { sortOrder: 'asc' }, include: { signatureFile: true } },
      pdfFile: { include: { storedFile: true } },
    },
  });

  if (record.members.length > 0) return record;

  await prisma.scoreReviewGroupMember.createMany({
    data: DEFAULT_SCORE_REVIEW_MEMBERS.map((member, index) => ({
      recordId: record.id,
      name: member.name,
      roleName: member.roleName,
      sortOrder: index,
    })),
  });

  const refreshedRecord = await prisma.scoreReviewRecord.findUnique({
    where: { id: record.id },
    include: {
      members: { orderBy: { sortOrder: 'asc' }, include: { signatureFile: true } },
      pdfFile: { include: { storedFile: true } },
    },
  });
  if (!refreshedRecord) {
    throw new Error('综测审核记录不存在');
  }
  return refreshedRecord;
}

export async function saveScoreReviewMembers(data: {
  academicYearId: number;
  classId: number;
  members: Array<{ id?: number; name: string; roleName?: string | null }>;
  actorId?: number;
}) {
  if (data.members.length === 0) {
    throw new Error('审核小组成员不能为空');
  }
  const record = await getOrCreateScoreReviewRecord(data);
  const existingById = new Map(record.members.map((member) => [member.id, member]));
  const retainedMemberIds = data.members
    .map((member) => Number(member.id))
    .filter((memberId) => existingById.has(memberId));
  const deleteWhere = retainedMemberIds.length
    ? { recordId: record.id, id: { notIn: retainedMemberIds } }
    : { recordId: record.id };

  await prisma.$transaction([
    prisma.scoreReviewGroupMember.deleteMany({ where: deleteWhere }),
    ...data.members.map((member, index) => {
      const memberId = Number(member.id);
      const existingMember = existingById.get(memberId);
      const roleName = member.roleName || null;
      if (existingMember) {
        return prisma.scoreReviewGroupMember.update({
          where: { id: existingMember.id },
          data: {
            name: member.name,
            roleName,
            sortOrder: index,
            ...(existingMember.name !== member.name ? { signatureFileId: null, signedAt: null } : {}),
          },
        });
      }

      return prisma.scoreReviewGroupMember.create({
        data: {
          recordId: record.id,
          name: member.name,
          roleName,
          sortOrder: index,
        },
      });
    }),
    prisma.scoreReviewRecord.update({
      where: { id: record.id },
      data: { status: 'draft', pdfFileId: null, completedAt: null },
    }),
  ]);
  cacheService.clear('scoreReviewStatus');
  await recordAuditLog({
    module: 'score_review',
    action: 'set_members',
    actorId: data.actorId,
    targetType: 'ScoreReviewRecord',
    targetId: record.id,
    after: data.members,
  });
  return getOrCreateScoreReviewRecord(data);
}

export async function signScoreReviewMember(data: {
  recordId: number;
  memberId: number;
  signatureFileId: number;
  actorId?: number;
  auditContext?: {
    academicYearId?: number;
    classId?: number;
  };
}) {
  const existingMember = await prisma.scoreReviewGroupMember.findFirst({
    where: { id: data.memberId, recordId: data.recordId },
  });
  if (!existingMember) throw new Error('review_member_not_found');

  const member = await prisma.scoreReviewGroupMember.update({
    where: { id: data.memberId },
    data: { signatureFileId: data.signatureFileId, signedAt: new Date() },
  });
  const members = await prisma.scoreReviewGroupMember.findMany({
    where: { recordId: data.recordId },
    orderBy: { sortOrder: 'asc' },
  });
  const completed = members.length > 0 && members.every((item) => item.signatureFileId);
  let pdfFileId: number | null = null;

  if (completed) {
    const reviewRecord = await prisma.scoreReviewRecord.findUnique({
      where: { id: data.recordId },
      include: { class: { include: { grade: true } }, academicYear: true },
    });
    const pdf = await generatePdfMaterial({
      pdfType: 'score_review_confirmation',
      businessType: 'score_review',
      businessId: data.recordId,
      context: {
        className: reviewRecord ? `${reviewRecord.class.grade.name}${reviewRecord.class.name}` : undefined,
        academicYear: reviewRecord?.academicYear.name,
        memberCount: members.length,
        members: members.map((item) => ({ name: item.name, roleName: item.roleName })),
        completedAt: new Date(),
      },
      generatedBy: data.actorId,
      signatureFileIds: members
        .map((item) => item.signatureFileId)
        .filter((id): id is number => typeof id === 'number'),
    });
    pdfFileId = pdf.id;
    await prisma.scoreReviewRecord.update({
      where: { id: data.recordId },
      data: { status: 'completed', completedAt: new Date(), pdfFileId },
    });
  }

  cacheService.clear('scoreReviewStatus');
  const auditLog = await recordAuditLog({
    module: 'score_review',
    action: 'sign_member',
    academicYearId: data.auditContext?.academicYearId,
    classId: data.auditContext?.classId,
    actorId: data.actorId,
    targetType: 'ScoreReviewGroupMember',
    targetId: member.id,
    after: { signatureFileId: data.signatureFileId, completed },
  });

  const record = await prisma.scoreReviewRecord.findUnique({
    where: { id: data.recordId },
    include: { members: { orderBy: { sortOrder: 'asc' } }, pdfFile: { include: { storedFile: true } } },
  });
  return record ? { ...record, auditLog } : record;
}

export async function getScoreReviewStatus(academicYearId: number, classId: number) {
  return cacheService.memo('scoreReviewStatus', `${academicYearId}:${classId}`, 30 * 1000, async () => {
    const record = await prisma.scoreReviewRecord.findUnique({
      where: { academicYearId_classId: { academicYearId, classId } },
      include: { members: true, pdfFile: true },
    });
    return {
      completed: record?.status === 'completed',
      record,
    };
  });
}
