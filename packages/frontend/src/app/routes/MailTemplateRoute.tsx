import AppShell from '../AppShell';
import MailTemplatePage from '../../features/platform/MailTemplatePage';

export default function MailTemplateRoute() {
  return (
    <AppShell title="邮件模板" maxWidthClass="max-w-[1400px]" adminOnly scope="shared">
      <MailTemplatePage />
    </AppShell>
  );
}
