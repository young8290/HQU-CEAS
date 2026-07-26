import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMailTemplate, validateTemplateVariables } from './mailTemplateService.js';

test('renderMailTemplate replaces Chinese brace variables', () => {
  const rendered = renderMailTemplate('班级：{{班级}}，账号：{{登录账号}}', {
    班级: '2023级1班',
    登录账号: 'monitor_2023_1',
  });

  assert.equal(rendered, '班级：2023级1班，账号：monitor_2023_1');
});

test('validateTemplateVariables reports variables that are not allowed', () => {
  const result = validateTemplateVariables('账号：{{登录账号}}，未知：{{缺失变量}}', ['登录账号']);

  assert.equal(result.valid, false);
  assert.deepEqual(result.unknownVariables, ['缺失变量']);
});
