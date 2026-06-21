import ExcelJS from 'exceljs';
import { SCORE_CATEGORIES, type ScoreCategory } from '../config/scoreRules.js';

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

const personalScoreColumns: Array<{ cell: string; category: ScoreCategory; key: string; width: number }> = [
  { cell: 'B3', category: 'moral', key: 'moral', width: 24 },
  { cell: 'C3', category: 'innovation', key: 'innovation', width: 32 },
  { cell: 'D3', category: 'sports_reward', key: 'sportsReward', width: 24 },
  { cell: 'E3', category: 'aesthetics', key: 'aesthetics', width: 20 },
  { cell: 'F3', category: 'labor', key: 'labor', width: 20 },
  { cell: 'G3', category: 'public_service', key: 'publicService', width: 36 },
  { cell: 'H3', category: 'bonus', key: 'bonus', width: 20 },
];

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
  const worksheet = workbook.addWorksheet(templateName(type));
  worksheet.addRow(headers);
  worksheet.columns = headers.map((header) => ({ header, key: header, width: 18 }));
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEE5' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  if (type === 'personal_forms') {
    worksheet.spliceRows(1, 1);
    worksheet.getCell('A1').value = '学号';
    worksheet.getCell('B1').value = '这里填学号';
    worksheet.getCell('C1').value = '姓名';
    worksheet.getCell('D1').value = '这里填姓名';
    worksheet.getCell('A2').value = '';
    personalScoreColumns.forEach(({ category }, index) => {
      const columnNumber = index + 2;
      const rule = SCORE_CATEGORIES[category];
      worksheet.getCell(2, columnNumber).value = `${rule.label}（满分${rule.maxValue}分）`;
    });
    worksheet.getCell('A3').value = '分数（只填数字）';
    worksheet.getCell('A4').value = '备注（填写加分具体说明）';
    worksheet.columns = [
      { key: 'label', width: 22 },
      ...personalScoreColumns.map((item) => ({ key: item.key, width: item.width })),
    ];
    worksheet.getRow(1).height = 28;
    worksheet.getRow(2).height = 48;
    worksheet.getRow(3).height = 28;
    worksheet.getRow(4).height = 58;
    [1, 2].forEach((rowNumber) => {
      const row = worksheet.getRow(rowNumber);
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEE5' } };
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    ['B1', 'D1'].forEach((cellAddress) => {
      const cell = worksheet.getCell(cellAddress);
      cell.font = { bold: true, color: { argb: 'FF9A3412' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    personalScoreColumns.forEach(({ cell: cellAddress, category }) => {
      const cell = worksheet.getCell(cellAddress);
      const rule = SCORE_CATEGORIES[category];
      const maxValue = rule.maxValue ?? 0;
      cell.numFmt = scoreNumberFormat(rule.step);
      cell.dataValidation = {
        type: 'custom',
        allowBlank: true,
        formulae: [scoreCheckFormula(cellAddress, maxValue, rule.step)],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: '分数填写不符合规范',
        error: `${rule.label}必须填写 0 到 ${maxValue} 之间的数字，最小单位为 ${rule.step}。`,
        showInputMessage: true,
        promptTitle: rule.label,
        prompt: `满分 ${maxValue} 分，最小单位 ${rule.step}。`,
      };
    });
    for (let row = 1; row <= 4; row += 1) {
      for (let column = 1; column <= 8; column += 1) {
        const cell = worksheet.getCell(row, column);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9D2C7' } },
          left: { style: 'thin', color: { argb: 'FFD9D2C7' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D2C7' } },
          right: { style: 'thin', color: { argb: 'FFD9D2C7' } },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: row === 4 && column > 1 ? 'left' : 'center',
          wrapText: true,
        };
      }
    }
    for (let column = 2; column <= 8; column += 1) {
      worksheet.getCell(3, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFCF5' } };
      worksheet.getCell(4, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFCF5' } };
    }
  }

  if (type === 'declaration_supplements') {
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
    const yesNoFormula = '"是,否"';
    const levelFormula = '"校级,院级"';
    const sourceFormula = '"班级推荐,学生会推荐"';
    const genderFormula = '"男,女"';

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

  return workbook.xlsx.writeBuffer();
}

function scoreNumberFormat(step: number) {
  if (step >= 1) return '0';
  if (step === 0.1 || step === 0.5) return '0.0';
  return '0.00';
}

function scoreCheckFormula(cellAddress: string, maxValue: number, step: number) {
  const stepCheck = step >= 1
    ? `MOD(${cellAddress},1)=0`
    : `ABS(${cellAddress}/${step}-ROUND(${cellAddress}/${step},0))<0.000001`;
  return `AND(ISNUMBER(${cellAddress}),${cellAddress}>=0,${cellAddress}<=${maxValue},${stepCheck})`;
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
