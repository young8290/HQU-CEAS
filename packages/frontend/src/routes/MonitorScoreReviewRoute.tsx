import AppShell from '../components/layout/AppShell';
import MonitorScoreReviewPage from '../components/scores/MonitorScoreReviewPage';

export default function MonitorScoreReviewRoute() {
  return (
    <AppShell title="审核小组确认 - 综测填写系统" maxWidthClass="max-w-[1600px]" scope="evaluation">
      <MonitorScoreReviewPage />
    </AppShell>
  );
}
