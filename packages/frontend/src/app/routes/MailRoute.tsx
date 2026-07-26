import AppShell from '../AppShell';
import MailPage from '../../features/platform/MailPage';

export default function MailRoute() {
  return (
    <AppShell title="邮箱配置" maxWidthClass="max-w-[1500px]" adminOnly scope="shared">
      <MailPage />
    </AppShell>
  );
}
