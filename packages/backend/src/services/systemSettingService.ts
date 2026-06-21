import prisma from '../config/database.js';
import { cacheService } from './cacheService.js';
import { recordAuditLog } from './auditService.js';

const ENTRY_STATUS_KEY = 'system.entryStatus';

export interface EntryStatus {
  comprehensiveEvalOpen: boolean;
  declarationOpen: boolean;
  declarationCloseReason: string;
}

const defaultEntryStatus: EntryStatus = {
  comprehensiveEvalOpen: true,
  declarationOpen: true,
  declarationCloseReason: '',
};

function parseSetting<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getEntryStatus(): Promise<EntryStatus> {
  return cacheService.memo('systemStatus', ENTRY_STATUS_KEY, 30 * 1000, async () => {
    const setting = await prisma.systemSetting.findUnique({ where: { key: ENTRY_STATUS_KEY } });
    return parseSetting(setting?.valueJson, defaultEntryStatus);
  });
}

export async function updateEntryStatus(data: Partial<EntryStatus>, actorId?: number) {
  const before = await getEntryStatus();
  const next: EntryStatus = { ...before, ...data };
  const setting = await prisma.systemSetting.upsert({
    where: { key: ENTRY_STATUS_KEY },
    update: { valueJson: JSON.stringify(next), updatedBy: actorId },
    create: { key: ENTRY_STATUS_KEY, valueJson: JSON.stringify(next), updatedBy: actorId },
  });
  cacheService.clear('systemStatus');
  await recordAuditLog({
    module: 'system',
    action: 'update_entry_status',
    actorId,
    targetType: 'SystemSetting',
    targetId: setting.id,
    before,
    after: next,
  });
  return next;
}

export async function listSystemSettings() {
  const entryStatus = await getEntryStatus();
  return { entryStatus };
}
