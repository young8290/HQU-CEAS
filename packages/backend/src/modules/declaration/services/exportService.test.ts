import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { fitDeclarationAttachment2DetailRows } from './exportService.js';
import exportRouter from '../routes/export.js';

function buildAttachment2LikeSheet() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('院级奖学金、院优干汇总表');
  for (let row = 4; row <= 11; row += 1) {
    sheet.getCell(`A${row}`).value = row - 3;
    sheet.getCell(`B${row}`).value = `明细${row}`;
    sheet.getCell(`T${row}`).value = `说明${row}`;
  }
  sheet.getCell('B12').value = '合计使用版基金院级奖学金总额';
  sheet.getCell('A13').value = '班级：';
  sheet.getCell('A14').value = '备注：1、请勿更改此表格式，按照示例格式填写；2、各项要求仅供参考，以文件为准。';
  return sheet;
}

test('fitDeclarationAttachment2DetailRows keeps summary footer and remarks when details are fewer than template rows', () => {
  const sheet = buildAttachment2LikeSheet();

  const summaryRow = fitDeclarationAttachment2DetailRows(sheet, 2);

  assert.equal(summaryRow, 12);
  assert.equal(sheet.getCell('B12').value, '合计使用版基金院级奖学金总额');
  assert.equal(sheet.getCell('A13').value, '班级：');
  assert.equal(sheet.getCell('A14').value, '备注：1、请勿更改此表格式，按照示例格式填写；2、各项要求仅供参考，以文件为准。');
  assert.equal(sheet.getCell('A6').value, null);
  assert.equal(sheet.getCell('T6').value, '说明6');
});

test('fitDeclarationAttachment2DetailRows inserts extra detail rows before summary and clears duplicated right-side notes', () => {
  const sheet = buildAttachment2LikeSheet();

  const summaryRow = fitDeclarationAttachment2DetailRows(sheet, 10);

  assert.equal(summaryRow, 14);
  assert.equal(sheet.getCell('B14').value, '合计使用版基金院级奖学金总额');
  assert.equal(sheet.getCell('A15').value, '班级：');
  assert.equal(sheet.getCell('A16').value, '备注：1、请勿更改此表格式，按照示例格式填写；2、各项要求仅供参考，以文件为准。');
  assert.equal(sheet.getCell('T12').value, null);
  assert.equal(sheet.getCell('T13').value, null);
});

test('签字名单端点 /export/signature-name-list 已注册（adminOnly）并复用附件2汇总模板产出非空 xlsx Buffer', async () => {
  // 1) 薄别名端点已注册在导出路由上，且与 /declaration-attachment2 一样仅管理员可用
  const stack = (exportRouter as any).stack as Array<any>;
  const layer = stack.find((item) => item.route?.path === '/signature-name-list');
  assert.ok(layer, '路由 GET /export/signature-name-list 应已注册');
  assert.equal(layer.route.methods.get, true);
  assert.ok(
    layer.route.stack.some((handler: any) => handler.name === 'adminOnly'),
    '签字名单导出应为 adminOnly',
  );
  assert.ok(
    stack.some((item) => item.route?.path === '/declaration-attachment2'),
    '被复用的 /declaration-attachment2 端点应仍存在',
  );

  // 2) 端点复用的附件2汇总模板可读、含目标工作表，产出的 xlsx Buffer 非空且为有效 zip(xlsx)
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(testDir, '..', '..', '..', '..', 'templates', '附件2_院奖荣誉汇总_template.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const sheet = workbook.getWorksheet('院级奖学金、院优干汇总表');
  assert.ok(sheet, '模板应包含工作表「院级奖学金、院优干汇总表」');
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  assert.ok(buffer.length > 0, '复用模板写出的 Buffer 应非空');
  assert.equal(buffer.subarray(0, 2).toString('utf8'), 'PK', '产出应为有效 xlsx (zip) 文件');
});
