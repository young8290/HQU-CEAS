import AppShell from '../AppShell';
import DashboardContent from '../../features/evaluation/DashboardContent';

export default function MonitorDashboardRoute() {
  return (
    <AppShell title="本班综测总览 - 综测填写系统" maxWidthClass="max-w-7xl" monitorOnly scope="evaluation">
      <DashboardContent />
    </AppShell>
  );
}
