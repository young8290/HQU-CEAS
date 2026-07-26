import prisma from '../../../core/db.js';
import { hashPassword, generateRandomPassword } from '../../../core/utils/password.js';
import { createFailedMailLog, sendTemplateMail } from './mailService.js';
import ExcelJS from 'exceljs';

const DEFAULT_SYSTEM_LINK = 'http://localhost:3000';

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String((value as any).text ?? '').trim();
  if (typeof value === 'object' && 'result' in value) return String((value as any).result ?? '').trim();
  return String(value).trim();
}

export async function listUsers(filters?: { role?: string }) {
  const where: any = {};
  if (filters?.role) where.role = filters.role;
  if (!filters?.role) where.role = { not: 'reviewer' };

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      role: true,
      displayName: true,
      email: true,
      lastLoginAt: true,
      classId: true,
      createdAt: true,
      class: {
        select: {
          name: true,
          grade: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createUser(data: {
  username: string;
  password: string;
  role: string;
  classId?: number;
  displayName?: string;
  email?: string;
}) {
  const passwordHash = await hashPassword(data.password);
  return prisma.user.create({
    data: {
      username: data.username,
      passwordHash,
      role: data.role,
      classId: data.classId,
      displayName: data.displayName,
      email: data.email,
    },
  });
}

export async function deleteUser(id: number) {
  return prisma.user.delete({ where: { id } });
}

export async function resetPassword(id: number) {
  const newPassword = generateRandomPassword();
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });
  return { newPassword };
}

export async function updateUserEmail(id: number, email: string | null) {
  return prisma.user.update({
    where: { id },
    data: { email },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
    },
  });
}

export async function batchGenerateMonitors(options: {
  gradeId?: number;
  overwrite: boolean;
}) {
  // Get all classes, optionally filtered by grade
  const where: any = {};
  if (options.gradeId && options.gradeId > 0) where.gradeId = options.gradeId;

  const classes = await prisma.class.findMany({
    where,
    include: { grade: true },
    orderBy: [{ grade: { name: 'asc' } }, { name: 'asc' }],
  });

  const results: Array<{
    gradeName: string;
    className: string;
    username: string;
    password: string;
    displayName: string;
    status: string;
  }> = [];

  for (const cls of classes) {
    const username = `monitor_${cls.grade.name.replace('级', '')}_${cls.name.replace(/\s+/g, '_')}`;
    const displayName = `${cls.grade.name}${cls.name}班长`;

    // Check if account already exists
    const existing = await prisma.user.findUnique({ where: { username } });

    if (existing && !options.overwrite) {
      results.push({
        gradeName: cls.grade.name,
        className: cls.name,
        username,
        password: '***已存在***',
        displayName,
        status: '跳过',
      });
      continue;
    }

    const password = generateRandomPassword();
    const passwordHash = await hashPassword(password);

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, displayName, classId: cls.id },
      });
    } else {
      await prisma.user.create({
        data: {
          username,
          passwordHash,
          role: 'monitor',
          classId: cls.id,
          displayName,
        },
      });
    }

    results.push({
      gradeName: cls.grade.name,
      className: cls.name,
      username,
      password,
      displayName,
      status: existing ? '已重置' : '新建',
    });
  }

  return results;
}

export function buildMonitorAccountMailVariables(data: {
  gradeName: string;
  className: string;
  displayName: string;
  username: string;
  password: string;
  systemLink?: string;
}) {
  return {
    班级: `${data.gradeName}${data.className}`,
    班长姓名: data.displayName,
    登录账号: data.username,
    初始密码: data.password,
    系统链接: data.systemLink || DEFAULT_SYSTEM_LINK,
  };
}

export async function sendMonitorAccountMails(data: {
  accounts: Array<{
    gradeName: string;
    className: string;
    username: string;
    password: string;
    displayName: string;
  }>;
  actorId?: number;
  systemLink?: string;
}) {
  const results = [];

  for (const account of data.accounts) {
    const user = await prisma.user.findUnique({ where: { username: account.username } });
    if (!user?.email) {
      const variables = buildMonitorAccountMailVariables({
        ...account,
        systemLink: data.systemLink,
      });
      const mailLog = await createFailedMailLog({
        templateType: 'monitor_account',
        recipientEmail: '',
        subject: '班长账号通知',
        body: `班级：${variables.班级}\n登录账号：${variables.登录账号}`,
        variables,
        failureReason: '班长邮箱未配置',
        actorId: data.actorId,
      });
      results.push({
        username: account.username,
        status: 'failed',
        reason: mailLog.failureReason,
        mailLogId: mailLog.id,
      });
      continue;
    }

    const mail = await sendTemplateMail({
      templateType: 'monitor_account',
      recipientEmail: user.email,
      variables: buildMonitorAccountMailVariables({
        ...account,
        systemLink: data.systemLink,
      }),
      actorId: data.actorId,
    });
    results.push({
      username: account.username,
      recipientEmail: user.email,
      status: mail.status,
      mailLogId: mail.id,
    });
  }

  return results;
}

export async function importMonitorEmails(data: {
  buffer: Buffer;
  actorId?: number;
}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data.buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel文件中没有工作表');

  let successCount = 0;
  const failures: Array<{ row: number; className: string; reason: string }> = [];

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum += 1) {
    const row = worksheet.getRow(rowNum);
    const gradeName = cellText(row.getCell(1));
    const className = cellText(row.getCell(2));
    const email = cellText(row.getCell(4));
    if (!gradeName && !className && !email) continue;

    try {
      if (!email) throw new Error('邮箱为空');
      const cls = await prisma.class.findFirst({
        where: { name: className, grade: { name: gradeName } },
        include: { users: { where: { role: 'monitor' } } },
      });
      if (!cls) throw new Error('班级不存在');
      const monitor = cls.users[0];
      if (!monitor) throw new Error('班长账号不存在');
      await prisma.user.update({
        where: { id: monitor.id },
        data: { email },
      });
      successCount += 1;
    } catch (error: any) {
      failures.push({ row: rowNum, className: `${gradeName}${className}`, reason: error.message });
    }
  }

  return {
    successCount,
    failCount: failures.length,
    failures,
  };
}
