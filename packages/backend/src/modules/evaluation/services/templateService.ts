import ExcelJS from 'exceljs';
import { PERSONAL_FORM_DETAIL_CATEGORIES, SCORE_CATEGORIES, type ScoreCategory } from '../rules/scoreRules.js';

const templateDefinitions: Record<string, string[]> = {
  external_awards: ['学号', '姓名', '奖项名称', '奖项等级'],
  award_quotas: ['年级', '班级', '名额', '可支配金额', '备注'],
  class_honors: ['年级', '班级', '荣誉类型'],
  declaration_supplements: [
    '学号',
    '姓名',
    '性别',
    '处分情况',
    '是否申报优秀学生',
    '优秀学生申报级别',
    '是否申报优秀学生干部',
    '优秀学生干部推荐来源',
    '优秀学生干部申报级别',
    '任职情况（仅限24-25学年）',
    '科技作品竞赛活动情况',
    '备注（境外生填写生源地）',
  ],
  monitor_emails: ['年级', '班级', '班长姓名', '邮箱'],
  personal_forms: ['学号', '这里填学号', '姓名', '这里填姓名'],
};

const personalDetailSheets: Array<{ category: ScoreCategory; sheetName: string; description: string }> = [
  { category: 'moral', sheetName: '德育测评', description: '填写德育测评减分事项，例如违纪违规、缺勤迟到、宿舍卫生扣分等；最终得分 = 100 − 扣分合计。' },
  { category: 'innovation', sheetName: '创新与实践能力', description: '填写创新实践加分事项，例如科研训练、竞赛、项目、论文、专利等。' },
  { category: 'sports_reward', sheetName: '体育奖励分', description: '填写体育奖励加分事项，例如运动会、体育竞赛、体育活动获奖等。' },
  { category: 'aesthetics', sheetName: '美育', description: '填写美育加分事项，例如文艺活动、艺术作品、展演比赛等。' },
  { category: 'labor', sheetName: '劳动教育', description: '填写劳动教育加分事项，例如劳动实践、志愿劳动、宿舍劳动等。' },
  { category: 'public_service', sheetName: '公益服务与社会工作', description: '填写公益服务与社会工作加分事项，例如志愿服务、社会工作、班团工作等。' },
  { category: 'bonus', sheetName: '附加分', description: '填写附加分事项，需符合学院综测附加分认定要求。' },
];

const detailStartRow = 5;
const detailRowCount = 15;
const detailEndRow = detailStartRow + detailRowCount - 1;
const detailTotalRow = detailEndRow + 1;
const detailCheckRow = detailEndRow + 2;

function border() {
  return {
    top: { style: 'thin', color: { argb: 'FFD9D2C7' } },
    left: { style: 'thin', color: { argb: 'FFD9D2C7' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D2C7' } },
    right: { style: 'thin', color: { argb: 'FFD9D2C7' } },
  };
}

function scoreNumberFormat(step: number) {
  if (step >= 1) return '0';
  if (step === 0.1 || step === 0.5) return '0.0';
  return '0.00';
}

function scoreCheckFormula(cellAddress: string, maxValue: number, step: number, sumRange?: string) {
  const stepCheck = step >= 1
    ? `MOD(${cellAddress},1)=0`
    : `ABS(${cellAddress}/${step}-ROUND(${cellAddress}/${step},0))<0.000001`;
  const sumCheck = sumRange ? `,SUM(${sumRange})<=${maxValue}` : '';
  return `OR(${cellAddress}="",AND(ISNUMBER(${cellAddress}),${cellAddress}>=0,${cellAddress}<=${maxValue},${stepCheck}${sumCheck}))`;
}

export async function listTemplates() {
  return Object.entries(templateDefinitions).map(([type, headers]) => ({
    type,
    name: templateName(type),
    headers,
  }));
}

export async function createTemplateWorkbook(type: string) {
  const headers = templateDefinitions[type];
  if (!headers) throw new Error('模板类型不存在');

  const workbook = new ExcelJS.Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  const worksheet = workbook.addWorksheet(templateName(type));
  worksheet.addRow(headers);
  worksheet.columns = headers.map((header) => ({ header, key: header, width: 18 }));
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEE5' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  if (type === 'personal_forms') {
    buildPersonalWorkbook(workbook, worksheet);
  }

  if (type === 'declaration_supplements') {
    buildDeclarationSupplementWorkbook(worksheet);
  }

  return workbook.xlsx.writeBuffer();
}

function buildDeclarationSupplementWorkbook(worksheet: ExcelJS.Worksheet) {
  worksheet.columns = [
    { header: '学号', key: 'studentNo', width: 18 },
    { header: '姓名', key: 'name', width: 12 },
    { header: '性别', key: 'gender', width: 10 },
    { header: '处分情况', key: 'disciplinaryAction', width: 16 },
    { header: '是否申报优秀学生', key: 'excellentStudentIntent', width: 18 },
    { header: '优秀学生申报级别', key: 'excellentStudentRecommendationLevel', width: 22 },
    { header: '是否申报优秀学生干部', key: 'excellentCadreIntent', width: 22 },
    { header: '优秀学生干部推荐来源', key: 'excellentCadreRecommendationSource', width: 22 },
    { header: '优秀学生干部申报级别', key: 'excellentCadreRecommendationLevel', width: 26 },
    { header: '任职情况（仅限24-25学年）', key: 'positionInfo', width: 32 },
    { header: '科技作品竞赛活动情况', key: 'competitionActivity', width: 36 },
    { header: '备注（境外生填写生源地）', key: 'remark', width: 26 },
  ];

  const genderFormula = '"男,女"';
  const yesNoFormula = '"是,否"';
  const levelFormula = '"校级,院级"';
  const sourceFormula = '"班级推荐,学生会推荐"';

  for (let row = 2; row <= 301; row += 1) {
    worksheet.getCell(`C${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: [genderFormula] };
    worksheet.getCell(`D${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"无,有"'] };
    worksheet.getCell(`E${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: [yesNoFormula] };
    worksheet.getCell(`F${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: [levelFormula] };
    worksheet.getCell(`G${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: [yesNoFormula] };
    worksheet.getCell(`H${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: [sourceFormula] };
    worksheet.getCell(`I${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: [levelFormula] };
  }

  worksheet.addRow([
    '2225121000',
    '张三',
    '男',
    '无',
    '是',
    '院级',
    '是',
    '班级推荐',
    '院级',
    '2024-2025学年担任班长，任期满一年，考核良好及以上。',
    '2025年5月，华侨大学电脑大赛校级二等奖。',
    '',
  ]);
}

function buildPersonalWorkbook(workbook: ExcelJS.Workbook, infoSheet: ExcelJS.Worksheet) {
  infoSheet.name = '学生信息';
  infoSheet.spliceRows(1, 1);
  infoSheet.columns = [
    { key: 'a', width: 18 },
    { key: 'b', width: 26 },
    { key: 'c', width: 18 },
    { key: 'd', width: 26 },
  ];

  infoSheet.mergeCells('A1:D1');
  infoSheet.getCell('A1').value = '个人综测填写表';
  infoSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF3F3328' } };
  infoSheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  infoSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEE5' } };
  infoSheet.getRow(1).height = 34;

  infoSheet.getCell('A3').value = '学号';
  infoSheet.getCell('B3').value = '这里填学号';
  infoSheet.getCell('C3').value = '姓名';
  infoSheet.getCell('D3').value = '这里填姓名';
  infoSheet.getRow(3).height = 28;
  infoSheet.getCell('B3').font = { bold: true, color: { argb: 'FF9A3412' } };
  infoSheet.getCell('D3').font = { bold: true, color: { argb: 'FF9A3412' } };
  infoSheet.getCell('B3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  infoSheet.getCell('D3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

  infoSheet.mergeCells('A5:D5');
  infoSheet.getCell('A5').value = '先在本页填写学号和姓名，再分别进入各模块工作表。每个模块只填写一条加分事项和对应分数，合计分数由工作表公式自动计算。';
  infoSheet.getCell('A5').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  infoSheet.getRow(5).height = 46;

  infoSheet.getCell('A7').value = '模块';
  infoSheet.getCell('B7').value = '满分';
  infoSheet.getCell('C7').value = '最小单位';
  infoSheet.getCell('D7').value = '填写位置';
  for (let column = 1; column <= 4; column += 1) {
    infoSheet.getCell(7, column).font = { bold: true };
    infoSheet.getCell(7, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEE5' } };
  }

  personalDetailSheets.forEach((item, index) => {
    const rowNumber = index + 8;
    const rule = SCORE_CATEGORIES[item.category];
    infoSheet.getCell(rowNumber, 1).value = rule.label;
    infoSheet.getCell(rowNumber, 2).value = rule.maxValue;
    infoSheet.getCell(rowNumber, 3).value = rule.step;
    infoSheet.getCell(rowNumber, 4).value = item.sheetName;
  });

  for (let row = 1; row <= 14; row += 1) {
    for (let column = 1; column <= 4; column += 1) {
      const cell = infoSheet.getCell(row, column);
      cell.border = border() as any;
      cell.alignment = { vertical: 'middle', horizontal: row === 5 ? 'left' : 'center', wrapText: true };
    }
  }

  personalDetailSheets.forEach((item) => buildPersonalDetailSheet(workbook.addWorksheet(item.sheetName), item));
}

function buildPersonalDetailSheet(worksheet: ExcelJS.Worksheet, item: { category: ScoreCategory; sheetName: string; description: string }) {
  const rule = SCORE_CATEGORIES[item.category];
  const maxValue = rule.maxValue ?? 0;
  const numFmt = scoreNumberFormat(rule.step);
  // 德育测评为减分口径：明细为扣分事项，最终得分 = 100 − 扣分合计；其余模块仍为加分口径。
  const isMoral = item.category === 'moral';
  const noun = isMoral ? '减分' : '加分';
  const finalScoreRow = isMoral ? detailCheckRow : null;
  const checkRow = isMoral ? detailCheckRow + 1 : detailCheckRow;

  worksheet.columns = [
    { key: 'itemName', width: 58 },
    { key: 'itemScore', width: 18 },
  ];

  worksheet.mergeCells('A1:B1');
  worksheet.getCell('A1').value = `${rule.label}${noun}明细`;
  worksheet.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF3F3328' } };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEE5' } };
  worksheet.getRow(1).height = 32;

  worksheet.mergeCells('A2:B2');
  worksheet.getCell('A2').value = `满分 ${maxValue} 分；最小单位 ${rule.step} 分。${item.description}`;
  worksheet.getCell('A2').font = { color: { argb: 'FF6B5A49' } };
  worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFCF5' } };
  worksheet.getRow(2).height = 46;

  worksheet.getCell('A4').value = `${noun}事项`;
  worksheet.getCell('B4').value = `${noun}分数`;
  worksheet.getRow(4).height = 28;
  for (let column = 1; column <= 2; column += 1) {
    worksheet.getCell(4, column).font = { bold: true };
    worksheet.getCell(4, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEE5' } };
  }

  const scoreRange = `$B$${detailStartRow}:$B$${detailEndRow}`;
  for (let row = detailStartRow; row <= detailEndRow; row += 1) {
    worksheet.getRow(row).height = 24;
    worksheet.getCell(row, 1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    worksheet.getCell(row, 2).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    worksheet.getCell(row, 1).dataValidation = {
      type: 'textLength',
      operator: 'lessThanOrEqual',
      allowBlank: true,
      formulae: [100],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: `${noun}事项过长`,
      error: `${noun}事项请控制在 100 字以内。`,
    };
    worksheet.getCell(row, 2).numFmt = numFmt;
    worksheet.getCell(row, 2).dataValidation = {
      type: 'custom',
      allowBlank: true,
      formulae: [scoreCheckFormula(`B${row}`, maxValue, rule.step, scoreRange)],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: `${noun}分数不符合规范`,
      error: isMoral
        ? `${rule.label}减分分数必须为 0 到 ${maxValue} 之间的数字，最小单位为 ${rule.step}，扣分合计不能超过 ${maxValue}。`
        : `${rule.label}加分分数必须为 0 到 ${maxValue} 之间的数字，最小单位为 ${rule.step}，合计不能超过满分。`,
      showInputMessage: true,
      promptTitle: rule.label,
      prompt: isMoral
        ? `请填写单项减分分数，扣分合计不能超过 ${maxValue} 分。`
        : `请填写单项加分分数，合计不能超过 ${maxValue} 分。`,
    };
  }

  worksheet.getCell(`A${detailTotalRow}`).value = isMoral ? '扣分合计' : '模块合计';
  worksheet.getCell(`B${detailTotalRow}`).value = { formula: `SUM(B${detailStartRow}:B${detailEndRow})` };
  worksheet.getCell(`B${detailTotalRow}`).numFmt = numFmt;
  if (finalScoreRow) {
    worksheet.getCell(`A${finalScoreRow}`).value = '德育测评最终得分';
    worksheet.getCell(`B${finalScoreRow}`).value = { formula: `100-SUM(B${detailStartRow}:B${detailEndRow})` };
    worksheet.getCell(`B${finalScoreRow}`).numFmt = numFmt;
  }
  worksheet.getCell(`A${checkRow}`).value = '检查结果';
  worksheet.getCell(`B${checkRow}`).value = isMoral
    ? { formula: `IF(B${detailTotalRow}<=${maxValue},"通过","扣分合计超过100")` }
    : { formula: `IF(B${detailTotalRow}<=${maxValue},"通过","合计超过满分")` };
  worksheet.getCell(`B${checkRow}`).alignment = { vertical: 'middle', horizontal: 'center' };

  [detailTotalRow, ...(finalScoreRow ? [finalScoreRow] : []), checkRow].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.height = 28;
    for (let column = 1; column <= 2; column += 1) {
      const cell = row.getCell(column);
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    }
  });

  for (let row = 1; row <= checkRow; row += 1) {
    for (let column = 1; column <= 2; column += 1) {
      const cell = worksheet.getCell(row, column);
      cell.border = border() as any;
      if (!cell.alignment) {
        cell.alignment = { vertical: 'middle', horizontal: column === 1 ? 'left' : 'center', wrapText: true };
      }
    }
  }

  for (let row = detailStartRow; row <= detailEndRow; row += 1) {
    worksheet.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    worksheet.getCell(row, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFCF5' } };
  }

  worksheet.views = [{ state: 'frozen', ySplit: 4 }];
}

function templateName(type: string) {
  const names: Record<string, string> = {
    external_awards: '外部奖项名单模板',
    award_quotas: '院奖名额金额模板',
    class_honors: '先进班级和团支部模板',
    declaration_supplements: '申报补充信息模板',
    monitor_emails: '班长邮箱模板',
    personal_forms: '个人综测填写表模板',
  };
  return names[type] || type;
}
