import { type ReactNode, useEffect, useState } from 'react';
import { getUser, isLoggedIn } from '../../lib/auth';
import { navigateTo } from '../../lib/router';
import { usePageMeta } from '../../hooks/usePageMeta';
import {
  getGuideByRoleAndScope,
  getGuideRole,
  GuidePreview,
  GuidePrompt,
  type GuideItem,
} from '../common/OperationGuide';
import ScreenState from '../common/ScreenState';
import Sidebar from './Sidebar';

export type SystemScope = 'evaluation' | 'declaration' | 'shared';

interface AppShellProps {
  title: string;
  maxWidthClass: string;
  children: ReactNode;
  adminOnly?: boolean;
  scope?: SystemScope;
}

export default function AppShell({
  title,
  maxWidthClass,
  children,
  adminOnly = false,
  scope = 'shared',
}: AppShellProps) {
  const [ready, setReady] = useState(false);
  const [guide, setGuide] = useState<GuideItem | null>(null);
  const pageTitle = title.split(' - ')[0];
  const system = systemCopy[scope];
  const user = ready ? getUser() : null;
  const role = getGuideRole(user?.role);
  const guideForScope = scope === 'shared' ? undefined : getGuideByRoleAndScope(role, scope);

  usePageMeta(title);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigateTo('/login', { replace: true });
      return;
    }

    const user = getUser();
    if (adminOnly && user?.role !== 'admin') {
      navigateTo('/entry', { replace: true });
      return;
    }

    setReady(true);
  }, [adminOnly]);

  if (!ready) {
    return <ScreenState label="页面加载中..." fullScreen />;
  }

  return (
    <div className="flex min-h-screen bg-[#f6f1e8] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Sidebar scope={scope} />
      <main className="flex-1 overflow-auto">
        <div className={`mx-auto w-full px-5 py-6 lg:px-8 lg:py-7 ${maxWidthClass}`}>
          <header className="mb-5 border-b border-[#ded6c8] pb-5 dark:border-neutral-800">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-medium text-[#9a5b3d] dark:text-primary-300">{system.label}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal text-neutral-950 dark:text-white">{pageTitle}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">{system.description}</p>
              </div>
              <span className="inline-flex w-fit rounded-md border border-[#d9c8b8] bg-[#fffaf2] px-3 py-1.5 text-xs font-medium text-[#7c4a34] dark:border-neutral-700 dark:bg-neutral-900 dark:text-primary-300">
                {system.badge}
              </span>
            </div>
          </header>
          {guideForScope && (
            <GuidePrompt
              guides={[guideForScope]}
              onOpen={setGuide}
              title="进入系统前请先查看操作指南"
              description={system.guideDescription}
              className="mb-5"
            />
          )}
          {children}
        </div>
      </main>
      {guide && <GuidePreview guide={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}

const systemCopy: Record<SystemScope, { label: string; description: string; badge: string; guideDescription: string }> = {
  evaluation: {
    label: '综合素质测评填写系统',
    description: '处理学生基础信息、综测分数、数据导入导出和综测评审确认，申报相关页面从独立入口进入。',
    badge: '综测系统',
    guideDescription: '本指南覆盖综测数据准备、模板导入、班级填报、分数核对、审核确认和签名材料导出。',
  },
  declaration: {
    label: '奖学金与荣誉称号申报系统',
    description: '处理候选名单、班级申报、确认协议、管理员审核、邮件通知和操作记录。',
    badge: '申报系统',
    guideDescription: '本指南覆盖申报补充信息、外部奖项名单、奖学金与荣誉称号申请、管理员审核和附件2导出。',
  },
  shared: {
    label: '综测填写与申报系统',
    description: '当前页面属于两个系统共用能力，入口页可切换不同业务范围。',
    badge: '共用页面',
    guideDescription: '入口页提供综测系统和申报系统的分角色操作指南。',
  },
};
