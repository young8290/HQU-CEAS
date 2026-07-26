import AppShell from '../AppShell';
import AuditLogsPage from '../../features/platform/AuditLogsPage';

export default function AuditLogsRoute() {
  return (
    <AppShell title="操作日志" maxWidthClass="max-w-[1400px]" adminOnly scope="shared">
      <AuditLogsPage />
    </AppShell>
  );
}
