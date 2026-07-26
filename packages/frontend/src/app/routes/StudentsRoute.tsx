import AppShell from '../AppShell';
import StudentsPage from '../../features/evaluation/StudentsPage';

export default function StudentsRoute() {
  return (
    <AppShell
      title="学生管理 - 综测填写系统"
      maxWidthClass="max-w-7xl"
      adminOnly
      scope="evaluation"
    >
      <StudentsPage />
    </AppShell>
  );
}
