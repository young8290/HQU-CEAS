import LoginForm from '../components/auth/LoginForm';
import { usePageMeta } from '../hooks/usePageMeta';

export default function LoginRoute() {
  usePageMeta('登录 - 综测与申报系统');

  return <LoginForm />;
}
