import crypto from 'node:crypto';
import prisma from '../../../core/db.js';
import { generateToken, type TokenPayload } from '../../../core/utils/token.js';
import { hashPassword } from '../../../core/utils/password.js';
import { recordAuditLog, listAuditLogs } from '../../platform/services/auditService.js';
import { getOrCreateScoreReviewRecord, signScoreReviewMember } from './scoreReviewGroupService.js';
import { getScoresByClass, assertStudentInClass } from './scoreService.js';

const INVITE_EXPIRES_DAYS = 7;
const CHECK_STATUSES = new Set(['pending', 'reviewed', 'issue']);

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function expiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + INVITE_EXPIRES_DAYS);
  return date;
}

async function getRecordByClass(academicYearId: number, classId: number) {
  return getOrCreateScoreReviewRecord({ academicYearId, classId });
}

async function ensureMemberInRecord(recordId: number, memberId: number) {
  const member = await prisma.scoreReviewGroupMember.findFirst({
    where: { id: memberId, recordId },
  });
  if (!member) throw new Error('review_member_not_found');
  return member;
}

async function createReviewerUser(data: {
  classId: number;
  memberId: number;
  memberName: string;
}) {
  const username = `reviewer_${data.classId}_${data.memberId}`;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(randomToken()),
      role: 'reviewer',
      classId: data.classId,
      displayName: data.memberName,
    },
  });
}

async function findActiveInviteByReviewer(userId: number, inviteId: number) {
  const invite = await prisma.scoreReviewMemberInvite.findFirst({
    where: {
      id: inviteId,
      reviewerUserId: userId,
      status: 'active',
    },
    include: {
      member: { include: { signatureFile: true } },
      record: {
        include: {
          class: { include: { grade: true } },
          members: { orderBy: { sortOrder: 'asc' }, include: { signatureFile: true } },
        },
      },
    },
  });
  if (!invite || invite.expiresAt <= new Date()) {
    throw new Error('invite_invalid');
  }
  return invite;
}

export async function assertReviewerInvite(payload: TokenPayload) {
  if (payload.role !== 'reviewer' || !payload.reviewInviteId || !payload.reviewMemberId) {
    throw new Error('reviewer_session_required');
  }
  const invite = await findActiveInviteByReviewer(payload.userId, payload.reviewInviteId);
  if (invite.memberId !== payload.reviewMemberId || invite.record.classId !== payload.classId) {
    throw new Error('reviewer_session_mismatch');
  }
  return invite;
}

export async function listInvites(data: {
  academicYearId: number;
  classId: number;
}) {
  const record = await getRecordByClass(data.academicYearId, data.classId);
  const invites = await prisma.scoreReviewMemberInvite.findMany({
    where: { recordId: record.id },
    orderBy: { createdAt: 'desc' },
  });
  const latestByMember = new Map<number, any>();
  for (const invite of invites) {
    if (!latestByMember.has(invite.memberId)) latestByMember.set(invite.memberId, invite);
  }
  return {
    recordId: record.id,
    members: record.members.map((member: any) => {
      const invite = latestByMember.get(member.id);
      return {
        memberId: member.id,
        name: member.name,
        roleName: member.roleName,
        signatureFileId: member.signatureFileId,
        signedAt: member.signedAt,
        inviteStatus: invite?.status || 'none',
        deviceBound: Boolean(invite?.deviceIdHash),
        expiresAt: invite?.expiresAt || null,
        lastLoginAt: invite?.lastLoginAt || null,
      };
    }),
  };
}

export async function generateInvite(data: {
  academicYearId: number;
  classId: number;
  memberId: number;
  actorId?: number;
  baseUrl: string;
}) {
  const record = await getRecordByClass(data.academicYearId, data.classId);
  const member = await ensureMemberInRecord(record.id, data.memberId);
  const reviewer = await createReviewerUser({
    classId: data.classId,
    memberId: member.id,
    memberName: member.name,
  });
  await prisma.scoreReviewMemberInvite.updateMany({
    where: { recordId: record.id, memberId: member.id, status: 'active' },
    data: { status: 'revoked' },
  });

  const token = randomToken();
  const invite = await prisma.scoreReviewMemberInvite.create({
    data: {
      recordId: record.id,
      memberId: member.id,
      reviewerUserId: reviewer.id,
      tokenHash: sha256(token),
      status: 'active',
      expiresAt: expiresAt(),
      createdBy: data.actorId,
    },
  });
  const audit = await recordAuditLog({
    module: 'score_review',
    action: 'invite_generated',
    academicYearId: record.academicYearId,
    classId: record.classId,
    actorId: data.actorId,
    targetType: 'ScoreReviewMemberInvite',
    targetId: invite.id,
    after: { memberId: member.id, memberName: member.name },
  });

  return {
    invite,
    audit,
    url: `${data.baseUrl.replace(/\/$/, '')}/review-login?token=${token}`,
  };
}

export async function revokeInvite(data: {
  academicYearId: number;
  classId: number;
  memberId: number;
  actorId?: number;
}) {
  const record = await getRecordByClass(data.academicYearId, data.classId);
  await ensureMemberInRecord(record.id, data.memberId);
  await prisma.scoreReviewMemberInvite.updateMany({
    where: { recordId: record.id, memberId: data.memberId, status: 'active' },
    data: { status: 'revoked' },
  });
  return recordAuditLog({
    module: 'score_review',
    action: 'invite_revoked',
    academicYearId: record.academicYearId,
    classId: record.classId,
    actorId: data.actorId,
    targetType: 'ScoreReviewGroupMember',
    targetId: data.memberId,
  });
}

export async function loginByInvite(data: {
  token: string;
  deviceId: string;
}) {
  const invite = await prisma.scoreReviewMemberInvite.findUnique({
    where: { tokenHash: sha256(data.token) },
    include: {
      member: true,
      record: { include: { class: { include: { grade: true } } } },
      reviewerUser: true,
    },
  });
  if (!invite) throw new Error('invite_not_found');
  if (invite.status !== 'active' || invite.expiresAt <= new Date()) {
    throw new Error('invite_unavailable');
  }
  const deviceHash = sha256(data.deviceId);
  if (invite.deviceIdHash && invite.deviceIdHash !== deviceHash) {
    await recordAuditLog({
      module: 'score_review',
      action: 'invite_device_rejected',
      academicYearId: invite.record.academicYearId,
      classId: invite.record.classId,
      actorId: invite.reviewerUserId,
      targetType: 'ScoreReviewMemberInvite',
      targetId: invite.id,
      after: { memberId: invite.memberId },
    });
    throw new Error('device_mismatch');
  }
  const updated = await prisma.scoreReviewMemberInvite.update({
    where: { id: invite.id },
    data: {
      deviceIdHash: invite.deviceIdHash || deviceHash,
      deviceBoundAt: invite.deviceIdHash ? invite.deviceBoundAt : new Date(),
      lastLoginAt: new Date(),
    },
  });

  const user = invite.reviewerUser || await createReviewerUser({
    classId: invite.record.classId,
    memberId: invite.memberId,
    memberName: invite.member.name,
  });
  if (!invite.reviewerUserId) {
    await prisma.scoreReviewMemberInvite.update({
      where: { id: invite.id },
      data: { reviewerUserId: user.id },
    });
  }

  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: 'reviewer',
    classId: invite.record.classId,
    reviewInviteId: invite.id,
    reviewMemberId: invite.memberId,
  };
  const audit = await recordAuditLog({
    module: 'score_review',
    action: invite.deviceIdHash ? 'invite_login' : 'invite_device_bound',
    academicYearId: invite.record.academicYearId,
    classId: invite.record.classId,
    actorId: user.id,
    targetType: 'ScoreReviewMemberInvite',
    targetId: invite.id,
    after: { memberId: invite.memberId, deviceBound: Boolean(updated.deviceIdHash) },
  });

  return {
    audit,
    token: generateToken(payload),
    user: {
      id: user.id,
      username: user.username,
      role: 'reviewer',
      displayName: invite.member.name,
      classId: invite.record.classId,
      className: invite.record.class.name,
      gradeId: invite.record.class.gradeId,
      gradeName: invite.record.class.grade?.name || null,
      reviewInviteId: invite.id,
      reviewMemberId: invite.memberId,
      reviewMemberName: invite.member.name,
    },
  };
}

function buildCheckMaps(
  checks: Array<{ studentId: number; memberId: number; status: string; remark: string | null; checkedAt: Date | null; updatedAt: Date }>,
  memberIds: number[],
  studentIds: number[] = [],
) {
  const byStudent: Record<number, any> = {};
  const aggregate: Record<number, string> = {};
  for (const check of checks) {
    byStudent[check.studentId] = byStudent[check.studentId] || {};
    byStudent[check.studentId][check.memberId] = check;
  }
  const allStudentIds = new Set([
    ...studentIds,
    ...Object.keys(byStudent).map((studentId) => Number(studentId)),
  ]);
  for (const studentId of allStudentIds) {
    const memberChecks = byStudent[studentId] || {};
    const values = memberIds.map((memberId) => memberChecks[memberId]?.status || 'pending');
    aggregate[studentId] = values.includes('issue')
      ? 'issue'
      : values.every((status) => status === 'reviewed')
        ? 'reviewed'
        : 'pending';
  }
  return { byStudent, aggregate };
}

export async function getReviewerSession(payload: TokenPayload) {
  const invite = await assertReviewerInvite(payload);
  const [students, checks, logs] = await Promise.all([
    getScoresByClass(invite.record.classId, invite.record.academicYearId),
    prisma.scoreReviewStudentCheck.findMany({ where: { recordId: invite.recordId } }),
    getClassLogs(invite.record.classId, invite.record.academicYearId),
  ]);
  const memberIds = invite.record.members.map((member) => member.id);
  const maps = buildCheckMaps(checks, memberIds, students.map((student: any) => student.id));
  return {
    inviteId: invite.id,
    record: invite.record,
    member: invite.member,
    class: invite.record.class,
    students,
    checks: maps.byStudent,
    aggregate: maps.aggregate,
    logs: logs.data,
  };
}

export async function getClassReviewChecks(data: {
  academicYearId: number;
  classId: number;
}) {
  const record = await getRecordByClass(data.academicYearId, data.classId);
  const [students, checks] = await Promise.all([
    prisma.student.findMany({
      where: { classId: data.classId },
      orderBy: [{ studentNo: 'asc' }],
      select: { id: true, studentNo: true, name: true },
    }),
    prisma.scoreReviewStudentCheck.findMany({
      where: { recordId: record.id },
    }),
  ]);
  const memberIds = record.members.map((member: any) => member.id);
  const maps = buildCheckMaps(checks, memberIds, students.map((student) => student.id));
  return {
    recordId: record.id,
    members: record.members.map((member: any) => ({
      id: member.id,
      name: member.name,
      roleName: member.roleName,
      signatureFileId: member.signatureFileId,
      signedAt: member.signedAt,
    })),
    students,
    checks: maps.byStudent,
    aggregate: maps.aggregate,
  };
}

export async function updateStudentCheck(data: {
  payload: TokenPayload;
  studentId: number;
  status: string;
  remark?: string | null;
}) {
  if (!CHECK_STATUSES.has(data.status)) throw new Error('invalid_check_status');
  const invite = await assertReviewerInvite(data.payload);
  await assertStudentInClass(data.studentId, invite.record.classId);
  const check = await prisma.scoreReviewStudentCheck.upsert({
    where: {
      recordId_memberId_studentId: {
        recordId: invite.recordId,
        memberId: invite.memberId,
        studentId: data.studentId,
      },
    },
    update: {
      status: data.status,
      remark: data.remark ?? null,
      checkedAt: data.status === 'pending' ? null : new Date(),
    },
    create: {
      recordId: invite.recordId,
      memberId: invite.memberId,
      studentId: data.studentId,
      status: data.status,
      remark: data.remark ?? null,
      checkedAt: data.status === 'pending' ? null : new Date(),
    },
  });
  const allChecks = await prisma.scoreReviewStudentCheck.findMany({
    where: { recordId: invite.recordId },
  });
  const maps = buildCheckMaps(allChecks, invite.record.members.map((member) => member.id));
  const audit = await recordAuditLog({
    module: 'score_review',
    action: 'student_check_updated',
    academicYearId: invite.record.academicYearId,
    classId: invite.record.classId,
    actorId: data.payload.userId,
    targetType: 'Student',
    targetId: data.studentId,
    after: { memberId: invite.memberId, status: data.status, remark: data.remark ?? null },
  });
  return { check, aggregate: maps.aggregate[data.studentId] || 'pending', audit };
}

export async function bindReviewerSignature(data: {
  payload: TokenPayload;
  signatureFileId: number;
}) {
  const invite = await assertReviewerInvite(data.payload);
  const updated = await signScoreReviewMember({
    recordId: invite.recordId,
    memberId: invite.memberId,
    signatureFileId: data.signatureFileId,
    actorId: data.payload.userId,
    auditContext: {
      academicYearId: invite.record.academicYearId,
      classId: invite.record.classId,
    },
  });
  const audit = await recordAuditLog({
    module: 'score_review',
    action: 'reviewer_signature_bound',
    academicYearId: invite.record.academicYearId,
    classId: invite.record.classId,
    actorId: data.payload.userId,
    targetType: 'ScoreReviewGroupMember',
    targetId: invite.memberId,
    after: { signatureFileId: data.signatureFileId },
  });
  return { record: updated, audit };
}

export async function getClassLogs(classId: number, academicYearId?: number) {
  return listAuditLogs({
    module: 'score_review',
    classId,
    academicYearId,
    page: 1,
    pageSize: 50,
  });
}
