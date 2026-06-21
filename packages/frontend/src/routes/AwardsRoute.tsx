import AwardsPage from '../components/awards/AwardsPage';
import AppShell from '../components/layout/AppShell';

export default function AwardsRoute() {
  return (
    <AppShell title="奖学金申报 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1500px]" scope="declaration">
      <AwardsPage />
    </AppShell>
  );
}
