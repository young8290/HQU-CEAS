import ExcelJS from 'exceljs';
import prisma from '../../../core/db.js';
import { cacheService } from '../../../core/cache.js';
import { recordAuditLog } from '../../platform/services/auditService.js';

function read(cell: ExcelJS.Cell): string {
  return cell.value === null || cell.value === undefined ? '' : String(cell.value).trim();
}

export async function importClassHonorRecords(data: {
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
      type: 'class_honor',
      filename: data.filename || 'class_honors.xlsx',
      academicYearId: data.academicYearId,
      sourceType: 'class_honor',
      importedBy: data.userId,
    },
  });

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum += 1) {
    const row = worksheet.getRow(rowNum);
    const gradeName = read(row.getCell(1));
    const className = read(row.getCell(2));
    const honorType = read(row.getCell(3)) || 'advanced_class';
    if (!className) continue;

    try {
      const cls = await prisma.class.findFirst({
        where: { name: className, ...(gradeName ? { grade: { name: gradeName } } : {}) },
      });
      if (!cls) throw new Error('班级不存在');
      await prisma.classHonorRecord.upsert({
        where: {
          academicYearId_classId_honorType: {
            academicYearId: data.academicYearId,
            classId: cls.id,
            honorType,
          },
        },
        update: { sourceImportLogId: importLog.id },
        create: {
          academicYearId: data.academicYearId,
          classId: cls.id,
          honorType,
          sourceImportLogId: importLog.id,
        },
      });
      successCount += 1;
    } catch (error: any) {
      failures.push({ row: rowNum, className, reason: error.message });
    }
  }

  await prisma.importLog.update({
    where: { id: importLog.id },
    data: { successCount, failCount: failures.length, failDetails: JSON.stringify(failures) },
  });
  cacheService.clear('honorCandidates');
  await recordAuditLog({
    module: 'class_honor',
    action: 'import',
    actorId: data.userId,
    targetType: 'ImportLog',
    targetId: importLog.id,
    after: { successCount, failCount: failures.length },
  });
  return { successCount, failCount: failures.length, failures };
}
