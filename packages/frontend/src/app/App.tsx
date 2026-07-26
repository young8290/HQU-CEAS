import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import RouteErrorBoundary from '../components/ui/RouteErrorBoundary';
import ScreenState from '../components/ui/ScreenState';
import { navigateTo, useCurrentPath } from '../lib/router';

// 全路由 React.lazy 代码分割：首屏只加载当前页面所需 chunk。
const RootRoute = lazy(() => import('./routes/RootRoute'));
const LoginRoute = lazy(() => import('./routes/LoginRoute'));
const ReviewInviteLoginRoute = lazy(() => import('./routes/ReviewInviteLoginRoute'));
const ReviewScoresRoute = lazy(() => import('./routes/ReviewScoresRoute'));
const SystemEntryRoute = lazy(() => import('./routes/SystemEntryRoute'));
const GuideRoute = lazy(() => import('./routes/GuideRoute'));
const DashboardRoute = lazy(() => import('./routes/DashboardRoute'));
const MonitorDashboardRoute = lazy(() => import('./routes/MonitorDashboardRoute'));
const ScoresRoute = lazy(() => import('./routes/ScoresRoute'));
const MonitorScoresRoute = lazy(() => import('./routes/MonitorScoresRoute'));
const MonitorScoreReviewRoute = lazy(() => import('./routes/MonitorScoreReviewRoute'));
const StudentsRoute = lazy(() => import('./routes/StudentsRoute'));
const ImportRoute = lazy(() => import('./routes/ImportRoute'));
const ExportRoute = lazy(() => import('./routes/ExportRoute'));
const DeclarationReviewsRoute = lazy(() => import('./routes/DeclarationReviewsRoute'));
const DeclarationImportRoute = lazy(() => import('./routes/DeclarationImportRoute'));
const DeclarationExportRoute = lazy(() => import('./routes/DeclarationExportRoute'));
const NationalScholarshipRoute = lazy(() => import('./routes/NationalScholarshipRoute'));
const TagsRoute = lazy(() => import('./routes/TagsRoute'));
const AwardsRoute = lazy(() => import('./routes/AwardsRoute'));
const HonorsRoute = lazy(() => import('./routes/HonorsRoute'));
const SubmissionsRoute = lazy(() => import('./routes/SubmissionsRoute'));
const AccountsRoute = lazy(() => import('./routes/AccountsRoute'));
const MailRoute = lazy(() => import('./routes/MailRoute'));
const MailTemplateRoute = lazy(() => import('./routes/MailTemplateRoute'));
const AuditLogsRoute = lazy(() => import('./routes/AuditLogsRoute'));
const SettingsRoute = lazy(() => import('./routes/SettingsRoute'));
const NotFoundRoute = lazy(() => import('./routes/NotFoundRoute'));

// 路由前缀即系统：/evaluation=综测系统，/declaration=申报系统，其余为平台共用。
const routes: Record<string, ComponentType> = {
  '/': RootRoute,
  '/login': LoginRoute,
  '/review-login': ReviewInviteLoginRoute,
  '/review/scores': ReviewScoresRoute,
  '/entry': SystemEntryRoute,
  '/guide': GuideRoute,
  '/evaluation/dashboard': DashboardRoute,
  '/evaluation/class/dashboard': MonitorDashboardRoute,
  '/evaluation/scores': ScoresRoute,
  '/evaluation/class/scores': MonitorScoresRoute,
  '/evaluation/class/review': MonitorScoreReviewRoute,
  '/evaluation/students': StudentsRoute,
  '/evaluation/import': ImportRoute,
  '/evaluation/export': ExportRoute,
  '/declaration/reviews': DeclarationReviewsRoute,
  '/declaration/import': DeclarationImportRoute,
  '/declaration/export': DeclarationExportRoute,
  '/declaration/national-scholarship': NationalScholarshipRoute,
  '/declaration/tags': TagsRoute,
  '/declaration/class/awards': AwardsRoute,
  '/declaration/class/honors': HonorsRoute,
  '/declaration/class/submissions': SubmissionsRoute,
  '/accounts': AccountsRoute,
  '/accounts-mail': MailRoute,
  '/mail-templates': MailTemplateRoute,
  '/audit-logs': AuditLogsRoute,
  '/settings': SettingsRoute,
};

// 旧路径 → 新路径客户端重定向表（保住书签与外部链接）。
const legacyRedirects: Record<string, string> = {
  '/dashboard': '/evaluation/dashboard',
  '/scores': '/evaluation/scores',
  '/students': '/evaluation/students',
  '/import': '/evaluation/import',
  '/export': '/evaluation/export',
  '/monitor/dashboard': '/evaluation/class/dashboard',
  '/monitor/scores': '/evaluation/class/scores',
  '/monitor/score-review': '/evaluation/class/review',
  '/declaration-reviews': '/declaration/reviews',
  '/declaration-import': '/declaration/import',
  '/declaration-export': '/declaration/export',
  '/national-scholarship': '/declaration/national-scholarship',
  '/tags': '/declaration/tags',
  '/monitor/awards': '/declaration/class/awards',
  '/monitor/honors': '/declaration/class/honors',
  '/monitor/submissions': '/declaration/class/submissions',
};

function LegacyRedirect({ to }: { to: string }) {
  useEffect(() => {
    navigateTo(to, { replace: true });
  }, [to]);

  return <ScreenState label="页面地址已更新，正在跳转" fullScreen />;
}

export default function App() {
  const currentPath = useCurrentPath();
  const redirectTarget = legacyRedirects[currentPath];

  if (redirectTarget) {
    return <LegacyRedirect to={redirectTarget} />;
  }

  const RouteComponent = routes[currentPath] ?? NotFoundRoute;

  return (
    <RouteErrorBoundary>
      <Suspense fallback={<ScreenState label="页面加载中" fullScreen />}>
        <RouteComponent />
      </Suspense>
    </RouteErrorBoundary>
  );
}
