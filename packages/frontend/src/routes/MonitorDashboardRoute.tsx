import DashboardContent from '../components/dashboard/DashboardContent';
import AppShell from '../components/layout/AppShell';

export default function MonitorDashboardRoute() {
  return (
    <AppShell title="本班综测总览 - 综测填写系统" maxWidthClass="max-w-7xl" monitorOnly scope="evaluation">
      <DashboardContent />
    </AppShell>
  );
}
