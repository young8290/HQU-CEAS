import AuditLogsPage from '../components/audit/AuditLogsPage';
import AppShell from '../components/layout/AppShell';

export default function AuditLogsRoute() {
  return (
    <AppShell title="操作日志 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1400px]" adminOnly scope="declaration">
      <AuditLogsPage />
    </AppShell>
  );
}
