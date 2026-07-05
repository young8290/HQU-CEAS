import RouteErrorBoundary from './components/common/RouteErrorBoundary';
import type { ComponentType } from 'react';
import AccountsRoute from './routes/AccountsRoute';
import AuditLogsRoute from './routes/AuditLogsRoute';
import AwardsRoute from './routes/AwardsRoute';
import DashboardRoute from './routes/DashboardRoute';
import DeclarationExportRoute from './routes/DeclarationExportRoute';
import DeclarationImportRoute from './routes/DeclarationImportRoute';
import DeclarationReviewsRoute from './routes/DeclarationReviewsRoute';
import ExportRoute from './routes/ExportRoute';
import HonorsRoute from './routes/HonorsRoute';
import ImportRoute from './routes/ImportRoute';
import LoginRoute from './routes/LoginRoute';
import MailRoute from './routes/MailRoute';
import MailTemplateRoute from './routes/MailTemplateRoute';
import MonitorDashboardRoute from './routes/MonitorDashboardRoute';
import MonitorScoreReviewRoute from './routes/MonitorScoreReviewRoute';
import MonitorScoresRoute from './routes/MonitorScoresRoute';
import NotFoundRoute from './routes/NotFoundRoute';
import RootRoute from './routes/RootRoute';
import ReviewInviteLoginRoute from './routes/ReviewInviteLoginRoute';
import ReviewScoresRoute from './routes/ReviewScoresRoute';
import ScoresRoute from './routes/ScoresRoute';
import SettingsRoute from './routes/SettingsRoute';
import StudentsRoute from './routes/StudentsRoute';
import SubmissionsRoute from './routes/SubmissionsRoute';
import SystemEntryRoute from './routes/SystemEntryRoute';
import TagsRoute from './routes/TagsRoute';
import { useCurrentPath } from './lib/router';

const routes: Record<string, ComponentType> = {
  '/': RootRoute,
  '/login': LoginRoute,
  '/review-login': ReviewInviteLoginRoute,
  '/review/scores': ReviewScoresRoute,
  '/entry': SystemEntryRoute,
  '/dashboard': DashboardRoute,
  '/monitor/dashboard': MonitorDashboardRoute,
  '/scores': ScoresRoute,
  '/monitor/scores': MonitorScoresRoute,
  '/monitor/score-review': MonitorScoreReviewRoute,
  '/students': StudentsRoute,
  '/import': ImportRoute,
  '/export': ExportRoute,
  '/accounts': AccountsRoute,
  '/monitor/awards': AwardsRoute,
  '/monitor/honors': HonorsRoute,
  '/declaration-reviews': DeclarationReviewsRoute,
  '/declaration-import': DeclarationImportRoute,
  '/declaration-export': DeclarationExportRoute,
  '/monitor/submissions': SubmissionsRoute,
  '/tags': TagsRoute,
  '/audit-logs': AuditLogsRoute,
  '/accounts-mail': MailRoute,
  '/mail-templates': MailTemplateRoute,
  '/settings': SettingsRoute,
};

export default function App() {
  const currentPath = useCurrentPath();
  const RouteComponent = routes[currentPath] ?? NotFoundRoute;

  return (
    <RouteErrorBoundary>
      <RouteComponent />
    </RouteErrorBoundary>
  );
}
