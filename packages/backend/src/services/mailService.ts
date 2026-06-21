import net from 'node:net';
import tls from 'node:tls';
import prisma from '../config/database.js';
import { digestContent, getActiveMailConfig } from './mailConfigService.js';
import { renderMailTemplate } from './mailTemplateService.js';
import { recordAuditLog } from './auditService.js';

interface SmtpConfig {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  senderName: string;
}

interface MailPayload {
  to: string;
  subject: string;
  text: string;
}

function encodeHeader(value: string) {
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function normalizeLineBreaks(value: string) {
  return value.replace(/\r?\n/g, '\r\n');
}

export function buildRawMessage(config: SmtpConfig, payload: MailPayload) {
  const from = `${encodeHeader(config.senderName)} <${config.username}>`;
  return [
    `From: ${from}`,
    `To: ${payload.to}`,
    `Subject: ${encodeHeader(payload.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(normalizeLineBreaks(payload.text), 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
  ].join('\r\n');
}

class SmtpConnection {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = '';

  private constructor(socket: net.Socket | tls.TLSSocket) {
    this.socket = socket;
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk) => {
      this.buffer += chunk;
    });
  }

  static connect(config: SmtpConfig) {
    return new Promise<SmtpConnection>((resolve, reject) => {
      const socket = config.smtpPort === 465
        ? tls.connect({ host: config.smtpHost, port: config.smtpPort, servername: config.smtpHost })
        : net.connect({ host: config.smtpHost, port: config.smtpPort });
      const onError = (error: Error) => reject(error);
      socket.once('error', onError);
      socket.once('connect', () => {
        socket.off('error', onError);
        resolve(new SmtpConnection(socket));
      });
    });
  }

  private waitForResponse(expectedCodes: number[]) {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('SMTP 响应超时'));
      }, 20000);
      const onData = () => {
        const lines = this.buffer.split(/\r?\n/).filter(Boolean);
        const lastLine = [...lines].reverse().find((line) => /^\d{3} /.test(line));
        if (!lastLine) return;
        const code = Number(lastLine.slice(0, 3));
        if (!expectedCodes.includes(code)) {
          cleanup();
          const message = this.buffer.trim();
          this.buffer = '';
          reject(new Error(`SMTP 响应异常：${message}`));
          return;
        }
        const message = this.buffer.trim();
        this.buffer = '';
        cleanup();
        resolve(message);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        clearTimeout(timeout);
        this.socket.off('data', onData);
        this.socket.off('error', onError);
      };
      this.socket.on('data', onData);
      this.socket.once('error', onError);
      onData();
    });
  }

  async expectGreeting() {
    await this.waitForResponse([220]);
  }

  async command(command: string, expectedCodes: number[]) {
    this.socket.write(`${command}\r\n`);
    return this.waitForResponse(expectedCodes);
  }

  async startTls(config: SmtpConfig) {
    await this.command(`EHLO ${config.smtpHost}`, [250]);
    await this.command('STARTTLS', [220]);
    const upgraded = tls.connect({
      socket: this.socket,
      servername: config.smtpHost,
    });
    await new Promise<void>((resolve, reject) => {
      upgraded.once('secureConnect', () => resolve());
      upgraded.once('error', reject);
    });
    this.socket = upgraded;
    this.socket.setEncoding('utf8');
    this.buffer = '';
  }

  close() {
    this.socket.end();
  }
}

export async function sendSmtpMail(config: SmtpConfig, payload: MailPayload) {
  const connection = await SmtpConnection.connect(config);
  try {
    await connection.expectGreeting();
    if (config.smtpPort !== 465) {
      await connection.startTls(config);
    }
    await connection.command(`EHLO ${config.smtpHost}`, [250]);
    await connection.command('AUTH LOGIN', [334]);
    await connection.command(Buffer.from(config.username, 'utf8').toString('base64'), [334]);
    await connection.command(Buffer.from(config.password, 'utf8').toString('base64'), [235]);
    await connection.command(`MAIL FROM:<${config.username}>`, [250]);
    await connection.command(`RCPT TO:<${payload.to}>`, [250, 251]);
    await connection.command('DATA', [354]);
    await connection.command(`${buildRawMessage(config, payload)}\r\n.`, [250]);
    await connection.command('QUIT', [221]);
  } finally {
    connection.close();
  }
}

async function createMailLog(data: {
  templateType: string;
  recipientEmail: string;
  subject: string;
  body: string;
  variables?: Record<string, string | number>;
  actorId?: number;
}) {
  return prisma.mailLog.create({
    data: {
      templateType: data.templateType,
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      contentDigest: digestContent(data.body),
      variablesJson: data.variables ? JSON.stringify(data.variables) : null,
      status: 'pending',
      sentBy: data.actorId,
    },
  });
}

export async function createFailedMailLog(data: {
  templateType: string;
  recipientEmail: string;
  subject: string;
  body: string;
  failureReason: string;
  variables?: Record<string, string | number>;
  actorId?: number;
}) {
  return prisma.mailLog.create({
    data: {
      templateType: data.templateType,
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      contentDigest: digestContent(data.body),
      variablesJson: data.variables ? JSON.stringify(data.variables) : null,
      status: 'failed',
      failureReason: data.failureReason,
      sentBy: data.actorId,
    },
  });
}

async function markMailSent(id: number, actorId?: number) {
  return prisma.mailLog.update({
    where: { id },
    data: {
      status: 'sent',
      failureReason: null,
      sentBy: actorId,
      sentAt: new Date(),
    },
  });
}

async function markMailFailed(id: number, reason: string, actorId?: number) {
  return prisma.mailLog.update({
    where: { id },
    data: {
      status: 'failed',
      failureReason: reason,
      sentBy: actorId,
    },
  });
}

export async function sendTemplateMail(data: {
  templateType: string;
  recipientEmail: string;
  variables: Record<string, string | number>;
  actorId?: number;
}) {
  const config = await getActiveMailConfig();
  const template = await prisma.mailTemplate.findFirst({
    where: { templateType: data.templateType, enabled: true },
    orderBy: { version: 'desc' },
  });
  if (!template) throw new Error('邮件模板不存在或未启用');

  const subject = renderMailTemplate(template.subject, data.variables);
  const body = renderMailTemplate(template.body, data.variables);
  const log = await createMailLog({
    templateType: data.templateType,
    recipientEmail: data.recipientEmail,
    subject,
    body,
    variables: data.variables,
    actorId: data.actorId,
  });

  try {
    await sendSmtpMail(config, { to: data.recipientEmail, subject, text: body });
    const sent = await markMailSent(log.id, data.actorId);
    await recordAuditLog({
      module: 'mail',
      action: 'send',
      actorId: data.actorId,
      targetType: 'MailLog',
      targetId: log.id,
      after: { templateType: data.templateType, recipientEmail: data.recipientEmail },
    });
    return sent;
  } catch (error: any) {
    return markMailFailed(log.id, error.message || '邮件发送失败', data.actorId);
  }
}

export async function sendTestMail(data: {
  recipientEmail: string;
  actorId?: number;
}) {
  const config = await getActiveMailConfig();
  const subject = '奖学金与荣誉称号申报系统测试邮件';
  const body = '邮件配置测试成功。';
  const log = await createMailLog({
    templateType: 'test',
    recipientEmail: data.recipientEmail,
    subject,
    body,
    actorId: data.actorId,
  });

  try {
    await sendSmtpMail(config, { to: data.recipientEmail, subject, text: body });
    return markMailSent(log.id, data.actorId);
  } catch (error: any) {
    await markMailFailed(log.id, error.message || '邮件发送失败', data.actorId);
    throw error;
  }
}

export async function listMailLogs(filters: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.mailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { sentByUser: { select: { username: true, displayName: true } } },
    }),
    prisma.mailLog.count({ where }),
  ]);

  return { data, pagination: { page, pageSize, total } };
}

export async function retryMailLog(id: number, actorId?: number) {
  const log = await prisma.mailLog.findUnique({ where: { id } });
  if (!log) throw new Error('邮件记录不存在');
  const config = await getActiveMailConfig();
  const variables = log.variablesJson ? JSON.parse(log.variablesJson) : {};
  const template = await prisma.mailTemplate.findFirst({
    where: { templateType: log.templateType, enabled: true },
    orderBy: { version: 'desc' },
  });
  if (!template) {
    throw new Error('邮件模板不存在或未启用，无法重发');
  }

  try {
    await sendSmtpMail(config, {
      to: log.recipientEmail,
      subject: log.subject,
      text: buildRetryMailBody(template.body, variables),
    });
    return markMailSent(id, actorId);
  } catch (error: any) {
    await markMailFailed(id, error.message || '邮件发送失败', actorId);
    throw error;
  }
}

export function buildRetryMailBody(templateBody: string, variables: Record<string, string | number | null | undefined>) {
  return renderMailTemplate(templateBody, variables);
}
