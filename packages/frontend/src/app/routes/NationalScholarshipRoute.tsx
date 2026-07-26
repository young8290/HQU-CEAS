import AppShell from '../AppShell';
import NationalScholarshipPage from '../../features/declaration/NationalScholarshipPage';

export default function NationalScholarshipRoute() {
  return (
    <AppShell title="国家奖学金评定 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1500px]" adminOnly scope="declaration">
      <NationalScholarshipPage />
    </AppShell>
  );
}
