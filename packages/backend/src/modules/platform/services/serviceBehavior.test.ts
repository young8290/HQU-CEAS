import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../../core/db.js';
import { updateMailSettings, getActiveMailConfig } from './mailConfigService.js';
import { sendMonitorAccountMails } from './userService.js';
import { approveDeclaration } from '../../declaration/services/declarationReviewService.js';
import { assertSystemWriteOpen, getEntryStatus, updateEntryStatus, listSystemSettings } from './systemSettingService.js';
import { cacheService } from '../../../core/cache.js';
import { replaceMethod } from '../../../core/utils/testUtils.js';

test('updateMailSettings keeps previous authorization code when saved password is blank', async () => {
  let config: any = null;
  const restores = [
    replaceMethod(prisma.mailConfig, 'findFirst', async () => config),
    replaceMethod(prisma.mailConfig, 'create', async ({ data }: any) => {
      config = { id: 9101, updatedAt: new Date(), ...data };
      return config;
    }),
    replaceMethod(prisma.mailConfig, 'update', async ({ data }: any) => {
      config = { ...config, updatedAt: new Date(), ...data };
      return config;
    }),
    replaceMethod(prisma.auditLog, 'create', async ({ data }: any) => ({ id: 9901, ...data })),
  ];

  try {
    await updateMailSettings({
      smtpHost: 'smtp.163.com',
      smtpPort: 465,
      username: 'academic@example.com',
      password: 'first-secret',
      senderName: '学术部',
      enabled: true,
      actorId: 1,
    });
    await updateMailSettings({
      smtpHost: 'smtp.163.com',
      smtpPort: 465,
      username: 'academic@example.com',
      password: '',
      senderName: '学术部',
      enabled: true,
      actorId: 1,
    });

    const activeConfig = await getActiveMailConfig();
    assert.equal(activeConfig.password, 'first-secret');
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test('updateMailSettings rejects blank authorization code on first save', async () => {
  const restores = [
    replaceMethod(prisma.mailConfig, 'findFirst', async () => null),
  ];

  try {
    await assert.rejects(
      () => updateMailSettings({
        smtpHost: 'smtp.163.com',
        smtpPort: 465,
        username: 'academic@example.com',
        password: '',
        senderName: '学术部',
        enabled: true,
        actorId: 1,
      }),
      /授权码不能为空/,
    );
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test('sendMonitorAccountMails writes a failed mail log when monitor email is missing', async () => {
  const logs: any[] = [];
  const restores = [
    replaceMethod(prisma.user, 'findUnique', async () => ({
      id: 8201,
      username: 'monitor_2024_1',
      role: 'monitor',
      email: null,
    })),
    replaceMethod(prisma.mailLog, 'create', async ({ data }: any) => {
      const log = { id: 8301 + logs.length, createdAt: new Date(), ...data };
      logs.push(log);
      return log;
    }),
  ];

  try {
    const results = await sendMonitorAccountMails({
      accounts: [{
        gradeName: '2024级',
        className: '1班',
        username: 'monitor_2024_1',
        password: 'Abcd2345',
        displayName: '2024级1班班长',
      }],
      actorId: 1,
      systemLink: 'http://localhost:3000',
    });

    assert.equal(logs.length, 1);
    assert.equal(logs[0].templateType, 'monitor_account');
    assert.equal(logs[0].status, 'failed');
    assert.equal(logs[0].failureReason, '班长邮箱未配置');
    assert.equal(results[0].status, 'failed');
    assert.equal(results[0].mailLogId, logs[0].id);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test('getEntryStatus defaults allowAdminScoreEditing to false', async () => {
  cacheService.clear('systemStatus');
  const restores = [
    replaceMethod(prisma.systemSetting, 'findUnique', async () => null),
  ];

  try {
    const status = await getEntryStatus();

    assert.equal(status.allowAdminScoreEditing, false);
    assert.equal(status.comprehensiveEvalOpen, true);
    assert.equal(status.declarationOpen, true);
  } finally {
    restores.reverse().forEach((restore) => restore());
    cacheService.clear('systemStatus');
  }
});

test('getEntryStatus fills allowAdminScoreEditing=false for legacy stored settings', async () => {
  cacheService.clear('systemStatus');
  const restores = [
    replaceMethod(prisma.systemSetting, 'findUnique', async () => ({
      id: 6101,
      key: 'system.entryStatus',
      valueJson: JSON.stringify({
        comprehensiveEvalOpen: false,
        declarationOpen: true,
        declarationCloseReason: '窗口期已结束',
      }),
    })),
  ];

  try {
    const status = await getEntryStatus();

    assert.equal(status.allowAdminScoreEditing, false);
    assert.equal(status.comprehensiveEvalOpen, false);
    assert.equal(status.declarationCloseReason, '窗口期已结束');
  } finally {
    restores.reverse().forEach((restore) => restore());
    cacheService.clear('systemStatus');
  }
});

test('assertSystemWriteOpen lets admins manage a closed evaluation system', async () => {
  cacheService.clear('systemStatus');
  let settingQueried = false;
  const restore = replaceMethod(prisma.systemSetting, 'findUnique', async () => {
    settingQueried = true;
    return {
      id: 6102,
      key: 'system.entryStatus',
      valueJson: JSON.stringify({ comprehensiveEvalOpen: false, declarationOpen: false }),
    };
  });

  try {
    await assert.doesNotReject(() => assertSystemWriteOpen('evaluation', 'admin'));
    assert.equal(settingQueried, false);
  } finally {
    restore();
    cacheService.clear('systemStatus');
  }
});

test('assertSystemWriteOpen rejects non-admin writes for the closed system scope', async () => {
  cacheService.clear('systemStatus');
  const restore = replaceMethod(prisma.systemSetting, 'findUnique', async () => ({
    id: 6103,
    key: 'system.entryStatus',
    valueJson: JSON.stringify({ comprehensiveEvalOpen: false, declarationOpen: false }),
  }));

  try {
    await assert.rejects(
      () => assertSystemWriteOpen('evaluation', 'monitor'),
      /综测系统当前关闭/,
    );
    cacheService.clear('systemStatus');
    await assert.rejects(
      () => assertSystemWriteOpen('declaration', 'monitor'),
      /申报系统当前关闭/,
    );
  } finally {
    restore();
    cacheService.clear('systemStatus');
  }
});

test('updateEntryStatus persists allowAdminScoreEditing and keeps other fields', async () => {
  cacheService.clear('systemStatus');
  let stored: any = null;
  const restores = [
    replaceMethod(prisma.systemSetting, 'findUnique', async () => stored),
    replaceMethod(prisma.systemSetting, 'upsert', async ({ update, create }: any) => {
      stored = stored
        ? { ...stored, ...update }
        : { id: 6102, ...create };
      return stored;
    }),
    replaceMethod(prisma.auditLog, 'create', async ({ data }: any) => ({ id: 9903, ...data })),
  ];

  try {
    const updated = await updateEntryStatus({ allowAdminScoreEditing: true }, 1);

    assert.equal(updated.allowAdminScoreEditing, true);
    assert.equal(updated.comprehensiveEvalOpen, true);
    assert.equal(updated.declarationOpen, true);
    assert.equal(JSON.parse(stored.valueJson).allowAdminScoreEditing, true);

    const reloaded = await getEntryStatus();
    assert.equal(reloaded.allowAdminScoreEditing, true);

    const settings = await listSystemSettings();
    assert.equal(settings.entryStatus.allowAdminScoreEditing, true);

    const closedAgain = await updateEntryStatus({ allowAdminScoreEditing: false }, 1);
    assert.equal(closedAgain.allowAdminScoreEditing, false);
    assert.equal(JSON.parse(stored.valueJson).allowAdminScoreEditing, false);
  } finally {
    restores.reverse().forEach((restore) => restore());
    cacheService.clear('systemStatus');
  }
});

test('approveDeclaration replaces declaration approval tags for the same batch', async () => {
  const tags: any[] = [];
  const batch = {
    id: 7101,
    academicYearId: 2025,
    classId: 6201,
    declarationType: 'award',
    students: [
      { studentId: 5101 },
      { studentId: 5102 },
    ],
  };
  const restores = [
    replaceMethod(prisma, '$transaction', async (handler: any) => handler(prisma)),
    replaceMethod(prisma.declarationBatch, 'update', async () => batch),
    replaceMethod(prisma.tag, 'deleteMany', async ({ where }: any) => {
      const before = tags.length;
      for (let index = tags.length - 1; index >= 0; index -= 1) {
        const tag = tags[index];
        if (
          tag.tagType === where.tagType
          && tag.sourceType === where.sourceType
          && tag.sourceId === where.sourceId
        ) {
          tags.splice(index, 1);
        }
      }
      return { count: before - tags.length };
    }),
    replaceMethod(prisma.tag, 'create', async ({ data }: any) => {
      const tag = { id: 7201 + tags.length, ...data };
      tags.push(tag);
      return tag;
    }),
    replaceMethod(prisma.auditLog, 'create', async ({ data }: any) => ({ id: 9902, ...data })),
  ];

  try {
    await approveDeclaration(batch.id, '通过', 1);
    await approveDeclaration(batch.id, '再次通过', 1);

    assert.equal(tags.length, 2);
    assert.deepEqual(tags.map((tag) => tag.studentId), [5101, 5102]);
    assert.ok(tags.every((tag) => tag.sourceId === batch.id));
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});
