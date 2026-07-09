import AppShell from '../components/layout/AppShell';
import ExportPage from '../components/export/ExportPage';

export default function ExportRoute() {
  return (
    <AppShell title="附件导出 - 综测填写系统" maxWidthClass="max-w-5xl" scope="evaluation">
      <ExportPage scope="evaluation" />
    </AppShell>
  );
}
