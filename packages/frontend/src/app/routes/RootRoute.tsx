import { useEffect } from 'react';
import ScreenState from '../../components/ui/ScreenState';
import { usePageMeta } from '../../lib/usePageMeta';
import { isLoggedIn } from '../../lib/auth';
import { navigateTo } from '../../lib/router';

export default function RootRoute() {
  usePageMeta('综测填写与申报系统');

  useEffect(() => {
    navigateTo(isLoggedIn() ? '/entry' : '/login', { replace: true });
  }, []);

  return <ScreenState label="正在进入系统" fullScreen />;
}
