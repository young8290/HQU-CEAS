import ExcelJS from 'exceljs';
import prisma from '../../../core/db.js';
import { cacheService } from '../../../core/cache.js';
import { recordAuditLog } from '../../platform/services/auditService.js';

type BoolLike = boolean | null;

const yesValues = new Set(['是', '有', '同意', '愿意', 'true', '1', 'yes']);
const noValues = new Set(['否', '无', '不同意', '不愿意', 'false', '0', 'no']);

function read(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return (value as any).richText.map((item: any) => item.text).join('').trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    return String((value as any).result ?? '').trim();
  }
  return String(value).trim();
}

function readBool(text: string): BoolLike {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  if (yesValues.has(normalized)) return true;
  if (noValues.has(normalized)) return false;
  throw new Error(`布尔值无效：${text}`);
}

function normalizeLevel(text: string) {
  const normalized = text.trim();
  if (!normalized) return null;
  if (['校级', '院级'].includes(normalized)) return normalized;
  throw new Error(`申报级别只能填写校级或院级：${text}`);
}

function normalizeSource(text: string) {
  const normalized = text.trim();
  if (!normalized) return '班级推荐';
  if (['班级推荐', '学生会推荐'].includes(normalized)) return normalized;
  throw new Error(`优秀学生干部推荐来源只能填写班级推荐或学生会推荐：${text}`);
}

export function readDeclarationSupplementRow(values: string[]) {
  const excellentCadreRecommendationSource = normalizeSource(values[7] || '');
  return {
    studentNo: values[0]?.trim() || '',
    name: values[1]?.trim() || '',
    gender: values[2]?.trim() || null,
    averageGpa: null,
    disciplinaryAction: values[3]?.trim() || '无',
    excellentStudentIntent: readBool(values[4] || ''),
    excellentStudentRecommendationLevel: normalizeLevel(values[5] || ''),
    excellentCadreIntent: readBool(values[6] || ''),
    excellentCadreRecommendationSource,
    excellentCadreRecommendationLevel: normalizeLevel(values[8] || ''),
    positionInfo: values[9]?.trim() || null,
    competitionActivity: values[10]?.trim() || null,
    remark: values[11]?.trim() || null,
  };
}

export async function importDeclarationSupplements(data: {
  buffer: Buffer;
  academicYearId: number;
  classId?: number;
  userId: number;
  filename?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data.buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel文件中没有工作表');

  const importLog = await prisma.importLog.create({
    data: {
      type: 'declaration_supplement',
      filename: data.filename || 'declaration_supplements.xlsx',
      academicYearId: data.academicYearId,
      sourceType: 'declaration_supplement',
      importedBy: data.userId,
    },
  });

  let successCount = 0;
  const failures: Array<{ row: number; studentNo: string; name: string; reason: string }> = [];

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum += 1) {
    const row = worksheet.getRow(rowNum);
    const parsed = readDeclarationSupplementRow(Array.from({ length: 12 }, (_, index) => read(row.getCell(index + 1))));
    const studentNo = parsed.studentNo;
    const name = parsed.name;
    if (!studentNo) continue;

    try {
      const student = await prisma.student.findUnique({ where: { studentNo } });
      if (!student) throw new Error('学号不存在');
      if (data.classId && student.classId !== data.classId) throw new Error('该学生不属于当前班级');

      await prisma.declarationSupplement.upsert({
        where: {
          academicYearId_studentId: {
            academicYearId: data.academicYearId,
            studentId: student.id,
          },
        },
        update: {
          gender: parsed.gender,
          averageGpa: null,
          disciplinaryAction: parsed.disciplinaryAction,
          excellentStudentIntent: parsed.excellentStudentIntent,
          excellentStudentRecommendationLevel: parsed.excellentStudentRecommendationLevel,
          excellentCadreIntent: parsed.excellentCadreIntent,
          excellentCadreRecommendationSource: parsed.excellentCadreRecommendationSource,
          excellentCadreRecommendationLevel: parsed.excellentCadreRecommendationLevel,
          positionInfo: parsed.positionInfo,
          competitionActivity: parsed.competitionActivity,
          remark: parsed.remark,
          updatedBy: data.userId,
        },
        create: {
          academicYearId: data.academicYearId,
          studentId: student.id,
          gender: parsed.gender,
          averageGpa: null,
          disciplinaryAction: parsed.disciplinaryAction,
          excellentStudentIntent: parsed.excellentStudentIntent,
          excellentStudentRecommendationLevel: parsed.excellentStudentRecommendationLevel,
          excellentCadreIntent: parsed.excellentCadreIntent,
          excellentCadreRecommendationSource: parsed.excellentCadreRecommendationSource,
          excellentCadreRecommendationLevel: parsed.excellentCadreRecommendationLevel,
          positionInfo: parsed.positionInfo,
          competitionActivity: parsed.competitionActivity,
          remark: parsed.remark,
          updatedBy: data.userId,
        },
      });

      successCount += 1;
    } catch (error: any) {
      failures.push({ row: rowNum, studentNo, name, reason: error.message });
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
  cacheService.clear('honorCandidates');
  cacheService.clear('declarationList');
  await recordAuditLog({
    module: 'declaration_supplement',
    action: 'import',
    actorId: data.userId,
    targetType: 'ImportLog',
    targetId: importLog.id,
    after: { successCount, failCount: failures.length },
  });

  return { successCount, failCount: failures.length, failures };
}
