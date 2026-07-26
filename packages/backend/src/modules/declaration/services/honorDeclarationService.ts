import prisma from '../../../core/db.js';
import { checklistForDeclaration, requireAgreementSignatureFileId } from '../rules/declarationRules.js';
import { getHonorCandidates } from './honorService.js';
import { getScoreReviewStatus } from '../../evaluation/services/scoreReviewGroupService.js';
import { getEntryStatus } from '../../platform/services/systemSettingService.js';
import { generatePdfMaterial } from '../../platform/services/pdfService.js';
import { cacheService } from '../../../core/cache.js';
import { recordAuditLog } from '../../platform/services/auditService.js';

export async function getHonorDeclarationForClass(data: {
  academicYearId: number;
  classId: number;
}) {
  return prisma.declarationBatch.findFirst({
    where: {
      academicYearId: data.academicYearId,
      classId: data.classId,
      declarationType: 'honor',
    },
    include: {
      students: { include: { student: true } },
      checklistItems: true,
      agreementSignatures: { include: { pdfFile: true, signatureFile: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function submitHonorDeclaration(data: {
  academicYearId: number;
  classId: number;
  honorType: string;
  studentSelections: Array<{
    studentId: number;
    itemLevel?: string;
    recommendationSource?: string;
    material?: Record<string, unknown>;
  }>;
  checklist: Record<string, boolean>;
  signatureFileId?: number;
  actorId: number;
}) {
  const signatureFileId = requireAgreementSignatureFileId(data.signatureFileId);
  const entryStatus = await getEntryStatus();
  if (!entryStatus.declarationOpen) throw new Error('申报系统当前关闭');
  const scoreReview = await getScoreReviewStatus(data.academicYearId, data.classId);
  if (!scoreReview.completed) throw new Error('综测评审尚未完成');

  const candidates = await getHonorCandidates({
    academicYearId: data.academicYearId,
    classId: data.classId,
    honorType: data.honorType as any,
  });
  const candidateMap = new Map(candidates.map((item) => [item.studentId, item]));
  for (const selection of data.studentSelections) {
    const candidate = candidateMap.get(selection.studentId);
    if (!candidate?.eligible) throw new Error(`学生 ${selection.studentId} 不符合荣誉称号数字条件`);
  }

  if (data.honorType === 'excellent_cadre') {
    const classHonorCount = await prisma.classHonorRecord.count({
      where: { academicYearId: data.academicYearId, classId: data.classId },
    });
    const classQuota = classHonorCount > 0 ? 2 : 1;
    const classRecommendedCount = data.studentSelections.filter((selection) => {
      const source = selection.recommendationSource || String(selection.material?.recommendationSource || '') || '班级推荐';
      return source !== '学生会推荐';
    }).length;
    if (classRecommendedCount > classQuota) {
      throw new Error(`班级推荐优秀学生干部人数 ${classRecommendedCount} 超过名额 ${classQuota}`);
    }
  }

  const checklistItems = checklistForDeclaration('honor');
  const missingChecklist = checklistItems.filter((item) => !data.checklist[item.code]);
  if (missingChecklist.length > 0) {
    throw new Error(`确认项未完成：${missingChecklist.map((item) => item.label).join('、')}`);
  }

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.declarationBatch.create({
      data: {
        academicYearId: data.academicYearId,
        classId: data.classId,
        declarationType: 'honor',
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
      data: data.studentSelections.map((selection) => ({
        batchId: created.id,
        studentId: selection.studentId,
        itemType: data.honorType,
        itemLevel: selection.itemLevel || String(selection.material?.recommendationLevel || '院级'),
        conditionSnapshotJson: JSON.stringify(candidateMap.get(selection.studentId) || {}),
        materialJson: JSON.stringify(selection.material || {}),
        status: 'pending',
      })),
    });
    return created;
  });

  const [academicYear, signer] = await Promise.all([
    prisma.academicYear.findUnique({ where: { id: data.academicYearId } }),
    prisma.user.findUnique({ where: { id: data.actorId } }),
  ]);
  const declarationStudents = data.studentSelections.map((selection) => {
    const candidate = candidateMap.get(selection.studentId);
    const recommendation = selection.recommendationSource
      || String(selection.material?.recommendationSource || '')
      || (data.honorType === 'excellent_cadre' ? '班级推荐' : '');
    return {
      name: candidate?.name ?? '',
      studentNo: candidate?.studentNo ?? '',
      recommendation: data.honorType === 'excellent_cadre' ? recommendation : '',
    };
  });

  const pdf = await generatePdfMaterial({
    pdfType: 'monitor_agreement',
    businessType: 'declaration_batch',
    businessId: batch.id,
    context: {
      declarationType: 'honor',
      honorType: data.honorType,
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
    module: 'honor_declaration',
    action: 'submit',
    actorId: data.actorId,
    targetType: 'DeclarationBatch',
    targetId: batch.id,
    after: data,
  });

  return getHonorDeclarationForClass(data);
}
