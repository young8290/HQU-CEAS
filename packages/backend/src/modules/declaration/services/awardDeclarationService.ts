import prisma from '../../../core/db.js';
import { checklistForDeclaration, requireAgreementSignatureFileId } from '../rules/declarationRules.js';
import { getAwardCandidates } from './awardService.js';
import { getAwardAllocation } from './awardAllocationService.js';
import { getScoreReviewStatus } from '../../evaluation/services/scoreReviewGroupService.js';
import { getEntryStatus } from '../../platform/services/systemSettingService.js';
import { generatePdfMaterial } from '../../platform/services/pdfService.js';
import { cacheService } from '../../../core/cache.js';
import { recordAuditLog } from '../../platform/services/auditService.js';

export async function getAwardDeclarationForClass(data: {
  academicYearId: number;
  classId: number;
}) {
  return prisma.declarationBatch.findFirst({
    where: {
      academicYearId: data.academicYearId,
      classId: data.classId,
      declarationType: 'award',
    },
    include: {
      students: { include: { student: true } },
      checklistItems: true,
      agreementSignatures: { include: { pdfFile: true, signatureFile: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function submitAwardDeclaration(data: {
  academicYearId: number;
  classId: number;
  studentSelections: Array<{ studentId: number; itemLevel?: string; amount?: number }>;
  checklist: Record<string, boolean>;
  signatureFileId?: number;
  actorId: number;
}) {
  const signatureFileId = requireAgreementSignatureFileId(data.signatureFileId);
  const entryStatus = await getEntryStatus();
  if (!entryStatus.declarationOpen) throw new Error('申报系统当前关闭');
  const scoreReview = await getScoreReviewStatus(data.academicYearId, data.classId);
  if (!scoreReview.completed) throw new Error('综测评审尚未完成');

  const candidates = await getAwardCandidates({
    academicYearId: data.academicYearId,
    classId: data.classId,
    awardType: 'college_scholarship',
  });
  const candidateMap = new Map(candidates.map((item) => [item.studentId, item]));
  for (const selection of data.studentSelections) {
    const candidate = candidateMap.get(selection.studentId);
    if (!candidate?.eligible) throw new Error(`学生 ${selection.studentId} 不符合奖学金数字条件`);
  }

  const checklistItems = checklistForDeclaration('award');
  const missingChecklist = checklistItems.filter((item) => !data.checklist[item.code]);
  if (missingChecklist.length > 0) {
    throw new Error(`确认项未完成：${missingChecklist.map((item) => item.label).join('、')}`);
  }

  const allocation = await getAwardAllocation({
    academicYearId: data.academicYearId,
    classId: data.classId,
  });
  if (!allocation.validation.valid) {
    throw new Error(`院奖分配未通过：${allocation.validation.issues.join('、')}`);
  }

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.declarationBatch.create({
      data: {
        academicYearId: data.academicYearId,
        classId: data.classId,
        declarationType: 'award',
        status: 'submitted',
        submittedBy: data.actorId,
        submittedAt: new Date(),
      },
    });
    await tx.declarationChecklistItem.createMany({
      data: checklistItems.map((item) => ({
        batchId: created.id,
        code: item.code,
        label: item.label,
        checked: true,
        checkedBy: data.actorId,
        checkedAt: new Date(),
      })),
    });
    await tx.declarationStudent.createMany({
      data: data.studentSelections.map((selection) => {
        const candidate = candidateMap.get(selection.studentId);
        return {
          batchId: created.id,
          studentId: selection.studentId,
          itemType: 'college_scholarship',
          itemLevel: selection.itemLevel || 'third',
          amount: selection.amount ?? 600,
          conditionSnapshotJson: JSON.stringify(candidate || {}),
          materialJson: '{}',
          status: 'pending',
        };
      }),
    });
    return created;
  });

  const [academicYear, signer] = await Promise.all([
    prisma.academicYear.findUnique({ where: { id: data.academicYearId } }),
    prisma.user.findUnique({ where: { id: data.actorId } }),
  ]);
  const awardLevelLabels: Record<string, string> = {
    first: '院一等奖学金',
    second: '院二等奖学金',
    third: '院三等奖学金',
    overseas_third: '境外生院三等奖学金',
  };
  const declarationStudents = data.studentSelections.map((selection) => {
    const candidate = candidateMap.get(selection.studentId);
    const level = selection.itemLevel || 'third';
    return {
      name: candidate?.name ?? '',
      studentNo: candidate?.studentNo ?? '',
      award: awardLevelLabels[level] ?? '院三等奖学金',
      amount: selection.amount ?? 600,
    };
  });

  const pdf = await generatePdfMaterial({
    pdfType: 'monitor_agreement',
    businessType: 'declaration_batch',
    businessId: batch.id,
    context: {
      declarationType: 'award',
      className: candidates[0]?.className,
      academicYear: academicYear?.name,
      signerName: signer?.displayName || signer?.username,
      signedAt: new Date().toISOString(),
      students: declarationStudents,
      confirmedItems: checklistItems.map((item) => item.label),
    },
    generatedBy: data.actorId,
    signatureFileIds: [signatureFileId],
  });
  await prisma.agreementSignature.create({
    data: {
      batchId: batch.id,
      agreementVersion: 1,
      signatureFileId,
      pdfFileId: pdf.id,
      signedBy: data.actorId,
      signedAt: new Date(),
    },
  });

  cacheService.clear('declarationList');
  cacheService.clear('dashboard');
  await recordAuditLog({
    module: 'award_declaration',
    action: 'submit',
    actorId: data.actorId,
    targetType: 'DeclarationBatch',
    targetId: batch.id,
    after: data,
  });

  return getAwardDeclarationForClass(data);
}
