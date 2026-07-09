import crypto from 'crypto';
import prisma from '../config/database.js';
import { recordAuditLog } from './auditService.js';

function encodeSecret(value: string) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function decodeSecret(value: string) {
  return Buffer.from(value, 'base64').toString('utf8');
}

function maskSecret(value: string) {
  if (!value) return '';
  const decoded = decodeSecret(value);
  return `${decoded.slice(0, 2)}****${decoded.slice(-2)}`;
}

export async function getMailSettings() {
  const config = await prisma.mailConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!config) {
    return {
      configured: false,
      enabled: false,
    };
  }

  return {
    id: config.id,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    username: config.username,
    senderName: config.senderName,
    enabled: config.enabled,
    passwordMasked: maskSecret(config.passwordEncrypted),
    configured: true,
  };
}

export async function updateMailSettings(data: {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  senderName: string;
  enabled?: boolean;
  actorId?: number;
}) {
  const previous = await prisma.mailConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
  const password = data.password.trim();
  if (!previous && !password) {
    throw new Error('授权码不能为空');
  }
  const passwordEncrypted = password ? encodeSecret(password) : previous!.passwordEncrypted;
  const updated = previous
    ? await prisma.mailConfig.update({
      where: { id: previous.id },
      data: {
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        username: data.username,
        passwordEncrypted,
        senderName: data.senderName,
        enabled: data.enabled ?? previous.enabled,
        updatedBy: data.actorId,
      },
    })
    : await prisma.mailConfig.create({
      data: {
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        username: data.username,
        passwordEncrypted,
        senderName: data.senderName,
        enabled: data.enabled ?? false,
        updatedBy: data.actorId,
      },
    });

  await recordAuditLog({
    module: 'mail',
    action: 'update_settings',
    actorId: data.actorId,
    targetType: 'MailConfig',
    targetId: updated.id,
    after: { ...data, password: '***' },
  });

  return getMailSettings();
}

export function digestContent(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function getActiveMailConfig() {
  const config = await prisma.mailConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!config || !config.enabled) {
    throw new Error('邮件配置尚未启用');
  }

  return {
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    username: config.username,
    password: decodeSecret(config.passwordEncrypted),
    senderName: config.senderName,
  };
}
