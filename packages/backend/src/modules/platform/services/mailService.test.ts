import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRawMessage, buildRetryMailBody } from './mailService.js';

test('buildRawMessage encodes Chinese subject and body as UTF-8 MIME content', () => {
  const raw = buildRawMessage({
    smtpHost: 'smtp.163.com',
    smtpPort: 465,
    username: 'academic@example.com',
    password: 'secret',
    senderName: '计算机科学与技术学院学术部',
  }, {
    to: 'monitor@example.com',
    subject: '班长账号通知',
    text: '账号：monitor_2023\n密码：123456',
  });

  assert.match(raw, /Subject: =\?UTF-8\?B\?/);
  assert.match(raw, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(raw, /Content-Transfer-Encoding: base64/);
  assert.match(raw, /To: monitor@example.com/);
});

test('buildRetryMailBody renders the current template with stored variables', () => {
  const body = buildRetryMailBody('班级：{{班级}}\n账号：{{登录账号}}\n密码：{{初始密码}}', {
    班级: '2024级1班',
    登录账号: 'monitor_2024_1',
    初始密码: 'Abcd2345',
  });

  assert.equal(body, '班级：2024级1班\n账号：monitor_2024_1\n密码：Abcd2345');
});
