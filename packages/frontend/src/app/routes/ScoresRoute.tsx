import AppShell from '../AppShell';
import ScoresPage from '../../features/evaluation/ScoresPage';

export default function ScoresRoute() {
  return (
    <AppShell title="分数管理 - 综测填写系统" maxWidthClass="max-w-7xl" scope="evaluation" adminOnly>
      <ScoresPage />
    </AppShell>
  );
}
