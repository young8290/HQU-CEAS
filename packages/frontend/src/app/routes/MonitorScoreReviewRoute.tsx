import AppShell from '../AppShell';
import MonitorScoreReviewPage from '../../features/evaluation/MonitorScoreReviewPage';

export default function MonitorScoreReviewRoute() {
  return (
    <AppShell title="审核小组确认 - 综测填写系统" maxWidthClass="max-w-[1600px]" monitorOnly scope="evaluation">
      <MonitorScoreReviewPage />
    </AppShell>
  );
}
