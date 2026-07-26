import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from './useAuth';
import { isLoggedIn, clearAuth } from '../../lib/auth';
import { navigateTo } from '../../lib/router';

export default function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      fetch('/api/platform/auth/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }).then(res => {
        if (res.ok) {
          navigateTo('/entry', { replace: true });
        } else {
          clearAuth();
        }
      }).catch(() => {
        clearAuth();
      });
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigateTo('/entry', { replace: true });
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf7f0] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-10">
        <section className="flex min-h-[calc(100vh-4rem)] flex-col justify-between">
          <div>
            <div className="mb-12 flex items-center gap-4 border-b border-[#e8dfd2] pb-6 dark:border-neutral-800">
            <img
              src="/college-logo.png"
              alt="学院logo"
              width="64"
              height="64"
              decoding="async"
              className="h-16 w-16 rounded-md border border-[#ded6c8] bg-white object-contain p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            />
            <div>
              <p className="text-sm font-medium text-[#9a5b3d] dark:text-primary-300">计算机科学与技术学院</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal text-neutral-950 dark:text-white">
                综测填写与申报系统
              </h1>
            </div>
          </div>

            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#9a5b3d] dark:text-primary-300">workspace</p>
              <h2 className="mt-3 max-w-2xl text-[2rem] font-semibold leading-tight tracking-normal text-neutral-950 dark:text-white md:text-[2.75rem]">
                综测填写与申报管理。
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-600 dark:text-neutral-300">
            登录后进入对应业务区，按账号权限显示页面。
          </p>
            </div>

            <div className="mt-10 max-w-3xl overflow-hidden rounded-lg border border-[#e2d7c8] bg-[#fffdf8] shadow-[0_1px_0_rgba(40,32,24,0.04)] dark:border-neutral-800 dark:bg-neutral-900">
            <SystemRow
              name="综合素质测评填写系统"
              scope="综测数据区"
              detail="学生信息、分数维护、数据导入、附件导出、评审确认。"
            />
            <SystemRow
              name="奖学金与荣誉称号申报系统"
              scope="班级申报区"
              detail="候选名单、确认项、班长协议、申报审核、邮件记录。"
            />
            <SystemRow
              name="身份权限"
              scope="统一认证"
              detail="管理员管理全院数据，班长管理本班数据。"
            />
          </div>
          </div>

          <p className="mt-8 text-xs leading-5 text-neutral-400 dark:text-neutral-500">
            2025-2026 计算机科学与技术学院学术部
          </p>
        </section>

        <section className="self-center rounded-lg border border-[#e2d7c8] bg-[#fffdf8] p-6 shadow-[0_18px_50px_rgba(65,48,34,0.08)] dark:border-neutral-800 dark:bg-neutral-900 md:p-8">
          <div className="mb-7">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">账号登录</p>
            <h2 className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-white">登录</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              管理员和班长共用入口。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                用户名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                required
                autoComplete="username"
                className="h-12 w-full rounded-md border border-[#d8c9b8] bg-white px-4 text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#9a5b3d] focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-primary-400 dark:focus:ring-primary-900"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                密码
              </label>
              <div className="flex h-12 overflow-hidden rounded-md border border-[#d8c9b8] bg-white focus-within:border-[#9a5b3d] focus-within:ring-2 focus-within:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-primary-400 dark:focus-within:ring-primary-900">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码"
                  required
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent px-4 text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="border-l border-[#e4d8ca] px-4 text-sm text-neutral-500 transition-colors hover:bg-[#f6f1e8] hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
                >
                  {showPassword ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full cursor-pointer rounded-md bg-[#9a5b3d] text-sm font-medium text-white transition-colors duration-200 hover:bg-[#7c4a34] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '登录中' : '登录'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function SystemRow({ name, scope, detail }: { name: string; scope: string; detail: string }) {
  return (
    <div className="grid gap-2 border-b border-[#eee4d7] px-4 py-4 last:border-b-0 dark:border-neutral-800 md:grid-cols-[180px_110px_1fr]">
      <p className="text-sm font-medium text-neutral-950 dark:text-white">{name}</p>
      <p className="text-xs text-[#9a5b3d] dark:text-primary-300">{scope}</p>
      <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}
