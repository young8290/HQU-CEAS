import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getUser, clearAuth, roleLabel } from '../../lib/auth';
import { navigateTo } from '../../lib/router';

interface AcademicYear {
  id: number;
  name: string;
  isCurrent: boolean;
}

export default function SettingsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [newYearName, setNewYearName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [entryStatus, setEntryStatus] = useState({
    comprehensiveEvalOpen: true,
    declarationOpen: true,
    declarationCloseReason: '',
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const user = getUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadYears();
    if (isAdmin) {
      api.get('/system/settings')
        .then((data) => {
          if (data.entryStatus) setEntryStatus(data.entryStatus);
        })
        .catch(() => undefined);
    }
  }, []);

  const loadYears = async () => {
    try {
      const data = await api.get('/academic-years');
      setYears(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateYear = async () => {
    if (!newYearName.trim()) return;
    setError('');
    try {
      await api.post('/academic-years', { name: newYearName });
      setNewYearName('');
      setSuccessMsg('学年创建成功');
      await loadYears();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '创建失败');
    }
  };

  const handleActivateYear = async (yearId: number) => {
    try {
      await api.put(`/academic-years/${yearId}/activate`, {});
      setSuccessMsg('学年已激活');
      await loadYears();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '激活失败');
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码至少6个字符');
      return;
    }
    setError('');
    try {
      await api.put('/auth/password', { oldPassword, newPassword });
      setSuccessMsg('密码已修改，重新登录');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        clearAuth();
        navigateTo('/login', { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err.message || '修改失败');
    }
  };

  const handleSaveEntryStatus = async () => {
    try {
      await api.put('/system/settings', { entryStatus });
      setSuccessMsg('系统开放状态已保存');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '保存失败');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-neutral-400">加载中</div></div>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
          <h1 className="text-2xl font-bold text-neutral-950 dark:text-white font-headings">系统设置</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">学年、开放状态和账号安全。</p>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Academic Year Management */}
      {isAdmin && (
        <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-4">学年管理</h2>

          {/* Current years list */}
          <div className="space-y-2 mb-4">
            {years.map((year) => (
              <div
                key={year.id}
                className={`flex items-center justify-between rounded-md border p-3 ${
                  year.isCurrent
                    ? 'border-[#9a5b3d] bg-white dark:border-primary-700 dark:bg-primary-500/10'
                    : 'border-[#ded6c8] bg-white dark:border-neutral-700 dark:bg-neutral-950'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-neutral-950 dark:text-white font-medium">{year.name}</span>
                  {year.isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300">
                      当前学年
                    </span>
                  )}
                </div>
                {!year.isCurrent && (
                  <button
                    onClick={() => handleActivateYear(year.id)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800"
                  >
                    设为当前
                  </button>
                )}
              </div>
            ))}
            {years.length === 0 && (
              <div className="text-neutral-400 text-sm">暂无学年</div>
            )}
          </div>

          {/* Add new year */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newYearName}
              onChange={(e) => setNewYearName(e.target.value)}
              className="flex-1 rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              placeholder="学年名称，如：2025-2026学年"
            />
            <button
              onClick={handleCreateYear}
              className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white transition-colors hover:bg-[#7c4a34]"
            >
              创建
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-4">系统开放状态</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={entryStatus.comprehensiveEvalOpen}
                onChange={(event) => setEntryStatus({ ...entryStatus, comprehensiveEvalOpen: event.target.checked })}
                className="h-4 w-4 accent-primary-600"
              />
              综合素质测评填写系统开放
            </label>
            <label className="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={entryStatus.declarationOpen}
                onChange={(event) => setEntryStatus({ ...entryStatus, declarationOpen: event.target.checked })}
                className="h-4 w-4 accent-primary-600"
              />
              奖学金与荣誉称号申报系统开放
            </label>
            <label className="block text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">申报系统关闭说明</span>
              <textarea
                value={entryStatus.declarationCloseReason}
                onChange={(event) => setEntryStatus({ ...entryStatus, declarationCloseReason: event.target.value })}
                rows={3}
                className="mt-1 w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveEntryStatus}
              className="rounded-md bg-[#9a5b3d] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34]"
            >
              保存开放状态
            </button>
          </div>
        </div>
      )}

      {/* Change Password */}
      <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-4">修改密码</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">当前密码</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>
          <button
            onClick={handleChangePassword}
            className="rounded-md bg-[#9a5b3d] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34]"
          >
            修改密码
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-4">账号信息</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-neutral-500">用户名</span>
            <span className="text-neutral-950 dark:text-white font-mono">{user?.username}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-neutral-500">显示名</span>
            <span className="text-neutral-950 dark:text-white">{user?.displayName}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-neutral-500">角色</span>
            <span className="text-neutral-950 dark:text-white">{roleLabel(user?.role)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
