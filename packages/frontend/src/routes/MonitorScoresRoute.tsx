import AppShell from '../components/layout/AppShell';
import MonitorScoreReviewPage from '../components/scores/MonitorScoreReviewPage';

export default function MonitorScoresRoute() {
  return (
    <AppShell title="本班综测 - 综测填写系统" maxWidthClass="max-w-[1600px]" scope="evaluation">
      <MonitorScoreReviewPage />
    </AppShell>
  );
}
