import MailPage from '../components/mail/MailPage';
import AppShell from '../components/layout/AppShell';

export default function MailRoute() {
  return (
    <AppShell title="邮箱配置 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1500px]" adminOnly scope="declaration">
      <MailPage />
    </AppShell>
  );
}
