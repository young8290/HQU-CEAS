import { useState, useEffect, type ReactNode } from 'react';
import { getUser, clearAuth, type User } from '../../lib/auth';
import { AppLink, navigateTo, useCurrentPath } from '../../lib/router';
import type { SystemScope } from './AppShell';

// SVG Icon components
const IconDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M3 13.125C3 12.504 3.504 12 4.125 12H6.375C6.996 12 7.5 12.504 7.5 13.125V19.875C7.5 20.496 6.996 21 6.375 21H4.125C3.827 21 3.54 20.882 3.33 20.67C3.119 20.46 3 20.173 3 19.875V13.125ZM9.75 8.625C9.75 8.004 10.254 7.5 10.875 7.5H13.125C13.746 7.5 14.25 8.004 14.25 8.625V19.875C14.25 20.496 13.746 21 13.125 21H10.875C10.577 21 10.29 20.882 10.08 20.67C9.869 20.46 9.75 20.173 9.75 19.875V8.625ZM16.5 4.125C16.5 3.504 17.004 3 17.625 3H19.875C20.496 3 21 3.504 21 4.125V19.875C21 20.496 20.496 21 19.875 21H17.625C17.327 21 17.04 20.882 16.83 20.67C16.619 20.46 16.5 20.173 16.5 19.875V4.125Z" />
  </svg>
);

const IconScores = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const IconStudents = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
  </svg>
);

const IconImport = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M3 16.5V18.75C3 19.347 3.237 19.919 3.659 20.341C4.081 20.763 4.653 21 5.25 21H18.75C19.347 21 19.919 20.763 20.341 20.341C20.763 19.919 21 19.347 21 18.75V16.5M16.5 12L12 16.5M12 16.5L7.5 12M12 16.5V3" />
  </svg>
);

const IconExport = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const IconAccounts = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 0 1 0 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.212-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const IconDeclaration = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M8 7h8M8 11h8M8 15h5" />
    <path d="M5 3h14a1 1 0 0 1 1 1v16l-4-2-4 2-4-2-4 2V4a1 1 0 0 1 1-1Z" />
  </svg>
);

const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M4 6h16v12H4z" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3-3h-12m12 0-3-3m3 3-3 3" />
  </svg>
);

interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
  scope: SystemScope;
  adminOnly?: boolean;
  monitorOnly?: boolean;
}

const navItems: NavItem[] = [
  { name: '系统入口', href: '/entry', icon: <IconDashboard />, scope: 'shared' },
  { name: '综测总览', href: '/dashboard', icon: <IconDashboard />, scope: 'evaluation', adminOnly: true },
  { name: '本班综测总览', href: '/monitor/dashboard', icon: <IconDashboard />, scope: 'evaluation', monitorOnly: true },
  { name: '分数管理', href: '/scores', icon: <IconScores />, scope: 'evaluation', adminOnly: true },
  { name: '本班综测', href: '/monitor/scores', icon: <IconScores />, scope: 'evaluation', monitorOnly: true },
  { name: '学生管理', href: '/students', icon: <IconStudents />, scope: 'evaluation', adminOnly: true },
  { name: '数据导入', href: '/import', icon: <IconImport />, scope: 'evaluation' },
  { name: '附件导出', href: '/export', icon: <IconExport />, scope: 'evaluation' },
  { name: '申报审核', href: '/declaration-reviews', icon: <IconDeclaration />, scope: 'declaration', adminOnly: true },
  { name: '申报数据导入', href: '/declaration-import', icon: <IconImport />, scope: 'declaration' },
  { name: '申报材料导出', href: '/declaration-export', icon: <IconExport />, scope: 'declaration', adminOnly: true },
  { name: '奖学金申报', href: '/monitor/awards', icon: <IconDeclaration />, scope: 'declaration', monitorOnly: true },
  { name: '荣誉称号', href: '/monitor/honors', icon: <IconDeclaration />, scope: 'declaration', monitorOnly: true },
  { name: '提交记录', href: '/monitor/submissions', icon: <IconDeclaration />, scope: 'declaration', monitorOnly: true },
  { name: '标签视图', href: '/tags', icon: <IconDeclaration />, scope: 'declaration', adminOnly: true },
  { name: '账号管理', href: '/accounts', icon: <IconAccounts />, scope: 'declaration', adminOnly: true },
  { name: '邮箱配置', href: '/accounts-mail', icon: <IconMail />, scope: 'declaration', adminOnly: true },
  { name: '邮件模板', href: '/mail-templates', icon: <IconMail />, scope: 'declaration', adminOnly: true },
  { name: '操作日志', href: '/audit-logs', icon: <IconDeclaration />, scope: 'declaration', adminOnly: true },
  { name: '系统设置', href: '/settings', icon: <IconSettings />, scope: 'shared' },
];

export default function Sidebar({ scope }: { scope: SystemScope }) {
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const currentPath = useCurrentPath();

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigateTo('/login', { replace: true });
      return;
    }
    setUser(u);
  }, []);

  const filteredItems = navItems.filter((item) => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    if (item.monitorOnly && user?.role !== 'monitor') return false;
    if (scope === 'shared') return item.scope === 'shared';
    if (item.scope !== 'shared' && item.scope !== scope) return false;
    return true;
  });

  const handleLogout = () => {
    clearAuth();
    navigateTo('/login', { replace: true });
  };

  return (
    <aside className={`h-screen flex-shrink-0 border-r border-[#ded6c8] bg-[#fffaf2] transition-all duration-300 dark:border-neutral-800 dark:bg-neutral-900 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-[#ded6c8] px-4 dark:border-neutral-800">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <img src="/学院logo.png" alt="学院logo" width="32" height="32" decoding="async" className="h-8 w-8 rounded-md object-contain" />
              <div>
                <span className="block text-sm font-semibold text-neutral-950 dark:text-white">{systemName[scope]}</span>
                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">{user?.role === 'admin' ? '管理员端' : '班长端'}</span>
              </div>
            </div>
          ) : (
            <img src="/学院logo.png" alt="学院logo" width="32" height="32" decoding="async" className="h-8 w-8 rounded-md object-contain" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
            className="cursor-pointer rounded-md p-1.5 text-neutral-500 hover:bg-[#f1e5d4] dark:hover:bg-neutral-800"
          >
            {collapsed ? '>' : '<'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {filteredItems.map((item) => {
              const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <AppLink
                    to={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-200 ${
                      isActive
                        ? 'bg-[#ead9c7] text-[#7c4a34] dark:bg-primary-500/10 dark:text-primary-300 font-medium'
                        : 'text-neutral-600 hover:bg-[#f1e5d4] dark:text-neutral-400 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span>{item.name}</span>}
                  </AppLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[#ded6c8] p-4 dark:border-neutral-800">
          {!collapsed && user && (
            <div className="mb-3">
              <p className="text-sm font-medium text-neutral-950 dark:text-white truncate">
                {user.displayName || user.username}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {user.role === 'admin' ? '管理员' : user.className || '班长'}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          >
            <IconLogout />
            {!collapsed && <span>退出登录</span>}
          </button>
          {!collapsed && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <img src="/学术部logo.png" alt="学术部logo" width="40" height="40" decoding="async" className="w-10 h-10 object-contain opacity-60" />
              <p className="text-[10px] text-neutral-400 dark:text-neutral-600 text-center leading-tight">
                计算机科学与技术学院<br />学术部制作
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

const systemName: Record<SystemScope, string> = {
  evaluation: '综测系统',
  declaration: '申报系统',
  shared: '系统入口',
};
