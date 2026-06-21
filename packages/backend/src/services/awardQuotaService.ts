import ExcelJS from 'exceljs';
import prisma from '../config/database.js';
import { cacheService } from './cacheService.js';
import { recordAuditLog } from './auditService.js';

function text(cell: ExcelJS.Cell): string {
  return cell.value === null || cell.value === undefined ? '' : String(cell.value).trim();
}

export async function importAwardQuotas(data: {
  buffer: Buffer;
  academicYearId: number;
  userId: number;
  filename?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data.buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel文件中没有工作表');

  let successCount = 0;
  const failures: Array<{ row: number; className: string; reason: string }> = [];
  const importLog = await prisma.importLog.create({
    data: {
      type: 'award_quota',
      filename: data.filename || 'award_quotas.xlsx',
      academicYearId: data.academicYearId,
      sourceType: 'college_award_quota',
      importedBy: data.userId,
    },
  });

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum += 1) {
    const row = worksheet.getRow(rowNum);
    const gradeName = text(row.getCell(1));
    const className = text(row.getCell(2));
    const quotaCount = parseInt(text(row.getCell(3)), 10);
    const availableAmount = parseFloat(text(row.getCell(4)));
    if (!className) continue;

    try {
      const cls = await prisma.class.findFirst({
        where: { name: className, ...(gradeName ? { grade: { name: gradeName } } : {}) },
      });
      if (!cls) throw new Error('班级不存在');
      if (Number.isNaN(quotaCount) || Number.isNaN(availableAmount)) throw new Error('名额或金额格式错误');

      await prisma.awardQuota.upsert({
        where: {
          academicYearId_classId: {
            academicYearId: data.academicYearId,
            classId: cls.id,
          },
        },
        update: { quotaCount, availableAmount, remark: text(row.getCell(5)) },
        create: {
          academicYearId: data.academicYearId,
          classId: cls.id,
          quotaCount,
          availableAmount,
          remark: text(row.getCell(5)) || null,
        },
      });
      successCount += 1;
    } catch (error: any) {
      failures.push({ row: rowNum, className, reason: error.message });
    }
  }

  await prisma.importLog.update({
    where: { id: importLog.id },
    data: {
      successCount,
      failCount: failures.length,
      failDetails: JSON.stringify(failures),
    },
  });
  cacheService.clear('awardAllocation');
  await recordAuditLog({
    module: 'award_quota',
    action: 'import',
    actorId: data.userId,
    targetType: 'ImportLog',
    targetId: importLog.id,
    after: { successCount, failCount: failures.length },
  });

  return { successCount, failCount: failures.length, failures };
}

export async function listAwardQuotas(academicYearId: number) {
  return prisma.awardQuota.findMany({
    where: { academicYearId },
    include: { class: { include: { grade: true } } },
    orderBy: [{ class: { grade: { name: 'asc' } } }, { class: { name: 'asc' } }],
  });
}
