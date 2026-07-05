import AppShell from '../components/layout/AppShell';
import ScoresPage from '../components/scores/ScoresPage';

export default function MonitorScoresRoute() {
  return (
    <AppShell title="本班综测 - 综测填写系统" maxWidthClass="max-w-[1600px]" monitorOnly scope="evaluation">
      <ScoresPage />
    </AppShell>
  );
}
