import prisma from '../../../core/db.js';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { COLLEGE_AWARD_AMOUNTS } from '../rules/awardRules.js';
import { rankByScoreDesc } from '../../../core/utils/ranking.js';
import { TEMPLATE_DIR, workbookToBuffer } from '../../../core/utils/excel.js';

/**
 * 申报系统导出服务（原 exportService 的申报半，PLAN_V2 §3）：
 * 附件2申报汇总（含签字名单复用）与各类简表导出。
 * 综测系统导出见 modules/evaluation/services/exportService.ts。
 */

const declarationSummaryTemplate = '附件2_院奖荣誉汇总_template.xlsx';
const DECLARATION_ATTACHMENT2_START_ROW = 4;
const DECLARATION_ATTACHMENT2_TEMPLATE_LAST_DETAIL_ROW = 11;
const DECLARATION_ATTACHMENT2_TEMPLATE_SUMMARY_ROW = 12;
const DECLARATION_ATTACHMENT2_DETAIL_COLUMNS = 19;
const DECLARATION_ATTACHMENT2_NOTE_START_COLUMN = 20;
const DECLARATION_ATTACHMENT2_NOTE_END_COLUMN = 24;

function scoreValue(scores: Array<{ category: string; value: number }>, category: string) {
  return scores.find((score) => score.category === category)?.value ?? 0;
}

function levelLabel(level?: string | null) {
  const map: Record<string, string> = {
    first: '境内生院一等奖学金',
    second: '境内生院二等奖学金',
    third: '境内生院三等奖学金',
    overseas_third: '境外生院三等奖学金',
    school: '校级',
    college: '院级',
    校级: '校级',
    院级: '院级',
  };
  return level ? map[level] || level : '';
}

function awardAmount(level?: string | null, amount?: number | null) {
  if (typeof amount === 'number') return amount;
  if (level === 'first') return COLLEGE_AWARD_AMOUNTS.first;
  if (level === 'second') return COLLEGE_AWARD_AMOUNTS.second;
  if (level === 'third' || level === 'overseas_third') return COLLEGE_AWARD_AMOUNTS.third;
  return 0;
}

function averageGpaFromAcademicScore(scores: Array<{ category: string; value: number }>) {
  const academicScore = scoreValue(scores, 'academic');
  if (!academicScore) return '';
  return Number((academicScore / 8 - 2.5).toFixed(2));
}

export function fitDeclarationAttachment2DetailRows(sheet: ExcelJS.Worksheet, detailCount: number) {
  const targetDetailCount = Math.max(detailCount, 1);
  const templateDetailCount = DECLARATION_ATTACHMENT2_TEMPLATE_LAST_DETAIL_ROW - DECLARATION_ATTACHMENT2_START_ROW + 1;

  if (targetDetailCount > templateDetailCount) {
    const extraRows = targetDetailCount - templateDetailCount;
    sheet.duplicateRow(DECLARATION_ATTACHMENT2_TEMPLATE_LAST_DETAIL_ROW, extraRows, true);
    for (let rowNumber = DECLARATION_ATTACHMENT2_TEMPLATE_SUMMARY_ROW; rowNumber < DECLARATION_ATTACHMENT2_TEMPLATE_SUMMARY_ROW + extraRows; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      for (let column = DECLARATION_ATTACHMENT2_NOTE_START_COLUMN; column <= DECLARATION_ATTACHMENT2_NOTE_END_COLUMN; column += 1) {
        row.getCell(column).value = null;
      }
      row.commit();
    }
  }

  const summaryRow = DECLARATION_ATTACHMENT2_START_ROW + Math.max(targetDetailCount, templateDetailCount);
  for (let rowNumber = DECLARATION_ATTACHMENT2_START_ROW + detailCount; rowNumber < summaryRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    for (let column = 1; column <= DECLARATION_ATTACHMENT2_DETAIL_COLUMNS; column += 1) {
      row.getCell(column).value = null;
    }
    row.commit();
  }

  return summaryRow;
}

export async function exportDeclarationAttachment2(academicYearId: number): Promise<Buffer> {
  const academicYear = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
  if (!academicYear) throw new Error('学年不存在');

  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(TEMPLATE_DIR, declarationSummaryTemplate);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`附件2申报汇总模板不存在，请将模板放入 packages/backend/templates/${declarationSummaryTemplate}`);
  }
  await workbook.xlsx.readFile(templatePath);
  const sheet = workbook.getWorksheet('院级奖学金、院优干汇总表') || workbook.worksheets[0];
  if (sheet.columnCount > 24) {
    sheet.spliceColumns(25, sheet.columnCount - 24);
  }
  const batches = await prisma.declarationBatch.findMany({
    where: {
      academicYearId,
      status: 'approved',
      declarationType: { in: ['award', 'honor'] },
    },
    include: {
      class: { include: { grade: true, students: true } },
      students: {
        include: {
          student: {
            include: {
              scores: { where: { academicYearId } },
              declarationSupplements: { where: { academicYearId } },
            },
          },
        },
      },
      submittedByUser: { select: { displayName: true, username: true } },
    },
    orderBy: [{ class: { grade: { name: 'asc' } } }, { class: { name: 'asc' } }, { declarationType: 'asc' }],
  });

  const rows: Array<{
    batch: typeof batches[number];
    item: typeof batches[number]['students'][number];
    classSize: number;
    totalRanks: Record<number, number>;
    academicRanks: Record<number, number>;
  }> = [];

  const rankCache = new Map<number, {
    totalRanks: Record<number, number>;
    academicRanks: Record<number, number>;
    classSize: number;
  }>();

  // 一次 classId in (...) 查询取回全部涉及班级的学生与分数，再按班分组排名，
  // 替代原先批次循环内的逐班 findMany（PLAN_V2 §5.4）。
  const classIds = Array.from(new Set(batches.map((batch) => batch.classId)));
  type RankStudent = { id: number; classId: number; scores: Array<{ category: string; value: number }> };
  const studentsByClass = new Map<number, RankStudent[]>();
  if (classIds.length > 0) {
    const classStudents = await prisma.student.findMany({
      where: { classId: { in: classIds } },
      include: { scores: { where: { academicYearId } } },
    });
    for (const student of classStudents) {
      let list = studentsByClass.get(student.classId);
      if (!list) {
        list = [];
        studentsByClass.set(student.classId, list);
      }
      list.push(student);
    }
  }

  for (const batch of batches) {
    if (!rankCache.has(batch.classId)) {
      const students = studentsByClass.get(batch.classId) ?? [];
      rankCache.set(batch.classId, {
        classSize: students.length,
        totalRanks: rankByScoreDesc(students.map((student) => ({
          studentId: student.id,
          value: scoreValue(student.scores, 'total'),
        }))),
        academicRanks: rankByScoreDesc(students.map((student) => ({
          studentId: student.id,
          value: scoreValue(student.scores, 'academic'),
        }))),
      });
    }
    const ranks = rankCache.get(batch.classId)!;
    batch.students.forEach((item) => rows.push({ batch, item, ...ranks }));
  }

  const startRow = DECLARATION_ATTACHMENT2_START_ROW;
  const summaryRow = fitDeclarationAttachment2DetailRows(sheet, rows.length);
  if (rows.length === 0) {
    const row = sheet.getRow(startRow);
    for (let column = 1; column <= DECLARATION_ATTACHMENT2_DETAIL_COLUMNS; column += 1) {
      row.getCell(column).value = null;
    }
    row.commit();
  }

  let totalAwardAmount = 0;
  rows.forEach((entry, index) => {
    const row = sheet.getRow(startRow + index);
    const student = entry.item.student;
    const scores = student.scores;
    const supplement = student.declarationSupplements[0] || null;
    const material = JSON.parse(entry.item.materialJson || '{}') as Record<string, any>;
    const isAward = entry.batch.declarationType === 'award';
    const itemLevel = entry.item.itemLevel || material.finalLevel || material.recommendationLevel;
    const recommendationSource = material.recommendationSource || '';
    const amount = isAward ? awardAmount(entry.item.itemLevel, entry.item.amount) : 0;
    totalAwardAmount += amount;

    const awardName = isAward
      ? levelLabel(entry.item.itemLevel)
      : entry.item.itemType === 'excellent_cadre'
        ? `${levelLabel(itemLevel)}优秀学生干部`
        : `${levelLabel(itemLevel)}优秀学生`;

    row.getCell(1).value = index + 1;
    row.getCell(2).value = awardName;
    row.getCell(3).value = amount;
    row.getCell(4).value = student.name;
    row.getCell(5).value = supplement?.gender || material.gender || '';
    row.getCell(6).value = `${entry.batch.class.grade.name}${entry.batch.class.name}`;
    row.getCell(7).value = student.studentNo;
    row.getCell(8).value = scoreValue(scores, 'total');
    row.getCell(9).value = entry.totalRanks[student.id] || '';
    row.getCell(10).value = averageGpaFromAcademicScore(scores);
    row.getCell(11).value = entry.academicRanks[student.id] || '';
    row.getCell(12).value = entry.classSize;
    row.getCell(13).value = entry.classSize > 0
      ? `${(((entry.academicRanks[student.id] || entry.classSize) / entry.classSize) * 100).toFixed(1)}%`
      : '';
    row.getCell(14).value = scoreValue(scores, 'community');
    row.getCell(15).value = scoreValue(scores, 'physical_test');
    row.getCell(16).value = supplement?.disciplinaryAction || material.disciplinaryAction || '无';
    row.getCell(17).value = material.positionInfo || supplement?.positionInfo || '';
    row.getCell(18).value = material.competitionActivity || supplement?.competitionActivity || '';
    row.getCell(19).value = [
      recommendationSource,
      material.remark || supplement?.remark || '',
    ].filter(Boolean).join('；');
    row.commit();
  });

  sheet.getCell('A1').value = `附件2    计算机科学与技术学院院级奖学金、优秀学生干部、优秀学生汇总表（${academicYear.name}）`;
  sheet.getCell(`A${summaryRow}`).value = '';
  sheet.getCell(`B${summaryRow}`).value = '合计使用版基金院级奖学金总额';
  sheet.getCell(`C${summaryRow}`).value = {
    formula: `SUM(C${startRow}:C${summaryRow - 1})`,
    result: totalAwardAmount,
  };
  sheet.getCell(`D${summaryRow}`).value = '元';

  const firstBatch = batches[0];
  const footerRow = summaryRow + 1;
  if (firstBatch) {
    sheet.getCell(`A${footerRow}`).value = `班级：${firstBatch.class.grade.name}${firstBatch.class.name}                  班级人数: ${firstBatch.class.students.length}               填报人：${firstBatch.submittedByUser?.displayName || firstBatch.submittedByUser?.username || ''}                  班主任签字确认：               ${new Date().getFullYear()}年   月    日`;
  }

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true };
    });
  });

  return workbookToBuffer(workbook);
}

export async function exportSimpleReport(title: string, rows: Array<Record<string, unknown>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title);
  const keys = Array.from(rows.reduce<Set<string>>((acc, row) => {
    Object.keys(row).forEach((key) => acc.add(key));
    return acc;
  }, new Set<string>()));

  sheet.addRow(keys.length > 0 ? keys : ['说明']);
  if (rows.length === 0) {
    sheet.addRow(['暂无数据']);
  } else {
    rows.forEach((row) => {
      sheet.addRow(keys.map((key) => row[key] ?? ''));
    });
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 18;
  });

  return workbookToBuffer(workbook);
}
