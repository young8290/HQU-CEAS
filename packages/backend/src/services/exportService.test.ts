import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { fitDeclarationAttachment2DetailRows } from './exportService.js';

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
