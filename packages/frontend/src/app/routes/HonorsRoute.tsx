import AppShell from '../AppShell';
import HonorsPage from '../../features/declaration/HonorsPage';

export default function HonorsRoute() {
  return (
    <AppShell title="荣誉称号申报 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1500px]" monitorOnly scope="declaration">
      <HonorsPage />
    </AppShell>
  );
}
