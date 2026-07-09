import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default admin account
  const passwordHash = await bcrypt.hash('admin123', 12);
  
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash,
      role: 'admin',
      displayName: '系统管理员',
    },
    create: {
      username: 'admin',
      passwordHash,
      role: 'admin',
      displayName: '系统管理员',
    },
  });

  // Create default academic year
  await prisma.academicYear.upsert({
    where: { name: '2025-2026学年' },
    update: { isCurrent: true },
    create: {
      name: '2025-2026学年',
      isCurrent: true,
    },
  });

  const mailTemplates = [
    {
      templateType: 'monitor_account',
      subject: '班长账号通知',
      body: '班级：{{班级}}\n班长：{{班长姓名}}\n登录账号：{{登录账号}}\n初始密码：{{初始密码}}\n系统链接：{{系统链接}}',
      variablesJson: JSON.stringify(['班级', '班长姓名', '登录账号', '初始密码', '系统链接']),
    },
    {
      templateType: 'password_reset',
      subject: '班长账号密码重置通知',
      body: '班级：{{班级}}\n登录账号：{{登录账号}}\n新密码：{{新密码}}\n系统链接：{{系统链接}}',
      variablesJson: JSON.stringify(['班级', '登录账号', '新密码', '系统链接']),
    },
    {
      templateType: 'declaration_open',
      subject: '奖学金与荣誉称号申报开放通知',
      body: '{{学年}} {{申报类型}} 已开放，截止时间：{{截止时间}}。\n系统链接：{{系统链接}}',
      variablesJson: JSON.stringify(['学年', '申报类型', '截止时间', '系统链接']),
    },
    {
      templateType: 'review_returned',
      subject: '申报退回修改通知',
      body: '班级：{{班级}}\n申报类型：{{申报类型}}\n退回原因：{{退回原因}}\n修改截止时间：{{修改截止时间}}\n系统链接：{{系统链接}}',
      variablesJson: JSON.stringify(['班级', '申报类型', '退回原因', '修改截止时间', '系统链接']),
    },
  ];

  for (const template of mailTemplates) {
    await prisma.mailTemplate.upsert({
      where: {
        templateType_version: {
          templateType: template.templateType,
          version: 1,
        },
      },
      update: {
        subject: template.subject,
        body: template.body,
        variablesJson: template.variablesJson,
        enabled: true,
      },
      create: {
        ...template,
        version: 1,
        enabled: true,
      },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: 'system.entryStatus' },
    update: {},
    create: {
      key: 'system.entryStatus',
      valueJson: JSON.stringify({
        comprehensiveEvalOpen: true,
        declarationOpen: true,
        declarationCloseReason: '',
      }),
    },
  });

  console.log('Seed data created successfully');
  console.log('   Default admin: admin / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
