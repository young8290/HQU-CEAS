import AppShell from '../AppShell';
import DashboardContent from '../../features/evaluation/DashboardContent';

export default function DashboardRoute() {
  return (
    <AppShell title="综测总览 - 综测填写系统" maxWidthClass="max-w-7xl" adminOnly scope="evaluation">
      <DashboardContent />
    </AppShell>
  );
}
