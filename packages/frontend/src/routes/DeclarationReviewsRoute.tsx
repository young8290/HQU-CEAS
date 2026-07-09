import DeclarationReviewsPage from '../components/declarations/DeclarationReviewsPage';
import AppShell from '../components/layout/AppShell';

export default function DeclarationReviewsRoute() {
  return (
    <AppShell title="申报审核 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-[1500px]" adminOnly scope="declaration">
      <DeclarationReviewsPage />
    </AppShell>
  );
}
