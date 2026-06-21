import { useEffect, useState } from 'react';
import ScreenState from '../components/common/ScreenState';
import StatusChip from '../components/common/StatusChip';
import {
  getGuideRole,
  getGuidesByRole,
  GuidePreview,
  GuidePrompt,
  type GuideItem,
} from '../components/common/OperationGuide';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';
import { AppLink } from '../lib/router';
import { usePageMeta } from '../hooks/usePageMeta';

interface EntryStatus {
  comprehensiveEvalOpen: boolean;
  declarationOpen: boolean;
  declarationCloseReason: string;
}

export default function SystemEntryRoute() {
  const [status, setStatus] = useState<EntryStatus | null>(null);
  const [year, setYear] = useState<string>('未设置');
  const [loading, setLoading] = useState(true);
  const [guide, setGuide] = useState<GuideItem | null>(null);
  const user = getUser();
  usePageMeta('系统入口 - 综测填写与申报系统');
  const role = getGuideRole(user?.role);
  const visibleGuides = getGuidesByRole(role);

  useEffect(() => {
    api.get('/system/entry-status')
      .then((data: any) => {
        setStatus(data.entryStatus);
        setYear(data.currentYear?.name || '未设置');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ScreenState label="系统入口加载中..." fullScreen />;

  return (
    <main className="min-h-screen bg-[#faf7f0] px-5 py-8 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 border-b border-[#e8dfd2] pb-6 dark:border-neutral-800">
          <div className="mb-5 flex items-center gap-3">
            <img src="/学院logo.png" alt="学院logo" width="40" height="40" decoding="async" className="h-10 w-10 rounded-md border border-[#e2d7c8] bg-white object-contain p-1 dark:border-neutral-800 dark:bg-neutral-900" />
            <div>
              <p className="text-xs font-medium text-[#9a5b3d] dark:text-primary-300">计算机科学与技术学院</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">当前学年：{year}</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
              <h1 className="text-3xl font-semibold tracking-normal text-neutral-950 dark:text-white">系统入口</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                两个入口进入不同业务区。综合素质测评入口只展示综测、学生、导入导出和评审签名；奖学金与荣誉称号申报入口只展示申报、审核、邮件、标签和日志。
            </p>
          </div>
            <div className="rounded-md border border-[#e2d7c8] bg-[#fffdf8] px-3 py-2 text-sm text-[#7c4a34] shadow-[0_1px_0_rgba(40,32,24,0.04)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-primary-300">
              {user?.displayName || user?.username}，{user?.role === 'admin' ? '管理员端' : '班长端'}
            </div>
          </div>
        </header>

        <GuidePrompt guides={visibleGuides} onOpen={setGuide} className="mb-5" />

        <div className="grid gap-5 lg:grid-cols-2">
          <EntryCard
            title="综合素质测评填写系统"
            eyebrow="测评数据区"
            description="维护学生基础信息、综测分数、导入导出附件和综测审核小组签名。该入口保留综测评审相关页面，申报页面从另一个入口进入。"
            open={status?.comprehensiveEvalOpen ?? false}
            href={user?.role === 'admin' ? '/dashboard' : '/monitor/dashboard'}
            actionLabel={user?.role === 'admin' ? '进入综测总览' : '进入本班综测'}
            guide={visibleGuides.find((item) => item.scope === 'evaluation')}
            onGuideOpen={setGuide}
            items={user?.role === 'admin'
              ? ['综测总览', '分数管理', '学生管理', '数据导入', '附件导出']
              : ['本班综测总览', '本班综测', '综测审核小组签名', '账号设置']}
          />
          <EntryCard
            title="奖学金与荣誉称号申报系统"
            eyebrow="班级申报区"
            description="查看候选名单、完成确认项、签署班长确认协议、提交班级申报，并由管理员审核与归档。该入口只展示申报相关功能。"
            open={status?.declarationOpen ?? false}
            href={user?.role === 'admin' ? '/declaration-reviews' : '/monitor/awards'}
            actionLabel={user?.role === 'admin' ? '进入申报审核' : '进入奖学金申报'}
            guide={visibleGuides.find((item) => item.scope === 'declaration')}
            onGuideOpen={setGuide}
            closeReason={status?.declarationCloseReason}
            items={user?.role === 'admin'
              ? ['申报审核', '申报数据导入', '申报材料导出', '标签视图', '账号邮件']
              : ['奖学金申报', '荣誉称号', '提交记录', '班长确认协议']}
            accent="declaration"
          />
        </div>
      </div>
      {guide && <GuidePreview guide={guide} onClose={() => setGuide(null)} />}
    </main>
  );
}

function EntryCard({
  title,
  eyebrow,
  description,
  open,
  href,
  actionLabel,
  closeReason,
  items,
  guide,
  onGuideOpen,
  accent = 'evaluation',
}: {
  title: string;
  eyebrow: string;
  description: string;
  open: boolean;
  href: string;
  actionLabel: string;
  closeReason?: string;
  items: string[];
  guide?: GuideItem;
  onGuideOpen: (guide: GuideItem) => void;
  accent?: 'evaluation' | 'declaration';
}) {
  const accentClass = accent === 'declaration'
    ? {
        eyebrow: 'text-[#9a5b3d] dark:text-primary-300',
        button: 'bg-[#9a5b3d] hover:bg-[#7c4a34]',
        item: 'border-[#ecdccd] bg-[#fff8ef]',
        rail: 'bg-[#9a5b3d]',
      }
    : {
        eyebrow: 'text-[#64748b] dark:text-neutral-300',
        button: 'bg-[#4b5563] hover:bg-[#374151]',
        item: 'border-[#dde3e8] bg-[#fbfcfd]',
        rail: 'bg-[#64748b]',
      };

  return (
    <section className="relative overflow-hidden rounded-lg border border-[#e2d7c8] bg-[#fffdf8] p-6 shadow-[0_18px_50px_rgba(65,48,34,0.06)] dark:border-neutral-800 dark:bg-neutral-900">
      <div className={`absolute inset-y-0 left-0 w-1 ${accentClass.rail}`} />
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-medium uppercase tracking-[0.14em] ${accentClass.eyebrow}`}>{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{description}</p>
        </div>
        <StatusChip label={open ? '开放中' : '已关闭'} tone={open ? 'success' : 'warning'} />
      </div>
      <div className="mb-5 grid gap-2 border-y border-[#eee4d7] py-4 dark:border-neutral-800 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item} className={`rounded-md border px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 ${accentClass.item}`}>
            {item}
          </div>
        ))}
      </div>
      {closeReason && !open && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {closeReason}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {guide && (
          <button
            type="button"
            onClick={() => onGuideOpen(guide)}
            className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm font-medium text-[#7c4a34] transition-colors hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-950 dark:text-primary-300"
          >
            查看操作指南
          </button>
        )}
        {open ? (
          <AppLink to={href} className={`inline-flex rounded-md px-4 py-2 text-sm font-medium text-white ${accentClass.button}`}>
            {actionLabel}
          </AppLink>
        ) : (
          <button type="button" disabled className="rounded-md border border-neutral-200 px-4 py-2 text-sm text-neutral-400 dark:border-neutral-800">
            暂停进入
          </button>
        )}
      </div>
    </section>
  );
}
