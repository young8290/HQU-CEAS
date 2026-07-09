export type GuideRole = 'admin' | 'monitor';
export type GuideScope = 'evaluation' | 'declaration';

export interface GuideItem {
  role: GuideRole;
  scope: GuideScope;
  title: string;
  buttonLabel: string;
  pdf: string;
}

export const guideItems: GuideItem[] = [
  {
    role: 'admin',
    scope: 'evaluation',
    title: '综合素质测评填写系统 · 管理员操作指南',
    buttonLabel: '综测管理员指南',
    pdf: '/guides/evaluation-admin-guide.pdf',
  },
  {
    role: 'admin',
    scope: 'declaration',
    title: '奖学金与荣誉称号申报系统 · 管理员操作指南',
    buttonLabel: '申报管理员指南',
    pdf: '/guides/declaration-admin-guide.pdf',
  },
  {
    role: 'monitor',
    scope: 'evaluation',
    title: '综合素质测评填写系统 · 班长操作指南',
    buttonLabel: '综测班长指南',
    pdf: '/guides/evaluation-monitor-guide.pdf',
  },
  {
    role: 'monitor',
    scope: 'declaration',
    title: '奖学金与荣誉称号申报系统 · 班长操作指南',
    buttonLabel: '申报班长指南',
    pdf: '/guides/declaration-monitor-guide.pdf',
  },
];

export function getGuideRole(role?: string | null): GuideRole {
  return role === 'admin' ? 'admin' : 'monitor';
}

export function getGuidesByRole(role: GuideRole): GuideItem[] {
  return guideItems.filter((item) => item.role === role);
}

export function getGuideByRoleAndScope(role: GuideRole, scope: GuideScope): GuideItem | undefined {
  return guideItems.find((item) => item.role === role && item.scope === scope);
}

interface GuidePromptProps {
  guides: GuideItem[];
  onOpen: (guide: GuideItem) => void;
  title?: string;
  description?: string;
  eyebrow?: string;
  className?: string;
}

export function GuidePrompt({
  guides,
  onOpen,
  title = '操作指南',
  description = '按角色查看数据准备、班级填报、审核确认和材料导出。',
  eyebrow = '操作指南',
  className = '',
}: GuidePromptProps) {
  if (guides.length === 0) return null;

  return (
    <section
      className={`rounded-lg border border-[#d8c9b8] bg-[#fffdf8] p-5 shadow-[0_18px_50px_rgba(65,48,34,0.06)] dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#d8c9b8] bg-[#fff4e3] text-sm font-semibold text-[#7c4a34] dark:border-neutral-700 dark:bg-neutral-950 dark:text-primary-300">
            PDF
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#9a5b3d] dark:text-primary-300">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {guides.map((item) => (
            <button
              key={item.pdf}
              type="button"
              onClick={() => onOpen(item)}
              className="rounded-md border border-[#d8c9b8] bg-[#fffaf2] px-4 py-2 text-sm font-medium text-[#7c4a34] transition-colors hover:border-[#9a5b3d] hover:bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-primary-300"
            >
              {item.buttonLabel}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GuidePreview({ guide, onClose }: { guide: GuideItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/55 px-4 py-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={guide.title}>
      <section className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#ded6c8] bg-[#fffdf8] shadow-[0_24px_80px_rgba(40,32,24,0.22)] dark:border-neutral-800 dark:bg-neutral-900">
        <header className="flex flex-col gap-3 border-b border-[#e4d8ca] px-5 py-4 dark:border-neutral-800 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#9a5b3d] dark:text-primary-300">PDF</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{guide.title}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={guide.pdf}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm font-medium text-[#7c4a34] transition-colors hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-950 dark:text-primary-300"
            >
              新窗口打开
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34]"
            >
              关闭预览
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 bg-[#f6f1e8] p-3 dark:bg-neutral-950">
          <iframe
            title={guide.title}
            src={`${guide.pdf}#toolbar=1&navpanes=0`}
            className="h-full w-full rounded-md border border-[#ded6c8] bg-white dark:border-neutral-800"
          />
        </div>
      </section>
    </div>
  );
}
