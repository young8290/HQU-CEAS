import AppShell from '../AppShell';
import ExportPage from '../../features/evaluation/ExportPage';

export default function ExportRoute() {
  return (
    <AppShell title="附件导出 - 综测填写系统" maxWidthClass="max-w-5xl" scope="evaluation">
      <ExportPage scope="evaluation" />
    </AppShell>
  );
}
