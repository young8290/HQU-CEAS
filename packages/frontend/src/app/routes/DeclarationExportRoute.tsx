import AppShell from '../AppShell';
import ExportPage from '../../features/evaluation/ExportPage';

export default function DeclarationExportRoute() {
  return (
    <AppShell title="申报材料导出 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-5xl" adminOnly scope="declaration">
      <ExportPage scope="declaration" />
    </AppShell>
  );
}
