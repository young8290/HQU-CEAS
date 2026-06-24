import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import prisma from '../config/database.js';
import { loginByInvite, updateStudentCheck } from './scoreReviewInviteService.js';

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

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function activeInvite() {
  return {
    id: 31,
    recordId: 41,
    memberId: 51,
    reviewerUserId: 61,
    tokenHash: sha256('invite-token'),
    deviceIdHash: null,
    deviceBoundAt: null,
    status: 'active',
    expiresAt: new Date(Date.now() + 86400_000),
    lastLoginAt: null,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    member: { id: 51, name: '评审成员', roleName: '学习委员' },
    reviewerUser: {
      id: 61,
      username: 'reviewer_12_51',
      role: 'reviewer',
      classId: 12,
      displayName: '评审成员',
    },
    record: {
      id: 41,
      academicYearId: 2025,
      classId: 12,
      class: { id: 12, name: '1班', gradeId: 2, grade: { id: 2, name: '2024级' } },
      members: [{ id: 51 }, { id: 52 }],
    },
  };
}

test('loginByInvite rejects a token opened from another device', async () => {
  const invite = {
    ...activeInvite(),
    deviceIdHash: sha256('bound-device'),
  };
  const restores = [
    replaceMethod(prisma.scoreReviewMemberInvite, 'findUnique', async () => invite),
    replaceMethod(prisma.auditLog, 'create', async ({ data }: any) => ({ id: 90, createdAt: new Date(), ...data })),
  ];

  try {
    await assert.rejects(
      () => loginByInvite({ token: 'invite-token', deviceId: 'other-device' }),
      /device_mismatch/,
    );
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test('updateStudentCheck writes reviewer check and scoped audit log', async () => {
  let auditData: any = null;
  let upsertData: any = null;
  const invite = activeInvite();
  const restores = [
    replaceMethod(prisma.scoreReviewMemberInvite, 'findFirst', async () => ({
      ...invite,
      member: { ...invite.member, signatureFile: null },
      record: {
        ...invite.record,
        members: [{ id: 51 }, { id: 52 }],
      },
    })),
    replaceMethod(prisma.student, 'findUnique', async () => ({ id: 101, classId: 12 })),
    replaceMethod(prisma.scoreReviewStudentCheck, 'upsert', async ({ data, create, update }: any) => {
      upsertData = { data, create, update };
      return { id: 201, ...create, ...update, updatedAt: new Date() };
    }),
    replaceMethod(prisma.scoreReviewStudentCheck, 'findMany', async () => [
      { studentId: 101, memberId: 51, status: 'reviewed', remark: null, checkedAt: new Date(), updatedAt: new Date() },
      { studentId: 101, memberId: 52, status: 'reviewed', remark: null, checkedAt: new Date(), updatedAt: new Date() },
    ]),
    replaceMethod(prisma.auditLog, 'create', async ({ data }: any) => {
      auditData = data;
      return { id: 301, createdAt: new Date(), ...data };
    }),
  ];

  try {
    const result = await updateStudentCheck({
      payload: {
        userId: 61,
        username: 'reviewer_12_51',
        role: 'reviewer',
        classId: 12,
        reviewInviteId: 31,
        reviewMemberId: 51,
      },
      studentId: 101,
      status: 'reviewed',
    });

    assert.equal(upsertData.create.memberId, 51);
    assert.equal(result.aggregate, 'reviewed');
    assert.equal(auditData.academicYearId, 2025);
    assert.equal(auditData.classId, 12);
    assert.equal(auditData.actorId, 61);
    assert.equal(auditData.action, 'student_check_updated');
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});
