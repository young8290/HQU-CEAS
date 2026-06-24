import prisma from '../config/database.js';

const SENSITIVE_KEYS = ['password', 'passwordHash', 'passwordEncrypted', 'authorizationCode', 'initialPassword'];

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))
      ? '***'
      : sanitize(item);
  }
  return result;
}

export async function recordAuditLog(data: {
  module: string;
  action: string;
  academicYearId?: number | null;
  classId?: number | null;
  actorId?: number | null;
  targetType?: string | null;
  targetId?: number | null;
  before?: unknown;
  after?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      module: data.module,
      action: data.action,
      academicYearId: data.academicYearId ?? null,
      classId: data.classId ?? null,
      actorId: data.actorId ?? null,
      targetType: data.targetType ?? null,
      targetId: data.targetId ?? null,
      beforeJson: data.before === undefined ? null : JSON.stringify(sanitize(data.before)),
      afterJson: data.after === undefined ? null : JSON.stringify(sanitize(data.after)),
    },
  });
}

export async function listAuditLogs(filters: {
  module?: string;
  action?: string;
  academicYearId?: number;
  classId?: number;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const where = {
    ...(filters.module ? { module: filters.module } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
    ...(filters.classId ? { classId: filters.classId } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, pagination: { page, pageSize, total } };
}

export async function getAuditLogDetail(id: number) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: { actor: { select: { username: true, displayName: true } } },
  });
}
