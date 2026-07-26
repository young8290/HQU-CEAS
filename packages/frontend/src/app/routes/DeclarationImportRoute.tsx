import AppShell from '../AppShell';
import ImportPage from '../../features/evaluation/ImportPage';

export default function DeclarationImportRoute() {
  return (
    <AppShell title="申报数据导入 - 奖学金与荣誉称号申报系统" maxWidthClass="max-w-5xl" scope="declaration">
      <ImportPage scope="declaration" />
    </AppShell>
  );
}
