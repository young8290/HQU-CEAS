import MailTemplatePage from '../components/mail/MailTemplatePage';
import AppShell from '../components/layout/AppShell';

export default function MailTemplateRoute() {
  return (
    <AppShell title="邮件模板 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1400px]" adminOnly scope="declaration">
      <MailTemplatePage />
    </AppShell>
  );
}
