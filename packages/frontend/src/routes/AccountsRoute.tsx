import AccountsPage from '../components/accounts/AccountsPage';
import AppShell from '../components/layout/AppShell';

export default function AccountsRoute() {
  return (
    <AppShell
      title="账号管理 - 奖学金与荣誉称号申报系统"
      maxWidthClass="max-w-6xl"
      adminOnly
      scope="declaration"
    >
      <AccountsPage />
    </AppShell>
  );
}
