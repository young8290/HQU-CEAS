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
  members: Array<{ name: string; roleName?: string }>;
  actorId?: number;
}) {
  if (data.members.length === 0) {
    throw new Error('审核小组成员不能为空');
  }
  const record = await getOrCreateScoreReviewRecord(data);
  await prisma.$transaction([
    prisma.scoreReviewGroupMember.deleteMany({ where: { recordId: record.id } }),
    ...data.members.map((member, index) => prisma.scoreReviewGroupMember.create({
      data: {
        recordId: record.id,
        name: member.name,
        roleName: member.roleName || null,
        sortOrder: index,
      },
    })),
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
  const members = await prisma.scoreReviewGroupMember.findMany({ where: { recordId: data.recordId } });
  const completed = members.length > 0 && members.every((item) => item.signatureFileId);
  let pdfFileId: number | null = null;

  if (completed) {
    const pdf = await generatePdfMaterial({
      pdfType: 'score_review_confirmation',
      businessType: 'score_review',
      businessId: data.recordId,
      context: { memberCount: members.length },
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
