import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createTemplateWorkbook, listTemplates } from './templateService.js';

test('listTemplates includes declaration supplements template for class-side import', async () => {
  const templates = await listTemplates();
  const supplementTemplate = templates.find((item) => item.type === 'declaration_supplements');
  const templateTypes = templates.map((item) => item.type);

  assert.ok(supplementTemplate);
  assert.equal(supplementTemplate.name, '申报补充信息模板');
  assert.ok(templateTypes.includes('personal_forms'));
  assert.ok(!templateTypes.includes('academic'));
  assert.ok(!templateTypes.includes('sports'));
  assert.deepEqual(supplementTemplate.headers, [
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
  ]);
});

test('createTemplateWorkbook applies declaration supplement dropdown limits', async () => {
  const buffer = await createTemplateWorkbook('declaration_supplements');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet('申报补充信息模板');

  assert.ok(sheet);
  assert.equal(sheet.getCell('A1').value, '学号');
  assert.equal(sheet.getCell('L1').value, '备注（境外生填写生源地）');
  assert.equal(sheet.getCell('F1').value, '优秀学生申报级别');
  assert.equal(sheet.getCell('I1').value, '优秀学生干部申报级别');
  assert.equal(sheet.getCell('C2').dataValidation?.formulae?.[0], '"男,女"');
  assert.equal(sheet.getCell('D2').dataValidation?.formulae?.[0], '"无,有"');
  assert.equal(sheet.getCell('E2').dataValidation?.formulae?.[0], '"是,否"');
  assert.equal(sheet.getCell('F2').dataValidation?.formulae?.[0], '"校级,院级"');
  assert.equal(sheet.getCell('H2').dataValidation?.formulae?.[0], '"班级推荐,学生会推荐"');
});

test('createTemplateWorkbook matches each supported import layout', async () => {
  const expectedHeaders: Record<string, string[]> = {
    external_awards: ['学号', '姓名', '奖项名称', '奖项等级'],
    award_quotas: ['年级', '班级', '名额', '可支配金额', '备注'],
    class_honors: ['年级', '班级', '荣誉类型'],
    monitor_emails: ['年级', '班级', '班长姓名', '邮箱'],
  };

  for (const [type, headers] of Object.entries(expectedHeaders)) {
    const buffer = await createTemplateWorkbook(type);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const actual = headers.map((_, index) => sheet.getCell(1, index + 1).value ?? '');
    assert.deepEqual(actual, headers);
  }
});

test('createTemplateWorkbook creates multi-sheet personal form detail workbook', async () => {
  const buffer = await createTemplateWorkbook('personal_forms');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const infoSheet = workbook.getWorksheet('学生信息');

  assert.ok(infoSheet);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    '学生信息',
    '德育测评',
    '创新与实践能力',
    '体育奖励分',
    '美育',
    '劳动教育',
    '公益服务与社会工作',
    '附加分',
  ]);
  assert.equal(infoSheet.getCell('A1').value, '个人综测填写表');
  assert.equal(infoSheet.getCell('B3').value, '这里填学号');
  assert.equal(infoSheet.getCell('D3').value, '这里填姓名');
  assert.equal(infoSheet.getCell('B3').font.color?.argb, 'FF9A3412');
  assert.equal(infoSheet.getCell('D3').font.color?.argb, 'FF9A3412');
  assert.equal(infoSheet.getCell('A7').value, '模块');
  assert.equal(infoSheet.getCell('A8').value, '德育测评');
  assert.equal(infoSheet.getCell('D14').value, '附加分');

  const moralSheet = workbook.getWorksheet('德育测评');
  const innovationSheet = workbook.getWorksheet('创新与实践能力');
  const sportsRewardSheet = workbook.getWorksheet('体育奖励分');
  const publicServiceSheet = workbook.getWorksheet('公益服务与社会工作');
  const bonusSheet = workbook.getWorksheet('附加分');

  assert.ok(moralSheet);
  assert.ok(innovationSheet);
  assert.ok(sportsRewardSheet);
  assert.ok(publicServiceSheet);
  assert.ok(bonusSheet);
  assert.equal(moralSheet.getCell('A1').value, '德育测评加分明细');
  assert.equal(moralSheet.getCell('A4').value, '加分事项');
  assert.equal(moralSheet.getCell('B4').value, '加分分数');
  assert.equal(moralSheet.getColumn(1).width, 58);
  assert.equal(moralSheet.getColumn(2).width, 18);
  assert.equal(moralSheet.getRow(2).height, 46);
  assert.equal(moralSheet.getCell('B5').numFmt, '0');
  assert.match(moralSheet.getCell('B5').dataValidation?.formulae?.[0] || '', /SUM\(\$B\$5:\$B\$19\)<=100/);
  assert.deepEqual(moralSheet.getCell('B20').value, { formula: 'SUM(B5:B19)' });
  assert.deepEqual(moralSheet.getCell('B21').value, { formula: 'IF(B20<=100,"通过","合计超过满分")' });
  assert.equal(innovationSheet.getCell('B5').numFmt, '0.0');
  assert.match(innovationSheet.getCell('B5').dataValidation?.formulae?.[0] || '', /B5<=13/);
  assert.equal(sportsRewardSheet.getCell('B5').numFmt, '0.00');
  assert.match(sportsRewardSheet.getCell('B5').dataValidation?.formulae?.[0] || '', /B5<=3/);
  assert.equal(publicServiceSheet.getCell('B5').numFmt, '0.0');
  assert.match(publicServiceSheet.getCell('B5').dataValidation?.formulae?.[0] || '', /B5<=10/);
  assert.equal(bonusSheet.getCell('B5').numFmt, '0.0');
  assert.match(bonusSheet.getCell('B5').dataValidation?.formulae?.[0] || '', /B5<=5/);
});
