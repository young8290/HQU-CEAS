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
    personal_forms: ['学号', '这里填学号', '姓名', '这里填姓名', null, null, null, null].map((item) => item ?? ''),
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

test('createTemplateWorkbook applies personal form score formats and validation rules', async () => {
  const buffer = await createTemplateWorkbook('personal_forms');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet('个人综测填写表模板');

  assert.ok(sheet);
  assert.equal(sheet.getCell('B1').value, '这里填学号');
  assert.equal(sheet.getCell('D1').value, '这里填姓名');
  assert.equal(sheet.getCell('B1').fill.type, 'pattern');
  assert.equal((sheet.getCell('B1').font.color as any)?.argb, 'FF9A3412');
  assert.equal(sheet.getCell('B2').value, '德育测评（满分100分）');
  assert.equal(sheet.getCell('C2').value, '创新与实践能力（满分13分）');
  assert.equal(sheet.getCell('D2').value, '体育奖励分（满分3分）');
  assert.equal(sheet.getCell('E2').value, '美育（满分6分）');
  assert.equal(sheet.getCell('F2').value, '劳动教育（满分4分）');
  assert.equal(sheet.getCell('G2').value, '公益服务与社会工作（满分10分）');
  assert.equal(sheet.getCell('H2').value, '附加分（满分5分）');
  assert.equal(sheet.getCell('A4').value, '备注（填写加分具体说明）');
  assert.equal(sheet.getColumn(1).width, 22);
  assert.equal(sheet.getColumn(3).width, 32);
  assert.equal(sheet.getColumn(7).width, 36);
  assert.equal(sheet.getRow(1).height, 28);
  assert.equal(sheet.getRow(2).height, 48);
  assert.equal(sheet.getRow(4).height, 58);
  assert.equal(sheet.getCell('G2').alignment?.wrapText, true);
  assert.equal(sheet.getCell('G4').alignment?.horizontal, 'left');
  assert.equal(sheet.getCell('B3').numFmt, '0');
  assert.equal(sheet.getCell('C3').numFmt, '0.0');
  assert.equal(sheet.getCell('D3').numFmt, '0.00');
  assert.equal(sheet.getCell('E3').numFmt, '0.00');
  assert.equal(sheet.getCell('F3').numFmt, '0');
  assert.equal(sheet.getCell('G3').numFmt, '0.0');
  assert.equal(sheet.getCell('H3').numFmt, '0.0');
  assert.match(sheet.getCell('B3').dataValidation?.formulae?.[0] || '', /B3<=100/);
  assert.match(sheet.getCell('C3').dataValidation?.formulae?.[0] || '', /C3<=13/);
  assert.match(sheet.getCell('H3').dataValidation?.formulae?.[0] || '', /H3<=5/);
});
