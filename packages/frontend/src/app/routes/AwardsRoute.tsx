import AppShell from '../AppShell';
import AwardsPage from '../../features/declaration/AwardsPage';

export default function AwardsRoute() {
  return (
    <AppShell title="奖学金申报 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1500px]" monitorOnly scope="declaration">
      <AwardsPage />
    </AppShell>
  );
}
