import AppShell from '../AppShell';
import AccountsPage from '../../features/platform/AccountsPage';

export default function AccountsRoute() {
  return (
    <AppShell
      title="账号管理"
      maxWidthClass="max-w-6xl"
      adminOnly
      scope="shared"
    >
      <AccountsPage />
    </AppShell>
  );
}
