import AppShell from '../AppShell';
import TagsPage from '../../features/declaration/TagsPage';

export default function TagsRoute() {
  return (
    <AppShell title="标签视图 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1400px]" adminOnly scope="declaration">
      <TagsPage />
    </AppShell>
  );
}
