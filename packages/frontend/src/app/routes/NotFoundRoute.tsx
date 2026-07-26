import { AppLink } from '../../lib/router';
import { usePageMeta } from '../../lib/usePageMeta';

export default function NotFoundRoute() {
  usePageMeta('404 - 页面未找到');

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-6xl font-semibold text-[#9a5b3d] dark:text-primary-300">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-neutral-950 dark:text-white">
          页面未找到
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          页面不存在或链接已失效。
        </p>
        <AppLink
          to="/login"
          className="mt-6 inline-flex rounded-md bg-[#9a5b3d] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34]"
        >
          返回登录页
        </AppLink>
      </div>
    </div>
  );
}
