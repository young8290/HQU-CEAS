import LoginForm from '../../features/platform/LoginForm';
import { usePageMeta } from '../../lib/usePageMeta';

export default function LoginRoute() {
  usePageMeta('登录 - 综测与申报系统');

  return <LoginForm />;
}
