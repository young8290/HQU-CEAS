import AppShell from '../AppShell';
import GuidePage from '../../features/platform/GuidePage';

export default function GuideRoute() {
  return (
    <AppShell title="新手指引 - 综测填写与申报系统" maxWidthClass="max-w-5xl" scope="shared">
      <GuidePage />
    </AppShell>
  );
}
