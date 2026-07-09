import prisma from '../config/database.js';
import { cacheService } from './cacheService.js';

const VARIABLE_PATTERN = /\{\{([^{}]+)\}\}/g;

export const MAIL_TEMPLATE_VARIABLES: Record<string, string[]> = {
  monitor_account: ['班级', '班长姓名', '登录账号', '初始密码', '系统链接'],
  password_reset: ['班级', '登录账号', '新密码', '系统链接'],
  declaration_open: ['学年', '申报类型', '截止时间', '系统链接'],
  review_returned: ['班级', '申报类型', '退回原因', '修改截止时间', '系统链接'],
};

export function extractTemplateVariables(template: string): string[] {
  const variables = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    variables.add(match[1].trim());
  }
  return Array.from(variables);
}

export function validateTemplateVariables(template: string, allowedVariables: string[]) {
  const actual = extractTemplateVariables(template);
  const unknownVariables = actual.filter((name) => !allowedVariables.includes(name));

  return {
    valid: unknownVariables.length === 0,
    unknownVariables,
  };
}

export function renderMailTemplate(template: string, variables: Record<string, string | number | null | undefined>) {
  return template.replace(VARIABLE_PATTERN, (_, name: string) => {
    const value = variables[name.trim()];
    return value === null || value === undefined ? '' : String(value);
  });
}

export async function listMailTemplates() {
  return cacheService.memo('mailTemplate', 'list', 5 * 60 * 1000, () => prisma.mailTemplate.findMany({
    orderBy: [{ templateType: 'asc' }, { version: 'desc' }],
  }));
}

export async function updateMailTemplate(id: number, data: {
  subject: string;
  body: string;
  enabled?: boolean;
}) {
  const current = await prisma.mailTemplate.findUnique({ where: { id } });
  if (!current) throw new Error('邮件模板不存在');

  const allowed = MAIL_TEMPLATE_VARIABLES[current.templateType] || [];
  const validation = validateTemplateVariables(`${data.subject}\n${data.body}`, allowed);
  if (!validation.valid) {
    throw new Error(`模板包含未定义变量：${validation.unknownVariables.join('、')}`);
  }

  const updated = await prisma.mailTemplate.update({
    where: { id },
    data: {
      subject: data.subject,
      body: data.body,
      enabled: data.enabled ?? current.enabled,
      variablesJson: JSON.stringify(allowed),
      version: current.version + 1,
    },
  });
  cacheService.clear('mailTemplate');
  return updated;
}
