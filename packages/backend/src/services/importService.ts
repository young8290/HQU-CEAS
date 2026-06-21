import prisma from '../config/database.js';
import ExcelJS from 'exceljs';
import { calculateAcademicScore, calculateSportsBaseScore, type GradeStage } from '../utils/calculation.js';
import * as scoreService from './scoreService.js';

// Safely read cell value as string (handles null, number, richText, formula)
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'richText' in v) {
    return (v as any).richText.map((r: any) => r.text).join('').trim();
  }
  if (typeof v === 'object' && 'result' in v) {
    const r = (v as any).result;
    return r != null ? String(r).trim() : '';
  }
  return String(v).trim();
}

export function resolveGradeStage(stageText: string): GradeStage {
  const normalized = stageText.trim().toLowerCase();
  if (normalized.includes('大三') || normalized.includes('三') || normalized === 'junior') {
    return 'junior';
  }
  if (normalized.includes('大二') || normalized.includes('二') || normalized === 'sophomore') {
    return 'sophomore';
  }
  return 'freshman';
}

export function readSportsImportRow(data: {
  studentNo: string;
  name: string;
  physicalTestScore: string;
  peCourseScore: string;
  gradeStage: string;
  communityScore: string;
}) {
  const physicalTestScore = parseFloat(data.physicalTestScore);
  if (Number.isNaN(physicalTestScore)) {
    throw new Error(`体测成绩无效: ${data.physicalTestScore}`);
  }

  const peCourseScore = data.peCourseScore ? parseFloat(data.peCourseScore) : undefined;
  if (data.peCourseScore && Number.isNaN(peCourseScore)) {
    throw new Error(`体育课成绩无效: ${data.peCourseScore}`);
  }

  const communityScore = data.communityScore ? parseFloat(data.communityScore) : undefined;
  if (data.communityScore && Number.isNaN(communityScore)) {
    throw new Error(`社区表现分无效: ${data.communityScore}`);
  }

  return {
    studentNo: data.studentNo,
    name: data.name,
    physicalTestScore,
    peCourseScore,
    gradeStage: resolveGradeStage(data.gradeStage),
    communityScore,
  };
}

export async function importAcademicScores(buffer: Buffer, academicYearId: number, userId: number, classId?: number) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel文件中没有工作表');

  let successCount = 0;
  let failCount = 0;
  const failures: any[] = [];

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const studentNo = cellText(row.getCell(1));
    const name = cellText(row.getCell(2));
    const gpaStr = cellText(row.getCell(6));

    if (!studentNo) continue;

    try {
      const gpa = parseFloat(gpaStr);
      if (isNaN(gpa)) {
        failCount++;
        failures.push({ row: rowNum, studentNo, name, reason: `绩点值无效: ${gpaStr}` });
        continue;
      }

      const student = await prisma.student.findUnique({ where: { studentNo } });
      if (!student) {
        failCount++;
        failures.push({ row: rowNum, studentNo, name, reason: '学号不存在' });
        continue;
      }

      if (classId && student.classId !== classId) {
        continue; // Skip students not in the target class
      }

      const academicScore = calculateAcademicScore(gpa);
      await scoreService.updateScore({
        studentId: student.id,
        academicYearId,
        category: 'academic',
        value: academicScore,
        updatedBy: userId,
      });

      successCount++;
    } catch (err: any) {
      failCount++;
      failures.push({ row: rowNum, studentNo, name, reason: err.message });
    }
  }

  // Save import log
  await prisma.importLog.create({
    data: {
      type: 'academic',
      filename: 'academic_import.xlsx',
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

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const studentNo = cellText(row.getCell(1));
    const name = cellText(row.getCell(2));
    const physicalTestStr = cellText(row.getCell(3)) || cellText(row.getCell(8));
    const peCourseStr = cellText(row.getCell(4));
    const gradeStageText = cellText(row.getCell(5));
    const communityScoreStr = cellText(row.getCell(6));

    if (!studentNo) continue;

    try {
      const imported = readSportsImportRow({
        studentNo,
        name,
        physicalTestScore: physicalTestStr,
        peCourseScore: peCourseStr,
        gradeStage: gradeStageText,
        communityScore: communityScoreStr,
      });

      const student = await prisma.student.findUnique({ where: { studentNo } });
      if (!student) {
        failCount++;
        failures.push({ row: rowNum, studentNo, name, reason: '学号不存在' });
        continue;
      }

      if (classId && student.classId !== classId) {
        continue; // Skip students not in the target class
      }

      const sportsBase = calculateSportsBaseScore({
        gradeStage: imported.gradeStage,
        physicalTestScore: imported.physicalTestScore,
        peCourseScore: imported.peCourseScore,
      });
      await scoreService.updateScore({
        studentId: student.id,
        academicYearId,
        category: 'physical_test',
        value: imported.physicalTestScore,
        updatedBy: userId,
      });
      if (imported.peCourseScore !== undefined) {
        await scoreService.updateScore({
          studentId: student.id,
          academicYearId,
          category: 'pe_course',
          value: imported.peCourseScore,
          updatedBy: userId,
        });
      }
      if (imported.communityScore !== undefined) {
        await scoreService.updateScore({
          studentId: student.id,
          academicYearId,
          category: 'community',
          value: imported.communityScore,
          updatedBy: userId,
        });
      }
      await scoreService.updateScore({
        studentId: student.id,
        academicYearId,
        category: 'sports_base',
        value: sportsBase,
        updatedBy: userId,
      });

      successCount++;
    } catch (err: any) {
      failCount++;
      failures.push({ row: rowNum, studentNo, name, reason: err.message });
    }
  }

  await prisma.importLog.create({
    data: {
      type: 'sports',
      filename: 'sports_import.xlsx',
      academicYearId,
      sourceType: 'sports_extended',
      successCount,
      failCount,
      failDetails: JSON.stringify(failures),
      importedBy: userId,
    },
  });

  return { successCount, failCount, failures };
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
    } catch (err: any) {
      totalFail++;
      allFailures.push({ row: 0, studentNo: '', name: file.originalname, reason: err.message });
    }
  }

  // Save aggregated import log
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
  
  let successCount = 0;
  let failCount = 0;
  const failures: any[] = [];

  // Personal form format per worksheet:
  // Row 1: A1="学号", B1=<student_no>, C1="姓名", D1=<student_name>
  // Row 2: Headers - B2="德育测评", C2="创新与实践能力", D2="体育附加分", E2="美育", F2="劳动教育", G2="公益服务与社会工作", H2="附加分"
  // Row 3: A3="分数（只填数字）", B3-H3 = numeric scores
  // Row 4: A4="备注", B4-H4 = remark text

  const columnMapping: Array<{ col: number; category: string }> = [
    { col: 2, category: 'moral' },        // B: 德育测评（100分）
    { col: 3, category: 'innovation' },    // C: 创新与实践能力（13分）
    { col: 4, category: 'sports_reward' }, // D: 体育附加分（3分）
    { col: 5, category: 'aesthetics' },    // E: 美育（6分）
    { col: 6, category: 'labor' },         // F: 劳动教育（4分）
    { col: 7, category: 'public_service' },// G: 公益服务与社会工作（10分）
    { col: 8, category: 'bonus' },         // H: 附加分（5分）
  ];

  for (const worksheet of workbook.worksheets) {
    try {
      // Read student info from Row 1
      const studentNo = cellText(worksheet.getCell('B1'));
      const studentName = cellText(worksheet.getCell('D1'));

      if (!studentNo || ['学号填这里', '这里填学号'].includes(studentNo)) {
        // Skip template placeholder sheets silently
        continue;
      }

      const student = await prisma.student.findUnique({ where: { studentNo } });
      if (!student) {
        failCount++;
        failures.push({ row: 0, studentNo, name: studentName, reason: '学号不存在' });
        continue;
      }

      if (student.classId !== classId) {
        failCount++;
        failures.push({ row: 0, studentNo, name: studentName, reason: '该学生不属于本班' });
        continue;
      }

      // Read scores from Row 3 and remarks from Row 4
      const scoreRow = worksheet.getRow(3);
      const remarkRow = worksheet.getRow(4);

      for (const mapping of columnMapping) {
        const scoreCell = scoreRow.getCell(mapping.col);
        const remarkCell = remarkRow.getCell(mapping.col);

        // Robustly read score: handle both numeric and text cells
        let val: number;
        const rawValue = scoreCell.value;
        if (typeof rawValue === 'number') {
          val = rawValue;
        } else {
          val = parseFloat(cellText(scoreCell));
        }

        const remarkText = cellText(remarkCell);

        if (!isNaN(val)) {
          await scoreService.updateScore({
            studentId: student.id,
            academicYearId,
            category: mapping.category as any,
            value: val,
            remark: remarkText || null,
            updatedBy: userId,
          });
        }
      }

      successCount++;
    } catch (err: any) {
      failCount++;
      failures.push({ row: 0, studentNo: '', name: worksheet.name, reason: err.message });
    }
  }

  // Only save individual import log when called standalone (not from batch)
  if (!filename) {
    await prisma.importLog.create({
      data: {
        type: 'personal_form',
        filename: 'personal_form_import.xlsx',
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
