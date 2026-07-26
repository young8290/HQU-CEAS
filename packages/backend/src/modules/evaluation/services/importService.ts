import prisma from '../../../core/db.js';
import ExcelJS from 'exceljs';
import { calculateAcademicScore, calculateSportsBaseScore, type GradeStage } from '../../../core/utils/calculation.js';
import * as scoreService from './scoreService.js';
import type { ScoreCategory } from '../rules/scoreRules.js';

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((item: any) => item.text).join('').trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    const result = value.result;
    return result == null ? '' : String(result).trim();
  }
  return String(value).trim();
}

export function resolveGradeStage(stageText: string): GradeStage {
  const normalized = stageText.trim().toLowerCase();
  if (normalized.includes('大三') || normalized.includes('junior') || normalized.includes('三')) return 'junior';
  if (normalized.includes('大二') || normalized.includes('sophomore') || normalized.includes('二')) return 'sophomore';
  return 'freshman';
}

export function readSportsImportRow(data: {
  studentNo: string;
  name: string;
  physicalTestScore: string;
  peCourseScore: string;
  gradeStage: string;
}) {
  const physicalTestScore = parseFloat(data.physicalTestScore);
  if (Number.isNaN(physicalTestScore)) {
    throw new Error(`体测成绩无效: ${data.physicalTestScore}`);
  }

  const peCourseScore = data.peCourseScore ? parseFloat(data.peCourseScore) : undefined;
  if (data.peCourseScore && Number.isNaN(peCourseScore)) {
    throw new Error(`体育课成绩无效: ${data.peCourseScore}`);
  }

  return {
    studentNo: data.studentNo,
    name: data.name,
    physicalTestScore,
    peCourseScore,
    gradeStage: resolveGradeStage(data.gradeStage),
  };
}

async function findStudent(studentNo: string) {
  return prisma.student.findUnique({ where: { studentNo } });
}

type ImportStudentRecord = { id: number; classId: number };

/**
 * 一次性预取本次导入涉及的全部学生（PLAN_V2 §5.2）：
 * 以 studentNo in (...) 单查代替逐行 findUnique，消灭串行往返。
 */
async function prefetchStudentsByNo(studentNos: string[]): Promise<Map<string, ImportStudentRecord>> {
  const uniqueNos = Array.from(new Set(studentNos));
  if (uniqueNos.length === 0) return new Map();
  const students = await prisma.student.findMany({
    where: { studentNo: { in: uniqueNos } },
    select: { id: true, classId: true, studentNo: true },
  });
  return new Map(students.map((student) => [student.studentNo, { id: student.id, classId: student.classId }]));
}

async function getCurrentYearId(academicYearId: number) {
  return academicYearId;
}

export async function importAcademicScores(buffer: Buffer, academicYearId: number, userId: number, classId?: number) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel文件中没有工作表');

  let successCount = 0;
  let failCount = 0;
  const failures: any[] = [];

  // 先整表读出待导入行，再一次性预取涉及学生（PLAN_V2 §5.2）
  const pendingRows: Array<{ rowNum: number; studentNo: string; name: string; gpaStr: string }> = [];
  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum += 1) {
    const row = worksheet.getRow(rowNum);
    const studentNo = cellText(row.getCell(1));
    if (!studentNo) continue;
    pendingRows.push({
      rowNum,
      studentNo,
      name: cellText(row.getCell(2)),
      gpaStr: cellText(row.getCell(6)),
    });
  }
  const studentByNo = await prefetchStudentsByNo(pendingRows.map((item) => item.studentNo));

  for (const pending of pendingRows) {
    const { rowNum, studentNo, name, gpaStr } = pending;
    try {
      const gpa = parseFloat(gpaStr);
      if (Number.isNaN(gpa)) {
        failCount += 1;
        failures.push({ row: rowNum, studentNo, name, reason: `绩点值无效: ${gpaStr}` });
        continue;
      }

      const student = studentByNo.get(studentNo);
      if (!student) {
        failCount += 1;
        failures.push({ row: rowNum, studentNo, name, reason: '学号不存在' });
        continue;
      }
      if (classId && student.classId !== classId) continue;

      const academicScore = calculateAcademicScore(gpa);
      // updateScore 内部为"每生一个事务"：写入 + sports_total/total 重算合并单事务
      await scoreService.updateScore({
        studentId: student.id,
        academicYearId,
        category: 'academic',
        value: academicScore,
        updatedBy: userId,
      });
      successCount += 1;
    } catch (error: any) {
      failCount += 1;
      failures.push({ row: rowNum, studentNo, name, reason: error.message });
    }
  }

  await prisma.importLog.create({
    data: {
      type: 'academic',
      filename: 'academic_import.xlsx',
      academicYearId,
      successCount,
      failCount,
      failDetails: JSON.stringify(failures),
      importedBy: userId,
    },
  });

  return { successCount, failCount, failures };
}

export async function importSportsScores(buffer: Buffer, academicYearId: number, userId: number, classId?: number) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel文件中没有工作表');

  let successCount = 0;
  let failCount = 0;
  const failures: any[] = [];

  // 先整表读出待导入行，再一次性预取涉及学生（PLAN_V2 §5.2）
  const pendingRows: Array<{
    rowNum: number;
    studentNo: string;
    name: string;
    physicalTestScore: string;
    peCourseScore: string;
    gradeStage: string;
  }> = [];
  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum += 1) {
    const row = worksheet.getRow(rowNum);
    const studentNo = cellText(row.getCell(1));
    if (!studentNo) continue;
    pendingRows.push({
      rowNum,
      studentNo,
      name: cellText(row.getCell(2)),
      physicalTestScore: cellText(row.getCell(3)),
      peCourseScore: cellText(row.getCell(4)),
      gradeStage: cellText(row.getCell(5)),
    });
  }
  const studentByNo = await prefetchStudentsByNo(pendingRows.map((item) => item.studentNo));

  for (const pending of pendingRows) {
    const { rowNum, studentNo, name } = pending;
    try {
      const imported = readSportsImportRow({
        studentNo,
        name,
        physicalTestScore: pending.physicalTestScore,
        peCourseScore: pending.peCourseScore,
        gradeStage: pending.gradeStage,
      });

      const student = studentByNo.get(studentNo);
      if (!student) {
        failCount += 1;
        failures.push({ row: rowNum, studentNo, name: imported.name, reason: '学号不存在' });
        continue;
      }
      if (classId && student.classId !== classId) continue;

      const sportsBase = calculateSportsBaseScore({
        gradeStage: imported.gradeStage,
        physicalTestScore: imported.physicalTestScore,
        peCourseScore: imported.peCourseScore,
      });

      // updateScore 内部为"每生一个事务"：写入 + sports_total/total 重算合并单事务
      await scoreService.updateScore({
        studentId: student.id,
        academicYearId,
        category: 'sports_base',
        value: sportsBase,
        updatedBy: userId,
      });
      successCount += 1;
    } catch (error: any) {
      failCount += 1;
      failures.push({ row: rowNum, studentNo, name, reason: error.message });
    }
  }

  await prisma.importLog.create({
    data: {
      type: 'sports',
      filename: 'sports_import.xlsx',
      academicYearId,
      sourceType: 'sports_basic',
      successCount,
      failCount,
      failDetails: JSON.stringify(failures),
      importedBy: userId,
    },
  });

  return { successCount, failCount, failures };
}

const PERSONAL_FORM_SHEETS: Array<{ sheetName: string; category: ScoreCategory }> = [
  { sheetName: '德育测评', category: 'moral' },
  { sheetName: '创新与实践能力', category: 'innovation' },
  { sheetName: '体育奖励分', category: 'sports_reward' },
  { sheetName: '美育', category: 'aesthetics' },
  { sheetName: '劳动教育', category: 'labor' },
  { sheetName: '公益服务与社会工作', category: 'public_service' },
  { sheetName: '附加分', category: 'bonus' },
];

function readPersonalDetailRows(worksheet: ExcelJS.Worksheet) {
  const items: Array<{ itemName: string; itemScore: number }> = [];
  for (let row = 5; row <= 19; row += 1) {
    const itemName = cellText(worksheet.getCell(`A${row}`));
    const scoreText = cellText(worksheet.getCell(`B${row}`));
    if (!itemName && !scoreText) continue;
    if (!itemName || !scoreText) {
      throw new Error(`${worksheet.name} 第 ${row} 行填写不完整`);
    }
    const itemScore = Number.parseFloat(scoreText);
    if (Number.isNaN(itemScore)) {
      throw new Error(`${worksheet.name} 第 ${row} 行加分分数无效`);
    }
    items.push({ itemName, itemScore });
  }
  return items;
}

export async function importPersonalFormMultiple(files: { buffer: Buffer; originalname: string }[], academicYearId: number, classId: number, userId: number) {
  let totalSuccess = 0;
  let totalFail = 0;
  const allFailures: any[] = [];

  for (const file of files) {
    try {
      const result = await importPersonalForm(file.buffer, academicYearId, classId, userId, file.originalname);
      totalSuccess += result.successCount;
      totalFail += result.failCount;
      allFailures.push(...result.failures);
    } catch (error: any) {
      totalFail += 1;
      allFailures.push({ row: 0, studentNo: '', name: file.originalname, reason: error.message });
    }
  }

  await prisma.importLog.create({
    data: {
      type: 'personal_form',
      filename: files.length === 1 ? files[0].originalname : `${files.length}个文件批量导入`,
      academicYearId,
      sourceType: 'personal_form',
      successCount: totalSuccess,
      failCount: totalFail,
      failDetails: JSON.stringify(allFailures),
      importedBy: userId,
    },
  });

  return { successCount: totalSuccess, failCount: totalFail, failures: allFailures };
}

export async function importPersonalForm(buffer: Buffer, academicYearId: number, classId: number, userId: number, filename?: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const infoSheet = workbook.getWorksheet('学生信息') || workbook.worksheets[0];
  if (!infoSheet) throw new Error('Excel文件中没有工作表');

  const studentNo = cellText(infoSheet.getCell('B3'));
  const studentName = cellText(infoSheet.getCell('D3'));
  if (!studentNo || studentNo.includes('这里填学号')) {
    throw new Error('学生信息页缺少学号');
  }

  const student = await findStudent(studentNo);
  if (!student) {
    throw new Error(`学号不存在: ${studentNo}`);
  }
  if (student.classId !== classId) {
    throw new Error('该学生不属于本班');
  }

  let successCount = 0;
  let failCount = 0;
  const failures: any[] = [];

  for (const { sheetName, category } of PERSONAL_FORM_SHEETS) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      failCount += 1;
      failures.push({ row: 0, studentNo, name: studentName, reason: `缺少工作表: ${sheetName}` });
      continue;
    }

    try {
      const items = readPersonalDetailRows(worksheet);
      await scoreService.saveScoreBonusDetails({
        studentId: student.id,
        academicYearId: await getCurrentYearId(academicYearId),
        category,
        items,
        updatedBy: userId,
      });
      successCount += 1;
    } catch (error: any) {
      failCount += 1;
      failures.push({ row: 0, studentNo, name: studentName, reason: error.message });
    }
  }

  if (!filename) {
    await prisma.importLog.create({
      data: {
        type: 'personal_form',
        filename: 'personal_form_import.xlsx',
        academicYearId,
        sourceType: 'personal_form',
        successCount,
        failCount,
        failDetails: JSON.stringify(failures),
        importedBy: userId,
      },
    });
  }

  return { successCount, failCount, failures };
}

export async function getImportLogs(filters?: { type?: string; limit?: number }) {
  return prisma.importLog.findMany({
    where: filters?.type ? { type: filters.type } : undefined,
    orderBy: { createdAt: 'desc' },
    take: filters?.limit || 50,
    include: {
      importedByUser: {
        select: { username: true, displayName: true },
      },
    },
  });
}
