import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonitorAccountMailVariables } from './userService.js';

test('buildMonitorAccountMailVariables maps monitor account details to mail template variables', () => {
  const variables = buildMonitorAccountMailVariables({
    gradeName: '2023级',
    className: '1班',
    displayName: '2023级1班班长',
    username: 'monitor_2023_1',
    password: 'Abcd2345',
    systemLink: 'http://localhost:3000',
  });

  assert.deepEqual(variables, {
    班级: '2023级1班',
    班长姓名: '2023级1班班长',
    登录账号: 'monitor_2023_1',
    初始密码: 'Abcd2345',
    系统链接: 'http://localhost:3000',
  });
});
