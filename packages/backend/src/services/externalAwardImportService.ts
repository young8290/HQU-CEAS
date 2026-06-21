import ExcelJS from 'exceljs';
import prisma from '../config/database.js';
import { assertExternalAwardType } from '../config/awardRules.js';
import { cacheService } from './cacheService.js';
import { recordAuditLog } from './auditService.js';

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'result' in value) return String((value as any).result ?? '').trim();
  if (typeof value === 'object' && 'text' in value) return String((value as any).text ?? '').trim();
  return String(value).trim();
}

export async function importExternalAwardRecords(data: {
  buffer: Buffer;
  academicYearId: number;
  awardType: string;
  userId: number;
  filename?: string;
}) {
  assertExternalAwardType(data.awardType);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data.buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel文件中没有工作表');

  let successCount = 0;
  let failCount = 0;
  const failures: Array<{ row: number; studentNo: string; reason: string }> = [];

  const importLog = await prisma.importLog.create({
    data: {
      type: 'external_award',
      filename: data.filename || 'external_awards.xlsx',
      academicYearId: data.academicYearId,
      sourceType: data.awardType,
      successCount: 0,
      failCount: 0,
      importedBy: data.userId,
    },
  });

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum += 1) {
    const row = worksheet.getRow(rowNum);
    const studentNo = cellText(row.getCell(1));
    const name = cellText(row.getCell(2));
    const awardName = cellText(row.getCell(3)) || data.awardType;
    const level = cellText(row.getCell(4));
    if (!studentNo) continue;

    try {
      const student = await prisma.student.findUnique({ where: { studentNo } });
      if (!student) {
        failCount += 1;
        failures.push({ row: rowNum, studentNo, reason: '学号不存在' });
        continue;
      }

      await prisma.externalAwardRecord.upsert({
        where: {
          academicYearId_studentId_awardType: {
            academicYearId: data.academicYearId,
            studentId: student.id,
            awardType: data.awardType,
          },
        },
        update: { awardName, level, sourceImportLogId: importLog.id },
        create: {
          academicYearId: data.academicYearId,
          studentId: student.id,
          awardType: data.awardType,
          awardName,
          level,
          sourceImportLogId: importLog.id,
        },
      });

      await prisma.tag.create({
        data: {
          academicYearId: data.academicYearId,
          studentId: student.id,
          classId: student.classId,
          tagType: 'external_award',
          tagName: data.awardType,
          sourceType: 'external_award',
          sourceId: importLog.id,
        },
      });
      successCount += 1;
    } catch (error: any) {
      failCount += 1;
      failures.push({ row: rowNum, studentNo, reason: error.message || name || '导入失败' });
    }
  }

  await prisma.importLog.update({
    where: { id: importLog.id },
    data: {
      successCount,
      failCount,
      failDetails: JSON.stringify(failures),
    },
  });
  cacheService.clear('awardCandidates');
  cacheService.clear('honorCandidates');
  cacheService.clear('tagSummary');
  await recordAuditLog({
    module: 'external_award',
    action: 'import',
    actorId: data.userId,
    targetType: 'ImportLog',
    targetId: importLog.id,
    after: { awardType: data.awardType, successCount, failCount },
  });

  return { successCount, failCount, failures };
}
