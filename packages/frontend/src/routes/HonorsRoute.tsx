import HonorsPage from '../components/honors/HonorsPage';
import AppShell from '../components/layout/AppShell';

export default function HonorsRoute() {
  return (
    <AppShell title="荣誉称号申报 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1500px]" scope="declaration">
      <HonorsPage />
    </AppShell>
  );
}
