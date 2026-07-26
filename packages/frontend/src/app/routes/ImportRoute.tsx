import AppShell from '../AppShell';
import ImportPage from '../../features/evaluation/ImportPage';

export default function ImportRoute() {
  return (
    <AppShell title="数据导入 - 综测填写系统" maxWidthClass="max-w-5xl" scope="evaluation">
      <ImportPage scope="evaluation" />
    </AppShell>
  );
}
