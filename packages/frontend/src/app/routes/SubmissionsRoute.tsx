import AppShell from '../AppShell';
import SubmissionsPage from '../../features/declaration/SubmissionsPage';

export default function SubmissionsRoute() {
  return (
    <AppShell title="提交记录 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-7xl" monitorOnly scope="declaration">
      <SubmissionsPage />
    </AppShell>
  );
}
