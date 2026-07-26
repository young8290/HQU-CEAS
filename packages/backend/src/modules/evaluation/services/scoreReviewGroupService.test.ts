import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../../core/db.js';
import { saveScoreReviewMembers } from './scoreReviewGroupService.js';
import { replaceMethod } from '../../../core/utils/testUtils.js';

test('saveScoreReviewMembers keeps saved member ids for existing invites', async () => {
  const signedAt = new Date('2026-06-26T00:00:00.000Z');
  const record = {
    id: 41,
    academicYearId: 2026,
    classId: 12,
    status: 'completed',
    pdfFileId: 8,
    completedAt: signedAt,
    createdAt: signedAt,
    updatedAt: signedAt,
    pdfFile: null,
  };
  let nextMemberId = 53;
  let deleteWhere: any = null;
  let members: any[] = [
    {
      id: 51,
      recordId: record.id,
      name: 'Leader',
      roleName: 'Leader',
      sortOrder: 0,
      signatureFileId: 901,
      signedAt,
      signatureFile: null,
    },
    {
      id: 52,
      recordId: record.id,
      name: 'Secretary',
      roleName: 'Secretary',
      sortOrder: 1,
      signatureFileId: null,
      signedAt: null,
      signatureFile: null,
    },
  ];
  const restores = [
    replaceMethod(prisma.scoreReviewRecord, 'upsert', async () => ({ ...record, members: [...members] })),
    replaceMethod(prisma.scoreReviewRecord, 'update', async ({ data }: any) => ({ ...record, ...data })),
    replaceMethod(prisma.scoreReviewGroupMember, 'deleteMany', async ({ where }: any) => {
      deleteWhere = where;
      const keepIds = where.id?.notIn || [];
      const beforeCount = members.length;
      members = members.filter((member) => member.recordId !== where.recordId || keepIds.includes(member.id));
      return { count: beforeCount - members.length };
    }),
    replaceMethod(prisma.scoreReviewGroupMember, 'update', async ({ where, data }: any) => {
      const index = members.findIndex((member) => member.id === where.id);
      members[index] = { ...members[index], ...data };
      return members[index];
    }),
    replaceMethod(prisma.scoreReviewGroupMember, 'create', async ({ data }: any) => {
      const member = {
        id: nextMemberId++,
        signatureFileId: null,
        signedAt: null,
        signatureFile: null,
        ...data,
      };
      members.push(member);
      return member;
    }),
    replaceMethod(prisma, '$transaction', async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    replaceMethod(prisma.auditLog, 'create', async ({ data }: any) => ({ id: 301, createdAt: new Date(), ...data })),
  ];

  try {
    const result = await saveScoreReviewMembers({
      academicYearId: record.academicYearId,
      classId: record.classId,
      actorId: 1,
      members: [
        { id: 51, name: 'Leader', roleName: 'Leader' },
        { id: 52, name: 'Secretary', roleName: 'Secretary' },
        { name: 'Study Member', roleName: 'Study Member' },
      ],
    });

    assert.deepEqual(deleteWhere, { recordId: record.id, id: { notIn: [51, 52] } });
    assert.deepEqual(result.members.map((member: any) => member.id), [51, 52, 53]);
    assert.equal(result.members[0].signatureFileId, 901);
    assert.equal(result.members[2].name, 'Study Member');
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});
