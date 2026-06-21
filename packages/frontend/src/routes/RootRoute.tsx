import { useEffect } from 'react';
import LoginRoute from './LoginRoute';
import SystemEntryRoute from './SystemEntryRoute';
import { usePageMeta } from '../hooks/usePageMeta';
import { isLoggedIn } from '../lib/auth';
import { navigateTo } from '../lib/router';

export default function RootRoute() {
  usePageMeta('综测填写系统');

  const targetPath = isLoggedIn() ? '/entry' : '/login';
  const TargetRoute = targetPath === '/entry' ? SystemEntryRoute : LoginRoute;

  useEffect(() => {
    navigateTo(targetPath, { replace: true });
  }, [targetPath]);

  return <TargetRoute />;
}
