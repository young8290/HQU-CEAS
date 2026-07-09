import prisma from '../config/database.js';
import ExcelJS from 'exceljs';
import * as scoreService from './scoreService.js';
import type { ClassScoreStudent } from './scoreService.js';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { COLLEGE_AWARD_AMOUNTS } from '../config/awardRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// templates/ 在后端包根目录: packages/backend/src/services/ -> 往上2级到 packages/backend
const TEMPLATE_DIR = path.resolve(__dirname, '..', '..', 'templates');

interface FailedRecord {
  row: number;
  studentNo: string;
  name: string;
  reason: string;
}

interface AccountExportRow {
  gradeName: string;
  className: string;
  username: string;
  password: string;
  displayName: string | null;
  status: string;
}

interface MonitorUserRecord {
  username: string;
  displayName: string | null;
  class: {
    name: string;
    grade: {
      name: string;
    };
  } | null;
}

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

function rankByScore(items: Array<{ studentId: number; value: number }>) {
  return [...items]
    .sort((a, b) => b.value - a.value)
    .reduce<Record<number, number>>((acc, item, index) => {
      acc[item.studentId] = index + 1;
      return acc;
    }, {});
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

export async function exportAttachment2(classId: number, academicYearId: number): Promise<Buffer> {
  const academicYear = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: { grade: true },
  });
  if (!cls || !academicYear) throw new Error('班级或学年不存在');

  const students: ClassScoreStudent[] = await scoreService.getScoresByClassForExport(classId, academicYearId);

  // Copy template file then fill data
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(TEMPLATE_DIR, '附件2_template.xlsx');
  if (fs.existsSync(templatePath)) {
    await workbook.xlsx.readFile(templatePath);
  } else {
    throw new Error('附件2模板文件不存在，请将模板放入 packages/backend/templates/附件2_template.xlsx');
  }

  const sheet = workbook.worksheets[0];

  // Fill Row 2: Update academic year in title (merged A2:L2)
  sheet.getCell('A2').value = `华侨大学学生综合素质测评成绩汇总表（${academicYear.name}）`;

  // Fill Row 3: 专业/年级/班级/学生总数 (merged A3:L3)
  const majorName = cls.name.replace(/\d+班$/, '').trim();
  sheet.getCell('A3').value = {
    richText: [
      { text: '学院(盖章）' },
      { text: '          ' },
      { text: '专业' },
      { text: ` ${majorName} ` },
      { text: '  年级' },
      { text: ` ${cls.grade.name} ` },
      { text: ' 班级' },
      { text: ` ${cls.name} ` },
      { text: ' 学生总数' },
      { text: ` ${students.length} ` },
      { text: ' 人' },
    ],
  };

  // 附件2列布局(无测评学年列):
  // A=班级排名, B=学号, C=姓名, D=德育测评(100), E=学业学术素质(60),
  // F=创新与实践能力(13), G=体育(7), H=美育(6), I=劳动教育(4),
  // J=公益服务与社会工作(10), K=附加分(5), L=总分
  // 数据从第6行开始(B6=第一个人的学号)
  const startRow = 6;
  students.forEach((student: ClassScoreStudent, index: number) => {
    const row = sheet.getRow(startRow + index);
    row.getCell(1).value = index + 1;                             // A: 班级排名
    row.getCell(2).value = String(student.studentNo);             // B: 学号(文本)
    row.getCell(3).value = student.name;                          // C: 姓名
    row.getCell(4).value = student.scores.moral?.value || 0;      // D: 德育测评
    row.getCell(5).value = student.scores.academic?.value || 0;   // E: 学业学术素质
    row.getCell(6).value = student.scores.innovation?.value || 0; // F: 创新与实践能力
    row.getCell(7).value = student.scores.sports_total?.value || 0; // G: 体育
    row.getCell(8).value = student.scores.aesthetics?.value || 0; // H: 美育
    row.getCell(9).value = student.scores.labor?.value || 0;      // I: 劳动教育
    row.getCell(10).value = student.scores.public_service?.value || 0; // J: 公益服务
    row.getCell(11).value = student.scores.bonus?.value || 0;     // K: 附加分
    row.getCell(12).value = student.scores.total?.value || 0;     // L: 总分
    row.commit();
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function exportAttachment4(classId: number, academicYearId: number): Promise<Buffer> {
  const academicYear = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: { grade: true },
  });
  if (!cls || !academicYear) throw new Error('班级或学年不存在');

  const students: ClassScoreStudent[] = await scoreService.getScoresByClass(classId, academicYearId);

  // Copy template file then fill data
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(TEMPLATE_DIR, '附件4_template.xlsx');
  if (fs.existsSync(templatePath)) {
    await workbook.xlsx.readFile(templatePath);
  } else {
    throw new Error('附件4模板文件不存在，请将模板放入 packages/backend/templates/附件4_template.xlsx');
  }

  const sheet = workbook.worksheets[0];

  // 附件4列布局(无总分列, 11列):
  // A=测评学年(文本), B=学号(文本), C=姓名(文本),
  // D=德育测评(数字,100), E=学业学术素质(数字,60), F=创新与实践能力(数字,13),
  // G=体育(数字,7), H=美育(数字,6), I=劳动教育(数字,4),
  // J=公益服务与社会工作(数字,10), K=附加分(数字,5)
  // 数据从A2开始(第一个人的测评学年)
  const startRow = 2;
  students.forEach((student: ClassScoreStudent, index: number) => {
    const row = sheet.getRow(startRow + index);
    // 文本格式列 (A, B, C)
    row.getCell(1).value = String(academicYear.name);             // A: 测评学年(文本)
    row.getCell(2).value = String(student.studentNo);             // B: 学号(文本)
    row.getCell(3).value = String(student.name);                  // C: 姓名(文本)
    // 数字格式列 (D-K)
    row.getCell(4).value = student.scores.moral?.value || 0;      // D: 德育测评(数字,100分)
    row.getCell(5).value = student.scores.academic?.value || 0;   // E: 学业学术素质(数字,60分)
    row.getCell(6).value = student.scores.innovation?.value || 0; // F: 创新与实践能力(数字,13分)
    row.getCell(7).value = student.scores.sports_total?.value || 0; // G: 体育(数字,7分)
    row.getCell(8).value = student.scores.aesthetics?.value || 0; // H: 美育(数字,6分)
    row.getCell(9).value = student.scores.labor?.value || 0;      // I: 劳动教育(数字,4分)
    row.getCell(10).value = student.scores.public_service?.value || 0; // J: 公益服务(数字,10分)
    row.getCell(11).value = student.scores.bonus?.value || 0;     // K: 附加分(数字,5分)
    row.commit();
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function exportAllAttachments(
  options: { gradeId?: number; classId?: number },
  academicYearId: number
): Promise<Buffer> {
  let classes: Array<{ id: number; name: string; grade: { name: string } }>;

  if (options.classId) {
    const cls = await prisma.class.findUnique({
      where: { id: options.classId },
      include: { grade: true },
    });
    classes = cls ? [cls] : [];
  } else if (options.gradeId) {
    classes = await prisma.class.findMany({
      where: { gradeId: options.gradeId },
      include: { grade: true },
      orderBy: { name: 'asc' },
    });
  } else {
    classes = await prisma.class.findMany({
      include: { grade: true },
      orderBy: [{ grade: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  // Create ZIP archive
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    (async () => {
      for (const cls of classes) {
        const folderName = `${cls.grade.name}_${cls.name}_综测表`;
        
        try {
          const att2 = await exportAttachment2(cls.id, academicYearId);
          archive.append(att2, { name: `${folderName}/${cls.grade.name}${cls.name}附件2.xlsx` });

          const att4 = await exportAttachment4(cls.id, academicYearId);
          archive.append(att4, { name: `${folderName}/${cls.grade.name}${cls.name}附件4.xlsx` });
        } catch (err) {
          console.error(`Export failed for ${cls.grade.name} ${cls.name}:`, err);
        }
      }
      archive.finalize();
    })();
  });
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

  for (const batch of batches) {
    if (!rankCache.has(batch.classId)) {
      const students = await prisma.student.findMany({
        where: { classId: batch.classId },
        include: { scores: { where: { academicYearId } } },
      });
      rankCache.set(batch.classId, {
        classSize: students.length,
        totalRanks: rankByScore(students.map((student) => ({
          studentId: student.id,
          value: scoreValue(student.scores, 'total'),
        }))),
        academicRanks: rankByScore(students.map((student) => ({
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

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function exportFailedRecords(failures?: FailedRecord[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('导入失败数据');

  sheet.columns = [
    { header: '所在行', key: 'row', width: 10 },
    { header: '学号', key: 'studentNo', width: 20 },
    { header: '姓名', key: 'name', width: 15 },
    { header: '失败原因', key: 'reason', width: 40 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  // If no failures provided, fetch from recent import logs
  if (!failures) {
    const recentLogs = await prisma.importLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    failures = [];
    for (const log of recentLogs) {
      if (log.failDetails) {
        try {
          const parsed = JSON.parse(log.failDetails as string);
          if (Array.isArray(parsed)) failures.push(...parsed);
        } catch {}
      }
    }
  }

  for (const f of failures) {
    sheet.addRow(f);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function exportAccountsList(accounts?: AccountExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('班长账号');

  sheet.columns = [
    { header: '年级', key: 'gradeName', width: 15 },
    { header: '班级', key: 'className', width: 25 },
    { header: '用户名', key: 'username', width: 30 },
    { header: '初始密码', key: 'password', width: 20 },
    { header: '显示名称', key: 'displayName', width: 25 },
    { header: '状态', key: 'status', width: 10 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  // If no accounts provided, fetch from DB (without passwords)
  const accountRows: AccountExportRow[] = accounts ?? [];

  if (accountRows.length === 0) {
    const users = await prisma.user.findMany({
      where: { role: 'monitor' },
      include: { class: { include: { grade: true } } },
      orderBy: { createdAt: 'desc' },
    }) as MonitorUserRecord[];
    accountRows.push(...users.map((u: MonitorUserRecord) => ({
      gradeName: u.class?.grade?.name || '-',
      className: u.class?.name || '-',
      username: u.username,
      password: '***',
      displayName: u.displayName,
      status: '已创建',
    })));
  }

  for (const account of accountRows) {
    sheet.addRow(account);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
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

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
