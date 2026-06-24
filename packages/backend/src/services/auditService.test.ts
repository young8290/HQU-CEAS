import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../config/database.js';
import { recordAuditLog, listAuditLogs } from './auditService.js';

function replaceMethod(target: any, key: string, value: any) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const originalValue = target[key];
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });
  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Object.defineProperty(target, key, {
        configurable: true,
        writable: true,
        value: originalValue,
      });
    }
  };
}

test('recordAuditLog stores academic year and class scope', async () => {
  let created: any = null;
  const restore = replaceMethod(prisma.auditLog, 'create', async ({ data }: any) => {
    created = { id: 1, createdAt: new Date(), ...data };
    return created;
  });

  try {
    const log = await recordAuditLog({
      module: 'score_review',
      action: 'student_check_updated',
      academicYearId: 2025,
      classId: 12,
      actorId: 3,
      targetType: 'Student',
      targetId: 9,
    });

    assert.equal(log.academicYearId, 2025);
    assert.equal(log.classId, 12);
    assert.equal(created.academicYearId, 2025);
    assert.equal(created.classId, 12);
  } finally {
    restore();
  }
});

test('listAuditLogs applies academic year and class filters', async () => {
  let whereArg: any = null;
  const restores = [
    replaceMethod(prisma.auditLog, 'findMany', async ({ where }: any) => {
      whereArg = where;
      return [];
    }),
    replaceMethod(prisma.auditLog, 'count', async () => 0),
  ];

  try {
    await listAuditLogs({
      module: 'score_review',
      academicYearId: 2025,
      classId: 12,
    });

    assert.deepEqual(whereArg, {
      module: 'score_review',
      academicYearId: 2025,
      classId: 12,
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});
