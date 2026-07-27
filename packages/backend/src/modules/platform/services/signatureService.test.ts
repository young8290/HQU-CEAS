import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../../core/db.js';
import { cacheService } from '../../../core/cache.js';
import { replaceMethod } from '../../../core/utils/testUtils.js';
import { assertSignatureUploadAllowed } from './signatureService.js';

test('assertSignatureUploadAllowed rejects review signatures when evaluation is closed', async () => {
  cacheService.clear('systemStatus');
  const restore = replaceMethod(prisma.systemSetting, 'findUnique', async () => ({
    id: 6301,
    key: 'system.entryStatus',
    valueJson: JSON.stringify({ comprehensiveEvalOpen: false, declarationOpen: true }),
  }));

  try {
    await assert.rejects(
      () => assertSignatureUploadAllowed('score_review_confirmation', 'reviewer'),
      /综测系统当前关闭/,
    );
  } finally {
    restore();
    cacheService.clear('systemStatus');
  }
});

test('assertSignatureUploadAllowed rejects declaration signatures when declaration is closed', async () => {
  cacheService.clear('systemStatus');
  const restore = replaceMethod(prisma.systemSetting, 'findUnique', async () => ({
    id: 6302,
    key: 'system.entryStatus',
    valueJson: JSON.stringify({ comprehensiveEvalOpen: true, declarationOpen: false }),
  }));

  try {
    await assert.rejects(
      () => assertSignatureUploadAllowed('monitor_agreement', 'monitor'),
      /申报系统当前关闭/,
    );
  } finally {
    restore();
    cacheService.clear('systemStatus');
  }
});

test('assertSignatureUploadAllowed rejects unsupported non-admin purposes and keeps admin uploads available', async () => {
  cacheService.clear('systemStatus');
  let settingQueries = 0;
  const restore = replaceMethod(prisma.systemSetting, 'findUnique', async () => {
    settingQueries += 1;
    return {
      id: 6303,
      key: 'system.entryStatus',
      valueJson: JSON.stringify({ comprehensiveEvalOpen: false, declarationOpen: false }),
    };
  });

  try {
    await assert.rejects(
      () => assertSignatureUploadAllowed('other_purpose', 'monitor'),
      /invalid_signature_purpose/,
    );
    await assert.doesNotReject(() => assertSignatureUploadAllowed('other_purpose', 'admin'));
    assert.equal(settingQueries, 0);
  } finally {
    restore();
    cacheService.clear('systemStatus');
  }
});
