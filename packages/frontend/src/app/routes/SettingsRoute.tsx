import AppShell from '../AppShell';
import SettingsPage from '../../features/platform/SettingsPage';

export default function SettingsRoute() {
  return (
    <AppShell title="系统设置 - 综测填写与申报系统" maxWidthClass="max-w-5xl" scope="shared">
      <SettingsPage />
    </AppShell>
  );
}
